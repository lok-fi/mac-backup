import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchLeads = createAsyncThunk(
  "leads/fetchLeads",
  async ({ page = 1, pageSize = 10 } = {}, { rejectWithValue }) => {
    try {

      const res = await fetch(
        `/server/esd_channel_partner_function/leads?page=${page}&pageSize=${pageSize}`,
        {
          method: "GET",
          credentials: "include"
        }
      );

      if (!res.ok) {
        return rejectWithValue(`HTTP ${res.status}`);
      }

      const json = await res.json();

      console.log("Redux fetchLeads response:", json);

      return json;

    } catch (err) {

      return rejectWithValue(err.message);

    }
  }
);

export const fetchLeadByRowId = createAsyncThunk(
  "leads/fetchLeadByRowId",
  async (rowid, { rejectWithValue }) => {
    try {
      const res = await fetch(
        `/server/esd_channel_partner_function/leads/${rowid}`,
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


const leadsSlice = createSlice({
  name: "leads",
  initialState: {
  data: [],   
  total: 0,              // list for Leads page
  status: "idle",
  error: null,

  selectedLead: null,       // 🔥 for popup
  selectedStatus: "idle",   // idle | loading | success | error
  selectedError: null
},
  reducers: {
    setSelectedLeadRowId(state, action) {
  state.selectedLeadRowId = action.payload;
  state.selectedStatus = "success";
  state.selectedError = null;
},
  clearSelectedLead(state) {
  state.selectedLeadRowId = null;
  state.selectedStatus = "idle";
}

  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchLeads.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchLeads.fulfilled, (state, action) => {
        state.status = "success";

        const { data, offset } = action.payload;

        state.data = action.payload.data;
state.total = action.payload.total;
      })
      .addCase(fetchLeads.rejected, (state, action) => {
        state.status = "error";
        state.error = action.payload || "Unknown error";
      })
      .addCase(fetchLeadByRowId.pending, (state) => {
        state.selectedStatus = "loading";
      })
      .addCase(fetchLeadByRowId.fulfilled, (state, action) => {
        state.selectedStatus = "success";
        state.selectedLeadRowId = action.payload.ROWID;

        const index = state.data.findIndex(
          (l) => l.ROWID === action.payload.ROWID
        );

        if (index === -1) {
          state.data.push(action.payload);
        } else {
          state.data[index] = action.payload;
        }
      })

      .addCase(fetchLeadByRowId.rejected, (state, action) => {
        state.selectedStatus = "error";
        state.selectedError = action.payload;
      });

      
  }
});

export default leadsSlice.reducer;
export const {
  setSelectedLeadRowId,
  clearSelectedLead
} = leadsSlice.actions;