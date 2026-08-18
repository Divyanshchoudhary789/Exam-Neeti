import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://examneeti.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Exam Neeti — NEET Test Portal & Analytics",
    template: "%s | Exam Neeti",
  },
  description:
    "Exam Neeti is an advanced NEET preparation platform featuring sprint-based test series, 69-formula diagnostic analytics, and AI-driven selection probability scoring.",
  keywords: [
    "NEET",
    "NEET exam preparation",
    "NEET test series",
    "NEET analytics",
    "NEET coaching",
    "NEET mock tests",
    "NEET selection probability",
    "exam diagnostics",
  ],
  authors: [{ name: "Exam Neeti", url: APP_URL }],
  creator: "Exam Neeti",
  publisher: "Exam Neeti",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: APP_URL,
    siteName: "Exam Neeti",
    title: "Exam Neeti — NEET Test Portal & Analytics",
    description:
      "Sprint-based NEET test series with 69-formula diagnostic analytics and AI-driven selection probability scoring. Every Score Has a Strategy.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Exam Neeti — Every Score Has a Strategy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Exam Neeti — NEET Test Portal & Analytics",
    description:
      "Sprint-based NEET test series with diagnostic analytics and selection probability scoring.",
    images: ["/og-image.png"],
    creator: "@examneeti",
  },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "https://iili.io/Clw9yIj.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)",  color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden w-full max-w-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
