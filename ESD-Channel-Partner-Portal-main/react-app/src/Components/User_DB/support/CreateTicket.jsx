import React, { useState } from "react";
import styles from "../../leads/add/page.module.css";
import Header from "../../ui/Header";
import Card from "../../ui/Card";
import Input from "../../ui/Input";
import Button from "../../ui/Button";
import { useNavigate, Link } from "react-router-dom";
import { Upload, X } from "lucide-react";
import { useRef } from "react";


export default function CreateTicketPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    project: "",
    category: "",
    subject: "",
    priority: "",
    description: "",
  });
  
const [attachments, setAttachments] = useState([]);
const fileInputRef = useRef(null);

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    console.log("Ticket Payload:", form);

    // API call later
    setTimeout(() => {
      setLoading(false);
      navigate("/app/support");
    }, 1000);
  };

  const handleFiles = (files) => {
  const validFiles = [];

  for (let file of files) {
    if (file.size > MAX_SIZE) {
      alert(`${file.name} exceeds 10MB`);
      continue;
    }
    validFiles.push(file);
  }

  setAttachments((prev) =>
    [...prev, ...validFiles].slice(0, MAX_FILES)
  );
};

const handleFileChange = (e) => {
  handleFiles(Array.from(e.target.files));
};

const handleDrop = (e) => {
  e.preventDefault();
  handleFiles(Array.from(e.dataTransfer.files));
};

const removeFile = (index) => {
  setAttachments((prev) => prev.filter((_, i) => i !== index));
};


  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          {/* Page Header */}
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Raise New Ticket</h1>
              <p className={styles.subtitle}>
                Enter details to create a new support ticket
              </p>
            </div>

            <Link to="/app/support">
              <Button variant="ghost">← Back</Button>
            </Link>
          </div>

          {/* Form Card */}
          <Card className={styles.formCard}>
            <form onSubmit={handleSubmit} className={styles.form}>
              
              {/* Ticket Information */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Ticket Information</h3>

                <div className={styles.formRow}>
                  <div className={styles.selectWrapper}>
                    <label className={styles.label}>Property / Project *</label>
                    <select
                      className={styles.select}
                      required
                      value={form.project}
                      onChange={(e) =>
                        setForm({ ...form, project: e.target.value })
                      }
                    >
                      <option value="">Select project</option>
                      <option value="skyi-songbirds">SKYi Songbirds</option>
                      <option value="skyi-star-town">SKYi Star Town</option>
                      <option value="skyi-republic">SKYi Republic</option>
                    </select>
                  </div>

                  <div className={styles.selectWrapper}>
                    <label className={styles.label}>Category *</label>
                    <select
                      className={styles.select}
                      required
                      value={form.category}
                      onChange={(e) =>
                        setForm({ ...form, category: e.target.value })
                      }
                    >
                      <option value="">Select category</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Security">Security</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <Input
                    type="text"
                    label="Subject *"
                    required
                    placeholder="e.g. AC not working"
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />

                  <div className={styles.selectWrapper}>
                    <label className={styles.label}>Priority *</label>
                    <select
                      className={styles.select}
                      required
                      value={form.priority}
                      onChange={(e) =>
                        setForm({ ...form, priority: e.target.value })
                      }
                    >
                      <option value="">Select priority</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Description</h3>

                <div className={styles.textareaWrapper}>
                  <label className={styles.label}>
                    Detailed Description *
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={5}
                    placeholder="Describe the issue in detail..."
                    required
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Attachments */}
<div className={styles.section}>
  <h3 className={styles.sectionTitle}>Attachments</h3>

  <input
    type="file"
    ref={fileInputRef}
    multiple
    className="hidden"
    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
    onChange={handleFileChange}
  />

  <div
    onClick={() => fileInputRef.current.click()}
    onDrop={handleDrop}
    onDragOver={(e) => e.preventDefault()}
    className="flex flex-col items-center justify-center p-10 border-2  border-gray-200 rounded-2xl bg-gray-50 hover:bg-[#FFF4F0] hover:border-[#FF6B35] transition-all cursor-pointer group"
  >
    <div className="p-3 mb-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
      <Upload size={24} className="text-gray-400 group-hover:text-[#FF6B35]" />
    </div>
    <p className="text-sm font-bold text-gray-700">
      Click to upload or drag & drop
    </p>
    <p className="text-xs text-gray-500 mt-1">
      Up to 5 files · Max 10MB
    </p>
  </div>

  {attachments.length > 0 && (
    <div className="mt-4 space-y-2">
      {attachments.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between px-4 py-2 bg-white border rounded-xl text-sm"
        >
          <span className="truncate max-w-[80%]">{file.name}</span>
          <button
            type="button"
            onClick={() => removeFile(index)}
            className="text-gray-400 hover:text-red-500"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )}
</div>


              {/* Actions */}
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/app/support")}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                >
                  Create Ticket
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
