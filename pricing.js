(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['pricing.js']='20261265';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
/* ==========================================================================
   Re.dam 판매가 계산 엔진  (pricing.js)
   - 고객 화면(C)과 직원 화면(B)이 "같은 계산식"을 쓰도록 하나로 통합한 파일입니다.
   - 판매가만 다룹니다. 원가·마진·공급처 정보는 이 파일에 없습니다.
   - 화면(DOM)과 무관한 순수 계산이라 자동 테스트가 가능합니다.
   ========================================================================== */
(function (root) {
    'use strict';

    // 212번: 소폭 이음 원단도 폭 수는 폭당 원단처럼 가로 × 주름 ÷ 원단 폭 (양끝 시접분을 따로 더하지 않음 — 사장님 결정 11-10)

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
        if (!Array.isArray(db)) return null;
        return db.find(f => f.id === fabricId) || null;      // 못 찾으면 첫 원단 대신 "없음" (126번)
    }

    /**
     * 커튼/블라인드 1개 품목의 판매가 계산
     * @param c   품목 { width, height, pleat, pleatType, installType, floorGap, hotelFit, leadBand, shapeFee, hwPrice, label, rates }
     *            rates: 품목을 만들 때 적어 둔 가공·부자재 단가(29번). 없으면(예전 저장본) 예전 계산 그대로
     *            shapeFee: 0보다 크면 형상기억 켜짐 (rates가 없는 예전 저장본은 폭당 금액이기도 함)
     * @param fab 원단 { calcType, specCm, price, extra, categoryType, name, book }
     */
    // 216번: 블라인드 여러 장 — 품목 c.panes = [{ w, h, hand, qty }] (w·h가 null이면 품목 전체 가로·세로를 따름, 0이면 아직 안 넣은 줄)
    //   panes가 없으면 한 장(전체 크기). 손잡이 기본은 '우' — 바꿀 땐 PANE_HAND_DEFAULT 한 곳만
    const PANE_HAND_DEFAULT = 'R';
    function panesOf(c) {
        const src = (c && Array.isArray(c.panes) && c.panes.length) ? c.panes : [{}];
        return src.map(p => ({
            w: (p && p.w != null && p.w !== '') ? (Number(p.w) || 0) : null,
            h: (p && p.h != null && p.h !== '') ? (Number(p.h) || 0) : null,
            hand: (p && (p.hand === 'L' || p.hand === 'R')) ? p.hand : PANE_HAND_DEFAULT,
            qty: Math.max(1, Math.min(99, parseInt(p && p.qty, 10) || 1))
        }));
    }
    // 장 하나씩 풀어서 (금액·발주서용): [{ w, h, hand, row }] — 가로나 세로가 0인 장(아직 안 넣은 줄)은 뺌
    function panePieces(c) {
        const W = Number(c && c.width) || 0, H = Number(c && c.height) || 0, out = [];
        panesOf(c).forEach((p, row) => {
            const w = p.w == null ? W : p.w, h = p.h == null ? H : p.h;
            if (!(w > 0 && h > 0)) return;
            for (let k = 0; k < p.qty; k++) out.push({ w, h, hand: p.hand, row });
        });
        return out;
    }
    // 나눈 상태인지: 줄이 둘 이상이거나, 한 줄이라도 가로를 따로 넣었거나 여러 장(같은 창 6장 등). 손잡이만 바꾼 한 장은 나누기 전
    function paneSplit(panes) {
        if (!Array.isArray(panes) || !panes.length) return false;
        const p = panes[0] || {};
        return panes.length > 1 || (p.w != null && p.w !== '') || (parseInt(p.qty, 10) || 1) > 1;
    }
    // 저장할 때: 빈 줄(가로 0)은 빼고, 아무 줄도 없으면 null(= 한 장)
    function cleanPanes(panes) {
        if (!Array.isArray(panes) || !panes.length) return null;
        const rows = panesOf({ panes }).filter(p => p.w == null || p.w > 0);
        return rows.length ? rows : null;
    }

    function priceItem(c, fab) {
        if (!fab) {      // 원단을 못 찾은 품목: 다른 원단 값으로 셈하지 않고 금액 0 + 표시 (126번)
            return { noFabric: true, fabName: '', fabBook: '', calcType: '', numWidths: 0, totalYards: 0, appliedHebe: 0, qtyText: '원단 없음',
                curtainSubtotal: 0, numJa: 0, leadBandCost: 0, actualCurtainHeight: Number(c && c.height) || 0,
                installDesc: (c && c.hwName) || '레일', floorGapVal: parseFloat(c && c.floorGap) || 0, isSeamless: false, q: {} };
        }
        if (fab.sampleOnly && fab.calcType !== 'hebe') {      // 177번: 커튼 실물 견본 품목 — 원단을 고르기 전이라 원단·가공·레일 모두 0 (합계에서 빠지고 견적서엔 "실물 견본 품목 제외")
            return { noFabric: false, fabName: fab.name, fabBook: fab.book, calcType: fab.calcType, numWidths: 0, totalYards: 0, appliedHebe: 0, qtyText: '실물 견본',
                curtainSubtotal: 0, numJa: 0, leadBandCost: 0, actualCurtainHeight: Number(c && c.height) || 0,
                installDesc: (c && c.hwName) || '레일', floorGapVal: parseFloat(c && c.floorGap) || 0, isSeamless: false, q: {} };
        }
        const r = (c.rates && typeof c.rates === 'object') ? c.rates : null;
        const rn = v => Number(v) || 0;
        const byWidth = fab.calcType === 'width';      // 폭당 원단은 폭 수 × 폭당 단가, 마당 원단(대폭 무이음·소폭 이음)은 마 수 × 마당 단가
        const width = c.width || 0;
        const height = c.height || 0;
        const label = c.label || '';
        const numJa = Math.ceil(width / 30);

        let fabricSellingCost = 0, hwSellingTotal = 0, leadBandCost = 0;
        let qtyText = '', numWidths = 0, totalYards = 0, appliedHebe = 0;
        let pieces = null;      // 216번: 블라인드 장마다 [{ w, h, hand, row, hebe }] — 발주서가 씀
        let isSeamless = false, isPanel = false, panelExtraUnits = 0;
        let actualH = height;
        let isSheer = false, isWideFabric = false;
        const q = {};   // 원가 계산이 참고하는 수량 정보 (금액 아님)

        if (fab.calcType === 'hebe') {
            const widthM = width / 100;
            const heightM = height / 100;
            // 216번: 장마다 따로 셈해서 더함 (개당 최저 2헤베 · 최저 높이 1.5m가 장마다). 한 장이면 예전과 같은 셈
            const hebeOf = (wM, hM) => Math.max(2.0, Math.round(wM * Math.max(1.5, hM) * 100) / 100);
            const all = panePieces(c);
            const pcs = all.length ? all : [{ w: width, h: height, hand: panesOf(c)[0].hand, row: 0 }];
            pieces = pcs.map(p => ({ w: p.w, h: p.h, hand: p.hand, row: p.row, hebe: hebeOf(p.w / 100, p.h / 100) }));
            appliedHebe = pieces.length > 1 ? Math.round(pieces.reduce((s, p) => s + p.hebe, 0) * 100) / 100 : pieces[0].hebe;
            fabricSellingCost = pieces.reduce((s, p) => s + Math.round(p.hebe * (fab.price || 0)), 0);
            qtyText = pieces.length > 1
                ? `${pieces.length}장 · 합 ${appliedHebe.toFixed(2)}m² (${appliedHebe}헤베)`
                : `${appliedHebe.toFixed(2)}m² (${appliedHebe}헤베)`;
            q.widthM = widthM; q.heightM = heightM;
            q.pieces = pieces.map(p => ({ widthM: p.w / 100, heightM: p.h / 100 }));      // 원가도 장마다 (costing.js)
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
                        const baseWidths = Math.ceil(totalW / fabricSpec) || 1;      // 212번: 폭당 원단과 같은 셈
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
            pieces,
            q
        };
    }

    // 전체 합계 (시공비 포함, 천원 단위 올림, 부가세 옵션)
    function totals(roomSubtotalSum, installFee, vatOption) {
        const sellingPrice = Math.ceil((roomSubtotalSum + installFee) / 1000) * 1000;
        const vatAmount = (vatOption === 'business') ? Math.round(sellingPrice * 0.1) : 0;      // 정확히 10% (127번)
        return { sellingPrice, vatAmount, finalPrice: sellingPrice + vatAmount };
    }

    const api = { priceItem, totals, pickFabric, heightDeduction, panesOf, panePieces, cleanPanes, paneSplit, PANE_HAND_DEFAULT };      // 216번: 장 셈 도우미
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Pricing = api;
})(typeof window !== 'undefined' ? window : globalThis);
