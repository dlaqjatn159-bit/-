(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['color-pick.js']='20261267';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// color-pick.js — 4막 커튼 원단 고르기 새 화면 (189번): 속지 "빛 한 장" · 겉지 "색 한 장" → 열림(왼쪽 밝은 띠 + 사진) → 고름(띠가 오른쪽으로 건너가며 어두워짐)
//  자리·원단은 data.js 세 자리 엔진(seatSheer · seatDrape, 188번). 블라인드와 벽·바닥 색을 못 잰 겉지는 옛 화면(고르고 있습니다 → 원단 카드) 그대로
//  concierge.js가 부르는 것: wants(칸) · html() · after() · back() · finishHtml(공간) — "3.5-Bridge"·"6-Finish" 화면과 뒤로 가기에서. fabric-pick.js 다음에 읽힘
//  근거: Claude outputs/노트상세 189_시안_정할것_1108_Claude.md, 시안 원단고르기_189_새화면_시안.html

(function() {
    const cz = window.conciergeCore;      // concierge.js와 잇는 다리 (130-4)
    const { state, getLiveDb, roomHasLab } = cz;

    // ---- 손님 화면 낱말 (189번) ----
    const SHEER_NAME = { light: '많이 비침', medium: '은은한 비침', day: '낮 가림', heavy: '중지' };
    const SHEER_DENSITY = { light: '많이 비침', medium: '은은한 비침', day: '낮 가림', heavy: '거의 안 비침' };      // 원단 사실 한 줄 (data.js DENSITY_LABELS와 같음)
    const SHEER_GRAIN = { linen: '린넨', natural: '짜임이 보이는 질감', smooth: '매끈한 질감' };
    const DRAPE_TEX = { smooth: '매끈한 질감', natural: '짜임이 보이는 질감', cozy: '도톰하고 포근한 질감' };      // fabric-pick.js diffTexWord와 같음
    const DRAPE_BLOCK = { none: '빛 스밈', mid: '반쯤 가림', life: '생활 암막', full: '완전 암막' };              // fabric-pick.js diffLightWord와 같음
    // 이유 한 줄 (189번, 11-08 사장님 확인: 시안의 추천안)
    const WHY = {
        sheer: {
            light: '바깥 풍경이 또렷이 비쳐, 낮에 창이 가장 환합니다.',
            medium: '바깥의 형태는 보이고, 흐리게 번집니다.',
            day: '낮에는 밖에서 안이 보이지 않고, 빛은 들어옵니다.',
            heavy: '속지 가운데 가장 도톰해, 저녁 불을 켜도 안이 흐릿합니다.'
        },
        calm: {      // 넓게 · 고요하게 · 아늑하게 (색채학 4-8-2)
            light: '벽 쪽으로 한 톤 밝아, 창 쪽이 트여 보입니다.',
            lightWhite: '벽과 같은 흰빛이라, 창 쪽이 트여 보입니다.',      // 흰 벽 집: 벽 밝기 90 이상이고 이 색이 85 이상일 때만 (5-9-2)
            mid: '벽과 바닥 사이 색이라, 가장 고요하게 스며듭니다.',
            deep: '바닥 쪽으로 한 톤 내려, 창가가 아늑해집니다.'
        },
        weight: {
            warm: '공간보다 짙고 따뜻한 쪽이라, 창가가 묵직하고 포근해 보입니다.',
            house: '이 집의 빛깔 그대로 짙어져, 공간에 차분한 무게를 잡아 줍니다.',
            cool: '공간보다 짙고 차가운 쪽이라, 창가가 단정하게 가라앉아 보입니다.'
        },
        point: {      // 색 있는 집 = 기법 효과 (1109f)
            tint: '공간과 같은 빛깔을 한층 짙게, 튀지 않고 깊어지는 포인트입니다.',
            analog: '공간 색의 옆자리 색이라, 자연스럽게 눈이 가는 포인트입니다.',
            sat: '공간보다 맑은 색이라, 같은 결 안에서 또렷해집니다.',
            split: '공간의 반대쪽 곁 색이라, 또렷하지만 부딪히지 않습니다.',
            comp: '공간의 반대편 색이라, 창이 가장 먼저 눈에 들어옵니다.'
        },
        pointGray: {      // 무채색·중성 집 (1109g). "회색이 맑아 보입니다"는 실물 시험 뒤
            warm: '회색 공간이라, 흐린 색 하나로도 창에 온기가 생깁니다.',
            cool: '회색 공간이라, 흐린 색 하나로도 창이 맑아집니다.',
            tint: '회색 공간이라, 흐린 색 하나로도 창에 빛깔이 생깁니다.',
            opp: '공간과 반대 기운의 색이라, 창이 또렷해집니다.',
            value: '공간보다 짙은 색이라, 창이 먼저 눈에 들어옵니다.'
        }
    };
    const HONEST_SCENE = '창밖은 예시 사진입니다.';
    const PHOTO_MISSING = '사진을 찍기 전이라 잰 색으로 보여 드립니다.';
    // "왜 이 셋인가요" 지도의 글 (190번). 둘째 문장의 뒤는 최종 제안 "공간의 색과 빛"(ticket.js HOUSE_MAP_LEAD)과 같은 말
    const MAP_SAY = {
        calm: w => `${w} 모두 선 가까이 있고, 밝기만 다릅니다.`,
        weight: w => `${w} 모두 선보다 짙은 쪽에 있고, 따뜻한 정도만 다릅니다.`,
        point: w => `${w} 모두 선에서 벗어난 쪽이라, 창 쪽의 포인트가 됩니다.`
    };
    const MAP_LEAD = '선은 이 공간의 벽 색과 바닥 색을 잇습니다. 커튼이 선 가까이 있으면 벽과 바닥을 자연스럽게 잇고, 선에서 멀어지면 무게나 포인트가 됩니다.';
    const SCENE_PHOTO = 'photos/scene/window_view.jpg';      // 속지 빛 한 장 바탕 (예시 창밖 사진)
    const SHEER_BLUR = { light: 3, medium: 10, day: 18, heavy: 26 };          // 창밖이 흐려지는 정도(px)
    const SHEER_VEIL = { light: 0.3, medium: 0.58, day: 0.78, heavy: 0.88 };  // 원단 색이 덮는 정도
    const SWIPE_PX = 80;      // 사진을 이만큼 밀면 다음 원단
    const PUSH_MS = 1100;     // 속지 → 겉지 전환(띠가 되밀기)
    const ARROW = '<svg width="34" height="14" viewBox="0 0 34 14" aria-hidden="true"><path d="M0 7h32m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.25"></path></svg>';

    // ---- 작은 도구 ----
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function hexL(hex) {      // 밝기(Lab L)만
        const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return 50;
        const n = parseInt(m[1], 16), lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const y = 0.2126 * lin(n >> 16 & 255) + 0.7152 * lin(n >> 8 & 255) + 0.0722 * lin(n & 255);
        return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
    }
    const inkOn = hex => hexL(hex) > 58 ? 'var(--ink)' : 'var(--on-band)';      // 색 면 위 글자: 밝으면 먹색, 어두우면 밝은 글자
    const deepOf = hex => (window.RoomColor && RoomColor.doneBandHex && RoomColor.doneBandHex(hex)) || '#2e2924';      // 정해진 띠 (187번)
    const fabOf = id => getLiveDb().find(f => f.id === id) || {};
    function fabName(id, color) {      // "넥스 4" — 책자 이름·괄호를 뺀 원단 이름 + 색 번호. 이름이 번호로 끝나면(POA8) 이름만
        const f = fabOf(id);
        let n = String(f.name || id).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
        const book = String(f.book || '').trim();
        if (book && n.startsWith(book + ' ')) n = n.slice(book.length).trim();
        return (!color || new RegExp(String(color).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(n)) ? n : n + ' ' + color;
    }
    const bookLine = id => { const b = String(fabOf(id).book || '').trim(); return b ? b + ' 책자' : ''; };
    function colorHex(id, color) {
        const c = (typeof getFabricColors === 'function' ? getFabricColors(id) : []).find(x => x.name === color);
        return (c && c.hex) || '';
    }
    // 같은 원단 한 톤 짙은 색 (색채학 3-8-2): 밝기 4~13 아래 · 색 기운(a·b) 차이 6 안 · 기운이 가장 같고 밝기는 7쯤 아래
    function darkerPair(id, color) {
        const cols = (typeof getFabricColors === 'function' ? getFabricColors(id) : []).filter(c => typeof c.light === 'number' && typeof c.a === 'number' && typeof c.b === 'number');
        const me = cols.find(c => c.name === color); if (!me) return null;
        const dab = c => Math.hypot(c.a - me.a, c.b - me.b);
        return cols.filter(c => c.light < me.light - 3 && c.light > me.light - 14 && dab(c) <= 6)
            .sort((x, y) => (dab(x) + 0.3 * Math.abs(me.light - x.light - 7)) - (dab(y) + 0.3 * Math.abs(me.light - y.light - 7)))[0] || null;
    }

    // ---- 지금 칸과 엔진 결과 ----
    const cur = () => state.pendingItemQueue[state.currentItemIndex] || {};
    function presOf(ed) {      // 느낌: 이 공간만 다르게 고른 값 → 집 값
        if (ed && ed.ownTaste && ed.ownPres) return ed.ownPres;
        const ht = (typeof getHouseTaste === 'function') ? getHouseTaste() : {};
        return (ht && ht.pres) || null;
    }
    function result(item) {
        const ed = state.editingRoom;
        if (!ed || !item) return null;
        const room = cz.roomWithTaste ? cz.roomWithTaste(ed) : ed;
        try {
            if (item.presetType === 'sheer') {
                const r = typeof seatSheer === 'function' ? seatSheer(room) : null;
                return r && r.cards && r.cards.length ? { kind: 'sheer', list: r.cards, at: r.at || 0 } : null;
            }
            if (item.presetType === 'drape') {
                if (!roomHasLab(ed)) return null;
                if (presOf(ed) === 'point' && typeof seatDrapeTechs === 'function') {      // 220번: 포인트는 방식 묶음. 방식이 둘 이상이면 맨 끝에 '맡길게요' 묶음(모든 방식의 원단, 방식 차례)
                    const t = seatDrapeTechs(room);
                    if (!t) return null;
                    const list = t.seats.slice();
                    if (list.length > 1) {
                        const seen = new Set(), fabrics = [];
                        list.forEach(y => y.fabrics.forEach(f => { const k = f.id + '__' + f.color; if (!seen.has(k)) { seen.add(k); fabrics.push(f); } }));
                        list.push({ key: 'all', all: true, name: '', hex: list[0].hex, L: list[0].L, a: list[0].a, b: list[0].b, tech: null, n: fabrics.length, fabrics });
                    }
                    return { kind: 'drape', list, at: 0, house: t.house, feel: 'point', tech: true };
                }
                const r = typeof seatDrape === 'function' ? seatDrape(room, presOf(ed)) : null;
                return r && r.seats && r.seats.length ? { kind: 'drape', list: r.seats, at: r.at || 0, house: r.house, feel: r.feel } : null;
            }
        } catch (e) { return null; }
        return null;
    }
    // 이 칸을 새 화면으로 고르는지 (속지는 늘, 겉지는 벽·바닥 색과 느낌이 있을 때. 블라인드는 옛 화면)
    function wants(item) { return !!result(item || cur()); }

    // ---- 화면 상태 (공간·칸마다) ----
    function cp() {
        const key = (state.editingRoomId || '') + '_' + state.currentItemIndex;
        if (!state.cp || state.cp.key !== key) {
            const r = result(cur()), it = cur();
            const s = { key, view: (r && r.tech && r.list.some(y => y.all)) ? 'ask' : 'sheet', seat: r ? r.at : 0, fab: 0, alt: null, anim: false, chip: 0 };      // 220번: 포인트는 방식 질문부터(방식이 하나면 설명 한 장부터)
            // 이미 고른 원단이 있으면(뒤로 와서·다시 상담) 그 자리·그 원단을 고른 모습으로
            // 167번 둘째 줄: 첫 줄 원단이 들어 있는 자리를 첫 장으로
            const pin = it.fabricId ? { fabricId: it.fabricId, colorName: it.colorName }
                : (state.editingRoom && state.editingRoom.altPins && state.editingRoom.altPins[it.presetType]) || null;
            if (r && pin) {
                const find = same => r.list.some((x, i) => {
                    const j = x.fabrics.findIndex(f => f.id === pin.fabricId && (!same || !pin.colorName || f.color === pin.colorName));
                    if (j < 0) return false;
                    s.seat = i; s.fab = j;
                    if (!same && pin.colorName && x.fabrics[j].color !== pin.colorName) s.alt = { name: pin.colorName, hex: colorHex(pin.fabricId, pin.colorName) };      // "한 톤 짙게"로 고른 색
                    if (it.fabricId) s.view = 'picked';
                    return true;
                });
                if (!find(true)) find(false);
            }
            state.cp = s;
        }
        return state.cp;
    }
    function seatNow() { const r = result(cur()), s = cp(); return r ? r.list[Math.min(s.seat, r.list.length - 1)] : null; }
    function fabNow() {
        const seat = seatNow(), s = cp(); if (!seat) return null;
        const base = seat.fabrics[Math.min(s.fab, seat.fabrics.length - 1)];
        return s.alt ? Object.assign({}, base, { color: s.alt.name, hex: s.alt.hex || colorHex(base.id, s.alt.name) }) : base;
    }
    function seatName(r, x) { return r.kind === 'sheer' ? SHEER_NAME[x.key] : x.name; }
    function whyOf(r, x, room) {      // room (194번): 최종 제안에서 부를 때 그 공간. 없으면 지금 고르는 공간
        if (r.kind === 'sheer') return WHY.sheer[x.key] || '';
        if (r.feel === 'calm') {
            const rm = room || state.editingRoom, mc = rm && rm.measuredColor;
            if (x.key === 'light' && mc && mc.wall && mc.wall.L >= 90 && x.L >= 85) return WHY.calm.lightWhite;
            return WHY.calm[x.key] || '';
        }
        if (r.feel === 'weight') return WHY.weight[x.key] || '';
        return (r.house === 'color' ? WHY.point : WHY.pointGray)[x.tech] || WHY.point[x.tech] || WHY.pointGray[x.tech] || '';
    }
    const door = (txt, on, extra) => `<button type="button" class="cp-door" onclick="${on}"${extra || ''}>${esc(txt)}${ARROW}</button>`;

    // ---- 그리기 ----
    function html() {
        const r = result(cur()); if (!r) return '';
        const s = cp();
        if (s.view === 'ask') return askHtml(r);      // 220번
        if (s.view === 'open') return openHtml(r);
        if (s.view === 'picked') return pickedHtml(r);
        if (s.view === 'map') return mapHtml(r);      // 190번
        return sheetHtml(r);
    }
    // 220번: 포인트 방식 질문 — 블라인드와 같은 질문·같은 틀(concierge.js askStage). 방식 이름은 손님 화면에도 그대로(11-11 결정)
    function askHtml(r) {
        const s = cp(), picked = !!cur().fabricId;
        return cz.askStage('포인트는 어떤 방식으로 주실까요?', '', r.list.map((y, i) => y.all
            ? { label: '맡길게요', quiet: true, on: `window.concierge.cpTech(${i})`, was: picked && i === s.seat }
            : { label: esc(y.name), on: `window.concierge.cpTech(${i})`, was: picked && i === s.seat }));
    }
    // 220번: 방식 설명 한 장의 색 칩 — 그 방식의 커튼 원단 묶음에서(서로 색 차 8 이상, 다섯까지). i = 그 색 원단의 차례
    function chipsOf(x) {
        const out = [];
        ((x && x.fabrics) || []).forEach((f, i) => {
            if (out.length >= 5 || !f.hex) return;
            if (out.some(p => Math.hypot(p.L - f.L, p.a - f.a, p.b - f.b) < 8)) return;
            out.push({ hex: f.hex, L: f.L, a: f.a, b: f.b, i });
        });
        return out;
    }
    // 한 장: 속지 = 창밖이 비침만큼 흐려지고 원단 색이 덮음 / 겉지 = 화면 전체가 그 색(포인트만 벽·바닥 테두리)
    function sheetHtml(r) {
        const s = cp(), x = r.list[Math.min(s.seat, r.list.length - 1)];
        if (r.tech) {      // 220번: 포인트 방식 설명 한 장 — 벽 바탕 · 커튼 색 면 · 바닥 띠 + 색 칩(누르면 면 색이 바뀜) → "이 방식으로" → 바로 원단 사진
            const chips = chipsOf(x), k = Math.max(0, Math.min(s.chip || 0, chips.length - 1)), face = (chips[k] && chips[k].hex) || x.hex || '#efece6', ink = inkOn(face);
            const chipRow = chips.length > 1 ? `<div class="pt-chips">${chips.map((c, i) => `<button type="button" class="pt-chip${i === k ? ' is-on' : ''}" aria-label="색 ${i + 1}" style="background:${c.hex}" onclick="concierge.cpChip(${i})"></button>`).join('')}</div><span class="pt-cap">이 방식으로 고를 수 있는 색</span>` : '';
            const other = r.list.some(y => y.all) ? `<button type="button" class="cp-map-link" onclick="concierge.cpAsk()">다른 방식 보기</button>` : '';
            const mcT = state.editingRoom.measuredColor || {};
            return `<div class="cp-stage cp-sheet cp-framed" style="background:${(mcT.wall && mcT.wall.hex) || '#eee9e0'};color:${ink}">
            <i class="cp-frame-in" style="background:${face}"></i><i class="cp-frame-floor" style="background:${(mcT.floor && mcT.floor.hex) || '#b98a5e'}"></i>
            <div class="cp-say"><h1 class="cp-hero">${esc(x.name)}</h1><p class="cp-why">${esc((typeof POINT_TECH_DESC !== 'undefined' && POINT_TECH_DESC[x.key]) || '')}</p>${chipRow}${other}</div>
            <div class="cp-door-at">${door('이 방식으로', 'concierge.cpOpen()')}</div></div>`;
        }
        const names = r.list.length > 1 ? `<div class="cp-names">${r.list.map((y, i) =>
            `<button type="button" class="${i === s.seat ? 'is-on' : ''}" onclick="concierge.cpSeat(${i})">${esc(seatName(r, y))}</button>`).join('')}</div>` : '';      // 한 장뿐이면 이름 줄 없음
        const f0 = x.fabrics[0] || {};
        const n = x.fabrics.length;
        const doorTxt = n === 1 ? fabName(f0.id, f0.color) : `원단 ${n}가지 보기`;      // 원단이 하나면 그 원단 이름
        // 190번: 겉지 자리가 둘 이상이면 이유 한 줄 아래 작은 글 "왜 이 셋인가요"(두 장이면 "왜 이 둘인가요") → 지도. 한 장·속지는 없음
        const mapLink = r.kind === 'drape' && r.list.length > 1 ? `<button type="button" class="cp-map-link" onclick="concierge.cpMap()">${r.list.length === 2 ? '왜 이 둘인가요' : '왜 이 셋인가요'}</button>` : '';
        const near = r.kind === 'drape' && x.near ? `<p class="cp-why">${esc('딱 맞는 ' + x.near + ' 원단은 아직 없습니다. 가장 가까운 색입니다.')}</p>` : '';      // 209번 (11-09 사장님)
        const say = `<div class="cp-say"><h1 class="cp-hero">${esc(seatName(r, x))}</h1><p class="cp-why">${esc(whyOf(r, x))}</p>${near}${mapLink}</div>`;
        if (r.kind === 'sheer') {
            const tint = f0.hex || '#efece6';
            return `<div class="cp-stage cp-sheet" style="background:${tint};color:var(--ink)">
                <img class="cp-scene" src="${SCENE_PHOTO}" alt="" style="filter:blur(${SHEER_BLUR[x.key] || 10}px)">
                <i class="cp-veil" style="background:${tint};opacity:${SHEER_VEIL[x.key] || 0.6}"></i>
                ${names}${say}<div class="cp-door-at">${door(doorTxt, 'concierge.cpOpen()')}</div>
                <span class="cp-honest">${HONEST_SCENE}</span></div>`;
        }
        const col = inkOn(x.hex);
        if (r.feel !== 'point') return `<div class="cp-stage cp-sheet" style="background:${x.hex};color:${col}">${names}${say}<div class="cp-door-at">${door(doorTxt, 'concierge.cpOpen()')}</div></div>`;
        const mc = state.editingRoom.measuredColor || {};
        return `<div class="cp-stage cp-sheet cp-framed" style="background:${(mc.wall && mc.wall.hex) || '#eee9e0'};color:${col}">
            <i class="cp-frame-in" style="background:${x.hex}"></i><i class="cp-frame-floor" style="background:${(mc.floor && mc.floor.hex) || '#b98a5e'}"></i>
            ${names}${say}<div class="cp-door-at">${door(doorTxt, 'concierge.cpOpen()')}</div></div>`;
    }
    // "왜 이 셋인가요" (190번): 종이 위에 최종 제안 "공간의 색과 빛"과 같은 지도(ticket.js drawHouseMap) — 이 공간의 벽·바닥과 선, 세 자리 조각만 진하게, 나머지 원단 색은 흐린 점
    //  조각을 누르면 그 색 한 장으로, ← 는 보던 색 한 장으로
    function mapHtml(r) {
        const word = r.list.length === 2 ? '두 색' : '세 색';
        return `<div class="cp-stage cp-map" style="background:var(--paper-sheet);color:var(--ink)">
            <canvas class="cp-map-cv" width="1800" height="1040" aria-label="벽과 바닥, ${word}의 자리"></canvas>
            <div class="cp-map-say"><p class="cp-map-ttl">${esc((MAP_SAY[r.feel] || MAP_SAY.calm)(word))}</p><p class="cp-map-lead">${esc(MAP_LEAD)}</p></div></div>`;
    }
    function drawMap(stage, r) {
        const cv = stage.querySelector('.cp-map-cv'), ed = state.editingRoom;
        if (!cv || !r || !ed || typeof drawHouseMap !== 'function') return;
        const mc = ed.measuredColor || {};
        const part = k => (mc[k] && typeof mc[k].L === 'number' && mc[k].hex) ? { L: mc[k].L, a: mc[k].a, b: mc[k].b, hex: String(mc[k].hex).toUpperCase(), name: typeof matNameOf === 'function' ? matNameOf(k, mc[k]) : '' } : null;
        const sp = [{ name: ed.name || '', wall: part('wall'), floor: part('floor'), fur: [], fabs: [] }];
        const seats = r.list.map(x => ({ hex: x.hex, L: x.L, a: x.a, b: x.b, name: x.name }));
        const taken = new Set(r.list.map(x => String(x.hex).toUpperCase()));
        const room = cz.roomWithTaste ? cz.roomWithTaste(ed) : ed;
        const dots = (typeof seatPoolColors === 'function' ? seatPoolColors('겉지', room) : [])      // 세 자리를 고른 것과 같은 원단(빛 가림으로 거른 뒤)
            .filter(c => c.hex && !taken.has(String(c.hex).toUpperCase())).map(c => ({ hex: c.hex, L: c.L, b: c.b }));
        const ctx = cv.getContext('2d');
        ctx.save(); ctx.scale(2, 2); ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, 900, 520);
        const hits = (drawHouseMap(ctx, sp, '#fffdf9', { sel: 0, seats, dots }) || []).filter(q => typeof q.seat === 'number');
        ctx.restore();
        cv.addEventListener('click', e => {      // 세 자리 조각(둘레 16 넉넉히)을 누르면 그 색 한 장으로 (지도 좌표 900×520)
            const b = cv.getBoundingClientRect(), x = (e.clientX - b.left) * 900 / b.width, y = (e.clientY - b.top) * 520 / b.height;
            const hit = hits.find(q => x >= q.x1 - 16 && x <= q.x2 + 16 && y >= q.y1 - 16 && y <= q.y2 + 16);
            if (!hit) return;
            const s = cp(); s.seat = hit.seat; s.fab = 0; s.alt = null; s.view = 'sheet'; rerender();
        });
    }
    // 열림: 왼쪽 360px 밝은 띠(그 원단의 잰 색) + 사진. 사진은 손으로 밀거나 ‹ › 로 바꿈
    function openHtml(r) {
        const s = cp(), x = r.list[Math.min(s.seat, r.list.length - 1)], f = fabNow(), fab = fabOf(f.id), band = f.hex || '#efece6';
        const facts = r.kind === 'sheer' ? [SHEER_GRAIN[f.grain], SHEER_DENSITY[fab.density]] : [DRAPE_TEX[fab.texture], DRAPE_BLOCK[blackoutKey(fab)]];
        const pair = r.kind === 'drape' && !s.alt ? darkerPair(f.id, f.color) : null;
        const base = s.alt ? x.fabrics[Math.min(s.fab, x.fabrics.length - 1)] : null;
        const groups = groupsOf(r, x), many = x.fabrics.length > 1;
        return `<div class="cp-stage cp-open">
            <div class="cp-photo" style="background:${band}"><img class="cp-img" data-id="${esc(f.id)}" data-color="${esc(f.color)}" alt=""><span class="cp-missing" hidden style="color:${inkOn(band)}">${PHOTO_MISSING}</span></div>
            <div class="cp-swipe"></div>
            ${many ? `<button type="button" class="cp-arrow is-prev" aria-label="앞 원단" onclick="concierge.cpStep(-1)">‹</button><button type="button" class="cp-arrow is-next" aria-label="다음 원단" onclick="concierge.cpStep(1)">›</button>` : ''}
            <div class="cp-door-at cp-on-photo">${door('이 원단으로', 'concierge.cpPick()')}</div>
            <div class="cp-strip" style="background:${band};color:${inkOn(band)}">
                <div class="cp-fabric">
                    <span class="cp-book">${esc(bookLine(f.id))}</span>
                    <span class="cp-name">${esc(fabName(f.id, f.color))}</span>
                    ${facts.filter(Boolean).map(t => `<span class="cp-fact">${esc(t)}</span>`).join('')}
                    ${(typeof fabricTraitOf === 'function' && fabricTraitOf(f.id)) ? `<span class="cp-fact">${esc(fabricTraitOf(f.id))}</span>` : ''}
                    ${pair ? `<button type="button" class="cp-pair" onclick="concierge.cpAlt('${esc(pair.name)}')"><i class="cp-thumb" data-id="${esc(f.id)}" data-color="${esc(pair.name)}" style="background-color:${pair.hex || band}"></i><span>한 톤 짙게 · ${esc(fabName(f.id, pair.name))}</span></button>` : ''}
                    ${base ? `<button type="button" class="cp-pair" onclick="concierge.cpAlt('')"><i class="cp-thumb" data-id="${esc(base.id)}" data-color="${esc(base.color)}" style="background-color:${base.hex || band}"></i><span>← ${esc(fabName(base.id, base.color))}</span></button>` : ''}
                </div>
                ${many ? `<div class="cp-thumbs">${groups.map(gr => `<div class="cp-row">${gr.map(i => { const y = x.fabrics[i];
                    return `<button type="button" class="cp-thumb${i === s.fab && !s.alt ? ' is-on' : ''}" aria-label="${esc(fabName(y.id, y.color))}" data-id="${esc(y.id)}" data-color="${esc(y.color)}" style="background-color:${y.hex || band}" onclick="concierge.cpFab(${i})"></button>`; }).join('')}</div>`).join('')}</div>` : ''}
            </div></div>`;
    }
    // 고름: 사진은 왼쪽, 띠는 오른쪽으로 건너가며 같은 기운 그대로 어두워짐(Lab 밝기 24). 띠 안: 자리 이름(고른 것에 밝은 점) · 책자 · 원단 · 사실 · 다른 원단 보기 · 다음 → · 220번: 맡길게요는 원단의 방식 이름
    function pickedHtml(r) {
        const s = cp(), x = r.list[Math.min(s.seat, r.list.length - 1)], f = fabNow(), fab = fabOf(f.id), band = f.hex || '#efece6';
        const facts = r.kind === 'sheer' ? [SHEER_GRAIN[f.grain], SHEER_DENSITY[fab.density]] : [DRAPE_TEX[fab.texture], DRAPE_BLOCK[blackoutKey(fab)]];
        const moving = s.anim;      // 방금 "이 원단으로"를 누름 → 열림 자리에서 시작해 건너감
        return `<div class="cp-stage cp-picked${moving ? ' is-start' : ''}">
            <div class="cp-photo" style="background:${band}"><img class="cp-img" data-id="${esc(f.id)}" data-color="${esc(f.color)}" alt=""></div>
            <div class="cp-strip cp-dark" style="background:${moving ? band : deepOf(band)};color:${moving ? inkOn(band) : 'var(--on-band)'}" data-deep="${deepOf(band)}">
                <div class="cp-list">${r.list.filter(y => !y.all).map(y => { const on = y === x || (!!x.all && y.key === f.tech); return `<span class="${on ? 'is-on' : ''}">${on ? '<i></i>' : ''}${esc(seatName(r, y))}</span>`; }).join('')}</div>
                <div class="cp-fabric">
                    <span class="cp-book">${esc(((x.all && typeof POINT_TECH_TERM !== 'undefined' && POINT_TECH_TERM[f.tech]) || seatName(r, x)) + ' · ' + bookLine(f.id))}</span>
                    <span class="cp-name">${esc(fabName(f.id, f.color))}</span>
                    <span class="cp-fact">${esc(facts.filter(Boolean).join(' · '))}</span>
                    <span><button type="button" class="cp-link" onclick="concierge.cpOther()">다른 원단 보기</button></span>
                </div>
                <div class="cp-next">${door('다음', 'concierge.cpNext()')}</div>
            </div></div>`;
    }
    // 작은 사진 묶음(묶음 사이는 간격): 속지는 결마다, 포인트는 기법(색)마다, 나머지는 빛 가림 맞음 → 괜찮음 → 뒤.
    //  묶음은 처음 나온 차례, 묶음 안은 엔진 차례. 사진 밀기(‹ ›)도 이 차례를 따름
    function groupsOf(r, x) {
        const gk = y => r.kind === 'sheer' ? (y.grain || '') : (r.feel === 'point' ? (y.tech || '') : (y.fit || ''));
        const groups = [], at = {};
        x.fabrics.forEach((y, i) => { const k = gk(y); if (!(k in at)) { at[k] = groups.length; groups.push([]); } groups[at[k]].push(i); });
        return groups;
    }
    function blackoutKey(f) { return (typeof blackoutLevel === 'function' ? blackoutLevel(f) : f.blackout) || ''; }

    // ---- 그린 뒤 (concierge.js render 끝에서 부름) ----
    function after() {
        const btn = document.getElementById('v2FloatingPrevBtn');
        const stage = document.querySelector('.cp-stage');
        if (btn) { btn.classList.toggle('is-cp', !!stage); btn.style.color = ''; }
        if (!stage) return;
        const s = cp(), r = result(cur());
        // 뒤로(왼쪽 위 한 곳): 색 면 위에서는 그 면의 글자색. 열림에서는 "← 그 장 이름"(누르면 한 장으로)
        if (btn) {
            if (s.view === 'open') { btn.style.color = getComputedStyle(stage.querySelector('.cp-strip')).color; if (r) btn.textContent = '← ' + (seatName(r, r.list[Math.min(s.seat, r.list.length - 1)]) || '포인트 방식'); }      // 220번: 맡길게요 묶음은 이름이 없음
            else if (s.view === 'picked') btn.style.color = '#fff';
            else if (s.view === 'map') { btn.style.color = 'var(--ink)'; if (r) btn.textContent = '← ' + seatName(r, r.list[Math.min(s.seat, r.list.length - 1)]); }      // 190번: 지도에서 ← 는 보던 색 한 장으로
            else if (stage.classList.contains('cp-framed')) { const mcB = (state.editingRoom && state.editingRoom.measuredColor) || {}; btn.style.color = inkOn((mcB.wall && mcB.wall.hex) || '#eee9e0'); }      // 221번: 포인트 한 장은 ← 가 벽 띠 위에 있음 → 벽 색에 맞춘 글자색
            else btn.style.color = getComputedStyle(stage).color;
        }
        if (s.view === 'map') drawMap(stage, r);      // 190번
        // 사진: 원단 사진(기기에 넣은 보정 사진 → 앱 photos/) 주소를 찾아 넣음. 없으면 잰 색 + 한 줄
        stage.querySelectorAll('.cp-img').forEach(img => {
            cz.findPhoto(img.dataset.id, img.dataset.color).then(url => {
                if (!img.isConnected) return;
                if (url) { img.src = url; img.classList.add('is-in'); }
                else { const m = img.parentNode.querySelector('.cp-missing'); if (m) m.hidden = false; }
            });
        });
        stage.querySelectorAll('.cp-thumb[data-id]').forEach(el => {
            cz.findPhoto(el.dataset.id, el.dataset.color).then(url => { if (url && el.isConnected) el.style.backgroundImage = `url("${url}")`; });
        });
        // 한 장에서는 다음 화면(열림) 사진을 미리 받아 둠
        if (s.view === 'sheet' && r) { const x = r.list[Math.min(s.seat, r.list.length - 1)]; x.fabrics.slice(0, 6).forEach(f => cz.findPhoto(f.id, f.color)); }
        // 열림: 손으로 밀기
        const sw = stage.querySelector('.cp-swipe');
        if (sw) {
            let x0 = null, id = null;
            sw.addEventListener('pointerdown', e => { x0 = e.clientX; id = e.pointerId; try { sw.setPointerCapture(id); } catch (er) {} });
            sw.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > SWIPE_PX) step(dx < 0 ? 1 : -1); });
            sw.addEventListener('pointercancel', () => { x0 = null; });
        }
        // 고름: 다음 그림에서 건너감
        if (s.view === 'picked' && s.anim) {
            s.anim = false;
            const strip = stage.querySelector('.cp-strip');
            requestAnimationFrame(() => requestAnimationFrame(() => {
                stage.classList.remove('is-start');
                if (strip) { strip.style.background = strip.dataset.deep; strip.style.color = 'var(--on-band)'; }
            }));
        }
    }

    // ---- 누르기 ----
    function rerender() { cz.render(); }
    function step(d) {
        const r = result(cur()), seat = seatNow(), s = cp(); if (!r || !seat || seat.fabrics.length < 2) return;
        const order = [].concat(...groupsOf(r, seat)), k = order.indexOf(s.fab);
        s.fab = order[(k + d + order.length) % order.length]; s.alt = null; rerender();
    }
    // 뒤로 가기: 열림 → 한 장. 그 밖은 앱의 뒤로 가기 그대로 (concierge.js prevStep 맨 앞에서 부름)
    function back() {
        if (state.step !== '3.5-Bridge' || !document.querySelector('.cp-stage')) return false;
        const s = cp();
        if (s.view === 'open' || s.view === 'map') {      // 190번: 지도에서도 ← 는 한 장으로 · 220번: 맡길게요 묶음의 열림은 방식 질문으로
            const r0 = result(cur()), x0 = r0 && r0.list[Math.min(s.seat, r0.list.length - 1)];
            s.view = (x0 && x0.all) ? 'ask' : 'sheet'; s.alt = null; rerender(); return true;
        }
        if (s.view === 'sheet') {      // 220번: 방식 설명 한 장 → 방식 질문 (방식이 하나뿐이면 앱의 뒤로 가기)
            const r0 = result(cur());
            if (r0 && r0.tech && r0.list.some(y => y.all)) { s.view = 'ask'; rerender(); return true; }
        }
        return false;
    }
    // 다음: 칸에 적고 다음 칸으로(옛 pickQueueFabric 그대로). 속지 → 겉지는 띠가 그대로 왼쪽으로 밀고 나가며 겉지 색 한 장을 데려옴(D안)
    function next() {
        const f = fabNow(), it = cur(); if (!f) return;
        const nextItem = state.pendingItemQueue[state.currentItemIndex + 1];
        const push = it.presetType === 'sheer' && nextItem && nextItem.presetType === 'drape' && wants(nextItem)
            && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        const old = push ? document.querySelector('.cp-stage') : null;
        const ghost = old ? old.cloneNode(true) : null;
        state.cp = null;
        window.concierge.pickQueueFabric(f.id, f.color);
        if (!ghost) return;
        const fresh = document.querySelector('.cp-stage'), view = document.getElementById('v2Viewport');
        if (!fresh || !view) return;
        const wrap = fresh.closest('.stage-transition'); if (wrap) wrap.style.animation = 'none';
        ghost.classList.add('cp-ghost'); ghost.setAttribute('aria-hidden', 'true');
        view.appendChild(ghost);
        const ease = getComputedStyle(document.documentElement).getPropertyValue('--page-transition-ease').trim() || 'ease';
        const a = ghost.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }], { duration: PUSH_MS, easing: ease, fill: 'forwards' });
        fresh.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: PUSH_MS, easing: ease });
        a.onfinish = () => ghost.remove();
        setTimeout(() => { if (ghost.isConnected) ghost.remove(); }, PUSH_MS + 300);
    }
    Object.assign(window.concierge, {
        cpSeat: i => { const s = cp(); s.seat = i; s.fab = 0; s.alt = null; rerender(); },
        cpOpen: () => { const s = cp(); s.view = 'open'; s.alt = null; rerender(); },
        cpMap: () => { const s = cp(); s.view = 'map'; rerender(); },      // 190번: 왜 이 셋인가요
        cpFab: i => { const s = cp(); s.fab = i; s.alt = null; rerender(); },
        cpStep: d => step(d),
        cpAlt: name => { const s = cp(), f = seatNow() && seatNow().fabrics[s.fab]; s.alt = name && f ? { name, hex: colorHex(f.id, name) } : null; rerender(); },
        cpPick: () => {      // 이 원단으로: 칸에 바로 적고(다음을 누르기 전에 뒤로 가도 남게) 띠가 건너감
            const s = cp(), f = fabNow(), it = cur(); if (!f) return;
            it.fabricId = f.id; it.colorName = f.color;
            s.view = 'picked'; s.anim = true; rerender();
        },
        cpOther: () => { const s = cp(); s.view = 'open'; rerender(); },
        // 220번: 포인트 방식 — 방식 고르기(맡길게요 묶음은 바로 열림) · 방식 질문으로 · 색 칩(면 색과 열림 첫 원단을 그 색으로)
        cpTech: i => { const r = result(cur()), s = cp(), y = r && r.list[i]; if (!y) return; s.seat = i; s.fab = 0; s.chip = 0; s.alt = null; s.view = y.all ? 'open' : 'sheet'; rerender(); },
        cpAsk: () => { const s = cp(); s.view = 'ask'; s.alt = null; rerender(); },
        cpChip: i => { const s = cp(), c = chipsOf(seatNow())[i]; if (!c) return; s.chip = i; s.fab = c.i; s.alt = null; rerender(); },
        cpNext: () => next()
    });

    // ---- 마무리 (6-Finish, A안 띠가 남음): 오른쪽 어두운 띠에 이 공간에서 정한 속지·겉지 + "○○ 마치기 →" ----
    //  커튼 원단을 하나라도 색과 함께 골랐을 때만. 아니면 '' (옛 마무리 화면)
    function finishHtml(room) {
        const picked = (room && room.items || []).filter(i => (i.presetType === 'sheer' || i.presetType === 'drape') && i.fabricId && colorHex(i.fabricId, i.colorName));
        if (!picked.length) return '';
        const lead = picked.find(i => i.presetType === 'drape') || picked[0];
        const rows = picked.map(i => `<div class="cp-fin-row"><i style="background:${colorHex(i.fabricId, i.colorName)}"></i><span>${esc(fabName(i.fabricId, i.colorName))}</span></div>`).join('');
        return `<div class="cp-strip cp-dark cp-fin-band" style="background:${deepOf(colorHex(lead.fabricId, lead.colorName))};color:var(--on-band)">
            ${rows}<div class="cp-next">${door(room.name + ' 마치기', 'window.concierge.commitRoomCart()')}</div></div>`;
    }

    // 최종 제안 "공간의 색과 빛" 문장 (194번): 4막에서 손님이 본 이유 한 줄과 같은 말
    //  room = 저장된 공간(raw), kind = '속지'·'겉지', fabricId·colorName = 고른 원단. 자리를 못 찾으면 '' (ticket.js가 예전 문장으로)
    function whyLineFor(room, kind, fabricId, colorName) {
        try {
            if (!room || !fabricId) return '';
            if (kind === '속지') { const d = fabOf(fabricId).density; return (d && WHY.sheer[d]) || ''; }      // 빛 한 장의 장 = 원단 비침(density)
            if (kind !== '겉지') return '';
            const rm = cz.roomWithTaste ? cz.roomWithTaste(room) : room;
            const pres = presOf(room);      // 220번: 포인트는 방식 묶음에서 찾음(문장은 그 방식의 지금 문장 그대로)
            const r = (pres === 'point' && typeof seatDrapeTechs === 'function') ? seatDrapeTechs(rm) : (typeof seatDrape === 'function' ? seatDrape(rm, pres) : null);
            if (!r || !r.seats || !r.seats.length) return '';
            // 고른 원단이 들어 있는 자리: 같은 색 먼저, 없으면 그 자리 색의 "한 톤 짙게" 짝(darkerPair)으로 고른 색일 때만
            //  213번: 예전엔 같은 원단이면 아무 색이나 그 자리 말을 빌려 써서, 직원 화면에서 색을 바꾸면 바꾸기 전 색의 이유가 붙었음 → 짝이 아니면 '' (ticket.js 계산 문장으로)
            const same = r.seats.find(x => x.fabrics.some(f => f.id === fabricId && (!colorName || f.color === colorName)));
            const twin = !same && colorName ? r.seats.find(x => x.fabrics.some(f => f.id === fabricId && (darkerPair(f.id, f.color) || {}).name === colorName)) : null;
            const seat = same || twin;
            return seat ? whyOf({ kind: 'drape', feel: r.feel, house: r.house }, seat, room) : '';
        } catch (e) { return ''; }
    }
    cz.colorPick = { wants, html, after, back, finishHtml, whyLineFor };      // concierge.js가 부름 · whyLineFor는 ticket.js(194번)
})();
