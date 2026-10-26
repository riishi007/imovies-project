import axios from 'axios';

// Create an Axios instance with your backend base URL
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
    headers: {
        'Content-Type': 'application/json',
          },
          });

          // Request Interceptor: Automatically attach the JWT token to headers if the user is logged in
          API.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem('token');
                    if (token) {
                          config.headers.Authorization = `Bearer ${token}`;
                              }
                                  return config;
                                    },
                                      (error) => Promise.reject(error)
                                      );

                                      // --- AUTHENTICATION API CALLS ---
                                      export const registerUser = (userData) => API.post('/auth/register', userData);
                                      export const loginUser = (credentials) => API.post('/auth/login', credentials);

                                      // --- MOVIE API CALLS ---
                                      export const getMovies = (params = {}) =>
                                        API.get('/movies', { params });// Supports filters & pagination
                                      export const getMovieById = (id) => API.get(`/movies/${id}`);
                                      export const createMovie = (movieData) =>
                                        API.post('/movies', movieData);// Admin
                                      export const updateMovie = (movieId, movieData) =>
                                        API.put(`/movies/${movieId}`, movieData);

                                      export const deleteMovie = (movieId) =>
                                        API.delete(`/movies/${movieId}`);
                                      // --- SHOWS & THEATRES API CALLS ---
                                      export const getShowsByMovie = (movieId) => API.get(`/shows/movie/${movieId}`);
                                      export const getSeatsByShow = (showId) => API.get(`/shows/${showId}/seats`);

export const getTheatres = () => API.get('/theatres');

export const getTheatreById = (id) =>
  API.get(`/theatres/${id}`);

export const createTheatre = (theatreData) =>
  API.post('/theatres', theatreData);

export const updateTheatre = (id, theatreData) =>
  API.put(`/theatres/${id}`, theatreData);

export const deleteTheatre = (id) =>
  API.delete(`/theatres/${id}`);

export const getShows = () => API.get('/shows');

export const createShow = (showData) =>
  API.post('/shows', showData);

export const deleteShow = (showId) =>
  API.delete(`/shows/${showId}`);

                                      // --- BOOKING API CALLS ---
                                      export const createBooking = (bookingData) => API.post('/bookings', bookingData);
                                      export const getUserBookings = () => API.get('/bookings/my');
                                      export const cancelBooking = (bookingId) => API.patch(`/bookings/${bookingId}/cancel`);
 // --- PAYMENT API CALLS ---

 // Create a Razorpay order for a pending booking
 export const createPaymentOrder = (bookingId) =>
   API.post('/payments/create-order', { bookingId });

 // Verify the payment with the backend
 export const verifyPayment = (paymentData) =>
   API.post('/payments/verify', paymentData);



                                      export default API;
