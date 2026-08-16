/**
 * Dynamic CORS configuration
 * Allows requests from:
 * 1. Local development (localhost, 127.0.0.1)
 * 2. Vercel Production domain
 * 3. Fallback IP addresses
 */

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow Cloudflare tunnels, Vercel deployments, localhost, and local LAN subnets
    if (
      origin.includes('trycloudflare.com') ||
      origin.includes('vercel.app') ||
      origin.includes('kalpanaenterprises.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('https://192.168.') ||
      origin.startsWith('http://10.') ||
      origin.startsWith('http://172.') ||
      origin.startsWith('http://100.')
    ) {
      return callback(null, true);
    }

    // Allow everything else for open walk-in customer mobile uploads
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = corsOptions;
