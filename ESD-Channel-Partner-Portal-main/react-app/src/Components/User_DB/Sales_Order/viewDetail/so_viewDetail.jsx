import React from "react";
import { useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../../ui/Header";
import "../../../leads/LeadJourney/LeadJourneyModal.css"; // REUSE SAME CSS
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { fetchSalesOrders } from "../../../../store/salesOrderSlice";
import { fetchLeads } from "../../../../store/leadsSlice";



export default function SalesOrderJourneyPage() {
  const { salesOrderId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

    const { data: salesOrders } = useSelector((s) => s.salesOrders);
const { data: leads } = useSelector((s) => s.leads);

useEffect(() => {
  if (!salesOrders.length) {
    dispatch(fetchSalesOrders());
  }

  if (!leads.length) {
    dispatch(fetchLeads());
  }
}, [salesOrders.length, leads.length, dispatch]);

console.log("🔎 SalesOrder lead_id:", salesOrders.lead_id);
console.log("📦 Leads array length:", leads.length);
console.log("🧪 First lead sample:", leads[0]);

  

  if (!salesOrders.length) {
    return <div className="lj-loading">Loading Sales Orders...</div>;
  }

  const salesOrder = salesOrders.find(
    (s) => String(s.ROWID) === String(salesOrderId)
  );

  if (!salesOrder) {
    return <div className="lj-loading">Sales Order Not Found</div>;
  }

  const lead = leads.find(
  (l) => String(l.ROWID) === String(salesOrder.lead_id)
  
);
if (!lead) {
  return <div className="lj-loading">Loading Lead Details...</div>;
}


  const fmt = (t) =>
    t
      ? new Date(t).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const initials =
    salesOrder.customer_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2) || "--";

  /* ---- SALES ORDER PIPELINE ---- */
//   const steps = [
//     {
//       label: "Order Created",
//       date: fmt(salesOrder.CREATEDTIME),
//       status: "done",
//     },
//     {
//       label: "Agreement Signed",
//       date: fmt(salesOrder.agreement_date),
//       status: salesOrder.agreement_date ? "done" : "current",
//     },
//     {
//       label: "Payment Received",
//       date: fmt(salesOrder.payment_date),
//       status: salesOrder.payment_date
//         ? "done"
//         : salesOrder.agreement_date
//         ? "current"
//         : "pending",
//     },
//     {
//       label: "Registration Completed",
//       date: fmt(salesOrder.registration_date),
//       status: salesOrder.registration_date
//         ? "done"
//         : salesOrder.payment_date
//         ? "current"
//         : "pending",
//     },
//   ];

  return (
    <>
      <Header />

      <div className="lj-page">
        {/* TOP NAV */}
        <div className="lj-top-nav">
          <button onClick={() => navigate(-1)} className="lj-back-link">
            ← Back to Sales Orders
          </button>
          <span className="lj-lead-id">
            SO #{salesOrder.ROWID}
          </span>
        </div>

        <div className="lj-layout-grid">
          {/* LEFT SIDEBAR */}
          <aside className="lj-sidebar">
            <div className="lj-card profile-card">
              <div className="lj-avatar-large">{initials}</div>

              <h1 className="lj-profile-name">
                {salesOrder.customer_name}
              </h1>

              <div className="lj-status-badge">
                {salesOrder.order_status || "Active Order"}
              </div>

              <div className="lj-action-row">
                <button
                  className="icon-btn call"
                  onClick={() =>
                    (window.location.href = `tel:${lead.customer_mobile}`)
                  }
                >
                  📞
                </button>
                <button
                  className="icon-btn email"
                  onClick={() =>
                    (window.location.href = `mailto:${lead.customer_email}`)
                  }
                >
                  ✉️
                </button>
                <button className="icon-btn whatsapp">💬</button>
              </div>

              <div className="lj-divider"></div>

              <div className="lj-mini-details">
                <div className="mini-row">
                  <span>Mobile</span>
                  <strong>{lead.customer_mobile}</strong>
                </div>
                <div className="mini-row">
                  <span>Email</span>
                  <strong className="truncate">
                    {lead.customer_email || "—"}
                  </strong>
                </div>
                <div className="mini-row">
                  <span>Project</span>
                  <strong>{salesOrder.project_name}</strong>
                </div>
              </div>
            </div>
          </aside>

          {/* RIGHT CONTENT */}
          <main className="lj-main-content">
            {/* PIPELINE */}
            {/* <div className="lj-card">
              <div className="lj-card-header">
                <h3>Sales Order Journey</h3>
                <span className="header-subtitle">
                  Order Fulfillment Progress
                </span>
              </div>

              <div className="lj-pipeline-container">
                {steps.map((step, i) => (
                  <div key={i} className={`pipeline-step ${step.status}`}>
                    {i < steps.length - 1 && (
                      <div className="step-line"></div>
                    )}

                    <div className="step-circle">
                      {step.status === "done" ? "✓" : i + 1}
                    </div>

                    <div className="step-info">
                      <span className="step-label">{step.label}</span>
                      <span className="step-date">{step.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div> */}

            {/* DETAILS */}
            <div className="lj-card">
              <div className="lj-card-header">
                <h3>Sales Order Details</h3>
                <span className="header-subtitle">
                  Complete Order Record
                </span>
              </div>

              <div className="lj-data-sections">
                <div className="data-group">
                  <h4 className="group-title">Order Information</h4>
                  <div className="data-grid">
                    <InfoBox
                      label="Building Name"
                      value={`${salesOrder.building_name || "—"}`}
                    />
                    <InfoBox
                      label="Unit Number"
                      value={salesOrder.unit_number}
                    />
                    <InfoBox
                      label="Payment Mode"
                      value={salesOrder.payment_mode}
                    />
                    <InfoBox
                      label="Registration Date"
                      value={fmt(salesOrder.registration_date)}
                    />
                  </div>
                </div>

                <div className="lj-divider"></div>

                <div className="data-group">
                  <h4 className="group-title">Linked Records</h4>
                  <div className="data-grid">
                    <InfoBox
                      label="Deal ID"
                      value={salesOrder?.deal_id || "—"}
                    />
                    <InfoBox
                      label="Lead ID"
                      value={lead?.ROWID || "—"}
                    />
                    <InfoBox
                      label="Created Date"
                      value={fmt(salesOrder.CREATEDTIME)}
                    />
                    <InfoBox
                      label="Last Updated"
                      value={fmt(salesOrder.MODIFIEDTIME)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

/* REUSABLE INFO BOX */
const InfoBox = ({ label, value }) => (
  <div className="info-box">
    <span className="info-label">{label}</span>
    <span className="info-value">{value || "—"}</span>
  </div>
);
