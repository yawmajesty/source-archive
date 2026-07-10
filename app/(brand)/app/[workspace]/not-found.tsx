import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[var(--sa-bg)]">
      <div className="max-w-md text-center">
        <h1 className="text-[18px] font-semibold text-[var(--sa-text-primary)] mb-2">Workspace not found</h1>
        <p className="text-[13px] text-[var(--sa-text-secondary)] mb-6">
          The workspace you&apos;re looking for either doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Link href="/" className="inline-block rounded-lg bg-[var(--sa-accent)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity">
          Back to home
        </Link>
      </div>
    </div>
  );
}
