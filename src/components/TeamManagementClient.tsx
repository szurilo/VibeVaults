'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from "sonner";

// Helper for '2 days ago' style timestamps without needing date-fns
function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
}

export function TeamManagementClient({
    workspaceId,
    members,
    invites,
    isOwner
}: {
    workspaceId: string;
    members: any[];
    invites: any[];
    isOwner: boolean;
}) {
    const [email, setEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const router = useRouter();

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsInviting(true);
        try {
            const res = await fetch('/api/workspaces/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, workspaceId })
            });

            if (!res.ok) {
                const error = await res.text();
                throw new Error(error);
            }

            toast.success("Invite sent successfully");
            setEmail('');
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "Failed to send invite");
        } finally {
            setIsInviting(false);
        }
    };

    const handleCancelInvite = async (inviteId: string) => {
        try {
            const res = await fetch(`/api/workspaces/invites?id=${inviteId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Failed to cancel invite');
            }

            toast.success("Invite cancelled");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || "Error");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Team Members</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {members.map((member) => (
                            <div key={member.user_id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50/50">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarImage src={member.profiles?.avatar_url} />
                                        <AvatarFallback>
                                            {(member.profiles?.full_name || member.profiles?.email || "?").charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-medium text-sm">
                                            {member.profiles?.full_name || (member.profiles?.email ? member.profiles.email.split('@')[0] : "Unknown User")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {member.profiles?.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                                        {member.role}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {invites.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Invites</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {invites.map((invite) => (
                                <div key={invite.id} className="flex items-center justify-between p-4 border border-dashed rounded-lg">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">{invite.email}</span>
                                        <span className="text-xs text-muted-foreground">
                                            Invited {formatRelativeTime(invite.created_at)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">Pending</Badge>
                                        {isOwner && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                                onClick={() => handleCancelInvite(invite.id)}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>

            {isOwner && (
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Invite Member</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleInvite} className="space-y-4">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Invite colleagues to join your workspace. They will be added as Members.
                                    </p>
                                    <Input
                                        type="email"
                                        placeholder="colleague@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <Button type="submit" disabled={isInviting} className="w-full cursor-pointer">
                                    {isInviting ? "Sending..." : "Send Invite"}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
