import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Sidebar } from "@/components/sidebar";
import { HydrationProvider } from "@/lib/state";

export const metadata: Metadata = {
  title: "SolarAI \u2014 Thermal Inspection",
  description: "Human-in-the-loop active learning pipeline for solar panel thermal inspection",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`} suppressHydrationWarning>
      <body className="min-h-full flex">
        <TooltipProvider>
          <Toaster />
          <Sidebar />
          <main className="ml-[240px] min-h-screen flex-1">
            <HydrationProvider>
              {children}
            </HydrationProvider>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
