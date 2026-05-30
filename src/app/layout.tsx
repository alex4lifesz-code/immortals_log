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
            __html: `(function(){try{var d=document.documentElement;var themes=['discord','forest','ink-dragon','phoenix-bloom','storm-chains','obsidian-ember','mist-cultivator','frost-sect','heavenly-sword'];d.classList.remove.apply(d.classList,themes);var saved=localStorage.getItem('cultivation-theme-style');var applied=themes.indexOf(saved)>=0?saved:'discord';var modes=['dark','light','auto'];var savedMode=localStorage.getItem('cultivation-theme-mode');var mode=modes.indexOf(savedMode)>=0?savedMode:'dark';var appearance;if(mode==='auto'){appearance=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';}else{appearance=mode;}if(applied==='discord')appearance='dark';d.classList.remove('light','dark');d.classList.add(appearance);d.classList.add(applied);d.setAttribute('data-theme',applied);localStorage.setItem('cultivation-theme-style',applied);localStorage.setItem('cultivation-theme-mode',mode);localStorage.setItem('cultivation-theme',appearance);}catch(e){}})()`
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
