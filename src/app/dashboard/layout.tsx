import Link from "next/link";
import "./dashboard.css"; // Local styles for dashboard layout

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="dashboard-layout">
            <aside className="dashboard-sidebar">
                <div className="sidebar-header">
                    <span className="logo">Clog.</span>
                </div>
                <nav className="sidebar-nav">
                    <Link href="/dashboard" className="nav-item">Overview</Link>

                    <Link href="/dashboard/feedback" className="nav-item">Feedback</Link>
                    <Link href="/dashboard/settings" className="nav-item">Settings</Link>
                </nav>
                <div className="sidebar-footer">
                    <Link href="/api/auth/signout" className="nav-item">Sign Out</Link>
                </div>
            </aside>
            <main className="dashboard-main">
                {children}
            </main>
        </div>
    );
}
