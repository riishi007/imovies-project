
import React, { useState, useEffect, useCallback } from 'react';
import { getUserBookings, cancelBooking } from '../services/api';
import { toast } from 'react-toastify';

function UserBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBookings = useCallback(async () => {
    try {
      setError('');
      const res = await getUserBookings();

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.bookings || [];

      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setError(
        err.response?.data?.message ||
          'Unable to load your bookings. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCancelBooking = async (bookingId) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this ticket booking?'
    );

    if (!confirmed) return;

    try {
      await cancelBooking(bookingId);
      toast.success('Booking cancelled successfully!');
      await fetchBookings();
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      toast.error(
        err.response?.data?.message || 'Failed to cancel booking.'
      );
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        Loading your bookings...
      </div>
    );
  }

  return (
    <div className="container py-4">
      <h2 className="mb-4 text-danger">My Booked Tickets</h2>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button
            className="btn btn-sm btn-outline-danger ms-3"
            onClick={() => {
              setLoading(true);
              fetchBookings();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!error && bookings.length === 0 && (
        <div className="text-center text-muted py-5">
          <h5>No bookings found</h5>
          <p>Your booked tickets will appear here.</p>
        </div>
      )}

      <div className="row row-cols-1 row-cols-md-2 g-4">
        {bookings.map((booking) => {
          const show = booking.show || {};
          const movie = show.movie || {};
          const theatre = show.theatre || {};
          const isCancelled = booking.status === 'Cancelled';

          const seats = Array.isArray(booking.selectedSeats)
            ? booking.selectedSeats
                .map((seat) =>
                  typeof seat === 'string'
                    ? seat
                    : seat?.seatNumber || ''
                )
                .filter(Boolean)
            : [];

          return (
            <div className="col" key={booking._id}>
              <div className="card bg-dark text-white border-secondary p-3 shadow-sm h-100">
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div>
                    <h4 className="text-info mb-1">
                      {movie.title || 'Movie details unavailable'}
                    </h4>

                    <p className="text-muted mb-1">
                      {theatre.name || 'Theatre details unavailable'}
                    </p>

                    <p className="text-warning small mb-2">
                      {show.showTime
                        ? new Date(show.showTime).toLocaleString()
                        : 'Show time unavailable'}
                    </p>
                  </div>

                  <span
                    className={`badge ${
                      isCancelled ? 'bg-danger' : 'bg-success'
                    }`}
                  >
                    {booking.status || 'Confirmed'}
                  </span>
                </div>

                <hr className="border-secondary" />

                <div className="d-flex justify-content-between align-items-center gap-3">
                  <div>
                    <p className="mb-1 small">
                      <strong>Seats:</strong>{' '}
                      {seats.length ? seats.join(', ') : 'Not available'}
                    </p>

                    <p className="mb-0 fw-bold text-success">
                      Total: ₹{booking.totalAmount ?? 0}
                    </p>
                  </div>

                  {!isCancelled && (
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleCancelBooking(booking._id)}
                    >
                      Cancel Booking
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UserBookings;
