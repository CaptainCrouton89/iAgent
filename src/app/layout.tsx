import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Chat App",
  description: "A simple chat interface with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50`}
      >
        <div className="flex flex-col min-h-screen">
          <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-4">
            <div className="container mx-auto px-4 flex justify-between items-center">
              <h1 className="text-2xl font-bold">AI Chat Assistant</h1>
              <nav>
                <ul className="flex space-x-6">
                  <li>
                    <Link
                      href="/"
                      className="hover:text-primary hover:underline"
                    >
                      Chat
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/planner"
                      className="hover:text-primary hover:underline"
                    >
                      Planner
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </header>
          <main className="flex-1 container mx-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
