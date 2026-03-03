'use client';

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface DangerZoneProps {
    workspace: {
        id: string;
        name: string;
    };
}

export function DeleteWorkspaceCard({ workspace }: DangerZoneProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleDeleteWorkspace = async () => {
        if (!workspace) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('workspaces')
                .delete()
                .eq('id', workspace.id);

            if (error) throw error;

            // Clear the selected workspace and project cookies
            document.cookie = 'selectedWorkspaceId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
            document.cookie = 'selectedProjectId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

            router.push("/dashboard");
            router.refresh();
        } catch (error) {
            console.error("Error deleting workspace:", error);
            alert("Failed to delete workspace. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm mt-8">
            <CardHeader>
                <CardTitle className="text-destructive font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Danger Zone
                </CardTitle>
                <CardDescription>
                    Irreversible actions.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-white/50">
                    <div className="space-y-1">
                        <h3 className="font-medium text-gray-900">Delete Workspace</h3>
                        <p className="text-sm text-gray-500">
                            Permanently delete <span className="font-semibold text-gray-700">{workspace.name}</span>, all its projects, and all the feedbacks within those projects.
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={loading} size="sm" className="cursor-pointer">
                                {loading ? "Deleting..." : "Delete Workspace"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete workspace "{workspace.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your
                                    workspace, all projects contained within it, and all feedback inside those projects.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteWorkspace}
                                    className="cursor-pointer"
                                    variant="destructive"
                                >
                                    Delete Workspace
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
