(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['app.js']='20261102';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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
const REDAM_BUILD = '20261102';
function checkFileVersions() {
    const expected = ['pricing.js', 'costing.js', 'data.js', 'calculator.js', 'concierge.js', 'app.js', 'room-color.js'];
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
    renderUndoButton();
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', updateOfflineStatus);

    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
    }
    initBackButton();
};

// ---- 뒤로 버튼 ----
// 앱은 한 페이지 안에서 화면만 바꾸므로, 그대로 두면 탭의 뒤로(버튼·가장자리 밀기)가 앱을 통째로 닫음
// → 방문 기록에 "앱 안" 표시(guard)를 몇 개 쌓아 두고, 뒤로가 눌리면(popstate) 표시 하나를 쓰고 앱 안에서 처리함
//   1 떠 있는 것 닫기 → 2 잠금 화면이면 아무것도 안 함 → 3 고객 화면은 ← 와 같게(맨 처음이면 아무 일 없음)
//   → 4 직원 화면은 원단의 다른 탭 → 찾기 탭, 다른 메뉴 → 상담 → 5 상담에서는 "한 번 더 누르면 앱이 닫혀요"(2초 안에 또 누르면 닫힘)
// 크롬은 사람이 화면을 누르지 않은 채 넣은 표시를 뒤로 버튼이 건너뛰게 함(탭에서 뒤로가 안 먹던 이유, 10-15)
// → 표시는 화면을 누를 때(click) 채워 넣고, 뒤로 한 번에 하나씩 씀. 표시가 바닥나도 다음에 누르면 다시 채워짐
const BACK_EXIT_MS = 2000;
const BACK_GUARDS = 3;          // 한 번 누른 뒤 화면을 다시 안 눌러도 앱 안에서 처리되는 뒤로 횟수
let backExitTimer = 0;
let backLeaving = false;
function backGuardLevel() { const s = history.state; return (s && s.redam === 'guard') ? (s.n || 1) : 0; }
function fillBackGuards() {
    if (backLeaving || backExitTimer) return;
    const s = history.state;
    if (!(s && (s.redam === 'guard' || s.redam === 'base'))) history.replaceState({ redam: 'base' }, '');
    for (let n = backGuardLevel() + 1; n <= BACK_GUARDS; n++) history.pushState({ redam: 'guard', n }, '');
}
function initBackButton() {
    const s = history.state;
    if (!(s && (s.redam === 'guard' || s.redam === 'base'))) history.replaceState({ redam: 'base' }, '');
    window.addEventListener('popstate', () => {
        if (backLeaving) return;
        const level = backGuardLevel();
        const exit = handleBack();
        if (exit) {
            if (backExitTimer) {                          // 2초 안에 또 누름 → 정말로 닫기 (남은 표시를 모두 건너뜀)
                clearTimeout(backExitTimer); backExitTimer = 0;
                backLeaving = true;
                saveDraftTick();
                history.go(-(level + 1));
                return;
            }
            saveDraftTick();
            showToast('한 번 더 누르면 앱이 닫혀요', 'info');
            backExitTimer = setTimeout(() => { backExitTimer = 0; }, BACK_EXIT_MS);
            if (level < 1) history.pushState({ redam: 'guard', n: 1 }, '');      // 마지막 표시였다면 하나는 남겨 둠
            return;
        }
        if (backExitTimer) { clearTimeout(backExitTimer); backExitTimer = 0; }
        if (level < 1) history.pushState({ redam: 'guard', n: 1 }, '');          // 표시가 바닥남: 누르지 않고 넣는 것이라 건너뛰어질 수 있어도 넣어 둠
    });
    // 화면을 누를 때마다 표시를 채움(누른 순간에 넣어야 크롬이 건너뛰지 않음). 2초 기다리는 중에 누르면 닫기를 취소
    document.addEventListener('click', () => {
        if (backExitTimer) { clearTimeout(backExitTimer); backExitTimer = 0; }
        fillBackGuards();
    }, true);
}
// 뒤로 한 번을 앱 안에서 처리. 앱을 닫아도 되는 자리(직원 화면 상담)면 true
function handleBack() {
    const visible = id => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && !el.hidden; };
    // 2. 잠금 화면: 아무것도 안 함 (뒤로로 잠금이 풀리거나 뒤 화면이 보이면 안 됨)
    const pin = document.getElementById('pinModal');
    if (visible('pinModal') && pin.classList.contains('is-lock')) return false;
    // 1. 떠 있는 것 닫기 (위에 있는 것부터)
    if (visible('pinModal')) { RedamAuth.dismiss(); return false; }               // 직원 모드 PIN · 다른 메뉴 열기 PIN 창 = 취소와 같음
    if (visible('finderShow') && closeFinderShowAsk()) return false;               // 보여 주기의 확인 창 = "다시 고를게요"와 같음
    if (visible('finderShow')) { closeFinderShow(); return false; }              // 후보 보여 주기 (닫는 × 와 같음. 이 화면 동안은 잠긴 상태로 셈)
    if (appMode === 'staff' && staffLocked) return false;                          // 잠긴 상태: 아무것도 안 함
    if (window.concierge && window.concierge.isSeeking && window.concierge.isSeeking()) return false;     // "찾는 중" 화면은 끝날 때까지 기다림
    if (visible('roomColorOverlay')) { RoomColor.close(); return false; }
    if (visible('roomColorCust')) { RoomColor.cancelCustomer(); return false; }        // 고객 화면 색 재기 = ← 와 같음
    if (visible('spaceMore')) { if (spaceMore && spaceMore.sheet) { spaceMore.sheet = null; renderSpaceMore(); } else closeSpaceMore(); return false; }     // 중심 화면 › 더 보기
    if (visible('ticketModal')) { closeTicketModal(); return false; }
    if (closeFinderSlots()) return false;
    if (document.querySelector('#finderOut .finder-card.is-open')) { finderOpenCard(null); return false; }
    if (window.concierge && window.concierge.closeTopLayer && window.concierge.closeTopLayer()) return false;
    // 3. 고객 화면: ← 와 똑같이 이전 단계로. 더 돌아갈 곳이 없으면 아무 일도 없음 (고객이 실수로 앱을 닫지 않게)
    if (appMode !== 'staff') {
        if (window.concierge && window.concierge.canGoBack()) window.concierge.prevStep();
        return false;
    }
    // 4. 직원 화면: 원단의 다른 탭 → 찾기 탭, 상담이 아닌 메뉴 → 상담 (찾기만 열린 상태면 PIN 창이 뜸)
    const view = (document.querySelector('.staff-view.on') || {}).id || '';
    if (view === 'view-fabric') {
        const pane = (document.querySelector('.staff-pane.on') || {}).id || '';
        if (pane && pane !== 'fabricTab-find') { showFabricTab('find'); return false; }
    }
    if (view && view !== 'view-consult') { showStaffView('consult'); return false; }
    // 5. 상담 화면
    return true;
}

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
        updateBookFilterOptions();      // 책자 고르기에 공급처(회사) 이름 (10-17)
        updatePrivateStatus();
        renderHistory();
        warnHistoryFull();
        updateOfflineStatus();
        renderTagEditor();
        renderColorEditor();
        renderUndoButton();
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
    setFinderOnly(false);
    showStaffView('consult');
    switchMainTrack('express');
    startIdleWatch();
}

function exitStaffMode(toastMsg, goToProposal) {
    stopIdleWatch();
    if (staffLocked) { staffLocked = false; RedamAuth.dismiss(); }      // 잠긴 채로 나갈 때는 잠금 창도 닫음
    setFinderOnly(false);
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
    if (view !== 'fabric' && finderGate(() => showStaffView(view))) return;
    document.querySelectorAll('.staff-nav button').forEach(b => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('.staff-view').forEach(s => s.classList.toggle('on', s.id === 'view-' + view));
    if (view !== 'fabric') hideDbPrices();
    if (view === 'fabric') renderFinder();      // 분류·색상을 고친 뒤 돌아와도 새 값으로 보이게, 열 때마다 다시 그림
    window.scrollTo(0, 0);
}
// 원단 메뉴의 탭 6개: 찾기(find) · 색 사전(dict, 직원 전용 색 이름) · 원단 목록(list) · 분류(tag) · 색상(color) · 사진(photo)
function showFabricTab(tab) {
    if (tab !== 'find' && finderGate(() => showFabricTab(tab))) return;
    document.querySelectorAll('.staff-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    document.querySelectorAll('.staff-pane').forEach(p => p.classList.toggle('on', p.id === 'fabricTab-' + tab));
    if (tab !== 'list') hideDbPrices();
    if (tab === 'find') renderFinder();
    if (tab === 'dict') renderColorDict();
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
    if (finderGate(startNewConsultation)) return;
    if (!confirm('현재 견적과 고객 입력을 모두 지우고 새 상담을 시작할까요?\n(지금 상담은 "상담 이력"에 보관됩니다)')) return;
    archiveConsultation(collectConsultation(), Date.now());
    clearDraft();
    initDefaultRooms();
    collapsedRooms.clear(); openCurtainDetails.clear();
    finderTarget = null; finderView = 'grid'; finderPicks = []; resetFinderFilters(true);
    jogakboSeed = newJogakboSeed();      // 새 상담은 새 조각보 (79번)
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
// 2. 직원 PIN (로고 2초 누르고 있기 → PIN 입력)
// ==============================================================
const STAFF_HOLD_MS = 2000;
const RedamAuth = (function() {
    let taps = 0, tapTimer = null;
    let mode = 'verify';        // 'verify' | 'setup' | 'change' | 'unlock'(잠금 화면) | 'gate'(찾기만 열린 상태에서 다른 메뉴로 갈 때)
    let gateNext = null;        // 'gate'에서 PIN이 맞으면 이어서 할 일
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
        gateNext = null;
        el('pinInput').value = ''; el('pinInput2').value = ''; el('pinError').textContent = '';
        const two = (m === 'setup' || m === 'change');
        el('pinInput2').style.display = two ? 'block' : 'none';
        const lock = (m === 'unlock'), gate = (m === 'gate');
        el('pinTitle').textContent = lock ? '잠겨 있어요' : (gate ? '다른 메뉴 열기' : (m === 'verify' ? '직원 모드' : (m === 'setup' ? '직원 PIN 만들기' : 'PIN 변경')));
        el('pinDesc').textContent = lock ? 'PIN을 넣으면 하던 화면으로 돌아갑니다.' : (gate ? '찾기 화면 밖의 메뉴는 PIN을 넣어야 열립니다.' : (m === 'verify' ? 'PIN을 입력해 주세요.'
            : '숫자 4~8자리를 정하고 한 번 더 입력해 주세요. (분실하면 복구할 수 없으니 꼭 기억해 두세요)'));
        el('pinInput').placeholder = two ? '새 PIN' : '••••';
        el('pinInput2').placeholder = '새 PIN 확인';
        el('pinCancelBtn').textContent = lock ? '고객 화면으로' : (gate ? '찾기 화면으로' : '취소');
        el('pinModal').classList.toggle('is-lock', lock);          // 잠금 화면일 때는 뒤 화면(원가)이 읽히지 않게 더 흐리게
        el('pinModal').classList.remove('hidden');
        setTimeout(() => el('pinInput').focus(), 50);
    }
    function closeModal() { mode = 'verify'; gateNext = null; el('pinModal').classList.add('hidden'); el('pinModal').classList.remove('is-lock'); el('pinInput').value = ''; el('pinInput2').value = ''; }

    return {
        // 로고(data-staff-hold)를 2초 동안 누르고 있으면 PIN 창을 연다 (10-16 사장님: 5번 탭 대신). 손가락이 움직이거나 일찍 떼면 취소
        //  누르고 있다가 PIN 창이 열린 뒤 손을 떼도 그 아래 카드가 눌리지 않게 바로 다음 click 한 번은 막음
        holdStart: function(ev) {
            if (appMode === 'staff' || (ev.button !== undefined && ev.button > 0)) return;
            const x0 = ev.clientX, y0 = ev.clientY, self = this;
            clearTimeout(tapTimer);
            const stop = () => { clearTimeout(tapTimer); document.removeEventListener('pointerup', stop, true); document.removeEventListener('pointercancel', stop, true); document.removeEventListener('pointermove', move, true); };
            const move = e => { if (Math.hypot(e.clientX - x0, e.clientY - y0) > 12) stop(); };
            document.addEventListener('pointerup', stop, true);
            document.addEventListener('pointercancel', stop, true);
            document.addEventListener('pointermove', move, true);
            tapTimer = setTimeout(() => {
                stop();
                taps = Date.now();      // 이 뒤 잠깐 동안의 click은 막음
                self.requestStaff();
            }, STAFF_HOLD_MS);
        },
        swallowClick: function(ev) { if (taps && Date.now() - taps < 1500) { taps = 0; ev.preventDefault(); ev.stopPropagation(); } },
        requestStaff: function() { openModal(loadStored() ? 'verify' : 'setup'); },
        changePin: function() { openModal('change'); },
        requestUnlock: function() { openModal('unlock'); },
        // 찾기만 열린 상태에서 다른 메뉴로 갈 때: PIN이 맞으면 next를 이어서 함. "찾기 화면으로"는 창만 닫음
        requestGate: function(next) { openModal('gate'); gateNext = next || null; },
        dismiss: closeModal,
        // 잠금 화면의 "고객 화면으로"는 창만 닫지 않고 고객 화면으로 나감
        cancel: function() { const wasLock = (mode === 'unlock'); closeModal(); if (wasLock) exitStaffMode(); },
        submit: async function() {
            const pin = el('pinInput').value.trim();
            const err = el('pinError');
            if (mode === 'verify' || mode === 'unlock' || mode === 'gate') {
                if (Date.now() < lockedUntil) { err.textContent = `잠시 후 다시 시도해 주세요. (${Math.ceil((lockedUntil - Date.now()) / 1000)}초)`; return; }
                const st = loadStored();
                if (st && (await hashPin(pin, st.salt)) === st.hash) {
                    const was = mode, next = gateNext;
                    fails = 0; closeModal();
                    if (was === 'verify') enterStaffMode();
                    else { unlockStaff(); if (was === 'gate' && next) next(); }      // 잠금 해제는 화면을 다시 그리지 않음 → 하던 화면 그대로
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
// 고객 화면 로고(data-staff-hold)를 누르기 시작하면 2초 재기. 길게 눌러도 탭의 글자 고르기·메뉴가 뜨지 않게 (style.css [data-staff-hold])
document.addEventListener('pointerdown', ev => { if (ev.target.closest && ev.target.closest('[data-staff-hold]')) RedamAuth.holdStart(ev); }, true);
document.addEventListener('click', ev => RedamAuth.swallowClick(ev), true);
document.addEventListener('contextmenu', ev => { if (ev.target.closest && ev.target.closest('[data-staff-hold]')) ev.preventDefault(); });

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
    if (hint) hint.textContent = staffFinderOnly ? '다른 메뉴는 PIN을 넣어야 열려요' : (min ? `${min}분 동안 손대지 않으면 잠깁니다` : '이 기기는 자동으로 잠기지 않습니다');
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
    if (on) hideDbPrices();
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
    setFinderOnly(false);
    lastActivity = Date.now();
}
// 찾기만 열린 상태: 후보를 "고객에게 보여주기"로 보여 준 뒤 닫으면 PIN 없이 원단 › 찾기 화면까지만 씀 (고객과 나란히 앉아 볼 때 PIN을 계속 누르지 않게)
//  - 상담·서류·상담 기록·설정, 원단의 다른 탭, 새 상담은 PIN을 한 번 넣어야 열리고, 넣고 나면 평소대로 돌아감
//  - 자동 잠금·"지금 잠그기"·"잠그고 나가기"는 그대로
let staffFinderOnly = false;
function setFinderOnly(on) {
    staffFinderOnly = !!on;
    // 고객과 나란히 보는 상태: 가격 정렬·가격대 거름망은 숨기고, 골라 둔 것도 풀어 줌 (PIN을 넣은 평소 상태에서는 그대로 씀)
    if (staffFinderOnly) { if (finderSel.price) finderSel.price.clear(); if (finderSort === 'price') finderSort = 'light'; }
    if (staffFinderOnly) document.body.dataset.finderOnly = '1'; else delete document.body.dataset.finderOnly;
    renderLockSetting();
}
function finderGate(next) {
    if (appMode !== 'staff' || !staffFinderOnly) return false;
    RedamAuth.requestGate(next);
    return true;
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
    // 직원 화면: 직원 공간 목록 + 고객 화면에서 공간 추가만 하고 아직 상담 전인 공간
    const src = !window.concierge ? rooms : (appMode === 'staff' ? rooms.concat(window.concierge.getPendingRoomsForSave ? window.concierge.getPendingRoomsForSave() : []) : window.concierge.getRoomsForSave());
    return {
        name: ((document.getElementById('custName') || {}).value || '').trim(),
        phone: ((document.getElementById('custPhone') || {}).value || '').trim(),
        rooms: src.map(r => ({
            name: r.name, sunlight: r.sunlight, lightLevel: r.lightLevel, floorTone: r.floorTone, wallTone: r.wallTone, mood: r.mood, wantMood: r.wantMood || null,
            roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, diagnosed: !!r.diagnosed,
            measuredColor: r.measuredColor || null,          // 방 색 재기로 잰 벽·바닥 색 (사진은 저장 안 함)
            width: r.width || null, height: r.height || null, spaceWidth: r.spaceWidth || null, spaceHeight: r.spaceHeight || null, sizeMode: r.sizeMode || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),      // 중심 화면: 공간 추가 때 정한 크기·색 출처
            curtains: r.curtains.map(c => { const copy = Object.assign({}, c); delete copy.calc; return copy; })
        })),
        installFee: globalInstallFee,
        vat: globalVatOption,
        jogakboSeed: window.getJogakboSeed(),      // 조각보 모양 고정 (79번)
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
    // 직원 화면 공간 목록에는 커튼이 있는 공간만. 공간 추가만 하고 아직 상담 전인 공간(커튼 없음)은 고객 화면에만 (견적서·발주서에 빈 공간이 나오지 않게)
    const ordered = snap.rooms.map(r => r.curtains.length ? Object.assign({}, r, {
        id: roomIdCounter++,
        curtains: r.curtains.map(c => Object.assign({}, c, { id: curtainIdCounter++ }))
    }) : Object.assign({}, r, { curtains: [] }));
    rooms = ordered.filter(r => r.curtains.length);
    globalInstallFee = snap.installFee;
    globalVatOption = snap.vat || 'consumer';
    jogakboSeed = (Number.isInteger(snap.jogakboSeed) && snap.jogakboSeed > 0) ? snap.jogakboSeed : newJogakboSeed();      // 옛 상담은 새 번호 (79번)
    finderPicks = Array.isArray(snap.picks) ? snap.picks.filter(k => typeof k === 'string').slice(0, FINDER_PICK_MAX) : [];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('custName', snap.name || ''); set('expressCustName', snap.name || '');
    set('custPhone', snap.phone || ''); set('expressCustPhone', snap.phone || '');
    set('expressInstallFee', globalInstallFee); set('expressVatOption', globalVatOption);
    renderSideCust();
    calculateAll();
    // 고객 화면은 순서 그대로 모든 공간으로 통째로 바꿈 (앞 상담의 상담 전 공간이 남지 않게)
    if (window.concierge) window.concierge.loadFromMaster(ordered, globalInstallFee, { replace: true });
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
    if (window.concierge) window.concierge.resume();      // 하던 상담이므로 시작 화면(로고 모션)은 건너뜀
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
    const groups = {}, scenes = { mood: [], feel: [], comp: [], blind: [] };
    keys.forEach(k => {
        const sl = k.indexOf('/');
        if (sl > 0 && scenes[k.slice(0, sl)]) { scenes[k.slice(0, sl)].push(k); return; }      // 분위기·속지 느낌·창 구성·블라인드 종류 사진 (34·38번)
        const at = k.lastIndexOf('__'); const id = at > 0 ? k.slice(0, at) : k; (groups[id] = groups[id] || []).push({ key: k, color: at > 0 ? k.slice(at + 2) : '' });
    });
    const num = s => /^\d+$/.test(s) ? Number(s) : Infinity;
    const chip = (key, label) => `<button type="button" class="dev-photo-chip" title="이 사진 지우기" onclick="removeDevicePhoto('${esc(key)}')">${esc(label)}<i aria-hidden="true">×</i></button>`;
    const SCENE_LABEL = { mood: '분위기 사진', feel: '속지 느낌 사진', comp: '창 구성 사진', blind: '블라인드 종류 사진' };
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
    // 방 색을 잰 공간이면 그 공간의 "벽·바닥 이어주기" 순으로 시작
    const mode = t && ['bridge', 'wall', 'floor'].find(m => finderRoomModeOk(t.room, m));
    if (mode) finderSort = `room:${mode}:${t.room.id}`;
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
// "방 색 재기"(room-color.js)로 벽·바닥을 잰 공간마다 생기는 정렬 (값은 room:<방식>:<공간 id>)
//  - 이어주기: 벽~바닥을 잇는 선 가까이(BRIDGE_TUBE 안)의 색 중 "이어주는 색"(벽 쪽에 가까운 점)에 가까운 순
//  - 벽과 맞추기: 벽과 색 차이가 작은 순 / 바닥과 맞추기: 바닥보다 밝은 색 중 "바닥 + 밝기 14" 근처 순
const FINDER_ROOM_MODES = { bridge: '벽·바닥 이어주기', wall: '벽과 맞추기', floor: '바닥과 맞추기' };
// 계산(BRIDGE_TUBE · FLOOR_LIFT · bridgeDistances · roomLinkDistance)은 data.js — 고객 화면의 "색 잇기" 추천과 같이 씀
function finderRoomModeOk(room, mode) { return roomLinkOk(room && room.measuredColor, mode); }
// 잰 공간의 원단 찾기 열기 (방 색 재기 창의 "반영 후 이어주는 원단 찾기", 공간 카드의 "이어주는 원단 보기")
function openRoomColorFinder(roomId) {
    const room = rooms.find(r => r.id === roomId);
    const mode = ['bridge', 'wall', 'floor'].find(m => finderRoomModeOk(room, m));
    if (!mode) return;
    finderRef = null;
    finderSort = `room:${mode}:${roomId}`;
    finderView = 'grid';
    showFabricTab('find');
    showStaffView('fabric');
}
let finderSel = {};
let finderSort = 'light';
let finderRef = null;          // "비슷한 색"의 기준 색 (카드 key)
let finderView = 'grid';       // 'grid'(색 카드) | 'map'(색 지도)
const FINDER_PICK_MAX = 6;     // 후보는 6개까지 (고객에게는 2~6개를 나란히 보여 줌)
// 조각보 번호(씨앗 숫자): 상담마다 하나, 최종 제안 조각보 모양을 고정 (79번)
let jogakboSeed = 0;
function newJogakboSeed() { return 1 + Math.floor(Math.random() * 2147483646); }
window.getJogakboSeed = function() { if (!jogakboSeed) jogakboSeed = newJogakboSeed(); return jogakboSeed; };
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
// 후보 띠: 별표한 색을 누른 순서대로 (지금 원단 목록에 없는 색은 띠에서만 빠짐)
function renderFinderPicks(all) {
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const picks = finderPicks.map(k => all.find(e => e.key === k)).filter(Boolean);
    const pbox = document.getElementById('finderPicks');
    if (!pbox) return;
    pbox.hidden = !picks.length;
    pbox.innerHTML = !picks.length ? '' : `<b class="font-serif-kr">후보 ${picks.length}개</b><div class="finder-picks-list">`
        + picks.map(e => `<span class="finder-pick"><i${e.hex ? ` style="background:${e.hex}"` : ''}></i>${esc(finderPickName(e))}<button type="button" data-unstar="${esc(e.key)}" aria-label="후보에서 빼기">×</button></span>`).join('')
        + `</div><button type="button" class="staff-btn" onclick="clearFinderPicks()">모두 빼기</button><button type="button" onclick="openFinderShow()" class="bg-indigo-950 hover:bg-indigo-900 text-white font-bold py-2 px-3 rounded-xl text-xs whitespace-nowrap">고객에게 보여주기</button>`;
}
// 카드 색 칸의 둘째 장(사진)과 아래 점
const FINDER_SW_DOTS = '<div class="finder-sw-dots"><button type="button" data-dot="0" aria-current="true" aria-label="색"><i></i></button><button type="button" data-dot="1" aria-current="false" aria-label="사진"><i></i></button></div>';
function finderPhotoPageHtml(url) {
    return `<div class="finder-sw-page"><img src="${String(url).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="" loading="lazy"><span class="finder-sw-tag">사진</span></div>`;
}
// 사진 확인이 끝나면 카드의 사진 장만 고침 (다시 그리지 않으니 열어 둔 정보판·밀어 둔 사진·스크롤이 그대로)
function refreshFinderPhotos() {
    const cards = document.querySelectorAll('#finderOut .finder-card');
    if (!cards.length) return;
    const byKey = new Map(finderEntries().map(e => [e.key, e]));
    cards.forEach(card => {
        const e = byKey.get(card.dataset.key);
        if (!e) return;
        const url = photoFor(e.fabricId, e.color);
        const sw = card.querySelector('.finder-sw'), track = sw && sw.querySelector('.finder-sw-track');
        if (!track) return;
        const page = track.children[1], img = page && page.querySelector('img');
        if (url && !page) {
            track.insertAdjacentHTML('beforeend', finderPhotoPageHtml(url));
            track.insertAdjacentHTML('afterend', FINDER_SW_DOTS);
        } else if (url && img && img.getAttribute('src') !== url) img.src = url;
        else if (!url && page) {
            page.remove();
            const dots = sw.querySelector('.finder-sw-dots');
            if (dots) dots.remove();
            track.scrollLeft = 0;
        }
    });
}
// 원단 › 찾기가 화면에 보일 때, 이번 실행에서 아직 확인 안 했으면 뒤에서 조용히 사진 확인 (상태 글·알림 없이)
function ensureFinderPhotos() {
    if (__photoChecked || __photoScan || navigator.onLine === false) return;
    scanPhotos().then(r => { if (!r.offline) refreshFinderPhotos(); });
}
function renderFinder() {
    const out = document.getElementById('finderOut');
    if (!out) return;
    if (out.offsetParent) ensureFinderPhotos();
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
    renderFinderPicks(all);
    // 거름망 칩 (고른 것은 짙게)
    const opts = finderOptions(all);
    document.querySelectorAll('.finder-chips').forEach(box => {
        const k = box.dataset.k;
        finderSel[k].forEach(v => { if (!opts[k].some(o => o[0] === v)) finderSel[k].delete(v); });      // 원단이 바뀌어 없어진 값은 풀어 줌
        box.innerHTML = opts[k].map(o => `<button type="button" class="finder-chip" data-v="${esc(o[0])}" aria-pressed="${finderSel[k].has(o[0])}">${o[2] ? `<i style="background:${o[2]}"></i>` : ''}${esc(o[1])}</button>`).join('');
        box.closest('.finder-fgroup').hidden = !opts[k].length || (k === 'price' && staffFinderOnly);
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
    // 방 색을 잰 공간 (넣을 칸의 공간이 먼저)
    const measuredRooms = rooms.filter(r => ['bridge', 'wall', 'floor'].some(m => finderRoomModeOk(r, m))).sort((x, y) => (target ? (y.id === target.room.id) - (x.id === target.room.id) : 0));
    const rm = /^room:(bridge|wall|floor):(\d+)$/.exec(finderSort);
    const mRoom = rm ? measuredRooms.find(r => r.id === Number(rm[2]) && finderRoomModeOk(r, rm[1])) : null;
    const mMode = mRoom ? rm[1] : null, mc = mRoom ? mRoom.measuredColor : null;
    if (rm && !mRoom) finderSort = 'light';
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
        if (mMode) {
            // 색 값(밝기·붉은기·노란기)이 있는 색만. 거름망(종류·빛 가림 등)은 그대로 적용
            list = list.filter(finderHasLab);
            // 세 방식 모두 data.js roomLinkDistance (맞지 않는 색은 null → 뺌). e.rd = 화면에 쓰는 "벽과 / 이어주는 색과 ○○" 거리
            list.forEach(e => {
                e.rscore = roomLinkDistance(e, mc, mMode);
                e.rd = mMode === 'bridge' ? colorDistance(e, mc.bridge) : (mMode === 'wall' ? e.rscore : null);
            });
            list = list.filter(e => e.rscore != null);
            list.sort((x, y) => x.rscore - y.rscore);
        } else if (fitRoom) {
            // 기존 추천 점수 그대로: 색의 톤·밝기를 입힌 원단으로 calculateFabricMatchScore (점수가 같으면 밝은 색 먼저)
            list.forEach(e => { e.fit = calculateFabricMatchScore(e.view, fitRoom, e.fabric.categoryType); });
            list.sort((x, y) => (y.fit - x.fit) || by('L', -1)(x, y));
        } else if (finderSort === 'price') list.sort((x, y) => (x.priceRank - y.priceRank) || (x.price - y.price) || byBook(x, y));      // 단위가 다른 원단은 저마다의 묶음 안 자리로 견줌
        else list.sort(finderSort === 'dark' ? by('L', 1) : (finderSort === 'vivid' ? by('C', -1) : (finderSort === 'muted' ? by('C', 1) : (finderSort === 'book' ? byBook : by('L', -1)))));
    }
    const showPrice = finderSort === 'price' || finderSel.price.size > 0;       // 가격대 꼬리표는 가격으로 거르거나 줄 세울 때만 보임
    const sortSel = document.getElementById('finderSort');
    if (sortSel) {
        const sorts = Object.keys(FINDER_SORTS).filter(k => k !== 'sim' && !(k === 'price' && staffFinderOnly)).map(k => [k, FINDER_SORTS[k]]).concat(fitRooms.map(r => ['fit:' + r.id, `${r.name}에 어울리는 순`]),
            ...measuredRooms.map(r => ['bridge', 'wall', 'floor'].filter(m => finderRoomModeOk(r, m)).map(m => [`room:${m}:${r.id}`, `${r.name} ${FINDER_ROOM_MODES[m]}`])), [['sim', FINDER_SORTS.sim]], pair ? [['pair', '겉지에 어울리는 속지']] : []);
        sortSel.innerHTML = sorts.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join('');
        sortSel.value = finderSort;
    }
    const pairRule = pairTones ? `${pairTones.map(t => TONE_LABELS[t]).join('·')} 톤 · 겉지보다 밝은 색` : '겉지보다 밝은 색';
    const cnt = document.getElementById('finderCount');
    if (cnt) cnt.innerHTML = sim ? `<b class="font-serif-kr">비슷한 색 ${list.length}개</b><small>거름망은 종류(겉지·속지)만 적용</small>`
        : (pair ? `<b class="font-serif-kr">어울리는 속지 ${list.length}개</b><small>${pairRule} · 거름망은 적용 안 함</small>`
            : (mMode ? `<b class="font-serif-kr">${list.length}색</b><small>${esc(mRoom.name)} ${FINDER_ROOM_MODES[mMode]} · ${{ bridge: '벽과 바닥을 잇는 색 가운데 벽 쪽에 가까운 순', wall: '잰 벽 색과 가까운 순', floor: '바닥 색기를 따르고 바닥보다 밝은 순' }[mMode]} · 색 값이 있는 색만</small>`
            : `<b class="font-serif-kr">${finderColorTotal(list)}색</b><small>${finderFabricTotal(list)}개 원단 · 전체 ${finderColorTotal(all)}색${finderNoColorNote(list)}</small>`));      // 색 수는 등록된 색만 (58번)
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
    if (finderView === 'map') { out.innerHTML = finderMapHtml(all, new Set(list.map(e => e.key)), ref, mc); return; }
    if (!list.length) {
        out.innerHTML = '<div class="finder-empty">' + (mMode ? '잰 색에 맞는 원단을 찾지 못했어요.<br>거름망을 풀거나 다른 찾기 방법을 골라 보세요.' : sim ? '비슷한 색을 찾지 못했어요.<br>종류(겉지·속지) 조건을 풀어 보세요.'
            : (pair ? '어울리는 속지를 찾지 못했어요.<br>분류 탭에서 속지의 톤이 정해져 있는지 확인해 보세요.' : '조건에 맞는 색이 없어요.<br>조건을 하나씩 빼 보세요.')) + '</div>';
        return;
    }

    // 예전 입력표로만 색을 넣은 기기: 색 값이 하나도 없으면 어떻게 채우는지 알려 줌
    const note = all.some(e => e.hex) ? '' : '<p class="finder-hint">아직 색 값이 들어 있지 않아요. 색상 탭의 "색상 입력표 불러오기"로 새 입력표(밝기·색상코드·붉은기·노란기 열)를 올리면 카드에 색이 보입니다.</p>';
    const chip = (text, unset) => `<span class="staff-chip${unset ? ' is-unset' : ''}">${text}</span>`;
    const anySlot = rooms.some(r => r.curtains.length);
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
        const light = (e.L != null ? `밝기 ${Math.round(e.L)}` : '밝기 미정') + (sim ? ` · ${colorDistanceWord(e.dist)}` : '') + (pair && e.dist == null ? ' · 톤만 맞춤' : '') + (fitRoom ? ` · 어울림 ${e.fit}` : '')
            + (mMode === 'floor' ? ` · 바닥보다 ${Math.round(e.L - mc.floor.L)} 밝음` : (mMode ? ` · ${mMode === 'wall' ? '벽과' : '이어주는 색과'} ${colorDistanceWord(e.rd)}` : ''));
        const meta = e.color ? `${e.book} ${e.fabName} ${e.no} · ${light}` : `${e.book} · ${light}`;
        // 정보판 안: 찾기 버튼 줄(비슷한 색 · 겉지는 어울리는 속지). 넣기 버튼은 상담에 커튼·블라인드 칸이 하나라도 있으면 카드 맨 아래에 늘 보임
        //  (넣을 칸이 정해져 있으면 바로 넣고, 없으면 누를 때 "어느 칸에 넣을까요?" 판이 뜸)
        const finds = (finderHasLab(e) ? `<button type="button" data-sim="${esc(e.key)}">비슷한 색</button>` : '') + (e.cat === 'drape' ? `<button type="button" data-pair="${esc(e.key)}">어울리는 속지</button>` : '');
        const acts = finds ? `<div class="finder-acts">${finds}</div>` : '';
        const put = (target || anySlot) ? `<div class="finder-acts is-put"><button type="button" data-pick="${esc(e.key)}">이 공간에 넣기</button></div>` : '';
        const photo = photoFor(e.fabricId, e.color);      // 저장된 사진 목록 (찾기가 처음 열릴 때 뒤에서 다시 확인)
        const isCur = !!target && target.c.fabricId === e.fabricId && (target.c.colorName || '') === e.color;
        const starred = finderPicks.includes(e.key);
        // 색 칸: 첫 장은 늘 잰 색, 사진이 있으면 옆으로 밀어 둘째 장(사진). 사진이 없으면 한 장만(점 없음)
        const colorPage = `<div class="finder-sw-page${e.hex ? '' : ' is-none'}"${e.hex ? ` style="background:${e.hex}"` : ''}>${e.hex ? '' : '<span>색 값 없음</span>'}</div>`;
        const photoPage = photo ? finderPhotoPageHtml(photo) : '';
        const dots = photo ? FINDER_SW_DOTS : '';
        return `<article class="finder-card${isCur ? ' is-current' : ''}" data-key="${esc(e.key)}">
            <div class="finder-sw">
                <div class="finder-sw-track">${colorPage}${photoPage}</div>${dots}
                ${isCur ? '<span class="finder-cur">지금 이 칸</span>' : ''}
                <button type="button" class="finder-star${starred ? ' is-on' : ''}" data-star="${esc(e.key)}" aria-pressed="${starred}" aria-label="후보로 별표">${starred ? '★' : '☆'}</button>
            </div>
            <div class="finder-info" aria-hidden="true">
                <div class="finder-tags">${tags}</div>
                ${acts}
            </div>
            <button type="button" class="finder-head" data-head aria-expanded="false">
                <span class="finder-head-txt"><span class="finder-name">${esc(title)}</span><span class="finder-meta">${esc(meta)}</span></span>
                <span class="finder-chev" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></span>
            </button>
            ${put}
        </article>`;
    }).join('') + '</div>';
}
// ==============================================================
// 색 사전 (직원 전용, 10-17): 원단 색마다 "디자이너가 쓰는 색 이름"을 색 값(밝기·붉은기·노란기)으로 붙임
//  - 책자의 색 이름(색상 입력표 "색 이름")은 책자 안에서만 구분됨 → 책자를 넘으면 같은 "그레이지"도 서로 다른 색
//  - 여기 이름은 모든 책자에 같은 기준: 아래 표의 기준 색 가운데 가장 가까운 것 하나 (밝기 차이는 절반만 셈 → 색 기운이 더 중요)
//  - 고객 화면·찾기에는 나오지 않음. 이름을 바꾸거나 더하려면 아래 표 한 줄만 고치면 됨 [한글, 영어, 밝기 L, 붉은기 a, 노란기 b, 계열]
// ==============================================================
const PRO_COLOR_NAMES = [
    // 화이트
    ['퓨어 화이트', 'Pure White', 94, 0, 0.5, 'white'], ['스노우', 'Snow', 93, -1, -3, 'white'], ['초크', 'Chalk', 93, -0.3, 4, 'white'],
    ['아이보리', 'Ivory', 93, -0.3, 8, 'white'], ['바닐라', 'Vanilla', 92, 0.5, 13, 'white'], ['포슬린', 'Porcelain', 93, 3, 4.5, 'white'],
    // 그레이 (색 기운 거의 없음)
    ['포그', 'Fog', 86, 0, 0.5, 'gray'], ['도브 그레이', 'Dove Gray', 79, 0, 0.5, 'gray'], ['애쉬', 'Ash', 72, 0, 0.5, 'gray'], ['페블', 'Pebble', 64, 0, 0.5, 'gray'],
    ['퓨터', 'Pewter', 56, 0, 0.5, 'gray'], ['스모크', 'Smoke', 48, 0, 0.5, 'gray'], ['그래파이트', 'Graphite', 39, 0, 0.5, 'gray'], ['차콜', 'Charcoal', 30, 0, 0.5, 'gray'], ['오닉스', 'Onyx', 21, 0, 0.5, 'gray'],
    // 쿨 그레이 (푸른 기운)
    ['미스트', 'Mist', 86, -1, -3, 'cool'], ['실버', 'Silver', 79, -1, -3, 'cool'], ['스틸 그레이', 'Steel Gray', 71, -1, -3, 'cool'], ['슬레이트 그레이', 'Slate Gray', 62, -1, -3, 'cool'],
    ['건메탈', 'Gunmetal', 52, -1, -3, 'cool'], ['스톰', 'Storm', 41, -1, -3, 'cool'], ['미드나잇', 'Midnight', 31, -1, -3, 'cool'], ['잉크', 'Ink', 21, -1, -3, 'cool'],
    // 그레이지 (회색 + 옅은 노란 기운)
    ['리넨', 'Linen', 86, -0.3, 4, 'greige'], ['퍼티', 'Putty', 79, -0.3, 4, 'greige'], ['그레이지', 'Greige', 72, -0.3, 4, 'greige'], ['스톤', 'Stone', 64, -0.3, 4, 'greige'],
    ['드리프트우드', 'Driftwood', 56, -0.3, 4, 'greige'], ['딥 그레이지', 'Deep Greige', 48, -0.3, 4, 'greige'], ['웜 차콜', 'Warm Charcoal', 39, -0.3, 4, 'greige'],
    // 베이지·샌드 (노란 기운이 더)
    ['에크루', 'Ecru', 86, -0.3, 8, 'beige'], ['오트밀', 'Oatmeal', 79, -0.3, 8, 'beige'], ['비스킷', 'Biscuit', 72, -0.3, 8, 'beige'], ['카키', 'Khaki', 64, -0.3, 8, 'beige'],
    ['헤이즐', 'Hazel', 56, -0.3, 8, 'beige'], ['브론즈', 'Bronze', 48, -0.3, 8, 'beige'],
    ['크림', 'Cream', 86, 0.5, 13, 'beige'], ['샌드', 'Sand', 79, 0.5, 13, 'beige'], ['위트', 'Wheat', 72, 0.5, 13, 'beige'], ['탄', 'Tan', 64, 0.5, 13, 'beige'],
    ['토피', 'Toffee', 56, 0.5, 13, 'beige'], ['토바코', 'Tobacco', 47, 0.5, 13, 'beige'], ['카멜', 'Camel', 62, 6, 24, 'beige'],
    // 로즈 뉴트럴·브라운 (붉은 기운이 살짝)
    ['쉘', 'Shell', 86, 3, 4.5, 'rose'], ['누드', 'Nude', 79, 3, 4.5, 'rose'], ['로즈 더스트', 'Rose Dust', 72, 3, 4.5, 'rose'], ['머쉬룸', 'Mushroom', 64, 3, 4.5, 'rose'],
    ['토프', 'Taupe', 56, 3, 4.5, 'rose'], ['코코아', 'Cocoa', 48, 3, 4.5, 'rose'], ['모카', 'Mocha', 39, 3, 4.5, 'rose'], ['에스프레소', 'Espresso', 30, 3, 4.5, 'rose'],
    ['다크 초콜릿', 'Dark Chocolate', 21, 3, 4.5, 'rose'], ['초콜릿', 'Chocolate', 30, 8, 12, 'rose'],
    // 블루
    ['파우더 블루', 'Powder Blue', 82, -3, -8, 'blue'], ['스카이 블루', 'Sky Blue', 68, -2, -18, 'blue'], ['더스티 블루', 'Dusty Blue', 62, -3, -10, 'blue'],
    ['데님', 'Denim', 45, -3, -16, 'blue'], ['네이비', 'Navy', 28, 2, -14, 'blue'],
    // 그린
    ['민트', 'Mint', 86, -9, 2, 'green'], ['덕에그', 'Duck Egg', 80, -6, -1, 'green'], ['시글라스', 'Sea Glass', 77, -3.5, 1, 'green'], ['유칼립투스', 'Eucalyptus', 62, -7, -1, 'green'],
    ['세이지', 'Sage', 66, -6, 8, 'green'], ['모스', 'Moss', 54, -7, 14, 'green'], ['올리브', 'Olive', 46, -3, 17, 'green'], ['포레스트', 'Forest', 32, -12, 6, 'green'], ['라임', 'Lime', 68, -16, 50, 'green'],
    // 핑크·퍼플
    ['블러쉬', 'Blush', 84, 7, 6, 'pink'], ['더스티 로즈', 'Dusty Rose', 66, 11, 7, 'pink'], ['라벤더', 'Lavender', 78, 6, -9, 'pink'], ['라일락', 'Lilac', 68, 8, -6, 'pink'],
    ['모브', 'Mauve', 55, 8, 0, 'pink'], ['플럼', 'Plum', 32, 14, -4, 'pink'],
    // 옐로·오렌지·레드
    ['버터', 'Butter', 88, -1, 22, 'warm'], ['레몬', 'Lemon', 88, -6, 50, 'warm'], ['머스타드', 'Mustard', 72, 0, 40, 'warm'], ['오커', 'Ochre', 60, 8, 40, 'warm'],
    ['피치', 'Peach', 82, 9, 17, 'warm'], ['코랄', 'Coral', 65, 25, 22, 'warm'], ['테라코타', 'Terracotta', 50, 22, 26, 'warm'], ['러스트', 'Rust', 42, 22, 30, 'warm'], ['와인', 'Wine', 30, 26, 8, 'warm']
];
const PRO_FAM_LABELS = { white: '화이트', gray: '그레이', cool: '쿨 그레이', greige: '그레이지', beige: '베이지·샌드', rose: '로즈 뉴트럴·브라운', blue: '블루', green: '그린', pink: '핑크·퍼플', warm: '옐로·오렌지·레드' };
const PRO_NAME_L_WEIGHT = 0.5;       // 밝기 차이는 절반만 셈 (같은 밝기라도 색 기운이 다르면 다른 이름이 되게)
// 색 값(L·a·b) → { ko, en, fam, L, a, b(기준 색) , d(기준 색과의 거리) }. 값이 없으면 null
function proColorName(L, a, b) {
    if (typeof L !== 'number' || typeof a !== 'number' || typeof b !== 'number') return null;
    let best = null, bd = Infinity;
    PRO_COLOR_NAMES.forEach(n => {
        const d = Math.hypot((L - n[2]) * PRO_NAME_L_WEIGHT, a - n[3], b - n[4]);
        if (d < bd) { bd = d; best = n; }
    });
    return { ko: best[0], en: best[1], fam: best[5], L: best[2], a: best[3], b: best[4], d: bd };
}
// 찾기 카드 한 장(e)의 색 값: 밝기·붉은기·노란기가 없고 색상코드만 있으면 코드에서 셈 (whyFabricColor와 같은 방식)
function dictLabOf(e) {
    if (finderHasLab(e)) return { L: e.L, a: e.a, b: e.b };
    const hex = /^#[0-9a-f]{6}$/i.test(e.hex || '') ? e.hex : null;
    if (!hex || !window.RoomColor || !RoomColor.rgbToLab) return null;
    const n = parseInt(hex.slice(1), 16), lab = RoomColor.rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
    return { L: e.L != null ? e.L : lab.L, a: lab.a, b: lab.b };
}
const DICT_KEYS = ['fam', 'cat', 'book'];
const DICT_SORTS = { name: '이름별로 묶기', light: '밝은 순', dark: '진한 순', book: '책자 순' };
let dictSel = {}; DICT_KEYS.forEach(k => { dictSel[k] = new Set(); });
let dictSort = 'name';
function dictEntries() {
    return finderEntries().map(e => {
        const lab = dictLabOf(e), pro = lab ? proColorName(lab.L, lab.a, lab.b) : null;
        return Object.assign({}, e, { lab, pro, fam: pro ? pro.fam : null, proIdx: pro ? PRO_COLOR_NAMES.findIndex(n => n[0] === pro.ko) : 999 });
    });
}
function dictChipClick(event) {
    const btn = event.target.closest('button[data-v]');
    const box = btn && btn.closest('.dict-chips');
    if (!box) return;
    const set = dictSel[box.dataset.k];
    if (set.has(btn.dataset.v)) set.delete(btn.dataset.v); else set.add(btn.dataset.v);
    renderColorDict();
}
function resetDictFilters() {
    DICT_KEYS.forEach(k => { dictSel[k] = new Set(); });
    const q = document.getElementById('dictQuery'); if (q) q.value = '';
    renderColorDict();
}
function dictSortChange(v) { dictSort = DICT_SORTS[v] ? v : 'name'; renderColorDict(); }
function renderColorDict() {
    const out = document.getElementById('dictOut');
    if (!out) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const all = dictEntries();
    const famDot = f => { const n = PRO_COLOR_NAMES.filter(x => x[5] === f); const m = n[Math.floor(n.length / 2)]; return (window.RoomColor && RoomColor.labToHex) ? RoomColor.labToHex(m[2], m[3], m[4]) : ''; };
    const opts = {
        fam: Object.keys(PRO_FAM_LABELS).filter(f => all.some(e => e.fam === f)).map(f => [f, PRO_FAM_LABELS[f], famDot(f)]),
        cat: [['drape', '겉지'], ['sheer', '속지'], ['blind', '블라인드']].filter(o => all.some(e => e.cat === o[0])),
        book: [...new Set(all.map(e => e.book))].sort((x, y) => x.localeCompare(y, 'ko')).map(b => [b, b])
    };
    document.querySelectorAll('.dict-chips').forEach(box => {
        const k = box.dataset.k;
        dictSel[k].forEach(v => { if (!opts[k].some(o => o[0] === v)) dictSel[k].delete(v); });
        box.innerHTML = opts[k].map(o => `<button type="button" class="finder-chip" data-v="${esc(o[0])}" aria-pressed="${dictSel[k].has(o[0])}">${o[2] ? `<i style="background:${o[2]}"></i>` : ''}${esc(o[1])}</button>`).join('');
    });
    // 글자 검색: 새 이름(한글·영어) · 책자 색 이름 · 원단 · 책자 · 번호
    const q = ((document.getElementById('dictQuery') || {}).value || '').toLowerCase();
    const words = [];
    q.split(/\s+/).filter(Boolean).forEach(w => { const m = /^(\D+)(\d+)$/.exec(w); if (m) words.push(m[1], m[2]); else words.push(w); });
    let list = all.filter(e => {
        if (dictSel.fam.size && !dictSel.fam.has(e.fam)) return false;
        if (dictSel.cat.size && !dictSel.cat.has(e.cat)) return false;
        if (dictSel.book.size && !dictSel.book.has(e.book)) return false;
        if (!words.length) return true;
        const hay = `${e.pro ? e.pro.ko + e.pro.en : ''}${e.label}${e.fabName}${e.book}${e.fabricId}`.toLowerCase().replace(/\s+/g, '');
        const isNo = /^\d+$/.test(e.color);
        return words.every(w => (/^\d+$/.test(w) && isNo) ? parseInt(w, 10) === parseInt(e.color, 10) : hay.includes(w));
    });
    const byBook = (x, y) => `${x.book} ${x.fabName}`.localeCompare(`${y.book} ${y.fabName}`, 'ko') || colorSort({ name: x.color }, { name: y.color });
    const Lof = e => e.lab ? e.lab.L : null;
    const byL = dir => (x, y) => (Lof(x) == null || Lof(y) == null) ? ((Lof(x) == null) - (Lof(y) == null)) || byBook(x, y) : (dir * (Lof(x) - Lof(y))) || byBook(x, y);
    if (dictSort === 'book') list.sort(byBook);
    else if (dictSort === 'dark') list.sort(byL(1));
    else list.sort(byL(-1));
    const sortSel = document.getElementById('dictSort');
    if (sortSel) { sortSel.innerHTML = Object.keys(DICT_SORTS).map(k => `<option value="${k}">${DICT_SORTS[k]}</option>`).join(''); sortSel.value = dictSort; }
    const names = new Set(list.filter(e => e.pro).map(e => e.pro.ko));
    const cnt = document.getElementById('dictCount');
    if (cnt) cnt.innerHTML = `<b class="font-serif-kr">${finderColorTotal(list)}색</b><small>이름 ${names.size}가지 · ${finderFabricTotal(list)}개 원단 · 전체 ${finderColorTotal(all)}색${finderNoColorNote(list)}</small>`;
    if (!all.length) { out.innerHTML = '<div class="finder-empty">보여 줄 원단이 없어요.<br>설정에서 단가표나 비공개 팩을 먼저 불러와 주세요.</div>'; return; }
    if (!list.length) { out.innerHTML = '<div class="finder-empty">조건에 맞는 색이 없어요.<br>조건을 하나씩 빼 보세요.</div>'; return; }
    const num = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
    const grouped = dictSort === 'name';      // 이름별 묶음이면 카드 제목은 원단·번호 (이름은 묶음 머리줄에 있으니 되풀이하지 않음)
    const card = e => {
        const p = e.pro, hex = e.hex || (e.lab && window.RoomColor ? RoomColor.labToHex(e.lab.L, e.lab.a, e.lab.b) : '');
        // 원단 한 줄: "코아 풀달 01 (화이트)" — 괄호 안은 책자에 적힌 색 이름 (견적서 "풀달 1번 (화이트)"와 같은 모양, 10-17 사장님: "책자 이름 ○○"이 헷갈림)
        //  색이 하나뿐인 원단(포아 POA1 등)은 번호를 붙이지 않음
        const where = ((e.color && getFabricColors(e.fabricId).length > 1) ? `${e.book} ${e.fabName} ${e.no}` : `${e.book} ${e.fabName}`) + (e.label ? ` (${e.label})` : '');
        const code = e.lab ? `${(hex || '').toUpperCase()} · L ${num(e.lab.L)} a ${num(e.lab.a)} b ${num(e.lab.b)}` : '색 값 없음';
        return `<article class="finder-card dict-card">
            <div class="finder-sw"><div class="finder-sw-track"><div class="finder-sw-page${hex ? '' : ' is-none'}"${hex ? ` style="background:${hex}"` : ''}>${hex ? '' : '<span>색 값 없음</span>'}</div></div></div>
            <div class="finder-head"><span class="finder-head-txt">
                <span class="finder-name">${grouped ? esc(where) : (p ? `${esc(p.ko)} <em class="dict-en">${esc(p.en)}</em>` : '이름 없음')}</span>
                <span class="finder-meta">${grouped ? '' : esc(where) + '<br>'}<span class="dict-code">${esc(code)}</span></span>
            </span></div>
        </article>`;
    };
    if (dictSort !== 'name') { out.innerHTML = '<div class="finder-grid dict-grid">' + list.map(card).join('') + '</div>'; return; }
    // 이름별로 묶기: 표 순서(계열 → 밝은 것부터)대로, 묶음 안은 밝은 순. 같은 이름 = 책자가 달라도 가까운 색
    const groups = new Map();
    list.forEach(e => { const k = e.pro ? e.pro.ko : ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); });
    const keys = [...groups.keys()].sort((x, y) => (x ? PRO_COLOR_NAMES.findIndex(n => n[0] === x) : 999) - (y ? PRO_COLOR_NAMES.findIndex(n => n[0] === y) : 999));
    out.innerHTML = keys.map(k => {
        const g = groups.get(k), n = k ? PRO_COLOR_NAMES.find(x => x[0] === k) : null;
        const sw = n && window.RoomColor ? RoomColor.labToHex(n[2], n[3], n[4]) : '';
        const books = [...new Set(g.map(e => e.book))];
        return `<section class="dict-group">
            <h4 class="dict-group-h">${sw ? `<i style="background:${sw}"></i>` : ''}<b class="font-serif-kr">${n ? esc(n[0]) : '색 값 없음'}</b>${n ? `<em>${esc(n[1])} · ${PRO_FAM_LABELS[n[5]]}</em>` : ''}<small>${g.length}색 · 책자 ${books.length}개 (${esc(books.join(', '))})</small></h4>
            <div class="finder-grid dict-grid">${g.map(card).join('')}</div>
        </section>`;
    }).join('');
}

// 카드 정보판: 이름 줄을 누르면 그 카드 안에서 색 칸 자리만 덮음 (카드 크기 그대로라 스크롤이 밀리지 않음)
//  - 한 번에 하나만 열림. 다시 그리지 않고 class만 바꿈(밀어 둔 사진·스크롤 그대로). 다시 그리면(거름망·정렬 등) 모두 닫힘
function finderOpenCard(card) {
    const open = card && !card.classList.contains('is-open') ? card : null;
    document.querySelectorAll('#finderOut .finder-card.is-open').forEach(c => { if (c !== open) setFinderCardOpen(c, false); });
    if (card) setFinderCardOpen(card, !!open);
}
function setFinderCardOpen(card, on) {
    card.classList.toggle('is-open', on);
    card.querySelector('.finder-head').setAttribute('aria-expanded', String(on));
    card.querySelector('.finder-info').setAttribute('aria-hidden', String(!on));
}
// 색 칸을 옆으로 밀면 아래 점(지금 장)을 맞춤. scroll은 위로 전해지지 않아 capture로 받음
function finderSwScroll(ev) {
    const t = ev.target;
    if (!t.classList || !t.classList.contains('finder-sw-track')) return;
    const i = Math.round(t.scrollLeft / (t.clientWidth || 1));
    t.parentElement.querySelectorAll('[data-dot]').forEach(d => d.setAttribute('aria-current', String(Number(d.dataset.dot) === i)));
}
document.addEventListener('scroll', finderSwScroll, { capture: true, passive: true });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { closeFinderSlots(); finderOpenCard(null); } });
// 정렬 바꾸기: "고른 색과 비슷한 순"은 카드의 "비슷한 색"을 누른 뒤에만. 다른 정렬을 고르면 비슷한 색 찾기는 끝남
function finderSortChange(value) {
    if (value === 'sim' && (!finderRef || finderSort === 'pair')) showToast('카드의 "비슷한 색"을 먼저 눌러 주세요.', 'info');
    else if (value !== 'pair') { finderSort = ((FINDER_SORTS[value] && !(value === 'price' && staffFinderOnly)) || String(value).startsWith('fit:') || String(value).startsWith('room:')) ? value : 'light'; if (finderSort !== 'sim') finderRef = null; }
    renderFinder();
}
function clearFinderRef() { finderRef = null; finderSort = 'light'; renderFinder(); }

// ---- 후보 모아 보기: 카드의 별표(☆)로 후보를 모으고, "고객에게 보여주기"로 가격·원가 없이 나란히 보여 줌 ----
// 원단 이름에서 괄호(암막률 등)는 떼고 보여 줌
function finderPlainFabName(e) { return String(e.fabName || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); }
function finderPickName(e) { return e.color ? `${e.label ? e.label + ' · ' : ''}${finderPlainFabName(e)} ${e.no}` : finderPlainFabName(e); }
function clearFinderPicks() { finderPicks = []; renderFinder(); }
// 고객에게 보여주기: 직원 화면을 통째로 덮는 화면에 큰 색 칸(사진이 있으면 사진)을 고객 원단 화면과 같은 띠로 나란히 (2~6개)
//  - 띠 글자: 세로 큰 글자 = 원단 이름(책자·괄호·끝의 색 낱말 뺌), 오른쪽 세로 작은 글자 = 색 이름(없으면 "3번"). 가격·느낌 없음
//  - 고르기: 한 번 누르면 강조(흰 밑줄, 나머지 흐리게) → 강조된 칸을 한 번 더 누르면 "○○로 할까요?" 확인 창 → "이걸로 할게요"면 넣을 칸에 넣음(화면은 그대로)
//  - 보여 주는 동안 직원 화면은 잠근 것으로 침(자동 잠금 창이 끼어들지 않게) → 닫으면 PIN 없이 찾기 화면까지만 열림 (setFinderOnly)
let finderShowList = [], finderShowSel = -1, finderShowChanged = false, finderShowDoneTimer = 0;
// 조사: 받침이 있으면 앞 것(을·으로), 없으면 뒤 것(를·로). "으로"는 ㄹ 받침이면 "로". 숫자는 읽는 소리로
function finderJosa(word, withB, withoutB) {
    const s = String(word || '').trim(), last = s.slice(-1), c = last.charCodeAt(0);
    let jong = 0;
    if (c >= 0xAC00 && c <= 0xD7A3) jong = (c - 0xAC00) % 28;
    else if (/[0-9]/.test(last)) jong = [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][Number(last)];
    if (!jong) return s + withoutB;
    if (withB === '으로' && jong === 8) return s + '로';
    return s + withB;
}
// 보여 줄 이름: { name: 원단 이름, color: 색 이름(없으면 "3번"), full: "오솔로 화이트" }
function finderShowName(e) {
    const p = (window.concierge && window.concierge.cardNameParts && window.concierge.cardNameParts(e.fabricId, e.label)) || { name: finderPlainFabName(e), colorTag: e.label };
    const no = String(e.no || e.color || '');
    const color = p.colorTag || (e.color ? (/^\d+$/.test(no) ? `${no}번` : no) : '');
    return { name: p.name, color, full: [p.name, color].filter(Boolean).join(' ') };
}
//  - custom(고객 화면 중심 화면 › 더 보기의 "나란히 보기"): { list, curKey, onPick(e) } — 지금 원단 + 후보. 고르면 onPick, 넣을 칸·담음 표시는 안 씀
let finderShowMode = null;
function openFinderShow(custom) {
    const all = custom ? null : finderEntries();
    const picks = custom ? custom.list : finderPicks.map(k => all.find(e => e.key === k)).filter(Boolean).slice(0, FINDER_PICK_MAX);
    const box = document.getElementById('finderShow'), canvas = document.getElementById('finderShowCanvas');
    if (!box || !canvas || !window.concierge) return;
    if (picks.length < 2) { if (!custom) showToast('후보를 2개 이상 별표해 주세요. (6개까지)', 'info'); return; }
    finderShowMode = custom || null;
    const head = box.querySelector('.step-head');
    if (head) head.innerHTML = custom ? '<p class="step-q font-serif-kr">어느 쪽이 더 마음에 드세요?</p><p class="step-sub">한 번 누르면 표시되고, 한 번 더 누르면 정해요</p>' : '<p class="step-q font-serif-kr">마음에 드는 색을 골라 보세요</p>';
    finderShowList = picks; finderShowSel = -1; finderShowChanged = false;
    canvas.style.setProperty('--items-count', picks.length);
    canvas.innerHTML = picks.map((e, i) => {
        const n = finderShowName(e), clean = s => String(s).replace(/[<>&"]/g, '');
        // 색 값도 사진도 없는 원단은 지어낸 색을 보여 주지 않고 "샘플북으로" (가로 글)
        const look = e.hex || photoFor(e.fabricId, e.color);
        return window.concierge.bookmarkCard(clean(n.name), clean(look ? n.color : '샘플북으로 보여 드릴게요'), '', e.hex || 'var(--brand-panel)', function() { finderShowTap(i); }, look ? 'vdesc' : '');
    }).join('');
    Array.from(canvas.children).forEach((card, i) => {
        const e = picks[i], img = document.createElement('img');
        card.insertAdjacentHTML('beforeend', '<span class="finder-show-put" aria-hidden="true">✓ 담음</span>');
        if (custom && e.key === custom.curKey) card.insertAdjacentHTML('beforeend', '<span class="finder-show-now">지금</span>');
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
    finderShowMarks();
    closeFinderShowAsk();
    box.classList.remove('hidden');
    document.documentElement.style.overflow = 'hidden';         // 뒤의 직원 화면이 밀리지 않게
    if (appMode === 'staff') { staffLocked = true; setStaffLockedUi(true); }
}
// 강조(고른 칸) · 담음(넣을 칸에 지금 들어 있는 원단) 표시를 맞춤
function finderShowMarks() {
    const canvas = document.getElementById('finderShowCanvas');
    if (!canvas) return;
    const t = finderShowMode ? null : finderTargetCurtain();      // 나란히 보기(custom)에는 "담음" 표시 없음
    canvas.classList.toggle('has-sel', finderShowSel >= 0);
    Array.from(canvas.children).forEach((card, i) => {
        const e = finderShowList[i];
        card.classList.toggle('is-sel', i === finderShowSel);
        card.classList.toggle('is-put', !!t && !!e && t.c.fabricId === e.fabricId && (t.c.colorName || '') === e.color);
    });
}
function finderShowTap(i) {
    if (!finderShowList[i]) return;
    if (finderShowSel !== i) { finderShowSel = i; finderShowMarks(); return; }
    openFinderShowAsk();
}
// 확인 창: "오솔로 화이트로 할까요?" [이걸로 할게요 / 다시 고를게요]. 넣을 칸이 없으면 같은 창이 "어느 칸에 담을까요?"로 바뀜
const finderShowEsc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function openFinderShowAsk() {
    const e = finderShowList[finderShowSel], ask = document.getElementById('finderShowAsk');
    if (!e || !ask) return;
    ask.querySelector('.finder-show-ask-in').innerHTML = `<p class="finder-show-ask-q font-serif-kr">${finderShowEsc(finderJosa(finderShowName(e).full, '으로', '로'))} 할까요?</p>`
        + '<div class="finder-show-ask-acts"><button type="button" class="is-yes font-serif-kr" data-ask="yes">이걸로 할게요</button><button type="button" class="font-serif-kr" data-ask="no">다시 고를게요</button></div>';
    ask.classList.remove('hidden');
}
function closeFinderShowAsk() {
    const ask = document.getElementById('finderShowAsk');
    if (!ask || ask.classList.contains('hidden')) return false;
    ask.classList.add('hidden');
    return true;
}
// 넣을 칸 고르기: 같은 종류 칸(속지 색 → 속지 칸 …)만, 공간 · 칸 이름만 (지금 들어 있는 원단·가격은 안 보임)
function finderShowSlots(e) {
    const ask = document.getElementById('finderShowAsk');
    const slots = [];
    rooms.forEach(r => r.curtains.forEach(c => { if (finderCurtainKind(c) === e.cat) slots.push({ r, c }); }));
    ask.querySelector('.finder-show-ask-in').innerHTML = slots.length
        ? '<p class="finder-show-ask-q font-serif-kr">어느 칸에 담을까요?</p><div class="finder-show-ask-acts is-slots">'
            + slots.map(s => `<button type="button" class="font-serif-kr" data-ask-slot="${s.r.id}:${s.c.id}">${finderShowEsc(s.r.name)} · ${finderShowEsc(s.c.label)}</button>`).join('')
            + '</div><div class="finder-show-ask-acts"><button type="button" class="font-serif-kr" data-ask="no">다시 고를게요</button></div>'
        : `<p class="finder-show-ask-q font-serif-kr">담을 ${FINDER_KIND_WORDS[e.cat]} 칸이 아직 없어요</p><div class="finder-show-ask-acts"><button type="button" class="font-serif-kr" data-ask="no">닫기</button></div>`;
}
function finderShowAskClick(ev) {
    const btn = ev.target.closest('button');
    if (!btn) { if (!ev.target.closest('.finder-show-ask-in')) closeFinderShowAsk(); return; }      // 판 밖 = 다시 고를게요
    const e = finderShowList[finderShowSel];
    if (btn.dataset.ask === 'no' || !e) { closeFinderShowAsk(); return; }
    if (finderShowMode) { const m = finderShowMode; closeFinderShow(); m.onPick(e); return; }      // 나란히 보기: 정하면 닫고 그 칸을 바꿈
    if (btn.dataset.askSlot) {
        const [roomId, curtainId] = btn.dataset.askSlot.split(':').map(Number);
        finderTarget = { roomId, curtainId };       // 고른 칸이 "넣을 칸"이 됨 → 다음에 고르면 같은 칸이 바뀜
    }
    const t = finderTargetCurtain();
    if (!t) { finderShowSlots(e); return; }
    finderApplyPut(t, e);
    finderShowChanged = true;
    closeFinderShowAsk();
    finderShowMarks();
    // 위에 작은 판으로 1.5초: "거실 · 속지에 오솔로 화이트를 담았어요"
    const done = document.getElementById('finderShowDone');
    if (done) {
        done.textContent = `${t.room.name} · ${t.c.label}에 ${finderJosa(finderShowName(e).full, '을', '를')} 담았어요`;
        done.classList.add('on');
        clearTimeout(finderShowDoneTimer);
        finderShowDoneTimer = setTimeout(() => done.classList.remove('on'), 1500);
    }
}
function closeFinderShow() {
    const box = document.getElementById('finderShow');
    if (box) box.classList.add('hidden');
    closeFinderShowAsk();
    const done = document.getElementById('finderShowDone');
    if (done) done.classList.remove('on');
    finderShowSel = -1;
    finderShowMode = null;
    document.documentElement.style.overflow = '';
    if (appMode === 'staff' && staffLocked) { staffLocked = false; setStaffLockedUi(false); lastActivity = Date.now(); setFinderOnly(true); }
    if (finderShowChanged) { finderShowChanged = false; renderFinder(); }       // 찾기 카드에 "지금 이 칸" 표시
}
function setFinderView(view) { finderView = view === 'map' ? 'map' : 'grid'; renderFinder(); }

// ==============================================================
// 중심 화면 › 더 보기 (고객 화면, 작업목록 20번 4단계 · 72번): 카드 ↔ 색 지도 → 눌러서 후보 1~4 → 지금 원단과 후보 비교하기
//  - 직원 원단 찾기와 같은 목록(finderEntries) · 카드 모양(finder-card) · 잇기 계산(roomLinkDistance). 가격·책자·꼬리표·숫자 없음
//  - 거름망은 고객이 알아듣는 말만: 밝기 · 결 · 비침(속지) / 빛 가림(겉지) + 순서(카드 보기에서만). PIN 없이 고객이 직접 씀
//  - 72번: 왼쪽 세로 판(공간 이름 · 보기 전환 · 잇는 방향 · 조건 · 후보 칸)과 오른쪽 넓은 카드·지도. 글자는 20·16·14px 세 가지만
// ==============================================================
const MORE_STAR_MAX = 4;
const MORE_FILTERS = {
    bright: { label: '밝기', opts: { light: '밝은 색', mid: '중간 색', dark: '진한 색' }, of: e => e.L == null ? null : (e.L >= 85 ? 'light' : (e.L >= 55 ? 'mid' : 'dark')) },
    tex: { label: '결', opts: { smooth: '매끈한', natural: '결 있는', cozy: '도톰한' }, of: e => e.texture },
    see: { label: '비침', kind: 'sheer', opts: { clear: '많이 비침', soft: '적당히 비침', day: '거의 안 비침' }, of: e => ({ light: 'clear', medium: 'soft', day: 'day', heavy: 'day' })[e.density] || null },      // 72번: 판정 대신 사실
    block: { label: '빛 가림', kind: 'drape', opts: { life: '생활 암막', full: '완전 암막' }, of: e => (e.blackout === 'life' || e.blackout === 'full') ? e.blackout : null }
};
const MORE_SORTS = { fit: '추천 순', sameColor: '지금 색과 가까운 순', light: '밝은 순', dark: '진한 순' };      // 72번
const MORE_DIRS = ['wall', 'bridge', 'floor'];      // 잇는 방향 (28번 · 72번): 벽 색 기준 / 벽·바닥 사이 / 바닥 색 기준 — 색 잇기 화면과 같은 말
const MORE_MAP_W = 900, MORE_MAP_H = 640;      // 지도 비율 (72번: 오른쪽 자리에 맞춰 900×500 → 900×640)
let spaceMore = null;       // { roomId, idx, view: 'cards' | 'map', face: 'color' | 'photo'(74번), stars: [키], focus: 키, sel: { 묶음: Set }, sameFab, sort, sheet: 키, dir: 잇는 방향(이 화면에서만) }
function openSpaceMore(roomId, idx) {
    const slot = window.concierge && window.concierge.spaceSlot(roomId, idx);
    if (!slot) return;
    // 잇는 방향 처음 값 = 그 칸에서 고른 방향 → 공간의 색 잇기 답 → 그 중간으로. 바꿔도 공간의 답(room.linkDir)은 그대로
    const mc = slot.room.measuredColor, dir = (mc && mc.wall && mc.floor) ? (slot.curtain.pickDir || slot.room.linkDir || 'bridge') : null;
    spaceMore = { roomId, idx, view: 'cards', face: 'color', stars: [], focus: null, sel: { bright: new Set(), tex: new Set(), see: new Set(), block: new Set() }, sameFab: false, sort: 'fit', sheet: null, dir, mapK: 1 };
    let ov = document.getElementById('spaceMore');
    if (!ov) {
        ov = document.createElement('div');
        ov.id = 'spaceMore';
        ov.className = 'more-overlay';
        ov.addEventListener('click', spaceMoreClick);
        ov.addEventListener('change', ev => {
            if (ev.target.matches('select[data-msort]')) { spaceMore.sort = ev.target.value; renderSpaceMore(); }
        });
        // 화면 크기가 바뀌면 지도 글씨를 다시 맞춤 (72번)
        window.addEventListener('resize', () => { if (spaceMore && spaceMore.view === 'map') renderSpaceMore(); });
        document.body.appendChild(ov);
    }
    ov.hidden = false;
    renderSpaceMore();
}
function closeSpaceMore() {
    const ov = document.getElementById('spaceMore');
    if (ov) { ov.hidden = true; ov.innerHTML = ''; }
    spaceMore = null;
}
// 지금 칸의 공간·원단과 같은 종류 색 목록. cur = 지금 들어 있는 색(목록에 없을 수도)
function spaceMoreData() {
    const slot = window.concierge.spaceSlot(spaceMore.roomId, spaceMore.idx);
    if (!slot) return null;
    const all = finderEntries().filter(e => e.cat === slot.kind);
    const cur = finderFind(all, slot.curtain.fabricId, slot.curtain.colorName || '');      // 삼보텍스·콤비 짝처럼 같은 원단 묶음의 색이면 그 카드 (58번)
    const curKey = cur ? cur.key : slot.curtain.fabricId + '__' + (slot.curtain.colorName || '');
    const curFabId = (cur && cur.fabricId) || slot.curtain.fabricId;
    const curGroup = (cur && cur.group) || ((all.find(e => e.twins && e.twins.includes(curFabId)) || {}).group) || curFabId;
    const curFab = (typeof FABRIC_DB !== 'undefined' ? FABRIC_DB.find(f => f.id === curFabId) : null);
    const curFabName = (cur ? finderShowName(cur).name : (curFab && curFab.name)) || '지금 원단';
    const sameFabCount = finderColorTotal(all.filter(e => (e.group || e.fabricId) === curGroup));
    return { slot, all, cur, curKey, curFabId, curGroup, curFabName, sameFabCount };
}
function spaceMoreOk(e, curGroup) {
    if (spaceMore && spaceMore.sameFab && curGroup && (e.group || e.fabricId) !== curGroup) return false;
    return Object.keys(MORE_FILTERS).every(k => !spaceMore.sel[k].size || spaceMore.sel[k].has(MORE_FILTERS[k].of(e)));
}
// 우리 집에 어울리는 점수: 고객 원단 화면 추천과 같은 계산 (기존 추천 점수 + 색 잇기 점수). 색 잇기는 이 화면에서 고른 잇는 방향으로
function spaceMoreFit(e, room) {
    const cat = e.cat === 'sheer' ? '속지' : '겉지';
    const linkRoom = spaceMore.dir ? Object.assign({}, room, { linkDir: spaceMore.dir }) : room;
    return calculateFabricMatchScore(e.view, room, cat) + roomLinkBonus({ light: e.L, a: e.a, b: e.b }, linkRoom);
}
const moreEsc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
function renderSpaceMore() {
    const ov = document.getElementById('spaceMore'), d = spaceMore && spaceMoreData();
    if (!ov || !d) { closeSpaceMore(); return; }
    const { slot, curFabName, sameFabCount } = d, room = slot.room;
    const mc = room.measuredColor, measured = !!(mc && mc.wall && mc.floor);
    const keep = (ov.querySelector('.more-body') || {}).scrollTop || 0, keepSide = (ov.querySelector('.more-side') || {}).scrollTop || 0;
    // 거름망 (지도에서는 순서 없음). 여러 개 고를 수 있음. 이름표(밝기·결 …) 없이 칩 말만 (72번)
    const grp = k => {
        const f = MORE_FILTERS[k];
        if (f.kind && f.kind !== slot.kind) return '';
        return '<div class="more-fg">' + Object.keys(f.opts).map(v => `<button type="button" class="more-chip${spaceMore.sel[k].has(v) ? ' on' : ''}" data-mf="${k}:${v}" aria-pressed="${spaceMore.sel[k].has(v)}">${f.opts[v]}</button>`).join('') + '</div>';
    };
    const any = Object.values(spaceMore.sel).some(s => s.size) || spaceMore.sameFab || (spaceMore.sort !== 'fit');
    // 왼쪽 세로 판 (72번): 뒤로 + 카드/색 지도 → 잇는 방향 → 조건 → (카드) 색·사진 → 후보 칸 4개 → 후보 비교하기
    //  74번: 공간 이름·겉지 글자는 뺌(그 칸을 눌러 들어왔으니)
    let h = '<aside class="more-side">';
    h += '<div class="more-top"><button type="button" class="more-back" data-mclose aria-label="뒤로"><i class="fa-solid fa-arrow-left"></i></button>';
    h += `<div class="more-seg"><button type="button" class="${spaceMore.view === 'cards' ? 'on' : ''}" data-mview="cards">카드</button><button type="button" class="${spaceMore.view === 'map' ? 'on' : ''}" data-mview="map">색 지도</button></div></div>`;
    // 잇는 방향 (벽·바닥을 둘 다 잰 공간만, 카드·지도 둘 다): 세 줄이 늘 보이고 고른 줄만 왼쪽 선. 카드 "추천 순"과 지도 점선 원이 따라 바뀜
    if (measured) h += '<div class="more-dirs">' + MORE_DIRS.map(k => `<button type="button" class="${spaceMore.dir === k ? 'on' : ''}" data-mdir="${k}" aria-pressed="${spaceMore.dir === k}">${window.concierge.linkWord(k)}</button>`).join('') + '</div>';
    h += '<div class="more-fbar">';
    if (sameFabCount > 1) h += `<div class="more-fg"><button type="button" class="more-chip more-chip-fab${spaceMore.sameFab ? ' on' : ''}" data-msamefab="1" aria-pressed="${spaceMore.sameFab}">${moreEsc(curFabName)} ${sameFabCount}색만</button></div>`;
    h += grp('bright') + grp('tex') + grp('see') + grp('block');
    if (spaceMore.view === 'cards') h += '<select class="more-sort" data-msort aria-label="순서">' + Object.keys(MORE_SORTS).map(k => `<option value="${k}"${spaceMore.sort === k ? ' selected' : ''}>${MORE_SORTS[k]}</option>`).join('') + '</select>';
    if (any) h += '<button type="button" class="more-clear" data-mclear>조건 풀기</button>';
    h += '</div>';
    // 색·사진 (74번, 카드 보기에서만): 카드를 한꺼번에 색 장 / 사진 장으로. 견본은 지금 원단(사진이 없으면 사진 있는 첫 색). 사진이 하나도 없으면 안 보임
    if (spaceMore.view === 'cards') {
        const withPh = [d.cur].concat(d.all).filter(Boolean).map(e => ({ e, ph: photoFor(e.fabricId, e.color) })).find(x => x.ph);
        if (withPh) {
            const hex = (d.cur && d.cur.hex) || withPh.e.hex || 'var(--brand-panel)';
            const face = (f, bg, word) => `<button type="button" class="${spaceMore.face === f ? 'on' : ''}" data-mface="${f}" aria-pressed="${spaceMore.face === f}"><i style="background:${bg}"></i><span>${word}</span></button>`;
            h += '<div class="more-face">' + face('color', hex, '색') + face('photo', `url('${moreEsc(withPh.ph)}') center / cover no-repeat, ${hex}`, '사진') + '</div>';
        }
    }
    // 후보 칸 4개: 처음부터 빈 칸이 보이고, 담으면 색과 번호가 채워짐. 칸을 누르면 빠짐
    h += '<div class="more-cands">' + Array.from({ length: MORE_STAR_MAX }, (_, i) => {
        const k = spaceMore.stars[i], e = k && d.all.find(x => x.key === k);
        if (!k) return '<span class="more-cand"></span>';
        return `<button type="button" class="more-cand is-on" data-mstar="${moreEsc(k)}" aria-label="후보 ${i + 1}번 빼기" style="background:${(e && e.hex) || 'var(--brand-panel)'}"><em>${i + 1}</em></button>`;
    }).join('') + '</div>';
    h += `<button type="button" class="more-cmp font-serif-kr" data-mside${spaceMore.stars.length ? '' : ' disabled'}>후보 비교하기 →</button>`;
    h += '</aside>';
    h += `<div class="more-main"><div class="more-body${spaceMore.view === 'map' ? ' is-map' : ''}">${spaceMore.view === 'map' ? spaceMoreMapHtml(d) : spaceMoreCardsHtml(d)}</div>${spaceMoreSheetHtml(d)}</div>`;
    ov.innerHTML = h;
    const body = ov.querySelector('.more-body'), side = ov.querySelector('.more-side');
    if (body) body.scrollTop = spaceMore.focus ? 0 : keep;
    if (side) side.scrollTop = keepSide;
    // 사진으로 보기 (74번): 사진이 있는 카드는 둘째 장(사진)으로 넘겨 둠. 다시 그려도(후보 담기 등) 사진 그대로
    if (spaceMore.view === 'cards' && spaceMore.face === 'photo') ov.querySelectorAll('.more-card .finder-sw-track').forEach(t => { if (t.children.length > 1) t.scrollLeft = t.clientWidth; });
    // 지도 글씨: 그려진 크기를 재서 실제로 보이는 글씨가 14px이 되게 맞춤 (72번). 크기가 달라졌으면 한 번 다시 그림
    const svg = spaceMore.view === 'map' && ov.querySelector('.more-map svg');
    if (svg) {
        const r = svg.getBoundingClientRect(), s = Math.min(r.width / MORE_MAP_W, r.height / MORE_MAP_H);
        if (s > 0) { const k = 1 / s; if (Math.abs(k - spaceMore.mapK) / spaceMore.mapK > 0.02) { spaceMore.mapK = k; renderSpaceMore(); } }
    }
}
// 카드: 지금 원단이 맨 앞("지금"), 지도에서 "카드로 보기"를 누른 색이 그다음, 나머지는 순서대로 (조건에 맞는 것만)
function spaceMoreCardsHtml(d) {
    const room = d.slot.room;
    let list = d.all.filter(e => e.key !== d.curKey && spaceMoreOk(e, d.curGroup));
    if (spaceMore.sort === 'light' || spaceMore.sort === 'dark') {
        const s = spaceMore.sort === 'light' ? -1 : 1;
        list.sort((x, y) => (x.L == null) - (y.L == null) || s * ((x.L || 0) - (y.L || 0)));
    } else if (spaceMore.sort === 'sameColor') {
        const cur = d.cur;
        if (cur && cur.L != null) {
            const curL = cur.L, curA = cur.a || 0, curB = cur.b || 0;
            const distCache = new Map();
            const getDist = x => {
                if (distCache.has(x)) return distCache.get(x);
                if (x.L == null) return 9999;
                const dL = x.L - curL;
                const da = (x.a != null && cur.a != null) ? (x.a - curA) : 0;
                const db = (x.b != null && cur.b != null) ? (x.b - curB) : 0;
                const val = Math.hypot(dL, da, db);
                distCache.set(x, val);
                return val;
            };
            list.sort((x, y) => {
                const diff = getDist(x) - getDist(y);
                if (Math.abs(diff) > 0.05) return diff;
                return spaceMoreFit(y, room) - spaceMoreFit(x, room);
            });
        } else {
            list.forEach(e => { e.mfit = spaceMoreFit(e, room); });
            list.sort((x, y) => y.mfit - x.mfit);
        }
    } else {
        list.forEach(e => { e.mfit = spaceMoreFit(e, room); });
        list.sort((x, y) => y.mfit - x.mfit);
    }
    const shown = finderColorTotal(list);      // 등록된 색만 (58번)
    if (spaceMore.focus) { const f = list.find(e => e.key === spaceMore.focus) || d.all.find(e => e.key === spaceMore.focus); if (f && f.key !== d.curKey) list = [f].concat(list.filter(e => e.key !== f.key)); }
    if (d.cur) list = [d.cur].concat(list);
    // 72번: 별표 대신 카드 아무 데나 누르면 후보에 담김(사진 넘기는 점은 그대로). 담긴 카드는 먹선 테두리 + 오른쪽 위 번호
    const card = e => {
        const n = finderShowName(e), isCur = e.key === d.curKey, no = spaceMore.stars.indexOf(e.key) + 1;
        const photo = photoFor(e.fabricId, e.color);
        const colorPage = `<div class="finder-sw-page${e.hex ? '' : ' is-none'}"${e.hex ? ` style="background:${e.hex}"` : ''}>${e.hex ? '' : '<span>샘플북</span>'}</div>`;
        return `<article class="finder-card more-card${isCur ? ' is-current' : ''}${no ? ' is-on' : ''}${e.key === spaceMore.focus ? ' is-focus' : ''}"${isCur ? '' : ` data-mstar="${moreEsc(e.key)}" aria-pressed="${!!no}"`}>`
            + `<div class="finder-sw"><div class="finder-sw-track">${colorPage}${photo ? finderPhotoPageHtml(photo) : ''}</div>${photo ? FINDER_SW_DOTS : ''}`
            + (isCur ? '<span class="finder-cur">지금</span>' : (no ? `<span class="more-no">${no}</span>` : ''))
            + `</div><div class="more-fbody"><b class="font-serif-kr">${moreEsc(n.name)}</b><span>${moreEsc(n.color)}${photo ? '' : ' · 샘플북'}</span></div></article>`;
    };
    const empty = shown ? '' : '<p class="more-empty">조건에 맞는 색이 없어요</p>';
    return `<div class="finder-grid more-grid">${list.map(card).join('')}</div>${empty}`;
}
// 색 지도 (고객용): 위 밝은 색 · 아래 진한 색 · 왼쪽 차가운 색 · 오른쪽 따뜻한 색 (숫자 없음, 72번 말). 같은 종류 원단만, 겹친 점은 살짝 띄움
//  우리 집 바닥·벽 표지와 둘을 잇는 띠, 고른 잇기 자리(점선 원), 지금 원단은 "지금". 조건에 안 맞는 점은 흐리게. 후보는 먹선 고리 + 번호
//  글씨 fs = 화면에서 14px로 보이는 지도 단위(renderSpaceMore가 잰 mapK), 글씨 둘레 여백도 fs에 맞춤
function spaceMoreMapHtml(d) {
    const room = d.slot.room, mc = room.measuredColor, measured = !!(mc && mc.wall && mc.floor);
    const pool = d.all.filter(e => e.L != null && e.b != null && e.hex);
    if (!pool.length) return '<p class="more-empty">색 값이 들어온 원단이 아직 없어요</p>';
    const fs = 14 * (spaceMore.mapK || 1);
    const W = MORE_MAP_W, H = MORE_MAP_H, P = { l: fs * 5.6 + 14, r: fs * 5.6 + 14, t: fs * 2 + 12, b: fs * 2 + 16 };
    const fur = (mc && Array.isArray(mc.furniture) ? mc.furniture : []).filter(f => typeof f.L === 'number' && typeof f.b === 'number');      // 가구 색 (37번)
    const Ls = pool.map(e => e.L).concat(measured ? [mc.wall.L, mc.floor.L] : []), bs = pool.map(e => e.b).concat(measured ? [mc.wall.b, mc.floor.b] : []);
    // 눈금은 색 대부분(위아래 3%를 뺀 범위)과 우리 집 벽·바닥·가구에 맞춤. 멀리 떨어진 몇 색은 가장자리에 붙여 찍음 (가운데가 뭉치지 않게)
    const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round((s.length - 1) * p)))]; };
    const homeL = (measured ? [mc.wall.L, mc.floor.L] : []).concat(fur.map(f => f.L)), homeB = (measured ? [mc.wall.b, mc.floor.b] : []).concat(fur.map(f => f.b));
    const Lmin = Math.min(q(Ls, 0.03), ...homeL) - 3, Lmax = Math.max(q(Ls, 0.97), ...homeL) + 2, bmin = Math.min(q(bs, 0.03), ...homeB) - 2, bmax = Math.max(q(bs, 0.97), ...homeB) + 2;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const X = b => P.l + (clamp(b, bmin, bmax) - bmin) / ((bmax - bmin) || 1) * (W - P.l - P.r);
    const Y = L => P.t + (Lmax - clamp(L, Lmin, Lmax)) / ((Lmax - Lmin) || 1) * (H - P.t - P.b);
    let g = '';
    [0.25, 0.5, 0.75].forEach(f => { const y = Y(Lmin + (Lmax - Lmin) * f).toFixed(1); g += `<line class="more-gl" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/>`; });
    [1 / 3, 2 / 3].forEach(f => { const x = X(bmin + (bmax - bmin) * f).toFixed(1); g += `<line class="more-gl" y1="${P.t}" y2="${H - P.b}" x1="${x}" x2="${x}"/>`; });
    g += `<text class="more-ax" x="${W / 2}" y="${(P.t - 10).toFixed(1)}" text-anchor="middle">↑ 밝은 색</text><text class="more-ax" x="${W / 2}" y="${H - 10}" text-anchor="middle">↓ 진한 색</text>`;
    g += `<text class="more-ax" x="${(P.l - 10).toFixed(1)}" y="${H / 2}" text-anchor="end">차가운 색</text><text class="more-ax" x="${(W - P.r + 10).toFixed(1)}" y="${H / 2}">따뜻한 색</text>`;
    if (measured) {
        g += `<line x1="${X(mc.floor.b).toFixed(1)}" y1="${Y(mc.floor.L).toFixed(1)}" x2="${X(mc.wall.b).toFixed(1)}" y2="${Y(mc.wall.L).toFixed(1)}" stroke="#e3c9b4" stroke-width="26" stroke-linecap="round" opacity=".55"/>`;
    }
    // 고른 잇기 자리(점선 원)와 우리 집 벽·바닥 표지는 점 위에 그림 (가려지지 않게)
    let top = '';
    if (measured) {
        const dir = spaceMore.dir;      // 이 화면의 잇는 방향 (28번)
        const tgt = dir === 'bridge' ? mc.bridge : (dir === 'wall' ? mc.wall : (dir === 'floor' ? { L: Math.min(88, mc.floor.L + FLOOR_LIFT), b: mc.floor.b } : null));
        if (tgt) { const tx = X(tgt.b), ty = Y(tgt.L); top += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="26" fill="none" stroke="#b8714a" stroke-width="2" stroke-dasharray="4 4"/><text class="more-lbl more-halo" x="${(tx + 32).toFixed(1)}" y="${(ty - 16).toFixed(1)}">${window.concierge.linkWord(dir)}</text>`; }
        const home = (c, txt) => `<g class="more-home"><rect x="${(X(c.b) - 15).toFixed(1)}" y="${(Y(c.L) - 15).toFixed(1)}" width="30" height="30" rx="3" fill="${c.hex}"/><text class="more-halo" x="${(X(c.b) + 22).toFixed(1)}" y="${(Y(c.L) + fs * 0.36).toFixed(1)}">${txt}</text></g>`;
        top += home(mc.wall, '벽') + home(mc.floor, '바닥');
    }
    // 가구: 작은 마름모(18px, 45° 돌린 네모) + 이름 ("소파"). 점 위에 그림
    fur.forEach(f => {
        const fx = X(f.b), fy = Y(f.L);
        top += `<g class="more-home"><rect x="${(fx - 9).toFixed(1)}" y="${(fy - 9).toFixed(1)}" width="18" height="18" fill="${f.hex}" stroke="#fff" stroke-width="2" transform="rotate(45 ${fx.toFixed(1)} ${fy.toFixed(1)})"/><text class="more-halo" x="${(fx + 18).toFixed(1)}" y="${(fy + fs * 0.36).toFixed(1)}">${moreEsc(window.RoomColor && RoomColor.furLabel ? RoomColor.furLabel(f.n) : f.n)}</text></g>`;
    });
    // 겹친 점은 서로 밀어 살짝 띄움 (위치는 보기용, 색 값은 그대로)
    const pts = pool.map(e => ({ e, x: X(e.b), y: Y(e.L) }));
    for (let k = 0; k < 40; k++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], c = pts[j], dx = c.x - a.x, dy = c.y - a.y, dd = Math.hypot(dx, dy) || 0.01, need = 21;
        if (dd < need) { const m = (need - dd) / 2, ux = dx / dd, uy = dy / dd; a.x -= ux * m; a.y -= uy * m; c.x += ux * m; c.y += uy * m; }
    }
    pts.forEach(p => { p.x = clamp(p.x, P.l - 20, W - P.r + 20); p.y = clamp(p.y, P.t, H - P.b); });
    const curPt = pts.find(p => p.e.key === d.curKey);
    const rank = e => e.key === d.curKey ? 2 : (spaceMore.stars.includes(e.key) ? 1 : 0);      // 지금 · 후보 점이 맨 위
    const dots = pts.sort((p, q) => rank(p.e) - rank(q.e)).map(({ e, x, y }) => {
        const isCur = e.key === d.curKey, no = spaceMore.stars.indexOf(e.key) + 1, bs = fs * 1.4;
        const badge = no ? `<rect class="more-no-bg" x="${(x + 6).toFixed(1)}" y="${(y - 6 - bs).toFixed(1)}" width="${bs.toFixed(1)}" height="${bs.toFixed(1)}"/><text class="more-no-tx" x="${(x + 6 + bs / 2).toFixed(1)}" y="${(y - 6 - bs / 2 + fs * 0.36).toFixed(1)}" text-anchor="middle">${no}</text>` : '';
        return `<g class="more-dot${isCur ? ' is-cur' : ''}${no ? ' is-on' : ''}${isCur || no || spaceMoreOk(e, d.curGroup) ? '' : ' is-off'}" data-mpt="${moreEsc(e.key)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isCur || no ? 13 : 10}" fill="${e.hex}"/>${badge}</g>`;
    }).join('');
    const curLbl = curPt ? `<text class="more-lbl more-halo" x="${curPt.x.toFixed(1)}" y="${(curPt.y + 16 + fs).toFixed(1)}" text-anchor="middle">지금</text>` : '';
    return `<div class="more-map"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="--mfs-map:${fs.toFixed(2)}px">${g}${dots}${top}${curLbl}</svg></div>`;
}
// 지도에서 누른 점: 아래 작은 판 (사진 · 원단 · 색 이름 · 지금 색과 견준 말 · 후보에 담기 / 카드로 보기 / 닫기)
function spaceMoreSheetHtml(d) {
    if (!spaceMore.sheet || spaceMore.view !== 'map') return '';
    const e = d.all.find(x => x.key === spaceMore.sheet);
    if (!e) return '';
    const cur = d.cur, n = finderShowName(e), isCur = e.key === d.curKey, st = spaceMore.stars.includes(e.key), photo = photoFor(e.fabricId, e.color);
    let word = '지금 고른 색이에요.';
    if (!isCur && cur && cur.L != null && e.L != null && cur.b != null && e.b != null) {
        const lw = e.L > cur.L + 1 ? '밝고' : (e.L < cur.L - 1 ? '진하고' : '비슷한 밝기에');
        const bw = e.b > cur.b + 1.5 ? '조금 더 따뜻해요' : (e.b < cur.b - 1.5 ? '조금 더 차가워요' : '결이 비슷해요');      // 지도 축 말과 같게 (72번)
        word = `지금 색보다 ${lw} ${bw}.`;
    } else if (!isCur) word = '';
    return `<div class="more-sheet"><div class="more-sheet-ph" style="${photo ? `background-image:url('${photo}');` : ''}background-color:${e.hex || 'var(--brand-panel)'}"></div>`
        + `<div class="more-sheet-tx"><b class="font-serif-kr">${moreEsc(n.name)}</b><span>${moreEsc(n.color)}</span><small>${word}${photo ? '' : ' 샘플북으로 직접 보여 드릴게요.'}</small>`
        + `<div class="more-sheet-bt">${isCur ? '' : `<button type="button" class="more-go font-serif-kr" data-mstar="${moreEsc(e.key)}">${st ? '후보에서 빼기' : '후보에 담기'}</button>`}`
        + `<button type="button" class="more-sub" data-mfocus="${moreEsc(e.key)}">카드로 보기</button><button type="button" class="more-sub" data-msheet-close>닫기</button></div></div></div>`;
}
function spaceMoreClick(ev) {
    if (!spaceMore) return;
    const t = ev.target, by = sel => t.closest(sel);
    let b;
    if (by('[data-mclose]')) { closeSpaceMore(); return; }
    if ((b = by('[data-mface]'))) { spaceMore.face = b.dataset.mface; renderSpaceMore(); return; }      // 색·사진 한꺼번에 (74번)
    if ((b = by('[data-mview]'))) { spaceMore.view = b.dataset.mview; spaceMore.sheet = null; spaceMore.focus = null; renderSpaceMore(); return; }
    if ((b = by('[data-mdir]'))) { spaceMore.dir = b.dataset.mdir; spaceMore.focus = null; renderSpaceMore(); return; }      // 잇는 방향 (72번: 고르는 상자 → 세 줄)
    if ((b = by('[data-mf]'))) { const [k, v] = b.dataset.mf.split(':'), s = spaceMore.sel[k]; s.has(v) ? s.delete(v) : s.add(v); renderSpaceMore(); return; }
    if ((b = by('[data-msamefab]'))) { spaceMore.sameFab = !spaceMore.sameFab; renderSpaceMore(); return; }
    if (by('[data-mclear]')) { Object.values(spaceMore.sel).forEach(s => s.clear()); spaceMore.sameFab = false; spaceMore.sort = 'fit'; renderSpaceMore(); return; }
    if ((b = by('button[data-dot]'))) { const tr = b.closest('.finder-sw').querySelector('.finder-sw-track'); tr.scrollTo({ left: tr.clientWidth * Number(b.dataset.dot), behavior: 'smooth' }); return; }      // 사진 넘기는 점은 담기보다 먼저 (72번)
    if ((b = by('[data-mstar]'))) {
        const k = b.dataset.mstar, st = spaceMore.stars;
        if (st.includes(k)) spaceMore.stars = st.filter(x => x !== k);
        else if (st.length >= MORE_STAR_MAX) { showMoreNote('후보는 4개까지예요'); return; }
        else st.push(k);
        if (b.closest('.more-sheet')) spaceMore.sheet = null;      // 점 판에서 담기·빼기를 누르면 판이 닫힘 (10-15 사장님)
        renderSpaceMore(); return;
    }
    if ((b = by('[data-mfocus]'))) { spaceMore.focus = b.dataset.mfocus; spaceMore.sheet = null; spaceMore.view = 'cards'; renderSpaceMore(); return; }
    if (by('[data-msheet-close]')) { spaceMore.sheet = null; renderSpaceMore(); return; }
    if ((b = by('[data-mpt]'))) { spaceMore.sheet = b.dataset.mpt; renderSpaceMore(); return; }
    if ((b = by('[data-mside]')) && !b.disabled) { openSpaceSide(); return; }
}
function showMoreNote(msg) {
    const ov = document.getElementById('spaceMore');
    if (!ov) return;
    let n = ov.querySelector('.more-note');
    if (!n) { n = document.createElement('div'); n.className = 'more-note'; ov.appendChild(n); }
    n.textContent = msg; n.classList.add('on');
    clearTimeout(showMoreNote.t); showMoreNote.t = setTimeout(() => n.classList.remove('on'), 1600);
}
// 후보 비교하기(예전 이름 "나란히 보기"): 지금 원단 + 후보를 고객 원단 화면과 같은 띠 카드로 (19번 "고객에게 보여주기"와 같은 화면·같은 고르기)
function openSpaceSide() {
    const d = spaceMoreData();
    if (!d) return;
    const list = [d.cur].concat(spaceMore.stars.map(k => d.all.find(e => e.key === k))).filter(Boolean);
    const { roomId, idx } = spaceMore;
    // 이 화면의 잇는 방향이 공간의 색 잇기 답과 다르면 그 칸에 pickDir로 적음 (원단을 고른 이유 카드가 칸마다 따름, 28번)
    const base = d.slot.room.linkDir || 'bridge', dir = spaceMore.dir;
    const pickDir = (dir && dir !== base) ? dir : null;
    openFinderShow({ list, curKey: d.curKey, onPick: e => {
        closeSpaceMore();
        if (e.key !== d.curKey) window.concierge.swapCurtain(roomId, idx, e.fabricId, e.color, { pickDir });      // 바꾸면 중심 화면에 "되돌리기" 알림
    } });
}
// 색 지도: 가로 = 노란기 b(왼쪽 쿨 · 오른쪽 웜), 세로 = 밝기 L(위가 밝음). 지금 조건에 맞는 색은 진하고 크게, 나머지는 흐리게
// 색 값(밝기·노란기)이 없는 색은 지도에 나오지 않음. 노란기가 눈금 밖(-12 미만 · 30 초과)인 색은 가장자리에 찍힘
// mc: 방 색을 잰 공간의 measuredColor면 [벽]·[바닥] 표지, 둘을 잇는 띠, 이어주는 색 동그라미를 같이 그림
function finderMapHtml(all, on, ref, mc) {
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
    const missing = finderColorTotal(all) - finderColorTotal(pts);      // 색이 없는 원단의 빈 카드는 세지 않음 (58번)
    // 우리 집: 띠·점선은 원단 점 아래, 표지·이어주는 색은 위에 (표지 글씨는 점 오른쪽, 오른쪽 끝이면 왼쪽)
    let under = '', over = '';
    if (mc) {
        const mark = (c, label, color) => {
            const cx = x(c.b), cy = y(c.L), right = cx < W - 110;
            return `<g class="finder-map-home" pointer-events="none"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="${c.hex}" stroke="${color}" stroke-width="3"/>`
                + `<rect x="${(right ? cx + 13 : cx - 13 - 74).toFixed(1)}" y="${(cy - 10).toFixed(1)}" width="74" height="20" rx="5" fill="${color}"/>`
                + `<text x="${(right ? cx + 50 : cx - 50).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="middle" fill="#fffdf9" font-weight="700">${label} 밝기 ${Math.round(c.L)}</text></g>`;
        };
        if (mc.wall && mc.floor) {
            const l = `x1="${x(mc.wall.b).toFixed(1)}" y1="${y(mc.wall.L).toFixed(1)}" x2="${x(mc.floor.b).toFixed(1)}" y2="${y(mc.floor.L).toFixed(1)}"`;
            under = `<g class="finder-map-bridge" pointer-events="none"><line class="band" ${l} stroke-width="38" stroke-linecap="round"/><line class="axis" ${l} stroke-width="2" stroke-dasharray="5 4"/></g>`;
        }
        if (mc.bridge) {
            const bx = x(mc.bridge.b), by = y(mc.bridge.L);
            over += `<g class="finder-map-bridge" pointer-events="none"><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="12" fill="none" stroke="#8a4a22" stroke-width="2.5"/><text x="${(bx - 16).toFixed(1)}" y="${(by + 4).toFixed(1)}" text-anchor="end" fill="#8a4a22" font-weight="700">이어주는 색</text></g>`;
        }
        if (mc.wall) over += mark(mc.wall, '벽', '#2b221a');
        if (mc.floor) over += mark(mc.floor, '바닥', '#8a4a22');
    }
    return `<div class="finder-map"><svg data-map viewBox="0 0 ${W} ${H}" role="img" aria-label="원단 색을 밝기와 웜·쿨로 펼친 지도">${g}${under}${dots}${over}</svg></div>
        <p class="finder-map-hint">위로 갈수록 밝고, 오른쪽으로 갈수록 노란기(웜)가 많아요. 진한 점이 지금 조건에 맞는 색이고, 점을 누르면 그 색과 비슷한 색을 찾습니다. 점이 비어 있는 곳은 갖고 있는 책자에 없는 색이라, 새 책자를 고를 때도 참고가 됩니다.${missing ? ` (색 값이 없는 ${missing}색은 지도에 나오지 않아요.)` : ''}${mc ? '<br>짙은 표지가 잰 벽, 흙빛 표지가 잰 바닥이에요. 둘을 잇는 띠 안이 벽과 바닥을 이어주는 색이고, 동그라미(벽 6.5 : 바닥 3.5, 임시)에 가까울수록 벽 쪽에 어울려요.' : ''}</p>`;
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
// 카드의 버튼: "비슷한 색" = 그 색과 가까운 색 찾기 / "이 공간에 넣기" = 넣을 칸의 원단과 색상 번호를 바꾸고 상담 화면으로 돌아감(찾기만 열린 상태면 찾기 화면에 머묾)
function finderClick(event) {
    const starBtn = event.target.closest('button[data-star], button[data-unstar]');
    if (starBtn) {
        const key = starBtn.dataset.star || starBtn.dataset.unstar;
        const all = finderEntries();
        if (finderPicks.includes(key)) finderPicks = finderPicks.filter(k => k !== key);
        else if (finderPicks.filter(k => all.some(e => e.key === k)).length >= FINDER_PICK_MAX) showToast(`후보는 ${FINDER_PICK_MAX}개까지예요. 하나를 빼고 다시 눌러 주세요.`, 'info');
        else finderPicks.push(key);
        // 카드는 다시 그리지 않고 별표만 바꿈 (열어 둔 정보판·밀어 둔 사진이 그대로 있게)
        const on = finderPicks.includes(key);
        document.querySelectorAll('#finderOut button[data-star]').forEach(b => {
            if (b.dataset.star !== key) return;
            b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '★' : '☆';
        });
        renderFinderPicks(all);
        return;
    }
    const head = event.target.closest('button[data-head]');
    if (head) { finderOpenCard(head.closest('.finder-card')); return; }
    const dot = event.target.closest('button[data-dot]');
    if (dot) {
        const t = dot.closest('.finder-sw').querySelector('.finder-sw-track');
        t.scrollTo({ left: t.clientWidth * Number(dot.dataset.dot), behavior: 'smooth' });
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
    const slotBtn = event.target.closest('button[data-slot]');
    if (slotBtn) {
        const [roomId, curtainId] = slotBtn.dataset.slot.split(':').map(Number);
        const key = slotBtn.closest('.finder-slots').dataset.key;
        closeFinderSlots();
        finderTarget = { roomId, curtainId };       // 고른 칸이 "넣을 칸"이 됨 → 찾기만 열린 상태면 다른 색을 바로 바꿔 넣을 수 있음
        finderPut(key);
        return;
    }
    if (event.target.closest('button[data-slot-close]')) { closeFinderSlots(); return; }
    const btn = event.target.closest('button[data-pick]');
    if (!btn) return;
    if (!finderTargetCurtain()) { openFinderSlots(btn.closest('.finder-card'), btn.dataset.pick); return; }
    finderPut(btn.dataset.pick);
}
// 넣을 칸(finderTarget)에 그 색을 넣음
function finderPut(key) {
    const t = finderTargetCurtain();
    const e = finderEntries().find(x => x.key === key);
    if (!t || !e) { finderTarget = null; renderFinder(); showToast('넣을 칸을 찾지 못했어요. 상담 화면에서 "찾기"를 다시 눌러 주세요.', 'error'); return; }
    finderApplyPut(t, e);
    // 찾기만 열린 상태: 상담 화면으로 가지 않고(PIN이 필요) 넣을 칸도 그대로 둠 → 다른 색을 누르면 바로 바뀜
    if (staffFinderOnly) { renderFinder(); showToast(`${e.fabName}${colorSuffix(e.color, e.fabricId)} → ${t.room.name} · ${t.c.label} 칸에 넣었어요. 다른 색을 누르면 바뀝니다.`); return; }
    finderTarget = null;
    showStaffView('consult');
    const sub = document.getElementById(`curtainSub_${t.c.id}`);
    const card = sub && sub.closest('.staff-curtain');
    if (card) card.scrollIntoView({ block: 'center' });
    showToast(`${e.fabName}${colorSuffix(e.color, e.fabricId)} → ${t.room.name} · ${t.c.label} 칸에 넣었어요.`);
}
// 칸에 원단 + 색상 번호를 넣음 (찾기 카드의 "이 공간에 넣기"와 "고객에게 보여주기"의 "이걸로 할게요"가 같이 씀)
function finderApplyPut(t, e) {
    collapsedRooms.delete(t.room.id);
    updateCurtainData(t.room.id, t.c.id, 'fabricId', e.fabricId);      // 원단이 바뀌면 색상 번호가 비워지므로, 색은 그다음에 넣음
    t.c.colorName = e.color;
    delete t.c.toneStep; delete t.c.pickDir; delete t.c.baseFabricId; delete t.c.baseColorName;      // 다른 방법으로 바꾸면 이유 카드의 한 톤·잇는 방향·사다리 기준은 지움 (28·49번)
    renderRooms();
    calculateAll();
}
// "어느 칸에 넣을까요?" 판: 넣을 칸이 안 정해졌을 때 그 카드 위에 뜸. 같은 종류 칸(속지 색 → 속지 칸 …)만, 하나뿐이어도 띄움
//  - 칸 옆에는 지금 들어 있는 원단 이름만 작게 (단가·가격은 넣지 않음 — 고객과 같이 보는 상태에서도 씀)
const FINDER_KIND_WORDS = { drape: '겉지', sheer: '속지', blind: '블라인드' };
function openFinderSlots(card, key) {
    closeFinderSlots();
    const e = finderEntries().find(x => x.key === key);
    if (!card || !e) return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    const slots = [];
    rooms.forEach(r => r.curtains.forEach(c => { if (finderCurtainKind(c) === e.cat) slots.push({ r, c }); }));
    const now = c => { const f = FABRIC_DB.find(x => x.id === c.fabricId); return f ? `${f.name}${colorSuffix(c.colorName, f.id)}` : ''; };
    const box = document.createElement('div');
    box.className = 'finder-slots';
    box.dataset.key = key;
    box.setAttribute('role', 'dialog');
    box.innerHTML = `<div class="finder-slots-head"><b>어느 칸에 넣을까요?</b><button type="button" data-slot-close>닫기</button></div>`
        + (slots.length ? '<div class="finder-slots-list">' + slots.map(s => `<button type="button" data-slot="${s.r.id}:${s.c.id}"><span>${esc(s.r.name)} · ${esc(s.c.label)}</span><small>${esc(now(s.c))}</small></button>`).join('') + '</div>'
            : `<p class="finder-slots-none">이 공간에 ${FINDER_KIND_WORDS[e.cat]} 칸이 없어요. 상담에서 칸을 먼저 추가해 주세요.</p>`);
    card.appendChild(box);
    const put = card.querySelector('.finder-acts.is-put');
    if (put) box.style.bottom = put.offsetHeight + 'px';      // 넣기 버튼 바로 위까지 덮음
    card.classList.add('is-slots');
}
function closeFinderSlots() {
    const open = document.querySelectorAll('#finderOut .finder-slots');
    open.forEach(b => { b.closest('.finder-card').classList.remove('is-slots'); b.remove(); });
    return open.length > 0;
}
// 판 밖을 누르면 닫기만 함 (뒤의 카드·버튼은 눌리지 않게)
document.addEventListener('click', ev => {
    const box = document.querySelector('#finderOut .finder-slots');
    if (!box || box.contains(ev.target)) return;
    ev.stopPropagation(); ev.preventDefault();
    closeFinderSlots();
}, true);

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
            { id: curtainIdCounter++, label: "속지", presetType: "sheer", width: 200, height: 200, pleat: "2.0", pleatType: "나비주름", bookFilter: "ALL", fabricId: defFab, installType: "rail", floorGap: 0, hwName: "기본 레일", hwPrice: hwPriceOf('rail'), shapeFee: 0, leadBand: true, hotelFit: false, rates: optionRatesNow('rail') }
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
    let hwPrice = hwPriceOf('rail');
    let appliedPreset = presetType;
    let newLabel = getNextCurtainLabel(room, presetType);

    if (presetType === "sheer") {
        const sheerFab = FABRIC_DB.find(f => f.categoryType === "속지");
        if (sheerFab) targetFabId = sheerFab.id;
        leadBand = true;
    } else if (presetType === "drape") {
        const drapeFab = FABRIC_DB.find(f => f.categoryType === "겉지");
        if (drapeFab) targetFabId = drapeFab.id;
        shapeFee = 1;      // 켜짐 표시 (금액은 rates의 설정 단가)
    } else if (presetType === "blind") {
        const blindFab = FABRIC_DB.find(f => f.categoryType === "블라인드");
        if (blindFab) targetFabId = blindFab.id;
    } else if (presetType === "panel") {
        const panelFab = FABRIC_DB.find(f => f.categoryType === "겉지") || FABRIC_DB[0];
        if (panelFab) targetFabId = panelFab.id;
        pleat = "panel";
        pleatType = "패널";
        installType = "rail_2line";
        hwName = HW_NAMES.rail_2line;
        hwPrice = hwPriceOf('rail_2line');
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
        hotelFit: false,
        rates: optionRatesNow(installType)      // 지금 설정의 가공·부자재 단가 (29번, 나중에 단가를 바꿔도 이 품목 금액은 그대로)
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
// 직원 화면 공간 카드의 창 방향 (35번): 고객 화면과 같은 규칙(최대 2개, 반대쪽은 못 고름, 다시 누르면 꺼짐)
function staffWindowDirHtml(room) {
    const cur = windowDirOf(room.windowDir), txt = windowDirText(cur);
    const btns = ['E', 'W', 'S', 'N'].map(d => {
        const on = cur.includes(d), off = !on && (cur.includes(WINDOW_DIR_OPP[d]) || cur.length >= 2);
        return `<button type="button" class="staff-dir-btn${on ? ' on' : ''}"${off ? ' disabled' : ''} onclick="toggleRoomWindowDir(${room.id}, '${d}')">${WINDOW_DIR_WORD[d]}</button>`;
    }).join('');
    return `<div class="rc-summary staff-dir"><span class="rc-sum-lbl">창 방향</span>${btns}<span class="staff-dir-val">${txt ? txt + '쪽' : '모름'}</span></div>`;
}
function toggleRoomWindowDir(roomId, d) {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    let cur = windowDirOf(room.windowDir);
    if (cur.includes(d)) cur = cur.filter(x => x !== d);
    else if (!cur.includes(WINDOW_DIR_OPP[d]) && cur.length < 2) cur.push(d);
    room.windowDir = cur;
    renderRooms();
    calculateAll();
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
        // 기구를 고르면 설정의 자당 단가가 들어감 (29번). rates가 있는 품목은 그 기구의 원가도 같이 바꿔 적음
        const t = HW_TYPES.includes(val) ? val : 'rail';
        c.hwName = HW_NAMES[t];
        c.hwPrice = hwPriceOf(t);
        if (c.rates && c.rates.cost) c.rates.cost.hw = optionCosts().rail[t];
        renderRooms();
    }
    if (c.fabricId !== prevFabricId) c.colorName = '';
    if (c.fabricId !== prevFabricId || key === 'colorName') { delete c.toneStep; delete c.pickDir; delete c.baseFabricId; delete c.baseColorName; }      // 직원 화면에서 원단·색을 바꾸면 한 톤·잇는 방향·사다리 기준은 지움 (28·49번)
    const optEl = document.getElementById(`curtainOpt_${c.id}`);
    if (optEl) optEl.textContent = curtainOptionSummary(c);
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
// 커튼 카드의 "세부 옵션"(가공 형태·설치 기구·바닥 간격·부자재 품명·형상기억·리드밴드·호텔핏): 자주 안 바꾸는 칸이라 접어 둠
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
        return `<button type="button" data-id="${esc(f.id)}" class="${f.id === input.dataset.fabricId ? 'is-current' : ''}">${esc(f.book)} ${esc(f.name)}<small>${esc(f.categoryType || '')} · ${spec}</small></button>`;
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
        const fab = FABRIC_DB.find(f => f.id === input.dataset.fabricId) || (typeof sampleBlindFabric === 'function' ? sampleBlindFabric(input.dataset.fabricId) : null);
        input.value = fabricSearchLabel(fab);
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
            let curFab = FABRIC_DB.find(f => f.id === c.fabricId) || (typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null);
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
                                <input type="text" value="${escText(fabricSearchLabel(curFab))}" data-fabric-id="${curFab ? escText(curFab.id) : ''}" autocomplete="off" placeholder="예: 데미안 몽크, 암막" onfocus="this.select(); renderFabricSearch(this, true)" oninput="renderFabricSearch(this)" onkeydown="fabricSearchKey(event, this)" onblur="closeFabricSearch(this)" class="fab-name-input w-full px-2 rounded-lg bg-white outline-none min-w-0">
                                <div class="fabric-combo-list custom-scrollbar" hidden onmousedown="event.preventDefault()" onclick="pickFabricFromSearch(event, ${room.id}, ${c.id})"></div>
                            </div>
                            ${isBlind && !finderHasBlind ? '' : `<button type="button" onclick="openFabricFinder(${room.id}, ${c.id})" title="색으로 원단 찾기" class="staff-btn whitespace-nowrap flex-shrink-0">찾기</button>`}
                        </div>
                        ${colorSelect}
                        ${isBlind && blindStripeMm(curFab) ? `<div class="text-[10px] text-slate-400 mt-0.5">줄 폭 참고: 솔리드 ${blindStripeMm(curFab).solid}mm · 쉬어 ${blindStripeMm(curFab).sheer}mm</div>` : ''}
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

                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                                <div class="min-w-0">
                                    <label class="block text-[10px] font-bold text-slate-500 mb-0.5 truncate">부자재 품명</label>
                                    <input type="text" value="${isBlind ? '미사용' : c.hwName}" ${isBlind ? 'disabled' : ''} oninput="updateCurtainData(${room.id}, ${c.id}, 'hwName', this.value)" class="w-full px-1.5 sm:px-2 py-1 border rounded-lg text-xs outline-none min-w-0 bg-white">
                                </div>
                                <div class="min-w-0">
                                    <label class="block text-[10px] font-bold text-slate-500 mb-0.5 truncate">형상기억 가공</label>
                                    <select ${isBlind ? 'disabled' : ''} onchange="updateCurtainData(${room.id}, ${c.id}, 'shapeFee', this.value === 'on' ? ${c.rates ? 1 : 3000} : 0)" class="w-full px-1 py-1 border rounded-lg text-xs font-semibold outline-none min-w-0 bg-white">
                                        <option value="on" ${!isBlind && c.shapeFee > 0 ? "selected" : ""}>적용</option>
                                        <option value="off" ${isBlind || !(c.shapeFee > 0) ? "selected" : ""}>미적용</option>
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
                    <button type="button" onclick="RoomColor.open(${room.id})" class="staff-btn accent whitespace-nowrap">방 색 재기</button>
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
            ${window.RoomColor ? RoomColor.summaryHtml(room) : ''}
            ${staffWindowDirHtml(room)}
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


// 원단 목록의 단가(원단원가·기본가공비·소비자판매단가)는 평소 가림. "단가 보기"를 누른 동안만 보이고,
// 원단 목록 탭을 떠나거나 화면이 잠기면 다시 가림 (기기에 저장하지 않음 — 고객이 옆에 있을 수 있어서)
var dbPricesShown = false;     // var: 파일을 다 읽기 전에 renderDbTable이 불려도 되게
function toggleDbPrices(on) {
    dbPricesShown = (on === undefined) ? !dbPricesShown : !!on;
    const btn = document.getElementById('dbPriceBtn');
    if (btn) { btn.textContent = dbPricesShown ? '단가 가리기' : '단가 보기'; btn.setAttribute('aria-pressed', String(dbPricesShown)); }
    renderDbTable();
}
function hideDbPrices() { if (dbPricesShown) toggleDbPrices(false); }

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
            (f.engName && f.engName.toLowerCase().includes(searchKeyword)) ||
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
        const hid = '<span class="text-slate-300 tracking-widest">●●●</span>';
        let laborText = !dbPricesShown ? hid : (pv ? `${(pv.labor||0).toLocaleString()}원/${f.unit||'마'}` : '—');
        let costText = !dbPricesShown ? hid : (pv ? `${(pv.cost||0).toLocaleString()}원` : '—');
        const priceText = dbPricesShown ? `${(f.price||0).toLocaleString()}원/${f.unit||'폭'}` : hid;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition text-xs">
                <td class="p-2.5 font-bold text-amber-900">
                    <div class="text-[10px] text-slate-400 font-normal">${f.book}${pv && pv.supplier ? ` · ${pv.supplier}` : ''} [${f.id}]</div>
                    <div class="text-slate-800 font-semibold">${f.name}${f.engName ? ` <span class="text-stone-400 font-mono text-[11px] font-normal">[${f.engName}]</span>` : ''}</div>
                </td>
                <td class="p-2.5 font-mono">${calcBadge}</td>
                <td class="p-2.5 font-mono text-slate-500">${costText}</td>
                <td class="p-2.5 font-mono text-amber-800">${laborText}</td>
                <td class="p-2.5 font-mono font-bold text-indigo-950">${priceText}</td>
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
        // 직원 화면이면 책자 옆에 공급처(회사)를 붙임: "데미안 · 대명 (28개)" (10-17). 공급처는 비공개 팩에만 있음
        const supOf = b => {
            if (typeof Costing === 'undefined' || !Costing.costOf) return '';      // 이 목록은 직원 화면(원단 탭)에만 있음
            const s = [...new Set(FABRIC_DB.filter(f => f.book === b).map(f => (Costing.costOf(f.id) || {}).supplier).filter(Boolean))];
            return s.length ? ` · ${s.join('·')}` : '';
        };
        books.forEach(b => {
            const count = FABRIC_DB.filter(f => f.book === b).length;
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = `${b}${supOf(b)} (${count}개)`;
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
// 품목별 추천 이유 (사장님이 분류한 원단 + 진단을 거친 공간만. 아니면 빈칸)
function ticketItemReason(r, c) {
    if (!r || !r.diagnosed || !c || !c.fabricId) return '';
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return '상담 때 실물 샘플로 보여 드릴게요';
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return '';
    const cat = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : '겉지');
    const col = c.colorName ? getFabricColors(f.id).find(x => x.name === normalizeColorName(c.colorName)) : null;
    const view = (col && col.tone) ? Object.assign({}, f, { tone: col.tone, manual: Object.assign({}, f.manual, { tone: true }) }) : f;
    try { return recommendReason(view, r, cat) || ''; } catch (e) { return ''; }
}
// "원단을 고른 이유" 카드 셋째 줄: 손님이 답한 조건(바깥 시선·빛 가림·강한 햇빛)을 이 원단이 지켜 주는 점 하나. 없으면 빈칸(그 줄만 생략)
function ticketKeepWord(r, c) {
    if (!r || !r.diagnosed || !c || !c.fabricId) return '';
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return '상담 때 실물 샘플로 보여 드릴게요.';
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return '';
    const cat = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : '겉지');
    const col = c.colorName ? getFabricColors(f.id).find(x => x.name === normalizeColorName(c.colorName)) : null;
    const view = (col && col.tone) ? Object.assign({}, f, { tone: col.tone, manual: Object.assign({}, f.manual, { tone: true }) }) : f;
    try { return recommendReason(view, r, cat, 1, true) || ''; } catch (e) { return ''; }
}
// 고객에게 보여 줄 원단 이름: 괄호(폭·암막률·단가 등)·가격·앞의 책자 이름을 빼고, 색 표시(예: 3번 (그레이지))는 붙임
function ticketFabricName(c, calc) {
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return sf.name;
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return (calc && calc.fabName) || c.label || '원단';
    let n = String(f.name || '').replace(/\([^)]*\)/g, ' ').replace(/[0-9,]+\s*원/g, ' ').replace(/\s+/g, ' ').trim();
    const book = String(f.book || '').trim();
    if (book && n.startsWith(book + ' ')) n = n.slice(book.length).trim();
    return (n || String(f.name || '원단')) + colorSuffix(c.colorName, f.id);
}// 견적서 원단 칸 이름 (75번, 10-25 사장님): 책자에 적힌 원단 이름 + 색 번호만. 예) 블랑 1번
//  책자·공급처 이름, 괄호(폭·단가), 색 이름 괄호는 뺌. 색이 하나뿐인 원단(POA1 등)은 번호 없이 이름만
function ticketBookName(c) {
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return sf.name;
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return c.name || '원단';
    let n = String(f.name || '').replace(/\([^)]*\)/g, ' ').replace(/[0-9,]+\s*원/g, ' ').replace(/\s+/g, ' ').trim();
    const book = String(f.book || '').trim();
    if (book && n.startsWith(book + ' ')) n = n.slice(book.length).trim();
    n = n || String(f.name || '원단');
    const k = normalizeColorName(c.colorName);
    if (!k) return n;
    if (!/^\d+$/.test(k)) return `${n} ${k}`;
    return getFabricColors(f.id).length < 2 ? n : `${n} ${k}번`;
}

// 손님이 가져가는 글(견적서·이유 카드·우리 집 색)의 원단 표기 (61번): 책자·원단 이름·색 번호 대신 "색 이름 · 재질"
//  예: 그레이지 · 결 있는 질감 · 생활암막 / 아이보리 · 콤비 블라인드 · 암막. 원단 이름은 직원 화면과 고객 화면 최종 제안에만
const PLAIN_TEXTURE_WORDS = { smooth: '매끈한 질감', natural: '결 있는 질감', cozy: '포근한 질감' };
const PLAIN_BLIND_WORDS = { combi: '콤비 블라인드', roll: '롤스크린', print: '프린트 블라인드' };
function ticketPlainName(c, calc) {
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return sf.name;
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return ticketFabricName(c, calc);
    // 색 이름: 직원이 붙인 색 이름 → 색 값으로 지은 이름 → 톤
    let color = c.colorName ? colorLabelOf(f.id, c.colorName) : '';
    if (!color) {
        const lab = whyFabricColor(f.id, c.colorName);
        const nm = (lab && typeof lab.L === 'number' && window.RoomColor && RoomColor.colorName) ? RoomColor.colorName('wall', lab) : null;
        color = (nm && nm.name) || '';
    }
    if (!color) {
        const col = c.colorName ? getFabricColors(f.id).find(x => x.name === normalizeColorName(c.colorName)) : null;
        const tone = (col && col.tone) || f.tone;
        color = TONE_LABELS[tone] ? `${TONE_LABELS[tone]} 톤` : '';
    }
    const parts = [];
    if (c.presetType === 'blind' || f.categoryType === '블라인드') {
        const k = blindKind(f), bl = blindLight(f);
        parts.push(PLAIN_BLIND_WORDS[k] || '블라인드');
        if (bl === 'full') parts.push('암막'); else if (bl === 'see') parts.push('투시');
    } else {
        if (PLAIN_TEXTURE_WORDS[f.texture]) parts.push(PLAIN_TEXTURE_WORDS[f.texture]);
        if (c.presetType === 'sheer' || f.categoryType === '속지') {
            if (DENSITY_LABELS[f.density]) parts.push(DENSITY_LABELS[f.density]);
        } else {
            const bo = blackoutLevel(f);
            if (bo) parts.push(bo === 'mid' ? '보통 암막' : BLACKOUT_LABELS[bo]);
        }
    }
    const out = [color, ...parts].filter(Boolean).join(' · ');
    return out || ticketFabricName(c, calc);
}
// 원단 색과 벽·바닥 색의 관계 (61번): 같은 색 계열에 밝기만 다르면 톤온톤, 색 계열은 달라도 밝기·선명함이 비슷하면 톤인톤
//  잰 벽 → 잰 바닥 순으로 먼저 맞는 것 하나. 못 재었거나 둘 다 아니면 빈칸
function ticketToneWord(r, c) {
    const fab = c && c.fabricId ? whyFabricColor(c.fabricId, c.colorName) : null;
    if (!fab || typeof fab.L !== 'number') return '';
    const mc = (r && r.measuredColor) || {};
    for (const [k, word] of [['wall', '벽'], ['floor', '바닥']]) {
        const w = whyLabOf(mc[k]);
        if (!w) continue;
        const dL = Math.abs(fab.L - w.L), dC = Math.abs(fab.C - w.C);
        let dh = Math.abs(Math.atan2(fab.b, fab.a) - Math.atan2(w.b, w.a)) * 180 / Math.PI; if (dh > 180) dh = 360 - dh;
        const same = (fab.C < 6 && w.C < 6) || (fab.C >= 6 && w.C >= 6 && dh <= 30);
        if (same) return dL >= 8 ? `${word}과 톤온톤` : `${word}과 비슷한 색`;
        if (fab.C >= 6 && w.C >= 6 && dL < 10 && dC < 10) return `${word}과 톤인톤`;
    }
    return '';
}
// 품목 종류 (속지 / 겉지 / 블라인드)
function ticketKindLabel(c) {
    return c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : (c.presetType === 'drape' ? '겉지' : '커튼'));
}
// 사진이 없을 때 원단 칸을 채우는 색: 고른 색(없으면 원단)의 톤으로 짐작. 제안서·견적서·첫 화면 공간 칸이 함께 씀
const FABRIC_TONE_FILL = { warm: '#dcc3a4', cool: '#b9c4cb', neutral: '#d3cdc3', deep: '#7a695c' };
function fabricToneFill(fabricId, colorName) {
    const f = FABRIC_DB.find(x => x.id === fabricId) || (typeof sampleBlindFabric === 'function' ? sampleBlindFabric(fabricId) : null);
    if (!f) return '#d9cdbb';
    const col = colorName ? getFabricColors(f.id).find(x => x.name === normalizeColorName(colorName)) : null;
    return FABRIC_TONE_FILL[(col && col.tone) || f.tone] || '#d9cdbb';
}
// 견적서 원단 칸(사진이 없을 때)의 색 (35번): 잰 색(색상코드)이 있으면 그 색, 없으면 톤 대표색 (고객 화면 concierge colorFillOf와 같은 순서)
//  톤 대표색은 4가지뿐이라 그레이·로즈 그레이·그레이지가 같은 색으로 보이던 것
function fabricColorFill(fabricId, colorName) {
    const col = (fabricId && colorName) ? getFabricColors(fabricId).find(x => x.name === normalizeColorName(colorName)) : null;
    return (col && /^#[0-9a-f]{6}$/i.test(col.hex || '')) ? col.hex : fabricToneFill(fabricId, colorName);
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
    renderOptionPriceSettings();
}
// 설정 › 가공·부자재 단가 (29번): 줄마다 판매가 · 원가 · 남는 돈. 칸을 고치면 바로 저장되고 그 줄의 남는 돈만 다시 씀
//  원가 칸이 비면 레일·패널은 비공개 팩 원가 규칙으로 셈한 값이 들어 있음. 리드밴드 원가는 판매가와 같음
function renderOptionPriceSettings() {
    const box = document.getElementById('optionPriceBox');
    if (!box) return;
    const p = optionPrices(), k = optionCosts();
    const inp = (path, v, ph) => `<input type="number" min="0" step="100" inputmode="numeric" data-opt="${path}" value="${v === null || v === undefined ? '' : v}" placeholder="${ph || ''}">`;
    const row = (name, sale, salePath, cost, costPath) => `<div class="opt-row" data-row><span class="opt-name">${name}</span>`
        + `<label><em>판매가</em>${inp(salePath, sale)}<i>원</i></label>`
        + (costPath ? `<label><em>원가</em>${inp(costPath, cost, '비어 있음')}<i>원</i></label><span class="opt-gain" data-gain></span>` : `<span class="opt-same">원가 = 판매가</span><span></span>`)
        + '</div>';
    let h = '<div class="opt-group"><h3>형상기억 <small>폭당 원단은 폭 수, 마당 원단은 마 수만큼</small></h3>';
    h += row('폭당', p.shapeW, 'shapeW', k.shapeW, 'cost.shapeW') + row('마당', p.shapeY, 'shapeY', k.shapeY, 'cost.shapeY');
    h += `<div class="opt-row opt-high"><span class="opt-name">높이 추가</span><label class="opt-wide">제작 높이 ${inp('shapeH', p.shapeH || '', '없음')}<i>cm 이상이면 단위마다 더함</i></label></div>`;
    h += row('높이 추가 · 폭당', p.shapeHW, 'shapeHW', k.shapeHW, 'cost.shapeHW') + row('높이 추가 · 마당', p.shapeHY, 'shapeHY', k.shapeHY, 'cost.shapeHY') + '</div>';
    h += '<div class="opt-group"><h3>리드밴드 <small>폭당 원단은 폭 수, 마당 원단은 마 수만큼</small></h3>' + row('폭당', p.leadW, 'leadW') + row('마당', p.leadY, 'leadY') + '</div>';
    h += '<div class="opt-group"><h3>레일·봉 <small>자당 (30cm)</small></h3>' + HW_TYPES.map(t => row(HW_NAMES[t], p.rail[t], 'rail.' + t, k.rail[t], 'cost.rail.' + t)).join('') + '</div>';
    h += '<div class="opt-group"><h3>패널 가공비 <small>기본 + 90cm 넘는 30cm마다</small></h3>' + row('기본', p.panelBase, 'panelBase', k.panelBase, 'cost.panelBase') + row('30cm마다', p.panelStep, 'panelStep', k.panelStep, 'cost.panelStep') + '</div>';
    box.innerHTML = h;
    box.querySelectorAll('[data-row]').forEach(optionGainUpdate);
    if (!box.dataset.wired) {
        box.dataset.wired = '1';
        box.addEventListener('input', ev => {
            const el = ev.target.closest('input[data-opt]');
            if (!el) return;
            saveOptionPriceField(el.dataset.opt, el.value);
            optionGainUpdate(el.closest('[data-row]'));
        });
        // 칸을 비우고 나가면 처음 값(또는 팩 원가)을 다시 보여 줌
        box.addEventListener('change', ev => { if (ev.target.matches('input[data-opt]') && ev.target.value === '') renderOptionPriceSettings(); });
    }
}
function optionGainUpdate(row) {
    const g = row && row.querySelector('[data-gain]');
    if (!g) return;
    const [s, c] = Array.from(row.querySelectorAll('input[data-opt]')).map(i => i.value === '' ? null : Number(i.value));
    if (s === null || c === null || !Number.isFinite(s) || !Number.isFinite(c)) { g.textContent = '남는 돈 —'; g.classList.remove('is-minus'); return; }
    const d = s - c;
    g.textContent = `남는 돈 ${d.toLocaleString('ko-KR')}원${s > 0 ? ` (${Math.round(d / s * 100)}%)` : ''}`;
    g.classList.toggle('is-minus', d < 0);
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
    await DevicePhotos.ready;      // 기기에 넣은 사진(34번)부터 쓰도록
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
        recipient: custName ? `${custName} 고객님 귀하` : '고객님 귀하',      // 고객 이름·날짜는 견적서 머리글에만 (74번)
        date: `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
        rooms: rooms.map(r => {
            const items = r.curtains.map(c => {
                const calc = c.calc || {};
                const opts = [];
                if (c.shapeFee > 0) opts.push('형상기억');
                if (c.leadBand) opts.push('리드밴드');
                if (c.hotelFit) opts.push('호텔핏');
                const sampleOnly = !!(typeof sampleBlindFabric === 'function' && sampleBlindFabric(c.fabricId));
                return {
                    label: c.label, kind: ticketKindLabel(c), meta: opts.join(' · '),      // 원단 이름 옆 작은 글자: 추가한 옵션만 (책자 이름은 넣지 않음)
                    name: ticketPlainName(c, calc), tone: ticketToneWord(r, c),      // 이유 장·우리 집 색: 색 이름 · 재질 + 벽·바닥과 톤 관계 (61번)
                    bookName: ticketBookName(c),      // 견적서(그림·세로 화면·카톡 글): 책자 원단 이름 + 색 번호, 예) 블랑 1번 (75번)
                    fill: fabricColorFill(c.fabricId, c.colorName), opts, price: calc.curtainSubtotal || 0, sampleOnly,
                    reason: ticketItemReason(r, c), fabricId: c.fabricId || '', colorName: c.colorName || '',
                    size: (Number(c.width) > 0 && Number(c.height) > 0) ? `${Number(c.width)} × ${Number(c.height)}cm` : '',      // 제작 크기 (넓이 × 높이)
                    photoKey: (c.fabricId || '') + '__' + (c.colorName || ''),
                    kindKey: c.presetType || '', colorDesc: (c.fabricId && c.colorName && typeof colorLabelOf === 'function') ? colorLabelOf(c.fabricId, c.colorName) : '',
                    keep: ticketKeepWord(r, c),      // 원단을 고른 이유 카드용
                    pickDir: c.pickDir || null, toneStep: Number(c.toneStep) || 0      // 칸마다의 잇는 방향 · 한 톤 바꿈 (28번)
                };
            });
            // 카드용 손님 답: 빛 양은 기본값이 들어 있으니 상담을 거친(diagnosed) 공간만 씀
            const ans = { privacy: r.privacy || null, block: r.lightBlock || null, light: r.diagnosed ? (r.lightLevel || null) : null };
            // 잰 벽·바닥 색 (32번): 이유 카드 공간 줄 아래 "■ 벽 라이트 베이지 #D8CEBF · ■ 바닥 허니 오크 #B38A5E". 잰 공간만
            const mc = r.measuredColor || {}, nameOf = window.RoomColor && window.RoomColor.colorName;
            const colors = ['wall', 'floor'].filter(k => mc[k] && /^#[0-9a-f]{6}$/i.test(mc[k].hex || '') && nameOf)
                .map(k => ({ k: k === 'wall' ? '벽' : '바닥', hex: mc[k].hex.toUpperCase(), name: (nameOf(k, mc[k]) || {}).name || '' }));
            // 잇는 색은 넣지 않음 (사장님 10-16: 최종 제안에서는 고른 원단 자체가 잇는 색)
            // 속지만 + 바깥 시선이 신경 쓰이는 공간 (33번): 이유 카드 공간 아래 밤 안내 한 줄
            const night = (r.privacy === 'high' || r.privacy === 'some') && r.curtains.length > 0 && r.curtains.every(c => c.presetType === 'sheer');
            const sampleOnly = items.length > 0 && items.every(i => i.sampleOnly);
            // raw: 이유 문장(35번)이 쓰는 공간 값(잰 색 Lab·창 방향·공간 종류·속지 느낌) · opp: 같은 이름 공간과 방향이 반대인 맞은편 창
            return { name: r.name, total: items.reduce((a, i) => a + i.price, 0), sampleOnly, items, summary: '', diagnosed: !!r.diagnosed, ans, linkDir: r.linkDir || null, colors, night,
                raw: r, opp: oppositeRoomOf(r, rooms) };      // 공간 설명 줄은 뺌 (제안서가 길어져서)
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
// slim: 앞장에 "원단을 고른 이유" 카드가 있으면 품목마다 한 줄(종류 · 이름 · 옵션 · 크기 · 금액). 추천 이유는 카드에 있으니 뺌
function drawTicket(ctx, data, W, slim) {
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const DARK = '#2b221a', MUTED = '#6f5f4f', SOFT = '#6f5f4f', LINE = '#e5dcd0';
    const PAD = TICKET_PAD, CX = PAD, CW = W - PAD * 2, RX = W - PAD;
    const HEAD_Y = TICKET_HEAD_Y;                   // 표 머리(굵은 선) 높이
    const START_Y = HEAD_Y + 56;                    // 첫 공간이 시작되는 높이 (표 머리 아래)
    const SW_W = slim ? 36 : 56, SW_H = slim ? 46 : 70;      // 원단 칸 (세로로 긴 네모)
    const KIND_W = 76;                              // slim: 종류 이름표 칸 폭
    const NAME_Y = slim ? 40 : 74, NAME_LH = slim ? 34 : 38, NAME_PX = PAPER_F3;      // 원단 이름 글줄 (품목 윗선에서 첫 줄까지 · 줄 간격 · 글자 크기 — 앞장들과 위계 통일, 39번)
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

    // 머리글 + 표 머리 (페이지마다 같은 모양 — 볼드 없이 400 명조로 단정하게, 39번)
    function hdr() {
        // 로고: 명조 보통 굵기, 점만 흙빛 (세 조각으로 나눠 그림)
        setFont(400, PAPER_F1, SERIF); spacing('1.7px');
        const wRe = ctx.measureText('Re').width, wDot = ctx.measureText('Re.').width;
        text('Re', CX, 112, 'left', DARK); text('.', CX + wRe, 112, 'left', '#8a4a22'); text('dam', CX + wDot, 112, 'left', DARK);
        spacing('0px');
        setFont(400, PAPER_F2, SERIF);
        if (canSpace) { spacing('5px'); text('견적서', RX + 5, 108, 'right', DARK); spacing('0px'); }
        else text('견적서', RX, 108, 'right', DARK);
        setFont(400, PAPER_F3, SERIF); text(data.recipient, CX, 154, 'left', MUTED);
        setFont(400, PAPER_F4, SANS); label(data.date, RX, 154, 'right', 2);
        hline(CX, RX, HEAD_Y, DARK, 1);
        setFont(400, PAPER_F4, SANS);
        label('품목', CX, HEAD_Y + 36, 'left', 3);
        label('금액', RX, HEAD_Y + 36, 'right', 3);
    }

    // 공간 한 묶음의 크기를 미리 계산
    function layoutRoom(room) {
        const px = CX, iw = CW;
        const tx = px + SW_W + (slim ? 20 : 24);
        const nx = slim ? tx + KIND_W : tx;              // 원단 이름이 시작되는 곳 (slim이면 종류 이름표 오른쪽)
        const tw = RX - 150 - nx;      // 원단 이름·옵션·추천 이유가 쓸 수 있는 폭. 크기 칸을 빼고 금액 칸(150)만 남김 — 크기는 이름 아래 작은 줄 (75번)
        const blocks = room.items.map(it => {
            const photo = (data.photos && data.photos[it.photoKey]) || null;
            setFont(400, NAME_PX, SERIF);
            const lines = wrap(it.bookName || ticketBookName(it), tw);      // 책자 원단 이름 + 색 번호, 예) 블랑 1번 (75번)
            const lastW = ctx.measureText(lines[lines.length - 1] || '').width;
            setFont(400, PAPER_F4, SANS);
            // 옵션은 이름 옆에 작게. 자리가 모자라면 다음 줄로
            const metaInline = false, sub = [it.size, it.meta].filter(Boolean).join(' · ');
            const metaLines = sub ? wrap(sub, tw) : [];
            const rlines = (it.reason && !slim) ? wrap(it.reason, tw) : [];
            const nameEnd = NAME_Y + (lines.length - 1) * NAME_LH;
            const textEnd = nameEnd + metaLines.length * 32 + rlines.length * 32;
            const h = slim ? Math.max(textEnd + 18, 10 + SW_H + 10) : Math.max(textEnd + 24, 12 + SW_H + 14);
            return { it, photo, lines, lastW, metaInline, metaLines, rlines, h };
        });
        const headH = slim ? 62 : 72;
        const cardH = headH + blocks.reduce((a, b) => a + b.h, 0) + 10;
        return { room, px, iw, tx, nx, blocks, headH, cardH };
    }
    // 공간 한 묶음을 y 위치에 그림: 위 가는 선 → 공간 이름·소계 → 품목(원단 칸 · 종류 · 이름·옵션 · 크기 · 금액)
    function drawRoom(L, y) {
        const { room, px, iw, tx, nx, blocks, headH } = L;
        hline(px, px + iw, y, LINE, 0.6);
        setFont(400, PAPER_F2, SERIF); text(room.name, px, y + (slim ? 46 : 50), 'left', DARK);
        if (!room.sampleOnly) { setFont(400, PAPER_F3, SERIF); text(won(room.total), px + iw, y + (slim ? 46 : 50), 'right', DARK); }
        let by = y + headH;
        blocks.forEach(b => {
            // 원단 칸: 사진이 있으면 가운데를 잘라 넣고, 없으면 톤 색으로 채움
            const swY = by + (slim ? 10 : 12);
            ctx.fillStyle = b.it.fill || '#d9cdbb'; ctx.fillRect(px, swY, SW_W, SW_H);
            if (b.photo) {
                const sw = b.photo.naturalWidth, sh = b.photo.naturalHeight;
                const k = Math.max(SW_W / sw, SW_H / sh), cw = SW_W / k, ch = SW_H / k;
                ctx.drawImage(b.photo, (sw - cw) / 2, (sh - ch) / 2, cw, ch, px, swY, SW_W, SW_H);
            }
            setFont(400, PAPER_F4, SANS); label(b.it.kind, tx, slim ? by + NAME_Y : by + 36, 'left', 3);
            setFont(400, NAME_PX, SERIF);
            b.lines.forEach((ln, li) => text(ln, nx, by + NAME_Y + li * NAME_LH, 'left', DARK));
            let ty = by + NAME_Y + (b.lines.length - 1) * NAME_LH;
            if (!b.it.sampleOnly) { setFont(400, PAPER_F3, SERIF); text(won(b.it.price), px + iw, by + NAME_Y, 'right', DARK); }
            setFont(400, PAPER_F4, SANS);
            if (b.metaInline) text(b.it.meta, nx + b.lastW + 14, ty, 'left', MUTED);
            b.metaLines.forEach(ln => { ty += 32; text(ln, nx, ty, 'left', MUTED); });
            b.rlines.forEach(ln => { ty += 32; text(ln, nx, ty, 'left', SOFT); });
            by += b.h;
        });
    }
    // 맨 아래 구역: 시공비 → 합계 금액 → 안내 줄들(왼쪽 작은 이름표 + 오른쪽 글: 안내 / 결제 조건 / 맞춤 제작 안내) → 가는 선 → 공급자 정보
    // 결제 조건·맞춤 제작 안내·공급자 정보는 직원 화면에서 적은 글(여러 줄). 비어 있으면 그 줄은 그리지 않음
    const INFO_X = CX + 190, INFO_W = RX - INFO_X, INFO_LH = 32, INFO_GAP = 14;
    const paras = (str, maxW) => {
        const out = [];
        String(str || '').split(/\r?\n/).forEach(p => { const t = p.trim(); if (t) wrap(t, maxW).forEach(l => out.push(l)); });
        return out;
    };
    function layoutFooter() {
        setFont(400, PAPER_F4, SANS);
        const rows = [
            { label: '안내', lines: paras(data.note, INFO_W) },
            { label: '결제 조건', lines: paras(data.pay, INFO_W) },
            { label: '맞춤 제작 안내', lines: paras(data.custom, INFO_W) }
        ].filter(r => r.lines.length);
        const sup = paras(data.supplier, INFO_W);
        const rowH = n => n * INFO_LH + INFO_GAP;
        const h = (data.install > 0 ? 76 : 0) + 96 + 54 + rows.reduce((a, r) => a + rowH(r.lines.length), 0)
            + (sup.length ? 30 + rowH(sup.length) : 0) + 56;
        return { rows, sup, h };
    }
    function drawFooter(F, y) {
        if (data.install > 0) {
            hline(CX, RX, y, LINE, 0.6);
            setFont(400, PAPER_F3, SANS); text('시공 및 설치비', CX, y + 48, 'left', MUTED);
            setFont(400, PAPER_F3, SERIF); text(won(data.install), RX, y + 48, 'right', DARK);
            y += 76;
        }
        hline(CX, RX, y, DARK, 1);
        y += 96;
        setFont(400, PAPER_F4, SANS); label('합계 금액 (시공비 포함)', CX, y - 6, 'left', 3);
        setFont(400, PAPER_F3, SERIF);
        const wonW = ctx.measureText('원').width;
        text('원', RX, y, 'right', DARK);
        setFont(400, PAPER_F1, SERIF); text(data.total, RX - wonW - 8, y, 'right', DARK);      // 합계 숫자도 볼드 없이 400 명조로 단정하게 (39번)
        y += 54;
        const infoRow = (name, lines, color) => {
            setFont(400, PAPER_F4, SANS); label(name, CX, y, 'left', 3);
            setFont(400, PAPER_F4, SANS);
            lines.forEach((ln, i) => text(ln, INFO_X, y + i * INFO_LH, 'left', color));
            y += lines.length * INFO_LH + INFO_GAP;
        };
        F.rows.forEach(r => infoRow(r.label, r.lines, MUTED));
        if (F.sup.length) {
            hline(CX, RX, y - 18, LINE, 0.6);
            y += 30;
            infoRow('공급자', F.sup, MUTED);
        }
    }
    function pageLabel(i, n, H) {
        if (n < 2) return;
        setFont(400, PAPER_F4, SANS); text(`${i + 1} / ${n}`, W / 2, H - 30, 'center', SOFT);
    }
    return { START_Y, hdr, layoutRoom, drawRoom, layoutFooter, drawFooter, pageLabel };
}

// 견적서는 A4 세로 비율의 "고정 크기" 페이지(1080 x 1527)로 만듭니다.
//  1) 내용이 한 장에 들어가면 그대로,
//  2) 조금 넘치면 글자·간격을 살짝 줄여서(최대 80%까지) 한 장에 맞추고,
//  3) 그래도 안 들어가면 방 카드 단위로 다음 장에 이어 그립니다 (최종 금액은 맨 마지막 장 아래쪽).
const TICKET_W = 1080;
const TICKET_PAGE_H = Math.round(TICKET_W * 1.414);
const TICKET_PAD = 64, TICKET_HEAD_Y = 188;      // 종이 안쪽 여백(인쇄 여백 10mm와 겹치지 않게 줄임)·머리글 굵은 선 높이. 카드와 견적서가 같이 씀
// 화면용 종이 (75번, 10-25 사장님: A4 인쇄는 나중에 따로): 폭 1080 그림에 1.4배로 그려 글자는 60·40·32·28(화면 사다리의 2배)만,
//  장 높이는 내용만큼(쪽 나눔 없음). 탭에서 폭 540으로 보이면 30·20·16·14
const PAPER_K = 1.4, PAPER_W = Math.round(TICKET_W / PAPER_K);
const PAPER_F1 = 60 / PAPER_K, PAPER_F2 = 40 / PAPER_K, PAPER_F3 = 32 / PAPER_K, PAPER_F4 = 28 / PAPER_K;      // 로고·합계 / 장 제목·공간 이름 / 본문 / 작게
const TICKET_SCALES = [1, 0.95, 0.9, 0.85, 0.8];
function planTicket(data, s, slim) {
    const W = PAPER_W, PAGE_H = 1e6, GAP = slim ? 16 : 34, BOTTOM = 80;      // 쪽 나눔 없음: 장 높이는 내용만큼 (75번)
    const probe = document.createElement('canvas').getContext('2d');
    const T = drawTicket(probe, data, W, slim);
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
// ==============================================================
// 〈원단을 고른 이유〉 카드 (작업목록 24번 → 35번): 제안서 맨 앞장. 가격 없음. 견적서와 한 쌍(머리글·글꼴·선·쪽 표시 같음)
//  공간마다 [공간 이름 · 손님 말(+창 방향) · 벽·바닥 잰 색 · 공간 문장(색 잇기)] → 원단마다 [색 칩 + 코드 · 원단 이름 · 이유 1~3문장 · 회색 안내].
//  손님이 상담에서 실제로 답한 공간(diagnosed)만. 앞 공간과 같은 원단·같은 답이면 "○○과 같은 이유예요." + 새로 생긴 재료만
//  문장은 정해 둔 한 줄이 아니라 재료(손님 말 F · 공간 S · 색 C · 창 방향 D · 맞은편 창 O · 재질 T · 속지/겉지 짝 P · 그대로 K)를 계산해 섞음
//  기준: Claude outputs/기준문서/11_이유_문장표.md (숫자 기준은 모두 처음 값)
// ==============================================================
const WHY_SAY = {
    light: { high: '햇빛이 풍부해요', mid: '햇빛이 은은해요', low: '햇빛이 차분해요' },
    block: { light: '빛은 들어와도 괜찮아요', soft: '빛은 적당히 가려 주세요', dark: '빛은 완전히 어둡게 하고 싶어요' },
    privacy: { open: '밖에서 안이 보이는 게 괜찮아요', some: '밖에서 안이 보이는 게 조금 신경 쓰여요', high: '밖에서 안이 보이는 게 많이 신경 쓰여요' }
};
const whyQuote = (k, ans) => '“' + WHY_SAY[k][ans[k]] + '”';
function whyJosa(name) {      // "거실과" / "안방과" / "방 2와" 처럼 받침에 따라
    const ch = String(name).slice(-1), code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? '과' : '와';
    return '013678'.includes(ch) ? '과' : '와';
}
// ---- 색 값 (Lab): 색 기운(fam)은 room-color.js colorName과 같은 각도 구분, 채도 C ≥ 4일 때만 "기운 있음" ----
const WHY_FAM_WORD = { pink: '분홍', red: '붉은', yellow: '노란', olive: '초록', mint: '푸른 초록', blue: '푸른', lavender: '보랏' };
const WHY_WARM_FAM = ['pink', 'red', 'yellow'];
function whyLabOf(c) {
    if (!c || typeof c.L !== 'number' || typeof c.a !== 'number' || typeof c.b !== 'number') return null;
    const C = Math.hypot(c.a, c.b);
    let h = Math.atan2(c.b, c.a) * 180 / Math.PI; if (h < 0) h += 360;
    const fam = C < 4 ? null : (h < 30 || h >= 330) ? 'pink' : h < 62 ? 'red' : h < 110 ? 'yellow' : h < 150 ? 'olive' : h < 215 ? 'mint' : h < 290 ? 'blue' : 'lavender';
    return { L: c.L, a: c.a, b: c.b, C, fam, hex: c.hex || null };
}
const whyDE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
// 원단 색: 색상 입력표에서 잰 색(색상코드·밝기·붉은기·노란기)만. 코드만 있으면 코드에서 Lab을 셈. 없으면 null (칩·색 문장 없음)
function whyFabricColor(fabricId, colorName) {
    const col = (fabricId && colorName) ? getFabricColors(fabricId).find(x => x.name === normalizeColorName(colorName)) : null;
    if (!col) return null;
    const hex = /^#[0-9a-f]{6}$/i.test(col.hex || '') ? col.hex.toUpperCase() : null;
    let L = typeof col.light === 'number' ? col.light : null, a = typeof col.a === 'number' ? col.a : null, b = typeof col.b === 'number' ? col.b : null;
    if ((L == null || a == null || b == null) && hex && window.RoomColor && RoomColor.rgbToLab) {
        const n = parseInt(hex.slice(1), 16), lab = RoomColor.rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
        if (L == null) L = lab.L;
        if (a == null || b == null) { a = lab.a; b = lab.b; }
    }
    const lab = whyLabOf({ L, a, b, hex });
    return lab || (hex ? { hex } : null);
}
// 공간 한 곳의 재료 (손님 답 · 잰 벽·바닥 · 창 방향 · 맞은편 창)
function whyRoomCtx(room) {
    const raw = room.raw || {}, mc = raw.measuredColor || {};
    const dir = windowDirOf(raw.windowDir);
    const wall = whyLabOf(mc.wall), floor = whyLabOf(mc.floor), bridge = whyLabOf(mc.bridge);
    const nameOf = (k, c) => (window.RoomColor && RoomColor.colorName && (RoomColor.colorName(k, c) || {}).name) || '';
    return {
        room, ans: room.ans, dir, dirText: windowDirText(dir),
        E: dir.includes('E'), W: dir.includes('W'), S: dir.includes('S'), N: dir.includes('N'),
        wall, floor, bridge, floorName: floor ? nameOf('floor', mc.floor) : '',
        bedroom: /^(방|안방|아이방)/.test(String(raw.roomType || raw.name || '')),
        light: room.ans.light, privacy: room.ans.privacy, block: room.ans.block, feel: raw.sheerFeel || null,
        opp: room.opp || ''
    };
}
function whyItemFacts(it, R) {
    const f = FABRIC_DB.find(x => x.id === it.fabricId) || (typeof sampleBlindFabric === 'function' && sampleBlindFabric(it.fabricId)) || {};
    const kind = it.kindKey === 'sheer' ? 'sheer' : (it.kindKey === 'blind' ? 'blind' : 'drape');
    const col = whyFabricColor(it.fabricId, it.colorName);
    return { it, f, kind, hex: col && col.hex, lab: col && typeof col.L === 'number' ? col : null, link: it.pickDir || R.room.linkDir || null,
             tex: (f.texture && TEXTURE_LABELS[f.texture]) ? f.texture : null };
}
// S. 공간 문장 (색 잇기 방향, 공간에 한 번): 맞는 원단만 앞에 붙임 — 다 맞으면 주어 없이, 일부만 맞으면 "겉지는 / 속지는"
const WHY_S = { wall: ['S1', '벽 색에 맞춰 공간이 넓어 보이게 했어요.'], bridge: ['S2', '벽과 바닥 사이 색으로 이었어요.'], floor: ['S3', '바닥 색에 맞춰 공간이 따뜻해 보이게 했어요.'] };
function whySpaceCands(R, facts) {
    const curtains = facts.filter(F => F.kind !== 'blind');
    const fits = (F, dir) => {
        const c = F.lab;
        if (!c) return false;
        if (dir === 'wall') return !!R.wall && whyDE(c, R.wall) < 8;
        if (dir === 'bridge') return !!R.bridge && whyDE(c, R.bridge) < 8;
        if (dir === 'floor') return !!R.floor && (whyDE(c, R.floor) < 10 || (!!c.fam && c.fam === R.floor.fam));
        return false;
    };
    const out = [];
    Object.keys(WHY_S).forEach(dir => {
        const ok = curtains.filter(F => F.link === dir && fits(F, dir));
        if (!ok.length) return;      // S0: 맞는 원단이 없으면 지어내지 않음
        const subj = ok.length === curtains.length ? '' : ok.map(F => F.kind === 'sheer' ? '속지' : '겉지').filter((k, i, a) => a.indexOf(k) === i).join('와 ') + '는 ';
        out.push({ id: WHY_S[dir][0], t: [subj + WHY_S[dir][1]] });
    });
    return out;
}
// 원단 한 개의 재료를 순서대로: F → C(최대 2) → D → O3/T → P(겉지만). 회색 안내(O1·O2·F4·C5)는 따로 (36번)
function whyItemCands(F, R, facts) {
    const list = [], c = F.lab, f = F.f, kind = F.kind, add = (g, id, a, b) => list.push({ g, id, t: [a, b || null] });
    // F. 손님 말 ↔ 기능 (하나만)
    if (kind === 'sheer') {
        const d = DENSITY_LABELS[f.density] ? f.density : null;
        if (R.light === 'high' && d === 'day') add('F', 'F9', '햇빛이 강한 창이라, 낮에는 밖에서 안이 잘 보이지 않아요.');
        else if (R.light === 'low' && (R.privacy === 'high' || R.privacy === 'some') && d === 'heavy') add('F', 'F8', '해가 덜 드는 창이라, 촘촘한 원단으로 골랐어요.');
        else if (R.privacy === 'high' && (d === 'day' || d === 'heavy')) add('F', 'F1', '낮에도 밖에서 안이 보이지 않아요.');
        else if (R.privacy === 'some' && (d === 'medium' || d === 'day')) add('F', 'F2', '밖에서는 형태만 흐릿하게 보여요.');
        else if (R.privacy === 'open' && d === 'light') add('F', 'F3', '풍경과 햇빛이 그대로 들어와요.');
    } else if (kind === 'drape') {
        const b = blackoutLevel(f);
        if (R.block === 'dark' && b === 'full') add('F', 'F4', '빛을 거의 막아 낮에도 어둡게 쉴 수 있어요.');
        else if (R.block === 'soft' && b === 'life') add('F', 'F5', '눈부심은 줄이고, 방이 캄캄해지지는 않아요.');
        else if (R.block === 'soft' && (b === 'none' || b === 'mid')) add('F', 'F6', '빛을 살짝 걸러 줘요.');
        else if (R.block === 'light' && (b === 'none' || b === 'mid')) add('F', 'F7', '햇빛을 크게 막지 않아 방이 밝아요.');
    } else if (F.it.keep) {
        const k = /[.!?]$/.test(F.it.keep) ? F.it.keep : F.it.keep + '.';      // 블라인드: 지금까지의 한 줄 (빛 가림 답과 맞는 점)
        add('F', 'FB:' + k, k);
    }
    if (kind === 'blind') return list;
    // C. 원단 색 ↔ 벽·바닥 (밝기 이야기 1 + 기운 이야기 1). 한 톤 밝게/진하게를 누른 칸은 그 문장이 C 대신 (K, 28번)
    if (F.it.toneStep > 0) add('C', 'K+', '여기서 한 톤 밝게 바꿔 빛을 더 환하게 받도록 했어요.');
    else if (F.it.toneStep < 0) add('C', 'K-', '여기서 한 톤 진하게 바꿔 차분한 무게를 더했어요.');
    else if (c) {
        if (kind === 'sheer' && c.L >= 88) add('C', 'C8', '밝은 흰색이라, 햇빛을 받으면 창 전체가 환해져요.', '흰빛이 밝아서 낮에 창 쪽이 환해요.');
        else if (R.wall) {
            const dL = c.L - R.wall.L;
            if (whyDE(c, R.wall) < 6) add('C', 'C1', '벽 색과 거의 같아서, 커튼을 쳐도 공간이 넓어 보여요.', '벽과 거의 같은 색이라, 커튼이 눈에 띄지 않아요.');
            else if (dL > 15) add('C', 'C3', '벽보다 훨씬 밝은 색이라, 창 쪽이 가장 환해 보여요.', '밝은 색이라 창이 넓어 보여요.');
            else if (dL >= 6) add('C', 'C2', '벽보다 한 톤 밝아서, 창 쪽이 환해 보여요.', '벽보다 살짝 밝은 색이라, 공간이 가벼워 보여요.');
            else if (dL < -15) add('C', 'C5', '벽보다 훨씬 진해서, 창이 눈에 먼저 들어와요.', '진한 색이라 공간이 또렷하게 나뉘어 보여요.');
            else if (dL <= -6) add('C', 'C4', '벽보다 한 톤 진해서, 창 쪽이 차분해 보여요.', '벽보다 살짝 진한 색이라, 공간이 정돈돼 보여요.');
        }
        if (R.floor) {
            if (c.fam && c.fam === R.floor.fam) add('C', 'C6', `바닥${R.floorName ? ' ' + R.floorName + whyJosa(R.floorName) : '과'} 같은 ${WHY_FAM_WORD[c.fam]} 기운이 있어 잘 어울려요.`, '바닥 나무색과 같은 쪽 색이라 잘 어울려요.');
            else if (c.C < 3 && R.floor.C >= 6) add('C', 'C7', '색 기운이 거의 없어서, 바닥 나무색이 그대로 보여요.', '맑은 색이라 바닥 색과 부딪히지 않아요.');
        }
    }
    // D. 창 방향 × 원단 (방향은 점수에 안 썼으니 모두 "~해요" 꼴). 하나만, 쓰임(빛 가림·잠) → 빛 → 색 순
    const lifeFull = kind === 'drape' && ['life', 'full'].includes(blackoutLevel(f));
    const warm = !!(c && c.fam && WHY_WARM_FAM.includes(c.fam));
    const D = [
        [R.E && R.bedroom && lifeFull, 'D1', '아침 해가 먼저 드는 창이라, 이른 햇빛에 잠이 덜 깨도록 가려 줘요.'],
        [R.W && lifeFull, 'D5', '낮게 들어오는 오후 햇빛의 눈부심과 열기를 줄여 줘요.'],
        [R.E && kind === 'sheer', 'D2', '아침 해가 드는 창이라, 아침엔 속지만 쳐도 방이 밝아요.'],
        [R.S && !R.E && !R.W && kind === 'sheer', 'D6', '낮 내내 해가 드는 창이라, 속지로 빛을 고르게 걸러요.'],
        [R.N && kind === 'sheer' && c && c.L >= 85, 'D9', '빛이 적은 북향이라, 밝은 속지로 빛을 덜 막아요.'], // 41번
        [R.W && warm && c.C >= 6, 'D3', '서향이라 오후엔 빛이 노래져서, 이 색이 조금 더 따뜻해 보여요.'], // 41번
        [R.W && c && c.C < 4, 'D4', '색 기운이 적어서, 오후의 노란 빛에도 색이 크게 달라 보이지 않아요.'],
        [R.N && warm, 'D7', '북향 빛은 푸르스름해서, 따뜻한 기운이 있는 이 색이 차가워 보이지 않아요.'], // 41번
        [R.N && c && c.C < 4 && c.L >= 75, 'D8', '북향 빛은 하루 내내 고르게 들어서, 이 색이 시간마다 크게 달라 보이지 않아요.'] // 41번
    ].find(x => x[0]);
    if (D) add('D', D[1], D[2]);
    // O3 · T. 재질 (결 이야기는 하나만)
    const feelMatch = kind === 'sheer' && ((R.feel === 'textured' && F.tex === 'natural') || (R.feel === 'cozy' && F.tex === 'cozy'));
    if (F.tex === 'natural' && R.opp) add('T', 'O3', '맞은편 창 빛이 앞면을 비춰서, 낮에도 결이 잘 보여요.');
    if (feelMatch) add('T', 'T4', `고르신 ${R.feel === 'cozy' ? '도톰하고 보송한' : '결이 살아 있는'} 느낌 그대로예요.`);
    if (F.tex === 'natural' && !R.opp && (R.E || R.W || R.light === 'high')) add('T', 'T1', '결이 있는 원단이라, 비스듬히 드는 햇빛에 결이 잘 보여요.');
    else if (F.tex === 'cozy') add('T', 'T2', '도톰하고 보송한 원단이라, 만졌을 때 포근해요.');
    else if (F.tex === 'smooth' && kind === 'sheer' && R.feel === 'smooth') add('T', 'T3', '매끈해서 주름이 곧고 깔끔하게 떨어져요.');
    // P. 속지 ↔ 겉지 짝 (겉지 줄에만). 기운이 엇갈리는 짝(P4)은 문장 없음
    const sh = kind === 'drape' && c && facts.find(x => x.kind === 'sheer' && x.lab);
    if (sh) {
        const s = sh.lab;
        if (s.fam && s.fam === c.fam && c.L <= s.L - 10) add('P', 'P1', '속지와 같은 계열에 한 톤 진한 색이라, 겹쳐 쳐도 어색하지 않아요.');
        else if (s.C < 3 && s.L >= 88 && c.C >= 4) add('P', 'P2', `낮엔 흰 속지로 밝게, 밤엔 ${F.it.colorDesc ? F.it.colorDesc + ' ' : ''}겉지로 차분하게 쓸 수 있어요.`);
        else if (whyDE(s, c) < 5) add('P', 'P3', '속지와 겉지 색이 거의 같아서, 겹쳐 쳐도 깔끔해요.');
    }
    return list;
}
// 회색 안내(한 원단에 1개, 36번): 맞은편 창(O1·O2)이나 밤 안내가 있는 공간이 먼저, 없으면 완전 암막(F4)·벽보다 훨씬 진한 색(C5)·햇빛에 옅어 보임(F10, 63번) 솔직한 안내
function whyItemNote(F, R, cands) {
    if (R.opp) {
        if (F.kind === 'sheer' && (R.privacy === 'some' || R.privacy === 'high')) return '맞은편 창으로 방 안이 밝은 낮엔 비침이 조금 늘어요. 신경 쓰이면 겉지를 살짝 쳐 주세요.';
        if (F.kind === 'drape' && R.block === 'dark') return '다른 창에서도 빛이 들어, 그쪽도 가려야 방이 완전히 어두워져요.';
    }
    if (R.room && R.room.night) return '';      // 속지만 밤 안내가 있는 공간은 안내가 이미 있음 (한 원단에 1개)
    const ids = (cands || []).map(x => x.id);
    if (ids.includes('F4')) return '커튼 옆과 위로 새는 빛은 조금 남아요.';
    if (ids.includes('C5') && !(F.it.toneStep < 0)) return '차분한 쪽이 좋으시면 한 톤 밝은 색도 같이 볼 수 있어요.';
    // F10 (63번): 완전암막이 아닌 겉지는 햇빛이 비치면 색이 옅어 보임. 암막 정도를 모르는 겉지엔 안 붙임
    if (F.kind === 'drape' && ['none', 'mid', 'life'].includes(blackoutLevel(F.f))) return '햇빛이 강하게 비치면 원단 색이 조금 옅고 밝게 보여요.';
    return '';
}
// 카드에 들어갈 공간·원단 묶음 (비어 있으면 카드 없음). 같은 재료는 카드 안에서 한 번만: 두 번째는 "나" 말, 세 번째부터는 건너뜀 (손님 말 F만은 공간마다 다시 씀)
function whySetsOf(data) {
    const out = [], seen = [], used = {}, shown = [];
    const nFab = data.rooms.reduce((a, r) => a + (r.diagnosed ? r.items.filter(i => i.fabricId).length : 0), 0);
    const MAX = nFab >= 6 ? 2 : 3;      // 원단이 6개 이상이면 원단마다 2문장까지
    const say = c => {
        const n = used[c.id] || 0, t = c.t[n] || null;
        if (t) used[c.id] = n + 1;
        return t;
    };
    data.rooms.forEach(room => {
        if (!room.diagnosed) return;
        const items = room.items.filter(it => it.fabricId);
        if (!items.length) return;
        const R = whyRoomCtx(room), facts = items.map(it => whyItemFacts(it, R));
        const space = whySpaceCands(R, facts).map(say).filter(Boolean);
        const sets = facts.map(F => {
            const it = F.it, cands = whyItemCands(F, R, facts);
            const key = [it.fabricId, it.colorName, it.kindKey, R.privacy, R.block, R.light, R.feel, F.link, it.toneStep].join('|');
            const prev = seen.find(p => p.key === key);
            const lines = [], per = {};
            let pool = cands;
            if (prev) { lines.push(`${prev.room}${whyJosa(prev.room)} 같은 이유예요.`); pool = cands.filter(x => !prev.ids.includes(x.id)); }      // 새로 생긴 재료만 (예: 방향이 달라 생긴 D)
            // 재료마다 하나씩 먼저(F → C → D → O3/T → P), 자리가 남으면 C·T의 두 번째. 고른 뒤에는 원래 순서대로 놓음
            //  (C를 먼저 둘 다 채우면 벽·바닥을 잰 공간에서 창 방향 문장이 거의 안 나와서 — 문장표 6장 예와 같게)
            const picked = [];
            [1, 2].forEach(pass => pool.forEach((x, i) => {
                if (lines.length + picked.length >= MAX || picked.some(p => p.i === i)) return;
                if ((per[x.g] || 0) >= (pass === 1 ? 1 : (x.g === 'C' || x.g === 'T' ? 2 : 1))) return;
                const t = x.g === 'F' ? x.t[0] : say(x);      // 손님 말(F)은 공간마다 다시 씀 (사장님 10-16: 빠지면 그 공간 답이 안 보임)
                if (t) { picked.push({ i, t }); per[x.g] = (per[x.g] || 0) + 1; }
            }));
            picked.sort((a, b) => a.i - b.i).forEach(p => lines.push(p.t));
            seen.push({ key, room: room.name, ids: cands.map(x => x.id) });
            return { it, hex: F.hex, lines, note: whyItemNote(F, R, cands) };
        });
        // 벽·바닥이 앞 공간과 같은 코드면 색 줄 대신 "벽과 바닥은 ○○과 같아요." (S4)
        const colors = room.colors || [], code = k => (colors.find(c => c.k === k) || {}).hex || '';
        const same = (code('벽') && code('바닥')) ? shown.find(p => p.wall === code('벽') && p.floor === code('바닥')) : null;
        if (code('벽') && code('바닥') && !same) shown.push({ room: room.name, wall: code('벽'), floor: code('바닥') });
        out.push({ name: room.name, sets, colors, sameAs: same ? same.room : '', dirText: R.dirText, space, night: !!room.night, ans: room.ans });
    });
    return { rooms: out };
}
// compact: 원단이 4개 이상이면 글자를 한 단계 작게 (출력 2장에 맞추려고, 제미나이 출력 화면 제안 10-15). 문장 수는 줄이지 않음 (35번)
function drawWhy(ctx, data, W, compact, title) {
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const MONO = 'ui-monospace,Menlo,Consolas,monospace';
    const DARK = '#2b221a', MUTED = '#6f5f4f', SOFT = '#6f5f4f', LINE = '#e5dcd0';
    const PAD = TICKET_PAD, CX = PAD, RX = W - PAD, CW = RX - CX, HEAD_Y = TICKET_HEAD_Y, START_Y = HEAD_Y;      // 첫 공간의 윗선이 머리글 굵은 선과 겹침
    const COL_GAP = 36;
    const Q_SIZE = PAPER_F3, Q_LH = compact ? 36 : 40;              // 손님 말 (400 명조 — 우리 집 색 총평과 같은 크기·굵기, 39번)
    const B_SIZE = PAPER_F4, B_LH = compact ? 29 : 31;              // 이유 (고딕, 볼드 없음)
    const C_SIZE = PAPER_F4, C_LH = compact ? 30 : 32, C_SW = 20;      // 잰 벽·바닥 색 줄 (32번) · 원단 색 칩도 같은 크기 (35번)
    const N_SIZE = PAPER_F4, N_LH = compact ? 28 : 30;              // 회색 안내 (밤 안내 33번 · 맞은편 창 35번)
    const T_SIZE = PAPER_F3, T_LH = compact ? 34 : 36;      // 원단 이름 (본문 32 명조, 75번)
    const setFont = (weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; };
    const canSpace = 'letterSpacing' in ctx;
    const spacing = v => { if (canSpace) ctx.letterSpacing = v; };
    const hline = (x1, x2, y, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
    const text = (str, x, y, align, color) => { ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y); };
    const label = (str, x, y, align, gap) => { spacing(gap + 'px'); text(str, x + ((align === 'right' && canSpace) ? gap : 0), y, align, SOFT); spacing('0px'); };
    const wrap = (str, maxW, firstW) => {      // firstW: 첫 줄만 폭이 다를 때 (칩 옆)
        const lines = []; let cur = '';
        const lim = () => (lines.length === 0 && firstW != null) ? firstW : maxW;
        for (const word of String(str).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (ctx.measureText(test).width <= lim()) { cur = test; continue; }
            if (cur) lines.push(cur);
            cur = '';
            if (ctx.measureText(word).width <= lim()) { cur = word; continue; }
            let chunk = '';
            for (const ch of word) { if (ctx.measureText(chunk + ch).width > lim()) { lines.push(chunk); chunk = ch; } else chunk += ch; }
            cur = chunk;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    // 머리글: 견적서(drawTicket hdr)와 같은 자리·같은 모양. 오른쪽 제목만 "원단을 고른 이유" (우리 집 색 쪽은 title로 바꿔 씀, 37번)
    //  74번: 고객 이름·날짜 줄은 뺌 — 견적서 쪽에만 있음(견적서만 따로 보내도 그 쪽에 다 있게)
    function hdr() {
        setFont(400, PAPER_F1, SERIF); spacing('1.7px');
        const wRe = ctx.measureText('Re').width, wDot = ctx.measureText('Re.').width;
        text('Re', CX, 112, 'left', DARK); text('.', CX + wRe, 112, 'left', '#8a4a22'); text('dam', CX + wDot, 112, 'left', DARK);
        spacing('0px');
        setFont(400, PAPER_F2, SERIF);
        if (canSpace) { spacing('5px'); text(title || '공간 제안', RX + 5, 108, 'right', DARK); spacing('0px'); }
        else text(title || '공간 제안', RX, 108, 'right', DARK);
        hline(CX, RX, HEAD_Y, DARK, 1);
    }
    // 원단 한 묶음: [■ 색 칩 + 코드] 속지 · 원단 이름 색 이름 → 이유 1~3문장 → 회색 안내. 볼드 없이 색 농도(DARK / MUTED / SOFT)로 위계 (39번)
    function layoutSet(set, colW) {
        const ops = []; let cy = 26;
        const name = set.it.name;      // 이미 색 이름이 앞에 있어 색 설명을 따로 붙이지 않음 (61번)
        let chipW = 0;
        if (set.hex) {      // 칩은 잰 색(색상코드)만. 없으면 칩·코드 없이 이름만
            setFont(400, C_SIZE, SANS);
            chipW = C_SW + 10 + ctx.measureText(set.hex).width + 16;
            ops.push({ chip: set.hex, y: cy });
        }
        setFont(400, T_SIZE, SERIF);
        const titleText = (set.it.kind === '블라인드' && name.includes('블라인드')) ? name : `${set.it.kind} · ${name}`;
        const hl = wrap(titleText, colW, colW - chipW);
        hl.forEach((ln, i) => { ops.push({ t: ln, f: [400, T_SIZE, SERIF], c: DARK, y: cy, x: i === 0 ? chipW : 0 }); if (i < hl.length - 1) cy += T_LH; });
        cy += T_LH + 4;
        if (set.lines.length) {
            setFont(400, B_SIZE, SANS);
            wrap(set.lines.join(' '), colW).forEach(ln => { ops.push({ t: ln, f: [400, B_SIZE, SANS], c: MUTED, y: cy }); cy += B_LH; });
        }
        if (set.note) {
            setFont(400, N_SIZE, SANS);
            cy += 4;
            wrap(set.note, colW).forEach(ln => { ops.push({ t: ln, f: [400, N_SIZE, SANS], c: SOFT, y: cy - 4 }); cy += N_LH; });
        }
        return { set, ops, h: Math.max(C_SW + 8, cy - B_LH + 8) };
    }
    // 공간 한 묶음: 가는 윗선(첫 공간은 머리글 선과 겹침) · 왼쪽 공간 이름(400 명조 24px, 우리 집 색과 같은 왼쪽 기둥 폭) · 오른쪽(QX)에 손님 말·벽/바닥·원단·이유를 가지런히 정렬 (39번)
    const R_SIZE = PAPER_F2;
    function layoutRoom(R) {
        const keys = [];
        R.sets.forEach(s => (s.it.kindKey === 'sheer' ? ['privacy', 'light'] : ['block', 'light']).forEach(k => { if (R.ans[k] && WHY_SAY[k][R.ans[k]] && !keys.includes(k)) keys.push(k); }));
        keys.sort((a, b) => ['light', 'privacy', 'block'].indexOf(a) - ['light', 'privacy', 'block'].indexOf(b));
        const quotes = keys.map(k => whyQuote(k, R.ans));
        if (R.dirText) quotes.push(`“${R.dirText}향이에요”`); // 41번
        setFont(400, R_SIZE, SERIF);
        const nameW = Math.max(148, Math.ceil(ctx.measureText(R.name).width) + 28);
        const QX = CX + nameW, QW = RX - QX;
        // 손님 말은 따옴표 하나가 줄 중간에서 끊기지 않게 통째로 놓음 (한 줄보다 길 때만 쪼갬)
        setFont(400, Q_SIZE, SERIF);
        const qLines = []; let cur = '';
        quotes.forEach(q => {
            const test = cur ? cur + '  ' + q : q;
            if (ctx.measureText(test).width <= QW) { cur = test; return; }
            if (cur) qLines.push(cur);
            if (ctx.measureText(q).width <= QW) cur = q;
            else { const w = wrap(q, QW); cur = w.pop(); qLines.push(...w); }
        });
        if (cur) qLines.push(cur);
        let saidInline = false;
        if (qLines.length) {
            const lastW = ctx.measureText(qLines[qLines.length - 1]).width;
            setFont(400, PAPER_F4, SANS);
            saidInline = lastW + 12 + ctx.measureText('하셨어요').width <= QW;
        }
        const qn = qLines.length + (qLines.length && !saidInline ? 1 : 0);
        let base = qn ? 44 + (qn - 1) * Q_LH : 0;      // 지금까지 쓴 마지막 줄의 글자 아랫선 (공간 윗선 기준)
        // 잰 벽·바닥 색 한 줄 (32번) + 창 방향: 들어가는 만큼 한 줄에, 넘치면 다음 줄. 앞 공간과 같은 색이면 한 줄 글로 (S4)
        setFont(400, C_SIZE, SANS);
        const parts = R.sameAs ? [] : (R.colors || []).slice();
        if (parts.length && R.dirText) parts.push({ k: '창', name: R.dirText + '쪽', hex: '' });
        const cRows = []; let cRowW = 0;
        parts.forEach(c => {
            const w = (c.hex ? C_SW + 10 : 0) + ctx.measureText(`${c.k} ${c.name} ${c.hex}`).width + 20;      // 대략 폭 (그릴 때 글꼴별로 다시 잼)
            if (cRows.length && cRowW + w <= QW) { cRows[cRows.length - 1].push(c); cRowW += w + 28; }
            else { cRows.push([c]); cRowW = w + 28; }
        });
        const cY = base + 42;
        if (cRows.length) base = cY + (cRows.length - 1) * C_LH;
        const sameY = R.sameAs ? base + 42 : 0;
        if (R.sameAs) base = sameY;
        // 공간 문장 (S, 공간에 한 번)
        setFont(400, B_SIZE, SANS);
        const sLines = R.space.length ? wrap(R.space.join(' '), QW) : [];
        const sY = base + (base ? 38 : 44);
        if (sLines.length) base = sY + (sLines.length - 1) * B_LH;
        const headH = Math.max(44, base) + 20;
        const two = false;      // 폭이 좁아 원단은 한 줄에 하나 (75번)
        const colW = two ? (QW - COL_GAP) / 2 : QW;
        const sets = R.sets.map(s => layoutSet(s, colW));
        const rows = two ? [Math.max(sets[0].h, sets[1].h)] : sets.map(s => s.h);
        const bodyH = rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * 22;
        // 속지만 밤 안내 (33번): 원단 아래 차분한 작은 회색 글
        let nLines = [];
        if (R.night && typeof SHEER_NIGHT_NOTE === 'string') { setFont(400, N_SIZE, SANS); nLines = wrap(SHEER_NIGHT_NOTE, QW); }
        const noteH = nLines.length ? 18 + nLines.length * N_LH : 0;
        return { R, nameW, QX, QW, qLines, saidInline, headH, two, colW, sets, rows, cRows, cY, sameY, sLines, sY, nLines, bodyH, h: headH + bodyH + noteH + 28 };
    }
    function chip(hex, x, base) {
        ctx.fillStyle = hex; ctx.fillRect(x, base - C_SW + 3, C_SW, C_SW);
        ctx.strokeStyle = 'rgba(43,34,26,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, base - C_SW + 3.5, C_SW - 1, C_SW - 1);
    }
    // "■ 벽 라이트 베이지 #D8CEBF" 한 칸: 색 조각 · 벽/바닥(작게, SOFT) · 이름(400, DARK) · 코드(작게, SOFT). 볼드 없이 색 농도로 구분 (39번)
    function drawColorPart(c, x, base) {
        if (c.hex) { chip(c.hex, x, base); x += C_SW + 10; }
        setFont(400, C_SIZE, SANS); text(c.k, x, base, 'left', SOFT); x += ctx.measureText(c.k).width + 8;
        if (c.name) { setFont(400, C_SIZE, SANS); text(c.name, x, base, 'left', DARK); x += ctx.measureText(c.name).width + 8; }
        if (c.hex) { setFont(400, C_SIZE, SANS); text(c.hex, x, base, 'left', SOFT); x += ctx.measureText(c.hex).width; }
        return x + 28;
    }
    function drawRoom(L, y) {
        if (y > START_Y) hline(CX, RX, y, LINE, 0.6);      // 첫 공간 윗선은 머리글 선을 그대로 쓰고, 다음 공간부터는 1·3쪽과 같은 가는 베이지 실선 (39·76번)
        setFont(400, R_SIZE, SERIF); text(L.R.name, CX, y + 44, 'left', DARK);
        setFont(400, Q_SIZE, SERIF);
        L.qLines.forEach((ln, i) => text(ln, L.QX, y + 44 + i * Q_LH, 'left', DARK));
        if (L.qLines.length) {
            const lastY = y + 44 + (L.qLines.length - 1) * Q_LH;
            const lastW = ctx.measureText(L.qLines[L.qLines.length - 1]).width;
            setFont(400, PAPER_F4, SANS);
            if (L.saidInline) text('하셨어요', L.QX + lastW + 12, lastY, 'left', SOFT);
            else text('하셨어요', L.QX, lastY + Q_LH, 'left', SOFT);
        }
        L.cRows.forEach((row, i) => { let x = L.QX; row.forEach(c => { x = drawColorPart(c, x, y + L.cY + i * C_LH); }); });
        if (L.R.sameAs) { setFont(400, C_SIZE, SANS); text(`벽과 바닥은 ${L.R.sameAs}${whyJosa(L.R.sameAs)} 같아요.`, L.QX, y + L.sameY, 'left', MUTED); }
        if (L.sLines.length) { setFont(400, B_SIZE, SANS); L.sLines.forEach((ln, i) => text(ln, L.QX, y + L.sY + i * B_LH, 'left', DARK)); }
        const top = y + L.headH;
        L.sets.forEach((b, i) => {
            const sx = L.QX + (L.two ? i * (L.colW + COL_GAP) : 0);
            const sy = top + (L.two ? 0 : L.rows.slice(0, i).reduce((a, h) => a + h + 22, 0));
            b.ops.forEach(o => {
                if (o.chip) {
                    chip(o.chip, sx, sy + o.y);
                    setFont(400, C_SIZE, SANS); text(o.chip, sx + C_SW + 10, sy + o.y, 'left', SOFT);
                    return;
                }
                setFont(o.f[0], o.f[1], o.f[2]); text(o.t, sx + (o.x || 0), sy + o.y, 'left', o.c);
            });
        });
        if (L.nLines.length) {
            setFont(400, N_SIZE, SANS);
            L.nLines.forEach((ln, i) => text(ln, L.QX, top + L.bodyH + 18 + (i + 1) * N_LH - 8, 'left', SOFT));
        }
    }
    function pageLabel(i, n, H) { if (n < 2) return; setFont(400, PAPER_F4, SANS); text(`${i + 1} / ${n}`, W / 2, H - 30, 'center', SOFT); }
    return { START_Y, hdr, layoutRoom, drawRoom, pageLabel };
}
// 카드 쪽(들) 만들기: 머리글·글자 크기가 1·2·3쪽 모두 같게 유지되도록 축소 배율(TICKET_SCALES)은 쓰지 않고, 한 쪽에 안 들어가면 compact → 다음 쪽으로 나눔 (39번)
function buildWhyCanvases(data, opts, totalAfter, before) {      // before: 앞에 있는 쪽 수 (우리 집 색, 37번)
    const info = whySetsOf(data);
    if (!info.rooms.length) return [];
    const plan = compact => {
        const W = PAPER_W, PAGE_H = 1e6, BOTTOM = 90;      // 쪽 나눔 없음 (75번)
        const T = drawWhy(document.createElement('canvas').getContext('2d'), data, W, compact);
        const pages = []; let cur = { items: [], y: T.START_Y };
        info.rooms.forEach(R => {
            const L = T.layoutRoom(R);
            if (cur.items.length && cur.y + L.h > PAGE_H - BOTTOM) { pages.push(cur); cur = { items: [], y: T.START_Y }; }
            cur.items.push({ L, y: cur.y }); cur.y += L.h;
        });
        pages.push(cur);
        return { compact, W, PAGE_H, pages };
    };
    let p = plan(false);
    if (p.pages.length > 1) { const q = plan(true); if (q.pages.length < p.pages.length) p = q; }
    const pr = opts.pixelRatio || 1, n = p.pages.length;
    return p.pages.map((pg, pi) => {
        const H = Math.ceil(pg.y + 90);
        const canvas = document.createElement('canvas');
        canvas.width = TICKET_W * pr; canvas.height = Math.round(H * PAPER_K * pr);
        const ctx = canvas.getContext('2d');
        ctx.scale(PAPER_K * pr, PAPER_K * pr);
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, p.W, H);
        ctx.textBaseline = 'alphabetic';
        const t = drawWhy(ctx, data, p.W, p.compact);
        t.hdr();
        pg.items.forEach(it => t.drawRoom(it.L, it.y));
        t.pageLabel(pi + (before || 0), totalAfter(n), H);
        return canvas;
    });
}

// ==============================================================
// 〈우리 집 색〉 쪽 (작업목록 37번): 최종 제안 맨 앞. 공간끼리 어떻게 어울리는지 = 색 지도 + 총평 2~3문장 + 공간별 색 줄
//  이유 카드(이 공간에 왜 이 원단인지)와 역할을 나눔 — 이유 카드 문장은 여기 다시 쓰지 않음. 금액·직원용 색 사전 이름 없음
//  원단을 담은 공간이 2곳 이상이고 그 원단 중 색 값(L·a·b)이 있는 것이 있을 때만. 시안: Claude outputs/시안/우리집색_시안.html
// ==============================================================
// 총평 숫자 (임시값 — 몇 집 써 보고 사장님이 정함). 색 차이는 Lab 거리(ΔE76)
const HOUSE_UNIFY = 14;          // 공간마다 대표 원단끼리 가장 먼 차이가 이 안이면 "집 전체를 ○○ 계열로"
const HOUSE_SHEER_SAME = 6;      // 속지끼리 가장 먼 차이가 이 안이면 "속지는 비슷한 밝기로"
const HOUSE_FUR_NEAR = 12;       // 가구와 그 공간 벽·바닥 색 차이가 이 안이면 "벽·바닥과 비슷한 색이라" (65번)
const HOUSE_KIND_ORDER = { 겉지: 0, 속지: 1, 블라인드: 2 };
// 받침에 따라 은/는 · 이/가 · 과/와 (숫자로 끝나면 읽는 소리로: 1·3·6·7·8·0은 받침 있음)
function houseJosa(w, withB, noB) {
    const ch = String(w).slice(-1), code = ch.charCodeAt(0);
    const has = (code >= 0xAC00 && code <= 0xD7A3) ? (code - 0xAC00) % 28 > 0 : '013678'.includes(ch);
    return has ? withB : noB;
}
// 공간마다 [이름 · 잰 벽·바닥 · 가구 · 원단들(색 값)] — 원단을 담은 공간만
function houseSpacesOf(data) {
    const nameOf = (k, c) => (window.RoomColor && RoomColor.colorName && (RoomColor.colorName(k, c) || {}).name) || '';
    const okLab = c => c && typeof c.L === 'number' && typeof c.a === 'number' && typeof c.b === 'number';
    const okHex = h => /^#[0-9a-f]{6}$/i.test(h || '');
    return data.rooms.map(room => {
        const items = room.items.filter(it => it.fabricId);
        if (!items.length) return null;
        const mc = (room.raw && room.raw.measuredColor) || {};
        const part = k => (okLab(mc[k]) && okHex(mc[k].hex)) ? { L: mc[k].L, a: mc[k].a, b: mc[k].b, hex: mc[k].hex.toUpperCase(), name: nameOf(k, mc[k]) } : null;
        // 가구 (66번): 종류 이름은 새 이름으로(예전 수납장·식탁도), 그대로 두는 가구를 앞에 (이불·러그는 뒤로, 같은 쪽끼리는 찍은 순서)
        const RC = window.RoomColor || {};
        const fur = (Array.isArray(mc.furniture) ? mc.furniture : []).filter(f => okLab(f) && okHex(f.hex))
            .map(f => ({ n: RC.furLabel ? RC.furLabel(f.n) : f.n, L: f.L, a: f.a, b: f.b, hex: f.hex.toUpperCase(), name: RC.furName ? RC.furName(f) : '', stay: RC.furStays ? RC.furStays(f.n) : true }))
            .sort((x, y) => (y.stay ? 1 : 0) - (x.stay ? 1 : 0));
        const fabs = items.map(it => {
            const col = whyFabricColor(it.fabricId, it.colorName);
            const lab = col && typeof col.L === 'number' ? { L: col.L, a: col.a, b: col.b } : null;
            return { k: it.kind, fabricId: it.fabricId, colorName: it.colorName, nm: it.tone ? `${it.name} · ${it.tone}` : it.name, hex: (col && col.hex) || it.fill, lab };      // 61번
        });
        return { name: room.name, wall: part('wall'), floor: part('floor'), fur, fabs, raw: room.raw || {} };
    }).filter(Boolean);
}
function houseShows(data, opts) {
    if (opts && opts.noCard) return false;
    const sp = houseSpacesOf(data);
    return sp.length >= 2 && sp.some(s => s.fabs.some(f => f.lab));
}
// 공간의 대표 원단: 겉지 → 속지 → 블라인드 (색 값이 있는 것 중)
function houseRep(s) {
    return s.fabs.filter(f => f.lab).sort((x, y) => (HOUSE_KIND_ORDER[x.k] ?? 3) - (HOUSE_KIND_ORDER[y.k] ?? 3))[0] || null;
}
// 1번 공간별 창가 색 띠 (43번 모양, 세로 화면·가로 그림이 같이 씀, 65번)
//  { mid: [{ k, hex, f }] 가운데 창 줄(벽·원단, f = 폭 비율), baseR = 커튼 아래 벽 높이 비율(0이면 바닥까지), wHex, fHex }
function houseStripOf(s, raw) {
    raw = raw || {};
    const wHex = s.wall && s.wall.hex ? s.wall.hex : '#f2eee8';
    const fHex = s.floor && s.floor.hex ? s.floor.hex : '#e5ddcf';
    const fabs = s.fabs || [];
    // 부분 치수가 있어서 벽이 남는 경우에만 벽 연결 및 비율 계산 (43번)
    const sW = Number(raw.spaceWidth) || 0, cW = Number(raw.width) || 0;
    const sH = Number(raw.spaceHeight) || 0, cH = Number(raw.height) || 0;
    const isPartMode = raw.sizeMode === 'part' || raw.sizeMode === 'partial';
    const hasPartialW = (sW > 0 && cW > 0 && sW > cW);
    const hasPartialH = (sH > 0 && cH > 0 && sH > cH);
    let curt = 8.8, side = 0.6, baseR = 0;      // 전체 모드: 커튼이 88%, 양옆 벽 6%씩, 바닥까지 닿음
    if (isPartMode || hasPartialW || hasPartialH) {
        if (hasPartialW) { curt = 10 * Math.max(0.18, Math.min(0.85, cW / sW)); side = (10 - curt) / 2; }
        else if (isPartMode) { curt = 6.0; side = 2.0; }
        if (hasPartialH) baseR = Math.max(0.12, Math.min(0.55, (sH - cH) / sH));      // 높이가 다를 때만 하단 벽
    }
    const mid = [], add = (k, hex, f) => mid.push({ k, hex: hex || '#e5dcd0', f });
    if (fabs.length === 2 && fabs.some(f => f.k === '속지') && fabs.some(f => f.k === '겉지')) {
        const drape = fabs.find(f => f.k === '겉지'), sheer = fabs.find(f => f.k === '속지');
        add('벽', wHex, side); add('겉지', drape.hex, curt * 0.25); add('속지', sheer.hex, curt * 0.5); add('겉지', drape.hex, curt * 0.25); add('벽', wHex, side);
    } else if (fabs.length) {
        add('벽', wHex, side); fabs.forEach(f => add(f.k, f.hex, curt / fabs.length)); add('벽', wHex, side);
    } else {
        add('벽', wHex, 4.0);
        if (s.fur && s.fur[0]) add(s.fur[0].n || '가구', s.fur[0].hex, 1.2);
    }
    return { mid, baseR, wHex, fHex };
}
// 1번 공간별 진단 문장 (65번): 창 방향(향) + 잰 벽·바닥·가구 색. 원단 이야기(빛 거르기·암막·손님 답·고른 이유)는 2번 몫이라 안 씀
const HOUSE_DIR_SAY = {      // [앞에 올 때, 뒤에 올 때]
    E: ['아침 해가 먼저 들고', '아침 해가 먼저 드는'], W: ['오후 햇빛이 길게 들고', '오후 햇빛이 길게 드는'],
    S: ['하루 내내 밝고', '하루 내내 밝은'], N: ['빛이 고르고 은은하며', '빛이 고르고 은은한']
};
function houseColorWord(c) {
    const nm = c.name || '';
    if (!nm) return '';
    if (/^(라이트|딥|다크) |화이트|차콜|네이비/.test(nm)) return nm;      // 이름에 이미 밝기가 들어 있으면 그대로
    return (c.L >= 75 ? '밝은 ' : (c.L >= 55 ? '중간 톤 ' : '어두운 ')) + nm;
}
function houseDiagnosis(s, raw) {
    const out = [];
    const dirs = (typeof windowDirOf === 'function') ? windowDirOf(raw && raw.windowDir).sort((a, b) => 'SNEW'.indexOf(a) - 'SNEW'.indexOf(b)) : [];
    if (dirs.length) {
        const say = dirs.length === 2 ? `${HOUSE_DIR_SAY[dirs[0]][0]} ${HOUSE_DIR_SAY[dirs[1]][1]}` : HOUSE_DIR_SAY[dirs[0]][1];
        out.push(`${say} ${windowDirText(dirs)}향이에요.`);
    }
    const wall = s.wall && houseColorWord(s.wall), floor = s.floor && houseColorWord(s.floor);
    const base = wall && floor ? `${wall} 벽과 ${floor} 바닥` : (wall ? `${wall} 벽` : (floor ? `${floor} 바닥` : ''));
    // 가구 (66번 사장님: 현장에서 공간에 크게 영향을 준다고 본 것만 찍으니 모두): "다크 그레이 소파, 월넛 책장과 아이보리 이불·침구가"
    const fl = s.fur || [], word = f => `${f.name ? houseColorWord(f) + ' ' : ''}${f.n}`, last = fl[fl.length - 1];
    const fur = !fl.length ? '' : fl.length === 1 ? word(fl[0])
        : fl.slice(0, -1).map(word).join(', ') + houseJosa(fl[fl.length - 2].n, '과', '와') + ' ' + word(last);
    if (base && fur) out.push(`${base}이 바탕이고, ${fur}${houseJosa(last.n, '이', '가')} 함께 놓여 있어요.`);
    else if (base) out.push(`${base}이 바탕이에요.`);
    else if (fur) out.push(`${fur}${houseJosa(last.n, '이', '가')} 함께 놓여 있어요.`);
    return out;
}
// 총평 (37-4): ① 흐름(한 문장) → ② 속지(속지 공간 2곳 이상일 때) → ③ 가구(집 전체 가구 중 가장 진한·밝은 것, 없으면 첫 가구, 진단 말투 65번·66번) · 최대 3문장
function houseBrief(sp) {
    const out = [], S = sp.filter(houseRep), reps = S.map(s => houseRep(s).lab);
    const maxDist = list => { let m = 0; list.forEach((p, i) => list.forEach((q, j) => { if (j > i) m = Math.max(m, whyDE(p, q)); })); return m; };
    const avg = (list, k) => list.reduce((t, c) => t + c[k], 0) / list.length;
    // ① 흐름 (비교할 공간이 2곳 이상일 때)
    if (S.length >= 2) {
        const maxD = maxDist(reps);
        if (maxD <= HOUSE_UNIFY) {
            const L = avg(reps, 'L'), b = avg(reps, 'b');
            const fam = (L >= 80 ? '밝은 ' : (L >= 60 ? '부드러운 ' : '깊은 ')) + (b >= 12 ? '베이지' : (b >= 5 ? '아이보리·그레이지' : '그레이'));
            out.push(`집 전체를 ${fam} 계열로 맞춰, 공간을 옮겨 다녀도 흐름이 끊기지 않아요.`);
        } else {
            let point = null;
            if (S.length >= 3) S.forEach((s, i) => {
                const rest = reps.filter((_, j) => j !== i);
                if (!point && maxDist(rest) <= HOUSE_UNIFY && Math.min(...rest.map(q => whyDE(reps[i], q))) > HOUSE_UNIFY) point = { s, i, rest };
            });
            if (point) {
                const o = reps[point.i], dL = o.L - avg(point.rest, 'L'), db = o.b - avg(point.rest, 'b');
                const dir = Math.abs(dL) >= Math.abs(db) * 1.2 ? (dL > 0 ? '한 톤 밝게' : '한 톤 진하게') : (db > 0 ? '조금 따뜻하게' : '조금 차분하게');
                const names = S.filter((_, j) => j !== point.i).map(s => s.name).join('·');
                out.push(`${names}${houseJosa(names, '은', '는')} 같은 계열의 색으로 잇고, ${point.s.name}만 ${dir} 두어 분위기를 살려 제안합니다.`); // 41번
            } else if (S.length === 2) {
                out.push(`${S[0].name}${houseJosa(S[0].name, '과', '와')} ${S[1].name}의 빛과 바탕색에 맞춰, 각 공간의 고유한 분위기를 살려 제안합니다.`); // 41번
            } else {
                out.push('각 공간의 빛과 바탕색에 맞춰, 고유한 분위기를 살려 제안합니다.'); // 41번
            }
        }
    }
    // ② 속지
    const withSheer = sp.filter(s => s.fabs.some(f => f.k === '속지' && f.lab));
    const sh = withSheer.map(s => s.fabs.find(f => f.k === '속지' && f.lab));
    if (sh.length >= 2) {
        if (sh.every(f => f.fabricId === sh[0].fabricId && f.colorName === sh[0].colorName)) {
            const who = withSheer.length === sp.length ? '모든 공간을' : withSheer.map(s => s.name).join('·') + ' 모두';
            out.push(`속지는 ${who} 같은 색으로 맞춰, 밖에서 보면 창이 한결같아 보여요.`);
        } else if (maxDist(sh.map(f => f.lab)) <= HOUSE_SHEER_SAME) {
            out.push('속지는 비슷한 밝기로 맞춰, 밖에서 봐도 창이 고르게 보여요.');
        }
    }
    // ③ 가구 (65번: 진단 말투 — 커튼을 어떻게 골랐는지는 2번 몫이라 안 씀)
    //  66번: 가구가 여러 개여도 한 문장. 집에서 가장 진한 가구 → 가장 밝은 가구 → 없으면 첫 공간의 첫 가구(그대로 두는 가구가 앞)
    const furs = [];
    sp.forEach(s => s.fur.forEach(f => furs.push({ s, f })));
    if (furs.length) {
        const othersOf = f => {
            const o = [];
            sp.forEach(s => { if (s.wall) o.push(s.wall); if (s.floor) o.push(s.floor); s.fur.forEach(x => { if (x !== f) o.push(x); }); });
            return o;
        };
        const darkest = furs.find(({ f }) => { const o = othersOf(f); return o.length && o.every(x => f.L < x.L); });
        const lightest = darkest ? null : furs.find(({ f }) => { const o = othersOf(f); return o.length && o.every(x => f.L > x.L); });
        const { s: fs, f } = darkest || lightest || furs[0];
        const nm = f.name ? f.name + ' ' : '', is = houseJosa(fs.name, '은', '는'), ga = houseJosa(f.n, '이', '가');
        const base = [fs.wall, fs.floor].filter(Boolean);
        if (darkest) out.push(`${fs.name}${is} ${nm}${f.n}${ga} 집에서 가장 진한 색이에요.`);
        else if (lightest) out.push(`${fs.name}${is} ${nm}${f.n}${ga} 집에서 가장 밝은 색이에요.`);
        else if (base.length && Math.min(...base.map(o => whyDE(f, o))) <= HOUSE_FUR_NEAR) out.push(`${fs.name}${is} ${f.n}${ga} 벽·바닥과 비슷한 색이라 공간이 한 톤으로 이어져요.`);
        else out.push(`${fs.name}${is} ${nm}${f.n}${ga} 바탕색 사이에서 또렷하게 보여요.`);
    }
    return out.slice(0, 3);
}
// 색 지도 (고객 더 보기 지도와 같은 축·같은 말): 900×470 좌표에 그림. ctx는 미리 옮기고 늘려 둠
//  ● 고른 원단(같은 원단·같은 색은 하나로, "거실·안방 속지") · ■ 벽·바닥(모든 공간이 같으면 "벽") · ◆ 가구
function drawHouseMap(ctx, sp) {
    const MAPF = 15;
    const W = 900, H = 470, P = { l: 76, r: 76, t: 34, b: 40 };
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const PAPER = '#fffdf9';
    const marks = [], seen = {};
    sp.forEach(s => {
        [['벽', s.wall], ['바닥', s.floor]].forEach(([k, c]) => {
            if (!c) return;
            const key = k + c.hex;
            if (seen[key]) { seen[key].who.push(s.name); return; }
            marks.push(seen[key] = { t: 's', c, k, who: [s.name] });
        });
        s.fur.forEach(f => marks.push({ t: 'd', c: f, k: f.n, who: [s.name] }));
        s.fabs.forEach(f => {
            if (!f.lab) return;
            const key = 'f' + f.k + f.fabricId + '|' + f.colorName;
            if (seen[key]) { if (!seen[key].who.includes(s.name)) seen[key].who.push(s.name); return; }
            marks.push(seen[key] = { t: 'c', c: Object.assign({ hex: f.hex }, f.lab), k: f.k, who: [s.name] });
        });
    });
    if (!marks.length) return;
    const Ls = marks.map(m => m.c.L), bs = marks.map(m => m.c.b);
    let Lmin = Math.min(...Ls) - 4, Lmax = Math.max(...Ls) + 3, bmin = Math.min(...bs) - 3, bmax = Math.max(...bs) + 3;
    // 색이 몇 개 안 되거나 서로 가까우면 조금 벌어진 것도 크게 보이므로 눈금 폭을 조금은 남김
    if (Lmax - Lmin < 24) { const m = (Lmax + Lmin) / 2; Lmin = m - 12; Lmax = m + 12; }
    if (bmax - bmin < 14) { const m = (bmax + bmin) / 2; bmin = m - 7; bmax = m + 7; }
    const X = b => P.l + (b - bmin) / (bmax - bmin) * (W - P.l - P.r), Y = L => P.t + (Lmax - L) / (Lmax - Lmin) * (H - P.t - P.b);
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    ctx.strokeStyle = '#e5dcd0'; ctx.lineWidth = 0.75;
    [0.25, 0.5, 0.75].forEach(f => { const y = P.t + (H - P.t - P.b) * f; line(P.l, y, W - P.r, y); });
    [1 / 3, 2 / 3].forEach(f => { const x = P.l + (W - P.l - P.r) * f; line(x, P.t, x, H - P.b); });
    ctx.font = `400 ${MAPF}px ${SANS}`; ctx.fillStyle = '#6f5f4f';      // 76번: 정돈된 스케일과 0.5px 초세선
    ctx.textAlign = 'center'; ctx.fillText('↑ 밝은 색', W / 2, P.t - 12); ctx.fillText('↓ 진한 색', W / 2, H - 10);
    ctx.textAlign = 'right'; ctx.fillText('차가운 색', P.l - 12, H / 2);
    ctx.textAlign = 'left'; ctx.fillText('따뜻한 색', W - P.r + 12, H / 2);
    // 자리 + 겹친 점 밀기
    const pts = marks.map(m => ({ m, x: X(m.c.b), y: Y(m.c.L), r: m.t === 'c' ? 13 : 9 }));
    for (let k = 0; k < 60; k++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], c = pts[j], dx = c.x - a.x, dy = c.y - a.y, dd = Math.hypot(dx, dy) || 0.01, need = a.r + c.r + 6;
        if (dd < need) { const mv = (need - dd) / 2, ux = dx / dd, uy = dy / dd; a.x -= ux * mv; a.y -= uy * mv; c.x += ux * mv; c.y += uy * mv; }
    }
    pts.forEach(p => { p.x = Math.max(P.l - 24, Math.min(W - P.r + 24, p.x)); p.y = Math.max(P.t + 8, Math.min(H - P.b - 8, p.y)); });
    // 표시: 네모·마름모 먼저, 원단 동그라미는 위에
    pts.filter(p => p.m.t !== 'c').forEach(p => {
        ctx.save(); ctx.translate(p.x, p.y);
        if (p.m.t === 'd') ctx.rotate(Math.PI / 4);
        const s = p.m.t === 's' ? 15 : 13;
        ctx.fillStyle = p.m.c.hex; ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = 'rgba(43,34,26,0.22)'; ctx.lineWidth = 0.75; ctx.strokeRect(-s / 2 + 0.5, -s / 2 + 0.5, s - 1, s - 1);
        ctx.restore();
    });
    pts.filter(p => p.m.t === 'c').forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fillStyle = p.m.c.hex; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.lineWidth = 0.75; ctx.strokeStyle = 'rgba(43,34,26,0.22)'; ctx.stroke();
    });
    // 글자: 오른쪽 → 왼쪽 → 위 → 아래 중 다른 글자·점과 안 겹치는 자리 (원단 글자를 먼저)
    const boxes = pts.map(p => ({ x1: p.x - p.r, y1: p.y - p.r, x2: p.x + p.r, y2: p.y + p.r }));
    ctx.font = `400 ${MAPF}px ${SANS}`; const aw = s => ctx.measureText(s).width;      // 축 글자 자리도 비워 둠 (75번)
    boxes.push({ x1: W / 2 - aw('↑ 밝은 색') / 2, y1: P.t - 12 - MAPF, x2: W / 2 + aw('↑ 밝은 색') / 2, y2: P.t - 9 }, { x1: W / 2 - aw('↓ 진한 색') / 2, y1: H - 10 - MAPF, x2: W / 2 + aw('↓ 진한 색') / 2, y2: H - 7 },
        { x1: P.l - 12 - aw('차가운 색'), y1: H / 2 - MAPF, x2: P.l - 12, y2: H / 2 + 3 }, { x1: W - P.r + 12, y1: H / 2 - MAPF, x2: W - P.r + 12 + aw('따뜻한 색'), y2: H / 2 + 3 });
    const hit = q => boxes.some(o => q.x1 < o.x2 && q.x2 > o.x1 && q.y1 < o.y2 && q.y2 > o.y1) || q.x1 < 4 || q.x2 > W - 4;
    const put = (p, t, fs, weight, color) => {
        ctx.font = `${weight} ${fs}px ${SANS}`;
        const w = ctx.measureText(t).width, g = p.r + 6;
        const cands = [[p.x + g, p.y + fs * 0.35, 'left'], [p.x - g, p.y + fs * 0.35, 'right'], [p.x, p.y - g - 2, 'center'], [p.x, p.y + g + fs, 'center']];
        // 빈자리가 없으면 가장 덜 겹치는 자리로 (75번: 글자가 커져 겹치던 것)
        const over = q => boxes.reduce((a, o) => a + Math.max(0, Math.min(q.x2 + 6, o.x2) - Math.max(q.x1 - 6, o.x1)) * Math.max(0, Math.min(q.y2 + 4, o.y2) - Math.max(q.y1 - 4, o.y1)), 0) + ((q.x1 < 4 || q.x2 > W - 4) ? 1e6 : 0);
        let pick = null, best = null, bestQ = null;
        for (const cd of cands) {
            const x1 = cd[2] === 'left' ? cd[0] : (cd[2] === 'right' ? cd[0] - w : cd[0] - w / 2), q = { x1, y1: cd[1] - fs, x2: x1 + w, y2: cd[1] + 3 };
            const v = over(q);
            if (best === null || v < best) { best = v; pick = cd; bestQ = q; }
            if (v === 0) break;
        }
        boxes.push(bestQ);
        ctx.textAlign = pick[2]; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = PAPER; ctx.strokeText(t, pick[0], pick[1]);
        ctx.fillStyle = color; ctx.fillText(t, pick[0], pick[1]);
    };
    pts.filter(p => p.m.t === 'c').forEach(p => put(p, p.m.who.join('·') + ' ' + p.m.k, MAPF, 400, '#2b221a'));
    pts.filter(p => p.m.t !== 'c').forEach(p => {
        const t = p.m.t === 's' ? ((p.m.who.length === sp.length && sp.length > 1) ? p.m.k : p.m.who.join('·') + ' ' + p.m.k) : p.m.who[0] + ' ' + p.m.k;
        put(p, t, MAPF, 400, '#6f5f4f');
    });
}
// 쪽 짜기·그리기. 넘치면 글자를 한 단계 줄이고(compact), 그래도 넘치면 공간별 색 줄만 다음 쪽으로 (지도·총평은 첫 쪽)
function planHouse(data) {
    const sp = houseSpacesOf(data), brief = houseBrief(sp);
    const hasFur = sp.some(s => s.fur.length);
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const DARK = '#2b221a', MUTED = '#6f5f4f', SOFT = '#6f5f4f', LINE = '#e5dcd0';
    const W = PAPER_W, H = 1e6, PAD = TICKET_PAD,      // 쪽 나눔 없음 (75번)
          CX = PAD, RX = W - PAD, CW = RX - CX, BOTTOM = 90;
    const MAP_Y = TICKET_HEAD_Y + 26, MAP_H = Math.round(CW * 470 / 900);
    const make = compact => {
        const Q_SIZE = PAPER_F3, Q_LH = compact ? 38 : 42;          // 총평 (400 명조, 이유 카드 손님 말과 같은 크기·굵기, 39번)
        const N_SIZE = PAPER_F2;                                      // 공간 이름 (400 명조, 이유 카드와 같은 크기, 39번)
        const C_SIZE = PAPER_F4;                                      // 이름 옆 향
        const F_SIZE = PAPER_F4, F_LH = compact ? 30 : 32;            // 진단 문장 (400 고딕, 65번)
        const STRIP_H = compact ? 50 : 56;                                     // 창가 색 띠 (한 줄 가득, 65번)
        const ctx = document.createElement('canvas').getContext('2d');
        const wrap = (str, maxW) => {
            const lines = []; let cur = '';
            for (const word of String(str).split(' ')) {
                const test = cur ? cur + ' ' + word : word;
                if (ctx.measureText(test).width <= maxW || !cur) { cur = test; continue; }
                lines.push(cur); cur = word;
            }
            if (cur) lines.push(cur);
            return lines;
        };
        let y = MAP_Y + MAP_H + 6;
        const legendY = y + 22; y = legendY + 26;
        ctx.font = `400 ${Q_SIZE}px ${SERIF}`;
        const bLines = brief.length ? wrap(brief.join(' '), CW) : [];
        const briefLineY = y; y += bLines.length ? 24 : 0;
        const bY = y + Q_SIZE; if (bLines.length) y = bY + (bLines.length - 1) * Q_LH + 20;
        const rowsTop = y + 10;
        // 공간 줄 (65번): 위에서 아래로 [공간 이름 · 향] / [색 띠 한 줄 가득] / [진단 문장]
        const rowLayouts = sp.map(s => {
            const dirTxt = s.raw && s.raw.windowDir && typeof windowDirText === 'function' ? windowDirText(s.raw.windowDir) : '';
            ctx.font = `400 ${F_SIZE}px ${SANS}`;
            const dLines = wrap(houseDiagnosis(s, s.raw).join(' '), CW);
            const h = 20 + N_SIZE + 14 + STRIP_H + (dLines.length ? 14 + F_SIZE + (dLines.length - 1) * F_LH : 0) + 22;
            return { s, dirTxt, strip: houseStripOf(s, s.raw), dLines, h };
        });
        // 공간 줄을 쪽에 나눔: 첫 쪽은 지도·총평 아래, 다음 쪽부터는 머리글 아래
        const pages = [{ rows: [], y: rowsTop }];
        rowLayouts.forEach(R => {
            let pg = pages[pages.length - 1];
            if (pg.rows.length && pg.y + R.h > H - BOTTOM) { pg = { rows: [], y: TICKET_HEAD_Y + 20 }; pages.push(pg); }
            pg.rows.push({ R, y: pg.y }); pg.y += R.h;
        });
        const fits = pages.length === 1 && pages[0].y <= H - BOTTOM;
        const draw = (c, pi, label) => {
            const t = drawWhy(c, data, W, compact, '공간의 색과 빛');      // 65번
            t.hdr();
            const hline = (x1, x2, yy, color, lw) => { c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.moveTo(x1, yy); c.lineTo(x2, yy); c.stroke(); };
            if (pi === 0) {
                c.save(); c.translate(CX, MAP_Y); c.scale(CW / 900, CW / 900); drawHouseMap(c, sp); c.restore();
                // 범례 (가구가 없으면 가구 빼기)
                const lg = [['c', '고른 원단'], ['s', '벽·바닥']].concat(hasFur ? [['d', '가구']] : []);
                c.font = `400 ${PAPER_F4}px ${SANS}`;
                const lw = lg.map(([, t]) => 22 + c.measureText(t).width), total = lw.reduce((a, b) => a + b, 0) + (lg.length - 1) * 30;
                let lx = W / 2 - total / 2;
                lg.forEach(([shape, t], i) => {
                    const cy = legendY - 6;
                    c.fillStyle = '#e5dcd0';
                    if (shape === 'c') { c.beginPath(); c.arc(lx + 7, cy, 7, 0, Math.PI * 2); c.fill(); }
                    else { c.save(); c.translate(lx + 7, cy); if (shape === 'd') c.rotate(Math.PI / 4); const z = shape === 'd' ? 10 : 12; c.fillRect(-z / 2, -z / 2, z, z); c.strokeStyle = 'rgba(43,34,26,0.25)'; c.lineWidth = 1; c.strokeRect(-z / 2, -z / 2, z, z); c.restore(); }
                    c.textAlign = 'left'; c.fillStyle = SOFT; c.fillText(t, lx + 20, legendY);
                    lx += lw[i] + 30;
                });
                if (bLines.length) {
                    hline(CX, RX, briefLineY, LINE, 0.6);
                    c.font = `400 ${Q_SIZE}px ${SERIF}`; c.fillStyle = DARK; c.textAlign = 'left';
                    bLines.forEach((ln, i) => c.fillText(ln, CX, bY + i * Q_LH));
                }
            }
            const rows = pages[pi].rows;
            if (rows.length) hline(CX, RX, rows[0].y, LINE, 0.6);
            rows.forEach(({ R, y: ry }) => {
                c.font = `400 ${N_SIZE}px ${SERIF}`; c.fillStyle = DARK; c.textAlign = 'left';
                const nameY = ry + 20 + N_SIZE;
                c.fillText(R.s.name, CX, nameY);
                if (R.dirTxt) {
                    const nw = c.measureText(R.s.name).width;
                    c.font = `400 ${C_SIZE}px ${SANS}`; c.fillStyle = SOFT; c.fillText(R.dirTxt + '향', CX + nw + 14, nameY);
                }
                // 색 띠: 가운데 창 줄(벽·원단) → 커튼 아래 벽(부분 치수일 때만) → 바닥
                const sy = nameY + 14, FLOOR_H = Math.round(STRIP_H * 0.24), MID_H = STRIP_H - FLOOR_H;
                const baseH = R.strip.baseR ? Math.round(MID_H * R.strip.baseR) : 0, winH = MID_H - baseH;
                const tot = R.strip.mid.reduce((t, m) => t + m.f, 0) || 1;
                let sx = CX;
                R.strip.mid.forEach((m, i) => {
                    const w = i === R.strip.mid.length - 1 ? RX - sx : CW * m.f / tot;
                    c.fillStyle = m.hex; c.fillRect(sx, sy, w + 0.5, winH); sx += w;
                });
                if (baseH) { c.fillStyle = R.strip.wHex; c.fillRect(CX, sy + winH, CW, baseH); }
                c.fillStyle = R.strip.fHex; c.fillRect(CX, sy + MID_H, CW, FLOOR_H);
                hline(CX, RX, sy + MID_H, 'rgba(43,34,26,0.08)', 0.6);
                c.strokeStyle = 'rgba(43,34,26,0.12)'; c.lineWidth = 0.6; c.strokeRect(CX + 0.5, sy + 0.5, CW - 1, STRIP_H - 1);
                // 진단 문장
                c.font = `400 ${F_SIZE}px ${SANS}`; c.fillStyle = MUTED; c.textAlign = 'left';
                R.dLines.forEach((ln, i) => c.fillText(ln, CX, sy + STRIP_H + 14 + F_SIZE + i * F_LH));
                hline(CX, RX, ry + R.h, LINE, 0.6);
            });
            label();
        };
        return { fits, pages, draw };
    };
    const p = make(false);
    return p.fits ? p : make(true);
}
// 우리 집 색 쪽(들): { count, draw(opts, before, total) → canvas[] }. 생기지 않으면 count 0
function buildHouseCanvases(data, opts) {
    if (!houseShows(data, opts)) return { count: 0, draw: () => [] };
    const plan = planHouse(data);
    return {
        count: plan.pages.length,
        draw(o, total) {
            const pr = (o && o.pixelRatio) || 1;
            return plan.pages.map((pg, pi) => {
                const H = Math.ceil(pg.y + 90);
                const canvas = document.createElement('canvas');
                canvas.width = TICKET_W * pr; canvas.height = Math.round(H * PAPER_K * pr);
                const ctx = canvas.getContext('2d');
                ctx.scale(PAPER_K * pr, PAPER_K * pr);
                ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, PAPER_W, H);
                ctx.textBaseline = 'alphabetic';
                plan.draw(ctx, pi, () => {
                    if (total < 2) return;
                    ctx.font = `400 ${PAPER_F4}px Pretendard,"Noto Sans KR","Malgun Gothic",sans-serif`; ctx.fillStyle = '#6f5f4f'; ctx.textAlign = 'center';
                    ctx.fillText(`${pi + 1} / ${total}`, PAPER_W / 2, H - 30);
                });
                return canvas;
            });
        }
    };
}

function buildTicketCanvases(opts, preparedData) {
    opts = opts || {};
    const data = preparedData || ticketData();
    const slim = !opts.noCard && whySetsOf(data).rooms.length > 0;      // 앞장 카드가 있으면 견적서는 품목당 한 줄
    // 1·2·3쪽의 머리글·글자 크기가 흔들리지 않도록 모든 쪽을 같은 배율(1 = 1080px)로 그림 (39번)
    const plan = planTicket(data, PAPER_K, slim);
    const { s, W, PAGE_H, BOTTOM, F, pages } = plan;
    const pr = opts.pixelRatio || 1;      // 화면에 띄울 때는 더 선명하게(저장·인쇄는 1 = 1080px)
    // 맨 앞에 "우리 집 색"(37번, 원단을 담은 공간이 2곳 이상일 때) → "원단을 고른 이유" 카드(손님이 답한 공간이 있을 때만). 쪽 표시는 전체로 셈
    const house = buildHouseCanvases(data, opts), hn = house.count;
    const whyPages = opts.noCard ? [] : buildWhyCanvases(data, opts, n => hn + n + pages.length, hn);
    const housePages = house.draw(opts, hn + whyPages.length + pages.length);
    const off = hn + whyPages.length;

    const ticketPages = pages.map((p, pi) => {
        const isLast = pi === pages.length - 1;
        const H = Math.ceil(p.y + (isLast ? F.h : BOTTOM));   // 아주 긴 방 하나일 때만 늘어남 (화면 좌표)
        const canvas = document.createElement('canvas');
        canvas.width = TICKET_W * pr; canvas.height = Math.round(H * s * pr);
        const ctx = canvas.getContext('2d');
        ctx.scale(s * pr, s * pr);                                                        // 이후는 모두 "늘리거나 줄이기 전" 좌표
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, H);                    // 종이 색 (고객 화면 바탕 #fbf9f5보다 조금 밝게 → 화면에서 종이 한 장으로 보임)
        ctx.textBaseline = 'alphabetic';
        const t = drawTicket(ctx, data, W, slim);
        t.hdr();
        p.items.forEach(it => t.drawRoom(it.L, it.y));
        if (isLast) t.drawFooter(F, Math.max(p.y, H - F.h));
        t.pageLabel(pi + off, pages.length + off, H);
        return canvas;
    });
    const all = housePages.concat(whyPages, ticketPages);
    all.cardCount = off;          // 견적서 앞 쪽 수 (우리 집 색 + 이유 카드)
    all.houseCount = hn;
    return all;
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
    if (opts.canvasOnly) return { canvases, blobs: [], type: null, cardCount: canvases.cardCount || 0, houseCount: canvases.houseCount || 0 };      // 화면에 띄우기만 할 때 (고객 화면 최종 제안)
    const type = opts.type || 'image/png';
    const blobs = await Promise.all(canvases.map(c => new Promise(res => c.toBlob(res, type, 0.95))));
    return { canvases, blobs, type, cardCount: canvases.cardCount || 0, houseCount: canvases.houseCount || 0 };
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

// 여러 쪽(우리 집 색 → 이유 카드 → 견적서)을 세로로 이어 붙여 긴 한 장으로 (68번)
//  탭 브라우저가 두 번째 내려받기부터 막아 첫 장만 저장되던 일을 막음. 장 사이는 앱 바탕색
//  탭 그림판 크기 한계(세로 약 16,000px · 넓이 약 1,600만 칸)를 넘으면 전체를 조금 줄여서 맞춤
const TICKET_JOIN_GAP = 24, TICKET_JOIN_MAX_H = 14800;
function joinTicketCanvases(canvases) {
    if (canvases.length === 1) return canvases[0];
    const W = Math.max(...canvases.map(c => c.width));
    const fullH = canvases.reduce((h, c) => h + c.height, 0) + TICKET_JOIN_GAP * (canvases.length - 1);
    const k = Math.min(1, TICKET_JOIN_MAX_H / fullH);
    const out = document.createElement('canvas');
    out.width = Math.round(W * k); out.height = Math.round(fullH * k);
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fbf9f5'; ctx.fillRect(0, 0, out.width, out.height);      // 고객 화면 바탕색 (종이 #fffdf9보다 조금 어두워 장이 나뉘어 보임)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    let y = 0;
    canvases.forEach(c => {
        ctx.drawImage(c, Math.round((W - c.width) / 2 * k), Math.round(y * k), Math.round(c.width * k), Math.round(c.height * k));
        y += c.height + TICKET_JOIN_GAP;
    });
    return out;
}

// 견적서 저장: 예전 "카톡용"과 "고화질" 저장을 하나로 합침.
// 선명한 JPG로 갤러리에 저장 → 카카오톡에서 사진으로 보내면 됨 (탭에서 공유 창이 끝없이 로딩돼 "공유" 대신 "저장")
let __saveBusy = false;
async function saveTicketImage() {
    if (__saveBusy) return;          // 연타해도 여러 번 저장되지 않게
    __saveBusy = true;
    showToast("견적서 만드는 중...", "info");
    try {
        const { canvases } = await makeTicketBlobs({ canvasOnly: true });
        const one = joinTicketCanvases(canvases);      // 여러 쪽도 긴 한 장으로 (68번)
        const blob = await new Promise(res => one.toBlob(res, 'image/jpeg', 0.95));
        if (!blob) throw new Error('견적서 그림을 만들지 못함');
        saveBlobAsFile(blob, ticketFileNames(1, 'jpg', false)[0]);
        showToast("한 장으로 저장했어요. 카카오톡 → 사진(갤러리)에서 골라 보내 주세요.", "success");
    } catch (err) {
        console.error(err);
        showToast("견적서 저장 중 오류가 발생했습니다.", "error");
    } finally {
        __saveBusy = false;
    }
}

// 카톡 글 복사 (62번): 이유 카드·견적서 내용을 그대로 글로 (새 문구 없이 이유 문장표 문장 그대로). 이유 쪽 원단은 61번처럼 "색 이름 · 재질", 견적서 쪽은 "블랑 1번" (75번)
//  잰 색 코드·책자(공급처) 이름은 넣지 않음(색 번호는 견적서 쪽에만). 이유 카드는 손님이 답한 공간이 있을 때만, 그때 견적서는 품목당 한 줄(추천 이유는 이유 쪽에)
function ticketKakaoText(data) {
    data = data || ticketData();
    const out = [], why = whySetsOf(data), won = n => `${Number(n || 0).toLocaleString()}원`;
    const custName = (document.getElementById('custName').value || '').trim();
    out.push(`[Re.dam] ${custName ? custName + ' 고객님 ' : ''}공간 제안 · ${data.date}`);
    const nameOf = it => (it.kind === '블라인드' && it.name.includes('블라인드')) ? it.name : `${it.kind} · ${it.name}`;
    if (why.rooms.length) {
        out.push('', '〈원단을 고른 이유〉');
        why.rooms.forEach(R => {
            out.push('', `■ ${R.name}`);
            const keys = [];
            R.sets.forEach(s => (s.it.kindKey === 'sheer' ? ['privacy', 'light'] : ['block', 'light']).forEach(k => { if (R.ans[k] && WHY_SAY[k][R.ans[k]] && !keys.includes(k)) keys.push(k); }));
            keys.sort((a, b) => ['light', 'privacy', 'block'].indexOf(a) - ['light', 'privacy', 'block'].indexOf(b));
            const quotes = keys.map(k => whyQuote(k, R.ans));
            if (R.dirText) quotes.push(`“${R.dirText}향이에요”`);
            if (quotes.length) out.push(`${quotes.join(' ')} 하셨어요.`);
            if (R.sameAs) out.push(`벽과 바닥은 ${R.sameAs}${whyJosa(R.sameAs)} 같아요.`);
            else if (R.colors && R.colors.length) out.push(R.colors.map(c => `${c.k} ${c.name}`.trim()).join(' · '));
            if (R.space.length) out.push(R.space.join(' '));
            R.sets.forEach(s => {
                out.push('', `· ${nameOf(s.it)}`);
                if (s.lines.length) out.push(s.lines.join(' '));
                if (s.note) out.push(`(${s.note})`);
            });
            if (R.night && typeof SHEER_NIGHT_NOTE === 'string') out.push('', `(${SHEER_NIGHT_NOTE})`);
        });
    }
    out.push('', '〈견적서〉');
    data.rooms.forEach(room => {
        if (!room.items.length) return;
        out.push('', `■ ${room.name}${room.sampleOnly ? '' : ' ' + won(room.total)}`);
        room.items.forEach(it => {
            out.push(`· ${it.kind} · ${it.bookName || it.name}`);      // 견적서는 책자 원단 이름 + 색 번호 (75번)
            const sub = [it.size, it.meta, it.sampleOnly ? '' : won(it.price)].filter(Boolean).join(' · ');
            if (sub) out.push(`  ${sub}`);
            if (!why.rooms.length && it.reason) out.push(`  ${it.reason}`);
        });
    });
    out.push('');
    if (data.install > 0) out.push(`시공 및 설치비 ${won(data.install)}`);
    out.push(`합계 금액 (시공비 포함) ${data.total}원`);
    [['안내', data.note], ['결제 조건', data.pay], ['맞춤 제작 안내', data.custom], ['공급자', data.supplier]].forEach(([k, v]) => {
        const t = String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        if (t.length) out.push('', `[${k}]`, ...t);
    });
    return out.join('\n');
}
async function copyTicketText() {
    let txt = '';
    try { txt = ticketKakaoText(); } catch (err) { console.error(err); showToast("글을 만들지 못했습니다.", "error"); return; }
    // 숨은 글상자로 먼저 복사 (누른 순간에 바로 해야 됨 — 기다린 뒤엔 막히는 창이 있음). 안 되면 클립보드로
    let ok = false;
    const ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed; left:-9999px; top:0;';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (!ok) { try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; } } catch (e) {} }
    showToast(ok ? "카톡 글을 복사했어요. 카카오톡 대화창에 붙여 넣어 주세요." : "복사하지 못했습니다.", ok ? "success" : "error");
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
// (10-15) 앱 화면을 숨겼다 되돌리는 방식은 탭에서 ← ⌂ 버튼이 비치고 전체가 반투명하게 나왔음
//  → 이제 견적서 이미지만 든 "빈 인쇄 전용 창(iframe)"을 만들어 그것만 인쇄함. 앱 화면은 건드리지 않아 섞일 수 없음.
//  (iframe이 안 되는 기기에서만 예전 방식으로 인쇄)
let __printFrame = null;
function removePrintFrame() {
    if (__printFrame) { try { __printFrame.remove(); } catch (e) {} __printFrame = null; }
}
async function printTicket() {
    let canvases;
    try { ({ canvases } = await makeTicketBlobs()); }
    catch (err) { console.error(err); showToast("견적서 인쇄 준비 중 오류가 발생했습니다.", "error"); return; }
    const prevTitle = document.title;
    const custName = (document.getElementById('custName').value || '').trim();
    const title = `${custName ? custName + '_' : ''}맞춤견적서`;      // PDF 기본 파일명
    let done = false;
    const finish = () => { if (done) return; done = true; document.title = prevTitle; };      // 인쇄 창이 아직 인쇄물을 만드는 중일 수 있어 창(iframe)은 바로 지우지 않음
    try {
        removePrintFrame();
        const fr = document.createElement('iframe');
        fr.setAttribute('aria-hidden', 'true');
        fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(fr);
        __printFrame = fr;
        const doc = fr.contentDocument;
        const pages = canvases.map(c => `<div class="pg"><img alt="견적서" src="${c.toDataURL('image/png')}"></div>`).join('');
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0; padding: 0; background: #ffffff; }
            .pg { text-align: center; break-after: page; page-break-after: always; }
            .pg:last-child { break-after: auto; page-break-after: auto; }
            .pg img { display: inline-block; max-width: 100%; max-height: 270mm; width: auto; height: auto; object-fit: contain; }
        </style></head><body>${pages}</body></html>`);
        doc.close();
        await Promise.all(Array.from(doc.images).map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
        document.title = title;
        fr.contentWindow.addEventListener('afterprint', finish, { once: true });
        window.addEventListener('afterprint', finish, { once: true });
        setTimeout(finish, 120000);      // 어떤 이유로 afterprint가 안 와도 2분 뒤 제목 되돌림
        setTimeout(removePrintFrame, 600000);      // 인쇄 전용 창은 10분 뒤(또는 다음 인쇄 때) 정리
        fr.contentWindow.focus();
        fr.contentWindow.print();
        return;
    } catch (err) {
        console.error('iframe 인쇄 실패, 예전 방식으로 인쇄합니다', err);
        removePrintFrame();
    }
    // 예전 방식 (비상용)
    await preparePrintSheet();
    document.title = title;
    window.addEventListener('afterprint', () => { document.title = prevTitle; }, { once: true });
    isolatePrintSheet();
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
                lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null,
                diagnosed: !!r.diagnosed,          // 고객 화면에서 바닥·벽·채광 진단을 거친 공간 (제안서에 진단 요약 표시)
                measuredColor: r.measuredColor || null,
                width: r.width || null, height: r.height || null, spaceWidth: Number(r.spaceWidth) || null, spaceHeight: Number(r.spaceHeight) || null, sizeMode: r.sizeMode || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),
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
                        pickDir: c.pickDir || null, toneStep: c.toneStep || 0,      // 원단을 고른 이유 카드 (28번)
                        baseFabricId: c.baseFabricId || null, baseColorName: c.baseColorName || null,      // 한 톤 3단계 사다리 기준점 (49번)
                        rates: c.rates ? JSON.parse(JSON.stringify(c.rates)) : undefined,      // 품목을 만들 때의 가공·부자재 단가 (29번, 빠지면 금액이 바뀜)
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

