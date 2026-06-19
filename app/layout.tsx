import type { Metadata } from "next";
import { Jost, Hanken_Grotesk } from "next/font/google";
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
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Editorial block-capitals masthead — stark, full-width. */}
        <header
          className="w-full flex flex-row items-end justify-between py-5 px-8"
          style={{
            backgroundColor: "var(--bg-dark)",
            borderTop: "4px solid #FF5C00",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-heading), system-ui, sans-serif",
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
              fontWeight: 300,
              letterSpacing: "0.38em",
              color: "#FF5C00",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            MD Creative
          </span>
          <span className="flex flex-col items-end text-right">
            <span
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 400,
                fontSize: "0.7rem",
                color: "#FFFFFF",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              For mdlondon
            </span>
            <span
              style={{
                fontFamily: "var(--font-heading), system-ui, sans-serif",
                fontWeight: 400,
                fontSize: "0.7rem",
                color: "#FFFFFF",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                opacity: 0.55,
              }}
            >
              By Kautum
            </span>
          </span>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
