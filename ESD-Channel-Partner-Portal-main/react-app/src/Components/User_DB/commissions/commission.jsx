import React, { useEffect, useState, useMemo, useRef} from "react";
import styles from "./page.module.css";
import Header from "../../ui/Header";
import GlobalTable from "../../globalTable/GlobalTable";
import { useDispatch, useSelector } from "react-redux";
import { fetchCommissions } from "../../../store/commissionSlice";
import { IndianRupee, Receipt, Building2, User, CreditCard } from "lucide-react";
import Footer from "../../ui/Footer";

export default function CommissionsPage() {
  const dispatch = useDispatch();
  const { list = [], total = 0, loading = false, error = null } =
    useSelector((state) => state.commissions || {});

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  

  useEffect(() => {
    dispatch(fetchCommissions({ page: 1, pageSize: 10 }));
  }, [dispatch]);

  /* ---------- NEW STATUS LOGIC ---------- */
  /* ---------- NEW STATUS LOGIC ---------- */
  const withStatus = useMemo(() => {
    if (!Array.isArray(list)) return [];

    return list.map((row) => {
      // Strictly check UTR_Number only
      const status = row.UTR_Number ? "paid" : "pending";
      
      return { ...row, commission_status: status };
    });
  }, [list]);

  const filteredData = useMemo(() => {
    let data = withStatus;

    // status filter
    if (statusFilter !== "all") {
      data = data.filter((r) => r.commission_status === statusFilter);
    }

    // search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      data = data.filter(
        (row) =>
          row.SO_Number?.toLowerCase().includes(s) ||
          row.CP_Vendor_Name?.toLowerCase().includes(s) ||
          row.CP_Code?.toLowerCase().includes(s) ||
          row.UTR_Number?.toLowerCase().includes(s)
      );
    }

    return data;
  }, [withStatus, statusFilter, search]);

  const counts = useMemo(
    () => ({
      all: withStatus.length,
      pending: withStatus.filter((r) => r.commission_status === "pending").length,
      paid: withStatus.filter((r) => r.commission_status === "paid").length,
    }),
    [withStatus]
  );

  const handlePageChange = (page, pageSize) => {
    dispatch(fetchCommissions({ page, pageSize }));
  };
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
const dropdownRef = useRef(null);

  /* ---------- TABLE ---------- */
  const columns = [
    {
      key: "SO_Number",
      label: "Sales Order",
      minWidth: "160px",
      render: (v) => (
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Receipt size={16} className="text-orange-500" />
          {v}
        </div>
      ),
    },
    {
      key: "CP_Vendor_Name",
      label: "Customer",
      minWidth: "300px",
      render: (v, row) => (
        <div className="flex items-center gap-2 text-slate-700">
          <User size={16} className="text-orange-500" />
          {v || row.CP_Code}
        </div>
      ),
    },
    {
      key: "Agreement_Value",
      label: "Property Value",
      minWidth: "170px",
      render: (v) => (
        <div className="flex items-center gap-2 text-slate-700">
          <Building2 size={16} className="text-orange-500" />
           {Number(v || 0).toLocaleString("en-IN")}
        </div>
      ),
    },
    {
      key: "CP_Commission",
      label: "Commission",
      minWidth: "170px",
      render: (v) => (
        <div className="flex items-center gap-2 font-semibold text-green-600">
          <IndianRupee size={16} className="text-orange-500" />
          {Number(v || 0).toLocaleString("en-IN")}
        </div>
      ),
    },
    {
      key: "commission_status",
      label: "Status",
      minWidth: "150px",
      render: (value) => {
        // fallback if backend didn't send status
        const safeStatus = (value || "pending").toLowerCase();

        const color =
          safeStatus === "paid"
            ? "bg-green-100 text-green-700 border-green-300"
            : "bg-orange-100 text-orange-700 border-orange-300";

        return (
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${color}`}
          >
            {safeStatus.toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "UTR_Number",
      label: "Payment Reference",
      minWidth: "220px",
      render: (v) => (
        <div className="flex items-center gap-2 text-slate-600">
          <CreditCard size={15} className="text-orange-500" />
          {v || "-"}
        </div>
      ),
    },
  ];
useEffect(() => {
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsDropdownOpen(false);
    }
  };
  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);
  /* ---------- UI ---------- */
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* HEADER + FILTER ON SAME ROW */}
          <div className={`${styles.header} ${styles.headerEntry}`}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>My Commissions</h1>
              {/* <p className={styles.subtitle}>
                Track your earnings and payment status
              </p> */}
            </div>
            <div className={styles.headerActions}>
              <div className={styles.searchGrow}>
                {/* SEARCH BAR */}
                <input
                  type="search"
                  placeholder="Search by Order/Customer/UTR..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              {/* STATUS FILTER - Removed 'due' */}
             <div className={styles.customDropdownContainer} ref={dropdownRef}>
  <button
    type="button"
    className={`${styles.customDropdownTrigger} ${isDropdownOpen ? styles.triggerActive : ''}`}
    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
  >
    {statusFilter.toUpperCase()}
    <svg
      className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.arrowOpen : ''}`}
      width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="#f97316" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>

  {isDropdownOpen && (
    <div className={styles.customDropdownMenu}>
      {["all", "pending", "paid"].map((type) => (
        <div
          key={type}
          className={`${styles.customDropdownItem} ${
            statusFilter === type ? styles.itemActive : ''
          }`}
          onClick={() => {
            setStatusFilter(type);
            setIsDropdownOpen(false);
          }}
        >
          {type.toUpperCase()} ({counts[type]})
        </div>
      ))}
    </div>
  )}
</div>
            </div>
          </div>

          {/* TABLE DIRECTLY BELOW */}
          <div className={styles.tableEntry}>
            <GlobalTable
              columns={columns}
              data={filteredData}
              total={total}
              loading={loading}
              pageSize={10}
              onPageChange={handlePageChange}
            />
            {error && (
              <p style={{ color: "red", padding: 16 }}>{error}</p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}