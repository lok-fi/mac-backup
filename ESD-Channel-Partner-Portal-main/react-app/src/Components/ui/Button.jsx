import React from "react";
import styles from "./Button.module.css";

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...props
}) {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${
        fullWidth ? styles.fullWidth : ""
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className={styles.loader}></span> : children}
    </button>
  );
}
