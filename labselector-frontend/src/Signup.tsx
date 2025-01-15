// src/Signup.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/signup', { email, password });
      alert('Signup successful. You can now log in!');
      navigate('/login');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Signup failed');
    }
  };

  return (
    <div className="container py-4" style={{ maxWidth: '400px' }}>
      <h2 className="mb-3">Sign Up</h2>
      <form onSubmit={handleSignup}>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input 
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input 
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        <button className="btn btn-success w-100">Sign Up</button>
      </form>
    </div>
  );
}

export default Signup;
