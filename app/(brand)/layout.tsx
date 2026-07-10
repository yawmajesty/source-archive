import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Auth gate for every route inside the brand dashboard tree.
// Individual workspace routes further verify membership + subscription
// state in their nested layout.
export default async function BrandRootLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <>{children}</>;
}
