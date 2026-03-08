import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
    return (
        <div className="min-h-screen flex flex-col animate-in fade-in duration-500">
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100">
                <div className="px-8 py-4 max-w-7xl mx-auto w-full">
                    <Skeleton className="h-8 w-32" />
                </div>
            </header>

            <main className="flex-1 flex items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-[400px] bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <div className="text-center mb-6 space-y-2">
                        <Skeleton className="h-8 w-48 mx-auto" />
                        <Skeleton className="h-4 w-64 mx-auto" />
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="space-y-1">
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <Skeleton className="h-10 w-full mt-2" />
                        <Skeleton className="h-4 w-full max-w-[250px] mx-auto mt-2" />
                    </div>

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <Skeleton className="h-4 w-32 mx-auto" />
                    </div>
                </div>
            </main>
        </div>
    );
}
