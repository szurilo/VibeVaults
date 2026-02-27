import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendWelcomeNotification } from "@/lib/notifications";

export async function POST() {
    try {
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user || !user.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('welcome_email_sent')
            .eq('id', user.id)
            .single();

        if (profile?.welcome_email_sent) {
            return NextResponse.json({ success: true, message: "Welcome email already sent." });
        }

        // Mark as sent immediately to avoid race conditions
        await supabase
            .from('profiles')
            .update({ welcome_email_sent: true })
            .eq('id', user.id);

        const nameStr = user.email.split('@')[0];
        const formattedName = nameStr.charAt(0).toUpperCase() + nameStr.slice(1);

        const { data, error: sendError } = await sendWelcomeNotification({
            to: user.email,
            name: formattedName
        });

        if (sendError) {
            console.error('Failed to schedule welcome email:', sendError);
            const errMsg = (sendError as any).message || 'Failed to schedule email';
            return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Welcome email scheduled." });
    } catch (e) {
        console.error('Error in welcome route:', e);
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
