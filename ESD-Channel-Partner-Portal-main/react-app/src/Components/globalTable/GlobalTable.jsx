import React from "react";
import styles from "./GlobalTable.module.css";
import useTable from "./useTable";
import { ReceiptText } from "lucide-react";
export default function GlobalTable({
  columns = [],
  data = [],
  loading = false,
  total = 0,
  pageSize = 10,
  onRowClick,
  onPageChange
}) {
  const { 
    pageData, 
    page, 
    totalPages, 
    nextPage, 
    prevPage, 
    setPageSize, 
    pageSize: currentPageSize 
  } = useTable(data, pageSize, total);

  const isEmpty = !data || data.length === 0;

  // const getStatusClass = (status) => {
  //   if (!status) return "";
  //   const slug = status.toLowerCase().replace(/\s+/g, '-');
  //   return styles[`status-${slug}`] || "";
  // };

  return (
    <div className={styles.tableWrapper}>
      
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th 
                key={col.key} 
                className={styles.th}
                style={{ 
                  width: col.width || "auto",
                  minWidth: col.minWidth || "150px" // Ensures header doesn't crush
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && (
              <tr>
                <td colSpan={columns.length} className={styles.emptyRow}>
                  <div className="table-loader">
                    <span className="loader"></span>
                  </div>
                </td>
              </tr>
            )}

          {!loading && isEmpty && (
            <tr>
              <td colSpan={columns.length} className={styles.emptyRow}>
                <div className={styles.emptyBox}>
                  <div className={styles.emptyIcon}>
                    <ReceiptText size={36} strokeWidth={1.5} />
                  </div>
                  <div className={styles.emptyTitle}>No Data yet</div>
                  <div className={styles.emptyText}>
                    No Data found. Please check back later or adjust your filters.
                  </div>
                </div>
              </td>
            </tr>
          )}

          {!loading && !isEmpty && pageData.map((row, i) => (
            <tr
              key={row.ROWID || i}
              className={styles.tr}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={styles.td}
                  data-label={col.label}
                  style={{ minWidth: col.minWidth || "150px" }}
                >
                  {col.key === "lead_status" || col.key === "status" ? (
                    col.render ? (
                      col.render(row[col.key], row)
                    ) : (
                      <span className={`${styles.statusBadgeCustom}`}>
                        {row[col.key]}
                      </span>
                    )
                  ) : col.render ? (
                    col.render(row[col.key], row)
                  ) : (
                    row[col.key] ?? "-"
                  )}
                </td>
              ))}
            </tr>
          ))}

        </tbody>
      </table>

      {/* Pagination Container */}
        <div className={styles.pagination}>
          <div className={styles.paginationLeft}>
            <span className={styles.resultsText}>
              Showing
            </span>
            <div className={styles.limitSelector}>
              <select 
                value={currentPageSize} 
                onChange={(e) => {
  const newSize = Number(e.target.value);
  setPageSize(newSize);
  onPageChange && onPageChange(1, newSize);
}}
                className={styles.customSelect}
              >
                {[10, 20, 50].map(size => (
                  <option key={size} value={size}>{size} per page</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.paginationRight}>
            <div className={styles.navGroup}>
              <button 
                type="button" 
                className={styles.navBtn}
                onClick={(e) => {
  e.stopPropagation();
  prevPage();
  onPageChange && onPageChange(page - 1, currentPageSize);
}} 
                disabled={page === 1}
                title="Previous Page"
              >
                <span className={styles.arrowIcon}>←</span> Previous
              </button>
              
              <div className={styles.pageIndicator}>
                {page} / {totalPages}
              </div>

              <button 
                type="button" 
                className={styles.navBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  nextPage();
                  onPageChange && onPageChange(page + 1, currentPageSize);
                }}
                disabled={page === totalPages}
                title="Next Page"
              >
                Next <span className={styles.arrowIcon}>→</span>
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}