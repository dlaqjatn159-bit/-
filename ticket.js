(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['ticket.js']='20261265';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// ticket.js — 최종 제안·견적서 이미지 (130-2에서 app.js에서 떼어 냄)
//  견적서·원단 이름·이유 카드·우리 집 색·조각보 표지·쇼룸 시트·저장·카톡 글·인쇄
//  견적서 설정 칸(안내 문구·유효 기간·배수·판매가 곡선)은 app.js에 그대로 있음
// ==============================================================

// ==============================================================
// 견적서 이미지 — 화면 캡처 대신 직접 그립니다 (글자 잘림 방지, 외부 라이브러리 불필요)
// ==============================================================
// ---- 제안서에 들어가는 "왜 이렇게 골랐는지" ----
// 품목별 추천 이유 (사장님이 분류한 원단 + 진단을 거친 공간만. 아니면 빈칸)
function ticketItemReason(r, c) {
    if (!r || !r.diagnosed || !c || !c.fabricId) return '';
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return '상담 때 실물 샘플로 보여 드리겠습니다';
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return '';
    const cat = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : '겉지');
    const col = c.colorName ? fabricColorOf(f.id, c.colorName) : null;
    const view = (col && col.tone) ? Object.assign({}, f, { tone: col.tone, manual: Object.assign({}, f.manual, { tone: true }) }) : f;
    try { return recommendReason(view, r, cat) || ''; } catch (e) { return ''; }
}
// "원단을 고른 이유" 카드 셋째 줄: 손님이 답한 조건(바깥 시선·빛 가림·강한 햇빛)을 이 원단이 지켜 주는 점 하나. 없으면 빈칸(그 줄만 생략)
function ticketKeepWord(r, c) {
    if (!r || !r.diagnosed || !c || !c.fabricId) return '';
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return '상담 때 실물 샘플로 보여 드리겠습니다.';
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return '';
    const cat = c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : '겉지');
    const col = c.colorName ? fabricColorOf(f.id, c.colorName) : null;
    const view = (col && col.tone) ? Object.assign({}, f, { tone: col.tone, manual: Object.assign({}, f.manual, { tone: true }) }) : f;
    try { return recommendReason(view, r, cat, 1, true) || ''; } catch (e) { return ''; }
}
// 원단 이름 다듬기: 괄호(폭·암막률·단가 등)·가격·앞의 책자 이름을 뺌. 다 빠지면 원래 이름 (130-1번에서 두 벌을 하나로)
function ticketCleanName(f) {
    let n = String(f.name || '').replace(/\([^)]*\)/g, ' ').replace(/[0-9,]+\s*원/g, ' ').replace(/\s+/g, ' ').trim();
    const book = String(f.book || '').trim();
    if (book && n.startsWith(book + ' ')) n = n.slice(book.length).trim();
    return n || String(f.name || '원단');
}
// 고객에게 보여 줄 원단 이름: 괄호(폭·암막률·단가 등)·가격·앞의 책자 이름을 빼고, 색 표시(예: 3번 (그레이지))는 붙임
function ticketFabricName(c, calc) {
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return sf.name;
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return (calc && calc.fabName) || c.label || '원단';
    return ticketCleanName(f) + colorSuffix(c.colorName, f.id);
}// 견적서 원단 칸 이름 (75번, 10-25 사장님): 책자에 적힌 원단 이름 + 색 번호만. 예) 블랑 1번
//  책자·공급처 이름, 괄호(폭·단가), 색 이름 괄호는 뺌. 색이 하나뿐인 원단(POA1 등)은 번호 없이 이름만
function ticketBookName(c) {
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return sf.name;
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return c.name || '원단';
    let n = ticketCleanName(f);
    // 132번: 영문 줄임말 + 번호만인 이름(포아 "POA19")은 책자 이름 + 번호로 — "디올 23번"과 같은 모양 ("포아 19번")
    const code = /^[A-Za-z]+\s*(\d+)$/.exec(n), book = String(f.book || '').trim();
    if (code && book && /[가-힣]/.test(book)) return `${book} ${code[1]}번`;
    const bk = typeof blindKind === 'function' ? blindKind(f) : null;      // 173번: 콤비·롤 원단은 이름 앞에 종류 — 이름이 같은 롤 린넨·콤비 린넨이 견적서·공간 화면에서 구분되게
    if ((bk === 'combi' || bk === 'roll') && !/콤비|롤/.test(n)) n = (bk === 'combi' ? '콤비 ' : '롤 ') + n;
    const k = normalizeColorName(c.colorName);
    if (!k) return n;
    if (!/^\d+$/.test(k)) return `${n} ${k}`;
    return getFabricColors(f.id).length < 2 ? n : `${n} ${k}번`;
}

// 손님이 가져가는 글(견적서·이유 카드·우리 집 색)의 원단 표기 (61번): 책자·원단 이름·색 번호 대신 "색 이름 · 재질"
//  예: 그레이지 · 결 있는 질감 · 생활암막 / 아이보리 · 콤비 블라인드 · 암막. 원단 이름은 직원 화면과 고객 화면 최종 제안에만
const PLAIN_TEXTURE_WORDS = { smooth: '매끈한 질감', natural: '짜임이 보이는 질감', cozy: '포근한 질감' };
const PLAIN_BLIND_WORDS = { combi: '콤비 블라인드', roll: '롤스크린', print: '프린트 블라인드' };
// 견적서 품목 이름 (208번, 11-09 사장님): 색·종류 먼저 — "베이지 콤비 블라인드" · "아이보리 커튼". 책자 이름·번호는 ticketEstSub로 뒤에 작게
//  색 이름은 손님 화면과 같은 custColorName(182번). 색 이름이 없으면(실물 견본 등) 지금처럼 책자 이름 + 번호(147번)
function ticketEstName(c, calc) {
    const color = custColorName(c.fabricId, c.colorName);
    if (!color) return ticketBookName(c);
    return `${color} ${ticketEstKind(c)}`;
}
// 208번: 이름 뒤 종류 낱말 — 블라인드는 콤비 블라인드 · 롤스크린 · 프린트 블라인드(없으면 블라인드), 겉지·속지는 왼쪽 종류 칸에 있으니 "커튼"
// 216번: 견적서 크기 글 (사장님 11-11: 장별 크기 + 손잡이). 블라인드 한 장 "450 × 240cm · 손잡이 우",
//   여러 장 "3장 · 100×240 좌 · 230×240 우 · 100×240 우" (같은 줄 여러 장은 "120×200 우 6장"). " · "에서 줄이 끊김. 커튼은 그대로
function ticketSizeText(c, calc) {
    const W = Number(c.width), H = Number(c.height);
    if (!(W > 0 && H > 0)) return '';
    if (c.presetType !== 'blind' && !(calc && calc.calcType === 'hebe')) return `${W} × ${H}cm`;
    const HAND = { L: '좌', R: '우' };
    const rows = Pricing.panesOf(c).map(p => ({ w: p.w == null ? W : p.w, h: p.h == null ? H : p.h, hand: p.hand, qty: p.qty })).filter(p => p.w > 0 && p.h > 0);
    const n = rows.reduce((s, p) => s + p.qty, 0);
    if (n <= 1) { const p = rows[0] || { w: W, h: H, hand: Pricing.PANE_HAND_DEFAULT }; return `${p.w} × ${p.h}cm · 손잡이 ${HAND[p.hand]}`; }
    return [`${n}장`].concat(rows.map(p => `${p.w}×${p.h} ${HAND[p.hand]}${p.qty > 1 ? ` ${p.qty}장` : ''}`)).join(' · ');
}

function ticketEstKind(c) {
    if (c.presetType !== 'blind') return '커튼';
    const f = FABRIC_DB.find(x => x.id === c.fabricId) || (typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null);
    return PLAIN_BLIND_WORDS[blindKind(f)] || '블라인드';
}
// 208번: 이름 아래 작은 줄 맨 앞에 붙는 책자 이름·번호("블랑 1번"). 이름이 이미 책자 이름이면 빈칸(되풀이 막기)
function ticketEstSub(c) {
    return custColorName(c.fabricId, c.colorName) ? ticketBookName(c) : '';
}
function ticketPlainName(c, calc) {
    const sf = typeof sampleBlindFabric === 'function' ? sampleBlindFabric(c.fabricId) : null;
    if (sf) return sf.name;
    const f = FABRIC_DB.find(x => x.id === c.fabricId);
    if (!f) return ticketFabricName(c, calc);
    // 색 이름: 직원이 붙인 색 이름 → 색 값으로 지은 이름 → 톤
    let color = proNameOf(c.colorName ? whyFabricColor(f.id, c.colorName) : null);      // 색 이름은 색 사전 하나 (88번)
    if (!color && c.colorName) color = colorLabelOf(f.id, c.colorName);
    if (!color) {
        const lab = whyFabricColor(f.id, c.colorName);
        const nm = (lab && typeof lab.L === 'number' && window.RoomColor && RoomColor.colorName) ? RoomColor.colorName('wall', lab) : null;
        color = (nm && nm.name) || '';
    }
    if (!color) {
        const col = c.colorName ? fabricColorOf(f.id, c.colorName) : null;
        const tone = (col && col.tone) || f.tone;
        color = TONE_LABELS[tone] ? `${TONE_LABELS[tone]} 톤` : '';
    }
    const parts = [];
    if (c.presetType === 'blind' || f.categoryType === '블라인드') {
        const k = blindKind(f), bl = blindLight(f);
        parts.push(PLAIN_BLIND_WORDS[k] || '블라인드');
        if (bl === 'full') parts.push('암막'); else if (bl === 'see') parts.push('투시');
    } else {
        const mat = materialOf(f);
        if (mat === 'linen' || mat === 'linenlook') parts.push(MATERIAL_LABELS[mat]);      // 94번: 소재 이름 그대로
        else if (PLAIN_TEXTURE_WORDS[f.texture]) parts.push(PLAIN_TEXTURE_WORDS[f.texture]);
        if (c.presetType === 'sheer' || f.categoryType === '속지') {
            if (DENSITY_LABELS[f.density]) parts.push(DENSITY_LABELS[f.density]);
        } else {
            const bo = blackoutLevel(f);
            if (bo) parts.push(bo === 'mid' ? '보통 암막' : BLACKOUT_LABELS[bo]);
        }
    }
    const out = [color, ...parts].filter(Boolean).join(' · ');
    return out || ticketFabricName(c, calc);
}
// 원단 색과 벽·바닥 색의 관계 (61번): 같은 색 계열에 밝기만 다르면 톤온톤, 색 계열은 달라도 밝기·선명함이 비슷하면 톤인톤
//  잰 벽 → 잰 바닥 순으로 먼저 맞는 것 하나. 못 재었거나 둘 다 아니면 빈칸
function ticketToneWord(r, c) {
    const fab = c && c.fabricId ? whyFabricColor(c.fabricId, c.colorName) : null;
    if (!fab || typeof fab.L !== 'number') return '';
    const mc = (r && r.measuredColor) || {};
    for (const [k, word] of [['wall', '벽'], ['floor', '바닥']]) {
        const w = whyLabOf(mc[k]);
        if (!w) continue;
        const dL = Math.abs(fab.L - w.L), dC = Math.abs(fab.C - w.C);
        let dh = Math.abs(Math.atan2(fab.b, fab.a) - Math.atan2(w.b, w.a)) * 180 / Math.PI; if (dh > 180) dh = 360 - dh;
        const same = (fab.C < 6 && w.C < 6) || (fab.C >= 6 && w.C >= 6 && dh <= 30);
        if (same) return dL >= 8 ? `${word}과 톤온톤` : `${word}과 비슷한 색`;
        if (fab.C >= 6 && w.C >= 6 && dL < 10 && dC < 10) return `${word}과 톤인톤`;
    }
    return '';
}
// 품목 종류 (속지 / 겉지 / 블라인드)
function ticketKindLabel(c) {
    return c.presetType === 'blind' ? '블라인드' : (c.presetType === 'sheer' ? '속지' : (c.presetType === 'drape' ? '겉지' : '커튼'));
}
// 사진이 없을 때 원단 칸을 채우는 색: 고른 색(없으면 원단)의 톤으로 짐작. 제안서·견적서·첫 화면 공간 칸이 함께 씀
const FABRIC_TONE_FILL = { warm: '#dcc3a4', cool: '#b9c4cb', neutral: '#d3cdc3', deep: '#7a695c' };
function fabricToneFill(fabricId, colorName) {
    const f = Pricing.pickFabric(FABRIC_DB, fabricId);
    if (!f) return '#d9cdbb';
    const col = colorName ? fabricColorOf(f.id, colorName) : null;
    return FABRIC_TONE_FILL[(col && col.tone) || f.tone] || '#d9cdbb';
}
// 견적서 원단 칸(사진이 없을 때)의 색 (35번): 잰 색(색상코드)이 있으면 그 색, 없으면 톤 대표색 (고객 화면 concierge colorFillOf와 같은 순서)
//  톤 대표색은 4가지뿐이라 그레이·로즈 그레이·그레이지가 같은 색으로 보이던 것
function fabricColorFill(fabricId, colorName) {
    const col = (fabricId && colorName) ? fabricColorOf(fabricId, colorName) : null;
    return (col && /^#[0-9a-f]{6}$/i.test(col.hex || '')) ? col.hex : fabricToneFill(fabricId, colorName);
}

// 견적서 이미지에 넣을 원단 사진을 미리 불러옴 (없으면 사진 없이 그림)
function loadImage(url, timeoutMs) {
    return new Promise(resolve => {
        const img = new Image();
        let done = false;
        const finish = ok => { if (done) return; done = true; resolve(ok ? img : null); };
        img.onload = () => finish(img.naturalWidth > 0);
        img.onerror = () => finish(false);
        setTimeout(() => finish(false), timeoutMs || 3000);
        img.src = url;
    });
}
async function loadTicketPhotos(data) {
    await DevicePhotos.ready;      // 기기에 넣은 사진(34번)부터 쓰도록
    const jobs = [];
    data.rooms.forEach(room => room.items.forEach(it => {
        if (!it.fabricId || data.photos[it.photoKey] !== undefined) return;
        data.photos[it.photoKey] = null;
        jobs.push((async () => {
            for (const u of fabricPhotoUrls(it.fabricId, it.colorName)) {
                const img = await loadImage(u, 3000);
                if (img) { data.photos[it.photoKey] = img; return; }
            }
        })());
    }));
    await Promise.all(jobs);
    return data;
}

// 해당 품목에만 붙는 안내 (87번): 소폭 이음 제작 커튼이 있으면 이음선 안내, 완전 암막 겉지가 있으면 빛샘 안내 — 각 한 번씩
const SEAM_NOTE = '원단 폭이 좁은 제품은 폭을 이어 제작하므로, 커튼에 세로 이음선이 있습니다. 제작 과정상 자연스러운 것이며 불량이 아닙니다.';
const LIGHT_LEAK_NOTE = '완전 암막 원단도 커튼 옆과 위로는 빛이 새어 들어올 수 있습니다. 원단 자체의 문제가 아니라 설치 구조상 생기는 현상입니다.';
const HOTEL_FIT_NOTE = '호텔핏은 원단을 한 폭 더 넣어 주름을 깊고 풍성하게 만드는 리담의 마감입니다.';      // 136번
// 리담의 약속 (159번, 11-08 사장님 결정): 견적서 그림·최종 제안 견적·카톡 글에 늘 나옴(설정 칸 아님). 글을 바꾸려면 번호를 새로
const TICKET_PROMISE = [
    '실물 견본을 창가에서 함께 확인한 뒤 주문합니다.',
    '계약금 50%를 받은 뒤 제작에 들어갑니다.',
    '제작은 보통 4~6일 걸립니다.',
    '크기를 잘못 쟀거나 시공에 하자가 있으면 리담이 다시 만들어 시공합니다.'
];
function autoQuoteNotes(roomList) {
    let seam = false, leak = false, hotel = false;
    (roomList || []).forEach(r => (r.curtains || []).forEach(c => {
        const k = c.calc || {};
        const panel = c.pleat === 'panel' || c.pleatType === '패널' || c.pleatType === '판넬';
        if (k.calcType && k.calcType !== 'width' && k.calcType !== 'hebe' && !panel && k.isSeamless === false && Number(c.width) > 0) seam = true;
        const f = c.fabricId ? FABRIC_DB.find(x => x.id === c.fabricId) : null;
        if (f && f.categoryType === '겉지' && blackoutLevel(f) === 'full') leak = true;
        if (c.hotelFit) hotel = true;
    }));
    return [seam ? SEAM_NOTE : '', leak ? LIGHT_LEAK_NOTE : '', hotel ? HOTEL_FIT_NOTE : ''].filter(Boolean);
}
function ticketData() {
    calculateAll();
    const d = ticketDataBase();
    d.light = ticketLightOf(d);      // 131번: 견적서 빛 묶음 (넣지 않으면 null)
    // 161번: 실물 견본 품목(우드·색 못 잰 블라인드 등, 금액 0)이 있으면 합계가 그 품목을 뺀 금액임을 밝힘 — 저장 그림·최종 제안 화면·카톡 글이 같이 씀 · 커튼 견본은 종류 이름(속지·겉지)으로(211번)
    const sampleNames = [...new Set(d.rooms.flatMap(r => r.items).map(i => sampleBlindFabric(i.fabricId)).filter(Boolean).map(s => s.blindKind ? s.name.replace(' (실물 상담)', '') : s.categoryType))];
    d.totalLabel = sampleNames.length ? '합계 금액 (시공비 포함 · 실물 견본 품목 제외)' : '합계 금액 (시공비 포함)';
    if (sampleNames.length) {
        const nm = sampleNames.join('·');
        d.note = [d.note, `${nm}${houseJosa(nm, '은', '는')} 상담 때 실물 견본으로 고른 뒤 금액을 알려 드립니다.`].filter(Boolean).join('\n');
    }
    return d;
}
function ticketDataBase() {
    const custName = (document.getElementById('custName').value || '').trim();
    if (!quoteDate) { quoteDate = localYmd(new Date()); if (typeof saveDraftTick === 'function') saveDraftTick(); }      // 처음 만든 날로 고정 (85번)
    const [qy, qm, qd] = quoteDate.split('-').map(Number), d = new Date(qy, qm - 1, qd);
    const validDays = quoteValidOverride === null ? loadQuoteValidDays() : quoteValidOverride, until = new Date(qy, qm - 1, qd + validDays);
    return {
        validText: validDays > 0 ? `${until.getMonth() + 1}월 ${until.getDate()}일까지 유효` : '',
        recipient: custName ? `${custName} 고객님 귀하` : '고객님 귀하',      // 고객 이름·날짜는 견적서 머리글에만 (74번)
        date: localYmd(d).replace(/-/g, '.'),      // 2026.10.31 (날짜 글자는 localYmd 한 곳, 130-1번)
        rooms: rooms.map(r => {
            const items = r.curtains.map(c => {
                const calc = c.calc || {};
                const opts = [];
                if (c.shapeFee > 0) opts.push('형상기억 포함');      // 158번
                if (c.leadBand) opts.push('리드밴드');
                if (c.hotelFit) opts.push('호텔핏(기본보다 한 폭 더)');      // 158번
                const sampleOnly = !!(typeof sampleBlindFabric === 'function' && sampleBlindFabric(c.fabricId));
                return {
                    label: c.label, kind: ticketKindLabel(c), meta: opts.join(' · '),      // 원단 이름 옆 작은 글자: 추가한 옵션만 (책자 이름은 넣지 않음)
                    name: ticketPlainName(c, calc), tone: ticketToneWord(r, c),      // 이유 장·우리 집 색: 색 이름 · 재질 + 벽·바닥과 톤 관계 (61번)
                    bookName: ticketEstName(c, calc), bookSub: ticketEstSub(c),      // 견적서(그림·최종 제안 표·카톡 글): 큰 이름 = 색·종류 "베이지 콤비 블라인드", 작은 줄 = 책자 이름·번호 "블랑 1번" (208번)
                    fill: fabricColorFill(c.fabricId, c.colorName), opts, price: calc.curtainSubtotal || 0, sampleOnly: sampleOnly || !!calc.noFabric, sampleBlind: sampleOnly,      // 원단 없는 품목은 금액을 숨김 (126번) · 176번: sampleBlind = 실물 견본 품목(금액 칸에 "견본 확인 후")
                    reason: ticketItemReason(r, c), fabricId: c.fabricId || '', colorName: c.colorName || '',
                    size: ticketSizeText(c, calc),      // 제작 크기 (넓이 × 높이) · 216번: 블라인드는 장·손잡이까지
                    photoKey: (c.fabricId || '') + '__' + (c.colorName || ''),
                    kindKey: c.presetType || '', colorDesc: custColorName(c.fabricId, c.colorName),      // 182번
                    keep: ticketKeepWord(r, c),      // 원단을 고른 이유 카드용
                    pickDir: c.pickDir || null, toneStep: Number(c.toneStep) || 0      // 칸마다의 잇는 방향 · 한 톤 바꿈 (28번)
                };
            });
            // 카드용 손님 답: 빛 양은 기본값이 들어 있으니 상담을 거친(diagnosed) 공간만 씀
            const ans = { privacy: r.privacy || null, block: r.lightBlock || null, light: r.diagnosed ? (r.lightLevel || null) : null };
            // 잰 벽·바닥 색 (32번): 이유 카드 공간 줄 아래 "■ 벽 라이트 베이지 #D8CEBF · ■ 바닥 허니 오크 #B38A5E". 잰 공간만
            const mc = r.measuredColor || {}, nameOf = window.RoomColor && window.RoomColor.colorName;
            const colors = ['wall', 'floor'].filter(k => mc[k] && /^#[0-9a-f]{6}$/i.test(mc[k].hex || '') && nameOf)
                .map(k => ({ k: k === 'wall' ? '벽' : '바닥', hex: mc[k].hex.toUpperCase(), name: (k === 'wall' ? proNameOf(mc[k]) : '') || (nameOf(k, mc[k]) || {}).name || '' }));
            // 잇는 색은 넣지 않음 (사장님 10-16: 최종 제안에서는 고른 원단 자체가 잇는 색)
            // 속지만 + 바깥 시선이 신경 쓰이는 공간 (33번): 이유 카드 공간 아래 밤 안내 한 줄
            const night = (r.privacy === 'high' || r.privacy === 'some') && r.curtains.length > 0 && r.curtains.every(c => c.presetType === 'sheer');
            const sampleOnly = items.length > 0 && items.every(i => i.sampleOnly);
            // raw: 이유 문장(35번)이 쓰는 공간 값(잰 색 Lab·창 방향·공간 종류·속지 느낌) · opp: 같은 이름 공간과 방향이 반대인 맞은편 창
            return { name: r.name, total: items.reduce((a, i) => a + i.price, 0), sampleOnly, items, summary: '', diagnosed: !!r.diagnosed, ans, linkDir: r.linkDir || null, colors, night,
                raw: r, opp: oppositeRoomOf(r, rooms) };      // 공간 설명 줄은 뺌 (제안서가 길어져서)
        }),
        install: globalInstallFee,
        total: document.getElementById('totalGrandPrice').textContent,
        // 132번: 부가세 줄 — 일반 판매가는 "포함", 세금계산서는 더한 10% 금액 (직원 화면에서 고른 대로, 11-01 사장님)
        vatText: globalVatOption === 'business' ? `${(document.getElementById('resGrandVat') || {}).textContent || '0'}원` : '포함',
        vatLabel: globalVatOption === 'business' ? '부가세 (10%)' : '부가세',
        note: [loadTicketNote(), ...autoQuoteNotes(rooms)].filter(Boolean).join('\n'),      // 직원이 적은 안내 + 해당 품목 안내 (87번)
        pay: loadTicketText('pay'), custom: loadTicketText('custom'), supplier: loadTicketText('supplier'),
        promise: TICKET_PROMISE.join('\n'),      // 159번: 리담의 약속 (한 줄에 하나)
        photos: {}
    };
}

// 견적서 디자인 = 문서 한 장: Re.dam · "견적서" 제목 · 받는 분 · 날짜 → 품목 표(품목 / 크기 / 금액, 공간별 묶음) → 시공비 → 합계 → 안내 문구
// 고객 화면 "최종 제안"이 이 이미지를 종이 한 장처럼 그대로 보여 줌. 톤은 고객 화면과 같음(명조 글자, 굵은 선·가는 선, 각진 원단 칸. 둥근 카드·알약 태그 없음)
// slim: 앞장에 "원단을 고른 이유" 카드가 있으면 품목마다 한 줄(종류 · 이름 · 옵션 · 크기 · 금액). 추천 이유는 카드에 있으니 뺌
function drawTicket(ctx, data, W, slim) {
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const DARK = '#2b221a', MUTED = '#6f5f4f', SOFT = '#6f5f4f', LINE = '#e5dcd0';
    const PAD = TICKET_PAD, CX = PAD, CW = W - PAD * 2, RX = W - PAD;
    const HEAD_Y = TICKET_HEAD_Y;                   // 표 머리(굵은 선) 높이
    const START_Y = HEAD_Y + 56;                    // 첫 공간이 시작되는 높이 (표 머리 아래)
    const SW_W = slim ? 36 : 56, SW_H = slim ? 46 : 70;      // 원단 칸 (세로로 긴 네모)
    const KIND_W = 100;                             // slim: 종류 이름표 칸 폭 ("블라인드" 넉 자가 이름과 겹치지 않게, 80번)
    const NAME_Y = slim ? 40 : 74, NAME_LH = slim ? 34 : 38, NAME_PX = PAPER_F3;      // 원단 이름 글줄 (품목 윗선에서 첫 줄까지 · 줄 간격 · 글자 크기 — 앞장들과 위계 통일, 39번)
    const SIZE_R = RX - 190, SIZE_W = 170;          // "크기" 칸: 오른쪽 끝 위치와 폭 (그 오른쪽 190은 "금액" 칸)
    const setFont = (weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; };
    const canSpace = 'letterSpacing' in ctx;
    const spacing = v => { if (canSpace) ctx.letterSpacing = v; };
    const hline = (x1, x2, y, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
    const wrap = (text, maxW) => {
        const lines = []; let cur = '';
        for (const word of String(text).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (ctx.measureText(test).width <= maxW) { cur = test; continue; }
            if (cur) lines.push(cur);
            cur = '';
            if (ctx.measureText(word).width <= maxW) { cur = word; continue; }
            let chunk = '';
            for (const ch of word) { if (ctx.measureText(chunk + ch).width > maxW) { lines.push(chunk); chunk = ch; } else chunk += ch; }
            cur = chunk;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    const text = (str, x, y, align, color) => { ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y); };
    // 글자 사이를 띄운 작은 이름표. 오른쪽 맞춤이면 마지막 글자 뒤 간격만큼 밀려 보이므로 그만큼 당겨 줌
    const label = (str, x, y, align, gap) => {
        spacing(gap + 'px');
        text(str, x + ((align === 'right' && canSpace) ? gap : 0), y, align, SOFT);
        spacing('0px');
    };
    const won = n => `${n.toLocaleString()}원`;

    // 머리글 + 표 머리 (페이지마다 같은 모양 — 볼드 없이 400 명조로 단정하게, 39번)
    function hdr() {
        // 로고: 새 글씨 로고(150번), 점만 흙빛
        drawRedamLogo(ctx, CX, 112, PAPER_F1, DARK, '#8a4a22', 'left');
        setFont(400, PAPER_F2, SERIF);
        if (canSpace) { spacing('5px'); text('견적서', RX + 5, 108, 'right', DARK); spacing('0px'); }
        else text('견적서', RX, 108, 'right', DARK);
        setFont(400, PAPER_F3, SERIF); text(data.recipient, CX, 154, 'left', MUTED);
        setFont(400, PAPER_F4, SANS); label(data.date + (data.validText ? '  ·  ' + data.validText : ''), RX, 154, 'right', 2);
        hline(CX, RX, HEAD_Y, DARK, 1);
        setFont(400, PAPER_F4, SANS);
        label('품목', CX, HEAD_Y + 36, 'left', 3);
        label('금액', RX, HEAD_Y + 36, 'right', 3);
    }

    // 공간 한 묶음의 크기를 미리 계산
    function layoutRoom(room) {
        const px = CX, iw = CW;
        const tx = px + SW_W + (slim ? 20 : 24);
        const nx = slim ? tx + KIND_W : tx;              // 원단 이름이 시작되는 곳 (slim이면 종류 이름표 오른쪽)
        const tw = RX - 150 - nx;      // 원단 이름·옵션·추천 이유가 쓸 수 있는 폭. 크기 칸을 빼고 금액 칸(150)만 남김 — 크기는 이름 아래 작은 줄 (75번)
        const blocks = room.items.map(it => {
            const photo = (data.photos && data.photos[it.photoKey]) || null;
            setFont(400, NAME_PX, SERIF);
            const lines = wrap(it.bookName || ticketBookName(it), tw);      // 책자 원단 이름 + 색 번호, 예) 블랑 1번 (75번)
            const lastW = ctx.measureText(lines[lines.length - 1] || '').width;
            setFont(400, PAPER_F4, SANS);
            // 옵션은 이름 옆에 작게. 자리가 모자라면 다음 줄로
            const metaInline = false, sub = [it.bookSub, it.size, it.meta].filter(Boolean).join(' · ');      // 208번: 책자 이름·번호가 작은 줄 맨 앞
            const metaLines = sub ? wrap(sub.split(' · ').map(p => p.replace(/ /g, ' ')).join(' · '), tw) : [];      // 215번: 옵션 한 덩이("호텔핏(기본보다 한 폭 더)")는 한 줄에 — 끊김은 " · " 자리에서만
            const rlines = (it.reason && !slim) ? wrap(it.reason, tw) : [];
            const nameEnd = NAME_Y + (lines.length - 1) * NAME_LH;
            const textEnd = nameEnd + metaLines.length * 32 + rlines.length * 32;
            const h = slim ? Math.max(textEnd + 18, 10 + SW_H + 10) : Math.max(textEnd + 24, 12 + SW_H + 14);
            return { it, photo, lines, lastW, metaInline, metaLines, rlines, h };
        });
        const headH = slim ? 62 : 72;
        const cardH = headH + blocks.reduce((a, b) => a + b.h, 0) + 10;
        return { room, px, iw, tx, nx, blocks, headH, cardH };
    }
    // 공간 한 묶음을 y 위치에 그림: 위 가는 선 → 공간 이름·소계 → 품목(원단 칸 · 종류 · 이름·옵션 · 크기 · 금액)
    function drawRoom(L, y) {
        const { room, px, iw, tx, nx, blocks, headH } = L;
        hline(px, px + iw, y, LINE, 0.6);
        setFont(400, PAPER_F2, SERIF); text(room.name, px, y + (slim ? 46 : 50), 'left', DARK);
        if (!room.sampleOnly) { setFont(400, PAPER_F3, SERIF); text(won(room.total), px + iw, y + (slim ? 46 : 50), 'right', DARK); }
        let by = y + headH;
        blocks.forEach(b => {
            // 원단 칸: 사진이 있으면 가운데를 잘라 넣고, 없으면 톤 색으로 채움
            const swY = by + (slim ? 10 : 12);
            if (b.it.sampleBlind) paperHatch(ctx, px, swY, SW_W, SW_H);      // 211번: 실물 견본은 빗금
            else { ctx.fillStyle = b.it.fill || '#d9cdbb'; ctx.fillRect(px, swY, SW_W, SW_H); }
            if (b.photo) {
                const sw = b.photo.naturalWidth, sh = b.photo.naturalHeight;
                const k = Math.max(SW_W / sw, SW_H / sh), cw = SW_W / k, ch = SW_H / k;
                ctx.drawImage(b.photo, (sw - cw) / 2, (sh - ch) / 2, cw, ch, px, swY, SW_W, SW_H);
            }
            setFont(400, PAPER_F4, SANS); label(b.it.kind, tx, slim ? by + NAME_Y : by + 36, 'left', 3);
            setFont(400, NAME_PX, SERIF);
            b.lines.forEach((ln, li) => text(ln, nx, by + NAME_Y + li * NAME_LH, 'left', DARK));
            let ty = by + NAME_Y + (b.lines.length - 1) * NAME_LH;
            if (!b.it.sampleOnly) { setFont(400, PAPER_F3, SERIF); text(won(b.it.price), px + iw, by + NAME_Y, 'right', DARK); }
            else if (b.it.sampleBlind) { setFont(400, PAPER_F4, SANS); text('견본 확인 후', px + iw, by + NAME_Y, 'right', MUTED); }      // 176번
            setFont(400, PAPER_F4, SANS);
            if (b.metaInline) text(b.it.meta, nx + b.lastW + 14, ty, 'left', MUTED);
            b.metaLines.forEach(ln => { ty += 32; text(ln, nx, ty, 'left', MUTED); });
            b.rlines.forEach(ln => { ty += 32; text(ln, nx, ty, 'left', SOFT); });
            by += b.h;
        });
    }
    // 맨 아래 구역: 시공비 → 합계 금액 → 안내 줄들(왼쪽 작은 이름표 + 오른쪽 글: 안내 / 결제 조건 / 맞춤 제작 안내) → 가는 선 → 공급자 정보
    // 결제 조건·맞춤 제작 안내·공급자 정보는 직원 화면에서 적은 글(여러 줄). 비어 있으면 그 줄은 그리지 않음
    const INFO_X = CX + 190, INFO_W = RX - INFO_X, INFO_LH = 32, INFO_GAP = 14;
    const paras = (str, maxW) => {
        const out = [];
        String(str || '').split(/\r?\n/).forEach(p => { const t = p.trim(); if (t) wrap(t, maxW).forEach(l => out.push(l)); });
        return out;
    };
    function layoutFooter() {
        setFont(400, PAPER_F4, SANS);
        const rows = [
            { label: '리담의 약속', lines: paras(data.promise, INFO_W) },      // 159번: 합계 바로 아래 첫 줄
            { label: '안내', lines: paras(data.note, INFO_W) },
            { label: '결제 조건', lines: paras(data.pay, INFO_W) },
            { label: '맞춤 제작 안내', lines: paras(data.custom, INFO_W) }
        ].filter(r => r.lines.length);
        const sup = paras(data.supplier, INFO_W);
        const rowH = n => n * INFO_LH + INFO_GAP;
        const h = (data.install > 0 ? 76 : 0) + (data.vatText ? (data.install > 0 ? 52 : 76) : 0) + 96 + 54 + (/실물 견본/.test(data.totalLabel || '') ? 40 : 0) + rows.reduce((a, r) => a + rowH(r.lines.length), 0)
            + (sup.length ? 30 + rowH(sup.length) : 0) + 56;
        return { rows, sup, h };
    }
    function drawFooter(F, y) {
        if (data.install > 0) {
            hline(CX, RX, y, LINE, 0.6);
            setFont(400, PAPER_F3, SANS); text('시공 및 설치비', CX, y + 48, 'left', MUTED);
            setFont(400, PAPER_F3, SERIF); text(won(data.install), RX, y + 48, 'right', DARK);
            y += 76;
        }
        if (data.vatText) {      // 132번: 부가세 줄 (포함 / 10% 금액)
            const first = !(data.install > 0);
            if (first) hline(CX, RX, y, LINE, 0.6);
            const by = y + (first ? 48 : 24);
            setFont(400, PAPER_F3, SANS); text(data.vatLabel || '부가세', CX, by, 'left', MUTED);
            setFont(400, PAPER_F3, SERIF); text(data.vatText, RX, by, 'right', DARK);
            y += first ? 76 : 52;
        }
        hline(CX, RX, y, DARK, 1);
        const longLbl = /실물 견본/.test(data.totalLabel || '');      // 176번: 긴 이름표(실물 견본 품목 제외)는 합계 숫자 위 줄로 — 숫자에 깔리지 않게
        if (longLbl) { setFont(400, PAPER_F4, SANS); label(data.totalLabel, CX, y + 44, 'left', 3); y += 40; }
        y += 96;
        if (!longLbl) { setFont(400, PAPER_F4, SANS); label(data.totalLabel || '합계 금액 (시공비 포함)', CX, y - 6, 'left', 3); }      // 161번
        setFont(400, PAPER_F3, SERIF);
        const wonW = ctx.measureText('원').width;
        text('원', RX, y, 'right', DARK);
        setFont(400, PAPER_F1, SERIF); text(data.total, RX - wonW - 8, y, 'right', DARK);      // 합계 숫자도 볼드 없이 400 명조로 단정하게 (39번)
        y += 54;
        const infoRow = (name, lines, color) => {
            setFont(400, PAPER_F4, SANS); label(name, CX, y, 'left', 3);
            setFont(400, PAPER_F4, SANS);
            lines.forEach((ln, i) => text(ln, INFO_X, y + i * INFO_LH, 'left', color));
            y += lines.length * INFO_LH + INFO_GAP;
        };
        F.rows.forEach(r => infoRow(r.label, r.lines, MUTED));
        if (F.sup.length) {
            hline(CX, RX, y - 18, LINE, 0.6);
            y += 30;
            infoRow('공급자', F.sup, MUTED);
        }
    }
    function pageLabel(i, n, H) {
        if (n < 2) return;
        setFont(400, PAPER_F4, SANS); text(`${i + 1} / ${n}`, W / 2, H - 30, 'center', SOFT);
    }
    return { START_Y, hdr, layoutRoom, drawRoom, layoutFooter, drawFooter, pageLabel };
}

// 견적서는 A4 세로 비율의 "고정 크기" 페이지(1080 x 1527)로 만듭니다.
//  1) 내용이 한 장에 들어가면 그대로,
//  2) 조금 넘치면 글자·간격을 살짝 줄여서(최대 80%까지) 한 장에 맞추고,
//  3) 그래도 안 들어가면 방 카드 단위로 다음 장에 이어 그립니다 (최종 금액은 맨 마지막 장 아래쪽).
const TICKET_W = 1080;
const TICKET_PAGE_H = Math.round(TICKET_W * 1.414);
const TICKET_PAD = 64, TICKET_HEAD_Y = 188;      // 종이 안쪽 여백(인쇄 여백 10mm와 겹치지 않게 줄임)·머리글 굵은 선 높이. 카드와 견적서가 같이 씀
// 화면용 종이 (75번, 10-25 사장님: A4 인쇄는 나중에 따로): 폭 1080 그림에 1.4배로 그려 글자는 80·44·34·30(정보 화면 사다리 40·22·17·15의 2배, 135번)만,
//  장 높이는 내용만큼(쪽 나눔 없음). 탭에서 폭 540으로 보이면 40·22·17·15
const PAPER_K = 1.4, PAPER_W = Math.round(TICKET_W / PAPER_K);
const PAPER_F1 = 80 / PAPER_K, PAPER_F2 = 44 / PAPER_K, PAPER_F3 = 34 / PAPER_K, PAPER_F4 = 30 / PAPER_K;      // 로고·합계 / 장 제목·공간 이름 / 본문 / 작게 — 135번: 화면 사다리 40·22·17·15의 2배
const TICKET_SCALES = [1, 0.95, 0.9, 0.85, 0.8];
function planTicket(data, s, slim) {
    const W = PAPER_W, PAGE_H = 1e6, GAP = slim ? 16 : 34, BOTTOM = 80;      // 쪽 나눔 없음: 장 높이는 내용만큼 (75번)
    const probe = document.createElement('canvas').getContext('2d');
    const T = drawTicket(probe, data, W, slim);
    const layouts = data.rooms.map(r => T.layoutRoom(r)).concat(data.light ? [T.layoutRoom(data.light)] : []);      // 131번: 빛 묶음은 맨 뒤
    const F = T.layoutFooter();
    const pages = [];
    let cur = { items: [], y: T.START_Y };
    layouts.forEach(L => {
        if (cur.items.length && cur.y + L.cardH > PAGE_H - BOTTOM) { pages.push(cur); cur = { items: [], y: T.START_Y }; }
        cur.items.push({ L, y: cur.y });
        cur.y += L.cardH + GAP;
    });
    pages.push(cur);
    // 마지막 장에 합계가 안 들어가면 마지막 방을 새 장으로 옮김
    let last = pages[pages.length - 1];
    if (last.y + F.h > PAGE_H && last.items.length > 1) {
        const mv = last.items.pop();
        last.y = mv.y;
        pages.push({ items: [{ L: mv.L, y: T.START_Y }], y: T.START_Y + mv.L.cardH + GAP });
        last = pages[pages.length - 1];
    }
    const fitsOnePage = pages.length === 1 && last.y + F.h <= PAGE_H;
    // 145번: 견적서 기본 공간 = 공간 3개(각 겉지·속지 두 줄)만큼. 품목이 적어도 합계는 이 높이 아래에
    const fakeIt = k => ({ kind: k, kindKey: k === '속지' ? 'sheer' : 'drape', bookName: '베이지 커튼', bookSub: '블랑 1번', size: '2,400 × 2,300', price: 0 });      // 208번: 진짜 품목과 같은 모양
    const fakeH = T.layoutRoom({ name: '공간', total: 0, items: [fakeIt('겉지'), fakeIt('속지')] }).cardH;
    const minY = T.START_Y + 3 * (fakeH + GAP);
    return { s, W, PAGE_H, BOTTOM, F, pages, fitsOnePage, minY };
}
// ==============================================================
// 〈원단을 고른 이유〉 카드 (작업목록 24번 → 35번): 제안서 맨 앞장. 가격 없음. 견적서와 한 쌍(머리글·글꼴·선·쪽 표시 같음)
//  공간마다 [공간 이름 · 손님 말(+창 방향) · 벽·바닥 잰 색 · 공간 문장(색 잇기)] → 원단마다 [색 칩 + 코드 · 원단 이름 · 이유 1~3문장 · 회색 안내].
//  손님이 상담에서 실제로 답한 공간(diagnosed)만. 앞 공간과 같은 원단·같은 답이면 "○○과 같은 이유로 골랐습니다." + 새로 생긴 재료만
//  문장은 정해 둔 한 줄이 아니라 재료(손님 말 F · 공간 S · 색 C · 창 방향 D · 맞은편 창 O · 재질 T · 속지/겉지 짝 P · 그대로 K)를 계산해 섞음
//  기준: Claude outputs/기준문서/11_이유_문장표.md (숫자 기준은 모두 처음 값)
// ==============================================================
const WHY_SAY = {      // 손님 말 인용 (156번): 고객 화면 답 버튼 글자 그대로 (concierge.js 2-Base-Block · 2-Base-Privacy). 햇빛 양·속지 느낌은 인용하지 않음
    block: { light: '들어와도 괜찮아요', soft: '적당히 가려 주세요', dark: '완전히 어둡게요' },
    privacy: { open: '괜찮아요', some: '조금 신경 쓰여요', high: '많이 신경 쓰여요' }
};
const WHY_SAY_TOPIC = { privacy: '바깥 시선은', block: '빛은' };      // 무엇에 대한 답인지는 따옴표 밖에 (156번)
const whyQuote = (k, ans) => '“' + WHY_SAY[k][ans[k]] + '”';
function whyJosa(name) {      // "거실과" / "안방과" / "방 2와" 처럼 받침에 따라
    const ch = String(name).slice(-1), code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 ? '과' : '와';
    return '013678'.includes(ch) ? '과' : '와';
}
// ---- 색 값 (Lab): 색 기운(fam)은 room-color.js colorName과 같은 각도 구분, 채도 C ≥ 4일 때만 "기운 있음" ----
const WHY_FAM_WORD = { pink: '분홍', red: '붉은', yellow: '노란', olive: '초록', mint: '푸른 초록', blue: '푸른', lavender: '보랏' };
const WHY_WARM_FAM = ['pink', 'red', 'yellow'];
function whyLabOf(c) {
    if (!c || typeof c.L !== 'number' || typeof c.a !== 'number' || typeof c.b !== 'number') return null;
    const C = Math.hypot(c.a, c.b);
    let h = Math.atan2(c.b, c.a) * 180 / Math.PI; if (h < 0) h += 360;
    const fam = C < 4 ? null : (h < 30 || h >= 330) ? 'pink' : h < 62 ? 'red' : h < 110 ? 'yellow' : h < 150 ? 'olive' : h < 215 ? 'mint' : h < 290 ? 'blue' : 'lavender';
    return { L: c.L, a: c.a, b: c.b, C, fam, hex: c.hex || null };
}
const whyDE = (p, q) => Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
// 원단 색: 색상 입력표에서 잰 색(색상코드·밝기·붉은기·노란기)만. 코드만 있으면 코드에서 Lab을 셈. 없으면 null (칩·색 문장 없음)
function whyFabricColor(fabricId, colorName) {
    const col = (fabricId && colorName) ? fabricColorOf(fabricId, colorName) : null;
    if (!col) return null;
    const hex = /^#[0-9a-f]{6}$/i.test(col.hex || '') ? col.hex.toUpperCase() : null;
    let L = typeof col.light === 'number' ? col.light : null, a = typeof col.a === 'number' ? col.a : null, b = typeof col.b === 'number' ? col.b : null;
    if ((L == null || a == null || b == null) && hex && window.RoomColor && RoomColor.rgbToLab) {
        const n = parseInt(hex.slice(1), 16), lab = RoomColor.rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
        if (L == null) L = lab.L;
        if (a == null || b == null) { a = lab.a; b = lab.b; }
    }
    const lab = whyLabOf({ L, a, b, hex });
    return lab || (hex ? { hex } : null);
}
// 공간 한 곳의 재료 (손님 답 · 잰 벽·바닥 · 창 방향 · 맞은편 창)
function whyRoomCtx(room) {
    const raw = room.raw || {}, mc = raw.measuredColor || {};
    const dir = windowDirOf(raw.windowDir);
    const wall = whyLabOf(mc.wall), floor = whyLabOf(mc.floor), bridge = whyLabOf(mc.bridge);
    const nameOf = (k, c) => (window.RoomColor && RoomColor.colorName && (RoomColor.colorName(k, c) || {}).name) || '';
    return {
        room, ans: room.ans, dir, dirText: windowDirText(dir),
        E: dir.includes('E'), W: dir.includes('W'), S: dir.includes('S'), N: dir.includes('N'),
        wall, floor, bridge, floorName: floor ? matNameOf('floor', mc.floor) : '', wallName: wall ? matNameOf('wall', mc.wall) : '', floorWood: matWoodLike('floor', mc.floor),      // 벽은 색 사전 이름 (88번), 재료에 따라 나무 이름 (113번)
        bedroom: /^(방|안방|작은방|아이방)/.test(String(raw.roomType || raw.name || '')),      // 151번: 작은방 더함
        light: room.ans.light, privacy: room.ans.privacy, block: room.ans.block, feel: raw.sheerFeel || null,
        pres: raw.ownPres || ((typeof houseTaste === 'object' && houseTaste) || {}).pres || null,      // 183번: 커튼 느낌 답(calm·weight·point) — 공간 답이 먼저, 없으면 집 답
        opp: room.opp || ''
    };
}
function whyItemFacts(it, R) {
    const f = Pricing.pickFabric(FABRIC_DB, it.fabricId) || {};
    const kind = it.kindKey === 'sheer' ? 'sheer' : (it.kindKey === 'blind' ? 'blind' : 'drape');
    const col = whyFabricColor(it.fabricId, it.colorName);
    return { it, f, kind, hex: col && col.hex, lab: col && typeof col.L === 'number' ? col : null, link: it.pickDir || R.room.linkDir || null,
             tex: (f.texture && TEXTURE_LABELS[f.texture]) ? f.texture : null, mat: typeof materialOf === 'function' ? materialOf(f) : null };
}
// ③ 고른 것 (83번, 문장표 4장): 원단마다 F 조각(손님 답과 맞는 기능) + S 조각(색 잇기)을 "{속지}는 ~ 원단 가운데 ~ 색으로"로 묶음
const WHY_F_FRAG = { F1: '낮에도 안이 비치지 않는', F2: '형태만 흐릿하게 비치는', F3: '풍경이 그대로 보이는 얇은', F8: '촘촘한', F9: '강한 햇빛에도 안이 잘 보이지 않는',
    F4: '빛을 거의 막는', F5: '눈부심만 줄이는', F6: '빛을 조금 거르는', F7: '빛을 크게 막지 않는' };
// 색 사전 이름 (88번): 벽·원단 색 이름은 제안서 어디서나 색 사전(PRO_COLOR_NAMES) 하나. 바닥은 나무 이름
function proNameOf(c) {
    const p = (c && typeof c.L === 'number' && typeof c.a === 'number' && typeof c.b === 'number') ? proColorName(c.L, c.a, c.b) : null;
    return p ? p.ko : '';
}
// 182번: 손님 화면 원단 색 이름은 어디서나 하나 — 잰 색이 있으면 색 사전 이름(88번), 없으면 사장님이 붙인 색 이름. 원단 카드·공간 화면·제안서가 같이 씀
function custColorName(fabricId, colorName) {
    if (!fabricId || !colorName) return '';
    return proNameOf(whyFabricColor(fabricId, colorName)) || (typeof colorLabelOf === 'function' ? colorLabelOf(fabricId, colorName) : '') || '';
}
// 잰 벽·바닥의 이름 (113번): 나무 이름은 나무 재료일 때만(바닥: 원목·마루·장판 / 벽: 무늬목·목재). 타일·석재·카펫 바닥, 그 밖의 벽은 색 사전 이름
function matWoodLike(part, c) { const k = c && c.mat && c.mat.k; return part === 'floor' ? !(k === 'tile' || k === 'carpet') : k === 'wood'; }
function matNameOf(part, c) {
    const wood = (window.RoomColor && RoomColor.colorName && (RoomColor.colorName(part, c) || {}).name) || '';
    return matWoodLike(part, c) ? wood : (proNameOf(c) || wood);
}
// 두 색의 사전 이름 관계: 'same'(같은 이름) · 'up'(other가 한 톤 밝음) · 'down'(한 톤 진함) · ''(말할 수 없음). 같은 계열·같은 기운 줄에서 밝기 한 칸 차이만 "한 톤"
function proToneRel(base, other) {
    const p = proColorName(base.L, base.a, base.b), q = proColorName(other.L, other.a, other.b);
    if (!p || !q) return '';
    if (p.ko === q.ko) return 'same';
    if (p.fam !== q.fam || p.a !== q.a || p.b !== q.b) return '';
    const line = PRO_COLOR_NAMES.filter(n => n[5] === p.fam && n[3] === p.a && n[4] === p.b).sort((x, y) => x[2] - y[2]);
    const i = line.findIndex(n => n[0] === p.ko), j = line.findIndex(n => n[0] === q.ko);
    return Math.abs(i - j) === 1 ? (j > i ? 'up' : 'down') : '';
}
const whyRo = name => { const code = String(name).slice(-1).charCodeAt(0), t = code >= 0xAC00 && code <= 0xD7A3 ? (code - 0xAC00) % 28 : 1; return (t === 0 || t === 8) ? '로' : '으로'; };
// ③ 색 잇기 말: "{벽} 벽보다 한 톤 밝은 {원단색}으로" / "{벽} 벽과 {바닥} 바닥 사이의 {원단색}으로" / "{바닥} 바닥에 맞춘 {원단색}으로" (S0: 잰 값으로 말할 수 있는 것만)
function whyColorRel(F, R) {
    const fn = proNameOf(F.lab), wn = R.wallName;
    if (!fn) return '';
    const fc = fn + ' 색';
    const wp = wn ? wn + ' 색 벽' : '벽', fp = R.floorName ? R.floorName + ' 바닥' : '바닥';
    let t;
    if (F.link === 'wall') {
        const rel = R.wall ? proToneRel(R.wall, F.lab) : '';
        t = rel === 'same' ? `벽과 같은 ${fc}` : rel === 'up' ? `${wp}보다 한 톤 밝은 ${fc}` : rel === 'down' ? `${wp}보다 한 톤 진한 ${fc}` : `${wp}에 맞춘 ${fc}`;
    } else if (F.link === 'bridge') t = `${wp}과 ${fp} 사이의 ${fc}`;
    else t = `${fp}에 맞춘 ${fc}`;
    return t + whyRo(fc);
}
// S. 색 잇기가 실제로 맞는 원단만 (S0: 맞지 않으면 조각 없음, 지어내지 않음)
function whyLinkFits(F, R) {
    const c = F.lab, dir = F.link;
    if (!c || F.kind === 'blind') return false;
    if (dir === 'wall') return !!R.wall && whyDE(c, R.wall) < 8;
    if (dir === 'bridge') return !!R.bridge && whyDE(c, R.bridge) < 8;
    if (dir === 'floor') return !!R.floor && (whyDE(c, R.floor) < 10 || (!!c.fam && c.fam === R.floor.fam));
    return false;
}
// 원단 한 개의 재료를 순서대로: F(③ 칸 조각) → C(최대 2) → D → O3/T → P(겉지만). 작은 안내(O1·O2·F4·C5·F10)는 따로 (36번 · 83번 문장표 5장)
function whyItemCands(F, R, facts) {
    const list = [], c = F.lab, f = F.f, kind = F.kind, add = (g, id, a, b) => list.push({ g, id, t: [a, b || null] });
    // F. 손님 말 ↔ 기능 (하나만) — 문장이 아니라 ③ 칸 조각 (83번)
    if (kind === 'sheer') {
        const d = DENSITY_LABELS[f.density] ? f.density : null;
        if (R.light === 'high' && d === 'day') add('F', 'F9', WHY_F_FRAG.F9);
        else if (R.light === 'low' && (R.privacy === 'high' || R.privacy === 'some') && d === 'heavy') add('F', 'F8', WHY_F_FRAG.F8);
        else if (R.privacy === 'high' && (d === 'day' || d === 'heavy')) add('F', 'F1', WHY_F_FRAG.F1);
        else if (R.privacy === 'some' && (d === 'medium' || d === 'day')) add('F', 'F2', WHY_F_FRAG.F2);
        else if (R.privacy === 'open' && d === 'light') add('F', 'F3', WHY_F_FRAG.F3);
    } else if (kind === 'drape') {
        const b = blackoutLevel(f);
        if (R.block === 'dark' && b === 'full') add('F', 'F4', WHY_F_FRAG.F4);
        else if (R.block === 'soft' && b === 'life') add('F', 'F5', WHY_F_FRAG.F5);
        else if (R.block === 'soft' && (b === 'none' || b === 'mid')) add('F', 'F6', WHY_F_FRAG.F6);
        else if (R.block === 'light' && (b === 'none' || b === 'mid')) add('F', 'F7', WHY_F_FRAG.F7);
    } else if (F.it.keep) {
        // 블라인드: 지금까지의 한 줄(빛 가림 답과 맞는 점)을 "~습니다"로 — 원단 줄에 씀 (83번)
        const k = String(F.it.keep).replace(/[.!?]$/, '');
        add('B', 'FB:' + k, /(다|요)$/.test(k) ? k + '.' : k + '입니다.');
    }
    if (kind === 'blind') return list;
    // C. 원단 색 ↔ 벽·바닥 (밝기 이야기 1 + 기운 이야기 1). 한 톤 밝게/진하게를 누른 원단은 C를 쓰지 않음 (K는 ③ 칸에서 말함, 83번)
    if (!F.it.toneStep && c) {
        if (kind === 'sheer' && c.L >= 88) add('C', 'C8', '밝은 흰색이라, 닫아 두면 햇빛을 받아 커튼 전체가 환하게 보입니다.', '흰빛이 밝아, 닫아 두어도 낮에 창 쪽이 어둡지 않습니다.');
        else if (R.wall) {
            const dL = c.L - R.wall.L;
            if (whyDE(c, R.wall) < 6) add('C', 'C1', '커튼을 닫아도 공간이 넓어 보입니다.', '커튼이 눈에 띄지 않습니다.');
            else if (dL > 15) add('C', 'C3', '창 쪽이 가장 환해 보입니다.', '창이 넓어 보입니다.');
            else if (dL >= 6) add('C', 'C2', '창 쪽이 환해 보입니다.', '공간이 가벼워 보입니다.');
            else if (dL < -15 && R.pres !== 'calm' && !(kind === 'sheer' && !R.pres)) add('C', 'C5', '창이 먼저 눈에 들어옵니다.', '공간이 또렷하게 나뉘어 보입니다.');      // 183번: "조용히 스며들게요"면 아래 C4로 · 197번: 느낌을 안 물은 속지도 C4로
            else if (dL <= -6) add('C', 'C4', '창 쪽이 차분해 보입니다.', '공간이 정돈되어 보입니다.');
        }
        if (R.floor) {
            if (c.fam && c.fam === R.floor.fam) add('C', 'C6', `바닥${R.floorName ? ' ' + R.floorName + whyJosa(R.floorName) : '과'} 같은 ${WHY_FAM_WORD[c.fam]} 기운이 있어 잘 어울립니다.`, `${R.floorWood === false ? '바닥' : '바닥 나무'}색과 같은 쪽 색이라 잘 어울립니다.`);
            else if (c.C < 3 && R.floor.C >= 6) add('C', 'C7', `색 기운이 거의 없어, ${R.floorWood === false ? '바닥' : '바닥 나무'}색과 부딪히지 않습니다.`, '한쪽으로 치우친 색이 아니라, 바닥 색과 함께 두어도 차분합니다.');
        }
    }
    // D. 창 방향이 만드는 결과 (방위 이름은 ② 칸에만). 하나만. D7~D9는 북쪽만 든 창에서만 (83번: 북서·북동은 동·서 문장) · D0(180번)은 북쪽이 든 창 모두
    const lifeFull = kind === 'drape' && ['life', 'full'].includes(blackoutLevel(f));
    const warm = !!(c && c.fam && WHY_WARM_FAM.includes(c.fam));
    const nOnly = R.N && !R.E && !R.W;
    const D = [
        [R.N && kind === 'drape' && typeof isCoolGray === 'function' && isCoolGray(c), 'D0', '북쪽 빛은 푸른 기운이 있어, 이 색은 낮에 조금 더 푸르고 짙게 보입니다. 창가에서 견본을 대 보고 정하겠습니다.'],      // 180번: 북쪽이 든 창(북동·북서 포함) + 찬 회색 — D 가운데 가장 먼저
        [R.E && R.bedroom && lifeFull, 'D1', '이른 아침 햇빛을 가려, 잠이 덜 깹니다.'],
        [R.W && lifeFull, 'D5', '낮게 드는 오후 햇빛의 눈부심과 열기가 줄어듭니다.'],
        [R.E && kind === 'sheer', 'D2', '아침에는 속지만 닫아도 공간이 밝습니다.'],
        [R.S && !R.E && !R.W && kind === 'sheer', 'D6', '한낮의 강한 햇빛도 속지를 닫아 두면 눈부시지 않게 들어옵니다.'],
        [R.W && warm && c.C >= 6, 'D3', '오후에는 빛이 노래져, 이 색이 조금 더 따뜻해 보입니다.'],
        [R.W && c && c.C < 4, 'D4', '색 기운이 적어, 오후의 노란 빛에도 색이 크게 달라 보이지 않습니다.'],
        [nOnly && warm, 'D7', '푸르스름한 북쪽 빛에도, 따뜻한 기운이 있어 차가워 보이지 않습니다.'],
        [nOnly && c && c.C < 4 && c.L >= 75, 'D8', '하루 내내 밝기가 비슷해, 이 색이 시간마다 크게 달라 보이지 않습니다.'],
        [nOnly && kind === 'sheer' && c && c.L >= 85, 'D9', '빛이 적은 창이라, 밝은 속지로 빛을 덜 막습니다.']
    ].find(x => x[0]);
    if (D) add('D', D[1], D[2]);
    // O3 · T. 재질 (결 이야기는 하나만)
    const feelMatch = kind === 'sheer' && ((R.feel === 'textured' && F.tex === 'natural') || (R.feel === 'cozy' && F.tex === 'cozy') || (R.feel === 'linen' && F.mat === 'linen'));      // 191번: 린넨
    if (F.tex === 'natural' && R.opp) add('T', 'O3', '반대쪽 창에서 든 빛이 커튼 앞면을 비춰, 낮에도 짜임이 잘 보입니다.');
    if (feelMatch) add('T', 'T4', `고르신 ${R.feel === 'cozy' ? '도톰하고 보송한' : (R.feel === 'linen' ? '린넨' : '짜임이 보이는')} 느낌 그대로입니다.`);
    if (F.tex === 'natural' && !R.opp && (R.E || R.W || R.light === 'high')) add('T', 'T1', '짜임이 있는 원단이라, 비스듬히 드는 햇빛에 질감이 잘 보입니다.');
    else if (F.tex === 'cozy') add('T', 'T2', '도톰하고 보송해서, 만지면 포근합니다.');
    else if (F.tex === 'smooth' && kind === 'sheer' && R.feel === 'smooth') add('T', 'T3', '매끈해서 주름이 곧고 깔끔하게 떨어집니다.');
    // P. 속지 ↔ 겉지 짝 (겉지 줄에만). 기운이 엇갈리는 짝(P4)은 문장 없음
    const sh = kind === 'drape' && c && facts.find(x => x.kind === 'sheer' && x.lab);
    if (sh) {
        const s = sh.lab;
        if (s.fam && s.fam === c.fam && c.L <= s.L - 10) add('P', 'P1', '속지와 같은 계열에 한 톤 진한 색이라, 겹쳐 닫아도 어색하지 않습니다.');
        else if (s.C < 3 && s.L >= 88 && c.C >= 4) add('P', 'P2', `낮에는 흰 속지로 밝게, 밤에는 ${F.it.colorDesc ? F.it.colorDesc + ' ' : ''}겉지로 차분하게 쓰실 수 있습니다.`);
        else if (whyDE(s, c) < 5) add('P', 'P3', '속지와 색이 거의 같아, 겹쳐 닫아도 깔끔합니다.');
    }
    return list;
}
// 작은 안내(한 원단에 1개, 36번 · 83번): 반대쪽 창(O1·O2)이나 밤 안내가 있는 공간이 먼저, 없으면 완전 암막(F4)·벽보다 훨씬 진한 색(C5)·햇빛에 옅어 보임(F10, 63번)
function whyItemNote(F, R, cands) {
    if (R.opp) {
        if (F.kind === 'sheer' && (R.privacy === 'some' || R.privacy === 'high')) return '반대쪽 창으로 빛이 들어 공간 안이 바깥보다 밝은 낮에는, 밖에서 안이 조금 비쳐 보일 수 있습니다. 신경 쓰이시면 겉지를 조금 닫아 두시면 됩니다.';
        if (F.kind === 'drape' && R.block === 'dark') return '반대쪽 창에서도 빛이 들어, 그쪽도 가려야 공간이 완전히 어두워집니다.';
    }
    if (R.room && R.room.night) return '';      // 속지만 밤 안내가 있는 공간은 안내가 이미 있음 (한 원단에 1개)
    const ids = (cands || []).map(x => x.id);
    // 소재 안내 (94번, 문장표 M1·M2): 린넨룩은 "린넨"이라 부르지 않음
    if (F.mat === 'linen') return '린넨이라 자연스럽게 구김이 가고, 세탁하면 조금 줄 수 있습니다.';
    if (F.mat === 'linenlook') return '린넨 느낌을 낸 원단이라, 구김이 적고 관리가 쉽습니다.';
    if (ids.includes('F4')) return '커튼 옆과 위로 새는 빛은 조금 남습니다.';
    if (ids.includes('C5') && !(F.it.toneStep < 0)) return '차분한 쪽이 좋으시면 한 톤 밝은 색도 같이 보실 수 있습니다.';
    if (F.kind === 'drape' && ['none', 'mid', 'life'].includes(blackoutLevel(F.f))) return '햇빛이 강하게 비치면 원단 색이 조금 옅고 밝게 보입니다.';
    return '';
}
// ① 들은 말 (83번, 문장표 2장): 실제로 원단 고르는 데 쓰인 답만, 최대 2개 (바깥 시선 → 빛 가림 → 햇빛 양 → 속지 느낌)
function whyHeardOf(R, all) {
    const ids = all.map(x => x.id);
    const has = list => list.some(id => ids.includes(id));
    const q = [];
    if (has(['F1', 'F2', 'F3', 'F8']) && WHY_SAY.privacy[R.privacy]) q.push(WHY_SAY_TOPIC.privacy + ' “' + WHY_SAY.privacy[R.privacy] + '”');
    if ((has(['F4', 'F5', 'F6', 'F7']) || ids.some(id => String(id).startsWith('FB:'))) && WHY_SAY.block[R.block]) q.push(WHY_SAY_TOPIC.block + ' “' + WHY_SAY.block[R.block] + '”');
    const pick = q.slice(0, 2);
    return pick.length ? pick.join(', ') + '라고 말씀하셨습니다.' : '';
}
// ③ 고른 것 문장 (83번, 문장표 4장)
function whyChoseOf(facts, candsList, R, heard) {
    const parts = [];
    facts.forEach((F, i) => {
        if (F.kind === 'blind') return;
        const k = F.kind === 'sheer' ? '속지' : '겉지';
        const f = candsList[i].find(x => x.g === 'F'), rel = whyLinkFits(F, R) ? whyColorRel(F, R) : '';
        const fr = f ? f.t[0] : '';
        if (rel && fr) parts.push(`${k}는 ${rel}, ${fr} 원단입니다.`);
        else if (rel) parts.push(`${k}는 ${rel} 골랐습니다.`);
        else if (fr) parts.push(`${k}는 ${fr} 원단으로 골랐습니다.`);
    });
    // 88번: "그래서"를 빼고 속지·겉지를 각각 한 문장으로 (앞 문장 '본 것' 때문에 고른 것처럼 들리지 않게)
    const out = parts.slice();
    // K (한 톤 바꿈): 둘째 문장
    const kf = facts.find(F => F.kind !== 'blind' && F.it.toneStep);
    if (kf) {
        const up = kf.it.toneStep > 0, kk = kf.kind === 'sheer' ? '속지' : '겉지';
        const tail = up ? '한 톤 밝은 색으로 바꿔, 빛을 더 환하게 받도록 했습니다.' : '한 톤 진한 색으로 바꿔, 차분한 무게를 더했습니다.';
        out.push(parts.length ? '그중 ' + tail : `${kk}는 ${tail}`);
    }
    return out;
}
// 카드에 들어갈 공간·원단 묶음 (비어 있으면 카드 없음) — 공간마다 ① heard · ③ chose, 원단마다 ④ lines·note (② 본 것은 houseDiagnosis)
//  같은 재료(C·D·T·P)는 제안서 안에서 한 번만: 두 번째는 "나" 말, 세 번째부터는 건너뜀
function whySetsOf(data) {
    const out = [], used = {}, shown = [];
    const nFab = data.rooms.reduce((a, r) => a + (r.diagnosed ? r.items.filter(i => i.fabricId).length : 0), 0);
    const MAX = nFab >= 6 ? 1 : 2;      // 원단 줄은 원단마다 2문장까지, 원단이 6개 이상이면 1문장 (83번) · D0은 한도와 따로(219번)
    const say = c => {
        const n = used[c.id] || 0, t = c.t[n] || null;
        if (t) used[c.id] = n + 1;
        return t;
    };
    let prevRoom = null;
    data.rooms.forEach(room => {
        if (!room.diagnosed) return;
        const items = room.items.filter(it => it.fabricId);
        if (!items.length) return;
        const R = whyRoomCtx(room), facts = items.map(it => whyItemFacts(it, R));
        const candsList = facts.map(F => whyItemCands(F, R, facts));
        const keys = facts.map(F => [F.it.fabricId, F.it.colorName, F.it.kindKey, R.privacy, R.block, R.light, R.feel, F.link, F.it.toneStep].join('|'));
        // 같은 이유: 바로 앞 공간과 원단·답·색 잇기가 모두 같으면 ①은 비우고 ③은 한 문장, ④는 새로 생긴 재료만(예: 방향이 달라 생긴 D)
        const same = prevRoom && prevRoom.chose && prevRoom.keys.length === keys.length && keys.every(k => prevRoom.keys.includes(k)) ? prevRoom : null;
        const sets = facts.map((F, fi) => {
            const it = F.it, cands = candsList[fi];
            const prevIds = same ? (same.ids[keys[fi]] || []) : [];
            const pool = cands.filter(x => x.g !== 'F' && !prevIds.includes(x.id));
            // 재료마다 하나씩 먼저(C → D → O3/T → P), 자리가 남으면 C·T의 두 번째. 고른 뒤에는 원래 순서대로 놓음
            const picked = [], per = {};
            [1, 2].forEach(pass => pool.forEach((x, i) => {
                if ((x.id !== 'D0' && picked.filter(p => p.id !== 'D0').length >= MAX) || picked.some(p => p.i === i)) return;      // 219번: D0(북쪽 창 + 찬 회색, 180번)은 문장 수 한도와 따로 붙임
                if ((per[x.g] || 0) >= (pass === 1 ? 1 : (x.g === 'C' || x.g === 'T' ? 2 : 1))) return;
                const t = x.g === 'B' ? x.t[0] : say(x);
                if (t) { picked.push({ i, t, id: x.id }); per[x.g] = (per[x.g] || 0) + 1; }
            }));
            const lines = picked.sort((a, b) => a.i - b.i).map(p => p.t);
            return { it, hex: F.hex, lines, note: whyItemNote(F, R, cands), shownIds: picked.map(p => p.id) };
        });
        // ① 들은 말은 실제로 쓰인 재료로만: ③ 칸의 F 조각 + 원단 줄에 실린 T4·블라인드 한 줄
        const usedIds = [].concat(...candsList.map(cs => cs.filter(x => x.g === 'F')), ...sets.map(st => st.shownIds.map(id => ({ id }))));
        const heard = same ? '' : whyHeardOf(R, usedIds);
        const chose = same ? [`${same.name}${whyJosa(same.name)} 같은 이유로 골랐습니다.`] : whyChoseOf(facts, candsList, R, heard);
        const ids = {};
        keys.forEach((k, i) => { ids[k] = candsList[i].map(x => x.id); });
        prevRoom = { name: room.name, keys, ids, chose: chose.length > 0 };      // 앞 공간에 고른 이유가 있을 때만 "같은 이유"
        // 벽·바닥이 앞 공간과 같은 코드면 ② 칸에 "벽과 바닥은 ○○과 같습니다." (S4)
        const colors = room.colors || [], code = k => (colors.find(c => c.k === k) || {}).hex || '';
        const sameC = (code('벽') && code('바닥')) ? shown.find(p => p.wall === code('벽') && p.floor === code('바닥')) : null;
        if (code('벽') && code('바닥') && !sameC) shown.push({ room: room.name, wall: code('벽'), floor: code('바닥') });
        out.push({ name: room.name, sets, colors, sameAs: sameC ? sameC.room : '', dirText: R.dirText, heard, chose, space: chose, night: !!room.night, ans: room.ans });
    });
    return { rooms: out };
}
// compact: 원단이 4개 이상이면 글자를 한 단계 작게 (출력 2장에 맞추려고, 제미나이 출력 화면 제안 10-15). 문장 수는 줄이지 않음 (35번)
function drawWhy(ctx, data, W, compact, title) {
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const MONO = 'ui-monospace,Menlo,Consolas,monospace';
    const DARK = '#2b221a', MUTED = '#6f5f4f', SOFT = '#6f5f4f', LINE = '#e5dcd0';
    const PAD = TICKET_PAD, CX = PAD, RX = W - PAD, CW = RX - CX, HEAD_Y = TICKET_HEAD_Y, START_Y = HEAD_Y;      // 첫 공간의 윗선이 머리글 굵은 선과 겹침
    const COL_GAP = 36;
    const Q_SIZE = PAPER_F3, Q_LH = compact ? 36 : 40;              // 손님 말 (400 명조 — 우리 집 색 총평과 같은 크기·굵기, 39번)
    const B_SIZE = PAPER_F4, B_LH = compact ? 29 : 31;              // 이유 (고딕, 볼드 없음)
    const C_SIZE = PAPER_F4, C_LH = compact ? 30 : 32, C_SW = 20;      // 잰 벽·바닥 색 줄 (32번) · 원단 색 칩도 같은 크기 (35번)
    const N_SIZE = PAPER_F4, N_LH = compact ? 28 : 30;              // 회색 안내 (밤 안내 33번 · 맞은편 창 35번)
    const T_SIZE = PAPER_F3, T_LH = compact ? 34 : 36;      // 원단 이름 (본문 32 명조, 75번)
    const setFont = (weight, size, family) => { ctx.font = `${weight} ${size}px ${family}`; };
    const canSpace = 'letterSpacing' in ctx;
    const spacing = v => { if (canSpace) ctx.letterSpacing = v; };
    const hline = (x1, x2, y, color, lw) => { ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); };
    const text = (str, x, y, align, color) => { ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(str, x, y); };
    const label = (str, x, y, align, gap) => { spacing(gap + 'px'); text(str, x + ((align === 'right' && canSpace) ? gap : 0), y, align, SOFT); spacing('0px'); };
    const wrap = (str, maxW, firstW) => {      // firstW: 첫 줄만 폭이 다를 때 (칩 옆)
        const lines = []; let cur = '';
        const lim = () => (lines.length === 0 && firstW != null) ? firstW : maxW;
        for (const word of String(str).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (ctx.measureText(test).width <= lim()) { cur = test; continue; }
            if (cur) lines.push(cur);
            cur = '';
            if (ctx.measureText(word).width <= lim()) { cur = word; continue; }
            let chunk = '';
            for (const ch of word) { if (ctx.measureText(chunk + ch).width > lim()) { lines.push(chunk); chunk = ch; } else chunk += ch; }
            cur = chunk;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    // 머리글: 견적서(drawTicket hdr)와 같은 자리·같은 모양. 오른쪽 제목만 "원단을 고른 이유" (우리 집 색 쪽은 title로 바꿔 씀, 37번)
    //  74번: 고객 이름·날짜 줄은 뺌 — 견적서 쪽에만 있음(견적서만 따로 보내도 그 쪽에 다 있게)
    function hdr() {
        drawRedamLogo(ctx, CX, 112, PAPER_F1, DARK, '#8a4a22', 'left');   // 150번: 새 글씨 로고
        setFont(400, PAPER_F2, SERIF);
        if (canSpace) { spacing('5px'); text(title || '공간 제안', RX + 5, 108, 'right', DARK); spacing('0px'); }
        else text(title || '공간 제안', RX, 108, 'right', DARK);
        hline(CX, RX, HEAD_Y, DARK, 1);
    }
    // 원단 한 묶음: [■ 색 칩 + 코드] 속지 · 원단 이름 색 이름 → 이유 1~3문장 → 회색 안내. 볼드 없이 색 농도(DARK / MUTED / SOFT)로 위계 (39번)
    function layoutSet(set, colW) {
        const ops = []; let cy = 26;
        const name = set.it.name;      // 이미 색 이름이 앞에 있어 색 설명을 따로 붙이지 않음 (61번)
        let chipW = 0;
        if (set.hex) {      // 칩은 잰 색(색상코드)만. 없으면 칩·코드 없이 이름만
            setFont(400, C_SIZE, SANS);
            chipW = C_SW + 10 + ctx.measureText(set.hex).width + 16;
            ops.push({ chip: set.hex, y: cy });
        }
        setFont(400, T_SIZE, SERIF);
        const titleText = (set.it.kind === '블라인드' && name.includes('블라인드')) ? name : `${set.it.kind} · ${name}`;
        const hl = wrap(titleText, colW, colW - chipW);
        hl.forEach((ln, i) => { ops.push({ t: ln, f: [400, T_SIZE, SERIF], c: DARK, y: cy, x: i === 0 ? chipW : 0 }); if (i < hl.length - 1) cy += T_LH; });
        cy += T_LH + 4;
        if (set.lines.length) {
            setFont(400, B_SIZE, SANS);
            wrap(set.lines.join(' '), colW).forEach(ln => { ops.push({ t: ln, f: [400, B_SIZE, SANS], c: MUTED, y: cy }); cy += B_LH; });
        }
        if (set.note) {
            setFont(400, N_SIZE, SANS);
            cy += 4;
            wrap(set.note, colW).forEach(ln => { ops.push({ t: ln, f: [400, N_SIZE, SANS], c: SOFT, y: cy - 4 }); cy += N_LH; });
        }
        return { set, ops, h: Math.max(C_SW + 8, cy - B_LH + 8) };
    }
    // 공간 한 묶음: 가는 윗선(첫 공간은 머리글 선과 겹침) · 왼쪽 공간 이름(400 명조 24px, 우리 집 색과 같은 왼쪽 기둥 폭) · 오른쪽(QX)에 손님 말·벽/바닥·원단·이유를 가지런히 정렬 (39번)
    const R_SIZE = PAPER_F2;
    function layoutRoom(R) {
        const quotes = R.heard ? [R.heard.replace(/라고 말씀하셨습니다\.$/, '')] : [];      // 156번: 최종 제안 ① 들은 말과 같은 인용. 창 방향은 따옴표에 넣지 않음
        setFont(400, R_SIZE, SERIF);
        const nameW = Math.max(148, Math.ceil(ctx.measureText(R.name).width) + 28);
        const QX = CX + nameW, QW = RX - QX;
        // 손님 말은 따옴표 하나가 줄 중간에서 끊기지 않게 통째로 놓음 (한 줄보다 길 때만 쪼갬)
        setFont(400, Q_SIZE, SERIF);
        const qLines = []; let cur = '';
        quotes.forEach(q => {
            const test = cur ? cur + '  ' + q : q;
            if (ctx.measureText(test).width <= QW) { cur = test; return; }
            if (cur) qLines.push(cur);
            if (ctx.measureText(q).width <= QW) cur = q;
            else { const w = wrap(q, QW); cur = w.pop(); qLines.push(...w); }
        });
        if (cur) qLines.push(cur);
        let saidInline = false;
        if (qLines.length) {
            const lastW = ctx.measureText(qLines[qLines.length - 1]).width;
            setFont(400, PAPER_F4, SANS);
            saidInline = lastW + 2 + ctx.measureText('라고 말씀하셨습니다.').width <= QW;
        }
        const qn = qLines.length + (qLines.length && !saidInline ? 1 : 0);
        let base = qn ? 44 + (qn - 1) * Q_LH : 0;      // 지금까지 쓴 마지막 줄의 글자 아랫선 (공간 윗선 기준)
        // 잰 벽·바닥 색 한 줄 (32번) + 창 방향: 들어가는 만큼 한 줄에, 넘치면 다음 줄. 앞 공간과 같은 색이면 한 줄 글로 (S4)
        setFont(400, C_SIZE, SANS);
        const parts = R.sameAs ? [] : (R.colors || []).slice();
        if (R.dirText) parts.push({ k: '창', name: R.dirText + '쪽', hex: '' });      // 156번: 벽·바닥을 못 잰 공간에서도 "창 남쪽"
        const cRows = []; let cRowW = 0;
        parts.forEach(c => {
            const w = (c.hex ? C_SW + 10 : 0) + ctx.measureText(`${c.k} ${c.name} ${c.hex}`).width + 20;      // 대략 폭 (그릴 때 글꼴별로 다시 잼)
            if (cRows.length && cRowW + w <= QW) { cRows[cRows.length - 1].push(c); cRowW += w + 28; }
            else { cRows.push([c]); cRowW = w + 28; }
        });
        const cY = base + 42;
        if (cRows.length) base = cY + (cRows.length - 1) * C_LH;
        const sameY = R.sameAs ? base + 42 : 0;
        if (R.sameAs) base = sameY;
        // 공간 문장 (S, 공간에 한 번)
        setFont(400, B_SIZE, SANS);
        const sLines = R.space.length ? wrap(R.space.join(' '), QW) : [];
        const sY = base + (base ? 38 : 44);
        if (sLines.length) base = sY + (sLines.length - 1) * B_LH;
        const headH = Math.max(44, base) + 20;
        const two = false;      // 폭이 좁아 원단은 한 줄에 하나 (75번)
        const colW = two ? (QW - COL_GAP) / 2 : QW;
        const sets = R.sets.map(s => layoutSet(s, colW));
        const rows = two ? [Math.max(sets[0].h, sets[1].h)] : sets.map(s => s.h);
        const bodyH = rows.reduce((a, b) => a + b, 0) + (rows.length - 1) * 22;
        // 속지만 밤 안내 (33번): 원단 아래 차분한 작은 회색 글
        let nLines = [];
        if (R.night && typeof SHEER_NIGHT_NOTE === 'string') { setFont(400, N_SIZE, SANS); nLines = wrap(SHEER_NIGHT_NOTE, QW); }
        const noteH = nLines.length ? 18 + nLines.length * N_LH : 0;
        return { R, nameW, QX, QW, qLines, saidInline, headH, two, colW, sets, rows, cRows, cY, sameY, sLines, sY, nLines, bodyH, h: headH + bodyH + noteH + 28 };
    }
    function chip(hex, x, base) {
        ctx.fillStyle = hex; ctx.fillRect(x, base - C_SW + 3, C_SW, C_SW);
        ctx.strokeStyle = 'rgba(43,34,26,0.18)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, base - C_SW + 3.5, C_SW - 1, C_SW - 1);
    }
    // "■ 벽 라이트 베이지 #D8CEBF" 한 칸: 색 조각 · 벽/바닥(작게, SOFT) · 이름(400, DARK) · 코드(작게, SOFT). 볼드 없이 색 농도로 구분 (39번)
    function drawColorPart(c, x, base) {
        if (c.hex) { chip(c.hex, x, base); x += C_SW + 10; }
        setFont(400, C_SIZE, SANS); text(c.k, x, base, 'left', SOFT); x += ctx.measureText(c.k).width + 8;
        if (c.name) { setFont(400, C_SIZE, SANS); text(c.name, x, base, 'left', DARK); x += ctx.measureText(c.name).width + 8; }
        if (c.hex) { setFont(400, C_SIZE, SANS); text(c.hex, x, base, 'left', SOFT); x += ctx.measureText(c.hex).width; }
        return x + 28;
    }
    function drawRoom(L, y) {
        if (y > START_Y) hline(CX, RX, y, LINE, 0.6);      // 첫 공간 윗선은 머리글 선을 그대로 쓰고, 다음 공간부터는 1·3쪽과 같은 가는 베이지 실선 (39·76번)
        setFont(400, R_SIZE, SERIF); text(L.R.name, CX, y + 44, 'left', DARK);
        setFont(400, Q_SIZE, SERIF);
        L.qLines.forEach((ln, i) => text(ln, L.QX, y + 44 + i * Q_LH, 'left', DARK));
        if (L.qLines.length) {
            const lastY = y + 44 + (L.qLines.length - 1) * Q_LH;
            const lastW = ctx.measureText(L.qLines[L.qLines.length - 1]).width;
            setFont(400, PAPER_F4, SANS);
            if (L.saidInline) text('라고 말씀하셨습니다.', L.QX + lastW + 2, lastY, 'left', SOFT);
            else text('라고 말씀하셨습니다.', L.QX, lastY + Q_LH, 'left', SOFT);
        }
        L.cRows.forEach((row, i) => { let x = L.QX; row.forEach(c => { x = drawColorPart(c, x, y + L.cY + i * C_LH); }); });
        if (L.R.sameAs) { setFont(400, C_SIZE, SANS); text(`벽과 바닥은 ${L.R.sameAs}${whyJosa(L.R.sameAs)} 같습니다.`, L.QX, y + L.sameY, 'left', MUTED); }
        if (L.sLines.length) { setFont(400, B_SIZE, SANS); L.sLines.forEach((ln, i) => text(ln, L.QX, y + L.sY + i * B_LH, 'left', DARK)); }
        const top = y + L.headH;
        L.sets.forEach((b, i) => {
            const sx = L.QX + (L.two ? i * (L.colW + COL_GAP) : 0);
            const sy = top + (L.two ? 0 : L.rows.slice(0, i).reduce((a, h) => a + h + 22, 0));
            b.ops.forEach(o => {
                if (o.chip) {
                    chip(o.chip, sx, sy + o.y);
                    setFont(400, C_SIZE, SANS); text(o.chip, sx + C_SW + 10, sy + o.y, 'left', SOFT);
                    return;
                }
                setFont(o.f[0], o.f[1], o.f[2]); text(o.t, sx + (o.x || 0), sy + o.y, 'left', o.c);
            });
        });
        if (L.nLines.length) {
            setFont(400, N_SIZE, SANS);
            L.nLines.forEach((ln, i) => text(ln, L.QX, top + L.bodyH + 18 + (i + 1) * N_LH - 8, 'left', SOFT));
        }
    }
    function pageLabel(i, n, H) { if (n < 2) return; setFont(400, PAPER_F4, SANS); text(`${i + 1} / ${n}`, W / 2, H - 30, 'center', SOFT); }
    return { START_Y, hdr, layoutRoom, drawRoom, pageLabel };
}
// 카드 쪽(들) 만들기: 머리글·글자 크기가 1·2·3쪽 모두 같게 유지되도록 축소 배율(TICKET_SCALES)은 쓰지 않고, 한 쪽에 안 들어가면 compact → 다음 쪽으로 나눔 (39번)
function buildWhyCanvases(data, opts, totalAfter, before) {      // before: 앞에 있는 쪽 수 (우리 집 색, 37번)
    const info = whySetsOf(data);
    if (!info.rooms.length) return [];
    const plan = compact => {
        const W = PAPER_W, PAGE_H = 1e6, BOTTOM = 90;      // 쪽 나눔 없음 (75번)
        const T = drawWhy(document.createElement('canvas').getContext('2d'), data, W, compact);
        const pages = []; let cur = { items: [], y: T.START_Y };
        info.rooms.forEach(R => {
            const L = T.layoutRoom(R);
            if (cur.items.length && cur.y + L.h > PAGE_H - BOTTOM) { pages.push(cur); cur = { items: [], y: T.START_Y }; }
            cur.items.push({ L, y: cur.y }); cur.y += L.h;
        });
        pages.push(cur);
        return { compact, W, PAGE_H, pages };
    };
    let p = plan(false);
    if (p.pages.length > 1) { const q = plan(true); if (q.pages.length < p.pages.length) p = q; }
    const pr = opts.pixelRatio || 1, n = p.pages.length;
    return p.pages.map((pg, pi) => {
        const H = Math.ceil(pg.y + 90);
        const canvas = document.createElement('canvas');
        canvas.width = TICKET_W * pr; canvas.height = Math.round(H * PAPER_K * pr);
        const ctx = canvas.getContext('2d');
        ctx.scale(PAPER_K * pr, PAPER_K * pr);
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, p.W, H);
        ctx.textBaseline = 'alphabetic';
        const t = drawWhy(ctx, data, p.W, p.compact);
        t.hdr();
        pg.items.forEach(it => t.drawRoom(it.L, it.y));
        t.pageLabel(pi + (before || 0), totalAfter(n), H);
        return canvas;
    });
}

// ==============================================================
// 〈우리 집 색〉 쪽 (작업목록 37번): 최종 제안 맨 앞. 공간끼리 어떻게 어울리는지 = 색 지도 + 총평 2~3문장 + 공간별 색 줄
//  이유 카드(이 공간에 왜 이 원단인지)와 역할을 나눔 — 이유 카드 문장은 여기 다시 쓰지 않음. 금액·직원용 색 사전 이름 없음
//  원단을 담은 공간이 2곳 이상이고 그 원단 중 색 값(L·a·b)이 있는 것이 있을 때만. 시안: Claude outputs/시안/우리집색_시안.html
// ==============================================================
// 총평 숫자 (임시값 — 몇 집 써 보고 사장님이 정함). 색 차이는 Lab 거리(ΔE76)
const HOUSE_UNIFY = 14;          // 공간마다 대표 원단끼리 가장 먼 차이가 이 안이면 "집 전체를 ○○ 계열로"
const HOUSE_SHEER_SAME = 6;      // 속지끼리 가장 먼 차이가 이 안이면 "속지는 비슷한 밝기로"
const HOUSE_FUR_NEAR = 12;       // 가구와 그 공간 벽·바닥 색 차이가 이 안이면 "벽·바닥과 비슷한 색이라" (65번)
const HOUSE_KIND_ORDER = { 겉지: 0, 속지: 1, 블라인드: 2 };
// 받침에 따라 은/는 · 이/가 · 과/와 (숫자로 끝나면 읽는 소리로: 1·3·6·7·8·0은 받침 있음)
function houseJosa(w, withB, noB) {
    const ch = String(w).slice(-1), code = ch.charCodeAt(0);
    const has = (code >= 0xAC00 && code <= 0xD7A3) ? (code - 0xAC00) % 28 > 0 : '013678'.includes(ch);
    return has ? withB : noB;
}
// 공간마다 [이름 · 잰 벽·바닥 · 가구 · 원단들(색 값)] — 원단을 담은 공간만
function houseSpacesOf(data) {
    const nameOf = (k, c) => (window.RoomColor && RoomColor.colorName && (RoomColor.colorName(k, c) || {}).name) || '';
    const okLab = c => c && typeof c.L === 'number' && typeof c.a === 'number' && typeof c.b === 'number';
    const okHex = h => /^#[0-9a-f]{6}$/i.test(h || '');
    return data.rooms.map(room => {
        const items = room.items.filter(it => it.fabricId);
        if (!items.length) return null;
        const mc = (room.raw && room.raw.measuredColor) || {};
        const part = k => (okLab(mc[k]) && okHex(mc[k].hex)) ? { L: mc[k].L, a: mc[k].a, b: mc[k].b, hex: mc[k].hex.toUpperCase(), name: matNameOf(k, mc[k]) } : null;
        // 가구 (66번): 종류 이름은 새 이름으로(예전 수납장·식탁도), 그대로 두는 가구를 앞에 (이불·러그는 뒤로, 같은 쪽끼리는 찍은 순서)
        const RC = window.RoomColor || {};
        const fur = (Array.isArray(mc.furniture) ? mc.furniture : []).filter(f => okLab(f) && okHex(f.hex))
            .map(f => ({ n: RC.furLabel ? RC.furLabel(f.n) : f.n, L: f.L, a: f.a, b: f.b, hex: f.hex.toUpperCase(), name: RC.furName ? RC.furName(f) : '', stay: RC.furStays ? RC.furStays(f.n) : true }))
            .sort((x, y) => (y.stay ? 1 : 0) - (x.stay ? 1 : 0));
        const fabs = items.map(it => {
            const col = whyFabricColor(it.fabricId, it.colorName);
            const lab = col && typeof col.L === 'number' ? { L: col.L, a: col.a, b: col.b } : null;
            return { k: it.kind, fabricId: it.fabricId, colorName: it.colorName, nm: it.tone ? `${it.name} · ${it.tone}` : it.name, hex: it.sampleBlind ? null : ((col && col.hex) || it.fill), lab: it.sampleBlind ? null : lab,      // 61번 · 211번: 실물 견본은 색 없음(띠 칸 비움)
                cn: String(it.name || '').split(' · ')[0] };      // 132번: 색 지도 이름표의 색 이름 (색 사전 이름, "색 이름 · 재질"의 앞)
        });
        return { name: room.name, wall: part('wall'), floor: part('floor'), fur, fabs, raw: room.raw || {} };
    }).filter(Boolean);
}
function houseShows(data, opts) {
    if (opts && opts.noCard) return false;
    const sp = houseSpacesOf(data);
    return sp.length >= 1 && sp.some(s => s.fabs.some(f => f.lab));      // 80번: 공간 1곳이어도 (작은 집도 같은 구성, 10-25 사장님)
}
// 공간의 대표 원단: 겉지 → 속지 → 블라인드 (색 값이 있는 것 중)
function houseRep(s) {
    return s.fabs.filter(f => f.lab).sort((x, y) => (HOUSE_KIND_ORDER[x.k] ?? 3) - (HOUSE_KIND_ORDER[y.k] ?? 3))[0] || null;
}
// 1번 공간별 창가 색 띠 (43번 모양, 세로 화면·가로 그림이 같이 씀, 65번)
//  { mid: [{ k, hex, f }] 가운데 창 줄(벽·원단, f = 폭 비율), baseR = 커튼 아래 벽 높이 비율(0이면 바닥까지), wHex, fHex }
function houseStripOf(s, raw) {
    raw = raw || {};
    const wHex = s.wall && s.wall.hex ? s.wall.hex : '#f2eee8';
    const fHex = s.floor && s.floor.hex ? s.floor.hex : '#e5ddcf';
    const fabs = s.fabs || [];
    // 부분 치수가 있어서 벽이 남는 경우에만 벽 연결 및 비율 계산 (43번)
    const sW = Number(raw.spaceWidth) || 0, cW = Number(raw.width) || 0;
    const sH = Number(raw.spaceHeight) || 0, cH = Number(raw.height) || 0;
    const isPartMode = raw.sizeMode === 'part' || raw.sizeMode === 'partial';
    const hasPartialW = (sW > 0 && cW > 0 && sW > cW);
    const hasPartialH = (sH > 0 && cH > 0 && sH > cH);
    let curt = 8.8, side = 0.6, baseR = 0;      // 전체 모드: 커튼이 88%, 양옆 벽 6%씩, 바닥까지 닿음
    if (isPartMode || hasPartialW || hasPartialH) {
        if (hasPartialW) { curt = 10 * Math.max(0.18, Math.min(0.85, cW / sW)); side = (10 - curt) / 2; }
        else if (isPartMode) { curt = 6.0; side = 2.0; }
        if (hasPartialH) baseR = Math.max(0.12, Math.min(0.55, (sH - cH) / sH));      // 높이가 다를 때만 하단 벽
    }
    const mid = [], add = (k, hex, f) => mid.push({ k, hex: hex || '#e5dcd0', f });
    if (fabs.length === 2 && fabs.some(f => f.k === '속지') && fabs.some(f => f.k === '겉지')) {
        const drape = fabs.find(f => f.k === '겉지'), sheer = fabs.find(f => f.k === '속지');
        add('벽', wHex, side); add('겉지', drape.hex, curt * 0.25); add('속지', sheer.hex, curt * 0.5); add('겉지', drape.hex, curt * 0.25); add('벽', wHex, side);
    } else if (fabs.length) {
        add('벽', wHex, side); fabs.forEach(f => add(f.k, f.hex, curt / fabs.length)); add('벽', wHex, side);
    } else {
        add('벽', wHex, 4.0);
        if (s.fur && s.fur[0]) add(s.fur[0].n || '가구', s.fur[0].hex, 1.2);
    }
    return { mid, baseR, wHex, fHex };
}
// ② 본 것 (65번 → 83번 문장표 3장): 창 방향의 빛(방위 이름 없이) + 벽·바닥 색(+가구). 최대 2문장
//  sameAs: 벽·바닥이 앞 공간과 같으면 "벽과 바닥은 ○○과 같습니다." (S4)
const HOUSE_DIR_SAY = {
    S: '하루 내내 밝은 창입니다.', E: '아침 해가 먼저 드는 창입니다.', W: '오후 햇빛이 길게 드는 창입니다.',
    N: '해가 직접 들지 않아, 하루 내내 밝기가 크게 변하지 않는 창입니다.',
    SE: '아침부터 한낮까지 해가 드는 창입니다.', SW: '한낮부터 오후까지 해가 길게 드는 창입니다.',
    NE: '아침에 잠시 해가 들고, 그 뒤로는 밝기가 크게 변하지 않는 창입니다.', NW: '오후 늦게야 해가 드는 창입니다.'
};
function houseColorWord(c) {
    const nm = c.name || '';
    if (!nm) return '';
    if (/^(라이트|딥|다크) |화이트|차콜|네이비/.test(nm)) return nm;      // 이름에 이미 밝기가 들어 있으면 그대로
    return (c.L >= 75 ? '밝은 ' : (c.L >= 55 ? '중간 톤 ' : '어두운 ')) + nm;
}
function houseDiagnosis(s, raw, sameAs) {
    const out = [];
    const dirs = (typeof windowDirOf === 'function') ? windowDirOf(raw && raw.windowDir).slice().sort((a, b) => 'SNEW'.indexOf(a) - 'SNEW'.indexOf(b)) : [];
    const say = HOUSE_DIR_SAY[dirs.join('')];
    if (say) out.push(say);
    const wall = s.wall && s.wall.name, floor = s.floor && s.floor.name;
    const fl = s.fur || [], word = f => `${f.name ? f.name + ' ' : ''}${f.n}`, last = fl[fl.length - 1];
    const fur = !fl.length ? '' : fl.length === 1 ? word(fl[0])
        : fl.slice(0, -1).map(word).join(', ') + houseJosa(fl[fl.length - 2].n, '과', '와') + ' ' + word(last);
    const furTail = fur ? `${fur}${houseJosa(last.n, '이', '가')} 함께 놓여 있습니다.` : '';
    const base = sameAs ? `벽과 바닥은 ${sameAs}${houseJosa(sameAs, '과', '와')} 같` : (wall && floor ? `벽은 ${wall}, 바닥은 ${floor}` : (wall ? `벽은 ${wall}` : (floor ? `바닥은 ${floor}` : '')));
    if (base) out.push(furTail ? `${base}${sameAs ? '고' : '이고'}, ${furTail}` : `${base}${sameAs ? '습니다.' : '입니다.'}`);
    else if (furTail) out.push(furTail);
    return out;
}
// 분위기 말 (118번): 커튼 느낌(pres) × 겉지 결(tex). 겉지가 없으면 커튼 느낌만. 답이 없으면 빈 말
const HOUSE_MOOD_WORD = {
    calm:   { smooth: '은은하고 차분한', fluffy: '은은하고 포근한', texture: '은은하고 자연스러운', '': '은은한' },
    weight: { smooth: '단정하고 깊은', fluffy: '아늑하고 묵직한', texture: '깊고 자연스러운', '': '차분하고 깊은' },
    point:  { smooth: '산뜻하고 또렷한', fluffy: '따뜻하고 생기 있는', texture: '생기 있고 자연스러운', '': '또렷한' }
};
function houseMoodWord(pres, tex, hasDrape) {
    const row = HOUSE_MOOD_WORD[pres];
    if (!row) return '';
    return row[hasDrape && row[tex] ? tex : ''];
}
// 분위기 문장 (118번 · 123번): 집 취향으로 한 문장 + "이 공간만 다르게"로 말이 달라진 공간은 같은 말끼리 묶어 한 문장씩
function houseMoodLines(sp) {
    const ht = (typeof houseTaste === 'object' && houseTaste) || {};
    const drapeOf = s => s.fabs.some(f => f.k === '겉지');
    const houseWord = houseMoodWord(ht.pres, ht.tex, sp.some(drapeOf));
    // 160번: 포인트 공간인데 포인트 색이 안 들어간 공간 — "고르신 느낌에 맞춰"라 하지 않고 사실대로 한 줄
    const held = sp.map(s => ({ s, h: typeof pointHeldOf === 'function' ? pointHeldOf(s.raw, s.fabs) : null })).filter(x => x.h);
    const miss = held.filter(x => !x.h.held);
    const missNames = new Set(miss.map(x => x.s.name));
    const missLines = [];
    [true, false].forEach(empty => {
        const names = miss.filter(x => !!x.h.empty === empty).map(x => x.s.name);
        if (!names.length) return;
        const who = sp.length === 1 ? '이번에는' : names.join('·') + houseJosa(names.join('·'), '은', '는');
        missLines.push(empty ? `${sp.length === 1 ? '' : who + ' '}벽·바닥 색과 맞는 또렷한 색 원단이 지금 책자에 없어, ${sp.length === 1 ? '이번에는 ' : ''}차분한 색으로 골랐습니다.`
            : `${who} 또렷한 포인트 색 대신 차분한 색으로 골랐습니다.`);
    });
    const out = [];
    const houseMissed = ht.pres === 'point' && held.length > 0 && miss.length === held.length;      // 포인트 공간이 모두 포인트 색 없이 끝남
    if (houseWord && !houseMissed) out.push(`${houseWord} 집이 되도록, 고르신 느낌에 맞춰 원단을 골랐습니다.`);
    const groups = [];
    sp.forEach(s => {
        const r = s.raw || {};
        if (!r.ownTaste || missNames.has(s.name)) return;
        if (!s.fabs.some(f => f.k !== '속지')) return;      // 197번: 속지만 공간은 느낌을 묻지 않음 — 분위기 묶음에서 뺌
        const w = houseMoodWord(r.ownPres || ht.pres, r.ownTex || ht.tex, drapeOf(s));
        if (!w || w === houseWord) return;
        const g = groups.find(x => x.w === w);
        if (g) g.names.push(s.name); else groups.push({ w, names: [s.name] });
    });
    // 123번: 취향을 공간마다 물으면 집 취향 말이 없음 → 모든 공간이 같은 말이면 집 한 문장, 다르면 공간끼리 묶어 한 문장씩
    const tasteN = sp.filter(s => s.fabs.some(f => f.k !== '속지')).length;      // 197번: 속지만 공간은 셈에서 뺌
    if (!houseWord && groups.length === 1 && groups[0].names.length === tasteN) {
        out.push(`${groups[0].w} 집이 되도록, 고르신 느낌에 맞춰 원단을 골랐습니다.`);
        return out.concat(missLines);
    }
    groups.forEach(g => {
        const names = g.names.join('·');
        out.push(`${names}${houseJosa(names, '은', '는')} ${g.w} 느낌으로 ${houseWord ? '따로 ' : ''}맞췄습니다.`);
    });
    return out.concat(missLines);
}
// 총평 (37-4): ① 흐름(한 문장) → ② 속지(속지 공간 2곳 이상일 때) → ③ 가구(집 전체 가구 중 가장 진한·밝은 것, 없으면 첫 가구, 진단 말투 65번·66번) · 최대 3문장
//  118번: 맨 앞에 분위기 문장(취향 답이 있을 때만)을 더함 — 제안서에 한 번만
function houseBrief(sp) {
    const out = [], S = sp.filter(houseRep), reps = S.map(s => houseRep(s).lab);
    const maxDist = list => { let m = 0; list.forEach((p, i) => list.forEach((q, j) => { if (j > i) m = Math.max(m, whyDE(p, q)); })); return m; };
    const avg = (list, k) => list.reduce((t, c) => t + c[k], 0) / list.length;
    // ① 흐름 (비교할 공간이 2곳 이상일 때)
    if (S.length >= 2) {
        const maxD = maxDist(reps);
        if (maxD <= HOUSE_UNIFY) {
            const L = avg(reps, 'L'), b = avg(reps, 'b');
            const fam = (L >= 80 ? '밝은 ' : (L >= 60 ? '부드러운 ' : '깊은 ')) + (b >= 12 ? '베이지' : (b >= 5 ? '아이보리·그레이지' : '그레이'));
            out.push(`집 전체를 ${fam} 계열로 맞춰, 공간을 옮겨 다녀도 흐름이 끊기지 않습니다.`);
        } else {
            let point = null;
            if (S.length >= 3) S.forEach((s, i) => {
                const rest = reps.filter((_, j) => j !== i);
                if (!point && maxDist(rest) <= HOUSE_UNIFY && Math.min(...rest.map(q => whyDE(reps[i], q))) > HOUSE_UNIFY) point = { s, i, rest };
            });
            if (point) {
                const o = reps[point.i], dL = o.L - avg(point.rest, 'L'), db = o.b - avg(point.rest, 'b');
                const dir = Math.abs(dL) >= Math.abs(db) * 1.2 ? (dL > 0 ? '한 톤 밝게' : '한 톤 진하게') : (db > 0 ? '조금 따뜻하게' : '조금 차분하게');
                const names = S.filter((_, j) => j !== point.i).map(s => s.name).join('·');
                out.push(`${names}${houseJosa(names, '은', '는')} 같은 계열로 잇고, ${point.s.name}만 ${dir} 두어 분위기를 달리했습니다.`); // 41번 · 83번
            } else if (S.length === 2) {
                out.push(`${S[0].name}${houseJosa(S[0].name, '과', '와')} ${S[1].name}${houseJosa(S[1].name, '은', '는')} 각자의 빛과 바탕색에 맞춰 따로 골랐습니다.`); // 41번 · 83번
            } else {
                out.push('공간마다 빛과 바탕색이 달라, 각각에 맞춰 골랐습니다.'); // 41번 · 83번
            }
        }
    }
    // ② 속지
    const withSheer = sp.filter(s => s.fabs.some(f => f.k === '속지' && f.lab));
    const sh = withSheer.map(s => s.fabs.find(f => f.k === '속지' && f.lab));
    if (sh.length >= 2) {
        if (sh.every(f => f.fabricId === sh[0].fabricId && f.colorName === sh[0].colorName)) {
            const who = withSheer.length === sp.length ? '모든 공간을' : withSheer.map(s => s.name).join('·') + ' 모두';
            out.push(`속지는 ${who} 같은 색으로 맞춰, 밖에서 보면 창이 한결같아 보입니다.`);
        } else if (maxDist(sh.map(f => f.lab)) <= HOUSE_SHEER_SAME) {
            out.push('속지는 비슷한 밝기로 맞춰, 밖에서 봐도 창이 고르게 보입니다.');
        }
    }
    // ③ 가구 (65번: 진단 말투 — 커튼을 어떻게 골랐는지는 2번 몫이라 안 씀)
    //  66번: 가구가 여러 개여도 한 문장. 집에서 가장 진한 가구 → 가장 밝은 가구 → 없으면 첫 공간의 첫 가구(그대로 두는 가구가 앞)
    const furs = [];
    sp.forEach(s => s.fur.forEach(f => furs.push({ s, f })));
    if (furs.length) {
        const othersOf = f => {
            const o = [];
            sp.forEach(s => { if (s.wall) o.push(s.wall); if (s.floor) o.push(s.floor); s.fur.forEach(x => { if (x !== f) o.push(x); }); });
            return o;
        };
        const darkest = furs.find(({ f }) => { const o = othersOf(f); return o.length && o.every(x => f.L < x.L); });
        const lightest = darkest ? null : furs.find(({ f }) => { const o = othersOf(f); return o.length && o.every(x => f.L > x.L); });
        const { s: fs, f } = darkest || lightest || furs[0];
        const nm = f.name ? f.name + ' ' : '', is = houseJosa(fs.name, '은', '는'), ga = houseJosa(f.n, '이', '가');
        const base = [fs.wall, fs.floor].filter(Boolean);
        if (darkest) out.push(`${fs.name}의 ${nm}${f.n}${ga} 집에서 가장 진한 색입니다.`);
        else if (lightest) out.push(`${fs.name}의 ${nm}${f.n}${ga} 집에서 가장 밝은 색입니다.`);
        else if (base.length && Math.min(...base.map(o => whyDE(f, o))) <= HOUSE_FUR_NEAR) out.push(`${fs.name}의 ${f.n}${houseJosa(f.n, '은', '는')} 벽·바닥과 비슷한 색이라, 공간이 한 톤으로 이어집니다.`);
        else out.push(`${fs.name}의 ${nm}${f.n}${houseJosa(f.n, '은', '는')} 바탕색 사이에서 또렷하게 보입니다.`);
    }
    return houseMoodLines(sp).concat(out.slice(0, 3));      // 118번
}
// 색 지도 (132번, 시안 131_최종제안_흐름_시안_v2 2장): '분석 화면의 말'을 '도록의 말'로
//  점·범례 대신 실제 색 조각 — 원단은 세로로 긴 조각(28×40), 벽·바닥은 네모(28×28). 모양이 범례를 대신해 범례는 없음. 가구는 넣지 않음
//  격자는 가운데 십자 두 줄만 초세선, 축 말은 네 끝에 15px. 공간마다 벽 → 바닥을 잇는 선 하나(두 번째 공간부터 점선)
//  이름표는 명조 17 이름 + 고딕 15 색 이름(muted), 조각·다른 이름표와 겹치지 않는 자리로. 900×520 좌표, ctx는 미리 옮기고 늘려 둠
const HOUSE_MAP_W = 900, HOUSE_MAP_H = 520;
const HOUSE_LINE_NEAR = 7;       // 원단이 벽–바닥 선에서 이 안(밝기·따뜻함 칸 거리)이면 "선 가까이"
const HOUSE_MAP_LEAD = '선은 공간마다 벽 색과 바닥 색을 이어, 두 색의 관계를 보여 줍니다. 커튼이 선 가까이 있으면 벽과 바닥을 자연스럽게 잇고, 선에서 멀어지면 무게나 포인트가 됩니다.';      // 148번
//  o.sel (141번): 고른 공간 번호 — 그 공간만 조각·선이 진하고 이름표(품목 + 색 이름), 나머지는 흐리게(18%) 자리만. 누를 자리 [{x1,y1,x2,y2,room}]를 돌려줌
//  o: { W, H, nf, cf } — 저장 이미지는 지도를 줄이지 않고 종이 글자(75번 F4)로 그림. 없으면 화면 크기(900×520 · 17 · 15)
function drawHouseMap(ctx, sp, bg, o) {
    o = o || {};
    const W = o.W || HOUSE_MAP_W, H = o.H || HOUSE_MAP_H, P = { l: 112, r: 112, t: 58, b: 58 };
    const SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
    const SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    const INK = '#2b221a', MUTED = '#6f5f4f', PAPER = bg || '#fffdf9';
    const NF = o.nf || 17, CF = o.cf || 15, AF = o.cf || 15;
    // 표시할 조각: 벽·바닥(같은 색이면 공간을 넘어 하나) · 원단(같은 원단·같은 색이면 하나, "거실·안방 속지")
    const marks = [], seen = {};
    sp.forEach((s, si) => {
        [['벽', s.wall], ['바닥', s.floor]].forEach(([k, c]) => {
            if (!c) return;
            const key = k + c.hex;
            if (seen[key]) { seen[key].who.push(s.name); seen[key].rooms.push(si); return; }
            marks.push(seen[key] = { t: 's', c, k, cn: c.name || '', who: [s.name], rooms: [si] });
        });
        s.fabs.forEach(f => {
            if (!f.lab) return;
            const key = 'f' + f.k + f.fabricId + '|' + f.colorName;
            if (seen[key]) { if (!seen[key].who.includes(s.name)) { seen[key].who.push(s.name); seen[key].rooms.push(si); } return; }
            marks.push(seen[key] = { t: 'c', c: Object.assign({ hex: f.hex }, f.lab), k: f.k, cn: f.cn || '', who: [s.name], rooms: [si] });
        });
    });
    // 190번: 4막 "왜 이 셋인가요" — o.seats(그 공간 겉지의 세 자리)를 원단 조각처럼 그리고 이름표는 색 이름. 최종 제안은 o.seats가 없어 그대로
    (o.seats || []).forEach((x, i) => marks.push({ t: 'c', c: { hex: x.hex, L: x.L, a: x.a, b: x.b }, k: x.name, cn: '', who: [], rooms: [0], seat: i }));
    if (!marks.length) return [];
    const SEL = typeof o.sel === 'number' ? o.sel : null;      // 141번
    const act = m => SEL === null || m.rooms.includes(SEL);
    // 190번: 흐린 점(o.dots)도 눈금에 넣음 — 세 자리와 벽·바닥만으로 잡으면 작은 차이가 크게 벌어져 보임
    const Ls = marks.map(m => m.c.L).concat((o.dots || []).map(d => d.L)), bs = marks.map(m => m.c.b).concat((o.dots || []).map(d => d.b));
    let Lmin = Math.min(...Ls) - 3, Lmax = Math.max(...Ls) + 3, bmin = Math.min(...bs) - 3, bmax = Math.max(...bs) + 3;
    // 색이 몇 개 안 되거나 서로 가까우면 조금 벌어진 것도 크게 보이므로 눈금 폭을 조금은 남김
    if (Lmax - Lmin < 24) { const m = (Lmax + Lmin) / 2; Lmin = m - 12; Lmax = m + 12; }
    if (bmax - bmin < 14) { const m = (bmax + bmin) / 2; bmin = m - 7; bmax = m + 7; }
    const X = b => P.l + (b - bmin) / (bmax - bmin) * (W - P.l - P.r), Y = L => P.t + (Lmax - L) / (Lmax - Lmin) * (H - P.t - P.b);
    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    // 가운데 십자 두 줄 (초세선) + 네 끝의 축 말
    ctx.strokeStyle = 'rgba(43,34,26,0.18)'; ctx.lineWidth = 0.5; ctx.setLineDash([]);
    line(P.l - 20, H / 2, W - P.r + 20, H / 2); line(W / 2, P.t - 22, W / 2, H - P.b + 22);
    ctx.font = `400 ${AF}px ${SANS}`; ctx.fillStyle = MUTED;
    ctx.textAlign = 'center'; ctx.fillText('밝은 색', W / 2, AF); ctx.fillText('짙은 색', W / 2, H - 4);
    ctx.textAlign = 'left'; ctx.fillText('차가운 색', 0, H / 2 + 5);
    ctx.textAlign = 'right'; ctx.fillText('따뜻한 색', W, H / 2 + 5);
    const aw = s => ctx.measureText(s).width;
    const axisBoxes = [
        { x1: W / 2 - aw('밝은 색') / 2, y1: 0, x2: W / 2 + aw('밝은 색') / 2, y2: AF + 4 },
        { x1: W / 2 - aw('짙은 색') / 2, y1: H - 4 - AF, x2: W / 2 + aw('짙은 색') / 2, y2: H },
        { x1: 0, y1: H / 2 - AF + 2, x2: aw('차가운 색'), y2: H / 2 + 8 },
        { x1: W - aw('따뜻한 색'), y1: H / 2 - AF + 2, x2: W, y2: H / 2 + 8 }
    ];
    // 자리 + 겹친 조각 밀기
    const pts = marks.map(m => ({ m, x: X(m.c.b), y: Y(m.c.L), hw: 14, hh: m.t === 'c' ? 20 : 14 }));
    for (let k = 0; k < 80; k++) for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], c = pts[j], dx = c.x - a.x, dy = c.y - a.y;
        const ox = a.hw + c.hw + 8 - Math.abs(dx), oy = a.hh + c.hh + 8 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy) { const s = (dx >= 0 ? 1 : -1) * ox / 2; a.x -= s; c.x += s; }
        else { const s = (dy >= 0 ? 1 : -1) * oy / 2; a.y -= s; c.y += s; }
    }
    pts.forEach(p => { p.x = Math.max(P.l - 24, Math.min(W - P.r + 24, p.x)); p.y = Math.max(P.t, Math.min(H - P.b, p.y)); });
    // 공간마다 벽 → 바닥을 잇는 선 (첫 공간은 실선, 다음 공간부터 점선)
    ctx.strokeStyle = '#b7a48d'; ctx.lineWidth = 1;
    let nLine = 0;
    sp.forEach((s, si) => {
        const w = pts.find(p => p.m.t === 's' && p.m.k === '벽' && p.m.rooms.includes(si));
        const f = pts.find(p => p.m.t === 's' && p.m.k === '바닥' && p.m.rooms.includes(si));
        if (!w || !f) return;
        const on = SEL === null || SEL === si;      // 141번: 고른 공간 선은 조금 짙고 굵게, 나머지는 흐리게
        ctx.setLineDash(SEL === null && nLine ? [4, 4] : []);
        ctx.globalAlpha = on ? 1 : 0.18;
        ctx.strokeStyle = SEL !== null && on ? '#8c7a66' : '#b7a48d'; ctx.lineWidth = SEL !== null && on ? 1.5 : 1;
        line(w.x, w.y, f.x, f.y);
        ctx.globalAlpha = 1;
        nLine++;
    });
    ctx.setLineDash([]);
    // 190번: o.dots(나머지 원단 색)는 흐린 점, 조각보다 아래
    (o.dots || []).forEach(d => {
        if (d.L < Lmin || d.L > Lmax || d.b < bmin || d.b > bmax) return;
        ctx.globalAlpha = 0.35; ctx.fillStyle = d.hex;
        ctx.beginPath(); ctx.arc(X(d.b), Y(d.L), 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 색 조각 (벽·바닥 네모 먼저, 원단 긴 조각은 위에)
    const chip = p => {
        const w = p.hw * 2, h = p.hh * 2, x = p.x - p.hw, y = p.y - p.hh;
        ctx.fillStyle = p.m.c.hex; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(43,34,26,0.22)'; ctx.lineWidth = 0.5; ctx.strokeRect(x + 0.25, y + 0.25, w - 0.5, h - 0.5);
    };
    ctx.globalAlpha = 0.18; pts.filter(p => !act(p.m)).forEach(chip); ctx.globalAlpha = 1;      // 141번: 흐린 공간 먼저, 고른 공간은 위에
    pts.filter(p => act(p.m) && p.m.t !== 'c').forEach(chip);
    pts.filter(p => act(p.m) && p.m.t === 'c').forEach(chip);
    // 이름표: 오른쪽 → 왼쪽 → 위 → 아래 → 비스듬히 중 조각·다른 이름표와 안 겹치는 자리 (원단 이름표 먼저)
    const boxes = pts.map(p => ({ x1: p.x - p.hw, y1: p.y - p.hh, x2: p.x + p.hw, y2: p.y + p.hh })).concat(axisBoxes);
    const over = q => boxes.reduce((a, o) => a + Math.max(0, Math.min(q.x2 + 6, o.x2) - Math.max(q.x1 - 6, o.x1)) * Math.max(0, Math.min(q.y2 + 4, o.y2) - Math.max(q.y1 - 4, o.y1)), 0)
        + ((q.x1 < 2 || q.x2 > W - 2 || q.y1 < 0 || q.y2 > H) ? 1e6 : 0);
    const put = p => {
        const name = SEL !== null ? p.m.k : (p.m.t === 's' && p.m.who.length === sp.length && sp.length > 1) ? p.m.k : p.m.who.join('·') + ' ' + p.m.k;
        ctx.font = `400 ${NF}px ${SERIF}`; const wN = ctx.measureText(name).width;
        ctx.font = `400 ${CF}px ${SANS}`; const wC = p.m.cn ? ctx.measureText(p.m.cn).width + 6 : 0;
        const tw = wN + wC, g = 10, mid = p.y + NF * 0.35;
        const cands = [
            [p.x + p.hw + g, mid, 'left'], [p.x - p.hw - g, mid, 'right'],
            [p.x, p.y - p.hh - 8, 'center'], [p.x, p.y + p.hh + 6 + NF, 'center'],
            [p.x + p.hw + g, p.y - p.hh + 4, 'left'], [p.x + p.hw + g, p.y + p.hh + 8, 'left'],
            [p.x - p.hw - g, p.y - p.hh + 4, 'right'], [p.x - p.hw - g, p.y + p.hh + 8, 'right']
        ];
        let pick = null, best = null, bestQ = null;
        for (const cd of cands) {
            const x1 = cd[2] === 'left' ? cd[0] : (cd[2] === 'right' ? cd[0] - tw : cd[0] - tw / 2);
            const q = { x1, y1: cd[1] - NF, x2: x1 + tw, y2: cd[1] + 4 };
            const v = over(q);
            if (best === null || v < best) { best = v; pick = cd; bestQ = q; }
            if (v === 0) break;
        }
        boxes.push(bestQ);
        ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = PAPER;
        ctx.font = `400 ${NF}px ${SERIF}`; ctx.strokeText(name, bestQ.x1, pick[1]); ctx.fillStyle = INK; ctx.fillText(name, bestQ.x1, pick[1]);
        if (p.m.cn) { ctx.font = `400 ${CF}px ${SANS}`; ctx.strokeText(p.m.cn, bestQ.x1 + wN + 6, pick[1]); ctx.fillStyle = MUTED; ctx.fillText(p.m.cn, bestQ.x1 + wN + 6, pick[1]); }
    };
    pts.filter(p => act(p.m) && p.m.t === 'c').forEach(put);
    pts.filter(p => act(p.m) && p.m.t !== 'c').forEach(put);
    return pts.map(p => ({ x1: p.x - p.hw - 4, y1: p.y - p.hh - 4, x2: p.x + p.hw + 4, y2: p.y + p.hh + 4, room: p.m.rooms.includes(SEL) ? SEL : p.m.rooms[0], seat: p.m.seat }));      // 190번: seat = 세 자리 조각이면 자리 번호
}
// 공간의 색과 빛 공간별 문장 (132번 → 194번): 품목마다 한 줄 [{ k, text }]. 4막 이유 한 줄(color-pick.js whyLineFor)을 먼저, 못 찾으면 벽–바닥 선 계산 문장(예전 말, 주어 없이)
//  벽·바닥을 둘 다 잰 공간만. [{ name, parts: [{ k, text }], text }]
function houseRoomLines(sp) {
    const out = [];
    const cp = window.conciergeCore && window.conciergeCore.colorPick;
    sp.forEach(s => {
        const w = s.wall, fl = s.floor, fabs = s.fabs.filter(f => f.lab).slice().sort((x, y) => ({ 속지: 0, 겉지: 1 }[x.k] ?? 2) - ({ 속지: 0, 겉지: 1 }[y.k] ?? 2));
        if (!w || !fl || !fabs.length) return;
        const vx = fl.b - w.b, vy = fl.L - w.L, vv = (vx * vx + vy * vy) || 1;
        const pos = fabs.map(f => {
            const t = Math.max(0, Math.min(1, ((f.lab.b - w.b) * vx + (f.lab.L - w.L) * vy) / vv));
            const dL = f.lab.L - (w.L + vy * t), db = f.lab.b - (w.b + vx * t);
            return { f, t, d: Math.hypot(dL, db), dL, db };
        });
        const sayOf = x => {
            const { f, t, d, dL, db } = x;
            if (d <= HOUSE_LINE_NEAR) {
                if (t <= 0.25) return '벽 바로 곁의 색이라, 닫아 두면 창 쪽이 벽과 하나로 보입니다.';
                if (t >= 0.75) return '바닥 가까운 색이라, 닫아 두면 창 쪽이 바닥과 이어져 보입니다.';
                return '벽과 바닥 사이의 색이라, 닫아도 공간이 한 덩어리로 보입니다.';
            }
            if (Math.abs(dL) >= Math.abs(db)) {
                if (dL < 0 && typeof pointVivid === 'function' && pointVivid(f.lab)) return '짙고 색 기운이 또렷한 색이라, 창 쪽의 포인트가 됩니다.';      // 183번: 와인처럼 또렷한 짙은 색은 무게가 아니라 포인트 (차콜과 같은 말이 되지 않게)
                if (dL < 0) return f.lab.L < fl.L ? '선에서 한참 아래, 바닥보다 짙은 색이라 공간에 무게를 잡아 줍니다.' : '선보다 짙은 쪽이라, 공간에 무게를 더합니다.';
                return f.lab.L > w.L ? '벽보다 밝은 색이라, 닫아 두면 창 쪽이 환하게 보입니다.' : '선보다 밝은 쪽이라, 창 쪽이 가볍게 보입니다.';
            }
            if (typeof pointVivid === 'function' && !pointVivid(f.lab)) return `벽과 바닥보다 ${db > 0 ? '따뜻한' : '차가운'} 쪽이지만 색 기운이 적어, 공간을 ${db > 0 ? '포근하게' : '차분하게'} 받쳐 줍니다.`;      // 160번: 회색을 포인트라 하지 않음
            return `벽과 바닥보다 ${db > 0 ? '따뜻한' : '차가운'} 쪽으로 벗어난 색이라, 창 쪽의 포인트가 됩니다.`;
        };
        const parts = pos.map(x => {
            const wLine = cp && cp.whyLineFor ? cp.whyLineFor(s.raw, x.f.k, x.f.fabricId, x.f.colorName) : '';
            return { k: x.f.k, text: wLine || sayOf(x) };
        }).filter(p => p.text);
        if (!parts.length) return;
        out.push({ name: s.name, parts, text: parts.map(p => p.text).join(' ') });
    });
    return out;
}
// 공간의 색과 빛 장 (132번 → 141번 B-4 결정): 저장 이미지·인쇄·카톡 이미지는 사분면 지도 대신 무드보드
//  공간마다 한 줄: 이름(F3 명조) | 색 띠 벽 → 속지 → 겉지 → 바닥(폭 34:22:22:22, 칸 사이 틈, 초세선 테두리) | 띠 아래 문장(F4, 옅게) → 집 전체 총평
//  칸 이름은 맨 위 한 번만. 없는 품목은 칸을 비움(회색으로 채우지 않음). 블라인드만인 공간은 커튼 두 칸 자리를 블라인드 하나가 쓰고 그 줄에만 칸 이름
//  화면(지도, 한 공간씩 진하게)과 순서만 같고 모양은 다름 — 80번 원칙의 의도한 예외(141번)
const HOUSE_MB_COLS = [['벽', 34], ['속지', 22], ['겉지', 22], ['바닥', 22]];
const HOUSE_MEASURED_NOTE = '벽·바닥 색은 상담 때 회색 카드와 함께 잰 값입니다.';      // 194번(E): 잰 값 한 줄 — 화면(final.js)과 종이가 같이 씀
function houseMoodParts(s) {
    const okHex = h => /^#[0-9a-f]{6}$/i.test(h || '');
    const fab = k => { const f = s.fabs.find(x => x.k === k && okHex(x.hex)); return f ? f.hex : null; };
    const wall = s.wall ? s.wall.hex : null, floor = s.floor ? s.floor.hex : null;
    const hasCurtain = s.fabs.some(x => x.k === '속지' || x.k === '겉지');
    if (!hasCurtain && s.fabs.some(x => x.k === '블라인드')) return { odd: true, parts: [[wall, 34, '벽'], [fab('블라인드'), 44, '블라인드'], [floor, 22, '바닥']] };
    return { odd: false, parts: [[wall, 34, '벽'], [fab('속지'), 22, '속지'], [fab('겉지'), 22, '겉지'], [floor, 22, '바닥']] };
}
function planHouse(data) {
    const sp = houseSpacesOf(data), brief = houseBrief(sp), roomLines = houseRoomLines(sp);
    const DARK = '#2b221a', MUTED = '#6f5f4f', LINE = '#e5dcd0';
    const W = PAPER_W, CX = TICKET_PAD, RX = W - TICKET_PAD, CW = RX - CX;
    const fName = `400 ${PAPER_F3}px ${PAPER_SERIF}`, fBody = `400 ${PAPER_F4}px ${PAPER_SANS}`, fBrief = `400 ${PAPER_F4}px ${PAPER_SERIF}`, fKey = `400 ${Math.round(PAPER_F4 * 0.85)}px ${PAPER_SANS}`;
    const LH4 = 34, NAME_W = 150, COL_G = 36, SX = CX + NAME_W + COL_G, SW = RX - SX, SH = 72, GAP = 3;
    const meas = document.createElement('canvas').getContext('2d');
    const wrap = (str, maxW, font) => {
        meas.font = font;
        const lines = []; let cur = '';
        for (const word of String(str).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (meas.measureText(test).width <= maxW || !cur) { cur = test; continue; }
            lines.push(cur); cur = word;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    const cells = parts => {      // 띠 칸 자리 [{x, w, hex, k}]
        const tot = parts.reduce((a, p) => a + p[1], 0), free = SW - GAP * (parts.length - 1);
        let x = SX;
        return parts.map(p => { const w = free * p[1] / tot, o = { x, w, hex: p[0], k: p[2] }; x += w + GAP; return o; });
    };
    let y = TICKET_HEAD_Y + 24;
    const headY = y + PAPER_F4, headCells = cells(HOUSE_MB_COLS.map(c => [null, c[1], c[0]]));
    y = headY + 14;
    const KEY_W = 64;      // 194번: 이름표 폭 (SX: key는 fKey·MUTED, SX + KEY_W: 글은 fBody·MUTED)
    const rows = sp.map(s => {
        const mp = houseMoodParts(s), ln = roomLines.find(r => r.name === s.name);
        const o = { s, odd: mp.odd, cells: cells(mp.parts), stripY: y };
        o.nameY = y + 16 + PAPER_F3;
        let ty = y + SH;
        if (o.odd) { o.keyY = ty + 8 + PAPER_F4 * 0.85; ty = o.keyY; }
        const lines = [];
        if (ln && ln.parts) {
            ln.parts.forEach(p => {
                const sub = wrap(p.text, SW - KEY_W, fBody);
                sub.forEach((t, i) => lines.push({ key: i === 0 ? (p.k || '') : '', t }));
            });
        }
        o.lines = lines;
        o.textY = ty + 14 + PAPER_F4;
        const end = o.lines.length ? o.textY + (o.lines.length - 1) * LH4 : ty;
        y = Math.max(end, o.nameY) + 40;
        return o;
    });
    const bLines = brief.length ? wrap(brief.join(' '), CW, fBrief) : [];
    const briefLineY = y, bY = y + 26 + PAPER_F4;
    if (bLines.length) y = bY + (bLines.length - 1) * LH4 + 10;
    const hasMeasured = sp.some(s => s.wall && s.floor);      // 194번(E): 벽·바닥을 둘 다 잰 공간이 하나라도 있을 때만
    const noteY = hasMeasured ? (bLines.length ? y + 34 : briefLineY + 26 + Math.round(PAPER_F4 * 0.85)) : 0;
    if (hasMeasured) y = noteY + 10;
    const pages = [{ rows: [], y: y + 10 }];
    const draw = (c, pi, label) => {
        const t = drawWhy(c, data, W, false, '공간의 색과 빛');      // 65번
        t.hdr();
        c.textAlign = 'left';
        c.font = fKey; c.fillStyle = MUTED; headCells.forEach(q => c.fillText(q.k, q.x, headY));
        rows.forEach(o => {
            c.font = fName; c.fillStyle = DARK; c.fillText(o.s.name, CX, o.nameY);
            o.cells.forEach(q => {
                if (!q.hex) return;      // 없는 품목·못 잰 색은 비워 둠
                c.fillStyle = q.hex; c.fillRect(q.x, o.stripY, q.w, SH);
                c.strokeStyle = 'rgba(35,28,22,0.14)'; c.lineWidth = PAPER_HL; c.strokeRect(q.x + PAPER_HL / 2, o.stripY + PAPER_HL / 2, q.w - PAPER_HL, SH - PAPER_HL);
            });
            if (o.odd) { c.font = fKey; c.fillStyle = MUTED; o.cells.forEach(q => { if (q.hex) c.fillText(q.k, q.x, o.keyY); }); }
            o.lines.forEach((ln, i) => {
                const py = o.textY + i * LH4;
                if (ln.key) { c.font = fKey; c.fillStyle = MUTED; c.fillText(ln.key, SX, py); }
                c.font = fBody; c.fillStyle = MUTED; c.fillText(ln.t, SX + KEY_W, py);
            });
        });
        if (bLines.length) {
            c.strokeStyle = LINE; c.lineWidth = 0.6; c.beginPath(); c.moveTo(CX, briefLineY); c.lineTo(RX, briefLineY); c.stroke();
            c.font = fBrief; c.fillStyle = DARK; c.textAlign = 'left';
            bLines.forEach((ln, i) => c.fillText(ln, CX, bY + i * LH4));
        }
        if (hasMeasured) {
            c.font = fKey; c.fillStyle = MUTED; c.textAlign = 'left';
            c.fillText(HOUSE_MEASURED_NOTE, CX, noteY);
        }
        label();
    };
    return { fits: true, pages, draw };
}
// 우리 집 색 쪽(들): { count, draw(opts, before, total) → canvas[] }. 생기지 않으면 count 0
function buildHouseCanvases(data, opts) {
    if (!houseShows(data, opts)) return { count: 0, draw: () => [] };
    const plan = planHouse(data);
    return {
        count: plan.pages.length,
        draw(o, total, before) {      // before: 앞에 있는 쪽 수 (표지, 80번)
            const pr = (o && o.pixelRatio) || 1;
            return plan.pages.map((pg, pi) => {
                const H = Math.ceil(pg.y + 90);
                const canvas = document.createElement('canvas');
                canvas.width = TICKET_W * pr; canvas.height = Math.round(H * PAPER_K * pr);
                const ctx = canvas.getContext('2d');
                ctx.scale(PAPER_K * pr, PAPER_K * pr);
                ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, PAPER_W, H);
                ctx.textBaseline = 'alphabetic';
                plan.draw(ctx, pi, () => {
                    if (total < 2) return;
                    ctx.font = `400 ${PAPER_F4}px Pretendard,"Noto Sans KR","Malgun Gothic",sans-serif`; ctx.fillStyle = '#6f5f4f'; ctx.textAlign = 'center';
                    ctx.fillText(`${pi + 1 + (before || 0)} / ${total}`, PAPER_W / 2, H - 30);
                });
                return canvas;
            });
        }
    };
}

// ==============================================================
// 80번: 저장 이미지를 화면 최종 제안(76~79번 도록)과 같은 순서·모양으로
//  조각보 표지 → 공간의 색과 빛 → 공간별 쇼룸 시트 → 견적서(+ 마무리 시)
//  조각보 나눔·쇼룸 시트 내용은 화면과 같은 함수(concierge.jogakbo · showroomRows)를 씀
// ==============================================================
const PAPER_HL = 1 / PAPER_K;      // 화면 0.5px 초세선 = 저장 이미지(폭 1080 → 탭 폭 540)에서 1칸
const PAPER_SERIF = '"Noto Serif KR","Nanum Myeongjo",Batang,serif';
const PAPER_SANS = 'Pretendard,"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
function paperCanvas(H, pr) {
    const canvas = document.createElement('canvas');
    canvas.width = TICKET_W * pr; canvas.height = Math.round(H * PAPER_K * pr);
    const ctx = canvas.getContext('2d');
    ctx.scale(PAPER_K * pr, PAPER_K * pr);
    ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, PAPER_W, H);
    ctx.textBaseline = 'alphabetic';
    return { canvas, ctx };
}
// 211번: 실물 견본(아직 안 고른 원단) 칸 — 화면 HATCH와 같은 빗금(종이색 바탕 + 6px 폭 옅은 줄, 135°)
function paperHatch(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#fffdf9'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#efe7da'; ctx.lineWidth = 6;
    for (let d = -h; d < w + h; d += 12 * Math.SQRT2) { ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d - h, y + h); ctx.stroke(); }
    ctx.restore();
}
// 원단 칸: 사진이 있으면 가운데를 잘라 채우고, 없으면 원단 색. 테두리는 초세선
function paperSwatch(ctx, it, photos, x, y, w, h) {
    if (it && it.sampleBlind) paperHatch(ctx, x, y, w, h);      // 211번
    else { ctx.fillStyle = (it && it.fill) || '#d9cdbb'; ctx.fillRect(x, y, w, h); }
    const ph = it && photos && photos[it.photoKey];
    if (ph) {
        const sw = ph.naturalWidth, sh = ph.naturalHeight, k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k;
        ctx.drawImage(ph, (sw - cw) / 2, (sh - ch) / 2, cw, ch, x, y, w, h);
    }
    ctx.strokeStyle = 'rgba(35,28,22,0.14)'; ctx.lineWidth = PAPER_HL; ctx.strokeRect(x + PAPER_HL / 2, y + PAPER_HL / 2, w - PAPER_HL, h - PAPER_HL);
}
// 142번(B-5): 표지 그림 아래 한 줄 — 품목 낱말은 그 집에 있는 것만
function coverCaptionOf(data) {
    const its = (data && data.rooms || []).flatMap(r => r.items || []);
    const curtain = its.some(it => it.kind !== '블라인드' && !String(it.kind || '').includes('블라인드'));
    const blind = its.some(it => String(it.kind || '').includes('블라인드'));
    const kinds = ['벽', '바닥'].concat(curtain || !blind ? ['커튼'] : [], blind ? ['블라인드'] : []);
    return '공간의 색으로 그린 그림입니다';      // 146번: 실제 면적 비율은 잴 수 없어 '비율' 말을 뺌
}
// [표지] Re.dam 로고 + 16:10 조각보 (화면 .jg-canvas와 같은 나눔, 조각 사이 틈)
function buildCoverCanvas(data, pr) {
    const C = window.concierge;
    if (!C || typeof C.jogakbo !== 'function') return null;
    const jg = C.jogakbo(data);      // 134번: 무작위 칸 + 비율대로 칠한 색 (화면과 같은 칸)
    // 132번 → 142번(B-5): 조각보 → 바로 아래 오른쪽 한 줄(옅게) → "빛을, / 다시 담습니다"(명조) + 오른쪽 아래 로고. 소개 문구는 뺌
    const CX = TICKET_PAD, RX = PAPER_W - TICKET_PAD, CW = RX - CX, TOP = TICKET_PAD, CH = Math.round(CW * 10 / 16), GAP = 4;
    const CAP = TOP + CH + 28 + PAPER_F4;
    const L1 = CAP + 46 + PAPER_F2, L2 = L1 + Math.round(PAPER_F2 * 1.4);
    const H = L2 + TICKET_PAD;
    const { canvas, ctx } = paperCanvas(H, pr);
    ctx.font = `400 ${PAPER_F4}px ${PAPER_SANS}`; ctx.fillStyle = '#6f5f4f'; ctx.textAlign = 'right';
    ctx.fillText(coverCaptionOf(data), RX, CAP);
    ctx.textAlign = 'left'; ctx.fillStyle = '#2b221a';
    ctx.font = `400 ${PAPER_F2}px ${PAPER_SERIF}`;
    ctx.fillText('빛을,', CX, L1); ctx.fillText('다시 담습니다', CX, L2);
    paperLogo(ctx, RX, L2, PAPER_F3, '#2b221a', '#8a4a22');
    const cells = jg ? jg.cells : [{ x: 0, y: 0, w: 16, h: 10, hex: '#efe9df' }];
    cells.forEach(c => {
        const x = CX + c.x / 16 * CW + GAP / 2, y = TOP + c.y / 10 * CH + GAP / 2, w = c.w / 16 * CW - GAP, h = c.h / 10 * CH - GAP;
        ctx.fillStyle = c.hex; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(35,28,22,0.14)'; ctx.lineWidth = PAPER_HL; ctx.strokeRect(x + PAPER_HL / 2, y + PAPER_HL / 2, w - PAPER_HL, h - PAPER_HL);
    });
    return canvas;
}
// [쇼룸 시트] 공간마다: 공간 이름 + 빛의 방향·창의 크기·구성 방식 → 창가 색 띠 → 진단 문장 → 겹침 스와치(겉지 뒤·속지 앞) + 원단별 이유 → 밤 안내
//  종이 폭이 좁아 화면의 좁은 화면 배치(이름·정보 위, 내용 아래)로 그림. 글자는 화면 사다리(PAPER_F2·F3·F4)
function buildShowroomCanvas(data, pr, pageNo, total) {
    const C = window.concierge;
    if (!C || typeof C.showroomRows !== 'function') return null;
    const rows = C.showroomRows(data);
    if (!rows.length) return null;
    const W = PAPER_W, CX = TICKET_PAD, RX = W - TICKET_PAD, CW = RX - CX;
    const DARK = '#231c16', MUTED = '#6f5f4f', SOFT = MUTED;      // 132번: 연한 회색(#9C8F82, 대비 3.1:1) 대신 ink·muted 둘만
    const F4 = PAPER_F4, F3 = PAPER_F3, F2 = PAPER_F2, LH4 = 30, LH3 = 32;
    const STRIP_H = 44, FLOOR_H = 10;
    const BW = 92, BH = 116, OFF = 46;      // 스와치 한 장 · 겹칠 때 앞장이 비켜 앉는 거리 (화면 104×132 / 156×148 비율)
    const meas = document.createElement('canvas').getContext('2d');
    const wrap = (str, maxW, font) => {
        meas.font = font;
        const lines = []; let cur = '';
        for (const word of String(str).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (meas.measureText(test).width <= maxW || !cur) { cur = test; continue; }
            lines.push(cur); cur = word;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    const fSans = `400 ${F4}px ${PAPER_SANS}`, fTitle = `400 ${F3}px ${PAPER_SERIF}`, fName = `400 ${F2}px ${PAPER_SERIF}`;
    // 미리 자리 재기
    const plans = rows.map(r => {
        const meta = r.metaLine ? [r.metaLine] : [];      // 83번: 이름표 없이 값만 한 줄
        let y = 44 + F2;                        // 공간 이름 글줄
        const nameY = y;
        const metaY = meta.length ? (y += 36) : 0;
        const stripY = (y += 12);      // 142번(B-5): 창가 색 띠 뺌 — 들은 말부터 바로
        // 네 칸 단락 ①②③ (83번): 단락마다 새 줄, 단락 사이 조금 띄움
        // 132번: 들은 말은 명조로 가장 먼저 읽히게(화면 22 → F3), 본 것은 muted, 고른 것은 ink
        const cLines = [];
        const parts = r.paraParts || (r.paras || (r.commentTxt ? [r.commentTxt] : [])).map(t => ({ k: 'seen', t }));
        parts.forEach((p, pi) => {
            const heard = p.k === 'heard', font = heard ? fTitle : fSans;
            wrap(p.t, CW, font).forEach((ln, li) => cLines.push({ ln, font, color: p.k === 'seen' ? MUTED : DARK, lh: heard ? 44 : LH4, size: heard ? F3 : F4, gap: pi > 0 && li === 0 }));
        });
        let cy = y + 10;
        cLines.forEach(c => { cy += (c.gap ? 14 : 0) + (c === cLines[0] ? 6 + c.size : c.lh); c.y = cy; });
        const cY = cLines.length ? cLines[0].y : y;
        if (cLines.length) y = cLines[cLines.length - 1].y;
        const layered = !!r.back;
        const swW = layered ? BW + OFF : BW, swH = layered ? BH + 16 : BH;
        const DX = CX + swW + 28, DW = RX - DX;
        const pairY = y + 40;
        let dy = 0;
        const blocks = r.sets.map(s => {
            const hideKind = s.it.kind === '블라인드' && String(s.it.name).includes('블라인드');
            const b = { s, kind: hideKind ? '' : s.it.kind, y0: dy };
            dy += F4;                                                     // 종류 · 색 코드 줄
            b.tLines = wrap(s.it.name, DW, fTitle); b.tY = dy + 10 + F3; dy = b.tY + (b.tLines.length - 1) * LH3;
            b.dLines = (s.lines && s.lines.length) ? wrap(s.lines.join(' '), DW, fSans) : [];
            if (b.dLines.length) { b.dY = dy + 12 + F4; dy = b.dY + (b.dLines.length - 1) * LH4; }
            b.nLines = s.note ? wrap(s.note, DW, fSans) : [];
            if (b.nLines.length) { b.nY = dy + 10 + F4; dy = b.nY + (b.nLines.length - 1) * LH4; }
            dy += 26;
            return b;
        });
        const descH = Math.max(0, dy - 26);
        const descOff = (!layered && descH < swH) ? (swH - descH) / 2 : 0;      // 한 장이면 설명을 스와치 가운데 높이에 (화면 is-single)
        if (r.sets.length) y = pairY + Math.max(swH, descH);
        const nightLines = r.night ? wrap(SHEER_NIGHT_NOTE, CW, fSans) : [];
        const nightY = y + 22 + F4;
        if (nightLines.length) y = nightY + (nightLines.length - 1) * LH4;
        return { r, meta, nameY, metaY, stripY, cLines, cY, layered, swW, swH, DX, pairY, blocks, descOff, nightLines, nightY, h: y + 52 };
    });
    const START = TICKET_HEAD_Y;
    const H = Math.ceil(START + plans.reduce((a, p) => a + p.h, 0) + 70);
    const { canvas, ctx } = paperCanvas(H, pr);
    const t = drawWhy(ctx, data, W, false, '공간 제안');
    t.hdr();
    const text = (s, x, y, color, font, align) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.fillText(s, x, y); };
    const hline = (y, color) => { ctx.strokeStyle = color; ctx.lineWidth = PAPER_HL; ctx.beginPath(); ctx.moveTo(CX, y); ctx.lineTo(RX, y); ctx.stroke(); };
    let top = START;
    plans.forEach((P, i) => {
        const { r } = P;
        if (i > 0) hline(top, '#d5cbbd');
        text(r.name, CX, top + P.nameY, DARK, fName);
        // 공간 정보: 이름표(흐린 글) + 값, 한 줄에 이어 씀
        if (P.meta.length) text(P.meta[0], CX, top + P.metaY, MUTED, fSans);
        P.cLines.forEach(c => text(c.ln, CX, top + c.y, c.color, c.font));
        // 스와치: 겹치면 겉지(뒤, 왼쪽 위) → 속지(앞, 오른쪽 아래, 옅은 그림자) (78번)
        if (r.sets.length) {
            const py = top + P.pairY;
            if (P.layered) {
                paperSwatch(ctx, r.back.it, data.photos, CX, py, BW, BH);
                ctx.save();
                ctx.shadowColor = 'rgba(35,28,22,0.10)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = -4; ctx.shadowOffsetY = -4;
                ctx.fillStyle = '#fffdf9'; ctx.fillRect(CX + OFF, py + 16, BW, BH);
                ctx.restore();
                paperSwatch(ctx, r.front.it, data.photos, CX + OFF, py + 16, BW, BH);
            } else {
                paperSwatch(ctx, r.sets[0].it, data.photos, CX, py, BW, BH);
            }
            const by = py + P.descOff;
            P.blocks.forEach(b => {
                const y0 = by + b.y0;
                let kx = P.DX;
                if (b.kind) text(b.kind, kx, y0 + F4, MUTED, fSans);      // 132번: 색 코드(#EBE8E1 등)는 뺌
                b.tLines.forEach((ln, k) => text(ln, P.DX, by + b.tY + k * LH3, DARK, fTitle));      // tY·dY·nY는 설명 묶음 맨 위 기준
                b.dLines.forEach((ln, k) => text(ln, P.DX, by + b.dY + k * LH4, MUTED, fSans));
                b.nLines.forEach((ln, k) => text(ln, P.DX, by + b.nY + k * LH4, SOFT, fSans));
            });
        }
        P.nightLines.forEach((ln, k) => text(ln, CX, top + P.nightY + k * LH4, SOFT, fSans));
        top += P.h;
    });
    t.pageLabel(pageNo, total, H);
    return canvas;
}
// 로고 "Re.dam"을 오른쪽 끝(rx)에 맞춰 그림: 점만 따로 색 (78번 → 150번 새 글씨 로고)
function paperLogo(ctx, rx, y, size, ink, dot) {
    drawRedamLogo(ctx, rx, y, size, ink, dot, 'right');
}
// ==============================================================
// 〈이 집의 밤〉 (131번, 시안 131_최종제안_흐름_시안_v2.html 5장): 견적서 다음, 맺음 앞. 조명을 사지 않는 손님에게도 나감
//  ① 권하는 색온도 하나(조명연계_정리.md "조명 결정 규칙": 면적 큰 벽·바닥의 따뜻함 → 2700·3000·4000K, 북향 창은 따뜻한 쪽)
//  ② 표지 조각보를 "지금의 방등 아래" / "권하는 빛 아래" 두 장으로 다시 칠함(방 그림 없음)
//  ③ 시간 순서 글 세 칸(해 질 무렵 · 저녁 · 잠들기 전) ④ 제품 카드(구매하실 때 / 맡기실 때)
//  문장은 가족 집 시험 전 임시(11-01 사장님) — 시험 뒤 바꿀 때는 NIGHT_SAY·NIGHT_LAMP만 고침. 화면(final.js)과 저장 이미지가 같이 씀
// ==============================================================
const NIGHT_WARM_B = 8, NIGHT_COOL_B = 3;      // 벽 60% · 바닥 40%로 섞은 따뜻함(Lab b*)이 8 이상이면 따뜻한 바탕, 3 아래면 차가운 바탕 (처음 값)
const NIGHT_SAY = {
    dusk: {
        north: '커튼은 열어 둡니다. 해가 직접 들지 않는 창이라, 이때부터 스탠드나 라인조명을 켜 두시면 낮과 밤의 차이가 줄어듭니다.',
        floor: f => `커튼은 열어 둡니다. ${f} 바닥에 남은 햇빛이 공간의 온기를 먼저 보여 줍니다.`,
        wall: w => `커튼은 열어 둡니다. 해가 지는 동안 ${w} 벽이 천천히 가라앉으며 공간의 차분한 색을 먼저 보여 줍니다.`,
        plain: '커튼은 열어 둡니다. 남은 햇빛이 공간의 색을 먼저 보여 줍니다.'
    },
    evening: {
        drape: '메인 조명을 끄고 스탠드나 라인조명만 켭니다. 커튼 가까이에서 퍼진 빛이 겉지 주름의 질감을 드러냅니다.',      // 147번: 라인조명도 함께
        sheer: '메인 조명을 끄고 스탠드나 라인조명만 켭니다. 은은한 빛이 속지에 부드럽게 번져 창 쪽이 밝아집니다.',
        blind: '메인 조명을 끄고 스탠드나 라인조명만 켭니다. 낮게 퍼진 빛이 공간을 감싸 줍니다.'
    },
    sleep: {
        double: '겉지까지 닫습니다. 속지만 닫아 두면 밖에서 실루엣이 보입니다. 빛은 그대로 두셔도 좋습니다.',
        sheer: '속지만 있는 창은 밤에 안의 그림자가 비칠 수 있습니다. 잠들기 전에는 창 가까운 조명을 꺼 두시면 좋습니다.',
        drape: '겉지를 닫습니다. 빛은 그대로 두셔도 좋습니다.',
        blind: '블라인드를 내립니다. 빛은 그대로 두셔도 좋습니다.'
    }
};
// 136번: 제품 이름(브랜드) 대신 종류로만 적음. 색온도·연색성은 손님이 읽을 수 있게 풀이를 함께
const NIGHT_LAMP = { name: '상향식 플로어스탠드', socket: '일반 전구 소켓(E26)', cri: '연색성 90 이상',
    buy: '"상향식 플로어스탠드"로 찾으시고, 전구는 위 색온도와 연색성으로 고르시면 됩니다', entrust: '시공 당일, 색온도와 연색성에 맞는 전구를 끼운 스탠드를 가져와 커튼 옆 알맞은 자리에 놓아 드립니다',      // 148번
    line: '커튼박스 안이나 천장 가장자리에 숨겨 달아, 끊김 없는 빛으로 커튼 전체를 고르게 비춥니다. 길이를 재어 따로 견적을 드립니다.',      // 146번
    kSay: '빛의 색을 숫자로 나타낸 것입니다. 낮을수록 노랗고 따뜻하게, 높을수록 희고 푸르게 보입니다.',
    criSay: '빛 아래에서 색이 자연광 아래와 얼마나 같게 보이는지를 나타낸 것입니다. 100에 가까울수록 자연광에 가깝습니다. 90 이상이면 커튼과 벽이 낮에 본 색과 거의 같게 보입니다.' };      // 148번: 100 = 자연광 기준
// 빛 아래 색 (그림용 어림): 지금의 방등 = 흔한 주광색 LED(푸르고 납작하게) · 권하는 빛 = 그 색온도의 빛 색을 절반만 섞음
const NIGHT_CEIL = { tint: [0.93, 0.96, 1], sat: 0.75, gain: 0.9 };
function nightKelvinRgb(K) {      // 색온도 → 빛 색 (0~1, 흑체 어림식)
    const t = K / 100, c = v => Math.max(0, Math.min(255, v)) / 255;
    const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
    const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    const b = t >= 66 ? 255 : (t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307);
    return [c(r), c(g), c(b)];
}
function nightLitHex(hex, o) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const y = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return '#' + rgb.map((v, i) => {
        const x = (y + (v - y) * o.sat) * o.tint[i] * o.gain;
        return Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0');
    }).join('');
}
function nightLampOpt(K) {
    const t = nightKelvinRgb(K), mx = Math.max(...t), MIX = 0.5;
    return { tint: t.map(v => 1 - MIX + MIX * v / mx), sat: 1, gain: 0.96 };
}
// 이 집의 대표 창: 창이 가장 큰 공간 (원단을 담은 공간 중)
function nightMainOf(sp) {
    const areaOf = s => ((s.raw && s.raw.curtains) || []).reduce((a, c) => Math.max(a, (Number(c.width) || 0) * (Number(c.height) || 0)), 0);
    return sp.slice().sort((x, y) => areaOf(y) - areaOf(x))[0] || null;
}
// 권하는 색온도: { k, tone: 'warm'|'neutral'|'cool'|'' }
function nightKelvinOf(sp, main) {
    let w = 0, n = 0;
    sp.forEach(s => { if (s.wall) { w += s.wall.b * 0.6; n += 0.6; } if (s.floor) { w += s.floor.b * 0.4; n += 0.4; } });
    if (!n) sp.forEach(s => s.fabs.forEach(f => { if (f.lab) { w += f.lab.b; n += 1; } }));      // 잰 벽·바닥이 없으면 원단 색으로
    if (!n) return { k: 3000, tone: '' };
    const b = w / n, tone = b >= NIGHT_WARM_B ? 'warm' : (b < NIGHT_COOL_B ? 'cool' : 'neutral');
    const dirs = (main && typeof windowDirOf === 'function') ? windowDirOf(main.raw && main.raw.windowDir) : [];
    const north = dirs.includes('N') && !dirs.includes('S');
    return { k: tone === 'cool' ? 4000 : (tone === 'warm' && north ? 2700 : 3000), tone };
}
function houseNightOf(data, opts) {
    if (opts && opts.noCard) return null;
    const C = window.concierge;
    const sp = houseSpacesOf(data);
    if (!sp.length || !C || typeof C.jogakbo !== 'function') return null;
    const jg = C.jogakbo(data);
    if (!jg || !jg.cells || !jg.cells.length) return null;
    const main = nightMainOf(sp), { k, tone } = nightKelvinOf(sp, main);
    const kinds = main.fabs.map(f => f.k);
    const comp = kinds.includes('겉지') && kinds.includes('속지') ? 'double' : (kinds.includes('겉지') ? 'drape' : (kinds.includes('속지') ? 'sheer' : 'blind'));
    const dirs = typeof windowDirOf === 'function' ? windowDirOf(main.raw && main.raw.windowDir) : [];
    const S = NIGHT_SAY;
    const dusk = (dirs.includes('N') && !dirs.includes('S')) ? S.dusk.north
        : (main.floor && main.floor.name && main.floor.b >= NIGHT_WARM_B) ? S.dusk.floor(main.floor.name)
        : (main.wall && main.wall.name) ? S.dusk.wall(main.wall.name) : S.dusk.plain;
    const lamp = nightLampOpt(k);
    return {
        k, tone, room: main.name,
        before: jg.cells.map(c => Object.assign({}, c, { hex: nightLitHex(c.hex, NIGHT_CEIL) })),
        after: jg.cells.map(c => Object.assign({}, c, { hex: nightLitHex(c.hex, lamp) })),
        caps: ['지금 조명에 비친 원단', `${k}K 빛에 비친 원단`],      // 146번
        times: [
            { t: '해 질 무렵', p: dusk },
            { t: '저녁', p: S.evening[comp === 'double' ? 'drape' : comp] },
            { t: '잠들기 전', p: S.sleep[comp] }
        ],
        lamp: { title: NIGHT_LAMP.name, spec: [NIGHT_LAMP.socket, `${k}K`, NIGHT_LAMP.cri], kTxt: `${k}K`,
            rows: [['색온도', NIGHT_LAMP.kSay], ['연색성', NIGHT_LAMP.criSay], ['구매하실 때', NIGHT_LAMP.buy], ['맡기실 때', NIGHT_LAMP.entrust]],
            alt: { title: '라인조명(COB)', spec: [`${k}K`, NIGHT_LAMP.cri], kTxt: `${k}K`, say: NIGHT_LAMP.line } }      // 146번: 스탠드 옆 한 자리      // 136번: 화면·저장 이미지·카톡 글이 같은 줄
    };
}
// 견적서 빛 묶음 (131번): 공간 묶음과 같은 모양 { name, total, items } — 직원 화면에서 "견적서에 넣기"를 고르고 설정에 금액이 있을 때만
function ticketLightOf(data) {
    const L = (typeof lightStandOf === 'function') ? lightStandOf() : null;
    if (!L || !L.on) return null;
    const sp = houseSpacesOf(data), { k } = nightKelvinOf(sp, nightMainOf(sp));
    const items = [
        { kind: '스탠드', name: NIGHT_LAMP.name, bookName: NIGHT_LAMP.name, meta: `${k}K 전구 포함`, size: '', price: L.price, fill: '#f3cf9c' },      // 136번: 브랜드 이름 안 씀
        { kind: '', name: '구매·설치 대행', bookName: '구매·설치 대행', meta: '', size: '', price: L.fee, fill: '#f4efe7' },
        { kind: '라인조명', name: '라인조명(COB)', bookName: '라인조명(COB)', meta: `${k}K · 설치 포함`, size: '', price: L.linePrice + L.lineFee, fill: '#f3cf9c' }      // 146번: 한 줄로
    ].filter(it => it.price > 0).map(it => Object.assign({ sampleOnly: false, photoKey: '', fabricId: '', colorName: '', opts: [] }, it));
    return { name: '빛', total: L.total, sampleOnly: false, items, k, isLight: true };
}
// [이 집의 밤] 저장 이미지 한 장 (어두운 바탕: #2B221A · 글씨 #EFE6DA · 흐린 글 #C4B6A3 · 색온도 #FFC489)
function buildNightCanvas(data, pr, N) {
    if (!N) return null;
    const CX = TICKET_PAD, RX = PAPER_W - TICKET_PAD, CW = RX - CX;
    const ON = '#efe6da', MUTE = '#c4b6a3', KC = '#ffc489', LINE = 'rgba(239,230,218,0.2)';
    const F1 = PAPER_F1, F2 = PAPER_F2, F3 = PAPER_F3, F4 = PAPER_F4;
    const fT = `400 ${F2}px ${PAPER_SERIF}`, fK = `400 ${F1}px ${PAPER_SERIF}`, fP = `400 ${F3}px ${PAPER_SERIF}`, fS = `400 ${F4}px ${PAPER_SANS}`;
    const meas = document.createElement('canvas').getContext('2d');
    const wrap = (str, maxW, font) => {
        meas.font = font;
        const lines = []; let cur = '';
        for (const word of String(str).split(' ')) {
            const test = cur ? cur + ' ' + word : word;
            if (meas.measureText(test).width <= maxW || !cur) { cur = test; continue; }
            lines.push(cur); cur = word;
        }
        if (cur) lines.push(cur);
        return lines;
    };
    const GAP = 20, QW = (CW - GAP) / 2, QH = Math.round(QW * 10 / 16), LHP = Math.round(F3 * 1.8), LHS = Math.round(F4 * 1.65);
    // 자리 재기: 제목·색온도 → 조각보 두 장 + 아래 이름 → 시간 순서 세 칸 → 제품 카드 → 구매하실 때 / 맡기실 때
    let y = TICKET_PAD + F1;
    const headY = y;
    const qY = (y += 36);
    y += QH;
    const capY = (y += 14 + F4);
    const times = N.times.map(t => ({ t: t.t, lines: wrap(t.p, CW, fP) }));
    y += 30;
    times.forEach(t => { t.lineY = y; t.tY = y + 30 + F2; t.pY = t.tY + 14 + F3; y = t.pY + (t.lines.length - 1) * LHP + 30; });
    const baseY = y + 6;
    const IS = PAPER_F3 / 17, IW = Math.round(58 * IS);      // 136번: 스탠드 그림 자리(화면 44 + 간격 14를 글자 비율만큼 키움)
    const titleLines = wrap(N.lamp.title, CW - IW, fP);
    const cardY = baseY + 30 + F3;
    const specY = cardY + (titleLines.length - 1) * LHP + 12 + F4;
    const DLX = CX + 150, rows = N.lamp.rows.map(r => [r[0], wrap(r[1], RX - DLX, fS)]);      // 136번: 색온도 · 연색성 · 구매하실 때 · 맡기실 때
    // 146번: 라인조명 카드 (스탠드 카드 아래 한 자리, 그림 + 이름 + 사양 + 한 줄)
    const A = N.lamp.alt, aTop = Math.max(specY + 28, baseY + 30 + 64 * IS + 20);
    const aTitleY = aTop + F3, aSpecY = aTitleY + 12 + F4;
    const aSay = A ? wrap(A.say, CW - IW, fS) : [];
    const aEnd = A ? Math.max(aSpecY + 10 + aSay.length * LHS, aTop + 64 * IS) : specY;
    let ry = A ? aEnd + 30 + F4 : Math.max(specY + 30 + F4, baseY + 30 + 64 * IS + 24 + F4);      // 136번: 스탠드 그림 아래로 띄움
    rows.forEach(r => { r.y = ry; ry += r[1].length * LHS + 8; });
    const H = Math.ceil(ry - 8 + TICKET_PAD);
    const { canvas, ctx } = paperCanvas(H, pr);
    ctx.fillStyle = '#2b221a'; ctx.fillRect(0, 0, PAPER_W, H);
    const text = (s, x, yy, color, font, align) => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.fillText(s, x, yy); };
    const hline = yy => { ctx.strokeStyle = LINE; ctx.lineWidth = PAPER_HL; ctx.beginPath(); ctx.moveTo(CX, yy); ctx.lineTo(RX, yy); ctx.stroke(); };
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    text('공간의 밤', CX, headY, MUTE, fT);      // 146번: '이 집' 대신 '공간'
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    [N.before, N.after].forEach((cells, i) => {
        const x0 = CX + i * (QW + GAP), G = 3;
        cells.forEach(c => { ctx.fillStyle = c.hex; ctx.fillRect(x0 + c.x / 16 * QW + G / 2, qY + c.y / 10 * QH + G / 2, c.w / 16 * QW - G, c.h / 10 * QH - G); });
        text(N.caps[i], x0, capY, MUTE, fS);
    });
    times.forEach((t, i) => {
        if (i > 0) hline(t.lineY);
        text(t.t, CX, t.tY, ON, fT);
        t.lines.forEach((ln, k) => text(ln, CX, t.pY + k * LHP, ON, fP));
    });
    hline(baseY);
    // 스탠드 그림 (화면 카드와 같은 선, 44×64)
    ctx.save(); ctx.translate(CX, baseY + 30); ctx.scale(IS, IS); ctx.lineWidth = 1.2; ctx.strokeStyle = ON;
    ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(32, 10); ctx.lineTo(27, 18); ctx.lineTo(17, 18); ctx.closePath();
    ctx.moveTo(22, 18); ctx.lineTo(22, 60); ctx.moveTo(15, 60); ctx.lineTo(29, 60); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#e9a868'; ctx.beginPath(); ctx.moveTo(14, 6); ctx.lineTo(22, 1); ctx.lineTo(30, 6); ctx.stroke();
    ctx.restore();
    titleLines.forEach((ln, k) => text(ln, CX + IW, cardY + k * LHP, ON, fP));
    // 사양 줄: 색온도만 따뜻한 색
    ctx.font = fS; ctx.textAlign = 'left';
    let sx = CX + IW;
    N.lamp.spec.forEach((part, k) => {
        const seg = k ? ' · ' : '';
        if (seg) { ctx.fillStyle = MUTE; ctx.fillText(seg, sx, specY); sx += ctx.measureText(seg).width; }
        ctx.fillStyle = part === N.lamp.kTxt ? KC : MUTE; ctx.fillText(part, sx, specY); sx += ctx.measureText(part).width;
    });
    if (A) {      // 146번: 라인조명 그림 (커튼박스 + 숨은 줄 빛 + 아래로 퍼지는 빛)
        ctx.save(); ctx.translate(CX, aTop); ctx.scale(IS, IS); ctx.lineWidth = 1.2; ctx.strokeStyle = ON;
        ctx.strokeRect(4, 6, 36, 8);
        ctx.strokeStyle = '#e9a868'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(7, 17); ctx.lineTo(37, 17); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); [[10, 6], [22, 22], [34, 38]].forEach(([x0, x1]) => { ctx.moveTo(x0, 21); ctx.lineTo(x1, 58); }); ctx.stroke();
        ctx.restore();
        text(A.title, CX + IW, aTitleY, ON, fP);
        ctx.font = fS; ctx.textAlign = 'left';
        let ax = CX + IW;
        A.spec.forEach((part, k) => {
            const seg = k ? ' · ' : '';
            if (seg) { ctx.fillStyle = MUTE; ctx.fillText(seg, ax, aSpecY); ax += ctx.measureText(seg).width; }
            ctx.fillStyle = part === A.kTxt ? KC : MUTE; ctx.fillText(part, ax, aSpecY); ax += ctx.measureText(part).width;
        });
        aSay.forEach((ln, k) => text(ln, CX + IW, aSpecY + 10 + (k + 1) * LHS, MUTE, fS));
    }
    rows.forEach(r => {
        text(r[0], CX, r.y, MUTE, fS);
        r[1].forEach((ln, k) => text(ln, DLX, r.y + k * LHS, ON, fS));
    });
    return canvas;
}
// [맺음] 132번: 견적서 아래 마무리 시를 떼어 맨 끝 어두운 장 한 장으로 (02 로고 규칙의 어두운 바탕: #2B221A · 글씨 #EFE6DA · 점 #D19A72)
//  금액이 마지막 인상이 되지 않게, 표지의 한 줄을 끝에서 다시 씀
function buildClosingCanvas(pr) {
    const CX = TICKET_PAD, RX = PAPER_W - TICKET_PAD;
    const L1 = 130, L2 = L1 + Math.round(PAPER_F2 * 1.45), H = L2 + 90;
    const { canvas, ctx } = paperCanvas(H, pr);
    ctx.fillStyle = '#2b221a'; ctx.fillRect(0, 0, PAPER_W, H);
    ctx.textAlign = 'left'; ctx.fillStyle = '#efe6da';
    ctx.font = `400 ${PAPER_F2}px ${PAPER_SERIF}`;
    ctx.fillText('빛을,', CX, L1); ctx.fillText('다시 담습니다', CX, L2);
    paperLogo(ctx, RX, L2, PAPER_F2, '#efe6da', '#d19a72');
    return canvas;
}

function buildTicketCanvases(opts, preparedData) {
    opts = opts || {};
    const data = preparedData || ticketData();
    const pr = opts.pixelRatio || 1;      // 화면에 띄울 때는 더 선명하게(저장·인쇄는 1 = 1080px)
    // 80번: 화면 도록과 같은 순서 — 조각보 표지 → 공간의 색과 빛(37번 조건) → 공간별 쇼룸 시트 → 견적서. 쪽 표시는 전체로 셈(표지에는 안 적음)
    const hasShowroom = !opts.noCard && !!(window.concierge && typeof window.concierge.showroomRows === 'function') && data.rooms.some(r => r.items && r.items.length);
    const slim = hasShowroom || (!opts.noCard && whySetsOf(data).rooms.length > 0);      // 앞장에 원단 이유가 있으면 견적서는 품목당 한 줄
    // 1·2·3쪽의 머리글·글자 크기가 흔들리지 않도록 모든 쪽을 같은 배율(1 = 1080px)로 그림 (39번)
    const plan = planTicket(data, PAPER_K, slim);
    const { s, W, BOTTOM, F, pages } = plan;
    const cover = opts.noCard ? null : buildCoverCanvas(data, pr);
    const cn = cover ? 1 : 0;
    const house = buildHouseCanvases(data, opts), hn = house.count;
    // 쇼룸 시트를 그릴 수 없을 때(고객 화면 파일이 없을 때)만 예전 "원단을 고른 이유" 카드
    const sn = hasShowroom ? 1 : 0;
    const night = buildNightCanvas(data, pr, houseNightOf(data, opts));      // 131번: 견적서 다음 이 집의 밤
    const closing = opts.noCard ? null : buildClosingCanvas(pr);      // 132번: 맨 끝 맺음 장 (쪽 번호는 적지 않지만 전체 쪽 수에는 셈)
    const en = (closing ? 1 : 0) + (night ? 1 : 0);
    const total = n => cn + hn + n + pages.length + en;
    const whyPages = opts.noCard ? [] : (hasShowroom
        ? [buildShowroomCanvas(data, pr, cn + hn, total(sn))].filter(Boolean)
        : buildWhyCanvases(data, opts, total, cn + hn));
    const housePages = house.draw(opts, total(whyPages.length), cn);
    const off = cn + hn + whyPages.length;

    const ticketPages = pages.map((p, pi) => {
        const isLast = pi === pages.length - 1;
        const Hc = Math.ceil(p.y + (isLast ? F.h : BOTTOM));   // 아주 긴 방 하나일 때만 늘어남 (화면 좌표)
        const H = isLast ? Math.max(Hc, Math.ceil(plan.minY + F.h)) : Hc;      // 145번: 품목이 적어도 공간 3개만큼 — 합계·안내는 아래쪽에 붙고 가운데는 빈 칸
        const canvas = document.createElement('canvas');
        canvas.width = TICKET_W * pr; canvas.height = Math.round(H * s * pr);
        const ctx = canvas.getContext('2d');
        ctx.scale(s * pr, s * pr);                                                        // 이후는 모두 "늘리거나 줄이기 전" 좌표
        ctx.fillStyle = '#fffdf9'; ctx.fillRect(0, 0, W, H);                    // 종이 색 (고객 화면 바탕 #fbf9f5보다 조금 밝게 → 화면에서 종이 한 장으로 보임)
        ctx.textBaseline = 'alphabetic';
        const t = drawTicket(ctx, data, W, slim);
        t.hdr();
        p.items.forEach(it => t.drawRoom(it.L, it.y));
        if (isLast) {
            t.drawFooter(F, Math.max(p.y, H - F.h));      // 마무리 시는 맨 끝 맺음 장으로 옮김 (132번)
        }
        t.pageLabel(pi + off, pages.length + off + en, H);
        return canvas;
    });
    const all = (cover ? [cover] : []).concat(housePages, whyPages, ticketPages, night ? [night] : [], closing ? [closing] : []);
    all.cardCount = off;
    all.nightAt = night ? off + ticketPages.length : -1;      // 131번: 밤 장의 쪽 자리 (쪽 넘기기 단추 이름)          // 견적서 앞 쪽 수 (표지 + 공간의 색과 빛 + 쇼룸 시트)
    all.houseCount = cn + hn;
    return all;
}

// 글꼴·원단 사진을 준비한 뒤 견적서 이미지(여러 장일 수 있음)를 만듦
async function makeTicketBlobs(opts) {
    opts = opts || {};
    try {
        if (document.fonts && document.fonts.load) {
            await Promise.all([
                document.fonts.load('700 38px "Noto Serif KR"'),
                document.fonts.load('600 28px "Noto Serif KR"'),
                document.fonts.load('400 30px "Noto Serif KR"'),
                document.fonts.load('600 22px Pretendard'),
                document.fonts.load('700 28px Pretendard'),
                document.fonts.load('500 24px Pretendard'),
                document.fonts.load('400 24px Pretendard')
            ]);
        }
    } catch (e) {}
    const data = await loadTicketPhotos(ticketData());
    const canvases = buildTicketCanvases(opts, data);
    if (opts.canvasOnly) return { canvases, blobs: [], type: null, cardCount: canvases.cardCount || 0, houseCount: canvases.houseCount || 0, nightAt: canvases.nightAt };      // 화면에 띄우기만 할 때 (고객 화면 최종 제안)
    const type = opts.type || 'image/png';
    const blobs = await Promise.all(canvases.map(c => new Promise(res => c.toBlob(res, type, 0.95))));
    return { canvases, blobs, type, cardCount: canvases.cardCount || 0, houseCount: canvases.houseCount || 0 };
}
// 파일 이름. asciiOnly는 휴대폰 공유 창이 한글 이름을 못 읽는 경우를 피하기 위한 영문 이름
function ticketFileNames(count, ext, asciiOnly) {
    const custName = (document.getElementById('custName').value || "").trim();
    const base = asciiOnly ? 'redam_quote' : `${custName ? custName + '_' : ''}맞춤견적서`;
    return Array.from({ length: count }, (_, i) => `${base}${count > 1 ? '_' + (i + 1) : ''}.${ext}`);
}
function saveBlobAsFile(blob, name) {
    const link = document.createElement('a');
    link.download = name;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}

// 여러 쪽(우리 집 색 → 이유 카드 → 견적서)을 세로로 이어 붙여 긴 한 장으로 (68번)
//  탭 브라우저가 두 번째 내려받기부터 막아 첫 장만 저장되던 일을 막음. 장 사이는 앱 바탕색
//  탭 그림판 크기 한계(세로 약 16,000px · 넓이 약 1,600만 칸)를 넘으면 전체를 조금 줄여서 맞춤
const TICKET_JOIN_GAP = 24, TICKET_JOIN_MAX_H = 14800;
function joinTicketCanvases(canvases) {
    if (canvases.length === 1) return canvases[0];
    const W = Math.max(...canvases.map(c => c.width));
    const fullH = canvases.reduce((h, c) => h + c.height, 0) + TICKET_JOIN_GAP * (canvases.length - 1);
    const k = Math.min(1, TICKET_JOIN_MAX_H / fullH);
    const out = document.createElement('canvas');
    out.width = Math.round(W * k); out.height = Math.round(fullH * k);
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#fbf9f5'; ctx.fillRect(0, 0, out.width, out.height);      // 고객 화면 바탕색 (종이 #fffdf9보다 조금 어두워 장이 나뉘어 보임)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    let y = 0;
    canvases.forEach(c => {
        ctx.drawImage(c, Math.round((W - c.width) / 2 * k), Math.round(y * k), Math.round(c.width * k), Math.round(c.height * k));
        y += c.height + TICKET_JOIN_GAP;
    });
    return out;
}

// 견적서 저장: 예전 "카톡용"과 "고화질" 저장을 하나로 합침.
// 선명한 JPG로 갤러리에 저장 → 카카오톡에서 사진으로 보내면 됨 (탭에서 공유 창이 끝없이 로딩돼 "공유" 대신 "저장")
let __saveBusy = false;
async function saveTicketImage() {
    if (typeof blockIfNoFabric === 'function' && blockIfNoFabric()) return;      // 126번
    if (typeof confirmQuoteGaps === 'function' && !confirmQuoteGaps('그대로 견적서를 저장할까요?')) return;      // 163번: 직원 화면에서만 묻기
    if (__saveBusy) return;          // 연타해도 여러 번 저장되지 않게
    __saveBusy = true;
    showToast("견적서 만드는 중...", "info");
    try {
        const { canvases } = await makeTicketBlobs({ canvasOnly: true });
        const one = joinTicketCanvases(canvases);      // 여러 쪽도 긴 한 장으로 (68번)
        const blob = await new Promise(res => one.toBlob(res, 'image/jpeg', 0.95));
        if (!blob) throw new Error('견적서 그림을 만들지 못함');
        saveBlobAsFile(blob, ticketFileNames(1, 'jpg', false)[0]);
        showToast("한 장으로 저장했어요. 카카오톡 → 사진(갤러리)에서 골라 보내 주세요.", "success");
        if (typeof queueNotionLedger === 'function') queueNotionLedger();      // 201번
    } catch (err) {
        console.error(err);
        showToast("견적서 저장 중 오류가 발생했습니다.", "error");
    } finally {
        __saveBusy = false;
    }
}

// 카톡 글 복사 (62번 → 143번): 견적서 위주로 짧게. 원단을 고른 이유·이 집의 밤·맞춤 제작·공급자는 PDF·이미지로 따로 보내므로 뺌
//  순서: 제목 → 공간별 품목 → 빛 → 시공비·부가세·합계 → 리담의 약속·결제 조건·안내. 견적서 원단 이름은 "블랑 1번" (75번)
function ticketKakaoText(data) {
    data = data || ticketData();
    const out = [], won = n => `${Number(n || 0).toLocaleString()}원`;
    const custName = (document.getElementById('custName').value || '').trim();
    out.push(`[Re.dam] ${custName ? custName + ' 고객님 ' : ''}견적서 · ${data.date}${data.validText ? ' (' + data.validText + ')' : ''}`);
    data.rooms.forEach(room => {
        if (!room.items.length) return;
        out.push('', `■ ${room.name}${room.sampleOnly ? '' : ' ' + won(room.total)}`);
        room.items.forEach(it => {
            out.push(`· ${it.kind} · ${it.bookName || it.name}${it.bookSub ? ` (${it.bookSub})` : ''}`);      // 208번: 책자 이름·번호는 괄호로 뒤에
            const sub = [it.size, it.meta, it.sampleOnly ? (it.sampleBlind ? '견본 확인 후' : '') : won(it.price)].filter(Boolean).join(' · ');      // 176번
            if (sub) out.push(`  ${sub}`);
        });
    });
    if (data.light) {      // 131번
        out.push('', `■ 빛 ${won(data.light.total)}`);
        data.light.items.forEach(it => out.push(`· ${[it.kind, it.name].filter(Boolean).join(' · ')}`, `  ${[it.size, it.meta, won(it.price)].filter(Boolean).join(' · ')}`));
    }
    out.push('');
    if (data.install > 0) out.push(`시공 및 설치비 ${won(data.install)}`);
    if (data.vatText) out.push(`${data.vatLabel || '부가세'} ${data.vatText}`);      // 132번
    out.push(`${data.totalLabel || '합계 금액 (시공비 포함)'} ${data.total}원`);      // 161번
    [['리담의 약속', data.promise], ['결제 조건', data.pay], ['안내', data.note]].forEach(([k, v]) => {      // 159번
        const t = String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        if (t.length) out.push('', `[${k}]`, ...t);
    });
    out.push('', '자세한 제안서는 이미지로 함께 보내 드립니다.');      // 144번: 손님에게는 저장 이미지(JPG)를 보냄
    return out.join('\n');
}
async function copyTicketText() {
    let txt = '';
    if (typeof blockIfNoFabric === 'function' && blockIfNoFabric()) return;      // 126번
    try { txt = ticketKakaoText(); } catch (err) { console.error(err); showToast("글을 만들지 못했습니다.", "error"); return; }
    // 숨은 글상자로 먼저 복사 (누른 순간에 바로 해야 됨 — 기다린 뒤엔 막히는 창이 있음). 안 되면 클립보드로
    let ok = false;
    const ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed; left:-9999px; top:0;';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    if (!ok) { try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; } } catch (e) {} }
    // 163번: 직원 화면에서는 복사한 뒤 빈칸·크기 문제를 알림(창을 먼저 띄우면 복사가 막힐 수 있어 뒤에). 공급자는 카톡 글에 없어 빼고 봄
    const gaps = (ok && typeof quoteGaps === 'function' && typeof appMode !== 'undefined' && appMode === 'staff') ? quoteGaps(false) : [];
    showToast(ok ? (gaps.length ? `카톡 글을 복사했어요. 다만 ${gaps.join(' · ')}.` : "카톡 글을 복사했어요. 카카오톡 대화창에 붙여 넣어 주세요.") : "복사하지 못했습니다.", (ok && !gaps.length) ? "success" : "error");
    if (ok && typeof queueNotionLedger === 'function') queueNotionLedger();      // 201번
}

async function preparePrintSheet() {
    const { canvases } = await makeTicketBlobs();
    const sheet = document.getElementById('printSheet');
    sheet.innerHTML = '';
    for (const canvas of canvases) {
        const page = document.createElement('div');
        page.className = 'print-page';
        const img = document.createElement('img');
        img.alt = '견적서';
        img.src = canvas.toDataURL('image/png');
        page.appendChild(img);
        sheet.appendChild(page);
        if (img.decode) { try { await img.decode(); } catch (e) {} }
    }
}

// 인쇄 중에는 견적서 이미지(#printSheet)만 남기고 나머지 화면을 숨깁니다.
// (고객 화면은 "항상 표시"로 고정돼 있어서 스타일시트만으로는 숨겨지지 않기 때문에 직접 숨기고, 끝나면 되돌립니다.)
let __printHidden = [];
function isolatePrintSheet() {
    restorePrintIsolation(false);
    Array.from(document.body.children).forEach(el => {
        if (el.id === 'printSheet' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
        __printHidden.push({ el, value: el.style.getPropertyValue('display'), priority: el.style.getPropertyPriority('display') });
        el.style.setProperty('display', 'none', 'important');
    });
    const sheet = document.getElementById('printSheet');
    if (sheet) {
        sheet.style.setProperty('display', 'block', 'important');
        sheet.style.setProperty('background', '#ffffff', 'important');
        // 화면에서만 보이는 "돌아가기" 버튼 (인쇄물에는 나오지 않음). 인쇄 창이 닫혔는데도 화면이 안 돌아올 때를 대비
        const back = document.createElement('button');
        back.id = 'printBackBtn';
        back.type = 'button';
        back.textContent = '← 돌아가기';
        back.onclick = () => restorePrintIsolation(true);
        sheet.appendChild(back);
    }
    // 인쇄 미리보기가 만들어지는 동안에는 화면을 되돌리지 않습니다 (되돌리면 뒤로가기 버튼·반투명 배경이 인쇄물에 섞임).
    // 인쇄 창이 닫힌 뒤(afterprint)에만 되돌립니다.
    window.addEventListener('afterprint', () => restorePrintIsolation(true), { once: true });
}
function restorePrintIsolation(clearSheet) {
    __printHidden.forEach(({ el, value, priority }) => {
        if (value) el.style.setProperty('display', value, priority); else el.style.removeProperty('display');
    });
    __printHidden = [];
    const sheet = document.getElementById('printSheet');
    if (sheet) {
        sheet.style.removeProperty('display');
        sheet.style.removeProperty('background');
        const back = document.getElementById('printBackBtn');
        if (back) back.remove();
        if (clearSheet) sheet.innerHTML = '';
    }
}

// 견적서 인쇄 / PDF 저장: 저장되는 이미지와 똑같은 모양을 한 장으로 출력
// (10-15) 앱 화면을 숨겼다 되돌리는 방식은 탭에서 ← ⌂ 버튼이 비치고 전체가 반투명하게 나왔음
//  → 이제 견적서 이미지만 든 "빈 인쇄 전용 창(iframe)"을 만들어 그것만 인쇄함. 앱 화면은 건드리지 않아 섞일 수 없음.
//  (iframe이 안 되는 기기에서만 예전 방식으로 인쇄)
let __printFrame = null;
function removePrintFrame() {
    if (__printFrame) { try { __printFrame.remove(); } catch (e) {} __printFrame = null; }
}
async function printTicket() {
    if (typeof blockIfNoFabric === 'function' && blockIfNoFabric()) return;      // 126번
    if (typeof confirmQuoteGaps === 'function' && !confirmQuoteGaps('그대로 인쇄할까요?')) return;      // 163번: 직원 화면에서만 묻기
    let canvases;
    try { ({ canvases } = await makeTicketBlobs()); }
    catch (err) { console.error(err); showToast("견적서 인쇄 준비 중 오류가 발생했습니다.", "error"); return; }
    if (typeof queueNotionLedger === 'function') queueNotionLedger();      // 201번
    const prevTitle = document.title;
    const custName = (document.getElementById('custName').value || '').trim();
    const title = `${custName ? custName + '_' : ''}맞춤견적서`;      // PDF 기본 파일명
    let done = false;
    const finish = () => { if (done) return; done = true; document.title = prevTitle; };      // 인쇄 창이 아직 인쇄물을 만드는 중일 수 있어 창(iframe)은 바로 지우지 않음
    try {
        removePrintFrame();
        const fr = document.createElement('iframe');
        fr.setAttribute('aria-hidden', 'true');
        fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
        document.body.appendChild(fr);
        __printFrame = fr;
        const doc = fr.contentDocument;
        const pages = canvases.map(c => `<div class="pg"><img alt="견적서" src="${c.toDataURL('image/png')}"></div>`).join('');
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>
            @page { size: A4 portrait; margin: 10mm; }
            html, body { margin: 0; padding: 0; background: #ffffff; }
            .pg { text-align: center; break-after: page; page-break-after: always; }
            .pg:last-child { break-after: auto; page-break-after: auto; }
            .pg img { display: inline-block; max-width: 100%; max-height: 270mm; width: auto; height: auto; object-fit: contain; }
        </style></head><body>${pages}</body></html>`);
        doc.close();
        await Promise.all(Array.from(doc.images).map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
        document.title = title;
        fr.contentWindow.addEventListener('afterprint', finish, { once: true });
        window.addEventListener('afterprint', finish, { once: true });
        setTimeout(finish, 120000);      // 어떤 이유로 afterprint가 안 와도 2분 뒤 제목 되돌림
        setTimeout(removePrintFrame, 600000);      // 인쇄 전용 창은 10분 뒤(또는 다음 인쇄 때) 정리
        fr.contentWindow.focus();
        fr.contentWindow.print();
        return;
    } catch (err) {
        console.error('iframe 인쇄 실패, 예전 방식으로 인쇄합니다', err);
        removePrintFrame();
    }
    // 예전 방식 (비상용)
    await preparePrintSheet();
    document.title = title;
    window.addEventListener('afterprint', () => { document.title = prevTitle; }, { once: true });
    isolatePrintSheet();
    setTimeout(() => window.print(), 120);
}
