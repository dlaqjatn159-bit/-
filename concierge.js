(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['concierge.js']='20261208';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// RE.DAM CONCIERGE V2 INTERACTION CONTROLLER (ZERO COMPROMISE ENGINE)
// ==============================================================

(function() {
    // 130-4: 고객 화면을 여러 파일(intro.js 등)로 나눈 뒤에도 같은 상태·함수를 함께 쓰도록 잇는 다리. 나뉜 파일은 이 파일 다음에 읽힘 (화면 변화 없음)
    const cz = window.conciergeCore = window.conciergeCore || {};
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

    // 속지 느낌 카드 배경: photos/feel/ 의 속지 장면 사진(분위기 사진과 같은 세트, 실제 원단 사진 아님). 사진이 안 뜨면 색 질감이 보임 (10-15)
    //  기기에 같은 이름의 사진을 넣었으면 그것을 먼저 (34번 덧붙임, data.js scenePhotoUrl)
    function sheerFeelBg(name, fallback) {
        return `url('${scenePhotoUrl('feel', name)}') center / cover no-repeat, ${fallback}`;
    }

    // 창 구성·블라인드 종류 카드 배경 (38번): photos/comp/, photos/blind/ 사진. 기기 사진이 있으면 먼저, 안 뜨면 색 질감
    function compBg(name, fallback) {
        return `url('${scenePhotoUrl('comp', name)}') center / cover no-repeat, ${fallback}`;
    }
    // 겉지 결 접사 (117번): 원단 사진이라 기기에만 있음(53번). 없으면 색 질감만 (저장소 주소로 찾지 않음 — 404 방지)
    function texBg(name, fallback) {
        const u = (typeof DevicePhotos !== 'undefined' && DevicePhotos.sceneUrl) ? DevicePhotos.sceneUrl('tex', name) : '';
        return u ? `url('${u}') center / cover no-repeat, ${fallback}` : fallback;
    }
    function blindBg(name, fallback) {
        return `url('${scenePhotoUrl('blind', name)}') center / cover no-repeat, ${fallback}`;
    }

    // 분위기·속지 느낌·창 구성·블라인드 종류 사진을 미리 받기: 앱을 켜면 뒤에서 받아 두고 decode(그릴 준비)까지 끝내 둠
    // → 화면이 열리자마자 사진이 있어서 "색 바탕 → 사진" 깜빡임이 없음 (10-15, 38번)
    let lastRenderedStep = null;      // 최종 제안의 쪽 번호·크게 보기 값은 final.js로 옮김 (130-4③)
    const PICK_PAUSE_MS = 250;      // 고르고 다음 화면으로 넘어가기 전 쉬는 시간(밀리초). 모든 화면 하나(137번). 450일 때 "렉 같다"는 말이 있어 줄였고(10-15), 점이 맺히는 0.2초보다 조금 길게
    const PICK_LEAVE_MS = 200;      // 140번: 고른 뒤 지금 화면이 걷히는 시간
    // 137번: 한 번 누르면 고름 — 점 + 나머지 옅게 → PICK_PAUSE_MS 뒤 넘어감. 머무는 동안 다른 것을 누르면 그것으로 바뀌고 시간이 다시 시작
    let pickTimer = null;
    function pickThenGo(el, group, sel, fn) {
        clearTimeout(pickTimer);
        group.querySelectorAll(sel).forEach(x => { x.classList.remove('is-picked'); x.removeAttribute('aria-pressed'); });
        el.classList.add('is-picked');
        el.setAttribute('aria-pressed', 'true');
        group.classList.add('has-pick');
        const step = state.step, idx = state.currentItemIndex;
        const still = () => el.isConnected && state.step === step && state.currentItemIndex === idx;      // 그사이 뒤로 갔으면 넘어가지 않음
        // 140번: 화면이 한순간에 사라지면 끊겨 보임 → 지금 화면을 0.2초 서서히 걷은 뒤 넘어감
        pickTimer = setTimeout(() => {
            if (!still()) { pickTimer = null; return; }
            // 143번: 사진 화면(사진 칸)은 걷지 않음 — 큰 사진이 흐려지며 넘어가면 어색함. 고른 사진 그대로 두고 바로 다음 화면으로
            const page = group.classList.contains('bookmark-canvas') ? null : el.closest('.stage-transition');
            if (page) page.classList.add('is-leaving');
            pickTimer = setTimeout(() => { pickTimer = null; if (still()) fn(); else if (page) page.classList.remove('is-leaving'); }, page ? PICK_LEAVE_MS : 0);
        }, PICK_PAUSE_MS);
    }
    const FEEL_PHOTOS = SCENE_PHOTOS.feel;   // 속지 느낌 3장도 같이 미리 받음 (10-15)
    const COMP_PHOTOS = SCENE_PHOTOS.comp || [];   // 창 구성 4장 (38-1)
    const BLIND_PHOTOS = SCENE_PHOTOS.blind || []; // 블라인드 종류 4장 (38-2)
    (function preloadMoodPhotos() {
        // 기기 사진을 다 읽은 뒤, 기기에 있는 것은 기기 사진을 (34·38번)
        const run = () => DevicePhotos.ready.then(() => []
            .concat(FEEL_PHOTOS.map(n => scenePhotoUrl('feel', n)))
            .concat(COMP_PHOTOS.map(n => scenePhotoUrl('comp', n)))
            .concat(BLIND_PHOTOS.map(n => scenePhotoUrl('blind', n)))
            .forEach(src => {
                const im = new Image();
                im.src = src;
                if (im.decode) im.decode().catch(() => {});
            }));
        // 첫 화면 그리기를 방해하지 않게 한가할 때 받음 (구형 브라우저는 1초 뒤)
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 }); else setTimeout(run, 1000);
    })();
    // 사진 6장은 895×2130(가로:세로 약 0.42)으로 잘라 둠: 바닥과 벽이 만나는 선이 위에서 85% 지점(벽:바닥 = 8.5:1.5)으로 모두 같고, 사물은 가운데에서 아주 조금 오른쪽.
    // 칸(약 0.34)이 더 좁으니 세로가 칸에 딱 맞고 좌우만 조금 잘림 → 바닥선 높이가 칸마다 같음 (10-15 사장님)

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

    // 블라인드 원단인지 (88번)
    function isBlindItem(f) {
        return !!f && (f.categoryType === "블라인드" || f.calcType === "hebe");
    }

    // 손님 추천 후보: 잰 색값(밝기·붉은기·노란기)이 있는 색이 하나라도 있는 원단만 (92번: 색 없이는 추천하지 않음. 원단 찾기에는 그대로)
    function getLiveCategoryPool(categoryType) {
        const list = getCategoryPoolAll(categoryType);
        return (typeof fabricHasLabColor === 'function') ? list.filter(fabricHasLabColor) : list;
    }
    function getCategoryPoolAll(categoryType) {
        // 고객 추천에서 숨긴 원단(예: 비고 "원단만 시킬때")은 빼고 고름. 직원 화면 빠른 견적에는 그대로 있음
        const all = getLiveDb();
        let pool = (typeof isCustomerHidden === 'function') ? all.filter(f => !isCustomerHidden(f)) : all;
        // 56번 합치기 전 삼보텍스·콤비처럼 같은 블라인드가 둘이면 대표 하나만 (58번). 견적은 고른 원단 그대로
        if (typeof fabricTwinDedupe === 'function') pool = fabricTwinDedupe(pool);

        if (categoryType === "블라인드") {
            const blindPool = pool.filter(f => f.categoryType === "블라인드" || f.calcType === "hebe" || (f.name && (f.name.includes("블라인드") || f.name.includes("콤비") || f.name.includes("우드"))));
            if (blindPool.length > 0) return blindPool;
        }

        if (categoryType === "속지") {
            const sheerPool = pool.filter(f => !isBlindItem(f) && (f.categoryType === "속지" || (f.name && (f.name.includes("쉬폰") || f.name.includes("차르르")))));
            if (sheerPool.length > 0) return sheerPool;
        }

        if (categoryType === "겉지") {
            // 블라인드 암막(BLISS B/O 등)이 이름에 "암막"이 있다고 겉지 후보에 끼지 않게 (88번)
            const drapePool = pool.filter(f => !isBlindItem(f) && (f.categoryType === "겉지" || f.calcType === "width" || (f.name && (f.name.includes("암막") || f.name.includes("린넨")))));
            if (drapePool.length > 0) return drapePool;
        }

        return pool;
    }

    // 판매가 계산은 직원 화면과 같은 엔진(pricing.js)을 사용합니다.
    function calculateV1ItemPrice(c) {
        const fab = window.Pricing.pickFabric(getLiveDb(), c.fabricId) || {};      // 원단 없음이면 금액 0 (126번)
        const p = window.Pricing.priceItem(c, fab.id ? fab : null);
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
            wantMood: r.wantMood || null, colorStrength: r.colorStrength || null, colorAccent: r.colorAccent || null,
            roomType: r.roomType || null,
            lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, ownTaste: !!r.ownTaste, ownPres: r.ownPres || null, ownTex: r.ownTex || null, pointTech: r.pointTech || null,      // 이 공간만 다르게 (115번, 고객 화면을 다녀와도 남게)
            diagnosed: !!r.diagnosed,
            measuredColor: r.measuredColor || null,      // 직원 화면 "방 색 재기"로 잰 벽·바닥 색 (room-color.js)
            width: r.width || null, height: r.height || null, spaceWidth: Number(r.spaceWidth) || null, spaceHeight: Number(r.spaceHeight) || null, sizeMode: r.sizeMode || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),      // 공간 추가 때 정한 크기·색 출처 (중심 화면)
            curtains: r.curtains.map((c, cIdx) => {
                const isBlind = c.presetType === "blind";
                let realFab = window.Pricing.pickFabric(liveDb, c.fabricId);
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
                    pickDir: c.pickDir || null, toneStep: c.toneStep || 0,      // 원단을 고른 이유 카드 (28번)
                    baseFabricId: c.baseFabricId || null, baseColorName: c.baseColorName || null,      // 한 톤 3단계 사다리 기준점 (49번)
                    aiPick: c.aiPick || null, staffPick: c.staffPick || null, staffPicked: !!c.staffPicked, changeReason: c.changeReason || null, custPicked: !!c.custPicked,      // 세 픽·바꾼 이유·손님이 고른 원단 (116번)
                    rates: c.rates ? JSON.parse(JSON.stringify(c.rates)) : undefined,      // 품목을 만들 때의 가공·부자재 단가 (29번, 빠지면 금액이 바뀜)
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

    function goToStep(nextStep, pushHistory, fwd) {
        hideKeypadDirectly();
        state.pointPreview = null;      // 146번: 다른 화면으로 가면 포인트 설명은 닫음
        // 몇 번째 칸(속지·겉지)이었는지도 같이 적어 둠 → 뒤로 가면 겉지에서 속지 고르기로 돌아감
        if (pushHistory !== false && state.step !== nextStep) {
            stepHistory.push({ step: state.step, idx: state.currentItemIndex, room: state.editingRoom, roomId: state.editingRoomId });      // 119번: 집 전체로 넘어가면 공간이 바뀌므로 그때의 공간도 같이 적어 둠
        }
        state.step = nextStep;
        introWant = (pushHistory !== false || !!fwd) && PHOTO_INTRO_STEPS.includes(nextStep);      // 사진 화면 앞 안내 장면은 앞으로 갈 때만 (뒤로 오면 건너뜀, 73번)
        updatePrevButtonVisibility();
        render();
    }

    // 수정하기에서 카드로 벽·바닥을 고른 뒤: 그 부분의 잰 색은 카드로 바뀌므로 지우고, 수정하기 화면으로 돌아감
    function pickInEdit(part) {
        const ed = state.editingRoom, mc = ed.measuredColor;
        if (mc) { mc[part] = null; mc.bridge = null; if (!mc.wall && !mc.floor && !hasFurniture(mc)) ed.measuredColor = null; }      // 가구 색(37번)은 남김
        ed.cardParts = Object.assign({}, ed.cardParts, { [part]: true });      // 카드로 고른 부분 (벽·바닥 따로)
        ed.colorSrc = null;           // 잰 색과 카드가 섞이면 "벽은 잰 색 · 바닥은 카드로"처럼 따로 적음
        if (stepHistory.length && stepHistory[stepHistory.length - 1].step === "1-Space-Edit") stepHistory.pop();
        goToStep("1-Space-Edit", false);
    }
    // 공간 안에서 바닥·벽 카드를 고름: 잰 색과 다른 카드를 고르면 그 부분은 카드로 바뀜(잰 색을 지움 → 색 잇기는 건너뜀). 같은 카드면 잰 색 그대로
    function cardPickInRoom(part, tone) {
        const ed = state.editingRoom, mc = ed.measuredColor;
        if (mc && mc[part]) {
            if (mc[part].tone === tone) return;
            mc[part] = null; mc.bridge = null;
            if (!mc.wall && !mc.floor && !hasFurniture(mc)) ed.measuredColor = null;
            ed.colorSrc = null;
        }
        ed.cardParts = Object.assign({}, ed.cardParts, { [part]: true });
    }
    // 중심 화면으로 돌아감: 그 뒤에 쌓인 단계(수정하기 등)는 뒤로 가기 목록에서 지움
    function backToSpace() {
        while (stepHistory.length && stepHistory[stepHistory.length - 1].step !== "1-Space") stepHistory.pop();
        if (stepHistory.length) stepHistory.pop();
        goToStep("1-Space", false);
    }

    function prevStep() {
        if (state.pointPreview) { state.pointPreview = null; render(); return; }      // 146번: 포인트 설명에서 ← 는 방식 목록으로
        if (state.step === "7-Final-Dossier" && finalPageNow() > 0) { setFinalPage(finalPageNow() - 1); return; }      // 견적서 쪽에서 ← 는 먼저 앞 쪽으로
        hideKeypadDirectly();
        if (stepHistory.length > 0) {
            const prev = stepHistory.pop();
            state.currentItemIndex = prev.idx || 0;
            if ('room' in prev) {      // 119번: 그 화면을 보던 공간으로 되돌림
                state.editingRoom = prev.room; state.editingRoomId = prev.roomId;
                if (prev.room && prev.room.items && prev.room.items.length) state.pendingItemQueue = prev.room.items;
            }
            goToStep(prev.step, false);
        }
    }

    function updatePrevButtonVisibility() {
        const btn = document.getElementById("v2FloatingPrevBtn");
        if (!btn) return;
        const canGoBack = stepHistory.length > 0;
        btn.style.display = canGoBack ? "" : "none";
    }

    // 화면 위 가운데: 지금 무엇을 고르는지 짧은 질문 + 진행 점
    function roomTypeOf(room) {
        return String((room && (room.roomType || room.name)) || '').replace(/\s*\d+$/, '');
    }
    // 공간 안 흐름 (117번): (벽·바닥을 모르는 공간만 바닥·벽 카드) → 빛 가림 → 바깥 시선 → 구성 제안
    //   → (집에서 처음 속지가 들어갈 때만 속지 결) → (블라인드면 종류) → 원단 → 마무리(옵션)
    function diagnosisSteps() {
        const ed = state.editingRoom || {}, items = ed.items || [];
        const steps = ed.askCards ? ["2-Base-Floor", "2-Base-Wall"] : [];
        steps.push("2-Base-Block", "2-Base-Privacy", "3-Config-Style");
        if (state.step === "2-Base-SheerFeel" || ed.askSheer) steps.push("2-Base-SheerFeel");
        if (state.step === "2-Base-BlindKind" || items.some(i => i.presetType === 'blind')) steps.push("2-Base-BlindKind");
        return steps;
    }
    // 우리 집 취향 (117번): 집에 한 번. 이 공간만 다르게 고칠 때(state.tasteFor === 'room')는 같은 화면을 그 공간 값으로 씀
    function houseTasteNow() { return (typeof getHouseTaste === 'function') ? getHouseTaste() : {}; }
    // 123번: 취향은 공간마다(원단 고르기 직전). 길잡이로 온 공간(flow)도 그 공간 값으로 — 뒤로 가기로 돌아와도 같음
    function tasteRoom() { const ed = state.editingRoom; return ed && (state.tasteFor === 'room' || ed.flow) ? ed : null; }
    function tasteNow() {
        const ht = houseTasteNow(), ed = tasteRoom();
        if (ed) return { pres: ed.ownTaste ? ed.ownPres : null, tex: ed.ownTaste ? ed.ownTex : null };
        return ht;
    }
    // 속지 결은 집에서 처음 속지가 들어가는 공간에서 한 번만 물음 (117번 — 속지 없는 집은 묻지 않음)
    function needSheerTaste(ed) {
        return !!(ed && (ed.items || []).some(i => i.presetType === 'sheer') && !houseTasteNow().sheer);
    }
    function stepAfterComp(ed) {
        if (needSheerTaste(ed)) { ed.askSheer = true; return "2-Base-SheerFeel"; }
        return (ed.items || []).some(i => i.presetType === 'blind') ? "2-Base-BlindKind" : "3.5-Bridge";
    }
    // 공간 → 질문·원단 화면에서 쓰는 사본 (openRoomCart에서 꺼냄, 119번 길잡이도 씀)
    function loadEditing(target) {
        const ed = {
            id: target.id,
            name: target.name,
            floorTone: target.floorTone || 'warm',
            wallTone: target.wallTone || 'cool',
            lightLevel: target.lightLevel || 'mid',
            mood: target.mood || 'soft_warm',
            wantMood: target.wantMood || null, colorStrength: target.colorStrength || null, colorAccent: target.colorAccent || null,
            roomType: target.roomType || roomTypeOf(target),
            lightBlock: target.lightBlock || null, privacy: target.privacy || null, sheerFeel: target.sheerFeel || null, blindWant: target.blindWant || null,
            ownTaste: !!target.ownTaste, ownPres: target.ownPres || null, ownTex: target.ownTex || null, pointTech: target.pointTech || null,      // 이 공간만 다르게 (117번)
            measuredColor: target.measuredColor ? JSON.parse(JSON.stringify(target.measuredColor)) : null,     // 카드로 고치면 그 부분을 지우므로 복사본
            colorSrc: target.colorSrc || null,
            cardParts: target.cardParts ? Object.assign({}, target.cardParts) : null,
            diagnosed: !!target.diagnosed,
            linkDir: target.linkDir || null,
            windowDir: windowDirOf(target.windowDir),      // 창 방향 (35번)
            width: Number(target.width) || 0,          // 수정하기·공간 추가에서 적은 크기가 있으면 그것부터 (41번)
            height: Number(target.height) || 0, // 41번
            sizeKnown: !!(Number(target.width) && Number(target.height)),      // 공간 추가 때 크기를 적었으면 원단 뒤에는 옵션(마무리)만
            shapeFee: true,
            hotelFit: true,
            leadBand: false,      // 139번: 밑단 기본은 시접 (리드밴드는 고를 때만)
            items: []
        };
        if (target.isConfigured && target.curtains && target.curtains.length > 0) {
            const first = target.curtains[0];
            ed.width = Number(first.width) || 340;
            ed.height = Number(first.height) || 235;
            ed.shapeFee = target.curtains.some(c => c.shapeFee > 0);
            ed.hotelFit = target.curtains.some(c => c.hotelFit);
            ed.leadBand = target.curtains.some(c => c.leadBand);
        }
        // "수정"으로 들어온 공간(질문을 거쳐 만든 공간만): 지난번 답을 기억해 두었다가 질문 화면에 회색으로 표시
        if (target.isConfigured && target.diagnosed) {
            const kinds = (target.curtains || []).map(c => c.presetType);
            const comp = kinds.includes('blind') ? 'blind_only'
                : (kinds.includes('sheer') && kinds.includes('drape')) ? 'double'
                : kinds.includes('sheer') ? 'sheer_only' : (kinds.includes('drape') ? 'drape_only' : null);
            ed.prev = {
                floorTone: target.floorTone, wallTone: target.wallTone, lightLevel: target.lightLevel,
                lightBlock: target.lightBlock || null, privacy: target.privacy || null,
                wantMood: target.wantMood || null, colorStrength: target.colorStrength || null, colorAccent: target.colorAccent || null, sheerFeel: target.sheerFeel || null, blindWant: target.blindWant || null, comp, linkDir: target.linkDir || null
            };
        }
        return ed;
    }
    // ---- 152번: 공간별 진행 — 공간 하나를 처음부터 끝까지 묻고, 마치면 중심 화면 ----
    //  (못 잰 공간만 바닥·벽 카드) → 빛 가림 → 바깥 시선 → 구성 → 느낌 → 겉지 질감 → 속지 질감 → 블라인드 종류 → 원단 → 마무리 → 중심 화면
    //  다음 공간은 중심 화면에서 공간 칸을 누르거나 아래 버튼으로 (하다 만 공간 → 누른 공간 → 목록 첫 공간)
    const COMP_KINDS = { double: ['sheer', 'drape'], sheer_only: ['sheer'], drape_only: ['drape'], blind_only: ['blind'] };
    function todoRooms() { return state.roomsCart.filter(r => !r.isConfigured); }
    function askedRoom(r) { return !!(r && r.lightBlock && r.privacy); }
    function planHas(r, kind) { return !!(r && r.planComp && COMP_KINDS[r.planComp] && COMP_KINDS[r.planComp].includes(kind)); }
    // 138번: 앱이 구성을 권하지 않음 — 손님이 공간마다 구성 사진 화면에서 직접 고름(자동 채우기 없앰)
    // 집에 들어가는 것: 상담을 마친 공간은 고른 품목, 아직인 공간은 정한 구성으로
    function houseHas(kind) {
        return state.roomsCart.some(r => r.isConfigured ? (r.curtains || []).some(c => c.presetType === kind) : planHas(r, kind));
    }
    // 이 칸에서 고를 수 있는 포인트 기법 (120번): 포인트 공간(무게감 제외)의 겉지·블라인드만
    function pointTechsFor(item) {
        const ed = state.editingRoom;
        if (!ed || !item || (item.presetType !== 'drape' && item.presetType !== 'blind') || !roomHasLab(ed)) return [];
        const eff = roomWithTaste(Object.assign({}, ed, { pointTech: null }));
        if (!eff || eff.colorStrength !== 'point' || eff.colorAccent !== 'point') return [];
        return (typeof pointTechOptions === 'function') ? pointTechOptions(ed.measuredColor, item.presetType === 'blind' ? '블라인드' : '겉지') : [];
    }
    function canPointRoom(r) { return planHas(r, 'drape') || planHas(r, 'blind') || (r.curtains || []).some(c => c.presetType === 'drape' || c.presetType === 'blind'); }
    // 다음에 할 일 { kind: 'ask' | 'comp' | 'houseComp' | 'pres' | 'tex' | 'sheer' | 'blind' | 'fabric', room } — 없으면 null(모두 마침)
    function flowPeek() {
        const todo = todoRooms();
        if (!todo.length) return null;
        // 152번: 공간 하나를 먼저 정함 — 하다 만 공간 → 중심 화면에서 누른 공간 → 목록 첫 공간
        const begun = x => !!(x.lightBlock || x.privacy || x.compOk || x.ownTaste);
        const r = todo.find(begun) || todo.find(x => x.id === state.activeSpaceId) || todo[0];
        if (!askedRoom(r)) return { kind: 'ask', room: r };
        if (!r.compOk || !r.planComp) return { kind: 'comp', room: r };      // 138번: 공간마다 구성 사진 화면
        // 123번: 커튼 느낌 · 겉지 질감 · 속지 질감 · 블라인드 종류는 공간마다, 그 공간 원단 고르기 바로 앞에서 (빈 화면으로 새로)
        if (!(r.ownTaste && r.ownPres)) return { kind: 'pres', room: r };
        if (planHas(r, 'drape') && !(r.ownTaste && r.ownTex)) return { kind: 'tex', room: r };
        if (planHas(r, 'sheer') && !r.sheerFeel) return { kind: 'sheer', room: r };
        if (planHas(r, 'blind') && !r.blindWant) return { kind: 'blind', room: r };
        return { kind: 'fabric', room: r };
    }
    // 화면을 옮기며 공간도 바꿈: 뒤로 가기 목록에는 옮기기 전 공간을 적어 둠
    function flowGo(step, ed, roomId, prep) {
        if (state.step !== step || state.editingRoom !== ed) stepHistory.push({ step: state.step, idx: state.currentItemIndex, room: state.editingRoom, roomId: state.editingRoomId });
        state.editingRoom = ed || null;
        state.editingRoomId = ed ? roomId : null;
        state.tasteFor = null;
        if (prep) prep();
        goToStep(step, false, true);
    }
    function flowNext() {
        const nx = flowPeek();
        if (!nx) { flowGo("1-Space", null); return; }
        if (nx.kind === 'ask') {
            const ed = loadEditing(nx.room);
            ed.flow = true;
            ed.askCards = !(roomPart(nx.room, 'wall') && roomPart(nx.room, 'floor'));      // 색을 못 잰 공간만 바닥·벽 카드
            flowGo(ed.askCards ? "2-Base-Floor" : "2-Base-Block", ed, nx.room.id);
            return;
        }
        if (nx.kind === 'comp') { openCompFor(nx.room); return; }
        if (nx.kind === 'fabric') { startFabric(nx.room); return; }
        if (nx.room) {      // 123번: 그 공간의 취향 화면 (느낌 · 겉지 결 · 속지 결 · 블라인드 종류)
            const ed = loadEditing(nx.room);
            ed.flow = true;
            const ROOM_STEP = { pres: "0.5-House-Taste", tex: "0.6-House-Tex", sheer: "2-Base-SheerFeel", blind: "2-Base-BlindKind" };
            flowGo(ROOM_STEP[nx.kind], ed, nx.room.id, () => { if (nx.kind === 'pres' || nx.kind === 'tex') state.tasteFor = 'room'; });
            return;
        }
    }
    // 한 공간 구성 사진 화면 (138번: 공간마다 차례로)
    function openCompFor(room) {
        const ed = loadEditing(room);
        ed.flow = true;
        if (room.planComp && room.planPicked) ed.prev = Object.assign({}, ed.prev, { comp: room.planComp });
        flowGo("3-Config-Style", ed, room.id);
    }
    // ⑤ 원단: 정한 구성으로 품목을 만들고 "골랐습니다" 화면부터
    function startFabric(room) {
        const ed = loadEditing(room);
        ed.flow = true;
        setCompItems(ed, room.planComp || 'double');
        const hs = houseTasteNow().sheer;      // 123번: 공간 답이 먼저, 없으면 예전 집 답
        ed.sheerFeel = planHas(room, 'sheer') ? (room.sheerFeel || { smooth: 'smooth', texture: 'textured', thick: 'cozy', unknown: 'any' }[hs] || null) : null;
        flowGo("3.5-Bridge", ed, room.id, () => { state.pendingItemQueue = ed.items; state.currentItemIndex = 0; });
    }
    // ② 질문 답(과 카드로 고친 벽·바닥)을 공간에 담아 둠 — 아직 상담 전 공간 그대로
    function saveDraft(ed) {
        const t = state.roomsCart.find(r => r.id === state.editingRoomId);
        if (!t || !ed) return;
        ['lightBlock', 'privacy', 'floorTone', 'wallTone', 'colorSrc'].forEach(k => { t[k] = ed[k] || null; });
        t.cardParts = ed.cardParts || null;
        t.measuredColor = ed.measuredColor || null;
    }
    // 이 공간만 다르게(취향)를 공간에 바로 담음
    function saveOwnTaste(ed) {
        const t = ed && ed.flow && state.roomsCart.find(r => r.id === state.editingRoomId);
        if (!t) return;
        t.ownTaste = !!ed.ownTaste; t.ownPres = ed.ownPres || null; t.ownTex = ed.ownTex || null;
    }
    // 뒤로 가기 목록에서 그 화면까지 걷어 내고 돌아감 (그때의 공간으로)
    function backTo(step) {
        while (stepHistory.length && stepHistory[stepHistory.length - 1].step !== step) stepHistory.pop();
        const e = stepHistory.pop();
        if (e && 'room' in e) { state.editingRoom = e.room; state.editingRoomId = e.roomId; }
        state.tasteFor = null;
        goToStep(step, false);
    }
    // 구성 → 품목 (예전 chooseWindowComposition에서 꺼냄)
    function setCompItems(ed, type) {
        const rName = ed.name;
        const one = (k, w) => ({ label: `${rName} ${w}`, presetType: k, fabricId: null, floorGap: 0 });
        if (type === 'double') { ed.items = [one('sheer', '속지'), one('drape', '겉지')]; ed.blindWant = null; }
        else if (type === 'sheer_only') { ed.items = [one('sheer', '속지')]; ed.blindWant = null; }
        else if (type === 'drape_only') { ed.items = [one('drape', '겉지')]; ed.sheerFeel = null; ed.blindWant = null; }
        else if (type === 'blind_only') { ed.items = [one('blind', '블라인드')]; ed.sheerFeel = null; }
    }
    // 고른 블라인드 종류가 지금 단가표 목록에 있는지 확인 (우드·알루미늄처럼 아직 목록에 없으면 실물 샘플 안내로, 38-2)
    function hasBlindKindInPool(want) {
        if (!want || want === 'any') return true;
        return getLiveCategoryPool('블라인드').some(f => typeof blindKind === 'function' && blindKind(f) === want);
    }
    // 색 잇기를 물을 수 있는 공간: 벽·바닥을 둘 다 잰 색이 있음(카드로만 고른 공간은 아님). 블라인드도 물음 (92번: 블라인드 색값 다 들어 있음)
    // 벽·바닥 모두 잰 색값(밝기·붉은기·노란기)이 있는지 (92번)
    function roomHasLab(ed) {
        const mc = ed && ed.measuredColor, ok = c => !!c && typeof c.L === 'number' && typeof c.a === 'number' && typeof c.b === 'number';
        return !!(mc && ok(mc.wall) && ok(mc.floor));
    }
    const LINK_WORD = { wall: '벽과 톤을 맞춰 넓어 보이는 색', bridge: '벽과 바닥의 중간 톤', floor: '바닥 톤을 따르는 색', fur0: '아끼시는 가구와 톤을 맞춘 색', fur1: '아끼시는 가구와 톤을 맞춘 색', fur2: '아끼시는 가구와 톤을 맞춘 색' }; // 41번 · 98번(가구)
    const LINK_WHY = { wall: '커튼이 벽에 자연스럽게 어우러져 공간이 넓어 보입니다.', bridge: '벽과 바닥을 조화롭게 감싸 주어 공간이 차분하게 하나로 보입니다.', floor: '바닥과 같은 계열의 색이라 따뜻하고 안정감 있습니다.' }; // 41번 · 83번
    // 글 질문 화면 ("제안합니다" 화면과 같은 분위기): 큰 질문 + 글자 선택지. 사진이 필요 없는 질문에 사용
    // 화면 규칙표 (73번): 선택지는 이름만(설명은 사장님이 말로), "잘 모르겠어요"·"지금은 못 재요" 같은 조용한 보조 행동(quiet)은 아래 작게. 공간 이름은 왼쪽 위 뒤로 가기에
    // 152번: 공간이 둘 이상인 상담 흐름에서 질문 첫머리 공간 이름 — "안방은" / "거실은"(받침으로 은·는). 아니면 빈 글
    function roomTopic(ed) {
        const nm = String((ed && ed.name) || '');
        if (!(ed && ed.flow && state.roomsCart.length > 1 && nm)) return '';
        const code = nm.charCodeAt(nm.length - 1) - 0xAC00;
        return nm + (code >= 0 && code < 11172 && code % 28 ? '은' : '는');
    }
    function askStage(question, sub, opts, o) {
        o = o || {};
        let h = '<div class="ambient-stage ask-stage">' + progHtml();
        if (o.top) h += o.top;
        h += `<h2 class="q-title font-serif-kr">${question}</h2>`;
        if (sub) h += `<p class="q-sub">${sub}</p>`;
        if (o.extra) h += o.extra;
        const main = opts.filter(op => !op.quiet), quiet = opts.filter(op => op.quiet);
        h += `<div class="ask-opts${main.length > 4 ? ' is-many' : ''}">`;
        main.forEach(op => {
            h += `<button type="button" class="ask-opt${op.rec ? ' is-rec' : ''}${op.was ? ' was-picked' : ''}" onclick="window.concierge.tapAskOpt(this, function(){ ${op.on} })"><span class="ask-label font-serif-kr">${op.label}</span>${op.extra || ''}</button>`;
        });
        h += '</div>';
        if (quiet.length) h += '<div class="ask-quiet">' + quiet.map(op => `<button type="button" class="r-quiet${op.was ? ' was-picked' : ''}" onclick="window.concierge.tapAskOpt(this, function(){ ${op.on} })">${op.label}</button>`).join('') + '</div>';
        h += '</div>';
        return h;
    }
    // ---- 화면 규칙표 (73번): 진행 선 · 뒤로 가기 · 사진 화면 앞 안내 장면 ----
    // 진행 선: 화면 맨 위 가는 선(흙빛이 차오름). 공간 추가(종류 → 크기 → 색)와 공간 상담(질문들 → 원단 → 마무리)을 따로 셈
    const ADD_STEPS = ["1.5-Room-Type", "1.6-Add-Size", "1.7-Add-Same", "1.8-Add-Dir"];
    // 152번: 공간별 진행 — 진행 선 = (마친 공간 + 이 공간에서 간 만큼) ÷ 공간 수. 숫자는 한 공간 안에서 간 만큼(0~1)
    const FLOW_PHASE = { "2-Base-Floor": 0.05, "2-Base-Wall": 0.1, "2-Base-Block": 0.15, "2-Base-Privacy": 0.25, "3-Config-Style": 0.35,
        "0.5-House-Taste": 0.45, "0.6-House-Tex": 0.5, "2-Base-SheerFeel": 0.55, "2-Base-BlindKind": 0.6, "3.5-Bridge": 0.65, "4-Fabric-Queue": 0.75, "6-Finish": 0.9 };
    function flowProg() {
        const ed = state.editingRoom, ph = FLOW_PHASE[state.step];
        if (ph == null || (ed && !ed.flow)) return null;
        const list = state.roomsCart, n = Math.max(1, list.length);
        return (list.filter(r => r.isConfigured).length + ph) / n;
    }
    function progHtml() {
        const fp = flowProg();
        if (fp != null) return `<div class="r-prog"><i style="width:${Math.round(fp * 100)}%"></i></div>`;
        let steps = ADD_STEPS, at = steps.indexOf(state.step);
        if (at < 0) { steps = diagnosisSteps().concat(["3.5-Bridge", "4-Fabric-Queue", "6-Finish"]); at = steps.indexOf(state.step); }
        if (at < 0) return '';
        return `<div class="r-prog"><i style="width:${Math.round((at + 1) / steps.length * 100)}%"></i></div>`;
    }
    // 뒤로 가기는 늘 왼쪽 위 한 곳: 공간 안에서는 "← 공간 이름"(위치 표시 겸함), 사진 화면은 종이색 작은 네모 "←"
    const PHOTO_STEPS = ["0.6-House-Tex", "2-Base-Floor", "2-Base-Wall", "3-Config-Style", "2-Base-SheerFeel", "2-Base-BlindKind", "4-Fabric-Queue"];      // 117번: 결·구성·속지 결도 사진 화면
    const NO_ROOM_STEPS = ["0-Start", "0-Welcome", "0.5-House-Taste", "0.6-House-Tex", "1-Space", "1.5-Room-Type", "7-Final-Dossier"];
    function syncBack(photo) {
        const btn = document.getElementById("v2FloatingPrevBtn");
        if (!btn) return;
        const nm = !NO_ROOM_STEPS.includes(state.step) && state.editingRoom && state.editingRoom.name;
        btn.textContent = `← ${nm ? nm + (state.step === "1-Space-Edit" ? ' · 수정하기' : '') : '이전'}`;      // 사진 화면도 같은 "← 공간 이름" (107번)
        btn.classList.toggle('is-tab', !!photo);
        btn.setAttribute('aria-label', '뒤로');
    }
    // 사진 화면 앞 안내 장면: 종이 화면에 질문 한 줄 → 흰빛이 차오름 → 사진이 흐릿하고 밝은 상태에서 또렷해짐 (로고 모션의 뜻만, 점은 안 씀)
    //  그 공간의 첫 사진 화면은 글자가 흰빛 속에서 살구빛을 거쳐 먹색으로 맺히고(약 3.4초), 그다음은 글자가 그냥 나타남(약 2.2초)
    //  누르지 않아도 넘어가고, 안내 중 아무 데나 누르면 바로 사진으로. 시간(밀리초)은 여기 한 곳에서 조절
    const PHOTO_INTRO = { firstText: 700, firstHold: 500, nextText: 250, nextHold: 350, veil: 450, focus: 450 };      // 140번(B-6): 첫 1.2초 · 다음 0.6초 · 맺힘 0.45초
    const PHOTO_INTRO_STEPS = ["0.6-House-Tex", "2-Base-Floor", "2-Base-Wall", "3-Config-Style", "2-Base-SheerFeel", "2-Base-BlindKind"];      // 원단 화면은 원단 고르는 한 화면(140번)이 이미 앞에 있음
    let introWant = false, introRoomKey = null, introTimers = [], photoQuestion = '';
    // 안내 장면(1~2초) 동안은 뒤로를 숨김 — 지나가는 장면이라 누를 일이 없음 (74번)
    function quietBack(on) { const btn = document.getElementById("v2FloatingPrevBtn"); if (btn) btn.classList.toggle('is-quiet', !!on); }
    function stopPhotoIntro() {
        introTimers.forEach(clearTimeout);
        introTimers = [];
        quietBack(false);
        ['photoIntro', 'photoVeil'].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
    }
    function playPhotoIntro(question) {
        const stage = document.querySelector('#v2Viewport .bookmark-stage'), vp = document.getElementById('v2Viewport');
        if (!stage || !vp || !question) return;
        const key = state.editingRoomId != null ? state.editingRoomId : (state.editingRoom && state.editingRoom.name);
        const first = introRoomKey !== key;
        introRoomKey = key;
        let reduced = false;
        try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
        const T = PHOTO_INTRO, hold = first ? T.firstText + T.firstHold : T.nextText + T.nextHold;
        [['--pi-first', T.firstText], ['--pi-next', T.nextText], ['--pi-veil', T.veil], ['--pi-focus', T.focus]].forEach(([k, ms]) => vp.style.setProperty(k, ms + 'ms'));
        const box = document.createElement('div');
        box.id = 'photoIntro';
        box.className = 'photo-intro' + (first && !reduced ? ' is-first' : '') + (reduced ? ' is-reduced' : '');
        box.innerHTML = progHtml() + `<h2 class="q-title font-serif-kr"><span class="photo-intro-q">${question}</span></h2>`;
        stage.classList.add(reduced ? 'is-hidden' : 'is-soft');
        vp.appendChild(box);
        quietBack(true);
        let done = false;
        const settle = () => {      // 사진이 맺힘 (움직임 줄이기: 서서히 나타나기만)
            stage.classList.add('is-focusing');
            void stage.offsetWidth;      // 바뀌기 전 모습을 한 번 그려 둬야 서서히 바뀜
            stage.classList.remove('is-soft', 'is-hidden');
            const v = document.getElementById('photoVeil');
            if (v) v.classList.remove('on');
            introTimers.push(setTimeout(() => { stage.classList.remove('is-focusing'); const v = document.getElementById('photoVeil'); if (v) v.remove(); }, T.focus + 50));
        };
        const reveal = (now) => {
            if (done) return;
            done = true;
            introTimers.forEach(clearTimeout);
            introTimers = [];
            if (now) box.remove();
            else { box.classList.add('out'); setTimeout(() => box.remove(), T.focus); }      // 글자는 서서히 사라지고 그 아래로 사진이 겹쳐 나타남
            quietBack(false);
            syncBack(true);
            if (now) { stage.classList.remove('is-soft', 'is-hidden'); const v = document.getElementById('photoVeil'); if (v) v.remove(); return; }
            settle();
        };
        box.onclick = () => reveal(true);
        // 140번: 사진이 다 풀린(decode) 뒤에 맺히게 — 덜 받은 사진이 맺히는 도중 튀어나오면 끊겨 보임 (늦어도 0.8초 더 기다리면 넘어감)
        const imgs = Array.from(stage.querySelectorAll('img')).filter(im => im.getAttribute('src'));
        const ready = Promise.all(imgs.map(im => (im.decode ? im.decode() : Promise.resolve()).catch(() => {})));
        const wait = ms => new Promise(r => introTimers.push(setTimeout(r, ms)));
        Promise.all([wait(hold), Promise.race([ready, wait(hold + 800)])]).then(() => reveal(false));
    }
    // 고른 원단으로 칸을 채우는 스타일: 톤 색 위에 사진(있으면)을 덮음. 첫 화면 공간 칸·제안서 원단 칸이 함께 씀
    function fabricFillStyle(fabricId, colorName) {
        const color = colorFillOf(fabricId, colorName);      // 잰 색(색상코드)이 있으면 그 색, 없으면 톤 색
        const urls = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabricId, colorName) : [];
        const imgs = urls.map(u => `url('${u}')`).join(', ');
        return `background-color: ${color};${imgs ? ` background-image: ${imgs};` : ''} background-size: cover; background-position: center;`;
    }
    // ---- 중심 화면(1-Space): 처음부터 끝까지 쓰는 화면. 빈 띠·빈 칸으로 시작해 상담할수록 채워짐 ----
    // 벽·바닥 색 조각: 잰 색이 있으면 그 색, 카드로 골랐으면 카드의 대표 색. 아직 모르면 빗금
    const FLOOR_SW = { warm: '#bfa384', cool: '#d3d6d8', neutral: '#ada398', deep: '#4f3a2d' };
    const WALL_SW = { warm: '#f3ece2', cool: '#e6ebf0', neutral: '#e0d9d0', deep: '#6b4a3a' };
    const HATCH = 'repeating-linear-gradient(135deg, #fffdf9 0 6px, #efe7da 6px 12px)';
    const COMP_NAMES = { double: '이중 커튼', sheer_only: '속지 커튼', drape_only: '겉지 커튼', blind_only: '블라인드' };
    // 공간의 벽(part='wall') · 바닥(part='floor') 색: { hex, name, src: 'measured' | 'card' } 또는 null(아직 모름)
    // 잰 색의 이름: 자세한 이름(room-color.js colorName, 예: 라이트 베이지 · 내추럴 오크). 카드로 고른 색만 카드 이름(크림·아이보리 등)
    function measuredName(part, c) {
        const nm = c && window.RoomColor && window.RoomColor.colorName && window.RoomColor.colorName(part, c);
        return nm ? nm.name : ((part === 'wall' ? WALL_NAMES : FLOOR_NAMES)[c && c.tone] || '');
    }
    // 잰 색 옆 색상 코드 (방마다 실제로 다른 색임을 보여 줌). 카드로 고른 색은 잰 값이 아니라 안 띄움
    function hexCode(p) {
        return p && p.src === 'measured' && /^#[0-9a-f]{6}$/i.test(p.hex || '') ? `<span class="hex-code">${p.hex.toUpperCase()}</span>` : '';
    }
    function roomPart(r, part) {
        const names = part === 'wall' ? WALL_NAMES : FLOOR_NAMES, sw = part === 'wall' ? WALL_SW : FLOOR_SW;
        const tone = r[part + 'Tone'], mc = r.measuredColor && r.measuredColor[part];
        if (mc && mc.hex) return { hex: mc.hex, name: measuredName(part, mc) || names[tone] || '', src: 'measured' };
        if ((r.diagnosed || (r.cardParts && r.cardParts[part])) && names[tone]) return { hex: sw[tone], name: names[tone], src: 'card' };
        return null;
    }
    // 크기: 공간에 적어 둔 값(공간 추가 때) → 없으면 첫 커튼의 크기
    function roomSize(r) {
        const c = (r.curtains || [])[0] || {};
        const w = Number(r.width || c.width) || 0, h = Number(r.height || c.height) || 0;
        return w && h ? { w, h } : null;
    }
    function roomComp(r) {
        const k = (r.curtains || []).map(c => c.presetType);
        return k.includes('blind') ? 'blind_only' : (k.includes('sheer') && k.includes('drape')) ? 'double' : k.includes('sheer') ? 'sheer_only' : (k.includes('drape') ? 'drape_only' : null);
    }
    const kindOf = c => c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : (c.presetType === 'drape' ? '겉지' : '커튼'));
    // 이 집의 기본 색: 첫 공간에서 잰 벽·바닥 색 (state.house). 없으면 벽·바닥을 둘 다 잰 첫 공간에서 가져옴 (예전 상담·직원 화면에서 잰 공간)
    function houseColor() {
        if (state.house && (state.house.wall || state.house.floor)) {
            // 첫 공간의 비율을 직원 화면 막대로 바꿨으면 그 값을 씀
            const hr = state.house.roomId != null && state.roomsCart.find(x => x.id === state.house.roomId);
            const k = hr && hr.measuredColor && hr.measuredColor.bridgeK;
            return typeof k === 'number' ? Object.assign({}, state.house, { bridgeK: k }) : state.house;
        }
        const r = state.roomsCart.find(x => x.measuredColor && x.measuredColor.wall && x.measuredColor.floor);
        return r ? houseOf(r.measuredColor, null) : null;
    }
    // 집 기본 색으로 둘 모양: 벽·바닥 + 이어주는 색 비율(bridgeK, 30번 — "같아요"면 이어받음)
    function houseOf(mc, roomId) {
        const h = { wall: mc.wall || null, floor: mc.floor || null };
        if (roomId != null) h.roomId = roomId;
        if (typeof mc.bridgeK === 'number') h.bridgeK = mc.bridgeK;
        return h;
    }
    // 공간 번호: 같은 순간에 두 공간이 생겨도 겹치지 않게
    let lastRoomId = 0;
    function newRoomId() { lastRoomId = Math.max(Date.now(), lastRoomId + 1); return lastRoomId; }
    // 잰 색(measuredColor)을 공간에 넣고 바닥·벽 톤도 맞춤 (원단 추천은 톤 값을 읽음)
    function setRoomColor(room, mc) {
        room.measuredColor = mc && (mc.wall || mc.floor || hasFurniture(mc)) ? mc : null;
        if (mc && mc.wall) room.wallTone = mc.wall.tone;
        if (mc && mc.floor) room.floorTone = mc.floor.tone;
    }
    // 가구 색 (37번): measuredColor.furniture = [{ n: '소파', L, a, b, hex }]. 벽·바닥과 달리 공간마다 달라 "같아요"로 이어받지 않음
    function hasFurniture(mc) { return !!(mc && mc.furniture && mc.furniture.length); }
    function furCount(r) { return (r && r.measuredColor && Array.isArray(r.measuredColor.furniture)) ? r.measuredColor.furniture.length : 0; }
    function furLabelOf(n) { return (window.RoomColor && RoomColor.furLabel) ? RoomColor.furLabel(n) : (n || '가구'); }      // 예전 이름(수납장·식탁)도 새 이름으로 (66번)
    // k: 이어주는 색 비율(벽 쪽 무게). 없으면 기본. furniture: 그 공간의 가구 색 (있으면 그대로 붙임)
    function withBridge(wall, floor, k, furniture) {
        const mc = { wall: wall || null, floor: floor || null, at: Date.now() };
        if (typeof k === 'number') mc.bridgeK = k;
        mc.bridge = null;
        if (mc.wall && mc.floor && window.RoomColor && window.RoomColor.bridgeOf) mc.bridge = window.RoomColor.bridgeOf(mc.wall, mc.floor, mc.bridgeK);
        if (furniture && furniture.length) mc.furniture = furniture;
        return mc;
    }
    // 색 재기 화면(고객 화면 모양, room-color.js)을 띄움
    // bridgeK: 바닥·벽을 둘 다 잴 때 나오는 이어주는 색 막대의 처음 값 (30번, 없으면 기본)
    // dirPick: 결과 아래에 창 방향 버튼 (공간 추가 때만, 35번)
    function openMeasure(name, parts, doneLabel, doneNote, onDone, onSkip, bridgeK, dirPick) {
        if (!window.RoomColor || !window.RoomColor.openCustomer) { if (onSkip) onSkip(); return; }
        hideKeypadDirectly();
        window.RoomColor.openCustomer({ name, parts, doneLabel, doneNote, onDone, onSkip, onCancel: function() {}, bridgeK, dirPick: !!dirPick });
    }
    // ---- 창 방향 버튼 (35번): 동·서·남·북 최대 2개, 하나를 누르면 반대쪽은 흐려져 못 누름, 다시 누르면 꺼짐 ----
    //  공간 추가의 색 단계(색 재기 결과 아래 · "같나요?" · 못 재면 따로 한 화면)와 수정하기에 같은 모양. 값은 state.editingRoom.windowDir
    function dirPickerHtml(noTitle) {
        const ed = state.editingRoom || {}, cur = windowDirOf(ed.windowDir), txt = windowDirText(cur);
        let h = '<div class="dir-pick">' + (noTitle ? '' : '<span class="dir-pick-k font-serif-kr">빛은 어느 쪽에서 들어오나요?</span>') + '<div class="dir-btns">';
        ['E', 'W', 'S', 'N'].forEach(d => {
            const on = cur.includes(d), off = !on && (cur.includes(WINDOW_DIR_OPP[d]) || cur.length >= 2);
            h += `<button type="button" class="dir-btn font-serif-kr${on ? ' on' : ''}"${off ? ' disabled' : ''} aria-pressed="${on}" onclick="event.stopPropagation(); window.concierge.toggleDir('${d}')">${WINDOW_DIR_WORD[d]}</button>`;
        });
        h += '</div>';
        // 고른 방향은 흙빛 밑줄로 바로 보이므로 "남향" 확인 글은 뺌 (73번). "잘 모르겠어요"는 조용한 보조 행동
        h += `<button type="button" class="r-quiet dir-none${ed.dirUnknown && !cur.length ? ' on' : ''}" onclick="event.stopPropagation(); window.concierge.toggleDir('')">잘 모르겠어요</button></div>`;
        return h;
    }
    // 중심 화면 그리기(왼쪽 기둥·공간 칸·한 톤 바꾸기·알림·수정하기 화면)는 space.js로 옮김 (130-4④). 여기서 부르는 것:
    function shortFabName(...a) { return cz.shortFabName(...a); }
    function swapCurtain(...a) { return cz.swapCurtain(...a); }
    function spaceToast(...a) { return cz.spaceToast(...a); }
    function spaceHtml(...a) { return cz.spaceHtml(...a); }
    function spaceEditHtml(...a) { return cz.spaceEditHtml(...a); }
    const NUDGE_STEPS = [-100, -10, -1, 1, 10, 100];
    function msrBoxHtml(target, label, val) {
        return `<div id="measureBox_${target}" class="measure-box msr-box" onclick="window.concierge.openKeypad('${target}')">` +
            `<span class="msr-label font-serif-kr">${label}</span>` +
            `<div class="msr-num font-serif-kr"><span id="displayVal_${target}">${val}</span><small> cm</small></div>` +
            nudgeRowHtml(target, NUDGE_STEPS) + '</div>';
    }
    // 치수 100 단위 증감 꺽쇠 버튼 (위 +100, 아래 −100, 42번) — 73번부터는 숫자 줄(±100)로 합쳐 안 씀
    function stepperHtml(target, label) {
        return '<div class="msr-stepper">' +
            `<button type="button" class="msr-step-btn up" aria-label="${label} 100cm 올리기" onclick="event.stopPropagation(); window.concierge.nudge('${target}', 100)"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg></button>` +
            `<button type="button" class="msr-step-btn down" aria-label="${label} 100cm 줄이기" onclick="event.stopPropagation(); window.concierge.nudge('${target}', -100)"><svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>` +
            '</div>';
    }
    // 치수 미세 조절 버튼 (숫자를 누르면 키패드, 버튼은 조금씩 더하고 빼기)
    function nudgeRowHtml(target, steps) {
        return '<div class="nudge-row">' + steps.map(s =>
            `<button type="button" class="nudge-btn font-serif-kr" aria-label="${target === 'width' ? '가로' : '세로'} ${s > 0 ? '+' : '−'}${Math.abs(s)}cm" onclick="event.stopPropagation(); window.concierge.nudge('${target}', ${s})">${s > 0 ? '+' : '−'}${Math.abs(s)}</button>`
        ).join('') + '</div>';
    }
    // 사진 화면의 질문: 사진 위 어두운 알약 대신 앞의 안내 장면에서 보여 줌 (73번). 사진 위에는 진행 선만
    function stepHead(question) {
        photoQuestion = question;
        return progHtml();
    }

    // ---- 마무리 옵션 줄 (139번, 디자인점검 B-3 시안 B안): 형상기억·호텔핏은 줄마다 빼기/넣기, 밑단은 시접/리드밴드 중 하나 ----
    // 옵션 미리보기 창(그림)은 과장이 있어 없앰 (139번)
    function finishOptsHtml(room) {
        const hasSheer = room.items.some(i => i.presetType === 'sheer');
        const hasDrape = room.items.some(i => i.presetType === 'drape');
        let h = '<div class="fo-list" id="finishOpts">';
        const row = (key, name, say) => {
            const on = !!room[key];
            return `<div class="fo-row${on ? ' on' : ''}"><span class="fo-nm font-serif-kr">${name}</span>`
                + `<button type="button" class="fo-act" data-k="${key}" aria-label="${name} ${on ? '빼기' : '넣기'}" onclick="window.concierge.toggleFinishOpt('${key}')">${on ? '빼기' : '넣기'}</button>`
                + `<p class="fo-say">${say}</p></div>`;
        };
        if (hasDrape) {
            h += row('shapeFee', '형상기억 가공', '주름을 열로 잡아 두어 더 가지런하게 떨어집니다');
            h += row('hotelFit', '호텔핏', '원단을 한 폭 더 넣어 주름이 깊고 풍성해집니다');
        }
        if (hasSheer) {
            const lead = !!room.leadBand;
            h += '<div class="fo-row fo-hem"><span class="fo-nm font-serif-kr">밑단</span><div class="fo-pick" role="group" aria-label="밑단">'
                + `<button type="button" data-hem="0" class="${lead ? '' : 'on'}" aria-pressed="${!lead}" onclick="window.concierge.setHem(false)">시접</button>`
                + `<button type="button" data-hem="1" class="${lead ? 'on' : ''}" aria-pressed="${lead}" onclick="window.concierge.setHem(true)">리드밴드</button></div></div>`;
        }
        return h + '</div>';
    }
    // 누른 뒤 줄만 다시 그리고 누른 자리에 초점을 돌려 둠
    function refreshFinishOpts(sel) {
        const box = document.getElementById('finishOpts'), room = state.editingRoom;
        if (!box || !room) return;
        // 140번: 목록을 통째로 다시 그리면 켜진 줄의 점이 모두 다시 나타나며 깜빡임 → 누른 줄만 바꿈
        box.querySelectorAll('.fo-act').forEach(btn => {
            const on = !!room[btn.getAttribute('data-k')], row = btn.closest('.fo-row');
            if (row.classList.contains('on') === on) return;
            row.classList.toggle('on', on);
            const nm = row.querySelector('.fo-nm').textContent;
            btn.textContent = on ? '빼기' : '넣기';
            btn.setAttribute('aria-label', `${nm} ${on ? '빼기' : '넣기'}`);
        });
        box.querySelectorAll('.fo-pick button').forEach(btn => {
            const on = (btn.getAttribute('data-hem') === '1') === !!room.leadBand;
            if (btn.classList.contains('on') === on) return;
            btn.classList.toggle('on', on);
            btn.setAttribute('aria-pressed', String(on));
        });
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
        stopPhotoIntro();
        photoQuestion = '';
        // 구성을 마친 공간이 없으면 최종 제안 대신 공간 화면으로
        if (state.step === "7-Final-Dossier" && !state.roomsCart.some(r => r.isConfigured)) state.step = "1-Space";
        // 121번: 공간이 없어도 빈 공간 화면을 그대로 보여 줌("+ 공간 추가"부터). 뒤로 가기는 첫 화면으로만
        if (state.step === "1-Space" && state.roomsCart.length === 0) {
            stepHistory.length = 0;
            stepHistory.push({ step: "0-Welcome", idx: 0 });
            updatePrevButtonVisibility();
        }

        // 스크롤 위치 기억 (48번): 1-Space 한 톤 조절이나 화면 갱신 시 스크롤이 맨 위로 튀는 현상 방지
        const prevRightScroll = (state.step === "1-Space") ? (document.querySelector('.dos-right')?.scrollTop || 0) : 0;
        const prevStageScroll = (state.step === "1-Space") ? (document.querySelector('.dos-stage')?.scrollTop || 0) : 0;
        const prevMsrScroll = (state.step === "1-Space-Edit") ? (document.querySelector('.msr-stage')?.scrollTop || 0) : 0;

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
                html += '<h1 class="wel-brand font-serif-kr" data-staff-hold>' + redamLogoSVG() + '</h1>';
                html += '<p class="wel-sub font-serif-kr">빛을,<br>다시 담습니다</p>';
                html += `<input type="text" id="cName_ui" class="wel-input font-serif-kr" value="${esc((document.getElementById('custName') || {}).value)}" placeholder="고객명 / 현장명" oninput="window.concierge.setClientName(this.value)">`;
                html += `<input type="tel" id="cPhone_ui" class="wel-input font-serif-kr" inputmode="numeric" autocomplete="off" value="${esc((document.getElementById('custPhone') || {}).value)}" placeholder="연락처" oninput="window.concierge.setClientPhone(this)">`;
                html += `<button type="button" class="txt-cta wel-go font-serif-kr" onclick="window.concierge.beginConsult()">${state.roomsCart.length ? '상담 이어가기' : '상담 시작'}</button>`;
                html += '</div>';
                break;
            }

            // [우리 집 취향 ① 커튼 느낌 (117번)] 집에 한 번. 글 질문 화면 틀 그대로. "이 공간만 다르게"로 오면 그 공간 값으로
            case "0.5-House-Taste": {
                const t = tasteNow(), forRoom = tasteRoom();
                const wasT = v => t.pres === v;
                const opts = [
                    { label: '조용히 스며들게요', on: "window.concierge.pickTaste('pres', 'calm')", was: wasT('calm') },
                    { label: '차분히 무게감 있게요', on: "window.concierge.pickTaste('pres', 'weight')", was: wasT('weight') },
                    { label: '포인트가 되게요', on: "window.concierge.pickTaste('pres', 'point')", was: wasT('point') }
                ];
                // 120번: 포인트는 공간마다(집 전체 구성 화면의 [포인트]) → 집 질문에는 공간이 하나뿐일 때만. 겉지·블라인드가 없으면(속지만) 숨김
                const frP = forRoom && state.roomsCart.find(r => r.id === state.editingRoomId);
                const canPoint = frP ? canPointRoom(frP) : (state.roomsCart.length <= 1 && (houseHas('drape') || houseHas('blind')));
                if (!canPoint && !wasT('point')) opts.pop();
                // 119번: 질문 글은 들어가는 것에 맞춤 (블라인드만이면 "블라인드는", 둘 다면 "커튼과 블라인드는")
                const subj = (c, b) => c && b ? '커튼과 블라인드는' : (b ? '블라인드는' : '커튼은');
                const fr = forRoom && state.roomsCart.find(r => r.id === state.editingRoomId);
                const q = forRoom
                    ? `${forRoom.name}의 ${fr && planHas(fr, 'blind') ? '블라인드는' : '커튼은'} 어떤 느낌이 좋으실까요?`
                    : `${subj(houseHas('sheer') || houseHas('drape'), houseHas('blind'))} 어떤 느낌이 좋으실까요?`;
                html += askStage(q, '', opts);
                break;
            }

            // [우리 집 취향 ② 겉지 결 (117번)] 사진 화면 틀(속지 느낌·블라인드 종류와 같음). 접사 사진은 기기에만, 없으면 색 질감
            case "0.6-House-Tex": {
                const t = tasteNow(), wasX = v => t.tex === v ? ' was-picked' : '';
                html += '<div class="bookmark-stage">';
                html += stepHead(tasteRoom() ? `${state.editingRoom.name}의 겉지는 어떤 질감이 좋으실까요?` : '겉지는 어떤 질감이 좋으실까요?');
                html += '<div class="bookmark-canvas" style="--items-count: 3;">';
                html += renderBookmarkCard("매끈한", "", "", texBg('tex_smooth', SOLID_TEXTURES.coolWhite), function() { window.concierge.pickTaste('tex', 'smooth'); }, 'vdesc' + wasX('smooth'));
                html += renderBookmarkCard("짜임이 보이는", "", "", texBg('tex_texture', SOLID_TEXTURES.oak), function() { window.concierge.pickTaste('tex', 'texture'); }, 'vdesc' + wasX('texture'));
                html += renderBookmarkCard("보송한", "", "", texBg('tex_fluffy', SOLID_TEXTURES.l1), function() { window.concierge.pickTaste('tex', 'fluffy'); }, 'vdesc' + wasX('fluffy'));
                html += '</div></div>';
                break;
            }

            // [Step 1.5: 9종 공간 선택] (151번)
            case "1.5-Room-Type":
                html += askStage('어느 공간의 창인가요?', '', [
                    { label: '거실', on: "window.concierge.chooseRoomType('거실')" },
                    { label: '안방', on: "window.concierge.chooseRoomType('안방')" },      // 151번: '방'을 셋으로
                    { label: '작은방', on: "window.concierge.chooseRoomType('작은방')" },
                    { label: '아이방', on: "window.concierge.chooseRoomType('아이방')" },
                    { label: '서재', on: "window.concierge.chooseRoomType('서재')" },
                    { label: '주방', on: "window.concierge.chooseRoomType('주방')" },
                    { label: '알파룸', on: "window.concierge.chooseRoomType('알파룸')" },
                    { label: '드레스룸', on: "window.concierge.chooseRoomType('드레스룸')" },
                    { label: '베란다', on: "window.concierge.chooseRoomType('베란다')" }
                ]);
                break;

            // [공간 추가 ② 크기] 실측 화면 모양 (옵션은 원단을 고른 뒤 마무리에서)
            case "1.6-Add-Size": {
                const d = state.editingRoom;
                if (!d.sizeMode) d.sizeMode = 'full';
                const isPart = d.sizeMode === 'part';
                const curW = isPart ? (d.partWidth != null ? d.partWidth : d.width) : (d.spaceWidth != null ? d.spaceWidth : d.width);
                const curH = isPart ? (d.partHeight != null ? d.partHeight : d.height) : (d.spaceHeight != null ? d.spaceHeight : d.height);

                // 시안대로 (73번): 제목·"숫자를 누르면 직접 입력" 없이 커다란 숫자 두 칸, 전체/부분은 오른쪽 위 선택지
                html += '<div class="msr-stage">' + progHtml();
                html += '<div class="msr-mode-switch" role="tablist" aria-label="크기 측정 모드">' +
                    `<button type="button" class="msr-mode-btn font-serif-kr ${!isPart ? 'is-active' : ''}" onclick="window.concierge.setSizeMode('full')">전체</button>` +
                    `<button type="button" class="msr-mode-btn font-serif-kr ${isPart ? 'is-active' : ''}" onclick="window.concierge.setSizeMode('part')">부분</button>` +
                    '</div>';
                if (isPart && ((d.spaceWidth || d.width) > 0 || (d.spaceHeight || d.height) > 0)) {
                    html += `<p class="msr-space-ref font-serif-kr">공간 전체 치수: <b>${d.spaceWidth || d.width || 0} × ${d.spaceHeight || d.height || 0}cm</b></p>`;
                }
                html += '<div class="msr-grid">' +
                    msrBoxHtml('width', '가로', curW) +
                    msrBoxHtml('height', '세로', curH) +
                    '</div>'; // 41번, 43번
                html += '<button type="button" class="msr-add font-serif-kr" onclick="window.concierge.addRoomColor()">다음 →</button>';
                html += '</div>';
                break;
            }

            // [공간 추가 ③ 색, 두 번째 공간부터] 이 집의 기본 색과 같은지. 다른 부분만 다시 잼
            case "1.7-Add-Same": {
                const hc = houseColor();
                const wf = (k, c, part) => `<div class="dos-wfrow"><span class="dos-wfk">${k}</span><i style="background:${c ? c.hex : HATCH}"></i><span class="dos-wfn">${c ? measuredName(part, c) : '아직 안 쟀어요'}</span>${hexCode(c && { hex: c.hex, src: 'measured' })}</div>`;
                const extra = (hc ? `<div class="ask-house"><span class="ask-house-k">기본 벽·바닥 색</span>${wf('벽', hc.wall, 'wall')}${wf('바닥', hc.floor, 'floor')}</div>` : '') + dirPickerHtml();      // 창 방향은 공간마다 (이어받지 않음)
                // 146번: 처음 잰 공간 하나가 아니라 앞서 담은 공간 중에서 고름 ("○○과 같아요", 최근 공간부터 4곳)
                const refs = state.roomsCart.filter(r => r.measuredColor && (r.measuredColor.wall || r.measuredColor.floor)).slice().reverse().slice(0, 4);
                if (refs.length) {
                    const nm = s => String(s || '').replace(/</g, '&lt;');
                    const rows = refs.map(r => `<div class="ask-house"><span class="ask-house-k">${nm(r.name)}</span>${wf('벽', r.measuredColor.wall, 'wall')}${wf('바닥', r.measuredColor.floor, 'floor')}</div>`).join('');
                    html += askStage('어느 공간과 벽·바닥이 같으신가요?', '', refs.map((r, i) => (
                        { label: `${nm(withGwa(r.name))} 같아요`, rec: i === 0, on: `window.concierge.finishAddRoom('room', null, ${r.id})` }))
                        .concat([
                            { label: '모두 달라요', on: "window.concierge.measureNewRoom('both')" },
                            { label: '지금은 못 재요', quiet: true, on: "window.concierge.finishAddRoom('none')" }
                        ]), { extra: rows + dirPickerHtml() });
                    break;
                }
                html += askStage('앞 공간과 벽·바닥이 같으신가요?', '', [
                    { label: '같아요', rec: true, on: "window.concierge.finishAddRoom('house')" },
                    { label: '벽만 달라요', on: "window.concierge.measureNewRoom('wall')" },
                    { label: '바닥만 달라요', on: "window.concierge.measureNewRoom('floor')" },
                    { label: '둘 다 달라요', on: "window.concierge.measureNewRoom('both')" },
                    { label: '지금은 못 재요', quiet: true, on: "window.concierge.finishAddRoom('none')" }
                ], { extra });
                break;
            }

            // [창 방향 (35번)] 첫 공간에서 색을 못 쟀을 때(공간 추가) · "이렇게 들었어요"에서 방향 줄을 눌렀을 때
            case "1.8-Add-Dir": {
                const ed = state.editingRoom;
                html += '<div class="ambient-stage ask-stage">' + progHtml();
                html += '<h2 class="q-title font-serif-kr">빛은 어느 쪽에서 들어오나요?</h2>';
                html += dirPickerHtml(true);
                html += `<button type="button" class="txt-cta font-serif-kr home-go" onclick="window.concierge.dirDone()">${ed.addDraft ? `${ed.name} 담기` : '다음'}</button>`;
                html += '</div>';
                break;
            }

            // [Step 2-0: 앞 공간과 같은 바닥·벽인지 (두 번째 공간부터)]
            case "2-Base-Copy": {
                const src = copySourceRoom();
                const sp = src && { floor: roomPart(src, 'floor'), wall: roomPart(src, 'wall') };
                const srcDesc = src ? [sp.floor ? `바닥 ${sp.floor.name}` : (FLOOR_NAMES[src.floorTone] && `바닥 ${FLOOR_NAMES[src.floorTone]}`),
                    sp.wall ? `벽 ${sp.wall.name}` : (WALL_NAMES[src.wallTone] && `벽 ${WALL_NAMES[src.wallTone]}`)].filter(Boolean).join(' / ') : '';
                html += askStage(src ? `${withGwa(src.name)} 바닥·벽이 같은가요?` : '바닥·벽을 골라 주세요', srcDesc, [
                    { label: '네, 같아요', on: 'window.concierge.copyBaseFromPrev(true)' },
                    { label: '아니요, 새로 고를게요', on: 'window.concierge.copyBaseFromPrev(false)' }
                ]);
                break;
            }

            // [Step 2-1: 바닥재 진단]
            case "2-Base-Floor":
                html += '<div class="bookmark-stage">';
                html += stepHead(roomTopic(state.editingRoom) ? `${state.editingRoom.name}의 바닥 톤을 골라 주세요` : '커튼 색을 맞추기 위해, 바닥 톤을 골라 주세요');      // 152번
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard(FLOOR_NAMES.warm, "", "", SOLID_TEXTURES.oak, function() { window.concierge.selectFloorTone('warm'); }, 'vdesc' + was('floorTone', 'warm'));
                html += renderBookmarkCard(FLOOR_NAMES.cool, "", "", SOLID_TEXTURES.tile, function() { window.concierge.selectFloorTone('cool'); }, 'vdesc' + was('floorTone', 'cool'));
                html += renderBookmarkCard(FLOOR_NAMES.neutral, "", "", SOLID_TEXTURES.neutral, function() { window.concierge.selectFloorTone('neutral'); }, 'vdesc' + was('floorTone', 'neutral'));
                html += renderBookmarkCard(FLOOR_NAMES.deep, "", "", SOLID_TEXTURES.walnut, function() { window.concierge.selectFloorTone('deep'); }, 'vdesc' + was('floorTone', 'deep'));
                html += '</div></div>';
                break;

            // [Step 2-2: 벽지 진단]
            case "2-Base-Wall":
                html += '<div class="bookmark-stage">';
                html += stepHead(state.editingRoom && state.editingRoom.editOnly ? '벽 톤을 골라 주세요' : (roomTopic(state.editingRoom) ? `${state.editingRoom.name}의 벽 톤도 골라 주세요` : '벽 톤도 골라 주세요'));      // 152번
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard(WALL_NAMES.warm, "", "", SOLID_TEXTURES.cream, function() { window.concierge.selectWallTone('warm'); }, 'vdesc' + was('wallTone', 'warm'));
                html += renderBookmarkCard(WALL_NAMES.cool, "", "", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectWallTone('cool'); }, 'vdesc' + was('wallTone', 'cool'));
                html += renderBookmarkCard(WALL_NAMES.neutral, "", "", SOLID_TEXTURES.greige, function() { window.concierge.selectWallTone('neutral'); }, 'vdesc' + was('wallTone', 'neutral'));
                html += renderBookmarkCard(WALL_NAMES.deep, "", "", SOLID_TEXTURES.walnut, function() { window.concierge.selectWallTone('deep'); }, 'vdesc' + was('wallTone', 'deep'));
                html += '</div></div>';
                break;

            // [빛 가림: 모든 공간에서 (117번)]
            case "2-Base-Block": {
                // 공간에 들어와 처음 묻는 질문 (117번): 위에 이 공간의 벽·바닥 확인 칩 (예전 빛 질문 자리에서 옮김 — 다르면 바닥·벽 카드로 고침)
                const ed = state.editingRoom, wall = roomPart(ed, 'wall'), floor = roomPart(ed, 'floor');
                const part = (k, p) => `<span class="rc"><i style="background:${p ? p.hex : HATCH}"></i>${k} <b>${p ? p.name : '아직 안 쟀어요'}</b></span>`;
                // 133번(재검토 A3): 벽·바닥을 다 잰 공간은 이 줄을 뺌(사장님이 말로 하는 정보, 고칠 때는 중심 화면 "수정하기"). 못 잰 공간만 "카드로 고르기"를 남김
                const chip = (ed.askCards || (wall && floor)) ? '' : `<div class="room-chip">이 공간 ${part('벽', wall)}${part('바닥', floor)}`
                    + `<button type="button" onclick="window.concierge.fixRoomColors()">카드로 고르기</button></div>`;
                html += askStage(roomTopic(ed) ? `${roomTopic(ed)} 빛을 어느 정도 가리실까요?` : '빛은 어느 정도 가리실까요?', '', [      // 152번: 안방은 빛을…
                    { label: '들어와도 괜찮아요', on: "window.concierge.selectLightBlock('light')", was: was('lightBlock', 'light') },
                    { label: '적당히 가려 주세요', on: "window.concierge.selectLightBlock('soft')", was: was('lightBlock', 'soft') },
                    { label: '완전히 어둡게요', on: "window.concierge.selectLightBlock('dark')", was: was('lightBlock', 'dark') }
                ], { top: chip });
                break;
            }

            // [바깥 시선: 모든 공간에서 (117번)]
            case "2-Base-Privacy":
                html += askStage(roomTopic(state.editingRoom) ? `${roomTopic(state.editingRoom)} 밖에서 보이는 시선을 어느 정도 가리실까요?` : '밖에서 보이는 시선은 어느 정도 가리실까요?', '', [      // 152번
                    { label: '괜찮아요', on: "window.concierge.selectPrivacy('open')", was: was('privacy', 'open') },
                    { label: '조금 신경 쓰여요', on: "window.concierge.selectPrivacy('some')", was: was('privacy', 'some') },
                    { label: '많이 신경 쓰여요', on: "window.concierge.selectPrivacy('high')", was: was('privacy', 'high') }
                ]);
                break;

            // [속지 결 (117번): 집에서 처음 속지가 들어가는 공간에서 한 번. 답은 우리 집 취향(속지 결)에 저장 — 예전 속지 느낌 사진 그대로]
            case "2-Base-SheerFeel": {
                const fe = state.editingRoom && state.editingRoom.flow;      // 123번: 공간마다 물음 → 그 공간 답만 표시
                const hs = fe ? ({ smooth: 'smooth', textured: 'texture', cozy: 'thick', any: 'unknown' }[state.editingRoom.sheerFeel] || null) : houseTasteNow().sheer, wasS = v => hs === v ? ' was-picked' : '';
                html += '<div class="bookmark-stage">';
                html += stepHead(fe ? `${state.editingRoom.name}의 속지는 어떤 질감이 좋으실까요?` : '속지는 어떤 질감이 좋으실까요?');
                html += `<button type="button" class="step-skip${wasS('unknown')}" onclick="window.concierge.selectSheerFeel('any')">잘 모르겠어요</button>`;
                html += '<div class="bookmark-canvas" style="--items-count: 3;">';
                html += renderBookmarkCard("매끈한", "", "", sheerFeelBg('feel_smooth', SOLID_TEXTURES.coolWhite), function() { window.concierge.selectSheerFeel('smooth'); }, 'vdesc' + wasS('smooth'));
                html += renderBookmarkCard("짜임이 보이는", "", "", sheerFeelBg('feel_textured', SOLID_TEXTURES.oak), function() { window.concierge.selectSheerFeel('textured'); }, 'vdesc' + wasS('texture'));
                html += renderBookmarkCard("도톰한", "", "", sheerFeelBg('feel_cozy', SOLID_TEXTURES.l1), function() { window.concierge.selectSheerFeel('cozy'); }, 'vdesc' + wasS('thick'));
                html += '</div></div>';
                break;
            }

            // [블라인드 종류 고르기: 블라인드 구성에서 한 번 (38-2)]
            case "2-Base-BlindKind":
                html += '<div class="bookmark-stage">';
                html += stepHead(state.editingRoom && state.editingRoom.flow ? `${state.editingRoom.name}에는 어떤 블라인드가 좋으실까요?` : '어떤 블라인드가 좋으실까요?');      // 123번
                html += `<button type="button" class="step-skip${was('blindWant', 'any') ? ' was-picked' : ''}" onclick="window.concierge.selectBlindKind('any')">잘 모르겠어요</button>`;
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("콤비", "", "", blindBg('blind_combi', SOLID_TEXTURES.l1), function() { window.concierge.selectBlindKind('combi'); }, 'vdesc' + was('blindWant', 'combi'));
                html += renderBookmarkCard("롤", "", "", blindBg('blind_roll', SOLID_TEXTURES.coolWhite), function() { window.concierge.selectBlindKind('roll'); }, 'vdesc' + was('blindWant', 'roll'));
                html += renderBookmarkCard("우드", "", "", blindBg('blind_wood', SOLID_TEXTURES.oak), function() { window.concierge.selectBlindKind('wood'); }, 'vdesc' + was('blindWant', 'wood'));
                html += renderBookmarkCard("알루미늄", "", "", blindBg('blind_alu', SOLID_TEXTURES.tile), function() { window.concierge.selectBlindKind('alu'); }, 'vdesc' + was('blindWant', 'alu'));
                html += '</div></div>';
                break;

            // [창 구성 (138번 중립)] 구성 사진 4칸 같은 폭, 앱이 권하지 않음(커튼 박스·설치 여건은 사장님이 현장에서 말로). 한 번 누르면 그것으로(137번)
            case "3-Config-Style": {
                const ed = state.editingRoom;
                html += '<div class="bookmark-stage">';
                html += stepHead(roomTopic(ed) ? `${roomTopic(ed)} 어떤 구성을 원하실까요?` : '어떤 구성을 원하실까요?');      // 안방은 / 거실은 (152번: roomTopic)
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                [['double', 'comp_double', SOLID_TEXTURES.l1], ['sheer_only', 'comp_sheer', SOLID_TEXTURES.l2], ['drape_only', 'comp_drape', SOLID_TEXTURES.l3], ['blind_only', 'comp_blind', SOLID_TEXTURES.oak]].forEach(([k, ph, fb]) => {
                    html += renderBookmarkCard(COMP_NAMES[k], "", "", compBg(ph, fb), function() { window.concierge.chooseWindowComposition(k); },
                        was('comp', k).trim());
                });
                html += '</div></div>';
                break;
            }

            // [Step 3.5: 감성 앰비언트 브릿지]
            case "3.5-Bridge": {
                const curItem = state.pendingItemQueue[state.currentItemIndex];
                const bw = state.editingRoom && state.editingRoom.blindWant;
                // 우드·알루미늄처럼 아직 목록에 없는 종류는 실물 샘플로 안내하고 바로 담음 (38-2)
                if (curItem.presetType === 'blind' && bw && bw !== 'any' && !hasBlindKindInPool(bw)) {
                    const kindName = (typeof BLIND_KIND_LABELS !== 'undefined' && BLIND_KIND_LABELS[bw]) || '선택하신';
                    const subText = bw === 'wood' ? '나무 결과 색감은 창가에서 실제로 대 보며 고르는 편이 정확합니다.'
                        : (bw === 'alu' ? '슬랫 두께와 색감은 창가에서 실제로 대 보며 고르는 편이 정확합니다.'
                        : '실제 샘플을 창가에 대 보며 어울리는 색을 골라 드립니다.');
                    html += '<div class="ambient-stage" onclick="window.concierge.proceedSampleBlind()">' + progHtml();
                    html += `<h2 class="q-title font-serif-kr">${kindName} 블라인드는 상담 때<br>실물 샘플로 보여 드리겠습니다.</h2>`;
                    html += `<p class="q-sub font-serif-kr">${subText}</p>`;
                    html += '<button type="button" class="txt-cta font-serif-kr home-go" onclick="window.concierge.proceedSampleBlind()">이 공간에 담아 두기 →</button>'; // 42번
                    html += '</div>';
                    break;
                }
                const typeLabel = curItem.presetType === 'sheer' ? '속지' : (curItem.presetType === 'drape' ? '겉지' : '블라인드');
                // 120번: 포인트 공간의 겉지·블라인드는 "골랐습니다" 대신 기법부터 고름 (용어 그대로, 후보 있는 것만, 하나뿐이면 묻지 않음)
                const techs = pointTechsFor(curItem);
                if (techs.length > 1 && !state.seekNow) {
                    const ed = state.editingRoom;
                    // 146번: 방식을 누르면 설명(벽 색 + 그 방식의 원단 색 몇 개 + 쉬운 한 줄)을 보고 확정, 아니면 돌아감
                    const pv = state.pointPreview && techs.find(o => o.key === state.pointPreview);
                    if (pv && typeof pointTechPreview === 'function') {
                        const P = pointTechPreview(ed.measuredColor, curItem.presetType === 'blind' ? '블라인드' : '겉지', pv.key, 4);
                        // 직원 화면 색 기법(color-guide.js)의 방 그림을 떼어 옴: 벽·바닥은 이 공간에서 잰 색, 양쪽 커튼은 이 방식의 원단 색
                        const wall = (ed.measuredColor && ed.measuredColor.wall && ed.measuredColor.wall.hex) || '#EEE9E0';
                        const floor = (ed.measuredColor && ed.measuredColor.floor && ed.measuredColor.floor.hex) || '#B98A5E';
                        const room = c => `<svg class="pt-room" viewBox="0 0 240 120" aria-hidden="true"><rect width="240" height="96" fill="${wall}"/><rect y="96" width="240" height="24" fill="${floor}"/><rect x="80" y="18" width="80" height="62" fill="#cfe0ea"/><rect x="62" y="12" width="30" height="84" fill="${c}"/><rect x="148" y="12" width="30" height="84" fill="${c}"/></svg>`;
                        const strip = !P.hexes.length ? '' : `<div class="pt-show">${room(P.hexes[0])}${P.hexes.length > 1 ? `<div class="pt-chips">${P.hexes.map(h => `<span class="pt-chip" style="background:${h}"></span>`).join('')}</div><span class="pt-cap">이 방식으로 고를 수 있는 색</span>` : ''}</div>`;
                        html += askStage(P.term, P.say, [
                            { label: '이 방식으로 할게요', rec: true, on: `window.concierge.pickPointTech('${pv.key}')` },
                            { label: '다른 방식 보기', quiet: true, on: "window.concierge.previewPointTech('')" }
                        ], { extra: strip });
                        break;
                    }
                    html += askStage('포인트는 어떤 방식으로 주실까요?', '', techs.map(o => (
                        { label: o.term, on: `window.concierge.previewPointTech('${o.key}')`, was: ed.pointTech === o.key }))
                        .concat([{ label: '맡길게요', quiet: true, on: "window.concierge.pickPointTech('')", was: ed.pointTech === null && ed.pointAsked }]));
                    break;
                }
                if (techs.length === 1) state.editingRoom.pointTech = techs[0].key;
                // 140번(B-6): "골랐습니다" + "찾는 중"을 한 화면으로. 들어오자마자 사진을 받고, 다 되면 제목이 "골랐습니다"로
                html += '<div class="ambient-stage fab-seek-stage" id="fabSeekStage" role="status" onclick="window.concierge.proceedToFabricQueue()">' + progHtml();
                html += `<h2 class="q-title font-serif-kr">이 공간의 빛과 색에 맞춰<br><span class="fab-seek-what">${typeLabel}를 고르고 있습니다</span></h2>`;
                html += seekChipsHtml();
                html += '<p class="q-sub fab-seek-sub font-serif-kr">바닥·벽의 색과 들어오는 햇빛을 보고 있습니다</p>';
                // 143번: "원단 보기" 버튼 없이 다 고르면 저절로 넘어감 (첫 칸도)
                html += '</div>';
                break;
            }

            // [Step 4: 실제 FABRIC_DB 기반 원단 3종 쇼케이스]
            case "4-Fabric-Queue":
                // 벽·바닥 둘 다 잰 색값이 없으면 추천하지 않고 다시 재기 안내 (92번: 카드로만 고른 공간·재기 실패는 추측하지 않음)
                if (!roomHasLab(state.editingRoom)) {
                    const mc0 = (state.editingRoom && state.editingRoom.measuredColor) || {};
                    const need = ['wall', 'floor'].filter(p => !(mc0[p] && typeof mc0[p].L === 'number'));
                    html += askStage('벽·바닥 색을 재야 원단을 추천할 수 있습니다', '', need.map(p => (
                        { label: p === 'wall' ? '벽 색 재기' : '바닥 색 재기', on: `window.concierge.measureForFabric('${p}')` })));
                    break;
                }
                const { queueItem, targetCategory, showcaseList } = fabricShowcase();
                state.colorPick = state.colorPick || {};
                if (!showcaseList.length) {      // 잰 색값이 있는 원단이 없으면 추천하지 않음 (92번)
                    html += askStage('색을 잰 원단이 아직 없어 추천할 수 없습니다', '직원 화면 › 원단 색상 › 색 안 잰 원단에서 확인할 수 있습니다', []);
                    break;
                }

                const anyColors = showcaseList.some(e => e.best.ranked.length > 1);
                html += '<div class="bookmark-stage">';
                html += stepHead('마음에 드는 원단을 눌러 주세요', ''); // 42번: 사족 설명 제거
                // 창 그림(104번)은 원단 카드마다 하나씩 (137번, fabric-pick.js fabricCardHtml)
                html += `<div class="bookmark-canvas" style="--items-count: ${Math.max(1, showcaseList.length)};">`;
                state.fabPanelCount = showcaseList.length;      // 마지막 칸에 Re.dam 표시를 넣기 위해
                // 138번: 원단 차이 한 줄은 세 원단을 나란히 보고 정함 (처음 색은 어울리는 색 첫째)
                state.fabDiffSet = showcaseList.map(e => Object.assign(Object.create(e.f), { id: e.f.id, __pick: colorDeckOrder(e.best)[0] || '' }));
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
                html += '<div class="msr-stage">';
                html += '<div class="msr-grid">';
                html += msrBoxHtml('width', '가로', curRoom.width); // 41번 · 73번
                html += msrBoxHtml('height', '세로', curRoom.height);
                html += '</div>';

                if (hasCurtain) html += finishOptsHtml(curRoom);      // 139번: 마무리 화면과 같은 줄 모양

                html += `<button type="button" class="msr-add font-serif-kr" onclick="window.concierge.commitRoomCart()">${curRoom.name}에 추가</button>`;
                html += '</div>';
                break;
            }

            // [마무리(옵션)] 원단을 고른 뒤: 크기는 공간 추가 때 적었으므로 옵션만 (실측 화면의 옵션 글자 모양 그대로) → "○○ 마치기" → 중심 화면
            case "6-Finish": {
                const curRoom = state.editingRoom;
                html += '<div class="msr-stage msr-finish">' + progHtml();
                // 옵션은 처음부터 들어가 있음 → "이렇게 마무리" + 줄마다 빼기/넣기, 밑단은 시접/리드밴드 (139번)
                html += '<h2 class="msr-title font-serif-kr">이렇게 마무리해 드립니다</h2>';
                html += finishOptsHtml(curRoom);
                html += `<button type="button" class="msr-add font-serif-kr" onclick="window.concierge.commitRoomCart()">${curRoom.name} 마치기</button>`;
                html += '</div>';
                break;
            }

            // [Step 1: 중심 화면] 처음부터 끝까지 쓰는 화면 (금액·시공비 없음). 시작과 끝이 같은 모양: 빈 띠·빈 칸으로 시작해 상담할수록 채워짐
            // 평평한 바탕 · 가는 선 · 명조 글자 · 각진 색 칸 · 밑줄 글자 버튼 (둥근 카드·그림자·색 버튼 없음)
            case "1-Space":
                html += spaceHtml(currentCust);
                break;

            // [중심 화면 › 수정하기] 크기와 벽·바닥 색만 고침 (고른 원단은 그대로)
            case "1-Space-Edit":
                html += spaceEditHtml();
                break;

            // [Step 7: 최종 제안 = 통합 에디토리얼 룩북 (76번)]
            // 가로·세로 모두 액자 비례 미니멀 조각보 표지(100dvh) → 공간의 색과 빛 → 공간별 완결형 쇼룸 시트 → 호텔 인보이스 견적서로 이어 읽음
            case "7-Final-Dossier": {
                if (lastRenderedStep !== "7-Final-Dossier") resetFinalPage();
                html += '<div class="fin-stage"><div class="fin-ed" id="finEditorial"></div></div>';
                break;
            }
        }

        html += '</div>';
        main.innerHTML = html;
        lastRenderedStep = state.step;
        // 뒤로 가기 · 사진 화면 (73번): 사진 띠 이름은 모두 같은 크기 → 가장 긴 이름이 들어가도록 띠 높이만 맞춤. 앞으로 왔으면 안내 장면부터
        const photo = PHOTO_STEPS.includes(state.step);
        syncBack(photo);
        if (photo) {
            // 138번: 띠 높이는 120px 하나(가로쓰기라 글자 길이로 늘리지 않음)
            if (introWant && photoQuestion) playPhotoIntro(photoQuestion);
        }
        introWant = false;
        // 140번: 원단 고르는 한 화면이면 바로 사진 받기 시작 (143번: 첫 칸도 저절로)
        const seekStage = document.getElementById('fabSeekStage');
        if (seekStage) {
            const cur = state.pendingItemQueue[state.currentItemIndex] || {};
            const label = cur.presetType === 'sheer' ? '속지' : (cur.presetType === 'drape' ? '겉지' : '블라인드');
            state.seeking = true;
            const open = () => { state.seeking = false; state.seekNow = false; goToStep("4-Fabric-Queue"); };
            try { playFabricSeek(seekStage, label, state.currentItemIndex > 0, open, () => { state.seeking = false; }); }
            catch (e) { open(); }      // 문제가 생겨도 원단 화면은 열림
        } else state.seeking = false;
        // 스크롤 복원 (48번)
        if (state.step === "1-Space") {
            if (prevRightScroll) {
                const el = document.querySelector('.dos-right');
                if (el) el.scrollTop = prevRightScroll;
            }
            if (prevStageScroll) {
                const st = document.querySelector('.dos-stage');
                if (st) st.scrollTop = prevStageScroll;
            }
        }
        if (state.step === "1-Space-Edit" && prevMsrScroll) {
            const msr = document.querySelector('.msr-stage');
            if (msr) msr.scrollTop = prevMsrScroll;
        }
        if (state.step === "4-Fabric-Queue") {
            bindColorDecks();     // 색상 카드 밀어 넘기기 연결
            // "찾는 중" 화면을 거치지 않고 열렸을 때(뒤로 가기 등): 사진 주소를 찾은 뒤 넣음
            main.querySelectorAll('.fabric-photo[data-pending]').forEach(img => {
                const id = img.getAttribute('data-id'), color = img.getAttribute('data-color') || '';
                findPhoto(id, color).then(url => { if (!img.hasAttribute("data-pending")) return; img.removeAttribute("data-pending"); if (url) img.src = url; });      // 그사이 색을 바꿨으면 그대로 둠
            });
        }
        if (state.step === "7-Final-Dossier") {
            renderFinalEditorial();
            const st = document.querySelector('.fin-stage');
            if (st && lastRenderedStep !== "7-Final-Dossier") st.scrollTop = 0;
        }
    }

    // 최종 제안(도록·조각보·쇼룸·종이 쪽 넘기기)은 final.js로 옮김 (130-4③). 여기서 부르는 것:
    function buildJogakbo(...a) { return cz.buildJogakbo(...a); }
    function showroomRowsOf(...a) { return cz.showroomRowsOf(...a); }
    function renderFinalEditorial(...a) { return cz.renderFinalEditorial(...a); }
    function setFinalPage(...a) { return cz.setFinalPage(...a); }
    function finalPageNow(...a) { return cz.finalPageNow(...a); }
    function resetFinalPage(...a) { return cz.resetFinalPage(...a); }
    function queueFinalPaper(...a) { return cz.queueFinalPaper(...a); }

    // 원단 고르는 화면(색상 덱·원단 카드·사진 주소·"찾는 중")은 fabric-pick.js로 옮김 (130-4②). 여기서 부르는 것:
    function colorDeckOrder(...a) { return cz.colorDeckOrder(...a); }
    function fabricMiniSvg(...a) { return cz.fabricMiniSvg(...a); }
    function refreshMini(...a) { return cz.refreshMini(...a); }
    function colorFillOf(...a) { return cz.colorFillOf(...a); }
    function splitNameColor(...a) { return cz.splitNameColor(...a); }
    function fabricCardHtml(...a) { return cz.fabricCardHtml(...a); }
    function closeAllColors(...a) { return cz.closeAllColors(...a); }
    function bindColorDecks(...a) { return cz.bindColorDecks(...a); }
    function roomWithTaste(...a) { return cz.roomWithTaste(...a); }
    function fabricShowcase(...a) { return cz.fabricShowcase(...a); }
    function findPhoto(...a) { return cz.findPhoto(...a); }
    function forgetPhotos(...a) { return cz.forgetPhotos(...a); }
    function swapFabricPanel(...a) { return cz.swapFabricPanel(...a); }
    function playFabricSeek(...a) { return cz.playFabricSeek(...a); }
    function seekChipsHtml(...a) { try { return cz.seekChipsHtml(...a); } catch (e) { return ''; } }

    function renderBookmarkCard(title, desc, tag, bgStyle, onClickFn, extraClass, note) {
        const id = "bk_" + Math.random().toString(36).substr(2, 9);
        // 사진 칸 모두(바닥·벽·결·블라인드·창 구성): 한 번 누르면 이름 위 점 + 나머지 옅게 → 0.25초 → 넘어감 (137번)
        setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            el.onclick = () => pickThenGo(el, el.closest('.bookmark-canvas') || el.parentNode, '.bookmark-card', onClickFn);
        }, 0);

        // 138번: 띠 안 가로쓰기 — 1줄 이름(명조). 다른 사진 칸은 둘째 줄 없음
        return `<div id="${id}" class="bookmark-card lcard${extraClass ? ' ' + extraClass : ''}" style="width: 100%; height: 100%; cursor: pointer;">` +
            `<div class="bookmark-bg" style="background: ${bgStyle}; pointer-events: none;"></div>` +
            '<div class="bookmark-gradient fab-gradient" style="pointer-events: none;"></div>' +
            `<div class="fab-band"><div class="fab-hrow"><h3 class="fab-hname font-serif-kr">${title}</h3></div>` +
            (desc ? `<p class="fab-diff">${desc}</p>` : '') +
            (note ? `<p class="fab-note">${note}</p>` : '') +     // 차분한 작은 안내 (33번 속지만 밤 안내)
            '</div></div>';
    }

    // 로고 모션(INTRO_…·playIntro)은 intro.js로 옮김 (130-4①)
    function playIntro(then) { return cz.playIntro(then); }

    // 130-4: 나뉜 파일이 쓰는 이 파일의 상태·함수
    Object.assign(cz, { state, stepHistory, goToStep, render, syncToV1MasterRooms, fabricFillStyle, COMP_NAMES, roomPart, roomSize, roomComp, calculateV1ItemPrice, askedRoom, flowPeek, HATCH, hexCode, kindOf, houseColor, furCount, furLabelOf, dirPickerHtml, msrBoxHtml, getLiveDb, getLiveCategoryPool, roomHasLab });

    window.concierge = {
        // 저장 이미지가 화면 도록과 같은 조각보·쇼룸 시트를 그리도록 (80번, app.js buildTicketCanvases)
        // 직원 화면 "시험" 칸(fake-guest.js)이 고객 화면과 같은 원단 모음을 고르도록 꺼냄 (89번, 화면 변화 없음)
        categoryPool: cat => getLiveCategoryPool(cat),
        jogakbo: data => buildJogakbo(data),      // 134번: 칸 목록 { cells: [{ x, y, w, h, hex }] } (16×10)
        showroomRows: data => showroomRowsOf(data),
        start: function() {
            goToStep(state.roomsCart.length ? "1-Space" : "0-Start", false);
        },
        prevStep: function() {
            prevStep();
        },
        // 탭의 뒤로(app.js "뒤로 버튼"이 부름): 떠 있는 것(키패드 · 옵션 설명 · 모든 색 판)을 닫았으면 true
        closeTopLayer: function() {
            const pad = document.getElementById("v2VirtualKeypadSheet");
            if (pad && pad.classList.contains("active")) { hideKeypadDirectly(); return true; }
            if (state.step === "7-Final-Dossier" && finalPageNow() > 0) { setFinalPage(finalPageNow() - 1); return true; }
            return closeAllColors();
        },
        // "찾는 중" 화면이 떠 있으면 뒤로를 무시 (끝나면 원단 화면이 열림)
        isSeeking: function() { return !!state.seeking; },
        // 화면 왼쪽 위 ← 가 할 일이 있는지 (없으면 뒤로를 눌러도 아무 일도 없음)
        canGoBack: function() { return stepHistory.length > 0; },
        goToSpaceCanvas: function() {
            goToStep("1-Space");
        },
        // 첫 화면 "상담 시작": 공간이 없으면 첫 공간 추가, 있으면 공간 화면으로 (119번)
        beginConsult: function() {
            // 119번: 취향은 구성을 정한 뒤 집에 한 번 묻고, 여기서는 공간 만들기부터
            // 121번: 공간이 없어도 먼저 빈 공간 화면으로 들어가 거기서 "+ 공간 추가"
            goToStep("1-Space");
        },
        // 취향 화면 답: 느낌 → 결 → (집이면) 공간으로 / (이 공간만이면) 구성 제안으로 돌아감 (117번)
        pickTaste: function(key, val) {
            const ed = state.editingRoom, forRoom = tasteRoom();
            if (forRoom) {
                const ht = ed.flow ? {} : houseTasteNow();      // 123번: 공간마다 묻는 길은 집 취향을 이어받지 않음
                if (!ed.ownTaste) { ed.ownTaste = true; ed.ownPres = ht.pres || null; ed.ownTex = ht.tex || null; }
                ed[key === 'pres' ? 'ownPres' : 'ownTex'] = val;
            } else if (typeof setHouseTaste === 'function') {
                setHouseTaste(key, val);
            }
            if (forRoom) {
                saveOwnTaste(ed);
                state.tasteFor = null; flowNext(); return;      // 123번: 길잡이가 다음(결 → 원단)
            }
            // 119번: 길잡이가 다음(겉지 결은 겉지가 들어갈 때만). 121번: 중심 화면 "집 취향 수정"은 뺌
            flowNext();
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
        // ---- 공간 추가: 공간 종류 → 크기 → 색 (사실은 먼저 채우고, 취향은 공간 안에서 고객이 고름) ----
        // 다 마칠 때까지는 공간 목록에 넣지 않음 (중간에 뒤로 나가면 아무것도 남지 않음)
        chooseRoomType: function(selectedName) {
            // 151번: 이름을 고친 공간이 있어도 겹치지 않게, 안 쓰인 가장 작은 번호 (안방 → 안방 2 → 안방 3)
            const usedNames = new Set(state.roomsCart.map(r => r.name));
            let displayName = selectedName, nameNo = 2;
            while (usedNames.has(displayName)) displayName = `${selectedName} ${nameNo++}`;
            state.editingRoomId = null;
            state.editingRoom = {
                name: displayName, roomType: selectedName, addDraft: true,
                sizeMode: 'full', spaceWidth: 0, spaceHeight: 0, partWidth: 0, partHeight: 0,
                width: 0, height: 0, items: [], windowDir: []
            }; // 41번, 43번
            goToStep("1.6-Add-Size");
        },
        // 크기 다음 색: 집 기본 색이 아직 없으면 색 재기, 있으면 "앞 공간과 같나요?"
        addRoomColor: function() {
            if (!state.editingRoom || !state.editingRoom.addDraft) return;
            if (houseColor()) { goToStep("1.7-Add-Same"); return; }
            window.concierge.measureNewRoom('both');
        },
        measureNewRoom: function(parts) {
            const d = state.editingRoom;
            if (!d || !d.addDraft) return;
            const house = houseColor(), first = !house;
            openMeasure(d.name, parts, `${d.name} 담기`, first ? `다음 공간부터는 "${withGwa(d.name)} 같아요"만 누르시면 됩니다.` : '',
                function(mc) { window.concierge.finishAddRoom(first ? 'first' : (parts === 'both' ? 'measured' : parts), mc); },
                function() { if (first) goToStep("1.8-Add-Dir"); else window.concierge.finishAddRoom('none'); },      // 첫 공간을 못 재면 창 방향만 따로 물음 (두 번째부터는 "같나요?" 화면에 있음)
                house ? house.bridgeK : undefined, true);      // 둘 다 다시 잴 때 막대는 집 기본 비율부터 · 결과 아래 창 방향 (35번)
        },
        // src: 'first'(첫 공간에서 잼 → 집 기본 색) · 'measured'(둘 다 다시 잼) · 'wall' · 'floor'(한쪽만 다시 잼) · 'house'(같아요) · 'none'(못 잼)
        finishAddRoom: function(src, mc, refId) {
            const d = state.editingRoom;
            if (!d || !d.addDraft) return;
            const house = houseColor();
            const ref = src === 'room' && state.roomsCart.find(r => r.id === refId);      // 146번: 고른 공간의 벽·바닥
            if (src === 'room' && !(ref && ref.measuredColor)) src = 'none';
            const isPart = d.sizeMode === 'part' && ((d.partWidth > 0) || (d.width > 0));
            const sW = Number(d.spaceWidth || d.width) || 0;
            const sH = Number(d.spaceHeight || d.height) || 0;
            const pW = Number(isPart ? (d.partWidth || d.width) : sW) || 0;
            const pH = Number(isPart ? (d.partHeight || d.height) : sH) || 0;
            const room = {
                id: newRoomId(), name: d.name, roomType: d.roomType,
                sizeMode: isPart ? 'part' : 'full',
                spaceWidth: sW, spaceHeight: sH,
                width: pW, height: pH, // 41번, 43번
                floorTone: "warm", wallTone: "cool", lightLevel: "mid", mood: "soft_warm",
                isConfigured: false, curtains: [], subtotal: 0,
                colorSrc: src === 'first' ? 'measured' : (src === 'none' ? null : (src === 'room' ? 'house' : src)),
                windowDir: windowDirOf(d.windowDir)      // 색 단계에서 고른 창 방향 (35번, "같아요"여도 이어받지 않음)
            };
            if (src === 'first' || src === 'measured') setRoomColor(room, mc);
            else if (src === 'room') setRoomColor(room, withBridge(ref.measuredColor.wall, ref.measuredColor.floor, ref.measuredColor.bridgeK));      // 146번: "○○과 같아요"
            else if (src === 'house' && house) setRoomColor(room, withBridge(house.wall, house.floor, house.bridgeK));      // "같아요": 비율도 첫 공간 것
            else if (src === 'wall' && mc) setRoomColor(room, withBridge(mc.wall, house && house.floor, house && house.bridgeK, mc.furniture));
            else if (src === 'floor' && mc) setRoomColor(room, withBridge(house && house.wall, mc.floor, house && house.bridgeK, mc.furniture));
            if (src === 'first' && mc && (mc.wall || mc.floor)) state.house = houseOf(mc, room.id);
            room.id = newRoomId();
            state.roomsCart.push(room);
            state.activeSpaceId = room.id;
            state.editingRoom = null;
            // 공간 추가 단계(종류·크기·같나요)는 뒤로 가기 목록에서 지움 → 중심 화면에서 ← 는 공간 추가 전 화면으로
            const at = stepHistory.map(x => x.step).lastIndexOf("1.5-Room-Type");
            if (at >= 0) stepHistory.length = at;
            if (stepHistory.length && stepHistory[stepHistory.length - 1].step === "1-Space") stepHistory.pop();
            goToStep("1-Space", false);
        },
        openRoomCart: function(roomId) {
            const target = state.roomsCart.find(r => r.id === roomId);
            if (!target) return;
            state.editingRoomId = roomId;
            state.editingRoom = loadEditing(target);
            // 117번: 벽·바닥을 이미 아는 공간은 빛 가림(2-Base-Block) 질문부터. 모르는 공간은 바닥·벽 카드부터
            const known = !!(roomPart(target, 'wall') && roomPart(target, 'floor'));
            state.editingRoom.askCards = target.isConfigured || !known;
            goToStep(state.editingRoom.askCards ? "2-Base-Floor" : "2-Base-Block");
        },
        // 빛 질문 위 칩의 "다르면 고치기": 바닥·벽 카드로 고친 뒤 다시 빛 질문으로
        fixRoomColors: function() {
            if (!state.editingRoom) return;
            state.editingRoom.fixing = true;
            goToStep("2-Base-Floor");
        },
        // 창 방향 버튼 (35번): 그 자리의 버튼만 다시 그림 (색 재기 화면이 위에 떠 있어도 같은 값)
        toggleDir: function(d) {
            const ed = state.editingRoom;
            if (!ed) return;
            let cur = windowDirOf(ed.windowDir);
            if (!d) { cur = []; ed.dirUnknown = true; }
            else if (cur.includes(d)) cur = cur.filter(x => x !== d);
            else if (!cur.includes(WINDOW_DIR_OPP[d]) && cur.length < 2) { cur.push(d); ed.dirUnknown = false; }
            ed.windowDir = cur;
            document.querySelectorAll('.dir-pick').forEach(el => { el.outerHTML = dirPickerHtml(!el.querySelector('.dir-pick-k')); });
        },
        dirPickerHtml: function() { return dirPickerHtml(); },
        // 창 방향 화면의 버튼: 공간 추가면 공간을 담고, "이렇게 들었어요"에서 왔으면 그 화면으로
        dirDone: function() {
            const ed = state.editingRoom;
            if (!ed) return;
            if (ed.addDraft) { window.concierge.finishAddRoom('none'); return; }
            prevStep();
        },
        // 글 질문: 한 번 누르면 점 → 0.25초 → 넘어감 (137번, 예전 76번 두 번 누르기)
        tapAskOpt: function(btn, fn) {
            if (!btn) return;
            pickThenGo(btn, btn.closest('.ask-stage') || document.body, '.ask-opt, .r-quiet', fn);
        },
        copyBaseFromPrev: function(same) {
            const src = copySourceRoom();
            if (same && src) {
                state.editingRoom.floorTone = src.floorTone;
                state.editingRoom.wallTone = src.wallTone;
                // 같은 바닥·벽이면 잰 색도 같이. 가구(37번)는 이어받지 않고 이 공간 것 그대로
                const own = state.editingRoom.measuredColor && state.editingRoom.measuredColor.furniture;
                const mc = src.measuredColor ? JSON.parse(JSON.stringify(src.measuredColor)) : null;
                if (mc) { delete mc.furniture; if (own && own.length) mc.furniture = own; }
                state.editingRoom.measuredColor = mc && (mc.wall || mc.floor || hasFurniture(mc)) ? mc : (own && own.length ? { wall: null, floor: null, bridge: null, furniture: own } : null);
                goToStep("2-Base-Block");      // 117번: 빛 질문이 없어져 빛 가림부터
            } else {
                goToStep("2-Base-Floor");
            }
        },
        selectFloorTone: function(tone) {
            if (!state.editingRoom.editOnly) cardPickInRoom('floor', tone);
            state.editingRoom.floorTone = tone;
            if (state.editingRoom.editOnly) { pickInEdit('floor'); return; }
            goToStep("2-Base-Wall");
        },
        selectWallTone: function(tone) {
            if (!state.editingRoom.editOnly) cardPickInRoom('wall', tone);
            state.editingRoom.wallTone = tone;
            if (state.editingRoom.editOnly) { pickInEdit('wall'); return; }
            if (state.editingRoom.fixing) {
                // "다르면 고치기"로 왔으면 바닥·벽 카드는 뒤로 가기 목록에서 빼고 빛 가림 질문으로 돌아감
                state.editingRoom.fixing = false;
                while (stepHistory.length && stepHistory[stepHistory.length - 1].step !== "2-Base-Block") stepHistory.pop();
                if (stepHistory.length) stepHistory.pop();
                goToStep("2-Base-Block", false);
                return;
            }
            goToStep("2-Base-Block");
        },
        // ---- 중심 화면: 공간 목차 선택 · 한 공간 크게 보기 ↔ 전체 한눈에 전환 (77번) ----
        selectSpaceRoom: function(roomId) {
            state.activeSpaceId = roomId;
            state.spaceViewAll = false;
            render();
        },
        toggleSpaceViewMode: function() {
            state.spaceViewAll = !state.spaceViewAll;
            render();
        },
        // ---- 중심 화면 › 수정하기 ----
        editRoom: function(roomId) {
            const r = state.roomsCart.find(x => x.id === roomId);
            if (!r) return;
            const size = roomSize(r) || { w: 340, h: 235 };
            state.editingRoomId = r.id;
            state.editingRoom = {
                id: r.id, name: r.name, editOnly: true, items: [],
                sizeMode: r.sizeMode || 'full',
                spaceWidth: r.spaceWidth || size.w,
                spaceHeight: r.spaceHeight || size.h,
                partWidth: r.sizeMode === 'part' ? size.w : null,
                partHeight: r.sizeMode === 'part' ? size.h : null,
                width: size.w, height: size.h,
                floorTone: r.floorTone, wallTone: r.wallTone, diagnosed: r.diagnosed, cardParts: r.cardParts ? Object.assign({}, r.cardParts) : null, colorSrc: r.colorSrc || null,
                measuredColor: r.measuredColor ? JSON.parse(JSON.stringify(r.measuredColor)) : null,
                windowDir: windowDirOf(r.windowDir)
            };
            goToStep("1-Space-Edit");
        },
        // 수정하기 맨 위 공간 이름 (151번): 치는 동안은 따로 들고 있다가 "저장"에서 들어감. 다시 그리지 않음(글자 치는 중 칸이 닫히지 않게)
        editRoomName: function(v) {
            if (state.editingRoom && state.editingRoom.editOnly) state.editingRoom.nameDraft = String(v == null ? '' : v);
        },
        editNameFocus: function() { hideKeypadDirectly(); },      // 크기 숫자판이 열려 있으면 닫음
        // 원단 화면에서 못 잰 벽·바닥 재기 (92번): 다 재면 원단 추천으로. "지금은 못 재요"면 카드로 넘기지 않고 같은 안내에 머묾
        measureForFabric: function(part) {
            const ed = state.editingRoom;
            if (!ed) return;
            openMeasure(ed.name, part, '이 색으로', '', function(mc) {
                const old = ed.measuredColor || {};
                const next = withBridge(part === 'wall' ? mc.wall : old.wall, part === 'floor' ? mc.floor : old.floor, old.bridgeK,
                    hasFurniture(mc) ? mc.furniture : old.furniture);
                setRoomColor(ed, next);
                if (ed.cardParts) delete ed.cardParts[part];
                ed.colorSrc = next.wall && next.floor ? 'measured' : part;
                render();
            }, function() { render(); });
        },
        // 벽·바닥 다시 재기: 공간 추가 때와 같은 색 재기 화면 (그 부분만). "지금은 못 재요"면 바닥·벽 카드 화면으로
        editRoomColor: function(part) {
            const ed = state.editingRoom;
            if (!ed || !ed.editOnly) return;
            openMeasure(ed.name, part, '이 색으로', '', function(mc) {
                const old = ed.measuredColor || {};
                const next = withBridge(part === 'wall' ? mc.wall : old.wall, part === 'floor' ? mc.floor : old.floor, old.bridgeK,
                    hasFurniture(mc) ? mc.furniture : old.furniture);      // 한쪽만 다시 재도 비율은 그대로 · 가구는 새로 찍었으면 새것, 아니면 그대로 (37번)
                setRoomColor(ed, next);
                if (ed.cardParts) delete ed.cardParts[part];      // 이제 그 부분은 잰 색
                // 집 기본 색에서 한쪽만 다시 쟀으면 "벽만/바닥만 따로 잰 색", 아니면 "이 공간에서 잰 색"
                ed.colorSrc = (ed.colorSrc === 'house' || ed.colorSrc === part) ? part : (next.wall && next.floor ? 'measured' : null);
                render();
            }, function() { goToStep(part === 'wall' ? "2-Base-Wall" : "2-Base-Floor"); });
        },
        // 수정하기의 가구 (66번): 'add' 찍어 담기 · 'del' 빼기 · 'open' 종류 칩 펼치기 · 'kind' 종류 바꾸기. 벽·바닥 색은 그대로
        editFur: function(act, i, n) {
            const ed = state.editingRoom;
            if (!ed || !ed.editOnly || !window.RoomColor) return;
            if (act === 'open') { ed.furOpen = i >= 0 ? i : null; render(); return; }
            ed.furOpen = null;
            RoomColor.furListEdit(ed.measuredColor && ed.measuredColor.furniture, act, i, n, ed.name, function(list) {
                if (state.editingRoom !== ed) return;
                ed.measuredColor = RoomColor.withFurniture(ed.measuredColor, list);
                render();
            });
        },
        // 중심 화면 공간 카드의 [+ 가구] (66번): 상담 전·후 언제든 가구 하나를 찍어 바로 담음 (빼기·종류 바꾸기는 수정하기에서)
        addFurniture: function(roomId) {
            const r = state.roomsCart.find(x => x.id === roomId);
            if (!r || !window.RoomColor) return;
            hideKeypadDirectly();
            RoomColor.furListEdit(r.measuredColor && r.measuredColor.furniture, 'add', -1, null, r.name, function(list) {
                const r2 = state.roomsCart.find(x => x.id === roomId);
                if (!r2) return;
                r2.measuredColor = RoomColor.withFurniture(r2.measuredColor, list);
                if (r2.isConfigured) syncToV1MasterRooms();
                spaceToast(`${r2.name}: 가구를 담았습니다`);
                render();
            });
        },
        editRoomUseHouse: function() {
            const ed = state.editingRoom, house = houseColor();
            if (!ed || !house) return;
            setRoomColor(ed, withBridge(house.wall, house.floor, house.bridgeK, ed.measuredColor && ed.measuredColor.furniture));      // 벽·바닥만 집 기본 색으로, 이 공간 가구는 그대로
            ed.colorSrc = 'house';
            ed.cardParts = null;
            render();
        },
        saveRoomEdit: function() {
            const ed = state.editingRoom, r = state.roomsCart.find(x => x.id === state.editingRoomId);
            if (!ed || !r) return;
            const isPart = ed.sizeMode === 'part' && ((ed.partWidth > 0) || (ed.width > 0));
            const sW = Number(ed.spaceWidth || ed.width) || r.spaceWidth || r.width;
            const sH = Number(ed.spaceHeight || ed.height) || r.spaceHeight || r.height;
            const pW = Number(isPart ? (ed.partWidth || ed.width) : sW) || r.width;
            const pH = Number(isPart ? (ed.partHeight || ed.height) : sH) || r.height;
            r.sizeMode = isPart ? 'part' : 'full';
            r.spaceWidth = sW;
            r.spaceHeight = sH;
            r.width = pW;
            r.height = pH;
            r.floorTone = ed.floorTone; r.wallTone = ed.wallTone; r.measuredColor = ed.measuredColor || null;
            r.cardParts = ed.cardParts || null;
            r.colorSrc = ed.colorSrc || null;
            r.windowDir = windowDirOf(ed.windowDir);
            // 공간 이름 (151번): 비우면 원래 이름, 다른 공간과 같으면 뒤에 번호. 커튼 이름표("거실 겉지")의 앞부분도 같이 바꿔 견적서까지 새 이름으로
            const wantName = String(ed.nameDraft == null ? r.name : ed.nameDraft).trim().slice(0, 12);
            if (wantName && wantName !== r.name) {
                const otherNames = new Set(state.roomsCart.filter(x => x.id !== r.id).map(x => x.name));
                let newName = wantName, nameNo = 2;
                while (otherNames.has(newName)) newName = `${wantName} ${nameNo++}`;
                const oldName = r.name;
                if (!r.roomType) r.roomType = roomTypeOf(r);      // 옛 공간: 이름으로 알던 종류(침실·구성 추천)를 먼저 남김
                r.name = newName;
                (r.curtains || []).forEach(c => { if (c.label && c.label.startsWith(oldName)) c.label = newName + c.label.slice(oldName.length); });
            }
            // 첫 공간(집 기본 색을 잰 공간)을 다시 쟀으면 집 기본 색도 따라감
            if (state.house && state.house.roomId === r.id && r.measuredColor && r.measuredColor.wall && r.measuredColor.floor) state.house = houseOf(r.measuredColor, r.id);
            // 상담을 마친 공간: 커튼 크기도 같이 바꾸고 금액을 다시 셈 (고른 원단·옵션은 그대로)
            if (r.isConfigured) {
                r.curtains.forEach(c => { c.width = r.width; c.height = r.height; c.calc = calculateV1ItemPrice(c); });
                r.subtotal = r.curtains.reduce((s, c) => s + ((c.calc && c.calc.curtainSubtotal) || 0), 0);
                syncToV1MasterRooms();
            }
            state.editingRoom = null;
            backToSpace();
        },
        // ---- 수정하기 내 창 구성 전환 (48번): 이중 커튼 ↔ 속지 ↔ 겉지 ↔ 블라인드 ----
        switchComposition: function(targetType) {
            const ed = state.editingRoom, r = state.roomsCart.find(x => x.id === state.editingRoomId);
            if (!ed || !r) return;
            const curComp = roomComp(r) || 'double';
            if (targetType === curComp) return;

            // 수정하기 화면에서 바꾼 크기·벽·바닥·방향을 r에 먼저 저장 (작성 중이던 값이 날아가지 않도록)
            const isPart = ed.sizeMode === 'part' && ((ed.partWidth > 0) || (ed.width > 0));
            const sW = Number(ed.spaceWidth || ed.width) || r.spaceWidth || r.width;
            const sH = Number(ed.spaceHeight || ed.height) || r.spaceHeight || r.height;
            const pW = Number(isPart ? (ed.partWidth || ed.width) : sW) || r.width;
            const pH = Number(isPart ? (ed.partHeight || ed.height) : sH) || r.height;
            r.sizeMode = isPart ? 'part' : 'full';
            r.spaceWidth = sW;
            r.spaceHeight = sH;
            r.width = pW;
            r.height = pH;
            r.floorTone = ed.floorTone;
            r.wallTone = ed.wallTone;
            r.measuredColor = ed.measuredColor || null;
            r.cardParts = ed.cardParts || null;
            r.colorSrc = ed.colorSrc || null;
            r.windowDir = windowDirOf(ed.windowDir);

            // 1. 축소: 이중 커튼 → 속지만
            if (curComp === 'double' && targetType === 'sheer_only') {
                if (!confirm(`'${r.name}'의 겉지를 빼고 속지만 남길까요?`)) return;
                r.curtains = r.curtains.filter(c => c.presetType === 'sheer');
                r.subtotal = r.curtains.reduce((s, c) => s + ((c.calc && c.calc.curtainSubtotal) || 0), 0);
                syncToV1MasterRooms();
                spaceToast(`${r.name}: 겉지를 빼고 속지만 남겼습니다`);
                render();
                return;
            }

            // 2. 축소: 이중 커튼 → 겉지만
            if (curComp === 'double' && targetType === 'drape_only') {
                if (!confirm(`'${r.name}'의 속지를 빼고 겉지만 남길까요?`)) return;
                r.curtains = r.curtains.filter(c => c.presetType === 'drape');
                r.subtotal = r.curtains.reduce((s, c) => s + ((c.calc && c.calc.curtainSubtotal) || 0), 0);
                syncToV1MasterRooms();
                spaceToast(`${r.name}: 속지를 빼고 겉지만 남겼습니다`);
                render();
                return;
            }

            // 3. 확장: 속지만 → 이중 커튼 (기존 속지 유지, 겉지만 새로 선택)
            if (curComp === 'sheer_only' && targetType === 'double') {
                const sheerCurt = r.curtains.find(c => c.presetType === 'sheer');
                state.editingRoom = Object.assign({}, r, {
                    sizeKnown: true,
                    editOnly: false,
                    existingCurtains: sheerCurt ? [sheerCurt] : [],
                    items: [{ label: `${r.name} 겉지`, presetType: 'drape', fabricId: null, floorGap: 0 }]
                });
                state.pendingItemQueue = state.editingRoom.items;
                state.currentItemIndex = 0;
                goToStep("3.5-Bridge");
                return;
            }

            // 4. 확장: 겉지만 → 이중 커튼 (기존 겉지 유지, 속지만 새로 선택)
            if (curComp === 'drape_only' && targetType === 'double') {
                const drapeCurt = r.curtains.find(c => c.presetType === 'drape');
                state.editingRoom = Object.assign({}, r, {
                    sizeKnown: true,
                    editOnly: false,
                    existingCurtains: drapeCurt ? [drapeCurt] : [],
                    items: [{ label: `${r.name} 속지`, presetType: 'sheer', fabricId: null, floorGap: 0 }]
                });
                state.pendingItemQueue = state.editingRoom.items;
                state.currentItemIndex = 0;
                goToStep(stepAfterComp(state.editingRoom));      // 117번: 집에서 처음 속지면 속지 결부터
                return;
            }

            // 5. 교체: 블라인드로 변경
            if (targetType === 'blind_only') {
                if (r.curtains.length && !confirm(`'${r.name}'의 기존 커튼을 블라인드로 바꿀까요?\n(새 블라인드 종류를 선택하게 됩니다)`)) return;
                r.curtains = [];
                state.editingRoom = Object.assign({}, r, {
                    sizeKnown: true,
                    editOnly: false,
                    existingCurtains: [],
                    items: [{ label: `${r.name} 블라인드`, presetType: 'blind', fabricId: null, floorGap: 0 }]
                });
                state.pendingItemQueue = state.editingRoom.items;
                state.currentItemIndex = 0;
                goToStep("2-Base-BlindKind");
                return;
            }

            // 6. 교체: 블라인드에서 커튼으로 변경
            if (curComp === 'blind_only') {
                if (r.curtains.length && !confirm(`'${r.name}'의 블라인드를 커튼으로 바꿀까요?\n(새 커튼 원단을 선택하게 됩니다)`)) return;
                r.curtains = [];
                if (targetType === 'double') {
                    state.editingRoom = Object.assign({}, r, {
                        sizeKnown: true,
                        editOnly: false,
                        existingCurtains: [],
                        items: [
                            { label: `${r.name} 속지`, presetType: 'sheer', fabricId: null, floorGap: 0 },
                            { label: `${r.name} 겉지`, presetType: 'drape', fabricId: null, floorGap: 0 }
                        ]
                    });
                    state.pendingItemQueue = state.editingRoom.items;
                    state.currentItemIndex = 0;
                    goToStep(stepAfterComp(state.editingRoom));      // 117번: 집에서 처음 속지면 속지 결부터
                } else if (targetType === 'sheer_only') {
                    state.editingRoom = Object.assign({}, r, {
                        sizeKnown: true,
                        editOnly: false,
                        existingCurtains: [],
                        items: [{ label: `${r.name} 속지`, presetType: 'sheer', fabricId: null, floorGap: 0 }]
                    });
                    state.pendingItemQueue = state.editingRoom.items;
                    state.currentItemIndex = 0;
                    goToStep(stepAfterComp(state.editingRoom));      // 117번: 집에서 처음 속지면 속지 결부터
                } else if (targetType === 'drape_only') {
                    state.editingRoom = Object.assign({}, r, {
                        sizeKnown: true,
                        editOnly: false,
                        existingCurtains: [],
                        items: [{ label: `${r.name} 겉지`, presetType: 'drape', fabricId: null, floorGap: 0 }]
                    });
                    state.pendingItemQueue = state.editingRoom.items;
                    state.currentItemIndex = 0;
                    goToStep("3.5-Bridge");
                }
                return;
            }

            // 7. 교체: 속지만 ↔ 겉지만 상호 교체
            if (curComp === 'sheer_only' && targetType === 'drape_only') {
                if (r.curtains.length && !confirm(`'${r.name}'의 기존 속지를 정리하고 겉지로 바꿀까요?\n(새 겉지 원단을 선택하게 됩니다)`)) return;
                r.curtains = [];
                state.editingRoom = Object.assign({}, r, {
                    sizeKnown: true,
                    editOnly: false,
                    existingCurtains: [],
                    items: [{ label: `${r.name} 겉지`, presetType: 'drape', fabricId: null, floorGap: 0 }]
                });
                state.pendingItemQueue = state.editingRoom.items;
                state.currentItemIndex = 0;
                goToStep("3.5-Bridge");
                return;
            }

            if (curComp === 'drape_only' && targetType === 'sheer_only') {
                if (r.curtains.length && !confirm(`'${r.name}'의 기존 겉지를 정리하고 속지로 바꿀까요?\n(새 속지 원단을 선택하게 됩니다)`)) return;
                r.curtains = [];
                state.editingRoom = Object.assign({}, r, {
                    sizeKnown: true,
                    editOnly: false,
                    existingCurtains: [],
                    items: [{ label: `${r.name} 속지`, presetType: 'sheer', fabricId: null, floorGap: 0 }]
                });
                state.pendingItemQueue = state.editingRoom.items;
                state.currentItemIndex = 0;
                goToStep(stepAfterComp(state.editingRoom));      // 117번: 집에서 처음 속지면 속지 결부터
                return;
            }
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
            if (state.editingRoom.flow) { saveDraft(state.editingRoom); flowNext(); return; }      // 152번: 같은 공간 구성으로
            goToStep("3-Config-Style");        // 빛 가림·바깥 시선을 근거로 구성 추천
        },
        selectSheerFeel: function(feel) {
            // 117번: 속지 결은 우리 집 취향에 한 번 저장 (상담란과 같은 칸)
            if (state.editingRoom && state.editingRoom.flow) {      // 123번: 이 공간에만 담고 다음으로
                state.editingRoom.sheerFeel = feel;
                const t = state.roomsCart.find(r => r.id === state.editingRoomId);
                if (t) t.sheerFeel = feel;
                flowNext();
                return;
            }
            if (typeof setHouseTaste === 'function') setHouseTaste('sheer', { smooth: 'smooth', textured: 'texture', cozy: 'thick', any: 'unknown' }[feel] || 'unknown');
            if (!state.editingRoom) {
                todoRooms().forEach(r => { if (planHas(r, 'sheer')) r.sheerFeel = feel; });
                flowNext();
                return;
            }
            state.editingRoom.sheerFeel = feel;
            state.editingRoom.askSheer = false;
            const hasBlind = (state.editingRoom.items || []).some(i => i.presetType === 'blind');
            goToStep(hasBlind ? "2-Base-BlindKind" : "3.5-Bridge");
        },
        selectBlindKind: function(kind) {
            if (state.editingRoom && state.editingRoom.flow) {      // 123번: 이 공간에만 담고 다음으로
                state.editingRoom.blindWant = kind;
                const t = state.roomsCart.find(r => r.id === state.editingRoomId);
                if (t) t.blindWant = kind;
                flowNext();
                return;
            }
            if (!state.editingRoom) {
                todoRooms().forEach(r => { if (planHas(r, 'blind')) r.blindWant = kind; });
                flowNext();
                return;
            }
            state.editingRoom.blindWant = kind;
            goToStep("3.5-Bridge");
        },
        chooseWindowComposition: function(type) {
            const ed = state.editingRoom;
            // 119번: 집 전체 흐름에서는 구성만 정해 두고(원단은 ⑤에서) 다음으로
            if (ed && ed.flow) {
                const t = state.roomsCart.find(r => r.id === state.editingRoomId);
                if (t) { t.planComp = type; t.planPicked = true; t.compOk = true; }
                saveOwnTaste(ed);
                flowNext();
                return;
            }
            setCompItems(ed, type);
            state.pendingItemQueue = ed.items;
            state.currentItemIndex = 0;
            // 117번: (집에서 처음 속지면 속지 결) → 블라인드면 종류 → 원단 찾는 중 (상담을 마친 공간을 다시 상담할 때)
            goToStep(stepAfterComp(ed));
        },
        flowNext: function() { flowNext(); },
        // 기법 고르기 (120번): 고른 기법(빈칸 = 맡김)으로 원단 3장. 뒤로 가면 이 화면으로 돌아와 다른 기법을 고를 수 있음
        previewPointTech: function(k) {      // 146번: 포인트 방식 설명 보기 / 목록으로 돌아가기
            state.pointPreview = k || null;
            render();
        },
        pickPointTech: function(k) {
            const ed = state.editingRoom;
            if (!ed) return;
            state.pointPreview = null;
            ed.pointTech = k || null;
            ed.pointAsked = true;
            state.seekNow = true;      // 140번: 같은 자리에서 원단 고르는 화면으로 (뒤로 오면 다시 기법부터)
            render();
        },
        // "원단 보기" (140번): 다 고른 뒤에만 눌림 — 고르는 중에는 무시
        proceedToFabricQueue: function() {
            const st = document.getElementById('fabSeekStage');
            if (state.seeking || !st || !st.classList.contains('is-done')) return;
            st.classList.remove('is-done');      // 두 번 눌러도 한 번만
            state.seekNow = false;
            goToStep("4-Fabric-Queue");
        },
        // 목록에 없는 블라인드 종류(우드·알루미늄 등, 38-2): 실물 샘플 안내 후 바로 공간에 담음
        proceedSampleBlind: function() {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const bw = (state.editingRoom && state.editingRoom.blindWant) || 'wood';
            if (item) {
                item.fabricId = '_sample_' + bw;
                item.colorName = '';
            }
            if (state.currentItemIndex + 1 < state.pendingItemQueue.length) {
                stepHistory.push({ step: state.step, idx: state.currentItemIndex });
                state.currentItemIndex++;
                goToStep("3.5-Bridge", false);
            } else if (state.editingRoom.sizeKnown) {
                if (state.editingRoom.items.some(i => i.presetType === "sheer" || i.presetType === "drape")) goToStep("6-Finish");
                else window.concierge.commitRoomCart();
            } else {
                goToStep("6-Measure");
            }
        },
        // 색상 카드 넘기기: dir 1 = 다음 색, -1 = 이전 색 (끝에서 한 바퀴 돌아 처음으로)
        stepColor: function(fabId, dir) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            const best = bestColorFor(fabric, roomWithTaste(state.editingRoom), cat);
            const order = colorDeckOrder(best);
            if (order.length < 2) return;
            state.colorPick = state.colorPick || {};
            const cur = Math.max(0, order.indexOf(state.colorPick[fabId] || order[0]));
            const next = order[(cur + dir + order.length) % order.length];
            state.colorPick[fabId] = next;
            refreshMini(fabId, next);      // 104번
            const panel = Array.from(document.querySelectorAll('.fab-panel')).find(p => p.getAttribute('data-fab') === fabId);
            if (!panel) { render(); return; }
            const idx = parseInt(panel.getAttribute('data-idx') || '0', 10);
            swapFabricPanel(panel, fabricCardHtml(fabric, best, idx, next, item, cat), fabric.id, next);
        },
        // 뒤 색 띠를 눌렀을 때: 그 색을 앞으로
        showColor: function(fabId, colorName) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            const best = bestColorFor(fabric, roomWithTaste(state.editingRoom), cat);
            const order = colorDeckOrder(best);
            if (!order.includes(colorName)) return;
            state.colorPick = state.colorPick || {};
            state.colorPick[fabId] = colorName;
            refreshMini(fabId, colorName);      // 104번
            const panel = Array.from(document.querySelectorAll('.fab-panel')).find(p => p.getAttribute('data-fab') === fabId);
            if (!panel) { render(); return; }
            const idx = parseInt(panel.getAttribute('data-idx') || '0', 10);
            swapFabricPanel(panel, fabricCardHtml(fabric, best, idx, colorName, item, cat), fabric.id, colorName);
            // 펼친 상태에서 색을 골라도 접지 않음 — "접기" 버튼(또는 칸 밖 누르기·뒤로)을 눌러야만 접힘 (10-15 사장님)
        },
        handleQueueFabricClick: function(fabId) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            const fabric = getLiveDb().find(f => f.id === fabId) || {};
            const cat = item.presetType === 'blind' ? '블라인드' : (item.presetType === 'sheer' ? '속지' : '겉지');
            if (Date.now() - (state.swipedAt || 0) < 450) return;      // 카드를 밀고 난 직후의 클릭은 무시
            const best = bestColorFor(fabric, roomWithTaste(state.editingRoom), cat);
            state.colorPick = state.colorPick || {};
            const order = colorDeckOrder(best);
            const chosen = state.colorPick[fabId] || order[0] || '';
            // 137번: 한 번 누르면 이름 위 점 + 다른 카드 옅게 → 0.25초 → 고름 (예전 110번 비춰 보기 → 한 번 더)
            const card = document.querySelector(`.fab-panel .bookmark-card[data-fab="${fabId}"]`);
            const go = () => window.concierge.pickQueueFabric(fabId, chosen);
            if (card) pickThenGo(card, card.closest('.bookmark-canvas') || document.body, '.bookmark-card', go); else go();
        },
        pickQueueFabric: function(fabId, chosen) {
            const item = state.pendingItemQueue[state.currentItemIndex];
            item.fabricId = fabId;
            item.colorName = chosen;
            state.colorPick = {};

            if (state.currentItemIndex + 1 < state.pendingItemQueue.length) {
                stepHistory.push({ step: state.step, idx: state.currentItemIndex });      // 뒤로 가면 이 칸(속지) 원단 화면으로
                state.currentItemIndex++;
                goToStep("3.5-Bridge", false);
            } else if (state.editingRoom.sizeKnown) {
                // 크기는 공간 추가 때 적었음 → 마무리(옵션). 블라인드만이면 고를 옵션이 없으니 바로 마침
                if (state.editingRoom.items.some(i => i.presetType === "sheer" || i.presetType === "drape")) goToStep("6-Finish");
                else window.concierge.commitRoomCart();
            } else {
                goToStep("6-Measure");
            }
        },
        // 139번: 형상기억·호텔핏 빼기/넣기, 밑단 시접/리드밴드
        toggleFinishOpt: function(key) {
            if (!state.editingRoom || (key !== 'shapeFee' && key !== 'hotelFit')) return;
            state.editingRoom[key] = !state.editingRoom[key];
            refreshFinishOpts(`[data-k="${key}"]`);
        },
        setHem: function(lead) {
            if (!state.editingRoom) return;
            state.editingRoom.leadBand = !!lead;
            refreshFinishOpts(`[data-hem="${lead ? 1 : 0}"]`);
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
                        baseFabricId: item.fabricId,
                        baseColorName: item.colorName || '',
                        custPicked: !!item.fabricId,      // 손님이 고객 화면에서 고른 원단 → 직원 화면 자동 채움이 덮지 않음 (116번)
                        installType: isBlind ? 'none' : (item.presetType === 'panel' ? 'rail_2line' : 'rail'),
                        floorGap: item.floorGap || 0,
                        hwName: isBlind ? '블라인드 일체형' : (item.presetType === 'panel' ? '2줄 패널 레일' : '기본 레일'),
                        hwPrice: isBlind ? 0 : hwPriceOf(item.presetType === 'panel' ? 'rail_2line' : 'rail'),      // 설정의 자당 단가 (29번)
                        shapeFee: isBlind ? 0 : ((item.presetType === 'drape' && state.editingRoom.shapeFee) ? 1 : 0),      // 켜짐 표시 (금액은 rates)
                        leadBand: isBlind ? false : Boolean(item.presetType === 'sheer' && state.editingRoom.leadBand),
                        hotelFit: isBlind ? false : Boolean(item.presetType === 'drape' && state.editingRoom.hotelFit)
                    };
                    cObj.rates = optionRatesNow(cObj.installType);      // 지금 설정의 가공·부자재 단가를 품목에 적어 둠 (나중에 단가를 바꿔도 이 견적은 그대로)
                    
                    cObj.calc = calculateV1ItemPrice(cObj);
                    roomSubSum += (cObj.calc.curtainSubtotal || cObj.calc.sellingPrice || 0);
                    return cObj;
                });

                // 기존 원단과 병합 (48번: 속지만 또는 겉지만 있는 공간에 다른 한쪽을 추가했을 때)
                let allCurtains = finalizedCurtains;
                const exist = (state.editingRoom.existingCurtains || []).slice();
                if (exist.length) {
                    exist.forEach(c => {
                        c.width = Number(state.editingRoom.width) || c.width;
                        c.height = Number(state.editingRoom.height) || c.height;
                        c.calc = calculateV1ItemPrice(c);
                    });
                    const combined = exist.concat(finalizedCurtains);
                    combined.sort((a, b) => {
                        const rank = k => (k === 'sheer' ? 1 : (k === 'drape' ? 2 : 3));
                        return rank(a.presetType) - rank(b.presetType);
                    });
                    combined.forEach((c, idx) => { c.id = (roomTarget.id * 100) + (idx + 1); });
                    allCurtains = combined;
                    roomSubSum = allCurtains.reduce((acc, c) => acc + ((c.calc && c.calc.curtainSubtotal) || c.calc.sellingPrice || 0), 0);
                }

                roomTarget.isConfigured = true;
                roomTarget.floorTone = state.editingRoom.floorTone;
                roomTarget.wallTone = state.editingRoom.wallTone;
                roomTarget.lightLevel = state.editingRoom.lightLevel;
                roomTarget.mood = state.editingRoom.mood;
                roomTarget.wantMood = state.editingRoom.wantMood || null;
                roomTarget.colorStrength = state.editingRoom.colorStrength || null;      // 강도·갈래 (98번)
                roomTarget.colorAccent = state.editingRoom.colorAccent || null;
                roomTarget.lightBlock = state.editingRoom.lightBlock || null;
                roomTarget.privacy = state.editingRoom.privacy || null;
                roomTarget.sheerFeel = state.editingRoom.sheerFeel || null;
                roomTarget.blindWant = state.editingRoom.blindWant || null;
                roomTarget.ownTaste = !!state.editingRoom.ownTaste;
                roomTarget.ownPres = state.editingRoom.ownPres || null;
                roomTarget.ownTex = state.editingRoom.ownTex || null;      // 이 공간만 다르게 (117번)
                roomTarget.pointTech = state.editingRoom.pointTech || null;      // 포인트 기법 (120번)
                roomTarget.roomType = state.editingRoom.roomType || roomTarget.roomType || null;
                roomTarget.measuredColor = state.editingRoom.measuredColor || null;
                roomTarget.colorSrc = state.editingRoom.colorSrc || null;
                roomTarget.cardParts = state.editingRoom.cardParts || null;
                roomTarget.linkDir = state.editingRoom.linkDir || null;
                roomTarget.windowDir = windowDirOf(state.editingRoom.windowDir);      // 창 방향 (35번)          // 색 잇기 답 (원단 추천·중심 화면 이유 한 줄)
                roomTarget.diagnosed = true;          // 바닥·벽·채광 진단을 거침 → 제안서에 진단 요약·추천 이유 표시
                roomTarget.curtains = allCurtains;
                roomTarget.subtotal = roomSubSum;
                roomTarget.width = Number(state.editingRoom.width) || roomTarget.width;
                roomTarget.height = Number(state.editingRoom.height) || roomTarget.height;
                state.justFilledRoomId = roomTarget.id;      // 중심 화면에서 이 공간의 색 칸이 차오름

                syncToV1MasterRooms();
            }
            goToStep("1-Space");
        },
        goToCheckout: function() {
            syncToV1MasterRooms();
            goToStep("7-Final-Dossier");
        },
        forgetPhotos: forgetPhotos,
        // 원단 사진 불러오기 실패 시 다음 확장자(.jpg → .webp → .png)를 시도하고, 모두 없으면 사진 칸을 없앰
        imgFallback: function(el) {
            const i = parseInt(el.getAttribute('data-i') || '0', 10) + 1;
            const urls = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(el.getAttribute('data-id'), el.getAttribute('data-color') || '') : [];
            if (i < urls.length) { el.setAttribute('data-i', i); el.src = urls[i]; } else { el.remove(); }
        },
        // 직원 화면 "원단 찾기"의 후보 보여주기 화면도 고객 화면과 같은 칸(세로 제목 + 짧은 글)을 씀
        bookmarkCard: renderBookmarkCard,
        // 원단 칸 글자: { name: 원단 이름(책자·괄호·가격·끝의 색 낱말 뺌), colorTag: 색 이름(없으면 끝의 색 낱말) }
        // ---- 중심 화면 › 더 보기 (app.js openSpaceMore가 씀) ----
        // 공간과 그 원단 칸: { room(공간 — 벽·바닥 잰 색 · 색 잇기 · 추천 점수에 쓰는 답), curtain, kind: 'sheer' | 'drape' }
        spaceSlot: function(roomId, idx) {
            const r = state.roomsCart.find(x => x.id === roomId), c = r && r.curtains[idx];
            return c ? { room: r, curtain: c, kind: c.presetType === 'sheer' ? 'sheer' : 'drape' } : null;
        },
        // 원단 바꾸기(swapCurtain) · 한 톤 밝게/진하게(toneSwap)는 space.js에 있음 (130-4④)
        shortFabName: shortFabName,
        // 색 잇기 방향의 말 ("원단을 고른 이유" 카드, app.js가 씀): linkSay = "벽과 이어지는 색", linkWhy = 이유 한 문장
        linkSay: function(dir) { return LINK_WORD[dir] || ''; },
        linkWhy: function(dir) { return LINK_WHY[dir] || ''; },
        // 최종 제안 화면의 쪽 넘기기 · 세로 모드 크게 보기(finalNext·finalPrev·toggleFinalZoom)는 final.js에 있음 (130-4③)
        linkWord: function(dir) { return { wall: '벽 색 기준', bridge: '벽·바닥 사이', floor: '바닥 색 기준' }[dir] || (/^fur\d$/.test(String(dir)) ? '가구 색 기준' : ''); },      // 98번: 가구      // 72번: 색 잇기 질문·더 보기 잇는 방향·지도 원 이름표
        cardNameParts: function(fabricId, colorTag) {
            const f = getLiveDb().find(x => x.id === fabricId);
            return f ? splitNameColor(f, colorTag || '') : null;
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
            if (state.step === "1-Space-Edit") { state.editingRoom = null; backToSpace(); return; }     // 수정하기 화면의 "이 공간 삭제"
            render();
        },
        // 직원 화면(B)에서 바꾼 공간·품목·시공비를 고객 화면에 반영 (B가 기준)
        // opts.replace: 상담을 통째로 바꿈(앱을 다시 열어 되살리기 · 상담 기록 불러오기) → 지금 목록의 상담 전 공간·집 기본 색은 버림
        // 아니면(직원 화면에서 돌아올 때 등) 직원 목록에 없는 상담 전 공간을 뒤에 그대로 둠
        loadFromMaster: function(masterRooms, installFee, opts) {
            const replace = !!(opts && opts.replace);
            if (replace) state.house = null;
            const inProgress = replace ? [] : state.roomsCart.filter(r => !r.isConfigured && !masterRooms.some(m => m.name === r.name));
            const mapped = masterRooms.map((r, i) => {
                const sub = r.curtains.reduce((acc, c) => acc + ((c.calc && c.calc.curtainSubtotal) || 0), 0);
                return {
                    id: newRoomId(), name: r.name,
                    floorTone: r.floorTone || 'warm', wallTone: r.wallTone || 'cool',
                    lightLevel: r.lightLevel || 'mid', mood: r.mood || 'soft_warm', wantMood: r.wantMood || null, colorStrength: r.colorStrength || null, colorAccent: r.colorAccent || null,
                    roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, diagnosed: !!r.diagnosed, ownTaste: !!r.ownTaste, ownPres: r.ownPres || null, ownTex: r.ownTex || null, pointTech: r.pointTech || null,      // 이 공간만 다르게 (115번, 고객 화면을 다녀와도 남게)
                    measuredColor: r.measuredColor || null,
                    planComp: r.planComp || null, planPicked: !!r.planPicked, compOk: !!r.compOk,      // 119번
                    width: Number(r.width) || null, height: Number(r.height) || null,
                    spaceWidth: Number(r.spaceWidth) || null, spaceHeight: Number(r.spaceHeight) || null, sizeMode: r.sizeMode || null,
                    colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),
                    isConfigured: r.curtains.length > 0,          // 공간 추가만 하고 아직 상담 전인 공간(커튼 없음)은 "상담하기"로
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
            state.house = null;
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
        // 중복 원단 정리: 고객 화면 공간 목록의 옛 원단 ID를 새 ID로 바꿔 닮 (55번)
        remapFabricIds: function(fix) { fix(state.roomsCart); },
        // 자동 저장용: 모든 공간 (계산 결과는 제외)
        // 직원 화면에 있는 동안의 자동 저장: 직원 화면 공간 목록에는 상담 전인 공간이 없으므로 이것을 더함
        getPendingRoomsForSave: function() {
            return window.concierge.getRoomsForSave().filter((r, i) => !state.roomsCart[i].isConfigured);
        },
        getRoomsForSave: function() {
            return state.roomsCart.map(r => ({          // 아직 상담 전인 공간도 (크기·벽·바닥 색을 먼저 담아 둠)
                name: r.name, floorTone: r.floorTone, wallTone: r.wallTone, lightLevel: r.lightLevel, mood: r.mood, wantMood: r.wantMood || null, colorStrength: r.colorStrength || null, colorAccent: r.colorAccent || null,
                roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, diagnosed: !!r.diagnosed, ownTaste: !!r.ownTaste, ownPres: r.ownPres || null, ownTex: r.ownTex || null, pointTech: r.pointTech || null,      // 이 공간만 다르게 (115번, 고객 화면을 다녀와도 남게)
                measuredColor: r.measuredColor || null,
                planComp: r.planComp || null, planPicked: !!r.planPicked, compOk: !!r.compOk,      // 119번: 집 전체 구성에서 정한 것 (상담 전 공간)
                width: r.width || null, height: r.height || null,
                spaceWidth: r.spaceWidth || null, spaceHeight: r.spaceHeight || null, sizeMode: r.sizeMode || null,
                colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),
                curtains: r.isConfigured ? r.curtains : []
            }));
        },
        // 바닥·벽 카드 이름 (직원 화면 "방 색 재기"가 자동으로 맞춘 카드를 보여 줄 때 씀)
        floorNames: FLOOR_NAMES,
        wallNames: WALL_NAMES,
        // 제안서 화면의 "견적서 저장" / "인쇄": 화면과 같은 디자인의 이미지를 만듦 (app.js)
        saveQuote: function() {
            syncToV1MasterRooms();
            if (typeof window.saveTicketImage === 'function') window.saveTicketImage();
        },
        // 카톡 글 복사 (62번): 이유 카드·견적서 내용을 글로 (app.js)
        copyQuoteText: function() {
            syncToV1MasterRooms();
            if (typeof window.copyTicketText === 'function') window.copyTicketText();
        },
        printQuote: function() {
            syncToV1MasterRooms();
            if (typeof window.printTicket === 'function') window.printTicket();
        },
        // 크기 측정 모드 전환: 전체(공간 치수) / 부분(창/커튼 치수) (43번)
        setSizeMode: function(mode) {
            const ed = state.editingRoom;
            if (!ed) return;
            ed.sizeMode = mode;
            if (mode === 'part') {
                if (ed.partWidth == null && ed.width) ed.partWidth = ed.width;
                if (ed.partHeight == null && ed.height) ed.partHeight = ed.height;
                if (!ed.spaceWidth && ed.width) ed.spaceWidth = ed.width;
                if (!ed.spaceHeight && ed.height) ed.spaceHeight = ed.height;
            } else if (mode === 'full') {
                if (ed.spaceWidth) ed.width = ed.spaceWidth;
                if (ed.spaceHeight) ed.height = ed.spaceHeight;
            }
            render();
        },
        // 치수 조금씩 바꾸기 (+100, −100, +1, −5 등, 41번, 43번). 0 미만 방지. 키패드가 열려 있으면 그 숫자도 함께 바뀜
        nudge: function(target, delta) {
            if (!state.editingRoom) return;
            const ed = state.editingRoom;
            const isPart = ed.sizeMode === 'part';
            let curVal = 0;
            if (target === 'width') curVal = isPart ? (ed.partWidth != null ? ed.partWidth : ed.width) : (ed.spaceWidth != null ? ed.spaceWidth : ed.width);
            else curVal = isPart ? (ed.partHeight != null ? ed.partHeight : ed.height) : (ed.spaceHeight != null ? ed.spaceHeight : ed.height);
            const v = Math.min(99999, Math.max(0, (parseInt(curVal, 10) || 0) + delta));
            if (target === 'width') {
                if (isPart) { ed.partWidth = v; ed.width = v; }
                else { ed.spaceWidth = v; ed.width = v; }
            } else {
                if (isPart) { ed.partHeight = v; ed.height = v; }
                else { ed.spaceHeight = v; ed.height = v; }
            }
            const boxVal = document.getElementById(`displayVal_${target}`);
            if (boxVal) boxVal.textContent = v;
            if (state.keypadTarget === target) {
                const kpDisp = document.getElementById("v2KeypadValueDisplay");
                if (kpDisp) kpDisp.textContent = v;
            }
        },
        openKeypad: function(target) {
            state.keypadTarget = target;
            document.querySelectorAll('.measure-box').forEach(el => el.classList.remove('is-active'));
            const targetBox = document.getElementById(`measureBox_${target}`);
            if (targetBox) targetBox.classList.add('is-active');

            const ed = state.editingRoom;
            const isPart = ed && ed.sizeMode === 'part';
            let curVal = 0;
            if (target === 'width') curVal = isPart ? (ed.partWidth != null ? ed.partWidth : ed.width) : (ed.spaceWidth != null ? ed.spaceWidth : ed.width);
            else curVal = isPart ? (ed.partHeight != null ? ed.partHeight : ed.height) : (ed.spaceHeight != null ? ed.spaceHeight : ed.height);

            const lbl = target === "width" ? "가로" : "세로";
            document.getElementById("v2KeypadTargetLabel").textContent = lbl;
            document.getElementById("v2KeypadValueDisplay").textContent = curVal;
            document.getElementById("v2VirtualKeypadSheet").classList.add("active");
            positionKeypad(target);
        },
        closeKeypad: function() {
            hideKeypadDirectly();
        },
        pressKey: function(k) {
            if (!state.keypadTarget || !state.editingRoom) return;
            const ed = state.editingRoom;
            const isPart = ed.sizeMode === 'part';
            let curVal = 0;
            if (state.keypadTarget === 'width') curVal = isPart ? (ed.partWidth != null ? ed.partWidth : ed.width) : (ed.spaceWidth != null ? ed.spaceWidth : ed.width);
            else curVal = isPart ? (ed.partHeight != null ? ed.partHeight : ed.height) : (ed.spaceHeight != null ? ed.spaceHeight : ed.height);

            let val = String(curVal || "0");
            if (k === "C") val = "0";
            else if (k === "DEL") val = val.length > 1 ? val.slice(0, -1) : "0";
            else val = val === "0" ? k : (val + k).slice(0, 5);

            const v = parseInt(val, 10);
            if (state.keypadTarget === 'width') {
                if (isPart) { ed.partWidth = v; ed.width = v; }
                else { ed.spaceWidth = v; ed.width = v; }
            } else {
                if (isPart) { ed.partHeight = v; ed.height = v; }
                else { ed.spaceHeight = v; ed.height = v; }
            }
            document.getElementById("v2KeypadValueDisplay").textContent = v;

            const boxVal = document.getElementById(`displayVal_${state.keypadTarget}`);
            if (boxVal) boxVal.textContent = v;
        },
        // 최종 제안의 시공비 입력: 직원 화면과 맞춘 뒤 세로 제안서 합계는 즉시 갱신하고 종이는 잠깐 기다렸다가 다시 그림 (40-2)
        updateInstallFee: function(val) {
            state.installFee = parseFloat(val) || 0;
            syncToV1MasterRooms();
            const totEl = document.getElementById('totalGrandPrice');
            const edTot = document.getElementById('finEdTotalNum');
            if (totEl && edTot) edTot.textContent = totEl.textContent;
            document.querySelectorAll('.fin-fee input, .fin-ed-fee-in').forEach(inp => {
                if (inp !== document.activeElement) inp.value = state.installFee;
            });
            queueFinalPaper();
        },
        scrollFinalSec: function(secId) {
            const el = document.getElementById(secId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
})();
