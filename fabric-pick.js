(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['fabric-pick.js']='20261181';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// fabric-pick.js — 고객 화면 원단 고르는 화면의 색상 덱·원단 카드·원단 사진 주소 기억·"찾는 중" 화면 (130-4②에서 concierge.js에서 떼어 냄). concierge.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore;      // concierge.js와 잇는 다리 (130-4)
    const { state, getLiveDb, getLiveCategoryPool, roomHasLab } = cz;

    // ---- 원단 카드 안의 색상 덱 ----
    // 색상 순서: 분류돼 있으면 어울리는 색부터(랭킹 순), 아니면 번호 순
    function colorDeckOrder(best) {
        const numSort = (x, y) => (/^\d+$/.test(x.name) && /^\d+$/.test(y.name)) ? parseInt(x.name, 10) - parseInt(y.name, 10) : x.name.localeCompare(y.name, 'ko');
        const list = best.classified ? best.ranked.slice() : best.ranked.slice().sort(numSort);
        return list.map(r => r.name);
    }
    // 방 그림 미니맵 (104번): 지금 고르는 칸은 마지막으로 본 원단 색, 같은 공간의 다른 칸은 이미 고른 원단 색으로
    function fabricMiniSvg() {
        const ed = state.editingRoom, item = state.pendingItemQueue && state.pendingItemQueue[state.currentItemIndex];
        if (!ed || !item || !window.RoomColor || !RoomColor.roomMiniSvg || !roomHasLab(ed)) return '';
        const o = {}, mp = state.miniPick || {};
        let curFab = null;
        (ed.items || []).forEach(it => {
            const k = it.presetType;
            if (it === item) { if (mp.fabId) { o[k] = colorFillOf(mp.fabId, mp.color); curFab = getLiveDb().find(f => f.id === mp.fabId); } }
            else if (it.fabricId) o[k] = colorFillOf(it.fabricId, it.colorName);
        });
        const drapeItem = (ed.items || []).find(it => it.presetType === 'drape');
        const dFab = drapeItem === item ? curFab : (drapeItem && drapeItem.fabricId ? getLiveDb().find(f => f.id === drapeItem.fabricId) : null);
        o.count = RoomColor.miniWidthCount(ed.width, dFab);
        return RoomColor.roomMiniSvg(ed.measuredColor, o);
    }
    function refreshMini(fabId, color) {
        state.miniPick = { fabId, color };
        const box = document.getElementById('roomMiniBox');
        if (box) box.innerHTML = fabricMiniSvg();
        // 110번: 미니맵에 비춰 보는 원단 칸에 "한 번 더 누르면 선택" (미니맵이 그려질 때만)
        const on = !!(box && box.innerHTML.trim());
        state.miniArmed = on ? fabId : null;      // 색을 바꿔 칸을 새로 그려도 표시가 남게
        document.querySelectorAll('.fab-panel .bookmark-card').forEach(c => c.classList.toggle('is-armed', on && c.getAttribute('data-fab') === fabId));
    }
    // 색 하나의 바탕색: 색상 입력표에서 잰 색(색상코드)이 있으면 그 색, 없으면 톤으로 짐작한 색. 사진이 없을 때 칸 바탕과 견본 칩에 씀
    function colorFillOf(fabricId, colorName) {
        const col = (colorName && typeof fabricColorOf === 'function') ? fabricColorOf(fabricId, colorName) : null;
        if (col && col.hex) return col.hex;
        return (typeof fabricToneFill === 'function') ? fabricToneFill(fabricId, colorName) : '#d9cdbb';
    }
    // 고객에게 보여 줄 원단 이름: 괄호(암막률·가격 등), 가격, 앞의 책자 이름을 뺌. 색은 이름 옆에 따로 작게 (번호는 붙이지 않음)
    function fabricDisplayName(f) {
        let n = String(f.name || '');
        n = n.replace(/\([^)]*\)/g, ' ').replace(/[0-9,]+\s*원/g, ' ');
        const book = String(f.book || '').trim();
        if (book && n.trim().startsWith(book + ' ')) n = n.trim().slice(book.length);
        return n.replace(/\s+/g, ' ').trim() || String(f.name || '');
    }
    // 색 표시: 색 이름이 있으면 이름(화이트), 없으면 "3번". 색이 하나뿐이고 이름도 없으면 표시 안 함
    function colorTagOf(f, pick, n) {
        const label = (pick && typeof colorLabelOf === 'function') ? colorLabelOf(f.id, pick) : '';
        if (label) return label;
        if (!pick || n < 2) return '';
        return /^\d+$/.test(String(pick)) ? `${pick}번` : String(pick);
    }
    // 원단 한 칸: 사진(없으면 그 색) 위쪽 + 아래 짙은 띠에 세로 원단 이름 · 세로 색 이름 · 오른쪽 아래 견본 칩(색이 둘 이상일 때)
    // 추천 이유는 칸에 넣지 않음(10-14 사장님 결정. 제안서·견적서에는 그대로)
    // 품명 끝의 색 이름(예: 오솔로 화이트)은 이름에서 떼어 색 자리로 → 이름 길이가 고르게. 직원 화면 "고객에게 보여주기"도 같은 규칙
    const NAME_COLOR_WORD = /\s+(오프화이트|퓨어화이트|화이트|아이보리|크림|라이트베이지|베이지|샌드|오트밀|그레이지|라이트그레이|그레이|차콜|모카|토프|카멜|브라운|초콜릿|네이비|블랙)$/;
    function splitNameColor(f, colorTag) {
        let name = fabricDisplayName(f);
        const cw = NAME_COLOR_WORD.exec(name);
        if (cw && name.length > cw[0].length) { name = name.slice(0, -cw[0].length); colorTag = colorTag || cw[1]; }
        return { name, colorTag };
    }
    function fabricCardHtml(f, best, idx, pick, queueItem, targetCategory) {
        const order = colorDeckOrder(best), n = order.length;
        const { name, colorTag } = splitNameColor(f, colorTagOf(f, pick, n));
        // 글자 수 세기: 영어·숫자는 눕혀 쓰므로 0.6자(대문자 0.78자)로 셈
        const vlen = s => Array.from(String(s)).reduce((a, ch) => a + (/[A-Z]/.test(ch) ? 0.78 : (/[a-z0-9 .\/%&-]/.test(ch) ? 0.6 : 1)), 0) || 1;   // 영어 대문자는 조금 더 넓게
        const isLast = idx === (state.fabPanelCount || 1) - 1;
        let h = `<div class="bookmark-card color-top${state.miniArmed === f.id ? ' is-armed' : ''}" data-fab="${f.id}" style="right: 0;" onclick="window.concierge.handleQueueFabricClick('${f.id}')">`;
        h += `<div class="bookmark-bg" style="background: ${colorFillOf(f.id, pick)};"></div>`;
        // 사진은 앞·뒤 두 장: 색을 바꿀 때 뒤 장에 새 사진을 받아 겹쳐 바꿈. 주소는 미리 찾아 둔 것만 씀(아직 모르면 찾은 뒤 넣음)
        const known = knownPhoto(f.id, pick);
        h += `<img class="fabric-photo is-front" alt="" data-id="${f.id}" data-color="${pick}"${known ? ` src="${known}"` : (known === undefined ? ' data-pending="1"' : '')}>`;
        h += '<img class="fabric-photo is-back" alt="">';
        h += '<div class="bookmark-gradient fab-gradient"></div>';
        // 아래 띠: 왼쪽에 세로 이름(아래 정렬), 그 오른쪽에 세로 색 이름. 오른쪽 끝 아래에 견본 칩
        h += `<div class="fab-band${isLast ? ' is-last' : ''}">`;
        const latin = /[A-Za-z]{3,}/.test(name);      // 영어 낱말(3글자 이상)이 있을 때만 눕혀 씀. "울피치 A"처럼 한두 글자는 한글처럼 세워 씀
        const stack = s => Array.from(String(s)).map(ch => ch === ' ' ? '<i class="vsp"></i>' : `<span>${ch}</span>`).join('');
        h += latin ? `<h3 class="fab-vname is-latin font-serif-kr" style="--len: ${vlen(name).toFixed(2)};">${name}</h3>`
                   : `<h3 class="fab-vname vstack font-serif-kr" style="--len: ${vlen(name).toFixed(2)};">${stack(name)}</h3>`;
        if (colorTag) h += `<p class="fab-vdesc vstack">${stack(colorTag)}</p>`;
        if (n > 1) {
            // 견본 칩: 색마다 하나(어울리는 색 순서). 누르면 그 색이 칸에 나옴, 지금 색은 밑줄. 칸(원단)을 누르면 지금 색으로 고름
            h += '<div class="fab-chips">' + order.map(nx => {
                const label = colorTagOf(f, nx, n);
                return `<button type="button" class="fab-chip${nx === pick ? ' on' : ''}" data-c="${String(nx).replace(/"/g, '&quot;')}" aria-label="${label}" aria-pressed="${nx === pick}" onclick="event.stopPropagation(); window.concierge.showColor('${f.id}', '${String(nx).replace(/'/g, "\\'")}')"><i style="background: ${colorFillOf(f.id, nx)};"></i></button>`;
            }).join('') + '</div>';
        }
        h += '</div>';
        // 마지막 칸에만 Re.dam 표시 (오른쪽 아래). 2초 누르고 있으면 직원 화면
        if (isLast) h += '<div class="card-brand" data-staff-hold onclick="event.stopPropagation()">Re<i class="logo-dot">.</i>dam</div>';
        h += '</div>';
        return h;
    }
    // (예전 "옆으로 밀기"·"뒤에 겹친 색 띠"는 뺐음 → 지금은 아래 띠의 견본 칩을 눌러 색을 바꿈)
    // 견본 칩은 아래 한 줄만 (원단마다 모양이 같게 — 10-14 사장님): 넘치면 줄 끝에 "+7" 칩 → 누르면 사진 위로 모든 색 판이 올라옴
    const CHIP_ROWS = 1, CHIP_W = 44;
    function fitChips(panel) {
        const box = panel.querySelector('.fab-chips');
        if (!box) return;
        const card = panel.querySelector('.bookmark-card');
        if (card) card.classList.remove('is-allcolors');      // 다시 맞추면 늘 한 줄로
        const chips = Array.from(box.querySelectorAll('.fab-chip'));
        chips.forEach(c => { c.hidden = false; });
        const old = box.querySelector('.fab-more');
        if (old) old.remove();
        const perRow = Math.floor(box.clientWidth / CHIP_W);
        if (!perRow || chips.length <= perRow * CHIP_ROWS) return;      // 화면에 안 보여 폭을 모를 때(0)는 그대로 둠
        const keep = perRow * CHIP_ROWS - 1;
        chips.slice(keep).forEach(c => { c.hidden = true; });
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'fab-more';
        more.textContent = '+' + (chips.length - keep);
        more.setAttribute('aria-label', `색 ${chips.length - keep}개 더 보기`);
        more.onclick = ev => { ev.stopPropagation(); openAllColors(panel); };
        box.appendChild(more);
        syncMoreChip(panel);
    }
    // 지금 색이 숨은 칩 가운데 있으면 "+7" 칩에 밑줄
    function syncMoreChip(panel) {
        const more = panel.querySelector('.fab-more');
        if (more) more.classList.toggle('on', Array.from(panel.querySelectorAll('.fab-chips .fab-chip[hidden]')).some(c => c.classList.contains('on')));
    }
    // "+7"을 누르면: 판을 따로 띄우지 않고 그 띠 안에서 숨은 칩을 모두 펼침 (아래 줄부터 위로 쌓임)
    //  - 띠 안에 다 들어가면 띠 크기 그대로, 넘칠 때만 넘친 줄이 사진 위로 올라감(띠와 같은 갈색). 줄 끝 "접기"로 다시 한 줄
    //  - 색을 눌러도 펼친 채로 유지(그 색으로만 바뀜). "접기" · 칸 밖 누르기 · 뒤로를 누르면 접힘
    function openAllColors(panel) {
        closeAllColors();
        const card = panel.querySelector('.bookmark-card'), box = panel.querySelector('.fab-chips');
        if (!card || !box) return;
        box.querySelectorAll('.fab-chip').forEach(c => { c.hidden = false; });
        const more = box.querySelector('.fab-more');
        if (more) {
            more.textContent = '접기';
            more.classList.remove('on');
            more.classList.add('is-fold');
            more.setAttribute('aria-label', '색 접기');
            more.onclick = ev => { ev.stopPropagation(); closeAllColors(); };
        }
        card.classList.add('is-allcolors');
    }
    // 펼친 칩을 한 줄로 접음. 접은 게 있으면 true (뒤로 버튼이 씀)
    function closeAllColors() {
        const open = Array.from(document.querySelectorAll('.bookmark-card.is-allcolors'));
        open.forEach(card => { card.classList.remove('is-allcolors'); const p = card.closest('.fab-panel'); if (p) fitChips(p); });
        return open.length > 0;
    }
    // 펼친 칸 밖을 누르면 접기만 함 (다른 원단 칸이 골라지지 않게)
    document.addEventListener('click', ev => {
        const card = document.querySelector('.bookmark-card.is-allcolors');
        if (!card || card.querySelector('.fab-chips').contains(ev.target)) return;
        ev.stopPropagation(); ev.preventDefault();
        closeAllColors();
    }, true);
    let fitChipsTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(fitChipsTimer);
        fitChipsTimer = setTimeout(() => document.querySelectorAll('.fab-panel').forEach(fitChips), 150);
    });
    function bindFabricPanel(panel) { fitChips(panel); }
    function bindColorDecks() {
        document.querySelectorAll('.fab-panel').forEach(bindFabricPanel);
    }
    function roomWithTaste(r) {
        if (!r) return r;
        if (typeof roomWithSurveyTaste === 'function') return roomWithSurveyTaste(r);
        return r;
    }
    // 원단 화면에 나올 원단 3개 (지금 칸의 종류에 맞춰, 공간에 어울리는 점수 순). "찾는 중" 화면과 원단 화면이 같은 결과를 씀
    function fabricShowcase() {
        const queueItem = state.pendingItemQueue[state.currentItemIndex] || { label: "창문", presetType: "sheer" };
        const targetCategory = queueItem.presetType === 'blind' ? '블라인드' : (queueItem.presetType === 'sheer' ? '속지' : '겉지');
        const roomEffective = roomWithTaste(state.editingRoom);
        // 원단마다 "공간에 가장 어울리는 색"까지 계산해 순위를 매김. 점수가 같으면 사장님이 직접 분류한 원단을 먼저
        const fits = f => (typeof colorPlanFits === 'function') ? colorPlanFits(f, roomEffective, targetCategory) : true;      // 98번: 고른 갈래 원단 먼저, 모자라면 기존 추천으로 채움
        const ranked = getLiveCategoryPool(targetCategory).map(f => ({ f: f, fit: fits(f), best: bestColorFor(f, roomEffective, targetCategory) }));
        ranked.sort((a, b) => ((b.fit ? 1 : 0) - (a.fit ? 1 : 0)) || (b.best.score - a.best.score)
            || ((isManualTagged(b.f) ? 1 : 0) - (isManualTagged(a.f) ? 1 : 0)));
        const showcaseList = (typeof pickShowcase === 'function') ? pickShowcase(ranked, 3, typeof colorPlanMode === 'function' && colorPlanMode(roomEffective, targetCategory) === 'point') : ranked.slice(0, 3);      // 120번: 포인트 자리는 색 계열을 나눠
        return { queueItem, targetCategory, showcaseList };
    }

    // ---- 원단 사진 주소 기억 ----
    // 원단·색마다 실제로 있는 사진 주소(없으면 '')를 한 번만 찾아 둠 → 없는 주소(.webp·.png 등)를 다시 시도하며 깜빡이지 않게
    // decode까지 끝낸 뒤에 알려 주므로, 받은 주소를 화면에 넣으면 바로 그려짐
    const photoSeek = {};       // 원단ID__색 → Promise(주소 또는 '')
    const photoKnown = {};      // 원단ID__색 → 주소 또는 '' (찾기가 끝난 것만)
    function findPhoto(fabId, color) {
        const key = fabId + '__' + (color || '');
        if (!photoSeek[key]) {
            // 직원 화면 사진 확인 목록(app.js, 기기에 저장됨)을 먼저 봄: 있는 주소면 그것부터, 이번 실행에서 확인했는데 없으면 찾지 않음
            const listed = (typeof knownPhotoFor === 'function') ? knownPhotoFor(fabId, color) : undefined;
            if (listed === '') { photoKnown[key] = ''; photoSeek[key] = Promise.resolve(''); return photoSeek[key]; }
            let urls = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabId, color) : [];
            if (listed) urls = [listed].concat(urls.filter(u => u !== listed));
            photoSeek[key] = (async () => {
                // 기기에 넣은 사진(34번)을 다 읽기 전이면 기다렸다가 그 주소부터
                if (typeof DevicePhotos !== 'undefined') {
                    await DevicePhotos.ready;
                    const dev = (typeof fabricPhotoUrls === 'function') ? fabricPhotoUrls(fabId, color) : [];
                    urls = dev.concat(urls.filter(u => !dev.includes(u)));
                }
                for (const u of urls) {
                    const im = new Image();
                    im.src = u;
                    try { await im.decode(); photoKnown[key] = u; return u; } catch (e) {}
                }
                photoKnown[key] = '';
                return '';
            })();
        }
        return photoSeek[key];
    }
    function knownPhoto(fabId, color) { return photoKnown[fabId + '__' + (color || '')]; }
    // 기기 사진을 넣거나 지운 뒤 (34번): 기억해 둔 주소를 잊고 다음에 다시 찾음
    function forgetPhotos() { Object.keys(photoSeek).forEach(k => delete photoSeek[k]); Object.keys(photoKnown).forEach(k => delete photoKnown[k]); }

    // 견본 칩으로 색을 바꿈: 칸은 그대로 두고 사진만 바꿈 (칸 전체를 새로 그리면 글자·칩까지 깜빡여서)
    //  - 뒤 장에 새 사진을 넣고 decode가 끝난 뒤 0.25초 겹쳐 바꿈. 사진이 없는 색은 앞 장만 사라져 바탕색이 보임
    //  - 바탕색 · 세로 색 이름 · 칩 밑줄은 그 자리에서 값만 바꿈. 빨리 여러 번 누르면 마지막 것만 남음
    function swapFabricPanel(panel, html, fabId, colorName) {
        const card = panel.querySelector('.bookmark-card');
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const next = tmp.querySelector('.bookmark-card');
        if (!card || !next) { panel.innerHTML = html; return; }
        const bg = card.querySelector('.bookmark-bg'), nbg = next.querySelector('.bookmark-bg');
        if (bg && nbg) bg.style.background = nbg.style.background;
        const desc = card.querySelector('.fab-vdesc'), ndesc = next.querySelector('.fab-vdesc');
        if (desc && ndesc) desc.innerHTML = ndesc.innerHTML;
        else if (desc) desc.remove();
        else if (ndesc) { const name = card.querySelector('.fab-vname'); if (name) name.after(ndesc); }
        const nchips = Array.from(next.querySelectorAll('.fab-chip'));
        card.querySelectorAll('.fab-chip').forEach((b, i) => {
            const on = !!nchips[i] && nchips[i].classList.contains('on');
            b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
        });
        syncMoreChip(panel);
        const token = (panel.__swap || 0) + 1;
        panel.__swap = token;
        card.querySelectorAll('.fabric-photo').forEach(img => { img.removeAttribute('data-pending'); img.setAttribute('data-color', colorName || ''); });
        findPhoto(fabId, colorName).then(url => {
            if (panel.__swap !== token) return;
            const front = card.querySelector('.fabric-photo.is-front'), back = card.querySelector('.fabric-photo.is-back');
            if (!front || !back) return;
            if (!url) { front.style.opacity = '0'; return; }
            if (front.getAttribute('src') === url && front.style.opacity !== '0') return;
            back.src = url;
            const show = () => {
                if (panel.__swap !== token) return;
                back.style.opacity = '1'; front.style.opacity = '0';
                setTimeout(() => {
                    if (panel.__swap !== token) return;
                    front.classList.replace('is-front', 'is-back'); back.classList.replace('is-back', 'is-front');
                    front.removeAttribute('style'); back.removeAttribute('style');
                }, 260);
            };
            (back.decode ? back.decode() : Promise.resolve()).then(show, show);
        });
    }

    // ---- "찾는 중" 화면: 원단 화면이 열리기 전, 보여 줄 원단 3개의 모든 색 사진을 미리 받아 둠 ----
    //  - 밝은 종이색 바탕 + 흰빛이 모여 살구빛 → 흙빛 점(로고 모션과 같은 결), 점은 천천히 숨 쉬듯
    //  - 원단 하나가 준비될 때마다 그 원단 색 조각이 하나씩 나타남. 다 되면 "3가지 원단을 골랐어요" → 0.6초 뒤 원단 화면
    //  - 최소 1.2초(같은 공간의 두 번째 칸부터는 0.8초), 최대 3초(넘으면 넘어가고 남은 사진은 뒤에서 계속 받음)
    const SEEK_MIN_MS = 1200, SEEK_MIN_NEXT_MS = 800, SEEK_MAX_MS = 3000, SEEK_DONE_MS = 600;
    function playFabricSeek(then) {
        const { showcaseList } = fabricShowcase();
        const second = state.currentItemIndex > 0;      // 같은 공간의 두 번째 칸(겉지 다음 속지 등)은 짧게
        const minMs = second ? SEEK_MIN_NEXT_MS : SEEK_MIN_MS;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const box = document.createElement('div');
        box.className = 'fab-seek';
        box.setAttribute('role', 'status');
        box.innerHTML = '<div class="fab-seek-in"><div class="fab-seek-light" aria-hidden="true"><i class="fab-seek-glow"></i><i class="fab-seek-dot"></i></div>'
            + '<p class="fab-seek-q font-serif-kr">공간에 맞는 원단을 찾고 있습니다</p>'
            + '<p class="fab-seek-sub">바닥·벽의 색과 들어오는 햇빛을 보고 있습니다</p>'
            + '<div class="fab-seek-found" aria-hidden="true">' + showcaseList.map(e => {
                const pick = colorDeckOrder(e.best)[0] || '';
                return `<i style="background: ${colorFillOf(e.f.id, pick)};"></i>`;
            }).join('') + '</div></div>';
        document.body.appendChild(box);
        const chips = box.querySelectorAll('.fab-seek-found i'), sub = box.querySelector('.fab-seek-sub');
        const t0 = Date.now();
        const all = Promise.all(showcaseList.map((e, i) => {
            const colors = colorDeckOrder(e.best);
            return Promise.all((colors.length ? colors : ['']).map(c => findPhoto(e.f.id, c)))
                .then(() => sleep(Math.max(0, (second ? 300 : 600) + i * 200 - (Date.now() - t0))))      // 한꺼번에 뜨지 않고 하나씩
                .then(() => chips[i].classList.add('on'));
        }));
        Promise.race([all, sleep(SEEK_MAX_MS)])
            .then(() => sleep(Math.max(0, minMs - (Date.now() - t0))))
            .then(() => {
                chips.forEach(c => c.classList.add('on'));
                sub.textContent = showcaseList.length ? `${showcaseList.length}가지 원단을 골랐습니다` : '원단을 골랐습니다';
                return sleep(SEEK_DONE_MS);
            })
            .then(() => {
                if (then) then();               // 원단 화면을 아래에 그린 뒤 이 화면을 서서히 걷음
                box.classList.add('is-out');
                setTimeout(() => box.remove(), 600);
            });
    }

    Object.assign(cz, { colorDeckOrder, fabricMiniSvg, refreshMini, colorFillOf, splitNameColor, fabricCardHtml, closeAllColors, bindColorDecks, roomWithTaste, fabricShowcase, findPhoto, forgetPhotos, swapFabricPanel, playFabricSeek });      // concierge.js가 부름
})();
