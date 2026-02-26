'use client'

import { useState, useEffect } from 'react'
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
import { Check, Users, X, Loader2 } from 'lucide-react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { inviteClientAction, getProjectInvitesAction, revokeClientInviteAction } from '@/actions/invite-client'

export function InviteClientCard({ project }: { project: any }) {
    const [clientEmail, setClientEmail] = useState('')
    const targetUrl = project.website_url || ''
    const [loading, setLoading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')

    const [invites, setInvites] = useState<any[]>([])
    const [loadingInvites, setLoadingInvites] = useState(true)

    const fetchInvites = async () => {
        setLoadingInvites(true)
        const res = await getProjectInvitesAction(project.id)
        if (res.success && res.invites) {
            setInvites(res.invites)
        }
        setLoadingInvites(false)
    }

    useEffect(() => {
        if (project?.id) {
            fetchInvites()
        }
    }, [project?.id])

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
                await fetchInvites() // Refresh the list after successful invite
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

    const handleRevoke = async (inviteId: string) => {
        try {
            const res = await revokeClientInviteAction(inviteId)
            if (res.success) {
                setInvites(invites.filter(i => i.id !== inviteId))
            } else {
                alert(res.error || 'Failed to revoke invite.')
            }
        } catch (error) {
            console.error(error)
            alert('Network error occurred while revoking.')
        }
    }

    return (
        <Card className="shadow-sm border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between w-full">
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
                        <div className="space-y-4 pt-4">
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

                        {/* Active Invites List */}
                        {loadingInvites ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-6">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading invites...
                            </div>
                        ) : invites.length > 0 ? (
                            <div className="mt-6">
                                <Label className="text-gray-500 mb-3 block">Active Invites</Label>
                                <div className="space-y-2 max-w-md">
                                    {invites.map((invite) => (
                                        <div key={invite.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md border border-gray-100">
                                            <span className="text-sm text-gray-700 truncate mr-2">{invite.email}</span>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0 cursor-pointer"
                                                        title="Revoke access"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Revoke access?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to revoke access for <span className="font-medium text-gray-900">{invite.email}</span>? They will no longer be able to submit feedback or replies.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="cursor-pointer"
                                                            variant="destructive"
                                                            onClick={(e) => {
                                                                // Prevent the dialog content click from bubbling anywhere if needed, though usually standard here is fine
                                                                handleRevoke(invite.id);
                                                            }}
                                                        >
                                                            Revoke Access
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </div>
                <div className="px-6 mt-4 sm:mt-10 sm:px-0 sm:pr-6 shrink-0 pb-6 sm:pb-0">
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
