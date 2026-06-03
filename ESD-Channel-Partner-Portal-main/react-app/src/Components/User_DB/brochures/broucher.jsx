import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ReceiptText, MapPin, Home, IndianRupee, Maximize, CheckCircle2, XCircle } from "lucide-react";

import styles from './page.module.css';
import Footer from '../../ui/Footer';
import Header from '../../ui/Header';
import Card from '../../ui/Card';
import { fetchUserBrochures } from '../../../store/brochureslice';
import Pagination from "../../ui/Pagination";

const CATEGORIES = ['All', 'Residential', 'Commercial', 'Plots'];

export default function UserBrochures() {
  const dispatch = useDispatch();

  console.log("🟢 [UserBrochures] Component render");

  const debounceTimer = useRef(null);

  /* ===========================
     REDUX STATE
     =========================== */
  const userList = useSelector((state) => state.brochures.userList);
  const userLoading = useSelector((state) => state.brochures.userLoading);
  const error = useSelector((state) => state.brochures.error);
  const total = useSelector((state) => state.brochures.userTotal);

  /* ===========================
     UI STATE
     =========================== */
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [previewItem, setPreviewItem] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const [snackbar, setSnackbar] = useState({ open: false, type: "success", message: "" });

  // 🔥 DROPDOWN STATE
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown if clicked outside
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
     FETCH DATA
     =========================== */
  useEffect(() => {
    dispatch(fetchUserBrochures({
      page: currentPage,
      pageSize: itemsPerPage,
      category: selectedCategory,
      search: search
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, currentPage, itemsPerPage, selectedCategory]); 

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  /* ===========================
     HANDLERS
     =========================== */
  const showSnackbar = (message, type = "success") => {
    setSnackbar({ open: true, message, type });
    setTimeout(() => setSnackbar(s => ({ ...s, open: false })), 3500);
  };

  const handleDownload = async (item, filePath) => {
    if (!filePath) return;
    const fileUrl = `https://esd-channel-partner-development.zohostratus.in/${encodeURI(filePath)}`;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const actualFileName = filePath.split('/').pop() || `${item.project_name}.pdf`;
      link.download = actualFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      showSnackbar("Brochure downloaded", "success");
    } catch {
      showSnackbar("Download failed", "error");
    }
  };

  const handlePreview = async (item, filePath) => {
    if (!filePath) return;
    const fileUrl = `https://esd-channel-partner-development.zohostratus.in/${encodeURI(filePath)}`;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPreviewItem({
        ...item,
        blobUrl
      });
    } catch (err) {
      console.error("Preview failed:", err);
    }
  };

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
              {/* <p className={styles.subtitle}>
                Download or Preview Brochures for Available Properties
              </p> */}
            </div>
            
            <div className={styles.headerActions}>
              
              {/* SEARCH INPUT WITH DEBOUNCE */}
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
                      dispatch(fetchUserBrochures({
                        page: 1,
                        pageSize: itemsPerPage,
                        search: value,
                        category: selectedCategory
                      }));
                    }, 300);
                  }}
                />
              </div>

              {/* 🔥 CUSTOM DROPDOWN */}
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
                          setIsDropdownOpen(false); // Close menu on click
                        }}
                      >
                        {cat}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* CONTENT */}
          <div className={styles.gridContainer}>

            {/* LOADING */}
            {userLoading && (
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

            {/* ERROR */}
            {error && (
              <div className={styles.errorText}>
                {error}
              </div>
            )}

            {/* GRID */}
            {!userLoading && userList.length > 0 && (
              <div className={styles.leadsGrid}>
                {userList.map((item, index) => {
              
                  // SAFELY PARSE THE FILE ARRAY
                  let filesArray = [];
                  if (item.brochure_file) {
                    try {
                      if (item.brochure_file.trim().startsWith('[')) {
                        filesArray = JSON.parse(item.brochure_file);
                      } else {
                        filesArray = [item.brochure_file];
                      }
                    } catch(e) {
                      filesArray = [item.brochure_file];
                    }
                  }

                  return (
                    <Card
                      key={item.ROWID || index}
                      className={styles.leadCard}
                      hoverable
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {/* BADGES */}
                      <div className={styles.cardHeader}>
                        <span
                          className={`${styles.badge} ${styles[item.project_type?.toLowerCase()]} ${
                            item.project_type === 'Residential' ? styles.shimmer : ''
                          }`}
                        >
                          {item.project_type}
                        </span>
                        <span className={styles.activeStatus}>
                          {item.project_status}
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

                      {/* MULTIPLE FILES ACTION AREA */}
                      <div className={styles.leadActions} style={{ flexDirection: 'column', gap: '8px', alignItems: 'stretch' }}>
                        <h4 style={{fontSize: '13px', margin: '0 0 5px 0', color: '#666'}}>Available Documents:</h4>
                        
                        {filesArray.length > 0 ? (
                          filesArray.map((filePath, fileIndex) => {
                            const fileName = filePath.split('/').pop()?.replace(/^\d+_/, '') || `Document ${fileIndex + 1}`; 
                            
                            return (
                              <div key={fileIndex} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#f8f9fa', borderRadius: '4px' }}>
                                <span style={{fontSize: '12px', color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px'}} title={fileName}>
                                  📄 {fileName}
                                </span>
                                <div style={{display: 'flex', gap: '6px'}}>
                                  <button className={styles.previewBtn} onClick={() => handlePreview(item, filePath)} style={{padding: '4px 10px', fontSize: '12px'}}>
                                    Preview
                                  </button>
                                  <button className={styles.actionBtn} onClick={() => handleDownload(item, filePath)} style={{padding: '4px 10px', fontSize: '12px'}}>
                                    Download
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <span style={{fontSize: '12px', color: '#999', padding: '8px 0'}}>No files attached</span>
                        )}
                      </div>

                    </Card>
                  );
                })}
              </div>
            )}

            {/* EMPTY */}
            {!userLoading && userList.length === 0 && (
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
          {!userLoading && total > 0 && (
            <Pagination
              totalItems={total}
              itemsPerPage={itemsPerPage}
              currentPage={currentPage}
              onPageChange={handlePageChange}
              onLimitChange={(limit) => {
                setItemsPerPage(limit);
                setCurrentPage(1);
                dispatch(fetchUserBrochures({
                  page: 1,
                  pageSize: limit,
                  category: selectedCategory,
                  search: search
                }));
              }}
            />
          )}

        </div>
      </main>
      <Footer />

      {/* SNACKBAR */}
      {snackbar.open && (
        <div className={styles.snackbarWrapper}>
          <div className={`${styles.snackbar} ${styles[snackbar.type]}`}>
            <span className={styles.snackIcon}>
              {snackbar.type === "success" ? <CheckCircle2 size={18} strokeWidth={2.5}/> : <XCircle size={18} strokeWidth={2.5}/>}
            </span>
            <span className={styles.snackText}>{snackbar.message}</span>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewItem && (
        <div className={styles.previewOverlay}>
          <div className={styles.previewModal}>
            <div className={styles.previewHeader}>
              <h3>{previewItem.project_name}</h3>
              <button className={styles.closeBtn} onClick={() => setPreviewItem(null)}>✕</button>
            </div>
            <iframe title="Brochure Preview" src={previewItem.blobUrl} className={styles.previewIframe} />
          </div>
        </div>
      )}
    </div>
  );
}
