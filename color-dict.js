(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['color-dict.js']='20261206';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// color-dict.js — 직원 화면 › 색 사전: 색 이름 표(PRO_COLOR_NAMES)·색 이름 붙이기(proColorName, 최종 제안에서도 씀)·거름망·정렬·검색 (130-2에서 app.js에서 떼어 냄)

// ==============================================================
// 색 사전 (직원 전용, 10-17): 원단 색마다 "디자이너가 쓰는 색 이름"을 색 값(밝기·붉은기·노란기)으로 붙임
//  - 책자의 색 이름(색상 입력표 "색 이름")은 책자 안에서만 구분됨 → 책자를 넘으면 같은 "그레이지"도 서로 다른 색
//  - 여기 이름은 모든 책자에 같은 기준: 아래 표의 기준 색 가운데 가장 가까운 것 하나 (밝기 차이는 절반만 셈 → 색 기운이 더 중요)
//  - 고객 화면·찾기에는 나오지 않음. 이름을 바꾸거나 더하려면 아래 표 한 줄만 고치면 됨 [한글, 영어, 밝기 L, 붉은기 a, 노란기 b, 계열]
// ==============================================================
const PRO_COLOR_NAMES = [
    // 화이트
    ['퓨어 화이트', 'Pure White', 94, 0, 0.5, 'white'], ['스노우', 'Snow', 93, -1, -3, 'white'], ['오프 화이트', 'Chalk', 93, -0.3, 4, 'white'],
    ['아이보리', 'Ivory', 93, -0.3, 8, 'white'], ['바닐라', 'Vanilla', 92, 0.5, 13, 'white'], ['웜 화이트', 'Porcelain', 93, 3, 4.5, 'white'],
    // 그레이 (색 기운 거의 없음)
    ['페일 그레이', 'Fog', 86, 0, 0.5, 'gray'], ['라이트 그레이', 'Dove Gray', 79, 0, 0.5, 'gray'], ['애쉬 그레이', 'Ash', 72, 0, 0.5, 'gray'], ['시멘트 그레이', 'Pebble', 64, 0, 0.5, 'gray'],
    ['미디엄 그레이', 'Pewter', 56, 0, 0.5, 'gray'], ['스모크 그레이', 'Smoke', 48, 0, 0.5, 'gray'], ['다크 그레이', 'Graphite', 39, 0, 0.5, 'gray'], ['차콜', 'Charcoal', 30, 0, 0.5, 'gray'], ['블랙', 'Onyx', 21, 0, 0.5, 'gray'],
    // 쿨 그레이 (푸른 기운)
    ['아이스 그레이', 'Mist', 86, -1, -3, 'cool'], ['실버', 'Silver', 79, -1, -3, 'cool'], ['스틸 그레이', 'Steel Gray', 71, -1, -3, 'cool'], ['블루 그레이', 'Slate Gray', 62, -1, -3, 'cool'],
    ['다크 쿨 그레이', 'Gunmetal', 52, -1, -3, 'cool'], ['딥 쿨 그레이', 'Storm', 41, -1, -3, 'cool'], ['다크 차콜', 'Midnight', 31, -1, -3, 'cool'], ['잉크 블랙', 'Ink', 21, -1, -3, 'cool'],
    // 그레이지 (회색 + 옅은 노란 기운)
    ['페일 그레이지', 'Linen', 86, -0.3, 4, 'greige'], ['라이트 그레이지', 'Putty', 79, -0.3, 4, 'greige'], ['그레이지', 'Greige', 72, -0.3, 4, 'greige'], ['스톤 그레이지', 'Stone', 64, -0.3, 4, 'greige'],
    ['다크 그레이지', 'Driftwood', 56, -0.3, 4, 'greige'], ['딥 그레이지', 'Deep Greige', 48, -0.3, 4, 'greige'], ['웜 차콜', 'Warm Charcoal', 39, -0.3, 4, 'greige'],
    // 베이지·샌드 (노란 기운이 더)
    ['라이트 베이지', 'Ecru', 86, -0.3, 8, 'beige'], ['오트밀', 'Oatmeal', 79, -0.3, 8, 'beige'], ['베이지', 'Biscuit', 72, -0.3, 8, 'beige'], ['다크 베이지', 'Khaki', 64, -0.3, 8, 'beige'],
    ['헤이즐넛', 'Hazel', 56, -0.3, 8, 'beige'], ['딥 베이지', 'Bronze', 48, -0.3, 8, 'beige'],
    ['크림', 'Cream', 86, 0.5, 13, 'beige'], ['샌드', 'Sand', 79, 0.5, 13, 'beige'], ['라떼', 'Wheat', 72, 0.5, 13, 'beige'], ['밀크티', 'Tan', 64, 0.5, 13, 'beige'],
    ['캐러멜', 'Toffee', 56, 0.5, 13, 'beige'], ['시나몬', 'Tobacco', 47, 0.5, 13, 'beige'], ['카멜', 'Camel', 62, 6, 24, 'beige'],
    // 로즈 뉴트럴·브라운 (붉은 기운이 살짝)
    ['로즈 아이보리', 'Shell', 86, 3, 4.5, 'rose'], ['로즈 베이지', 'Nude', 79, 3, 4.5, 'rose'], ['로즈 그레이지', 'Rose Dust', 72, 3, 4.5, 'rose'], ['머쉬룸', 'Mushroom', 64, 3, 4.5, 'rose'],
    ['토프', 'Taupe', 56, 3, 4.5, 'rose'], ['코코아', 'Cocoa', 48, 3, 4.5, 'rose'], ['모카', 'Mocha', 39, 3, 4.5, 'rose'], ['에스프레소', 'Espresso', 30, 3, 4.5, 'rose'],
    ['다크 초콜릿', 'Dark Chocolate', 21, 3, 4.5, 'rose'], ['초콜릿', 'Chocolate', 30, 8, 12, 'rose'],
    // 블루
    ['파우더 블루', 'Powder Blue', 82, -3, -8, 'blue'], ['스카이 블루', 'Sky Blue', 68, -2, -18, 'blue'], ['더스티 블루', 'Dusty Blue', 62, -3, -10, 'blue'],
    ['데님', 'Denim', 45, -3, -16, 'blue'], ['네이비', 'Navy', 28, 2, -14, 'blue'],
    // 그린
    ['민트', 'Mint', 86, -9, 2, 'green'], ['페일 민트', 'Duck Egg', 80, -6, -1, 'green'], ['그린 그레이', 'Sea Glass', 77, -3.5, 1, 'green'], ['유칼립투스', 'Eucalyptus', 62, -7, -1, 'green'],
    ['세이지', 'Sage', 66, -6, 8, 'green'], ['모스 그린', 'Moss', 54, -7, 14, 'green'], ['올리브', 'Olive', 46, -3, 17, 'green'], ['포레스트 그린', 'Forest', 32, -12, 6, 'green'], ['라임', 'Lime', 68, -16, 50, 'green'],
    // 핑크·퍼플
    ['페일 핑크', 'Blush', 84, 7, 6, 'pink'], ['인디 핑크', 'Dusty Rose', 66, 11, 7, 'pink'], ['라벤더', 'Lavender', 78, 6, -9, 'pink'], ['라일락', 'Lilac', 68, 8, -6, 'pink'],
    ['스모키 퍼플', 'Mauve', 55, 8, 0, 'pink'], ['딥 퍼플', 'Plum', 32, 14, -4, 'pink'],
    // 옐로·오렌지·레드
    ['버터', 'Butter', 88, -1, 22, 'warm'], ['레몬', 'Lemon', 88, -6, 50, 'warm'], ['머스타드', 'Mustard', 72, 0, 40, 'warm'], ['머스타드 브라운', 'Ochre', 60, 8, 40, 'warm'],
    ['피치', 'Peach', 82, 9, 17, 'warm'], ['코랄', 'Coral', 65, 25, 22, 'warm'], ['테라코타', 'Terracotta', 50, 22, 26, 'warm'], ['브릭', 'Rust', 42, 22, 30, 'warm'], ['와인', 'Wine', 30, 26, 8, 'warm']
];
const PRO_FAM_LABELS = { white: '화이트', gray: '그레이', cool: '쿨 그레이', greige: '그레이지', beige: '베이지·샌드', rose: '로즈 뉴트럴·브라운', blue: '블루', green: '그린', pink: '핑크·퍼플', warm: '옐로·오렌지·레드' };
const PRO_NAME_L_WEIGHT = 0.5;       // 밝기 차이는 절반만 셈 (같은 밝기라도 색 기운이 다르면 다른 이름이 되게)
// 색 값(L·a·b) → { ko, en, fam, L, a, b(기준 색) , d(기준 색과의 거리) }. 값이 없으면 null
function proColorName(L, a, b) {
    if (typeof L !== 'number' || typeof a !== 'number' || typeof b !== 'number') return null;
    let best = null, bd = Infinity;
    PRO_COLOR_NAMES.forEach(n => {
        const d = Math.hypot((L - n[2]) * PRO_NAME_L_WEIGHT, a - n[3], b - n[4]);
        if (d < bd) { bd = d; best = n; }
    });
    return { ko: best[0], en: best[1], fam: best[5], L: best[2], a: best[3], b: best[4], d: bd };
}
// 찾기 카드 한 장(e)의 색 값: 밝기·붉은기·노란기가 없고 색상코드만 있으면 코드에서 셈 (whyFabricColor와 같은 방식)
function dictLabOf(e) {
    if (finderHasLab(e)) return { L: e.L, a: e.a, b: e.b };
    const hex = /^#[0-9a-f]{6}$/i.test(e.hex || '') ? e.hex : null;
    if (!hex || !window.RoomColor || !RoomColor.rgbToLab) return null;
    const n = parseInt(hex.slice(1), 16), lab = RoomColor.rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
    return { L: e.L != null ? e.L : lab.L, a: lab.a, b: lab.b };
}
const DICT_KEYS = ['fam', 'cat', 'book'];
const DICT_SORTS = { name: '이름별로 묶기', light: '밝은 순', dark: '진한 순', book: '책자 순' };
let dictSel = {}; DICT_KEYS.forEach(k => { dictSel[k] = new Set(); });
let dictSort = 'name';
function dictEntries() {
    return finderEntries().map(e => {
        const lab = dictLabOf(e), pro = lab ? proColorName(lab.L, lab.a, lab.b) : null;
        return Object.assign({}, e, { lab, pro, fam: pro ? pro.fam : null, proIdx: pro ? PRO_COLOR_NAMES.findIndex(n => n[0] === pro.ko) : 999 });
    });
}
function dictChipClick(event) {
    const btn = event.target.closest('button[data-v]');
    const box = btn && btn.closest('.dict-chips');
    if (!box) return;
    const set = dictSel[box.dataset.k];
    if (set.has(btn.dataset.v)) set.delete(btn.dataset.v); else set.add(btn.dataset.v);
    renderColorDict();
}
function resetDictFilters() {
    DICT_KEYS.forEach(k => { dictSel[k] = new Set(); });
    const q = document.getElementById('dictQuery'); if (q) q.value = '';
    renderColorDict();
}
function dictSortChange(v) { dictSort = DICT_SORTS[v] ? v : 'name'; renderColorDict(); }
function renderColorDict() {
    const out = document.getElementById('dictOut');
    if (!out) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const all = dictEntries();
    const famDot = f => { const n = PRO_COLOR_NAMES.filter(x => x[5] === f); const m = n[Math.floor(n.length / 2)]; return (window.RoomColor && RoomColor.labToHex) ? RoomColor.labToHex(m[2], m[3], m[4]) : ''; };
    const opts = {
        fam: Object.keys(PRO_FAM_LABELS).filter(f => all.some(e => e.fam === f)).map(f => [f, PRO_FAM_LABELS[f], famDot(f)]),
        cat: [['drape', '겉지'], ['sheer', '속지'], ['blind', '블라인드']].filter(o => all.some(e => e.cat === o[0])),
        book: [...new Set(all.map(e => e.book))].sort((x, y) => x.localeCompare(y, 'ko')).map(b => [b, b])
    };
    document.querySelectorAll('.dict-chips').forEach(box => {
        const k = box.dataset.k;
        dictSel[k].forEach(v => { if (!opts[k].some(o => o[0] === v)) dictSel[k].delete(v); });
        box.innerHTML = opts[k].map(o => `<button type="button" class="finder-chip" data-v="${esc(o[0])}" aria-pressed="${dictSel[k].has(o[0])}">${o[2] ? `<i style="background:${o[2]}"></i>` : ''}${esc(o[1])}</button>`).join('');
    });
    // 글자 검색: 새 이름(한글·영어) · 책자 색 이름 · 원단 · 책자 · 번호
    const q = ((document.getElementById('dictQuery') || {}).value || '').toLowerCase();
    const words = [];
    q.split(/\s+/).filter(Boolean).forEach(w => { const m = /^(\D+)(\d+)$/.exec(w); if (m) words.push(m[1], m[2]); else words.push(w); });
    let list = all.filter(e => {
        if (dictSel.fam.size && !dictSel.fam.has(e.fam)) return false;
        if (dictSel.cat.size && !dictSel.cat.has(e.cat)) return false;
        if (dictSel.book.size && !dictSel.book.has(e.book)) return false;
        if (!words.length) return true;
        const hay = `${e.pro ? e.pro.ko + e.pro.en : ''}${e.label}${e.fabName}${e.book}${e.fabricId}`.toLowerCase().replace(/\s+/g, '');
        const isNo = /^\d+$/.test(e.color);
        return words.every(w => (/^\d+$/.test(w) && isNo) ? parseInt(w, 10) === parseInt(e.color, 10) : hay.includes(w));
    });
    const byBook = (x, y) => `${x.book} ${x.fabName}`.localeCompare(`${y.book} ${y.fabName}`, 'ko') || colorSort({ name: x.color }, { name: y.color });
    const Lof = e => e.lab ? e.lab.L : null;
    const byL = dir => (x, y) => (Lof(x) == null || Lof(y) == null) ? ((Lof(x) == null) - (Lof(y) == null)) || byBook(x, y) : (dir * (Lof(x) - Lof(y))) || byBook(x, y);
    if (dictSort === 'book') list.sort(byBook);
    else if (dictSort === 'dark') list.sort(byL(1));
    else list.sort(byL(-1));
    const sortSel = document.getElementById('dictSort');
    if (sortSel) { sortSel.innerHTML = Object.keys(DICT_SORTS).map(k => `<option value="${k}">${DICT_SORTS[k]}</option>`).join(''); sortSel.value = dictSort; }
    const names = new Set(list.filter(e => e.pro).map(e => e.pro.ko));
    const cnt = document.getElementById('dictCount');
    if (cnt) cnt.innerHTML = `<b class="font-serif-kr">${finderColorTotal(list)}색</b><small>이름 ${names.size}가지 · ${finderFabricTotal(list)}개 원단 · 전체 ${finderColorTotal(all)}색${finderNoColorNote(list)}</small>`;
    if (!all.length) { out.innerHTML = '<div class="finder-empty">보여 줄 원단이 없어요.<br>설정에서 단가표나 비공개 팩을 먼저 불러와 주세요.</div>'; return; }
    if (!list.length) { out.innerHTML = '<div class="finder-empty">조건에 맞는 색이 없어요.<br>조건을 하나씩 빼 보세요.</div>'; return; }
    const num = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
    const grouped = dictSort === 'name';      // 이름별 묶음이면 카드 제목은 원단·번호 (이름은 묶음 머리줄에 있으니 되풀이하지 않음)
    const card = e => {
        const p = e.pro, hex = e.hex || (e.lab && window.RoomColor ? RoomColor.labToHex(e.lab.L, e.lab.a, e.lab.b) : '');
        // 원단 한 줄: "코아 풀달 01 (화이트)" — 괄호 안은 책자에 적힌 색 이름 (견적서 "풀달 1번 (화이트)"와 같은 모양, 10-17 사장님: "책자 이름 ○○"이 헷갈림)
        //  색이 하나뿐인 원단(포아 POA1 등)은 번호를 붙이지 않음
        const where = ((e.color && getFabricColors(e.fabricId).length > 1) ? `${e.book} ${e.fabName} ${e.no}` : `${e.book} ${e.fabName}`) + (e.label ? ` (${e.label})` : '');
        const code = e.lab ? `${(hex || '').toUpperCase()} · L ${num(e.lab.L)} a ${num(e.lab.a)} b ${num(e.lab.b)}` : '색 값 없음';
        return `<article class="finder-card dict-card">
            <div class="finder-sw"><div class="finder-sw-track"><div class="finder-sw-page${hex ? '' : ' is-none'}"${hex ? ` style="background:${hex}"` : ''}>${hex ? '' : '<span>색 값 없음</span>'}</div></div></div>
            <div class="finder-head"><span class="finder-head-txt">
                <span class="finder-name">${grouped ? esc(where) : (p ? `${esc(p.ko)} <em class="dict-en">${esc(p.en)}</em>` : '이름 없음')}</span>
                <span class="finder-meta">${grouped ? '' : esc(where) + '<br>'}<span class="dict-code">${esc(code)}</span></span>
            </span></div>
        </article>`;
    };
    if (dictSort !== 'name') { out.innerHTML = '<div class="finder-grid dict-grid">' + list.map(card).join('') + '</div>'; return; }
    // 이름별로 묶기: 표 순서(계열 → 밝은 것부터)대로, 묶음 안은 밝은 순. 같은 이름 = 책자가 달라도 가까운 색
    const groups = new Map();
    list.forEach(e => { const k = e.pro ? e.pro.ko : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    const keys = [...groups.keys()].sort((x, y) => (x ? PRO_COLOR_NAMES.findIndex(n => n[0] === x) : 999) - (y ? PRO_COLOR_NAMES.findIndex(n => n[0] === y) : 999));
    out.innerHTML = keys.map(k => {
        const g = groups.get(k), n = k ? PRO_COLOR_NAMES.find(x => x[0] === k) : null;
        const sw = n && window.RoomColor ? RoomColor.labToHex(n[2], n[3], n[4]) : '';
        const books = [...new Set(g.map(e => e.book))];
        return `<section class="dict-group">
            <h4 class="dict-group-h">${sw ? `<i style="background:${sw}"></i>` : ''}<b class="font-serif-kr">${n ? esc(n[0]) : '색 값 없음'}</b>${n ? `<em>${esc(n[1])} · ${PRO_FAM_LABELS[n[5]]}</em>` : ''}<small>${g.length}색 · 책자 ${books.length}개 (${esc(books.join(', '))})</small></h4>
            <div class="finder-grid dict-grid">${g.map(card).join('')}</div>
        </section>`;
    }).join('');
}

