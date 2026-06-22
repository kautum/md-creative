import type { Metadata } from "next";
import { Jost, Hanken_Grotesk, Quicksand } from "next/font/google";
import "./globals.css";

// mdlondon uses Co-Headline (geometric) for headings and Niveau-Grotesk
// (humanist grotesk) for body — both paid. Jost and Hanken Grotesk are the
// closest free Google Fonts matches. The variable classes are applied to
// <html>; globals.css wires them into body + headings. Jost (light, wide-
// tracked) also carries the editorial masthead.
const heading = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-heading",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-body",
});

// Wordmark font. mdlondon's actual "mdlondon." mark is a SOFT ROUNDED UPRIGHT
// sans with a coral period (observed on mdlondon.com — NOT the italic serif the
// brief guessed). Quicksand is the closest free match to that rounded-humanist
// character, so "md creative." reads as a sibling of "mdlondon.".
const brand = Quicksand({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "MD Creative",
  description: "AI-powered social content generator for mdlondon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} ${brand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Masthead — mdlondon's slate-green dark bar; the orange top rule is
            gone (it clashed with the near-black look the brief described and the
            slate-green is striking on its own). */}
        <header
          className="w-full flex flex-row items-baseline justify-between py-5 px-8"
          style={{
            backgroundColor: "var(--bg-dark)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Wordmark — lowercase rounded sans + coral period, echoing
              "mdlondon." (the period is a deliberate brand mark, coloured to
              match mdlondon's own coral full-stop). */}
          <span
            style={{
              fontFamily: "var(--font-brand), system-ui, sans-serif",
              fontSize: "clamp(1.6rem, 3vw, 2.4rem)",
              fontWeight: 500,
              letterSpacing: "0.02em",
              color: "var(--text-on-dark)",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            md creative<span style={{ color: "var(--accent)" }}>.</span>
          </span>
          <span
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontWeight: 400,
              fontSize: "0.7rem",
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            for mdlondon · by kautum
          </span>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
