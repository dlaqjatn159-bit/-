(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['final.js']='20261226';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// final.js — 고객 화면 최종 제안: 도록(76번)·조각보·쇼룸 시트·종이 쪽 넘기기·크게 보기 (130-4③에서 concierge.js에서 떼어 냄). concierge.js·fabric-pick.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore;      // concierge.js와 잇는 다리 (130-4)
    const { state, syncToV1MasterRooms, fabricFillStyle, COMP_NAMES, roomPart, roomSize, roomComp, colorFillOf } = cz;
    let finalPage = 0, finalCardCount = 0, finalHouseCount = 0, finalNightAt = -1, finalZoom = false;      // 최종 제안의 쪽 넘기기·크게 보기(39번). cardCount = 견적서 앞 쪽 수(우리 집 색 포함)

    // ---- 최종 제안 통합 에디토리얼 도록 (76번, 시안: 중심화면_최종제안_비교시안.html 탭 2) ----
    //  1) 도입부: 태블릿 세로 100dvh 독점 + Re.dam 로고 + 16:10 액자 비례 미니멀 조각보(창 면적 비례, 순수 단색, 글자·스티커 없음)
    //  2) 공간의 색과 빛: 0.5px 초세선 색 분포 지도 + 집 전체 총평 (중복 가로 막대 6개 제거)
    //  3) 공간별 완결형 쇼룸 시트: 좌측(26% 공간명·빛 방향·창 크기·구성 방식) + 우측(74% 창가 입면 색띠 + 공간 진단 + 겹침 스와치 + 원단 이유)
    //  4) 견적서: 0.5px 초세선 호텔 인보이스 표 + 시공비 + 합계 + 안내 + 마무리 시
    // 134번: 조각보 — 구도와 색을 따로 (시안 133_고른것_표시와_조각보_시안_v5.html 2·3부)
    //  구도: 상담마다 정해진 번호(79번)로 16×10 종이를 무작위로 나눔(정사각 자르기 40%, 칸은 여섯부터, 가장 짧은 변 = 표지 높이 8%)
    //  색: 그 집에서 잰 색을 비율대로 칸에 칠함(78·121번 면적, 113번 묶기, 색 여덟까지, 한 색 40%까지, 비슷한 색은 칸이 붙지 않게)
    //  꿰매 넣기: 공간 순서대로(벽·바닥 → 원단) 하나씩 더해 간 과정을 매번 똑같이 다시 밟음 → 놓인 칸은 자리를 지키고 새 색만 칸을 받음
    //  돌려주는 것: { cells: [{ x, y, w, h, hex }] } (16×10 좌표) · 색이 하나도 없으면 null. 화면(중심 화면·표지)과 저장 이미지(80번)가 같이 씀
    const JOGAK_DE = 3, JOGAK_MAX = 8, JOGAK_SHARE = 0.4, JOGAK_NEAR = 8;      // 묶기 잣대(113번) · 색 상한 · 한 색 상한 · 붙이지 않을 비슷한 색
    const JG_W = 16, JG_H = 10, JG_MIN = 0.8, JG_START = 6;
    function jogakRooms(data) {
        // 공간 목록: 고객 화면 공간(state.roomsCart) 순서. 없으면(직원 화면만 쓴 상담) 견적 공간에서
        const typeWeightOf = name => {
            const n = String(name || '').trim();
            if (/^거실\s*1?$|^거실$/.test(n)) return 1.45;
            if (/거실/.test(n)) return 1.15;
            if (/안방|침실/.test(n)) return 1.22;
            if (/방/.test(n)) return 0.95;
            if (/주방|다이닝|서재|알파/.test(n)) return 0.80;
            if (/드레스|베란다|발코니|다용도/.test(n)) return 0.62;
            return 0.90;
        };
        const weightOf = (name, raw) => {
            const sz = roomSize(raw) || { w: 240, h: 235 };
            const rawArea = Math.max(1200, (Number(sz.w) || 240) * (Number(sz.h) || 235));
            return 1000 * typeWeightOf(name) * Math.max(0.48, Math.min(1.80, Math.pow(rawArea / 55000, 0.62)));
        };
        const fabOf = (fabricId, colorName, fill) => colorFillOf(fabricId, colorName) || fill || '#d9cdbb';
        const cart = (state.roomsCart || []);
        const src = cart.length ? cart.map(r => ({
            name: r.name, raw: r,
            fabs: (r.isConfigured ? (r.curtains || []) : []).filter(c => c.fabricId).map(c => ({ kind: c.presetType, hex: fabOf(c.fabricId, c.colorName) }))
        })) : ((data && data.rooms) || []).map(rm => ({
            name: rm.name, raw: rm.raw || rm,
            fabs: (rm.items || []).map(i => ({ kind: (i.kindKey === 'drape' || i.kind === '겉지') ? 'drape' : (i.kindKey === 'sheer' || i.kind === '속지') ? 'sheer' : 'other', hex: fabOf(i.fabricId, i.colorName, i.fill) }))
        }));
        return src.map(s => {
            const wallP = roomPart(s.raw, 'wall'), floorP = roomPart(s.raw, 'floor');
            return { W: weightOf(s.name, s.raw), wall: wallP && wallP.hex, floor: floorP && floorP.hex, fabs: s.fabs };
        }).filter(r => r.wall || r.floor || r.fabs.length);
    }
    // 색과 비율 (78·121·113번 + 134번 한 색 40%)
    function jogakColors(rooms) {
        const RC = window.RoomColor;
        const normHex = h => String(h || '').trim().toLowerCase();
        const labOf = hex => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); return m ? RC.rgbToLab(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)) : null; };
        const m = new Map();
        const add = (key, hex, a, rate, g) => { const c = m.get(key); if (!c) m.set(key, { keys: [key], hex, area: Math.round(a), g }); else c.area += Math.round(a * rate); };
        rooms.forEach(r => {
            // 121번: 벽·바닥이 원단보다 넓음. 여러 공간이 같은 색이면 쌓임
            if (r.wall) add('wall__' + normHex(r.wall), r.wall, r.W * 0.62, 0.50, 's');
            if (r.floor) add('floor__' + normHex(r.floor), r.floor, r.W * 0.46, 0.48, 's');
            const sheer = r.fabs.find(f => f.kind === 'sheer'), drape = r.fabs.find(f => f.kind === 'drape');
            if (r.fabs.length >= 2 && sheer && drape) {
                add('fab__' + normHex(sheer.hex), sheer.hex, r.W * 0.32, 0.45, 'x');      // 속지는 자주 쳐 두어 크게
                add('fab__' + normHex(drape.hex), drape.hex, r.W * 0.18, 0.45, 'x');      // 겉지는 걷어 두는 때가 많아 작게
            } else if (r.fabs.length) add('fab__' + normHex(r.fabs[0].hex), r.fabs[0].hex, r.W * 0.40, 0.45, 'x');
        });
        const ns = [...m.values()].map(n => ({ ...n, lab: labOf(n.hex) })).filter(n => n.lab);
        // 113번: 눈으로 같은 색(ΔE2000 3 이하)은 묶음. 벽·바닥끼리, 원단끼리 먼저. 그래도 많으면 가장 가까운 둘부터 합쳐 여덟 이하로
        const closest = (same, lim) => {
            let b = null;
            for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
                if (same && ns[i].g !== ns[j].g) continue;
                const d = techDE2000(ns[i].lab, ns[j].lab);
                if (d <= lim && (!b || d < b.d)) b = { i, j, d };
            }
            return b;
        };
        const join = p => {
            const x = ns[p.i], y = ns[p.j], t = (x.area + y.area) || 1;
            x.lab = { L: (x.lab.L * x.area + y.lab.L * y.area) / t, a: (x.lab.a * x.area + y.lab.a * y.area) / t, b: (x.lab.b * x.area + y.lab.b * y.area) / t };
            x.hex = RC.labToHex(x.lab.L, x.lab.a, x.lab.b); x.area = t; x.keys = x.keys.concat(y.keys);
            ns.splice(p.j, 1);
        };
        let p;
        while ((p = closest(true, JOGAK_DE))) join(p);
        while (ns.length > JOGAK_MAX && (p = closest(true, Infinity) || closest(false, Infinity))) join(p);
        // 한 색은 표지의 40%까지: 넘는 몫은 나머지 색에 비율대로 나눔 (흰 벽·흰 속지 집에서 흰색이 한 덩어리가 되지 않게)
        const tot = ns.reduce((s, n) => s + n.area, 0) || 1;
        ns.forEach(n => { n.share = n.area / tot; });
        if (ns.length > 1) for (let it = 0; it < 6; it++) {
            const over = ns.filter(n => n.share > JOGAK_SHARE);
            if (!over.length) break;
            let ex = 0; over.forEach(n => { ex += n.share - JOGAK_SHARE; n.share = JOGAK_SHARE; });
            const rest = ns.filter(n => n.share < JOGAK_SHARE), rs = rest.reduce((s, n) => s + n.share, 0);
            if (!rs) break;
            rest.forEach(n => { n.share += ex * n.share / rs; });
        }
        return ns;
    }
    // 칸 하나를 자름: 길쭉하면 긴 쪽을, 비슷하면 무작위. 40%는 정사각으로 잘라 냄. 가장 짧은 변 0.8(표지 높이 8%) 아래면 못 자름
    function jogakCut(c, rand, frac) {
        const vert = c.w / c.h > 1.25 ? true : c.h / c.w > 1.25 ? false : rand() < 0.5;      // true = 세로선으로 자름
        const len = vert ? c.w : c.h, other = vert ? c.h : c.w;
        let f;
        if (frac != null) f = frac;
        else { const r = rand(); f = r < 0.4 ? other / len : [0.38, 0.5, 0.62, 0.3, 0.7][Math.floor(rand() * 5)]; if (rand() < 0.5 && r < 0.4) f = 1 - f; }
        f = Math.max(JG_MIN / len, Math.min(1 - JG_MIN / len, f));
        if (len * f < JG_MIN || len * (1 - f) < JG_MIN) return null;
        return vert ? [{ x: c.x, y: c.y, w: c.w * f, h: c.h }, { x: c.x + c.w * f, y: c.y, w: c.w * (1 - f), h: c.h }]
                    : [{ x: c.x, y: c.y, w: c.w, h: c.h * f }, { x: c.x, y: c.y + c.h * f, w: c.w, h: c.h * (1 - f) }];
    }
    function buildJogakbo(data) {
        const RC = window.RoomColor;
        if (!RC || !RC.rgbToLab || !RC.labToHex || typeof techDE2000 !== 'function') return null;
        const rooms = jogakRooms(data);
        if (!rooms.length) return null;
        // 79번: 상담마다 정해진 조각보 번호로 만든 '정해진 순서의 무작위 수'(mulberry32)
        let seedState = (typeof window.getJogakboSeed === 'function' ? window.getJogakboSeed() : 1) >>> 0;
        const rand = () => {
            seedState = (seedState + 0x6D2B79F5) >>> 0;
            let t = seedState;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // 상담이 걸어온 길: 공간마다 벽·바닥을 잰 때 → 원단을 고른 때
        const steps = [];
        rooms.forEach((r, i) => {
            const before = rooms.slice(0, i);
            if ((r.wall || r.floor) && r.fabs.length) steps.push(before.concat([{ ...r, fabs: [] }]));
            steps.push(rooms.slice(0, i + 1));
        });
        const area = c => c.w * c.h, TOT = JG_W * JG_H;
        const touch = (a, b) => {
            const e = 0.01;
            const v = (Math.abs(a.x + a.w - b.x) < e || Math.abs(b.x + b.w - a.x) < e) && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > e;
            const h = (Math.abs(a.y + a.h - b.y) < e || Math.abs(b.y + b.h - a.y) < e) && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > e;
            return v || h;
        };
        let cells = null, nextId = 1, known = [], cs = [];
        steps.forEach(st => {
            cs = jogakColors(st);
            if (!cs.length) return;
            // 앞 단계 색과 잇기(키가 겹치면 같은 색). 묶여 사라진 색의 칸은 비워 둠 → 옆 색이 이어받음
            const used = new Set();
            cs.forEach(c => { const k = known.filter(o => !used.has(o.id) && o.keys.some(x => c.keys.includes(x))).sort((a, b) => a.id - b.id)[0]; if (k) { c.id = k.id; used.add(k.id); } });
            if (!cells) {
                cells = [{ x: 0, y: 0, w: JG_W, h: JG_H }];
                let guard = 0;
                while (cells.length < JG_START && guard++ < 200) {
                    let r = rand() * TOT, i = 0;
                    for (; i < cells.length; i++) { r -= area(cells[i]); if (r <= 0) break; }
                    i = Math.min(i, cells.length - 1);
                    const parts = jogakCut(cells[i], rand);
                    if (parts) cells.splice(i, 1, ...parts);
                }
            }
            cells.forEach(c => { if (c.col && !used.has(c.col)) c.col = null; });
            const byId = id => cs.find(c => c.id === id);
            const have = id => cells.filter(c => c.col === id).reduce((s, c) => s + area(c), 0) / TOT;
            const near = (cell, c) => cells.some(o => o !== cell && o.col && o.col !== c.id && touch(o, cell) && techDE2000(byId(o.col).lab, c.lab) < JOGAK_NEAR);
            // 새 색: 빈 칸이나 넘치는 색의 칸을 받음 → 맞는 칸이 없으면 칸 하나를 나눠 받음(꿰매 넣기)
            cs.filter(c => !c.id).sort((a, b) => b.share - a.share).forEach(c => {
                c.id = nextId++;
                const T = c.share * TOT;
                const free = cells.filter(x => !x.col);
                const donors = cells.filter(x => x.col && cells.filter(y => y.col === x.col).length > 1 && have(x.col) > byId(x.col).share);
                const pool = free.length ? free : donors;
                let best = null;
                pool.forEach(x => { const s = Math.abs(Math.log(area(x) / T)) + (near(x, c) ? 1.2 : 0) + rand() * 0.3; if (!best || s < best.s) best = { x, s }; });
                if (!best || area(best.x) > 1.9 * T) {
                    const over = cells.filter(x => x.col).sort((a, b) => (have(b.col) - byId(b.col).share) - (have(a.col) - byId(a.col).share) || area(b) - area(a));
                    const tgt = (best && area(best.x) > 1.9 * T) ? best.x : (over[0] || cells.slice().sort((a, b) => area(b) - area(a))[0]);
                    const parts = jogakCut(tgt, rand, rand() < 0.5 ? T / area(tgt) : null) || jogakCut(tgt, rand);
                    if (parts) {
                        const i = cells.indexOf(tgt), keep = tgt.col;
                        const pick = Math.abs(area(parts[0]) - T) < Math.abs(area(parts[1]) - T) ? 0 : 1;
                        parts[pick].col = c.id; parts[1 - pick].col = keep;
                        cells.splice(i, 1, ...parts);
                        return;
                    }
                }
                if (best) best.x.col = c.id;
            });
            // 빈 칸: 모자란 색부터 채움(비슷한 색과 붙지 않게)
            cells.filter(x => !x.col).sort((a, b) => area(b) - area(a)).forEach(x => {
                let bc = null;
                cs.forEach(c => { const s = (c.share - have(c.id)) - (near(x, c) ? 0.15 : 0); if (!bc || s > bc.s) bc = { c, s }; });
                x.col = bc.c.id;
            });
            known = cs.map(c => ({ id: c.id, keys: c.keys }));
        });
        if (!cells) return null;
        const hexOf = id => { const c = cs.find(x => x.id === id); return c ? c.hex : '#efe9df'; };
        return { cells: cells.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h, hex: hexOf(c.col) })) };
    }
    // 화면용 그림(표지·중심 화면): 칸을 % 자리로. 칸 사이 틈은 gap px. newKeys가 있으면 새로 생긴 칸에 is-new(꿰매 넣는 움직임)
    function jogakboHtml(jg, gap, prevKeys) {
        if (!jg) return '<div class="jg-cv is-empty"><i class="jg-cv-dot" aria-hidden="true"></i></div>';
        const g = gap / 2;
        return '<div class="jg-cv" aria-hidden="true">' + jg.cells.map(c => {
            const isNew = prevKeys && !prevKeys.has(jogakKey(c));
            return `<span class="jg-c${isNew ? ' is-new' : ''}" style="left:calc(${c.x / JG_W * 100}% + ${g}px);top:calc(${c.y / JG_H * 100}% + ${g}px);width:calc(${c.w / JG_W * 100}% - ${gap}px);height:calc(${c.h / JG_H * 100}% - ${gap}px);background:${c.hex}"></span>`;
        }).join('') + '</div>';
    }
    const jogakKey = c => [c.x, c.y, c.w, c.h].map(v => v.toFixed(3)).join(',') + c.hex;
    // 중심 화면 왼쪽 위 작은 조각보: 지난번 그림과 비교해 새로 생긴 칸만 서서히 나타남
    let lastMiniKeys = null;
    function jogakboMiniHtml() {
        const jg = buildJogakbo(null);
        const html = jogakboHtml(jg, 3, lastMiniKeys);
        lastMiniKeys = new Set(jg ? jg.cells.map(jogakKey) : []);
        return html;
    }
    function buildJogakboHtml(data) { return jogakboHtml(buildJogakbo(data), 6, null); }

    // 공간별 쇼룸 시트에 들어갈 내용 (80번: 화면과 저장 이미지가 같이 씀)
    //  { rm, name, sz, compLabel, dirTxt, metaLine(값만 한 줄), st(창가 색 띠), paras(① 들은 말 · ② 본 것 · ③ 고른 것, 83번), commentTxt, sets(원단별 ④ 원단 줄), back·front(겹침 스와치: 겉지 뒤·속지 앞, 한 장이면 null), night }
    const COMP_SAY = { double: '속지와 겉지', sheer_only: '속지', drape_only: '겉지', blind_only: '블라인드' };      // 83번 문장표 1장
    function showroomRowsOf(data) {
        const whyInfo = (typeof whySetsOf === 'function') ? whySetsOf(data) : { rooms: [] };
        const allSp = (typeof houseSpacesOf === 'function') ? houseSpacesOf(data) : [];
        return (data.rooms || []).filter(r => r.items && r.items.length).map(rm => {
            const R = (whyInfo.rooms || []).find(x => x.name === rm.name) || null;
            const s = allSp.find(x => x.name === rm.name) || null;
            const cartRoom = state.roomsCart.find(r => r.name === rm.name);
            const raw = cartRoom || rm.raw || rm || {};
            const sz = roomSize(raw), comp = roomComp(raw);
            const dirTxt = (R && R.dirText) || (raw.windowDir ? windowDirText(windowDirOf(raw.windowDir)) : '');
            const st = (s && typeof houseStripOf === 'function') ? houseStripOf(s, raw) : null;
            const seenLines = (s && typeof houseDiagnosis === 'function') ? houseDiagnosis(s, raw, R ? R.sameAs : '') : [];
            const paraParts = [{ k: 'heard', t: R ? R.heard : '' }, { k: 'seen', t: seenLines.join(' ') }, { k: 'chose', t: (R && R.chose) ? R.chose.join(' ') : '' }].filter(p => p.t);      // 132번: 단락마다 글자 크기가 달라 종류를 같이 넘김
            const paras = paraParts.map(p => p.t);      // 네 칸 단락 ①②③ (83번)
            const metaLine = [dirTxt ? dirTxt + '향' : '', sz ? `${sz.w} × ${sz.h}` : '', COMP_SAY[comp] || ''].filter(Boolean).join(' · ');
            const sets = (R && R.sets && R.sets.length) ? R.sets : (rm.items || []).map(it => ({
                it, hex: it.fill || '', lines: it.reason ? [it.reason] : [], note: ''
            }));
            let back = null, front = null;
            if (sets.length >= 2) {
                // 78번: 방 안에서 사람이 체감하는 느낌(겉지가 바깥 틀, 속지가 안쪽 주인공)에 맞춰 겉지를 뒤, 속지를 앞에 배치
                back = sets.find(x => x.it.kindKey === 'drape' || x.it.kind === '겉지') || sets[0];
                front = sets.find(x => x !== back && (x.it.kindKey === 'sheer' || x.it.kind === '속지')) || sets.find(x => x !== back) || sets[1];
            }
            return { rm, name: rm.name, sz, compLabel: COMP_NAMES[comp] || '', dirTxt, metaLine, st, paras, paraParts, commentTxt: paras.join(' '),
                sets, back, front, night: !!(R && R.night && typeof SHEER_NIGHT_NOTE === 'string') };
        });
    }

    // 144번: 위아래로 넘길 때 목차가 지금 보는 구획을 따라감 (화면 위에서 1/3 선을 지난 마지막 구획). 표지에서는 표시 없음, 맨 아래면 마지막 구획
    function bindFinalNavSpy(box) {
        const stage = box.closest('.fin-stage');
        const btns = Array.from(box.querySelectorAll('.fin-ed-nav button[data-sec]'));
        if (!stage || !btns.length) return;
        if (stage.__navSpy) stage.removeEventListener('scroll', stage.__navSpy);      // 다시 그릴 때 예전 것을 떼어 냄
        let queued = false;
        const update = () => {
            queued = false;
            const line = stage.getBoundingClientRect().top + stage.clientHeight / 3;
            let cur = -1;
            btns.forEach((b, i) => { const sec = document.getElementById(b.dataset.sec); if (sec && sec.getBoundingClientRect().top <= line) cur = i; });
            if (cur >= 0 && stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 4) cur = btns.length - 1;
            btns.forEach((b, i) => { const on = i === cur; if (b.classList.contains('is-here') !== on) b.classList.toggle('is-here', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
        };
        stage.__navSpy = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
        stage.addEventListener('scroll', stage.__navSpy, { passive: true });
        update();
    }

    function renderFinalEditorial() {
        const box = document.getElementById('finEditorial');
        if (!box || typeof ticketData !== 'function') return;
        syncToV1MasterRooms();
        const data = ticketData();
        const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
        const showHouse = (typeof houseShows === 'function') && houseShows(data);
        const allSp = (typeof houseSpacesOf === 'function') ? houseSpacesOf(data) : [];
        const sp = showHouse ? allSp : [];
        const configuredRooms = (data.rooms || []).filter(r => r.items && r.items.length);

        let h = '<div class="fin-ed-bar">';
        h += '<button type="button" class="fin-ed-back" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가·수정</button>';
        h += '<nav class="fin-ed-nav" aria-label="제안서 목차">';
        if (showHouse) h += '<button type="button" data-sec="finSecHouse" onclick="window.concierge.scrollFinalSec(\'finSecHouse\')">공간의 색과 빛</button>';
        if (configuredRooms.length) h += '<button type="button" data-sec="finSecWhy" onclick="window.concierge.scrollFinalSec(\'finSecWhy\')">공간 제안</button>';
        h += '<button type="button" data-sec="finSecEst" onclick="window.concierge.scrollFinalSec(\'finSecEst\')">견적서</button>';
        const night = (typeof houseNightOf === 'function') ? houseNightOf(data) : null;      // 131번
        if (night) h += '<button type="button" data-sec="finSecNight" onclick="window.concierge.scrollFinalSec(\'finSecNight\')">공간의 밤</button>';
        h += '<button type="button" class="is-save" onclick="window.concierge.saveQuote()">견적서 저장</button>';
        h += '</nav></div>';

        h += '<article class="fin-ed-doc jg-doc">';

        // [표지] 16:10 조각보(79번) + 아래에 "빛을, / 다시 담습니다"(명조) · 로고 (132번) — 142번: 소개 문구 빼고 그림 아래 오른쪽 한 줄
        //  로고는 S펜으로 톡(PC는 마우스로 1초) 누르면 직원 화면 PIN 창(data-staff-hold)이라 자리만 아래로 옮김
        h += '<section class="jg-cover-sec">';
        h += `<div class="jg-canvas-wrap"><div class="jg-canvas">${buildJogakboHtml(data)}</div></div>`;
        if (typeof coverCaptionOf === 'function') h += `<p class="jg-cover-cap">${esc(coverCaptionOf(data))}</p>`;      // 142번(B-5)
        h += '<footer class="jg-cover-foot"><div><div class="jg-cover-poem font-serif-kr">빛을,<br>다시 담습니다</div></div>';
        h += '<div class="fin-ed-logo font-serif-kr" data-staff-hold>' + redamLogoSVG() + '</div></footer>';
        h += '</section>';

        // [공간의 색과 빛] 132번: 사분면을 살려 도록의 말로 — 읽는 법 한 문장 → 색 조각 지도(범례 없음) → 공간별 문장 → 집 전체 총평
        if (showHouse) {
            const brief = (typeof houseBrief === 'function') ? houseBrief(sp) : [];
            const roomLines = (typeof houseRoomLines === 'function') ? houseRoomLines(sp) : [];
            const hasLine = sp.some(s => s.wall && s.floor);
            h += '<section class="jg-overview" id="finSecHouse">';
            h += '<div class="jg-sec-head"><h2 class="jg-sec-ttl font-serif-kr">공간의 색과 빛</h2></div>';
            if (hasLine && typeof HOUSE_MAP_LEAD === 'string') h += `<p class="jg-map-lead font-serif-kr">${esc(HOUSE_MAP_LEAD)}</p>`;
            h += `<div class="jg-map-box"><canvas id="finEdMapCanvas" class="fin-ed-map" width="${(typeof HOUSE_MAP_W === 'number' ? HOUSE_MAP_W : 900) * 2}" height="${(typeof HOUSE_MAP_H === 'number' ? HOUSE_MAP_H : 470) * 2}"></canvas></div>`;
            if (sp.length > 1) {
                // 141번(B-4 결정): 공간 이름 줄은 지도 아래(명조 22), 고른 이름 앞 흙빛 점 → 바로 아래 그 공간 문장 한 줄(17, 옅게). 처음엔 첫 공간
                h += '<div class="jg-map-rooms" role="group" aria-label="공간">' + sp.map((s, i) => `<button type="button" class="font-serif-kr" data-map-room="${i}">${esc(s.name)}</button>`).join('') + '</div>';
                h += '<p class="jg-map-say" id="finMapSay"></p>';
            } else if (roomLines.length) h += '<div class="jg-map-read">' + roomLines.map(r => `<div><p>${esc(r.text)}</p></div>`).join('') + '</div>';
            if (brief.length) h += `<div class="jg-lead-line"><p class="jg-lead-quote font-serif-kr">${esc(brief.join(' '))}</p></div>`;      // 148번: 선은 본문 폭 끝까지, 글만 46em
            h += '</section>';
        }

        // [본문] 공간별 완결형 쇼룸 시트 (좌측 26% 공간 스펙 + 우측 74% 창가 입면 색띠·진단·겹침 스와치·원단 설명, 76번)
        if (configuredRooms.length) {
            h += '<section class="jg-showrooms" id="finSecWhy">';
            h += '<div class="jg-sec-head"><h2 class="jg-sec-ttl font-serif-kr">공간 제안</h2></div>';      // 148번: 구획 제목(40) 아래 공간 이름(28)
            showroomRowsOf(data).forEach(row => {
                const { rm, metaLine, st, paraParts, sets, back, front, night } = row;
                // 132번: 비어 있던 왼쪽 칸(공간 이름 아래)에 원단 견본 — 겉지 뒤, 속지 앞으로 겹침
                let swHtml = '';
                if (sets.length) {
                    swHtml = back
                        ? `<div class="jg-layered-sw"><div class="jg-sw-back" style="${fabricFillStyle(back.it.fabricId, back.it.colorName)}"></div><div class="jg-sw-front" style="${fabricFillStyle(front.it.fabricId, front.it.colorName)}"></div></div>`
                        : `<div class="jg-sw-single" style="${fabricFillStyle(sets[0].it.fabricId, sets[0].it.colorName)}"></div>`;
                }

                h += '<div class="jg-showroom">';
                h += '<div class="jg-sr-left">';
                h += `<h3 class="jg-sr-name font-serif-kr">${esc(rm.name)}</h3>`;
                if (metaLine) h += `<div class="jg-sr-meta is-line">${esc(metaLine)}</div>`;      // 83번: 이름표 없이 값만 한 줄
                if (swHtml) h += `<div class="jg-sr-sw">${swHtml}</div>`;
                h += '</div>';

                h += '<div class="jg-sr-right">';
                // 142번(B-5): 창가 색 띠 뺌 — 오른쪽 글은 들은 말부터
                // ① 들은 말(명조 22) → ② 본 것(17 muted) → ③ 고른 것(17) (83번 · 132번)
                paraParts.forEach(p => { h += `<p class="jg-sr-comment is-${p.k}${p.k === 'heard' ? ' font-serif-kr' : ''}">${esc(p.t)}</p>`; });

                if (sets.length) {
                    const descsHtml = sets.map(sItem => {
                        const baseName = sItem.it.name;
                        const hideKind = sItem.it.kind === '블라인드' && baseName.includes('블라인드');
                        return `<div class="jg-fab-block">`
                            + (hideKind ? '' : `<div class="jg-fab-k"><span>${esc(sItem.it.kind)}</span></div>`)      // 132번: 색 코드는 뺌
                            + `<h4 class="jg-fab-title font-serif-kr">${esc(baseName)}</h4>`
                            + (sItem.lines && sItem.lines.length ? `<p class="jg-fab-desc">${esc(sItem.lines.join(' '))}</p>` : '')
                            + (sItem.note ? `<p class="jg-fab-note">${esc(sItem.note)}</p>` : '')
                            + `</div>`;
                    }).join('');
                    h += `<div class="jg-sr-descs">${descsHtml}</div>`;
                }
                if (night) {
                    h += `<p class="jg-fab-note jg-night-note">${esc(SHEER_NIGHT_NOTE)}</p>`;
                }
                h += '</div></div>';
            });
            h += '</section>';
        }

        // [마지막 섹션] 호텔 인보이스 스타일 견적서 (0.5px 초세선, 76번)
        h += '<section class="jg-invoice-sec" id="finSecEst">';
        h += '<div class="jg-sec-head" style="margin-bottom:2rem;"><h2 class="jg-sec-ttl font-serif-kr">견적서</h2></div>';
        h += `<div class="fin-est-meta"><span class="font-serif-kr">${esc(data.recipient)}</span><span class="fin-est-date">${esc(String(data.date || '').replace(/\./g, '. '))}${data.validText ? ' · ' + esc(data.validText) : ''}</span></div><div class="fin-est-table">`;
        const estRooms = (data.rooms || []).concat(data.light ? [data.light] : []);
        const oneRoom = estRooms.filter(r => r.items && r.items.length).length === 1;      // 143번: 공간 하나면 공간 이름 머리줄 뺌 (이름이 너무 되풀이됨, 합계는 아래에)
        estRooms.forEach(room => {      // 131번: 빛 묶음은 맨 뒤
            h += '<div class="fin-est-space">';
            if (!oneRoom) h += `<div class="fin-est-hd"><span class="fin-est-rname font-serif-kr">${esc(room.name)}</span>${room.sampleOnly ? '' : `<span class="fin-est-rsum font-serif-kr">${room.total.toLocaleString()}원</span>`}</div>`;
            (room.items || []).forEach(it => {
                h += '<div class="fin-est-line">';
                h += `<div class="fin-est-chip" style="${room.isLight ? `background:${it.fill}` : fabricFillStyle(it.fabricId, it.colorName)}"></div>`;
                h += `<span class="fin-est-k">${esc(it.kind)}</span>`;
                h += `<span class="fin-est-nm font-serif-kr">${esc(it.bookName || it.name)}${it.meta ? `<small>${esc(it.meta)}</small>` : ''}</span>`;
                h += `<span class="fin-est-sz">${esc(it.size || '')}</span>`;
                h += `<span class="fin-est-pr font-serif-kr">${it.sampleOnly ? '' : `${it.price.toLocaleString()}원`}</span>`;
                h += '</div>';
            });
            h += '</div>';
        });
        // 145번: 견적서 기본 공간 = 공간 3개(각 겉지·속지 두 줄). 모자라면 보이지 않는 빈 묶음으로 자리만 채움
        const blankLine = '<div class="fin-est-line"><div class="fin-est-chip"></div><span class="fin-est-k">겉지</span><span class="fin-est-nm font-serif-kr">-</span><span class="fin-est-sz">-</span><span class="fin-est-pr">-</span></div>';
        for (let i = estRooms.length; i < 3; i++) h += `<div class="fin-est-space is-blank" aria-hidden="true"><div class="fin-est-hd"><span class="fin-est-rname font-serif-kr">-</span></div>${blankLine}${blankLine}</div>`;
        h += '</div>';
        h += '<div class="fin-est-foot">';
        // 132번: 손님 화면에서는 입력 칸 대신 글자 "30,000원"(고치는 것은 직원 화면 견적 칸) + 부가세 줄(일반 판매가 "포함" / 세금계산서 10% 금액)
        h += '<div class="fin-est-sums">';
        if (data.install > 0) h += `<div class="fin-est-install"><span>시공 및 설치비</span><span class="font-serif-kr">${Number(data.install).toLocaleString()}원</span></div>`;
        if (data.vatText) h += `<div class="fin-est-install"><span>${esc(data.vatLabel || '부가세')}</span><span class="font-serif-kr">${esc(data.vatText)}</span></div>`;
        h += '</div>';
        h += `<div class="fin-est-total-row"><span class="fin-est-total-lbl">${esc(data.totalLabel || '합계 금액 (시공비 포함)')}</span><span class="fin-est-total-num font-serif-kr"><span id="finEdTotalNum">${esc(data.total)}</span><small>원</small></span></div>`;
        const infoRows = [
            ['리담의 약속', data.promise],      // 159번
            ['안내', data.note],
            ['결제 조건', data.pay],
            ['맞춤 제작 안내', data.custom],
            ['공급자', data.supplier]
        ].filter(([, v]) => v && String(v).trim());
        if (infoRows.length) {
            h += '<dl class="fin-est-dl">' + infoRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v).trim()).replace(/\r?\n/g, '<br>')}</dd>`).join('') + '</dl>';
        }
        h += '</div></section>';

        // [이 집의 밤] 131번: 표지 조각보를 지금의 방등 / 권하는 빛 아래 두 장 + 시간 순서 글 + 제품 카드 (ticket.js houseNightOf, 저장 이미지와 같은 글)
        if (night) {
            const cv = cells => '<div class="jg-cv">' + cells.map(c => `<span class="jg-c" style="left:calc(${c.x / 16 * 100}% + 1.5px);top:calc(${c.y / 10 * 100}% + 1.5px);width:calc(${c.w / 16 * 100}% - 3px);height:calc(${c.h / 10 * 100}% - 3px);background:${c.hex}"></span>`).join('') + '</div>';
            h += '<section class="fin-night" id="finSecNight">';
            h += `<div class="fin-night-top"><h2 class="fin-night-ttl font-serif-kr">공간의 밤</h2></div>`;
            h += '<div class="fin-night-pair">' + [night.before, night.after].map((cells, i) => `<figure><div class="fin-night-q">${cv(cells)}</div><figcaption>${esc(night.caps[i])}</figcaption></figure>`).join('') + '</div>';
            h += '<div class="fin-night-times">' + night.times.map(t => `<div><h3 class="font-serif-kr">${esc(t.t)}</h3><p class="font-serif-kr">${esc(t.p)}</p></div>`).join('') + '</div>';
            const spec = night.lamp.spec.map(x => x === night.lamp.kTxt ? `<em>${esc(x)}</em>` : esc(x)).join(' · ');
            const lampSvg = '<svg viewBox="0 0 44 64" aria-hidden="true"><path d="M12 10 L32 10 L27 18 L17 18 Z" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="22" y1="18" x2="22" y2="60" stroke="currentColor" stroke-width="1.2"/><line x1="15" y1="60" x2="29" y2="60" stroke="currentColor" stroke-width="1.2"/><path d="M14 6 L22 1 L30 6" fill="none" stroke="#e9a868" stroke-width="1"/></svg>';      // 136번: 상향식 스탠드 그림 (131 시안)
            const A = night.lamp.alt;      // 146번: 라인조명 카드 (스탠드 아래 한 자리)
            const lineSvg = '<svg viewBox="0 0 44 64" aria-hidden="true"><rect x="4" y="6" width="36" height="8" fill="none" stroke="currentColor" stroke-width="1.2"/><line x1="7" y1="17" x2="37" y2="17" stroke="#e9a868" stroke-width="1.6"/><path d="M10 21 L6 58 M22 21 L22 58 M34 21 L38 58" stroke="#e9a868" stroke-width="1" opacity=".5"/></svg>';
            const aSpec = A ? A.spec.map(x => x === A.kTxt ? `<em>${esc(x)}</em>` : esc(x)).join(' · ') : '';
            h += `<div class="fin-night-base"><div class="fin-night-cards"><div class="fin-night-card">${lampSvg}<div><div class="font-serif-kr">${esc(night.lamp.title)}</div><div class="fin-night-spec">${spec}</div></div></div>`;
            if (A) h += `<div class="fin-night-card">${lineSvg}<div><div class="font-serif-kr">${esc(A.title)}</div><div class="fin-night-spec">${aSpec}</div><p class="fin-night-say">${esc(A.say)}</p></div></div>`;
            h += '</div>';
            h += `<dl>${night.lamp.rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join('')}</dl></div>`;      // 136번: 색온도·연색성 풀이 + 구매·맡기기
            h += '</section>';
        }

        // [맺음] 132번: 견적서 아래 시를 떼어 어두운 바탕 한 장으로 — 금액이 마지막 인상이 되지 않게
        h += '<footer class="fin-ed-closing"><div class="fin-closing-poem font-serif-kr">빛을,<br>다시 담습니다</div><div class="fin-closing-mark font-serif-kr">' + redamLogoSVG() + '</div></footer>';
        // 148번: 맺음 아래 "카톡 글 복사" 줄과 그 위 선을 뺌 (저장 이미지가 메인)
        h += '</article>';

        box.innerHTML = h;
        bindFinalNavSpy(box);      // 144번
        if (showHouse && typeof drawHouseMap === 'function') {
            const cv = document.getElementById('finEdMapCanvas');
            if (cv) {
                const many = sp.length > 1;      // 141번: 공간이 둘 이상이면 한 공간씩 진하게
                const lines = (typeof houseRoomLines === 'function') ? houseRoomLines(sp) : [];
                let hits = [];
                const paint = sel => {
                    const ctx = cv.getContext('2d');
                    ctx.save();
                    ctx.scale(2, 2);
                    ctx.fillStyle = '#fffdf9';      // 132번: 상자 없이 종이 위에 바로 (도록의 말)
                    ctx.fillRect(0, 0, cv.width / 2, cv.height / 2);
                    hits = drawHouseMap(ctx, sp, '#fffdf9', many ? { sel } : undefined) || [];
                    ctx.restore();
                    if (!many) return;
                    box.querySelectorAll('[data-map-room]').forEach(b => { const on = +b.dataset.mapRoom === sel; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
                    const say = document.getElementById('finMapSay'), ln = lines.find(r => r.name === sp[sel].name);
                    if (say) say.textContent = ln ? ln.text : '';
                };
                paint(0);
                if (many) {
                    box.querySelectorAll('[data-map-room]').forEach(b => b.addEventListener('click', () => paint(+b.dataset.mapRoom)));
                    // 흐린 조각을 눌러도 그 공간으로 (지도 좌표 900×520)
                    cv.addEventListener('click', e => {
                        const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (cv.width / 2) / r.width, y = (e.clientY - r.top) * (cv.height / 2) / r.height;
                        const hit = hits.find(q => x >= q.x1 && x <= q.x2 && y >= q.y1 && y <= q.y2);
                        if (hit && typeof hit.room === 'number') paint(hit.room);
                    });
                }
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
        const groupOf = k => k < finalHouseCount ? 'house' : (k < finalCardCount ? 'why' : (finalNightAt >= 0 && k >= finalNightAt ? 'night' : 'ticket'));      // 131번: 밤 장부터 끝(맺음)까지 'night'
        const nextWord = { why: '공간 제안', ticket: '견적서 보기', night: '공간의 밤' }, prevWord = { house: '공간의 색과 빛', why: '공간 제안', ticket: '견적서' };
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
            const { canvases, cardCount, houseCount, nightAt } = await window.makeTicketBlobs({ canvasOnly: true, pixelRatio: 1.5 });
            const box = document.getElementById('finPaper');
            if (seq !== finalPaperSeq || !box || state.step !== "7-Final-Dossier") return;      // 그리는 사이 화면이 바뀌었으면 버림
            box.innerHTML = '';
            finalCardCount = cardCount || 0;
            finalHouseCount = houseCount || 0;
            finalNightAt = typeof nightAt === 'number' ? nightAt : -1;
            canvases.forEach((c, k) => {
                const img = document.createElement('img');
                img.alt = k < finalHouseCount ? '공간의 색과 빛' : ((k < finalCardCount) ? '공간 제안' : (finalNightAt >= 0 && k >= finalNightAt ? '공간의 밤' : '견적서'));
                img.src = c.toDataURL('image/png');
                box.appendChild(img);
            });
            setFinalPage(finalPage);
            bindFinalSwipe(box);
        } catch (e) {
            console.error(e);
            const box = document.getElementById('finPaper');
            if (box) box.innerHTML = '<p class="fin-wait font-serif-kr">견적서를 그리지 못했습니다. 다시 열어 주세요</p>';
        }
    }

    // 130-4③: concierge.js가 쪽 번호를 묻고(뒤로 가기), 최종 제안을 처음 열 때 첫 쪽으로, 시공비를 고치면 종이를 다시 그림
    function finalPageNow() { return finalPage; }
    function resetFinalPage() { finalPage = 0; finalZoom = false; }
    function queueFinalPaper() {
        clearTimeout(finalPaperTimer);
        finalPaperTimer = setTimeout(renderFinalPaper, 350);
    }
    Object.assign(cz, { buildJogakbo, jogakboMiniHtml, showroomRowsOf, renderFinalEditorial, setFinalPage, finalPageNow, resetFinalPage, queueFinalPaper });      // concierge.js가 부름
    Object.assign(window.concierge, {
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
    });
})();
