import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a781537c1a1549c0b33081a33a63309d',
  appName: 'Khanismita Delivery',
  webDir: 'dist',
  server: {
    // Loads your live production website inside the native app shell.
    url: 'https://delivery.khanismitarecipes.online',
    cleartext: true,
  },
  plugins: {
    BackgroundGeolocation: {
      // Plugin reads runtime config from JS calls; this is just a placeholder block.
    },
  },
};

export default config;
