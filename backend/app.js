
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
 const errorHandler = require('./middleware/errorHandler');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiters');

dotenv.config({ quiet: true });

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Socket.IO is attached by server.js.
  // API tests can run without starting a Socket.IO server.
  app.set('io', null);

  const authRoutes = require('./routes/authRoutes');
  const movieRoutes = require('./routes/movieRoutes');
  const bookingRoutes = require('./routes/bookingRoutes');
  const showRoutes = require('./routes/showRoutes');
  const theatreRoutes = require('./routes/theatreRoutes');
  const paymentRoutes = require('./routes/paymentRoutes');
  const notificationRoutes = require('./routes/notificationRoutes');


  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api', apiLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/movies', movieRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/shows', showRoutes);
  app.use('/api/theatres', theatreRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
