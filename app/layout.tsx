import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Scrybe",
  description: "Audio transcriber with word-level sync and editable transcripts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="bottom-right" richColors />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
