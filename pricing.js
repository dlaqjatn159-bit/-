(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['pricing.js']='20261049';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
/* ==========================================================================
   Re.dam 판매가 계산 엔진  (pricing.js)
   - 고객 화면(C)과 직원 화면(B)이 "같은 계산식"을 쓰도록 하나로 통합한 파일입니다.
   - 판매가만 다룹니다. 원가·마진·공급처 정보는 이 파일에 없습니다.
   - 화면(DOM)과 무관한 순수 계산이라 자동 테스트가 가능합니다.
   ========================================================================== */
(function (root) {
    'use strict';

    // 소폭 이음 제작 시 가장 왼쪽·오른쪽 끝단 시접분의 합 (cm) — 사장님 확인값
    const SEAM_SIDE_ALLOWANCE = 30;

    // 설치 기구별 가로 차감 후 제작 세로 보정값 (cm)
    function heightDeduction(installType) {
        if (installType === 'rod35') return 10;
        if (installType === 'rod25') return 9;
        return 3;
    }

    // 호텔핏 추가분 단가: 가져오기 단계에서 미리 계산해 fab.extra 에 저장해 둔 판매 단가를 사용
    // (w: 폭당 / ys: 대폭 무이음 마당 / yj: 소폭 이음 마당). 정보가 없으면 기본 판매 단가와 동일하게 처리.
    function extraUnit(fab, kind) {
        const e = fab && fab.extra;
        if (e && typeof e[kind] === 'number') return e[kind];
        return (fab && fab.price) || 0;
    }

    function pickFabric(db, fabricId) {
        if (typeof sampleBlindFabric === 'function' && sampleBlindFabric(fabricId)) return sampleBlindFabric(fabricId);
        if (!Array.isArray(db)) return {};
        return db.find(f => f.id === fabricId) || db[0] || {};
    }

    /**
     * 커튼/블라인드 1개 품목의 판매가 계산
     * @param c   품목 { width, height, pleat, pleatType, installType, floorGap, hotelFit, leadBand, shapeFee, hwPrice, label, rates }
     *            rates: 품목을 만들 때 적어 둔 가공·부자재 단가(29번). 없으면(예전 저장본) 예전 계산 그대로
     *            shapeFee: 0보다 크면 형상기억 켜짐 (rates가 없는 예전 저장본은 폭당 금액이기도 함)
     * @param fab 원단 { calcType, specCm, price, extra, categoryType, name, book }
     */
    function priceItem(c, fab) {
        fab = fab || {};
        const r = (c.rates && typeof c.rates === 'object') ? c.rates : null;
        const rn = v => Number(v) || 0;
        const byWidth = fab.calcType === 'width';      // 폭당 원단은 폭 수 × 폭당 단가, 마당 원단(대폭 무이음·소폭 이음)은 마 수 × 마당 단가
        const width = c.width || 0;
        const height = c.height || 0;
        const label = c.label || '';
        const numJa = Math.ceil(width / 30);

        let fabricSellingCost = 0, hwSellingTotal = 0, leadBandCost = 0;
        let qtyText = '', numWidths = 0, totalYards = 0, appliedHebe = 0;
        let isSeamless = false, isPanel = false, panelExtraUnits = 0;
        let actualH = height;
        let isSheer = false, isWideFabric = false;
        const q = {};   // 원가 계산이 참고하는 수량 정보 (금액 아님)

        if (fab.calcType === 'hebe') {
            const widthM = width / 100;
            const heightM = height / 100;
            const consumerH = Math.max(1.5, heightM);
            const consumerRawHebe = Math.round(widthM * consumerH * 100) / 100;
            appliedHebe = Math.max(2.0, consumerRawHebe);
            fabricSellingCost = Math.round(appliedHebe * (fab.price || 0));
            qtyText = `${appliedHebe.toFixed(2)}m² (${appliedHebe}헤베)`;
            q.widthM = widthM; q.heightM = heightM;
        } else {
            const deduction = heightDeduction(c.installType);
            const floorGapVal = parseFloat(c.floorGap) || 0;
            actualH = Math.max(0, height - deduction + floorGapVal);
            const hemAllowance = c.leadBand ? 15 : 30;
            const requiredH = actualH + hemAllowance;

            const fabricSpec = fab.specCm || 150;
            isWideFabric = (fabricSpec >= 200);
            isSheer = (fab.categoryType === '속지' || label.includes('속지') || (fab.name && fab.name.includes('쉬폰')));

            if (c.pleat === 'panel' || c.pleatType === '패널' || c.pleatType === '판넬') {   // '판넬'은 예전 저장본 호환용
                isPanel = true;
                const extraWidth = Math.max(0, width - 90);
                panelExtraUnits = Math.ceil(extraWidth / 30);
                const panelConsumerLabor = r ? rn(r.panelBase) + (panelExtraUnits * rn(r.panelStep)) : 50000 + (panelExtraUnits * 15000);

                totalYards = Math.ceil((width + 20) / 90) || 1;
                numWidths = Math.ceil(width / fabricSpec) || 1;
                fabricSellingCost = Math.round(totalYards * (fab.price || 0)) + panelConsumerLabor;
                qtyText = `패널 제작 (가로:${c.width}cm/높이:${actualH}cm)`;
            } else {
                const pleatVal = parseFloat(c.pleat) || 2.0;
                const totalW = width * pleatVal;

                if (fab.calcType === 'width') {
                    const baseWidths = Math.ceil(totalW / fabricSpec) || 1;
                    const extraWidths = c.hotelFit ? 1 : 0;
                    numWidths = baseWidths + extraWidths;
                    totalYards = numWidths;
                    fabricSellingCost = (baseWidths * (fab.price || 0)) + (extraWidths * extraUnit(fab, 'w'));
                    qtyText = c.hotelFit
                        ? `${numWidths}폭 (호텔핏 +1폭 적용·높이:${actualH}cm)`
                        : `${numWidths}폭 (폭당제작·높이:${actualH}cm)`;
                } else {
                    isSeamless = (fabricSpec > 0) && (fabricSpec >= requiredH);
                    if (isSeamless) {
                        const extraYards = c.hotelFit ? 2 : 0;
                        const baseYards = Math.ceil((totalW + 30) / 90) || 1;
                        totalYards = baseYards + extraYards;
                        numWidths = Math.ceil(totalW / 150) || 1;
                        fabricSellingCost = (baseYards * (fab.price || 0)) + (extraYards * extraUnit(fab, 'ys'));
                        qtyText = c.hotelFit
                            ? `${totalYards}마 (호텔핏 무이음·높이:${actualH}cm)`
                            : `${totalYards}마 (무이음·높이:${actualH}cm)`;
                    } else {
                        const baseWidths = Math.ceil((totalW + SEAM_SIDE_ALLOWANCE) / fabricSpec) || 1;   // 양끝 시접분 포함
                        const extraWidths = c.hotelFit ? 1 : 0;
                        numWidths = baseWidths + extraWidths;
                        const yardsPerWidth = Math.ceil((actualH + 30) / 90);
                        const baseYards = baseWidths * yardsPerWidth;
                        const extraYards = extraWidths * yardsPerWidth;
                        totalYards = baseYards + extraYards;
                        fabricSellingCost = (baseYards * (fab.price || 0)) + (extraYards * extraUnit(fab, 'yj'));
                        qtyText = c.hotelFit
                            ? `${numWidths}폭(${totalYards}마·호텔핏 이음)`
                            : `${numWidths}폭(${totalYards}마·이음제작)`;
                    }
                }
            }

            leadBandCost = c.leadBand ? (totalYards * (r ? rn(byWidth ? r.leadW : r.leadY) : 1000)) : 0;      // 폭당 원단은 마 수 = 폭 수
            const railSellingPrice = (c.hwPrice !== undefined) ? c.hwPrice : 1000;
            hwSellingTotal = numJa * railSellingPrice;
        }

        // 형상기억: rates가 있으면 폭당·마당 따로 + 제작 높이가 기준 이상이면 단위마다 추가 (패널·블라인드는 없음)
        let extraShapeFee = 0, shapeUnits = 0, shapeHigh = false;
        if (fab.calcType !== 'hebe' && c.shapeFee > 0) {
            if (r) {
                if (!isPanel) {
                    shapeUnits = byWidth ? numWidths : totalYards;
                    shapeHigh = rn(r.shapeH) > 0 && actualH >= rn(r.shapeH);
                    extraShapeFee = shapeUnits * (rn(byWidth ? r.shapeW : r.shapeY) + (shapeHigh ? rn(byWidth ? r.shapeHW : r.shapeHY) : 0));
                }
            } else {
                shapeUnits = numWidths;
                extraShapeFee = numWidths * c.shapeFee;
            }
        }
        const rawSubtotal = fabricSellingCost + extraShapeFee + leadBandCost + hwSellingTotal;
        const curtainSubtotal = Math.ceil(rawSubtotal / 1000) * 1000;

        Object.assign(q, { isPanel, panelExtraUnits, isSheer, isWideFabric, numWidths, totalYards, numJa, calcType: fab.calcType, shapeUnits, shapeHigh });

        return {
            fabName: fab.name, fabBook: fab.book, calcType: fab.calcType,
            numWidths, totalYards, appliedHebe, qtyText,
            curtainSubtotal, numJa, leadBandCost,
            actualCurtainHeight: actualH,
            installDesc: c.hwName || '레일',
            floorGapVal: parseFloat(c.floorGap) || 0,
            isSeamless,
            q
        };
    }

    // 전체 합계 (시공비 포함, 천원 단위 올림, 부가세 옵션)
    function totals(roomSubtotalSum, installFee, vatOption) {
        const sellingPrice = Math.ceil((roomSubtotalSum + installFee) / 1000) * 1000;
        const vatAmount = (vatOption === 'business') ? Math.ceil((sellingPrice * 0.1) / 1000) * 1000 : 0;
        return { sellingPrice, vatAmount, finalPrice: sellingPrice + vatAmount };
    }

    const api = { priceItem, totals, pickFabric, heightDeduction };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Pricing = api;
})(typeof window !== 'undefined' ? window : globalThis);
