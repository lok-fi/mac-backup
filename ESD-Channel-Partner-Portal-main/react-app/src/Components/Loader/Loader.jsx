// Loader.js
import React from "react";

const Loader = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
      }}
    >
      <div className="spinner">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      <style>
        {`
          .spinner {
            position: relative;
            width: 15.7px;
            height: 15.7px;
          }
          .spinner div {
            animation: spinner-4t3wzl 1.875s infinite backwards;
            background-color: #dd8f09;
            border-radius: 50%;
            height: 100%;
            position: absolute;
            width: 100%;
          }
          .spinner div:nth-child(1) {
            animation-delay: 0.15s;
            background-color: rgba(221,143,9,0.9);
          }
          .spinner div:nth-child(2) {
            animation-delay: 0.3s;
            background-color: rgba(221,143,9,0.8);
          }
          .spinner div:nth-child(3) {
            animation-delay: 0.45s;
            background-color: rgba(221,143,9,0.7);
          }
          .spinner div:nth-child(4) {
            animation-delay: 0.6s;
            background-color: rgba(221,143,9,0.6);
          }
          .spinner div:nth-child(5) {
            animation-delay: 0.75s;
            background-color: rgba(221,143,9,0.5);
          }
          @keyframes spinner-4t3wzl {
            0% {
              transform: rotate(0deg) translateY(-200%);
            }
            60%, 100% {
              transform: rotate(360deg) translateY(-200%);
            }
          }
        `}
      </style>
    </div>
  );
};

export default Loader;
