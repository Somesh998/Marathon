require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Serve static frontend files
// Assumes structure: /root/backend/server.js and /root/frontend/...
app.use(express.static(path.join(__dirname, '../frontend'))); 

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL; // Admin email from .env

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Mongoose Schemas ---

// User Schema and Model
const UserSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// Complaint Schema and Model
const ComplaintSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Resolved'],
        default: 'Pending'
    },
    date: {
        type: Date,
        default: Date.now
    }
});
const Complaint = mongoose.model('Complaint', ComplaintSchema);


// --- Authentication Middleware ---
const auth = (req, res, next) => {
    // Get token from header
    const token = req.header('x-auth-token');
    
    // Check if no token
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// --- Admin Specific Auth Middleware ---
const adminAuth = async (req, res, next) => {
    try {
        // First, run standard auth to get user ID
        await new Promise((resolve, reject) => {
            auth(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Check if the authenticated user is the admin
        const user = await User.findById(req.user.id);
        if (!user || user.email !== ADMIN_EMAIL) {
            return res.status(403).json({ message: 'Access denied: Admin required' });
        }
        next();
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error during admin check' });
        }
    }
};


// ---- API Routes for Authentication ----

// Registration Route
app.post('/api/register', async (req, res) => {
    const { fullName, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        user = new User({ fullName, email, password: hashedPassword });
        await user.save();
        
        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        
        res.status(201).json({ message: 'User registered successfully', token });
    } catch (err) {
        console.error('Registration Error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login Route (Returns role)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }
        
        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

        // Determine the user role
        const role = user.email === ADMIN_EMAIL ? 'admin' : 'user';
        
        res.json({ message: 'Login successful', token, username: user.fullName, role });
    } catch (err) {
        console.error('Login Error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});


// ---- API Routes for Complaints ----

// POST /api/complaints - Submit a new complaint
app.post('/api/complaints', auth, async (req, res) => {
    const { category, subject, description } = req.body;
    try {
        const newComplaint = new Complaint({
            user: req.user.id,
            category,
            subject,
            description,
            status: 'Pending'
        });
        await newComplaint.save();
        res.status(201).json({ message: 'Complaint submitted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/complaints/all - Get all complaints (Used by admin dashboard)
app.get('/api/complaints/all', auth, async (req, res) => {
    try {
        // Populate user details so admin can see who submitted the complaint
        const complaints = await Complaint.find().sort({ date: -1 }).populate('user', 'fullName email');
        res.json(complaints);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/complaints/my - Get complaints for the logged-in user
app.get('/api/complaints/my', auth, async (req, res) => {
    try {
        const myComplaints = await Complaint.find({ user: req.user.id }).sort({ date: -1 });
        res.json(myComplaints);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Admin Route to Update Complaint Status ---
app.put('/api/complaints/:id/status', adminAuth, async (req, res) => {
    const { status } = req.body;
    const complaintId = req.params.id;

    if (!['Pending', 'Resolved'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    try {
        const complaint = await Complaint.findByIdAndUpdate(
            complaintId,
            { status },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }

        res.json({ message: `Complaint ${complaintId} updated to ${status}`, complaint });
    } catch (err) {
        console.error('Update Complaint Error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- Admin Route to Generate Report (simple report) ---
app.get('/api/report', adminAuth, async (req, res) => {
    try {
        const total = await Complaint.countDocuments();
        const pending = await Complaint.countDocuments({ status: 'Pending' });
        const resolved = await Complaint.countDocuments({ status: 'Resolved' });
        
        const complaintsByCategory = await Complaint.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        res.json({
            total,
            pending,
            resolved,
            complaintsByCategory
        });
    } catch (err) {
        console.error('Report Generation Error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});


// ------------------------------------------------------------------
// ⭐ FINAL CATCH-ALL MIDDLEWARE (Fixes PathError) ⭐
// ------------------------------------------------------------------

// Serve the index.html for any request that hasn't been handled by 
// the static file middleware or the API routes. This enables client-side routing.
app.use((req, res) => {
    // Note: We use app.use without a path, which acts as a final fallback middleware.
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});


// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));