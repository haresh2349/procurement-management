import request from 'supertest';

import { createApp } from '../src/app.js';

describe('Health API', () => {
  const app = createApp();

  it('GET /api/v1/health returns service status', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        database: 'disconnected',
      },
      message: 'Service is healthy',
    });
    expect(response.body.data.timestamp).toBeDefined();
  });
});
