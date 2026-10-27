import { notFound } from "next/navigation";
import { getStudioBoard } from "./actions";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-dynamic";
// An unguessable link is not a published page.
export const metadata = { title: "Tech Packs — Source[Archive]", robots: { index: false, follow: false } };

export default async function StudioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const board = await getStudioBoard(token);
  if (board.problem === "unknown") notFound();
  return <StudioClient token={token} board={board} />;
}
