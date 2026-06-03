import React, { useEffect, useState, useRef } from "react";
import styles from "./Header.module.css";
import { Link, NavLink } from "react-router-dom"; // ✅ Added NavLink
import logo from "../assets/logo.png";
import { useSelector } from "react-redux";

export default function Header() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const wrapperRef = useRef(null);

  const role = useSelector((state) => state.auth.role);          // From authSlice
  const cpUser = useSelector((state) => state.user.data);        // CP DB user
  const authUser = useSelector((state) => state.auth.user);      // Catalyst user
  const user = useSelector((state) => state.user.data);

  // ROLE-BASED NAVIGATION CONFIG
  const NAV_CONFIG = {
    "App User": [
      { name: "Home", path: "/app/user" },
      { name: "Leads", path: "/app/leads" },
      { name: "Commissions", path: "/app/commissions" },
      { name: "Brochures", path: "/app/brouchers" },
      // { name: "Sales Orders", path: "/app/sales_orders" },
      // { name: "Support", path: "/app/support" },
    ],
    "App Administrator": [
      { name: "Home", path: "/app/admin" },
      { name: "Brochures", path: "/app/admin/brochures" },
      { name: "Users", path: "/app/admin/all_users" },
    ],
  };

  const navItems = NAV_CONFIG[role] || [];

  // Logout Logic
  const handleLogout = () => {
    try {
      const redirectURL = `${window.location.origin}/#/app/login`;
      if (window.catalyst?.auth?.signOut) {
        sessionStorage.clear();
        localStorage.clear();
        window.catalyst.auth.signOut(redirectURL);
      } else {
        window.location.replace(redirectURL);
      }
    } catch (err) {
      console.error("Logout error:", err);
      window.location.replace(`${window.location.origin}/#/app/login`);
    }
  };

  
  // Display Name Logic
  const displayName = cpUser?.cp_name || authUser?.first_name;
  const avatarLetter =
  user?.cp_name?.[0]?.toUpperCase() ||
  user?.first_name?.[0]?.toUpperCase() ||
  "U";

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, []);

  

  return (
    <header className={styles.header}>
      <div className={styles.container}>

        {/* LOGO */}
        <div className={styles.logo}>
          <Link to="/">
            <img src={logo} alt="Logo" className={styles.logoImg} />
          </Link>
          <span className={styles.badge}>Channel Partner Portal</span>
        </div>

        {/* DESKTOP NAV - Permanent Active Highlight Added */}
        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              to={item.path}
              end={item.path === "/app/admin"}   // 🔥 ONLY exact match
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? 'active' : ''}`
              }
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* USER SECTION */}
        <div className={styles.userSection}>
          
          <button
            className={styles.hamburger}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            ☰
          </button>

          <div className={styles.userProfileWrapper} ref={wrapperRef}>
            <div
              className={styles.userProfile}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className={styles.avatar}>
                {user?.profile_path ? (
                  <img
                    src={`/server/esd_channel_partner_function/profile-image/${user.profile_path}`}
                    alt="Profile"
                    className={styles.avatarImg}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.parentNode.innerText = avatarLetter;
                    }}
                  />
                ) : (
                  avatarLetter
                )}
              </div>

              <div className={styles.userInfo}>
                <div className={styles.userName}>{displayName}</div>
                {/* <div className={styles.userRole}>{role}</div> */}
              </div>
            </div>

            {/* DROPDOWN MENU */}
            {showDropdown && (
              <div className={styles.dropdown}>
                <Link to="/app/profile" className={styles.dropdownItem}>My Profile</Link>
                {/* <Link to="/settings" className={styles.dropdownItem}>Settings</Link> */}
                <div className={styles.dropdownDivider}></div>
                <button className={styles.dropdownItem} onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE MENU - Permanent Active Highlight Added */}
      {showMobileMenu && (
        <div className={styles.mobileMenu}>
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setShowMobileMenu(false)}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              {item.name}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}