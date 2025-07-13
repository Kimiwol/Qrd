import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: process.env.PORT || 4000,
  mongoURI: process.env.MONGODB_URI,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientURL: process.env.CLIENT_URL,
  allowedOrigins: [
    "https://qrdonline.netlify.app",
    "https://quoridor-online.netlify.app",
  ]
};

if (config.nodeEnv === 'development') {
  config.allowedOrigins.push("http://localhost:3000");
}

if (config.clientURL && !config.allowedOrigins.includes(config.clientURL)) {
  config.allowedOrigins.push(config.clientURL);
}

export default config;
