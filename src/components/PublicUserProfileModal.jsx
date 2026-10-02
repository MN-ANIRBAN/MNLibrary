import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, User, BookOpen, Heart, Activity, Eye, 
  Mail, Phone, ExternalLink, Hash, Info, Award
} from "lucide-react";
import { supabase } from "../supabase/config";
import "./PublicUserProfileModal.css";

export default function PublicUserProfileModal({ isOpen, onClose, targetUser }) {
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState(null);
  const [stats, setStats] = useState({ library: 0, wishlist: 0, read: 0 });
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const fetchPublicData = async () => {
      if (!targetUser || !isOpen) return;
      setLoading(true);
      setActiveTab('profile'); // Reset tab on open
      
      try {
        // Fetch full metadata using the RPC
        const { data: metaData, error: metaError } = await supabase.rpc('admin_get_user_metadata', { p_target_user_id: targetUser.id });
        if (!metaError && metaData) {
          setMetadata(metaData);
        }

        // Fetch basic stats
        const { data: booksData, error } = await supabase
          .from('books')
          .select('status, isWishlisted')
          .eq('user_id', targetUser.id);
          
        if (!error && booksData) {
          const library = booksData.filter(b => b.status !== 'wishlist' && !b.isWishlisted).length;
          const wishlist = booksData.filter(b => b.status === 'wishlist' || b.isWishlisted).length;
          const read = booksData.filter(b => b.status === 'read').length;
          setStats({ library, wishlist, read });
        }
      } catch (err) {
        console.error("Error fetching public profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicData();
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  const displayName = targetUser?.display_name || targetUser?.full_name || metadata?.full_name || metadata?.display_name || targetUser?.email?.split('@')[0] || "User";
  const avatarUrl = targetUser?.profile_picture_url || targetUser?.avatar_url || metadata?.avatar_url;
  const role = targetUser?.role || metadata?.role || 'member';
  const bio = metadata?.bio || "This user prefers to keep their bio a mystery. 🕵️‍♂️";
  
  // Contact
  const email = targetUser?.email || metadata?.email;
  const phone = targetUser?.phone_number || metadata?.phone_number || "Not provided";
  
  // Socials
  const socialInstagram = metadata?.social_instagram;
  const socialWhatsapp = metadata?.social_whatsapp;
  const socialTwitter = metadata?.social_twitter;
  const socialFacebook = metadata?.social_facebook;

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'contact', label: 'Contact', icon: <Phone size={16} /> },
    { id: 'social', label: 'Social', icon: <Hash size={16} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={16} /> }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="pupm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="pupm-modal-card"
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* View Only Badge */}
            <div className="pupm-view-only-badge">
              <Eye size={12} strokeWidth={2.5} /> VIEW ONLY
            </div>

            {/* Header Cover */}
            <div className="pupm-header-cover">
              <button className="pupm-close-btn" onClick={onClose} title="Close">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Avatar & Name */}
            <div className="pupm-avatar-container">
              <div className="pupm-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} />
                ) : (
                  <User size={40} color="rgba(255,255,255,0.5)" />
                )}
                <div className="pupm-status-dot"></div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 24px 0' }}>
              <h2 className="pupm-name">{displayName}</h2>
              <div className="pupm-role">
                <Award size={14} /> {role}
              </div>
            </div>

            {/* Premium Pill Tabs */}
            <div className="pupm-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pupm-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Body content based on tab */}
            <div className="pupm-body">
              
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Activity className="spinning-icon" size={32} style={{ color: '#60a5fa', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    
                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="pupm-info-card">
                          <label className="pupm-info-label">Full Name</label>
                          <div className="pupm-info-value">{displayName}</div>
                        </div>
                        <div className="pupm-info-card">
                          <label className="pupm-info-label">About</label>
                          <div className="pupm-info-value" style={{ whiteSpace: 'pre-wrap', fontStyle: !metadata?.bio ? 'italic' : 'normal', opacity: !metadata?.bio ? 0.7 : 1 }}>
                            {bio}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CONTACT TAB */}
                    {activeTab === 'contact' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="pupm-social-row">
                          <div className="pupm-social-icon">
                            <Mail size={22} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="pupm-info-label" style={{ marginBottom: 4 }}>Email Address</div>
                            <div className="pupm-info-value">{email || 'Hidden'}</div>
                          </div>
                        </div>

                        <div className="pupm-social-row">
                          <div className="pupm-social-icon">
                            <Phone size={22} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="pupm-info-label" style={{ marginBottom: 4 }}>Phone Number</div>
                            <div className="pupm-info-value">{phone}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SOCIALS TAB */}
                    {activeTab === 'social' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {[
                          { name: 'Instagram', val: socialInstagram },
                          { name: 'WhatsApp', val: socialWhatsapp },
                          { name: 'Twitter', val: socialTwitter },
                          { name: 'Facebook', val: socialFacebook }
                        ].map(s => (
                          <div key={s.name} className="pupm-social-row">
                            <div className="pupm-social-icon">
                              {s.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="pupm-info-label" style={{ marginBottom: 4 }}>{s.name}</div>
                              <div className="pupm-info-value">{s.val || <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Not provided</span>}</div>
                            </div>
                            {s.val && <ExternalLink size={18} color="rgba(255,255,255,0.4)" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'activity' && (
                      <div>
                        <div className="pupm-stats-grid">
                          <div className="pupm-stat-card">
                            <div className="pupm-stat-icon-wrapper">
                              <BookOpen size={20} />
                            </div>
                            <div className="pupm-stat-value">{stats.library}</div>
                            <div className="pupm-stat-label">Library</div>
                          </div>
                          <div className="pupm-stat-card">
                            <div className="pupm-stat-icon-wrapper">
                              <Heart size={20} />
                            </div>
                            <div className="pupm-stat-value">{stats.wishlist}</div>
                            <div className="pupm-stat-label">Wishlist</div>
                          </div>
                          <div className="pupm-stat-card">
                            <div className="pupm-stat-icon-wrapper">
                              <Activity size={20} />
                            </div>
                            <div className="pupm-stat-value">{stats.read}</div>
                            <div className="pupm-stat-label">Books Read</div>
                          </div>
                          <div className="pupm-stat-card">
                            <div className="pupm-stat-icon-wrapper">
                              <Award size={20} />
                            </div>
                            <div className="pupm-stat-value">Rank</div>
                            <div className="pupm-stat-label">Explorer</div>
                          </div>
                        </div>
                        <div style={{ marginTop: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 500 }}>
                          <Info size={16} /> Activity is based on public library data.
                        </div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
