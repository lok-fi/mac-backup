import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllUsers, updateUserStatus } from "../../../store/allUsersSlice";
import Header from "../../ui/Header";
import Button from "../../ui/Button";
import GlobalTable from "../../globalTable/GlobalTable";
import styles from "./page.module.css";
import { reinviteUser } from "../../../store/allUsersSlice";
import Footer from "../../ui/Footer";

import {
  User,
} from "lucide-react";
export default function AllUsers() {
  const dispatch = useDispatch();
  const { list, loading } = useSelector((state) => state.allUsers);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [search, setSearch] = useState("");

  useEffect(() => {
    dispatch(fetchAllUsers());
  }, [dispatch]);

  const handleToggleStatus = async (user) => {
    const isCurrentlyActive = user.status === "ACTIVE";

    const result = await dispatch(
      updateUserStatus({
        user_id: user.user_id,
        active: !isCurrentlyActive,
      })
    );

    if (!result.error) {
      dispatch(fetchAllUsers());
    }
  };


//new code for bulk reinvite
  const toggleUserSelection = (user_id) => {
  setSelectedUsers((prev) =>
    prev.includes(user_id)
      ? prev.filter((id) => id !== user_id)
      : [...prev, user_id]
  );
};
const toggleSelectAll = () => {
  const pendingUsers = filteredUsers.filter(u => !u.is_confirmed);

  if (selectedUsers.length === pendingUsers.length) {
    setSelectedUsers([]);
  } else {
    setSelectedUsers(pendingUsers.map(u => u.user_id));
  }
};
const handleBulkReinvite = async () => {
  const usersToReinvite = filteredUsers.filter(
    (u) => selectedUsers.includes(u.user_id) && !u.is_confirmed
  );

  if (!usersToReinvite.length) {
    setSnackbar({
      open: true,
      message: "No pending users selected ⚠️",
      type: "error",
    });
    return;
  }

  try {
    for (const user of usersToReinvite) {
      await dispatch(reinviteUser(user));
    }

    setSnackbar({
      open: true,
      message: "Bulk reinvite sent successfully ✅",
      type: "success",
    });

    setSelectedUsers([]); // reset selection

    dispatch(fetchAllUsers({
      page: 1,
      pageSize: 10
    }));

  } catch (err) {
    setSnackbar({
      open: true,
      message: "Bulk reinvite failed ",
      type: "error",
    });
  }

  setTimeout(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, 5000);
};

  /* ==========================
     FILTER LOGIC
     ========================== */
     //.filter((u) => u.role === "App User")
     //allusers
  const filteredUsers = useMemo(() => {
    return list
      ?.filter((u) => {
        const s = search.toLowerCase();
        return (
          u.first_name?.toLowerCase().includes(s) ||
          u.last_name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s)
        );
      }) || [];
  }, [list, search]);
  //console.log(list,"filteredUsers");
const total = useSelector((state) => state.allUsers.total);
const handlePageChange = (page, pageSize) => {
  dispatch(fetchAllUsers({
    page,
    pageSize
  }));
};
  const [snackbar, setSnackbar] = useState({
  open: false,
  message: "",
  type: "success", // success | error
});

const handleReinvite = async (user) => {
  const result = await dispatch(reinviteUser(user));

  if (!result.error) {
    setSnackbar({
      open: true,
      message: "Reinvite sent successfully ✅",
      type: "success",
    });
    dispatch(fetchAllUsers({
      page: 1,
      pageSize: 10
    }));
  } else {
    setSnackbar({
      open: true,
      message: "Failed to reinvite ❌",
      type: "error",
    });
  }

  // Auto close after 3 sec
  setTimeout(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, 5000);
};




  /* ==========================
     TABLE COLUMNS
     ========================== */
  const columns = [

    {
  key: "select",
  width: "5%",
  label: (
    <input
      type="checkbox"
      onChange={toggleSelectAll}
      checked={
        filteredUsers.filter(u => !u.is_confirmed).length > 0 &&
        selectedUsers.length === filteredUsers.filter(u => !u.is_confirmed).length
      }
    />
  ),
  minWidth: "10px",
  render: (_, row) => {
    if (row.is_confirmed) return null; // only pending users selectable

    return (
      <input
        type="checkbox"
        checked={selectedUsers.includes(row.user_id)}
        onChange={(e) => {
          e.stopPropagation();
          toggleUserSelection(row.user_id);
        }}
      />
    );
  },
},
    {
      key: "name",
      label: "Name",
      minWidth: "150px",
      render: (_, row) => (
        <div className="flex items-center gap-2 text-slate-600">
           <User size={16} className="text-orange-500" />
          <span>
            {row.first_name} {row.last_name}
          </span>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      minWidth: "150px",
    },
    {
      key: "email",
      label: "Email",
      minWidth: "150px",
    },
    {
  key: "status",
  label: "Status",
  minWidth: "150px",
  render: (_, row) => {
    const isConfirmed = row.is_confirmed === true;

    
    return (
      
    <div className="flex items-center gap-2 text-slate-600">
      <span
        style={{
          padding: "6px 12px",
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: 600,
          background: isConfirmed ? "#dcfce7" : "#fef3c7",
          color: isConfirmed ? "#16a34a" : "#d97706",
        }}
      >
        {isConfirmed ? "Active" : "Pending"}
      </span>
      </div>
    );
    
  },
},
    {
  key: "actions",
  label: "Actions",
  minWidth: "150px",
  render: (_, row) => {
    const isConfirmed = row.is_confirmed === true;

    // 🔁 REINVITE BUTTON
    if (!isConfirmed) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
           handleReinvite(row);
          }}
          style={{
            padding: "6px 12px",
            borderRadius: "20px",
            border: "1px solid #fed7aa",
            background: "#fff7ed",
            color: "#ea580c",
            fontWeight: 600,
            cursor: "pointer",
            transition: "0.2s",
          }}
        >
          ⟳ Reinvite
        </button>
      );
    }

    

    // 🔁 ACTIVE TOGGLE
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          handleToggleStatus(row);
        }}
        style={{
          width: 46,
          height: 24,
          borderRadius: 20,
          background: row.status === "ACTIVE" ? "#fb923c" : "#d1d5db",
          position: "relative",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            background: "white",
            borderRadius: "50%",
            position: "absolute",
            top: 2,
            transition: "0.3s",
            right: row.status === "ACTIVE" ? 2 : "auto",
            left: row.status === "ACTIVE" ? "auto" : 2,
          }}
        />
      </div>
    );
  },
},

{
  key: "last_invite",
  label: "Last Invite",
  minWidth: "180px",
  render: (_, row) => {
    if (row.is_confirmed) return "—";

    if (!row.last_invite_log) {
      return (
        <span style={{
          padding: "4px 10px",
          borderRadius: "12px",
          background: "#f1f5f9",
          color: "#64748b",
          fontSize: "12px"
        }}>
          Not Invited
        </span>
      );
    }

    const date = new Date(row.last_invite_log);

    return (
      <div>
        <div style={{ fontWeight: 600 }}>
          {date.toLocaleDateString("en-IN") }
        </div>
        {/* <div style={{ fontSize: "12px", color: "#64748b" }}>
          {date.toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
})}
        </div> */}
      </div>
    );
  }
},

  ];

  return (

    <div className={styles.page}>
          <Header />
      <main className={styles.main}>
        <div className={styles.container}>
              
          {/* HEADER + SEARCH + BUTTON */}
          <div className={`${styles.header} ${styles.headerEntry}`}>
            <div className={styles.headerText}>
              <h1 className={styles.title}> All Users ({filteredUsers.length})</h1>
            </div>
         
            <div className={styles.headerActions}>
           <div className={styles.searchGrow}>
              <input
                type="text"
                placeholder="Search By Name"
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              </div>
              <Button
                onClick={handleBulkReinvite}
                disabled={!selectedUsers.length}
                variant="primary" size="md"
              >
                ⟳ Send Reinvite ({selectedUsers.length})
              </Button>
            </div>
          </div>

          <div className={styles.tableEntry}>
            <GlobalTable
              columns={columns}
              data={filteredUsers}
              total={total}
              loading={loading}
              pageSize={10}
              onPageChange={handlePageChange}
              onRowClick={(row) => console.log("Row clicked:", row)}
            />
          </div>
          {snackbar.open && (
          <div
            style={{
              position: "fixed",
              margin: 60,
              top: 24,
              right: 24,
              padding: "14px 20px",
              borderRadius: 12,
              fontWeight: 600,
              color: snackbar.type === "success" ? "#065f46" : "#991b1b",
              background:
                snackbar.type === "success"
                  ? "rgba(16,185,129,0.15)"
                  : "rgba(239,68,68,0.15)",
              border:
                snackbar.type === "success"
                  ? "1px solid rgba(16,185,129,0.35)"
                  : "1px solid rgba(239,68,68,0.35)",
              backdropFilter: "blur(6px)",
              boxShadow: "0 10px 25px rgba(0,0,0,.15)",
              animation: "slideInSnackbar .35s ease",
              zIndex: 9999,
            }}
          >
            {snackbar.message}
          </div>
          )}

        </div>   
      </main>
       <Footer/>
    </div>

    

  );
}