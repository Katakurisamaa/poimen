"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "poimen_theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.body.dataset.theme = theme;
  document.body.style.colorScheme = theme;
  document.body.classList.toggle("dark", theme === "dark");
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);
  const isTransitioning = useRef(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage may be disabled
    }

    const getSystemTheme = (): ThemeMode => {
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
      return "light";
    };

    const currentDocTheme = document.documentElement.dataset.theme as ThemeMode | undefined;
    const initialTheme: ThemeMode =
      (saved === "dark" || saved === "light")
        ? saved
        : (currentDocTheme === "dark" || currentDocTheme === "light")
          ? currentDocTheme
          : getSystemTheme();

    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);

    // Écouter les changements de mode sombre/clair du système d'exploitation de l'appareil
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemChange = (e: MediaQueryListEvent) => {
        let currentSaved: string | null = null;
        try {
          currentSaved = localStorage.getItem(STORAGE_KEY);
        } catch {}
        // Ne basculer automatiquement que si l'utilisateur n'a pas fixé manuellement un choix
        if (!currentSaved) {
          const sysTheme: ThemeMode = e.matches ? "dark" : "light";
          setTheme(sysTheme);
          applyTheme(sysTheme);
        }
      };

      mediaQuery.addEventListener("change", handleSystemChange);
      return () => mediaQuery.removeEventListener("change", handleSystemChange);
    }
  }, []);

  const toggleTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isTransitioning.current) return;
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";

    const updateDomAndState = () => {
      setTheme(nextTheme);
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // localStorage may be disabled
      }
      applyTheme(nextTheme);
      window.dispatchEvent(
        new CustomEvent("poimen-theme-change", { detail: nextTheme })
      );
    };

    const doc =
      typeof document !== "undefined"
        ? (document as unknown as {
            startViewTransition?: (callback: () => void) => {
              ready: Promise<void>;
              finished: Promise<void>;
            };
          })
        : null;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (doc?.startViewTransition && !prefersReducedMotion) {
      isTransitioning.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = doc.startViewTransition(() => {
        updateDomAndState();
      });

      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 480,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              pseudoElement: "::view-transition-new(root)",
            }
          );
        })
        .catch(() => {});

      transition.finished
        .catch(() => {})
        .finally(() => {
          isTransitioning.current = false;
        });
    } else {
      isTransitioning.current = true;
      document.documentElement.classList.add("theme-transitioning");
      updateDomAndState();
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
        isTransitioning.current = false;
      }, 400);
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"}
      title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
      data-ready={mounted ? "true" : "false"}
      data-mode={theme}
    >
      <span className="theme-toggle__icon">
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </span>
      <span className="theme-toggle__label">
        {theme === "dark" ? "Clair" : "Sombre"}
      </span>
    </button>
  );
}
