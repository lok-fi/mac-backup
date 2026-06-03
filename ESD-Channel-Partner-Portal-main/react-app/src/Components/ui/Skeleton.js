import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ 
  variant = "text", // "text", "circle", or "rect"
  width, 
  height, 
  className = "" 
}) {
  const inlineStyles = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  };

  return (
    <div 
      className={`${styles.skeleton} ${styles[variant]} ${className}`} 
      style={inlineStyles}
    />
  );
}

// this page is only for the user_db page , and for every other page the skeleton is written in their own pages