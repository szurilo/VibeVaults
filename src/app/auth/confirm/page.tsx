'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

type ConfirmState = 'verifying' | 'success' | 'error'

function ConfirmContent() {
    const searchParams = useSearchParams()
    const [state, setState] = useState<ConfirmState>('verifying')
    const [errorMessage, setErrorMessage] = useState<string>('')

    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')

    useEffect(() => {
        async function verifyOtp() {
            if (!tokenHash || !type) {
                setState('error')
                setErrorMessage('Invalid confirmation link. Missing required parameters.')
                return
            }

            const supabase = createClient()

            const { error } = await supabase.auth.verifyOtp({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: type as any,
                token_hash: tokenHash,
            })

            if (error) {
                console.error('Error verifying OTP:', error)
                setState('error')
                setErrorMessage(error.message)
            } else {
                setState('success')

                // Check for a saved redirect from email deep-links (cookie set by AuthForm)
                const cookieMatch = document.cookie.match(/(?:^|;\s*)auth_redirect=([^;]*)/)
                const savedRedirect = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null
                if (savedRedirect) {
                    document.cookie = 'auth_redirect=; path=/; max-age=0'
                }
                // Only allow relative paths — block protocol-relative URLs (//evil.com) and absolute URLs
                const isSafePath = savedRedirect && savedRedirect.startsWith('/') && !savedRedirect.startsWith('//')
                const next = isSafePath ? savedRedirect : '/dashboard'

                // Use window.location for redirect — the target may be an API route
                // (e.g. /api/email-redirect) which router.push can't handle
                setTimeout(() => {
                    window.location.href = next
                }, 500)
            }
        }

        verifyOtp()
    }, [tokenHash, type])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            {state === 'verifying' && (
                <Card className="w-full max-w-md text-center shadow-lg">
                    <CardHeader className="space-y-4">
                        <div className="flex justify-center">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-2xl font-extrabold tracking-tight">
                                Verifying your link
                            </CardTitle>
                            <CardDescription className="text-base">
                                Please wait while we confirm your identity...
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}

            {state === 'success' && (
                <Card className="w-full max-w-md text-center shadow-lg">
                    <CardHeader className="space-y-4">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-green-100 p-3">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-2xl font-extrabold tracking-tight">
                                Verified!
                            </CardTitle>
                            <CardDescription className="text-base">
                                {"You've been successfully authenticated. Redirecting you now..."}
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}

            {state === 'error' && (
                <Card className="w-full max-w-md text-center shadow-lg">
                    <CardHeader className="space-y-4">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-red-100 p-3">
                                <AlertTriangle className="h-8 w-8 text-red-600" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <CardTitle className="text-2xl font-extrabold tracking-tight">
                                Verification Failed
                            </CardTitle>
                            <CardDescription className="text-base">
                                {errorMessage || 'We couldn\'t verify your link.'}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="text-left">
                        <div className="bg-muted/50 rounded-lg p-4 text-sm">
                            <p className="font-medium text-foreground mb-2">This can happen if:</p>
                            <ul className="space-y-1.5">
                                {[
                                    'The link has expired (they are single-use)',
                                    'You\'ve already used this link to sign in',
                                    'Your email security scanned the link before you clicked it',
                                ].map((reason, i) => (
                                    <li key={i} className="flex items-center text-muted-foreground">
                                        <span className="mr-2 text-primary">•</span>
                                        {reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-3 pt-2">
                        <Button asChild className="w-full h-10" variant="default">
                            <Link href="/auth/login">Request a new magic link</Link>
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                            If you continue to experience issues, please contact{' '}
                            <a href="mailto:support@vibe-vaults.com" className="underline hover:text-primary">
                                support@vibe-vaults.com
                            </a>.
                        </p>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}

export default function ConfirmPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                    <Card className="w-full max-w-md text-center shadow-lg">
                        <CardHeader className="space-y-4">
                            <div className="flex justify-center">
                                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            </div>
                            <div className="space-y-2">
                                <CardTitle className="text-2xl font-extrabold tracking-tight">
                                    Verifying your link
                                </CardTitle>
                                <CardDescription className="text-base">
                                    Please wait while we confirm your identity...
                                </CardDescription>
                            </div>
                        </CardHeader>
                    </Card>
                </div>
            }
        >
            <ConfirmContent />
        </Suspense>
    )
}
