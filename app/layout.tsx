import type { Metadata } from "next";
import "./globals.css";
import "./map.css";
import AccountProvider from "@/components/account-provider";

export const metadata: Metadata = {
  title: "Lakbay — Your Philippines, Your Adventure",
  description:
    "Every island has a story. Explore the Philippines and create a practical, personalized travel journal.",
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
      <body className="antialiased"><AccountProvider>{children}</AccountProvider></body>
    </html>
  );
}
