import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import os from 'os'

// Get local IPv4 address (ignore APIPA 169.254.x.x and loopback)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const validIPs: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
          return net.address;
        }
        validIPs.push(net.address);
      }
    }
  }
  return validIPs.length > 0 ? validIPs[0] : '192.168.31.233';
}

const localIP = getLocalIP()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __LOCAL_IP__: JSON.stringify(localIP)
  },
  server: {
    host: true, // Listen on all local IPs
    port: 80,
    strictPort: true, // Don't change port if in use
    allowedHosts: true, // Allow all hosts to bypass the 'Blocked request' error
    proxy: {
      '/api/prints': {
        target: 'http://127.0.0.1:8082',
        changeOrigin: true,
        secure: false,
        timeout: 600000,
        proxyTimeout: 600000,
      }
    },
    watch: {
      ignored: ['**/modules/prints/backend/**', '**/modules/prints/storage/**', '**/modules/prints/database/**', '**/logs/**', '**/kalp_data/**', '**/storage/**', '**/brain/**']
    }
  }
})
