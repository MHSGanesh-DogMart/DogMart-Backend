// src/config/database.js — Prisma client singleton for AWS RDS PostgreSQL
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

async function connectDB() {
    try {
        await prisma.$connect();
        console.log('✅ PostgreSQL (RDS) Connected via Prisma');
    } catch (err) {
        console.error('❌ Prisma connection error:', err.message);
        process.exit(1);
    }
}

module.exports = { prisma, connectDB };
