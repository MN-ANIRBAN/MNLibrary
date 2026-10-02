import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, Users, MessageCircle, LifeBuoy, Info, CheckCheck } from "lucide-react";
import { useGroups } from "../hooks/useGroups";
import { useNotifications } from "../hooks/useNotifications";

export default function NotificationCenter({ user, onOpenTab }) {
  const { invitations, handleAcceptInvite, handleDeclineInvite } = useGroups(user);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(user);
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const totalNotifications = (invitations?.length || 0) + unreadCount;
  
  const getIconForType = (type) => {
    switch (type) {
      case 'group_invite': return <Users size={16} style={{ color: '#000' }} />;
      case 'role_updated': return <Shield size={16} style={{ color: '#000' }} />;
      case 'borrow_request': return <BookOpen size={16} style={{ color: '#000' }} />;
      default: return <Info size={16} style={{ color: '#000' }} />;
    }
  };

  const getBackgroundForType = (type) => {
    if (type?.includes('ticket')) return 'rgba(239, 68, 68, 0.1)';
    if (type?.includes('group')) return 'rgba(99, 102, 241, 0.1)';
    return 'var(--dash-border)';
  };

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);
    setIsOpen(false);
    if (onOpenTab) {
      if (notif.type.includes('ticket')) onOpenTab('support');
      if (notif.type.includes('group')) onOpenTab('groups');
    }
  };

  const unreadSysNotifs = notifications.filter(n => !n.is_read);

  if (totalNotifications === 0 && unreadSysNotifs.length === 0 && (!invitations || invitations.length === 0)) return (
    <div className="invitation-badge-container">
      <button
        className="invitation-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 42, height: 42, borderRadius: '12px', border: '1px solid var(--dash-border)',
          background: 'var(--dash-surface)', color: 'var(--text-2)', cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        <Bell size={18} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="invitation-dropdown"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'absolute', top: 'calc(100% + 12px)', left: 0, zIndex: 2000, width: 'min(320px, calc(100vw - 32px))', background: '#c1fd69', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
          >
            <div className="invitation-dropdown-header" style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(0,0,0,0.05)', padding: 6, borderRadius: 8, display: 'flex' }}>
                  <Bell size={16} style={{ color: '#000' }} />
                </div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#000' }}>Notifications</h4>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', color: '#000', padding: 4, borderRadius: '50%', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(0,0,0,0.6)', fontSize: '0.9rem', fontWeight: 600 }}>
              No new notifications
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="invitation-badge-container" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="invitation-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 42, height: 42, borderRadius: '12px', border: '1px solid var(--dash-border)',
          background: 'var(--dash-surface)', color: 'var(--dash-text)', cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        <Bell size={18} />
        {totalNotifications > 0 && (
          <span
            className="invitation-count"
            style={{
              position: 'absolute', top: -5, right: -5, background: '#c1fd69',
              color: '#000', borderRadius: '999px', fontSize: '11px', fontWeight: 800, minWidth: 18, height: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
              boxShadow: '0 2px 10px rgba(193, 253, 105, 0.4)'
            }}
          >
            {totalNotifications > 99 ? '99+' : totalNotifications}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="invitation-dropdown"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            style={{ position: 'absolute', top: 'calc(100% + 12px)', left: 0, zIndex: 2000, width: 'min(350px, calc(100vw - 32px))', background: '#c1fd69', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}
          >
            <div className="invitation-dropdown-header" style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(0,0,0,0.05)', padding: 6, borderRadius: 8, display: 'flex' }}>
                  <Bell size={16} style={{ color: '#000' }} />
                </div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#000' }}>Notifications</h4>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} title="Mark all as read" style={{ background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: '12px' }}>
                    <CheckCheck size={14} /> Read All
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', color: '#000', padding: 4, borderRadius: '50%', display: 'flex' }}>
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="invitation-list" style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 0' }}>
              {/* Group Invitations */}
              {invitations?.length > 0 && (
                <div style={{ padding: '8px 20px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Pending Invitations
                </div>
              )}
              {invitations?.map(invite => (
                <div key={invite.id} className="invitation-item" style={{ 
                  padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: '1px solid rgba(0,0,0,0.1)', transition: 'background 0.2s'
                }}>
                  <div className="invitation-info" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="invitation-group-name" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#000', fontSize: 14 }}>
                      <Users size={14} style={{ color: '#000' }} /> {invite.groups?.name || 'A Group'}
                    </span>
                    <span className="invitation-sender" style={{ fontSize: 12, color: 'rgba(0,0,0,0.7)', fontWeight: 500 }}>
                      Invited by <strong>{invite.inviterName || 'a member'}</strong>
                    </span>
                  </div>
                  <div className="invitation-actions" style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAcceptInvite(invite.id)} title="Accept" style={{
                      background: '#000', color: '#c1fd69', border: 'none', width: 32, height: 32, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                      <Check size={16} />
                    </button>
                    <button onClick={() => handleDeclineInvite(invite.id)} title="Decline" style={{
                      background: 'rgba(0,0,0,0.05)', color: '#000', border: 'none', width: 32, height: 32, borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {/* System Notifications (Unread) */}
              {unreadSysNotifs.length > 0 && (
                <div style={{ padding: '16px 20px 8px', fontSize: '0.75rem', fontWeight: 800, color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Recent Updates
                </div>
              )}
              {unreadSysNotifs.map(notif => (
                <div key={notif.id} className="notification-shortcut-item" onClick={() => handleNotificationClick(notif)}
                  style={{ 
                    padding: '12px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12,
                    borderBottom: '1px solid rgba(0,0,0,0.1)', transition: 'background 0.2s', position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ background: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    {getIconForType(notif.type)}
                  </div>
                  <div style={{ flex: 1, paddingRight: 20 }}>
                    <div style={{ fontWeight: 700, color: '#000', fontSize: 13, marginBottom: 2 }}>{notif.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.7)', lineHeight: 1.4, fontWeight: 500 }}>{notif.message}</div>
                    <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)', marginTop: 4, fontWeight: 700 }}>
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {/* Small unread dot */}
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#000', position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }} />
                </div>
              ))}
              
              {/* Fallback Message if empty */}
              {totalNotifications === 0 && (
                 <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(0,0,0,0.6)', fontSize: '0.85rem', fontWeight: 600 }}>
                   You're all caught up!
                 </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
