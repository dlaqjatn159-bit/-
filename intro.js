(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['intro.js']='20261185';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// intro.js — 고객 화면 시작의 로고 모션 (82번). 130-4①에서 concierge.js에서 떼어 냄. concierge.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore = window.conciergeCore || {};      // concierge.js와 잇는 다리 (130-4)

    // ==============================================================
    // 로고 모션: 시작 화면의 "시작하기"를 누르면 나오고, 끝나면 첫 화면(고객 정보)으로 이어짐. 화면 아무 데나 누르면 건너뜀
    // 화면 가득한 흰빛이 모이며 걸러져 로고의 흙빛 점이 되고, 그 점에서 Re.dam 글자가 양쪽으로 번져 나온 뒤, 로고가 첫 화면의 Re.dam 자리로 옮겨 앉음
    // ==============================================================
    // 확정 로고의 글자 모양(R · e · 점 · d · a · m). 점은 원이 대신 그림
    const INTRO_PATHS = ["M53 0V-30L191 -42H213L352 -30V0ZM155 0Q157 -84 157.0 -168.0Q157 -252 157 -337V-391Q157 -476 157.0 -560.5Q157 -645 155 -728H248Q246 -645 245.5 -558.0Q245 -471 245 -366V-346Q245 -255 245.5 -169.5Q246 -84 248 0ZM614 9Q564 9 540.5 -6.5Q517 -22 509 -57L459 -228Q448 -270 433.0 -294.5Q418 -319 392.0 -330.0Q366 -341 321 -341H203V-373H348Q404 -373 443.5 -395.0Q483 -417 504.0 -455.0Q525 -493 525 -539Q525 -612 481.0 -653.5Q437 -695 346 -695H202V-728H359Q479 -728 544.5 -679.5Q610 -631 610 -540Q610 -491 584.5 -449.5Q559 -408 508.5 -381.0Q458 -354 382 -349V-359Q436 -355 467.5 -339.5Q499 -324 516.5 -295.5Q534 -267 547 -223L609 -18L568 -39L700 -30V0Q683 4 662.5 6.5Q642 9 614 9ZM53 -698V-728H202V-687H191Z", "M1053 15Q980 15 922.0 -15.0Q864 -45 831.0 -106.0Q798 -167 798 -257Q798 -341 832.5 -402.5Q867 -464 923.0 -497.5Q979 -531 1045 -531Q1110 -531 1156.5 -503.5Q1203 -476 1227.5 -429.0Q1252 -382 1252 -323Q1252 -287 1245 -263H837V-294H1127Q1154 -294 1163.0 -308.0Q1172 -322 1172 -352Q1172 -416 1138.0 -457.5Q1104 -499 1043 -499Q999 -499 963.0 -471.5Q927 -444 906.0 -392.5Q885 -341 885 -269Q885 -188 909.5 -136.0Q934 -84 977.0 -59.5Q1020 -35 1075 -35Q1128 -35 1167.5 -53.5Q1207 -72 1238 -108L1254 -94Q1221 -44 1171.0 -14.5Q1121 15 1053 15Z", "M1495 15Q1469 15 1451.5 -3.5Q1434 -22 1434 -46Q1434 -73 1451.5 -90.5Q1469 -108 1495 -108Q1521 -108 1539.0 -90.5Q1557 -73 1557 -46Q1557 -22 1539.0 -3.5Q1521 15 1495 15Z", "M1961 15Q1898 15 1848.5 -19.0Q1799 -53 1770.5 -113.0Q1742 -173 1742 -252Q1742 -338 1773.0 -400.5Q1804 -463 1857.0 -497.0Q1910 -531 1975 -531Q2019 -531 2060.5 -509.5Q2102 -488 2138 -438H2147L2135 -411Q2099 -450 2066.5 -467.5Q2034 -485 1997 -485Q1951 -485 1913.0 -461.5Q1875 -438 1852.5 -387.0Q1830 -336 1830 -254Q1830 -178 1851.0 -129.0Q1872 -80 1908.5 -56.5Q1945 -33 1990 -33Q2031 -33 2065.0 -50.5Q2099 -68 2133 -110L2146 -82H2136Q2103 -33 2058.0 -9.0Q2013 15 1961 15ZM2126 10 2122 -89V-92V-431L2124 -440V-743L2033 -748V-775L2192 -805L2206 -796L2203 -644V-34L2297 -28V0Z", "M2548 15Q2488 15 2449.0 -19.0Q2410 -53 2410 -115Q2410 -154 2427.0 -184.5Q2444 -215 2483.5 -239.0Q2523 -263 2589 -282Q2631 -295 2677.0 -307.0Q2723 -319 2763 -328V-303Q2723 -293 2682.0 -281.5Q2641 -270 2607 -257Q2543 -234 2516.5 -202.0Q2490 -170 2490 -128Q2490 -82 2515.5 -58.0Q2541 -34 2583 -34Q2606 -34 2628.0 -43.0Q2650 -52 2678.0 -74.0Q2706 -96 2744 -134L2753 -87H2729Q2698 -54 2670.5 -31.0Q2643 -8 2614.0 3.5Q2585 15 2548 15ZM2815 14Q2770 14 2747.5 -16.5Q2725 -47 2722 -100V-103V-359Q2722 -415 2710.0 -445.5Q2698 -476 2673.0 -488.0Q2648 -500 2608 -500Q2579 -500 2550.0 -491.5Q2521 -483 2488 -465L2531 -492L2515 -413Q2511 -386 2498.5 -375.0Q2486 -364 2467 -364Q2431 -364 2423 -400Q2438 -461 2492.0 -496.0Q2546 -531 2630 -531Q2717 -531 2759.5 -489.5Q2802 -448 2802 -355V-108Q2802 -61 2813.0 -44.5Q2824 -28 2844 -28Q2857 -28 2867.0 -33.5Q2877 -39 2889 -52L2905 -37Q2889 -11 2866.5 1.5Q2844 14 2815 14Z", "M2992 0V-28L3100 -39H3133L3237 -28V0ZM3074 0Q3075 -24 3075.5 -65.0Q3076 -106 3076.5 -150.5Q3077 -195 3077 -229V-290Q3077 -341 3076.5 -381.0Q3076 -421 3074 -458L2986 -463V-488L3140 -528L3153 -520L3159 -406V-403V-229Q3159 -195 3159.5 -150.5Q3160 -106 3160.5 -65.0Q3161 -24 3162 0ZM3320 0V-28L3428 -39H3461L3564 -28V0ZM3402 0Q3403 -24 3403.5 -64.5Q3404 -105 3404.5 -149.5Q3405 -194 3405 -229V-342Q3405 -416 3381.5 -446.5Q3358 -477 3318 -477Q3280 -477 3237.0 -453.0Q3194 -429 3142 -371L3133 -406H3144Q3193 -468 3243.5 -499.5Q3294 -531 3349 -531Q3414 -531 3449.5 -487.5Q3485 -444 3485 -342V-229Q3485 -194 3485.5 -149.5Q3486 -105 3486.5 -64.5Q3487 -24 3488 0ZM3648 0V-28L3754 -39H3787L3891 -28V0ZM3728 0Q3730 -24 3730.5 -64.5Q3731 -105 3731.5 -149.5Q3732 -194 3732 -229V-342Q3732 -418 3708.0 -447.5Q3684 -477 3641 -477Q3604 -477 3561.0 -455.0Q3518 -433 3468 -377L3457 -413H3469Q3517 -474 3567.0 -502.5Q3617 -531 3671 -531Q3740 -531 3776.5 -487.5Q3813 -444 3813 -343V-229Q3813 -194 3813.5 -149.5Q3814 -105 3814.5 -64.5Q3815 -24 3816 0Z"];
    const INTRO_G = { x1: 3826, cx: 1939.5, cy: -395, w: 3773 };   // 82번: 점 둘레 간격을 새 로고와 맞춤
    const INTRO_DOT = { x: 1465.5, y: -46.5, r: 61.5 };
    const INTRO_STOPS = ['#ffffff', '#faf6ef', '#f0dcc4', '#dcac85', '#b46e45', '#8a4a22'];   // 흰빛 → 살구빛 → 로고 점 흙빛
    const INTRO_T = { fadeIn: .25, hold: [0, 1.0], gather: [1.0, 4.7], letters: [4.65, 5.8], settle: [6.5, 7.7], end: [7.6, 8.2] };   // 초. 시안의 가장 긴 박자(릴스)
    // 빛의 흐린 가장자리: 흐림 필터 대신 같은 모양의 그러데이션으로 그림 (화면 전체를 흐리면 태블릿에서 끊김). [가장자리에서 떨어진 정도, 진하기]
    const INTRO_EDGE = [[-2.5, 1], [-2, .977], [-1.5, .933], [-1, .841], [-.5, .691], [0, .5], [.5, .309], [1, .159], [1.5, .067], [2, .023], [2.5, 0]];

    // OKLab로 섞어야 중간색이 탁해지지 않음
    function introLab(h) {
        const lin = c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
        const r = lin(parseInt(h.slice(1, 3), 16)), g = lin(parseInt(h.slice(3, 5), 16)), b = lin(parseInt(h.slice(5, 7), 16));
        const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
        return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
    }
    function introHex(lab) {
        const srgb = c => { const v = c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055; return Math.round(Math.max(0, Math.min(1, v)) * 255); };
        const l = Math.pow(lab[0] + .3963377774 * lab[1] + .2158037573 * lab[2], 3), m = Math.pow(lab[0] - .1055613458 * lab[1] - .0638541728 * lab[2], 3), s = Math.pow(lab[0] - .0894841775 * lab[1] - 1.291485548 * lab[2], 3);
        const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
        return '#' + rgb.map(v => srgb(v).toString(16).padStart(2, '0')).join('');
    }

    // then = 모션이 화면을 다 덮었을 때 한 번 부름 (그 뒤에서 다음 화면을 그려 둠). 모션을 못 그리는 기기에서도 반드시 부름
    function playIntro(then) {
        let covered = false;
        const cover = () => { if (!covered) { covered = true; if (then) then(); } };
        let box = null;
        try {
            const G = INTRO_G, D = INTRO_DOT, T = INTRO_T;
            let reduced = false;
            try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
            const total = reduced ? 1.6 : T.end[1];
            const paths = (from, to) => INTRO_PATHS.slice(from, to).map(d => `<path d="${d}"/>`).join('');
            box = document.createElement('div');
            box.className = 'logo-intro';
            box.setAttribute('aria-hidden', 'true');
            box.style.opacity = reduced ? '1' : '0';
            box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><defs>'
                + '<radialGradient id="introGlow" gradientUnits="userSpaceOnUse">' + INTRO_EDGE.map(s => `<stop stop-opacity="${s[1]}"/>`).join('') + '</radialGradient>'
                + '<linearGradient id="introGL" gradientUnits="userSpaceOnUse" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>'
                + '<linearGradient id="introGR" gradientUnits="userSpaceOnUse" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>'
                + '<mask id="introML" maskUnits="userSpaceOnUse" x="-2000" y="-3000" width="9000" height="6000"><rect x="-2000" y="-3000" width="3600" height="6000" fill="url(#introGL)"/></mask>'
                + '<mask id="introMR" maskUnits="userSpaceOnUse" x="-2000" y="-3000" width="9000" height="6000"><rect x="1400" y="-3000" width="5000" height="6000" fill="url(#introGR)"/></mask>'
                + '</defs>'
                + `<g><g mask="url(#introML)">${paths(0, 2)}</g><g mask="url(#introMR)"><g transform="translate(-65 0)">${paths(3)}</g></g></g>`
                + '<circle fill="url(#introGlow)"/><circle/></svg>';
            const svg = box.firstChild, logo = svg.children[1], halves = [logo.children[0], logo.children[1]], light = svg.children[2], dot = svg.children[3];
            const glow = svg.querySelector('#introGlow'), glowStops = Array.from(glow.children), gL = svg.querySelector('#introGL'), gR = svg.querySelector('#introGR');
            const labs = INTRO_STOPS.map(introLab);
            const clamp = v => Math.max(0, Math.min(1, v));
            const prog = (x, w) => clamp((x - w[0]) / (w[1] - w[0]));
            const lerp = (a, b, k) => a + (b - a) * k;
            const io = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const out = k => 1 - Math.pow(1 - k, 3);
            const set = (el, o) => { for (const k in o) el.setAttribute(k, o[k]); };
            let t0 = null, skipAt = null, ended = false, vw = 0, vh = 0, safety = 0, homeFont = 0, homeBase = 0;

            const finish = () => {
                if (ended) return;
                ended = true;
                clearTimeout(safety);
                document.removeEventListener('keydown', onKey, true);
                box.remove();
                cover();
            };
            const skip = () => { if (skipAt === null && t0 !== null) skipAt = (performance.now() - t0) / 1000; };
            // 첫 화면의 Re.dam 글자 자리(글자 시작점 · 밑선 · 크기). 로고 선 모양은 글자 크기 1000 기준
            const home = () => {
                const h = document.querySelector('#v2Viewport .wel-brand');
                if (!h) return null;
                const rc = h.getBoundingClientRect();
                if (!homeFont) {
                    const p = document.createElement('span');
                    p.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
                    h.appendChild(p);
                    homeBase = (p.getBoundingClientRect().bottom - rc.top) / rc.height;
                    p.remove();
                    homeFont = parseFloat(getComputedStyle(h).fontSize);
                }
                return { s: homeFont / 1000, x: rc.left, y: rc.top + rc.height * homeBase };
            };
            const onKey = e => { e.preventDefault(); e.stopPropagation(); skip(); };

            function frame(now) {
                if (ended) return;
                if (t0 === null) t0 = now;
                const t = (now - t0) / 1000, tt = reduced ? 1e9 : t;
                const W = box.clientWidth || window.innerWidth, H = box.clientHeight || window.innerHeight;
                if (W !== vw || H !== vh) { vw = W; vh = H; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); }

                // 로고: 화면 가운데에 나타났다가, 끝에는 첫 화면의 Re.dam 자리로 옮겨 앉음 (움직임 줄이기: 처음부터 그 자리)
                if (reduced) cover();
                let s = Math.min(W * .62, H * .7, 700) / G.w, tx = W / 2 - G.cx * s, ty = H / 2 - G.cy * s;
                const q = reduced ? 1 : io(prog(t, T.settle)), to = q > 0 ? home() : null;
                if (to) { s = Math.exp(lerp(Math.log(s), Math.log(to.s), q)); tx = lerp(tx, to.x, q); ty = lerp(ty, to.y, q); }
                logo.setAttribute('transform', `translate(${tx} ${ty}) scale(${s})`);
                const dx = tx + D.x * s, dy = ty + D.y * s, dr = D.r * s;

                // 빛: 화면을 덮은 큰 원이 모이며 색이 걸러지고 가장자리가 또렷해짐
                const R0 = Math.hypot(W, H) * .62;
                const g = prog(tt, T.gather), e = io(g) * .45 + (1 - Math.pow(1 - g, 2)) * .55;   // 화면 밖 구간은 빨리, 보이는 구간은 천천히
                const r = Math.exp(lerp(Math.log(R0), Math.log(dr), e));
                const x = lerp(W / 2, dx, e), y = lerp(H / 2, dy, e);
                const k = clamp(Math.log(R0 / r) / Math.log(R0 / dr));   // 얼마나 모였나 (0~1)
                const ci = Math.min(labs.length - 2, Math.floor(k * (labs.length - 1))), cf = k * (labs.length - 1) - ci;
                const col = introHex(labs[ci].map((v, j) => v + (labs[ci + 1][j] - v) * cf));
                const rb = r * (g === 0 ? .985 + .015 * Math.sin(prog(tt, T.hold) * Math.PI) : 1);
                const soft = r * .32 * Math.pow(1 - k, 1.4), rOut = rb + 2.5 * soft;
                if (k < .995) {
                    set(glow, { cx: x, cy: y, r: rOut });
                    glowStops.forEach((st, i) => set(st, { offset: (rb + INTRO_EDGE[i][0] * soft) / rOut, 'stop-color': col }));
                }
                set(light, { cx: x, cy: y, r: rOut, opacity: k < .995 ? 1 : 0 });
                set(dot, { cx: x, cy: y, r: r, fill: col, opacity: k >= .995 ? 1 : 0 });

                // 글자: 점에서 양쪽으로 번짐
                const pl = out(prog(tt, T.letters)), fth = 280;
                const le = lerp(1252 + fth + 10, 0, pl), re = lerp(1677 - fth - 10, G.x1 + 30, pl);   // 82번: d가 65 왼쪽으로 옮겨짐
                set(gL, { x1: le - fth, x2: le });
                set(gR, { x1: re, x2: re + fth });
                halves.forEach(h => set(h, { opacity: clamp(pl * 1.6), transform: `translate(0 ${(1 - pl) * 36})` }));

                // 나타나기 · 첫 화면으로 넘어가기 (움직임 줄이기: 로고만 잠깐 나타났다가 넘어감)
                // 136번: 끝에는 배경만 걷히고 로고는 첫 화면 Re.dam 자리에 그대로 남음 → 로고가 두 번 나타나 보이지 않게 (자리를 못 찾으면 예전처럼 함께 흐려짐)
                const endK = io(prog(t, T.end));
                let op = reduced ? 1 - io(prog(t, [1.2, 1.6])) : Math.min(clamp(t / T.fadeIn), to ? 1 : 1 - endK);
                if (!reduced) box.style.backgroundColor = `rgba(251, 249, 245, ${to ? 1 - endK : 1})`;
                if (reduced) svg.style.opacity = clamp(t / .4);
                if (skipAt !== null) op *= 1 - clamp((t - skipAt) / .15);
                box.style.opacity = op;
                if (t >= T.fadeIn) cover();

                if (t >= total || (skipAt !== null && t - skipAt >= .15)) finish();
                else requestAnimationFrame(frame);
            }

            box.addEventListener('click', skip);
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(box);
            safety = setTimeout(finish, (total + 1.5) * 1000);      // 화면이 가려져 그리기가 멈춘 때에도 남지 않게
            requestAnimationFrame(frame);
        } catch (e) {
            console.warn('로고 모션 실패', e);
            if (box) box.remove();
            cover();
        }
    }

    cz.playIntro = playIntro;      // concierge.js의 openWelcome이 부름
})();
