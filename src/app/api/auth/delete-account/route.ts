import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

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
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            console.error("SUPABASE_SERVICE_ROLE_KEY is not defined");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        // Initialize admin client with service role key
        const adminAuthClient = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        // Get user profile to check for Stripe customer ID
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

        // Delete the user from Supabase Auth (cascades to DB tables via FK)
        const { error: deleteError } = await adminAuthClient.auth.admin.deleteUser(
            user.id
        );

        if (deleteError) {
            console.error("Error deleting user:", deleteError);
            return NextResponse.json(
                { error: "Failed to delete account" },
                { status: 500 }
            );
        }

        return NextResponse.json({ message: "Account deleted successfully" });
    } catch (error) {
        console.error("Internal server error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
