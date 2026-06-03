import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchCommissions = createAsyncThunk(
  "commission/fetch",
  async ({ page = 1, pageSize = 10 } = {}, { rejectWithValue }) => {

    try {

      const res = await fetch(
        `/server/esd_channel_partner_function/commission?page=${page}&pageSize=${pageSize}`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (!res.ok) {
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();

      return json;

    } catch (err) {

      return rejectWithValue(err.message);

    }
  }
);

const commissionSlice = createSlice({
  name: "commissions",
  initialState: {
  list: [],
  total: 0,
  loading: false,
  error: null,
},
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCommissions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchCommissions.fulfilled, (state, action) => {

        state.loading = false;

        state.list = action.payload.data || [];
        state.total = Number(action.payload.total) || 0;

      })

      .addCase(fetchCommissions.rejected, (state, action) => {
        state.loading = false;
        state.list = [];
        state.error = action.payload || "Failed to fetch commissions";
      });
  },
});

export default commissionSlice.reducer;