import type { Metadata } from "next";
import { DM_Sans, Atkinson_Hyperlegible, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const bodySans = DM_Sans({ variable: "--font-body", subsets: ["latin"] });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Neurotype — Bionic Reading Interface",
  description:
    "Transform text into a customizable, neurodivergent-friendly focus format.",
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
      <body
        className={`${bodySans.variable} ${geistSans.variable} ${geistMono.variable} ${atkinson.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
