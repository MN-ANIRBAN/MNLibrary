import React, { useEffect, useRef, useState, useId } from "react";
import { motion, useInView } from "framer-motion";
import { Flame, Book, BarChart2, Trophy, Calendar, Package, RefreshCw, DollarSign, Tag, BookOpen, Activity, ArrowRightLeft } from "lucide-react";

/* ─── Animated Counter ─── */
export const AnimatedCounter = ({ value, duration = 1.5, prefix = "", suffix = "" }) => {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const frameRef = useRef(null);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) || 0 : value;

  useEffect(() => {
    if (!isInView) return;

    const start = displayRef.current;
    const end = numericValue;
    if (start === end) return;

    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    if (end === 0) {
      displayRef.current = 0;
      setDisplay(0);
      return;
    }

    const startTime = performance.now();
    const step = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (end - start) * eased);
      displayRef.current = current;
      setDisplay(current);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        displayRef.current = end;
        setDisplay(end);
        frameRef.current = null;
      }
    };
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [isInView, numericValue, duration]);

  return <span ref={ref}>{prefix}{display.toLocaleString()}{suffix}</span>;
};

/* ─── Circular Progress Ring ─── */
export const CircularProgress = ({
  value = 0,
  size = 140,
  strokeWidth = 10,
  color = "url(#progressGradient)",
  trackColor = "var(--dash-border)",
  label = "",
  sublabel = "",
  delay = 0.3
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const gradientId = useId();

  return (
    <div className="circular-progress-wrapper">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="circular-progress-svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a3e635" />
            <stop offset="50%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="progressGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
          opacity="0.7"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color === "url(#progressGradient)" ? `url(#${gradientId})` : color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, delay, ease: [0.4, 0, 0.2, 1] }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter="url(#progressGlow)"
        />
      </svg>
      <div className="circular-progress-content">
        <span className="circular-progress-value">{label}</span>
        {sublabel && <span className="circular-progress-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
};

/* ─── Stat Box (Premium Glassmorphic) ─── */
export const StatBox = ({ title, value, icon: Icon, subtitle, theme, delay = 0 }) => (
  <motion.div
    className="dash-stat-card-wrapper"
    initial={{ opacity: 0, y: 30 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: delay * 0.1 }}
    whileHover={{ y: -6, transition: { duration: 0.25 } }}
  >
    <div className={`dash-stat-card ${theme}`}>
      <div className="dsc-header">
        <span className="dsc-title">{title}</span>
      </div>
      <div className="dsc-body">
        <h3 className="dsc-value">
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} />
          ) : (
            value
          )}
        </h3>
        <span className="dsc-subtitle">{subtitle}</span>
      </div>
      <div className="dsc-footer">
        <div className={`dsc-icon-pill ${theme}-icon`}>
          <Icon size={14} />
        </div>
      </div>
    </div>

    <button className="dsc-action-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7"></line>
        <polyline points="7 7 17 7 17 17"></polyline>
      </svg>
    </button>
  </motion.div>
);

/* ─── Mini Leaderboard (Enhanced) ─── */
export const MiniLeaderboard = ({ title, data, icon: Icon, color, entityType, onEntityClick }) => {
  const rankStyles = ['rank-gold', 'rank-silver', 'rank-bronze'];

  return (
    <motion.div
      className="dash-leaderboard-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="leaderboard-card-header">
        <h3>{title}</h3>
        <div className="leaderboard-icon-wrap" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div className="leaderboard-entries">
        {data.length === 0 ? (
          <p className="no-data-text">No data available</p>
        ) : (
          data.map((item, idx) => (
            <motion.div
              key={item.name}
              className="leaderboard-entry"
              onClick={() => onEntityClick && onEntityClick(item, entityType)}
              title={`Click to see all books from ${item.name}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onEntityClick && onEntityClick(item, entityType);
                }
              }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
            >
              <span className={`entry-rank ${idx < 3 ? rankStyles[idx] : ''}`}>
                {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
              </span>
              <span className="entry-name" title={item.name}>{item.name}</span>
              <div className="entry-bar-track">
                <motion.div
                  className="entry-bar-fill"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${data[0]?.value ? (item.value / data[0].value) * 100 : 0}%` }}
                  transition={{ duration: 1, delay: 0.3 + idx * 0.1, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
              <span className="entry-count">{item.value}</span>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

/* ─── Reading Goal Card — Circular Full Card Water Tank ─── */
export const ReadingGoalCard = ({ currentMonthRead, goalTarget, progress, onClick, size = 220 }) => {
  const fluidFilterId = useId().replace(/:/g, "");
  const clampedProgress = Math.min(Math.max(progress || 0, 0), 100);
  // Visually balance the water layer since the surface wave adds extra height.
  const fillPercent = clampedProgress === 0 ? 8 : `calc(${clampedProgress}% - 24px)`;
  const fillKey = `${currentMonthRead}-${clampedProgress}`;

  const getWaterColor = () => {
    // Blue water
    return { top: "#60a5fa", bot: "#3b82f6", deep: "#2563eb" };
  };
  const wColor = getWaterColor();

  const wavePathA = "M0 24 C 120 44, 240 4, 360 24 C 480 44, 600 4, 720 24 C 840 44, 960 4, 1080 24 C 1140 34, 1170 14, 1200 24 L 1200 60 L 0 60 Z";
  const wavePathB = "M0 28 C 100 8, 200 48, 300 28 C 400 8, 500 48, 600 28 C 700 8, 800 48, 900 28 C 1000 8, 1100 48, 1200 28 L 1200 60 L 0 60 Z";
  const wavePathC = "M0 26 C 80 38, 160 14, 240 26 C 320 38, 400 14, 480 26 C 560 38, 640 14, 720 26 C 800 38, 880 14, 960 26 C 1040 38, 1120 14, 1200 26 L 1200 60 L 0 60 Z";

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedProgress / 100) * circumference;

  return (
    <motion.div
      className="dash-goal-circular-wrapper"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: "spring" }}
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Outer Progress Ring */}
      <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0, zIndex: 2, pointerEvents: 'none' }}>
        <defs>
          <pattern id={`diagonalHatch-${fluidFilterId}`} width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--dash-text-muted)" strokeWidth="1.2" opacity="0.3" />
          </pattern>
          <filter id={`glow-${fluidFilterId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={`url(#diagonalHatch-${fluidFilterId})`}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#39ff14"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          filter={`url(#glow-${fluidFilterId})`}
        />
      </svg>

      {/* Inner Water Card */}
      <div
        className="dash-goal-card full-water-card circular-water-card"
        onClick={onClick}
        style={{
          width: size - (strokeWidth * 2) - 16,
          height: size - (strokeWidth * 2) - 16,
          borderRadius: "50%",
          cursor: onClick ? "pointer" : "default",
          position: "relative",
          zIndex: 1,
          boxShadow: 'var(--dash-shadow-lg)',
          minHeight: 'auto'
        }}
      >
        {/* Background Water Layer */}
        <div className="full-water-bg" style={{ borderRadius: '50%' }}>
          <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
            <defs>
              <filter id={`fluid-goo-${fluidFilterId}`}>
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -6" result="fluid-goo" />
                <feComposite in="SourceGraphic" in2="fluid-goo" operator="atop" />
              </filter>
            </defs>
          </svg>

          <motion.div
            key={fillKey}
            className="full-water-fill"
            initial={{ height: "0%" }}
            animate={{ height: fillPercent }}
            transition={{ duration: 1.2, ease: [0.3, 0, 0.2, 1] }}
            style={{
              background: `linear-gradient(180deg, ${wColor.top} 0%, ${wColor.bot} 55%, ${wColor.deep} 100%)`,
              borderRadius: '0 0 50% 50%'
            }}
          >
            <div className="full-water-shimmer" aria-hidden="true" />
            <div
              className="full-water-surface"
              style={{ filter: `url(#fluid-goo-${fluidFilterId})` }}
              aria-hidden="true"
            >
              <div className="full-water-wave-layer full-water-wave-back">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none">
                  <path d={wavePathA} fill={`${wColor.deep}66`} />
                </svg>
              </div>
              <div className="full-water-wave-layer full-water-wave-mid">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none">
                  <path d={wavePathB} fill={`${wColor.bot}99`} />
                </svg>
              </div>
              <div className="full-water-wave-layer full-water-wave-front">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none">
                  <path d={wavePathC} fill={`${wColor.top}cc`} />
                </svg>
              </div>
              <div className="full-water-wave-layer full-water-wave-highlight">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none">
                  <path d={wavePathC} fill="rgba(255,255,255,0.15)" />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Foreground Content */}
        <div className="full-water-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '16px', color: 'var(--dash-text-primary)' }}>
          <div className="fw-header" style={{ marginBottom: '4px', zIndex: 10 }}>
            <div className="fw-title" style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', opacity: 0.9, background: 'var(--dash-hover-bg)', padding: '4px 10px', borderRadius: '16px', backdropFilter: 'blur(4px)', color: 'var(--dash-text-primary)', border: '1px solid var(--dash-border-glass)' }}>
              MONTHLY READING<br />GOAL
            </div>
          </div>
          <div className="fw-main-stats" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0px', margin: '4px 0', zIndex: 10 }}>
            <span className="fw-current" style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1, letterSpacing: '-1.5px', textShadow: '0 2px 10px rgba(0,0,0,0.15), 0 0 20px var(--dash-bg)', color: 'var(--dash-text-primary)' }}>
              <AnimatedCounter value={currentMonthRead} duration={2} />
            </span>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'baseline', opacity: 0.9 }}>
              <span className="fw-unit" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dash-text-secondary)', textShadow: '0 1px 4px var(--dash-bg)' }}>books</span>
              <span className="fw-slash" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--dash-text-secondary)', textShadow: '0 1px 4px var(--dash-bg)' }}>/ {goalTarget}</span>
            </div>
          </div>
          <div className="fw-footer" style={{ marginTop: 'auto', zIndex: 10, paddingBottom: '8px' }}>
            <span style={{ fontSize: "14px", fontWeight: "800", color: 'var(--dash-text-primary)', textShadow: '0 1px 4px var(--dash-bg)' }}>
              {clampedProgress}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Heatmap Card (GitHub-style) ─── */
export const HeatmapCard = ({ weeklyData, onWeekClick }) => {
  // Group by months for labels
  const monthLabels = [];
  let lastMonth = '';
  weeklyData.forEach((w, i) => {
    if (w.monthLabel !== lastMonth) {
      monthLabels.push({ label: w.monthLabel, index: i });
      lastMonth = w.monthLabel;
    }
  });

  const getIntensityClass = (count) => {
    if (count === 0) return 'heat-0';
    if (count === 1) return 'heat-1';
    if (count === 2) return 'heat-2';
    if (count <= 4) return 'heat-3';
    return 'heat-4';
  };

  return (
    <motion.div
      className="dash-heatmap-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="heatmap-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} className="dash-text-purple" /> Reading Activity</h3>
        <p>Last 52 weeks</p>
      </div>
      <div className="heatmap-month-labels">
        {monthLabels.map((m, i) => (
          <span
            key={i}
            className="heatmap-month"
            style={{ gridColumnStart: m.index + 1 }}
          >
            {m.label}
          </span>
        ))}
      </div>
      <div className="heatmap-grid">
        {weeklyData.map((w, i) => (
          <motion.div
            key={w.week}
            className={`heatmap-cell ${getIntensityClass(w.readCount || 0)}`}
            title={`Week of ${w.week}: ${w.readCount || 0} book${w.readCount !== 1 ? 's' : ''} read`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.008, duration: 0.2 }}
            onClick={() => onWeekClick && onWeekClick(w)}
            style={{ cursor: onWeekClick ? 'pointer' : 'default' }}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        <div className="heatmap-cell heat-0 legend-cell" />
        <div className="heatmap-cell heat-1 legend-cell" />
        <div className="heatmap-cell heat-2 legend-cell" />
        <div className="heatmap-cell heat-3 legend-cell" />
        <div className="heatmap-cell heat-4 legend-cell" />
        <span>More</span>
      </div>
    </motion.div>
  );
};

/* ─── Status Progress Group (Ref 1 Design) ─── */
export const StatusProgressGroup = ({ read, reading, unread, total, compact = false }) => {
  if (total === 0) return <p className="no-data-text" style={{ margin: 0, padding: '12px 0' }}>No books</p>;

  const rPct = Math.round((read / total) * 100);
  const mPct = Math.round((reading / total) * 100);
  const uPct = 100 - rPct - mPct;

  const renderBar = (pct, theme, label, count) => (
    <div className="dash-sp-block">
      {!compact && (
        <div className="dash-sp-bar-header">
          <span style={{ opacity: pct < 15 ? 0 : 1, transition: 'opacity 0.2s' }}>0%</span>
          <div className="dash-sp-arrow" style={{ left: `${pct}%` }}>▼</div>
          <span style={{ opacity: pct > 85 ? 0 : 1, transition: 'opacity 0.2s' }}>100%</span>
        </div>
      )}
      <div className={`dash-sp-bar-container ${theme}`}>
        <div className="dash-sp-bar-left" style={{ width: `calc(${pct}% - 2px)` }} />
        <div className="dash-sp-bar-right" style={{ width: `calc(${100 - pct}% - 2px)` }} />
      </div>
      <div className="dash-sp-stats">
        <h3>{pct}%</h3>
        <p>{count} {label}</p>
      </div>
    </div>
  );

  return (
    <div className={`dash-sp-group ${compact ? 'compact' : ''}`}>
      {renderBar(rPct, 'theme-read', 'Read', read)}
      {renderBar(mPct, 'theme-reading', 'Reading', reading)}
      {renderBar(uPct, 'theme-unread', 'Unread', unread)}
    </div>
  );
};

/* ─── Exchange Card ─── */
export const ExchangeCard = ({ icon: Icon, label, count, variant }) => {
  let headerClass = "";
  if (variant === "exchange-in") headerClass = "completed";
  else if (variant === "exchange-out") headerClass = "in-progress";
  else if (variant === "exchange-relay") headerClass = "not-started";

  return (
    <motion.div
      className="dash-glass-card"
      whileHover={{ y: -4 }}
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, padding: 0 }}
    >
      <div className={`pipeline-stage ${headerClass}`} style={{ padding: '16px', borderRadius: 0, boxShadow: 'none', border: 'none', borderBottom: '1px solid rgba(0,0,0,0.05)', flex: 'none' }}>
        <div className="stage-header" style={{ marginBottom: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: 600 }}>{label}</p>
          <div style={{ background: 'var(--exchange-icon-bg)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} className="stage-icon" style={{ opacity: 1, color: 'var(--dash-text-primary)' }} />
          </div>
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <p className="dash-text-muted" style={{ fontSize: '12px', margin: '0 0 8px 0', fontWeight: 500 }}>Total Books</p>
        <h4 className="dash-text-primary" style={{ margin: 0, fontSize: '32px', fontWeight: 700, lineHeight: 1 }}><AnimatedCounter value={count} /></h4>
      </div>
    </motion.div>
  );
};

/* ─── Streak Badge ─── */
export const StreakBadge = ({ streak, booksPerMonth }) => (
  <div className="streak-badge-group">
    <motion.div
      className="streak-badge"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
    >
      <Flame size={20} className="streak-fire dash-text-amber" />
      <div>
        <span className="streak-count">{streak}</span>
        <span className="streak-label">month streak</span>
      </div>
    </motion.div>
    <motion.div
      className="streak-badge pace-badge"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 200, delay: 0.7 }}
    >
      <Book size={20} className="streak-fire dash-text-blue" />
      <div>
        <span className="streak-count">{booksPerMonth}</span>
        <span className="streak-label">books/month avg</span>
      </div>
    </motion.div>
  </div>
);

/* ─── Monthly Details Modal ─── */
export const MonthlyDetailsModal = ({ isOpen, onClose, monthData }) => {
  const isReadingGoalView = monthData?._view === "readingGoal";
  const [activeTab, setActiveTab] = useState(isReadingGoalView ? "finished" : "bought");

  useEffect(() => {
    setActiveTab(isReadingGoalView ? "finished" : "bought");
  }, [monthData, isReadingGoalView]);

  if (!isOpen || !monthData) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const md = monthData;

  // Stats derived
  const totalBooksThisMonth = (md.bought || 0) + (md.borrowed || 0);
  const totalRead = (md.boughtRead || 0) + (md.borrowedRead || 0);
  const readPct = totalBooksThisMonth > 0 ? Math.round((totalRead / totalBooksThisMonth) * 100) : 0;
  const mrp = md.boughtMrp || 0;
  const spent = md.boughtSpent || 0;
  const saved = md.boughtSaved || 0;
  const savedPct = mrp > 0 ? ((saved / mrp) * 100).toFixed(1) : 0;

  const tabs = isReadingGoalView
    ? [{ id: 'finished', label: 'Finished', icon: <BookOpen size={16} />, count: md.readBooks?.length || 0 }]
    : [
      { id: 'bought', label: 'Bought', icon: <Package size={16} />, count: md.boughtBooks?.length || 0 },
      { id: 'borrowed', label: 'Borrowed', icon: <Book size={16} />, count: md.borrowedBooks?.length || 0 },
      { id: 'pipeline', label: 'Pipeline', icon: <RefreshCw size={16} />, count: null },
      { id: 'exchange', label: 'Exchange', icon: <ArrowRightLeft size={16} />, count: null },
      { id: 'spending', label: 'Spending', icon: <DollarSign size={16} />, count: null },
    ];

  const statusColor = (status) => {
    if (status === 'read') return { color: 'var(--emerald-color)', bg: 'var(--emerald-bg)', label: 'Read' };
    if (status === 'reading') return { color: 'var(--amber-color)', bg: 'var(--amber-bg)', label: 'Reading' };
    return { color: 'var(--indigo-color)', bg: 'var(--indigo-bg)', label: 'Unread' };
  };

  // Pipeline stacked bar
  const PipelineBar = ({ label, color, read, readingVal, unread, total }) => {
    if (total === 0) return (
      <div className="dm-pipeline-empty">
        <span>{label}</span>
        <span>No data</span>
      </div>
    );
    const rPct = Math.round((read / total) * 100);
    const mPct = Math.round((readingVal / total) * 100);
    const uPct = 100 - rPct - mPct;
    return (
      <div className="dm-pipeline-block">
        <div className="dm-pipeline-label-row">
          <span className="dm-pipeline-name" style={{ color }}>{label}</span>
          <span className="dm-pipeline-total">{total} books</span>
        </div>
        <div className="dm-pipeline-bar-track">
          <div className="dm-pipeline-seg dm-seg-read" style={{ width: `${rPct}%` }} />
          <div className="dm-pipeline-seg dm-seg-reading" style={{ width: `${mPct}%` }} />
          <div className="dm-pipeline-seg dm-seg-unread" style={{ width: `${uPct}%` }} />
        </div>
        <div className="dm-pipeline-legend">
          <span className="dm-legend-chip dm-lc-read">✓ {read} read</span>
          <span className="dm-legend-chip dm-lc-reading">⋯ {readingVal} reading</span>
          <span className="dm-legend-chip dm-lc-unread">○ {unread} unread</span>
        </div>
      </div>
    );
  };

  // Spending stat row
  const SpendRow = ({ label, value, sub, accent, large }) => (
    <div className={`dm-spend-row${large ? ' dm-spend-row--large' : ''}`}>
      <span className="dm-spend-label">{label}</span>
      <div className="dm-spend-value-group">
        <span className="dm-spend-value" style={{ color: accent }}>{value}</span>
        {sub && <span className="dm-spend-sub">{sub}</span>}
      </div>
    </div>
  );

  const renderTab = () => {
    if (activeTab === 'finished') {
      const books = md.readBooks || [];
      if (books.length === 0) return (
        <div className="dm-empty">
          <span className="dm-empty-emoji" style={{ color: 'var(--dash-text-muted)' }}><BookOpen size={32} /></span>
          <p>No books finished in {md.name}</p>
        </div>
      );
      return (
        <div className="dm-book-list">
          {books.map((book, idx) => {
            const sm = statusColor(book.status);
            const finishedOn = book._finishedDate
              ? book._finishedDate.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
              : null;
            return (
              <motion.div
                key={book.id || idx}
                className="dm-book-card"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div className="dm-book-accent" style={{ background: sm.color }} />
                <div className="dm-book-body">
                  <div className="dm-book-top">
                    <div className="dm-book-icon" style={{ color: 'var(--emerald-color)' }}><BookOpen size={18} /></div>
                    <div className="dm-book-info">
                      <h4 className="dm-book-title">{book.title}</h4>
                      <p className="dm-book-meta">
                        {book.author || 'Unknown Author'}
                        {finishedOn && <span className="dm-book-lender"> · finished {finishedOn}</span>}
                      </p>
                    </div>
                    <span className="dm-status-badge" style={{ color: sm.color, background: sm.bg }}>
                      <span className="dm-status-dot" style={{ background: sm.color }} />
                      {sm.label}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'bought') {
      const books = md.boughtBooks || [];
      if (books.length === 0) return (
        <div className="dm-empty">
          <span className="dm-empty-emoji" style={{ color: 'var(--dash-text-muted)' }}><Package size={32} /></span>
          <p>No books bought in {md.name}</p>
        </div>
      );
      return (
        <div className="dm-book-list">
          {books.map((book, idx) => {
            const price = parseFloat(String(book.price || '').replace(/[^0-9.]/g, '')) || 0;
            const discount = parseFloat(book.discount || 0);
            const netPrice = price - price * (discount / 100);
            const savedAmt = price - netPrice;
            const sm = statusColor(book.status);
            return (
              <motion.div
                key={book.id || idx}
                className="dm-book-card"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div className="dm-book-accent" style={{ background: sm.color }} />
                <div className="dm-book-body">
                  <div className="dm-book-top">
                    <div className="dm-book-icon" style={{ color: 'var(--blue-color)' }}><Book size={18} /></div>
                    <div className="dm-book-info">
                      <h4 className="dm-book-title">{book.title}</h4>
                      <p className="dm-book-meta">{book.author || 'Unknown Author'}</p>
                    </div>
                    <span className="dm-status-badge" style={{ color: sm.color, background: sm.bg }}>
                      <span className="dm-status-dot" style={{ background: sm.color }} />
                      {sm.label}
                    </span>
                  </div>
                  {price > 0 && (
                    <div className="dm-book-pricing">
                      <span className="dm-price-mrp">MRP <s>₹{Math.round(price)}</s></span>
                      <span className="dm-price-paid">Paid ₹{Math.round(netPrice)}</span>
                      {discount > 0 && <span className="dm-price-disc">🏷 {discount}% off</span>}
                      {savedAmt > 0 && <span className="dm-price-saved">Saved ₹{Math.round(savedAmt)}</span>}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'borrowed') {
      const books = md.borrowedBooks || [];
      if (books.length === 0) return (
        <div className="dm-empty">
          <span className="dm-empty-emoji">📭</span>
          <p>No books borrowed in {md.name}</p>
        </div>
      );
      return (
        <div className="dm-book-list">
          {books.map((book, idx) => {
            const sm = statusColor(book.status);
            return (
              <motion.div
                key={book.id || idx}
                className="dm-book-card"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div className="dm-book-accent" style={{ background: sm.color }} />
                <div className="dm-book-body">
                  <div className="dm-book-top">
                    <div className="dm-book-icon">📗</div>
                    <div className="dm-book-info">
                      <h4 className="dm-book-title">{book.title}</h4>
                      <p className="dm-book-meta">
                        {book.author || 'Unknown Author'}
                        {book.owner && <span className="dm-book-lender"> · from {book.owner}</span>}
                      </p>
                    </div>
                    <span className="dm-status-badge" style={{ color: sm.color, background: sm.bg }}>
                      <span className="dm-status-dot" style={{ background: sm.color }} />
                      {sm.label}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      );
    }

    if (activeTab === 'pipeline') {
      const boughtTotal = md.bought || 0;
      const borrowedTotal = md.borrowed || 0;
      if (boughtTotal === 0 && borrowedTotal === 0) return (
        <div className="dm-empty">
          <span className="dm-empty-emoji" style={{ color: 'var(--dash-text-muted)' }}><BarChart2 size={32} /></span>
          <p>No pipeline activity in {md.name}</p>
        </div>
      );
      return (
        <div className="dm-pipeline-section">
          <PipelineBar
            label="Bought Books" color="var(--purple-color)"
            read={md.boughtRead || 0} readingVal={md.boughtReading || 0}
            unread={md.boughtUnread || 0} total={boughtTotal}
          />
          {borrowedTotal > 0 && (
            <PipelineBar
              label="Borrowed Books" color="var(--blue-color)"
              read={md.borrowedRead || 0} readingVal={md.borrowedReading || 0}
              unread={md.borrowedUnread || 0} total={borrowedTotal}
            />
          )}
        </div>
      );
    }

    if (activeTab === 'exchange') {
      const lentTotal = md.lent || 0;
      const reLentTotal = md.reLent || 0;
      if (lentTotal === 0 && reLentTotal === 0) return (
        <div className="dm-empty">
          <span className="dm-empty-emoji" style={{ color: 'var(--dash-text-muted)' }}><ArrowRightLeft size={32} /></span>
          <p>No exchange activity in {md.name}</p>
        </div>
      );
      return (
        <div className="dm-pipeline-section">
          {lentTotal > 0 && (
            <PipelineBar
              label="Lent Out" color="var(--emerald-color)"
              read={md.lentRead || 0} readingVal={md.lentReading || 0}
              unread={md.lentUnread || 0} total={lentTotal}
            />
          )}
          {reLentTotal > 0 && (
            <PipelineBar
              label="Re-lent" color="var(--orange-color)"
              read={md.reLentRead || 0} readingVal={md.reLentReading || 0}
              unread={md.reLentUnread || 0} total={reLentTotal}
            />
          )}
        </div>
      );
    }

    if (activeTab === 'spending') {
      if (mrp === 0) return (
        <div className="dm-empty">
          <span className="dm-empty-emoji" style={{ color: 'var(--dash-text-muted)' }}><DollarSign size={32} /></span>
          <p>No spending data for {md.name}</p>
        </div>
      );
      const top = md.topDiscountBook;
      return (
        <div className="dm-spend-section">
          <div className="dm-spend-cards">
            <div className="dm-spend-kpi dm-kpi-spent">
              <span className="dm-kpi-label">Total Paid</span>
              <span className="dm-kpi-value">₹{Math.round(spent).toLocaleString()}</span>
            </div>
            <div className="dm-spend-kpi dm-kpi-saved">
              <span className="dm-kpi-label">Total Saved</span>
              <span className="dm-kpi-value">₹{Math.round(saved).toLocaleString()}</span>
              <span className="dm-kpi-sub">{savedPct}% off MRP</span>
            </div>
            <div className="dm-spend-kpi dm-kpi-mrp">
              <span className="dm-kpi-label">Total MRP</span>
              <span className="dm-kpi-value">₹{Math.round(mrp).toLocaleString()}</span>
            </div>
          </div>
          <div className="dm-spend-rows">
            <SpendRow label="Avg. Discount" value={`${md.boughtAvgDiscount || 0}%`} accent="var(--indigo-color)" />
            <SpendRow label="Books Bought" value={md.bought || 0} accent="var(--purple-color)"
              sub={`≈ ₹${md.bought > 0 ? Math.round(spent / md.bought).toLocaleString() : 0} per book`} />
          </div>
          {top && (
            <div className="dm-best-deal">
              <div className="dm-best-deal-header">
                <span className="dm-best-deal-tag" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Trophy size={14} /> Best Deal This Month</span>
              </div>
              <p className="dm-best-deal-title">{top.title}</p>
              <div className="dm-best-deal-meta">
                <span className="dm-deal-chip dm-deal-disc">{top.discountPct}% off</span>
                <span className="dm-deal-chip dm-deal-saved">Saved ₹{top.saved}</span>
                <span className="dm-deal-chip dm-deal-paid">Paid ₹{top.price}</span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dm-backdrop" onClick={handleBackdropClick}>
      <motion.div
        className="dm-card"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="dm-header">
          <div className="dm-header-top">
            <div className="dm-header-identity">
              <div className="dm-month-icon"><Calendar size={20} /></div>
              <div>
                <span className="dm-header-label">{isReadingGoalView ? "Reading Goal" : "Monthly Overview"}</span>
                <h2 className="dm-header-title">{md.name}</h2>
              </div>
            </div>
            <button className="dm-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="dm-stats-strip">
            {isReadingGoalView ? (
              <>
                <div className="dm-stat">
                  <span className="dm-stat-val dm-sv-green">{md.read || 0}</span>
                  <span className="dm-stat-lbl">Finished</span>
                </div>
              </>
            ) : (
              <>
                <div className="dm-stat">
                  <span className="dm-stat-val dm-sv-purple">{md.bought || 0}</span>
                  <span className="dm-stat-lbl">Bought</span>
                </div>
                <span className="dm-strip-sep" />
                <div className="dm-stat">
                  <span className="dm-stat-val dm-sv-blue">{md.borrowed || 0}</span>
                  <span className="dm-stat-lbl">Borrowed</span>
                </div>
                <span className="dm-strip-sep" />
                <div className="dm-stat">
                  <span className="dm-stat-val dm-sv-green">{readPct}%</span>
                  <span className="dm-stat-lbl">Read</span>
                </div>
                <span className="dm-strip-sep" />
                <div className="dm-stat">
                  <span className="dm-stat-val dm-sv-red">₹{Math.round(spent).toLocaleString()}</span>
                  <span className="dm-stat-lbl">Spent</span>
                </div>
                {saved > 0 && <>
                  <span className="dm-strip-sep" />
                  <div className="dm-stat">
                    <span className="dm-stat-val dm-sv-amber">₹{Math.round(saved).toLocaleString()}</span>
                    <span className="dm-stat-lbl">Saved</span>
                  </div>
                </>}
              </>
            )}
          </div>

          {!isReadingGoalView && totalBooksThisMonth > 0 && (
            <div className="dm-progress-track">
              <motion.div
                className="dm-progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${readPct}%` }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
          )}
        </div>

        <div className="dm-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`dm-tab${activeTab === tab.id ? ' dm-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="dm-tab-emoji">{tab.icon}</span>
              {tab.label}
              {tab.count !== null && (
                <span className={`dm-tab-count${activeTab === tab.id ? ' dm-tab-count--active' : ''}`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div layoutId="dmTabIndicator" className="dm-tab-indicator" />
              )}
            </button>
          ))}
        </div>

        <div className="dm-body">
          {renderTab()}
        </div>
      </motion.div>
    </div>
  );
};


/* ─── Weekly Details Modal ─── */
export const WeeklyDetailsModal = ({ isOpen, onClose, weekData }) => {
  const [activeTab, setActiveTab] = useState('finished');

  useEffect(() => {
    if (weekData) {
      if ((weekData.readBooks?.length || 0) > 0 && !(weekData.books?.length > 0)) {
        setActiveTab('finished');
      } else if (weekData.books?.length > 0) {
        setActiveTab('acquired');
      } else {
        setActiveTab('finished');
      }
    }
  }, [weekData]);

  if (!isOpen || !weekData) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const acquiredBooks = weekData.books || [];
  const readBooks = weekData.readBooks || [];

  const displayBooks = activeTab === 'finished' ? readBooks : acquiredBooks;

  return (
    <div className="dm-backdrop" onClick={handleBackdropClick}>
      <motion.div
        className="dm-card dm-card--week"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      >
        <div className="dm-header">
          <div className="dm-header-top">
            <div className="dm-header-identity">
              <div className="dm-month-icon">📅</div>
              <div>
                <span className="dm-header-label">Weekly Snapshot</span>
                <h2 className="dm-header-title">Week of {weekData.week}</h2>
              </div>
            </div>
            <button className="dm-close-btn" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="dm-stats-strip">
            <div className="dm-stat">
              <span className="dm-stat-val dm-sv-green">{readBooks.length}</span>
              <span className="dm-stat-lbl">finished</span>
            </div>
            <span className="dm-strip-sep" />
            <div className="dm-stat">
              <span className="dm-stat-val dm-sv-purple">{acquiredBooks.length}</span>
              <span className="dm-stat-lbl">added</span>
            </div>
            {displayBooks.reduce((s, b) => s + (Number(b.pages) || 0), 0) > 0 && (
              <>
                <span className="dm-strip-sep" />
                <div className="dm-stat">
                  <span className="dm-stat-val dm-sv-blue">
                    {displayBooks.reduce((s, b) => s + (Number(b.pages) || 0), 0).toLocaleString()}
                  </span>
                  <span className="dm-stat-lbl">total pages</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="dm-tabs">
          <button
            className={`dm-tab${activeTab === 'finished' ? ' dm-tab--active' : ''}`}
            onClick={() => setActiveTab('finished')}
          >
            <span className="dm-tab-emoji"><BookOpen size={16} /></span>
            Finished
            <span className={`dm-tab-count${activeTab === 'finished' ? ' dm-tab-count--active' : ''}`}>
              {readBooks.length}
            </span>
            {activeTab === 'finished' && <motion.div layoutId="dmWeekTabIndicator" className="dm-tab-indicator" />}
          </button>
          <button
            className={`dm-tab${activeTab === 'acquired' ? ' dm-tab--active' : ''}`}
            onClick={() => setActiveTab('acquired')}
          >
            <span className="dm-tab-emoji"><Package size={16} /></span>
            Added
            <span className={`dm-tab-count${activeTab === 'acquired' ? ' dm-tab-count--active' : ''}`}>
              {acquiredBooks.length}
            </span>
            {activeTab === 'acquired' && <motion.div layoutId="dmWeekTabIndicator" className="dm-tab-indicator" />}
          </button>
        </div>

        <div className="dm-body">
          {displayBooks.length === 0 ? (
            <div className="dm-empty">
              <span className="dm-empty-emoji">{activeTab === 'finished' ? '📖' : '📂'}</span>
              <p>No books were {activeTab === 'finished' ? 'finished' : 'added'} during this week</p>
            </div>
          ) : (
            <div className="dm-book-list">
              {displayBooks.map((b, idx) => (
                <motion.div
                  key={b.id || idx}
                  className="dm-book-card"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <div className="dm-book-accent" style={{ background: activeTab === 'finished' ? 'var(--emerald-color)' : 'var(--indigo-color)' }} />
                  <div className="dm-book-body">
                    <div className="dm-book-top">
                      <div className="dm-book-icon">{activeTab === 'finished' ? '📗' : '📘'}</div>
                      <div className="dm-book-info">
                        <h4 className="dm-book-title">{b.title}</h4>
                        <p className="dm-book-meta">{b.author || 'Unknown Author'}</p>
                      </div>
                      {b.pages && (
                        <span className="dm-pages-badge">{b.pages} pg</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};