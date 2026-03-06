'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Loader2, Check, Settings, Upload, Trash2 } from 'lucide-react';

interface WorkspaceSettingsCardProps {
    workspace: {
        id: string;
        name: string;
        brand_logo_url?: string;
    };
}

export function WorkspaceSettingsCard({ workspace }: WorkspaceSettingsCardProps) {
    const [name, setName] = useState(workspace.name);
    const [logoUrl, setLogoUrl] = useState<string | null>(workspace.brand_logo_url || null);
    const [isUploading, setIsUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const supabase = createClient();

    // Sync state with props when workspace changes
    useEffect(() => {
        setName(workspace.name);
        setLogoUrl(workspace.brand_logo_url || null);
    }, [workspace.name, workspace.brand_logo_url]);

    const handleUpdateName = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check if anything changed
        const nameChanged = name.trim() && name !== workspace.name;
        const logoChanged = logoUrl !== (workspace.brand_logo_url || null);

        if (!nameChanged && !logoChanged) return;

        setLoading(true);
        setSuccess(false);

        try {
            const { error } = await supabase
                .from('workspaces')
                .update({
                    name: name.trim(),
                    brand_logo_url: logoUrl
                })
                .eq('id', workspace.id);

            if (error) throw error;

            setSuccess(true);
            router.refresh();

            // Success state duration
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to update workspace details:', error);
            alert('Failed to update workspace details. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            alert('Image size must be less than 2MB');
            return;
        }

        setIsUploading(true);

        try {
            // Create a unique file name
            const fileExt = file.name.split('.').pop();
            const fileName = `${workspace.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `${workspace.id}/${fileName}`;

            // Upload the file to Supabase storage
            const { error: uploadError, data } = await supabase.storage
                .from('workspace-logos')
                .upload(filePath, file, { cacheControl: '3600', upsert: true });

            if (uploadError) throw uploadError;

            // Get the public URL
            const { data: publicUrlData } = supabase.storage
                .from('workspace-logos')
                .getPublicUrl(filePath);

            setLogoUrl(publicUrlData.publicUrl);
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Failed to upload logo.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const isSaveDisabled = loading || isUploading || !name.trim() ||
        (name === workspace.name && logoUrl === (workspace.brand_logo_url || null));

    return (
        <Card className="shadow-sm border-gray-200">
            <form onSubmit={handleUpdateName} className="flex flex-col sm:flex-row justify-between w-full">
                <div className="flex-1">
                    <CardHeader>
                        <CardTitle className="font-semibold text-gray-900 flex items-center gap-2">
                            <Settings className="w-5 h-5" />
                            Workspace Settings
                        </CardTitle>
                        <CardDescription>
                            Update your workspace details and brand logo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-6 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="workspaceName">Workspace Name</Label>
                                <Input
                                    id="workspaceName"
                                    placeholder="e.g. My Workspace"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="max-w-md focus-visible:ring-primary"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Brand Logo</Label>
                                <div className="flex items-center gap-6">
                                    <Avatar className="h-16 w-16 rounded-md border border-gray-200 shadow-sm bg-gray-50 flex items-center justify-center">
                                        {logoUrl ? (
                                            <AvatarImage src={logoUrl} alt="Brand Logo" className="object-contain" />
                                        ) : (
                                            <AvatarFallback className="bg-primary/5 text-primary rounded-md text-xl">
                                                {name.charAt(0).toUpperCase() || "W"}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>

                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="cursor-pointer"
                                            >
                                                {isUploading ? (
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Upload className="h-4 w-4 mr-2" />
                                                )}
                                                {isUploading ? "Uploading..." : "Upload new"}
                                            </Button>

                                            {logoUrl && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setLogoUrl(null)}
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Remove
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Recommended size: 256x256px. Max 2MB (JPG, PNG).
                                        </p>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </div>
                <div className="px-6 mt-4 sm:mt-0 sm:px-0 sm:pr-6 sm:self-center shrink-0">
                    <Button
                        type="submit"
                        disabled={isSaveDisabled}
                        className="cursor-pointer min-w-[100px]"
                    >
                        {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : success ? (
                            <span className="flex items-center gap-2">
                                <Check className="h-4 w-4" /> Saved
                            </span>
                        ) : (
                            'Save Changes'
                        )}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
