const CACHE_NAME = "ouenka-base-v39";

// 2026-10-06
// 1-9分離音源方式：メロディー重複時のみ前曲メロディーを抑止。
// コード進行＋ベースは常時維持。弱起音量補正は廃止。
// 音楽ファイルはキャッシュせず、HTML/JS/CSSも常にネットワーク最新版を優先する。

self.addEventListener("install", () => {
    console.log("応援歌BASE Service Worker installed");
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    console.log("応援歌BASE Service Worker activated");
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames.map((cacheName) => {
                    if (
                        cacheName.startsWith("ouenka-base-") &&
                        cacheName !== CACHE_NAME
                    ) {
                        return caches.delete(cacheName);
                    }
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const lower = url.pathname.toLowerCase();

    if (
        lower.endsWith(".m4a") ||
        lower.endsWith(".mp3") ||
        lower.endsWith(".wav") ||
        lower.endsWith(".aac") ||
        lower.endsWith(".mid") ||
        lower.endsWith(".zip")
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request, { cache: "no-store" })
            .catch(() => fetch(event.request))
    );
});
