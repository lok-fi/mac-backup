import React, { useEffect, useState, useRef } from "react";
import Header from "../ui/Header";
import styles from "./profile.module.css";

import { useDispatch, useSelector } from "react-redux";
import { fetchUser, updateUser, uploadProfilePicture } from "../../store/userSlice";
import { fetchLeads } from "../../store/leadsSlice";
import { fetchCommissions } from "../../store/commissionSlice";
import { fetchAllUsers } from "../../store/allUsersSlice";
import { fetchSalesOrders } from "../../store/salesOrderSlice";
import SecuritySettings from "./security";
import Footer from "../ui/Footer";

export default function ProfilePage() {
  const dispatch = useDispatch();

  // =========================
  // AUTH + ROLE
  // =========================
  const authUser = useSelector((state) => state.auth.user);
  const role = useSelector((state) => state.auth.role);
  const isAdmin = role === "App Administrator";

  // =========================
  // USER (CP)
  // =========================
  const user = useSelector((state) => state.user.data);
  const userStatus = useSelector((state) => state.user.status);

  // =========================
  // LEADS & COMMISSIONS
  // =========================
  const leadsSlice = useSelector((s) => s.leads);
  const commissionsSlice = useSelector((s) => s.commissions);

  const leads = leadsSlice?.list ?? leadsSlice?.data ?? [];
  const { list: commissions } = useSelector((state) => state.commissions);

  const normalizedCommissions = (commissions || []).map(c => {
    let status = "due";
    if (c.UTR_Number) status = "paid";
    else if (c.Registration_Date) status = "pending";
    return { ...c, commission_status: status };
  });

  const allUsersSlice = useSelector((state) => state.allUsers);
  const allUsers = allUsersSlice?.list ?? allUsersSlice?.data ?? [];
  const totalUsers = allUsers.length;

  // =========================
  // EDIT MODE + FORM STATE
  // =========================
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    cp_name: "",
    mobile: "",
    agency_name: "",
    city: "",
    address: ""
  });

  // =========================
  // PROFILE PHOTO
  // =========================
  const fileInputRef = useRef(null);

  const onProfilePhotoClick = () => {
    // Both Admin and User can trigger this now
    fileInputRef.current?.click();
  };

  const onProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      dispatch(uploadProfilePicture(file));
    }
  };

  const salesOrders = useSelector((state) => state.salesOrders.data);
  const soStatus = useSelector((state) => state.salesOrders.status);
  const bookingsCount = salesOrders?.length ?? 0;

  // =========================
  // DATA FETCHING
  // =========================
  useEffect(() => {
    if (soStatus === "idle") dispatch(fetchSalesOrders());
    if (!user && userStatus === "idle") dispatch(fetchUser());
    if (!leads.length) dispatch(fetchLeads());
    if (!commissions?.length) dispatch(fetchCommissions());
    if (isAdmin) dispatch(fetchAllUsers());
  }, [dispatch, isAdmin]);

  // =========================
  // INITIAL FORM POPULATION
  // =========================
  useEffect(() => {
    // Only populate if we aren't currently editing
    if (!editMode) {
      const data = isAdmin ? (user || authUser) : user;
      if (data) {
        setForm({
          cp_name: data.cp_name || data.first_name || "",
          mobile: data.mobile || "",
          agency_name: data.agency_name || "",
          city: data.city || "",
          address: data.address || ""
        });
      }
    }
  }, [user, authUser, isAdmin, editMode]);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const onSave = () => {
    // Enabled for everyone
    dispatch(updateUser(form)).then(() => {
      setEditMode(false);
    });
  };

  const onCancel = () => {
    setEditMode(false);
    // Revert to data in store
    const data = isAdmin ? (user || authUser) : user;
    if (data) {
      setForm({
        cp_name: data.cp_name || data.first_name || "",
        mobile: data.mobile || "",
        agency_name: data.agency_name || "",
        city: data.city || "",
        address: data.address || ""
      });
    }
  };

  // =========================
  // DISPLAY HELPERS
  // =========================
  const displayName = form.cp_name || "User";
  const avatarLetter = displayName?.[0]?.toUpperCase() || "U";
  const email = isAdmin ? authUser?.email_id : user?.email;

  const pendingCommissionTotal = normalizedCommissions
    .filter(c => c.commission_status === "pending")
    .reduce((sum, c) => sum + Number(c.CP_Commission || 0), 0);

  const pendingCommission = `₹${pendingCommissionTotal.toLocaleString()}`;

  const pageLoading = userStatus === "loading" || soStatus === "loading";

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Profile</h1>
            <p className={styles.subtitle}>Manage your account details & preferences</p>
          </div>

          {pageLoading ? (
            <ProfileSkeleton styles={styles} isAdmin={isAdmin} />
          ) : (
            <div className={styles.profileWrapper}>
              <div className={styles.leftColumn}>
                <div className={styles.leftCard}>
                  <div className={styles.avatar}>
                    {user?.profile_path ? (
                      <img
                        src={`/server/esd_channel_partner_function/profile-image/${user.profile_path}`}
                        alt="Profile"
                        className={styles.avatarImg}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.innerText = avatarLetter;
                        }}
                      />
                    ) : avatarLetter}
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={onProfilePhotoChange}
                  />

                  <button
                    type="button"
                    className={styles.changeBtn}
                    onClick={onProfilePhotoClick}
                    disabled={userStatus === "loading"}
                  >
                    Change Photo
                  </button>

                  <div className={styles.divider} />
                  <div className={styles.nameRow}>
                    <h2 className={styles.name}>{displayName}</h2>
                    <span className={styles.tierBadge}>
                      {isAdmin ? "App Administrator" : "Silver Partner"}
                    </span>
                  </div>
                  <div className={styles.divider} />

                  {isAdmin ? (
                    <div className={styles.statsRow}>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{totalUsers}</span><br />
                        <span className={styles.statLabel}>Channel Partner Users</span>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.statsRow}>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{leads.length}</span><br />
                        <span className={styles.statLabel}>Leads</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{bookingsCount}</span><br />
                        <span className={styles.statLabel}>Bookings</span>
                      </div>
                      <div className={styles.stat}>
                        <span className={styles.statValue}>{pendingCommission}</span><br />
                        <span className={styles.statLabel}>Commission</span>
                      </div>
                    </div>
                  )}
                </div>

                {!isAdmin && (
                <div className={styles.kycCard}>
                  <h2 className={styles.kycTitle}>KYC Status</h2>

                  <div className={styles.kycItem}>
                    <div className={styles.kycLeft}>
                      <div className={styles.kycIcon}>✔</div>
                      <div>
                        <div className={styles.kycLabel}>PAN Card</div>
                        <div className={styles.kycValue}>
                          {user?.pan_number || "ABCDE1234F"}
                        </div>
                      </div>
                    </div>
                    <span className={styles.kycBadge}>Verified</span>
                  </div>

                  <div className={styles.kycItem}>
                    <div className={styles.kycLeft}>
                      <div className={styles.kycIcon}>✔</div>
                      <div>
                        <div className={styles.kycLabel}>Aadhaar</div>
                        <div className={styles.kycValue}>
                          {user?.aadhaar_number
                            ? `XXXX XXXX ${user.aadhaar_number.slice(-4)}`
                            : "XXXX XXXX 5678"}
                        </div>
                      </div>
                    </div>
                    <span className={styles.kycBadge}>Verified</span>
                  </div>

                  <div className={styles.kycItem}>
                    <div className={styles.kycLeft}>
                      <div className={styles.kycIcon}>✔</div>
                      <div>
                        <div className={styles.kycLabel}>RERA ID</div>
                        <div className={styles.kycValue}>
                          {user?.rera_id || "MH12345678"}
                        </div>
                      </div>
                    </div>
                    <span className={styles.kycBadge}>Verified</span>
                  </div>
                </div>
              )}
              </div>

              <div className={styles.rightColumn}>
                <div className={styles.rightCard}>
                  <div className={styles.formHeader}>
                    <h2 className={styles.sectionTitle}>Personal Information</h2>
                    {!editMode ? (
                      <button className={styles.editBtn} onClick={() => setEditMode(true)}>
                        ✏ Edit
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button className={styles.editBtn} onClick={onSave} disabled={userStatus === "loading"}>
                          💾 Save
                        </button>
                        <button className={styles.editBtn} onClick={onCancel}>
                          ✖ Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label>Full Name</label>
                      <input name="cp_name" value={form.cp_name} onChange={onChange} readOnly={!editMode} />
                    </div>
                    <div className={styles.field}>
                      <label>Email Address</label>
                      <input disabled value={email || ""} />
                    </div>
                    <div className={styles.field}>
                      <label>Mobile Number</label>
                      <input name="mobile" value={form.mobile} onChange={onChange} readOnly={!editMode} />
                    </div>
                    <div className={styles.field}>
                      <label>Agency Name</label>
                      <input name="agency_name" value={form.agency_name} onChange={onChange} readOnly={!editMode} />
                    </div>
                    <div className={styles.field}>
                      <label>City</label>
                      <input name="city" value={form.city} onChange={onChange} readOnly={!editMode} />
                    </div>
                    <div className={styles.field}>
                      <label>Address</label>
                      <input name="address" value={form.address} onChange={onChange} readOnly={!editMode} />
                    </div>
                  </div>
                </div>
                <SecuritySettings />
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ... ProfileSkeleton code ...
// =========================
// PROFILE SKELETON
// =========================
function ProfileSkeleton({ styles, isAdmin }) {
  return (
    <div className={styles.profileWrapper}>

      {/* LEFT */}
      <div className={styles.leftColumn}>
        <div className={styles.leftCard}>
          <div className={`${styles.skelAvatar} ${styles.skeleton}`} />
          <div className={`${styles.skelBtn} ${styles.skeleton}`} />

          <div className={styles.divider} />

          <div className={`${styles.skelTextLg} ${styles.skeleton}`} />
          <div className={`${styles.skelBadge} ${styles.skeleton}`} />

          <div className={styles.divider} />

          <div className={styles.statsRow}>
            <div className={`${styles.skelStat} ${styles.skeleton}`} />
            <div className={`${styles.skelStat} ${styles.skeleton}`} />
            <div className={`${styles.skelStat} ${styles.skeleton}`} />
          </div>
        </div>

        {!isAdmin && (
          <div className={styles.kycCard}>
            <div className={`${styles.skelTextLg} ${styles.skeleton}`} />
            <div className={`${styles.skelKyc} ${styles.skeleton}`} />
            <div className={`${styles.skelKyc} ${styles.skeleton}`} />
            <div className={`${styles.skelKyc} ${styles.skeleton}`} />
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className={styles.rightColumn}>
        <div className={styles.rightCard}>
          <div className={`${styles.skelTextLg} ${styles.skeleton}`} />
          <div className={styles.formGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${styles.skelInput} ${styles.skeleton}`} />
            ))}
          </div>
        </div>
        
      </div>
 <Footer />
    </div>
  );
}