import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raso Minang — Warisan Cita Rasa Autentik Minangkabau",
  description: "Nikmati kelezatan masakan Padang autentik dengan rendang tungku kayu bakar, ayam pop khas, dan gulai kakap merah segar. Reservasi meja dan konsultasi menu online.",
  keywords: ["Raso Minang", "Restoran Padang", "Masakan Minang", "Rendang Daging Sapi", "Ayam Pop", "Reservasi Meja Restoran", "Depok", "Jakarta"],
  openGraph: {
    title: "Raso Minang — Masakan Padang Autentik",
    description: "Warisan Cita Rasa Autentik Minangkabau di Setiap Suapan. Buka setiap hari.",
    type: "website",
    locale: "id_ID"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
