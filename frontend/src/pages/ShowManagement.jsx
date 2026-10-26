
import React, { useEffect, useState } from 'react';
import {
  getMovies,
  getTheatres,
  getShows,
  createShow,
  deleteShow,
} from '../services/api';

function ShowManagement() {
  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [shows, setShows] = useState([]);

  const [form, setForm] = useState({
    movie: '',
    theatre: '',
    showTime: '',
    ticketPrice: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');


const fetchData = async () => {
  try {
    setLoading(true);

    const [movieRes, theatreRes, showRes] = await Promise.all([
      getMovies(),
      getTheatres(),
      getShows(),
    ]);

    // Handle API responses that return arrays or wrapped arrays
    const movieData = movieRes.data;
    const theatreData = theatreRes.data;
    const showData = showRes.data;

    const movieList = Array.isArray(movieData)
      ? movieData
      : Array.isArray(movieData?.movies)
        ? movieData.movies
        : Array.isArray(movieData?.data)
          ? movieData.data
          : [];

    const theatreList = Array.isArray(theatreData)
      ? theatreData
      : Array.isArray(theatreData?.theatres)
        ? theatreData.theatres
        : Array.isArray(theatreData?.data)
          ? theatreData.data
          : [];

    const showList = Array.isArray(showData)
      ? showData
      : Array.isArray(showData?.shows)
        ? showData.shows
        : Array.isArray(showData?.data)
          ? showData.data
          : [];

    setMovies(movieList);
    setTheatres(theatreList);
    setShows(showList);
    setError('');
  } catch (err) {
    console.error(
      'Failed to load show management data:',
      err.response?.data || err.message
    );

    setError(
      err.response?.data?.message ||
        'Could not load movies, theatres, or shows.'
    );
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchData();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setForm({
      movie: '',
      theatre: '',
      showTime: '',
      ticketPrice: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const selectedDate = new Date(form.showTime);

    if (
      !form.movie ||
      !form.theatre ||
      !form.showTime ||
      Number.isNaN(selectedDate.getTime()) ||
      Number(selectedDate) <= Date.now()
    ) {
      setError('Select a movie, theatre, and a future show date and time.');
      return;
    }

    if (!Number.isFinite(Number(form.ticketPrice)) ||
        Number(form.ticketPrice) <= 0) {
      setError('Ticket price must be greater than zero.');
      return;
    }

    setSaving(true);

    try {
      await createShow({
        movie: form.movie,
        theatre: form.theatre,
        showTime: selectedDate.toISOString(),
        ticketPrice: Number(form.ticketPrice),
      });

      setMessage('Show created successfully!');
      resetForm();
      await fetchData();
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to create show.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this show?')) {
      return;
    }

    setError('');
    setMessage('');

    try {
      await deleteShow(id);
      setShows((prev) => prev.filter((show) => show._id !== id));
      setMessage('Show deleted successfully!');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to delete show.'
      );
    }
  };

  return (
    <div className="container py-4">
      <h2 className="text-warning mb-4">Show Management</h2>

      {message && (
        <div className="alert alert-success">{message}</div>
      )}

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      <div className="card bg-dark text-white border-secondary p-4 mb-5">
        <h4 className="text-warning mb-3">Create New Show</h4>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">Movie</label>
            <select
              name="movie"
              className="form-select"
              value={form.movie}
              onChange={handleChange}
              required
            >
              <option value="">Select a movie</option>
              {(Array.isArray(movies) ? movies : []).map((movie) => (
                <option key={movie._id} value={movie._id}>
                  {movie.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label className="form-label">Theatre</label>
            <select
              name="theatre"
              className="form-select"
              value={form.theatre}
              onChange={handleChange}
              required
            >
              <option value="">Select a theatre</option>
              {theatres.map((theatre) => (
                <option key={theatre._id} value={theatre._id}>
                  {theatre.name} — {theatre.location}
                </option>
              ))}
            </select>
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Show Date & Time</label>
              <input
                type="datetime-local"
                name="showTime"
                className="form-control"
                value={form.showTime}
                onChange={handleChange}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                  .toISOString()
                  .slice(0, 16)}
                required
              />
            </div>

            <div className="col-md-6 mb-3">
              <label className="form-label">Ticket Price (₹)</label>
              <input
                type="number"
                name="ticketPrice"
                className="form-control"
                min="1"
                step="0.01"
                value={form.ticketPrice}
                onChange={handleChange}
                placeholder="e.g. 250"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-warning fw-bold"
            disabled={saving}
          >
            {saving ? 'Creating...' : 'Create Show'}
          </button>
        </form>
      </div>

      <h4 className="text-warning mb-3">All Shows</h4>

      {loading ? (
        <p>Loading shows...</p>
      ) : shows.length === 0 ? (
        <p>No shows found. Create your first show above.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-dark table-striped align-middle">
            <thead>
              <tr>
                <th>Movie</th>
                <th>Theatre</th>
                <th>Show Time</th>
                <th>Ticket Price</th>
                <th>Seats</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {shows.map((show) => (
                <tr key={show._id}>
                  <td>{show.movie?.title || 'Unknown movie'}</td>
                  <td>{show.theatre?.name || 'Unknown theatre'}</td>
                  <td>
                    {show.showTime
                      ? new Date(show.showTime).toLocaleString()
                      : 'Not set'}
                  </td>
                  <td>₹{show.ticketPrice}</td>
                  <td>{show.seats?.length || 0}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(show._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ShowManagement;
