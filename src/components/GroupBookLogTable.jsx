import React, { useState } from "react";
import { Clock, BookOpen, User, Lock, ShieldCheck, CornerUpRight, Bookmark, CheckCircle2, Trash2 } from "lucide-react";
import BookImageModal from "./BookImageModal";
import ActivityLogModal from "./ActivityLogModal";

export default function GroupBookLogTable({ books, partnerName, isReadOnly, currentUser, onMarkHandover, onStatusChange }) {
  const [selectedBookImage, setSelectedBookImage] = useState(null);
  const [selectedBookActivity, setSelectedBookActivity] = useState(null);
  const [statusMenuId, setStatusMenuId] = useState(null);

  const STATUS_CONFIG = {
    unread: { label: "To Read", color: "#a78bfa", icon: <Bookmark size={14} /> },
    reading: { label: "Reading", color: "#38bdf8", icon: <BookOpen size={14} /> },
    read: { label: "Finished", color: "#34d399", icon: <CheckCircle2 size={14} /> },
  };

  if (!books || books.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', padding: '8px' }}>
      {books.map((book) => {
        const myNameUpper = (currentUser?.profile?.full_name || currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || "ME").toUpperCase();
        const myEmailPrefixUpper = currentUser?.email?.split('@')[0]?.toUpperCase() || "";
        const myEmailUpper = currentUser?.email?.toUpperCase() || "";

        const ownerUpper = (book.owner || "").trim().toUpperCase();
        const custodyUpper = (book.custody || "").trim().toUpperCase();

        const isOwnerMine = ownerUpper === myNameUpper || ownerUpper === myEmailPrefixUpper || ownerUpper === myEmailUpper;
        const isCustodyMine = custodyUpper === myNameUpper || custodyUpper === myEmailPrefixUpper || custodyUpper === myEmailUpper;

        const getUserStatus = (b) => {
          if (Array.isArray(b.activityLog)) {
            const userStatusLogs = b.activityLog.filter(log => log.type === 'user_status' && log.by === currentUser?.id);
            if (userStatusLogs.length > 0) {
              const latest = userStatusLogs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)[0];
              return latest.status;
            }
          }
          if (b.userId === currentUser?.id) return b.status || 'unread';
          return 'unread';
        };

        const actualStatus = getUserStatus(book);
        const currentStatus = STATUS_CONFIG[actualStatus] || STATUS_CONFIG.unread;

        return (
          <div
            key={book.id}
            style={{
              background: 'var(--dash-surface)',
              borderRadius: '16px',
              border: '1px solid var(--dash-border)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedBookImage(book)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {/* Top: Cover & Basic Details */}
            <div style={{ padding: '16px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--dash-border)' }}>
              {book.frontCoverUrl || book.coverUrl ? (
                <img src={book.frontCoverUrl || book.coverUrl} alt={book.title} loading="lazy" decoding="async" style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '60px', height: '90px', background: 'var(--dash-hover-bg)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--dash-border)' }}>
                  <BookOpen size={24} color="var(--dash-text-muted)" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--dash-text)', fontSize: '15px', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.title || "Untitled"}</div>
                <div style={{ fontSize: '13px', color: 'var(--dash-text-muted)', marginBottom: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{book.author || "Unknown"}</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--dash-text-secondary)', marginTop: 'auto' }}>
                  <User size={12} style={{ opacity: 0.7 }} />
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.owner}</span>
                </div>
              </div>
            </div>

            {/* Bottom: Custody & Actions */}
            <div style={{ padding: '12px 16px', background: 'var(--dash-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <Lock size={12} color="var(--dash-text-muted)" />
                  <span style={{ color: 'var(--dash-text-secondary)', fontWeight: 500 }}>With:</span>
                  <span style={{ fontWeight: 700, color: 'var(--indigo-color)' }}>{book.custody}</span>
                </div>
                
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusMenuId(statusMenuId === book.id ? null : book.id);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--dash-border)',
                      background: 'var(--dash-surface)', color: currentStatus.color,
                      fontSize: '11px', fontWeight: 600, cursor: 'pointer', width: 'fit-content',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--dash-hover-bg)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--dash-surface)'}
                  >
                    {currentStatus.icon} <span style={{ color: 'var(--dash-text)' }}>{currentStatus.label}</span>
                  </button>
                  {statusMenuId === book.id && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px',
                      background: 'var(--dash-surface)', border: '1px solid var(--dash-border)',
                      borderRadius: '8px', padding: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '110px'
                    }}>
                      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={(e) => {
                            e.stopPropagation();
                            const existingLog = Array.isArray(book.activityLog) ? book.activityLog : [];
                            const newLog = [
                              ...existingLog,
                              {
                                id: Date.now(),
                                type: 'user_status',
                                status: key,
                                by: currentUser.id,
                                timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
                              }
                            ];
                            const updateData = { activityLog: newLog };
                            if (book.userId === currentUser.id) {
                              updateData.status = key;
                            }
                            if (onStatusChange) onStatusChange(book.id, updateData);
                            setStatusMenuId(null);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 8px', borderRadius: '4px', border: 'none',
                            background: 'transparent', color: 'var(--dash-text)',
                            fontSize: '11px', fontWeight: 500, cursor: 'pointer', textAlign: 'left',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--dash-hover-bg)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</span>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedBookActivity(book); }}
                  style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--dash-hover-bg)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--dash-surface)'; }}
                  title="View Activity Log"
                >
                  <Clock size={14} /> Log
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Remove this book from your library view?")) {
                      const existingLog = Array.isArray(book.activityLog) ? book.activityLog : [];
                      const newLog = [
                        ...existingLog,
                        {
                          id: Date.now(),
                          type: 'hidden',
                          by: currentUser.id,
                          timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
                        }
                      ];
                      if (onStatusChange) onStatusChange(book.id, { activityLog: newLog });
                    }
                  }}
                  style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--danger-color, #ef4444)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--dash-surface)'; }}
                  title="Remove from my library"
                >
                  <Trash2 size={14} />
                </button>

                {!isOwnerMine && isCustodyMine && onMarkHandover && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMarkHandover(book.id, 'handover'); }}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: 'none', background: 'var(--amber-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, transition: 'opacity 0.2s', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.9; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 1; }}
                    title="Handover Book"
                  >
                    <CornerUpRight size={14} /> Handover
                  </button>
                )}

                {isOwnerMine && !isCustodyMine && onMarkHandover && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMarkHandover(book.id, 'received'); }}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: 'none', background: 'var(--emerald-color)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, transition: 'opacity 0.2s', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = 0.9; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = 1; }}
                    title="Mark as Received"
                  >
                    <ShieldCheck size={14} /> Received
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {selectedBookImage && <BookImageModal book={selectedBookImage} onClose={() => setSelectedBookImage(null)} />}
      {selectedBookActivity && <ActivityLogModal book={selectedBookActivity} onClose={() => setSelectedBookActivity(null)} />}
    </div>
  );
}
