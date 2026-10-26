
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  getSeatsByShow,
  createBooking,
  createPaymentOrder,
  verifyPayment,
} from '../services/api';


const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    // Reuse the script if it is already loaded
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
};


// Connect to the backend Socket.IO server
const socketUrl =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') ||
  'http://localhost:5000';

const socket = io(socketUrl);

function SeatSelection() {
  const { showId } = useParams();
  const navigate = useNavigate();

  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [ticketPrice, setTicketPrice] = useState(250);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Keep the latest seats available to the Socket.IO listener
  const seatsRef = useRef([]);

  useEffect(() => {
    seatsRef.current = seats;
  }, [seats]);

  // Fetch the current seat layout from the backend
  const fetchSeats = async () => {
    try {
      setLoading(true);

      const res = await getSeatsByShow(showId);

      const seatList = Array.isArray(res.data)
        ? res.data
        : res.data?.seats || [];

      setSeats(seatList);

      if (res.data?.ticketPrice != null) {
        setTicketPrice(Number(res.data.ticketPrice));
      }
    } catch (err) {
      console.error(
        'Failed to load seats:',
        err.response?.data || err.message
      );

      setSeats([]);
    } finally {
      setLoading(false);
    }
  };

  // Join the show room and listen for live seat updates
  useEffect(() => {
    if (!showId) return;

    fetchSeats();

    const handleSeatUpdated = ({
      showId: updatedShowId,
      seatNumbers,
      isBooked,
    } = {}) => {
      if (
        String(updatedShowId) !== String(showId) ||
        !Array.isArray(seatNumbers) ||
        typeof isBooked !== 'boolean'
      ) {
        return;
      }

      // Update the seat layout in real time
      setSeats((prevSeats) =>
        prevSeats.map((seat) =>
          seatNumbers.includes(seat.seatNumber)
            ? { ...seat, isBooked }
            : seat
        )
      );

      // Remove newly booked seats from this user's selection
      if (isBooked) {
        const affectedSeatIds = seatsRef.current
          .filter((seat) =>
            seatNumbers.includes(seat.seatNumber)
          )
          .map((seat) => String(seat._id));

        setSelectedSeatIds((prev) =>
          prev.filter(
            (id) => !affectedSeatIds.includes(String(id))
          )
        );
      }
    };

    socket.emit('joinShowRoom', showId);
    socket.on('seatUpdated', handleSeatUpdated);

    return () => {
      socket.off('seatUpdated', handleSeatUpdated);
      socket.emit('leaveShowRoom', showId);
    };
  }, [showId]);

  // Select or deselect an available seat
  const handleSeatClick = (seat) => {
    if (seat.isBooked || submitting) return;

    setSelectedSeatIds((prev) => {
      const seatId = String(seat._id);

      if (prev.some((id) => String(id) === seatId)) {
        return prev.filter((id) => String(id) !== seatId);
      }

      return [...prev, seat._id];
    });
  };

  // Create a booking

const handleConfirmBooking = async () => {
  if (!selectedSeatIds.length || submitting) return;

  setSubmitting(true);

  let bookingCreated = false;

  try {
    // Check selected seats against the latest UI state
    const selectedSeats = seats.filter((seat) =>
      selectedSeatIds.some(
        (id) => String(id) === String(seat._id)
      )
    );

    if (selectedSeats.length !== selectedSeatIds.length) {
      throw new Error(
        'Some selected seats are no longer available. Please select again.'
      );
    }

    if (selectedSeats.some((seat) => seat.isBooked)) {
      throw new Error(
        'One or more selected seats have already been booked.'
      );
    }

    const seatNumbers = selectedSeats.map(
      (seat) => seat.seatNumber
    );

    // 1. Create a pending booking on the backend
    const bookingResponse = await createBooking({
      show: showId,
      selectedSeats: seatNumbers,
    });

    const booking = bookingResponse.data?.newBooking;

    if (!booking?._id) {
      throw new Error(
        'Booking was created, but its ID was not returned. Check My Bookings before trying again.'
      );
    }

    bookingCreated = true;

    // 2. Load Razorpay Checkout
    const scriptLoaded = await loadRazorpayScript();

    if (!scriptLoaded) {
      throw new Error(
        'Unable to load Razorpay Checkout. Your seats may be reserved; check My Bookings before retrying.'
      );
    }

    // 3. Create a Razorpay order through your backend
    const orderResponse = await createPaymentOrder(booking._id);
    const order = orderResponse.data;

    if (!order?.keyId || !order?.orderId) {
      throw new Error(
        'Payment order details are missing. Check My Bookings before retrying.'
      );
    }

    // 4. Open Razorpay Checkout and verify the payment server-side
    await new Promise((resolve, reject) => {
      let checkoutHandled = false;

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'iMovies',
        description: `Booking ${booking._id}`,
        order_id: order.orderId,

        handler: async (response) => {
          if (checkoutHandled) return;
          checkoutHandled = true;

          try {
            const verificationResponse = await verifyPayment({
              bookingId: booking._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (
              verificationResponse.data?.booking?.status !==
                'Confirmed' ||
              verificationResponse.data?.booking?.paymentStatus !==
                'Paid'
            ) {
              throw new Error(
                'Payment verification did not confirm the booking. Check My Bookings.'
              );
            }

            resolve();
          } catch (error) {
            reject(
              new Error(
                error.response?.data?.message ||
                  error.message ||
                  'Payment verification failed. Check My Bookings before retrying.'
              )
            );
          }
        },

        modal: {
          ondismiss: () => {
            if (!checkoutHandled) {
              checkoutHandled = true;
              reject(
                new Error(
                  'Payment window closed. Your booking may still be pending; check My Bookings.'
                )
              );
            }
          },
        },

        theme: {
          color: '#dc3545',
        },
      };

      const checkout = new window.Razorpay(options);

      checkout.on('payment.failed', (response) => {
        if (checkoutHandled) return;
        checkoutHandled = true;

        reject(
          new Error(
            response.error?.description ||
              'Payment failed. Check My Bookings before retrying.'
          )
        );
      });

      checkout.open();
    });

    // Only navigate after backend verification succeeds
    alert('Payment successful! Your booking is confirmed.');
    navigate('/my-bookings');
  } catch (err) {
    console.error(
      'Booking/payment error:',
      err.response?.data || err.message
    );

    alert(
      err.response?.data?.message ||
        err.message ||
        'Unable to complete booking. Check My Bookings before retrying.'
    );

    // Refresh seat availability after a booking attempt
    await fetchSeats();
    setSelectedSeatIds([]);
  } finally {
    setSubmitting(false);
  }
};


  if (loading) {
    return (
      <p className="text-center mt-5">
        Loading seat layout...
      </p>
    );
  }

  return (
    <div className="container py-4 text-center">
      <h2 className="text-danger mb-2">
        Select Your Seats
      </h2>

      <p className="text-muted">
        Screen is at the top
      </p>

      {/* Screen */}
      <div className="w-75 mx-auto bg-light text-dark rounded-pill py-1 mb-5 fw-bold shadow">
        SCREEN THIS WAY
      </div>

      {/* Seat layout */}
      {seats.length === 0 ? (
        <p className="text-warning">
          No seats found for this show.
        </p>
      ) : (
        <div
          className="d-flex flex-wrap justify-content-center gap-3 mb-5 mx-auto"
          style={{ maxWidth: '600px' }}
        >
          {seats.map((seat) => {
            const isSelected = selectedSeatIds.some(
              (id) => String(id) === String(seat._id)
            );

            let seatClass = 'btn btn-outline-light';

            if (seat.isBooked) {
              seatClass = 'btn btn-secondary';
            } else if (isSelected) {
              seatClass = 'btn btn-success fw-bold';
            }

            return (
              <button
                key={seat._id}
                type="button"
                className={`${seatClass} style-seat`}
                style={{
                  width: '55px',
                  height: '45px',
                }}
                disabled={seat.isBooked || submitting}
                aria-pressed={isSelected}
                aria-label={`Seat ${seat.seatNumber}: ${
                  seat.isBooked
                    ? 'Booked'
                    : isSelected
                    ? 'Selected'
                    : 'Available'
                }`}
                onClick={() => handleSeatClick(seat)}
              >
                {seat.seatNumber}
              </button>
            );
          })}
        </div>
      )}

      {/* Seat legend */}
      <div className="d-flex justify-content-center flex-wrap gap-4 mb-4">
        <div>
          <span className="badge bg-light text-dark border me-1">
            A
          </span>
          Available
        </div>

        <div>
          <span className="badge bg-success me-1">
            S
          </span>
          Selected
        </div>

        <div>
          <span className="badge bg-secondary me-1">
            B
          </span>
          Booked
        </div>
      </div>

      {/* Booking summary */}
      <div
        className="card bg-dark text-light border-secondary p-3 mx-auto shadow"
        style={{ maxWidth: '400px' }}
      >
        <h5>Booking Summary</h5>

        <p className="mb-1">
          Seats Selected:{' '}
          <strong>{selectedSeatIds.length}</strong>
        </p>

        <p className="mb-3 fs-5 text-warning">
          Total Price: ₹
          {selectedSeatIds.length * ticketPrice}
        </p>

        <button
          type="button"
          className="btn btn-danger w-100 fw-bold"
          disabled={
            selectedSeatIds.length === 0 ||
            submitting ||
            seats.length === 0
          }
          onClick={handleConfirmBooking}
        >
          {submitting
            ? 'Processing Booking...'
            : 'Confirm & Pay'}
        </button>
      </div>
    </div>
  );
}

export default SeatSelection;
