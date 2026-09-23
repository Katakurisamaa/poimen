"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        void (async () => {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations
            .filter((reg) => [reg.active, reg.waiting, reg.installing].some(
              (worker) => worker?.scriptURL === new URL("/sw.js", window.location.origin).href
            ))
            .map((reg) => reg.unregister()));
          const keys = await caches.keys();
          await Promise.all(keys.filter((key) => key.startsWith("poimen-")).map((key) => caches.delete(key)));
        })().catch((err) => console.warn("[PWA] Nettoyage du cache de développement impossible:", err));
        return;
      }
      // Enregistrement différé après le chargement complet pour ne pas bloquer le rendu
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/", updateViaCache: "none" })
          .catch((err) => {
            console.warn("[PWA] Échec de l'enregistrement du Service Worker:", err);
          });
      };

      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register);
        return () => window.removeEventListener("load", register);
      }
    }
  }, []);

  return null;
}
