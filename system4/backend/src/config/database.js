const mongoose = require('mongoose');
const logger = require('electron-log');

/**
 * MongoDB connection configuration
 * Establishes connection to MongoDB and handles connection events
 */
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variables or use default local connection
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gaana';
    
    // Connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: true,
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
      console.error(`MongoDB connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected, attempting to reconnect...');
      console.warn('MongoDB disconnected, attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
      console.info('MongoDB reconnected successfully');
    });
    
    // Handle application termination - close MongoDB connection properly
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB; 