(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['data.js']='20261023';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
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

let globalInstallFee = 30000;
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
        // 이중커튼: 낮에는 속지만 쳐 두고 지내므로 덜 비치는 속지를 우대 (겉지는 필요할 때만)
        if (dbl && (fabric.density === 'day' || fabric.density === 'heavy')) score += 2;
        // 질감 취향: 속지는 "깔끔파(쉬폰)"와 "질감파(린넨·네프)"가 확연히 나뉨 → 맞으면 +8, 반대면 -4, 포근은 결 선택 때만 +3 (질감 미입력 원단은 0)
        const tx = fabric.texture;
        if (room.sheerFeel === 'smooth' && tx) score += tx === 'smooth' ? 8 : -4;
        if (room.sheerFeel === 'textured' && tx) score += tx === 'natural' ? 8 : (tx === 'cozy' ? 3 : -4);
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
function recommendReason(fabric, room, category, maxParts) {
    if (!isManualTagged(fabric)) return '';
    const floorT = room.floorTone || 'warm', wallT = room.wallTone || 'warm';
    const targetMood = room.wantMood || deriveRoomMood(room);
    const parts = [];
    if (moodOf(fabric) === targetMood) parts.push(room.wantMood ? `${MOOD_LABELS[targetMood]} 분위기` : MOOD_HINTS[targetMood]);
    if (fabric.tone === 'neutral') parts.push(floorT !== wallT ? '바닥과 벽을 잇는 톤' : '어디에나 어울리는 톤');
    else if (fabric.tone === floorT) parts.push(`바닥과 어울리는 ${TONE_LABELS[floorT]} 톤`);
    else if (fabric.tone === wallT) parts.push(`벽과 어울리는 ${TONE_LABELS[wallT]} 톤`);
    if (category === '속지' && room.lightLevel === 'high' && (fabric.density === 'heavy' || fabric.density === 'day')) parts.push('강한 햇빛을 거르는 비침');
    if (category === '속지' && room.sheerFeel && fabric.texture) {
        const msg = room.sheerFeel === 'smooth' && fabric.texture === 'smooth' ? '깔끔하고 매끈한 결'
            : room.sheerFeel === 'textured' && fabric.texture !== 'smooth' ? '자연스럽게 살아 있는 결' : '';
        if (msg) parts.unshift(msg);   // 고객이 고른 취향 → 앞쪽 (사생활 문장 다음)
    }
    if (category === '속지' && room.privacy) {
        const d = fabric.density;
        const msg = room.privacy === 'high' && (d === 'heavy' || d === 'day') ? '낮에도 안이 보이지 않는 비침'
            : room.privacy === 'some' && (d === 'day' || d === 'medium') ? '적당히 가리는 은은한 비침'
            : room.privacy === 'open' && d === 'light' ? '풍경과 햇살을 살리는 맑은 비침' : '';
        if (msg) parts.unshift(msg);       // 고객이 직접 고른 조건이라 맨 앞에
    }
    if (category === '겉지' && room.lightBlock) {
        const b = blackoutLevel(fabric);
        const msg = room.lightBlock === 'dark' && b === 'full' ? '빛을 거의 막는 완전 암막'
            : room.lightBlock === 'soft' && b === 'life' ? '눈부심만 줄이는 생활 암막'
            : room.lightBlock === 'soft' && b === 'mid' ? '빛을 살짝 거르는 원단'
            : room.lightBlock === 'light' && (b === 'none' || b === 'mid') ? '햇빛이 은은히 스미는 원단' : '';
        if (msg) parts.unshift(msg);       // 고객이 직접 고른 조건이라 맨 앞에
    }
    if (category === '블라인드' && room.lightBlock) {
        const bl = blindLight(fabric), kind = blindKind(fabric);
        const msg = room.lightBlock === 'dark' && bl === 'full' ? '빛을 거의 막는 암막'
            : room.lightBlock === 'light' && bl === 'see' ? '풍경은 살리고 햇빛만 거르는 투시'
            : room.lightBlock !== 'dark' && kind === 'combi' ? '각도로 빛을 맞추는 콤비' : '';
        if (msg) parts.unshift(msg);
    }
    // 짧은 말로 끝냄(예: 깔끔하고 매끈한 결). 원단 고르는 칸은 1개만, 제안서는 2개까지
    return parts.slice(0, maxParts || 2).join(' · ');
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
function fabricPhotoUrls(id, color) {
    const base = 'photos/' + encodeURIComponent(id);
    const generic = [base + '.jpg', base + '.webp', base + '.png'];
    const col = normalizeColorName(color);
    if (!col) return generic;
    const cb = base + '__' + encodeURIComponent(col);
    return [cb + '.jpg', cb + '.webp', cb + '.png'].concat(generic);
}

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
function colorSuffix(name, fabricId) {
    const n = normalizeColorName(name);
    if (!n) return '';
    const base = /^\d+$/.test(n) ? ` ${n}번` : ` ${n}`;
    const label = fabricId ? colorLabelOf(fabricId, n) : '';
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
// 색상 입력표(엑셀/CSV) 행을 읽어 반영: 열 이름에 "원단 ID", "색상", "톤"이 들어 있으면 됩니다. ("색 이름", "밝기" 열은 있으면 읽음)
function importColorRows(rows) {
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const t = (rows[i] || []).map(x => String(x == null ? '' : x)).join('|');
        if (t.includes('원단') && t.includes('ID') && t.includes('색상')) { hi = i; break; }
    }
    if (hi < 0) return { error: "머리글(원단 ID, 색상, 색상 톤)을 찾지 못했습니다." };
    const head = rows[hi].map(x => String(x == null ? '' : x));
    const iId = head.findIndex(h => h.includes('원단') && h.includes('ID'));
    const iColor = head.findIndex(h => h.includes('색상') && !h.includes('톤') && !h.includes('파일'));
    const iTone = head.findIndex(h => h.includes('톤'));
    const iLabel = head.findIndex(h => h.includes('이름') && !h.includes('ID'));     // 선택: "색 이름"·"가까운 이름" 열
    const iLight = head.findIndex(h => h.includes('밝기'));                          // 선택: "밝기" 열 (L값 0~100)
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
        return { name: c.name, tone: c.tone || null, score: calculateFabricMatchScore(view, room, category) + (c.tone ? 0.5 : 0) };
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
            const n = applyPrivatePack(JSON.parse(e.target.result));
            showToast(`비공개 팩을 불러왔습니다. (원단 ${n}개)`, "success");
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
        rules: Costing.state.rules, costs: Costing.state.costs, fabrics: FABRIC_DB, tags: loadTagOverrides(), colors: colorsStore() };
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
