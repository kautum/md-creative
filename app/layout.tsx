import type { Metadata, Viewport } from "next";
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

const DESCRIPTION =
  "One product in, a whole campaign out — on-brand copy, a scene and feed previews for mdlondon. By Kautum Krishnan Panjalaraja.";

export const metadata: Metadata = {
  metadataBase: new URL("https://md-creative.vercel.app"),
  title: "MD Creative — by KPK",
  description: DESCRIPTION,
  // Share links (#c=…) unfurl with this card in WhatsApp, Slack and iMessage.
  openGraph: {
    title: "MD Creative — a campaign studio for mdlondon",
    description: DESCRIPTION,
    siteName: "MD Creative",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#141413" };

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
          style={{ writingMode: "vertical-rl", color: "var(--fg-50)" }}
        >
          MD CREATIVE — 3.2 — BY KPK
        </span>
        <main>{children}</main>
      </body>
    </html>
  );
}
