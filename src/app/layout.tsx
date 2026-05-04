import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import DesignThemeToggle from "@/components/DesignThemeToggle";
import FirestoreProvider from "@/components/FirestoreProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smesh Everybody",
  description: "Deine Padel Spiele, Turniere und Americano Runden",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smesh Everybody",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fffaeb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen noise-overlay`}
      >
        {/* Warm Clay League ambient background */}
        <div className="ambient-bg">
          <div className="ambient-orb w-[640px] h-[640px] bg-[#ffd900] -top-[220px] -left-[220px] animate-float" />
          <div className="ambient-orb w-[540px] h-[540px] bg-[#ffa110] top-[35%] -right-[260px] animate-float" style={{ animationDelay: '-3s' }} />
          <div className="ambient-orb w-[420px] h-[420px] bg-[#fa520f] -bottom-[120px] left-[18%] animate-float" style={{ animationDelay: '-5s' }} />
        </div>

        <main className="relative z-10 max-w-lg mx-auto pb-24 min-h-screen">
          <FirestoreProvider>
            {children}
          </FirestoreProvider>
        </main>
        <DesignThemeToggle />
        <BottomNav />
      </body>
    </html>
  );
}
