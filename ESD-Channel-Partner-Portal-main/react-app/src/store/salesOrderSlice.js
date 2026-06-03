import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchSalesOrders = createAsyncThunk(
  "salesOrders/fetchSalesOrders",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch("/server/esd_channel_partner_function/sales_orders", {
        method: "GET",
        credentials: "include"
      });

      if (!res.ok) {
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();
      console.log("Redux fetchSalesOrders response:", json);

      return json.data;   // same pattern as leads

    } catch (err) {
      console.error("Redux fetchSalesOrders error:", err);
      return rejectWithValue(err.message);
    }
  }
);

const salesOrderSlice = createSlice({
  name: "salesOrders",
  initialState: {
    data: [],
    status: "idle",     // idle | loading | success | error
    error: null
  },
  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(fetchSalesOrders.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchSalesOrders.fulfilled, (state, action) => {
        state.status = "success";
        state.data = action.payload || [];
      })
      .addCase(fetchSalesOrders.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || "Unknown error";
      });
  }
});

export default salesOrderSlice.reducer;
