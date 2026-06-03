import React, { useState } from "react";
import styles from "./profile.module.css";

export default function SecuritySettings() {
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const resetState = () => {
    setForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setError("");
    setSuccess("");
    setLoading(false);
  };

  const handlePasswordChange = async () => {
    setError("");
    setSuccess("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      return setError("All fields are required");
    }

    if (form.newPassword !== form.confirmPassword) {
      return setError("New password and confirmation do not match");
    }

    if (form.newPassword.length < 8) {
      return setError("Password must be at least 8 characters long");
    }

    try {
      await window.catalyst.auth.changePassword(
        form.currentPassword,
        form.newPassword
        );


      setSuccess("Password updated successfully");
      resetState();
      setShowPasswordForm(false);

    } catch (err) {
      console.error("Password change failed:", err);
      setError(
        err?.message || "Failed to update password. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div className={styles.securityCard}>
      <h2 className={styles.sectionTitle}>Security Settings</h2>

      {/* PASSWORD */}
      <div className={styles.securityItem}>
        <div>
          <div className={styles.securityLabel}>Password</div>
          <div className={styles.securitySub}>
            Update your account password
          </div>
        </div>

        <button
          className={styles.securityBtn}
          onClick={() => setShowPasswordForm(true)}
        >
          Change
        </button>
      </div>

      {/* PASSWORD FORM */}
      {showPasswordForm && (
        <div className={`${styles.formGrid} ${styles.securityForm}`}>
          <div className={styles.field}>
            <label>Current Password</label>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={onChange}
            />
          </div>

          <div className={styles.field}>
            <label>New Password</label>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={onChange}
            />
          </div>

          <div className={styles.field}>
            <label>Confirm New Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={onChange}
            />
          </div>

          {error && (
            <div style={{ color: "red", fontSize: "14px" }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ color: "green", fontSize: "14px" }}>
              {success}
            </div>
          )}

          <div className={styles.securityActions}>
            <button
                className={styles.editBtn}
                onClick={handlePasswordChange}
                disabled={loading}
            >
                {loading ? "Updating..." : "Save Password"}
            </button>

            <button
                className={styles.editBtn}
                onClick={() => {
                resetState();
                setShowPasswordForm(false);
                }}
            >
                Cancel
            </button>
            </div>

        </div>
      )}

      {/* 2FA (NEXT STEP) */}
      {/* <div className={styles.securityItem} style={{ marginTop: "20px" }}>
        <div>
          <div className={styles.securityLabel}>
            Two-Factor Authentication
          </div>
          <div className={styles.securitySub}>Not enabled</div>
        </div>
        <button className={styles.securityBtn} disabled>
          Enable
        </button>
      </div> */}
    </div>
  );
}
