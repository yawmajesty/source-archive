import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAgencyContext } from "@/lib/agency-data";
import { getUserWorkspaces } from "@/lib/brand-data";

// Root dispatcher — where a signed-in user goes depends on WHO they are:
//   - Agency member (any role)              → /dashboard  (the agency backend)
//   - Brand-side member with 1+ workspaces  → /app/{first-slug}
//   - Brand-side, 0 workspaces              → /onboarding (brand workspace)
//   - No memberships at all                 → /welcome    (brand or agency?)
//   - Signed-out visitors                   → /for-brands (marketing landing)
export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/for-brands");

  const agencyCtx = await getAgencyContext();
  if (agencyCtx) redirect("/dashboard");

  const workspaces = await getUserWorkspaces();
  if (workspaces.length > 0) redirect(`/app/${workspaces[0].slug}`);

  // Truly new user with nothing. Ask rather than assume: defaulting to the
  // agency setup is what filled the database with empty one-person agencies
  // created by brand owners who had nowhere else to go.
  redirect("/welcome");
}
