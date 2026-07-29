/**
 * Dynamic CORS configuration
 * Allows requests from:
 * 1. Local development (localhost, 127.0.0.1)
 * 2. Vercel Production domain
 * 3. Fallback IP addresses
 */

const allowedOrigins = [
  'http://localhost',
  'http://localhost:80',
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1',
  'http://127.0.0.1:80',
  'https://kalpanaenterprises.com',
  'https://www.kalpanaenterprises.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow known origins or any vercel.app preview URL
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS: ' + origin));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = corsOptions;
