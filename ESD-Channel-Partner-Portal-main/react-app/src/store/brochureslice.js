import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

/* ======================================================
   ADMIN – EXISTING FETCH (UNCHANGED)
   ====================================================== */
/* ======================================================
   ADMIN – UPDATED TO HANDLE SEARCH AND CATEGORY
   ====================================================== */
export const fetchBrochures = createAsyncThunk(
  "brochures/fetch",
  async ({ page = 1, pageSize = 6, search = "", category = "All" } = {}) => {
    
    // Pass the parameters to the backend
    const url = `/server/desk_function/get-brochures?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
    
    const res = await fetch(url);
    const data = await res.json();

    console.log("Redux fetchBrochures response:", data);
    return data;
  }
);

/* ======================================================
   USER – NEW FETCH (ADDED, DOES NOT AFFECT ADMIN)
   ====================================================== */
/* ======================================================
   USER – NEW FETCH (UPDATED WITH SEARCH)
   ====================================================== */
export const fetchUserBrochures = createAsyncThunk(
  "brochures/fetchUser",
  async ({ page = 1, pageSize = 6, search = "", category = "All" } = {}, { rejectWithValue }) => {
    try {
      // Append search and category to the API call
      const url = `/server/esd_channel_partner_function/brochures?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error("Failed to fetch user brochures");
      }

      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

/* ======================================================
   SLICE (ADMIN + USER STATES TOGETHER)
   ====================================================== */
const brochuresSlice = createSlice({
  name: "brochures",
  initialState: {
  list: [],
  total: 0,
  loading: false,

  userList: [],
  userTotal: 0,
  userLoading: false,

  error: null
},

  reducers: {
    /* EXISTING ADMIN REDUCER (UNCHANGED) */
    updateBrochureLocal: (state, action) => {
      const index = state.list.findIndex(
        (b) => String(b.ROWID) === String(action.payload.ROWID)
      );
      if (index !== -1) {
        state.list[index] = {
          ...state.list[index],
          ...action.payload
        };
      }
    }
  },

  extraReducers: (builder) => {
    /* ================= ADMIN ================= */
    builder
      .addCase(fetchBrochures.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchBrochures.fulfilled, (state, action) => {

        state.loading = false;

        state.list = action.payload.data || [];
        state.total = Number(action.payload.total) || 0;

      })

    /* ================= USER ================= */
    builder
      .addCase(fetchUserBrochures.pending, (state) => {
        state.userLoading = true;
        state.error = null;
      })
      .addCase(fetchUserBrochures.fulfilled, (state, action) => {

          state.userLoading = false;

          state.userList = action.payload.data || [];
          state.userTotal = Number(action.payload.total) || 0;

        })
      .addCase(fetchUserBrochures.rejected, (state, action) => {
        state.userLoading = false;
        state.error = action.payload;
      });

    console.log("brochuresSlice extraReducers loaded");
  }
});

export const { updateBrochureLocal } = brochuresSlice.actions;
export default brochuresSlice.reducer;


