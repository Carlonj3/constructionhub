const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves index.html, style.css, app.js

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'constructionhub_secret_key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/constructionhub';

// ===== CONNECT TO MONGODB =====
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ===== SCHEMAS =====

const userSchema = new mongoose.Schema({
  firstName:   { type: String, required: true },
  lastName:    { type: String, required: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  phone:       { type: String },
  password:    { type: String, required: true },
  accountType: { type: String, default: 'Client' },
  location:    { type: String, default: 'Nairobi, Kenya' },
  createdAt:   { type: Date, default: Date.now }
});

const projectSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  category:    { type: String, required: true },
  location:    { type: String, required: true },
  budget:      { type: Number, required: true },
  description: { type: String, required: true },
  postedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  bids:        { type: Number, default: 0 },
  status:      { type: String, default: 'Open' },
  createdAt:   { type: Date, default: Date.now }
});

const User    = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);

// ===== MIDDLEWARE: Verify JWT =====
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ===== ROUTES =====

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, accountType } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ firstName, lastName, email, phone, password: hashed, accountType });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { name: `${firstName} ${lastName}`, email, accountType, initials: (firstName[0] + lastName[0]).toUpperCase() }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Please fill in all fields.' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        accountType: user.accountType,
        initials: (user.firstName[0] + user.lastName[0]).toUpperCase()
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error. Try again.' });
  }
});

// GET CURRENT USER (protected)
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// UPDATE PROFILE (protected)
app.put('/api/me', authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, phone, location } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone, location },
      { new: true }
    ).select('-password');
    res.json({ message: 'Profile updated.', user });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// CHANGE PASSWORD (protected)
app.put('/api/me/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST A PROJECT (protected)
app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { title, category, location, budget, description } = req.body;
    if (!title || !category || !location || !budget || !description) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const project = await Project.create({
      title, category, location, budget, description, postedBy: req.user.id
    });
    res.status(201).json({ message: 'Project posted successfully!', project });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET ALL PROJECTS (public)
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 }).populate('postedBy', 'firstName lastName');
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET MY PROJECTS (protected)
app.get('/api/projects/mine', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => console.log(`🚀 ConstructionHub server running on port ${PORT}`));
