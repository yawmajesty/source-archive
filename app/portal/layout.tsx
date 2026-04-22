export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto">{children}</div>;
}
