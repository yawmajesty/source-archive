import { BriefForm } from "./BriefForm";
import { getAgencySettings } from "@/lib/data";

export default async function BriefPage() {
  const agencySettings = await getAgencySettings();
  return <BriefForm agencySettings={agencySettings} />;
}
