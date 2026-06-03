// src/store/authSlice.js

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  loading: true,
  authenticated: false,
  user: null,
  role: null,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authStart(state) {
      state.loading = true;
      state.error = null;
    },
    authSuccess(state, action) {
      state.loading = false;
      state.authenticated = true;
      state.user = action.payload.user;
      state.role = action.payload.role;
      state.error = null;
    },
    authFail(state, action) {
      state.loading = false;
      state.authenticated = false;
      state.user = null;
      state.role = null;
      state.error = action.payload || "Authentication failed";
    },
    logout(state) {
      state.loading = false;
      state.authenticated = false;
      state.user = null;
      state.role = null;
      state.error = null;
    },
  },
});

export const { authStart, authSuccess, authFail, logout } = authSlice.actions;
export default authSlice.reducer;
