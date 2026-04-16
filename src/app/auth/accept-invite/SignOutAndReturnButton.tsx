'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function SignOutAndReturnButton({ token }: { token: string }) {
    const [loading, setLoading] = useState(false);

    async function handleSignOut() {
        setLoading(true);
        const supabase = createClient();
        await supabase.auth.signOut();
        // Return to the invite page so the user can sign in with the correct email.
        window.location.href = `/auth/accept-invite?token=${encodeURIComponent(token)}`;
    }

    return (
        <Button
            type="button"
            onClick={handleSignOut}
            disabled={loading}
            className="w-full h-10"
            variant="default"
        >
            {loading ? 'Signing out...' : 'Sign out and use the correct account'}
        </Button>
    );
}
