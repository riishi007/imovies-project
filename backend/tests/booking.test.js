
const request = require('supertest');
const createApp = require('../app');

describe('iMovies API - Bookings', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('should reject booking creation without authentication', async () => {
    const response = await request(app)
      .post('/api/bookings')
      .send({
        show: '507f1f77bcf86cd799439011',
        selectedSeats: ['A1'],
      });

    expect(response.status).toBe(401);
  });
});
