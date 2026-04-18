import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a781537c1a1549c0b33081a33a63309d',
  appName: 'Khanismita Delivery',
  webDir: 'dist',
  server: {
<<<<<<< HEAD
    // Loads your live website inside the native app shell.
    // Change to your production domain if you want the app to use that instead.
=======
    // Loads your live production website inside the native app shell.
>>>>>>> e104f075c43b9ed4510a2441407f0b5e1d7d4708
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
