require('dotenv').config({
    path: process.env.NODE_ENV === 'development' ? '.env.development' : '.env.production'
  });
  
  module.exports = {
    botToken: process.env.BOT_TOKEN,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGO_URI,

    
  };
  