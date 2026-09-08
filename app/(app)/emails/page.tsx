import { listEmails, getNotificationEmail, clientsMissingEmail } from "./actions";
import { EmailsClient } from "./EmailsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Emails — Source[Archive]" };

export default async function EmailsPage() {
  const [{ rows, configured, counts }, notificationEmail, missing] = await Promise.all([
    listEmails(),
    getNotificationEmail(),
    clientsMissingEmail(),
  ]);
  return (
    <EmailsClient
      rows={rows}
      configured={configured}
      counts={counts}
      notificationEmail={notificationEmail}
      missingEmail={missing}
    />
  );
}
