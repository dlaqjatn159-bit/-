(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['concierge.js']='20261049';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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

    // 속지 느낌 카드 배경: photos/feel/ 의 속지 장면 사진(분위기 사진과 같은 세트, 실제 원단 사진 아님). 사진이 안 뜨면 색 질감이 보임 (10-15)
    //  기기에 같은 이름의 사진을 넣었으면 그것을 먼저 (34번 덧붙임, data.js scenePhotoUrl)
    function sheerFeelBg(name, fallback) {
        return `url('${scenePhotoUrl('feel', name)}') center / cover no-repeat, ${fallback}`;
    }

    // 분위기 카드 배경: photos/mood/ 의 분위기용 사진(원단·시공 사진 아님). 사진이 안 뜨면 예전 색 질감이 보임
    function moodBg(name, fallback) {
        return `url('${scenePhotoUrl('mood', name)}') center / cover no-repeat, ${fallback}`;
    }

    // 창 구성·블라인드 종류 카드 배경 (38번): photos/comp/, photos/blind/ 사진. 기기 사진이 있으면 먼저, 안 뜨면 색 질감
    function compBg(name, fallback) {
        return `url('${scenePhotoUrl('comp', name)}') center / cover no-repeat, ${fallback}`;
    }
    function blindBg(name, fallback) {
        return `url('${scenePhotoUrl('blind', name)}') center / cover no-repeat, ${fallback}`;
    }

    // 분위기·속지 느낌·창 구성·블라인드 종류 사진을 미리 받기: 앱을 켜면 뒤에서 받아 두고 decode(그릴 준비)까지 끝내 둠
    // → 화면이 열리자마자 사진이 있어서 "색 바탕 → 사진" 깜빡임이 없음 (10-15, 38번)
    let finalPage = 0, finalCardCount = 0, finalHouseCount = 0, finalZoom = false, lastRenderedStep = null;      // 최종 제안의 쪽 넘기기·크게 보기(39번). cardCount = 견적서 앞 쪽 수(우리 집 색 포함)
    const PICK_PAUSE_MS = 220;      // 고르고 다음 화면으로 넘어가기 전 쉬는 시간(밀리초). 450일 때 "렉 같다"는 말이 있어 줄임(10-15). 더 여유를 주려면 300~350
    const MOOD_PHOTOS = SCENE_PHOTOS.mood;
    const FEEL_PHOTOS = SCENE_PHOTOS.feel;   // 속지 느낌 3장도 같이 미리 받음 (10-15)
    const COMP_PHOTOS = SCENE_PHOTOS.comp || [];   // 창 구성 4장 (38-1)
    const BLIND_PHOTOS = SCENE_PHOTOS.blind || []; // 블라인드 종류 4장 (38-2)
    (function preloadMoodPhotos() {
        // 기기 사진을 다 읽은 뒤, 기기에 있는 것은 기기 사진을 (34·38번)
        const run = () => DevicePhotos.ready.then(() => []
            .concat(MOOD_PHOTOS.map(n => scenePhotoUrl('mood', n)))
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
            lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null,
            diagnosed: !!r.diagnosed,
            measuredColor: r.measuredColor || null,      // 직원 화면 "방 색 재기"로 잰 벽·바닥 색 (room-color.js)
            width: r.width || null, height: r.height || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),      // 공간 추가 때 정한 크기·색 출처 (중심 화면)
            curtains: r.curtains.map((c, cIdx) => {
                const isBlind = c.presetType === "blind";
                let realFab = liveDb.find(f => f.id === c.fabricId) || (typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null);
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

    function goToStep(nextStep, pushHistory) {
        hideKeypadDirectly();
        const optOv = document.getElementById('optInfoOverlay');
        if (optOv) optOv.style.display = 'none';
        // 몇 번째 칸(속지·겉지)이었는지도 같이 적어 둠 → 뒤로 가면 겉지에서 속지 고르기로 돌아감
        if (pushHistory !== false && state.step !== nextStep) {
            stepHistory.push({ step: state.step, idx: state.currentItemIndex });
        }
        state.step = nextStep;
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
        if (state.step === "7-Final-Dossier" && finalPage > 0) { setFinalPage(finalPage - 1); return; }      // 견적서 쪽에서 ← 는 먼저 앞 쪽으로
        if (collapseMoodCards(document.querySelector(".bookmark-canvas.has-expand"))) return;
        hideKeypadDirectly();
        if (stepHistory.length > 0) {
            const prev = stepHistory.pop();
            state.currentItemIndex = prev.idx || 0;
            goToStep(prev.step, false);
        }
    }

    function updatePrevButtonVisibility() {
        const btn = document.getElementById("v2FloatingPrevBtn");
        if (!btn) return;
        const canGoBack = stepHistory.length > 0;
        // 오른쪽 위 글자 버튼 묶음: 안 쓰는 버튼은 자리째 감춰서 남은 버튼이 오른쪽 끝에 붙음 (40번 뒤 10-17)
        btn.style.display = canGoBack ? "" : "none";
        // 처음으로: 공간 화면·최종 제안에서만 보임
        const home = document.getElementById("v2HomeBtn");
        if (home) {
            const show = state.step === "1-Space" || state.step === "7-Final-Dossier";
            home.style.display = show ? "" : "none";
        }
    }

    // 화면 위 가운데: 지금 무엇을 고르는지 짧은 질문 + 진행 점
    function roomTypeOf(room) {
        return String((room && (room.roomType || room.name)) || '').replace(/\s*\d+$/, '');
    }
    // 공간 안 흐름 (20번): (벽·바닥을 모르는 공간만 바닥·벽 카드) → 빛 → 빛 가림 → 바깥 시선 → 구성
    //   → (잰 공간·커튼만) 우리 집 색 → 색 잇기 → 분위기 → (속지 느낌) → 원단 → 마무리(옵션)
    function diagnosisSteps() {
        const ed = state.editingRoom || {}, items = ed.items || [];
        const steps = ed.askCards ? ["2-Base-Floor", "2-Base-Wall"] : [];
        steps.push("2-Base-Light", "2-Base-Block", "2-Base-Privacy", "3-Config-Style");
        steps.push("2-Base-Home");          // "이렇게 들었어요. 맞나요?" — 모든 공간 (23번)
        if (canLink(ed)) steps.push("2-Base-Link");
        steps.push("2-Base-Mood");
        if (state.step === "2-Base-SheerFeel" || items.some(i => i.presetType === 'sheer')) steps.push("2-Base-SheerFeel");
        if (state.step === "2-Base-BlindKind" || items.some(i => i.presetType === 'blind')) steps.push("2-Base-BlindKind");
        return steps;
    }
    // 고른 블라인드 종류가 지금 단가표 목록에 있는지 확인 (우드·알루미늄처럼 아직 목록에 없으면 실물 샘플 안내로, 38-2)
    function hasBlindKindInPool(want) {
        if (!want || want === 'any') return true;
        return getLiveCategoryPool('블라인드').some(f => typeof blindKind === 'function' && blindKind(f) === want);
    }
    // 색 잇기를 물을 수 있는 공간: 벽·바닥을 둘 다 잰 색이 있고(카드로만 고른 공간은 아님), 블라인드가 아님 (블라인드 색 데이터 없음)
    function canLink(ed) {
        const mc = ed && ed.measuredColor;
        return !!(mc && mc.wall && mc.floor && mc.bridge) && !(ed.items || []).some(i => i.presetType === 'blind');
    }
    // "이렇게 들었어요" 화면에서 줄을 눌러 그 질문으로 가서 고치면, 답한 뒤 이 화면으로 돌아옴 (뒤로 가기 목록에 같은 화면이 쌓이지 않게 정리)
    function returnHomeIfFixing() {
        const ed = state.editingRoom;
        if (!ed || !ed.backHome) return false;
        ed.backHome = false;
        if (stepHistory.length && stepHistory[stepHistory.length - 1].step === "2-Base-Home") stepHistory.pop();
        goToStep("2-Base-Home", false);
        return true;
    }
    const HEARD = {
        lightLevel: { high: '햇빛이 풍부해요 · 낮엔 눈부실 수 있어요', mid: '햇빛이 은은해요 · 부드럽게 들어와요', low: '햇빛이 차분해요 · 낮에도 조금 어두울 수 있어요' },
        lightBlock: { light: '빛은 들어와도 좋아요', soft: '눈부심만 줄이고 싶어요', dark: '빛을 거의 막고 싶어요' },
        privacy: { open: '밖의 시선은 신경 쓰이지 않아요', some: '낮엔 적당히 가려지면 좋아요', high: '밖에서 잘 안 보였으면 해요' }
    };
    const HEARD_COMP = { double: '이중 커튼 · 호텔처럼', sheer_only: '속지 커튼 · 은은한 채광', drape_only: '겉지 커튼 · 빛 차단', blind_only: '블라인드 · 창틀 안에 깔끔하게' };
    function compKeyOf(ed) {
        const t = (ed.items || []).map(i => i.presetType);
        if (t.includes('blind')) return 'blind_only';
        if (t.includes('sheer') && t.includes('drape')) return 'double';
        if (t.includes('sheer')) return 'sheer_only';
        if (t.includes('drape')) return 'drape_only';
        return null;
    }
    const LINK_WORD = { wall: '벽과 이어지는 색', bridge: '벽과 바닥 사이를 잇는 색', floor: '바닥 톤을 따르는 색' };
    const LINK_WHY = { wall: '커튼이 벽에 녹아들어 공간이 넓어 보여요.', bridge: '벽과 바닥을 이어 주어 공간이 차분하게 하나로 보여요.', floor: '바닥과 같은 계열의 색이라 따뜻하고 안정감 있어요.' };      // 24번(10-15): "창"→"커튼", "결"→"계열의 색"
    // 색 잇기 방향과 어울리는 분위기 카드 (추천 표시만, 점수는 그대로 — 사장님이 써 보며 정함)
    const LINK_MOODS = { wall: ['urban_clean', 'airy_bright'], bridge: ['balanced_neutral'], floor: ['soft_warm', 'textured_linen'] };
    // 글 질문 화면 ("제안합니다" 화면과 같은 분위기): 큰 질문 + 글자 선택지. 사진이 필요 없는 질문에 사용
    function askStage(question, sub, opts, o) {
        o = o || {};
        const steps = diagnosisSteps(), at = steps.indexOf(state.step);
        let h = '<div class="ambient-stage ask-stage"><div class="ambient-light-glow"></div>';
        if (at >= 0) h += '<div class="step-dots ask-dots">' + steps.map((_, i) => `<span class="${i === at ? 'on' : (i < at ? 'done' : '')}"></span>`).join('') + '</div>';
        if (o.top) h += o.top;
        if (!o.noRoom && state.editingRoom && state.editingRoom.name) h += `<span class="q-meta">${state.editingRoom.name}</span>`;
        h += `<h2 class="q-title font-serif-kr">${question}</h2>`;
        if (sub) h += `<p class="q-sub">${sub}</p>`;
        if (o.extra) h += o.extra;
        h += `<div class="ask-opts${opts.length > 4 ? ' is-many' : ''}">`;
        opts.forEach(op => {
            h += `<button type="button" class="ask-opt${op.rec ? ' is-rec' : ''}${op.was ? ' was-picked' : ''}" onclick="${op.on}"><span class="ask-label font-serif-kr">${op.label}</span>${op.desc ? `<span class="ask-desc">${op.desc}</span>` : ''}${op.extra || ''}</button>`;
        });
        h += '</div></div>';
        return h;
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
    // 색을 어디서 가져왔는지 (공간 추가 때 정함): 이 공간에서 잼 / 집 기본 색 그대로 / 벽만·바닥만 따로 잼
    const COLOR_SRC_TEXT = { measured: '이 공간에서 잰 색', house: '집 기본 색과 같음', wall: '벽만 따로 잰 색', floor: '바닥만 따로 잰 색' };
    function roomColorSrc(wall, floor, r) {
        if (r && COLOR_SRC_TEXT[r.colorSrc] && (wall || floor)) return COLOR_SRC_TEXT[r.colorSrc];
        if (!wall && !floor) return '';
        const s = [wall, floor].map(p => p ? p.src : 'none');
        if (s[0] === s[1]) return s[0] === 'measured' ? '이 공간에서 잰 색' : '카드로 고른 색';
        if (s.includes('none')) return s[0] === 'none' ? '바닥만 정했어요' : '벽만 정했어요';
        return s[0] === 'measured' ? '벽은 잰 색 · 바닥은 카드로' : '바닥은 잰 색 · 벽은 카드로';
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
        let h = '<div class="dir-pick">' + (noTitle ? '' : '<span class="dir-pick-k">창은 어느 쪽을 보나요?</span>') + '<div class="dir-btns">';
        ['E', 'W', 'S', 'N'].forEach(d => {
            const on = cur.includes(d), off = !on && (cur.includes(WINDOW_DIR_OPP[d]) || cur.length >= 2);
            h += `<button type="button" class="dir-btn font-serif-kr${on ? ' on' : ''}"${off ? ' disabled' : ''} aria-pressed="${on}" onclick="event.stopPropagation(); window.concierge.toggleDir('${d}')">${WINDOW_DIR_WORD[d]}</button>`;
        });
        h += `<button type="button" class="dir-btn dir-none${ed.dirUnknown && !cur.length ? ' on' : ''}" onclick="event.stopPropagation(); window.concierge.toggleDir('')">잘 모르겠어요</button></div>`;
        h += `<span class="dir-pick-val">${txt ? `<b class="font-serif-kr">${txt}쪽 창</b>` : (ed.dirUnknown ? '방향은 몰라도 괜찮아요' : '두 곳까지 고를 수 있어요 · 남쪽과 동쪽이면 남동쪽')}</span></div>`;
        return h;
    }
    // ---- 중심 화면 끝 모습: 한 톤 밝게 / 진하게 · 더 보기에서 바꾸기 (20번 4단계) ----
    // 원단 찾기와 같은 목록(data.js finderEntries: 원단의 색 하나 = 한 장)을 씀. 화면을 그릴 때 한 번만 만듦
    let spaceEntries = null;
    function entryOf(fabricId, color) { return (spaceEntries || []).find(e => e.key === fabricId + '__' + (color || '')) || null; }
    // 같은 종류(겉지·속지) 가운데 노란기 차이가 작고(9 미만) 밝기만 한 단계 다른 색. 지금 색에 색 값이 없으면 없음
    function toneNeighbors(c) {
        const cur = entryOf(c.fabricId, c.colorName);
        if (!cur || cur.L == null || cur.b == null) return { lighter: null, darker: null };
        const pool = spaceEntries.filter(x => x.cat === cur.cat && x.key !== cur.key && x.hex && x.L != null && x.b != null && Math.abs(x.b - cur.b) < 9);
        // 같은 원단의 색을 먼저 (결·값이 그대로). 같은 원단에 없을 때만 다른 원단에서
        const pick = (list, gap) => {
            const same = list.filter(x => x.fabricId === cur.fabricId);
            return (same.length ? same : list).sort((p, q) => gap(p) - gap(q))[0] || null;
        };
        return {
            lighter: pick(pool.filter(x => x.L > cur.L + 1.5), x => (x.L - cur.L) + Math.abs(x.b - cur.b) * 0.3),
            darker: pick(pool.filter(x => x.L < cur.L - 1.5), x => (cur.L - x.L) + Math.abs(x.b - cur.b) * 0.3)
        };
    }
    // 고객에게 보여 줄 "원단 이름 + 색 이름" (예: 오솔로 아이보리)
    function shortFabName(fabricId, color) {
        const f = getLiveDb().find(x => x.id === fabricId);
        if (!f) return '';
        const label = (color && typeof colorLabelOf === 'function') ? colorLabelOf(fabricId, color) : '';
        const single = typeof getFabricColors === 'function' && getFabricColors(fabricId).length < 2;      // 색이 하나뿐이면 "1번"은 안 붙임 (10-17)
        const p = splitNameColor(f, label || (color ? (/^\d+$/.test(String(color)) ? (single ? '' : `${color}번`) : String(color)) : ''));
        return [p.name, p.colorTag].filter(Boolean).join(' ');
    }
    // 공간의 원단 한 칸을 다른 색(다른 원단일 수도)으로 바꿈. 금액은 다시 셈, 옵션은 그대로. 알림에 "되돌리기"
    // why: 원단을 고른 이유 카드용 칸 표시 (28번) — { toneStep: 한 톤 밝게 +1·진하게 −1을 더한 값, pickDir: 더 보기에서 고른 잇는 방향 }
    //  없는 값은 지움 (다른 방법으로 바꾸면 둘 다 지워짐). 되돌리기는 바꾸기 전 값으로
    function swapCurtain(roomId, idx, fabricId, color, silent, why) {
        const r = state.roomsCart.find(x => x.id === roomId), c = r && r.curtains[idx];
        if (!c) return;
        const prev = { fabricId: c.fabricId, colorName: c.colorName || '', toneStep: c.toneStep || 0, pickDir: c.pickDir || null };
        c.fabricId = fabricId; c.colorName = color || '';
        const w = why || {};
        if (w.toneStep) c.toneStep = w.toneStep; else delete c.toneStep;
        if (w.pickDir) c.pickDir = w.pickDir; else delete c.pickDir;
        c.calc = calculateV1ItemPrice(c);
        r.subtotal = r.curtains.reduce((s, x) => s + ((x.calc && x.calc.curtainSubtotal) || 0), 0);
        syncToV1MasterRooms();
        state.justFilledRoomId = r.id; state.justFilledIdx = idx;
        if (state.step === "1-Space") render();
        if (silent) return;
        const name = shortFabName(fabricId, color);
        spaceToast(`${r.name} ${kindOf(c)}: ${typeof finderJosa === 'function' ? finderJosa(name, '으로', '로') : name + '(으)로'} 바꿨어요`,
            () => swapCurtain(roomId, idx, prev.fabricId, prev.colorName, true, { toneStep: prev.toneStep, pickDir: prev.pickDir }));
    }
    // 고객 화면 알림 (아래 가운데, 짙은 갈색). 되돌리기가 있으면 3.5초, 없으면 1.8초
    let spaceToastTimer = 0;
    function spaceToast(msg, undo) {
        let t = document.getElementById('spaceToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'spaceToast'; t.className = 'space-toast'; t.setAttribute('role', 'status');
            t.innerHTML = '<span></span><button type="button">되돌리기</button>';
            document.body.appendChild(t);
        }
        t.querySelector('span').textContent = msg;
        const b = t.querySelector('button');
        b.hidden = !undo;
        b.onclick = () => { t.classList.remove('on'); if (undo) undo(); };
        t.classList.add('on');
        clearTimeout(spaceToastTimer);
        spaceToastTimer = setTimeout(() => t.classList.remove('on'), undo ? 3500 : 1800);
    }
    // ---- 중심 화면(1-Space): 가로 대화면에서는 왼쪽 여백 기둥(집 전체 호흡·기본 색·액션) + 오른쪽 2열 무박스 공간 보드 (40-1) ----
    function spaceHtml(currentCust) {
        spaceEntries = (typeof finderEntries === 'function') ? finderEntries() : [];
        const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const list = state.roomsCart, doneN = list.filter(r => r.isConfigured).length;
        const fresh = state.justFilledRoomId, freshIdx = state.justFilledIdx;        // 방금 원단을 고른 공간(한 톤 바꾸기면 그 칸만): 색 칸이 차오르는 움직임
        state.justFilledRoomId = null; state.justFilledIdx = null;
        const fillCls = (r, i) => (r.id === fresh && (freshIdx == null || freshIdx === i)) ? ' fill-in' : '';
        let h = '<div class="dos-stage"><div class="dos-sheet">';
        h += '<div class="dos-left">';
        h += '<div class="dos-top font-serif-kr"><h1 data-staff-hold>Re<i class="logo-dot">.</i>dam</h1><span class="dos-phase">공간에 담을 색</span></div>';
        h += `<p class="dos-who font-serif-kr">${currentCust && currentCust !== '고객' ? `${esc(currentCust)} 고객님` : '고객님'}의 공간</p>`;
        h += doneN ? '<h2 class="dos-lead font-serif-kr">공간에 담을 색이에요<small>한 톤씩 바꿔 보거나, 더 보기에서 다른 색을 찾아볼 수 있어요</small></h2>'
                   : `<h2 class="dos-lead font-serif-kr">먼저 크기와 색을<br>함께 살펴볼게요${list.length ? '<small>실측한 크기와 방에서 잰 벽·바닥·가구 색을 공간마다 담아 두었어요</small>' : ''}</h2>`;
        // 맨 위 공간 전체 색 띠: 처음엔 빈 띠, 공간마다 빈 칸이 생기고 원단을 고르면 그 칸이 색으로 채워짐
        const strip = list.length ? list.map(r => r.isConfigured && r.curtains.length
            ? r.curtains.map((c, i) => `<i class="${fillCls(r, i).trim()}" style="background:${colorFillOf(c.fabricId, c.colorName)}"></i>`).join('')
            : `<i style="background:${HATCH}"></i>`).join('') : `<i style="background:${HATCH}"></i>`;
        const cap = list.length ? list.map(r => `<span style="flex:${r.isConfigured && r.curtains.length ? r.curtains.length : 1}">${esc(r.name)}</span>`).join('') : '<span>공간을 담으면 여기에 색이 채워져요</span>';
        const flowStat = list.length ? (doneN === list.length ? `${list.length}곳 모두 담김` : (doneN ? `${list.length}곳 중 ${doneN}곳 담김` : `${list.length}곳 준비됨`)) : '';
        h += `<div class="dos-house"><div class="dos-house-lbl"><span>공간 전체 색 흐름</span><span>${flowStat}</span></div><div class="dos-house-strip">${strip}</div><div class="dos-house-cap">${cap}</div></div>`;
        // 이 집의 기본 벽·바닥·잇는 색 (왼쪽 기둥 아래 조용한 기준선, 40-1)
        const hc = houseColor();
        if (hc && ((hc.wall && hc.wall.hex) || (hc.floor && hc.floor.hex))) {
            const hWall = hc.wall && hc.wall.hex ? { hex: hc.wall.hex, name: measuredName('wall', hc.wall), src: 'measured' } : null;
            const hFloor = hc.floor && hc.floor.hex ? { hex: hc.floor.hex, name: measuredName('floor', hc.floor), src: 'measured' } : null;
            const hBr = (hWall && hFloor && window.RoomColor && RoomColor.bridgeOf) ? RoomColor.bridgeOf(hc.wall, hc.floor, hc.bridgeK) : null;
            h += '<div class="dos-base">';
            if (hWall) h += `<div class="dos-bc-row"><span class="dos-bc-k">벽</span><i style="background:${hWall.hex}"></i><span class="dos-bc-n">${esc(hWall.name)}</span>${hexCode(hWall)}</div>`;
            if (hFloor) h += `<div class="dos-bc-row"><span class="dos-bc-k">바닥</span><i style="background:${hFloor.hex}"></i><span class="dos-bc-n">${esc(hFloor.name)}</span>${hexCode(hFloor)}</div>`;
            if (hBr && hBr.hex) h += `<div class="dos-bc-row"><span class="dos-bc-k">잇는 색</span><i style="background:${hBr.hex}"></i><span class="dos-bc-n">벽·바닥 사이</span>${hexCode({ hex: hBr.hex, src: 'measured' })}</div>`;
            h += '</div>';
        }
        h += '</div>';

        h += '<div class="dos-right">';
        list.forEach(r => {
            const wall = roomPart(r, 'wall'), floor = roomPart(r, 'floor'), size = roomSize(r);
            const comp = r.isConfigured ? roomComp(r) : null;
            const dirTxt = windowDirText(windowDirOf(r.windowDir));
            const rmetaTxt = [dirTxt ? dirTxt + '쪽 창' : '', COMP_NAMES[comp] || ''].filter(Boolean).join(' · ');
            h += '<section class="dos-room">';
            h += `<div class="dos-rhead font-serif-kr"><span class="dos-rname">${esc(r.name)}<span class="dos-racts"><button type="button" onclick="window.concierge.editRoom(${r.id})">수정하기</button></span></span>`
                + (r.isConfigured ? `<span class="dos-rmeta">${esc(rmetaTxt)}</span>` : `<span class="dos-rhead-r">${dirTxt ? `<span class="dos-rmeta">${esc(dirTxt)}쪽 창</span>` : ''}<button type="button" class="dos-todo" onclick="window.concierge.openRoomCart(${r.id})">상담하기</button></span>`) + '</div>';
            // 크기 | 벽 · 바닥 · 가구 · 잇는 색 (벽이 위, 40-1)
            const wf = (k, p) => `<div class="dos-wfrow"><span class="dos-wfk">${k}</span><i style="background:${p ? p.hex : HATCH}"></i><span class="dos-wfn">${p ? esc(p.name) : '아직 안 쟀어요'}</span>${hexCode(p)}</div>`;
            const furs = (r.measuredColor && Array.isArray(r.measuredColor.furniture)) ? r.measuredColor.furniture.filter(f => f && f.hex) : [];
            const furRows = furs.map(f => {
                const fn = (window.RoomColor && RoomColor.furName) ? RoomColor.furName(f) : '';
                return `<div class="dos-wfrow is-fur"><span class="dos-wfk">${esc(f.n)}</span><i class="dos-fur-dm" style="background:${f.hex}"></i><span class="dos-wfn">${esc(fn)}</span>${hexCode({ hex: f.hex, src: 'measured' })}</div>`;
            }).join('');
            const src = roomColorSrc(wall, floor, r);
            h += '<div class="dos-prep">';
            h += `<div><div class="dos-k">크기</div><div class="dos-v">${size ? `${size.w} × ${size.h}` : '—'}</div><div class="dos-t">넓이 × 높이 (cm)</div></div>`;
            // 잇는 색 (벽·바닥을 둘 다 잰 공간): 색 조각 + 코드만
            const br = r.measuredColor && r.measuredColor.bridge && r.measuredColor.wall && r.measuredColor.floor ? r.measuredColor.bridge : null;
            const brRow = br ? `<div class="dos-wfrow is-bridge"><span class="dos-wfk">잇는 색</span><i style="background:${br.hex}"></i>${hexCode({ hex: br.hex, src: 'measured' })}</div>` : '';
            h += `<div class="dos-wf">${wf('벽', wall)}${wf('바닥', floor)}${furRows}${brRow}<div class="dos-t${src ? '' : ' is-warn'}">${src || '상담 때 카드로 골라요'}</div></div>`;
            h += '</div>';
            // 공간 색 띠: 벽 · 바닥 · 가구(첫 가구)는 처음부터, 원단 칸은 빗금으로 비어 있다가 고르면 채워짐 (40-1)
            const dark = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 120; };
            const seg = (k, bg, f, cls) => `<div class="${(dark(bg) ? 'is-dark' : '') + (cls || '')}" style="flex:${f};background:${bg || HATCH}"><span>${k}</span></div>`;
            const f0 = furs[0] || null;
            h += '<div class="dos-cband">' + seg('벽', wall && wall.hex, 1.5) + seg('바닥', floor && floor.hex, 1.1)
                + (f0 ? seg(esc(f0.n), f0.hex, 0.85) : '')
                + (r.isConfigured && r.curtains.length ? r.curtains.map((c, i) => seg(kindOf(c), colorFillOf(c.fabricId, c.colorName), 1.35, fillCls(r, i))).join('') : seg('원단', null, 2.6)) + '</div>';
            if (!r.isConfigured) { h += '<p class="dos-why is-muted">상담하고 나면 고른 원단의 색이 여기에 담겨요.</p></section>'; return; }
            // 이유 한 줄: 색 잇기를 골랐으면 그 방향("벽과 바닥 사이를 잇는 색으로 골랐어요. …"), 아니면 견적서와 같은 추천 이유
            const reason = (r.linkDir && LINK_WORD[r.linkDir]) ? `${LINK_WORD[r.linkDir]}으로 골랐어요. ${LINK_WHY[r.linkDir]}`
                : ((typeof ticketItemReason === 'function' && r.curtains[0]) ? ticketItemReason(r, r.curtains[0]) : '');
            if (reason) h += `<p class="dos-why">${reason}</p>`;
            // 원단 줄: 고른 뒤에만. 세로 색 조각(사진이 있으면 사진)이 아래에서 위로 채워짐
            // 원단 줄마다 "더 보기"(다른 색 찾기) · 한 톤 밝게 / 한 톤 진하게(누르면 바로 바뀜, 알림에 되돌리기)
            r.curtains.forEach((c, i) => {
                const opts = [];
                if (c.shapeFee > 0) opts.push('형상기억');
                if (c.leadBand) opts.push('리드밴드');
                if (c.hotelFit) opts.push('호텔핏');
                const tones = c.presetType === 'blind' ? null : toneNeighbors(c);
                const toneBtn = (e, word, step) => `<button type="button"${e ? ` onclick="window.concierge.toneSwap(${r.id}, ${i}, '${e.key.replace(/'/g, "\\'")}', ${step})"` : ' disabled'}><i style="background:${e ? e.hex : '#eee8df'}"></i><span>${word}</span></button>`;
                h += '<div class="dos-item">';
                h += `<div class="dos-sw${fillCls(r, i)}" style="${fabricFillStyle(c.fabricId, c.colorName)}"></div>`;
                h += `<div class="dos-txt"><div class="dos-kind">${kindOf(c)}</div>`;
                h += `<div class="dos-fab font-serif-kr">${(typeof ticketFabricName === 'function') ? ticketFabricName(c, c.calc || {}) : ((c.calc && c.calc.fabName) || c.label || '원단')}${opts.length ? `<em>${opts.join(' · ')}</em>` : ''}</div>`;
                if (c.presetType !== 'blind') h += `<button type="button" class="dos-more" onclick="openSpaceMore(${r.id}, ${i})">더 보기</button>`;
                h += '</div>';
                if (tones) h += `<div class="dos-tone">${toneBtn(tones.lighter, '한 톤 밝게', 1)}<span class="dos-tone-cur"></span>${toneBtn(tones.darker, '한 톤 진하게', -1)}</div>`;
                h += '</div>';
            });
            h += '</section>';
        });
        h += '<section class="dos-room dos-add"><button type="button" class="dos-addbtn font-serif-kr" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button><span class="dos-add-desc">다른 공간도 함께 보시려면 눌러 주세요</span></section>';
        h += '</div>';

        // 아래 버튼: 남은 공간이 있으면 "상담 시작 / 다음 공간 상담하기", 모두 끝났으면 "최종 제안 보기". 가로 대화면에서는 왼쪽 기둥 하단에 고정 (40-1)
        const next = list.find(r => !r.isConfigured);
        h += '<div class="dos-acts"><div class="dos-main font-serif-kr">';
        if (next) h += `<button type="button" class="dos-act is-main" onclick="window.concierge.openRoomCart(${next.id})">${doneN ? '다음 공간 상담하기' : '상담 시작'} →</button>`;
        if (doneN) h += `<button type="button" class="dos-act${next ? '' : ' is-main'}" onclick="window.concierge.goToCheckout()">최종 제안 보기${next ? '' : ' →'}</button>`;
        h += '<button type="button" class="dos-act dos-act-add" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button>';
        h += '</div><div class="dos-subacts">';
        h += '<button type="button" onclick="if (typeof startNewConsultation === \'function\') startNewConsultation();">다음 상담 시작</button>';
        h += '</div></div>';
        h += '</div></div>';
        return h;
    }
    // 수정하기: 크기와 색을 고치는 화면 (상담 내용은 그대로). 고친 값은 "저장"을 눌러야 공간에 들어감
    function spaceEditHtml() {
        const ed = state.editingRoom, r = state.roomsCart.find(x => x.id === state.editingRoomId);
        if (!ed || !r) return '';
        const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const measureBox = (target, label, steps) =>
            `<div id="measureBox_${target}" class="measure-box msr-box" onclick="window.concierge.openKeypad('${target}')">` +
            `<span class="msr-label">${label}</span>` +
            `<div class="msr-num font-serif-kr"><span id="displayVal_${target}">${ed[target]}</span><small>cm</small></div>` +
            '<span class="msr-hint">숫자를 누르면 직접 입력</span>' + nudgeRowHtml(target, steps) + '</div>';
        const row = (k, part) => {
            const p = roomPart(ed, part);
            return `<div class="dos-wfrow"><span class="dos-wfk">${k}</span><i style="background:${p ? p.hex : HATCH}"></i><span class="dos-wfn">${p ? esc(p.name) : '아직 안 쟀어요'}</span>${hexCode(p)}`
                + `<button type="button" class="ed-btn" onclick="window.concierge.editRoomColor('${part}')">${p ? '다시 재기' : '재기'}</button></div>`;
        };
        const house = houseColor();
        let h = '<div class="msr-stage">';
        h += `<span class="q-meta">${esc(r.name)} · 수정하기</span>`;
        h += '<h2 class="msr-title font-serif-kr">크기와 색을 고칠게요</h2>';
        h += '<div class="msr-grid">' + measureBox('width', '넓이', [-10, -1, 1, 10]) + measureBox('height', '높이', [-5, -1, 1, 5]) + '</div>';
        h += `<div class="ed-color">${row('벽', 'wall')}${row('바닥', 'floor')}`;
        if (house) h += '<button type="button" class="ed-sub" onclick="window.concierge.editRoomUseHouse()">집 기본 색으로 맞추기</button>';
        h += '</div>' + dirPickerHtml();
        if (r.isConfigured) h += '<p class="q-sub ed-note">고른 원단은 그대로 두고, 바뀐 색으로 어울림만 다시 살펴요.</p>';
        h += '<div class="ed-acts font-serif-kr"><button type="button" class="msr-add" onclick="window.concierge.saveRoomEdit()">저장</button>';
        h += `<button type="button" class="ed-sub" onclick="window.concierge.deleteRoom(${r.id})">이 공간 삭제</button></div>`;
        h += '</div>';
        return h;
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
                html += '<h1 class="wel-brand font-serif-kr" data-staff-hold>Re<i class="logo-dot">.</i>dam</h1>';
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

            // [공간 추가 ② 크기] 실측 화면 모양 (옵션은 원단을 고른 뒤 마무리에서)
            case "1.6-Add-Size": {
                const d = state.editingRoom;
                const measureBox = (target, label, steps) =>
                    `<div id="measureBox_${target}" class="measure-box msr-box" onclick="window.concierge.openKeypad('${target}')">` +
                    `<span class="msr-label">${label}</span>` +
                    `<div class="msr-num font-serif-kr"><span id="displayVal_${target}">${d[target]}</span><small>cm</small></div>` +
                    '<span class="msr-hint">숫자를 누르면 직접 입력</span>' + nudgeRowHtml(target, steps) + '</div>';
                html += '<div class="msr-stage">';
                html += `<span class="q-meta">${d.name} · 크기</span>`;
                html += '<h2 class="msr-title font-serif-kr">크기를 적어 주세요</h2>';
                html += '<div class="msr-grid">' + measureBox('width', '넓이', [-10, -1, 1, 10]) + measureBox('height', '높이', [-5, -1, 1, 5]) + '</div>';
                html += '<button type="button" class="msr-add font-serif-kr" onclick="window.concierge.addRoomColor()">다음 · 색 →</button>';
                html += '</div>';
                break;
            }

            // [공간 추가 ③ 색, 두 번째 공간부터] 이 집의 기본 색과 같은지. 다른 부분만 다시 잼
            case "1.7-Add-Same": {
                const hc = houseColor();
                const wf = (k, c, part) => `<div class="dos-wfrow"><span class="dos-wfk">${k}</span><i style="background:${c ? c.hex : HATCH}"></i><span class="dos-wfn">${c ? measuredName(part, c) : '아직 안 쟀어요'}</span>${hexCode(c && { hex: c.hex, src: 'measured' })}</div>`;
                const extra = (hc ? `<div class="ask-house"><span class="ask-house-k">이 집의 기본 색</span>${wf('벽', hc.wall, 'wall')}${wf('바닥', hc.floor, 'floor')}</div>` : '') + dirPickerHtml();      // 창 방향은 공간마다 (이어받지 않음)
                html += askStage('앞 공간과 바닥 · 벽이 같나요?', '', [
                    { label: '같아요', desc: '집 기본 색 그대로', rec: true, on: "window.concierge.finishAddRoom('house')" },
                    { label: '벽만 달라요', desc: '벽만 다시 재요', on: "window.concierge.measureNewRoom('wall')" },
                    { label: '바닥만 달라요', desc: '바닥만 다시 재요', on: "window.concierge.measureNewRoom('floor')" },
                    { label: '둘 다 달라요', desc: '바닥·벽 다시 재요', on: "window.concierge.measureNewRoom('both')" },
                    { label: '지금은 못 재요', desc: '상담 때 카드로 골라요', on: "window.concierge.finishAddRoom('none')" }
                ], { extra });
                break;
            }

            // [창 방향 (35번)] 첫 공간에서 색을 못 쟀을 때(공간 추가) · "이렇게 들었어요"에서 방향 줄을 눌렀을 때
            case "1.8-Add-Dir": {
                const ed = state.editingRoom;
                html += '<div class="ambient-stage ask-stage">';
                html += `<span class="q-meta">${ed.name} · 창</span>`;
                html += '<h2 class="q-title font-serif-kr">창은 어느 쪽을 보나요?</h2>';
                html += '<p class="q-sub">해가 드는 때와 빛의 색을 원단을 고른 이유에 담아 드려요</p>';
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
                html += stepHead(state.editingRoom && state.editingRoom.editOnly ? '벽 톤을 골라 주세요' : '벽 톤도 골라 주세요');
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard(WALL_NAMES.warm, "따뜻한 흰 벽지", "", SOLID_TEXTURES.cream, function() { window.concierge.selectWallTone('warm'); }, 'vdesc' + was('wallTone', 'warm'));
                html += renderBookmarkCard(WALL_NAMES.cool, "맑은 흰 벽지", "", SOLID_TEXTURES.coolWhite, function() { window.concierge.selectWallTone('cool'); }, 'vdesc' + was('wallTone', 'cool'));
                html += renderBookmarkCard(WALL_NAMES.neutral, "회색 벽지", "", SOLID_TEXTURES.greige, function() { window.concierge.selectWallTone('neutral'); }, 'vdesc' + was('wallTone', 'neutral'));
                html += renderBookmarkCard(WALL_NAMES.deep, "진한 나무 벽", "", SOLID_TEXTURES.walnut, function() { window.concierge.selectWallTone('deep'); }, 'vdesc' + was('wallTone', 'deep'));
                html += '</div></div>';
                break;

            // [Step 2-3: 일조량 진단] 공간에 들어와 처음 묻는 질문. 위에 이 공간의 벽·바닥 확인 칩 (다르면 바닥·벽 카드로 고침)
            case "2-Base-Light": {
                const ed = state.editingRoom, wall = roomPart(ed, 'wall'), floor = roomPart(ed, 'floor');
                const part = (k, p) => `<span class="rc"><i style="background:${p ? p.hex : HATCH}"></i>${k} <b>${p ? p.name : '아직 안 쟀어요'}</b></span>`;
                const chip = ed.askCards ? '' : `<div class="room-chip">이 공간 ${part('벽', wall)}${part('바닥', floor)}`
                    + `<button type="button" onclick="window.concierge.fixRoomColors()">${wall && floor ? '다르면 수정' : '카드로 고르기'}</button></div>`;
                html += askStage('창으로 햇빛은 얼마나 들어오나요?', '', [
                    { label: '풍부해요', desc: '눈부신 직사광', on: "window.concierge.selectLightLevel('high')", was: was('lightLevel', 'high') },
                    { label: '은은해요', desc: '부드러운 햇살', on: "window.concierge.selectLightLevel('mid')", was: was('lightLevel', 'mid') },
                    { label: '차분해요', desc: '낮은 채광', on: "window.concierge.selectLightLevel('low')", was: was('lightLevel', 'low') }
                ], { top: chip });
                break;
            }

            // [우리 집 색] 질문 아님: 잰 바닥·벽 색이 아래에서 차오름 → "다음" (잰 공간 · 커튼 구성만)
            case "2-Base-Home": {
                // 숨 고르기 화면 (23번): 손님이 한 답을 한 줄씩 되받음. 줄을 누르면 그 질문으로 가서 고침. 자동으로 넘기지 않음
                const ed = state.editingRoom, mc = ed.measuredColor;
                ed.backHome = false;
                const steps = diagnosisSteps(), at = steps.indexOf(state.step);
                const heard = (stepName, text) => `<button type="button" class="heard-row" onclick="window.concierge.fixHeard('${stepName}')"><span class="font-serif-kr">${text}</span><i aria-hidden="true">수정</i></button>`;
                const dot = c => `<i class="heard-dot" style="background:${c.hex}"></i>`;
                let rows = '';
                if (HEARD.lightLevel[ed.lightLevel]) rows += heard('2-Base-Light', HEARD.lightLevel[ed.lightLevel]);
                if (HEARD.lightBlock[ed.lightBlock]) rows += heard('2-Base-Block', HEARD.lightBlock[ed.lightBlock]);
                if (HEARD.privacy[ed.privacy]) rows += heard('2-Base-Privacy', HEARD.privacy[ed.privacy]);
                if (HEARD_COMP[compKeyOf(ed)]) rows += heard('3-Config-Style', HEARD_COMP[compKeyOf(ed)]);
                // 창 방향 (35번): 누르면 방향 화면에서 고침. 같은 이름 공간과 방향이 반대면 맞은편 창 줄
                const wd = windowDirText(ed.windowDir), opp = oppositeRoomOf(ed, state.roomsCart);
                rows += heard('1.8-Add-Dir', wd ? `창은 ${wd}쪽이에요` : '창 방향은 잘 모르겠어요');
                if (opp) rows += `<div class="heard-row is-static"><span class="font-serif-kr">${withGwa(opp)} 맞은편 창이에요</span></div>`;
                if (mc && (mc.floor || mc.wall)) {
                    const parts = [];
                    if (mc.floor) parts.push(`${dot(mc.floor)}바닥 <b>${measuredName('floor', mc.floor)}</b>`);
                    if (mc.wall) parts.push(`${dot(mc.wall)}벽 <b>${measuredName('wall', mc.wall)}</b>`);
                    rows += `<div class="heard-row is-static"><span class="font-serif-kr">${parts.join(' · ')}</span></div>`;
                }
                html += '<div class="ambient-stage ask-stage home-stage">';
                html += '<div class="step-dots ask-dots">' + steps.map((_, i) => `<span class="${i === at ? 'on' : (i < at ? 'done' : '')}"></span>`).join('') + '</div>';
                html += `<span class="q-meta">${ed.name}</span>`;
                html += '<h2 class="q-title font-serif-kr">이렇게 들었어요. 맞나요?</h2>';
                html += '<p class="q-sub">커튼은 이 이야기 안에서 방향을 찾아요<br>다른 점이 있다면 눌러서 수정해 주세요</p>';
                html += `<div class="heard-list">${rows}</div>`;
                html += '<button type="button" class="txt-cta font-serif-kr home-go" onclick="window.concierge.goLinkStep()">맞아요, 다음</button>';
                html += '</div>';
                break;
            }

            // [색 잇기] 커튼을 벽·바닥과 어떻게 이을지. 답은 원단 찾기의 세 방식과 같은 계산으로 겉지·속지 추천에 더해짐 (data.js roomLinkBonus)
            case "2-Base-Link": {
                const mc = state.editingRoom.measuredColor;
                const bar = pos => `<span class="link-prev" aria-hidden="true"><span class="link-bar" style="background:linear-gradient(90deg, ${mc.wall.hex}, ${mc.bridge.hex} 35%, ${mc.floor.hex})"></span><span class="link-mk" style="left:${pos}%"></span><span class="link-ends"><em>벽</em><em>바닥</em></span></span>`;
                html += askStage('커튼을 어떻게 이어 줄까요?', '듣고 나니 어울릴 색이 보여요. 이제 취향을 골라 볼까요?', [
                    { label: '넓어 보이게', desc: '벽과 이어지는 색', on: "window.concierge.selectLink('wall')", was: was('linkDir', 'wall'), extra: bar(6) },
                    { label: '그 중간으로', desc: '벽과 바닥 사이를 잇는 색', rec: true, on: "window.concierge.selectLink('bridge')", was: was('linkDir', 'bridge'), extra: bar(35) },
                    { label: '바닥과 어울리게', desc: '바닥 톤을 따르는 색', on: "window.concierge.selectLink('floor')", was: was('linkDir', 'floor'), extra: bar(78) }
                ]);
                break;
            }

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
                // "추천대로"는 사진 칸 대신 질문 판 아래 작은 글자 버튼 (10-15 사장님: 큰 색 칸이 네 번째 원단처럼 보임)
                html += `<button type="button" class="step-skip${was('sheerFeel', 'any') ? ' was-picked' : ''}" onclick="window.concierge.selectSheerFeel('any')">잘 모르겠어요 · 추천대로</button>`;
                html += '<div class="bookmark-canvas" style="--items-count: 3;">';
                html += renderBookmarkCard("매끈한", "쉬폰처럼", "", sheerFeelBg('feel_smooth', SOLID_TEXTURES.coolWhite), function() { window.concierge.selectSheerFeel('smooth'); }, 'vdesc' + was('sheerFeel', 'smooth'));
                html += renderBookmarkCard("결 있는", "린넨처럼", "", sheerFeelBg('feel_textured', SOLID_TEXTURES.oak), function() { window.concierge.selectSheerFeel('textured'); }, 'vdesc' + was('sheerFeel', 'textured'));
                html += renderBookmarkCard("도톰한", "보송하게", "", sheerFeelBg('feel_cozy', SOLID_TEXTURES.l1), function() { window.concierge.selectSheerFeel('cozy'); }, 'vdesc' + was('sheerFeel', 'cozy'));
                html += '</div></div>';
                break;

            // [블라인드 종류 고르기: 블라인드 구성에서 한 번 (38-2)]
            case "2-Base-BlindKind":
                html += '<div class="bookmark-stage">';
                html += stepHead('어떤 블라인드가 좋으세요?');
                html += `<button type="button" class="step-skip${was('blindWant', 'any') ? ' was-picked' : ''}" onclick="window.concierge.selectBlindKind('any')">잘 모르겠어요 · 추천대로</button>`;
                html += '<div class="bookmark-canvas" style="--items-count: 4;">';
                html += renderBookmarkCard("콤비", "빛을 들일 만큼만", "", blindBg('blind_combi', SOLID_TEXTURES.l1), function() { window.concierge.selectBlindKind('combi'); }, 'vdesc' + was('blindWant', 'combi'));
                html += renderBookmarkCard("롤", "실용적인 기본", "", blindBg('blind_roll', SOLID_TEXTURES.coolWhite), function() { window.concierge.selectBlindKind('roll'); }, 'vdesc' + was('blindWant', 'roll'));
                html += renderBookmarkCard("우드", "나무 결 그대로", "", blindBg('blind_wood', SOLID_TEXTURES.oak), function() { window.concierge.selectBlindKind('wood'); }, 'vdesc' + was('blindWant', 'wood'));
                html += renderBookmarkCard("알루미늄", "얇고 깨끗하게", "", blindBg('blind_alu', SOLID_TEXTURES.tile), function() { window.concierge.selectBlindKind('alu'); }, 'vdesc' + was('blindWant', 'alu'));
                html += '</div></div>';
                break;

            // [Step 2-4: 희망 분위기 선택]
            case "2-Base-Mood":
                html += '<div class="bookmark-stage">';
                // 색 잇기를 골랐으면 위 작은 글로 보여 주고, 그 방향과 어울리는 분위기 카드에 추천 표시 (점수는 그대로)
                const ld = state.editingRoom && state.editingRoom.linkDir;
                state.__recMoods = ld ? LINK_MOODS[ld] : [];
                html += stepHead('원하시는 분위기를 골라 주세요', ld ? (ld === 'bridge' ? '그 중간으로 잇는 색 안에서 골라 드려요' : LINK_WORD[ld] + ' 안에서 골라 드려요') : '듣고 나니 어울릴 색이 보여요. 이제 취향을 골라 볼까요?');
                html += '<div class="bookmark-canvas" style="--items-count: 6;">';
                html += renderBookmarkCard("포근한", "아이보리·베이지", "", moodBg('mood_01_cozy', SOLID_TEXTURES.l1), function() { window.concierge.selectMood('soft_warm'); }, 'vdesc pause-pick expand-pick' + (state.__recMoods.includes('soft_warm') ? ' is-recommended' : '') + was('wantMood', 'soft_warm'));
                html += renderBookmarkCard("깔끔한", "화이트·그레이", "", moodBg('mood_02_clean', SOLID_TEXTURES.coolWhite), function() { window.concierge.selectMood('urban_clean'); }, 'vdesc pause-pick expand-pick' + (state.__recMoods.includes('urban_clean') ? ' is-recommended' : '') + was('wantMood', 'urban_clean'));
                html += renderBookmarkCard("은은한", "그레이지", "", moodBg('mood_03_subtle', SOLID_TEXTURES.greige), function() { window.concierge.selectMood('balanced_neutral'); }, 'vdesc pause-pick expand-pick' + (state.__recMoods.includes('balanced_neutral') ? ' is-recommended' : '') + was('wantMood', 'balanced_neutral'));
                html += renderBookmarkCard("자연스러운", "린넨의 결", "", moodBg('mood_04_natural', SOLID_TEXTURES.oak), function() { window.concierge.selectMood('textured_linen'); }, 'vdesc pause-pick expand-pick' + (state.__recMoods.includes('textured_linen') ? ' is-recommended' : '') + was('wantMood', 'textured_linen'));
                html += renderBookmarkCard("아늑한", "차콜·브라운", "", moodBg('mood_05_warm', SOLID_TEXTURES.l4), function() { window.concierge.selectMood('deep_private'); }, 'vdesc pause-pick expand-pick' + (state.__recMoods.includes('deep_private') ? ' is-recommended' : '') + was('wantMood', 'deep_private'));
                html += renderBookmarkCard("화사한", "밝고 가벼운", "", moodBg('mood_06_bright', SOLID_TEXTURES.cream), function() { window.concierge.selectMood('airy_bright'); }, 'vdesc pause-pick expand-pick' + (state.__recMoods.includes('airy_bright') ? ' is-recommended' : '') + was('wantMood', 'airy_bright'));
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
                html += renderBookmarkCard("이중 커튼", "호텔처럼", "", compBg('comp_double', SOLID_TEXTURES.l1), function() { window.concierge.chooseWindowComposition('double'); }, recCls('double') + ' vdesc' + was('comp', 'double'));
                // 바깥 시선이 신경 쓰이는 공간: 속지만이면 밤에는 그림자가 비칠 수 있다고 솔직하게 (33번, 이중커튼은 겉지가 가려 줌)
                const sheerNight = (state.editingRoom.privacy === 'high' || state.editingRoom.privacy === 'some') ? SHEER_NIGHT_NOTE : '';
                html += renderBookmarkCard("속지 커튼", "은은한 채광", "", compBg('comp_sheer', SOLID_TEXTURES.l2), function() { window.concierge.chooseWindowComposition('sheer_only'); }, recCls('sheer_only') + ' vdesc' + was('comp', 'sheer_only'), sheerNight);
                html += renderBookmarkCard("겉지 커튼", "빛 차단", "", compBg('comp_drape', SOLID_TEXTURES.l3), function() { window.concierge.chooseWindowComposition('drape_only'); }, recCls('drape_only') + ' vdesc' + was('comp', 'drape_only'));
                html += renderBookmarkCard("블라인드", "창틀 안에 깔끔하게", "", compBg('comp_blind', SOLID_TEXTURES.oak), function() { window.concierge.chooseWindowComposition('blind_only'); }, recCls('blind_only') + ' vdesc' + was('comp', 'blind_only'));
                html += '</div></div>';
                break;

            // [Step 3.5: 감성 앰비언트 브릿지]
            case "3.5-Bridge": {
                const curItem = state.pendingItemQueue[state.currentItemIndex];
                const bw = state.editingRoom && state.editingRoom.blindWant;
                // 우드·알루미늄처럼 아직 목록에 없는 종류는 실물 샘플로 안내하고 바로 담음 (38-2)
                if (curItem.presetType === 'blind' && bw && bw !== 'any' && !hasBlindKindInPool(bw)) {
                    const kindName = (typeof BLIND_KIND_LABELS !== 'undefined' && BLIND_KIND_LABELS[bw]) || '선택하신';
                    const subText = bw === 'wood' ? '나무 결과 색감은 창가에서 실제로 대 보며 고르는 편이 정확해요.'
                        : (bw === 'alu' ? '슬랫 두께와 색감은 창가에서 실제로 대 보며 고르는 편이 정확해요.'
                        : '실제 샘플을 창가에 대 보며 어울리는 색을 골라 드려요.');
                    html += '<div class="ambient-stage" onclick="window.concierge.proceedSampleBlind()">';
                    html += '<div class="ambient-light-glow"></div>';
                    html += `<span class="q-meta">${state.editingRoom.name} · 블라인드 안내</span>`;
                    html += `<h2 class="q-title font-serif-kr">${kindName} 블라인드는 상담 때<br>실물 샘플로 보여 드릴게요.</h2>`;
                    html += `<p class="q-sub font-serif-kr">${subText}</p>`;
                    html += '<div class="q-hint font-serif-kr"><span>이 공간에 담아 두기</span><i class="fa-solid fa-arrow-right text-xs"></i></div>';
                    html += '</div>';
                    break;
                }
                const typeLabel = curItem.presetType === 'sheer' ? '속지' : (curItem.presetType === 'drape' ? '겉지' : '블라인드');
                html += '<div class="ambient-stage" onclick="window.concierge.proceedToFabricQueue()">';
                html += '<div class="ambient-light-glow"></div>';
                html += `<span class="q-meta">${state.editingRoom.name} · 원단 제안</span>`;
                html += `<h2 class="q-title font-serif-kr">이 공간의 빛과 색에 맞춰<br>${typeLabel}를 골랐습니다.</h2>`;
                html += '<p class="q-sub font-serif-kr">바닥·벽의 색과 들어오는 햇빛을 보고 고른 원단입니다.</p>';
                html += '<div class="q-hint font-serif-kr"><span>원단 보기</span><i class="fa-solid fa-arrow-right text-xs"></i></div>';
                html += '</div>';
                break;
            }

            // [Step 4: 실제 FABRIC_DB 기반 원단 3종 쇼케이스]
            case "4-Fabric-Queue":
                const { queueItem, targetCategory, showcaseList } = fabricShowcase();
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

            // [마무리(옵션)] 원단을 고른 뒤: 크기는 공간 추가 때 적었으므로 옵션만 (실측 화면의 옵션 글자 모양 그대로) → "○○ 마치기" → 중심 화면
            case "6-Finish": {
                const curRoom = state.editingRoom;
                const hasSheer = curRoom.items.some(i => i.presetType === 'sheer');
                const hasDrape = curRoom.items.some(i => i.presetType === 'drape');
                const optBtn = (key, label, on, fn) =>
                    `<button type="button" id="chip_${key}" class="msr-opt font-serif-kr ${on ? 'active' : ''}" onclick="${fn}">${label}</button>`;
                html += '<div class="msr-stage">';
                html += `<span class="q-meta">${curRoom.name} · 마무리</span>`;
                // 옵션은 처음부터 모두 켜져 있음 → "더할 것"이 아니라 "이렇게 마무리" + 뺄 것을 누르게 (10-15 사장님)
                html += '<h2 class="msr-title font-serif-kr">이렇게 마무리해 드려요</h2>';
                html += '<p class="q-sub">빼고 싶은 것은 눌러 주세요</p>';
                html += '<div class="msr-opts">';
                if (hasDrape) {
                    html += optBtn('shapeFee', '형상기억 가공', curRoom.shapeFee, 'window.concierge.toggleNudgeShapeFee()');
                    html += optBtn('hotelFit', '호텔핏', curRoom.hotelFit, 'window.concierge.toggleNudgeHotelFit()');
                }
                if (hasSheer) html += optBtn('leadBand', '하단 리드밴드', curRoom.leadBand, "window.concierge.fastToggleOption('leadBand')");
                html += '</div>';
                html += '<button class="opt-info-link" onclick="window.concierge.showOptionInfo()">옵션을 적용하면 어떻게 달라지나요?</button>';
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

            // [Step 7: 최종 제안 = 견적서] 가로에서는 저장·인쇄되는 견적서 이미지(app.js drawTicket)를 종이 한 장처럼 보여 주고,
            // 세로(탭 세로·휴대폰)에서는 한 권의 도록처럼 위에서 아래로 이어 읽는 연속 스크롤 에디토리얼 제안서(40-2)로 보여 줌
            case "7-Final-Dossier": {
                if (lastRenderedStep !== "7-Final-Dossier") { finalPage = 0; finalZoom = false; }      // 최종 제안에 새로 들어오면 첫 쪽·기본 크기부터
                html += `<div class="fin-stage${finalZoom ? ' is-zoom' : ''}">`;
                html += '<div class="fin-paper" id="finPaper"><p class="fin-wait font-serif-kr">견적서를 준비하고 있어요</p></div>';
                html += '<aside class="fin-side">';
                html += `<p class="fin-who font-serif-kr">${currentCust && currentCust !== '고객' ? `${currentCust} 고객님` : '고객님'}<br>맞춤 제안</p>`;
                html += '<div class="fin-pager font-serif-kr" id="finPager"></div>';
                html += '<div class="fin-main font-serif-kr">';
                html += '<button type="button" class="dos-act is-main" id="finSave" onclick="window.concierge.saveQuote()">견적서 저장</button>';
                html += '<button type="button" class="dos-act" onclick="window.concierge.printQuote()">인쇄</button>';
                html += '</div>';
                html += '<label class="fin-fee"><span>시공 및 설치비</span>';
                html += `<span><input type="number" step="5000" inputmode="numeric" value="${state.installFee}" oninput="window.concierge.updateInstallFee(this.value)" class="font-serif-kr">원</span></label>`;
                html += '<div class="fin-sub">';
                html += '<button type="button" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가·수정</button>';
                // 다음 고객 상담: 확인 창을 거쳐 지금 상담을 이력에 보관하고 비움 (직원 화면의 "새 상담"과 같음)
                html += '<button type="button" onclick="if (typeof startNewConsultation === \'function\') startNewConsultation();">다음 상담 시작</button>';
                html += '</div></aside>';
                html += '<div class="fin-ed" id="finEditorial"></div>';
                html += '</div>';
                break;
            }
        }

        html += '</div>';
        main.innerHTML = html;
        lastRenderedStep = state.step;
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
            renderFinalPaper();
        }
    }

    // ---- 세로 모드 전용 연속 스크롤 에디토리얼 제안서 (40-2, 시안: 최종제안_세로_시안.html) ----
    //  네모 상자·영어 장식·막대그래프 없이(비움), 창가 색 겹침 조각(arch-swatch)·세로 드레이프 견본·여백 기둥만으로 구성(채움)
    function renderFinalEditorial() {
        const box = document.getElementById('finEditorial');
        if (!box || typeof ticketData !== 'function') return;
        syncToV1MasterRooms();
        const data = ticketData();
        const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const showHouse = (typeof houseShows === 'function') && houseShows(data);
        const sp = showHouse && (typeof houseSpacesOf === 'function') ? houseSpacesOf(data) : [];
        const whyInfo = (typeof whySetsOf === 'function') ? whySetsOf(data) : { rooms: [] };
        const showWhy = !!(whyInfo.rooms && whyInfo.rooms.length);
        const CH_WORDS = ['하나', '둘', '셋'];
        const ORD_WORDS = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째'];
        let chIdx = 0;

        let h = '<div class="fin-ed-bar">';
        h += '<button type="button" class="fin-ed-back" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가·수정</button>';
        h += '<nav class="fin-ed-nav" aria-label="제안서 목차">';
        if (showHouse) h += '<button type="button" onclick="window.concierge.scrollFinalSec(\'finSecHouse\')">우리 집 색</button>';
        if (showWhy) h += '<button type="button" onclick="window.concierge.scrollFinalSec(\'finSecWhy\')">원단을 고른 이유</button>';
        h += '<button type="button" onclick="window.concierge.scrollFinalSec(\'finSecEst\')">견적서</button>';
        h += '</nav></div>';

        h += '<div class="fin-ed-doc">';
        h += '<header class="fin-ed-head">';
        h += '<div class="fin-ed-logo font-serif-kr" data-staff-hold>Re<i>.</i>dam</div>';
        h += `<div class="fin-ed-meta"><div class="fin-ed-for font-serif-kr">${esc(data.proposalFor)}</div><div class="fin-ed-date">${esc(String(data.date || '').replace(/\./g, '. '))}</div></div>`;
        h += '</header>';

        // 1장. 우리 집 색 (원단을 담은 공간 2곳 이상 + 색 값이 있을 때)
        if (showHouse) {
            const chNum = CH_WORDS[chIdx++] || '하나';
            const brief = (typeof houseBrief === 'function') ? houseBrief(sp) : [];
            const hasFur = sp.some(s => s.fur && s.fur.length);
            h += '<section class="fin-chapter" id="finSecHouse"><div class="fin-ch-grid">';
            h += `<div class="fin-ch-side"><span class="fin-ch-num font-serif-kr">${chNum}</span><h2 class="fin-ch-ttl font-serif-kr">우리 집 색</h2>`;
            h += '<p class="fin-ch-sub">공간마다 잰 벽·바닥·가구 색과 고른 원단이 집 전체에서 어떻게 이어지는지 모았어요.</p>';
            h += '<div class="pleat-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>';
            h += '<div>';
            if (brief.length) h += `<p class="fin-house-lead font-serif-kr">${esc(brief.join(' '))}</p>`;
            h += '<div class="fin-map-wrap"><canvas id="finEdMapCanvas" class="fin-ed-map" width="1800" height="940"></canvas>';
            h += '<div class="fin-map-caption"><div class="fin-map-legend">';
            h += '<span><i class="lg-c" style="background:#c9b49c"></i>고른 원단</span>';
            h += '<span><i class="lg-s" style="background:#d9cbb9"></i>벽·바닥</span>';
            if (hasFur) h += '<span><i class="lg-d" style="background:#d9cbb9"></i>가구</span>';
            h += '</div><span>창가에서 함께 본 색의 위치</span></div></div>';
            // 공간별 창가 색 겹침 조각 (arch-swatch: 사진이 아닌 순수 측정 단색으로 색의 어울림만 또렷하게 보여 줌)
            h += '<div class="fin-layer-strips">';
            sp.forEach(s => {
                const rm = data.rooms.find(r => r.name === s.name);
                const dirTxt = (rm && rm.raw) ? windowDirText(windowDirOf(rm.raw.windowDir)) : '';
                const baseParts = [];
                if (s.wall) baseParts.push('벽 ' + s.wall.name);
                if (s.floor) baseParts.push('바닥 ' + s.floor.name);
                (s.fur || []).forEach(fu => baseParts.push((fu.n + ' ' + (fu.name || '')).trim()));
                const fabSpans = (s.fabs || []).map(f => `<span>${esc(f.k)} · ${esc(f.nm)}</span>`).join('');
                h += '<div class="fin-layer-row">';
                h += `<div class="fin-layer-rname font-serif-kr">${esc(s.name)}${dirTxt ? `<small>${esc(dirTxt)}쪽 창</small>` : ''}</div>`;
                h += '<div class="arch-swatch">';
                h += `<div class="arch-bg-wall" style="background:${s.wall ? s.wall.hex : HATCH}"></div>`;
                h += `<div class="arch-bg-floor" style="background:${s.floor ? s.floor.hex : HATCH}"></div>`;
                h += '<div class="arch-fab-pair">' + (s.fabs || []).map(f => `<div class="arch-fab" style="background:${f.hex || '#d9cdbb'};${s.fabs.length === 1 ? 'width:52px;' : ''}"></div>`).join('') + '</div>';
                h += '</div>';
                h += '<div class="fin-layer-txts">';
                if (baseParts.length) h += `<div class="fin-layer-base">${esc(baseParts.join(' · '))}</div>`;
                h += `<div class="fin-layer-fab">${fabSpans}</div>`;
                h += '</div></div>';
            });
            h += '</div></div></div></section>';
        }

        // 2장. 원단을 고른 이유 (손님이 상담에서 답한 공간들)
        if (showWhy) {
            const chNum = CH_WORDS[chIdx++] || '둘';
            h += '<section class="fin-chapter" id="finSecWhy">';
            whyInfo.rooms.forEach((R, idx) => {
                const rm = data.rooms.find(r => r.name === R.name) || {}, raw = rm.raw || {};
                const sz = roomSize(raw), comp = roomComp(raw);
                const subTop = [R.dirText ? R.dirText + '쪽 창' : '', sz ? `${sz.w} × ${sz.h}cm` : ''].filter(Boolean).join(' · ');
                const subBot = COMP_NAMES[comp] || '';
                const keys = [];
                R.sets.forEach(s => (s.it.kindKey === 'sheer' ? ['privacy', 'light'] : ['block', 'light']).forEach(k => {
                    if (R.ans && R.ans[k] && typeof WHY_SAY !== 'undefined' && WHY_SAY[k] && WHY_SAY[k][R.ans[k]] && !keys.includes(k)) keys.push(k);
                }));
                keys.sort((a, b) => ['light', 'privacy', 'block'].indexOf(a) - ['light', 'privacy', 'block'].indexOf(b));
                const quotes = keys.map(k => `“${WHY_SAY[k][R.ans[k]]}”`);
                if (R.dirText) quotes.push(`“${R.dirText}쪽 창이에요”`);

                let mHtml = '';
                if (R.sameAs) {
                    mHtml += `<span>벽과 바닥은 ${esc(R.sameAs)}${typeof whyJosa === 'function' ? whyJosa(R.sameAs) : '과'} 같아요.</span>`;
                } else if (R.colors && R.colors.length) {
                    mHtml += R.colors.map(c => `<span class="fin-st-m-item"><i class="fin-st-m-chip" style="background:${c.hex}"></i>${esc(c.k)} ${esc(c.name)} <span class="hex-code">${esc(c.hex)}</span></span>`).join('');
                }
                if (R.space && R.space.length) {
                    mHtml += `<span class="fin-st-m-link">${esc(R.space.join(' '))}</span>`;
                }

                const curtainsHtml = R.sets.map(s => {
                    const baseName = s.it.colorDesc ? s.it.name.replace(' (' + s.it.colorDesc + ')', '') : s.it.name;
                    return `<div class="fin-curtain-col">`
                        + `<div class="drape-swatch" style="${fabricFillStyle(s.it.fabricId, s.it.colorName)}"></div>`
                        + `<div>`
                        + `<div class="fin-curtain-meta"><span>${esc(s.it.kind)}</span>${s.hex ? `<span class="hex-code">${esc(s.hex)}</span>` : ''}</div>`
                        + `<div class="fin-curtain-name font-serif-kr">${esc(baseName)}${s.it.colorDesc ? `<span>${esc(s.it.colorDesc)}</span>` : ''}</div>`
                        + (s.lines && s.lines.length ? `<p class="fin-curtain-why">${esc(s.lines.join(' '))}</p>` : '')
                        + (s.note ? `<p class="fin-curtain-honest">${esc(s.note)}</p>` : '')
                        + `</div></div>`;
                }).join('');

                h += '<div class="fin-space-story"><div class="fin-ch-grid">';
                h += '<div class="fin-ch-side">';
                h += `<span class="fin-ch-num font-serif-kr">${chNum}${whyInfo.rooms.length > 1 ? ` · ${ORD_WORDS[idx] || (idx + 1) + '번째'} 공간` : ''}</span>`;
                h += `<h2 class="fin-ch-ttl font-serif-kr">${esc(R.name)}</h2>`;
                if (subTop || subBot) h += `<p class="fin-ch-sub">${esc(subTop)}${subTop && subBot ? '<br>' : ''}${esc(subBot)}</p>`;
                h += '</div><div>';
                if (quotes.length) h += `<p class="fin-st-voice font-serif-kr">${quotes.map(esc).join(' &nbsp;')}<small>하셨어요</small></p>`;
                if (mHtml) h += `<div class="fin-st-measured">${mHtml}</div>`;
                h += `<div class="fin-st-curtains${R.sets.length === 1 ? ' is-single' : ''}">${curtainsHtml}</div>`;
                if (R.night && typeof SHEER_NIGHT_NOTE === 'string') h += `<p class="fin-curtain-honest fin-night-note">${esc(SHEER_NIGHT_NOTE)}</p>`;
                h += '</div></div></div>';
            });
            h += '</section>';
        }

        // 3장. 견적서
        const chEst = CH_WORDS[chIdx++] || '셋';
        h += '<section class="fin-chapter" id="finSecEst"><div class="fin-ch-grid">';
        h += `<div class="fin-ch-side"><span class="fin-ch-num font-serif-kr">${chEst}</span><h2 class="fin-ch-ttl font-serif-kr">견적서</h2>`;
        h += '<p class="fin-ch-sub">실측한 크기와 고르신 부자재·가공을 반영한 내역이에요.</p></div>';
        h += '<div><div class="fin-est-table">';
        (data.rooms || []).forEach(room => {
            h += '<div class="fin-est-space">';
            h += `<div class="fin-est-hd"><span class="fin-est-rname font-serif-kr">${esc(room.name)}</span>${room.sampleOnly ? '' : `<span class="fin-est-rsum font-serif-kr">${room.total.toLocaleString()}원</span>`}</div>`;
            (room.items || []).forEach(it => {
                h += '<div class="fin-est-line">';
                h += `<div class="fin-est-chip" style="${fabricFillStyle(it.fabricId, it.colorName)}"></div>`;
                h += `<span class="fin-est-k">${esc(it.kind)}</span>`;
                h += `<span class="fin-est-nm font-serif-kr">${esc(it.name)}${it.meta ? `<small>${esc(it.meta)}</small>` : ''}</span>`;
                h += `<span class="fin-est-sz">${esc(it.size || '')}</span>`;
                h += `<span class="fin-est-pr font-serif-kr">${it.sampleOnly ? '' : `${it.price.toLocaleString()}원`}</span>`;
                h += '</div>';
            });
            h += '</div>';
        });
        h += '</div>';
        h += '<div class="fin-est-foot">';
        h += `<label class="fin-est-install"><span>시공 및 설치비</span><span class="font-serif-kr"><input type="number" step="5000" inputmode="numeric" value="${state.installFee}" oninput="window.concierge.updateInstallFee(this.value)" class="fin-ed-fee-in font-serif-kr">원</span></label>`;
        h += `<div class="fin-est-total-row"><span class="fin-est-total-lbl">합계 금액 (시공비 포함)</span><span class="fin-est-total-num font-serif-kr"><span id="finEdTotalNum">${esc(data.total)}</span><small>원</small></span></div>`;
        const infoRows = [
            ['안내', data.note],
            ['결제 조건', data.pay],
            ['맞춤 제작 안내', data.custom],
            ['공급자', data.supplier]
        ].filter(([, v]) => v && String(v).trim());
        if (infoRows.length) {
            h += '<dl class="fin-est-dl">' + infoRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v).trim()).replace(/\r?\n/g, '<br>')}</dd>`).join('') + '</dl>';
        }
        h += '</div></div></div></section>';

        h += '<footer class="fin-ed-closing"><div class="fin-closing-poem font-serif-kr">빛을,<br>다시 담습니다</div><div class="fin-closing-mark font-serif-kr">Re<i>.</i>dam</div></footer>';
        h += '<div class="fin-ed-foot font-serif-kr">';
        h += '<div class="fin-ed-foot-main"><button type="button" class="dos-act is-main" onclick="window.concierge.saveQuote()">견적서 저장</button><button type="button" class="dos-act" onclick="window.concierge.printQuote()">인쇄</button></div>';
        h += '<div class="fin-ed-foot-sub"><button type="button" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가·수정</button><button type="button" onclick="if (typeof startNewConsultation === \'function\') startNewConsultation();">다음 상담 시작</button></div>';
        h += '</div>';
        h += '</div>'; // .fin-ed-doc 끝

        box.innerHTML = h;
        if (showHouse && typeof drawHouseMap === 'function') {
            const cv = document.getElementById('finEdMapCanvas');
            if (cv) {
                const ctx = cv.getContext('2d');
                ctx.save();
                ctx.scale(2, 2);
                ctx.fillStyle = '#fffdf9';
                ctx.fillRect(0, 0, 900, 470);
                drawHouseMap(ctx, sp);
                ctx.restore();
            }
        }
    }

    // ---- 최종 제안의 종이: 저장·인쇄되는 이미지를 한 쪽씩 보여 줌 (app.js makeTicketBlobs) ----
    //  우리 집 색(원단을 담은 공간 2곳 이상, 37번) → "원단을 고른 이유" 카드(고객 답이 있을 때만) → 견적서. 위아래로 이어 붙이면 한 장처럼 느껴져서 "다음"을 눌러 넘김 (10-15 사장님)
    let finalPaperSeq = 0, finalPaperTimer = null;
    // 종이를 옆으로 밀어서 쪽 넘기기 (39번, 세로에서 고객이 직접 넘길 때). 위아래 읽기와 헷갈리지 않게 옆으로 크게 밀었을 때만
    function bindFinalSwipe(box) {
        if (!box || box.dataset.swipe) return;
        box.dataset.swipe = '1';
        let sx = 0, sy = 0, on = false;
        box.addEventListener('touchstart', e => { if (e.touches.length !== 1) { on = false; return; } on = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        box.addEventListener('touchend', e => {
            if (!on) return;
            on = false;
            const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
            if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            setFinalPage(finalPage + (dx < 0 ? 1 : -1));
        }, { passive: true });
    }
    function setFinalPage(i) {
        const box = document.getElementById('finPaper');
        if (!box) return;
        const imgs = box.querySelectorAll('img');
        if (!imgs.length) return;
        const before = finalPage;
        finalPage = Math.max(0, Math.min(i, imgs.length - 1));
        imgs.forEach((im, k) => im.classList.toggle('is-on', k === finalPage));
        if (finalPage !== before) { const st = document.querySelector('.fin-stage'); if (st) st.scrollTop = 0; }      // 세로에서 아래까지 읽다 넘기면 새 쪽 맨 위부터 (39번)
        const n = imgs.length, onCard = finalCardCount > 0 && finalPage < finalCardCount;
        // 쪽 묶음 (37번): [0, house) = 우리 집 색 · [house, card) = 원단을 고른 이유 · [card, n) = 견적서
        const groupOf = k => k < finalHouseCount ? 'house' : (k < finalCardCount ? 'why' : 'ticket');
        const nextWord = { why: '원단을 고른 이유', ticket: '견적서 보기' }, prevWord = { house: '우리 집 색', why: '원단을 고른 이유' };
        const pager = document.getElementById('finPager');
        if (pager) {
            // 세로 모드에서는 [← 이전 (맨 왼쪽)] · [쪽 번호 + 크게 보기 (가운데)] · [다음 → (맨 오른쪽)] 자리가 고정됨 (39번)
            let h = '<span class="fin-mid">';
            if (n > 1) h += `<span class="fin-pg">${finalPage + 1} / ${n}</span>`;
            h += `<button type="button" class="fin-zoom" onclick="window.concierge.toggleFinalZoom()">${finalZoom ? '기본 크기' : '크게 보기'}</button></span>`;
            if (finalPage < n - 1) {
                const g = groupOf(finalPage + 1);
                h += `<button type="button" class="dos-act is-main" onclick="window.concierge.finalNext()">${g !== groupOf(finalPage) ? nextWord[g] : '다음'} →</button>`;
            }
            if (finalPage > 0) {
                const g = groupOf(finalPage - 1);
                h += `<button type="button" class="fin-prev" onclick="window.concierge.finalPrev()">← ${g !== groupOf(finalPage) ? prevWord[g] : '이전'}</button>`;
            }
            pager.innerHTML = h;
        }
        const save = document.getElementById('finSave');
        if (save) save.classList.toggle('is-main', !onCard);        // 카드 쪽에서는 "견적서 보기"가 주 버튼
        const stage = document.querySelector('.fin-stage');
        if (stage) stage.classList.toggle('on-card', onCard);       // 카드 쪽에서는 시공비 칸을 감춤(자리는 그대로, 화면이 덜컥하지 않게) (견적서에만 들어가는 금액)
    }
    async function renderFinalPaper() {
        const seq = ++finalPaperSeq;
        if (typeof window.makeTicketBlobs !== 'function') return;
        try {
            const { canvases, cardCount, houseCount } = await window.makeTicketBlobs({ canvasOnly: true, pixelRatio: 1.5 });
            const box = document.getElementById('finPaper');
            if (seq !== finalPaperSeq || !box || state.step !== "7-Final-Dossier") return;      // 그리는 사이 화면이 바뀌었으면 버림
            box.innerHTML = '';
            finalCardCount = cardCount || 0;
            finalHouseCount = houseCount || 0;
            canvases.forEach((c, k) => {
                const img = document.createElement('img');
                img.alt = k < finalHouseCount ? '우리 집 색' : ((k < finalCardCount) ? '원단을 고른 이유' : '견적서');
                img.src = c.toDataURL('image/png');
                box.appendChild(img);
            });
            setFinalPage(finalPage);
            bindFinalSwipe(box);
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
    // 품명 끝의 색 이름(예: 오솔로 화이트)은 이름에서 떼어 색 자리로 → 이름 길이가 고르게. 직원 화면 "고객에게 보여주기"도 같은 규칙
    const NAME_COLOR_WORD = /\s+(오프화이트|퓨어화이트|화이트|아이보리|크림|라이트베이지|베이지|샌드|오트밀|그레이지|라이트그레이|그레이|차콜|모카|토프|카멜|브라운|초콜릿|네이비|블랙)$/;
    function splitNameColor(f, colorTag) {
        let name = fabricDisplayName(f);
        const cw = NAME_COLOR_WORD.exec(name);
        if (cw && name.length > cw[0].length) { name = name.slice(0, -cw[0].length); colorTag = colorTag || cw[1]; }
        return { name, colorTag };
    }
    function fabricCardHtml(f, best, idx, pick, queueItem, targetCategory) {
        const order = colorDeckOrder(best), n = order.length;
        const { name, colorTag } = splitNameColor(f, colorTagOf(f, pick, n));
        // 글자 수 세기: 영어·숫자는 눕혀 쓰므로 0.6자(대문자 0.78자)로 셈
        const vlen = s => Array.from(String(s)).reduce((a, ch) => a + (/[A-Z]/.test(ch) ? 0.78 : (/[a-z0-9 .\/%&-]/.test(ch) ? 0.6 : 1)), 0) || 1;   // 영어 대문자는 조금 더 넓게
        const isLast = idx === (state.fabPanelCount || 1) - 1;
        let h = `<div class="bookmark-card color-top" data-fab="${f.id}" style="right: 0;" onclick="window.concierge.handleQueueFabricClick('${f.id}')">`;
        h += `<div class="bookmark-bg" style="background: ${colorFillOf(f.id, pick)};"></div>`;
        // 사진은 앞·뒤 두 장: 색을 바꿀 때 뒤 장에 새 사진을 받아 겹쳐 바꿈. 주소는 미리 찾아 둔 것만 씀(아직 모르면 찾은 뒤 넣음)
        const known = knownPhoto(f.id, pick);
        h += `<img class="fabric-photo is-front" alt="" data-id="${f.id}" data-color="${pick}"${known ? ` src="${known}"` : (known === undefined ? ' data-pending="1"' : '')}>`;
        h += '<img class="fabric-photo is-back" alt="">';
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
                return `<button type="button" class="fab-chip${nx === pick ? ' on' : ''}" data-c="${String(nx).replace(/"/g, '&quot;')}" aria-label="${label}" aria-pressed="${nx === pick}" onclick="event.stopPropagation(); window.concierge.showColor('${f.id}', '${String(nx).replace(/'/g, "\\'")}')"><i style="background: ${colorFillOf(f.id, nx)};"></i></button>`;
            }).join('') + '</div>';
        }
        h += '</div>';
        // 마지막 칸에만 Re.dam 표시 (오른쪽 아래). 2초 누르고 있으면 직원 화면
        if (isLast) h += '<div class="card-brand" data-staff-hold onclick="event.stopPropagation()">Re<i class="logo-dot">.</i>dam</div>';
        h += '</div>';
        return h;
    }
    // (예전 "옆으로 밀기"·"뒤에 겹친 색 띠"는 뺐음 → 지금은 아래 띠의 견본 칩을 눌러 색을 바꿈)
    // 견본 칩은 아래 한 줄만 (원단마다 모양이 같게 — 10-14 사장님): 넘치면 줄 끝에 "+7" 칩 → 누르면 사진 위로 모든 색 판이 올라옴
    const CHIP_ROWS = 1, CHIP_W = 44;
    function fitChips(panel) {
        const box = panel.querySelector('.fab-chips');
        if (!box) return;
        const card = panel.querySelector('.bookmark-card');
        if (card) card.classList.remove('is-allcolors');      // 다시 맞추면 늘 한 줄로
        const chips = Array.from(box.querySelectorAll('.fab-chip'));
        chips.forEach(c => { c.hidden = false; });
        const old = box.querySelector('.fab-more');
        if (old) old.remove();
        const perRow = Math.floor(box.clientWidth / CHIP_W);
        if (!perRow || chips.length <= perRow * CHIP_ROWS) return;      // 화면에 안 보여 폭을 모를 때(0)는 그대로 둠
        const keep = perRow * CHIP_ROWS - 1;
        chips.slice(keep).forEach(c => { c.hidden = true; });
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'fab-more';
        more.textContent = '+' + (chips.length - keep);
        more.setAttribute('aria-label', `색 ${chips.length - keep}개 더 보기`);
        more.onclick = ev => { ev.stopPropagation(); openAllColors(panel); };
        box.appendChild(more);
        syncMoreChip(panel);
    }
    // 지금 색이 숨은 칩 가운데 있으면 "+7" 칩에 밑줄
    function syncMoreChip(panel) {
        const more = panel.querySelector('.fab-more');
        if (more) more.classList.toggle('on', Array.from(panel.querySelectorAll('.fab-chips .fab-chip[hidden]')).some(c => c.classList.contains('on')));
    }
    // "+7"을 누르면: 판을 따로 띄우지 않고 그 띠 안에서 숨은 칩을 모두 펼침 (아래 줄부터 위로 쌓임)
    //  - 띠 안에 다 들어가면 띠 크기 그대로, 넘칠 때만 넘친 줄이 사진 위로 올라감(띠와 같은 갈색). 줄 끝 "접기"로 다시 한 줄
    //  - 색을 눌러도 펼친 채로 유지(그 색으로만 바뀜). "접기" · 칸 밖 누르기 · 뒤로를 누르면 접힘
    function openAllColors(panel) {
        closeAllColors();
        const card = panel.querySelector('.bookmark-card'), box = panel.querySelector('.fab-chips');
        if (!card || !box) return;
        box.querySelectorAll('.fab-chip').forEach(c => { c.hidden = false; });
        const more = box.querySelector('.fab-more');
        if (more) {
            more.textContent = '접기';
            more.classList.remove('on');
            more.classList.add('is-fold');
            more.setAttribute('aria-label', '색 접기');
            more.onclick = ev => { ev.stopPropagation(); closeAllColors(); };
        }
        card.classList.add('is-allcolors');
    }
    // 펼친 칩을 한 줄로 접음. 접은 게 있으면 true (뒤로 버튼이 씀)
    function closeAllColors() {
        const open = Array.from(document.querySelectorAll('.bookmark-card.is-allcolors'));
        open.forEach(card => { card.classList.remove('is-allcolors'); const p = card.closest('.fab-panel'); if (p) fitChips(p); });
        return open.length > 0;
    }
    // 펼친 칸 밖을 누르면 접기만 함 (다른 원단 칸이 골라지지 않게)
    document.addEventListener('click', ev => {
        const card = document.querySelector('.bookmark-card.is-allcolors');
        if (!card || card.querySelector('.fab-chips').contains(ev.target)) return;
        ev.stopPropagation(); ev.preventDefault();
        closeAllColors();
    }, true);
    let fitChipsTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(fitChipsTimer);
        fitChipsTimer = setTimeout(() => document.querySelectorAll('.fab-panel').forEach(fitChips), 150);
    });
    function bindFabricPanel(panel) { fitChips(panel); }
    function bindColorDecks() {
        document.querySelectorAll('.fab-panel').forEach(bindFabricPanel);
    }
    // 원단 화면에 나올 원단 3개 (지금 칸의 종류에 맞춰, 공간에 어울리는 점수 순). "찾는 중" 화면과 원단 화면이 같은 결과를 씀
    function fabricShowcase() {
        const queueItem = state.pendingItemQueue[state.currentItemIndex] || { label: "창문", presetType: "sheer" };
        const targetCategory = queueItem.presetType === 'blind' ? '블라인드' : (queueItem.presetType === 'sheer' ? '속지' : '겉지');
        // 원단마다 "공간에 가장 어울리는 색"까지 계산해 순위를 매김. 점수가 같으면 사장님이 직접 분류한 원단을 먼저
        const ranked = getLiveCategoryPool(targetCategory).map(f => ({ f: f, best: bestColorFor(f, state.editingRoom, targetCategory) }));
        ranked.sort((a, b) => (b.best.score - a.best.score)
            || ((isManualTagged(b.f) ? 1 : 0) - (isManualTagged(a.f) ? 1 : 0)));
        const showcaseList = (typeof pickShowcase === 'function') ? pickShowcase(ranked, 3) : ranked.slice(0, 3);
        return { queueItem, targetCategory, showcaseList };
    }

    // ---- 원단 사진 주소 기억 ----
    // 원단·색마다 실제로 있는 사진 주소(없으면 '')를 한 번만 찾아 둠 → 없는 주소(.webp·.png 등)를 다시 시도하며 깜빡이지 않게
    // decode까지 끝낸 뒤에 알려 주므로, 받은 주소를 화면에 넣으면 바로 그려짐
    const photoSeek = {};       // 원단ID__색 → Promise(주소 또는 '')
    const photoKnown = {};      // 원단ID__색 → 주소 또는 '' (찾기가 끝난 것만)
    function findPhoto(fabId, color) {
        const key = fabId + '__' + (color || '');
        if (!photoSeek[key]) {
            // 직원 화면 사진 확인 목록(app.js, 기기에 저장됨)을 먼저 봄: 있는 주소면 그것부터, 이번 실행에서 확인했는데 없으면 찾지 않음
            const listed = (typeof knownPhotoFor === 'function') ? knownPhotoFor(fabId, color) : undefined;
            if (listed === '') { photoKnown[key] = ''; photoSeek[key] = Promise.resolve(''); return photoSeek[key]; }
            let urls = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabId, color) : [];
            if (listed) urls = [listed].concat(urls.filter(u => u !== listed));
            photoSeek[key] = (async () => {
                // 기기에 넣은 사진(34번)을 다 읽기 전이면 기다렸다가 그 주소부터
                if (typeof DevicePhotos !== 'undefined') {
                    await DevicePhotos.ready;
                    const dev = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabId, color) : [];
                    urls = dev.concat(urls.filter(u => !dev.includes(u)));
                }
                for (const u of urls) {
                    const im = new Image();
                    im.src = u;
                    try { await im.decode(); photoKnown[key] = u; return u; } catch (e) {}
                }
                photoKnown[key] = '';
                return '';
            })();
        }
        return photoSeek[key];
    }
    function knownPhoto(fabId, color) { return photoKnown[fabId + '__' + (color || '')]; }
    // 기기 사진을 넣거나 지운 뒤 (34번): 기억해 둔 주소를 잊고 다음에 다시 찾음
    function forgetPhotos() { Object.keys(photoSeek).forEach(k => delete photoSeek[k]); Object.keys(photoKnown).forEach(k => delete photoKnown[k]); }

    // 견본 칩으로 색을 바꿈: 칸은 그대로 두고 사진만 바꿈 (칸 전체를 새로 그리면 글자·칩까지 깜빡여서)
    //  - 뒤 장에 새 사진을 넣고 decode가 끝난 뒤 0.25초 겹쳐 바꿈. 사진이 없는 색은 앞 장만 사라져 바탕색이 보임
    //  - 바탕색 · 세로 색 이름 · 칩 밑줄은 그 자리에서 값만 바꿈. 빨리 여러 번 누르면 마지막 것만 남음
    function swapFabricPanel(panel, html, fabId, colorName) {
        const card = panel.querySelector('.bookmark-card');
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const next = tmp.querySelector('.bookmark-card');
        if (!card || !next) { panel.innerHTML = html; return; }
        const bg = card.querySelector('.bookmark-bg'), nbg = next.querySelector('.bookmark-bg');
        if (bg && nbg) bg.style.background = nbg.style.background;
        const desc = card.querySelector('.fab-vdesc'), ndesc = next.querySelector('.fab-vdesc');
        if (desc && ndesc) desc.innerHTML = ndesc.innerHTML;
        else if (desc) desc.remove();
        else if (ndesc) { const name = card.querySelector('.fab-vname'); if (name) name.after(ndesc); }
        const nchips = Array.from(next.querySelectorAll('.fab-chip'));
        card.querySelectorAll('.fab-chip').forEach((b, i) => {
            const on = !!nchips[i] && nchips[i].classList.contains('on');
            b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
        });
        syncMoreChip(panel);
        const token = (panel.__swap || 0) + 1;
        panel.__swap = token;
        card.querySelectorAll('.fabric-photo').forEach(img => { img.removeAttribute('data-pending'); img.setAttribute('data-color', colorName || ''); });
        findPhoto(fabId, colorName).then(url => {
            if (panel.__swap !== token) return;
            const front = card.querySelector('.fabric-photo.is-front'), back = card.querySelector('.fabric-photo.is-back');
            if (!front || !back) return;
            if (!url) { front.style.opacity = '0'; return; }
            if (front.getAttribute('src') === url && front.style.opacity !== '0') return;
            back.src = url;
            const show = () => {
                if (panel.__swap !== token) return;
                back.style.opacity = '1'; front.style.opacity = '0';
                setTimeout(() => {
                    if (panel.__swap !== token) return;
                    front.classList.replace('is-front', 'is-back'); back.classList.replace('is-back', 'is-front');
                    front.removeAttribute('style'); back.removeAttribute('style');
                }, 260);
            };
            (back.decode ? back.decode() : Promise.resolve()).then(show, show);
        });
    }

    // ---- "찾는 중" 화면: 원단 화면이 열리기 전, 보여 줄 원단 3개의 모든 색 사진을 미리 받아 둠 ----
    //  - 밝은 종이색 바탕 + 흰빛이 모여 살구빛 → 흙빛 점(로고 모션과 같은 결), 점은 천천히 숨 쉬듯
    //  - 원단 하나가 준비될 때마다 그 원단 색 조각이 하나씩 나타남. 다 되면 "3가지 원단을 골랐어요" → 0.6초 뒤 원단 화면
    //  - 최소 1.2초(같은 공간의 두 번째 칸부터는 0.8초), 최대 3초(넘으면 넘어가고 남은 사진은 뒤에서 계속 받음)
    const SEEK_MIN_MS = 1200, SEEK_MIN_NEXT_MS = 800, SEEK_MAX_MS = 3000, SEEK_DONE_MS = 600;
    function playFabricSeek(then) {
        const { showcaseList } = fabricShowcase();
        const second = state.currentItemIndex > 0;      // 같은 공간의 두 번째 칸(겉지 다음 속지 등)은 짧게
        const minMs = second ? SEEK_MIN_NEXT_MS : SEEK_MIN_MS;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const box = document.createElement('div');
        box.className = 'fab-seek';
        box.setAttribute('role', 'status');
        box.innerHTML = '<div class="fab-seek-in"><div class="fab-seek-light" aria-hidden="true"><i class="fab-seek-glow"></i><i class="fab-seek-dot"></i></div>'
            + '<p class="fab-seek-q font-serif-kr">공간에 맞는 원단을 찾고 있어요</p>'
            + '<p class="fab-seek-sub">바닥·벽의 색과 들어오는 햇빛을 보고 있어요</p>'
            + '<div class="fab-seek-found" aria-hidden="true">' + showcaseList.map(e => {
                const pick = colorDeckOrder(e.best)[0] || '';
                return `<i style="background: ${colorFillOf(e.f.id, pick)};"></i>`;
            }).join('') + '</div></div>';
        document.body.appendChild(box);
        const chips = box.querySelectorAll('.fab-seek-found i'), sub = box.querySelector('.fab-seek-sub');
        const t0 = Date.now();
        const all = Promise.all(showcaseList.map((e, i) => {
            const colors = colorDeckOrder(e.best);
            return Promise.all((colors.length ? colors : ['']).map(c => findPhoto(e.f.id, c)))
                .then(() => sleep(Math.max(0, (second ? 300 : 600) + i * 200 - (Date.now() - t0))))      // 한꺼번에 뜨지 않고 하나씩
                .then(() => chips[i].classList.add('on'));
        }));
        Promise.race([all, sleep(SEEK_MAX_MS)])
            .then(() => sleep(Math.max(0, minMs - (Date.now() - t0))))
            .then(() => {
                chips.forEach(c => c.classList.add('on'));
                sub.textContent = showcaseList.length ? `${showcaseList.length}가지 원단을 골랐어요` : '원단을 골랐어요';
                return sleep(SEEK_DONE_MS);
            })
            .then(() => {
                if (then) then();               // 원단 화면을 아래에 그린 뒤 이 화면을 서서히 걷음
                box.classList.add('is-out');
                setTimeout(() => box.remove(), 600);
            });
    }

    // 분위기 칸 넓히기(22-2): 누른 칸은 2.4배로 넓어지고 나머지는 좁아짐. 넓어진 칸에 "한 번 더 누르면 선택돼요" 안내
    function expandMoodCard(canvas, el) {
        const cards = Array.from(canvas.children);
        canvas.classList.add('has-expand');
        cards.forEach(c => c.classList.toggle('is-expanded', c === el));
        if (!el.querySelector(".expand-hint")) { const h = document.createElement("span"); h.className = "expand-hint"; h.textContent = "한 번 더 누르면 선택돼요"; el.appendChild(h); }
        canvas.style.gridTemplateColumns = cards.map(c => c === el ? '2.4fr' : '1fr').join(' ');
    }
    function collapseMoodCards(canvas) {
        if (!canvas || !canvas.classList.contains('has-expand')) return false;
        canvas.classList.remove('has-expand');
        Array.from(canvas.children).forEach(c => c.classList.remove('is-expanded'));
        canvas.style.gridTemplateColumns = '';
        return true;
    }

    function renderBookmarkCard(title, desc, tag, bgStyle, onClickFn, extraClass, note) {
        const id = "bk_" + Math.random().toString(36).substr(2, 9);
        // 'pause-pick' 칸: 누르면 고른 칸만 남기고 나머지는 어두워진 뒤 PICK_PAUSE_MS 만큼 쉬었다가 다음 화면으로 (10-15)
        //  - 고객이 "내가 이걸 골랐구나" 느낄 틈을 줌. 쉬는 동안 다시 누르는 건 무시
        const pausePick = /\bpause-pick\b/.test(extraClass || '');
        setTimeout(() => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!pausePick) { el.onclick = onClickFn; return; }
            el.onclick = () => {
                const canvas = el.closest('.bookmark-canvas');
                if (!canvas || canvas.classList.contains('has-pick')) return;
                // 'expand-pick' 칸(분위기 화면, 22-2): 첫 터치는 그 칸이 옆으로 넓어지기만 하고, 넓어진 칸을 한 번 더 누르면 선택
                if (/\bexpand-pick\b/.test(extraClass || '') && !el.classList.contains('is-expanded')) { expandMoodCard(canvas, el); return; }
                // 넓어진 칸을 한 번 더 누름: 접지 않고 넓어진 그대로 바로 다음 화면으로 (접히면서 넘어가 덜컥거리던 것, 10-15 사장님)
                if (el.classList.contains('is-expanded')) {
                    const hint = el.querySelector('.expand-hint');
                    if (hint) hint.remove();
                    canvas.classList.add('has-pick');
                    onClickFn();
                    return;
                }
                canvas.classList.add('has-pick');
                el.classList.add('is-picked');
                setTimeout(onClickFn, PICK_PAUSE_MS);
            };
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
            (note ? `<div class="fab-side"><p class="fab-note">${note}</p></div>` : '') +     // 차분한 작은 안내 (33번 속지만 밤 안내)
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
        // 탭의 뒤로(app.js "뒤로 버튼"이 부름): 떠 있는 것(키패드 · 옵션 설명 · 모든 색 판)을 닫았으면 true
        closeTopLayer: function() {
            const pad = document.getElementById("v2VirtualKeypadSheet");
            if (pad && pad.classList.contains("active")) { hideKeypadDirectly(); return true; }
            if (state.step === "7-Final-Dossier" && finalPage > 0) { setFinalPage(finalPage - 1); return true; }
            const ov = document.getElementById('optInfoOverlay');
            if (ov && getComputedStyle(ov).display !== 'none') { ov.style.display = 'none'; return true; }
            // 분위기 화면에서 넓어진 칸은 "떠 있는 것"처럼 뒤로를 누르면 먼저 접힘 (22-2)
            if (collapseMoodCards(document.querySelector('.bookmark-canvas.has-expand'))) return true;
            return closeAllColors();
        },
        // "찾는 중" 화면이 떠 있으면 뒤로를 무시 (끝나면 원단 화면이 열림)
        isSeeking: function() { return !!state.seeking || !!document.querySelector('.fab-seek'); },
        // 화면 왼쪽 위 ← 가 할 일이 있는지 (없으면 뒤로를 눌러도 아무 일도 없음)
        canGoBack: function() { return stepHistory.length > 0; },
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
        // ---- 공간 추가: 공간 종류 → 크기 → 색 (사실은 먼저 채우고, 취향은 공간 안에서 고객이 고름) ----
        // 다 마칠 때까지는 공간 목록에 넣지 않음 (중간에 뒤로 나가면 아무것도 남지 않음)
        chooseRoomType: function(selectedName) {
            const sameTypeCount = state.roomsCart.filter(r => r.name.startsWith(selectedName)).length;
            const displayName = sameTypeCount === 0 ? selectedName : `${selectedName} ${sameTypeCount + 1}`;
            state.editingRoomId = null;
            state.editingRoom = { name: displayName, roomType: selectedName, addDraft: true, width: 340, height: 235, items: [], windowDir: [] };
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
            openMeasure(d.name, parts, `${d.name} 담기`, first ? '이 색을 집의 기본 색으로 둘게요. 다음 공간은 "같아요"만 누르면 돼요.' : '',
                function(mc) { window.concierge.finishAddRoom(first ? 'first' : (parts === 'both' ? 'measured' : parts), mc); },
                function() { if (first) goToStep("1.8-Add-Dir"); else window.concierge.finishAddRoom('none'); },      // 첫 공간을 못 재면 창 방향만 따로 물음 (두 번째부터는 "같나요?" 화면에 있음)
                house ? house.bridgeK : undefined, true);      // 둘 다 다시 잴 때 막대는 집 기본 비율부터 · 결과 아래 창 방향 (35번)
        },
        // src: 'first'(첫 공간에서 잼 → 집 기본 색) · 'measured'(둘 다 다시 잼) · 'wall' · 'floor'(한쪽만 다시 잼) · 'house'(같아요) · 'none'(못 잼)
        finishAddRoom: function(src, mc) {
            const d = state.editingRoom;
            if (!d || !d.addDraft) return;
            const house = houseColor();
            const room = {
                id: newRoomId(), name: d.name, roomType: d.roomType,
                width: Number(d.width) || 340, height: Number(d.height) || 235,
                floorTone: "warm", wallTone: "cool", lightLevel: "mid", mood: "soft_warm",
                isConfigured: false, curtains: [], subtotal: 0,
                colorSrc: src === 'first' ? 'measured' : (src === 'none' ? null : src),
                windowDir: windowDirOf(d.windowDir)      // 색 단계에서 고른 창 방향 (35번, "같아요"여도 이어받지 않음)
            };
            if (src === 'first' || src === 'measured') setRoomColor(room, mc);
            else if (src === 'house' && house) setRoomColor(room, withBridge(house.wall, house.floor, house.bridgeK));      // "같아요": 비율도 첫 공간 것
            else if (src === 'wall' && mc) setRoomColor(room, withBridge(mc.wall, house && house.floor, house && house.bridgeK, mc.furniture));
            else if (src === 'floor' && mc) setRoomColor(room, withBridge(house && house.wall, mc.floor, house && house.bridgeK, mc.furniture));
            if (src === 'first' && mc && (mc.wall || mc.floor)) state.house = houseOf(mc, room.id);
            state.roomsCart.push(room);
            state.editingRoom = null;
            // 공간 추가 단계(종류·크기·같나요)는 뒤로 가기 목록에서 지움 → 중심 화면에서 ← 는 공간 추가 전 화면으로
            const at = stepHistory.map(x => x.step).lastIndexOf("1.5-Room-Type");
            if (at >= 0) stepHistory.length = at;
            if (stepHistory.length && stepHistory[stepHistory.length - 1].step === "1-Space") stepHistory.pop();
            goToStep("1-Space", false);
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
                lightBlock: target.lightBlock || null, privacy: target.privacy || null, sheerFeel: target.sheerFeel || null, blindWant: target.blindWant || null,
                measuredColor: target.measuredColor ? JSON.parse(JSON.stringify(target.measuredColor)) : null,     // 카드로 고치면 그 부분을 지우므로 복사본
                colorSrc: target.colorSrc || null,
                cardParts: target.cardParts ? Object.assign({}, target.cardParts) : null,
                diagnosed: !!target.diagnosed,
                linkDir: target.linkDir || null,
                windowDir: windowDirOf(target.windowDir),      // 창 방향 (35번)
                width: Number(target.width) || 340,          // 수정하기·공간 추가에서 적은 크기가 있으면 그것부터
                height: Number(target.height) || 235,
                sizeKnown: !!(Number(target.width) && Number(target.height)),      // 공간 추가 때 크기를 적었으면 원단 뒤에는 옵션(마무리)만
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
                    wantMood: target.wantMood || null, sheerFeel: target.sheerFeel || null, blindWant: target.blindWant || null, comp, linkDir: target.linkDir || null
                };
            }
            // 새 흐름(20번): 벽·바닥을 이미 아는 공간(잰 색·집 기본 색·카드)은 빛 질문부터(위에 확인 칩). 모르는 공간은 바닥·벽 카드부터
            // 예전에 마친 공간을 다시 상담할 때는 예전처럼 바닥·벽 카드부터 (지난 답 회색 표시)
            const known = !!(roomPart(target, 'wall') && roomPart(target, 'floor'));
            state.editingRoom.askCards = target.isConfigured || !known;
            goToStep(state.editingRoom.askCards ? "2-Base-Floor" : "2-Base-Light");
        },
        // 빛 질문 위 칩의 "다르면 고치기": 바닥·벽 카드로 고친 뒤 다시 빛 질문으로
        fixRoomColors: function() {
            if (!state.editingRoom) return;
            state.editingRoom.fixing = true;
            goToStep("2-Base-Floor");
        },
        // 우리 집 색 → 색 잇기
        goLinkStep: function() {
            if (canLink(state.editingRoom)) { goToStep("2-Base-Link"); return; }
            state.editingRoom.linkDir = null;
            goToStep("2-Base-Mood");
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
            if (!returnHomeIfFixing()) prevStep();
        },
        // "이렇게 들었어요" 줄을 눌러 그 질문으로: 답하면 다시 이 화면으로 돌아옴
        fixHeard: function(stepName) {
            state.editingRoom.backHome = true;
            goToStep(stepName);
        },
        selectLink: function(dir) {
            state.editingRoom.linkDir = dir;
            goToStep("2-Base-Mood");
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
                // "다르면 고치기"로 왔으면 바닥·벽 카드는 뒤로 가기 목록에서 빼고 빛 질문으로 돌아감
                state.editingRoom.fixing = false;
                while (stepHistory.length && stepHistory[stepHistory.length - 1].step !== "2-Base-Light") stepHistory.pop();
                if (stepHistory.length) stepHistory.pop();
                goToStep("2-Base-Light", false);
                return;
            }
            goToStep("2-Base-Light");
        },
        // ---- 중심 화면 › 수정하기 ----
        editRoom: function(roomId) {
            const r = state.roomsCart.find(x => x.id === roomId);
            if (!r) return;
            const size = roomSize(r) || { w: 340, h: 235 };
            state.editingRoomId = r.id;
            state.editingRoom = {
                id: r.id, name: r.name, editOnly: true, items: [],
                width: size.w, height: size.h,
                floorTone: r.floorTone, wallTone: r.wallTone, diagnosed: r.diagnosed, cardParts: r.cardParts ? Object.assign({}, r.cardParts) : null, colorSrc: r.colorSrc || null,
                measuredColor: r.measuredColor ? JSON.parse(JSON.stringify(r.measuredColor)) : null,
                windowDir: windowDirOf(r.windowDir)
            };
            goToStep("1-Space-Edit");
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
            r.width = Number(ed.width) || r.width; r.height = Number(ed.height) || r.height;
            r.floorTone = ed.floorTone; r.wallTone = ed.wallTone; r.measuredColor = ed.measuredColor || null;
            r.cardParts = ed.cardParts || null;
            r.colorSrc = ed.colorSrc || null;
            r.windowDir = windowDirOf(ed.windowDir);
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
        selectLightLevel: function(level) {
            state.editingRoom.lightLevel = level;
            if (returnHomeIfFixing()) return;
            goToStep("2-Base-Block");          // 모든 공간: 빛 가림 → 바깥 시선 → 구성
        },
        selectLightBlock: function(level) {
            state.editingRoom.lightBlock = level;
            if (returnHomeIfFixing()) return;
            goToStep("2-Base-Privacy");
        },
        selectPrivacy: function(level) {
            state.editingRoom.privacy = level;
            if (returnHomeIfFixing()) return;
            goToStep("3-Config-Style");        // 빛 가림·바깥 시선을 근거로 구성 추천
        },
        selectSheerFeel: function(feel) {
            state.editingRoom.sheerFeel = feel;
            goToStep("3.5-Bridge");
        },
        selectBlindKind: function(kind) {
            state.editingRoom.blindWant = kind;
            goToStep("3.5-Bridge");
        },
        selectMood: function(mood) {
            state.editingRoom.wantMood = mood;
            // 속지가 들어가는 구성이면 속지 느낌을, 블라인드 구성이면 블라인드 종류를 물음 (공간마다. "수정"으로 다시 들어와도 다시 물음 — 38-2)
            const hasSheer = (state.editingRoom.items || []).some(i => i.presetType === 'sheer');
            const hasBlind = (state.editingRoom.items || []).some(i => i.presetType === 'blind');
            goToStep(hasSheer ? "2-Base-SheerFeel" : (hasBlind ? "2-Base-BlindKind" : "3.5-Bridge"));
        },
        chooseWindowComposition: function(type) {
            const rName = state.editingRoom.name;
            if (type === 'double') {
                state.editingRoom.items = [
                    { label: `${rName} 속지`, presetType: "sheer", fabricId: null, floorGap: 0 },
                    { label: `${rName} 겉지`, presetType: "drape", fabricId: null, floorGap: 0 }
                ];
                state.editingRoom.blindWant = null;
            } else if (type === 'sheer_only') {
                state.editingRoom.items = [
                    { label: `${rName} 속지`, presetType: "sheer", fabricId: null, floorGap: 0 }
                ];
                state.editingRoom.blindWant = null;
            } else if (type === 'drape_only') {
                state.editingRoom.items = [
                    { label: `${rName} 겉지`, presetType: "drape", fabricId: null, floorGap: 0 }
                ];
                state.editingRoom.sheerFeel = null;
                state.editingRoom.blindWant = null;
            } else if (type === 'blind_only') {
                state.editingRoom.items = [
                    { label: `${rName} 블라인드`, presetType: "blind", fabricId: null, floorGap: 0 }
                ];
                state.editingRoom.sheerFeel = null;
            }
            state.pendingItemQueue = state.editingRoom.items;
            state.currentItemIndex = 0;
            // 구성 다음: 모든 공간이 "이렇게 들었어요. 맞나요?" (23번). 블라인드로 바꾸면 고른 잇기 방향은 지움
            if (!canLink(state.editingRoom)) state.editingRoom.linkDir = null;
            state.editingRoom.backHome = false;
            if (stepHistory.length && stepHistory[stepHistory.length - 1].step === "2-Base-Home") { stepHistory.pop(); goToStep("2-Base-Home", false); return; }
            goToStep("2-Base-Home");
        },
        // "원단 보기": "찾는 중" 화면에서 사진을 미리 받은 뒤 원단 화면으로 (두 번 눌러도 한 번만)
        proceedToFabricQueue: function() {
            if (state.seeking) return;
            state.seeking = true;
            const open = () => { state.seeking = false; goToStep("4-Fabric-Queue"); };
            try { playFabricSeek(open); } catch (e) { open(); }      // 찾는 중 화면에 문제가 생겨도 원단 화면은 열림
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
            swapFabricPanel(panel, fabricCardHtml(fabric, best, idx, next, item, cat), fabric.id, next);
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
            swapFabricPanel(panel, fabricCardHtml(fabric, best, idx, colorName, item, cat), fabric.id, colorName);
            // 펼친 상태에서 색을 골라도 접지 않음 — "접기" 버튼(또는 칸 밖 누르기·뒤로)을 눌러야만 접힘 (10-15 사장님)
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

                roomTarget.isConfigured = true;
                roomTarget.floorTone = state.editingRoom.floorTone;
                roomTarget.wallTone = state.editingRoom.wallTone;
                roomTarget.lightLevel = state.editingRoom.lightLevel;
                roomTarget.mood = state.editingRoom.mood;
                roomTarget.wantMood = state.editingRoom.wantMood || null;
                roomTarget.lightBlock = state.editingRoom.lightBlock || null;
                roomTarget.privacy = state.editingRoom.privacy || null;
                roomTarget.sheerFeel = state.editingRoom.sheerFeel || null;
                roomTarget.blindWant = state.editingRoom.blindWant || null;
                roomTarget.roomType = state.editingRoom.roomType || roomTarget.roomType || null;
                roomTarget.measuredColor = state.editingRoom.measuredColor || null;
                roomTarget.colorSrc = state.editingRoom.colorSrc || null;
                roomTarget.cardParts = state.editingRoom.cardParts || null;
                roomTarget.linkDir = state.editingRoom.linkDir || null;
                roomTarget.windowDir = windowDirOf(state.editingRoom.windowDir);      // 창 방향 (35번)          // 색 잇기 답 (원단 추천·중심 화면 이유 한 줄)
                roomTarget.diagnosed = true;          // 바닥·벽·채광 진단을 거침 → 제안서에 진단 요약·추천 이유 표시
                roomTarget.curtains = finalizedCurtains;
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
        swapCurtain: function(roomId, idx, fabricId, color, why) { swapCurtain(roomId, idx, fabricId, color, false, why); },
        // 한 톤 밝게(step +1) / 진하게(−1): 그 칸의 toneStep에 더함(0이면 지움). 더 보기에서 고른 잇는 방향(pickDir)은 그대로
        toneSwap: function(roomId, idx, key, step) {
            const e = (spaceEntries || []).find(x => x.key === key);
            const r = state.roomsCart.find(x => x.id === roomId), c = r && r.curtains[idx];
            if (e && c) swapCurtain(roomId, idx, e.fabricId, e.color, false, { toneStep: (c.toneStep || 0) + (Number(step) || 0), pickDir: c.pickDir || null });
        },
        shortFabName: shortFabName,
        // 색 잇기 방향의 말 ("원단을 고른 이유" 카드, app.js가 씀): linkSay = "벽과 이어지는 색", linkWhy = 이유 한 문장
        linkSay: function(dir) { return LINK_WORD[dir] || ''; },
        linkWhy: function(dir) { return LINK_WHY[dir] || ''; },
        // 최종 제안 화면의 쪽 넘기기 · 세로 모드 크게 보기 (39번)
        finalNext: function() { setFinalPage(finalPage + 1); },
        finalPrev: function() { setFinalPage(finalPage - 1); },
        toggleFinalZoom: function() {
            finalZoom = !finalZoom;
            const st = document.querySelector('.fin-stage');
            if (st) st.classList.toggle('is-zoom', finalZoom);
            const btn = document.querySelector('#finPager .fin-zoom');
            if (btn) btn.textContent = finalZoom ? '기본 크기' : '크게 보기';
        },
        linkWord: function(dir) { return { wall: '넓어 보이게', bridge: '그 중간으로', floor: '바닥과 어울리게' }[dir] || ''; },
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
                    lightLevel: r.lightLevel || 'mid', mood: r.mood || 'soft_warm', wantMood: r.wantMood || null,
                    roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, diagnosed: !!r.diagnosed,
                    measuredColor: r.measuredColor || null,
                    width: Number(r.width) || null, height: Number(r.height) || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),
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
        // 자동 저장용: 모든 공간 (계산 결과는 제외)
        // 직원 화면에 있는 동안의 자동 저장: 직원 화면 공간 목록에는 상담 전인 공간이 없으므로 이것을 더함
        getPendingRoomsForSave: function() {
            return window.concierge.getRoomsForSave().filter((r, i) => !state.roomsCart[i].isConfigured);
        },
        getRoomsForSave: function() {
            return state.roomsCart.map(r => ({          // 아직 상담 전인 공간도 (크기·벽·바닥 색을 먼저 담아 둠)
                name: r.name, floorTone: r.floorTone, wallTone: r.wallTone, lightLevel: r.lightLevel, mood: r.mood, wantMood: r.wantMood || null,
                roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, diagnosed: !!r.diagnosed,
                measuredColor: r.measuredColor || null,
                width: r.width || null, height: r.height || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),
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
            clearTimeout(finalPaperTimer);
            finalPaperTimer = setTimeout(renderFinalPaper, 350);
        },
        scrollFinalSec: function(secId) {
            const el = document.getElementById(secId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
})();
