import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Redline — Production Agent Control Plane",
  description: "Evidence-backed human authorization for consequential production actions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
