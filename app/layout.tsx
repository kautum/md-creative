import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

// The design calls for Halyard Display (paid); Inter is its listed substitute.
// globals.css switches on the "ss01" stylistic set it was measured with.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MD Creative 2.0",
  description:
    "One product in, a whole campaign out — AI social content for mdlondon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SiteNav />
        {/* Edge serial — the product-artifact label running down the margin. */}
        <span
          aria-hidden
          className="label-sm pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 lg:block"
          style={{ writingMode: "vertical-rl", color: "var(--cream-50)" }}
        >
          MD CREATIVE — 2.0 — FOR MDLONDON
        </span>
        <main>{children}</main>
      </body>
    </html>
  );
}
