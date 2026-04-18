import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.39afa90892844e8e8447bbbc33d8c9a4',
  appName: 'Khanismita Delivery',
  webDir: 'dist',
  server: {
    url: 'https://delivery.khanismitarecipes.online',
    cleartext: true,
  },
  android: {
    useLegacyBridge: true,
  },
};

export default config;
