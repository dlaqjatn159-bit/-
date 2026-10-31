(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['calculator.js']='20261165';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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
    const summaryListContainer = document.getElementById('summaryRoomList');
    if (summaryListContainer) summaryListContainer.innerHTML = '';

    rooms.forEach(room => {
        let roomSubtotalSum = 0;

        room.curtains.forEach(c => {
            const fab = Pricing.pickFabric(FABRIC_DB, c.fabricId);
            const p = Pricing.priceItem(c, fab);
            if (p.noFabric) noFabCount++;
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

    const t = Pricing.totals(grandSubtotal, globalInstallFee, globalVatOption);
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
        const finalCostWithInstall = grandCostTotal + globalInstallFee;
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

// 서류·CSV 합계: 품목 금액을 더해 판매가·부가세·최종금액 (127번 Pricing.totals, 130-1번에서 두 곳을 하나로)
function docTotals() {
    let sum = 0;
    rooms.forEach(r => r.curtains.forEach(c => { if (c.calc) sum += c.calc.curtainSubtotal || 0; }));
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
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
                   `      • 부자재: ${calc.calcType === "hebe" ? "미적용" : (c.hwName + " (" + calc.numJa + "자)")}\n` +
                   `      • 판매금액: ${(calc.curtainSubtotal||0).toLocaleString()}원`;
        }).join('\n');

        const roomSum = r.curtains.reduce((acc, curr) => acc + (curr.calc ? curr.calc.curtainSubtotal : 0), 0);
        return `[${i+1}. ${r.name}] (총 ${r.curtains.length}개)\n${curtainLines}\n▶ ${r.name} 소계: ${roomSum.toLocaleString()}원`;
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
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const fileDateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

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
