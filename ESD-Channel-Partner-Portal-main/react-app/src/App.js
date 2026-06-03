import "./App.css";
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { authStart, authSuccess, authFail } from "./store/authSlice";
import { fetchUser } from "./store/userSlice"; // ✅ ADD

import Login from "./Components/Login/Login";
import Loader from "./Components/Loader/Loader";
import AdminDB from "./Components/Admin_DB/Admin_DB";
import UserDB from "./Components/User_DB/User_DB";
import LeadsPage from "./Components/leads/leads";
import AddLeadPage from "./Components/leads/add/AddLead";
import CommissionsPage from "./Components/User_DB/commissions/commission";
import BrochuresPage from "./Components/User_DB/brochures/broucher";

import SalesOrderPage from "./Components/User_DB/Sales_Order/sales_order";
import SalesOrderJourneyPage from "./Components/User_DB/Sales_Order/viewDetail/so_viewDetail";
import Profile from "./Components/profile/profile";
import AllUsersPage from "./Components/Admin_DB/allUsers/allUsers";
import LeadJourneyModal from "./Components/leads/LeadJourney/LeadJourney";
import KYCVerification from "./Components/verificationOTL/KYCVerification"; 
import AddBrochureAdmin from "./Components/Admin_DB/brochures/AddBrochureForm";
import EditBrochure from "./Components/Admin_DB/brochures/EditBrochure";
import AdminBrochuresPage from "./Components/Admin_DB/brochures/AdminBrochures";
import RequireAuth from "./Components/AuthLogout/RequireAuth";
import LeadJourneyPage from "./Components/leads/LeadJourney/LeadJourney";
import TicketList from "./Components/User_DB/support/TicketList";
import TicketDetail from "./Components/User_DB/support/TicketDetail";
import CreateTicket from "./Components/User_DB/support/CreateTicket";



function App() {
  const dispatch = useDispatch();

  const { loading, authenticated, role } = useSelector((state) => state.auth);

  // ✅ CP (Channel Partner) Redux
  const { data: cp, status: cpStatus } = useSelector(
    (state) => state.user
  );

  useEffect(() => {
    const checkAuth = async () => {
      dispatch(authStart());

      try {
        const result = await window.catalyst.auth.isUserAuthenticated();
        console.log("Auth Check Result:", result);

        if (result && result.content) {
          const roleName = result.content.role_details?.role_name;
          const userName = result.content.first_name;

          console.log("Authenticated User:", userName, "Role:", roleName);

          dispatch(
            authSuccess({
              user: result.content,
              role: roleName,
            })
          );

          // ✅ FETCH CP DATA ONLY FOR APP USER
          if (roleName === "App User") {
            dispatch(fetchUser());
          }

        } else {
          dispatch(authFail("Not authenticated"));
        }
      } catch (err) {
        dispatch(authFail(err.message));
      }
    };

    checkAuth();
  }, [dispatch]);

  // 🔄 Auth loader
  if (loading) return <Loader />;

  // 🔄 CP loader (prevents flicker)
  if (
    authenticated &&
    role === "App User" &&
    (cpStatus === "loading" || cpStatus === "idle")
  ) {
    return <Loader />;
  }


  

  return (
    <Routes>
      {/* ROOT → /app/login */}
      <Route path="/" element={<Navigate to="/app/login" replace />} />

      {/* LOGIN */}
      <Route
        path="/app/login"
        element={
          authenticated ? (
            role === "App Administrator" ? (
              <Navigate to="/app/admin" replace />
            ) : role === "App User" ? (
              cp?.OTL === true ? (               // ✅ OTL CHECK
                <Navigate to="/app/kyc-verification" replace />
              ) : (
                <Navigate to="/app/user" replace />
              )
            ) : (
              <Login />
            )
          ) : (
            <Login />
          )
        }
      />
  <Route element={<RequireAuth />}>
      {/* ADMIN */}
      <Route path="/app/admin" element={<AdminDB />} />
      <Route path="/app/admin/brochures" element={<AdminBrochuresPage />} />
      <Route path="/app/admin/addbrochures" element={<AddBrochureAdmin />} />
      <Route path="/app/admin/editbrochure/:id" element={<EditBrochure />}/>
      <Route path="/app/admin/all_users" element={<AllUsersPage />} />
      

      {/* USER */}
      <Route path="/app/user" element={<UserDB />} />
      <Route path="/app/brouchers" element={<BrochuresPage />} />

      

      {/* REMAINING ROUTES */}
      <Route path="/app/leads" element={<LeadsPage />} />
      <Route path="/app/leads/add" element={<AddLeadPage />} />
      <Route path="/app/commissions" element={<CommissionsPage />} />
      
      
      <Route path="/app/support" element={<TicketList />} />
      <Route path="/app/support/createTicket" element={<CreateTicket />} />
      <Route path="/app/support/ticket/:ticketId" element={<TicketDetail />} />
      <Route path="/app/sales_orders" element={<SalesOrderPage />} />
      <Route path="/app/profile" element={<Profile />} />
      
      <Route path="/app/leads/lead_journey" element={<LeadJourneyModal />} />
      <Route path="/app/lead-journey/:leadId"element={<LeadJourneyPage />}/>
      <Route path="/app/so-journey/:salesOrderId"element={<SalesOrderJourneyPage />}/>

    </Route>

      {/* KYC VERIFICATION */}
      <Route
        path="/app/kyc-verification"
        element={
          authenticated && role === "App User" ? (
            <KYCVerification />
          ) : (
            <Navigate to="/app/login" replace />
          )
        }
      />
      
    </Routes>
  );
}

export default App;
