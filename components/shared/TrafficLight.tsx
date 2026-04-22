import { cn } from "@/lib/utils";

type Status = "red" | "amber" | "green" | "grey";

interface Props {
  status: Status;
  size?: number;
  label?: string;
}

const COLOR: Record<Status, string> = {
  red:   "bg-[var(--sa-danger)]",
  amber: "bg-[var(--sa-warning)]",
  green: "bg-[var(--sa-success)]",
  grey:  "bg-[var(--sa-text-tertiary)]",
};

export function TrafficDot({ status, size = 8, label }: Props) {
  return (
    <span
      className={cn("inline-block rounded-full shrink-0", COLOR[status])}
      style={{ width: size, height: size }}
      title={label}
    />
  );
}

export function TrafficLights({ statuses }: { statuses: [Status, Status, Status] }) {
  return (
    <div className="flex items-center gap-1">
      {statuses.map((s, i) => (
        <span key={i} className={cn("inline-block rounded-full w-2 h-2", COLOR[s])} />
      ))}
    </div>
  );
}
