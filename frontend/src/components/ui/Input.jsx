import { forwardRef } from 'react';

const Input = forwardRef(({ label, icon: Icon, error, className = '', ...props }, ref) => {
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
      <div className="input-wrapper">
        {Icon && <Icon className="input-icon" />}
        <input
          ref={ref}
          className={`glass-input ${Icon ? '' : ''} ${error ? 'input-error' : ''} ${className}`}
          style={Icon ? { paddingLeft: '42px' } : {}}
          {...props}
        />
      </div>
      {error && (
        <span style={{ color: 'var(--accent-rose)', fontSize: '0.8rem', marginTop: '2px' }}>
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
