(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['fabrics.js']='20261191';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// fabrics.js — 직원 화면 › 원단: 원단 분류(톤·분위기) 편집·원단 색상 관리·되돌리기/중복 정리 버튼·원단 사진 확인·기기 사진 (130-2에서 app.js에서 떼어 냄)

// ==============================================================
// 원단 분류(톤·분위기) 편집 / 원단 사진 확인
// ==============================================================
function renderTagEditor() {
    const box = document.getElementById('tagRows');
    if (!box) return;
    const val = (id, def) => { const el = document.getElementById(id); return el && el.value ? el.value : def; };
    const cnt = document.getElementById('tagCount');
    if (cnt) cnt.textContent = `${FABRIC_DB.filter(isManualTagged).length}/${FABRIC_DB.length}`;

    const bookSel = document.getElementById('tagBook');
    if (bookSel) {
        const books = [...new Set(FABRIC_DB.map(f => f.book))];
        const cur = bookSel.value || 'ALL';
        const html = '<option value="ALL">전체 책자</option>' + books.map(b => `<option value="${b}">${b}</option>`).join('');
        if (bookSel.dataset.sig !== books.join('|')) { bookSel.innerHTML = html; bookSel.dataset.sig = books.join('|'); bookSel.value = books.includes(cur) ? cur : 'ALL'; }
    }
    const cat = val('tagCat', '속지'), book = val('tagBook', 'ALL'), st = val('tagState', 'ALL');
    const list = FABRIC_DB.filter(f => (cat === 'ALL' || f.categoryType === cat) && (book === 'ALL' || f.book === book) && (st !== 'UNSET' || !isManualTagged(f)));
    if (list.length === 0) { box.innerHTML = '<div class="py-6 text-center text-xs text-slate-400">조건에 맞는 원단이 없습니다.</div>'; return; }

    const tones = ['warm', 'cool', 'neutral', 'deep'];
    box.innerHTML = list.map(f => {
        const m = f.manual || {};
        const nColors = getFabricColors(f.id).length;
        const toneBtns = nColors ? `<span class="text-[11px] text-slate-500">톤은 색상별로 지정 (${nColors}개 색)</span>` : tones.map(t => {
            const isManual = m.tone && f.tone === t;
            const isGuess = !m.tone && f.tone === t;
            const cls = isManual ? 'bg-amber-800 text-white border-amber-900' : (isGuess ? 'bg-white text-slate-500 border-dashed border-slate-400' : 'bg-white text-slate-600 border-slate-300');
            return `<button onclick="setFabricTag('${f.id}','tone','${isManual ? '' : t}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${TONE_LABELS[t]}</button>`;
        }).join('');
        // 분위기는 질감·톤·비침으로 자동. 직접 고르면 그 값이 우선
        const autoMood = fabricMoodOf(Object.assign({}, f, { manual: Object.assign({}, m, { mood: false }) }));
        const guessLabel = nColors ? ' (색상별로 자동)' : ` (${MOOD_LABELS[autoMood] || '-'})`;
        const moodOpts = `<option value="">자동${guessLabel}</option>` + Object.keys(MOOD_LABELS).map(k => `<option value="${k}" ${m.mood && f.mood === k ? 'selected' : ''}>${MOOD_LABELS[k]} · ${MOOD_GUIDE[k]}</option>`).join('');
        const done = isManualTagged(f);
        const status = (nColors && !hasColorTones(f.id)) ? '<span class="text-[10px] font-bold text-amber-700">색상 톤 필요</span>' : done ? '<span class="text-[10px] font-bold text-emerald-700">✓ 분류 완료</span>' : ((m.tone || hasMoodInput(f)) ? '<span class="text-[10px] font-bold text-amber-700">일부만 지정</span>' : '<span class="text-[10px] text-slate-400">자동 추측</span>');
        const dens = DENSITY_ORDER.map(dv => {
            const on = m.density && f.density === dv;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : 'bg-white text-slate-600 border-slate-300';
            return `<button onclick="setFabricTag('${f.id}','density','${on ? '' : dv}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${DENSITY_LABELS[dv]}</button>`;
        }).join('');
        const texBtns = Object.keys(TEXTURE_LABELS).map(tv => {
            const on = f.texture === tv;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : 'bg-white text-slate-600 border-slate-300';
            return `<button title="${TEXTURE_HINTS[tv]}" onclick="setFabricTag('${f.id}','texture','${on ? '' : tv}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${TEXTURE_LABELS[tv]}</button>`;
        }).join('');
        // 소재 (94번): 정하지 않았으면 이름 후보를 점선으로. 이름에 "린넨"만 있으면 "확인 필요"(혼용률 보고 정함)
        const matGuess = f.material ? null : guessMaterial(f);
        const matBtns = Object.keys(MATERIAL_LABELS).map(mv => {
            const on = f.material === mv, guess = matGuess === mv;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : (guess ? 'bg-white text-slate-500 border-dashed border-slate-400' : 'bg-white text-slate-600 border-slate-300');
            return `<button onclick="setFabricTag('${f.id}','material','${on ? '' : mv}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${MATERIAL_LABELS[mv]}</button>`;
        }).join('') + (matGuess === 'check' ? '<span class="text-[10px] font-bold text-amber-700 ml-1" title="이름에 린넨이 있지만 실제로 폴리가 많아요. 책자 혼용률을 보고 정해 주세요">확인 필요</span>' : '');
        const densBlock = f.categoryType === '속지' ? `<span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5" title="낮에 한 겹을 창에 대고 안에서 밖을 보기: 풍경 또렷=많이 비침, 형태만 흐릿=은은한 비침, 밝기만=낮 가림, 빛만 은은=거의 안 비침">비침</span>${dens}` : '';
        // 겉지 암막 정도: 직접 지정하지 않으면 품명의 암막률로 추정(점선 표시). 방에서 "빛을 얼마나 가릴지" 추천에 사용
        const blGuess = blackoutLevel(Object.assign({}, f, { blackout: null }));
        const bls = BLACKOUT_ORDER.map(bv => {
            const on = m.blackout && f.blackout === bv;
            const guess = !m.blackout && blGuess === bv;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : (guess ? 'bg-white text-slate-500 border-dashed border-slate-400' : 'bg-white text-slate-600 border-slate-300');
            return `<button onclick="setFabricTag('${f.id}','blackout','${on ? '' : bv}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${BLACKOUT_LABELS[bv]}</button>`;
        }).join('');
        const blackBlock = f.categoryType === '겉지' ? `<span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5">암막</span>${bls}` : '';
        const hidden = isCustomerHidden(f);
        const hideNext = hidden ? (f.fabricOnly ? 'no' : '') : (f.fabricOnly ? '' : 'yes');
        const hideBtn = `<button onclick="setFabricTag('${f.id}','hide','${hideNext}')" title="고객 화면 추천에 보일지 정합니다 (직원 견적에는 항상 보임)" class="${hidden ? 'bg-slate-700 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300'} border rounded-lg px-2 py-1 text-[10px] font-bold whitespace-nowrap">${hidden ? '고객 추천 숨김' : '고객 추천 보임'}</button>`;
        const thumb = `<img class="w-10 h-10 rounded-lg object-cover bg-stone-100 flex-shrink-0" alt="" data-id="${f.id}" data-i="0" src="${fabricPhotoUrls(f.id)[0]}" onerror="photoFallback(this)">`;
        return `<div class="py-2.5 border-b border-slate-100">
            <div class="flex items-center gap-2.5">
                ${thumb}
                <div class="min-w-0 flex-1">
                    <div class="text-[10px] text-slate-400 truncate">[${f.book}] ${f.categoryType || ''}${f.categoryType === '블라인드' ? ` · 자동: ${blindKind(f) ? BLIND_KIND_LABELS[blindKind(f)] : '종류 모름(엑셀 다시 불러오기)'} · ${BLIND_LIGHT_LABELS[blindLight(f)]}` : ''}</div>
                    <div class="text-xs font-bold text-slate-800 truncate">${f.name}</div>
                </div>
                ${hideBtn}
                ${status}
            </div>
            <div class="flex flex-wrap items-center gap-1.5 mt-2">
                ${nColors ? '' : '<span class="text-[10px] font-bold text-slate-500 mr-0.5">톤</span>'}${toneBtns}
                <span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5">질감</span>${texBtns}
                ${f.categoryType === '블라인드' ? '' : `<span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5" title="질감(느낌)과 따로 정합니다">소재</span>${matBtns}`}
                <span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5" title="질감·톤·비침으로 자동으로 정해져요. 자동 결과가 원단 느낌과 다를 때만 직접 고르세요">분위기(선택)</span>
                <select onchange="setFabricTag('${f.id}','mood',this.value)" class="px-2 py-1.5 border rounded-lg text-xs font-semibold bg-white outline-none">${moodOpts}</select>
                ${densBlock}${blackBlock}
                ${(m.tone || m.mood || m.density || m.blackout || f.texture || f.material) ? `<button onclick="clearFabricTags('${f.id}')" class="text-[11px] text-rose-500 font-bold px-1.5">자동으로</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ---- 원단 색상 관리 ----
let __colorSel = '';
function renderColorEditor() {
    const cnt = document.getElementById('colorCount');
    if (cnt) cnt.textContent = `${Object.keys(colorsStore()).filter(id => FABRIC_DB.some(f => f.id === id)).length}개 원단`;
    const bookSel = document.getElementById('colorBook'), fabSel = document.getElementById('colorFab'), box = document.getElementById('colorEditor');
    if (!bookSel || !fabSel || !box) return;
    const curtains = FABRIC_DB;      // 블라인드도 커튼처럼 색상(번호)별 톤 지정
    const books = [...new Set(curtains.map(f => f.book))];
    if (bookSel.dataset.sig !== books.join('|')) { const cur = bookSel.value; bookSel.innerHTML = books.map(b => `<option value="${b}">${b}</option>`).join(''); bookSel.dataset.sig = books.join('|'); bookSel.value = books.includes(cur) ? cur : (books.includes('데미안') ? '데미안' : books[0]); }
    const list = curtains.filter(f => f.book === bookSel.value);
    const sig = bookSel.value + '|' + list.map(f => f.id + ':' + getFabricColors(f.id).length).join(',');
    if (fabSel.dataset.sig !== sig) {
        const cur = fabSel.value;
        fabSel.innerHTML = list.map(f => `<option value="${f.id}">${f.name} (${f.categoryType})${getFabricColors(f.id).length ? ' · 색 ' + getFabricColors(f.id).length + '개' : ''}</option>`).join('');
        fabSel.dataset.sig = sig;
        fabSel.value = list.some(f => f.id === cur) ? cur : (list[0] ? list[0].id : '');
    }
    __colorSel = fabSel.value;
    if (!__colorSel) { box.innerHTML = '<div class="text-xs text-slate-400 py-3">원단이 없습니다.</div>'; return; }
    const colors = getFabricColors(__colorSel);
    const tones = ['warm', 'cool', 'neutral', 'deep'];
    // 색 번호를 onclick 글자 안에 넣을 때 따옴표·역슬래시가 있어도 안 깨지게 (70번)
    const q = v => String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const rowsHtml = colors.length ? colors.map(cl => {
        const btns = tones.map(t => {
            const on = cl.tone === t;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : 'bg-white text-slate-600 border-slate-300';
            return `<button onclick="colorSetTone('${q(cl.name)}','${on ? '' : t}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${TONE_LABELS[t]}</button>`;
        }).join('');
        return `<div class="flex items-center gap-1.5 py-1.5 border-b border-slate-100">
            <span class="w-12 text-xs font-bold text-slate-800 flex-shrink-0">${cl.name}${/^\d+$/.test(cl.name) ? '번' : ''}</span>
            <input type="text" value="${(cl.label || '').replace(/"/g, '&quot;')}" placeholder="색 이름" maxlength="20" onchange="colorSetLabel('${q(cl.name)}', this.value)" class="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none flex-shrink-0">${btns}
            <button onclick="colorRemove('${q(cl.name)}')" class="ml-auto text-[11px] text-rose-500 font-bold px-2">삭제</button>
        </div>`;
    }).join('') : '<div class="text-xs text-slate-400 py-3">등록된 색상이 없습니다. 아래에서 번호 범위(예: 1~10)를 추가하세요.</div>';
    const unset = colors.filter(c => !c.tone).length;
    box.innerHTML = `<div class="text-[11px] text-slate-500 mb-1">${colors.length ? `색 ${colors.length}개 · 톤 미지정 ${unset}개` : ''}</div>${rowsHtml}`;
}
function colorAddRange() {
    const from = parseInt((document.getElementById('colorFrom') || {}).value, 10), to = parseInt((document.getElementById('colorTo') || {}).value, 10);
    if (!__colorSel || !from || !to || to < from || to - from > 200) { showToast('번호 범위를 확인해 주세요. (예: 1 ~ 10)', 'error'); return; }
    const names = []; for (let i = from; i <= to; i++) names.push(String(i));
    const n = addFabricColors(__colorSel, names);
    showToast(`색상 ${n}개를 추가했습니다.`);
    renderColorEditor(); renderTagEditor();
}
function colorAddName() {
    const el = document.getElementById('colorNewName');
    const n = addFabricColors(__colorSel, [el ? el.value : '']);
    if (el) el.value = '';
    if (!n) showToast('이름을 입력하거나, 이미 있는 색상입니다.', 'info');
    renderColorEditor(); renderTagEditor();
}
function colorBulkTone(tone) {
    const from = parseInt((document.getElementById('colorBulkFrom') || {}).value, 10), to = parseInt((document.getElementById('colorBulkTo') || {}).value, 10);
    if (!__colorSel || !from || !to || to < from) { showToast('시작·끝 번호를 확인해 주세요. (예: 1 ~ 8)', 'error'); return; }
    let n = 0;
    getFabricColors(__colorSel).forEach(cl => { if (/^\d+$/.test(cl.name)) { const v = parseInt(cl.name, 10); if (v >= from && v <= to) { setColorTone(__colorSel, cl.name, tone); n++; } } });
    showToast(n ? `${from}~${to}번 ${n}개 색을 "${TONE_LABELS[tone]}"으로 지정했습니다.` : '해당 번호의 색이 없습니다. 먼저 번호를 추가해 주세요.', n ? 'success' : 'info');
    renderColorEditor(); renderTagEditor();
}
function colorSetTone(name, tone) { setColorTone(__colorSel, name, tone); renderColorEditor(); renderTagEditor(); }
function colorSetLabel(name, label) { setColorLabel(__colorSel, name, label); renderColorEditor(); }
function colorRemove(name) { removeFabricColor(__colorSel, name); renderColorEditor(); renderTagEditor(); }
// ---- 불러오기 직전 되돌리기 버튼 (52번 - 다단계 스택 지원) ----
function renderUndoButton() {
    const btn = document.getElementById('undoImportBtn');
    if (!btn) return;
    try {
        const stack = (typeof loadUndoStack === 'function') ? loadUndoStack() : [];
        if (!stack || stack.length === 0) {
            btn.style.display = 'none';
            return;
        }
        const s = stack[stack.length - 1];
        const timeStr = s.savedAt ? new Date(s.savedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
        const countBadge = stack.length > 1 ? ` (${stack.length}단계)` : '';
        btn.innerHTML = `<i class="fa-solid fa-rotate-left text-[11px] text-rose-600"></i> 되돌리기: ${s.source || '직전 작업'} (${timeStr})${countBadge}`;
        btn.style.display = 'inline-flex';
    } catch (e) {
        btn.style.display = 'none';
    }
}

// ---- 중복 원단 정리 버튼: 예전 겹친 ID 원단이 있을 때만 개수와 함께 보임 (55번) ----
function renderDupCleanButton() {
    const btn = document.getElementById('dupCleanBtn');
    if (!btn) return;
    const n = (typeof findDuplicateFabrics === 'function') ? findDuplicateFabrics().length : 0;
    btn.innerHTML = `<i class="fa-solid fa-broom text-[11px] text-amber-700"></i> 중복 원단 정리 (${n}개)`;
    btn.style.display = n ? 'inline-flex' : 'none';
    // 삼보텍스·콤비 같은 블라인드 합치기: 합칠 짝이 있을 때만 (56번)
    const sb = document.getElementById('samboMergeBtn');
    if (!sb) return;
    const m = (typeof findSamboCombiPairs === 'function') ? findSamboCombiPairs().pairs.length : 0;
    sb.innerHTML = `<i class="fa-solid fa-object-group text-[11px] text-amber-700"></i> 삼보텍스·한글 이름 블라인드 합치기 (${m}쌍)`;
    sb.style.display = m ? 'inline-flex' : 'none';
    // "원단만 시킬때" 줄 빼기: 앱에 남아 있을 때만 (58번)
    const fo = document.getElementById('fabricOnlyBtn');
    if (!fo) return;
    const k = (typeof findFabricOnlyRows === 'function') ? findFabricOnlyRows() : { drop: [], keep: [] };
    const cnt = k.drop.length + k.keep.length;
    fo.innerHTML = `<i class="fa-solid fa-scissors text-[11px] text-amber-700"></i> "원단만 시킬때" 줄 빼기 (${cnt}개)`;
    fo.style.display = cnt ? 'inline-flex' : 'none';
}

function handleColorFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const finish = (rows) => {
        const res = importColorRows(rows);
        if (res.error) {
            showToast(res.error, 'error');
            return;
        }
        if (res.unlisted && res.unlisted.length > 0) {
            const sample = res.unlisted.slice(0, 4).join(', ');
            const more = res.unlisted.length > 4 ? ` 외 ${res.unlisted.length - 4}개` : '';
            showToast(
                `색상 ${res.colors}개 (원단 ${res.fabrics}개)를 불러왔습니다.\n` +
                `⚠️ 현재 원단 DB에 없는 품목 (${res.unlisted.length}개): ${sample}${more}\n` +
                `(원단 DB에 단가표를 등록하시면 자동으로 색상이 반영됩니다)`,
                'warning'
            );
        } else {
            showToast(`색상 ${res.colors}개 (원단 ${res.fabrics}개)를 정상적으로 불러왔습니다.`, 'success');
        }
        renderColorEditor();
        renderTagEditor();
        renderUndoButton();
    };
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') { showToast('엑셀 읽기 도구를 불러오지 못했습니다. CSV로 저장해 올려 주세요.', 'error'); event.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                finish(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }));
            } catch (err) { showToast('엑셀 파일을 읽지 못했습니다: ' + err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
    } else {
        Papa.parse(file, { header: false, skipEmptyLines: 'greedy', complete: r => finish(r.data), error: err => showToast('CSV 읽기 오류: ' + err.message, 'error') });
    }
    event.target.value = '';
}

// ---- 사진 ----
// 사진 확인 결과(있는 사진 주소 목록)는 기기에 저장 → 다음에 앱을 열면 원단 찾기에 바로 사진이 보임
//  원단 › 찾기가 처음 열릴 때 뒤에서 조용히 한 번 더 확인해 바뀐 것만 고침. 인터넷이 없으면 저장된 목록을 그대로 씀
let __photoFound = loadPhotoList();     // 원단ID(또는 원단ID__색상) → 찾은 사진 주소
let __photoChecked = false;             // 이번 실행에서 확인을 마쳤는지
let __photoScan = null;                 // 확인 중이면 그 Promise (두 번 돌지 않게)
function loadPhotoList() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEYS.photoList)); return (s && s.found && typeof s.found === 'object') ? s.found : {}; } catch (e) { return {}; }
}
function savePhotoList() {
    try { localStorage.setItem(STORE_KEYS.photoList, JSON.stringify({ ver: (window.REDAM_FILES || {})['app.js'] || '', date: new Date().toISOString().slice(0, 10), found: __photoFound })); } catch (e) {}
}
// 그 원단·색의 사진 주소 (색 사진이 없으면 원단 대표 사진, 없으면 ''). 기기에 넣은 사진이 먼저 (34번)
function photoFor(fabricId, color) {
    return (color && (DevicePhotos.urlOf(fabricId, color) || __photoFound[fabricId + '__' + color]))
        || DevicePhotos.urlOf(fabricId, '') || __photoFound[fabricId] || '';
}
// 고객 원단 화면(concierge.js)이 쓰는 같은 목록: 주소 / '' (이번 실행에서 확인했는데 없음) / undefined (모름 → 직접 찾음)
function knownPhotoFor(fabricId, color) {
    const u = photoFor(fabricId, color);
    return u || (__photoChecked ? '' : undefined);
}
// 사진 대상: 원단 대표 사진 + 색상별 사진
function photoTargets() {
    const list = [];
    FABRIC_DB.forEach(f => {
        list.push({ key: f.id, fabric: f, color: '', urls: repoPhotoUrls(f.id) });      // 저장소(photos/) 주소만 확인. 기기 사진은 따로 (DevicePhotos)
        getFabricColors(f.id).forEach(cl => list.push({ key: f.id + '__' + cl.name, fabric: f, color: cl.name, urls: repoPhotoUrls(f.id, cl.name).slice(0, 3) }));
    });
    return list;
}
// 사진이 실제로 있는지 하나씩 확인. 끝까지 확인했을 때만 목록을 바꾸고 저장 (중간에 인터넷이 끊기면 예전 목록 그대로)
function scanPhotos(onProgress) {
    if (__photoScan) return __photoScan;
    __photoScan = (async () => {
        const found = {};
        let done = 0, offline = false;
        const targets = photoTargets();
        const queue = targets.slice();
        async function worker() {
            while (queue.length && !offline) {
                const t = queue.shift();
                for (const url of t.urls) {
                    try {
                        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                        if (res.ok) { found[t.key] = url; break; }
                    } catch (e) { offline = true; break; }
                }
                done++;
                if (onProgress) onProgress(done, targets.length);
            }
        }
        await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
        if (!offline) { __photoFound = found; __photoChecked = true; savePhotoList(); }
        return { offline, total: targets.length };
    })().finally(() => { __photoScan = null; });
    return __photoScan;
}
async function checkPhotos() {
    const statusEl = document.getElementById('photoCount');
    const missEl = document.getElementById('photoMissing');
    if (statusEl) statusEl.textContent = '확인 중...';
    await DevicePhotos.ready;
    const r = await scanPhotos((done, total) => { if (statusEl && done % 10 === 0) statusEl.textContent = `확인 중... ${done}/${total}`; });
    // 인터넷이 없어도 기기 사진은 셀 수 있음 (저장소 사진은 지난번 확인 목록 그대로)
    if (r.offline) showToast('인터넷이 없어 photos/ 폴더는 지난번 확인 그대로예요. 기기 사진만 새로 셌어요.', 'info');
    refreshFinderPhotos();
    const targets = photoTargets();
    const has = t => !!(DevicePhotos.urlOf(t.fabric.id, t.color) || __photoFound[t.key]);
    const found = targets.filter(has).length;
    if (statusEl) statusEl.textContent = `${found} / ${targets.length}장`;
    if (missEl) {
        const miss = targets.filter(t => !has(t)).map(t => `${t.fabric.book} ${t.fabric.name}${colorSuffix(t.color, t.fabric.id)}`);
        missEl.textContent = miss.length ? `사진이 없는 커튼 원단 ${miss.length}개: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? ' …' : ''}` : '커튼 원단 사진이 모두 준비되었습니다.';
    }
}

// ---- 기기에 넣은 원단 사진 (34번) ----
// "사진 불러오기": 여러 장을 골라 파일 이름(원단ID__번호.jpg / 원단ID.jpg)으로 원단·색을 알아보고 기기 저장소에 넣음 (같은 이름이면 덮어씀)
async function importDevicePhotos(event) {
    const files = event.target.files;
    if (!files || !files.length) return;
    const statusEl = document.getElementById('devicePhotoStatus');
    const r = await DevicePhotos.importFiles(files, (done, total) => { if (statusEl) statusEl.textContent = `넣는 중... ${done}/${total}`; });
    event.target.value = '';
    forgetPhotoLookups();
    renderDevicePhotos();
    const out = document.getElementById('devicePhotoResult');
    if (out) {
        const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        out.innerHTML = `<b>${r.ok.length}장 넣음</b>` + (r.bad.length ? ` · 못 넣은 것 ${r.bad.length}장: ${r.bad.map(b => `${esc(b.name)}(${esc(b.why)})`).join(', ')}` : '');
    }
    showToast(r.bad.length ? `${r.ok.length}장 넣음, ${r.bad.length}장은 못 넣었어요` : `사진 ${r.ok.length}장을 기기에 넣었어요`, r.bad.length ? 'info' : undefined);
}
// 사진을 넣거나 지운 뒤: 원단 찾기·고객 화면이 기억해 둔 사진 주소를 잊고 다시 찾게
function forgetPhotoLookups() {
    if (window.concierge && window.concierge.forgetPhotos) window.concierge.forgetPhotos();
    refreshFinderPhotos();
}
// 기기 사진 표시: "기기에 있는 사진 ○장 · ○MB" + 원단별 목록(색 번호를 누르면 그 사진만 지움)
function renderDevicePhotos() {
    const statusEl = document.getElementById('devicePhotoStatus'), listEl = document.getElementById('devicePhotoList');
    const keys = DevicePhotos.keys();
    const mb = DevicePhotos.totalSize() / 1048576;
    if (statusEl) statusEl.textContent = keys.length ? `기기에 있는 사진 ${keys.length}장 · ${mb < 10 ? mb.toFixed(1) : Math.round(mb)}MB` : '기기에 넣은 사진이 아직 없어요';
    const clearBtn = document.getElementById('devicePhotoClear');
    if (clearBtn) clearBtn.hidden = !keys.length;
    if (!listEl) return;
    const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const groups = {}, scenes = { mood: [], feel: [], comp: [], blind: [], tex: [] };
    keys.forEach(k => {
        const sl = k.indexOf('/');
        if (sl > 0 && scenes[k.slice(0, sl)]) { scenes[k.slice(0, sl)].push(k); return; }      // 분위기·속지 느낌·창 구성·블라인드 종류 사진 (34·38번)
        const at = k.lastIndexOf('__'); const id = at > 0 ? k.slice(0, at) : k; (groups[id] = groups[id] || []).push({ key: k, color: at > 0 ? k.slice(at + 2) : '' });
    });
    const num = s => /^\d+$/.test(s) ? Number(s) : Infinity;
    const chip = (key, label) => `<button type="button" class="dev-photo-chip" title="이 사진 지우기" onclick="removeDevicePhoto('${esc(key)}')">${esc(label)}<i aria-hidden="true">×</i></button>`;
    const SCENE_LABEL = { mood: '분위기 사진', feel: '속지 느낌 사진', comp: '창 구성 사진', blind: '블라인드 종류 사진', tex: '겉지 결 사진' };
    const sceneRows = Object.keys(scenes).filter(k => scenes[k].length).map(k => {
        const order = SCENE_PHOTOS[k];
        const chips = scenes[k].sort((a, b) => order.indexOf(a.split('/')[1]) - order.indexOf(b.split('/')[1])).map(key => chip(key, key.split('/')[1])).join('');
        return `<div class="dev-photo-row"><span>${SCENE_LABEL[k]}</span><span class="dev-photo-chips">${chips}</span></div>`;
    }).join('');
    listEl.innerHTML = sceneRows + Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true })).map(id => {
        const f = FABRIC_DB.find(x => x.id === id);
        const name = f ? `${f.book || ''} ${f.name}`.trim() : id;
        const chips = groups[id].sort((a, b) => num(a.color) - num(b.color) || a.color.localeCompare(b.color)).map(e => chip(e.key, e.color ? e.color + '번' : '대표')).join('');
        return `<div class="dev-photo-row"><span>${esc(name)}</span><span class="dev-photo-chips">${chips}</span></div>`;
    }).join('');
}
async function removeDevicePhoto(key) {
    try { await DevicePhotos.remove(key); } catch (e) { showToast('지우지 못했어요: ' + e.message, 'error'); return; }
    forgetPhotoLookups();
    renderDevicePhotos();
}
async function clearDevicePhotos() {
    const n = DevicePhotos.keys().length;
    if (!n || !confirm(`기기에 넣은 원단 사진 ${n}장을 모두 지울까요?\n(PC·탭에 있는 사진 파일은 그대로예요. 다시 넣으려면 "사진 불러오기")`)) return;
    try { await DevicePhotos.clearAll(); } catch (e) { showToast('지우지 못했어요: ' + e.message, 'error'); return; }
    forgetPhotoLookups();
    renderDevicePhotos();
    const out = document.getElementById('devicePhotoResult');
    if (out) out.textContent = '';
    showToast('기기 사진을 모두 지웠어요');
}
DevicePhotos.ready.then(() => { renderDevicePhotos(); forgetPhotoLookups(); });

function downloadPhotoNameList() {
    const esc = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const checked = Object.keys(__photoFound).length > 0;
    const rows = [['책자', '구분', '품명', '사진 파일명', checked ? '사진 있음' : '(사진 확인하기를 누르면 표시됨)']];
    photoTargets().forEach(t => rows.push([t.fabric.book, t.fabric.categoryType || '', t.fabric.name + colorSuffix(t.color, t.fabric.id), t.color ? `${t.fabric.id}__${t.color}.jpg` : `${t.fabric.id}.jpg`, checked ? (__photoFound[t.key] ? 'O' : '') : '']));
    const csv = '\uFEFF' + rows.map(r => r.map(esc).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.download = '원단_사진_파일명_목록.csv';
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

async function precachePhotos() {
    if (!__photoChecked && navigator.onLine !== false) await checkPhotos();
    const urls = Object.values(__photoFound);
    if (urls.length === 0) { showToast('저장할 사진이 없습니다.', 'info'); return; }
    showToast(`사진 ${urls.length}장을 저장하는 중...`, 'info');
    let ok = 0;
    const queue = urls.slice();
    async function worker() { while (queue.length) { const u = queue.shift(); try { const r = await fetch(u); if (r.ok) ok++; } catch (e) {} } }
    await Promise.all([worker(), worker(), worker(), worker()]);
    showToast(`사진 ${ok}장을 오프라인용으로 저장했습니다.`);
}
