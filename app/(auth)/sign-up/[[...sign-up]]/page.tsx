import { SignUp } from "@clerk/nextjs";
import { safeNextPath } from "@/lib/price-handoff";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // safeNextPath refuses anything that isn't a same-site path — the
  // parameter would otherwise be an open redirect wearing our domain.
  const target = safeNextPath(next, "/");

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--sa-bg)" }}>
      <SignUp forceRedirectUrl={target} signInForceRedirectUrl={target} />
    </div>
  );
}
