import { useState, useRef, useEffect } from "react";
import styles from "./CustomSelect.module.css";

export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = "Select",
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // close when clicked outside
  useEffect(() => {
    const handleClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.wrapper} ref={ref}>
      {/* SELECT BUTTON */}
      <div
        className={styles.select}
        onClick={() => setOpen((p) => !p)}
      >
        <span>{selected?.label || placeholder}</span>
        <span className={styles.arrow}>▾</span>
      </div>

      {/* DROPDOWN MENU */}
      {open && (
        <div className={styles.menu}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.option} ${
                opt.value === value ? styles.active : ""
              }`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
