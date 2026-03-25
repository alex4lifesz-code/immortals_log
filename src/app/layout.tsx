import type { Metadata } from "next";
import { Geist, Geist_Mono, Roboto, Cinzel, Noto_Serif, Crimson_Text, Ma_Shan_Zheng } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
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
  title: "Cultivation Workout — 修炼之路",
  description: "Forge your body through martial cultivation",
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
        {/* Theme hydration script — theme list must stay in sync with CONFIG.themes in src/lib/config.ts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cultivation-theme');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light')}var s=localStorage.getItem('cultivation-theme-style');if(s&&['midnight-ink','mountain-mist','calligraphy','sakura','sakura-dark'].indexOf(s)!==-1){document.documentElement.classList.add(s)}}catch(e){}})()`
          }}
        />
        {/* Platform detection for native-specific style hooks */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var isNative=false;if(window.Capacitor&&window.Capacitor.isNativePlatform){isNative=window.Capacitor.isNativePlatform()}else if(window.Capacitor&&window.Capacitor.getPlatform&&window.Capacitor.getPlatform()!=='web'){isNative=true}else if(window.Capacitor&&window.Capacitor.platform&&window.Capacitor.platform!=='web'){isNative=true}else if(/; wv\\)/.test(navigator.userAgent)&&/Android/.test(navigator.userAgent)){isNative=true}else if(/CapacitorNative/.test(navigator.userAgent)){isNative=true}if(isNative){document.documentElement.classList.add('native-apk')}else{document.documentElement.classList.remove('native-apk')}}catch(e){}})()`
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${roboto.variable} ${cinzel.variable} ${notoSerif.variable} ${crimsonText.variable} ${maShanZheng.variable} antialiased bg-void-black text-cloud-white transition-colors duration-500`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
