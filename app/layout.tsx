import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArcPay Link · A link. A payment. A receipt.",
  description: "Create a USDC payment link, get paid directly on Arc, and share a verifiable receipt.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
