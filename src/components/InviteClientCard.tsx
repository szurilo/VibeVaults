'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Check, Users } from 'lucide-react'
import { inviteClientAction } from '@/actions/invite-client'

export function InviteClientCard({ project }: { project: any }) {
    const [clientEmail, setClientEmail] = useState('')
    const targetUrl = project.website_url || ''
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')

    const handleInvite = async () => {
        if (!clientEmail || !targetUrl) return;

        setLoading(true)
        setStatus('idle')
        setErrorMsg('')

        try {
            const res = await inviteClientAction(project.id, clientEmail)
            if (res.success) {
                setStatus('success')
                setClientEmail('')
                setTimeout(() => setStatus('idle'), 3000)
            } else {
                setStatus('error')
                setErrorMsg(res.error || 'Failed to send invite')
            }
        } catch (error) {
            console.error(error)
            setStatus('error')
            setErrorMsg('Network error occurred.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="shadow-sm border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full">
                <div className="flex-1">
                    <CardHeader>
                        <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Invite Client
                        </CardTitle>
                        <CardDescription>
                            Send securely-generated tracking links straight to your client's inbox.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-4 pt-6">
                            <div className="space-y-2">
                                <Label htmlFor="clientEmail">Client Email</Label>
                                <Input
                                    id="clientEmail"
                                    type="email"
                                    placeholder="client@company.com"
                                    value={clientEmail}
                                    onChange={(e) => setClientEmail(e.target.value)}
                                    className="max-w-md focus-visible:ring-primary"
                                    disabled={loading}
                                />
                            </div>

                            {/* Status messages placed below input so they sit inline smoothly */}
                            <div className="text-xs max-w-md h-4">
                                {status === 'success' && <span className="text-green-600 font-medium flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Invite sent!</span>}
                                {status === 'error' && <span className="text-red-500 font-medium">{errorMsg}</span>}
                            </div>
                        </div>
                    </CardContent>
                </div>
                <div className="px-6 mt-4 sm:mt-0 sm:px-0 sm:pr-6 shrink-0 pb-6 sm:pb-0">
                    <Button
                        type="button"
                        onClick={handleInvite}
                        disabled={loading || !clientEmail || !targetUrl}
                        className="cursor-pointer min-w-[100px]"
                    >
                        {loading ? 'Sending...' : 'Send Invite'}
                    </Button>
                </div>
            </div>
        </Card>
    )
}
