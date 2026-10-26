
const mongoose = require('mongoose');

const showSchema = new mongoose.Schema(
  {
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Movie',
      required: true,
    },
    theatre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Theatre',
      required: true,
    },
    showTime: {
      type: Date,
      required: true,
    },
    ticketPrice: {
      type: Number,
      required: true,
    },
    seats: [
      {
        seatNumber: {
          type: String,
          required: true,
        },
        isBooked: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

// Optimize show listings by movie and showtime.
showSchema.index({ movie: 1, showTime: 1 });

// Optimize show listings by theatre and showtime.
showSchema.index({ theatre: 1, showTime: 1 });

module.exports = mongoose.model('Show', showSchema);
