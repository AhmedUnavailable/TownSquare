const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// Mock Groq so AI classification doesn't call external API
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ postType: 'Issue', priority: 'High' }) } }]
        })
      }
    }
  }));
});

process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';

const app = require('../index');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ──────────────────────────────────────────────
// AUTH ROUTES
// ──────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('registers a new user and returns token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'pass1234'
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.role).toBe('citizen');
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice', email: 'dup@example.com', password: 'pass1234'
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice2', email: 'dup@example.com', password: 'pass5678'
    });
    expect(res.status).toBe(409);
  });

  it('registers a public_servant role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bob', email: 'bob@gov.com', password: 'govpass', role: 'public_servant'
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('public_servant');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice', email: 'alice@example.com', password: 'pass1234'
    });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com', password: 'pass1234'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('returns 401 with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com', password: 'wrongpass'
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com', password: 'pass1234'
    });
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// POSTS ROUTES
// ──────────────────────────────────────────────

async function registerAndLogin(email = 'user@example.com', role = 'citizen') {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'User', email, password: 'pass1234', role
  });
  return reg.body.token;
}

describe('GET /api/posts', () => {
  it('returns empty array when no posts', async () => {
    const res = await request(app).get('/api/posts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/posts', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/posts').send({
      content: 'Hello', lat: 40.7128, lng: -74.006
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields missing', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'No coords' });
    expect(res.status).toBe(400);
  });

  it('creates a post with valid data', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Road is broken', lat: 40.7128, lng: -74.006 });
    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Road is broken');
    expect(res.body.postType).toBe('Issue');
    expect(res.body.priority).toBe('High');
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .post('/api/posts')
      .set('Authorization', 'Bearer badtoken')
      .send({ content: 'Hello', lat: 40.7128, lng: -74.006 });
    expect(res.status).toBe(401);
  });
});

// ──────────────────────────────────────────────
// SERVANT ROUTES
// ──────────────────────────────────────────────

describe('GET /api/servant/issues', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/servant/issues');
    expect(res.status).toBe(401);
  });

  it('returns 403 for citizen role', async () => {
    const token = await registerAndLogin('citizen@example.com', 'citizen');
    const res = await request(app)
      .get('/api/servant/issues')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('returns issues for public_servant', async () => {
    const servantToken = await registerAndLogin('servant@gov.com', 'public_servant');
    const citizenToken = await registerAndLogin('cit@example.com', 'citizen');

    // Create a post first
    await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ content: 'Broken streetlight', lat: 40.7, lng: -74.0 });

    const res = await request(app)
      .get('/api/servant/issues')
      .set('Authorization', `Bearer ${servantToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('PATCH /api/servant/issues/:id/reply', () => {
  it('allows servant to reply to an issue', async () => {
    const servantToken = await registerAndLogin('servant2@gov.com', 'public_servant');
    const citizenToken = await registerAndLogin('cit2@example.com', 'citizen');

    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ content: 'Water pipe leak', lat: 40.7, lng: -74.0 });

    const postId = postRes.body._id;

    const res = await request(app)
      .patch(`/api/servant/issues/${postId}/reply`)
      .set('Authorization', `Bearer ${servantToken}`)
      .send({ reply: 'We are on it!' });

    expect(res.status).toBe(200);
    expect(res.body.servantReply).toBe('We are on it!');
    expect(res.body.status).toBe('Acknowledged');
  });

  it('returns 404 for non-existent post', async () => {
    const servantToken = await registerAndLogin('servant3@gov.com', 'public_servant');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/servant/issues/${fakeId}/reply`)
      .set('Authorization', `Bearer ${servantToken}`)
      .send({ reply: 'Hello' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/servant/issues/:id/resolve', () => {
  it('allows servant to resolve an issue', async () => {
    const servantToken = await registerAndLogin('servant4@gov.com', 'public_servant');
    const citizenToken = await registerAndLogin('cit3@example.com', 'citizen');

    const postRes = await request(app)
      .post('/api/posts')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ content: 'Pothole on Main St', lat: 40.7, lng: -74.0 });

    const postId = postRes.body._id;

    const res = await request(app)
      .patch(`/api/servant/issues/${postId}/resolve`)
      .set('Authorization', `Bearer ${servantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Resolved');
  });

  it('returns 403 for citizen trying to resolve', async () => {
    const citizenToken = await registerAndLogin('cit4@example.com', 'citizen');
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/servant/issues/${fakeId}/resolve`)
      .set('Authorization', `Bearer ${citizenToken}`);
    expect(res.status).toBe(403);
  });
});
