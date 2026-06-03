'use client';

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import Header from "../../ui/Header";
import Input from "../../ui/Input";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import styles from "./EditBrochure.module.css";
import { updateBrochureLocal } from "../../../store/brochureslice";
import { fetchProjects } from '../../../store/projectSlice';
import Footer from "../../ui/Footer";

export default function EditBrochure() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const projects = useSelector((state) => state.projects.data);

  const { list: brochures = [], loading } = useSelector(
    (state) => state.brochures || {}
  );

  const [form, setForm] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]); 
  const [newFiles, setNewFiles] = useState([]);

  useEffect(() => {
    if (!loading && brochures.length > 0) {
      const brochure = brochures.find((b) => String(b.ROWID) === String(id));
      
      if (brochure) {
        setForm({
          project_name: brochure.project_name || "",
          project_type: brochure.project_type || "",
          project_status: brochure.project_status || "",
          bhk_configuration: brochure.bhk_configuration || "",
          locality: brochure.locality || "",
          city: brochure.city || "",
          price: brochure.price || "",
          area_min_sqft: brochure.area_min_sqft || "",
          area_max_sqft: brochure.area_max_sqft || "",
          amenities: brochure.amenities || "",
          is_active: brochure.is_active ?? true
        });

        let parsedFiles = [];
        if (brochure.brochure_file) {
          try {
            parsedFiles = typeof brochure.brochure_file === 'string' && brochure.brochure_file.startsWith('[')
              ? JSON.parse(brochure.brochure_file) 
              : [brochure.brochure_file];
          } catch(e) {
            parsedFiles = [brochure.brochure_file];
          }
        }
        setExistingFiles(parsedFiles);
      }
    }
  }, [brochures, loading, id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  useEffect(() => {
    if (projects.length === 0) dispatch(fetchProjects());
  }, [dispatch, projects.length]);
  
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    if (existingFiles.length + newFiles.length + selected.length > 5) {
      alert("You can only have a maximum of 5 files total.");
      e.target.value = null;
      return;
    }
    setNewFiles((prev) => [...prev, ...selected]);
    e.target.value = null; 
  };

  const removeExistingFile = (indexToRemove) => {
    setExistingFiles(existingFiles.filter((_, i) => i !== indexToRemove));
  };

  const removeNewFile = (indexToRemove) => {
    setNewFiles(newFiles.filter((_, i) => i !== indexToRemove));
  };
    
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));

      formData.append("existing_files", JSON.stringify(existingFiles));
      newFiles.forEach((file) => formData.append("brochure_files", file));

      const res = await fetch(`/server/desk_function/update-brochure/${id}`, {
        method: "POST",
        body: formData
      });
      const result = await res.json();

      if (!res.ok || !result.success) throw new Error(result.error || "Update failed");

      dispatch(updateBrochureLocal({
        ROWID: id,
        ...form,
        brochure_file: JSON.stringify(result.data?.brochure_file || existingFiles)
      }));

      alert("✅ Brochure updated successfully");
      navigate("/app/admin/brochures");
    } catch (err) {
      console.error("Update error:", err);
      alert("❌ Failed to update brochure");
    }
  };

  if (loading || !form) {
    return (
      <div className={styles.page}>
        <Header />
        <div className={styles.container}>Loading brochure...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Edit Brochure</h1>
              <p className={styles.subtitle}>Update brochure details or manage documents</p>
            </div>
            <Button variant="ghost" onClick={() => navigate(-1)}>← Back</Button>
          </div>

          <Card className={styles.formCard}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Project Information</h3>
                <div className={styles.formRow}>
                  <Input label="Project Name" name="project_name" value={form.project_name} disabled />
                  <Input label="Project Type" name="project_type" value={form.project_type} disabled />
                  <Input label="Project Status" name="project_status" value={form.project_status} onChange={handleChange} />
                  <Input label="BHK Configuration" name="bhk_configuration" value={form.bhk_configuration} onChange={handleChange} />
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Location</h3>
                <div className={styles.formRow}>
                  <Input label="Locality" name="locality" value={form.locality} onChange={handleChange} />
                  <Input label="City" name="city" value={form.city} onChange={handleChange} />
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Other Details</h3>
                <div className={styles.formRow}>
                  <Input label="Price" name="price" value={form.price} onChange={handleChange} />
                  <Input label="Min Area (sq.ft)" name="area_min_sqft" value={form.area_min_sqft} onChange={handleChange} />
                  <Input label="Max Area (sq.ft)" name="area_max_sqft" value={form.area_max_sqft} onChange={handleChange} />
                </div>
                <div className={styles.textareaWrapper}>
                  <label className={styles.label}>Amenities</label>
                  <textarea className={styles.textarea} name="amenities" value={form.amenities} onChange={handleChange} />
                </div>
              </section>

             <section className={styles.section}>
  <h3 className={styles.sectionTitle}>
    Manage Brochures (Max 5)
    <span style={{ fontSize: '14px', fontWeight: 'normal', float: 'right' }}>
      Total: {existingFiles.length + newFiles.length}/5
    </span>
  </h3>

  <div className={styles.fileUploadContainer}>

    {/* Existing Files KPI */}
    {existingFiles.length > 0 && (
      <div className={styles.fileListKpi} style={{ marginBottom: '10px' }}>
        <span className={styles.kpiTitle}>Currently Saved Files</span>
        
        {existingFiles.map((fileName, index) => (
          <div key={`existing-${index}`} className={styles.fileKpiItem} style={{ backgroundColor: '#f3f4f6', borderColor: '#d1d5db' }}>
            <span className={styles.fileName} style={{ color: '#4b5563' }}>
              📄 {fileName.split('/').pop()}
            </span>
            <button 
              type="button" 
              className={styles.removeBtn} 
              onClick={() => removeExistingFile(index)}
              title="Remove saved file"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    )}

    {/* New Files KPI */}
    {newFiles.length > 0 && (
      <div className={styles.fileListKpi}>
        <span className={styles.kpiTitle}>New Files to Upload</span>
        
        {newFiles.map((f, index) => (
          <div key={`new-${index}`} className={styles.fileKpiItem}>
            <span className={styles.fileName}>📄 {f.name}</span>
            <button 
              type="button" 
              className={styles.removeBtn} 
              onClick={() => removeNewFile(index)}
              title="Remove file"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    )}

    {/* Upload Button (Only shows if under limit) */}
    {(existingFiles.length + newFiles.length) < 5 && (
      <div style={{ marginTop: '10px' }}>
        <input
          id="edit-brochure-upload-input"
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          className={styles.hiddenInput}
        />
        <label htmlFor="edit-brochure-upload-input" className={styles.customFileBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Add More Files
        </label>
      </div>
    )}

  </div>
</section>

              <div className={styles.actions}>
                <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
                <Button type="submit" variant="primary">Save Changes</Button>
              </div>

            </form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}