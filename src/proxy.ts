import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except those that you see in the regexp, so e.g:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Matching means besides these requests below all other requests will be proxied to API route (app/api/...), Route handler, Page/Server Component, this means they will be redirected from the apex domain to the www domain.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe|api/widget|widget.js|sitemap\\.xml|robots\\.txt|manifest|share|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
