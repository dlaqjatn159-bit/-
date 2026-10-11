(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['app.js']='20261023';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// app.js — 화면 전환(고객 / 직원), 직원 PIN, 직원 화면(견적 입력)
// ==============================================================

// 오류 알림: 직원 모드에서는 자세한 내용을, 고객 모드에서는 조용히 기록만 합니다.
window.onerror = function(msg, url, lineNo) {
    console.error('[오류]', msg, url, lineNo);
    if (typeof appMode !== 'undefined' && appMode === 'staff') {
        const errorBox = document.createElement('div');
        errorBox.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:#b91c1c;color:#fff;padding:12px;border-radius:12px;font-size:12px;z-index:99999;word-break:break-all;';
        errorBox.textContent = `[오류] ${msg} (${url ? url.split('/').pop() : 'script'}:${lineNo})`;
        errorBox.onclick = () => errorBox.remove();
        document.body.appendChild(errorBox);
    }
    return false;
};

// ==============================================================
// 1. 시작 & 화면 전환
// ==============================================================
let appMode = 'customer';   // 'customer'(고객 화면) | 'staff'(직원 화면)

// 파일 버전 확인: GitHub에 올린 파일 중 예전 버전이 섞여 있으면 화면 맨 위에 알려 줍니다.
const REDAM_BUILD = '20261023';
function checkFileVersions() {
    const expected = ['pricing.js', 'costing.js', 'data.js', 'calculator.js', 'concierge.js', 'app.js'];
    const reg = window.REDAM_FILES || {};
    const old = expected.filter(f => reg[f] !== REDAM_BUILD);
    if (old.length === 0) return;
    const box = document.createElement('div');
    box.id = 'versionBanner';
    box.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:100000;background:#b91c1c;color:#fff;padding:14px 18px;font-size:15px;font-weight:700;line-height:1.5;text-align:center;';
    box.textContent = `일부 파일이 예전 버전입니다: ${old.join(', ')} — GitHub에 최신 파일을 모두 올렸는지 확인한 뒤 앱을 새로고침해 주세요. (화면을 누르면 닫힙니다)`;
    box.onclick = () => box.remove();
    document.body.appendChild(box);
}

window.onload = function() {
    checkFileVersions();
    loadFabricDb();
    loadPrivateStore();
    initDefaultRooms();
    calculateAll();
    document.body.dataset.mode = 'customer';
    switchMainTrack('curation');
    restoreDraftOnLoad();
    initTicketNoteInput();
    setInterval(saveDraftTick, 3000);
    updateOfflineStatus();
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', updateOfflineStatus);

    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }
};

// 두 화면만 존재: 'curation'(고객) / 'express'(직원)
function switchMainTrack(track) {
    currentMainTrack = track;
    const expressSec = document.getElementById('trackExpressSection');
    const curationSec = document.getElementById('trackCurationSection');

    if (expressSec) { expressSec.classList.add('hidden'); expressSec.style.display = 'none'; }
    if (curationSec) { curationSec.classList.add('hidden'); curationSec.style.display = 'none'; }

    if (track === 'express') {
        if (expressSec) { expressSec.classList.remove('hidden'); expressSec.style.display = 'block'; }
        const custVal = (document.getElementById('custName') ? document.getElementById('custName').value : "").trim();
        const expressCust = document.getElementById('expressCustName');
        if (expressCust) expressCust.value = custVal;
        const expressPhone = document.getElementById('expressCustPhone');
        if (expressPhone) expressPhone.value = ((document.getElementById('custPhone') || {}).value || '');
        renderRooms();
        renderDbTable();
        updatePrivateStatus();
        renderHistory();
        updateOfflineStatus();
        renderTagEditor();
        renderColorEditor();
    } else {
        if (curationSec) { curationSec.classList.remove('hidden'); curationSec.style.setProperty('display', 'block', 'important'); }
        if (window.concierge && typeof window.concierge.start === 'function' && !window.__conciergeStarted) {
            window.__conciergeStarted = true;
            window.concierge.start();
        }
    }
    calculateAll();
}

function enterStaffMode() {
    appMode = 'staff';
    document.body.dataset.mode = 'staff';
    if (window.concierge) window.concierge.syncToMaster();   // 고객이 구성한 내용을 직원 화면으로 가져옴
    Costing.state.enabled = Costing.hasData();
    switchMainTrack('express');
    startIdleWatch();
}

function exitStaffMode(toastMsg, goToProposal) {
    stopIdleWatch();
    appMode = 'customer';
    document.body.dataset.mode = 'customer';
    Costing.state.enabled = false;
    // 원가가 화면에 남지 않도록 정리
    const margin = document.getElementById('marginCollapsibleContent');
    if (margin) margin.classList.add('hidden');
    const outDoc = document.getElementById('outputDoc');
    if (outDoc) outDoc.value = '';
    renderDbTable();
    switchMainTrack('curation');          // 이 안에서 원가 없는 상태로 다시 계산됨
    // 직원 화면에서 바꾼 내용을 고객 화면에도 반영
    if (window.concierge) {
        if (goToProposal) window.concierge.showProposalFromRooms(rooms, globalInstallFee);
        else window.concierge.loadFromMaster(rooms, globalInstallFee);
    }
    if (toastMsg) showToast(toastMsg, 'info');
}

// 직원 화면에서 만든 견적을 고객에게 그대로 보여주기
function presentToCustomer() {
    exitStaffMode(null, true);
}

// 전화번호를 입력하는 대로 010-1234-5678 모양으로 맞춤 (숫자만 남기고 하이픈)
function formatPhone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.startsWith('02')) {                               // 서울 지역번호
        if (d.length <= 2) return d;
        if (d.length <= 5) return d.slice(0, 2) + '-' + d.slice(2);
        if (d.length <= 9) return d.slice(0, 2) + '-' + d.slice(2, d.length - 4) + '-' + d.slice(-4);
        return d.slice(0, 2) + '-' + d.slice(2, 6) + '-' + d.slice(6, 10);
    }
    if (d.length <= 3) return d;
    if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3);
    if (d.length <= 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
}

// 새 상담 시작: 이전 고객의 입력을 전부 비움
function startNewConsultation() {
    if (!confirm('현재 견적과 고객 입력을 모두 지우고 새 상담을 시작할까요?\n(지금 상담은 "상담 이력"에 보관됩니다)')) return;
    archiveConsultation(collectConsultation(), Date.now());
    clearDraft();
    initDefaultRooms();
    globalInstallFee = 30000;
    globalVatOption = 'consumer';
    const fee = document.getElementById('expressInstallFee'); if (fee) fee.value = globalInstallFee;
    const vat = document.getElementById('expressVatOption'); if (vat) vat.value = globalVatOption;
    if (window.concierge) window.concierge.resetAll();
    const expressCust = document.getElementById('expressCustName'); if (expressCust) expressCust.value = '';
    const expressPhone = document.getElementById('expressCustPhone'); if (expressPhone) expressPhone.value = '';
    renderRooms();
    calculateAll();
    renderHistory();
    showToast('새 상담을 시작합니다.');
}

// ==============================================================
// 2. 직원 PIN (로고 5번 연속 탭 → PIN 입력)
// ==============================================================
const RedamAuth = (function() {
    let taps = 0, tapTimer = null;
    let mode = 'verify';        // 'verify' | 'setup' | 'change'
    let fails = 0, lockedUntil = 0;

    function el(id) { return document.getElementById(id); }

    async function hashPin(pin, salt) {
        const text = `${salt}:${pin}`;
        if (window.crypto && window.crypto.subtle) {
            const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        let h = 5381;                                 // 보안 컨텍스트가 아닐 때의 대체 방식
        for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
        return 'f' + h.toString(16);
    }
    function loadStored() { try { return JSON.parse(localStorage.getItem(STORE_KEYS.pin)); } catch (e) { return null; } }

    function openModal(m) {
        mode = m;
        el('pinInput').value = ''; el('pinInput2').value = ''; el('pinError').textContent = '';
        const two = (m === 'setup' || m === 'change');
        el('pinInput2').style.display = two ? 'block' : 'none';
        el('pinTitle').textContent = m === 'verify' ? '직원 모드' : (m === 'setup' ? '직원 PIN 만들기' : 'PIN 변경');
        el('pinDesc').textContent = m === 'verify' ? 'PIN을 입력해 주세요.'
            : '숫자 4~8자리를 정하고 한 번 더 입력해 주세요. (분실하면 복구할 수 없으니 꼭 기억해 두세요)';
        el('pinInput').placeholder = two ? '새 PIN' : '••••';
        el('pinInput2').placeholder = '새 PIN 확인';
        el('pinModal').classList.remove('hidden');
        setTimeout(() => el('pinInput').focus(), 50);
    }
    function closeModal() { el('pinModal').classList.add('hidden'); el('pinInput').value = ''; el('pinInput2').value = ''; }

    return {
        // 로고를 2초 안에 5번 탭하면 PIN 창을 연다 (고객이 우연히 누르는 것을 방지)
        tap: function() {
            if (appMode === 'staff') return;
            taps++;
            clearTimeout(tapTimer);
            tapTimer = setTimeout(() => { taps = 0; }, 2000);
            if (taps >= 5) { taps = 0; this.requestStaff(); }
        },
        requestStaff: function() { openModal(loadStored() ? 'verify' : 'setup'); },
        changePin: function() { openModal('change'); },
        cancel: closeModal,
        submit: async function() {
            const pin = el('pinInput').value.trim();
            const err = el('pinError');
            if (mode === 'verify') {
                if (Date.now() < lockedUntil) { err.textContent = `잠시 후 다시 시도해 주세요. (${Math.ceil((lockedUntil - Date.now()) / 1000)}초)`; return; }
                const st = loadStored();
                if (st && (await hashPin(pin, st.salt)) === st.hash) {
                    fails = 0; closeModal(); enterStaffMode();
                } else {
                    fails++;
                    el('pinInput').value = '';
                    if (fails >= 5) { fails = 0; lockedUntil = Date.now() + 60000; err.textContent = '5회 틀렸습니다. 1분 뒤에 다시 시도해 주세요.'; }
                    else err.textContent = 'PIN이 맞지 않습니다.';
                }
            } else {
                const pin2 = el('pinInput2').value.trim();
                if (!/^\d{4,8}$/.test(pin)) { err.textContent = '숫자 4~8자리로 입력해 주세요.'; return; }
                if (pin !== pin2) { err.textContent = '두 번 입력한 PIN이 다릅니다.'; return; }
                const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
                localStorage.setItem(STORE_KEYS.pin, JSON.stringify({ salt, hash: await hashPin(pin, salt) }));
                const wasSetup = (mode === 'setup');
                closeModal();
                if (wasSetup) enterStaffMode(); else showToast('PIN을 변경했습니다.');
            }
        }
    };
})();
window.RedamAuth = RedamAuth;

// 일정 시간 조작이 없으면 자동으로 고객 화면으로 복귀
const IDLE_LIMIT_MS = 5 * 60 * 1000;
let idleTimer = null, lastActivity = Date.now();
function markActivity() { lastActivity = Date.now(); }
function startIdleWatch() {
    lastActivity = Date.now();
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, markActivity, true));
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
        if (appMode === 'staff' && Date.now() - lastActivity > IDLE_LIMIT_MS) exitStaffMode('자동으로 고객 화면으로 돌아왔습니다.');
    }, 10000);
}
function stopIdleWatch() {
    clearInterval(idleTimer);
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.removeEventListener(ev, markActivity, true));
}

// ==============================================================
// 작성 중 상담 자동 저장 / 상담 이력
//  - 3초마다 바뀐 내용만 저장합니다. (원가·계산 결과는 저장하지 않음)
//  - 다시 열었을 때 3시간 이내의 상담이면 자동 복구, 오래됐으면 "상담 이력"으로 옮겨
//    다음 고객에게 보이지 않게 합니다. 이력은 직원 모드(PIN)에서만 볼 수 있습니다.
// ==============================================================
const DRAFT_FRESH_MS = 3 * 60 * 60 * 1000;
const HISTORY_MAX = 30;
let __lastDraftJson = '';

function collectConsultation() {
    const src = (appMode === 'staff' || !window.concierge) ? rooms : window.concierge.getRoomsForSave();
    return {
        name: ((document.getElementById('custName') || {}).value || '').trim(),
        phone: ((document.getElementById('custPhone') || {}).value || '').trim(),
        rooms: src.map(r => ({
            name: r.name, sunlight: r.sunlight, lightLevel: r.lightLevel, floorTone: r.floorTone, wallTone: r.wallTone, mood: r.mood, wantMood: r.wantMood || null,
            roomType: r.roomType || null, lightBlock: r.lightBlock || null, diagnosed: !!r.diagnosed,
            curtains: r.curtains.map(c => { const copy = Object.assign({}, c); delete copy.calc; return copy; })
        })),
        installFee: globalInstallFee,
        vat: globalVatOption
    };
}

function estimateSnapshotTotal(snap) {
    let sum = 0;
    snap.rooms.forEach(r => r.curtains.forEach(c => {
        sum += Pricing.priceItem(c, Pricing.pickFabric(FABRIC_DB, c.fabricId)).curtainSubtotal;
    }));
    return Pricing.totals(sum, snap.installFee, snap.vat).finalPrice;
}

function saveDraftTick() {
    try {
        const snap = collectConsultation();
        if (snap.rooms.length === 0) {
            if (__lastDraftJson !== '') clearDraft();
            return;
        }
        const json = JSON.stringify(snap);
        if (json === __lastDraftJson) return;
        __lastDraftJson = json;
        localStorage.setItem(STORE_KEYS.draft, JSON.stringify(Object.assign({ updatedAt: Date.now() }, snap)));
    } catch (e) { console.warn('자동 저장 실패', e); }
}
function clearDraft() {
    __lastDraftJson = '';
    try { localStorage.removeItem(STORE_KEYS.draft); } catch (e) {}
}

function loadHistory() {
    try { const h = JSON.parse(localStorage.getItem(STORE_KEYS.history)); return Array.isArray(h) ? h : []; } catch (e) { return []; }
}
function saveHistory(list) {
    try { localStorage.setItem(STORE_KEYS.history, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (e) { console.warn('이력 저장 실패', e); }
}
function archiveConsultation(snap, updatedAt) {
    if (!snap || !snap.rooms || snap.rooms.length === 0) return;
    const list = loadHistory();
    list.unshift({ id: 'h' + Date.now() + Math.floor(Math.random() * 1000), updatedAt: updatedAt || Date.now(), name: snap.name || '', total: estimateSnapshotTotal(snap), snapshot: snap });
    saveHistory(list);
}

function applySnapshot(snap) {
    roomIdCounter = 1; curtainIdCounter = 100;
    rooms = snap.rooms.map(r => Object.assign({}, r, {
        id: roomIdCounter++,
        curtains: r.curtains.map(c => Object.assign({}, c, { id: curtainIdCounter++ }))
    }));
    globalInstallFee = snap.installFee;
    globalVatOption = snap.vat || 'consumer';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('custName', snap.name || ''); set('expressCustName', snap.name || '');
    set('custPhone', snap.phone || ''); set('expressCustPhone', snap.phone || '');
    set('expressInstallFee', globalInstallFee); set('expressVatOption', globalVatOption);
    calculateAll();
    if (window.concierge) window.concierge.loadFromMaster(rooms, globalInstallFee);
}

function restoreDraftOnLoad() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(STORE_KEYS.draft)); } catch (e) {}
    if (!d || !Array.isArray(d.rooms) || d.rooms.length === 0) return false;
    if (Date.now() - d.updatedAt > DRAFT_FRESH_MS) {
        archiveConsultation(d, d.updatedAt);       // 오래된 상담은 이력으로 옮기고 새로 시작
        clearDraft();
        return false;
    }
    applySnapshot(d);
    __lastDraftJson = JSON.stringify(collectConsultation());
    showToast('진행 중이던 상담을 복구했습니다.', 'info');
    return true;
}

function renderHistory() {
    const box = document.getElementById('historyList');
    if (!box) return;
    const list = loadHistory();
    const cnt = document.getElementById('historyCount'); if (cnt) cnt.textContent = list.length;
    if (list.length === 0) { box.innerHTML = '<div class="text-xs text-slate-400 py-3 text-center">저장된 상담이 없습니다.</div>'; return; }
    const pad = n => String(n).padStart(2, '0');
    box.innerHTML = list.map(h => {
        const d = new Date(h.updatedAt);
        const when = `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        const nm = ((h.name || '(이름 없음)') + (h.snapshot && h.snapshot.phone ? ' · ' + h.snapshot.phone : '')).replace(/</g, '&lt;');
        const nRooms = h.snapshot.rooms.length;
        return `<div class="flex items-center justify-between gap-2 py-2 border-b border-slate-100 text-xs">
            <div class="min-w-0">
                <div class="font-bold text-slate-800 truncate">${nm}</div>
                <div class="text-[11px] text-slate-400">${when} · 공간 ${nRooms}개 · ${(h.total || 0).toLocaleString()}원</div>
            </div>
            <div class="flex gap-1.5 flex-shrink-0">
                <button onclick="loadHistoryItem('${h.id}')" class="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap">불러오기</button>
                <button onclick="deleteHistoryItem('${h.id}')" class="text-rose-500 hover:bg-rose-50 font-bold px-2 py-1.5 rounded-lg">삭제</button>
            </div>
        </div>`;
    }).join('');
}

function loadHistoryItem(id) {
    const list = loadHistory();
    const item = list.find(h => h.id === id);
    if (!item) return;
    if (!confirm('이 상담을 불러옵니다. 지금 작성 중인 상담은 이력에 보관됩니다.\n(현재 단가표 기준으로 금액을 다시 계산합니다)')) return;
    archiveConsultation(collectConsultation(), Date.now());
    saveHistory(loadHistory().filter(h => h.id !== id));       // 불러온 상담은 "진행 중"이 되므로 이력에서 이동
    applySnapshot(item.snapshot);
    renderRooms();
    renderHistory();
    warnIfQuoteFabricsMissing();
    showToast('상담을 불러왔습니다. 현재 단가표 기준으로 다시 계산했습니다.', 'info');
}

function deleteHistoryItem(id) {
    if (!confirm('이 상담 기록을 삭제할까요?')) return;
    saveHistory(loadHistory().filter(h => h.id !== id));
    renderHistory();
}

// 오프라인 사용 준비 상태 표시
async function updateOfflineStatus() {
    const el = document.getElementById('offlineStatus');
    if (!el) return;
    try {
        if (!('serviceWorker' in navigator) || !window.caches) { el.textContent = '오프라인: 이 브라우저는 지원하지 않습니다'; return; }
        if (!navigator.serviceWorker.controller) { el.textContent = '오프라인: 준비 중 — 인터넷이 연결된 상태에서 앱을 한 번 더 열어 주세요'; el.style.color = '#b45309'; return; }
        const keys = (await (await caches.open('redam-app-v1')).keys()).map(r => r.url);
        const has = s => keys.some(u => u.includes(s));
        const ready = has('index.html') && has('tailwindcss.com') && has('font-awesome') && has('fonts.googleapis.com') && keys.some(u => /\.woff2?(\?|$)/.test(u));
        el.textContent = ready ? '오프라인: 사용 준비 완료 ✓' : '오프라인: 저장 중 — 인터넷이 연결된 상태에서 앱을 한 번 더 열어 주세요';
        el.style.color = ready ? '#15803d' : '#b45309';
    } catch (e) { el.textContent = ''; }
}

// ==============================================================
// 원단 분류(톤·분위기) 편집 / 원단 사진 확인
// ==============================================================
function toggleTagSection(forceOpen) {
    const content = document.getElementById('tagCollapsible');
    const chevron = document.getElementById('tagAccordionChevron');
    const statusText = document.getElementById('tagAccordionStatus');
    if (!content) return;
    const shouldOpen = forceOpen !== undefined ? forceOpen : content.classList.contains('hidden');
    content.classList.toggle('hidden', !shouldOpen);
    if (chevron) chevron.style.transform = shouldOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    if (statusText) statusText.textContent = shouldOpen ? '접기' : '펼치기';
    if (shouldOpen) renderTagEditor();
}

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
        const autoMood = moodOf(Object.assign({}, f, { manual: Object.assign({}, m, { mood: false }) }));
        const guessLabel = nColors ? ' (색상별로 자동)' : ` (${MOOD_LABELS[autoMood] || '-'})`;
        const moodOpts = `<option value="">자동${guessLabel}</option>` + Object.keys(MOOD_LABELS).map(k => `<option value="${k}" ${m.mood && f.mood === k ? 'selected' : ''}>${MOOD_LABELS[k]}</option>`).join('');
        const done = isManualTagged(f);
        const status = (nColors && !hasColorTones(f.id)) ? '<span class="text-[10px] font-bold text-amber-700">색상 톤 필요</span>' : done ? '<span class="text-[10px] font-bold text-emerald-700">✓ 분류 완료</span>' : ((m.tone || hasMoodInput(f)) ? '<span class="text-[10px] font-bold text-amber-700">일부만 지정</span>' : '<span class="text-[10px] text-slate-400">자동 추측</span>');
        const dens = ['light', 'medium', 'heavy'].map(dv => {
            const on = m.density && f.density === dv;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : 'bg-white text-slate-600 border-slate-300';
            return `<button onclick="setFabricTag('${f.id}','density','${on ? '' : dv}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${DENSITY_LABELS[dv]}</button>`;
        }).join('');
        const texBtns = Object.keys(TEXTURE_LABELS).map(tv => {
            const on = f.texture === tv;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : 'bg-white text-slate-600 border-slate-300';
            return `<button title="${TEXTURE_HINTS[tv]}" onclick="setFabricTag('${f.id}','texture','${on ? '' : tv}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${TEXTURE_LABELS[tv]}</button>`;
        }).join('');
        const densBlock = f.categoryType === '속지' ? `<span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5" title="원단 한 겹을 글씨 위에: 읽힘=많이 비침, 모양만=중간, 거의 안 보임=적게 비침">비침</span>${dens}` : '';
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
                <span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5">분위기</span>
                <select onchange="setFabricTag('${f.id}','mood',this.value)" class="px-2 py-1.5 border rounded-lg text-xs font-semibold bg-white outline-none">${moodOpts}</select>
                ${densBlock}${blackBlock}
                ${(m.tone || m.mood || m.density || m.blackout || f.texture) ? `<button onclick="clearFabricTags('${f.id}')" class="text-[11px] text-rose-500 font-bold px-1.5">자동으로</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ---- 원단 색상 관리 ----
let __colorSel = '';
function toggleColorSection(forceOpen) {
    const content = document.getElementById('colorCollapsible');
    const chevron = document.getElementById('colorAccordionChevron');
    const statusText = document.getElementById('colorAccordionStatus');
    if (!content) return;
    const shouldOpen = forceOpen !== undefined ? forceOpen : content.classList.contains('hidden');
    content.classList.toggle('hidden', !shouldOpen);
    if (chevron) chevron.style.transform = shouldOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    if (statusText) statusText.textContent = shouldOpen ? '접기' : '펼치기';
    if (shouldOpen) renderColorEditor();
}
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
    const rowsHtml = colors.length ? colors.map(cl => {
        const btns = tones.map(t => {
            const on = cl.tone === t;
            const cls = on ? 'bg-amber-800 text-white border-amber-900' : 'bg-white text-slate-600 border-slate-300';
            return `<button onclick="colorSetTone('${cl.name}','${on ? '' : t}')" class="${cls} border rounded-lg px-2.5 py-1.5 text-xs font-bold whitespace-nowrap">${TONE_LABELS[t]}</button>`;
        }).join('');
        return `<div class="flex items-center gap-1.5 py-1.5 border-b border-slate-100">
            <span class="w-12 text-xs font-bold text-slate-800 flex-shrink-0">${cl.name}${/^\d+$/.test(cl.name) ? '번' : ''}</span>
            <input type="text" value="${(cl.label || '').replace(/"/g, '&quot;')}" placeholder="색 이름" maxlength="20" onchange="colorSetLabel('${cl.name}', this.value)" class="w-24 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white outline-none flex-shrink-0">${btns}
            <button onclick="colorRemove('${cl.name}')" class="ml-auto text-[11px] text-rose-500 font-bold px-2">삭제</button>
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
function handleColorFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const finish = (rows) => {
        const res = importColorRows(rows);
        if (res.error) showToast(res.error, 'error');
        else { showToast(`색상 ${res.colors}개 (원단 ${res.fabrics}개)를 불러왔습니다.${res.unknown ? ` 찾지 못한 원단 ${res.unknown}줄은 건너뜀` : ''}`); renderColorEditor(); renderTagEditor(); }
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
let __photoFound = {};     // 원단ID(또는 원단ID__색상) → 찾은 사진 주소
// 사진 대상: 원단 대표 사진 + 색상별 사진
function photoTargets() {
    const list = [];
    FABRIC_DB.forEach(f => {
        list.push({ key: f.id, fabric: f, color: '', urls: fabricPhotoUrls(f.id) });
        getFabricColors(f.id).forEach(cl => list.push({ key: f.id + '__' + cl.name, fabric: f, color: cl.name, urls: fabricPhotoUrls(f.id, cl.name).slice(0, 3) }));
    });
    return list;
}
async function checkPhotos() {
    const statusEl = document.getElementById('photoCount');
    const missEl = document.getElementById('photoMissing');
    if (statusEl) statusEl.textContent = '확인 중...';
    __photoFound = {};
    const photoTargetsAtStart = null;
    let done = 0, offline = false;
    const targets = photoTargets();
    const queue = targets.slice();
    async function worker() {
        while (queue.length) {
            const t = queue.shift();
            for (const url of t.urls) {
                try {
                    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
                    if (res.ok) { __photoFound[t.key] = url; break; }
                } catch (e) { offline = true; break; }
            }
            done++;
            if (statusEl && done % 10 === 0) statusEl.textContent = `확인 중... ${done}/${targets.length}`;
        }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    if (offline) { if (statusEl) statusEl.textContent = '확인 실패'; showToast('인터넷에 연결된 상태에서 확인해 주세요.', 'error'); return; }
    const found = Object.keys(__photoFound).length;
    if (statusEl) statusEl.textContent = `${found} / ${targets.length}장`;
    if (missEl) {
        const miss = photoTargets().filter(t => !__photoFound[t.key]).map(t => `${t.fabric.book} ${t.fabric.name}${colorSuffix(t.color, t.fabric.id)}`);
        missEl.textContent = miss.length ? `사진이 없는 커튼 원단 ${miss.length}개: ${miss.slice(0, 12).join(', ')}${miss.length > 12 ? ' …' : ''}` : '커튼 원단 사진이 모두 준비되었습니다.';
    }
}

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
    if (Object.keys(__photoFound).length === 0) await checkPhotos();
    const urls = Object.values(__photoFound);
    if (urls.length === 0) { showToast('저장할 사진이 없습니다.', 'info'); return; }
    showToast(`사진 ${urls.length}장을 저장하는 중...`, 'info');
    let ok = 0;
    const queue = urls.slice();
    async function worker() { while (queue.length) { const u = queue.shift(); try { const r = await fetch(u); if (r.ok) ok++; } catch (e) {} } }
    await Promise.all([worker(), worker(), worker(), worker()]);
    showToast(`사진 ${ok}장을 오프라인용으로 저장했습니다.`);
}

// ==============================================================
// 3. 직원 화면: 데이터 관리 표시
// ==============================================================
function updatePrivateStatus() {
    const st = document.getElementById('privStatus');
    if (st) {
        st.textContent = Costing.hasData()
            ? `원가 데이터: 있음 (${Object.keys(Costing.state.costs).length}개 품목)`
            : '원가 데이터: 없음 → 아래 "비공개 팩 불러오기"를 먼저 해 주세요';
        st.style.color = Costing.hasData() ? '' : '#b91c1c';
    }
    const legacyBtn = document.getElementById('legacyPurgeBtn');
    if (legacyBtn) legacyBtn.style.display = hasLegacyData() ? '' : 'none';
}
function purgeLegacyDataConfirm() {
    if (!confirm('구버전 앱이 남긴 데이터(원가 포함)를 이 기기에서 삭제합니다. 계속할까요?')) return;
    purgeLegacyData();
    updatePrivateStatus();
    showToast('구버전 데이터를 삭제했습니다.');
}

function toggleMarginSection(forceOpen) {
    const content = document.getElementById('marginCollapsibleContent');
    const chevron = document.getElementById('marginAccordionChevron');
    const statusText = document.getElementById('marginAccordionStatus');
    const badge = document.getElementById('resMarginRateBadge');
    if (!content) return;

    const shouldOpen = forceOpen !== undefined ? forceOpen : content.classList.contains('hidden');
    if (shouldOpen) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        if (statusText) statusText.textContent = '접기';
        if (badge) badge.classList.remove('hidden');
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        if (statusText) statusText.textContent = '펼치기';
        if (badge) badge.classList.add('hidden');
    }
}

function syncCustomerData() {
    calculateAll();
    const custName = (document.getElementById('custName') ? document.getElementById('custName').value : "").trim();
    const expressCust = document.getElementById('expressCustName');

    if (expressCust && expressCust.value !== custName) expressCust.value = custName;
}

function updateGlobalInstallFee(val) {
    globalInstallFee = parseFloat(val) || 0;
    const expEl = document.getElementById('expressInstallFee');
    if (expEl && expEl.value != globalInstallFee) expEl.value = globalInstallFee;
    calculateAll();
}

function updateGlobalVatOption(val) {
    globalVatOption = val;
    const expEl = document.getElementById('expressVatOption');
    if (expEl && expEl.value !== globalVatOption) expEl.value = globalVatOption;
    calculateAll();
}

// ==============================================================
// 2. ROOM & CURTAIN MANAGEMENT
// ==============================================================
const PRESET_LABEL_MAP = {
    sheer: "속지",
    drape: "겉지",
    blind: "블라인드",
    panel: "패널 커튼",
    "": "품목 미지정"
};

function getNextCurtainLabel(room, presetType) {
    const baseName = PRESET_LABEL_MAP[presetType] || "품목";
    if (!presetType) return "품목 미지정";
    
    const sameItems = room.curtains.filter(c => c.label.startsWith(baseName));
    if (sameItems.length === 0) {
        return baseName;
    }
    return `${baseName} ${sameItems.length + 1}`;
}

function nextRoomName() {
    const used = new Set(rooms.map(r => r.name));
    if (!used.has('거실')) return '거실';
    // 번호는 항상 "가장 큰 번호 + 1" (지운 번호를 다시 쓰지 않아 목록 순서가 뒤섞이지 않음)
    let max = 0;
    rooms.forEach(r => { const m = /^작은방 (\d+)$/.exec(r.name); if (m) max = Math.max(max, parseInt(m[1], 10)); });
    return `작은방 ${max + 1}`;
}

function addRoom() {
    const defFab = FABRIC_DB[0] ? FABRIC_DB[0].id : "DAM_WIDE_01";
    const newRoom = {
        id: roomIdCounter++,
        name: nextRoomName(),
        sunlight: "east",
        lightLevel: "mid",
        floorTone: "warm",
        wallTone: "cool",
        mood: "soft_warm",
        curtains: [
            { id: curtainIdCounter++, label: "속지", presetType: "sheer", width: 200, height: 200, pleat: "2.0", pleatType: "나비주름", bookFilter: "ALL", fabricId: defFab, installType: "rail", floorGap: 0, hwName: "기본 레일", hwPrice: 1000, shapeFee: 0, leadBand: true, hotelFit: false }
        ]
    };
    rooms.push(newRoom);
    renderRooms();
    calculateAll();
    showToast(`[${newRoom.name}] 공간이 추가되었습니다.`);
}

function removeRoom(roomId) {
    rooms = rooms.filter(r => r.id !== roomId);
    renderRooms();
    calculateAll();
    showToast("공간이 삭제되었습니다.");
}

function toggleHotelFit(roomId, curtainId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const c = room.curtains.find(item => item.id === curtainId);
    if (!c) return;

    const fab = FABRIC_DB.find(f => f.id === c.fabricId);
    if (fab && fab.calcType === "hebe") {
        c.hotelFit = false;
        return;
    }

    c.hotelFit = !c.hotelFit;
    renderRooms();
    calculateAll();
}

function addCurtainToRoom(roomId, presetType = "") {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    let targetFabId = FABRIC_DB[0] ? FABRIC_DB[0].id : "DAM_WIDE_01";
    let shapeFee = 0;
    let leadBand = false;
    let pleat = "2.0";
    let pleatType = "나비주름";
    let installType = "rail";
    let hwName = "기본 레일";
    let hwPrice = 1000;
    let appliedPreset = presetType;
    let newLabel = getNextCurtainLabel(room, presetType);

    if (presetType === "sheer") {
        const sheerFab = FABRIC_DB.find(f => f.categoryType === "속지");
        if (sheerFab) targetFabId = sheerFab.id;
        leadBand = true;
    } else if (presetType === "drape") {
        const drapeFab = FABRIC_DB.find(f => f.categoryType === "겉지");
        if (drapeFab) targetFabId = drapeFab.id;
        shapeFee = 3000;
    } else if (presetType === "blind") {
        const blindFab = FABRIC_DB.find(f => f.categoryType === "블라인드");
        if (blindFab) targetFabId = blindFab.id;
    } else if (presetType === "panel") {
        const panelFab = FABRIC_DB.find(f => f.categoryType === "겉지") || FABRIC_DB[0];
        if (panelFab) targetFabId = panelFab.id;
        pleat = "panel";
        pleatType = "패널";
        c.installType = "rail_2line";
        c.hwName = "2줄 패널 레일";
        c.hwPrice = 17000;
    }

    const refW = room.curtains[0] ? room.curtains[0].width : 250;
    const refH = room.curtains[0] ? room.curtains[0].height : 230;

    room.curtains.push({
        id: curtainIdCounter++,
        label: newLabel,
        presetType: appliedPreset,
        width: refW,
        height: refH,
        pleat: pleat,
        pleatType: pleatType,
        bookFilter: "ALL",
        fabricId: targetFabId,
        installType: installType,
        floorGap: 0,
        hwName: hwName,
        hwPrice: hwPrice,
        shapeFee: shapeFee,
        leadBand: leadBand,
        hotelFit: false
    });

    renderRooms();
    calculateAll();
    showToast(`[${room.name}]에 '${newLabel}' 품목이 추가되었습니다.`);
}

function removeCurtainFromRoom(roomId, curtainId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.curtains.length <= 1) {
        showToast("공간 당 최소 1개 품목이 필요합니다.", "info");
        return;
    }
    room.curtains = room.curtains.filter(c => c.id !== curtainId);
    renderRooms();
    calculateAll();
}

function updateRoomName(roomId, name) {
    const room = rooms.find(r => r.id === roomId);
    if (room) {
        room.name = name;
        calculateAll();
    }
}

function updateCurtainData(roomId, curtainId, key, val) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const c = room.curtains.find(item => item.id === curtainId);
    if (!c) return;

    const prevFabricId = c.fabricId;
    c[key] = val;

    if (key === 'bookFilter') {
        if (val !== 'ALL') {
            const match = FABRIC_DB.find(f => f.book === val && f.id === c.fabricId);
            if (!match) {
                const firstInBook = FABRIC_DB.find(f => f.book === val);
                if (firstInBook) {
                    c.fabricId = firstInBook.id;
                    if (firstInBook.calcType === 'hebe') c.hotelFit = false;
                }
            }
        }
        renderRooms();
    } else if (key === 'fabricId') {
        const selFab = FABRIC_DB.find(f => f.id === val);
        if (selFab) {
            if (selFab.calcType === 'hebe') {
                c.hotelFit = false;
            }
            if (c.bookFilter !== 'ALL' && selFab.book !== c.bookFilter) {
                c.bookFilter = selFab.book;
            }
        }
        renderRooms();
    } else if (key === 'installType') {
        if (val === 'rod35') {
            c.hwName = "35파이 봉";
            c.hwPrice = 2000;
        } else if (val === 'rod25') {
            c.hwName = "25파이 봉";
            c.hwPrice = 1500;
        } else if (val === 'rail_2line') {
            c.hwName = "2줄 패널 레일";
            c.hwPrice = 17000;
        } else if (val === 'rail_3line') {
            c.hwName = "3줄 패널 레일";
            c.hwPrice = 20000;
        } else {
            c.hwName = "기본 레일";
            c.hwPrice = 1000;
        }
        renderRooms();
    }
    if (c.fabricId !== prevFabricId) c.colorName = '';
    calculateAll();
}

function changeCurtainCategoryPreset(roomId, curtainId, preset) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const c = room.curtains.find(item => item.id === curtainId);
    if (!c) return;

    c.presetType = preset;
    c.label = getNextCurtainLabel(room, preset);

    if (preset === 'sheer') {
        const f = FABRIC_DB.find(item => item.categoryType === '속지') || FABRIC_DB[0];
        if (f) c.fabricId = f.id;
        c.pleat = "2.0";
        c.pleatType = "나비주름";
        c.installType = "rail";
        c.hwName = "기본 레일";
        c.hwPrice = 1000;
        c.leadBand = true;
        c.shapeFee = 0;
        c.hotelFit = false;
    } else if (preset === 'drape') {
        const f = FABRIC_DB.find(item => item.categoryType === '겉지') || FABRIC_DB[0];
        if (f) c.fabricId = f.id;
        c.pleat = "2.0";
        c.pleatType = "나비주름";
        c.installType = "rail";
        c.hwName = "기본 레일";
        c.hwPrice = 1000;
        c.shapeFee = 3000;
        c.leadBand = false;
        c.hotelFit = false;
    } else if (preset === 'blind') {
        const f = FABRIC_DB.find(item => item.categoryType === '블라인드') || FABRIC_DB[0];
        if (f) c.fabricId = f.id;
        c.shapeFee = 0;
        c.leadBand = false;
        c.hotelFit = false;
    } else if (preset === 'panel') {
        const f = FABRIC_DB.find(item => item.categoryType === '겉지') || FABRIC_DB[0];
        if (f) c.fabricId = f.id;
        c.pleat = "panel";
        c.pleatType = "패널";
        c.installType = "rail_2line";
        c.hwName = "2줄 패널 레일";
        c.hwPrice = 17000;
        c.shapeFee = 0;
        c.leadBand = false;
        c.hotelFit = false;
    }

    renderRooms();
    calculateAll();
}

function renderRooms() {
    const container = document.getElementById('roomsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (rooms.length === 0) {
        container.innerHTML = `<div class="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center text-sm text-slate-500">
            등록된 공간이 없습니다. 오른쪽 위 <strong class="text-amber-800">공간 추가</strong>를 눌러 시작하세요.
        </div>`;
        return;
    }

    const books = [...new Set(FABRIC_DB.map(f => f.book))];

    rooms.forEach((room, roomIndex) => {
        const roomCard = document.createElement('div');
        roomCard.className = "bg-white rounded-2xl p-3.5 sm:p-5 md:p-6 shadow-sm border border-slate-200 space-y-3 sm:space-y-4 relative w-full min-w-0";

        let curtainsHtml = "";
        room.curtains.forEach((c, curtainIndex) => {
            const filteredFabrics = c.bookFilter === "ALL" ? FABRIC_DB : FABRIC_DB.filter(f => f.book === c.bookFilter);
            let fabricOptionsHtml = "";

            if (filteredFabrics.length === 0) {
                fabricOptionsHtml = `<option value="">제품 없음</option>`;
            } else {
                const groupBooks = [...new Set(filteredFabrics.map(f => f.book))];
                groupBooks.forEach(b => {
                    fabricOptionsHtml += `<optgroup label="${b}">`;
                    filteredFabrics.filter(f => f.book === b).forEach(f => {
                        const selected = (f.id === c.fabricId) ? "selected" : "";
                        let badgeDesc = f.calcType === "hebe" ? "헤베" : (f.calcType === "width" ? `폭당 ${f.specCm}cm` : `Y당 ${f.specCm}cm`);
                        fabricOptionsHtml += `<option value="${f.id}" ${selected}>[${badgeDesc}] ${f.name} - ${(f.price||0).toLocaleString()}원/${f.unit}</option>`;
                    });
                    fabricOptionsHtml += `</optgroup>`;
                });
            }

            let curFab = FABRIC_DB.find(f => f.id === c.fabricId);
            if (!curFab && FABRIC_DB.length > 0) {
                curFab = FABRIC_DB[0];
                c.fabricId = curFab.id;
            }
            const isBlind = curFab && curFab.calcType === "hebe";
            const fabColors = curFab ? getFabricColors(curFab.id) : [];
            const colorSelect = fabColors.length ? `<div class="mt-1.5"><label class="block text-[10px] font-bold ${c.colorName ? 'text-slate-500' : 'text-rose-600'} mb-0.5">색상 번호 ${c.colorName ? '' : '(선택 필요)'}</label><select onchange="updateCurtainData(${room.id}, ${c.id}, 'colorName', this.value)" class="w-full px-2 py-1 border ${c.colorName ? 'border-slate-300' : 'border-rose-400'} rounded-lg text-xs font-semibold text-indigo-950 bg-white outline-none min-w-0"><option value="">(색상 선택)</option>${fabColors.map(cl => `<option value="${cl.name}" ${c.colorName === cl.name ? 'selected' : ''}>${cl.name}${/^\d+$/.test(cl.name) ? '번' : ''}${cl.label ? ' · ' + cl.label : ''}${cl.tone ? ' · ' + TONE_LABELS[cl.tone] : ''}</option>`).join('')}</select></div>` : '';

            let deduction = 3;
            if (c.installType === 'rod35') deduction = 10;
            else if (c.installType === 'rod25') deduction = 9;

            const floorGapVal = parseFloat(c.floorGap) || 0;
            const actualCurtainHeight = isBlind ? c.height : Math.max(0, (c.height || 0) - deduction + floorGapVal);

            curtainsHtml += `
                <div class="bg-slate-50/80 rounded-xl p-3 sm:p-4 border border-slate-200 space-y-2.5 sm:space-y-3 relative w-full min-w-0">
                    <div class="flex justify-between items-center border-b border-slate-200/80 pb-2 gap-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span class="w-5 h-5 rounded-full bg-indigo-900 text-amber-200 text-[10px] flex items-center justify-center font-bold flex-shrink-0">${curtainIndex + 1}</span>
                            <input type="text" value="${c.label}" onchange="updateCurtainData(${room.id}, ${c.id}, 'label', this.value)" class="font-bold text-slate-800 text-xs outline-none bg-transparent hover:bg-white focus:bg-white border-b border-transparent focus:border-amber-400 px-1 w-full min-w-0">
                        </div>
                        ${room.curtains.length > 1 ? `
                            <button onclick="removeCurtainFromRoom(${room.id},${c.id})" class="whitespace-nowrap flex-shrink-0 text-[11px] text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded hover:bg-rose-50 transition flex items-center gap-1">
                                삭제
                            </button>
                        ` : ''}
                    </div>

                    <div class="grid grid-cols-3 gap-1.5 sm:gap-2 items-end">
                        <div class="min-w-0 flex flex-col justify-end">
                            <label class="block text-[10px] font-bold text-slate-500 mb-1 truncate">실측 가로 (cm)</label>
                            <input type="number" value="${c.width}" oninput="updateCurtainData(${room.id}, ${c.id}, 'width', parseFloat(this.value)||0)" class="w-full h-8 px-2 py-1 border rounded-lg text-xs font-bold text-indigo-950 bg-white outline-none focus:ring-1 focus:ring-amber-500 min-w-0 box-border">
                        </div>
                        <div class="min-w-0 flex flex-col justify-end">
                            <div class="flex justify-between items-center mb-1 gap-0.5">
                                <label class="block text-[10px] font-bold text-slate-500 truncate">세로(cm)</label>
                                ${!isBlind ? `<span class="text-[9px] text-amber-900 font-extrabold bg-amber-100 border border-amber-300 px-1 rounded flex-shrink-0 leading-tight">제작:${actualCurtainHeight}</span>` : ''}
                            </div>
                            <input type="number" value="${c.height}" oninput="updateCurtainData(${room.id}, ${c.id}, 'height', parseFloat(this.value)||0)" class="w-full h-8 px-2 py-1 border rounded-lg text-xs font-bold text-indigo-950 bg-white outline-none focus:ring-1 focus:ring-amber-500 min-w-0 box-border">
                        </div>
                        <div class="min-w-0 flex flex-col justify-end">
                            ${isBlind ? `
                                <label class="block text-[10px] font-bold text-amber-800 mb-1 truncate">적용 면적</label>
                                <div class="w-full h-8 px-1.5 py-1 border border-amber-300 rounded-lg text-[11px] font-bold bg-amber-100/80 text-amber-900 text-center flex items-center justify-center truncate box-border">
                                    최저 2.0헤베
                                </div>
                            ` : `
                                <label class="block text-[10px] font-bold text-slate-500 mb-1 truncate">주름 방식</label>
                                <select onchange="updateCurtainData(${room.id},${c.id}, 'pleat', this.value)" class="w-full h-8 px-1 py-1 border rounded-lg text-xs font-semibold bg-white outline-none min-w-0 box-border">
                                    <option value="2.0" ${c.pleat==="2.0"?"selected":""}>2.0배 나비</option>
                                    <option value="1.5" ${c.pleat==="1.5"?"selected":""}>1.5배 평주름</option>
                                    <option value="2.5" ${c.pleat==="2.5"?"selected":""}>2.5배 나비</option>
                                    <option value="1.0" ${c.pleat==="1.0"?"selected":""}>1.0배 민자</option>
                                    <option value="panel" ${c.pleat==="panel"?"selected":""}>패널 제작</option>
                                </select>
                            `}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 bg-amber-50/40 p-2 rounded-lg border border-amber-100 ${isBlind ? 'hidden' : ''}">
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-indigo-950 mb-0.5 truncate">가공 형태</label>
                            <select onchange="updateCurtainData(${room.id}, ${c.id}, 'pleatType', this.value)" class="w-full px-2 py-1 border border-amber-200 rounded-lg text-xs font-bold text-indigo-900 bg-white outline-none">
                                <option value="나비주름" ${c.pleatType==="나비주름"||!c.pleatType?"selected":""}>나비주름</option>
                                <option value="평주름" ${c.pleatType==="평주름"?"selected":""}>평주름</option>
                                <option value="민자" ${c.pleatType==="민자"?"selected":""}>민자</option>
                                <option value="패널" ${c.pleatType==="패널"||c.pleatType==="판넬"||c.pleat==="panel"?"selected":""}>패널 제작</option>
                            </select>
                        </div>
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-indigo-950 mb-0.5 truncate">설치 기구</label>
                            <select onchange="updateCurtainData(${room.id}, ${c.id}, 'installType', this.value)" class="w-full px-2 py-1 border border-amber-200 rounded-lg text-xs font-bold text-indigo-900 bg-white outline-none">
                                <option value="rail" ${c.installType==='rail'?'selected':''}>기본 레일</option>
                                <option value="rail_2line" ${c.installType==='rail_2line'?'selected':''}>패널 레일 (2줄)</option>
                                <option value="rail_3line" ${c.installType==='rail_3line'?'selected':''}>패널 레일 (3줄)</option>
                                <option value="rod35" ${c.installType==='rod35'?'selected':''}>35파이 봉</option>
                                <option value="rod25" ${c.installType==='rod25'?'selected':''}>25파이 봉</option>
                            </select>
                        </div>
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-indigo-950 mb-0.5 truncate">바닥 간격 (cm)</label>
                            <input type="number" step="0.5" value="${c.floorGap ?? 0}" oninput="updateCurtainData(${room.id}, ${c.id}, 'floorGap', parseFloat(this.value)||0)" class="w-full px-2 py-1 border border-amber-200 rounded-lg text-xs font-black text-indigo-900 bg-white outline-none">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5">책자 필터</label>
                            <select onchange="updateCurtainData(${room.id}, ${c.id}, 'bookFilter', this.value)" class="w-full px-2 py-1 border rounded-lg text-xs font-semibold bg-white outline-none min-w-0">
                                <option value="ALL">전체 책자</option>
                                ${books.map(b => `<option value="${b}" ${c.bookFilter===b?'selected':''}>${b}</option>`).join('')}
                            </select>
                        </div>
                        <div class="sm:col-span-2 min-w-0">
                            <div class="flex justify-between items-center mb-0.5">
                                <label class="block text-[10px] font-bold text-slate-500">제품 / 원단 선택</label>
                                <span class="text-[9px] text-amber-900 font-extrabold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 flex-shrink-0">
                                    ${curFab ? (isBlind ? "블라인드" : (curFab.calcType === "width" ? `폭당 ${curFab.specCm}cm` : `Y당 ${curFab.specCm}cm`)) : ""}
                                </span>
                            </div>
                            <select onchange="updateCurtainData(${room.id}, ${c.id}, 'fabricId', this.value)" class="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold text-indigo-950 bg-white outline-none min-w-0">
                                ${fabricOptionsHtml}
                            </select>
                            ${colorSelect}
                        </div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 pt-1 border-t border-slate-200/60 ${isBlind ? 'opacity-50 pointer-events-none' : ''}">
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5 truncate">부자재 품명</label>
                            <input type="text" value="${isBlind ? '미사용' : c.hwName}" ${isBlind ? 'disabled' : ''} oninput="updateCurtainData(${room.id}, ${c.id}, 'hwName', this.value)" class="w-full px-1.5 sm:px-2 py-1 border rounded-lg text-xs outline-none min-w-0 bg-white">
                        </div>
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5 truncate">자당 단가</label>
                            <input type="number" value="${isBlind ? 0 : c.hwPrice}" step="100" ${isBlind ? 'disabled' : ''} oninput="updateCurtainData(${room.id}, ${c.id}, 'hwPrice', parseFloat(this.value)||0)" class="w-full px-1.5 sm:px-2 py-1 border rounded-lg text-xs font-bold outline-none min-w-0 bg-white">
                        </div>
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-slate-500 mb-0.5 truncate">형상기억 가공</label>
                            <select ${isBlind ? 'disabled' : ''} onchange="updateCurtainData(${room.id}, ${c.id}, 'shapeFee', parseFloat(this.value))" class="w-full px-1 py-1 border rounded-lg text-xs font-semibold outline-none min-w-0 bg-white">
                                <option value="3000" ${!isBlind && c.shapeFee===3000?"selected":""}>적용</option>
                                <option value="0" ${isBlind || c.shapeFee===0?"selected":""}>미적용</option>
                            </select>
                        </div>
                        <div class="min-w-0">
                            <label class="block text-[10px] font-bold text-amber-800 mb-0.5 truncate">하단 리드밴드</label>
                            <select ${isBlind ? 'disabled' : ''} onchange="updateCurtainData(${room.id}, ${c.id}, 'leadBand', this.value === 'true')" class="w-full px-1 py-1 border border-amber-300 rounded-lg text-xs font-semibold bg-amber-50/50 outline-none min-w-0">
                                <option value="false" ${!c.leadBand ? 'selected' : ''}>미적용</option>
                                <option value="true" ${c.leadBand ? 'selected' : ''}>적용</option>
                            </select>
                        </div>
                        <div class="min-w-0 col-span-2 sm:col-span-1">
                            <label class="block text-[10px] font-bold text-amber-800 mb-0.5 truncate">호텔 핏</label>
                            <button type="button" ${isBlind ? 'disabled' : ''} onclick="toggleHotelFit(${room.id}, ${c.id})" class="w-full py-1 border rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${c.hotelFit ? 'bg-amber-700 text-white border-amber-800 shadow-sm' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'}">
                                <span class="w-3 text-center ${c.hotelFit ? 'font-black text-amber-200' : 'text-slate-400'}">${c.hotelFit ? '✓' : '+'}</span>
                                <span>호텔핏</span>
                            </button>
                        </div>
                    </div>

                    <div class="flex items-center justify-between text-xs pt-2 text-slate-600 border-t border-slate-200/70 gap-2">
                        <div class="text-[11px] sm:text-xs truncate flex-1 min-w-0 text-slate-600">
                            산출수량: <strong class="text-indigo-950 font-bold" id="curtainQty_${c.id}">-</strong>
                        </div>
                        <div class="whitespace-nowrap flex-shrink-0 text-right">
                            <span class="text-[11px] text-slate-500">판매가:</span>
                            <strong class="text-amber-800 font-black text-xs sm:text-sm font-mono ml-0.5" id="curtainSub_${c.id}">0원</strong>
                        </div>
                    </div>
                </div>
            `;
        });

        roomCard.innerHTML = `
            <div class="flex items-center justify-between gap-2 border-b pb-3">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-900 text-xs flex items-center justify-center font-bold flex-shrink-0">${roomIndex + 1}</span>
                    <input type="text" value="${room.name}" onchange="updateRoomName(${room.id}, this.value)" class="font-bold text-slate-800 text-sm sm:text-base outline-none hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-amber-500 rounded px-1.5 py-0.5 w-full min-w-0">
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button onclick="addCurtainToRoom(${room.id})" class="whitespace-nowrap bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold px-2.5 py-1.5 rounded-xl text-xs transition border border-amber-300 flex items-center gap-1">
                        + 추가
                    </button>
                    <button onclick="removeRoom(${room.id})" class="whitespace-nowrap text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1.5 rounded-xl hover:bg-rose-50 transition flex items-center gap-1">
                        삭제
                    </button>
                </div>
            </div>
            <div class="space-y-2.5 sm:space-y-3">${curtainsHtml}</div>
            <div class="bg-indigo-950 text-white p-3 rounded-xl flex justify-between items-center text-xs shadow-sm">
                <span class="font-bold flex items-center gap-1 truncate mr-2">${room.name} 소계:</span>
                <span class="font-black text-amber-300 text-base font-mono whitespace-nowrap flex-shrink-0" id="roomSubtotal_${room.id}">0원</span>
            </div>
        `;
        container.appendChild(roomCard);
    });
}

// ==============================================================
// 직원 화면: 원단 DB 표 / 부가 기능
// ==============================================================

function toggleDbSection(forceOpen) {
    const content = document.getElementById('dbCollapsibleContent');
    const chevron = document.getElementById('dbAccordionChevron');
    const statusText = document.getElementById('dbAccordionStatus');
    if (!content) return;

    const shouldOpen = forceOpen !== undefined ? forceOpen : content.classList.contains('hidden');
    if (shouldOpen) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
        if (statusText) statusText.textContent = '접기';
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
        if (statusText) statusText.textContent = '펼치기';
    }
}


function renderDbTable() {
    const tbody = document.getElementById('dbTableBody');
    if (!tbody) return;

    const countEl = document.getElementById('dbCount');
    if (countEl) countEl.textContent = FABRIC_DB.length;
    tbody.innerHTML = '';

    const selectedBook = document.getElementById('dbBookFilter') ? document.getElementById('dbBookFilter').value : "ALL";
    const searchKeyword = document.getElementById('dbSearchInput') ? document.getElementById('dbSearchInput').value.trim().toLowerCase() : "";

    let filtered = FABRIC_DB;
    if (selectedBook !== "ALL") filtered = filtered.filter(f => f.book === selectedBook);
    if (searchKeyword) {
        filtered = filtered.filter(f => 
            (f.name && f.name.toLowerCase().includes(searchKeyword)) ||
            (f.book && f.book.toLowerCase().includes(searchKeyword)) ||
            (f.id && f.id.toLowerCase().includes(searchKeyword))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">등록된 품목이 없습니다.</td></tr>`;
        return;
    }

    filtered.forEach((f) => {
        let badgeDesc = f.calcType === "hebe" ? "헤베" : (f.calcType === "width" ? `폭당 ${f.specCm}cm` : `Y당 ${f.specCm}cm`);
        let badgeColor = f.calcType === "hebe" ? "bg-amber-100 text-amber-900" : (f.calcType === "width" ? "bg-stone-200 text-stone-800" : (f.specCm >= 200 ? "bg-amber-200 text-amber-950 font-bold" : "bg-stone-100 text-stone-700"));
        let calcBadge = `<span class="${badgeColor} px-1.5 py-0.5 rounded font-bold">${badgeDesc}</span>`;
        const pv = (appMode === 'staff') ? Costing.costOf(f.id) : null;
        let laborText = pv ? `${(pv.labor||0).toLocaleString()}원/${f.unit||'마'}` : '—';
        let costText = pv ? `${(pv.cost||0).toLocaleString()}원` : '—';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition text-xs">
                <td class="p-2.5 font-bold text-amber-900">
                    <div class="text-[10px] text-slate-400 font-normal">${f.book} [${f.id}]</div>
                    <div class="text-slate-800 font-semibold">${f.name}</div>
                </td>
                <td class="p-2.5 font-mono">${calcBadge}</td>
                <td class="p-2.5 font-mono text-slate-500">${costText}</td>
                <td class="p-2.5 font-mono text-amber-800">${laborText}</td>
                <td class="p-2.5 font-mono font-bold text-indigo-950">${(f.price||0).toLocaleString()}원/${f.unit||'폭'}</td>
            </tr>
        `;
    });
}

function updateBookFilterOptions() {
    const books = [...new Set(FABRIC_DB.map(f => f.book))];
    const filterSelect = document.getElementById('dbBookFilter');
    const currentVal = filterSelect ? filterSelect.value : "ALL";

    if (filterSelect) {
        filterSelect.innerHTML = `<option value="ALL">전체 책자 보기 (${FABRIC_DB.length}개)</option>`;
        books.forEach(b => {
            const count = FABRIC_DB.filter(f => f.book === b).length;
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = `${b} (${count}개)`;
            filterSelect.appendChild(opt);
        });
        if (books.includes(currentVal)) filterSelect.value = currentVal;
    }
}

function copyToClipboard() {
    const textarea = document.getElementById('outputDoc');
    if (!textarea.value) return;
    textarea.select();
    document.execCommand('copy');
    showToast("클립보드에 복사되었습니다!");
}

function openTicketModal() {
    calculateAll();
    const custName = (document.getElementById('custName').value || "").trim();
    const grandTotal = document.getElementById('totalGrandPrice').textContent;

    const nameEl = document.getElementById('ticketCustomerName');
    const totalEl = document.getElementById('ticketGrandTotal');
    const listEl = document.getElementById('ticketItemsList');
    const dateEl = document.getElementById('ticketDateText');

    if (nameEl) nameEl.textContent = custName ? `${custName} 고객님 맞춤 제안` : "고객님 맞춤 제안";
    if (totalEl) totalEl.textContent = grandTotal;

    const today = new Date();
    if (dateEl) dateEl.textContent = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    if (listEl) {
        listEl.innerHTML = '';
        rooms.forEach(r => {
            const roomTotal = r.curtains.reduce((acc, curr) => acc + (curr.calc ? curr.calc.curtainSubtotal : 0), 0);
            const summary = ticketRoomSummary(r);
            const curtainRows = r.curtains.map(c => {
                const calc = c.calc || {};
                const optionsList = [];
                if (c.shapeFee > 0) optionsList.push("형상기억");
                if (c.leadBand) optionsList.push("리드밴드");
                if (c.hotelFit) optionsList.push("호텔핏");
                const optBadge = optionsList.length > 0 
                    ? `<span class="bg-stone-100 text-stone-600 text-[9px] px-1.5 py-0.5 rounded font-sans ml-1">${optionsList.join(', ')}</span>` 
                    : '';

                const reason = ticketItemReason(r, c);
                const thumb = c.fabricId ? `<img class="w-9 h-9 rounded-lg object-cover bg-stone-100 flex-shrink-0" alt="" data-id="${c.fabricId}" data-color="${c.colorName || ''}" data-i="0" src="${fabricPhotoUrls(c.fabricId, c.colorName)[0]}" onerror="ticketThumbFallback(this)">` : '';
                return `
                    <div class="flex items-start gap-2 text-[11px] py-1.5 border-b border-stone-100">
                        ${thumb}
                        <div class="min-w-0 flex-1">
                            <div class="flex justify-between items-center">
                                <div class="truncate pr-1">
                                    <span class="font-bold text-stone-800">${c.label}</span>
                                    <span class="text-[10px] text-stone-500 font-sans ml-1">[${calc.fabBook}] ${calc.fabName}</span>
                                    ${optBadge}
                                </div>
                                <span class="font-bold text-stone-900 font-mono whitespace-nowrap text-[11px]">${(calc.curtainSubtotal || 0).toLocaleString()}원</span>
                            </div>
                            ${reason ? `<div class="text-[10px] font-sans mt-0.5" style="color:#8a4b26">${reason}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');

            const roomCard = document.createElement('div');
            roomCard.className = "bg-white/80 p-3 rounded-2xl border border-stone-200/70 space-y-1.5";
            roomCard.innerHTML = `
                <div class="flex justify-between items-center border-b border-stone-200/80 pb-1">
                    <span class="font-bold text-stone-900 text-xs">${r.name}</span>
                    <span class="font-bold text-amber-900 text-[11px] font-mono">${roomTotal.toLocaleString()}원</span>
                </div>
                ${summary ? `<div class="text-[10px] text-stone-500 font-sans">${summary}</div>` : ''}
                ${curtainRows}
            `;
            listEl.appendChild(roomCard);
        });

        if (globalInstallFee > 0) {
            const installCard = document.createElement('div');
            installCard.className = "flex justify-between items-center px-3 py-2 rounded-xl text-xs font-sans text-stone-800";
            installCard.style.cssText = "background: rgba(250,238,227,0.95); border: 1px solid #efd9c3;";
            installCard.innerHTML = `
                <span class="font-bold text-[11px]">시공 및 설치비</span>
                <span class="font-bold font-mono text-[11px]" style="color:#91401a">${globalInstallFee.toLocaleString()}원</span>
            `;
            listEl.appendChild(installCard);
        }
    }
    const noteEl = document.getElementById('ticketNoteText');
    if (noteEl) { const n = loadTicketNote(); noteEl.textContent = n ? `• ${n}` : ''; noteEl.classList.toggle('hidden', !n); }
    document.getElementById('ticketModal').classList.remove('hidden');
}

function closeTicketModal() {
    document.getElementById('ticketModal').classList.add('hidden');
}

// ==============================================================
// 견적서 이미지 — 화면 캡처 대신 직접 그립니다 (글자 잘림 방지, 외부 라이브러리 불필요)
// ==============================================================
// ---- 제안서에 들어가는 "왜 이렇게 골랐는지" ----
const TICKET_LIGHT_LABELS = { high: '햇빛 풍부', mid: '햇빛 은은', low: '햇빛 차분' };
const TICKET_BLOCK_LABELS = { light: '빛은 은은하게', soft: '빛은 적당히 가림', dark: '빛은 완전 차단' };
// 공간 진단 요약 한 줄 (고객 화면에서 진단을 거친 공간만)
function ticketRoomSummary(r) {
    if (!r || !r.diagnosed) return '';
    const parts = [];
    if (TONE_LABELS[r.floorTone]) parts.push(`바닥 ${TONE_LABELS[r.floorTone]} 톤`);
    if (TONE_LABELS[r.wallTone]) parts.push(`벽 ${TONE_LABELS[r.wallTone]} 톤`);
    if (TICKET_LIGHT_LABELS[r.lightLevel]) parts.push(TICKET_LIGHT_LABELS[r.lightLevel]);
    if (TICKET_BLOCK_LABELS[r.lightBlock]) parts.push(TICKET_BLOCK_LABELS[r.lightBlock]);
    if (MOOD_LABELS[r.wantMood]) parts.push(`${MOOD_LABELS[r.wantMood]} 분위기`);
    return parts.join(' · ');
}
// 품목별 추천 이유 (사장님이 분류한 원단 + 진단을 거친 공간만. 아니면 빈칸)
function ticketItemReason(r, c) {
    if (!r || !r.diagnosed || !c || !c.fabricId) return '';
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return '';
    const cat = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : '겉지');
    const col = c.colorName ? getFabricColors(f.id).find(x => x.name === normalizeColorName(c.colorName)) : null;
    const view = (col && col.tone) ? Object.assign({}, f, { tone: col.tone, manual: Object.assign({}, f.manual, { tone: true }) }) : f;
    try { return recommendReason(view, r, cat) || ''; } catch (e) { return ''; }
}
// 미리보기 사진: 못 찾으면 다음 확장자 → 모두 없으면 칸을 아예 없앰
function ticketThumbFallback(el) {
    const i = parseInt(el.getAttribute('data-i') || '0', 10) + 1;
    const urls = fabricPhotoUrls(el.getAttribute('data-id'), el.getAttribute('data-color') || '');
    if (i < urls.length) { el.setAttribute('data-i', i); el.src = urls[i]; } else { el.style.display = 'none'; }
}

// 견적서 하단 안내 문구 (예: 제작 약 7일 · 시공 약 2시간). 직원 화면에서 입력, 이 브라우저에 저장
const TICKET_NOTE_KEY = 'redam_ticket_note_v1';
function loadTicketNote() { try { return (localStorage.getItem(TICKET_NOTE_KEY) || '').trim(); } catch (e) { return ''; } }
function saveTicketNote(v) { try { localStorage.setItem(TICKET_NOTE_KEY, String(v || '').trim()); } catch (e) {} }
function initTicketNoteInput() { const el = document.getElementById('ticketNoteInput'); if (el) el.value = loadTicketNote(); }

// 견적서 이미지에 넣을 원단 사진을 미리 불러옴 (없으면 사진 없이 그림)
function loadImage(url, timeoutMs) {
    return new Promise(resolve => {
        const img = new Image();
        let done = false;
        const finish = ok => { if (done) return; done = true; resolve(ok ? img : null); };
        img.onload = () => finish(img.naturalWidth > 0);
        img.onerror = () => finish(false);
        setTimeout(() => finish(false), timeoutMs || 3000);
        img.src = url;
    });
}
async function loadTicketPhotos(data) {
    const jobs = [];
    data.rooms.forEach(room => room.items.forEach(it => {
        if (!it.fabricId || data.photos[it.photoKey] !== undefined) return;
        data.photos[it.photoKey] = null;
        jobs.push((async () => {
            for (const u of fabricPhotoUrls(it.fabricId, it.colorName)) {
                const img = await loadImage(u, 3000);
                if (img) { data.photos[it.photoKey] = img; return; }
            }
        })());
    }));
    await Promise.all(jobs);
    return data;
}

function ticketData() {
    calculateAll();
    const custName = (document.getElementById('custName').value || '').trim();
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return {
        title: custName ? `${custName} 고객님 맞춤 제안` : '고객님 맞춤 제안',
        date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
        rooms: rooms.map(r => {
            const items = r.curtains.map(c => {
                const calc = c.calc || {};
                const opts = [];
                if (c.shapeFee > 0) opts.push('형상기억');
                if (c.leadBand) opts.push('리드밴드');
                if (c.hotelFit) opts.push('호텔핏');
                return {
                    label: c.label, fab: `[${calc.fabBook || ''}] ${calc.fabName || ''}`, opts, price: calc.curtainSubtotal || 0,
                    reason: ticketItemReason(r, c), fabricId: c.fabricId || '', colorName: c.colorName || '',
                    photoKey: (c.fabricId || '') + '__' + (c.colorName || '')
                };
            });
            return { name: r.name, total: items.reduce((a, i) => a + i.price, 0), items, summary: ticketRoomSummary(r) };
        }),
        install: globalInstallFee,
        total: document.getElementById('totalGrandPrice').textContent,
        note: loadTicketNote(),
        photos: {}
    };
}

function drawTicket(ctx, data, W) {
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const MONO = 'ui-monospace,"SFMono-Regular",Menlo,Consolas,"Liberation Mono",monospace';
    const DARK = '#2b221a', MUTED = '#6f5f4f', ACCENT = '#91401a', LINE = '#e5dcd0';
    const PAD = 87, CX = PAD, CW = W - PAD * 2;
    const START_Y = 282 + 52;                       // 방 카드가 시작되는 높이 (머리글 아래)
    const setFont = (weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; };
    const spacing = v => { if ('letterSpacing' in ctx) ctx.letterSpacing = v; };
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    const hline = (x1, x2, y, color) => { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
    const wrap = (text, maxW) => {
        const lines = []; let cur = '';
        for (const word of String(text).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (ctx.measureText(test).width <= maxW) { cur = test; continue; }
            if (cur) lines.push(cur);
            cur = '';
            if (ctx.measureText(word).width <= maxW) { cur = word; continue; }
            let chunk = '';
            for (const ch of word) { if (ctx.measureText(chunk + ch).width > maxW) { lines.push(chunk); chunk = ch; } else chunk += ch; }
            cur = chunk;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    const text = (str, x, y, align, color) => { ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y); };
    const won = n => `${n.toLocaleString()}원`;

    // 머리글 (페이지마다 같은 모양)
    function hdr() {
        spacing('3px'); setFont(700, 27, SANS); text('FABRIC STYLING CARD', CX, 142, 'left', MUTED); spacing('0px');
        setFont(400, 28, SANS); text(data.date, W - PAD, 142, 'right', MUTED);
        setFont(700, 60, SERIF); text(data.title, CX, 238, 'left', DARK);
        rr(W - PAD - 150, 166, 150, 50, 25); ctx.fillStyle = 'rgba(250,238,227,0.95)'; ctx.fill();
        setFont(700, 26, SANS); text('Re.dam', W - PAD - 75, 201, 'center', ACCENT);
        hline(CX, W - PAD, 282, LINE);
    }

    // 방 카드 한 장의 크기를 미리 계산
    function layoutRoom(room) {
        const px = CX + 40, iw = CW - 80;
        const THUMB = 132;                     // 원단 사진 크기 (사진이 있을 때만)
        const blocks = room.items.map(it => {
            const photo = (data.photos && data.photos[it.photoKey]) || null;
            const tx = px + (photo ? THUMB + 28 : 0), tw = px + iw - tx;
            setFont(400, 25, SANS);
            const lines = wrap(it.fab, tw);
            setFont(500, 24, SANS);
            const rlines = it.reason ? wrap(it.reason, tw) : [];
            // 위치(카드 안 상대값): 품목명 62, 원단명 104~, 추천 이유, 옵션
            const lastFab = 104 + (lines.length - 1) * 36;
            const lastText = rlines.length ? lastFab + 40 + (rlines.length - 1) * 34 : lastFab;
            let h = lastText + (it.opts.length ? 16 + 38 : 0) + 30;
            if (photo) h = Math.max(h, 28 + THUMB + 28);
            return { it, lines, rlines, photo, tx, h };
        });
        setFont(400, 24, SANS);
        const slines = room.summary ? wrap(room.summary, iw) : [];
        const headH = slines.length ? 88 + 24 + slines.length * 34 + 6 : 98;
        const cardH = headH + blocks.reduce((a, b) => a + b.h, 0) + 14;
        return { room, px, iw, THUMB, blocks, slines, headH, cardH };
    }
    // 방 카드 한 장을 y 위치에 그림
    function drawRoom(L, y) {
        const { room, px, iw, THUMB, blocks, slines, headH, cardH } = L;
        rr(CX, y, CW, cardH, 48); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
        ctx.strokeStyle = '#ece4d8'; ctx.lineWidth = 2; ctx.stroke();
        setFont(700, 38, SERIF); text(room.name, px, y + 62, 'left', DARK);
        setFont(700, 36, SANS); text(won(room.total), px + iw, y + 62, 'right', ACCENT);
        hline(px, px + iw, y + 88, LINE);
        if (slines.length) { setFont(400, 24, SANS); slines.forEach((ln, i) => text(ln, px, y + 88 + 34 + i * 34, 'left', MUTED)); }
        let by = y + headH;
        blocks.forEach((b, idx) => {
            const base = by + 28 + 34;
            if (b.photo) {
                // 사진은 정사각형으로 가운데를 잘라 둥근 모서리 안에 그림
                const sw = b.photo.naturalWidth, sh = b.photo.naturalHeight, side = Math.min(sw, sh);
                ctx.save(); rr(px, by + 28, THUMB, THUMB, 22); ctx.clip();
                ctx.drawImage(b.photo, (sw - side) / 2, (sh - side) / 2, side, side, px, by + 28, THUMB, THUMB);
                ctx.restore();
            }
            setFont(700, 32, SERIF); text(b.it.label, b.tx, base, 'left', DARK);
            setFont(700, 34, SANS); text(won(b.it.price), px + iw, base, 'right', '#1c1917');
            setFont(400, 25, SANS);
            b.lines.forEach((ln, li) => text(ln, b.tx, base + 42 + li * 36, 'left', MUTED));
            let ty = base + 42 + (b.lines.length - 1) * 36 + 16;
            if (b.rlines.length) {
                setFont(500, 24, SANS);
                const ry = base + 42 + (b.lines.length - 1) * 36 + 40;
                b.rlines.forEach((ln, li) => text(ln, b.tx, ry + li * 34, 'left', '#8a4b26'));
                ty = ry + (b.rlines.length - 1) * 34 + 16;
            }
            if (b.it.opts.length) {
                let ox = b.tx; setFont(700, 22, SANS);
                b.it.opts.forEach(o => {
                    const w = ctx.measureText(o).width + 32;
                    rr(ox, ty, w, 38, 19); ctx.fillStyle = '#f1ebe1'; ctx.fill();
                    text(o, ox + 16, ty + 27, 'left', MUTED);
                    ox += w + 10;
                });
            }
            by += b.h;
            if (idx < blocks.length - 1) hline(px, px + iw, by - 4, '#f0e9de');
        });
    }
    // 맨 아래 합계 구역(시공비·최종 금액·안내 문구): 크기 계산 / 그리기
    function layoutFooter() {
        setFont(500, 26, SANS);
        const nlines = data.note ? wrap(data.note, CW) : [];
        const h = (data.install > 0 ? 92 + 40 : 0) + 64 + 104 + 78 + (nlines.length ? nlines.length * 38 + 6 : 0) + 86;
        return { nlines, h };
    }
    function drawFooter(F, y) {
        if (data.install > 0) {
            rr(CX, y, CW, 92, 36); ctx.fillStyle = 'rgba(250,238,227,0.95)'; ctx.fill();
            ctx.strokeStyle = '#efd9c3'; ctx.lineWidth = 2; ctx.stroke();
            setFont(700, 30, SANS); text('시공 및 설치비', CX + 40, y + 58, 'left', DARK);
            setFont(700, 32, SANS); text(won(data.install), CX + CW - 40, y + 58, 'right', ACCENT);
            y += 92 + 40;
        }
        hline(CX, W - PAD, y, LINE);
        y += 64;
        setFont(700, 30, SANS); text('최종 견적 금액 (시공비 포함)', CX, y, 'left', '#44392f');
        y += 104;
        setFont(700, 30, SANS);
        const wonW = ctx.measureText('원').width;
        text('원', W - PAD, y, 'right', DARK);
        setFont(800, 92, MONO); text(data.total, W - PAD - wonW - 14, y, 'right', '#1c1917');
        y += 78;
        if (F.nlines.length) {
            setFont(500, 26, SANS);
            F.nlines.forEach((ln, i) => text(ln, W / 2, y + i * 38, 'center', DARK));
            y += F.nlines.length * 38 + 6;
        }
        setFont(400, 24, SANS); text('• 전문 핏팅 시공 및 1년 무상 안심 A/S 지원', W / 2, y, 'center', MUTED);
    }
    function pageLabel(i, n, H) {
        if (n < 2) return;
        setFont(500, 22, SANS); text(`${i + 1} / ${n}`, W / 2, H - 34, 'center', MUTED);
    }
    return { START_Y, hdr, layoutRoom, drawRoom, layoutFooter, drawFooter, pageLabel };
}

// 견적서는 A4 세로 비율의 "고정 크기" 페이지(1080 x 1527)로 만듭니다.
//  1) 내용이 한 장에 들어가면 그대로,
//  2) 조금 넘치면 글자·간격을 살짝 줄여서(최대 80%까지) 한 장에 맞추고,
//  3) 그래도 안 들어가면 방 카드 단위로 다음 장에 이어 그립니다 (최종 금액은 맨 마지막 장 아래쪽).
const TICKET_W = 1080;
const TICKET_PAGE_H = Math.round(TICKET_W * 1.414);
const TICKET_SCALES = [1, 0.95, 0.9, 0.85, 0.8];
function planTicket(data, s) {
    const W = Math.round(TICKET_W / s), PAGE_H = Math.round(TICKET_PAGE_H / s), GAP = 34, BOTTOM = 80;
    const probe = document.createElement('canvas').getContext('2d');
    const T = drawTicket(probe, data, W);
    const layouts = data.rooms.map(r => T.layoutRoom(r));
    const F = T.layoutFooter();
    const pages = [];
    let cur = { items: [], y: T.START_Y };
    layouts.forEach(L => {
        if (cur.items.length && cur.y + L.cardH > PAGE_H - BOTTOM) { pages.push(cur); cur = { items: [], y: T.START_Y }; }
        cur.items.push({ L, y: cur.y });
        cur.y += L.cardH + GAP;
    });
    pages.push(cur);
    // 마지막 장에 합계가 안 들어가면 마지막 방을 새 장으로 옮김
    let last = pages[pages.length - 1];
    if (last.y + F.h > PAGE_H && last.items.length > 1) {
        const mv = last.items.pop();
        last.y = mv.y;
        pages.push({ items: [{ L: mv.L, y: T.START_Y }], y: T.START_Y + mv.L.cardH + GAP });
        last = pages[pages.length - 1];
    }
    const fitsOnePage = pages.length === 1 && last.y + F.h <= PAGE_H;
    return { s, W, PAGE_H, BOTTOM, F, pages, fitsOnePage };
}
function buildTicketCanvases(opts, preparedData) {
    opts = opts || {};
    const data = preparedData || ticketData();
    let plan = null;
    for (const s of TICKET_SCALES) { const p = planTicket(data, s); if (p.fitsOnePage) { plan = p; break; } }
    if (!plan) plan = planTicket(data, 1);
    const { s, W, PAGE_H, BOTTOM, F, pages } = plan;

    return pages.map((p, pi) => {
        const isLast = pi === pages.length - 1;
        const H = Math.max(PAGE_H, Math.ceil(p.y + (isLast ? F.h : BOTTOM)));   // 아주 긴 방 하나일 때만 늘어남 (화면 좌표)
        const canvas = document.createElement('canvas');
        canvas.width = TICKET_W; canvas.height = Math.round(H * s);
        const ctx = canvas.getContext('2d');
        ctx.scale(s, s);                                                        // 이후는 모두 "늘리거나 줄이기 전" 좌표
        if (opts.solidBg) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); }   // 인쇄/PDF/공유는 흰 바탕 위에
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#fbf9f5'); grad.addColorStop(1, '#f4ede4');
        ctx.beginPath();
        const r = 72; ctx.moveTo(r, 0); ctx.arcTo(W, 0, W, H, r); ctx.arcTo(W, H, 0, H, r); ctx.arcTo(0, H, 0, 0, r); ctx.arcTo(0, 0, W, 0, r); ctx.closePath();
        ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#e8e0d4'; ctx.lineWidth = 2; ctx.stroke();
        ctx.textBaseline = 'alphabetic';
        const t = drawTicket(ctx, data, W);
        t.hdr();
        p.items.forEach(it => t.drawRoom(it.L, it.y));
        if (isLast) t.drawFooter(F, Math.max(p.y, H - F.h));
        t.pageLabel(pi, pages.length, H);
        return canvas;
    });
}

// 글꼴·원단 사진을 준비한 뒤 견적서 이미지(여러 장일 수 있음)를 만듦
async function makeTicketBlobs(opts) {
    opts = opts || {};
    try {
        if (document.fonts && document.fonts.load) {
            await Promise.all([
                document.fonts.load('700 38px "Noto Serif KR"'),
                document.fonts.load('700 28px Pretendard'),
                document.fonts.load('500 24px Pretendard'),
                document.fonts.load('400 24px Pretendard')
            ]);
        }
    } catch (e) {}
    const data = await loadTicketPhotos(ticketData());
    const canvases = buildTicketCanvases(opts, data);
    const type = opts.type || 'image/png';
    const blobs = await Promise.all(canvases.map(c => new Promise(res => c.toBlob(res, type, 0.92))));
    return { canvases, blobs, type };
}
// 파일 이름. asciiOnly는 휴대폰 공유 창이 한글 이름을 못 읽는 경우를 피하기 위한 영문 이름
function ticketFileNames(count, ext, asciiOnly) {
    const custName = (document.getElementById('custName').value || "").trim();
    const base = asciiOnly ? 'redam_quote' : `${custName ? custName + '_' : ''}맞춤견적서`;
    return Array.from({ length: count }, (_, i) => `${base}${count > 1 ? '_' + (i + 1) : ''}.${ext}`);
}
function saveBlobAsFile(blob, name) {
    const link = document.createElement('a');
    link.download = name;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

async function downloadTicketImage() {
    showToast("이미지 생성 중...", "info");
    try {
        const { blobs } = await makeTicketBlobs();
        const names = ticketFileNames(blobs.length, 'png', false);
        for (let i = 0; i < blobs.length; i++) {
            saveBlobAsFile(blobs[i], names[i]);
            if (i < blobs.length - 1) await new Promise(r => setTimeout(r, 400));   // 여러 장은 간격을 두고 저장
        }
        showToast(blobs.length > 1 ? `견적서 이미지 ${blobs.length}장이 저장되었습니다!` : "견적서 이미지가 저장되었습니다!");
    } catch (err) {
        console.error(err);
        showToast("이미지 생성 중 오류 발생", "error");
    }
}

// 카카오톡용 이미지 저장: 탭(삼성)에서 공유 창이 끝없이 로딩되는 문제가 계속돼 "공유" 대신 "저장"으로 바꿈
// 가벼운 JPG로 갤러리에 저장 → 카카오톡에서 사진으로 보내면 됨
let __shareBusy = false;
async function shareTicketImage() {
    if (__shareBusy) return;          // 연타해도 여러 번 저장되지 않게
    __shareBusy = true;
    showToast("이미지 준비 중...", "info");
    try {
        const { blobs } = await makeTicketBlobs({ solidBg: true, type: 'image/jpeg' });
        const names = ticketFileNames(blobs.length, 'jpg', false);
        for (let i = 0; i < blobs.length; i++) {
            saveBlobAsFile(blobs[i], names[i]);
            if (i < blobs.length - 1) await new Promise(r => setTimeout(r, 400));   // 여러 장은 간격을 두고 저장
        }
        showToast(`${blobs.length > 1 ? blobs.length + '장 ' : ''}저장했어요. 카카오톡 → 사진(갤러리)에서 골라 보내 주세요.`, "success");
    } catch (err) {
        console.error(err);
        showToast("이미지 저장 중 오류가 발생했습니다. '고화질 이미지 저장'을 이용해 주세요.", "error");
    } finally {
        __shareBusy = false;
    }
}

async function preparePrintSheet() {
    const { canvases } = await makeTicketBlobs({ solidBg: true });
    const sheet = document.getElementById('printSheet');
    sheet.innerHTML = '';
    for (const canvas of canvases) {
        const page = document.createElement('div');
        page.className = 'print-page';
        const img = document.createElement('img');
        img.alt = '견적서';
        img.src = canvas.toDataURL('image/png');
        page.appendChild(img);
        sheet.appendChild(page);
        if (img.decode) { try { await img.decode(); } catch (e) {} }
    }
}

// 인쇄 중에는 견적서 이미지(#printSheet)만 남기고 나머지 화면을 숨깁니다.
// (고객 화면은 "항상 표시"로 고정돼 있어서 스타일시트만으로는 숨겨지지 않기 때문에 직접 숨기고, 끝나면 되돌립니다.)
let __printHidden = [];
function isolatePrintSheet() {
    restorePrintIsolation(false);
    Array.from(document.body.children).forEach(el => {
        if (el.id === 'printSheet' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
        __printHidden.push({ el, value: el.style.getPropertyValue('display'), priority: el.style.getPropertyPriority('display') });
        el.style.setProperty('display', 'none', 'important');
    });
    const sheet = document.getElementById('printSheet');
    if (sheet) {
        sheet.style.setProperty('display', 'block', 'important');
        sheet.style.setProperty('background', '#ffffff', 'important');
        // 화면에서만 보이는 "돌아가기" 버튼 (인쇄물에는 나오지 않음). 인쇄 창이 닫혔는데도 화면이 안 돌아올 때를 대비
        const back = document.createElement('button');
        back.id = 'printBackBtn';
        back.type = 'button';
        back.textContent = '← 돌아가기';
        back.onclick = () => restorePrintIsolation(true);
        sheet.appendChild(back);
    }
    // 인쇄 미리보기가 만들어지는 동안에는 화면을 되돌리지 않습니다 (되돌리면 뒤로가기 버튼·반투명 배경이 인쇄물에 섞임).
    // 인쇄 창이 닫힌 뒤(afterprint)에만 되돌립니다.
    window.addEventListener('afterprint', () => restorePrintIsolation(true), { once: true });
}
function restorePrintIsolation(clearSheet) {
    __printHidden.forEach(({ el, value, priority }) => {
        if (value) el.style.setProperty('display', value, priority); else el.style.removeProperty('display');
    });
    __printHidden = [];
    const sheet = document.getElementById('printSheet');
    if (sheet) {
        sheet.style.removeProperty('display');
        sheet.style.removeProperty('background');
        const back = document.getElementById('printBackBtn');
        if (back) back.remove();
        if (clearSheet) sheet.innerHTML = '';
    }
}

// 견적서 인쇄 / PDF 저장: 저장되는 이미지와 똑같은 모양을 한 장으로 출력
async function printTicket() {
    await preparePrintSheet();
    const prevTitle = document.title;
    const custName = (document.getElementById('custName').value || '').trim();
    document.title = `${custName ? custName + '_' : ''}맞춤견적서`;      // PDF 기본 파일명
    window.addEventListener('afterprint', () => { document.title = prevTitle; }, { once: true });
    isolatePrintSheet();
    // 화면이 바뀐 뒤 인쇄 창을 열어야 안정적입니다.
    setTimeout(() => window.print(), 120);
}

function showToast(msg, type = "success") {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    if (toastMsg) toastMsg.textContent = msg;
    if (toastIcon) {
        if (type === "info") toastIcon.className = "fa-solid fa-circle-info text-amber-600";
        else if (type === "error") toastIcon.className = "fa-solid fa-circle-xmark text-rose-500";
        else toastIcon.className = "fa-solid fa-circle-check text-amber-700";
    }
    if (toast) {
        toast.classList.remove('hidden');
        setTimeout(() => { toast.classList.add('hidden'); }, 2500);
    }
}

// ==============================================================
// V2 -> V1 전역 동기화 정식 엔드포인트 (배열 참조 유지 및 완벽 계산)
// ==============================================================
window.syncFromExternalRooms = function(newRooms, newInstallFee) {
    if (Array.isArray(newRooms)) {
        rooms.length = 0;
        newRooms.forEach((r, idx) => {
            rooms.push({
                id: idx + 1,
                name: r.name,
                sunlight: r.sunlight || "south",
                lightLevel: r.lightLevel || "mid",
                floorTone: r.floorTone || "warm",
                wallTone: r.wallTone || "cool",
                mood: r.mood || "soft_warm",
                wantMood: r.wantMood || null,
                roomType: r.roomType || null,
                lightBlock: r.lightBlock || null,
                diagnosed: !!r.diagnosed,          // 고객 화면에서 바닥·벽·채광 진단을 거친 공간 (제안서에 진단 요약 표시)
                curtains: r.curtains.map((c, cIdx) => {
                    const isBlind = c.presetType === "blind";
                    return {
                        id: (idx + 1) * 100 + (cIdx + 1),
                        label: c.label,
                        presetType: isBlind ? "blind" : (c.presetType || "drape"),
                        width: Number(c.width) || 340,
                        height: Number(c.height) || 235,
                        pleat: isBlind ? "1.0" : (c.pleat || "2.0"),
                        pleatType: isBlind ? "민자" : (c.pleatType || "나비주름"),
                        bookFilter: c.bookFilter || "ALL",
                        fabricId: c.fabricId,
                        installType: isBlind ? "none" : (c.installType || "rail"),
                        floorGap: isBlind ? 0 : (c.floorGap || 0),
                        hwName: isBlind ? "블라인드 일체형" : (c.hwName || "기본 레일"),
                        hwPrice: isBlind ? 0 : (c.hwPrice !== undefined ? c.hwPrice : 1000),
                        shapeFee: isBlind ? 0 : (c.shapeFee || 0),
                        leadBand: isBlind ? false : Boolean(c.leadBand),
                        hotelFit: isBlind ? false : Boolean(c.hotelFit),
                        colorName: c.colorName || '',
                        calc: c.calc
                    };
                })
            });
        });
    }

    if (newInstallFee !== undefined) {
        globalInstallFee = parseFloat(newInstallFee) || 0;
        const expEl = document.getElementById('expressInstallFee');
        if (expEl) expEl.value = globalInstallFee;
    }

    calculateAll();
    renderRooms();
};

