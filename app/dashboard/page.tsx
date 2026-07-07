import { redirect } from "next/navigation";

/**
 * Redirect /dashboard → / (the actual dashboard route).
 *
 * The dashboard lives at the root path `/` because it is inside the
 * `(dashboard)` route group (parenthesised folders don't add URL segments).
 * This redirect keeps any existing bookmarks or links pointing at
 * `/dashboard` working instead of returning a 404.
 */
export default function DashboardRedirectPage() {
  redirect("/");
}
