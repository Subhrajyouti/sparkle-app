import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a781537c1a1549c0b33081a33a63309d',
  appName: 'Khanismita Delivery',
  webDir: 'dist',
  server: {
    // Loads your live website inside the native app shell.
    // Change to your production domain if you want the app to use that instead.
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
