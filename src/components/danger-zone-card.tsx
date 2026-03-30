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

interface DangerZoneCardProps {
    entityName: string;
    description: React.ReactNode;
    dialogTitle: string;
    dialogDescription: string;
    onDelete: () => Promise<void>;
    className?: string;
}

export function DangerZoneCard({
    entityName,
    description,
    dialogTitle,
    dialogDescription,
    onDelete,
    className,
}: DangerZoneCardProps) {
    const [loading, setLoading] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        try {
            await onDelete();
        } catch (error) {
            console.error(`Error deleting ${entityName.toLowerCase()}:`, error);
            alert(`Failed to delete ${entityName.toLowerCase()}. Please try again.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className={`border-destructive/20 bg-destructive/5 shadow-sm ${className ?? ''}`}>
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
                        <h3 className="font-medium text-gray-900">Delete {entityName}</h3>
                        <p className="text-sm text-gray-500">
                            {description}
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={loading} size="sm" className="cursor-pointer">
                                {loading ? "Deleting..." : `Delete ${entityName}`}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {dialogDescription}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDelete}
                                    className="cursor-pointer"
                                    variant="destructive"
                                >
                                    Delete {entityName}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
