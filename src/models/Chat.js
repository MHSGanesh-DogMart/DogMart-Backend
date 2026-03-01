const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    chatId: {
        type: String,
        required: true,
        unique: true
    },
    participants: {
        type: [String],
        required: true
    },
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageTime: {
        type: Date,
        default: Date.now
    },
    lastSenderId: {
        type: String,
        default: ''
    },
    unreadCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Chat', chatSchema);
