'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function PaymentSuccessPage() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        let attempts = 0;
        const maxAttempts = 20; // 40 seconds approx
        let timeoutId: NodeJS.Timeout;
        let isMounted = true;

        const checkSubscription = async () => {
            if (!isMounted) return;

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return; // Should not happen in dashboard layout

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_status')
                    .eq('id', user.id)
                    .single();

                if (profile?.subscription_status === 'active') {
                    if (isMounted) {
                        setStatus('success');
                        setTimeout(() => {
                            if (isMounted) {
                                router.push('/dashboard');
                                router.refresh();
                            }
                        }, 2000); // Show success state briefly
                    }
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    if (isMounted) setStatus('error');
                } else {
                    if (isMounted) {
                        timeoutId = setTimeout(checkSubscription, 2000);
                    }
                }
            } catch (error) {
                console.error("Error checking subscription:", error);
                // Keep trying until maxAttempts
                attempts++;
                if (attempts >= maxAttempts) {
                    if (isMounted) setStatus('error');
                } else {
                    if (isMounted) {
                        timeoutId = setTimeout(checkSubscription, 2000);
                    }
                }
            }
        };

        checkSubscription();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [supabase, router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="flex justify-center mb-4">
                        {status === 'loading' && <Loader2 className="h-16 w-16 text-primary animate-spin" />}
                        {status === 'success' && <CheckCircle2 className="h-16 w-16 text-green-500" />}
                        {status === 'error' && <div className="text-4xl">⚠️</div>}
                    </div>
                    <CardTitle className="text-2xl">
                        {status === 'loading' && 'Finalizing your subscription...'}
                        {status === 'success' && 'Payment Successful!'}
                        {status === 'error' && 'Taking longer than expected...'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {status === 'loading' && (
                        <p className="text-muted-foreground">
                            Please wait while we confirm your payment with Stripe. This usually takes a few seconds.
                        </p>
                    )}
                    {status === 'success' && (
                        <p className="text-muted-foreground">
                            Your subscription is now active. Redirecting you to the dashboard...
                        </p>
                    )}
                    {status === 'error' && (
                        <div className="space-y-4">
                            <p className="text-muted-foreground">
                                We couldn't confirm your subscription immediately. Don't worry, your payment was likely processed.
                            </p>
                            <p className="text-sm text-gray-500">
                                If you are not redirected soon, please contact support.
                            </p>
                            <Button onClick={() => window.location.href = '/dashboard'}>
                                Go to Dashboard
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
