(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['fake-guest.js']='20261138';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// 가짜 손님 시험 칸 (89번): 직원 화면 › 시험
//  [추천 점검] 사진 단계를 건너뛰고 벽·바닥 색값과 답을 바로 넣은 "가짜 손님"(벽 × 바닥, 처음엔 8 × 7 = 56명)으로 앱 추천을 돌려 봄.
//  [현장 비교] (93번) 사장님이 넣은 실제 손님 무리만(곱하지 않음), 사람 수로 무게를 둬서 셈. 사장님 예상과 나란히 봄.
//  고객 화면과 같은 계산(concierge.categoryPool · data.js bestColorFor/pickShowcase · RoomColor 톤/이어주는 색)을 그대로 씀.
//  이 칸은 자기 저장 칸(아래 두 키)에만 쓰고, 앱 저장 값·상담·비공개 팩은 건드리지 않음. 직원 화면에서 "시험"을 열 때만 불러옴.
// ==============================================================
(function() {
    // 벽·바닥 색: 한국 아파트에 흔한 페인트·벽지·마루·타일을 대략 Lab 값으로 적은 것 (사장님이 현장에서 잰 값으로 바꿔 갈 수 있음)
    const WALLS0 = [
        { n: '퓨어 화이트',     L: 95, a: 0,    b: 1.5 },
        { n: '웜 화이트',       L: 93, a: 0.5,  b: 6 },
        { n: '크림',            L: 90, a: 1,    b: 11 },
        { n: '쿨 라이트그레이', L: 85, a: -1,   b: -3 },
        { n: '그레이지',        L: 80, a: 1.5,  b: 5 },
        { n: '미드 그레이',     L: 66, a: 0,    b: 0.5 },
        { n: '세이지',          L: 76, a: -6,   b: 7 },
        { n: '차콜 포인트',     L: 34, a: 0,    b: 1 }
    ];
    const FLOORS0 = [
        { n: '화이트 오크',   L: 78, a: 3,  b: 14 },
        { n: '내추럴 오크',   L: 64, a: 7,  b: 22 },
        { n: '체리',          L: 48, a: 16, b: 22 },
        { n: '월넛',          L: 37, a: 8,  b: 14 },
        { n: '그레이 타일',   L: 70, a: 0,  b: 1.5 },
        { n: '화이트 폴리싱', L: 88, a: 0,  b: 2.5 },
        { n: '다크 그레이',   L: 44, a: 0,  b: 0.5 }
    ];
    const ROOM_TYPES = ['거실', '안방', '아이방', '작은방'];
    // 답 섞기 때 돌려 쓰는 답 (손님 번호로 고르므로 다시 열어도 같은 손님은 같은 답)
    const ANS = {
        privacy: ['high', 'some', 'open'],
        lightLevel: ['high', 'mid', 'low'],
        lightBlock: ['dark', 'soft', 'light'],
        sheerFeel: ['smooth', 'textured', 'cozy', null],
        wantMood: [null, 'soft_warm', 'urban_clean', 'balanced_neutral', 'deep_private', 'airy_bright']      // 결은 분위기에서 뺌 (90번)
    };
    const ANS_WORD = {
        high: '많이', some: '조금', open: '괜찮음', mid: '보통', low: '적음',
        dark: '완전히 어둡게', soft: '적당히', light: '들어와도', smooth: '매끈한', textured: '결 있는', cozy: '도톰한'
    };

    // 이 칸 전용 저장 (앱 저장 값과 따로)
    const JKEY = 'redam_fake_guest_judge_v1';      // 원단별 [어울림][애매][아님] 판정
    const CKEY = 'redam_fake_guest_colors_v1';     // 사장님이 고친 벽·바닥 색값
    function load(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' ? v : fallback; } catch (e) { return fallback; } }
    function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

    let judge = load(JKEY, {});
    let colors = load(CKEY, null) || { walls: WALLS0.map(x => Object.assign({}, x)), floors: FLOORS0.map(x => Object.assign({}, x)) };
    let view = 'guests', ansMode = 'fixed', linkDir = '', winDir = '', guests = [], results = [], chosen = {};

    const $ = id => document.getElementById(id);
    const RC = () => window.RoomColor;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // ---- 1. 가짜 손님 만들기 ----
    // 손님 수 N과 서로소인 건너뛰기 수 (93번: 56명으로 박혀 있던 9를 벽·바닥 개수에 맞게 풂). N/6쯤에서 찾아 벽·바닥 순서와 잘 엇갈리게
    function gcd(a, b) { while (b) { [a, b] = [b, a % b]; } return a; }
    function mixStep(N) {
        if (N <= 2) return 1;
        for (let s = Math.max(2, Math.round(N / 6)); s < N; s++) if (gcd(s, N) === 1) return s;
        return 1;
    }
    function makeGuests() {
        const out = [];
        const N = colors.walls.length * colors.floors.length, step = mixStep(N);
        let i = 0;
        colors.walls.forEach(w => colors.floors.forEach(f => {
            const j = (i * step) % N;      // 손님 번호를 벽·바닥 순서와 엇갈리게 섞은 번호 (step과 N이 서로소라 모두 다른 번호). 이 번호의 자릿수로 세 답을 정해 3×3×3 조합이 고르게 퍼짐
            const pick = (k, s, shift) => ANS[k][(i * s + (shift || 0) + 1) % ANS[k].length];      // 건너뛰는 칸 수 s와 답 개수가 서로소여야 모든 답이 나옴
            const fixed = ansMode === 'fixed';
            const wc = Object.assign({ tone: RC().classifyLab(w).tone }, w);
            const fc = Object.assign({ tone: RC().classifyLab(f).tone }, f);
            const mc = { wall: wc, floor: fc, bridge: RC().bridgeOf(w, f) };
            out.push({
                no: i + 1,
                id: w.n + '|' + f.n,
                name: ROOM_TYPES[i % ROOM_TYPES.length],
                wallName: w.n, floorName: f.n,
                measuredColor: mc,
                wallTone: wc.tone, floorTone: fc.tone,
                privacy: fixed ? 'some' : ANS.privacy[j % 3],
                lightLevel: fixed ? 'mid' : ANS.lightLevel[Math.floor(j / 3) % 3],
                lightBlock: fixed ? 'soft' : ANS.lightBlock[Math.floor(j / 9) % 3],
                sheerFeel: fixed ? null : pick('sheerFeel', 11),
                wantMood: fixed ? null : pick('wantMood', 13),
                linkDir: linkDir || null,
                windowDir: winDir ? [winDir] : [],      // 빛 보정 비교 (105번)
                comp: 'double'
            });
            i++;
        }));
        return out;
    }

    // ---- 2. 추천 돌리기: 고객 화면 fabricShowcase()와 같은 순서 (원단 모음 → 가장 어울리는 색 → 점수 순 → 3개) ----
    function top3(room, cat) {
        const ranked = window.concierge.categoryPool(cat).map(f => ({ f, best: bestColorFor(f, room, cat) }));
        ranked.sort((a, b) => (b.best.score - a.best.score) || ((isManualTagged(b.f) ? 1 : 0) - (isManualTagged(a.f) ? 1 : 0)));
        return pickShowcase(ranked, 3).map(e => {
            const c = e.best.color != null ? getFabricColors(e.f.id).find(x => x.name === e.best.color) : null;
            const hex = (c && c.hex) || (c && typeof c.light === 'number' && c.a != null ? RC().labToHex(c.light, c.a, c.b) : null) || '#ddd5c8';
            return { id: e.f.id, name: e.f.name, book: e.f.book, color: e.best.color, hex, score: Math.round(e.best.score * 10) / 10, noTex: !hasTex(e.f), mat: matWord(e.f) };
        });
    }

    // 질감이 비어 있는 원단 (93번: 속지 질감 점수 +8/−4는 질감이 들어 있을 때만 작동 → 입력 누락 찾기)
    function hasTex(f) { return !!(f && f.texture && typeof TEXTURE_LABELS !== 'undefined' && TEXTURE_LABELS[f.texture]); }
    // 소재 표시 (94번): 정한 값은 그대로, 이름 후보는 "?" , 이름에 린넨만 있으면 "린넨? 확인"
    function matWord(f) {
        if (!f || typeof MATERIAL_LABELS === 'undefined') return '';
        if (f.material && MATERIAL_LABELS[f.material]) return MATERIAL_LABELS[f.material];
        const g = guessMaterial(f);
        return g === 'check' ? '린넨? 확인' : (MATERIAL_LABELS[g] ? MATERIAL_LABELS[g] + '?' : '');
    }
    function noTexHtml(cat) {
        let pool = [];
        try { pool = window.concierge.categoryPool(cat); } catch (e) {}
        const miss = pool.filter(f => !hasTex(f)).map(f => f.name);
        return `<h3>질감 없음 ${miss.length} / ${pool.length} <small>(분류 › 질감이 비어 있음)</small></h3><div class="fg-zero">${esc(miss.join(', ')) || '없음'}</div>`;
    }

    // ---- 3. 화면 ----
    function labHex(c) { return RC().labToHex(c.L, c.a, c.b); }
    function jk(gu, cat, r) { return [gu.id, gu.name, cat, r.id, r.color].join('|'); }
    function ansText(gu) {
        const p = [];
        if (gu.privacy) p.push('시선 ' + ANS_WORD[gu.privacy]);
        if (gu.lightLevel) p.push('채광 ' + ANS_WORD[gu.lightLevel]);
        if (gu.lightBlock) p.push('빛 ' + ANS_WORD[gu.lightBlock]);
        if (gu.sheerFeel) p.push(ANS_WORD[gu.sheerFeel]);
        if (gu.wantMood) p.push(MOOD_LABELS[gu.wantMood]);
        return p.join(' · ');
    }
    function roomSvg(gu, sheerHex, drapeHex) {
        const w = labHex(gu.measuredColor.wall), f = labHex(gu.measuredColor.floor);
        return `<svg class="fg-room" viewBox="0 0 200 140">
            <rect width="200" height="104" fill="${w}"/><rect y="104" width="200" height="36" fill="${f}"/>
            <rect x="50" y="22" width="100" height="70" fill="#cfe0ea"/>
            <rect x="44" y="16" width="112" height="3" fill="#bbb"/>
            <rect x="62" y="19" width="76" height="85" fill="${sheerHex}" opacity=".78"/>
            <rect x="40" y="19" width="26" height="85" fill="${drapeHex}"/><rect x="134" y="19" width="26" height="85" fill="${drapeHex}"/>
        </svg>`;
    }
    function catHtml(gu, cat, list) {
        return `<div class="fg-cat"><h3>${cat}</h3>` + list.map((r, i) => {
            const k = jk(gu, cat, r), j = judge[k] || {};
            const sel = (chosen[gu.no + cat] || 0) === i ? ' sel' : '';
            const btn = (v, cls, t) => `<button type="button" class="${cls}${j.v === v ? ' on' : ''}" data-k="${encodeURIComponent(k)}" data-v="${v}">${t}</button>`;
            return `<div class="fg-pick${sel}" data-g="${gu.no}" data-c="${cat}" data-i="${i}">
                <div class="fg-chip" style="background:${r.hex}"></div>
                <div><div class="fg-nm">${esc(r.name)}${r.color != null ? ' ' + esc(colorNoLabel(r.color)) + '번' : ''}</div><div class="fg-sc">${esc(r.book || '')} · ${r.score}${r.noTex ? ' · <span class="fg-notex">질감 없음</span>' : ''}${r.mat ? ' · ' + esc(r.mat) : ''}</div></div>
                <div class="fg-judge">${btn('ok', 'j-ok', '어울림')}${btn('mid', 'j-mid', '애매')}${btn('no', 'j-no', '아님')}</div>
            </div>`;
        }).join('') + '</div>';
    }
    function renderGuests() {
        return results.map(({ g: gu, sheer, drape }) => {
            const s = sheer[chosen[gu.no + '속지'] || 0], d = drape[chosen[gu.no + '겉지'] || 0];
            const mc = gu.measuredColor;
            return `<div class="fg-guest">
                <div class="fg-who"><b>${gu.no}. ${gu.name}</b>
                    <div><span class="fg-sw" style="background:${labHex(mc.wall)}"></span>${esc(gu.wallName)}</div>
                    <div><span class="fg-sw" style="background:${labHex(mc.floor)}"></span>${esc(gu.floorName)}</div>
                    <div class="fg-ans">${ansText(gu)}</div>
                    ${roomSvg(gu, s ? s.hex : '#eee', d ? d.hex : '#ccc')}
                </div>
                ${catHtml(gu, '속지', sheer)}
                ${catHtml(gu, '겉지', drape)}
            </div>`;
        }).join('');
    }
    function renderStats() {
        const blocks = ['속지', '겉지'].map(cat => {
            const cnt = {}, colorCnt = {}, sets = new Set();
            results.forEach(r => {
                const list = cat === '속지' ? r.sheer : r.drape;
                sets.add(list.map(x => x.id + x.color).join(','));
                list.forEach(x => { cnt[x.name] = (cnt[x.name] || 0) + 1; const ck = x.name + (x.color != null ? ' ' + colorNoLabel(x.color) + '번' : ''); colorCnt[ck] = (colorCnt[ck] || 0) + 1; });
            });
            const all = window.concierge.categoryPool(cat);
            const never = all.filter(f => !cnt[f.name]).map(f => f.name);
            const rows = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 15)
                .map(([n, v]) => `<div class="fg-bar"><span>${esc(n)}</span><i style="width:${v / results.length * 100}%"></i><span>${v}</span></div>`).join('');
            return `<section><h2>${cat}</h2>
                <div><span class="fg-big">${sets.size}</span> / ${results.length} <small>가지 묶음</small></div>
                <h3>원단</h3>${rows(cnt)}
                <h3>색</h3>${rows(colorCnt)}
                <h3>한 번도 안 나온 원단 ${never.length} / ${all.length}</h3><div class="fg-zero">${esc(never.join(', '))}</div>
                ${noTexHtml(cat)}
            </section>`;
        });
        return `<div class="fg-stats">${blocks.join('')}</div>`;
    }
    function renderColors() {
        const rows = (list, kind) => list.map((c, i) => `<div class="fg-crow"><span class="fg-sw" style="background:${labHex(c)}"></span>
            <input type="text" value="${esc(c.n)}" data-kind="${kind}" data-i="${i}" data-f="n" class="fg-cname">
            ${['L', 'a', 'b'].map(f => `<label>${f}<input type="number" step="0.5" value="${c[f]}" data-kind="${kind}" data-i="${i}" data-f="${f}"></label>`).join('')}</div>`).join('');
        return `<div class="fg-colors"><p>벽·바닥 색값(Lab)입니다. 현장에서 잰 값으로 고치면 손님(벽 × 바닥)이 다시 만들어집니다.</p>
            <div class="fg-stats"><section><h2>벽 ${colors.walls.length}가지</h2>${rows(colors.walls, 'walls')}</section>
            <section><h2>바닥 ${colors.floors.length}가지</h2>${rows(colors.floors, 'floors')}</section></div>
            <button type="button" id="fgColorReset">처음 값으로 되돌리기</button></div>`;
    }
    function draw() {
        const box = $('fakeGuestOut');
        if (!box) return;
        const hasColors = typeof colorsStore === 'function' && Object.keys(colorsStore()).length > 0;
        const warn = hasColors ? '' : '<div class="fg-warn">이 창에는 원단 색 값이 없어서 결과가 비어 보일 수 있습니다. 사장님 미리보기(8765)나 탭에서 열어 주세요.</div>';
        box.innerHTML = warn + (view === 'guests' ? renderGuests() : view === 'stats' ? renderStats() : renderColors());
    }
    function run() {
        guests = makeGuests();
        results = guests.map(gu => ({ g: gu, sheer: top3(gu, '속지'), drape: top3(gu, '겉지') }));
        draw();
    }
    function setView(v) {
        view = v;
        document.querySelectorAll('#fakeGuestBar [data-fgview]').forEach(b => b.classList.toggle('on', b.dataset.fgview === v));
        draw();
    }

    function onClick(ev) {
        const j = ev.target.closest('.fg-judge button');
        if (j) {
            const k = decodeURIComponent(j.dataset.k), v = j.dataset.v;
            if (judge[k] && judge[k].v === v) delete judge[k]; else judge[k] = { v, at: Date.now() };
            save(JKEY, judge); draw(); return;
        }
        const p = ev.target.closest('.fg-pick');
        if (p) { chosen[p.dataset.g + p.dataset.c] = +p.dataset.i; draw(); return; }
        if (ev.target.id === 'fgColorReset') {
            colors = { walls: WALLS0.map(x => Object.assign({}, x)), floors: FLOORS0.map(x => Object.assign({}, x)) };
            try { localStorage.removeItem(CKEY); } catch (e) {}
            run();
        }
    }
    function onChange(ev) {
        const t = ev.target;
        if (!t.dataset || !t.dataset.kind) return;
        const c = colors[t.dataset.kind][+t.dataset.i], f = t.dataset.f;
        if (f === 'n') c.n = t.value.trim() || c.n;
        else { const n = parseFloat(t.value); if (!Number.isFinite(n)) return; c[f] = n; }
        save(CKEY, colors);
        run();
    }
    function download() {
        const blob = new Blob([JSON.stringify(judge, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '가짜손님_판정_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    // ==============================================================
    // ---- 4. 현장 비교 (93번): 사장님이 넣은 실제 손님 무리만, 곱하지 않고 사람 수로 무게 ----
    //  한 줄 = 손님 한 무리: 벽 이름 · 벽 L a b · 바닥 이름 · 바닥 L a b · 사람 수(또는 %) · [시선 · 채광 · 빛 가림 · 속지 느낌 · 분위기]
    //  칸 구분은 탭(엑셀·구글 시트 복사 그대로) 또는 공백. 답은 비우거나 "-"면 고정값(시선 조금 · 채광 보통 · 빛 적당히).
    // ==============================================================
    const FKEY = 'redam_fake_guest_field_v1';      // 현장 비교 손님 무리
    const EKEY = 'redam_fake_guest_expect_v1';     // 원단별 사장님 예상 [많음/보통/적음]
    let field = (load(FKEY, { rows: [] }).rows) || [];
    let expect = load(EKEY, {});
    let fieldMsg = '', fieldResults = [];
    const FCATS = ['속지', '겉지', '블라인드'];
    // 답 칸 순서와 받는 낱말 (화면 낱말 · 영문 값 둘 다 받음)
    const FANS = [
        ['privacy',    { '많이': 'high', '조금': 'some', '괜찮음': 'open', high: 'high', some: 'some', open: 'open' }],
        ['lightLevel', { '많이': 'high', '보통': 'mid', '적음': 'low', high: 'high', mid: 'mid', low: 'low' }],
        ['lightBlock', { '완전히 어둡게': 'dark', '완전히어둡게': 'dark', '어둡게': 'dark', '적당히': 'soft', '들어와도': 'light', dark: 'dark', soft: 'soft', light: 'light' }],
        ['sheerFeel',  { '매끈한': 'smooth', '결 있는': 'textured', '결있는': 'textured', '도톰한': 'cozy', smooth: 'smooth', textured: 'textured', cozy: 'cozy' }],
        ['wantMood',   null]      // 분위기: MOOD_LABELS 이름(은은한·아늑한 …) 또는 영문 값
    ];
    const FDEF = { privacy: 'some', lightLevel: 'mid', lightBlock: 'soft', sheerFeel: null, wantMood: null };
    function moodMap() {
        const m = {};
        if (typeof MOOD_LABELS !== 'undefined') Object.entries(MOOD_LABELS).forEach(([k, v]) => { m[k] = k; m[v] = k; });
        return m;
    }
    const isNum = t => /^-?\d+(\.\d+)?%?$/.test(String(t).trim());
    const blank = t => t == null || String(t).trim() === '' || String(t).trim() === '-';
    // 줄 하나 → 무리 하나 (잘못이면 까닭 글자를 던짐)
    function parseLine(line) {
        let wn, w, fn, f, cnt, ans;
        if (line.includes('\t')) {
            const c = line.split('\t').map(x => x.trim());
            [wn, w, fn, f, cnt, ans] = [c[0], c.slice(1, 4), c[4], c.slice(5, 8), c[8], c.slice(9)];
        } else {
            // 공백 구분: 이름은 숫자가 나올 때까지 이어 붙임(이름에 띄어쓰기가 있어도 됨)
            const t = line.trim().split(/\s+/);
            let k = 0;
            const name = () => { const p = []; while (k < t.length && !isNum(t[k])) p.push(t[k++]); return p.join(' '); };
            const nums = n => { const p = t.slice(k, k + n); k += n; return p; };
            wn = name(); w = nums(3); fn = name(); f = nums(3); cnt = t[k++];
            // 답: 두 낱말 답("결 있는", "완전히 어둡게")을 먼저 맞춰 봄
            ans = [];
            const rest = t.slice(k);
            for (let q = 0; q < rest.length; q++) {
                const two = rest[q] + ' ' + (rest[q + 1] || '');
                const map = FANS[ans.length] && FANS[ans.length][1];
                if (map && rest[q + 1] && map[two]) { ans.push(two); q++; } else ans.push(rest[q]);
            }
        }
        const lab = (arr, who) => {
            if (!arr || arr.length < 3 || arr.some(x => !isNum(x) || String(x).includes('%'))) throw who + ' L a b 숫자 세 개가 필요합니다';
            const [L, a, b] = arr.map(Number);
            if (L < 0 || L > 100) throw who + ' 밝기(L)는 0~100이어야 합니다';
            return { L, a, b };
        };
        if (!wn) throw '벽 이름이 없습니다';
        const wl = lab(w, '벽');
        if (!fn) throw '바닥 이름이 없습니다';
        const row = { wn, w: wl, fn, f: lab(f, '바닥') };
        if (blank(cnt) || !isNum(cnt)) throw '사람 수(또는 %)가 숫자가 아닙니다';
        row.cnt = parseFloat(cnt); row.pct = String(cnt).includes('%');
        if (!(row.cnt > 0)) throw '사람 수는 0보다 커야 합니다';
        const mm = moodMap();
        (ans || []).slice(0, FANS.length).forEach((v, i) => {
            if (blank(v)) return;
            const [key, map] = FANS[i], got = (map || mm)[String(v).trim()];
            if (!got) throw (i + 1) + '번째 답 "' + v + '"을 알 수 없습니다';
            row[key] = got;
        });
        return row;
    }
    function addLines(text, replace) {
        const lines = String(text || '').split(/\r?\n/);
        const ok = [], bad = [];
        lines.forEach((ln, i) => {
            if (!ln.trim() || /^\s*(#|벽\s*이름)/.test(ln)) return;      // 빈 줄·제목 줄·# 메모 줄은 건너뜀
            try { ok.push(parseLine(ln)); } catch (e) { bad.push((i + 1) + '번째 줄: ' + e); }
        });
        if (replace && ok.length) field = ok; else field = field.concat(ok);
        save(FKEY, { rows: field });
        fieldMsg = (ok.length ? ok.length + '줄을 넣었습니다.' : '넣은 줄이 없습니다.') + (bad.length ? ' 못 넣은 줄 ' + bad.length + '개:\n' + bad.join('\n') : '');
        return ok.length;
    }
    function rowText(r) {
        const cells = [r.wn, r.w.L, r.w.a, r.w.b, r.fn, r.f.L, r.f.a, r.f.b, r.cnt + (r.pct ? '%' : '')];
        const ans = FANS.map(([k]) => r[k] ? (k === 'wantMood' ? ((typeof MOOD_LABELS !== 'undefined' && MOOD_LABELS[r[k]]) || r[k]) : ANS_WORD[r[k]]) : '-');
        while (ans.length && ans[ans.length - 1] === '-') ans.pop();
        return cells.concat(ans).join('\t');
    }
    function copyRows() {
        const txt = field.map(rowText).join('\n');
        const done = () => { fieldMsg = field.length + '줄을 복사했습니다. 엑셀·구글 시트나 제미나이에게 그대로 붙여 넣을 수 있습니다.'; drawField(); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
        else fallbackCopy(txt, done);
    }
    function fallbackCopy(txt, done) {
        const ta = $('fgPaste'); if (!ta) return;
        ta.value = txt; ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { fieldMsg = '복사가 막혔습니다. 입력 상자에 넣어 두었으니 직접 복사해 주세요.'; }
    }
    function fieldGuest(r, i) {
        const w = Object.assign({ n: r.wn }, r.w), f = Object.assign({ n: r.fn }, r.f);
        const wc = Object.assign({ tone: RC().classifyLab(w).tone }, w), fc = Object.assign({ tone: RC().classifyLab(f).tone }, f);
        const gu = { no: i + 1, id: 'F|' + r.wn + '|' + r.fn, name: '현장', wallName: r.wn, floorName: r.fn,
            measuredColor: { wall: wc, floor: fc, bridge: RC().bridgeOf(w, f) }, wallTone: wc.tone, floorTone: fc.tone,
            linkDir: linkDir || null, windowDir: winDir ? [winDir] : [], comp: 'double', cnt: r.cnt };
        Object.keys(FDEF).forEach(k => { gu[k] = r[k] || FDEF[k]; });
        return gu;
    }
    function runField() {
        fieldResults = field.map((r, i) => {
            const g = fieldGuest(r, i), out = { g };
            FCATS.forEach(cat => { try { out[cat] = top3(g, cat); } catch (e) { out[cat] = []; } });
            return out;
        });
        drawField();
    }
    function fieldStats(cat) {
        let pool = [];
        try { pool = window.concierge.categoryPool(cat); } catch (e) {}
        const total = fieldResults.reduce((s, r) => s + r.g.cnt, 0) || 1;
        const cnt = {}, first = {};
        fieldResults.forEach(r => (r[cat] || []).forEach((x, i) => {
            cnt[x.id] = (cnt[x.id] || 0) + r.g.cnt;
            if (i === 0) first[x.id] = (first[x.id] || 0) + r.g.cnt;
        }));
        const fmt = v => Math.round(v * 10) / 10;
        const expBtn = f => {
            const k = cat + '|' + f.id, e = expect[k];
            return `<span class="fg-exp">${[['many', '많음'], ['mid', '보통'], ['few', '적음']].map(([v, t]) =>
                `<button type="button" class="${e === v ? 'on ' : ''}e-${v}" data-ek="${encodeURIComponent(k)}" data-ev="${v}">${t}</button>`).join('')}</span>`;
        };
        const max = Math.max(1, ...Object.values(cnt));
        const sorted = pool.slice().sort((a, b) => (cnt[b.id] || 0) - (cnt[a.id] || 0) || String(a.name).localeCompare(String(b.name)));
        const rows = sorted.map(f => {
            const v = cnt[f.id] || 0, e = expect[cat + '|' + f.id];
            // 예상과 실제가 크게 어긋나면 붉게: 예상 많음인데 손님 10% 미만 / 예상 적음인데 30% 이상
            const share = v / total;
            const off = (e === 'many' && share < 0.1) || (e === 'few' && share >= 0.3) ? ' fg-off' : '';
            return `<div class="fg-frow${off}"><span>${esc(f.name)}${hasTex(f) ? '' : ' <span class="fg-notex">질감 없음</span>'}${matWord(f) ? ' <small>· ' + esc(matWord(f)) + '</small>' : ''}</span>
                <i style="width:${v / max * 100}%"></i><span>${fmt(v)}${v ? ' <small>(1순위 ' + fmt(first[f.id] || 0) + ')</small>' : ''}</span>${expBtn(f)}</div>`;
        }).join('');
        const never = pool.filter(f => !cnt[f.id]).length;
        // "결 있는" 손님: 속지 1순위가 결 있는 원단인 비율
        let tex = '';
        if (cat === '속지') {
            const tg = fieldResults.filter(r => r.g.sheerFeel === 'textured');
            if (tg.length) {
                const tw = tg.reduce((s, r) => s + r.g.cnt, 0);
                const hit = tg.reduce((s, r) => { const x = r['속지'][0]; const fb = x && pool.find(f => f.id === x.id); return s + (fb && fb.texture === 'natural' ? r.g.cnt : 0); }, 0);
                // 94번: 그중 1순위가 린넨·린넨룩인 사람 수
                const lin = tg.reduce((s, r) => { const x = r['속지'][0]; const fb = x && pool.find(f => f.id === x.id); return s + (fb && fb.texture === 'natural' && ['linen', 'linenlook'].includes(materialOf(fb)) ? r.g.cnt : 0); }, 0);
                tex = `<div class="fg-texchk">"결 있는" 손님 ${fmt(tw)}명 중 속지 1순위가 결 있는 원단: <b>${fmt(hit)}명 (${Math.round(hit / tw * 100)}%)</b> · 그중 린넨·린넨룩: <b>${fmt(lin)}명 (${Math.round(lin / tw * 100)}%)</b></div>`;
            } else tex = `<div class="fg-texchk">"결 있는"을 고른 손님 무리가 없습니다.</div>`;
        }
        return `<section><h2>${cat} <small>원단 ${pool.length}개 · 한 번도 안 나옴 ${never}개</small></h2>${tex}
            <div class="fg-frow fg-fhead"><span>원단</span><span></span><span>실제(사람 수)</span><span>사장님 예상</span></div>${rows || '<div class="fg-zero">원단이 없습니다</div>'}
            ${noTexHtml(cat)}</section>`;
    }
    function drawField() {
        const box = $('fakeFieldOut');
        if (!box) return;
        const total = field.reduce((s, r) => s + r.cnt, 0);
        const list = field.map((r, i) => `<tr><td>${i + 1}</td><td><span class="fg-sw" style="background:${labHex(r.w)}"></span>${esc(r.wn)} <small>${r.w.L} ${r.w.a} ${r.w.b}</small></td>
            <td><span class="fg-sw" style="background:${labHex(r.f)}"></span>${esc(r.fn)} <small>${r.f.L} ${r.f.a} ${r.f.b}</small></td>
            <td>${r.cnt}${r.pct ? '%' : '명'}</td><td class="fg-ans">${esc(ansText(Object.assign({}, FDEF, r)))}</td>
            <td><button type="button" class="fg-del" data-del="${i}">빼기</button></td></tr>`).join('');
        const hasColors = typeof colorsStore === 'function' && Object.keys(colorsStore()).length > 0;
        box.innerHTML = (hasColors ? '' : '<div class="fg-warn">이 창에는 원단 색 값이 없어서 결과가 비어 보일 수 있습니다. 사장님 미리보기(8765)나 탭에서 열어 주세요.</div>') + `<div class="fg-field">
            <p>한 줄에 손님 한 무리씩 붙여 넣습니다. 순서: <b>벽 이름 · 벽 L a b · 바닥 이름 · 바닥 L a b · 사람 수(또는 %)</b> · (선택) 시선 · 채광 · 빛 가림 · 속지 느낌 · 분위기.
            칸은 탭(엑셀·구글 시트에서 복사한 그대로)이나 띄어쓰기로 나눕니다. 답을 비우거나 "-"로 두면 고정값(시선 조금 · 채광 보통 · 빛 적당히)입니다. 넣은 조합만, 적은 사람 수만큼만 셉니다.</p>
            <p class="fg-eg">예) <code>웜화이트 92 0.5 4 내추럴오크 64 7 22 12</code> · <code>크림 90 1 11 월넛 37 8 14 5 많이 적음 완전히 어둡게 결 있는 아늑한</code></p>
            <textarea id="fgPaste" rows="6" placeholder="웜화이트 92 0.5 4 내추럴오크 64 7 22 12"></textarea>
            <div class="fg-bar-top">
                <button type="button" id="fgAdd">더하기</button>
                <button type="button" id="fgReplace">지금 목록 바꾸기</button>
                <button type="button" id="fgCopy"${field.length ? '' : ' disabled'}>복사</button>
                <button type="button" id="fgClear"${field.length ? '' : ' disabled'}>모두 지우기</button>
                <span class="fg-total">${field.length}줄 · ${Math.round(total * 10) / 10}${field.some(r => r.pct) ? '' : '명'}</span>
            </div>
            ${fieldMsg ? `<pre class="fg-msg">${esc(fieldMsg)}</pre>` : ''}
            ${field.length ? `<table class="fg-ftable"><thead><tr><th></th><th>벽</th><th>바닥</th><th>사람</th><th>답</th><th></th></tr></thead><tbody>${list}</tbody></table>` : ''}
            ${field.length ? `<div class="fg-stats fg-stats3">${FCATS.map(fieldStats).join('')}</div>` : ''}
        </div>`;
    }
    function onFieldClick(ev) {
        const t = ev.target;
        const eb = t.closest('[data-ek]');
        if (eb) {
            const k = decodeURIComponent(eb.dataset.ek);
            if (expect[k] === eb.dataset.ev) delete expect[k]; else expect[k] = eb.dataset.ev;
            save(EKEY, expect); drawField(); return;
        }
        if (t.dataset.del != null) { field.splice(+t.dataset.del, 1); save(FKEY, { rows: field }); fieldMsg = ''; runField(); return; }
        if (t.id === 'fgAdd' || t.id === 'fgReplace') {
            const txt = $('fgPaste').value;
            if (t.id === 'fgReplace' && field.length && !confirm('지금 목록 ' + field.length + '줄을 지우고 새로 넣을까요?')) return;
            addLines(txt, t.id === 'fgReplace'); runField(); return;
        }
        if (t.id === 'fgCopy') { copyRows(); return; }
        if (t.id === 'fgClear') {
            if (!confirm('현장 비교 목록 ' + field.length + '줄을 모두 지울까요? (사장님 예상 표시는 남습니다)')) return;
            field = []; save(FKEY, { rows: field }); fieldMsg = '목록을 비웠습니다.'; runField();
        }
    }
    // ==============================================================
    // ---- 5. 색 기법 수 (96번): 공간마다 기법별로 맞는 원단 색 수(겉지·속지 따로). 계산은 data.js colorTechCounts ----
    //  공간 = 지금 상담에서 벽·바닥을 잰 공간 + 예시 집 넷. 기준값은 위 칸에서 고침(이 기기에만 저장, 상담 빈 칸 기록도 같은 값).
    // ==============================================================
    const TECH_SAMPLES = [
        ['예시 · 흰 벽 + 오크', 1, 1], ['예시 · 크림 + 월넛', 2, 3], ['예시 · 그레이 무채색', 5, 4], ['예시 · 쿨 그레이시', 3, 5], ['예시 · 웜 뉴트럴', 4, 4]      // 웜 뉴트럴 = 그레이지 벽 + 그레이 타일 (101번)
    ];
    const TECH_CFG_WORD = [   // 칸 이름 쉬운 말로 (100번)
        ['grayC', '이보다 흐리면 회색'], ['sameDE', '동일색 · 이보다 가까우면 같은 색'], ['toneHue', '같은 계열로 볼 색 폭'], ['toneDL', '톤온톤 · 최소 밝기 차'],
        ['analogHue', '유사색 · 색 폭 끝'], ['satDC', '채도 대비 · 더 짙어야 할 만큼'], ['valueDL', '명도 대비 · 벽과 최소 밝기 차'], ['tintCMax', '톤인톤 · 이보다 흐린 색만'],
        ['tintDL', '톤인톤 · 이어주는 색과 밝기 차 최대'], ['minShow', '선택지로 보일 최소 개수']
    ];
    let techOpen = '';      // 펼친 칸 (공간 번호|기법|겉지·속지)
    function techSpaces() {
        const out = [];
        let live = [];
        try { live = (typeof collectConsultation === 'function') ? collectConsultation().rooms : []; } catch (e) {}
        live.forEach(r => { const mc = r.measuredColor; if (mc && mc.wall && mc.floor) out.push({ name: r.name || '공간', mc, live: true, width: Number(r.spaceWidth || r.width) || 0 }); });
        TECH_SAMPLES.forEach(([n, wi, fi]) => {
            const w = WALLS0[wi], f = FLOORS0[fi];
            out.push({ name: n, mc: { wall: w, floor: f, bridge: RC().bridgeOf(w, f) }, sub: w.n + ' · ' + f.n });
        });
        return out;
    }
    function techCell(si, row, side, T) {
        const list = row[side], n = list.length, nf = row[side + 'Fabrics'], k = si + '|' + row.key + '|' + side;
        const cls = n === 0 ? 'fg-t0' : (n < T.minShow ? 'fg-tlow' : '');
        return `<td class="${cls}"><button type="button" class="fg-tbtn${techOpen === k ? ' on' : ''}" data-tk="${esc(k)}"${n ? '' : ' disabled'}>${n === 0 ? '없음' : n + '색 <small>(' + nf + '종)</small>'}</button></td>`;
    }
    function techTable(sp, si, T) {
        const r = colorTechCounts(sp.mc, T);
        if (!r) return '';
        const w = sp.mc.wall, f = sp.mc.floor, b = sp.mc.bridge || RC().bridgeOf(w, f);
        let openList = '';
        const rows = r.rows.map(row => {
            ['drape', 'sheer'].forEach(side => {
                if (techOpen === si + '|' + row.key + '|' + side) openList = `<div class="fg-tlist"><b>${esc(row.name)} · ${side === 'drape' ? '겉지' : '속지'}</b> ` +
                    row[side].map(x => `<span><i class="fg-sw" style="background:${RC().labToHex(x.L, x.a, x.b)}"></i>${esc(x.fabric)} ${esc(colorNoLabel(x.color))}</span>`).join('') + '</div>';
            });
            return `<tr><th>${esc(row.name)}</th>${techCell(si, row, 'drape', T)}${techCell(si, row, 'sheer', T)}</tr>`;
        }).join('');
        const sw = (c, t) => `<span><i class="fg-sw" style="background:${labHex(c)}"></i>${t}</span>`;
        return `<section class="fg-tech"><h2>${esc(sp.name)}${sp.live ? ' <small>(지금 상담)</small>' : ''}</h2>
            <div class="fg-tsw">${sw(w, '벽')}${sw(f, '바닥')}${sw(b, '이어주는 색')}${(sp.mc.furniture || []).length ? ' <small>가구 ' + sp.mc.furniture.length + '</small>' : ''}${r.gray ? ' <b class="fg-tgray">무채색 집 → 웜 쪽·쿨 쪽</b>' : (r.house === 'neutral' ? ` <b class="fg-tgray">뉴트럴 집(${r.neutralDir === 'cool' ? '쿨' : '웜'}) → 반대 온도</b>` : '')}</div>
            <table class="fg-ttable"><thead><tr><th>기법</th><th>겉지</th><th>속지</th></tr></thead><tbody>${rows}</tbody></table>
            <p class="fg-tnote">속지 따로 (102번): 화이트 ${r.sheerWhite.length}색 <small>(어느 집에나 바탕)</small> · 색 있는 씨스루 ${r.sheerSee.length}색 <small>(많이 비침 — 기법 표에 넣음, 잰 값 눈 확인)</small></p>${openList}</section>`;
    }
    // 상담 기록에 남은 빈 칸 모음: 몇 공간에서 그 기법 후보가 0이었나
    function techGapSummary() {
        let hist = [];
        try { hist = typeof loadHistory === 'function' ? loadHistory() : []; } catch (e) {}
        const cnt = {}; let n = 0;
        hist.forEach(h => (h.rooms || []).forEach(r => {
            if (!r.techGaps) return;
            n++;
            ['drape', 'sheer'].forEach(s => (r.techGaps[s] || []).forEach(t => { const k = t + ' · ' + (s === 'drape' ? '겉지' : '속지'); cnt[k] = (cnt[k] || 0) + 1; }));
        }));
        if (!n) return '<p class="fg-tgap">상담 기록의 빈 칸: 아직 없음 (이번 버전부터 상담을 남길 때 공간마다 조용히 기록합니다)</p>';
        const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} <b>${v}</b>`).join(' · ');
        return `<p class="fg-tgap">상담 기록 ${n}공간에서 후보가 없던 기법: ${top || '없음'}</p>`;
    }
    function drawTech() {
        const box = $('fakeTechOut');
        if (!box) return;
        const T = colorTechCfg();
        const hasColors = typeof colorsStore === 'function' && Object.keys(colorsStore()).length > 0;
        const cfgHtml = TECH_CFG_WORD.map(([k, t]) => `<label>${t}<input type="number" step="1" value="${T[k]}" data-tc="${k}"></label>`).join('');
        box.innerHTML = (hasColors ? '' : '<div class="fg-warn">이 창에는 원단 색 값이 없어서 결과가 비어 보일 수 있습니다. 사장님 미리보기(8765)나 탭에서 열어 주세요.</div>') +
            `<div class="fg-tcfg">${cfgHtml}<button type="button" id="fgTechReset">처음 값으로</button></div>
            <p class="fg-tnote">숫자 = 그 기법에 맞는 원단 색 수 (원단 종류 수). <span class="fg-t0">없음</span> · <span class="fg-tlow">최소 개수보다 적음</span>. 칸을 누르면 원단이 보입니다. 집 셋(무채색·뉴트럴·색 있는)은 벽·바닥·이어주는 색의 색 사전 계열로 나눔. 색 방향은 그중 채도가 가장 높은 색 기준. '이보다 흐리면 회색'은 색 사전 값이 없을 때만 씀.</p>
            ${techGapSummary()}
            <div class="fg-tgrid">${techSpaces().map((sp, i) => techTable(sp, i, T)).join('')}</div>`;
    }
    function onTechClick(ev) {
        const b = ev.target.closest('[data-tk]');
        if (b) { techOpen = techOpen === b.dataset.tk ? '' : b.dataset.tk; drawTech(); return; }
        if (ev.target.id === 'fgTechReset') { setColorTechCfg(null); drawTech(); }
    }
    function onTechChange(ev) {
        const k = ev.target.dataset && ev.target.dataset.tc;
        if (!k) return;
        const n = parseFloat(ev.target.value);
        if (!Number.isFinite(n)) return;
        const T = colorTechCfg(); T[k] = n; setColorTechCfg(T); drawTech();
    }

    // ==============================================================
    // ---- 6. 방 그림 비교 (97번): 그 집에서 잰 벽·바닥·가구 색을 칠한 작은 방 그림에 후보 겉지 색 2~3개를 나란히 ----
    //  기법을 고르면 그 기법의 후보(colorTechCounts)로 바뀜. 후보 하나를 누르면 같은 방 그림의 변형 셋:
    //  커튼 전체 / 겉지만(속지 = 이어주는 색에 가장 가까운 속지) / 끝단 배색(같은 원단의 다른 색, 실제 폭 수만큼).
    //  방향 고르기용 그림이고 최종은 실물 샘플. 손님 화면은 사장님 확인 뒤에.
    // ==============================================================
    let roomTech = {}, roomPick = {};       // 공간 번호 → 고른 기법 / 고른 후보 번호
    const dE3 = (x, y) => Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
    function fabricOf(id) {
        for (const cat of ['겉지', '속지']) {
            let pool = [];
            try { pool = window.concierge && window.concierge.categoryPool ? window.concierge.categoryPool(cat) : []; } catch (e) {}
            const f = pool.find(x => x.id === id);
            if (f) return f;
        }
        return null;
    }
    // 폭 수: 넓이 × 2배 주름 ÷ 원단 폭(대폭 무이음은 1마 = 90cm 단위). 넓이 없으면 340cm, 폭 없으면 150cm
    function widthCount(spaceW, fab) {
        const spec = (fab && fab.specCm) || 150, unit = spec >= 200 ? 90 : spec;
        return { n: Math.max(2, Math.ceil(((spaceW || 340) * 2) / unit)), unit: spec >= 200 ? '마' : '폭', cm: unit };
    }
    // 끝단 색: 같은 원단의 다른 색 중 본 색과 가장 다른 색(포인트)
    function trimOf(c) {
        const others = getFabricColors(c.id).filter(colorHasLab).filter(x => String(x.name) !== String(c.color))
            .map(x => ({ id: c.id, fabric: c.fabric, color: x.name, L: x.light, a: x.a, b: x.b }));
        return others.sort((p, q) => dE3(q, c) - dE3(p, c))[0] || null;
    }
    function sheerNear(bridge) {
        let pool = [];
        try { pool = window.concierge && window.concierge.categoryPool ? window.concierge.categoryPool('속지') : []; } catch (e) {}
        let best = null, bd = 1e9;
        pool.forEach(f => getFabricColors(f.id).filter(colorHasLab).forEach(x => {
            const c = { L: x.light, a: x.a, b: x.b }, d = dE3(c, bridge);
            if (d < bd) { bd = d; best = Object.assign(c, { fabric: f.name, color: x.name }); }
        }));
        return best;
    }
    // 후보 고르기: 원단마다 한 색만, 밝기 순으로 줄 세워 밝은·중간·진한 쪽 하나씩 (서로 달라 보이게)
    function pickThree(list) {
        const seen = new Set(), uniq = [];
        list.forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); uniq.push(x); } });
        uniq.sort((p, q) => q.L - p.L);
        if (uniq.length <= 3) return uniq;
        return [uniq[0], uniq[Math.floor(uniq.length / 2)], uniq[uniq.length - 1]];
    }
    // opt: { drape, sheer?, trim?, count? }
    function roomPic(mc, opt) {
        const hx = c => RC().labToHex(c.L, c.a, c.b);
        const w = hx(mc.wall), f = hx(mc.floor), d = hx(opt.drape);
        let s = `<svg class="fg-rpic" viewBox="0 0 240 150"><rect width="240" height="112" fill="${w}"/><rect y="112" width="240" height="38" fill="${f}"/>
            <rect x="70" y="24" width="100" height="74" fill="#cfe0ea"/><rect x="44" y="16" width="152" height="3" fill="#9a9087"/>`;
        if (opt.sheer) s += `<rect x="66" y="19" width="108" height="93" fill="${hx(opt.sheer)}" opacity=".82"/>`;
        // 양쪽 커튼: 한쪽 = 폭 수의 절반, 끝단 배색은 가운데 쪽 1폭(1마)
        const half = Math.max(1, Math.ceil((opt.count || 2) / 2)), PW = 40, sw = PW / half;
        [[46, 'L'], [154, 'R']].forEach(([x, side]) => {
            s += `<rect x="${x}" y="19" width="${PW}" height="93" fill="${d}"/>`;
            for (let i = 1; i < half; i++) s += `<line x1="${x + i * sw}" y1="19" x2="${x + i * sw}" y2="112" stroke="#00000018" stroke-width=".6"/>`;
            if (opt.trim) s += `<rect x="${side === 'L' ? x + PW - sw : x}" y="19" width="${sw}" height="93" fill="${hx(opt.trim)}"/>`;
        });
        // 남는 가구(최대 3): 바닥 위 상자
        (mc.furniture || []).filter(x => x && x.stay !== false && typeof x.L === 'number').slice(0, 3).forEach((fu, i) => {
            const x = [8, 196, 104][i], wd = i === 2 ? 32 : 36;
            s += `<rect x="${x}" y="${i === 2 ? 120 : 96}" width="${wd}" height="${i === 2 ? 14 : 22}" rx="3" fill="${hx(fu)}" stroke="#00000020" stroke-width=".6"/>`;
        });
        return s + '</svg>';
    }
    function photoTag(c) {
        const u = fabricPhotoUrls(c.id, c.color)[0];
        return u ? `<img class="fg-rph" src="${esc(u)}" data-id="${esc(c.id)}" data-color="${esc(c.color)}" data-i="0" onerror="photoFallback(this)" alt="">` : '';
    }
    function roomBlock(sp, si, T) {
        const r = colorTechCounts(sp.mc, T);
        if (!r) return '';
        const mc = Object.assign({}, sp.mc, { bridge: sp.mc.bridge || RC().bridgeOf(sp.mc.wall, sp.mc.floor) });
        const usable = r.rows.filter(x => x.drape.length);
        if (!usable.length) return `<section class="fg-tech"><h2>${esc(sp.name)}</h2><p class="fg-tnote">겉지 후보가 있는 기법이 없습니다.</p></section>`;
        let key = roomTech[si];
        if (!usable.some(x => x.key === key)) key = (usable.find(x => x.key === 'tone') || usable[0]).key;
        const row = usable.find(x => x.key === key), cands = pickThree(row.drape);
        const pi = Math.min(roomPick[si] || 0, cands.length - 1), pick = cands[pi];
        const opts = usable.map(x => `<option value="${x.key}"${x.key === key ? ' selected' : ''}>${esc(x.name)} (${x.drapeFabrics}종)</option>`).join('');
        const cards = cands.map((c, i) => `<button type="button" class="fg-rcard${i === pi ? ' on' : ''}" data-rs="${si}" data-ri="${i}">
            ${roomPic(mc, { drape: c })}<div class="fg-rcap">${photoTag(c)}<span>${esc(c.fabric)} ${esc(colorNoLabel(c.color))}<br><small>밝기 ${Math.round(c.L)}</small></span></div></button>`).join('');
        const fab = fabricOf(pick.id), wc = widthCount(sp.width, fab), trim = trimOf(pick), sheer = sheerNear(mc.bridge);
        const vari = (title, pic, note) => `<div class="fg-rvar">${pic}<div class="fg-rcap"><span><b>${title}</b><br><small>${note}</small></span></div></div>`;
        const vars = vari('커튼 전체', roomPic(mc, { drape: pick, count: wc.n }), '겉지 한 겹') +
            (sheer ? vari('겉지만', roomPic(mc, { drape: pick, sheer, count: wc.n }), '속지 ' + esc(sheer.fabric) + ' ' + esc(colorNoLabel(sheer.color))) : '') +
            (trim ? vari('끝단 배색', roomPic(mc, { drape: pick, trim, count: wc.n }), `같은 원단 ${esc(colorNoLabel(trim.color))} · 양쪽 가운데 1${wc.unit}씩`)
                  : vari('끝단 배색', roomPic(mc, { drape: pick, count: wc.n }), '이 원단은 다른 색이 없음'));
        return `<section class="fg-tech fg-rsec"><h2>${esc(sp.name)}${sp.live ? ' <small>(지금 상담)</small>' : ''}</h2>
            <div class="fg-tsw"><label>기법 <select data-rt="${si}">${opts}</select></label>
            <small>넓이 ${sp.width ? sp.width + 'cm' : '없음(340cm로)'} · ${esc(pick.fabric)} 원단 폭 ${(fab && fab.specCm) || 150}cm → ${wc.n}${wc.unit}</small></div>
            <div class="fg-rrow">${cards}</div>
            <p class="fg-tnote">고른 후보의 변형</p><div class="fg-rrow">${vars}</div></section>`;
    }
    function drawRoomCmp() {
        const box = $('fakeRoomOut');
        if (!box) return;
        const T = colorTechCfg();
        const hasColors = typeof colorsStore === 'function' && Object.keys(colorsStore()).length > 0;
        const spaces = techSpaces();
        box.innerHTML = (hasColors ? '' : '<div class="fg-warn">이 창에는 원단 색 값이 없어서 그림이 비어 보일 수 있습니다. 사장님 미리보기(8765)나 탭에서 열어 주세요.</div>') +
            '<p class="fg-tnote">그 집의 벽·바닥·남는 가구 색에 후보 겉지를 칠한 그림입니다(방향 고르기용, 최종은 실물 샘플). 후보는 고른 기법 안에서 밝은·중간·진한 쪽 하나씩. 그림을 누르면 아래 변형이 그 원단으로 바뀝니다.</p>' +
            spaces.map((sp, i) => roomBlock(sp, i, T)).join('');
    }
    function onRoomClick(ev) {
        const b = ev.target.closest('[data-rs]');
        if (b) { roomPick[b.dataset.rs] = +b.dataset.ri; drawRoomCmp(); }
    }
    function onRoomChange(ev) {
        const si = ev.target.dataset && ev.target.dataset.rt;
        if (si == null) return;
        roomTech[si] = ev.target.value; roomPick[si] = 0; drawRoomCmp();
    }

    let mode = 'check';
    function setMode(m) {
        mode = m;
        document.querySelectorAll('#fgMode [data-fgmode]').forEach(b => b.classList.toggle('on', b.dataset.fgmode === m));
        const cw = $('fgCheckWrap'), fo = $('fakeFieldOut'), to = $('fakeTechOut');
        if (cw) cw.hidden = m !== 'check';
        if (fo) fo.hidden = m !== 'field';
        if (to) to.hidden = m !== 'tech';
        const ro = $('fakeRoomOut'); if (ro) ro.hidden = m !== 'room';      // 97번
        if (m === 'field') runField(); else if (m === 'tech') drawTech(); else if (m === 'room') drawRoomCmp(); else run();
    }

    let bound = false;
    function open() {
        const box = $('fakeGuestOut');
        if (!box) return;
        if (!bound) {
            bound = true;
            box.addEventListener('click', onClick);
            box.addEventListener('change', onChange);
            document.querySelectorAll('#fakeGuestBar [data-fgview]').forEach(b => b.addEventListener('click', () => setView(b.dataset.fgview)));
            $('fgAns').addEventListener('change', e => { ansMode = e.target.value; run(); });
            $('fgLink').addEventListener('change', e => { linkDir = e.target.value; run(); });
            // 이어주는 색 보조 점수 켜기/끄기 (91번 비교용, 시험 칸 안에서만 바뀜 · 다시 열면 켜짐)
            $('fgSoft').addEventListener('change', e => { window.ROOM_SOFT_ON = e.target.value === 'on'; run(); });
            // 빛 보정 (105번): 시험 손님 모두의 창 방향 · 북향 웜 +1 켜기/끄기 (다시 열면 켜짐)
            $('fgDir').addEventListener('change', e => { winDir = e.target.value; setMode(mode); });
            $('fgLight').addEventListener('change', e => { window.LIGHT_FIX_ON = e.target.value === 'on'; setMode(mode); });
            $('fgExport').addEventListener('click', download);
            // 93번: 위쪽 두 단추(추천 점검 / 현장 비교)와 현장 비교 칸. 색 잇기·이어주는 색 선택은 현장 비교도 같은 값을 씀
            document.querySelectorAll('#fgMode [data-fgmode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.fgmode)));
            const fo = $('fakeFieldOut'); if (fo) fo.addEventListener('click', onFieldClick);
            const to = $('fakeTechOut'); if (to) { to.addEventListener('click', onTechClick); to.addEventListener('change', onTechChange); }      // 96번
            const ro = $('fakeRoomOut'); if (ro) { ro.addEventListener('click', onRoomClick); ro.addEventListener('change', onRoomChange); }      // 97번
        }
        setMode(mode);
    }
    window.FakeGuest = { open };
})();
