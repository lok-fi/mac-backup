import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice";
import leadsReducer from "./leadsSlice";
import salesOrderReducer from "./salesOrderSlice";
import commissionReducer from "./commissionSlice";  
import authReducer from "./authSlice";
import allUsersReducer from "./allUsersSlice";
import dealsReducer from "./dealsSlice";
import brochuresReducer from "./brochureslice";
import ticketsReducer from "./ticketSlice";
import projectsReducer from "./projectSlice";


export const store = configureStore({
  reducer: {
    user: userReducer,
    leads: leadsReducer,
    salesOrders: salesOrderReducer,
    commissions: commissionReducer,
    auth: authReducer,
    allUsers: allUsersReducer,
    deals: dealsReducer,
    brochures: brochuresReducer,
    tickets: ticketsReducer,
    projects: projectsReducer,
  }
});
