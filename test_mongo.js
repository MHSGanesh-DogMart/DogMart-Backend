require('dotenv').config();
const mongoose = require('mongoose');
const Chat = require('./src/models/Chat');

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const doc = await Chat.findOneAndUpdate(
            { chatId: 'testA_testB' },
            {
                $set: {
                    participants: ['testA', 'testB'],
                    lastMessage: 'hello',
                    lastMessageTime: new Date(),
                    lastSenderId: 'testA',
                    isActive: true
                },
                $inc: { unreadCount: 1 }
            },
            { upsert: true, returnDocument: 'after' }
        );
        console.log('Created!', doc);
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
test();
