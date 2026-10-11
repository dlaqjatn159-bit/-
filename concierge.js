(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['concierge.js']='20261022';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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
            fabName: (fab.name || (isBlind ? "블라인드" : "원단")) + (typeof colorSuffix === "function" ? colorSuffix(c.colorName) : ""),
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
            lightBlock: r.lightBlock || null,
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
    function diagnosisSteps() {
        const steps = ["2-Base-Floor", "2-Base-Wall", "2-Base-Light"];
        if (roomTypeOf(state.editingRoom) === '방') steps.push("2-Base-Block");
        steps.push("2-Base-Mood", "3-Config-Style");
        return steps;
    }
    function stepHead(question) {
        const steps = diagnosisSteps();
        const at = steps.indexOf(state.step);
        let dots = '';
        if (at >= 0) dots = '<div class="step-dots">' + steps.map((_, i) => `<span class="${i === at ? 'on' : (i < at ? 'done' : '')}"></span>`).join('') + '</div>';
        return `<div class="step-head">${dots}<p class="step-q font-serif-kr">${question}</p></div>`;
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
            off: { topL: 40, topR: 180, botL: 34, botR: 192, n: 9, jitter: [0, 2, -2, 3, 0, -3, 4, 2, 6, 10], wave: 7, c1: '#efe6d8', c2: '#e2d5c1', op: 0.95 },
            on: { topL: 40, topR: 180, botL: 40, botR: 180, n: 9, c1: '#efe6d8', c2: '#e2d5c1', op: 0.95, band: true }
        }
    };
    function optionInfoHtml(keys) {
        let h = '<div class="opt-info-sheet" onclick="event.stopPropagation()">';
        h += '<div class="opt-info-head font-serif-kr">제작 옵션 미리보기</div>';
        keys.forEach(k => {
            const o = OPTION_INFO[k];
            h += '<div class="opt-info-row">';
            h += `<div class="opt-info-text"><strong class="font-serif-kr">${o.title}</strong><p>${o.desc}</p></div>`;
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
        let html = '<div class="w-full h-full flex flex-col items-center justify-center stage-transition" style="min-height: 100vh; width: 100vw; background: radial-gradient(circle at 50% 45%, #ffffff 0%, #fbf9f5 55%, #f4ede2 100%);">';

        switch (state.step) {
            // [Step 1: 공간 장바구니 캔버스]
            case "1-Space":
                const roomCount = state.roomsCart.length;
                const configuredRooms = state.roomsCart.filter(r => r.isConfigured);
                const hasConfigured = configuredRooms.length > 0;
                let grandSum = 0;
                configuredRooms.forEach(r => grandSum += (r.subtotal || 0));

                html += '<div class="bookmark-stage" style="position: relative; width: 100vw; height: 100vh; padding: 1.5rem 2rem; box-sizing: border-box;">';
                html += '<div style="display: flex; gap: 1.25rem; width: 100%; height: 92vh; justify-content: flex-end; align-items: stretch;">';
                
                if (roomCount === 0) {
                    html += '<div style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding-left: 2rem;" class="font-serif-kr">';
                    html += '<h1 style="font-size: 2.8rem; font-weight: 700; color: #2b221a; letter-spacing: -0.02em; cursor: pointer;" onclick="window.concierge.staffTap()">Re.dam</h1>';
                    html += '<p style="font-size: 0.95rem; color: #6f5f4f; margin-top: 0.6rem; line-height: 1.6;">공간별 빛과 결을 채워 넣는 비스포크 큐레이션입니다.<br>오른쪽 <strong style="color: #91401a;">+ 공간 추가</strong>를 탭하여 공간을 등록해 주세요.</p>';
                    html += `<input type="text" id="cName_ui" value="${(document.getElementById('custName') ? document.getElementById('custName').value : '').replace(/"/g, '&quot;')}" placeholder="고객명 / 현장명 (선택)" oninput="window.concierge.setClientName(this.value)" style="margin-top: 1.4rem; width: 100%; max-width: 320px; padding: 0.9rem 1.1rem; border: 1.5px solid #e5dcd0; border-radius: 16px; font-size: 1rem; font-weight: 600; background: #fff; color: #2b221a; outline: none;">`;
                    html += '</div>';
                }

                state.roomsCart.forEach((room, idx) => {
                    const texture = idx % 3 === 0 ? SOLID_TEXTURES.l1 : (idx % 3 === 1 ? SOLID_TEXTURES.l2 : SOLID_TEXTURES.l3);
                    const tagDesc = room.isConfigured 
                        ? `${room.curtains.length}개 품목 · ${(room.subtotal || 0).toLocaleString()}원` 
                        : "터치하여 품목 구성";
                    const statusPill = room.isConfigured ? "✓ 완료 · 탭하여 수정" : `SPACE 0${idx + 1}`;

                    html += '<div style="flex: 1 1 0; min-width: 0; display: flex; position: relative;">';
                    html += `<button onclick="window.concierge.deleteRoom(${room.id})" aria-label="${room.name} 삭제" style="position: absolute; top: 14px; right: 14px; z-index: 30; background: rgba(255,255,255,0.92); color: #6f5f4f; border: 1px solid #e5dcd0; border-radius: 999px; padding: 0.5rem 0.95rem; font-size: 0.82rem; font-weight: 700; cursor: pointer;">삭제</button>`;
                    html += renderBookmarkCard(room.name, tagDesc, statusPill, texture, function() {
                        window.concierge.openRoomCart(room.id);
                    });
                    html += '</div>';
                });

                const addCardStyle = (roomCount >= 4)
                    ? 'flex: 1 1 0; min-width: 0; display: flex;'
                    : 'flex: 0 0 19%; max-width: 20vw; min-width: 140px; display: flex;';

                html += `<div style="${addCardStyle}">`;
                html += renderBookmarkCard("+ 공간 추가", "새 공간 큐레이션 등록", "ADD SPACE", SOLID_TEXTURES.walnut, function() {
                    window.concierge.startNewRoomSelection();
                });
                html += '</div>';

                html += '</div>';

                // ★ [해결: 우측 카드를 가리지 않는 화면 중앙 하단 글래스모피즘 캡슐]
                if (hasConfigured) {
                    html += '<div style="position: absolute; bottom: 2.2rem; left: 50%; transform: translateX(-50%); z-index: 50;">';
                    html += '<button onclick="window.concierge.goToCheckout()" style="background: rgba(255, 255, 255, 0.22) !important; backdrop-filter: blur(20px) !important; -webkit-backdrop-filter: blur(20px) !important; color: #2b221a !important; border: 1.5px solid rgba(255, 255, 255, 0.75) !important; padding: 1rem 2.8rem !important; border-radius: 999px !important; font-weight: 800 !important; font-size: 0.95rem !important; cursor: pointer !important; box-shadow: 0 14px 36px rgba(43, 34, 26, 0.16) !important; display: flex !important; align-items: center !important; gap: 0.6rem !important; white-space: nowrap !important;">';
                    html += `<span>최종 제안 보기 (${grandSum.toLocaleString()}원)</span>`;
                    html += '<i class="fa-solid fa-arrow-right text-xs" style="color: #91401a;"></i>';
                    html += '</button>';
                    html += '</div>';
                }

                html += '</div>';
                break;

            // [Step 1.5: 7종 공간 선택]
            case "1.5-Room-Type":
                html += '<div class="bookmark-stage">';
                html += stepHead('어느 공간의 창인가요?');
                html += '<div class="bookmark-canvas" style="--items-count: 7;">';
                html += renderBookmarkCard("거실", "집의 중심을 완성하는 빛과 쉼", "ZONE 01", SOLID_TEXTURES.l1, function() { window.concierge.chooseRoomType("거실"); });
                html += renderBookmarkCard("방", "온전한 숙면과 아늑한 프라이빗", "ZONE 02", SOLID_TEXTURES.l3, function() { window.concierge.chooseRoomType("방"); });
                html += renderBookmarkCard("서재", "몰입과 사색을 위한 은은한 빛", "ZONE 03", SOLID_TEXTURES.l2, function() { window.concierge.chooseRoomType("서재"); });
                html += renderBookmarkCard("주방", "단정하고 깨끗한 모던 윈도우", "ZONE 04", SOLID_TEXTURES.tile, function() { window.concierge.chooseRoomType("주방"); });
                html += renderBookmarkCard("알파룸", "다목적 공간을 위한 감성 연출", "ZONE 05", SOLID_TEXTURES.neutral, function() { window.concierge.chooseRoomType("알파룸"); });
                html += renderBookmarkCard("드레스룸", "옷감 보호와 단정한 차폐", "ZONE 06", SOLID_TEXTURES.l4, function() { window.concierge.chooseRoomType("드레스룸"); });
                html += renderBookmarkCard("베란다", "외부 직사광 조절과 채광", "ZONE 07", SOLID_TEXTURES.oak, function() { window.concierge.chooseRoomType("베란다"); });
                html += '</div></div>';
                break;

            // [Step 2-0: 앞 공간과 같은 바닥·벽인지 (두 번째 공간부터)]
            case "2-Base-Copy":
                const src = copySourceRoom();
                const srcDesc = src ? `바닥 ${TONE_LABELS[src.floorTone] || ''} 톤 · 벽 ${TONE_LABELS[src.wallTone] || ''} 톤` : '';
                html += '<div class="bookmark-stage">';
                html += stepHead(src ? `${withGwa(src.name)} 바닥·벽이 같은가요?` : '바닥·벽을 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 2;">';
                html += renderBookmarkCard(`네, ${withGwa(src ? src.name : '앞 공간')} 같아요`, srcDesc, "SAME AS BEFORE", SOLID_TEXTURES.l1, function() { window.concierge.copyBaseFromPrev(true); });
                html += renderBookmarkCard("아니요, 새로 고를게요", "이 공간의 바닥·벽 톤을 직접 고릅니다", "NEW", SOLID_TEXTURES.l3, function() { window.concierge.copyBaseFromPrev(false); });
                html += '</div></div>';
                break;

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
                html += '<div class="bookmark-stage">';
                html += stepHead('창으로 햇빛은 얼마나 들어오나요?');
                html += '<div class="bookmark-canvas" style="--items-count: 3;">';
                html += renderBookmarkCard("풍부한 채광", "남향/고층의 강하고 눈부신 직사광", "LIGHT HIGH", SOLID_TEXTURES.l1, function() { window.concierge.selectLightLevel('high'); });
                html += renderBookmarkCard("은은한 채광", "동향/서향의 부드럽고 적당한 햇살", "LIGHT MID", SOLID_TEXTURES.l2, function() { window.concierge.selectLightLevel('mid'); });
                html += renderBookmarkCard("차분한 채광", "북향/저층의 은은하고 낮은 채광량", "LIGHT LOW", SOLID_TEXTURES.l3, function() { window.concierge.selectLightLevel('low'); });
                html += '</div></div>';
                break;

            // [Step 2-3b: 빛 차단 희망 (방에서만)]
            case "2-Base-Block":
                html += '<div class="bookmark-stage">';
                html += stepHead('빛을 얼마나 가리고 싶으세요?');
                html += '<div class="bookmark-canvas" style="--items-count: 3;">';
                html += renderBookmarkCard("들어와도 괜찮아요", "은은한 햇살이 스며드는 편이 좋아요", "BLOCK LOW", SOLID_TEXTURES.l1, function() { window.concierge.selectLightBlock('light'); });
                html += renderBookmarkCard("적당히 가려 주세요", "눈부심만 줄이고 아늑하게", "BLOCK MID", SOLID_TEXTURES.l2, function() { window.concierge.selectLightBlock('soft'); });
                html += renderBookmarkCard("완전히 어둡게", "깊은 숙면을 위한 암막", "BLOCK FULL", SOLID_TEXTURES.l4, function() { window.concierge.selectLightBlock('dark'); });
                html += '</div></div>';
                break;

            // [Step 2-4: 희망 분위기 선택]
            case "2-Base-Mood":
                html += '<div class="bookmark-stage">';
                html += stepHead('원하시는 분위기를 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 3; grid-template-rows: repeat(2, 1fr);">';
                html += renderBookmarkCard("소프트 웜", "포근하고 따뜻한 느낌", "MOOD 01", SOLID_TEXTURES.l1, function() { window.concierge.selectMood('soft_warm'); });
                html += renderBookmarkCard("어반 클린", "깔끔하고 도시적인 느낌", "MOOD 02", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectMood('urban_clean'); });
                html += renderBookmarkCard("밸런스 뉴트럴", "어디에나 무난하고 차분한 느낌", "MOOD 03", SOLID_TEXTURES.greige, function() { window.concierge.selectMood('balanced_neutral'); });
                html += renderBookmarkCard("텍스처 린넨", "결이 살아있는 자연스러운 느낌", "MOOD 04", SOLID_TEXTURES.oak, function() { window.concierge.selectMood('textured_linen'); });
                html += renderBookmarkCard("딥 프라이빗", "차분하고 아늑한 프라이빗한 느낌", "MOOD 05", SOLID_TEXTURES.l4, function() { window.concierge.selectMood('deep_private'); });
                html += renderBookmarkCard("에어리 브라이트", "가볍고 환한 느낌", "MOOD 06", SOLID_TEXTURES.cream, function() { window.concierge.selectMood('airy_bright'); });
                html += '</div></div>';
                break;

            // [Step 3: 창호 구성 방식 선택]
            case "3-Config-Style":
                // 공간 종류(방은 빛 차단 희망까지)에 맞는 구성에 "추천" 표시. 카드 순서는 그대로
                const recComp = (typeof recommendComposition === 'function') ? recommendComposition(state.editingRoom) : null;
                const compTag = (key, en) => recComp === key ? `★ 추천 · ${en}` : en;
                html += '<div class="bookmark-stage">';
                html += stepHead('창을 어떻게 구성할까요?');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("호텔식 이중창", "차르르 속지 + 아늑한 겉지 2중 레이어드", compTag('double', "DOUBLE LAYER"), SOLID_TEXTURES.l1, function() { window.concierge.chooseWindowComposition('double'); });
                html += renderBookmarkCard("속지 단독", "화사하고 은은한 채광의 차르르 쉬어", compTag('sheer_only', "SHEER ONLY"), SOLID_TEXTURES.l2, function() { window.concierge.chooseWindowComposition('sheer_only'); });
                html += renderBookmarkCard("겉지 단독", "아늑한 쉼과 빛 차단을 위한 드레이프", compTag('drape_only', "DRAPE ONLY"), SOLID_TEXTURES.l3, function() { window.concierge.chooseWindowComposition('drape_only'); });
                html += renderBookmarkCard("블라인드", "빛의 각도를 조율하는 모던 시스템", compTag('blind_only', "BLIND SHADE"), SOLID_TEXTURES.oak, function() { window.concierge.chooseWindowComposition('blind_only'); });
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

                html += '<div class="bookmark-stage" style="padding: 1.5rem 2rem; box-sizing: border-box;">';
                html += `<div style="display: grid; grid-template-columns: repeat(${Math.max(1, showcaseList.length)}, 1fr); gap: 1.25rem; width: 100%; height: 92vh; align-items: stretch;">`;
                
                showcaseList.forEach((entry, idx) => {
                    const f = entry.f, best = entry.best;
                    const pick = state.colorPick[f.id] || best.color || '';
                    const pickInfo = best.ranked.find(r => r.name === pick);
                    const view = pickInfo ? Object.assign({}, f, { tone: pickInfo.tone || f.tone, manual: Object.assign({}, f.manual, { tone: !!pickInfo.tone || !!(f.manual && f.manual.tone) }) }) : f;
                    const bgStyle = idx === 0 ? SOLID_TEXTURES.l1 : (idx === 1 ? SOLID_TEXTURES.l2 : SOLID_TEXTURES.l3);
                    const tagText = (typeof customerFacts === 'function') ? customerFacts(view) : '';
                    const reasonText = recommendReason(view, state.editingRoom, targetCategory);
                    const pillTag = `[${f.book || '샘플'}] ${queueItem.label}`;
                    const photoTag = `<img class="fabric-photo" alt="" loading="lazy" data-id="${f.id}" data-color="${pick}" data-i="0" src="${fabricPhotoUrls(f.id, pick)[0]}" onerror="window.concierge.imgFallback(this)">`;

                    html += `<div class="bookmark-card" onclick="window.concierge.handleQueueFabricClick('${f.id}')" style="position: relative; width: 100%; height: 100%; cursor: pointer;">`;
                    html += `<div class="bookmark-bg" style="background: ${bgStyle}; pointer-events: none;"></div>`;
                    html += photoTag;
                    html += '<div class="bookmark-gradient" style="pointer-events: none;"></div>';
                    if (best.ranked.length > 0) {
                        // 색상 번호 선택 (눌러서 바꿔 볼 수 있음). 추천 색은 별표로 표시
                        // 색상 번호 선택. 색이 많은 원단(예: 36번까지)은 10개만 먼저 보여주고 "전체 보기"로 모두 펼침
                        const MAX_CHIPS = 10;
                        const expanded = !!(state.colorExpanded && state.colorExpanded[f.id]);
                        const numSort = (x, y) => (/^\d+$/.test(x.name) && /^\d+$/.test(y.name)) ? parseInt(x.name, 10) - parseInt(y.name, 10) : x.name.localeCompare(y.name, 'ko');
                        const base = best.classified ? best.ranked.slice() : best.ranked.slice().sort(numSort);
                        let shown;
                        if (expanded) shown = best.ranked.slice().sort(numSort);
                        else {
                            shown = base.slice(0, MAX_CHIPS);
                            if (pick && !shown.some(r => r.name === pick)) { const pr = best.ranked.find(r => r.name === pick); if (pr) shown = [pr].concat(shown.slice(0, MAX_CHIPS - 1)); }
                        }
                        const bestName = best.classified ? best.ranked[0].name : '';
                        html += '<div class="color-row" onclick="event.stopPropagation()">';
                        html += `<span class="color-row-label">${expanded ? '번호를 눌러 선택하세요' : (best.classified ? '어울리는 색부터' : '색상 번호를 눌러 주세요')}</span>`;
                        html += `<div class="color-chips ${expanded ? 'expanded' : ''}">`;
                        shown.forEach(r => {
                            const star = (r.name === bestName) ? '★' : '';
                            html += `<button class="color-chip ${r.name === pick ? 'active' : ''}" onclick="event.stopPropagation(); window.concierge.pickColor('${f.id}','${r.name}')">${star}${r.name}</button>`;
                        });
                        if (best.ranked.length > MAX_CHIPS) {
                            html += `<button class="color-chip more" onclick="event.stopPropagation(); window.concierge.toggleColors('${f.id}')">${expanded ? '접기 ▲' : `전체 ${best.ranked.length}개 ▼`}</button>`;
                        }
                        html += '</div></div>';
                    }
                    html += '<div class="bookmark-content" style="pointer-events: none;">';
                    html += `<span class="bookmark-tag">${pillTag}</span>`;
                    html += `<h3 class="bookmark-name font-serif-kr">${f.name}${colorSuffix(pick)}</h3>`;
                    if (reasonText) html += `<p class="bookmark-desc" style="font-weight: 600; color: #fff;">${reasonText}</p>`;
                    if (tagText) html += `<p class="bookmark-desc">${tagText}</p>`;
                    html += '</div></div>';
                });

                html += '</div></div>';
                break;

            // [Step 5: 공간 치수 입력]
            case "6-Measure":
                const curRoom = state.editingRoom;
                const hasSheer = curRoom.items.some(i => i.presetType === 'sheer');
                const hasDrape = curRoom.items.some(i => i.presetType === 'drape');
                const hasCurtain = hasSheer || hasDrape;

                html += '<div class="tailor-stage">';
                html += '<div class="tailor-board font-serif-kr" style="max-width: 820px;">';
                html += '<div class="tailor-header">';
                html += '<div>';
                html += '<span style="font-size: 0.75rem; font-weight: 700; color: #91401a; letter-spacing: 0.18em; text-transform: uppercase;">Bespoke Dimensions</span>';
                html += '<h2 style="font-size: 1.8rem; font-weight: 700; color: #2b221a; margin-top: 0.2rem;">공간 치수 입력</h2>';
                html += '</div>';
                html += '<div style="text-align: right;">';
                html += '<span style="font-size: 0.78rem; color: #6f5f4f;">선택 구성</span>';
                html += `<div style="font-size: 1rem; font-weight: 800; color: #91401a;">${curRoom.items.map(i => i.label).join(' + ')}</div>`;
                html += '</div></div>';

                html += '<div class="tailor-inputs-grid">';
                html += '<div id="measureBox_width" class="measure-box" onclick="window.concierge.openKeypad(\'width\')">';
                html += '<span style="font-size: 0.75rem; font-weight: 700; color: #6f5f4f; text-transform: uppercase;">넓이</span>';
                html += `<div style="font-size: 2.8rem; font-weight: 700; color: #2b221a; margin-top: 0.2rem;"><span id="displayVal_width">${curRoom.width}</span> <span style="font-size: 1rem; color: #6f5f4f;">cm</span></div>`;
                html += '<span style="font-size: 0.7rem; color: #6f5f4f;">터치하여 넓이 변경</span>';
                html += '</div>';
                html += '<div id="measureBox_height" class="measure-box" onclick="window.concierge.openKeypad(\'height\')">';
                html += '<span style="font-size: 0.75rem; font-weight: 700; color: #6f5f4f; text-transform: uppercase;">높이</span>';
                html += `<div style="font-size: 2.8rem; font-weight: 700; color: #2b221a; margin-top: 0.2rem;"><span id="displayVal_height">${curRoom.height}</span> <span style="font-size: 1rem; color: #6f5f4f;">cm</span></div>`;
                html += '<span style="font-size: 0.7rem; color: #6f5f4f;">터치하여 높이 변경</span>';
                html += '</div></div>';

                if (hasCurtain) {
                    html += '<div style="text-align: center; font-family: Pretendard, sans-serif; margin-top: 1rem;">';
                    html += '<span style="font-size: 0.72rem; font-weight: 700; color: #6f5f4f; text-transform: uppercase; letter-spacing: 0.1em; display: block; margin-bottom: 0.75rem;">제작 가공 디테일 옵션</span>';
                    html += '<div class="options-chip-row">';
                    if (hasDrape) {
                        html += `<div id="chip_shapeFee" class="option-chip ${curRoom.shapeFee ? 'active' : ''}" onclick="window.concierge.toggleNudgeShapeFee()"><i class="fa-solid fa-check"></i> 형상기억 가공</div>`;
                        html += `<div id="chip_hotelFit" class="option-chip ${curRoom.hotelFit ? 'active' : ''}" onclick="window.concierge.toggleNudgeHotelFit()"><i class="fa-solid fa-check"></i> 호텔핏 (+1폭 볼륨)</div>`;
                    }
                    if (hasSheer) {
                        html += `<div id="chip_leadBand" class="option-chip ${curRoom.leadBand ? 'active' : ''}" onclick="window.concierge.fastToggleOption('leadBand')"><i class="fa-solid fa-check"></i> 하단 리드밴드</div>`;
                    }
                    html += '</div>';
                    html += `<button class="opt-info-link" onclick="window.concierge.showOptionInfo()">옵션을 적용하면 어떻게 달라지나요? <i class="fa-solid fa-chevron-right" style="font-size:0.6rem"></i></button>`;
                    html += '</div>';
                }

                html += '<div style="display: flex; justify-content: center; margin-top: 1.2rem;">';
                html += '<button onclick="window.concierge.commitRoomCart()" style="background: #91401a; color: #fff; border: none; padding: 1.15rem 3.5rem; border-radius: 18px; font-weight: 700; font-size: 0.95rem; cursor: pointer; box-shadow: 0 10px 24px rgba(145,64,26,0.3);">';
                html += `<span>${curRoom.name}에 추가 ✓</span>`;
                html += '</button></div>';

                html += '</div></div>';
                break;

            // [Step 7: Re.dam 순수 명품 스테이셔너리 제안서 뷰]
            case "7-Final-Dossier":
                const configuredList = state.roomsCart.filter(r => r.isConfigured);
                let roomsProductSum = 0;
                let roomCardsHtml = '';

                configuredList.forEach((r, idx) => {
                    roomsProductSum += (r.subtotal || 0);
                    roomCardsHtml += '<div style="background: rgba(255,255,255,0.9); border: 1px solid #e5dcd0; border-radius: 20px; padding: 1.1rem 1.3rem; margin-bottom: 0.75rem; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">';
                    roomCardsHtml += '<div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e5dcd0; padding-bottom: 0.45rem; margin-bottom: 0.5rem;">';
                    roomCardsHtml += `<span style="font-weight: 700; font-size: 1rem;" class="font-serif-kr">${r.name}</span>`;
                    roomCardsHtml += `<span style="font-weight: 800; font-size: 1.05rem; color: #91401a; font-family: monospace;">${(r.subtotal || 0).toLocaleString()}원</span>`;
                    roomCardsHtml += '</div>';
                    const dSummary = (typeof ticketRoomSummary === 'function') ? ticketRoomSummary(r) : '';
                    if (dSummary) roomCardsHtml += `<div style="font-size: 0.72rem; color: #6f5f4f; margin: -0.15rem 0 0.35rem; font-family: Pretendard, sans-serif;">${dSummary}</div>`;

                    r.curtains.forEach(c => {
                        const calcObj = c.calc || {};
                        const itemPrice = calcObj.curtainSubtotal || calcObj.sellingPrice || 0;
                        const bookName = calcObj.fabBook || '샘플북';
                        const fabricName = calcObj.fabName || '원단';

                        const optionBadges = [];
                        if (c.shapeFee > 0) optionBadges.push('형상기억');
                        if (c.hotelFit) optionBadges.push('호텔핏');
                        if (c.leadBand) optionBadges.push('리드밴드');
                        const optText = optionBadges.length > 0 ? ` <span style="color:#6f5f4f; font-size:0.7rem;">(${optionBadges.join(', ')})</span>` : '';

                        roomCardsHtml += '<div style="font-size: 0.8rem; color: #2b221a; display: flex; justify-content: space-between; align-items: center; font-weight: 600; padding: 0.25rem 0;">';
                        roomCardsHtml += `<div><span>• ${c.label}</span> <span style="font-size: 0.74rem; color: #6f5f4f;">[${bookName}] ${fabricName}</span>${optText}</div>`;
                        roomCardsHtml += `<span style="font-family: monospace; color: #91401a; font-weight: 700;">${itemPrice.toLocaleString()}원</span>`;
                        roomCardsHtml += '</div>';
                    });

                    roomCardsHtml += '</div>';
                });

                const finalGrandTotal = roomsProductSum + (state.installFee || 0);

                html += '<div class="tailor-stage" style="width: 100vw; height: 100vh; padding: 1.5rem; box-sizing: border-box; display: flex; align-items: center; justify-content: center;">';
                
                html += '<div style="background: #ffffff; border: 1.5px solid #e5dcd0; border-radius: 32px; padding: 2.4rem; max-width: 580px; width: 100%; box-shadow: 0 24px 60px rgba(43,34,26,0.12); display: flex; flex-direction: column; gap: 1.2rem;" class="font-serif-kr">';
                
                html += '<div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #e5dcd0; padding-bottom: 1rem;">';
                html += '<div>';
                html += '<span style="font-size: 1.65rem; font-weight: 700; color: #2b221a; cursor: pointer;" onclick="window.concierge.staffTap()">Re.dam</span>';
                html += `<span style="display: block; font-size: 0.72rem; text-transform: uppercase; color: #6f5f4f; letter-spacing: 0.15em; margin-top: 0.2rem;">${currentCust ? `${currentCust} 님 맞춤 스타일링 제안서` : 'Bespoke Styling Dossier'}</span>`;
                html += '</div>';
                html += '<div style="text-align: right;">';
                html += `<span style="font-size: 0.78rem; color: #6f5f4f; font-family: monospace;">${new Date().toISOString().slice(0, 10)}</span>`;
                html += '</div></div>';

                html += `<div style="max-height: 42vh; overflow-y: auto; padding-right: 0.3rem;">${roomCardsHtml}</div>`;

                html += '<div style="background: rgba(251,249,245,0.9); border: 1px solid #e5dcd0; border-radius: 18px; padding: 0.8rem 1.1rem; display: flex; justify-content: space-between; align-items: center; font-family: Pretendard, sans-serif;">';
                html += '<div>';
                html += `<span style="font-size: 0.75rem; color: #6f5f4f; font-weight: 700; display: block;">공간 제품 소계: <strong style="color: #2b221a;">${roomsProductSum.toLocaleString()}원</strong></span>`;
                html += '<span style="font-size: 0.7rem; color: #6f5f4f;">전문 피팅 시공 및 1년 무상 A/S</span>';
                html += '</div>';
                html += '<div style="display: flex; align-items: center; gap: 0.4rem;">';
                html += '<span style="font-size: 0.75rem; font-weight: 700; color: #91401a;">시공비:</span>';
                html += `<input type="number" step="5000" value="${state.installFee}" oninput="window.concierge.updateInstallFee(this.value, ${roomsProductSum})" style="width: 90px; padding: 0.35rem 0.5rem; border: 1.5px solid #e5dcd0; border-radius: 10px; font-size: 0.82rem; font-weight: 700; text-align: right; font-family: monospace; outline: none; background: #ffffff;">`;
                html += '<span style="font-size: 0.75rem; font-weight: 700; color: #2b221a;">원</span>';
                html += '</div></div>';

                html += '<div style="border-top: 1.5px solid #e5dcd0; padding-top: 0.9rem; display: flex; justify-content: space-between; align-items: baseline;">';
                html += '<span style="font-size: 0.85rem; font-weight: 700; color: #6f5f4f; text-transform: uppercase;">Total Investment</span>';
                html += '<div style="font-size: 2.1rem; font-weight: 800; color: #91401a; font-family: monospace;">';
                html += `<span id="finalGrandTotalDisplay">${finalGrandTotal.toLocaleString()}</span> <span style="font-size: 1rem; color: #2b221a; font-family: Noto Serif KR; font-weight: 600;">원</span>`;
                html += '</div></div>';

                html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; font-family: Pretendard, sans-serif; margin-top: 0.5rem;">';
                html += '<button onclick="window.concierge.goToSpaceCanvas()" style="background: #ffffff; border: 1.5px solid #e5dcd0; color: #2b221a; padding: 0.95rem; border-radius: 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">← 공간 추가하기</button>';
                html += '<button onclick="window.concierge.openOfficialModal()" style="background: #91401a; border: none; color: #fff; padding: 0.95rem; border-radius: 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 6px 18px rgba(145,64,26,0.3);">견적서 발행</button>';
                html += '</div>';

                html += '</div>';
                html += '</div>';
                break;
        }

        html += '</div>';
        main.innerHTML = html;
    }

    function renderBookmarkCard(title, desc, tag, bgStyle, onClickFn) {
        const id = "bk_" + Math.random().toString(36).substr(2, 9);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.onclick = onClickFn;
        }, 0);

        return `<div id="${id}" class="bookmark-card" style="width: 100%; height: 100%; cursor: pointer;">` +
            `<div class="bookmark-bg" style="background: ${bgStyle}; pointer-events: none;"></div>` +
            '<div class="bookmark-gradient" style="pointer-events: none;"></div>' +
            '<div class="bookmark-content" style="pointer-events: none;">' +
            (tag ? `<span class="bookmark-tag">${tag}</span>` : '') +
            `<h3 class="bookmark-name font-serif-kr">${title}</h3>` +
            `<p class="bookmark-desc">${desc}</p>` +
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
                lightBlock: target.lightBlock || null,
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
            // 방은 "빛을 얼마나 가릴지"를 한 번 더 물어봄 (암막 정도 추천에 사용)
            goToStep(roomTypeOf(state.editingRoom) === '방' ? "2-Base-Block" : "2-Base-Mood");
        },
        selectLightBlock: function(level) {
            state.editingRoom.lightBlock = level;
            goToStep("2-Base-Mood");
        },
        selectMood: function(mood) {
            state.editingRoom.wantMood = mood;
            goToStep("3-Config-Style");
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
            goToStep("3.5-Bridge");
        },
        proceedToFabricQueue: function() {
            goToStep("4-Fabric-Queue");
        },
        toggleColors: function(fabId) {
            state.colorExpanded = state.colorExpanded || {};
            state.colorExpanded[fabId] = !state.colorExpanded[fabId];
            render();
        },
        pickColor: function(fabId, colorName) {
            state.colorPick = state.colorPick || {};
            state.colorPick[fabId] = colorName;
            render();
        },
        handleQueueFabricClick: function(fabId) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            const best = bestColorFor(fabric, state.editingRoom, cat);
            state.colorPick = state.colorPick || {};
            const chosen = state.colorPick[fabId] || best.color || '';
            if (best.ranked.length > 0 && !chosen) {
                if (typeof showToast === 'function') showToast('색상 번호를 먼저 눌러 주세요.', 'info');
                return;
            }
            item.fabricId = fabId;
            item.colorName = chosen;
            state.colorPick = {};
            state.colorExpanded = {};

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
                    roomType: r.roomType || null, lightBlock: r.lightBlock || null, diagnosed: !!r.diagnosed,
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
            goToStep("1-Space", false);
        },
        syncToMaster: function() { syncToV1MasterRooms(); },
        // 자동 저장용: 고객이 완료한 공간만 (계산 결과는 제외)
        getRoomsForSave: function() {
            return state.roomsCart.filter(r => r.isConfigured).map(r => ({
                name: r.name, floorTone: r.floorTone, wallTone: r.wallTone, lightLevel: r.lightLevel, mood: r.mood, wantMood: r.wantMood || null,
                roomType: r.roomType || null, lightBlock: r.lightBlock || null, diagnosed: !!r.diagnosed,
                curtains: r.curtains
            }));
        },
        openOfficialModal: function() {
            syncToV1MasterRooms();
            if (typeof window.openTicketModal === 'function') {
                window.openTicketModal();
            }
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
