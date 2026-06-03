import React from "react";
import styles from "./Card.module.css";

export default function Card({
  children,
  className = "",
  onClick,
  hoverable = false,
  padding = "lg",
}) {
  return (
    <div
      className={`${styles.card} ${
        hoverable || onClick ? styles.hoverable : ""
      } ${styles[`padding-${padding}`]} ${className}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
