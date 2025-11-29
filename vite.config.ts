import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This exposes the system env variable API_KEY to the browser code
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});