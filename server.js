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
  specialty:   { type: String, default: '' },      // e.g. "Mason", "Architect", "Electrician"
  experienceYears: { type: Number, default: 0 },
  bio:         { type: String, default: '' },
  rating:      { type: Number, default: null },
  reviewCount: { type: Number, default: 0 },
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

const bidSchema = new mongoose.Schema({
  project:   { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  bidder:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount:    { type: Number, required: true },
  message:   { type: String, default: '' },
  status:    { type: String, default: 'Pending' }, // Pending | Accepted | Rejected
  createdAt: { type: Date, default: Date.now }
});

const equipmentSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  category:   { type: String, default: 'General' },
  dailyRate:  { type: Number, required: true },
  location:   { type: String, required: true },
  available:  { type: Boolean, default: true },
  owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:  { type: Date, default: Date.now }
});

const User      = mongoose.model('User', userSchema);
const Project   = mongoose.model('Project', projectSchema);
const Bid       = mongoose.model('Bid', bidSchema);
const Equipment = mongoose.model('Equipment', equipmentSchema);

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
    const projects = await Project.find().sort({ createdAt: -1 }).populate('postedBy', 'firstName lastName accountType');
    res.json(projects);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET SINGLE PROJECT (public)
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('postedBy', 'firstName lastName accountType');
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json(project);
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

// ===== BIDS =====

// PLACE A BID ON A PROJECT (protected — any account type)
app.post('/api/projects/:id/bids', authMiddleware, async (req, res) => {
  try {
    const { amount, message } = req.body;
    if (!amount) return res.status(400).json({ error: 'Bid amount is required.' });

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (String(project.postedBy) === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot bid on your own project.' });
    }

    const existing = await Bid.findOne({ project: project._id, bidder: req.user.id });
    if (existing) return res.status(400).json({ error: 'You already placed a bid on this project.' });

    const bid = await Bid.create({
      project: project._id,
      bidder: req.user.id,
      amount,
      message: message || ''
    });

    project.bids += 1;
    await project.save();

    const populated = await bid.populate('bidder', 'firstName lastName accountType');
    res.status(201).json({ message: 'Bid placed successfully!', bid: populated });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET ALL BIDS ON A PROJECT (public — so the poster and other bidders can see who's interested)
app.get('/api/projects/:id/bids', async (req, res) => {
  try {
    const bids = await Bid.find({ project: req.params.id })
      .sort({ createdAt: -1 })
      .populate('bidder', 'firstName lastName accountType');
    res.json(bids);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET BIDS I HAVE PLACED (protected)
app.get('/api/bids/mine', authMiddleware, async (req, res) => {
  try {
    const bids = await Bid.find({ bidder: req.user.id })
      .sort({ createdAt: -1 })
      .populate('project', 'title category location budget status');
    res.json(bids);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ACCEPT OR REJECT A BID (protected — only the project owner can do this)
app.put('/api/bids/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body; // 'Accepted' | 'Rejected'
    if (!['Accepted', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Accepted or Rejected.' });
    }
    const bid = await Bid.findById(req.params.id).populate('project');
    if (!bid) return res.status(404).json({ error: 'Bid not found.' });
    if (String(bid.project.postedBy) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the project owner can update this bid.' });
    }
    bid.status = status;
    await bid.save();
    if (status === 'Accepted') {
      bid.project.status = 'In Progress';
      await bid.project.save();
    }
    res.json({ message: 'Bid ' + status.toLowerCase() + '.', bid });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ===== USERS DIRECTORY (browse contractors, consultants, etc. by account type) =====
app.get('/api/users', async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) filter.accountType = req.query.type;
    const users = await User.find(filter)
      .select('firstName lastName accountType location specialty experienceYears bio rating reviewCount createdAt')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ===== EQUIPMENT LISTINGS =====

// LIST EQUIPMENT (public — anyone can browse)
app.get('/api/equipment', async (req, res) => {
  try {
    const items = await Equipment.find().sort({ createdAt: -1 }).populate('owner', 'firstName lastName accountType');
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// LIST NEW EQUIPMENT (protected — meant for Equipment Owner accounts, but any logged-in user can post one)
app.post('/api/equipment', authMiddleware, async (req, res) => {
  try {
    const { title, category, dailyRate, location } = req.body;
    if (!title || !dailyRate || !location) {
      return res.status(400).json({ error: 'Title, daily rate, and location are required.' });
    }
    const item = await Equipment.create({ title, category, dailyRate, location, owner: req.user.id });
    const populated = await item.populate('owner', 'firstName lastName accountType');
    res.status(201).json({ message: 'Equipment listed successfully!', equipment: populated });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET MY EQUIPMENT LISTINGS (protected)
app.get('/api/equipment/mine', authMiddleware, async (req, res) => {
  try {
    const items = await Equipment.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// TOGGLE EQUIPMENT AVAILABILITY (protected — owner only)
app.put('/api/equipment/:id/availability', authMiddleware, async (req, res) => {
  try {
    const item = await Equipment.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Equipment not found.' });
    if (String(item.owner) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Only the owner can update this listing.' });
    }
    item.available = !item.available;
    await item.save();
    res.json({ message: 'Availability updated.', equipment: item });
  } catch {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ===== START SERVER =====
app.listen(PORT, () => console.log(`🚀 ConstructionHub server running on port ${PORT}`));
