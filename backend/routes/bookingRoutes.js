
const express = require('express');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');

const Booking = require('../models/Booking');
const Show = require('../models/Show');
const authMiddleware = require('../middleware/authMiddleware');
const Notification = require('../models/Notification');

const router = express.Router();

const getUserId = (req) => req.user?._id || req.user?.id;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay environment variables are missing.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

const areValidSeats = (seats) =>
  Array.isArray(seats) &&
  seats.length > 0 &&
  seats.every(
    (seat) => typeof seat === 'string' && seat.trim().length > 0
  ) &&
  new Set(seats).size === seats.length;

const emitSeatUpdate = (req, showId, seatNumbers, isBooked) => {
  const io = req.app.get('io');

  if (!io) return;

  io.to(`show-${showId}`).emit('seatUpdated', {
    showId: String(showId),
    seatNumbers,
    isBooked,
  });
};

// POST /api/bookings
// Create a booking and reserve seats atomically.
router.post('/', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = getUserId(req);
    const { show, selectedSeats } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in to book seats.',
      });
    }

    if (!mongoose.isValidObjectId(show)) {
      return res.status(400).json({
        message: 'Invalid show ID.',
      });
    }

    if (!areValidSeats(selectedSeats)) {
      return res.status(400).json({
        message: 'Please select valid, unique seats.',
      });
    }

    let createdBooking;
    const bookedSeatNumbers = [...selectedSeats];

    await session.withTransaction(async () => {
      const showData = await Show.findById(show).session(session);

      if (!showData) {
        const error = new Error('Show not found.');
        error.statusCode = 404;
        throw error;
      }

      if (
        typeof showData.ticketPrice !== 'number' ||
        !Number.isFinite(showData.ticketPrice) ||
        showData.ticketPrice < 0
      ) {
        const error = new Error('Invalid ticket price for this show.');
        error.statusCode = 500;
        throw error;
      }

      const seatMap = new Map();

      for (const seat of showData.seats) {
        if (seatMap.has(seat.seatNumber)) {
          const error = new Error(
            'Duplicate seat numbers exist in this show.'
          );
          error.statusCode = 500;
          throw error;
        }

        seatMap.set(seat.seatNumber, seat);
      }

      for (const seatNumber of selectedSeats) {
        const seat = seatMap.get(seatNumber);

        if (!seat || seat.isBooked) {
          const error = new Error(
            `Seat ${seatNumber} is already booked or invalid.`
          );
          error.statusCode = 409;
          throw error;
        }
      }

      const reservationResult = await Show.updateOne(
        {
          _id: showData._id,
          seats: {
            $all: selectedSeats.map((seatNumber) => ({
              $elemMatch: {
                seatNumber,
                isBooked: false,
              },
            })),
          },
        },
        {
          $set: {
            'seats.$[seat].isBooked': true,
          },
        },
        {
          arrayFilters: [
            {
              'seat.seatNumber': { $in: selectedSeats },
              'seat.isBooked': false,
            },
          ],
          session,
        }
      );

      if (reservationResult.modifiedCount !== 1) {
        const error = new Error(
          'One or more seats are no longer available. Please refresh.'
        );
        error.statusCode = 409;
        throw error;
      }

      const calculatedTotal =
        selectedSeats.length * showData.ticketPrice;

      const bookings = await Booking.create(
        [
          {
            user: userId,
            show: showData._id,
            selectedSeats,
            totalAmount: calculatedTotal,
            status: 'Pending',
            paymentStatus: 'Pending',
          },
        ],
        { session }
      );

      createdBooking = bookings[0];
    });

    if (createdBooking) {
      emitSeatUpdate(
        req,
        createdBooking.show,
        bookedSeatNumbers,
        true
      );
    }

    return res.status(201).json({
      message: 'Booking created successfully. Complete payment to confirm it.',
      newBooking: createdBooking,
    });
  } catch (err) {
    console.error('Booking error:', err);

    return res.status(err.statusCode || 500).json({
      message:
        err.statusCode && err.statusCode < 500
          ? err.message
          : 'Unable to complete booking.',
    });
  } finally {
    await session.endSession();
  }
});

// GET /api/bookings/my
// Get the logged-in user's bookings.
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in first.',
      });
    }

    const bookings = await Booking.find({ user: userId })
      .populate({
        path: 'show',
        populate: [{ path: 'movie' }, { path: 'theatre' }],
      })
      .sort({ createdAt: -1 });

    return res.status(200).json(bookings);
  } catch (err) {
    console.error('Fetch bookings error:', err);

    return res.status(500).json({
      message: 'Unable to fetch bookings.',
    });
  }
});

// PATCH /api/bookings/:id/cancel
// Cancel an eligible booking and release its seats atomically.

router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const userId = getUserId(req);
    const bookingId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in first.',
      });
    }

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({
        message: 'Invalid booking ID.',
      });
    }

    let cancelledBooking;
    let releasedSeatNumbers = [];
    let refundRequired = false;

    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: bookingId,
        user: userId,
      }).session(session);

      if (!booking) {
        const error = new Error('Booking not found.');
        error.statusCode = 404;
        throw error;
      }

      if (booking.status === 'Cancelled') {
        const error = new Error('This booking is already cancelled.');
        error.statusCode = 409;
        throw error;
      }

      const isPaid =
        booking.status === 'Confirmed' &&
        booking.paymentStatus === 'Paid';

      const isUnpaid =
        booking.status === 'Pending' &&
        ['Pending', 'Failed'].includes(booking.paymentStatus);

      if (!isPaid && !isUnpaid) {
        const error = new Error(
          'This booking cannot be cancelled in its current payment state.'
        );
        error.statusCode = 409;
        throw error;
      }

      if (isPaid && !booking.razorpayPaymentId) {
        const error = new Error(
          'Payment ID is missing. Please contact support before cancelling.'
        );
        error.statusCode = 409;
        throw error;
      }

      const showData = await Show.findById(booking.show).session(session);

      if (!showData) {
        const error = new Error('Associated show not found.');
        error.statusCode = 404;
        throw error;
      }

      const seatNumbers = [...booking.selectedSeats];

      const matchingSeats = showData.seats.filter((seat) =>
        seatNumbers.includes(seat.seatNumber)
      );

      if (
        matchingSeats.length !== seatNumbers.length ||
        matchingSeats.some((seat) => !seat.isBooked)
      ) {
        const error = new Error(
          'Seat availability is inconsistent. Please contact support.'
        );
        error.statusCode = 409;
        throw error;
      }

      const releaseResult = await Show.updateOne(
        {
          _id: showData._id,
          seats: {
            $all: seatNumbers.map((seatNumber) => ({
              $elemMatch: {
                seatNumber,
                isBooked: true,
              },
            })),
          },
        },
        {
          $set: {
            'seats.$[seat].isBooked': false,
          },
        },
        {
          arrayFilters: [
            {
              'seat.seatNumber': { $in: seatNumbers },
              'seat.isBooked': true,
            },
          ],
          session,
        }
      );

      if (releaseResult.modifiedCount !== 1) {
        const error = new Error(
          'Could not release the seats. Please try again.'
        );
        error.statusCode = 409;
        throw error;
      }

      booking.status = 'Cancelled';

      if (isPaid) {
        booking.paymentStatus = 'RefundPending';
        refundRequired = true;
      }

      await booking.save({ session });

      cancelledBooking = booking;
      releasedSeatNumbers = seatNumbers;
    });

    // The database transaction has committed. Emit seat updates now.
    emitSeatUpdate(
      req,
      cancelledBooking.show,
      releasedSeatNumbers,
      false
    );

    let refundMessage = '';

    if (refundRequired) {
      try {
        const razorpay = getRazorpayClient();

        const refund = await razorpay.payments.refund(
          cancelledBooking.razorpayPaymentId,
          {
            amount: Math.round(cancelledBooking.totalAmount * 100),
            notes: {
              bookingId: String(cancelledBooking._id),
              reason: 'Customer cancelled booking',
            },
          }
        );

        if (refund.status === 'processed') {
          await Booking.updateOne(
            {
              _id: cancelledBooking._id,
              status: 'Cancelled',
              paymentStatus: 'RefundPending',
              razorpayPaymentId: cancelledBooking.razorpayPaymentId,
            },
            {
              $set: { paymentStatus: 'Refunded' },
            }
          );

          refundMessage = ' The refund has been processed.';
        } else {
          refundMessage =
            ' The refund is pending confirmation from Razorpay.';
        }
      } catch (refundError) {
        // Keep RefundPending. Do not claim the payment was refunded.
        console.error(
          'Razorpay refund request needs reconciliation:',
          refundError
        );

        refundMessage =
          ' The booking is cancelled, but the refund needs verification. Please contact support.';
      }
    }

    // Save a persistent cancellation notification.
    try {
      await Notification.updateOne(
        {
          dedupeKey: `booking-cancelled:${cancelledBooking._id}`,
        },
        {
          $setOnInsert: {
            user: userId,
            title: 'Booking cancelled',
            message:
              `Your booking has been cancelled. Booking ID: ${cancelledBooking._id}.` +
              (refundRequired
                ? ' Your payment refund may be pending.'
                : ''),
            type: 'cancellation',
            isRead: false,
            dedupeKey: `booking-cancelled:${cancelledBooking._id}`,
          },
        },
        { upsert: true }
      );
    } catch (notificationError) {
      console.error(
        'Failed to save cancellation notification:',
        notificationError
      );
    }

    const latestBooking = await Booking.findById(cancelledBooking._id);

    return res.status(200).json({
      message: `Booking cancelled successfully.${refundMessage}`,
      booking: latestBooking,
    });
  } catch (err) {
    console.error('Cancel booking error:', err);

    return res.status(err.statusCode || 500).json({
      message:
        err.statusCode && err.statusCode < 500
          ? err.message
          : 'Unable to cancel booking.',
    });
  } finally {
    await session.endSession();
  }
});


module.exports = router;
