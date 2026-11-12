"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function DashboardShell({ sidebar, topbar, children, navigationKey }: { sidebar: ReactNode; topbar: ReactNode; children: ReactNode; navigationKey: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const navigating = useRef(false);
  useEffect(() => {
    setOpen(false);
    if (!navigating.current) return;
    navigating.current = false;
    document.getElementById("staff-content")?.focus();
  }, [navigationKey]);
  useEffect(() => {
    if (!open) return;
    (navigation.current?.querySelector<HTMLAnchorElement>("nav a[aria-current='page']") ?? navigation.current?.querySelector<HTMLAnchorElement>("nav a"))?.focus();
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    const desktop = window.matchMedia("(min-width: 64.001rem)");
    function resize(event: MediaQueryListEvent) { if (event.matches) setOpen(false); }
    document.addEventListener("keydown", escape);
    desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("keydown", escape); desktop.removeEventListener("change", resize); };
  }, [open]);
  return <div className="senja-site sela-admin" data-navigation-open={open}>
    <a className="senja-skip" href="#staff-content">Lewati ke konten</a>
    <header className="sela-admin-topline">
      <button ref={trigger} type="button" className="sela-admin-navigation-toggle" aria-expanded={open} aria-controls="dashboard-navigation" onClick={() => setOpen(value => !value)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={open ? "M6 6l12 12M6 18L18 6" : "M3 6h18M3 12h18M3 18h18"} /></svg>
        {open ? "Tutup navigasi" : "Buka navigasi"}
      </button>
      {topbar}
    </header>
    <aside ref={navigation} id="dashboard-navigation" className="sela-admin-sidebar" onClickCapture={event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if ((event.target as Element).closest("a") && window.matchMedia("(max-width: 64rem)").matches) {
        navigating.current = true;
        setOpen(false);
        document.getElementById("staff-content")?.focus();
      }
    }}>{sidebar}</aside>
    <div className="sela-admin-workspace">{children}</div>
  </div>;
}
