import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-4 border-b border-gray-200 flex justify-between items-center">
        <span className="font-bold text-xl text-indigo-600">VibeVault.</span>
        <div className="flex gap-4">
          <Link href="/login" className="text-sm font-medium px-4 py-2 text-gray-700 hover:text-gray-900">Sign In</Link>
          <Link href="/login" className="inline-flex items-center justify-center px-4 py-2 rounded-md font-medium text-sm transition-colors bg-indigo-600 text-white hover:bg-indigo-500">
            Get Started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
        <h1 className="text-6xl font-extrabold leading-tight mb-6 max-w-4xl text-gray-900">
          Keep your users in the loop with <span className="text-indigo-600">VibeVault</span>.
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mb-10">
          The simplest way to announce product updates and collect feedback directly from your website.
        </p>
        <div className="flex gap-4">
          <Link href="/login" className="inline-flex items-center justify-center px-6 py-3 rounded-md font-medium text-base transition-colors bg-indigo-600 text-white hover:bg-indigo-500">
            Start Free Trial
          </Link>
          <a href="#" className="inline-flex items-center justify-center px-6 py-3 rounded-md font-medium text-base transition-colors bg-white border border-gray-200 text-gray-700 hover:bg-gray-50">
            View Demo
          </a>
        </div>
      </main>
    </div>
  );
}
