import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import terser from '@rollup/plugin-terser';

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react(),
      
      ...(isProduction ? [] : [])
    ],
    build: {
      outDir: 'dist',
      sourcemap: false, 
      minify: 'terser',
      target: 'es2020', 
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      reportCompressedSize: false, 
      emptyOutDir: true,
      chunkSizeWarningLimit: 1000,
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
        mangle: isProduction ? {
          properties: false, 
        } : true,
        format: {
          comments: false,
        },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-hls': ['hls.js'],
            'vendor-icons': ['lucide-react'],
          },
          
          chunkFileNames: isProduction ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
          entryFileNames: isProduction ? 'assets/[hash].js' : 'assets/[name]-[hash].js',
          assetFileNames: isProduction ? 'assets/[hash].[ext]' : 'assets/[name]-[hash].[ext]',
        },
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'hls.js', 'lucide-react'],
      exclude: [], 
    },
    define: {
      __DEV__: !isProduction,
    },
    
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api-metadata': {
          target: 'https://h5-api.aoneroom.com/wefeed-h5api-bff',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-metadata/, ''),
          headers: {
            'Origin': 'https://moviebox.ph',
            'Referer': 'https://moviebox.ph/'
          },
          timeout: 15000
        },
        '/api-player': {
          target: 'https://123movienow.cc/wefeed-h5api-bff',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-player/, ''),
          headers: {
            'Origin': 'https://123movienow.cc',
            'Referer': 'https://123movienow.cc/'
          },
          timeout: 15000
        },
        '/api-cineverse': {
          target: 'https://cineverse.name.ng',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-cineverse/, ''),
          headers: {
            'Origin': 'https://cineverse.name.ng',
            'Referer': 'https://cineverse.name.ng/'
          },
          timeout: 15000
        },
        '/api-omegatech': {
          target: 'https://omegatech-api.dixonomega.tech',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-omegatech/, ''),
          headers: {
            'Origin': 'https://omegatech-api.dixonomega.tech',
            'Referer': 'https://omegatech-api.dixonomega.tech/'
          },
          timeout: 15000
        },
        '/api-stream': {
          target: 'https://movieapi.giftedtech.co.ke',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-stream/, ''),
          headers: {
            'Origin': 'https://movieapi.giftedtech.co.ke',
            'Referer': 'https://movieapi.giftedtech.co.ke/'
          },
          timeout: 15000
        }
      }
    },
    
    preview: {
      port: Number(process.env.PORT) || 3000,
      host: true,
      proxy: {
        '/api-metadata': {
          target: 'https://h5-api.aoneroom.com/wefeed-h5api-bff',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-metadata/, ''),
          headers: {
            'Origin': 'https://moviebox.ph',
            'Referer': 'https://moviebox.ph/'
          },
          timeout: 15000
        },
        '/api-player': {
          target: 'https://123movienow.cc/wefeed-h5api-bff',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-player/, ''),
          headers: {
            'Origin': 'https://123movienow.cc',
            'Referer': 'https://123movienow.cc/'
          },
          timeout: 15000
        },
        '/api-cineverse': {
          target: 'https://cineverse.name.ng',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-cineverse/, ''),
          headers: {
            'Origin': 'https://cineverse.name.ng',
            'Referer': 'https://cineverse.name.ng/'
          },
          timeout: 15000
        },
        '/api-omegatech': {
          target: 'https://omegatech-api.dixonomega.tech',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-omegatech/, ''),
          headers: {
            'Origin': 'https://omegatech-api.dixonomega.tech',
            'Referer': 'https://omegatech-api.dixonomega.tech/'
          },
          timeout: 15000
        },
        '/api-stream': {
          target: 'https://movieapi.giftedtech.co.ke',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api-stream/, ''),
          headers: {
            'Origin': 'https://movieapi.giftedtech.co.ke',
            'Referer': 'https://movieapi.giftedtech.co.ke/'
          },
          timeout: 15000
        }
      }
    }
  };
});
