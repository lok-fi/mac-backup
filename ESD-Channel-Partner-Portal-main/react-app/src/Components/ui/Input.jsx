import React from 'react';
import styles from './Input.module.css';

export default function Input({
  label,
  error,
  icon,
  className = '',
  ...props
}) {
  return (
    <div className={styles.inputWrapper}>
  {label && (
    <label className={styles.label}>
      {label}
      {props.required && <span className={styles.required}> *</span>}
    </label>
  )}

  <div className={styles.inputContainer}>
    {icon && <div className={styles.icon}>{icon}</div>}
    <input
      className={`${styles.input} ${icon ? styles.withIcon : ''} ${
        error ? styles.error : ''
      } ${className}`}
      {...props}
    />
  </div>

  {error && <span className={styles.errorText}>{error}</span>}
</div>
  );
}
