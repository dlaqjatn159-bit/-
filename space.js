(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['space.js']='20261303';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// space.js — 고객 화면 중심 화면(1-Space): 왼쪽 기둥·공간 칸 그리기·한 톤 밝게/진하게·원단 바꾸기·알림·수정하기 화면 (130-4④에서 concierge.js에서 떼어 냄). concierge.js·fabric-pick.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore;      // concierge.js와 잇는 다리 (130-4)
    const { state, getLiveDb, calculateV1ItemPrice, syncToV1MasterRooms, askedRoom, planHas, takeLine, putLine, swapLine, COMP_NAMES, flowPeek, fabricFillStyle, HATCH, hexCode, roomPart, roomSize, roomComp, kindOf, houseColor, furCount, furLabelOf, dirPickerHtml, msrBoxHtml, paneBlockHtml, render, colorFillOf, splitNameColor } = cz;

    // ---- 중심 화면 끝 모습: 한 톤 밝게 / 진하게 · 더 보기에서 바꾸기 (20번 4단계) ----
    // 원단 찾기와 같은 목록(data.js finderEntries: 원단의 색 하나 = 한 장)을 씀. 화면을 그릴 때 한 번만 만듦
    let spaceEntries = null;
    function entryOf(fabricId, color) {
        if (!spaceEntries || !spaceEntries.length) {
            spaceEntries = (typeof finderEntries === 'function') ? finderEntries() : [];
        }
        return (typeof finderFind === 'function') ? finderFind(spaceEntries, fabricId, color) : ((spaceEntries || []).find(e => e.key === fabricId + '__' + (color || '')) || null);      // 같은 원단 묶음도 찾음 (58번)
    }
    // 기준 원단 정보 얻기 (49번, 1안): 품목에 baseFabricId가 있으면 그것, 없으면 지금 원단이 기준(0단계)
    function getToneBase(c) {
        if (!c) return { fabricId: '', colorName: '' };
        return {
            fabricId: c.baseFabricId || c.fabricId,
            colorName: (c.baseColorName !== undefined && c.baseColorName !== null) ? c.baseColorName : (c.colorName || '')
        };
    }
    // 3단계 사다리 (49번, 1안): [ -1단계(진하게) ↔ 0단계(원래 원단) ↔ +1단계(밝게) ]
    // 기준 원단(0단계)을 중심으로 대칭 사다리를 구성하여, 밝게/진하게를 번갈아 눌러도 100% 원래 원단으로 복귀
    function toneNeighbors(c) {
        const base = getToneBase(c);
        const baseEntry = entryOf(base.fabricId, base.colorName);
        if (!baseEntry || baseEntry.L == null || baseEntry.b == null) return { lighter: null, darker: null };

        // 기준 원단과 같은 종류(겉지·속지), 노란기 차이가 작고(9 미만)
        const pool = spaceEntries.filter(x => x.cat === baseEntry.cat && x.key !== baseEntry.key && x.hex && x.L != null && x.b != null && Math.abs(x.b - baseEntry.b) < 9);
        // 같은 원단의 색을 먼저 (결·값이 그대로). 같은 원단에 없을 때만 다른 원단에서
        const pick = (list, gap) => {
            const same = list.filter(x => (x.group || x.fabricId) === (baseEntry.group || baseEntry.fabricId));
            return (same.length ? same : list).sort((p, q) => gap(p) - gap(q))[0] || null;
        };

        const lighterOfBase = pick(pool.filter(x => x.L > baseEntry.L + 1.5), x => (x.L - baseEntry.L) + Math.abs(x.b - baseEntry.b) * 0.3);
        const darkerOfBase = pick(pool.filter(x => x.L < baseEntry.L - 1.5), x => (baseEntry.L - x.L) + Math.abs(x.b - baseEntry.b) * 0.3);

        const step = Number(c.toneStep) || 0;
        if (step > 0) {
            // 현재 +1단계(한 톤 밝은 상태): 더 밝게는 비활성화(끝), 진하게를 누르면 기준 원단(0단계)으로 100% 직접 복귀
            return { lighter: null, darker: baseEntry };
        } else if (step < 0) {
            // 현재 -1단계(한 톤 진한 상태): 밝게를 누르면 기준 원단(0단계)으로 100% 직접 복귀, 더 진하게는 비활성화(끝)
            return { lighter: baseEntry, darker: null };
        } else {
            // 현재 0단계(원래 원단): 밝게는 lighterOfBase(+1), 진하게는 darkerOfBase(-1)
            return { lighter: lighterOfBase, darker: darkerOfBase };
        }
    }
    // 고객에게 보여 줄 "원단 이름 + 색 이름" (예: 오솔로 아이보리)
    function shortFabName(fabricId, color) {
        const f = getLiveDb().find(x => x.id === fabricId);
        if (!f) return '';
        const label = (color && typeof custColorName === 'function') ? custColorName(fabricId, color) : '';      // 182번
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
        const prev = {
            fabricId: c.fabricId,
            colorName: c.colorName || '',
            toneStep: c.toneStep || 0,
            pickDir: c.pickDir || null,
            baseFabricId: c.baseFabricId || null,
            baseColorName: c.baseColorName || null
        };
        const w = why || {};
        const isTone = (w.toneStep !== undefined && w.toneStep !== null);
        const nextBaseFab = isTone ? (c.baseFabricId || prev.fabricId) : fabricId;
        const nextBaseColor = isTone ? ((c.baseColorName !== undefined && c.baseColorName !== null) ? c.baseColorName : prev.colorName) : (color || '');

        c.fabricId = fabricId;
        c.colorName = color || '';
        if (isTone) {
            if (w.toneStep === 0) {
                delete c.toneStep;
            } else {
                c.toneStep = w.toneStep;
            }
            c.baseFabricId = nextBaseFab;
            c.baseColorName = nextBaseColor;
        } else {
            delete c.toneStep;
            delete c.baseFabricId;
            delete c.baseColorName;
        }
        if (w.pickDir) c.pickDir = w.pickDir; else delete c.pickDir;
        c.custPicked = true;      // 손님이 고객 화면에서 바꾼 원단 → 직원 화면 자동 채움이 덮지 않음 (116번)
        c.calc = calculateV1ItemPrice(c);
        r.subtotal = r.curtains.reduce((s, x) => s + ((x.calc && x.calc.curtainSubtotal) || 0), 0);
        syncToV1MasterRooms();
        state.justFilledRoomId = r.id; state.justFilledIdx = idx;
        if (state.step === "1-Space") render();
        if (silent) return;
        const name = shortFabName(fabricId, color);
        spaceToast(`${r.name} ${kindOf(c)}: ${typeof finderJosa === 'function' ? finderJosa(name, '으로', '로') : name + '(으)로'} 바꿨습니다`,
            () => swapCurtain(roomId, idx, prev.fabricId, prev.colorName, true, { toneStep: prev.toneStep, pickDir: prev.pickDir, baseFabricId: prev.baseFabricId, baseColorName: prev.baseColorName }));
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
    // 165번: 되돌리기 — 빼기 전 품목 목록으로. 중심 화면·수정하기에 있을 때만 (다른 화면으로 넘어갔으면 아무것도 안 함)
    function restoreCurtains(roomId, before) {
        const r = state.roomsCart.find(x => x.id === roomId);
        if (!r || !Array.isArray(before) || (state.step !== "1-Space" && state.step !== "1-Space-Edit")) return;
        r.curtains = before.slice();
        r.isConfigured = r.curtains.length > 0;
        if (r.isConfigured) r.compOk = true;
        r.subtotal = r.curtains.reduce((s, x) => s + ((x.calc && x.calc.curtainSubtotal) || 0), 0);
        syncToV1MasterRooms();
        render();
    }
    // 165번: 중심 화면 품목 [빼기] — 묻지 않고 바로 빼고 알림에 되돌리기.
    //  마지막 하나를 빼면 상담 전 공간으로: 빛·시선·느낌 답은 그대로, "이어서 상담하기"가 구성 화면부터 (지난 구성은 회색으로)
    function dropCurtain(roomId, idx) {
        const r = state.roomsCart.find(x => x.id === roomId), c = r && r.isConfigured && r.curtains[idx];
        if (!c) return;
        if (r.altLine && r.curtains.length === 1) { dropLine(roomId, r.lineNo || 1); return; }      // 167번: 두 줄인 공간에서 마지막 품목 = 그 줄 빼기
        const before = r.curtains.slice();
        r.curtains = r.curtains.filter((x, i) => i !== idx);
        if (!r.curtains.length) {
            r.isConfigured = false;
            r.planComp = roomComp({ curtains: before });
            r.planPicked = true;
            r.compOk = false;
        }
        r.subtotal = r.curtains.reduce((s, x) => s + ((x.calc && x.calc.curtainSubtotal) || 0), 0);
        state.activeSpaceId = r.id;
        syncToV1MasterRooms();
        render();
        spaceToast(`${r.name} ${kindOf(c)}를 뺐습니다`, () => restoreCurtains(roomId, before));
    }
    // 167번: 줄 이름 — 구성 이름 (만드는 중이면 빈 글)
    function lineName(o) { return (o && COMP_NAMES[roomComp(o)]) || ''; }
    // 167번: 줄 되돌리기 — 빼기 전 모양으로. 중심 화면에 있을 때만
    function restoreLines(roomId, snap) {
        const r = state.roomsCart.find(x => x.id === roomId);
        if (!r || !snap || state.step !== "1-Space") return;
        putLine(r, snap.line);
        r.altLine = snap.alt; r.altBuilding = snap.b; r.pickPending = snap.p;
        syncToV1MasterRooms();
        render();
    }
    // 167번: 줄 [빼기] — 묻지 않고 빼고 알림에 되돌리기. 남은 줄이 그 공간의 한 줄이 됨
    function dropLine(roomId, lineNo) {
        const r = state.roomsCart.find(x => x.id === roomId);
        if (!r || !r.altLine) return;
        const snap = { line: takeLine(r), alt: JSON.parse(JSON.stringify(r.altLine)), b: !!r.altBuilding, p: !!r.pickPending };
        const isCur = lineNo === (r.lineNo || 1);
        const gone = isCur ? snap.line : snap.alt;
        if (isCur) putLine(r, r.altLine);
        r.altLine = null; r.altBuilding = false; r.pickPending = false; r.lineNo = 1;
        state.activeSpaceId = r.id;
        syncToV1MasterRooms();
        render();
        const nm = lineName(gone);
        spaceToast(`${r.name}: ${nm ? nm + ' ' : ''}후보를 뺐습니다`, () => restoreLines(roomId, snap));
    }
    // 167번: 줄을 누르면 고른 줄 (다른 줄은 흐리게, 지우지 않음). 만드는 중엔 못 고름
    function selectLine(roomId, lineNo) {
        const r = state.roomsCart.find(x => x.id === roomId);
        if (!r || !r.altLine || r.altBuilding) return;
        if (lineNo === (r.lineNo || 1) && !r.pickPending) return;      // 168번: 고른 줄의 칩을 다시 누름 → 아무 일 없음
        if (lineNo !== (r.lineNo || 1)) swapLine(r);
        r.pickPending = false;
        state.justFilledRoomId = r.id;      // 색 칸이 차오르는 움직임으로 바뀐 것을 보여 줌
        syncToV1MasterRooms();
        render();
    }
    // 166번: 손님이 누른 답을 명사형으로 (창 방향·크기는 머리 줄에 있음, "잘 모르겠어요"는 뺌). 낱말마다 누르면 그 질문으로
    const ANSWER_SAY = {
        lightBlock: { light: '빛 들어와도 괜찮음', soft: '빛 적당히 가림', dark: '빛 완전히 가림' },
        privacy: { open: '시선 괜찮음', some: '시선 조금 가림', high: '시선 많이 가림' },
        pres: { calm: '조용히 스며들게', weight: '차분한 무게감', point: '포인트 있게' },
        sheer: { smooth: '매끈한 속지', textured: '짜임이 보이는 속지', cozy: '도톰한 속지', linen: '린넨 속지' },      // 191번: 린넨 (cozy는 옛 상담)
        tex: { smooth: '매끈한 겉지', texture: '짜임이 보이는 겉지', fluffy: '보송한 겉지' }
    };
    function answerSay(r, keys) {      // 170번: keys를 주면 그 칸만 (두 줄 공간은 이름 아래 빛·시선, 줄마다 느낌·결)
        const has = k => r.isConfigured ? (r.curtains || []).some(c => c.presetType === k) : planHas(r, k);
        return [
            ['lightBlock', r.lightBlock],
            ['privacy', r.privacy],
            ['pres', (has('drape') || has('blind')) && r.ownTaste ? r.ownPres : null],      // 197번: 속지만 공간은 느낌 낱말을 안 보임(옛 상담 값은 저장에 그대로)
            ['sheer', has('sheer') ? r.sheerFeel : null],
            ['tex', has('drape') && r.ownTaste ? r.ownTex : null]
        ].filter(([k, v]) => v && ANSWER_SAY[k][v] && (!keys || keys.includes(k))).map(([k, v]) => ({ key: k, text: ANSWER_SAY[k][v] }));
    }
    // ---- 246번: 중심 화면 왼쪽 창가 장면 (결정 #282 B '빛 하나') — 작은 조각보 자리. 지금 고른 공간 하나를 그림 ----
    //  조각 자리는 시안 해보기_창가장면_1116_시안.html PIECES 그대로([왼, 위, 폭, 높이] %). 방은 살짝 가라앉히고 창 하나에만 빛
    //  못 잰 벽·바닥은 빗금(아직 모름), 가구 색이 없으면 소파 없음. 원단을 고르기 전 = 맨 창(봉·레일만) → 고르면 속지가 닫히고 겉지가 펼쳐지고 블라인드가 내려옴
    //  같은 공간에서 모습이 바뀌면 지난 모습에서 움직여 감(자리 0.95초 · 색 0.7초), 공간을 바꾸면 움직임 없이 바로
    const SCENE_KEYS = ['wall', 'glow', 'glass', 'sill', 'floor', 'patch', 'blind', 'sheer', 'drapeL', 'drapeR', 'rod', 'head', 'sofaBack', 'sofaSeat', 'shade'];
    const SCENE_STRIPES = 'repeating-linear-gradient(180deg, rgba(255,255,255,0) 0 5px, rgba(255,255,255,0.42) 5px 9px)';      // 블라인드 줄(솔리드 · 쉬어)
    let sceneMemo = null;      // { roomId, look } — 지난번에 그린 모습 (같은 공간이면 여기서부터 움직임)
    function sceneShade(hex, dl) {      // 밝기만 dl만큼 (Lab L)
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''), RC = window.RoomColor;
        if (!m || !RC || !RC.rgbToLab || !RC.labToHex) return hex;
        const l = RC.rgbToLab(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16));
        return RC.labToHex(l.L + dl, l.a, l.b);
    }
    function sceneLook(r) {
        const wallP = roomPart(r, 'wall'), floorP = roomPart(r, 'floor');
        const wall = wallP && wallP.hex, floor = floorP && floorP.hex;
        const furs = (r.measuredColor && Array.isArray(r.measuredColor.furniture)) ? r.measuredColor.furniture.filter(f => f && f.stay !== false && (f.hex || typeof f.L === 'number')) : [];
        const fur = furs.length ? (furs[0].hex || (window.RoomColor ? RoomColor.labToHex(furs[0].L, furs[0].a, furs[0].b) : null)) : null;
        const items = r.isConfigured ? (r.curtains || []) : [];
        const has = k => r.isConfigured ? items.some(c => c.presetType === k) : planHas(r, k);      // 고르기 전엔 정한 구성으로 봉·레일만
        const itemOf = k => items.find(c => c.presetType === k) || null;
        const fillOf = c => (!c || !c.fabricId || (typeof sampleBlindFabric === 'function' && sampleBlindFabric(c.fabricId))) ? null : colorFillOf(c.fabricId, c.colorName);
        const fab = c => { const f = fillOf(c); return f ? { c: f } : { img: HATCH }; };      // 색을 모르면 빗금
        const sheer = itemOf('sheer'), drape = itemOf('drape'), blind = itemOf('blind');
        const filtered = !!(sheer || blind);      // 창을 덮는 속지·블라인드가 있으면 빛이 걸러짐
        const P = (rect, o) => Object.assign({ r: rect, o: 1, c: '', img: '', sh: '' }, o || {});
        const rodC = wall ? sceneShade(wall, -28) : '#9a9087';
        const blindFill = blind ? fillOf(blind) : null;
        return {
            wall: P([0, 0, 100, 75], wall ? { c: wall } : { img: HATCH }),
            glow: P([8, -14, 96, 104], { img: `radial-gradient(ellipse 46% 48% at 50% 48%, rgba(255,252,243,${filtered ? 0.4 : 0.55}) 0%, rgba(255,252,243,0) 100%)` }),
            glass: P([37, 11, 38, 56], { c: '#FFFDF7', img: 'radial-gradient(ellipse 70% 60% at 50% 42%, #FFFFFF 0%, #FFFCF4 45%, #F3EEE4 100%)', sh: `0 0 70px 30px rgba(255,251,240,${filtered ? 0.45 : 0.7})` }),
            sill: P([35, 66.4, 42, 1.4], { c: wall ? sceneShade(wall, 3) : '#f3efe8' }),
            floor: P([0, 75, 100, 25], floor ? { c: floor } : { img: HATCH }),
            patch: P([30, 75, 58, 25], { img: `linear-gradient(180deg, rgba(255,250,236,${filtered ? 0.32 : 0.5}) 0%, rgba(255,250,236,0) 100%)` }),
            blind: P([37, 11, 38, blind ? 40 : 0], blind ? (blindFill ? { c: blindFill, img: SCENE_STRIPES } : { img: HATCH }) : { o: 0 }),
            sheer: P(sheer ? (drape ? [38, 9, 36, 66] : [30, 7, 52, 69]) : (has('drape') ? [38, 9, 0, 66] : [30, 7, 0, 69]), sheer ? Object.assign(fab(sheer), { o: 0.78 }) : { o: 0 }),
            drapeL: P(drape ? [30, 7, 10, 69] : [30, 7, 0, 69], drape ? fab(drape) : { o: 0 }),
            drapeR: P(drape ? [72, 7, 10, 69] : [82, 7, 0, 69], drape ? fab(drape) : { o: 0 }),
            rod: P([28, 6, 56, 0.9], { c: rodC, o: (has('sheer') || has('drape')) ? 1 : 0 }),
            head: P([36, 9.6, 40, 1.8], { c: blindFill ? sceneShade(blindFill, -12) : rodC, o: has('blind') ? 1 : 0 }),
            sofaBack: P([-4, 63, 33, 11], fur ? { c: sceneShade(fur, -4) } : { o: 0 }),
            sofaSeat: P([-4, 70, 35, 11], fur ? { c: fur } : { o: 0 }),
            shade: P([0, 0, 100, 100], { img: 'radial-gradient(ellipse 75% 85% at 56% 42%, rgba(60,44,30,0) 0%, rgba(60,44,30,0) 45%, rgba(60,44,30,0.10) 75%, rgba(60,44,30,0.22) 100%)' })
        };
    }
    function sceneStyle(p) {
        return `left:${p.r[0]}%;top:${p.r[1]}%;width:${p.r[2]}%;height:${p.r[3]}%;opacity:${p.o};background-color:${p.c || 'transparent'};`
            + (p.img ? `background-image:${p.img};` : '') + (p.sh ? `box-shadow:${p.sh};` : '');      // 빈 background-image면 CSS의 주름 무늬가 보임
    }
    function sceneSettle(look) {      // 지난 모습으로 그린 뒤 지금 모습으로 바꿈 → CSS 움직임
        const box = document.getElementById('dosScene');
        if (!box) return;
        void box.offsetWidth;      // 지난 모습을 한 번 계산시킨 뒤에 바꿔야 움직임이 생김
        box.querySelectorAll('[data-k]').forEach(el => { const p = look[el.dataset.k]; if (p) el.setAttribute('style', sceneStyle(p)); });
    }
    function sceneHtml(r) {
        if (!r) return '';
        const now = sceneLook(r);
        const same = !!(sceneMemo && sceneMemo.roomId === r.id);      // 공간을 바꾸면 움직임 없이 바로
        const from = same ? sceneMemo.look : now;
        sceneMemo = { roomId: r.id, look: now };
        if (same && JSON.stringify(from) !== JSON.stringify(now)) requestAnimationFrame(() => sceneSettle(now));      // 화면을 다 넣은 뒤(render의 innerHTML 다음)
        return '<div class="dos-scene" id="dosScene" aria-hidden="true">'
            + SCENE_KEYS.map(k => `<i class="dsc-p dsc-${k}" data-k="${k}" style="${sceneStyle(from[k])}"></i>`).join('') + '</div>';
    }

    // ---- 중심 화면(1-Space): 왼쪽 여백 기둥(집 전체 호흡·공간 목차·액션) + 오른쪽 '한 공간씩 크게 보기' 작업대 (+ 전체 한눈에 전환, 77번) ----
    function spaceHtml(currentCust) {
        spaceEntries = (typeof finderEntries === 'function') ? finderEntries() : [];
        const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const list = state.roomsCart, doneN = list.filter(r => r.isConfigured).length;
        const fresh = state.justFilledRoomId, freshIdx = state.justFilledIdx;        // 방금 원단을 고른 공간(한 톤 바꾸기면 그 칸만): 색 칸이 차오르는 움직임
        if (fresh != null) state.activeSpaceId = fresh;
        state.justFilledRoomId = null; state.justFilledIdx = null;
        if (!state.activeSpaceId || !list.some(r => r.id === state.activeSpaceId)) {
            const firstTodo = list.find(r => !r.isConfigured);
            state.activeSpaceId = (firstTodo || list[0] || {}).id || null;
        }
        const isAllMode = !!state.spaceViewAll;
        const flowNow = flowPeek(), started = doneN > 0 || list.some(r => askedRoom(r));      // 119번: 길잡이가 다음에 할 일
        const fillCls = (r, i) => (r.id === fresh && (freshIdx == null || freshIdx === i)) ? ' fill-in' : '';
        // 168번: 품목 칸 하나 (한 줄·두 줄 공간이 같이 씀). mode — 'one' 한 줄 공간 · 'cur' 두 줄 공간의 지금 줄(칩을 누르면 그 줄을 고름)
        //  · 'alt' 다른 줄(칸을 누르면 그 줄로. 버튼은 자리만 남기고 안 보임 — 두 줄 높이가 같게) · 'still' 만드는 중일 때 다른 줄(누르지 않음)
        const itemHtml = (r, c, i, mode, no) => {
            const live = mode === 'one' || mode === 'cur';
            const opts = [];
            if (window.Pricing.shapeOn(c, FABRIC_DB)) opts.push('형상기억');      // 248번
            if (c.leadBand) opts.push('리드밴드');
            if (c.hotelFit) opts.push('리담 핏');      // 230번
            const tones = c.presetType === 'blind' ? null : toneNeighbors(c);
            const toneBtn = (e, word, step) => `<button type="button"${e && live ? ` onclick="window.concierge.toneSwap(${r.id}, ${i}, '${e.key.replace(/'/g, "\\'")}', ${step})"` : ' disabled'}><i style="background:${e ? e.hex : '#eee8df'}"></i><span>${word}</span></button>`;
            const isBlindDupe = c.presetType === 'blind' && (c.calc?.fabName || c.label || '').includes('블라인드');
            const baseFabName = (typeof ticketBookName === 'function') ? ticketBookName(c) : ((c.calc && c.calc.fabName) || c.label || '원단');
            const colLbl = (c.fabricId && c.colorName && typeof custColorName === 'function') ? custColorName(c.fabricId, c.colorName) : '';      // 182번
            const showColLbl = colLbl && !baseFabName.endsWith(colLbl);
            const fc = live ? fillCls(r, i) : '', swStyle = fabricFillStyle(c.fabricId, c.colorName);
            let s = mode === 'alt' ? `<div class="dos-item" role="button" onclick="window.concierge.selectLine(${r.id}, ${no})">` : '<div class="dos-item">';
            s += '<div class="dos-item-main">';
            s += mode === 'cur' ? `<button type="button" class="dos-sw${fc}" style="${swStyle}" onclick="window.concierge.selectLine(${r.id}, ${no})" aria-label="${esc(lineName(r))}"></button>` : `<div class="dos-sw${fc}" style="${swStyle}"></div>`;
            s += `<div class="dos-txt"><button type="button" class="dos-redit dos-drop"${live ? ` onclick="window.concierge.dropCurtain(${r.id}, ${i})"` : ' disabled'}>빼기</button>`;      // 168번: 빼기는 칸 오른쪽 위 구석 (165번: 묻지 않고 빼고 알림에 되돌리기)
            s += isBlindDupe ? '' : `<div class="dos-kind">${kindOf(c)}</div>`;
            s += `<div class="dos-fab font-serif-kr"><span class="dos-fname">${esc(baseFabName)}</span>${showColLbl ? `<span class="dos-fcolor">${esc(colLbl)}</span>` : ''}${opts.length ? `<em class="dos-fopts">· ${opts.join(' · ')}</em>` : ''}</div>`;
            if (c.presetType !== 'blind') {      // 블라인드는 더 보기·밝게/진하게가 없음
                s += '<div class="dos-item-sub">';
                s += `<button type="button" class="dos-more"${live ? ` onclick="openSpaceMore(${r.id}, ${i})"` : ' disabled'}>더 보기</button>`;
                if (tones) s += `<div class="dos-tone">${toneBtn(tones.lighter, '밝게', 1)}${toneBtn(tones.darker, '진하게', -1)}</div>`;      // 168번: "한 톤" 뺌 — 앞의 색 점이 뜻을 보여 줌
                s += '</div>';
            }
            s += '</div></div></div>';
            return s;
        };

        let h = `<div class="dos-stage"><div class="dos-sheet${isAllMode ? ' is-all-mode' : ' is-single-mode'}">`;
        h += '<div class="dos-left">';
        h += '<div class="dos-top font-serif-kr"><h1 data-staff-hold>' + redamLogoSVG() + '</h1></div>'; // 42번: 빛과 공간 제거
        // 246번: 상담 중 조각보 자리에 지금 고른 공간의 창가 장면(결정 #282 B). 최종 제안 표지 조각보는 그대로(final.js)
        if (list.length) h += sceneHtml(list.find(r => r.id === state.activeSpaceId) || list[0]);
        // 133번(재검토 A3): 로고 아래 "○○ 고객님의 공간" 이름표는 뺌 — 레이아웃이 설명하게
        // 161번: 담은 품목이 모두 실물 견본(우드·색 못 잰 블라인드)이면 "찾았습니다"라 하지 않음
        const allSample = doneN && list.filter(r => r.isConfigured).every(r => (r.curtains || []).length && r.curtains.every(c => typeof sampleBlindFabric === 'function' && sampleBlindFabric(c.fabricId)));
        h += allSample ? '<h2 class="dos-lead font-serif-kr">상담 때 실물 견본으로<br>함께 고르겠습니다</h2>'
           : doneN ? '<h2 class="dos-lead font-serif-kr">공간마다 알맞은<br>원단을 찾았습니다</h2>' // 42번: 사족 설명 제거
                   : '<h2 class="dos-lead font-serif-kr">먼저 크기와 색을<br>함께 살펴보겠습니다</h2>';
        // 맨 위 공간 전체 색 띠: 칸을 누르면 그 공간으로 이동 (77번)
        const strip = list.length ? list.map(r => {
            const isSel = !isAllMode && r.id === state.activeSpaceId;
            const inner = r.isConfigured && r.curtains.length
                ? r.curtains.map((c, i) => `<i class="${fillCls(r, i).trim()}" style="background:${colorFillOf(c.fabricId, c.colorName)}"></i>`).join('')
                : `<i style="background:${HATCH}"></i>`;
            return `<button type="button" class="dos-strip-seg${isSel ? ' is-active' : ''}" style="flex:${r.isConfigured && r.curtains.length ? r.curtains.length : 1}" onclick="window.concierge.selectSpaceRoom(${r.id})" aria-label="${esc(r.name)} 보기">${inner}</button>`;
        }).join('') : `<i style="background:${HATCH}"></i>`;
        h += `<div class="dos-house"><div class="dos-house-strip">${strip}</div>`;
        // 121번: 로고 아래 "우리 집 취향" 줄은 뺌 (포인트가 공간마다라 집 전체 이름표가 맞지 않음)
        if (list.length) {
            h += '<div class="dos-nav-list">';
            list.forEach(r => {
                const isSel = !isAllMode && r.id === state.activeSpaceId;
                const swDots = r.isConfigured && r.curtains.length
                    ? r.curtains.map(c => `<i style="background:${colorFillOf(c.fabricId, c.colorName)}"></i>`).join('')
                    : `<i class="is-empty" style="background:${HATCH}"></i>`;
                h += `<button type="button" class="dos-nav-item font-serif-kr${isSel ? ' is-active' : ''}" onclick="window.concierge.selectSpaceRoom(${r.id})">`
                    + `<span class="dos-nav-nm">${esc(r.name)}</span>`
                    + `<span class="dos-nav-dots">${swDots}</span>`
                    + `</button>`;
            });
            h += '</div>';
        }
        h += '</div></div>';

        h += '<div class="dos-right">';
        if (list.length > 1) {
            h += `<div class="dos-view-bar"><button type="button" class="dos-view-toggle" onclick="window.concierge.toggleSpaceViewMode()">${isAllMode ? '한 공간씩 크게 보기' : '전체 한눈에 보기'}</button></div>`;
        }
        // 121번: 아직 공간이 없으면 오른쪽에 "+ 공간 추가" 버튼 하나만 · 133번: 그 위에 흙빛 점 하나(빈 종이에 점 하나, 소책자 표지와 같은 얼굴)
        if (!list.length) {
            h += '<section class="dos-room dos-add dos-first"><i class="dos-first-dot" aria-hidden="true"></i><button type="button" class="txt-cta font-serif-kr" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button></section>';
        }
        const visibleRooms = isAllMode ? list : list.filter(r => r.id === state.activeSpaceId);
        visibleRooms.forEach(r => {
            const wall = roomPart(r, 'wall'), floor = roomPart(r, 'floor'), size = roomSize(r);
            const dirTxt = windowDirText(windowDirOf(r.windowDir));
            const metaParts = [dirTxt ? dirTxt + '향' : '', size ? `${size.w} × ${size.h}cm` : ''].filter(Boolean).join(' · '); // 41번: 남향 및 크기 옆 배치
            const boxH = isAllMode ? 54 : 84, floorH = isAllMode ? 11 : 16, aboveH = boxH - floorH;
            h += `<section class="dos-room${isAllMode ? '' : ' is-hero'}">`;
            h += `<div class="dos-rhead font-serif-kr"><span class="dos-rname">${esc(r.name)}${metaParts ? `<small class="dos-rmeta">${esc(metaParts)}</small>` : ''}</span>` // 41번: 이중커튼 삭제, 크기를 남향 옆으로
                + `<span class="dos-rhead-r">${(window.RoomColor && RoomColor.openFurniture && furCount(r) < RoomColor.FUR_MAX) ? `<button type="button" class="dos-redit" onclick="window.concierge.addFurniture(${r.id})">+ 가구</button>` : ''}${r.isConfigured && !r.altLine ? `<button type="button" class="dos-redit" onclick="window.concierge.addAltLine(${r.id})">+ 다른 구성 더하기</button>` : ''}${size && window.RedamRoom3D ? `<button type="button" class="dos-redit" onclick="window.concierge.openRoom3D(${r.id})">입체 방</button>` : ''}<button type="button" class="dos-redit" onclick="window.concierge.editRoom(${r.id})">수정하기</button></span></div>`;      // 151번: 상담 전 공간에도
            if (!isAllMode) h += paneChipsHtml(r);      // 216번: 블라인드 장 크기 — 누르면 손잡이 좌 ↔ 우
            const says = answerSay(r, r.altLine ? ['lightBlock', 'privacy'] : null);      // 166번: 손님 답 한 줄 — 낱말마다 그 질문으로 고치기 · 170번: 두 줄 공간은 공간 답(빛·시선)만
            if (says.length) h += `<div class="dos-rsay font-serif-kr">${says.map(s => `<button type="button" onclick="window.concierge.fixAnswer(${r.id}, '${s.key}')">${esc(s.text)}</button>`).join('<i aria-hidden="true">·</i>')}</div>`;
            const furs = (r.measuredColor && Array.isArray(r.measuredColor.furniture)) ? r.measuredColor.furniture.filter(f => f && f.hex) : [];
            const dark = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) < 120; };
            const seg = (k, bg, f, cls) => `<div class="${(dark(bg) ? 'is-dark ' : '') + (cls || '')}" style="flex:${f};background:${bg || '#e5dcd0'}"><span>${esc(k)}</span></div>`;
            const wHex = wall && wall.hex ? wall.hex : '#f2eee8';
            const fHex = floor && floor.hex ? floor.hex : '#e5ddcf';

            // 부분 치수가 있어서 벽이 남는 경우에만 벽 연결 및 비율 계산 (43번)
            const sW = Number(r.spaceWidth) || 0, cW = Number(r.width) || 0;
            const sH = Number(r.spaceHeight) || 0, cH = Number(r.height) || 0;
            const isPartMode = r.sizeMode === 'part' || r.sizeMode === 'partial';
            const hasPartialW = (sW > 0 && cW > 0 && sW > cW);
            const hasPartialH = (sH > 0 && cH > 0 && sH > cH);
            const isPartial = isPartMode || hasPartialW || hasPartialH;

            const TOTAL_FLEX = 10.0;
            let curtTotalFlex = 8.8; // 전체 모드 기본: 커튼이 88% 차지 (시원한 전체 창)
            let wallSideFlex = 0.6;  // 양옆 벽은 6%씩
            let baseWallHeight = 0;  // 전체 모드: 바닥까지 닿음 (하단 벽 없음)

            if (isPartial) {
                if (hasPartialW) {
                    // 가로가 줄어들면 가운데 커튼이 비례적으로 폭이 줄어듦 (43번)
                    const curtRatio = Math.max(0.18, Math.min(0.85, cW / sW));
                    curtTotalFlex = TOTAL_FLEX * curtRatio;
                    wallSideFlex = (TOTAL_FLEX - curtTotalFlex) / 2;
                } else if (isPartMode) {
                    curtTotalFlex = 6.0;
                    wallSideFlex = 2.0;
                }
                if (hasPartialH) {
                    // 높이가 다를 때만(커튼이 바닥까지 닿지 않을 때만) 하단 벽 연결 (43번 · 76·77번)
                    const wallHRatio = Math.max(0.12, Math.min(0.55, (sH - cH) / sH));
                    baseWallHeight = Math.round(aboveH * wallHRatio);
                } else {
                    baseWallHeight = 0; // 높이가 같으면 바닥까지 닿으므로 하단 벽 절대 연결 안 됨!
                }
            }

            let topSegs = '';
            if (r.isConfigured && r.curtains.length) {
                if (r.curtains.length === 2 && r.curtains.some(c => c.presetType === 'sheer') && r.curtains.some(c => c.presetType === 'drape')) {
                    const drape = r.curtains.find(c => c.presetType === 'drape'), sheer = r.curtains.find(c => c.presetType === 'sheer');
                    const dFill = colorFillOf(drape.fabricId, drape.colorName), sFill = colorFillOf(sheer.fabricId, sheer.colorName);
                    const drapeFlex = curtTotalFlex * 0.25;
                    const sheerFlex = curtTotalFlex * 0.5;
                    topSegs += seg('벽', wHex, wallSideFlex);
                    topSegs += seg('겉지', dFill, drapeFlex, fillCls(r, 0));
                    topSegs += seg('속지', sFill, sheerFlex, fillCls(r, 1));
                    topSegs += seg('겉지', dFill, drapeFlex, fillCls(r, 0));
                    topSegs += seg('벽', wHex, wallSideFlex);
                } else if (r.curtains.length === 1) {
                    const c0 = r.curtains[0], k = kindOf(c0);
                    topSegs += seg('벽', wHex, wallSideFlex);
                    topSegs += seg(k, colorFillOf(c0.fabricId, c0.colorName), curtTotalFlex, fillCls(r, 0));
                    topSegs += seg('벽', wHex, wallSideFlex);
                } else {
                    topSegs += seg('벽', wHex, wallSideFlex);
                    const eachFlex = curtTotalFlex / r.curtains.length;
                    r.curtains.forEach((c, i) => { topSegs += seg(kindOf(c), colorFillOf(c.fabricId, c.colorName), eachFlex, fillCls(r, i)); });
                    topSegs += seg('벽', wHex, wallSideFlex);
                }
            } else {
                topSegs += seg('벽', wHex, TOTAL_FLEX);      // 가구는 아래에서 바닥 위에 세움 (67번)
            }
            const midWindowH = baseWallHeight > 0 ? (aboveH - baseWallHeight) : aboveH;
            const wallBaseHtml = baseWallHeight > 0 ? `<div class="arch-wall-base" style="height:${baseWallHeight}px;background:${wHex}"></div>` : '';
            // 가구: 이름 없이 색 상자로 바닥 위에 세워 커튼 앞에 둠. 양옆 벽에 붙여 왼쪽·오른쪽 번갈아 (67번)
            let furHtml = '';
            if (furs.length) {
                const ABOVE = aboveH, FLOOR = floorH, curtH = ABOVE - baseWallHeight;
                const sideP = wallSideFlex / TOTAL_FLEX * 100, areaP = 100 - sideP * 2;
                const FUR_W = { 소파: 24, 침대: 24, '식탁·책상': 16, '붙박이장·수납장': 16, 책장: 10, '이불·침구': 20, 기타: 10 };
                const FUR_TALL = { '붙박이장·수납장': true, 책장: true };
                const kinds = furs.map(f => furLabelOf(f.n));
                const stand = furs.map((f, i) => ({ f, k: kinds[i] })).filter(x => x.k !== '러그·카펫');
                const sum = stand.reduce((a, x) => a + (FUR_W[x.k] || 10), 0);
                const scale = sum ? Math.min(1, 50 / sum, (areaP - 2) / sum) : 1;
                let curL = sideP, curR = sideP;
                stand.forEach((x, i) => {
                    const w = (FUR_W[x.k] || 10) * scale;
                    const ht = FUR_TALL[x.k] ? Math.round(ABOVE * 2 / 3) : x.k === '이불·침구' ? Math.max(7, Math.round(curtH / 4)) : Math.max(12, Math.round(curtH / 2));
                    const pos = i % 2 === 0 ? `left:${curL.toFixed(1)}%` : `right:${curR.toFixed(1)}%`;
                    if (i % 2 === 0) curL += w; else curR += w;
                    furHtml += `<i class="arch-fur" style="${pos};width:${w.toFixed(1)}%;height:${ht}px;bottom:${FLOOR}px;background:${x.f.hex}"></i>`;
                });
                furs.forEach((f, i) => { if (kinds[i] === '러그·카펫') furHtml += `<i class="arch-fur is-rug" style="left:${(sideP + 4).toFixed(1)}%;width:30%;height:4px;bottom:4px;background:${f.hex}"></i>`; });
            }
            h += `<div class="arch-layer-box" style="height:${boxH}px"><div class="arch-mid-window${furHtml ? ' has-fur' : ''}" style="height:${midWindowH}px">${topSegs}</div>${wallBaseHtml}<div class="arch-bot-floor${dark(fHex) ? ' is-dark' : ''}" style="height:${floorH}px;background:${fHex}"><span>바닥</span></div>${furHtml}</div>`;
            // 168번: 두 줄 공간 — 줄마다 품목 칸 한 줄(줄 번호 순서 그대로, 고르거나 바꿔도 자리는 그대로)
            //  칩을 누르면 그 줄을 고름(그림·답 한 줄·머리 크기가 그 줄로) · 고른 줄은 왼쪽 흙빛 세로선, 다른 줄은 흐리게(칩과 이름만) · 아직 안 고름이면 둘 다 선명, 세로선 없음
            if (r.altLine) {
                const building = r.altBuilding || !r.isConfigured, pending = building || !!r.pickPending;
                const sizeOf = o => { const s = roomSize(o); return s ? `${s.w} × ${s.h}cm` : ''; };
                const sizeDiff = !building && sizeOf(r) !== sizeOf(r.altLine);      // 두 줄 크기가 다를 때만 줄마다 작게 (같으면 머리 줄 하나)
                const rows = [{ o: r, cur: true }, { o: r.altLine, cur: false }].sort((a, b) => (a.o.lineNo || 1) - (b.o.lineNo || 1));
                const lineSay = (o, cur) => {      // 170번: 줄마다 그 줄의 느낌·결 — 본체 줄은 눌러서 고치고, 다른 줄은 글만
                    const v = cur ? r : Object.assign({}, r, o);      // 예전 둘째 줄(취향 칸 없음)은 본체 값 (168번 putLine과 같게)
                    const says = answerSay(v, ['pres', 'sheer', 'tex']);
                    if (!says.length) return '';
                    return `<div class="dos-rsay dos-lsay font-serif-kr">${says.map(s => cur ? `<button type="button" onclick="window.concierge.fixAnswer(${r.id}, '${s.key}')">${esc(s.text)}</button>` : `<span>${esc(s.text)}</span>`).join('<i aria-hidden="true">·</i>')}</div>`;
                };
                h += '<div class="dos-lines2">';
                rows.forEach(({ o, cur }) => {
                    const no = o.lineNo || 1;
                    if (cur && building) {      // 만드는 중: 빗금 칩만 (누르면 이어서 만들기, 구석 [빼기]는 만들던 줄 빼기)
                        h += `<div class="dos-items-wrap is-building">${lineSay(r, true)}<div class="dos-item"><div class="dos-item-main"><button type="button" class="dos-sw" style="background:${HATCH}" onclick="window.concierge.flowNext()" aria-label="이어서 상담하기"></button><div class="dos-txt"><button type="button" class="dos-redit dos-drop" onclick="window.concierge.dropLine(${r.id}, ${no})">빼기</button></div></div></div></div>`;
                        return;
                    }
                    h += `<div class="dos-items-wrap${cur ? (pending ? ' is-cur' : ' is-cur is-on') : (building ? ' is-alt is-still' : (pending ? ' is-alt' : ' is-alt is-dim'))}">`;
                    h += lineSay(o, cur);      // 170번
                    (o.curtains || []).forEach((c, i) => { h += itemHtml(r, c, i, cur ? 'cur' : (building ? 'still' : 'alt'), no); });
                    if (sizeDiff) h += `<small class="dos-line-size">${esc(sizeOf(o))}</small>`;
                    h += '</div>';
                });
                h += '</div></section>';
                return;
            }
            if (!r.isConfigured) {
                h += '</section>';      // 133번(재검토 A3): "상담하고 나면 … 채워집니다" 설명 문장은 뺌
                return;
            }
            // 중심 화면에서는 이유 설명 문장("벽과 바닥의 중간 톤으로 골랐어요…")을 빼서 여백과 원단 스와치에 집중 (77번 사장님 확정 — 이유는 최종 제안 쇼룸 시트에만)
            h += `<div class="dos-items-wrap${r.curtains.length >= 2 ? ' is-pair' : ' is-one'}">`;
            r.curtains.forEach((c, i) => { h += itemHtml(r, c, i, 'one'); });
            h += '</div></section>';
        });
        if (isAllMode) {
            h += '<section class="dos-room dos-add"><button type="button" class="dos-addbtn font-serif-kr" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button></section>';
        }
        h += '</div>';

        // 아래 버튼: 남은 공간이 있으면 "상담 시작 / 다음 공간 상담하기", 모두 끝났으면 "최종 제안 보기". 가로 대화면에서는 왼쪽 기둥 하단에 고정 (40-1)
        const next = list.find(r => !r.isConfigured);
        h += '<div class="dos-acts"><div class="dos-main font-serif-kr">';
        // 152번: 공간 하나를 질문 → 구성 → 취향 → 원단 → 마무리까지 하고 여기로. 다음 공간은 공간 칸을 누르거나 이 버튼으로
        if (next) h += `<button type="button" class="dos-act is-main" onclick="window.concierge.flowNext()">${flowNow && flowNow.kind === 'fabric' ? `${esc(flowNow.room.name)} 원단 고르기` : (started ? '이어서 상담하기' : '질문 시작하기')} →</button>`;      // 133번(재검토 A5): 첫 화면 "상담 시작"과 이름이 겹쳐 다음에 나올 것(질문)을 말함
        if (doneN) h += `<button type="button" class="dos-act${next ? '' : ' is-main'}" onclick="window.concierge.goToCheckout()">최종 제안 보기${next ? '' : ' →'}</button>`;
        if (list.length) h += '<button type="button" class="dos-act dos-act-add" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button>';      // 133번(재검토 A4): 빈 화면엔 오른쪽 하나만
        h += '</div></div>';
        h += '</div></div>';
        return h;
    }
    // 수정하기: 크기와 색을 고치는 화면 (상담 내용은 그대로). 고친 값은 "저장"을 눌러야 공간에 들어감
    // 216번: 공간 화면 블라인드 장 — "손잡이  100 × 240 좌 · 230 × 240 우 · 100 × 240 우", 크기를 누르면 좌 ↔ 우 (기본 우). 블라인드가 없는 공간은 빈 글
    function paneChipsHtml(r) {
        const ci = (r.curtains || []).findIndex(c => c.presetType === 'blind');
        if (ci < 0) return '';
        const c = r.curtains[ci], W = Number(c.width) || 0, H = Number(c.height) || 0;
        const HAND = { L: '좌', R: '우' };
        const btns = Pricing.panesOf(c).map((p, i) => {
            const w = p.w == null ? W : p.w, hh = p.h == null ? H : p.h;
            if (!(w > 0 && hh > 0)) return '';
            return `<button type="button" aria-label="${w} × ${hh} 손잡이 ${HAND[p.hand]}, 누르면 바뀝니다" onclick="window.concierge.flipPaneHand(${r.id}, ${ci}, ${i})">${w} × ${hh}${p.qty > 1 ? ` · ${p.qty}장` : ''} <b>${HAND[p.hand]}</b></button>`;
        }).filter(Boolean);
        return btns.length ? `<div class="dos-rsay dos-panes font-serif-kr"><span class="dos-panes-k">손잡이</span>${btns.join('<i aria-hidden="true">·</i>')}</div>` : '';
    }

    function spaceEditHtml() {
        const ed = state.editingRoom, r = state.roomsCart.find(x => x.id === state.editingRoomId);
        if (!ed || !r) return '';
        if (!ed.sizeMode) ed.sizeMode = (r.sizeMode || 'full');
        const isPart = ed.sizeMode === 'part';
        const curW = isPart ? (ed.partWidth != null ? ed.partWidth : ed.width) : (ed.spaceWidth != null ? ed.spaceWidth : ed.width);
        const curH = isPart ? (ed.partHeight != null ? ed.partHeight : ed.height) : (ed.spaceHeight != null ? ed.spaceHeight : ed.height);
        const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const row = (k, part) => {
            const p = roomPart(ed, part);
            return `<div class="dos-wfrow"><span class="dos-wfk">${k}</span><i style="background:${p ? p.hex : HATCH}"></i><span class="dos-wfn">${p ? esc(p.name) : '아직 재지 않았습니다'}</span>${hexCode(p)}`
                + `<button type="button" class="ed-btn" onclick="window.concierge.editRoomColor('${part}')">${p ? '다시 재기' : '재기'}</button></div>`;
        };
        const house = houseColor();
        let h = '<div class="msr-stage msr-edit">';      // 공간 이름 · 수정하기는 왼쪽 위 뒤로 가기에 (73번)
        h += `<input type="text" class="ed-name font-serif-kr" value="${esc(ed.nameDraft != null ? ed.nameDraft : r.name)}" maxlength="12" enterkeyhint="done" autocomplete="off" aria-label="공간 이름" onfocus="window.concierge.editNameFocus()" oninput="window.concierge.editRoomName(this.value)" onkeydown="if(event.key==='Enter')this.blur()">`;      // 151번: 누르면 바로 고침, "저장"에서 들어감
        h += '<div class="msr-mode-switch" role="tablist" aria-label="크기 측정 모드">' +
            `<button type="button" class="msr-mode-btn font-serif-kr ${!isPart ? 'is-active' : ''}" onclick="window.concierge.setSizeMode('full')">전체</button>` +
            `<button type="button" class="msr-mode-btn font-serif-kr ${isPart ? 'is-active' : ''}" onclick="window.concierge.setSizeMode('part')">부분</button>` +
            '</div>';
        if (isPart && ((ed.spaceWidth || ed.width) > 0 || (ed.spaceHeight || ed.height) > 0)) {
            h += `<p class="msr-space-ref font-serif-kr">공간 전체 크기: <b>${ed.spaceWidth || ed.width || 0} × ${ed.spaceHeight || ed.height || 0}cm</b></p>`;
        }
        h += '<div class="msr-grid">' +
            msrBoxHtml('width', '가로', curW) +
            msrBoxHtml('height', '세로', curH) +
            '</div>'; // 41번, 43번
        h += paneBlockHtml(ed);      // 216번: 블라인드 여러 장 줄 (저장을 눌러야 공간에 들어감)
        h += `<div class="ed-color">${row('벽', 'wall')}${row('바닥', 'floor')}`;
        if (house) h += '<button type="button" class="ed-sub" onclick="window.concierge.editRoomUseHouse()">집 기본 색으로 맞추기</button>';
        // 가구 (66번): 벽·바닥과 따로 찍어 더하고 빼기 · 종류 바꾸기. 저장을 눌러야 공간에 들어감
        if (window.RoomColor && RoomColor.furEditorHtml) {
            h += `<div class="dos-wfrow ed-fur"><span class="dos-wfk">가구</span>${RoomColor.furEditorHtml(ed.measuredColor && ed.measuredColor.furniture, 'window.concierge.editFur(', typeof ed.furOpen === 'number' ? ed.furOpen : -1, 'ed-fur-edit')}</div>`;
        }
        h += '</div>' + dirPickerHtml();
        // 창 구성 선택 (48번): 상담을 마친 공간이면 이중 커튼 · 속지만 · 겉지만 · 블라인드로 즉시/스마트하게 변경
        if (r.isConfigured) {
            const curComp = roomComp(r) || 'double';
            const compHints = {
                double: '속지와 겉지가 함께 들어가는 구성입니다',
                sheer_only: '은은한 채광의 속지만 들어가는 구성입니다',
                drape_only: '빛 차단을 위한 겉지만 들어가는 구성입니다',
                blind_only: '창틀 안에 들어가는 블라인드 구성입니다'
            };
            h += '<div class="ed-comp"><span class="ed-comp-k">창 구성</span><div class="ed-comp-btns">';
            [
                ['double', '이중 커튼'],
                ['sheer_only', '속지 커튼'],
                ['drape_only', '겉지 커튼'],
                ['blind_only', '블라인드']
            ].forEach(([k, txt]) => {
                const on = (curComp === k);
                h += `<button type="button" class="ed-comp-btn font-serif-kr${on ? ' on' : ''}" onclick="window.concierge.switchComposition('${k}')">${txt}</button>`;
            });
            h += '</div></div>';      // 구성 설명 줄은 뺌 (73번, 사장님이 말로)
        }
        if (r.isConfigured) h += '<p class="q-sub ed-note">고른 원단은 그대로 두고, 바뀐 색이나 구성으로 다시 살펴봅니다.</p>';
        h += '<div class="ed-acts font-serif-kr"><button type="button" class="msr-add" onclick="window.concierge.saveRoomEdit()">저장</button>';
        h += `<button type="button" class="ed-sub" onclick="window.concierge.deleteRoom(${r.id})">이 공간 삭제</button></div>`;
        h += '</div>';
        return h;
    }

    // ---- 258번: 입체 방(room3d.js) — 공간 화면의 '입체 방' 단추로 엶. 돌려받은 것 가운데 품목에 쓰는 것은 손으로 바꾼 가로 · 세로(cm 차이)와 속지 리드밴드뿐, 나머지는 r.room3d에만 ----
    function room3dFabricOf(c) {      // 품목 하나 → 입체 방에 걸 원단 { 이름, 색, 비침, 블라인드 종류, 콤비 띠(m) }
        if (!c || !c.fabricId) return null;
        const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;      // 실물 견본(아직 안 고른 원단) — 이름만, 색은 '아직 모름' 빗금(211번), '잘 모르겠어요'는 종류를 묶지 않음
        if (sf) return { name: sf.name, hex: null, density: null, blindKind: c.fabricId === '_sample_any' ? null : (sf.blindKind || null), band: null };
        const f = getLiveDb().find(x => x.id === c.fabricId) || null;
        const st = (f && typeof blindStripeMm === 'function') ? blindStripeMm(f) : null;      // 콤비 띠 폭 "85/60mm" (59번)
        return { name: shortFabName(c.fabricId, c.colorName) || (f && f.name) || '', hex: colorFillOf(c.fabricId, c.colorName), density: (f && f.density) || null,
            blindKind: (f && typeof blindKind === 'function') ? blindKind(f) : null, band: st ? [st.solid / 1000, st.sheer / 1000] : null };
    }
    function room3dMeasure(r) {      // 폰에서 잰 공간 가운데 이름이 같은 것(1.5 '폰에서 잰 크기'와 같은 짝, 245번)
        const v = window.redamVisit && window.redamVisit.now();
        return ((v && Array.isArray(v.measures)) ? v.measures : []).find(m => m && m.이름 === r.name) || null;
    }
    function openRoom3D(roomId) {
        const r = state.roomsCart.find(x => x.id === roomId);
        if (!r || !window.RedamRoom3D || window.RedamRoom3D.isOpen()) return;
        window.RedamRoom3D.open({ room: r, items: r.isConfigured ? r.curtains : [], measure: room3dMeasure(r), fabricOf: room3dFabricOf, onClose: res => room3dDone(roomId, res) });
    }
    function room3dDone(roomId, res) {      // 입체 방을 닫으면 — 완료(done)면 품목에 넣고 금액을 다시 셈, 아니면 room3d만 남김
        const r = state.roomsCart.find(x => x.id === roomId);
        if (!r || !res) return;
        if (res.pack) r.room3d = res.pack;      // 창 · 커튼박스 · 가구 · 고른 모양(주름 · 겉지 밑단 · 블라인드 줄 · 다는 곳 · 등) — 금액과 무관, 저장 · 불러오기에 같이 다님
        let touched = false;
        if (res.done && res.layers) {
            // 크기 — 앱의 '수정하기' 저장(saveRoomEdit)과 같은 길: 공간 크기(r.width · height, 전체로 잰 공간이면 spaceWidth · Height도)를 바꾸고 공간의 모든 품목에 같은 크기
            const pick = ['drape', 'sheer', 'blind'].map(k => ({ k, L: res.layers[k], c: r.curtains.find(x => x.presetType === k) })).find(o => o.L && o.c && (o.L.dw || o.L.dh));
            const split = pick && pick.k === 'blind' && Pricing.paneSplit(pick.c.panes);      // 장마다 가로를 따로 넣었거나 여러 장인 블라인드 — 금액은 장 크기로 셈하고 앱의 크기 고치기도 장 크기를 바꾸지 않으니 넣지 않음
            if (pick && !split) {
                const W = Math.max(10, Math.round((Number(pick.c.width) || Number(r.width) || 0) + (pick.L.dw || 0)));
                const H = Math.max(10, Math.round((Number(pick.c.height) || Number(r.height) || 0) + (pick.L.dh || 0)));
                r.width = W; r.height = H;
                if (r.sizeMode !== 'part') { r.spaceWidth = W; r.spaceHeight = H; }
                r.curtains.forEach(c => { c.width = W; c.height = H; });
                touched = true;
            }
            const L = res.layers.sheer, cs = L && r.curtains.find(x => x.presetType === 'sheer');
            if (cs && typeof L.leadBand === 'boolean' && !!cs.leadBand !== L.leadBand) { cs.leadBand = L.leadBand; touched = true; }      // 139번과 같은 칸 — 겉지 품목에는 넣지 않음
            if (touched) {
                r.curtains.forEach(c => { c.calc = calculateV1ItemPrice(c); });
                r.subtotal = r.curtains.reduce((s, x) => s + ((x.calc && x.calc.curtainSubtotal) || 0), 0);
            }
            if (r.room3d && window.RedamRoom3D.resign) window.RedamRoom3D.resign(r.room3d, r, r.isConfigured ? r.curtains : []);      // 바뀐 크기를 '그대로'로 — 다음에 열면 이어서
        }
        syncToV1MasterRooms();
        if (typeof saveDraftTick === 'function') saveDraftTick();      // 입체 방에서 한 일은 길어서 — 3초 저장을 기다리지 않고 바로 남김
        const go = res.goFabric, idx = (go && go !== 'blind') ? r.curtains.findIndex(x => x.presetType === go) : -1;
        if (state.step === "1-Space") render();
        if (touched) spaceToast(`${r.name}: 입체 방에서 바꾼 것을 넣었습니다`);
        if (idx >= 0 && typeof openSpaceMore === 'function') openSpaceMore(r.id, idx);      // 원단 바꾸기 — 겉지 · 속지는 더 보기(원단 고르기), 블라인드는 공간 화면에 머문다
    }
    window.concierge.openRoom3D = openRoom3D;      // 258번: 공간 머리의 '입체 방' 단추
    Object.assign(cz, { shortFabName, swapCurtain, spaceToast, spaceHtml, spaceEditHtml, restoreCurtains, room3dFabricOf, room3dMeasure });      // 260번: room3d… 는 마무리 화면의 공간 그림 · 손님용 입체 방      // concierge.js가 부름 (165번: restoreCurtains)
    Object.assign(window.concierge, {
        swapCurtain: function(roomId, idx, fabricId, color, why) { swapCurtain(roomId, idx, fabricId, color, false, why); },
        dropCurtain: function(roomId, idx) { dropCurtain(roomId, idx); },      // 165번
        dropLine: function(roomId, lineNo) { dropLine(roomId, lineNo); },      // 167번
        selectLine: function(roomId, lineNo) { selectLine(roomId, lineNo); },      // 167번
        // 한 톤 밝게(step +1) / 진하게(−1): 3단계 사다리 [-1, 0, +1] (49번, 1안)
        toneSwap: function(roomId, idx, key, step) {
            if (!spaceEntries || !spaceEntries.length) {
                spaceEntries = (typeof finderEntries === 'function') ? finderEntries() : [];
            }
            const e = (spaceEntries || []).find(x => x.key === key);
            const r = state.roomsCart.find(x => x.id === roomId), c = r && r.curtains[idx];
            if (e && c) {
                const cur = Number(c.toneStep) || 0;
                const nextStep = Math.max(-1, Math.min(1, cur + (Number(step) || 0)));
                swapCurtain(roomId, idx, e.fabricId, e.color, false, { toneStep: nextStep, pickDir: c.pickDir || null });
            }
        },
    });
})();
