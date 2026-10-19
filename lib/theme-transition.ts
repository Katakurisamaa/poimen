"use client";

import { flushSync } from "react-dom";

/** Capture two complete palettes; component transitions must not enter either snapshot. */
export function transitionTheme(updateTheme: () => void) {
  const root = document.documentElement;
  if (root.classList.contains("theme-changing")) return;

  root.classList.add("theme-changing");
  const update = () => flushSync(updateTheme);
  const cleanup = () => root.classList.remove("theme-changing");

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof document.startViewTransition !== "function"
  ) {
    try {
      update();
      // Commit the new colors before restoring the components' hover transitions.
      void root.offsetWidth;
    } finally {
      cleanup();
    }
    return;
  }

  try {
    const transition = document.startViewTransition(update);
    // Also release the lock if the browser skips the animation (e.g. a hidden tab).
    void transition.finished.then(cleanup, cleanup);
  } catch {
    try {
      update();
      void root.offsetWidth;
    } finally {
      cleanup();
    }
  }
}
