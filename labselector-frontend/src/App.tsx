// src/App.tsx
import React, { useState } from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.tsx';
import ExerciseList from './ExerciseList.tsx';
import ExerciseDetail from './ExerciseDetail.tsx';
import Login from './Login.tsx';
import Signup from './Signup.tsx';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

function App() {
  // Dark mode toggle
  const [darkMode, setDarkMode] = useState(false);
  const { token, setToken } = useAuth();  // from AuthContext

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogout = () => {
    // Clear the token, effectively logging out the user
    setToken(null);
  };

  return (
    <div className={darkMode ? 'dark-mode min-vh-100' : 'min-vh-100'}>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          {/* Brand / Logo */}
          <Link className="navbar-brand" to="/">
            LabSelector
          </Link>

          {/* Right side of navbar */}
          <div className="ms-auto d-flex align-items-center">
            {/* If user is logged in, show Logout; if not, show Login/Signup */}
            {token ? (
              <>
                <button
                  onClick={handleLogout}
                  className="btn btn-outline-light me-2"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline-light me-2">
                  Login
                </Link>
                <Link to="/signup" className="btn btn-outline-light me-2">
                  Signup
                </Link>
              </>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="btn btn-outline-light"
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </div>
        </div>
      </nav>

      {/* Main App Routes */}
      <Routes>
        {/* Protected routes */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <ExerciseList />
            </PrivateRoute>
          }
        />
        <Route
          path="/exercise/:id"
          element={
            <PrivateRoute>
              <ExerciseDetail />
            </PrivateRoute>
          }
        />

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Catch-all: redirect unknown paths */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;
