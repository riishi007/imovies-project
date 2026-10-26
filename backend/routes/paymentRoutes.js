
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');

const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/authMiddleware');
const expirePendingBookings = require('../utils/expirePendingBookings');

const router = express.Router();

const BOOKING_EXPIRY_MINUTES = 10;

const getUserId = (req) => req.user?._id || req.user?.id;

const isBookingExpired = (booking) =>
  Date.now() - new Date(booking.createdAt).getTime() >=
  BOOKING_EXPIRY_MINUTES * 60 * 1000;

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay environment variables are missing.');
  }

  return {
    keyId,
    keySecret,
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
  };
}

// Create a Razorpay order for a pending, unexpired booking.
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { bookingId } = req.body;

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

    let booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found.',
      });
    }

    if (
      booking.status !== 'Pending' ||
      booking.paymentStatus !== 'Pending'
    ) {
      return res.status(409).json({
        message: 'This booking is no longer available for payment.',
      });
    }

    if (isBookingExpired(booking)) {
      // Expire the booking and release its seats through the shared worker.
      await expirePendingBookings(req.app.get('io'));

      booking = await Booking.findById(bookingId);

      return res.status(409).json({
        message:
          'This booking has expired. Please select your seats again.',
        status: booking?.status || 'Cancelled',
      });
    }

    const amountInPaise = Math.round(booking.totalAmount * 100);

    if (
      !Number.isSafeInteger(amountInPaise) ||
      amountInPaise <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid booking amount.',
      });
    }

    const { keyId, client } = getRazorpayClient();

    // Reuse the order if one has already been created.
    if (booking.razorpayOrderId) {
      return res.status(200).json({
        keyId,
        orderId: booking.razorpayOrderId,
        amount: amountInPaise,
        currency: 'INR',
        bookingId: String(booking._id),
      });
    }

    const order = await client.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: String(booking._id),
      notes: {
        bookingId: String(booking._id),
        userId: String(userId),
      },
    });

    // Only save the order if the booking is still pending and unexpired.
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        user: userId,
        status: 'Pending',
        paymentStatus: 'Pending',
        razorpayOrderId: null,
        createdAt: {
          $gt: new Date(
            Date.now() - BOOKING_EXPIRY_MINUTES * 60 * 1000
          ),
        },
      },
      {
        $set: { razorpayOrderId: order.id },
      },
      { returnDocument: 'after' }
    );

    if (!updatedBooking) {
      // An order was created externally, but the booking is no longer
      // eligible. Do not return that order to the frontend.
      await expirePendingBookings(req.app.get('io'));

      return res.status(409).json({
        message:
          'The booking expired while payment was being prepared. Please select your seats again.',
      });
    }

    return res.status(201).json({
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: String(updatedBooking._id),
    });
  } catch (err) {
    console.error('Create payment order error:', err);

    return res.status(500).json({
      message: 'Unable to create payment order.',
    });
  }
});

// Verify payment and confirm only a valid, unexpired booking.
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);

    const {
      bookingId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: 'Please log in first.',
      });
    }

    if (
      !mongoose.isValidObjectId(bookingId) ||
      typeof razorpay_order_id !== 'string' ||
      typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string'
    ) {
      return res.status(400).json({
        message: 'Invalid payment verification details.',
      });
    }

    let booking = await Booking.findOne({
      _id: bookingId,
      user: userId,
    });

    if (!booking) {
      return res.status(404).json({
        message: 'Booking not found.',
      });
    }

    // Safe retries after a payment was already verified.
    if (
      booking.status === 'Confirmed' &&
      booking.paymentStatus === 'Paid' &&
      booking.razorpayOrderId === razorpay_order_id &&
      booking.razorpayPaymentId === razorpay_payment_id
    ) {
      return res.status(200).json({
        message: 'Payment already verified.',
        booking,
      });
    }

    if (
      !booking.razorpayOrderId ||
      booking.razorpayOrderId !== razorpay_order_id
    ) {
      return res.status(409).json({
        message: 'Invalid payment order for this booking.',
      });
    }

    const { keySecret, client } = getRazorpayClient();

    // Verify the Razorpay checkout signature.
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${booking.razorpayOrderId}|${razorpay_payment_id}`)
      .digest();

    let suppliedSignature;

    try {
      suppliedSignature = Buffer.from(razorpay_signature, 'hex');
    } catch {
      return res.status(400).json({
        message: 'Payment signature verification failed.',
      });
    }

    if (
      suppliedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, suppliedSignature)
    ) {
      return res.status(400).json({
        message: 'Payment signature verification failed.',
      });
    }

    // Verify the actual payment with Razorpay.
    const payment = await client.payments.fetch(razorpay_payment_id);

    if (
      payment.order_id !== booking.razorpayOrderId ||
      payment.amount !== Math.round(booking.totalAmount * 100) ||
      payment.currency !== 'INR' ||
      payment.status !== 'captured'
    ) {
      return res.status(409).json({
        message: 'Payment has not been successfully captured.',
      });
    }

    // If expiry has passed, run the cleanup worker before deciding
    // what to do with a captured payment.
    if (
      booking.status === 'Pending' &&
      isBookingExpired(booking)
    ) {
      await expirePendingBookings(req.app.get('io'));

      booking = await Booking.findOne({
        _id: bookingId,
        user: userId,
      });
    }

    // Never reconfirm a cancelled booking. If money was captured,
    // attempt a refund and preserve the cancellation.
    if (
      !booking ||
      booking.status === 'Cancelled' ||
      booking.status !== 'Pending' ||
      booking.paymentStatus !== 'Pending' ||
      isBookingExpired(booking)
    ) {
      if (
        booking &&
        booking.status === 'Cancelled' &&
        booking.razorpayPaymentId === razorpay_payment_id &&
        ['RefundPending', 'Refunded'].includes(booking.paymentStatus)
      ) {
        return res.status(409).json({
          message:
            booking.paymentStatus === 'Refunded'
              ? 'This booking was cancelled and its payment has been refunded.'
              : 'This booking was cancelled and its refund is being processed.',
          paymentStatus: booking.paymentStatus,
        });
      }

      if (booking && booking.status === 'Pending' && isBookingExpired(booking)) {
        await expirePendingBookings(req.app.get('io'));
        booking = await Booking.findById(bookingId);
      }

      if (booking?.status === 'Cancelled') {
        // Mark the payment for reconciliation before requesting a refund.
        await Booking.updateOne(
          {
            _id: booking._id,
            status: 'Cancelled',
            razorpayOrderId: razorpay_order_id,
            paymentStatus: { $ne: 'Refunded' },
          },
          {
            $set: {
              paymentStatus: 'RefundPending',
              razorpayPaymentId: razorpay_payment_id,
            },
          }
        );

        // Re-read in case another verification request handled it.
        const latestBooking = await Booking.findById(booking._id);

        if (latestBooking?.paymentStatus === 'Refunded') {
          return res.status(409).json({
            message: 'This booking was cancelled and its payment refunded.',
            paymentStatus: 'Refunded',
          });
        }

        if (
          latestBooking?.paymentStatus === 'RefundPending' &&
          latestBooking.razorpayPaymentId === razorpay_payment_id
        ) {
          try {
            const refund = await client.payments.refund(
              razorpay_payment_id,
              {
                amount: payment.amount,
                notes: {
                  bookingId: String(booking._id),
                  reason: 'Booking expired or cancelled',
                },
              }
            );

            // Razorpay may return a pending refund before it is processed.
            const refundProcessed = refund.status === 'processed';

            await Booking.updateOne(
              {
                _id: booking._id,
                status: 'Cancelled',
                razorpayPaymentId: razorpay_payment_id,
              },
              {
                $set: {
                  paymentStatus: refundProcessed
                    ? 'Refunded'
                    : 'RefundPending',
                },
              }
            );

            return res.status(409).json({
              message: refundProcessed
                ? 'This booking was cancelled. The payment has been refunded.'
                : 'This booking was cancelled. The refund is being processed.',
              paymentStatus: refundProcessed
                ? 'Refunded'
                : 'RefundPending',
            });
          } catch (refundError) {
            console.error('Late-payment refund error:', refundError);

            return res.status(409).json({
              message:
                'This booking was cancelled, but the refund needs attention. Please contact support.',
              paymentStatus: 'RefundPending',
            });
          }
        }
      }

      return res.status(409).json({
        message:
          'This booking is no longer eligible for confirmation. Please check your bookings or contact support if payment was captured.',
        paymentStatus: booking?.paymentStatus,
      });
    }

    // Confirm only if the booking is still pending and unexpired.
    // This conditional update prevents a late verification from
    // overwriting a cancellation.
    const updatedBooking = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        user: userId,
        status: 'Pending',
        paymentStatus: 'Pending',
        razorpayOrderId: razorpay_order_id,
        createdAt: {
          $gt: new Date(
            Date.now() - BOOKING_EXPIRY_MINUTES * 60 * 1000
          ),
        },
      },
      {
        $set: {
          status: 'Confirmed',
          paymentStatus: 'Paid',
          razorpayPaymentId: razorpay_payment_id,
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedBooking) {
      // The expiry worker may have won a race with verification.
      await expirePendingBookings(req.app.get('io'));

      const latestBooking = await Booking.findById(booking._id);

      return res.status(409).json({
        message:
          'The booking expired or changed while payment was being verified. If payment was captured, please contact support for reconciliation.',
        status: latestBooking?.status,
        paymentStatus: latestBooking?.paymentStatus,
      });
    }

    // Save a persistent notification after payment confirmation.
    // Save one persistent notification per confirmed booking.
    try {
      await Notification.updateOne(
        {
          dedupeKey: `booking-confirmed:${updatedBooking._id}`,
        },
        {
          $setOnInsert: {
            user: userId,
            title: 'Booking confirmed',
            message: `Your booking has been confirmed successfully. Booking ID: ${updatedBooking._id}`,
            type: 'payment',
            isRead: false,
            dedupeKey: `booking-confirmed:${updatedBooking._id}`,
          },
        },
        { upsert: true }
      );
    } catch (notificationError) {
      // Do not turn a successful payment into a failed response.
      console.error(
        'Failed to save payment notification:',
        notificationError
      );
    }

    return res.status(200).json({
      message: 'Payment verified and booking confirmed.',
      booking: updatedBooking,
    });
  } catch (err) {
    console.error('Payment verification error:', err);

    return res.status(500).json({
      message:
        'Unable to verify payment. Please check your booking status.',
    });
  }
});

module.exports = router;
