const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    show: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Show',
      required: true,
    },
    selectedSeats: [
      {
        type: String,
        required: true,
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Cancelled'],
      default: 'Pending',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed', 'RefundPending', 'Refunded'],
      default: 'Pending',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Efficiently fetch a user's bookings, newest first.
bookingSchema.index({ user: 1, createdAt: -1 });

// Efficiently find a booking by its Razorpay order ID.
bookingSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);