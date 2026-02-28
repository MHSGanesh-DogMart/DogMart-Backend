const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // IMPORTANT: If password contains special chars like @, encode them:
        //   @ → %40,  # → %23,  $ → %24
        // Original password DogMart@517 → DogMart%40517
        const mongoURI = process.env.MONGO_URI
            || 'mongodb+srv://DogMart:DogMart%40517@dogmart.vvukrla.mongodb.net/?retryWrites=true&w=majority&appName=DogMart';

        await mongoose.connect(mongoURI);

        console.log('📦 MongoDB Connected Successfully');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        // Server stays alive — Firebase routes still work without Mongo
    }
};

module.exports = connectDB;
