require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Groq = require('groq-sdk');
const User = require('./models/User');
const TownPost = require('./models/TownPost');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// --- AUTH MIDDLEWARE ---
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function servantOnly(req, res, next) {
  if (req.user.role !== 'public_servant') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// --- AUTH ROUTES ---

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });
    const user = await User.create({ name, email, password, role: role || 'citizen' });
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- POSTS ROUTES ---

// GET /api/posts?lat=&lng=&radius=km  — nearby feed (publlic, no auth required)
app.get('/api/posts', async (req, res) => {
  try {
    const { lat, lng, radius = 5 } = req.query;
    const radiusMeters = parseFloat(radius) * 1000;

    const query = lat && lng ? {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: radiusMeters
        }
      }
    } : {};

    const posts = await TownPost.find(query).sort({ createdAt: -1 }).limit(50);
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// POST /api/posts — create post (requires auth)
app.post('/api/posts', auth, async (req, res) => {
  try {
    const { content, lat, lng } = req.body;
    if (!content || !lat || !lng) return res.status(400).json({ error: 'content, lat, lng required' });

    // AI classification
    let postType = 'Update';
    let priority = 'Low';
    try {
      const aiResponse = await groq.chat.completions.create({
        model: 'qwen/qwen3-32b',
        messages: [
          {
            role: 'system',
            content: 'Analyze this community post. Return JSON with exactly: {"postType": "Update" or "Issue", "priority": "Low" or "Medium" or "High"}'
          },
          { role: 'user', content }
        ],
        response_format: { type: 'json_object' }
      });
      const parsed = JSON.parse(aiResponse.choices[0].message.content);
      postType = parsed.postType || 'Update';
      priority = parsed.priority || 'Low';
    } catch (aiErr) {
      console.warn('AI classification failed, using defaults:', aiErr.message);
    }

    const post = await TownPost.create({
      author: req.user.id,
      authorName: req.user.name,
      content,
      location: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      postType,
      priority
    });

    res.status(201).json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// --- PUBLIC SERVANT ROUTES ---

// GET /api/servant/issues — all issues (servants only)
app.get('/api/servant/issues', auth, servantOnly, async (req, res) => {
  try {
    const issues = await TownPost.find({ postType: 'Issue' }).sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// PATCH /api/servant/issues/:id/reply — add reply
app.patch('/api/servant/issues/:id/reply', auth, servantOnly, async (req, res) => {
  try {
    const { reply } = req.body;
    const post = await TownPost.findByIdAndUpdate(
      req.params.id,
      { servantReply: reply, status: 'Acknowledged' },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reply' });
  }
});

// PATCH /api/servant/issues/:id/resolve — mark resolved
app.patch('/api/servant/issues/:id/resolve', auth, servantOnly, async (req, res) => {
  try {
    const post = await TownPost.findByIdAndUpdate(
      req.params.id,
      { status: 'Resolved' },
      { new: true }
    );
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve issue' });
  }
});

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

module.exports = app;
