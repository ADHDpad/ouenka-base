const CACHE_NAME = "ouenka-base-v1";

self.addEventListener("install", () => {
    console.log("応援歌BASE Service Worker installed");
});

self.addEventListener("activate", () => {
    console.log("応援歌BASE Service Worker activated");
});