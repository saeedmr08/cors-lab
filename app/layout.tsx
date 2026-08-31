import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "CORS Lab — Saeed Rumaneh",
  description:
    "Interactive educational CORS simulator: preflight vs actual requests, Allow/Deny rules, synthetic demos only.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body
        style={
          {
            ["--display" as string]: "var(--font-display), Palatino, serif",
            ["--sans" as string]: "var(--font-sans), Segoe UI, sans-serif",
            ["--mono" as string]:
              "var(--font-mono), ui-monospace, Menlo, monospace",
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
