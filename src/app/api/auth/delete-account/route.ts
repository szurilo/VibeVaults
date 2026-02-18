import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
