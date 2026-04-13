import Link from "next/link";
import { ProductDemo } from "@/components/landing/product-demo";
import { ROICalculator } from "@/components/landing/roi-calculator";
import { BentoFeatures } from "@/components/landing/bento-features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FounderNote } from "@/components/landing/founder-note";
import { PricingCards } from "@/components/landing/pricing-cards";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Beta exclusivity banner */}
      <div className="w-full bg-gradient-to-r from-primary to-secondary text-white px-4 py-2.5 text-center text-sm font-semibold tracking-wide">
        Early Access — Limited founding member spots.{" "}
        <Link
          href="/auth/register"
          className="underline underline-offset-2 hover:no-underline font-bold"
        >
          Claim 50% off now
        </Link>
      </div>

      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="px-4 md:px-8 py-4 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex-1">
            <Link href="/" className="font-bold text-xl md:text-2xl tracking-tight text-primary hover:opacity-90 transition-opacity whitespace-nowrap">
              VibeVaults
            </Link>
          </div>
          <nav className="hidden md:flex gap-8 flex-1 justify-center">
            <Link href="#features" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
              How it works
            </Link>
            <Link href="/pricing" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
              Pricing
            </Link>
          </nav>
          <div className="flex gap-2 md:gap-4 items-center flex-1 justify-end">
            <Link href="/auth/login" className="text-sm font-semibold px-3 py-2 md:px-4 text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap">
              Sign In
            </Link>
            <Link href="/auth/register" className="inline-flex items-center justify-center px-4 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-sm transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "VibeVaults",
              "operatingSystem": "Web",
              "applicationCategory": "BusinessApplication",
              "description": "The feedback tool for modern agencies. Collect visual feedback, share progress with clients, and ship faster with VibeVaults.",
              "offers": {
                "@type": "AggregateOffer",
                "lowPrice": "29.00",
                "highPrice": "149.00",
                "priceCurrency": "USD",
                "offerCount": 3
              }
            })
          }}
        />

        {/* Hero */}
        <section className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-7xl mx-auto">
          <div className="max-w-4xl">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-none mb-8 text-gray-900">
              Ship client sites faster without the <span className="text-primary font-black italic">feedback chaos.</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-500 max-w-3xl mb-12 leading-relaxed mx-auto">
              Ditch the endless email threads, scattered Slack messages, and vague screenshots. Collaborate with clients directly on their live website and hit your deadlines.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Link href="/auth/register" className="inline-flex items-center justify-center px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0">
                Claim your founding member spot
              </Link>
              <Link href="#demo" className="inline-flex items-center justify-center px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 border-2 border-gray-200 text-gray-700 hover:border-primary hover:text-primary hover:shadow-lg hover:-translate-y-1 active:translate-y-0">
                See it in action
              </Link>
            </div>
          </div>
        </section>

        {/* Product Demo (video + screenshots) */}
        <div id="demo">
          <ProductDemo
            videoUrl="https://www.youtube-nocookie.com/embed/7Zghfanxtug?rel=0&modestbranding=1&autoplay=1&mute=1&playsinline=1&loop=1&playlist=7Zghfanxtug"
          />
        </div>

        {/* Bento Feature Grid */}
        <BentoFeatures />

        {/* How It Works */}
        <HowItWorks />

        {/* Founder Note & Social Proof */}
        <FounderNote />

        {/* ROI Calculator — right before pricing for final justification */}
        <ROICalculator />

        {/* Pricing */}
        <section id="pricing" className="py-32 w-full flex flex-col items-center bg-gray-50">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <h2 className="text-5xl font-extrabold mb-6">Simple, Transparent Pricing</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-16">
              Choose the plan that fits your team. Scale up as you grow.
            </p>
            <PricingCards
              ctaLabel="Claim your founding member spot"
              staticCtaHref="/auth/register"
              showTrialNote={true}
            />
            <Link
              href="/pricing#comparison"
              className="inline-flex items-center gap-1.5 mt-8 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
            >
              Compare all features
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 w-full border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} VibeVaults. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm font-medium text-gray-600">
            <Link href="/terms-of-service" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy-policy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
