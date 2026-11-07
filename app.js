(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['app.js']='20261238';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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
const REDAM_BUILD = '20261238';
function checkFileVersions() {
    const expected = ['logo.js', 'pricing.js', 'costing.js', 'data.js', 'calculator.js', 'concierge.js', 'intro.js', 'fabric-pick.js', 'space.js', 'final.js', 'app.js', 'more.js', 'survey.js', 'ticket.js', 'color-dict.js', 'fabrics.js', 'finder.js', 'settings.js', 'room-color.js'];
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
const BACK_GUARDS = 10;         // 한 번 누른 뒤 화면을 다시 안 눌러도 앱 안에서 처리되는 뒤로 횟수 (164번: 3이면 연달아 3번에 앱이 닫혀 10으로)
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
    if (view && view !== 'view-survey' && view !== 'view-consult') { showStaffView('survey'); return false; }
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
        renderSurvey();
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
    showStaffView('survey');
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
    if (typeof confirmQuoteGaps === 'function' && !confirmQuoteGaps('그대로 고객에게 보여 줄까요?')) return;      // 163번: 손님에게 건네기 전, 직원 화면에서
    exitStaffMode(null, true);
}

// 직원 화면 메뉴(왼쪽 사이드바 · 좁은 화면은 아래 탭바): 상담 / 서류 / 상담 기록 / 원단 / 설정. 내용은 모두 그려 두고 보이는 묶음만 바꿈
function showStaffView(view) {
    if (view !== 'fabric' && finderGate(() => showStaffView(view))) return;
    toggleMarginSection(false);      // 163번: 메뉴를 옮기면 원가·순이익은 다시 가림
    document.querySelectorAll('.staff-nav button').forEach(b => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelectorAll('.staff-view').forEach(s => s.classList.toggle('on', s.id === 'view-' + view));
    if (view !== 'fabric') hideDbPrices();
    if (view === 'survey') renderSurvey();      // 상담란 (설문) 렌더링 (115번)
    if (view === 'fabric') renderFinder();      // 분류·색상을 고친 뒤 돌아와도 새 값으로 보이게, 열 때마다 다시 그림
    if (view === 'test') openFakeGuest();
    if (view === 'colorguide') openColorGuide();
    window.scrollTo(0, 0);
}
// 시험 칸 (89번): 처음 열 때만 fake-guest.js를 불러옴. 열 때마다 새 원단·색 값으로 다시 돌림
function openFakeGuest() {
    if (window.FakeGuest) { window.FakeGuest.open(); return; }
    const s = document.createElement('script');
    s.src = 'fake-guest.js?v=' + REDAM_BUILD;
    s.onload = () => window.FakeGuest && window.FakeGuest.open();
    s.onerror = () => { const o = document.getElementById('fakeGuestOut'); if (o) o.textContent = '시험 파일을 불러오지 못했습니다. 인터넷을 확인하고 다시 열어 주세요.'; };
    document.head.appendChild(s);
}
// 색 기법 칸 (95번): 처음 열 때만 color-guide.js를 불러옴
function openColorGuide() {
    if (window.ColorGuide) { window.ColorGuide.open(); return; }
    const s = document.createElement('script');
    s.src = 'color-guide.js?v=' + REDAM_BUILD;
    s.onload = () => window.ColorGuide && window.ColorGuide.open();
    s.onerror = () => { const o = document.getElementById('cgGrid'); if (o) o.textContent = '색 기법 파일을 불러오지 못했습니다. 인터넷을 확인하고 다시 열어 주세요.'; };
    document.head.appendChild(s);
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

// 상담 결과 (84번): 계약 / 보류 / 안 됨(+이유). 상담 기록과 같이 저장되고 고객 화면·견적서에는 나오지 않음
let quoteValidOverride = null;      // 이 상담만의 유효기간(일). null이면 설정 값 (85번)
let quoteDate = null;      // 견적을 처음 만든 날 'YYYY-MM-DD' — 상담에 저장, 불러와도 안 바뀜 (85번)
let consultOutcome = null;      // { result: 'won'|'hold'|'lost', reasons: [], note: '', at: 시각 }
const OUTCOME_LABEL = { won: '계약', hold: '생각해 보신다', lost: '안 됨' };
const OUTCOME_REASONS = ['가격', '다른 업체', '시기 미룸', '색·디자인', '연락 끊김', '기타'];
function outcomeText(o) {
    if (!o || !OUTCOME_LABEL[o.result]) return '';
    const why = o.result === 'lost' ? [].concat(o.reasons || [], o.note ? ['"' + o.note + '"'] : []).join(' · ') : '';
    return OUTCOME_LABEL[o.result] + (why ? ' — ' + why : '');
}
// 결과 고르기 창. opts: { initial, skipLabel, onSave(outcome), onSkip() }
function openOutcomeDialog(opts) {
    const old = document.getElementById('outcomeDialog'); if (old) old.remove();
    const cur = opts.initial || {};
    let result = OUTCOME_LABEL[cur.result] ? cur.result : null;
    const reasons = new Set(cur.reasons || []);
    const wrap = document.createElement('div');
    wrap.id = 'outcomeDialog'; wrap.className = 'outcome-dialog';
    wrap.innerHTML = `<div class="outcome-card" role="dialog" aria-label="상담 결과">
        <h3>상담 결과</h3>
        <p class="outcome-sub">이 기록은 직원 화면에만 남고, 손님 화면·견적서에는 나오지 않습니다.</p>
        <div class="outcome-row" data-grp="result">${Object.keys(OUTCOME_LABEL).map(k => `<button type="button" data-v="${k}">${OUTCOME_LABEL[k]}</button>`).join('')}</div>
        <div class="outcome-why" hidden>
            <p class="outcome-sub">안 된 이유 (여러 개 고를 수 있어요)</p>
            <div class="outcome-row" data-grp="reason">${OUTCOME_REASONS.map(r => `<button type="button" data-v="${r}">${r}</button>`).join('')}</div>
            <input type="text" class="outcome-note" maxlength="60" placeholder="기타 — 한 줄로 적기" autocomplete="off">
        </div>
        <div class="outcome-acts">
            ${opts.skipLabel ? `<button type="button" data-act="skip">${opts.skipLabel}</button>` : ''}
            <button type="button" data-act="cancel">닫기</button>
            <button type="button" data-act="save" class="primary">저장</button>
        </div></div>`;
    document.body.appendChild(wrap);
    const note = wrap.querySelector('.outcome-note'); note.value = cur.note || '';
    const paint = () => {
        wrap.querySelectorAll('[data-grp="result"] button').forEach(b => b.classList.toggle('on', b.dataset.v === result));
        wrap.querySelectorAll('[data-grp="reason"] button').forEach(b => b.classList.toggle('on', reasons.has(b.dataset.v)));
        wrap.querySelector('.outcome-why').hidden = result !== 'lost';
    };
    const close = () => wrap.remove();
    wrap.addEventListener('click', e => {
        if (e.target === wrap) return close();
        const b = e.target.closest('button'); if (!b) return;
        const grp = b.parentElement && b.parentElement.dataset.grp;
        if (grp === 'result') { result = b.dataset.v; paint(); }
        else if (grp === 'reason') { reasons.has(b.dataset.v) ? reasons.delete(b.dataset.v) : reasons.add(b.dataset.v); paint(); }
        else if (b.dataset.act === 'cancel') close();
        else if (b.dataset.act === 'skip') { close(); opts.onSkip && opts.onSkip(); }
        else if (b.dataset.act === 'save') {
            if (!result) { showToast('결과를 하나 골라 주세요.', 'error'); return; }
            const out = { result, reasons: result === 'lost' ? OUTCOME_REASONS.filter(r => reasons.has(r)) : [], note: result === 'lost' ? note.value.trim() : '', at: Date.now() };
            close(); opts.onSave && opts.onSave(out);
        }
    });
    paint();
}
// [상담 끝내기]: 지금 상담의 결과를 남김 (새 상담을 누를 때 다시 묻지 않음)
function endConsultation() {
    if (collectConsultation().rooms.length === 0) { showToast('남길 상담이 없습니다.', 'info'); return; }
    openOutcomeDialog({ initial: consultOutcome, onSave: out => {
        consultOutcome = out; saveDraftTick();
        showToast('상담 결과를 남겼습니다: ' + outcomeText(out), 'info');
    } });
}

// 새 상담 시작: 이전 고객의 입력을 전부 비움
function startNewConsultation() {
    if (finderGate(startNewConsultation)) return;
    if (!consultOutcome && collectConsultation().rooms.length > 0) {      // 결과를 안 남긴 상담이면 먼저 물음 (건너뛰기 가능)
        openOutcomeDialog({ skipLabel: '건너뛰고 새 상담', onSave: out => { consultOutcome = out; saveDraftTick(); startNewConsultationConfirmed(); }, onSkip: startNewConsultationConfirmed });
        return;
    }
    startNewConsultationConfirmed();
}
function startNewConsultationConfirmed() {
    if (!confirm('현재 견적과 고객 입력을 모두 지우고 새 상담을 시작할까요?\n(지금 상담은 "상담 이력"에 보관됩니다)')) return;
    archiveConsultation(collectConsultation(), Date.now());
    clearDraft();
    consultOutcome = null; quoteDate = null; quoteValidOverride = null;
    const qv0 = document.getElementById('quoteValidOverrideInput'); if (qv0) qv0.value = '';
    initDefaultRooms();
    collapsedRooms.clear(); openCurtainDetails.clear();
    finderTarget = null; finderView = 'grid'; finderPicks = []; resetFinderFilters(true);
    jogakboSeed = newJogakboSeed();      // 새 상담은 새 조각보 (79번)
    globalInstallFee = loadDefaultInstallFee();
    globalVatOption = 'consumer';
    globalLightStand = false;      // 131번
    globalLineLight = { price: 0, fee: 0 }; lineLightInputsSync();      // 146번
    const lt0 = document.getElementById('expressLightStand'); if (lt0) lt0.value = '';
    const fee = document.getElementById('expressInstallFee'); if (fee) fee.value = globalInstallFee;
    const vat = document.getElementById('expressVatOption'); if (vat) vat.value = globalVatOption;
    if (window.concierge) window.concierge.resetAll();
    houseTaste = emptyHouseTaste();
    const expressCust = document.getElementById('expressCustName'); if (expressCust) expressCust.value = '';
    const expressPhone = document.getElementById('expressCustPhone'); if (expressPhone) expressPhone.value = '';
    const surveyCust = document.getElementById('surveyCustName'); if (surveyCust) surveyCust.value = '';
    const surveyPhone = document.getElementById('surveyCustPhone'); if (surveyPhone) surveyPhone.value = '';
    renderSideCust();
    renderRooms();
    renderSurvey();
    calculateAll();
    renderHistory();
    showToast('새 상담을 시작합니다.');
}

// ==============================================================
// 2. 직원 PIN (153번: 두 손가락 1초 · S펜으로 로고 톡 · PC는 마우스로 로고 1초 → PIN 입력)
// ==============================================================
const STAFF_HOLD_MS = 1000;          // PC 마우스로 로고를 누르고 있는 시간 (153번: 2초 → 1초)
const STAFF_TWO_FINGER_MS = 1000;    // 두 손가락을 대고 가만히 있는 시간 (153번)
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
        // 153번: 로고(data-staff-hold) 문 — S펜은 톡(눌렀다 떼면 바로), 마우스는 1초 누르고 있기. 손가락은 여기서 안 받음(아래 두 손가락 1초)
        //  처음 누른 펜·마우스(pointerId)만 보고, 그것이 12px 넘게 움직이면 취소 (펜 옆 손바닥이 닿아도 끊기지 않게)
        holdStart: function(ev) {
            if (appMode === 'staff' || (ev.button !== undefined && ev.button > 0)) return;
            if (ev.pointerType === 'touch') return;
            const pen = (ev.pointerType === 'pen');
            const id = ev.pointerId, x0 = ev.clientX, y0 = ev.clientY, self = this;
            clearTimeout(tapTimer);
            const stop = () => { clearTimeout(tapTimer); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', cancel, true); document.removeEventListener('pointermove', move, true); };
            const up = e => { if (e.pointerId !== id) return; stop(); if (pen) self.openFromHold(); };
            const cancel = e => { if (e.pointerId === id) stop(); };
            const move = e => { if (e.pointerId === id && Math.hypot(e.clientX - x0, e.clientY - y0) > 12) stop(); };
            document.addEventListener('pointerup', up, true);
            document.addEventListener('pointercancel', cancel, true);
            document.addEventListener('pointermove', move, true);
            if (!pen) tapTimer = setTimeout(() => { stop(); self.openFromHold(); }, STAFF_HOLD_MS);
        },
        // 누르기·두 손가락으로 PIN 창을 열 때: 창이 열린 뒤 손·펜을 떼도 그 아래 카드가 눌리지 않게 바로 다음 click 한 번은 막음
        openFromHold: function() { taps = Date.now(); this.requestStaff(); },
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
// 고객 화면 로고(data-staff-hold)를 펜·마우스로 누르기 시작하면 재기(153번). 길게 눌러도 탭의 글자 고르기·메뉴가 뜨지 않게 (style.css [data-staff-hold])
document.addEventListener('pointerdown', ev => { if (ev.target.closest && ev.target.closest('[data-staff-hold]')) RedamAuth.holdStart(ev); }, true);
document.addEventListener('click', ev => RedamAuth.swallowClick(ev), true);
document.addEventListener('contextmenu', ev => { if (ev.target.closest && ev.target.closest('[data-staff-hold]')) ev.preventDefault(); });

// 153번: 고객 화면 어디서나 두 손가락을 대고 1초 가만히 있으면 PIN 창 (PIN 창이 닫혀 있을 때만)
//  pointer 이벤트는 브라우저가 화면 끌기·확대를 가져가는 순간 끊기므로 touch 이벤트로 잼. passive라 화면 움직임은 막지 않음
//  손가락 정확히 2개(같이 닿거나 두 번째가 0.3초 안), 각자 처음 자리에서 20px 안. 움직이거나, 3개째가 닿거나, 하나라도 떼면 취소
(function() {
    let firstAt = 0, timer = null, starts = null;
    const opt = { passive: true, capture: true };
    const pinOpen = () => { const m = document.getElementById('pinModal'); return !!(m && !m.classList.contains('hidden')); };
    const cancel = () => { clearTimeout(timer); timer = null; starts = null; };
    document.addEventListener('touchstart', e => {
        const n = e.touches.length;
        if (n === 1) { cancel(); firstAt = Date.now(); return; }
        const together = (e.changedTouches.length === 2) || (Date.now() - firstAt <= 300);
        if (n !== 2 || timer || !together || appMode === 'staff' || pinOpen()) { cancel(); return; }
        starts = {};
        for (const t of e.touches) starts[t.identifier] = { x: t.clientX, y: t.clientY };
        timer = setTimeout(() => {
            timer = null; starts = null;
            if (appMode !== 'staff' && !pinOpen()) RedamAuth.openFromHold();
        }, STAFF_TWO_FINGER_MS);
    }, opt);
    document.addEventListener('touchmove', e => {
        if (!starts) return;
        for (const t of e.touches) {
            const s = starts[t.identifier];
            if (!s || Math.hypot(t.clientX - s.x, t.clientY - s.y) > 20) { cancel(); return; }
        }
    }, opt);
    document.addEventListener('touchend', cancel, opt);
    document.addEventListener('touchcancel', cancel, opt);
})();

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
    // 163번: 원가·순이익을 연 채 1분 동안 손대지 않으면 가림(손님에게 화면을 돌려 보여 줄 때). 자동 잠금을 꺼 둔 기기에서도
    const marginBox = document.getElementById('marginCollapsibleContent');
    if (marginBox && !marginBox.classList.contains('hidden') && Date.now() - lastActivity > 60000) toggleMarginSection(false);
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
        houseTaste: Object.assign({}, houseTaste),      // 우리 집 취향 (115번)
        rooms: src.map(r => ({
            name: r.name, sunlight: r.sunlight, lightLevel: r.lightLevel, floorTone: r.floorTone, wallTone: r.wallTone, mood: r.mood, wantMood: r.wantMood || null, colorStrength: r.colorStrength || null, colorAccent: r.colorAccent || null,
            roomType: r.roomType || null, lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, diagnosed: !!r.diagnosed,
            curtainConfig: roomCurtainConfig(r), ownTaste: !!r.ownTaste, ownPres: r.ownPres || null, ownTex: r.ownTex || null, pointTech: r.pointTech || null,      // 구성(커튼 줄에서 읽음)·이 공간만 다르게 (115번)
            measuredColor: r.measuredColor || null,          // 방 색 재기로 잰 벽·바닥 색 (사진은 저장 안 함)
            altLine: r.altLine ? Object.assign({}, r.altLine, { curtains: (r.altLine.curtains || []).map(c => { const x = Object.assign({}, c); delete x.calc; return x; }) }) : null, lineNo: r.lineNo || 1, pickPending: !!r.pickPending, altBuilding: !!r.altBuilding,      // 167번: 둘째 줄 후보 (안 고른 줄도 기록에)
            techGaps: (typeof colorTechGaps === 'function' && r.measuredColor) ? colorTechGaps(r.measuredColor) : null,      // 후보 0인 색 기법 (96번, 원단 들일 근거 · 화면엔 안 씀)
            width: r.width || null, height: r.height || null, spaceWidth: r.spaceWidth || null, spaceHeight: r.spaceHeight || null, sizeMode: r.sizeMode || null, colorSrc: r.colorSrc || null, cardParts: r.cardParts || null, linkDir: r.linkDir || null, windowDir: windowDirOf(r.windowDir),      // 중심 화면: 공간 추가 때 정한 크기·색 출처
            curtains: r.curtains.map(c => { const copy = Object.assign({}, c); delete copy.calc; return copy; })
        })),
        installFee: globalInstallFee,
        vat: globalVatOption,
        lightStand: !!globalLightStand,      // 견적서 빛 줄 (131번)
        lineLight: (globalLineLight.price || globalLineLight.fee) ? { price: globalLineLight.price, fee: globalLineLight.fee } : undefined,      // 146번
        jogakboSeed: window.getJogakboSeed(),      // 조각보 모양 고정 (79번)
        picks: finderPicks.slice(),         // 원단 찾기에서 별표한 후보 색 (상담 기록에서 다시 열면 그대로)
        quoteDate: quoteDate || null, quoteValid: quoteValidOverride,      // 견적 날짜 (85번)
        outcome: consultOutcome || null     // 상담 결과 (84번)
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
    houseTaste = Object.assign(emptyHouseTaste(), snap.houseTaste || {});      // 우리 집 취향 (115번)
    rooms.forEach(migrateSurveyRoom);
    globalInstallFee = snap.installFee;
    globalVatOption = snap.vat || 'consumer';
    globalLightStand = !!snap.lightStand;      // 131번 (옛 상담은 넣지 않음)
    globalLineLight = { price: Number(snap.lineLight && snap.lineLight.price) || 0, fee: Number(snap.lineLight && snap.lineLight.fee) || 0 };      // 146번
    lineLightInputsSync();
    jogakboSeed = (Number.isInteger(snap.jogakboSeed) && snap.jogakboSeed > 0) ? snap.jogakboSeed : newJogakboSeed();      // 옛 상담은 새 번호 (79번)
    quoteDate = /^\d{4}-\d{2}-\d{2}$/.test(snap.quoteDate || '') ? snap.quoteDate : null;      // 옛 상담은 처음 견적을 만들 때 정함 (85번)
    quoteValidOverride = (Number.isFinite(snap.quoteValid) && snap.quoteValid >= 0) ? Math.min(365, Math.round(snap.quoteValid)) : null;
    const qv1 = document.getElementById('quoteValidOverrideInput'); if (qv1) qv1.value = quoteValidOverride === null ? '' : quoteValidOverride;
    consultOutcome = (snap.outcome && OUTCOME_LABEL[snap.outcome.result]) ? snap.outcome : null;      // 84번
    finderPicks = Array.isArray(snap.picks) ? snap.picks.filter(k => typeof k === 'string').slice(0, FINDER_PICK_MAX) : [];
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('custName', snap.name || ''); set('expressCustName', snap.name || ''); set('surveyCustName', snap.name || '');
    set('custPhone', snap.phone || ''); set('expressCustPhone', snap.phone || ''); set('surveyCustPhone', snap.phone || '');
    set('expressInstallFee', globalInstallFee); set('expressVatOption', globalVatOption); set('expressLightStand', globalLightStand ? '1' : '');
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
        const oc = outcomeText(h.snapshot.outcome).replace(/</g, '&lt;');
        const ocTone = h.snapshot.outcome ? ({ won: 'text-emerald-700', hold: 'text-amber-700', lost: 'text-rose-600' }[h.snapshot.outcome.result] || '') : '';
        return `<div class="flex items-center justify-between gap-2 py-2 border-b border-slate-100 text-xs">
            <div class="min-w-0">
                <div class="font-bold text-slate-800 truncate">${nm}</div>
                <div class="text-[11px] text-slate-400">${when} · 공간 ${nRooms}개 · ${(h.total || 0).toLocaleString()}원</div>
                <div class="text-[11px] font-bold ${ocTone}">${oc || '<span class="text-slate-300">결과 없음</span>'}</div>
            </div>
            <div class="flex gap-1.5 flex-shrink-0">
                <button onclick="editHistoryOutcome('${h.id}')" class="bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 font-bold px-2.5 py-1.5 rounded-lg whitespace-nowrap">결과</button>
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

// 상담 기록의 결과 고치기 (보류 → 계약/안 됨 등, 84번)
function editHistoryOutcome(id) {
    const item = loadHistory().find(h => h.id === id);
    if (!item) return;
    openOutcomeDialog({ initial: item.snapshot.outcome, onSave: out => {
        const list = loadHistory(), t = list.find(h => h.id === id);
        if (!t) return;
        t.snapshot.outcome = out; t.updatedAt = Date.now();
        saveHistory(list); renderHistory();
    } });
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

// 원단 분류 편집·색상 관리·원단 사진은 fabrics.js로 옮김 (130-2)
// 원단 찾기(원단 › 찾기 탭, 후보·고객에게 보여주기·색 지도)는 finder.js로 옮김 (130-2)

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

// 라인조명(COB) 설치 포함 금액 (146번): 이 상담만. 비우면 견적서에 나오지 않음
function updateGlobalLineLight(k, v) {
    const n = Math.round(Number(v));
    globalLineLight[k] = (Number.isFinite(n) && n > 0) ? n : 0;
    calculateAll();
    if (typeof saveDraftTick === 'function') saveDraftTick();
}
function lineLightInputsSync() {
    const el = document.getElementById('expressLinePrice'); if (el) el.value = globalLineLight.price || '';      // 설치 포함 한 칸
}
// 견적서 빛 줄 켜고 끄기 (131번): 금액은 설정 › 견적서 고정 문구
function updateGlobalLightStand(val) {
    globalLightStand = !!val;
    const el = document.getElementById('expressLightStand');
    if (el && el.value !== (globalLightStand ? '1' : '')) el.value = globalLightStand ? '1' : '';
    calculateAll();
    if (typeof saveDraftTick === 'function') saveDraftTick();
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
    // 번호는 항상 "가장 큰 번호 + 1" (지운 번호를 다시 쓰지 않아 목록 순서가 뒤섞이지 않음, '방 1, 2, 3')
    let max = 0;
    rooms.forEach(r => {
        const m = /^(?:방|작은방)\s*(\d+)$/.exec(r.name);
        if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `방 ${max + 1}`;
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
            { id: curtainIdCounter++, label: "속지", presetType: "sheer", width: 200, height: 200, sizeUnset: true, pleat: "2.0", pleatType: "나비주름", bookFilter: "ALL", fabricId: defFab, installType: "rail", floorGap: 0, hwName: "기본 레일", hwPrice: hwPriceOf('rail'), shapeFee: 0, leadBand: false, hotelFit: false, rates: optionRatesNow('rail') }      // 175번: 밑단 기본은 시접 (139번, 손님 화면과 같게)
        ]
    };
    rooms.push(newRoom);
    autoFillSurveyPicks(newRoom.id);
    renderRooms();
    renderSurvey();
    calculateAll();
    showToast(`[${newRoom.name}] 공간이 추가되었습니다.`);
}

function removeRoom(roomId) {
    const room = rooms.find(r => r.id === roomId);
    if (!room || !confirm(`'${room.name}' 공간을 삭제할까요?`)) return;
    rooms = rooms.filter(r => r.id !== roomId);
    collapsedRooms.delete(roomId);
    renderRooms();
    renderSurvey();
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
    let hotelFit = false;      // 175번: 겉지 줄은 호텔핏 켬으로 시작 (손님 화면과 같게)
    let pleat = "2.0";
    let pleatType = "나비주름";
    let installType = "rail";
    let hwName = "기본 레일";
    let hwPrice = hwPriceOf('rail');
    let appliedPreset = presetType;
    let newLabel = getNextCurtainLabel(room, presetType);

    if (presetType === "sheer") {
        const sheerFab = FABRIC_DB.find(f => f.categoryType === "속지");
        if (sheerFab) targetFabId = sheerFab.id;      // 139번: 밑단 기본은 시접 (리드밴드는 고를 때만)
    } else if (presetType === "drape") {
        const drapeFab = FABRIC_DB.find(f => f.categoryType === "겉지");
        if (drapeFab) targetFabId = drapeFab.id;
        shapeFee = 1;      // 켜짐 표시 (금액은 rates의 설정 단가)
        hotelFit = true;      // 175번
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
        sizeUnset: room.curtains[0] ? !!room.curtains[0].sizeUnset : true,      // 163번: 첫 줄이 안 잰 값이면 이 줄도
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
        hotelFit: hotelFit,
        rates: optionRatesNow(installType)      // 지금 설정의 가공·부자재 단가 (29번, 나중에 단가를 바꿔도 이 품목 금액은 그대로)
    });

    autoFillSurveyPicks(room.id);
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
        renderSurvey();
        renderSideCust();
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

    if ((key === 'fabricId' || key === 'colorName' || key === 'bookFilter') && !c.aiPick) {
        const def = bestForCurtain(room, c);
        if (def) c.aiPick = { fabricId: def.fabricId, colorName: def.colorName || '', dir: def.dir };
    }

    const prevFabricId = c.fabricId;
    const prevVal = c[key];      // 163번
    c[key] = val;
    if (key === 'width' || key === 'height') {
        delete c.sizeUnset;      // 163번: 손으로 넣은 크기 = 잰 값
        // 163번: 공간 크기를 따라가던 줄(고치기 전 가로·세로가 공간 크기와 같던 줄)을 고치면 공간 크기도 같이 — 견적서·공간 머리에 옛 크기가 남지 않게. 크기가 다른 줄은 그대로(115번)
        const other = key === 'width' ? 'height' : 'width';
        if (room[key] != null && room[key] !== '' && Number(prevVal) === Number(room[key]) && Number(c[other]) === Number(room[other])) room[key] = val;
        // 164번: 견적란 공간 머리 "○ × ○ cm"를 다시 그리지 않아도 바로 맞춤 (머리를 그릴 때와 같은 셈)
        const sizeLbl = document.getElementById('roomSizeLbl-' + room.id);
        if (sizeLbl) sizeLbl.textContent = `${room.width || (room.curtains[0] && room.curtains[0].width) || 340} × ${room.height || (room.curtains[0] && room.curtains[0].height) || 235}`;
    }

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
    } else if (key === 'installType') {
        // 기구를 고르면 설정의 자당 단가가 들어감 (29번). rates가 있는 품목은 그 기구의 원가도 같이 바꿔 적음
        const t = HW_TYPES.includes(val) ? val : 'rail';
        c.hwName = HW_NAMES[t];
        c.hwPrice = hwPriceOf(t);
        if (c.rates && c.rates.cost) c.rates.cost.hw = optionCosts().rail[t];
        renderRooms();
    }
    if (c.fabricId !== prevFabricId) {
        const selFab = FABRIC_DB.find(f => f.id === c.fabricId);
        const ranked = (selFab && typeof rankColorsFor === 'function') ? rankColorsFor(selFab, roomWithSurveyTaste(room), curtainCategoryOf(c)) : [];
        c.colorName = (ranked[0] && ranked[0].name) || '';
    }
    if (c.fabricId !== prevFabricId || key === 'colorName') {
        delete c.toneStep; delete c.pickDir; delete c.baseFabricId; delete c.baseColorName;      // 직원 화면에서 원단·색을 바꾸면 한 톤·잇는 방향·사다리 기준은 지움 (28·49번)
        c.custPicked = false;      // 직원이 바꾸면 손님 표시는 내림 (116번)
        if (c.aiPick && c.fabricId === c.aiPick.fabricId && (c.colorName || '') === (c.aiPick.colorName || '')) {
            c.staffPicked = false; c.staffPick = null; c.changeReason = null;
        } else {
            c.staffPicked = true; c.staffPick = { fabricId: c.fabricId, colorName: c.colorName || '' };
        }
        renderRooms();
    } else if (key === 'bookFilter') {
        renderRooms();
    }
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
        const fab = Pricing.pickFabric(FABRIC_DB, input.dataset.fabricId);
        input.value = fabricSearchLabel(fab);
    }, 200);
}
const INSTALL_TYPE_LABELS = { rail: '기본 레일', rail_2line: '패널 레일 (2줄)', rail_3line: '패널 레일 (3줄)', rod35: '35파이 봉', rod25: '25파이 봉' };
function curtainOptionSummary(c) {
    return '· ' + [INSTALL_TYPE_LABELS[c.installType] || c.hwName || '', c.shapeFee > 0 ? '형상기억' : '', c.leadBand ? '리드밴드' : '', c.hotelFit ? '호텔핏' : ''].filter(Boolean).join(', ');
}


// 직원 화면 상담란(설문)은 survey.js로 옮김 (130-2)

function renderRooms() {
    const container = document.getElementById('roomsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (rooms.length === 0) {
        container.innerHTML = `<div class="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center text-sm text-slate-500">
            등록된 공간이 없습니다. <button type="button" onclick="showStaffView('survey')" class="text-amber-800 font-bold underline underline-offset-4">상담란</button>에서 공간을 추가해 시작하세요.
        </div>`;
        if (typeof renderSurvey === 'function') renderSurvey();
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
            let curFab = Pricing.pickFabric(FABRIC_DB, c.fabricId);      // 못 찾으면 첫 원단으로 바꾸지 않고 "원단 없음" (126번)
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
                            <input type="number" value="${c.width}" oninput="updateCurtainData(${room.id}, ${c.id}, 'width', parseFloat(this.value)||0); sizeInputMark(this)" onchange="sizeWarnToast(this.value, '가로')" class="w-full h-8 px-2 py-1 border rounded-lg text-xs font-bold text-indigo-950 bg-white outline-none focus:ring-1 focus:ring-amber-500 min-w-0 box-border${sizeClass(c, 'width')}">
                        </div>
                        <div class="min-w-0 flex flex-col justify-end">
                            <div class="flex justify-between items-center mb-1 gap-0.5">
                                <label class="block text-[10px] font-bold text-slate-500 truncate">세로(cm)</label>
                                ${!isBlind ? `<span class="staff-chip">제작:${actualCurtainHeight}</span>` : ''}
                            </div>
                            <input type="number" value="${c.height}" oninput="updateCurtainData(${room.id}, ${c.id}, 'height', parseFloat(this.value)||0); sizeInputMark(this)" onchange="sizeWarnToast(this.value, '세로')" class="w-full h-8 px-2 py-1 border rounded-lg text-xs font-bold text-indigo-950 bg-white outline-none focus:ring-1 focus:ring-amber-500 min-w-0 box-border${sizeClass(c, 'height')}">
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

                    ${curtainPickBarHtml(room, c, curFab)}

                    <div class="min-w-0">
                        <div class="flex justify-between items-center mb-0.5">
                            <label class="block text-[10px] font-bold text-slate-500">원단 직접 바꾸기 (책자·이름 검색)</label>
                            <span class="staff-chip">
                                ${curFab ? (isBlind ? "블라인드" : (curFab.calcType === "width" ? `폭당 ${curFab.specCm}cm` : `Y당 ${curFab.specCm}cm`)) : '<span class="no-fabric">원단 없음 — 다시 골라 주세요</span>'}
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

        const rW = room.width || (room.curtains[0] && room.curtains[0].width) || 340;
        const rH = room.height || (room.curtains[0] && room.curtains[0].height) || 235;
        const cfgSummary = room.curtains.map(c => c.label).join(' + ');

        roomCard.innerHTML = `
            <div class="staff-room-head">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                    <input type="text" value="${room.name}" onchange="updateRoomName(${room.id}, this.value)" class="staff-room-name font-serif-kr outline-none border rounded px-1.5 py-0.5 min-w-0">
                    <span class="text-xs text-stone-500 whitespace-nowrap hidden sm:inline"><span id="roomSizeLbl-${room.id}">${rW} × ${rH}</span> cm${cfgSummary ? ' · ' + escText(cfgSummary) : ''}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                    <button onclick="addCurtainToRoom(${room.id})" class="staff-btn whitespace-nowrap flex items-center gap-1">
                        + 커튼 줄 추가
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
    if (typeof renderSurvey === 'function') renderSurvey();
}

// 원단 목록 표·견적서 창·설정 칸(안내 문구·유효 기간·배수·판매가 곡선·가공 단가)은 settings.js로 옮김 (130-2)

// 견적서 이미지 그리기·이유 카드·우리 집 색·저장 이미지·인쇄는 ticket.js로 옮김 (130-2)

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
                wantMood: r.wantMood || null, colorStrength: r.colorStrength || null, colorAccent: r.colorAccent || null,      // 강도·갈래 (98번)
                roomType: r.roomType || null,
                lightBlock: r.lightBlock || null, privacy: r.privacy || null, sheerFeel: r.sheerFeel || null, blindWant: r.blindWant || null, ownTaste: !!r.ownTaste, ownPres: r.ownPres || null, ownTex: r.ownTex || null, pointTech: r.pointTech || null,      // 이 공간만 다르게 (115번, 고객 화면을 다녀와도 남게)
                diagnosed: !!r.diagnosed,          // 고객 화면에서 바닥·벽·채광 진단을 거친 공간 (제안서에 진단 요약 표시)
                measuredColor: r.measuredColor || null,
                altLine: r.altLine ? JSON.parse(JSON.stringify(r.altLine)) : null, lineNo: r.lineNo || 1, pickPending: !!r.pickPending, altBuilding: !!r.altBuilding,      // 둘째 줄 후보 (169번: 직원 화면을 다녀와도 남게)
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
                        aiPick: c.aiPick || null, staffPick: c.staffPick || null, staffPicked: !!c.staffPicked, changeReason: c.changeReason || null, custPicked: !!c.custPicked,      // 세 픽·바꾼 이유·손님이 고른 원단 (116번)
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


// 색 안 잰 원단 목록 (92번): 손님에게 보이는 원단 중 잰 색값(밝기·붉은기·노란기)이 있는 색이 하나도 없는 것 → 손님 추천에서 빠짐
function renderNoLabList() {
    const box = document.getElementById('noLabList');
    if (!box || typeof fabricHasLabColor !== 'function') return;
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const list = (typeof FABRIC_DB !== 'undefined' ? FABRIC_DB : []).filter(f => !(typeof isCustomerHidden === 'function' && isCustomerHidden(f)) && !fabricHasLabColor(f));
    if (!list.length) { box.textContent = '모든 원단에 잰 색값이 있습니다.'; return; }
    const groups = {};
    list.forEach(f => { const k = f.categoryType || '기타'; (groups[k] = groups[k] || []).push(f); });
    box.innerHTML = `<p class="mb-1">${list.length}개 · 색상 입력표에 밝기·붉은기·노란기를 넣으면 추천에 들어갑니다.</p>`
        + Object.keys(groups).map(k => `<p><b>${esc(k)} ${groups[k].length}</b> — ${groups[k].map(f => esc((f.book ? f.book + ' ' : '') + f.name)).join(', ')}</p>`).join('');
}
