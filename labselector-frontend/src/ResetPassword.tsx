import React, { useState } from 'react';
import axios from 'axios';

function ResetPassword() {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match!');
      return;
    }

    try {
      await axios.post('/api/reset_password', { token, new_password: newPassword });
      setMessage('Password successfully reset. You can now log in.');
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Reset failed');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '400px' }}>
      <h2>Reset Password</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label>Reset Token</label>
          <input
            className="form-control"
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label>New Password</label>
          <input
            className="form-control"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label>Confirm Password</label>
          <input
            className="form-control"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary w-100">Reset Password</button>
      </form>
      {message && <p className="mt-3">{message}</p>}
    </div>
  );
}

export default ResetPassword;
