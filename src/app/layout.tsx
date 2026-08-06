import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "UruzTraining - Gestión de Membresías",
  description: "Sistema de gestión de membresías de gimnasio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("font-sans dark", inter.variable)} suppressHydrationWarning>
      <body className={cn(inter.className, "antialiased")}>{children}</body>
    </html>
  );
}
