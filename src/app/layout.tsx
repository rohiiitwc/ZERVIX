import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Holographic3DBackground } from "@/components/background/Holographic3DBackground";
import { HolographicSectionFX } from "@/components/background/HolographicSectionFX";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZERVIX — AI-Powered Data Privacy & PII Sanitization Platform",
  description:
    "Your Data. Your Privacy. Your Control. Local browser PII detection, intelligent sanitization, audit reporting, and AI privacy guidance.",
  icons: {
    icon: [{ url: "/zervix-logo.svg", type: "image/svg+xml" }],
    shortcut: ["/zervix-logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("zervix-color-scheme");var m=document.querySelector('meta[name="color-scheme"]');var sys=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";var e=(t==="light"||t==="dark")?t:(t==="system"?sys:"dark");document.documentElement.dataset.theme=e;if(m){m.content=e;}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg-main)] text-[var(--text-primary)] zervix-ambient-bg">
        <Holographic3DBackground />
        <HolographicSectionFX />
        {children}
      </body>
    </html>
  );
}
