// globals.css locks html and body to the viewport with overflow:hidden,
// because the agency shell is a fixed-height column that scrolls its own
// panes. Anything outside that shell therefore has to bring its own
// scroller or it is simply clipped at one screen — which is what happened
// to the studio link: a studio with four packs could see three.
//
// app/portal/layout.tsx does exactly this for the client portal.
export default function PacksLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto">{children}</div>;
}
