"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export default function SectionNavigation({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = root.current?.querySelector<HTMLElement>(".sela-header-wrap");
    if (!header) return;
    const observer = new ResizeObserver(() => root.current?.style.setProperty("--navigation-height", `${header.getBoundingClientRect().height}px`));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  function navigate(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const id = link?.getAttribute("href")?.slice(1);
    if (!id || link?.hasAttribute("download") || (link?.target && link.target !== "_self")) return;
    const destination = document.getElementById(id);
    if (!destination) return;
    event.preventDefault();
    requestAnimationFrame(() => {
      const header = root.current?.querySelector<HTMLElement>(".sela-header-wrap");
      if (header) root.current?.style.setProperty("--navigation-height", `${header.getBoundingClientRect().height}px`);
      const heading = destination.querySelector<HTMLElement>("h1,h2,h3");
      const target = heading ?? destination;
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
      }
      target.focus({ preventScroll: true });
      destination.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    });
  }
  return <div className="senja-site" ref={root} onClick={navigate}>{children}</div>;
}
