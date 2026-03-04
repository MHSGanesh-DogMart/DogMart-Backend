require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')
    : ['http://localhost:5173'];

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(morgan('dev'));

// Web Landing Page
app.use(express.static(require('path').join(__dirname, '../public')));

// Fallback redirect for root api to landing page
app.get('/', (req, res) => res.sendFile(require('path').join(__dirname, '../public/index.html')));

// Swagger Documentation
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Routes — protected by admin email verification
const { verifyAdmin } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const profileRoutes = require('./routes/profile');
const dogsRoutes = require('./routes/dogs');
const providersRoutes = require('./routes/providers');

const sosRoutes = require('./routes/sos');
const reviewsRoutes = require('./routes/reviews');
const favoritesRoutes = require('./routes/favorites');

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dogs', dogsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/favorites', favoritesRoutes);

// Admin / Legacy routes
app.use('/api/users', verifyAdmin, require('./routes/users'));
app.use('/api/bookings', verifyAdmin, require('./routes/bookings'));
app.use('/api/sessions', verifyAdmin, require('./routes/sessions'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/locations', verifyAdmin, require('./routes/locations'));
app.use('/api/notifications', require('./routes/notifications')); // no admin guard — browser FCM tokens are self-managed
app.use('/api/messages', require('./routes/messages'));
app.use('/api/service-bookings', require('./routes/serviceBookings')); // Flutter + Admin panel
app.use('/api/chats', require('./routes/chats'));
app.use('/api/listings', require('./routes/listings'));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// Initialize Socket.io (DynamoDB is serverless — no DB connection step needed)
const http = require('http');
const server = http.createServer(app);

const { initSocket } = require('./socket/socketHandler');
initSocket(server);

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅  DogMart Backend running on http://0.0.0.0:${PORT}`);
    console.log(`📋  API Docs: http://localhost:${PORT}/api/health`);

    // Connect to PostgreSQL (RDS) via Prisma
    const { connectDB } = require('./config/database');
    await connectDB();

    // Initialize background cron jobs
    const { startCronJobs } = require('./cron');
    startCronJobs();
});
