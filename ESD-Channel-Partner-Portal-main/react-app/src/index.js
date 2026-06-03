import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";

import { Provider } from "react-redux";
import { store } from "./store/store"; 



const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <Provider store={store}>
  <HashRouter basename="/">
    <App />
  </HashRouter>
  </Provider>
);
