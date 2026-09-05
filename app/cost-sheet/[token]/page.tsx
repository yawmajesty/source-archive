import { notFound } from "next/navigation";
import { getSheetByToken } from "@/app/(app)/products/[id]/cost-sheet-actions";
import { FactoryQuoteForm } from "./FactoryQuoteForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cost breakdown" };

/**
 * The factory's view. No login — the token in the URL is the credential, and
 * it only ever reaches its own sheet. They see the lines and fill in prices;
 * nothing about the client, the retail price or our margin is here.
 */
export default async function FactoryCostSheetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getSheetByToken(token);
  if (!data) notFound();

  return (
    <FactoryQuoteForm
      token={token}
      sheet={data.sheet}
      lines={data.lines}
      productName={data.productName}
    />
  );
}
