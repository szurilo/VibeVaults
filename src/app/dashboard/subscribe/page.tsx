'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, CreditCard } from 'lucide-react';

export default function SubscribePage() {
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">
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
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-muted-foreground hover:text-red-600"
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Log out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
