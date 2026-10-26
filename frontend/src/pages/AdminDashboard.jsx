import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import {
  getMovies,
  createMovie,
  updateMovie,
  deleteMovie,
} from '../services/api';

const emptyMovie = {
  title: '',
  genre: '',
  language: '',
  duration: '',
  posterUrl: '',
  description: '',
};

function AdminDashboard() {
  const [movie, setMovie] = useState(emptyMovie);
  const [movies, setMovies] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response = await getMovies();
      setMovies(response.data.movies);
      setError('');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to load movies.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMovie((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    setSaving(true);

    try {
      const movieData = {
        ...movie,
        title: movie.title.trim(),
        description: movie.description.trim(),
        genre: movie.genre.trim(),
        language: movie.language.trim(),
        posterUrl: movie.posterUrl.trim(),
        duration: Number(movie.duration),
      };

      if (editingId) {
        await updateMovie(editingId, movieData);
        setMsg('Movie updated successfully!');
      } else {
        await createMovie(movieData);
        setMsg('Movie added successfully!');
      }

      setMovie(emptyMovie);
      setEditingId(null);
      await fetchMovies();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Could not save movie. Please check your login and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (selectedMovie) => {
    setMovie({
      title: selectedMovie.title || '',
      genre: selectedMovie.genre || '',
      language: selectedMovie.language || '',
      duration: String(selectedMovie.duration ?? ''),
      posterUrl: selectedMovie.posterUrl || '',
      description: selectedMovie.description || '',
    });

    setEditingId(selectedMovie._id);
    setMsg('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (movieId) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this movie?'
    );

    if (!confirmed) return;

    setMsg('');
    setError('');

    try {
      await deleteMovie(movieId);
      setMovies((prev) =>
        prev.filter((item) => item._id !== movieId)
      );

      if (editingId === movieId) {
        setMovie(emptyMovie);
        setEditingId(null);
      }

      setMsg('Movie deleted successfully!');
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to delete movie.'
      );
    }
  };

  const cancelEdit = () => {
    setMovie(emptyMovie);
    setEditingId(null);
    setMsg('');
    setError('');
  };

  return (
    <div className="container py-4">
      <h2 className="text-warning mb-4">
        Admin Dashboard
      </h2>

      <div className="mb-4">
        <Link to="/admin/theatres" className="btn btn-info">
          Manage Theatres
        </Link>
        <Link to="/admin/shows" className="btn btn-warning mb-4 ms-2">
          Manage Shows
        </Link>
      </div>

      {msg && (
        <div className="alert alert-success" role="status">
          {msg}
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div
        className="card bg-dark text-white p-4 border-secondary shadow mb-5 mx-auto"
        style={{ maxWidth: '700px' }}
      >
        <h4 className="text-warning mb-3">
          {editingId ? 'Edit Movie' : 'Add New Movie'}
        </h4>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="title" className="form-label">
              Movie Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              className="form-control"
              value={movie.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="genre" className="form-label">
                Genre
              </label>
              <input
                id="genre"
                name="genre"
                type="text"
                className="form-control"
                value={movie.genre}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-6 mb-3">
              <label htmlFor="language" className="form-label">
                Language
              </label>
              <input
                id="language"
                name="language"
                type="text"
                className="form-control"
                value={movie.language}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="duration" className="form-label">
              Duration (minutes)
            </label>
            <input
              id="duration"
              name="duration"
              type="number"
              min="1"
              step="1"
              className="form-control"
              value={movie.duration}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="posterUrl" className="form-label">
              Poster Image URL
            </label>
            <input
              id="posterUrl"
              name="posterUrl"
              type="url"
              className="form-control"
              value={movie.posterUrl}
              onChange={handleChange}
              placeholder="https://example.com/poster.jpg"
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              className="form-control"
              rows="4"
              value={movie.description}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-warning fw-bold"
            disabled={saving}
          >
            {saving
              ? 'Saving...'
              : editingId
                ? 'Update Movie'
                : 'Add Movie'}
          </button>

          {editingId && (
            <button
              type="button"
              className="btn btn-outline-light ms-2"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      <h4 className="text-warning mb-3">Manage Movies</h4>

      {loading ? (
        <p>Loading movies...</p>
      ) : movies.length === 0 ? (
        <p>No movies found. Add your first movie above.</p>
      ) : (
        <div className="row g-4">
          {movies.map((item) => (
            <div className="col-sm-6 col-lg-4" key={item._id}>
              <div className="card h-100 shadow">
                <img
                  src={item.posterUrl}
                  className="card-img-top"
                  alt={`${item.title} poster`}
                  style={{ height: '260px', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                    e.currentTarget.style.height = '0';
                  }}
                />

                <div className="card-body">
                  <h5 className="card-title">{item.title}</h5>
                  <p className="card-text">
                    {item.genre} · {item.language}
                  </p>
                  <p className="card-text">
                    Duration: {item.duration} minutes
                  </p>
                  <p className="card-text">
                    {item.description}
                  </p>

                  <button
                    className="btn btn-outline-primary me-2"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </button>

                  <button
                    className="btn btn-outline-danger"
                    onClick={() => handleDelete(item._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
