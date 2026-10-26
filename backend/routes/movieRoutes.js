
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Movie = require('../models/Movie');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Validate required movie fields
const validateMovie = (data) => {
  const { title, description, genre, language, duration, posterUrl } = data;

  if (
    !title?.trim() ||
    !description?.trim() ||
    !genre?.trim() ||
    !language?.trim() ||
    !posterUrl?.trim() ||
    duration == null ||
    duration === '' ||
    !Number.isFinite(Number(duration)) ||
    Number(duration) <= 0
  ) {
    return 'All movie fields are required, and duration must be a positive number.';
  }

  return null;
};

// GET all movies (public)
router.get('/', async (req, res) => {
  try {
    const {
      search,
      genre,
      language,
      theatre,
      location,
      date
    } = req.query;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: 'Page must be positive and limit must be between 1 and 100.'
      });
    }

    const movieFilter = {};

    // Escape user input before using it in a regular expression.
    const escapeRegex = (value) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (search !== undefined) {
      if (typeof search !== 'string' || search.trim().length > 100) {
        return res.status(400).json({ message: 'Invalid search query.' });
      }

      if (search.trim()) {
        const pattern = new RegExp(escapeRegex(search.trim()), 'i');

        movieFilter.$or = [
          { title: pattern },
          { description: pattern }
        ];
      }
    }

    for (const field of ['genre', 'language']) {
      const value = req.query[field];

      if (value !== undefined) {
        if (typeof value !== 'string' || value.trim().length > 100) {
          return res.status(400).json({ message: `Invalid ${field} filter.` });
        }

        if (value.trim()) {
          movieFilter[field] = {
            $regex: escapeRegex(value.trim()),
            $options: 'i'
          };
        }
      }
    }

    const showFilter = {};

    if (theatre !== undefined) {
      if (!mongoose.isValidObjectId(theatre)) {
        return res.status(400).json({ message: 'Invalid theatre ID.' });
      }

      showFilter.theatre = new mongoose.Types.ObjectId(theatre);
    }

    if (location !== undefined) {
      if (typeof location !== 'string' || location.trim().length > 100) {
        return res.status(400).json({ message: 'Invalid location filter.' });
      }

      if (location.trim()) {
        const Theatre = require('../models/Theatre');
        const matchingTheatres = await Theatre.find({
          $or: [
            { location: { $regex: escapeRegex(location.trim()), $options: 'i' } },
            { city: { $regex: escapeRegex(location.trim()), $options: 'i' } }
          ]
        }).select('_id');

        const theatreIds = matchingTheatres.map(item => item._id);

        if (showFilter.theatre) {
          if (!theatreIds.some(id => id.equals(showFilter.theatre))) {
            return res.json({
              movies: [],
              pagination: { page, limit, total: 0, totalPages: 0 }
            });
          }
        } else {
          showFilter.theatre = { $in: theatreIds };
        }
      }
    }

    if (date !== undefined) {
      if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
      ) {
        return res.status(400).json({
          message: 'Date must use YYYY-MM-DD format.'
        });
      }

      const start = new Date(`${date}T00:00:00.000Z`);

      if (
        Number.isNaN(start.getTime()) ||
        start.toISOString().slice(0, 10) !== date
      ) {
        return res.status(400).json({ message: 'Invalid date.' });
      }

      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      showFilter.showTime = { $gte: start, $lt: end };
    }

    // Apply theatre/date filters through shows, if supplied.
    if (Object.keys(showFilter).length > 0) {
      const Show = require('../models/Show');
      const matchingShows = await Show.find(showFilter).distinct('movie');
      movieFilter._id = { $in: matchingShows };
    }

    const skip = (page - 1) * limit;

    const [movies, total] = await Promise.all([
      Movie.find(movieFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Movie.countDocuments(movieFilter)
    ]);

    res.json({
      movies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Movie listing error:', err);
    res.status(500).json({ message: 'Failed to fetch movies.' });
  }
});

// GET single movie by ID (public)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }

    const movie = await Movie.findById(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// CREATE movie (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const validationError = validateMovie(req.body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const movie = await Movie.create({
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      genre: req.body.genre.trim(),
      language: req.body.language.trim(),
      duration: Number(req.body.duration),
      posterUrl: req.body.posterUrl.trim(),
    });

    res.status(201).json({
      message: 'Movie created successfully',
      movie,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// UPDATE movie (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }

    const allowedFields = [
      'title',
      'description',
      'genre',
      'language',
      'duration',
      'posterUrl',
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }

    const existingMovie = await Movie.findById(req.params.id);

    if (!existingMovie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    const candidate = {
      title: updates.title ?? existingMovie.title,
      description: updates.description ?? existingMovie.description,
      genre: updates.genre ?? existingMovie.genre,
      language: updates.language ?? existingMovie.language,
      duration: updates.duration ?? existingMovie.duration,
      posterUrl: updates.posterUrl ?? existingMovie.posterUrl,
    };

    const validationError = validateMovie(candidate);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    for (const field of ['title', 'description', 'genre', 'language', 'posterUrl']) {
      if (updates[field] !== undefined) {
        if (typeof updates[field] !== 'string') {
          return res.status(400).json({ message: `${field} must be a string` });
        }
        updates[field] = updates[field].trim();
      }
    }

    if (updates.duration !== undefined) {
      updates.duration = Number(updates.duration);
    }

    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { returnDocument: 'after', runValidators: true }
    );

    res.json({ message: 'Movie updated successfully', movie });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE movie (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid movie ID' });
    }

    const movie = await Movie.findByIdAndDelete(req.params.id);

    if (!movie) {
      return res.status(404).json({ message: 'Movie not found' });
    }

    res.json({ message: 'Movie deleted successfully', movie });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
