(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['calculator.js']='20261059';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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

    const summaryListContainer = document.getElementById('summaryRoomList');
    if (summaryListContainer) summaryListContainer.innerHTML = '';

    rooms.forEach(room => {
        let roomSubtotalSum = 0;

        room.curtains.forEach(c => {
            const fab = Pricing.pickFabric(FABRIC_DB, c.fabricId);
            const p = Pricing.priceItem(c, fab);
            const cost = staff ? Costing.costItem(c, fab, p) : null;

            c.calc = {
                fabName: (p.fabName || '') + (typeof colorSuffix === 'function' ? colorSuffix(c.colorName, c.fabricId) : ''), fabBook: p.fabBook, calcType: p.calcType,
                colorName: c.colorName || '',
                numWidths: p.numWidths, totalYards: p.totalYards, appliedHebe: p.appliedHebe, qtyText: p.qtyText,
                curtainSubtotal: p.curtainSubtotal, numJa: p.numJa, leadBandCost: p.leadBandCost,
                actualCurtainHeight: p.actualCurtainHeight,
                installDesc: p.installDesc,
                floorGapVal: p.floorGapVal,
                isSeamless: p.isSeamless
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

            roomSubtotalSum += p.curtainSubtotal;

            const qtyEl = document.getElementById(`curtainQty_${c.id}`);
            const subEl = document.getElementById(`curtainSub_${c.id}`);
            if (qtyEl) qtyEl.textContent = c.calc.qtyText;
            if (subEl) subEl.textContent = `${p.curtainSubtotal.toLocaleString()}원`;
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
    } else {
        // 고객 모드이거나 원가 데이터가 없으면 원가 칸을 비워 둡니다.
        ['resTotalCost', 'resNetProfit', 'resMarginRateBadge', 'resCostFabric', 'resCostLabor', 'resCostHardware']
            .forEach(id => setText(id, '-'));
    }
}

// ==============================================================
// DOCUMENT GENERATORS & CSV EXPORT
// ==============================================================
function generateDoc(type) {
    calculateAll();
    const custName = document.getElementById('custName').value || "고객";
    const textarea = document.getElementById('outputDoc');
    const totalGrandPriceText = document.getElementById('totalGrandPrice').textContent;
    const subtotalText = document.getElementById('resGrandSubtotal').textContent;
    const vatText = document.getElementById('resGrandVat').textContent;

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let grandSubtotalVal = 0;
    rooms.forEach(r => {
        r.curtains.forEach(c => {
            if (c.calc) grandSubtotalVal += c.calc.curtainSubtotal || 0;
        });
    });
    const sellingPriceVal = Math.ceil((grandSubtotalVal + globalInstallFee) / 1000) * 1000;
    const vatAmountVal = globalVatOption === 'business' ? Math.ceil((sellingPriceVal * 0.1) / 1000) * 1000 : 0;
    const finalPriceVal = sellingPriceVal + vatAmountVal;

    let roomSummaries = rooms.map((r, i) => {
        let curtainLines = r.curtains.map((c) => {
            const calc = c.calc || {};
            const optionsList = [];
            if (c.shapeFee > 0) optionsList.push("형상기억");
            if (c.leadBand) optionsList.push("리드밴드");
            const optionsStr = optionsList.length > 0 ? optionsList.join(', ') : '기본';
            const gapStr = (calc.floorGapVal > 0 ? `+${calc.floorGapVal}` : calc.floorGapVal) + "cm";
            const methodDesc = calc.calcType === 'width' ? '폭당 완제품' : (calc.isSeamless ? '대폭 무이음' : '소폭 이음제작');

            return `    └ ${c.label}\n` +
                   `      • 실측규격: 가로 ${c.width}cm x 세로 ${c.height}cm\n` +
                   `      • 제작규격: 가로 ${c.width}cm x 세로 ${calc.actualCurtainHeight || c.height}cm [${calc.installDesc}, 바닥:${gapStr}]\n` +
                   `      • 원단/방식: [${calc.fabBook}] ${calc.fabName} (${methodDesc}, ${c.pleat === 'panel' ? '판넬' : c.pleat + '배'})\n` +
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
            textarea.value = `[공장 통합 발주서]\n• 발주일자: ${dateStr}\n• 현장/고객명: ${custName} 님\n----------------------------------------\n\n${roomSummaries}\n\n----------------------------------------\n※ 모든 커튼 세로 제작 치수는 기구 차감 및 바닥 간격 조정이 반영된 최종 완제품 치수임.`;
        } else if (type === 'kakao') {
            const vatDesc = globalVatOption === 'business' 
                ? `• 부가세 (VAT 10%): ${vatText}원 (세금계산서 발행)\n` 
                : `• 부가세: 0원 (일반 소비자 판매가)\n`;

            textarea.value = `안녕하세요 ${custName} 고객님! 요청하신 커튼 & 블라인드 맞춤 견적 안내드립니다.\n\n` +
                `[견적 상세 내역]\n\n${roomSummaries}\n\n` +
                `----------------------------------------\n` +
                `• 전체 시공/출장비: ${globalInstallFee.toLocaleString()}원\n` +
                `• 판매가 (시공비 포함): ${subtotalText}원\n` +
                `${vatDesc}` +
                `• 최종 금액: ${totalGrandPriceText}원\n` +
                `----------------------------------------\n` +
                `감사합니다!`;
        } else if (type === 'sheet') {
            const headers = ["일자", "고객명", "공간", "항목", "샘플북", "품목명", "실측가로", "실측세로", "설치방식", "바닥간격", "제작세로", "가공방식", "옵션", "수량", "단위", "단가", "부자재", "판매금액"];
            let rows = [headers.join('\t')];

            rooms.forEach(r => {
                r.curtains.forEach(c => {
                    const calc = c.calc || {};
                    const fab = FABRIC_DB.find(f => f.id === c.fabricId) || {};
                    const qtyVal = calc.calcType === 'hebe' ? calc.appliedHebe : (calc.calcType === 'width' ? calc.numWidths : calc.totalYards);
                    const optText = `${c.shapeFee > 0 ? '형상 ' : ''}${c.leadBand ? '리드밴드' : ''}`.trim() || '기본';
                    const methodDesc = calc.calcType === 'hebe' ? '블라인드' : (calc.calcType === 'width' ? '폭당완제품' : (calc.isSeamless ? '대폭무이음' : '소폭이음'));

                    rows.push([
                        dateStr, custName, r.name, c.label, calc.fabBook || "", calc.fabName || "",
                        c.width, c.height, calc.installDesc || "레일", `${calc.floorGapVal || 0}cm`,
                        calc.actualCurtainHeight || c.height,
                        methodDesc, optText, qtyVal, fab.unit || "", fab.price || 0,
                        calc.calcType === 'hebe' ? '미적용' : `${c.hwName} (${calc.numJa}자)`,
                        calc.curtainSubtotal || 0
                    ].join('\t'));
                });
            });

            rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "전체 시공비", globalInstallFee].join('\t'));
            rows.push(["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "최종 금액", finalPriceVal].join('\t'));
            textarea.value = rows.join('\n');
        } else if (type === 'ledger') {
            const headers = ["일자", "고객명", "공간수", "창문수", "대표품목", "판매가", "부가세", "최종금액", "시공비", "VAT구분"];
            let firstItem = (rooms[0] && rooms[0].curtains[0] && rooms[0].curtains[0].calc) ? rooms[0].curtains[0].calc.fabName : "커튼";
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
    calculateAll();
    const custName = (document.getElementById('custName').value || "고객").trim();
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const fileDateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    let grandSubtotal = 0;
    rooms.forEach(r => {
        r.curtains.forEach(c => {
            if (c.calc) grandSubtotal += c.calc.curtainSubtotal || 0;
        });
    });
    const sellingPrice = Math.ceil((grandSubtotal + globalInstallFee) / 1000) * 1000;
    const vatAmount = globalVatOption === 'business' ? Math.ceil((sellingPrice * 0.1) / 1000) * 1000 : 0;
    const finalPrice = sellingPrice + vatAmount;

    const headers = ["일자", "고객명", "공간", "항목", "샘플북", "품목명", "실측가로", "실측세로", "설치방식", "바닥간격", "제작세로", "가공방식", "옵션", "수량", "단위", "단가", "부자재", "판매금액"];
    const escapeCsv = (val) => {
        const s = String(val ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csvContent = '\uFEFF' + headers.map(escapeCsv).join(',') + '\r\n';

    rooms.forEach(r => {
        r.curtains.forEach(c => {
            const calc = c.calc || {};
            const fab = FABRIC_DB.find(f => f.id === c.fabricId) || {};
            const qtyVal = calc.calcType === 'hebe' ? calc.appliedHebe : (calc.calcType === 'width' ? calc.numWidths : calc.totalYards);
            const optText = `${c.shapeFee > 0 ? '형상 ' : ''}${c.leadBand ? '리드밴드' : ''}`.trim() || '기본';
            const methodDesc = calc.calcType === 'hebe' ? '블라인드' : (calc.calcType === 'width' ? '폭당완제품' : (calc.isSeamless ? '대폭무이음' : '소폭이음'));

            const row = [
                dateStr, custName, r.name, c.label, calc.fabBook || "", calc.fabName || "",
                c.width, c.height, calc.installDesc || "레일", `${calc.floorGapVal || 0}cm`,
                calc.actualCurtainHeight || c.height,
                methodDesc, optText, qtyVal, fab.unit || "", fab.price || 0,
                calc.calcType === 'hebe' ? '미적용' : `${c.hwName} (${calc.numJa}자)`,
                calc.curtainSubtotal || 0
            ];
            csvContent += row.map(escapeCsv).join(',') + '\r\n';
        });
    });

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
