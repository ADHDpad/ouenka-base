const CACHE_NAME = "ouenka-base-v4";


// ========================================
// インストール
// ========================================

self.addEventListener("install", () => {

    console.log(
        "応援歌BASE Service Worker installed"
    );

    self.skipWaiting();

});


// ========================================
// 有効化
// ========================================

self.addEventListener("activate", (event) => {

    console.log(
        "応援歌BASE Service Worker activated"
    );

    event.waitUntil(

        caches.keys()

            .then((cacheNames) => {

                return Promise.all(

                    cacheNames.map(
                        (cacheName) => {

                            if (
                                cacheName.startsWith(
                                    "ouenka-base-"
                                ) &&
                                cacheName !== CACHE_NAME
                            ) {

                                return caches.delete(
                                    cacheName
                                );

                            }

                        }
                    )

                );

            })

            .then(() => {

                return self.clients.claim();

            })

    );

});


// ========================================
// 通信
// ========================================

self.addEventListener("fetch", (event) => {

    // GET以外は何もしない
    if (event.request.method !== "GET") {

        return;

    }


    const url =
        new URL(event.request.url);


    // ====================================
    // 音楽ファイルはService Workerで
    // 処理しない
    // ====================================

    if (
        url.pathname.toLowerCase().endsWith(".m4a") ||
        url.pathname.toLowerCase().endsWith(".mp3") ||
        url.pathname.toLowerCase().endsWith(".wav") ||
        url.pathname.toLowerCase().endsWith(".aac") ||
        url.pathname.toLowerCase().endsWith(".mid")
    ) {

        return;

    }


    // ====================================
    // その他のファイル
    // ====================================

    event.respondWith(

        fetch(
            event.request,
            {
                cache: "no-store"
            }
        )

        .catch(() => {

            return fetch(
                event.request
            );

        })

    );

});