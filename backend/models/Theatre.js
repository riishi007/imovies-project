
const mongoose = require('mongoose');

const theatreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    totalScreens: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// Optimize newest-first theatre listings.
theatreSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Theatre', theatreSchema);
