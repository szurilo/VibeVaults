'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export default function PaymentSuccessClient({ initialStatus }: { initialStatus: Status }) {
    const [status, setStatus] = useState<Status>(initialStatus);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        if (status === 'success') {
            const t = setTimeout(() => {
                router.push('/dashboard');
                router.refresh();
            }, 2000);
            return () => clearTimeout(t);
        }

        if (status !== 'loading') return;

        let attempts = 0;
        const maxAttempts = 20; // ~40s
        let timeoutId: NodeJS.Timeout;
        let isMounted = true;

        const checkSubscription = async () => {
            if (!isMounted) return;

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_status')
                    .eq('id', user.id)
                    .single();

                if (profile?.subscription_status === 'active') {
                    if (isMounted) setStatus('success');
                    return;
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    if (isMounted) setStatus('error');
                } else if (isMounted) {
                    timeoutId = setTimeout(checkSubscription, 2000);
                }
            } catch (error) {
                console.error("Error checking subscription:", error);
                attempts++;
                if (attempts >= maxAttempts) {
                    if (isMounted) setStatus('error');
                } else if (isMounted) {
                    timeoutId = setTimeout(checkSubscription, 2000);
                }
            }
        };

        checkSubscription();

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [status, supabase, router]);

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
                                {"We couldn't confirm your subscription immediately. Don't worry, your payment was likely processed."}
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
