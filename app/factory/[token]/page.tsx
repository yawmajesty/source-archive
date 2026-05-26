import { getRfqByToken, getExistingSubmission } from "@/lib/data";
import { notFound } from "next/navigation";
import { markInviteViewed } from "./actions";
import { FactoryPortalClient } from "./FactoryPortalClient";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function FactoryPortalPage({ params }: Props) {
  const { token } = await params;
  const result = await getRfqByToken(token);
  if (!result) notFound();

  const { rfq, invite, factoryName } = result;

  await markInviteViewed(invite.id);

  const existingSubmission = await getExistingSubmission(invite.id);

  return (
    <FactoryPortalClient
      rfq={rfq}
      invite={invite}
      factoryName={factoryName}
      existingSubmission={existingSubmission}
    />
  );
}
