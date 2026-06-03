import React, { useEffect } from "react";
import styles from "./page.module.css";
import Header from "../ui/Header";
import Card from "../ui/Card";
import Button from "../ui/Button";
import { Link } from "react-router-dom";
import { useNavigate } from 'react-router-dom';
import Skeleton from "./../ui/Skeleton";
import { ReceiptText } from "lucide-react";
import Footer from "../ui/Footer";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement, 
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

import { Bar, Doughnut, Pie, Line } from "react-chartjs-2";

// Redux
import { useDispatch, useSelector } from "react-redux";
import { fetchUser } from "../../store/userSlice";
import { fetchLeads } from "../../store/leadsSlice";
import { fetchCommissions } from "../../store/commissionSlice";
import { fetchSalesOrders } from "../../store/salesOrderSlice";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement , Filler, LineElement ,PointElement, Title, Tooltip, Legend);

export default function Dashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const userData = useSelector((state) => state.user.data);
  const userStatus = useSelector((state) => state.user.status);

  const leads = useSelector((state) => state.leads.data);
  const ltotal = useSelector((state) =>state.leads.total)
  const leadsStatus = useSelector((state) => state.leads.status);

const { list: commissions, loading: commissionLoading } =
  useSelector((state) => state.commissions);

  // NORMALIZE COMMISSION STATUS (single source of truth)
const normalizedCommissions = (commissions || []).map(c => {
  let status = "pending";

  if (c.UTR_Number) status = "paid";

  return { ...c, commission_status: status };
});

  const salesOrders = useSelector((state) => state.salesOrders.data); 
  const soStatus = useSelector((state) => state.salesOrders.status);
  
  /* ---------- LOADING FLAGS ---------- */
  const isUserLoading = userStatus === "loading" ;
  const isLeadsLoading = leadsStatus === "loading";
  const isSOLoading = soStatus === "loading" ;
  const isCommissionLoading = commissionLoading;
  // Calculate Commission Totals for Pie Chart
  const commissionData = normalizedCommissions.reduce(
    (acc, c) => {
      const status = c.commission_status?.toLowerCase();
      const amount = Number(c.CP_Commission || 0);
      if (status === "paid") acc.paid += amount;
      else acc.pending += amount;
      return acc;
    },
    { paid: 0, pending: 0 }
  ) || { paid: 0, pending: 0 };

  const pieData = {
    labels: ["Paid", "Pending"],
    datasets: [
      {
        data: [commissionData.paid, commissionData.pending],
        // CHANGED: Converted HEX to RGBA with 0.8 Opacity
        backgroundColor: [
          "rgba(34, 197, 94, 0.8)",   // Paid (Green)
          "rgba(255, 159, 28, 0.8)"   // Pending (Orange)
        ],
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverOffset: 20, 
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: 0,
    layout: {
      padding: 20 
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, padding: 20 }
      },
      tooltip: {
        enabled: true,
      }
    },
  };

  // fetch user on first load
  useEffect(() => {
    if (!userData && userStatus === "idle") {
      dispatch(fetchUser());
    }
  }, [dispatch, userData, userStatus]);

  // fetch leads
  useEffect(() => {
    if (leadsStatus === "idle") {
      dispatch(fetchLeads());
    }
  }, [dispatch, leadsStatus]);

  // fetch commissions
  useEffect(() => {
  dispatch(fetchCommissions());
}, [dispatch]);

  // fetch sales order
  useEffect(() => {
    if (soStatus === "idle") {
      dispatch(fetchSalesOrders());
    }
  }, [dispatch, soStatus]);

  

  // sync redux → localStorage
  useEffect(() => {
    if (userData) {
      localStorage.setItem("user", JSON.stringify(userData));
    }
  }, [userData]);

  // fallback
  let finalUser = userData;
  if (!finalUser) {
    const stored = localStorage.getItem("user");
    if (stored) finalUser = JSON.parse(stored);
  }

  // ========== DYNAMIC METRICS ==========
  const totalLeads = isLeadsLoading ? null : ltotal;
  const bookingsCount = isSOLoading ? null : salesOrders.length;

  const pendingCommissionTotal =
  normalizedCommissions
    .filter(c => c.commission_status === "pending")
    .reduce((sum, c) => sum + Number(c.CP_Commission || 0), 0);

const pendingCommission =
  pendingCommissionTotal === null
    ? null
    : `₹${pendingCommissionTotal.toLocaleString()}`;
  // const pendingCommission = isCommissionLoading
  // ? null
  // : `₹${pendingCommissionTotal.toLocaleString()}`;


  const isChartEmpty =
  !isCommissionLoading &&
  commissionData.paid === 0 &&
  commissionData.due === 0 &&
  commissionData.pending === 0;

  const rank = "Silver";

  const metrics = [
    {
      id: 1,
      label: "Total Leads",
      value: totalLeads,
      color: "#3B82F6",
      icon: (
        <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      ),
    },
    {
      id: 2,
      label: "Bookings",
      value: bookingsCount,
      color: "#10B981",
      icon: (
        <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: 3,
      label: "Pending Commission",
      value: pendingCommission,
      color: "#FF6600",
      
      icon: (
        <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      id: 4,
      label: "Rank",
      value: rank,
      color: "#8B5CF6",
      subtext: "Partner",
      icon: (
        <svg width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
    },
  ];

  // ========== DYNAMIC CHART (FIXED) ==========
  const monthBuckets = {
    Jan: { leads: 0, bookings: 0 },
    Feb: { leads: 0, bookings: 0 },
    Mar: { leads: 0, bookings: 0 },
    Apr: { leads: 0, bookings: 0 },
    May: { leads: 0, bookings: 0 },
    Jun: { leads: 0, bookings: 0 },
    Jul: { leads: 0, bookings: 0 },
    Aug: { leads: 0, bookings: 0 },
    Sep: { leads: 0, bookings: 0 },
    Oct: { leads: 0, bookings: 0 },
    Nov: { leads: 0, bookings: 0 },
    Dec: { leads: 0, bookings: 0 },
  };

  // 1. Process Leads
  leads?.forEach((lead) => {
    if (!lead.CREATEDTIME) return;
    const date = new Date(lead.CREATEDTIME);
    if (!isNaN(date)) {
      const month = date.toLocaleString("en-US", { month: "short" });
      if (monthBuckets[month]) monthBuckets[month].leads++;
    }
  });

  // 2. Process Sales Orders (Bookings) - Fixed Logic
  salesOrders?.forEach((order) => {
    const orderDate = new Date(order.CREATEDTIME || order.created_at);
    if (!isNaN(orderDate)) {
      const month = orderDate.toLocaleString("en-US", { month: "short" });
      if (monthBuckets[month]) monthBuckets[month].bookings++;
    }
  });

  const chartLabels = Object.keys(monthBuckets);
  const leadValues = chartLabels.map((m) => monthBuckets[m].leads);
  const bookingValues = chartLabels.map((m) => monthBuckets[m].bookings);

  // BAR CHART DATA
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Leads Submitted",
        data: leadValues,
        backgroundColor: "#f97316", 
        borderRadius: {
          topLeft: 8, 
          topRight: 8,
          bottomLeft: 0,
          bottomRight: 0,
        },
        borderSkipped: false,
      },
      {
        label: "Bookings Closed",
        data: bookingValues,
        backgroundColor: "#22c55e", 
        borderRadius: {
          topLeft: 8, 
          topRight: 8,
          bottomLeft: 0,
          bottomRight: 0,
        },
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        border: { display: false },
        ticks: {
          color: "#6b7280",
          font: { size: 12, weight: 500 },
          stepSize: 3,
        },
        grid: {
          color: "#e5e7eb",
          borderDash: [3, 3],
          drawBorder: false,
        },
      },
      x: {
        border: { display: false },
        ticks: {
          color: "#6b7280",
          font: { size: 12, weight: 500 },
        },
        grid: {
          display: false,
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 20,
          color: "#111827",
          font: { size: 12, weight: 600 },
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          titleColor: '#1e293b',
          bodyColor: '#1e293b',
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.1)',
          displayColors: true,
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: "#fff",
        titleColor: "#111827",
        bodyColor: "#111827",
        borderColor: "#e5e7eb",
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        bodyFont: { size: 12, weight: 600 },
        displayColors: true,
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    animations: {
      y: {
        duration: 2000,
        easing: 'easeOutQuart'
      }
    },
  };

  // 1. Lead Status Pipeline Logic
  console.log("Debug Leads Data:", leads?.[0]);
  const statusCounts = leads?.reduce((acc, lead) => {
    console.log("Processing Status for lead:", lead.LEADSTATUS);
    const status = lead.lead_status || "New Lead";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}) || {};

  const leadStatusData = {
    labels: Object.keys(statusCounts),
    datasets: [{
      data: Object.values(statusCounts),
      // CHANGED: Converted HEX to RGBA with 0.8 Opacity
      backgroundColor: [
        "rgba(59, 130, 246, 0.8)", // Blue
        "rgba(245, 158, 11, 0.8)", // Amber
        "rgba(16, 185, 129, 0.8)", // Emerald
        "rgba(249, 115, 22, 0.8)", // Orange
        "rgba(5, 150, 105, 0.8)"   // Dark Green
      ],
      borderWidth: 2,
      borderColor: "#ffffff",
      hoverOffset: 20,
    }]
  };

  // 2. Monthly Commission Earnings Logic
  const monthlyEarnings = { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 };
  commissions?.forEach(c => {
    const date = new Date(c.CREATEDTIME || c.date);
    if (!isNaN(date)) {
      const month = date.toLocaleString("en-US", { month: "short" });
      if(monthlyEarnings.hasOwnProperty(month)) {
          monthlyEarnings[month] += Number(c.CP_Commission	 || 0);
      }
    }
  });

  const earningsData = {
    labels: Object.keys(monthlyEarnings),
    datasets: [{
      label: "Commission Earned",
      data: Object.values(monthlyEarnings),
      borderColor: "#f97316",
      borderWidth: 4,
      pointRadius: 6,
      pointBackgroundColor: "#fff",
      pointBorderWidth: 3,
      tension: 0.4,
      fill: true,
      backgroundColor: (context) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;

        if (!chartArea) {
          return "rgba(249, 115, 22, 0.2)";
        }

        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, "rgba(249, 115, 22, 0.8)"); 
        gradient.addColorStop(0.6, "rgba(249, 115, 22, 0.2)");
        gradient.addColorStop(1, "rgba(249, 115, 22, 0.05)");
        return gradient;
      },
    }]
  };
//  lead handeler
const openLeadJourney = (rowId) => {
  if (!rowId) return;

  navigate(`/app/lead-journey/${rowId}`);
};
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.welcomeSection}>
            <div>
              <h1 className={styles.title}>
                {isUserLoading ? (
                  <Skeleton variant="text" width="220px" height="28px" />
                ) : (
                  <>
                    Welcome Back, {finalUser?.cp_name || "User"}!
                    <span className={styles.wave}>👋</span>
                  </>
                )}
              </h1>
              
            </div>

            <Link to="/app/leads">
              <Button variant="orange" size="md">
                View All Leads →
              </Button>
            </Link>
          </div>

          <div className={styles.metricsGrid}>
            {metrics.map((metric) => (
              <Card
                key={metric.id}
                className={`${styles.metricCard} ${
                  metric.highlight ? styles.highlight : ""
                }`}
                hoverable
              >
                <div
                  className={styles.metricIcon}
                  style={{
                    backgroundColor: `${metric.color}15`,
                    color: metric.color,
                  }}
                >
                  {metric.icon}
                </div>
                <div className={styles.metricContent}>
                  <div className={styles.metricLabel}>{metric.label}</div>
                  <div className={styles.metricValue}>
                    {isLeadsLoading || isSOLoading ? (
                      <Skeleton variant="text" width="80px" height="24px" />
                    ) : (
                      metric.value
                    )}
                    {metric.subtext && (
                      <span className={styles.metricSubtext}>
                        {" "}
                        {metric.subtext}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* ROW 1: TRENDS & STATUS */}
          <div className={`${styles.chartsRow} ${styles.fadeIn}`}>
            {/* BAR CHART */}
            <Card className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>Leads vs Bookings Trend</h3>
                {/* <p>Last 12 months performance analysis</p> */}
              </div>
              <div className={styles.chartContainer}>
                {isLeadsLoading || isSOLoading ? (
                  <Skeleton variant="rect" height="260px" />
                ) : (
                  <Bar data={chartData} options={chartOptions} />
                )}
              </div>
            </Card>

            {/* PIE/DOUGHNUT CHART */}
            <Card className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>Commission Status Distribution</h3>
                {/* <p>Total pending, due, and paid amounts</p> */}
              </div>
              <div className={styles.chartContainer}>
                {isCommissionLoading ? (
                  <Skeleton variant="rect" height="260px" />
                ) : isChartEmpty ? (
                  <div className={styles.emptyChart}>
                    <div className={styles.emptyIconWrapper}>
                      <ReceiptText size={34} strokeWidth={1.8} />
                    </div>

                    <div className={styles.emptyTitle}>No Data yet</div>

                    <div className={styles.emptySubtitle}>
                      No Data found. Please check back later or adjust your filters.
                    </div>
                  </div>
                ) : (
                  <Doughnut data={pieData} options={pieOptions} />
                )}
              </div>
            </Card>
          </div>

          {/* ROW 2: PIPELINE & EARNINGS */}
          <div className={styles.chartsRow}>
            {/* LEAD PIPELINE */}
            <Card className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>Lead Status Pipeline</h3>
                {/* <p>Current leads distribution across stages</p> */}
              </div>
              <div className={styles.chartContainer}>
                {isLeadsLoading ? (
                  <Skeleton variant="rect" height="260px" />
                ) : (
                  <Pie data={leadStatusData} options={pieOptions} />
                )}
              </div>
            </Card>

            {/* MONTHLY EARNINGS LINE CHART */}
            <Card className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3>Monthly Commission Earnings</h3>
                {/* <p>Commission trend over the fiscal year</p> */}
              </div>
              <div className={styles.chartContainer}>
                <Line 
                  data={earningsData} 
                  options={{
                    ...chartOptions,
                    scales: {
                      ...chartOptions.scales,
                      y: {
                        ...chartOptions.scales.y,
                        stepSize: undefined, 
                        ticks: {
                          color: "#6b7280",
                          font: { size: 12, weight: 500 },
                          callback: (val) => {
                            if (val >= 100000) return `₹${(val/100000).toFixed(1)}L`;
                            if (val >= 1000) return `₹${(val/1000).toFixed(0)}K`;
                            return `₹${val}`;
                          }
                        }
                      }
                    }
                  }} 
                />
              </div>
            </Card>
          </div>


        
        {/* THE ENTIRE RECENT LEADS BLOCK */}
        <div className={styles.recentLeadsBlock}>
          <div className={styles.tableHeaderSection}>
            <h2 className={styles.tableTitle}>RECENT LEADS</h2>
            <button className={styles.viewAllLeadsBtn} onClick={() => navigate('/app/leads')}>
              View All Leads <span className={styles.arrow}>→</span>
            </button>
          </div>
          
          <Card className={styles.tableMainCard}>
            <div className={styles.tableResponsiveWrapper}>
              <table className={styles.leadsStyledTable}>
                <thead>
                  <tr>
                    <th>CUSTOMER NAME</th>
                    <th>PROJECT NAME</th>
                    <th>STATUS</th>
                    {/* <th>BOOKING AMOUNT</th> */}
                    <th>CREATED DATE</th>
                    <th>DAYS OPEN</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                   {isLeadsLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td colSpan="7">
                              <Skeleton variant="rect" height="50px" />
                            </td>
                          </tr>
                        ))
                      : leads?.slice(0, 5).map((lead, index) => {
                    const createdDate = new Date(lead.CREATEDTIME);
                    const daysOpen = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));

                    return (
                      <tr key={lead.ROWID || index} className={styles.interactiveRow}>
                        <td className={styles.boldText}>{lead.customer_name}</td>
                        <td>{lead.project_name || "—"}</td>
                        <td>
                          {/*  */}
                          <span
                            className={`${styles.badge} ${
                              styles[
                                lead.lead_status
                                  ?.toLowerCase()
                                  .replace(/\s/g, "")
                                  .replace(/[^a-z]/g, "") || "newlead"
                              ]
                            }`}
                          >      
                            {lead.lead_status || "NEW LEAD"}
                          </span>
                        </td>
                        {/* <td className={styles.bookingCell}>
                          {lead.booking_amount ? `₹${Number(lead.booking_amount).toLocaleString('en-IN')}` : "—"}
                        </td> */}
                        <td>
                          {createdDate.toLocaleDateString('en-GB', { 
                            day: '2-digit', 
                            month: 'short', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td className={styles.daysHighlight}>{daysOpen || 0}</td>
                        <td>
                        <span
                          className={styles.orangeAction}
                          onClick={() => openLeadJourney(lead.ROWID)}
                          style={{ cursor: "pointer" }}
                        >
                          View
                        </span>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}