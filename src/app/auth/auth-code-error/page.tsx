'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'

export default function AuthCodeError() {
    const commonReasons = [
        'The verification link has expired',
        'The link has already been used',
        'The link is invalid or corrupted',
    ]

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader className="space-y-4">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-red-100 p-3">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-extrabold tracking-tight">Authentication Error</CardTitle>
                        <CardDescription className="text-base">
                            We couldn't complete your authentication request.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="text-left">
                    <div className="bg-muted/50 rounded-lg p-4 text-sm">
                        <p className="font-medium text-foreground mb-2">Possible reasons:</p>
                        <ul className="space-y-1.5">
                            {commonReasons.map((reason, i) => (
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
                        <Link href="/login">Try logging in again</Link>
                    </Button>
                    <Button asChild className="w-full h-10" variant="secondary">
                        <Link href="/register">Create a new account</Link>
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                        If you continue to experience issues, please contact{' '}
                        <a href="mailto:support@vibe-vaults.com" className="underline hover:text-primary">
                            support
                        </a>.
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
