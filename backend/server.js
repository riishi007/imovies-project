const dns = require('node:dns');

dns.setServers(['1.1.1.1', '8.8.8.8']);

const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const createApp = require('./app');
const expirePendingBookings = require('./utils/expirePendingBookings');

dotenv.config();

const app = createApp();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('joinShowRoom', (showId) => {
    if (typeof showId === 'string' && showId.trim()) {
      socket.join(`show-${showId}`);
    }
  });

  socket.on('leaveShowRoom', (showId) => {
    if (typeof showId === 'string' && showId.trim()) {
      socket.leave(`show-${showId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Start the expiry timer only when running the actual server.
let expireTimer;

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is missing from backend/.env');
    }

    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');

    expireTimer = setInterval(() => {
      expirePendingBookings(io).catch((error) => {
        console.error('Pending-booking expiry task failed:', error);
      });
    }, 30 * 1000);

    expireTimer.unref();

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exitCode = 1;
  }
}

async function stopServer() {
  if (expireTimer) {
    clearInterval(expireTimer);
    expireTimer = null;
  }

  io.close();

  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  startServer,
  stopServer,
};
