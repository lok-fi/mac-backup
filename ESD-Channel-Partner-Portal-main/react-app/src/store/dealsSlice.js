import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

/* =========================
   FETCH ALL DEALS
   ========================= */
export const fetchDeals = createAsyncThunk(
  "deals/fetchDeals",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(
        "/server/esd_channel_partner_function/deals",
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (!res.ok) {
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();
      return json.data;

    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const dealsSlice = createSlice({
  name: "deals",
  initialState: {
    data: [],           // all deals
    status: "idle",     // idle | loading | success | error
    error: null
  },

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(fetchDeals.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchDeals.fulfilled, (state, action) => {
        state.status = "success";
        state.data = action.payload || [];
      })
      .addCase(fetchDeals.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || "Unknown error";
      });
  }
});

export default dealsSlice.reducer;
