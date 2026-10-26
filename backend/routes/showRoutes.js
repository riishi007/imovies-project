
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Show = require('../models/Show');
const Movie = require('../models/Movie');
const Theatre = require('../models/Theatre');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Generate 50 seats: A1-J5
const generateSeats = () => {
  const seats = [];

  for (const row of 'ABCDEFGHIJ') {
    for (let number = 1; number <= 5; number++) {
      seats.push({
        seatNumber: `${row}${number}`,
        isBooked: false,
      });
    }
  }

  return seats;
};

// GET /api/shows - Get all shows
router.get('/', async (req, res) => {
  try {
    const shows = await Show.find()
      .populate('movie')
      .populate('theatre')
      .sort({ showTime: 1 });

    res.json(shows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shows/movie/:movieId - Get shows for a movie
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;

    if (!mongoose.isValidObjectId(movieId)) {
      return res.status(400).json({ message: 'Invalid movie ID.' });
    }

    const shows = await Show.find({ movie: movieId })
      .populate('theatre')
      .sort({ showTime: 1 });

    res.json(shows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shows/:id/seats - Get seats for a show
router.get('/:id/seats', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid show ID.' });
    }

    const show = await Show.findById(id);

    if (!show) {
      return res.status(404).json({ message: 'Show not found.' });
    }

    res.json({
      seats: show.seats,
      ticketPrice: show.ticketPrice,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/shows/:id - Get one show
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid show ID.' });
    }

    const show = await Show.findById(id)
      .populate('movie')
      .populate('theatre');

    if (!show) {
      return res.status(404).json({ message: 'Show not found.' });
    }

    res.json(show);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/shows - Create a show (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { movie, theatre, showTime, ticketPrice } = req.body;

    if (
      !mongoose.isValidObjectId(movie) ||
      !mongoose.isValidObjectId(theatre)
    ) {
      return res.status(400).json({
        message: 'Please select a valid movie and theatre.',
      });
    }

    if (!showTime || Number.isNaN(Date.parse(showTime))) {
      return res.status(400).json({ message: 'Valid show date and time required.' });
    }

    if (
      ticketPrice === undefined ||
      !Number.isFinite(Number(ticketPrice)) ||
      Number(ticketPrice) <= 0
    ) {
      return res.status(400).json({
        message: 'Ticket price must be greater than zero.',
      });
    }

    const [movieExists, theatreExists] = await Promise.all([
      Movie.exists({ _id: movie }),
      Theatre.exists({ _id: theatre }),
    ]);

    if (!movieExists) {
      return res.status(404).json({ message: 'Movie not found.' });
    }

    if (!theatreExists) {
      return res.status(404).json({ message: 'Theatre not found.' });
    }

    const show = await Show.create({
      movie,
      theatre,
      showTime: new Date(showTime),
      ticketPrice: Number(ticketPrice),
      seats: generateSeats(),
    });

    const populatedShow = await Show.findById(show._id)
      .populate('movie')
      .populate('theatre');

    res.status(201).json(populatedShow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/shows/:id - Delete a show (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid show ID.' });
    }

    const show = await Show.findById(id);

    if (!show) {
      return res.status(404).json({ message: 'Show not found.' });
    }

    // Prevent deleting a show with existing bookings.
    const Booking = require('../models/Booking');
    const hasBookings = await Booking.exists({ show: id });

    if (hasBookings) {
      return res.status(409).json({
        message: 'This show has bookings and cannot be deleted.',
      });
    }

    await Show.findByIdAndDelete(id);

    res.json({ message: 'Show deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
