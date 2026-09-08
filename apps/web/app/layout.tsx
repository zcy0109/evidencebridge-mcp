import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvidenceBridge Multimodal MCP",
  description: "Auditable, citation-verified research workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand"><span className="brand-mark">EB</span><span>EvidenceBridge</span></Link>
          <nav><Link href="/">Workbench</Link><Link href="/audit">Audit trail</Link><a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">MCP</a></nav>
          <span className="status-pill"><i /> deterministic demo</span>
        </header>
        {children}
      </body>
    </html>
  );
}
