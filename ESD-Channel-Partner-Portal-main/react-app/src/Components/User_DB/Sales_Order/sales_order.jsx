import React, { useEffect, useState, useMemo } from "react";
import styles from "./sales_order.module.css";
import { useNavigate } from "react-router-dom";

import Header from "../../ui/Header";
import Card from "../../ui/Card";

import { useSelector, useDispatch } from "react-redux";
import { fetchSalesOrders } from "../../../store/salesOrderSlice";

/* 🔥 PAGINATION COMPONENT */
import Pagination from "../../ui/Pagination";

export default function SalesOrderPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleViewDetails = (order) => {
    navigate(`/app/so-journey/${order.ROWID}`);
  };

  const salesOrders = useSelector((state) => state.salesOrders.data);
  const status = useSelector((state) => state.salesOrders.status);
  const error = useSelector((state) => state.salesOrders.error);

  /* ===========================
     UI STATE
     =========================== */
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");

  /* 🔥 PAGINATION STATE */
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);

  const getStatusVariant = (status) => {
    switch (status) {
      case "Registered":
        return "success";
      case "Booked":
        return "warning";
      default:
        return "default";
    }
  };

  useEffect(() => {
    if (status === "idle") {
      dispatch(fetchSalesOrders());
    }
  }, [status, dispatch]);

  // Extract project names for dropdown
  const projectOptions = useMemo(() => {
    const set = new Set();
    salesOrders.forEach(o => o.project_name && set.add(o.project_name));
    return Array.from(set);
  }, [salesOrders]);

  /* ===========================
     FILTER LOGIC
     =========================== */
  const filteredOrders = useMemo(() => {
  return salesOrders
    .filter((o) => {
      const s = search.toLowerCase();

      if (s) {
        const projectMatch = o.project_name?.toLowerCase().includes(s);
        const idMatch = o.sales_order_id?.toString().toLowerCase().includes(s);
        const cpMatch = o.cp_name?.toLowerCase().includes(s);
        if (!projectMatch && !idMatch && !cpMatch) return false;
      }

      if (statusFilter && o.booking_status !== statusFilter) return false;
      if (projectFilter && o.project_name !== projectFilter) return false;

      return true;
    })
    // 🔥 SORT: newest first
    .sort((a, b) => {
      const t1 = a.booking_date ? new Date(a.booking_date).getTime() : 0;
      const t2 = b.booking_date ? new Date(b.booking_date).getTime() : 0;
      return t2 - t1;
    });
}, [salesOrders, search, statusFilter, projectFilter]);

  /* ===========================
     PAGINATION SLICE
     =========================== */
  const totalItems = filteredOrders.length;
  const startIndex = (currentPage - 1) * itemsPerPage;

  const currentOrders = filteredOrders.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  /* 🔥 RESET PAGE WHEN FILTER/LIMIT CHANGES */
  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, search, statusFilter, projectFilter]);

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>My Sales Orders</h1>
              <p className={styles.subtitle}>
                Track and manage all your sales bookings
              </p>
            </div>
          </div>

          {/* FILTERS */}
          <Card className={styles.filterCard}>
            <div className={styles.filters}>
              <input
                type="search"
                placeholder="Search by project, order ID, or CP..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className={styles.filterSelect}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Booked">Booked</option>
                <option value="Registered">Registered</option>
              </select>

              <select
                className={styles.filterSelect}
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">All Projects</option>
                {projectOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* LOADING */}
          {status === "loading" && (
            <p style={{ padding: 20 }}>Loading sales orders...</p>
          )}

          {/* ERROR */}
          {status === "error" && (
            <p style={{ padding: 20, color: "red" }}>
              Error loading sales orders: {error}
            </p>
          )}

          {/* EMPTY */}
          {status === "success" && filteredOrders.length === 0 && (
            <div className={styles.emptyState}>
              <h3>There are no sales orders</h3>
              <p>Your sales orders will appear here once available.</p>
            </div>
          )}

          {/* GRID */}
          {status === "success" && currentOrders.length > 0 && (
            <>
              <div className={styles.leadsGrid}>
                {currentOrders.map((order, index) => (
                  <div
                    key={order.ROWID || index}
                    className={styles.leadCard}
                  >
                    <div className={styles.cardTop}>
                      <span
                        className={`${styles.statusBadgeCustom} ${styles.shimmer}`}
                        data-variant={getStatusVariant(order.booking_status)}
                      >
                        {order.booking_status}
                      </span>
                      <span className={styles.dateText}>
                        {order.booking_date
                          ? new Date(order.booking_date).toLocaleDateString(
                              "en-IN",
                              { day: "2-digit", month: "short", year: "numeric" }
                            )
                          : "Recently Created"}
                      </span>
                    </div>

                    <div className={styles.cardIdentity}>
                      <h3 className={styles.leadName}>
                        {order.project_name}
                      </h3>
                      <p className={styles.orderId}>
                        Order ID: {order.sales_order_id}
                      </p>
                    </div>

                    <div className={styles.dynamicInfoBox}>
                      <div className={styles.infoGrid}>
                        <div className={styles.infoEntry}>
                          <span className={styles.infoLabel}>
                            Building & Unit
                          </span>
                          <span className={styles.infoValue}>
                            {order.building_name} | {order.unit_number}
                          </span>
                        </div>
                        {order.cp_name && (
                          <div className={styles.cpTag}>
                            Partner: <strong>{order.cp_name}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.cardFooter}>
                      <button
                        className={styles.primaryBtn}
                        onClick={() => handleViewDetails(order)}
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 🔥 PAGINATION */}
              <Pagination
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onLimitChange={setItemsPerPage}
                limits={[6, 9, 18, 27]}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
