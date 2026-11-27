"use client";

import { useEffect, useRef } from "react";

const SECTION_SELECTOR = ".zervix-glass, .zervix-gradient-border";

/**
 * Global zero-rerender futuristic pointer & click effects across all ZERVIX sections:
 * - Tracks relative cursor coordinates (--zvx-mx, --zvx-my) on hovered sections for holographic spotlight glow
 * - Emits expanding dual-ring shockwaves & spark particles at click position + kinetic border pulse on clicked sections
 */
export function HolographicSectionFX() {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let activeEl: HTMLElement | null = null;
    let rafId = 0;
    let pendingEvent: PointerEvent | null = null;

    function updateHoverPosition() {
      rafId = 0;
      const ev = pendingEvent;
      pendingEvent = null;
      if (!ev) return;

      const target = ev.target instanceof Element ? ev.target : null;
      const section = target?.closest<HTMLElement>(SECTION_SELECTOR) ?? null;

      if (activeEl && activeEl !== section) {
        activeEl.removeAttribute("data-zvx-hover");
      }

      if (section) {
        const rect = section.getBoundingClientRect();
        const rx = ev.clientX - rect.left;
        const ry = ev.clientY - rect.top;
        section.style.setProperty("--zvx-mx", `${rx.toFixed(1)}px`);
        section.style.setProperty("--zvx-my", `${ry.toFixed(1)}px`);
        section.setAttribute("data-zvx-hover", "true");
        activeEl = section;
      } else {
        activeEl = null;
      }
    }

    function handlePointerMove(e: PointerEvent) {
      pendingEvent = e;
      if (!rafId) {
        rafId = window.requestAnimationFrame(updateHoverPosition);
      }
    }

    function handlePointerLeave() {
      if (activeEl) {
        activeEl.removeAttribute("data-zvx-hover");
        activeEl = null;
      }
    }

    function spawnClickShockwave(x: number, y: number) {
      const container = overlayRef.current;
      if (!container) return;

      const isLight = document.documentElement.dataset.theme === "light";
      const cyan = isLight ? "#0891b2" : "#22d3ee";
      const violet = isLight ? "#6d28d9" : "#a855f7";

      // Outer cyan energy ring
      const outer = document.createElement("span");
      outer.style.cssText = `
        position:fixed;
        left:${x}px;
        top:${y}px;
        width:18px;
        height:18px;
        border-radius:9999px;
        border:2px solid ${cyan};
        box-shadow:0 0 18px ${cyan};
        transform:translate(-50%,-50%) scale(0.35);
        pointer-events:none;
      `;
      container.appendChild(outer);
      const outerAnim = outer.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.35)", opacity: 0.9 },
          { transform: "translate(-50%, -50%) scale(4.2)", opacity: 0 },
        ],
        { duration: 540, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
      );
      outerAnim.onfinish = () => outer.remove();

      // Inner violet pulse core
      const inner = document.createElement("span");
      inner.style.cssText = `
        position:fixed;
        left:${x}px;
        top:${y}px;
        width:14px;
        height:14px;
        border-radius:9999px;
        border:1.5px solid ${violet};
        background:radial-gradient(circle, ${cyan}55 0%, transparent 70%);
        transform:translate(-50%,-50%) scale(0.3);
        pointer-events:none;
      `;
      container.appendChild(inner);
      const innerAnim = inner.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0.85 },
          { transform: "translate(-50%, -50%) scale(2.8)", opacity: 0 },
        ],
        { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" }
      );
      innerAnim.onfinish = () => inner.remove();
    }

    function handlePointerDown(e: PointerEvent) {
      const target = e.target instanceof Element ? e.target : null;
      const section = target?.closest<HTMLElement>(SECTION_SELECTOR) ?? null;
      const interactive = target?.closest<HTMLElement>("button, a, [role='button']") ?? null;

      if (section || interactive) {
        spawnClickShockwave(e.clientX, e.clientY);
      }

      if (section) {
        const rect = section.getBoundingClientRect();
        section.style.setProperty("--zvx-mx", `${(e.clientX - rect.left).toFixed(1)}px`);
        section.style.setProperty("--zvx-my", `${(e.clientY - rect.top).toFixed(1)}px`);
        section.classList.remove("zervix-fx-clicked");
        // Trigger CSS keyframe restart
        void section.offsetWidth;
        section.classList.add("zervix-fx-clicked");
        window.setTimeout(() => {
          section.classList.remove("zervix-fx-clicked");
        }, 560);
      }
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, { passive: true });
    document.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("mouseleave", handlePointerLeave);
      if (activeEl) activeEl.removeAttribute("data-zvx-hover");
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
    />
  );
}
