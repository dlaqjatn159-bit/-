(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['calculator.js']='20261235';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// CORE CALCULATION GLUE  (calculator.js)
// 계산 자체는 pricing.js(판매가)와 costing.js(원가, 직원 모드 전용)가 합니다.
// 이 파일은 계산 결과를 화면에 채워 넣는 역할만 합니다.
// ==============================================================
function calculateAll() {
    const staff = (typeof Costing !== 'undefined') && Costing.state.enabled && Costing.hasData();

    let grandSubtotal = 0;
    let grandCostTotal = 0;
    let sumFabricCost = 0;
    let sumLaborCost = 0;
    let sumHwCost = 0;
    // 배수용 묶음 (86번): 커튼·블라인드 따로 제품 판매가·매입가(부가세 포함)를 모음. 시공비는 넣지 않음
    const mx = (typeof loadMultiples === 'function') ? loadMultiples() : null;
    const grp = { curtain: { sell: 0, buy: 0, miss: false, want: 0, noCurve: false }, blind: { sell: 0, buy: 0, miss: false, want: 0, noCurve: false } };      // want: 곡선대로라면 나올 판매가 합 (109번)

    let noFabCount = 0;      // 원단을 못 찾은 품목 수 (126번)
    let zeroPriceCount = 0;      // 172번: 판매가가 빈(0원) 원단을 쓴 품목 수
    const summaryListContainer = document.getElementById('summaryRoomList');
    if (summaryListContainer) summaryListContainer.innerHTML = '';

    rooms.forEach(room => {
        let roomSubtotalSum = 0;

        room.curtains.forEach(c => {
            const fab = Pricing.pickFabric(FABRIC_DB, c.fabricId);
            const p = Pricing.priceItem(c, fab);
            if (p.noFabric) noFabCount++;
            if (fab && !fab.sampleOnly && !(Number(fab.price) > 0)) zeroPriceCount++;      // 172번 (실물 견본 품목은 0원이 정상이라 세지 않음)
            const cost = (staff && fab) ? Costing.costItem(c, fab, p) : null;

            c.calc = {
                fabName: (p.fabName || '') + (typeof colorSuffix === 'function' ? colorSuffix(c.colorName, c.fabricId) : ''), fabBook: p.fabBook, calcType: p.calcType,
                colorName: c.colorName || '',
                numWidths: p.numWidths, totalYards: p.totalYards, appliedHebe: p.appliedHebe, qtyText: p.qtyText,
                curtainSubtotal: p.curtainSubtotal, numJa: p.numJa, leadBandCost: p.leadBandCost,
                actualCurtainHeight: p.actualCurtainHeight,
                installDesc: p.installDesc,
                floorGapVal: p.floorGapVal,
                isSeamless: p.isSeamless,
                noFabric: !!p.noFabric
            };

            if (cost) {
                // 원가 정보는 직원 모드에서만 만들어집니다.
                c.calc.laborCost = cost.laborCost;
                c.calc.hwCost = cost.hwCost;
                c.calc.curtainCostTotal = cost.curtainCostTotal;
                if (p.calcType === 'hebe') {
                    c.calc.qtyText = `${p.appliedHebe.toFixed(2)}m² (${p.appliedHebe}헤베 / 원가: ${cost.factoryHebe}회배)`;
                }
                grandCostTotal += cost.curtainCostTotal;
                sumFabricCost += cost.fabricSupplyCost;
                sumLaborCost += (cost.laborCost + cost.leadBandCost);
                sumHwCost += cost.hwCost;
            }

            if (staff && fab) {
                const g = grp[p.calcType === 'hebe' ? 'blind' : 'curtain'];
                if (cost) {
                    // 리드밴드는 원가=판매가라 부가세를 얹지 않음
                    g.sell += p.curtainSubtotal;
                    const ib = (cost.curtainCostTotal - cost.leadBandCost) * (mx && mx.vat ? 1.1 : 1) + cost.leadBandCost;
                    g.buy += ib;
                    const cm = (typeof curveMultOf === 'function') ? curveMultOf(fab, Costing.costOf(fab.id)) : 0;      // 원단별 곡선 배수 (109번)
                    if (cm > 0) g.want += ib * cm; else g.noCurve = true;
                } else g.miss = true;
            }

            roomSubtotalSum += p.curtainSubtotal;

            const qtyEl = document.getElementById(`curtainQty_${c.id}`);
            const subEl = document.getElementById(`curtainSub_${c.id}`);
            if (qtyEl) qtyEl.textContent = c.calc.qtyText;
            if (subEl) subEl.textContent = p.noFabric ? '' : `${p.curtainSubtotal.toLocaleString()}원`;      // 원단 없음은 금액을 비워 둠 (126번)
            if (qtyEl) qtyEl.classList.toggle('no-fabric', !!p.noFabric);
        });

        grandSubtotal += roomSubtotalSum;

        const roomSubEl = document.getElementById(`roomSubtotal_${room.id}`);
        if (roomSubEl) roomSubEl.textContent = `${roomSubtotalSum.toLocaleString()}원`;

        if (summaryListContainer) {
            summaryListContainer.innerHTML += `
                <div class="staff-sum-line">
                    <span>${room.name} (${room.curtains.length}개)</span>
                    <span>${roomSubtotalSum.toLocaleString()}원</span>
                </div>
            `;
        }
    });

    // 원단 없는 품목이 있으면 견적 요약 맨 아래에 경고 (126번)
    const noFabEl = document.getElementById('summaryNoFabric');
    if (noFabEl) {
        noFabEl.hidden = noFabCount === 0;
        noFabEl.textContent = noFabCount ? `원단 없는 품목 ${noFabCount}개 — 금액에서 빠져 있어요. 원단을 다시 골라 주세요.` : '';
    }
    // 172번: 판매가가 빈 원단을 쓴 품목이 있으면 경고 (견적서에 0원으로 나감)
    const zeroEl = document.getElementById('summaryZeroPrice');
    if (zeroEl) {
        zeroEl.hidden = zeroPriceCount === 0;
        zeroEl.textContent = zeroPriceCount ? `판매가가 비어 있는 원단 ${zeroPriceCount}개 — 견적서에 0원으로 나갑니다. 판매가를 넣거나 다른 원단을 골라 주세요.` : '';
    }

    // 131번: 빛(스탠드) 줄 — 이케아 가격 + 대행비를 품목 합에 더함. 켰는데 금액이 없으면 직원 화면에 알림
    const light = (typeof lightStandOf === 'function') ? lightStandOf() : { on: false, asked: false, total: 0, price: 0 };
    if (summaryListContainer && light.on) {
        summaryListContainer.innerHTML += `<div class="staff-sum-line"><span>빛 (조명 · 설치)</span><span>${light.total.toLocaleString()}원</span></div>`;
    }
    const lightWarn = document.getElementById('summaryLightWarn');
    if (lightWarn) { lightWarn.hidden = !(light.asked && !light.standOn); lightWarn.textContent = '빛 스탠드 금액이 설정에 없어 견적서에 넣지 못했어요. 설정 › 견적서 고정 문구에서 넣어 주세요.'; }
    const t = Pricing.totals(grandSubtotal + light.total, globalInstallFee, globalVatOption);
    const sellingPrice = t.sellingPrice;
    const vatAmount = t.vatAmount;
    const finalPrice = t.finalPrice;

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('totalGrandPrice', finalPrice.toLocaleString());
    setText('resGrandSubtotal', sellingPrice.toLocaleString());
    setText('resGrandVat', vatAmount.toLocaleString());
    setText('resRoomsSubtotal', grandSubtotal.toLocaleString());
    setText('proposalGrandPriceText', finalPrice.toLocaleString());

    if (staff) {
        const finalCostWithInstall = grandCostTotal + globalInstallFee + light.price;      // 131번: 이케아 가격은 그대로 나가는 돈
        const netProfit = sellingPrice - finalCostWithInstall;
        const netMarginRate = sellingPrice > 0 ? Math.round((netProfit / sellingPrice) * 100) : 0;
        setText('resTotalCost', `${finalCostWithInstall.toLocaleString()}원`);
        setText('resNetProfit', `${netProfit.toLocaleString()}원`);
        setText('resMarginRateBadge', `순마진 ${netMarginRate}%`);
        setText('resCostFabric', `${sumFabricCost.toLocaleString()}원`);
        setText('resCostLabor', `${sumLaborCost.toLocaleString()}원`);
        setText('resCostHardware', `${sumHwCost.toLocaleString()}원`);
        if (typeof renderMultiples === 'function') renderMultiples(grp, mx);
    } else {
        if (typeof renderMultiples === 'function') renderMultiples(null, null);
        // 고객 모드이거나 원가 데이터가 없으면 원가 칸을 비워 둡니다.
        ['resTotalCost', 'resNetProfit', 'resMarginRateBadge', 'resCostFabric', 'resCostLabor', 'resCostHardware']
            .forEach(id => setText(id, '-'));
    }
}

// ==============================================================
// DOCUMENT GENERATORS & CSV EXPORT
// ==============================================================
// 원단 없는 품목이 있으면 서류·견적서를 내보내지 못하게 막음 (126번). 막았으면 true
function blockIfNoFabric() {
    calculateAll();
    let n = 0;
    rooms.forEach(r => r.curtains.forEach(c => { if (c.calc && c.calc.noFabric) n++; }));
    if (!n) return false;
    showToast(`원단 없는 품목이 ${n}개 있어서 내보낼 수 없어요. 원단을 다시 골라 주세요.`, 'error');
    return true;
}

// 163번: 실측 크기 범위 — 50~800cm 밖이면 잘못 넣었을 수 있음(3600·36·0 등). 막지 않고 빨간 테두리·알림만
const SIZE_MIN_CM = 50, SIZE_MAX_CM = 800;
function sizeOutOfRange(v) { const n = Number(v); return !(n >= SIZE_MIN_CM && n <= SIZE_MAX_CM); }
// 견적란 크기 칸 모양: 범위 밖 = 빨간 테두리(size-out), 안 잰 처음 값 = 흐리게(size-unset)
function sizeClass(c, key) { return sizeOutOfRange(c[key]) ? ' size-out' : (c.sizeUnset ? ' size-unset' : ''); }
function sizeInputMark(el) { el.classList.remove('size-unset'); el.classList.toggle('size-out', sizeOutOfRange(el.value)); }
function sizeWarnToast(v, what) { if (sizeOutOfRange(v)) showToast(`${what} ${Number(v) || 0}cm — ${SIZE_MIN_CM}~${SIZE_MAX_CM}cm 밖입니다. 맞게 재셨는지 확인해 주세요.`, 'error'); }
// 163번: 견적서를 내보내기 전 빈칸·크기 확인 (withSupplier: 공급자 줄이 있는 견적서 그림·인쇄만 true)
function quoteGaps(withSupplier) {
    const out = [];
    if (!loadTicketText('pay')) out.push('결제 조건이 비어 있어 그 줄이 빠집니다');
    if (withSupplier && !loadTicketText('supplier')) out.push('공급자 정보가 비어 있어 그 줄이 빠집니다');
    let unset = 0, outN = 0;
    rooms.forEach(r => r.curtains.forEach(c => { if (c.sizeUnset) unset++; else if (sizeOutOfRange(c.width) || sizeOutOfRange(c.height)) outN++; }));
    if (unset) out.push(`크기를 넣지 않은 줄이 ${unset}개 있습니다(처음 값 그대로)`);
    if (outN) out.push(`크기가 ${SIZE_MIN_CM}~${SIZE_MAX_CM}cm 밖인 줄이 ${outN}개 있습니다`);
    const zero = rooms.reduce((n, r) => n + r.curtains.filter(c => { const f = Pricing.pickFabric(FABRIC_DB, c.fabricId); return f && !f.sampleOnly && !(Number(f.price) > 0); }).length, 0);      // 172번
    if (zero) out.push(`판매가가 비어 있는 원단을 쓴 줄이 ${zero}개 있습니다(견적서에 0원)`);
    return out;
}
// 직원 화면에서만 확인 창(손님 화면엔 띄우지 않음). 같은 내용으로 한 번 [확인]하면 다시 묻지 않음
let __gapsOkKey = '';
function confirmQuoteGaps(ask) {
    if (typeof appMode === 'undefined' || appMode !== 'staff') return true;
    const g = quoteGaps(true);
    if (!g.length) return true;
    const key = g.join('|');
    if (key === __gapsOkKey) return true;
    const ok = confirm(`확인해 주세요.\n\n• ${g.join('\n• ')}\n\n결제 조건·공급자 정보는 설정 › 견적서 고정 문구에서 적습니다.\n${ask}`);
    if (ok) __gapsOkKey = key;
    return ok;
}

// 서류·CSV 합계: 품목 금액을 더해 판매가·부가세·최종금액 (127번 Pricing.totals, 130-1번에서 두 곳을 하나로)
function docTotals() {
    let sum = 0;
    rooms.forEach(r => r.curtains.forEach(c => { if (c.calc) sum += c.calc.curtainSubtotal || 0; }));
    if (typeof lightStandOf === 'function') sum += lightStandOf().total;      // 131번
    return Pricing.totals(sum, globalInstallFee, globalVatOption);
}

// 서류 및 발주서용 원단명 표기: 공장 발주서·시트 상세·CSV 다운로드에서는 [영문품명] 병기 (51번, 130-1번에서 두 벌을 하나로)
function docFabName(calc, fab, isFactory, curtain) {
    let n = (calc && calc.fabName) || (fab && fab.name) || '';
    if (isFactory && fab && fab.engName) {
        if (fab.name && n.includes(fab.name)) {
            n = n.replace(fab.name, `${fab.name} [${fab.engName}]`);
        } else {
            n = `${n} [${fab.engName}]`;
        }
    }
    if (isFactory && curtain && curtain.fabricId && curtain.colorName && typeof fabricColorOf === 'function') {
        const col = fabricColorOf(curtain.fabricId, curtain.colorName);
        if (col && col.orderCode && !n.includes(col.orderCode)) {
            n += ` [${col.orderCode}]`;
        }
    }
    return n;
}

// 공장 발주 표(서류 시트·CSV 같은 칸): 머리 줄과 품목마다 한 줄 (130-1번에서 두 벌을 하나로)
const DOC_ORDER_HEADERS = ["일자", "고객명", "공간", "항목", "샘플북", "품목명", "실측가로", "실측세로", "설치방식", "바닥간격", "제작세로", "가공방식", "옵션", "수량", "단위", "단가", "부자재", "판매금액"];
function docOrderRows(dateStr, custName) {
    const out = [];
    rooms.forEach(r => {
        r.curtains.forEach(c => {
            const calc = c.calc || {};
            const fab = FABRIC_DB.find(f => f.id === c.fabricId) || {};
            const fabDisplayName = docFabName(calc, fab, true, c);
            const qtyVal = calc.calcType === 'hebe' ? calc.appliedHebe : (calc.calcType === 'width' ? calc.numWidths : calc.totalYards);
            const optText = `${c.shapeFee > 0 ? '형상 ' : ''}${c.leadBand ? '리드밴드' : ''}`.trim() || '기본';
            const methodDesc = calc.calcType === 'hebe' ? '블라인드' : (calc.calcType === 'width' ? '폭당완제품' : (calc.isSeamless ? '대폭무이음' : '소폭이음'));

            out.push([
                dateStr, custName, r.name, c.label, calc.fabBook || "", fabDisplayName || "",
                c.width, c.height, calc.installDesc || "레일", `${calc.floorGapVal || 0}cm`,
                calc.actualCurtainHeight || c.height,
                methodDesc, optText, qtyVal, fab.unit || "", fab.price || 0,
                calc.calcType === 'hebe' ? '미적용' : `${c.hwName} (${calc.numJa}자)`,
                calc.curtainSubtotal || 0
            ]);
        });
    });
    return out;
}

function generateDoc(type) {
    if (blockIfNoFabric()) return;
    calculateAll();
    const custName = document.getElementById('custName').value || "고객";
    const textarea = document.getElementById('outputDoc');

    const today = new Date();
    const dateStr = localYmd(today);      // 날짜 글자는 한 곳에서 (130-1번)

    const tv = docTotals();      // 서류·CSV 합계는 한 곳에서 (130-1번)
    const sellingPriceVal = tv.sellingPrice;
    const vatAmountVal = tv.vatAmount;
    const finalPriceVal = tv.finalPrice;

    const buildRoomSummaries = (isFactory) => rooms.map((r, i) => {
        let curtainLines = r.curtains.map((c) => {
            const calc = c.calc || {};
            const fab = FABRIC_DB.find(f => f.id === c.fabricId) || {};
            const fabDisplayName = docFabName(calc, fab, isFactory, c);
            const optionsList = [];
            if (c.shapeFee > 0) optionsList.push("형상기억");
            if (c.leadBand) optionsList.push("리드밴드");
            const optionsStr = optionsList.length > 0 ? optionsList.join(', ') : '기본';
            const gapStr = (calc.floorGapVal > 0 ? `+${calc.floorGapVal}` : calc.floorGapVal) + "cm";
            const methodDesc = calc.calcType === 'width' ? '폭당 완제품' : (calc.isSeamless ? '대폭 무이음' : '소폭 이음제작');

            return `    └ ${c.label}\n` +
                   `      • 실측규격: 가로 ${c.width}cm x 세로 ${c.height}cm\n` +
                   `      • 제작규격: 가로 ${c.width}cm x 세로 ${calc.actualCurtainHeight || c.height}cm [${calc.installDesc}, 바닥:${gapStr}]\n` +
                   `      • 원단/방식: [${calc.fabBook}] ${fabDisplayName} (${methodDesc}, ${c.pleat === 'panel' ? '판넬' : c.pleat + '배'})\n` +
                   `      • 가공옵션: ${optionsStr}\n` +
                   `      • 산출수량: ${calc.qtyText}\n` +
                   `      • 부자재: ${calc.calcType === "hebe" ? "미적용" : (c.hwName + " (" + calc.numJa + "자)")}`;      // 157번: 공장 발주서엔 금액을 적지 않음
        }).join('\n');

        return `[${i+1}. ${r.name}] (총 ${r.curtains.length}개)\n${curtainLines}`;      // 157번: 공간 소계 줄 뺌 (발주서에 금액 없음)
    }).join('\n\n');

    setTimeout(() => {
        if (type === 'factory') {
            textarea.value = `[공장 통합 발주서]\n• 발주일자: ${dateStr}\n• 현장/고객명: ${custName} 님\n----------------------------------------\n\n${buildRoomSummaries(true)}\n\n----------------------------------------\n※ 모든 커튼 세로 제작 치수는 기구 차감 및 바닥 간격 조정이 반영된 최종 완제품 치수임.`;
        } else if (type === 'kakao') {
            // 손님에게 보내는 글은 견적서의 [카톡 글 복사]와 같은 글 (62번): 책자 이름·공장용 말 대신 색 이름 · 재질
            textarea.value = ticketKakaoText();
        } else if (type === 'sheet') {
            // 공장 발주 표 줄은 CSV와 한 곳에서 (130-1번)
            let rows = [DOC_ORDER_HEADERS.join('\t')];
            docOrderRows(dateStr, custName).forEach(row => rows.push(row.join('\t')));

            if (typeof lightStandOf === 'function' && lightStandOf().on) rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "빛 (조명·설치)", lightStandOf().total].join('\t'));      // 131번
            rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "전체 시공비", globalInstallFee].join('\t'));
            rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "최종 금액", finalPriceVal].join('\t'));
            textarea.value = rows.join('\n');
        } else if (type === 'ledger') {
            const headers = ["일자", "고객명", "공간수", "창문수", "대표품목", "판매가", "부가세", "최종금액", "시공비", "VAT구분"];
            let firstCurtain = (rooms[0] && rooms[0].curtains[0]);
            let firstItem = "커튼";
            if (firstCurtain && firstCurtain.calc) {
                const fFab = FABRIC_DB.find(f => f.id === firstCurtain.fabricId) || {};
                firstItem = docFabName(firstCurtain.calc, fFab, true, firstCurtain);
            }
            let totalCount = rooms.reduce((acc, curr) => acc + curr.curtains.length, 0);

            const ledgerRow = [
                dateStr, custName, `${rooms.length}개`, `${totalCount}개`,
                totalCount > 1 ? `${firstItem} 외 ${totalCount-1}건` : firstItem,
                sellingPriceVal, vatAmountVal, finalPriceVal, globalInstallFee,
                globalVatOption === 'business' ? '세금계산서' : '일반'
            ].join('\t');

            textarea.value = `${headers.join('\t')}\n${ledgerRow}`;
        }
    }, 100);
}

function downloadCsvFile() {
    if (blockIfNoFabric()) return;
    calculateAll();
    const custName = (document.getElementById('custName').value || "고객").trim();
    const today = new Date();
    const dateStr = localYmd(today);      // 날짜 글자는 한 곳에서 (130-1번)
    const fileDateStr = dateStr.replace(/-/g, '');

    const tc = docTotals();      // 서류·CSV 합계는 한 곳에서 (130-1번)
    const sellingPrice = tc.sellingPrice;
    const vatAmount = tc.vatAmount;
    const finalPrice = tc.finalPrice;

    const escapeCsv = (val) => {
        const s = String(val ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csvContent = '\uFEFF' + DOC_ORDER_HEADERS.map(escapeCsv).join(',') + '\r\n';

    docOrderRows(dateStr, custName).forEach(row => { csvContent += row.map(escapeCsv).join(',') + '\r\n'; });      // 시트와 한 곳에서 (130-1번)

    if (typeof lightStandOf === 'function' && lightStandOf().on) csvContent += ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "빛 (조명·설치)", lightStandOf().total].map(escapeCsv).join(',') + '\r\n';      // 131번
    csvContent += ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "전체 시공비", globalInstallFee].map(escapeCsv).join(',') + '\r\n';
    csvContent += ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "최종 금액", finalPrice].map(escapeCsv).join(',') + '\r\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${custName}_견적_${fileDateStr}.csv`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("CSV 파일이 다운로드되었습니다.");
}
