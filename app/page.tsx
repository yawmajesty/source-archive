import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { getUserWorkspaces } from "@/lib/brand-data";

// Root dispatcher — where a signed-in user goes depends on WHO they are:
//   - Agency member (any role)              → /dashboard  (the agency backend)
//   - Brand-side member with 1+ workspaces  → /app/{first-slug}
//   - Brand-side, 0 workspaces              → /onboarding (brand workspace)
//   - No memberships at all                 → /onboarding-agency (create their own agency)
//   - Signed-out visitors                   → /for-brands (marketing landing)
export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/for-brands");

  const agencyCtx = await getAgencyContext();
  if (agencyCtx) redirect("/dashboard");

  const workspaces = await getUserWorkspaces();
  if (workspaces.length > 0) redirect(`/app/${workspaces[0].slug}`);

  // Truly new user with nothing. Steer them into the agency onboarding
  // by default — brands are a smaller share and can pivot later.
  redirect("/onboarding-agency");
}
