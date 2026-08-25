import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tappy.pos',
  appName: 'Tappy',
  webDir: 'public',
  // Tappy corre con NextAuth + Prisma + middleware de servidor, así que la
  // app nativa no empaqueta archivos: abre directo tu sitio en Vercel.
  server: {
    url: 'https://pos-saas-lovat.vercel.app',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
