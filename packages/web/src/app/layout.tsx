import type { Metadata } from "next"
import "@/styles/globals.css"
import { Manrope, Geist_Mono } from "next/font/google"
import { cn } from "@/lib/utils"

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Kova — API Payments for the Agent Economy",
  description: "Protect your APIs behind x402 paywalls settled on Stellar. Sub-cent micropayments, 5-second finality.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", manrope.variable, geistMono.variable)}>
      <body>{children}</body>
    </html>
  )
}
