import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Mail, MessageCircle, ChevronDown, ChevronUp,
  Loader2, BookOpen, Lock, Send, X, UserCheck, Clock, Trash2, Hourglass, Activity, MoreHorizontal, UserPlus, ImagePlus, User
} from "lucide-react";
import { useGroups } from "../hooks/useGroups";
import { uploadToImgBB } from "../supabase/groupService";
import { supabase } from "../supabase/config";
import GroupBookCard from "./GroupBookCard";
import GroupBookLogTable from "./GroupBookLogTable";
import GroupChatPanel from "./GroupChatPanel";
import CheckCheckIcon from "./CheckCheckIcon";
import PlusIcon from "./PlusIcon";
import XIcon from "./XIcon";
import toast from "react-hot-toast";

const ADMIN_EMAIL = "admin@mn-library.com";

export default function GroupPanel({ user, onUserClick, onStatusChange }) {
  const {
    groups,
    loading,
    handleCreateGroup,
    handleDeleteGroup,
    handleInviteUser,
    fetchPartnerBooks,
    fetchMySharedBooks,
    handleSendMessage,
    handleMarkHandover,
    handleUpdateGroupProfile,
    handleUpdateMemberRole,
    handleRemoveMember,
  } = useGroups(user);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteModalGroup, setInviteModalGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [expandedGroup, setExpandedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState({}); // { [groupId]: 'books' | 'chat' }
  const [partnerBooks, setPartnerBooks] = useState({});
  const [myBooks, setMyBooks] = useState({});
  const [loadingBooks, setLoadingBooks] = useState({});
  const [showChat, setShowChat] = useState({}); // { [groupId]: boolean }
  const [saveStatus, setSaveStatus] = useState({}); // { [groupId]: 'saved' | null }
  const [uploadingImage, setUploadingImage] = useState({}); // { [groupId]: boolean }
  const [uploadedImageUrl, setUploadedImageUrl] = useState({}); // { [groupId]: string }

  const filterHiddenBooks = useCallback((booksArray) => {
    return (booksArray || []).filter(book => {
      if (Array.isArray(book.activityLog)) {
        return !book.activityLog.some(log => log.type === 'hidden' && (log.userId === user?.id || log.by === user?.id));
      }
      return true;
    });
  }, [user]);

  const toggleGroup = useCallback(async (groupId) => {
    if (expandedGroup === groupId) {
      setExpandedGroup(null);
      return;
    }
    setExpandedGroup(groupId);
    setActiveTab(prev => ({ ...prev, [groupId]: prev[groupId] || 'books' }));

    setLoadingBooks(prev => ({ ...prev, [groupId]: true }));
    const [pBooks, mBooks] = await Promise.all([
      fetchPartnerBooks(groupId),
      fetchMySharedBooks(groupId)
    ]);
    setPartnerBooks(prev => ({ ...prev, [groupId]: filterHiddenBooks(pBooks) }));
    setMyBooks(prev => ({ ...prev, [groupId]: filterHiddenBooks(mBooks) }));
    setLoadingBooks(prev => ({ ...prev, [groupId]: false }));
  }, [expandedGroup, fetchPartnerBooks, fetchMySharedBooks, filterHiddenBooks]);

  const handleStatusChangeWrapper = useCallback(async (bookId, updateData) => {
    if (onStatusChange) {
      try {
        await onStatusChange(bookId, updateData);
      } catch (err) {
        console.error("Status update failed:", err);
      }
    }
    if (expandedGroup) {
      const updateState = (prev) => {
        const newState = { ...prev };
        if (newState[expandedGroup]) {
          newState[expandedGroup] = newState[expandedGroup].map(b => b.id === bookId ? { ...b, ...updateData } : b);
          newState[expandedGroup] = filterHiddenBooks(newState[expandedGroup]);
        }
        return newState;
      };
      setPartnerBooks(updateState);
      setMyBooks(updateState);
    }
  }, [onStatusChange, expandedGroup, filterHiddenBooks]);

  useEffect(() => {
    if (!expandedGroup) return;

    let isActive = true;
    const fetchBooks = async () => {
      const [pBooks, mBooks] = await Promise.all([
        fetchPartnerBooks(expandedGroup),
        fetchMySharedBooks(expandedGroup)
      ]);
      if (isActive) {
        setPartnerBooks(prev => ({ ...prev, [expandedGroup]: filterHiddenBooks(pBooks) }));
        setMyBooks(prev => ({ ...prev, [expandedGroup]: filterHiddenBooks(mBooks) }));
      }
    };

    const channel = supabase
      .channel(`public:group_messages:group-${expandedGroup}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${expandedGroup}` },
        (payload) => {
          if (isActive && payload.new?.content?.includes('SYSTEM_PAYLOAD:{"type":"book_update"')) {
            fetchBooks();
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [expandedGroup, fetchPartnerBooks, fetchMySharedBooks]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const nameToCreate = newGroupName ? newGroupName.trim() : "";
    if (!nameToCreate) return;
    
    setIsCreating(true);

    try {
      const emailInput = inviteEmail ? inviteEmail.trim() : "";
      if (emailInput) {
        const emails = emailInput.split(',').map(e => e.trim()).filter(e => e);
        for (const email of emails) {
          const lowerEmail = email.toLowerCase();
          const existingGroup = (groups || []).find(g => {
            if (!g || !g.group_members) return false;
            return g.group_members.some(m => {
              if (!m) return false;
              const hasInvited = m.invited_email && typeof m.invited_email === 'string' && m.invited_email.toLowerCase() === lowerEmail;
              const hasUser = m.users && m.users.email && typeof m.users.email === 'string' && m.users.email.toLowerCase() === lowerEmail;
              return hasInvited || hasUser;
            });
          });
          
          if (existingGroup) {
            toast.error(`You already have a group with ${email}.`);
            setIsCreating(false);
            return;
          }
        }
      }

      const group = await handleCreateGroup(nameToCreate);
      
      const emailInputAfter = inviteEmail ? inviteEmail.trim() : "";
      if (group && emailInputAfter) {
        const emails = emailInputAfter.split(',').map(e => e.trim()).filter(e => e);
        for (const email of emails) {
          try {
            await handleInviteUser(group.id, email);
          } catch (invErr) {
            console.error("Invite error:", invErr);
            // continue even if invite fails, group is created
          }
        }
      }
      
      setShowCreateModal(false);
      setNewGroupName("");
      setInviteEmail("");
    } catch (err) {
      console.error("Group creation error:", err);
      toast.error(err?.message || "Failed to create group.");
    } finally {
      setIsCreating(false);
    }
  };

  const getPartner = (group) => {
    if (!group.group_members) return null;
    return group.group_members.find(m => m.user_id !== user.id);
  };

  const generateWhatsAppLink = (groupId, inviteToken) => {
    const url = `${window.location.origin}?inviteGroup=${inviteToken || groupId}`;
    const msg = `You've been invited to join my book library group on MN-Library! Click here to join: ${url} \n\nDon't have an account? Email ${ADMIN_EMAIL} to get registered.`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const generateEmailLink = (partner, groupId) => {
    const inviteToken = partner?.invite_token || groupId;
    const url = `${window.location.origin}?inviteGroup=${inviteToken}`;
    return `mailto:${partner?.invited_email}?subject=Join my MN-Library Group&body=${encodeURIComponent(
      `Hi!\n\nI'd like to add you to my shared book library group.\n\nJoin here: ${url}\n\nIf you don't have an account yet, please email ${ADMIN_EMAIL} to get registered.\n\nSee you there!`
    )}`;
  };

  if (loading) {
    return (
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton-card" style={{ height: '120px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', height: '100%' }}>
              <div className="skeleton-wrapper skeleton-circle" style={{ width: 60, height: 60 }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                <div className="skeleton-wrapper skeleton-text title"></div>
                <div className="skeleton-wrapper skeleton-text short"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="group-panel-container">
      <style>{`
        .group-panel-container {
          --ref-card-bg: #e5e7eb; /* Updated light theme bg */
          --ref-text-primary: #1f2937;
          --ref-text-secondary: #6b7280;
          --ref-pill-border: rgba(0,0,0,0.15);
          --ref-icon-bg: #374151; /* Darker bg for purple icon */
          --ref-icon-color: #a78bfa;
          --ref-avatar-bg: #ffffff;
          --ref-avatar-color: #1f2937;
          --ref-progress-track: #d1d5db;
          --ref-progress-fill: #1f2937;
          --ref-action-bg: #ffffff;
        }

        [data-theme="dark"] .group-panel-container {
          --ref-card-bg: #374151; /* Updated dark theme bg */
          --ref-text-primary: #f3f4f6;
          --ref-text-secondary: #9ca3af;
          --ref-pill-border: rgba(255,255,255,0.15);
          --ref-icon-bg: #ffffff;
          --ref-icon-color: #1f2937;
          --ref-avatar-bg: #ffffff;
          --ref-avatar-color: #1f2937;
          --ref-progress-track: #4b5563;
          --ref-progress-fill: #ffffff;
          --ref-action-bg: transparent;
        }
      `}</style>

      {/* Groups List (Hidden if a group is expanded) */}
      {!expandedGroup && (
        <>
          <div className="group-panel-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 32px',
            background: 'transparent',
            position: 'relative',
            marginBottom: '28px',
            border: 'none',
            boxShadow: 'none'
          }}>
            <div className="gph-title" style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.02em' }}>
                Shared Groups
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#8b949e', fontWeight: '400' }}>
                Collaborate and view shared books with your partners.
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                position: 'relative', zIndex: 1,
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 24px', borderRadius: '10px', border: 'none',
                background: '#9333ea',
                color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(147, 51, 234, 0.25)'
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(147, 51, 234, 0.4)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(147, 51, 234, 0.25)'; }}
            >
              <Plus size={16} strokeWidth={3} /> Create Group
            </button>
          </div>

          <div className="groups-list">
            {groups.length === 0 ? (
              <div className="empty-groups-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Users size={56} style={{ color: 'var(--dash-text-muted)', marginBottom: 16, opacity: 0.4 }} />
                <h3 style={{ color: 'var(--dash-text)', marginBottom: 8 }}>No Groups Yet</h3>
                <p style={{ color: 'var(--dash-text-muted)' }}>Create a group and invite your partner to start sharing libraries.</p>
              </div>
            ) : (
              groups.map(group => {
                const allMembers = group.group_members || [];
                const otherMembers = allMembers.filter(m => (m.user_id && m.user_id !== user.id) || (!m.user_id && m.invited_email));
                const creator = allMembers.find(m => m.user_id === group.created_by) || allMembers[0];
                const creatorName = group.created_by === user.id ? 'You' : (creator?.users?.full_name || creator?.users?.email?.split('@')[0] || creator?.invited_email?.split('@')[0] || 'Unknown');

                const isExpanded = expandedGroup === group.id;
                const currentTab = activeTab[group.id] || 'books';
                const isGroupActive = allMembers.some(m => m.status === 'accepted' && m.user_id !== group.created_by);
                const isBooksLoading = loadingBooks[group.id];
                const pBooks = partnerBooks[group.id] || [];
                const mBooks = myBooks[group.id] || [];
                const myRole = allMembers.find(m => m.user_id === user.id)?.role || 'member';
                const isAdmin = myRole === 'admin' || myRole === 'owner';

                return (
                  <motion.div
                    key={group.id}
                    className="group-card-wrapper"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    {/* Header Area: Tab + Info */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      position: 'relative',
                      zIndex: 2,
                    }}>
                      {/* Left Tab */}
                      <div style={{
                        background: 'var(--ref-card-bg)',
                        borderRadius: '24px 24px 0 0',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        position: 'relative',
                        width: 'max-content',
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.02)'
                      }}>
                        {/* The swooping fillet using SVG */}
                        <svg width="40" height="40" viewBox="0 0 40 40" style={{ position: 'absolute', right: -40, bottom: 0, zIndex: 4, pointerEvents: 'none' }}>
                          <path d="M0,0 L0,40 L40,40 A40,40 0 0,1 0,0 Z" fill="var(--ref-card-bg)" />
                        </svg>

                        {/* Status Pill */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 16px', borderRadius: '999px',
                          border: '1px solid var(--ref-pill-border)',
                          fontSize: '13px', fontWeight: '700',
                          color: 'var(--ref-text-primary)',
                          background: 'transparent'
                        }}>
                          {isGroupActive ? <Hourglass size={14} /> : <Clock size={14} />}
                          {isGroupActive ? 'Ongoing' : 'Future'}
                        </div>

                        {/* Circular Icon */}
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'var(--ref-icon-bg)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--ref-icon-color)'
                        }}>
                          <Activity size={16} strokeWidth={2.5} />
                        </div>
                      </div>

                      {/* Right side info (sits on page background) */}
                      <div style={{
                        padding: '0 16px 12px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--ref-text-secondary)' }}>
                          Created by <span 
                            style={{ color: 'var(--ref-text-primary)', fontWeight: '600', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(creator?.users || { id: group.created_by }); }}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >{creatorName}</span>
                        </span>

                        <div style={{ display: 'flex', position: 'relative' }}>
                          {/* Avatar Stack */}
                          {otherMembers.slice(0, 3).map((member, idx) => (
                            <div key={idx} style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: 'var(--ref-action-bg)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: '700', color: 'var(--ref-text-primary)',
                              border: '2px solid var(--dash-bg)',
                              marginLeft: idx > 0 ? '-10px' : '0',
                              zIndex: 10 - idx,
                              cursor: 'pointer'
                            }}
                            onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(member.users || { id: member.user_id }); }}
                            title={member.users?.full_name || member.users?.email || member.invited_email}
                            >
                              {member.users?.full_name?.[0]?.toUpperCase() || member.users?.email?.[0]?.toUpperCase() || member.invited_email?.[0]?.toUpperCase() || '?'}
                            </div>
                          ))}
                          {otherMembers.length === 0 && (
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: 'var(--ref-action-bg)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: '700', color: 'var(--ref-text-primary)',
                              border: '2px solid var(--dash-bg)'
                            }}>
                              {user.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                          )}
                          {otherMembers.length > 3 && (
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%',
                              background: 'var(--dash-border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: '700', color: 'var(--dash-text)',
                              border: '2px solid var(--dash-bg)',
                              marginLeft: '-10px', zIndex: 7
                            }}>
                              +{otherMembers.length - 3}
                            </div>
                          )}
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setInviteModalGroup(group);
                              }}
                              style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: 'var(--dash-surface)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--dash-text-muted)',
                                border: '1px solid var(--dash-border)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                marginLeft: '8px', // Separated from avatar stack
                                zIndex: 1,
                                padding: 0
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.color = 'var(--indigo-color)';
                                e.currentTarget.style.boxShadow = '0 6px 12px rgba(99, 102, 241, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.color = 'var(--dash-text-muted)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                                e.currentTarget.style.borderColor = 'var(--dash-border)';
                              }}
                              title="Add Members"
                            >
                              <PlusIcon size={22} isAnimated />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Main Body Layer */}
                    <div
                      style={{
                        flex: 1,
                        background: 'var(--ref-card-bg)',
                        borderRadius: '0 24px 24px 24px',
                        position: 'relative',
                        zIndex: 1,
                        marginTop: '-1px', // FIXES THE SEAM
                        boxShadow: '0 12px 32px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div
                        onClick={() => toggleGroup(group.id)}
                        style={{
                          padding: '20px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                          <div style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            background: 'var(--ref-avatar-bg)',
                            color: 'var(--ref-avatar-color)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '24px', fontWeight: '800', flexShrink: 0,
                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)',
                            overflow: 'hidden'
                          }}>
                            {group.profile_picture ? (
                              <img src={group.profile_picture} alt={group.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              group.name?.charAt(0)?.toUpperCase() || 'G'
                            )}
                          </div>

                          <div style={{ flex: 1 }}>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: 'var(--ref-text-primary)' }}>
                              {group.name}
                            </h3>
                            {group.description && (
                              <p style={{ margin: '0', fontSize: '14px', color: 'var(--ref-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {group.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTab(prev => ({ ...prev, [group.id]: 'settings' }));
                              setExpandedGroup(group.id);
                            }}
                            style={{
                              border: 'none', background: 'transparent', color: 'var(--ref-text-secondary)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              padding: '12px', borderRadius: '50%',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ref-hover-bg)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            title="Options"
                          >
                            <MoreHorizontal size={24} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Expanded Group Full Screen View */}
      {expandedGroup && (() => {
        const group = groups.find(g => g.id === expandedGroup);
        if (!group) return null;

        const allMembers = group.group_members || [];
        const activeMembers = allMembers.filter(m => m.status === 'accepted');
        const otherMembers = allMembers.filter(m => (m.user_id && m.user_id !== user.id) || (!m.user_id && m.invited_email));

        const currentTab = activeTab[group.id] || 'books';
        const isGroupActive = activeMembers.length > 1; // At least one person other than creator accepted
        const isBooksLoading = loadingBooks[group.id];
        const pBooks = partnerBooks[group.id] || [];
        const mBooks = myBooks[group.id] || [];

        const myRole = allMembers.find(m => m.user_id === user.id)?.role || 'member';
        const isAdmin = myRole === 'admin' || myRole === 'owner';

        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="expanded-group-fullscreen-ai"
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              display: 'flex', flexDirection: 'row',
              padding: 'clamp(12px, 2vw, 24px)', gap: 'clamp(12px, 2vw, 24px)',
              overflow: 'hidden'
            }}
          >
            {/* Column 1: Left Sidebar */}
            <div style={{
              width: 'clamp(220px, 20vw, 260px)', display: 'flex', flexDirection: 'column', flexShrink: 0,
              gap: '24px', padding: '16px 12px'
            }}>
              {/* Sidebar Header (Group Info) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--indigo-color), var(--purple-color))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0
                }}>
                  {group.profile_picture ? (
                    <img src={group.profile_picture} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Users size={20} color="#fff" />
                  )}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--dash-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</h3>
                  <div style={{ fontSize: 12, color: 'var(--dash-text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeMembers.length} active member(s)
                  </div>
                </div>
              </div>

              {/* Vertical Tabs Navigation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['books', 'chat', 'settings'].map(tab => (
                  <button
                    key={tab}
                    className={`ai-pill ${currentTab === tab ? 'ai-pill-active' : 'ai-pill-inactive'}`}
                    onClick={() => setActiveTab(prev => ({ ...prev, [group.id]: tab }))}
                    style={{
                      padding: '12px 16px', border: 'none', cursor: 'pointer',
                      borderRadius: '12px',
                      fontWeight: currentTab === tab ? 600 : 500, fontSize: 13,
                      display: 'flex', alignItems: 'center', gap: 12,
                      transition: 'all 0.2s',
                    }}
                  >
                    {tab === 'books' && <BookOpen size={16} />}
                    {tab === 'chat' && <MessageCircle size={16} />}
                    {tab === 'settings' && <Activity size={16} />}
                    {tab === 'books' ? 'Shared Books' : tab === 'chat' ? 'Group Chat' : 'Settings'}
                  </button>
                ))}
              </div>

              {/* Bottom Profile */}
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, padding: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#d1d5db', overflow: 'hidden' }}>
                  {user?.profile?.profile_picture_url || user?.user_metadata?.avatar_url ? (
                    <img src={user?.profile?.profile_picture_url || user?.user_metadata?.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" />
                  ) : (
                    <User size={18} color="#64748b" style={{ margin: '9px' }} />
                  )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dash-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.profile?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--dash-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Online
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Center Main Content */}
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', gap: 16
            }}>
              {/* Floating Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--dash-text)' }}>{currentTab === 'books' ? 'Shared Books' : currentTab === 'chat' ? 'Group Chat' : 'Settings'}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--dash-text-secondary)', marginTop: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Connected to Analytics Engine
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button onClick={() => setExpandedGroup(null)} style={{ background: 'var(--dash-hover-bg)', border: '1px solid var(--dash-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--dash-text)', width: 36, height: 36, borderRadius: '50%', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-border)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--dash-hover-bg)'}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Main Content White Card */}
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                background: 'var(--dash-surface)',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: 'var(--dash-shadow-lg)'
              }}>
                {/* Tab Content */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {currentTab === 'books' && (
                    <div style={{ padding: '24px' }}>
                      {!isGroupActive ? (
                        <div style={{
                          textAlign: 'center', padding: '32px 20px',
                          color: 'var(--dash-text-muted)', background: 'var(--dash-hover-bg)', borderRadius: 12
                        }}>
                          <Clock size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                          <p style={{ margin: 0, fontWeight: 500 }}>Waiting for other members to join.</p>
                          <p style={{ margin: '8px 0 0', fontSize: 12 }}>Books will appear here once they join.</p>
                        </div>
                      ) : isBooksLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="skeleton-list-row">
                               <div className="skeleton-wrapper skeleton-circle" style={{ width: 32, height: 32, borderRadius: 8 }}></div>
                               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                 <div className="skeleton-wrapper skeleton-text"></div>
                                 <div className="skeleton-wrapper skeleton-text short"></div>
                               </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {/* Partner's Books */}
                          <div style={{ marginBottom: 28 }}>
                            <h4 style={{
                              margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              <Lock size={12} /> Other Members' Shared Books (Read-Only)
                            </h4>
                            {pBooks.length === 0 ? (
                              <div style={{ padding: '20px', borderRadius: 12, textAlign: 'center', background: 'var(--dash-hover-bg)', color: 'var(--dash-text-muted)', fontSize: 13 }}>
                                Other members have no borrowed/lent books to show yet.
                              </div>
                            ) : (
                              <GroupBookLogTable
                                books={pBooks}
                                partnerName="Other Members"
                                isReadOnly={true}
                                currentUser={user}
                                onMarkHandover={(bookId, action) => handleMarkHandover(bookId, group.id, action)}
                                onStatusChange={handleStatusChangeWrapper}
                              />
                            )}
                          </div>

                          {/* My Shared Books */}
                          <div>
                            <h4 style={{
                              margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: 'var(--dash-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px',
                              display: 'flex', alignItems: 'center', gap: 6
                            }}>
                              <BookOpen size={12} /> My Shared Books
                            </h4>
                            {mBooks.length === 0 ? (
                              <div style={{ padding: '20px', borderRadius: 12, textAlign: 'center', background: 'var(--dash-hover-bg)', color: 'var(--dash-text-muted)', fontSize: 13 }}>
                                You have no borrowed/lent books in your library yet. Add a book with status "Borrowed" or "Lent" to share it here.
                              </div>
                            ) : (
                              <GroupBookLogTable
                                books={mBooks}
                                partnerName="Me"
                                isReadOnly={false}
                                currentUser={user}
                                onMarkHandover={(bookId, action) => handleMarkHandover(bookId, group.id, action)}
                                onStatusChange={handleStatusChangeWrapper}
                              />
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {currentTab === 'chat' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {!isGroupActive ? (
                        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--dash-text-muted)' }}>
                          <p>Chat is available once at least one other member has joined.</p>
                        </div>
                      ) : (
                        <GroupChatPanel group={group} user={user} onSendMessage={handleSendMessage} onUserClick={onUserClick} />
                      )}
                    </div>
                  )}

                  {currentTab === 'settings' && (
                    <div style={{ padding: '32px 40px', maxWidth: '800px' }}>

                      {/* Group Profile Section */}
                      <div style={{ marginBottom: '40px' }}>
                        <h4 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: 'var(--dash-text)' }}>Group Profile</h4>

                        {isAdmin ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const btn = e.target.querySelector('button[type="submit"]');
                              btn.innerText = 'Saving...';
                              btn.disabled = true;
                              setSaveStatus(prev => ({ ...prev, [group.id]: null }));
                              try {
                                await handleUpdateGroupProfile(group.id, e.target.name.value, e.target.description.value, e.target.profile_picture.value);
                                btn.innerText = 'Save Profile';
                                btn.disabled = false;
                                setSaveStatus(prev => ({ ...prev, [group.id]: 'saved' }));
                                setTimeout(() => {
                                  setSaveStatus(prev => ({ ...prev, [group.id]: null }));
                                }, 3000);
                              } catch (err) {
                                btn.innerText = 'Failed';
                                setTimeout(() => { btn.innerText = 'Save Profile'; btn.disabled = false; }, 2000);
                              }
                            }}
                            style={{
                              display: 'flex', flexDirection: 'column', gap: '24px',
                              background: 'var(--dash-bg)',
                              padding: '32px', borderRadius: '20px', border: '1px solid var(--dash-border)'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--dash-surface)', overflow: 'hidden', border: '1px solid var(--dash-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {(uploadedImageUrl[group.id] || group.profile_picture) ? (
                                    <img src={uploadedImageUrl[group.id] || group.profile_picture} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : <Users size={32} color="var(--dash-text-muted)" />}
                                </div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`group-pic-upload-${group.id}`}
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files[0];
                                    if (!file) return;
                                    setUploadingImage(prev => ({ ...prev, [group.id]: true }));
                                    try {
                                      const url = await uploadToImgBB(file);
                                      setUploadedImageUrl(prev => ({ ...prev, [group.id]: url }));
                                    } catch (error) {
                                      alert("Upload failed: " + error.message);
                                    } finally {
                                      setUploadingImage(prev => ({ ...prev, [group.id]: false }));
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`group-pic-upload-${group.id}`}
                                  style={{
                                    padding: '6px 12px', background: 'var(--dash-surface)', border: '1px solid var(--dash-border)',
                                    borderRadius: '8px', fontSize: 12, fontWeight: 600, color: 'var(--dash-text)', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 0.2s', whiteSpace: 'nowrap'
                                  }}
                                >
                                  {uploadingImage[group.id] ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />}
                                  {uploadingImage[group.id] ? "Uploading..." : "Upload Picture"}
                                </label>
                                <input type="hidden" name="profile_picture" value={uploadedImageUrl[group.id] || group.profile_picture || ''} />
                              </div>

                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Group Name</label>
                                  <input name="name" defaultValue={group.name || ''} placeholder="Group Name" style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)', fontSize: '14px', transition: 'border-color 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--dash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</label>
                                  <input name="description" defaultValue={group.description || ''} placeholder="What is this group about?" style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)', fontSize: '14px', transition: 'border-color 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} />
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginTop: '8px' }}>
                              {saveStatus[group.id] === 'saved' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '13px', fontWeight: 600 }}>
                                  <CheckCheckIcon size={18} color="#10b981" />
                                  <span>Saved</span>
                                </div>
                              )}
                              <button type="submit" style={{ padding: '12px 28px', borderRadius: '12px', border: 'none', background: 'var(--indigo-color)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 4px 12px rgba(99,102,241,0.2)', transition: 'all 0.2s' }}>Save Profile</button>
                            </div>
                          </form>
                        ) : (
                          <div style={{ color: 'var(--dash-text-secondary)', fontSize: '14px', background: 'var(--dash-bg)', padding: '24px', borderRadius: '16px', border: '1px dashed var(--dash-border)' }}>
                            <p style={{ margin: '0 0 8px 0' }}><strong>Description:</strong> {group.description || 'No description provided.'}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--dash-text-muted)' }}><em>Only admins can edit the group profile.</em></p>
                          </div>
                        )}
                      </div>

                      {/* Members Section */}
                      <div style={{ marginBottom: '40px' }}>
                        <h4 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 700, color: 'var(--dash-text)' }}>Members ({allMembers.length})</h4>

                        {isAdmin && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (e.target.email.value) {
                                const emails = e.target.email.value.split(',').map(e => e.trim()).filter(e => e);
                                for (const email of emails) {
                                  await handleInviteUser(group.id, email);
                                }
                                e.target.email.value = '';
                              }
                            }}
                            style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--dash-bg)', padding: '16px', borderRadius: '16px', border: '1px solid var(--dash-border)' }}
                          >
                            <input name="email" placeholder="Email addresses (comma separated)" type="text" required style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)', fontSize: '14px' }} />
                            <button type="submit" style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', background: 'var(--indigo-color)', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>Invite User</button>
                          </form>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {allMembers.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'var(--dash-bg)', borderRadius: '16px', border: '1px solid var(--dash-border)' }}>
                              <div 
                                style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(m.users || { id: m.user_id }); }}
                              >
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--dash-hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {m.users?.avatar_url ? (
                                    <img src={m.users.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <User size={20} color="var(--dash-text-secondary)" />
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600, color: 'var(--dash-text)', fontSize: '15px' }}>
                                    {m.user_id === user.id ? 'You' : (m.users?.full_name || m.users?.email?.split('@')[0] || m.invited_email?.split('@')[0] || 'Unknown')}
                                    {m.role === 'owner' && <span style={{ marginLeft: 10, fontSize: '11px', padding: '4px 8px', background: 'var(--purple-color)', color: '#fff', borderRadius: '6px' }}>Owner</span>}
                                    {m.role === 'admin' && <span style={{ marginLeft: 10, fontSize: '11px', padding: '4px 8px', background: 'var(--indigo-color)', color: '#fff', borderRadius: '6px' }}>Admin</span>}
                                  </div>
                                  <div style={{ fontSize: '13px', color: 'var(--dash-text-muted)', marginTop: '4px', textTransform: 'capitalize' }}>
                                    Status: <span style={{ color: m.status === 'accepted' ? '#10b981' : '#f59e0b', fontWeight: 500 }}>{m.status}</span>
                                  </div>
                                </div>
                              </div>
                              {isAdmin && m.user_id !== group.created_by && m.user_id !== user.id && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {m.role !== 'admin' && (
                                    <button onClick={() => handleUpdateMemberRole(group.id, m.user_id, 'admin')} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--dash-surface)'}>Make Admin</button>
                                  )}
                                  {m.role === 'admin' && (
                                    <button onClick={() => handleUpdateMemberRole(group.id, m.user_id, 'member')} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: '1px solid var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--dash-hover-bg)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--dash-surface)'}>Make Member</button>
                                  )}
                                  <button onClick={() => handleRemoveMember(group.id, m.user_id)} style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 500, borderRadius: '8px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444' }}>Remove</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {isAdmin && (
                        <div style={{ marginTop: '20px', padding: '32px', background: 'rgba(239, 68, 68, 0.03)', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: '#ef4444', fontSize: '16px', fontWeight: 700 }}>Danger Zone</h4>
                          <p style={{ margin: '0 0 20px 0', color: 'var(--dash-text-secondary)', fontSize: '14px' }}>Once you delete a group, there is no going back. All chat history and shared book logs will be permanently removed.</p>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete the group "${group.name}"?`)) {
                                handleDeleteGroup(group.id);
                              }
                            }}
                            style={{
                              padding: '12px 20px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', cursor: 'pointer', fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'; e.currentTarget.style.color = '#ef4444'; }}
                          >
                            <Trash2 size={18} /> Delete this group
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Right Sidebar (Insights / Timeline) */}
            <div style={{
              width: 'clamp(260px, 25vw, 320px)', flexShrink: 0,
              background: 'var(--dash-surface)', borderRadius: '24px',
              boxShadow: 'var(--dash-shadow-lg)',
              display: 'flex', flexDirection: 'column',
              padding: '24px',
              marginTop: '56px' // Pushes down below the main header
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dash-text)', margin: '0 0 20px 0' }}>Group Members</h3>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activeMembers.map((m, idx) => (
                  <div key={m.id || idx} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px',
                    background: 'var(--dash-bg)', borderRadius: 16,
                    border: '1px solid var(--dash-border)',
                    cursor: 'pointer'
                  }} onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(m.users || { id: m.user_id }); }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--dash-hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {m.users?.avatar_url ? (
                        <img src={m.users.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <User size={16} color="var(--dash-text-secondary)" />
                      )}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dash-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.user_id === user.id ? 'You' : (m.users?.full_name || m.users?.email?.split('@')[0] || m.invited_email?.split('@')[0] || 'Unknown')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--dash-text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
                        {m.role}
                      </div>
                    </div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              style={{
                width: '100%', maxWidth: 480,
                background: 'var(--dash-surface)',
                border: '1px solid var(--dash-border)',
                borderRadius: 24,
                overflow: 'hidden'
              }}
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid var(--dash-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--indigo-color), var(--purple-color))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Users size={22} color="#fff" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--dash-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                      Collaboration
                    </p>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--dash-text)' }}>
                      Create Group
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)', padding: 4, borderRadius: 8 }}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateSubmit} style={{ padding: '28px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: 8 }}>
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={e => setNewGroupName(e.target.value)}
                      placeholder="e.g. Book Club Duo"
                      required
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '12px 16px', borderRadius: 12, fontSize: 15,
                        border: '1px solid var(--dash-border)',
                        background: 'var(--dash-hover-bg)',
                        color: 'var(--dash-text)',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--dash-text-secondary)', marginBottom: 8 }}>
                      Partner Emails <span style={{ color: 'var(--dash-text-muted)', fontWeight: 400 }}>(comma separated)</span>
                    </label>
                    <input
                      type="text"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="user1@example.com, user2@example.com"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        padding: '12px 16px', borderRadius: 12, fontSize: 15,
                        border: '1px solid var(--dash-border)',
                        background: 'var(--dash-hover-bg)',
                        color: 'var(--dash-text)',
                        outline: 'none'
                      }}
                    />
                    <div style={{
                      marginTop: 10, padding: '10px 14px', borderRadius: 10,
                      background: 'var(--indigo-bg)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      fontSize: 12, color: 'var(--dash-text-secondary)', lineHeight: 1.5
                    }}>
                      ✉️ If your partner is a portal user, they'll receive an in-app notification to accept.
                      If they're not registered yet, you can share the invite via <strong>WhatsApp or Email</strong> after creating the group.
                      They can also email <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: 'var(--indigo-color)' }}>{ADMIN_EMAIL}</a> to get an account.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 28, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '11px 22px', borderRadius: 12,
                      border: '1px solid var(--dash-border)',
                      background: 'transparent', color: 'var(--dash-text)',
                      fontWeight: 600, cursor: 'pointer', fontSize: 14
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newGroupName.trim()}
                    style={{
                      padding: '11px 24px', borderRadius: 12, border: 'none',
                      background: 'linear-gradient(135deg, var(--indigo-color), var(--purple-color))',
                      color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                      display: 'flex', alignItems: 'center', gap: 8,
                      opacity: (isCreating || !newGroupName.trim()) ? 0.65 : 1,
                      transition: 'opacity 0.15s'
                    }}
                  >
                    {isCreating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Users size={16} />}
                    {isCreating ? 'Creating...' : 'Create Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Member Modal */}
      <AnimatePresence>
        {inviteModalGroup && (() => {
          const group = inviteModalGroup;
          const allMembers = group.group_members || [];
          const myRole = allMembers.find(m => m.user_id === user.id)?.role || 'member';
          const isAdmin = myRole === 'admin' || myRole === 'owner';

          return (
            <motion.div
              style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInviteModalGroup(null)}
            >
              <motion.div
                style={{
                  width: '100%', maxWidth: 500,
                  background: 'var(--dash-surface)',
                  border: '1px solid var(--dash-border)',
                  borderRadius: 24,
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  maxHeight: '85vh'
                }}
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{
                  padding: '24px 28px',
                  borderBottom: '1px solid var(--dash-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--ref-card-bg)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'var(--ref-action-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--indigo-color)'
                    }}>
                      <UserPlus size={22} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--dash-text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Manage Members
                      </p>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--dash-text)' }}>
                        {group.name}
                      </h2>
                    </div>
                  </div>
                  <button
                    onClick={() => setInviteModalGroup(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dash-text-muted)', padding: 4, borderRadius: 8 }}
                  >
                    <X size={22} />
                  </button>
                </div>

                <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
                  {isAdmin && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (e.target.email.value) {
                          const emails = e.target.email.value.split(',').map(e => e.trim()).filter(e => e);
                          for (const email of emails) {
                            await handleInviteUser(group.id, email);
                          }
                          e.target.email.value = '';
                        }
                      }}
                      style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}
                    >
                      <input name="email" placeholder="Email addresses (comma separated)" type="text" required style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--dash-border)', background: 'var(--dash-hover-bg)', color: 'var(--dash-text)' }} />
                      <button type="submit" style={{ padding: '12px 20px', borderRadius: '10px', border: 'none', background: 'var(--indigo-color)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Invite</button>
                    </form>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--dash-text-secondary)' }}>Current Members</h4>
                    {allMembers.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--dash-hover-bg)', borderRadius: '12px' }}>
                        <div 
                          style={{ cursor: 'pointer' }} 
                          onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(m.users || { id: m.user_id }); }}
                        >
                          <div style={{ fontWeight: 600, color: 'var(--dash-text)', fontSize: '14px' }}>
                            {m.user_id === user.id ? 'You' : (m.users?.full_name || m.users?.email?.split('@')[0] || m.invited_email?.split('@')[0] || 'Unknown')}
                            {m.role === 'owner' && <span style={{ marginLeft: 8, fontSize: '11px', padding: '2px 6px', background: 'var(--purple-color)', color: '#fff', borderRadius: '4px' }}>Owner</span>}
                            {m.role === 'admin' && <span style={{ marginLeft: 8, fontSize: '11px', padding: '2px 6px', background: 'var(--indigo-color)', color: '#fff', borderRadius: '4px' }}>Admin</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--dash-text-muted)', marginTop: '4px' }}>Status: {m.status}</div>
                        </div>
                        {isAdmin && m.user_id !== group.created_by && m.user_id !== user.id && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {m.role !== 'admin' && (
                              <button onClick={() => handleUpdateMemberRole(group.id, m.user_id, 'admin')} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--dash-border)', background: 'transparent', color: 'var(--dash-text)', cursor: 'pointer' }}>Make Admin</button>
                            )}
                            {m.role === 'admin' && (
                              <button onClick={() => handleUpdateMemberRole(group.id, m.user_id, 'member')} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--dash-border)', background: 'transparent', color: 'var(--dash-text)', cursor: 'pointer' }}>Make Member</button>
                            )}
                            <button onClick={() => handleRemoveMember(group.id, m.user_id)} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', cursor: 'pointer' }}>Remove</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
