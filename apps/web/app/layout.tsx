import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Restoran", description: "Informasi dan layanan restoran" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="id"><body>{children}</body></html>;
}
