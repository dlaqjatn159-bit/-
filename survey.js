(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['survey.js']='20261219';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// survey.js — 직원 화면 상담란(설문, 115~116번): 우리 집 취향·공간별 생활 답·견적란 자동 채움·세 방향 바꾸기 (130-2에서 app.js에서 떼어 냄)

// ==============================================================
// 직원 화면: 상담란 (설문 형식, 115번)
// ==============================================================

// 우리 집 취향 (집에 한 번). 답하기 전에는 비어 있음(null) — 쌓이는 자료에서 "안 물음"과 "고름"을 가르기 위해 (115번 고침)
function emptyHouseTaste() { return { pres: null, tex: null, sheer: null }; }
var houseTaste = emptyHouseTaste();
//  pres: 'calm' (조용히 스며들게) | 'weight' (차분히 무게감 있게) | 'point' (포인트가 되게)
//  tex: 'smooth' (매끈한) | 'texture' (결이 살아 있는) | 'fluffy' (보송한)
//  sheer: 'smooth' (매끈하게) | 'texture' (결 있게) | 'thick' (도톰하게) | 'unknown' (잘 모르겠어요)
// 115번 첫 커밋(푸시 전)에서 쓰던 칸 이름·값을 고객 화면과 같은 칸으로 옮김 (임시 저장본이 남아 있을 때만)
function migrateSurveyRoom(r) {
    if (!r) return r;
    if (r.blockLight && !r.lightBlock) r.lightBlock = { allow: 'light', mid: 'soft', dark: 'dark' }[r.blockLight] || null;
    if (r.privacy === 'ok') r.privacy = 'open'; else if (r.privacy === 'mid') r.privacy = 'some';
    const lv = { strong: 'high', mid: 'mid', low: 'low' }[r.sunlight];
    if (lv) { r.lightLevel = lv; r.sunlight = 'south'; }
    delete r.blockLight; delete r.curtainConfig;
    ['wallMaterial', 'wallSheen', 'wallPatternStrength', 'floorMaterial', 'floorSheen', 'floorPatternStrength'].forEach(k => delete r[k]);
    return r;
}

function syncCustNameFromSurvey(val) {
    const v = (val || '').trim();
    const cust = document.getElementById('custName'); if (cust) cust.value = v;
    const exp = document.getElementById('expressCustName'); if (exp) exp.value = v;
    renderSideCust();
    saveDraftTick();
}
function syncCustPhoneFromSurvey(val) {
    const v = formatPhone(val || '');
    const phone = document.getElementById('surveyCustPhone'); if (phone) phone.value = v;
    const cust = document.getElementById('custPhone'); if (cust) cust.value = v;
    const exp = document.getElementById('expressCustPhone'); if (exp) exp.value = v;
    saveDraftTick();
}

const CHANGE_REASONS = ['색', '결', '빛', '가격', '손님 요청'];

function defaultSurveyDir(room) {
    if (room && room.linkDir) return room.linkDir;
    const mc = room && room.measuredColor;
    if (mc) {
        const hasW = !!(mc.wall && typeof mc.wall.L === 'number');
        const hasF = !!(mc.floor && typeof mc.floor.L === 'number');
        if (hasW && hasF) return 'bridge';
        if (hasW) return 'wall';
        if (hasF) return 'floor';
    }
    return 'bridge';
}

// 상담란 답(집 취향 + 공간별 답)을 점수 엔진용 공간 객체로 합침 (116번 — fake-guest 등에는 영향 없음)
function roomWithSurveyTaste(room, dirOverride) {
    if (!room) return room;
    const out = Object.assign({}, room);
    const mc = out.measuredColor;
    if (mc && mc.wall && mc.wall.tone && !out.wallTone) out.wallTone = mc.wall.tone;
    if (mc && mc.floor && mc.floor.tone && !out.floorTone) out.floorTone = mc.floor.tone;
    const pres = (room.ownTaste && room.ownPres) ? room.ownPres : houseTaste.pres;
    const tex = (room.ownTaste && room.ownTex) ? room.ownTex : houseTaste.tex;
    const sheer = houseTaste.sheer;
    const baseDir = defaultSurveyDir(room);
    if (dirOverride) {
        out.colorStrength = 'harmony';
        out.colorAccent = null;
        out.linkDir = dirOverride;
    } else if (pres === 'calm') {
        out.colorStrength = 'harmony';
        out.colorAccent = null;
        out.linkDir = baseDir;
    } else if (pres === 'weight') {
        out.colorStrength = 'point';
        out.colorAccent = 'value';
        out.linkDir = baseDir;
    } else if (pres === 'point') {
        out.colorStrength = 'point';
        out.colorAccent = room.pointTech || 'point';      // 120번: 고른 기법, 없으면 맡김(여러 기법 섞음)
        out.linkDir = baseDir;
    } else if (!out.linkDir && mc) {
        out.linkDir = baseDir;
    }
    if (tex) {
        out.drapeFeel = { smooth: 'smooth', texture: 'natural', fluffy: 'cozy' }[tex] || tex;
    }
    if (sheer && !room.sheerFeel) {      // 123번: 공간마다 고른 속지 결이 먼저
        out.sheerFeel = { smooth: 'smooth', texture: 'textured', thick: 'cozy', unknown: 'any' }[sheer] || sheer;
    }
    return out;
}

function curtainCategoryOf(c) {
    if (!c) return '겉지';
    if (c.presetType === 'blind') return '블라인드';
    if (c.presetType === 'sheer') return '속지';
    if (c.presetType === 'drape' || c.presetType === 'panel') return '겉지';
    const fab = FABRIC_DB.find(f => f.id === c.fabricId);
    if (fab && (fab.calcType === 'hebe' || fab.categoryType === '블라인드')) return '블라인드';
    if (fab && fab.categoryType === '속지') return '속지';
    return '겉지';
}

// 커튼 한 줄의 1등 원단 + 1등 색 계산 (dirOverride가 있으면 그 방향 기준, 116번)
function bestForCurtain(room, c, dirOverride) {
    if (!room || !c || typeof bestColorFor !== 'function') return null;
    const targetCategory = curtainCategoryOf(c);
    const r = roomWithSurveyTaste(room, dirOverride);
    let pool = [];
    if (window.concierge && typeof window.concierge.categoryPool === 'function') {
        pool = window.concierge.categoryPool(targetCategory);
    }
    if (!pool || !pool.length) {
        pool = FABRIC_DB.filter(f => !isCustomerHidden(f) && (f.categoryType === targetCategory || (targetCategory === '블라인드' && f.calcType === 'hebe')));
        if (!pool.length) pool = FABRIC_DB.filter(f => f.categoryType === targetCategory || (targetCategory === '블라인드' && f.calcType === 'hebe'));
    }
    if (!pool || !pool.length) return null;
    const fits = f => (typeof colorPlanFits === 'function') ? colorPlanFits(f, r, targetCategory) : true;
    const ranked = pool.map(f => ({ f, fit: fits(f), best: bestColorFor(f, r, targetCategory) }));
    ranked.sort((a, b) => ((b.fit ? 1 : 0) - (a.fit ? 1 : 0)) || (b.best.score - a.best.score)
        || ((isManualTagged(b.f) ? 1 : 0) - (isManualTagged(a.f) ? 1 : 0)));
    const top = ranked[0];
    if (!top || !top.f) return null;
    const colorName = top.best.color || (top.best.ranked[0] && top.best.ranked[0].name) || '';
    return {
        fabric: top.f,
        fabricId: top.f.id,
        colorName: colorName,
        dir: dirOverride || r.linkDir || defaultSurveyDir(room),
        score: top.best.score
    };
}

// 설문 답이나 방 색이 바뀔 때 커튼 줄에 1등 원단·색 자동 채움 (사장님이 바꾼 줄·손님이 고객 화면에서 고른 줄은 건드리지 않음, 116번)
function autoFillSurveyPicks(onlyRoomId) {
    const list = onlyRoomId ? rooms.filter(r => r.id === onlyRoomId) : rooms;
    list.forEach(room => {
        (room.curtains || []).forEach(c => {
            const best = bestForCurtain(room, c);
            if (!best) return;
            c.aiPick = { fabricId: best.fabricId, colorName: best.colorName || '', dir: best.dir };
            if (!c.staffPicked && !c.custPicked) {
                c.fabricId = best.fabricId;
                c.colorName = best.colorName || '';
                c.pickDir = best.dir;
                if (best.fabric && best.fabric.calcType === 'hebe') c.hotelFit = false;
                if (c.bookFilter && c.bookFilter !== 'ALL' && best.fabric && best.fabric.book !== c.bookFilter) c.bookFilter = 'ALL';
            }
        });
    });
}

function pickCurtainDir(roomId, curtainId, dir) {
    const room = rooms.find(r => r.id === roomId);
    const c = room && (room.curtains || []).find(x => x.id === curtainId);
    if (!room || !c) return;
    if (!c.aiPick) {
        const def = bestForCurtain(room, c);
        if (def) c.aiPick = { fabricId: def.fabricId, colorName: def.colorName || '', dir: def.dir };
    }
    const cand = bestForCurtain(room, c, dir);
    if (!cand) return;
    c.fabricId = cand.fabricId;
    c.colorName = cand.colorName || '';
    c.pickDir = dir;
    delete c.toneStep; delete c.baseFabricId; delete c.baseColorName;
    if (cand.fabric && cand.fabric.calcType === 'hebe') c.hotelFit = false;
    if (c.bookFilter && c.bookFilter !== 'ALL' && cand.fabric && cand.fabric.book !== c.bookFilter) c.bookFilter = 'ALL';
    const aiDir = (c.aiPick && c.aiPick.dir) || defaultSurveyDir(room);
    c.custPicked = false;      // 직원이 바꾸면 손님 표시는 내림 (116번)
    if (c.aiPick && c.fabricId === c.aiPick.fabricId && (c.colorName || '') === (c.aiPick.colorName || '') && dir === aiDir) {
        c.staffPicked = false;
        c.staffPick = null;
        c.changeReason = null;
    } else {
        c.staffPicked = true;
        c.staffPick = { fabricId: c.fabricId, colorName: c.colorName || '', dir };
    }
    renderRooms();
    calculateAll();
    saveDraftTick();
}

function setCurtainChangeReason(roomId, curtainId, reason) {
    const room = rooms.find(r => r.id === roomId);
    const c = room && (room.curtains || []).find(x => x.id === curtainId);
    if (!c) return;
    c.changeReason = c.changeReason === reason ? null : reason;
    renderRooms();
    saveDraftTick();
}

function resetCurtainToSurvey(roomId, curtainId) {
    const room = rooms.find(r => r.id === roomId);
    const c = room && (room.curtains || []).find(x => x.id === curtainId);
    if (!room || !c) return;
    c.staffPicked = false;
    c.custPicked = false;
    c.staffPick = null;
    c.changeReason = null;
    delete c.toneStep; delete c.baseFabricId; delete c.baseColorName;
    const best = bestForCurtain(room, c);
    if (best) {
        c.aiPick = { fabricId: best.fabricId, colorName: best.colorName || '', dir: best.dir };
        c.fabricId = best.fabricId;
        c.colorName = best.colorName || '';
        c.pickDir = best.dir;
    } else if (c.aiPick) {
        c.fabricId = c.aiPick.fabricId;
        c.colorName = c.aiPick.colorName || '';
        c.pickDir = c.aiPick.dir || defaultSurveyDir(room);
    }
    renderRooms();
    calculateAll();
    saveDraftTick();
}

function curtainFeatureMeta(curFab, c) {
    if (!curFab) return '';
    const cat = curtainCategoryOf(c);
    const parts = [];
    if (cat === '블라인드') {
        const k = typeof blindKind === 'function' ? blindKind(curFab) : null;
        const bl = typeof blindLight === 'function' ? blindLight(curFab) : null;
        if (k && BLIND_KIND_LABELS[k]) parts.push(BLIND_KIND_LABELS[k]);
        if (bl && BLIND_LIGHT_LABELS[bl]) parts.push(BLIND_LIGHT_LABELS[bl]);
    } else if (cat === '속지') {
        if (curFab.texture && TEXTURE_LABELS[curFab.texture]) parts.push(TEXTURE_LABELS[curFab.texture]);
        if (curFab.density && DENSITY_LABELS[curFab.density]) parts.push(DENSITY_LABELS[curFab.density]);
    } else {
        if (curFab.texture && TEXTURE_LABELS[curFab.texture]) parts.push(TEXTURE_LABELS[curFab.texture]);
        const bo = typeof blackoutLevel === 'function' ? blackoutLevel(curFab) : null;
        if (bo && BLACKOUT_LABELS[bo]) parts.push(BLACKOUT_LABELS[bo]);
    }
    const mat = typeof materialOf === 'function' ? materialOf(curFab) : null;
    if (mat && (mat === 'linen' || mat === 'linenlook') && MATERIAL_LABELS[mat] && !parts.includes(MATERIAL_LABELS[mat])) {
        parts.push(MATERIAL_LABELS[mat]);
    }
    return parts.join(' · ') || curFab.categoryType || '';
}

function curtainPickBarHtml(room, c, curFab) {
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    if (!c.aiPick) {
        const def = bestForCurtain(room, c);
        if (def) c.aiPick = { fabricId: def.fabricId, colorName: def.colorName || '', dir: def.dir };
    }
    const swHex = (typeof colorFillOf === 'function' && curFab) ? colorFillOf(curFab.id, c.colorName) : '#ddd3c2';
    const suf = (typeof colorSuffix === 'function' && curFab) ? colorSuffix(c.colorName, curFab.id) : (c.colorName ? ' ' + c.colorName : '');
    const dispName = curFab ? `${curFab.name}${suf}` : '원단 미선택';
    const meta = curtainFeatureMeta(curFab, c);
    const mc = room && room.measuredColor;
    const hasW = !!(mc && mc.wall && typeof mc.wall.L === 'number');
    const hasF = !!(mc && mc.floor && typeof mc.floor.L === 'number');
    const availDirs = [];
    if (hasW) availDirs.push(['wall', '벽 쪽']);
    if (hasW && hasF) availDirs.push(['bridge', '사이']);
    if (hasF) availDirs.push(['floor', '바닥 쪽']);
    const curDir = c.pickDir || (c.aiPick && c.aiPick.dir) || defaultSurveyDir(room);
    const dirsHtml = availDirs.length ? `<div class="q-dirs">${availDirs.map(([d, lbl]) => {
        const cand = bestForCurtain(room, c, d);
        const cHex = (cand && typeof colorFillOf === 'function') ? colorFillOf(cand.fabricId, cand.colorName) : '#e5dfd5';
        const cTitle = cand && cand.fabric ? `${cand.fabric.name}${colorSuffix(cand.colorName, cand.fabricId)}` : lbl;
        const isOn = curDir === d && (!cand || (cand.fabricId === c.fabricId && (cand.colorName || '') === (c.colorName || '')));
        return `<button type="button" class="q-dir${isOn ? ' on' : ''}" onclick="pickCurtainDir(${room.id}, ${c.id}, '${d}')" title="${esc(lbl + ': ' + cTitle)}"><i style="background:${cHex}"></i><span>${lbl}</span></button>`;
    }).join('')}</div>` : '';

    const whyHtml = c.staffPicked ? `<div class="q-why on">
        <span>바꾼 이유 (선택)</span>
        ${CHANGE_REASONS.map(r => `<button type="button" class="q-why-chip${c.changeReason === r ? ' on' : ''}" onclick="setCurtainChangeReason(${room.id}, ${c.id}, '${r}')">${r}</button>`).join('')}
        <button type="button" class="q-reset" onclick="resetCurtainToSurvey(${room.id}, ${c.id})">설문대로</button>
    </div>` : (c.custPicked ? `<div class="q-why on">
        <span>손님이 고른 원단</span>
        <button type="button" class="q-reset" onclick="resetCurtainToSurvey(${room.id}, ${c.id})">설문대로</button>
    </div>` : '');      // 손님이 고른 줄은 자동 채움에서 빠짐 → 설문대로 되돌리는 버튼만 (116번)

    return `<div class="q-pick-bar">
        <b class="q-pick-sw" style="background:${swHex}"></b>
        <div class="q-pick-info">
            <div class="q-pick-name">${esc(dispName)}</div>
            <div class="q-pick-meta">${esc(meta)}</div>
        </div>
        ${dirsHtml}
    </div>${whyHtml}`;
}

function setHouseTaste(key, val) {
    houseTaste[key] = val;
    autoFillSurveyPicks();
    renderRooms();
    if (typeof renderSurvey === 'function') renderSurvey();
    calculateAll();
    saveDraftTick();
}
window.getHouseTaste = function() { return houseTaste; };
window.setHouseTaste = setHouseTaste;

function toggleSurveyWindowDir(roomId, dirCode) {
    toggleRoomWindowDir(roomId, dirCode);
    renderSurvey();
}

function setRoomSurveyField(roomId, field, val) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    room[field] = val;
    autoFillSurveyPicks(roomId);
    renderRooms();
    calculateAll();
    saveDraftTick();
}

// 구성: 커튼 줄에서 바로 읽음 (115번 고침 — 따로 저장한 값과 실제 줄이 어긋나지 않게)
function curtainGroupOf(c) { return c.presetType === 'sheer' ? 'sheer' : (c.presetType === 'blind' ? 'blind' : 'drape'); }
function roomCurtainConfig(room) {
    const g = new Set((room.curtains || []).map(curtainGroupOf));
    if (g.has('blind') && g.size === 1) return 'blind';
    if (g.has('drape') && g.has('sheer')) return 'both';
    if (g.size === 1 && g.has('sheer')) return 'sheer';
    if (g.size === 1 && g.has('drape')) return 'drape';
    return g.size ? 'mixed' : null;
}
const CURTAIN_CONFIG_GROUPS = { both: ['drape', 'sheer'], drape: ['drape'], sheer: ['sheer'], blind: ['blind'] };

// 구성 버튼: 빠진 종류는 견적란 "품목 추가"와 같은 방법으로 더하고, 남는 줄은 사장님께 묻고 나서만 지움 (115번 고침)
function setRoomCurtainConfig(roomId, cfg) {
    const room = rooms.find(r => r.id === roomId);
    const want = CURTAIN_CONFIG_GROUPS[cfg];
    if (!room || !want) return;
    const extra = room.curtains.filter(c => !want.includes(curtainGroupOf(c)));
    if (extra.length && !confirm(`${extra.map(c => c.label).join(', ')} 줄을 지웁니다. 고른 원단도 함께 지워집니다. 계속할까요?`)) return;
    room.curtains = room.curtains.filter(c => want.includes(curtainGroupOf(c)));
    want.forEach(k => {
        if (room.curtains.some(c => curtainGroupOf(c) === k)) return;
        addCurtainToRoom(roomId, k);
        const added = room.curtains[room.curtains.length - 1];
        if (added && room.width && room.height) { added.width = room.width; added.height = room.height; delete added.sizeUnset; }      // 163번
    });
    room.curtainConfig = cfg;
    autoFillSurveyPicks(roomId);
    renderRooms();      // renderRooms가 상담란도 다시 그림
    calculateAll();
    saveDraftTick();
}

function toggleRoomOwnTaste(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    room.ownTaste = !room.ownTaste;
    if (room.ownTaste) {
        if (!room.ownPres) room.ownPres = houseTaste.pres;
        if (!room.ownTex) room.ownTex = houseTaste.tex;
    }
    autoFillSurveyPicks(roomId);
    renderRooms();
    calculateAll();
    saveDraftTick();
}

// 공간마다 포인트 (120번): "이 공간만 다르게" 칸(ownPres = 'point')을 그대로 씀 — 저장·고객 화면 왕복이 이미 됨
function roomPointOn(room) { return !!(room && room.ownTaste && room.ownPres === 'point'); }
function toggleRoomPoint(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (roomPointOn(room)) { room.ownPres = null; room.ownTaste = !!room.ownTex; }
    else { room.ownTaste = true; room.ownPres = 'point'; }
    autoFillSurveyPicks(roomId);
    renderRooms();
    calculateAll();
    saveDraftTick();
}

function addRoomFromSurvey() {
    addRoom();
    renderSurvey();
}

// 상담란 치수 팝업
var surveySizeEditingRoomId = null;
function openSurveySizeModal(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    surveySizeEditingRoomId = roomId;
    const w = room.width || (room.curtains[0] && room.curtains[0].width) || 300;
    const h = room.height || (room.curtains[0] && room.curtains[0].height) || 230;
    const title = document.getElementById('surveySizeModalTitle');
    if (title) title.textContent = `${room.name} 치수 입력`;
    const inW = document.getElementById('surveySizeWidth');
    const inH = document.getElementById('surveySizeHeight');
    if (inW) inW.value = w;
    if (inH) inH.value = h;
    [inW, inH].forEach(el => { if (el) sizeInputMark(el); });      // 163번: 범위 밖 값이면 열 때부터 빨간 테두리
    const modal = document.getElementById('surveySizeModal');
    if (modal) modal.classList.remove('hidden');
    if (inW) { inW.focus(); inW.select(); }
}
function closeSurveySizeModal() {
    surveySizeEditingRoomId = null;
    const modal = document.getElementById('surveySizeModal');
    if (modal) modal.classList.add('hidden');
}
function saveSurveySizeModal() {
    if (surveySizeEditingRoomId == null) return;
    const room = rooms.find(r => r.id === surveySizeEditingRoomId);
    if (!room) { closeSurveySizeModal(); return; }
    const inW = document.getElementById('surveySizeWidth');
    const inH = document.getElementById('surveySizeHeight');
    const w = Math.max(10, parseInt((inW || {}).value, 10) || 300);
    const h = Math.max(10, parseInt((inH || {}).value, 10) || 230);
    // 163번: 50~800cm 밖이면 한 번 묻기(3600·36 같은 잘못 넣기)
    if ((sizeOutOfRange(w) || sizeOutOfRange(h)) && !confirm(`${w} × ${h} cm — ${SIZE_MIN_CM}~${SIZE_MAX_CM}cm 밖입니다. 이대로 저장할까요?`)) return;
    // 공간 크기를 따라가던 줄(예전 크기와 같은 줄)만 새 크기로. 창이 여럿이라 크기가 다른 줄은 그대로 (115번 고침)
    const oldW = room.width || (room.curtains[0] && room.curtains[0].width);
    const oldH = room.height || (room.curtains[0] && room.curtains[0].height);
    let kept = 0;
    room.curtains.forEach(c => {
        if (c.width === oldW && c.height === oldH) { c.width = w; c.height = h; delete c.sizeUnset; }      // 163번: 잰 값
        else kept++;
    });
    room.width = w;
    room.height = h;
    closeSurveySizeModal();
    renderRooms();      // 상담란도 함께 다시 그림
    calculateAll();
    saveDraftTick();
    showToast(`[${room.name}] 크기를 ${w} × ${h} cm로 저장했습니다.` + (kept ? ` 크기가 다른 줄 ${kept}개는 그대로 두었습니다.` : ''));
}

function renderSurvey() {
    const houseBox = document.getElementById('surveyHouseBlock');
    const roomsGrid = document.getElementById('surveyRoomsGrid');
    if (!houseBox || !roomsGrid) return;

    // 고객명/연락처 입력창 동기화
    const sName = document.getElementById('surveyCustName');
    const cName = document.getElementById('custName');
    if (sName && cName && sName.value !== cName.value) sName.value = cName.value;
    const sPhone = document.getElementById('surveyCustPhone');
    const cPhone = document.getElementById('custPhone');
    if (sPhone && cPhone && sPhone.value !== cPhone.value) sPhone.value = cPhone.value;

    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    // 겉지 결 접사 사진: 기기에 넣은 사진만 씀 (원단 사진은 공개 저장소에 두지 않음 — 53번. 사진이 없으면 글자만)
    const texUrl = k => (typeof DevicePhotos !== 'undefined' && DevicePhotos.sceneUrl) ? (DevicePhotos.sceneUrl('tex', 'tex_' + k) || '') : '';
    const texImgs = { smooth: texUrl('smooth'), texture: texUrl('texture'), fluffy: texUrl('fluffy') };

    // 120번: 포인트는 공간마다(공간 카드의 "포인트" 줄). 집 줄의 "포인트가 되게"는 공간이 하나뿐일 때만(이미 골라 둔 집은 그대로 보임)
    const housePointBtn = rooms.length <= 1 || houseTaste.pres === 'point'
        ? `<button type="button" class="survey-opt ${houseTaste.pres === 'point' ? 'on' : ''}" onclick="setHouseTaste('pres', 'point')">포인트가 되게</button>` : '';

    // 1. 우리 집 취향 렌더링
    houseBox.innerHTML = `
        <h2>우리 집</h2>
        <div class="survey-row">
            <div class="k">커튼은</div>
            <div class="survey-opts">
                <button type="button" class="survey-opt ${houseTaste.pres === 'calm' ? 'on' : ''}" onclick="setHouseTaste('pres', 'calm')">조용히 스며들게</button>
                <button type="button" class="survey-opt ${houseTaste.pres === 'weight' ? 'on' : ''}" onclick="setHouseTaste('pres', 'weight')">차분히 무게감 있게</button>
                ${housePointBtn}
            </div>
        </div>
        <div class="survey-row">
            <div class="k">겉지 결</div>
            <div class="survey-opts">
                <button type="button" class="survey-opt tex ${houseTaste.tex === 'smooth' ? 'on' : ''}" onclick="setHouseTaste('tex', 'smooth')">
                    ${texImgs.smooth ? `<img src="${texImgs.smooth}" alt="">` : ''}<span>매끈한</span>
                </button>
                <button type="button" class="survey-opt tex ${houseTaste.tex === 'texture' ? 'on' : ''}" onclick="setHouseTaste('tex', 'texture')">
                    ${texImgs.texture ? `<img src="${texImgs.texture}" alt="">` : ''}<span>결 있는</span>
                </button>
                <button type="button" class="survey-opt tex ${houseTaste.tex === 'fluffy' ? 'on' : ''}" onclick="setHouseTaste('tex', 'fluffy')">
                    ${texImgs.fluffy ? `<img src="${texImgs.fluffy}" alt="">` : ''}<span>보송한</span>
                </button>
            </div>
        </div>
        <div class="survey-row">
            <div class="k">속지 결</div>
            <div class="survey-opts">
                <button type="button" class="survey-opt ${houseTaste.sheer === 'smooth' ? 'on' : ''}" onclick="setHouseTaste('sheer', 'smooth')">매끈하게</button>
                <button type="button" class="survey-opt ${houseTaste.sheer === 'texture' ? 'on' : ''}" onclick="setHouseTaste('sheer', 'texture')">결 있게</button>
                <button type="button" class="survey-opt ${houseTaste.sheer === 'thick' ? 'on' : ''}" onclick="setHouseTaste('sheer', 'thick')">도톰하게</button>
                <button type="button" class="survey-opt dim ${houseTaste.sheer === 'unknown' ? 'on' : ''}" onclick="setHouseTaste('sheer', 'unknown')">잘 모르겠어요</button>
            </div>
        </div>
    `;

    // 2. 공간별 카드 렌더링
    let roomsHtml = '';
    rooms.forEach((room, idx) => {
        const mc = room.measuredColor || {};
        const RC = window.RoomColor || {};
        const w = room.width || (room.curtains[0] && room.curtains[0].width) || 300;
        const h = room.height || (room.curtains[0] && room.curtains[0].height) || 230;

        const sizeUnsetRoom = !room.width && room.curtains.length > 0 && room.curtains.every(c => c.sizeUnset);      // 163번: 아직 안 잰 공간
        // 벽·바닥·가구 색 묶음 (벽 바닥 하나로 묶기)
        const hasWall = mc.wall && mc.wall.hex;
        const hasFloor = mc.floor && mc.floor.hex;
        let colorBundleHtml = '';

        if (hasWall || hasFloor) {
            const wName = hasWall ? ((RC.colorName && (RC.colorName('wall', mc.wall) || {}).name) || '벽지') : '';
            const matText = (part, c) => { const m = c && c.mat; const nm = m && m.k && RC.matLabel ? RC.matLabel(part, m.k) : ''; return nm ? ` · ${nm}${m.g === 1 ? ' · 광택' : ''}` : ''; };      // 재료·광택 (113번, 잰 색 안의 mat)
            const wMat = hasWall ? matText('wall', mc.wall) : '';
            const fName = hasFloor ? ((RC.colorName && (RC.colorName('floor', mc.floor) || {}).name) || '바닥') : '';
            const fMat = hasFloor ? matText('floor', mc.floor) : '';

            let furChips = '';
            if (Array.isArray(mc.furniture) && mc.furniture.length > 0) {
                furChips = mc.furniture.filter(f => f && f.hex).map((f, fIdx) => {
                    const fLabel = RC.furLabel ? RC.furLabel(f.n) : (f.n || '가구');
                    return `<span class="survey-chip" title="클릭하면 이 가구 색을 뺍니다" onclick="event.stopPropagation(); RoomColor.staffFur(${room.id}, 'del', ${fIdx})"><b style="background:${f.hex}"></b>가구: ${esc(fLabel)} ×</span>`;
                }).join('');
            }
            const canAddFur = !Array.isArray(mc.furniture) || mc.furniture.length < (RC.FUR_MAX || 3);
            const furAddBtn = canAddFur ? `<button type="button" class="survey-chip survey-fur-add" onclick="event.stopPropagation(); RoomColor.staffFur(${room.id}, 'add')" title="가구 색 추가">+ 가구</button>` : '';

            colorBundleHtml = `
                <div class="survey-colors-bundle" onclick="RoomColor.open(${room.id})" title="방 색 수정하기 (벽·바닥·가구)">
                    ${hasWall ? `<span class="survey-chip"><b style="background:${mc.wall.hex}"></b>벽: ${esc(wName)}${esc(wMat)}</span>` : ''}
                    ${hasFloor ? `<span class="survey-chip"><b style="background:${mc.floor.hex}"></b>바닥: ${esc(fName)}${esc(fMat)}</span>` : ''}
                    ${furChips}
                    ${furAddBtn}
                </div>
            `;
        } else {
            colorBundleHtml = `
                <button type="button" class="survey-empty-chip" onclick="RoomColor.open(${room.id})" title="벽과 바닥 색을 함께 잽니다">
                    <i class="fa-solid fa-camera text-xs"></i><span>방 색 재기 (벽·바닥)</span>
                </button>
            `;
        }

        // 고객 화면과 같은 칸·같은 값 (115번 고침): 햇살 = lightLevel(high·mid·low), 빛 가림 = lightBlock(light·soft·dark), 바깥 시선 = privacy(open·some·high)
        const sunlight = room.lightLevel || null;
        const dirs = windowDirOf(room.windowDir);
        const blockLight = room.lightBlock || null;
        const privacy = room.privacy || null;
        const curtainConfig = roomCurtainConfig(room);
        const ownTaste = !!room.ownTaste;
        const ownPres = room.ownPres || null;
        const ownTex = room.ownTex || null;

        // 자동 추천 원단 요약 줄 (116번: 설문·방 색에 따라 채워진 원단을 상담란에서도 바로 보고 찾기·견적란으로 이동)
        const recPills = (room.curtains || []).map(c => {
            const fab = Pricing.pickFabric(FABRIC_DB, c.fabricId);
            if (!fab) return '';
            const sw = (typeof colorFillOf === 'function') ? colorFillOf(fab.id, c.colorName) : '#ddd3c2';
            const suf = (typeof colorSuffix === 'function') ? colorSuffix(c.colorName, fab.id) : (c.colorName ? ' ' + c.colorName : '');
            return `<button type="button" class="survey-rec-pill" onclick="openFabricFinder(${room.id}, ${c.id})" title="클릭하면 이 조건에 맞는 추천 원단 목록이 열립니다"><i style="background:${sw}"></i><span>${esc(c.label)}: <b>${esc(fab.name + suf)}</b></span></button>`;
        }).filter(Boolean).join('');

        roomsHtml += `
            <div class="survey-room">
                <h2>
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <input type="text" value="${esc(room.name)}" onchange="updateRoomName(${room.id}, this.value)" placeholder="공간 이름">
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" class="size-btn${sizeUnsetRoom ? ' is-unset' : ''}" onclick="openSurveySizeModal(${room.id})" title="치수 수정">${sizeUnsetRoom ? '크기 넣기' : `${w} × ${h} cm`}</button>
                        <button type="button" class="survey-del-btn" onclick="removeRoom(${room.id})" title="공간 삭제">삭제</button>
                    </div>
                </h2>

                <div class="survey-row"><div class="k">벽·바닥</div>
                    <div class="survey-sw">${colorBundleHtml}</div>
                </div>

                <div class="survey-row"><div class="k">햇살</div>
                    <div class="survey-opts">
                        <button type="button" class="survey-opt ${sunlight === 'high' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'lightLevel', 'high')">강하게</button>
                        <button type="button" class="survey-opt ${sunlight === 'mid' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'lightLevel', 'mid')">보통</button>
                        <button type="button" class="survey-opt ${sunlight === 'low' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'lightLevel', 'low')">덜 들어요</button>
                    </div>
                </div>

                <div class="survey-row"><div class="k">창 방향</div>
                    <div class="survey-opts">
                        <button type="button" class="survey-opt ${dirs.includes('E') ? 'on' : ''}" onclick="toggleSurveyWindowDir(${room.id}, 'E')">동</button>
                        <button type="button" class="survey-opt ${dirs.includes('W') ? 'on' : ''}" onclick="toggleSurveyWindowDir(${room.id}, 'W')">서</button>
                        <button type="button" class="survey-opt ${dirs.includes('S') ? 'on' : ''}" onclick="toggleSurveyWindowDir(${room.id}, 'S')">남</button>
                        <button type="button" class="survey-opt ${dirs.includes('N') ? 'on' : ''}" onclick="toggleSurveyWindowDir(${room.id}, 'N')">북</button>
                    </div>
                </div>

                <div class="survey-gap"></div>

                <div class="survey-row"><div class="k">빛 가림</div>
                    <div class="survey-opts">
                        <button type="button" class="survey-opt ${blockLight === 'light' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'lightBlock', 'light')">들어와도 괜찮아요</button>
                        <button type="button" class="survey-opt ${blockLight === 'soft' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'lightBlock', 'soft')">적당히</button>
                        <button type="button" class="survey-opt ${blockLight === 'dark' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'lightBlock', 'dark')">완전히 어둡게</button>
                    </div>
                </div>

                <div class="survey-row"><div class="k">바깥 시선</div>
                    <div class="survey-opts">
                        <button type="button" class="survey-opt ${privacy === 'open' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'privacy', 'open')">괜찮아요</button>
                        <button type="button" class="survey-opt ${privacy === 'some' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'privacy', 'some')">조금</button>
                        <button type="button" class="survey-opt ${privacy === 'high' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'privacy', 'high')">많이</button>
                    </div>
                </div>

                <div class="survey-row"><div class="k">구성</div>
                    <div class="survey-opts">
                        <button type="button" class="survey-opt ${curtainConfig === 'both' ? 'on' : ''}" onclick="setRoomCurtainConfig(${room.id}, 'both')">겉지 + 속지</button>
                        <button type="button" class="survey-opt ${curtainConfig === 'drape' ? 'on' : ''}" onclick="setRoomCurtainConfig(${room.id}, 'drape')">겉지만</button>
                        <button type="button" class="survey-opt ${curtainConfig === 'sheer' ? 'on' : ''}" onclick="setRoomCurtainConfig(${room.id}, 'sheer')">속지만</button>
                        <button type="button" class="survey-opt ${curtainConfig === 'blind' ? 'on' : ''}" onclick="setRoomCurtainConfig(${room.id}, 'blind')">블라인드</button>
                    </div>
                </div>

                ${roomCurtainConfig(room) !== 'sheer' ? `<div class="survey-row"><div class="k">포인트</div>
                    <div class="survey-opts">
                        <button type="button" class="survey-opt ${roomPointOn(room) ? 'on' : ''}" onclick="toggleRoomPoint(${room.id})">이 공간에 주기</button>
                    </div>
                </div>` : ''}
                ${roomCurtainConfig(room) !== 'sheer' && (roomPointOn(room) || (!room.ownTaste && houseTaste.pres === 'point')) ? `<div class="survey-row"><div class="k">기법</div>
                    <div class="survey-opts">
                        ${(typeof pointTechOptions === 'function' ? pointTechOptions(room.measuredColor, roomCurtainConfig(room) === 'blind' ? '블라인드' : '겉지') : []).map(o => `<button type="button" class="survey-opt ${room.pointTech === o.key ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'pointTech', '${o.key}')">${o.term}</button>`).join('')}
                        <button type="button" class="survey-opt dim ${!room.pointTech ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'pointTech', null)">맡김</button>
                    </div>
                </div>` : ''}

                <button type="button" class="survey-quiet" onclick="toggleRoomOwnTaste(${room.id})">${ownTaste ? '집 취향 따르기' : '이 공간만 다르게'}</button>
                <div class="survey-own ${ownTaste ? 'on' : ''}">
                    <div class="survey-row"><div class="k">커튼은</div>
                        <div class="survey-opts">
                            <button type="button" class="survey-opt ${ownPres === 'calm' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'ownPres', 'calm')">조용히 스며들게</button>
                            <button type="button" class="survey-opt ${ownPres === 'weight' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'ownPres', 'weight')">차분히 무게감 있게</button>
                            <button type="button" class="survey-opt ${ownPres === 'point' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'ownPres', 'point')">포인트가 되게</button>
                        </div>
                    </div>
                    <div class="survey-row"><div class="k">겉지 결</div>
                        <div class="survey-opts">
                            <button type="button" class="survey-opt ${ownTex === 'smooth' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'ownTex', 'smooth')">매끈한</button>
                            <button type="button" class="survey-opt ${ownTex === 'texture' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'ownTex', 'texture')">결 있는</button>
                            <button type="button" class="survey-opt ${ownTex === 'fluffy' ? 'on' : ''}" onclick="setRoomSurveyField(${room.id}, 'ownTex', 'fluffy')">보송한</button>
                        </div>
                    </div>
                </div>

                <div class="survey-rec-bar">
                    <span class="survey-rec-k">추천 원단</span>
                    <div class="survey-rec-list">${recPills}</div>
                    <button type="button" class="survey-rec-go" onclick="showStaffView('consult')">견적란에서 바꾸기 →</button>
                </div>
            </div>
        `;
    });

    // 마지막 + 공간 추가 버튼 카드
    roomsHtml += `
        <button type="button" class="survey-addroom" onclick="addRoomFromSurvey()">
            <i class="fa-solid fa-plus text-xl text-amber-800"></i>
            <span>공간 추가</span>
        </button>
    `;

    roomsGrid.innerHTML = roomsHtml;
}
