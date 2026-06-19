// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "ERP Analytics Dashboard",
  description: "Real-time business intelligence over the legacy ERP",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="antialiased bg-slate-50">
        <div className="flex h-screen overflow-hidden">
          <Suspense fallback={<div className="w-60 border-r bg-white" />}>
            <Sidebar />
          </Suspense>
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
