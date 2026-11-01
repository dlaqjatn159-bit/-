(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['more.js']='20261187';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// more.js — 고객 화면 중심 화면 › 더 보기(20번 4단계 · 72번): 카드 ↔ 색 지도, 조건·순서·잇는 방향, 후보 1~4, 후보 비교하기 (130-2에서 app.js에서 떼어 냄)

// ==============================================================
// 중심 화면 › 더 보기 (고객 화면, 작업목록 20번 4단계 · 72번): 카드 ↔ 색 지도 → 눌러서 후보 1~4 → 지금 원단과 후보 비교하기
//  - 직원 원단 찾기와 같은 목록(finderEntries) · 카드 모양(finder-card) · 잇기 계산(roomLinkDistance). 가격·책자·꼬리표·숫자 없음
//  - 거름망은 고객이 알아듣는 말만: 밝기 · 결 · 비침(속지) / 빛 가림(겉지) + 순서(카드 보기에서만). PIN 없이 고객이 직접 씀
//  - 72번: 왼쪽 세로 판(공간 이름 · 보기 전환 · 잇는 방향 · 조건 · 후보 칸)과 오른쪽 넓은 카드·지도. 글자는 20·16·14px 세 가지만
// ==============================================================
const MORE_STAR_MAX = 4;
const MORE_FILTERS = {
    bright: { label: '밝기', opts: { light: '밝은 색', mid: '중간 색', dark: '진한 색' }, of: e => e.L == null ? null : (e.L >= 85 ? 'light' : (e.L >= 55 ? 'mid' : 'dark')) },
    tex: { label: '결', opts: { smooth: '매끈한', natural: '결 있는', cozy: '도톰한' }, of: e => e.texture },
    see: { label: '비침', kind: 'sheer', opts: { clear: '많이 비침', soft: '적당히 비침', day: '거의 안 비침' }, of: e => ({ light: 'clear', medium: 'soft', day: 'day', heavy: 'day' })[e.density] || null },      // 72번: 판정 대신 사실
    block: { label: '빛 가림', kind: 'drape', opts: { life: '생활 암막', full: '완전 암막' }, of: e => (e.blackout === 'life' || e.blackout === 'full') ? e.blackout : null }
};
const MORE_SORTS = { fit: '추천 순', sameColor: '지금 색과 가까운 순', light: '밝은 순', dark: '진한 순' };      // 72번
const MORE_DIRS = ['wall', 'bridge', 'floor'];      // 잇는 방향 (28번 · 72번): 벽 색 기준 / 벽·바닥 사이 / 바닥 색 기준 — 색 잇기 화면과 같은 말
const MORE_MAP_W = 900, MORE_MAP_H = 640;      // 지도 비율 (72번: 오른쪽 자리에 맞춰 900×500 → 900×640)
let spaceMore = null;       // { roomId, idx, view: 'cards' | 'map', face: 'color' | 'photo'(74번), stars: [키], focus: 키, sel: { 묶음: Set }, sameFab, sort, sheet: 키, dir: 잇는 방향(이 화면에서만) }
function openSpaceMore(roomId, idx) {
    const slot = window.concierge && window.concierge.spaceSlot(roomId, idx);
    if (!slot) return;
    // 잇는 방향 처음 값 = 그 칸에서 고른 방향 → 공간의 색 잇기 답 → 그 중간으로. 바꿔도 공간의 답(room.linkDir)은 그대로
    const mc = slot.room.measuredColor, dir = (mc && mc.wall && mc.floor) ? (slot.curtain.pickDir || slot.room.linkDir || 'bridge') : null;
    spaceMore = { roomId, idx, view: 'cards', face: 'color', stars: [], focus: null, sel: { bright: new Set(), tex: new Set(), see: new Set(), block: new Set() }, sameFab: false, sort: 'fit', sheet: null, dir, mapK: 1 };
    let ov = document.getElementById('spaceMore');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'spaceMore';
        ov.className = 'more-overlay';
        ov.addEventListener('click', spaceMoreClick);
        ov.addEventListener('change', ev => {
            if (ev.target.matches('select[data-msort]')) { spaceMore.sort = ev.target.value; renderSpaceMore(); }
        });
        // 화면 크기가 바뀌면 지도 글씨를 다시 맞춤 (72번)
        window.addEventListener('resize', () => { if (spaceMore && spaceMore.view === 'map') renderSpaceMore(); });
        document.body.appendChild(ov);
    }
    ov.hidden = false;
    renderSpaceMore();
}
function closeSpaceMore() {
    const ov = document.getElementById('spaceMore');
    if (ov) { ov.hidden = true; ov.innerHTML = ''; }
    spaceMore = null;
}
// 지금 칸의 공간·원단과 같은 종류 색 목록. cur = 지금 들어 있는 색(목록에 없을 수도)
function spaceMoreData() {
    const slot = window.concierge.spaceSlot(spaceMore.roomId, spaceMore.idx);
    if (!slot) return null;
    const all = finderEntries().filter(e => e.cat === slot.kind);
    const cur = finderFind(all, slot.curtain.fabricId, slot.curtain.colorName || '');      // 삼보텍스·콤비 짝처럼 같은 원단 묶음의 색이면 그 카드 (58번)
    const curKey = cur ? cur.key : slot.curtain.fabricId + '__' + (slot.curtain.colorName || '');
    const curFabId = (cur && cur.fabricId) || slot.curtain.fabricId;
    const curGroup = (cur && cur.group) || ((all.find(e => e.twins && e.twins.includes(curFabId)) || {}).group) || curFabId;
    const curFab = (typeof FABRIC_DB !== 'undefined' ? FABRIC_DB.find(f => f.id === curFabId) : null);
    const curFabName = (cur ? finderShowName(cur).name : (curFab && curFab.name)) || '지금 원단';
    const sameFabCount = finderColorTotal(all.filter(e => (e.group || e.fabricId) === curGroup));
    return { slot, all, cur, curKey, curFabId, curGroup, curFabName, sameFabCount };
}
function spaceMoreOk(e, curGroup) {
    if (spaceMore && spaceMore.sameFab && curGroup && (e.group || e.fabricId) !== curGroup) return false;
    return Object.keys(MORE_FILTERS).every(k => !spaceMore.sel[k].size || spaceMore.sel[k].has(MORE_FILTERS[k].of(e)));
}
// 우리 집에 어울리는 점수: 고객 원단 화면 추천과 같은 계산 (기존 추천 점수 + 색 잇기 점수). 색 잇기는 이 화면에서 고른 잇는 방향으로
function spaceMoreFit(e, room) {
    const cat = e.cat === 'sheer' ? '속지' : '겉지';
    const linkRoom = spaceMore.dir ? Object.assign({}, room, { linkDir: spaceMore.dir }) : room;
    return calculateFabricMatchScore(e.view, room, cat) + roomLinkBonus({ light: e.L, a: e.a, b: e.b }, linkRoom);
}
const moreEsc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function renderSpaceMore() {
    const ov = document.getElementById('spaceMore'), d = spaceMore && spaceMoreData();
    if (!ov || !d) { closeSpaceMore(); return; }
    const { slot, curFabName, sameFabCount } = d, room = slot.room;
    const mc = room.measuredColor, measured = !!(mc && mc.wall && mc.floor);
    const keep = (ov.querySelector('.more-body') || {}).scrollTop || 0, keepSide = (ov.querySelector('.more-side') || {}).scrollTop || 0;
    // 거름망 (지도에서는 순서 없음). 여러 개 고를 수 있음. 이름표(밝기·결 …) 없이 칩 말만 (72번)
    const grp = k => {
        const f = MORE_FILTERS[k];
        if (f.kind && f.kind !== slot.kind) return '';
        return '<div class="more-fg">' + Object.keys(f.opts).map(v => `<button type="button" class="more-chip${spaceMore.sel[k].has(v) ? ' on' : ''}" data-mf="${k}:${v}" aria-pressed="${spaceMore.sel[k].has(v)}">${f.opts[v]}</button>`).join('') + '</div>';
    };
    const any = Object.values(spaceMore.sel).some(s => s.size) || spaceMore.sameFab || (spaceMore.sort !== 'fit');
    // 왼쪽 세로 판 (72번): 뒤로 + 카드/색 지도 → 잇는 방향 → 조건 → (카드) 색·사진 → 후보 칸 4개 → 후보 비교하기
    //  74번: 공간 이름·겉지 글자는 뺌(그 칸을 눌러 들어왔으니)
    let h = '<aside class="more-side">';
    h += '<div class="more-top"><button type="button" class="more-back" data-mclose aria-label="뒤로"><i class="fa-solid fa-arrow-left"></i></button>';
    h += `<div class="more-seg"><button type="button" class="${spaceMore.view === 'cards' ? 'on' : ''}" data-mview="cards">카드</button><button type="button" class="${spaceMore.view === 'map' ? 'on' : ''}" data-mview="map">색 지도</button></div></div>`;
    // 잇는 방향 (벽·바닥을 둘 다 잰 공간만, 카드·지도 둘 다): 세 줄이 늘 보이고 고른 줄만 왼쪽 선. 카드 "추천 순"과 지도 점선 원이 따라 바뀜
    // 방 그림 미니맵 (104번): 마지막으로 담은 후보(없으면 지금 원단) 색을 이 칸 자리에, 같은 공간의 다른 칸은 들어 있는 원단 색으로
    if (measured && window.RoomColor && RoomColor.roomMiniSvg) {
        const lastKey = spaceMore.stars[spaceMore.stars.length - 1], show = (lastKey && d.all.find(x => x.key === lastKey)) || d.cur;
        const o = {};
        (room.curtains || []).forEach((c, i) => {
            const k = c.presetType === 'blind' ? 'blind' : (c.presetType === 'sheer' ? 'sheer' : 'drape');
            if (i === spaceMore.idx) { if (show && show.hex) o[k] = show.hex; }
            else if (c.fabricId) { const e = finderFind(finderEntries(), c.fabricId, c.colorName || ''); if (e && e.hex) o[k] = e.hex; }
        });
        const dc = (room.curtains || []).find(c => c.presetType !== 'sheer' && c.presetType !== 'blind');
        const dfId = dc && (room.curtains.indexOf(dc) === spaceMore.idx && show ? show.fabricId : dc.fabricId);
        o.count = RoomColor.miniWidthCount(room.width, typeof FABRIC_DB !== 'undefined' ? FABRIC_DB.find(f => f.id === dfId) : null);
        h += `<div class="room-mini-box is-more">${RoomColor.roomMiniSvg(mc, o)}</div>`;
    }
    if (measured) h += '<div class="more-dirs">' + MORE_DIRS.map(k => `<button type="button" class="${spaceMore.dir === k ? 'on' : ''}" data-mdir="${k}" aria-pressed="${spaceMore.dir === k}">${window.concierge.linkWord(k)}</button>`).join('') + '</div>';
    h += '<div class="more-fbar">';
    if (sameFabCount > 1) h += `<div class="more-fg"><button type="button" class="more-chip more-chip-fab${spaceMore.sameFab ? ' on' : ''}" data-msamefab="1" aria-pressed="${spaceMore.sameFab}">${moreEsc(curFabName)} ${sameFabCount}색만</button></div>`;
    h += grp('bright') + grp('tex') + grp('see') + grp('block');
    if (spaceMore.view === 'cards') h += '<select class="more-sort" data-msort aria-label="순서">' + Object.keys(MORE_SORTS).map(k => `<option value="${k}"${spaceMore.sort === k ? ' selected' : ''}>${MORE_SORTS[k]}</option>`).join('') + '</select>';
    if (any) h += '<button type="button" class="more-clear" data-mclear>조건 풀기</button>';
    h += '</div>';
    // 색·사진 (74번, 카드 보기에서만): 카드를 한꺼번에 색 장 / 사진 장으로. 견본은 지금 원단(사진이 없으면 사진 있는 첫 색). 사진이 하나도 없으면 안 보임
    if (spaceMore.view === 'cards') {
        const withPh = [d.cur].concat(d.all).filter(Boolean).map(e => ({ e, ph: photoFor(e.fabricId, e.color) })).find(x => x.ph);
        if (withPh) {
            const hex = (d.cur && d.cur.hex) || withPh.e.hex || 'var(--brand-panel)';
            const face = (f, bg, word) => `<button type="button" class="${spaceMore.face === f ? 'on' : ''}" data-mface="${f}" aria-pressed="${spaceMore.face === f}"><i style="background:${bg}"></i><span>${word}</span></button>`;
            h += '<div class="more-face">' + face('color', hex, '색') + face('photo', `url('${moreEsc(withPh.ph)}') center / cover no-repeat, ${hex}`, '사진') + '</div>';
        }
    }
    // 후보 칸 4개: 처음부터 빈 칸이 보이고, 담으면 색과 번호가 채워짐. 칸을 누르면 빠짐
    h += '<div class="more-cands">' + Array.from({ length: MORE_STAR_MAX }, (_, i) => {
        const k = spaceMore.stars[i], e = k && d.all.find(x => x.key === k);
        if (!k) return '<span class="more-cand"></span>';
        return `<button type="button" class="more-cand is-on" data-mstar="${moreEsc(k)}" aria-label="후보 ${i + 1}번 빼기" style="background:${(e && e.hex) || 'var(--brand-panel)'}"><em>${i + 1}</em></button>`;
    }).join('') + '</div>';
    h += `<button type="button" class="more-cmp font-serif-kr" data-mside${spaceMore.stars.length ? '' : ' disabled'}>후보 비교하기 →</button>`;
    h += '</aside>';
    h += `<div class="more-main"><div class="more-body${spaceMore.view === 'map' ? ' is-map' : ''}">${spaceMore.view === 'map' ? spaceMoreMapHtml(d) : spaceMoreCardsHtml(d)}</div>${spaceMoreSheetHtml(d)}</div>`;
    ov.innerHTML = h;
    const body = ov.querySelector('.more-body'), side = ov.querySelector('.more-side');
    if (body) body.scrollTop = spaceMore.focus ? 0 : keep;
    if (side) side.scrollTop = keepSide;
    // 사진으로 보기 (74번): 사진이 있는 카드는 둘째 장(사진)으로 넘겨 둠. 다시 그려도(후보 담기 등) 사진 그대로
    if (spaceMore.view === 'cards' && spaceMore.face === 'photo') ov.querySelectorAll('.more-card .finder-sw-track').forEach(t => { if (t.children.length > 1) t.scrollLeft = t.clientWidth; });
    // 지도 글씨: 그려진 크기를 재서 실제로 보이는 글씨가 14px이 되게 맞춤 (72번). 크기가 달라졌으면 한 번 다시 그림
    const svg = spaceMore.view === 'map' && ov.querySelector('.more-map svg');
    if (svg) {
        const r = svg.getBoundingClientRect(), s = Math.min(r.width / MORE_MAP_W, r.height / MORE_MAP_H);
        if (s > 0) { const k = 1 / s; if (Math.abs(k - spaceMore.mapK) / spaceMore.mapK > 0.02) { spaceMore.mapK = k; renderSpaceMore(); } }
    }
}
// 카드: 지금 원단이 맨 앞("지금"), 지도에서 "카드로 보기"를 누른 색이 그다음, 나머지는 순서대로 (조건에 맞는 것만)
function spaceMoreCardsHtml(d) {
    const room = d.slot.room;
    let list = d.all.filter(e => e.key !== d.curKey && spaceMoreOk(e, d.curGroup));
    if (spaceMore.sort === 'light' || spaceMore.sort === 'dark') {
        const s = spaceMore.sort === 'light' ? -1 : 1;
        list.sort((x, y) => (x.L == null) - (y.L == null) || s * ((x.L || 0) - (y.L || 0)));
    } else if (spaceMore.sort === 'sameColor') {
        const cur = d.cur;
        if (cur && cur.L != null) {
            const curL = cur.L, curA = cur.a || 0, curB = cur.b || 0;
            const distCache = new Map();
            const getDist = x => {
                if (distCache.has(x)) return distCache.get(x);
                if (x.L == null) return 9999;
                const dL = x.L - curL;
                const da = (x.a != null && cur.a != null) ? (x.a - curA) : 0;
                const db = (x.b != null && cur.b != null) ? (x.b - curB) : 0;
                const val = Math.hypot(dL, da, db);
                distCache.set(x, val);
                return val;
            };
            list.sort((x, y) => {
                const diff = getDist(x) - getDist(y);
                if (Math.abs(diff) > 0.05) return diff;
                return spaceMoreFit(y, room) - spaceMoreFit(x, room);
            });
        } else {
            list.forEach(e => { e.mfit = spaceMoreFit(e, room); });
            list.sort((x, y) => y.mfit - x.mfit);
        }
    } else {
        list.forEach(e => { e.mfit = spaceMoreFit(e, room); });
        list.sort((x, y) => y.mfit - x.mfit);
    }
    const shown = finderColorTotal(list);      // 등록된 색만 (58번)
    if (spaceMore.focus) { const f = list.find(e => e.key === spaceMore.focus) || d.all.find(e => e.key === spaceMore.focus); if (f && f.key !== d.curKey) list = [f].concat(list.filter(e => e.key !== f.key)); }
    if (d.cur) list = [d.cur].concat(list);
    // 72번: 별표 대신 카드 아무 데나 누르면 후보에 담김(사진 넘기는 점은 그대로). 담긴 카드는 먹선 테두리 + 오른쪽 위 번호
    const card = e => {
        const n = finderShowName(e), isCur = e.key === d.curKey, no = spaceMore.stars.indexOf(e.key) + 1;
        const photo = photoFor(e.fabricId, e.color);
        const colorPage = `<div class="finder-sw-page${e.hex ? '' : ' is-none'}"${e.hex ? ` style="background:${e.hex}"` : ''}>${e.hex ? '' : '<span>샘플북</span>'}</div>`;
        return `<article class="finder-card more-card${isCur ? ' is-current' : ''}${no ? ' is-on' : ''}${e.key === spaceMore.focus ? ' is-focus' : ''}"${isCur ? '' : ` data-mstar="${moreEsc(e.key)}" aria-pressed="${!!no}"`}>`
            + `<div class="finder-sw"><div class="finder-sw-track">${colorPage}${photo ? finderPhotoPageHtml(photo) : ''}</div>${photo ? FINDER_SW_DOTS : ''}`
            + (isCur ? '<span class="finder-cur">지금</span>' : (no ? `<span class="more-no">${no}</span>` : ''))
            + `</div><div class="more-fbody"><b class="font-serif-kr">${moreEsc(n.name)}</b><span>${moreEsc(n.color)}${photo ? '' : ' · 샘플북'}</span></div></article>`;
    };
    const empty = shown ? '' : '<p class="more-empty">조건에 맞는 색이 없어요</p>';
    return `<div class="finder-grid more-grid">${list.map(card).join('')}</div>${empty}`;
}
// 색 지도 (고객용): 위 밝은 색 · 아래 진한 색 · 왼쪽 차가운 색 · 오른쪽 따뜻한 색 (숫자 없음, 72번 말). 같은 종류 원단만, 겹친 점은 살짝 띄움
//  우리 집 바닥·벽 표지와 둘을 잇는 띠, 고른 잇기 자리(점선 원), 지금 원단은 "지금". 조건에 안 맞는 점은 흐리게. 후보는 먹선 고리 + 번호
//  글씨 fs = 화면에서 14px로 보이는 지도 단위(renderSpaceMore가 잰 mapK), 글씨 둘레 여백도 fs에 맞춤
function spaceMoreMapHtml(d) {
    const room = d.slot.room, mc = room.measuredColor, measured = !!(mc && mc.wall && mc.floor);
    const pool = d.all.filter(e => e.L != null && e.b != null && e.hex);
    if (!pool.length) return '<p class="more-empty">색 값이 들어온 원단이 아직 없어요</p>';
    const fs = 14 * (spaceMore.mapK || 1);
    const W = MORE_MAP_W, H = MORE_MAP_H, P = { l: fs * 5.6 + 14, r: fs * 5.6 + 14, t: fs * 2 + 12, b: fs * 2 + 16 };
    const fur = (mc && Array.isArray(mc.furniture) ? mc.furniture : []).filter(f => typeof f.L === 'number' && typeof f.b === 'number');      // 가구 색 (37번)
    const Ls = pool.map(e => e.L).concat(measured ? [mc.wall.L, mc.floor.L] : []), bs = pool.map(e => e.b).concat(measured ? [mc.wall.b, mc.floor.b] : []);
    // 눈금은 색 대부분(위아래 3%를 뺀 범위)과 우리 집 벽·바닥·가구에 맞춤. 멀리 떨어진 몇 색은 가장자리에 붙여 찍음 (가운데가 뭉치지 않게)
    const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))]; };
    const homeL = (measured ? [mc.wall.L, mc.floor.L] : []).concat(fur.map(f => f.L)), homeB = (measured ? [mc.wall.b, mc.floor.b] : []).concat(fur.map(f => f.b));
    const Lmin = Math.min(q(Ls, 0.03), ...homeL) - 3, Lmax = Math.max(q(Ls, 0.97), ...homeL) + 2, bmin = Math.min(q(bs, 0.03), ...homeB) - 2, bmax = Math.max(q(bs, 0.97), ...homeB) + 2;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const X = b => P.l + (clamp(b, bmin, bmax) - bmin) / ((bmax - bmin) || 1) * (W - P.l - P.r);
    const Y = L => P.t + (Lmax - clamp(L, Lmin, Lmax)) / ((Lmax - Lmin) || 1) * (H - P.t - P.b);
    let g = '';
    [0.25, 0.5, 0.75].forEach(f => { const y = Y(Lmin + (Lmax - Lmin) * f).toFixed(1); g += `<line class="more-gl" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/>`; });
    [1 / 3, 2 / 3].forEach(f => { const x = X(bmin + (bmax - bmin) * f).toFixed(1); g += `<line class="more-gl" y1="${P.t}" y2="${H - P.b}" x1="${x}" x2="${x}"/>`; });
    g += `<text class="more-ax" x="${W / 2}" y="${(P.t - 10).toFixed(1)}" text-anchor="middle">↑ 밝은 색</text><text class="more-ax" x="${W / 2}" y="${H - 10}" text-anchor="middle">↓ 진한 색</text>`;
    g += `<text class="more-ax" x="${(P.l - 10).toFixed(1)}" y="${H / 2}" text-anchor="end">차가운 색</text><text class="more-ax" x="${(W - P.r + 10).toFixed(1)}" y="${H / 2}">따뜻한 색</text>`;
    if (measured) {
        g += `<line x1="${X(mc.floor.b).toFixed(1)}" y1="${Y(mc.floor.L).toFixed(1)}" x2="${X(mc.wall.b).toFixed(1)}" y2="${Y(mc.wall.L).toFixed(1)}" stroke="#e3c9b4" stroke-width="26" stroke-linecap="round" opacity=".55"/>`;
    }
    // 고른 잇기 자리(점선 원)와 우리 집 벽·바닥 표지는 점 위에 그림 (가려지지 않게)
    let top = '';
    if (measured) {
        const dir = spaceMore.dir;      // 이 화면의 잇는 방향 (28번)
        const tgt = dir === 'bridge' ? mc.bridge : (dir === 'wall' ? mc.wall : (dir === 'floor' ? { L: Math.min(88, mc.floor.L + FLOOR_LIFT), b: mc.floor.b } : null));
        if (tgt) { const tx = X(tgt.b), ty = Y(tgt.L); top += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="26" fill="none" stroke="#b8714a" stroke-width="2" stroke-dasharray="4 4"/><text class="more-lbl more-halo" x="${(tx + 32).toFixed(1)}" y="${(ty - 16).toFixed(1)}">${window.concierge.linkWord(dir)}</text>`; }
        const home = (c, txt) => `<g class="more-home"><rect x="${(X(c.b) - 15).toFixed(1)}" y="${(Y(c.L) - 15).toFixed(1)}" width="30" height="30" rx="3" fill="${c.hex}"/><text class="more-halo" x="${(X(c.b) + 22).toFixed(1)}" y="${(Y(c.L) + fs * 0.36).toFixed(1)}">${txt}</text></g>`;
        top += home(mc.wall, '벽') + home(mc.floor, '바닥');
    }
    // 가구: 작은 마름모(18px, 45° 돌린 네모) + 이름 ("소파"). 점 위에 그림
    fur.forEach(f => {
        const fx = X(f.b), fy = Y(f.L);
        top += `<g class="more-home"><rect x="${(fx - 9).toFixed(1)}" y="${(fy - 9).toFixed(1)}" width="18" height="18" fill="${f.hex}" stroke="#fff" stroke-width="2" transform="rotate(45 ${fx.toFixed(1)} ${fy.toFixed(1)})"/><text class="more-halo" x="${(fx + 18).toFixed(1)}" y="${(fy + fs * 0.36).toFixed(1)}">${moreEsc(window.RoomColor && RoomColor.furLabel ? RoomColor.furLabel(f.n) : f.n)}</text></g>`;
    });
    // 겹친 점은 서로 밀어 살짝 띄움 (위치는 보기용, 색 값은 그대로)
    const pts = pool.map(e => ({ e, x: X(e.b), y: Y(e.L) }));
    for (let k = 0; k < 40; k++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], c = pts[j], dx = c.x - a.x, dy = c.y - a.y, dd = Math.hypot(dx, dy) || 0.01, need = 21;
        if (dd < need) { const m = (need - dd) / 2, ux = dx / dd, uy = dy / dd; a.x -= ux * m; a.y -= uy * m; c.x += ux * m; c.y += uy * m; }
    }
    pts.forEach(p => { p.x = clamp(p.x, P.l - 20, W - P.r + 20); p.y = clamp(p.y, P.t, H - P.b); });
    const curPt = pts.find(p => p.e.key === d.curKey);
    const rank = e => e.key === d.curKey ? 2 : (spaceMore.stars.includes(e.key) ? 1 : 0);      // 지금 · 후보 점이 맨 위
    const dots = pts.sort((p, q) => rank(p.e) - rank(q.e)).map(({ e, x, y }) => {
        const isCur = e.key === d.curKey, no = spaceMore.stars.indexOf(e.key) + 1, bs = fs * 1.4;
        const badge = no ? `<rect class="more-no-bg" x="${(x + 6).toFixed(1)}" y="${(y - 6 - bs).toFixed(1)}" width="${bs.toFixed(1)}" height="${bs.toFixed(1)}"/><text class="more-no-tx" x="${(x + 6 + bs / 2).toFixed(1)}" y="${(y - 6 - bs / 2 + fs * 0.36).toFixed(1)}" text-anchor="middle">${no}</text>` : '';
        return `<g class="more-dot${isCur ? ' is-cur' : ''}${no ? ' is-on' : ''}${isCur || no || spaceMoreOk(e, d.curGroup) ? '' : ' is-off'}" data-mpt="${moreEsc(e.key)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isCur || no ? 13 : 10}" fill="${e.hex}"/>${badge}</g>`;
    }).join('');
    const curLbl = curPt ? `<text class="more-lbl more-halo" x="${curPt.x.toFixed(1)}" y="${(curPt.y + 16 + fs).toFixed(1)}" text-anchor="middle">지금</text>` : '';
    return `<div class="more-map"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="--mfs-map:${fs.toFixed(2)}px">${g}${dots}${top}${curLbl}</svg></div>`;
}
// 지도에서 누른 점: 아래 작은 판 (사진 · 원단 · 색 이름 · 지금 색과 견준 말 · 후보에 담기 / 카드로 보기 / 닫기)
function spaceMoreSheetHtml(d) {
    if (!spaceMore.sheet || spaceMore.view !== 'map') return '';
    const e = d.all.find(x => x.key === spaceMore.sheet);
    if (!e) return '';
    const cur = d.cur, n = finderShowName(e), isCur = e.key === d.curKey, st = spaceMore.stars.includes(e.key), photo = photoFor(e.fabricId, e.color);
    let word = '지금 고른 색이에요.';
    if (!isCur && cur && cur.L != null && e.L != null && cur.b != null && e.b != null) {
        const lw = e.L > cur.L + 1 ? '밝고' : (e.L < cur.L - 1 ? '진하고' : '비슷한 밝기에');
        const bw = e.b > cur.b + 1.5 ? '조금 더 따뜻해요' : (e.b < cur.b - 1.5 ? '조금 더 차가워요' : '결이 비슷해요');      // 지도 축 말과 같게 (72번)
        word = `지금 색보다 ${lw} ${bw}.`;
    } else if (!isCur) word = '';
    return `<div class="more-sheet"><div class="more-sheet-ph" style="${photo ? `background-image:url('${photo}');` : ''}background-color:${e.hex || 'var(--brand-panel)'}"></div>`
        + `<div class="more-sheet-tx"><b class="font-serif-kr">${moreEsc(n.name)}</b><span>${moreEsc(n.color)}</span><small>${word}${photo ? '' : ' 샘플북으로 직접 보여 드릴게요.'}</small>`
        + `<div class="more-sheet-bt">${isCur ? '' : `<button type="button" class="more-go font-serif-kr" data-mstar="${moreEsc(e.key)}">${st ? '후보에서 빼기' : '후보에 담기'}</button>`}`
        + `<button type="button" class="more-sub" data-mfocus="${moreEsc(e.key)}">카드로 보기</button><button type="button" class="more-sub" data-msheet-close>닫기</button></div></div></div>`;
}
function spaceMoreClick(ev) {
    if (!spaceMore) return;
    const t = ev.target, by = sel => t.closest(sel);
    let b;
    if (by('[data-mclose]')) { closeSpaceMore(); return; }
    if ((b = by('[data-mface]'))) { spaceMore.face = b.dataset.mface; renderSpaceMore(); return; }      // 색·사진 한꺼번에 (74번)
    if ((b = by('[data-mview]'))) { spaceMore.view = b.dataset.mview; spaceMore.sheet = null; spaceMore.focus = null; renderSpaceMore(); return; }
    if ((b = by('[data-mdir]'))) { spaceMore.dir = b.dataset.mdir; spaceMore.focus = null; renderSpaceMore(); return; }      // 잇는 방향 (72번: 고르는 상자 → 세 줄)
    if ((b = by('[data-mf]'))) { const [k, v] = b.dataset.mf.split(':'), s = spaceMore.sel[k]; s.has(v) ? s.delete(v) : s.add(v); renderSpaceMore(); return; }
    if ((b = by('[data-msamefab]'))) { spaceMore.sameFab = !spaceMore.sameFab; renderSpaceMore(); return; }
    if (by('[data-mclear]')) { Object.values(spaceMore.sel).forEach(s => s.clear()); spaceMore.sameFab = false; spaceMore.sort = 'fit'; renderSpaceMore(); return; }
    if ((b = by('button[data-dot]'))) { const tr = b.closest('.finder-sw').querySelector('.finder-sw-track'); tr.scrollTo({ left: tr.clientWidth * Number(b.dataset.dot), behavior: 'smooth' }); return; }      // 사진 넘기는 점은 담기보다 먼저 (72번)
    if ((b = by('[data-mstar]'))) {
        const k = b.dataset.mstar, st = spaceMore.stars;
        if (st.includes(k)) spaceMore.stars = st.filter(x => x !== k);
        else if (st.length >= MORE_STAR_MAX) { showMoreNote('후보는 4개까지예요'); return; }
        else st.push(k);
        if (b.closest('.more-sheet')) spaceMore.sheet = null;      // 점 판에서 담기·빼기를 누르면 판이 닫힘 (10-15 사장님)
        renderSpaceMore(); return;
    }
    if ((b = by('[data-mfocus]'))) { spaceMore.focus = b.dataset.mfocus; spaceMore.sheet = null; spaceMore.view = 'cards'; renderSpaceMore(); return; }
    if (by('[data-msheet-close]')) { spaceMore.sheet = null; renderSpaceMore(); return; }
    if ((b = by('[data-mpt]'))) { spaceMore.sheet = b.dataset.mpt; renderSpaceMore(); return; }
    if ((b = by('[data-mside]')) && !b.disabled) { openSpaceSide(); return; }
}
function showMoreNote(msg) {
    const ov = document.getElementById('spaceMore');
    if (!ov) return;
    let n = ov.querySelector('.more-note');
    if (!n) { n = document.createElement('div'); n.className = 'more-note'; ov.appendChild(n); }
    n.textContent = msg; n.classList.add('on');
    clearTimeout(showMoreNote.t); showMoreNote.t = setTimeout(() => n.classList.remove('on'), 1600);
}
// 후보 비교하기(예전 이름 "나란히 보기"): 지금 원단 + 후보를 고객 원단 화면과 같은 띠 카드로 (19번 "고객에게 보여주기"와 같은 화면·같은 고르기)
function openSpaceSide() {
    const d = spaceMoreData();
    if (!d) return;
    const list = [d.cur].concat(spaceMore.stars.map(k => d.all.find(e => e.key === k))).filter(Boolean);
    const { roomId, idx } = spaceMore;
    // 이 화면의 잇는 방향이 공간의 색 잇기 답과 다르면 그 칸에 pickDir로 적음 (원단을 고른 이유 카드가 칸마다 따름, 28번)
    const base = d.slot.room.linkDir || 'bridge', dir = spaceMore.dir;
    const pickDir = (dir && dir !== base) ? dir : null;
    openFinderShow({ list, curKey: d.curKey, onPick: e => {
        closeSpaceMore();
        if (e.key !== d.curKey) window.concierge.swapCurtain(roomId, idx, e.fabricId, e.color, { pickDir });      // 바꾸면 중심 화면에 "되돌리기" 알림
    } });
}
