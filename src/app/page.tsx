import Link from "next/link";
import { UserFlowAnimation } from "@/components/landing/UserFlowAnimation";
import { HowItWorks } from "@/components/landing/HowItWorks";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="w-full bg-yellow-50 border-b border-yellow-100 text-yellow-800 px-4 py-2 text-center text-sm font-medium">
        🚧 This product is under active development
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
            <Link href="#pricing" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
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
                "@type": "Offer",
                "price": "49.00",
                "priceCurrency": "USD"
              }
            })
          }}
        />
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
                Start your 14-day free trial
              </Link>
            </div>
          </div>

          <div className="w-full mt-8">
            <UserFlowAnimation />
          </div>
        </section>

        <section id="features" className="py-32 bg-gray-50 w-full flex flex-col items-center">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <h2 className="text-5xl font-extrabold mb-6">Built for agency velocity</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-16">
              Stop deciphering "make the logo bigger" from cropped PDFs. Give your clients a friction-free way to point, click, and leave feedback exactly where it belongs.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto text-left">
              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">One-Click Install</h3>
                <p className="text-gray-500 flex-1">Drop a single script tag into WordPress, Webflow, Shopify, or React. Zero complex setup, and your clients don't even need to create an account.</p>
              </div>

              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6 text-orange-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Point, Pin & Screenshot</h3>
                <p className="text-gray-500 flex-1">Clients can pin their feedback directly on any screen element. We automatically snap a screenshot and collect essential metadata (browser, OS, screen size), giving you pixel-perfect technical context instantly.</p>
              </div>

              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6 text-green-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Real-Time Discussions</h3>
                <p className="text-gray-500 flex-1">Turn feedback into conversation. Chat with clients contextually right on the page, with messages and status updates syncing instantly.</p>
              </div>

              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 text-purple-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Interactive Feedbacks Tab</h3>
                <p className="text-gray-500 flex-1">Keep everyone aligned. All client stakeholders can see ongoing discussions and participate directly from the widget, preventing duplicate requests.</p>
              </div>

              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 text-secondary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Public Dashboard for Stakeholders</h3>
                <p className="text-gray-500 flex-1">Need to update a wider team? Share a dedicated, project-wide dashboard where stakeholders can track the status of all feedback and revisions at a glance.</p>
              </div>

              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Unlimited Projects</h3>
                <p className="text-gray-500 flex-1">Manage 5 or 50 client sites under one transparent flat fee. We scale with your workflow without punishing you with per-project pricing walls.</p>
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />

        <section id="pricing" className="py-32 w-full flex flex-col items-center">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <h2 className="text-5xl font-extrabold mb-6">Flat-Fee Agency Pricing</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-16">
              Grow your agency without hitting paywalls. One predictable price for all your workflow needs.
            </p>
            <div className="max-w-md mx-auto">
              <div className="p-10 bg-white rounded-3xl border-2 border-primary shadow-xl relative transform hover:scale-105 transition-transform duration-300">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-6 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase shadow-lg">Agency Plan</div>
                <div className="text-4xl font-extrabold mb-8">$49<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                <ul className="text-left space-y-4 mb-10 text-gray-600">
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> <strong>Unlimited</strong> Projects & Websites</li>
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> <strong>Unlimited</strong> Feedback & Clients</li>
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Public Dashboard for Stakeholders</li>
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Direct Partner Support from Founders</li>
                </ul>
                <Link href="/auth/register" className="block w-full py-4 px-6 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">Get started now</Link>
                <p className="text-[10px] text-gray-400 mt-4 uppercase tracking-tighter font-semibold">14-day free trial • No credit card required</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 w-full border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-gray-500">
            © {new Date().getFullYear()} VibeVaults. All rights reserved.
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
