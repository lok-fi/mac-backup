import React, { useState, useEffect } from 'react';
import styles from "./AddBrochureForm.module.css";
import Header from "../../ui/Header";
import Card from "../../ui/Card";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { useNavigate } from "react-router-dom";
import Footer from "../../ui/Footer";
import { fetchProjects } from '../../../store/projectSlice';
import GlobalSelect from "../../ui/GlobalSelect";
import { useSelector, useDispatch } from 'react-redux';

export default function AddBrochurePage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]); 
  const projects = useSelector((state) => state.projects.data);
  const [form, setForm] = useState({
    project_name: "",
    project_type: "",
    project_status: "",
    project_tagline: "",
    locality: "",
    city: "",
    bhk_configuration: "",
    price: "",
    area_min_sqft: "",
    area_max_sqft: "",
    amenities: "",
    is_active: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 5) {
      alert("You can only upload a maximum of 5 files.");
      e.target.value = null; 
      return;
    }
    setFiles(selectedFiles);
  };

  useEffect(() => {
    if (projects.length === 0) {
      dispatch(fetchProjects());
    }
  }, [dispatch, projects.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      alert("Please upload at least one brochure PDF");
      return;
    }
    setLoading(true);

    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) =>
      formData.append(key, value)
    );
    
    files.forEach((file) => {
      formData.append("brochure_files", file); 
    });

    try {
      const res = await fetch("/server/desk_function/upload-brochure", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        navigate("/app/admin/brochures");
      } else {
        alert("Failed to upload brochure");
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
    setLoading(false);
  };

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div><h1 className={styles.title}>Add Brochure</h1></div>
            <Button variant="ghost" onClick={() => navigate("/app/admin/brochures")}>← Back To Brochure Page</Button>
          </div>
          <Card className={styles.formCard}>
            <form className={styles.form} onSubmit={handleSubmit}>
              
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Project Information</h3>
                <div className={styles.formRow}>
                  <div className={styles.selectWrapper}>
                  <label className={styles.label} data-required>Project</label>

                  <GlobalSelect
                    required
                    value={form.project_name}
                    onChange={(val) => setForm({ ...form, project_name: val })}
                    placeholder="Select Project"
                    options={projects.map((proj) => ({
                      value: proj.project_name,
                      label: proj.project_name,
                    }))}
                  />
                </div>
                <div className={styles.selectWrapper}>
                <label className={styles.label}>Project Type</label>

                <GlobalSelect
                  value={form.project_type}
                  onChange={(val) => setForm({ ...form, project_type: val })}
                  placeholder="Select Project Type"
                  options={[
                    { value: "Residential", label: "Residential" },
                    { value: "Commercial", label: "Commercial" },
                    { value: "Plots", label: "Plots" }
                  ]}
                />
              </div>
                </div>
                <div className={styles.formRow}>
                  <Input label="Project Status" name="project_status" value={form.project_status} onChange={handleChange} />
                  <Input label="BHK Configuration" name="bhk_configuration" value={form.bhk_configuration} onChange={handleChange} />
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Location Details</h3>
                <div className={styles.formRow}>
                  <Input label="Locality" name="locality" value={form.locality} onChange={handleChange} />
                  <Input label="City" name="city" value={form.city} onChange={handleChange} />
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Pricing & Area</h3>
                <div className={styles.formRow}>
                  <Input label="Price (₹)" name="price" type="number" value={form.price} onChange={handleChange} />
                  <Input label="Min Area (sq.ft)" name="area_min_sqft" type="number" value={form.area_min_sqft} onChange={handleChange} />
                </div>
                <div className={styles.formRow}>
                  <Input label="Max Area (sq.ft)" name="area_max_sqft" type="number" value={form.area_max_sqft} onChange={handleChange} />
                </div>
              </div>

              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Description</h3>
                <div className={styles.textareaWrapper}>
                  <label className={styles.label}>Project Tagline</label>
                  <textarea className={styles.textarea} name="project_tagline" value={form.project_tagline} onChange={handleChange} />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.label}>Amenities</label>
                  <textarea className={styles.textarea} name="amenities" value={form.amenities} onChange={handleChange} />
                </div>
              </div>

   <div className={styles.section}>
  <h3 className={styles.sectionTitle}>Brochure Files (Max 5)</h3>
  
  <div className={styles.fileUploadContainer}>
    
    {/* Hidden Input */}
    <input
      id="add-brochure-upload-input"
      type="file"
      accept="application/pdf"
      multiple
      onChange={handleFileChange}
      className={styles.hiddenInput}
    />

    {/* Styled Upload Button */}
    <label htmlFor="add-brochure-upload-input" className={styles.customFileBtn}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      Choose Brochure Files
    </label>

    {/* File List KPIs */}
    {files.length > 0 && (
      <div className={styles.fileListKpi}>
        <span className={styles.kpiTitle}>Selected Files ({files.length}/5)</span>
        
        {files.map((f, index) => (
          <div key={`file-${index}`} className={styles.fileKpiItem}>
            <span className={styles.fileName}>📄 {f.name}</span>
            <button 
              type="button" 
              className={styles.removeBtn} 
              onClick={() => {
                const newFiles = [...files];
                newFiles.splice(index, 1);
                setFiles(newFiles);
              }}
              title="Remove file"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    )}

  </div>
</div>

              <div className={styles.actions}>
                <Button type="button" variant="ghost" onClick={() => navigate("/app/admin/brochures")}>Cancel</Button>
                <Button type="submit" variant="primary" loading={loading}>Upload</Button>
              </div>

            </form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}