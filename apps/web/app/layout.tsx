import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./senja.css";
import "./chat.css";

export const metadata: Metadata = {
  title: "Dapur Sela — Ada sela, ada cerita, ada makan.",
  description: "Dapur Sela, rumah makan di Cikini. Konsep demo nasi Padang, lauk Minang, informasi kunjungan dan bantuan reservasi.",
  keywords: ["Dapur Sela", "Nasi Padang", "Masakan Minang", "Cikini"],
  openGraph: {
    title: "Dapur Sela",
    description: "Ada sela, ada cerita, ada makan.",
    type: "website",
    locale: "id_ID"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
