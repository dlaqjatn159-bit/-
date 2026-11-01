(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['settings.js']='20261184';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// settings.js — 직원 화면 › 원단 목록 표(책자 고르기·단가 보기)·견적서 창·설정 칸(안내 문구·결제/제작/공급자 글·유효 기간·배수·판매가 곡선·가공·부자재 단가) (130-2에서 app.js에서 떼어 냄)

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

// 견적서 이미지·원단 이름(ticketBookName 등)은 ticket.js로 옮김 (130-2)

// 견적서 하단 안내 문구 (예: 제작 약 7일 · 시공 약 2시간). 직원 화면에서 입력, 이 브라우저에 저장
const TICKET_NOTE_KEY = 'redam_ticket_note_v1';
function loadTicketNote() { try { return (localStorage.getItem(TICKET_NOTE_KEY) || '').trim(); } catch (e) { return ''; } }
function saveTicketNote(v) { try { localStorage.setItem(TICKET_NOTE_KEY, String(v || '').trim()); } catch (e) {} }
// 견적서 아래쪽 글: 결제 조건 / 맞춤 제작 안내 / 공급자 정보 (여러 줄). 사업자 정보가 들어가므로 코드에 적지 않고 이 기기에만 저장 (비공개 팩으로 옮김)
// 견적서 유효기간(일) — 설정에서 바꿈, 기본 14일, 0이면 표시 안 함 (85번)
const QUOTE_VALID_KEY = 'redam_quote_valid_days_v1', QUOTE_VALID_DEFAULT = 14;
function loadQuoteValidDays() {
    try { const v = localStorage.getItem(QUOTE_VALID_KEY), n = Number(v); if (v !== null && v !== '' && Number.isFinite(n) && n >= 0) return Math.min(365, Math.round(n)); } catch (e) {}
    return QUOTE_VALID_DEFAULT;
}
function saveQuoteValidDays(v) {
    const n = Number(v);
    try { if (v === '' || !Number.isFinite(n) || n < 0) localStorage.removeItem(QUOTE_VALID_KEY); else localStorage.setItem(QUOTE_VALID_KEY, String(Math.min(365, Math.round(n)))); } catch (e) {}
}
// 직원 화면 배수 표시 (86번): 기준 배수는 설정에 저장, 표시는 견적 요약 원가 "보기" 안에만
const MULTIPLES_KEY = 'redam_multiples_v1', MULTIPLES_DEFAULT = { cT: 2.5, cF: 2.2, bF: 2.0, vat: true };
function loadMultiples() {
    const m = Object.assign({}, MULTIPLES_DEFAULT);
    try {
        const o = JSON.parse(localStorage.getItem(MULTIPLES_KEY) || 'null') || {};
        ['cT', 'cF', 'bF'].forEach(k => { if (Number.isFinite(o[k]) && o[k] > 0) m[k] = o[k]; });
        if (typeof o.vat === 'boolean') m.vat = o.vat;
    } catch (e) {}
    return m;
}
function saveMultiples() {
    const num = (id, def) => { const el = document.getElementById(id), n = el ? Number(el.value) : NaN; return (el && el.value !== '' && Number.isFinite(n) && n > 0) ? n : def; };
    const vat = document.getElementById('mxVat');
    const o = { cT: num('mxCurtainTarget', MULTIPLES_DEFAULT.cT), cF: num('mxCurtainFloor', MULTIPLES_DEFAULT.cF), bF: num('mxBlindFloor', MULTIPLES_DEFAULT.bF), vat: vat ? vat.checked : MULTIPLES_DEFAULT.vat };
    try { localStorage.setItem(MULTIPLES_KEY, JSON.stringify(o)); } catch (e) {}
    if (typeof calculateAll === 'function') calculateAll();
}
function initMultiplesInputs() {
    const m = loadMultiples(), set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('mxCurtainTarget', m.cT); set('mxCurtainFloor', m.cF); set('mxBlindFloor', m.bF);
    const vat = document.getElementById('mxVat'); if (vat) vat.checked = m.vat;
}
// 만 원 글자: 천 원 단위 내림 (예: 125,000 → "12만 5천 원")
function fmtManWon(n) {
    const v = Math.floor(Math.abs(n) / 1000) * 1000, man = Math.floor(v / 10000), chon = (v % 10000) / 1000;
    if (v === 0) return '0원';
    return (man ? `${man}만 ` : '') + (chon ? `${chon}천 ` : '') + '원';
}
// 커튼·블라인드 두 줄. grp가 없으면(고객 모드) 비움
function renderMultiples(grp, m) {
    const box = document.getElementById('resMultiples'); if (!box) return;
    if (!grp || !m) { box.innerHTML = ''; return; }
    const row = (name, g, target, floor) => {
        if (g.sell <= 0 && !g.miss) return '';
        const note = g.miss ? '<span class="staff-mx-note"> 원가 없는 품목 있음</span>' : '';
        if (g.buy <= 0) return `<div class="staff-sum-line"><span>${name} ―${note}</span><span></span></div>`;
        const x = g.sell / g.buy;
        // 109번: 원단마다 곡선 배수가 있으면 "곡선대로라면 나올 배수"와 비교, 0.2 넘게 낮을 때만 경고
        if (!g.noCurve && g.want > 0) {
            const e = g.want / g.buy, gap = g.sell - g.want;
            const low = x < e - 0.2;
            const tail = gap >= 0 ? `곡선 ×${e.toFixed(1)}보다 ${fmtManWon(gap)} 위` : `곡선 ×${e.toFixed(1)}보다 ${fmtManWon(gap)} 낮음`;
            return `<div class="staff-sum-line ${low ? 'mx-low' : ''}"><span>${name} ×${x.toFixed(1)}${note}</span><span>${tail}</span></div>`;
        }
        const slack = g.sell - g.buy * floor;
        const cls = x >= target ? '' : (x >= floor ? 'mx-mid' : 'mx-low');
        const tail = slack >= 0 ? `바닥까지 ${fmtManWon(slack)}` : `바닥보다 ${fmtManWon(slack)} 낮음`;
        return `<div class="staff-sum-line ${cls}"><span>${name} ×${x.toFixed(1)}${note}</span><span>${tail}</span></div>`;
    };
    box.innerHTML = row('커튼', grp.curtain, m.cT, m.cF) + row('블라인드', grp.blind, m.bF, m.bF);
}
// 이 상담만 유효기간을 바꿈 — 비우면 설정 값 (85번)
function setQuoteValidOverride(v) {
    const n = Number(v);
    quoteValidOverride = (v === '' || !Number.isFinite(n) || n < 0) ? null : Math.min(365, Math.round(n));
    if (typeof saveDraftTick === 'function') saveDraftTick();
}
const TICKET_TEXT_KEYS = { pay: 'redam_ticket_pay_v1', custom: 'redam_ticket_custom_v1', supplier: 'redam_ticket_supplier_v1' };
const TICKET_TEXT_INPUTS = { pay: 'ticketPayInput', custom: 'ticketCustomInput', supplier: 'ticketSupplierInput' };
function loadTicketText(k) { try { return (localStorage.getItem(TICKET_TEXT_KEYS[k]) || '').trim(); } catch (e) { return ''; } }
function saveTicketText(k, v) { if (!TICKET_TEXT_KEYS[k]) return; try { localStorage.setItem(TICKET_TEXT_KEYS[k], String(v || '').trim()); } catch (e) {} }
// 빛 · 스탠드 금액 (131번): 이케아 가격과 구매·설치 대행비. 가격은 코드에 적지 않고 이 기기에 저장 (비공개 팩으로 옮김)
const LIGHT_STAND_KEYS = { price: 'redam_light_stand_price_v1', fee: 'redam_light_stand_fee_v1' };
function loadLightStand(k) { try { const v = localStorage.getItem(LIGHT_STAND_KEYS[k]), n = Number(v); return (v !== null && v !== '' && Number.isFinite(n) && n >= 0) ? Math.round(n) : 0; } catch (e) { return 0; } }
function saveLightStand(k, v) {
    if (!LIGHT_STAND_KEYS[k]) return;
    const n = Number(v);
    try { if (v === '' || !Number.isFinite(n) || n < 0) localStorage.removeItem(LIGHT_STAND_KEYS[k]); else localStorage.setItem(LIGHT_STAND_KEYS[k], String(Math.round(n))); } catch (e) {}
    if (typeof calculateAll === 'function') calculateAll();
}
// 이 상담의 빛 줄: 켜져 있고 금액이 하나라도 있을 때만 (견적서·합계·원가가 같이 씀)
function lightStandOf() {
    const price = loadLightStand('price'), fee = loadLightStand('fee');
    const on = !!globalLightStand && (price + fee) > 0;
    return { on, asked: !!globalLightStand, price: on ? price : 0, fee: on ? fee : 0, total: on ? price + fee : 0 };
}
function initTicketNoteInput() {
    const el = document.getElementById('ticketNoteInput'); if (el) el.value = loadTicketNote();
    Object.keys(TICKET_TEXT_INPUTS).forEach(k => { const t = document.getElementById(TICKET_TEXT_INPUTS[k]); if (t) t.value = loadTicketText(k); });
    const fee = document.getElementById('defaultInstallFeeInput'); if (fee) fee.value = loadDefaultInstallFee();
    const vd = document.getElementById('quoteValidDaysInput'); if (vd) vd.value = loadQuoteValidDays();
    ['price', 'fee'].forEach(k => { const el = document.getElementById(k === 'price' ? 'lightStandPriceInput' : 'lightStandFeeInput'); if (el) el.value = loadLightStand(k) || ''; });      // 131번
    initMultiplesInputs();
    renderOptionPriceSettings();
    renderPriceCurveSettings();
}
// 설정 › 판매가 곡선 (109번): 점 4개(폭당 매입 · 배수) + 블라인드 배수. 칸을 고치면 바로 저장
function renderPriceCurveSettings() {
    const box = document.getElementById('priceCurveBox');
    if (!box) return;
    const cv = priceCurve(), pts = cv.pts.slice().sort((u, v) => u[0] - v[0]);
    const inp = (cls, v, step) => `<input type="number" min="0" step="${step}" inputmode="decimal" data-curve="${cls}" value="${v || ''}" placeholder="비어 있음">`;
    let h = '<div class="opt-group"><h3>커튼 <small>폭 하나 기준 매입가 → 배수, 점 사이는 이어서</small></h3>';
    for (let i = 0; i < 4; i++) {
        const q = pts[i] || [];
        h += `<div class="opt-row" data-curve-row><span class="opt-name">점 ${i + 1}</span><label><em>폭당 매입</em>${inp('x', q[0], 1000)}<i>원</i></label><label><em>배수</em>${inp('m', q[1], 0.05)}<i>배</i></label><span></span></div>`;
    }
    h += '</div><div class="opt-group"><h3>블라인드 <small>헤베당 원가 × 1.1 × 배수</small></h3>';
    h += `<div class="opt-row"><span class="opt-name">배수</span><label><em>배수</em>${inp('b', cv.blind, 0.05)}<i>배</i></label><span></span><span></span></div></div>`;
    box.innerHTML = h;
    if (!box.dataset.wired) {
        box.dataset.wired = '1';
        box.addEventListener('input', () => {
            const num = el => { const n = Number(el.value); return (el.value !== '' && Number.isFinite(n) && n > 0) ? n : 0; };
            const out = [];
            box.querySelectorAll('[data-curve-row]').forEach(r => {
                const x = num(r.querySelector('[data-curve="x"]')), m = num(r.querySelector('[data-curve="m"]'));
                if (x && m) out.push([Math.round(x), m]);
            });
            const b = num(box.querySelector('[data-curve="b"]'));
            savePriceCurve({ pts: out, blind: b });
        });
    }
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
    return { note: loadTicketNote(), pay: loadTicketText('pay'), custom: loadTicketText('custom'), supplier: loadTicketText('supplier'), fee: fee === null ? undefined : fee, valid: loadQuoteValidDays(),
        standPrice: loadLightStand('price') || undefined, standFee: loadLightStand('fee') || undefined };      // 131번
}
function applyTicketTextsFromPack(t) {
    if (!t || typeof t !== 'object') return;
    if (typeof t.note === 'string' && t.note.trim()) saveTicketNote(t.note);
    if (typeof t.valid === 'number' && Number.isFinite(t.valid) && t.valid >= 0) saveQuoteValidDays(t.valid);
    if (typeof t.fee === 'number' && Number.isFinite(t.fee) && t.fee >= 0) saveDefaultInstallFee(t.fee);
    if (typeof t.standPrice === 'number' && t.standPrice > 0) saveLightStand('price', t.standPrice);      // 131번
    if (typeof t.standFee === 'number' && t.standFee > 0) saveLightStand('fee', t.standFee);
    Object.keys(TICKET_TEXT_KEYS).forEach(k => { if (typeof t[k] === 'string' && t[k].trim()) saveTicketText(k, t[k]); });
    initTicketNoteInput();
}
