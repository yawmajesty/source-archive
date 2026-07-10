import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserWorkspaces } from "@/lib/brand-data";

// Root dispatcher — where a signed-in user goes depends on WHO they are:
//   - Agency team (Clerk publicMetadata.role in {admin, team})  → /dashboard
//     (the existing Source Archive backend)
//   - Brand-side user with 1+ workspaces                        → /app/{first-slug}
//   - Brand-side user with 0 workspaces (just signed up)        → /onboarding
//   - Signed-out visitors will land on the marketing homepage
//     (Phase 7 replaces this file with the marketing landing).
//
// Phase 1 ships the dispatcher only; marketing is Phase 7.
export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Agency team members keep going to the existing backend.
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const agencyRole = user.publicMetadata?.role;
    if (agencyRole === "admin" || agencyRole === "team") {
      redirect("/dashboard");
    }
  } catch {
    // If Clerk lookup fails, fall through to the brand-side path.
  }

  const workspaces = await getUserWorkspaces();
  if (workspaces.length === 0) redirect("/onboarding");
  redirect(`/app/${workspaces[0].slug}`);
}
