const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const categories = await prisma.category.findMany();
    console.log('--- Categories Count: ' + categories.length + ' ---');
    if (categories.length > 0) {
        console.log('Keys of first category:', Object.keys(categories[0]));
        console.log('Values of first category:', categories[0]);
    }
    await prisma.$disconnect();
}

check();
