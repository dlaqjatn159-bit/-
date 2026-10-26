(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['room-color.js']='20261140';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// 방 벽·바닥 색 재기 (작업목록 15번, 직원 화면 전용)
//  - 걸레받이에 회색·흰 카드를 기대어 놓고 찍은 사진 한 장(필요하면 벽 사진 한 장 더)
//  - 회색 카드 1곳 → 흰 카드 1곳 → 바닥 3곳 → 벽 3곳을 차례로 누르면(10-15: 한 가지씩, 다 누르면 다음으로),
//    누른 자리 주변 평균색을 두 카드 기준으로 보정해 Lab으로 계산합니다.
//  - 사진 위 점에는 번호 대신 "회색·흰·바닥·벽"이 쓰이고, 점을 누르면 지워짐. 목록을 누르면 그 자리만 다시 찍기
//  - 사진은 어디에도 저장하지 않습니다(창을 닫으면 사라짐). 측정값만 공간에 남깁니다.
// ==============================================================
(function () {
    const GRAY_L = 50, WHITE_L = 95;          // 카드 목표 밝기 (회색 카드 L50, 흰 카드 L95)
    const SAMPLE = 21;                        // 카드: 누른 자리 주변 21×21px 평균
    const AREA_R = 0.07;                      // 바닥·벽: 반지름 = 사진 짧은 쪽의 7% (1600×1200 사진이면 지름 약 170px)
    // 가구 (66번): 벽·바닥과 따로, 카드와 함께 가까이 찍은 사진 한 장 → 넓은 면 3곳 평균(벽·바닥과 같은 방식)
    const FUR_MAX = 5;                        // 가구는 공간마다 5개까지 (66번, 처음 값)
    const FUR_NAMES = ['소파', '침대', '이불·침구', '러그·카펫', '붙박이장·수납장', '식탁·책상', '책장', '기타'];
    const FUR_OLD = { 수납장: '붙박이장·수납장', 식탁: '식탁·책상' };      // 예전(37번) 저장 이름 → 새 이름
    const FUR_WOOD = { '붙박이장·수납장': true, '식탁·책상': true, 책장: true };      // 나무 가구는 바닥 이름 규칙(오크·월넛), 나머지는 벽 이름 규칙
    const FUR_CHANGE = { '이불·침구': true, '러그·카펫': true };      // 계절·기분에 따라 바뀌는 것 (66번: 표시만, 추천에는 아직 안 씀)
    const MULTI = { floor: true, wall: true, fur: true };// 여러 곳을 눌러 평균하는 자리
    const AREA_POINTS = 3;                    // 바닥·벽은 3곳씩 눌러 평균 (카드는 1곳). 다 누르면 다음 자리로 저절로 넘어감
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
    const PIN_WORD = { gray: '회색', white: '흰', floor: '바닥', wall: '벽', fur: '가구' };      // 사진 위 점에 쓰는 말
    const HIT_PX = 22;                        // 이미 찍은 점에서 이만큼 안을 누르면 그 점을 지움
    // 찍는 방법 (37번): 방 문 앞에서 창 쪽을 넓게. 창 아래는 역광이라 카드가 어둡게 찍혀서 카드는 바닥 가운데쯤
    const SHOOT_GUIDE = '방 문 앞에 서서 <b>창 쪽을 넓게</b> 찍어 주세요<br>(광각 0.6배)';
    const SHOOT_CARD = '카드는 창 바로 아래가 아닌, 바닥 가운데쯤에 두면 빛이 고르게 받아요.';
    const SHOOT_FUR = '가구 위나 바로 옆에 회색·흰 카드를 두고<br><b>가까이</b> 찍어 주세요';      // 66번
    const SHOOT_FUR_SUB = '카드와 가구가 같은 빛을 받게 붙여 두면 색이 정확해요. 한 장에 가구 하나예요.';

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

    // 잰 색의 자세한 이름 (32번): 고객 화면에서 잰 색은 카드 이름(크림·아이보리 등 4가지) 대신 이걸 씀. 카드로 고른 색만 카드 이름
    //  { name: '라이트 베이지', note: '밝고 노란 기운이 은은해요' }. 원단 색 이름 규칙처럼 쉬운 계열 이름 + 라이트/딥
    function colorName(kind, c) {
        if (!c || c.L == null) return null;
        const L = c.L, a = c.a || 0, b = c.b || 0, C = Math.hypot(a, b);
        let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360;
        // 색 기운: 0 붉은 · 90 노란 · 180 초록 · 270 푸른
        const fam = C < 3 ? 'none' : (h < 30 || h >= 330) ? 'pink' : h < 62 ? 'red' : h < 110 ? 'yellow' : h < 150 ? 'olive' : h < 215 ? 'mint' : h < 290 ? 'blue' : 'lavender';
        const cool = C >= 2 && (fam === 'mint' || fam === 'blue' || fam === 'lavender');
        let name;
        if (kind === 'floor') {
            if (C < 5 || fam === 'blue' || fam === 'mint' || fam === 'lavender') {
                name = L >= 82 ? '화이트 그레이' : L >= 68 ? '라이트 그레이' : L >= 50 ? '그레이' : L >= 35 ? '다크 그레이' : '차콜';
            } else if ((fam === 'red' && h < 52) || fam === 'pink') {          // 붉은 기운이 뚜렷한 나무 (보통 오크는 65~75°)
                name = L >= 65 ? '로즈 메이플' : L >= 50 ? '체리 오크' : L >= 35 ? '체리' : '마호가니';
            } else if (C < 11) {          // 색이 옅은 나무·타일: 회색 기운이 섞임
                name = L >= 75 ? '화이트 오크' : L >= 60 ? '그레이 오크' : L >= 45 ? '스모크 오크' : L >= 32 ? '그레이 월넛' : '다크 월넛';
            } else {
                name = L >= 72 ? '메이플' : L >= 60 ? (C >= 22 ? '허니 오크' : '내추럴 오크') : L >= 48 ? '티크' : L >= 35 ? '월넛' : '다크 월넛';
            }
        } else {
            const tint = { pink: '핑크', red: '살구', olive: '세이지', mint: '민트', blue: '블루', lavender: '라벤더' }[fam];
            if (L < 40) name = C < 4 ? '차콜' : (fam === 'blue' ? '네이비' : fam === 'olive' ? '올리브' : '다크 브라운');
            else if (tint && C >= (fam === 'red' ? 12 : 5)) name = (L >= 85 ? '라이트 ' : L < 62 ? '딥 ' : '') + tint + (C < 9 ? ' 그레이' : '');
            else if (L >= 88) name = cool ? '쿨 화이트' : C < 3 ? '퓨어 화이트' : C < 6.5 ? '오프 화이트' : C < 12 ? (h >= 82 ? '아이보리' : '크림') : '버터 크림';
            else if (L >= 78) name = C < 3 ? '라이트 그레이' : cool ? '라이트 쿨 그레이' : C < 6.5 ? '라이트 그레이지' : C < 13 ? '라이트 베이지' : '샌드 베이지';
            else if (L >= 60) name = C < 3 ? '그레이' : cool ? '쿨 그레이' : C < 7 ? '그레이지' : C < 14 ? '베이지' : '카멜';
            else name = C < 4 ? '다크 그레이' : C < 10 ? '딥 그레이지' : '모카';
        }
        const light = L >= 88 ? '아주 밝고' : L >= 75 ? '밝고' : L >= 55 ? '중간 밝기에' : L >= 38 ? '조금 어둡고' : '어둡고';
        const famWord = { pink: '분홍', red: '붉은', yellow: '노란', olive: '초록', mint: '푸른 초록', blue: '푸른', lavender: '보랏' }[fam];
        const note = fam === 'none' ? `${light} 색 기운이 거의 없어요`
            : `${light} ${famWord} 기운이 ${C < 6 ? '살짝 돌아요' : C < 13 ? '은은해요' : '또렷해요'}`;
        return { name, note };
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
    function sampleArea(pin, rFrac) {
        const cv = st.photos[pin.v];
        if (!cv) return null;
        const R = areaRadiusPx(cv, rFrac);
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
    function needOf(key) { return MULTI[key] ? AREA_POINTS : 1; }
    function isFull(key) { return pinsOf(key).length >= needOf(key); }
    function nextOpen() { return stepKeys().findIndex(k => !isFull(k)); }      // 아직 덜 찍은 첫 자리 (-1 = 다 찍음)
    // 지금 찍을 자리로 사진도 맞춤 (벽 사진이 따로 있으면 벽은 그 사진에서)
    function goStep(i) {
        st.active = i;
        const k = stepKeys()[i];
        if (k && st.photos[1]) { const p = pinsOf(k).slice(-1)[0]; st.view = p ? p.v : (k === 'wall' ? 1 : 0); }
    }
    function removePin(key, pin) {
        st.pins[key] = pinsOf(key).filter(p => p !== pin);
        if (!st.pins[key].length) delete st.pins[key];
    }
    function dropPins(v) {      // 그 사진에 찍은 점은 모두 지움 (사진을 바꾸거나 뺄 때)
        Object.keys(st.pins).forEach(k => { st.pins[k] = st.pins[k].filter(p => p.v !== v); if (!st.pins[k].length) delete st.pins[k]; });
    }
    function areaRadiusPx(cv, rFrac) { return Math.max(rFrac ? 8 : 12, Math.round(Math.min(cv.width, cv.height) * (rFrac || AREA_R))); }
    // 가구 종류 이름 (66번): 예전 이름(수납장·식탁)은 새 이름으로 읽음
    function furLabel(n) { return FUR_OLD[n] || n || '가구'; }
    function furKind(n) { return FUR_WOOD[furLabel(n)] ? 'floor' : 'wall'; }
    function furName(f) { const nm = f && colorName(furKind(f.n), f); return nm ? nm.name : ''; }
    function furStays(n) { return !FUR_CHANGE[furLabel(n)]; }

    // 두 카드로 보정: 빨강·초록·파랑을 따로, 회색 카드는 L50 회색 · 흰 카드는 L95 흰색이 되도록 곧게 늘임
    // (카메라의 노출과 색 틀어짐을 함께 바로잡음. Lab에서 색기만 빼는 것보다 진한 색에서 정확)
    function compute() {
        const s = {};
        STEPS.map(stp => stp.key).concat(['fur']).forEach(key => {
            const ps = pinsOf(key);
            if (!ps.length) { s[key] = null; return; }
            if (!MULTI[key]) { s[key] = samplePin(ps[0]); return; }      // 카드는 작은 칸 하나
            // 바닥·벽·가구: 누른 곳마다 넓은 동그라미 평균 → 그것들을 다시 평균 (판자·타일마다 색이 다른 바닥)
            // (66번 고침: map에 sampleArea를 바로 넘기면 순번이 반지름 칸으로 들어가 2·3번째 점이 사진 전체를 읽었음)
            const parts = ps.map(p => sampleArea(p)).filter(Boolean);
            const lin = [0, 1, 2].map(k => parts.reduce((t, p) => t + p.lin[k], 0) / parts.length);
            s[key] = { lin, lab: linToLab(lin[0], lin[1], lin[2]), diff: 0, n: parts.length };
        });
        const res = { raw: s, wall: null, floor: null, fur: null, cardsSwapped: false, shadow: 0 };
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
        if (s.fur) res.fur = fix(s.fur);
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
                dropPins(which);
                if (which === 1) st.active = stepKeys().indexOf('wall');
                else goStep(Math.max(0, nextOpen()));
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
        h += `<div class="rc-res-tone font-serif-kr">${esc(colorName(kind, c).name)} <small>(${cls.text})</small></div>`;
        h += `<div class="rc-res-match">→ ${kind === 'wall' ? '벽' : '바닥'} 카드: ${esc(cardName(kind, cls.tone))}</div>`;
        h += `<div class="rc-res-lab">밝기 L ${c.L.toFixed(1)} · a ${fmt(c.a)} · b ${fmt(c.b)}</div>`;
        return h + '</div></div></div>';
    }

    // ---- 가구 색 (66번): 벽·바닥과 따로 찍음. 공간마다 [+ 가구 추가] → 사진 한 장 → 회색·흰 카드 → 가구 3곳 → 종류 칩 → 담기 ----
    function furRowHtml(f) {
        return `<div class="fur-row"><i style="background:${f.hex}"></i><span><b>${esc(furLabel(f.n))}</b> · ${esc(furName(f))} <em class="hex-code">${esc(String(f.hex).toUpperCase())}</em></span></div>`;
    }
    // 가구 목록 고치기 (직원 화면 공간 카드 · 고객 수정하기가 같이 씀): 종류 바꾸기 · 빼기 · + 가구 추가
    //  call: 단추가 부를 함수 앞부분 (예: "RoomColor.staffFur(12, " → "RoomColor.staffFur(12, 'del', 0)"), openIdx: 종류 칩을 펼친 가구 번호
    function furEditorHtml(list, call, openIdx, cls) {
        list = list || [];
        let h = `<div class="fur-edit ${cls || ''}">`;
        list.forEach((f, i) => {
            h += `<div class="fur-row"><i style="background:${esc(f.hex)}"></i><span><b>${esc(furLabel(f.n))}</b> · ${esc(furName(f))}${furStays(f.n) ? '' : ' <small class="fur-chg">자주 바뀌는 것</small>'}</span>`
                + `<span class="fur-acts"><button type="button" onclick="${call}'open', ${i})">종류</button><button type="button" onclick="${call}'del', ${i})">빼기</button></span></div>`;
            if (openIdx === i) {
                h += '<div class="fur-chips">' + FUR_NAMES.map(n => `<button type="button" class="${furLabel(f.n) === n ? 'on' : ''}" onclick="${call}'kind', ${i}, '${n}')">${n}</button>`).join('')
                    + `<button type="button" class="fur-cancel" onclick="${call}'open', -1)">닫기</button></div>`;
            }
        });
        if (list.length < FUR_MAX) h += `<button type="button" class="fur-add" onclick="${call}'add')">+ 가구 추가</button>`;
        else h += `<small class="fur-hint">가구는 ${FUR_MAX}개까지예요.</small>`;
        return h + '</div>';
    }
    // 가구 목록 고치기 (66번): list는 바꾸지 않고 새 목록을 돌려줌. 'add'는 찍기 화면을 띄우고 done(새 목록)으로 돌려줌
    function furListEdit(list, act, i, n, name, done) {
        list = (list || []).slice();
        if (act === 'add') {
            if (list.length >= FUR_MAX) return;
            openFurniture({ name, onDone: f => done(list.concat([f]).slice(0, FUR_MAX)) });
            return;
        }
        if (act === 'del' && list[i]) { list.splice(i, 1); done(list); return; }
        if (act === 'kind' && list[i] && FUR_NAMES.includes(n)) { list[i] = Object.assign({}, list[i], { n, stay: furStays(n) }); done(list); }
    }
    // 가구 목록을 잰 색에 넣음: 벽·바닥은 그대로. 다 빼고 벽·바닥도 없으면 null
    function withFurniture(mc, list) {
        const out = Object.assign({ wall: null, floor: null, bridge: null }, mc || {});
        if (list && list.length) out.furniture = list; else delete out.furniture;
        return (out.wall || out.floor || out.furniture) ? out : null;
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
    // 가구 색 저장 모양 (37번 → 66번): { n: '소파', L, a, b, hex, stay } — 이름(다크 그레이 등)은 저장하지 않고 그때그때 colorName으로
    //  stay: 그대로 두는 가구(true) / 자주 바뀌는 것(false, 이불·러그). 66번은 표시만, 나중에 추천 점수에서 무게를 다르게
    function packFurOne(c, n) {
        const r = v => Math.round(v * 10) / 10;
        return { n, L: r(c.L), a: r(c.a), b: r(c.b), hex: c.hex, stay: furStays(n) };
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
        if (old.furniture && old.furniture.length) mc.furniture = old.furniture;      // 가구는 따로 찍으니(66번) 벽·바닥을 다시 재도 그대로
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
            h += `<span>${cv ? (stp ? `<b>지금 누를 곳:</b> ${stp.label} (${pinsOf(stp.key).length}/${needOf(stp.key)})` : '<b>다 찍었어요.</b> 점을 누르면 지워져요') : '카드와 바닥·벽이 함께 나온 사진'}</span>`;
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
                    h += `<span class="rc-pin${i === st.active ? ' on' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%;background:${s2.color}">${PIN_WORD[s2.key]}</span>`;
                });
            });
            h += '</div>';
            const anyPin = Object.values(st.pins).some(ps => ps.length);
            h += `<div class="rc-guide"><span>${stp && MULTI[stp.key] ? `${stp.label.slice(2)}은 동그라미 안을 평균해요. 판자·타일·무늬가 다른 <b>${AREA_POINTS}곳</b>을 눌러 주세요.` : (stp ? '카드는 가운데를 한 번 눌러 주세요.' : '')} 잘못 찍은 점은 <b>점을 누르면 지워져요.</b></span>`
                + (anyPin ? `<button type="button" onclick="RoomColor.undo()">방금 것 지우기</button>` : '') + '</div>';
        } else {
            h += '<div class="rc-empty">';
            h += `<p class="font-serif-kr">${SHOOT_GUIDE}</p>`;
            h += `<p class="rc-empty-sub">${SHOOT_CARD} 카드는 손에서 떼 주세요(손 그림자가 지지 않게). 사진은 저장되지 않아요.</p>`;
            h += '<label class="staff-btn rc-empty-btn">사진 불러오기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
            h += '</div>';
        }
        h += '<div class="rc-steps">';
        STEPS.forEach((s2, i) => {
            const n = pinsOf(s2.key).length, done = isFull(s2.key);
            h += `<button type="button" class="rc-step${i === st.active ? ' on' : ''}${done ? ' done' : ''}" onclick="RoomColor.step(${i})"${st.photos[0] ? '' : ' disabled'}>`;
            h += `<span>${s2.label}${done ? ' ✓' : ''}</span><small>${MULTI[s2.key] ? `${n}/${AREA_POINTS}곳` : s2.sub}${done ? ' · 누르면 다시' : ''}</small></button>`;
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
            if (saved.furniture && saved.furniture.length) h += '<div class="fur-box rc-fur"><span class="fur-lbl">가구 <small>(공간 카드에서 따로 고쳐요)</small></span>' + saved.furniture.map(furRowHtml).join('') + '</div>';
        } else {
            if (st.photos[0] && (!res.raw.gray || !res.raw.white)) {
                h += '<p class="rc-note">먼저 ① 회색 카드와 ② 흰 카드를 눌러 주세요. 두 카드로 사진의 밝기와 색기를 바로잡아요.</p>';
            }
            h += resultCard('wall', res.wall);
            h += resultCard('floor', res.floor);
            if (res.wall && res.floor) {
                const k = (saved && typeof saved.bridgeK === 'number') ? saved.bridgeK : BRIDGE_WALL_WEIGHT;
                const br = bridgeOf(res.wall, res.floor, k);
                h += '<div class="rc-bridge"><span class="rc-bridge-lbl">벽과 바닥의 중간 톤</span>'; // 41번
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
        h += `<button type="button" class="staff-btn rc-apply" onclick="RoomColor.apply(true)"${canApply ? '' : ' disabled'}>${res.wall && res.floor ? '반영 후 조화로운 원단 찾기 →' : '반영 후 원단 찾기 →'}</button></div></div>`; // 41번
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
        const keys = stepKeys();
        // 찍어 둔 점을 누르면 그 점을 지우고 그 자리를 다시 찍게
        let hit = null, best = HIT_PX;
        const near = p => Math.hypot((p.x - x) * rect.width, (p.y - y) * rect.height);
        keys.forEach(k => pinsOf(k).forEach(p => {
            if (p.v !== st.view) return;
            const d = near(p);
            if (d < best) { best = d; hit = { k, p }; }
        }));
        if (hit) {
            removePin(hit.k, hit.p);
            goStep(keys.indexOf(hit.k));
        } else {
            const key = keys[st.active];
            if (!key || isFull(key)) return;      // 다 찍었으면 사진을 눌러도 아무 일 없음 (점이나 목록을 눌러 고침)
            st.pins[key] = pinsOf(key).concat([{ v: st.view, x, y, t: ++st.seq }]);
            // 그 자리를 다 찍으면 다음 덜 찍은 자리로 (다 찍었으면 고를 자리 없음)
            if (isFull(key)) { const n = nextOpen(); if (n >= 0) goStep(n); else st.active = -1; }
        }
        if (st.cust) renderCust(); else render();
    }
    // 방금 찍은 점 하나 지우기
    function undo() {
        if (!st) return;
        let last = null;
        Object.keys(st.pins).forEach(k => st.pins[k].forEach(p => { if (!last || (p.t || 0) > (last.p.t || 0)) last = { k, p }; }));
        if (!last) return;
        removePin(last.k, last.p);
        goStep(stepKeys().indexOf(last.k));
        if (st.cust) renderCust(); else render();
    }
    // 목록·단추를 누름: 다 찍은 자리면 그 자리만 지우고 다시 찍기, 덜 찍은 자리면 이어서 찍기
    function pickStep(i) {
        if (!st || !st.photos[0]) return;
        const k = stepKeys()[i];
        if (!k) return;
        if (isFull(k)) delete st.pins[k];
        goStep(i);
        if (st.cust) renderCust(); else render();
    }

    // ==============================================================
    // 고객 화면 모양 (작업목록 20번): 공간 추가 · 수정하기에서 씀. 계산은 위와 같고, 숫자(Lab) 없이 색 조각 + 바닥·벽 카드 이름만
    //  왼쪽 사진, 오른쪽 "회색 카드 · 흰 카드 · 바닥 · 벽" 차례 목록. 다 누르면 "○○ 담기"
    //  opts: { name, parts: 'both' | 'wall' | 'floor', doneLabel, onDone(mc), onSkip?(), onCancel(), bridgeK?(막대 처음 값) }
    //  바닥·벽을 둘 다 찍으면 결과 아래에 이어주는 색 막대 → mc.bridgeK (30번)
    // ==============================================================
    const CUST_LABEL = { gray: '회색 카드', white: '흰 카드', floor: '바닥', wall: '벽', fur: '가구' };
    const CUST_ASK = { gray: '<b>회색 카드</b> 가운데를 눌러 주세요', white: '<b>흰 카드</b> 가운데를 눌러 주세요',
                       floor: `<b>바닥</b>을 ${AREA_POINTS}곳 눌러 주세요`, wall: `<b>벽</b>을 ${AREA_POINTS}곳 눌러 주세요`,
                       fur: `<b>가구</b>의 넓은 면을 ${AREA_POINTS}곳 눌러 주세요` };
    function packResult(res, k) {
        const mc = { wall: res.wall ? packColor(res.wall) : null, floor: res.floor ? packColor(res.floor) : null, shadow: Math.round(res.shadow * 10) / 10, at: Date.now() };
        if (typeof k === 'number') mc.bridgeK = k;
        mc.bridge = mc.wall && mc.floor ? bridgeOf(mc.wall, mc.floor, mc.bridgeK) : null;
        return mc;
    }
    // 바닥·벽을 다 찍은 뒤 나오는 이어주는 색 막대 (30번): 직원 화면 공간 카드 막대와 같은 모양·같은 값(bridgeK). 밀면 색 칸만 바뀜
    function custBridgeHtml(res) {
        const k = custK(), br = bridgeOf(res.wall, res.floor, k);
        return `<div class="cm-adj" id="cmAdj"><span class="cm-adj-lbl">이 방은 어디가 더 많이 보이나요?</span>`
            + `<div class="cm-adj-row"><span class="rc-adj-end">벽</span>`
            + `<input type="range" min="${Math.round((1 - BRIDGE_K_MAX) * 100)}" max="${Math.round((1 - BRIDGE_K_MIN) * 100)}" step="5" value="${Math.round((1 - k) * 100)}" style="--wall:${res.wall.hex};--floor:${res.floor.hex};--mid:${br.hex}" aria-label="벽과 바닥 중 많이 보이는 쪽" oninput="RoomColor.custBridge(+this.value)">`
            + `<span class="rc-adj-end">바닥</span></div>`
            + `<div class="cm-adj-val"><i style="background:${br.hex}"></i><span><b class="font-serif-kr">중간 톤<em class="hex-code">${br.hex.toUpperCase()}</em></b><small class="cm-adj-ratio">${bridgeRatioText(k)}${Math.abs(k - BRIDGE_WALL_WEIGHT) < 0.001 ? ' (기본)' : ''}</small></span></div></div>`; // 41번
    }
    function custK() { return (st && typeof st.custK === 'number') ? st.custK : BRIDGE_WALL_WEIGHT; }
    function custBridge(pos) {
        if (!st || !st.cust) return;
        const res = compute();
        if (!res.wall || !res.floor) return;
        st.custK = Math.round(Math.min(BRIDGE_K_MAX, Math.max(BRIDGE_K_MIN, 1 - pos / 100)) * 100) / 100;
        const br = bridgeOf(res.wall, res.floor, st.custK), box = document.getElementById('cmAdj');
        if (!box) return;
        box.querySelector('.cm-adj-val i').style.background = br.hex;
        box.querySelector('.cm-adj-val .hex-code').textContent = br.hex.toUpperCase();
        box.querySelector('.cm-adj-ratio').textContent = bridgeRatioText(st.custK) + (Math.abs(st.custK - BRIDGE_WALL_WEIGHT) < 0.001 ? ' (기본)' : '');
        box.querySelector('input').style.setProperty('--mid', br.hex);
    }
    function renderCust() {
        const ov = document.getElementById('roomColorCust');
        if (!ov || !st || !st.cust) return;
        const o = st.cust, keys = stepKeys(), res = compute(), cv = st.photos[0];
        const done = keys.every(isFull), furOnly = !!o.furOnly;      // furOnly: 가구 따로 찍기 (66번)
        let h = '<button type="button" class="cm-back" onclick="RoomColor.cancelCustomer()" aria-label="뒤로"><i class="fa-solid fa-arrow-left"></i></button>';
        h += '<div class="cm-stage">';
        // 왼쪽: 사진 (없으면 찍기·불러오기)
        h += '<div class="cm-photo">';
        if (cv) {
            h += `<div class="cm-wrap" id="cmWrap" style="aspect-ratio:${cv.width} / ${cv.height}">`;
            keys.forEach((k, i) => pinsOf(k).forEach(p => {
                if (MULTI[k]) h += `<span class="cm-area" style="left:${p.x * 100}%;top:${p.y * 100}%;width:${(2 * areaRadiusPx(cv) / cv.width * 100).toFixed(2)}%"></span>`;
                h += `<span class="cm-dot cm-dot-${k}${i === st.active ? ' on' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%">${PIN_WORD[k]}</span>`;
            }));
            h += '</div>';
        } else {
            h += `<div class="cm-empty"><p class="font-serif-kr">${furOnly ? SHOOT_FUR : SHOOT_GUIDE}</p><p class="cm-note">${furOnly ? SHOOT_FUR_SUB : SHOOT_CARD}</p>`;
            h += '<label class="cm-go font-serif-kr">사진 찍기 · 불러오기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
            h += '<p class="cm-note">사진은 저장되지 않아요</p></div>';
        }
        h += '</div>';
        // 오른쪽: 차례 목록 → 결과
        h += '<div class="cm-side">';
        h += `<span class="q-meta">${esc(o.name)} · ${furOnly ? '가구' : '색'}</span>`;
        const doneTitle = furOnly ? (st.furKind ? '가구 색을 찾았어요' : '어떤 가구인가요?') : '이 공간의 색을 찾았어요';
        h += `<h2 class="cm-title font-serif-kr">${done ? doneTitle : (cv ? (keys[st.active] ? `사진에서 ${CUST_ASK[keys[st.active]]}` : '사진을 눌러 주세요') : '먼저 사진을 찍어 주세요')}</h2>`;
        h += `<p class="cm-sub">${done ? (o.doneNote || '') : (cv ? '잘못 찍은 점은 누르면 지워져요. 목록을 누르면 그것만 다시 찍어요.' : '회색·흰 카드로 사진의 빛을 맞춰서 실제 색을 찾아요.')}</p>`;
        h += '<ul class="cm-steps">';
        keys.forEach((k, i) => {
            const n = pinsOf(k).length, full = isFull(k), on = cv && i === st.active;
            const c = full && MULTI[k] ? res[k] : null;
            h += `<li class="${on ? 'on' : (full ? 'done' : '')}" onclick="RoomColor.custStep(${i})"><span class="cm-n">${full && !on ? '✓' : i + 1}</span>${CUST_LABEL[k]}`
                + (on ? `<small>${MULTI[k] ? `${n} / ${AREA_POINTS}곳` : '카드 가운데 한 번'}</small>` : (full && cv ? '<small class="cm-redo">다시 찍기</small>' : ''))
                + (c ? `<i style="background:${c.hex}"></i>` : '') + '</li>';
        });
        h += '</ul>';
        if (res.cardsSwapped) h += '<p class="cm-alert">흰 카드와 회색 카드를 바꿔 누른 것 같아요. 목록에서 카드를 눌러 다시 찍어 주세요.</p>';
        else if (res.shadow >= SHADOW_DL) h += '<p class="cm-alert">카드에 그림자가 졌어요. 그대로 써도 되고, 조금 옮겨 다시 찍으면 더 정확해요.</p>';
        if (done && !res.cardsSwapped && furOnly) {
            // 가구 (66번): 색 한 줄 + 종류 칩. 종류를 골라야 담기
            const c = res.fur;
            if (c) {
                const kindNm = st.furKind || '가구', nm = colorName(furKind(st.furKind), c);
                h += `<div class="cm-res"><div><i class="cm-fur-dm" style="background:${c.hex}"></i><span><b class="font-serif-kr">${esc(nm.name)}<em class="hex-code">${esc(String(c.hex).toUpperCase())}</em></b><small>${esc(kindNm)} · ${esc(nm.note)}</small></span></div></div>`;
            }
            h += '<div class="fur-box cm-fur"><span class="fur-lbl">어떤 가구인가요?</span><div class="fur-chips">'
                + FUR_NAMES.map(n => `<button type="button" class="${st.furKind === n ? 'on' : ''}" onclick="RoomColor.furKindPick('${n}')">${n}</button>`).join('') + '</div></div>';
        } else if (done && !res.cardsSwapped) {
            h += '<div class="cm-res">';
            ['floor', 'wall'].forEach(k => {
                const c = res[k];
                if (!c) return;
                const nm = colorName(k, c);
                h += `<div><i style="background:${c.hex}"></i><span><b class="font-serif-kr">${esc(nm.name)}<em class="hex-code">${esc(String(c.hex).toUpperCase())}</em></b><small>${k === 'wall' ? '벽' : '바닥'} · ${esc(nm.note)}</small></span></div>`;
            });
            h += '</div>';
            if (res.wall && res.floor) h += custBridgeHtml(res);
            // 공간 추가 때: 결과 아래 창 방향 버튼 (35번, concierge.js가 그리고 값을 가짐)
            if (o.dirPick && window.concierge && window.concierge.dirPickerHtml) h += window.concierge.dirPickerHtml();
        }
        h += '<div class="cm-foot">';
        h += o.onSkip ? '<button type="button" class="cm-skip" onclick="RoomColor.skipCustomer()">지금은 못 재요 · 상담 때 카드로</button>' : '<span></span>';
        if (cv && Object.values(st.pins).some(ps => ps.length)) h += '<button type="button" class="cm-skip" onclick="RoomColor.undo()">방금 것 지우기</button>';
        if (cv) h += '<label class="cm-skip">사진 바꾸기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
        if (done && !res.cardsSwapped && !(furOnly && !st.furKind)) h += `<button type="button" class="cm-go font-serif-kr" onclick="RoomColor.finishCustomer()">${esc(o.doneLabel || '담기')}</button>`;
        h += '</div></div></div>';
        ov.innerHTML = h;
        const wrap = document.getElementById('cmWrap');
        if (wrap && cv) { wrap.prepend(cv); wrap.onpointerdown = onTap; }
    }
    // 가구 따로 찍기 (66번): 고객 화면 모양을 그대로 쓰고 자리만 회색 카드 · 흰 카드 · 가구. opts: { name, onDone(가구 하나), onCancel? }
    //  직원 화면에서도 같은 화면 (사진 한 장에 가구 하나, 그 사진의 카드로만 보정)
    function openFurniture(opts) {
        st = { roomId: null, photos: [null, null], view: 0, active: 0, pins: {}, seq: 0, keys: ['gray', 'white', 'fur'], furKind: null,
               cust: { name: opts.name || '', doneLabel: '가구 담기', furOnly: true, onDone: opts.onDone, onCancel: opts.onCancel || function() {} } };
        let ov = document.getElementById('roomColorCust');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'roomColorCust';
            ov.className = 'cm-overlay';
            document.body.appendChild(ov);
        }
        ov.hidden = false;
        renderCust();
    }
    // 직원 화면 공간 카드의 가구 고치기 (66번): 공간 카드에서 바로 바뀌고 자동 저장
    let staffFurOpen = null;      // { id, i }: 종류 칩을 펼친 가구
    function staffFur(roomId, act, i, n) {
        const room = findRoom(roomId);
        if (!room) return;
        const redraw = () => {
            if (typeof renderRooms === 'function') renderRooms();
            if (typeof calculateAll === 'function') calculateAll();
            if (typeof saveDraftTick === 'function') saveDraftTick();
        };
        if (act === 'open') { staffFurOpen = i >= 0 ? { id: roomId, i } : null; redraw(); return; }
        staffFurOpen = null;
        furListEdit(room.measuredColor && room.measuredColor.furniture, act, i, n, room.name, list => {
            const r2 = findRoom(roomId);
            if (!r2) return;
            r2.measuredColor = withFurniture(r2.measuredColor, list);
            redraw();
            if (act === 'add' && typeof showToast === 'function') showToast(`[${r2.name}] 가구를 담았어요.`);
        });
    }
    function closeCustomer() {
        const ov = document.getElementById('roomColorCust');
        if (ov) { ov.hidden = true; ov.innerHTML = ''; }
        st = null;      // 사진은 버림
    }

    // 방 그림 미니맵 (104번): 잰 벽·바닥·남는 가구 색에 커튼 자리를 칠한 작은 그림. 원단 고르는 장면 위에 둠(대비 세기만 보는 용도)
    //  mc = { wall, floor, furniture? } (L a b) · o = { drape, sheer, blind: hex, count: 폭 수 }. 창 구성대로 그림 (겉지 없으면 속지가 창 전체)
    function roomMiniSvg(mc, o) {
        if (!mc || !mc.wall || !mc.floor) return '';
        const hx = c => c.hex || labToHex(c.L, c.a, c.b);
        o = o || {};
        let s = `<svg class="room-mini" viewBox="0 0 240 150" aria-hidden="true"><rect width="240" height="112" fill="${hx(mc.wall)}"/><rect y="112" width="240" height="38" fill="${hx(mc.floor)}"/>
            <rect x="70" y="24" width="100" height="74" fill="#cfe0ea"/>`;
        if (o.blind) s += `<rect x="70" y="24" width="100" height="56" fill="${o.blind}"/><line x1="70" y1="80" x2="170" y2="80" stroke="#00000030" stroke-width=".8"/>`;
        if (o.sheer || o.drape) s += '<rect x="44" y="16" width="152" height="3" fill="#9a9087"/>';
        if (o.sheer) s += `<rect x="${o.drape ? 66 : 50}" y="19" width="${o.drape ? 108 : 140}" height="93" fill="${o.sheer}" opacity=".82"/>`;
        if (o.drape) {
            const half = Math.max(1, Math.ceil((o.count || 2) / 2)), PW = 40, sw = PW / half;
            [46, 154].forEach(x => {
                s += `<rect x="${x}" y="19" width="${PW}" height="93" fill="${o.drape}"/>`;
                for (let i = 1; i < half; i++) s += `<line x1="${x + i * sw}" y1="19" x2="${x + i * sw}" y2="112" stroke="#00000018" stroke-width=".6"/>`;
            });
        }
        (mc.furniture || []).filter(x => x && x.stay !== false && typeof x.L === 'number').slice(0, 3).forEach((fu, i) => {
            const x = [8, 196, 104][i], wd = i === 2 ? 32 : 36;
            s += `<rect x="${x}" y="${i === 2 ? 120 : 96}" width="${wd}" height="${i === 2 ? 14 : 22}" rx="3" fill="${hx(fu)}" stroke="#00000020" stroke-width=".6"/>`;
        });
        return s + '</svg>';
    }
    // 폭 수 (97번과 같은 셈): 넓이 × 2배 주름 ÷ 원단 폭(대폭 무이음은 90cm 단위). 넓이 없으면 340cm, 폭 없으면 150cm
    function miniWidthCount(widthCm, fab) {
        const spec = (fab && fab.specCm) || 150, unit = spec >= 200 ? 90 : spec;
        return Math.max(2, Math.ceil(((widthCm || 340) * 2) / unit));
    }

    window.RoomColor = {
        roomMiniSvg, miniWidthCount,
        open(roomId) {
            st = { roomId, photos: [null, null], view: 0, active: 0, pins: {}, seq: 0 };
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
        // 직원 화면 "시험" 칸(fake-guest.js)이 같은 톤 나누기·이어주는 색을 쓰도록 꺼냄 (89번, 화면 변화 없음)
        classifyLab, bridgeOf, labToHex,
        step: pickStep,      // 다 찍은 자리면 그 자리만 다시 찍기
        undo,
        view(v) { st.view = v; render(); },
        apply,
        // 직원 화면 공간 카드 안 한 줄: 잰 색 + 맞춘 카드 (고객이 다른 카드를 고르면 그것도 표시)
        summaryHtml(room) {
            const mc = room && room.measuredColor;
            // 가구 (66번): 공간마다 따로 찍어 더하고 빼기. 종류 바꾸기도 여기서
            const openI = staffFurOpen && staffFurOpen.id === room.id ? staffFurOpen.i : -1;
            const furLine = `<div class="rc-summary rc-fur-line"><span class="rc-sum-lbl">가구</span>${furEditorHtml(mc && mc.furniture, `RoomColor.staffFur(${room.id}, `, openI, 'rc-fur-edit')}</div>`;
            if (!mc || !(mc.wall || mc.floor)) return furLine;
            const part = (kind, c) => {
                if (!c) return '';
                const cur = kind === 'wall' ? room.wallTone : room.floorTone;
                const label = kind === 'wall' ? '벽' : '바닥';
                return `<span class="rc-sum-part">${label} <i class="rc-dot" style="background:${c.hex}"></i> <b>${esc(colorName(kind, c).name)}</b> ${classifyLab(c).text} → ${esc(cardName(kind, c.tone))}`
                    + (cur && cur !== c.tone ? ` <em>(지금 카드: ${esc(cardName(kind, cur))})</em>` : '') + '</span>';
            };
            return `<div class="rc-summary"><span class="rc-sum-lbl">잰 색</span>${part('wall', mc.wall)}${part('floor', mc.floor)}`
                + `<span class="rc-sum-btns"><button type="button" onclick="openRoomColorFinder(${room.id})">${mc.wall && mc.floor ? '조화로운 원단 보기' : '원단 찾기'}</button>` // 41번
                + `<button type="button" onclick="RoomColor.open(${room.id})">다시 재기</button></span></div>`
                + (mc.wall && mc.floor ? (() => {
                    const k = typeof mc.bridgeK === 'number' ? mc.bridgeK : BRIDGE_WALL_WEIGHT;
                    const br = mc.bridge || bridgeOf(mc.wall, mc.floor, k);
                    return `<div class="rc-adj" id="rcAdj_${room.id}"><span class="rc-sum-lbl">중간 톤</span>` // 41번
                        + `<span class="rc-adj-end">벽이 많이 보여요</span>`
                        + `<input type="range" min="${Math.round((1 - BRIDGE_K_MAX) * 100)}" max="${Math.round((1 - BRIDGE_K_MIN) * 100)}" step="5" value="${Math.round((1 - k) * 100)}" style="--wall:${mc.wall.hex};--floor:${mc.floor.hex};--mid:${br.hex}" aria-label="벽과 바닥의 중간 톤 조절" oninput="RoomColor.setBridge(${room.id}, +this.value, false)" onchange="RoomColor.setBridge(${room.id}, +this.value, true)">` // 41번
                        + `<span class="rc-adj-end">바닥이 많이 보여요</span>`
                        + `<span class="rc-adj-val"><i class="rc-dot" style="background:${br.hex}"></i> <b class="rc-adj-ratio">${bridgeRatioText(k)}${Math.abs(k - BRIDGE_WALL_WEIGHT) < 0.001 ? ' (기본)' : ''}</b></span></div>`;
                })() : '') + furLine;
        },
        setBridge,
        // ---- 고객 화면 모양 (20번) ----
        openCustomer(opts) {
            const parts = opts.parts === 'wall' ? ['wall'] : (opts.parts === 'floor' ? ['floor'] : ['floor', 'wall']);
            st = { roomId: null, photos: [null, null], view: 0, active: 0, pins: {}, seq: 0, cust: opts, keys: ['gray', 'white'].concat(parts),
                   custK: typeof opts.bridgeK === 'number' ? opts.bridgeK : null };      // 막대 처음 값 (없으면 기본)
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
        custStep: pickStep,      // 목록을 눌러 그 자리를 다시 찍음
        // 가구 따로 찍기 (66번)
        openFurniture,
        furKindPick(n) { if (!st || !st.cust || !st.cust.furOnly || !FUR_NAMES.includes(n)) return; st.furKind = n; renderCust(); },
        staffFur,
        furEditorHtml, furListEdit, withFurniture,
        furName,                 // 저장된 가구 색의 이름 (붙박이장·수납장·식탁·책상·책장 = 바닥 규칙, 나머지 = 벽 규칙)
        furLabel,                // 가구 종류 이름 (예전 수납장·식탁 → 새 이름)
        furStays,                // 그대로 두는 가구인지 (이불·러그는 자주 바뀌는 것)
        FUR_MAX,
        custBridge,              // 이어주는 색 막대 (30번)
        cancelCustomer() { const o = st && st.cust; closeCustomer(); if (o && o.onCancel) o.onCancel(); },
        skipCustomer() { const o = st && st.cust; closeCustomer(); if (o && o.onSkip) o.onSkip(); },
        finishCustomer() {
            if (!st || !st.cust) return;
            const o = st.cust, res = compute();
            if (o.furOnly) {      // 가구 하나 (66번)
                if (!res.fur || res.cardsSwapped || !st.furKind) return;
                const f = packFurOne(res.fur, st.furKind);
                closeCustomer();
                o.onDone(f);
                return;
            }
            if (!(res.wall || res.floor) || res.cardsSwapped) return;
            const mc = packResult(res, (res.wall && res.floor) ? custK() : undefined);
            closeCustomer();
            o.onDone(mc);
        },
        file: onFile,
        removeWall: removeWallPhoto,
        _loadImage: (src, which) => loadImage(src, which || 0),      // 미리보기 시험용
        _state: () => st && compute(),
        rgbToLab, labToHex, classifyLab, bridgeOf, colorName
    };
})();
