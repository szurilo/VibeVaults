'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, CreditCard } from 'lucide-react';

export default function SubscribePage() {
    const router = useRouter();
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-primary shadow-xl border border-gray-100">
                            <CreditCard className="h-8 w-8" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl">Your trial has expired</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                        Your 14-day free trial has ended. Subscribe now to continue using VibeVaults and keep collaborating on your projects.
                    </p>
                    <div className="flex flex-col gap-3 pt-2">
                        <Button asChild size="lg" className="w-full">
                            <a href="/api/stripe/checkout">
                                <CreditCard className="mr-2 h-4 w-4" />
                                Subscribe Now
                            </a>
                        </Button>
                        <button
                            onClick={handleSignOut}
                            className="cursor-pointer text-red-600 hover:bg-red-50 flex items-center justify-center gap-2 text-sm py-2 px-3 rounded-md transition-colors mx-auto"
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
