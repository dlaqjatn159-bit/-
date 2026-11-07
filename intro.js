(function(g){(g.REDAM_FILES=g.REDAM_FILES||{})['intro.js']='20261223';})(typeof window!=='undefined'?window:globalThis); // 파일 버전 표시 (파일이 서로 맞는지 확인용)
// intro.js — 고객 화면 시작의 로고 모션 (82번). 130-4①에서 concierge.js에서 떼어 냄. concierge.js 다음에 읽힘

(function() {
    const cz = window.conciergeCore = window.conciergeCore || {};      // concierge.js와 잇는 다리 (130-4)

    // ==============================================================
    // 로고 모션 (150번 "확정4", 기준문서 03_로고_모션.md · 시안 로고모션_확정4_시안.html): 시작 화면의 "시작하기"를 누르면 나오고,
    // 끝나면 첫 화면(고객 정보)으로 이어짐. 화면 아무 데나 누르면 건너뜀
    // 원 로고(흙빛 원, R과 점은 구멍)가 좁아지며 R이 가장자리부터 잘려 나가고 → 고리가 닫혀 점이 됨 → 화면이 물러나며 Re.dam이 나타남 → 첫 화면 Re.dam 자리로 옮겨 앉음
    // 좌표는 logo.js의 글씨 로고 선(글자 크기 1000, 밑선 y=0, 아래쪽이 +)
    // ==============================================================
    const INTRO_K = { C0: [933.5, -297.36], R0: 672.6, D: [1267, -54.5], dr: 74.55, W0: [1680.5, -297.36], ew: 4760.35 };   // 원 로고 원 · 점 · 끝 화면(시안 값)
    const INTRO_T = { shrink: [0.6, 2.0], close: [1.85, 2.2], word: [2.7, 3.5], settle: [4.5, 5.2], end: [5.1, 5.6] };     // 초. 4.5초까지는 03_로고_모션.md 그대로, 그 뒤 첫 화면으로 옮겨 앉기

    // then = 모션이 화면을 다 덮었을 때 한 번 부름 (그 뒤에서 다음 화면을 그려 둠). 모션을 못 그리는 기기에서도 반드시 부름
    function playIntro(then) {
        let covered = false;
        const cover = () => { if (!covered) { covered = true; if (then) then(); } };
        let box = null;
        try {
            const K = INTRO_K, T = INTRO_T, L = window.REDAM_LOGO;
            let reduced = false;
            try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
            const total = reduced ? 1.6 : T.end[1];
            const rPath = L.WORD.split(/(?=M)/).slice(0, 2).join('');   // 글씨 로고의 R (원 로고 안에서는 구멍)
            box = document.createElement('div');
            box.className = 'logo-intro';
            box.setAttribute('aria-hidden', 'true');
            box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><defs>'
                + '<mask id="introM" maskUnits="userSpaceOnUse" x="-99999" y="-99999" width="199999" height="199999">'
                + `<circle fill="#fff"/><circle fill="#000"/><path fill="#000" transform="translate(490 0)" d="${rPath}"/></mask></defs>`
                + `<path class="intro-word" d="${L.WORD}" opacity="0"/><circle fill="#8a4a22" mask="url(#introM)"/></svg>`;
            const svg = box.firstChild, word = svg.querySelector('.intro-word'), mc = svg.querySelector('mask').children, dot = svg.children[2];
            const clamp = v => Math.max(0, Math.min(1, v));
            const prog = (x, w) => clamp((x - w[0]) / (w[1] - w[0]));
            const lerp = (a, b, k) => a + (b - a) * k;
            const io = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            const set = (el, o) => { for (const k in o) el.setAttribute(k, o[k]); };
            let t0 = null, skipAt = null, ended = false, safety = 0;

            const finish = () => {
                if (ended) return;
                ended = true;
                clearTimeout(safety);
                document.removeEventListener('keydown', onKey, true);
                box.remove();
                cover();
            };
            const skip = () => { if (skipAt === null && t0 !== null) skipAt = (performance.now() - t0) / 1000; };
            // 첫 화면의 Re.dam 로고 자리 → 화면 배율(로고 1단위 = 몇 px)과 점의 화면 위치
            const home = () => {
                const h = document.querySelector('#v2Viewport .wel-brand .redam-logo');
                if (!h) return null;
                const rc = h.getBoundingClientRect();
                if (!rc.width) return null;
                const s = rc.width / L.BOX.w;
                return { s, x: rc.left + (K.D[0] - L.BOX.x) * s, y: rc.top + (K.D[1] - L.BOX.y) * s };
            };
            const onKey = e => { e.preventDefault(); e.stopPropagation(); skip(); };

            function frame(now) {
                if (ended) return;
                if (t0 === null) t0 = now;
                const t = (now - t0) / 1000, tt = reduced ? T.word[1] : Math.min(t, T.settle[0]);
                const W = box.clientWidth || window.innerWidth, H = box.clientHeight || window.innerHeight;

                // ① 원이 점 자리로 좁아짐(화면은 원을 따라감) ② 고리가 닫혀 점이 됨
                const p = io(prog(tt, T.shrink));
                const cx = lerp(K.C0[0], K.D[0], p), cy = lerp(K.C0[1], K.D[1], p), r = lerp(K.R0, K.dr, p);
                const hr = Math.min(K.dr * .9, r * .5) * (1 - io(prog(tt, T.close)));
                set(mc[0], { cx, cy, r }); set(dot, { cx, cy, r });
                set(mc[1], { cx: K.D[0], cy: K.D[1], r: hr });

                // ③ 화면이 물러나며 글자가 한꺼번에 나타남 (시안은 16:9 화면 — 다른 비율도 그 틀이 화면 안에 들어오게)
                const pw = io(prog(tt, T.word));
                const w = lerp(K.R0 * 2 * 2.9, K.ew, pw), h = w * 9 / 16;
                let S = Math.min(W / w, H / h), fx = lerp(cx, K.W0[0], pw), fy = lerp(cy, K.W0[1], pw);   // 화면 가운데에 올 로고 좌표
                let dX = W / 2 + (K.D[0] - fx) * S, dY = H / 2 + (K.D[1] - fy) * S;                         // 점의 화면 위치
                word.setAttribute('opacity', pw);

                // ④ 첫 화면 Re.dam 자리로 옮겨 앉음 (움직임 줄이기: 처음부터 그 자리)
                if (reduced) cover();
                const q = reduced ? 1 : io(prog(t, T.settle)), to = q > 0 ? home() : null;
                if (to) { S = Math.exp(lerp(Math.log(S), Math.log(to.s), q)); dX = lerp(dX, to.x, q); dY = lerp(dY, to.y, q); }
                svg.setAttribute('viewBox', `${K.D[0] - dX / S} ${K.D[1] - dY / S} ${W / S} ${H / S}`);

                // 나타나기 · 첫 화면으로 넘어가기 (움직임 줄이기: 글씨 로고만 서서히 나타났다가 넘어감)
                // 136번: 끝에는 배경만 걷히고 로고는 첫 화면 Re.dam 자리에 그대로 남음 (자리를 못 찾으면 함께 흐려짐)
                const endK = io(prog(t, T.end));
                let op = reduced ? 1 - io(prog(t, [1.2, 1.6])) : (to ? 1 : 1 - endK);
                if (!reduced) box.style.backgroundColor = `rgba(251, 249, 245, ${to ? 1 - endK : 1})`;
                if (reduced) svg.style.opacity = clamp(t / .6);
                if (skipAt !== null) op *= 1 - clamp((t - skipAt) / .15);
                box.style.opacity = op;
                if (t >= .05) cover();

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
