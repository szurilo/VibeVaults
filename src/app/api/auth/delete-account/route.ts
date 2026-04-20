import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { cleanupWorkspaceStorage } from "@/lib/storage-cleanup";
import { notifyOwnerMemberDeparted } from "@/lib/workspace-notifications";

export async function DELETE() {
    const supabase = await createClient();

    // Check if user is authenticated
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();

        if (!secretKey) {
            console.error("SUPABASE_SECRET_KEY is not defined");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        // Initialize admin client using centralized helper
        const adminAuthClient = createAdminClient();

        // Get user profile to check for Stripe customer ID
        // Note: Using the specific current user ID for safety
        const { data: profile } = await adminAuthClient
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", user.id)
            .single();

        // Delete Stripe customer if exists
        if (profile?.stripe_customer_id) {
            try {
                await stripe.customers.del(profile.stripe_customer_id);
            } catch (stripeError) {
                console.error("Error deleting Stripe customer:", stripeError);
                // Continue with account deletion even if Stripe fails
            }
        }

        // Delete email_preferences (keyed by email, not user_id, so no FK cascade)
        await adminAuthClient
            .from("email_preferences")
            .delete()
            .eq("email", user.email);

        // Clean up storage files for owned workspaces before cascade deletes DB records
        const { data: ownedWorkspaces } = await adminAuthClient
            .from("workspaces")
            .select("id")
            .eq("owner_id", user.id);

        if (ownedWorkspaces) {
            for (const workspace of ownedWorkspaces) {
                await cleanupWorkspaceStorage(adminAuthClient, workspace.id);
            }
        }

        // Notify owners of any workspaces this user is a (non-owner) member of
        // before the cascade deletes the membership rows.
        const { data: memberships } = await adminAuthClient
            .from("workspace_members")
            .select("workspace_id, workspaces(name, owner_id)")
            .eq("user_id", user.id)
            .neq("role", "owner");

        if (memberships && memberships.length > 0) {
            const memberName = user.email?.split("@")[0] || "A member";
            await Promise.all(
                memberships.map(async (m) => {
                    const ws = (Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces) as
                        | { name: string | null; owner_id: string | null }
                        | null;
                    if (!ws?.owner_id) return;
                    await notifyOwnerMemberDeparted({
                        workspaceId: m.workspace_id,
                        workspaceName: ws.name || "Unknown workspace",
                        ownerId: ws.owner_id,
                        memberName,
                        reason: "account_deleted"
                    });
                })
            );
        }

        // Delete the user from Supabase Auth (cascades to DB tables via FK)
        // This is where the admin privileges are required
        const { error: deleteError } = await adminAuthClient.auth.admin.deleteUser(
            user.id
        );

        if (deleteError) {
            console.error("Error deleting user from Auth:", deleteError);
            return NextResponse.json(
                {
                    error: "Failed to delete account",
                    details: deleteError.message,
                    code: deleteError.status
                },
                { status: deleteError.status || 500 }
            );
        }

        return NextResponse.json({ message: "Account deleted successfully" });
    } catch (error) {
        console.error("Internal server error in delete-account:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
