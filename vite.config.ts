
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file from project root
  // Fix: Cast process to any to resolve 'cwd' not existing on type 'Process' in some environments
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Direct replacement for process.env.API_KEY in the source code
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ''),
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'react-router-dom'],
            'charts': ['recharts'],
            'utils': ['xlsx', 'jspdf', 'jspdf-autotable']
          }
        }
      }
    },
    server: {
      port: 3000,
    }
  };
});
