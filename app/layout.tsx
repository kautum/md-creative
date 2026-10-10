import type { Metadata, Viewport } from "next";
import { Figtree, Krona_One } from "next/font/google";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

// mdlondon.com sets headlines in Dallas (an extended geometric display face)
// and text in Niveau Grotesk and Figtree. Dallas and Niveau are licensed to
// mdlondon, so we don't copy them: Krona One is the closest free extended
// geometric to Dallas, and Figtree is the free face mdlondon itself uses.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-figtree",
});

const krona = Krona_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-krona",
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

export const viewport: Viewport = { themeColor: "#f4efe6" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${krona.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SiteNav />
        {/* Edge serial — the product-artifact label running down the margin. */}
        <span
          aria-hidden
          className="label-sm pointer-events-none fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 lg:block"
          style={{ writingMode: "vertical-rl", color: "var(--fg-50)" }}
        >
          MD CREATIVE — 3.5 — BY KPK
        </span>
        <main>{children}</main>
      </body>
    </html>
  );
}
