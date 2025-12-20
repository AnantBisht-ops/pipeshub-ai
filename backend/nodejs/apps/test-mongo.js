require('dotenv').config();
const mongoose = require('mongoose');

console.log('Environment MONGO_URI:', process.env.MONGO_URI);
console.log('Environment MONGO_DB_NAME:', process.env.MONGO_DB_NAME);

const uri = process.env.MONGO_URI;
const db = process.env.MONGO_DB_NAME;

const options = {
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  dbName: db,
  autoCreate: true,
  autoIndex: true,
};

console.log('Connecting to MongoDB with:');
console.log('URI:', uri);
console.log('DB:', db);
console.log('Options:', options);

mongoose.connect(uri, options)
  .then(() => {
    console.log('✓ Connected successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Connection failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  });