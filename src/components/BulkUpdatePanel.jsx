import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, Search, ArrowRight, CheckCircle2,
  AlertCircle, Loader2, Database, Filter, X,
  History, Calendar, FileText, User, BookOpen
} from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../supabase/config";
import { getUserFacingError } from "../utils/errorHandler";

import { sanitizeString } from "../utils/sanitize";

const BULK_FIELDS = [
  { value: "author", label: "Author" },
  { value: "title", label: "Book Name" },
  { value: "publisher", label: "Publisher" },
  { value: "owner", label: "Legal Owner" },
  { value: "custody", label: "Current Custody" },
  { value: "genre", label: "Genre" },
  { value: "year", label: "Published Year" },
  { value: "price", label: "MRP Price" },
  { value: "discount", label: "Discount (%)" },
  { value: "notes", label: "Notes" },
];

export default function BulkUpdatePanel({ books, updateBook, bulkLogs = [], addBulkLog, deleteBulkLog, performedByAdmin, currentUser }) {
  const [selectedField, setSelectedField] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedLog, setSelectedLog] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [showMatchingBooks, setShowMatchingBooks] = useState(false);
  const [optimisticLogs, setOptimisticLogs] = useState([]);

  const handleDeleteLogs = async (logIds) => {
    const logsToDelete = logIds === "all" ? bulkLogs : bulkLogs.filter(l => logIds.has(l.id));
    if (logsToDelete.length === 0) return;

    if (!window.confirm(`Are you sure you want to permanently delete ${logsToDelete.length === bulkLogs.length ? "all" : logsToDelete.length} logs? This action cannot be undone.`)) return;

    try {
      for (const log of logsToDelete) {
        if (deleteBulkLog) await deleteBulkLog(log.id);
      }

      setSelectedLog(null);
      if (logIds !== "all") setSelectedLogs(new Set());
      toast.success("Logs permanently deleted.");
    } catch (e) {
      console.error("Failed to delete logs", e);
      toast.error("Failed to delete logs");
    }
  };

  // Get unique values for selected field (for auto-suggest)
  const uniqueValues = useMemo(() => {
    if (!selectedField || !books?.length) return [];
    const set = new Set();
    books.forEach((b) => {
      // Robust ownership check
      let isOwner = true;
      if (currentUser) {
        isOwner = b.userId === currentUser.id ||
          (b.owner && currentUser.email && b.owner.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) ||
          (b.owner && currentUser.profile?.display_name && b.owner.toLowerCase().trim() === currentUser.profile.display_name.toLowerCase().trim());
      }
      if (!isOwner) return;

      const val = (b[selectedField] || "").toString().trim();
      if (val) set.add(val);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [selectedField, books, currentUser]);

  // Filtered suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!currentValue.trim()) return uniqueValues;
    const q = currentValue.toLowerCase();
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [currentValue, uniqueValues]);

  // Count matching books
  const matchingBooks = useMemo(() => {
    if (!selectedField || !currentValue.trim()) return [];
    const q = currentValue.trim().toUpperCase();
    return books.filter((b) => {
      if (typeof b.id === 'string' && b.id.startsWith('temp-')) return false;

      // Robust ownership check
      let isOwner = true;
      if (currentUser) {
        isOwner = b.userId === currentUser.id ||
          (b.owner && currentUser.email && b.owner.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) ||
          (b.owner && currentUser.profile?.display_name && b.owner.toLowerCase().trim() === currentUser.profile.display_name.toLowerCase().trim());
      }
      if (!isOwner) return false;

      const val = (b[selectedField] || "").toString().trim().toUpperCase();
      return val === q;
    });
  }, [selectedField, currentValue, books, currentUser]);

  const handleBulkUpdate = useCallback(async () => {
    if (!selectedField || !currentValue.trim() || !newValue.trim() || matchingBooks.length === 0) {
      toast.error("Please fill in all fields.");
      return;
    }

    setShowConfirm(false);
    setIsUpdating(true);
    setUpdateProgress({ current: 0, total: matchingBooks.length });
    setLastResult(null);

    const booksToUpdate = [...matchingBooks];
    let successCount = 0;
    let failCount = 0;

    const sanitizedNewValue = sanitizeString(newValue.toUpperCase());

    for (let i = 0; i < booksToUpdate.length; i++) {
      if (performedByAdmin) {
        break; // We will use RPC after the loop for admins
      }
      try {
        await updateBook(booksToUpdate[i].id, {
          [selectedField]: sanitizedNewValue,
        });
        successCount++;
      } catch (err) {
        console.error("Bulk update error:", err);
        failCount++;
      }
      setUpdateProgress({ current: i + 1, total: booksToUpdate.length });
    }

    if (performedByAdmin) {
      const bookIds = booksToUpdate.map(b => b.id);
      try {
        const { data, error } = await supabase.rpc('admin_bulk_update_field', {
          p_book_ids: bookIds,
          p_field_name: selectedField,
          p_new_value: sanitizedNewValue
        });
        if (error) throw error;
        successCount = data || booksToUpdate.length;
      } catch (err) {
        console.error("Admin Bulk update error:", err);
        failCount = booksToUpdate.length;
        if (err.message && (err.message.includes("function admin_bulk_update_field does not exist") || err.message.includes("permission denied"))) {
          toast.error("Database Error: admin_bulk_update_field RPC is missing or lacks permissions. Check console for SQL fix.", { duration: 6000 });
          console.error(`--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD TO FIX THE RPC ---
CREATE OR REPLACE FUNCTION admin_bulk_update_field(p_book_ids uuid[], p_field_name text, p_new_value text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    updated_count integer;
    sql_query text;
BEGIN
    sql_query := format('UPDATE books SET %I = %L, "updatedAt" = now() WHERE id = ANY($1)', p_field_name, p_new_value);
    EXECUTE sql_query USING p_book_ids;
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_bulk_update_field(uuid[], text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_bulk_update_field(uuid[], text, text) TO anon;
-------------------------------------------------------------------------`);
        } else {
          toast.error(getUserFacingError(err, 'BulkUpdateRPC'));
        }
      }
    }

    setIsUpdating(false);
    setLastResult({ successCount, failCount, total: booksToUpdate.length });

    if (failCount === 0) {
      toast.success(`✅ Updated ${successCount} book${successCount > 1 ? "s" : ""} successfully!`);
    } else {
      toast.error(`Updated ${successCount}, failed ${failCount} of ${matchingBooks.length}`);
    }

    if (successCount > 0) {
      const logEntry = {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        field: BULK_FIELDS.find((f) => f.value === selectedField)?.label,
        oldValue: currentValue,
        newValue: newValue.toUpperCase(),
        count: successCount,
        affectedBooks: booksToUpdate.map(b => ({ id: b.id, title: b.title, author: b.author }))
      };

      const tempId = `temp-${Date.now()}`;
      const finalLogEntry = { ...logEntry, id: tempId };

      // Embed admin mention inside the field string to avoid Supabase schema error
      if (performedByAdmin) {
        const adminName = performedByAdmin.profile?.display_name || performedByAdmin.email?.split('@')[0] || 'Admin';
        logEntry.field = `${logEntry.field} (Updated by ${adminName} for you)`;
        // Include the target user's ID for the RPC to use
        logEntry.userId = booksToUpdate[0]?.userId;

        // In order for the admin to insert the log across RLS, they must use the RPC
        try {
          const { error } = await supabase.rpc('admin_insert_bulk_log', { p_log: logEntry });
          if (error) throw error;
          setOptimisticLogs(prev => [finalLogEntry, ...prev]);
        } catch (err) {
          console.error("Failed to insert admin bulk log:", err);
          if (err.message && (err.message.includes('column "time"') || err.message.includes('column "date" is of type timestamp') || err.message.includes('permission denied') || err.message.includes('function admin_insert_bulk_log does not exist'))) {
            toast.error("Database Error: admin_insert_bulk_log RPC is missing or lacks permissions. Check console for SQL fix.", { duration: 6000 });
            console.error(`--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD TO FIX THE RPC ---
CREATE OR REPLACE FUNCTION admin_insert_bulk_log(p_log jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO "bulkLogs" ("userId", "date", "type", "details", "createdAt")
  VALUES (
    (p_log->>'userId')::uuid,
    now(),
    'bulk_update',
    p_log,
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_insert_bulk_log(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_insert_bulk_log(jsonb) TO anon;
-------------------------------------------------------------------------`);
          } else {
            toast.error(getUserFacingError(err, 'BulkUpdateAdminLog'));
          }
        }
      } else {
        setOptimisticLogs(prev => [finalLogEntry, ...prev]);
        if (addBulkLog) await addBulkLog(logEntry);
      }
    }

    // Reset form
    setCurrentValue("");
    setNewValue("");
  }, [selectedField, currentValue, newValue, matchingBooks, updateBook, addBulkLog]);

  const handleReset = () => {
    setSelectedField("");
    setCurrentValue("");
    setNewValue("");
    setLastResult(null);
    setShowConfirm(false);
  };

  return (
    <div className="bulk-dash-container">
      <div className="bulk-dash-topbar">
        <h2 className="bulk-dash-title">Bulk Update Data</h2>
        <div className="bulk-dash-meta">

          <div className="bulk-dash-meta-item" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <div className="bulk-dash-avatar" style={{ margin: 0 }}>
              <User size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="bulk-dash-meta-label">Owner</span>
              <span className="bulk-dash-meta-val">{currentUser?.profile?.display_name || currentUser?.profile?.full_name || currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || "Admin"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bulk-dash-kpis">
        <div className="bulk-dash-kpi-card">
          <div className="bulk-dash-kpi-val">{books?.length || 0}</div>
          <div className="bulk-dash-kpi-label">Books in Library</div>
        </div>
        <div className="bulk-dash-kpi-card">
          <div className="bulk-dash-kpi-val">{BULK_FIELDS.length}</div>
          <div className="bulk-dash-kpi-label">Updateable Fields</div>
        </div>
        <div className="bulk-dash-kpi-card">
          <div className="bulk-dash-kpi-val">{bulkLogs.length + optimisticLogs.length}</div>
          <div className="bulk-dash-kpi-label">Total Logs Recorded</div>
        </div>
        <div className="bulk-dash-kpi-card">
          <div className="bulk-dash-kpi-val">{matchingBooks.length}</div>
          <div className="bulk-dash-kpi-label">Currently Matching Books</div>
        </div>
      </div>

      <div className="bulk-dash-body">
        <div className="bulk-dash-sidebar">
          <div className="bulk-dash-side-section">
            <h4>Modifying for <span>{currentUser?.profile?.display_name || currentUser?.profile?.full_name || currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0]}</span></h4>
            {performedByAdmin && (
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '-12px' }}>
                Action by Admin: {performedByAdmin.profile?.display_name || "Admin"}
              </p>
            )}
          </div>
          <div className="bulk-dash-side-section">
            <h4>Fields ({BULK_FIELDS.length})</h4>
            <div className="bulk-dash-pills">
              {BULK_FIELDS.map((f) => (
                <button
                  key={f.value}
                  className={`bulk-dash-pill ${selectedField === f.value ? "active" : ""}`}
                  onClick={() => {
                    setSelectedField(f.value);
                    setCurrentValue("");
                    setNewValue("");
                    setLastResult(null);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bulk-dash-main">
          <div className="bulk-dash-search-bar" style={{ position: 'relative' }}>
            <Search size={20} color="rgba(255,255,255,0.7)" />
            <input
              placeholder={selectedField ? `Type or select current ${BULK_FIELDS.find((f) => f.value === selectedField)?.label}...` : "Select a field first..."}
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value.toUpperCase())}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              disabled={!selectedField}
            />
            {currentValue && (
              <button onClick={() => setCurrentValue("")} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            )}
            
            <AnimatePresence>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <motion.div
                  className="bulk-suggestions"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {filteredSuggestions.map((val) => (
                    <button
                      key={val}
                      className="bulk-suggest-item"
                      onMouseDown={() => {
                        setCurrentValue(val);
                        setShowSuggestions(false);
                      }}
                    >
                      {val}
                      <span className="suggest-count">
                        {books.filter((b) => (b[selectedField] || "").toString().trim().toUpperCase() === val.toUpperCase()).length} books
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bulk-dash-action-row">
            <div className="bulk-dash-input-group">
              <label>Replace {matchingBooks.length > 0 ? `${matchingBooks.length} books` : 'Value'} With</label>
              <div className="bulk-dash-search-bar" style={{ marginBottom: 0 }}>
                <ArrowRight size={20} color="rgba(255,255,255,0.7)" />
                <input
                  placeholder="New value..."
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value.toUpperCase())}
                  disabled={!selectedField || !currentValue.trim() || matchingBooks.length === 0}
                />
              </div>
            </div>
            
            <button
              className="bulk-dash-btn"
              disabled={!selectedField || !currentValue.trim() || !newValue.trim() || matchingBooks.length === 0 || isUpdating}
              onClick={() => setShowConfirm(true)}
            >
              {isUpdating ? <><Loader2 size={16} className="bim-spinner" /> Updating...</> : <><RefreshCw size={16} /> Execute Update</>}
            </button>
          </div>

          <h4 style={{ fontSize: '18px', fontWeight: '400', marginBottom: '16px' }}>Update History</h4>
          <div className="bulk-dash-history-list">
            {([...optimisticLogs, ...bulkLogs])
              .filter((log, index, self) =>
                index === self.findIndex((t) => (
                  t.id === log.id || (t.date === log.date && t.time === log.time && t.field === log.field)
                ))
              )
              .map(log => {
                const isAdminUpdate = log.field && typeof log.field === 'string' && log.field.match(/\((?:by|Updated by) [^)]+\)/);
                const cleanField = (log.field || '').toString().replace(/\s*\((?:by|Updated by) [^)]+\)/, '');
                
                return (
                  <div key={log.id} className="bulk-dash-history-item">
                    <div className="bulk-dash-avatar">
                      <User size={16} />
                    </div>
                    <div className="bulk-dash-history-text">
                      <div className="bulk-dash-history-time">{log.date} at {log.time}</div>
                      <div className="bulk-dash-history-detail">
                        Updated <strong>{cleanField}</strong> from 
                        <span style={{ textDecoration: 'line-through', opacity: 0.8, margin: '0 6px' }}>{log.oldValue || '—'}</span> 
                        to <strong>{log.newValue}</strong> for {log.count} books.
                      </div>
                    </div>
                  </div>
                );
              })}
            {([...optimisticLogs, ...bulkLogs]).length === 0 && (
              <div style={{ opacity: 0.6, fontSize: '14px' }}>No updates recorded yet.</div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <div className="book-image-modal-overlay" onClick={() => setShowConfirm(false)}>
            <div className="bulk-confirm-card" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px', padding: '32px', maxWidth: '400px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <AlertCircle size={48} color="#eab308" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px', color: '#1e293b' }}>Confirm Bulk Update</h3>
              <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
                You are about to change <strong>{BULK_FIELDS.find((f) => f.value === selectedField)?.label}</strong> from{" "}
                <strong>"{currentValue}"</strong> to <strong>"{newValue.toUpperCase()}"</strong> across{" "}
                <strong>{matchingBooks.length}</strong> books.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={() => setShowConfirm(false)} style={{ padding: '10px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>Cancel</button>
                <button onClick={handleBulkUpdate} style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: '#0ea5e9', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Confirm Update</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}