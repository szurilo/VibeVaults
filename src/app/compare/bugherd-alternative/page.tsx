import type { Metadata } from "next";
import { ComparisonPage } from "@/components/compare/comparison-page";
import { bugherdComparison } from "@/lib/compare-data";

export const metadata: Metadata = {
    title: bugherdComparison.metaTitle,
    description: bugherdComparison.metaDescription,
    alternates: { canonical: "/compare/bugherd-alternative" },
    openGraph: {
        title: bugherdComparison.metaTitle,
        description: bugherdComparison.metaDescription,
        url: "/compare/bugherd-alternative",
    },
};

export default function BugHerdAlternativePage() {
    return <ComparisonPage data={bugherdComparison} />;
}
