import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMovieById, getShowsByMovie } from '../services/api';

function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
          try {
                  const movieRes = await getMovieById(id);
                      setMovie(movieRes.data);

                          const showsRes = await getShowsByMovie(id);
                              setShows(showsRes.data);
                                } catch (err) {
                                        console.error(
                                                  "Error fetching details:",
                                                        err.response?.data || err.message
                                                            );
                                                          } finally {
                                                                  setLoading(false);
                                                                    }
                                                                };

    fetchData();
  }, [id]);

  if (loading) return <p className="text-center mt-5">Loading show details...</p>;
  if (!movie) return <p className="text-center mt-5 text-danger">Movie not found.</p>;

  return (
    <div className="container">
      <div className="row mb-5">
        <div className="col-md-4">
          <img
            src={movie.posterUrl || 'https://via.placeholder.com/300x400?text=No+Poster'}
            alt={movie.title}
            className="img-fluid rounded shadow"
          />
        </div>
        <div className="col-md-8">
          <h1 className="text-danger fw-bold">{movie.title}</h1>
          <p className="badge bg-secondary me-2">{movie.genre}</p>
          <p className="badge bg-secondary me-2">{movie.language}</p>
          <p className="badge bg-secondary">{movie.duration} mins</p>
          <p className="mt-3 lead">{movie.description}</p>
        </div>
      </div>

      <h3 className="mb-3 text-warning">Available Showtimes</h3>
      {shows.length === 0 ? (
        <p className="text-muted">No showtimes scheduled for this movie yet.</p>
      ) : (
        <div className="list-group">
          {shows.map((show) => (
            <div key={show._id} className="list-group-item bg-dark text-white border-secondary d-flex justify-content-between align-items-center p-3 mb-2 rounded">
              <div>
                <h5 className="mb-1 text-info">{show.theatre?.name || 'Theatre'}</h5>
                <p className="mb-0 text-muted small">{show.theatre?.location}</p>
                <p className="mb-0 text-warning">{new Date(show.showTime).toLocaleString()}</p>
              </div>
              <div className="text-end">
                <span className="fs-5 fw-bold text-success me-3">₹{show.ticketPrice}</span>
                <Link to={`/book/${show._id}`} className="btn btn-danger fw-bold">
                  Select Seats
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MovieDetails;