(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['room3d.js']='20261328';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// room3d.js — 입체 방(258번): 공간 하나를 선과 납작한 색의 모형으로 — 측정(폰에서 잰 값 확인) · 선택(고른 원단을 걸어 보고 크기 · 밑단 · 여닫기 · 블라인드 모양).
//  시안 19판(Claude outputs/시안/입체방_1124/19판.html)을 앱 모듈로 옮김. 공간 화면의 '입체 방' 단추가 window.RedamRoom3D.open()으로 연다(space.js).
//  금액: 이 파일은 금액을 셈하지 않는다. 완료 때 돌려주는 값 가운데 앱이 품목에 쓰는 것은 '손으로 바꾼 가로 · 세로(cm 차이)'와 '속지 리드밴드'뿐 — 나머지는 공간의 room3d 칸에만 남는다.
//  그림 엔진 three.js r128은 처음 열 때만 불러온다(cdnjs). 그리는 판(WebGL)은 한 번 만들어 다시 쓰고, 닫으면 그리기를 멈추고 화면에서 뗀다. 닫혀 있는 동안 document에 다는 귀는 없다.
//  열기: RedamRoom3D.open({ room, items, measure, fabricOf, onClose }) — onClose({ done, pack, sizes, layers, view, goFabric })
//  263번: open({ …, build: true }) = 공간 추가에서 공간을 짓는다(결정 #410 · 시안 2판, 화면 확인 #34) — 폰에서 잰 값도 '확인 전'으로 깔아 측정에서 하나씩 확인하며 짓고
//   (점 → 선 → 바닥 → 벽 → 창 → 박스 → 방향(빛이 처음 듦) → 색 → 가구), 측정이 끝나면 선택으로 가지 않고 닫으며 onClose({ done: false, pack, built })
//   built = { room: { w, d, h }, wins: [{ w, h, sill, wall, x, n }], box: [...], dir: ['남'], wall: '#hex'|null, floor: '#hex'|null } (cm, sizesOut과 같은 꼴 · 색은 폰에서 잰 색을 확인한 것만)
//   색 질문은 폰에서 벽 · 바닥 색을 둘 다 잰 공간만 — 아니면 건너뛰고 앱의 색 단계가 잰다. 창밖은 언제나 납작한 그림 층(결정 #409)
(function () {
  'use strict';
  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var SCENE_URL = 'photos/scene/window_apt.jpg';      // 창밖 — 비침 고르기와 같은 사진 한 장(256번) · 263번부터 입체 방은 아래 그림 층을 씀(비침 고르기는 사진 그대로)
  // 263번: 창밖은 사진 대신 납작한 그림 세 겹 — 옅은 하늘 · 먼 건물 띠 · 가까운 나무 줄(결정 #409). 사진과 같은 크기(1264 × 848)로 그려 아래 창밖 처리를 그대로 탄다
  var FLATSCN = null;
  function flatScene() {
    if (FLATSCN) return FLATSCN;
    var W = 1264, H = 848, c = document.createElement('canvas'), g, i, x, h, seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    c.width = W; c.height = H; g = c.getContext('2d');
    var sky = g.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#dfe6ea'); sky.addColorStop(1, '#eef0ee');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d3d9dc';      // 먼 건물 띠 — 하늘보다 조금 짙게, 모양만
    for (x = -20; x < W; x += 40 + rnd() * 70) { h = 70 + rnd() * 120; g.fillRect(x, 430 - h, 34 + rnd() * 60, h + 40); }
    g.fillRect(0, 430, W, 60);
    g.fillStyle = '#dcd8d1';      // 가까운 아파트 — 납작한 면과 옅은 창 줄
    for (i = 0; i < 3; i++) {
      x = 60 + i * 430 + rnd() * 40; var bw = 300 + rnd() * 60, top = 300 + rnd() * 50;
      g.fillStyle = '#dcd8d1'; g.fillRect(x, top, bw, 420);
      g.fillStyle = 'rgba(120,128,132,0.16)';
      for (var y = top + 24; y < 690; y += 42) for (var wx = x + 18; wx < x + bw - 30; wx += 48) g.fillRect(wx, y, 30, 20);
    }
    g.fillStyle = '#a9b4a3';      // 가까운 나무 줄 — 둥근 덩어리를 이어서
    for (x = -40; x < W + 40; x += 46) { g.beginPath(); g.arc(x, 650 + rnd() * 30, 60 + rnd() * 30, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, 680, W, H - 680);
    g.fillStyle = '#98a595';
    for (x = -10; x < W + 40; x += 64) { g.beginPath(); g.arc(x, 740 + rnd() * 30, 56 + rnd() * 24, 0, Math.PI * 2); g.fill(); }
    g.fillRect(0, 770, W, H - 770);
    return (FLATSCN = c);
  }
  var CSS = `/* 입체 방(258번) — 모든 모양은 .r3d 안에서만. 색 · 글꼴은 앱 토큰(tokens.css)을 쓴다 */
.r3d { position: fixed; inset: 0; z-index: 250; display: block; margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 17px; line-height: 1.5; text-align: left; letter-spacing: normal; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; overflow: hidden; overscroll-behavior: contain; color-scheme: light; --bg: var(--rd-app-color-bg, #fbf9f5); --text: var(--rd-app-color-text, #2b221a); --muted: var(--rd-app-color-text-muted, #6f5f4f); --ink14: var(--rd-app-color-line-ink, rgba(43, 34, 26, 0.14)); --ink45: var(--rd-app-color-line-joint, rgba(43, 34, 26, 0.45)); --point: var(--rd-common-point-base, #8a4a22); --serif: var(--rd-font-family-serif, 'Noto Serif KR', Georgia, serif); --sans: var(--rd-app-font-sans, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif); --hatch: repeating-linear-gradient(135deg, rgba(43, 34, 26, 0.18) 0 1px, rgba(43, 34, 26, 0) 1px 7px); }
.r3d, .r3d * { box-sizing: border-box; margin: 0; padding: 0; }
.r3d button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; text-align: left; }
.r3d button:focus-visible { outline: 1px solid var(--text); outline-offset: 4px; }
.r3d [hidden] { display: none !important; }
.r3d .app { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-rows: auto minmax(0, 1fr) auto; height: 100%; }
.r3d .head { grid-column: 1 / -1; display: flex; align-items: center; gap: 24px; padding: 16px 40px 0; min-width: 0; }
.r3d h1, .r3d h2 { font-family: var(--serif); font-weight: 400; font-size: 28px; line-height: 1.3; letter-spacing: -0.02em; }
.r3d h1 { white-space: nowrap; line-height: 1.2; }
.r3d .spaces { display: flex; align-items: center; gap: 20px; flex: none; }
.r3d .steps { display: flex; align-items: center; gap: 0; flex: none; }
.r3d .steps .act { position: relative; padding: 0 20px; }
.r3d .steps .act.on::before { position: absolute; left: 4px; top: 50%; margin: -4px 0 0; }
.r3d .steps .rule { width: 20px; height: 1px; background: var(--ink45); flex: none; }
.r3d .app[data-build="1"] .steps .rule, .r3d .app[data-build="1"] .steps [data-step="cur"] { display: none; }      /* 263번: 공간 짓기에는 '선택'이 없다 */
.r3d .tools { margin-left: auto; display: flex; align-items: center; gap: 0; min-width: 0; overflow-x: auto; scrollbar-width: none; padding-left: 16px; }
.r3d .tools::-webkit-scrollbar { display: none; }
.r3d .tool { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; flex: none; border-radius: 50%; }
.r3d .tool svg, .r3d .ti svg { display: block; width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.r3d .tool.on::after { content: ''; position: absolute; left: 50%; bottom: 3px; width: 6px; height: 6px; margin-left: -3px; border-radius: 50%; background: var(--point); }
.r3d .tool.off { opacity: 0.3; pointer-events: none; }
.r3d .tool:active { background: var(--ink14); }
.r3d .tool .sl { display: none; }
.r3d .tool.hid .sl { display: block; }
.r3d .tool.hid .bd { opacity: 0.35; }
.r3d .tsep { width: 1px; height: 20px; margin: 0 10px; background: var(--ink45); opacity: 0.5; flex: none; }
.r3d .tools, .r3d .steps { transition: opacity 0.3s ease; }
.r3d .act { display: inline-flex; align-items: center; height: 48px; min-width: 48px; font-size: 15px; white-space: nowrap; flex: none; }
.r3d .act > span { line-height: 1.35; }
.r3d .next > span { border-bottom: 1px solid var(--text); }
.r3d .next.quiet > span { border-bottom-color: transparent; }
.r3d .act.off { color: var(--muted); pointer-events: none; }
.r3d .act.off > span { border-bottom-color: transparent; }
.r3d .act.on { pointer-events: none; }
.r3d .act.on > span { border-bottom-color: transparent; }
.r3d .act.on::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--point); margin-right: 8px; }
.r3d .stage { grid-column: 1; grid-row: 2; position: relative; min-height: 0; min-width: 0; overflow: hidden; touch-action: none; }
.r3d .stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
.r3d .stage.aim::after { content: ''; position: absolute; inset: 12px; border: 1px solid var(--ink45); pointer-events: none; }
.r3d .over { position: absolute; inset: 0; pointer-events: none; }
.r3d .app[data-endv="1"] .over { display: none; }      /* 267번: 다 지은 장면은 보기만 — 손잡이 · 치수 숨김 */
.r3d .r3d-endp { margin-top: 10px; color: #6b5d50; }      /* 267번: 다 지은 뒤 한 줄 */
.r3d .dim.hem { color: var(--text); font-size: 17px; }
.r3d .dim { position: absolute; left: 0; top: 0; padding: 0 8px; background: var(--bg); color: var(--muted); font-size: 15px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.r3d .grip { position: absolute; left: 0; top: 0; width: 48px; height: 48px; margin: -24px 0 0 -24px; pointer-events: auto; touch-action: none; cursor: grab; }
.r3d .grip::after { content: ''; position: absolute; left: 18px; top: 18px; width: 12px; height: 12px; background: #fff; border: 1px solid var(--text); }
.r3d .grip[data-grip="bx"]::after { left: 10px; top: 20px; width: 26px; height: 6px; }
.r3d .none { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--muted); text-align: center; }
.r3d .board { position: absolute; right: 40px; top: 24px; width: 168px; height: 168px; background: var(--bg); box-shadow: 0 0 0 8px var(--bg), 0 0 0 8.5px var(--ink14); opacity: 0; transition: opacity 0.6s ease; pointer-events: none; }
.r3d .board.show { opacity: 1; }
.r3d .app[data-step="cur"] .board { width: 136px; height: 136px; }
.r3d .piece { position: absolute; box-shadow: inset 0 0 0 1px var(--bg); transition: left 0.5s ease, top 0.5s ease, width 0.5s ease, height 0.5s ease, background-color 0.6s ease; }
.r3d .piece.dot::after { content: ''; position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--point); box-shadow: 0 0 0 3px var(--bg); }
.r3d .panel { grid-column: 2; grid-row: 2 / 4; width: 420px; overflow: hidden; border-left: 1px solid var(--ink14); transition: width 0.45s ease, height 0.45s ease, border-color 0.45s ease; }
.r3d .pin { width: 420px; height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto auto; padding: 8px 40px 20px 32px; }
.r3d .app[data-step="cur"] .pin { display: none; }
.r3d .rec { overflow-y: auto; scrollbar-width: none; min-height: 0; }
.r3d .rec::-webkit-scrollbar { display: none; }
.r3d .row { display: flex; align-items: center; gap: 16px; min-height: 48px; width: 100%; padding: 4px 0; }
.r3d .row + .row { border-top: 1px solid var(--ink14); }
.r3d .row .k { width: 72px; flex: none; font-size: 15px; color: var(--muted); }
.r3d .row .v { font-family: var(--serif); font-size: 17px; line-height: 1.35; display: flex; align-items: center; gap: 10px; min-width: 0; font-variant-numeric: tabular-nums; }
.r3d .row .v i { width: 20px; height: 20px; flex: none; box-shadow: inset 0 0 0 0.5px var(--ink14); }
.r3d .q { padding-top: 20px; border-top: 1px solid var(--text); }
.r3d .q h2 { margin-bottom: 8px; word-break: keep-all; }
.r3d .opts { display: flex; flex-wrap: wrap; gap: 0 28px; }
.r3d .chips { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.r3d .opt { display: inline-flex; align-items: center; height: 48px; min-width: 48px; font-size: 17px; white-space: nowrap; }
.r3d .opt > span { line-height: 1.35; }
.r3d .opt.on::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--point); margin-right: 8px; }
.r3d .opt .sub { margin-left: 8px; font-size: 15px; font-style: normal; color: var(--muted); font-variant-numeric: tabular-nums; }
.r3d .opts + .opts, .r3d .fields .frow + .opts { border-top: 1px solid var(--ink14); }
.r3d .opts > .sub { align-self: center; margin-left: auto; font-size: 15px; font-style: normal; color: var(--muted); font-variant-numeric: tabular-nums; }
.r3d .q .chip { height: 64px; }
.r3d .fields { margin-bottom: 8px; }
.r3d .frow { display: flex; align-items: center; gap: 32px; }
.r3d .fld { display: flex; flex-direction: column; justify-content: center; height: 72px; min-width: 64px; }
.r3d .fld.bare { height: 48px; }
.r3d .fld .sub { font-size: 15px; color: var(--muted); line-height: 1.35; }
.r3d .fld .num { font-family: var(--serif); font-size: 28px; line-height: 1.3; font-variant-numeric: tabular-nums; border-bottom: 1px solid transparent; min-width: 56px; }
.r3d .fld.on .num { border-bottom-color: var(--text); }
.r3d .fld .num.soft { color: var(--muted); }
.r3d .keys { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--ink14); }
.r3d .key { height: 56px; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 28px; line-height: 1; font-variant-numeric: tabular-nums; border-bottom: 1px solid var(--ink14); }
.r3d .key:active { background: var(--ink14); }
.r3d .key.go { font-family: var(--sans); font-size: 17px; justify-content: flex-end; border-bottom-color: transparent; }
.r3d .key.go > span { border-bottom: 1px solid var(--text); line-height: 1.35; }
.r3d .key.del { border-bottom-color: transparent; }
.r3d .pfoot { display: flex; justify-content: flex-end; min-height: 48px; padding-top: 8px; }
.r3d .page { display: none; }
.r3d .app[data-step="cur"] .page { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; width: 420px; height: 100%; padding: 8px 40px 20px 32px; }
.r3d .layers { display: flex; align-items: center; gap: 20px; min-height: 56px; border-bottom: 1px solid var(--text); }
.r3d .layers .chip { position: relative; height: 56px; padding-left: 16px; }
.r3d .layers .act { margin-left: auto; color: var(--muted); }
.r3d .layers .act.open { color: var(--text); }
.r3d .kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; padding: 4px 0; border-bottom: 1px solid var(--ink14); animation: r3d-rise 0.3s cubic-bezier(0.2, 0, 0, 1) backwards; }
.r3d .kinds .chip, .r3d .srow .chip { position: relative; height: 48px; padding-left: 14px; gap: 0; }
.r3d .layers .chip.on::before, .r3d .kinds .chip.on::before, .r3d .srow .chip.on::before { position: absolute; left: 0; top: 50%; margin: -4px 0 0; }
.r3d .shapeblk { margin-top: 28px; }
.r3d .srow { display: flex; align-items: center; gap: 0 16px; width: 100%; min-height: 50px; border-top: 1px solid var(--ink14); }
.r3d .srow.first, .r3d .srow.sub { border-top: 0; }      /* 266번: sub — 위 줄(가로 · 높이)에 딸린 단추 줄 */
.r3d .srow .chip[data-chip=slit], .r3d .srow .chip[data-chip=hem], .r3d .srow .chip[data-chip=tape] { min-width: 48px; }
.r3d .srow.tall { min-height: 56px; }
.r3d .srow .k { width: 64px; flex: none; font-size: 15px; color: var(--muted); white-space: nowrap; }
.r3d .srow .v { position: relative; display: inline-flex; align-items: center; padding-left: 14px; font-family: var(--serif); font-size: 17px; line-height: 1.35; font-variant-numeric: tabular-nums; }
.r3d .srow.on .v::before { content: ''; position: absolute; left: 0; top: 50%; width: 8px; height: 8px; margin-top: -4px; border-radius: 50%; background: var(--point); }
.r3d .srow .ti { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; flex: none; }
.r3d .shint { padding: 0 0 12px 94px; margin-top: -8px; font-size: 15px; color: var(--muted); }
.r3d .leaf { overflow-y: auto; scrollbar-width: none; min-height: 0; }
.r3d .leaf::-webkit-scrollbar { display: none; }
.r3d .chip { display: flex; align-items: center; gap: 14px; height: 72px; flex: none; touch-action: pan-x; cursor: grab; }
.r3d .chip.nd { cursor: pointer; }
.r3d .chip .sw { width: 48px; height: 48px; flex: none; box-shadow: inset 0 0 0 0.5px var(--ink14); }
.r3d .chip .ic { width: 48px; height: 48px; flex: none; display: block; box-shadow: inset 0 0 0 0.5px var(--ink14); }
.r3d .chip .ic svg { display: block; width: 100%; height: 100%; fill: none; stroke: var(--text); stroke-width: 1; }
.r3d .chip .pair { display: flex; flex: none; }
.r3d .chip .tx { display: flex; flex-direction: column; }
.r3d .chip .nm, .r3d .stepper .nm { font-family: var(--serif); font-size: 17px; line-height: 1.35; white-space: nowrap; }
.r3d .chip .sub { font-size: 15px; color: var(--muted); line-height: 1.35; white-space: nowrap; font-variant-numeric: tabular-nums; }
.r3d .chip.on::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--point); margin-right: -6px; flex: none; }
.r3d .chip.lifted { opacity: 0.25; }
.r3d .chip.off { color: var(--muted); pointer-events: none; }
.r3d .stepper { display: flex; align-items: center; gap: 4px; flex: none; }
.r3d .stepper .nm { min-width: 40px; text-align: center; font-variant-numeric: tabular-nums; }
.r3d .stepper .sub { font-size: 15px; color: var(--muted); margin-right: 4px; white-space: nowrap; }
.r3d .pm { position: relative; width: 48px; height: 48px; flex: none; }
.r3d .pm::before { content: ''; position: absolute; inset: 8px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--ink45); }
.r3d .pm::after { content: attr(data-g); position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 17px; line-height: 1; }
.r3d .pm.off { opacity: 0.3; pointer-events: none; }
.r3d .shape { position: absolute; left: 48px; top: 24px; display: flex; align-items: center; gap: 0 24px; flex-wrap: wrap; max-width: calc(100% - 300px); padding: 0 8px; background: var(--bg); box-shadow: 0 0 0 8px var(--bg), 0 0 0 8.5px var(--ink14); }
.r3d .shape .chip { height: 56px; }
.r3d .gap { width: 1px; height: 40px; background: var(--ink14); flex: none; }
.r3d .lamp { position: absolute; left: 48px; bottom: 24px; display: flex; align-items: center; gap: 0 16px; flex-wrap: wrap; max-width: calc(100% - 96px); padding: 0 8px; background: var(--bg); box-shadow: 0 0 0 8px var(--bg), 0 0 0 8.5px var(--ink14); animation: r3d-rise 0.3s cubic-bezier(0.2, 0, 0, 1) backwards; }
.r3d .lamp .k { font-size: 15px; color: var(--muted); white-space: nowrap; }
.r3d .lamp .chip { position: relative; height: 48px; min-width: 48px; padding-left: 14px; gap: 8px; }
.r3d .lamp .chip.on::before { position: absolute; left: 0; top: 50%; margin: -4px 0 0; }
.r3d .lamp .chip i { width: 16px; height: 16px; flex: none; box-shadow: inset 0 0 0 0.5px var(--ink45); }
.r3d .lamp .note { margin-left: 8px; font-size: 15px; color: var(--muted); white-space: nowrap; }
.r3d .hung { display: flex; align-items: center; gap: 14px; min-height: 80px; padding: 12px 0; border-top: 1px solid var(--ink14); }
.r3d .hung .sw { display: block; width: 56px; height: 56px; flex: none; box-shadow: inset 0 0 0 0.5px var(--ink14); }
.r3d .hung .sw svg { display: block; width: 100%; height: 100%; }
.r3d .lvi { position: relative; display: block; width: 100%; height: 100%; overflow: hidden; }
.r3d .lvi i { position: absolute; inset: 0; }
.r3d .lvi .scn { inset: -8px; background: var(--scn, #dde5ea) center 62% / cover; }
.r3d .hung .tx { display: flex; flex-direction: column; min-width: 0; }
.r3d .hung .nm { font-family: var(--serif); font-size: 17px; line-height: 1.35; word-break: keep-all; }
.r3d .hung .sub { font-size: 15px; color: var(--muted); line-height: 1.35; word-break: keep-all; }
.r3d .pdoor { display: flex; justify-content: flex-end; border-top: 1px solid var(--ink14); padding-top: 4px; }
@keyframes r3d-rise {from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; }}
@keyframes r3d-fadein {from { opacity: 0; } to { opacity: 1; }}
.r3d .next { font-size: 17px; flex: none; }
.r3d .ghost { position: fixed; left: 0; top: 0; width: 56px; height: 56px; z-index: 100; pointer-events: none; box-shadow: inset 0 0 0 0.5px var(--ink14), 0 10px 28px rgba(43, 34, 26, 0.2); }
@media (max-width: 720px) {
  .r3d .app { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto auto; }
  .r3d .head { padding: 8px 20px 0; gap: 0 12px; flex-wrap: wrap; }
  .r3d h1, .r3d h2 { font-size: 22px; }
  .r3d .act { height: 40px; }
  .r3d .spaces { gap: 12px; }
  .r3d .steps { margin-left: -14px; width: 100%; }
  .r3d .steps .act { padding: 0 14px; }
  .r3d .steps .act.on::before { left: 0; }
  .r3d .steps .rule { width: 10px; }
  .r3d .tools { margin-left: -12px; padding-left: 0; width: calc(100% + 12px); }
  .r3d .tool { height: 44px; }
  .r3d .tool.on::after { bottom: 1px; }
  .r3d .tsep { margin: 0 4px; }
  .r3d .panel { grid-column: 1; grid-row: 3; width: auto; height: 48vh; border-left: 0; border-top: 1px solid var(--ink14); }
  .r3d .app[data-step="cur"] .panel { width: auto; height: 50vh; }
  .r3d .app[data-step="cur"] .page { width: auto; padding: 0 20px 8px; }
  .r3d .layers { gap: 14px; min-height: 48px; }
  .r3d .layers .chip { height: 48px; }
  .r3d .app[data-step="cur"] .board { display: none; }
  .r3d .pin { width: auto; padding: 0 20px 8px; }
  .r3d .q { padding-top: 12px; }
  .r3d .fld { height: 60px; }
  .r3d .fld .num { font-size: 22px; }
  .r3d .key { height: 44px; font-size: 22px; }
  .r3d .board { right: 20px; top: 16px; width: 104px; height: 104px; }
  .r3d .shape { left: 20px; top: 132px; gap: 0 12px; max-width: calc(100% - 40px); padding: 0 4px; }
  .r3d .stepper { gap: 0; }
  .r3d .stepper .nm { min-width: 32px; }
  .r3d .lamp { left: 20px; bottom: 8px; max-width: calc(100% - 40px); gap: 0 10px; padding: 0 4px; }
  .r3d .lamp .k { display: none; }
  .r3d .lamp .note { width: 100%; margin: 0 0 6px; }
}
.r3d .r3d-wait { position: absolute; inset: 0; z-index: 30; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 40px; background: var(--bg); color: var(--muted); text-align: center; }
.r3d.r3d-loading .r3d-wait, .r3d.r3d-fail .r3d-wait { display: flex; }
.r3d.r3d-loading .r3d-msg::after { content: ''; display: block; width: 8px; height: 8px; margin: 16px auto 0; border-radius: 50%; background: var(--point); animation: r3d-pulse 1.2s ease-in-out infinite; }
@keyframes r3d-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
.r3d .r3d-wait .act { justify-content: center; }
.r3d .ghost { z-index: 40; }
@media (prefers-reduced-motion: reduce) { .r3d .piece, .r3d .board, .r3d .panel, .r3d .tools, .r3d .steps { transition: none; } .r3d .kinds, .r3d .lamp, .r3d.r3d-loading .r3d-msg::after { animation: none; } }
/* 260번: 손님용(r3d-guest) — 머리의 순서 · 도구, 오른쪽 장, 방 위의 손잡이 · 색 조각 · 모양 줄 · 등 줄을 숨기고 방을 화면 가득, 아래는 종이 띠(후보 · 이유 한 줄 · 이걸로 할게요) */
.r3d.r3d-guest .head, .r3d.r3d-guest .panel, .r3d.r3d-guest .over, .r3d.r3d-guest .board, .r3d.r3d-guest .shape, .r3d.r3d-guest .lamp { display: none !important; }
.r3d .gtop, .r3d .gband, .r3d .gnote { display: none; }
.r3d.r3d-guest .gtop { display: flex; position: absolute; left: 0; right: 0; top: 0; z-index: 3; align-items: center; gap: 8px; padding: 16px 28px; pointer-events: none; }
.r3d.r3d-guest .gtop > * { pointer-events: auto; }
.r3d .gtop .gb { height: 44px; padding: 0 14px; background: rgba(251, 249, 245, 0.9); font-size: 15px; color: var(--muted); }
.r3d .gtop .gb.on { color: var(--text); box-shadow: inset 0 -1px 0 var(--text); }
.r3d .gtop .gback { font-family: var(--serif); font-size: 17px; color: var(--text); }
.r3d .gtop .gsp { flex: 1; }
.r3d.r3d-guest .gnote { display: block; position: absolute; right: 28px; bottom: 12px; z-index: 3; padding: 2px 8px; background: rgba(251, 249, 245, 0.85); font-size: 13px; color: var(--muted); pointer-events: none; }
.r3d.r3d-guest .gband { display: grid; grid-column: 1 / -1; grid-row: 3; grid-template-columns: auto minmax(0, 1fr) auto; gap: 36px; align-items: start; min-height: 168px; padding: 26px 40px 24px; border-top: 1px solid var(--ink14); background: var(--bg); }
.r3d .grows { display: grid; grid-template-columns: auto auto; column-gap: 18px; row-gap: 32px; align-items: center; }
.r3d .grows .k { font-size: 14px; color: var(--muted); }
.r3d .gc { display: flex; gap: 10px; }
.r3d .gc button { position: relative; width: 48px; height: 48px; border: 0.5px solid var(--ink14); overflow: visible; }
.r3d .gc button .lvi { position: absolute; inset: 0; }
.r3d .gc button.on::after { content: ''; position: absolute; left: 50%; bottom: -12px; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: var(--point); }
.r3d .gc button.was::before { content: '처음'; position: absolute; left: -4px; right: -4px; top: -19px; font-size: 11px; line-height: 1.4; color: var(--muted); text-align: center; }
.r3d .gwhy { min-width: 0; padding-top: 2px; }
.r3d .gwhy h3 { font-family: var(--serif); font-weight: 400; font-size: 24px; line-height: 1.3; letter-spacing: -0.02em; }
.r3d .gwhy p { margin-top: 6px; font-size: 16px; color: var(--muted); }
.r3d .gwhy .gfab { margin-top: 10px; font-size: 14px; color: var(--muted); }
.r3d .gwhy .gfab span { border-bottom: 1px solid var(--ink45); }
.r3d .gok { align-self: end; height: 48px; font-family: var(--serif); font-size: 22px; }
.r3d .gok span { border-bottom: 1px solid var(--text); }
/* 260번: 멈춘 그림(r3d-still) — 화면 밖에서 마무리 화면의 공간 그림 크기로 한 장만 그린다(보이지도 눌리지도 않음) */
.r3d.r3d-still { left: -20000px; top: 0; right: auto; bottom: auto; width: 520px; height: 350px; opacity: 0; pointer-events: none; }
.r3d.r3d-still .gtop, .r3d.r3d-still .gband, .r3d.r3d-still .gnote, .r3d.r3d-still .r3d-wait { display: none !important; }`;
  var MARKUP = "<div class=\"app\" id=\"r3d-app\" data-step=\"measure\"><header class=\"head\"><button class=\"act\" id=\"r3d-back\" type=\"button\"><span>뒤로</span></button><div class=\"spaces\" id=\"r3d-spaces\"></div><nav class=\"steps\" aria-label=\"순서\"><button class=\"act on\" data-step=\"measure\" type=\"button\"><span>측정</span></button><i class=\"rule\"></i><button class=\"act off\" data-step=\"cur\" type=\"button\"><span>선택</span></button></nav><div class=\"tools\" role=\"toolbar\" aria-label=\"보는 방법\"><button class=\"tool off\" id=\"r3d-undo\" type=\"button\" aria-label=\"되돌리기\" title=\"되돌리기\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8.5 5 4 9.5l4.5 4.5\"/><path d=\"M4 9.5h10.25a5.25 5.25 0 0 1 0 10.5H11\"/></svg></button><i class=\"tsep\"></i><button class=\"tool\" id=\"r3d-furs\" type=\"button\" aria-label=\"가구 숨기기\" title=\"가구 숨기기\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><g class=\"bd\"><path d=\"M5 11V7.5A1.5 1.5 0 0 1 6.5 6h11A1.5 1.5 0 0 1 19 7.5V11\"/><path d=\"M3 12.5a2 2 0 0 1 4 0V14h10v-1.5a2 2 0 0 1 4 0V17H3z\"/><path d=\"M5 17v2M19 17v2\"/></g><path class=\"sl\" d=\"M4 3.5l16 17\"/></svg></button><i class=\"tsep\"></i><button class=\"tool on\" data-night=\"0\" type=\"button\" aria-label=\"낮으로 보기\" title=\"낮\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3.75\"/><path d=\"M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.46 5.46l1.42 1.42M17.12 17.12l1.42 1.42M5.46 18.54l1.42-1.42M17.12 6.88l1.42-1.42\"/></svg></button><button class=\"tool\" data-night=\"1\" type=\"button\" aria-label=\"밤으로 보기\" title=\"밤\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z\"/></svg></button><i class=\"tsep\"></i><button class=\"tool on\" data-view=\"top\" type=\"button\" aria-label=\"위에서 보기\" title=\"위에서\" aria-pressed=\"true\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l8 4.5v9L12 21l-8-4.5v-9z\"/><path d=\"M4 7.5l8 4.5 8-4.5M12 12v9\"/></svg></button><button class=\"tool\" data-view=\"eye\" type=\"button\" aria-label=\"눈높이로 보기\" title=\"눈높이\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12z\"/><circle cx=\"12\" cy=\"12\" r=\"2.75\"/></svg></button></div></header><main class=\"stage\" id=\"r3d-stage\"><canvas id=\"r3d-gl\" aria-label=\"공간 모형\"></canvas><div class=\"over\" id=\"r3d-over\"></div><div class=\"board\" id=\"r3d-board\" aria-hidden=\"true\"></div><div class=\"shape\" id=\"r3d-shape\" hidden></div><div class=\"lamp\" id=\"r3d-lamp\" hidden></div></main><aside class=\"panel\" id=\"r3d-panel\"><div class=\"pin\"><div class=\"rec\" id=\"r3d-rec\"></div><div class=\"q\" id=\"r3d-q\" hidden></div><div class=\"pfoot\"><button class=\"act next\" id=\"r3d-pnext\" type=\"button\"><span>다음 →</span></button></div></div><div class=\"page\"><div class=\"phead\"><div class=\"layers\" id=\"r3d-layers\"></div><div class=\"kinds\" id=\"r3d-kinds\" hidden></div></div><div class=\"leaf\" id=\"r3d-tray\"></div><div class=\"pfoot\"><button class=\"act next\" id=\"r3d-next\" type=\"button\"><span>다음 →</span></button></div></div></aside></div><div class=\"r3d-wait\" role=\"status\"><p class=\"r3d-msg\">입체 방을 준비하고 있습니다</p><button type=\"button\" class=\"act next r3d-close\" hidden><span>닫기</span></button></div>";
  var ROOT = null, ENG = null, OPEN = false, OPTS = null, TOKEN = 0, loadP = null, styled = false;
  // 260번: 손님용 머리 줄 — 마무리로(바꾼 것 안 넣음) · 낮/밤 · 걷기/치기. 창밖 한 줄은 지금 그대로(사진)
  var GUEST_TOP = '<div class="gtop" id="r3d-gtop"><button type="button" class="gb gback" data-g="back">← 마무리로</button><span class="gsp"></span>'
    + '<button type="button" class="gb" data-g="day">낮</button><button type="button" class="gb" data-g="night">밤</button>'
    + '<button type="button" class="gb" data-g="open">걷기</button><button type="button" class="gb" data-g="close">치기</button></div>'
    + '<p class="gnote">창밖은 그림입니다.</p>';      // 263번: 창밖이 그림 층(결정 #409의 문장)
  var STILL = 0;      // 260번: 멈춘 그림을 그리는 중이면 그 차례 번호(0 = 아님)
  function ensureStyle() { if (styled) return; var s = document.createElement('style'); s.id = 'r3d-style'; s.textContent = CSS; document.head.appendChild(s); styled = true; }
  function ensureRoot() {
    if (ROOT) return ROOT;
    ROOT = document.createElement('div'); ROOT.className = 'r3d'; ROOT.setAttribute('role', 'dialog'); ROOT.setAttribute('aria-modal', 'true'); ROOT.setAttribute('aria-label', '입체 방');
    ROOT.innerHTML = MARKUP;
    ROOT.style.setProperty('--scn', 'url(' + flatScene().toDataURL('image/png') + ')');      // 263번: 장의 작은 그림도 같은 그림 층
    ROOT.querySelector('#r3d-stage').insertAdjacentHTML('beforeend', GUEST_TOP);      // 260번: 손님용 머리 줄 · 창밖 한 줄
    ROOT.querySelector('#r3d-app').insertAdjacentHTML('beforeend', '<div class="gband" id="r3d-gband"></div>');      // 260번: 손님용 아래 띠      // 장의 비침 작은 그림이 같은 사진을 쓴다
    ROOT.querySelector('.r3d-close').addEventListener('click', function () { close(); });
    ROOT.querySelector('#r3d-back').addEventListener('click', function () { if (!ENG || !ENG.alive()) close(); });      // 그림 엔진이 서기 전(받는 중 · 못 받음)에도 머리의 '뒤로'로 나간다
    return ROOT;
  }
  function loadThree() {      // 처음 열 때만 받는다 — 받는 동안 '준비하고 있습니다'
    if (window.THREE && window.THREE.WebGLRenderer) return Promise.resolve();
    if (loadP) return loadP;
    loadP = new Promise(function (ok, no) {
      var s = document.createElement('script'), t = setTimeout(function () { loadP = null; no(new Error('10초 안에 받지 못함')); }, 10000);      // 느린 인터넷 — 10초면 '인터넷 연결을 확인해 주세요' + 닫기(늦게라도 받으면 다음 열 때 바로 쓴다)
      s.src = THREE_URL; s.async = true;
      s.onload = function () { clearTimeout(t); if (window.THREE && window.THREE.WebGLRenderer) ok(); else { loadP = null; no(new Error('THREE 없음')); } };
      s.onerror = function () { clearTimeout(t); loadP = null; if (s.parentNode) s.parentNode.removeChild(s); no(new Error('three.js를 받지 못함')); };
      document.head.appendChild(s);
    });
    return loadP;
  }
  // ───────── 입체 방 엔진 — 19판 그대로 옮김(앱이 맡는 공간 화면 · 묻기 · 원단 화면 · 제안은 뺐다). root 안에서만 찾고, 귀도 root에만 단다 ─────────
  function makeEngine(root) {
  var THREE = window.THREE;
  function $(id) { return root.querySelector('#r3d-' + id); }
  var app = $('app'), stage = $('stage'), canvas = $('gl');
  var over = $('over'), board = $('board'), tray = $('tray'), shape = $('shape');
  var rec = $('rec'), qbox = $('q'), pnext = $('pnext'), spacesEl = $('spaces'), layersEl = $('layers');
  var lampEl = $('lamp');
  var nextBtn = $('next'), backBtn = $('back'), undoBtn = $('undo'), fursBtn = $('furs'), kindsEl = $('kinds');
  var CALM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (err) { return null; }      // 그리는 판은 한 번만 만든다 — 열 때마다 다시 쓴다
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // 258번: 앱에서 받은 것 — HOST 공간 이름 · LAYER 겹마다 고른 원단 { name, hex, density, blindKind, band } · FIXED 품목이 있어 구성을 여기서 바꾸지 않음 · BKFIX 블라인드 종류를 원단이 정함
  var HOST = { name: '' }, LAYER = { drape: null, sheer: null, blind: null }, FIXED = false, BKFIX = false;
  var ALIVE = false, SESSION = 0, SIG = '', MSIG = null, SEED = null, ONFIN = null, DELTA = {};
  var CURI = null;      // 266번: 앱 품목의 커튼 크기 { w, h (m), need: 선택에서 품목 크기로 맞출지, hand: 커튼 크기를 손으로 바꿨는지 }
  var GUEST = null, QUICK = false;      // 260번: GUEST 손님용 { d · s: 후보 목록(겉지 · 속지), di · si: 지금 건 후보, d0 · s0: 처음 후보, last: 마지막에 누른 겹 } · QUICK 움직임 없이(멈춘 그림)      // DELTA: 손으로 바꾼 크기(cm) — cur 커튼 한 벌 · blind 블라인드 { w, h }
  function on(type, fn) { root.addEventListener(type, fn); }      // 귀는 root에만 — 닫으면 root가 화면에서 떨어져 아무것도 듣지 않는다
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // ───── 색 (Lab) ─────
  function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function rgb2lab(c) {
    var v = c.map(function (x) { x /= 255; return x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92; });
    var X = (v[0] * 0.4124564 + v[1] * 0.3575761 + v[2] * 0.1804375) / 0.95047;
    var Y = (v[0] * 0.2126729 + v[1] * 0.7151522 + v[2] * 0.0721750);
    var Z = (v[0] * 0.0193339 + v[1] * 0.1191920 + v[2] * 0.9503041) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var fx = f(X), fy = f(Y), fz = f(Z);
    return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
  }
  function lab2hex(l) {
    var fy = (l.L + 16) / 116, fx = l.a / 500 + fy, fz = fy - l.b / 200;
    function fi(t) { var t3 = t * t * t; return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787; }
    var X = fi(fx) * 0.95047, Y = fi(fy), Z = fi(fz) * 1.08883;
    var rgb = [X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314, X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560, X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252];
    return '#' + rgb.map(function (x) {
      x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(x * 255))).toString(16).padStart(2, '0');
    }).join('');
  }
  function lab(h) { return rgb2lab(hex2rgb(h)); }
  function mix(p, q, t) { return { L: p.L + (q.L - p.L) * t, a: p.a + (q.a - p.a) * t, b: p.b + (q.b - p.b) * t }; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function snap(v, s) { s = s || 0.1; return Math.round(v / s) * s; }
  function cm(v) { return Math.round(v * 100); }

  // ───── 견본 (잰 색이 아님 — 실제로는 카드를 대고 잰 색이 들어온다) ─────
  var SAMPLES = {      // 258번: 잰 색이 없을 때만 고르는 견본(확인 전) — 잰 색은 열 때마다 맨 앞에 든다
    wall:  [{ name: '웜 화이트', hex: '#F4EFE6' }, { name: '화이트', hex: '#F5F5F1' }, { name: '그레이지', hex: '#E2DCD1' }, { name: '연한 회색', hex: '#DBDCDA' }],
    floor: [{ name: '내추럴 오크', hex: '#C4A47C' }, { name: '밝은 메이플', hex: '#DBC6A4' }, { name: '월넛', hex: '#7A5A40' }, { name: '회색 타일', hex: '#B8B5AD' }]
  };
  var SURFS = { wall: SAMPLES.wall.slice(), floor: SAMPLES.floor.slice() };
  var SHEERS = [{ n: '맑은 흰색', hex: '#F8F7F3' }, { n: '따뜻한 흰색', hex: '#F4EFE4' }, { n: '아이보리', hex: '#EDE5D4' }];
  var SHEER0 = '#F7F4EE';
  // 속커튼 비침 넷 — 흐림(px) · 덮개. 또렷 → 창 줄 형태 → 덩어리 → 안 보임. 앱 비침 고르기(결정 #361 · 256번)의 값에서 셋째 '낮 가림'만 19판에서 더 가리게 고쳤다(11-25 사장님: 조금 더 안 보이게 — 앱은 14 · 0.66, 실제 적용 때 앱도 같이 맞춘다)
  var LV = ['많이 비침', '은은한 비침', '낮에도 가림', '거의 안 비침'], LVB = [2, 7, 20, 40], LVA = [0.22, 0.48, 0.78, 0.97];
  // 가구 색 — 폰 실측에서 가구를 잴 때 카드와 함께 찍은 사진으로 잰 색이 들어온다(재는 일은 다 폰에서 — 태블릿은 두 손을 쓰기 어렵다, 11-24 사장님). 여기 것은 견본.
  // 태블릿에서 놓은 가구는 색 없이 빗금으로 남고, 색 판 · 조각보에서도 빗금, 색 추천에는 쓰이지 않는다 — 폰에서 재 오면 색이 들어온다
  var FURCOLS = [{ name: '짙은 회색', hex: '#5F5D5A' }, { name: '연한 회색', hex: '#D5CFC6' }, { name: '베이지', hex: '#D9C8AE' }, { name: '밝은 원목', hex: '#B9966B' }, { name: '월넛', hex: '#6E5038' }, { name: '먹색', hex: '#3E3A36' }, { name: '흰색', hex: '#ECEBE7' }, { name: '올리브', hex: '#7D7A5C' }];
  var HATCH_BG = 'var(--hatch), var(--bg)';
  // 가구 — 폰에서 잰 가구는 잰 치수 그대로. 여기서 새로 놓는 가구만 흔한 규격으로 — sizes: 줄마다 한 가지 치수(첫 줄은 방 안에서 가구를 다시 누를 때마다 넘어감). def: 처음 놓일 때의 칸
  var TYPES = {
    sofa:    { name: '소파',    w: 2.1,  d: 0.92, h: 0.82, at: [-9, -0.3], def: [2],
               sizes: [[{ n: '1인', sub: '1.0 m', w: 1.0 }, { n: '2인', sub: '1.6 m', w: 1.6 }, { n: '3인', sub: '2.1 m', w: 2.1 }, { n: '4인', sub: '2.8 m', w: 2.8 }]] },
    bed:     { name: '침대',    w: 1.5,  d: 2.1,  h: 0.95, at: [9, 9], def: [2],
               sizes: [[{ n: '싱글', sub: '1.0 × 2.0 m', w: 1.0 }, { n: '슈퍼싱글', sub: '1.1 × 2.0 m', w: 1.1 }, { n: '퀸', sub: '1.5 × 2.0 m', w: 1.5 }, { n: '킹', sub: '1.6 × 2.0 m', w: 1.6 }, { n: '라지킹', sub: '1.8 × 2.0 m', w: 1.8 }]] },
    table:   { name: '식탁',    w: 1.4,  d: 0.8,  h: 0.74, at: [0.2, 0.3], def: [1],
               sizes: [[{ n: '2인', sub: '0.8 × 0.8 m', w: 0.8, d: 0.8 }, { n: '4인', sub: '1.4 × 0.8 m', w: 1.4, d: 0.8 }, { n: '6인', sub: '1.8 × 0.9 m', w: 1.8, d: 0.9 }, { n: '8인', sub: '2.2 × 1.0 m', w: 2.2, d: 1.0 }]] },
    chair:   { name: '의자',    w: 0.45, d: 0.5,  h: 0.85, at: [0.2, 1.1], def: [0],
               sizes: [[{ n: '식탁 의자', sub: '높이 0.85 m', w: 0.45, d: 0.5, h: 0.85 }, { n: '사무 의자', sub: '높이 1.15 m', w: 0.6, d: 0.6, h: 1.15 }]] },
    desk:    { name: '책상',    w: 1.2,  d: 0.6,  h: 0.72, at: [9, 0.7], def: [1],
               sizes: [[{ n: '폭 1.0 m', w: 1.0, d: 0.6 }, { n: '폭 1.2 m', w: 1.2, d: 0.6 }, { n: '폭 1.4 m', w: 1.4, d: 0.7 }, { n: '폭 1.6 m', w: 1.6, d: 0.8 }, { n: '폭 1.8 m', w: 1.8, d: 0.8 }]] },
    cab:     { name: '수납장',  w: 1.2,  d: 0.45, h: 0.85, at: [9, -0.8], def: [1, 1],
               sizes: [[{ n: '폭 0.8 m', w: 0.8 }, { n: '폭 1.2 m', w: 1.2 }, { n: '폭 1.6 m', w: 1.6 }, { n: '폭 2.0 m', w: 2.0 }],
                       [{ n: '높이 0.45 m', h: 0.45 }, { n: '높이 0.85 m', h: 0.85 }, { n: '높이 1.2 m', h: 1.2 }]] },
    display: { name: '장식장',  w: 0.9,  d: 0.4,  h: 1.8,  at: [-9, 1.3], def: [1, 1],
               sizes: [[{ n: '폭 0.6 m', w: 0.6 }, { n: '폭 0.9 m', w: 0.9 }, { n: '폭 1.2 m', w: 1.2 }, { n: '폭 1.6 m', w: 1.6 }],
                       [{ n: '높이 1.2 m', h: 1.2 }, { n: '높이 1.8 m', h: 1.8 }, { n: '높이 2.1 m', h: 2.1 }]] },
    aircon:  { name: '에어컨',  w: 0.36, d: 0.36, h: 1.85, at: [9, -9], round: true }
  };
  var TYPE_ORDER = ['sofa', 'bed', 'table', 'chair', 'desk', 'cab', 'display', 'aircon'];
  var BG = '#fbf9f5', INK = 0x2b221a, MODEL = '#ddd6ca';
  var ZS = 0.05, ZD = 0.125, ZB = 0.03;      // 창 벽에서 속커튼 · 겉커튼 · 블라인드까지의 거리
  // ───── 순서와 질문 ─────
  // 묻기는 손님에게(높임 질문 · 손님 말투 답), 재기는 사장님 손(짧은 이름). 묻기의 질문 · 답은 현행 앱 문장 그대로(결정 #402) — concierge.js 2-Base-Block · 2-Base-Privacy · 0.5-House-Taste · 0.6-House-Tex · 2-Base-SheerFeel · 2-Base-BlindKind
  // 차례(공간마다): 빛 → 시선 → 느낌 → (겉지가 걸리면) 겉지 질감 → (속지가 걸리면) 속지 질감 → (블라인드면) 블라인드 종류. 질감은 집에 한 번(시안 값 — 사장님 판단 기다림), 느낌 · 블라인드 종류는 공간마다(결정 #403)
  // 구성은 묻지 않는다(결정 #397) — 폰에서 들어온 값이 먼저, 없으면 묻기 답으로 권하는 구성. 바꾸는 곳은 고르기 장 머리
  var STEPS = ['measure', 'cur'];      // 258번: 질문(묻기)은 앱의 질문 화면이 맡는다 — 입체 방은 측정 · 선택만
  var Q = { ask: [], measure: ['room', 'win', 'box', 'dir', 'color', 'fur'] };
  var SPACE_TYPES = ['거실', '안방', '작은방', '아이방', '서재', '주방', '베란다', '알파룸', '드레스룸'];
  var KINDS = [['double', '이중 커튼'], ['drape', '겉커튼만'], ['sheer', '속커튼만'], ['blind', '블라인드']];
  var OPT = {      // [값, 누르는 말, 들은 말(명사형)]
    box: [['y', '있음', '있음'], ['n', '없음', '없음']],
    dir: [['동', '동'], ['서', '서'], ['남', '남'], ['북', '북']],
    light: [['ok', '들어와도 괜찮아요', '들어와도 괜찮음'], ['soft', '적당히 가려 주세요', '적당히 가림'], ['dark', '완전히 어둡게요', '완전히 어둡게']],
    gaze: [['ok', '괜찮아요', '괜찮음'], ['some', '조금 신경 쓰여요', '조금 신경 쓰임'], ['high', '많이 신경 쓰여요', '많이 신경 쓰임']],
    feel: [['blend', '넓어 보이게요', '넓어 보이게'], ['weight', '차분하게요', '차분하게'], ['point', '포인트 있게요', '포인트 있게']],
    dtex: [['smooth', '매끈한'], ['weave', '짜임이 보이는'], ['soft', '보송한']],
    stex: [['smooth', '매끈한'], ['weave', '짜임이 보이는'], ['linen', '린넨'], ['any', '잘 모르겠어요']],
    bkind: [['combi', '콤비'], ['roll', '롤'], ['wood', '우드'], ['alu', '알루미늄'], ['any', '잘 모르겠어요']]
  };
  function topic() { return ''; }      // 258번: 한 공간만 다룬다
  function title(k) {
    var tp = topic(), nm = HOST.name || A.type || '', bl = (A.kind || recKind()) === 'blind';
    switch (k) {
      case 'type': return '어느 공간의 창인가요?';
      case 'room': return '공간 크기'; case 'win': return '창 크기'; case 'box': return '커튼박스'; case 'dir': return '창 방향';
      case 'color': return '벽 · 바닥 색'; case 'fur': return '큰 가구';
      case 'light': return tp ? tp + ' 빛을 어느 정도 가릴까요?' : '빛은 어느 정도 가릴까요?';
      case 'gaze': return tp ? tp + ' 바깥 시선을 어느 정도 가릴까요?' : '바깥 시선은 어느 정도 가릴까요?';
      case 'feel': return (nm ? nm + ' ' : '') + (bl ? '블라인드는' : '커튼은') + ' 어떤 분위기가 좋으세요?';
      case 'dtex': return '겉커튼은 어떤 질감이 좋으세요?';
      case 'stex': return '속커튼은 어떤 질감이 좋으세요?';
      case 'bkind': return nm ? nm + '에는 어떤 블라인드가 좋으세요?' : '어떤 블라인드가 좋으세요?';
      default: return '';
    }
  }
  function label(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][2] || list[i][1]; return ''; }

  // ───── 지금 공간의 상태 (미터) ─────
  var R = { W: 4.2, D: 3.6, H: 2.4, T: 0.18 };      // T: 벽 두께 — 샷시가 들어앉을 만큼
  var WINS = [{ w: 2.4, sill: 0.1, top: 2.2, x: 0, wall: 0 }];      // 창들 — wall: 0 창 벽 · 1 오른쪽 벽 · 3 왼쪽 벽 / x: 그 벽 가운데에서 옆으로 떨어진 거리
  // 커튼박스는 벽마다 — 천장 속으로 파인 자리 (k: 0 없음 → 1 다 생김 · h: 파인 깊이 = 바닥에서 박스 안 천장까지 − 천장 높이 · d: 앞뒤 폭). 창이 있는 벽의 것만 쓰인다
  var BOXES = [0, 1, 2, 3].map(function () { return { on: false, k: 0, h: 0.12, d: 0.18, tk: 0, len: null, at: null }; }), NOBOX = { on: false, k: 0, h: 0, d: 0, len: null, at: null };      // len: 박스 길이 — null이면 벽 끝에서 벽 끝까지(대개 그렇다) · at: 박스 왼쪽 끝 자리(벽 가운데 기준) — null이면 그 벽 창들의 가운데. 방에서 박스를 끌어 옮긴다 (11-24 사장님: 신축 안방은 한쪽 벽에 붙은 박스가 흔하다 — 결정 #393)
  // 블라인드 종류(17판, 결정 #404) — 방이 종류마다 다르게 그려진다. band: 콤비의 줄무늬(막힌 띠 · 비치는 띠) / slat: 살 간격 / tape: 살을 잇는 띠의 폭 / strong: 살 선을 또렷이 / own: 윗상자가 살과 같은 색
  // cas: 윗상자 [높이, 앞뒤] · box: 커튼박스 안에 달 수 있는 박스 앞뒤 폭 (270번) — 앞뒤는 제품 자체, box는 작업 공간까지 생각한 폭. 둘 다 사장님 실측(11-25, 글 #570 · 결정 #400). 높이는 시안 값
  var BK = {
    combi: { n: '콤비', band: [0.075, 0.05], cas: [0.07, 0.09], box: 0.11 },
    roll:  { n: '롤', cas: [0.05, 0.055], box: 0.07 },
    wood:  { n: '우드', slat: 0.05, tape: 0.038, strong: true, own: true, cas: [0.05, 0.08], box: 0.10 },
    alu:   { n: '알루미늄', slat: 0.025, own: true, cas: [0.03, 0.05], box: 0.08 }
  }, BKO = ['combi', 'roll', 'wood', 'alu'];
  // 살(18판) — w: 살 폭(살 간격의 배수, 닫히면 조금씩 겹친다) · th: 두께 · st: 걷어 올려 쌓일 때 한 장의 높이 · rail: 밑단 막대 높이 · back: 뒤 테두리 선 · ends: 살 끝 선. 모두 시안 값
  var SLAT = { wood: { w: 1.1, th: 0.003, st: 0.004, rail: 0.03, back: true, ends: true, soft: true, glow: [0.1, 0.035] }, alu: { w: 1.1, th: 0, st: 0.0012, rail: 0.02, back: false, ends: false, soft: false, glow: [0.12, 0.04] } };      // glow(19판): 살에 번지는 빛 [창 쪽 끝이 밝아지는 정도, 방 쪽 끝이 옅게 가라앉는 정도] · soft: 부드럽게 번지는지(우드) 또렷한 띠인지(알루미늄)
  // 콤비 띠 크기(19판, 결정 #405) — 실제로는 원단마다 막힌 띠(솔리드) · 비치는 띠(쉬어) 크기가 다르다. 책자 칩마다 제 값으로 그린다(아래 셋은 시안 예시 — 사장님 측정). 칩을 안 골랐으면 BK.combi.band
  var CBAND = [[0.1, 0.075], [0.05, 0.03], [0.125, 0.075]];
  function bandNow() { return (LAYER.blind && LAYER.blind.band) || BK.combi.band; }      // 258번: 고른 콤비 원단의 띠 크기(원단 비고의 mm) — 없으면 시안 값
  var SLCLOSE = 75 * Math.PI / 180, SLK = [0.93, 0.965, 0.9, 0.975], BACKK = 0.95;      // 닫힌 살의 기울기 · 밝기(아랫면 · 앞 테두리 · 뒤 테두리와 뒤 띠 · 앞 띠) · 콤비 뒤 겹의 밝기 — 주름이 쓰는 정도까지만
  var SLITS = { slat: [[0, '닫힘'], [0.5, '반쯤'], [1, '열림']], band: [[0, '닫힘'], [1, '열림']] };      // 빛 조절 줄 — 살은 셋, 콤비는 둘(겹치지 않음 · 겹침)
  function slitKind() { var k = bkNow(); return SLAT[k] ? 'slat' : BK[k].band ? 'band' : null; }
  function blThru() { var k = slitKind(); return k === 'slat' ? 0.8 * SLV : k === 'band' ? 0.35 * SLV : 0; }      // 내린 블라인드를 지나 드는 빛
  function blOpen() { return C.open + (1 - C.open) * blThru(); }
  var HEM = 0.10, HEMK = 0.972;      // 밑단 시접 10 cm (11-25 사장님) · 접힌 자리(두 겹)의 밝기
  function bkNow() { return BK[A.bkind] ? A.bkind : 'combi'; }      // 아직 못 고른 공간('잘 모르겠어요')은 콤비가 걸린 채로 열린다(시안 값) — 장의 종류 줄에서 넷을 걸어 보며 고른다
  function boxSeg(i) {      // 커튼박스가 벽을 따라 차지하는 자리 [a, b] — 길이를 따로 쟀으면 그 벽 창들의 가운데에 놓는다(벽 안으로)
    var L = wlen(i), b = BOXES[i], n = b.len;
    if (n == null || n >= L - 0.005) return { a: -L / 2, b: L / 2, full: true };
    var lo = Infinity, hi = -Infinity; WINS.forEach(function (w) { if (w.wall === i) { lo = Math.min(lo, w.x - w.w / 2); hi = Math.max(hi, w.x + w.w / 2); } });
    var c = lo < hi ? (lo + hi) / 2 : 0, a = clamp(b.at != null ? b.at : c - n / 2, -L / 2, L / 2 - n);
    return { a: a, b: a + n, full: false, auto: c - n / 2 };
  }
  function bx(i) { return WINS.some(function (w) { return w.wall === i; }) ? BOXES[i] : NOBOX; }
  // open: 0 다 침 → 1 다 걷음 · pleat: wave 일반 주름 / nabi 나비주름
  // sz: 커튼 한 벌마다의 크기(묶음 열쇠 → { w 가로 · full 벽 전체 · top 다는 높이 · bot 아랫단 · pok 폭수 }) · bl: 블라인드 한 장마다({ w 가로 · bot 아랫단 })
  // 손대기 전에는 비어 있고 창을 보고 권하는 크기가 걸린다. 손댄 값은 창과 따로 남아 그 커튼 · 블라인드의 크기가 된다 (11-24 사장님) — 1 cm 단위
  // sl: 속커튼 비침 단계(0 많이 비침 … 3 중지) · sf: 속커튼 원단(결:번호) · open0: 속커튼을 볼 때 걷어 둔 겉커튼을 되돌릴 자리
  var C = { open: 0.55, pleat: 'wave', bat: null, join: false, sz: {}, bl: {}, sl: null, sf: null, open0: null, slit: 0, lead: false, sopen: 0, dlead: false, tape: false, lamp: 'cool' };      // slit(18판): 블라인드 빛 조절 0 닫힘 → 1 열림(우드 · 알루미늄은 살 기울기, 콤비는 두 겹의 겹침) · lead: 속지 밑단이 리드밴드인지(아니면 시접)
  // 19판 — sopen: 속지를 걷은 정도(0 다 침 → 1 다 걷음, 겉지의 open과 따로) · dlead: 겉지 밑단이 리드밴드인지 · tape: 우드의 살 사이가 리본밴드인지(아니면 실) · DHEMV: 지금 그려진 겉지 시접
  var SLV = 0, SLID = 0, HEMV = 1, DHEMV = 1, HEMID = 0;      // SLV: 지금 그려진 빛 조절 값 — C.slit으로 부드럽게 옮겨 간다 · HEMV: 지금 그려진 속지 시접(1 시접 10 cm → 0 없음 · 리드밴드)      // bat: 블라인드 다는 자리 — 커튼박스가 있으면 박스 안이 먼저, 'win'이면 창틀
  // 들은 말 — room · win · fur: 적었는지 / box: 'y' · 'n' / dir: ['남', '동'] / kind: double · drape · sheer · blind / pref: 'rec'이면 구성을 정하지 않고 권하는 것을 받는다
  var A = { type: null, room: false, win: false, box: null, dir: null, fur: false, light: null, gaze: null, kind: null, pref: null, feel: null, bkind: null, asked: false };      // bkind: 블라인드 종류 · asked: 이 공간의 묻기를 한 번 마쳤는지
  var HOUSE = { dtex: null, dtexAt: null, stex: null, stexAt: null };      // 집에 한 번 묻는 것 — 겉지 질감 · 속지 질감(At: 물은 공간)
  // part: 고르기에서 지금 고르는 것(drape 겉커튼 · sheer 속커튼) · cmp: 속커튼 비침 넷을 나란히 견주는 중 · dtex: 겉커튼 결 줄 · stex: 속커튼 느낌 줄
  var S = { step: 'measure', q: null, wall: null, floor: null, items: [], seq: 0, cand: null, candName: null, fabric: null, settled: false, sel: null, view: 'top', hideFur: false, night: false, wsel: 0, csel: 0, part: 'drape', cmp: true, dtex: null, stex: null, fv: null, kopen: false };      // kopen: 장 머리의 '구성 바꾸기'가 펼쳐져 있는지      // fv: 열려 있는 원단 화면({ kind 겉지 · 속지, view sheet 비침 네 폭 · open 원단 사진, lv 비침 단계, i 보는 원단 })      // wsel: 고른 창(블라인드면 고른 블라인드) · csel: 고른 커튼 한 벌
  var V = { t: 0, az: 0.62, el: 0.6, yaw: 0, rad: 0, h: 0, hy: 0, s: 0 };          // t: 0 위에서 내려다봄 → 1 눈높이 · h: 0 → 1 밑단 보기 · hy: 밑단 둘레로 돈 각 · s: 0 → 1 속커튼 볼 때 창 앞으로 다가감
  var RISE = { k: 0 }, GLS = { k: 0 };                            // 벽이 서는 정도 · 창이 뚫리는 정도
  var FL = { w: 1, d: 1 }, SUNK = { k: 1 }, PATCH0 = 0, BUILD = false, BLD = false, BLDC = false, ENDV = false;      // 267번: ENDV 다 지어 눈높이로 내려온 때(한 번 더 '다음'이면 닫고 질문으로) · 263번: FL 바닥이 가로 · 세로로 펴진 정도(점 → 선 → 바닥) · SUNK 창으로 드는 빛(방향을 확인하면 0 → 1) · BUILD 공간 크기를 짓는 중 · BLD 공간 추가에서 짓기(build) · BLDC 폰에서 벽 · 바닥 색을 둘 다 잼
  var BMS = 0;      // 263번: 짓기에서 움직임 한 번 900 ms(0.6 ~ 1초, 결정 #410) — 0이면 예전 빠르기
  var SHARES = {}, ZONE = 0, sharesDirty = true, UNDO = [];
  // 공간들 — 폰에서 재 온 공간이 공간 화면에 미리 떠 있다(아직 안 한 모양). 공간 추가는 폰에서 안 잰 공간에만. LIVE: 지금 편집기에 열린 공간(공간 화면이면 -1)
  var SI = 0, LIVE = -1, DEF = null;      // 258번: 공간 화면은 앱의 것 — 여기서는 열린 공간 하나(LIVE 0 = 열림)
  var P = null;                                                   // 이 공간에 폰에서 재 온 값 — 아직 확인하지 않은 물음에 미리 깔린다
  function pre(k) { if (!P || answered(k)) return false; return k === 'color' ? P.wall != null && P.floor != null : k === 'fur' ? false : P[k] != null; }

  // ───── 크기가 바뀔 때 — 뚝 바뀌지 않고 부드럽게 옮겨 간다 ─────
  var GT = null, glideId = 0;      // GT: 옮겨 가는 중이면 닿을 크기
  var WMIN = 0.2;      // 창은 가로 · 세로 20 cm부터 — 주방 창(90 × 60)처럼 작은 창도 있다 (11-24 사장님)
  var RMAX = [15, 12, 6], POKMAX = 30;      // 큰 거실은 가로 6 ~ 10 m를 넘기도 한다 (11-24 사장님) · 272번: 셋째는 천장 높이 — 층고 높은 공간 4 · 6 m도 그대로(결정 #416, 전엔 3.0 m에서 잘림)
  var D0 = 11;      // [가로, 세로, 높이, 벽 넷의 커튼박스(깊이 · 앞뒤 폭), 창마다 넷…]
  function dims() { var a = [R.W, R.D, R.H]; BOXES.forEach(function (b) { a.push(b.h, b.d); }); WINS.forEach(function (w) { a.push(w.w, w.sill, w.top, w.x); }); return a; }
  function setDims(a) { R.W = a[0]; R.D = a[1]; R.H = a[2]; BOXES.forEach(function (b, i) { b.h = a[3 + i * 2]; b.d = a[4 + i * 2]; }); WINS.forEach(function (w, i) { var o = D0 + i * 4; if (a.length < o + 4) return; w.w = a[o]; w.sill = a[o + 1]; w.top = a[o + 2]; w.x = a[o + 3]; }); }
  function winsNow() { var g = GT; return WINS.map(function (w, i) { var o = D0 + i * 4; return g && g.length >= o + 4 ? { w: g[o], sill: g[o + 1], top: g[o + 2], x: g[o + 3], wall: w.wall, n: w.n || null } : { w: w.w, sill: w.sill, top: w.top, x: w.x, wall: w.wall, n: w.n || null }; }); }
  function glideStart() { var vis = dims(); if (GT && GT.length === vis.length) setDims(GT); return vis; }      // 바꾸기 전에 부른다 — 지금 보이는 크기를 돌려준다
  function glideStop() { if (GT) { glideId++; if (GT.length === dims().length) setDims(GT); GT = null; } }
  function glideGo(from) {
    var to = dims(), id = ++glideId;
    if (CALM || from.length !== to.length || !from.some(function (v, i) { return Math.abs(v - to[i]) > 0.0005; })) { GT = null; layout(); return; }      // 창 수가 바뀌면 바로
    GT = to; setDims(from); layout();
    tween(450, function (k) { if (id !== glideId) return; setDims(from.map(function (v, i) { return v + (to[i] - v) * k; })); layout(); },
      function () { if (id !== glideId) return; GT = null; setDims(to); layout(); sharesDirty = true; render(); });
  }

  function surf(k) { return S[k] != null ? SURFS[k][S[k]] : null; }
  function surfHex(k) { var s = surf(k); return s ? s.hex : null; }
  function roomReady() { return S.wall != null && S.floor != null; }
  // 구성 권하기 — 견적 앱과 같은 규칙: 베란다 · 서재 · 알파룸 · 주방은 블라인드 / 빛 "들어와도" + 시선 "괜찮아요"는 속커튼만 / 그 밖은 이중 커튼
  function recKind() {
    if (['베란다', '서재', '알파룸', '주방'].indexOf(A.type) >= 0) return 'blind';
    if (A.light === 'ok' && A.gaze === 'ok') return 'sheer';
    return 'double';
  }
  function kindNow() { return A.kind || recKind(); }      // 258번: 앱의 품목 구성이 먼저, 없으면 권하는 구성      // 폰에서 들어온(또는 방에서 바꾼) 구성이 먼저 — 못 들은 공간은 묻기가 끝나면 권하는 구성이 걸린다
  function recLevel() { return A.gaze === 'high' ? 2 : A.gaze === 'ok' ? 0 : 1; }      // 속지 비침 — 고르기 전에 걸어 두는 단계. 현행 앱과 같다: 괜찮아요 = 많이 비침 · 조금 = 은은한 비침 · 많이 = 낮 가림
  function lvNow() { return C.sl != null ? C.sl : recLevel(); }
  function answered(k) {
    if (k === 'color') return S.wall != null && S.floor != null;
    if (k === 'room' || k === 'win' || k === 'fur') return !!A[k];
    if (k === 'dtex' || k === 'stex') return HOUSE[k] != null;      // 질감은 집에 한 번
    return A[k] != null;
  }
  function kindAsk() { return A.kind || (A.type && A.light && A.gaze ? recKind() : null); }      // 묻는 동안의 구성 — 못 들은 공간은 빛 · 시선을 듣고 나면 권하는 구성으로
  function skip(k) {      // 이 공간에서 묻지 않는 것 — 구성에 맞는 물음만. 질감은 집에서 처음 그 겹이 걸리는 공간에서 한 번(물은 공간으로 돌아오면 다시 보인다)
    var kd = kindAsk(), dr = kd === 'double' || kd === 'drape', sh = kd === 'double' || kd === 'sheer';
    if (k === 'feel') return kd === 'sheer';
    if (k === 'dtex') return !dr || (HOUSE.dtex != null && HOUSE.dtexAt !== SI);
    if (k === 'stex') return !sh || (HOUSE.stex != null && HOUSE.stexAt !== SI);
    if (k === 'bkind') return kd !== 'blind';
    if (k === 'color' && BLD && !BLDC) return true;      // 263번: 폰 색이 없거나 한쪽만이면 입체 방에서 묻지 않음 — 앱의 색 단계(사진으로 재기 · '○○과 같아요')가 잰다
    return false;
  }
  function askList() { return []; }
  function firstOpen(step) { if (step === 'ask' && A.asked) return null; var l = Q[step] || []; for (var i = 0; i < l.length; i++) if (!skip(l[i]) && !answered(l[i])) return l[i]; return null; }      // 묻기를 한 번 마친 공간은 방에서 구성을 바꿔도 묻기가 막지 않는다
  function stepOf(k) { return Q.measure.indexOf(k) >= 0 ? 'measure' : 'ask'; }
  function canStep(st) {
    if (st === 'ask') return true;
    var asked = !firstOpen('ask');
    if (st === 'measure') return asked;
    return asked && !firstOpen('measure') && kindNow() != null;
  }
  function sheerMode() { var k = kindNow(); return S.step === 'cur' && S.part === 'sheer' && roomReady() && (k === 'double' || k === 'sheer'); }
  function cmpOn() { return false; }      // 16판: 방 안에서 비침 넷을 견주지 않는다 — 견주기는 현행 앱의 네 폭 화면에서, 방에는 고른 단계 하나만 걸린다(아래 견주기 코드는 남겨 둠)
  // ───── 그리는 재료 ─────
  var scene = new THREE.Scene();
  var cam = new THREE.PerspectiveCamera(28, 1.6, 0.05, 200);
  var idCam = new THREE.PerspectiveCamera(48.8, 1.6, 0.05, 60);      // 눈높이 넓이를 재는 눈
  var RTW = 192, RTH = 120, rt = new THREE.WebGLRenderTarget(RTW, RTH), buf = new Uint8Array(RTW * RTH * 4);

  function flat(hex, o) { var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }); if (o) for (var k in o) m[k] = o[k]; return m; }
  var lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.42 });
  var selMat = new THREE.LineBasicMaterial({ color: INK });
  var foldMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.15 });      // 주름 — 앞으로 나온 마루마다 한 줄
  var hemMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.3 });        // 커튼 윗단 · 아랫단 · 옆선
  var pinMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.4 });        // 나비주름 집은 자리
  var stitchMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.24 });     // 밑단 시접 — 접어 박은 선(18판)
  var dimMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.45 });
  var modelMat = flat(MODEL);
  var wallMat = flat(MODEL, { side: THREE.DoubleSide });       // 창 자리를 뚫은 벽 몸 — 뚫린 자리로 벽 두께가 보인다
  var idMats = {};
  function idMat(n, both) {      // 1 벽 · 2 바닥 · 3 커튼 · 4~ 가구
    var key = n + (both ? 'b' : '');
    if (!idMats[key]) idMats[key] = new THREE.MeshBasicMaterial({ color: new THREE.Color(n * 8 / 255, 0, 0), side: both ? THREE.DoubleSide : THREE.FrontSide });
    return idMats[key];
  }

  var hatchImg = (function () {      // 빗금 = 아직 모르는 색
    var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d');
    g.fillStyle = BG; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(43,34,26,0.26)'; g.lineWidth = 2.5; g.beginPath();
    g.moveTo(-4, 68); g.lineTo(68, -4); g.moveTo(-36, 36); g.lineTo(36, -36); g.moveTo(28, 100); g.lineTo(100, 28); g.stroke();
    return c;
  })();
  function hatchTex() { var t = new THREE.CanvasTexture(hatchImg); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; }
  var glowTex = (function () {
    var c = document.createElement('canvas'); c.width = 128; c.height = 128; var g = c.getContext('2d');
    var gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,250,236,1)'); gr.addColorStop(1, 'rgba(255,250,236,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = 'destination-in';
    var ge = g.createLinearGradient(0, 0, 128, 0); ge.addColorStop(0, 'rgba(0,0,0,0)'); ge.addColorStop(0.16, 'rgba(0,0,0,1)'); ge.addColorStop(0.84, 'rgba(0,0,0,1)'); ge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = ge; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  // 창밖(18판) — 현행 앱이 비침 고르기에 쓰는 예시 사진 그대로(photos/scene/window_apt.jpg · 앱 256번 · 결정 #361)를 줄여 넣었다. 코드로 그린 그림은 17판까지
  // 1 m = PX 칸(사진 한 장이 가로 3.8 m쯤 — 2.4 m 창에 사진의 3분의 2가 든다). 방 바닥 = 사진의 FL째 줄(맨 아래 나무), 위로는 하늘을 이어 붙인다(천장이 높은 집).
  // 가로로는 사진을 뒤집어 가며 이어 붙여 끝이 없다 — 넓은 창 · 다른 벽의 창도 같은 풍경에서 제 자리를 잘라 쓴다
  // 19판(글 #561 — 사장님: 예시 사진이 거리감이 안 느껴진다): 사진을 유리에 붙이지 않고 '창 뒤 멀리 있는 그림'으로 다룬다 — 눈이 옮겨 가면(위에서 ↔ 눈높이 · 다가가기 · 옆으로) 사진의 자리와 크기가 창틀과 따로 움직인다(먼 것은 덜 움직인다)
  // 유리마다 그림을 다시 그리지 않는다 — 사진 한 장(뒤집어 이은 두 장 폭)과 비침 단계마다 흐려 둔 한 장을 모든 창이 함께 쓰고, 창은 제 자리의 조각만 가리킨다(sceneSync). 아래 값은 모두 시안 값
  // PX: 눈이 E0(m) 떨어져 있을 때 유리 1 m에 드는 사진 칸 · D: 풍경까지의 거리(m) · EZ: 다가가고 물러설 때 크기가 따라 바뀌는 거리의 범위 · LX · LY: 옆 · 위로 옮겨 갈 때 풍경이 밀리는 한계
  // EY · HZ: 눈높이(m)와 그 높이가 놓이는 사진 줄 · YAW: 눈높이에서 옆으로 돌려 볼 때 한 걸음 옮겨 선 것처럼(m) · HAZE: 먼 풍경의 뿌연 정도 · KB: 비침 흐림(px)을 사진 칸으로 · OFF: 다른 벽의 창이 보는 자리(사진 칸)
  var SCN = { img: new Image(), tile: null, tex: null, btex: {}, TH: 1, PX: 460, E0: 6, D: 40, EZ: [5, 9], LX: 0.3, LY: 0.12, EY: 1.3, HZ: 270, YAW: 1.2, HAZE: 0.2, KB: 2.3, OFF: [0, 632, 1264, -632], TOP: 520, BOT: 320, W: 1264, H: 848 };
  SCN.img.onload = function () { sceneBuild(); if (LIVE >= 0) { for (var k in POOL) if (POOL[k].kind === 'set') POOL[k].asig = ''; paintSheer(); invalidate(); } };
  SCN.img = flatScene(); sceneBuild();      // 263번: 사진을 받지 않고 그림 층으로 바로 — (옛) 258번: 앱의 사진 파일 그대로(시안은 글자로 묻어 두었다) — 장의 작은 그림(--scn)은 root에 걸어 둔다
  function scnTex(c) { var t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t; }
  function sceneBuild() {      // 사진 한 장 → 위로 하늘 · 아래로 나무를 이어 붙이고, 옆으로 뒤집어 이어 끝이 없게(두 장 폭 — 이음매가 이어진다), 먼 풍경처럼 아주 조금 뿌옇게
    var W = SCN.W, th = SCN.TOP + SCN.H + SCN.BOT, yb = SCN.TOP + SCN.H, t1 = document.createElement('canvas'), c = document.createElement('canvas'), g, k;
    t1.width = W; t1.height = th; g = t1.getContext('2d');
    g.filter = 'blur(6px)'; g.drawImage(SCN.img, 0, 0, W, 3, -20, -20, W + 40, SCN.TOP + 26); g.filter = 'none';      // 사진 위로 하늘을 이어 붙인다
    g.save(); g.translate(0, 2 * yb); g.scale(1, -1); g.drawImage(SCN.img, 0, SCN.H - 200, W, 200, 0, yb - 200, W, 200); g.restore();      // 아래는 나무를 뒤집어 잇고
    g.drawImage(SCN.img, 0, SCN.TOP);
    var f = document.createElement('canvas'), fg, gr; f.width = W; f.height = SCN.BOT; fg = f.getContext('2d');      // 그 위에 나무 빛을 흐리게 덮는다 — 사진 바로 아래 60줄에 걸쳐 차츰 짙어져, 뒤집힌 그림의 모양이 남지 않는다(눈이 높이 올라갈 때 · 큰 창의 아랫단에서 조금 보인다)
    fg.filter = 'blur(18px)'; fg.save(); fg.translate(0, SCN.BOT + 40); fg.scale(1, -1); fg.drawImage(SCN.img, 0, SCN.H - 200, W, 200, -40, 0, W + 80, SCN.BOT + 80); fg.restore(); fg.filter = 'none';
    gr = fg.createLinearGradient(0, 0, 0, 60); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); fg.globalCompositeOperation = 'destination-in'; fg.fillStyle = gr; fg.fillRect(0, 0, W, SCN.BOT);
    g.drawImage(f, 0, yb);
    c.width = 2 * W; c.height = th; g = c.getContext('2d'); g.drawImage(t1, 0, 0); g.save(); g.translate(2 * W, 0); g.scale(-1, 1); g.drawImage(t1, 0, 0); g.restore();
    if (SCN.HAZE > 0) { g.fillStyle = 'rgba(233,238,241,' + SCN.HAZE + ')'; g.fillRect(0, 0, 2 * W, th); }
    if (SCN.tex) SCN.tex.dispose(); for (k in SCN.btex) SCN.btex[k].dispose();
    SCN.tile = c; SCN.TH = th; SCN.btex = {}; SCN.tex = scnTex(c);
  }
  function sceneBlur(lv) {      // 비침 단계만큼 흐린 창밖 — 단계마다 한 번만 그려 두고 모든 창이 함께 쓴다(반 크기 — 흐린 그림이라 티가 나지 않는다)
    if (SCN.btex[lv]) return SCN.btex[lv];
    var T = SCN.tile, w = T.width >> 1, h = T.height >> 1, b = LVB[lv] * SCN.KB / 2, M = Math.min(w, Math.ceil(b * 3 + 2)), sc = document.createElement('canvas'), c = document.createElement('canvas'), g;
    sc.width = w + 2 * M; sc.height = h + 2 * M; g = sc.getContext('2d');
    g.drawImage(T, 0, 0, T.width, 1, 0, 0, sc.width, M + 1); g.drawImage(T, 0, T.height - 1, T.width, 1, 0, M + h - 1, sc.width, M + 1);      // 위 · 아래는 끝 줄을 늘여서 — 흐림이 가장자리에서 옅어지지 않게
    [-1, 0, 1].forEach(function (k) { g.drawImage(T, M + k * w, M, w, h); });      // 옆으로는 이어진 그림 그대로
    c.width = w; c.height = h; g = c.getContext('2d'); g.filter = 'blur(' + b.toFixed(2) + 'px)'; g.drawImage(sc, -M, -M); g.filter = 'none';
    return (SCN.btex[lv] = scnTex(c));
  }
  function damp(t, L) { return t / Math.sqrt(1 + t * t / (L * L)); }      // 작은 기울기는 그대로, 큰 기울기는 L에서 멎는다
  var EYEL = new THREE.Vector3();
  function sceneSync() {      // 눈이 옮겨 갈 때마다 — 유리마다 창밖 사진의 어느 조각이 보이는지만 다시 가리킨다(그림은 다시 그리지 않는다 — 꼭짓점 넷의 자리 값만 바뀐다)
    if (!SCN.tex) return;
    var s = SCN.PX / (1 + SCN.D / SCN.E0), yv = Math.sin(V.yaw) * SCN.YAW * V.t, zG = -(R.T - 0.02), key, o, w, g, E, ez, M = 1, sx = 0, sy = 0, off = 0, pa, ua, i, cv, nq, list, wl, wr, hh, kz, bp, bu, cx, cy;
    function U(x) { return (off + (x * M + sx) * s) / (2 * SCN.W); }
    function Vv(y) { return 1 - (SCN.TOP + SCN.HZ - ((y - SCN.EY) * M + sy) * s) / SCN.TH; }
    function pr(xe) { return E.x + (xe - E.x) * kz; }      // 속지의 끝이 눈에서 볼 때 유리의 어디에 겹치는지
    for (key in POOL) {
      o = POOL[key]; if (o.kind !== 'glass' || !o.live) continue;
      w = WINS[+key.slice(1)]; if (!w) continue;
      g = WG[w.wall]; g.updateMatrixWorld();
      E = g.worldToLocal(EYEL.set(cam.position.x - yv, cam.position.y, cam.position.z));      // 벽 기준의 눈 자리 — 눈높이에서 옆으로 돌려 보면 그쪽으로 조금 옮겨 선 것처럼
      ez = Math.max(0.5, E.z - zG); M = 1 + SCN.D / clamp(ez, SCN.EZ[0], SCN.EZ[1]);      // 다가가면 창은 커지는데 먼 풍경은 그대로 — 창에 풍경이 더 많이 든다
      sx = SCN.D * damp(-E.x / ez, SCN.LX); sy = SCN.D * damp((SCN.EY - E.y) / ez, SCN.LY); off = SCN.W / 2 + SCN.OFF[w.wall];
      pa = o.m.geometry.attributes.position; ua = o.m.geometry.attributes.uv; if (!pa || !ua) continue;
      cx = o.m.position.x; cy = o.m.position.y;
      for (i = 0; i < pa.count; i++) ua.setXY(i, U(cx + pa.getX(i)), Vv(cy + pa.getY(i)));
      ua.needsUpdate = true;
      cv = o.cov; nq = 0;      // 속지가 가린 자리에는 흐린 그림을 — 걷힌 자리는 또렷하다
      if (cv && o.mb.material.map) {
        E = g.worldToLocal(EYEL.copy(cam.position)); kz = E.z - cv.z > 0.05 ? (E.z - zG) / (E.z - cv.z) : 1;
        list = cv.g0 == null ? [[pr(cv.a), pr(cv.b)]] : [[pr(cv.a), pr(cv.g0)], [pr(cv.g1), pr(cv.b)]];
        wl = w.x - w.w / 2; wr = w.x + w.w / 2; hh = (w.top - w.sill) * Math.max(0.001, GLS.k) / 2; bp = o.mb.geometry.attributes.position; bu = o.mb.geometry.attributes.uv;
        for (i = 0; i < list.length; i++) {
          var a = Math.max(wl, list[i][0]), b = Math.min(wr, list[i][1]), q = nq * 4; if (b - a < 0.002) continue;
          bp.setXYZ(q, a - cx, -hh, 0); bp.setXYZ(q + 1, b - cx, -hh, 0); bp.setXYZ(q + 2, b - cx, hh, 0); bp.setXYZ(q + 3, a - cx, hh, 0);
          bu.setXY(q, U(a), Vv(cy - hh)); bu.setXY(q + 1, U(b), Vv(cy - hh)); bu.setXY(q + 2, U(b), Vv(cy + hh)); bu.setXY(q + 3, U(a), Vv(cy + hh)); nq++;
        }
        bp.needsUpdate = bu.needsUpdate = true;
      }
      o.mb.geometry.setDrawRange(0, nq * 6); o.mb.visible = nq > 0;
    }
  }

  // 색이 들어가기 전에는 빗금, 들어가면 그 색 그대로
  function Paint(both) { this.tex = hatchTex(); this.mat = flat('#ffffff', { map: this.tex }); if (both) this.mat.side = THREE.DoubleSide; this.hex = null; }
  Paint.prototype.size = function (w, h, per) { per = per || 6; this.tex.repeat.set(w * per, h * per); };
  Paint.prototype.set = function (hex, anim) {
    var m = this.mat;
    if (hex === this.hex) return;
    if (hex == null) { m.map = this.tex; m.color.set('#ffffff'); m.needsUpdate = true; this.hex = null; invalidate(); return; }
    var from = this.hex == null ? new THREE.Color(BG) : m.color.clone(), to = new THREE.Color(hex);
    if (m.map) { m.map = null; m.needsUpdate = true; }
    this.hex = hex;
    if (!anim || CALM) { m.color.copy(to); invalidate(); return; }
    var self = this;
    tween(650, function (k) { if (self.hex === hex) m.color.copy(from).lerp(to, k); });
  };
  function tint(mat, hex, anim) {      // 빗금 없이 색만 바꾸는 면 (속커튼)
    if (mat.userData.hex === hex) return;
    var from = mat.color.clone(), to = new THREE.Color(hex); mat.userData.hex = hex;
    if (!anim || CALM) { mat.color.copy(to); invalidate(); return; }
    tween(650, function (k) { if (mat.userData.hex === hex) mat.color.copy(from).lerp(to, k); });
  }

  // ───── 움직임 ─────
  var tweens = [], raf = 0;
  function tween(dur, fn, done) { tweens.push({ t0: performance.now(), dur: CALM || QUICK ? 1 : dur, fn: fn, done: done }); invalidate(); }      // 260번: 멈춘 그림은 움직임 없이
  function invalidate() { if (!raf) raf = requestAnimationFrame(frame); }

  // ───── 방 짓기 ─────
  function mesh(mat, layer) { var m = new THREE.Mesh(new THREE.BufferGeometry(), mat); if (layer) m.layers.set(layer); return m; }
  function lines(mat) { return new THREE.LineSegments(new THREE.BufferGeometry(), mat || lineMat); }
  function setGeo(m, g) { m.geometry.dispose(); m.geometry = g; }
  function setEdges(l, g) { l.geometry.dispose(); l.geometry = new THREE.EdgesGeometry(g); }
  function setLines(l, pts) { l.geometry.dispose(); l.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); }

  var slab = mesh(modelMat), slabE = lines(); slab.add(slabE); scene.add(slab);
  var floorP = new Paint(), floorM = mesh(floorP.mat), floorE = lines(), floorId = mesh(idMat(2), 1);
  floorM.rotation.x = floorId.rotation.x = -Math.PI / 2; floorM.position.y = floorId.position.y = 0.001; floorM.add(floorE); scene.add(floorM, floorId);
  var ceilP = new Paint(), ceil = mesh(ceilP.mat), ceilE = lines(), ceilId = mesh(idMat(1), 1);      // 천장은 벽 색을 따라간다 (아래에서 볼 때만 보임)
  ceil.rotation.x = ceilId.rotation.x = Math.PI / 2; ceil.add(ceilE); scene.add(ceil, ceilId);

  var WALLS = [0, 1, 2, 3].map(function () {      // 0 창 벽(뒤) · 1 오른쪽 · 2 앞 · 3 왼쪽
    var w = { vis: new THREE.Group(), p: new Paint(), n: new THREE.Vector3(), pos: new THREE.Vector3() };
    w.body = mesh(wallMat); w.bodyE = lines(); w.body.add(w.bodyE);
    w.face = mesh(w.p.mat); w.faceE = lines(); w.face.add(w.faceE);
    w.base = [mesh(modelMat), mesh(modelMat)]; w.baseE = [lines(), lines()];      // 걸레받이 (창이 바닥까지 오면 창 앞에서 끊긴다)
    w.base[0].add(w.baseE[0]); w.base[1].add(w.baseE[1]);
    w.id = mesh(idMat(1), 1);
    w.vis.add(w.body, w.face, w.base[0], w.base[1]); scene.add(w.vis, w.id);
    return w;
  });

  // 커튼박스 — 벽마다 한 벌: 벽 위로 올라간 벽(back · face), 천장 끝 턱(lip), 박스 안 천장(cap), 박스 양 끝(end). 위에서 보면 벽 위의 홈으로 보인다
  WALLS.forEach(function (w, i) {
    var b = w.bx = { back: mesh(modelMat), backE: lines(), face: mesh(w.p.mat), lip: mesh(modelMat), lipE: lines(), cap: mesh(w.p.mat), end: [mesh(WALLS[(i + 3) % 4].p.mat), mesh(WALLS[(i + 1) % 4].p.mat)], faceId: mesh(idMat(1), 1), capId: mesh(idMat(1), 1), fill: [mesh(ceilP.mat), mesh(ceilP.mat)], fillE: [lines(), lines()] };      // fill: 박스가 벽 끝까지 안 가면 그 바깥의 천장
    b.fill.forEach(function (f, j) { f.rotation.x = Math.PI / 2; f.add(b.fillE[j]); w.vis.add(f); });
    b.back.add(b.backE); b.lip.add(b.lipE); b.cap.rotation.x = b.capId.rotation.x = Math.PI / 2; b.end[0].rotation.y = Math.PI / 2; b.end[1].rotation.y = -Math.PI / 2;
    w.vis.add(b.back, b.face, b.lip, b.cap, b.end[0], b.end[1]);
    w.idg = new THREE.Group(); w.idg.add(b.faceId, b.capId); scene.add(w.idg);
  });

  var sashMat = flat('#FBFAF7', { side: THREE.DoubleSide });   // 샷시 — 흰 틀(레일처럼 가는 선을 두른다)
  var gripMat = flat('#C9C8C3'), gripDark = flat('#4A4744');      // 창 손잡이 — 턱 있는 창은 은색, 바닥까지 오는 창(문 꼴)은 짙은 색
  var tickMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.2 });      // 유리 표시 — 짧은 빗금 두 줄
  var patchMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false });
  var railMat = flat('#FFFFFF');      // 레일은 흰색으로 고정 (11-24 사장님) — 흰 벽 앞에서도 보이게 가는 선을 두른다. 블라인드 윗상자도 같은 색
  var SHMATS = [];      // 속커튼 — 벌마다 제 재료(비침을 폭마다 다르게 그리는 덮개 그림을 가진다)
  // 벽마다 창 · 커튼 · 블라인드가 붙는 자리 — 벽 가운데 바닥이 원점, x는 벽을 따라, z는 방 안쪽으로
  var WG = [0, 1, 2, 3].map(function () { var g = new THREE.Group(); scene.add(g); return g; });
  var POOL = {};      // 창마다(유리 · 바닥 빛 · 블라인드) · 벽마다(커튼 한 벌) 만들어 두고 다시 쓴다
  function pool(key, make) { var o = POOL[key]; if (!o) o = POOL[key] = make(); o.live = true; return o; }
  function mkGlass() {      // m: 유리(창을 집는 자리 · 창밖 사진의 한 조각을 가리킨다) · mb: 속지가 가린 자리의 흐린 창밖(19판) · g: 샷시 · t: 유리 빗금
    var o = { kind: 'glass', m: mesh(flat('#dde5ea')), g: new THREE.Group(), t: lines(tickMat), cov: null }, bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24), 3)); bg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(16), 2)); bg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]); bg.setDrawRange(0, 0);
    o.mb = new THREE.Mesh(bg, flat('#ffffff')); o.mb.position.z = 0.003; o.mb.frustumCulled = false; o.mb.visible = false; o.m.add(o.mb);
    return o;
  }
  function mkPatch() { var o = { kind: 'patch', m: mesh(patchMat) }; o.m.rotation.x = -Math.PI / 2; return o; }
  function mkDrape() {
    var d = { p: new Paint(true) };
    d.p.mat.polygonOffset = false; d.p.mat.vertexColors = true;      // 비스듬히 볼수록 면을 뒤로 미는 밀어내기(polygonOffset)가 주름 옆면을 속커튼 · 창 뒤로 밀어, 뒤의 색이 주름 사이로 새어 나왔다 — 커튼은 끄고 선만 앞으로 띄운다
    d.m = mesh(d.p.mat); d.f = lines(foldMat); d.e = lines(hemMat); d.pn = lines(pinMat); d.h = lines(stitchMat); d.id = mesh(idMat(3, true), 3);      // h: 밑단 시접 선
    d.m.add(d.f, d.e, d.pn, d.h, d.id); d.m.userData.hit = 'curtain'; return d;
  }
  function mkSet() {      // 한 벽의 커튼 한 벌 — 그 벽의 창들을 한데 덮는다. shH: 속지 시접 — 접혀서 두 겹이 된 자리(같은 천 한 겹을 더 그린다) · shHL: 박은 선(18판)
    var acv = document.createElement('canvas'); acv.width = 512; acv.height = 2;      // 속커튼 덮개 — 가로로 폭마다 비침(덮는 정도)을 칠한다
    var atex = new THREE.CanvasTexture(acv); atex.minFilter = atex.magFilter = THREE.LinearFilter; atex.generateMipmaps = false;
    var shMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(SHEER0), transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, alphaMap: atex }); SHMATS.push(shMat);
    var o = { kind: 'set', l: mkDrape(), r: mkDrape(), sh: mesh(shMat), shF: lines(foldMat), shE: lines(foldMat), shH: mesh(shMat), shHL: lines(stitchMat), shId: mesh(idMat(3, true), 3), rail: mesh(railMat), railE: lines(), rail2: mesh(railMat), rail2E: lines(), zone: mesh(idMat(3), 2), actx: acv.getContext('2d'), atex: atex, asig: '' };
    o.sh.add(o.shF, o.shE, o.shH, o.shHL, o.shId); o.sh.userData.hit = 'curtain'; o.rail.add(o.railE); o.rail2.add(o.rail2E); return o;
  }
  function mkBlind() {      // 블라인드는 창마다 한 장 — 창 앞에 내려오는 판(롤 · 콤비 앞 겹). 우드 · 알루미늄은 살을 한 장씩(18판)
    var b = { kind: 'blind', p: new Paint(true), ps: new Paint() };      // ps: 살 · 콤비 뒤 겹의 재료 — 면마다 밝기를 아주 조금 달리한다(앞면만 그린다)
    b.p.mat.polygonOffset = false; b.ps.mat.polygonOffset = false; b.ps.mat.vertexColors = true;
    b.m = mesh(b.p.mat); b.f = lines(foldMat); b.e = lines(hemMat); b.id = mesh(idMat(3, true), 3); b.sm = mesh(b.ps.mat);      // sm: 살(우드 · 알루미늄) · 콤비 뒤 겹의 막힌 띠
    b.mat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(BG), transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide });      // 콤비의 비치는 띠 — 한 겹의 짙기. 두 겹이 겹쳐도 뒤의 창이 비쳐 보인다
    b.m2 = mesh(b.mat2); b.m4 = mesh(b.mat2); b.m4.renderOrder = 1; b.m2.renderOrder = 2; b.band = false;      // m2: 앞 겹 · m4: 뒤 겹의 비치는 띠
    b.hit = mesh(new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })); b.hit.userData.hit = 'curtain';      // 누르는 면 — 늘 판 전체(살 사이를 눌러도 블라인드가 눌린다)
    b.m.add(b.f, b.e, b.id, b.sm, b.m4, b.m2, b.hit);
    b.cas = mesh(railMat); b.casE = lines(); b.cas.add(b.casE); b.zone = mesh(idMat(3), 2); return b;
  }
  function hideP(o) {
    if (o.kind === 'set') o.l.m.visible = o.r.m.visible = o.sh.visible = o.rail.visible = o.rail2.visible = o.zone.visible = false;
    else if (o.kind === 'blind') o.m.visible = o.m2.visible = o.cas.visible = o.zone.visible = false;
    else { o.m.visible = false; if (o.g) o.g.visible = o.t.visible = false; }
  }
  var dimW = lines(dimMat), dimD = lines(dimMat); scene.add(dimW, dimD);
  // 밑단 보기의 뜬 거리 치수선 — 굵기와 화살촉을 화면 기준(px)으로 짓는다. 멀리서도 · 비스듬히 돌려 봐도 같은 굵기로, 늘 눈 쪽을 본다. 커튼에 가려지지 않게 맨 위에 그린다
  var hemDimMat = new THREE.MeshBasicMaterial({ color: INK, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide }), hemDim = new THREE.Mesh(new THREE.BufferGeometry(), hemDimMat); hemDim.renderOrder = 10; hemDim.visible = false;
  var hemLift = 0;      // 치수선의 위 끝(틈 위로 올라온 만큼) — 숫자는 그 위에 선다
  var furRoot = new THREE.Group(); scene.add(furRoot);

  // 커튼이 걸리는 자리 — 손대기 전에는 창을 보고 정한다: 창이 작으면 창틀 위에서 창 아래까지, 크면 천장에서 바닥까지, 벽을 거의 다 차지하면 벽 전체.
  // 커튼박스가 있으면 늘 박스 안에서 내려온다.
  // 주름 — 폭수로 센다: 일반 주름도 나비 주름도 한 폭에 6개(앞으로 나온 마루 · 집은 자리). 폭수가 바뀌면 주름 수가 같이 바뀐다.
  function wlen(i) { return i === 0 || i === 2 ? R.W : R.D; }
  function gkey(g) { return g.wall + ':' + g.js.join(','); }      // 커튼 한 벌의 열쇠 — 벽과 그 벌이 덮는 창들
  function selG(gs) { gs = gs || groups(); return gs[S.csel] || gs[0]; }      // 고른 커튼 한 벌 — 손잡이와 크기 · 폭수 단추는 이 벌에 붙는다(방에서 커튼을 눌러 고른다)
  function magnet(v, list) { var best = v, d = 0.03; list.forEach(function (m) { if (Math.abs(v - m) < d) { d = Math.abs(v - m); best = m; } }); return best; }      // 끌 때 뜻 있는 자리(천장 · 바닥 · 벽 전체 · 권하는 크기)에 붙는다 — 그 사이 값은 1 cm 단추로
  function wallsUsed() { var u = []; WINS.forEach(function (w) { if (u.indexOf(w.wall) < 0) u.push(w.wall); }); return u; }
  // 커튼 한 벌이 덮는 창 묶음 — 같은 벽에서 붙어 있거나 가까운(50 cm 안) 창은 한 벌, 떨어져 있으면 창마다 한 벌(레일 길이 때문에 대개 창마다 간다 — 11-24 사장님).
  // '한 벌로'(C.join)를 고르면 그 벽의 창을 모두 한 벌로 덮는다. 첫 창이 든 묶음이 맨 앞 — 손잡이와 폭수는 그 묶음에 붙는다
  var GAPJOIN = 0.5;
  function groups(raw) {
    var out = [];
    wallsUsed().forEach(function (i) {
      var ws = [], cur = null, end = -Infinity;
      WINS.forEach(function (w, j) { if (w.wall === i) ws.push(j); });
      ws.sort(function (p, q) { return (WINS[p].x - WINS[p].w / 2) - (WINS[q].x - WINS[q].w / 2); });
      ws.forEach(function (j) {
        var w = WINS[j], a = w.x - w.w / 2;
        if (!cur || (!(C.join && !raw) && a - end > GAPJOIN)) { cur = { wall: i, js: [] }; out.push(cur); }
        cur.js.push(j); end = Math.max(end, w.x + w.w / 2);
      });
    });
    out.sort(function (p, q) { return (q.js.indexOf(0) >= 0) - (p.js.indexOf(0) >= 0); });
    return out;
  }
  function span(g) {      // 그 묶음의 창들을 한데 묶은 자리 · lo, hi: 옆 묶음과 반씩 나눠 갖는 끝
    var a = Infinity, b = -Infinity, sill = Infinity, top = -Infinity, L = wlen(g.wall), sg = bx(g.wall).on ? boxSeg(g.wall) : { a: -L / 2, b: L / 2 }, lo = sg.a, hi = sg.b;      // 벽 끝까지(박스가 있으면 박스 끝까지) — 박스 길이가 벽과 다를 때만 따로 잰다 (11-24)
    g.js.forEach(function (j) { var w = WINS[j]; a = Math.min(a, w.x - w.w / 2); b = Math.max(b, w.x + w.w / 2); sill = Math.min(sill, w.sill); top = Math.max(top, w.top); });
    WINS.forEach(function (w, j) {
      if (w.wall !== g.wall || g.js.indexOf(j) >= 0) return;
      var wa = w.x - w.w / 2, wb = w.x + w.w / 2;
      if (wb <= a + 0.001) lo = Math.max(lo, (wb + a) / 2); else if (wa >= b - 0.001) hi = Math.min(hi, (wa + b) / 2);
    });
    return { a: a, b: b, w: b - a, cx: (a + b) / 2, sill: sill, top: top, n: g.js.length, lo: Math.min(lo, a), hi: Math.max(hi, b) };
  }
  // 레일 자리(벽에서 떨어진 거리) — 커튼박스가 있으면 그 앞뒤 폭 안에 들어간다. 폭이 좁으면 두 줄이 서로 붙는다
  function railZ(i) {
    var b = bx(i), zd, zs, m;
    if (!b.on) return { s: ZS, d: ZD };
    if (kindNow() === 'double') { zd = Math.min(ZD, b.d - 0.045); zs = Math.max(0.02, Math.min(ZS, zd - 0.06)); return { s: zs, d: Math.max(zd, zs + 0.02) }; }
    m = Math.min(ZD, b.d / 2); return { s: m, d: m };
  }
  // 실내등(19판, 결정 #406 — 11-25 사장님: 저녁의 실내등의 유무 · 등의 색에 따른 차이, 참고용) — [열쇠, 이름, 방 그림에 곱하는 색, 이름 앞 네모의 색]. 이름은 등 포장에 적힌 말 그대로(전구색 · 주백색 · 주광색). 모두 시안 값
  // 사람 눈은 등 색에 익숙해지므로 세게 물들이지 않는다 — 차이가 읽힐 만큼만. 주광색은 잰 색(낮빛 기준)과 거의 같고, 끄면 어둑하고 푸르스름하다. 처음 값은 주광색(C.lamp — 공간마다 남는다)
  var LAMPS = [['off', '끔', [0.5, 0.53, 0.6], null], ['warm', '전구색', [1, 0.94, 0.83], '#F3D3A2'], ['mid', '주백색', [1, 0.97, 0.915], '#F6E8CF'], ['cool', '주광색', [0.97, 0.985, 1], '#EEF3FA']];
  // 그리는 법: 방을 다 그린 뒤 화면 가득한 네모 한 장을 '곱하기'로 한 번 더 그린다 — 방이 그려진 자리만 물들고(둘레의 종이는 그대로), 재료 하나하나의 색은 건드리지 않는다. 색 판 · 칩 · 넓이 재기 · 제안 그림은 이 네모를 거치지 않아 잰 색 그대로
  var lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.MultiplyBlending, transparent: true, depthTest: false, depthWrite: false }), lampScene = new THREE.Scene(), lampCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  (function () { var m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lampMat); m.position.z = -0.5; m.frustumCulled = false; lampScene.add(m); })();
  var LAMPV = [1, 1, 1], LAMPID = 0, lampKey = '', lampSig = '';
  function lampNow() { return C.lamp || 'cool'; }
  function lampGo(anim) {      // 낮 ↔ 밤 · 등 색이 바뀌면 방의 색이 뚝 바뀌지 않고 옮겨 간다
    var k = S.night && LIVE >= 0 && STEPS.indexOf(S.step) >= 0 ? lampNow() : '', to = [1, 1, 1], a = LAMPV.slice(), id, i;
    if (k === lampKey) return; lampKey = k;
    for (i = 0; i < LAMPS.length; i++) if (LAMPS[i][0] === k) to = LAMPS[i][2];
    id = ++LAMPID;
    if (anim === false || CALM) { LAMPV = to.slice(); lampMat.color.setRGB(to[0], to[1], to[2]); invalidate(); return; }
    tween(700, function (t) { if (id !== LAMPID) return; LAMPV = a.map(function (v, j) { return v + (to[j] - v) * t; }); lampMat.color.setRGB(LAMPV[0], LAMPV[1], LAMPV[2]); });
  }
  function paintLamp() {      // 실내등 줄 — 밤으로 볼 때만(측정 · 선택), 방이 지어진 뒤에
    var on = S.night && (S.step === 'measure' || S.step === 'cur') && !!A.room, h = '';
    if (on) h = '<span class="k">실내등</span>' + LAMPS.map(function (o) { return '<button type="button" class="chip nd' + (lampNow() === o[0] ? ' on' : '') + '" data-chip="lamp" data-key="' + o[0] + '">' + (o[3] ? '<i style="background:' + o[3] + '"></i>' : '') + '<span class="tx"><span class="nm">' + o[1] + '</span></span></button>'; }).join('') + '<span class="note">등 색은 참고용입니다.</span>';
    if (h !== lampSig) { lampSig = h; lampEl.innerHTML = h; lampEl.hidden = !h; }
  }
  var NOSZ = {};
  function CB(g) {      // 커튼 한 벌의 자리 — g: 묶음(없으면 고른 묶음)
    if (!(typeof g === 'object' && g)) g = selG();
    var i = g.wall, key = gkey(g), u = span(g), z = C.sz[key] || NOSZ, bxi = bx(i), hasBox = bxi.on, rz = railZ(i), maxW = u.hi - u.lo, L = maxW;
    var small = u.sill >= 0.4 && u.top - u.sill < 1.6;
    // 다는 높이(hang): 커튼박스가 있으면 박스 안 천장, 없으면 천장 … 창틀 위 사이 어디든 / 아랫단(botY): 바닥에서 1 cm가 기본, 창 아래까지 올릴 수 있다
    var ceilY = R.H + (hasBox ? bxi.h * bxi.k : 0), frameY = Math.min(R.H, u.top + 0.15), floorY = 0.01, sillY = Math.max(floorY, u.sill - 0.2), botMax = Math.max(u.sill, 0.1);
    // 266번(결정 #414): 기장 — '바닥까지'(바닥 위 gap, 처음 1 cm) · '창 아래'(창 아래로 below만큼, 처음 20 cm). 창이 바닥에서 30 cm 안이면(바닥까지 오는 창 · 베란다 창) '바닥까지'만
    var sillOK = u.sill >= 0.3, hem, gap = null, below = null, botY;
    if (z.hem === 'win' && sillOK) { hem = 'win'; below = clamp(z.below == null ? 0.2 : z.below, 0, u.sill); botY = u.sill - below; }
    else if (z.hem || z.bot == null) { hem = 'floor'; gap = clamp(z.gap == null ? 0.01 : z.gap, 0, botMax); botY = gap; }
    else { botY = clamp(z.bot, 0, botMax); hem = sillOK && botY >= 0.1 ? 'win' : 'floor'; }      // 266번 전에 저장한 입체 방(아랫단 높이만 있음) — 그 자리 그대로
    if (sillOK && below == null) below = u.sill - botY;
    if (gap == null) gap = botY;
    var hang = hasBox ? ceilY : z.top == null ? ceilY : clamp(z.top, Math.min(R.H, u.top + 0.05), R.H);      // 266번: 손대기 전에는 늘 천장에서(박스가 있으면 박스 안) — 266번 전의 '작은 창은 창틀 위에서'는 뺌(기본은 벽에서 벽 · 바닥까지, 결정 #414). 창틀 위로는 위 손잡이로
    var topY = hang - 0.03;
    // 266번(결정 #414): 가로 — '벽에서 벽'(처음 값 · 박스가 벽보다 짧으면 박스 끝에서 끝) · '창 기준'(창 왼쪽 ml · 오른쪽 mr, 처음 25 cm씩 · 옆 창 · 벽 끝까지) · '직접'(가로 w · 가운데 cx)
    var minW = Math.min(u.w, maxW), recW = clamp(u.w + 0.5, minW, maxW), mlMax = Math.max(0, u.a - u.lo), mrMax = Math.max(0, u.hi - u.b);
    var mode = z.mode || (z.w != null && !z.full ? 'free' : 'wall'), cw, cx, ml, mr;      // 266번 전에 저장한 입체 방: 가로를 손댔으면 '직접', 아니면 '벽에서 벽'
    if (mode === 'win') { ml = clamp(z.ml == null ? 0.25 : z.ml, 0, mlMax); mr = clamp(z.mr == null ? 0.25 : z.mr, 0, mrMax); cw = u.w + ml + mr; cx = u.a - ml + cw / 2; }
    else if (mode === 'free') { cw = clamp(z.w == null ? recW : z.w, minW, maxW); cx = clamp(z.cx == null ? u.cx : z.cx, u.lo + cw / 2, u.hi - cw / 2); }
    else { cw = maxW; cx = (u.lo + u.hi) / 2; }
    if (mode !== 'win') { ml = Math.max(0, u.a - (cx - cw / 2)); mr = Math.max(0, cx + cw / 2 - u.b); }
    var full = cw >= maxW - 0.0005;
    var nabi = C.pleat === 'nabi', need = Math.max(2, Math.ceil(cw / 0.75 - 0.001));                    // 나비 주름은 2배 주름 — 소폭(1.5 m)으로 가로의 2배가 안 되면 못 만든다: 3.0 m 4폭, 3.6 m 5폭
    var base = z.pok != null ? z.pok : Math.max(2, Math.round(cw / 0.75));                              // 손대기 전: 가로 75 cm마다 한 폭 (3.0 m 4폭 · 3.6 m 5폭 · 4.5 m 6폭)
    var cover = Math.max(2, Math.ceil(cw * 1.5 / 1.5 - 0.001));                                        // 일반 주름으로 만들어 주는 가장 적은 배수는 1.5배(결정 #398 — 바람은 2배, 가격 때문에 1.5배를 고르는 손님이 꽤 있고 작은 방은 1.5배도 많이 한다): 3.0 m 3폭, 3.6 m · 4.0 m 4폭, 4.5 m 5폭부터 (결정 #146과 같다)
    var minPok = nabi ? need : cover, pok = Math.max(base, minPok), n = pok * 3;                        // 주름은 두 가지 모두 한 폭에 6개 — 한쪽 겉커튼에 절반
    var dmin = clamp(pok / 2 * (nabi ? 0.125 : 0.11), 0.1, cw * 0.3), dw = dmin + (cw / 2 - dmin) * (1 - C.open);      // 걷었을 때 모이는 폭도 폭수를 따라간다
    var cloth = 1.5 / 6, lam = dw / n;                                                                  // 주름 하나에 드는 천 · 주름 하나의 폭
    var A0 = clamp(0.25 * Math.sqrt(Math.max(0, cloth * cloth - lam * lam)), 0.008, 0.045);             // 천이 남는 만큼 앞뒤로 굽이친다
    var smin = clamp(cw * 0.055, 0.08, cw * 0.3), sdw = smin + (cw / 2 - smin) * (1 - C.sopen);      // 19판: 속지 한쪽 자락의 폭 — 다 걷으면 smin까지 모인다(겉지보다 얇아 조금 덜 차지한다 — 시안 값)
    return { key: key, wall: i, smin: smin, sdw: sdw, cw: cw, cx: cx, topY: topY, botY: botY, hang: hang, len: hang - botY, h: topY - botY, cy: (topY + botY) / 2, dw: dw, dmin: dmin, full: full, pok: pok, minPok: minPok, n: n, A: A0, ns: Math.max(6, Math.round(cw * 8)),      // ns: 속커튼은 가로의 2배 · len: 다는 높이에서 아랫단까지(커튼 길이)
      uw: u.w, ucx: u.cx, lo: u.lo, hi: u.hi, usill: u.sill, utop: u.top, L: L, zs: rz.s, zd: rz.d, minW: minW, maxW: maxW, recW: recW, ceilY: ceilY, frameY: frameY, floorY: floorY, sillY: sillY, botMax: botMax, hasBox: hasBox,
      mode: mode, ml: ml, mr: mr, mlMax: mlMax, mrMax: mrMax, ua: u.a, ub: u.b, hem: hem, gap: gap, below: below, sillOK: sillOK };      // 266번
  }
  function szOf(key) { return C.sz[key] || (C.sz[key] = {}); }
  function seedCur(g, w, h) {      // 266번: 앱 품목의 가로 · 높이가 처음 크기(그림과 견적이 같은 숫자에서 시작) — 크기 칸만 새로(폭수 · 위 손잡이로 옮긴 다는 높이는 그대로)
    var z = szOf(gkey(g)), u, m, y;
    ['mode', 'ml', 'mr', 'w', 'cx', 'full', 'hem', 'gap', 'below', 'bot'].forEach(function (k) { delete z[k]; });
    u = CB(g); m = w ? (w - u.uw) / 2 : 0;
    if (!w) { }      // 가로: 벽(박스) 끝에서 끝이면 '벽에서 벽', 창보다 양옆이 같게 넓으면 '창 기준'(양옆 반씩 — 1 cm가 남으면 오른쪽에), 아니면 '직접'
    else if (w >= u.maxW - 0.005) { z.mode = 'wall'; z.full = true; }
    else if (m >= -0.005 && m <= Math.min(u.mlMax, u.mrMax) + 0.005) { z.mode = 'win'; z.ml = Math.max(0, Math.floor(m * 100 + 1e-6) / 100); z.mr = Math.max(0, Math.round((2 * m - z.ml) * 100) / 100); }
    else { z.mode = 'free'; z.w = clamp(w, u.minW, u.maxW); z.full = false; }
    if (h) {      // 높이: 다는 곳에서 바닥 위 10 cm 안까지 내려오면 '바닥까지', 그보다 짧으면 '창 아래 ○ cm'(창이 바닥에서 30 cm 안이면 바닥에서 뜬 채로)
      z.hem = 'floor'; u = CB(g); y = u.hang - h;
      if (u.sillOK && y >= 0.1) { z.hem = 'win'; z.below = clamp(u.usill - y, 0, u.usill); }
      else z.gap = clamp(y, 0, u.botMax);
    }
    u = CB(g); m = { w: w ? cm(u.cw) - Math.round(w * 100) : 0, h: h ? cm(u.len) - Math.round(h * 100) : 0 };      // 품목 크기를 그릴 수 없을 때(창보다 좁거나 · 창을 다 못 덮거나 · 천장보다 긴 길이) — 그린 크기와의 차이를 처음부터 세어 둔다: 완료하면 견적이 장에 보이는 숫자가 된다
    if (m.w || m.h) DELTA.cur = m; else delete DELTA.cur;
  }
  // 블라인드가 걸리는 자리 — 창마다 한 장. 창을 조금 덮되 옆 창과 붙어 있으면 그쪽은 덮지 않는다. 커튼박스가 있고 앞뒤 폭이 넉넉하면 박스 안에서 내려온다(창틀에 달 수도 있다 — C.bat). 폭이 좁으면 창틀에만
  function BB(j) {
    if (j == null || !WINS[j]) j = WINS[S.wsel] ? S.wsel : 0;
    var w = WINS[j], z = C.bl[j] || NOSZ, L = wlen(w.wall), bw = bx(w.wall), K = BK[bkNow()], fits = bw.on && bw.d >= K.box - 0.0005, inBox = fits && C.bat !== 'win', pad = inBox ? 0.1 : 0.04, gl = Infinity, gr = Infinity;
    WINS.forEach(function (o) { if (o === w || o.wall !== w.wall) return; if (o.x < w.x) gl = Math.min(gl, (w.x - w.w / 2) - (o.x + o.w / 2)); else gr = Math.min(gr, (o.x - o.w / 2) - (w.x + w.w / 2)); });
    var sgB = inBox ? boxSeg(w.wall) : { a: -L / 2, b: L / 2 }, mxL = Math.max(-0.005, Math.min(gl / 2 - 0.005, w.x - w.w / 2 - sgB.a)), mxR = Math.max(-0.005, Math.min(gr / 2 - 0.005, sgB.b - (w.x + w.w / 2)));      // 양옆으로 더 나갈 수 있는 만큼(옆 창 · 벽 끝까지)
    var el = Math.min(pad, mxL), er = Math.min(pad, mxR), recW = w.w + el + er, minW = w.w + Math.min(0, mxL) + Math.min(0, mxR), maxW = w.w + mxL + mxR, ex;
    if (z.w != null) { ex = clamp(z.w, minW, maxW) - w.w; el = Math.min(ex / 2, mxL); er = Math.min(ex - el, mxR); el = Math.min(ex - er, mxL); }      // 손댄 가로 — 창 가운데에서 양옆으로, 막힌 쪽이 있으면 남는 만큼 반대쪽으로
    var a = w.x - w.w / 2 - el, b = w.x + w.w / 2 + er;
    var hang = inBox ? R.H + bw.h * bw.k : Math.min(R.H - 0.01, w.top + 0.12), top = hang - K.cas[0] - (inBox ? 0.01 : 0), botMax = Math.max(w.sill, 0.1);      // hang: 다는 높이(박스 안 천장 · 창틀 위) · 윗상자 높이만큼 내려와서 판이 시작된다
    var bot = z.bot == null ? Math.max(0.01, w.sill - 0.04) : clamp(z.bot, 0, botMax), full = top - bot, minH = 0.12;
    var h = minH + (full - minH) * (1 - C.open);
    return { j: j, w: b - a, cx: (a + b) / 2, wx: w.x, top: top, bot: bot, hang: hang, len: hang - bot, full: full, minH: minH, h: h, y: top - h, zo: inBox ? bw.d / 2 : Math.max(ZB, K.cas[1] / 2 + 0.004), ch: K.cas[0], cd: K.cas[1], inBox: inBox, fits: fits, wall: w.wall, minW: minW, maxW: maxW, recW: recW, botMax: botMax };
  }
  function blOf(j) { return C.bl[j] || (C.bl[j] = {}); }
  // 창으로 드는 빛 — 창 방향에 따라 세기와 기울기가 달라진다 (남 세게 · 동서 비스듬히 · 북 약하게)
  function sun() {
    var d = A.dir || [], pw = { '남': 1, '동': 0.8, '서': 0.8, '북': 0.4 };
    if (!d.length) return { p: 1, sk: 0 };
    return { p: d.reduce(function (s, x) { return s + pw[x]; }, 0) / d.length, sk: (d.indexOf('동') >= 0 ? 1 : 0) - (d.indexOf('서') >= 0 ? 1 : 0) };
  }

  // 주름진 천 한 장 — 폭 w를 주름 n개로 나눠 앞뒤로 굽이치게 짓는다. dir: 바깥 끝에서 안쪽으로 가는 방향(+1 / -1)
  function ribbon(w, h, n, A0, mode, dir, hem, dbl) {      // hem(18판): 밑단 시접의 높이(0이면 없음 — 리드밴드) · dbl: 접힌 자리를 한 겹 더 짓는다(비치는 속지)
    var nabi = mode === 'nabi', lam = w / n, q = lam < 0.03 ? 4 : (nabi ? 12 : 8), K = n * q;
    var pin = Math.min(0.09, h * 0.2), hw = Math.min(0.02, lam * 0.3), Ap = clamp(A0, 0.014, 0.035), e = 0.002;
    var ys = nabi ? [h / 2, h / 2 - pin, -h / 2] : [h / 2, -h / 2], y1 = ys[1], hr = -1;
    if (hem && h > hem + pin + 0.15) { hr = ys.length - 1; ys.splice(hr, 0, -h / 2 + hem, -h / 2 + hem); }      // 시접 — 아랫단에서 hem 위에 접어 박은 선. 그 아래는 천이 두 겹이라 아주 조금 짙다(같은 자리에 줄을 둘 두어 경계가 번지지 않게)
    var last = ys.length - 1;
    function zWave(u) { return -A0 * Math.cos(2 * Math.PI * u / lam); }
    function zPin(u) { var f = u / lam, du = Math.abs(f - Math.floor(f) - 0.5) * lam; return -0.004 + (Ap + 0.004) * Math.max(0, 1 - du / hw); }      // 윗단: 평평하다가 집은 자리만 앞으로
    function zAt(u, r) { if (!nabi) return zWave(u); if (r < 2) return zPin(u); var tt = (y1 - ys[r]) / (y1 + h / 2); return zPin(u) * (1 - tt) + zWave(u) * tt; }      // 나비주름: 집은 자리에서 아랫단까지 차츰 풀린다
    var pos = [], uv = [], col = [], idx = [], r, i, k, u, x, p, p1, zz, sh;
    for (r = 0; r <= last; r++) for (i = 0; i <= K; i++) {
      u = w * i / K; zz = zAt(u, r); pos.push(dir * u, ys[r], zz); uv.push(i / K, (ys[r] + h / 2) / h);
      sh = clamp(0.93 + 0.09 * (zz + A0) / (2 * Math.max(A0, 0.004)), 0.92, 1.03) * (hr >= 0 && r > hr ? HEMK : 1); col.push(sh, sh, sh);      // 주름 골은 조금 어둡게, 마루는 조금 밝게 — 평균은 고른 색 그대로에 가깝게(색 판단을 흐리지 않을 만큼만)
    }
    for (r = 0; r < last; r++) for (i = 0; i < K; i++) { var a = r * (K + 1) + i, c = a + K + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    var edge = [], fold = [], pinL = [], hemL = [], hemGeo = null;
    [0, last].forEach(function (rr) { for (i = 0; i < K; i++) { p = (rr * (K + 1) + i) * 3; edge.push(pos[p], pos[p + 1], pos[p + 2] + e, pos[p + 3], pos[p + 4], pos[p + 5] + e); } });      // 윗단 · 아랫단
    [0, K].forEach(function (ii) { p = ii * 3; p1 = (last * (K + 1) + ii) * 3; edge.push(pos[p], pos[p + 1], pos[p + 2] + e, pos[p1], pos[p1 + 1], pos[p1 + 2] + e); });                         // 양옆
    if (hr >= 0) {
      for (i = 0; i < K; i++) { p = (hr * (K + 1) + i) * 3; hemL.push(pos[p], pos[p + 1], pos[p + 2] + e, pos[p + 3], pos[p + 4], pos[p + 5] + e); }      // 박은 선 — 주름을 따라간다
      if (dbl) {
        var hp = [], hu = [], hi = [];
        [hr, last].forEach(function (rr) { for (i = 0; i <= K; i++) { p = (rr * (K + 1) + i) * 3; hp.push(pos[p], pos[p + 1], pos[p + 2] + 0.0012); hu.push(i / K, rr === hr ? 1 : 0); } });
        for (i = 0; i < K; i++) hi.push(i, i + K + 1, i + 1, i + 1, i + K + 1, i + K + 2);
        hemGeo = new THREE.BufferGeometry(); hemGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); hemGeo.setAttribute('uv', new THREE.Float32BufferAttribute(hu, 2)); hemGeo.setIndex(hi);
      }
    }
    var skipN = Math.max(1, Math.ceil(0.012 / lam));      // 걷어서 촘촘해지면 선을 건너뛴다
    var fw = Math.min(0.015, lam * 0.22), yf = ys[1] - Math.min(0.07, h * 0.1), tf = nabi ? (ys[1] - yf) / (ys[1] + h / 2) : 0;
    for (k = 0; k < n; k += skipN) {
      u = (k + 0.5) * lam; x = dir * u;
      if (nabi) {      // 나비주름: 윗단에서 한 점으로 집히고(V), 그 아래로 벌어져 두 줄로 떨어진다
        pinL.push(x - hw, h / 2, e, x, ys[1], Ap + e, x + hw, h / 2, e, x, ys[1], Ap + e, x, h / 2, Ap + e, x, ys[1], Ap + e);
        [-1, 1].forEach(function (s) {
          var uu = u + s * fw, zf = zPin(uu) * (1 - tf) + zWave(uu) * tf;
          pinL.push(x, ys[1], Ap + e, x + s * fw, yf, zf + e * 2);
          fold.push(x + s * fw, yf, zf + e, x + s * fw, -h / 2, zWave(uu) + e);
        });
      } else fold.push(x, h / 2, A0 + e, x, -h / 2, A0 + e);      // 일반 주름: 앞으로 나온 마루마다 한 줄
    }
    return { geo: geo, edge: edge, fold: fold, pin: pinL, hem: hemL, hemGeo: hemGeo };
  }

  function ribbon2(vw, h, n, A0, hem, dw) {      // 양옆으로 걷힌 속지(19판) — 왼쪽 자락(0 → dw)과 오른쪽 자락(vw − dw → vw)을 한 덩어리로. 덮개 그림(비침)은 벌 전체 폭에 맞춰 칠하므로 가로 자리(uv)는 벌 기준으로 다시 매긴다
    var a = ribbon(dw, h, n, A0, 'wave', 1, hem, true), b = ribbon(dw, h, n, A0, 'wave', -1, hem, true);
    function shift(arr) { var o = arr.slice(), i; for (i = 0; i < o.length; i += 3) o[i] += vw; return o; }
    function join(g1, g2) {
      if (!g1 || !g2) return null;
      var p1 = g1.attributes.position.array, p2 = g2.attributes.position.array, n1 = p1.length / 3, n2 = p2.length / 3, P = new Float32Array(p1.length + p2.length), U = new Float32Array((n1 + n2) * 2), u1 = g1.attributes.uv.array, u2 = g2.attributes.uv.array, I = [], i, g = new THREE.BufferGeometry();
      P.set(p1); P.set(p2, p1.length); for (i = p1.length; i < P.length; i += 3) P[i] += vw;
      for (i = 0; i < n1 + n2; i++) { U[i * 2] = P[i * 3] / vw; U[i * 2 + 1] = i < n1 ? u1[i * 2 + 1] : u2[(i - n1) * 2 + 1]; }
      for (i = 0; i < g1.index.count; i++) I.push(g1.index.getX(i));
      for (i = 0; i < g2.index.count; i++) I.push(g2.index.getX(i) + n1);
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(I);
      g1.dispose(); g2.dispose(); return g;
    }
    return { geo: join(a.geo, b.geo), edge: a.edge.concat(shift(b.edge)), fold: a.fold.concat(shift(b.fold)), pin: [], hem: a.hem.concat(shift(b.hem)), hemGeo: join(a.hemGeo, b.hemGeo) };
  }
  function bandGeo(w, h, list, shade) {      // 가로 띠 여러 줄 — list: 위에서부터 [y0, y1] · shade: 밝기(면마다 밝기를 달리하는 재료에 쓸 때)
    var P = [], U = [], I = [], Cc = [];
    list.forEach(function (q) { var n = P.length / 3, a = h / 2 - q[0], b = h / 2 - q[1]; P.push(-w / 2, b, 0, w / 2, b, 0, w / 2, a, 0, -w / 2, a, 0); U.push(0, 1 - q[1] / h, 1, 1 - q[1] / h, 1, 1 - q[0] / h, 0, 1 - q[0] / h); I.push(n, n + 1, n + 2, n, n + 2, n + 3); if (shade) Cc.push(shade, shade, shade, shade, shade, shade, shade, shade, shade, shade, shade, shade); });
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); if (shade) g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I); return g;
  }
  // 블라인드 한 장을 짓는다(18판) — 콤비: 앞뒤 두 겹(막힌 띠 · 비치는 띠가 번갈아). 뒤 겹이 반 칸 내려가면 비치는 띠가 막힌 띠에 가려 닫히고, 띠끼리 겹치면 창밖이 보인다
  // 우드 · 알루미늄: 살을 한 장씩 지어 긴 축으로 돌린다(닫힘 75° ↔ 열림 0°). 걷어 올리면 살이 밑단 막대 위에 차곡차곡 쌓인다. 롤: 민판
  // 그늘이 없는 방이라 살의 윗면 · 아랫면 · 테두리는 선과 아주 옅은 밝기 차이로만 읽힌다(닫힌 살은 고른 색 그대로). 넓이를 재는 면(b.id · b.zone)과 누르는 면(b.hit)은 늘 판 전체
  function quadPush(P, Cc, I, a, b, c, d, k) { var n = P.length / 3; P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]); Cc.push(k, k, k, k, k, k, k, k, k, k, k, k); I.push(n, n + 1, n + 2, n, n + 2, n + 3); }
  function quadPush4(P, Cc, I, a, b, c, d, ka, kb, kc, kd) { var n = P.length / 3; P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]); Cc.push(ka, ka, ka, kb, kb, kb, kc, kc, kc, kd, kd, kd); I.push(n, n + 1, n + 2, n, n + 2, n + 3); }      // 꼭짓점마다 밝기가 다른 네모
  // 살에 번지는 빛(19판, 11-25 사장님: 화이트 우드가 예쁜 까닭) — 조명 계산 없이 살 한 장의 폭을 따라 밝기만 달리 칠한다. 낮에만, 창 방향 세기만큼, 기울기에 따라(반쯤일 때 가장 넓게)
  function glowNow() { return S.night ? 0 : sun().p * SUNK.k; }      // 263번
  function slatGlow(SL, t) {      // 살 윗면을 폭을 따라 나눈 띠 — [자리 0(방 쪽 끝) → 1(창 쪽 끝) 둘, 밝기 둘]. 닫힌 살의 한가운데는 늘 고른 색 그대로(1)
    var gl = glowNow(), G = SL.glow[0] * gl * (0.7 + 0.3 * Math.sin(Math.PI * t)), sh = SL.glow[1] * gl * (1 - 0.6 * t), m1 = 1 + G * 0.3 * t, m2 = 1 + G * (0.3 + 0.35 * t);
    if (gl < 0.01) return [[0, 1, 1, 1]];
    if (SL.soft) return [[0, 0.4, 1 - sh, m1], [0.4, 0.72, m1, m2], [0.72, 1, m2, 1 + G]];      // 우드 — 창 쪽 끝에서 부드럽게 번져 들어온다
    return [[0, 0.2, 1 - sh, 1 - sh], [0.2, 0.74, 1, 1], [0.74, 1, 1 + G, 1 + G]];      // 알루미늄 — 가늘고 또렷한 띠
  }
  function blindGeo(b, bb, L) {
    var kn = bkNow(), K = BK[kn], SL = SLAT[kn], vbw = Math.min(bb.w, L - 0.006), hx = vbw / 2, by = bb.h / 2, e = 0.001, t = clamp(SLV, 0, 1), sl = [], ed, y;
    var bg = new THREE.PlaneGeometry(vbw, bb.h); b.id.geometry.dispose(); b.id.geometry = b.hit.geometry = bg;
    b.m.position.set(bb.cx, bb.top - by, bb.zo); b.p.size(bb.w, bb.h, 11); b.band = !!K.band; b.m2.visible = b.m4.visible = b.band; b.sm.visible = !!(K.band || SL); b.sm.position.z = b.m4.position.z = 0;
    if (K.band) {      // 콤비 — 앞 겹은 제자리, 뒤 겹이 sft만큼 아래로(닫힘 = 반 칸)
      var bd = bandNow(), b0 = bd[0], per = b0 + bd[1], sft = (1 - t) * per / 2, opq = [], thin = [], opq2 = [], thin2 = [], a0, a1;
      for (y = 0; y < bb.h - 0.0005; y += per) { opq.push([y, Math.min(bb.h, y + b0)]); if (y + b0 < bb.h - 0.0005) thin.push([y + b0, Math.min(bb.h, y + per)]); }
      for (y = sft - per; y < bb.h - 0.0005; y += per) {
        a0 = Math.max(0, y); a1 = Math.min(bb.h, y + b0); if (a1 - a0 > 0.0005) opq2.push([a0, a1]);
        a0 = Math.max(0, y + b0); a1 = Math.min(bb.h, y + per); if (a1 - a0 > 0.0005) thin2.push([a0, a1]);
      }
      setGeo(b.m, bandGeo(vbw, bb.h, opq)); setGeo(b.m2, bandGeo(vbw, bb.h, thin)); setGeo(b.sm, bandGeo(vbw, bb.h, opq2, BACKK)); setGeo(b.m4, bandGeo(vbw, bb.h, thin2));
      b.sm.position.z = b.m4.position.z = -0.012;      // 두 겹 사이
      opq.forEach(function (q) { q.forEach(function (yy) { if (yy > 0.001 && yy < bb.h - 0.001) sl.push(-hx, by - yy, e, hx, by - yy, e); }); });
      ed = [-hx, by, e, hx, by, e, hx, by, e, hx, -by, e, hx, -by, e, -hx, -by, e, -hx, -by, e, -hx, by, e, -hx, -by + 0.03, e, hx, -by + 0.03, e];
    } else if (SL) {      // 우드 · 알루미늄 — 살 한 장씩
      var p = K.slat, hw2 = p * SL.w / 2, nt = SL.th / 2, rail = SL.rail, room = Math.max(p, bb.full - rail), N = Math.max(1, Math.floor(room / p + 0.001)), rem = Math.max(0, room - N * p);
      var hang = clamp((bb.h - rail - N * SL.st - rem) / (p - SL.st), 0, N), m = Math.floor(hang + 0.001), stT = clamp(bb.h - rail - (N - m) * SL.st, 0, bb.h - rail);      // m: 매달려 있는 살 · stT: 쌓인 살 더미의 윗자리(위에서부터)
      var ph = SLCLOSE * (1 - t), c = Math.cos(ph), s = Math.sin(ph), P = [], Cc = [], I = [], i, yc, o = 0.0008, zf = hw2 * c + nt * s + 0.002, yT = by - stT, yB = -by;
      ed = [];
      var GS = slatGlow(SL, t), GU = SLK[0] + (SL.soft ? 0.5 : 0.3) * SL.glow[0] * glowNow() * t;      // GS: 윗면의 밝기 띠 · GU: 아랫면의 창 쪽 끝(열리면 아랫살에서 되비친 빛을 받는다)
      for (i = 0; i < m; i++) {
        y = rem + (i + 0.5) * p; if (y + hw2 * s > stT + 0.004) break; yc = by - y;
        var Fy = yc - hw2 * s, Fz = hw2 * c, By = yc + hw2 * s, Bz = -hw2 * c, ny = c * nt, nz = s * nt;      // F: 방 쪽 끝(닫히면 아래로) · B: 창 쪽 끝 · (ny, nz): 윗면이 보는 쪽
        GS.forEach(function (q) {      // 윗면 — 닫히면 방을 본다. 낮에는 창 쪽 끝에서 빛이 번져 들어온다(19판)
          var ya = Fy + (By - Fy) * q[0] + ny, za = Fz + (Bz - Fz) * q[0] + nz, yb = Fy + (By - Fy) * q[1] + ny, zb = Fz + (Bz - Fz) * q[1] + nz;
          quadPush4(P, Cc, I, [-hx, ya, za], [hx, ya, za], [hx, yb, zb], [-hx, yb, zb], q[2], q[2], q[3], q[3]);
        });
        quadPush4(P, Cc, I, [-hx, Fy - ny, Fz - nz], [-hx, By - ny, Bz - nz], [hx, By - ny, Bz - nz], [hx, Fy - ny, Fz - nz], SLK[0], GU, GU, SLK[0]);      // 아랫면
        if (nt) {
          quadPush(P, Cc, I, [-hx, Fy - ny, Fz - nz], [hx, Fy - ny, Fz - nz], [hx, Fy + ny, Fz + nz], [-hx, Fy + ny, Fz + nz], SLK[1]);    // 앞 테두리(두께)
          quadPush(P, Cc, I, [-hx, By + ny, Bz + nz], [hx, By + ny, Bz + nz], [hx, By - ny, Bz - nz], [-hx, By - ny, Bz - nz], SLK[2]);    // 뒤 테두리
        }
        var fy = Fy + ny - s * o, fz = Fz + nz + c * o, ky = By + ny + s * o, kz = Bz + nz - c * o;
        sl.push(-hx, fy, fz, hx, fy, fz); if (SL.back) sl.push(-hx, ky, kz, hx, ky, kz);      // 살의 앞 끝 선(닫히면 살마다 한 줄) · 뒤 끝 선
        if (SL.ends) sl.push(-hx - o, fy, fz, -hx - o, ky, kz, hx + o, fy, fz, hx + o, ky, kz);
      }
      // 쌓인 살 더미 + 밑단 막대 — 다 내리면 막대만
      quadPush(P, Cc, I, [-hx, yB, hw2], [hx, yB, hw2], [hx, yT, hw2], [-hx, yT, hw2], 1);
      quadPush(P, Cc, I, [-hx, yT, hw2], [hx, yT, hw2], [hx, yT, -hw2], [-hx, yT, -hw2], 1);
      quadPush(P, Cc, I, [-hx, yB, -hw2], [hx, yB, -hw2], [hx, yB, hw2], [-hx, yB, hw2], SLK[0]);
      ed.push(-hx, yT, hw2 + e, hx, yT, hw2 + e, hx, yT, hw2 + e, hx, yB, hw2 + e, hx, yB, hw2 + e, -hx, yB, hw2 + e, -hx, yB, hw2 + e, -hx, yT, hw2 + e, -hx, yT, hw2, -hx, yT, -hw2, hx, yT, hw2, hx, yT, -hw2, -hx, yT, -hw2, hx, yT, -hw2);
      if (yT - yB > rail + 0.003) { ed.push(-hx, yB + rail, hw2 + e, hx, yB + rail, hw2 + e); for (y = yB + rail + Math.max(SL.st, 0.012); y < yT - 0.004; y += Math.max(SL.st, 0.012)) sl.push(-hx, y, hw2 + e, hx, y, hw2 + e); }      // 쌓인 살은 촘촘한 가로줄로
      // 살을 잇는 줄(19판, 결정 #405) — 우드는 실(앞뒤 한 줄씩)이 기본이고 리본밴드(넓은 띠 · 앞뒤 한 장씩)는 추가 옵션(C.tape), 알루미늄은 가는 줄 하나. 1 m 안팎마다
      var nn = Math.max(2, Math.ceil((vbw - 0.3) / 1.0) + 1), tx0 = -(hx - Math.min(0.15, vbw * 0.18)), ti, tx, ta, tb;
      if (yT < by - 0.002) for (ti = 0; ti < nn; ti++) {
        tx = tx0 - 2 * tx0 * ti / (nn - 1);
        if (K.tape && C.tape) {
          ta = tx - K.tape / 2; tb = tx + K.tape / 2;
          quadPush(P, Cc, I, [ta, yT, zf], [tb, yT, zf], [tb, by, zf], [ta, by, zf], SLK[3]);
          quadPush(P, Cc, I, [ta, yT, -zf], [tb, yT, -zf], [tb, by, -zf], [ta, by, -zf], SLK[2]);      // 뒤 띠 — 살이 누우면 살 사이로 보인다
          ed.push(ta, by, zf + e, ta, yT, zf + e, tb, by, zf + e, tb, yT, zf + e);
        } else { sl.push(tx, by, zf, tx, yT, zf); if (SL.back) sl.push(tx, by, -zf, tx, yT, -zf); }
      }
      var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); sg.setIndex(I);
      setGeo(b.sm, sg); setGeo(b.m, new THREE.BufferGeometry()); setGeo(b.m2, new THREE.BufferGeometry()); setGeo(b.m4, new THREE.BufferGeometry());
    } else {      // 롤 — 민판
      setGeo(b.m, new THREE.PlaneGeometry(vbw, bb.h)); setGeo(b.m2, new THREE.BufferGeometry()); setGeo(b.m4, new THREE.BufferGeometry()); setGeo(b.sm, new THREE.BufferGeometry());
      ed = [-hx, by, e, hx, by, e, hx, by, e, hx, -by, e, hx, -by, e, -hx, -by, e, -hx, -by, e, -hx, by, e, -hx, -by + 0.03, e, hx, -by + 0.03, e];
    }
    b.f.material = K.strong ? hemMat : foldMat;
    setLines(b.f, sl); setLines(b.e, ed);
    setGeo(b.cas, new THREE.BoxGeometry(Math.min(bb.w + 0.02, L - 0.006), bb.ch, bb.cd)); b.cas.position.set(bb.cx, bb.top + bb.ch / 2, bb.zo); setEdges(b.casE, b.cas.geometry);
    b.cas.material = K.own ? b.p.mat : railMat;      // 우드 · 알루미늄은 윗상자가 살과 같은 색
    setGeo(b.zone, new THREE.PlaneGeometry(vbw, bb.full)); b.zone.position.set(bb.cx, bb.top - bb.full / 2, bb.zo);
  }
  function hemGo() {      // 시접 ↔ 리드밴드 — 박은 선이 아랫단으로 내려가며 사라지고, 아랫단에서 올라온다. 겉지 · 속지가 저마다(19판)
    var a = HEMV, to = C.lead ? 0 : 1, a2 = DHEMV, to2 = C.dlead ? 0 : 1, id = ++HEMID;
    if (CALM || (Math.abs(a - to) < 0.001 && Math.abs(a2 - to2) < 0.001)) { HEMV = to; DHEMV = to2; layout(); return; }
    tween(450, function (k) { if (id !== HEMID) return; HEMV = a + (to - a) * k; DHEMV = a2 + (to2 - a2) * k; layout(); });
  }
  function blindsGeo() { WINS.forEach(function (w, j) { var b = POOL['b' + j]; if (b && b.live) blindGeo(b, BB(j), wlen(w.wall)); }); invalidate(); }
  function slitGo() {      // 닫힘 ↔ 열림 — 뚝 바뀌지 않고 살이 돌아가고 띠가 밀려 간다(방의 다른 움직임과 같은 결)
    var a = SLV, to = C.slit, id = ++SLID;
    if (CALM || Math.abs(a - to) < 0.001) { SLV = to; blindsGeo(); return; }
    tween(slitKind() === 'slat' ? 700 : 900, function (k) { if (id !== SLID) return; SLV = a + (to - a) * k; blindsGeo(); paintRoom(false); });
  }
  // 벽 한 장 — 창 자리를 비우고 짓는다. 칸으로 나눠 창이 아닌 칸만 채우므로 창이 바닥에 닿거나 서로 겹쳐도 된다
  function wallGeo(len, ext, H, T, holes) {
    function grid(x0, x1) {
      var xs = [x0, x1], ys = [0, H];
      function uq(a) { a.sort(function (p, q) { return p - q; }); return a.filter(function (v, i) { return !i || v - a[i - 1] > 0.0005; }); }
      holes.forEach(function (h) { xs.push(clamp(h[0], x0, x1), clamp(h[1], x0, x1)); ys.push(clamp(h[2], 0, H), clamp(h[3], 0, H)); });
      xs = uq(xs); ys = uq(ys);
      return { xs: xs, ys: ys, hole: function (i, j) {
        if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
        var cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
        return holes.some(function (h) { return cx > h[0] && cx < h[1] && cy > h[2] && cy < h[3]; });
      } };
    }
    function quad(P, I, a, b, c, d) { var n = P.length / 3; P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]); I.push(n, n + 1, n + 2, n, n + 2, n + 3); }
    function geo(P, I, U) { var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); if (U) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); return g; }
    var F = grid(-len / 2, len / 2), B = grid(-ext / 2, ext / 2), fp = [], fi = [], fu = [], bp = [], bi = [], ln = [], e = 0.002, i, j, a, b, c, d, h4, n4;
    for (i = 0; i < F.xs.length - 1; i++) for (j = 0; j < F.ys.length - 1; j++) {      // 벽 겉(색이 칠해지는 면)
      if (F.hole(i, j)) continue;
      a = F.xs[i]; b = F.xs[i + 1]; c = F.ys[j]; d = F.ys[j + 1];
      quad(fp, fi, [a, c, 0], [b, c, 0], [b, d, 0], [a, d, 0]);
      fu.push(a / len + 0.5, c / H, b / len + 0.5, c / H, b / len + 0.5, d / H, a / len + 0.5, d / H);
    }
    var x0 = -ext / 2, x1 = ext / 2, nx = B.xs.length - 1, ny = B.ys.length - 1;
    for (i = 0; i < nx; i++) for (j = 0; j < ny; j++) {      // 벽 몸
      if (B.hole(i, j)) continue;
      a = B.xs[i]; b = B.xs[i + 1]; c = B.ys[j]; d = B.ys[j + 1];
      quad(bp, bi, [a, c, 0], [b, c, 0], [b, d, 0], [a, d, 0]); quad(bp, bi, [a, c, -T], [b, c, -T], [b, d, -T], [a, d, -T]);
      if (B.hole(i - 1, j)) quad(bp, bi, [a, c, 0], [a, d, 0], [a, d, -T], [a, c, -T]);      // 창 옆 · 위 · 아래로 드러나는 벽 두께
      if (B.hole(i + 1, j)) quad(bp, bi, [b, c, 0], [b, d, 0], [b, d, -T], [b, c, -T]);
      if (B.hole(i, j - 1)) quad(bp, bi, [a, c, 0], [b, c, 0], [b, c, -T], [a, c, -T]);
      if (B.hole(i, j + 1)) quad(bp, bi, [a, d, 0], [b, d, 0], [b, d, -T], [a, d, -T]);
    }
    quad(bp, bi, [x0, H, 0], [x1, H, 0], [x1, H, -T], [x0, H, -T]); quad(bp, bi, [x0, 0, 0], [x0, H, 0], [x0, H, -T], [x0, 0, -T]); quad(bp, bi, [x1, 0, 0], [x1, H, 0], [x1, H, -T], [x1, 0, -T]);
    // 선: 벽 상자의 모서리 + 창 자리의 테두리(앞 · 뒤)와 귀마다 두께 선
    [0, -T].forEach(function (z) { ln.push(x0, 0, z, x1, 0, z, x1, 0, z, x1, H, z, x1, H, z, x0, H, z, x0, H, z, x0, 0, z); });
    [[x0, 0], [x1, 0], [x1, H], [x0, H]].forEach(function (p) { ln.push(p[0], p[1], 0, p[0], p[1], -T); });
    for (i = 0; i < nx; i++) for (j = -1; j < ny; j++) {
      if (j >= 0 && i < nx - 1 && B.hole(i, j) !== B.hole(i + 1, j)) [e, -T].forEach(function (z) { ln.push(B.xs[i + 1], B.ys[j], z, B.xs[i + 1], B.ys[j + 1], z); });
      if (j < ny - 1 && B.hole(i, j) !== B.hole(i, j + 1)) [e, -T].forEach(function (z) { ln.push(B.xs[i], B.ys[j + 1], z, B.xs[i + 1], B.ys[j + 1], z); });
    }
    for (i = 1; i < nx; i++) for (j = 0; j < ny; j++) {
      h4 = [B.hole(i - 1, j - 1), B.hole(i, j - 1), B.hole(i - 1, j), B.hole(i, j)]; n4 = h4.filter(Boolean).length;
      if (n4 === 1 || n4 === 3 || (n4 === 2 && h4[0] === h4[3])) ln.push(B.xs[i], B.ys[j], e, B.xs[i], B.ys[j], -T);
    }
    return { body: geo(bp, bi), face: geo(fp, fi, fu), lines: ln };
  }
  // 샷시 — 사장님이 주신 사진(거실 분합문 · 방 창 · 베란다 창)을 따라 짓는다.
  // 틀은 벽 두께를 채우고 벽보다 조금 나오며 아래쪽(레일)이 더 두껍다. 창짝은 앞뒤 두 줄에 엇갈려 서고 유리는 맨 뒤에 있다.
  // 2짝: 반반, 손잡이는 양 바깥 선대(창틀에 잠기는 쪽) / 3짝: 가운데 넓은 고정창 + 양옆 작은 문(거실 분합문의 흔한 꼴 — 4 m면 1 · 2 · 1 m, 드나드는 문은 양옆) / 4짝: 양 끝 고정 + 가운데 두 짝이 만나 잠김(손잡이는 가운데)
  // 바닥까지 오는 창(문 꼴)은 아래 틀이 낮고 손잡이가 허리 높이에 짙은 색으로, 턱이 있는 창은 가운데 높이에 은색으로
  function ringGeo(w, h, sl, st, sb, depth) {      // 옆 · 위 · 아래 두께가 다른 네모 테
    var sh = new THREE.Shape(), ho = new THREE.Path();
    sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h); sh.lineTo(-w / 2, h); sh.lineTo(-w / 2, 0);
    ho.moveTo(-w / 2 + sl, sb); ho.lineTo(-w / 2 + sl, h - st); ho.lineTo(w / 2 - sl, h - st); ho.lineTo(w / 2 - sl, sb); ho.lineTo(-w / 2 + sl, sb);
    sh.holes.push(ho);
    return new THREE.ExtrudeGeometry(sh, { depth: depth, bevelEnabled: false, curveSegments: 1 });
  }
  function sashN(w) { var iw = w.w - 0.11; return w.n || (iw < 0.5 ? 1 : iw <= 2.3 ? 2 : 3); }      // 창짝 수 — 사장님이 고른 값(폰 실측 · 창을 다시 누르기)이 먼저, 없으면 폭을 보고 (결정 #386)
  function sash(o, w, h, sill, T, zG, n) {      // o.g의 원점은 창 아래 가운데(벽 면)
    var g = o.g, door = sill < 0.3, k = clamp(Math.min(w, h) / 0.4, 0.5, 1), f = 0.055 * k, fb = (door ? 0.04 : 0.075) * k, s = 0.06, sb = 0.07, iw = w - 2 * f, ih = h - f - fb, zA = -0.03, zB = -0.068, pd = 0.032, tk = [], ps, pw, pc;
    while (g.children.length) { var c0 = g.children[0]; g.remove(c0); c0.traverse(function (x) { if (x.geometry) x.geometry.dispose(); }); }
    function add(ge, x, y, z, mat) { var m = new THREE.Mesh(ge, mat || sashMat); m.position.set(x, y, z); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(ge, 30), lineMat)); g.add(m); }
    if (ih > 0.02 && iw > 0.02) add(ringGeo(w, h, f, f, fb, T + 0.002), 0, 0, -(T - 0.01));      // 틀 — 벽 두께를 채우고 벽보다 1 cm 남짓 나온다
    if (ih < 0.06 || iw < 0.06) { setLines(o.t, []); return; }
    if (iw < n * 0.16) n = Math.max(1, Math.floor(iw / 0.16));      // 너무 좁으면 짝 수를 줄인다
    s = clamp(Math.min(iw / n, ih) * 0.3, 0.022, 0.06); sb = s * 1.15;      // 작은 창(주방 · 욕실)도 틀과 선대는 굵은 그대로이고 유리가 작아진다(사진) — 유리가 남지 않을 만큼 작을 때만 가늘어진다
    // 창짝: [가운데 x, 폭, 앞면 z, 손잡이 쪽(-1 왼 선대 · 1 오른 선대 · 0 없음)]
    if (n === 1) ps = [[0, iw, zA, 0]];
    else if (n === 2) { pw = (iw + s) / 2; ps = [[-iw / 2 + pw / 2, pw, zB, -1], [iw / 2 - pw / 2, pw, zA, 1]]; }
    else if (n === 3) { pc = iw / 2 + s; pw = iw / 4 + s / 2; ps = [[-iw / 2 + pw / 2, pw, zB, -1], [0, pc, zA, 0], [iw / 2 - pw / 2, pw, zB, 1]]; }
    else { pw = (iw + 2 * s) / 4; ps = [[-iw / 2 + pw / 2, pw, zB, 0], [-pw / 2, pw, zA, 1], [pw / 2, pw, zA, -1], [iw / 2 - pw / 2, pw, zB, 0]]; }
    var hy = door ? 1.0 - sill : fb + ih / 2, hl = door ? 0.2 : Math.min(0.14, ih * 0.3), hok = hy > fb + sb + hl / 2 + 0.02 && hy < h - f - s - hl / 2 - 0.02;
    ps.forEach(function (p) {
      add(ringGeo(p[1], ih, s, s, sb, pd), p[0], fb, p[2] - pd);
      var gw = p[1] - 2 * s, g2 = ih - s - sb, L = Math.min(gw, g2) * 0.2, x = p[0] + gw / 2 - gw * 0.16 - L, y = fb + sb + g2 * 0.9 - L, z = zG + 0.002;
      tk.push(x, y, z, x + L, y + L, z, x + L * 0.5, y - L * 0.05, z, x + L * 1.05, y + L * 0.5, z);
      if (p[3] && hok) add(new THREE.BoxGeometry(Math.min(0.022, s * 0.5), hl, 0.02), p[0] + p[3] * (p[1] / 2 - s / 2), hy, p[2] + 0.01, door ? gripDark : gripMat);
    });
    setLines(o.t, tk);
  }

  function layout() {
    var W = R.W, D = R.D, H = R.H, T = R.T, key;
    WINS.forEach(function (w) {      // 창은 제 벽 안에 든다
      var L = wlen(w.wall);
      w.w = Math.min(w.w, L - 0.3); w.top = Math.min(w.top, H - 0.03); w.sill = Math.max(0, Math.min(w.sill, w.top - WMIN));
      w.x = clamp(w.x, -(L - w.w) / 2 + 0.02, (L - w.w) / 2 - 0.02);
    });
    if (S.wsel >= WINS.length) S.wsel = 0;
    setGeo(slab, new THREE.BoxGeometry(W + 2 * T, 0.06, D + 2 * T)); slab.position.y = -0.031; setEdges(slabE, slab.geometry);
    var fg = new THREE.PlaneGeometry(W, D); setGeo(floorM, fg); floorId.geometry = fg; setEdges(floorE, fg); floorE.position.z = 0.001; floorP.size(W, D);
    var bds = [0, 1, 2, 3].map(function (i) { var b = bx(i); return b.k > 0.001 ? b.d : 0; });      // 커튼박스가 있는 벽 앞에서는 천장이 끊긴다
    var cw = W - bds[1] - bds[3], cd = D - bds[0] - bds[2], cg = new THREE.PlaneGeometry(cw, cd); setGeo(ceil, cg); ceilId.geometry = cg; setEdges(ceilE, cg); ceilE.position.z = 0.001;
    ceil.position.set((bds[3] - bds[1]) / 2, H, (bds[0] - bds[2]) / 2); ceilId.position.copy(ceil.position); ceilP.size(cw, cd);
    var defs = [[0, 0, 1, 0, -D / 2, W, 0], [-1, 0, 0, W / 2, 0, D, -Math.PI / 2], [0, 0, -1, 0, D / 2, W, Math.PI], [1, 0, 0, -W / 2, 0, D, Math.PI / 2]];
    var kh = 0.08, kt = 0.012;
    WALLS.forEach(function (w, i) {
      var d = defs[i], len = d[5], ext = i % 2 === 0 ? len + 2 * T : len;
      w.n.set(d[0], d[1], d[2]); w.pos.set(d[3], 0, d[4]);
      w.vis.position.copy(w.pos); w.vis.rotation.y = d[6];
      WG[i].position.copy(w.pos); WG[i].rotation.y = d[6];
      var holes = GLS.k > 0.001 ? WINS.filter(function (o) { return o.wall === i; }).map(function (o) { return [o.x - o.w / 2, o.x + o.w / 2, o.sill, o.sill + (o.top - o.sill) * GLS.k]; }) : [];      // 창 자리는 벽을 뚫는다
      var wg = wallGeo(len, ext, H, T, holes);
      setGeo(w.body, wg.body); setLines(w.bodyE, wg.lines);
      setGeo(w.face, wg.face); w.face.position.set(0, 0, 0.001); w.p.size(len, H);
      setLines(w.faceE, [-len / 2, 0, 0, len / 2, 0, 0, len / 2, 0, 0, len / 2, H, 0, len / 2, H, 0, -len / 2, H, 0, -len / 2, H, 0, -len / 2, 0, 0]); w.faceE.position.z = 0.001;
      setGeo(w.id, new THREE.PlaneGeometry(len, H)); w.id.position.set(d[3], H / 2, d[4]); w.id.rotation.y = d[6];
      // 걸레받이 — 바닥까지 오는 창 앞에서 끊긴다
      var cuts = WINS.filter(function (o) { return o.wall === i && o.sill < kh; }).map(function (o) { return [o.x - o.w / 2, o.x + o.w / 2]; }).sort(function (a, b) { return a[0] - b[0]; });
      var segs = [], at = -len / 2;
      cuts.forEach(function (c) { if (c[0] - at > 0.02) segs.push([at, c[0]]); at = Math.max(at, c[1]); });
      if (len / 2 - at > 0.02) segs.push([at, len / 2]);
      while (w.base.length < segs.length) { var bm = mesh(modelMat), be = lines(); bm.add(be); w.base.push(bm); w.baseE.push(be); w.vis.add(bm); }
      w.base.forEach(function (b, j) {
        var sg = segs[j]; b.visible = !!sg; if (!sg) return;
        setGeo(b, new THREE.BoxGeometry(sg[1] - sg[0], kh, kt)); b.position.set((sg[0] + sg[1]) / 2, kh / 2, kt / 2 + 0.001); setEdges(w.baseE[j], b.geometry);
      });
      // 커튼박스 — 옆 벽에도 박스가 있으면 턱이 그 앞에서 끊기고(ㄱ자로 이어진다), 없으면 박스 끝을 막는다
      var bq = bx(i), bo = bq.k > 0.001, bh = bq.h * bq.k, bd = bq.d, q = w.bx, sgm = boxSeg(i), ba = sgm.a, bb2 = sgm.b, atA = ba <= -len / 2 + 0.001, atB = bb2 >= len / 2 - 0.001, bl2 = bb2 - ba, bm2 = (ba + bb2) / 2;
      var dP = atA ? bds[(i + 3) % 4] : 0, dN = atB ? bds[(i + 1) % 4] : 0;      // 박스가 벽 끝에 닿을 때만 옆 벽 박스와 ㄱ자로 잇는다
      [q.back, q.face, q.lip, q.cap, q.faceId, q.capId].forEach(function (o) { o.visible = bo; }); q.end[0].visible = bo && !dP; q.end[1].visible = bo && !dN;
      [[-len / 2, ba, atA], [bb2, len / 2, atB]].forEach(function (f, j) {      // 박스 바깥의 천장 — 벽 쪽 천장이 박스 앞뒤 폭만큼 끊겨 있으므로 메운다
        var fm = q.fill[j], fw = f[1] - f[0], on = bo && !f[2] && fw > 0.002; fm.visible = on; if (!on) return;
        var fg = new THREE.PlaneGeometry(fw, bd); setGeo(fm, fg); setEdges(q.fillE[j], fg); fm.position.set((f[0] + f[1]) / 2, H, bd / 2);
      });
      w.idg.position.copy(w.pos); w.idg.rotation.y = d[6];
      if (bo) {
        var bkw = (atA ? (ext - len) / 2 : 0) + bl2 + (atB ? (ext - len) / 2 : 0), bkx = bm2 + ((atA ? -(ext - len) / 4 : 0) + (atB ? (ext - len) / 4 : 0));      // 뒤 벽: 벽 끝에 닿으면 모서리 두께까지
        setGeo(q.back, new THREE.BoxGeometry(bkw, bh, T)); q.back.position.set(bkx, H + bh / 2, -T / 2); setEdges(q.backE, q.back.geometry);
        var bf = new THREE.PlaneGeometry(bl2, bh); setGeo(q.face, bf); q.face.position.set(bm2, H + bh / 2, 0.001); q.faceId.geometry = bf; q.faceId.position.set(bm2, H + bh / 2, 0.0005);
        setGeo(q.lip, new THREE.BoxGeometry(Math.max(0.01, bl2 - dP - dN), bh, 0.014)); q.lip.position.set(bm2 + (dP - dN) / 2, H + bh / 2, bd + 0.007); setEdges(q.lipE, q.lip.geometry);
        var bc = new THREE.PlaneGeometry(bl2, bd); setGeo(q.cap, bc); q.cap.position.set(bm2, H + bh, bd / 2); q.capId.geometry = bc; q.capId.position.set(bm2, H + bh, bd / 2);
        var bn = new THREE.PlaneGeometry(bd, bh); setGeo(q.end[0], bn); q.end[1].geometry = bn; q.end[0].position.set(ba + 0.001, H + bh / 2, bd / 2); q.end[1].position.set(bb2 - 0.001, H + bh / 2, bd / 2);
      }
    });
    for (key in POOL) POOL[key].live = false;
    var kd = kindNow(), sk = sun().sk, e = 0.001;
    WINS.forEach(function (w, j) {      // 창마다: 유리 · 바닥에 드는 빛 · (블라인드면) 블라인드 한 장
      var g = WG[w.wall], L = wlen(w.wall), gh = w.top - w.sill, gy = (w.top + w.sill) / 2, hw = w.w / 2;
      var gk = Math.max(0.001, GLS.k), zG = -(T - 0.02), gl = pool('g' + j, mkGlass); g.add(gl.m, gl.g, gl.t); gl.m.userData.hit = { win: j };
      setGeo(gl.m, new THREE.PlaneGeometry(w.w, gh * gk)); gl.m.position.set(w.x, w.sill + gh * gk / 2, zG);      // 유리는 벽 두께 안쪽에
      gl.g.position.set(w.x, w.sill, 0); gl.t.position.set(w.x, w.sill, 0); sash(gl, w.w, gh * gk, w.sill, T, zG, sashN(w));
      var pd = Math.min(1.9, (w.wall === 0 ? D : W) * 0.55), pw = 2 * Math.min((w.w + 0.9) / 2, L / 2 - Math.abs(w.x));
      var pt = pool('p' + j, mkPatch), pg2 = new THREE.PlaneGeometry(pw, pd), pp = pg2.attributes.position, vi; g.add(pt.m);
      for (vi = 0; vi < pp.count; vi++) if (pp.getY(vi) < 0) pp.setX(vi, pp.getX(vi) + sk * pd * 0.45);      // 방 안쪽 끝이 옆으로 밀린다
      setGeo(pt.m, pg2); pt.m.position.set(w.x, 0.004, pd / 2);
      if (kd !== 'blind') return;
      // 블라인드 한 장 — 종류마다 다르게(17판): 콤비 = 막힌 띠와 비치는 띠가 번갈아(두 겹) / 롤 = 민판 / 우드 = 5 cm 살에 넓은 띠 / 알루미늄 = 2.5 cm 살에 가는 줄. 짓는 일은 blindGeo(18판)
      var bb = BB(j), b = pool('b' + j, mkBlind);
      g.add(b.m, b.cas, b.zone); b.hit.userData.hit = { bl: j };
      blindGeo(b, bb, L);
    });
    if (kd !== 'blind') groups().forEach(function (gr, gi) {      // 창 묶음마다: 커튼 한 벌(레일 · 속커튼 · 겉커튼 둘)
      var c = CB(gr), st = pool('c' + gi, mkSet), g = WG[gr.wall], vw = Math.min(c.cw, wlen(gr.wall) - 0.006);      // vw: 그리는 가로 — 벽 끝까지 가면 옆 벽에서 3 mm만 띄워 그린다(숫자는 c.cw 그대로)
      g.add(st.l.m, st.r.m, st.sh, st.rail, st.rail2, st.zone); st.l.m.userData.hit = st.r.m.userData.hit = st.sh.userData.hit = { cur: gi };
      setGeo(st.rail, new THREE.BoxGeometry(vw, 0.014, 0.02)); st.rail.position.set(c.cx, c.topY + 0.007, c.zd); setEdges(st.railE, st.rail.geometry);
      setGeo(st.rail2, new THREE.BoxGeometry(vw, 0.014, 0.02)); st.rail2.position.set(c.cx, c.topY + 0.007, c.zs); setEdges(st.rail2E, st.rail2.geometry);
      setGeo(st.zone, new THREE.PlaneGeometry(vw, c.h)); st.zone.position.set(c.cx, c.cy, c.zd);
      var shem = HEMV > 0.03 ? HEM * HEMV : 0, sdw = Math.min(c.sdw, vw / 2), sgt = 1 - sdw / (vw / 2);      // sdw: 속지 한쪽 자락의 폭(19판 — 속지도 양옆으로 걷힌다) · sgt: 모인 정도
      var sr = C.sopen < 0.001 ? ribbon(vw, c.h, c.ns, 0.016, 'wave', 1, shem, true) : ribbon2(vw, c.h, Math.max(3, Math.round(c.ns / 2)), Math.min(0.016 + 0.012 * sgt, Math.max(0.016, c.zs - 0.006)), shem, sdw);      // 다 쳤을 때는 한 장 그대로, 걷으면 두 자락(모일수록 주름이 깊어진다)
      void 0;      // 속지 밑단 — 시접이면 접힌 자리가 두 겹, 리드밴드면 없다
      setGeo(st.sh, sr.geo); st.shId.geometry = sr.geo; st.sh.position.set(c.cx - vw / 2, c.cy, c.zs); setLines(st.shF, sr.fold); setLines(st.shE, sr.edge);
      setGeo(st.shH, sr.hemGeo || new THREE.BufferGeometry()); setLines(st.shHL, sr.hem);
      [[st.l, -1], [st.r, 1]].forEach(function (a) {
        var d = a[0], sg = a[1], r = ribbon(c.dw, c.h, c.n, c.A, C.pleat, -sg, DHEMV > 0.03 ? HEM * DHEMV : 0);      // 19판(결정 #405): 겉지 밑단도 시접 · 리드밴드 — 리드밴드면 박은 선이 없다
        setGeo(d.m, r.geo); d.id.geometry = r.geo; d.m.position.set(c.cx + sg * vw / 2, c.cy, c.zd); d.p.size(c.dw, c.h, 11);
        setLines(d.f, r.fold); setLines(d.e, r.edge); setLines(d.pn, r.pin); setLines(d.h, r.hem);
      });
    });
    for (key in POOL) if (!POOL[key].live) hideP(POOL[key]);
    var zo = D / 2 + T + 0.42, xo = W / 2 + T + 0.42, k = 0.07;
    setLines(dimW, [-W / 2, 0, zo, W / 2, 0, zo, -W / 2, 0, zo - k, -W / 2, 0, zo + k, W / 2, 0, zo - k, W / 2, 0, zo + k]);
    setLines(dimD, [xo, 0, -D / 2, xo, 0, D / 2, xo - k, 0, -D / 2, xo + k, 0, -D / 2, xo - k, 0, D / 2, xo + k, 0, D / 2]);
    S.items.forEach(function (it) { settleFur(it); });
    buildFurs(); sharesDirty = true; invalidate();
  }

  // ───── 속커튼 비침 — 앱 비침 고르기(C안)를 이 공간의 창 위에 ─────
  // 비침 = 창밖 그림을 흐리게(흐림) + 속커튼 천이 덮는 만큼(덮개). 덮개는 속커튼 재료의 덮개 그림으로 폭마다, 흐림은 유리의 창밖 그림으로 폭마다 그린다
  // 견주는 중(고르기 · 속커튼 · 낮)에는 고른 벌의 누른 창 — 유리 앞만 넷으로 나눈다(커튼 전체를 나누면 양끝 폭이 벽 앞에 걸린다). 고른 단계의 폭이 넓어진다. 유리 밖 자락과 다른 창은 지금 단계로
  function stripsOf(gr, gi) {
    if (!cmpOn()) return null;
    var gs = groups(), si = S.csel < gs.length ? S.csel : 0; if (gi !== si) return null;
    var j = gr.js.indexOf(S.wsel) >= 0 ? S.wsel : gr.js[0], w = WINS[j], at = w.x - w.w / 2, ws = LV.map(function (x, i) { return C.sl === i ? 2 : 1; }), tot = ws.reduce(function (s, v) { return s + v; }, 0), list = [];
    ws.forEach(function (v, i) { var x1 = at + w.w * v / tot; list.push([at, x1, i]); at = x1; });
    return { j: j, list: list };
  }
  function gray(a) { var v = Math.round(clamp(a, 0, 1) * 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; }
  function paintSheer() {
    var k = roomReady() ? kindNow() : null, hasSh = k === 'double' || k === 'sheer', dl = lvNow(), gs = groups();
    gs.forEach(function (gr, gi) {      // 속커튼 덮개 — 폭마다 덮는 정도. 걷혀서 모이면 천이 겹쳐 덜 비친다(19판)
      var st = POOL['c' + gi]; if (!st || !st.live) return;
      var c = CB(gr), vw = Math.min(c.cw, wlen(gr.wall) - 0.006), x0 = c.cx - vw / 2, sp = stripsOf(gr, gi), f = Math.min(3, (vw / 2) / Math.max(0.01, Math.min(c.sdw, vw / 2))), a0 = S.night ? 0.92 : LVA[dl];      // 밤에는 바깥이 어두워 속커튼이 더 막아 보인다
      var sig = [S.night ? 'n' : dl, vw.toFixed(3), x0.toFixed(3), f.toFixed(2), sp ? sp.list.map(function (q) { return q[0].toFixed(3) + ',' + q[1].toFixed(3) + ',' + q[2]; }).join(';') : ''].join('|');
      if (st.asig === sig) return; st.asig = sig;
      var g = st.actx; g.fillStyle = gray(1 - Math.pow(1 - a0, f)); g.fillRect(0, 0, 512, 2);
      if (sp) sp.list.forEach(function (q) { var u0 = Math.round((q[0] - x0) / vw * 512), u1 = Math.round((q[1] - x0) / vw * 512); g.fillStyle = gray(LVA[q[2]]); g.fillRect(u0, 0, Math.max(1, u1 - u0), 2); });
      st.atex.needsUpdate = true; invalidate();
    });
    WINS.forEach(function (w, j) {      // 유리 — 낮에는 창밖 사진, 밤에는 어둡게. 속지가 가리는 자리(cov)는 그 비침 단계만큼 흐린 그림이 겹친다(19판 — 그리는 일은 sceneSync)
      var o = POOL['g' + j]; if (!o || !o.live) return;
      var m = o.m.material, gi = -1, c, vw, x0, sd, bt;
      o.cov = null;
      if (S.night || !SCN.tex) { if (m.map) { m.map = null; m.needsUpdate = true; } m.color.set(S.night ? '#22262C' : '#dde5ea'); invalidate(); return; }      // 밤 유리는 푸른 기 없이 어둡게 · 사진이 아직 안 열렸으면 하늘빛만
      if (m.map !== SCN.tex) { m.map = SCN.tex; m.needsUpdate = true; } m.color.set('#ffffff');
      gs.forEach(function (gr, i) { if (gr.js.indexOf(j) >= 0) gi = i; });
      if (hasSh && gi >= 0) {
        c = CB(gs[gi]); vw = Math.min(c.cw, wlen(gs[gi].wall) - 0.006); x0 = c.cx - vw / 2; sd = Math.min(c.sdw, vw / 2); bt = sceneBlur(dl);
        if (o.mb.material.map !== bt) { o.mb.material.map = bt; o.mb.material.needsUpdate = true; }
        o.cov = { a: x0, b: x0 + vw, g0: C.sopen > 0.001 ? x0 + sd : null, g1: x0 + vw - sd, z: c.zs };      // a · b: 속지의 양 끝 · g0 · g1: 걷혀서 열린 자리
      }
      invalidate();
    });
  }

  // ───── 가구 ─────
  function itemOf(id) { for (var i = 0; i < S.items.length; i++) if (S.items[i].id === id) return S.items[i]; return null; }
  function selItem() { return S.sel && S.sel.fur != null ? itemOf(S.sel.fur) : null; }
  function applySize(it) {      // 고른 규격 칸의 치수를 가구에 넣는다 — 잰 치수(it.m)가 있으면 그것이 먼저
    var T = TYPES[it.type];
    if (it.m) { it.w = it.m.w; it.d = it.m.d; it.h = it.hc != null ? it.hc : it.m.h; return; }
    (T.sizes || []).forEach(function (row, a) { var o = row[it.si[a]] || row[0]; ['w', 'd', 'h'].forEach(function (k) { if (o[k] != null) it[k] = o[k]; }); });
    if (it.hc != null) it.h = it.hc;      // 손으로 정한 높이가 규격보다 먼저
  }
  function furNow(it) { return { w: it.w, d: it.d, h: it.h, x: it.x, z: it.z }; }
  function furGlide(it, from) {      // 규격을 바꾸면 가구도 부드럽게 바뀐다
    var to = furNow(it), ks = ['w', 'd', 'h', 'x', 'z'], id = it.gl = (it.gl || 0) + 1;
    if (CALM) { buildFurs(); return; }
    ks.forEach(function (k) { it[k] = from[k]; }); buildFurs();
    tween(300, function (t) { if (it.gl !== id) return; ks.forEach(function (k) { it[k] = from[k] + (to[k] - from[k]) * t; }); buildFurs(); },
      function () { if (it.gl !== id) return; ks.forEach(function (k) { it[k] = to[k]; }); buildFurs(); sharesDirty = true; render(); });
  }
  function partsOf(it) {      // [너비, 높이, 깊이, x, y, z] — 등이 -z 쪽
    var w = it.w, h = it.h, d = it.d, sh, e;
    switch (it.type) {
      case 'sofa': sh = h * 0.5; return [[w, sh, d, 0, sh / 2, 0], [w, h - sh, 0.22, 0, sh + (h - sh) / 2, -d / 2 + 0.11], [0.18, (h - sh) * 0.5, d - 0.22, -(w / 2 - 0.09), sh + (h - sh) * 0.25, 0.11], [0.18, (h - sh) * 0.5, d - 0.22, w / 2 - 0.09, sh + (h - sh) * 0.25, 0.11]];
      case 'bed': sh = Math.min(0.5, h * 0.55); return [[w, sh, d - 0.08, 0, sh / 2, 0.04], [w, h, 0.08, 0, h / 2, -d / 2 + 0.04]];
      case 'table': e = 0.06; return [[w, 0.05, d, 0, h - 0.025, 0]].concat([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (s) { return [e, h - 0.05, e, s[0] * (w / 2 - e), (h - 0.05) / 2, s[1] * (d / 2 - e)]; }));
      case 'chair': sh = Math.min(0.45, h * 0.53); e = 0.04; return [[w, 0.05, d, 0, sh - 0.025, 0], [w, h - sh, e, 0, sh + (h - sh) / 2, -d / 2 + e / 2]].concat([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (s) { return [e, sh - 0.05, e, s[0] * (w / 2 - e), (sh - 0.05) / 2, s[1] * (d / 2 - e)]; }));
      case 'desk': return [[w, 0.04, d, 0, h - 0.02, 0], [0.04, h - 0.04, d - 0.04, -(w / 2 - 0.02), (h - 0.04) / 2, 0], [0.04, h - 0.04, d - 0.04, w / 2 - 0.02, (h - 0.04) / 2, 0], [w - 0.08, (h - 0.04) * 0.45, 0.02, 0, (h - 0.04) * 0.775, -d / 2 + 0.03]];
      case 'display': return [[w, h * 0.35, d, 0, h * 0.175, 0], [w, h * 0.65, d - 0.05, 0, h * 0.675, -0.025]];
      default: return [[w, h, d, 0, h / 2, 0]];
    }
  }
  var FURHATCH = hatchTex(); FURHATCH.repeat.set(5, 5);
  function buildFurs() {
    while (furRoot.children.length) { var g0 = furRoot.children[0]; furRoot.remove(g0); g0.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.userData && o.material.userData.own) o.material.dispose(); }); }      // 258번: 가구마다 만든 재료도 버린다(여닫기를 되풀이해도 쌓이지 않게)
    S.items.forEach(function (it, i) {
      var g = new THREE.Group(), T = TYPES[it.type], picked = S.sel && S.sel.fur === it.id;
      var mat = it.hex ? flat(it.hex, { transparent: true, opacity: it.ghost ? 0.3 : 1 }) : flat('#ffffff', { map: FURHATCH, transparent: true, opacity: it.ghost ? 0.3 : 1 }); mat.visible = !S.hideFur; mat.userData.own = true;      // 색을 재지 않은 가구는 빗금
      it.n = 4 + i; it.meshes = [];
      var geos = T.round ? [[new THREE.CylinderGeometry(it.w / 2, it.w / 2, it.h, 28), 0, it.h / 2, 0]] : partsOf(it).map(function (p) { return [new THREE.BoxGeometry(p[0], p[1], p[2]), p[3], p[4], p[5]]; });
      geos.forEach(function (a) {
        var m = new THREE.Mesh(a[0], mat); m.position.set(a[1], a[2], a[3]); m.userData.fur = it.id;
        m.add(new THREE.LineSegments(new THREE.EdgesGeometry(a[0], 30), picked ? selMat : lineMat));
        var im = new THREE.Mesh(a[0], idMat(it.n)); im.layers.set(1); im.position.copy(m.position);
        g.add(m, im); it.meshes.push(m);
      });
      g.position.set(it.gx != null ? it.gx : it.x, 0, it.gz != null ? it.gz : it.z); g.rotation.y = it.rot; if (it.grow != null) g.scale.y = it.grow;
      it.g = g; furRoot.add(g);
    });
  }
  // 가장 가까운 벽에 등을 대고, 가까우면 벽에 붙는다
  function settleFur(it) {
    applySize(it);
    var dist = [it.z + R.D / 2, R.W / 2 - it.x, R.D / 2 - it.z, it.x + R.W / 2], rots = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
    var best = 0, i; for (i = 1; i < 4; i++) if (dist[i] < dist[best]) best = i;
    if (it.wall == null || dist[best] < dist[it.wall] - 0.3) it.wall = best;
    it.rot = rots[it.wall];
    var along = it.wall === 0 || it.wall === 2; it.w = Math.min(it.w, (along ? R.W : R.D) - 0.1); it.d = Math.min(it.d, (along ? R.D : R.W) - 0.1); it.h = Math.min(it.h, R.H - 0.05);
    if (TYPES[it.type].round) it.d = it.w;
    var hx = along ? it.w / 2 : it.d / 2, hz = along ? it.d / 2 : it.w / 2, e = 0.02;
    it.x = clamp(it.x, -R.W / 2 + hx + e, R.W / 2 - hx - e); it.z = clamp(it.z, -R.D / 2 + hz + e, R.D / 2 - hz - e);
    var gapNow = [it.z + R.D / 2, R.W / 2 - it.x, R.D / 2 - it.z, it.x + R.W / 2][it.wall] - it.d / 2;
    if (gapNow < 0.45) {
      if (it.wall === 0) it.z = -R.D / 2 + it.d / 2 + e; else if (it.wall === 2) it.z = R.D / 2 - it.d / 2 - e;
      else if (it.wall === 1) it.x = R.W / 2 - it.d / 2 - e; else it.x = -R.W / 2 + it.d / 2 + e;
    }
  }
  function addFur(type, x, z, m) {      // m: 폰에서 잰 것 { w, d, h, c(색) }
    var T = TYPES[type], it = { id: ++S.seq, type: type, w: T.w, h: T.h, d: T.d, si: (T.def || []).slice(), x: x == null ? T.at[0] : x, z: z == null ? T.at[1] : z, wall: null, rot: 0, hex: null, cn: null, m: null };
    if (m) { it.m = { w: m.w, d: m.d, h: m.h }; if (m.c != null) { it.hex = FURCOLS[m.c].hex; it.cn = FURCOLS[m.c].name; } if (m.hex) { it.hex = m.hex; it.cn = m.cn || '측정한 색'; } }      // 폰 실측 4판은 잰 색을 hex로 보낸다
    settleFur(it);
    for (var n = 0; x == null && n < 5 && S.items.some(function (o) { return Math.hypot(o.x - it.x, o.z - it.z) < 0.25; }); n++) { it.z += 0.6; it.x += it.x > 0 ? -0.3 : 0.3; it.wall = null; settleFur(it); }
    S.items.push(it); it.grow = 0.001;
    tween(BMS || 450, function (k) { it.grow = Math.max(0.001, k); if (it.g) it.g.scale.y = it.grow; }, function () { it.grow = null; });      // 263번: 짓기는 0.9초
    return it;
  }

  // ───── 눈에 들어오는 넓이 — 눈높이 그림을 실제로 그려 칸을 센다 ─────
  function eyePos() { return new THREE.Vector3(0, 1.3, -R.D / 2 + Math.max(R.D + 1.2, R.W / 2 / Math.tan(36 * Math.PI / 180) + 0.2)); }      // 얕고 넓은 공간(베란다)은 창 벽이 다 보일 만큼 물러서서 본다
  function idPass(layer) {
    idCam.layers.set(1); idCam.layers.enable(layer);
    renderer.clear(); renderer.render(scene, idCam); renderer.readRenderTargetPixels(rt, 0, 0, RTW, RTH, buf);
    var n = {}, total = 0;
    for (var i = 0; i < buf.length; i += 4) { var id = Math.round(buf[i] / 8); if (id) { n[id] = (n[id] || 0) + 1; total++; } }
    var out = {};
    Object.keys(n).forEach(function (id) { id = +id; var it = S.items[id - 4], key = id === 1 ? 'wall' : id === 2 ? 'floor' : id === 3 ? 'curtain' : it ? 'f' + it.id : null; if (key) out[key] = (out[key] || 0) + n[id] / total; });
    return out;
  }
  function measure() {
    var p = eyePos(); idCam.position.copy(p); idCam.lookAt(p.x, p.y - 0.18, p.z - 3); idCam.updateMatrixWorld();
    var prev = new THREE.Color(); renderer.getClearColor(prev); var prevA = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1);
    var vis0 = WG.map(function (g) { var v = g.visible; g.visible = true; return v; }), fr0 = furRoot.visible; furRoot.visible = true;      // 보는 자리 때문에 걷어 둔 벽의 커튼도 센다
    SHARES = idPass(2);                 // 색 판은 다 쳤을 때의 넓이로 — 걷고 치는 것에 따라 흔들리지 않는다 (커튼 색이 가장 크게 보이는 순간이 기준)
    ZONE = SHARES.curtain || 0;
    WG.forEach(function (g, i) { g.visible = vis0[i]; }); furRoot.visible = fr0;
    if (!(roomReady() && kindNow())) delete SHARES.curtain;
    renderer.setRenderTarget(null); renderer.setClearColor(prev, prevA);
  }
  function curtainTier() { return ZONE >= TIER[0] ? 0 : ZONE >= TIER[1] ? 1 : 2; }      // 큰 색 · 받치는 색 · 작은 색
  var TIER = [0.24, 0.13];
  function nearFur() {      // 커튼과 가까운 큰 가구 (넓이 × 가까움)
    var best = null, score = 0;
    S.items.forEach(function (it) { if (!it.hex) return; var sc = (SHARES['f' + it.id] || it.w * it.h * 0.01) / (1 + Math.hypot(it.x, it.z + R.D / 2) / 1.5); if (sc > score) { score = sc; best = it; } });
    return best;
  }
  // 아래쪽 색 — 바닥과 잰 가구를 눈높이에서 눈에 드는 넓이만큼 섞는다. 커튼은 위(벽)에서 아래(바닥 · 가구)까지 걸치므로 둘 사이를 잇는다
  function lowMass() {
    var F = lab(surfHex('floor')), wF = SHARES.floor || 0.25, L = F.L * wF, a = F.a * wF, b = F.b * wF, ws = wF, fw = 0;
    S.items.forEach(function (it) { var sh = it.hex ? SHARES['f' + it.id] || 0 : 0, c; if (!sh) return; c = lab(it.hex); L += c.L * sh; a += c.a * sh; b += c.b * sh; ws += sh; fw += sh; });
    return { lab: { L: L / ws, a: a / ws, b: b / ws }, fur: fw / ws };      // fur: 아래쪽에서 가구가 차지하는 몫
  }
  // 색 후보 — 커튼이 차지하는 넓이(자리)와 손님이 답한 느낌이 함께 정한다. 첫째가 권하는 색
  // ───── 걸린 원단(258번) — 앱에서 고른 원단 그대로 방에 건다. 시안의 색 후보 · 견본 원단 · 책자 번호는 뺐다 ─────
  function sheerHex() { return (LAYER.sheer && LAYER.sheer.hex) || SHEER0; }
  function curtainNow() {
    var k = roomReady() ? kindNow() : null; if (!k || k === 'sheer') return null;
    var f = k === 'blind' ? LAYER.blind : LAYER.drape;
    return f && f.hex ? { l: f.hex, r: f.hex } : null;      // 원단을 아직 안 골랐으면 빗금(모르는 색)
  }
  // ───── 그림에 반영 ─────
  function paintRoom(anim) {
    var wh = surfHex('wall'), fh = surfHex('floor');
    WALLS.forEach(function (w) { w.p.set(wh, anim); });
    ceilP.set(wh, anim); floorP.set(fh, anim);
    var ready = roomReady(), k = ready ? kindNow() : null, cur = k ? curtainNow() : null;
    var dr = k === 'double' || k === 'drape', sh = k === 'double' || k === 'sheer', bl = k === 'blind', gon = GLS.k > 0.001, key, o;
    SHMATS.forEach(function (m) { tint(m, sheerHex(), anim); });
    tickMat.color.set(S.night ? 0xffffff : INK); tickMat.opacity = S.night ? 0.26 : 0.2;
    var open = bl ? blOpen() : dr ? C.open : 1;      // 블라인드는 내려 있어도 살이 누우면 · 띠가 겹치면 빛이 든다(18판)
    PATCH0 = S.night || (fh == null && !BLD) ? 0 : (0.18 + 0.34 * open) * (sh ? 1 - 0.55 * LVA[lvNow()] * (1 - 0.8 * C.sopen) : 1) * sun().p * GLS.k; patchMat.opacity = PATCH0 * SUNK.k;      // 263번: 짓기에서는 바닥 색을 칠하기 전(빗금)에도 빛이 든다 — 방향을 확인한 만큼(SUNK)      // 바닥에 드는 빛 — 낮에만, 걷은 만큼, 창 방향만큼, 속커튼이 비치는 만큼
    for (key in POOL) {
      o = POOL[key];
      if (o.kind === 'glass') o.m.visible = o.g.visible = o.t.visible = o.live && gon;
      else if (o.kind === 'patch') o.m.visible = o.live && gon;
      else if (o.kind === 'set') {
        o.l.m.visible = o.r.m.visible = o.rail.visible = o.live && dr; o.sh.visible = o.rail2.visible = o.live && sh; o.shId.visible = k === 'sheer'; o.zone.visible = o.live && !bl;
        o.l.p.set(o.live && dr && cur ? cur.l : null, anim); o.r.p.set(o.live && dr && cur ? cur.r : null, anim);
      } else { o.m.visible = o.cas.visible = o.zone.visible = o.live && bl; o.m2.visible = o.live && bl && o.band; o.p.set(o.live && bl && cur ? cur.r : null, anim); o.ps.set(o.live && bl && cur ? cur.r : null, anim); tint(o.mat2, cur ? cur.r : BG, anim); }
    }
    paintSheer();
    invalidate();
  }
  function colorOf(k, cur) {
    if (k === 'wall' || k === 'floor') return surfHex(k);
    if (k === 'curtain') return kindNow() === 'sheer' ? (LAYER.sheer ? sheerHex() : null) : cur ? cur.r : null;
    var it = k.charAt(0) === 'f' ? itemOf(+k.slice(1)) : null;
    return it ? it.hex : null;      // 색을 재지 않은 가구는 빗금
  }
  function slices(sh) {      // 넓이대로 네모를 나눈다 — 큰 것부터
    var keys = Object.keys(sh).sort(function (a, b) { return sh[b] - sh[a]; }), x = 0, y = 0, w = 100, h = 100, rest = 1, out = [];
    keys.forEach(function (k, i) {
      var f = i === keys.length - 1 ? 1 : sh[k] / rest, r;
      if (w >= h) { r = [x, y, w * f, h]; x += w * f; w -= w * f; } else { r = [x, y, w, h * f]; y += h * f; h -= h * f; }
      rest -= sh[k]; out.push({ k: k, r: r });
    });
    return out;
  }
  var PIECES = {};
  function paintBoard() {
    board.classList.toggle('show', roomReady());
    var list = slices(SHARES), cur = curtainNow(), seen = {};
    list.forEach(function (s) {
      var k = s.k, r = s.r, el = PIECES[k]; seen[k] = 1;
      if (!el) { el = PIECES[k] = document.createElement('i'); el.className = 'piece'; board.appendChild(el); }
      el.style.left = r[0] + '%'; el.style.top = r[1] + '%'; el.style.width = r[2] + '%'; el.style.height = r[3] + '%';
      var color = colorOf(k, cur);
      el.style.backgroundColor = color || 'transparent'; el.style.backgroundImage = color ? 'none' : 'var(--hatch)';
      el.className = 'piece' + (k === 'curtain' && color ? ' dot' : '');
    });
    Object.keys(PIECES).forEach(function (k) { if (!seen[k]) { PIECES[k].style.width = PIECES[k].style.height = '0'; PIECES[k].className = 'piece'; } });
  }

  // ───── 칩 ─────
  var IC = {      // 작은 그림: 일반 주름 · 나비주름(앞에서 본 커튼) · 결(실제 앱은 결 사진)
    wave: '<svg viewBox="0 0 48 48"><path d="M6 9H42M9 9V39M15 9V39M21 9V39M27 9V39M33 9V39M39 9V39M6 39q3 3 6 0t6 0t6 0t6 0t6 0t6 0"/></svg>',
    nabi: '<svg viewBox="0 0 48 48"><path d="M6 9H42M9 9L12 16L15 9M12 9V39M12 16L8 39M12 16L16 39M21 9L24 16L27 9M24 9V39M24 16L20 39M24 16L28 39M33 9L36 16L39 9M36 9V39M36 16L32 39M36 16L40 39"/></svg>',
    smooth: '<svg viewBox="0 0 48 48"><path d="M6 15c12-4 24-4 36 0M6 25c12-4 24-4 36 0M6 35c12-4 24-4 36 0" opacity=".45"/></svg>',
    weave: '<svg viewBox="0 0 48 48"><path d="M6 11H42M6 17H42M6 23H42M6 29H42M6 35H42M6 41H42M11 6V42M17 6V42M23 6V42M29 6V42M35 6V42M41 6V42" opacity=".5"/></svg>',
    soft: '<svg viewBox="0 0 48 48"><path d="M10 10h.01M20 12h.01M31 9h.01M40 13h.01M14 21h.01M25 20h.01M36 22h.01M9 30h.01M20 31h.01M30 29h.01M41 32h.01M14 40h.01M26 39h.01M37 41h.01" stroke-width="4" stroke-linecap="round" opacity=".55"/></svg>',
    linen: '<svg viewBox="0 0 48 48"><path d="M6 12H42M6 19H20M24 19H42M6 26H42M6 33H14M18 33H42M6 40H42M13 6V42M27 6V42M37 6V42" opacity=".45"/><path d="M20 19H24M14 33H18" stroke-width="2.5"/></svg>',
    thick: '<svg viewBox="0 0 48 48"><path d="M6 13H42M6 24H42M6 35H42" stroke-width="4" opacity=".4"/></svg>'
  };
  var TI = { zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.25 5.25"/></svg>' };      // 가까이 보기(돋보기)
  function lvIcon(i) {      // 비침 단계의 작은 그림 — 창밖(예시 사진)을 그 단계만큼 흐리고 덮은 것
    return '<span class="lvi"><i class="scn" style="filter:blur(' + [0.2, 0.9, 2.4, 5][i] + 'px)"></i><i style="background:' + sheerHex() + ';opacity:' + LVA[i] + '"></i></span>';
  }
  function chipHtml(kind, key, hex, name, sub, cls, hex2) {
    var sw = hex2 ? '<span class="pair"><i class="sw" style="background:' + hex + '"></i><i class="sw" style="background:' + hex2 + '"></i></span>' : '<i class="sw" style="background:' + hex + '"></i>';
    return '<button type="button" class="chip ' + (cls || '') + '" data-chip="' + kind + '" data-key="' + key + '" data-hex="' + (hex2 || hex) + '">' + sw
      + '<span class="tx"><span class="nm">' + name + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span></button>';
  }
  function tapChip(kind, key, pic, name, sub, on, bare) {      // 끌지 않고 누르기만 하는 칩 (그림이나 글만). bare: 그림만 — 이름은 읽어 주는 말로만
    return '<button type="button" class="chip nd' + (on === 'off' ? ' off' : on ? ' on' : '') + '" data-chip="' + kind + '" data-key="' + key + '"' + (bare ? ' aria-label="' + name + '" title="' + name + '"' : '') + '>' + (pic || '')
      + (bare ? '' : '<span class="tx"><span class="nm">' + name + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span>') + '</button>';
  }
  var GAP = '<i class="gap"></i>';

  // ───── 아래 선반(고르기) · 왼쪽 위 칸 ─────
  var traySig = '', shapeSig = '';
  function joinChips() {      // 같은 벽에 떨어진 창이 있을 때만: 커튼을 창마다 달지, 한 벌로 덮을지
    return groups(true).length > wallsUsed().length ? tapChip('join', 'n', '', '창마다', '', !C.join) + tapChip('join', 'y', '', '한 벌로', '', !!C.join) : '';
  }
  function stepHtml(k, v, lo, hi, nm) {      // − 값 + : 1 cm씩(누르고 있으면 이어서). k: w 가로 · h 세로
    return '<span class="stepper"><button type="button" class="pm' + (lo ? ' off' : '') + '" data-nudge="' + k + '" data-d="-1" data-g="−" aria-label="' + nm + ' 1 cm 줄이기"></button><span class="nm" data-nm="' + k + '">' + v + '</span><button type="button" class="pm' + (hi ? ' off' : '') + '" data-nudge="' + k + '" data-d="1" data-g="+" aria-label="' + nm + ' 1 cm 늘리기"></button></span>';
  }
  function srow(k, body, cls) { return '<div class="srow' + (cls ? ' ' + cls : '') + '"><span class="k">' + k + '</span>' + body + '</div>'; }      // 장의 모양 한 줄 — 왼쪽에 이름, 오른쪽에 누르는 것
  function hemVal() {      // 밑단 줄에 적는 것 — 커튼은 바닥에서 뜬 거리 / 블라인드는 창턱이 있으면 창턱에서(창턱을 지나 내려오면 '창턱 아래'), 바닥까지 오는 창이면 바닥에서
    var hp = hemPt(); if (!hp) return null;
    if (hp.bl) { var q = BB(), w = WINS[q.j]; if (w.sill > 0.005) return q.bot >= w.sill - 0.0005 ? { k: '창턱에서', v: cm(q.bot - w.sill) } : { k: '창턱 아래', v: cm(w.sill - q.bot) }; }
    return { k: '바닥에서', v: cm(hp.gap) };
  }
  function sizeRows() {      // 고른 커튼 한 벌 · 고른 블라인드의 크기 — 가로 · 높이, 그 아래 밑단이 뜬 거리(누르면 밑단 앞으로 다가간다 — 17판: 머리의 '밑단'을 대신한다)
    var e = 0.0005, bl = kindNow() === 'blind', b = bl ? BB() : CB(), hp = hemVal(), on = S.view === 'hem', nm = on ? '밑단 가까이 보기 끝내기' : '밑단 가까이 보기', h;
    if (bl) h = srow('가로', stepHtml('w', cm(b.w), b.w <= b.minW + e, b.w >= b.maxW - e, '가로')) + srow('높이', stepHtml('h', cm(b.len), b.bot >= b.botMax - e, b.bot <= e, '높이'));      // 266번: '세로' → '높이'(결정 #413) — 블라인드는 낱말만
    else {      // 266번(결정 #414): 커튼 — 가로 숫자 아래 세 단추, 창 기준이면 양옆 여유 · 높이 숫자 아래 기장 두 단추, 창 아래면 그 길이
      var wl = '벽에서 벽';      // 박스가 벽보다 짧으면 박스 끝에서 끝(span이 박스 끝까지) — 숫자 칸이 그 길이를 보여 준다
      h = srow('가로', stepHtml('w', cm(b.cw), b.cw <= b.minW + e, b.cw >= b.maxW - e, '가로'))
        + srow('', tapChip('cwm', 'wall', '', wl, '', b.mode === 'wall') + tapChip('cwm', 'win', '', '창 기준', '', b.mode === 'win') + tapChip('cwm', 'free', '', '직접', '', b.mode === 'free'), 'sub');
      if (b.mode === 'win') h += srow('창 왼쪽', stepHtml('ml', cm(b.ml), b.ml <= e, b.ml >= b.mlMax - e, '창 왼쪽 여유')) + srow('창 오른쪽', stepHtml('mr', cm(b.mr), b.mr <= e, b.mr >= b.mrMax - e, '창 오른쪽 여유'));
      h += srow('높이', stepHtml('h', cm(b.len), b.botY >= b.botMax - e, b.botY <= e, '높이'))
        + srow('', tapChip('chm', 'floor', '', '바닥까지', '', b.hem === 'floor' && b.gap < 0.1 + e) + tapChip('chm', 'win', '', '창 아래', '', b.sillOK ? b.hem === 'win' : 'off'), 'sub');
      if (b.hem === 'win') { h += srow('창 아래', stepHtml('bw', cm(b.below), b.below <= e, b.below >= b.usill - e, '창 아래 길이')); hp = null; }      // 창 아래면 바닥에서 뜬 거리 줄 대신
    }
    if (hp) h += '<button type="button" class="srow' + (on ? ' on' : '') + '" data-view="hem" aria-pressed="' + on + '" aria-label="' + nm + '" title="' + nm + '"><span class="k" data-nm="gk">' + hp.k + '</span><span class="v"><span data-nm="g">' + hp.v + '</span>&nbsp;cm</span><i class="ti">' + TI.zoom + '</i></button>';
    return h;
  }
  function partDone() { var k = kindNow(); return !!k && roomReady() && (k !== 'blind' || !!BK[bkNow()]); }      // 258번: 원단은 앱에서 고른 것 — 방이 지어지면 끝낼 수 있다      // 블라인드는 종류를 골라야 끝난다('잘 모르겠어요'는 방에서 걸어 보고 고른다)
  var laySig = '', kindSig = '';
  function layChip(key, name, cur) { return '<button type="button" class="chip nd' + (cur ? ' on' : '') + '" data-chip="layer" data-key="' + key + '"><span class="tx"><span class="nm">' + name + '</span></span></button>'; }
  function hungHtml(ly) {      // 258번: 걸린 원단 한 줄(색 · 이름) + '원단 바꾸기' — 누르면 입체 방을 닫고 앱의 원단 고르기로(어디로 갈지는 공간 화면이 정한다)
    var f = LAYER[ly], sh = ly === 'sheer', lv = lvNow();
    var sw = sh ? '<i class="sw">' + lvIcon(lv) + '</i>' : '<i class="sw" style="background:' + (f && f.hex ? f.hex : 'var(--hatch), var(--bg)') + '"></i>';
    var sub = sh ? LV[lv] : ly === 'blind' ? BK[bkNow()].n : '';
    return '<div class="hung">' + sw + '<span class="tx"><span class="nm">' + (f && f.name ? esc(f.name) : '아직 원단을 고르지 않았습니다') + '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span></div>'
      + '<div class="pdoor"><button type="button" class="act next quiet" data-gofab="' + ly + '"><span>원단 바꾸기 →</span></button></div>';
  }
  function paintTray() {
    var h = '', lay = '', kh = '', it = selItem(), b, k = kindNow(), sm = sheerMode(), cur = S.step === 'cur' && roomReady() && !!k;
    if (cur) {
      var hasD = k === 'double' || k === 'drape', hasS = k === 'double' || k === 'sheer', bl = k === 'blind';
      // 장 머리(17판, 결정 #404) — 걸린 것만 보인다(이중 커튼이면 겉지 · 속지 — 누르면 그것을 고른다). 옆에 조용한 '구성 바꾸기' 하나 — 누르면 네 구성이 펼쳐지고, 고르면 방에 그렇게 걸린다. 빼기 단추는 없다
      lay = (hasD ? layChip('drape', '겉커튼', !sm) : '') + (hasS ? layChip('sheer', '속커튼', sm) : '') + (bl ? layChip('blind', '블라인드', true) : '')
        + (FIXED ? '' : '<button type="button" class="act' + (S.kopen ? ' open' : '') + '" id="r3d-kindbtn" aria-expanded="' + !!S.kopen + '"><span>구성 바꾸기</span></button>');      // 258번: 앱에 품목이 있으면 구성은 품목이 정한다
      if (S.kopen) kh = KINDS.map(function (o) { return tapChip('kind', o[0], '', o[1], '', k === o[0]); }).join('');
      if (sm) h += hungHtml('sheer');      // 258번: 속지 — 걸린 원단과 그 비침(앱 원단의 비침 값)
      else if (bl) {      // 블라인드 — 종류는 원단이 정한다. 원단이 종류를 모를 때만 종류 줄(방에서 걸어 보기 — 앱 품목에는 쓰지 않는다)
        if (!BKFIX) h += srow('종류', BKO.map(function (o) { return tapChip('bkind', o, '', BK[o].n, '', A.bkind === o); }).join(''), 'first') + (BK[A.bkind] ? '' : '<p class="shint">아직 고르지 않았습니다</p>');
        h += hungHtml('blind');
      } else h += hungHtml('drape');
      // 모양(17판) — 방 위에 떠 있던 크기 · 주름 · 폭수 줄이 걸린 원단 줄 아래로 왔다
      h += '<div class="shapeblk">' + sizeRows();
      if (sm || hasD) { var ld = sm ? C.lead : C.dlead; h += srow('밑단', tapChip('hem', 'fold', '', '기본', '', !ld) + tapChip('hem', 'lead', '', '리드밴드', '', !!ld)); }      // 19판(결정 #405): 겉지 장에도 같은 자리에 같은 줄 — 값은 겹마다 따로      // 18판: 속지 밑단 — 시접(기본) · 리드밴드(현행 앱 139번과 같다: 속지가 있을 때만, 겉지는 늘 시접)
      if (hasD && !sm) {
        b = CB();
        h += srow('주름', tapChip('pleat', 'wave', '<i class="ic">' + IC.wave + '</i>', '일반 주름', '', C.pleat === 'wave', true) + tapChip('pleat', 'nabi', '<i class="ic">' + IC.nabi + '</i>', '나비 주름', '', C.pleat === 'nabi', true), 'tall')
          + srow('폭 수', '<span class="stepper"><button type="button" class="pm' + (b.pok <= b.minPok ? ' off' : '') + '" data-pok="-1" data-g="−" aria-label="한 폭 줄이기"></button><span class="nm" data-nm="p">' + b.pok + '폭</span><button type="button" class="pm' + (b.pok >= POKMAX ? ' off' : '') + '" data-pok="1" data-g="+" aria-label="한 폭 늘리기"></button></span>');
      }
      if (!bl) { var jc = joinChips(); if (jc) h += srow('레일', jc); }
      else if (wallsUsed().some(function (i) { return bx(i).on; })) {      // 커튼박스가 있는 집의 블라인드: 박스 안 / 창틀 — 박스 앞뒤 폭이 좁으면 창틀에만
        var fit = WINS.some(function (w, j) { return BB(j).fits; });
        h += srow('다는 곳', tapChip('bat', 'box', '', '커튼박스에', '', fit ? C.bat !== 'win' : 'off') + tapChip('bat', 'win', '', '창틀에', '', !fit || C.bat === 'win'));
      }
      if (bl && slitKind()) h += srow(slitKind() === 'slat' ? '각도 조절' : '빛 조절', SLITS[slitKind()].map(function (o) { return tapChip('slit', o[0], '', o[1], '', Math.abs(C.slit - o[0]) < 0.01); }).join(''));      // 19판: 살은 '각도 조절'(11-25 사장님), 콤비는 각도가 아니라 겹침이라 '빛 조절' 그대로
      if (bl && BK[bkNow()].tape) h += srow('줄', tapChip('tape', 'cord', '', '실', '', !C.tape) + tapChip('tape', 'band', '', '리본밴드', '', !!C.tape));      // 19판(결정 #405): 우드의 살 사이 — 실이 기본, 리본밴드는 추가 옵션. 우드에만 뜨는 줄이라 맨 아래      // 18판: 종류에 따라 뜻이 바뀌는 한 줄 — 우드 · 알루미늄은 살 기울기, 콤비는 두 겹의 겹침, 롤은 없음. 맨 아래에 두어 종류를 바꿔도 다른 줄이 움직이지 않는다
      h += '</div>';
    }
    if (NUDGE) {      // 단추를 누르고 있는 동안에는 숫자만 바꾼다(누른 단추를 갈아 끼우지 않게)
      var nb = k === 'blind' ? BB() : CB(), hpN = hemVal(), nv = { ml: cm(nb.ml || 0), mr: cm(nb.mr || 0), bw: cm(nb.below || 0), w: cm(k === 'blind' ? nb.w : nb.cw), h: cm(nb.len), p: nb.pok + '폭', g: hpN ? hpN.v : '', gk: hpN ? hpN.k : '' };
      [].forEach.call(tray.querySelectorAll('[data-nm]'), function (el) { el.textContent = nv[el.dataset.nm]; });
    } else {
      if (lay !== laySig) { laySig = lay; layersEl.innerHTML = lay; }
      if (kh !== kindSig) { kindSig = kh; kindsEl.innerHTML = kh; kindsEl.hidden = !kh; }
      if (h !== traySig) { traySig = h; tray.innerHTML = h; tray.classList.toggle('thin', sm); }
    }
    var sh = '';
    if (S.step === 'measure' && it) {      // 고른 가구의 규격과 빼기 — 방 위에 남긴다: 가구를 고른 동안만 뜨고, 방에서 누른 것 곁에 붙으며, 재기의 장은 들은 말 · 물음 · 숫자판으로 차 있다
      var T = TYPES[it.type], mm = it.m || it.m0;
      sh = chipHtml('none', it.id, it.hex || HATCH_BG, T.name, it.cn || '', 'nd');
      if (mm) sh += GAP + tapChip('size', 'm', '', '실측 치수', cm(mm.w) + ' × ' + cm(mm.d), !!it.m);      // 폰에서 잰 가구 — 규격을 눌러 바꿨다가도 돌아올 수 있게
      (T.sizes || []).forEach(function (row, a) { sh += GAP; row.forEach(function (o, i) { sh += tapChip('size', a + ':' + i, '', o.n, o.sub, !it.m && it.si[a] === i); }); });
      sh += GAP + '<button type="button" class="act" id="r3d-remove"><span>빼기</span></button>';
    }
    if (sh !== shapeSig) { shapeSig = sh; shape.innerHTML = sh; shape.hidden = !sh; }
    nextBtn.firstChild.textContent = k === 'double' && S.part === 'drape' ? '다음 →' : '완료 →';      // 이중 커튼은 겉커튼 다음에 속커튼, 마지막은 완료 — 공간 화면으로
    nextBtn.classList.toggle('off', !partDone());
  }
  // ───── 오른쪽 장 — 들은 말과 지금 묻는 것 ─────
  function dirName(d) { if (!d || !d.length) return '모름'; var ns = d.filter(function (x) { return x === '남' || x === '북'; }), ew = d.filter(function (x) { return x === '동' || x === '서'; }); return ns.concat(ew).join('') + '향'; }
  function recList(o) {      // 들은 말 — [무엇, 이름, 값]. o: pack()으로 담은 꼴
    var a = o.A, out = [], ws = o.WINS;
    function sw(k, i) { var s = SURFS[k][i]; return '<i style="background:' + s.hex + '"></i>' + s.name; }
    function wsz(w) { return cm(w.w) + ' × ' + cm(w.top - w.sill); }
    if (a.light) out.push(['light', '빛', label(OPT.light, a.light)]);
    if (a.gaze) out.push(['gaze', '시선', label(OPT.gaze, a.gaze)]);
    if (a.feel && a.kind !== 'sheer') out.push(['feel', '분위기', label(OPT.feel, a.feel)]);
    var kdr = a.kind || kindNow();      // 못 들은 공간은 권하는 구성으로
    if (HOUSE.dtex && (kdr === 'double' || kdr === 'drape')) out.push(['dtex', '겉커튼 질감', label(OPT.dtex, HOUSE.dtex)]);
    if (HOUSE.stex && (kdr === 'double' || kdr === 'sheer')) out.push(['stex', '속커튼 질감', label(OPT.stex, HOUSE.stex)]);
    if (a.bkind && kdr === 'blind') out.push(['bkind', '종류', label(OPT.bkind, a.bkind)]);
    if (a.room) out.push(['room', '공간', cm(o.R.W) + ' × ' + cm(o.R.D) + ' × ' + cm(o.R.H)]);
    if (a.win) out.push(['win', '창', ws.length > 1 ? ws.length + '장 · ' + ws.map(wsz).join(', ') : wsz(ws[0]) + (ws[0].sill > 0.005 ? ' · 바닥에서 ' + cm(ws[0].sill) : '')]);
    if (a.box != null) {      // 창이 있는 벽마다 — 한 벽뿐이면 풀어서 한 줄로
      var us = []; ws.forEach(function (w) { if (us.indexOf(w.wall) < 0) us.push(w.wall); });
      function side(i, b) { if (b.len == null || b.at == null) return ''; var L = i === 0 || i === 2 ? o.R.W : o.R.D, l = b.at + L / 2, r = L - l - b.len; return l < 0.005 ? ' · 왼쪽 벽에 붙음' : r < 0.005 ? ' · 오른쪽 벽에 붙음' : ' · 왼쪽 벽에서 ' + cm(l); }      // 박스가 벽보다 짧을 때 그 자리
      out.push(['box', '커튼박스', us.map(function (i) { var b = o.boxes[i]; return !b.on ? '없음' : us.length > 1 ? cm(o.R.H + b.h) + ' · ' + cm(b.d) + (b.len != null ? ' · ' + cm(b.len) : '') + side(i, b) : '있음 · 바닥에서 ' + cm(o.R.H + b.h) + ' · 앞뒤 ' + cm(b.d) + (b.len != null ? ' · 길이 ' + cm(b.len) : '') + side(i, b); }).join(' / ')]);      // 길이는 벽 끝까지가 아닐 때만
    }
    if (a.dir != null) out.push(['dir', '창 방향', dirName(a.dir)]);
    if (o.wall != null && o.floor != null) { out.push(['color', '벽', sw('wall', o.wall)]); out.push(['color', '바닥', sw('floor', o.floor)]); }
    if (a.fur) out.push(['fur', '가구', o.items.length ? o.items.map(function (it) { return '<i style="background:' + (it.hex || HATCH_BG) + '"></i>' + TYPES[it.type].name; }).join(' ') : '없음']);
    return out;
  }
  function isNum(k) { return k === 'room' || k === 'win' || k === 'box'; }      // 커튼박스: 창이 있는 벽마다 있음 · 없음, 있으면 바닥에서 높이와 앞뒤 폭
  var NUM = { key: null, i: 0, buf: '', ent: null };
  var FLD = { room: ['가로', '세로', '높이'], win: ['가로', '세로', '바닥에서'], box: ['바닥에서', '앞뒤 폭', '길이'] };      // 박스 길이: 손대지 않으면 벽 길이 — 벽 끝에서 벽 끝까지가 아닐 때만 고쳐 적는다
  // 폰에서 잰 값이 있거나 이미 답한 물음이면 '확인'(값이 보이고 다음 한 번 — 고칠 칸만 눌러 숫자판) / 처음 적는 물음이면 칸마다 차례로
  // 창은 줄마다 한 장(가로 · 세로 · 바닥에서) — 줄을 더하고 뺄 수 있다. map: 그 줄이 지금의 몇째 창인지(새 줄은 null)
  function openNum(k) {
    var pv = !answered(k) && P && P[k], d = GT || dims(), ws = winsNow(), ent;
    if (k === 'box') {      // 폰에서 재 온 값은 모든 벽에 깔린다 — 벽마다 다르면 여기서 고친다
      var fresh = !answered(k), us = wallsUsed(), pk = [], def = [P && P.boxTop ? P.boxTop : d[2] + 0.12, P && P.boxD ? P.boxD : 0.18]; ent = [];
      us.forEach(function (i) { var o = 3 + i * 2; if (!fresh && BOXES[i].on) def = [d[2] + d[o], d[o + 1]]; });      // 없던 벽에 있음을 누르면 옆 벽의 박스 값이 깔린다(ㄱ자 박스는 대개 같다)
      us.forEach(function (i) {
        var b = BOXES[i], o = 3 + i * 2, L = i === 0 || i === 2 ? d[0] : d[1], ln = Math.min(L, P && P.boxL && i === (P.wallOf || 0) ? P.boxL : L);      // 길이: 폰에서 따로 잰 값이 없으면 벽 길이
        if (!fresh) { pk.push(b.on ? 'y' : 'n'); if (b.on) ent.push(d[2] + d[o], d[o + 1], b.len == null ? L : Math.min(L, b.len)); else ent.push(def[0], def[1], L); }
        else { pk.push(P && P.box ? P.box : null); ent.push(def[0], def[1], ln); }
      });
      NUM = { key: k, buf: '', ent: ent, seq: false, i: -1, map: null, walls: us, pick: pk };
      return;
    }
    if (k === 'room') ent = pv ? P.room.slice() : [d[0], d[1], d[2]];
    else { ent = []; (pv ? P.win : ws.map(function (w) { return [w.w, w.top - w.sill, w.sill]; })).forEach(function (r) { ent.push(r[0], r[1], r[2]); }); }
    NUM = { key: k, buf: '', ent: ent, seq: !pv && !answered(k), map: k === 'win' ? ent.filter(function (v, i) { return i % 3 === 0; }).map(function (v, r) { return A.win ? r : null; }) : null };
    NUM.i = NUM.seq ? 0 : -1;
    NUM.sub = k === 'room' && BUILD && !answered(k) && !NUM.seq ? 0 : null;      // 263번: 짓기에서 폰 값을 확인할 때도 가로 · 세로 · 높이를 하나씩(다음 한 번에 한 칸)
    if (k === 'win') NUM.ns = pv ? P.win.map(function (r) { return r[3] || null; }) : ws.map(function (w) { return w.n || null; });      // 창짝 수 — 폰에서 고른 값(넷째 칸)이 있으면 따라온다
  }
  function placeWins(list) {      // 자리를 모르는 창은 창 벽에 놓아 둔다 — 자리는 방에서 끌어 맞춘다(옆 벽으로도)
    var fresh = list.filter(function (o) { return o.x == null; }), kept = list.filter(function (o) { return o.x != null; }), tot = 0, at, wall = 0, Lw = R.W;
    if (!fresh.length) return;
    if (!kept.length) {
      fresh.forEach(function (o) { o.w = clamp(o.w, WMIN, R.W - 0.3); tot += o.w; });
      if (tot <= R.W - 0.1) {      // 다 들어가면 벽에 고르게 띄워 놓는다 — 띄울 틈이 거의 없으면 붙여서(연창). 큰 거실의 4 m 창 둘 · 셋도 이렇게 놓이고, 자리는 끌어 맞춘다
        var gap = (R.W - tot) / (fresh.length + 1); if (gap < 0.2) gap = 0;
        at = gap ? -R.W / 2 + gap : -tot / 2;
        fresh.forEach(function (o) { o.wall = 0; o.x = at + o.w / 2; at += o.w + gap; });
        return;
      }
      at = -R.W / 2 + 0.05;
      var side = cam.position.x >= 0 ? 3 : 1, sg = side === 3 ? -1 : 1, end0 = 0;      // 창 벽에 다 안 들어가면 옆 벽으로 — 지금 보이는 쪽 옆 벽(걷어 둔 벽으로 보내지 않는다)
      fresh.forEach(function (o) {
        if (wall === 0 && at + o.w > Lw / 2 - 0.02) { wall = side; Lw = R.D; end0 = at; at = -Lw / 2 + 0.05; }
        o.wall = wall; o.x = (wall === 0 ? 1 : sg) * (at + o.w / 2); at += o.w;      // 옆 벽에서는 창 벽과 만나는 모서리부터 채운다
      });
      if (wall !== 0) fresh.forEach(function (o) { if (o.wall === 0) o.x = sg > 0 ? o.x + R.W / 2 - 0.05 - end0 : o.x; });      // 창 벽의 창도 그 모서리 쪽으로 모은다(ㄱ자 창)
      return;
    }
    fresh.forEach(function (o) {
      var last = kept[kept.length - 1], L = wlen(last.wall), over;
      o.wall = last.wall; o.w = clamp(o.w, WMIN, L - 0.3); o.x = last.x + last.w / 2 + o.w / 2; over = o.x + o.w / 2 - (L / 2 - 0.02);
      if (over > 0) kept.concat([o]).forEach(function (q) { if (q.wall === o.wall) q.x -= over; });
      kept.push(o);
    });
  }
  function fitUnder(i) {      // 박스가 벽보다 짧으면 그 벽의 창들을 박스 밑으로 — 창은 늘 박스 밑에 있다(창 자리를 모를 때 벽 가운데에 놓아 두었으므로)
    var sg = boxSeg(i), lo = Infinity, hi = -Infinity, ws = WINS.filter(function (w) { return w.wall === i; });
    ws.forEach(function (w) { lo = Math.min(lo, w.x - w.w / 2); hi = Math.max(hi, w.x + w.w / 2); });
    if (!ws.length || (lo >= sg.a - 0.001 && hi <= sg.b + 0.001) || hi - lo > sg.b - sg.a) return;
    var dx = (sg.a + sg.b) / 2 - (lo + hi) / 2; ws.forEach(function (w) { w.x = snap(w.x + dx, 0.01); });
  }
  function applyNum() {
    var e = NUM.ent, old, list, r, src;
    if (NUM.key === 'room') { R.W = e[0] = clamp(e[0], 1.5, RMAX[0]); R.D = e[1] = clamp(e[1], 1.0, RMAX[1]); R.H = e[2] = clamp(e[2], 2.1, RMAX[2]); }      // 272번: 천장 높이 2.1 ~ 6 m
    else if (NUM.key === 'box') NUM.walls.forEach(function (wl, rr) {      // 바닥에서 커튼박스까지 − 바닥에서 천장까지 = 박스가 파인 깊이
      var b = BOXES[wl], on = NUM.pick[rr] === 'y';
      if (on) { var L = wlen(wl); b.h = clamp(e[rr * 3] - R.H, 0.03, 0.4); b.d = clamp(e[rr * 3 + 1], 0.06, 0.4); b.len = e[rr * 3 + 2] >= L - 0.005 ? null : clamp(e[rr * 3 + 2], 0.3, L); }      // 벽 길이와 같으면 벽 끝까지(null)
      if (on && b.len == null) b.at = null;
      else if (on && b.at == null && P && P.boxAt != null && wl === (P.wallOf || 0)) b.at = -wlen(wl) / 2 + P.boxAt;      // 폰에서 잰 박스 자리(왼쪽 벽에서 박스 끝까지)
      if (on && b.len != null) fitUnder(wl);
      setBox(wl, on);
    });
    else {
      old = WINS.slice(); list = [];
      for (r = 0; r < e.length / 3; r++) {
        src = A.win && NUM.map[r] != null ? old[NUM.map[r]] : null;
        var o = { w: Math.max(WMIN, e[r * 3]), sill: clamp(e[r * 3 + 2], 0, R.H - 0.5), x: src ? src.x : null, wall: src ? src.wall : null, n: NUM.ns ? NUM.ns[r] || null : null };
        o.top = clamp(o.sill + e[r * 3 + 1], o.sill + WMIN, R.H - 0.03); list.push(o);
      }
      if (!(A.win && list.length === old.length && NUM.map.every(function (m, rr) { return m === rr; }))) { C.sz = {}; C.bl = {}; }      // 창이 늘거나 줄면 커튼 · 블라인드 크기는 권하는 값부터 다시
      placeWins(list); WINS.length = 0; list.forEach(function (q) { WINS.push(q); }); S.wsel = 0; S.csel = 0;
    }
  }
  function fieldsHtml() {
    var names = FLD[NUM.key], n = names.length, rows = NUM.ent.length / n, h = '', r, i, j, on, v, soft;
    if (NUM.key === 'box') {      // 벽마다: 있음 · 없음(벽이 둘이면 그 벽의 창 크기가 옆에) → 있으면 바닥에서 · 앞뒤 폭
      var lab = false, wn = winsNow();
      NUM.walls.forEach(function (wl, rr) {
        var pk = NUM.pick[rr];
        h += '<div class="opts">' + OPT.box.map(function (o) { return '<button type="button" class="opt' + (pk === o[0] ? ' on' : '') + '" data-opt="box" data-val="' + o[0] + ':' + rr + '"><span>' + o[1] + '</span></button>'; }).join('')
          + (NUM.walls.length > 1 ? '<i class="sub">' + wn.filter(function (w) { return w.wall === wl; }).map(function (w) { return cm(w.w) + ' × ' + cm(w.top - w.sill); }).join(', ') + '</i>' : '') + '</div>';
        if (pk !== 'y') return;
        h += '<div class="frow">';
        for (i = 0; i < 3; i++) {
          j = rr * 3 + i; on = j === NUM.i; v = on && NUM.buf ? NUM.buf : cm(NUM.ent[j]);
          h += '<button type="button" class="fld' + (on ? ' on' : '') + (lab ? ' bare' : '') + '" data-fld="' + j + '"' + (lab ? ' aria-label="' + names[i] + '"' : '') + '>' + (lab ? '' : '<span class="sub">' + names[i] + '</span>') + '<span class="num' + (on && !NUM.buf ? ' soft' : '') + '">' + v + '</span></button>';
        }
        h += '</div>'; lab = true;
      });
      return h;
    }
    for (r = 0; r < rows; r++) {
      h += '<div class="frow">';
      for (i = 0; i < n; i++) {
        j = r * n + i; on = j === NUM.i; v = on && NUM.buf ? NUM.buf : cm(NUM.ent[j]); soft = on ? !NUM.buf : (NUM.seq && j > NUM.i) || (NUM.sub != null && j > NUM.sub);      // 263번: 아직 확인하지 않은 칸은 옅게
        h += '<button type="button" class="fld' + (on ? ' on' : '') + (r ? ' bare' : '') + '" data-fld="' + j + '"' + (r ? ' aria-label="' + names[i] + '"' : '') + '>' + (r ? '' : '<span class="sub">' + names[i] + '</span>') + '<span class="num' + (soft ? ' soft' : '') + '">' + v + '</span></button>';
      }
      if (NUM.key === 'win' && rows > 1 && NUM.i < 0) h += '<button type="button" class="act" data-winrm="' + r + '"><span>빼기</span></button>';
      h += '</div>';
    }
    if (NUM.key === 'win' && NUM.i < 0) h += '<div class="frow"><button type="button" class="act" id="r3d-winadd"><span>+ 창</span></button></div>';
    return h;
  }
  var KEYS = '<div class="keys" id="r3d-keys">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'].map(function (k) {
    return '<button type="button" class="key' + (k === 'go' ? ' go' : k === 'del' ? ' del' : '') + '" data-key="' + k + '"' + (k === 'del' ? ' aria-label="지우기"' : '') + '>' + (k === 'go' ? '<span>다음 →</span>' : k === 'del' ? '←' : k) + '</button>';
  }).join('') + '</div>';
  function optsHtml(k, list, cur) {
    return '<div class="opts">' + list.map(function (o) {
      var on = Array.isArray(cur) ? cur.indexOf(o[0]) >= 0 : cur === o[0];
      return '<button type="button" class="opt' + (on ? ' on' : '') + '" data-opt="' + k + '" data-val="' + o[0] + '"><span>' + o[1] + '</span></button>';
    }).join('') + '</div>';
  }
  function qHtml(k) {
    if (!k && BLD && ENDV) return '<h2>' + esc(HOST.name || '공간') + ' · 공간을 다 만들었습니다</h2><p class="r3d-endp">이제 원하시는 분위기를 말씀해 주세요.</p>';      // 267번: 다 지은 눈높이 — 오른쪽 장에 두 줄
    if (!k) return '';
    var h = '<h2>' + title(k) + '</h2>';
    if (isNum(k)) return h + '<div class="fields" id="r3d-flds"></div>' + KEYS;
    if (k === 'type') return h + optsHtml(k, SPACE_TYPES.map(function (t) { return [t, t]; }), A.type);      // 폰에서 안 잰 공간만 여기로 온다(폰에서 잰 공간은 공간 화면에 이미 떠 있다)
    if (k === 'color') {      // 폰 사진에서 잰 색이 있으면 그 둘만 보인다(고르는 것이 아니라 확인) — 다음 한 번에 벽, 이어서 바닥이 칠해진다
      var conf = pre('color');
      return h + '<div class="chips">' + ['wall', 'floor'].map(function (sf) {
        return SURFS[sf].map(function (c, i) {
          var on = (S[sf] != null ? S[sf] : P ? P[sf] : null) === i;
          return conf && !on ? '' : chipHtml('surf', sf + ':' + i, c.hex, c.name, sf === 'wall' ? '벽' : '바닥', on && !conf ? 'on' : '');
        }).join('');
      }).join('') + '</div>';
    }
    if (k === 'fur') return h + '<div class="chips">' + TYPE_ORDER.map(function (t) { return chipHtml('type', t, HATCH_BG, TYPES[t].name, ''); }).join('') + '</div>';      // 폰에서 못 잰 가구만 여기서 — 놓고 치수 · 색을 잰다
    if (k === 'dir') return h + optsHtml(k, OPT.dir, A.dir || (P && P.dir) || []);
    return h + optsHtml(k, OPT[k], A[k] != null ? A[k] : P ? P[k] : null);
  }
  var recSig = '', qSig = '', fldSig = '';
  function paintPanel() {
    var inPanel = S.step === 'measure', k = inPanel ? S.q : null, h = '';
    if (k && ENDV) ENDV = false;      // 267번: 되돌리기로 질문이 다시 열리면 끝 장면이 아님(손잡이 · '다음 →'으로, 다 고치면 다시 눈높이)
    if (inPanel) recList(JSON.parse(pack())).forEach(function (r) {
      if (r[0] === k || stepOf(r[0]) !== S.step) return;      // 묻기에서는 들은 말을, 재기에서는 잰 것을 — 다른 순서의 것은 머리의 순서를 눌러 본다
      h += '<button type="button" class="row" data-rec="' + r[0] + '"><span class="k">' + r[1] + '</span><span class="v">' + r[2] + '</span></button>';
    });
    if (h !== recSig) { recSig = h; rec.innerHTML = h; rec.scrollTop = rec.scrollHeight; }
    if (isNum(k)) { if (NUM.key !== k || (k === 'box' && NUM.walls.join() !== wallsUsed().join())) openNum(k); } else NUM.key = null;      // 창이 다른 벽으로 옮겨 가면 커튼박스 줄도 다시
    var q = qHtml(k);
    if (q !== qSig) { qSig = q; qbox.innerHTML = q; qbox.hidden = !q; fldSig = ''; }
    if (isNum(k)) { var f = fieldsHtml(); if (f !== fldSig) { fldSig = f; $('flds').innerHTML = f; } $('keys').hidden = NUM.i < 0; }
    pnext.hidden = isNum(k) && NUM.i >= 0;
    var need = k && !answered(k) && !pre(k) && !isNum(k) && k !== 'dir' && k !== 'fur';
    if (BEAT || (k === 'box' && NUM.key === k && NUM.pick.some(function (p) { return p == null; }))) need = true;      // 커튼박스: 벽마다 있음 · 없음을 골라야 넘어간다
    pnext.classList.toggle('off', !!need || (!k && !canStep(STEPS[STEPS.indexOf(S.step) + 1]) && !(BLD && ENDV)));
    app.dataset.endv = BLD && ENDV ? '1' : '';      // 267번: 다 지은 장면은 보기만(손잡이 · 치수 숨김 — 위 CSS)
    var pl = BLD && ENDV ? '질문으로 →' : '다음 →', ps = pnext.querySelector('span'); if (ps && ps.textContent !== pl) ps.textContent = pl;      // 267번: 그때 '다음' 단추는 '질문으로 →'
  }
  var headSig = '';
  function paintHead() {      // 258번: 머리 — 공간 이름 · 측정 · 선택 · 도구(되돌리기 · 가구 · 낮 · 밤 · 위에서 · 눈높이)
    var h = '<h1>' + esc(HOST.name || '공간') + '</h1>';
    if (h !== headSig) { headSig = h; spacesEl.innerHTML = h; }
    [].forEach.call(root.querySelectorAll('.steps [data-step]'), function (el) { var st = el.dataset.step; el.classList.toggle('on', st === S.step); el.classList.toggle('off', st !== S.step && !canStep(st)); });
    app.dataset.step = S.step;
    undoBtn.classList.toggle('off', !UNDO.length);
    var fn = S.hideFur ? '가구 보이기' : '가구 숨기기'; fursBtn.classList.toggle('hid', !!S.hideFur); fursBtn.setAttribute('aria-pressed', !!S.hideFur); fursBtn.setAttribute('aria-label', fn); fursBtn.title = fn;      // 숨기면 그림에 빗금이 그어진다
    [].forEach.call(root.querySelectorAll('[data-night]'), function (el) { var on = (el.dataset.night === '1') === !!S.night; el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); });
    if (S.view === 'hem' && !hemOK()) { setView(S.step === 'measure' ? 'top' : 'eye'); return; }
    [].forEach.call(root.querySelectorAll('.tools [data-view]'), function (el) { var on = el.dataset.view === S.view; el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); });      // 밑단을 가까이 보는 동안에는 둘 다 점이 없다 — 어느 쪽이든 누르면 돌아온다
    canvas.setAttribute('aria-label', (HOST.name || '공간') + ' 모형');
  }
  function paintUI() { paintTray(); paintPanel(); paintHead(); paintLamp(); if (GUEST) paintGuest(); }      // 260번: 손님용 띠
  // 속커튼을 볼 때 — 겉커튼은 양옆으로 걷히고(낮의 모습), 고른 벌의 창 앞으로 다가간다. 나오면 되돌린다
  var OPENED = false, OPID = 0, ZT = 0, ZID = 0;
  function normPart() { var k = kindNow(); if (k === 'sheer') S.part = 'sheer'; else if (k !== 'double') S.part = 'drape'; else if (!S.part) S.part = 'drape'; }
  function syncOpen() {
    var want = sheerMode() && kindNow() === 'double', id, a;
    if (want && !OPENED) { OPENED = true; id = ++OPID; C.open0 = C.open; a = C.open; tween(800, function (k) { if (id === OPID) { C.open = a + (1 - a) * k; layout(); } }); }
    else if (!want && OPENED) { OPENED = false; id = ++OPID; a = C.open; var b = C.open0 != null ? C.open0 : 0.55; tween(800, function (k) { if (id === OPID) { C.open = a + (b - a) * k; layout(); } }); }
  }
  function restoreOpen() { if (OPENED) { OPENED = false; OPID++; C.open = C.open0 != null ? C.open0 : 0.55; } }
  function syncZoom() {
    var want = S.step === 'cur' && roomReady() && kindNow() ? 1 : 0; if (want === ZT) return;      // 고르기에서는 늘 고르는 벌 앞으로 — 장이 넓어져 방이 좁아진 만큼
    ZT = want; var a = V.s, id = ++ZID; tween(1100, function (k) { if (id === ZID) V.s = a + (want - a) * k; });
  }
  var lastKind = null;
  function kindKey() { var k = roomReady() ? kindNow() : null; return k === 'blind' ? k + ':' + bkNow() + (BK[bkNow()].band ? ':' + bandNow().join('/') : SLAT[bkNow()] ? ':' + glowNow() : '') : k; }      // 구성(블라인드는 종류까지) — 바뀌면 방을 다시 짓는다
  function render(anim) {
    if (CURI && CURI.need && !CURI.hand && S.step === 'cur' && roomReady() && kindNow() && kindNow() !== 'blind' && groups().length === 1) seedCur(groups()[0], CURI.w, CURI.h);      // 266번: 커튼 크기를 손대기 전에는 품목 크기로(측정에서 창 · 박스 · 높이가 바뀐 것을 따라감) — 그릴 수 없는 만큼은 처음부터 견적 차이로
    if (S.q === 'fur' && P && P.furs && !A.fur && !BLD) { var fl = P.furs;      // 263번: 짓기에서는 '다음'을 눌러야 놓인다(panelNext)
      P.furs = null; fl.forEach(function (t) { var it = addFur(t.t, null, null, t.w && t.d && t.h ? t : null); if (t.hex && !it.hex) { it.hex = t.hex; it.cn = t.cn || '측정한 색'; } }); buildFurs(); sharesDirty = true; }      // 258번: 앱에서 색만 잰 가구(치수 없음)는 흔한 규격으로 놓이고 잰 색이 입혀진다
    var kn = kindKey();
    if (kn !== lastKind) { lastKind = kn; layout(); }      // 구성이 바뀌면 레일 · 블라인드 자리를 다시 짓는다
    normPart(); syncOpen(); syncZoom(); lampGo(anim);
    paintRoom(anim !== false);
    if (sharesDirty) { measure(); sharesDirty = false; }
    paintRoom(anim !== false); paintBoard(); paintUI();
  }
  // ───── 담기 · 되돌리기 · 공간 바꾸기 ─────
  function pack(full) {
    var g = GT, o = { R: g ? { W: g[0], D: g[1], H: g[2], T: R.T } : R, WINS: winsNow(), C: C, boxes: BOXES.map(function (b, i) { return { on: b.on, h: g ? g[3 + i * 2] : b.h, d: g ? g[4 + i * 2] : b.d, len: b.len, at: b.at }; }), A: A, P: P, wall: S.wall, floor: S.floor, seq: S.seq, DELTA: DELTA,
      items: S.items.map(function (i) { return { id: i.id, type: i.type, w: i.w, h: i.h, d: i.d, si: i.si, hc: i.hc, x: i.x, z: i.z, wall: i.wall, rot: i.rot, hex: i.hex, cn: i.cn, m: i.m, m0: i.m0 }; }) };
    if (full) { o.step = S.step; o.q = S.q; o.view = S.view; o.part = S.part; o.cmp = S.cmp; }
    return JSON.stringify(o);
  }
  function unpack(s) {
    var o = JSON.parse(s), k;
    glideId++; GT = null; P = o.P || null;
    for (k in o.R) if (o.R[k] !== null && isFinite(o.R[k])) R[k] = o.R[k]; WINS.length = 0; o.WINS.forEach(function (w) { WINS.push(w); }); S.wsel = 0; S.csel = 0; o.boxes.forEach(function (b, i) { var t = BOXES[i]; t.tk++; t.on = b.on; t.k = b.on ? 1 : 0; t.h = b.h; t.d = b.d; t.len = b.len == null ? null : b.len; t.at = b.at == null ? null : b.at; }); for (k in o.C) C[k] = o.C[k]; for (k in o.A) A[k] = o.A[k]; SLID++; SLV = C.slit; HEMID++; HEMV = C.lead ? 0 : 1; DHEMV = C.dlead ? 0 : 1;
    RISE.k = A.room ? 1 : 0; GLS.k = A.win ? 1 : 0;
    ['wall', 'floor', 'seq', 'items'].forEach(function (key) { S[key] = o[key] === undefined ? null : o[key]; });
    DELTA = o.DELTA ? JSON.parse(JSON.stringify(o.DELTA)) : {};      // 258번: 손으로 바꾼 크기(cm) — 되돌리기도 따라간다
    if (!S.items) S.items = [];
    if (o.step) { S.step = o.step; S.q = o.q; S.view = o.view; if (o.part) S.part = o.part; if (o.cmp != null) S.cmp = o.cmp; }
    if (S.sel && S.sel.fur != null && !itemOf(S.sel.fur)) S.sel = null;
    NUM.key = null;
  }
  function keep() { var s = pack(); if (UNDO[UNDO.length - 1] !== s) UNDO.push(s); if (UNDO.length > 60) UNDO.shift(); }
  function settleStep() { while (STEPS.indexOf(S.step) > 0 && !canStep(S.step)) S.step = STEPS[STEPS.indexOf(S.step) - 1]; }
  function undo() {
    var now = pack(), s; do { s = UNDO.pop(); } while (s && s === now); if (!s) { paintUI(); return; }
    unpack(s); settleStep(); S.q = firstOpen(S.step);
    refit(); layout(); sharesDirty = true; render();
  }
  function curNext() {      // 고르기의 다음 — 이중 커튼은 겉커튼 → 속커튼, 마지막은 완료(공간 화면으로)
    if (!partDone()) return;
    if (kindNow() === 'double' && S.part === 'drape') { keep(); S.part = 'sheer'; S.cmp = false; S.night = false; render(); return; }
    finish(true);      // 258번: 완료 — 앱의 공간 화면으로
  }
  // ───── 보는 자리 ─────
  function boxWall() {      // 손잡이를 붙일 커튼박스의 벽 — 재기에서는 고른 창의 벽, 고르기에서는 고른 커튼(블라인드)의 벽
    if (!WINS.length) return null;
    if (S.step === 'cur' && kindNow()) return kindNow() === 'blind' ? BB().wall : CB().wall;
    var w = WINS[S.wsel] || WINS[0]; if (bx(w.wall).on) return w.wall;
    var us = wallsUsed(); for (var i = 0; i < us.length; i++) if (bx(us[i]).on && !boxSeg(us[i]).full) return us[i];
    return w.wall;
  }
  function hemOK() { return S.step === 'cur' && roomReady() && !!kindNow(); }      // 밑단 보기는 고르기에서 커튼(블라인드)이 걸려 있을 때만
  function hemPt() {      // 밑단을 볼 자리(벽 기준) · gap: 아래(바닥 · 창턱)에서 뜬 거리
    var kd = kindNow(); if (!kd) return null;
    if (kd === 'blind') { var b = BB(), w = WINS[b.j], base = w.sill > 0.005 && b.bot >= w.sill - 0.0005 ? w.sill : 0; var sf = SLAT[bkNow()] ? BK[bkNow()].slat * 0.55 : 0; return { wall: b.wall, x: b.cx - b.w * 0.2, y: b.bot, z: b.zo, f: b.zo + sf, gap: b.bot - base, base: base, bl: true }; }
    var c = CB(), vw = Math.min(c.cw, wlen(c.wall) - 0.006), l = c.cx - vw / 2;
    if (kd === 'sheer' || S.part === 'sheer') return { wall: c.wall, x: l + Math.min(0.6, vw * 0.3, c.sdw * 0.6), y: c.botY, z: c.zs, f: c.zs + 0.016, gap: c.botY, base: 0 };
    return { wall: c.wall, x: l + c.dw * 0.6, y: c.botY, z: c.zd, f: c.zd + c.A, gap: c.botY, base: 0 };      // f: 주름 마루의 앞 — 치수선이 서는 자리      // 왼쪽 겉커튼 — 안쪽 끝과 바닥 사이가 함께 보이게
  }
  var SW = 1, SH = 1, tA = new THREE.Vector3(), pA = new THREE.Vector3(), tB = new THREE.Vector3(), tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  var FC = { p: new THREE.Vector3(), t: new THREE.Vector3(), on: false };      // 속커튼을 볼 때 다가갈 자리(벌을 바꾸면 부드럽게 옮겨 간다)
  function resize() { var r = stage.getBoundingClientRect(); SW = Math.max(1, r.width); SH = Math.max(1, r.height); renderer.setSize(SW, SH, false); invalidate(); }
  function fitRad() { return 0.44 * Math.sqrt(Math.pow(R.W + 1.3, 2) + Math.pow(R.D + 1.3, 2) + R.H * R.H); }
  function refit() { var a = V.rad, b = fitRad(); if (Math.abs(a - b) > 0.001) tween(500, function (k) { V.rad = a + (b - a) * k; }); }
  function focusAt(asp) {      // 고르기에서 — 고르는 벌(블라인드) 앞으로 정면에서 다가간다. 속커튼은 비침을 견주려고 그 벌이 화면을 채우게(주방 창처럼 작은 창도 크게), 겉커튼 · 블라인드는 양옆 벽과 바닥 색이 함께 보이게 넉넉히(양옆 1.2 m씩, 바닥에서 천장까지)
    if (!WINS.length || !kindNow()) return null;
    var bl = kindNow() === 'blind', q = bl ? BB() : null, c = bl ? { wall: q.wall, cx: q.cx, cw: q.w, topY: q.top, botY: q.bot, zs: q.zo } : CB(), tight = false;      // 16판: 속지를 볼 때도 겉지와 같은 자리에서 — 비침을 견주려고 창 앞으로 바짝 다가가지 않는다
    WG[c.wall].updateMatrixWorld();
    var L = wlen(c.wall), cwv = Math.min(c.cw, L), n = WALLS[c.wall].n, fv = 34 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(fv / 2) * asp);
    var wn = tight ? cwv * 1.2 + 0.5 : Math.min(Math.max(cwv * 1.2 + 0.5, cwv + 2.4), L + 0.3), hn = tight ? (c.topY - c.botY) * 1.12 + 0.3 : R.H + 0.5;
    var half = Math.max(0, L / 2 + 0.15 - wn / 2), fx = tight ? c.cx : clamp(c.cx, -half, half), yc = tight ? clamp((c.topY + c.botY) / 2, 0.8, R.H) : R.H * 0.5;
    var P0 = L2W(c.wall, fx, yc, c.zs).clone(), d = clamp(Math.max(wn / 2 / Math.tan(hf / 2), hn / 2 / Math.tan(fv / 2)), 1.0, 40);
    return { p: new THREE.Vector3(P0.x + n.x * d, yc, P0.z + n.z * d), t: P0, fov: fv };
  }
  function updateCam() {
    var asp = SW / SH, vf = 28 * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * asp), dist = V.rad / Math.sin(Math.min(vf, hf) / 2);
    tA.set(0, R.H * 0.36, 0);
    pA.set(dist * Math.cos(V.el) * Math.sin(V.az), tA.y + dist * Math.sin(V.el), dist * Math.cos(V.el) * Math.cos(V.az));
    var pB = eyePos(), vfB = clamp(2 * Math.atan(Math.tan(36 * Math.PI / 180) / asp), 0.6, 1.36), bhMax = 0;
    [0, 1, 2, 3].forEach(function (i) { var b = bx(i); bhMax = Math.max(bhMax, b.h * b.k); });
    pB.z = Math.max(pB.z, -R.D / 2 + (R.H + bhMax + 0.3 - pB.y) / Math.tan(Math.max(0.2, vfB / 2 - 0.06)), -R.D / 2 + R.W / 2 / (Math.tan(vfB / 2) * asp) + 0.2);      // 화면이 옆으로 길면 위아래가, 세로로 길면 양옆이 잘린다 — 창 벽이 천장(커튼박스)부터 바닥까지, 끝에서 끝까지 보일 만큼 더 물러선다
    tB.set(pB.x - Math.sin(V.yaw) * 3, pB.y - 0.18, pB.z - Math.cos(V.yaw) * 3);
    var k = ease(V.t), fov = vf + (vfB - vf) * k;
    cam.position.lerpVectors(pA, pB, k); tgt.lerpVectors(tA, tB, k);
    if (V.s > 0.0005) {      // 속커튼 볼 때 — 고른 벌 앞으로
      var zf = focusAt(asp);
      if (zf) {
        if (!FC.on) { FC.p.copy(zf.p); FC.t.copy(zf.t); FC.on = true; }
        else { FC.p.lerp(zf.p, 0.18); FC.t.lerp(zf.t, 0.18); if (FC.p.distanceTo(zf.p) > 0.003 || FC.t.distanceTo(zf.t) > 0.003) invalidate(); }
        var ks = ease(V.s) * k; cam.position.lerp(FC.p, ks); tgt.lerp(FC.t, ks); fov += (zf.fov - fov) * ks;
      }
    } else FC.on = false;
    if (V.h > 0.0005) {      // 밑단 보기 — 고른 커튼(블라인드)의 밑단에서 1 m쯤 떨어져, 바닥에서 한 뼘 남짓 높이에서 비스듬히
      var hp = hemPt(), kh = ease(V.h);
      if (hp) {
        WG[hp.wall].updateMatrixWorld();
        var a = 0.5 + V.hy, dd = hp.bl ? 0.75 : 0.45, ey = hp.bl ? hp.y + 0.3 : Math.max(0.006, hp.y / 2 + 0.004), ty = hp.bl ? hp.y - 0.03 : ey + (asp < 1 ? -0.035 : 0.06);      // 커튼은 아주 조금 올려다봐서 바닥보다 커튼이 더 들어오게 — 세로로 긴 화면(폰)은 아래 크기 칸이 밑단을 가리지 않게 조금 내려다본다      // 커튼: 눈을 틈 높이(바닥에서 1 cm 안팎)에 두고 수평으로 — 밑단과 바닥 사이 틈이 뒤의 빛으로 보이고, 치수선이 틈과 겹쳐 보인다 · 블라인드: 조금 위에서 창턱과 같이
        var hc = L2W(hp.wall, hp.x + Math.sin(a) * dd, ey, hp.z + Math.cos(a) * dd).clone(), ht = L2W(hp.wall, hp.x, ty, hp.z).clone();
        hc.x = clamp(hc.x, -R.W / 2 + 0.08, R.W / 2 - 0.08); hc.z = clamp(hc.z, -R.D / 2 + 0.08, R.D / 2 - 0.08);
        cam.position.lerp(hc, kh); tgt.lerp(ht, kh); fov += (42 * Math.PI / 180 - fov) * kh;
      }
    }
    furRoot.visible = V.h < 0.5;      // 밑단 보기에서는 가구를 걷는다(밑단을 가리지 않게)
    cam.fov = fov * 180 / Math.PI; cam.aspect = asp; cam.near = V.h > 0.02 ? 0.004 : 0.05; cam.updateProjectionMatrix(); cam.lookAt(tgt); cam.updateMatrixWorld();      // near: 바닥에 붙어 볼 때는 코앞의 바닥이 잘리지 않게
    WALLS.forEach(function (w, i) { w.vis.visible = RISE.k > 0.001 && tmp.copy(cam.position).sub(w.pos).dot(w.n) > 0.02; w.vis.scale.y = Math.max(0.001, RISE.k); WG[i].visible = w.vis.visible; });      // 눈과 방 사이를 막는 벽은 걷는다 · 크기를 적기 전에는 벽이 없다
    ceil.visible = RISE.k > 0.999;
    ceilE.visible = cam.position.y < R.H;      // 천장 테두리 선은 아래에서 볼 때만
    var show = V.t < 0.02 && S.step === 'measure' && A.room; dimW.visible = dimD.visible = show;
    dimW.scale.z = cam.position.z >= 0 ? 1 : -1; dimD.scale.x = cam.position.x >= 0 ? 1 : -1;
    sceneSync();      // 19판: 눈 자리에 맞춰 창밖 사진의 조각을 다시 가리킨다
  }
  // 치수 글자와 손잡이 — 지금 순서의 것만 뜬다 (재기: 방 · 창 / 고르기: 커튼 자리)
  var OV = {}, LABEL = { rw: '공간 가로', rd: '공간 세로', wl: '창 가로', wr: '창 가로', wt: '창 위', wb: '창 아래', ct: '커튼 다는 높이', cb: '커튼 길이', cs: '커튼 폭', cr: '커튼 폭 오른쪽 끝', co: '여닫기', fh: '가구 높이', bx: '커튼박스 자리' };
  ['dw', 'dd', 'dn', 'df', 'dg', 'b1', 'b2', 'dc'].forEach(function (k) { var el = document.createElement('span'); el.className = 'dim'; over.appendChild(el); OV[k] = el; });
  Object.keys(LABEL).forEach(function (k) { var el = document.createElement('button'); el.className = 'grip'; el.type = 'button'; el.dataset.grip = k; el.setAttribute('aria-label', LABEL[k]); over.appendChild(el); OV[k] = el; });
  function put(el, x, y, z, on) {
    if (on) tmp.set(x, y, z).project(cam);
    var ok = on && tmp.z > -1 && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
    el.hidden = !ok; if (ok) el.style.transform = 'translate(' + ((tmp.x * 0.5 + 0.5) * SW).toFixed(1) + 'px,' + ((-tmp.y * 0.5 + 0.5) * SH).toFixed(1) + 'px)' + (el.classList.contains('dim') ? ' translate(-50%,-50%)' : '');
  }
  var v3 = new THREE.Vector3();
  function L2W(wall, lx, y, lz) { return v3.set(lx, y, lz).applyMatrix4(WG[wall].matrixWorld); }      // 벽 기준 자리 → 방 안의 자리
  function putL(el, wall, lx, y, lz, on) { var p = L2W(wall, lx, y, lz); put(el, p.x, p.y, p.z, on && WG[wall].visible); }
  function updateOver() {
    var sx = cam.position.x >= 0 ? 1 : -1, sz = cam.position.z >= 0 ? 1 : -1, top = V.t < 0.02, still = (top || V.t > 0.98) && (V.h < 0.02 || V.h > 0.98) && (V.s < 0.02 || V.s > 0.98), T = R.T, e = 0.01;
    WG.forEach(function (g) { g.updateMatrixWorld(); });
    var room = top && S.step === 'measure' && A.room && RISE.k > 0.999;
    OV.dw.textContent = cm(R.W) + ' cm'; OV.dd.textContent = cm(R.D) + ' cm';
    put(OV.dw, 0, 0, sz * (R.D / 2 + T + 0.42), room); put(OV.dd, sx * (R.W / 2 + T + 0.42), 0, 0, room);
    put(OV.rw, sx * (R.W / 2 + T / 2), 0.03, 0, room); put(OV.rd, 0, 0.03, sz * (R.D / 2 + T / 2), room);
    var sw = WINS[S.wsel] || WINS[0], w = S.step === 'measure' && still && A.win && GLS.k > 0.999, wy = (sw.sill + sw.top) / 2;      // 고른 창의 손잡이
    putL(OV.wl, sw.wall, sw.x - sw.w / 2, wy, e, w); putL(OV.wr, sw.wall, sw.x + sw.w / 2, wy, e, w); putL(OV.wt, sw.wall, sw.x, sw.top, e, w); putL(OV.wb, sw.wall, sw.x, sw.sill, e, w);
    OV.dn.textContent = cm(sw.w) + ' × ' + cm(sw.top - sw.sill) + ' cm'; putL(OV.dn, sw.wall, sw.x, sw.top - sw.sill < 1 ? (sw.sill > 0.5 ? sw.sill - 0.22 : sw.top + 0.22) : wy, e, w);      // 작은 창은 글자가 창을 가리지 않게 창 아래(바닥에 가까우면 위)에
    var fi = S.step === 'measure' && still ? selItem() : null, fo = !!fi && !fi.ghost && fi.grow == null;      // 고른 가구의 높이 손잡이
    if (fi) OV.df.textContent = cm(fi.h) + ' cm';
    put(OV.fh, fi ? fi.x : 0, fi ? fi.h : 0, fi ? fi.z : 0, fo); put(OV.df, fi ? fi.x : 0, fi ? fi.h + 0.24 : 0, fi ? fi.z : 0, fo);
    var kd = kindNow(), c = S.step === 'cur' && still && roomReady() && !!kd, b = CB(), pw = b.wall, bl = kd === 'blind', bb = BB();
    putL(OV.ct, pw, b.cx, b.topY, b.zd, c && !bl && !bx(pw).on); putL(OV.cb, pw, b.cx, b.botY, b.zd, c && !bl);
    if (bl) putL(OV.cs, bb.wall, bb.cx - bb.w / 2, bb.top - bb.h / 2, bb.zo, c); else putL(OV.cs, pw, b.cx - b.cw / 2, b.cy, b.zd, c);
    putL(OV.cr, pw, b.cx + b.cw / 2, b.cy, b.zd, c && !bl);      // 266번: 오른쪽 끝 손잡이 — 창 기준은 양옆을 따로
    var cid = c && !bl && drag && drag.type === 'grip' ? drag.id : '', cdo = /^(cs|cr|cb|ct)$/.test(cid);      // 266번(결정 #414): 끄는 동안 손잡이 곁에 cm — 가로와 그쪽 여유 · 높이와 창 아래(바닥에서)
    if (cdo) OV.dc.textContent = cid === 'cs' || cid === 'cr' ? '가로 ' + cm(b.cw) + ' cm' + (b.mode === 'win' ? ' · 창 ' + (cid === 'cs' ? '왼쪽 ' + cm(b.ml) : '오른쪽 ' + cm(b.mr)) + ' cm' : '') : '높이 ' + cm(b.len) + ' cm' + (b.hem === 'win' ? ' · 창 아래 ' + cm(b.below) + ' cm' : ' · 바닥에서 ' + cm(b.botY) + ' cm');
    putL(OV.dc, pw, cid === 'cs' ? b.cx - b.cw / 2 : cid === 'cr' ? b.cx + b.cw / 2 : b.cx, cid === 'cb' ? b.botY : cid === 'ct' ? b.topY : b.cy, b.zd, cdo);
    if (cdo && !OV.dc.hidden) OV.dc.style.transform += ' translateY(-52px)';      // 손가락에 가리지 않게 한 뼘 위
    var shp = kd === 'sheer' || (kd === 'double' && S.part === 'sheer'), svw = Math.min(b.cw, wlen(pw) - 0.006);      // 19판: 속지를 고르는 동안에는 여닫기 손잡이가 속지의 안쪽 끝에 뜬다(겉지는 걷혀 있다)
    if (bl) putL(OV.co, bb.wall, bb.cx, bb.y, bb.zo, c); else if (shp) putL(OV.co, pw, b.cx + svw / 2 - Math.min(b.sdw, svw / 2), b.cy, b.zs, c); else putL(OV.co, pw, b.cx + b.cw / 2 - b.dw, b.cy, b.zd, c);
    var bw = boxWall(), bq = bw != null ? bx(bw) : NOBOX, bs = bw != null ? boxSeg(bw) : null, bL = bw != null ? wlen(bw) : 0;      // 커튼박스 자리 손잡이 — 박스가 벽보다 짧을 때만, 박스 앞턱 가운데에
    var bon = bw != null && still && V.h < 0.02 && bq.on && bq.k > 0.999 && !bs.full && (S.step === 'measure' ? answered('box') && S.q !== 'room' : c);      // 박스를 적고 나면(재기) · 고르기에서
    putL(OV.bx, bw || 0, bs ? (bs.a + bs.b) / 2 : 0, R.H, bq.d + 0.014, bon);
    var bdr = bon && drag && drag.type === 'grip' && drag.id === 'bx';      // 끄는 동안만: 박스 양옆에 벽 끝까지 남은 거리
    putL(OV.b1, bw || 0, bs ? (bs.a - bL / 2) / 2 : 0, R.H - 0.05, bq.d, bdr && bs.a > -bL / 2 + 0.005); putL(OV.b2, bw || 0, bs ? (bs.b + bL / 2) / 2 : 0, R.H - 0.05, bq.d, bdr && bs.b < bL / 2 - 0.005);
    if (bs) { OV.b1.textContent = cm(bs.a + bL / 2) + ' cm'; OV.b2.textContent = cm(bL / 2 - bs.b) + ' cm'; }
    var hp = V.h > 0.98 && c ? hemPt() : null, hd = !!hp && hp.gap >= 0 && hp.gap <= 0.3;      // 뜬 거리 — 바닥(블라인드는 창턱)에서 30 cm 안일 때만
    hemDim.visible = hd;
    if (hd) {      // 아래(바닥 · 창턱)와 밑단에 가로 눈금, 그 사이를 화살촉 둘이 가리킨다. 틈이 좁으면 화살촉은 틈 밖에서 안쪽을 가리킨다(도면의 작은 치수처럼). 숫자는 틈 위로 비켜 선다 — 간격을 가리지 않게
      var g = hp.gap, base = hp.base + 0.0008, anc = L2W(hp.wall, hp.x, base, hp.f + 0.012).clone(), dist = cam.position.distanceTo(anc), px = dist * 2 * Math.tan(cam.fov * Math.PI / 360) / SH;      // px: 그 자리에서 화면 1 px의 길이
      var lt = 2 * px, al = 10 * px, aw = 4.5 * px, tw = Math.max(0.044, 34 * px), small = g < 2 * al + 6 * px, P2 = [], I2 = [];
      function quad(x0, y0, x1, y1) { var n = P2.length / 3; P2.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0); I2.push(n, n + 1, n + 2, n, n + 2, n + 3); }
      function tri(tx, ty, dir) { var n = P2.length / 3; P2.push(tx, ty, 0, tx - aw, ty - dir * al, 0, tx + aw, ty - dir * al, 0); I2.push(n, n + 1, n + 2); }      // 끝이 (tx, ty), dir: 1 위를 · -1 아래를 가리킴
      quad(-tw / 2, -lt / 2, tw / 2, lt / 2); quad(-tw / 2, g - lt / 2, tw / 2, g + lt / 2);      // 눈금 둘
      if (!small) { quad(-lt / 2, al * 0.8, lt / 2, g - al * 0.8); tri(0, g, 1); tri(0, 0, -1); hemLift = 0; }      // 틈이 넉넉하면 안에서 바깥을 가리킨다
      else { var tail = al * 1.6; tri(0, g, -1); quad(-lt / 2, g + al * 0.8, lt / 2, g + al + tail); tri(0, 0, 1); quad(-lt / 2, -al - tail * 0.6, lt / 2, -al * 0.8); hemLift = al + tail; }      // 좁으면 밖에서 안으로
      var hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); hg.setIndex(I2); setGeo(hemDim, hg);
      var par = WG[hp.wall]; if (hemDim.parent !== par) par.add(hemDim);
      hemDim.position.set(hp.x, base, hp.f + 0.012); par.updateMatrixWorld();
      var cl = par.worldToLocal(cam.position.clone()); hemDim.rotation.set(0, Math.atan2(cl.x - hp.x, cl.z - (hp.f + 0.012)), 0);      // 눈 쪽을 본다(옆으로 돌려 봐도 납작해지지 않게)
      OV.dg.textContent = cm(g) + ' cm';
    }
    putL(OV.dg, hp ? hp.wall : 0, hp ? hp.x : 0, hp ? hp.base + 0.0008 + hp.gap + hemLift : 0, hp ? hp.f + 0.012 : 0, hd);
    if (hd && !OV.dg.hidden) OV.dg.style.transform += ' translateY(-50%) translateY(-' + 10 + 'px)';      // 치수선 위 끝에서 한 뼘 위로 — 숫자 상자가 간격을 덮지 않는다
    OV.dg.classList.toggle('hem', hd);
  }
  function frame(now) {
    raf = 0;
    for (var i = tweens.length - 1; i >= 0; i--) {
      var t = tweens[i], k = Math.min(1, (now - t.t0) / t.dur);
      t.fn(ease(k)); if (k >= 1) { tweens.splice(i, 1); if (t.done) t.done(); }
    }
    scene.scale.set(FL.w, 1, FL.d);      // 263번: 점 → 선(가로) → 바닥(세로) — 짓기 밖에서는 늘 1
    updateCam(); updateOver(); renderer.render(scene, cam);
    if (LAMPV[0] < 0.999 || LAMPV[1] < 0.999 || LAMPV[2] < 0.999) { renderer.autoClear = false; renderer.render(lampScene, lampCam); renderer.autoClear = true; }      // 실내등 — 방이 그려진 자리에만 등 색을 곱한다(19판)
    if (tweens.length) invalidate();
  }

  // ───── 누르기 · 끌기 ─────
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hitV = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function aim(e) { var r = stage.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); }
  function planeAt(e, n, c) { aim(e); return ray.ray.intersectPlane(new THREE.Plane(n, c), hitV) ? { x: hitV.x, y: hitV.y, z: hitV.z } : null; }
  function floorAt(e, y) { return planeAt(e, UP, -(y || 0)); }
  function wallHit(e, wall, off) {      // 그 벽 앞 off만큼 떨어진 면에서 손가락이 닿는 자리(벽 기준)
    var n = WALLS[wall].n, p0 = WALLS[wall].pos, l; aim(e);
    if (!ray.ray.intersectPlane(new THREE.Plane(n, -(n.x * (p0.x + n.x * off) + n.z * (p0.z + n.z * off))), hitV)) return null;
    WG[wall].updateMatrixWorld(); l = WG[wall].worldToLocal(hitV.clone()); return { x: l.x, y: l.y };
  }
  function thingAt(e) {      // 가구 · 커튼 · 창 가운데 눈에 가장 가까운 것을 집는다
    aim(e); var list = [], key, o;
    function add(m) { if (m.visible && m.parent && m.parent.visible) list.push(m); }
    S.items.forEach(function (it) { list = list.concat(it.meshes || []); });
    for (key in POOL) { o = POOL[key]; if (o.kind === 'glass') add(o.m); else if (o.kind === 'set') { add(o.l.m); add(o.r.m); add(o.sh); } else if (o.kind === 'blind') add(o.hit); }      // 블라인드는 판 전체가 누르는 자리(살 사이로 창이 눌리지 않게)
    var hit = ray.intersectObjects(list, false); if (!hit.length) return null;
    o = hit[0].object; return o.userData.fur != null ? { fur: o.userData.fur } : o.userData.hit;
  }
  function winMove(e) {      // 창을 끌어 벽을 따라 옮긴다 — 모서리를 넘기면 옆 벽으로
    var w = WINS[drag.j], order = [w.wall, 0, 1, 3], i, wl, h, L;
    for (i = 0; i < order.length; i++) {
      wl = order[i]; if ((i > 0 && wl === w.wall) || !WG[wl].visible) continue;
      h = wallHit(e, wl, 0); L = wlen(wl);
      if (!h || Math.abs(h.x) > L / 2 + (i === 0 ? 0.25 : 0) || h.y < -0.4 || h.y > R.H + 0.4) continue;
      if (wl !== w.wall) {
        if (!WINS.some(function (o) { return o !== w && o.wall === wl; })) { var bs = BOXES[w.wall], bt = BOXES[wl]; bt.tk++; bt.on = bs.on; bt.k = bs.on ? 1 : 0; bt.h = bs.h; bt.d = bs.d; bt.len = null; bt.at = null; }      // 창이 없던 벽으로 넘어가면 떠난 벽의 커튼박스를 물려받는다(ㄱ자 박스는 이어져 있다) — 다르면 커튼박스 물음에서 벽마다 고친다
        w.wall = wl; drag.ox = 0; w.w = Math.min(w.w, L - 0.3);
      }
      w.x = snap(h.x - drag.ox, 0.01); break;
    }
    layout(); render(false);
  }
  function overStage(x, y) { var r = stage.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
  function select(s) { S.sel = s; buildFurs(); paintUI(); invalidate(); }
  function setView(v) {
    if (v === 'hem' && !hemOK()) return;
    if (v === 'hem' && kindNow() === 'blind' && C.open > 0.001) { var o0 = C.open; tween(900, function (k) { C.open = o0 * (1 - k); layout(); }); }      // 블라인드는 내려야 밑단이 보인다
    S.view = v; var a = V.t, b = v === 'top' ? 0 : 1, y0 = V.yaw, h0 = V.h, h1 = v === 'hem' ? 1 : 0, q0 = V.hy;
    tween(v === 'hem' || h0 > 0.5 ? 1100 : 1500, function (k) { V.t = a + (b - a) * k; V.yaw = y0 * (1 - k); V.h = h0 + (h1 - h0) * k; if (h1 === 0) V.hy = q0 * (1 - k); });
    paintTray(); paintHead();      // 장의 밑단 줄에도 점이 옮겨 간다
  }
  // 순서 옮기기 — 머리의 순서 · 뒤로 · 다음으로 옮기면 보는 자리도 따라간다(재기는 위에서, 고르기는 눈높이). 방 안의 것을 눌러 옮기면 보는 자리는 그대로
  // 순서 옮기기 — 머리의 순서 · 뒤로 · 다음으로 옮기면 보는 자리도 따라간다(측정은 위에서, 선택은 눈높이)
  function goStep(st, nav, q) {
    if (!canStep(st)) return;
    if (BLD && st === 'cur') return;      // 263번: 짓기에는 선택이 없다(측정이 끝나면 닫힘)
    var into = st === 'cur' && S.step !== 'cur';
    S.step = st; S.kopen = false; if (st !== 'measure') S.sel = null;
    S.q = q || firstOpen(st);
    if (into) { S.part = kindNow() === 'sheer' ? 'sheer' : 'drape'; S.cmp = false; if (S.part === 'sheer') S.night = false; }
    if (nav) { var v = st === 'measure' ? 'top' : 'eye'; if (v !== S.view && !(S.view === 'hem' && st === 'cur')) setView(v); }
    buildFurs(); sharesDirty = true;
    render();
  }
  var advT = 0;
  function advance(fresh) {      // 답 하나를 듣고 다음 물음으로 — 처음 답한 것이면 순서 끝에서 다음 순서로, 다시 답한 것이면 그 자리에 머문다
    var k = S.q, ses = SESSION; clearTimeout(advT);
    advT = setTimeout(function () {
      if (ses !== SESSION || S.q !== k) return;
      var nx = firstOpen(S.step);
      if (nx) { S.q = nx; render(); } else if (fresh) { S.q = null; nextStep(); } else { S.q = null; render(); }
    }, CALM ? 0 : 320);
  }
  function nextStep() { if (BLD && S.step === 'measure') { if (!ENDV) { ENDV = true; S.q = null; setView('eye'); sharesDirty = true; render(); return; } builtEnd(); return; } var si = STEPS.indexOf(S.step); if (si >= 0 && si < STEPS.length - 1) goStep(STEPS[si + 1], true); }      // 263번: 짓기는 측정 끝 = 닫기 · 267번: 그 전에 한 번 눈높이로 내려와 '다 지었습니다'
  function setBox(i, on) {
    var bq = BOXES[i]; if (bq.on === on) return;
    bq.on = on; var a = bq.k, b = on ? 1 : 0, id = ++bq.tk;
    tween(BMS || 520, function (k) { if (bq.tk !== id) return; bq.k = a + (b - a) * k; layout(); }      // 263번: 짓기는 0.9초
     , function () { if (bq.tk !== id) return; sharesDirty = true; render(); });
  }
  function pickOpt(k, v) {
    var fresh = !answered(k), d, i, opp = { '동': '서', '서': '동', '남': '북', '북': '남' };
    if (k === 'box') {      // 벽마다 있음 · 없음 — 모두 없음이면 바로 닫히고, 있음이 있으면 값을 확인하고 다음
      if (NUM.key !== 'box') return;
      d = String(v).split(':'); NUM.pick[+d[1]] = d[0]; NUM.i = -1; NUM.buf = '';
      for (i = 0; i < WINS.length; i++) if (WINS[i].wall === NUM.walls[+d[1]]) { S.wsel = i; break; }
      if (NUM.pick.every(function (p) { return p === 'n'; })) finishNum(); else { paintPanel(); invalidate(); }
      return;
    }
    keep();
    if (k === 'type') { A.type = v; }
    else if (k === 'dir') {      // 둘까지 — 마주 보는 쪽은 함께 고를 수 없다
      d = (A.dir || (P && P.dir) || []).slice(); i = d.indexOf(v);
      if (i >= 0) d.splice(i, 1); else { d = d.filter(function (x) { return x !== opp[v]; }); d.push(v); if (d.length > 2) d.shift(); }
      A.dir = d; layout(); render(); if (SUNK.k < 0.001 && d.length) sunIn(); return;      // 263번: 처음 고르면 빛이 든다
    }
    else if (k === 'dtex' || k === 'stex') { HOUSE[k] = v; if (HOUSE[k + 'At'] == null) HOUSE[k + 'At'] = SI; }      // 질감은 집에 한 번 — 물은 공간을 적어 둔다
    else if (k === 'feel') { A.feel = v; S.cand = null; S.candName = null; S.fabric = null; S.settled = false; }
    else A[k] = v;
    sharesDirty = true; render(); advance(fresh);
  }
  var BEAT = false;      // 색이 박자에 맞춰 들어가는 동안
  function sunIn() {      // 263번: 창으로 빛이 든다 — 1.1초 (짓기 밖에서는 SUNK가 늘 1이라 아무것도 안 함)
    if (SUNK.k > 0.999) return;
    var a = SUNK.k; tween(1100, function (t) { SUNK.k = a + (1 - a) * t; patchMat.opacity = PATCH0 * SUNK.k; }, function () { SUNK.k = 1; sharesDirty = true; render(); });
  }
  function panelNext() {
    var k = S.q, nx;
    if (isNum(k) && NUM.key === k && NUM.sub != null && NUM.sub < 2 && NUM.i < 0) { buildSub(NUM.sub); NUM.sub++; paintPanel(); return; }      // 263번: 다음 한 번에 한 칸 — 가로 → 세로, 높이에서 벽이 선다
    if (isNum(k) && NUM.key === k) { if (k !== 'box' || NUM.pick.every(function (p) { return p != null; })) finishNum(); return; }
    if (BEAT) return;
    if (k && pre(k)) {      // 폰에서 잰 값을 그대로 받는다
      keep();
      if (k === 'dir') { A.dir = P.dir.slice(); layout(); sunIn(); }      // 263번: 확인하면 빛이 든다
      else if (k === 'color' && BLD) {      // 263번: 짓기는 '다음' 한 번에 하나 — 벽, 다음에 바닥(11-25 사장님 '나누자')
        if (S.wall == null) { S.wall = P.wall; sharesDirty = true; render(); return; }
        S.floor = P.floor; sharesDirty = true;
      }
      else if (k === 'color') {      // 벽이 먼저, 이어서 바닥 — 우리 집 색이 들어가는 것이 보이게 두 박자로
        var si0 = SESSION, wait = CALM ? 0 : 420;
        BEAT = true; S.wall = P.wall; sharesDirty = true; render();
        setTimeout(function () {
          if (SESSION !== si0 || S.q !== 'color') { BEAT = false; return; }
          S.floor = P.floor; sharesDirty = true; render();
          setTimeout(function () { BEAT = false; if (SESSION !== si0 || S.q !== 'color') return; S.q = firstOpen(S.step); sharesDirty = true; render(); if (!S.q) nextStep(); }, wait);
        }, wait);
        return;
      }
    }
    if (k === 'dir' && A.dir == null) { keep(); A.dir = []; sunIn(); }      // 263번
    if (k === 'fur' && BLD && P && P.furs && !A.fur) { keep(); var fz = P.furs; P.furs = null; fz.forEach(function (t) { var it = addFur(t.t, null, null, t.w && t.d && t.h ? t : null); if (t.hex && !it.hex) { it.hex = t.hex; it.cn = t.cn || '측정한 색'; } }); buildFurs(); sharesDirty = true; render(); return; }      // 263번: 짓기 — 폰에서 잰 가구는 '다음'을 누르면 솟아오르고, 한 번 더 누르면 마침
    if (k === 'fur' && !A.fur) { keep(); A.fur = true; }
    if (k && !answered(k)) return;      // 답이 있어야 넘어간다
    nx = firstOpen(S.step);
    if (nx) { S.q = nx; sharesDirty = true; render(); } else { S.q = null; sharesDirty = true; render(); nextStep(); }
  }
  function buildSub(j) {      // 263번: 공간 크기 한 칸을 확인 — 가로면 점이 선으로, 세로면 선이 바닥으로 펴진다
    var e = NUM.ent, a, key = j === 0 ? 'w' : 'd';
    if (j === 0) R.W = e[0] = clamp(e[0], 1.5, RMAX[0]); else R.D = e[1] = clamp(e[1], 1.0, RMAX[1]);
    layout(); a = FL[key]; tween(BMS, function (t) { FL[key] = a + (1 - a) * t; });
  }
  function finishNum() {      // 숫자 물음을 닫는다 — 방이 그 크기로 부드럽게 바뀐다
    var key = NUM.key, first = !answered(key), from;
    keep(); from = glideStart(); applyNum(); NUM.key = null;
    if (key === 'box') A.box = NUM.pick.indexOf('y') >= 0 ? 'y' : 'n'; else A[key] = true;
    if (first && key === 'room') { var fw = FL.w, fd = FL.d; tween(BMS || 700, function (t) { RISE.k = t; FL.w = fw + (1 - fw) * t; FL.d = fd + (1 - fd) * t; }, function () { RISE.k = 1; FL.w = FL.d = 1; }); }      // 263번: 짓기는 0.9초 · 못 펴진 바닥도 함께
    if (first && key === 'win') tween(BMS || 450, function (t) {      // 263번: 짓기는 0.9초
      GLS.k = t; layout(); paintRoom(false); }, function () { GLS.k = 1; layout(); paintRoom(false); });      // 창이 벽을 뚫고 올라온다
    S.q = firstOpen(S.step);
    refit(); glideGo(from); sharesDirty = true; render();
  }
  function keyPress(k) {      // 숫자판 — cm로 적는다. 비워 두고 다음이면 깔려 있는 값 그대로. 1000이 넘으면 mm로 잰 것(공간 가로 · 세로는 2000부터)
    if (!NUM.key || NUM.i < 0) return;
    if (k === 'del') { if (NUM.buf) NUM.buf = NUM.buf.slice(0, -1); else if (!NUM.seq) NUM.i = -1; else if (NUM.i > 0) NUM.i--; paintPanel(); return; }
    if (k !== 'go') { if (NUM.buf.length < 5) NUM.buf += k; paintPanel(); return; }
    if (NUM.buf) { var v = +NUM.buf; if (v >= (NUM.key === 'room' && NUM.i < 2 ? 2000 : 1000)) v /= 10; NUM.ent[NUM.i] = v / 100; }      // 공간 가로 · 세로는 10 m를 넘기도 해서 2000부터 mm로 본다
    NUM.buf = '';
    if (!NUM.seq && NUM.key === 'room' && NUM.sub != null && NUM.i < NUM.sub) { var fr = glideStart(); if (NUM.i === 0) R.W = NUM.ent[0] = clamp(NUM.ent[0], 1.5, RMAX[0]); else R.D = NUM.ent[1] = clamp(NUM.ent[1], 1.0, RMAX[1]); glideGo(fr); }      // 263번: 이미 지은 칸을 고치면 바로 그 크기로
    if (!NUM.seq) { NUM.i = -1; paintPanel(); return; }      // 한 칸만 고친 것 — 확인으로 돌아간다
    NUM.i++;
    if (NUM.key === 'room' && BUILD && !answered('room') && NUM.i <= 2) buildSub(NUM.i - 1);      // 263번: 칸마다 적는 공간 — 적은 칸만큼 바닥이 펴진다
    if (NUM.i >= NUM.ent.length) finishNum(); else paintPanel();
  }

  function place(kind, key, e) {
    keep();
    var a;
    if (kind !== 'kind') S.kopen = false;
    if (kind === 'kind') {      // 구성 바꾸기(17판, 결정 #404) — 네 구성 가운데 하나. 고른 원단은 구성을 바꿔도 남는다(결정 #395). 새로 걸린 겹을 고르게 된다
      var k0 = kindNow(); S.kopen = false;
      if (key !== k0) { A.kind = key; S.part = key === 'sheer' || (key === 'double' && k0 === 'drape') ? 'sheer' : 'drape'; if (S.part === 'sheer') { S.cmp = C.sf == null; S.night = false; } }
    }
    else if (kind === 'bkind') { A.bkind = key; if (BK[key].band && C.slit > 0.01 && C.slit < 0.99) C.slit = 1; SLID++; SLV = C.slit; layout(); }      // 블라인드 종류 — 방의 블라인드가 그 종류로 다시 그려진다(콤비에는 '반쯤'이 없다)
    else if (kind === 'slit') { C.slit = +key; slitGo(); }      // 빛 조절(18판) — 살이 돌아가고 · 띠가 밀려 간다
    else if (kind === 'hem') { if (sheerMode()) C.lead = key === 'lead'; else C.dlead = key === 'lead'; hemGo(); }      // 밑단 — 고르고 있는 겹(겉지 · 속지)의 것
    else if (kind === 'tape') { C.tape = key === 'band'; layout(); }
    else if (kind === 'lamp') C.lamp = key;      // 실내등 — 옮겨 가는 일은 render()의 lampGo가      // 속지 밑단 — 시접 · 리드밴드      // 블라인드 종류 — 방의 블라인드가 그 종류로 다시 그려진다
    else if (kind === 'surf') { a = String(key).split(':'); S[a[0]] = +a[1]; sharesDirty = true; render(); return; }
    else if (kind === 'type') { var p = e ? floorAt(e) : null, it = addFur(key, p && p.x, p && p.z); S.sel = { fur: it.id }; buildFurs(); }
    else if (kind === 'size' && key === 'm') { var fm = selItem(); if (fm && fm.m0) { var fm0 = furNow(fm); fm.m = fm.m0; fm.hc = null; settleFur(fm); furGlide(fm, fm0); } }
    else if (kind === 'size') { a = String(key).split(':'); var f = selItem(); if (f) { var f0 = furNow(f); if (f.m) { f.m0 = f.m; f.m = null; } f.si[+a[0]] = +a[1]; if (TYPES[f.type].sizes[+a[0]][+a[1]].h != null) f.hc = null; settleFur(f); furGlide(f, f0); } }
    else if (kind === 'pleat') { C.pleat = key; layout(); }
    else if (kind === 'bat') { C.bat = key; layout(); }
    else if (kind === 'cwm' || kind === 'chm') {      // 266번(결정 #414): 커튼 가로 [벽에서 벽 · 창 기준 · 직접] · 기장 [바닥까지 · 창 아래] — 바뀐 크기는 손으로 바꾼 것처럼 견적에 들어간다
      var s1 = sizeNow(), cb1 = CB(), zz = szOf(cb1.key);
      if (kind === 'cwm') {      // 직접: 지금 크기 그대로에서 시작 · 창 기준: 앞서 고친 여유가 있으면 그것(양쪽 다 벽 끝이면 25 cm씩)
        if (key === 'free') { zz.w = cb1.cw; zz.cx = cb1.cx; }
        if (key === 'win' && cb1.mode !== 'win' && zz.ml != null && zz.mr != null && zz.ml >= cb1.mlMax - 0.0005 && zz.mr >= cb1.mrMax - 0.0005) zz.ml = zz.mr = 0.25;
        zz.mode = key; zz.full = key === 'wall';
      }
      else {      // 바닥까지: 바닥 위 1 cm로(이미 바닥까지면 그대로) · 창 아래: 앞서 고친 길이(처음 20 cm)
        if (key === 'floor' && !(cb1.hem === 'floor' && cb1.gap < 0.1)) zz.gap = 0.01;
        zz.hem = key; zz.bot = null; if (key === 'win' && S.view === 'hem') setView('eye');      // 밑단 가까이 보기 줄이 '창 아래' 줄로 바뀌므로 눈높이로
      }
      track(s1); layout();
    }
    else if (kind === 'join') { C.join = key === 'y'; S.csel = 0; layout(); }
    else if (kind === 'layer') {      // 장 머리의 걸린 것 — 안 걸린 것을 누르면 걸리고, 걸린 것을 누르면 그것을 고른다. 블라인드와 커튼은 서로 바꿔 걸린다(고른 원단은 남는다 — 결정 #395)
      var kn = kindNow(), hasD = kn === 'double' || kn === 'drape', hasS = kn === 'double' || kn === 'sheer';
      if (key === 'blind') { if (kn !== 'blind') A.kind = 'blind'; S.part = 'drape'; }
      else if (key === 'drape') { if (!hasD) A.kind = hasS ? 'double' : 'drape'; S.part = 'drape'; }
      else { if (!hasS) A.kind = hasD ? 'double' : 'sheer'; S.part = 'sheer'; S.cmp = C.sf == null; S.night = false; }      // 속커튼은 낮에 본다 — 밤은 겉커튼의 몫(사장님 원칙)
    }
    sharesDirty = true; render();
  }
  function gripMove(e) {
    var id = drag.id, p, b, CM = 0.01, s0 = id === 'ct' || id === 'cb' || id === 'cs' || id === 'cr' ? sizeNow() : null;      // 크기는 1 cm 단위로 — 실제로는 1 cm가 큰 차이를 만든다 · 258번: s0 — 손으로 바꾼 크기를 세려고
    if (id === 'fh') {      // 가구 높이는 자유롭게 — 가구를 지나는 세로 면 위에서 손가락 높이를 읽는다
      var fit = selItem(); if (!fit) return;
      var fn = new THREE.Vector3(cam.position.x - fit.x, 0, cam.position.z - fit.z).normalize();
      p = planeAt(e, fn, -(fn.x * fit.x + fn.z * fit.z)); if (!p) return;
      fit.hc = clamp(snap(p.y, CM), 0.2, R.H - 0.05);
    } else if (id === 'bx') {      // 커튼박스를 벽을 따라 옆으로 — 벽 끝 · 창 가장자리 · 창 가운데에 붙는다. 커튼 · 박스 안 블라인드가 따라온다
      var bwl = boxWall(), bb0 = BOXES[bwl], sg0 = boxSeg(bwl), Lb = wlen(bwl), nb = sg0.b - sg0.a; p = wallHit(e, bwl, bb0.d); if (!p) return;
      if (drag.bo == null) { drag.bo = p.x - (sg0.a + sg0.b) / 2; drag.ride = []; WINS.forEach(function (w, j) { if (w.wall === bwl && w.x - w.w / 2 >= sg0.a - 0.005 && w.x + w.w / 2 <= sg0.b + 0.005) drag.ride.push([j, w.x - sg0.a]); }); }      // 박스 밑의 창은 박스와 함께 옮겨진다(창은 늘 박스 밑에 있다) — 박스 안에서 창 자리는 창을 끌어 맞춘다
      var cx0 = p.x - drag.bo, marks = [-Lb / 2 + nb / 2, Lb / 2 - nb / 2];      // 벽 끝 · 따라오지 않는 창의 가장자리에 붙는다
      WINS.forEach(function (w, j) { if (w.wall === bwl && !drag.ride.some(function (r) { return r[0] === j; })) marks.push(w.x - w.w / 2 + nb / 2, w.x + w.w / 2 - nb / 2); });
      var best = cx0, dm = 0.05; marks.forEach(function (m) { if (Math.abs(cx0 - m) < dm) { dm = Math.abs(cx0 - m); best = m; } });
      bb0.at = clamp(snap(best - nb / 2, CM), -Lb / 2, Lb / 2 - nb);
      drag.ride.forEach(function (r) { WINS[r[0]].x = snap(bb0.at + r[1], 0.001); });
    } else if (id === 'rw' || id === 'rd') {
      p = floorAt(e); if (!p) return;
      if (id === 'rw') R.W = clamp(snap(2 * Math.abs(p.x) - R.T, CM), 1.5, RMAX[0]); else R.D = clamp(snap(2 * Math.abs(p.z) - R.T, CM), 1.0, RMAX[1]);
    } else if (id.charAt(0) === 'w') {      // 고른 창 — 가운데를 두고 양쪽으로 넓어진다
      var sw = WINS[S.wsel] || WINS[0]; p = wallHit(e, sw.wall, 0); if (!p) return;
      if (id === 'wl' || id === 'wr') sw.w = clamp(snap(2 * Math.abs(p.x - sw.x), CM), WMIN, wlen(sw.wall) - 0.3);
      else if (id === 'wt') sw.top = clamp(snap(p.y, CM), sw.sill + WMIN, R.H - 0.03);
      else sw.sill = clamp(snap(p.y, CM), 0, sw.top - WMIN);
    } else if (kindNow() === 'blind') {
      b = BB(); p = wallHit(e, b.wall, b.zo); if (!p) return;
      if (id === 'co') C.open = clamp(1 - (b.top - p.y - b.minH) / (b.full - b.minH), 0, 1);      // 블라인드는 아랫단을 잡고 올리고 내린다
      else if (id === 'cs') blOf(b.j).w = magnet(clamp(snap(2 * (b.wx - p.x), CM), b.minW, b.maxW), [b.recW]);      // 옆을 잡고 가로를 — 창 가운데에서 양옆으로
      else return;
    } else {      // 고른 커튼 한 벌 — 다는 높이 · 아랫단 · 가로를 1 cm 단위로. 손댄 값은 창이 바뀌어도 남는다
      b = CB(); p = wallHit(e, b.wall, b.zd); if (!p) return;
      var z = szOf(b.key);
      if (id === 'ct') z.top = magnet(clamp(snap(p.y + 0.03, CM), Math.min(R.H, b.utop + 0.05), R.H), [b.ceilY, b.frameY]);      // 천장 … 창틀 위
      else if (id === 'cb') {      // 바닥 … 창 아래 — 266번: 바닥에서 10 cm 안이면 '바닥까지', 그 위는 '창 아래 ○ cm'(바닥까지 오는 창은 늘 '바닥까지')
        var yb = magnet(clamp(snap(p.y, CM), 0, b.botMax), b.usill >= 0.4 ? [b.floorY, b.sillY] : [b.floorY]); z.bot = null;
        if (b.sillOK && yb >= 0.1) { z.hem = 'win'; z.below = b.usill - yb; } else { z.hem = 'floor'; z.gap = yb; }
      }
      else if ((id === 'cs' || id === 'cr') && b.mode !== 'free') {      // 266번: 벽에서 벽 · 창 기준 — 잡은 쪽 끝만 움직이고 '창 기준'이 된다(양쪽 다 벽 끝이면 '벽에서 벽'). 25 cm · 벽 끝에 붙는다
        var lft = id === 'cs', mx = lft ? b.mlMax : b.mrMax, mv = magnet(clamp(snap(lft ? b.ua - p.x : p.x - b.ub, CM), 0, mx), [0.25, mx]);
        z.ml = lft ? mv : b.ml; z.mr = lft ? b.mr : mv;
        z.mode = z.ml >= b.mlMax - 0.0005 && z.mr >= b.mrMax - 0.0005 ? 'wall' : 'win';
      }
      else if (id === 'cs' || id === 'cr') {      // '직접' — 가운데를 두고 양옆으로. 한쪽이 벽에 닿아 있으면 잡은 쪽만 늘어난다(266번: 오른쪽 끝도 같게)
        var c0 = z.cx == null ? b.ucx : z.cx, lf = id === 'cs', far = lf ? p.x <= b.lo + 0.03 : p.x >= b.hi - 0.03, hx = lf ? c0 - p.x : p.x - c0;
        var w2 = far ? b.maxW : hx <= (lf ? b.hi - c0 : c0 - b.lo) ? 2 * hx : lf ? b.hi - p.x : p.x - b.lo;
        w2 = magnet(clamp(snap(w2, CM), b.minW, b.maxW), [b.recW, b.maxW]); z.w = w2; z.full = w2 >= b.maxW - 0.0005;      // 벽 끝까지 가도 '직접' 그대로
      }
      else if (kindNow() === 'sheer' || S.part === 'sheer') C.sopen = 1 - (clamp(b.cx + b.cw / 2 - p.x, b.smin, b.cw / 2) - b.smin) / Math.max(0.001, b.cw / 2 - b.smin);      // 19판: 속지를 고르는 동안에는 속지를 걷고 친다 — 값은 겉지와 따로 남는다
      else C.open = 1 - (clamp(b.cx + b.cw / 2 - p.x, b.dmin, b.cw / 2) - b.dmin) / (b.cw / 2 - b.dmin);
    }
    if (s0) track(s0);
    layout(); render(false);
  }

  var NUDGE = null;
  function nudge(k, d) {
    var b, z, v, s0 = sizeNow();
    if (kindNow() === 'blind') { b = BB(); z = blOf(b.j); if (k === 'w') z.w = clamp(Math.round((b.w + d * 0.01) * 100) / 100, b.minW, b.maxW); else z.bot = clamp(Math.round((b.bot - d * 0.01) * 100) / 100, 0, b.botMax); }
    else {
      b = CB(); z = szOf(b.key);
      if (k === 'w') { v = clamp(Math.round((b.cw + d * 0.01) * 100) / 100, b.minW, b.maxW); z.w = v; z.cx = b.cx; z.mode = 'free'; z.full = v >= b.maxW - 0.0005; }      // 266번: 가로 숫자를 바꾸면 '직접'(가운데는 그대로)
      else if (k === 'ml' || k === 'mr') { z.mode = 'win'; z.ml = b.ml; z.mr = b.mr; z[k] = clamp(Math.round((b[k] + d * 0.01) * 100) / 100, 0, k === 'ml' ? b.mlMax : b.mrMax); }      // 266번: 창 기준 — 그쪽 여유만
      else if (k === 'bw' || (k === 'h' && b.hem === 'win')) { z.hem = 'win'; z.bot = null; z.below = clamp(Math.round((b.below + d * 0.01) * 100) / 100, 0, b.usill); }      // 266번: 창 아래 ○ cm — 높이 단추도 창 아래 길이를 바꾼다
      else { z.hem = 'floor'; z.bot = null; z.gap = clamp(Math.round((b.botY - d * 0.01) * 100) / 100, 0, b.botMax); }      // 높이는 아랫단이 움직인다(다는 높이는 방에서 위 손잡이로) — 266번: 바닥까지면 바닥에서 뜬 거리      // 세로는 아랫단이 움직인다(다는 높이는 방에서 위 손잡이로)
    }
    track(s0); layout(); sharesDirty = true; render(false);
  }
  function nudgeStop() { if (!NUDGE) return; clearTimeout(NUDGE.t); NUDGE = null; traySig = ''; paintUI(); }
  function nudgeStart(k, d) {
    nudgeStop(); keep(); NUDGE = { t: 0 }; nudge(k, d);
    NUDGE.t = setTimeout(function again() { if (!NUDGE) return; nudge(k, d); NUDGE.t = setTimeout(again, 70); }, 420);
  }
  var drag = null, ghost = null, DRAGS = { surf: 1, type: 1, cand: 1, fab: 1 };      // 끌어다 놓을 수 있는 칩
  function endDrag() {
    if (ghost) { ghost.remove(); ghost = null; }
    stage.classList.remove('aim');
    if (drag && drag.chip) drag.chip.classList.remove('lifted');
    canvas.style.cursor = '';
    drag = null;
  }
  on('pointerdown', function (e) {
    if (drag) return;
    var chip = e.target.closest('[data-chip]'), grip = e.target.closest('[data-grip]'), ng = e.target.closest('[data-nudge]');
    if (ng) { e.preventDefault(); nudgeStart(ng.dataset.nudge, +ng.dataset.d); return; }
    if (chip && chip.dataset.chip !== 'none') {
      drag = { type: 'chip', kind: chip.dataset.chip, key: chip.dataset.key, hex: chip.dataset.hex, sx: e.clientX, sy: e.clientY, moved: false, chip: chip, pid: e.pointerId };
      try { chip.setPointerCapture(e.pointerId); } catch (err) {}
    } else if (grip) {
      e.preventDefault(); glideStop(); keep(); drag = { type: 'grip', id: grip.dataset.grip, pid: e.pointerId };
      try { grip.setPointerCapture(e.pointerId); } catch (err) {}
    } else if (e.target === canvas && GUEST) {      // 260번: 손님용은 둘러보기만(창 · 가구를 옮기지 않음)
      e.preventDefault(); drag = { type: 'look', hit: null, sx: e.clientX, sy: e.clientY, moved: false, az0: V.az, el0: V.el, yaw0: V.yaw, hy0: V.hy, pid: e.pointerId };
      canvas.style.cursor = 'grabbing'; try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    } else if (e.target === canvas) {
      e.preventDefault();
      var th = thingAt(e), it = th && th.fur != null ? itemOf(th.fur) : null, p = it && floorAt(e), wj = th && th.win != null ? th.win : -1, wh = wj >= 0 && S.step === 'measure' ? wallHit(e, WINS[wj].wall, 0) : null;
      if (it && p) drag = { type: 'fur', it: it, sx: e.clientX, sy: e.clientY, moved: false, ox: it.x - p.x, oz: it.z - p.z, pid: e.pointerId };
      else if (wh) drag = { type: 'win', j: wj, sx: e.clientX, sy: e.clientY, moved: false, ox: wh.x - WINS[wj].x, pid: e.pointerId };      // 창을 집었다
      else drag = { type: 'look', hit: th, sx: e.clientX, sy: e.clientY, moved: false, az0: V.az, el0: V.el, yaw0: V.yaw, hy0: V.hy, pid: e.pointerId };
      canvas.style.cursor = 'grabbing';
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  on('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pid) return;
    if (drag.type === 'grip') { gripMove(e); return; }
    var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy, p;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      if (drag.type === 'chip') {
        if (!DRAGS[drag.kind]) return;
        ghost = document.createElement('i'); ghost.className = 'ghost'; ghost.style.background = drag.hex;
        root.appendChild(ghost); drag.chip.classList.add('lifted'); stage.classList.add('aim');
      } else if (drag.type === 'fur') { keep(); if (S.step === 'measure' && (!S.sel || S.sel.fur !== drag.it.id)) { S.sel = { fur: drag.it.id }; paintUI(); } }
      else if (drag.type === 'win') { glideStop(); keep(); S.wsel = drag.j; }
    }
    if (drag.type === 'chip') { if (ghost) ghost.style.transform = 'translate(' + (e.clientX - 28) + 'px,' + (e.clientY - 28) + 'px)'; }
    else if (drag.type === 'look') {
      if (V.h > 0.5) V.hy = clamp(drag.hy0 - dx * 0.004, -1.15, 1.15);
      else if (V.t < 0.5) { V.az = drag.az0 - dx * 0.006; V.el = clamp(drag.el0 + dy * 0.004, 0.28, 1.3); }
      else V.yaw = clamp(drag.yaw0 + dx * 0.0018, -0.35, 0.35);
      invalidate();
    } else if (drag.type === 'win') winMove(e);
    else {
      p = floorAt(e); if (!p) return;
      var it = drag.it, x = p.x + drag.ox, z = p.z + drag.oz;
      it.ghost = Math.max(Math.abs(x) - R.W / 2, Math.abs(z) - R.D / 2) > 0.5;      // 방 밖으로 끌려 나가는 중
      if (it.ghost) { it.gx = x; it.gz = z; buildFurs(); invalidate(); }
      else { it.gx = it.gz = null; it.x = x; it.z = z; settleFur(it); buildFurs(); sharesDirty = true; render(false); }
    }
  });
  on('pointerup', function (e) {
    nudgeStop();
    if (!drag || e.pointerId !== drag.pid) return;
    var d = drag; endDrag();
    if (d.type === 'chip') {
      if (!d.moved) place(d.kind, d.key, null);                                                   // 눌러 놓기
      else if (DRAGS[d.kind] && overStage(e.clientX, e.clientY)) place(d.kind, d.key, e);         // 끌어다 놓기
    } else if (d.type === 'fur') {
      if (!d.moved) {
        var T = TYPES[d.it.type], again = S.step === 'measure' && S.sel && S.sel.fur === d.it.id;
        if (again && T.sizes && !d.it.m) { keep(); var g0 = furNow(d.it); d.it.si[0] = (d.it.si[0] + 1) % T.sizes[0].length; if (T.sizes[0][d.it.si[0]].h != null) d.it.hc = null; settleFur(d.it); furGlide(d.it, g0); sharesDirty = true; render(); }      // 고른 가구를 다시 누르면 다음 규격
        else { if (S.step !== 'measure') { S.step = 'measure'; S.q = A.fur ? null : firstOpen('measure'); } S.sel = { fur: d.it.id }; buildFurs(); sharesDirty = true; render(); }      // 눌러서 고르기
      }
      else if (d.it.ghost) { S.items.splice(S.items.indexOf(d.it), 1); S.sel = null; buildFurs(); sharesDirty = true; render(); }      // 방 밖으로 끌어내면 빼기
      else { sharesDirty = true; render(); }
    } else if (d.type === 'win') {      // 눌러서 고르기(그 창의 손잡이와 숫자) · 끌어서 옮기기
      if (!d.moved) {
        if (S.wsel === d.j && S.q === 'win' && NUM.key === 'win' && NUM.i < 0) {      // 고른 창을 다시 누르면 창짝 수가 바뀐다(1 → 2 → 3 → 4) — 가구를 다시 누르면 규격이 바뀌는 것과 같이
          keep(); var cw2 = WINS[d.j], ri = NUM.map.indexOf(d.j); cw2.n = sashN(cw2) % 4 + 1; if (ri >= 0) NUM.ns[ri] = cw2.n; layout();
        } else { S.wsel = d.j; if (A.win) S.q = 'win'; }
      }
      sharesDirty = true; render();
    } else if (d.type === 'look') {
      var zoomed = S.step === 'cur' && S.view === 'eye' && roomReady() && !!kindNow();      // 고르기에서는 고르는 벌 앞에 다가가 있다 — 옆으로 밀면 옆 벌(옆 블라인드)로
      if (d.moved && zoomed && kindNow() === 'blind' && Math.abs(e.clientX - d.sx) > 60 && WINS.length > 1) {
        var odb = { 3: 0, 0: 1, 1: 2, 2: 3 }, ob = WINS.map(function (w, j) { return { j: j, k: odb[w.wall] * 100 + w.x }; }).sort(function (p, q) { return p.k - q.k; }).map(function (o) { return o.j; });
        var ab = ob.indexOf(S.wsel < WINS.length ? S.wsel : 0);
        S.wsel = ob[clamp(ab + (e.clientX < d.sx ? 1 : -1), 0, ob.length - 1)]; V.yaw = 0; render(); return;
      }
      if (d.moved && zoomed && kindNow() !== 'blind' && Math.abs(e.clientX - d.sx) > 60 && groups().length > 1) {      // 속커튼을 볼 때 옆으로 밀면 옆 벌로 — 넓은 거실처럼 벌이 여럿이면 다가간 벌 밖은 화면에 없다
        var od = { 3: 0, 0: 1, 1: 2, 2: 3 }, ord = groups().map(function (g, i) { return { i: i, k: od[g.wall] * 100 + CB(g).cx }; }).sort(function (p, q) { return p.k - q.k; }).map(function (o) { return o.i; });
        var at = ord.indexOf(S.csel < ord.length ? S.csel : 0), to = clamp(at + (e.clientX < d.sx ? 1 : -1), 0, ord.length - 1);
        if (to !== at) { S.csel = ord[to]; S.wsel = groups()[S.csel].js[0]; if (C.sl != null) S.cmp = true; }
        V.yaw = 0; render(); return;
      }
      if (!d.moved) {
        var hh = d.hit;
        if (hh && hh.cur != null && cmpOn()) {      // 속커튼을 볼 때: 누른 벌 · 누른 창에서 네 폭을 견준다(다른 창을 누르면 그리로 옮겨 간다)
          S.csel = hh.cur; var grp = groups()[hh.cur], hp2 = grp ? wallHit(e, grp.wall, CB(grp).zs) : null;
          if (hp2) grp.js.forEach(function (j) { var w = WINS[j]; if (hp2.x >= w.x - w.w / 2 - 0.02 && hp2.x <= w.x + w.w / 2 + 0.02) S.wsel = j; });
          if (C.sl != null) S.cmp = true;
          render();
        }
        else if (hh && (hh.cur != null || hh.bl != null)) { if (hh.cur != null) S.csel = hh.cur; else S.wsel = hh.bl; if (S.step === 'cur') render(); else if (canStep('cur')) goStep('cur'); else { paintUI(); invalidate(); } }
        else if (hh && hh.win != null) { S.wsel = hh.win; goStep('measure', false, A.win ? 'win' : null); }
        else select(null);      // 누른 것의 순서로 · 빈 곳을 누르면 풀린다
      }
    } else if (d.type === 'grip') { refit(); sharesDirty = true; render(); }
  });
  on('pointercancel', function (e) { nudgeStop(); if (drag && e.pointerId === drag.pid) { var d = drag; endDrag(); if (d.type === 'fur') { d.it.ghost = false; d.it.gx = d.it.gz = null; buildFurs(); } render(); } });
  on('click', function (e) {
    if (!ALIVE) return;
    if (GUEST) { var gt = e.target.closest('[data-g], [data-gk]'); if (gt) guestTap(gt); return; }      // 260번: 손님용
    var t = e.target, kn = t.closest('[data-nudge]'), v = t.closest('[data-view]'), st = t.closest('.steps [data-step]'), pk = t.closest('[data-pok]'), op = t.closest('[data-opt]'), ky = t.closest('[data-key]'), fl = t.closest('[data-fld]'), rc = t.closest('[data-rec]'), gf = t.closest('[data-gofab]');
    if (gf) { finish(true, gf.dataset.gofab); return; }      // 258번: 원단 바꾸기 — 고친 것은 품목에 넣고 닫은 뒤, 앱이 그 겹의 원단 고르기로
    if (kn) { if (e.detail === 0) { keep(); nudge(kn.dataset.nudge, +kn.dataset.d); } return; }      // 자판으로 누른 것만 여기서(손가락 · 마우스는 누르는 순간에)
    if (v) { if (v.dataset.view !== S.view) setView(v.dataset.view); else if (S.view === 'hem') setView('eye'); return; }      // 밑단 줄을 한 번 더 누르면 눈높이로 돌아온다
    if (st) { goStep(st.dataset.step, true); return; }
    if (op) { pickOpt(op.dataset.opt, op.dataset.val); return; }
    if (ky) { keyPress(ky.dataset.key); return; }
    if (fl) { NUM.i = +fl.dataset.fld; NUM.buf = ''; if (NUM.key === 'win') { S.wsel = Math.min(WINS.length - 1, Math.floor(NUM.i / 3)); invalidate(); } else if (NUM.key === 'box') { for (var wi = 0; wi < WINS.length; wi++) if (WINS[wi].wall === NUM.walls[Math.floor(NUM.i / 3)]) { S.wsel = wi; invalidate(); break; } } paintPanel(); return; }
    if (t.closest('#r3d-winadd')) { var en = NUM.ent, nn = en.length; en.push(Math.min(en[nn - 3], 1.2), en[nn - 2], en[nn - 1]); NUM.map.push(null); NUM.ns.push(null); paintPanel(); return; }      // 창 한 장 더 — 앞 창의 세로 · 바닥에서를 물려받는다
    var wrm = t.closest('[data-winrm]'); if (wrm) { NUM.ent.splice(+wrm.dataset.winrm * 3, 3); NUM.map.splice(+wrm.dataset.winrm, 1); NUM.ns.splice(+wrm.dataset.winrm, 1); paintPanel(); return; }
    if (rc) { var k = rc.dataset.rec; if (stepOf(k) !== S.step) goStep(stepOf(k), true, k); else { S.q = k; render(); } return; }      // 들은 말을 누르면 그 물음이 다시 열린다
    if (t.closest('#r3d-pnext')) { panelNext(); return; }
    if (t.closest('#r3d-back')) { goBack(); return; }      // 258번: 뒤로 — 측정에서 누르면 닫힌다(고친 것은 남는다)
    if (t.closest('#r3d-next')) { curNext(); return; }
    if (t.closest('#r3d-kindbtn')) { S.kopen = !S.kopen; paintUI(); return; }      // 구성 바꾸기 — 네 구성이 펼쳐진다(다시 누르면 접힌다)
    if (pk) { keep(); var cb0 = CB(); szOf(cb0.key).pok = clamp(cb0.pok + (+pk.dataset.pok), cb0.minPok, POKMAX); layout(); sharesDirty = true; render(); return; }
    if (t.closest('#r3d-undo')) { undo(); return; }
    if (t.closest('#r3d-furs')) { S.hideFur = !S.hideFur; buildFurs(); paintUI(); invalidate(); return; }
    var ngt = t.closest('[data-night]'); if (ngt) { var wantN = ngt.dataset.night === '1'; if (S.night !== wantN) { S.night = wantN; render(); } return; }
    if (t.closest('#r3d-remove')) { var it = selItem(); if (it) { keep(); S.items.splice(S.items.indexOf(it), 1); S.sel = null; buildFurs(); sharesDirty = true; render(); } }
  });
  function onKey(e) {      // 자판으로도 숫자를 적는다 — 숫자판이 열려 있을 때만(앱의 다른 자판은 건드리지 않는다)
    if (!ALIVE || !NUM.key) return;
    if (NUM.i < 0) { if (e.key === 'Enter') { e.preventDefault(); panelNext(); } return; }
    if (/^[0-9]$/.test(e.key)) keyPress(e.key); else if (e.key === 'Backspace') keyPress('del'); else if (e.key === 'Enter') { e.preventDefault(); keyPress('go'); }
  }
  // ───── 258번: 앱과 잇는 곳 — 손으로 바꾼 크기 세기 · 뒤로 · 끝내기 · 열고 닫기 ─────
  function sizeNow() { var bl = kindNow() === 'blind', b = bl ? BB() : CB(); return { k: bl ? 'blind' : 'cur', w: cm(bl ? b.w : b.cw), h: cm(b.len) }; }
  function track(a) {      // 손잡이 · 1 cm 단추로 바꾼 만큼만 센다(창 크기를 고쳐서 저절로 바뀐 것은 세지 않는다)
    if (CURI && a.k === 'cur') CURI.hand = true;      // 266번: 커튼 크기를 손댄 뒤로는 품목 크기로 다시 맞추지 않는다(단추 · 1 cm · 손잡이 모두 여기를 지남)
    var b = sizeNow(), d; if (a.k !== b.k || (a.w === b.w && a.h === b.h) || !isFinite(a.w) || !isFinite(a.h) || !isFinite(b.w) || !isFinite(b.h)) return;      // 262번: 숫자가 깨진 값은 견적 차이에 안 넣는다
    d = DELTA[a.k] || (DELTA[a.k] = { w: 0, h: 0 }); d.w += b.w - a.w; d.h += b.h - a.h;
  }
  function goBack() {
    if (GUEST) { guestEnd({ ok: false }); return; }      // 260번      // 앱의 ← · 머리의 '뒤로' — 끌던 것 → 펼친 것 → 숫자 칸 → 밑단 보기 → 속지 → 겉지 → 측정 → 닫기(고친 것은 room3d에 남는다)
    if (!ALIVE) return;
    if (drag) { var d0 = drag; endDrag(); if (d0.type === 'fur') { d0.it.ghost = false; d0.it.gx = d0.it.gz = null; buildFurs(); } render(); return; }
    if (S.kopen) { S.kopen = false; paintUI(); return; }
    if (NUM.key && NUM.i >= 0 && !NUM.seq) { NUM.i = -1; NUM.buf = ''; paintPanel(); return; }
    if (S.view === 'hem') { setView('eye'); return; }
    if (S.step === 'cur' && S.part === 'sheer' && kindNow() === 'double') { keep(); S.part = 'drape'; render(); return; }
    if (S.step === 'cur') { goStep('measure', true); return; }
    finish(false);
  }
  function sizesOut() {      // 돌려주는 크기(cm) — 공간 · 창 · 커튼박스. 앱 품목에는 쓰지 않는다(room3d에만)
    return { room: { w: cm(R.W), d: cm(R.D), h: cm(R.H) },
      wins: WINS.map(function (w) { return { w: cm(w.w), h: cm(w.top - w.sill), sill: cm(w.sill), wall: w.wall, x: cm(w.x), n: sashN(w) }; }),
      box: wallsUsed().map(function (i) { var b = BOXES[i]; return b.on ? { wall: i, top: cm(R.H + b.h), d: cm(b.d), len: b.len == null ? null : cm(b.len) } : { wall: i, on: false }; }) };
  }
  function layersOut() {      // 앱 품목에 쓸 것 — dw · dh: 손으로 바꾼 가로 · 세로(cm 차이). 커튼은 한 벌(창 묶음 하나)일 때만, 블라인드는 창 하나일 때만 — 여럿이면 어느 품목의 크기인지 정할 수 없어 0
    var k = kindNow(), out = {}, z = { w: 0, h: 0 }, cur = groups().length === 1 ? DELTA.cur || z : z, bd = WINS.length === 1 ? DELTA.blind || z : z;
    if (k === 'double' || k === 'drape') out.drape = { dw: cur.w, dh: cur.h };
    if (k === 'double' || k === 'sheer') out.sheer = { dw: cur.w, dh: cur.h, leadBand: !!C.lead };      // 속지 밑단 — 리드밴드(앱 139번과 같은 뜻). 겉지 리드밴드(C.dlead)는 room3d에만
    if (k === 'blind') out.blind = { dw: bd.w, dh: bd.h };
    return out;
  }
  // ───── 260번: 손님용 — 고를 때 본 후보만 바꿔 걸어 보기(겉지 세 자리 · 속지 네 폭). 크기 · 모양은 손대지 않는다 ─────
  function gFab(c) { return { name: c.name || '', hex: hexOk(c.hex), density: c.density || null, blindKind: null, band: null }; }
  function guestSetup(G) {
    GUEST = { d: G.drape ? G.drape.list : [], s: G.sheer ? G.sheer.list : [], di: G.drape ? G.drape.at : -1, si: G.sheer ? G.sheer.at : -1, last: null, still: !!G.still };
    GUEST.d0 = GUEST.di; GUEST.s0 = GUEST.si; GUEST.last = GUEST.d.length ? 'drape' : GUEST.s.length ? 'sheer' : kindNow() === 'sheer' ? 'sheer' : kindNow() === 'blind' ? 'blind' : 'drape';      // 273번: 블라인드 공간은 블라인드
    if (GUEST.d[GUEST.di]) LAYER.drape = gFab(GUEST.d[GUEST.di]);
    if (GUEST.s[GUEST.si]) { LAYER.sheer = gFab(GUEST.s[GUEST.si]); if (LVD[LAYER.sheer.density] != null) C.sl = LVD[LAYER.sheer.density]; }
    S.step = 'cur'; S.q = null; S.sel = null; S.view = 'eye'; V.t = 1; S.night = false; S.hideFur = false;
    S.part = kindNow() === 'sheer' ? 'sheer' : 'drape';
    if (S.wall == null) S.wall = 0; if (S.floor == null) S.floor = 0;      // 색을 못 잰 공간도 그림은 나오게(견본 첫 색)
    RISE.k = 1; GLS.k = 1;      // 측정에서 아직 확인하지 않은 크기도 선 방으로 보여 준다(기록 A는 그대로 — 사장님 쪽 입체 방에서는 지금처럼 확인)
    C.open = G.open != null ? clamp(+G.open, 0, 1) : 0.7; C.sopen = 0;      // 마무리 그림과 같은 걷힘
    groups().forEach(function (g) { var z = szOf(gkey(g)); if (G.fit) z.pok = Math.min(POKMAX, (z.pok != null ? z.pok : CB(g).pok) + 1); });      // 리담 핏 = 한 폭 더(입체 방에서 정해 둔 폭 수가 있으면 그것에서)
  }
  function paintGuest() {
    if (!GUEST) return;
    [].forEach.call(root.querySelectorAll('.gtop [data-g]'), function (el) { var k = el.dataset.g; el.classList.toggle('on', k === 'night' ? !!S.night : k === 'day' ? !S.night : k === 'open' ? C.open > 0.5 : k === 'close' ? C.open <= 0.5 : false); });
    var band = $('gband'); if (!band || GUEST.still) return;
    function row(kind, k, list, at, at0) {
      if (!list.length) return '';
      return '<span class="k">' + k + '</span><div class="gc">' + list.map(function (c, i) {
        var pic = kind === 'sheer' ? lvIcon(LVD[c.density] != null ? LVD[c.density] : 1) : '';
        return '<button type="button" class="' + (i === at ? 'on' : '') + (i === at0 ? ' was' : '') + '" data-gk="' + kind + '" data-gi="' + i + '" aria-label="' + esc(c.name) + '"' + (kind === 'drape' ? ' style="background:' + (hexOk(c.hex) || '#ddd') + '"' : '') + '>' + pic + '</button>';
      }).join('') + '</div>';
    }
    var last = GUEST.last === 'blind' ? (LAYER.blind && LAYER.blind.name ? LAYER.blind : null) : GUEST.last === 'sheer' ? GUEST.s[GUEST.si] : GUEST.d[GUEST.di], lk = GUEST.last === 'blind' ? '블라인드' : GUEST.last === 'sheer' ? '속커튼' : '겉커튼';      // 273번: 블라인드는 고른 블라인드 이름(후보 줄은 없음)
    var h = '<div class="grows">' + row('drape', '겉커튼', GUEST.d, GUEST.di, GUEST.d0) + row('sheer', '속커튼', GUEST.s, GUEST.si, GUEST.s0) + '</div>'
      + '<div class="gwhy">' + (last ? '<h3>' + lk + ' · ' + esc(last.name) + '</h3>' + (last.why ? '<p>' + esc(last.why) + '</p>' : '') : '')
      + '<button type="button" class="gfab" data-g="fabric"><span>다른 원단은 원단 고르기에서 →</span></button></div>'
      + '<button type="button" class="gok" data-g="ok"><span>이걸로 할게요</span></button>';
    if (band.innerHTML !== h) band.innerHTML = h;
  }
  function guestEnd(r) { var cb = ONFIN; ONFIN = null; if (cb) cb({ done: false, guest: r }); }      // 손님용은 입체 방 기록(room3d)을 고치지 않는다
  function guestTap(el) {
    var g = el.dataset.g, a, id;
    if (el.dataset.gk) {
      var kind = el.dataset.gk, i = +el.dataset.gi, c = kind === 'sheer' ? GUEST.s[i] : GUEST.d[i]; if (!c) return;
      GUEST.last = kind;
      if (kind === 'drape') { GUEST.di = i; LAYER.drape = gFab(c); if (kindNow() === 'double') S.part = 'drape'; }
      else { GUEST.si = i; LAYER.sheer = gFab(c); if (LVD[c.density] != null) C.sl = LVD[c.density]; if (kindNow() === 'double' || kindNow() === 'sheer') { S.part = 'sheer'; S.night = false; } }      // 속지는 낮에 본다(겉지는 양옆으로 걷힌다)
      render(); return;
    }
    if (g === 'back') { guestEnd({ ok: false }); return; }
    if (g === 'ok') { guestEnd({ ok: true, drape: GUEST.di, sheer: GUEST.si }); return; }
    if (g === 'fabric') { guestEnd({ ok: false, goFabric: GUEST.last }); return; }
    if (g === 'day' || g === 'night') { var n = g === 'night'; if (n && S.part === 'sheer') S.part = 'drape'; if (S.night !== n) { S.night = n; render(); } return; }      // 밤은 겉지의 몫
    if (g === 'open' || g === 'close') {
      if (S.part === 'sheer' && kindNow() === 'double') { S.part = 'drape'; render(); }
      restoreOpen(); a = C.open; var b = g === 'open' ? 0.9 : 0; id = ++OPID;
      tween(800, function (k) { if (id === OPID) { C.open = a + (b - a) * k; layout(); } }, function () { paintGuest(); });
      paintGuest(); return;
    }
  }
  function settled() { return ALIVE && !!SCN.tex && !tweens.length && !raf; }      // 멈춘 그림: 창밖 사진을 받았고 움직임이 다 끝났는지
  function snapShot() {      // 그린 그 자리에서 바로 읽는다(그리는 판을 붙잡아 두지 않음) — 비어 있는 곳은 종이색으로 (262번: 1 cm 맞추는 snap과 이름이 겹쳐 손잡이가 NaN이 되던 것)
    frame(performance.now());
    var c = document.createElement('canvas'), g; c.width = canvas.width; c.height = canvas.height; g = c.getContext('2d');
    g.fillStyle = getComputedStyle(root).getPropertyValue('--bg').trim() || '#fbf9f5'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, 0);
    return c.toDataURL('image/jpeg', 0.86);
  }
  function finish(done, go) {      // 끝내기 — done: 완료(앱 품목에 넣음) · 아니면 닫기만(room3d에 남김) · go: 원단 바꾸기로 갈 겹
    if (!ALIVE) return;
    if (GUEST) { guestEnd({ ok: false }); return; }      // 260번: 손님용 — 닫기 · 앱의 ← 는 바꾼 것 안 넣음
    if (NUDGE) { clearTimeout(NUDGE.t); NUDGE = null; } if (drag) endDrag(); restoreOpen();
    var o = JSON.parse(pack(true)), res;
    o.v = 1; o.sig = SIG; o.msig = MSIG; o.seed = SEED; o.wallHex = surfHex('wall'); o.floorHex = surfHex('floor');
    if (done) o.DELTA = {};      // 완료하면 바꾼 크기를 품목에 넣었으니 다음에는 0부터
    res = { done: !!done, pack: o };
    if (done) { res.sizes = sizesOut(); res.layers = layersOut(); res.view = S.view; }
    if (go) res.goFabric = go;
    var cb = ONFIN; ONFIN = null; if (cb) cb(res);
  }
  function builtEnd() {      // 263번: 짓기를 마침 — 선택으로 가지 않고 닫으며 지은 값을 돌려준다(앱이 폰 실측과 같은 꼴로 바꿔 공간을 만든다). 지은 방은 pack으로(공간의 room3d)
    if (!ALIVE) return;
    if (NUDGE) { clearTimeout(NUDGE.t); NUDGE = null; } if (drag) endDrag(); restoreOpen();
    var o = JSON.parse(pack(true)), z = sizesOut();
    o.v = 1; o.sig = SIG; o.msig = MSIG; o.seed = SEED; o.wallHex = surfHex('wall'); o.floorHex = surfHex('floor'); o.DELTA = {}; o.step = 'measure'; o.q = null;
    var res = { done: false, pack: o, built: { room: z.room, wins: z.wins, box: z.box, dir: (A.dir || []).slice(),
      wall: BLDC && S.wall === 0 ? surfHex('wall') : null, floor: BLDC && S.floor === 0 ? surfHex('floor') : null } };      // 색은 폰에서 잰 색을 확인한 것만(견본으로 바꾼 것은 잰 색이 아니라 넣지 않음)
    if (ENDV) { try { res.snap = snapShot(); } catch (err) { res.snap = null; } }      // 267번: 다 지은 눈높이 장면 한 장 — 앱이 그 공간의 질문 화면 뒤에 옅게(concierge.js buildBg)
    var cb = ONFIN; ONFIN = null; if (cb) cb(res);
  }
  function hexIdx(k, hx) { if (!hx) return null; hx = String(hx).toLowerCase(); for (var i = 0; i < SURFS[k].length; i++) if (String(SURFS[k][i].hex).toLowerCase() === hx) return i; return null; }
  function applyInput(I) {      // 새로 지을 때 — 폰에서 잰 값(확인된 것) · 앱의 크기와 기본값(측정에서 확인)
    var list, gs, u, z;
    R.W = I.room[0]; R.D = I.room[1]; R.H = I.room[2];
    var B2 = !!I.build;      // 263번: 공간 추가에서 짓기 — 폰 값도 P(확인 전)로, 측정에서 하나씩 확인하며 짓는다 · 폰 실측이 없는 공간은 깔지 않고 칸마다 적는다(결정 #410-3)
    if (I.roomOk && !B2) A.room = true; else if (!I.blank) P.room = I.room.slice();
    list = I.wins.map(function (r) { return { w: Math.max(WMIN, r[0]), sill: r[2], top: Math.min(R.H - 0.03, r[2] + r[1]), x: null, wall: null, n: r[3] || null }; });
    placeWins(list); WINS.length = 0; list.forEach(function (q) { WINS.push(q); });
    if (I.winsOk && !B2) A.win = true; else if (!I.blank) P.win = I.wins.map(function (r) { return r.slice(); });      // 263번
    if (I.box === 'n') { if (I.roomOk && !B2) A.box = 'n'; else P.box = 'n'; }      // 263번
    else if (I.box) {
      if (I.roomOk && !B2) { wallsUsed().forEach(function (i) { var b = BOXES[i]; b.on = true; b.k = 1; b.h = clamp(I.box.top - R.H, 0.03, 0.4); b.d = clamp(I.box.d, 0.06, 0.4); b.len = I.box.len != null && i === 0 && I.box.len < wlen(i) - 0.005 ? clamp(I.box.len, 0.3, wlen(i)) : null; b.at = null; if (b.len != null) fitUnder(i); }); A.box = 'y'; }
      else { P.box = 'y'; P.boxTop = I.box.top; P.boxD = I.box.d; if (I.box.len != null) P.boxL = I.box.len; }
    }
    if (I.dir && I.dir.length) { if (B2) P.dir = I.dir.slice(); else A.dir = I.dir.slice(); }      // 263번: 짓기에서는 방향도 확인 전 — 확인하면 빛이 든다
    if (I.furs.length && B2) P.furs = I.furs.map(function (f) { return { t: f.t, w: f.w, d: f.d, h: f.h, hex: f.hex, cn: f.cn }; });      // 263번: 짓기에서는 폰에서 잰 가구가 가구 차례에 놓인다
    else if (I.furs.length) { I.furs.forEach(function (f) { addFur(f.t, null, null, f); }); A.fur = true; }
    else if (I.furCols.length) P.furs = I.furCols.slice();
    gs = groups();
    if ((I.curW || I.curH) && gs.length === 1) { seedCur(gs[0], I.curW, I.curH); }      // 앱 품목의 가로가 처음 크기
    if (I.blW && WINS.length === 1) blOf(0).w = I.blW;
  }
  function carry(p) {      // 앱의 크기가 바뀌어 새로 지을 때 — 고른 모양(주름 · 밑단 · 줄 · 등 · 빛 조절 · 다는 곳)과 놓은 가구는 이어 간다
    if (p.C) ['pleat', 'dlead', 'tape', 'lamp', 'slit', 'bat', 'join', 'open', 'sopen'].forEach(function (k) { if (p.C[k] !== undefined) C[k] = p.C[k]; });
    if (p.A && p.A.bkind) A.bkind = p.A.bkind;
    if (!S.items.length && Array.isArray(p.items) && p.items.length) {
      S.items = JSON.parse(JSON.stringify(p.items)).filter(function (it) { return it && TYPES[it.type]; });
      S.seq = S.items.reduce(function (m, it) { return Math.max(m, it.id || 0); }, p.seq || 0);
      S.items.forEach(function (it) { it.wall = null; if (!it.si) it.si = (TYPES[it.type].def || []).slice(); settleFur(it); });
      if (S.items.length) A.fur = true;
    }
  }
  function reseed(was, now, I) {
    var gs, u, z;
    if (was.cw !== now.cw || was.ch !== now.ch) { delete DELTA.cur; C.sz = {}; gs = groups(); if ((I.curW || I.curH) && gs.length === 1) { seedCur(gs[0], I.curW, I.curH); } }
    if (was.bw !== now.bw || was.bh !== now.bh) { delete DELTA.blind; C.bl = {}; if (I.blW && WINS.length === 1) blOf(0).w = I.blW; }
  }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); });      // 폰이 그리는 판을 잠시 거둬 가면 — 돌아올 때 다시 그린다(three.js가 판을 다시 잡는다)
  canvas.addEventListener('webglcontextrestored', function () { if (ALIVE) { resize(); invalidate(); } });
  var RO = window.ResizeObserver ? new ResizeObserver(function () { if (ALIVE) resize(); }) : null;
  function start(I, done) {      // 열기 — 받은 값으로 짓거나(새로) 저장한 입체 방을 되살린다(크기가 같으면)
    SESSION++; ALIVE = true; LIVE = 0; ONFIN = done || null;
    HOST.name = I.name || '공간'; LAYER = I.layers || {}; FIXED = !!I.fixed; BKFIX = !!I.bkFixed; SIG = I.sig || ''; MSIG = I.msig || null; SEED = I.seed || null;
    SURFS.wall = (I.wall ? [I.wall] : []).concat(SAMPLES.wall); SURFS.floor = (I.floor ? [I.floor] : []).concat(SAMPLES.floor);
    tweens.length = 0; glideId++; GT = null; NUDGE = null; drag = null; BEAT = false; clearTimeout(advT);
    unpack(DEF); P = {}; DELTA = {};
    var p = I.pack && I.pack.v === 1 ? I.pack : null, restored = false;
    if (p && p.sig === SIG && (!MSIG || !p.msig || p.msig === MSIG) && p.R && Array.isArray(p.WINS) && p.WINS.length && Array.isArray(p.boxes)) {
      try { unpack(JSON.stringify(p)); restored = true; } catch (err) { unpack(DEF); DELTA = {}; }
    }
    if (!MSIG && p && p.msig) MSIG = p.msig;      // 폰 실측을 지금 못 받아도(인터넷 · 번호) 저장한 것은 그대로 이어 간다
    if (!P) P = {};
    if (!restored) { applyInput(I); if (p) carry(p); }
    else if (p.seed && I.seed) reseed(p.seed, I.seed, I);      // 저장한 뒤 견적에서 품목 크기를 바꿨으면 그 겹만 앱 값으로(나머지는 그대로)
    var szs = restored && p.C && p.C.sz ? p.C.sz : {}, newer = Object.keys(szs).some(function (k) { var q = szs[k]; return !!(q && (q.mode || q.hem)); });      // 266번 뒤에 저장한 방인지(크기 칸에 mode · hem이 있음)
    CURI = I.curW || I.curH ? { w: I.curW, h: I.curH, hand: false, need: !restored || (!newer && !(p.DELTA && p.DELTA.cur)) || !!(p.seed && I.seed && (p.seed.cw !== I.seed.cw || p.seed.ch !== I.seed.ch)) } : null;      // 266번: 새로 짓거나 · 266번 전에 저장한 방(손댄 차이 없음) · 앱에서 품목 크기를 바꿨으면 선택에서 품목 크기로 맞춘다
    // 언제나 앱의 지금 값으로 — 원단 · 잰 색 · 품목 구성 · 속지 비침 · 리드밴드
    A.asked = true; A.type = I.type || A.type; A.gaze = I.gaze || null; A.light = I.light || null;
    if (I.kind && (FIXED || !restored)) A.kind = I.kind;
    if (I.bkind && (BKFIX || !A.bkind)) A.bkind = I.bkind;
    C.sl = I.lv; C.lead = !!I.lead; if (I.pleat === 'nabi') C.pleat = 'nabi';
    ['wall', 'floor'].forEach(function (k) { if (I.build) { S[k] = null; P[k] = I[k] ? 0 : null; return; } S[k] = I[k] ? 0 : p ? hexIdx(k, p[k + 'Hex']) : null; });      // 263번: 짓기에서는 잰 색도 확인 전(두 박자로 칠해진다)
    UNDO = []; S.sel = null; S.kopen = false; S.hideFur = false; S.night = false; S.fv = null; S.wsel = 0; S.csel = 0;
    OPID++; OPENED = false; ZID++; ZT = 0; V.s = 0; FC.on = false; V.az = 0.62; V.el = 0.6; V.h = 0; V.hy = 0; V.yaw = 0;
    SLID++; SLV = C.slit; HEMID++; HEMV = C.lead ? 0 : 1; DHEMV = C.dlead ? 0 : 1;
    RISE.k = A.room ? 1 : 0; GLS.k = A.win ? 1 : 0; BOXES.forEach(function (b) { b.k = b.on ? 1 : 0; });
    BLD = !!I.build; ENDV = false; BLDC = BLD && !!(I.wall && I.floor); BMS = BLD ? 900 : 0; app.dataset.build = BLD ? '1' : '';      // 263번: 짓기 — 머리의 '선택'은 숨김
    BUILD = BLD && !A.room; FL.w = FL.d = BUILD ? 0.03 : 1; SUNK.k = BLD && A.dir == null ? 0 : 1;      // 263번: 짓기는 점 하나에서 시작 · 빛은 방향을 확인할 때
    if (!restored || STEPS.indexOf(S.step) < 0) S.step = 'measure';
    if (!restored) S.view = 'top';
    if (S.view === 'hem') S.view = 'eye';
    settleStep(); S.q = firstOpen(S.step); NUM.key = null;
    if (S.part === 'sheer' && !(kindNow() === 'double' || kindNow() === 'sheer')) S.part = 'drape';
    V.t = S.view === 'top' ? 0 : 1; V.rad = fitRad();
    traySig = laySig = kindSig = shapeSig = recSig = qSig = fldSig = headSig = lampSig = '\u0001'; lampKey = null;      // 지난번 화면의 줄(등 · 모양 · 장)이 남지 않게 — 빈 값이어도 한 번은 다시 그린다 LAMPV = [1, 1, 1]; lampMat.color.setRGB(1, 1, 1);
    if (RO) RO.observe(stage); else window.addEventListener('resize', resize);
    GUEST = null; QUICK = !!(I.guest && I.guest.still);
    if (I.guest) guestSetup(I.guest);      // 260번: 손님용 · 멈춘 그림
    lastKind = kindKey(); buildFurs(); resize(); layout(); sharesDirty = true; render(false);
  }
  function stop() {      // 닫기 — 그리기를 멈추고 기다리던 일을 모두 푼다(그리는 판은 다음에 다시 쓴다)
    SESSION++; ALIVE = false; LIVE = -1; ONFIN = null; GUEST = null; QUICK = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    tweens.length = 0; clearTimeout(advT); if (NUDGE) { clearTimeout(NUDGE.t); NUDGE = null; } if (drag) endDrag(); glideId++; GT = null; BEAT = false;
    if (RO) RO.disconnect(); else window.removeEventListener('resize', resize);
  }
  function info() { var m = renderer.info.memory; return { geometries: m.geometries, textures: m.textures, programs: (renderer.info.programs || []).length, raf: !!raf, tweens: tweens.length, alive: ALIVE, furs: furRoot.children.length }; }
  function peek() {      // 시험용 — 안을 들여다보기만(앱은 쓰지 않는다)
    return { S: S, C: C, A: A, R: R, P: P, WINS: WINS, BOXES: BOXES, DELTA: function () { return DELTA; }, LAYER: LAYER, kindNow: kindNow, CB: CB, BB: BB, groups: groups, place: place, setView: setView, goStep: goStep, nudge: nudge, sizeNow: sizeNow, lvNow: lvNow, bkNow: bkNow, partDone: partDone, num: function () { return NUM; }, panelNext: panelNext, keyPress: keyPress, curNext: curNext,
      slv: function () { return SLV; }, hemv: function () { return [HEMV, DHEMV]; }, lampv: function () { return LAMPV.slice(); }, undo: undo, undoN: function () { return UNDO.length; }, surfs: SURFS,
      l2s: function (wall, x, y, z) { WG[wall].updateMatrixWorld(); var q = L2W(wall, x, y, z).clone().project(cam), r = stage.getBoundingClientRect(); return { x: r.left + (q.x * 0.5 + 0.5) * r.width, y: r.top + (-q.y * 0.5 + 0.5) * r.height }; } };
  }
  DEF = pack(true);
  return { settled: settled, snap: snapShot, start: start, stop: stop, back: goBack, finish: finish, key: onKey, blur: nudgeStop, alive: function () { return ALIVE; }, info: info, peek: peek };
  }      // makeEngine 끝

  // ───────── 앱 → 입체 방: 받은 값 읽기(258번) — 크기는 폰 실측 → 앱의 크기 → 기본값(측정에서 확인) 순 ─────────
  var KMAP = { double: 'double', drape_only: 'drape', sheer_only: 'sheer', blind_only: 'blind' };      // 앱 구성 · 폰 실측 구성 → 입체 방 구성
  var DIRW = { S: '남', E: '동', W: '서', N: '북', '남': '남', '동': '동', '서': '서', '북': '북' };
  var LVD = { light: 0, medium: 1, day: 2, heavy: 3 };      // 원단 비침(data.js density) → 비침 넷(많이 비침 · 은은한 비침 · 낮 가림 · 중지)
  var GAZE = { open: 'ok', some: 'some', high: 'high' }, LIGHT = { light: 'ok', soft: 'soft', dark: 'dark' };
  var BKM = { combi: 'combi', roll: 'roll', print: 'roll', wood: 'wood', alu: 'alu' };      // 원단 블라인드 종류 → 그리는 종류(프린트는 롤처럼)
  var FURT = { sofa: 1, bed: 1, table: 1, chair: 1, desk: 1, cab: 1, display: 1, aircon: 1 };
  var FURN = [[/소파|쇼파/, 'sofa'], [/침대/, 'bed'], [/식탁/, 'table'], [/의자/, 'chair'], [/책상/, 'desk'], [/책장|장식장|진열/, 'display'], [/에어컨/, 'aircon'], [/붙박이|수납|서랍|옷장|장$/, 'cab']];
  var ROOMS = ['거실', '안방', '작은방', '아이방', '서재', '주방', '알파룸', '드레스룸', '베란다'];
  function num(v) { var n = Number(v); return v != null && v !== '' && isFinite(n) && n > 0 ? n : null; }
  function zero(v) { var n = Number(v); return v != null && v !== '' && isFinite(n) && n >= 0 ? n : null; }
  function lim(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hexOk(h) { return typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h) ? h : null; }
  function clean(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, '').trim(); }
  function itemKind(items) { var k = items.map(function (c) { return c && c.presetType; }); return k.indexOf('blind') >= 0 ? 'blind' : k.indexOf('sheer') >= 0 && k.indexOf('drape') >= 0 ? 'double' : k.indexOf('sheer') >= 0 ? 'sheer' : k.indexOf('drape') >= 0 ? 'drape' : null; }
  function sigOf(r) { r = r || {}; return hash(JSON.stringify([r.width || null, r.height || null, r.spaceWidth || null, r.spaceHeight || null, r.panes || null])); }      // 앱의 공간 크기가 그대로면 저장한 입체 방을 되살린다(구성은 언제나 앱 품목을 따름 — 품목을 나중에 골라도 측정은 남는다)
  function seedOf(items) { var o = { cw: null, ch: null, bw: null, bh: null }; (items || []).forEach(function (c) { if (!c) return; if (c.presetType === 'blind') { if (o.bw == null) { o.bw = Number(c.width) || null; o.bh = Number(c.height) || null; } } else if (o.cw == null && (c.presetType === 'drape' || c.presetType === 'sheer')) { o.cw = Number(c.width) || null; o.ch = Number(c.height) || null; } }); return o; }      // 앱 품목의 크기(cm) — 다시 열 때 견적에서 크기가 바뀌었으면 그 겹의 크기만 앱 값으로
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'g' + (h >>> 0).toString(36); }
  function surfOf(room, m, part) {      // 벽 · 바닥 색 — 앱에서 잰 색(사진 + 카드) → 폰 실측의 색 → 카드로 고른 색. 없으면 측정에서 견본을 고른다
    var cz = window.conciergeCore, p = null, mc, c;
    try { p = cz && cz.roomPart ? cz.roomPart(room, part) : null; } catch (e) { p = null; }
    if (p && p.src === 'measured' && hexOk(p.hex)) return { name: clean(p.name) || '측정한 색', hex: p.hex };
    mc = room.measuredColor && room.measuredColor[part];
    if (mc && hexOk(mc.hex)) return { name: '측정한 색', hex: mc.hex };
    c = m && m.색 && hexOk(m.색[part === 'wall' ? '벽' : '바닥']);
    if (c) return { name: '실측 때 측정한 색', hex: c };
    if (p && hexOk(p.hex)) return { name: clean(p.name) || '카드로 고른 색', hex: p.hex };
    return null;
  }
  function buildInput(o) {
    var r = o.room || {}, items = (o.items || []).filter(Boolean), m = o.measure || null, fo = typeof o.fabricOf === 'function' ? o.fabricOf : function () { return null; };
    var by = {}; items.forEach(function (c) { if (c.presetType && !by[c.presetType]) by[c.presetType] = c; });
    function fab(k) {
      var c = by[k], f = null; if (!c) return null;
      try { f = fo(c); } catch (e) { f = null; }
      if (!f) return { name: '', hex: null, density: null, blindKind: null, band: null };
      return { name: clean(f.name), hex: hexOk(f.hex), density: f.density || null, blindKind: f.blindKind || null, band: Array.isArray(f.band) && f.band[0] > 0 && f.band[1] > 0 ? [f.band[0], f.band[1]] : null };
    }
    var layers = { drape: fab('drape'), sheer: fab('sheer'), blind: fab('blind') };
    var type = r.roomType || (m && m.종류) || null;
    if (!type) ROOMS.forEach(function (k) { if (!type && String(r.name || '').indexOf(k) >= 0) type = k; });
    var kind = itemKind(items) || KMAP[m && m.구성] || KMAP[r.planComp] || null;
    // 공간(m) — 폰에서 가로 · 세로 · 높이를 다 재 왔으면 확인된 값
    var sp = m && m.공간, roomOk = !!(sp && num(sp.w) && num(sp.d) && num(sp.h)), full = m && m.전체, W, D, H, hh;
    if (roomOk) { W = sp.w / 100; D = sp.d / 100; H = sp.h / 100; }
    else {
      W = (num(sp && sp.w) || num(full && full.w) || num(r.spaceWidth) || num(r.width) || 420) / 100;
      D = num(sp && sp.d) ? sp.d / 100 : type === '베란다' ? 1.3 : 3.6;      // 세로(깊이)는 앱에 없는 값 — 기본 3.6 m(베란다 1.3 m), 측정에서 확인
      hh = num(sp && sp.h) || num(full && full.h) || num(r.spaceHeight);
      H = hh && hh >= 210 && hh <= 600 ? hh / 100 : 2.35;      // 높이가 천장 높이로 보이지 않으면 2.35 m · 272번: 600까지(입체 방 RMAX와 같게)
    }
    W = lim(W, 1.5, 15); D = lim(D, 1.0, 12); H = lim(H, 2.1, 6);      // 272번: 천장 6 m까지(입체 방 RMAX와 같게 — 여기는 엔진 밖이라 숫자로)
    // 창(m) — [가로, 세로, 바닥에서, 짝]. 폰 실측 → 앱의 블라인드 나눔(장마다) → 앱의 크기 한 장
    var ws = (m && Array.isArray(m.창) ? m.창 : []).filter(function (w) { return w && num(w.w) && num(w.h); }), wins = [], winsOk = false, c0 = items[0] || {};
    if (ws.length) { wins = ws.map(function (w) { return [w.w / 100, w.h / 100, zero(w.sill) != null ? w.sill / 100 : null, w.n || null]; }); winsOk = ws.every(function (w) { return zero(w.sill) != null; }); }
    else if (Array.isArray(r.panes) && r.panes.some(function (p) { return p && num(p.w); })) r.panes.forEach(function (p) { var q = Math.max(1, parseInt(p.qty, 10) || 1), w = num(p.w) || num(r.width), h = num(p.h) || num(r.height); if (!w || !h) return; while (q-- > 0) wins.push([w / 100, h / 100, null, null]); });
    if (!wins.length) { var w0 = num(r.width) || num(c0.width), h0 = num(r.height) || num(c0.height); wins = [[w0 ? w0 / 100 : 2.4, h0 ? h0 / 100 : 2.1, null, null]]; }
    wins.forEach(function (w) {      // 바닥에서 — 모르면 천장 가까이 닿는 창은 바닥부터, 아니면 창 위가 2.2 m쯤
      w[0] = lim(w[0], 0.2, 14.7); w[1] = lim(w[1], 0.2, H - 0.03);
      if (w[2] == null) w[2] = w[1] >= H - 0.2 ? 0 : Math.max(0, Math.min(H - 0.15, 2.2) - w[1]);
      if (w[2] + w[1] > H - 0.03) w[1] = Math.max(0.2, H - 0.03 - w[2]);
    });
    if (!roomOk && wins.length === 1 && wins[0][0] > W - 0.3) W = lim(wins[0][0] + 0.3, 1.5, 15);
    // 커튼박스 — 폰 실측에만 있다(false = 없음 · 칸 없음 = 아직 모름)
    var bxm = m ? m.박스 : null, box = null;
    if (bxm === false) box = 'n';
    else if (bxm && num(bxm.top)) box = { top: bxm.top / 100, d: num(bxm.d) ? bxm.d / 100 : 0.18, len: num(bxm.len) ? bxm.len / 100 : null };
    // 창 방향 — 폰 실측 → 앱의 창 방향(S · E · W · N)
    var dsrc = m && Array.isArray(m.방향) && m.방향.length ? m.방향 : (typeof windowDirOf === 'function' ? [].concat(windowDirOf(r.windowDir) || []) : []);
    var dir = []; dsrc.forEach(function (d) { var k = DIRW[d]; if (k && dir.indexOf(k) < 0 && dir.length < 2) dir.push(k); });
    // 가구 — 폰에서 치수까지 잰 것은 그 자리에, 앱에서 색만 잰 것은 측정의 '큰 가구'에서 흔한 규격으로
    var furs = [], furCols = [], mcf = r.measuredColor && Array.isArray(r.measuredColor.furniture) ? r.measuredColor.furniture : [];
    function furType(n) { for (var i = 0; i < FURN.length; i++) if (FURN[i][0].test(String(n || ''))) return FURN[i][1]; return null; }
    function colOf(t) { for (var i = 0; i < mcf.length; i++) if (mcf[i] && furType(mcf[i].n) === t && hexOk(mcf[i].hex)) return mcf[i]; return null; }
    (m && Array.isArray(m.가구) ? m.가구 : []).forEach(function (f) {
      if (!f || !FURT[f.t] || !num(f.w) || !num(f.d) || !num(f.h)) return;
      var c = hexOk(f.hex) ? { hex: f.hex, n: '측정한 색' } : colOf(f.t);
      furs.push({ t: f.t, w: f.w / 100, d: f.d / 100, h: f.h / 100, hex: c ? c.hex : null, cn: c ? clean(c.n) || '측정한 색' : null });
    });
    if (!furs.length) mcf.forEach(function (f) { var t = f && furType(f.n); if (t && hexOk(f.hex) && f.stay !== false) furCols.push({ t: t, hex: f.hex, cn: clean(f.n) }); });
    var sh = by.sheer, dr = by.drape, bf = layers.blind, bk = bf && BKM[bf.blindKind] || null, cw = dr || sh;
    return {
      name: clean(r.name) || '공간', type: type, kind: kind, fixed: items.length > 0, layers: layers, build: !!o.build, blank: !!o.build && !m,      // 263번: 공간 추가에서 짓기 · blank = 폰 실측이 없는 공간(공간 · 창을 칸마다 적는다)
      room: [W, D, H], roomOk: roomOk, wins: wins, winsOk: winsOk, box: box, dir: dir,
      wall: surfOf(r, m, 'wall'), floor: surfOf(r, m, 'floor'), furs: furs, furCols: furCols,
      gaze: GAZE[r.privacy] || null, light: LIGHT[r.lightBlock] || null,
      bkind: bk || BKM[r.blindWant] || null, bkFixed: !!bk,
      lv: layers.sheer && LVD[layers.sheer.density] != null ? LVD[layers.sheer.density] : null,
      lead: !!(sh && sh.leadBand), pleat: dr && /나비/.test(String(dr.pleatType || '')) ? 'nabi' : null,
      curW: cw && num(cw.width) ? cw.width / 100 : null, curH: cw && num(cw.height) ? cw.height / 100 : null,      // 266번: 높이도 처음 크기
      blW: by.blind && num(by.blind.width) ? by.blind.width / 100 : null,
      pack: r.room3d && typeof r.room3d === 'object' ? r.room3d : null,
      sig: sigOf(r), seed: seedOf(items),
      msig: m ? hash(JSON.stringify([m.공간 || null, m.창 || null, m.박스 === undefined ? null : m.박스, m.전체 || null])) : null
    };
  }

  // ───────── 열고 닫기 ─────────
  function onKeyDoc(e) { if (ENG && ENG.alive()) ENG.key(e); }      // 열려 있을 때만 단다 — 숫자판이 열려 있지 않으면 아무것도 하지 않는다
  function onBlur() { if (ENG && ENG.alive()) ENG.blur(); }
  function setWait(mode, msg) {
    ROOT.classList.toggle('r3d-loading', mode === 'load'); ROOT.classList.toggle('r3d-fail', mode === 'fail');
    if (msg) ROOT.querySelector('.r3d-msg').textContent = msg;
    ROOT.querySelector('.r3d-close').hidden = !mode;      // 받는 중에도 닫을 수 있게
  }
  function open(opts) {
    if (OPEN) return false;
    if (STILL) stillStop();      // 260번: 그리던 멈춘 그림은 그만(다음에 다시)
    OPTS = opts || {}; OPEN = true; var tk = ++TOKEN, input;
    ensureStyle(); ensureRoot();
    ROOT.classList.remove('r3d-still'); ROOT.classList.toggle('r3d-guest', !!OPTS.guest); ROOT.setAttribute('aria-label', OPTS.guest ? '공간' : '입체 방');      // 260번: 손님용(손님 화면은 '공간')
    setWait('load', (OPTS.guest ? '공간을' : '입체 방을') + ' 준비하고 있습니다');      // 260번: 손님 화면은 '공간'
    document.body.appendChild(ROOT);
    document.addEventListener('keydown', onKeyDoc); window.addEventListener('blur', onBlur);
    try { input = buildInput(OPTS); if (OPTS.guest) input.guest = Object.assign({}, OPTS.guest, { fit: !!OPTS.fit }); } catch (err) { console.error('[입체 방] 받은 값을 읽지 못함', err); setWait('fail', '이 공간의 값을 읽지 못했습니다.'); return true; }
    loadThree().then(function () {
      if (!OPEN || tk !== TOKEN) return;
      if (!ENG) { try { ENG = makeEngine(ROOT); } catch (err) { console.error('[입체 방]', err); ENG = null; } }      // 못 만들었으면 다음 열 때 다시 해 본다
      if (!ENG) { setWait('fail', '이 기기에서는 입체 그림을 그릴 수 없습니다.'); return; }
      setWait('');
      try { ENG.start(input, teardown); } catch (err) { console.error('[입체 방] 열지 못함', err); ENG.stop(); setWait('fail', (OPTS.guest ? '공간을' : '입체 방을') + ' 열지 못했습니다.'); }
    }, function () { if (!OPEN || tk !== TOKEN) return; setWait('fail', '화면을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'); });
    return true;
  }
  function teardown(res) {
    if (!OPEN) return;
    OPEN = false; TOKEN++;
    if (ENG) ENG.stop();
    document.removeEventListener('keydown', onKeyDoc); window.removeEventListener('blur', onBlur);
    if (ROOT && ROOT.parentNode) ROOT.parentNode.removeChild(ROOT);
    var cb = OPTS && OPTS.onClose; OPTS = null;
    if (cb) { try { cb(res || { done: false }); } catch (err) { console.error('[입체 방] onClose', err); } }
  }
  function close() { if (!OPEN) return; if (ENG && ENG.alive()) ENG.finish(false); else teardown({ done: false }); }      // 밖에서 닫기 — 고친 것은 room3d에 남긴다
  function back() { if (!OPEN) return; if (ENG && ENG.alive()) ENG.back(); else close(); }      // 앱의 ← (app.js handleBack)
  function isOpen() { return OPEN; }
  // 260번: 멈춘 그림 한 장 — 마무리 화면의 공간 그림(눈높이, 520 × 350). 열려 있거나 그릴 수 없으면 실패(앱은 그림 칸을 숨김). 한 번에 하나씩
  var stillQ = Promise.resolve(), STILLN = 0;
  function stopErr(m) { var e = new Error(m); e.aborted = true; return e; }      // 그만둔 것(입체 방을 열어서) — 앱은 띠를 좁히지 않고 닫힌 뒤 다시 그림
  function stillStop() { STILL = 0; if (ENG && ENG.alive()) ENG.stop(); if (ROOT) { ROOT.classList.remove('r3d-still', 'r3d-guest'); if (!OPEN && ROOT.parentNode) ROOT.parentNode.removeChild(ROOT); } }
  function still(opts) {
    function run() {
      return new Promise(function (ok, no) {
        if (OPEN) { no(stopErr('입체 방이 열려 있음')); return; }
        var input, my = ++STILLN, t0;
        try { input = buildInput(opts || {}); input.guest = { still: true, drape: (opts && opts.guest && opts.guest.drape) || null, sheer: (opts && opts.guest && opts.guest.sheer) || null, fit: !!(opts && opts.fit), open: opts && opts.open != null ? opts.open : 0.7 }; } catch (err) { no(err); return; }
        function end(err, url) { if (STILL === my) stillStop(); if (err) no(err); else ok(url); }
        ensureStyle(); ensureRoot(); ROOT.classList.add('r3d-guest', 'r3d-still'); STILL = my;
        if (!ROOT.parentNode) document.body.appendChild(ROOT);
        loadThree().then(function () {
          if (STILL !== my || OPEN) { no(stopErr('그만둠')); return; }
          if (!ENG) { try { ENG = makeEngine(ROOT); } catch (err) { ENG = null; } }
          if (!ENG) { end(new Error('입체 그림을 그릴 수 없음')); return; }
          try { ENG.start(input, null); } catch (err) { end(err); return; }
          t0 = Date.now();
          (function wait() {
            if (STILL !== my || OPEN) { no(stopErr('그만둠')); return; }
            if (ENG.settled() || Date.now() - t0 > 5000) { var url = null; try { url = ENG.snap(); } catch (err) { url = null; } end(url && url.length > 2000 ? null : new Error('그림이 비었음'), url); }
            else setTimeout(wait, 60);
          })();
        }, function (err) { end(err || new Error('그림 엔진을 받지 못함')); });
      });
    }
    var p = stillQ.then(run, run); stillQ = p.catch(function () {}); return p;
  }
  function stats() { var s = { open: OPEN, inBody: !!(ROOT && ROOT.parentNode), roots: document.querySelectorAll('.r3d').length, styles: document.querySelectorAll('#r3d-style').length, engine: !!ENG }, i, k; if (ENG) { i = ENG.info(); for (k in i) s[k] = i[k]; } return s; }      // 시험용 — 열고 닫기를 되풀이해도 늘지 않는지
  function resign(pack, room, items) { if (pack && typeof pack === 'object') { pack.sig = sigOf(room); pack.seed = seedOf(items); } return pack; }      // 완료로 앱의 크기를 바꾼 뒤 공간 화면이 부름 — 바뀐 크기를 '그대로'로 적어 다음에 되살린다
  window.RedamRoom3D = { open: open, still: still, close: close, isOpen: isOpen, back: back, stats: stats, resign: resign, _peek: function () { return ENG && ENG.alive() ? ENG.peek() : null; } };
})();
