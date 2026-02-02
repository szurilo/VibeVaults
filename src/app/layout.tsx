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

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const viewport: Viewport = {
  themeColor: "#209CEE",
}

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  alternates: {
    canonical: '/',
  },
  title: {
    default: "VibeVaults - Collect and Manage Customer Feedback",
    template: "%s | VibeVaults"
  },
  description: "Collect and manage customer feedback with VibeVaults. The easiest way to get insights and build better products.",
  keywords: ["customer feedback", "feedback widget", "SaaS insights", "user feedback", "VibeVaults"],
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
    title: "VibeVaults - Collect and Manage Customer Feedback",
    description: "Collect and manage customer feedback with VibeVaults. Build better products with powerful insights.",
    images: [
      {
        url: "/og-image.png", // We should probably generate this or remind the user to add it
        width: 1200,
        height: 630,
        alt: "VibeVaults - Feedback Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeVaults - Feedback Management",
    description: "Collect and manage customer feedback with VibeVaults. Build better products with powerful insights.",
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
        <script src="/widget.js" data-key="e3917e214418009aea8b7a2712cb0059"></script>
      </body>
    </html>
  );
}
