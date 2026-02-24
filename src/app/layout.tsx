import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const defaultUrl = "https://www.vibe-vaults.com";

export const viewport: Viewport = {
  themeColor: "#209CEE",
}

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  alternates: {
    canonical: '/',
  },
  title: {
    default: "VibeVaults - The Feedback Tool for Modern Agencies",
    template: "%s | VibeVaults"
  },
  description: "Collect visual feedback, share progress with clients, and ship faster. The feedback tool designed specifically for freelancers and agencies.",
  keywords: [
    "agency feedback tool",
    "freelancer feedback",
    "client feedback tool",
    "visual feedback",
    "VibeVaults",
    "web design feedback",
    "website feedback widget",
    "feedback widget",
    "client feedback software",
    "client collaboration tool",
    "client revision tracking",
    "embeddable feedback widget",
    "website review tool for agencies",
    "collect feedback on website",
    "web agency tools",
  ],
  authors: [{ name: "VibeVaults Team" }],
  creator: "VibeVaults",
  publisher: "VibeVaults",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: defaultUrl,
    siteName: "VibeVaults",
    title: "VibeVaults - The Feedback Tool for Modern Agencies",
    description: "Stop the endless email chains. Collect visual feedback, share progress with clients, and ship faster with VibeVaults.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VibeVaults - Feedback Tool for Agencies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeVaults - The Feedback Tool for Modern Agencies",
    description: "Stop the endless email chains. Collect visual feedback, share progress with clients, and ship faster with VibeVaults.",
    images: ["/og-image.png"],
    creator: "@vibevaults",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
