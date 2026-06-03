import React, { useState, useRef, useEffect } from "react";
import styles from "./GlobalSelect.module.css";

const GlobalSelect = ({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select",
  required = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

// const selectedOption = options.find((opt) => opt.label === value);
// ⭐ Correct selection logic (uses value instead of label) 
const selectedOption = options.find((opt) => opt.value === value);
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={styles.selectWrapper} ref={wrapperRef}>
      {label && (
        <label className={styles.label} data-required={required}>
          {label}
        </label>
      )}

      <div
        className={`${styles.selectBox} ${open ? styles.active : ""}`}
        onClick={() => setOpen(!open)}
      >
        {selectedOption ? selectedOption.label : placeholder}
        <span className={styles.arrow}>▾</span>
      </div>

      {open && (
        <div className={styles.dropdown}>
          <input
            type="text"
            placeholder="Search..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />

          <div className={styles.options}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.label}
                  className={styles.option}
                  onClick={() => {
  onChange(opt.value);
  setOpen(false);
  setSearch("");
}}
                >
                  {opt.label}
                </div>
              ))
            ) : (
              <div className={styles.noData}>No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalSelect;

