import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SIRI-AI · JTM — Sistem Integrasi Rekabentuk & Inovasi",
  description:
    "SIRI-AI: Sistem Integrasi Rekabentuk & Inovasi JTM. Video Kemerdekaan AI, Dashboard Operasi, Modul e-Pembelajaran Drone for Beginner.",
  keywords: ["SIRI-AI", "JTM", "Jabatan Tenaga Manusia", "Kemerdekaan AI", "Drone for Beginner", "Glassmorphism"],
  authors: [{ name: "Jabatan Tenaga Manusia (JTM) Malaysia" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${inter.variable} antialiased min-h-screen flex flex-col`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        <SonnerToaster position="top-right" />
      </body>
    </html>
  );
}
