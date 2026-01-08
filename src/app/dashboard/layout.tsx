import Link from "next/link";
// Removed: import "./dashboard.css";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-6 border-b border-gray-200">
                    <span className="font-bold text-xl text-indigo-600">VibeVault.</span>
                </div>
                <nav className="p-4 flex-1 flex flex-col gap-1">
                    <Link href="/dashboard" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">Overview</Link>

                    <Link href="/dashboard/feedback" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">Feedback</Link>
                    <Link href="/dashboard/settings" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">Settings</Link>
                </nav>
                <div className="p-4 border-t border-gray-200">
                    <Link href="/api/auth/signout" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">Sign Out</Link>
                </div>
            </aside>
            <main className="flex-1 p-8 overflow-y-auto">
                {children}
            </main>
        </div>
    );
} 
