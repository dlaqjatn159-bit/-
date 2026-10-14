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

    // 속지 느낌 카드 배경: 그 느낌의 대표 원단 사진(1번 색)을 그라데이션 위에 깔고, 사진이 없으면 그라데이션만 보임
    function sheerFeelBg(fabricId, fallback) {
        const url = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabricId, '1')[0] : '';
        return url ? `url('${url}') center / cover no-repeat, ${fallback}` : fallback;
    }

    // 바닥·벽 카드의 큰 글씨(색 이름). "같은 바닥·벽인가요?" 설명도 손님이 카드에서 본 이 이름으로 씀
    const FLOOR_NAMES = { warm: "오크·베이지", cool: "화이트·그레이", neutral: "그레이지·회색", deep: "월넛·브라운" };
    const WALL_NAMES = { warm: "크림·아이보리", cool: "화이트·그레이", neutral: "그레이지", deep: "체리·우드" };

    const state = {
        step: "0-Start",
        roomsCart: [],
        editingRoomId: null,
        editingRoom: null,
        pendingItemQueue: [],
        currentItemIndex: 0,
        installFee: loadDefaultInstallFee(),
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
        // 홈 버튼: 공간 화면·최종 제안에서만 보임. 뒤로가기가 없으면 그 자리로 당김
        const home = document.getElementById("v2HomeBtn");
        if (home) {
            const show = state.step === "1-Space" || state.step === "7-Final-Dossier";
            home.style.opacity = show ? "1" : "0";
            home.style.pointerEvents = show ? "auto" : "none";
            home.style.left = canGoBack ? "calc(2rem + 46px + 0.6rem)" : "2rem";
        }
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
            h += `<button type="button" class="ask-opt${op.rec ? ' is-rec' : ''}${op.was ? ' was-picked' : ''}" onclick="${op.on}"><span class="ask-label font-serif-kr">${op.label}</span>${op.desc ? `<span class="ask-desc">${op.desc}</span>` : ''}</button>`;
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
        // 공간이 하나도 없으면(모두 삭제 등) 첫 화면으로, 구성을 마친 공간이 없으면 최종 제안 대신 공간 화면으로
        if (state.step === "7-Final-Dossier" && !state.roomsCart.some(r => r.isConfigured)) state.step = "1-Space";
        if (state.step === "1-Space" && state.roomsCart.length === 0) {
            state.step = "0-Welcome";
            stepHistory.length = 0;
            updatePrevButtonVisibility();
        }

        const currentCust = getClientName();
        // "수정"으로 들어온 공간: 지난번에 고른 답을 색 빠진 회색으로 표시 (새 공간에는 표시 없음. 주황·빛 테두리는 "추천" 전용). 누를 수는 있음
        const prevAns = (state.editingRoom && state.editingRoom.prev) || null;
        const was = (key, val) => (prevAns && prevAns[key] === val) ? ' was-picked' : '';
        let html = '<div class="w-full h-full flex flex-col items-center justify-center stage-transition" style="min-height: 100vh; width: 100vw; background: #fbf9f5;">';

        switch (state.step) {
            // [시작 화면] 앱을 열거나 새 상담일 때. 버튼 하나만 있고, 누르면 로고 모션 → 첫 화면
            case "0-Start":
                html += '<div class="ambient-stage ask-stage wel-stage">';
                html += '<button type="button" class="txt-cta font-serif-kr" onclick="window.concierge.openWelcome()">시작하기</button>';
                html += '</div>';
                break;

            // [Step 0: 첫 화면] 고객명·연락처만 받음. 공간이 없으면 "상담 시작"이 바로 공간 종류 질문으로 넘어감
            case "0-Welcome": {
                const esc = v => String(v || '').replace(/"/g, '&quot;');
                html += '<div class="ambient-stage ask-stage wel-stage">';
                html += '<h1 class="wel-brand font-serif-kr" onclick="window.concierge.staffTap()">Re<i class="logo-dot">.</i>dam</h1>';
                html += '<p class="wel-sub font-serif-kr">빛을,<br>다시 담습니다</p>';
                html += `<input type="text" id="cName_ui" class="wel-input font-serif-kr" value="${esc((document.getElementById('custName') || {}).value)}" placeholder="고객명 / 현장명 (선택)" oninput="window.concierge.setClientName(this.value)">`;
                html += `<input type="tel" id="cPhone_ui" class="wel-input font-serif-kr" inputmode="numeric" autocomplete="off" value="${esc((document.getElementById('custPhone') || {}).value)}" placeholder="연락처 (선택)" oninput="window.concierge.setClientPhone(this)">`;
                html += `<button type="button" class="txt-cta wel-go font-serif-kr" onclick="window.concierge.beginConsult()">${state.roomsCart.length ? '상담 이어가기' : '상담 시작'}</button>`;
                html += '</div>';
                break;
            }


            // [Step 1.5: 7종 공간 선택]
            case "1.5-Room-Type":
                html += askStage('어느 공간의 창인가요?', '', [
                    { label: '거실', desc: '빛과 쉼의 중심', on: "window.concierge.chooseRoomType('거실')" },
                    { label: '방', desc: '편안한 잠과 쉼', on: "window.concierge.chooseRoomType('방')" },
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
                const srcDesc = src ? [FLOOR_NAMES[src.floorTone] && `바닥 ${FLOOR_NAMES[src.floorTone]}`, WALL_NAMES[src.wallTone] && `벽 ${WALL_NAMES[src.wallTone]}`].filter(Boolean).join(' / ') : '';
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
                html += renderBookmarkCard(FLOOR_NAMES.warm, "밝은 원목", "", SOLID_TEXTURES.oak, function() { window.concierge.selectFloorTone('warm'); }, 'vdesc' + was('floorTone', 'warm'));
                html += renderBookmarkCard(FLOOR_NAMES.cool, "밝은 타일·대리석", "", SOLID_TEXTURES.tile, function() { window.concierge.selectFloorTone('cool'); }, 'vdesc' + was('floorTone', 'cool'));
                html += renderBookmarkCard(FLOOR_NAMES.neutral, "회색 마루·타일", "", SOLID_TEXTURES.neutral, function() { window.concierge.selectFloorTone('neutral'); }, 'vdesc' + was('floorTone', 'neutral'));
                html += renderBookmarkCard(FLOOR_NAMES.deep, "진한 원목 마루", "", SOLID_TEXTURES.walnut, function() { window.concierge.selectFloorTone('deep'); }, 'vdesc' + was('floorTone', 'deep'));
                html += '</div></div>';
                break;

            // [Step 2-2: 벽지 진단]
            case "2-Base-Wall":
                html += '<div class="bookmark-stage">';
                html += stepHead('벽 톤도 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard(WALL_NAMES.warm, "따뜻한 흰 벽지", "", SOLID_TEXTURES.cream, function() { window.concierge.selectWallTone('warm'); }, 'vdesc' + was('wallTone', 'warm'));
                html += renderBookmarkCard(WALL_NAMES.cool, "맑은 흰 벽지", "", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectWallTone('cool'); }, 'vdesc' + was('wallTone', 'cool'));
                html += renderBookmarkCard(WALL_NAMES.neutral, "회색 벽지", "", SOLID_TEXTURES.greige, function() { window.concierge.selectWallTone('neutral'); }, 'vdesc' + was('wallTone', 'neutral'));
                html += renderBookmarkCard(WALL_NAMES.deep, "진한 나무 벽", "", SOLID_TEXTURES.walnut, function() { window.concierge.selectWallTone('deep'); }, 'vdesc' + was('wallTone', 'deep'));
                html += '</div></div>';
                break;

            // [Step 2-3: 일조량 진단]
            case "2-Base-Light":
                html += askStage('창으로 햇빛은 얼마나 들어오나요?', '', [
                    { label: '풍부해요', desc: '남향·고층, 눈부신 직사광', on: "window.concierge.selectLightLevel('high')", was: was('lightLevel', 'high') },
                    { label: '은은해요', desc: '동향·서향, 부드러운 햇살', on: "window.concierge.selectLightLevel('mid')", was: was('lightLevel', 'mid') },
                    { label: '차분해요', desc: '북향·저층, 낮은 채광', on: "window.concierge.selectLightLevel('low')", was: was('lightLevel', 'low') }
                ]);
                break;

            // [빛 가림: 모든 공간에서 (구성 추천과 겉지 암막·블라인드 추천에 사용)]
            case "2-Base-Block":
                html += askStage('빛을 얼마나 가리고 싶으세요?', '', [
                    { label: '들어와도 괜찮아요', desc: '햇살이 은은하게 스미도록', on: "window.concierge.selectLightBlock('light')", was: was('lightBlock', 'light') },
                    { label: '적당히 가려 주세요', desc: '눈부심만 줄이고 아늑하게', on: "window.concierge.selectLightBlock('soft')", was: was('lightBlock', 'soft') },
                    { label: '완전히 어둡게', desc: '빛을 거의 막는 암막', on: "window.concierge.selectLightBlock('dark')", was: was('lightBlock', 'dark') }
                ]);
                break;

            // [바깥 시선: 모든 공간에서 (구성 추천과 속지 비침 추천에 사용)]
            case "2-Base-Privacy":
                html += askStage('밖에서 안이 보이는 게 신경 쓰이세요?', '', [
                    { label: '괜찮아요', desc: '높은 층이거나 앞이 트여 있어요', on: "window.concierge.selectPrivacy('open')", was: was('privacy', 'open') },
                    { label: '조금 신경 쓰여요', desc: '낮에 적당히 가려지면 좋겠어요', on: "window.concierge.selectPrivacy('some')", was: was('privacy', 'some') },
                    { label: '많이 신경 쓰여요', desc: '저층이거나 앞 건물이 가까워요', on: "window.concierge.selectPrivacy('high')", was: was('privacy', 'high') }
                ]);
                break;

            // [속지 질감 취향: 속지가 들어가는 구성에서 한 번]
            case "2-Base-SheerFeel":
                html += '<div class="bookmark-stage">';
                html += stepHead('속지는 어떤 느낌이 좋으세요?');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("매끈한", "쉬폰처럼", "", sheerFeelBg('데미안_쉬폰', SOLID_TEXTURES.coolWhite), function() { window.concierge.selectSheerFeel('smooth'); }, 'vdesc' + was('sheerFeel', 'smooth'));
                html += renderBookmarkCard("결 있는", "린넨처럼", "", sheerFeelBg('데미안_오솔로', SOLID_TEXTURES.oak), function() { window.concierge.selectSheerFeel('textured'); }, 'vdesc' + was('sheerFeel', 'textured'));
                html += renderBookmarkCard("도톰한", "보송하게", "", sheerFeelBg('데미안_부클', SOLID_TEXTURES.l1), function() { window.concierge.selectSheerFeel('cozy'); }, 'vdesc' + was('sheerFeel', 'cozy'));
                html += renderBookmarkCard("추천대로", "", "", SOLID_TEXTURES.l2, function() { window.concierge.selectSheerFeel('any'); }, 'vdesc' + was('sheerFeel', 'any'));
                html += '</div></div>';
                break;

            // [Step 2-4: 희망 분위기 선택]
            case "2-Base-Mood":
                html += '<div class="bookmark-stage">';
                html += stepHead('원하시는 분위기를 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 6;">';
                html += renderBookmarkCard("포근한", "아이보리·베이지", "", SOLID_TEXTURES.l1, function() { window.concierge.selectMood('soft_warm'); }, 'vdesc' + was('wantMood', 'soft_warm'));
                html += renderBookmarkCard("깔끔한", "화이트·그레이", "", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectMood('urban_clean'); }, 'vdesc' + was('wantMood', 'urban_clean'));
                html += renderBookmarkCard("은은한", "그레이지", "", SOLID_TEXTURES.greige, function() { window.concierge.selectMood('balanced_neutral'); }, 'vdesc' + was('wantMood', 'balanced_neutral'));
                html += renderBookmarkCard("자연스러운", "린넨의 결", "", SOLID_TEXTURES.oak, function() { window.concierge.selectMood('textured_linen'); }, 'vdesc' + was('wantMood', 'textured_linen'));
                html += renderBookmarkCard("아늑한", "차콜·브라운", "", SOLID_TEXTURES.l4, function() { window.concierge.selectMood('deep_private'); }, 'vdesc' + was('wantMood', 'deep_private'));
                html += renderBookmarkCard("화사한", "밝고 가벼운", "", SOLID_TEXTURES.cream, function() { window.concierge.selectMood('airy_bright'); }, 'vdesc' + was('wantMood', 'airy_bright'));
                html += '</div></div>';
                break;

            // [Step 3: 창호 구성 방식 선택]
            case "3-Config-Style":
                // 공간 종류(방은 빛 차단 희망까지)에 맞는 구성에 "추천" 표시. 카드 순서는 그대로
                const recComp = (typeof recommendComposition === 'function') ? recommendComposition(state.editingRoom) : null;
                const recCls = key => recComp === key ? 'is-recommended' : '';
                html += '<div class="bookmark-stage">';
                html += stepHead('창을 어떻게 구성할까요?', recComp ? '빛과 시선 답에 맞는 구성을 표시했어요' : '');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("이중 커튼", "호텔처럼", "", SOLID_TEXTURES.l1, function() { window.concierge.chooseWindowComposition('double'); }, recCls('double') + ' vdesc' + was('comp', 'double'));
                html += renderBookmarkCard("속지 커튼", "은은한 채광", "", SOLID_TEXTURES.l2, function() { window.concierge.chooseWindowComposition('sheer_only'); }, recCls('sheer_only') + ' vdesc' + was('comp', 'sheer_only'));
                html += renderBookmarkCard("겉지 커튼", "빛 차단", "", SOLID_TEXTURES.l3, function() { window.concierge.chooseWindowComposition('drape_only'); }, recCls('drape_only') + ' vdesc' + was('comp', 'drape_only'));
                html += renderBookmarkCard("블라인드", "빛 각도 조절", "", SOLID_TEXTURES.oak, function() { window.concierge.chooseWindowComposition('blind_only'); }, recCls('blind_only') + ' vdesc' + was('comp', 'blind_only'));
                html += '</div></div>';
                break;

            // [Step 3.5: 감성 앰비언트 브릿지]
            case "3.5-Bridge":
                const curItem = state.pendingItemQueue[state.currentItemIndex];
                const typeLabel = curItem.presetType === 'sheer' ? '속지' : (curItem.presetType === 'drape' ? '겉지' : '블라인드');
                html += '<div class="ambient-stage" onclick="window.concierge.proceedToFabricQueue()">';
                html += '<div class="ambient-light-glow"></div>';
                html += `<span class="q-meta">${state.editingRoom.name} · 원단 제안</span>`;
                html += `<h2 class="q-title font-serif-kr">이 공간의 빛과 색에 맞춰<br>${typeLabel}를 골랐습니다.</h2>`;
                html += '<p class="q-sub font-serif-kr">바닥·벽의 색과 들어오는 햇빛을 보고 고른 원단입니다.</p>';
                html += '<div class="q-hint font-serif-kr"><span>원단 보기</span><i class="fa-solid fa-arrow-right text-xs"></i></div>';
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
                html += stepHead('마음에 드는 원단을 눌러 주세요', anyColors ? '아래 견본을 누르면 다른 색을 볼 수 있어요' : '');
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

            // [Step 1: 공간 화면] 고른 항목만 보여 주는 작업 화면 (금액·시공비 없음). 공간마다 수정·삭제, "+ 공간 추가", 아래 "최종 제안 보기"
            // 평평한 바탕 · 가는 선 · 명조 글자 · 각진 원단 칸 · 밑줄 글자 버튼 (둥근 카드·그림자·색 버튼 없음)
            case "1-Space": {
                let roomsHtml = '';
                state.roomsCart.forEach(r => {
                    const delBtn = `<button type="button" aria-label="${r.name} 삭제" onclick="window.concierge.deleteRoom(${r.id})">삭제</button>`;
                    roomsHtml += '<section class="dos-room">';
                    if (!r.isConfigured) {
                        // 아직 구성 전인 공간
                        roomsHtml += `<div class="dos-rhead font-serif-kr"><span class="dos-rname">${r.name}<span class="dos-racts">${delBtn}</span></span><button type="button" class="dos-todo" onclick="window.concierge.openRoomCart(${r.id})">구성하기</button></div>`;
                        roomsHtml += '</section>';
                        return;
                    }
                    roomsHtml += `<div class="dos-rhead font-serif-kr"><span class="dos-rname">${r.name}<span class="dos-racts"><button type="button" aria-label="${r.name} 수정" onclick="window.concierge.openRoomCart(${r.id})">수정</button>${delBtn}</span></span></div>`;
                    r.curtains.forEach(c => {
                        const calcObj = c.calc || {};
                        const kind = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : (c.presetType === 'drape' ? '겉지' : '커튼'));
                        // 원단 이름 옆 작은 글자: 추가한 옵션만 (책자 이름은 넣지 않음)
                        const opts = [];
                        if (c.shapeFee > 0) opts.push('형상기억');
                        if (c.leadBand) opts.push('리드밴드');
                        if (c.hotelFit) opts.push('호텔핏');
                        const reason = (typeof ticketItemReason === 'function') ? ticketItemReason(r, c) : '';
                        roomsHtml += '<div class="dos-item">';
                        roomsHtml += `<div class="dos-sw" style="${fabricFillStyle(c.fabricId, c.colorName)}"></div>`;
                        roomsHtml += '<div class="dos-txt">';
                        roomsHtml += `<div class="dos-kind">${kind}</div>`;
                        roomsHtml += `<div class="dos-fab font-serif-kr">${(typeof ticketFabricName === 'function') ? ticketFabricName(c, calcObj) : (calcObj.fabName || c.label || '원단')}${opts.length ? `<em>${opts.join(' · ')}</em>` : ''}</div>`;
                        if (reason) roomsHtml += `<div class="dos-why">${reason}</div>`;
                        roomsHtml += '</div></div>';
                    });
                    roomsHtml += '</section>';
                });

                html += '<div class="dos-stage"><div class="dos-sheet">';
                html += '<div class="dos-top font-serif-kr"><h1 onclick="window.concierge.staffTap()">Re<i class="logo-dot">.</i>dam</h1></div>';
                html += `<p class="dos-who font-serif-kr">${currentCust && currentCust !== '고객' ? `${currentCust} 고객님` : '고객님'}의 공간</p>`;
                html += roomsHtml;
                // 다음 공간 자리: 공간 이름과 같은 자리·크기의 주황 밑줄 글자
                html += '<section class="dos-room dos-add"><button type="button" class="dos-addbtn font-serif-kr" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button></section>';

                // 버튼: 질문 화면과 같은 밑줄 글자. 화면 아래에 붙어 있어 내용이 길어도 바로 누를 수 있음
                html += '<div class="dos-acts">';
                html += '<div class="dos-main font-serif-kr">';
                if (state.roomsCart.some(r => r.isConfigured)) html += '<button type="button" class="dos-act is-main" onclick="window.concierge.goToCheckout()">최종 제안 보기 →</button>';
                html += '</div>';
                html += '<div class="dos-subacts">';
                // 다음 고객 상담: 확인 창을 거쳐 지금 상담을 이력에 보관하고 비움 (직원 화면의 "새 상담"과 같음)
                html += '<button type="button" onclick="if (typeof startNewConsultation === \'function\') startNewConsultation();">다음 상담 시작</button>';
                html += '</div></div>';

                html += '</div></div>';
                break;
            }

            // [Step 7: 최종 제안 = 견적서] 저장·인쇄되는 견적서 이미지(app.js drawTicket)를 종이 한 장처럼 가운데에 그대로 보여 줌
            // 공간 화면(고치고 더하는 화면)과 일부러 다른 모양: 여기는 "발행된 문서". 버튼과 시공비 입력은 종이 밖 오른쪽
            case "7-Final-Dossier": {
                html += '<div class="fin-stage">';
                html += '<div class="fin-paper" id="finPaper"><p class="fin-wait font-serif-kr">견적서를 준비하고 있어요</p></div>';
                html += '<aside class="fin-side">';
                html += `<p class="fin-who font-serif-kr">${currentCust && currentCust !== '고객' ? `${currentCust} 고객님` : '고객님'}<br>맞춤 제안</p>`;
                html += '<div class="fin-main font-serif-kr">';
                html += '<button type="button" class="dos-act is-main" onclick="window.concierge.saveQuote()">견적서 저장</button>';
                html += '<button type="button" class="dos-act" onclick="window.concierge.printQuote()">인쇄</button>';
                html += '</div>';
                html += '<label class="fin-fee"><span>시공 및 설치비</span>';
                html += `<span><input type="number" step="5000" inputmode="numeric" value="${state.installFee}" oninput="window.concierge.updateInstallFee(this.value)" class="font-serif-kr">원</span></label>`;
                html += '<div class="fin-sub">';
                html += '<button type="button" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가·수정</button>';
                // 다음 고객 상담: 확인 창을 거쳐 지금 상담을 이력에 보관하고 비움 (직원 화면의 "새 상담"과 같음)
                html += '<button type="button" onclick="if (typeof startNewConsultation === \'function\') startNewConsultation();">다음 상담 시작</button>';
                html += '</div></aside></div>';
                break;
            }
        }

        html += '</div>';
        main.innerHTML = html;
        if (state.step === "4-Fabric-Queue") bindColorDecks();     // 색상 카드 밀어 넘기기 연결
        if (state.step === "7-Final-Dossier") renderFinalPaper();
    }

    // ---- 최종 제안의 종이: 저장·인쇄되는 견적서 이미지를 그대로 그려 넣음 (app.js makeTicketBlobs). 여러 장이면 아래로 이어짐 ----
    let finalPaperSeq = 0, finalPaperTimer = null;
    async function renderFinalPaper() {
        const seq = ++finalPaperSeq;
        if (typeof window.makeTicketBlobs !== 'function') return;
        try {
            const { canvases } = await window.makeTicketBlobs({ canvasOnly: true, pixelRatio: 1.5 });
            const box = document.getElementById('finPaper');
            if (seq !== finalPaperSeq || !box || state.step !== "7-Final-Dossier") return;      // 그리는 사이 화면이 바뀌었으면 버림
            box.innerHTML = '';
            canvases.forEach(c => {
                const img = document.createElement('img');
                img.alt = '견적서';
                img.src = c.toDataURL('image/png');
                box.appendChild(img);
            });
        } catch (e) {
            console.error(e);
            const box = document.getElementById('finPaper');
            if (box) box.innerHTML = '<p class="fin-wait font-serif-kr">견적서를 그리지 못했어요. 다시 열어 주세요</p>';
        }
    }

    // ---- 원단 카드 안의 색상 덱 ----
    // 색상 순서: 분류돼 있으면 어울리는 색부터(랭킹 순), 아니면 번호 순
    function colorDeckOrder(best) {
        const numSort = (x, y) => (/^\d+$/.test(x.name) && /^\d+$/.test(y.name)) ? parseInt(x.name, 10) - parseInt(y.name, 10) : x.name.localeCompare(y.name, 'ko');
        const list = best.classified ? best.ranked.slice() : best.ranked.slice().sort(numSort);
        return list.map(r => r.name);
    }
    // 색 하나의 바탕색: 색상 입력표에서 잰 색(색상코드)이 있으면 그 색, 없으면 톤으로 짐작한 색. 사진이 없을 때 칸 바탕과 견본 칩에 씀
    function colorFillOf(fabricId, colorName) {
        const col = (colorName && typeof getFabricColors === 'function') ? getFabricColors(fabricId).find(x => x.name === normalizeColorName(colorName)) : null;
        if (col && col.hex) return col.hex;
        return (typeof fabricToneFill === 'function') ? fabricToneFill(fabricId, colorName) : '#d9cdbb';
    }
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
    // 원단 한 칸: 사진(없으면 그 색) 위쪽 + 아래 짙은 띠에 세로 원단 이름 · 세로 색 이름 · 오른쪽 아래 견본 칩(색이 둘 이상일 때)
    // 추천 이유는 칸에 넣지 않음(10-14 사장님 결정. 제안서·견적서에는 그대로)
    function fabricCardHtml(f, best, idx, pick, queueItem, targetCategory) {
        const order = colorDeckOrder(best), n = order.length;
        // 품명 끝의 색 이름(예: 오솔로 화이트)은 이름에서 떼어 색 자리로 → 이름 길이가 고르게
        let name = fabricDisplayName(f), colorTag = colorTagOf(f, pick, n);
        const cw = /\s+(오프화이트|퓨어화이트|화이트|아이보리|크림|라이트베이지|베이지|샌드|오트밀|그레이지|라이트그레이|그레이|차콜|모카|토프|카멜|브라운|초콜릿|네이비|블랙)$/.exec(name);
        if (cw && name.length > cw[0].length) { name = name.slice(0, -cw[0].length); colorTag = colorTag || cw[1]; }
        // 글자 수 세기: 영어·숫자는 눕혀 쓰므로 0.6자(대문자 0.78자)로 셈
        const vlen = s => Array.from(String(s)).reduce((a, ch) => a + (/[A-Z]/.test(ch) ? 0.78 : (/[a-z0-9 .\/%&-]/.test(ch) ? 0.6 : 1)), 0) || 1;   // 영어 대문자는 조금 더 넓게
        const isLast = idx === (state.fabPanelCount || 1) - 1;
        let h = `<div class="bookmark-card color-top" data-fab="${f.id}" style="right: 0;" onclick="window.concierge.handleQueueFabricClick('${f.id}')">`;
        h += `<div class="bookmark-bg" style="background: ${colorFillOf(f.id, pick)};"></div>`;
        h += `<img class="fabric-photo" alt="" data-id="${f.id}" data-color="${pick}" data-i="0" src="${fabricPhotoUrls(f.id, pick)[0]}" onerror="window.concierge.imgFallback(this)">`;
        h += '<div class="bookmark-gradient fab-gradient"></div>';
        // 아래 띠: 왼쪽에 세로 이름(아래 정렬), 그 오른쪽에 세로 색 이름. 오른쪽 끝 아래에 견본 칩
        h += `<div class="fab-band${isLast ? ' is-last' : ''}">`;
        const latin = /[A-Za-z]{3,}/.test(name);      // 영어 낱말(3글자 이상)이 있을 때만 눕혀 씀. "울피치 A"처럼 한두 글자는 한글처럼 세워 씀
        const stack = s => Array.from(String(s)).map(ch => ch === ' ' ? '<i class="vsp"></i>' : `<span>${ch}</span>`).join('');
        h += latin ? `<h3 class="fab-vname is-latin font-serif-kr" style="--len: ${vlen(name).toFixed(2)};">${name}</h3>`
                   : `<h3 class="fab-vname vstack font-serif-kr" style="--len: ${vlen(name).toFixed(2)};">${stack(name)}</h3>`;
        if (colorTag) h += `<p class="fab-vdesc vstack">${stack(colorTag)}</p>`;
        if (n > 1) {
            // 견본 칩: 색마다 하나(어울리는 색 순서). 누르면 그 색이 칸에 나옴, 지금 색은 밑줄. 칸(원단)을 누르면 지금 색으로 고름
            h += '<div class="fab-chips">' + order.map(nx => {
                const label = colorTagOf(f, nx, n);
                return `<button type="button" class="fab-chip${nx === pick ? ' on' : ''}" aria-label="${label}" aria-pressed="${nx === pick}" onclick="event.stopPropagation(); window.concierge.showColor('${f.id}', '${String(nx).replace(/'/g, "\\'")}')"><i style="background: ${colorFillOf(f.id, nx)};"></i></button>`;
            }).join('') + '</div>';
        }
        h += '</div>';
        // 마지막 칸에만 Re.dam 표시 (오른쪽 아래). 5번 누르면 직원 화면
        if (isLast) h += '<div class="card-brand" onclick="event.stopPropagation(); window.concierge.staffTap()">Re<i class="logo-dot">.</i>dam</div>';
        h += '</div>';
        return h;
    }
    // (예전 "옆으로 밀기"·"뒤에 겹친 색 띠"는 뺐음 → 지금은 아래 띠의 견본 칩을 눌러 색을 바꿈)
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
        const latin = /[A-Za-z]{3,}/.test(title);     // 영어 낱말(3글자 이상)이 있을 때만 눕혀 씀. 한두 글자는 세워 씀
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

    // ==============================================================
    // 로고 모션: 시작 화면의 "시작하기"를 누르면 나오고, 끝나면 첫 화면(고객 정보)으로 이어짐. 화면 아무 데나 누르면 건너뜀
    // 화면 가득한 흰빛이 모이며 걸러져 로고의 흙빛 점이 되고, 그 점에서 Re.dam 글자가 양쪽으로 번져 나온 뒤, 로고가 첫 화면의 Re.dam 자리로 옮겨 앉음
    // ==============================================================
    // 확정 로고의 글자 모양(R · e · 점 · d · a · m). 점은 원이 대신 그림
    const INTRO_PATHS = ["M53 0V-30L191 -42H213L352 -30V0ZM155 0Q157 -84 157.0 -168.0Q157 -252 157 -337V-391Q157 -476 157.0 -560.5Q157 -645 155 -728H248Q246 -645 245.5 -558.0Q245 -471 245 -366V-346Q245 -255 245.5 -169.5Q246 -84 248 0ZM614 9Q564 9 540.5 -6.5Q517 -22 509 -57L459 -228Q448 -270 433.0 -294.5Q418 -319 392.0 -330.0Q366 -341 321 -341H203V-373H348Q404 -373 443.5 -395.0Q483 -417 504.0 -455.0Q525 -493 525 -539Q525 -612 481.0 -653.5Q437 -695 346 -695H202V-728H359Q479 -728 544.5 -679.5Q610 -631 610 -540Q610 -491 584.5 -449.5Q559 -408 508.5 -381.0Q458 -354 382 -349V-359Q436 -355 467.5 -339.5Q499 -324 516.5 -295.5Q534 -267 547 -223L609 -18L568 -39L700 -30V0Q683 4 662.5 6.5Q642 9 614 9ZM53 -698V-728H202V-687H191Z", "M1053 15Q980 15 922.0 -15.0Q864 -45 831.0 -106.0Q798 -167 798 -257Q798 -341 832.5 -402.5Q867 -464 923.0 -497.5Q979 -531 1045 -531Q1110 -531 1156.5 -503.5Q1203 -476 1227.5 -429.0Q1252 -382 1252 -323Q1252 -287 1245 -263H837V-294H1127Q1154 -294 1163.0 -308.0Q1172 -322 1172 -352Q1172 -416 1138.0 -457.5Q1104 -499 1043 -499Q999 -499 963.0 -471.5Q927 -444 906.0 -392.5Q885 -341 885 -269Q885 -188 909.5 -136.0Q934 -84 977.0 -59.5Q1020 -35 1075 -35Q1128 -35 1167.5 -53.5Q1207 -72 1238 -108L1254 -94Q1221 -44 1171.0 -14.5Q1121 15 1053 15Z", "M1495 15Q1469 15 1451.5 -3.5Q1434 -22 1434 -46Q1434 -73 1451.5 -90.5Q1469 -108 1495 -108Q1521 -108 1539.0 -90.5Q1557 -73 1557 -46Q1557 -22 1539.0 -3.5Q1521 15 1495 15Z", "M1961 15Q1898 15 1848.5 -19.0Q1799 -53 1770.5 -113.0Q1742 -173 1742 -252Q1742 -338 1773.0 -400.5Q1804 -463 1857.0 -497.0Q1910 -531 1975 -531Q2019 -531 2060.5 -509.5Q2102 -488 2138 -438H2147L2135 -411Q2099 -450 2066.5 -467.5Q2034 -485 1997 -485Q1951 -485 1913.0 -461.5Q1875 -438 1852.5 -387.0Q1830 -336 1830 -254Q1830 -178 1851.0 -129.0Q1872 -80 1908.5 -56.5Q1945 -33 1990 -33Q2031 -33 2065.0 -50.5Q2099 -68 2133 -110L2146 -82H2136Q2103 -33 2058.0 -9.0Q2013 15 1961 15ZM2126 10 2122 -89V-92V-431L2124 -440V-743L2033 -748V-775L2192 -805L2206 -796L2203 -644V-34L2297 -28V0Z", "M2548 15Q2488 15 2449.0 -19.0Q2410 -53 2410 -115Q2410 -154 2427.0 -184.5Q2444 -215 2483.5 -239.0Q2523 -263 2589 -282Q2631 -295 2677.0 -307.0Q2723 -319 2763 -328V-303Q2723 -293 2682.0 -281.5Q2641 -270 2607 -257Q2543 -234 2516.5 -202.0Q2490 -170 2490 -128Q2490 -82 2515.5 -58.0Q2541 -34 2583 -34Q2606 -34 2628.0 -43.0Q2650 -52 2678.0 -74.0Q2706 -96 2744 -134L2753 -87H2729Q2698 -54 2670.5 -31.0Q2643 -8 2614.0 3.5Q2585 15 2548 15ZM2815 14Q2770 14 2747.5 -16.5Q2725 -47 2722 -100V-103V-359Q2722 -415 2710.0 -445.5Q2698 -476 2673.0 -488.0Q2648 -500 2608 -500Q2579 -500 2550.0 -491.5Q2521 -483 2488 -465L2531 -492L2515 -413Q2511 -386 2498.5 -375.0Q2486 -364 2467 -364Q2431 -364 2423 -400Q2438 -461 2492.0 -496.0Q2546 -531 2630 -531Q2717 -531 2759.5 -489.5Q2802 -448 2802 -355V-108Q2802 -61 2813.0 -44.5Q2824 -28 2844 -28Q2857 -28 2867.0 -33.5Q2877 -39 2889 -52L2905 -37Q2889 -11 2866.5 1.5Q2844 14 2815 14Z", "M2992 0V-28L3100 -39H3133L3237 -28V0ZM3074 0Q3075 -24 3075.5 -65.0Q3076 -106 3076.5 -150.5Q3077 -195 3077 -229V-290Q3077 -341 3076.5 -381.0Q3076 -421 3074 -458L2986 -463V-488L3140 -528L3153 -520L3159 -406V-403V-229Q3159 -195 3159.5 -150.5Q3160 -106 3160.5 -65.0Q3161 -24 3162 0ZM3320 0V-28L3428 -39H3461L3564 -28V0ZM3402 0Q3403 -24 3403.5 -64.5Q3404 -105 3404.5 -149.5Q3405 -194 3405 -229V-342Q3405 -416 3381.5 -446.5Q3358 -477 3318 -477Q3280 -477 3237.0 -453.0Q3194 -429 3142 -371L3133 -406H3144Q3193 -468 3243.5 -499.5Q3294 -531 3349 -531Q3414 -531 3449.5 -487.5Q3485 -444 3485 -342V-229Q3485 -194 3485.5 -149.5Q3486 -105 3486.5 -64.5Q3487 -24 3488 0ZM3648 0V-28L3754 -39H3787L3891 -28V0ZM3728 0Q3730 -24 3730.5 -64.5Q3731 -105 3731.5 -149.5Q3732 -194 3732 -229V-342Q3732 -418 3708.0 -447.5Q3684 -477 3641 -477Q3604 -477 3561.0 -455.0Q3518 -433 3468 -377L3457 -413H3469Q3517 -474 3567.0 -502.5Q3617 -531 3671 -531Q3740 -531 3776.5 -487.5Q3813 -444 3813 -343V-229Q3813 -194 3813.5 -149.5Q3814 -105 3814.5 -64.5Q3815 -24 3816 0Z"];
    const INTRO_G = { x1: 3891, cx: 1972, cy: -395, w: 3838 };
    const INTRO_DOT = { x: 1495.5, y: -46.5, r: 61.5 };
    const INTRO_STOPS = ['#ffffff', '#faf6ef', '#f0dcc4', '#dcac85', '#b46e45', '#8a4a22'];   // 흰빛 → 살구빛 → 로고 점 흙빛
    const INTRO_T = { fadeIn: .25, hold: [0, 1.0], gather: [1.0, 4.7], letters: [4.65, 5.8], settle: [6.5, 7.7], end: [7.6, 8.2] };   // 초. 시안의 가장 긴 박자(릴스)
    // 빛의 흐린 가장자리: 흐림 필터 대신 같은 모양의 그러데이션으로 그림 (화면 전체를 흐리면 태블릿에서 끊김). [가장자리에서 떨어진 정도, 진하기]
    const INTRO_EDGE = [[-2.5, 1], [-2, .977], [-1.5, .933], [-1, .841], [-.5, .691], [0, .5], [.5, .309], [1, .159], [1.5, .067], [2, .023], [2.5, 0]];

    // OKLab로 섞어야 중간색이 탁해지지 않음
    function introLab(h) {
        const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
        const r = lin(parseInt(h.slice(1, 3), 16)), g = lin(parseInt(h.slice(3, 5), 16)), b = lin(parseInt(h.slice(5, 7), 16));
        const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
        return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
    }
    function introHex(lab) {
        const srgb = c => { const v = c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
        const l = Math.pow(lab[0] + .3963377774 * lab[1] + .2158037573 * lab[2], 3), m = Math.pow(lab[0] - .1055613458 * lab[1] - .0638541728 * lab[2], 3), s = Math.pow(lab[0] - .0894841775 * lab[1] - 1.291485548 * lab[2], 3);
        const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
        return '#' + rgb.map(v => srgb(v).toString(16).padStart(2, '0')).join('');
    }

    // then = 모션이 화면을 다 덮었을 때 한 번 부름 (그 뒤에서 다음 화면을 그려 둠). 모션을 못 그리는 기기에서도 반드시 부름
    function playIntro(then) {
        let covered = false;
        const cover = () => { if (!covered) { covered = true; if (then) then(); } };
        let box = null;
        try {
            const G = INTRO_G, D = INTRO_DOT, T = INTRO_T;
            let reduced = false;
            try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
            const total = reduced ? 1.6 : T.end[1];
            const paths = (from, to) => INTRO_PATHS.slice(from, to).map(d => `<path d="${d}"/>`).join('');
            box = document.createElement('div');
            box.className = 'logo-intro';
            box.setAttribute('aria-hidden', 'true');
            box.style.opacity = reduced ? '1' : '0';
            box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><defs>'
                + '<radialGradient id="introGlow" gradientUnits="userSpaceOnUse">' + INTRO_EDGE.map(s => `<stop stop-opacity="${s[1]}"/>`).join('') + '</radialGradient>'
                + '<linearGradient id="introGL" gradientUnits="userSpaceOnUse" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>'
                + '<linearGradient id="introGR" gradientUnits="userSpaceOnUse" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>'
                + '<mask id="introML" maskUnits="userSpaceOnUse" x="-2000" y="-3000" width="9000" height="6000"><rect x="-2000" y="-3000" width="3600" height="6000" fill="url(#introGL)"/></mask>'
                + '<mask id="introMR" maskUnits="userSpaceOnUse" x="-2000" y="-3000" width="9000" height="6000"><rect x="1400" y="-3000" width="5000" height="6000" fill="url(#introGR)"/></mask>'
                + '</defs>'
                + `<g><g mask="url(#introML)">${paths(0, 2)}</g><g mask="url(#introMR)">${paths(3)}</g></g>`
                + '<circle fill="url(#introGlow)"/><circle/></svg>';
            const svg = box.firstChild, logo = svg.children[1], halves = [logo.children[0], logo.children[1]], light = svg.children[2], dot = svg.children[3];
            const glow = svg.querySelector('#introGlow'), glowStops = Array.from(glow.children), gL = svg.querySelector('#introGL'), gR = svg.querySelector('#introGR');
            const labs = INTRO_STOPS.map(introLab);
            const clamp = v => Math.max(0, Math.min(1, v));
            const prog = (x, w) => clamp((x - w[0]) / (w[1] - w[0]));
            const lerp = (a, b, k) => a + (b - a) * k;
            const io = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const out = k => 1 - Math.pow(1 - k, 3);
            const set = (el, o) => { for (const k in o) el.setAttribute(k, o[k]); };
            let t0 = null, skipAt = null, ended = false, vw = 0, vh = 0, safety = 0, homeFont = 0, homeBase = 0;

            const finish = () => {
                if (ended) return;
                ended = true;
                clearTimeout(safety);
                document.removeEventListener('keydown', onKey, true);
                box.remove();
                cover();
            };
            const skip = () => { if (skipAt === null && t0 !== null) skipAt = (performance.now() - t0) / 1000; };
            // 첫 화면의 Re.dam 글자 자리(글자 시작점 · 밑선 · 크기). 로고 선 모양은 글자 크기 1000 기준
            const home = () => {
                const h = document.querySelector('#v2Viewport .wel-brand');
                if (!h) return null;
                const rc = h.getBoundingClientRect();
                if (!homeFont) {
                    const p = document.createElement('span');
                    p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
                    h.appendChild(p);
                    homeBase = (p.getBoundingClientRect().bottom - rc.top) / rc.height;
                    p.remove();
                    homeFont = parseFloat(getComputedStyle(h).fontSize);
                }
                return { s: homeFont / 1000, x: rc.left, y: rc.top + rc.height * homeBase };
            };
            const onKey = e => { e.preventDefault(); e.stopPropagation(); skip(); };

            function frame(now) {
                if (ended) return;
                if (t0 === null) t0 = now;
                const t = (now - t0) / 1000, tt = reduced ? 1e9 : t;
                const W = box.clientWidth || window.innerWidth, H = box.clientHeight || window.innerHeight;
                if (W !== vw || H !== vh) { vw = W; vh = H; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); }

                // 로고: 화면 가운데에 나타났다가, 끝에는 첫 화면의 Re.dam 자리로 옮겨 앉음 (움직임 줄이기: 처음부터 그 자리)
                if (reduced) cover();
                let s = Math.min(W * .62, H * .7, 700) / G.w, tx = W / 2 - G.cx * s, ty = H / 2 - G.cy * s;
                const q = reduced ? 1 : io(prog(t, T.settle)), to = q > 0 ? home() : null;
                if (to) { s = Math.exp(lerp(Math.log(s), Math.log(to.s), q)); tx = lerp(tx, to.x, q); ty = lerp(ty, to.y, q); }
                logo.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
                const dx = tx + D.x * s, dy = ty + D.y * s, dr = D.r * s;

                // 빛: 화면을 덮은 큰 원이 모이며 색이 걸러지고 가장자리가 또렷해짐
                const R0 = Math.hypot(W, H) * .62;
                const g = prog(tt, T.gather), e = io(g) * .45 + (1 - Math.pow(1 - g, 2)) * .55;   // 화면 밖 구간은 빨리, 보이는 구간은 천천히
                const r = Math.exp(lerp(Math.log(R0), Math.log(dr), e));
                const x = lerp(W / 2, dx, e), y = lerp(H / 2, dy, e);
                const k = clamp(Math.log(R0 / r) / Math.log(R0 / dr));   // 얼마나 모였나 (0~1)
                const ci = Math.min(labs.length - 2, Math.floor(k * (labs.length - 1))), cf = k * (labs.length - 1) - ci;
                const col = introHex(labs[ci].map((v, j) => v + (labs[ci + 1][j] - v) * cf));
                const rb = r * (g === 0 ? .985 + .015 * Math.sin(prog(tt, T.hold) * Math.PI) : 1);
                const soft = r * .32 * Math.pow(1 - k, 1.4), rOut = rb + 2.5 * soft;
                if (k < .995) {
                    set(glow, { cx: x, cy: y, r: rOut });
                    glowStops.forEach((st, i) => set(st, { offset: (rb + INTRO_EDGE[i][0] * soft) / rOut, 'stop-color': col }));
                }
                set(light, { cx: x, cy: y, r: rOut, opacity: k < .995 ? 1 : 0 });
                set(dot, { cx: x, cy: y, r: r, fill: col, opacity: k >= .995 ? 1 : 0 });

                // 글자: 점에서 양쪽으로 번짐
                const pl = out(prog(tt, T.letters)), fth = 280;
                const le = lerp(1252 + fth + 10, 0, pl), re = lerp(1742 - fth - 10, G.x1 + 30, pl);
                set(gL, { x1: le - fth, x2: le });
                set(gR, { x1: re, x2: re + fth });
                halves.forEach(h => set(h, { opacity: clamp(pl * 1.6), transform: `translate(0 ${(1 - pl) * 36})` }));

                // 나타나기 · 첫 화면으로 넘어가기 (움직임 줄이기: 로고만 잠깐 나타났다가 넘어감)
                let op = reduced ? 1 - io(prog(t, [1.2, 1.6])) : Math.min(clamp(t / T.fadeIn), 1 - io(prog(t, T.end)));
                if (reduced) svg.style.opacity = clamp(t / .4);
                if (skipAt !== null) op *= 1 - clamp((t - skipAt) / .15);
                box.style.opacity = op;
                if (t >= T.fadeIn) cover();

                if (t >= total || (skipAt !== null && t - skipAt >= .15)) finish();
                else requestAnimationFrame(frame);
            }

            box.addEventListener('click', skip);
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(box);
            safety = setTimeout(finish, (total + 1.5) * 1000);      // 화면이 가려져 그리기가 멈춘 때에도 남지 않게
            requestAnimationFrame(frame);
        } catch (e) {
            console.warn('로고 모션 실패', e);
            if (box) box.remove();
            cover();
        }
    }

    window.concierge = {
        start: function() {
            goToStep(state.roomsCart.length ? "1-Space" : "0-Start", false);
        },
        prevStep: function() {
            prevStep();
        },
        goToSpaceCanvas: function() {
            goToStep("1-Space");
        },
        // 첫 화면 "상담 시작": 공간이 없으면 바로 첫 공간 종류를 묻고, 있으면 공간 화면으로
        beginConsult: function() {
            goToStep(state.roomsCart.length ? "1-Space" : "1.5-Room-Type");
        },
        // 시작 화면 "시작하기": 로고 모션이 화면을 덮은 뒤 그 아래에 첫 화면을 그려 둠 (뒤로가기로 시작 화면에 돌아오지 않음)
        openWelcome: function() {
            playIntro(() => goToStep("0-Welcome", false));
        },
        // 앱을 다시 열어 진행 중이던 상담을 되살렸을 때: 시작 화면을 건너뛰고 첫 화면("상담 이어가기")으로
        resume: function() {
            goToStep("0-Welcome", false);
        },
        // 공간 화면·최종 제안의 홈 버튼: 첫 화면으로 가서 고객 정보를 고침 ("상담 이어가기"로 돌아옴)
        goHome: function() {
            goToStep("0-Welcome");
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
            // "수정"으로 들어온 공간(질문을 거쳐 만든 공간만): 지난번 답을 기억해 두었다가 질문 화면에 회색으로 표시
            if (target.isConfigured && target.diagnosed) {
                const kinds = (target.curtains || []).map(c => c.presetType);
                const comp = kinds.includes('blind') ? 'blind_only'
                    : (kinds.includes('sheer') && kinds.includes('drape')) ? 'double'
                    : kinds.includes('sheer') ? 'sheer_only' : (kinds.includes('drape') ? 'drape_only' : null);
                state.editingRoom.prev = {
                    floorTone: target.floorTone, wallTone: target.wallTone, lightLevel: target.lightLevel,
                    lightBlock: target.lightBlock || null, privacy: target.privacy || null,
                    wantMood: target.wantMood || null, sheerFeel: target.sheerFeel || null, comp
                };
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
            // 속지가 들어가는 구성이면 속지 느낌을 물음 (공간마다. "수정"으로 다시 들어와도 다른 질문처럼 다시 물음 — 마음이 바뀔 수 있어서)
            const hasSheer = (state.editingRoom.items || []).some(i => i.presetType === 'sheer');
            goToStep(hasSheer ? "2-Base-SheerFeel" : "3.5-Bridge");
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
        // 직원 화면 "원단 찾기"의 후보 보여주기 화면도 고객 화면과 같은 칸(세로 제목 + 짧은 글)을 씀
        bookmarkCard: renderBookmarkCard,
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
            if (state.step === "0-Welcome" || state.step === "1-Space" || state.step === "7-Final-Dossier") render();
        },
        // 직원 화면(B)에서 만든 견적을 고객용 제안서 화면으로 보여주기
        showProposalFromRooms: function(masterRooms, installFee) {
            window.concierge.loadFromMaster(masterRooms, installFee);
            stepHistory.length = 0;
            goToStep("7-Final-Dossier", false);
        },
        // 새 상담 시작: 고객 입력 내용을 모두 비움
        resetAll: function() {
            state.roomsCart = [];
            state.editingRoomId = null;
            state.editingRoom = null;
            state.pendingItemQueue = [];
            state.currentItemIndex = 0;
            state.installFee = loadDefaultInstallFee();
            state.focusedFabricId = null;
            state.keypadTarget = null;
            stepHistory.length = 0;
            const el = document.getElementById('custName');
            if (el) el.value = '';
            const ph = document.getElementById('custPhone');
            if (ph) ph.value = '';
            goToStep("0-Start", false);
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
        // 최종 제안의 시공비 입력: 직원 화면과 맞춘 뒤 종이를 다시 그림 (입력 중에는 잠깐 기다렸다가)
        updateInstallFee: function(val) {
            state.installFee = parseFloat(val) || 0;
            syncToV1MasterRooms();
            clearTimeout(finalPaperTimer);
            finalPaperTimer = setTimeout(renderFinalPaper, 350);
        }
    };
})();
