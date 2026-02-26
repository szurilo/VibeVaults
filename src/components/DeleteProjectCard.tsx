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
    project: {
        id: string;
        name: string;
    };
}

export function DeleteProjectCard({ project }: DangerZoneProps) {
    const [projectLoading, setProjectLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleDeleteProject = async () => {
        if (!project) return;
        setProjectLoading(true);
        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

            if (error) throw error;

            // Clear the selected project cookie
            document.cookie = 'selectedProjectId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

            router.push("/dashboard");
            router.refresh();
        } catch (error) {
            console.error("Error deleting project:", error);
            alert("Failed to delete project. Please try again.");
        } finally {
            setProjectLoading(false);
        }
    };

    return (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
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
                        <h3 className="font-medium text-gray-900">Delete Project</h3>
                        <p className="text-sm text-gray-500">
                            Permanently delete <span className="font-semibold text-gray-700">{project.name}</span> and all its feedbacks.
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={projectLoading} size="sm" className="cursor-pointer">
                                {projectLoading ? "Deleting..." : "Delete Project"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Delete project "{project.name}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your
                                    project and all the feedback associated with it.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteProject}
                                    className="cursor-pointer"
                                    variant="destructive"
                                >
                                    Delete Project
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
