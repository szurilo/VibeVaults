import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

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
            <Link href="#pricing" className="text-sm font-semibold text-gray-600 hover:text-primary transition-all duration-200">
              Pricing
            </Link>
          </nav>
          <div className="flex gap-2 md:gap-4 items-center flex-1 justify-end">
            <Link href="/login" className="text-sm font-semibold px-3 py-2 md:px-4 text-gray-700 hover:text-gray-900 transition-colors whitespace-nowrap">
              Sign In
            </Link>
            <Link href="/register" className="inline-flex items-center justify-center px-4 py-2 md:px-5 md:py-2.5 rounded-full font-bold text-sm transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center">
        <section className="flex flex-col items-center justify-center py-24 px-4 text-center max-w-5xl">
          <h1 className="text-7xl font-extrabold tracking-tight leading-none mb-8 text-gray-900">
            Collect feedback. <span className="text-primary">Make customers happy.</span>
          </h1>
          <p className="text-2xl text-gray-500 max-w-3xl mb-12 leading-relaxed">
            An easy way to collect and manage customer feedback. Build better products with VibeVaults' powerful insights.
          </p>
          <div className="flex gap-6">
            <Link href="/register" className="inline-flex items-center justify-center px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 bg-secondary text-white hover:bg-secondary/90 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0">
              Get Started
            </Link>
          </div>
        </section>

        <section id="features" className="py-32 bg-gray-50 w-full flex flex-col items-center">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <h2 className="text-5xl font-extrabold mb-6">Everything you need</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-16">
              VibeVaults provides all the tools you need to understand your customers and improve your product.
            </p>
            <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Fast Collection</h3>
                <p className="text-gray-500">Add our lightweight widget to your site in seconds and start collecting feedback immediately.</p>
              </div>
              <div className="p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 text-secondary">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-xl font-bold mb-4">Deep Insights</h3>
                <p className="text-gray-500">Analyze feedback with our powerful dashboard and identify key areas for improvement.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-32 w-full flex flex-col items-center">
          <div className="max-w-7xl mx-auto px-8 text-center">
            <h2 className="text-5xl font-extrabold mb-6">Simple Pricing</h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-16">
              For everybody.
            </p>
            <div className="max-w-md mx-auto">
              {/* Pro Pricing Card */}
              <div className="p-10 bg-white rounded-3xl border-2 border-primary shadow-xl relative">
                {/* <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase">Popular</div> */}
                {/* <h3 className="text-xl font-bold mb-2">Pro</h3> */}
                <div className="text-4xl font-extrabold mb-6">$9<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                <ul className="text-left space-y-4 mb-10 text-gray-600">
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Unlimited Feedback</li>
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Custom Domain</li>
                  <li className="flex items-center gap-2"><svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg> Priority Support</li>
                </ul>
                <Link href="/register" className="block w-full py-4 px-6 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">Get started</Link>
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
