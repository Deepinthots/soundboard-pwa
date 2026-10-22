const CACHE_NAME = "office-soundboard-v4";

// Install event - skip waiting to activate immediately
self.addEventListener("install", (event) => {
	self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cache) => {
					if (cache !== CACHE_NAME) {
						return caches.delete(cache);
					}
				})
			);
		}).then(() => self.clients.claim())
	);
});

// Fetch event - completely bypass service worker for all MP3 and JSON files
self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);

	// Let audio files and config/manifest requests bypass service worker storage completely
	if (url.pathname.endsWith(".mp3") || url.pathname.endsWith(".json") || url.pathname.endsWith(".m4a")) {
		event.respondWith(fetch(event.request));
		return;
	}

	event.respondWith(
		fetch(event.request).catch(() => caches.match(event.request))
	);
});
