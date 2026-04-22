import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Source[Archive]",
  description: "Manage your sourcing pipeline, clients, and factories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sa-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
