import { useEffect } from "react";

// Scroll reveals for every player page. Components fade and rise as they enter the screen,
// siblings follow one after another. Works for lists that load later (bookings, slots) because a
// MutationObserver picks up new elements. Nothing already on screen at load is hidden, so there is no flash.

const TARGETS = [
  "[data-reveal]",
  "[data-stagger] > *",
  ".section h2:not(.rise)",
  ".section .body-lg",
  ".price-row",
  ".walk__step",
  ".walk__preview",
  ".courts__stage",
  ".courts__list > *",
  ".upd2__row",
  ".phone",
  ".bubble",
  ".ink-tile",
  ".rent__row",
  ".rent__stage",
  ".visit__fact",
  ".visit__photo",
  ".pds-accordion > *",
  ".cta__body > *",
  ".flow .block",
  ".flow__aside > *",
  ".court-card",
  ".addon-pick",
  ".demo-step",
  ".bk-row",
  ".need-grid > * > *",
  ".ticket-wrap > *",
  ".pay-grid > *",
  // landing sections
  ".pboard__row",
  ".pboard__foot > *",
  ".uchat .iphone",
  ".utl__item",
  ".rent__list > *",
  ".gal__item",
  ".club__plan",
  ".club__side",
  ".visit2__photo",
  ".arrive__step",
  ".fine__item",
  // booking pages
  ".held-note",
  ".paynext li",
  ".tpage__actions > *",
  ".timg",
  ".findx__art",
  ".findx__help > *",
].join(",");

const IMAGES = ".update, .courts__stage, .rent__stage, .visit__photo, .court-card__media, .gal__item, .visit2__photo, .findx__art";

export function usePageMotion(key: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("m-on");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    // The wordmark sits on the very bottom edge, so it gets an observer with no bottom inset.
    const edge = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("m-on"); edge.unobserve(e.target); } }),
      { threshold: 0 },
    );

    // Anything primed by an earlier run that has not shown yet gets watched again
    // (React can run this effect twice, and a route change starts a new observer).
    document.querySelectorAll(".m-rev:not(.m-on)").forEach((el) => io.observe(el));
    document.querySelectorAll(".m-giant:not(.m-on)").forEach((el) => edge.observe(el));

    // The footer wordmark: watch the wrapper, slide the letters up from the bottom edge.
    document.querySelectorAll<HTMLElement>("[data-giant]").forEach((el) => {
      if (el.dataset.m) return;
      el.dataset.m = "1";
      el.classList.add("m-giant");
      edge.observe(el);
    });

    const scan = () => {
      const fold = window.innerHeight * 0.92;
      const seen = new Map<Element, number>();
      document.querySelectorAll<HTMLElement>(TARGETS).forEach((el) => {
        if (el.dataset.m) return;
        el.dataset.m = "1";
        // Anything already visible stays put; only what is below the fold animates in.
        if (el.getBoundingClientRect().top < fold) return;
        const parent = el.parentElement!;
        const i = seen.get(parent) ?? 0;
        seen.set(parent, i + 1);
        el.style.setProperty("--m-i", String(Math.min(i, 6)));
        el.classList.add("m-rev");
        if (el.matches(IMAGES)) el.classList.add("m-img");
        io.observe(el);
      });
    };

    let t: number | undefined;
    const mo = new MutationObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(scan, 60);
    });
    const start = window.setTimeout(() => {
      scan();
      mo.observe(document.body, { childList: true, subtree: true });
    }, 30);

    return () => {
      window.clearTimeout(start);
      window.clearTimeout(t);
      mo.disconnect();
      io.disconnect();
      edge.disconnect();
    };
  }, [key]);
}
