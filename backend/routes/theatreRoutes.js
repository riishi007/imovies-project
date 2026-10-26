
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Theatre = require('../models/Theatre');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// GET all theatres — available to logged-in users and visitors
router.get('/', async (req, res) => {
  try {
    const theatres = await Theatre.find().sort({ createdAt: -1 });
    res.json(theatres);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch theatres.' });
  }
});

// GET one theatre
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid theatre ID.' });
    }

    const theatre = await Theatre.findById(req.params.id);

    if (!theatre) {
      return res.status(404).json({ message: 'Theatre not found.' });
    }

    res.json(theatre);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch theatre.' });
  }
});

// CREATE theatre — admin only
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, location, totalScreens } = req.body;
    const screens = Number(totalScreens);

    if (
      !name?.trim() ||
      !location?.trim() ||
      !Number.isInteger(screens) ||
      screens < 1
    ) {
      return res.status(400).json({
        message: 'Name, location, and a positive whole number of screens are required.'
      });
    }

    const theatre = await Theatre.create({
      name: name.trim(),
      location: location.trim(),
      totalScreens: screens
    });

    res.status(201).json(theatre);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create theatre.' });
  }
});

// UPDATE theatre — admin only
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid theatre ID.' });
    }

    const { name, location, totalScreens } = req.body;
    const updates = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Name cannot be empty.' });
      }
      updates.name = name.trim();
    }

    if (location !== undefined) {
      if (typeof location !== 'string' || !location.trim()) {
        return res.status(400).json({ message: 'Location cannot be empty.' });
      }
      updates.location = location.trim();
    }

    if (totalScreens !== undefined) {
      const screens = Number(totalScreens);
      if (!Number.isInteger(screens) || screens < 1) {
        return res.status(400).json({
          message: 'Total screens must be a positive whole number.'
        });
      }
      updates.totalScreens = screens;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid fields supplied.' });
    }

    const theatre = await Theatre.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );

    if (!theatre) {
      return res.status(404).json({ message: 'Theatre not found.' });
    }

    res.json(theatre);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update theatre.' });
  }
});

// DELETE theatre — admin only
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid theatre ID.' });
    }

    // Prevent deleting a theatre referenced by existing shows.
    const Show = require('../models/Show');
    const existingShow = await Show.exists({ theatre: req.params.id });

    if (existingShow) {
      return res.status(409).json({
        message: 'Cannot delete this theatre while shows reference it.'
      });
    }

    const theatre = await Theatre.findByIdAndDelete(req.params.id);

    if (!theatre) {
      return res.status(404).json({ message: 'Theatre not found.' });
    }

    res.json({ message: 'Theatre deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete theatre.' });
  }
});

module.exports = router;
