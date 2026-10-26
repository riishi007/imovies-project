const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register Route
router.post('/register', async (req, res) => {
  try {
      const { name, email, password } = req.body;

              // Check if user already exists
                  let user = await User.findOne({ email });
                      if (user) return res.status(400).json({ message: 'User already exists' });

                          // Hash password
                              const salt = await bcrypt.genSalt(10);
                                  const hashedPassword = await bcrypt.hash(password, salt);

                                      // Save user
                                          user = new User({
                                            name,
                                            email,
                                            password: hashedPassword,
                                            role: 'User'
                                          });
                                              await user.save();

                                                  res.status(201).json({ message: 'User registered successfully' });
                                                    } catch (err) {
                                                        res.status(500).json({ error: err.message });
                                                          }
                                                          });

                                                          // Login Route

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate input before querying MongoDB.
    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof password !== 'string' ||
      !password
    ) {
      return res.status(400).json({
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user.
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid credentials',
      });
    }

    // Validate password.
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: 'Invalid credentials',
      });
    }

    // Ensure JWT secret is configured.
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing from the environment.');
      return res.status(500).json({
        message: 'Unable to log in right now.',
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);

    return res.status(500).json({
      message: 'Unable to log in right now.',
    });
  }
});


module.exports = router;
