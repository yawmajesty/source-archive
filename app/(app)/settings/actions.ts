"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function updateUserRole(userId: string, role: "admin" | "team" | "client") {
  const { userId: callerId } = await auth();
  if (!callerId) throw new Error("Unauthenticated");

  const client = await clerkClient();
  const caller = await client.users.getUser(callerId);
  if (caller.publicMetadata?.role !== "admin") throw new Error("Only admins can change roles");

  await client.users.updateUserMetadata(userId, { publicMetadata: { role } });
  revalidatePath("/settings");
}
