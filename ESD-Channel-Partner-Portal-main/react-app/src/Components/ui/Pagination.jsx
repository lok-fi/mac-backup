import styles from "./Pagination.module.css";

export default function Pagination({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onLimitChange,
  limits = [6, 9, 18, 27],
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (totalPages < 1) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.pagination}>

        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          «
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ‹
        </button>

        {/* Current page only */}
        <button className={styles.active}>
          {currentPage}
        </button>

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          ›
        </button>

        {/* Last */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          »
        </button>

        {/* Info */}
        <span className={styles.info}>
          Showing {itemsPerPage} per page
        </span>

        {/* Limit */}
        <select
          value={itemsPerPage}
          onChange={(e) => onLimitChange(Number(e.target.value))}
        >
          {limits.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

      </div>
    </div>
  );
}
