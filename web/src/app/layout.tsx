import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/Footer";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://gowes-gaskeun.aaaiiimmm.dev"),
  title: {
    default: "Gowes Gaskeun — Critical Mass Makassar",
    template: "%s | Gowes Gaskeun",
  },
  description: "Komunitas pesepeda Makassar. Bergerak Bersama, Merayakan Kota.",
  keywords: ["gowes", "makassar", "critical mass", "sepeda makassar", "komunitas sepeda", "gowes gaskeun"],
  authors: [{ name: "Gowes Gaskeun" }],
  creator: "Gowes Gaskeun",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Gowes Gaskeun — Critical Mass Makassar",
    description: "Komunitas pesepeda Makassar. Bergerak Bersama, Merayakan Kota.",
    url: "https://gowes-gaskeun.aaaiiimmm.dev",
    siteName: "Gowes Gaskeun",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Gowes Gaskeun Logo",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gowes Gaskeun — Critical Mass Makassar",
    description: "Komunitas pesepeda Makassar. Bergerak Bersama, Merayakan Kota.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="afterInteractive" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Footer />
      </body>
    </html>
  );
}
