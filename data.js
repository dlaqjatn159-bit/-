(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['data.js']='20261044';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// data.js — 데이터·저장·가져오기
//
// [중요] 이 파일(과 저장소 전체)에는 원가·마진·공급처 정보가 없습니다.
//  - 고객이 볼 수 있는 "공개 원단 정보"(판매 단가 등)만 FABRIC_DB 에 담깁니다.
//  - 원가·가공비·공급처·원가 규칙은 "비공개 보관함"(태블릿 브라우저 안)에만 저장됩니다.
// ==============================================================

const STORE_KEYS = {
    fabrics: 'redam_fabrics_v1',     // 공개 원단 정보(판매가)
    priv: 'redam_private_v1',        // 비공개: 원가 규칙 + 원단별 원가 (직원 모드에서만 사용)
    pin: 'redam_pin_v1',             // 직원 모드 PIN(해시)
    draft: 'redam_draft_v1',         // 작성 중인 상담 자동 저장
    history: 'redam_history_v1',     // 지난 상담 이력 (직원 모드에서만 열람)
    tags: 'redam_tags_v1',           // 사장님이 직접 지정한 원단 분류(언더톤·무드)
    colors: 'redam_colors_v1',       // 원단별 색상 번호와 색상별 톤
    installFee: 'redam_default_install_fee_v1',   // 새 상담에 들어가는 기본 시공·출장비 (직원 화면 설정)
    optionPrices: 'redam_option_prices_v1',      // 가공·부자재 단가(형상기억·리드밴드·레일·패널 가공비)와 그 원가 (직원 화면 설정, 29번)
    photoList: 'redam_photo_list_v1',  // 실제로 있는 원단 사진 주소 목록 (사진 확인 결과. 다음에 열 때 바로 쓰려고)
    legacy: 'curtain_fabric_db_v23'  // 구버전 앱이 남긴 데이터 (원가 포함 → 삭제 권장)
};

// 처음 설치했을 때 보이는 공개 샘플 원단 (판매가만 포함)
const SAMPLE_FABRICS = [
    {"book": "데미안", "id": "DAM_WIDE_01", "name": "데미안 B쉬폰 (대폭 297cm Y당)", "calcType": "yard", "specCm": 297, "unit": "마", "price": 14250, "categoryType": "속지", "tone": "warm", "mood": "soft_warm", "tags": ["#도톰차르르", "#오크마루조화", "#사생활보호"], "imageUrl": null, "extra": {"w": 13750, "ys": 13000, "yj": 12750}},
    {"book": "데미안", "id": "DAM_WIDTH_01", "name": "데미안 라온암막 (폭당)", "calcType": "width", "specCm": 150, "unit": "폭", "price": 44250, "categoryType": "겉지", "tone": "warm", "mood": "soft_warm", "tags": ["#호텔식도톰핏", "#완벽암막", "#오크아이보리추천"], "imageUrl": null, "extra": {"w": 38250, "ys": 38400, "yj": 37250}},
    {"book": "데미안", "id": "DAM_YARD_01", "name": "데미안 라온암막 (Y당)", "calcType": "yard", "specCm": 150, "unit": "마", "price": 14550, "categoryType": "겉지", "tone": "warm", "mood": "soft_warm", "tags": ["#내추럴베이지", "#생활암막", "#차분한분위기"], "imageUrl": null, "extra": {"w": 14125, "ys": 13410, "yj": 13125}},
    {"book": "포아", "id": "POA_01", "name": "차르르 쉬폰 화이트 (대폭 118인치/300cm Y당)", "calcType": "yard", "specCm": 300, "unit": "마", "price": 14250, "categoryType": "속지", "tone": "cool", "mood": "urban_clean", "tags": ["#화이트차르르", "#타일마루추천", "#깨끗한호텔핏"], "imageUrl": null, "extra": {"w": 13750, "ys": 13000, "yj": 12750}},
    {"book": "포아", "id": "POA_02", "name": "포아 헤비 암막 그레이지 (115인치 Y당)", "calcType": "yard", "specCm": 292, "unit": "마", "price": 21000, "categoryType": "겉지", "tone": "neutral", "mood": "balanced_neutral", "tags": ["#그레이지모던", "#무광풀달", "#브릿지톤온톤"], "imageUrl": null, "extra": {"w": 18750, "ys": 18200, "yj": 17750}},
    {"book": "코아", "id": "COA_01", "name": "도톰 슬러브 린넨룩 베이지 (60인치 Y당)", "calcType": "yard", "specCm": 152, "unit": "마", "price": 19500, "categoryType": "겉지", "tone": "warm", "mood": "textured_linen", "tags": ["#린넨텍스처", "#내추럴우드톤", "#은은한자연광"], "imageUrl": null, "extra": {"w": 18000, "ys": 17400, "yj": 17000}},
    {"book": "삼보텍스", "id": "SAM_01", "name": "삼보텍스 콤비 블라인드 (헤베당)", "calcType": "hebe", "specCm": 0, "unit": "헤베", "price": 15000, "categoryType": "블라인드", "tone": "neutral", "mood": "urban_clean", "tags": ["#빛각도조절", "#모던클린", "#간편관리"], "imageUrl": null, "extra": {"w": 15500, "ys": 19000, "yj": 18500}},
    {"book": "데미안", "id": "DAM_DEEP_01", "name": "데미안 다크 에스프레소 암막 (폭당)", "calcType": "width", "specCm": 150, "unit": "폭", "price": 47500, "categoryType": "겉지", "tone": "deep", "mood": "deep_private", "tags": ["#월넛체리추천", "#딥프라이빗", "#홈시네마숙면"], "imageUrl": null, "extra": {"w": 40750, "ys": 41000, "yj": 39750}}
];

// ==============================================================
// 앱 상태
// ==============================================================
let FABRIC_DB = [];
let rooms = [];
let roomIdCounter = 1;
let curtainIdCounter = 100;

// 새 상담을 시작할 때 들어가는 기본 시공·출장비. 직원 화면 "설정"에서 바꾸면 이 기기에 저장됨 (정한 적 없으면 30,000원)
const DEFAULT_INSTALL_FEE = 30000;
function storedDefaultInstallFee() {
    try {
        const v = localStorage.getItem(STORE_KEYS.installFee), n = Number(v);
        return (v !== null && v !== '' && Number.isFinite(n) && n >= 0) ? n : null;
    } catch (e) { return null; }
}
function loadDefaultInstallFee() { const n = storedDefaultInstallFee(); return n === null ? DEFAULT_INSTALL_FEE : n; }
function saveDefaultInstallFee(v) {
    const n = Number(v);
    try {
        if (v === '' || v === null || !Number.isFinite(n) || n < 0) localStorage.removeItem(STORE_KEYS.installFee);      // 비우면 처음 값(30,000원)으로
        else localStorage.setItem(STORE_KEYS.installFee, String(Math.round(n)));
    } catch (e) {}
}

// ---- 가공·부자재 단가 (29번) ----
// 직원 화면 "설정"에서 바꾸면 이 기기에 저장되고 비공개 팩(prices)으로 옮겨짐. 정한 적 없는 칸은 아래 처음 값(예전 금액)
// 원가 칸(cost)은 이 기기·비공개 팩에만 있음. 정한 적 없으면 레일·패널 가공비는 비공개 팩 원가 규칙으로 셈, 형상기억은 0
// 품목을 만들 때 그때 단가를 품목 안 rates에 적어 둠 → 나중에 단가를 바꿔도 이미 만든 견적 금액은 그대로 (A안)
const HW_TYPES = ['rail', 'rod25', 'rod35', 'rail_2line', 'rail_3line'];
const HW_NAMES = { rail: '기본 레일', rod25: '25파이 봉', rod35: '35파이 봉', rail_2line: '2줄 패널 레일', rail_3line: '3줄 패널 레일' };
const OPTION_PRICE_DEFAULTS = {
    shapeW: 3000, shapeY: 3000, shapeH: 0, shapeHW: 0, shapeHY: 0,      // 형상기억: 폭당 · 마당 / 제작 높이 shapeH cm 이상이면 단위마다 추가 (0 = 꺼짐)
    leadW: 1000, leadY: 1000,                                           // 리드밴드: 폭당 · 마당
    rail: { rail: 1000, rod25: 1500, rod35: 2000, rail_2line: 17000, rail_3line: 20000 },      // 레일·봉 자당(30cm)
    panelBase: 50000, panelStep: 15000                                  // 패널 가공비: 기본 + 90cm 넘는 30cm마다
};
function storedOptionPrices() {
    try { const o = JSON.parse(localStorage.getItem(STORE_KEYS.optionPrices)); return (o && typeof o === 'object') ? o : {}; } catch (e) { return {}; }
}
function saveOptionPricesStore(o) {
    try { localStorage.setItem(STORE_KEYS.optionPrices, JSON.stringify(o || {})); } catch (e) {}
}
const optNum = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null;
// 판매 단가 (정한 값 → 처음 값)
function optionPrices() {
    const s = storedOptionPrices(), d = OPTION_PRICE_DEFAULTS, out = { rail: {} };
    ['shapeW', 'shapeY', 'shapeH', 'shapeHW', 'shapeHY', 'leadW', 'leadY', 'panelBase', 'panelStep'].forEach(k => { const n = optNum(s[k]); out[k] = n === null ? d[k] : n; });
    HW_TYPES.forEach(t => { const n = optNum(s.rail && s.rail[t]); out.rail[t] = n === null ? d.rail[t] : n; });
    return out;
}
// 원가 (정한 값 → 비공개 팩 원가 규칙 → 없으면 null). 직원 화면 설정·원가 계산에서만 씀
function optionCosts() {
    const s = storedOptionPrices().cost || {}, rules = (typeof Costing !== 'undefined' && Costing.state.rules) || null, out = { rail: {} };
    const hw = (rules && rules.hardwareCost) || null, mult = (rules && Number(rules.specialRailMult)) || 1;
    HW_TYPES.forEach(t => {
        const n = optNum(s.rail && s.rail[t]);
        if (n !== null) { out.rail[t] = n; return; }
        const base = hw ? (hw[t] !== undefined ? hw[t] : hw.rail) : undefined;
        out.rail[t] = (typeof base === 'number') ? Math.round(base * ((t === 'rail_2line' || t === 'rail_3line') ? mult : 1)) : null;
    });
    const pf = (rules && rules.panelFactory) || {};
    out.panelBase = optNum(s.panelBase) !== null ? s.panelBase : (typeof pf.base === 'number' ? pf.base : null);
    out.panelStep = optNum(s.panelStep) !== null ? s.panelStep : (typeof pf.perExtraUnit === 'number' ? pf.perExtraUnit : null);
    ['shapeW', 'shapeY', 'shapeHW', 'shapeHY'].forEach(k => { out[k] = optNum(s[k]) !== null ? s[k] : 0; });
    return out;
}
// 설정 칸 하나 저장 (path 예: 'shapeW', 'rail.rod25', 'cost.rail.rail_2line'). 비우면 처음 값으로
function saveOptionPriceField(path, v) {
    const o = storedOptionPrices(), keys = String(path).split('.');
    let t = o;
    keys.slice(0, -1).forEach(k => { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; t = t[k]; });
    const n = Number(v), last = keys[keys.length - 1];
    if (v === '' || v === null || !Number.isFinite(n) || n < 0) delete t[last]; else t[last] = Math.round(n);
    saveOptionPricesStore(o);
}
function hwPriceOf(installType) { return optionPrices().rail[installType] ?? optionPrices().rail.rail; }
// 품목에 적어 둘 지금 단가 (cost.hw는 그 품목의 설치 기구 원가)
function optionRatesNow(installType) {
    const p = optionPrices(), k = optionCosts();
    return {
        shapeW: p.shapeW, shapeY: p.shapeY, shapeH: p.shapeH, shapeHW: p.shapeHW, shapeHY: p.shapeHY,
        leadW: p.leadW, leadY: p.leadY, panelBase: p.panelBase, panelStep: p.panelStep,
        cost: { shapeW: k.shapeW, shapeY: k.shapeY, shapeHW: k.shapeHW, shapeHY: k.shapeHY, panelBase: k.panelBase, panelStep: k.panelStep, hw: installType === 'none' ? 0 : (k.rail[installType] ?? k.rail.rail) }
    };
}

let globalInstallFee = loadDefaultInstallFee();
let globalVatOption = "consumer";

let currentMainTrack = 'curation';

// ==============================================================
// 유틸리티 & 속성 자동 태깅 (기존 로직 그대로)
// ==============================================================
function cleanNumber(val) {
    if (val === null || val === undefined) return 0;
    let s = String(val).replace(/,/g, '').trim();
    s = s.replace(/1\s*(폭|y|Y|마|야드)/g, '');
    const matches = s.match(/\d+(\.\d+)?/g);
    if (!matches) return 0;
    let maxVal = 0;
    matches.forEach(m => {
        let num = parseFloat(m);
        if (num > maxVal) maxVal = num;
    });
    return Math.round(maxVal);
}

function parseSpecToCm(specRaw, nameRaw = "") {
    const specStr = String(specRaw || "").trim().toLowerCase();
    const nameStr = String(nameRaw || "").trim().toLowerCase();
    const cleaned = specStr.replace(/1\s*(폭|y|마|야드)/g, '');
    const matchNum = cleaned.match(/\d+/);
    const hasInch = specStr.includes('"') || specStr.includes('인치') || specStr.includes('inch');
    const hasCm = specStr.includes('cm');

    if (matchNum) {
        const val = parseInt(matchNum[0], 10);
        if (val > 10) {
            if (hasInch) return Math.round(val * 2.54);
            else if (hasCm) return val;
            else {
                if (val < 80 || (val >= 100 && val <= 140)) return Math.round(val * 2.54);
                return val;
            }
        }
    }
    if (nameStr.includes('쉬폰') || nameStr.includes('차르르')) return 297;
    return 150;
}

function detectCalcTypeAndUnit(costRaw, specRaw, nameRaw, unitRaw, noteRaw, bookRaw, catRaw) {
    const unitStr = String(unitRaw || '').trim().toLowerCase();
    const catStr = String(catRaw || '').trim().toLowerCase();
    const bookStr = String(bookRaw || '').trim().toLowerCase();
    const nameStr = String(nameRaw || '').trim().toLowerCase();
    const costStr = String(costRaw || '').trim().toLowerCase();

    if (unitStr) {
        if (unitStr.includes('폭') || unitStr === 'width') return { calcType: 'width', unit: '폭' };
        if (unitStr.includes('마') || unitStr.includes('y') || unitStr.includes('야드') || unitStr === 'yard') return { calcType: 'yard', unit: '마' };
        if (unitStr.includes('헤베') || unitStr.includes('m2') || unitStr.includes('m²') || unitStr === 'hebe') return { calcType: 'hebe', unit: '헤베' };
    }

    if (bookStr.includes('삼보텍스') || catStr.includes('블라인드') || nameStr.includes('블라인드') || nameStr.includes('콤비')) {
        return { calcType: 'hebe', unit: '헤베' };
    }

    const combined = `${costStr} ${String(specRaw || '')} ${String(noteRaw || '')}`.toLowerCase();
    if (combined.includes('폭당') || combined.includes('/폭') || combined.includes('1폭')) {
        return { calcType: 'width', unit: '폭' };
    }

    return { calcType: 'yard', unit: '마' };
}

function autoTagFabricAttributes(fabric) {
    const name = (fabric.name || "").toLowerCase();
    const book = (fabric.book || "").toLowerCase();

    if (!fabric.categoryType) {
        if (fabric.calcType === "hebe" || name.includes("블라인드") || name.includes("콤비") || book.includes("삼보텍스")) {
            fabric.categoryType = "블라인드";
        } else if (name.includes("쉬폰") || name.includes("차르르") || name.includes("속지") || fabric.specCm >= 280) {
            fabric.categoryType = "속지";
        } else {
            fabric.categoryType = "겉지";
        }
    }

    if (!fabric.tone) {
        if (name.includes("베이지") || name.includes("오크") || name.includes("아이보리") || name.includes("크림") || name.includes("웜")) {
            fabric.tone = "warm";
        } else if (name.includes("그레이") || name.includes("화이트") || name.includes("쿨") || name.includes("블루")) {
            fabric.tone = "cool";
        } else if (name.includes("월넛") || name.includes("체리") || name.includes("브라운") || name.includes("다크") || name.includes("딥")) {
            fabric.tone = "deep";
        } else {
            fabric.tone = "neutral";
        }
    }

    if (!fabric.mood) {
        if (fabric.categoryType === "속지") {
            fabric.mood = (fabric.tone === 'cool') ? "airy_bright" : "soft_warm";
        } else if (name.includes("린넨") || name.includes("슬러브")) {
            fabric.mood = "textured_linen";
        } else if (name.includes("암막") && (fabric.tone === 'deep' || name.includes("다크"))) {
            fabric.mood = "deep_private";
        } else if (fabric.tone === 'cool') {
            fabric.mood = "urban_clean";
        } else if (fabric.tone === 'neutral') {
            fabric.mood = "balanced_neutral";
        } else {
            fabric.mood = "soft_warm";
        }
    }

    if (!fabric.tags || fabric.tags.length === 0) {
        const tags = [];
        if (fabric.categoryType === "속지") tags.push("#도톰차르르", "#사생활보호", "#부드러운빛산란");
        else if (fabric.categoryType === "겉지") tags.push("#호텔식도톰핏", "#완벽암막", "#방한단열");
        else tags.push("#모던클린", "#빛각도조절", "#간편관리");
        fabric.tags = tags;
    }

    if (fabric.imageUrl === undefined) {
        fabric.imageUrl = null;
    }

    return fabric;
}

// ---- 분류 이름표 (화면 표시용) ----
const TONE_LABELS = { warm: '웜', cool: '쿨', neutral: '뉴트럴', deep: '딥' };
const MOOD_LABELS = {
    soft_warm: '포근한', urban_clean: '깔끔한', balanced_neutral: '은은한',
    textured_linen: '자연스러운', deep_private: '아늑한', airy_bright: '화사한'
};
// 엑셀에 예전 이름(소프트 웜 등)이나 '한'을 뺀 이름(포근 등)으로 적어도 읽음
const MOOD_ALIASES = {
    soft_warm: ['포근', '소프트웜'], urban_clean: ['깔끔', '어반클린'], balanced_neutral: ['은은', '밸런스뉴트럴'],
    textured_linen: ['자연', '텍스처린넨'], deep_private: ['아늑', '딥프라이빗'], airy_bright: ['화사', '에어리브라이트']
};
// 속지 비침 4단계 (창문 테스트: 낮에 한 겹을 창에 대고 안에서 밖을 봄)
//  light=많이 비침(풍경 또렷) / medium=은은한 비침(형태는 보이나 흐림) / day=낮 가림(밝기만, 낮에는 밖에서 안 보임) / heavy=거의 안 비침(저녁 조명에도 흐릿)
const DENSITY_LABELS = { light: '많이 비침', medium: '은은한 비침', day: '낮 가림', heavy: '거의 안 비침' };
// 속지만 + 바깥 시선이 신경 쓰이는 공간에 붙이는 밤 안내 (33번: 구성 화면 속지 커튼 칸, 원단을 고른 이유 카드)
const SHEER_NIGHT_NOTE = '밤에 불을 켜면 어떤 속지든 안의 그림자가 비칠 수 있어요. 밤 가림이 필요하면 겉커튼이나 블라인드를 더할 수 있어요.';
const DENSITY_ORDER = ['light', 'medium', 'day', 'heavy'];
const DENSITY_FACTS = { light: '#맑은비침', medium: '#은은한비침', day: '#낮시간가림', heavy: '#비침적음' };
// 고객 사생활 질문 (속지가 들어가는 구성에서 한 번)
const PRIVACY_LABELS = { open: '괜찮아요', some: '조금 신경 쓰여요', high: '많이 신경 쓰여요' };
// 고객 속지 질감 취향 (속지가 들어가는 구성에서 한 번): 깔끔·매끈 / 결이 살아 있는 / 상관없음(질문 결과 null)
const SHEER_FEEL_LABELS = { smooth: '깔끔하고 매끈하게', textured: '결이 살아 있게' };
function roomIsDouble(room) {
    const list = (room && (room.items || room.curtains)) || [];
    return list.some(i => i.presetType === 'sheer') && list.some(i => i.presetType === 'drape');
}
// 질감 (사장님이 만져 보고 고름). 분위기는 톤·비침·질감으로 앱이 자동으로 정함
const TEXTURE_LABELS = { smooth: '매끈', natural: '결 있음', cozy: '포근' };
const TEXTURE_HINTS = { smooth: '차르르·광택·평직', natural: '린넨·슬러브처럼 결·마디', cozy: '부클·기모·도톰한 짜임' };
function normalizeTextureInput(v) {
    const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (TEXTURE_LABELS[s]) return s;
    if (/^(매끈|매끄|차르|광택)/.test(s)) return 'smooth';
    if (/^(결|린넨|슬러브|내추럴)/.test(s)) return 'natural';
    if (/^(포근|부클|기모|도톰)/.test(s)) return 'cozy';
    return null;
}
// 암막 4단계 (사장님 기준): 완전암막 = 빛에 예민한 분용 진짜 암막(95% 이상), 생활암막 = 70~94%(블랑·라온), 보통 = 그 아래(넥스 약 60%)
const BLACKOUT_LABELS = { none: '비암막', mid: '보통', life: '생활암막', full: '완전암막' };
const BLACKOUT_ORDER = ['none', 'mid', 'life', 'full'];
// 고객이 고르는 "빛을 얼마나 가릴지" (방에서만 물어봄)
const LIGHTBLOCK_LABELS = { light: '들어와도 괜찮아요', soft: '적당히 가려 주세요', dark: '완전히 어둡게' };

// 겉지의 암막 정도: 사장님이 직접 정한 값이 우선, 없으면 품명으로 추정 (95% 이상 = 완전, 70~94% = 생활, 70% 미만 = 보통)
function blackoutLevel(f) {
    if (!f) return null;
    if (f.blackout && BLACKOUT_LABELS[f.blackout]) return f.blackout;
    const name = String(f.name || '');
    const pct = /(\d{2,3})\s*%/.exec(name);
    if (name.includes('생활암막')) return 'life';
    if (name.includes('암막')) {
        if (!pct) return null;            // 암막률이 안 적혀 있으면 모름 → 사장님이 지정
        const p = parseInt(pct[1], 10);
        return p >= 95 ? 'full' : (p >= 70 ? 'life' : 'mid');
    }
    return null;   // 모름 (사장님이 분류 화면에서 지정하면 반영)
}

// ---- 블라인드 자동 분류 (엑셀 비고·품명으로 판단. 사장님은 톤·분위기만 지정) ----
const BLIND_KIND_LABELS = { combi: '콤비', roll: '롤', print: '프린트' };
const BLIND_LIGHT_LABELS = { full: '암막', none: '일반', see: '투시' };
// 비고 칸: "TRIPLE & COMBI" → 콤비, "ROLL TYPE" → 롤, "PRINTED FABRIC BLINDS" → 프린트
function detectBlindKind(note) {
    const s = String(note || '').toUpperCase();
    if (/COMBI|TRIPLE|콤비|트리플/.test(s)) return 'combi';
    if (/ROLL|롤/.test(s)) return 'roll';
    if (/PRINT|프린트/.test(s)) return 'print';
    return null;
}
function blindKind(f) { return (f && f.blindKind && BLIND_KIND_LABELS[f.blindKind]) ? f.blindKind : null; }
// 품명: "B/O" = 암막, "SUN SCREEN" = 바깥이 비치는 투시형, 나머지 = 일반
function blindLight(f) {
    const n = String((f && f.name) || '').toUpperCase();
    if (/B\/O|BLACKOUT|암막/.test(n)) return 'full';
    if (/SUN\s*SCREEN|선스크린/.test(n)) return 'see';
    return 'none';
}
// 분류 화면용: 어떤 원단이 이 분위기인지 (원단 기준 설명). 분위기는 질감·톤·비침으로 자동이라 직접 고르는 건 선택
const MOOD_GUIDE = {
    soft_warm: '아이보리·베이지 계열, 포근하고 따뜻한 원단',
    urban_clean: '화이트·그레이 계열, 매끈하고 깔끔한 원단',
    balanced_neutral: '그레이지·샌드 계열, 튀지 않는 무난한 원단',
    textured_linen: '린넨·슬러브처럼 결이 눈에 보이는 원단',
    deep_private: '차콜·브라운·네이비처럼 진하고 무게감 있는 원단',
    airy_bright: '많이 비치는 속지, 아주 밝은 겉지(오프 화이트·아이보리)'
};
const MOOD_HINTS = {
    soft_warm: '포근하고 따뜻한 느낌', urban_clean: '깔끔하고 정돈된 느낌', balanced_neutral: '은은하고 편안한 느낌',
    textured_linen: '결이 살아 있는 자연스러운 느낌', deep_private: '빛과 시선을 감싸는 아늑한 느낌', airy_bright: '가볍고 화사한 느낌'
};

// 엑셀에 한글로 적어도(웜/쿨/…, 포근한/깔끔한/…) 코드로 바꿔 읽음
function normalizeToneInput(v) {
    const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (TONE_LABELS[s]) return s;
    const map = { '웜': 'warm', '따뜻': 'warm', '쿨': 'cool', '차가운': 'cool', '뉴트럴': 'neutral', '중간': 'neutral', '무채색': 'neutral', '딥': 'deep', '다크': 'deep' };
    for (const k in map) if (s.startsWith(k)) return map[k];
    return null;
}
function normalizeMoodInput(v) {
    const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (MOOD_LABELS[s]) return s;
    for (const code in MOOD_ALIASES) if (MOOD_ALIASES[code].some(a => s.startsWith(a))) return code;
    return null;
}

// 밝기(L값, 0 = 검정 ~ 100 = 흰색): 색상 입력표·단가표의 "밝기" 열. 이 값 이상인 겉지는 '화사한'
const BRIGHT_L = 85;
function normalizeLightInput(v) {
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    if (!s) return null;
    const n = parseFloat(s);
    return (isFinite(n) && n >= 0 && n <= 100) ? n : null;
}

function normalizeDensityInput(v) {
    const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    if (DENSITY_LABELS[s]) return s;
    if (/^(많이|맑|얇|가벼)/.test(s)) return 'light';
    if (/^낮/.test(s)) return 'day';
    if (/^(적|안|거의|도톰|두꺼|두툼)/.test(s)) return 'heavy';
    if (/^(중|보통|은은)/.test(s)) return 'medium';
    return null;
}

// 바닥·벽 톤으로 공간의 분위기를 정함 (고객이 희망 분위기를 고르지 않은 경우에만 사용) (예전에는 항상 '포근한'으로 고정돼 있어 선택이 추천에 반영되지 않았음)
function deriveRoomMood(room) {
    const f = room.floorTone || 'warm', w = room.wallTone || 'warm';
    if (f === 'deep' || w === 'deep') return 'deep_private';
    if (f === w) return f === 'warm' ? 'soft_warm' : (f === 'cool' ? 'urban_clean' : 'balanced_neutral');
    return 'balanced_neutral';
}

// 원단(또는 색)의 분위기: ① 사장님이 직접 고른 분위기 ② 질감이 있으면 톤·비침·질감으로 자동 ③ 둘 다 없으면 예전 이름 추측
// 색상별 톤이 다르면 분위기도 색마다 달라짐 (예: 블랑 1번 웜 → 포근한, 7번 쿨 → 깔끔한)
function moodOf(f) {
    if (!f) return null;
    const m = f.manual || {};
    if (m.mood && MOOD_LABELS[f.mood]) return f.mood;
    if (!f.texture || !TEXTURE_LABELS[f.texture]) return f.mood || null;
    const tone = f.tone || 'neutral';
    const thin = f.categoryType === '속지' && (f.density === 'light' || (!m.density && /쉬폰|보일/.test(String(f.name || ''))));
    if (thin && tone !== 'deep') return 'airy_bright';      // 얇은 속지 → 화사한
    // 아주 밝은 겉지(엑셀 "밝기" 열 85 이상, 결 있음·딥 제외) → 화사한
    if (f.categoryType === '겉지' && typeof f.light === 'number' && f.light >= BRIGHT_L && f.texture !== 'natural' && tone !== 'deep') return 'airy_bright';
    if (f.texture === 'natural') return 'textured_linen';    // 결 있음 → 자연스러운
    if (tone === 'deep') return 'deep_private';              // 딥 톤 → 아늑한
    if (f.texture === 'cozy' || tone === 'warm') return 'soft_warm';
    if (tone === 'cool') return 'urban_clean';
    return 'balanced_neutral';
}
function hasMoodInput(f) { const m = (f && f.manual) || {}; return !!(m.mood || (f && f.texture && TEXTURE_LABELS[f.texture])); }
function isManualTagged(f) { return !!(f && f.manual && hasMoodInput(f) && (f.manual.tone || hasColorTones(f.id))); }

function calculateFabricMatchScore(fabric, room, category) {
    let score = 0;
    const fTone = fabric.tone || 'neutral';
    const floorT = room.floorTone || 'warm';
    const wallT = room.wallTone || 'warm';
    const wantMood = room.wantMood || null;                    // 고객이 직접 고른 희망 분위기
    const targetMood = wantMood || deriveRoomMood(room);       // 고르지 않았으면 바닥·벽 톤으로 추정
    const fMood = moodOf(fabric);

    // 톤: 바닥·벽과의 어울림
    if (floorT === wallT) {
        if (fTone === floorT) score += 4;
        else if (fTone === 'neutral') score += 2;
    } else {
        if (fTone === 'neutral') score += 5;
        else if (fTone === floorT || fTone === wallT) score += 2;
    }

    if ((floorT === 'deep' || wallT === 'deep') && (fTone === 'deep' || fMood === 'deep_private')) {
        score += 4;
    }

    // 분위기: 고객이 직접 고른 경우 더 크게 반영
    if (fMood === targetMood) {
        score += wantMood ? 6 : 4;
    } else {
        if (targetMood === 'soft_warm' && fMood === 'textured_linen') score += 2;
        // 밝은 웜 톤 겉지(아이보리 등)는 '화사한'으로 분류되지만 색이 주는 포근함도 있음 → 딱 맞는 포근한(+6/+4)보다 조금 낮게
        if (targetMood === 'soft_warm' && fMood === 'airy_bright' && fabric.categoryType === '겉지' && fTone === 'warm') score += wantMood ? 4 : 3;
        if (targetMood === 'urban_clean' && fMood === 'airy_bright') score += 2;
        if (targetMood === 'balanced_neutral' && (fMood === 'soft_warm' || fMood === 'urban_clean')) score += 1;
    }

    // 채광: 빛이 강하면 덜 비치는 속지로 빛을 부드럽게 걸러줌 (어두운 공간은 정해진 규칙 없음)
    if (category === '속지' && room.lightLevel === 'high') {
        score += ({ heavy: 3, day: 2, medium: 1 })[fabric.density] || 0;
    }

    // 사생활(밖에서 안이 보이는 게 신경 쓰이는지): 많이 → 낮 가림·거의 안 비침을 크게 우선
    if (category === '속지') {
        const dbl = roomIsDouble(room);
        const table = {
            high: { heavy: 6, day: dbl ? 6 : 5, medium: 1, light: -3 },     // 이중커튼은 밤에 겉지가 가려 주니 낮 가림이면 충분
            some: { heavy: 2, day: 3, medium: 3, light: 0 },
            open: { heavy: 0, day: 1, medium: 2, light: 3 }
        }[room.privacy];
        if (table) score += table[fabric.density] || 0;
        // 채광 차분 × 바깥 시선(33번): 해가 덜 드는 창은 밖이 안보다 밝아 속지가 잘 비침 → 촘촘한 원단을 더 우선
        // (낮에 속지를 쓰는 건 겉지를 안 치려는 것이라 이중커튼·속지만 구분 없이 똑같이)
        if (room.lightLevel === 'low') {
            const cross = {
                high: { heavy: 4, day: 1, medium: -3, light: -4 },
                some: { heavy: 2, day: 2, medium: -1, light: -2 }
            }[room.privacy];
            if (cross) {
                score += cross[fabric.density] || 0;
                // 거의 안 비침 중 밝은 색(밝기 L ≥ 80)은 어두운 집이 더 답답해지지 않게 +1
                if (fabric.density === 'heavy' && typeof fabric.light === 'number' && fabric.light >= 80) score += 1;
            }
        }
        // 이중커튼: 낮에는 속지만 쳐 두고 지내므로 덜 비치는 속지를 우대 (겉지는 필요할 때만)
        if (dbl && (fabric.density === 'day' || fabric.density === 'heavy')) score += 2;
        // 질감 취향: 매끈한(쉬폰) / 결 있는(린넨·네프) / 도톰한(보송한 혼방)이 확연히 나뉨 → 고른 질감과 같으면 +8, 다르면 -4 (질감 미입력 원단은 0)
        const tx = fabric.texture;
        if (room.sheerFeel === 'smooth' && tx) score += tx === 'smooth' ? 8 : -4;
        if (room.sheerFeel === 'textured' && tx) score += tx === 'natural' ? 8 : -4;
        if (room.sheerFeel === 'cozy' && tx) score += tx === 'cozy' ? 8 : -4;
    }

    // 빛 차단 희망 (방): 완전히 어둡게 → 완전 암막을 사실상 최우선, 적당히 → 적당 암막, 들어와도 → 비암막·적당 암막
    if (category === '겉지' && room.lightBlock) {
        const b = blackoutLevel(fabric);
        const table = {
            dark: { full: 10, life: 2, mid: -2, none: -3, unknown: -1 },     // 완전히 어둡게 → 완전암막 최우선
            soft: { full: 1, life: 4, mid: 3, none: 0, unknown: 0 },        // 적당히 → 생활암막·보통
            light: { full: -1, life: 1, mid: 3, none: 3, unknown: 1 }       // 들어와도 → 비암막·보통
        }[room.lightBlock];
        if (table) score += table[b || 'unknown'];
    }

    // 블라인드 빛 가림: 완전히 어둡게 → 암막(롤 암막이 가장 확실), 적당히 → 일반·콤비, 들어와도 → 투시·콤비
    if (category === '블라인드' && room.lightBlock) {
        const bl = blindLight(fabric), kind = blindKind(fabric);
        const table = {
            dark: { full: kind === 'roll' ? 10 : 7, none: -3, see: -5 },
            soft: { full: 2, none: 4, see: 1 },
            light: { full: -1, none: 2, see: 4 }
        }[room.lightBlock];
        if (table) score += table[bl] || 0;
        if (kind === 'combi' && room.lightBlock !== 'dark') score += 1;      // 각도 조절이 되어 빛 양을 맞추기 쉬움
    }

    if (fabric.categoryType === category) score += 2;
    return score;
}

// 추천 이유 한 줄 (짧은 말) (사장님이 직접 분류한 원단에만 표시 — 자동 추정값으로는 이유를 말하지 않음)
function recommendReason(fabric, room, category, maxParts, onlySaid) {
    // onlySaid(원단을 고른 이유 카드, 24번): 손님이 답한 조건(바깥 시선·빛 가림·강한 햇빛)과 원단이 맞는 점만, 있으면 하나만 돌려줌
    if (!isManualTagged(fabric)) return '';
    const said = [];
    const floorT = room.floorTone || 'warm', wallT = room.wallTone || 'warm';
    const targetMood = room.wantMood || deriveRoomMood(room);
    const parts = [];
    if (moodOf(fabric) === targetMood) parts.push(room.wantMood ? `${MOOD_LABELS[targetMood]} 분위기` : MOOD_HINTS[targetMood]);
    if (fabric.tone === 'neutral') parts.push(floorT !== wallT ? '바닥과 벽을 잇는 톤' : '어디에나 어울리는 톤');
    else if (fabric.tone === floorT) parts.push(`바닥과 어울리는 ${TONE_LABELS[floorT]} 톤`);
    else if (fabric.tone === wallT) parts.push(`벽과 어울리는 ${TONE_LABELS[wallT]} 톤`);
    // 채광별 이유(33번): 맞으면 바깥 시선 문구 대신 맨 앞에
    let lightSay = '';
    if (category === '속지' && room.lightLevel === 'high' && fabric.density === 'day') lightSay = '햇살이 강한 창이라, 낮에는 밖에서 안이 잘 보이지 않아요';
    else if (category === '속지' && room.lightLevel === 'low' && (room.privacy === 'high' || room.privacy === 'some') && fabric.density === 'heavy') lightSay = '해가 덜 드는 창이라, 촘촘한 원단으로 골랐어요';
    else if (category === '속지' && room.lightLevel === 'high' && fabric.density === 'heavy') { parts.push('강한 햇빛을 거르는 비침'); said.push('강한 햇빛을 거르는 비침'); }
    if (category === '속지' && room.sheerFeel && fabric.texture) {
        const msg = room.sheerFeel === 'smooth' && fabric.texture === 'smooth' ? '깔끔하고 매끈한 결'
            : room.sheerFeel === 'textured' && fabric.texture === 'natural' ? '자연스럽게 살아 있는 결'
            : room.sheerFeel === 'cozy' && fabric.texture === 'cozy' ? '도톰하고 보송한 느낌' : '';
        if (msg) parts.unshift(msg);   // 고객이 고른 취향 → 앞쪽 (사생활 문장 다음)
    }
    if (category === '속지' && room.privacy) {
        const d = fabric.density;
        const msg = room.privacy === 'high' && (d === 'heavy' || d === 'day') ? '낮에도 안이 보이지 않는 비침'
            : room.privacy === 'some' && (d === 'day' || d === 'medium') ? '적당히 가리는 은은한 비침'
            : room.privacy === 'open' && d === 'light' ? '풍경과 햇살을 살리는 맑은 비침' : '';
        if (msg && !lightSay) { parts.unshift(msg); said.unshift(msg); }       // 고객이 직접 고른 조건이라 맨 앞에
    }
    if (lightSay) { parts.unshift(lightSay); said.unshift(lightSay); }   // 채광·시선을 함께 말해 주는 문장이라 바깥 시선 문구보다 먼저
    if (category === '겉지' && room.lightBlock) {
        const b = blackoutLevel(fabric);
        const msg = room.lightBlock === 'dark' && b === 'full' ? '빛을 거의 막는 완전 암막'
            : room.lightBlock === 'soft' && b === 'life' ? '눈부심만 줄이는 생활 암막'
            : room.lightBlock === 'soft' && b === 'mid' ? '빛을 살짝 거르는 원단'
            : room.lightBlock === 'light' && (b === 'none' || b === 'mid') ? '햇빛이 은은히 스미는 원단' : '';
        if (msg) { parts.unshift(msg); said.unshift(msg); }       // 고객이 직접 고른 조건이라 맨 앞에
    }
    if (category === '블라인드' && room.lightBlock) {
        const bl = blindLight(fabric), kind = blindKind(fabric);
        const msg = room.lightBlock === 'dark' && bl === 'full' ? '빛을 거의 막는 암막'
            : room.lightBlock === 'light' && bl === 'see' ? '풍경은 살리고 햇빛만 거르는 투시'
            : room.lightBlock !== 'dark' && kind === 'combi' ? '각도로 빛을 맞추는 콤비' : '';
        if (msg) { parts.unshift(msg); said.unshift(msg); }
    }
    if (onlySaid) return said[0] || '';
    // 짧은 말로 끝냄(예: 깔끔하고 매끈한 결). 원단 고르는 칸은 1개만, 제안서는 2개까지
    return parts.slice(0, maxParts || 2).join(' · ');
}

// ---- 창 방향 (35번): 공간마다 동·서·남·북 최대 2개(반대쪽끼리는 같이 못 고름). 원단을 고른 이유 문장에만 쓰고 추천 점수에는 쓰지 않음 ----
const WINDOW_DIR_WORD = { E: '동', W: '서', S: '남', N: '북' };
const WINDOW_DIR_OPP = { E: 'W', W: 'E', S: 'N', N: 'S' };
function windowDirOf(v) {
    const out = [];
    if (Array.isArray(v)) v.forEach(d => { if (WINDOW_DIR_WORD[d] && !out.includes(d) && !out.includes(WINDOW_DIR_OPP[d]) && out.length < 2) out.push(d); });
    return out;
}
// "남동" · "북서" · "남" (남·북을 앞에). 없으면 빈칸
function windowDirText(v) {
    return windowDirOf(v).sort((a, b) => 'SNEW'.indexOf(a) - 'SNEW'.indexOf(b)).map(d => WINDOW_DIR_WORD[d]).join('');
}
// 맞은편 창: 같은 이름 공간(거실 · 거실 2)의 방향이 서로 반대. 따로 묻지 않고 계산 → 그 공간 이름(없으면 빈칸)
function oppositeRoomOf(room, list) {
    const base = r => (r && (r.roomType || String(r.name || '').replace(/\s*\d+$/, ''))) || '';
    const p = windowDirOf(room && room.windowDir);
    if (!p.length) return '';
    const o = (list || []).find(r => r && r.name !== room.name && base(r) === base(room) && (q => q.length && !p.some(d => q.includes(d)) && p.some(d => q.includes(WINDOW_DIR_OPP[d])))(windowDirOf(r.windowDir)));
    return o ? o.name : '';
}

// 공간 종류(+빛 차단 희망)로 창 구성 추천: 카드 순서는 그대로 두고 "추천" 표시만 붙임
function recommendComposition(room) {
    const t = String((room && (room.roomType || room.name)) || '').replace(/\s*\d+$/, '');
    if (t === '베란다' || t === '서재' || t === '알파룸' || t === '주방') return 'blind_only';
    // 거실·방·드레스룸 등: 빛 가림·바깥 시선 답으로 (모든 공간에서 구성 전에 물음)
    if (room.lightBlock === 'light' && room.privacy === 'open') return 'sheer_only';     // 빛도 시선도 괜찮으면 속지만
    if (room.lightBlock || room.privacy) return 'double';                                 // 그 밖에는 낮엔 속지, 밤엔 겉지
    return null;
}

// 추천 3개 고르기: 점수 순서는 그대로 지키고, "점수가 같을 때만" 아직 안 나온 책자를 먼저 보여줌
// (예전에는 동점이면 엑셀 순서대로 나와 포아 POA1·2·3처럼 같은 책자만 반복됨)
function pickShowcase(ranked, n) {
    const out = [], rest = ranked.slice();
    while (out.length < n && rest.length) {
        const top = rest[0].best.score;
        const used = new Set(out.map(e => e.f.book));
        let i = rest.findIndex(e => e.best.score === top && !used.has(e.f.book));
        if (i < 0) i = 0;
        out.push(rest.splice(i, 1)[0]);
    }
    return out;
}

// 고객 카드에 보여줄 원단 특징 (사실인 것만: 품명의 암막률, 사장님이 지정한 비침·분위기)
// 예전 자동 태그(#완벽암막 #사생활보호 등)는 모든 원단에 똑같이 붙어 사실과 다를 수 있어 고객 화면에서 쓰지 않음
function customerFacts(fabric) {
    const f = fabric || {}, m = f.manual || {}, out = [];
    const name = String(f.name || '');
    const pct = /(\d{2,3})\s*%/.exec(name);
    const bl = blackoutLevel(f);
    if (f.categoryType === '블라인드') {
        const kind = blindKind(f), light = blindLight(f);
        if (kind) out.push(`#${BLIND_KIND_LABELS[kind]}`);
        if (light !== 'none') out.push(`#${BLIND_LIGHT_LABELS[light]}`);
        if (hasMoodInput(f) && MOOD_LABELS[moodOf(f)]) out.push(`#${MOOD_LABELS[moodOf(f)].replace(/\s+/g, '')}`);
        return out.join(' ');
    }
    const pctTxt = (pct && name.includes('암막')) ? ` ${pct[1]}%` : '';
    if (bl === 'full') out.push(`#완전암막${pctTxt}`);
    else if (bl === 'life') out.push(`#생활암막${pctTxt}`);
    else if (bl === 'mid' && pctTxt) out.push(`#빛가림${pctTxt}`);      // 보통 단계는 '암막'이라 부르지 않음
    if (m.density && DENSITY_FACTS[f.density]) out.push(DENSITY_FACTS[f.density]);
    if (hasMoodInput(f) && MOOD_LABELS[moodOf(f)]) out.push(`#${MOOD_LABELS[moodOf(f)].replace(/\s+/g, '')}`);
    return out.join(' ');
}

// ---- 원단 사진: photos/원단ID.jpg, 색상별은 photos/원단ID__번호.jpg (없으면 .webp, .png 순서로 찾고, 없으면 원단 대표 사진 → 색상 배경) ----
// 34번: 기기에 넣은 사진(직원 화면 › 사진 › 사진 불러오기, IndexedDB)이 있으면 그것을 먼저 씀 → 없으면 photos/ 주소 → 없으면 색 질감
//  colorOnly: 색 사진 주소만 (대표 사진은 빼고)
function fabricPhotoUrls(id, color, colorOnly) {
    const col = normalizeColorName(color);
    const repo = repoPhotoUrls(id, col);
    const dev = DevicePhotos.urlOf(id, col);
    if (!col) return dev ? [dev].concat(repo) : repo;
    const colorUrls = (dev ? [dev] : []).concat(repo.slice(0, 3));
    if (colorOnly) return colorUrls;
    const devG = DevicePhotos.urlOf(id, '');
    return colorUrls.concat(devG ? [devG] : [], repo.slice(3));
}
// 저장소(photos/) 주소만: 사진 확인하기(있는지 HEAD로 확인)가 씀
function repoPhotoUrls(id, color) {
    const base = 'photos/' + encodeURIComponent(id);
    const generic = [base + '.jpg', base + '.webp', base + '.png'];
    const col = normalizeColorName(color);
    if (!col) return generic;
    const cb = base + '__' + encodeURIComponent(col);
    return [cb + '.jpg', cb + '.webp', cb + '.png'].concat(generic);
}

// 분위기·속지 느낌 장면 사진 이름 (photos/mood/, photos/feel/의 기본값. 같은 이름으로 기기에 넣으면 그것이 먼저 — 34번 덧붙임)
const SCENE_PHOTOS = {
    mood: ['mood_01_cozy', 'mood_02_clean', 'mood_03_subtle', 'mood_04_natural', 'mood_05_warm', 'mood_06_bright'],
    feel: ['feel_smooth', 'feel_textured', 'feel_cozy']
};
// 장면 사진 주소: 기기 사진 → 저장소 기본값
function scenePhotoUrl(folder, name) {
    return DevicePhotos.sceneUrl(folder, name) || `photos/${folder}/${name}.jpg`;
}
// 기기에 넣은 원단 사진 (34번: 원단 사진은 공개 저장소에 두지 않고 기기에만. 분위기·속지 느낌 사진도 넣으면 먼저 씀)
//  - 이 브라우저 주소의 IndexedDB "redam_photos"에 파일 그대로 저장. 비공개 팩·상담 저장과는 따로라 팩을 불러와도 지워지지 않음
//  - 키 = 원단ID(대표 사진) 또는 원단ID__번호(색 사진). 같은 키면 덮어씀
//  - 앱을 켜면 한 번 읽어 주소(blob:)를 만들어 둠 → fabricPhotoUrls가 바로(동기로) 씀. 읽기가 끝나면 ready가 풀림
const DevicePhotos = (() => {
    const DB = 'redam_photos', STORE = 'photos';
    const urls = {}, info = {};       // 키 → blob: 주소 / { name, size, date }
    let dbp = null;
    function open() {
        if (dbp) return dbp;
        dbp = new Promise((res, rej) => {
            if (typeof indexedDB === 'undefined') return rej(new Error('이 브라우저는 기기 저장소를 쓸 수 없어요'));
            const rq = indexedDB.open(DB, 1);
            rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE); };
            rq.onsuccess = () => res(rq.result);
            rq.onerror = () => rej(rq.error);
        });
        dbp.catch(() => { dbp = null; });
        return dbp;
    }
    function tx(mode, fn) {
        return open().then(db => new Promise((res, rej) => {
            const t = db.transaction(STORE, mode), st = t.objectStore(STORE);
            let out;
            Promise.resolve(fn(st, v => { out = v; })).catch(rej);
            t.oncomplete = () => res(out);
            t.onerror = () => rej(t.error);
            t.onabort = () => rej(t.error || new Error('저장이 취소되었어요(기기 공간이 부족할 수 있어요)'));
        }));
    }
    function keyOf(id, color) { const c = normalizeColorName(color); return c ? id + '__' + c : id; }
    function setUrl(key, rec) {
        if (urls[key]) URL.revokeObjectURL(urls[key]);
        urls[key] = URL.createObjectURL(rec.blob);
        info[key] = { name: rec.name || key, size: rec.size || rec.blob.size || 0, date: rec.date || '' };
    }
    function dropUrl(key) { if (urls[key]) URL.revokeObjectURL(urls[key]); delete urls[key]; delete info[key]; }
    const ready = tx('readonly', (st, done) => {
        const rq = st.openCursor();
        rq.onsuccess = () => {
            const cur = rq.result;
            if (!cur) return done();
            if (cur.value && cur.value.blob) setUrl(cur.key, cur.value);
            cur.continue();
        };
    }).catch(() => {});
    // 파일 이름 → { id, color } (원단ID__번호.jpg / 원단ID.jpg, 포아는 포아_POA번호.jpg) 또는 { scene } (mood_01_cozy.jpg 등). 규칙에 안 맞거나 없는 원단이면 { why }
    function parseName(fileName) {
        const raw = String(fileName || '').normalize('NFC').trim();
        const m = /^(.+?)\.(jpe?g|png|webp)$/i.exec(raw);
        if (!m) return { why: 'jpg·png·webp 사진이 아님' };
        const stem = m[1].trim();
        // 분위기·속지 느낌 장면 사진(34번 덧붙임): 이름이 정해진 9장. 키는 "mood/mood_01_cozy"처럼 폴더/이름
        const folder = Object.keys(SCENE_PHOTOS).find(k => SCENE_PHOTOS[k].includes(stem.toLowerCase()));
        if (folder) return { scene: folder + '/' + stem.toLowerCase() };
        if (/^(mood|feel)_/i.test(stem)) return { why: '분위기·속지 느낌 사진 이름이 아님(mood_01_cozy~mood_06_bright, feel_smooth·feel_textured·feel_cozy)' };
        const at = stem.lastIndexOf('__');
        const id = (at > 0 ? stem.slice(0, at) : stem).trim();
        const color = at > 0 ? normalizeColorName(stem.slice(at + 2)) : '';
        const fab = FABRIC_DB.find(f => String(f.id).normalize('NFC') === id);
        if (!fab) return { why: '없는 원단 이름' };
        if (color && !getFabricColors(fab.id).some(c => c.name === color)) return { why: `${color}번 색이 원단 색상 목록에 없음` };
        return { id: fab.id, color };
    }
    // 여러 장을 한 장씩 차례로 저장 (탭이 멈추지 않게). onProgress(지금까지, 전체)
    async function importFiles(files, onProgress) {
        await ready;
        const list = Array.from(files || []), ok = [], bad = [];
        for (let i = 0; i < list.length; i++) {
            const f = list[i], p = parseName(f.name);
            if (p.why) { bad.push({ name: f.name, why: p.why }); }
            else {
                const key = p.scene || keyOf(p.id, p.color);
                const rec = { blob: f, name: f.name, size: f.size, date: new Date().toISOString().slice(0, 10) };
                try { await tx('readwrite', st => { st.put(rec, key); }); setUrl(key, rec); ok.push(key); }
                catch (e) { bad.push({ name: f.name, why: (e && e.message) || '저장 실패' }); }
            }
            if (onProgress) onProgress(i + 1, list.length);
            await new Promise(r => setTimeout(r, 0));
        }
        // 브라우저가 공간이 모자랄 때 지우지 않게 부탁 (안 되어도 그대로 씀)
        try { if (ok.length && navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) {}
        return { ok, bad };
    }
    async function remove(key) { await tx('readwrite', st => { st.delete(key); }); dropUrl(key); }
    async function clearAll() { await tx('readwrite', st => { st.clear(); }); Object.keys(urls).forEach(dropUrl); }
    return {
        ready, parseName, importFiles, remove, clearAll, keyOf,
        urlOf: (id, color) => urls[keyOf(id, color)] || '',
        sceneUrl: (folder, name) => urls[folder + '/' + name] || '',      // 분위기(mood)·속지 느낌(feel) 사진: 기기에 넣은 것이 있으면 그 주소
        keys: () => Object.keys(urls),
        info: key => info[key] || null,
        totalSize: () => Object.values(info).reduce((a, x) => a + (x.size || 0), 0)
    };
})();

// 사진 파일을 못 찾으면 다음 확장자를 시도하고, 모두 없으면 사진 칸을 없앰
function photoFallback(el) {
    const i = parseInt(el.getAttribute('data-i') || '0', 10) + 1;
    const urls = fabricPhotoUrls(el.getAttribute('data-id'), el.getAttribute('data-color') || '');
    if (i < urls.length) { el.setAttribute('data-i', i); el.src = urls[i]; } else { el.style.visibility = 'hidden'; }
}

// ==============================================================
// 원단 색상 (샘플북에서 같은 원단이 번호별로 색이 다른 경우: 예) 블랑 1~10번)
//  - 색상은 번호(또는 이름)로 구분하고, 색마다 톤을 지정합니다. 가격은 원단 단위로 같습니다.
//  - 견적서·발주서에는 "블랑 3번"처럼 표시됩니다.
// ==============================================================
let __colorsCache = null;
function normalizeColorName(v) {
    const s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    if (!s) return '';
    const m = /^(\d+)\s*번?$/.exec(s);
    return m ? String(parseInt(m[1], 10)) : s;
}
// 견적서·카드에 붙는 색 표시. 번호는 그대로 두고(공급처 주문·사진 파일 이름 기준), 색 이름이 있으면 괄호로 덧붙임
// 예) " 1번 (그레이지)"
// 색이 하나뿐인 원단(포아 POA1처럼 번호마다 다른 원단)은 번호를 빼고 색 이름만: "POA1 (화이트)" (10-17, "POA1 1번" 겹침 고침)
function colorSuffix(name, fabricId) {
    const n = normalizeColorName(name);
    if (!n) return '';
    const label = fabricId ? colorLabelOf(fabricId, n) : '';
    const isNo = /^\d+$/.test(n);
    if (isNo && fabricId && getFabricColors(fabricId).length < 2) return label ? ` (${label})` : '';      // 번호일 때만 뺌 (글자로 된 색은 그대로)
    const base = isNo ? ` ${n}번` : ` ${n}`;
    return label ? `${base} (${label})` : base;
}
// 색 이름(예: 그레이지). 고객에게 보여주는 이름일 뿐, 색을 구분하는 기준은 번호
function colorLabelOf(fabricId, name) {
    const c = getFabricColors(fabricId).find(x => x.name === normalizeColorName(name));
    return (c && c.label) ? c.label : '';
}
function setColorLabel(id, name, label) {
    const c = getFabricColors(id).find(x => x.name === normalizeColorName(name));
    if (!c) return;
    const v = String(label == null ? '' : label).trim().slice(0, 20);
    if (v) c.label = v; else delete c.label;
    saveColorsStore();
}
function colorsStore() {
    if (__colorsCache) return __colorsCache;
    try { const t = JSON.parse(localStorage.getItem(STORE_KEYS.colors)); __colorsCache = (t && typeof t === 'object') ? t : {}; } catch (e) { __colorsCache = {}; }
    return __colorsCache;
}
function saveColorsStore() {
    try { localStorage.setItem(STORE_KEYS.colors, JSON.stringify(colorsStore())); } catch (e) { console.warn('색상 저장 실패', e); }
}
function replaceColorsStore(obj) { __colorsCache = (obj && typeof obj === 'object') ? obj : {}; saveColorsStore(); }
function colorSort(a, b) {
    const na = /^\d+$/.test(a.name), nb = /^\d+$/.test(b.name);
    if (na && nb) return parseInt(a.name, 10) - parseInt(b.name, 10);
    if (na !== nb) return na ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
}
function getFabricColors(id) { return colorsStore()[id] || []; }
function hasColorTones(id) { return getFabricColors(id).some(c => !!c.tone); }
function addFabricColors(id, names) {
    const store = colorsStore(); const list = store[id] || [];
    let added = 0;
    names.map(normalizeColorName).filter(Boolean).forEach(n => { if (!list.some(c => c.name === n)) { list.push({ name: n, tone: null }); added++; } });
    list.sort(colorSort); store[id] = list; saveColorsStore();
    return added;
}
function setColorTone(id, name, tone) {
    const c = getFabricColors(id).find(x => x.name === normalizeColorName(name));
    if (!c) return;
    c.tone = (tone && TONE_LABELS[tone]) ? tone : null;
    saveColorsStore();
}
function removeFabricColor(id, name) {
    const store = colorsStore(); const n = normalizeColorName(name);
    store[id] = (store[id] || []).filter(c => c.name !== n);
    if (store[id].length === 0) delete store[id];
    saveColorsStore();
}
// 색상코드(#RRGGBB)와 색 값(붉은기 a · 노란기 b): 색상 입력표의 선택 열. 원단 찾기의 카드 색·채도·색조·비슷한 색·색 지도에 쓰임
function normalizeHexInput(v) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(v == null ? '' : v).trim());
    return m ? '#' + m[1].toUpperCase() : null;
}
function normalizeLabInput(v) {
    const s = String(v == null ? '' : v).trim().replace(',', '.').replace('−', '-');
    if (!s) return null;
    const n = Number(s);
    return (isFinite(n) && n >= -128 && n <= 128) ? Math.round(n * 10) / 10 : null;
}
// 색상 입력표(엑셀/CSV) 행을 읽어 반영: 열 이름에 "원단 ID", "색상", "톤"이 들어 있으면 됩니다. ("색 이름", "밝기", "색상코드", "붉은기", "노란기" 열은 있으면 읽음)
function importColorRows(rows) {
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const t = (rows[i] || []).map(x => String(x == null ? '' : x)).join('|');
        if (t.includes('원단') && t.includes('ID') && t.includes('색상')) { hi = i; break; }
    }
    if (hi < 0) return { error: "머리글(원단 ID, 색상, 색상 톤)을 찾지 못했습니다." };
    const head = rows[hi].map(x => String(x == null ? '' : x));
    const iId = head.findIndex(h => h.includes('원단') && h.includes('ID'));
    const iExact = head.findIndex(h => h.trim() === '색상');                         // 딱 "색상"인 열이 먼저 ("색상코드"·"색상 톤"과 헷갈리지 않게)
    const iColor = iExact >= 0 ? iExact : head.findIndex(h => h.includes('색상') && !h.includes('톤') && !h.includes('파일') && !h.includes('코드'));
    const iTone = head.findIndex(h => h.includes('톤'));
    const iLabel = head.findIndex(h => h.includes('이름') && !h.includes('ID'));     // 선택: "색 이름"·"가까운 이름" 열
    const iLight = head.findIndex(h => h.includes('밝기'));                          // 선택: "밝기" 열 (L값 0~100)
    const iHex = head.findIndex(h => h.includes('색상코드'));                        // 선택: "색상코드" 열 (#RRGGBB)
    const iA = head.findIndex(h => h.includes('붉은기'));                            // 선택: "붉은기" 열 (a값)
    const iB = head.findIndex(h => h.includes('노란기'));                            // 선택: "노란기" 열 (b값)
    const known = new Set(FABRIC_DB.map(f => f.id));
    const next = {}; let colorCount = 0, unknown = 0;
    for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const id = String(r[iId] == null ? '' : r[iId]).trim();
        const name = normalizeColorName(r[iColor]);
        if (!id || id.startsWith('(예시)') || !name) continue;
        if (!known.has(id)) { unknown++; continue; }
        next[id] = next[id] || [];
        if (next[id].some(c => c.name === name)) continue;
        const entry = { name, tone: iTone >= 0 ? normalizeToneInput(r[iTone]) : null };
        const label = iLabel >= 0 ? String(r[iLabel] == null ? '' : r[iLabel]).trim().slice(0, 20) : '';
        if (label) entry.label = label;
        const light = iLight >= 0 ? normalizeLightInput(r[iLight]) : null;
        if (light != null) entry.light = light;
        const hex = iHex >= 0 ? normalizeHexInput(r[iHex]) : null;
        if (hex) entry.hex = hex;
        const a = iA >= 0 ? normalizeLabInput(r[iA]) : null, b = iB >= 0 ? normalizeLabInput(r[iB]) : null;
        if (a != null && b != null) { entry.a = a; entry.b = b; }
        next[id].push(entry);
        colorCount++;
    }
    Object.keys(next).forEach(id => next[id].sort(colorSort));
    // 입력표에 등장한 원단만 교체하고, 나머지 원단의 기존 색상은 유지
    const store = colorsStore();
    Object.keys(next).forEach(id => { store[id] = next[id]; });
    saveColorsStore();
    return { fabrics: Object.keys(next).length, colors: colorCount, unknown };
}
// 한 원단에서 공간(바닥·벽·분위기·채광)에 가장 잘 어울리는 색을 고름
function rankColorsFor(fabric, room, category) {
    const colors = getFabricColors(fabric.id);
    const ranked = colors.map(c => {
        const view = Object.assign({}, fabric, { tone: c.tone || fabric.tone, light: typeof c.light === 'number' ? c.light : fabric.light, manual: Object.assign({}, fabric.manual, { tone: !!c.tone || !!(fabric.manual && fabric.manual.tone) }) });
        const link = category === '블라인드' ? 0 : roomLinkBonus(c, room);      // 고객이 고른 색 잇기 방향 (20번)
        return { name: c.name, tone: c.tone || null, score: calculateFabricMatchScore(view, room, category) + link + (c.tone ? 0.5 : 0) };
    });
    ranked.sort((a, b) => (b.score - a.score) || colorSort(a, b));
    return ranked;
}
function bestColorFor(fabric, room, category) {
    const colors = getFabricColors(fabric.id);
    if (colors.length === 0) return { color: null, score: calculateFabricMatchScore(fabric, room, category), ranked: [], classified: false };
    const ranked = rankColorsFor(fabric, room, category);
    const classified = colors.some(c => !!c.tone);
    // 원단끼리 비교할 때는 색상 순서용 가산점(+0.5)을 빼서, 색상을 등록하지 않은 단색 원단과 공평하게 비교
    return { color: classified ? ranked[0].name : null, score: ranked[0].score - (ranked[0].tone ? 0.5 : 0), ranked, classified };
}

// ==============================================================
// 원단 찾기 (직원 화면 › 원단 › 찾기): 원단의 색 하나 = 카드 한 장. 색이 없는 원단은 원단 한 장
//  - "원단만 시킬 때" 품목(고객 추천에서 숨긴 것)은 빼고 보여 줌. 블라인드는 색 정보(색상코드·밝기·색 값)가 들어온 색만 나옴
//  - 색 값: 밝기 L(0~100) · 붉은기 a · 노란기 b → 채도 C = √(a²+b²), 색조 각도 h = atan2(b, a) (0~360°)
// ==============================================================
const LIGHT_BAND_LABELS = { l5: '아주 밝음', l4: '밝음', l3: '중간', l2: '진함', l1: '아주 진함' };
function lightBandOf(L) { return typeof L !== 'number' ? null : (L >= 85 ? 'l5' : (L >= 70 ? 'l4' : (L >= 55 ? 'l3' : (L >= 40 ? 'l2' : 'l1')))); }
const CHROMA_LABELS = { s0: '거의 없음', s1: '은은함', s2: '또렷함', s3: '선명함' };
function chromaBandOf(C) { return typeof C !== 'number' ? null : (C < 3.5 ? 's0' : (C < 8 ? 's1' : (C < 15 ? 's2' : 's3'))); }
const HUE_LABELS = { gray: '회색 (무채색)', beige: '베이지·브라운', yellow: '크림·노랑·올리브', red: '핑크·로즈·붉은 브라운', green: '민트·그린', blue: '블루·네이비' };
function hueGroupOf(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') return null;
    if (Math.hypot(a, b) < 3.5) return 'gray';
    const h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    return (h < 60 || h >= 330) ? 'red' : (h < 95 ? 'beige' : (h < 140 ? 'yellow' : (h < 200 ? 'green' : 'blue')));
}
// 색 번호는 두 자리로 보여 줌 (샘플북 표기: 01, 02 …). 이름으로 넣은 색은 그대로
function colorNoLabel(name) { return /^\d+$/.test(String(name)) ? String(name).padStart(2, '0') : String(name || ''); }
// 원단 폭: 대폭 = 270cm 이상 (블라인드는 해당 없음). 책자의 폭 표기에 ±3cm쯤 오차가 있어 279cm(110인치)도 대폭으로 봄
const WIDE_SPEC_CM = 270;
const WIDTH_LABELS = { wide: '대폭', normal: '일반폭' };
// 가격대(직원 화면 전용): 판매가를 같은 종류·같은 단위끼리(속지 Y당, 겉지 Y당, 겉지 폭당 …) 낮은 순으로 줄 세워 셋으로 나눔
//  - tier = 낮음/중간/높음, rank = 그 묶음 안에서의 자리(0 = 가장 낮음 ~ 1 = 가장 높음. 단위가 다른 원단끼리 "가격 낮은 순"으로 줄 세울 때 씀)
const PRICE_TIER_LABELS = { low: '낮음', mid: '중간', high: '높음' };
function fabricPriceTiers(list) {
    const groups = {}, out = {};
    list.forEach(f => { const k = `${f.categoryType}|${f.calcType}`; (groups[k] = groups[k] || []).push(f); });
    Object.keys(groups).forEach(k => {
        const g = groups[k], prices = g.map(f => f.price || 0).sort((a, b) => a - b), n = prices.length;
        const t1 = prices[Math.ceil(n / 3) - 1], t2 = prices[Math.ceil(2 * n / 3) - 1];
        g.forEach(f => {
            const p = f.price || 0;
            out[f.id] = n < 2 ? { tier: 'mid', rank: 0.5 } : { tier: p <= t1 ? 'low' : (p <= t2 ? 'mid' : 'high'), rank: prices.indexOf(p) / (n - 1) };
        });
    });
    return out;
}
function finderEntries() {
    const out = [];
    const tiers = fabricPriceTiers(FABRIC_DB.filter(f => !isCustomerHidden(f)));
    FABRIC_DB.forEach(f => {
        if (isCustomerHidden(f)) return;
        const m = f.manual || {};
        const blind = f.categoryType === '블라인드' || f.calcType === 'hebe';
        const sheer = !blind && f.categoryType === '속지';
        const make = c => {
            const tone = (c && c.tone) || (m.tone ? f.tone : null);          // 직접 정한 톤만 (이름으로 추측한 톤은 "미정")
            const L = (c && typeof c.light === 'number') ? c.light : (typeof f.light === 'number' ? f.light : null);
            const hasAb = !!(c && typeof c.a === 'number' && typeof c.b === 'number');
            const C = hasAb ? Math.hypot(c.a, c.b) : null;
            // 느낌은 색마다: 색의 톤·밝기를 덮어써서 계산 (rankColorsFor와 같은 방식)
            const view = c ? Object.assign({}, f, { tone: c.tone || f.tone, light: L, manual: Object.assign({}, m, { tone: !!c.tone || !!m.tone }) }) : f;
            return {
                key: f.id + '__' + (c ? c.name : ''), fabric: f, fabricId: f.id, book: f.book, fabName: f.name, cat: blind ? 'blind' : (sheer ? 'sheer' : 'drape'),
                color: c ? c.name : '', no: c ? colorNoLabel(c.name) : '', label: (c && c.label) || '',
                tone, L, band: lightBandOf(L), hex: (c && c.hex) || null, a: hasAb ? c.a : null, b: hasAb ? c.b : null,
                C, sat: chromaBandOf(C), hue: hasAb ? hueGroupOf(c.a, c.b) : null,
                texture: (f.texture && TEXTURE_LABELS[f.texture]) ? f.texture : null,
                blackout: (sheer || blind) ? null : blackoutLevel(f),
                density: (sheer && m.density && DENSITY_LABELS[f.density]) ? f.density : null,
                blindLight: blind ? blindLight(f) : null, blindKind: blind ? blindKind(f) : null,      // 블라인드: 암막/일반/투시 · 콤비/롤/프린트
                specCm: blind ? null : (f.specCm || null), wide: (blind || !f.specCm) ? null : (f.specCm >= WIDE_SPEC_CM ? 'wide' : 'normal'),
                price: f.price || 0, priceTier: tiers[f.id].tier, priceRank: tiers[f.id].rank,
                view,       // 이 색의 톤·밝기를 입힌 원단 (공간에 어울리는 점수를 낼 때 씀)
                mood: hasMoodInput(f) ? moodOf(view) : null
            };
        };
        const colors = getFabricColors(f.id);
        (colors.length ? colors.map(make) : [make(null)]).forEach(e => { if (!blind || e.hex || e.L != null || e.a != null) out.push(e); });
    });
    return out;
}
// 두 색이 얼마나 다른지: Lab 거리 ΔE = √(ΔL² + Δa² + Δb²). 색 값(밝기·붉은기·노란기)이 모두 있는 색끼리만 잼
function finderHasLab(e) { return !!e && e.L != null && e.a != null && e.b != null; }
function colorDistance(p, q) { return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b); }
// ---- 벽·바닥 잇기: 직원 화면 원단 찾기의 세 방식(15번)과 고객 화면 "색 잇기"(20번)가 같은 계산을 씀 ----
//  - bridge(그 중간으로 = 벽·바닥 이어주기): 벽~바닥을 잇는 선 가까이(BRIDGE_TUBE 안)의 색 중 "이어주는 색"(벽 쪽에 가까운 점)에 가까운 순
//  - wall(넓어 보이게 = 벽과 맞추기): 벽과 색 차이가 작은 순 / floor(바닥과 어울리게): 바닥보다 밝은 색 중 "바닥 + 밝기 14" 근처 순
const BRIDGE_TUBE = 11.5;      // 임시값 (현장 시험 뒤 확정)
const FLOOR_LIFT = 14;         // 바닥과 맞추기: 바닥보다 이만큼 밝은 색 근처를 먼저 (밝기 88까지)
function roomLinkOk(mc, mode) {
    return !!mc && (mode === 'bridge' ? !!(mc.wall && mc.floor && mc.bridge) : !!mc[mode]);
}
// 점에서 벽~바닥 선분까지 거리(line)와 이어주는 색까지 거리(target)
function bridgeDistances(e, mc) {
    const w = mc.wall, f = mc.floor;
    const v = [f.L - w.L, f.a - w.a, f.b - w.b], d = [e.L - w.L, e.a - w.a, e.b - w.b];
    const len2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2] || 1;
    const t = Math.max(0, Math.min(1, (d[0] * v[0] + d[1] * v[1] + d[2] * v[2]) / len2));
    const line = Math.hypot(d[0] - t * v[0], d[1] - t * v[1], d[2] - t * v[2]);
    return { line, target: colorDistance(e, mc.bridge) };
}
// 색 하나(e: L·a·b)가 그 방식에 얼마나 맞는지: 작을수록 잘 맞음. 맞지 않으면 null (띠 밖, 바닥보다 어두움 등)
function roomLinkDistance(e, mc, mode) {
    if (!roomLinkOk(mc, mode) || typeof e.L !== 'number' || typeof e.a !== 'number' || typeof e.b !== 'number') return null;
    if (mode === 'bridge') {
        const d = bridgeDistances(e, mc), lowL = Math.min(mc.wall.L, mc.floor.L) - 4;
        return (d.line <= BRIDGE_TUBE && e.L >= lowL) ? d.target * 0.65 + d.line * 0.35 : null;
    }
    if (mode === 'wall') return colorDistance(e, mc.wall);
    if (e.L < mc.floor.L) return null;
    return colorDistance(e, { L: Math.min(88, mc.floor.L + FLOOR_LIFT), a: mc.floor.a, b: mc.floor.b });
}
// 고객 화면 "색 잇기" 답을 원단 추천에 더하는 점수 (겉지·속지, 색 값이 있는 색만). 거리 0이면 +LINK_WEIGHT, LINK_RANGE 이상이면 0
//  - 처음 값(20번 3단계, Claude Code 제안): 속지 느낌 +8과 같은 무게. 현장에서 써 보며 사장님이 정함
const LINK_WEIGHT = 8, LINK_RANGE = 20;
function roomLinkBonus(c, room) {
    if (!room || !room.linkDir || !c) return 0;
    const d = roomLinkDistance({ L: c.light, a: c.a, b: c.b }, room.measuredColor, room.linkDir);
    return d == null ? 0 : LINK_WEIGHT * Math.max(0, 1 - d / LINK_RANGE);
}
function colorDistanceWord(d) { return d < 3 ? '거의 같음' : (d < 6 ? '아주 비슷' : (d < 10 ? '비슷' : '조금 다름')); }

// ---- 사장님이 직접 지정한 분류(덮어쓰기). 엑셀을 다시 불러와도 유지됩니다 ----
function loadTagOverrides() {
    try { const t = JSON.parse(localStorage.getItem(STORE_KEYS.tags)); return (t && typeof t === 'object') ? t : {}; } catch (e) { return {}; }
}
function saveTagOverrides(o) {
    try { localStorage.setItem(STORE_KEYS.tags, JSON.stringify(o)); } catch (e) { console.warn('분류 저장 실패', e); }
}
function applyTagOverrides(list) {
    const o = loadTagOverrides();
    (list || FABRIC_DB).forEach(f => {
        f.manual = f.manual || { tone: false, mood: false };
        const t = o[f.id];
        if (t && t.tone && TONE_LABELS[t.tone]) { f.tone = t.tone; f.manual.tone = true; }
        if (t && t.mood && MOOD_LABELS[t.mood]) { f.mood = t.mood; f.manual.mood = true; }
        if (t && t.density && DENSITY_LABELS[t.density]) { f.density = t.density; f.manual.density = true; }
        if (t && t.blackout && BLACKOUT_LABELS[t.blackout]) { f.blackout = t.blackout; f.manual.blackout = true; }
        if (t && t.texture && TEXTURE_LABELS[t.texture]) { f.texture = t.texture; f.manual.texture = true; }
        f.hideOverride = (t && (t.hide === 'yes' || t.hide === 'no')) ? t.hide : null;
    });
}

// 고객 추천에서 숨길 원단인지: 사장님이 직접 정한 값이 우선, 없으면 비고의 "원단만 시킬때"를 따름
function isCustomerHidden(f) {
    if (!f) return true;
    if (f.hideOverride === 'yes') return true;
    if (f.hideOverride === 'no') return false;
    return !!f.fabricOnly;
}
function setFabricTag(id, key, val) {
    const o = loadTagOverrides();
    o[id] = o[id] || {};
    if (!val) delete o[id][key]; else o[id][key] = val;
    if (!o[id].tone && !o[id].mood && !o[id].density && !o[id].hide && !o[id].blackout && !o[id].texture) delete o[id];
    saveTagOverrides(o);
    const f = FABRIC_DB.find(x => x.id === id);
    if (f && key === 'hide') {
        f.hideOverride = val || null;
    } else if (f && key === 'texture') {
        f.texture = val || null; f.manual = f.manual || {}; f.manual.texture = !!val;
    } else if (f && key === 'blackout') {
        f.blackout = val || null; f.manual = f.manual || {}; f.manual.blackout = !!val;
    } else if (f) {
        if (!val) { f[key] = null; f.manual = f.manual || {}; f.manual[key] = false; if (key !== 'density') f.tags = null; autoTagFabricAttributes(f); applyTagOverrides([f]); }
        else { f[key] = val; f.manual = f.manual || {}; f.manual[key] = true; }
    }
    saveFabricDb(false);
    if (typeof renderTagEditor === 'function') renderTagEditor();
}
function clearFabricTags(id) {
    const o = loadTagOverrides();
    const keepHide = o[id] && o[id].hide;                  // "고객 추천 숨김" 설정은 그대로 둠
    if (keepHide) o[id] = { hide: keepHide }; else delete o[id];
    saveTagOverrides(o);
    const f = FABRIC_DB.find(x => x.id === id);
    if (f) { f.tone = null; f.mood = null; f.density = null; f.blackout = null; f.texture = null; f.tags = null; f.manual = { tone: false, mood: false, density: false, blackout: false, texture: false }; autoTagFabricAttributes(f); }
    saveFabricDb(false);
    if (typeof renderTagEditor === 'function') renderTagEditor();
}

// ==============================================================
// 저장소 (localStorage)
// ==============================================================
function updateDbBadgeText(text) {
    const badge = document.getElementById('dbLoadedBadge');
    if (badge) badge.textContent = text;
}

function loadPrivateStore() {
    try {
        const raw = localStorage.getItem(STORE_KEYS.priv);
        if (raw) Costing.setPrivate(JSON.parse(raw));
    } catch (e) { console.warn('비공개 보관함 읽기 실패', e); }
}

function savePrivateStore() {
    localStorage.setItem(STORE_KEYS.priv, JSON.stringify({ rules: Costing.state.rules, costs: Costing.state.costs }));
}

function loadFabricDb() {
    let loaded = null;
    try {
        const saved = localStorage.getItem(STORE_KEYS.fabrics);
        if (saved) loaded = JSON.parse(saved);
    } catch (e) { loaded = null; }
    if (!Array.isArray(loaded) || loaded.length === 0) loaded = JSON.parse(JSON.stringify(SAMPLE_FABRICS));
    FABRIC_DB = loaded.map(f => autoTagFabricAttributes(f));
    applyTagOverrides(FABRIC_DB);
    if (typeof updateBookFilterOptions === 'function') updateBookFilterOptions();
    if (typeof renderDbTable === 'function') renderDbTable();
    updateDbBadgeText(`DB 품목 (${FABRIC_DB.length}개)`);
}

function saveFabricDb(triggerRoomsRender = true) {
    localStorage.setItem(STORE_KEYS.fabrics, JSON.stringify(FABRIC_DB));
    if (typeof updateBookFilterOptions === 'function') updateBookFilterOptions();
    if (typeof renderDbTable === 'function') renderDbTable();
    if (triggerRoomsRender && typeof renderRooms === 'function') renderRooms();
    if (typeof calculateAll === 'function') calculateAll();
    updateDbBadgeText(`보관 품목 (${FABRIC_DB.length}개)`);
}

// ==============================================================
// 단가표 가져오기 (엑셀/CSV 행 → 공개 원단 + 비공개 원가)
// ==============================================================
function buildFabricRecords(dataRows, rules) {
    let headerIdx = -1;
    for (let i = 0; i < Math.min(dataRows.length, 10); i++) {
        const rowStr = (dataRows[i] || []).join(' ');
        if (rowStr.includes('책자') || rowStr.includes('품명') || rowStr.includes('단가') || rowStr.includes('원가') || rowStr.includes('공급처')) {
            headerIdx = i;
            break;
        }
    }
    if (headerIdx === -1) return { fabrics: [], costs: {}, error: '머리글(책자명·품명·단가 등)을 찾지 못했습니다.' };

    const rawHeaders = dataRows[headerIdx];
    const fabrics = [];
    const costs = {};
    const usedIds = {};
    let priceDerived = 0;

    for (let i = headerIdx + 1; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0 || !row.some(c => String(c == null ? '' : c).trim() !== '')) continue;

        const rowMap = {};
        rawHeaders.forEach((h, colIdx) => {
            const normH = String(h || '').trim().replace(/[\s\/_()%]/g, '').toLowerCase();
            rowMap[normH] = (row[colIdx] !== undefined && row[colIdx] !== null) ? String(row[colIdx]).trim() : '';
        });
        const getCol = (aliases) => {
            for (const a of aliases) {
                const norm = a.replace(/[\s\/_()%]/g, '').toLowerCase();
                if (rowMap[norm] !== undefined && rowMap[norm] !== '') return rowMap[norm];
            }
            return '';
        };

        const supplier = getCol(['공급처', '거래처', '매입처', '공장']) || '일반';
        const book = getCol(['책자명', '책자', '샘플북', '브랜드']) || "기타";
        let rawCode = getCol(['품번코드', '품번', '코드', 'id']);
        const name = getCol(['품명', '원단명', '품목명', '제품명']) || `품목 ${i}`;
        const specRaw = getCol(['규격사이즈', '규격', '폭', 'cm', '폭cm']) || "150";
        if (!rawCode || rawCode.trim() === '-' || rawCode.trim() === '') rawCode = '';

        // 안정적인 ID: 행 번호가 아니라 책자+품번(없으면 품명)으로 만들고, 겹치면 번호를 붙임
        let baseId = `${book}_${rawCode || name}`.replace(/[\s()\/'"`\\<>&]/g, '_');
        usedIds[baseId] = (usedIds[baseId] || 0) + 1;
        const uid = usedIds[baseId] === 1 ? baseId : `${baseId}_${usedIds[baseId]}`;

        const costRaw = getCol(['기본단가', '원단원가', '공급가', '공급원가', '원가', '사입가', '단가']);
        const laborRaw = getCol(['가공비', '봉제비', '수공비', '공임']);
        const priceRaw = getCol(['소비자판매단가', '소비자판매가', '소비자가', '판매단가', '판매가']);
        const unitRaw = getCol(['계산단위', '단위', '계산방식']);
        const imgUrlRaw = getCol(['이미지url', '이미지', '사진', 'image', 'imgurl', '이미지링크']);
        const noteRaw = getCol(['비고', '메모']);

        const detected = detectCalcTypeAndUnit(costRaw, specRaw, name, unitRaw, "", book, "");
        const parsedSpecCm = (detected.calcType === 'hebe') ? 0 : parseSpecToCm(specRaw, name);
        const cost = cleanNumber(costRaw);
        const labor = laborRaw !== "" ? cleanNumber(laborRaw) : 0;

        let price = cleanNumber(priceRaw);
        if (price <= 0) {
            price = Costing.derivePrice(cost, labor, detected.calcType, rules);
            priceDerived++;
        }

        const fabObj = {
            book, id: uid, name, calcType: detected.calcType, specCm: parsedSpecCm,
            unit: detected.unit, price,
            categoryType: getCol(['상세구분', '구분', '카테고리']) || null,
            tone: normalizeToneInput(getCol(['언더톤', '톤', '색조'])),
            mood: normalizeMoodInput(getCol(['대표무드', '무드', '스타일'])),
            density: normalizeDensityInput(getCol(['비침', '두께', '도톰함', '밀도'])),
            texture: normalizeTextureInput(getCol(['질감', '텍스처'])),
            light: normalizeLightInput(getCol(['밝기'])),      // 색이 하나뿐인 원단용 (색이 여러 개면 색상 입력표의 밝기)
            imageUrl: imgUrlRaw || null,
            fabricOnly: /원단만/.test(noteRaw),      // 비고에 "원단만 시킬때" → 고객 추천에서 기본 숨김
            blindKind: detectBlindKind(noteRaw),     // 블라인드 종류 (콤비/롤/프린트). 커튼은 비어 있음
            extra: Costing.deriveExtra(cost, labor, rules)
        };
        fabObj.manual = { tone: !!fabObj.tone, mood: !!fabObj.mood, density: !!fabObj.density, texture: !!fabObj.texture };      // 엑셀에 직접 적힌 값인지 기록 (자동 추정 구분용)
        fabrics.push(autoTagFabricAttributes(fabObj));
        costs[uid] = { supplier, cost, labor };
    }
    return { fabrics, costs, priceDerived };
}

// 새 단가표로 교체했을 때, 진행 중인 견적이 없어진 원단을 가리키면 알려 줌
// (알리지 않으면 조용히 다른 원단 가격으로 바뀌어 버립니다)
function warnIfQuoteFabricsMissing() {
    try {
        const ids = new Set(FABRIC_DB.map(f => f.id));
        const missing = rooms.some(r => r.curtains.some(c => !ids.has(c.fabricId)));
        if (missing) showToast("진행 중인 견적의 원단이 새 단가표에 없습니다. '새 상담'으로 다시 시작해 주세요.", "error");
    } catch (e) {}
}

// 가져오기 결과를 실제로 적용
function applyImportedRows(dataRows, sourceName) {
    if (!Costing.state.rules) {
        showToast("먼저 '비공개 팩'을 불러와 주세요. (원가 규칙이 필요합니다)", "error");
        return 0;
    }
    const res = buildFabricRecords(dataRows, Costing.state.rules);
    if (res.error || res.fabrics.length === 0) {
        showToast(`'${sourceName}' 가져오기 실패: ${res.error || '원단을 찾지 못했습니다.'}`, "error");
        return 0;
    }
    FABRIC_DB = res.fabrics;
    applyTagOverrides(FABRIC_DB);
    Costing.setPrivate({ rules: Costing.state.rules, costs: res.costs });
    savePrivateStore();
    saveFabricDb(true);
    showToast(`'${sourceName}'에서 ${res.fabrics.length}개 원단을 등록했습니다.`, "success");
    warnIfQuoteFabricsMissing();
    return res.fabrics.length;
}

function handleFabricFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') { showToast("엑셀 읽기 도구를 불러오지 못했습니다. 인터넷 연결을 확인하거나 CSV로 저장해 올려주세요.", "error"); event.target.value = ''; return; }
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const sheetName = wb.SheetNames.find(n => n.includes('통합')) || wb.SheetNames[0];
                const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
                applyImportedRows(rows, `${file.name} · ${sheetName}`);
            } catch (err) {
                showToast("엑셀 파일을 읽지 못했습니다: " + err.message, "error");
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        Papa.parse(file, {
            header: false,
            skipEmptyLines: 'greedy',
            complete: function (results) {
                if (results && results.data && results.data.length > 0) applyImportedRows(results.data, file.name);
                else showToast(`'${file.name}' 파일이 비어있거나 읽을 수 없습니다.`, "error");
            },
            error: function (err) { showToast(`CSV 파일 읽기 오류: ${err.message}`, "error"); }
        });
    }
    event.target.value = '';
}

// ==============================================================
// 비공개 팩 (원가 규칙 + 원단 원가 + 원단 목록) 불러오기 / 백업 내보내기
// ==============================================================
function applyPrivatePack(pack) {
    if (!pack || pack.type !== 'redam-private-pack' || !pack.rules) throw new Error('Re.dam 비공개 팩 형식이 아닙니다.');
    Costing.setPrivate({ rules: pack.rules, costs: pack.costs || {} });
    savePrivateStore();
    if (pack.tags && typeof pack.tags === 'object') saveTagOverrides(pack.tags);
    if (pack.colors && typeof pack.colors === 'object') replaceColorsStore(pack.colors);
    if (pack.ticket && typeof applyTicketTextsFromPack === 'function') applyTicketTextsFromPack(pack.ticket);
    if (pack.prices && typeof pack.prices === 'object' && Object.keys(pack.prices).length) saveOptionPricesStore(pack.prices);      // 가공·부자재 단가와 원가 (29번)
    if (typeof renderOptionPriceSettings === 'function') renderOptionPriceSettings();      // 원가 칸의 팩 값도 새로
    if (Array.isArray(pack.history) && typeof mergeHistoryFromPack === 'function') mergeHistoryFromPack(pack.history);      // 상담 기록은 덮어쓰지 않고 합침
    if (Array.isArray(pack.fabrics) && pack.fabrics.length > 0) {
        FABRIC_DB = pack.fabrics.map(f => autoTagFabricAttributes(f));
        applyTagOverrides(FABRIC_DB);
    }
    saveFabricDb(true);
    warnIfQuoteFabricsMissing();
    return FABRIC_DB.length;
}

function handlePrivatePackUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const pack = JSON.parse(e.target.result);
            const n = applyPrivatePack(pack);
            const h = (Array.isArray(pack.history) && typeof loadHistory === 'function') ? ` · 상담 기록 ${loadHistory().length}건` : '';
            showToast(`비공개 팩을 불러왔습니다. (원단 ${n}개${h})`, "success");
        } catch (err) {
            showToast("불러오기 실패: " + err.message, "error");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function exportPrivatePack() {
    if (!Costing.hasData()) { showToast("내보낼 원가 데이터가 없습니다.", "info"); return; }
    const pack = { type: 'redam-private-pack', version: 1, savedAt: new Date().toISOString(),
        rules: Costing.state.rules, costs: Costing.state.costs, fabrics: FABRIC_DB, tags: loadTagOverrides(), colors: colorsStore(),
        ticket: (typeof ticketTextsForPack === 'function') ? ticketTextsForPack() : undefined,        // 견적서 글(안내 문구·결제 조건·맞춤 제작 안내·공급자 정보)
        prices: storedOptionPrices(),                                                                 // 가공·부자재 단가와 원가 (이 기기에서 정한 칸만)
        history: (typeof loadHistory === 'function') ? loadHistory() : undefined };                    // 상담 기록(고객 이름·연락처 포함)
    const blob = new Blob([JSON.stringify(pack)], { type: 'application/json' });
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const link = document.createElement('a');
    link.download = `redam_private_pack_${stamp}.json`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("비공개 팩(백업)을 내려받았습니다. 안전한 곳에만 보관하세요.");
}

function hasLegacyData() {
    try { return localStorage.getItem(STORE_KEYS.legacy) !== null; } catch (e) { return false; }
}
function purgeLegacyData() {
    try { localStorage.removeItem(STORE_KEYS.legacy); } catch (e) {}
}

// ==============================================================
// 기본 공간 (새 상담 시작 시 직원 모드에 보이는 초기 상태)
// ==============================================================
function initDefaultRooms() {
    // 새 상담은 빈 상태로 시작합니다. 공간은 고객 화면에서 구성하거나 직원 화면에서 "공간 추가"로 만듭니다.
    roomIdCounter = 1;
    curtainIdCounter = 100;
    rooms = [];
}
