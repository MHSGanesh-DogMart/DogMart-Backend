const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding sample data...');

    const user = await prisma.user.upsert({
        where: { email: 'test@dogmart.app' },
        update: {},
        create: {
            email: 'test@dogmart.app',
            name: 'Test Admin',
            phone: '1234567890',
        },
    });

    const category = await prisma.category.create({
        data: { name: 'Golden Retriever', emoji: '🦮' }
    });

    await prisma.listing.createMany({
        data: [
            { userId: user.uid, title: 'Cute Golden Puppy', breedName: 'Golden Retriever', price: 15000, status: 'pending', description: 'Very friendly and vaccinated.' },
            { userId: user.uid, title: 'Active Golden Labrador', breedName: 'Labrador', price: 12000, status: 'active', description: 'Loves to play fetch.' },
        ]
    });

    console.log('Seeding complete!');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
