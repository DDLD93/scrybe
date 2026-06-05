import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { AppLayout } from "@/components/layout/app-layout";
import { BrandProvider } from "@/components/brand/brand-provider";
import { BrandStyles } from "@/components/brand/brand-styles";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { branding } from "@/lib/branding";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: branding.name,
    description: branding.tagline,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        <BrandStyles />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <BrandProvider brand={branding}>
            <TooltipProvider>
              <AppLayout>{children}</AppLayout>
              <Toaster position="bottom-right" richColors />
            </TooltipProvider>
          </BrandProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
