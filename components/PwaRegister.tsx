"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Enregistrement différé après le chargement complet pour ne pas bloquer le rendu
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            if (process.env.NODE_ENV === "development") {
              console.log("[PWA] Service Worker actif (scope:", reg.scope, ")");
            }
          })
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
