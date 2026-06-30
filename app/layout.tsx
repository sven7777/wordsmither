import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wordsmither",
  description:
    "Analyze your writing against AP, Chicago, APA, and MLA style — plus configurable custom rules.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
