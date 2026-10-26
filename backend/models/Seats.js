
const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  show: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true,
  },
  seatNumber: {
    type: String,
    required: true,
    trim: true,
  },
  isBooked: {
    type: Boolean,
    default: false,
  },
});

// A seat number must be unique within a particular show.
seatSchema.index(
  { show: 1, seatNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('Seat', seatSchema);
