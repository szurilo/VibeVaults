'use client';

import { useState } from 'react';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

interface UsageItem {
    used: number;
    max: number;
    usedLabel?: string;
    maxLabel?: string;
}

interface BillingCardProps {
    tierLabel: string;
    hasSubscription: boolean;
    billingInterval?: 'monthly' | 'yearly' | null;
    usage?: {
        workspaces: UsageItem;
        projects: UsageItem;
        storage: UsageItem;
    };
}

function UsageBar({ label, item }: { label: string; item: UsageItem }) {
    const isUnlimited = item.max === Infinity || item.max > 1e12;
    const percentage = isUnlimited ? 0 : Math.min((item.used / item.max) * 100, 100);

    const usedDisplay = item.usedLabel ?? item.used.toString();
    const maxDisplay = isUnlimited ? 'Unlimited' : (item.maxLabel ?? item.max.toString());

    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-900">
                    {usedDisplay} / {maxDisplay}
                </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                {isUnlimited ? (
                    <div className="h-full rounded-full bg-[#209CEE] w-full opacity-20" />
                ) : (
                    <div
                        className="h-full rounded-full bg-[#209CEE] transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 2)}%` }}
                    />
                )}
            </div>
        </div>
    );
}

export function BillingCard({ tierLabel, hasSubscription, billingInterval, usage }: BillingCardProps) {
    const [loading, setLoading] = useState(false);

    const handleManageBilling = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch {
            setLoading(false);
        }
    };

    const intervalLabel = billingInterval === 'yearly' ? 'Yearly' : billingInterval === 'monthly' ? 'Monthly' : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Billing
                </CardTitle>
                <CardDescription>
                    Manage your subscription, update payment method, and view invoices.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                        Current plan:{' '}
                        <span className="font-semibold text-gray-900">{tierLabel}</span>
                        {intervalLabel && (
                            <span className="ml-2 text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">
                                {intervalLabel}
                            </span>
                        )}
                    </div>
                    {hasSubscription && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleManageBilling}
                            disabled={loading}
                            className="cursor-pointer"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <ExternalLink className="w-4 h-4 mr-2" />
                            )}
                            Manage Billing
                        </Button>
                    )}
                </div>

                {usage && (
                    <div className="space-y-4 pt-2 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Usage</p>
                        <UsageBar label="Workspaces" item={usage.workspaces} />
                        <UsageBar label="Projects" item={usage.projects} />
                        <UsageBar label="Storage" item={usage.storage} />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
