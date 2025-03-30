// Import required dependencies
require('dotenv').config();
const twilio = require('twilio');

// Initialize Twilio client with credentials from environment variables
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Export the configured Twilio client
module.exports = {
  client: twilioClient,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER
}; 