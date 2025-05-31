import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import inject from '@rollup/plugin-inject'

export default defineConfig({
  plugins: [
    react(),
    inject({
      Buffer: ['buffer', 'Buffer'],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      buffer: 'buffer',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@solana/web3.js', '@solana/spl-token', 'buffer'],
  },
  server: {
    port: 3000,
  },
})
