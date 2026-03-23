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
    // Optimised WebView initial scale — prevent zoom inconsistencies
    initialFocus: false,
    // Override user-agent to identify Capacitor runtime reliably
    overrideUserAgent: undefined,
    // Append to UA instead of replacing to preserve WebView detection
    appendUserAgent: " CapacitorNative/3.0",
  },
  plugins: {
    App: {
      disableBackButtonHandler: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#0d0f14",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      backgroundColor: "#0d0f14",
      style: "DARK",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
