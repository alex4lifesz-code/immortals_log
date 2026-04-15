import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.immortalslog.app',
  appName: "Immortal's Log",
  webDir: 'www',
  server: {
    url: process.env.CAP_SERVER_URL ?? 'http://192.168.1.105:3000/',
    cleartext: true,
    androidScheme: 'http',
    allowNavigation: ['192.168.1.105', 'localhost'],
  },
};

export default config;
