import React, { useState, useEffect, useMemo } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, Calendar, AlertTriangle } from "lucide-react";
import { HeatmapCard } from "./DashboardWidgets";
import "../DashboardStyles.css";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isUnbalanced = data.isUnbalanced;
    return (
      <div className="ref-chart-tooltip" style={{ cursor: 'pointer' }}>
        <div className="ref-tooltip-title">{data.name} ({data.shortDate})</div>
        <div className="ref-tooltip-subtitle">
          <span style={{ color: '#ff6b6b', fontWeight: 600 }}>{data.maxFocus} Read</span>
          <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>·</span>
          <span style={{ color: '#6b8bff', fontWeight: 600 }}>{data.minFocus} Acq</span>
          {isUnbalanced && <span style={{ color: '#ff6b6b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', fontWeight: 700 }}><AlertTriangle size={12} /> Unbalanced</span>}
          <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-3)' }}>Click dot to see details</div>
        </div>
      </div>
    );
  }
  return null;
};

export default function ReadingActivityChart({ weeklyData = [], onWeekClick }) {
  const [activeMonth, setActiveMonth] = useState(null);

  // Group data by month and get recent months
  const { recentMonths, monthWeeks } = useMemo(() => {
    const rMonths = [];
    const mWeeks = {};
    if (weeklyData && weeklyData.length > 0) {
      for (let i = weeklyData.length - 1; i >= 0; i--) {
        const w = weeklyData[i];
        if (!mWeeks[w.monthLabel]) {
          mWeeks[w.monthLabel] = [];
          if (rMonths.length < 4) {
            rMonths.unshift(w.monthLabel);
          }
        }
        mWeeks[w.monthLabel].unshift(w);
      }
    }
    return { recentMonths: rMonths, monthWeeks: mWeeks };
  }, [weeklyData]);

  // Set default active month to the most recent one
  useEffect(() => {
    if (recentMonths.length > 0 && (!activeMonth || !recentMonths.includes(activeMonth))) {
      setActiveMonth(recentMonths[recentMonths.length - 1]);
    }
  }, [recentMonths, activeMonth]);

  // Derive chart data for active month
  const chartData = useMemo(() => {
    if (!activeMonth || !monthWeeks[activeMonth]) return [];
    return monthWeeks[activeMonth].map((w, index) => {
      const readCount = w.readCount || 0;
      const acquiredCount = w.count || 0;
      
      const d = new Date(w.week);
      const shortDate = d.toLocaleDateString('default', { day: 'numeric', month: 'short' });

      return {
        name: `Week ${index + 1}`,
        shortDate: shortDate,
        weekDate: w.week,
        maxFocus: readCount,
        minFocus: acquiredCount,
        isUnbalanced: acquiredCount > 2 && readCount === 0,
        fullWeekData: w
      };
    });
  }, [activeMonth, monthWeeks]);

  // Calculate stats for the selected month
  const { totalRead, totalAcq, avgCompletion } = useMemo(() => {
    const tr = chartData.reduce((acc, curr) => acc + curr.maxFocus, 0);
    const ta = chartData.reduce((acc, curr) => acc + curr.minFocus, 0);
    const avg = ta > 0 ? Math.round((tr / ta) * 100) : (tr > 0 ? 100 : 0);
    return { totalRead: tr, totalAcq: ta, avgCompletion: avg };
  }, [chartData]);

  return (
    <div className="ref-chart-container">
      {/* HEADER ROW */}
      <div className="ref-chart-header">
        <div>
          <h2 className="ref-chart-title">Reading Activity</h2>
          <p className="ref-chart-subtitle">Books Read vs Acquired over time</p>
        </div>
        <div className="ref-chart-range">
          Range: {activeMonth ? `Month of ${activeMonth}` : 'Last month'}
        </div>
      </div>

      <div className="ref-chart-body">
        {/* LEFT SIDEBAR MONTHS */}
        <div className="ref-chart-sidebar">
          <ChevronUp size={20} className="ref-sidebar-icon" />
          <div className="ref-sidebar-months">
            {recentMonths.map(m => (
              <div 
                key={m} 
                className={`ref-month-item ${activeMonth === m ? 'active' : ''}`}
                onClick={() => setActiveMonth(m)}
              >
                {m}
              </div>
            ))}
            {recentMonths.length === 0 && (
              <div className="ref-month-item active">--</div>
            )}
          </div>
          <ChevronDown size={20} className="ref-sidebar-icon" />
        </div>

        {/* CHART AREA */}
        <div className="ref-chart-plot-area">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <XAxis 
                dataKey="shortDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: "var(--text-3)", fontSize: 11, fontWeight: 500 }} 
                dy={15} 
              />
              <YAxis hide domain={[0, dataMax => Math.max(dataMax * 1.5, 4)]} />
              <RechartsTooltip 
                content={<CustomTooltip />} 
                cursor={{ stroke: 'var(--border, rgba(0,0,0,0.1))', strokeWidth: 1, strokeDasharray: '4 4' }}
                position={{ y: -10 }}
              />
              <Line 
                type="monotone" 
                dataKey="minFocus" 
                stroke="#6b8bff" 
                strokeWidth={3}
                dot={{ r: 4, fill: "#fff", stroke: "#6b8bff", strokeWidth: 2, cursor: 'pointer' }}
                activeDot={{ r: 7, fill: "#fff", stroke: "#6b8bff", strokeWidth: 3, cursor: 'pointer', onClick: (_, p) => onWeekClick && onWeekClick(p.payload.fullWeekData) }}
              />
              <Line 
                type="monotone" 
                dataKey="maxFocus" 
                stroke="#ff6b6b" 
                strokeWidth={3}
                dot={{ r: 4, fill: "#fff", stroke: "#ff6b6b", strokeWidth: 2, cursor: 'pointer' }}
                activeDot={{ r: 7, fill: "#fff", stroke: "#ff6b6b", strokeWidth: 3, cursor: 'pointer', onClick: (_, p) => onWeekClick && onWeekClick(p.payload.fullWeekData) }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FOOTER ROW */}
      <div className="ref-chart-footer">
        <div className="ref-chart-legend">
          <div className="ref-legend-item">
            <span className="ref-legend-color" style={{ background: '#ff6b6b' }}></span>
            Books Read
          </div>
          <div className="ref-legend-item">
            <span className="ref-legend-color" style={{ background: '#6b8bff', borderRadius: '4px' }}></span>
            Books Acquired
          </div>
        </div>
        <div className="ref-chart-stats">
          <div className="ref-stat-value">{avgCompletion}%</div>
          <div className="ref-stat-label">Monthly Completion</div>
        </div>
      </div>

      {/* MERGED YEARLY HEATMAP */}
      <div className="ref-yearly-heatmap-wrapper">
        <div className="ref-yearly-heatmap-header">
          <h3 style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Calendar size={18} className="dash-text-emerald" /> Yearly Reading Heatmap</h3>
          <p>Last 52 weeks of reading activity</p>
        </div>
        <HeatmapCard weeklyData={weeklyData} onWeekClick={onWeekClick} />
      </div>
    </div>
  );
}
