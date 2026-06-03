// the monthly user and reinvite kpi are in charts.jsx code
import Header from "../ui/Header";
import Footer from "../ui/Footer";
import MonthlyUserChart from "./Chart";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import {
  Users,
  UserCheck,
  Clock,
  TrendingUp,
  FileText,
  Download,
} from "lucide-react";
import styles from "./page.module.css";
import { fetchAllUsers } from "../../store/allUsersSlice";
import { fetchBrochures } from "../../store/brochureslice";
import { useNavigate } from "react-router-dom";
import style1 from "../ui/Skeleton.module.css";
import DonutChart from "../ui/DonutChart";

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector((state) => state.auth.user);
  const { list = [], loading } = useSelector((state) => state.allUsers);
  const { list: brochures = [] } = useSelector((state) => state.brochures);

  const displayName = user?.first_name;

  useEffect(() => {
    dispatch(fetchAllUsers());
    dispatch(fetchBrochures()); // ✅ added
  }, [dispatch]);

  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();

  const appUsers = list.filter((u) => u.role === "App User");

  const monthlySignupCount = appUsers.filter((u) => {
    if (!u.invited_time) return false;
    const d = new Date(u.invited_time);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const activeUsers = appUsers.filter(
    (u) => u.status?.toLowerCase() === "active" && u.is_confirmed === true
  ).length;

  const pendingUsers = appUsers.filter(
    (u) => u.status?.toLowerCase() === "active" && u.is_confirmed === false
  ).length;

  const totalUsers = appUsers.length;

  // 🔥 brochure real data
  const total = brochures.length;
  const active = brochures.filter(b => b.is_active).length;
  const residential = brochures.filter(b => b.project_type === "Residential").length;
  const commercial = brochures.filter(b => b.project_type === "Commercial").length;
  const plots = brochures.filter(b => b.project_type === "Plots").length;

  const metrics = [
    { id: 1, label: "Total Partners", value: totalUsers, icon: <Users />, color: "#ff6b00" },
    { id: 2, label: "Active Partners", value: activeUsers, icon: <UserCheck />, color: "#22c55e" },
    { id: 4, label: "Pending Invites", value: pendingUsers, icon: <Clock />, color: "#3b82f6" },
    { id: 3, label: "New Signups", value: monthlySignupCount, icon: <TrendingUp />, color: "#a855f7" },
  ];

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>

          {/* HEADER */}
          <div className={styles.topBar}>
            <div>
              <h1 className={styles.title}>
                Welcome, {displayName} <span className={styles.wave}>👋</span>
              </h1>
              {/* <p className={styles.subtitle}>
                Monitor your partner ecosystem in real-time.
              </p> */}
            </div>
            <Button size="md" onClick={() => navigate("/app/admin/addbrochures")}>
              + Add Brochures
            </Button>
          </div>

          {/* METRICS */}
          <div className={styles.metricsGrid}>
            {metrics.map((metric) => (
              <Card key={metric.id} className={`${styles.metricCard} ${metric.highlight ? styles.highlight : ""}`} hoverable>
                <div className={styles.metricIcon} style={{ background: `${metric.color}15`, color: metric.color }}>
                  {metric.icon}
                </div>
                <div>
                  <div className={styles.metricLabel}>{metric.label}</div>
                  {loading ? (
                    <span className={style1.skeletonPulse} style={{width: "50px", height: "24px", display: "block"}} />
                  ) : (
                    <div className={styles.metricValue}>{metric.value}</div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* CHART */}
          <div className={styles.chartSection}>
            <MonthlyUserChart users={appUsers} />
          </div>

          {/* 🔥 FIXED BOTTOM SECTION */}
          <div className={styles.bottomGrid}>

            {/* LEFT → BROCHURE */}
           <Card className={styles.brochureCard}>
  <div className={styles.cardHeader}>
    <div>
      <h2 className={styles.cardTitle}>Brochure Insights</h2>
      {/* <p className={styles.cardSub}>Live distribution overview</p> */}
    </div>

    <div className={styles.totalBadge}>
      {total} Total
    </div>
  </div>

  {/* 🔥 Donut Chart */}
 <div style={{ width: "100%", height: "260px" }}>
  <DonutChart
    residential={residential}
    commercial={commercial}
    plots={plots}
  />
</div>

  {/* 🔥 Stats Grid */}
  <div className={styles.statsGrid}>
    <div className={styles.statCard}>
      <span className={styles.dot} style={{ background: "#ff6b00" }} />
      <div>
        <p>Residential</p>
        <h4>{residential}</h4>
      </div>
    </div>

    <div className={styles.statCard}>
      <span className={styles.dot} style={{ background: "#a855f7" }} />
      <div>
        <p>Commercial</p>
        <h4>{commercial}</h4>
      </div>
    </div>

    <div className={styles.statCard}>
      <span className={styles.dot} style={{ background: "#22c55e" }} />
      <div>
        <p>Plots</p>
        <h4>{plots}</h4>
      </div>
    </div>
  </div>
</Card>

            {/* RIGHT → PARTNERS */}
            <Card className={styles.tableCard}>
              <div className={styles.tableHeader}>
                <h2>Recent Partners</h2>
                {/* <p>Latest partner activity overview</p> */}
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Partner</th>
                      <th>Status</th>
                      <th>Joined Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appUsers.slice(0, 5).map((u, i) => (
                      <tr key={i}>
                        <td className={styles.userCell}>
                          <div className={styles.avatar}>
                            {u.first_name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <span>{u.first_name}</span>
                            <span>{u.email}</span>
                          </div>
                        </td>
                        <td>
                          {u.is_confirmed ? "Active" : "Pending"}
                        </td>
                        <td>
                          {u.invited_time
                            ? new Date(u.invited_time).toLocaleDateString()
                            : "-"}
                        </td>
                      </tr>
                    ))}
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
};

export default Dashboard;