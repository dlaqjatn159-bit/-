(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['costing.js']='20261050';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
/* ==========================================================================
   Re.dam 원가 계산 엔진  (costing.js)  ※ 직원 모드 전용
   - 이 파일에는 금액(숫자 상수)이 없습니다. 모든 원가 규칙은 "비공개 팩"에서 읽어옵니다.
   - 비공개 팩이 없으면 enabled=false 로 동작하고 원가/마진은 계산하지 않습니다.
   ========================================================================== */
(function (root) {
    'use strict';

    const state = { enabled: false, rules: null, costs: {} };

    function setPrivate(pack) {
        state.rules = (pack && pack.rules) || null;
        state.costs = (pack && pack.costs) || {};
    }
    function hasData() { return !!state.rules; }
    function costOf(fabId) { return state.costs[fabId] || null; }

    function supplierRule(supplier) {
        const list = (state.rules && state.rules.suppliers) || [];
        const s = String(supplier || '');
        return list.find(r => r.match && s.includes(r.match)) || {};
    }

    /** 품목 1개의 원가. priced = Pricing.priceItem 결과, fab = 원단(공개 정보) */
    function costItem(c, fab, priced) {
        const rules = state.rules;
        const pv = costOf(fab && fab.id);
        if (!rules || !pv) return null;

        const q = priced.q;
        // 품목을 만들 때 적어 둔 가공·부자재 원가 (29번). 없거나 칸이 비면(예전 저장본) 비공개 팩 규칙 그대로
        const rc = (c.rates && c.rates.cost && typeof c.rates.cost === 'object') ? c.rates.cost : {};
        const has = v => typeof v === 'number' && Number.isFinite(v);
        const cost = pv.cost || 0;
        const laborUnit = pv.labor || 0;
        const rule = supplierRule(pv.supplier);
        const fMult = rule.fabricMult || 1;
        const lMult = rule.laborMult || 1;
        let fabricSupplyCost = 0, laborCost = 0, hwCost = 0, factoryHebe = 0;

        if (q.calcType === 'hebe') {
            const h = rule.hebe || rules.hebeDefault;
            const heightForCalc = h.minHeight ? Math.max(h.minHeight, q.heightM) : q.heightM;
            const raw = q.widthM * heightForCalc;
            factoryHebe = Math.max(2.0, Math.round(raw * h.roundTo) / h.roundTo);
            fabricSupplyCost = Math.round(factoryHebe * cost * (h.costMult || 1));
        } else {
            const yards = q.totalYards, widths = q.numWidths;
            if (q.isPanel) {
                const pf = has(rc.panelBase) ? { base: rc.panelBase, perExtraUnit: has(rc.panelStep) ? rc.panelStep : 0 } : rules.panelFactory;
                const panelFactoryCost = pf.base + (q.panelExtraUnits * pf.perExtraUnit);
                fabricSupplyCost = Math.round(yards * cost * fMult);
                laborCost = Math.round(panelFactoryCost * lMult);
                if (lMult === 1) laborCost = panelFactoryCost;
            } else if (q.calcType === 'width') {
                if (rule.noLabor) {
                    fabricSupplyCost = widths * cost; laborCost = 0;
                } else if (rule.fixedLabor) {
                    fabricSupplyCost = Math.round(widths * cost * fMult);
                    laborCost = Math.round(widths * rule.fixedLabor.perWidth * lMult);
                } else {
                    fabricSupplyCost = widths * cost;
                    laborCost = widths * laborUnit;
                }
            } else {
                if (rule.fixedLabor) {
                    const unitLabor = (q.isSheer || q.isWideFabric)
                        ? yards * rule.fixedLabor.perYardSheerOrWide
                        : widths * rule.fixedLabor.perWidth;
                    fabricSupplyCost = Math.round(yards * cost * fMult);
                    laborCost = Math.round(unitLabor * lMult);
                } else if (rule.noLabor) {
                    fabricSupplyCost = Math.round(yards * cost); laborCost = 0;
                } else {
                    fabricSupplyCost = Math.round(yards * cost);
                    laborCost = Math.round(yards * laborUnit);
                }
            }
            if (has(rc.hw)) {
                hwCost = Math.round(q.numJa * rc.hw);      // 설정 칸의 자당 원가 그대로 (패널 레일 배수는 이미 들어 있음)
            } else {
                const hwTable = rules.hardwareCost || {};
                const railCostPrice = (hwTable[c.installType] !== undefined) ? hwTable[c.installType] : (hwTable.rail || 0);
                const special = (c.installType === 'rail_2line' || c.installType === 'rail_3line');
                hwCost = Math.round(q.numJa * railCostPrice * (special ? rules.specialRailMult : 1));
            }
            // 형상기억 가공비 원가: 판매가와 같은 단위(폭당 원단은 폭 수, 마당 원단은 마 수) × 원가 (+ 높이 추가 원가) → 가공비에 더함
            if (q.shapeUnits && c.rates) {
                const byWidth = q.calcType === 'width';
                const unit = (has(byWidth ? rc.shapeW : rc.shapeY) ? (byWidth ? rc.shapeW : rc.shapeY) : 0)
                    + (q.shapeHigh ? (has(byWidth ? rc.shapeHW : rc.shapeHY) ? (byWidth ? rc.shapeHW : rc.shapeHY) : 0) : 0);
                laborCost += Math.round(q.shapeUnits * unit);
            }
        }

        const leadBandCost = priced.leadBandCost;   // 리드밴드는 원가=판매가로 취급(기존 동일)
        const curtainCostTotal = fabricSupplyCost + laborCost + leadBandCost + hwCost;
        return { fabricSupplyCost, laborCost, hwCost, leadBandCost, curtainCostTotal, factoryHebe };
    }

    /** 가져오기 단계에서 호텔핏 추가분 판매 단가를 계산 (결과는 공개 데이터 fab.extra 로 저장됨) */
    function deriveExtra(cost, labor, rules) {
        const r = (rules && rules.extraPrice);
        if (!r) return undefined;
        const calc = (k) => Math.round((cost || k.costDefault) * k.costMult + (labor || k.laborDefault) + k.add);
        return { w: calc(r.width), ys: calc(r.yardSeamless), yj: calc(r.yardSeam) };
    }

    /** 판매 단가가 시트에 없을 때 도매가 기준 배수로 산정 */
    function derivePrice(cost, labor, calcType, rules) {
        const m = rules && rules.priceMultipliers;
        if (!m) return 0;
        const base = (cost || 0) + (labor || 0);
        let mult;
        if (calcType === 'width') mult = m.width;
        else {
            const tier = m.yardTiers.find(t => base <= t.upTo);
            mult = tier ? tier.mult : m.yardTop;
        }
        return Math.ceil((base * mult) / 1000) * 1000;
    }

    const api = { state, setPrivate, hasData, costOf, costItem, deriveExtra, derivePrice, supplierRule };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    root.Costing = api;
})(typeof window !== 'undefined' ? window : globalThis);
