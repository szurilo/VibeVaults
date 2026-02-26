import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalNotificationProvider } from "@/components/GlobalNotificationProvider";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/auth/login");
    }

    const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

    const cookieStore = await cookies();
    let selectedProjectId = cookieStore.get("selectedProjectId")?.value;

    // If no selected project in cookie, or project no longer exists, default to the first one
    if (projects && projects.length > 0) {
        if (!selectedProjectId || !projects.some(p => p.id === selectedProjectId)) {
            selectedProjectId = projects[0].id;
        }
    }

    const cookie = cookieStore.get("sidebar_state");
    const defaultOpen = cookie ? cookie.value === "true" : true;

    return (
        <GlobalNotificationProvider userId={user.id}>
            <SidebarProvider defaultOpen={defaultOpen}>
                <AppSidebar
                    projects={projects || []}
                    selectedProjectId={selectedProjectId}
                    userId={user.id}
                />
                <main className="flex-1 overflow-y-auto bg-gray-50 flex flex-col">
                    <div className="p-4 bg-white border-b border-gray-200 md:hidden flex items-center gap-2">
                        <SidebarTrigger />
                        <span className="font-bold text-lg text-primary">VibeVaults</span>
                    </div>
                    {/* On desktop we might want the trigger or just rely on the sidebar state? 
                        Usually the sidebar remains open on desktop. 
                        Let's just put the trigger for mobile usage primarily, as requested.
                    */}
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </SidebarProvider>
        </GlobalNotificationProvider>
    );
}
