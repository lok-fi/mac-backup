import React from "react";
import styles from "./Badge.module.css";

export default function Badge({
  children,
  variant,
  size = "md",
  className = ""
}) {
  return (
    <span
      className={[
        styles.badge,
        styles[size],
        variant,     // 👈 semantic class (success, info, etc.)
        className
      ].join(" ")}
    >
      {children}
    </span>
  );
}
