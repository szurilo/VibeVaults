import Link from "next/link";

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: 'var(--space-4) var(--space-8)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--brand-600)' }}>VibeVault.</span>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/login" style={{ fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>Sign In</Link>
          <Link href="/login" className="btn btn-primary">Get Started</Link>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.5rem', maxWidth: '800px' }}>
          Keep your users in the loop with <span style={{ color: 'var(--brand-600)' }}>VibeVault</span>.
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', marginBottom: '2.5rem' }}>
          The simplest way to announce product updates and collect feedback directly from your website.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/login" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
            Start Free Trial
          </Link>
          <a href="#" className="btn" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '1rem', padding: '0.75rem 1.5rem' }}>
            View Demo
          </a>
        </div>
      </main>
    </div>
  );
}
