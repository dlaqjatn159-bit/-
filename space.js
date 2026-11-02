(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['space.js']='20261200';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// space.js — 고객 화면 중심 화면(1-Space): 왼쪽 기둥·공간 칸 그리기·한 톤 밝게/진하게·원단 바꾸기·알림·수정하기 화면 (130-4④에서 concierge.js에서 떼어 냄). concierge.js·fabric-pick.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore;      // concierge.js와 잇는 다리 (130-4)
    const { state, getLiveDb, calculateV1ItemPrice, syncToV1MasterRooms, askedRoom, flowPeek, fabricFillStyle, HATCH, hexCode, roomPart, roomSize, roomComp, kindOf, houseColor, furCount, furLabelOf, dirPickerHtml, msrBoxHtml, render, colorFillOf, splitNameColor } = cz;

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

        let h = `<div class="dos-stage"><div class="dos-sheet${isAllMode ? ' is-all-mode' : ' is-single-mode'}">`;
        h += '<div class="dos-left">';
        h += '<div class="dos-top font-serif-kr"><h1 data-staff-hold>Re<i class="logo-dot">.</i>dam</h1></div>'; // 42번: 빛과 공간 제거
        // 134번: 상담 중 조각보 — 재고 고를 때마다 채워지고, 다 찬 것이 그대로 최종 제안 표지
        if (list.length && typeof cz.jogakboMiniHtml === 'function') h += `<div class="dos-jogak">${cz.jogakboMiniHtml()}</div>`;
        // 133번(재검토 A3): 로고 아래 "○○ 고객님의 공간" 이름표는 뺌 — 레이아웃이 설명하게
        h += doneN ? '<h2 class="dos-lead font-serif-kr">공간마다 알맞은<br>원단을 찾았습니다</h2>' // 42번: 사족 설명 제거
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
                + `<span class="dos-rhead-r">${(window.RoomColor && RoomColor.openFurniture && furCount(r) < RoomColor.FUR_MAX) ? `<button type="button" class="dos-redit" onclick="window.concierge.addFurniture(${r.id})">+ 가구</button>` : ''}${r.isConfigured ? `<button type="button" class="dos-redit" onclick="window.concierge.editRoom(${r.id})">수정하기</button>` : ''}</span></div>`;
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
            if (!r.isConfigured) {
                h += '</section>';      // 133번(재검토 A3): "상담하고 나면 … 채워집니다" 설명 문장은 뺌
                return;
            }
            // 중심 화면에서는 이유 설명 문장("벽과 바닥의 중간 톤으로 골랐어요…")을 빼서 여백과 원단 스와치에 집중 (77번 사장님 확정 — 이유는 최종 제안 쇼룸 시트에만)
            h += `<div class="dos-items-wrap${r.curtains.length >= 2 ? ' is-pair' : ' is-one'}">`;
            r.curtains.forEach((c, i) => {
                const opts = [];
                if (c.shapeFee > 0) opts.push('형상기억');
                if (c.leadBand) opts.push('리드밴드');
                if (c.hotelFit) opts.push('호텔핏');
                const tones = c.presetType === 'blind' ? null : toneNeighbors(c);
                const toneBtn = (e, word, step) => `<button type="button"${e ? ` onclick="window.concierge.toneSwap(${r.id}, ${i}, '${e.key.replace(/'/g, "\\'")}', ${step})"` : ' disabled'}><i style="background:${e ? e.hex : '#eee8df'}"></i><span>${word}</span></button>`;
                const isBlindDupe = c.presetType === 'blind' && (c.calc?.fabName || c.label || '').includes('블라인드');
                const baseFabName = (typeof ticketBookName === 'function') ? ticketBookName(c) : ((c.calc && c.calc.fabName) || c.label || '원단');
                const colLbl = (c.fabricId && c.colorName && typeof colorLabelOf === 'function') ? colorLabelOf(c.fabricId, c.colorName) : '';
                const showColLbl = colLbl && !baseFabName.endsWith(colLbl);
                h += '<div class="dos-item">';
                h += '<div class="dos-item-main">';
                h += `<div class="dos-sw${fillCls(r, i)}" style="${fabricFillStyle(c.fabricId, c.colorName)}"></div>`;
                h += `<div class="dos-txt">${isBlindDupe ? '' : `<div class="dos-kind">${kindOf(c)}</div>`}`;
                h += `<div class="dos-fab font-serif-kr"><span class="dos-fname">${esc(baseFabName)}</span>${showColLbl ? `<span class="dos-fcolor">${esc(colLbl)}</span>` : ''}${opts.length ? `<em class="dos-fopts">· ${opts.join(' · ')}</em>` : ''}</div>`;
                h += '<div class="dos-item-sub">';
                if (c.presetType !== 'blind') {
                    h += `<button type="button" class="dos-more" onclick="openSpaceMore(${r.id}, ${i})">더 보기</button>`;
                } else {
                    h += '<span></span>';
                }
                if (tones) {
                    h += `<div class="dos-tone">${toneBtn(tones.lighter, '한 톤 밝게', 1)}${toneBtn(tones.darker, '한 톤 진하게', -1)}</div>`;
                }
                h += '</div>';
                h += '</div></div>';
                h += '</div>';
            });
            h += '</div></section>';
        });
        if (isAllMode) {
            h += '<section class="dos-room dos-add"><button type="button" class="dos-addbtn font-serif-kr" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button></section>';
        }
        h += '</div>';

        // 아래 버튼: 남은 공간이 있으면 "상담 시작 / 다음 공간 상담하기", 모두 끝났으면 "최종 제안 보기". 가로 대화면에서는 왼쪽 기둥 하단에 고정 (40-1)
        const next = list.find(r => !r.isConfigured);
        h += '<div class="dos-acts"><div class="dos-main font-serif-kr">';
        // 119번: 공간을 다 만든 뒤 "상담 시작" → 공간마다 질문 → 집 전체 구성 → 취향 → 원단(공간 하나 마치면 여기로, 다음 공간 원단 고르기)
        if (next) h += `<button type="button" class="dos-act is-main" onclick="window.concierge.flowNext()">${flowNow && flowNow.kind === 'fabric' ? `${esc(flowNow.room.name)} 원단 고르기` : (started ? '이어서 상담하기' : '질문 시작하기')} →</button>`;      // 133번(재검토 A5): 첫 화면 "상담 시작"과 이름이 겹쳐 다음에 나올 것(질문)을 말함
        if (doneN) h += `<button type="button" class="dos-act${next ? '' : ' is-main'}" onclick="window.concierge.goToCheckout()">최종 제안 보기${next ? '' : ' →'}</button>`;
        if (list.length) h += '<button type="button" class="dos-act dos-act-add" onclick="window.concierge.startNewRoomSelection()">+ 공간 추가</button>';      // 133번(재검토 A4): 빈 화면엔 오른쪽 하나만
        h += '</div></div>';
        h += '</div></div>';
        return h;
    }
    // 수정하기: 크기와 색을 고치는 화면 (상담 내용은 그대로). 고친 값은 "저장"을 눌러야 공간에 들어감
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
            return `<div class="dos-wfrow"><span class="dos-wfk">${k}</span><i style="background:${p ? p.hex : HATCH}"></i><span class="dos-wfn">${p ? esc(p.name) : '아직 안 쟀어요'}</span>${hexCode(p)}`
                + `<button type="button" class="ed-btn" onclick="window.concierge.editRoomColor('${part}')">${p ? '다시 재기' : '재기'}</button></div>`;
        };
        const house = houseColor();
        let h = '<div class="msr-stage msr-edit">';      // 공간 이름 · 수정하기는 왼쪽 위 뒤로 가기에 (73번)
        h += '<div class="msr-mode-switch" role="tablist" aria-label="크기 측정 모드">' +
            `<button type="button" class="msr-mode-btn font-serif-kr ${!isPart ? 'is-active' : ''}" onclick="window.concierge.setSizeMode('full')">전체</button>` +
            `<button type="button" class="msr-mode-btn font-serif-kr ${isPart ? 'is-active' : ''}" onclick="window.concierge.setSizeMode('part')">부분</button>` +
            '</div>';
        if (isPart && ((ed.spaceWidth || ed.width) > 0 || (ed.spaceHeight || ed.height) > 0)) {
            h += `<p class="msr-space-ref font-serif-kr">공간 전체 치수: <b>${ed.spaceWidth || ed.width || 0} × ${ed.spaceHeight || ed.height || 0}cm</b></p>`;
        }
        h += '<div class="msr-grid">' +
            msrBoxHtml('width', '가로', curW) +
            msrBoxHtml('height', '세로', curH) +
            '</div>'; // 41번, 43번
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

    Object.assign(cz, { shortFabName, swapCurtain, spaceToast, spaceHtml, spaceEditHtml });      // concierge.js가 부름
    Object.assign(window.concierge, {
        swapCurtain: function(roomId, idx, fabricId, color, why) { swapCurtain(roomId, idx, fabricId, color, false, why); },
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
