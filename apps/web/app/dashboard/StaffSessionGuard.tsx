"use client";
import { useEffect } from "react";
import { endStaffSession, staffFetch, staffSessionInvalid, STAFF_SESSION_ENDED } from "./staff-fetch";

export default function StaffSessionGuard({ onExpired, validUntil }: { onExpired: () => void; validUntil: number }) {
  useEffect(() => {
    let disposed = false, checking = false, posting = false, lastSent = -Infinity;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let knownDeadline = validUntil;
    function armDeadline() {
      clearTimeout(deadlineTimer); clearTimeout(expiryTimer);
      deadlineTimer = setTimeout(() => { void check(); }, Math.max(0, knownDeadline - Date.now()));
      expiryTimer = setTimeout(() => { if (!disposed) endStaffSession(); }, Math.max(0, knownDeadline + 1000 - Date.now()));
    }
    async function deadline(response: Response) {
      if (!response.ok || disposed) return;
      const body = await response.json();
      if (!Number.isFinite(body.validUntil) || disposed || staffSessionInvalid()) return;
      knownDeadline = Math.max(knownDeadline, body.validUntil);
      armDeadline();
    }
    const controller = new AbortController();
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("staff-session");
    function expired() { if (!disposed) { channel?.postMessage("expired"); onExpired(); } }
    function received(event: MessageEvent) { if (event.data === "expired") endStaffSession(); }
    async function check() {
      if (checking || disposed || staffSessionInvalid()) return;
      checking = true;
      try {
        await deadline(await staffFetch("/staff/session", { cache: "no-store", signal: controller.signal }));
      } catch { /* Failure cannot renew the last server-confirmed deadline. */ }
      finally {
        checking = false;
        if (!disposed && Date.now() >= knownDeadline) endStaffSession();
      }
    }
    function wake() { if (document.visibilityState === "visible") void check(); }
    async function activity(event: Event) {
      if (!event.isTrusted || disposed || posting || document.visibilityState !== "visible" || !document.hasFocus() || performance.now() - lastSent < 60000) return;
      posting = true; lastSent = performance.now();
      try { await deadline(await staffFetch("/staff/session", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store", signal: controller.signal })); } catch { /* Next real interaction may retry; failures never renew local expiry. */ }
      finally { posting = false; }
    }
    window.addEventListener(STAFF_SESSION_ENDED, expired);
    channel?.addEventListener("message", received);
    for (const name of ["pointerdown", "keydown", "change"]) document.addEventListener(name, activity, { capture: true, passive: true });
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    const timer = window.setInterval(() => { void check(); }, 15000);
    armDeadline();
    if (staffSessionInvalid()) expired(); else void check();
    return () => {
      disposed = true; controller.abort(); window.clearInterval(timer); clearTimeout(deadlineTimer); clearTimeout(expiryTimer);
      window.removeEventListener(STAFF_SESSION_ENDED, expired);
      channel?.removeEventListener("message", received); channel?.close();
      for (const name of ["pointerdown", "keydown", "change"]) document.removeEventListener(name, activity, true);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake); window.removeEventListener("pageshow", wake);
    };
  }, [onExpired, validUntil]);
  return null;
}
