(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['color-guide.js']='20261148';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// ==============================================================
// 색 기법 교과서 (95번): 직원 화면 › 색 기법. 열 때만 불러옴. 손님 화면에는 없음
//  기법 하나 = 카드 한 장: 방 그림 + Lab 색상환·밝기 막대 → 이름 · 앱 반영 → 효과 → 쓰는 법·조심 → 손님에게 하는 말
//  문구·예시 색·그림 코드는 시안(Claude outputs/시안/색_기법_교과서_시안.html) 그대로. 앱 반영 표시는 기법이 앱에 들어갈 때마다 고침
//  네모(이 집 색)는 예시 #D3BC9E로 고정: 카드의 커튼 예시 색이 이 베이지 집을 기준으로 골라져 있음
// ==============================================================
(function () {
const W='#EEE9E0',F='#B98A5E';
const G={fit:'어울림',point:'포인트',bold:'강하게',curtain:'커튼만의 기법'};
const T=[
{g:'fit',n:'동일색',c:'#E6E0D4',app:['on','벽과 맞추기'],eff:'커튼이 벽에 녹아 공간이 넓고 고요해 보입니다.',use:'좁은 방, 창이 벽 대부분인 방. 벽 색과 거의 같은 원단.',warn:'흰 벽에서는 커튼이 존재감을 잃어 밋밋할 수 있습니다.',say:'벽과 같은 결로 맞춰 창 쪽이 벽처럼 이어지고, 공간이 넓어 보입니다.'},
{g:'fit',n:'그라데이션',c:'#D8C5AC',app:['on','벽·바닥 이어주기'],eff:'벽과 바닥 사이를 끊김 없이 이어 줍니다.',use:'벽과 바닥의 색 차이가 큰 집. 벽 쪽에 조금 더 가까운 중간색.',warn:'중간색이 탁해 보일 수 있어 실물 샘플로 확인합니다.',say:'벽과 바닥 사이의 색이라 두 면을 자연스럽게 이어 줍니다.'},
{g:'fit',n:'톤온톤',c:'#D9BC98',app:['on','바닥과 맞추기'],eff:'같은 색을 밝기만 달리해 따뜻한 일체감을 줍니다.',use:'나무 바닥이 예쁜 집. 바닥 색을 한두 단계 밝게.',warn:'바닥이 아주 진하면 커튼이 무거워집니다.',say:'바닥 나무 색을 한 단계 밝게 올려 같은 결로 맞췄습니다.'},
{g:'fit',n:'유사색',c:'#CFA187',app:['no','아직'],eff:'튀지 않으면서도 "다르다"는 느낌을 줍니다.',use:'집 색에서 색상환 한두 칸 옆. 채도는 낮게. 베이지 집에 테라코타·로즈베이지.',warn:'칸을 너무 멀리 가면 보색처럼 강해집니다.',say:'집의 베이지 기운 바로 옆 색이라 어울리면서도 새로워 보입니다.'},
{g:'fit',n:'가구 되울림',c:'#A9A882',sofa:'#7D7E5A',app:['part','가구 색은 잼 · 점수엔 아직'],eff:'방에 있는 가구 색을 커튼이 한 번 더 받아 방이 정돈돼 보입니다.',use:'소파·수납장처럼 오래 두는 가구 색을 옅게. 이불·러그는 바뀌니 기준으로 안 씀.',warn:'가구를 바꿀 계획이 있는지 먼저 묻습니다.',say:'소파의 올리브 색을 커튼이 한 번 더 받아 주도록 골랐습니다.'},
{g:'point',n:'톤인톤',c:'#A9B8A4',app:['no','아직'],eff:'밝기·채도는 집과 같고 색만 달라, 큰 면적에도 안전한 포인트입니다.',use:'이어주는 색과 밝기·채도를 맞춘 채 색 계열만 옮김. 베이지 집에 세이지·더스티 블루.',warn:'채도가 집보다 높아지면 톤인톤이 아니라 대비가 됩니다.',say:'집과 같은 차분함은 그대로 두고, 색만 바꿔 생기를 더했습니다.'},
{g:'point',n:'채도 대비',c:'#C48A4E',app:['no','아직'],eff:'같은 계열을 더 또렷하게 써서 따뜻한 힘을 줍니다.',use:'흐린 베이지 집에 또렷한 카멜·브릭. 계열은 그대로.',warn:'넓은 창 전체보다 한 창, 겉지에만.',say:'집의 베이지를 더 또렷한 카멜로 받아 공간에 중심을 잡았습니다.'},
{g:'point',n:'분열보색',c:'#8FA4A0',app:['no','아직'],eff:'보색의 생기는 살리고 충돌은 줄입니다.',use:'집 색 맞은편의 바로 양옆. 웜 집이면 청록·회청 쪽을 흐리게.',warn:'선명한 색은 피하고 먼지 낀 듯한 색만 고릅니다.',say:'나무의 따뜻함과 맞서는 차분한 청록이라 서로를 돋보이게 합니다.'},
{g:'point',n:'명도 대비',c:'#2F3A4B',app:['no','아직 (92번에서 딥 점수 뺌)'],eff:'밝은 집에 짙은 커튼으로 무게와 품격을 줍니다.',use:'밝은 벽·밝은 바닥 집, 창이 하나인 방. 네이비·차콜·딥그린.',warn:'좁고 어두운 방은 더 답답해집니다. 손님이 고를 때만.',say:'밝은 집에 짙은 색 하나로 무게를 잡아 공간이 단단해 보입니다.'},
{g:'bold',n:'보색',c:'#E6E0D4',trim:'#4F6E93',app:['no','아직'],eff:'가장 강한 대비로 눈길과 생기를 만듭니다.',use:'같은 원단 끝단 배색(폭·마 단위로 끊어 추가 비용 없음)·방 하나처럼 작은 면적에. 웜 집이면 블루.',warn:'커튼 전체에 쓰면 방이 커튼만 보입니다.',say:'따뜻한 집에 반대색 블루를 끝단에만 넣어 또렷한 포인트를 줬습니다.'},
{g:'bold',n:'3색 조화',c:'#7E8FAA',sofa:'#C27A6A',dot:'#D9B95A',app:['no','아직'],eff:'세 색이 고르게 맞서 활기차고 즐거운 공간이 됩니다.',use:'아이방·놀이방, 개성이 강한 손님. 커튼은 셋 중 하나만 맡음.',warn:'세 색 모두 강하면 피곤합니다. 하나를 주인공으로.',say:'커튼·소파·소품이 세 색으로 서로 받쳐 주는 밝은 방입니다.'},
{g:'bold',n:'4색 조화',c:'#E6E0D4',stripe:['#C27A6A','#D9B95A','#7FA38A','#6F86A8'],app:['no','아직'],eff:'풍성하고 맥시멀한, 일부러 정신없는 느낌.',use:'무늬·스트라이프 원단 안에서. 나머지는 무채색으로 받침.',warn:'정신없음이 목적일 때만. 방 하나에.',say:'여러 색이 한 원단 안에 모여 방에 축제 같은 기분을 줍니다.'},
{g:'curtain',n:'빛 보정',c:'#EBD4B4',glow:'#FFE2B8',app:['no','아직 (창 방향 없음)'],eff:'커튼을 통과한 빛이 방 전체의 색 온도를 바꿉니다.',use:'북향은 웜 속지로 따뜻하게, 서향은 뉴트럴·쿨로 오후 붉은빛을 누름.',warn:'현장에서 낮에 실물을 창에 대 보고 확인합니다.',say:'북향이라 빛이 차가운 방이어서, 빛을 따뜻하게 걸러 주는 색을 골랐습니다.'},
{g:'curtain',n:'겉지·속지 배색',c:'#4E6455',sheer:'#F4F1EA',app:['part','겉지에 어울리는 속지'],eff:'한 세트 안에서 바탕과 포인트를 나눠, 실패 없이 색을 씁니다.',use:'속지는 무난하게 낮에 쓰고, 겉지에 포인트. 밤에만 색이 보임.',warn:'겉지를 늘 묶어 두는 집이면 포인트가 거의 안 보입니다.',say:'낮에는 밝은 속지로 가볍게, 밤에는 깊은 겉지로 분위기가 바뀝니다.'},
{g:'curtain',n:'집 전체 흐름',c:'#B9BEA8',rooms:['#D8DCCB','#B9BEA8','#8E977A'],app:['no','아직'],eff:'한 색을 방마다 강약만 바꿔 되울려 집 전체가 한 작품이 됩니다.',use:'거실 포인트 색을 안방은 약하게, 아이방은 강하게.',warn:'모든 방을 같은 색으로 하면 단조로워집니다.',say:'거실의 세이지를 방마다 진하기만 달리해 집 전체가 이어지게 했습니다.'},
{g:'curtain',n:'질감 포인트',c:'#E3DACB',linen:true,app:['part','속지 질감 취향'],eff:'색은 무난하게 두고 결로 차이를 만듭니다.',use:'색을 망설이는 손님. 린넨 결·도톰한 혼방.',warn:'사진으로는 잘 안 보여 실물 샘플이 꼭 필요합니다.',say:'색은 집에 맞추고, 린넨의 결로 공간에 깊이를 더했습니다.'}
];
function room(t){
  if(t.rooms) return `<svg viewBox="0 0 240 120">${t.rooms.map((c,i)=>{const x=i*80;return `<rect x="${x}" width="80" height="96" fill="${W}"/><rect x="${x}" y="96" width="80" height="24" fill="${F}"/><rect x="${x+22}" y="20" width="36" height="60" fill="#cfe0ea"/><rect x="${x+14}" y="14" width="16" height="82" fill="${c}"/><rect x="${x+50}" y="14" width="16" height="82" fill="${c}"/>`}).join('')}<line x1="80" y1="0" x2="80" y2="120" stroke="#fff" stroke-width="2"/><line x1="160" y1="0" x2="160" y2="120" stroke="#fff" stroke-width="2"/></svg>`;
  let s=`<svg viewBox="0 0 240 120"><defs><pattern id="cgln${t.i}" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="${t.c}"/><path d="M0 1h4M2 0v4" stroke="#00000014" stroke-width="1"/></pattern></defs>`;
  s+=`<rect width="240" height="96" fill="${W}"/><rect y="96" width="240" height="24" fill="${F}"/>`;
  s+=`<rect x="80" y="18" width="80" height="62" fill="${t.glow?'#c9d8e6':'#cfe0ea'}"/>`;
  if(t.sheer) s+=`<rect x="78" y="12" width="84" height="84" fill="${t.sheer}" opacity=".85"/>`;
  const panel=x=>{let fill=t.linen?`url(#cgln${t.i})`:t.c,p=`<rect x="${x}" y="12" width="30" height="84" fill="${fill}"/>`;
    if(t.stripe) t.stripe.forEach((c,i)=>p+=`<rect x="${x+3+i*7}" y="12" width="3" height="84" fill="${c}"/>`);
    if(t.trim) p+=`<rect x="${x===62?x+24:x}" y="12" width="6" height="84" fill="${t.trim}"/>`;
    return p};
  s+=panel(62)+panel(148);
  if(t.glow) s+=`<rect width="240" height="120" fill="${t.glow}" opacity=".28"/>`;
  if(t.sofa) s+=`<rect x="170" y="78" width="56" height="22" rx="4" fill="${t.sofa}"/><rect x="170" y="70" width="56" height="12" rx="4" fill="${t.sofa}" opacity=".85"/>`;
  if(t.dot) s+=`<circle cx="30" cy="88" r="9" fill="${t.dot}"/>`;
  return s+'</svg>';
}
// 색상환 (95번, 10-26 Lab으로): 앱이 벽·바닥·원단을 재는 잣대(Lab)와 같게. 오른쪽 = 붉은 기운(a+), 위 = 노란 기운(b+)
//  고리 각도 = 색 계열(Lab 색상각), 가운데로 갈수록 흐린 색(채도 C). 네모 = 이 집(벽·바닥 사이 색), 동그라미 = 커튼·포인트. 오른쪽 막대 = 밝기 L
const HOUSE='#D3BC9E';
function lab(hex){const n=parseInt(hex.slice(1),16),f=v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)},r=f(n>>16&255),g=f(n>>8&255),b=f(n&255);
  const X=(0.4124*r+0.3576*g+0.1805*b)/0.95047,Y=0.2126*r+0.7152*g+0.0722*b,Z=(0.0193*r+0.1192*g+0.9505*b)/1.08883,q=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116;
  return{L:116*q(Y)-16,a:500*(q(X)-q(Y)),b:200*(q(Y)-q(Z))}}
function labHex(L,a,b){const fy=(L+16)/116,fx=fy+a/500,fz=fy-b/200,i=t=>t**3>0.008856?t**3:(t-16/116)/7.787,X=i(fx)*0.95047,Y=i(fy),Z=i(fz)*1.08883;
  const g=v=>{v=v<=0.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-0.055;return Math.round(Math.max(0,Math.min(1,v))*255)};
  return`rgb(${g(3.2406*X-1.5372*Y-0.4986*Z)},${g(-0.9689*X+1.8758*Y+0.0415*Z)},${g(0.0557*X-0.2040*Y+1.0570*Z)})`}
function marks(t){const m=[];if(!t.rooms&&!t.trim&&!t.stripe)m.push(t.c);if(t.rooms)m.push(...t.rooms);if(t.trim)m.push(t.trim);if(t.stripe)m.push(...t.stripe);if(t.sofa)m.push(t.sofa);if(t.dot)m.push(t.dot);return m}
function wheel(t){const cx=50,cy=60,R=40;let s='<svg viewBox="0 0 118 120">';
  for(let i=0;i<72;i++){const h0=i*5*Math.PI/180,h1=(i+1)*5*Math.PI/180,r0=R-7,hm=(i*5+2.5)*Math.PI/180,P=(r,h)=>`${cx+r*Math.cos(h)} ${cy-r*Math.sin(h)}`;
    s+=`<path d="M${P(R,h0)}A${R} ${R} 0 0 0 ${P(R,h1)}L${P(r0,h1)}A${r0} ${r0} 0 0 1 ${P(r0,h0)}Z" fill="${labHex(68,40*Math.cos(hm),40*Math.sin(hm))}"/>`}
  s+=`<circle cx="${cx}" cy="${cy}" r="${R-8}" fill="#fff"/><circle cx="${cx}" cy="${cy}" r="1.5" fill="#bbb"/>`;
  // 채도는 흐린 색도 방향이 보이게 늘여 그림 (C 2 미만 = 무채색은 가운데)
  const pos=hex=>{const c=lab(hex),C=Math.hypot(c.a,c.b),h=Math.atan2(c.b,c.a),r=(C<2?0:0.4+0.6*Math.min(1,C/45))*(R-12);return[cx+r*Math.cos(h),cy-r*Math.sin(h),c.L]};
  const ms=marks(t).map(pos),[hx,hy,hl]=pos(HOUSE);
  ms.forEach(([x,y])=>s+=`<line x1="${hx}" y1="${hy}" x2="${x}" y2="${y}" stroke="#0003" stroke-dasharray="2 2"/>`);
  s+=`<rect x="${hx-4.5}" y="${hy-4.5}" width="9" height="9" fill="${HOUSE}" stroke="#2b2622" stroke-width="1.3"/>`;
  marks(t).forEach((c,i)=>s+=`<circle cx="${ms[i][0]}" cy="${ms[i][1]}" r="5" fill="${c}" stroke="#2b2622" stroke-width="1.3"/>`);
  s+=`<defs><linearGradient id="cglb${t.i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#222"/></linearGradient></defs><rect x="103" y="20" width="6" height="80" rx="3" fill="url(#cglb${t.i})" stroke="#0002"/>`;
  const ly=L=>20+80*(1-L/100);
  s+=`<rect x="99" y="${ly(hl)-3}" width="5" height="6" fill="${HOUSE}" stroke="#2b2622"/>`;
  ms.forEach(([, ,L],i)=>s+=`<circle cx="111" cy="${ly(L)}" r="3.2" fill="${marks(t)[i]}" stroke="#2b2622"/>`);
  return s+'</svg>';}
T.forEach((t, i) => { t.i = i; });
let cur = 'fit';
function draw() {
    const tabs = document.getElementById('cgTabs'), grid = document.getElementById('cgGrid');
    if (!tabs || !grid) return;
    tabs.innerHTML = Object.entries(G).map(([k, v]) => `<button type="button" data-cg="${k}" aria-selected="${k === cur}">${v}</button>`).join('');
    grid.innerHTML = T.filter(t => t.g === cur).map(t => `<div class="cg-card"><div class="cg-pic">${room(t)}${wheel(t)}</div><div class="cg-body"><div class="cg-head"><h3 class="font-serif-kr">${t.n}</h3><span class="cg-app ${t.app[0]}">${t.app[1]}</span></div><p class="cg-eff">${t.eff}</p><dl><dt>쓰는 법</dt><dd>${t.use}</dd><dt>조심</dt><dd>${t.warn}</dd></dl><div class="cg-say font-serif-kr">${t.say}</div></div></div>`).join('');
}
document.addEventListener('click', ev => {
    const b = ev.target.closest && ev.target.closest('#cgTabs button[data-cg]');
    if (b) { cur = b.dataset.cg; draw(); }
});
window.ColorGuide = { open: draw };
})();
