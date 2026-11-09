(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['finder.js']='20261253';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// finder.js — 직원 화면 › 원단 › 찾기: 원단 색 카드·거름망·정렬·비슷한 색·후보 모아 보기·고객에게 보여주기·색 지도·넣을 칸 고르기 (130-2에서 app.js에서 떼어 냄)


// ---- 원단 찾기 (원단 › 찾기 탭): 원단의 색 하나가 카드 한 장 ----
// 상담 화면의 원단 칸 옆 "찾기"로 들어오면 그 칸이 "넣을 칸"이 되고, 카드의 "이 공간에 넣기"로 원단과 색상 번호가 한 번에 들어감
let finderTarget = null;      // { roomId, curtainId } — 화면에서만 쓰는 상태라 저장하지 않음
function finderTargetCurtain() {
    if (!finderTarget) return null;
    const room = rooms.find(r => r.id === finderTarget.roomId);
    const c = room && room.curtains.find(x => x.id === finderTarget.curtainId);
    return c ? { room, c } : null;
}
// 상담 화면의 커튼 칸이 어떤 칸인지: 블라인드(지금 원단이 블라인드) / 속지 / 겉지
function finderCurtainKind(c) {
    const fab = FABRIC_DB.find(f => f.id === c.fabricId);
    if (fab && (fab.calcType === 'hebe' || fab.categoryType === '블라인드')) return 'blind';
    return (c.presetType ? c.presetType === 'sheer' : !!(fab && fab.categoryType === '속지')) ? 'sheer' : 'drape';
}
function openFabricFinder(roomId, curtainId) {
    finderTarget = { roomId, curtainId };
    // 넣을 칸이 속지면 속지만, 겉지면 겉지만(블라인드 칸이면 블라인드만) 먼저 보여 줌 (종류 칩을 누르면 풀림)
    const t = finderTargetCurtain();
    if (t) finderSel.cat = new Set([finderCurtainKind(t.c)]);
    finderRef = null; if (finderSort === 'sim' || finderSort === 'pair') finderSort = 'light';       // 비슷한 색·속지 짝을 찾던 중이었으면 풀고 시작
    // 설문·잰 색이 있는 공간이면 "○○에 어울리는 순"으로 시작 (116번)
    if (t && (t.room.diagnosed || t.room.measuredColor || t.room.lightBlock || t.room.privacy || t.room.lightLevel || t.room.ownTaste || houseTaste.pres || houseTaste.tex || houseTaste.sheer)) {
        finderSort = `fit:${t.room.id}`;
    } else {
        const mode = t && ['bridge', 'wall', 'floor'].find(m => finderRoomModeOk(t.room, m));
        if (mode) finderSort = `room:${mode}:${t.room.id}`;
    }
    finderView = 'grid';
    showFabricTab('find');
    showStaffView('fabric');
}
function clearFinderTarget() { finderTarget = null; renderFinder(); }

// 거름망: 같은 묶음 안에서 여러 개를 고르면 "또는", 묶음끼리는 "그리고". 고른 상태는 상담 하나 동안만 기억(새 상담·상담 불러오기 때 지움)
//  - 빛 가림(겉지) · 비침(속지) · 빛 가림(블라인드)은 한 묶음으로 셈: "완전암막 + 많이 비침"을 고르면 둘 다 나옴
const FINDER_TONE_DOTS = { warm: '#d8c3a0', neutral: '#c4bfb7', cool: '#a9b4bd', deep: '#4a3f36' };
const FINDER_HUE_DOTS = { gray: '#b5b3b0', beige: '#c9b79a', yellow: '#d6c98e', red: '#c9a2a0', green: '#a9c2b4', blue: '#9fadc2' };
const FINDER_KEYS = ['mood', 'cat', 'tone', 'light', 'hue', 'sat', 'tex', 'bo', 'dens', 'blight', 'width', 'price', 'book'];
// 정렬. 이 밖에 상담에 고객 화면의 질문(바닥·벽·분위기 등)을 거친 공간이 있으면 공간마다 "○○에 어울리는 순"(fit:공간번호)이 생김
const FINDER_SORTS = { light: '밝은 순', dark: '진한 순', book: '책자 순', vivid: '채도 높은 순', muted: '채도 낮은 순', price: '가격 낮은 순', sim: '고른 색과 비슷한 순' };
const FINDER_SIM_MAX = 16;     // 비슷한 색은 가까운 순으로 16개까지
// "방 색 재기"(room-color.js)로 벽·바닥을 잰 공간마다 생기는 정렬 (값은 room:<방식>:<공간 id>)
//  - 이어주기: 벽~바닥을 잇는 선 가까이(BRIDGE_TUBE 안)의 색 중 "이어주는 색"(벽 쪽에 가까운 점)에 가까운 순
//  - 벽과 맞추기: 벽과 색 차이가 작은 순 / 바닥과 맞추기: 바닥보다 밝은 색 중 "바닥 + 밝기 14" 근처 순
const FINDER_ROOM_MODES = { bridge: '벽·바닥 이어주기', wall: '벽과 맞추기', floor: '바닥과 맞추기' };
// 계산(BRIDGE_TUBE · FLOOR_LIFT · bridgeDistances · roomLinkDistance)은 data.js — 고객 화면의 "색 잇기" 추천과 같이 씀
function finderRoomModeOk(room, mode) { return roomLinkOk(room && room.measuredColor, mode); }
// 잰 공간의 원단 찾기 열기 (방 색 재기 창의 "반영 후 이어주는 원단 찾기", 공간 카드의 "이어주는 원단 보기")
function openRoomColorFinder(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.curtains && room.curtains[0]) {
        finderTarget = { roomId: room.id, curtainId: room.curtains[0].id };
        finderSel.cat = new Set([finderCurtainKind(room.curtains[0])]);
    }
    finderRef = null;
    finderSort = `fit:${roomId}`;
    finderView = 'grid';
    showFabricTab('find');
    showStaffView('fabric');
}
let finderSel = {};
let finderSort = 'light';
let finderRef = null;          // "비슷한 색"의 기준 색 (카드 key)
let finderView = 'grid';       // 'grid'(색 카드) | 'map'(색 지도)
const FINDER_PICK_MAX = 6;     // 후보는 6개까지 (고객에게는 2~6개를 나란히 보여 줌)
// 조각보 번호(씨앗 숫자): 상담마다 하나, 최종 제안 조각보 모양을 고정 (79번)
let jogakboSeed = 0;
function newJogakboSeed() { return 1 + Math.floor(Math.random() * 2147483646); }
window.getJogakboSeed = function() { if (!jogakboSeed) jogakboSeed = newJogakboSeed(); return jogakboSeed; };
let finderPicks = [];          // 후보로 별표한 색 (카드 key). 상담에 같이 저장됨
let finderMapPoints = [];      // 색 지도에 찍힌 점 (누른 자리에서 가장 가까운 점을 찾는 데 씀)
function resetFinderFilters(silent) {
    FINDER_KEYS.forEach(k => { finderSel[k] = new Set(); });
    finderSort = 'light'; finderRef = null;
    const q = document.getElementById('finderQuery'); if (q) q.value = '';
    if (!silent) renderFinder();
}
resetFinderFilters(true);
// 묶음마다 고를 수 있는 것: [값, 이름, 색 점]. 빛 가림·비침·책자(와 종류의 블라인드)는 지금 원단에 있는 값만 보여 줌
function finderOptions(all) {
    const has = (key, v) => all.some(e => e[key] === v);
    return {
        mood: Object.keys(MOOD_LABELS).map(k => [k, MOOD_LABELS[k]]),
        cat: [['drape', '겉지'], ['sheer', '속지'], ['blind', '블라인드']].filter(o => o[0] !== 'blind' || has('cat', 'blind')),
        tone: ['warm', 'neutral', 'cool', 'deep'].map(k => [k, TONE_LABELS[k], FINDER_TONE_DOTS[k]]),
        light: Object.keys(LIGHT_BAND_LABELS).map(k => [k, LIGHT_BAND_LABELS[k]]),
        hue: Object.keys(HUE_LABELS).map(k => [k, HUE_LABELS[k], FINDER_HUE_DOTS[k]]),
        sat: Object.keys(CHROMA_LABELS).map(k => [k, CHROMA_LABELS[k]]),
        tex: Object.keys(TEXTURE_LABELS).map(k => [k, TEXTURE_LABELS[k]]),
        bo: BLACKOUT_ORDER.filter(k => has('blackout', k)).map(k => [k, BLACKOUT_LABELS[k]]),
        dens: DENSITY_ORDER.filter(k => has('density', k)).map(k => [k, DENSITY_LABELS[k]]),
        blight: Object.keys(BLIND_LIGHT_LABELS).filter(k => has('blindLight', k)).map(k => [k, BLIND_LIGHT_LABELS[k]]),
        width: Object.keys(WIDTH_LABELS).map(k => [k, WIDTH_LABELS[k]]),
        price: Object.keys(PRICE_TIER_LABELS).map(k => [k, PRICE_TIER_LABELS[k]]),
        book: [...new Set(all.map(e => e.book))].sort((x, y) => x.localeCompare(y, 'ko')).map(b => [b, b])
    };
}
function finderChipClick(event) {
    const btn = event.target.closest('button[data-v]');
    const box = btn && btn.closest('.finder-chips');
    if (!box) return;
    const set = finderSel[box.dataset.k];
    if (set.has(btn.dataset.v)) set.delete(btn.dataset.v); else set.add(btn.dataset.v);
    renderFinder();
}
// 글자 검색: 띄어 쓴 낱말이 모두 맞아야 함. 숫자만 있는 낱말은 색 번호("블랑 03", "블랑03", "블랑 3" 모두 블랑 3번)
function finderQueryWords() {
    const q = ((document.getElementById('finderQuery') || {}).value || '').toLowerCase();
    const words = [];
    q.split(/\s+/).filter(Boolean).forEach(w => { const m = /^(\D+)(\d+)$/.exec(w); if (m) words.push(m[1], m[2]); else words.push(w); });
    return words;
}
function finderMatch(e, words) {
    const s = finderSel;
    if (s.mood.size && !s.mood.has(e.mood)) return false;
    if (s.cat.size && !s.cat.has(e.cat)) return false;
    if (s.tone.size && !s.tone.has(e.tone)) return false;
    if (s.light.size && !s.light.has(e.band)) return false;
    if (s.hue.size && !s.hue.has(e.hue)) return false;
    if (s.sat.size && !s.sat.has(e.sat)) return false;
    if (s.tex.size && !s.tex.has(e.texture)) return false;
    if ((s.bo.size || s.dens.size || s.blight.size) && !s.bo.has(e.blackout) && !s.dens.has(e.density) && !s.blight.has(e.blindLight)) return false;
    if (s.width.size && !s.width.has(e.wide)) return false;
    if (s.price.size && !s.price.has(e.priceTier)) return false;
    if (s.book.size && !s.book.has(e.book)) return false;
    if (words.length) {
        const hay = `${e.label}${e.fabName}${e.book}${e.fabricId}${e.blindKind ? BLIND_KIND_LABELS[e.blindKind] : ''}`.toLowerCase().replace(/\s+/g, '');
        const isNo = /^\d+$/.test(e.color);
        if (!words.every(w => (/^\d+$/.test(w) && isNo) ? parseInt(w, 10) === parseInt(e.color, 10) : hay.includes(w))) return false;
    }
    return true;
}
// 후보 띠: 별표한 색을 누른 순서대로 (지금 원단 목록에 없는 색은 띠에서만 빠짐)
function renderFinderPicks(all) {
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const picks = finderPicks.map(k => all.find(e => e.key === k)).filter(Boolean);
    const pbox = document.getElementById('finderPicks');
    if (!pbox) return;
    pbox.hidden = !picks.length;
    pbox.innerHTML = !picks.length ? '' : `<b class="font-serif-kr">후보 ${picks.length}개</b><div class="finder-picks-list">`
        + picks.map(e => `<span class="finder-pick"><i${e.hex ? ` style="background:${e.hex}"` : ''}></i>${esc(finderPickName(e))}<button type="button" data-unstar="${esc(e.key)}" aria-label="후보에서 빼기">×</button></span>`).join('')
        + `</div><button type="button" class="staff-btn" onclick="clearFinderPicks()">모두 빼기</button><button type="button" onclick="openFinderShow()" class="bg-indigo-950 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs whitespace-nowrap">고객에게 보여주기</button>`;
}
// 카드 색 칸의 둘째 장(사진)과 아래 점
const FINDER_SW_DOTS = '<div class="finder-sw-dots"><button type="button" data-dot="0" aria-current="true" aria-label="색"><i></i></button><button type="button" data-dot="1" aria-current="false" aria-label="사진"><i></i></button></div>';
function finderPhotoPageHtml(url) {
    return `<div class="finder-sw-page"><img src="${String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="" loading="lazy"><span class="finder-sw-tag">사진</span></div>`;
}
// 사진 확인이 끝나면 카드의 사진 장만 고침 (다시 그리지 않으니 열어 둔 정보판·밀어 둔 사진·스크롤이 그대로)
function refreshFinderPhotos() {
    const cards = document.querySelectorAll('#finderOut .finder-card');
    if (!cards.length) return;
    const byKey = new Map(finderEntries().map(e => [e.key, e]));
    cards.forEach(card => {
        const e = byKey.get(card.dataset.key);
        if (!e) return;
        const url = photoFor(e.fabricId, e.color);
        const sw = card.querySelector('.finder-sw'), track = sw && sw.querySelector('.finder-sw-track');
        if (!track) return;
        const page = track.children[1], img = page && page.querySelector('img');
        if (url && !page) {
            track.insertAdjacentHTML('beforeend', finderPhotoPageHtml(url));
            track.insertAdjacentHTML('afterend', FINDER_SW_DOTS);
        } else if (url && img && img.getAttribute('src') !== url) img.src = url;
        else if (!url && page) {
            page.remove();
            const dots = sw.querySelector('.finder-sw-dots');
            if (dots) dots.remove();
            track.scrollLeft = 0;
        }
    });
}
// 원단 › 찾기가 화면에 보일 때, 이번 실행에서 아직 확인 안 했으면 뒤에서 조용히 사진 확인 (상태 글·알림 없이)
function ensureFinderPhotos() {
    if (__photoChecked || __photoScan || navigator.onLine === false) return;
    scanPhotos().then(r => { if (!r.offline) refreshFinderPhotos(); });
}
function renderFinder() {
    const out = document.getElementById('finderOut');
    if (!out) return;
    if (out.offsetParent) ensureFinderPhotos();
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const target = finderTargetCurtain();
    if (finderTarget && !target) finderTarget = null;        // 넣을 칸(공간·커튼)이 그사이 지워졌으면 풀어 줌
    const hint = document.getElementById('finderHint'), tbox = document.getElementById('finderTarget');
    if (hint) hint.hidden = !!target;
    if (tbox) {
        tbox.hidden = !target;
        tbox.innerHTML = target ? `<div><b>${esc(target.room.name)} · ${esc(target.c.label)}</b> 칸에 넣을 원단을 고르는 중<br><span>카드의 "이 공간에 넣기"를 누르면 원단과 색상 번호가 그 칸에 들어갑니다</span></div><button type="button" onclick="clearFinderTarget()">그만 고르기</button>` : '';
    }

    const all = finderEntries();
    renderFinderPicks(all);
    // 거름망 칩 (고른 것은 짙게)
    const opts = finderOptions(all);
    document.querySelectorAll('.finder-chips').forEach(box => {
        const k = box.dataset.k;
        finderSel[k].forEach(v => { if (!opts[k].some(o => o[0] === v)) finderSel[k].delete(v); });      // 원단이 바뀌어 없어진 값은 풀어 줌
        box.innerHTML = opts[k].map(o => `<button type="button" class="finder-chip" data-v="${esc(o[0])}" aria-pressed="${finderSel[k].has(o[0])}">${o[2] ? `<i style="background:${o[2]}"></i>` : ''}${esc(o[1])}</button>`).join('');
        box.closest('.finder-fgroup').hidden = !opts[k].length || (k === 'price' && staffFinderOnly);
    });
    // 비슷한 색(sim): 기준 색과 색 차이(ΔE)가 작은 순으로 16개. 거름망 가운데 종류(겉지·속지)만 지킴
    // 속지 짝(pair): 기준 겉지와 같은 톤이고 그보다 밝은 속지를 색 차이가 작은 순으로 (겉지가 딥이면 웜·뉴트럴 속지 모두). 색 값이 없는 속지는 톤만 맞춰 뒤에
    const refAny = finderRef ? all.find(e => e.key === finderRef) : null;
    const ref = (refAny && (finderSort === 'pair' ? refAny.cat === 'drape' : finderHasLab(refAny))) ? refAny : null;
    if (!ref) { finderRef = null; if (finderSort === 'sim' || finderSort === 'pair') finderSort = 'light'; }
    const sim = !!ref && finderSort === 'sim';
    const pair = !!ref && finderSort === 'pair';
    const pairTones = !pair ? null : (ref.tone === 'deep' ? ['warm', 'neutral'] : (ref.tone ? [ref.tone] : null));
    // "○○에 어울리는 순": 고객 화면 질문 또는 직원 상담란(설문·방 색)을 거친 공간 (116번). 넣을 칸의 공간이 먼저
    const fitRooms = rooms.filter(r => r.diagnosed || r.measuredColor || r.lightBlock || r.privacy || r.lightLevel || r.ownTaste || houseTaste.pres || houseTaste.tex || houseTaste.sheer).sort((x, y) => (target ? (y.id === target.room.id) - (x.id === target.room.id) : 0));
    const fitRoom = finderSort.startsWith('fit:') ? fitRooms.find(r => 'fit:' + r.id === finderSort) : null;
    if (finderSort.startsWith('fit:') && !fitRoom) finderSort = 'light';
    // 방 색을 잰 공간 (넣을 칸의 공간이 먼저)
    const measuredRooms = rooms.filter(r => ['bridge', 'wall', 'floor'].some(m => finderRoomModeOk(r, m))).sort((x, y) => (target ? (y.id === target.room.id) - (x.id === target.room.id) : 0));
    const rm = /^room:(bridge|wall|floor):(\d+)$/.exec(finderSort);
    const mRoom = rm ? measuredRooms.find(r => r.id === Number(rm[2]) && finderRoomModeOk(r, rm[1])) : null;
    const mMode = mRoom ? rm[1] : null, mc = mRoom ? mRoom.measuredColor : null;
    if (rm && !mRoom) finderSort = 'light';
    const byBook = (x, y) => `${x.book} ${x.fabName}`.localeCompare(`${y.book} ${y.fabName}`, 'ko') || colorSort({ name: x.color }, { name: y.color });
    // 값이 없는 색은 늘 뒤로 (그 안에서는 책자 · 원단 · 번호 순)
    const by = (key, dir) => (x, y) => (x[key] == null || y[key] == null) ? ((x[key] == null) - (y[key] == null)) || byBook(x, y) : (dir * (x[key] - y[key])) || byBook(x, y);
    let list;
    if (sim) {
        list = all.filter(e => e.key !== ref.key && finderHasLab(e) && (!finderSel.cat.size || finderSel.cat.has(e.cat)));
        list.forEach(e => { e.dist = colorDistance(e, ref); });
        list.sort((x, y) => x.dist - y.dist);
        list = list.slice(0, FINDER_SIM_MAX);
    } else if (pair) {
        const refLab = finderHasLab(ref);
        list = all.filter(e => e.cat === 'sheer' && (!pairTones || pairTones.includes(e.tone)) && !(ref.L != null && e.L != null && e.L <= ref.L));
        list.forEach(e => { e.dist = (refLab && finderHasLab(e)) ? colorDistance(e, ref) : null; });
        list.sort(by('dist', 1));
    } else {
        const words = finderQueryWords();
        list = all.filter(e => finderMatch(e, words));
        if (mMode) {
            // 색 값(밝기·붉은기·노란기)이 있는 색만. 거름망(종류·빛 가림 등)은 그대로 적용
            list = list.filter(finderHasLab);
            // 세 방식 모두 data.js roomLinkDistance (맞지 않는 색은 null → 뺌). e.rd = 화면에 쓰는 "벽과 / 이어주는 색과 ○○" 거리
            list.forEach(e => {
                e.rscore = roomLinkDistance(e, mc, mMode);
                e.rd = mMode === 'bridge' ? colorDistance(e, mc.bridge) : (mMode === 'wall' ? e.rscore : null);
            });
            list = list.filter(e => e.rscore != null);
            list.sort((x, y) => x.rscore - y.rscore);
        } else if (fitRoom) {
            // 설문 + 잰 색(이어주기·포인트) + 빛 보정을 모두 합친 추천 점수 순 (116번)
            const rSurvey = roomWithSurveyTaste(fitRoom);
            list.forEach(e => {
                const cat = e.fabric.categoryType;
                const cObj = { name: e.color, light: e.L, a: e.a, b: e.b };
                const planOk = (typeof colorPlanAllows === 'function') ? colorPlanAllows(e.fabric, cObj, rSurvey, cat) : true;
                const link = (rSurvey.linkDir ? roomLinkBonus(cObj, rSurvey) : roomSoftBonus(cObj, rSurvey));
                const lfix = (typeof lightFixBonus === 'function') ? lightFixBonus(cObj, rSurvey) : 0;
                e.fit = (planOk ? 100 : 0) + calculateFabricMatchScore(e.view, rSurvey, cat) + link + lfix;
            });
            list.sort((x, y) => (y.fit - x.fit) || by('L', -1)(x, y));
        } else if (finderSort === 'price') list.sort((x, y) => (x.priceRank - y.priceRank) || (x.price - y.price) || byBook(x, y));      // 단위가 다른 원단은 저마다의 묶음 안 자리로 견줌
        else list.sort(finderSort === 'dark' ? by('L', 1) : (finderSort === 'vivid' ? by('C', -1) : (finderSort === 'muted' ? by('C', 1) : (finderSort === 'book' ? byBook : by('L', -1)))));
    }
    const showPrice = finderSort === 'price' || finderSel.price.size > 0;       // 가격대 꼬리표는 가격으로 거르거나 줄 세울 때만 보임
    const sortSel = document.getElementById('finderSort');
    if (sortSel) {
        const sorts = Object.keys(FINDER_SORTS).filter(k => k !== 'sim' && !(k === 'price' && staffFinderOnly)).map(k => [k, FINDER_SORTS[k]]).concat(fitRooms.map(r => ['fit:' + r.id, `${r.name}에 어울리는 순`]),
            ...measuredRooms.map(r => ['bridge', 'wall', 'floor'].filter(m => finderRoomModeOk(r, m)).map(m => [`room:${m}:${r.id}`, `${r.name} ${FINDER_ROOM_MODES[m]}`])), [['sim', FINDER_SORTS.sim]], pair ? [['pair', '겉지에 어울리는 속지']] : []);
        sortSel.innerHTML = sorts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
        sortSel.value = finderSort;
    }
    const pairRule = pairTones ? `${pairTones.map(t => TONE_LABELS[t]).join('·')} 톤 · 겉지보다 밝은 색` : '겉지보다 밝은 색';
    const cnt = document.getElementById('finderCount');
    if (cnt) cnt.innerHTML = sim ? `<b class="font-serif-kr">비슷한 색 ${list.length}개</b><small>거름망은 종류(겉지·속지)만 적용</small>`
        : (pair ? `<b class="font-serif-kr">어울리는 속지 ${list.length}개</b><small>${pairRule} · 거름망은 적용 안 함</small>`
            : (mMode ? `<b class="font-serif-kr">${list.length}색</b><small>${esc(mRoom.name)} ${FINDER_ROOM_MODES[mMode]} · ${{ bridge: '벽과 바닥을 잇는 색 가운데 벽 쪽에 가까운 순', wall: '잰 벽 색과 가까운 순', floor: '바닥 색기를 따르고 바닥보다 밝은 순' }[mMode]} · 색 값이 있는 색만</small>`
            : `<b class="font-serif-kr">${finderColorTotal(list)}색</b><small>${finderFabricTotal(list)}개 원단 · 전체 ${finderColorTotal(all)}색${finderNoColorNote(list)}</small>`));      // 색 수는 등록된 색만 (58번)
    const rbox = document.getElementById('finderRef');
    if (rbox) {
        rbox.hidden = !ref;
        const refName = ref ? esc(`${ref.fabName} ${ref.no} ${ref.label}`.replace(/\s+/g, ' ').trim()) : '';
        rbox.innerHTML = !ref ? '' : `<i style="background:${ref.hex || 'transparent'}"></i><div>` + (pair
            ? `<b>${refName}</b> 에 어울리는 속지를 찾는 중<br><span>겉지와 같은 톤이고 더 밝은 속지 (색이 가까운 것부터, 색 값이 없는 속지는 톤만 맞춰 뒤에)</span>`
            : `<b>${refName}</b> 와 비슷한 색을 찾는 중<br><span>다른 책자에서 대신할 색을 찾을 때</span>`) + `</div><button type="button" onclick="clearFinderRef()">그만 찾기</button>`;
    }
    document.querySelectorAll('#finderViewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === finderView)));
    if (!all.length) { out.innerHTML = '<div class="finder-empty">보여 줄 원단이 없어요.<br>설정에서 단가표나 비공개 팩을 먼저 불러와 주세요.</div>'; return; }
    if (finderView === 'map') { out.innerHTML = finderMapHtml(all, new Set(list.map(e => e.key)), ref, mc); return; }
    if (!list.length) {
        out.innerHTML = '<div class="finder-empty">' + (mMode ? '잰 색에 맞는 원단을 찾지 못했어요.<br>거름망을 풀거나 다른 찾기 방법을 골라 보세요.' : sim ? '비슷한 색을 찾지 못했어요.<br>종류(겉지·속지) 조건을 풀어 보세요.'
            : (pair ? '어울리는 속지를 찾지 못했어요.<br>분류 탭에서 속지의 톤이 정해져 있는지 확인해 보세요.' : '조건에 맞는 색이 없어요.<br>조건을 하나씩 빼 보세요.')) + '</div>';
        return;
    }

    // 예전 입력표로만 색을 넣은 기기: 색 값이 하나도 없으면 어떻게 채우는지 알려 줌
    const note = all.some(e => e.hex) ? '' : '<p class="finder-hint">아직 색 값이 들어 있지 않아요. 색상 탭의 "색상 입력표 불러오기"로 새 입력표(밝기·색상코드·붉은기·노란기 열)를 올리면 카드에 색이 보입니다.</p>';
    const chip = (text, unset) => `<span class="staff-chip${unset ? ' is-unset' : ''}">${text}</span>`;
    const anySlot = rooms.some(r => r.curtains.length);
    out.innerHTML = note + '<div class="finder-grid">' + list.map(e => {
        const tags = [
            e.tone ? chip(TONE_LABELS[e.tone]) : chip('톤 미정', true),
            e.mood ? chip(MOOD_LABELS[e.mood]) : chip('느낌 미정', true),
            e.cat === 'blind' ? (e.blindKind ? chip(BLIND_KIND_LABELS[e.blindKind]) : '') + chip(BLIND_LIGHT_LABELS[e.blindLight])
                : (e.cat === 'sheer' ? (e.density ? chip(DENSITY_LABELS[e.density]) : chip('비침 미정', true)) : (e.blackout ? chip(BLACKOUT_LABELS[e.blackout]) : chip('빛 가림 미정', true))),
            e.sat ? chip('채도 ' + CHROMA_LABELS[e.sat]) : chip('채도 미정', true),
            e.texture ? chip(TEXTURE_LABELS[e.texture]) : chip('질감 미정', true),
            e.specCm ? chip((e.wide === 'wide' ? '대폭 ' : '') + e.specCm + 'cm') : '',
            showPrice ? chip('가격 ' + PRICE_TIER_LABELS[e.priceTier]) : ''
        ].join('');
        const title = e.color ? (e.label || `${e.no}번`) : e.fabName;
        const light = (e.L != null ? `밝기 ${Math.round(e.L)}` : '밝기 미정') + (sim ? ` · ${colorDistanceWord(e.dist)}` : '') + (pair && e.dist == null ? ' · 톤만 맞춤' : '') + (fitRoom ? ` · 어울림 ${e.fit}` : '')
            + (mMode === 'floor' ? ` · 바닥보다 ${Math.round(e.L - mc.floor.L)} 밝음` : (mMode ? ` · ${mMode === 'wall' ? '벽과' : '이어주는 색과'} ${colorDistanceWord(e.rd)}` : ''));
        const meta = e.color ? `${e.book} ${e.fabName} ${e.no} · ${light}` : `${e.book} · ${light}`;
        // 정보판 안: 찾기 버튼 줄(비슷한 색 · 겉지는 어울리는 속지). 넣기 버튼은 상담에 커튼·블라인드 칸이 하나라도 있으면 카드 맨 아래에 늘 보임
        //  (넣을 칸이 정해져 있으면 바로 넣고, 없으면 누를 때 "어느 칸에 넣을까요?" 판이 뜸)
        const finds = (finderHasLab(e) ? `<button type="button" data-sim="${esc(e.key)}">비슷한 색</button>` : '') + (e.cat === 'drape' ? `<button type="button" data-pair="${esc(e.key)}">어울리는 속지</button>` : '');
        const acts = finds ? `<div class="finder-acts">${finds}</div>` : '';
        const put = (target || anySlot) ? `<div class="finder-acts is-put"><button type="button" data-pick="${esc(e.key)}">이 공간에 넣기</button></div>` : '';
        const photo = photoFor(e.fabricId, e.color);      // 저장된 사진 목록 (찾기가 처음 열릴 때 뒤에서 다시 확인)
        const isCur = !!target && target.c.fabricId === e.fabricId && (target.c.colorName || '') === e.color;
        const starred = finderPicks.includes(e.key);
        // 색 칸: 첫 장은 늘 잰 색, 사진이 있으면 옆으로 밀어 둘째 장(사진). 사진이 없으면 한 장만(점 없음)
        const colorPage = `<div class="finder-sw-page${e.hex ? '' : ' is-none'}"${e.hex ? ` style="background:${e.hex}"` : ''}>${e.hex ? '' : '<span>색 값 없음</span>'}</div>`;
        const photoPage = photo ? finderPhotoPageHtml(photo) : '';
        const dots = photo ? FINDER_SW_DOTS : '';
        return `<article class="finder-card${isCur ? ' is-current' : ''}" data-key="${esc(e.key)}">
            <div class="finder-sw">
                <div class="finder-sw-track">${colorPage}${photoPage}</div>${dots}
                ${isCur ? '<span class="finder-cur">지금 이 칸</span>' : ''}
                <button type="button" class="finder-star${starred ? ' is-on' : ''}" data-star="${esc(e.key)}" aria-pressed="${starred}" aria-label="후보로 별표">${starred ? '★' : '☆'}</button>
            </div>
            <div class="finder-info" aria-hidden="true">
                <div class="finder-tags">${tags}</div>
                ${acts}
            </div>
            <button type="button" class="finder-head" data-head aria-expanded="false">
                <span class="finder-head-txt"><span class="finder-name">${esc(title)}</span><span class="finder-meta">${esc(meta)}</span></span>
                <span class="finder-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></span>
            </button>
            ${put}
        </article>`;
    }).join('') + '</div>';
}
// 색 사전(직원 화면 › 색 사전, 색 이름 표 PRO_COLOR_NAMES·proColorName)은 color-dict.js로 옮김 (130-2)
// 카드 정보판: 이름 줄을 누르면 그 카드 안에서 색 칸 자리만 덮음 (카드 크기 그대로라 스크롤이 밀리지 않음)
//  - 한 번에 하나만 열림. 다시 그리지 않고 class만 바꿈(밀어 둔 사진·스크롤 그대로). 다시 그리면(거름망·정렬 등) 모두 닫힘
function finderOpenCard(card) {
    const open = card && !card.classList.contains('is-open') ? card : null;
    document.querySelectorAll('#finderOut .finder-card.is-open').forEach(c => { if (c !== open) setFinderCardOpen(c, false); });
    if (card) setFinderCardOpen(card, !!open);
}
function setFinderCardOpen(card, on) {
    card.classList.toggle('is-open', on);
    card.querySelector('.finder-head').setAttribute('aria-expanded', String(on));
    card.querySelector('.finder-info').setAttribute('aria-hidden', String(!on));
}
// 색 칸을 옆으로 밀면 아래 점(지금 장)을 맞춤. scroll은 위로 전해지지 않아 capture로 받음
function finderSwScroll(ev) {
    const t = ev.target;
    if (!t.classList || !t.classList.contains('finder-sw-track')) return;
    const i = Math.round(t.scrollLeft / (t.clientWidth || 1));
    t.parentElement.querySelectorAll('[data-dot]').forEach(d => d.setAttribute('aria-current', String(Number(d.dataset.dot) === i)));
}
document.addEventListener('scroll', finderSwScroll, { capture: true, passive: true });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { closeFinderSlots(); finderOpenCard(null); } });
// 정렬 바꾸기: "고른 색과 비슷한 순"은 카드의 "비슷한 색"을 누른 뒤에만. 다른 정렬을 고르면 비슷한 색 찾기는 끝남
function finderSortChange(value) {
    if (value === 'sim' && (!finderRef || finderSort === 'pair')) showToast('카드의 "비슷한 색"을 먼저 눌러 주세요.', 'info');
    else if (value !== 'pair') { finderSort = ((FINDER_SORTS[value] && !(value === 'price' && staffFinderOnly)) || String(value).startsWith('fit:') || String(value).startsWith('room:')) ? value : 'light'; if (finderSort !== 'sim') finderRef = null; }
    renderFinder();
}
function clearFinderRef() { finderRef = null; finderSort = 'light'; renderFinder(); }

// ---- 후보 모아 보기: 카드의 별표(☆)로 후보를 모으고, "고객에게 보여주기"로 가격·원가 없이 나란히 보여 줌 ----
// 원단 이름에서 괄호(암막률 등)는 떼고 보여 줌
function finderPlainFabName(e) { return String(e.fabName || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); }
function finderPickName(e) { return e.color ? `${e.label ? e.label + ' · ' : ''}${finderPlainFabName(e)} ${e.no}` : finderPlainFabName(e); }
function clearFinderPicks() { finderPicks = []; renderFinder(); }
// 고객에게 보여주기: 직원 화면을 통째로 덮는 화면에 큰 색 칸(사진이 있으면 사진)을 고객 원단 화면과 같은 띠로 나란히 (2~6개)
//  - 띠 글자: 세로 큰 글자 = 원단 이름(책자·괄호·끝의 색 낱말 뺌), 오른쪽 세로 작은 글자 = 색 이름(없으면 "3번"). 가격·느낌 없음
//  - 고르기: 한 번 누르면 강조(흰 밑줄, 나머지 흐리게) → 강조된 칸을 한 번 더 누르면 "○○로 할까요?" 확인 창 → "이걸로 할게요"면 넣을 칸에 넣음(화면은 그대로)
//  - 보여 주는 동안 직원 화면은 잠근 것으로 침(자동 잠금 창이 끼어들지 않게) → 닫으면 PIN 없이 찾기 화면까지만 열림 (setFinderOnly)
let finderShowList = [], finderShowSel = -1, finderShowChanged = false, finderShowDoneTimer = 0;
// 조사: 받침이 있으면 앞 것(을·으로), 없으면 뒤 것(를·로). "으로"는 ㄹ 받침이면 "로". 숫자는 읽는 소리로
function finderJosa(word, withB, withoutB) {
    const s = String(word || '').trim(), last = s.slice(-1), c = last.charCodeAt(0);
    let jong = 0;
    if (c >= 0xAC00 && c <= 0xD7A3) jong = (c - 0xAC00) % 28;
    else if (/[0-9]/.test(last)) jong = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][Number(last)];
    if (!jong) return s + withoutB;
    if (withB === '으로' && jong === 8) return s + '로';
    return s + withB;
}
// 보여 줄 이름: { name: 원단 이름, color: 색 이름(없으면 "3번"), full: "오솔로 화이트" }
function finderShowName(e) {
    const p = (window.concierge && window.concierge.cardNameParts && window.concierge.cardNameParts(e.fabricId, e.label)) || { name: finderPlainFabName(e), colorTag: e.label };
    const no = String(e.no || e.color || '');
    const color = p.colorTag || (e.color ? (/^\d+$/.test(no) ? `${no}번` : no) : '');
    return { name: p.name, color, full: [p.name, color].filter(Boolean).join(' ') };
}
//  - custom(고객 화면 중심 화면 › 더 보기의 "나란히 보기"): { list, curKey, onPick(e) } — 지금 원단 + 후보. 고르면 onPick, 넣을 칸·담음 표시는 안 씀
let finderShowMode = null;
function openFinderShow(custom) {
    const all = custom ? null : finderEntries();
    const picks = custom ? custom.list : finderPicks.map(k => all.find(e => e.key === k)).filter(Boolean).slice(0, FINDER_PICK_MAX);
    const box = document.getElementById('finderShow'), canvas = document.getElementById('finderShowCanvas');
    if (!box || !canvas || !window.concierge) return;
    if (picks.length < 2) { if (!custom) showToast('후보를 2개 이상 별표해 주세요. (6개까지)', 'info'); return; }
    finderShowMode = custom || null;
    const head = box.querySelector('.step-head');
    if (head) head.innerHTML = custom ? '<p class="step-q font-serif-kr">어느 쪽이 더 마음에 드세요?</p><p class="step-sub">한 번 누르면 표시되고, 한 번 더 누르면 정해요</p>' : '<p class="step-q font-serif-kr">마음에 드는 색을 골라 보세요</p>';
    finderShowList = picks; finderShowSel = -1; finderShowChanged = false;
    canvas.style.setProperty('--items-count', picks.length);
    canvas.innerHTML = picks.map((e, i) => {
        const n = finderShowName(e), clean = s => String(s).replace(/[<>&"]/g, '');
        // 색 값도 사진도 없는 원단은 지어낸 색을 보여 주지 않고 "샘플북으로" (가로 글)
        const look = e.hex || photoFor(e.fabricId, e.color);
        return window.concierge.bookmarkCard(clean(n.name), clean(look ? n.color : '샘플북으로 보여 드릴게요'), '', e.hex || 'var(--brand-panel)', function() { finderShowTap(i); }, look ? 'vdesc' : '');
    }).join('');
    Array.from(canvas.children).forEach((card, i) => {
        const e = picks[i], img = document.createElement('img');
        card.insertAdjacentHTML('beforeend', '<span class="finder-show-put" aria-hidden="true">✓ 담음</span>');
        if (custom && e.key === custom.curKey) card.insertAdjacentHTML('beforeend', '<span class="finder-show-now">지금</span>');
        img.className = 'fabric-photo'; img.alt = '';
        img.setAttribute('data-id', e.fabricId); img.setAttribute('data-color', e.color); img.setAttribute('data-i', '0');
        img.style.visibility = 'hidden';                         // 사진을 다 받은 뒤에만 보임 (찾는 동안 깨진 그림 표시가 안 보이게)
        img.onload = function() { img.style.visibility = ''; };
        img.onerror = function() { photoFallback(img); };       // 사진이 없으면 색 칸 그대로
        img.src = fabricPhotoUrls(e.fabricId, e.color)[0];
        const bg = card.querySelector('.bookmark-bg');
        if (bg) bg.after(img);
        if (i === picks.length - 1) card.insertAdjacentHTML('beforeend', '<div class="card-brand">' + redamLogoSVG() + '</div>');
    });
    finderShowMarks();
    closeFinderShowAsk();
    box.classList.remove('hidden');
    document.documentElement.style.overflow = 'hidden';         // 뒤의 직원 화면이 밀리지 않게
    if (appMode === 'staff') { staffLocked = true; setStaffLockedUi(true); }
}
// 강조(고른 칸) · 담음(넣을 칸에 지금 들어 있는 원단) 표시를 맞춤
function finderShowMarks() {
    const canvas = document.getElementById('finderShowCanvas');
    if (!canvas) return;
    const t = finderShowMode ? null : finderTargetCurtain();      // 나란히 보기(custom)에는 "담음" 표시 없음
    canvas.classList.toggle('has-sel', finderShowSel >= 0);
    Array.from(canvas.children).forEach((card, i) => {
        const e = finderShowList[i];
        card.classList.toggle('is-sel', i === finderShowSel);
        card.classList.toggle('is-put', !!t && !!e && t.c.fabricId === e.fabricId && (t.c.colorName || '') === e.color);
    });
}
function finderShowTap(i) {
    if (!finderShowList[i]) return;
    if (finderShowSel !== i) { finderShowSel = i; finderShowMarks(); return; }
    openFinderShowAsk();
}
// 확인 창: "오솔로 화이트로 할까요?" [이걸로 할게요 / 다시 고를게요]. 넣을 칸이 없으면 같은 창이 "어느 칸에 담을까요?"로 바뀜
const finderShowEsc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function openFinderShowAsk() {
    const e = finderShowList[finderShowSel], ask = document.getElementById('finderShowAsk');
    if (!e || !ask) return;
    ask.querySelector('.finder-show-ask-in').innerHTML = `<p class="finder-show-ask-q font-serif-kr">${finderShowEsc(finderJosa(finderShowName(e).full, '으로', '로'))} 할까요?</p>`
        + '<div class="finder-show-ask-acts"><button type="button" class="is-yes font-serif-kr" data-ask="yes">이걸로 할게요</button><button type="button" class="font-serif-kr" data-ask="no">다시 고를게요</button></div>';
    ask.classList.remove('hidden');
}
function closeFinderShowAsk() {
    const ask = document.getElementById('finderShowAsk');
    if (!ask || ask.classList.contains('hidden')) return false;
    ask.classList.add('hidden');
    return true;
}
// 넣을 칸 고르기: 같은 종류 칸(속지 색 → 속지 칸 …)만, 공간 · 칸 이름만 (지금 들어 있는 원단·가격은 안 보임)
function finderShowSlots(e) {
    const ask = document.getElementById('finderShowAsk');
    const slots = [];
    rooms.forEach(r => r.curtains.forEach(c => { if (finderCurtainKind(c) === e.cat) slots.push({ r, c }); }));
    ask.querySelector('.finder-show-ask-in').innerHTML = slots.length
        ? '<p class="finder-show-ask-q font-serif-kr">어느 칸에 담을까요?</p><div class="finder-show-ask-acts is-slots">'
            + slots.map(s => `<button type="button" class="font-serif-kr" data-ask-slot="${s.r.id}:${s.c.id}">${finderShowEsc(s.r.name)} · ${finderShowEsc(s.c.label)}</button>`).join('')
            + '</div><div class="finder-show-ask-acts"><button type="button" class="font-serif-kr" data-ask="no">다시 고를게요</button></div>'
        : `<p class="finder-show-ask-q font-serif-kr">담을 ${FINDER_KIND_WORDS[e.cat]} 칸이 아직 없습니다</p><div class="finder-show-ask-acts"><button type="button" class="font-serif-kr" data-ask="no">닫기</button></div>`;
}
function finderShowAskClick(ev) {
    const btn = ev.target.closest('button');
    if (!btn) { if (!ev.target.closest('.finder-show-ask-in')) closeFinderShowAsk(); return; }      // 판 밖 = 다시 고를게요
    const e = finderShowList[finderShowSel];
    if (btn.dataset.ask === 'no' || !e) { closeFinderShowAsk(); return; }
    if (finderShowMode) { const m = finderShowMode; closeFinderShow(); m.onPick(e); return; }      // 나란히 보기: 정하면 닫고 그 칸을 바꿈
    if (btn.dataset.askSlot) {
        const [roomId, curtainId] = btn.dataset.askSlot.split(':').map(Number);
        finderTarget = { roomId, curtainId };       // 고른 칸이 "넣을 칸"이 됨 → 다음에 고르면 같은 칸이 바뀜
    }
    const t = finderTargetCurtain();
    if (!t) { finderShowSlots(e); return; }
    finderApplyPut(t, e);
    finderShowChanged = true;
    closeFinderShowAsk();
    finderShowMarks();
    // 위에 작은 판으로 1.5초: "거실 · 속지에 오솔로 화이트를 담았어요"
    const done = document.getElementById('finderShowDone');
    if (done) {
        done.textContent = `${t.room.name} · ${t.c.label}에 ${finderJosa(finderShowName(e).full, '을', '를')} 담았어요`;
        done.classList.add('on');
        clearTimeout(finderShowDoneTimer);
        finderShowDoneTimer = setTimeout(() => done.classList.remove('on'), 1500);
    }
}
function closeFinderShow() {
    const box = document.getElementById('finderShow');
    if (box) box.classList.add('hidden');
    closeFinderShowAsk();
    const done = document.getElementById('finderShowDone');
    if (done) done.classList.remove('on');
    finderShowSel = -1;
    finderShowMode = null;
    document.documentElement.style.overflow = '';
    if (appMode === 'staff' && staffLocked) { staffLocked = false; setStaffLockedUi(false); lastActivity = Date.now(); setFinderOnly(true); }
    if (finderShowChanged) { finderShowChanged = false; renderFinder(); }       // 찾기 카드에 "지금 이 칸" 표시
}
function setFinderView(view) { finderView = view === 'map' ? 'map' : 'grid'; renderFinder(); }

// 중심 화면 › 더 보기(고객 화면)는 more.js로 옮김 (130-2)
// 색 지도: 가로 = 노란기 b(왼쪽 쿨 · 오른쪽 웜), 세로 = 밝기 L(위가 밝음). 지금 조건에 맞는 색은 진하고 크게, 나머지는 흐리게
// 색 값(밝기·노란기)이 없는 색은 지도에 나오지 않음. 노란기가 눈금 밖(-12 미만 · 30 초과)인 색은 가장자리에 찍힘
// mc: 방 색을 잰 공간의 measuredColor면 [벽]·[바닥] 표지, 둘을 잇는 띠, 이어주는 색 동그라미를 같이 그림
function finderMapHtml(all, on, ref, mc) {
    const W = 720, H = 400, P = { l: 44, r: 16, t: 20, b: 40 };
    const x = b => P.l + (Math.max(-12, Math.min(30, b)) + 12) / 42 * (W - P.l - P.r);
    const y = L => P.t + (100 - L) / 90 * (H - P.t - P.b);
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let g = '';
    [20, 40, 60, 80].forEach(L => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(L).toFixed(1)}" y2="${y(L).toFixed(1)}"/><text x="${P.l - 8}" y="${(y(L) + 4).toFixed(1)}" text-anchor="end">${L}</text>`; });
    [-8, 0, 8, 16, 24].forEach(b => { g += `<line x1="${x(b).toFixed(1)}" x2="${x(b).toFixed(1)}" y1="${P.t}" y2="${H - P.b}"/>`; });
    g += `<text x="${P.l}" y="${H - 12}">← 푸른기 (쿨)</text><text x="${x(0).toFixed(1)}" y="${H - 12}" text-anchor="middle">뉴트럴</text><text x="${W - P.r}" y="${H - 12}" text-anchor="end">노란기 (웜) →</text>`;
    g += `<text x="${P.l - 8}" y="${P.t + 4}" text-anchor="end">밝음</text>`;
    const pts = all.filter(e => e.L != null && e.b != null);
    finderMapPoints = pts.map(e => ({ key: e.key, x: x(e.b), y: y(e.L), hit: on.has(e.key) }));
    const isRef = e => !!ref && ref.key === e.key;
    const rank = e => isRef(e) ? 2 : (on.has(e.key) ? 1 : 0);        // 흐린 점 → 조건에 맞는 점 → 기준 색 순으로 위에 그림
    const dots = pts.slice().sort((p, q) => rank(p) - rank(q)).map(e => {
        const r = rank(e);
        return `<circle cx="${x(e.b).toFixed(1)}" cy="${y(e.L).toFixed(1)}" r="${r === 2 ? 10 : (r === 1 ? 7.5 : 5)}" fill="${e.hex || '#cccccc'}" opacity="${r ? 1 : 0.22}" stroke="${r === 2 ? 'var(--brand-accent)' : 'var(--brand-dark)'}" stroke-opacity="${r === 2 ? 1 : 0.35}" stroke-width="${r === 2 ? 3 : 1}"><title>${esc(`${e.fabName} ${e.no} ${e.label}`.replace(/\s+/g, ' ').trim())} · 밝기 ${Math.round(e.L)}</title></circle>`;
    }).join('');
    const missing = finderColorTotal(all) - finderColorTotal(pts);      // 색이 없는 원단의 빈 카드는 세지 않음 (58번)
    // 우리 집: 띠·점선은 원단 점 아래, 표지·이어주는 색은 위에 (표지 글씨는 점 오른쪽, 오른쪽 끝이면 왼쪽)
    let under = '', over = '';
    if (mc) {
        const mark = (c, label, color) => {
            const cx = x(c.b), cy = y(c.L), right = cx < W - 110;
            return `<g class="finder-map-home" pointer-events="none"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="${c.hex}" stroke="${color}" stroke-width="3"/>`
                + `<rect x="${(right ? cx + 13 : cx - 13 - 74).toFixed(1)}" y="${(cy - 10).toFixed(1)}" width="74" height="20" rx="5" fill="${color}"/>`
                + `<text x="${(right ? cx + 50 : cx - 50).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" fill="#fffdf9" font-weight="700">${label} 밝기 ${Math.round(c.L)}</text></g>`;
        };
        if (mc.wall && mc.floor) {
            const l = `x1="${x(mc.wall.b).toFixed(1)}" y1="${y(mc.wall.L).toFixed(1)}" x2="${x(mc.floor.b).toFixed(1)}" y2="${y(mc.floor.L).toFixed(1)}"`;
            under = `<g class="finder-map-bridge" pointer-events="none"><line class="band" ${l} stroke-width="38" stroke-linecap="round"/><line class="axis" ${l} stroke-width="2" stroke-dasharray="5 4"/></g>`;
        }
        if (mc.bridge) {
            const bx = x(mc.bridge.b), by = y(mc.bridge.L);
            over += `<g class="finder-map-bridge" pointer-events="none"><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="12" fill="none" stroke="#8a4a22" stroke-width="2.5"/><text x="${(bx - 16).toFixed(1)}" y="${(by + 4).toFixed(1)}" text-anchor="end" fill="#8a4a22" font-weight="700">이어주는 색</text></g>`;
        }
        if (mc.wall) over += mark(mc.wall, '벽', '#2b221a');
        if (mc.floor) over += mark(mc.floor, '바닥', '#8a4a22');
    }
    return `<div class="finder-map"><svg data-map viewBox="0 0 ${W} ${H}" role="img" aria-label="원단 색을 밝기와 웜·쿨로 펼친 지도">${g}${under}${dots}${over}</svg></div>
        <p class="finder-map-hint">위로 갈수록 밝고, 오른쪽으로 갈수록 노란기(웜)가 많아요. 진한 점이 지금 조건에 맞는 색이고, 점을 누르면 그 색과 비슷한 색을 찾습니다. 점이 비어 있는 곳은 갖고 있는 책자에 없는 색이라, 새 책자를 고를 때도 참고가 됩니다.${missing ? ` (색 값이 없는 ${missing}색은 지도에 나오지 않아요.)` : ''}${mc ? '<br>짙은 표지가 잰 벽, 흙빛 표지가 잰 바닥이에요. 둘을 잇는 띠 안이 벽과 바닥을 이어주는 색이고, 동그라미(벽 6.5 : 바닥 3.5, 임시)에 가까울수록 벽 쪽에 어울려요.' : ''}</p>`;
}
// 지도에서 누른 자리와 가장 가까운 점 (손가락으로 눌러도 잡히게). 조건에 맞는 진한 점이 가까이 있으면 그 점이 먼저
function finderMapPick(event, svg) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const nearest = (list, max) => list.reduce((best, m) => { const d = Math.hypot(m.x - p.x, m.y - p.y); return (d < max && (!best || d < best.d)) ? { key: m.key, d } : best; }, null);
    const hit = nearest(finderMapPoints.filter(m => m.hit), 12) || nearest(finderMapPoints, 18);
    return hit ? hit.key : null;
}
// 카드의 버튼: "비슷한 색" = 그 색과 가까운 색 찾기 / "이 공간에 넣기" = 넣을 칸의 원단과 색상 번호를 바꾸고 상담 화면으로 돌아감(찾기만 열린 상태면 찾기 화면에 머묾)
function finderClick(event) {
    const starBtn = event.target.closest('button[data-star], button[data-unstar]');
    if (starBtn) {
        const key = starBtn.dataset.star || starBtn.dataset.unstar;
        const all = finderEntries();
        if (finderPicks.includes(key)) finderPicks = finderPicks.filter(k => k !== key);
        else if (finderPicks.filter(k => all.some(e => e.key === k)).length >= FINDER_PICK_MAX) showToast(`후보는 ${FINDER_PICK_MAX}개까지예요. 하나를 빼고 다시 눌러 주세요.`, 'info');
        else finderPicks.push(key);
        // 카드는 다시 그리지 않고 별표만 바꿈 (열어 둔 정보판·밀어 둔 사진이 그대로 있게)
        const on = finderPicks.includes(key);
        document.querySelectorAll('#finderOut button[data-star]').forEach(b => {
            if (b.dataset.star !== key) return;
            b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★' : '☆';
        });
        renderFinderPicks(all);
        return;
    }
    const head = event.target.closest('button[data-head]');
    if (head) { finderOpenCard(head.closest('.finder-card')); return; }
    const dot = event.target.closest('button[data-dot]');
    if (dot) {
        const t = dot.closest('.finder-sw').querySelector('.finder-sw-track');
        t.scrollTo({ left: t.clientWidth * Number(dot.dataset.dot), behavior: 'smooth' });
        return;
    }
    const pairBtn = event.target.closest('button[data-pair]');
    if (pairBtn) {
        finderRef = pairBtn.dataset.pair; finderSort = 'pair'; finderView = 'grid';
        // 넣을 칸이 겉지 칸이면 같은 공간의 속지 칸으로 옮김. 속지 칸이 없으면 넣을 칸을 풂 (겉지 칸에 속지가 들어가지 않게)
        const t = finderTargetCurtain();
        if (t && finderCurtainKind(t.c) !== 'sheer') {
            const s = t.room.curtains.find(c => finderCurtainKind(c) === 'sheer');
            finderTarget = s ? { roomId: t.room.id, curtainId: s.id } : null;
        }
        renderFinder();
        const pane = document.getElementById('fabricTab-find');
        if (pane) pane.scrollIntoView({ block: 'start' });
        return;
    }
    const svg = event.target.closest('svg[data-map]');
    const simBtn = event.target.closest('button[data-sim]');
    const simKey = svg ? finderMapPick(event, svg) : (simBtn ? simBtn.dataset.sim : null);
    if (svg || simBtn) {
        if (!simKey) return;
        finderRef = simKey; finderSort = 'sim'; finderView = 'grid';      // 지도의 점을 눌러도 카드 보기로 돌아와 비슷한 색을 보여 줌
        renderFinder();
        const pane = document.getElementById('fabricTab-find');
        if (pane) pane.scrollIntoView({ block: 'start' });
        return;
    }
    const slotBtn = event.target.closest('button[data-slot]');
    if (slotBtn) {
        const [roomId, curtainId] = slotBtn.dataset.slot.split(':').map(Number);
        const key = slotBtn.closest('.finder-slots').dataset.key;
        closeFinderSlots();
        finderTarget = { roomId, curtainId };       // 고른 칸이 "넣을 칸"이 됨 → 찾기만 열린 상태면 다른 색을 바로 바꿔 넣을 수 있음
        finderPut(key);
        return;
    }
    if (event.target.closest('button[data-slot-close]')) { closeFinderSlots(); return; }
    const btn = event.target.closest('button[data-pick]');
    if (!btn) return;
    if (!finderTargetCurtain()) { openFinderSlots(btn.closest('.finder-card'), btn.dataset.pick); return; }
    finderPut(btn.dataset.pick);
}
// 넣을 칸(finderTarget)에 그 색을 넣음
function finderPut(key) {
    const t = finderTargetCurtain();
    const e = finderEntries().find(x => x.key === key);
    if (!t || !e) { finderTarget = null; renderFinder(); showToast('넣을 칸을 찾지 못했어요. 상담 화면에서 "찾기"를 다시 눌러 주세요.', 'error'); return; }
    finderApplyPut(t, e);
    // 찾기만 열린 상태: 상담 화면으로 가지 않고(PIN이 필요) 넣을 칸도 그대로 둠 → 다른 색을 누르면 바로 바뀜
    if (staffFinderOnly) { renderFinder(); showToast(`${e.fabName}${colorSuffix(e.color, e.fabricId)} → ${t.room.name} · ${t.c.label} 칸에 넣었어요. 다른 색을 누르면 바뀝니다.`); return; }
    finderTarget = null;
    showStaffView('consult');
    const sub = document.getElementById(`curtainSub_${t.c.id}`);
    const card = sub && sub.closest('.staff-curtain');
    if (card) card.scrollIntoView({ block: 'center' });
    showToast(`${e.fabName}${colorSuffix(e.color, e.fabricId)} → ${t.room.name} · ${t.c.label} 칸에 넣었어요.`);
}
// 칸에 원단 + 색상 번호를 넣음 (찾기 카드의 "이 공간에 넣기"와 "고객에게 보여주기"의 "이걸로 할게요"가 같이 씀)
function finderApplyPut(t, e) {
    collapsedRooms.delete(t.room.id);
    if (!t.c.aiPick) {
        const def = bestForCurtain(t.room, t.c);
        if (def) t.c.aiPick = { fabricId: def.fabricId, colorName: def.colorName || '', dir: def.dir };
    }
    updateCurtainData(t.room.id, t.c.id, 'fabricId', e.fabricId);      // 원단이 바뀌면 색상 번호가 비워지므로, 색은 그다음에 넣음
    t.c.colorName = e.color;
    delete t.c.toneStep; delete t.c.pickDir; delete t.c.baseFabricId; delete t.c.baseColorName;      // 다른 방법으로 바꾸면 이유 카드의 한 톤·잇는 방향·사다리 기준은 지움 (28·49번)
    t.c.custPicked = false;      // 직원이 바꾸면 손님 표시는 내림 (116번)
    if (t.c.aiPick && t.c.fabricId === t.c.aiPick.fabricId && (t.c.colorName || '') === (t.c.aiPick.colorName || '')) {
        t.c.staffPicked = false; t.c.staffPick = null; t.c.changeReason = null;
    } else {
        t.c.staffPicked = true; t.c.staffPick = { fabricId: t.c.fabricId, colorName: t.c.colorName || '' };
    }
    renderRooms();
    calculateAll();
}
// "어느 칸에 넣을까요?" 판: 넣을 칸이 안 정해졌을 때 그 카드 위에 뜸. 같은 종류 칸(속지 색 → 속지 칸 …)만, 하나뿐이어도 띄움
//  - 칸 옆에는 지금 들어 있는 원단 이름만 작게 (단가·가격은 넣지 않음 — 고객과 같이 보는 상태에서도 씀)
const FINDER_KIND_WORDS = { drape: '겉지', sheer: '속지', blind: '블라인드' };
function openFinderSlots(card, key) {
    closeFinderSlots();
    const e = finderEntries().find(x => x.key === key);
    if (!card || !e) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const slots = [];
    rooms.forEach(r => r.curtains.forEach(c => { if (finderCurtainKind(c) === e.cat) slots.push({ r, c }); }));
    const now = c => { const f = FABRIC_DB.find(x => x.id === c.fabricId); return f ? `${f.name}${colorSuffix(c.colorName, f.id)}` : ''; };
    const box = document.createElement('div');
    box.className = 'finder-slots';
    box.dataset.key = key;
    box.setAttribute('role', 'dialog');
    box.innerHTML = `<div class="finder-slots-head"><b>어느 칸에 넣을까요?</b><button type="button" data-slot-close>닫기</button></div>`
        + (slots.length ? '<div class="finder-slots-list">' + slots.map(s => `<button type="button" data-slot="${s.r.id}:${s.c.id}"><span>${esc(s.r.name)} · ${esc(s.c.label)}</span><small>${esc(now(s.c))}</small></button>`).join('') + '</div>'
            : `<p class="finder-slots-none">이 공간에 ${FINDER_KIND_WORDS[e.cat]} 칸이 없어요. 상담에서 칸을 먼저 추가해 주세요.</p>`);
    card.appendChild(box);
    const put = card.querySelector('.finder-acts.is-put');
    if (put) box.style.bottom = put.offsetHeight + 'px';      // 넣기 버튼 바로 위까지 덮음
    card.classList.add('is-slots');
}
function closeFinderSlots() {
    const open = document.querySelectorAll('#finderOut .finder-slots');
    open.forEach(b => { b.closest('.finder-card').classList.remove('is-slots'); b.remove(); });
    return open.length > 0;
}
// 판 밖을 누르면 닫기만 함 (뒤의 카드·버튼은 눌리지 않게)
document.addEventListener('click', ev => {
    const box = document.querySelector('#finderOut .finder-slots');
    if (!box || box.contains(ev.target)) return;
    ev.stopPropagation(); ev.preventDefault();
    closeFinderSlots();
}, true);

