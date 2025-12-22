import type { Metadata } from "next";
import { Crimson_Pro, Special_Elite, Caveat } from "next/font/google";
import "./globals.css";

// Elegant serif for quotes and formal text
const crimson = Crimson_Pro({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Typewriter for typed notes
const typewriter = Special_Elite({
  variable: "--font-typewriter",
  subsets: ["latin"],
  weight: ["400"],
});

// Handwritten for personal notes
const handwritten = Caveat({
  variable: "--font-handwritten",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "The Library",
  description: "A personal collection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${crimson.variable} ${typewriter.variable} ${handwritten.variable}`}>
        {children}
      </body>
    </html>
  );
}
