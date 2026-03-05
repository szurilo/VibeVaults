'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MailCheck, UserX, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    projects = [],
    isOwner
}: {
    workspaceId: string;
    members: any[];
    invites: any[];
    projects?: any[];
    isOwner: boolean;
}) {
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [role, setRole] = useState<'member' | 'client'>('member');
    const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
    const [isInviting, setIsInviting] = useState(false);
    const router = useRouter();

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError('');

        if (!email.trim()) {
            setEmailError('Email is required');
            return;
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
            setEmailError('Please enter a valid email address');
            return;
        }

        if (role === 'client' && !selectedProjectId) {
            setEmailError('Please select a project for the client to review');
            return;
        }

        setIsInviting(true);
        try {
            const res = await fetch('/api/workspaces/invites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    workspaceId,
                    role,
                    projectId: role === 'client' ? selectedProjectId : undefined
                })
            });

            if (!res.ok) {
                const error = await res.text();
                throw new Error(error);
            }

            toast("Invite Sent", {
                description: `Successfully sent invitation to ${email.trim()}`,
                icon: <MailCheck className="h-4 w-4 text-green-500" />,
            });
            setEmail('');
            router.refresh();
        } catch (error: any) {
            toast("Error", {
                description: error.message || "Failed to send invite",
                icon: <AlertCircle className="h-4 w-4 text-red-500" />,
            });
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

            toast("Invite Cancelled", {
                description: "The invitation has been cancelled successfully.",
                icon: <UserX className="h-4 w-4 text-muted-foreground" />,
            });
            router.refresh();
        } catch (error: any) {
            toast("Error", {
                description: error.message || "Error cancelling invite",
                icon: <AlertCircle className="h-4 w-4 text-red-500" />,
            });
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
                                        {invite.role === 'client' && (
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Client</Badge>
                                        )}
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
                            <form onSubmit={handleInvite} className="space-y-4" noValidate>
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        Invite colleagues to join your workspace. They will be added as Members.
                                    </p>
                                    <Input
                                        type="email"
                                        placeholder="colleague@example.com"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (emailError) setEmailError('');
                                        }}
                                        className={emailError ? "border-red-500 focus-visible:ring-red-500" : ""}
                                    />
                                    {emailError && <p className="text-sm font-medium text-red-500">{emailError}</p>}
                                </div>
                                <div className="space-y-3 pb-2 pt-1">
                                    <Label className="text-sm font-medium">Role</Label>
                                    <RadioGroup value={role} onValueChange={(val: any) => setRole(val)} className="flex flex-col gap-3">
                                        <div className="flex items-start space-x-3">
                                            <RadioGroupItem value="member" id="r1" className="mt-1" />
                                            <div className="flex flex-col">
                                                <Label htmlFor="r1" className="font-normal cursor-pointer">Member</Label>
                                                <span className="text-xs text-muted-foreground mt-0.5">Can access dashboard and manage assignments.</span>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                            <RadioGroupItem value="client" id="r2" className="mt-1" />
                                            <div className="flex flex-col w-full">
                                                <Label htmlFor="r2" className="font-normal cursor-pointer">Client</Label>
                                                <span className="text-xs text-muted-foreground mt-0.5 mb-2">Whitelist for leaving feedback via widget. Cannot access dashboard.</span>

                                                {role === 'client' && projects.length > 0 && (
                                                    <div className="mt-2 space-y-2">
                                                        <Label className="text-xs font-semibold">Select Project to Review</Label>
                                                        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                                                            <SelectTrigger className="w-full h-9 bg-white">
                                                                <SelectValue placeholder="Select a project..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {projects.map(p => (
                                                                    <SelectItem key={p.id} value={p.id}>
                                                                        {p.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                {role === 'client' && projects.length === 0 && (
                                                    <p className="text-xs text-orange-600 font-medium mt-1">
                                                        You must create a project first before inviting a client.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <Button type="submit" disabled={isInviting || (role === 'client' && projects.length === 0)} className="w-full cursor-pointer">
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
