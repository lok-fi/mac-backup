import React, { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import styles from "./page.module.css";
import { useDispatch } from "react-redux";
import CustomSelect from "./CustomSelect";
import { reinviteUser } from "../../store/allUsersSlice";
import { useNavigate } from "react-router-dom";


import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend, Filler);

const monthOrder = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MonthlyUserChart({ users }) {
  const dispatch = useDispatch();
  const list = users || [];
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const yearOptions = Array.from({ length: 6 }, (_, i) => {
    const y = (new Date().getFullYear() - i).toString();
    return { label: y, value: y };
  });

  const chartData = useMemo(() => {
    const counts = {};
    list.forEach((user) => {
      if (!user.created_time) return;
      const date = new Date(user.created_time);
      if (date.getFullYear().toString() === selectedYear) {
        const month = monthOrder[date.getMonth()];
        counts[month] = (counts[month] || 0) + 1;
      }
    });
    return monthOrder.map(m => counts[m] || 0);
  }, [list, selectedYear]);
  const navigate = useNavigate();
  const data = {
    labels: monthOrder,
    datasets: [{
      label: `User Signups (${selectedYear})`,
      data: chartData,
      borderColor: "#f97316",
      backgroundColor: (context) => {
        const { ctx, chartArea } = context.chart;
        if (!chartArea) return "rgba(249,115,22,0.1)";
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        gradient.addColorStop(0, "rgba(249,115,22,0.6)");
        gradient.addColorStop(1, "rgba(249,115,22,0)");
        return gradient;
      },
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: "#fff",
      borderWidth: 3
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        // 🔥 This keeps the scale at 7 even if data is lower
        suggestedMax: 7, 
        ticks: { stepSize: 1, color: "#94a3b8" },
        grid: { color: "#f1f5f9" }
      },
      x: { grid: { display: false }, ticks: { color: "#94a3b8" } }
    },
  };

  const pendingUsers = useMemo(() => 
    list.filter((u) => !u.is_confirmed).slice(0, 5), 
  [list]);

  return (
    <div className={styles.dashboardRow}>
      {/* LEFT - CHART */}
      <div className={styles.containerCard}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Monthly User Growth</h3>
            {/* <p className={styles.cardSub}>Track partner onboarding trends</p> */}
          </div>
          <div className={styles.headerActions}>
            <CustomSelect options={yearOptions} value={selectedYear} onChange={setSelectedYear} />
            <div className={styles.totalBadge}>Total Users: {list.length}</div>
          </div>
        </div>
        <div className={styles.chartWrapper}>
          <Line data={data} options={options} />
        </div>
      </div>

      {/* RIGHT - REINVITE LIST */}
      <div className={styles.containerCard}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Reinvite Partners</h3>
            {/* <p className={styles.cardSub}>Pending confirmations ({pendingUsers.length})</p> */}
          </div>
          <button
            className={styles.totalBadge}
            onClick={() => navigate("/app/admin/all_users")}  // 🔥 route here
          >
            View All →
          </button>
        </div>
        <div className={styles.reinviteList}>
          {pendingUsers.map((u) => (
            <div key={u.user_id} className={styles.userRow}>
              <div className={styles.userInfo}>
                <div className={styles.avatar}>{u.first_name?.[0]}</div>
                <div>
                  <p className={styles.userName}>{u.first_name} {u.last_name}</p>
                  <span className={styles.statusText}>Pending invite</span>
                </div>
              </div>
              <button className={styles.reinviteBtn} onClick={() => dispatch(reinviteUser(u))}>
                ⟳
              </button>
            </div>
          ))}
          {pendingUsers.length === 0 && (
            <p className={styles.emptyMsg}>No pending invites found.</p>
          )}
        </div>
      </div>
    </div>
  );
}