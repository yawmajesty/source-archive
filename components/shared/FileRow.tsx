import { FileText, Image, Sheet, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Document } from "@/lib/mock-data";

const TYPE_ICONS = {
  pdf: FileText,
  image: Image,
  spreadsheet: Sheet,
  other: File,
} as const;

const TYPE_COLORS = {
  pdf: "text-[var(--sa-danger)]",
  image: "text-[var(--sa-accent)]",
  spreadsheet: "text-[var(--sa-success)]",
  other: "text-[var(--sa-text-tertiary)]",
} as const;

interface Props {
  doc: Document;
}

function formatSize(kb: number) {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function FileRow({ doc }: Props) {
  const Icon = TYPE_ICONS[doc.type];
  return (
    <div className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-[var(--sa-hover)] transition-colors group cursor-default">
      <Icon size={16} className={cn("shrink-0", TYPE_COLORS[doc.type])} strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-[var(--sa-text-primary)] truncate">{doc.filename}</p>
        <p className="text-[11px] text-[var(--sa-text-tertiary)]">
          {formatSize(doc.size_kb)} · {formatDate(doc.uploaded_at)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[var(--sa-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--sa-text-tertiary)]">
        {doc.version}
      </span>
      {doc.visible_to_client && (
        <span className="shrink-0 text-[10px] text-[var(--sa-success)] font-medium">Client</span>
      )}
    </div>
  );
}
