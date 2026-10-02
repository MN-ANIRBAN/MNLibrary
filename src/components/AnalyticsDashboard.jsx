import React, { useState } from "react";
import "../DashboardStyles.css";
import { motion, AnimatePresence } from "framer-motion";

import {
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, Legend, Bar,
  ComposedChart, Line, BarChart, Sector, Area
} from "recharts";
import {
  BookOpen, CheckCircle, Clock, Wallet, Tag, Award, Star, Banknote, Percent,
  Library, ArrowRightLeft, BookDown, BookUp, UserCheck, Users, BookMarked,
  Calendar, BarChart3, PieChart as PieIcon, Heart, TrendingUp, Flame, Zap,
  ShoppingBag, TrendingDown, ArrowUpRight, Trophy, User
} from "lucide-react";

import { useBookAnalytics } from "../hooks/useBookAnalytics";
import {
  StatBox, MiniLeaderboard, CircularProgress, ReadingGoalCard,
  HeatmapCard, ExchangeCard, StreakBadge, AnimatedCounter,
  MonthlyDetailsModal, WeeklyDetailsModal, StatusProgressGroup
} from "./DashboardWidgets";
import ReadingActivityChart from "./ReadingActivityChart";

const CHART_COLORS = [
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#10b981", // Emerald
];

// ─── Tooltip ─────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const d = payload[0]?.payload;
  const isMonthData = d?.bought !== undefined;

  return (
    <div className="dash-tooltip">
      <p className="dash-tooltip-label">{label}</p>

      {isMonthData ? (
        <div style={{ display: "flex", gap: "20px" }}>
          <div className="dash-tooltip-stats-col">
            <strong className="dash-text-purple">Bought: {d.bought}</strong>
            <div className="dash-text-emerald" style={{ fontSize: "12px" }}>✓ Read: {d.boughtRead}</div>
            <div className="dash-text-amber" style={{ fontSize: "12px" }}>⋯ Reading: {d.boughtReading}</div>
            <div className="dash-text-muted" style={{ fontSize: "12px" }}>○ Unread: {d.boughtUnread}</div>
            <div className="dash-text-red" style={{ fontSize: "12px", marginTop: "4px", fontWeight: "bold" }}>
              Spent: ₹{Math.round(d.boughtSpent || d.spent || 0).toLocaleString()}
            </div>
            {d.boughtSaved > 0 && (
              <div className="dash-text-amber" style={{ fontSize: "12px" }}>Saved: ₹{Math.round(d.boughtSaved).toLocaleString()}</div>
            )}
          </div>
          <div className="dash-tooltip-stats-col">
            <strong className="dash-text-blue">Borrowed: {d.borrowed}</strong>
            <div className="dash-text-emerald" style={{ fontSize: "12px" }}>✓ Read: {d.borrowedRead}</div>
            <div className="dash-text-amber" style={{ fontSize: "12px" }}>⋯ Reading: {d.borrowedReading}</div>
            <div className="dash-text-muted" style={{ fontSize: "12px" }}>○ Unread: {d.borrowedUnread}</div>
          </div>
          {(d.lent > 0 || d.reLent > 0) && (
            <div className="dash-tooltip-stats-col">
              {d.lent > 0 && (
                <div style={{ marginBottom: d.reLent > 0 ? "8px" : "0" }}>
                  <strong className="dash-text-emerald">Lent: {d.lent}</strong>
                  <div className="dash-text-emerald" style={{ fontSize: "12px" }}>✓ Read: {d.lentRead}</div>
                  <div className="dash-text-amber" style={{ fontSize: "12px" }}>⋯ Reading: {d.lentReading}</div>
                  <div className="dash-text-muted" style={{ fontSize: "12px" }}>○ Unread: {d.lentUnread}</div>
                </div>
              )}
              {d.reLent > 0 && (
                <div>
                  <strong className="dash-text-orange">Re-lent: {d.reLent}</strong>
                  <div className="dash-text-emerald" style={{ fontSize: "12px" }}>✓ Read: {d.reLentRead}</div>
                  <div className="dash-text-amber" style={{ fontSize: "12px" }}>⋯ Reading: {d.reLentReading}</div>
                  <div className="dash-text-muted" style={{ fontSize: "12px" }}>○ Unread: {d.reLentUnread}</div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        payload.map((entry, i) => (
          <div key={i} className="dash-tooltip-row">
            <span className="dash-tooltip-dot" style={{ background: entry.color }} />
            <span className="dash-tooltip-name">{entry.name}</span>
            <span className="dash-tooltip-value">
              {entry.name?.includes("₹") || entry.name === "Spent"
                ? `₹${Math.round(entry.value).toLocaleString()}`
                : entry.name?.includes("Discount") || entry.name?.includes("%")
                  ? `${entry.value}%`
                  : entry.value}
            </span>
          </div>
        ))
      )}
    </div>
  );
};

// ─── Monthly Snapshot Card ────────────────────────────────────────────────────
const MonthSnapshotCard = ({ data, onClick }) => {
  if (!data) return null;
  const total = data.bought + data.borrowed;
  const readPct = total > 0 ? Math.round(((data.boughtRead + data.borrowedRead) / total) * 100) : 0;

  return (
    <motion.div
      className="dash-glass-card month-snapshot-card"
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={() => onClick && onClick(data)}
      style={{ cursor: "pointer", minWidth: "200px", flex: "0 0 auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <p className="dash-text-muted" style={{ fontSize: "12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {data.name}
          </p>
          <h3 className="dash-text-primary" style={{ fontSize: "22px", fontWeight: 800, margin: "2px 0" }}>
            {data.bought + data.borrowed}
          </h3>
          <p className="dash-text-secondary" style={{ fontSize: "12px" }}>
            {data.bought} bought · {data.borrowed} borrowed
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p className="dash-text-emerald" style={{ fontSize: "14px", fontWeight: 700 }}>
            ₹{Math.round(data.boughtSpent || 0).toLocaleString()}
          </p>
          {data.boughtSaved > 0 && (
            <p className="dash-text-amber" style={{ fontSize: "11px" }}>
              saved ₹{Math.round(data.boughtSaved).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Mini pipeline bar */}
      {total > 0 && (
        <div>
          <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", height: "6px", background: "var(--dash-ring-track)", marginBottom: "4px", border: "1px solid var(--dash-border)" }}>
            <div style={{ width: `${((data.boughtRead + data.borrowedRead) / total) * 100}%`, background: "var(--emerald-color)" }} />
            <div style={{ width: `${((data.boughtReading + data.borrowedReading) / total) * 100}%`, background: "var(--amber-color)" }} />
            <div style={{ width: `${((data.boughtUnread + data.borrowedUnread) / total) * 100}%`, background: "var(--indigo-color)" }} />
          </div>
          <p className="dash-text-secondary" style={{ fontSize: "11px" }}>{readPct}% read</p>
        </div>
      )}

      {data.topDiscountBook && (
        <div className="dash-deal-box" style={{ marginTop: "10px" }}>
          <p className="dash-text-amber" style={{ fontSize: "10px", fontWeight: 700 }}>🏷 Best Deal</p>
          <p className="dash-text-primary" style={{ fontSize: "11px", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {data.topDiscountBook.title}
          </p>
          <p className="dash-text-muted" style={{ fontSize: "10px" }}>{data.topDiscountBook.discountPct}% off</p>
        </div>
      )}
    </motion.div>
  );
};

// ─── Publisher Discount Card ──────────────────────────────────────────────────
// ─── Publisher Discount Card ──────────────────────────────────────────────────
const PublisherDiscountRow = ({ item, index }) => {
  const getBadgeBg = (i) => {
    if (i === 0) return "var(--amber-color)";
    if (i === 1) return "var(--dash-text-muted)";
    if (i === 2) return "var(--orange-color)";
    return "var(--dash-ring-track)";
  };
  const getBadgeColor = (i) => i < 3 ? "var(--dash-bg)" : "var(--dash-text-muted)";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "10px 0", borderBottom: "1px solid var(--dash-border-glass)"
      }}
    >
      <span style={{
        width: "24px", height: "24px", borderRadius: "50%",
        background: getBadgeBg(index),
        color: getBadgeColor(index),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "11px", fontWeight: 800, flexShrink: 0
      }}>{index + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="dash-text-primary" style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.name}
        </p>
        <p className="dash-text-secondary" style={{ fontSize: "11px" }}>{item.bookCount} books · saved ₹{item.totalSaved.toLocaleString()}</p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p className="dash-text-emerald" style={{ fontSize: "15px", fontWeight: 800 }}>{item.avgDiscount}%</p>
        <p className="dash-text-secondary" style={{ fontSize: "10px" }}>avg off</p>
      </div>
    </motion.div>
  );
};

// ─── Custom Pie Label ─────────────────────────────────────────────────────────
const CustomPieLabel = (props) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, name, fill } = props;
  if (percent < 0.02) return null; // Hide labels for very small slices

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);

  const sx = cx + (outerRadius + 4) * cos;
  const sy = cy + (outerRadius + 4) * sin;

  const mx = cx + (outerRadius + 22) * cos;
  const my = cy + (outerRadius + 22) * sin;

  const isRight = cos >= 0;
  const ex = mx + (isRight ? 1 : -1) * 24;
  const ey = my;

  const tx = isRight ? ex + 8 : ex - 8;
  const textAnchor = isRight ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy} L${mx},${my} L${ex},${ey}`} stroke={fill} strokeWidth={1.5} fill="none" opacity={0.6} strokeLinejoin="round" strokeDasharray="2 3" />
      <circle cx={sx} cy={sy} r={3.5} fill={fill} stroke="var(--dash-card)" strokeWidth={1.5} />
      <circle cx={ex} cy={ey} r={2} fill={fill} opacity={0.8} />

      <text x={tx} y={ey - 4} textAnchor={textAnchor} fill="var(--dash-text-primary)" fontSize="13px" fontWeight="700">
        {name && name.length > 18 ? name.substring(0, 16) + '..' : name}
      </text>

      <text x={tx} y={ey + 12} textAnchor={textAnchor} fill="var(--dash-text-secondary)" fontSize="12px" fontWeight="600">
        {(percent * 100).toFixed(0)}%
      </text>
    </g>
  );
};

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, cornerRadius } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 3}
        outerRadius={outerRadius + 3}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={cornerRadius}
        style={{ filter: `drop-shadow(0px 0px 4px ${fill}66)` }}
      />
    </g>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard({ books, onEntityClick, myName }) {
  const stats = useBookAnalytics(books, myName || "ME");
  const [selectedMonthData, setSelectedMonthData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWeekData, setSelectedWeekData] = useState(null);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [hoveredGenre, setHoveredGenre] = useState(null);

  const handleWeekClick = (week) => {
    setSelectedWeekData(week);
    setIsWeekModalOpen(true);
  };

  const handleMonthClick = (data, arg2) => {
    let monthData = null;
    if (arg2?.payload?.name) monthData = arg2.payload;
    else if (data?.activePayload?.length > 0) monthData = data.activePayload[0].payload;
    else if (data?.payload) monthData = data.payload;
    else if (data?.name && data?.timestamp !== undefined) monthData = data;

    if (monthData) {
      setSelectedMonthData(monthData);
      setIsModalOpen(true);
    }
  };

  const openMonthModal = (monthData) => {
    setSelectedMonthData(monthData);
    setIsModalOpen(true);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div className="premium-dashboard" variants={containerVariants} initial="hidden" animate="visible">

      {/* ═══════ HERO HEADER ═══════ */}
      <motion.header className="dash-hero" variants={itemVariants}>
        <div className="dash-hero-content">
          <div className="dash-hero-text">
            <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
              Analytics Command Center
            </motion.h1>
            <motion.p initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
              Comprehensive insights into your book collection &amp; exchanges
            </motion.p>
            <StreakBadge streak={stats.readingStreak} booksPerMonth={stats.booksPerMonth} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <div style={{ width: '220px' }}>
              <ReadingGoalCard
                currentMonthRead={stats.currentMonthRead}
                goalTarget={stats.monthlyGoalTarget}
                progress={stats.readingGoalProgress}
                onClick={() => openMonthModal(stats.currentMonthReadingGoal)}
              />
            </div>
            <div className="dash-hero-progress">
              <CircularProgress
                value={stats.progress}
                size={160}
                strokeWidth={12}
                label={`${stats.progress}%`}
                sublabel="books read"
                delay={0.4}
              />
            </div>
          </div>
        </div>
        <div className="dash-hero-shine" />
      </motion.header>

      {/* ═══════ KPI STAT CARDS — ROW 1: Collection ═══════ */}
      <motion.div className="dash-stats-grid" variants={itemVariants}>
        <StatBox title="Total Books" value={stats.total - stats.wishlistCount} icon={Library} subtitle={`${(stats.myBooksCount - stats.lentToOthers) || 0} owned • ${stats.borrowedTotal || 0} borrowed`} theme="purple" delay={0} />
        <StatBox title="Wishlist" value={stats.wishlistCount} icon={Heart} subtitle="Books to acquire" theme="pink" delay={1} />
        <StatBox title="Net Spent" value={`₹${Math.round(stats.totalSpent).toLocaleString()}`} icon={Wallet} subtitle={`MRP: ₹${Math.round(stats.totalSpent + stats.totalSaved).toLocaleString()} · Saved ₹${Math.round(stats.totalSaved).toLocaleString()}`} theme="emerald" delay={2} />
        <StatBox title="Avg Cost/Book" value={`₹${stats.avgPrice}`} icon={Banknote} subtitle="Based on owned books" theme="blue" delay={3} />
        <StatBox title="Avg Discount" value={`${stats.avgDiscount}%`} icon={Percent} subtitle={`Total Saved: ₹${Math.round(stats.totalSaved).toLocaleString()}`} theme="indigo" delay={4} />
      </motion.div>

      {/* ═══════ KPI STAT CARDS — ROW 2: Reading Insights ═══════ */}
      <motion.div className="dash-stats-grid" variants={itemVariants}>
        <StatBox title="Total Pages" value={stats.totalPages} icon={BookMarked} subtitle={`${stats.totalPagesRead.toLocaleString()} pages read`} theme="teal" delay={0} />
        <StatBox title="Completion Rate" value={`${stats.overallCompletionRate}%`} icon={CheckCircle} subtitle={`${stats.read} of ${stats.read + stats.reading + stats.unread} books read`} theme="emerald" delay={1} />
        <StatBox title="Pages Read" value={stats.totalPagesRead.toLocaleString()} icon={BookOpen} subtitle={`Avg ${stats.avgPagesPerReadBook} pages/book`} theme="purple" delay={2} />
        {stats.longestBook && <StatBox title="Longest Book" value={`${stats.longestBook.pages} pgs`} icon={BookMarked} subtitle={stats.longestBook.title?.split('||')[0]?.trim() || stats.longestBook.title} theme="indigo" delay={3} />}
        {stats.shortestBook && <StatBox title="Shortest Book" value={`${stats.shortestBook.pages} pgs`} icon={BookMarked} subtitle={stats.shortestBook.title?.split('||')[0]?.trim() || stats.shortestBook.title} theme="orange" delay={4} />}
      </motion.div>

      {/* ═══════ READING PIPELINE + GOAL ═══════ */}
      <motion.div className="dash-pipeline-row" variants={itemVariants}>
        <motion.div className="dash-glass-card dash-pipeline-card" variants={itemVariants}>
          <div className="glass-card-header">
            <h3><BookOpen size={18} /> Reading Pipeline</h3>
          </div>
          <div className="pipeline-visual" style={{ paddingBlock: "8px", marginBlock: "-8px" }}>
            <motion.div className="pipeline-stage completed" whileHover={{ y: -4 }}>
              <div className="stage-header">
                <p>Completed</p>
                <ArrowUpRight size={20} className="stage-icon" />
              </div>
              <h4><AnimatedCounter value={stats.read} /></h4>
            </motion.div>
            <motion.div className="pipeline-stage in-progress" whileHover={{ y: -4 }}>
              <div className="stage-header">
                <p>Reading</p>
                <ArrowUpRight size={20} className="stage-icon" />
              </div>
              <h4><AnimatedCounter value={stats.reading} /></h4>
            </motion.div>
            <motion.div className="pipeline-stage not-started" whileHover={{ y: -4 }}>
              <div className="stage-header">
                <p>Unread</p>
                <ArrowUpRight size={20} className="stage-icon" />
              </div>
              <h4><AnimatedCounter value={stats.unread} /></h4>
            </motion.div>
          </div>

          {stats.borrowedTotal > 0 && (
            <div className="borrowed-sub-section">
              <h4 className="sub-section-title">Borrowed Books Status</h4>
              <StatusProgressGroup read={stats.borrowedRead} reading={stats.borrowedReading} unread={stats.borrowedUnread} total={stats.borrowedTotal} />
            </div>
          )}
          {stats.lentToOthers > 0 && (
            <div className="borrowed-sub-section" style={{ marginTop: "12px" }}>
              <h4 className="sub-section-title">Lent Books Status</h4>
              <StatusProgressGroup read={stats.lentRead} reading={stats.lentReading} unread={stats.lentUnread} total={stats.lentToOthers} />
            </div>
          )}
          {stats.myBooksCount > 0 && (
            <div className="borrowed-sub-section" style={{ marginTop: "12px" }}>
              <h4 className="sub-section-title">Own Books Status</h4>
              <StatusProgressGroup read={stats.ownRead} reading={stats.ownReading} unread={stats.ownUnread} total={stats.myBooksCount} />
            </div>
          )}
        </motion.div>

        {/* ═══════ EXCHANGE NETWORK ═══════ */}
        <motion.div className="dash-glass-card dash-exchange-section" variants={itemVariants}>
          <div className="glass-card-header">
            <h3><ArrowRightLeft size={18} /> Book Exchange Network</h3>
            <span className="header-badge">{stats.activeBooks} active</span>
          </div>
          <div className="exchange-cards-row">
            <ExchangeCard icon={BookDown} label="Borrowed" count={stats.borrowedTotal} variant="exchange-in" />
            <ExchangeCard icon={BookUp} label="Lent Out" count={stats.lentToOthers} variant="exchange-out" />
            <ExchangeCard icon={ArrowRightLeft} label="Re-lent" count={stats.reLent} variant="exchange-relay" />
          </div>
          <div className="exchange-people-grid">
            <div className="people-column">
              <h4><UserCheck size={14} /> Top Lenders ({stats.lendersCount})</h4>
              {stats.topLenders.length === 0 ? (
                <p className="no-data-text">No borrowing data</p>
              ) : (
                stats.topLenders.slice(0, 3).map((l, i) => (
                  <motion.div key={l.name} className="person-entry" onClick={() => onEntityClick && onEntityClick(l, "lender")} whileHover={{ x: 4 }} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                      <span className="person-rank-badge">{i + 1}</span>
                      <span className="person-name-text" style={{ flex: 1 }}>{l.name}</span>
                      <span className="person-count-badge">{l.value} books</span>
                    </div>
                    <StatusProgressGroup read={l.read || 0} reading={l.reading || 0} unread={l.unread || 0} total={l.value} compact={true} />
                  </motion.div>
                ))
              )}
            </div>
            <div className="people-column">
              <h4><Users size={14} /> Top Borrowers ({stats.borrowersCount})</h4>
              {stats.topBorrowers.length === 0 ? (
                <p className="no-data-text">No lending data</p>
              ) : (
                stats.topBorrowers.slice(0, 3).map((b, i) => (
                  <motion.div key={b.name} className="person-entry" onClick={() => onEntityClick && onEntityClick(b, "borrower")} whileHover={{ x: 4 }} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                      <span className="person-rank-badge">{i + 1}</span>
                      <span className="person-name-text" style={{ flex: 1 }}>{b.name}</span>
                      <span className="person-count-badge">{b.value} books</span>
                    </div>
                    <StatusProgressGroup read={b.read || 0} reading={b.reading || 0} unread={b.unread || 0} total={b.value} compact={true} />
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══════ MONTHLY SNAPSHOT CARDS ═══════ */}
      {stats.monthlySnapshot && stats.monthlySnapshot.length > 0 && (
        <motion.div className="dash-glass-card" variants={itemVariants} style={{ padding: "20px 24px" }}>
          <div className="glass-card-header" style={{ marginBottom: "16px" }}>
            <div>
              <h3><Calendar size={18} /> Monthly Snapshot</h3>
              <p>Click any month to see detailed breakdown — most recent first</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "14px", overflowX: "auto", paddingBottom: "8px" }}>
            {stats.monthlySnapshot.map((ms) => (
              <MonthSnapshotCard key={ms.name + ms.timestamp} data={ms} onClick={openMonthModal} />
            ))}
          </div>
        </motion.div>
      )}

      {/* ═══════ TOP MONTHS ═══════ */}
      {(stats.topMonthByBought || stats.topMonthByRead || stats.topMonthBySpent) && (
        <motion.div variants={itemVariants} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
          {stats.topMonthByBought && (
            <motion.div className="dash-glass-card" whileHover={{ y: -4, scale: 1.01 }} onClick={() => openMonthModal(stats.topMonthByBought)} style={{ cursor: "pointer", padding: "20px" }}>
              <p className="dash-text-purple" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", display: 'flex', alignItems: 'center', gap: '4px' }}><Trophy size={14} /> Most Books Bought</p>
              <h3 className="dash-text-primary" style={{ fontSize: "22px", fontWeight: 800 }}>{stats.topMonthByBought.name}</h3>
              <p className="dash-text-muted" style={{ fontSize: "13px", marginTop: "4px" }}>{stats.topMonthByBought.bought} books · ₹{Math.round(stats.topMonthByBought.boughtSpent || 0).toLocaleString()} spent</p>
            </motion.div>
          )}
          {stats.topMonthByRead && (
            <motion.div className="dash-glass-card" whileHover={{ y: -4, scale: 1.01 }} onClick={() => openMonthModal(stats.topMonthByRead)} style={{ cursor: "pointer", padding: "20px" }}>
              <p className="dash-text-emerald" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px", display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14} /> Most Books Read</p>
              <h3 className="dash-text-primary" style={{ fontSize: "22px", fontWeight: 800 }}>{stats.topMonthByRead.name}</h3>
              <p className="dash-text-muted" style={{ fontSize: "13px", marginTop: "4px" }}>{stats.topMonthByRead.read} books completed</p>
            </motion.div>
          )}
          {stats.topMonthBySpent && (
            <motion.div className="dash-glass-card" whileHover={{ y: -4, scale: 1.01 }} onClick={() => openMonthModal(stats.topMonthBySpent)} style={{ cursor: "pointer", padding: "20px" }}>
              <p className="dash-text-red" style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>💸 Highest Spending Month</p>
              <h3 className="dash-text-primary" style={{ fontSize: "22px", fontWeight: 800 }}>{stats.topMonthBySpent.name}</h3>
              <p className="dash-text-muted" style={{ fontSize: "13px", marginTop: "4px" }}>₹{Math.round(stats.topMonthBySpent.spent || 0).toLocaleString()} · {stats.topMonthBySpent.bought} books</p>
            </motion.div>
          )}
        </motion.div>
      )}



      {/* ═══════ READING ACTIVITY (MERGED CHART & HEATMAP) ═══════ */}
      <motion.div variants={itemVariants} style={{ marginBottom: '24px' }}>
        <ReadingActivityChart weeklyData={stats.weeklyHeatmap} onWeekClick={handleWeekClick} />
      </motion.div>

      {/* ═══════ COMPREHENSIVE MONTHLY ACTIVITY (MERGED) ═══════ */}
      <motion.div 
        className="dash-glass-card dash-chart-card" 
        variants={itemVariants}
        whileHover={{ boxShadow: "0 20px 40px rgba(0,0,0,0.12)" }}
        transition={{ duration: 0.3 }}
        style={{ overflow: 'hidden', position: 'relative' }}
      >
        <div className="glass-card-header" style={{ borderBottom: '1px solid var(--dash-grid)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', background: 'linear-gradient(90deg, var(--indigo-color), var(--purple-color))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              <Calendar size={20} color="var(--indigo-color)" /> 
              Comprehensive Monthly Activity
            </h3>
            <p style={{ marginTop: '4px', fontSize: '13px' }}>Bought, Borrowed, Lent, & Re-lent breakdown with Spending Trend</p>
          </div>
        </div>
        <div className="chart-container" style={{ height: "400px", padding: "10px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats.monthlyData} margin={{ top: 10, right: 50, left: -15, bottom: 10 }} onClick={handleMonthClick} style={{ cursor: "pointer" }}>
              <defs>
                <linearGradient id="spentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--red-color)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--red-color)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dash-grid)" opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--dash-text-primary)", fontSize: 13, fontWeight: 600 }} dy={10} tickFormatter={(val) => val.toUpperCase()} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: "var(--dash-text-muted)", fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "var(--dash-text-muted)", fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "var(--dash-bg)", opacity: 0.4 }} />
              <Legend verticalAlign="top" height={50} iconType="circle" wrapperStyle={{ fontSize: "12px", fontWeight: 500, paddingBottom: '10px' }} />

              {/* Stacked: Bought */}
              <Bar yAxisId="left" dataKey="boughtRead" stackId="bought" fill="var(--emerald-color)" name="Bought (Read)" barSize={14} animationDuration={1500} />
              <Bar yAxisId="left" dataKey="boughtReading" stackId="bought" fill="var(--amber-color)" name="Bought (Reading)" animationDuration={1500} />
              <Bar yAxisId="left" dataKey="boughtUnread" stackId="bought" fill="var(--purple-color)" name="Bought (Unread)" radius={[4, 4, 0, 0]} animationDuration={1500} />

              {/* Stacked: Borrowed */}
              <Bar yAxisId="left" dataKey="borrowedRead" stackId="borrowed" fill="var(--teal-color)" name="Borrowed (Read)" barSize={14} animationDuration={1500} />
              <Bar yAxisId="left" dataKey="borrowedReading" stackId="borrowed" fill="var(--orange-color)" name="Borrowed (Reading)" animationDuration={1500} />
              <Bar yAxisId="left" dataKey="borrowedUnread" stackId="borrowed" fill="var(--blue-color)" name="Borrowed (Unread)" radius={[4, 4, 0, 0]} animationDuration={1500} />

              {/* Stacked: Lent */}
              <Bar yAxisId="left" dataKey="lentRead" stackId="lent" fill="#10b981" name="Lent (Read)" barSize={14} animationDuration={1500} />
              <Bar yAxisId="left" dataKey="lentReading" stackId="lent" fill="#f59e0b" name="Lent (Reading)" animationDuration={1500} />
              <Bar yAxisId="left" dataKey="lentUnread" stackId="lent" fill="#8b5cf6" name="Lent (Unread)" radius={[4, 4, 0, 0]} animationDuration={1500} />

              {/* Stacked: Re-Lent */}
              <Bar yAxisId="left" dataKey="reLentRead" stackId="relent" fill="#ef4444" name="Re-lent (Read)" barSize={14} animationDuration={1500} />
              <Bar yAxisId="left" dataKey="reLentReading" stackId="relent" fill="#f97316" name="Re-lent (Reading)" animationDuration={1500} />
              <Bar yAxisId="left" dataKey="reLentUnread" stackId="relent" fill="#f43f5e" name="Re-lent (Unread)" radius={[4, 4, 0, 0]} animationDuration={1500} />

              {/* Spending line (Area + Line for modern look) */}
              <Area yAxisId="right" type="monotone" dataKey="boughtSpent" fill="url(#spentGradient)" stroke="none" animationDuration={2000} />
              <Line yAxisId="right" type="monotone" dataKey="boughtSpent" name="Spent (₹)" stroke="var(--red-color)" strokeWidth={3} dot={{ r: 4, fill: "var(--dash-card)", stroke: "var(--red-color)", strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 0, fill: "var(--red-color)" }} animationDuration={2000} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ═══════ LEADERBOARDS + PUBLISHER DISCOUNT ═══════ */}
      <motion.div className="dash-leaderboards-grid" variants={itemVariants}>
        <MiniLeaderboard onEntityClick={onEntityClick} title="Top Authors" data={stats.topAuthors} icon={Award} color="var(--indigo-color)" entityType="author" />
        <MiniLeaderboard onEntityClick={onEntityClick} title="Top Publishers" data={stats.topPublishers} icon={BookMarked} color="var(--emerald-color)" entityType="publisher" />
        <MiniLeaderboard onEntityClick={onEntityClick} title="Top Lenders" data={stats.topLenders} icon={UserCheck} color="var(--amber-color)" entityType="lender" />
        <MiniLeaderboard onEntityClick={onEntityClick} title="Top Borrowers" data={stats.topBorrowers} icon={Users} color="var(--red-color)" entityType="borrower" />
        <MiniLeaderboard onEntityClick={onEntityClick} title="Top Genres" data={stats.topGenres} icon={Tag} color="var(--pink-color)" entityType="genre" />
        <MiniLeaderboard onEntityClick={onEntityClick} title="Top Re-Lenders" data={stats.topReLenders} icon={ArrowRightLeft} color="var(--purple-color)" entityType="reLender" />
      </motion.div>

      {/* ═══════ PUBLISHER DISCOUNT LEADERBOARD ═══════ */}
      {stats.publisherDiscountLeaderboard?.length > 0 && (
        <motion.div className="dash-glass-card" variants={itemVariants} style={{ padding: "20px 24px" }}>
          <div className="glass-card-header" style={{ marginBottom: "8px" }}>
            <div>
              <h3><TrendingDown size={18} /> Publisher Discount Leaderboard</h3>
              <p>Which publishers give you the best deals on average</p>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0 32px" }}>
            {stats.publisherDiscountLeaderboard.map((item, i) => (
              <PublisherDiscountRow key={item.name} item={item} index={i} />
            ))}
          </div>
        </motion.div>
      )}



      {/* ═══════ CHARTS ROW ═══════ */}

      <motion.div className="dash-charts-row" variants={itemVariants}>
        {/* Genre Distribution Donut */}
        <motion.div className="dash-glass-card dash-chart-card" variants={itemVariants}>
          <div className="glass-card-header">
            <div>
              <h3><PieIcon size={18} /> Genre Distribution</h3>
              <p>{stats.topGenres.length} genres in your collection</p>
            </div>
          </div>
          <div className="chart-container" style={{ height: "380px", position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%" style={{ zIndex: 1, position: 'relative' }}>
              <PieChart margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                {/* Center Dynamic Text */}
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>
                  <tspan x="50%" dy="-6" fontSize="26px" fill="var(--dash-text-primary)" fontWeight="800">
                    {hoveredGenre !== null ? stats.topGenres[hoveredGenre].value : stats.topGenres.length}
                  </tspan>
                  <tspan x="50%" dy="22" fontSize="12px" fill="var(--dash-text-secondary)" fontWeight="600" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {hoveredGenre !== null ? (stats.topGenres[hoveredGenre].name.length > 12 ? stats.topGenres[hoveredGenre].name.substring(0, 10) + '..' : stats.topGenres[hoveredGenre].name) : "Genres"}
                  </tspan>
                </text>

                {/* Thick inner pills with low opacity */}
                <Pie
                  data={stats.topGenres} cx="50%" cy="50%"
                  innerRadius={78} outerRadius={106}
                  paddingAngle={2} cornerRadius={12} stroke="var(--dash-card)" strokeWidth={3}
                  dataKey="value" nameKey="name"
                  isAnimationActive={false}
                  onMouseEnter={(_, index) => setHoveredGenre(index)}
                  onMouseLeave={() => setHoveredGenre(null)}
                  onClick={(data, index) => {
                    const entry = stats.topGenres?.[index];
                    if (entry?.name && onEntityClick) onEntityClick(entry, "genre");
                  }}
                  style={{ cursor: onEntityClick ? "pointer" : "default", outline: "none" }}
                >
                  {stats.topGenres.map((entry, index) => (
                    <Cell
                      key={`cell-inner-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      fillOpacity={hoveredGenre === index ? 0.7 : "var(--chart-pill-opacity)"}
                      style={{
                        outline: "none",
                        transition: 'fill-opacity 0.2s ease',
                        filter: hoveredGenre === index ? `drop-shadow(0 0 6px ${CHART_COLORS[index % CHART_COLORS.length]}40)` : 'none'
                      }}
                    />
                  ))}
                </Pie>
                {/* Thin outer ring with glow */}
                <Pie
                  data={stats.topGenres} cx="50%" cy="50%"
                  innerRadius={106} outerRadius={110}
                  paddingAngle={2} cornerRadius={12} stroke="var(--dash-card)" strokeWidth={2}
                  dataKey="value" nameKey="name"
                  labelLine={false}
                  isAnimationActive={false}
                  label={CustomPieLabel}
                  activeIndex={hoveredGenre !== null ? hoveredGenre : -1}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, index) => setHoveredGenre(index)}
                  onMouseLeave={() => setHoveredGenre(null)}
                  style={{ pointerEvents: 'none', outline: "none" }}
                >
                  {stats.topGenres.map((entry, index) => (
                    <Cell
                      key={`cell-outer-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                      style={{
                        outline: "none",
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        filter: hoveredGenre === index ? `drop-shadow(0 0 8px ${CHART_COLORS[index % CHART_COLORS.length]}80)` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))'
                      }}
                    />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Monthly Status Breakdown Bar */}
        <motion.div className="dash-glass-card dash-chart-card" variants={itemVariants}>
          <div className="glass-card-header">
            <div>
              <h3><BarChart3 size={18} /> Monthly Status Breakdown</h3>
              <p>Reading activity per month — click to drill in</p>
            </div>
          </div>
          <div className="chart-container" style={{ height: "320px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={stats.monthlyData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                barSize={20}
                onClick={handleMonthClick}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--dash-grid)" opacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--dash-text-primary)", fontSize: 12, fontWeight: 600 }} tickFormatter={(val) => val.toUpperCase()} dy={10} />
                <YAxis yAxisId="left" orientation="left" hide={true} />
                <YAxis yAxisId="right" orientation="right" hide={true} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "var(--dash-bg)", opacity: 0.5 }} />
                <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ fontSize: "13px", fontWeight: 500 }} />
                
                <Bar yAxisId="left" dataKey="read" name="Read" fill="var(--emerald-color)" radius={[4, 4, 0, 0]} onClick={handleMonthClick} cursor="pointer" animationDuration={1500} />
                <Bar yAxisId="left" dataKey="bought" name="Bought" fill="var(--purple-color)" radius={[4, 4, 0, 0]} onClick={handleMonthClick} cursor="pointer" animationDuration={1500} />
                
                <Line yAxisId="right" type="monotone" dataKey="boughtSpent" name="Spent (₹)" stroke="var(--red-color)" strokeWidth={3} dot={{ r: 4, fill: "var(--dash-card)", stroke: "var(--red-color)", strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 0, fill: "var(--red-color)" }} animationDuration={2000} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </motion.div>

      {/* ═══════ FAVORITES SUMMARY ═══════ */}
      <motion.div className="dash-favorites-row" variants={itemVariants}>
        <motion.div className="dash-fav-card" whileHover={{ y: -4 }}>
          <div className="fav-icon-wrap fav-genre"><Star size={22} /></div>
          <div className="fav-info"><span className="fav-label">Favorite Genre</span><strong className="fav-value">{stats.favoriteGenre}</strong></div>
        </motion.div>
        <motion.div className="dash-fav-card" whileHover={{ y: -4 }}>
          <div className="fav-icon-wrap fav-author"><Award size={22} /></div>
          <div className="fav-info"><span className="fav-label">Top Author</span><strong className="fav-value">{stats.topAuthor}</strong></div>
        </motion.div>
        <motion.div className="dash-fav-card" whileHover={{ y: -4 }}>
          <div className="fav-icon-wrap fav-publisher"><BookMarked size={22} /></div>
          <div className="fav-info"><span className="fav-label">Top Publisher</span><strong className="fav-value">{stats.topPublisher}</strong></div>
        </motion.div>
        <motion.div className="dash-fav-card" whileHover={{ y: -4 }}>
          <div className="fav-icon-wrap fav-year"><TrendingUp size={22} /></div>
          <div className="fav-info"><span className="fav-label">Read This Year</span><strong className="fav-value">{stats.thisYearRead} books</strong></div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <MonthlyDetailsModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            monthData={selectedMonthData}
          />
        )}
        {isWeekModalOpen && (
          <WeeklyDetailsModal
            isOpen={isWeekModalOpen}
            onClose={() => setIsWeekModalOpen(false)}
            weekData={selectedWeekData}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}