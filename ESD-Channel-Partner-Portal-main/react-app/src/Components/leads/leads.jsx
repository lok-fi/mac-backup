import React, { useEffect, useState,useRef } from "react";

import styles from "./page.module.css";
import Header from "../ui/Header";
import Button from "../ui/Button";
import { Link, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { fetchLeads } from "../../store/leadsSlice";
import { fetchDeals } from "../../store/dealsSlice";
import Footer from "../ui/Footer";

import {
  User,
  UserRound,
  Phone,
  Building2,
  IndianRupee,
  CalendarDays,
  Target
} from "lucide-react";

import GlobalTable from "../globalTable/GlobalTable";

export default function LeadsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const debounceTimer = useRef(null);

  const leads = useSelector((state) => state.leads.data);
  const status = useSelector((state) => state.leads.status);
  const total = useSelector((state) => state.leads.total);

  const handleViewDetails = (lead) => {
    navigate(`/app/lead-journey/${lead.ROWID}`);
  };

  /* ---------------- UI STATE ---------------- */
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  // const [searchPlaceholder, setSearchPlaceholder] = useState("Search...");

  /* ---------------- STATUS BADGE HELPER ---------------- */
//   const getStatusVariant = (status) => {
//   if (!status) return "default";

//   const s = status.toLowerCase().trim();

//   // ---- exact pipeline stages ----
//   if (s.includes("created")) return "created";
//   if (s.includes("in process")) return "process";
//   if (s.includes("site visit")) return "visit";
//   if (s.includes("sales order")) return "sales";
//   if (s.includes("sap")) return "sap";
//   if (s.includes("possession")) return "possession";

//   // ---- rejection ----
//   if (s.includes("reject") || s.includes("cancel")) return "rejected";

//   return "default";
// };

  /* ---------------- TABLE COLUMN SCHEMA ---------------- */
  const columns = [
    {
      key: "customer_name",
      label: "Customer",
      sortable: true,
      width: "20%",
      minWidth: "180px",
      render: (v) => (
        <div className="flex items-center gap-2">
          <UserRound size={20} className="text-orange-500" />
          <span className="font-medium text-slate-600">{v}</span>
        </div>
      )
    },
    {
      key: "customer_mobile",
      label: "Mobile",
      sortable: true,
      width: "15%",
      minWidth: "120px",
      render: (v) => (
        <div className="flex items-center gap-2">
          <Phone size={16} className="text-orange-500" />
          <span className="font-medium text-slate-600">{v}</span>
        </div>
      )
    },
    {
      key: "project_name",
      label: "Project",
      sortable: true,
      width: "20%",
      minWidth: "150px",
      render: (v) => (
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-orange-500" />
          <span className="font-medium text-slate-600">{v || "Not Assigned"}</span>
        </div>
      )
    },
    {
      key: "budget",
      label: "Budget",
      sortable: true,
      width: "10%",
      minWidth: "110px",
      render: (v) => (
        <div className="flex items-center gap-2 font-semibold ">
          <IndianRupee size={16} className="text-orange-500" />
          <span className="font-medium text-slate-600">{v || "TBD"}</span>
        </div>
      )
    },
    {
      key: "CREATEDTIME",
      label: "Created Date",
      sortable: true,
      width: "15%",
      minWidth: "130px",
      render: (v) => (
        <div className="flex items-center gap-2 ">
          <CalendarDays size={16} className="text-orange-500" />
          <span className="font-medium text-slate-600">
            {v
              ? new Date(v).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })
              : "Recently"}
          </span>
        </div>
      )
    },
    {
      key: "lead_status",
      label: "Status",
      sortable: true,
      width: "20%",
      minWidth: "160px",
      render: (value) => (
        <div className="flex items-center gap-2">
          <Target size={14} className="text-orange-500" />
         <span
  className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide border backdrop-blur-sm transition ${
    styles[
      value
        ?.toLowerCase()
        .replace(/\s/g, "")
        .replace(/[^a-z]/g, "") || "newlead"
    ]
  }`}
>
  {value || "New Lead"}
</span>
        </div>
      )
    }
  ];
const handlePageChange = (page, pageSize) => {
  dispatch(fetchLeads({
    page,
    pageSize,
    search
  }));
};
const searchLeadsAPI = async (keyword) => {
  try {

    // const res = await fetch(`/server/searchLeads?search=${keyword}`);
    const res = await fetch(`/server/esd_channel_partner_function/searchLeads?search=${keyword}`);
    const data = await res.json();

    if (data.success) {
      setSearchResults(data.data);
    }

  } catch (err) {
    console.error("Search error:", err);
  }
};


  /* ---------------- FETCH DATA ---------------- */
useEffect(() => {
  dispatch(fetchLeads({ page: 1, pageSize: 10 }));
  dispatch(fetchDeals());
}, [dispatch]);

  /* ---------------- Dynamic Placeholder ---------------- */
  // useEffect(() => {
  //   if (!leads || leads.length === 0) return;

  //   const updatePlaceholder = () => {
  //     const randomLead = leads[Math.floor(Math.random() * leads.length)];
  //     const useName = Math.random() > 0.5;

  //     if (useName && randomLead.customer_name) {
  //       setSearchPlaceholder(`Search by name like ${randomLead.customer_name}`);
  //     } else if (randomLead.customer_mobile) {
  //       setSearchPlaceholder(`Search by number like ${randomLead.customer_mobile}`);
  //     }
  //   };

  //   updatePlaceholder();
  //   const interval = setInterval(updatePlaceholder, 3000);
  //   return () => clearInterval(interval);
  // }, [leads]);

  /* ---------------- SEARCH FILTER ---------------- */
/* const filteredLeads = useMemo(() => {
  const s = search.toLowerCase().trim();

  return leads
    .filter((l) => {
      if (!s) return true;

      return (
        l.customer_name?.toLowerCase().includes(s) ||
        l.customer_mobile?.toLowerCase().includes(s) ||
        l.project_name?.toLowerCase().includes(s) ||      // ✅ project search
        l.lead_status?.toLowerCase().includes(s)          // ✅ status search
      );
    })
    .sort((a, b) => new Date(b.CREATEDTIME) - new Date(a.CREATEDTIME));
}, [leads, search]);*/



  /* ---------------- LOADING ---------------- */
if (status === "idle") {
  return (
    <div className={styles.page}>
      <Header />

      <div className="lj-loading">
        <span className="loader"></span>
      </div>
    </div>
  );
}

  /* ---------------- UI ---------------- */
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          
          {/* HEADER + SEARCH + BUTTON */}
          <div className={`${styles.header} ${styles.headerEntry}`}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>My Leads</h1>
              
            </div>

            <div className={styles.headerActions}>
              <div className={styles.searchGrow}>
                 <div className={styles.searchWrapper}>
              <input type="search" placeholder="Search By Name/Mobile..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => {
                const value = e.target.value;
                setSearch(value);

                if (debounceTimer.current) {
                  clearTimeout(debounceTimer.current);
                }

                debounceTimer.current = setTimeout(() => {
                  if (value.trim() !== "") {
                    searchLeadsAPI(value);
                  } else {
                    setSearchResults(null);
                  }
                }, 300);
                }}
                // onChange={(e) => {
                //   const value = e.target.value;
                //   setSearch(value);

                //   if (value.trim() !== "") {
                //     searchLeadsAPI(value);
                //   } else {
                //     setSearchResults(null);
                //   }

                // }}
              />
              </div>
              </div>

              <Link to="/app/leads/add">
                <Button variant="primary" size="md">
                  + Add New Lead
                </Button>
              </Link>
            </div>
          </div>

          {/* TABLE */}
          <div className={styles.tableEntry}>
            <GlobalTable
            columns={columns}
            data={search ? (searchResults || []) : leads}
            total={search ? (searchResults?.length || 0) : total}
            loading={status === "loading"}
            pageSize={10}
            onRowClick={handleViewDetails}
            onPageChange={handlePageChange}
          />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}