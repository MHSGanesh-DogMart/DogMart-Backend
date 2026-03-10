const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const categories = await prisma.category.findMany();
    console.log('--- Categories in DB ---');
    console.log(JSON.stringify(categories, null, 2));
    await prisma.$disconnect();
}

check();
