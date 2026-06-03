
import React, { useEffect, useState, useRef } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { ReceiptText, MapPin, Home, IndianRupee, Maximize, CheckCircle2, XCircle } from "lucide-react";

import styles from './AdminBrochures.module.css';
import Button from "../../ui/Button";
import Footer from '../../ui/Footer';
import Header from '../../ui/Header';
import Card from '../../ui/Card';
import { fetchBrochures, updateBrochureLocal } from "../../../store/brochureslice";
import Pagination from "../../ui/Pagination";

const CATEGORIES = ['All', 'Residential', 'Commercial', 'Plots'];

export default function AdminBrochures() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  console.log("🟢 [AdminBrochures] Component render");

  // 1. ADDED: Debounce timer for search
  const debounceTimer = useRef(null);

  /* ===========================
     REDUX STATE
     =========================== */
  const brochures = useSelector((state) => state.brochures.list);
  const loading = useSelector((state) => state.brochures.loading);
  const error = useSelector((state) => state.brochures.error);
  const total = useSelector((state) => state.brochures.total);

  /* ===========================
     UI STATE
     =========================== */
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [snackbar, setSnackbar] = useState({ open: false, type: "success", message: "" });

  // 🔥 NEW: State for our custom dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 🔥 NEW: Close dropdown if user clicks outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ===========================
     HANDLERS
     =========================== */
  const showSnackbar = (message, type = "success") => {
    setSnackbar({ open: true, message, type });
    setTimeout(() => setSnackbar(s => ({ ...s, open: false })), 3500);
  };

  const toggleStatus = async (item) => {
    const newStatus = !item.is_active;

    // UI update
    dispatch(updateBrochureLocal({
      ...item,
      is_active: newStatus
    }));

    try {
      await fetch(`/server/desk_function/update-brochure-status/${item.ROWID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newStatus })
      });
      showSnackbar(newStatus ? "Brochure enabled successfully" : "Brochure disabled successfully");
    } catch (err) {
      showSnackbar("Failed to update", "error");
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    dispatch(fetchBrochures({
      page,
      pageSize: itemsPerPage,
      search,
      category: selectedCategory
    }));
  };

  /* ===========================
     FETCH DATA (Runs on mount & category changes)
     =========================== */
  // 2. UPDATED: Fetch now includes search and category parameters
  useEffect(() => {
    dispatch(fetchBrochures({
      page: currentPage,
      pageSize: itemsPerPage,
      search: search,
      category: selectedCategory
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, currentPage, itemsPerPage, selectedCategory]); 
  // Note: We don't put 'search' in dependency array to prevent double-fetching, 
  // the debounce handles search typing.

  /* ===========================
     RENDER
     =========================== */
  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          
          {/* HEADER */}
          <div className={styles.header}>
            <div className={styles.headerText}>
              <h1 className={styles.title}>Property Brochures</h1>
              {/* <p className={styles.subtitle}>Manage and Upload Property Brochures</p> */}
            </div>
            <div className={styles.headerActions}>
              
              {/* 3. UPDATED: Search Input with Debounce */}
              <div className={styles.searchGrow}>
                <input
                  type="search"
                  placeholder="Search by property name or location..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSearch(value);
                    setCurrentPage(1);

                    if (debounceTimer.current) {
                      clearTimeout(debounceTimer.current);
                    }

                    debounceTimer.current = setTimeout(() => {
                      dispatch(fetchBrochures({
                        page: 1,
                        pageSize: itemsPerPage,
                        search: value,
                        category: selectedCategory
                      }));
                    }, 300);
                  }}
                />
              </div>

              {/* TABS */}
              {/* 🔥 NEW CUSTOM DROPDOWN */}
              <div className={styles.customDropdownContainer} ref={dropdownRef}>
                <button
                  type="button"
                  className={`${styles.customDropdownTrigger} ${isDropdownOpen ? styles.triggerActive : ''}`}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {selectedCategory}
                  <svg
                    className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.arrowOpen : ''}`}
                    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                {isDropdownOpen && (
                  <div className={styles.customDropdownMenu}>
                    {CATEGORIES.map((cat) => (
                      <div
                        key={cat}
                        className={`${styles.customDropdownItem} ${selectedCategory === cat ? styles.itemActive : ''}`}
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCurrentPage(1);
                          setIsDropdownOpen(false); // Close after selecting
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button variant="primary" size="md" onClick={() => navigate("/app/admin/addbrochures")}>
                + Add Brochures
              </Button>
            </div>
          </div>

          {/* CONTENT */}
          <div className={styles.gridContainer}>

            {/* LOADING STATE */}
            {loading && (
              <div className={styles.leadsGrid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`${styles.leadCard} ${styles.skelCard}`}>
                    <div className={styles.cardHeader}>
                      <div className={styles.skelBadge}></div>
                      <div className={styles.skelBadgeSmall}></div>
                    </div>
                    <div className={styles.skelTitle}></div>
                    <div className={styles.skelDesc}></div>
                    <div className={styles.metaBox}>
                      <div className={styles.metaRow}>
                        <div className={styles.skelLine}></div>
                        <div className={styles.skelLine}></div>
                      </div>
                      <div className={styles.metaRow}>
                        <div className={styles.skelLine}></div>
                        <div className={styles.skelLine}></div>
                      </div>
                    </div>
                    <div className={styles.skelFeatures}>
                      <div></div><div></div><div></div>
                    </div>
                    <div className={styles.leadActions}>
                      <div className={styles.skelBtn}></div>
                      <div className={styles.skelBtn}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ERROR STATE */}
            {error && (
              <div className={styles.errorText}>
                {error}
              </div>
            )}

            {/* GRID - NOW MAPPED DIRECTLY FROM REDUX 'brochures' */}
            {!loading && brochures.length > 0 && (
              <div className={styles.leadsGrid}>
                {brochures.map((item, index) => (
                  <Card
                    key={item.ROWID}
                    className={styles.leadCard}
                    hoverable
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {/* BADGES */}
                    <div className={styles.cardHeader}>
                      <span className={`${styles.badge} ${styles[item.project_type?.toLowerCase()]} ${item.project_type === 'Residential' ? styles.shimmer : ''}`}>
                        {item.project_type}
                      </span>
                      <span className={styles.activeStatus}>
                        {item.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <h3 className={styles.cardTitle}>
                      {item.project_name}
                    </h3>

                    <p className={styles.desc}>
                      {item.project_tagline || 'Luxury Redefined'}
                    </p>

                    <div className={styles.metaBox}>
                      <div className={styles.metaRow}>
                        <div className={styles.metaItem}>
                          <MapPin size={15} className={styles.icon} /> {item.locality}, {item.city}
                        </div>
                        <div className={styles.metaItem}>
                          <Home size={15} className={styles.icon} /> {item.bhk_configuration || '2,3'}
                        </div>
                      </div>
                      <div className={styles.metaRow}>
                        <div className={styles.metaItem}>
                          <IndianRupee size={15} className={styles.icon} /> {item.price}
                        </div>
                        <div className={styles.metaItem}>
                          <Maximize size={15} className={styles.icon} /> {item.area_min_sqft} – {item.area_max_sqft} sq.ft
                        </div>
                      </div>
                    </div>

                    {item.amenities && (
                      <div className={styles.features}>
                        {item.amenities.split(',').map((f, i) => (
                          <span key={i} className={styles.feature}>
                            ✓ {f.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className={styles.leadActions}>
                      <button className={styles.previewBtn} onClick={() => navigate(`/app/admin/editbrochure/${item.ROWID}`)}>
                        Edit
                      </button>
                      <button className={styles.actionBtn} onClick={() => toggleStatus(item)}>
                        {item.is_active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && brochures.length === 0 && (
              <div className={styles.emptyWrapper}>
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <ReceiptText size={34} strokeWidth={1.8} />
                  </div>
                  <h3 className={styles.emptyTitle}>No Brochures Found</h3>
                  <p className={styles.emptySubtitle}>
                    We couldn't find any brochures matching your search or filters.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PAGINATION */}
          {!loading && total > 0 && (
            <Pagination
              totalItems={total}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onLimitChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
                dispatch(fetchBrochures({
                  page: 1,
                  pageSize: limit,
                  search: search,
                  category: selectedCategory
                }));
              }}
            />
          )}

        </div>
      </main>

      {/* SNACKBAR */}
      {snackbar.open && (
        <div className={styles.snackbarWrapper}>
          <div className={`${styles.snackbar} ${styles[snackbar.type]}`}>
            <span className={styles.snackIcon}>
              {snackbar.type === "success" ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <XCircle size={18} strokeWidth={2.5} />}
            </span>
            <span className={styles.snackText}>{snackbar.message}</span>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}