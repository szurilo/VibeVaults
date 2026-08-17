import type { Metadata } from "next";
import { ComparisonPage } from "@/components/compare/comparison-page";
import { userbackComparison } from "@/lib/compare-data";

export const metadata: Metadata = {
    title: userbackComparison.metaTitle,
    description: userbackComparison.metaDescription,
    alternates: { canonical: "/compare/userback-alternative" },
    openGraph: {
        title: userbackComparison.metaTitle,
        description: userbackComparison.metaDescription,
        url: "/compare/userback-alternative",
    },
};

export default function UserbackAlternativePage() {
    return <ComparisonPage data={userbackComparison} />;
}