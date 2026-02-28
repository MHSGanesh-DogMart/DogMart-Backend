const cron = require('node-cron');
const { db } = require('./config/firebase');

function startCronJobs() {
    console.log('⏰ Initializing Cron Jobs...');

    // Runs every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('🔄 Running daily subscription check...');
        try {
            const now = new Date();
            const expiredUsersSnapshot = await db.collection('users')
                .where('isPremium', '==', true)
                .where('subscriptionEnd', '<=', now)
                .get();

            if (expiredUsersSnapshot.empty) {
                console.log('✅ No expired subscriptions found today.');
                return;
            }

            const batch = db.batch();
            let count = 0;

            expiredUsersSnapshot.forEach(doc => {
                const userRef = db.collection('users').doc(doc.id);
                batch.update(userRef, { isPremium: false });
                count++;
            });

            await batch.commit();
            console.log(`✅ Revoked Premium status for ${count} users.`);

        } catch (error) {
            console.error('❌ Error executing subscription cron job:', error);
        }
    });
}

module.exports = { startCronJobs };
