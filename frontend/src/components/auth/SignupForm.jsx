import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiEnvelope, HiLockClosed, HiIdentification } from 'react-icons/hi2';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';
import Input from '../ui/Input';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const { signup, loading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    await signup(email, password, displayName);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} id="signup-form">
      {(error || localError) && <div className="auth-error">{error || localError}</div>}

      <Input
        label="Email"
        icon={HiEnvelope}
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        id="signup-email"
      />

      <Input
        label="Display Name"
        icon={HiIdentification}
        placeholder="Your full name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        id="signup-displayname"
      />

      <Input
        label="Password"
        icon={HiLockClosed}
        type="password"
        placeholder="Create a password (min 6 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        required
        id="signup-password"
      />

      <Input
        label="Confirm Password"
        icon={HiLockClosed}
        type="password"
        placeholder="Confirm your password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
        required
        id="signup-confirm-password"
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={loading}
        style={{ width: '100%', marginTop: '8px' }}
        id="signup-submit"
      >
        Create Account
      </Button>

      <div className="auth-footer">
        Already have an account? <Link to="/login">Log In</Link>
      </div>
    </form>
  );
}
