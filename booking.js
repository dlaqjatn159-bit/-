(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['booking.js']='20261271';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// 시공 날짜 잡기 (작업목록 202번)
//  - 견적서 다음 단계에서 고객이 편한 날짜와 도착 시간을 선택
//  - 사장님이 확정(길게 누르기)하면 노션 손님 장부의 '시공일'에 등록
//  - 중계를 통해 구글 기본 캘린더와 장부의 일정을 피해 빈 시간을 계산
// ==============================================================
(function () {
    const STORE_KEY = 'redam_booking_v1';
    const DEFAULT_SETTINGS = {
        lead: 5,
        leadMin: 2,
        start: '09:00',
        end: '18:00',
        rest: [],
        blockConsult: true,
        blockPersonal: true,
        travel: 30
    };

    let cacheBusy = null;
    let cacheBusyTime = 0;
    let cachedPersonalStatus = true;
    let fetchErrorMsg = '';

    let state = {
        travel: 30,
        installMinutes: 90,
        unlocked: false,
        selectedDateStr: null,
        selectedTime: null,
        staffMsg: '',
        isBooking: false
    };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return Object.assign({}, DEFAULT_SETTINGS);
            const parsed = JSON.parse(raw);
            return Object.assign({}, DEFAULT_SETTINGS, parsed);
        } catch (e) {
            return Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function saveSettingsFromUI() {
        try {
            const cur = loadSettings();
            const leadEl = document.getElementById('bookLeadInput');
            const leadMinEl = document.getElementById('bookLeadMinInput');
            const startEl = document.getElementById('bookStartInput');
            const endEl = document.getElementById('bookEndInput');
            const travelEl = document.getElementById('bookTravelInput');
            const consultEl = document.getElementById('bookBlockConsultInput');
            const personalEl = document.getElementById('bookBlockPersonalInput');

            if (leadEl && leadEl.value !== '') cur.lead = Math.max(0, Math.min(30, parseInt(leadEl.value, 10) || 0));
            if (leadMinEl && leadMinEl.value !== '') cur.leadMin = Math.max(0, Math.min(30, parseInt(leadMinEl.value, 10) || 0));
            if (startEl && startEl.value) cur.start = startEl.value;
            if (endEl && endEl.value) cur.end = endEl.value;
            if (travelEl && travelEl.value !== '') cur.travel = Math.max(0, Math.min(240, parseInt(travelEl.value, 10) || 0));
            if (consultEl) cur.blockConsult = !!consultEl.checked;
            if (personalEl) cur.blockPersonal = !!personalEl.checked;

            localStorage.setItem(STORE_KEY, JSON.stringify(cur));
        } catch (e) {}
    }

    function initSettingsUI() {
        const s = loadSettings();
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

        setVal('bookLeadInput', s.lead);
        setVal('bookLeadMinInput', s.leadMin);
        setVal('bookStartInput', s.start);
        setVal('bookEndInput', s.end);
        setVal('bookTravelInput', s.travel);
        setChk('bookBlockConsultInput', s.blockConsult);
        setChk('bookBlockPersonalInput', s.blockPersonal);

        renderRestDowsUI();
    }

    function toggleDow(dow) {
        const s = loadSettings();
        dow = Number(dow);
        const idx = s.rest.indexOf(dow);
        if (idx >= 0) {
            s.rest.splice(idx, 1);
        } else {
            s.rest.push(dow);
        }
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(s));
        } catch (e) {}
        renderRestDowsUI();
    }

    function renderRestDowsUI() {
        const s = loadSettings();
        const wrap = document.getElementById('bookRestDows');
        if (!wrap) return;
        const btns = wrap.querySelectorAll('button[data-dow]');
        btns.forEach(btn => {
            const dow = Number(btn.getAttribute('data-dow'));
            const on = s.rest.includes(dow);
            if (on) {
                btn.className = 'bg-slate-800 text-white border border-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-sm';
            } else {
                btn.className = 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-sm';
            }
        });
    }

    function ready() {
        return typeof window.notionLedgerRelay === 'function' && !!window.notionLedgerRelay();
    }

    function computeInitialInstallMinutes() {
        try {
            const snap = (typeof window.collectConsultation === 'function') ? window.collectConsultation() : { rooms: [] };
            const count = (snap.rooms || []).filter(r => r.curtains && r.curtains.length > 0).length;
            if (count <= 1) return 60;
            const mins = 60 + (count - 1) * 30;
            return Math.min(240, mins);
        } catch (e) {
            return 90;
        }
    }

    async function fetchBusy(force) {
        const relay = window.notionLedgerRelay();
        if (!relay) {
            fetchErrorMsg = '중계 설정 확인 (설정 › 장부로 보내기)';
            return null;
        }
        const now = Date.now();
        if (!force && cacheBusy && (now - cacheBusyTime < 120000)) {
            return cacheBusy;
        }

        const settings = loadSettings();
        const payload = {
            secret: relay.secret,
            action: 'busy',
            days: 22,
            personal: settings.blockPersonal
        };

        try {
            const res = await fetch(relay.url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                fetchErrorMsg = '중계 설정 확인 (설정 › 장부로 보내기)';
                return null;
            }
            const data = await res.json();
            if (!data || !data.ok || !Array.isArray(data.busy)) {
                fetchErrorMsg = '중계 설정 확인 (설정 › 장부로 보내기)';
                return null;
            }
            cacheBusy = data.busy;
            cacheBusyTime = Date.now();
            cachedPersonalStatus = (data.personal !== false);
            fetchErrorMsg = '';
            return cacheBusy;
        } catch (e) {
            fetchErrorMsg = '인터넷 연결 확인';
            return null;
        }
    }

    function toDateStr(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function parseTimeStr(tStr) {
        const parts = (tStr || '09:00').split(':').map(Number);
        return { h: parts[0] || 0, m: parts[1] || 0 };
    }

    function computeAvailableSlotsForDate(targetDate, busyList, settings, unlocked, travel, installMinutes) {
        const dayOfWeek = targetDate.getDay(); // 0=일 ... 6=토
        if (settings.rest && settings.rest.includes(dayOfWeek)) {
            return { status: '쉬는 날', slots: [] };
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
        const diffDays = Math.round((startOfTarget - startOfToday) / (24 * 3600 * 1000));

        if (unlocked) {
            if (diffDays < settings.leadMin) {
                return { status: '제작 기간', slots: [] };
            }
        } else {
            if (diffDays < settings.lead) {
                return { status: '제작 기간', slots: [] };
            }
        }

        const filteredBusy = (busyList || []).filter(b => {
            if (!settings.blockConsult && b.k === '상담') return false;
            return true;
        });

        const startParsed = parseTimeStr(settings.start);
        const endParsed = parseTimeStr(settings.end);

        const workStartMs = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), startParsed.h, startParsed.m).getTime();
        const workEndMs = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), endParsed.h, endParsed.m).getTime();

        let curSlot = new Date(workStartMs);
        if (curSlot.getMinutes() !== 0 && curSlot.getMinutes() !== 30) {
            if (curSlot.getMinutes() < 30) {
                curSlot.setMinutes(30, 0, 0);
            } else {
                curSlot.setHours(curSlot.getHours() + 1, 0, 0, 0);
            }
        }

        const travelMs = travel * 60 * 1000;
        const installMs = installMinutes * 60 * 1000;
        const slots = [];

        while (true) {
            const t = curSlot.getTime();
            const slotStart = t - travelMs;
            const slotEnd = t + installMs + travelMs;

            if (slotStart < workStartMs) {
                curSlot.setTime(t + 30 * 60 * 1000);
                continue;
            }
            if (slotEnd > workEndMs) {
                break;
            }

            const overlaps = filteredBusy.some(b => {
                return (b.s < slotEnd && b.e > slotStart);
            });

            if (!overlaps) {
                slots.push(t);
            }

            curSlot.setTime(t + 30 * 60 * 1000);
        }

        if (slots.length > 0) {
            return { status: '가능', slots };
        } else {
            return { status: '마감', slots: [] };
        }
    }

    function formatTime12(d) {
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        const isPm = h >= 12;
        if (h > 12) h -= 12;
        return `${h}:${m}`;
    }

    function formatTimeKorean(dateObj, installMins) {
        const isPm = dateObj.getHours() >= 12;
        const prefix = isPm ? '오후' : '오전';
        let h = dateObj.getHours();
        if (h > 12) h -= 12;
        const m = String(dateObj.getMinutes()).padStart(2, '0');
        const durHours = Math.floor(installMins / 60);
        const durRem = installMins % 60;
        let durStr = '';
        if (durHours > 0 && durRem > 0) durStr = `${durHours}시간 ${durRem}분`;
        else if (durHours > 0) durStr = `${durHours}시간`;
        else durStr = `${durRem}분`;

        return `${prefix} ${h}:${m} 도착 · 약 ${durStr}`;
    }

    function formatDateKorean(dateObj) {
        const DOW_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        return `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${DOW_NAMES[dateObj.getDay()]}`;
    }

    function renderStaffBar() {
        const settings = loadSettings();
        let html = '';
        html += `<button type="button" onclick="window.redamBooking.cycleTravel()">이동 ${state.travel}분</button>`;

        const instH = Math.floor(state.installMinutes / 60);
        const instM = state.installMinutes % 60;
        let instStr = '';
        if (instH > 0 && instM > 0) instStr = `${instH}시간 ${instM}분`;
        else if (instH > 0) instStr = `${instH}시간`;
        else instStr = `${instM}분`;
        html += `<button type="button" onclick="window.redamBooking.cycleInstall()">시공 ${instStr}</button>`;

        const leadDays = state.unlocked ? settings.leadMin : settings.lead;
        const lockIcon = state.unlocked ? '🔓' : '🔒';
        html += `<button type="button" onclick="window.redamBooking.toggleLock()">${leadDays}일 뒤부터 ${lockIcon}</button>`;

        html += `<button type="button" onclick="window.redamBooking.refreshBusy()">새로</button>`;

        let msg = state.staffMsg || fetchErrorMsg;
        if (!msg && settings.blockPersonal && !cachedPersonalStatus) {
            msg = '개인 캘린더 못 읽음';
        }
        if (msg) {
            html += `<span class="bk-staff-msg">${msg}</span>`;
        }
        return html;
    }

    function renderModal(busyList) {
        let panel = document.getElementById('bookPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'bookPanel';
            panel.className = 'bk-panel';
            document.body.appendChild(panel);
        }

        const settings = loadSettings();
        const pick = (typeof window.getBookingPick === 'function') ? window.getBookingPick() : null;

        let html = '';
        html += '<div class="bk-bar">';
        html += '  <button type="button" class="bk-back" onclick="window.redamBooking.close()">← 견적서</button>';
        html += `  <div class="bk-staff">${renderStaffBar()}</div>`;
        html += '</div>';

        if (!busyList) {
            html += '<div class="bk-body" style="align-items:center; justify-content:center;">';
            html += '  <div class="bk-error-msg">지금은 빈 시간을 볼 수 없습니다.</div>';
            html += '</div>';
            panel.innerHTML = html;
            return;
        }

        const days = [];
        const today = new Date();
        for (let i = 1; i <= 21; i++) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
            const dateStr = toDateStr(d);
            const res = computeAvailableSlotsForDate(d, busyList, settings, state.unlocked, state.travel, state.installMinutes);
            days.push({
                date: d,
                dateStr,
                status: res.status,
                slots: res.slots
            });
        }

        if (!state.selectedDateStr) {
            if (pick && pick.start) {
                const pickD = new Date(pick.start);
                state.selectedDateStr = toDateStr(pickD);
                state.selectedTime = pick.start;
            } else {
                const firstAvail = days.find(d => d.status === '가능');
                if (firstAvail) {
                    state.selectedDateStr = firstAvail.dateStr;
                }
            }
        }

        const selectedDay = days.find(d => d.dateStr === state.selectedDateStr);
        const anyAvail = days.some(d => d.status === '가능');

        html += '<div class="bk-body">';
        html += '  <div class="bk-left">';
        html += '    <h1 class="bk-title">시공 날짜</h1>';
        html += '    <div class="bk-subtitle">편하신 날과 도착 시간을 골라 주세요.</div>';

        html += '    <div class="bk-cal-head">';
        ['월', '화', '수', '목', '금', '토', '일'].forEach(h => {
            html += `<span>${h}</span>`;
        });
        html += '    </div>';

        html += '    <div class="bk-cal-grid">';
        const firstDayOfWeek = days[0].date.getDay(); // 0=일 ... 6=토
        const padCount = (firstDayOfWeek === 0 ? 7 : firstDayOfWeek) - 1; // 1=월(0pad), 0=일(6pad)
        for (let p = 0; p < padCount; p++) {
            html += '<div class="bk-cal-cell is-empty"></div>';
        }

        days.forEach(d => {
            const isDisabled = d.status !== '가능';
            const isSelected = (d.dateStr === state.selectedDateStr);
            const dot = isSelected ? '<i class="bk-dot"></i>' : '';
            const clickAttr = isDisabled ? '' : `onclick="window.redamBooking.selectDate('${d.dateStr}')"`;
            html += `<div class="bk-cal-cell ${isDisabled ? 'is-disabled' : ''}${isSelected ? ' is-selected' : ''}" ${clickAttr}>`;
            html += `  <div class="bk-day-num">${dot}${d.date.getDate()}</div>`;
            html += `  <div class="bk-day-status">${d.status}</div>`;
            html += `</div>`;
        });
        html += '    </div>';
        html += '  </div>'; // bk-left

        html += '  <div class="bk-right">';
        if (pick && pick.confirmed && pick.start) {
            const pickDate = new Date(pick.start);
            html += '<h2 class="bk-right-title">시공 날짜가 정해졌습니다</h2>';
            html += `<div class="bk-confirmed-wrap">`;
            html += `  <div class="bk-confirmed-sub">${formatDateKorean(pickDate)} · ${formatTimeKorean(pickDate, pick.minutes || state.installMinutes).split(' · ')[0]}</div>`;
            html += `</div>`;
        } else if (!anyAvail) {
            html += '<div class="bk-empty-msg">앞으로 3주 안에 빈 시간이 없습니다.</div>';
        } else if (!selectedDay || selectedDay.slots.length === 0) {
            html += `<h2 class="bk-right-title">${selectedDay ? formatDateKorean(selectedDay.date) : ''}</h2>`;
            html += '<div class="bk-empty-msg">이날은 남은 시간이 없습니다.</div>';
        } else {
            html += `<h2 class="bk-right-title">${formatDateKorean(selectedDay.date)}</h2>`;

            const amSlots = selectedDay.slots.filter(t => new Date(t).getHours() < 12);
            const pmSlots = selectedDay.slots.filter(t => new Date(t).getHours() >= 12);

            if (amSlots.length > 0) {
                html += '<div class="bk-time-group-title">오전</div>';
                html += '<div class="bk-time-chips">';
                amSlots.forEach(t => {
                    const d = new Date(t);
                    const isSel = (state.selectedTime === t);
                    const dot = isSel ? '<i class="bk-dot"></i>' : '';
                    html += `<button type="button" class="bk-time-chip ${isSel ? 'is-selected' : ''}" onclick="window.redamBooking.selectTime(${t})">${dot}${formatTime12(d)}</button>`;
                });
                html += '</div>';
            }

            if (pmSlots.length > 0) {
                html += '<div class="bk-time-group-title">오후</div>';
                html += '<div class="bk-time-chips">';
                pmSlots.forEach(t => {
                    const d = new Date(t);
                    const isSel = (state.selectedTime === t);
                    const dot = isSel ? '<i class="bk-dot"></i>' : '';
                    html += `<button type="button" class="bk-time-chip ${isSel ? 'is-selected' : ''}" onclick="window.redamBooking.selectTime(${t})">${dot}${formatTime12(d)}</button>`;
                });
                html += '</div>';
            }

            if (state.selectedTime && selectedDay.slots.includes(state.selectedTime)) {
                const selDateObj = new Date(state.selectedTime);
                const isPicked = (pick && pick.start === state.selectedTime);

                html += '<div class="bk-confirm-box">';
                html += `  <div class="bk-summary-text">${formatTimeKorean(selDateObj, state.installMinutes)}</div>`;

                if (!isPicked) {
                    html += `  <button type="button" class="bk-go" onclick="window.redamBooking.chooseTime()">이 시간으로 할게요</button>`;
                } else {
                    html += `  <div class="bk-hold-msg">확인한 뒤 확정해 드리겠습니다.</div>`;
                    html += `  <button type="button" id="bkHoldBtn" class="bk-hold-btn"><span class="bk-hold-label">${state.isBooking ? '확정하는 중…' : '확정 · 길게 누르기'}</span></button>`;
                }
                html += '</div>';
            }
        }

        html += '  </div>'; // bk-right
        html += '</div>'; // bk-body

        panel.innerHTML = html;

        setupHoldButton();
    }

    let holdTimer = null;
    function setupHoldButton() {
        const btn = document.getElementById('bkHoldBtn');
        if (!btn) return;

        const startHold = (e) => {
            if (state.isBooking) return;
            e.preventDefault();
            btn.classList.add('is-holding');
            clearTimeout(holdTimer);
            holdTimer = setTimeout(() => {
                confirmBooking();
            }, 1000);
        };

        const cancelHold = () => {
            clearTimeout(holdTimer);
            btn.classList.remove('is-holding');
        };

        btn.addEventListener('pointerdown', startHold);
        btn.addEventListener('pointerup', cancelHold);
        btn.addEventListener('pointerleave', cancelHold);
        btn.addEventListener('pointercancel', cancelHold);
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    async function confirmBooking(replace) {
        if (state.isBooking) return;
        const relay = window.notionLedgerRelay();
        if (!relay) {
            state.staffMsg = '중계 설정 확인';
            renderStaffBarOnly();
            return;
        }

        const snap = (typeof window.collectConsultation === 'function') ? window.collectConsultation() : {};
        const phone = String(snap.phone || '').replace(/\D/g, '');
        if (phone.length < 9) {
            state.staffMsg = '연락처를 먼저 적어 주세요';
            renderStaffBarOnly();
            return;
        }

        const pick = (typeof window.getBookingPick === 'function') ? window.getBookingPick() : null;
        if (!pick || !pick.start) return;

        const settings = loadSettings();
        state.isBooking = true;
        const btn = document.getElementById('bkHoldBtn');
        if (btn) {
            btn.classList.remove('is-holding');
            btn.innerHTML = '<span class="bk-hold-label">확정하는 중…</span>';
        }

        const payload = {
            secret: relay.secret,
            action: 'book',
            phone,
            start: pick.start,
            minutes: pick.minutes,
            travel: pick.travel,
            consult: settings.blockConsult,
            personal: settings.blockPersonal
        };
        if (replace) payload.replace = true;

        try {
            const res = await fetch(relay.url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            state.isBooking = false;

            if (data && data.ok) {
                pick.confirmed = true;
                if (typeof window.setBookingPick === 'function') window.setBookingPick(pick);
                state.staffMsg = '';
                const busy = await fetchBusy(true);
                renderModal(busy);
                return;
            }

            const reason = (data && data.reason) || 'error';
            if (reason === 'has_date') {
                const atDate = new Date(data.at);
                const isPm = atDate.getHours() >= 12;
                let h = atDate.getHours();
                if (h > 12) h -= 12;
                const m = String(atDate.getMinutes()).padStart(2, '0');
                const atStr = `${atDate.getMonth() + 1}월 ${atDate.getDate()}일 ${isPm ? '오후' : '오전'} ${h}:${m}`;
                if (confirm(`장부에 이미 시공일(${atStr})이 있습니다. 새 시간으로 바꿀까요?`)) {
                    confirmBooking(true);
                    return;
                }
            } else if (reason === 'taken') {
                state.staffMsg = '방금 그 시간이 찼습니다';
                pick.confirmed = false;
                if (typeof window.setBookingPick === 'function') window.setBookingPick(pick);
                state.selectedTime = null;
                const busy = await fetchBusy(true);
                renderModal(busy);
                return;
            } else if (reason === 'not_found') {
                const last4 = phone.slice(-4);
                state.staffMsg = `장부에서 연락처 끝 ${last4} 줄을 못 찾았어요`;
            } else if (reason === 'many') {
                state.staffMsg = '장부에 같은 연락처 줄이 여럿이에요';
            } else if (reason === 'phone') {
                state.staffMsg = '연락처를 먼저 적어 주세요';
            } else if (reason === 'time') {
                state.staffMsg = '지난 시간이에요';
            } else if (reason === 'secret' || reason === 'setup' || reason === 'error') {
                state.staffMsg = '중계 설정 확인';
            } else {
                state.staffMsg = '중계 설정 확인';
            }
            if (btn) btn.textContent = '확정 (길게 누르기)';
            renderStaffBarOnly();
        } catch (e) {
            state.isBooking = false;
            state.staffMsg = '인터넷 연결 확인';
            if (btn) btn.textContent = '확정 (길게 누르기)';
            renderStaffBarOnly();
        }
    }

    function renderStaffBarOnly() {
        const bar = document.querySelector('.bk-staff');
        if (bar) bar.innerHTML = renderStaffBar();
    }

    async function open() {
        const settings = loadSettings();
        state.travel = settings.travel;
        state.installMinutes = computeInitialInstallMinutes();
        state.unlocked = false;
        state.staffMsg = '';

        const pick = (typeof window.getBookingPick === 'function') ? window.getBookingPick() : null;
        if (pick && pick.start) {
            const pickDate = new Date(pick.start);
            state.selectedDateStr = toDateStr(pickDate);
            state.selectedTime = pick.start;
            if (Number.isFinite(pick.travel)) state.travel = pick.travel;
            if (Number.isFinite(pick.minutes)) state.installMinutes = pick.minutes;
        } else {
            state.selectedDateStr = null;
            state.selectedTime = null;
        }

        let panel = document.getElementById('bookPanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'bookPanel';
            panel.className = 'bk-panel';
            document.body.appendChild(panel);
        }

        panel.innerHTML = `
            <div class="bk-bar">
                <button type="button" class="bk-back" onclick="window.redamBooking.close()">← 견적서</button>
                <div class="bk-staff">${renderStaffBar()}</div>
            </div>
            <div class="bk-body" style="align-items:center; justify-content:center;">
                <div class="bk-empty-msg">빈 시간을 보는 중입니다</div>
            </div>
        `;

        const busy = await fetchBusy(false);
        renderModal(busy);
    }

    function close() {
        const panel = document.getElementById('bookPanel');
        if (panel) panel.remove();
        state.unlocked = false;
    }

    function selectDate(dateStr) {
        state.selectedDateStr = dateStr;
        state.selectedTime = null;
        renderModal(cacheBusy);
    }

    function selectTime(timeMs) {
        state.selectedTime = timeMs;
        renderModal(cacheBusy);
    }

    function chooseTime() {
        if (!state.selectedTime) return;
        const pick = {
            start: state.selectedTime,
            minutes: state.installMinutes,
            travel: state.travel,
            confirmed: false
        };
        if (typeof window.setBookingPick === 'function') {
            window.setBookingPick(pick);
        }
        renderModal(cacheBusy);
    }

    function cycleTravel() {
        const steps = [15, 30, 45, 60, 90];
        let idx = steps.indexOf(state.travel);
        if (idx < 0) idx = 1; // default 30
        idx = (idx + 1) % steps.length;
        state.travel = steps[idx];
        renderModal(cacheBusy);
    }

    function cycleInstall() {
        let mins = state.installMinutes + 30;
        if (mins > 240) mins = 30; // 짧은 시공(블라인드 한 장 등)도 잡게 30분부터 (214번)
        state.installMinutes = mins;
        renderModal(cacheBusy);
    }

    function toggleLock() {
        state.unlocked = !state.unlocked;
        renderModal(cacheBusy);
    }

    async function refreshBusy() {
        const busy = await fetchBusy(true);
        renderModal(busy);
    }

    window.redamBooking = {
        open,
        close,
        ready,
        initSettings: initSettingsUI,
        saveSettings: saveSettingsFromUI,
        toggleDow,
        selectDate,
        selectTime,
        chooseTime,
        cycleTravel,
        cycleInstall,
        toggleLock,
        refreshBusy
    };
})();
