/* ==========================================================================
   Re.dam 오프라인 지원 (Service Worker)
   - 앱 파일: 인터넷이 되면 항상 최신 파일을 받고, 안 되면(또는 4초 넘게 느리면) 저장해 둔 파일로 실행
   - 외부 도구(Tailwind·아이콘·글꼴 등): 처음 한 번 받아 저장해 두고 이후엔 저장본 사용
   ========================================================================== */
// 앱 버전: 바꾸면 탭이 새 서비스 워커를 받아 앱 파일을 다시 받아 둠 (CACHE 이름은 그대로 — 바꾸면 미리 받아 둔 사진까지 지워짐)
const BUILD = '20261097';
const CACHE = 'redam-app-v1';
const SCOPE = self.registration.scope;

self.addEventListener('install', event => {
    event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// index.html 안에 적힌 모든 파일(내 파일 + 외부 도구)을 미리 받아 둠. 일부가 실패해도 설치는 계속됨.
async function precache() {
    const cache = await caches.open(CACHE);
    const indexUrl = new URL('./index.html', SCOPE).href;
    let html = '';
    try {
        const res = await fetch(new Request(indexUrl, { cache: 'reload' }));
        html = await res.clone().text();
        await cache.put(indexUrl, res);
    } catch (e) { /* 오프라인 상태에서 설치된 경우 */ }

    const urls = new Set();
    (html.match(/(?:src|href)="[^"#]+"/g) || []).forEach(m => {
        const u = m.slice(m.indexOf('"') + 1, -1);
        if (/^(data:|mailto:|tel:|javascript:)/.test(u)) return;
        try {
            const abs = new URL(u, SCOPE);
            if (abs.pathname === '/' && abs.origin !== self.location.origin) return;   // preconnect 같은 주소만 있는 항목 제외
            urls.add(abs.href);
        } catch (e) {}
    });
    urls.delete(indexUrl);

    // index.html에 적혀 있지 않지만 꼭 미리 받아 둘 사진: 분위기 카드 6장 (현장에서 인터넷이 느려도 첫 화면부터 바로 뜨게)
    ['mood_01_cozy', 'mood_02_clean', 'mood_03_subtle', 'mood_04_natural', 'mood_05_warm', 'mood_06_bright']
        .forEach(n => urls.add(new URL('photos/mood/' + n + '.jpg', SCOPE).href));
    // 속지 느낌 장면 3장도 같이 (10-15)
    ['feel_smooth', 'feel_textured', 'feel_cozy']
        .forEach(n => urls.add(new URL('photos/feel/' + n + '.jpg', SCOPE).href));
    // 창 구성 4장 · 블라인드 종류 4장도 같이 (38번)
    ['comp_double', 'comp_sheer', 'comp_drape', 'comp_blind']
        .forEach(n => urls.add(new URL('photos/comp/' + n + '.jpg', SCOPE).href));
    ['blind_combi', 'blind_roll', 'blind_wood', 'blind_alu']
        .forEach(n => urls.add(new URL('photos/blind/' + n + '.jpg', SCOPE).href));

    await Promise.allSettled([...urls].map(async href => {
        const local = href.startsWith(self.location.origin);
        const res = await fetch(new Request(href, local ? { cache: 'reload' } : { mode: 'no-cors' }));
        if (res.ok || res.type === 'opaque') await cache.put(href, res);
    }));
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
    event.respondWith(url.origin === self.location.origin ? networkFirst(req) : cacheFirst(req));
});

async function networkFirst(req) {
    const cache = await caches.open(CACHE);
    const fallback = async () => {
        const hit = await cache.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
            return (await cache.match(req, { ignoreSearch: true }))
                || (await cache.match(new URL('./index.html', SCOPE).href))
                || (await cache.match(SCOPE));
        }
        return undefined;
    };
    try {
        const res = await Promise.race([
            fetch(req),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
        ]);
        if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
    } catch (err) {
        const hit = await fallback();
        if (hit) return hit;
        return fetch(req);      // 저장본이 없으면 끝까지 네트워크를 기다림
    }
}

async function cacheFirst(req) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
        return res;
    } catch (e) {
        return Response.error();
    }
}
