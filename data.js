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

function calculateFabricMatchScore(fabric, room, category) {
    let score = 0;
    const fTone = fabric.tone || 'neutral';
    const floorT = room.floorTone || 'warm';
    const wallT = room.wallTone || 'warm';

    if (floorT === wallT) {
        if (fTone === floorT) score += 4;
        else if (fTone === 'neutral') score += 2;
    } else {
        if (fTone === 'neutral') score += 5;
        else if (fTone === floorT || fTone === wallT) score += 2;
    }

    if ((floorT === 'deep' || wallT === 'deep') && (fTone === 'deep' || fabric.mood === 'deep_private')) {
        score += 4;
    }

    if (fabric.mood === room.mood) {
        score += 4;
    } else {
        if (room.mood === 'soft_warm' && fabric.mood === 'textured_linen') score += 2;
        if (room.mood === 'urban_clean' && fabric.mood === 'airy_bright') score += 2;
        if (room.mood === 'balanced_neutral' && (fabric.mood === 'soft_warm' || fabric.mood === 'urban_clean')) score += 1;
    }

    if (fabric.categoryType === category) score += 2;
    return score;
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
            tone: getCol(['언더톤', '톤', '색조']) || null,
            mood: getCol(['대표무드', '무드', '스타일']) || null,
            imageUrl: imgUrlRaw || null,
            extra: Costing.deriveExtra(cost, labor, rules)
        };
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
    if (Array.isArray(pack.fabrics) && pack.fabrics.length > 0) {
        FABRIC_DB = pack.fabrics.map(f => autoTagFabricAttributes(f));
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
        rules: Costing.state.rules, costs: Costing.state.costs, fabrics: FABRIC_DB };
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
