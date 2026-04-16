import type { Metadata, Viewport } from "next"
import "@/styles/globals.css"
import { Manrope, Geist_Mono } from "next/font/google"
import { cn } from "@/lib/utils"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

const TITLE = "Kova — API Payments for the Agent Economy"
const SITE_DESCRIPTION =
  "Protect your APIs behind x402 paywalls settled on Stellar. Sub-cent micropayments, 5-second finality."
const SITE_URL = "https://kova.vercel.app" // Buy domain: https://onkova.com
const SITE_KEYWORDS =
  "api payments, api monetization, payment gateway, micropayments, stellar blockchain, x402 protocol, usdc stablecoin, soroban smart contracts, cryptocurrency payments, ai agent payments, payment verification, real-time settlement, api protection, developer platform, pay-per-request, payment integration, subscription alternative, usage-based pricing, payment processing, revenue generation, api security, intelligent agents"

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: `%s | ${TITLE}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: TITLE,
  robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  openGraph: {
    type: "website",
    title: TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL || undefined,
    siteName: TITLE,
    images: SITE_URL ? [{ url: `${SITE_URL}/og-image.jpg` }] : undefined,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: SITE_URL ? [`${SITE_URL}/og-image.jpg`] : undefined,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": TITLE,
    "msapplication-TileColor": "#0070F3",
    "msapplication-tooltip": SITE_DESCRIPTION,
    "msapplication-starturl": SITE_URL,
    "revisit-after": "7 days",
    language: "Spanish",
    googlebot: "index, follow",
  },
}

export const viewport: Viewport = {
  themeColor: "#0070F3",
  colorScheme: "light dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", manrope.variable, geistMono.variable)}>
      <body>{children}</body>
    </html>
  )
}
