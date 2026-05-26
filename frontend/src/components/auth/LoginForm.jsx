import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiEnvelope, HiLockClosed } from 'react-icons/hi2';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} id="login-form">
      {error && <div className="auth-error">{error}</div>}

      <Input
        label="Email"
        icon={HiEnvelope}
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        id="login-email"
      />

      <Input
        label="Password"
        icon={HiLockClosed}
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        id="login-password"
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        style={{ width: '100%', marginTop: '8px' }}
        id="login-submit"
      >
        Log In
      </Button>

      <div className="auth-footer">
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </div>
    </form>
  );
}
