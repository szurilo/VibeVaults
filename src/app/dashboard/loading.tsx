import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-8">
                <Skeleton className="h-8 w-48" />
            </div>

            {/* Onboarding Skeleton */}
            <Card className="bg-primary/5 border-primary/20 mb-8">
                <CardHeader className="max-w-2xl px-8 pt-8 pb-4">
                    <Skeleton className="h-8 w-64 mb-2" />
                    <Skeleton className="h-6 w-full max-w-md" />
                </CardHeader>
                <CardContent className="max-w-2xl px-8 pb-8 space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-10" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                    </div>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Metrics Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-16" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
