/**
 * Main Responsibility:
 *   Decides where the dashboard must navigate when the selected project or
 *   workspace changes.
 *
 * Sensitive Dependencies:
 *   Route shapes under /dashboard. Most dashboard pages read the
 *   selectedProjectId / selectedWorkspaceId cookies and so re-render correctly
 *   on a plain router.refresh(). Entity-scoped routes do NOT: they load a row
 *   by id from the URL, so after a switch they would keep showing a record
 *   belonging to the project the user just left. Those routes need a real
 *   navigation back to their scoped list.
 */

/** Detail routes that address a single record by id and ignore the cookies. */
const ENTITY_ROUTES: { pattern: RegExp; list: string }[] = [
    { pattern: /^\/dashboard\/feedback\/[^/]+$/, list: '/dashboard/feedback' },
];

/**
 * Returns the list route to navigate to when the project/workspace selection
 * changes while `pathname` is on an entity-scoped detail page, or null when a
 * refresh in place is enough.
 */
export function scopeChangeFallbackRoute(pathname: string): string | null {
    return ENTITY_ROUTES.find(r => r.pattern.test(pathname))?.list ?? null;
}
