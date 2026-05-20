/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
        const { request } = event;
        const { url, method, mode, cache } = request;

        if (cache === "only-if-cached" && mode !== "same-origin") {
            return;
        }

        // Only intercept GET requests to our own origin for HTML/JS/CSS to inject COOP/COEP headers.
        // This avoids breaking large POST uploads, external API calls, and WebSockets.
        const isGET = method === "GET";
        const isSameOrigin = url.startsWith(self.location.origin);
        const isAsset = url.endsWith('.js') || url.endsWith('.css') || url.endsWith('.html') || url === self.location.origin || url === self.location.origin + '/';
        const isHMR = url.includes('socket.io') || url.includes('hot-update') || url.includes('vite');

        if (isGET && isSameOrigin && isAsset && !isHMR) {
            event.respondWith(
                fetch(request).then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                }).catch(err => {
                    console.error("[COI ServiceWorker] Fetch failed for:", url, err);
                    return Response.error();
                })
            );
        }
    });
} else {
    const script = document.currentScript;
    if (script) {
        if (navigator.serviceWorker) {
            // Use explicit root path to avoid redirect issues from currentScript.src
            navigator.serviceWorker.register("/coi-serviceworker.js").then((registration) => {
                registration.addEventListener("updatefound", () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.addEventListener("statechange", () => {
                            if (installingWorker.state === "installed") {
                                console.log("[COI ServiceWorker] New version installed. It will take effect on next reload.");
                                // We REMOVE the auto-reload to avoid interrupting the user's work
                                // if (navigator.serviceWorker.controller) { location.reload(); }
                            }
                        });
                    }
                });
            }).catch(err => {
                if (err.message && err.message.includes("redirect")) {
                    console.warn("[COI_SERVICE_WORKER_SKIPPED_IN_HOSTED_PREVIEW] Service worker disabled due to redirect:", err);
                } else {
                    console.error("[COI ServiceWorker] Registration failed:", err);
                }
            });
        }
    }
}
