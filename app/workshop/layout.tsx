import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { getAgencyContext } from "@/lib/agency-data";

// Deliberately not inside (app): the workshop is its own surface, without
// the agency sidebar, costing or client records. A machinist opens this at
// the end of a session to record what they did — nothing else.
export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ctx = await getAgencyContext();
  if (!ctx) redirect("/onboarding-agency");

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      <header
        className="mac-toolbar hairline-b sticky top-0 z-10 flex h-14 items-center gap-3 px-4"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
      >
        <span className="text-[14px] font-semibold tight" style={{ color: "var(--label)" }}>Workshop</span>
        <span className="text-[13px]" style={{ color: "var(--label-3)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--label-2)" }}>{ctx.agency.name}</span>
        <div className="flex-1" />
        {(ctx.role === "admin" || ctx.role === "team") && (
          <Link href="/dashboard" className="mac-button flex items-center" style={{ color: "var(--label-2)" }}>
            Full backend
          </Link>
        )}
      </header>
      <main
        className="mx-auto w-full max-w-3xl px-4 py-5"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }}
      >
        {children}
      </main>
    </div>
  );
}
