import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import MovieDetails from './pages/MovieDetails';
import SeatSelection from './pages/SeatSelection';
import UserBookings from './pages/UserBookings';
import AdminDashboard from './pages/AdminDashboard';
import TheatreManagement from './pages/TheatreManagement';
import ShowManagement from './pages/ShowManagement';

function App() {
  return (
    <Router>
      <div className="min-vh-100 bg-dark text-white">
        <Navbar />
        <main className="container py-4">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/movie/:id" element={<MovieDetails />} />

            {/* Authenticated User Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/book/:showId" element={<SeatSelection />} />
              <Route path="/my-bookings" element={<UserBookings />} />
            </Route>

            {/* Admin Only Routes */}
            <Route element={<ProtectedRoute adminOnly={true} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/theatres" element={<TheatreManagement />} />
              <Route path="/admin/shows" element={<ShowManagement />} />
            </Route>
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;