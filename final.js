(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['final.js']='20261177';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// final.js — 고객 화면 최종 제안: 도록(76번)·조각보·쇼룸 시트·종이 쪽 넘기기·크게 보기 (130-4③에서 concierge.js에서 떼어 냄). concierge.js·fabric-pick.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore;      // concierge.js와 잇는 다리 (130-4)
    const { state, syncToV1MasterRooms, fabricFillStyle, COMP_NAMES, roomPart, roomSize, roomComp, colorFillOf } = cz;
    let finalPage = 0, finalCardCount = 0, finalHouseCount = 0, finalZoom = false;      // 최종 제안의 쪽 넘기기·크게 보기(39번). cardCount = 견적서 앞 쪽 수(우리 집 색 포함)

    // ---- 최종 제안 통합 에디토리얼 도록 (76번, 시안: 중심화면_최종제안_비교시안.html 탭 2) ----
    //  1) 도입부: 태블릿 세로 100dvh 독점 + Re.dam 로고 + 16:10 액자 비례 미니멀 조각보(창 면적 비례, 순수 단색, 글자·스티커 없음)
    //  2) 공간의 색과 빛: 0.5px 초세선 색 분포 지도 + 집 전체 총평 (중복 가로 막대 6개 제거)
    //  3) 공간별 완결형 쇼룸 시트: 좌측(26% 공간명·빛 방향·창 크기·구성 방식) + 우측(74% 창가 입면 색띠 + 공간 진단 + 겹침 스와치 + 원단 이유)
    //  4) 견적서: 0.5px 초세선 호텔 인보이스 표 + 시공비 + 합계 + 안내 + 마무리 시
    // 80번: 조각보 모양(나눔 나무)을 한 곳에서 만들어 화면(HTML)과 저장 이미지(app.js 그림)가 똑같은 그림을 씀
    //  잎: { hex, area } · 묶음: { dir: 'row' | 'col', area, a, b } (area = flex 비율)
    function buildJogakboHtml(data) {
        const html = n => n.dir
            ? `<div class="jg-group is-${n.dir}" style="flex:${n.area}">${html(n.a)}${html(n.b)}</div>`
            : `<div class="jg-tile" style="flex:${n.area};background:${n.hex}"></div>`;
        return html(buildJogakboTree(data));
    }
    // 113번: 눈으로 같은 색이면 한 조각으로 묶고, 그래도 조각이 많으면 가장 가까운 둘부터 합쳐 상한 이하로
    //  벽·바닥은 종류를 넘어 묶고, 원단은 원단끼리만 묶음(원단이 주인공). 묶인 색은 면적 가중 평균, 면적은 합산
    const JOGAK_DE = 3, JOGAK_MAX = 10;
    function mergeCloseJogak(list) {
        const RC = window.RoomColor;
        if (!RC || !RC.rgbToLab || !RC.labToHex || typeof techDE2000 !== 'function') return list;
        const labOf = hex => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); return m ? RC.rgbToLab(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)) : null; };
        const nodes = list.map(b => ({ hex: b.hex, area: b.area, count: b.count, g: /^fab__/.test(b.key) ? 'fab' : 'surf', lab: labOf(b.hex) })).filter(n => n.lab);
        if (nodes.length !== list.length) return list;
        // 가장 가까운 쌍 (같은 무리끼리, limit 이하만 — sameOnly가 아니면 무리를 넘어서도)
        const closest = (sameOnly, limit) => {
            let best = null;
            for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
                if (sameOnly && nodes[i].g !== nodes[j].g) continue;
                const d = techDE2000(nodes[i].lab, nodes[j].lab);
                if (d <= limit && (!best || d < best.d)) best = { i, j, d };
            }
            return best;
        };
        const join = p => {
            const x = nodes[p.i], y = nodes[p.j], t = (x.area + y.area) || 1;
            const lab = { L: (x.lab.L * x.area + y.lab.L * y.area) / t, a: (x.lab.a * x.area + y.lab.a * y.area) / t, b: (x.lab.b * x.area + y.lab.b * y.area) / t };
            x.lab = lab; x.hex = RC.labToHex(lab.L, lab.a, lab.b); x.area += y.area; x.count += y.count;
            nodes.splice(p.j, 1);
        };
        let p;
        while ((p = closest(true, JOGAK_DE))) join(p);
        while (nodes.length > JOGAK_MAX && (p = closest(true, Infinity) || closest(false, Infinity))) join(p);
        return nodes.map(n => ({ hex: n.hex, area: n.area, count: n.count }));
    }
    function buildJogakboTree(data) {
        const rooms = (data.rooms || []).filter(r => r.items && r.items.length);
        if (!rooms.length) return { hex: '#efe9df', area: 1 };
        // 79번: 상담마다 정해진 조각보 번호로 만든 '정해진 순서의 무작위 수'(mulberry32) — 같은 번호·같은 공간·색이면 언제나 같은 그림
        let seedState = (typeof window.getJogakboSeed === 'function' ? window.getJogakboSeed() : 1) >>> 0;
        const rand = () => {
            seedState = (seedState + 0x6D2B79F5) >>> 0;
            let t = seedState;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        // 78번: 칸마다 반복되던 벽·바닥 얇은 띠를 없애고 모든 조각을 100% 순수 단색 사각형으로 구성.
        // 공간 위계(거실 > 안방 > 방 > 서재/알파룸 > 드레스룸/베란다 + 창 면적)를 반영하되,
        // 같은 벽 색·바닥 색·원단 색은 여러 사각형으로 중복 분할하지 않고 면적을 합산해 하나의 큰 면으로 표현.
        const normHex = h => String(h || '#d9cdbb').trim().toLowerCase();
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
        const buckets = new Map();
        const addBucket = (key, hex, addArea, extraRate) => {
            const cur = buckets.get(key);
            if (!cur) {
                buckets.set(key, { key, hex, area: Math.round(addArea), count: 1 });
            } else {
                cur.area += Math.round(addArea * extraRate);
                cur.count += 1;
            }
        };

        rooms.forEach(rm => {
            const cartRoom = state.roomsCart.find(r => r.name === rm.name);
            const raw = cartRoom || rm.raw || rm || {};
            const sz = roomSize(raw) || { w: 240, h: 235 };
            const rawArea = Math.max(1200, (Number(sz.w) || 240) * (Number(sz.h) || 235));
            const sizeFactor = Math.max(0.48, Math.min(1.80, Math.pow(rawArea / 55000, 0.62)));
            const W = 1000 * typeWeightOf(rm.name) * sizeFactor;

            const wallP = roomPart(raw, 'wall'), floorP = roomPart(raw, 'floor');
            const wHex = (wallP && wallP.hex) || '#f2eee8';
            const fHex = (floorP && floorP.hex) || '#e5ddcf';
            // 벽·바닥: 모든 방이 같은 색이면 합쳐져 집 전체의 큰 바탕 면이 되고, 방마다 다르면 거실 > 안방 > 작은방 비례로 나뉨
            // 121번: 사람 눈높이로 봐도 벽·바닥이 커튼보다 넓음 → 벽·바닥 몫을 키우고 여러 공간이 같은 색이면 더 많이 쌓임
            addBucket('wall__' + normHex(wHex), wHex, W * 0.62, 0.50);
            addBucket('floor__' + normHex(fHex), fHex, W * 0.46, 0.48);

            // 원단: 여러 방에서 같은 원단 색을 쓰면 하나의 면적으로 합산하고, 다르면 공간 크기에 비례해 각자의 면적을 가짐
            const items = rm.items || [];
            const hasDrape = items.some(i => i.kindKey === 'drape' || i.kind === '겉지');
            const hasSheer = items.some(i => i.kindKey === 'sheer' || i.kind === '속지');
            if (items.length >= 2 && hasDrape && hasSheer) {
                const drape = items.find(i => i.kindKey === 'drape' || i.kind === '겉지') || items[0];
                const sheer = items.find(i => i.kindKey === 'sheer' || i.kind === '속지') || items[1];
                const dHex = colorFillOf(drape.fabricId, drape.colorName) || drape.fill || '#b8a894';
                const sHex = colorFillOf(sheer.fabricId, sheer.colorName) || sheer.fill || '#efede7';
                // 121번: 원단은 벽·바닥의 약 절반 이하. 속지는 자주 쳐 두어 보이는 면이 크고, 겉지는 걷어 두는 때가 많아 작게
                addBucket('fab__' + normHex(sHex), sHex, W * 0.32, 0.45);
                addBucket('fab__' + normHex(dHex), dHex, W * 0.18, 0.45);
            } else {
                const it0 = items[0] || {};
                const cHex = colorFillOf(it0.fabricId, it0.colorName) || it0.fill || '#d9cdbb';
                addBucket('fab__' + normHex(cHex), cHex, W * 0.40, 0.45);      // 121번: 커튼 하나·블라인드도 벽·바닥보다 작게
            }
        });

        const planes = mergeCloseJogak(Array.from(buckets.values())).map((b, idx) => {
            // 같은 면적이 우연히 겹쳐도 기계적인 이등분이 되지 않도록 미세한 황금비 변주만 더함
            const area = Math.max(180, Math.round(b.area * (1 + ((idx * 37) % 5 - 2) * 0.03)));
            return { area, hex: b.hex };
        });

        // 조각 순서를 무작위로 섞되(Fisher-Yates), 각 조각의 면적(flex 비율)은 그대로 유지하여
        // 벽·바닥·원단의 실제 면적 비례는 100% 지키면서 구도는 매번 역동적인 몬드리안 추상화로 배치 (78번)
        const arranged = planes.slice();
        for (let i = arranged.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = arranged[i]; arranged[i] = arranged[j]; arranged[j] = tmp;
        }

        // 현재 사각형의 가로·세로 비례(rectW, rectH)를 함께 계산해 지나치게 길쭉한 띠가 생기지 않도록 막으면서,
        // 분할 비율(0.35~0.45 또는 0.55~0.65)과 방향을 역동적으로 교차
        function slice(list, rectW, rectH) {
            if (list.length === 1) return list[0];
            const total = list.reduce((s, x) => s + x.area, 0) || 1;
            const targetRatio = rand() < 0.5 ? (0.36 + rand() * 0.08) : (0.56 + rand() * 0.08);
            let acc = 0, splitIdx = 1, bestDiff = Infinity;
            for (let i = 1; i < list.length; i++) {
                acc += list[i - 1].area;
                const diff = Math.abs(acc / total - targetRatio);
                if (diff < bestDiff) { bestDiff = diff; splitIdx = i; }
            }
            const a = list.slice(0, splitIdx), b = list.slice(splitIdx);
            const sumA = a.reduce((s, x) => s + x.area, 0) || 1;
            const sumB = b.reduce((s, x) => s + x.area, 0) || 1;
            const fracA = sumA / (sumA + sumB), fracB = 1 - fracA;
            const dir = (rectW / rectH > 1.32) ? 'row' : (rectH / rectW > 1.32) ? 'col' : (rand() < 0.5 ? 'row' : 'col');
            const nextWA = dir === 'row' ? rectW * fracA : rectW;
            const nextHA = dir === 'col' ? rectH * fracA : rectH;
            const nextWB = dir === 'row' ? rectW * fracB : rectW;
            const nextHB = dir === 'col' ? rectH * fracB : rectH;
            const nodeA = a.length === 1 ? a[0] : slice(a, nextWA, nextHA);
            const nodeB = b.length === 1 ? b[0] : slice(b, nextWB, nextHB);
            return { dir, area: sumA + sumB, a: nodeA, b: nodeB };
        }
        return slice(arranged, 16, 10);
    }

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
        if (showHouse) h += '<button type="button" onclick="window.concierge.scrollFinalSec(\'finSecHouse\')">공간의 색과 빛</button>';
        if (configuredRooms.length) h += '<button type="button" onclick="window.concierge.scrollFinalSec(\'finSecWhy\')">공간 제안</button>';
        h += '<button type="button" onclick="window.concierge.scrollFinalSec(\'finSecEst\')">견적서</button>';
        h += '<button type="button" class="is-save" onclick="window.concierge.saveQuote()">견적서 저장</button>';
        h += '</nav></div>';

        h += '<article class="fin-ed-doc jg-doc">';

        // [표지] 16:10 조각보(79번) + 아래에 "빛을, / 다시 담습니다"(명조) · "커튼 · 블라인드 방문 상담"(고딕) · 로고 (132번, 시안 v2 1장)
        //  로고는 길게 누르면 직원 화면 PIN 창(data-staff-hold)이라 자리만 아래로 옮김
        h += '<section class="jg-cover-sec">';
        h += `<div class="jg-canvas-wrap"><div class="jg-canvas">${buildJogakboHtml(data)}</div></div>`;
        h += '<footer class="jg-cover-foot"><div><div class="jg-cover-poem font-serif-kr">빛을,<br>다시 담습니다</div><div class="jg-cover-sub">커튼 · 블라인드 방문 상담</div></div>';
        h += '<div class="fin-ed-logo font-serif-kr" data-staff-hold>Re<i>.</i>dam</div></footer>';
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
            if (roomLines.length) h += '<div class="jg-map-read">' + roomLines.map(r => `<div><h3 class="font-serif-kr">${esc(r.name)}</h3><p>${esc(r.text)}</p></div>`).join('') + '</div>';
            if (brief.length) h += `<p class="jg-lead-quote font-serif-kr">${esc(brief.join(' '))}</p>`;
            h += '</section>';
        }

        // [본문] 공간별 완결형 쇼룸 시트 (좌측 26% 공간 스펙 + 우측 74% 창가 입면 색띠·진단·겹침 스와치·원단 설명, 76번)
        if (configuredRooms.length) {
            h += '<section class="jg-showrooms" id="finSecWhy">';
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
                if (st) {
                    const MID = 38;
                    const baseH = st.baseR ? Math.round(MID * st.baseR) : 0;
                    const midSegs = st.mid.map(m => `<div style="flex:${m.f};background:${m.hex}"></div>`).join('');
                    h += `<div class="jg-sr-elev arch-layer-box is-mini">`
                        + `<div class="arch-mid-window" style="height:${MID - baseH}px">${midSegs}</div>`
                        + (baseH ? `<div class="arch-wall-base" style="height:${baseH}px;background:${st.wHex}"></div>` : '')
                        + `<div class="arch-bot-floor" style="background:${st.fHex}"></div>`
                        + `</div>`;
                }
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
        (data.rooms || []).forEach(room => {
            h += '<div class="fin-est-space">';
            h += `<div class="fin-est-hd"><span class="fin-est-rname font-serif-kr">${esc(room.name)}</span>${room.sampleOnly ? '' : `<span class="fin-est-rsum font-serif-kr">${room.total.toLocaleString()}원</span>`}</div>`;
            (room.items || []).forEach(it => {
                h += '<div class="fin-est-line">';
                h += `<div class="fin-est-chip" style="${fabricFillStyle(it.fabricId, it.colorName)}"></div>`;
                h += `<span class="fin-est-k">${esc(it.kind)}</span>`;
                h += `<span class="fin-est-nm font-serif-kr">${esc(it.bookName || it.name)}${it.meta ? `<small>${esc(it.meta)}</small>` : ''}</span>`;
                h += `<span class="fin-est-sz">${esc(it.size || '')}</span>`;
                h += `<span class="fin-est-pr font-serif-kr">${it.sampleOnly ? '' : `${it.price.toLocaleString()}원`}</span>`;
                h += '</div>';
            });
            h += '</div>';
        });
        h += '</div>';
        h += '<div class="fin-est-foot">';
        // 132번: 손님 화면에서는 입력 칸 대신 글자 "30,000원"(고치는 것은 직원 화면 견적 칸) + 부가세 줄(일반 판매가 "포함" / 세금계산서 10% 금액)
        h += '<div class="fin-est-sums">';
        if (data.install > 0) h += `<div class="fin-est-install"><span>시공 및 설치비</span><span class="font-serif-kr">${Number(data.install).toLocaleString()}원</span></div>`;
        if (data.vatText) h += `<div class="fin-est-install"><span>${esc(data.vatLabel || '부가세')}</span><span class="font-serif-kr">${esc(data.vatText)}</span></div>`;
        h += '</div>';
        h += `<div class="fin-est-total-row"><span class="fin-est-total-lbl">합계 금액 (시공비 포함)</span><span class="fin-est-total-num font-serif-kr"><span id="finEdTotalNum">${esc(data.total)}</span><small>원</small></span></div>`;
        const infoRows = [
            ['안내', data.note],
            ['결제 조건', data.pay],
            ['맞춤 제작 안내', data.custom],
            ['공급자', data.supplier]
        ].filter(([, v]) => v && String(v).trim());
        if (infoRows.length) {
            h += '<dl class="fin-est-dl">' + infoRows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v).trim()).replace(/\r?\n/g, '<br>')}</dd>`).join('') + '</dl>';
        }
        h += '</div></section>';

        // [맺음] 132번: 견적서 아래 시를 떼어 어두운 바탕 한 장으로 — 금액이 마지막 인상이 되지 않게
        h += '<footer class="fin-ed-closing"><div class="fin-closing-poem font-serif-kr">빛을,<br>다시 담습니다</div><div class="fin-closing-mark font-serif-kr">Re<i>.</i>dam</div></footer>';
        h += '<div class="fin-ed-foot font-serif-kr">';
        h += '<div class="fin-ed-foot-main"><button type="button" class="dos-act is-main" onclick="window.concierge.saveQuote()">견적서 저장</button><button type="button" class="dos-act" onclick="window.concierge.copyQuoteText()">카톡 글 복사</button><button type="button" class="dos-act" onclick="window.concierge.printQuote()">인쇄</button></div>';
        h += '<div class="fin-ed-foot-sub"><button type="button" onclick="window.concierge.goToSpaceCanvas()">← 공간 추가·수정</button></div>';
        h += '</div>';
        h += '</article>';

        box.innerHTML = h;
        if (showHouse && typeof drawHouseMap === 'function') {
            const cv = document.getElementById('finEdMapCanvas');
            if (cv) {
                const ctx = cv.getContext('2d');
                ctx.save();
                ctx.scale(2, 2);
                ctx.fillStyle = '#fffdf9';      // 132번: 상자 없이 종이 위에 바로 (도록의 말)
                ctx.fillRect(0, 0, cv.width / 2, cv.height / 2);
                drawHouseMap(ctx, sp, '#fffdf9');
                ctx.restore();
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
        const groupOf = k => k < finalHouseCount ? 'house' : (k < finalCardCount ? 'why' : 'ticket');
        const nextWord = { why: '공간 제안', ticket: '견적서 보기' }, prevWord = { house: '공간의 색과 빛', why: '공간 제안' };
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
            const { canvases, cardCount, houseCount } = await window.makeTicketBlobs({ canvasOnly: true, pixelRatio: 1.5 });
            const box = document.getElementById('finPaper');
            if (seq !== finalPaperSeq || !box || state.step !== "7-Final-Dossier") return;      // 그리는 사이 화면이 바뀌었으면 버림
            box.innerHTML = '';
            finalCardCount = cardCount || 0;
            finalHouseCount = houseCount || 0;
            canvases.forEach((c, k) => {
                const img = document.createElement('img');
                img.alt = k < finalHouseCount ? '공간의 색과 빛' : ((k < finalCardCount) ? '공간 제안' : '견적서');
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
    Object.assign(cz, { buildJogakboTree, showroomRowsOf, renderFinalEditorial, setFinalPage, finalPageNow, resetFinalPage, queueFinalPaper });      // concierge.js가 부름
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
