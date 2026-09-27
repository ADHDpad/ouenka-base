const CACHE_NAME = "ouenka-base-v2";


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
//
// 応援歌BASEでは
// HTML / JavaScript / 音源などを
// Service Workerに保存しない。
//
// 常にサーバー側の最新版を使用する。
// ========================================

self.addEventListener("fetch", (event) => {

    // GET以外はそのまま
    if (event.request.method !== "GET") {
        return;
    }

    event.respondWith(

        fetch(
            event.request,
            {
                cache: "no-store"
            }
        )

        .catch(() => {

            // 通信失敗時は通常のリクエスト
            return fetch(event.request);

        })

    );

});