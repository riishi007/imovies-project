
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMovies, getTheatres } from '../services/api';

const PAGE_SIZE = 8;

const initialFilters = {
  search: '',
  genre: '',
  language: '',
  theatre: '',
  location: '',
  date: '',
};

function Home() {
  const [movies, setMovies] = useState([]);
  const [theatres, setTheatres] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTheatres()
      .then((response) => setTheatres(response.data))
      .catch((err) => {
        console.error('Failed to load theatres:', err);
      });
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchMovies() {
      setLoading(true);
      setError('');

      try {
        const params = {
          ...appliedFilters,
          page: pagination.page,
          limit: PAGE_SIZE,
        };

        // Do not send empty filters to the backend.
        Object.keys(params).forEach((key) => {
          if (params[key] === '') {
            delete params[key];
          }
        });

        const response = await getMovies(params);

        if (active) {
          setMovies(response.data.movies || []);
          setPagination((current) => ({
            ...current,
            ...response.data.pagination,
          }));
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              'Failed to load movies. Please try again.'
          );
          setMovies([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchMovies();

    return () => {
      active = false;
    };
  }, [appliedFilters, pagination.page]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(initialFilters);
    setAppliedFilters({ ...initialFilters });
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const goToPage = (page) => {
    if (
      page >= 1 &&
      page <= pagination.totalPages &&
      page !== pagination.page
    ) {
      setPagination((current) => ({ ...current, page }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="mb-3">IMovies - Available Movies</h2>

        <form onSubmit={handleSearch} className="card bg-dark border-secondary p-3">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label htmlFor="search" className="form-label">
                Search movies
              </label>
              <input
                id="search"
                name="search"
                type="search"
                className="form-control bg-secondary text-white border-0"
                placeholder="Search by title or description..."
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-12 col-md-3">
              <label htmlFor="genre" className="form-label">Genre</label>
              <input
                id="genre"
                name="genre"
                className="form-control bg-secondary text-white border-0"
                placeholder="e.g. Action"
                value={filters.genre}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-12 col-md-3">
              <label htmlFor="language" className="form-label">Language</label>
              <input
                id="language"
                name="language"
                className="form-control bg-secondary text-white border-0"
                placeholder="e.g. Hindi"
                value={filters.language}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-12 col-md-4">
              <label htmlFor="theatre" className="form-label">Theatre</label>
              <select
                id="theatre"
                name="theatre"
                className="form-select bg-secondary text-white border-0"
                value={filters.theatre}
                onChange={handleFilterChange}
              >
                <option value="">All theatres</option>
                {theatres.map((theatre) => (
                  <option key={theatre._id} value={theatre._id}>
                    {theatre.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label htmlFor="location" className="form-label">Location</label>
              <input
                id="location"
                name="location"
                className="form-control bg-secondary text-white border-0"
                placeholder="e.g. Bhopal"
                value={filters.location}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-12 col-md-4">
              <label htmlFor="date" className="form-label">Show date</label>
              <input
                id="date"
                name="date"
                type="date"
                className="form-control bg-secondary text-white border-0"
                value={filters.date}
                onChange={handleFilterChange}
              />
            </div>

            <div className="col-12 d-flex flex-wrap gap-2">
              <button type="submit" className="btn btn-danger">
                Search & Filter
              </button>
              <button
                type="button"
                className="btn btn-outline-light"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        </form>
      </div>

      {loading ? (
        <p className="text-center" role="status">Loading movies...</p>
      ) : error ? (
        <div className="alert alert-danger" role="alert">
          {error}
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-3"
            onClick={() => setAppliedFilters({ ...appliedFilters })}
          >
            Retry
          </button>
        </div>
      ) : movies.length === 0 ? (
        <p className="text-muted">No movies found. Try changing your filters.</p>
      ) : (
        <>
          <p className="text-muted mb-3">
            {pagination.total} movie(s) found
          </p>

          <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-4 g-4">
            {movies.map((movie) => (
              <div className="col" key={movie._id}>
                <div className="card h-100 bg-dark text-white border-secondary shadow-sm">
                  <img
                    src={
                      movie.posterUrl ||
                      'https://via.placeholder.com/300x400?text=No+Poster'
                    }
                    className="card-img-top"
                    alt={movie.title}
                    style={{ height: '350px', objectFit: 'cover' }}
                  />

                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title text-danger">{movie.title}</h5>
                    <p className="card-text text-muted mb-1">
                      {movie.genre} | {movie.language}
                    </p>
                    <p className="card-text small">
                      {(movie.description || '').slice(0, 80)}
                      {movie.description?.length > 80 ? '...' : ''}
                    </p>

                    <Link
                      to={`/movie/${movie._id}`}
                      className="btn btn-outline-danger mt-auto w-100"
                    >
                      View Shows
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <nav
              className="d-flex justify-content-center align-items-center gap-3 mt-4"
              aria-label="Movie pages"
            >
              <button
                className="btn btn-outline-light"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
              >
                Previous
              </button>

              <span aria-live="polite">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                className="btn btn-outline-light"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export default Home;
