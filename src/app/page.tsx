import Link from "next/link";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { ProductDemo } from "@/components/landing/product-demo";
import { ROICalculator } from "@/components/landing/roi-calculator";
import { BentoFeatures } from "@/components/landing/bento-features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FounderNote } from "@/components/landing/founder-note";
import { PricingCards } from "@/components/landing/pricing-cards";
import { Faq } from "@/components/landing/faq";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

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
              "description": "VibeVaults is a visual feedback widget for websites. The feedback tool for modern agencies: collect visual feedback directly on live client sites, share progress, and ship faster.",
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
              VibeVaults is a visual feedback widget for websites. Clients comment right on the live site. No logins, no browser extensions, and you never pay per client. Send a link, they start marking up, you ship faster.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Link href="/auth/register" className="inline-flex items-center justify-center px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0">
                Claim your founding member spot
              </Link>
              <Link href="#demo" className="inline-flex items-center justify-center px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 border-2 border-gray-200 text-gray-700 hover:border-primary hover:text-primary hover:shadow-lg hover:-translate-y-1 active:translate-y-0">
                See it in action
              </Link>
            </div>
            <div className="flex justify-center mb-20">
              <a
                href="https://www.uneed.best/tool/vibevaults"
                target="_blank"
                className="inline-flex items-center hover:opacity-80 transition-opacity"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://www.uneed.best/EMBED1B.png"
                  alt="VibeVaults is featured on Uneed"
                  className="h-12 w-auto"
                />
              </a>
            </div>
          </div>
        </section>

        {/* Product Demo (video + screenshots) */}
        <div id="demo">
          <ProductDemo
            videoUrl="https://www.youtube-nocookie.com/embed/Zeaf79Idd-U?rel=0&modestbranding=1&autoplay=1&mute=1&playsinline=1&loop=1&playlist=Zeaf79Idd-U"
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

        {/* FAQ */}
        <Faq />
      </main>

      <SiteFooter />
    </div>
  );
}
