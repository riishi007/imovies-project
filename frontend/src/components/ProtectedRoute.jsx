import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ adminOnly = false }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // 1. If not logged in, redirect to login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2. If route requires admin rights and user is not an admin, redirect to home page
  if (adminOnly && user?.role?.toLowerCase() !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // 3. Otherwise render the requested page component
  return <Outlet />;
};

export default ProtectedRoute;