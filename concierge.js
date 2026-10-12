(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['concierge.js']='20261023';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// RE.DAM CONCIERGE V2 INTERACTION CONTROLLER (ZERO COMPROMISE ENGINE)
// ==============================================================

(function() {
    const SOLID_TEXTURES = {
        oak: "linear-gradient(135deg, #c7ad8f 0%, #a88d70 100%)",
        tile: "linear-gradient(135deg, #d8dadb 0%, #b4b8bb 100%)",
        neutral: "linear-gradient(135deg, #b8afa4 0%, #9c9287 100%)",
        walnut: "linear-gradient(135deg, #5c4436 0%, #3a281e 100%)",
        cream: "linear-gradient(135deg, #fdfbf7 0%, #f3ece2 100%)",
        coolWhite: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        greige: "linear-gradient(135deg, #eae5df 0%, #d5cec5 100%)",
        l1: "linear-gradient(135deg, #f4ede2 0%, #ded3bf 100%)",
        l2: "linear-gradient(135deg, #e7dac7 0%, #c5a786 100%)",
        l3: "linear-gradient(135deg, #946f4e 0%, #5c412f 100%)",
        l4: "linear-gradient(135deg, #3e2c21 0%, #201711 100%)"
    };

    const state = {
        step: "1-Space",
        roomsCart: [],
        editingRoomId: null,
        editingRoom: null,
        pendingItemQueue: [],
        currentItemIndex: 0,
        installFee: 30000,
        focusedFabricId: null,
        keypadTarget: null
    };

    const stepHistory = [];

    function getClientName() {
        try {
            const custEl = document.getElementById('custName');
            const expCustEl = document.getElementById('expressCustName');
            const val = (custEl && custEl.value) ? custEl.value : ((expCustEl && expCustEl.value) ? expCustEl.value : "");
            return val.trim() || "고객";
        } catch (e) {
            return "고객";
        }
    }

    // [핵심 해결] 스코프 제약 없는 실제 FABRIC_DB 안전 추출
    function getLiveDb() {
        try {
            if (typeof FABRIC_DB !== 'undefined' && Array.isArray(FABRIC_DB) && FABRIC_DB.length > 0) {
                window.FABRIC_DB = FABRIC_DB;
                return FABRIC_DB;
            }
        } catch(e) {}
        try {
            if (typeof window.FABRIC_DB !== 'undefined' && Array.isArray(window.FABRIC_DB) && window.FABRIC_DB.length > 0) {
                return window.FABRIC_DB;
            }
        } catch(e) {}
        try {
            if (typeof SAMPLE_FABRICS !== 'undefined' && Array.isArray(SAMPLE_FABRICS) && SAMPLE_FABRICS.length > 0) {
                return SAMPLE_FABRICS;
            }
        } catch(e) {}
        return [];
    }

    function getLiveCategoryPool(categoryType) {
        // 고객 추천에서 숨긴 원단(예: 비고 "원단만 시킬때")은 빼고 고름. 직원 화면 빠른 견적에는 그대로 있음
        const all = getLiveDb();
        const pool = (typeof isCustomerHidden === 'function') ? all.filter(f => !isCustomerHidden(f)) : all;

        if (categoryType === "블라인드") {
            const blindPool = pool.filter(f => f.categoryType === "블라인드" || f.calcType === "hebe" || (f.name && (f.name.includes("블라인드") || f.name.includes("콤비") || f.name.includes("우드"))));
            if (blindPool.length > 0) return blindPool;
        }

        if (categoryType === "속지") {
            const sheerPool = pool.filter(f => f.categoryType === "속지" || (f.name && (f.name.includes("쉬폰") || f.name.includes("차르르"))));
            if (sheerPool.length > 0) return sheerPool;
        }

        if (categoryType === "겉지") {
            const drapePool = pool.filter(f => f.categoryType === "겉지" || f.calcType === "width" || (f.name && (f.name.includes("암막") || f.name.includes("린넨"))));
            if (drapePool.length > 0) return drapePool;
        }

        return pool;
    }

    function getV1MatchScore(fabric, roomData, category) {
        if (!fabric) return 0;
        if (typeof window.calculateFabricMatchScore === 'function') {
            return window.calculateFabricMatchScore(fabric, roomData, category);
        }
        let score = 0;
        const fTone = fabric.tone || 'neutral';
        const floorT = roomData.floorTone || 'warm';
        if (fTone === floorT) score += 4;
        if (fabric.categoryType === category) score += 3;
        return score;
    }

    // 판매가 계산은 직원 화면과 같은 엔진(pricing.js)을 사용합니다.
    function calculateV1ItemPrice(c) {
        const fab = window.Pricing.pickFabric(getLiveDb(), c.fabricId);
        const p = window.Pricing.priceItem(c, fab);
        const isBlind = (c.presetType === 'blind' || fab.calcType === 'hebe');
        return {
            curtainSubtotal: p.curtainSubtotal,
            totalPrice: p.curtainSubtotal,
            sellingPrice: p.curtainSubtotal,
            qtyText: p.qtyText,
            actualH: p.actualCurtainHeight,
            fabBook: fab.book || (isBlind ? "블라인드" : "샘플북"),
            fabName: (fab.name || (isBlind ? "블라인드" : "원단")) + (typeof colorSuffix === "function" ? colorSuffix(c.colorName, fab.id) : ""),
            hwText: isBlind ? '블라인드 일체형' : `기본 레일 (${p.numJa}자)`
        };
    }

    // V1 전역 변수(rooms)에 100% 무결점 주입
    function syncToV1MasterRooms() {
        const configuredRooms = state.roomsCart.filter(r => r.isConfigured);

        const liveDb = getLiveDb();

        const convertedRooms = configuredRooms.map((r, rIdx) => ({
            id: rIdx + 1,
            name: r.name,
            sunlight: "south",
            lightLevel: r.lightLevel || "mid",
            floorTone: r.floorTone || "warm",
            wallTone: r.wallTone || "cool",
            mood: r.mood || "soft_warm",
            wantMood: r.wantMood || null,
            roomType: r.roomType || null,
            lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null,
            diagnosed: !!r.diagnosed,
            curtains: r.curtains.map((c, cIdx) => {
                const isBlind = c.presetType === "blind";
                let realFab = liveDb.find(f => f.id === c.fabricId);
                if (!realFab) {
                    if (isBlind) {
                        realFab = liveDb.find(f => f.categoryType === '블라인드' || f.calcType === 'hebe') || liveDb[0];
                    } else {
                        realFab = liveDb.find(f => f.categoryType === (c.presetType === 'sheer' ? '속지' : '겉지')) || liveDb[0];
                    }
                }
                const finalFabId = realFab ? realFab.id : c.fabricId;

                return {
                    id: (rIdx + 1) * 100 + (cIdx + 1),
                    label: c.label,
                    presetType: isBlind ? "blind" : (c.presetType || "drape"),
                    width: Number(c.width) || 340,
                    height: Number(c.height) || 235,
                    pleat: isBlind ? "1.0" : (c.pleat || "2.0"),
                    pleatType: isBlind ? "민자" : (c.pleatType || "나비주름"),
                    bookFilter: realFab ? realFab.book : "ALL",
                    fabricId: finalFabId,
                    installType: isBlind ? "none" : (c.installType || "rail"),
                    floorGap: isBlind ? 0 : (c.floorGap || 0),
                    hwName: isBlind ? "블라인드 일체형" : (c.hwName || "기본 레일"),
                    hwPrice: isBlind ? 0 : (c.hwPrice !== undefined ? c.hwPrice : 1000),
                    shapeFee: isBlind ? 0 : (c.shapeFee || 0),
                    leadBand: isBlind ? false : Boolean(c.leadBand),
                    hotelFit: isBlind ? false : Boolean(c.hotelFit),
                    colorName: c.colorName || '',
            calc: c.calc
                };
            })
        }));

        if (typeof window.syncFromExternalRooms === 'function') {
            window.syncFromExternalRooms(convertedRooms, state.installFee);
        } else {
            try {
                if (typeof rooms !== 'undefined') {
                    rooms.length = 0;
                    convertedRooms.forEach(item => rooms.push(item));
                }
            } catch(e) {}
            if (typeof window.rooms !== 'undefined') {
                window.rooms.length = 0;
                convertedRooms.forEach(item => window.rooms.push(item));
            }
            if (typeof calculateAll === 'function') calculateAll();
            else if (typeof window.calculateAll === 'function') window.calculateAll();
            if (typeof renderRooms === 'function') renderRooms();
            else if (typeof window.renderRooms === 'function') window.renderRooms();
        }
    }

    // 키패드는 기본으로 오른쪽 아래. 누른 입력칸을 가리게 되면 왼쪽 아래로 옮깁니다.
    function positionKeypad(target) {
        const sheet = document.getElementById("v2VirtualKeypadSheet");
        const box = document.getElementById(`measureBox_${target}`);
        if (!sheet) return;
        sheet.classList.remove("at-left");
        if (window.innerWidth <= 700 || !box) return;
        const m = 24, w = sheet.offsetWidth, h = sheet.offsetHeight;
        const r = box.getBoundingClientRect();
        const hits = (left) => !(r.right < left || r.left > left + w || r.bottom < window.innerHeight - m - h || r.top > window.innerHeight - m);
        const rightLeft = window.innerWidth - m - w;
        if (hits(rightLeft) && !hits(m)) sheet.classList.add("at-left");
    }

    function hideKeypadDirectly() {
        const sheet = document.getElementById("v2VirtualKeypadSheet");
        if (sheet) sheet.classList.remove("active");
        state.keypadTarget = null;
        const activeBox = document.querySelector('.measure-box.is-active');
        if (activeBox) activeBox.classList.remove('is-active');
    }

    function goToStep(nextStep, pushHistory) {
        hideKeypadDirectly();
        const optOv = document.getElementById('optInfoOverlay');
        if (optOv) optOv.style.display = 'none';
        if (pushHistory !== false && state.step !== nextStep) {
            stepHistory.push(state.step);
        }
        state.step = nextStep;
        updatePrevButtonVisibility();
        render();
    }

    function prevStep() {
        hideKeypadDirectly();
        if (stepHistory.length > 0) {
            const prev = stepHistory.pop();
            goToStep(prev, false);
        }
    }

    function updatePrevButtonVisibility() {
        const btn = document.getElementById("v2FloatingPrevBtn");
        if (!btn) return;
        const canGoBack = stepHistory.length > 0;
        btn.style.opacity = canGoBack ? "1" : "0";
        btn.style.pointerEvents = canGoBack ? "auto" : "none";
    }

    // 화면 위 가운데: 지금 무엇을 고르는지 짧은 질문 + 진행 점
    function roomTypeOf(room) {
        return String((room && (room.roomType || room.name)) || '').replace(/\s*\d+$/, '');
    }
    // 흐름 B: 사실(바닥·벽·채광) → 필요(빛 가림·바깥 시선) → 구성 → 취향(분위기·속지 느낌) → 원단
    function diagnosisSteps() {
        const steps = ["2-Base-Floor", "2-Base-Wall", "2-Base-Light", "2-Base-Block", "2-Base-Privacy", "3-Config-Style", "2-Base-Mood"];
        const items = (state.editingRoom && state.editingRoom.items) || [];
        if (state.step === "2-Base-SheerFeel" || items.some(i => i.presetType === 'sheer')) steps.push("2-Base-SheerFeel");
        return steps;
    }
    // 글 질문 화면 ("제안합니다" 화면과 같은 분위기): 큰 질문 + 글자 선택지. 사진이 필요 없는 질문에 사용
    function askStage(question, sub, opts, o) {
        o = o || {};
        const steps = diagnosisSteps(), at = steps.indexOf(state.step);
        let h = '<div class="ambient-stage ask-stage"><div class="ambient-light-glow"></div>';
        if (at >= 0) h += '<div class="step-dots ask-dots">' + steps.map((_, i) => `<span class="${i === at ? 'on' : (i < at ? 'done' : '')}"></span>`).join('') + '</div>';
        if (!o.noRoom && state.editingRoom && state.editingRoom.name) h += `<span class="q-meta">${state.editingRoom.name}</span>`;
        h += `<h2 class="q-title font-serif-kr">${question}</h2>`;
        if (sub) h += `<p class="q-sub">${sub}</p>`;
        h += `<div class="ask-opts${opts.length > 4 ? ' is-many' : ''}">`;
        opts.forEach(op => {
            h += `<button type="button" class="ask-opt${op.rec ? ' is-rec' : ''}" onclick="${op.on}"><span class="ask-label font-serif-kr">${op.label}</span>${op.desc ? `<span class="ask-desc">${op.desc}</span>` : ''}</button>`;
        });
        h += '</div></div>';
        return h;
    }
    // 고른 원단으로 칸을 채우는 스타일: 톤 색 위에 사진(있으면)을 덮음. 첫 화면 공간 칸·제안서 원단 칸이 함께 씀
    function fabricFillStyle(fabricId, colorName) {
        const color = (typeof fabricToneFill === 'function') ? fabricToneFill(fabricId, colorName) : '#d9cdbb';
        const urls = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabricId, colorName) : [];
        const imgs = urls.map(u => `url('${u}')`).join(', ');
        return `background-color: ${color};${imgs ? ` background-image: ${imgs};` : ''} background-size: cover; background-position: center;`;
    }
    // 치수 미세 조절 버튼 (숫자를 누르면 키패드, 버튼은 조금씩 더하고 빼기)
    function nudgeRowHtml(target, steps) {
        return '<div class="nudge-row">' + steps.map(s =>
            `<button type="button" class="nudge-btn font-serif-kr" aria-label="${target === 'width' ? '넓이' : '높이'} ${s > 0 ? '+' : '−'}${Math.abs(s)}cm" onclick="event.stopPropagation(); window.concierge.nudge('${target}', ${s})">${s > 0 ? '+' : '−'}${Math.abs(s)}</button>`
        ).join('') + '</div>';
    }
    function stepHead(question, sub) {
        const steps = diagnosisSteps();
        const at = steps.indexOf(state.step);
        let dots = '';
        if (at >= 0) dots = '<div class="step-dots">' + steps.map((_, i) => `<span class="${i === at ? 'on' : (i < at ? 'done' : '')}"></span>`).join('') + '</div>';
        return `<div class="step-head">${dots}<p class="step-q font-serif-kr">${question}</p>${sub ? `<p class="step-sub">${sub}</p>` : ''}</div>`;
    }

    // ---- 옵션 설명 그림 (적용 전 / 적용 후). 가격 대신 "무엇이 좋아지는지"를 보여줌 ----
    // 커튼을 세로 띠(주름)로 그림. 위(레일)·아래 폭, 주름 수, 흔들림, 밑단 모양을 바꿔 차이를 표현
    function curtainSvg(o) {
        const W = 220, H = 150, top = 16, bot = 136;
        const n = o.n, jit = o.jitter || [], wave = o.wave || 0;
        const xs = (l, r, i) => l + (r - l) * i / n;
        const by = i => bot + (wave ? Math.sin(i * 1.7) * wave + (i % 3 === 0 ? wave * 0.6 : 0) : 0);
        let g = `<line x1="${o.topL - 12}" y1="${top}" x2="${o.topR + 12}" y2="${top}" stroke="#6f5f4f" stroke-width="3" stroke-linecap="round"/>`;
        for (let i = 0; i < n; i++) {
            const t1 = xs(o.topL, o.topR, i), t2 = xs(o.topL, o.topR, i + 1);
            const b1 = xs(o.botL, o.botR, i) + (jit[i] || 0), b2 = xs(o.botL, o.botR, i + 1) + (jit[i + 1] || 0);
            const fill = i % 2 === 0 ? o.c1 : o.c2;
            g += `<path d="M${t1},${top + 2} L${t2},${top + 2} L${b2},${by(i + 1)} L${b1},${by(i)} Z" fill="${fill}" fill-opacity="${o.op || 1}"/>`;
        }
        if (o.band) g += `<path d="M${o.botL},${bot - 4} L${o.botR},${bot - 4} L${o.botR},${bot} L${o.botL},${bot} Z" fill="#8a6d52"/>`;
        return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" aria-hidden="true">${g}</svg>`;
    }
    const OPTION_INFO = {
        shapeFee: {
            title: '형상기억 가공',
            desc: '주름 모양을 열로 고정해, 커튼을 걷거나 내려도 반듯한 주름이 그대로 유지돼요.',
            off: { topL: 55, topR: 165, botL: 22, botR: 198, n: 8, jitter: [0, 6, -5, 9, -7, 4, -8, 5, 0], wave: 5, c1: '#d9c7ae', c2: '#c4ad8e' },
            on: { topL: 55, topR: 165, botL: 55, botR: 165, n: 8, c1: '#d9c7ae', c2: '#c4ad8e' }
        },
        hotelFit: {
            title: '호텔핏 (+1폭 볼륨)',
            desc: '원단을 한 폭 더 넣어 주름이 깊고 풍성해져요. 호텔처럼 꽉 차고 도톰한 느낌이에요.',
            off: { topL: 40, topR: 180, botL: 40, botR: 180, n: 5, c1: '#d9c7ae', c2: '#cdb89b' },
            on: { topL: 40, topR: 180, botL: 40, botR: 180, n: 11, c1: '#dccab1', c2: '#b89f7e' }
        },
        leadBand: {
            title: '하단 리드밴드',
            desc: '속지 밑단에 무게감 있는 끈을 넣어, 밑단이 일자로 반듯하게 떨어지고 바람에 덜 날려요.',
            textOnly: true      // 그림 없이 문구만 보여 줌
        }
    };
    function optionInfoHtml(keys) {
        let h = '<div class="opt-info-sheet" onclick="event.stopPropagation()">';
        h += '<div class="opt-info-head font-serif-kr">제작 옵션 미리보기</div>';
        keys.forEach(k => {
            const o = OPTION_INFO[k];
            h += `<div class="opt-info-row${o.textOnly ? ' text-only' : ''}">`;
            h += `<div class="opt-info-text"><strong class="font-serif-kr">${o.title}</strong><p>${o.desc}</p></div>`;
            if (o.textOnly) { h += '</div>'; return; }
            h += `<figure><div class="opt-info-pic">${curtainSvg(o.off)}</div><figcaption>기본</figcaption></figure>`;
            h += `<figure><div class="opt-info-pic on">${curtainSvg(o.on)}</div><figcaption>적용</figcaption></figure>`;
            h += '</div>';
        });
        h += '<button class="opt-info-close" onclick="window.concierge.closeOptionInfo()">닫기</button>';
        return h + '</div>';
    }

    // ---- 두 번째 공간부터: 앞에서 진단한 공간과 바닥·벽이 같으면 바로 넘어가기 ----
    // 이름 뒤 조사: 받침 있으면 "과", 없으면 "와" (예: 방과, 거실과, 방 2와)
    function withGwa(name) {
        const t = String(name || '').trim();
        const ch = t.slice(-1);
        if (/[0-9]/.test(ch)) return t + ('0136780'.includes(ch) ? '과' : '와');
        const c = ch.charCodeAt(0);
        if (c >= 0xAC00 && c <= 0xD7A3) return t + (((c - 0xAC00) % 28) ? '과' : '와');
        return t + '와(과)';
    }
    function copySourceRoom() {
        const cur = state.editingRoom;
        if (!cur) return null;
        const done = state.roomsCart.filter(r => r.isConfigured && r.diagnosed && r.id !== cur.id);
        return done.length ? done[done.length - 1] : null;
    }

    function render() {
        const main = document.getElementById("v2Viewport");
        if (!main) return;

        const currentCust = getClientName();
        let html = '<div class="w-full h-full flex flex-col items-center justify-center stage-transition" style="min-height: 100vh; width: 100vw; background: #fbf9f5;">';

        switch (state.step) {
            // [Step 1: 공간 장바구니 캔버스]
            case "1-Space": {
                const configuredRooms = state.roomsCart.filter(r => r.isConfigured);
                const hasConfigured = configuredRooms.length > 0;
                let grandSum = 0;
                configuredRooms.forEach(r => grandSum += (r.subtotal || 0));

                html += '<div class="space-stage">';
                // 왼쪽: Re.dam · 고객명/현장명 · 연락처 · 설명 (지금 디자인 그대로)
                html += '<div class="space-left font-serif-kr">';
                html += '<h1 style="font-size: 2.8rem; font-weight: 700; color: #2b221a; letter-spacing: -0.02em; cursor: pointer;" onclick="window.concierge.staffTap()">Re.dam</h1>';
                html += '<p style="font-size: 0.95rem; color: #6f5f4f; margin-top: 0.6rem; line-height: 1.6;">공간별 빛과 결을 채워 넣는 비스포크 큐레이션입니다.<br>오른쪽 <strong style="color: #91401a;">+ 공간 추가</strong>를 탭하여 공간을 등록해 주세요.</p>';
                html += `<input type="text" id="cName_ui" value="${(document.getElementById('custName') ? document.getElementById('custName').value : '').replace(/"/g, '&quot;')}" placeholder="고객명 / 현장명 (선택)" oninput="window.concierge.setClientName(this.value)" style="margin-top: 1.4rem; width: 100%; max-width: 320px; padding: 0.9rem 1.1rem; border: 1.5px solid #e5dcd0; border-radius: 16px; font-size: 1rem; font-weight: 600; background: #fff; color: #2b221a; outline: none;">`;
                html += `<input type="tel" id="cPhone_ui" inputmode="numeric" autocomplete="off" value="${((document.getElementById('custPhone') || {}).value || '').replace(/"/g, '&quot;')}" placeholder="연락처 (선택)" oninput="window.concierge.setClientPhone(this)" style="margin-top: 0.6rem; width: 100%; max-width: 320px; padding: 0.9rem 1.1rem; border: 1.5px solid #e5dcd0; border-radius: 16px; font-size: 1rem; font-weight: 600; background: #fff; color: #2b221a; outline: none;">`;
                html += '</div>';

                // 오른쪽: 기존 "+ 공간 추가" 세로 패널 그대로. 공간이 생기면 패널 안 위쪽부터 가로 카드로 쌓이고,
                // 자리가 모자라므로 "+ 공간 추가"는 가로쓰기로 바뀜. 패널 빈 곳을 눌러도 추가
                const roomCount = state.roomsCart.length;
                html += `<div class="space-panel${roomCount ? ' has-rooms' : ''}">`;
                if (!roomCount) {
                    html += renderBookmarkCard("+ 공간 추가", "터치해서 추가하기", '', SOLID_TEXTURES.walnut, function() {
                        window.concierge.startNewRoomSelection();
                    });
                } else {
                    html += `<div class="bookmark-card lcard" style="width: 100%; height: 100%; cursor: pointer;" onclick="window.concierge.startNewRoomSelection()">`;
                    html += `<div class="bookmark-bg" style="background: ${SOLID_TEXTURES.walnut}; pointer-events: none;"></div>`;
                    html += '<div class="bookmark-gradient fab-gradient" style="pointer-events: none;"></div>';
                    html += '<div class="space-list">';
                    state.roomsCart.forEach((room, idx) => {
                        // 구성을 마친 공간은 고른 원단(사진, 없으면 톤 색)으로 채움. 이중커튼은 속지·겉지 반씩. 아직인 공간은 비워 둠
                        const picks = room.isConfigured ? (room.curtains || []).filter(c => c.fabricId).slice(0, 3) : [];
                        html += `<div class="space-item${picks.length ? '' : ' is-empty'}" onclick="event.stopPropagation(); window.concierge.openRoomCart(${room.id})">`;
                        if (picks.length) html += '<div class="si-fill">' + picks.map(c => `<span style="${fabricFillStyle(c.fabricId, c.colorName)}"></span>`).join('') + '</div>';
                        html += '<div class="si-shade"></div>';
                        html += `<span class="si-name font-serif-kr">${room.name}</span>`;
                        html += '<span class="si-actions">';
                        html += `<button type="button" class="si-del" aria-label="${room.name} 삭제" onclick="event.stopPropagation(); window.concierge.deleteRoom(${room.id})">삭제</button>`;
                        html += `<span class="si-edit">${room.isConfigured ? '수정하기' : '구성하기'}</span>`;
                        html += '</span></div>';
                    });
                    html += '</div>';
                    html += '<div class="space-add-h"><span class="sah-title font-serif-kr">+ 공간 추가</span><span class="sah-desc">터치해서 추가하기</span></div>';
                    html += '</div>';
                }
                html += '</div>';

                // 합계: 화면 아래 가운데 (공간 카드에는 금액을 띄우지 않음)
                if (hasConfigured) {
                    html += '<button type="button" class="space-total font-serif-kr" onclick="window.concierge.goToCheckout()">';
                    html += '<span class="st-label">총 제안 금액</span>';
                    html += `<span class="st-amount">${grandSum.toLocaleString()}<small>원</small></span>`;
                    html += '<span class="st-go">최종 제안 보기 <i class="fa-solid fa-arrow-right"></i></span>';
                    html += '</button>';
                }
                html += '</div>';
                break;
            }

            // [Step 1.5: 7종 공간 선택]
            case "1.5-Room-Type":
                html += askStage('어느 공간의 창인가요?', '', [
                    { label: '거실', desc: '빛과 쉼의 중심', on: "window.concierge.chooseRoomType('거실')" },
                    { label: '방', desc: '숙면과 프라이빗', on: "window.concierge.chooseRoomType('방')" },
                    { label: '서재', desc: '몰입을 위한 빛', on: "window.concierge.chooseRoomType('서재')" },
                    { label: '주방', desc: '단정하고 깨끗하게', on: "window.concierge.chooseRoomType('주방')" },
                    { label: '알파룸', desc: '다목적 공간', on: "window.concierge.chooseRoomType('알파룸')" },
                    { label: '드레스룸', desc: '옷감 보호', on: "window.concierge.chooseRoomType('드레스룸')" },
                    { label: '베란다', desc: '직사광 조절', on: "window.concierge.chooseRoomType('베란다')" }
                ], { noRoom: true });
                break;

            // [Step 2-0: 앞 공간과 같은 바닥·벽인지 (두 번째 공간부터)]
            case "2-Base-Copy": {
                const src = copySourceRoom();
                const srcDesc = src ? `바닥 ${TONE_LABELS[src.floorTone] || ''} 톤 · 벽 ${TONE_LABELS[src.wallTone] || ''} 톤` : '';
                html += askStage(src ? `${withGwa(src.name)} 바닥·벽이 같은가요?` : '바닥·벽을 골라 주세요', srcDesc, [
                    { label: '네, 같아요', desc: '바닥·벽 선택을 건너뛰어요', on: 'window.concierge.copyBaseFromPrev(true)' },
                    { label: '아니요, 새로 고를게요', desc: '이 공간의 톤을 직접 골라요', on: 'window.concierge.copyBaseFromPrev(false)' }
                ]);
                break;
            }

            // [Step 2-1: 바닥재 진단]
            case "2-Base-Floor":
                html += '<div class="bookmark-stage">';
                html += stepHead('커튼 색을 맞추기 위해, 바닥 톤을 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("웜 톤", "오크·베이지 계열 밝은 마루", "FLOOR 01", SOLID_TEXTURES.oak, function() { window.concierge.selectFloorTone('warm'); });
                html += renderBookmarkCard("쿨 톤", "포세린 타일·대리석·화이트 계열", "FLOOR 02", SOLID_TEXTURES.tile, function() { window.concierge.selectFloorTone('cool'); });
                html += renderBookmarkCard("뉴트럴 톤", "그레이지·회색 계열 마루", "FLOOR 03", SOLID_TEXTURES.neutral, function() { window.concierge.selectFloorTone('neutral'); });
                html += renderBookmarkCard("딥 톤", "월넛·다크 브라운 계열 마루", "FLOOR 04", SOLID_TEXTURES.walnut, function() { window.concierge.selectFloorTone('deep'); });
                html += '</div></div>';
                break;

            // [Step 2-2: 벽지 진단]
            case "2-Base-Wall":
                html += '<div class="bookmark-stage">';
                html += stepHead('벽 톤도 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("웜 톤", "크림·아이보리 계열 벽지", "WALL 01", SOLID_TEXTURES.cream, function() { window.concierge.selectWallTone('warm'); });
                html += renderBookmarkCard("쿨 톤", "화이트·라이트 그레이 계열 벽지", "WALL 02", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectWallTone('cool'); });
                html += renderBookmarkCard("뉴트럴 톤", "그레이지·무채색 계열 벽지", "WALL 03", SOLID_TEXTURES.greige, function() { window.concierge.selectWallTone('neutral'); });
                html += renderBookmarkCard("딥 톤", "체리·다크 우드 계열 포인트 마감", "WALL 04", SOLID_TEXTURES.walnut, function() { window.concierge.selectWallTone('deep'); });
                html += '</div></div>';
                break;

            // [Step 2-3: 일조량 진단]
            case "2-Base-Light":
                html += askStage('창으로 햇빛은 얼마나 들어오나요?', '', [
                    { label: '풍부해요', desc: '남향·고층, 눈부신 직사광', on: "window.concierge.selectLightLevel('high')" },
                    { label: '은은해요', desc: '동향·서향, 부드러운 햇살', on: "window.concierge.selectLightLevel('mid')" },
                    { label: '차분해요', desc: '북향·저층, 낮은 채광', on: "window.concierge.selectLightLevel('low')" }
                ]);
                break;

            // [빛 가림: 모든 공간에서 (구성 추천과 겉지 암막·블라인드 추천에 사용)]
            case "2-Base-Block":
                html += askStage('빛을 얼마나 가리고 싶으세요?', '', [
                    { label: '들어와도 괜찮아요', desc: '햇살이 은은하게 스미도록', on: "window.concierge.selectLightBlock('light')" },
                    { label: '적당히 가려 주세요', desc: '눈부심만 줄이고 아늑하게', on: "window.concierge.selectLightBlock('soft')" },
                    { label: '완전히 어둡게', desc: '빛을 거의 막는 암막', on: "window.concierge.selectLightBlock('dark')" }
                ]);
                break;

            // [바깥 시선: 모든 공간에서 (구성 추천과 속지 비침 추천에 사용)]
            case "2-Base-Privacy":
                html += askStage('밖에서 안이 보이는 게 신경 쓰이세요?', '', [
                    { label: '괜찮아요', desc: '높은 층이거나 앞이 트여 있어요', on: "window.concierge.selectPrivacy('open')" },
                    { label: '조금 신경 쓰여요', desc: '낮에 적당히 가려지면 좋겠어요', on: "window.concierge.selectPrivacy('some')" },
                    { label: '많이 신경 쓰여요', desc: '저층이거나 앞 건물이 가까워요', on: "window.concierge.selectPrivacy('high')" }
                ]);
                break;

            // [속지 질감 취향: 속지가 들어가는 구성에서 한 번]
            case "2-Base-SheerFeel":
                html += '<div class="bookmark-stage">';
                html += stepHead('속지는 어떤 느낌이 좋으세요?');
                html += '<div class="bookmark-canvas" style="--items-count: 3;">';
                html += renderBookmarkCard("깔끔하고 매끈하게", "결이 거의 없는 차르르한 원단", "", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectSheerFeel('smooth'); });
                html += renderBookmarkCard("결이 살아 있게", "린넨처럼 자연스러운 결과 마디", "", SOLID_TEXTURES.oak, function() { window.concierge.selectSheerFeel('textured'); });
                html += renderBookmarkCard("상관없어요", "공간에 어울리는 쪽으로 추천해 주세요", "", SOLID_TEXTURES.l2, function() { window.concierge.selectSheerFeel('any'); });
                html += '</div></div>';
                break;

            // [Step 2-4: 희망 분위기 선택]
            case "2-Base-Mood":
                html += '<div class="bookmark-stage">';
                html += stepHead('원하시는 분위기를 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 6;">';
                html += renderBookmarkCard("포근한", "아이보리·베이지", "MOOD 01", SOLID_TEXTURES.l1, function() { window.concierge.selectMood('soft_warm'); }, 'vdesc');
                html += renderBookmarkCard("깔끔한", "화이트·그레이", "MOOD 02", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectMood('urban_clean'); }, 'vdesc');
                html += renderBookmarkCard("은은한", "그레이지", "MOOD 03", SOLID_TEXTURES.greige, function() { window.concierge.selectMood('balanced_neutral'); }, 'vdesc');
                html += renderBookmarkCard("자연스러운", "린넨의 결", "MOOD 04", SOLID_TEXTURES.oak, function() { window.concierge.selectMood('textured_linen'); }, 'vdesc');
                html += renderBookmarkCard("아늑한", "차콜·브라운", "MOOD 05", SOLID_TEXTURES.l4, function() { window.concierge.selectMood('deep_private'); }, 'vdesc');
                html += renderBookmarkCard("화사한", "밝고 가벼운", "MOOD 06", SOLID_TEXTURES.cream, function() { window.concierge.selectMood('airy_bright'); }, 'vdesc');
                html += '</div></div>';
                break;

            // [Step 3: 창호 구성 방식 선택]
            case "3-Config-Style":
                // 공간 종류(방은 빛 차단 희망까지)에 맞는 구성에 "추천" 표시. 카드 순서는 그대로
                const recComp = (typeof recommendComposition === 'function') ? recommendComposition(state.editingRoom) : null;
                const compTag = (key, en) => en;
                const recCls = key => recComp === key ? 'is-recommended' : '';
                html += '<div class="bookmark-stage">';
                html += stepHead('창을 어떻게 구성할까요?', recComp ? '빛과 시선 답에 맞는 구성을 표시했어요' : '');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("호텔식 이중창", "차르르 속지 + 아늑한 겉지 2중 레이어드", compTag('double', "DOUBLE LAYER"), SOLID_TEXTURES.l1, function() { window.concierge.chooseWindowComposition('double'); }, recCls('double'));
                html += renderBookmarkCard("속지 단독", "화사하고 은은한 채광의 차르르 쉬어", compTag('sheer_only', "SHEER ONLY"), SOLID_TEXTURES.l2, function() { window.concierge.chooseWindowComposition('sheer_only'); }, recCls('sheer_only'));
                html += renderBookmarkCard("겉지 단독", "아늑한 쉼과 빛 차단을 위한 드레이프", compTag('drape_only', "DRAPE ONLY"), SOLID_TEXTURES.l3, function() { window.concierge.chooseWindowComposition('drape_only'); }, recCls('drape_only'));
                html += renderBookmarkCard("블라인드", "빛의 각도를 조율하는 모던 시스템", compTag('blind_only', "BLIND SHADE"), SOLID_TEXTURES.oak, function() { window.concierge.chooseWindowComposition('blind_only'); }, recCls('blind_only'));
                html += '</div></div>';
                break;

            // [Step 3.5: 감성 앰비언트 브릿지]
            case "3.5-Bridge":
                const curItem = state.pendingItemQueue[state.currentItemIndex];
                const typeLabel = curItem.presetType === 'sheer' ? '속지' : (curItem.presetType === 'drape' ? '겉지' : '블라인드');
                html += '<div class="ambient-stage" onclick="window.concierge.proceedToFabricQueue()">';
                html += '<div class="ambient-light-glow"></div>';
                html += `<span class="q-meta">${state.editingRoom.name} · Curated Fabric</span>`;
                html += `<h2 class="q-title font-serif-kr">빛과 톤에 어울리는<br>${typeLabel} 컬렉션을 제안합니다.</h2>`;
                html += '<p class="q-sub font-serif-kr">공간의 마감재와 채광 밸런스를 고려한 맞춤 패브릭입니다.</p>';
                html += '<div class="q-hint font-serif-kr"><span>패브릭 컬렉션 확인하기</span><i class="fa-solid fa-arrow-right text-xs"></i></div>';
                html += '</div>';
                break;

            // [Step 4: 실제 FABRIC_DB 기반 원단 3종 쇼케이스]
            case "4-Fabric-Queue":
                const queueItem = state.pendingItemQueue[state.currentItemIndex] || { label: "창문", presetType: "sheer" };
                const isTargetBlind = queueItem.presetType === 'blind';
                const targetCategory = isTargetBlind ? '블라인드' : (queueItem.presetType === 'sheer' ? '속지' : '겉지');
                
                let pool = getLiveCategoryPool(targetCategory);
                // 원단마다 "공간에 가장 어울리는 색"까지 계산해 순위를 매김. 점수가 같으면 사장님이 직접 분류한 원단을 먼저
                const ranked = pool.map(f => ({ f: f, best: bestColorFor(f, state.editingRoom, targetCategory) }));
                ranked.sort((a, b) => (b.best.score - a.best.score)
                    || ((isManualTagged(b.f) ? 1 : 0) - (isManualTagged(a.f) ? 1 : 0)));
                const showcaseList = (typeof pickShowcase === 'function') ? pickShowcase(ranked, 3) : ranked.slice(0, 3);
                state.colorPick = state.colorPick || {};

                const anyColors = showcaseList.some(e => e.best.ranked.length > 1);
                html += '<div class="bookmark-stage">';
                html += stepHead('마음에 드는 원단을 눌러 주세요', anyColors ? '오른쪽에 겹친 색을 누르면 앞으로 나와요' : '');
                html += `<div class="bookmark-canvas" style="--items-count: ${Math.max(1, showcaseList.length)};">`;
                state.fabPanelCount = showcaseList.length;      // 마지막 칸에 Re.dam 표시를 넣기 위해
                showcaseList.forEach((entry, idx) => {
                    const f = entry.f, best = entry.best;
                    const order = colorDeckOrder(best);
                    const pick = state.colorPick[f.id] || order[0] || '';
                    html += `<div class="fab-panel" data-fab="${f.id}" data-idx="${idx}">${fabricCardHtml(f, best, idx, pick, queueItem, targetCategory)}</div>`;
                });
                html += '</div>';

                html += '</div></div>';
                break;

            // [Step 5: 창 크기 입력] 질문 화면과 같은 분위기: 평평한 바탕 · 큰 명조 숫자 · 가는 선 · 밑줄 글자 버튼
            case "6-Measure": {
                const curRoom = state.editingRoom;
                const hasSheer = curRoom.items.some(i => i.presetType === 'sheer');
                const hasDrape = curRoom.items.some(i => i.presetType === 'drape');
                const hasCurtain = hasSheer || hasDrape;
                const kinds = curRoom.items.map(i => i.presetType === 'blind' ? '블라인드' : (i.presetType === 'sheer' ? '속지' : (i.presetType === 'drape' ? '겉지' : '커튼'))).join(' + ');
                const measureBox = (target, label, steps) =>
                    `<div id="measureBox_${target}" class="measure-box msr-box" onclick="window.concierge.openKeypad('${target}')">` +
                    `<span class="msr-label">${label}</span>` +
                    `<div class="msr-num font-serif-kr"><span id="displayVal_${target}">${curRoom[target]}</span><small>cm</small></div>` +
                    '<span class="msr-hint">숫자를 누르면 직접 입력</span>' +
                    nudgeRowHtml(target, steps) + '</div>';
                const optBtn = (key, label, on, fn) =>
                    `<button type="button" id="chip_${key}" class="msr-opt font-serif-kr ${on ? 'active' : ''}" onclick="${fn}">${label}</button>`;

                html += '<div class="msr-stage">';
                html += `<span class="q-meta">${curRoom.name} · ${kinds}</span>`;
                html += '<h2 class="msr-title font-serif-kr">창의 크기를 적어 주세요</h2>';

                html += '<div class="msr-grid">';
                html += measureBox('width', '넓이', [-10, -1, 1, 10]);
                html += measureBox('height', '높이', [-5, -1, 1, 5]);
                html += '</div>';

                if (hasCurtain) {
                    html += '<div class="msr-opts">';
                    if (hasDrape) {
                        html += optBtn('shapeFee', '형상기억 가공', curRoom.shapeFee, 'window.concierge.toggleNudgeShapeFee()');
                        html += optBtn('hotelFit', '호텔핏', curRoom.hotelFit, 'window.concierge.toggleNudgeHotelFit()');
                    }
                    if (hasSheer) html += optBtn('leadBand', '하단 리드밴드', curRoom.leadBand, "window.concierge.fastToggleOption('leadBand')");
                    html += '</div>';
                    html += '<button class="opt-info-link" onclick="window.concierge.showOptionInfo()">옵션을 적용하면 어떻게 달라지나요?</button>';
                }

                html += `<button type="button" class="msr-add font-serif-kr" onclick="window.concierge.commitRoomCart()">${curRoom.name}에 추가</button>`;
                html += '</div>';
                break;
            }

            // [Step 7: 제안서 = 견적서. 저장·인쇄되는 견적서 이미지(app.js drawTicket)와 같은 디자인]
            // 평평한 바탕 · 가는 선 · 명조 글자 · 각진 원단 칸 · 밑줄 글자 버튼 (둥근 카드·그림자·색 버튼 없음)
            case "7-Final-Dossier": {
                const configuredList = state.roomsCart.filter(r => r.isConfigured);
                let roomsProductSum = 0;
                let roomsHtml = '';

                configuredList.forEach(r => {
                    roomsProductSum += (r.subtotal || 0);
                    roomsHtml += '<section class="dos-room">';
                    roomsHtml += `<div class="dos-rhead font-serif-kr"><span class="dos-rname">${r.name}</span><span class="dos-rsum">${(r.subtotal || 0).toLocaleString()}원</span></div>`;
                    r.curtains.forEach(c => {
                        const calcObj = c.calc || {};
                        const itemPrice = calcObj.curtainSubtotal || calcObj.sellingPrice || 0;
                        const kind = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : (c.presetType === 'drape' ? '겉지' : '커튼'));
                        const meta = [calcObj.fabBook || ''];
                        if (c.shapeFee > 0) meta.push('형상기억');
                        if (c.leadBand) meta.push('리드밴드');
                        if (c.hotelFit) meta.push('호텔핏');
                        const reason = (typeof ticketItemReason === 'function') ? ticketItemReason(r, c) : '';
                        roomsHtml += '<div class="dos-item">';
                        roomsHtml += `<div class="dos-sw" style="${fabricFillStyle(c.fabricId, c.colorName)}"></div>`;
                        roomsHtml += '<div class="dos-txt">';
                        roomsHtml += `<div class="dos-kind">${kind}</div>`;
                        roomsHtml += `<div class="dos-fab font-serif-kr">${(typeof ticketFabricName === 'function') ? ticketFabricName(c, calcObj) : (calcObj.fabName || c.label || '원단')}<em>${meta.filter(Boolean).join(' · ')}</em></div>`;
                        if (reason) roomsHtml += `<div class="dos-why">${reason}</div>`;
                        roomsHtml += '</div>';
                        roomsHtml += `<div class="dos-price font-serif-kr">${itemPrice.toLocaleString()}원</div>`;
                        roomsHtml += '</div>';
                    });
                    roomsHtml += '</section>';
                });

                const finalGrandTotal = roomsProductSum + (state.installFee || 0);
                const d = new Date(), pad2 = n => String(n).padStart(2, '0');
                const noteText = (typeof loadTicketNote === 'function') ? loadTicketNote() : '';

                html += '<div class="dos-stage"><div class="dos-sheet">';
                html += '<div class="dos-top font-serif-kr">';
                html += '<h1 onclick="window.concierge.staffTap()">Re.dam</h1>';
                html += `<span class="dos-date">${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}</span>`;
                html += '</div>';
                html += `<p class="dos-who font-serif-kr">${currentCust && currentCust !== '고객' ? `${currentCust} 고객님 맞춤 제안` : '고객님 맞춤 제안'}</p>`;

                html += roomsHtml;

                html += '<div class="dos-fee"><span>시공 및 설치비</span>';
                html += `<span><input type="number" step="5000" inputmode="numeric" value="${state.installFee}" oninput="window.concierge.updateInstallFee(this.value, ${roomsProductSum})" class="font-serif-kr">원</span></div>`;

                html += '<div class="dos-sum font-serif-kr">';
                html += '<span class="dos-sumlabel">총 제안 금액 (시공비 포함)</span>';
                html += `<span class="dos-amount"><span id="finalGrandTotalDisplay">${finalGrandTotal.toLocaleString()}</span><small>원</small></span>`;
                html += '</div>';
                html += `<p class="dos-note">${noteText ? noteText + '<br>' : ''}전문 피팅 시공 및 1년 무상 A/S</p>`;

                // 버튼: 질문 화면과 같은 밑줄 글자. 화면 아래에 붙어 있어 내용이 길어도 바로 누를 수 있음
                html += '<div class="dos-acts">';
                html += '<div class="dos-main font-serif-kr">';
                html += '<button type="button" class="dos-act is-main" onclick="window.concierge.saveQuote()">견적서 저장</button>';
                html += '<button type="button" class="dos-act" onclick="window.concierge.printQuote()">인쇄</button>';
                html += '</div>';
                html += '<div class="dos-subacts">';
                html += '<button type="button" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가하기</button>';
                // 다음 고객 상담: 확인 창을 거쳐 지금 상담을 이력에 보관하고 비움 (직원 화면의 "새 상담"과 같음)
                html += '<button type="button" onclick="if (typeof startNewConsultation === \'function\') startNewConsultation();">다음 상담 시작</button>';
                html += '</div></div>';

                html += '</div></div>';
                break;
            }
        }

        html += '</div>';
        main.innerHTML = html;
        if (state.step === "4-Fabric-Queue") bindColorDecks();     // 색상 카드 밀어 넘기기 연결
    }

    // ---- 원단 카드 안의 색상 덱 ----
    // 색상 순서: 분류돼 있으면 어울리는 색부터(랭킹 순), 아니면 번호 순
    function colorDeckOrder(best) {
        const numSort = (x, y) => (/^\d+$/.test(x.name) && /^\d+$/.test(y.name)) ? parseInt(x.name, 10) - parseInt(y.name, 10) : x.name.localeCompare(y.name, 'ko');
        const list = best.classified ? best.ranked.slice() : best.ranked.slice().sort(numSort);
        return list.map(r => r.name);
    }
    // 사진이 없을 때 톤으로 짐작한 바탕색 (뒤에 겹쳐 보이는 색 띠)
    const TONE_FILL = { warm: '#dcc3a4', cool: '#b9c4cb', neutral: '#d3cdc3', deep: '#7a695c' };
    // 고객에게 보여 줄 원단 이름: 괄호(암막률·가격 등), 가격, 앞의 책자 이름을 뺌. 색은 이름 옆에 따로 작게 (번호는 붙이지 않음)
    function fabricDisplayName(f) {
        let n = String(f.name || '');
        n = n.replace(/\([^)]*\)/g, ' ').replace(/[0-9,]+\s*원/g, ' ');
        const book = String(f.book || '').trim();
        if (book && n.trim().startsWith(book + ' ')) n = n.trim().slice(book.length);
        return n.replace(/\s+/g, ' ').trim() || String(f.name || '');
    }
    // 색 표시: 색 이름이 있으면 이름(화이트), 없으면 "3번". 색이 하나뿐이고 이름도 없으면 표시 안 함
    function colorTagOf(f, pick, n) {
        const label = (pick && typeof colorLabelOf === 'function') ? colorLabelOf(f.id, pick) : '';
        if (label) return label;
        if (!pick || n < 2) return '';
        return /^\d+$/.test(String(pick)) ? `${pick}번` : String(pick);
    }
    // 뒤에 겹쳐 보이는 색 띠 (사전 옆면처럼): 색 수에 따라 앞 색 90% → 87% → 85%(최소). 띠는 최대 3장, 뒤로 갈수록 얇게
    const DECK_EDGES = { 2: [10], 3: [8.5, 4.5], 4: [8, 4.5, 2.5] };
    // 원단 한 칸: 앞 색(사진 + 왼쪽 아래 세로 이름 + 이유·특징 + "1 / n") + 오른쪽에 겹쳐 보이는 다음 색들
    function fabricCardHtml(f, best, idx, pick, queueItem, targetCategory) {
        const order = colorDeckOrder(best), n = order.length;
        const curIdx = Math.max(0, order.indexOf(pick));
        const pickInfo = best.ranked.find(r => r.name === pick);
        const view = pickInfo ? Object.assign({}, f, { tone: pickInfo.tone || f.tone, manual: Object.assign({}, f.manual, { tone: !!pickInfo.tone || !!(f.manual && f.manual.tone) }) }) : f;
        const bgStyle = idx === 0 ? SOLID_TEXTURES.l1 : (idx === 1 ? SOLID_TEXTURES.l2 : SOLID_TEXTURES.l3);
        const reasonText = recommendReason(view, state.editingRoom, targetCategory, 1);      // 칸에서는 짧은 설명 1개만 (태그는 뺌)
        const edges = n > 1 ? DECK_EDGES[Math.min(n, 4)] : [];
        const edgeTotal = edges.reduce((a, b) => a + b, 0);
        // 품명 끝의 색 이름(예: 오솔로 화이트)은 이름에서 떼어 색 자리로 → 이름 길이가 고르게
        let name = fabricDisplayName(f), colorTag = colorTagOf(f, pick, n);
        const cw = /\s+(오프화이트|퓨어화이트|화이트|아이보리|크림|라이트베이지|베이지|샌드|오트밀|그레이지|라이트그레이|그레이|차콜|모카|토프|카멜|브라운|초콜릿|네이비|블랙)$/.exec(name);
        if (cw && name.length > cw[0].length) { name = name.slice(0, -cw[0].length); colorTag = colorTag || cw[1]; }
        // 글자 수 세기: 영어·숫자는 눕혀 쓰므로 0.6자(대문자 0.78자)로 셈
        const vlen = s => Array.from(String(s)).reduce((a, ch) => a + (/[A-Z]/.test(ch) ? 0.78 : (/[a-z0-9 .\/%&-]/.test(ch) ? 0.6 : 1)), 0) || 1;   // 영어 대문자는 조금 더 넓게
        const isLast = idx === (state.fabPanelCount || 1) - 1;
        let h = `<div class="bookmark-card color-top" data-fab="${f.id}" style="right: ${edgeTotal}%;" onclick="window.concierge.handleQueueFabricClick('${f.id}')">`;
        h += `<div class="bookmark-bg" style="background: ${bgStyle};"></div>`;
        h += `<img class="fabric-photo" alt="" data-id="${f.id}" data-color="${pick}" data-i="0" src="${fabricPhotoUrls(f.id, pick)[0]}" onerror="window.concierge.imgFallback(this)">`;
        h += '<div class="bookmark-gradient fab-gradient"></div>';
        // 아래 띠 (ㄴ자): 왼쪽에 세로 이름(아래 정렬), 그 오른쪽 아래에 가로로 색 이름·짧은 설명. 오른쪽 끝 아래에 1/n
        h += `<div class="fab-band${isLast ? ' is-last' : ''}">`;
        const latin = /[A-Za-z]/.test(name);
        const stack = s => Array.from(String(s)).map(ch => ch === ' ' ? '<i class="vsp"></i>' : `<span>${ch}</span>`).join('');
        h += latin ? `<h3 class="fab-vname is-latin font-serif-kr" style="--len: ${vlen(name).toFixed(2)};">${name}</h3>`
                   : `<h3 class="fab-vname vstack font-serif-kr" style="--len: ${vlen(name).toFixed(2)};">${stack(name)}</h3>`;
        if (colorTag || reasonText) {
            h += '<div class="fab-side">';
            if (colorTag) h += `<span class="fab-hlabel">${colorTag}</span>`;
            if (reasonText) h += `<p class="fab-hreason">${reasonText}</p>`;
            h += '</div>';
        }
        if (n > 1) h += `<span class="deck-count2" aria-label="${n}개 색 중 ${curIdx + 1}번째"><b>${curIdx + 1}</b><i></i><em>${n}</em></span>`;
        h += '</div>';
        // 마지막 칸에만 Re.dam 표시 (오른쪽 아래, 뒤 색 띠와 겹치지 않게 앞장 안에). 5번 누르면 직원 화면
        if (isLast) h += '<div class="card-brand" onclick="event.stopPropagation(); window.concierge.staffTap()">Re.dam</div>';
        h += '</div>';
        if (n > 1) {
            // 뒤 색 띠: 누르면 그 색이 앞으로 나옴 (앞 색을 한 번 더 누르면 선택)
            h += `<div class="deck-edges" style="width: ${edgeTotal}%;">`;
            edges.forEach((w, k) => {
                const nx = order[(curIdx + k + 1) % n], ni = best.ranked.find(r => r.name === nx) || {};
                h += `<button type="button" class="deck-edge" aria-label="다른 색 보기" style="width: ${(w / edgeTotal * 100).toFixed(2)}%; z-index: ${10 - k}; background-color: ${TONE_FILL[ni.tone] || '#d9cdbb'}; background-image: url('${fabricPhotoUrls(f.id, nx)[0]}');" onclick="event.stopPropagation(); window.concierge.showColor('${f.id}', '${String(nx).replace(/'/g, "\\'")}')"></button>`;
            });
            h += '</div>';
        }
        return h;
    }
    // (예전 "옆으로 밀기"는 뺐음: 누르기와 섞이면 잘못 선택되는 일이 생겨, 뒤 색 띠를 누르는 방식으로 바꿈)
    function bindFabricPanel(panel) {}
    function bindColorDecks() {
        document.querySelectorAll('.fab-panel').forEach(bindFabricPanel);
    }
    // 한 칸만 새 색으로 바꿈 (화면 전체를 다시 그리지 않아 깜빡이지 않음). 새 사진을 먼저 받아 두고 0.22초 겹쳐 바꿈
    function swapFabricPanel(panel, html, photoUrl) {
        const ready = new Promise(res => {
            const im = new Image(); let done = false;
            const fin = () => { if (!done) { done = true; res(); } };
            im.onload = fin; im.onerror = fin; setTimeout(fin, 700);
            im.src = photoUrl;
        });
        ready.then(() => {
            const olds = Array.from(panel.children);
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            Array.from(tmp.children).forEach(el => panel.insertBefore(el, panel.firstChild));
            olds.forEach(el => { el.classList.add('is-leaving'); el.style.pointerEvents = 'none'; });
            requestAnimationFrame(() => olds.forEach(el => { el.style.opacity = '0'; }));
            setTimeout(() => olds.forEach(el => el.remove()), 260);
            bindFabricPanel(panel);
        });
    }

    function renderBookmarkCard(title, desc, tag, bgStyle, onClickFn, extraClass) {
        const id = "bk_" + Math.random().toString(36).substr(2, 9);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.onclick = onClickFn;
        }, 0);

        // 원단 칸과 같은 ㄴ자 배치: 왼쪽 아래 세로 제목(아래 정렬) + 그 오른쪽 아래 가로 설명 (extraClass에 'vdesc'가 있으면 설명도 제목 옆에 작게 세로로)
        const vdesc = /\bvdesc\b/.test(extraClass || '');
        const vlen = s => Array.from(String(s)).reduce((a, ch) => a + (/[A-Z]/.test(ch) ? 0.78 : (/[a-z0-9 .\/%&,+-]/.test(ch) ? 0.6 : 1)), 0) || 1;
        const latin = /[A-Za-z]/.test(title);
        const stack = s => Array.from(String(s)).map(ch => ch === ' ' ? '<i class="vsp"></i>' : `<span>${ch}</span>`).join('');
        const nameHtml = latin ? `<h3 class="fab-vname is-latin font-serif-kr" style="--len: ${vlen(title).toFixed(2)};">${title}</h3>`
                               : `<h3 class="fab-vname vstack font-serif-kr" style="--len: ${vlen(title).toFixed(2)};">${stack(title)}</h3>`;
        return `<div id="${id}" class="bookmark-card lcard${extraClass ? ' ' + extraClass : ''}" style="width: 100%; height: 100%; cursor: pointer;">` +
            `<div class="bookmark-bg" style="background: ${bgStyle}; pointer-events: none;"></div>` +
            '<div class="bookmark-gradient fab-gradient" style="pointer-events: none;"></div>' +
            '<div class="fab-band">' + nameHtml +
            (desc ? (vdesc ? `<p class="fab-vdesc vstack">${stack(desc)}</p>` : `<div class="fab-side"><p class="fab-hreason">${desc}</p></div>`) : '') +
            '</div></div>';
    }

    window.concierge = {
        start: function() {
            goToStep("1-Space", false);
        },
        prevStep: function() {
            prevStep();
        },
        goToSpaceCanvas: function() {
            goToStep("1-Space");
        },
        startNewRoomSelection: function() {
            goToStep("1.5-Room-Type");
        },
        chooseRoomType: function(selectedName) {
            const sameTypeCount = state.roomsCart.filter(r => r.name.startsWith(selectedName)).length;
            const displayName = sameTypeCount === 0 ? selectedName : `${selectedName} ${sameTypeCount + 1}`;
            
            const newRoom = {
                id: Date.now(),
                name: displayName,
                roomType: selectedName,
                floorTone: "warm",
                wallTone: "cool",
                lightLevel: "mid",
                mood: "soft_warm",
                isConfigured: false,
                curtains: [],
                subtotal: 0
            };
            state.roomsCart.push(newRoom);
            window.concierge.openRoomCart(newRoom.id);
        },
        openRoomCart: function(roomId) {
            state.editingRoomId = roomId;
            const target = state.roomsCart.find(r => r.id === roomId);
            state.editingRoom = {
                id: target.id,
                name: target.name,
                floorTone: target.floorTone || 'warm',
                wallTone: target.wallTone || 'cool',
                lightLevel: target.lightLevel || 'mid',
                mood: target.mood || 'soft_warm',
                wantMood: target.wantMood || null,
                roomType: target.roomType || roomTypeOf(target),
                lightBlock: target.lightBlock || null, privacy: target.privacy || null, sheerFeel: target.sheerFeel || null,
                width: 340,
                height: 235,
                shapeFee: true,
                hotelFit: true,
                leadBand: true,
                items: []
            };
            if (target.isConfigured && target.curtains && target.curtains.length > 0) {
                const first = target.curtains[0];
                state.editingRoom.width = Number(first.width) || 340;
                state.editingRoom.height = Number(first.height) || 235;
                state.editingRoom.shapeFee = target.curtains.some(c => c.shapeFee > 0);
                state.editingRoom.hotelFit = target.curtains.some(c => c.hotelFit);
                state.editingRoom.leadBand = target.curtains.some(c => c.leadBand);
            }
            // 새 공간이고, 앞에서 진단을 마친 공간이 있으면 "같은 바닥·벽" 바로가기부터
            goToStep((!target.isConfigured && copySourceRoom()) ? "2-Base-Copy" : "2-Base-Floor");
        },
        copyBaseFromPrev: function(same) {
            const src = copySourceRoom();
            if (same && src) {
                state.editingRoom.floorTone = src.floorTone;
                state.editingRoom.wallTone = src.wallTone;
                goToStep("2-Base-Light");
            } else {
                goToStep("2-Base-Floor");
            }
        },
        showOptionInfo: function() {
            const room = state.editingRoom;
            if (!room) return;
            const keys = [];
            if (room.items.some(i => i.presetType === 'drape')) keys.push('shapeFee', 'hotelFit');
            if (room.items.some(i => i.presetType === 'sheer')) keys.push('leadBand');
            if (!keys.length) return;
            let ov = document.getElementById('optInfoOverlay');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'optInfoOverlay';
                ov.className = 'opt-info-overlay';
                ov.onclick = () => window.concierge.closeOptionInfo();
                document.body.appendChild(ov);
            }
            ov.innerHTML = optionInfoHtml(keys);
            ov.style.display = 'flex';
        },
        closeOptionInfo: function() {
            const ov = document.getElementById('optInfoOverlay');
            if (ov) ov.style.display = 'none';
        },
        selectFloorTone: function(tone) {
            state.editingRoom.floorTone = tone;
            goToStep("2-Base-Wall");
        },
        selectWallTone: function(tone) {
            state.editingRoom.wallTone = tone;
            goToStep("2-Base-Light");
        },
        selectLightLevel: function(level) {
            state.editingRoom.lightLevel = level;
            goToStep("2-Base-Block");          // 모든 공간: 빛 가림 → 바깥 시선 → 구성
        },
        selectLightBlock: function(level) {
            state.editingRoom.lightBlock = level;
            goToStep("2-Base-Privacy");
        },
        selectPrivacy: function(level) {
            state.editingRoom.privacy = level;
            goToStep("3-Config-Style");        // 빛 가림·바깥 시선을 근거로 구성 추천
        },
        selectSheerFeel: function(feel) {
            state.editingRoom.sheerFeel = feel;
            goToStep("3.5-Bridge");
        },
        selectMood: function(mood) {
            state.editingRoom.wantMood = mood;
            // 속지가 들어가는 구성이면 속지 느낌을 한 번 더 (공간마다 한 번)
            const hasSheer = (state.editingRoom.items || []).some(i => i.presetType === 'sheer');
            goToStep(hasSheer && !state.editingRoom.sheerFeel ? "2-Base-SheerFeel" : "3.5-Bridge");
        },
        chooseWindowComposition: function(type) {
            const rName = state.editingRoom.name;
            if (type === 'double') {
                state.editingRoom.items = [
                    { label: `${rName} 속지`, presetType: "sheer", fabricId: null, floorGap: 0 },
                    { label: `${rName} 겉지`, presetType: "drape", fabricId: null, floorGap: 0 }
                ];
            } else if (type === 'sheer_only') {
                state.editingRoom.items = [
                    { label: `${rName} 속지`, presetType: "sheer", fabricId: null, floorGap: 0 }
                ];
            } else if (type === 'drape_only') {
                state.editingRoom.items = [
                    { label: `${rName} 겉지`, presetType: "drape", fabricId: null, floorGap: 0 }
                ];
            } else if (type === 'blind_only') {
                state.editingRoom.items = [
                    { label: `${rName} 블라인드`, presetType: "blind", fabricId: null, floorGap: 0 }
                ];
            }
            state.pendingItemQueue = state.editingRoom.items;
            state.currentItemIndex = 0;
            goToStep("2-Base-Mood");           // 구성 다음은 취향(분위기)
        },
        proceedToFabricQueue: function() {
            goToStep("4-Fabric-Queue");
        },
        // 색상 카드 넘기기: dir 1 = 다음 색, -1 = 이전 색 (끝에서 한 바퀴 돌아 처음으로)
        stepColor: function(fabId, dir) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            const best = bestColorFor(fabric, state.editingRoom, cat);
            const order = colorDeckOrder(best);
            if (order.length < 2) return;
            state.colorPick = state.colorPick || {};
            const cur = Math.max(0, order.indexOf(state.colorPick[fabId] || order[0]));
            const next = order[(cur + dir + order.length) % order.length];
            state.colorPick[fabId] = next;
            const panel = Array.from(document.querySelectorAll('.fab-panel')).find(p => p.getAttribute('data-fab') === fabId);
            if (!panel) { render(); return; }
            const idx = parseInt(panel.getAttribute('data-idx') || '0', 10);
            swapFabricPanel(panel, fabricCardHtml(fabric, best, idx, next, item, cat), fabricPhotoUrls(fabric.id, next)[0]);
        },
        // 뒤 색 띠를 눌렀을 때: 그 색을 앞으로
        showColor: function(fabId, colorName) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            const best = bestColorFor(fabric, state.editingRoom, cat);
            const order = colorDeckOrder(best);
            if (!order.includes(colorName)) return;
            state.colorPick = state.colorPick || {};
            state.colorPick[fabId] = colorName;
            const panel = Array.from(document.querySelectorAll('.fab-panel')).find(p => p.getAttribute('data-fab') === fabId);
            if (!panel) { render(); return; }
            const idx = parseInt(panel.getAttribute('data-idx') || '0', 10);
            swapFabricPanel(panel, fabricCardHtml(fabric, best, idx, colorName, item, cat), fabricPhotoUrls(fabric.id, colorName)[0]);
        },
        handleQueueFabricClick: function(fabId) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            if (Date.now() - (state.swipedAt || 0) < 450) return;      // 카드를 밀고 난 직후의 클릭은 무시
            const best = bestColorFor(fabric, state.editingRoom, cat);
            state.colorPick = state.colorPick || {};
            const order = colorDeckOrder(best);
            const chosen = state.colorPick[fabId] || order[0] || '';
            item.fabricId = fabId;
            item.colorName = chosen;
            state.colorPick = {};

            if (state.currentItemIndex + 1 < state.pendingItemQueue.length) {
                state.currentItemIndex++;
                goToStep("3.5-Bridge", false);
            } else {
                goToStep("6-Measure");
            }
        },
        toggleNudgeShapeFee: function() {
            state.editingRoom.shapeFee = !state.editingRoom.shapeFee;
            const chip = document.getElementById("chip_shapeFee");
            if (chip) chip.classList.toggle("active", state.editingRoom.shapeFee);
        },
        toggleNudgeHotelFit: function() {
            state.editingRoom.hotelFit = !state.editingRoom.hotelFit;
            const chip = document.getElementById("chip_hotelFit");
            if (chip) chip.classList.toggle("active", state.editingRoom.hotelFit);
        },
        fastToggleOption: function(optKey) {
            state.editingRoom[optKey] = !state.editingRoom[optKey];
            const chip = document.getElementById(`chip_${optKey}`);
            if (chip) chip.classList.toggle("active", state.editingRoom[optKey]);
        },
        commitRoomCart: function() {
            const roomTarget = state.roomsCart.find(r => r.id === state.editingRoomId);
            if (roomTarget) {
                let roomSubSum = 0;
                const finalizedCurtains = state.editingRoom.items.map((item, idx) => {
                    const isBlind = item.presetType === 'blind';
                    const cObj = {
                        id: (roomTarget.id * 100) + (idx + 1),
                        label: item.label,
                        presetType: isBlind ? 'blind' : item.presetType,
                        width: Number(state.editingRoom.width),
                        height: Number(state.editingRoom.height),
                        pleat: isBlind ? '1.0' : (item.presetType === 'panel' ? 'panel' : '2.0'),
                        pleatType: isBlind ? '민자' : (item.presetType === 'panel' ? '패널' : '나비주름'),
                        bookFilter: "ALL",
                        fabricId: item.fabricId,
                        colorName: item.colorName || '',
                        installType: isBlind ? 'none' : (item.presetType === 'panel' ? 'rail_2line' : 'rail'),
                        floorGap: item.floorGap || 0,
                        hwName: isBlind ? '블라인드 일체형' : (item.presetType === 'panel' ? '2줄 패널 레일' : '기본 레일'),
                        hwPrice: isBlind ? 0 : 1000,
                        shapeFee: isBlind ? 0 : ((item.presetType === 'drape' && state.editingRoom.shapeFee) ? 3000 : 0),
                        leadBand: isBlind ? false : Boolean(item.presetType === 'sheer' && state.editingRoom.leadBand),
                        hotelFit: isBlind ? false : Boolean(item.presetType === 'drape' && state.editingRoom.hotelFit)
                    };
                    
                    cObj.calc = calculateV1ItemPrice(cObj);
                    roomSubSum += (cObj.calc.curtainSubtotal || cObj.calc.sellingPrice || 0);
                    return cObj;
                });

                roomTarget.isConfigured = true;
                roomTarget.floorTone = state.editingRoom.floorTone;
                roomTarget.wallTone = state.editingRoom.wallTone;
                roomTarget.lightLevel = state.editingRoom.lightLevel;
                roomTarget.mood = state.editingRoom.mood;
                roomTarget.wantMood = state.editingRoom.wantMood || null;
                roomTarget.lightBlock = state.editingRoom.lightBlock || null;
                roomTarget.privacy = state.editingRoom.privacy || null;
                roomTarget.sheerFeel = state.editingRoom.sheerFeel || null;
                roomTarget.roomType = state.editingRoom.roomType || roomTarget.roomType || null;
                roomTarget.diagnosed = true;          // 바닥·벽·채광 진단을 거침 → 제안서에 진단 요약·추천 이유 표시
                roomTarget.curtains = finalizedCurtains;
                roomTarget.subtotal = roomSubSum;

                syncToV1MasterRooms();
            }
            goToStep("1-Space");
        },
        goToCheckout: function() {
            syncToV1MasterRooms();
            goToStep("7-Final-Dossier");
        },
        // 원단 사진 불러오기 실패 시 다음 확장자(.jpg → .webp → .png)를 시도하고, 모두 없으면 사진 칸을 없앰
        imgFallback: function(el) {
            const i = parseInt(el.getAttribute('data-i') || '0', 10) + 1;
            const urls = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(el.getAttribute('data-id'), el.getAttribute('data-color') || '') : [];
            if (i < urls.length) { el.setAttribute('data-i', i); el.src = urls[i]; } else { el.remove(); }
        },
        staffTap: function() {
            if (window.RedamAuth) window.RedamAuth.tap();
        },
        setClientName: function(v) {
            const el = document.getElementById('custName');
            if (el) el.value = v;
        },
        // 연락처: 입력하는 대로 010-1234-5678 모양으로 맞춰 저장
        setClientPhone: function(input) {
            const v = (typeof formatPhone === 'function') ? formatPhone(input.value) : input.value;
            input.value = v;
            const el = document.getElementById('custPhone');
            if (el) el.value = v;
        },
        deleteRoom: function(roomId) {
            const room = state.roomsCart.find(r => r.id === roomId);
            if (!room) return;
            if (!confirm(`'${room.name}' 공간을 삭제할까요?`)) return;
            state.roomsCart = state.roomsCart.filter(r => r.id !== roomId);
            syncToV1MasterRooms();
            render();
        },
        // 직원 화면(B)에서 바꾼 공간·품목·시공비를 고객 화면에 반영 (B가 기준)
        loadFromMaster: function(masterRooms, installFee) {
            const inProgress = state.roomsCart.filter(r => !r.isConfigured);
            const mapped = masterRooms.map((r, i) => {
                const sub = r.curtains.reduce((acc, c) => acc + ((c.calc && c.calc.curtainSubtotal) || 0), 0);
                return {
                    id: Date.now() + i, name: r.name,
                    floorTone: r.floorTone || 'warm', wallTone: r.wallTone || 'cool',
                    lightLevel: r.lightLevel || 'mid', mood: r.mood || 'soft_warm', wantMood: r.wantMood || null,
                    roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, diagnosed: !!r.diagnosed,
                    isConfigured: true,
                    curtains: r.curtains.map(c => ({ ...c })),
                    subtotal: sub
                };
            });
            state.roomsCart = mapped.concat(inProgress);
            state.installFee = installFee;
            if (state.step === "7-Final-Dossier" && mapped.length === 0) goToStep("1-Space", false);
            else if (state.step === "1-Space" || state.step === "7-Final-Dossier") render();
        },
        // 직원 화면(B)에서 만든 견적을 고객용 제안서 화면으로 보여주기
        showProposalFromRooms: function(masterRooms, installFee) {
            window.concierge.loadFromMaster(masterRooms, installFee);
            stepHistory.length = 0;
            goToStep(state.roomsCart.some(r => r.isConfigured) ? "7-Final-Dossier" : "1-Space", false);
        },
        // 새 상담 시작: 고객 입력 내용을 모두 비움
        resetAll: function() {
            state.roomsCart = [];
            state.editingRoomId = null;
            state.editingRoom = null;
            state.pendingItemQueue = [];
            state.currentItemIndex = 0;
            state.installFee = 30000;
            state.focusedFabricId = null;
            state.keypadTarget = null;
            stepHistory.length = 0;
            const el = document.getElementById('custName');
            if (el) el.value = '';
            const ph = document.getElementById('custPhone');
            if (ph) ph.value = '';
            goToStep("1-Space", false);
        },
        syncToMaster: function() { syncToV1MasterRooms(); },
        // 자동 저장용: 고객이 완료한 공간만 (계산 결과는 제외)
        getRoomsForSave: function() {
            return state.roomsCart.filter(r => r.isConfigured).map(r => ({
                name: r.name, floorTone: r.floorTone, wallTone: r.wallTone, lightLevel: r.lightLevel, mood: r.mood, wantMood: r.wantMood || null,
                roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, diagnosed: !!r.diagnosed,
                curtains: r.curtains
            }));
        },
        // 제안서 화면의 "견적서 저장" / "인쇄": 화면과 같은 디자인의 이미지를 만듦 (app.js)
        saveQuote: function() {
            syncToV1MasterRooms();
            if (typeof window.saveTicketImage === 'function') window.saveTicketImage();
        },
        printQuote: function() {
            syncToV1MasterRooms();
            if (typeof window.printTicket === 'function') window.printTicket();
        },
        // 치수 조금씩 바꾸기 (+1, −5 등). 키패드가 열려 있으면 그 숫자도 함께 바뀜
        nudge: function(target, delta) {
            if (!state.editingRoom) return;
            const v = Math.min(99999, Math.max(1, (parseInt(state.editingRoom[target], 10) || 0) + delta));
            state.editingRoom[target] = v;
            const boxVal = document.getElementById(`displayVal_${target}`);
            if (boxVal) boxVal.textContent = v;
            if (state.keypadTarget === target) document.getElementById("v2KeypadValueDisplay").textContent = v;
        },
        openKeypad: function(target) {
            state.keypadTarget = target;
            document.querySelectorAll('.measure-box').forEach(el => el.classList.remove('is-active'));
            const targetBox = document.getElementById(`measureBox_${target}`);
            if (targetBox) targetBox.classList.add('is-active');

            document.getElementById("v2KeypadTargetLabel").textContent = target === "width" ? "넓이" : "높이";
            document.getElementById("v2KeypadValueDisplay").textContent = state.editingRoom[target];
            document.getElementById("v2VirtualKeypadSheet").classList.add("active");
            positionKeypad(target);
        },
        closeKeypad: function() {
            hideKeypadDirectly();
        },
        pressKey: function(k) {
            if (!state.keypadTarget || !state.editingRoom) return;
            let val = String(state.editingRoom[state.keypadTarget] || "0");
            if (k === "C") val = "0";
            else if (k === "DEL") val = val.length > 1 ? val.slice(0, -1) : "0";
            else val = val === "0" ? k : (val + k).slice(0, 5);
            
            state.editingRoom[state.keypadTarget] = parseInt(val, 10);
            document.getElementById("v2KeypadValueDisplay").textContent = state.editingRoom[state.keypadTarget];
            
            const boxVal = document.getElementById(`displayVal_${state.keypadTarget}`);
            if (boxVal) boxVal.textContent = state.editingRoom[state.keypadTarget];
        },
        updateInstallFee: function(val, roomsProductSum) {
            state.installFee = parseFloat(val) || 0;
            const finalTotal = roomsProductSum + state.installFee;
            const display = document.getElementById("finalGrandTotalDisplay");
            if (display) {
                display.textContent = finalTotal.toLocaleString();
            }
            syncToV1MasterRooms();
        }
    };
})();
