import type { Metadata } from "next";
import { ComparisonPage } from "@/components/compare/comparison-page";
import { markerComparison } from "@/lib/compare-data";

export const metadata: Metadata = {
    title: markerComparison.metaTitle,
    description: markerComparison.metaDescription,
    alternates: { canonical: "/compare/marker-io-alternative" },
    openGraph: {
        title: markerComparison.metaTitle,
        description: markerComparison.metaDescription,
        url: "/compare/marker-io-alternative",
    },
};

export default function MarkerAlternativePage() {
    return <ComparisonPage data={markerComparison} />;
}
