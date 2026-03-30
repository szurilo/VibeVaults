/**
 * Main Responsibility: Handles deep-link navigation from email notifications.
 * Sets workspace/project cookies and redirects to the appropriate dashboard page.
 * If the user is not authenticated, redirects to login with a `next` param to
 * return here after auth completes.
 *
 * Sensitive Dependencies:
 * - Supabase server client for auth check
 * - Cookies for workspace/project selection state
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get('workspace');
    const project = searchParams.get('project');
    const page = searchParams.get('page') || 'feedback';
    const feedback = searchParams.get('feedback');

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Preserve the full redirect URL so the user returns here after login
        const redirectUrl = new URL(request.url);
        const loginUrl = new URL('/auth/login', request.url);
        loginUrl.searchParams.set('next', redirectUrl.pathname + redirectUrl.search);
        return NextResponse.redirect(loginUrl);
    }

    // Set workspace/project cookies
    const cookieStore = await cookies();

    if (workspace) {
        cookieStore.set('selectedWorkspaceId', workspace, {
            path: '/',
            maxAge: 31536000,
        });
    }

    if (project) {
        cookieStore.set('selectedProjectId', project, {
            path: '/',
            maxAge: 31536000,
        });
    }

    // Build the target URL
    const origin = new URL(request.url).origin;
    let targetPath = '/dashboard';

    switch (page) {
        case 'feedback':
            targetPath = '/dashboard/feedback';
            break;
        case 'settings':
            targetPath = '/dashboard/settings';
            break;
        case 'users':
            targetPath = '/dashboard/settings/users';
            break;
        default:
            targetPath = '/dashboard';
    }

    // Navigate directly to the feedback detail page if a feedback ID is provided
    if (page === 'feedback' && feedback) {
        targetPath = `/dashboard/feedback/${feedback}`;
    }

    return NextResponse.redirect(new URL(targetPath, origin));
}
