"use client";

import { useEffect } from "react";

/**
 * Universal Modal Scroll Lock
 * 
 * Automatically locks background scroll when any modal (.modal-overlay)
 * is open, preventing scroll bleed to the underlying page while allowing
 * smooth scrolling inside modal containers (.custom-modal, .arch-card, etc.).
 */
export default function ModalScrollLock() {
  useEffect(() => {
    let touchStartY = 0;

    const checkModals = () => {
      const activeModals = document.querySelectorAll(".modal-overlay, dialog[open]");
      const isLocked = activeModals.length > 0;

      if (isLocked) {
        document.documentElement.classList.add("modal-locked");
        document.body.classList.add("modal-locked");
      } else {
        document.documentElement.classList.remove("modal-locked");
        document.body.classList.remove("modal-locked");
      }
    };

    // Observer to detect modals being added or removed from DOM
    const observer = new MutationObserver(() => {
      checkModals();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "open", "style"],
    });

    // Run initial check
    checkModals();

    const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
      let curr = node;
      while (curr && curr !== document.body && curr !== document.documentElement) {
        if (
          curr.classList.contains("custom-modal") ||
          curr.classList.contains("arch-card") ||
          curr.getAttribute("role") === "dialog" ||
          curr.classList.contains("custom-select-options") ||
          curr.hasAttribute("data-scrollable")
        ) {
          return curr;
        }
        curr = curr.parentElement;
      }
      return null;
    };

    // Prevent wheel scroll bleed outside or at the edges of the modal
    const handleWheel = (e: WheelEvent) => {
      const hasOverlay = document.querySelector(".modal-overlay, dialog[open]");
      if (!hasOverlay) return;

      const target = e.target as HTMLElement | null;
      const scrollable = getScrollParent(target);

      if (!scrollable) {
        // Scrolling on overlay backdrop or page background
        if (e.cancelable) e.preventDefault();
        return;
      }

      // Check boundary inside the scrollable modal container
      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      const hasOverflow = scrollHeight > clientHeight;

      if (!hasOverflow) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      const isScrollingDown = e.deltaY > 0;
      const isScrollingUp = e.deltaY < 0;
      const isAtTop = scrollTop <= 0;
      const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;

      if ((isScrollingDown && isAtBottom) || (isScrollingUp && isAtTop)) {
        if (e.cancelable) e.preventDefault();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const hasOverlay = document.querySelector(".modal-overlay, dialog[open]");
      if (!hasOverlay) return;

      const target = e.target as HTMLElement | null;
      const scrollable = getScrollParent(target);

      if (!scrollable) {
        // Swiping on backdrop or outside modal
        if (e.cancelable) e.preventDefault();
        return;
      }

      if (e.touches.length > 0) {
        const touchCurrentY = e.touches[0].clientY;
        const deltaY = touchStartY - touchCurrentY; // > 0 = scrolling down

        const { scrollTop, scrollHeight, clientHeight } = scrollable;
        const hasOverflow = scrollHeight > clientHeight;

        if (!hasOverflow) {
          if (e.cancelable) e.preventDefault();
          return;
        }

        const isScrollingDown = deltaY > 0;
        const isScrollingUp = deltaY < 0;
        const isAtTop = scrollTop <= 0;
        const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;

        if ((isScrollingDown && isAtBottom) || (isScrollingUp && isAtTop)) {
          if (e.cancelable) e.preventDefault();
        }
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("modal-locked");
      document.body.classList.remove("modal-locked");
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return null;
}
