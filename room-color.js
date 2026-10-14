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
    const SAMPLE = 21;                        // 누른 자리 주변 21×21px 평균
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

    // 두 카드로 보정: 빨강·초록·파랑을 따로, 회색 카드는 L50 회색 · 흰 카드는 L95 흰색이 되도록 곧게 늘임
    // (카메라의 노출과 색 틀어짐을 함께 바로잡음. Lab에서 색기만 빼는 것보다 진한 색에서 정확)
    function compute() {
        const s = {};
        STEPS.forEach(stp => { s[stp.key] = st.pins[stp.key] ? samplePin(st.pins[stp.key]) : null; });
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
                    if (st.pins.wall && st.pins.wall.v === 1) delete st.pins.wall;
                    st.active = 3;
                } else {
                    Object.keys(st.pins).forEach(k2 => { if (st.pins[k2].v === 0) delete st.pins[k2]; });
                    st.active = 0;
                }
                render();
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
        if (st.pins.wall && st.pins.wall.v === 1) delete st.pins.wall;
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
    function bridgeOf(w, f) {
        const k = BRIDGE_WALL_WEIGHT, kab = BRIDGE_WALL_WEIGHT_AB;
        const c = { L: w.L * k + f.L * (1 - k), a: w.a * kab + f.a * (1 - kab), b: w.b * kab + f.b * (1 - kab) };
        const r = v => Math.round(v * 10) / 10;
        return { L: r(c.L), a: r(c.a), b: r(c.b), hex: labToHex(c.L, c.a, c.b) };
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
        mc.bridge = mc.wall && mc.floor ? bridgeOf(mc.wall, mc.floor) : null;
        room.measuredColor = mc;
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
            h += `<div class="rc-canvas-wrap" id="rcCanvasWrap" style="aspect-ratio:${cv.width} / ${cv.height};width:min(100%, calc(56vh * ${(cv.width / cv.height).toFixed(4)}))">`;      // 세로 사진도 화면 안에
            STEPS.forEach((s2, i) => {
                const p = st.pins[s2.key];
                if (!p || p.v !== st.view) return;
                h += `<span class="rc-pin${i === st.active ? ' on' : ''}" style="left:${p.x * 100}%;top:${p.y * 100}%;background:${s2.color}">${i + 1}</span>`;
            });
            h += '</div>';
        } else {
            h += '<div class="rc-empty">';
            h += '<p class="font-serif-kr">걸레받이에 <b>회색·흰 카드</b>를 기대어 놓고<br>바닥과 벽이 함께 나오게 한 장 찍어 주세요</p>';
            h += '<p class="rc-empty-sub">카드는 손에서 떼 주세요(손 그림자가 지지 않게). 사진은 저장되지 않아요.</p>';
            h += '<label class="staff-btn rc-empty-btn">사진 불러오기<input type="file" accept="image/*" hidden onchange="RoomColor.file(this, 0)"></label>';
            h += '</div>';
        }
        h += '<div class="rc-steps">';
        STEPS.forEach((s2, i) => {
            const done = !!st.pins[s2.key];
            h += `<button type="button" class="rc-step${i === st.active ? ' on' : ''}${done ? ' done' : ''}" onclick="RoomColor.step(${i})"${st.photos[0] ? '' : ' disabled'}>`;
            h += `<span>${s2.label}${done ? ' ✓' : ''}</span><small>${s2.sub}</small></button>`;
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
                const br = bridgeOf(res.wall, res.floor);
                h += '<div class="rc-bridge"><span class="rc-bridge-lbl">벽과 바닥을 이어주는 색</span>';
                h += `<div class="rc-bridge-bar"><i style="background:${res.wall.hex}"></i><span style="background:linear-gradient(90deg, ${res.wall.hex}, ${br.hex} ${(1 - BRIDGE_WALL_WEIGHT) * 100}%, ${res.floor.hex})"><b style="left:${(1 - BRIDGE_WALL_WEIGHT) * 100}%;background:${br.hex}"></b></span><i style="background:${res.floor.hex}"></i></div>`;
                h += `<span class="rc-res-lab">벽 ${Math.round(BRIDGE_WALL_WEIGHT * 10 * 10) / 10} : 바닥 ${Math.round((1 - BRIDGE_WALL_WEIGHT) * 10 * 10) / 10} (임시) · ${classifyLab(br).text} · 밝기 L ${br.L.toFixed(1)}</span></div>`;
            }
            if (res.raw.gray && res.raw.white) {
                h += `<p class="rc-cards">카드 읽은 값: 회색 L ${res.raw.gray.lab.L.toFixed(1)} · 흰 L ${res.raw.white.lab.L.toFixed(1)}`
                   + (st.photos[1] && st.pins.wall && st.pins.wall.v === 1 ? '<br>벽 사진에는 카드가 없어 카드 사진의 두 카드로 보정했어요.' : '') + '</p>';
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

    function onTap(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        const key = STEPS[st.active].key;
        st.pins[key] = { v: st.view, x, y };
        // 다음 비어 있는 자리로. 벽 사진이 있으면 ④ 벽은 그 사진에서
        const next = STEPS.findIndex(s2 => !st.pins[s2.key]);
        if (next >= 0) {
            st.active = next;
            if (st.photos[1]) st.view = STEPS[next].key === 'wall' ? 1 : 0;
        }
        render();
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
            const p = st.pins[STEPS[i].key];
            if (st.photos[1]) st.view = p ? p.v : (STEPS[i].key === 'wall' ? 1 : 0);
            render();
        },
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
                + `<button type="button" onclick="RoomColor.open(${room.id})">다시 재기</button></span></div>`;
        },
        file: onFile,
        removeWall: removeWallPhoto,
        _loadImage: (src, which) => loadImage(src, which || 0),      // 미리보기 시험용
        _state: () => st && compute(),
        rgbToLab, labToHex, classifyLab
    };
})();
