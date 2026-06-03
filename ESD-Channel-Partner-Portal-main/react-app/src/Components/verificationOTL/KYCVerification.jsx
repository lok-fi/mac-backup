import React, { useEffect, useState } from "react";
import styles from "./KYCVerification.module.css";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { updateUser } from "../../store/userSlice";

export default function KYCVerification() {
  console.log("🔵 KYCVerification component rendered");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  console.log("📍 useNavigate & dispatch initialized");

  // Redux CP data
  const cp = useSelector((state) => {
    console.log("🟡 Redux state inside selector:", state);
    return state.user?.data;
  });

  console.log("🟢 CP data from redux:", cp);

  // UI animation state
  const [activeStep, setActiveStep] = useState(-1);
  const [updatingOTL, setUpdatingOTL] = useState(false);

  const steps = [
    { label: "PAN Validation", verified: cp?.Pan_Validation },
    { label: "Bank Account Verification", verified: cp?.Bank_Account_Verification },
    { label: "GSTIN Verification", verified: cp?.GSTIN_Verification },
    { label: "Udyam Aadhaar Verification", verified: cp?.Udyam_Aadhaar_Verification },
  ];

  console.log("🟠 Steps array computed:", steps);
  const TOTAL_STEPS = 4;


  // Animate verification sequentially
  useEffect(() => {
    console.log("⏳ Starting verification animation");

    if (!cp) {
      console.log("⚠️ CP not ready yet, skipping animation");
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      console.log(`✅ Animating verification step ${index + 1}`);
      setActiveStep(index);
      index++;

      if (index >= TOTAL_STEPS) {
        clearInterval(interval);
        console.log("🎉 Verification animation completed");
      }
      

    }, 900);

    return () => clearInterval(interval);
  }, [cp]);

  const allVerified =
    activeStep >= steps.length - 1 &&
    steps.every((s) => s.verified);

  console.log("✅ allVerified value:", allVerified);

  // 🔥 OTL PATCH LOGIC (FIXED + SAFE)
  const handleContinue = async () => {
    console.log("🚀 Continue button clicked");
    console.log("📤 About to PATCH OTL=false");

    setUpdatingOTL(true);

    try {
      const action = await dispatch(updateUser({ OTL: false }));

      console.log("📥 updateUser dispatched action:", action);
      console.log("📌 requestStatus:", action.meta?.requestStatus);

      if (action.meta?.requestStatus === "fulfilled") {
        console.log("🎉 OTL updated successfully in Redux");
        console.log("➡️ Redirecting to /app/user");
        navigate("/app/user");
      } else {
        console.error("❌ updateUser failed:", action.payload);
        setUpdatingOTL(false);
      }
    } catch (err) {
      console.error("🔥 Exception during OTL update:", err);
      setUpdatingOTL(false);
    }
  };

  console.log("🧩 Rendering JSX");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Verifying your KYC...</h1>
        <p>Please wait while we validate your information</p>
      </div>

      <div className={styles.card}>
        {steps.map((step, idx) => {
          const isVerified = idx <= activeStep && step.verified;
          const isLoading = idx === activeStep + 1;

          console.log(
            `🔹 Step ${idx + 1}`,
            step.label,
            "| verified:",
            isVerified,
            "| loading:",
            isLoading
          );

          return (
            <div
              key={idx}
              className={`${styles.step} ${
                isVerified ? styles.verified : styles.pending
              }`}
            >
              <span
                className={`${styles.icon} ${
                    isLoading ? styles.loadingIcon : ""
                }`}
                >
                {isVerified ? "✓" : isLoading ? "◐" : "•"}
                </span>

              <span className={styles.text}>
                {isVerified
                  ? `${step.label} Verified`
                  : isLoading
                  ? `Verifying ${step.label}...`
                  : `Waiting for ${step.label}`}
              </span>
            </div>
          );
        })}

        {allVerified && (
          <>
            {console.log("🟢 All verified → showing Continue button")}
            <button
              className={styles.continueBtn}
              onClick={handleContinue}
              disabled={updatingOTL}
            >
              {updatingOTL ? "Finalizing..." : "Continue to Dashboard →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
