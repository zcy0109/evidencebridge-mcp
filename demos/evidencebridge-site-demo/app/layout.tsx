import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://evidencebridge.chenyuzhanglabs.com'),
  title: 'EvidenceBridge — Research workspace',
  description:
    'Explore three prewritten research examples with source quotations, policy changes, and review boundaries.',
  openGraph: {
    title: 'EvidenceBridge Multimodal MCP',
    description:
      'Explore three prewritten research examples with source quotations, policy changes, and review boundaries.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'EvidenceBridge Multimodal MCP',
    description:
      'A truthful, deterministic demo of an auditable MCP evidence workflow.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
