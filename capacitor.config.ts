import type { CapacitorConfig } from "@capacitor/cli";

const SERVER_URL = process.env.CAPACITOR_SERVER_URL || "http://192.168.1.105:3000/";

const config: CapacitorConfig = {
  appId: "com.wuxia.cultivation",
  appName: "Cultivation Workout",
  webDir: "www",
  server: {
    url: SERVER_URL,
    cleartext: true,
    errorPath: "error.html",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#0d0f14",
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#0d0f14",
      showSpinner: false,
    },
  },
};

export default config;
