(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['room-color.js']='20261023';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// 방 벽·바닥 색 재기 (작업목록 15번, 직원 화면 전용)
//  - 걸레받이에 회색·흰 카드를 기대어 놓고 찍은 사진 한 장(필요하면 벽 사진 한 장 더)
//  - ① 회색 카드 → ② 흰 카드 → ③ 바닥 → ④ 벽 순서로 누르면, 누른 자리 주변 21×21px 평균색을
//    두 카드 기준으로 보정해 Lab으로 계산합니다.
//  - 사진은 어디에도 저장하지 않습니다(창을 닫으면 사라짐). 측정값만 공간에 남깁니다.
// ==============================================================
(function () {
    const GRAY_L = 50, WHITE_L = 95;          // 카드 목표 밝기 (회색 카드 L50, 흰 카드 L95)
    const SAMPLE = 21;                        // 카드: 누른 자리 주변 21×21px 평균
    const AREA_R = 0.07;                      // 바닥·벽: 반지름 = 사진 짧은 쪽의 7% (1600×1200 사진이면 지름 약 170px)
    const MULTI = { floor: true, wall: true };// 여러 곳을 눌러 평균하는 자리
    const MAX_POINTS = 3;                     // 3곳까지 (넷째를 누르면 가장 먼저 누른 곳이 빠짐)
    const AREA_TRIM = 0.15;                   // 바닥·벽: 가장 어두운 15% · 가장 밝은 15%는 빼고 평균
    const SHADOW_DL = 6.0;                    // 카드 안 위아래·좌우 밝기 차이가 이 이상이면 그림자 안내
    const LIGHT_HI = 78, LIGHT_LO = 52;       // 밝기 3단계 (임시값 — 현장 시험 뒤 확정)
    const DEEP_L = 40;                        // 이보다 어두우면 톤은 "딥"
    const BRIDGE_WALL_WEIGHT = 0.65;          // 이어주는 색의 밝기: 벽 6.5 : 바닥 3.5 (임시값 — 방 3~5곳 현장 시험 뒤 사장님이 정함)
    const BRIDGE_WALL_WEIGHT_AB = 0.55;       // 이어주는 색의 색기(a·b): 벽 5.5 : 바닥 4.5 (시안 값, 같이 시험)
    const MAX_SIDE = 1600;                   // 사진은 긴 쪽 1600px로 줄여서 씀 (탭 메모리)

    const STEPS = [
        { key: 'gray',  label: '① 회색 카드', sub: '카드 가운데', color: '#595959' },
        { key: 'white', label: '② 흰 카드',   sub: '카드 가운데', color: '#b0a89e' },
        { key: 'floor', label: '③ 바닥',      sub: '마루·타일',   color: '#8a4a22' },
        { key: 'wall',  label: '④ 벽',        sub: '벽지·도장',   color: '#2b221a' }
    ];

    // st: 지금 열린 측정 창 상태. photos[0] = 카드가 있는 사진, photos[1] = 따로 찍은 벽 사진
    let st = null;

    // ---- 색 계산 ----
    const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    function rgbToLab(r, g, b) { return linToLab(toLin(r), toLin(g), toLin(b)); }
    function linToLab(R, G, B) {
        const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
        const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
        const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
        const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
        const fx = f(X), fy = f(Y), fz = f(Z);
        return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
    }
    function labToHex(L, a, b) {
        const fy = (L + 16) / 116, fx = a / 500 + fy, fz = fy - b / 200;
        const inv = t => { const t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; };
        const X = inv(fx) * 0.95047, Y = inv(fy), Z = inv(fz) * 1.08883;
        const out = [
            X * 3.2406 + Y * -1.5372 + Z * -0.4986,
            X * -0.9689 + Y * 1.8758 + Z * 0.0415,
            X * 0.0557 + Y * -0.2040 + Z * 1.0570
        ].map(c => {
            c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
            return Math.max(0, Math.min(255, Math.round(c * 255)));
        });
        return '#' + out.map(x => x.toString(16).padStart(2, '0')).join('');
    }
    // 밝기 3단계 + 톤 (원단 색 분류와 같은 규칙: 딥 = L<40, 웜 = b≥4.6 또는 a≥3, 쿨 = b≤−2 또는 a≤−2)
    function classifyLab(c) {
        let tone = 'neutral', toneWord = '뉴트럴';
        if (c.L < DEEP_L) { tone = 'deep'; toneWord = '딥'; }
        else if (c.b >= 4.6 || c.a >= 3) { tone = 'warm'; toneWord = '웜'; }
        else if (c.b <= -2 || c.a <= -2) { tone = 'cool'; toneWord = '쿨'; }
        const light = c.L >= LIGHT_HI ? 'light' : (c.L >= LIGHT_LO ? 'mid' : 'dark');
        const lightWord = { light: '밝은', mid: '중간', dark: '어두운' }[light];
        return { tone, toneWord, light, lightWord, text: `${lightWord} ${toneWord}` };
    }

    // 누른 자리 주변 평균색(Lab)과 카드 안 밝기 차이(위아래·좌우 중 큰 쪽)
    function samplePin(pin) {
        const cv = st.photos[pin.v];
        if (!cv) return null;
        const half = (SAMPLE - 1) / 2;
        const cx = Math.max(half, Math.min(cv.width - half - 1, Math.round(pin.x * cv.width)));
        const cy = Math.max(half, Math.min(cv.height - half - 1, Math.round(pin.y * cv.height)));
        const d = cv.getContext('2d').getImageData(cx - half, cy - half, SAMPLE, SAMPLE).data;
        let r = 0, g = 0, b = 0;
        const third = Math.floor(SAMPLE / 3);
        const side = { top: [0, 0], bot: [0, 0], left: [0, 0], right: [0, 0] };
        for (let y = 0; y < SAMPLE; y++) {
            for (let x = 0; x < SAMPLE; x++) {
                const i = (y * SAMPLE + x) * 4;
                r += d[i]; g += d[i + 1]; b += d[i + 2];
                const l = rgbToLab(d[i], d[i + 1], d[i + 2]).L;
                const add = k => { side[k][0] += l; side[k][1]++; };
                if (y < third) add('top'); else if (y >= SAMPLE - third) add('bot');
                if (x < third) add('left'); else if (x >= SAMPLE - third) add('right');
            }
        }
        const n = SAMPLE * SAMPLE, avg = k => side[k][0] / side[k][1];
        return {
            lin: [toLin(r / n), toLin(g / n), toLin(b / n)],
            lab: rgbToLab(r / n, g / n, b / n),
            diff: Math.max(Math.abs(avg('top') - avg('bot')), Math.abs(avg('left') - avg('right')))
        };
    }

    // 바닥·벽: 무늬(나뭇결·타일 줄눈·벽지 결)가 있어도 누른 자리에 따라 색이 흔들리지 않게
    // 누른 자리 둘레 넓은 동그라미(사진 짧은 쪽의 AREA_R) 안을 평균. 밝기 순으로 아래·위 TRIM씩(틈·옹이·반사)은 뺌
    function sampleArea(pin) {
        const cv = st.photos[pin.v];
        if (!cv) return null;
        const R = areaRadiusPx(cv);
        const cx = Math.max(R, Math.min(cv.width - R - 1, Math.round(pin.x * cv.width)));
        const cy = Math.max(R, Math.min(cv.height - R - 1, Math.round(pin.y * cv.height)));
        const size = 2 * R + 1;
        const d = cv.getContext('2d').getImageData(cx - R, cy - R, size, size).data;
        const step = Math.max(1, Math.round(R / 40));          // 점이 너무 많으면 건너뛰며 (많아야 약 5천 개)
        const px = [];
        for (let y = -R; y <= R; y += step) {
            for (let x = -R; x <= R; x += step) {
                if (x * x + y * y > R * R) continue;
                const i = ((y + R) * size + (x + R)) * 4;
                const lr = toLin(d[i]), lg = toLin(d[i + 1]), lb = toLin(d[i + 2]);
                px.push([lr, lg, lb, 0.2126 * lr + 0.7152 * lg + 0.0722 * lb]);
            }
        }
        px.sort((p, q) => p[3] - q[3]);
        const cut = Math.floor(px.length * AREA_TRIM), kept = px.slice(cut, px.length - cut);
        const lin = [0, 1, 2].map(k => kept.reduce((s, p) => s + p[k], 0) / kept.length);
        return { lin, lab: linToLab(lin[0], lin[1], lin[2]), diff: 0 };
    }
    // 누른 점: st.pins[자리] = [{ v: 사진 번호, x, y }, …]. 카드는 1곳, 바닥·벽은 MAX_POINTS곳까지 (평균)
    function pinsOf(key) { return (st && st.pins[key]) || []; }
    function dropPins(v) {      // 그 사진에 찍은 점은 모두 지움 (사진을 바꾸거나 뺄 때)
        Object.keys(st.pins).forEach(k => { st.pins[k] = st.pins[k].filter(p => p.v !== v); if (!st.pins[k].length) delete st.pins[k]; });
    }
    function areaRadiusPx(cv) { return Math.max(12, Math.round(Math.min(cv.width, cv.height) * AREA_R)); }

    // 두 카드로 보정: 빨강·초록·파랑을 따로, 회색 카드는 L50 회색 · 흰 카드는 L95 흰색이 되도록 곧게 늘임
    // (카메라의 노출과 색 틀어짐을 함께 바로잡음. Lab에서 색기만 빼는 것보다 진한 색에서 정확)
    function compute() {
        const s = {};
        STEPS.forEach(stp => {
            const ps = pinsOf(stp.key);
            if (!ps.length) { s[stp.key] = null; return; }
            if (!MULTI[stp.key]) { s[stp.key] = samplePin(ps[0]); return; }      // 카드는 작은 칸 하나
            // 바닥·벽: 누른 곳마다 넓은 동그라미 평균 → 그것들을 다시 평균 (판자·타일마다 색이 다른 바닥)
            const parts = ps.map(sampleArea).filter(Boolean);
            const lin = [0, 1, 2].map(k => parts.reduce((t, p) => t + p.lin[k], 0) / parts.length);
            s[stp.key] = { lin, lab: linToLab(lin[0], lin[1], lin[2]), diff: 0, n: parts.length };
        });
        const res = { raw: s, wall: null, floor: null, cardsSwapped: false, shadow: 0 };
        if (!s.gray || !s.white) return res;
        res.cardsSwapped = s.white.lab.L < s.gray.lab.L;
        res.shadow = Math.max(s.gray.diff, s.white.diff);
        const Y = L => Math.pow((L + 16) / 116, 3);
        const tg = Y(GRAY_L), tw = Y(WHITE_L);
        const map = [0, 1, 2].map(i => {
            const gi = s.gray.lin[i], wi = s.white.lin[i];
            if (wi - gi > 0.02) { const k = (tw - tg) / (wi - gi); return v => tg + (v - gi) * k; }
            return v => v * tw / Math.max(wi, 0.001);       // 두 카드 차이가 너무 작으면 흰 카드만으로
        });
        const fix = raw => {
            const lin = raw.lin.map((v, i) => Math.max(0, Math.min(1, map[i](v))));
            const c = linToLab(lin[0], lin[1], lin[2]);
            c.hex = labToHex(c.L, c.a, c.b);
            c.cls = classifyLab(c);
            return c;
        };
        if (s.wall) res.wall = fix(s.wall);
        if (s.floor) res.floor = fix(s.floor);
        return res;
    }

    // ---- 사진 ----
    function loadImage(src, which) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
                const cv = document.createElement('canvas');
                cv.width = Math.round(img.naturalWidth * k);
                cv.height = Math.round(img.naturalHeight * k);
                cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, cv.width, cv.height);
                cv.className = 'rc-photo';
                st.photos[which] = cv;
                st.view = which;
                // 벽 사진: 그 사진의 핀은 비우고 ④ 벽을 찍게 / 첫 사진: 처음부터 다시
                if (which === 1) {
                    dropPins(1);
                    st.active = 3;
                } else {
                    dropPins(0);
                    st.active = 0;
                }
                if (st.cust) renderCust(); else render();
                resolve();
            };
            img.onerror = reject;
            img.src = src;
        });
    }
    function onFile(input, which) {
        const file = input.files && input.files[0];
        input.value = '';
        if (!file || !st) return;
        const url = URL.createObjectURL(file);
        loadImage(url, which).catch(() => alert('사진을 열지 못했어요. 다른 사진으로 해 주세요.')).finally(() => URL.revokeObjectURL(url));
    }
    function removeWallPhoto() {
        st.photos[1] = null;
        dropPins(1);
        st.view = 0;
        render();
    }

    // ---- 화면 ----
    function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
    function fmt(n) { return (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1); }

    // 고객 화면의 바닥·벽 카드 이름 (concierge.js)
    function cardName(kind, tone) {
        const names = (window.concierge && window.concierge[kind === 'floor' ? 'floorNames' : 'wallNames']) || {};
        return names[tone] || tone;
    }

    // kind: 'wall' | 'floor'. c: 계산한 색(또는 저장된 색 — cls가 없으면 다시 판정)
    function resultCard(kind, c, emptyText) {
        const title = kind === 'wall' ? '④ 벽' : '③ 바닥', sub = kind === 'wall' ? '벽지·도장' : '마루·타일';
        let h = `<div class="rc-res"><div class="rc-res-head"><b>${title}</b><span class="staff-chip">${sub}</span></div>`;
        if (!c) return h + `<p class="rc-res-empty">${emptyText || '사진에서 이 자리를 눌러 주세요'}</p></div>`;
        const cls = c.cls || classifyLab(c);
        h += `<div class="rc-res-row"><i class="rc-swatch" style="background:${c.hex}"></i><div class="rc-res-info">`;
        h += `<div class="rc-res-tone font-serif-kr">${cls.text}</div>`;
        h += `<div class="rc-res-match">→ ${kind === 'wall' ? '벽' : '바닥'} 카드: ${esc(cardName(kind, cls.tone))}</div>`;
        h += `<div class="rc-res-lab">밝기 L ${c.L.toFixed(1)} · a ${fmt(c.a)} · b ${fmt(c.b)}</div>`;
        return h + '</div></div></div>';
    }

    // 벽과 바닥을 이어주는 색: 커튼은 벽에 걸리니 벽 쪽에 더 가깝게 (밝기와 색기 무게를 따로 — 현장 시험 대상)
    //  k = 벽 쪽 무게(밝기). 공간마다 직원 화면 밀기 막대로 바꿀 수 있음(measuredColor.bridgeK, 10-15 사장님: 벽이 많이 보이는 집 / 가구가 많아 바닥이 많이 보이는 집)
    //  색기 무게는 k와 같이 움직임(처음 값 6.5일 때 5.5, k가 0.15 움직이면 0.05)
    function bridgeOf(w, f, k) {
        if (typeof k !== 'number') k = BRIDGE_WALL_WEIGHT;
        const kab = BRIDGE_WALL_WEIGHT_AB + (k - BRIDGE_WALL_WEIGHT) / 3;
        const c = { L: w.L * k + f.L * (1 - k), a: w.a * kab + f.a * (1 - kab), b: w.b * kab + f.b * (1 - kab) };
        const r = v => Math.round(v * 10) / 10;
        return { L: r(c.L), a: r(c.a), b: r(c.b), hex: labToHex(c.L, c.a, c.b) };
    }
    function bridgeRatioText(k) { const w = Math.round(k * 20) / 2; return `벽 ${w} : 바닥 ${Math.round((10 - w) * 10) / 10}`; }
    // 공간 카드 밀기 막대: 막대 왼쪽 끝 = 벽, 오른쪽 끝 = 바닥. 동그라미 자리 = 1 - k (벽 쪽 무게가 클수록 왼쪽)
    const BRIDGE_K_MIN = 0.35, BRIDGE_K_MAX = 0.9;
    function setBridge(roomId, pos, done) {
        const room = findRoom(roomId), mc = room && room.measuredColor;
        if (!mc || !mc.wall || !mc.floor) return;
        const k = Math.round(Math.min(BRIDGE_K_MAX, Math.max(BRIDGE_K_MIN, 1 - pos / 100)) * 100) / 100;
        mc.bridgeK = k;
        mc.bridge = bridgeOf(mc.wall, mc.floor, k);
        const box = document.getElementById('rcAdj_' + roomId);
        if (box) {
            box.querySelector('.rc-adj-ratio').textContent = bridgeRatioText(k) + (Math.abs(k - BRIDGE_WALL_WEIGHT) < 0.001 ? ' (기본)' : '');
            box.querySelector('.rc-dot').style.background = mc.bridge.hex;
            box.querySelector('input').style.setProperty('--mid', mc.bridge.hex);
        }
        if (!done) return;
        if (typeof calculateAll === 'function') calculateAll();          // 원단 찾기·추천이 새 이어주는 색으로
        if (typeof saveDraftTick === 'function') saveDraftTick();
        if (typeof renderFinder === 'function' && document.getElementById('finderOut')) { try { renderFinder(); } catch (e) {} }
    }
    // 공간에 저장하는 모양 (숫자는 소수 한 자리)
    function packColor(c) {
        const r = v => Math.round(v * 10) / 10;
        return { L: r(c.L), a: r(c.a), b: r(c.b), hex: c.hex, light: c.cls.light, tone: c.cls.tone };
    }
    function findRoom(id) { return (typeof rooms !== 'undefined' ? rooms : []).find(r => r.id === id); }      // data.js의 rooms

    function apply(goFinder) {
        const res = compute(), room = findRoom(st.roomId);
        if (!room || !(res.wall || res.floor)) return;
        const old = room.measuredColor || {};
        const mc = {
            wall: res.wall ? packColor(res.wall) : (old.wall || null),
            floor: res.floor ? packColor(res.floor) : (old.floor || null),
            shadow: Math.round(res.shadow * 10) / 10,
            at: Date.now()
        };
        if (typeof old.bridgeK === 'number') mc.bridgeK = old.bridgeK;      // 다시 재도 밀기 막대로 정한 비율은 그대로
        mc.bridge = mc.wall && mc.floor ? bridgeOf(mc.wall, mc.floor, mc.bridgeK) : null;
        room.measuredColor = mc;
        // 중심 화면 색 출처: 직원 화면에서 다시 쟀으면 "이 공간에서 잰 색"(한쪽만 쟀으면 출처는 비우고 부분별로 적음). 잰 부분은 카드 표시를 지움
        room.colorSrc = mc.wall && mc.floor ? 'measured' : null;
        if (room.cardParts) { if (res.wall) delete room.cardParts.wall; if (res.floor) delete room.cardParts.floor; }
        if (mc.wall) room.wallTone = mc.wall.tone;          // 고객 화면 바닥·벽 카드에 자동으로 맞춤 → 원단 추천에 바로 쓰임
        if (mc.floor) room.floorTone = mc.floor.tone;
        const name = room.name;
        window.RoomColor.close();
        if (typeof renderRooms === 'function') renderRooms();
        if (typeof calculateAll === 'function') calculateAll();
        if (goFinder && typeof openRoomColorFinder === 'function') { openRoomColorFinder(room.id); return; }      // 반영 뒤 원단 찾기로
        if (typeof showToast === 'function') showToast(`[${name}] 잰 색을 반영했어요.`);
    }

    function render() {
        const ov = document.getElementById('roomColorOverlay');
        if (!ov || !st) return;
        const room = findRoom(st.roomId);
        const res = compute();
        const cv = st.photos[st.view];
        const stp = STEPS[st.active];

        let h = '<div class="rc-sheet" role="dialog" aria-labelledby="rcTitle">';
        h += '<div class="rc-head">';
        h += `<h2 id="rcTitle" class="font-serif-kr">방 벽 · 바닥 색 재기 <small>${esc(room ? room.name : '')}</small></h2>`;
        h += '<button type="button" class="staff-btn" onclick="RoomColor.close()">닫기</button>';
        h += '</div><div class="rc-body"><div>';

        // 왼쪽: 사진 + 누를 곳
        h += '<div class="rc-photo-box"><div class="rc-toolbar">';
        if (st.photos[1]) {
            h += '<div class="rc-tabs">';
            h += `<button type="button" class="${st.view === 0 ? 'on' : ''}" onclick="RoomColor.view(0)">카드 사진</button>`;
            h += `<button type="button" class="${st.view === 1 ? 'on' : ''}" onclick="RoomColor.view(1)">벽 사진</button>`;
            h += '</div>';
        } else {
            h += `<span>${cv ? `<b>지금 누를 곳:</b> ${stp.label}` : '카드와 바닥·벽이 함께 나온 사진'}</span>`;
        }
        h += '<div class="rc-tool-btns">';
        h += `<label class="staff-btn">${cv ? '사진 바꾸기' : '사진 불러오기'}<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, ${st.view})"></label>`;
        if (st.photos[0]) {
            h += st.photos[1]
                ? '<button type="button" class="staff-btn" onclick="RoomColor.removeWall()">벽 사진 빼기</button>'
                : '<label class="staff-btn">+ 벽 사진 따로 추가<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 1)"></label>';
        }
        h += '</div></div>';

        if (cv) {
            h += `<div class="rc-canvas-wrap" id="rcCanvasWrap" style="aspect-ratio:${cv.width} / ${cv.height};width:min(100%, calc(52vh * ${(cv.width / cv.height).toFixed(4)}))">`;      // 세로 사진도 화면 안에
            STEPS.forEach((s2, i) => {
                pinsOf(s2.key).forEach(p => {
                    if (p.v !== st.view) return;
                    if (MULTI[s2.key]) {      // 바닥·벽은 읽는 동그라미도 보여 줌
                        h += `<span class="rc-area" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${(2 * areaRadiusPx(cv) / cv.width * 100).toFixed(2)}%;border-color:${s2.color}"></span>`;
                    }
                    h += `<span class="rc-pin${i === st.active ? ' on' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%;background:${s2.color}">${i + 1}</span>`;
                });
            });
            h += '</div>';
            if (MULTI[stp.key]) {
                const n = pinsOf(stp.key).length;
                h += `<div class="rc-guide"><span>${stp.label.slice(2)}은 동그라미 안을 평균해요. 판자·타일·무늬마다 색이 다르면 <b>다른 곳도 눌러 주세요</b> (${MAX_POINTS}곳까지 평균${n ? ` · 지금 ${n}곳` : ''})</span>`
                    + (n ? `<button type="button" onclick="RoomColor.clearStep()">다시 누르기</button>` : '') + '</div>';
            }
        } else {
            h += '<div class="rc-empty">';
            h += '<p class="font-serif-kr">걸레받이에 <b>회색·흰 카드</b>를 기대어 놓고<br>바닥과 벽이 함께 나오게 한 장 찍어 주세요</p>';
            h += '<p class="rc-empty-sub">카드는 손에서 떼 주세요(손 그림자가 지지 않게). 사진은 저장되지 않아요.</p>';
            h += '<label class="staff-btn rc-empty-btn">사진 불러오기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
            h += '</div>';
        }
        h += '<div class="rc-steps">';
        STEPS.forEach((s2, i) => {
            const n = pinsOf(s2.key).length, done = n > 0;
            h += `<button type="button" class="rc-step${i === st.active ? ' on' : ''}${done ? ' done' : ''}" onclick="RoomColor.step(${i})"${st.photos[0] ? '' : ' disabled'}>`;
            h += `<span>${s2.label}${done ? ' ✓' : ''}</span><small>${n > 1 ? `${n}곳 평균` : s2.sub}</small></button>`;
        });
        h += '</div></div>';

        if (res.cardsSwapped) {
            h += '<div class="rc-alert"><b>흰 카드가 회색 카드보다 어둡게 읽혔어요.</b> ①·② 자리가 서로 바뀌지 않았는지 확인해 주세요.</div>';
        } else if (res.shadow >= SHADOW_DL) {
            h += `<div class="rc-alert"><b>카드에 그림자나 빛 비침이 있어요</b> (밝기 차이 ${res.shadow.toFixed(1)}). 조금 옮겨 다시 찍으면 더 정확해요. 그대로 써도 돼요.</div>`;
        }
        h += '</div>';

        // 오른쪽: 결과
        h += '<div class="rc-results">';
        const saved = room && room.measuredColor;
        if (!st.photos[0] && saved) {
            // 사진을 아직 안 불러왔으면 지난번에 잰 값을 보여 줌 (사진은 저장하지 않으니 다시 재려면 새로 찍기)
            h += `<p class="rc-note">지난번에 잰 값이에요${saved.at ? ` (${new Date(saved.at).toLocaleDateString('ko-KR')})` : ''}. 다시 재려면 사진을 불러와 주세요.</p>`;
            h += resultCard('wall', saved.wall, '재지 않았어요');
            h += resultCard('floor', saved.floor, '재지 않았어요');
        } else {
            if (st.photos[0] && (!res.raw.gray || !res.raw.white)) {
                h += '<p class="rc-note">먼저 ① 회색 카드와 ② 흰 카드를 눌러 주세요. 두 카드로 사진의 밝기와 색기를 바로잡아요.</p>';
            }
            h += resultCard('wall', res.wall);
            h += resultCard('floor', res.floor);
            if (res.wall && res.floor) {
                const k = (saved && typeof saved.bridgeK === 'number') ? saved.bridgeK : BRIDGE_WALL_WEIGHT;
                const br = bridgeOf(res.wall, res.floor, k);
                h += '<div class="rc-bridge"><span class="rc-bridge-lbl">벽과 바닥을 이어주는 색</span>';
                h += `<div class="rc-bridge-bar"><i style="background:${res.wall.hex}"></i><span style="background:linear-gradient(90deg, ${res.wall.hex}, ${br.hex} ${(1 - k) * 100}%, ${res.floor.hex})"><b style="left:${(1 - k) * 100}%;background:${br.hex}"></b></span><i style="background:${res.floor.hex}"></i></div>`;
                h += `<span class="rc-res-lab">${bridgeRatioText(k)} · ${classifyLab(br).text} · 밝기 L ${br.L.toFixed(1)} (반영 뒤 공간 카드의 막대로 조절)</span></div>`;
            }
            if (res.raw.gray && res.raw.white) {
                h += `<p class="rc-cards">카드 읽은 값: 회색 L ${res.raw.gray.lab.L.toFixed(1)} · 흰 L ${res.raw.white.lab.L.toFixed(1)}`
                   + (st.photos[1] && pinsOf('wall').some(p => p.v === 1) ? '<br>벽 사진에는 카드가 없어 카드 사진의 두 카드로 보정했어요.' : '') + '</p>';
            }
        }
        h += '</div></div>';

        // 아래: 반영
        const canApply = !!(res.wall || res.floor);
        h += '<div class="rc-foot"><span>고객 화면에는 숫자 없이 "밝은 웜" 같은 말과 바닥·벽 카드만 쓰여요. 사진은 저장되지 않아요.</span>';
        h += `<div class="rc-foot-btns"><button type="button" class="staff-btn" onclick="RoomColor.apply()"${canApply ? '' : ' disabled'}>이 공간에 반영</button>`;
        h += `<button type="button" class="staff-btn rc-apply" onclick="RoomColor.apply(true)"${canApply ? '' : ' disabled'}>${res.wall && res.floor ? '반영 후 이어주는 원단 찾기 →' : '반영 후 원단 찾기 →'}</button></div></div>`;
        h += '</div>';

        ov.innerHTML = h;
        const wrap = document.getElementById('rcCanvasWrap');
        if (wrap && cv) {
            wrap.prepend(cv);
            wrap.onpointerdown = onTap;
        }
    }

    // 누를 자리 순서: 직원 화면은 넷 다, 고객 화면은 고를 부분만 (예: 벽만 다시 재면 회색 카드 · 흰 카드 · 벽)
    function stepKeys() { return (st && st.keys) || STEPS.map(s2 => s2.key); }
    function onTap(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const keys = stepKeys(), key = keys[st.active], pt = { v: st.view, x, y };
        if (!key) return;
        const first = !pinsOf(key).length;
        // 카드는 옮기기, 바닥·벽은 한 곳 더 (MAX_POINTS를 넘으면 가장 먼저 누른 곳이 빠짐)
        st.pins[key] = MULTI[key] ? pinsOf(key).concat([pt]).slice(-MAX_POINTS) : [pt];
        // 처음 누른 자리면 다음 비어 있는 자리로. 벽 사진이 있으면 ④ 벽은 그 사진에서
        const next = keys.findIndex(k => !pinsOf(k).length);
        if (next >= 0 && (first || !MULTI[key])) {
            st.active = next;
            if (st.photos[1]) st.view = keys[next] === 'wall' ? 1 : 0;
        }
        if (st.cust) renderCust(); else render();
    }

    // ==============================================================
    // 고객 화면 모양 (작업목록 20번): 공간 추가 · 수정하기에서 씀. 계산은 위와 같고, 숫자(Lab) 없이 색 조각 + 바닥·벽 카드 이름만
    //  왼쪽 사진, 오른쪽 "회색 카드 · 흰 카드 · 바닥 · 벽" 차례 목록. 다 누르면 "○○ 담기"
    //  opts: { name, parts: 'both' | 'wall' | 'floor', doneLabel, onDone(mc), onSkip?(), onCancel() }
    // ==============================================================
    const CUST_LABEL = { gray: '회색 카드', white: '흰 카드', floor: '바닥', wall: '벽' };
    const CUST_DESC = { floor: { warm: '밝은 원목', cool: '밝은 타일·대리석', neutral: '회색 마루·타일', deep: '진한 원목 마루' },
                        wall: { warm: '따뜻한 흰 벽지', cool: '맑은 흰 벽지', neutral: '회색 벽지', deep: '진한 나무 벽' } };
    const NUM_WORD = ['', '한', '두', '세', '네'];
    function packResult(res) {
        const mc = { wall: res.wall ? packColor(res.wall) : null, floor: res.floor ? packColor(res.floor) : null, shadow: Math.round(res.shadow * 10) / 10, at: Date.now() };
        mc.bridge = mc.wall && mc.floor ? bridgeOf(mc.wall, mc.floor) : null;
        return mc;
    }
    function renderCust() {
        const ov = document.getElementById('roomColorCust');
        if (!ov || !st || !st.cust) return;
        const o = st.cust, keys = stepKeys(), res = compute(), cv = st.photos[0];
        const done = keys.every(k => pinsOf(k).length), activeKey = keys[st.active];
        let h = '<button type="button" class="cm-back" onclick="RoomColor.cancelCustomer()" aria-label="뒤로"><i class="fa-solid fa-arrow-left"></i></button>';
        h += '<div class="cm-stage">';
        // 왼쪽: 사진 (없으면 찍기·불러오기)
        h += '<div class="cm-photo">';
        if (cv) {
            h += `<div class="cm-wrap" id="cmWrap" style="aspect-ratio:${cv.width} / ${cv.height}">`;
            keys.forEach((k, i) => pinsOf(k).forEach(p => {
                if (MULTI[k]) h += `<span class="cm-area" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${(2 * areaRadiusPx(cv) / cv.width * 100).toFixed(2)}%"></span>`;
                h += `<span class="cm-dot" style="left:${p.x * 100}%;top:${p.y * 100}%">${i + 1}</span>`;
            }));
            h += '</div>';
        } else {
            h += '<div class="cm-empty"><p class="font-serif-kr">걸레받이에 <b>회색·흰 카드</b>를 기대어 놓고<br>바닥과 벽이 함께 나오게 한 장 찍어 주세요</p>';
            h += '<label class="cm-go font-serif-kr">사진 찍기 · 불러오기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
            h += '<p class="cm-note">사진은 저장되지 않아요</p></div>';
        }
        h += '</div>';
        // 오른쪽: 차례 목록 → 결과
        h += '<div class="cm-side">';
        h += `<span class="q-meta">${esc(o.name)} · 색</span>`;
        h += `<h2 class="cm-title font-serif-kr">${done ? '이 공간의 색을 찾았어요' : (cv ? `사진 속 ${NUM_WORD[keys.length] || keys.length} 곳을 차례로 눌러 주세요` : '먼저 사진을 찍어 주세요')}</h2>`;
        h += `<p class="cm-sub">${done ? (o.doneNote || '') : '회색·흰 카드로 사진의 빛을 맞춰서 실제 색을 찾아요.'}</p>`;
        h += '<ul class="cm-steps">';
        keys.forEach((k, i) => {
            const n = pinsOf(k).length, on = cv && i === st.active && !done;
            const c = n && (k === 'wall' || k === 'floor') ? res[k] : null;
            h += `<li class="${n ? 'done' : (on ? 'on' : '')}${on && n ? ' on' : ''}" onclick="RoomColor.custStep(${i})"><span class="cm-n">${n ? '✓' : i + 1}</span>${CUST_LABEL[k]}`
                + (on ? `<small>${n && MULTI[k] ? '다른 곳도 누르면 평균해요' : '사진에서 눌러 주세요'}</small>` : '')
                + (c ? `<i style="background:${c.hex}"></i>` : '') + '</li>';
        });
        h += '</ul>';
        if (res.cardsSwapped) h += '<p class="cm-alert">흰 카드와 회색 카드를 바꿔 누른 것 같아요. 목록에서 카드를 눌러 다시 찍어 주세요.</p>';
        else if (res.shadow >= SHADOW_DL) h += '<p class="cm-alert">카드에 그림자가 졌어요. 그대로 써도 되고, 조금 옮겨 다시 찍으면 더 정확해요.</p>';
        if (done && !res.cardsSwapped) {
            h += '<div class="cm-res">';
            ['floor', 'wall'].forEach(k => {
                const c = res[k];
                if (!c) return;
                h += `<div><i style="background:${c.hex}"></i><span><b class="font-serif-kr">${esc(cardName(k, c.cls.tone))}</b><small>${k === 'wall' ? '벽' : '바닥'} · ${CUST_DESC[k][c.cls.tone] || ''}</small></span></div>`;
            });
            h += '</div>';
        }
        h += '<div class="cm-foot">';
        h += o.onSkip ? '<button type="button" class="cm-skip" onclick="RoomColor.skipCustomer()">지금은 못 재요 · 상담 때 카드로</button>' : '<span></span>';
        if (cv) h += '<label class="cm-skip">사진 바꾸기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
        if (done && !res.cardsSwapped) h += `<button type="button" class="cm-go font-serif-kr" onclick="RoomColor.finishCustomer()">${esc(o.doneLabel || '담기')}</button>`;
        h += '</div></div></div>';
        ov.innerHTML = h;
        const wrap = document.getElementById('cmWrap');
        if (wrap && cv) { wrap.prepend(cv); wrap.onpointerdown = onTap; }
    }
    function closeCustomer() {
        const ov = document.getElementById('roomColorCust');
        if (ov) { ov.hidden = true; ov.innerHTML = ''; }
        st = null;      // 사진은 버림
    }

    window.RoomColor = {
        open(roomId) {
            st = { roomId, photos: [null, null], view: 0, active: 0, pins: {} };
            let ov = document.getElementById('roomColorOverlay');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'roomColorOverlay';
                ov.className = 'rc-overlay';
                document.body.appendChild(ov);
            }
            ov.hidden = false;
            render();
        },
        close() {
            const ov = document.getElementById('roomColorOverlay');
            if (ov) { ov.hidden = true; ov.innerHTML = ''; }
            st = null;      // 사진은 버림
        },
        step(i) {
            st.active = i;
            const p = pinsOf(STEPS[i].key).slice(-1)[0];
            if (st.photos[1]) st.view = p ? p.v : (STEPS[i].key === 'wall' ? 1 : 0);
            render();
        },
        clearStep() { delete st.pins[STEPS[st.active].key]; render(); },      // 바닥·벽 "다시 누르기"
        view(v) { st.view = v; render(); },
        apply,
        // 직원 화면 공간 카드 안 한 줄: 잰 색 + 맞춘 카드 (고객이 다른 카드를 고르면 그것도 표시)
        summaryHtml(room) {
            const mc = room && room.measuredColor;
            if (!mc || !(mc.wall || mc.floor)) return '';
            const part = (kind, c) => {
                if (!c) return '';
                const cur = kind === 'wall' ? room.wallTone : room.floorTone;
                const label = kind === 'wall' ? '벽' : '바닥';
                return `<span class="rc-sum-part">${label} <i class="rc-dot" style="background:${c.hex}"></i> <b>${classifyLab(c).text}</b> → ${esc(cardName(kind, c.tone))}`
                    + (cur && cur !== c.tone ? ` <em>(지금 카드: ${esc(cardName(kind, cur))})</em>` : '') + '</span>';
            };
            return `<div class="rc-summary"><span class="rc-sum-lbl">잰 색</span>${part('wall', mc.wall)}${part('floor', mc.floor)}`
                + `<span class="rc-sum-btns"><button type="button" onclick="openRoomColorFinder(${room.id})">${mc.wall && mc.floor ? '이어주는 원단 보기' : '원단 찾기'}</button>`
                + `<button type="button" onclick="RoomColor.open(${room.id})">다시 재기</button></span></div>`
                + (mc.wall && mc.floor ? (() => {
                    const k = typeof mc.bridgeK === 'number' ? mc.bridgeK : BRIDGE_WALL_WEIGHT;
                    const br = mc.bridge || bridgeOf(mc.wall, mc.floor, k);
                    return `<div class="rc-adj" id="rcAdj_${room.id}"><span class="rc-sum-lbl">이어주는 색</span>`
                        + `<span class="rc-adj-end">벽이 많이 보여요</span>`
                        + `<input type="range" min="${Math.round((1 - BRIDGE_K_MAX) * 100)}" max="${Math.round((1 - BRIDGE_K_MIN) * 100)}" step="5" value="${Math.round((1 - k) * 100)}" style="--wall:${mc.wall.hex};--floor:${mc.floor.hex};--mid:${br.hex}" aria-label="벽과 바닥을 이어주는 색 조절" oninput="RoomColor.setBridge(${room.id}, +this.value, false)" onchange="RoomColor.setBridge(${room.id}, +this.value, true)">`
                        + `<span class="rc-adj-end">바닥이 많이 보여요</span>`
                        + `<span class="rc-adj-val"><i class="rc-dot" style="background:${br.hex}"></i> <b class="rc-adj-ratio">${bridgeRatioText(k)}${Math.abs(k - BRIDGE_WALL_WEIGHT) < 0.001 ? ' (기본)' : ''}</b></span></div>`;
                })() : '');
        },
        setBridge,
        // ---- 고객 화면 모양 (20번) ----
        openCustomer(opts) {
            const parts = opts.parts === 'wall' ? ['wall'] : (opts.parts === 'floor' ? ['floor'] : ['floor', 'wall']);
            st = { roomId: null, photos: [null, null], view: 0, active: 0, pins: {}, cust: opts, keys: ['gray', 'white'].concat(parts) };
            let ov = document.getElementById('roomColorCust');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'roomColorCust';
                ov.className = 'cm-overlay';
                document.body.appendChild(ov);
            }
            ov.hidden = false;
            renderCust();
        },
        isCustomerOpen() { return !!(st && st.cust); },
        custStep(i) { if (!st || !st.photos[0]) return; st.active = i; renderCust(); },      // 목록을 눌러 그 자리를 다시 찍음
        cancelCustomer() { const o = st && st.cust; closeCustomer(); if (o && o.onCancel) o.onCancel(); },
        skipCustomer() { const o = st && st.cust; closeCustomer(); if (o && o.onSkip) o.onSkip(); },
        finishCustomer() {
            if (!st || !st.cust) return;
            const o = st.cust, res = compute();
            if (!(res.wall || res.floor) || res.cardsSwapped) return;
            const mc = packResult(res);
            closeCustomer();
            o.onDone(mc);
        },
        file: onFile,
        removeWall: removeWallPhoto,
        _loadImage: (src, which) => loadImage(src, which || 0),      // 미리보기 시험용
        _state: () => st && compute(),
        rgbToLab, labToHex, classifyLab, bridgeOf
    };
})();
