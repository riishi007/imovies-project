
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Show = require('../models/Show');

const BOOKING_EXPIRY_MINUTES = 10;

async function expirePendingBookings(io) {
  const expiryTime = new Date(
    Date.now() - BOOKING_EXPIRY_MINUTES * 60 * 1000
  );

  // Find only unpaid bookings that have expired.
  const expiredBookings = await Booking.find({
    status: 'Pending',
    paymentStatus: { $in: ['Pending', 'Failed'] },
    createdAt: { $lte: expiryTime },
  }).select('_id show selectedSeats');

  for (const item of expiredBookings) {
    const session = await mongoose.startSession();
    let releasedSeats = null;

    try {
      await session.withTransaction(async () => {
        // Claim the booking only if it is still pending and expired.
        const booking = await Booking.findOneAndUpdate(
          {
            _id: item._id,
            status: 'Pending',
            paymentStatus: { $in: ['Pending', 'Failed'] },
            createdAt: { $lte: expiryTime },
          },
          {
            $set: { status: 'Cancelled' },
          },
          {
            returnDocument: 'after',
            session
          }
        );

        // Another process may already have handled it.
        if (!booking) return;

        const seatNumbers = booking.selectedSeats;
        const show = await Show.findById(booking.show).session(session);

        if (!show) {
          throw new Error(
            `Show not found for expired booking ${booking._id}`
          );
        }

        const matchingSeats = show.seats.filter((seat) =>
          seatNumbers.includes(seat.seatNumber)
        );

        if (
          matchingSeats.length !== seatNumbers.length ||
          matchingSeats.some((seat) => !seat.isBooked)
        ) {
          throw new Error(
            `Seat state inconsistent for expired booking ${booking._id}`
          );
        }

        const result = await Show.updateOne(
          {
            _id: show._id,
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
            $set: { 'seats.$[seat].isBooked': false },
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

        if (result.modifiedCount !== 1) {
          throw new Error(
            `Could not release seats for booking ${booking._id}`
          );
        }

        releasedSeats = {
          showId: String(booking.show),
          seatNumbers: [...seatNumbers],
        };
      });

      // Notify connected seat-selection pages only after commit.
      if (releasedSeats && io) {
        io.to(`show-${releasedSeats.showId}`).emit('seatUpdated', {
          showId: releasedSeats.showId,
          seatNumbers: releasedSeats.seatNumbers,
          isBooked: false,
        });
      }

      if (releasedSeats) {
        console.log(`Expired unpaid booking: ${item._id}`);
      }
    } catch (error) {
      console.error(
        `Could not expire booking ${item._id}:`,
        error.message
      );
    } finally {
      await session.endSession();
    }
  }
}

module.exports = expirePendingBookings;
