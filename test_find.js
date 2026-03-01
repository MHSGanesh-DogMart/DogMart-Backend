require('dotenv').config();
const mongoose = require('mongoose');
const Chat = require('./src/models/Chat');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const chats = await Chat.find({ participants: 'testA' });
        console.log('Found:', chats.length, chats);
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
test();
