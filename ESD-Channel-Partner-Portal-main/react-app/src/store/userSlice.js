import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchUser = createAsyncThunk(
  "user/fetchUser",
  async (_, { rejectWithValue }) => {
    try {
      console.log("📡 fetchUser API call started");

      const res = await fetch("/server/esd_channel_partner_function/user", {
        method: "GET",
        credentials: "include"
      });

      if (!res.ok) {
        console.error("❌ fetchUser HTTP error:", res.status);
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();
      console.log("📥 fetchUser raw response:", json);

      const user = Array.isArray(json.data) ? json.data[0] : json.data;
      console.log("✅ fetchUser parsed user:", user);

      return user;

    } catch (err) {
      console.error("🔥 fetchUser exception:", err);
      return rejectWithValue(err.message);
    }
  }
);

export const updateUser = createAsyncThunk(
  "user/updateUser",
  async (payload, { rejectWithValue }) => {
    try {
      console.log("📤 updateUser payload:", payload);

      const res = await fetch("/server/esd_channel_partner_function/user", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      console.log("📥 updateUser response:", json);

      if (!json.success) {
        console.error("❌ updateUser failed:", json.error);
        return rejectWithValue(json.error || "Update failed");
      }

      // 🔑 IMPORTANT:
      // Return payload, NOT json.data
      // Backend may not return full user
      return payload;

    } catch (err) {
      console.error("🔥 updateUser exception:", err);
      return rejectWithValue(err.message);
    }
  }
);
//for profile update
export const uploadProfilePicture = createAsyncThunk(
  "user/uploadProfilePicture",
  async (file, { rejectWithValue }) => {
    try {
      console.log("📤 uploadProfilePicture started");

      const formData = new FormData();
      formData.append("profile_picture", file);

      const res = await fetch(
        "/server/esd_channel_partner_function/profile/upload-picture",
        {
          method: "POST",
          credentials: "include",
          body: formData
        }
      );

      if (!res.ok) {
        console.error("❌ uploadProfilePicture HTTP error:", res.status);
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();
      console.log("📥 uploadProfilePicture response:", json);

      if (!json.success) {
        return rejectWithValue(json.error || "Upload failed");
      }

      // 🔑 Return ONLY what needs to be merged
      return { profile_path: json.profile_path };

    } catch (err) {
      console.error("🔥 uploadProfilePicture exception:", err);
      return rejectWithValue(err.message);
    }
  }
);




const userSlice = createSlice({
  name: "user",
  initialState: {
    data: null,
    status: "idle",
    error: null
  },
  reducers: {
    clearUser(state) {
      console.log("🧹 Clearing user state");
      state.data = null;
      state.status = "idle";
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // FETCH USER
      .addCase(fetchUser.pending, (state) => {
        console.log("⏳ fetchUser pending");
        state.status = "loading";
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        console.log("✅ fetchUser fulfilled:", action.payload);
        state.status = "success";
        state.data = action.payload || null;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        console.error("❌ fetchUser rejected:", action.payload);
        state.status = "error";
        state.error = action.payload || "Unknown error";
      })

      // UPDATE USER (FIXED)
      .addCase(updateUser.pending, (state) => {
        console.log("⏳ updateUser pending");
        state.status = "loading";
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        console.log("✅ updateUser fulfilled with payload:", action.payload);
        state.status = "success";

        // 🔑 MERGE instead of replace
        if (state.data) {
          state.data = {
            ...state.data,
            ...action.payload
          };
        }
      })
      .addCase(updateUser.rejected, (state, action) => {
        console.error("❌ updateUser rejected:", action.payload);
        state.status = "error";
        state.error = action.payload || "Update failed";
      })
            // UPLOAD PROFILE PICTURE
      .addCase(uploadProfilePicture.pending, (state) => {
        console.log("⏳ uploadProfilePicture pending");
        state.status = "loading";
      })
      .addCase(uploadProfilePicture.fulfilled, (state, action) => {
        console.log("✅ uploadProfilePicture fulfilled:", action.payload);
        state.status = "success";

        // 🔑 Merge profile_path safely
        if (state.data) {
          state.data = {
            ...state.data,
            ...action.payload
          };
        }
      })
      .addCase(uploadProfilePicture.rejected, (state, action) => {
        console.error("❌ uploadProfilePicture rejected:", action.payload);
        state.status = "error";
        state.error = action.payload || "Profile picture upload failed";
      });

  }
});

export const { clearUser } = userSlice.actions;
export default userSlice.reducer;
