
const request = require('supertest');
const createApp = require('../app');

describe('iMovies API - Authentication', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('should reject login when credentials are missing', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toBe(
      'Email and password are required.'
    );
  });
});
