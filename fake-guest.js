(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['fake-guest.js']='20261115';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// 가짜 손님 시험 칸 (89번): 직원 화면 › 시험
//  사진 단계를 건너뛰고 벽·바닥 색값과 답을 바로 넣은 "가짜 손님" 56명(벽 8 × 바닥 7)으로 앱 추천을 돌려 봄.
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
    let view = 'guests', ansMode = 'fixed', linkDir = '', guests = [], results = [], chosen = {};

    const $ = id => document.getElementById(id);
    const RC = () => window.RoomColor;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    // ---- 1. 가짜 손님 만들기 ----
    function makeGuests() {
        const out = [];
        let i = 0;
        colors.walls.forEach(w => colors.floors.forEach(f => {
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
                privacy: fixed ? 'some' : pick('privacy', 7),
                lightLevel: fixed ? 'mid' : pick('lightLevel', 5),
                lightBlock: fixed ? 'soft' : pick('lightBlock', 4, Math.floor(i / 3)),
                sheerFeel: fixed ? null : pick('sheerFeel', 11),
                wantMood: fixed ? null : pick('wantMood', 13),
                linkDir: linkDir || null,
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
            return { id: e.f.id, name: e.f.name, book: e.f.book, color: e.best.color, hex, score: Math.round(e.best.score * 10) / 10 };
        });
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
                <div><div class="fg-nm">${esc(r.name)}${r.color != null ? ' ' + esc(colorNoLabel(r.color)) + '번' : ''}</div><div class="fg-sc">${esc(r.book || '')} · ${r.score}</div></div>
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
            </section>`;
        });
        return `<div class="fg-stats">${blocks.join('')}</div>`;
    }
    function renderColors() {
        const rows = (list, kind) => list.map((c, i) => `<div class="fg-crow"><span class="fg-sw" style="background:${labHex(c)}"></span>
            <input type="text" value="${esc(c.n)}" data-kind="${kind}" data-i="${i}" data-f="n" class="fg-cname">
            ${['L', 'a', 'b'].map(f => `<label>${f}<input type="number" step="0.5" value="${c[f]}" data-kind="${kind}" data-i="${i}" data-f="${f}"></label>`).join('')}</div>`).join('');
        return `<div class="fg-colors"><p>벽·바닥 색값(Lab)입니다. 현장에서 잰 값으로 고치면 손님 56명이 다시 만들어집니다.</p>
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
            $('fgExport').addEventListener('click', download);
        }
        run();
    }
    window.FakeGuest = { open };
})();
