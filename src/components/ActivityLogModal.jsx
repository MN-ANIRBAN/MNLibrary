 import { useState, useEffect, useRef } from "react";
import { 
  X, Clock, ArrowRight, ArrowLeft, RotateCcw, 
  CheckCircle, AlertCircle, User, Heart
} from "lucide-react";

// Activity type configurations
const ACTIVITY_CONFIG = {
  lent: {
    label: "Lent To",
    icon: ArrowRight,
    color: "#f59e0b", // amber
    bgColor: "rgba(245, 158, 11, 0.1)"
  },
  borrowed: {
    label: "Borrowed From",
    icon: ArrowLeft,
    color: "#ef4444", // red
    bgColor: "rgba(239, 68, 68, 0.1)"
  },
  returned: {
    label: "Returned To",
    icon: CheckCircle,
    color: "#10b981", // green
    bgColor: "rgba(16, 185, 129, 0.1)"
  },
  received: {
    label: "Received From",
    icon: ArrowRight,
    color: "#10b981", // green
    bgColor: "rgba(16, 185, 129, 0.1)"
  },
  "re-lent": {
    label: "Re-lent To",
    icon: RotateCcw,
    color: "#f97316", // orange
    bgColor: "rgba(249, 115, 22, 0.1)"
  },
  owned: {
    label: "Added to Collection",
    icon: User,
    color: "#6366f1", // indigo
    bgColor: "rgba(99, 102, 241, 0.1)"
  },
  wishlist: {
    label: "Wishlist Activity",
    icon: Heart,
    color: "#db2777", // pink
    bgColor: "rgba(219, 39, 119, 0.1)"
  }
};

export default function ActivityLogModal({ book, onClose }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const modalRef = useRef(null);

  // Load activities on mount
  useEffect(() => {
    const normalizeTimestamp = (ts) => {
      if (!ts) return null;

      // Firestore Timestamp-like (toDate)
      if (typeof ts === "object") {
        if (typeof ts.seconds === "number") {
          return ts;
        }
        // Some docs may store _seconds
        if (typeof ts._seconds === "number") {
          return { seconds: ts._seconds, nanoseconds: ts.nanoseconds ?? 0 };
        }
        if (typeof ts.toDate === "function") {
          const d = ts.toDate();
          return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
        }
      }

      // Numeric timestamp (ms or seconds)
      if (typeof ts === "number") {
        // Heuristic: if it's in ms (13 digits) convert to seconds
        if (ts > 1e12) {
          return { seconds: Math.floor(ts / 1000), nanoseconds: 0 };
        }
        return { seconds: ts, nanoseconds: 0 };
      }

      // ISO string
      if (typeof ts === "string") {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          return { seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 };
        }
      }

      return null;
    };

    const raw = book?.activityLog;

    // Normalize activityLog to an array (accept array OR object shapes)
    let list = [];
    if (Array.isArray(raw)) {
      list = raw;
    } else if (raw && typeof raw === "object") {
      // If it's an id->activity map, convert values to an array
      // e.g. { "169...": {..}, "169...": {...} }
      const values = Object.values(raw);
      if (values.length > 0 && values.every(v => v && typeof v === "object" && ('type' in v || 'timestamp' in v || 'from' in v || 'to' in v || 'notes' in v))) {
        list = values;
      } else {
        // Otherwise treat as a single activity object
        list = [raw];
      }
    }

    const normalized = list
      .filter(Boolean)
      .map((a, idx) => {
        const normalizedTs = normalizeTimestamp(a?.timestamp ?? a?.time ?? a?.date);
        return {
          id: a?.id ?? a?.activityId ?? `${Date.now()}-${idx}`,
          type: a?.type ?? "owned",
          from: a?.from,
          to: a?.to,
          notes: a?.notes ?? a?.comment,
          timestamp: normalizedTs,
          // keep raw for debugging/fallback if needed
          _rawTimestamp: a?.timestamp,
        };
      });

    // Sort by date, newest first (fallback to 0)
    normalized.sort((a, b) => {
      const dateA = a.timestamp?.seconds || 0;
      const dateB = b.timestamp?.seconds || 0;
      return dateB - dateA;
    });

    setActivities(normalized);
    setLoading(false);
  }, [book]);



  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Format date (defensive: supports {seconds}, ms, seconds, and ISO strings)
  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown date";

    try {
      // Firestore-like {seconds, nanoseconds}
      if (typeof timestamp === "object" && typeof timestamp.seconds === "number") {
        const date = new Date(timestamp.seconds * 1000);
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      // Number heuristics
      if (typeof timestamp === "number") {
        const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
        const date = new Date(ms);
        if (isNaN(date.getTime())) return "Unknown date";
        return date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      // ISO string
      if (typeof timestamp === "string") {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
      }
    } catch {
      // ignore
    }

    return "Unknown date";
  };

  const normalizeActivityType = (type) => {
    if (!type) return "owned";
    return String(type)
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  // Get activity config
  const getActivityConfig = (type) => {
    const normalized = normalizeActivityType(type);

    // Common aliases
    const aliasMap = {
      "re-lent": "re-lent",
      "re-lent-to": "re-lent",
      "relent": "re-lent",
      "re lent": "re-lent",
      "re_lent": "re-lent"
    };

    const key = aliasMap[normalized] || normalized;
    return ACTIVITY_CONFIG[key] || ACTIVITY_CONFIG.owned;
  };

  const content = (() => {
    if (loading) {
      return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative', background: 'var(--dash-surface)' }}>
          <div style={{ position: 'absolute', left: '41px', top: '30px', bottom: '30px', width: '2px', background: 'var(--dash-border)' }}></div>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '20px', position: 'relative', zIndex: 1 }}>
              <div className="skeleton-wrapper skeleton-circle" style={{ width: 36, height: 36, flexShrink: 0, border: '4px solid var(--dash-surface)' }}></div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '6px' }}>
                <div className="skeleton-wrapper skeleton-text short"></div>
                <div className="skeleton-wrapper skeleton-text title" style={{ width: '100%' }}></div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activities.length === 0) {
      return (
        <div className="activity-log-empty">
          <div className="activity-log-empty-icon">
            <Clock size={40} />
          </div>
          <h3>No Activity Yet</h3>
          <p>When you change owner/custody, the timeline will show it here.</p>
        </div>
      );
    }

    return (
      <div className="activity-log-list" role="list">
        {activities.map((activity, index) => {
          const config = getActivityConfig(activity.type);
          const IconComponent = config.icon;

          const primaryParts = [];
          // Show only one side depending on activity type:
          // - for actions that have a meaningful `to`, show `to`
          // - for received/borrowed-like actions, show `from`
          const showFromTypes = new Set(["borrowed", "received"]);
          const shouldShowFrom = showFromTypes.has(getActivityConfig(activity.type)?.key) || showFromTypes.has(String(activity.type).toLowerCase());

          if (shouldShowFrom) {
            if (activity.from) primaryParts.push(activity.from);
          } else {
            if (activity.to) primaryParts.push(activity.to);
          }



          return (
            <div
              key={activity.id || index}
              className="activity-log-item"
              style={{ borderLeftColor: config.color, background: config.bgColor }}
              role="listitem"
            >
              <div className="activity-log-icon-wrapper" style={{ background: config.color }}>
                <IconComponent size={14} color="white" />
              </div>
              <div className="activity-log-content">
                <div className="activity-log-action">
                  <span className="activity-type" style={{ color: config.color }}>
                    {config.label}
                  </span>
                  {primaryParts.length > 0 && (
                    <span className="activity-person-group">
                      {primaryParts.map((p, i) => (
                        <span key={i} className="activity-person">
                          {p}
                        </span>
                      ))}
                    </span>
                  )}
                </div>

                <div className="activity-log-date">{formatDate(activity.timestamp)}</div>

                {activity.notes && <div className="activity-notes">{activity.notes}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  })();

  return (
    <div className="activity-log-overlay">
      <div className="activity-log-modal" ref={modalRef} role="dialog" aria-modal="true">
        <div className="activity-log-header">
          <div className="activity-log-title-group">
            <div className="activity-log-header-icon">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="activity-log-title">Activity Log</h2>
              <p className="activity-log-book-title">{book?.title}</p>
            </div>
          </div>

          <button className="activity-log-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="activity-log-body">{content}</div>

        <div className="activity-log-footer">
          <div className="activity-log-footer-left">
            <span className="activity-count">
              {activities.length} {activities.length === 1 ? "activity" : "activities"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Add the styles to App.css
// These will be added as part of the component integration
