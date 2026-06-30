import type { Metadata } from "next";
import "./globals.css";

const description =
  "Analyze your writing against AP, Chicago, APA, and MLA style — plus configurable custom rules. Runs entirely in your browser: no backend, no API, no cost.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.wordsmither.com"),
  title: {
    default: "Wordsmither — local writing analysis",
    template: "%s · Wordsmither",
  },
  description,
  applicationName: "Wordsmither",
  authors: [{ name: "Derek Law" }],
  keywords: [
    "writing analysis",
    "style guide",
    "AP style",
    "Chicago style",
    "APA",
    "MLA",
    "proofreading",
    "editing",
  ],
  openGraph: {
    type: "website",
    url: "https://www.wordsmither.com",
    siteName: "Wordsmither",
    title: "Wordsmither — local writing analysis",
    description,
  },
  twitter: {
    card: "summary",
    title: "Wordsmither — local writing analysis",
    description,
  },
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
