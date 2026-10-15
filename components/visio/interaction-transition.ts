const EXIT_DURATION_MS = 240;
const EXIT_EASING = "cubic-bezier(.2,.75,.25,1)";

function releaseDockAfterItCloses(
  dock: HTMLElement,
  animations: Animation[],
  originalTransition: string,
  originalTransitionPriority: string,
) {
  let cleanedUp = false;
  let attempts = 0;
  const maxAttempts = 18; // ~300ms at 60fps

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    animations.forEach(animation => {
      try { animation.cancel(); } catch { /* ignore */ }
    });
    if (originalTransition) dock.style.setProperty("transition", originalTransition, originalTransitionPriority);
    else dock.style.removeProperty("transition");
    delete dock.dataset.visioClosing;
  };

  const release = () => {
    if (cleanedUp) return;
    attempts++;
    if (!dock.isConnected || dock.getAttribute("aria-hidden") === "true" || attempts >= maxAttempts) {
      cleanup();
      return;
    }

    requestAnimationFrame(release);
  };

  requestAnimationFrame(release);
  setTimeout(cleanup, 320);
}

/** Animate a meeting side panel and its dock before React removes either one. */
export async function animateVisioPanelExit(panel: HTMLElement | null | undefined): Promise<boolean> {
  if (!panel) return true;

  const dock = panel.closest<HTMLElement>('[data-visio-interaction-dock="true"]');
  if (dock?.dataset.visioClosing === "true") return true;
  const originalTransition = dock?.style.getPropertyValue("transition") ?? "";
  const originalTransitionPriority = dock?.style.getPropertyPriority("transition") ?? "";
  if (dock) {
    dock.dataset.visioClosing = "true";
    dock.style.setProperty("transition", "none", "important");
  }

  let cleanupScheduled = false;
  try {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    if (reducedMotion || isMobile) {
      if (dock) {
        cleanupScheduled = true;
        releaseDockAfterItCloses(dock, [], originalTransition, originalTransitionPriority);
      }
      return true;
    }

    const animations: Animation[] = [panel.animate(
      [
        { opacity: 1, transform: "translate(0, 0)" },
        { opacity: 0, transform: "translateX(24px)" },
      ],
      { duration: EXIT_DURATION_MS, easing: EXIT_EASING, fill: "forwards" },
    )];

    if (dock) {
      const dockStyle = getComputedStyle(dock);
      animations.push(dock.animate(
        [{ flexBasis: dockStyle.flexBasis, width: dockStyle.width, maxWidth: dockStyle.maxWidth, opacity: dockStyle.opacity }, { flexBasis: "0px", width: "0px", maxWidth: "0px", opacity: 0 }],
        { duration: EXIT_DURATION_MS, easing: EXIT_EASING, fill: "forwards" },
      ));
    }

    await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
    if (dock) {
      cleanupScheduled = true;
      releaseDockAfterItCloses(dock, animations, originalTransition, originalTransitionPriority);
    } else {
      requestAnimationFrame(() => animations.forEach(animation => animation.cancel()));
    }
    return true;
  } finally {
    if (dock && !cleanupScheduled) {
      if (originalTransition) dock.style.setProperty("transition", originalTransition, originalTransitionPriority);
      else dock.style.removeProperty("transition");
      delete dock.dataset.visioClosing;
    }
  }
}
