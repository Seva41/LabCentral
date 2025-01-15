import React, { useState } from 'react';
import axios from 'axios';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/request_password_reset', { email });
      // In a real scenario, just show "Check your email"
      setMessage('Check your email for a reset link (in dev, token is in the response).');
      console.log('Reset token (dev): ', res.data.token); // DEV ONLY
    } catch (error: any) {
      setMessage('Something went wrong');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px' }}>
      <h2>Forgot Password</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Email Address</label>
          <input
            className="form-control"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary w-100">Request Password Reset</button>
      </form>
      {message && <p className="mt-3">{message}</p>}
    </div>
  );
}

export default ForgotPassword;
