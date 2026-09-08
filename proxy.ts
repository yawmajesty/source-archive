import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/portal(.*)",
  "/brief(.*)",
  "/enquire(.*)",
  "/techpack(.*)",
  "/factory(.*)",
  "/cost-sheet(.*)",   // factory cost breakdown, protected by its own token
  "/for-brands(.*)",
  "/price",            // the free, shareable pricing calculator
  "/api/webhook(.*)",
  "/api/cron(.*)",    // guarded by CRON_SECRET inside the route
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)", "/(api|trpc)(.*)"],
};
