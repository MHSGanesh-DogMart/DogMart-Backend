const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'categories'
        `;
        console.log('--- Columns in categories table ---');
        console.log(JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error('SQL Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
