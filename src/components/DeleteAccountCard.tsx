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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteAccountCard() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleDeleteAccount = async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/auth/delete-account", {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Failed to delete account");
            }

            await supabase.auth.signOut();
            router.push("/auth/login");
        } catch (error) {
            console.error("Error deleting account:", error);
            alert("Failed to delete account. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
            <CardHeader>
                <CardTitle className="text-destructive font-semibold">Danger Zone</CardTitle>
                <CardDescription>
                    Irreversible actions that affect your account.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg bg-white/50">
                    <div className="space-y-1">
                        <h3 className="font-medium text-gray-900">Delete Account</h3>
                        <p className="text-sm text-gray-500">
                            Permanently delete your account and all associated data.
                        </p>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={loading} size="sm" className="cursor-pointer">
                                {loading ? "Deleting..." : "Delete Account"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your
                                    account and remove your data from our servers.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteAccount}
                                    className="cursor-pointer"
                                    variant="destructive"
                                >
                                    Delete Account
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}
