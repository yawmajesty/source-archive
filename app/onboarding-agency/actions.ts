"use server";

import { revalidatePath } from "next/cache";
import { createAgencyForCurrentUser } from "@/lib/agency-data";

export async function createAgencyAction(input: { name: string; slug: string }) {
  const res = await createAgencyForCurrentUser(input);
  if (res.success) {
    // Bust the getAgencyContext cache for any subsequent renders.
    revalidatePath("/", "layout");
  }
  return res;
}
