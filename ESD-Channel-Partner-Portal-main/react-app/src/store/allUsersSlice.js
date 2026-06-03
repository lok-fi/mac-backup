import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// ---------------- FETCH ALL USERS ----------------
export const fetchAllUsers = createAsyncThunk(
  "allUsers/fetch",
  async ({ page = 1, pageSize = 10 } = {}, { rejectWithValue }) => {
    try {

      const res = await fetch(
        `/server/esd_channel_partner_function/all_users?page=${page}&pageSize=${pageSize}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) {
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!data.success) {
        return rejectWithValue(data.error || "Failed to fetch users");
      }

      return data;

    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ---------------- UPDATE USER STATUS ----------------
export const updateUserStatus = createAsyncThunk(
  "allUsers/updateStatus",
  async ({ user_id, active }, { rejectWithValue }) => {
    try {
      const res = await fetch(
        "/server/esd_channel_partner_function/all_users",
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id,
            active,
          }),
        }
      );

      if (!res.ok) {
        return rejectWithValue("Failed to update user status");
      }

      // backend may or may not return updated user
      return { user_id, active };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

// ---------------- RE-INVITE USER ----------------
export const reinviteUser = createAsyncThunk(
  "allUsers/reinviteUser",
  async (user, { rejectWithValue }) => {
    try {
      const response = await fetch(
        "/server/esd_channel_partner_function/reinviteUser",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: user.first_name,
            last_name: user.last_name,
            email_id: user.email,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      return data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);


// ---------------- SLICE ----------------
const allUsersSlice = createSlice({
  name: "allUsers",
  initialState: {
  list: [],
  total: 0,
  loading: false,
  error: null,
},
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ---------- FETCH USERS ----------
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data || [];
        state.total = Number(action.payload.total) || 0;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unknown error";
      })

      // ---------- UPDATE USER STATUS (FIX) ----------
      .addCase(updateUserStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(updateUserStatus.fulfilled, (state, action) => {
        state.loading = false;

        const { user_id, active } = action.payload;

        const user = state.list.find(
          (u) => u.user_id === user_id
        );

        if (user) {
          user.status = active ? "ACTIVE" : "DISABLED";
        }
      })
      .addCase(updateUserStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to update status";
      })
      .addCase(reinviteUser.pending, (state) => {
        state.reinviteLoading = true;
      })
      .addCase(reinviteUser.fulfilled, (state) => {
        state.reinviteLoading = false;
      })
      .addCase(reinviteUser.rejected, (state) => {
        state.reinviteLoading = false;
      });
  },
});



export default allUsersSlice.reducer;
