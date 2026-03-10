const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'categories'
            ORDER BY column_name
        `;
        console.log('--- Columns in categories table ---');
        columns.forEach(c => console.log(\`- \${c.column_name} (\${c.data_type})\`));
        
        const count = await prisma.category.count();
        console.log('--- Total Categories: ' + count + ' ---');
    } catch (e) {
        console.error('SQL Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
