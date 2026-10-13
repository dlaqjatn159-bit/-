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
        const expressFee = document.getElementById('expressInstallFee');
        if (expressFee) expressFee.value = globalInstallFee;
        renderSideCust();
        renderRooms();
        renderDbTable();
        updatePrivateStatus();
        renderHistory();
        warnHistoryFull();
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
    showStaffView('consult');
    switchMainTrack('express');
    startIdleWatch();
}

function exitStaffMode(toastMsg, goToProposal) {
    stopIdleWatch();
    if (staffLocked) { staffLocked = false; RedamAuth.dismiss(); }      // 잠긴 채로 나갈 때는 잠금 창도 닫음
    appMode = 'customer';
    document.body.dataset.mode = 'customer';
    Costing.state.enabled = false;
    // 원가가 화면에 남지 않도록 정리
    toggleMarginSection(false);
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

// 직원 화면 메뉴(왼쪽 사이드바 · 좁은 화면은 아래 탭바): 상담 / 서류 / 상담 기록 / 원단 / 설정. 내용은 모두 그려 두고 보이는 묶음만 바꿈
function showStaffView(view) {
    document.querySelectorAll('.staff-nav button').forEach(b => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('.staff-view').forEach(s => s.classList.toggle('on', s.id === 'view-' + view));
    if (view === 'fabric') renderFinder();      // 분류·색상을 고친 뒤 돌아와도 새 값으로 보이게, 열 때마다 다시 그림
    window.scrollTo(0, 0);
}
// 원단 메뉴의 탭 5개: 찾기(find) · 원단 목록(list) · 분류(tag) · 색상(color) · 사진(photo)
function showFabricTab(tab) {
    document.querySelectorAll('.staff-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.staff-pane').forEach(p => p.classList.toggle('on', p.id === 'fabricTab-' + tab));
    if (tab === 'find') renderFinder();
}
// 사이드바 머리의 "지금 고객 이름"
function renderSideCust() {
    const el = document.getElementById('sideCustName');
    if (!el) return;
    const name = ((document.getElementById('custName') || {}).value || '').trim();
    el.textContent = name ? `${name} 고객님` : '이름 없는 상담';
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
    collapsedRooms.clear(); openCurtainDetails.clear();
    finderTarget = null; finderView = 'grid'; finderPicks = []; resetFinderFilters(true);
    globalInstallFee = loadDefaultInstallFee();
    globalVatOption = 'consumer';
    const fee = document.getElementById('expressInstallFee'); if (fee) fee.value = globalInstallFee;
    const vat = document.getElementById('expressVatOption'); if (vat) vat.value = globalVatOption;
    if (window.concierge) window.concierge.resetAll();
    const expressCust = document.getElementById('expressCustName'); if (expressCust) expressCust.value = '';
    const expressPhone = document.getElementById('expressCustPhone'); if (expressPhone) expressPhone.value = '';
    renderSideCust();
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
    let mode = 'verify';        // 'verify' | 'setup' | 'change' | 'unlock'(잠금 화면)
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
        const lock = (m === 'unlock');
        el('pinTitle').textContent = lock ? '잠겨 있어요' : (m === 'verify' ? '직원 모드' : (m === 'setup' ? '직원 PIN 만들기' : 'PIN 변경'));
        el('pinDesc').textContent = lock ? 'PIN을 넣으면 하던 화면으로 돌아갑니다.' : (m === 'verify' ? 'PIN을 입력해 주세요.'
            : '숫자 4~8자리를 정하고 한 번 더 입력해 주세요. (분실하면 복구할 수 없으니 꼭 기억해 두세요)');
        el('pinInput').placeholder = two ? '새 PIN' : '••••';
        el('pinInput2').placeholder = '새 PIN 확인';
        el('pinCancelBtn').textContent = lock ? '고객 화면으로' : '취소';
        el('pinModal').classList.toggle('is-lock', lock);          // 잠금 화면일 때는 뒤 화면(원가)이 읽히지 않게 더 흐리게
        el('pinModal').classList.remove('hidden');
        setTimeout(() => el('pinInput').focus(), 50);
    }
    function closeModal() { mode = 'verify'; el('pinModal').classList.add('hidden'); el('pinModal').classList.remove('is-lock'); el('pinInput').value = ''; el('pinInput2').value = ''; }

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
        requestUnlock: function() { openModal('unlock'); },
        dismiss: closeModal,
        // 잠금 화면의 "고객 화면으로"는 창만 닫지 않고 고객 화면으로 나감
        cancel: function() { const wasLock = (mode === 'unlock'); closeModal(); if (wasLock) exitStaffMode(); },
        submit: async function() {
            const pin = el('pinInput').value.trim();
            const err = el('pinError');
            if (mode === 'verify' || mode === 'unlock') {
                if (Date.now() < lockedUntil) { err.textContent = `잠시 후 다시 시도해 주세요. (${Math.ceil((lockedUntil - Date.now()) / 1000)}초)`; return; }
                const st = loadStored();
                if (st && (await hashPin(pin, st.salt)) === st.hash) {
                    const wasLock = (mode === 'unlock');
                    fails = 0; closeModal();
                    if (wasLock) unlockStaff(); else enterStaffMode();      // 잠금 해제는 화면을 다시 그리지 않음 → 하던 화면 그대로
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

// 자동 잠금: 일정 시간 손대지 않으면 고객 화면으로 나가지 않고, 하던 화면 위에 잠금 화면(PIN)을 덮음. PIN을 넣으면 그 자리에서 이어서 씀
//  - 잠금 시간은 기기마다 따로 (5분 / 15분 / 30분 / 끄기, 처음 값 15분). 이 브라우저에만 저장하고 비공개 팩에는 넣지 않음
//  - 잠기기 30초 전에 "곧 잠깁니다 · 계속 쓰기" 알림
const LOCK_MIN_KEY = 'redam_lock_min_v1';
const LOCK_MIN_CHOICES = [5, 15, 30, 0];        // 0 = 끄기
const LOCK_WARN_MS = 30 * 1000;
let idleTimer = null, lastActivity = Date.now(), staffLocked = false;
function loadLockMin() {
    try { const v = localStorage.getItem(LOCK_MIN_KEY), n = (v === null) ? 15 : parseInt(v, 10); return LOCK_MIN_CHOICES.includes(n) ? n : 15; } catch (e) { return 15; }
}
function setLockMin(n) {
    try { localStorage.setItem(LOCK_MIN_KEY, String(n)); } catch (e) {}
    renderLockSetting();
}
function renderLockSetting() {
    const min = loadLockMin();
    document.querySelectorAll('#lockSeg button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.min) === min)));
    const hint = document.getElementById('lockHint');
    if (hint) hint.textContent = min ? `${min}분 동안 손대지 않으면 잠깁니다` : '이 기기는 자동으로 잠기지 않습니다';
}
function markActivity() { lastActivity = Date.now(); }
function idleTick() {
    if (appMode !== 'staff' || staffLocked) return;
    const warn = document.getElementById('lockWarn');
    const limit = loadLockMin() * 60 * 1000, left = limit - (Date.now() - lastActivity);
    if (!limit || left > LOCK_WARN_MS) { if (warn) warn.classList.add('hidden'); return; }
    if (left <= 0) { lockStaff(); return; }
    if (warn) { document.getElementById('lockWarnSec').textContent = Math.ceil(left / 1000); warn.classList.remove('hidden'); }
}
function startIdleWatch() {
    lastActivity = Date.now();
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, markActivity, true));
    clearInterval(idleTimer);
    idleTimer = setInterval(idleTick, 1000);
    renderLockSetting();
}
function stopIdleWatch() {
    clearInterval(idleTimer);
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.removeEventListener(ev, markActivity, true));
    setStaffLockedUi(false);
}
// 잠금 중에는 뒤의 직원 화면을 누르거나 키보드로 고칠 수 없게 함 (화면은 PIN 창이 흐리게 덮음)
function setStaffLockedUi(on) {
    const sec = document.getElementById('trackExpressSection'); if (sec) sec.inert = on;
    const warn = document.getElementById('lockWarn'); if (warn) warn.classList.add('hidden');
}
function lockStaff() {
    if (appMode !== 'staff' || staffLocked) return;
    staffLocked = true;
    setStaffLockedUi(true);
    RedamAuth.requestUnlock();
}
function unlockStaff() {
    staffLocked = false;
    setStaffLockedUi(false);
    lastActivity = Date.now();
}

// ==============================================================
// 작성 중 상담 자동 저장 / 상담 이력
//  - 3초마다 바뀐 내용만 저장합니다. (원가·계산 결과는 저장하지 않음)
//  - 다시 열었을 때 3시간 이내의 상담이면 자동 복구, 오래됐으면 "상담 이력"으로 옮겨
//    다음 고객에게 보이지 않게 합니다. 이력은 직원 모드(PIN)에서만 볼 수 있습니다.
// ==============================================================
const DRAFT_FRESH_MS = 3 * 60 * 60 * 1000;
const HISTORY_MAX = 500;
let __lastDraftJson = '';
let __historyUnsaved = null;       // 저장에 실패한 이력 목록 (창을 닫기 전까지 기억 → 백업·정리 후 다시 저장)

function collectConsultation() {
    const src = (appMode === 'staff' || !window.concierge) ? rooms : window.concierge.getRoomsForSave();
    return {
        name: ((document.getElementById('custName') || {}).value || '').trim(),
        phone: ((document.getElementById('custPhone') || {}).value || '').trim(),
        rooms: src.map(r => ({
            name: r.name, sunlight: r.sunlight, lightLevel: r.lightLevel, floorTone: r.floorTone, wallTone: r.wallTone, mood: r.mood, wantMood: r.wantMood || null,
            roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, diagnosed: !!r.diagnosed,
            curtains: r.curtains.map(c => { const copy = Object.assign({}, c); delete copy.calc; return copy; })
        })),
        installFee: globalInstallFee,
        vat: globalVatOption,
        picks: finderPicks.slice()          // 원단 찾기에서 별표한 후보 색 (상담 기록에서 다시 열면 그대로)
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
    if (__historyUnsaved) return __historyUnsaved.slice();
    try { const h = JSON.parse(localStorage.getItem(STORE_KEYS.history)); return Array.isArray(h) ? h : []; } catch (e) { return []; }
}
function saveHistory(list) {
    const kept = list.slice(0, HISTORY_MAX);
    try {
        localStorage.setItem(STORE_KEYS.history, JSON.stringify(kept));
        __historyUnsaved = null;
        return true;
    } catch (e) {
        console.warn('이력 저장 실패', e);
        __historyUnsaved = kept;                   // 기기에 못 적은 목록은 화면이 열려 있는 동안만 남음
        warnHistoryFull();
        return false;
    }
}
// 기록 공간(브라우저 저장소)이 가득 차 이력을 못 적었을 때: 직원 화면에서만 알림 (고객 화면에는 띄우지 않음)
const HISTORY_FULL_MSG = '기록 공간이 가득 찼어요. 백업 후 오래된 기록을 정리해 주세요';
function warnHistoryFull() {
    if (__historyUnsaved && appMode === 'staff') showToast(HISTORY_FULL_MSG, 'error');
}
// 비공개 팩(백업)의 상담 기록을 이 기기 기록과 합침 — 덮어쓰지 않음. id가 같으면 더 새 것(updatedAt)만 남기고 최근 순으로 정렬
function mergeHistoryFromPack(incoming) {
    const byId = {};
    const usable = h => h && /^[\w-]+$/.test(h.id) && h.snapshot && Array.isArray(h.snapshot.rooms) && h.snapshot.rooms.every(r => r && Array.isArray(r.curtains));
    loadHistory().concat(incoming.filter(usable)).forEach(h => {
        if (!byId[h.id] || (h.updatedAt || 0) > (byId[h.id].updatedAt || 0)) byId[h.id] = h;
    });
    saveHistory(Object.values(byId).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
    renderHistory();
}
function archiveConsultation(snap, updatedAt) {
    if (!snap || !snap.rooms || snap.rooms.length === 0) return;
    const list = loadHistory();
    list.unshift({ id: 'h' + Date.now() + Math.floor(Math.random() * 1000), updatedAt: updatedAt || Date.now(), name: snap.name || '', total: estimateSnapshotTotal(snap), snapshot: snap });
    saveHistory(list);
}

function applySnapshot(snap) {
    roomIdCounter = 1; curtainIdCounter = 100;
    collapsedRooms.clear(); openCurtainDetails.clear();
    rooms = snap.rooms.map(r => Object.assign({}, r, {
        id: roomIdCounter++,
        curtains: r.curtains.map(c => Object.assign({}, c, { id: curtainIdCounter++ }))
    }));
    globalInstallFee = snap.installFee;
    globalVatOption = snap.vat || 'consumer';
    finderPicks = Array.isArray(snap.picks) ? snap.picks.filter(k => typeof k === 'string').slice(0, FINDER_PICK_MAX) : [];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('custName', snap.name || ''); set('expressCustName', snap.name || '');
    set('custPhone', snap.phone || ''); set('expressCustPhone', snap.phone || '');
    set('expressInstallFee', globalInstallFee); set('expressVatOption', globalVatOption);
    renderSideCust();
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
    const nav = document.getElementById('historyNavCount'); if (nav) nav.textContent = list.length || '';
    const full = document.getElementById('historyFullNotice'); if (full) full.classList.toggle('hidden', !__historyUnsaved);
    if (list.length === 0) { box.innerHTML = '<div class="text-xs text-slate-400 py-3 text-center">저장된 상담이 없습니다.</div>'; return; }
    // 이름·연락처 찾기 (연락처는 하이픈 없이 숫자만 쳐도 찾음)
    const q = ((document.getElementById('historySearch') || {}).value || '').trim().toLowerCase(), qDigits = q.replace(/\D/g, '');
    const shown = !q ? list : list.filter(h => {
        const phone = (h.snapshot && h.snapshot.phone) || '';
        return (h.name || '').toLowerCase().includes(q) || phone.includes(q) || (qDigits.length >= 2 && phone.replace(/\D/g, '').includes(qDigits));
    });
    if (shown.length === 0) { box.innerHTML = '<div class="text-xs text-slate-400 py-3 text-center">찾는 상담이 없어요.</div>'; return; }
    const pad = n => String(n).padStart(2, '0');
    box.innerHTML = shown.map(h => {
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
    finderTarget = null; finderView = 'grid'; resetFinderFilters(true);       // 원단 찾기의 넣을 칸·거름망은 상담 하나 동안만
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
                <span class="text-[10px] font-bold text-slate-500 ml-2 mr-0.5" title="질감·톤·비침으로 자동으로 정해져요. 자동 결과가 원단 느낌과 다를 때만 직접 고르세요">분위기(선택)</span>
                <select onchange="setFabricTag('${f.id}','mood',this.value)" class="px-2 py-1.5 border rounded-lg text-xs font-semibold bg-white outline-none">${moodOpts}</select>
                ${densBlock}${blackBlock}
                ${(m.tone || m.mood || m.density || m.blackout || f.texture) ? `<button onclick="clearFabricTags('${f.id}')" class="text-[11px] text-rose-500 font-bold px-1.5">자동으로</button>` : ''}
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

// ---- 원단 찾기 (원단 › 찾기 탭): 원단의 색 하나가 카드 한 장 ----
// 상담 화면의 원단 칸 옆 "찾기"로 들어오면 그 칸이 "넣을 칸"이 되고, 카드의 "이 공간에 넣기"로 원단과 색상 번호가 한 번에 들어감
let finderTarget = null;      // { roomId, curtainId } — 화면에서만 쓰는 상태라 저장하지 않음
function finderTargetCurtain() {
    if (!finderTarget) return null;
    const room = rooms.find(r => r.id === finderTarget.roomId);
    const c = room && room.curtains.find(x => x.id === finderTarget.curtainId);
    return c ? { room, c } : null;
}
// 상담 화면의 커튼 칸이 어떤 칸인지: 블라인드(지금 원단이 블라인드) / 속지 / 겉지
function finderCurtainKind(c) {
    const fab = FABRIC_DB.find(f => f.id === c.fabricId);
    if (fab && (fab.calcType === 'hebe' || fab.categoryType === '블라인드')) return 'blind';
    return (c.presetType ? c.presetType === 'sheer' : !!(fab && fab.categoryType === '속지')) ? 'sheer' : 'drape';
}
function openFabricFinder(roomId, curtainId) {
    finderTarget = { roomId, curtainId };
    // 넣을 칸이 속지면 속지만, 겉지면 겉지만(블라인드 칸이면 블라인드만) 먼저 보여 줌 (종류 칩을 누르면 풀림)
    const t = finderTargetCurtain();
    if (t) finderSel.cat = new Set([finderCurtainKind(t.c)]);
    finderRef = null; if (finderSort === 'sim' || finderSort === 'pair') finderSort = 'light';       // 비슷한 색·속지 짝을 찾던 중이었으면 풀고 시작
    finderView = 'grid';
    showFabricTab('find');
    showStaffView('fabric');
}
function clearFinderTarget() { finderTarget = null; renderFinder(); }

// 거름망: 같은 묶음 안에서 여러 개를 고르면 "또는", 묶음끼리는 "그리고". 고른 상태는 상담 하나 동안만 기억(새 상담·상담 불러오기 때 지움)
//  - 빛 가림(겉지) · 비침(속지) · 빛 가림(블라인드)은 한 묶음으로 셈: "완전암막 + 많이 비침"을 고르면 둘 다 나옴
const FINDER_TONE_DOTS = { warm: '#d8c3a0', neutral: '#c4bfb7', cool: '#a9b4bd', deep: '#4a3f36' };
const FINDER_HUE_DOTS = { gray: '#b5b3b0', beige: '#c9b79a', yellow: '#d6c98e', red: '#c9a2a0', green: '#a9c2b4', blue: '#9fadc2' };
const FINDER_KEYS = ['mood', 'cat', 'tone', 'light', 'hue', 'sat', 'tex', 'bo', 'dens', 'blight', 'width', 'price', 'book'];
// 정렬. 이 밖에 상담에 고객 화면의 질문(바닥·벽·분위기 등)을 거친 공간이 있으면 공간마다 "○○에 어울리는 순"(fit:공간번호)이 생김
const FINDER_SORTS = { light: '밝은 순', dark: '진한 순', book: '책자 순', vivid: '채도 높은 순', muted: '채도 낮은 순', price: '가격 낮은 순', sim: '고른 색과 비슷한 순' };
const FINDER_SIM_MAX = 16;     // 비슷한 색은 가까운 순으로 16개까지
let finderSel = {};
let finderSort = 'light';
let finderRef = null;          // "비슷한 색"의 기준 색 (카드 key)
let finderView = 'grid';       // 'grid'(색 카드) | 'map'(색 지도)
const FINDER_PICK_MAX = 6;     // 후보는 6개까지 (고객에게는 2~6개를 나란히 보여 줌)
let finderPicks = [];          // 후보로 별표한 색 (카드 key). 상담에 같이 저장됨
let finderMapPoints = [];      // 색 지도에 찍힌 점 (누른 자리에서 가장 가까운 점을 찾는 데 씀)
function resetFinderFilters(silent) {
    FINDER_KEYS.forEach(k => { finderSel[k] = new Set(); });
    finderSort = 'light'; finderRef = null;
    const q = document.getElementById('finderQuery'); if (q) q.value = '';
    if (!silent) renderFinder();
}
resetFinderFilters(true);
// 묶음마다 고를 수 있는 것: [값, 이름, 색 점]. 빛 가림·비침·책자(와 종류의 블라인드)는 지금 원단에 있는 값만 보여 줌
function finderOptions(all) {
    const has = (key, v) => all.some(e => e[key] === v);
    return {
        mood: Object.keys(MOOD_LABELS).map(k => [k, MOOD_LABELS[k]]),
        cat: [['drape', '겉지'], ['sheer', '속지'], ['blind', '블라인드']].filter(o => o[0] !== 'blind' || has('cat', 'blind')),
        tone: ['warm', 'neutral', 'cool', 'deep'].map(k => [k, TONE_LABELS[k], FINDER_TONE_DOTS[k]]),
        light: Object.keys(LIGHT_BAND_LABELS).map(k => [k, LIGHT_BAND_LABELS[k]]),
        hue: Object.keys(HUE_LABELS).map(k => [k, HUE_LABELS[k], FINDER_HUE_DOTS[k]]),
        sat: Object.keys(CHROMA_LABELS).map(k => [k, CHROMA_LABELS[k]]),
        tex: Object.keys(TEXTURE_LABELS).map(k => [k, TEXTURE_LABELS[k]]),
        bo: BLACKOUT_ORDER.filter(k => has('blackout', k)).map(k => [k, BLACKOUT_LABELS[k]]),
        dens: DENSITY_ORDER.filter(k => has('density', k)).map(k => [k, DENSITY_LABELS[k]]),
        blight: Object.keys(BLIND_LIGHT_LABELS).filter(k => has('blindLight', k)).map(k => [k, BLIND_LIGHT_LABELS[k]]),
        width: Object.keys(WIDTH_LABELS).map(k => [k, WIDTH_LABELS[k]]),
        price: Object.keys(PRICE_TIER_LABELS).map(k => [k, PRICE_TIER_LABELS[k]]),
        book: [...new Set(all.map(e => e.book))].sort((x, y) => x.localeCompare(y, 'ko')).map(b => [b, b])
    };
}
function finderChipClick(event) {
    const btn = event.target.closest('button[data-v]');
    const box = btn && btn.closest('.finder-chips');
    if (!box) return;
    const set = finderSel[box.dataset.k];
    if (set.has(btn.dataset.v)) set.delete(btn.dataset.v); else set.add(btn.dataset.v);
    renderFinder();
}
// 글자 검색: 띄어 쓴 낱말이 모두 맞아야 함. 숫자만 있는 낱말은 색 번호("블랑 03", "블랑03", "블랑 3" 모두 블랑 3번)
function finderQueryWords() {
    const q = ((document.getElementById('finderQuery') || {}).value || '').toLowerCase();
    const words = [];
    q.split(/\s+/).filter(Boolean).forEach(w => { const m = /^(\D+)(\d+)$/.exec(w); if (m) words.push(m[1], m[2]); else words.push(w); });
    return words;
}
function finderMatch(e, words) {
    const s = finderSel;
    if (s.mood.size && !s.mood.has(e.mood)) return false;
    if (s.cat.size && !s.cat.has(e.cat)) return false;
    if (s.tone.size && !s.tone.has(e.tone)) return false;
    if (s.light.size && !s.light.has(e.band)) return false;
    if (s.hue.size && !s.hue.has(e.hue)) return false;
    if (s.sat.size && !s.sat.has(e.sat)) return false;
    if (s.tex.size && !s.tex.has(e.texture)) return false;
    if ((s.bo.size || s.dens.size || s.blight.size) && !s.bo.has(e.blackout) && !s.dens.has(e.density) && !s.blight.has(e.blindLight)) return false;
    if (s.width.size && !s.width.has(e.wide)) return false;
    if (s.price.size && !s.price.has(e.priceTier)) return false;
    if (s.book.size && !s.book.has(e.book)) return false;
    if (words.length) {
        const hay = `${e.label}${e.fabName}${e.book}${e.fabricId}${e.blindKind ? BLIND_KIND_LABELS[e.blindKind] : ''}`.toLowerCase().replace(/\s+/g, '');
        const isNo = /^\d+$/.test(e.color);
        if (!words.every(w => (/^\d+$/.test(w) && isNo) ? parseInt(w, 10) === parseInt(e.color, 10) : hay.includes(w))) return false;
    }
    return true;
}
function renderFinder() {
    const out = document.getElementById('finderOut');
    if (!out) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const target = finderTargetCurtain();
    if (finderTarget && !target) finderTarget = null;        // 넣을 칸(공간·커튼)이 그사이 지워졌으면 풀어 줌
    const hint = document.getElementById('finderHint'), tbox = document.getElementById('finderTarget');
    if (hint) hint.hidden = !!target;
    if (tbox) {
        tbox.hidden = !target;
        tbox.innerHTML = target ? `<div><b>${esc(target.room.name)} · ${esc(target.c.label)}</b> 칸에 넣을 원단을 고르는 중<br><span>카드의 "이 공간에 넣기"를 누르면 원단과 색상 번호가 그 칸에 들어갑니다</span></div><button type="button" onclick="clearFinderTarget()">그만 고르기</button>` : '';
    }

    const all = finderEntries();
    // 후보 띠: 별표한 색을 누른 순서대로 (지금 원단 목록에 없는 색은 띠에서만 빠짐)
    const picks = finderPicks.map(k => all.find(e => e.key === k)).filter(Boolean);
    const pbox = document.getElementById('finderPicks');
    if (pbox) {
        pbox.hidden = !picks.length;
        pbox.innerHTML = !picks.length ? '' : `<b class="font-serif-kr">후보 ${picks.length}개</b><div class="finder-picks-list">`
            + picks.map(e => `<span class="finder-pick"><i${e.hex ? ` style="background:${e.hex}"` : ''}></i>${esc(finderPickName(e))}<button type="button" data-unstar="${esc(e.key)}" aria-label="후보에서 빼기">×</button></span>`).join('')
            + `</div><button type="button" class="staff-btn" onclick="clearFinderPicks()">모두 빼기</button><button type="button" onclick="openFinderShow()" class="bg-indigo-950 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs whitespace-nowrap">고객에게 보여주기</button>`;
    }
    // 거름망 칩 (고른 것은 짙게)
    const opts = finderOptions(all);
    document.querySelectorAll('.finder-chips').forEach(box => {
        const k = box.dataset.k;
        finderSel[k].forEach(v => { if (!opts[k].some(o => o[0] === v)) finderSel[k].delete(v); });      // 원단이 바뀌어 없어진 값은 풀어 줌
        box.innerHTML = opts[k].map(o => `<button type="button" class="finder-chip" data-v="${esc(o[0])}" aria-pressed="${finderSel[k].has(o[0])}">${o[2] ? `<i style="background:${o[2]}"></i>` : ''}${esc(o[1])}</button>`).join('');
        box.closest('.finder-fgroup').hidden = !opts[k].length;
    });
    // 비슷한 색(sim): 기준 색과 색 차이(ΔE)가 작은 순으로 16개. 거름망 가운데 종류(겉지·속지)만 지킴
    // 속지 짝(pair): 기준 겉지와 같은 톤이고 그보다 밝은 속지를 색 차이가 작은 순으로 (겉지가 딥이면 웜·뉴트럴 속지 모두). 색 값이 없는 속지는 톤만 맞춰 뒤에
    const refAny = finderRef ? all.find(e => e.key === finderRef) : null;
    const ref = (refAny && (finderSort === 'pair' ? refAny.cat === 'drape' : finderHasLab(refAny))) ? refAny : null;
    if (!ref) { finderRef = null; if (finderSort === 'sim' || finderSort === 'pair') finderSort = 'light'; }
    const sim = !!ref && finderSort === 'sim';
    const pair = !!ref && finderSort === 'pair';
    const pairTones = !pair ? null : (ref.tone === 'deep' ? ['warm', 'neutral'] : (ref.tone ? [ref.tone] : null));
    // "○○에 어울리는 순": 고객 화면의 질문을 거친 공간만 (직원 화면에서 그냥 추가한 공간은 바닥·벽 답이 없어 점수를 낼 수 없음). 넣을 칸의 공간이 먼저
    const fitRooms = rooms.filter(r => r.diagnosed).sort((x, y) => (target ? (y.id === target.room.id) - (x.id === target.room.id) : 0));
    const fitRoom = finderSort.startsWith('fit:') ? fitRooms.find(r => 'fit:' + r.id === finderSort) : null;
    if (finderSort.startsWith('fit:') && !fitRoom) finderSort = 'light';
    const byBook = (x, y) => `${x.book} ${x.fabName}`.localeCompare(`${y.book} ${y.fabName}`, 'ko') || colorSort({ name: x.color }, { name: y.color });
    // 값이 없는 색은 늘 뒤로 (그 안에서는 책자 · 원단 · 번호 순)
    const by = (key, dir) => (x, y) => (x[key] == null || y[key] == null) ? ((x[key] == null) - (y[key] == null)) || byBook(x, y) : (dir * (x[key] - y[key])) || byBook(x, y);
    let list;
    if (sim) {
        list = all.filter(e => e.key !== ref.key && finderHasLab(e) && (!finderSel.cat.size || finderSel.cat.has(e.cat)));
        list.forEach(e => { e.dist = colorDistance(e, ref); });
        list.sort((x, y) => x.dist - y.dist);
        list = list.slice(0, FINDER_SIM_MAX);
    } else if (pair) {
        const refLab = finderHasLab(ref);
        list = all.filter(e => e.cat === 'sheer' && (!pairTones || pairTones.includes(e.tone)) && !(ref.L != null && e.L != null && e.L <= ref.L));
        list.forEach(e => { e.dist = (refLab && finderHasLab(e)) ? colorDistance(e, ref) : null; });
        list.sort(by('dist', 1));
    } else {
        const words = finderQueryWords();
        list = all.filter(e => finderMatch(e, words));
        if (fitRoom) {
            // 기존 추천 점수 그대로: 색의 톤·밝기를 입힌 원단으로 calculateFabricMatchScore (점수가 같으면 밝은 색 먼저)
            list.forEach(e => { e.fit = calculateFabricMatchScore(e.view, fitRoom, e.fabric.categoryType); });
            list.sort((x, y) => (y.fit - x.fit) || by('L', -1)(x, y));
        } else if (finderSort === 'price') list.sort((x, y) => (x.priceRank - y.priceRank) || (x.price - y.price) || byBook(x, y));      // 단위가 다른 원단은 저마다의 묶음 안 자리로 견줌
        else list.sort(finderSort === 'dark' ? by('L', 1) : (finderSort === 'vivid' ? by('C', -1) : (finderSort === 'muted' ? by('C', 1) : (finderSort === 'book' ? byBook : by('L', -1)))));
    }
    const showPrice = finderSort === 'price' || finderSel.price.size > 0;       // 가격대 꼬리표는 가격으로 거르거나 줄 세울 때만 보임
    const sortSel = document.getElementById('finderSort');
    if (sortSel) {
        const sorts = Object.keys(FINDER_SORTS).filter(k => k !== 'sim').map(k => [k, FINDER_SORTS[k]]).concat(fitRooms.map(r => ['fit:' + r.id, `${r.name}에 어울리는 순`]), [['sim', FINDER_SORTS.sim]], pair ? [['pair', '겉지에 어울리는 속지']] : []);
        sortSel.innerHTML = sorts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
        sortSel.value = finderSort;
    }
    const pairRule = pairTones ? `${pairTones.map(t => TONE_LABELS[t]).join('·')} 톤 · 겉지보다 밝은 색` : '겉지보다 밝은 색';
    const cnt = document.getElementById('finderCount');
    if (cnt) cnt.innerHTML = sim ? `<b class="font-serif-kr">비슷한 색 ${list.length}개</b><small>거름망은 종류(겉지·속지)만 적용</small>`
        : (pair ? `<b class="font-serif-kr">어울리는 속지 ${list.length}개</b><small>${pairRule} · 거름망은 적용 안 함</small>`
            : `<b class="font-serif-kr">${list.length}색</b><small>${new Set(list.map(e => e.fabricId)).size}개 원단 · 전체 ${all.length}색</small>`);
    const rbox = document.getElementById('finderRef');
    if (rbox) {
        rbox.hidden = !ref;
        const refName = ref ? esc(`${ref.fabName} ${ref.no} ${ref.label}`.replace(/\s+/g, ' ').trim()) : '';
        rbox.innerHTML = !ref ? '' : `<i style="background:${ref.hex || 'transparent'}"></i><div>` + (pair
            ? `<b>${refName}</b> 에 어울리는 속지를 찾는 중<br><span>겉지와 같은 톤이고 더 밝은 속지 (색이 가까운 것부터, 색 값이 없는 속지는 톤만 맞춰 뒤에)</span>`
            : `<b>${refName}</b> 와 비슷한 색을 찾는 중<br><span>다른 책자에서 대신할 색을 찾을 때</span>`) + `</div><button type="button" onclick="clearFinderRef()">그만 찾기</button>`;
    }
    document.querySelectorAll('#finderViewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === finderView)));
    if (!all.length) { out.innerHTML = '<div class="finder-empty">보여 줄 원단이 없어요.<br>설정에서 단가표나 비공개 팩을 먼저 불러와 주세요.</div>'; return; }
    if (finderView === 'map') { out.innerHTML = finderMapHtml(all, new Set(list.map(e => e.key)), ref); return; }
    if (!list.length) {
        out.innerHTML = '<div class="finder-empty">' + (sim ? '비슷한 색을 찾지 못했어요.<br>종류(겉지·속지) 조건을 풀어 보세요.'
            : (pair ? '어울리는 속지를 찾지 못했어요.<br>분류 탭에서 속지의 톤이 정해져 있는지 확인해 보세요.' : '조건에 맞는 색이 없어요.<br>조건을 하나씩 빼 보세요.')) + '</div>';
        return;
    }

    // 예전 입력표로만 색을 넣은 기기: 색 값이 하나도 없으면 어떻게 채우는지 알려 줌
    const note = all.some(e => e.hex) ? '' : '<p class="finder-hint">아직 색 값이 들어 있지 않아요. 색상 탭의 "색상 입력표 불러오기"로 새 입력표(밝기·색상코드·붉은기·노란기 열)를 올리면 카드에 색이 보입니다.</p>';
    const chip = (text, unset) => `<span class="staff-chip${unset ? ' is-unset' : ''}">${text}</span>`;
    out.innerHTML = note + '<div class="finder-grid">' + list.map(e => {
        const tags = [
            e.tone ? chip(TONE_LABELS[e.tone]) : chip('톤 미정', true),
            e.mood ? chip(MOOD_LABELS[e.mood]) : chip('느낌 미정', true),
            e.cat === 'blind' ? (e.blindKind ? chip(BLIND_KIND_LABELS[e.blindKind]) : '') + chip(BLIND_LIGHT_LABELS[e.blindLight])
                : (e.cat === 'sheer' ? (e.density ? chip(DENSITY_LABELS[e.density]) : chip('비침 미정', true)) : (e.blackout ? chip(BLACKOUT_LABELS[e.blackout]) : chip('빛 가림 미정', true))),
            e.sat ? chip('채도 ' + CHROMA_LABELS[e.sat]) : chip('채도 미정', true),
            e.texture ? chip(TEXTURE_LABELS[e.texture]) : chip('질감 미정', true),
            e.specCm ? chip((e.wide === 'wide' ? '대폭 ' : '') + e.specCm + 'cm') : '',
            showPrice ? chip('가격 ' + PRICE_TIER_LABELS[e.priceTier]) : ''
        ].join('');
        const title = e.color ? (e.label || `${e.no}번`) : e.fabName;
        const light = (e.L != null ? `밝기 ${Math.round(e.L)}` : '밝기 미정') + (sim ? ` · ${colorDistanceWord(e.dist)}` : '') + (pair && e.dist == null ? ' · 톤만 맞춤' : '') + (fitRoom ? ` · 어울림 ${e.fit}` : '');
        const meta = e.color ? `${e.book} ${e.fabName} ${e.no} · ${light}` : `${e.book} · ${light}`;
        // 찾기 버튼 줄(비슷한 색 · 겉지는 어울리는 속지) + 넣기 버튼 줄
        const finds = (finderHasLab(e) ? `<button type="button" data-sim="${esc(e.key)}">비슷한 색</button>` : '') + (e.cat === 'drape' ? `<button type="button" data-pair="${esc(e.key)}">어울리는 속지</button>` : '');
        const acts = (finds ? `<div class="finder-acts">${finds}</div>` : '') + (target ? `<div class="finder-acts"><button type="button" data-pick="${esc(e.key)}">이 공간에 넣기</button></div>` : '');
        const photo = (e.color && __photoFound[e.fabricId + '__' + e.color]) || __photoFound[e.fabricId];      // 사진 탭에서 "사진 확인하기"를 한 뒤에만 사진이 보임
        const isCur = !!target && target.c.fabricId === e.fabricId && (target.c.colorName || '') === e.color;
        const starred = finderPicks.includes(e.key);
        return `<article class="finder-card${isCur ? ' is-current' : ''}">
            <div class="finder-sw${e.hex ? '' : ' is-none'}"${e.hex ? ` style="background:${e.hex}"` : ''}>${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : (e.hex ? '' : '<span>색 값 없음</span>')}<button type="button" class="finder-star${starred ? ' is-on' : ''}" data-star="${esc(e.key)}" aria-pressed="${starred}" aria-label="후보로 별표">${starred ? '★' : '☆'}</button></div>
            <div class="finder-body">
                <div class="finder-name">${esc(title)}</div>
                <div class="finder-meta">${esc(meta)}${isCur ? ' · 지금 이 칸' : ''}</div>
                <div class="finder-tags">${tags}</div>
            </div>
            ${acts}
        </article>`;
    }).join('') + '</div>';
}
// 정렬 바꾸기: "고른 색과 비슷한 순"은 카드의 "비슷한 색"을 누른 뒤에만. 다른 정렬을 고르면 비슷한 색 찾기는 끝남
function finderSortChange(value) {
    if (value === 'sim' && (!finderRef || finderSort === 'pair')) showToast('카드의 "비슷한 색"을 먼저 눌러 주세요.', 'info');
    else if (value !== 'pair') { finderSort = (FINDER_SORTS[value] || String(value).startsWith('fit:')) ? value : 'light'; if (finderSort !== 'sim') finderRef = null; }
    renderFinder();
}
function clearFinderRef() { finderRef = null; finderSort = 'light'; renderFinder(); }

// ---- 후보 모아 보기: 카드의 별표(☆)로 후보를 모으고, "고객에게 보여주기"로 가격·원가 없이 나란히 보여 줌 ----
// 원단 이름에서 괄호(암막률 등)는 떼고 보여 줌
function finderPlainFabName(e) { return String(e.fabName || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); }
function finderPickName(e) { return e.color ? `${e.label ? e.label + ' · ' : ''}${finderPlainFabName(e)} ${e.no}` : finderPlainFabName(e); }
function clearFinderPicks() { finderPicks = []; renderFinder(); }
// 고객에게 보여주기: 직원 화면을 통째로 덮는 화면에 큰 색 칸(사진이 있으면 사진) · 색 이름 · 느낌만 나란히 (2~6개)
//  - 보여 주는 동안 직원 화면은 잠근 것으로 침 → 닫으면 PIN을 넣어야 하던 화면으로 돌아옴 (자동 잠금과 같은 규칙)
function openFinderShow() {
    const all = finderEntries();
    const picks = finderPicks.map(k => all.find(e => e.key === k)).filter(Boolean).slice(0, FINDER_PICK_MAX);
    const box = document.getElementById('finderShow'), canvas = document.getElementById('finderShowCanvas');
    if (!box || !canvas || !window.concierge) return;
    if (picks.length < 2) { showToast('후보를 2개 이상 별표해 주세요. (6개까지)', 'info'); return; }
    canvas.style.setProperty('--items-count', picks.length);
    canvas.innerHTML = picks.map(e => {
        const name = (e.label || finderPlainFabName(e)).replace(/[<>&"]/g, '');
        const mood = e.mood ? MOOD_LABELS[e.mood] : '';
        // 색 값도 사진도 없는 원단은 지어낸 색을 보여 주지 않음
        return window.concierge.bookmarkCard(name, e.hex ? mood : [mood, '샘플북으로 보여 드릴게요'].filter(Boolean).join(' · '), '', e.hex || 'var(--brand-panel)', function() {}, '');
    }).join('');
    Array.from(canvas.children).forEach((card, i) => {
        const e = picks[i], img = document.createElement('img');
        card.style.cursor = 'default';
        img.className = 'fabric-photo'; img.alt = '';
        img.setAttribute('data-id', e.fabricId); img.setAttribute('data-color', e.color); img.setAttribute('data-i', '0');
        img.style.visibility = 'hidden';                         // 사진을 다 받은 뒤에만 보임 (찾는 동안 깨진 그림 표시가 안 보이게)
        img.onload = function() { img.style.visibility = ''; };
        img.onerror = function() { photoFallback(img); };       // 사진이 없으면 색 칸 그대로
        img.src = fabricPhotoUrls(e.fabricId, e.color)[0];
        const bg = card.querySelector('.bookmark-bg');
        if (bg) bg.after(img);
        if (i === picks.length - 1) card.insertAdjacentHTML('beforeend', '<div class="card-brand">Re<i class="logo-dot">.</i>dam</div>');
    });
    box.classList.remove('hidden');
    document.documentElement.style.overflow = 'hidden';         // 뒤의 직원 화면이 밀리지 않게
    if (appMode === 'staff') { staffLocked = true; setStaffLockedUi(true); }
}
function closeFinderShow() {
    const box = document.getElementById('finderShow');
    if (box) box.classList.add('hidden');
    document.documentElement.style.overflow = '';
    if (appMode === 'staff' && staffLocked) RedamAuth.requestUnlock();
}
function setFinderView(view) { finderView = view === 'map' ? 'map' : 'grid'; renderFinder(); }
// 색 지도: 가로 = 노란기 b(왼쪽 쿨 · 오른쪽 웜), 세로 = 밝기 L(위가 밝음). 지금 조건에 맞는 색은 진하고 크게, 나머지는 흐리게
// 색 값(밝기·노란기)이 없는 색은 지도에 나오지 않음. 노란기가 눈금 밖(-12 미만 · 30 초과)인 색은 가장자리에 찍힘
function finderMapHtml(all, on, ref) {
    const W = 720, H = 400, P = { l: 44, r: 16, t: 20, b: 40 };
    const x = b => P.l + (Math.max(-12, Math.min(30, b)) + 12) / 42 * (W - P.l - P.r);
    const y = L => P.t + (100 - L) / 90 * (H - P.t - P.b);
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let g = '';
    [20, 40, 60, 80].forEach(L => { g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(L).toFixed(1)}" y2="${y(L).toFixed(1)}"/><text x="${P.l - 8}" y="${(y(L) + 4).toFixed(1)}" text-anchor="end">${L}</text>`; });
    [-8, 0, 8, 16, 24].forEach(b => { g += `<line x1="${x(b).toFixed(1)}" x2="${x(b).toFixed(1)}" y1="${P.t}" y2="${H - P.b}"/>`; });
    g += `<text x="${P.l}" y="${H - 12}">← 푸른기 (쿨)</text><text x="${x(0).toFixed(1)}" y="${H - 12}" text-anchor="middle">뉴트럴</text><text x="${W - P.r}" y="${H - 12}" text-anchor="end">노란기 (웜) →</text>`;
    g += `<text x="${P.l - 8}" y="${P.t + 4}" text-anchor="end">밝음</text>`;
    const pts = all.filter(e => e.L != null && e.b != null);
    finderMapPoints = pts.map(e => ({ key: e.key, x: x(e.b), y: y(e.L), hit: on.has(e.key) }));
    const isRef = e => !!ref && ref.key === e.key;
    const rank = e => isRef(e) ? 2 : (on.has(e.key) ? 1 : 0);        // 흐린 점 → 조건에 맞는 점 → 기준 색 순으로 위에 그림
    const dots = pts.slice().sort((p, q) => rank(p) - rank(q)).map(e => {
        const r = rank(e);
        return `<circle cx="${x(e.b).toFixed(1)}" cy="${y(e.L).toFixed(1)}" r="${r === 2 ? 10 : (r === 1 ? 7.5 : 5)}" fill="${e.hex || '#cccccc'}" opacity="${r ? 1 : 0.22}" stroke="${r === 2 ? 'var(--brand-accent)' : 'var(--brand-dark)'}" stroke-opacity="${r === 2 ? 1 : 0.35}" stroke-width="${r === 2 ? 3 : 1}"><title>${esc(`${e.fabName} ${e.no} ${e.label}`.replace(/\s+/g, ' ').trim())} · 밝기 ${Math.round(e.L)}</title></circle>`;
    }).join('');
    const missing = all.length - pts.length;
    return `<div class="finder-map"><svg data-map viewBox="0 0 ${W} ${H}" role="img" aria-label="원단 색을 밝기와 웜·쿨로 펼친 지도">${g}${dots}</svg></div>
        <p class="finder-map-hint">위로 갈수록 밝고, 오른쪽으로 갈수록 노란기(웜)가 많아요. 진한 점이 지금 조건에 맞는 색이고, 점을 누르면 그 색과 비슷한 색을 찾습니다. 점이 비어 있는 곳은 갖고 있는 책자에 없는 색이라, 새 책자를 고를 때도 참고가 됩니다.${missing ? ` (색 값이 없는 ${missing}색은 지도에 나오지 않아요.)` : ''}</p>`;
}
// 지도에서 누른 자리와 가장 가까운 점 (손가락으로 눌러도 잡히게). 조건에 맞는 진한 점이 가까이 있으면 그 점이 먼저
function finderMapPick(event, svg) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint(); pt.x = event.clientX; pt.y = event.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const nearest = (list, max) => list.reduce((best, m) => { const d = Math.hypot(m.x - p.x, m.y - p.y); return (d < max && (!best || d < best.d)) ? { key: m.key, d } : best; }, null);
    const hit = nearest(finderMapPoints.filter(m => m.hit), 12) || nearest(finderMapPoints, 18);
    return hit ? hit.key : null;
}
// 카드의 버튼: "비슷한 색" = 그 색과 가까운 색 찾기 / "이 공간에 넣기" = 넣을 칸의 원단과 색상 번호를 바꾸고 상담 화면으로 돌아감
function finderClick(event) {
    const starBtn = event.target.closest('button[data-star], button[data-unstar]');
    if (starBtn) {
        const key = starBtn.dataset.star || starBtn.dataset.unstar;
        const all = finderEntries();
        if (finderPicks.includes(key)) finderPicks = finderPicks.filter(k => k !== key);
        else if (finderPicks.filter(k => all.some(e => e.key === k)).length >= FINDER_PICK_MAX) showToast(`후보는 ${FINDER_PICK_MAX}개까지예요. 하나를 빼고 다시 눌러 주세요.`, 'info');
        else finderPicks.push(key);
        renderFinder();
        return;
    }
    const pairBtn = event.target.closest('button[data-pair]');
    if (pairBtn) {
        finderRef = pairBtn.dataset.pair; finderSort = 'pair'; finderView = 'grid';
        // 넣을 칸이 겉지 칸이면 같은 공간의 속지 칸으로 옮김. 속지 칸이 없으면 넣을 칸을 풂 (겉지 칸에 속지가 들어가지 않게)
        const t = finderTargetCurtain();
        if (t && finderCurtainKind(t.c) !== 'sheer') {
            const s = t.room.curtains.find(c => finderCurtainKind(c) === 'sheer');
            finderTarget = s ? { roomId: t.room.id, curtainId: s.id } : null;
        }
        renderFinder();
        const pane = document.getElementById('fabricTab-find');
        if (pane) pane.scrollIntoView({ block: 'start' });
        return;
    }
    const svg = event.target.closest('svg[data-map]');
    const simBtn = event.target.closest('button[data-sim]');
    const simKey = svg ? finderMapPick(event, svg) : (simBtn ? simBtn.dataset.sim : null);
    if (svg || simBtn) {
        if (!simKey) return;
        finderRef = simKey; finderSort = 'sim'; finderView = 'grid';      // 지도의 점을 눌러도 카드 보기로 돌아와 비슷한 색을 보여 줌
        renderFinder();
        const pane = document.getElementById('fabricTab-find');
        if (pane) pane.scrollIntoView({ block: 'start' });
        return;
    }
    const btn = event.target.closest('button[data-pick]');
    if (!btn) return;
    const t = finderTargetCurtain();
    const e = finderEntries().find(x => x.key === btn.dataset.pick);
    finderTarget = null;
    if (!t || !e) { renderFinder(); showToast('넣을 칸을 찾지 못했어요. 상담 화면에서 "찾기"를 다시 눌러 주세요.', 'error'); return; }
    collapsedRooms.delete(t.room.id);
    updateCurtainData(t.room.id, t.c.id, 'fabricId', e.fabricId);      // 원단이 바뀌면 색상 번호가 비워지므로, 색은 그다음에 넣음
    t.c.colorName = e.color;
    renderRooms();
    calculateAll();
    showStaffView('consult');
    const sub = document.getElementById(`curtainSub_${t.c.id}`);
    const card = sub && sub.closest('.staff-curtain');
    if (card) card.scrollIntoView({ block: 'center' });
    showToast(`${e.fabName}${colorSuffix(e.color, e.fabricId)} → ${t.room.name} · ${t.c.label} 칸에 넣었어요.`);
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
    const statusText = document.getElementById('marginAccordionStatus');
    const badge = document.getElementById('resMarginRateBadge');
    if (!content) return;

    const shouldOpen = forceOpen !== undefined ? forceOpen : content.classList.contains('hidden');
    if (shouldOpen) {
        content.classList.remove('hidden');
        if (statusText) statusText.textContent = '가리기';
        if (badge) badge.classList.remove('hidden');
    } else {
        content.classList.add('hidden');
        if (statusText) statusText.textContent = '보기';
        if (badge) badge.classList.add('hidden');
    }
}

function syncCustomerData() {
    calculateAll();
    const custName = (document.getElementById('custName') ? document.getElementById('custName').value : "").trim();
    const expressCust = document.getElementById('expressCustName');

    if (expressCust && expressCust.value !== custName) expressCust.value = custName;
    renderSideCust();
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
    const room = rooms.find(r => r.id === roomId);
    if (!room || !confirm(`'${room.name}' 공간을 삭제할까요?`)) return;
    rooms = rooms.filter(r => r.id !== roomId);
    collapsedRooms.delete(roomId);
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
    const optEl = document.getElementById(`curtainOpt_${c.id}`);
    if (optEl) optEl.textContent = curtainOptionSummary(c);
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

// 상담 화면의 공간 카드 접기: 접으면 공간 이름 · 종류 · 소계만 보임 (공간이 많을 때 전체를 한눈에). 화면에서만 쓰는 상태라 저장하지 않음
const collapsedRooms = new Set();
function toggleRoomCollapse(roomId) {
    if (collapsedRooms.has(roomId)) collapsedRooms.delete(roomId); else collapsedRooms.add(roomId);
    renderRooms();
    calculateAll();
}
function setAllRoomsCollapsed(on) {
    collapsedRooms.clear(); openCurtainDetails.clear();
    if (on) rooms.forEach(r => collapsedRooms.add(r.id));
    renderRooms();
    calculateAll();
}
// 커튼 카드의 "세부 옵션"(가공 형태·설치 기구·바닥 간격·부자재 품명·자당 단가·형상기억·리드밴드·호텔핏): 자주 안 바꾸는 칸이라 접어 둠
// 펼쳐 둔 커튼은 화면을 다시 그려도 펼쳐진 채로 두고, 접힌 줄에는 지금 값(설치 기구 + 추가한 옵션)을 짧게 보여 줌
const openCurtainDetails = new Set();
function setCurtainDetailsOpen(curtainId, open) { if (open) openCurtainDetails.add(curtainId); else openCurtainDetails.delete(curtainId); }
// 원단 찾기: 원단 칸에 글자를 치면 책자·이름으로 좁혀진 목록이 나옴 (띄어 쓴 낱말이 모두 들어 있는 원단만. 예: "데미안 몽", "암막")
function fabricSearchLabel(f) { return f ? `${f.book} ${f.name}` : ''; }
function fabricSearchHits(query) {
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    return FABRIC_DB.filter(f => { const hay = `${f.book} ${f.name} ${f.id}`.toLowerCase(); return words.every(w => hay.includes(w)); });
}
function renderFabricSearch(input, showAll) {
    const list = input.nextElementSibling;
    if (!list) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const hits = fabricSearchHits(showAll ? '' : input.value);
    list.innerHTML = hits.length ? hits.map(f => {
        const spec = f.calcType === 'hebe' ? '헤베' : (f.calcType === 'width' ? `폭당 ${f.specCm}cm` : `Y당 ${f.specCm}cm`);
        return `<button type="button" data-id="${esc(f.id)}" class="${f.id === input.dataset.fabricId ? 'is-current' : ''}">${esc(f.book)} ${esc(f.name)}<small>${esc(f.categoryType || '')} · ${spec} · ${(f.price || 0).toLocaleString()}원/${esc(f.unit)}</small></button>`;
    }).join('') : '<p>찾는 원단이 없어요</p>';
    list.hidden = false;
    if (showAll) { const cur = list.querySelector('.is-current'); if (cur) list.scrollTop = cur.offsetTop - 8; }
}
function pickFabricFromSearch(event, roomId, curtainId) {
    const btn = event.target.closest('button[data-id]');
    if (btn) updateCurtainData(roomId, curtainId, 'fabricId', btn.dataset.id);        // 화면을 다시 그리면서 목록도 닫힘
}
function fabricSearchKey(event, input) {
    if (event.key === 'Enter') { const first = input.nextElementSibling && input.nextElementSibling.querySelector('button[data-id]'); if (first) first.click(); }
    else if (event.key === 'Escape') input.blur();
}
// 칸을 벗어나면 목록을 닫고, 고르지 않았으면 지금 원단 이름으로 되돌림 (목록을 누르는 동안에는 닫히지 않게 잠깐 기다림)
function closeFabricSearch(input) {
    setTimeout(() => {
        if (!input.isConnected || document.activeElement === input) return;
        if (input.nextElementSibling) input.nextElementSibling.hidden = true;
        input.value = fabricSearchLabel(FABRIC_DB.find(f => f.id === input.dataset.fabricId));
    }, 200);
}
const INSTALL_TYPE_LABELS = { rail: '기본 레일', rail_2line: '패널 레일 (2줄)', rail_3line: '패널 레일 (3줄)', rod35: '35파이 봉', rod25: '25파이 봉' };
function curtainOptionSummary(c) {
    return '· ' + [INSTALL_TYPE_LABELS[c.installType] || c.hwName || '', c.shapeFee > 0 ? '형상기억' : '', c.leadBand ? '리드밴드' : '', c.hotelFit ? '호텔핏' : ''].filter(Boolean).join(', ');
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

    const escText = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const finderHasBlind = finderEntries().some(e => e.cat === 'blind');      // 블라인드 칸의 "찾기" 버튼은 찾기 화면에 블라인드가 있을 때만 (색 정보가 들어온 블라인드만 나옴)

    if (rooms.length > 1) {
        const allCollapsed = rooms.every(r => collapsedRooms.has(r.id));
        const bar = document.createElement('div');
        bar.className = "flex justify-end";
        bar.innerHTML = `<button type="button" onclick="setAllRoomsCollapsed(${!allCollapsed})" class="text-xs font-bold text-slate-500 hover:text-slate-800 underline underline-offset-4 px-1">${allCollapsed ? '모두 펼치기' : '모두 접기'}</button>`;
        container.appendChild(bar);
    }

    rooms.forEach((room, roomIndex) => {
        const roomCard = document.createElement('div');

        if (collapsedRooms.has(room.id)) {
            // 접힌 공간: 한 줄 전체가 "펼치기" 버튼
            roomCard.className = "staff-room w-full min-w-0";
            roomCard.innerHTML = `
                <button type="button" onclick="toggleRoomCollapse(${room.id})" aria-expanded="false" class="w-full flex items-center gap-2.5 p-3.5 sm:px-5 sm:py-4 text-left rounded-2xl hover:bg-slate-50 transition">
                    <span class="staff-num">${roomIndex + 1}</span>
                    <span class="staff-room-name font-serif-kr truncate flex-shrink-0 max-w-[40%]">${escText(room.name)}</span>
                    <span class="text-[11px] sm:text-xs text-slate-500 truncate flex-1 min-w-0">${escText(room.curtains.map(c => c.label).join(' + '))}</span>
                    <span class="staff-amt whitespace-nowrap flex-shrink-0" id="roomSubtotal_${room.id}">0원</span>
                    <span class="whitespace-nowrap flex-shrink-0 text-xs font-bold text-slate-500 flex items-center gap-1">펼치기 <i class="fa-solid fa-chevron-down text-[10px]"></i></span>
                </button>
            `;
            container.appendChild(roomCard);
            return;
        }

        roomCard.className = "staff-room p-3.5 sm:p-5 space-y-3 sm:space-y-4 relative w-full min-w-0";

        let curtainsHtml = "";
        room.curtains.forEach((c, curtainIndex) => {
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
                <div class="staff-curtain space-y-2.5 sm:space-y-3 relative w-full min-w-0">
                    <div class="flex justify-between items-center gap-2">
                        <div class="flex items-center gap-2 flex-1 min-w-0">
                            <span class="staff-num sm">${curtainIndex + 1}</span>
                            <input type="text" value="${c.label}" onchange="updateCurtainData(${room.id}, ${c.id}, 'label', this.value)" class="staff-curtain-name outline-none border rounded px-1 py-0.5 w-full min-w-0">
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
                                ${!isBlind ? `<span class="staff-chip">제작:${actualCurtainHeight}</span>` : ''}
                            </div>
                            <input type="number" value="${c.height}" oninput="updateCurtainData(${room.id}, ${c.id}, 'height', parseFloat(this.value)||0)" class="w-full h-8 px-2 py-1 border rounded-lg text-xs font-bold text-indigo-950 bg-white outline-none focus:ring-1 focus:ring-amber-500 min-w-0 box-border">
                        </div>
                        <div class="min-w-0 flex flex-col justify-end">
                            ${isBlind ? `
                                <label class="block text-[10px] font-bold text-amber-800 mb-1 truncate">적용 면적</label>
                                <div class="staff-static w-full px-1.5 border rounded-lg text-center flex items-center justify-center truncate box-border">
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

                    <div class="min-w-0">
                        <div class="flex justify-between items-center mb-0.5">
                            <label class="block text-[10px] font-bold text-slate-500">원단 (책자·이름으로 찾기)</label>
                            <span class="staff-chip">
                                ${curFab ? (isBlind ? "블라인드" : (curFab.calcType === "width" ? `폭당 ${curFab.specCm}cm` : `Y당 ${curFab.specCm}cm`)) : ""}
                            </span>
                        </div>
                        <div class="flex items-stretch gap-1.5">
                            <div class="fabric-combo flex-1 min-w-0">
                                <input type="text" value="${escText(fabricSearchLabel(curFab))}" data-fabric-id="${curFab ? escText(curFab.id) : ''}" autocomplete="off" placeholder="예: 데미안 몽크, 암막" onfocus="this.select(); renderFabricSearch(this, true)" oninput="renderFabricSearch(this)" onkeydown="fabricSearchKey(event, this)" onblur="closeFabricSearch(this)" class="w-full px-2 py-1 border border-slate-300 rounded-lg text-xs font-semibold text-indigo-950 bg-white outline-none min-w-0">
                                <div class="fabric-combo-list custom-scrollbar" hidden onmousedown="event.preventDefault()" onclick="pickFabricFromSearch(event, ${room.id}, ${c.id})"></div>
                            </div>
                            ${isBlind && !finderHasBlind ? '' : `<button type="button" onclick="openFabricFinder(${room.id}, ${c.id})" title="색으로 원단 찾기" class="staff-btn whitespace-nowrap flex-shrink-0">찾기</button>`}
                        </div>
                        ${colorSelect}
                    </div>

                    ${isBlind ? '' : `
                    <details class="curtain-more" ${openCurtainDetails.has(c.id) ? 'open' : ''} ontoggle="setCurtainDetailsOpen(${c.id}, this.open)">
                        <summary>세부 옵션 <span id="curtainOpt_${c.id}">${escText(curtainOptionSummary(c))}</span></summary>
                        <div class="space-y-2.5 sm:space-y-3 pt-2.5">
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2">
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

                            <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
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
                                    <button type="button" ${isBlind ? 'disabled' : ''} onclick="toggleHotelFit(${room.id}, ${c.id})" class="staff-toggle w-full border rounded-lg transition flex items-center justify-center gap-1 ${c.hotelFit ? 'is-on' : ''}">
                                        <span class="w-3 text-center">${c.hotelFit ? '✓' : '+'}</span>
                                        <span>호텔핏</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </details>
                    `}

                    <div class="staff-curtain-foot">
                        <div class="truncate flex-1 min-w-0">
                            산출수량: <strong id="curtainQty_${c.id}">-</strong>
                        </div>
                        <div class="whitespace-nowrap flex-shrink-0 text-right">
                            <span>판매가</span>
                            <strong class="staff-amt ml-1" id="curtainSub_${c.id}">0원</strong>
                        </div>
                    </div>
                </div>
            `;
        });

        roomCard.innerHTML = `
            <div class="staff-room-head">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="staff-num">${roomIndex + 1}</span>
                    <input type="text" value="${room.name}" onchange="updateRoomName(${room.id}, this.value)" class="staff-room-name font-serif-kr outline-none border rounded px-1.5 py-0.5 w-full min-w-0">
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button onclick="addCurtainToRoom(${room.id})" class="staff-btn whitespace-nowrap flex items-center gap-1">
                        + 추가
                    </button>
                    <button onclick="removeRoom(${room.id})" class="whitespace-nowrap text-xs text-rose-500 hover:text-rose-700 font-bold px-2 py-1.5 rounded-xl hover:bg-rose-50 transition flex items-center gap-1">
                        삭제
                    </button>
                    <button type="button" onclick="toggleRoomCollapse(${room.id})" aria-expanded="true" class="whitespace-nowrap text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1.5 rounded-xl hover:bg-slate-100 transition flex items-center gap-1">
                        접기 <i class="fa-solid fa-chevron-up text-[10px]"></i>
                    </button>
                </div>
            </div>
            <div class="staff-curtains">${curtainsHtml}</div>
            <div class="staff-room-sum">
                <span class="truncate mr-2">${room.name} 소계</span>
                <span class="staff-amt font-serif-kr whitespace-nowrap flex-shrink-0" id="roomSubtotal_${room.id}">0원</span>
            </div>
        `;
        container.appendChild(roomCard);
    });
}

// ==============================================================
// 직원 화면: 원단 DB 표 / 부가 기능
// ==============================================================


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

// 직원 화면의 "견적서" 창: 저장·인쇄되는 이미지를 그대로 미리 보여 줌 (고객 화면 제안서와 같은 디자인)
async function openTicketModal() {
    calculateAll();
    const box = document.getElementById('ticketPreview');
    document.getElementById('ticketModal').classList.remove('hidden');
    if (!box) return;
    box.innerHTML = '<p class="text-xs text-stone-500 py-10 text-center">견적서 만드는 중...</p>';
    try {
        const { canvases } = await makeTicketBlobs({ type: 'image/jpeg' });
        box.innerHTML = '';
        canvases.forEach(c => {
            const img = document.createElement('img');
            img.alt = '견적서 미리보기';
            img.src = c.toDataURL('image/jpeg', 0.9);
            img.style.cssText = 'display:block; width:100%; height:auto; border:1px solid #e5dcd0; margin-bottom:8px;';
            box.appendChild(img);
        });
    } catch (err) {
        console.error(err);
        box.innerHTML = '<p class="text-xs text-rose-600 py-10 text-center">미리보기를 만들지 못했습니다.</p>';
    }
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
const TICKET_PRIVACY_LABELS = { open: '바깥 시선 괜찮음', some: '바깥 시선 조금 신경', high: '바깥 시선 많이 신경' };
const TICKET_FEEL_LABELS = { smooth: '속지는 깔끔·매끈하게', textured: '속지는 결이 살아 있게' };
// 공간 진단 요약 한 줄 (고객 화면에서 진단을 거친 공간만)
function ticketRoomSummary(r) {
    if (!r || !r.diagnosed) return '';
    const parts = [];
    if (TONE_LABELS[r.floorTone]) parts.push(`바닥 ${TONE_LABELS[r.floorTone]} 톤`);
    if (TONE_LABELS[r.wallTone]) parts.push(`벽 ${TONE_LABELS[r.wallTone]} 톤`);
    if (TICKET_LIGHT_LABELS[r.lightLevel]) parts.push(TICKET_LIGHT_LABELS[r.lightLevel]);
    if (TICKET_BLOCK_LABELS[r.lightBlock]) parts.push(TICKET_BLOCK_LABELS[r.lightBlock]);
    if (TICKET_PRIVACY_LABELS[r.privacy]) parts.push(TICKET_PRIVACY_LABELS[r.privacy]);
    if (TICKET_FEEL_LABELS[r.sheerFeel]) parts.push(TICKET_FEEL_LABELS[r.sheerFeel]);
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
// 고객에게 보여 줄 원단 이름: 괄호(폭·암막률·단가 등)·가격·앞의 책자 이름을 빼고, 색 표시(예: 3번 (그레이지))는 붙임
function ticketFabricName(c, calc) {
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return (calc && calc.fabName) || c.label || '원단';
    let n = String(f.name || '').replace(/\([^)]*\)/g, ' ').replace(/[0-9,]+\s*원/g, ' ').replace(/\s+/g, ' ').trim();
    const book = String(f.book || '').trim();
    if (book && n.startsWith(book + ' ')) n = n.slice(book.length).trim();
    return (n || String(f.name || '원단')) + colorSuffix(c.colorName, f.id);
}
// 품목 종류 (속지 / 겉지 / 블라인드)
function ticketKindLabel(c) {
    return c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : (c.presetType === 'drape' ? '겉지' : '커튼'));
}
// 사진이 없을 때 원단 칸을 채우는 색: 고른 색(없으면 원단)의 톤으로 짐작. 제안서·견적서·첫 화면 공간 칸이 함께 씀
const FABRIC_TONE_FILL = { warm: '#dcc3a4', cool: '#b9c4cb', neutral: '#d3cdc3', deep: '#7a695c' };
function fabricToneFill(fabricId, colorName) {
    const f = FABRIC_DB.find(x => x.id === fabricId);
    if (!f) return '#d9cdbb';
    const col = colorName ? getFabricColors(f.id).find(x => x.name === normalizeColorName(colorName)) : null;
    return FABRIC_TONE_FILL[(col && col.tone) || f.tone] || '#d9cdbb';
}

// 견적서 하단 안내 문구 (예: 제작 약 7일 · 시공 약 2시간). 직원 화면에서 입력, 이 브라우저에 저장
const TICKET_NOTE_KEY = 'redam_ticket_note_v1';
function loadTicketNote() { try { return (localStorage.getItem(TICKET_NOTE_KEY) || '').trim(); } catch (e) { return ''; } }
function saveTicketNote(v) { try { localStorage.setItem(TICKET_NOTE_KEY, String(v || '').trim()); } catch (e) {} }
// 견적서 아래쪽 글: 결제 조건 / 맞춤 제작 안내 / 공급자 정보 (여러 줄). 사업자 정보가 들어가므로 코드에 적지 않고 이 기기에만 저장 (비공개 팩으로 옮김)
const TICKET_TEXT_KEYS = { pay: 'redam_ticket_pay_v1', custom: 'redam_ticket_custom_v1', supplier: 'redam_ticket_supplier_v1' };
const TICKET_TEXT_INPUTS = { pay: 'ticketPayInput', custom: 'ticketCustomInput', supplier: 'ticketSupplierInput' };
function loadTicketText(k) { try { return (localStorage.getItem(TICKET_TEXT_KEYS[k]) || '').trim(); } catch (e) { return ''; } }
function saveTicketText(k, v) { if (!TICKET_TEXT_KEYS[k]) return; try { localStorage.setItem(TICKET_TEXT_KEYS[k], String(v || '').trim()); } catch (e) {} }
function initTicketNoteInput() {
    const el = document.getElementById('ticketNoteInput'); if (el) el.value = loadTicketNote();
    Object.keys(TICKET_TEXT_INPUTS).forEach(k => { const t = document.getElementById(TICKET_TEXT_INPUTS[k]); if (t) t.value = loadTicketText(k); });
    const fee = document.getElementById('defaultInstallFeeInput'); if (fee) fee.value = loadDefaultInstallFee();
}
// 비공개 팩에 함께 담는 견적서 글 (불러올 때는 팩에 적힌 것만 덮어씀 — 비어 있으면 이 기기 것을 그대로 둠)
function ticketTextsForPack() {
    const fee = storedDefaultInstallFee();          // 기본 시공비는 이 기기에서 정한 적이 있을 때만 팩에 담음
    return { note: loadTicketNote(), pay: loadTicketText('pay'), custom: loadTicketText('custom'), supplier: loadTicketText('supplier'), fee: fee === null ? undefined : fee };
}
function applyTicketTextsFromPack(t) {
    if (!t || typeof t !== 'object') return;
    if (typeof t.note === 'string' && t.note.trim()) saveTicketNote(t.note);
    if (typeof t.fee === 'number' && Number.isFinite(t.fee) && t.fee >= 0) saveDefaultInstallFee(t.fee);
    Object.keys(TICKET_TEXT_KEYS).forEach(k => { if (typeof t[k] === 'string' && t[k].trim()) saveTicketText(k, t[k]); });
    initTicketNoteInput();
}

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
        recipient: custName ? `${custName} 고객님 귀하` : '고객님 귀하',
        date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
        rooms: rooms.map(r => {
            const items = r.curtains.map(c => {
                const calc = c.calc || {};
                const opts = [];
                if (c.shapeFee > 0) opts.push('형상기억');
                if (c.leadBand) opts.push('리드밴드');
                if (c.hotelFit) opts.push('호텔핏');
                return {
                    label: c.label, kind: ticketKindLabel(c), name: ticketFabricName(c, calc), meta: opts.join(' · '),      // 원단 이름 옆 작은 글자: 추가한 옵션만 (책자 이름은 넣지 않음)
                    fill: fabricToneFill(c.fabricId, c.colorName), opts, price: calc.curtainSubtotal || 0,
                    reason: ticketItemReason(r, c), fabricId: c.fabricId || '', colorName: c.colorName || '',
                    size: (Number(c.width) > 0 && Number(c.height) > 0) ? `${Number(c.width)} × ${Number(c.height)}cm` : '',      // 제작 크기 (넓이 × 높이)
                    photoKey: (c.fabricId || '') + '__' + (c.colorName || '')
                };
            });
            return { name: r.name, total: items.reduce((a, i) => a + i.price, 0), items, summary: '' };      // 공간 설명 줄은 뺌 (제안서가 길어져서)
        }),
        install: globalInstallFee,
        total: document.getElementById('totalGrandPrice').textContent,
        note: loadTicketNote(),
        pay: loadTicketText('pay'), custom: loadTicketText('custom'), supplier: loadTicketText('supplier'),
        photos: {}
    };
}

// 견적서 디자인 = 문서 한 장: Re.dam · "견적서" 제목 · 받는 분 · 날짜 → 품목 표(품목 / 크기 / 금액, 공간별 묶음) → 시공비 → 합계 → 안내 문구
// 고객 화면 "최종 제안"이 이 이미지를 종이 한 장처럼 그대로 보여 줌. 톤은 고객 화면과 같음(명조 글자, 굵은 선·가는 선, 각진 원단 칸. 둥근 카드·알약 태그 없음)
function drawTicket(ctx, data, W) {
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const DARK = '#2b221a', MUTED = '#6f5f4f', SOFT = '#8a7a6a', LINE = '#e5dcd0';
    const PAD = 96, CX = PAD, CW = W - PAD * 2, RX = W - PAD;
    const HEAD_Y = 262;                             // 표 머리(굵은 선) 높이
    const START_Y = HEAD_Y + 62;                    // 첫 공간이 시작되는 높이 (표 머리 아래)
    const SW_W = 56, SW_H = 70;                     // 원단 칸 (세로로 긴 네모)
    const SIZE_R = RX - 190, SIZE_W = 170;          // "크기" 칸: 오른쪽 끝 위치와 폭 (그 오른쪽 190은 "금액" 칸)
    const setFont = (weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; };
    const canSpace = 'letterSpacing' in ctx;
    const spacing = v => { if (canSpace) ctx.letterSpacing = v; };
    const hline = (x1, x2, y, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
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
    // 글자 사이를 띄운 작은 이름표. 오른쪽 맞춤이면 마지막 글자 뒤 간격만큼 밀려 보이므로 그만큼 당겨 줌
    const label = (str, x, y, align, gap) => {
        spacing(gap + 'px');
        text(str, x + ((align === 'right' && canSpace) ? gap : 0), y, align, SOFT);
        spacing('0px');
    };
    const won = n => `${n.toLocaleString()}원`;

    // 머리글 + 표 머리 (페이지마다 같은 모양)
    function hdr() {
        // 로고: 명조 보통 굵기, 점만 흙빛 (세 조각으로 나눠 그림)
        setFont(400, 66, SERIF); spacing('2.3px');
        const wRe = ctx.measureText('Re').width, wDot = ctx.measureText('Re.').width;
        text('Re', CX, 158, 'left', DARK); text('.', CX + wRe, 158, 'left', '#8a4a22'); text('dam', CX + wDot, 158, 'left', DARK);
        spacing('0px');
        setFont(600, 32, SERIF);
        if (canSpace) { spacing('18px'); text('견적서', RX + 18, 152, 'right', DARK); spacing('0px'); }
        else text('견 적 서', RX, 152, 'right', DARK);
        setFont(400, 30, SERIF); text(data.recipient, CX, 214, 'left', MUTED);
        setFont(400, 24, SANS); label(data.date, RX, 214, 'right', 2);
        hline(CX, RX, HEAD_Y, DARK, 3);
        setFont(600, 20, SANS);
        label('품목', CX, HEAD_Y + 40, 'left', 3);
        label('크기', SIZE_R, HEAD_Y + 40, 'right', 3);
        label('금액', RX, HEAD_Y + 40, 'right', 3);
    }

    // 공간 한 묶음의 크기를 미리 계산
    function layoutRoom(room) {
        const px = CX, iw = CW;
        const tx = px + SW_W + 24;
        const tw = SIZE_R - SIZE_W - 16 - tx;          // 원단 이름·옵션·추천 이유가 쓸 수 있는 폭
        const blocks = room.items.map(it => {
            const photo = (data.photos && data.photos[it.photoKey]) || null;
            setFont(700, 28, SERIF);
            const lines = wrap(it.name, tw);
            const lastW = ctx.measureText(lines[lines.length - 1] || '').width;
            setFont(400, 22, SANS);
            // 옵션은 이름 옆에 작게. 자리가 모자라면 다음 줄로
            const metaInline = !!it.meta && lastW + 14 + ctx.measureText(it.meta).width <= tw;
            const metaLines = (it.meta && !metaInline) ? wrap(it.meta, tw) : [];
            const rlines = it.reason ? wrap(it.reason, tw) : [];
            const nameEnd = 74 + (lines.length - 1) * 38;
            const textEnd = nameEnd + metaLines.length * 32 + rlines.length * 32;
            const h = Math.max(textEnd + 24, 12 + SW_H + 14);
            return { it, photo, lines, lastW, metaInline, metaLines, rlines, h };
        });
        const headH = 78;
        const cardH = headH + blocks.reduce((a, b) => a + b.h, 0) + 10;
        return { room, px, iw, tx, blocks, headH, cardH };
    }
    // 공간 한 묶음을 y 위치에 그림: 위 가는 선 → 공간 이름·소계 → 품목(원단 칸 · 종류 · 이름·옵션 · 크기 · 금액)
    function drawRoom(L, y) {
        const { room, px, iw, tx, blocks, headH } = L;
        hline(px, px + iw, y, LINE, 2);
        setFont(700, 34, SERIF); text(room.name, px, y + 54, 'left', DARK);
        setFont(700, 28, SERIF); text(won(room.total), px + iw, y + 54, 'right', DARK);
        let by = y + headH;
        blocks.forEach(b => {
            // 원단 칸: 사진이 있으면 가운데를 잘라 넣고, 없으면 톤 색으로 채움
            ctx.fillStyle = b.it.fill || '#d9cdbb'; ctx.fillRect(px, by + 12, SW_W, SW_H);
            if (b.photo) {
                const sw = b.photo.naturalWidth, sh = b.photo.naturalHeight;
                const k = Math.max(SW_W / sw, SW_H / sh), cw = SW_W / k, ch = SW_H / k;
                ctx.drawImage(b.photo, (sw - cw) / 2, (sh - ch) / 2, cw, ch, px, by + 12, SW_W, SW_H);
            }
            setFont(600, 19, SANS); label(b.it.kind, tx, by + 36, 'left', 3);
            setFont(700, 28, SERIF);
            b.lines.forEach((ln, li) => text(ln, tx, by + 74 + li * 38, 'left', DARK));
            let ty = by + 74 + (b.lines.length - 1) * 38;
            if (b.it.size) { setFont(400, 23, SANS); text(b.it.size, SIZE_R, by + 74, 'right', MUTED); }
            setFont(600, 26, SERIF); text(won(b.it.price), px + iw, by + 74, 'right', DARK);
            setFont(400, 22, SANS);
            if (b.metaInline) text(b.it.meta, tx + b.lastW + 14, ty, 'left', MUTED);
            b.metaLines.forEach(ln => { ty += 32; text(ln, tx, ty, 'left', MUTED); });
            b.rlines.forEach(ln => { ty += 32; text(ln, tx, ty, 'left', SOFT); });
            by += b.h;
        });
    }
    // 맨 아래 구역: 시공비 → 합계 금액 → 안내 줄들(왼쪽 작은 이름표 + 오른쪽 글: 안내 / 결제 조건 / 맞춤 제작 안내) → 가는 선 → 공급자 정보
    // 결제 조건·맞춤 제작 안내·공급자 정보는 직원 화면에서 적은 글(여러 줄). 비어 있으면 그 줄은 그리지 않음
    const INFO_X = CX + 190, INFO_W = RX - INFO_X, INFO_LH = 34, INFO_GAP = 14;
    const paras = (str, maxW) => {
        const out = [];
        String(str || '').split(/\r?\n/).forEach(p => { const t = p.trim(); if (t) wrap(t, maxW).forEach(l => out.push(l)); });
        return out;
    };
    function layoutFooter() {
        setFont(400, 22, SANS);
        const rows = [
            { label: '안내', lines: paras(data.note, INFO_W).concat(['전문 피팅 시공 및 1년 무상 A/S']) },
            { label: '결제 조건', lines: paras(data.pay, INFO_W) },
            { label: '맞춤 제작 안내', lines: paras(data.custom, INFO_W) }
        ].filter(r => r.lines.length);
        const sup = paras(data.supplier, INFO_W);
        const rowH = n => n * INFO_LH + INFO_GAP;
        const h = (data.install > 0 ? 80 : 0) + 118 + 62 + rows.reduce((a, r) => a + rowH(r.lines.length), 0)
            + (sup.length ? 30 + rowH(sup.length) : 0) + 56;
        return { rows, sup, h };
    }
    function drawFooter(F, y) {
        if (data.install > 0) {
            hline(CX, RX, y, LINE, 2);
            setFont(400, 25, SANS); text('시공 및 설치비', CX, y + 50, 'left', MUTED);
            setFont(600, 26, SERIF); text(won(data.install), RX, y + 50, 'right', DARK);
            y += 80;
        }
        hline(CX, RX, y, DARK, 3);
        y += 118;
        setFont(600, 22, SANS); label('합계 금액 (시공비 포함)', CX, y - 8, 'left', 3);
        setFont(600, 30, SERIF);
        const wonW = ctx.measureText('원').width;
        text('원', RX, y, 'right', DARK);
        setFont(700, 78, SERIF); text(data.total, RX - wonW - 10, y, 'right', DARK);
        y += 62;
        const infoRow = (name, lines, color) => {
            setFont(600, 19, SANS); label(name, CX, y, 'left', 3);
            setFont(400, 22, SANS);
            lines.forEach((ln, i) => text(ln, INFO_X, y + i * INFO_LH, 'left', color));
            y += lines.length * INFO_LH + INFO_GAP;
        };
        F.rows.forEach(r => infoRow(r.label, r.lines, MUTED));
        if (F.sup.length) {
            hline(CX, RX, y - 18, LINE, 2);
            y += 30;
            infoRow('공급자', F.sup, MUTED);
        }
    }
    function pageLabel(i, n, H) {
        if (n < 2) return;
        setFont(500, 22, SANS); text(`${i + 1} / ${n}`, W / 2, H - 34, 'center', SOFT);
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
    const pr = opts.pixelRatio || 1;      // 화면에 띄울 때는 더 선명하게(저장·인쇄는 1 = 1080px)

    return pages.map((p, pi) => {
        const isLast = pi === pages.length - 1;
        const H = Math.max(PAGE_H, Math.ceil(p.y + (isLast ? F.h : BOTTOM)));   // 아주 긴 방 하나일 때만 늘어남 (화면 좌표)
        const canvas = document.createElement('canvas');
        canvas.width = TICKET_W * pr; canvas.height = Math.round(H * s * pr);
        const ctx = canvas.getContext('2d');
        ctx.scale(s * pr, s * pr);                                                        // 이후는 모두 "늘리거나 줄이기 전" 좌표
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, H);                    // 종이 색 (고객 화면 바탕 #fbf9f5보다 조금 밝게 → 화면에서 종이 한 장으로 보임)
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
                document.fonts.load('600 28px "Noto Serif KR"'),
                document.fonts.load('400 30px "Noto Serif KR"'),
                document.fonts.load('600 22px Pretendard'),
                document.fonts.load('700 28px Pretendard'),
                document.fonts.load('500 24px Pretendard'),
                document.fonts.load('400 24px Pretendard')
            ]);
        }
    } catch (e) {}
    const data = await loadTicketPhotos(ticketData());
    const canvases = buildTicketCanvases(opts, data);
    if (opts.canvasOnly) return { canvases, blobs: [], type: null };      // 화면에 띄우기만 할 때 (고객 화면 최종 제안)
    const type = opts.type || 'image/png';
    const blobs = await Promise.all(canvases.map(c => new Promise(res => c.toBlob(res, type, 0.95))));
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

// 견적서 저장: 예전 "카톡용"과 "고화질" 저장을 하나로 합침.
// 선명한 JPG로 갤러리에 저장 → 카카오톡에서 사진으로 보내면 됨 (탭에서 공유 창이 끝없이 로딩돼 "공유" 대신 "저장")
let __saveBusy = false;
async function saveTicketImage() {
    if (__saveBusy) return;          // 연타해도 여러 번 저장되지 않게
    __saveBusy = true;
    showToast("견적서 만드는 중...", "info");
    try {
        const { blobs } = await makeTicketBlobs({ type: 'image/jpeg' });
        const names = ticketFileNames(blobs.length, 'jpg', false);
        for (let i = 0; i < blobs.length; i++) {
            saveBlobAsFile(blobs[i], names[i]);
            if (i < blobs.length - 1) await new Promise(r => setTimeout(r, 400));   // 여러 장은 간격을 두고 저장
        }
        showToast(`${blobs.length > 1 ? blobs.length + '장 ' : ''}저장했어요. 카카오톡 → 사진(갤러리)에서 골라 보내 주세요.`, "success");
    } catch (err) {
        console.error(err);
        showToast("견적서 저장 중 오류가 발생했습니다.", "error");
    } finally {
        __saveBusy = false;
    }
}

async function preparePrintSheet() {
    const { canvases } = await makeTicketBlobs();
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
                lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null,
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

