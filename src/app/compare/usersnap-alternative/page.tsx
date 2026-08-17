import type { Metadata } from "next";
import { ComparisonPage } from "@/components/compare/comparison-page";
import { usersnapComparison } from "@/lib/compare-data";

export const metadata: Metadata = {
    title: usersnapComparison.metaTitle,
    description: usersnapComparison.metaDescription,
    alternates: { canonical: "/compare/usersnap-alternative" },
    openGraph: {
        title: usersnapComparison.metaTitle,
        description: usersnapComparison.metaDescription,
        url: "/compare/usersnap-alternative",
    },
};

export default function UsersnapAlternativePage() {
    return <ComparisonPage data={usersnapComparison} />;
}