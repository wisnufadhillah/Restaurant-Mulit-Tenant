"use client";

import { useRef } from "react";

export default function ChatbotWidget() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { dialog.current?.close(); trigger.current?.focus(); };
  return <>
    <button ref={trigger} className="senja-text-button senja-assistant-trigger" type="button" onClick={() => dialog.current?.showModal()}>Tanya restoran</button>
    <dialog className="senja-dialog" ref={dialog} onClose={() => trigger.current?.focus()} aria-labelledby="assistant-heading" aria-describedby="assistant-description">
      <div className="senja-dialog-heading"><span>Dapur Sela / Asisten restoran</span><button className="senja-text-button" type="button" onClick={close}>Tutup <span aria-hidden="true">×</span></button></div>
      <p className="senja-eyebrow">ASISTEN RESTORAN</p>
      <h2 id="assistant-heading">Kembali sebentar lagi.</h2>
      <p id="assistant-description">Asisten belum tersedia. Kamu tetap bisa menjelajahi contoh hidangan tanpa mengirim pesan atau data pribadi.</p>
      <a className="senja-text-link" href="#menu" onClick={close}>Lihat menu</a>
    </dialog>
  </>;
}
