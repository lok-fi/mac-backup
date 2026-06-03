import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import Header from '../../ui/Header';
import Card from '../../ui/Card';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import { useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUser } from '../../../store/userSlice';
import { fetchProjects } from '../../../store/projectSlice';  
import { CheckCircle2, XCircle } from "lucide-react";
import GlobalSelect from '../../ui/GlobalSelect';
import Footer from '../../ui/Footer';

export default function AddLeadPage() {
  const [loading, setLoading] = useState(false);
  const [mobileError, setMobileError] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Fetch user from Redux (must contain cp_id)
  const user = useSelector((state) => state.user?.data);
  const projects = useSelector((state) => state.projects.data);
  const budgetOptions = [
  { value: "30-50", label: "₹30L - ₹50L" },
  { value: "50-75", label: "₹50L - ₹75L" },
  { value: "75-100", label: "₹75L - ₹1Cr" },
  { value: "100+", label: "₹1Cr+" }
];
  
  const [form, setForm] = useState({
    name: "",
    mobile: "",
    email: "",
    city: "",
    project: "",
    budget: "",
    status: "New Lead",
    siteStatus: "Pending",
    
  });
const [snackbar, setSnackbar] = useState({
  open: false,
  type: "success",
  message: ""
});
  

  // If user is not loaded (direct navigation), fetch user

  useEffect(() => {
    if (!user) {
      dispatch(fetchUser());
    }
  }, [user, dispatch]);
  //this si for projects
  useEffect(() => {
  if (projects.length === 0) {
    dispatch(fetchProjects());
  }
}, [dispatch, projects.length]);
console.log("User in AddLeadPage:", projects);

const showSnackbar = (message, type = "success") => {
  setSnackbar({ open: true, message, type });

  setTimeout(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, 3500);
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.mobile.length !== 10) {
    setMobileError("Mobile number must be 10 digits");
    return;
  }

  setMobileError("");
    setLoading(true);

    console.log("User Data:", user);
    console.log("cp_id:", user?.ROWID);

    if (!user?.ROWID) {
      showSnackbar("Channel Partner ID missing", "error");
      setLoading(false);
      return;
    }

    const BUDGET_MAP = {
      "30-50": { min: 30, max: 50 },
      "50-75": { min: 50, max: 75 },
      "75-100": { min: 75, max: 100 },
      "100+": { min: 100, max: null } // 👈 KEY FIX
    };
    const budgetRange = BUDGET_MAP[form.budget] || {};

    const payload = {
      customer_name: form.name,
      customer_mobile: form.mobile,
      customer_email: form.email,
      city: form.city || null,
      project_name: form.project,
      
      Min_Budget_lacs: budgetRange.min ?? null,
      Max_Budget_lacs: budgetRange.max ?? null,
      lead_status: form.status,
      site_visit_status: form.siteStatus,
      Lead_Source: "CP",
      cp_id: user.ROWID,   // <--- FIXED
      
    };

    console.log("Payload Sent:", payload);

    try {
      const res = await fetch(
        "https://esd-channel-partner-60040289923.development.catalystserverless.in/server/esd_channel_partner_function/leads",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      console.log("Create Lead Response:", data);

      if (data.success) {
        showSnackbar("Lead Created Successfully ", "success");

        setTimeout(() => {
          navigate("/app/leads");
        }, 1200); // let user see message
      } else {
        showSnackbar("Failed to Create Lead ", "error");
      }

    } catch (err) {
  console.error("Lead creation error:", err);
  showSnackbar("Server error while creating lead", "error");
}

    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>

          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Add New Lead</h1>
              {/* <p className={styles.subtitle}>Enter customer details to create a new lead</p> */}
            </div>

            <Link to="/app/leads">
              <Button variant="ghost" size="md">← Back</Button>
            </Link>
          </div>

          <Card className={styles.formCard}>
            <form onSubmit={handleSubmit} className={styles.form}>

              {/* Customer Information */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Customer Information</h3>

                <div className={styles.formRow}>
                  <Input className={styles.input}
                    type="text"
                    label="Full Name"
                    required
                    placeholder="Full Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />

                  <Input
                    className={styles.input}
                    type="tel"
                    label="Mobile Number"
                    required
                    pattern="[0-9]{10}"
                    maxLength={10}
                    title="Mobile number must be exactly 10 digits"
                    placeholder="+91 XXXXX XXXXX"
                    value={form.mobile}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");

                      if (value.length <= 10) {
                        setForm({ ...form, mobile: value });
                      }
                    }}
                  />

                {mobileError && (
                  <div style={{ color: "red", fontSize: "12px", marginTop: "4px" }}>
                    {mobileError}
                  </div>
                )}
                </div>

                <div className={styles.formRow}>
                  <Input 
                    type="email"
                    label="Email"
                    required
                    placeholder="customer@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />

                  <Input
                    type="text"
                    label="City"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
              </div>

              {/* Project Details */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Project Details</h3>

                <div className={styles.formRow}>
                  <div className={styles.selectWrapper}>
                  <label className={styles.label} data-required>Project </label>
                    <GlobalSelect
                    
                    required
                    value={form.project}
                    onChange={(val) => setForm({ ...form, project: val })}
                    placeholder="Select Project"
                    options={projects.map((proj) => ({
                      value: proj.project_name,
                      label: proj.project_name,
                    }))}
                  />
                    {/* <label className={styles.label} data-required>Project </label>
                    
                    <select
                        className={styles.select}
                        required
                        value={form.project}
                        onChange={(e) => setForm({ ...form, project: e.target.value })}>
                        <option value="">Select a project</option>
 
                        {projects.map((proj) => (
                          <option
                            key={proj.project_rec_id}
                            value={proj.project_rec_id}
                          >
                            {proj.project_name}
                          </option>
                        ))}
                      </select> */}
                  </div>

                  <div className={styles.selectWrapper}>
                    <label className={styles.label} data-required>Budget Range </label>
                    <GlobalSelect   value={form.budget}
                    onChange={(val) => setForm({ ...form, budget: val })}
                    placeholder="Select Budget Range"
                    options={budgetOptions}/>
                    {/* <select
                      className={styles.select}
                      required
                      value={form.budget}
                      onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    >
                      <option value="">Select Budget Range</option>
                      <option value="30-50">₹30L - ₹50L</option>
                      <option value="50-75">₹50L - ₹75L</option>
                      <option value="75-100">₹75L - ₹1Cr</option>
                      <option value="100+">₹1Cr+</option>
                    </select> */}
                  </div>
                </div>

              </div>

             

              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/app/leads')}
                >
                  Cancel
                </Button>

                <Button type="submit" variant="primary" size="md" loading={loading}>
                  Create Lead
                </Button>
              </div>

            </form>
          </Card>

        </div>
        {snackbar.open && (
  <div className={styles.snackbarWrapper}>
    <div className={`${styles.snackbar} ${styles[snackbar.type]}`}>
      
      <span className={styles.snackIcon}>
        {snackbar.type === "success" ? (
          <CheckCircle2 size={18} strokeWidth={2.5} />
        ) : (
          <XCircle size={18} strokeWidth={2.5} />
        )}
      </span>

      <span className={styles.snackText}>{snackbar.message}</span>

    </div>
  </div>
)}
      </main>
       <Footer />
    </div>
  );
}
