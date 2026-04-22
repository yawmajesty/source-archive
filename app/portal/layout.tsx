export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="overflow-y-auto">{children}</div>;
}
