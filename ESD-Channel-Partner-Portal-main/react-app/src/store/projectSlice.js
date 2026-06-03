import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Fetch projects API
export const fetchProjects = createAsyncThunk(
  "/fetchProjects",
  async (_, { rejectWithValue }) => {
    const res = await fetch("/server/esd_channel_partner_function/getProjects", {
        method: "GET",
        credentials: "include"
      });

      if (!res.ok) {
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();
      console.log("Redux fetchSalesOrders response:", json);

      return json.data;
  }
);

const projectsSlice = createSlice({
  name: "projects",
  initialState: {
    data: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export default projectsSlice.reducer;
