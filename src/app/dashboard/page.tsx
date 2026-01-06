export default function DashboardPage() {
    return (
        <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '2rem' }}>Overview</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Feedback</h3>
                    <p style={{ fontSize: '2rem', fontWeight: 700 }}>0</p>
                </div>

            </div>

            <div className="card" style={{ marginTop: '2rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Get Started</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    Embed the widget on your site to start collecting feedback and displaying updates.
                </p>
                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    &lt;script src="https://clog.app/widget.js"&gt;&lt;/script&gt;
                </div>
            </div>
        </div>
    );
}
