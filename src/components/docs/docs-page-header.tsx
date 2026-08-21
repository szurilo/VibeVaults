/**
 * Main Responsibility: Consistent title block at the top of every /docs page.
 * Sensitive Dependencies: none — presentational only.
 */
export function DocsPageHeader({ title, summary }: { title: string; summary: string }) {
    return (
        <header className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">Documentation</p>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">{title}</h1>
            <p className="text-lg text-gray-500 leading-relaxed">{summary}</p>
        </header>
    );
}
