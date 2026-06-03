// import React, { useEffect } from "react";
// import { useSelector, useDispatch } from "react-redux";
// import { useParams, useNavigate } from "react-router-dom";
// import Header from "../../ui/Header";
// import "./LeadJourneyModal.css";

// /* 🔥 FETCH ACTIONS (REQUIRED ON REFRESH) */
// import { fetchLeads } from "../../../store/leadsSlice";
// import { fetchDeals } from "../../../store/dealsSlice";
// import { fetchSalesOrders } from "../../../store/salesOrderSlice";

// export default function LeadJourneyPage() {
//   const { leadId } = useParams();
//   const navigate = useNavigate();
//   const dispatch = useDispatch();

//   /* ===============================
//       REDUX STATE
//       =============================== */
//   const { data: leads } = useSelector((s) => s.leads);
//   const { data: deals } = useSelector((s) => s.deals);
//   const { data: salesOrders } = useSelector((s) => s.salesOrders);

//   /* ===============================
//       🔥 FETCH DATA ON PAGE LOAD
//       =============================== */
//   useEffect(() => {
//     if (!leads.length) dispatch(fetchLeads());
//     if (!deals.length) dispatch(fetchDeals());
//     if (!salesOrders.length) dispatch(fetchSalesOrders());
//   }, [dispatch, leads.length, deals.length, salesOrders.length]);

//   const lead = leads.find((l) => String(l.ROWID) === String(leadId));

//   if (!leads.length || !deals.length || !salesOrders.length) {
//     return <div className="lj-loading">Loading CRM Data...</div>;
//   }

//   if (!lead) {
//     return <div className="lj-loading">Lead Not Found</div>;
//   }

//   const deal = deals.find((d) => String(d.lead_id) === String(lead.ROWID)) || null;
//   const salesOrder = deal ? salesOrders.find((s) => String(s.deal_id) === String(deal.deal_id)) || null : null;

//   /* ===============================
//       HELPERS
//       =============================== */
//   const fmt = (t) =>
//     t ? new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

//   const initials = lead.customer_name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "--";

//   /* ===============================
//       6-STAGE JOURNEY LOGIC
//       =============================== */
  
//   // 1. Rejection Check (Global)
//   const isLeadRejected = lead.lead_status === "Rejected";
//   const isSORejected = salesOrder?.status === "Rejected";
//   const isRejected = isLeadRejected || isSORejected;

//   // 2. State Conditionals
//   const isCreated = lead.lead_status === "Created" || !!lead.CREATEDTIME;
  
//   const inProcessStatuses = ["In process", "Site Visit Confirmed", "Converted"];
//   const isInProcess = inProcessStatuses.includes(lead.lead_status) || !!deal;

//   const isSiteVisitDone = !!deal;

//   const isSOCreated = !!salesOrder;

//   const sapStatuses = [
//     "Updated in SAP", 
//     "Registration planned", 
//     "Collection Stage", 
//     "Ready for Handover", 
//     "Handover Planned", 
//     "Possession completed"
//   ];
//   const isUpdatedInSAP = sapStatuses.includes(salesOrder?.status);

//   const isPossessionDone = salesOrder?.status === "Possession completed";

//   // 3. Define Raw Stages
//   const stages = [
//     { label: "Lead Created", date: fmt(lead.CREATEDTIME), active: isCreated },
//     { label: "In Process", date: fmt(lead.MODIFIEDTIME), active: isInProcess },
//     { label: "Site Visit Done", date: fmt(deal?.deal_created_date), active: isSiteVisitDone },
//     { label: "Sales Order Created", date: fmt(salesOrder?.CREATEDTIME), active: isSOCreated },
//     { label: "Updated in SAP", date: fmt(salesOrder?.MODIFIEDTIME), active: isUpdatedInSAP },
//     { label: "Possession Completed", date: fmt(salesOrder?.possession_date), active: isPossessionDone },
//   ];

//   // 4. Transform stages into UI steps (Handling Rejection)
//   let steps = [];
//   if (isRejected) {
//     // Find the last stage that was actually reached before rejection
//     const lastActiveIndex = [...stages].reverse().findIndex(s => s.active);
//     const actualIdx = lastActiveIndex === -1 ? 0 : stages.length - 1 - lastActiveIndex;
    
//     steps = stages.slice(0, actualIdx + 1).map(s => ({ ...s, status: "done" }));
//     steps.push({ label: "Rejected", date: fmt(new Date()), status: "rejected" });
//   } else {
//     // Standard Flow: Once green, stay green
//     steps = stages.map((s, i) => {
//       let status = "pending";
//       if (s.active) status = "done";
//       else if (i > 0 && stages[i - 1].active) status = "current";
//       return { ...s, status };
//     });
//   }

//   return (
//     <>
//       <Header />
//       <div className="lj-page">
//         <div className="lj-single-column">
          
//           {/* TOP NAV */}
//           <div className="lj-top-nav">
//             <button onClick={() => navigate(-1)} className="lj-back-link">
//               ← Back to Leads
//             </button>
//             {/* <span className="lj-lead-id">ID: #{lead.ROWID}</span> */}
//           </div>

//           {/* 1. CUSTOMER JOURNEY CARD */}
//           <div className="lj-card">
//             <div className="lj-card-header">
//               <h3>Lead Journey</h3>
//             </div>
//             <div className="lj-pipeline-container">
//               {steps.map((step, i) => (
//                 <div key={i} className={`pipeline-step ${step.status}`}>
//                   <div className="step-circle">
//                     {step.status === "done" ? "✓" : step.status === "rejected" ? "✕" : i + 1}
//                   </div>
                  
//                   {/* Updated Step Info to ensure two lines */}
//                   <div className="step-info">
//                     <strong className="step-label">{step.label}</strong>
//                     <span className="step-date">{step.date}</span>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* 2. UNIFIED PROFILE & CUSTOMER DETAILS CARD */}
//           <div className="lj-card">
//               <div className="lj-profile-hero">
//                 <div className="lj-avatar-large">{initials}</div>
                
//                 <div className="lj-profile-content">
//                   {/* LEFT SIDE: NAME & BADGE */}
//                   <div className="lj-name-side">
//                     <div className="lj-name-badge-row">
//                       <h1 className="lj-profile-name">{lead.customer_name}</h1>
//                       {/* <div className={`lj-status-badge ${lead.lead_status === "Hot" ? "hot" : ""} ${isRejected ? "rejected-badge" : ""}`}>
//                         {isRejected ? "REJECTED" : (lead.lead_status || "New Lead")}
//                       </div> */}
//                     </div>
//                   </div>

//                   {/* RIGHT SIDE: CONTACT GRID */}
//                   <div className="lj-contact-grid">
//                     <div className="contact-item">
//                       <span className="contact-label">Mobile</span>
//                       <span className="contact-value">{lead.customer_mobile}</span>
//                     </div>
//                     <div className="contact-item">
//                       <span className="contact-label">Email</span>
//                       <span className="contact-value">{lead.customer_email || "—"}</span>
//                     </div>
//                     <div className="contact-item">
//                       <span className="contact-label">City</span>
//                       <span className="contact-value">{lead.city || "—"}</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             <div className="lj-section-divider"></div>

//             {/* CUSTOMER DETAILS SECTION */}
//             <div className="lj-details-container">
//               <div className="data-group">
//                 <h4 className="group-title">Property Details</h4>
//                 <div className="data-grid-layout">
//                   <InfoBox label="Project" value={lead.project_name} />
//                   {/* <InfoBox label="Lead Status" value={lead.lead_status || "Not Specified"} /> */}
//                   <InfoBox label="Budget" value={lead.budget} />
//                   <InfoBox label="Unit Number" value={lead.unit_number || "—"} />
//                 </div>
//               </div>

//               <div className="data-group">
//                 <h4 className="group-title">Lead Information</h4>
//                 <div className="data-grid-layout">
//                   <InfoBox label="Lead Source" value={lead.lead_source} isTag />
//                   <InfoBox label="Created Date" value={fmt(lead.CREATEDTIME)} />
//                   <InfoBox label="Last Activity" value={fmt(lead.MODIFIEDTIME)} />
//                 </div>
//               </div>
//             </div>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const InfoBox = ({ label, value, isTag }) => (
//   <div className="info-box">
//     <span className="info-label">{label}</span>
//     {isTag ? (
//       <span className="info-tag">{value || "Direct"}</span>
//     ) : (
//       <span className="info-value">{value || "—"}</span>
//     )}
//   </div>
// );

import { useState } from "react";

import React, { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../../ui/Header";
import "./LeadJourneyModal.css";
import Footer from "../../ui/Footer";
/* FETCH ACTIONS (REQUIRED ON REFRESH) */
import { fetchLeads } from "../../../store/leadsSlice";
import { fetchDeals } from "../../../store/dealsSlice";
import { fetchSalesOrders } from "../../../store/salesOrderSlice";


export default function LeadJourneyPage() {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchJourney = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `/server/esd_channel_partner_function/leadJourney?leadId=${leadId}`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Failed to fetch");

      const json = await res.json();
      setData(json.data);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (leadId) fetchJourney();
}, [leadId]);
const lead = data?.lead;
const deal = data?.deal;
const salesOrder = data?.salesOrder;
if (loading)
  return (
    <div className="lj-loading">
      <span className="loader"></span>
    </div>
  );
if (error) return <div>Error: {error}</div>;
if (!lead) return <div>Lead Not Found</div>;


const rejectionReason =
  salesOrder?.rejection_reason ||
  deal?.rejection_reason ||
  lead?.rejection_reason ||
  "No reason provided";

  /* ===============================
      REDUX STATE
      =============================== */
  // const { data: leads } = useSelector((s) => s.leads);
  // const { data: deals } = useSelector((s) => s.deals);
  // const { data: salesOrders } = useSelector((s) => s.salesOrders);

  /* ===============================
       FETCH DATA ON PAGE LOAD
     =============================== */
  // useEffect(() => {
  //   if (!leads.length) dispatch(fetchLeads());
  //   if (!deals.length) dispatch(fetchDeals());
  //   if (!salesOrders.length) dispatch(fetchSalesOrders());
  // }, [dispatch, leads.length, deals.length, salesOrders.length]);

  // const lead = leads.find((l) => String(l.ROWID) === String(leadId));

  
  // if (!leads.length) return <div className="lj-loading">Loading Leads...</div>;

  // if (!lead) {
  //   return <div className="lj-loading">Lead Not Found</div>;
  // }

  // const deal = deals.find((d) => String(d.lead_id) === String(lead.ROWID)) || null;
  // console.log("deal",deal);
  // // const salesOrder = deal ? salesOrders.find((s) => String(s.deal_id) === String(deal.deal_id)) || null : null;
  // console.log(salesOrders);
  // const salesOrder = deal
  // ? salesOrders.find((s) => String(s.deal_id) === String(deal.ROWID)) || null
  // : null;
  // console.log("sales order ",salesOrder);

  /* ===============================
      HELPERS
    =============================== */
 const fmt = (t) => {
    if (!t) return "—"; // null / undefined / empty

    const date = new Date(t);

    if (isNaN(date.getTime())) return "—"; // 🔥 handles invalid date

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const fmtWithTime = (t) => {
  if (!t) return "—";

  const date = new Date(t);

  if (isNaN(date.getTime())) return "—"; // 🔥 prevents Invalid Date

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
};

    //   const res1 = "-";
    //  let expecdate = fmtWithTime(lead.expected_site_visit_date);
    //   if (expecdate === "Invalid Date") {
    //     expecdate = res1;
    //   }

  const initials = lead.customer_name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "--";

  /* ===============================
      6-STAGE JOURNEY LOGIC
      =============================== */
  
 /* ===============================
   REJECTION CHECK
   =============================== */

const leadRejectedStatuses = [
  "Unqualified",
  "Closed Lost"
];

const dealRejectedStatuses = [
  "Unqualified",
  "Closed Lost"
];

const salesOrderRejectedStatuses = [
  "Cancelled",
  "Rejected",
  "Approved-Cancelled"
];

const isLeadRejected = leadRejectedStatuses.includes(lead?.lead_status);

const isDealRejected = dealRejectedStatuses.includes(deal?.deal_stage);

const isSORejected = salesOrderRejectedStatuses.includes(
  salesOrder?.booking_status
);

const isRejected = isLeadRejected || isDealRejected || isSORejected;

  // 2. State Conditionals
  const isCreated = lead.lead_status === "Created" || !!lead.CREATEDTIME;
  
  const inProcessStatuses = ["In process", "Site Visit Confirmed", "Converted"];

  const isInProcess = inProcessStatuses.includes(lead.lead_status) || !!deal;

  const isSiteVisitDone = !!deal;

  // Lead basic fields
// const leadStatus = lead?.lead_status || "--";

// Check Site Visit from Lead Status
// const isSiteVisitConfirmed =lead.lead_status ==="Site Visit Confirmed";
console.log("this is lead sattus",lead.lead_status);
// Check Sales Order

const SOCreated = !!salesOrder;

  const isSOCreated = SOCreated;
  

  const sapStatuses = [
    "Updated in SAP", 
    "Registration planned", 
    "Collection Stage", 
    "Ready for Handover", 
    "Handover Planned", 
    "Possesion completed"
  ];
  const isUpdatedInSAP = sapStatuses.includes(salesOrder?.booking_status);
 

  const isPossessionDone = salesOrder?.booking_status === "Possesion completed";

  // 3. Define Raw Stages
  const stages = [
    { label: "Lead Created", date: fmt(lead.CREATEDTIME), active: isCreated },
    { label: "In Process", date: fmt(lead.MODIFIEDTIME), active: isInProcess },
    { label: "Site Visit Done", date: fmt(deal?.CREATEDTIME), active: isSiteVisitDone },
    { label: "Sales Order Created", date: fmt(salesOrder?.CREATEDTIME), active: isSOCreated },
    { label: "Updated in SAP", date: fmt(salesOrder?.MODIFIEDTIME), active: isUpdatedInSAP },
    { label: "Possession Completed", date: fmt(salesOrder?.possession_date), active: isPossessionDone },
  ];

  // 4. Transform stages into UI steps (Handling Rejection)
  let steps = [];
  if (isRejected) {
    // Find the last stage that was actually reached before rejection
    const lastActiveIndex = [...stages].reverse().findIndex(s => s.active);
    const actualIdx = lastActiveIndex === -1 ? 0 : stages.length - 1 - lastActiveIndex;
    
    steps = stages.slice(0, actualIdx + 1).map(s => ({ ...s, status: "done" }));
    steps.push({
  label: "Rejected",
  date: fmt(
    salesOrder?.MODIFIEDTIME ||
    deal?.MODIFIEDTIME ||
    lead?.MODIFIEDTIME
  ),
  status: "rejected",
  reason: rejectionReason
});
  } else {
    // Standard Flow: Once green, stay green
    steps = stages.map((s, i) => {
      let status = "pending";
      if (s.active) status = "done";
      else if (i > 0 && stages[i - 1].active) status = "current";
      return { ...s, status };
    });
  }

  return (
    <>
      <Header />
      <div className="lj-page">
        <div className="lj-single-column">
          
          {/* TOP NAV */}
          <div className="lj-top-nav">
            <button onClick={() => navigate(-1)} className="lj-back-link">
              ← Back
            </button>
           
          </div>

          {/* 1. CUSTOMER JOURNEY CARD */}
          <div className="lj-card">
            <div className="lj-card-header">
              <h3>Lead Journey</h3>
            </div>
            <div className="lj-pipeline-container">
              {steps.map((step, i) => (
                <div key={i} className={`pipeline-step ${step.status}`}>
                  <div className="step-circle">
                    {step.status === "done" ? "✓" : step.status === "rejected" ? "✕" : i + 1}
                  </div>
                  
                  {/* Updated Step Info to ensure two lines */}
                  <div className="step-info">
  <strong className="step-label">{step.label}</strong>
  <span className="step-date">{step.date}</span>
 
  {step.status === "rejected" && (
    <span className="step-reason">
      {step.reason}
    </span>
  )}
</div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. UNIFIED PROFILE & CUSTOMER DETAILS CARD */}
          <div className="lj-card">
              <div className="lj-profile-hero">
                <div className="lj-avatar-large">{initials}</div>
                
                <div className="lj-profile-content">
                  {/* LEFT SIDE: NAME & BADGE */}
                  <div className="lj-name-side">
                    <div className="lj-name-badge-row">
                      <h1 className="lj-profile-name">{lead.customer_name}</h1>
                    </div>
                  </div>

                  {/* RIGHT SIDE: CONTACT GRID */}
                  <div className="lj-contact-grid">
                    <div className="contact-item">
                      
                      <span className="contact-label">Mobile</span>
                      <span className="contact-value">{lead.customer_mobile}</span>
                    </div>
                    <div className="contact-item">
                      <span className="contact-label">Email</span>
                      <span className="contact-value">{lead.customer_email || "—"}</span>
                    </div>
                    <div className="contact-item">
                      <span className="contact-label">City</span>
                      <span className="contact-value">{lead.city || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            <div className="lj-section-divider"></div>

            {/* CUSTOMER DETAILS SECTION */}
            <div className="lj-details-container">
              <div className="data-group">
                <h4 className="group-title">Property Details</h4>
                <div className="data-grid-layout">
                  <InfoBox label="Interested Project" value={lead.project_name} />
                  {/* <InfoBox label="Lead Status" value={lead.lead_status || "Not Specified"} /> */}
                  <InfoBox label="Budget" value={lead.budget} />
                  {/* <InfoBox label="Unit Number" value={lead.unit_number || "—"} /> */}
                </div>
              </div>
              {/* fmtWithTime(lead.expected_site_visit_date) */}

              <div className="data-group">
                <h4 className="group-title">Lead Information</h4>
                <div className="data-grid-layout">
                  <InfoBox label ="Expected Site Visit" value={fmtWithTime(lead.expected_site_visit_date)}/>
                  <InfoBox label="Created Date" value={fmt(lead.CREATEDTIME)} />
                  <InfoBox label="Last Activity" value={fmt(lead.MODIFIEDTIME)} />
                </div>
              </div>

              {isSOCreated && (
            <div className="data-group">
              <h4 className="group-title">Booking Information</h4>
              <div className="data-grid-layout">
               
                <InfoBox label ="Project" value={salesOrder.project_name}/>
                <InfoBox label ="Building" value={salesOrder.building_name}/>
                <InfoBox label ="Unit No" value={salesOrder.unit_number}/>
                <InfoBox label ="Booking Date" value={fmt(salesOrder.booking_date)}/>
                <InfoBox label ="Registration Date" value={fmtWithTime(salesOrder.registration_date)}/>
                <InfoBox label ="Booking Status" value={salesOrder.booking_status}/>

              </div></div>
            )}
            </div>
          </div>

        </div>
      </div>
      <Footer />
    </>
  );
}

const InfoBox = ({ label, value, isTag }) => (
  <div className="info-box">
    <span className="info-label">{label}</span>
    {isTag ? (
      <span className="info-tag">{value || "Direct"}</span>
    ) : (
      <span className="info-value">{value || "—"}</span>
    )}
  </div>
);