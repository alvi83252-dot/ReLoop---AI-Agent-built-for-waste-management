import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReLoop AI — Before waste becomes waste",
  description:
    "Autonomous circular-economy intelligence platform for the NVIDIA Hack for Impact London hackathon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black">{children}</body>
    </html>
  );
}
