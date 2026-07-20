"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import type { Comment } from "@/lib/brand-comments";
import type { Role, WorkspaceMode } from "@/lib/mode-policy";
import { can } from "@/lib/mode-policy";
import { addComment, deleteComment } from "@/app/(brand)/app/[workspace]/comments-actions";
import { cn } from "@/lib/utils";

interface Props {
  workspaceId: string;
  workspaceSlug: string;
  mode: WorkspaceMode;
  role: Role;
  currentUserId: string | null;
  collectionId: string;
  productId?: string | null;
  comments: Comment[];
  userMap: Record<string, string>;
}

export function CommentThread({
  workspaceId, workspaceSlug, mode, role, currentUserId,
  collectionId, productId, comments, userMap,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allowedToComment = can(role, "comment.create", mode);
  const scopeLabel = productId ? "Comments on this product" : "Comments on this collection";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addComment({
        workspace_id: workspaceId,
        workspace_slug: workspaceSlug,
        mode, role,
        collection_id: collectionId,
        product_id: productId ?? null,
        body,
      });
      if (!res.success) { setError(res.error); return; }
      setBody("");
      router.refresh();
    });
  }

  function handleDelete(c: Comment) {
    if (!window.confirm("Delete this comment?")) return;
    startTransition(async () => {
      const res = await deleteComment({
        workspace_slug: workspaceSlug,
        mode, role,
        comment_id: c.id,
        collection_id: collectionId,
        product_id: productId ?? null,
      });
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-[var(--sa-border)] bg-[var(--sa-window)] overflow-hidden">
      <header className="px-5 py-3 border-b border-[var(--sa-border)] bg-[var(--sa-bg)]">
        <h2 className="text-[13px] font-semibold text-[var(--sa-text-primary)]">{scopeLabel}</h2>
        <p className="text-[11px] text-[var(--sa-text-tertiary)]">
          {comments.length === 0 ? "No comments yet." : `${comments.length} message${comments.length !== 1 ? "s" : ""}.`}
        </p>
      </header>

      {comments.length > 0 && (
        <ul className="divide-y divide-[var(--sa-border)]">
          {comments.map((c) => {
            const isMine = c.user_id === currentUserId;
            const name = userMap[c.user_id] ?? c.user_id.slice(0, 8);
            const when = new Date(c.created_at);
            return (
              <li key={c.id} className="group px-5 py-3 flex gap-3">
                <div
                  className={cn(
                    "shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold uppercase",
                    isMine
                      ? "bg-[var(--sa-accent)]/15 text-[var(--sa-accent)]"
                      : "bg-[var(--sa-bg)] text-[var(--sa-text-secondary)] border border-[var(--sa-border)]",
                  )}
                >
                  {initials(name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[12px] font-semibold text-[var(--sa-text-primary)]">{name}</span>
                    <time className="text-[10px] text-[var(--sa-text-tertiary)]">{formatRelative(when)}</time>
                  </div>
                  <p className="text-[12.5px] text-[var(--sa-text-secondary)] whitespace-pre-wrap break-words">{c.body}</p>
                </div>
                {isMine && (
                  <button
                    onClick={() => handleDelete(c)}
                    className="opacity-0 group-hover:opacity-100 text-[var(--sa-text-tertiary)] hover:text-red-500 shrink-0"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {allowedToComment ? (
        <form onSubmit={submit} className="px-5 py-3 border-t border-[var(--sa-border)] bg-[var(--sa-bg)]/40">
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Leave a comment…"
              rows={2}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e as unknown as React.FormEvent);
              }}
              className="flex-1 rounded-lg border border-[var(--sa-border)] bg-[var(--sa-window)] px-3 py-2 text-[12.5px] text-[var(--sa-text-primary)] outline-none focus:border-[var(--sa-accent)] resize-none"
            />
            <button
              type="submit"
              disabled={isPending || !body.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sa-accent)] px-3 py-2 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <Send size={11} /> Post
            </button>
          </div>
          {error && <p className="mt-1.5 text-[11px] text-red-500">{error}</p>}
          <p className="mt-1 text-[10px] text-[var(--sa-text-tertiary)]">⌘/Ctrl + Enter to post</p>
        </form>
      ) : (
        <div className="px-5 py-3 border-t border-[var(--sa-border)] bg-[var(--sa-bg)]/40 text-[11px] text-[var(--sa-text-tertiary)]">
          You don't have permission to comment in this workspace.
        </div>
      )}
    </section>
  );
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
