// src/App.tsx
import React, { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import ExerciseList from './ExerciseList.tsx';
import ExerciseDetail from './ExerciseDetail.tsx';

function App() {
  // Track whether dark mode is enabled
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Conditionally apply "dark-mode" class to the top-level container
  return (
    <div className={darkMode ? 'dark-mode min-vh-100' : 'min-vh-100'}>
      {/* Simple Navbar */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link className="navbar-brand" to="/">
            LabSelector
          </Link>
          <button
            onClick={toggleDarkMode}
            className="btn btn-outline-light ms-auto"
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </nav>

      {/* Main Routes */}
      <Routes>
        <Route path="/" element={<ExerciseList />} />
        <Route path="/exercise/:id" element={<ExerciseDetail />} />
      </Routes>
    </div>
  );
}

export default App;