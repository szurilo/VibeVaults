import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProjectSwitcher from "@/components/ProjectSwitcher";
import { cookies } from "next/headers";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();

    if (!session || !session.user) {
        redirect("/login");
    }

    const supabase = await createClient();
    const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

    const cookieStore = await cookies();
    const selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    return (
        <div className="flex min-h-screen bg-gray-50">
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-6 border-b border-gray-200">
                    <Link href="/dashboard" className="cursor-pointer">
                        <span className="font-bold text-xl text-primary">VibeVaults</span>
                    </Link>
                </div>

                <div className="py-4 border-b border-gray-200">
                    <ProjectSwitcher
                        projects={projects || []}
                        selectedProjectId={selectedProjectId}
                    />
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
