import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto, Cinzel, Noto_Serif, Crimson_Text, Ma_Shan_Zheng } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import QueryProvider from "@/providers/QueryProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  preload: false,
  weight: ["300", "400", "500", "700"],
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson-text",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  preload: false,
});

const maShanZheng = Ma_Shan_Zheng({
  variable: "--font-ma-shan-zheng",
  subsets: ["latin"],
  weight: "400",
  preload: false,
});

export const metadata: Metadata = {
  title: "Immortal's Log — 修炼之路",
  description: "Track your martial cultivation journey in Immortal's Log",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var themes=['discord'];d.classList.remove.apply(d.classList,themes);var t=localStorage.getItem('cultivation-theme');if(t==='light'){d.classList.remove('dark');d.classList.add('light')}var applied='discord';d.classList.add(applied);localStorage.setItem('cultivation-theme-style',applied)}catch(e){}})()`
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable} ${cinzel.variable} ${notoSerif.variable} ${crimsonText.variable} ${maShanZheng.variable} antialiased bg-void-black text-cloud-white transition-colors duration-500`}
      >
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
