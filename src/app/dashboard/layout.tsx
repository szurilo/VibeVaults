import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

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
    const cookie = cookieStore.get("sidebar_state");
    const defaultOpen = cookie ? cookie.value === "true" : true;

    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar
                projects={projects || []}
                selectedProjectId={selectedProjectId}
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
    );
}
