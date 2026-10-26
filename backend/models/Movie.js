
const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    genre: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true, // in minutes
    },
    posterUrl: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Index movie titles for title-based queries.
movieSchema.index({ title: 1 });

// Support genre filtering and newest-first sorting.
movieSchema.index({ genre: 1, createdAt: -1 });

module.exports = mongoose.model('Movie', movieSchema);
