const CACHE_NAME = "controlcredit-v2";

// Instalar SW
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Interceptar requests — NETWORK FIRST (siempre intenta la red primero)
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Supabase: red directa, si falla responder offline
  if (url.hostname.includes("supabase.co")) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: "offline" }), {
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }

  // Todo lo demás: NETWORK FIRST — usa la red, guarda copia, y solo usa cache si no hay internet
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        // Sin internet: usar cache
        return caches.match(event.request).then((cached) => {
          return cached || caches.match("/index.html");
        });
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
