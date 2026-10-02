import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase/config';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle, AlertCircle, X, Send, Tag, Type, AlignLeft, AlertOctagon, Activity, Image as ImageIcon, Paperclip, Search, ArrowLeft, User, Mail, Phone, Calendar, ChevronDown, Reply } from 'lucide-react';
import { validateImageFile } from '../utils/fileValidator';
import { getUserFacingError } from '../utils/errorHandler';

export default function SupportPanel({ user, isAdmin, onUserClick }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for creating a new ticket
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', category: 'General', priority: 'normal', description: '' });
  const [newTicketImage, setNewTicketImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for viewing/administering a ticket
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyImage, setReplyImage] = useState(null);
  const [ticketStatus, setTicketStatus] = useState('open');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [activeTab, setActiveTab] = useState('All');

  const [isDragging, setIsDragging] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  const chatMessagesRef = useRef(null);

  const formatTicketId = (id) => {
    if (!id) return '';
    // Use first 6 chars of ID for a clean, recognizable ticket number
    return `#MNL-${id.toString().substring(0, 6).toUpperCase()}`;
  };

  const uploadToImgBB = async (file) => {
    if (!file) return null;

    // Validate file before uploading (type + magic bytes + size)
    const validation = await validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return null;
    }

    const formData = new FormData();
    formData.append("image", file);
    try {
      const response = await fetch(`/api/imgbb`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error(data.error?.message || "ImgBB upload failed");
      }
    } catch (err) {
      console.error("ImgBB upload error:", err);
      toast.error(getUserFacingError(err, 'SupportImgBB'));
      return null;
    }
  };

  const getParsedMessages = (ticket) => {
    if (!ticket || !ticket.admin_notes) return [];
    try {
      const parsed = JSON.parse(ticket.admin_notes);
      if (Array.isArray(parsed)) return parsed;
      return []; // fallback if not an array
    } catch (e) {
      // Legacy text note
      return [{
        id: 'legacy-1',
        role: 'admin',
        text: ticket.admin_notes,
        timestamp: ticket.created_at || new Date().toISOString()
      }];
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);
      let query = supabase.from('support_tickets').select(`
        *,
        users ( display_name, email, phone_number )
      `).order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      let fetchedData = data || [];

      // Auto-cleanup old resolved tickets (> 30 days)
      const cutoffTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const oldTickets = fetchedData.filter(t => t.status === 'resolved' && t.created_at < cutoffTime);

      if (oldTickets.length > 0) {
        const oldIds = oldTickets.map(t => t.id);
        // Fire and forget delete to clear from database
        supabase.from('support_tickets').delete().in('id', oldIds).then(({ error }) => {
          if (error) console.error("Error auto-deleting old tickets:", error);
        });
        // Remove them from the current UI state
        fetchedData = fetchedData.filter(t => !oldIds.includes(t.id));
      }

      setTickets(fetchedData);
    } catch (error) {
      toast.error('Failed to load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();

    const channelName = `public:support_tickets:user_${user.id}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        (payload) => {
          fetchTickets();
          setSelectedTicket(currentSelected => {
            if (currentSelected && payload.new && currentSelected.id === payload.new.id) {
              return { ...currentSelected, ...payload.new, users: currentSelected.users };
            }
            return currentSelected;
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'TIMED_OUT') {
          console.warn('Realtime subscription timed out.');
        }
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user.id, isAdmin]);

  // Scroll to bottom of chat when new messages appear or selected ticket changes
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [selectedTicket?.admin_notes, selectedTicket?.id]);

  // Auto-mark notifications as read when viewing a ticket
  useEffect(() => {
    if (selectedTicket && user?.id) {
      supabase.from('system_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('reference_id', selectedTicket.id)
        .eq('is_read', false)
        .then(() => { }); // silent update
    }
  }, [selectedTicket?.id, user?.id]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (newTicketImage) {
        toast.loading('Uploading image...', { id: 'upload' });
        imageUrl = await uploadToImgBB(newTicketImage);
        toast.dismiss('upload');
      }

      const initialMsg = [];
      if (imageUrl) {
        initialMsg.push({
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          sender_id: user.id,
          sender_name: user.display_name || user.email,
          role: 'user',
          text: 'Attached image for initial report.',
          imageUrl: imageUrl,
          timestamp: new Date().toISOString()
        });
      }

      // Auto-acknowledgement message
      initialMsg.push({
        id: (Date.now() + 1).toString() + Math.random().toString(36).substring(2, 9),
        sender_id: 'system',
        sender_name: 'Support Team',
        role: 'admin',
        text: 'Thank you for reaching out! We have received your ticket and our team will get back to you shortly.',
        imageUrl: null,
        timestamp: new Date(Date.now() + 1000).toISOString() // 1 second later
      });

      const initialNotes = JSON.stringify(initialMsg);

      const { data, error } = await supabase.from('support_tickets').insert([
        {
          user_id: user.id,
          subject: newTicket.subject,
          category: newTicket.category,
          priority: newTicket.priority,
          description: newTicket.description,
          status: 'open',
          admin_notes: initialNotes
        }
      ]).select();
      if (error) throw error;

      try {
        await supabase.rpc('notify_all_admins', {
          p_type: 'ticket_created',
          p_reference_id: data ? data[0]?.id : 'unknown',
          p_title: 'New Support Ticket',
          p_message: `New ticket: "${newTicket.subject}"`
        });
      } catch (e) {
        console.error("Failed to notify admins", e);
        toast.error('Failed to notify admins.');
      }

      toast.success('Ticket submitted successfully.');
      setShowCreateModal(false);
      setNewTicket({ subject: '', category: 'General', priority: 'normal', description: '' });
      setNewTicketImage(null);
      fetchTickets();
    } catch (err) {
      toast.dismiss('upload');
      toast.error(getUserFacingError(err, 'submitTicket'));
    }
    setIsSubmitting(false);
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() && !replyImage) {
      toast.error('Please enter a message or attach an image.');
      return;
    }

    setIsSubmitting(true);
    try {
      let imageUrl = null;
      if (replyImage) {
        toast.loading('Uploading image...', { id: 'upload-reply' });
        imageUrl = await uploadToImgBB(replyImage);
        toast.dismiss('upload-reply');
      }

      const { data: latestData, error: fetchErr } = await supabase
        .from('support_tickets')
        .select('admin_notes')
        .eq('id', selectedTicket.id)
        .single();

      if (fetchErr) throw fetchErr;

      const currentMessages = getParsedMessages(latestData);
      const newMessage = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        sender_id: user?.id || 'unknown',
        sender_name: (user?.display_name || user?.email || 'User').toString(),
        role: isAdmin ? 'admin' : 'user',
        text: replyMessage.trim() || (imageUrl ? 'Sent an attachment.' : ''),
        imageUrl: imageUrl,
        timestamp: new Date().toISOString(),
        replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, sender_name: replyingTo.sender_name } : null
      };

      const updatedMessages = [...currentMessages, newMessage];
      const newAdminNotesString = JSON.stringify(updatedMessages);

      const { data, error } = await supabase.from('support_tickets')
        .update({ admin_notes: newAdminNotesString })
        .eq('id', selectedTicket.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('RLS Blocked: No permission to update this ticket.');

      // Send Notification for Reply
      try {
        if (isAdmin) {
          await supabase.rpc('upsert_system_notification', {
            p_user_id: selectedTicket.user_id,
            p_type: 'ticket_message',
            p_reference_id: selectedTicket.id,
            p_title: 'Ticket Reply',
            p_message: `An admin replied to your ticket ${formatTicketId(selectedTicket.id)}`
          });
        } else {
          await supabase.rpc('notify_all_admins', {
            p_type: 'ticket_message',
            p_reference_id: selectedTicket.id,
            p_title: 'Ticket Reply',
            p_message: `New reply on ticket ${formatTicketId(selectedTicket.id)}`
          });
        }
      } catch (e) {
        console.error("Failed to send reply notification", e);
        toast.error('Failed to send reply notification.');
      }

      setReplyMessage('');
      setReplyImage(null);
      setReplyingTo(null);
      fetchTickets();
      setSelectedTicket({ ...selectedTicket, admin_notes: newAdminNotesString });
    } catch (err) {
      toast.dismiss('upload-reply');
      console.error("Reply Submit Error:", err);
      toast.error(getUserFacingError(err, 'sendReply'));
    }
    setIsSubmitting(false);
  };

  const handleUpdateTicketStatus = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsUpdatingStatus(true);
    try {
      const { data, error } = await supabase.from('support_tickets')
        .update({ status: ticketStatus })
        .eq('id', selectedTicket.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('RLS Blocked: No permission to update this ticket.');

      try {
        await supabase.rpc('upsert_system_notification', {
          p_user_id: selectedTicket.user_id,
          p_type: 'ticket_update',
          p_reference_id: selectedTicket.id,
          p_title: 'Ticket Status Updated',
          p_message: `Your ticket ${formatTicketId(selectedTicket.id)} is now ${ticketStatus.replace('_', ' ').toUpperCase()}`
        });
      } catch (e) {
        console.error("Failed to send status update notification", e);
        toast.error('Failed to send status update notification.');
      }

      toast.success('Ticket status updated.');
      fetchTickets();
      setSelectedTicket({ ...selectedTicket, status: ticketStatus });
    } catch (err) {
      toast.error(getUserFacingError(err, 'updateStatus'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle size={14} className="text-blue-500" />;
      case 'in_progress': return <Clock size={14} className="text-yellow-500" />;
      case 'resolved': return <CheckCircle size={14} className="text-green-500" />;
      default: return <MessageSquare size={14} />;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        setReplyImage(file);
        toast.success(`Attached ${file.name}`);
      } else {
        toast.error('Only image files can be attached.');
      }
    }
  };

  const filteredTickets = tickets.filter(t => {
    const searchMatch = formatTicketId(t.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    if (!searchMatch) return false;

    if (activeTab === 'All') return true;
    if (activeTab === 'Open' && t.status !== 'resolved') return true;
    if (activeTab === 'Resolved' && t.status === 'resolved') return true;

    return false;
  });

  return (
    <div className={`hd-container ${showMobileDetail ? 'show-detail' : ''}`}>
      <style>{`
        /* CSS Variables based on Ref 1 (Dark Mode) and Ref 2 (Light Mode) */
        :root {
          /* Light Mode (Ref 2) */
          --hd-bg-main: transparent;
          --hd-text-main: var(--text-1);
          --hd-text-muted: var(--text-2);
          --hd-item-hover: rgba(0, 0, 0, 0.05);
          --hd-item-selected: #93abc1;
          --hd-item-selected-text: #ffffff;
          --hd-pill-bg: transparent;
          --hd-pill-border: rgba(0, 0, 0, 0.1);
          --hd-pill-text: rgba(0, 0, 0, 0.5);
          --hd-pill-selected-bg: #111111;
          --hd-pill-selected-text: #ffffff;
          --hd-pill-selected-border: #111111;
          
          --hd-bg-tabs: #ffffff;
          --hd-text-tabs: #111111;
          --hd-tab-hover: rgba(0, 0, 0, 0.05);
          
          --hd-bg-right: #93abc1;
          --hd-text-right: #ffffff;
          --hd-bg-right-inner: rgba(255, 255, 255, 0.2);
          
          --hd-accent: #ccff00;
          --hd-accent-text: #111111;
          
          --hd-own-bubble-bg: #eaebed;
          --hd-own-bubble-text: #006989;
          --hd-own-meta-text: rgba(0, 105, 137, 0.7);
          
          --hd-search-bg: rgba(0, 0, 0, 0.05);
          --hd-search-border: rgba(0, 0, 0, 0.1);
        }

        [data-theme="dark"] {
          /* Dark Mode (Ref 1) */
          --hd-bg-main: transparent;
          --hd-text-main: var(--text-1);
          --hd-text-muted: var(--text-2);
          --hd-item-hover: rgba(255, 255, 255, 0.05);
          --hd-item-selected: #171f2e;
          --hd-item-selected-text: #ffffff;
          --hd-pill-bg: transparent;
          --hd-pill-border: transparent;
          --hd-pill-text: rgba(255, 255, 255, 0.7);
          --hd-pill-selected-bg: #ffffff;
          --hd-pill-selected-text: #171f2e;
          --hd-pill-selected-border: #ffffff;
          
          --hd-bg-tabs: #171f2e;
          --hd-text-tabs: #ffffff;
          --hd-tab-hover: rgba(255, 255, 255, 0.05);
          
          --hd-bg-right: #171f2e;
          --hd-text-right: #ffffff;
          --hd-bg-right-inner: rgba(255, 255, 255, 0.05);
          
          --hd-accent: #ccff00;
          --hd-accent-text: #171f2e;
          
          --hd-own-bubble-bg: #cdd179;
          --hd-own-bubble-text: #171f2e;
          --hd-own-meta-text: rgba(23, 31, 46, 0.7);
          
          --hd-search-bg: rgba(255, 255, 255, 0.05);
          --hd-search-border: rgba(255, 255, 255, 0.1);
        }

        /* Layout */
        .hd-container {
          display: flex;
          gap: 24px;
          padding: 24px;
          background: var(--hd-bg-main);
          border: 1px solid rgba(128, 128, 128, 0.2);
          border-radius: 20px;
          flex: 1;
          min-height: 0;
          margin: 36px 16px 16px 16px;
          box-sizing: border-box;
          font-family: 'Inter', system-ui, sans-serif;
          transition: background 0.3s;
          overflow: visible;
        }

        .hd-left {
          width: 400px;
          display: flex;
          flex-direction: column;
          padding-left: 8px;
        }

        .hd-right-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        /* Top Tabs */
        .hd-tabs-container {
          display: inline-flex;
          align-items: center;
          background: var(--hd-bg-tabs);
          border-radius: 100px;
          padding: 6px;
          margin: -24px auto 0 auto;
          transform: translateY(-50%);
          width: max-content;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
          align-self: center;
          position: relative;
          z-index: 10;
        }

        .hd-tab {
          padding: 10px 24px;
          border-radius: 100px;
          color: var(--hd-text-tabs);
          font-weight: 600;
          font-size: 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .hd-tab:hover {
          background: var(--hd-tab-hover);
        }
        .hd-tab.active {
          background: var(--hd-accent);
          color: var(--hd-accent-text);
        }
        .hd-tab-badge {
          background: rgba(128,128,128,0.2);
          color: inherit;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
        }
        .hd-tab.active .hd-tab-badge {
          background: #111111;
          color: #ffffff;
        }

        /* Right Card */
        .hd-right-card {
          flex: 1;
          background: var(--hd-bg-right);
          border-radius: 32px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          color: var(--hd-text-right);
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        /* Left side content */
        .hd-title {
          font-size: 24px;
          font-weight: 600;
          color: var(--hd-text-main);
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-left: 16px;
        }
        
        .hd-title-btn {
          background: transparent;
          border: 1px solid var(--hd-text-muted);
          color: var(--hd-text-main);
          width: 32px; height: 32px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: 0.2s;
        }
        .hd-title-btn:hover {
          background: var(--hd-item-hover);
        }

        .hd-search-wrap {
          margin-bottom: 24px;
          padding: 0 16px;
        }
        .hd-search-input {
          width: 100%;
          background: var(--hd-search-bg);
          border: 1px solid var(--hd-search-border);
          color: var(--hd-text-main);
          padding: 12px 20px;
          border-radius: 100px;
          font-size: 14px;
          outline: none;
        }
        .hd-search-input::placeholder {
          color: var(--hd-text-muted);
        }

        .hd-ticket-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
          padding-right: 8px;
          flex: 1;
          min-height: 0;
        }
        
        /* Custom Scrollbar */
        .hd-ticket-list::-webkit-scrollbar, .hd-chat-area::-webkit-scrollbar {
          width: 6px;
        }
        .hd-ticket-list::-webkit-scrollbar-thumb, .hd-chat-area::-webkit-scrollbar-thumb {
          background: rgba(128,128,128,0.3);
          border-radius: 10px;
        }

        .hd-ticket-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          background: transparent;
        }
        .hd-ticket-item:hover {
          background: var(--hd-item-hover);
        }
        .hd-ticket-item.selected {
          background: var(--hd-item-selected);
        }

        .hd-ticket-avatar {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          background: rgba(128,128,128,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 16px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .hd-ticket-info {
          flex: 1;
          min-width: 0;
        }
        .hd-ticket-id-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .hd-ticket-id {
          font-weight: 700;
          font-size: 14px;
          color: var(--hd-text-main);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .hd-ticket-subject {
          color: var(--hd-text-main);
        }
        .hd-ticket-item.selected .hd-ticket-subject {
          color: var(--hd-item-selected-text);
        }
        .hd-ticket-item.selected .hd-ticket-id {
          color: var(--hd-item-selected-text);
        }
        .hd-ticket-date {
          font-size: 12px;
          color: var(--hd-text-muted);
        }
        .hd-ticket-item.selected .hd-ticket-date {
          color: rgba(255,255,255,0.7);
        }

        .hd-ticket-badge {
          padding: 6px 16px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          background: var(--hd-pill-bg);
          border: 1px solid var(--hd-pill-border);
          color: var(--hd-pill-text);
          text-transform: capitalize;
        }
        .hd-ticket-item.selected .hd-ticket-badge {
          background: var(--hd-pill-selected-bg);
          border-color: var(--hd-pill-selected-border);
          color: var(--hd-pill-selected-text);
        }

        .hd-ticket-amount {
          font-weight: 600;
          font-size: 15px;
          margin-left: 16px;
          color: var(--hd-text-main);
          text-align: right;
        }
        .hd-ticket-item.selected .hd-ticket-amount {
          color: var(--hd-item-selected-text);
        }

        /* Right Card Details */
        .hd-rc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .hd-rc-title {
          font-size: 11px;
          color: var(--hd-text-muted);
          margin-bottom: 2px;
        }
        .hd-rc-id-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 28px;
        }
        .hd-rc-id {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.5px;
        }
        .hd-rc-badge {
          background: rgba(255,255,255,0.1);
          padding: 6px 14px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.2);
          text-transform: capitalize;
        }

        .hd-rc-meta {
          display: flex;
          gap: 64px;
        }
        .hd-rc-meta-col {
          display: flex;
          flex-direction: column;
        }
        .hd-rc-meta-label {
          font-size: 11px;
          color: var(--hd-text-muted);
          margin-bottom: 2px;
        }
        .hd-rc-meta-value {
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 12px;
          height: 28px;
        }
        .hd-rc-meta-customer {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 28px;
        }
        .hd-rc-meta-avatar {
          width: 24px; height: 24px; border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
        }
        .hd-rc-meta-name {
          font-size: 15px; font-weight: 600;
        }
        .hd-rc-meta-sub {
          font-size: 12px; color: var(--hd-text-muted); font-weight: 400;
        }

        /* Chat area inside Right Card */
        .hd-chat-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          margin-bottom: 24px;
          padding-right: 12px;
          min-height: 0;
        }
        .hd-chat-bubble {
          background: var(--hd-bg-right-inner);
          border-radius: 24px;
          padding: 16px 20px;
          max-width: 75%;
          width: fit-content;
          position: relative;
        }
        .hd-chat-bubble.own {
          align-self: flex-end;
          background: var(--hd-own-bubble-bg);
          color: var(--hd-own-bubble-text);
        }
        .hd-chat-meta {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: rgba(255,255,255,0.7);
          margin-bottom: 12px;
          font-weight: 600;
        }
        .hd-chat-bubble.own .hd-chat-meta {
          color: var(--hd-own-meta-text);
        }
        .hd-chat-text {
          font-size: 15px;
          line-height: 1.5;
          word-break: break-word;
        }

        /* Bottom Action Bar */
        .hd-action-bar {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--hd-bg-right-inner);
          padding: 12px 16px;
          border-radius: 100px;
        }
        .hd-action-input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 15px;
          outline: none;
          padding: 0 8px;
        }
        .hd-action-input::placeholder {
          color: rgba(255,255,255,0.5);
        }
        .hd-action-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          width: 44px; height: 44px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .hd-action-btn:hover {
          background: rgba(255,255,255,0.2);
        }
        .hd-action-submit {
          background: var(--hd-accent);
          color: var(--hd-accent-text);
          border: none;
          padding: 14px 28px;
          border-radius: 100px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }
        .hd-action-submit:hover:not(:disabled) {
          opacity: 0.9;
          transform: scale(1.02);
        }
        .hd-action-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .hd-status-select {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 6px 12px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          outline: none;
        }
        .hd-status-select option {
          color: black;
        }

        .hd-empty {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          flex: 1; color: rgba(255,255,255,0.5);
        }

        /* Reply feature */
        .hd-chat-bubble.group:hover .hd-chat-reply-btn {
          opacity: 1;
        }
        .hd-chat-reply-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          right: -75px;
          opacity: 0;
          background: var(--hd-bg-right-inner);
          color: var(--hd-text-right);
          border: 1px solid rgba(128,128,128,0.2);
          padding: 6px 10px;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .hd-chat-bubble.own .hd-chat-reply-btn {
          right: auto;
          left: -75px;
        }
        .hd-chat-reply-btn:hover {
          background: rgba(128,128,128,0.2);
        }
        .hd-chat-quoted {
          background: rgba(0,0,0,0.1);
          border-left: 3px solid rgba(128,128,128,0.4);
          padding: 8px 12px;
          border-radius: 4px 8px 8px 4px;
          margin-bottom: 8px;
        }
        .hd-replying-to-banner {
          background: var(--hd-bg-right-inner);
          padding: 8px 16px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-left: 3px solid var(--hd-accent);
        }

        /* Drag Overlay */
        .hd-chat-area.dragging {
          position: relative;
        }
        .drag-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          z-index: 10;
          border-radius: 16px;
          border: 2px dashed rgba(255,255,255,0.4);
        }

        /* Responsive Layout */
        .hd-mobile-back {
          display: none;
          background: transparent;
          border: none;
          color: var(--hd-text-main);
          align-items: center;
          gap: 4px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        @media (max-width: 900px) {
          .hd-container {
            flex-direction: column;
            gap: 16px;
            padding: 16px;
            margin: 16px;
          }
          .hd-left {
            width: 100%;
          }
          .hd-right-wrapper {
            display: none;
          }
          .hd-container.show-detail .hd-left {
            display: none;
          }
          .hd-container.show-detail .hd-right-wrapper {
            display: flex;
          }
          .hd-mobile-back {
            display: flex;
          }
          .hd-chat-bubble {
            max-width: 90%;
          }
          .hd-tabs-container {
            margin: 0 0 16px 0;
            transform: none;
            width: 100%;
            overflow-x: auto;
          }
          .hd-rc-meta {
            flex-direction: column;
            gap: 16px;
          }
        }
      `}</style>

      {/* LEFT SIDEBAR */}
      <div className="hd-left">
        <div className="hd-title">
          {isAdmin ? 'Help Desk' : 'My Support Tickets'}
          {!isAdmin && (
            <button className="hd-title-btn" onClick={() => setShowCreateModal(true)} title="New Ticket">
              <Plus size={18} />
            </button>
          )}
        </div>

        <div style={{ paddingLeft: '16px', marginBottom: '24px', fontSize: '12px', color: 'var(--hd-text-muted)' }}>
          Need quick help? Email us: <a href="mailto:aabumbabum@gmail.com" style={{ color: 'var(--pro-primary)', textDecoration: 'none', fontWeight: 600 }}>aabumbabum@gmail.com</a>
        </div>

        <div className="hd-search-wrap" style={{ position: 'relative' }}>
          <input
            type="text"
            className="hd-search-input"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingRight: '40px' }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '28px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--hd-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="hd-ticket-list">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="skeleton-list-row" style={{ padding: '12px', background: 'transparent', margin: 0, border: 'none' }}>
                  <div className="skeleton-wrapper skeleton-circle" style={{ width: 40, height: 40, borderRadius: 12 }}></div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="skeleton-wrapper skeleton-text short" style={{ width: '30%' }}></div>
                    <div className="skeleton-wrapper skeleton-text title" style={{ width: '70%' }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--hd-text-muted)' }}>
              <p>{searchQuery ? "No matching tickets found" : "No tickets found"}</p>
            </div>
          ) : (
            filteredTickets.map(ticket => (
              <div
                key={ticket.id}
                className={`hd-ticket-item ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setTicketStatus(ticket.status);
                  setReplyMessage('');
                  setShowMobileDetail(true);
                }}
              >
                <div className="hd-ticket-avatar">
                  <User size={20} color="rgba(255,255,255,0.8)" />
                </div>
                <div className="hd-ticket-info" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div className="hd-ticket-subject" style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                      {ticket.subject}
                    </div>
                    <div className="hd-ticket-badge" style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0, margin: 0 }}>
                      {ticket.status === 'resolved' ? 'Resolved' : ticket.status === 'in_progress' ? 'In Progress' : 'Open'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="hd-ticket-id" style={{ fontSize: '12px', fontWeight: 500 }}>{formatTicketId(ticket.id)}</span>
                    <span className="hd-ticket-date" style={{ fontSize: '12px', opacity: 0.5 }}>•</span>
                    <span className="hd-ticket-date" style={{ fontSize: '12px' }}>{ticket.priority === 'high' ? 'Urgent' : ticket.category}</span>
                    <span className="hd-ticket-date" style={{ fontSize: '12px', opacity: 0.5 }}>•</span>
                    <span className="hd-ticket-date" style={{ fontSize: '12px' }}>
                      {(() => {
                        if (ticket.status === 'resolved') return 'Resolved';
                        const days = Math.floor((new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60 * 24));
                        return days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'} ago`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT WRAPPER */}
      <div className="hd-right-wrapper">

        <div className="hd-tabs-container">
          <button className={`hd-tab ${activeTab === 'All' ? 'active' : ''}`} onClick={() => setActiveTab('All')}>
            All Tickets <span className="hd-tab-badge">{tickets.length}</span>
          </button>
          <button className={`hd-tab ${activeTab === 'Open' ? 'active' : ''}`} onClick={() => setActiveTab('Open')}>
            Open <span className="hd-tab-badge">{tickets.filter(t => t.status !== 'resolved').length}</span>
          </button>
          <button className={`hd-tab ${activeTab === 'Resolved' ? 'active' : ''}`} onClick={() => setActiveTab('Resolved')}>
            Resolved <span className="hd-tab-badge">{tickets.filter(t => t.status === 'resolved').length}</span>
          </button>
        </div>

        <div className="hd-right-card">
          {!selectedTicket ? (
            <div className="hd-empty">
              <MessageSquare size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <h3>Select a ticket to view details</h3>
            </div>
          ) : (
            <>
              <div className="hd-rc-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '16px', marginBottom: '24px' }}>
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <button className="hd-mobile-back" onClick={() => setShowMobileDetail(false)}>
                      <ArrowLeft size={18} /> Back
                    </button>
                    <div style={{ fontSize: '12px', color: 'var(--hd-text-muted)', fontWeight: 600 }}>
                      Ticket details
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--hd-text-muted)', fontWeight: 600 }}>
                      {formatTicketId(selectedTicket.id)}
                    </div>
                    <div className="hd-rc-badge" style={{ margin: 0, padding: '2px 8px', fontSize: '10px' }}>
                      {selectedTicket.status === 'resolved' ? 'Resolved' : selectedTicket.status === 'in_progress' ? 'In Progress' : 'Open'}
                    </div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--hd-text-main)', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {selectedTicket.subject}
                  </div>
                </div>

                <div className="hd-rc-meta" style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap', margin: 0 }}>
                  <div className="hd-rc-meta-col">
                    <div className="hd-rc-meta-label">Category</div>
                    <div className="hd-rc-meta-value" style={{ fontSize: '15px' }}>
                      {selectedTicket.category} <Tag size={14} color="rgba(255,255,255,0.5)" style={{ marginLeft: '6px' }} />
                    </div>
                  </div>

                  <div className="hd-rc-meta-col" style={{ alignItems: 'flex-start' }}>
                    <div className="hd-rc-meta-label">Customer</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div 
                        className="hd-rc-meta-customer" 
                        style={{ height: 'auto', gap: '8px', cursor: 'pointer', transition: 'opacity 0.2s' }} 
                        onClick={() => onUserClick && onUserClick(selectedTicket.users || { id: selectedTicket.user_id })}
                        onMouseOver={(e) => e.currentTarget.style.opacity = 0.8}
                        onMouseOut={(e) => e.currentTarget.style.opacity = 1}
                      >
                        <div className="hd-rc-meta-avatar" style={{ width: 28, height: 28, overflow: 'hidden' }}>
                          {selectedTicket.users?.profile_picture_url || selectedTicket.users?.avatar_url ? (
                            <img src={selectedTicket.users.profile_picture_url || selectedTicket.users.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <User size={14} color="var(--hd-text-main)" style={{ opacity: 0.8 }} />
                          )}
                        </div>
                        <div>
                          <div className="hd-rc-meta-name" style={{ fontSize: '14px', textDecoration: 'underline' }}>{selectedTicket.users?.display_name || 'Anonymous User'}</div>
                          <div className="hd-rc-meta-sub" style={{ fontSize: '11px' }}>{selectedTicket.users?.email || 'No Email'}</div>
                        </div>
                      </div>
                      
                      {isAdmin && (
                        <form onSubmit={handleUpdateTicketStatus} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ position: 'relative' }}>
                            <button 
                              type="button" 
                              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                              className="hd-status-select"
                              style={{
                                background: 'rgba(128, 128, 128, 0.1)',
                                border: '1px solid rgba(128, 128, 128, 0.2)',
                                color: 'var(--hd-text-main)',
                                padding: '8px 16px',
                                borderRadius: '100px',
                                outline: 'none',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              {ticketStatus === 'open' ? 'Open' : ticketStatus === 'in_progress' ? 'In Progress' : 'Resolved'}
                              <ChevronDown size={14} />
                            </button>
                            
                            <AnimatePresence>
                              {isStatusDropdownOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -10 }} 
                                  animate={{ opacity: 1, y: 0 }} 
                                  exit={{ opacity: 0, y: -10 }}
                                  style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    left: 0,
                                    background: 'var(--hd-bg-right)',
                                    border: '1px solid rgba(128, 128, 128, 0.2)',
                                    borderRadius: '16px',
                                    padding: '8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    zIndex: 100,
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                    minWidth: '140px'
                                  }}
                                >
                                  {['open', 'in_progress', 'resolved'].map(status => (
                                    <button
                                      key={status}
                                      type="button"
                                      onClick={() => {
                                        setTicketStatus(status);
                                        setIsStatusDropdownOpen(false);
                                      }}
                                      style={{
                                        background: ticketStatus === status ? 'rgba(128, 128, 128, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: 'var(--hd-text-main)',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.2s'
                                      }}
                                      onMouseOver={(e) => { if(ticketStatus !== status) e.currentTarget.style.background = 'rgba(128, 128, 128, 0.05)'; }}
                                      onMouseOut={(e) => { if(ticketStatus !== status) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                      {status === 'open' ? 'Open' : status === 'in_progress' ? 'In Progress' : 'Resolved'}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          
                          {(selectedTicket.status !== ticketStatus) && (
                            <button type="submit" disabled={isUpdatingStatus} className="hd-status-btn" style={{
                              background: 'var(--hd-text-main)',
                              color: 'var(--bg-primary, #fff)',
                              border: 'none',
                              padding: '8px 20px',
                              borderRadius: '100px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              opacity: isUpdatingStatus ? 0.7 : 1,
                              animation: 'fadeIn 0.3s'
                            }}>
                              {isUpdatingStatus ? '...' : 'Update'}
                            </button>
                          )}
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`hd-chat-area ${isDragging ? 'dragging' : ''}`}
                ref={chatMessagesRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {isDragging && (
                  <div className="drag-overlay">
                    <ImageIcon size={48} />
                    <p>Drop image to attach</p>
                  </div>
                )}

                <div className="hd-chat-bubble group">
                  <div className="hd-chat-meta">
                    <span 
                      style={{ cursor: 'pointer', textDecoration: 'underline' }} 
                      onClick={() => onUserClick && onUserClick(selectedTicket.users || { id: selectedTicket.user_id })}
                    >
                      User ({selectedTicket.users?.display_name || 'Unknown'})
                    </span>
                    <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>
                  </div>
                  <div className="hd-chat-text" style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedTicket.description}
                  </div>
                  <button
                    className="hd-chat-reply-btn"
                    onClick={() => setReplyingTo({ id: 'initial', text: selectedTicket.description, sender_name: selectedTicket.users?.display_name || 'Unknown' })}
                  >
                    <Reply size={14} /> Reply
                  </button>
                </div>

                {getParsedMessages(selectedTicket).map(msg => {
                  const isOwnMsg = (isAdmin && msg.role === 'admin') || (!isAdmin && msg.role === 'user');
                  return (
                    <div key={msg.id} className={`hd-chat-bubble group ${isOwnMsg ? 'own' : ''}`}>
                      <div className="hd-chat-meta">
                        <span 
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => onUserClick && onUserClick({ id: msg.sender_id, display_name: msg.sender_name, role: msg.role })}
                        >
                          {msg.role === 'admin'
                            ? (isAdmin ? `Admin (${msg.sender_name})` : 'Support Team')
                            : `User (${msg.sender_name})`}
                        </span>
                        <span>{new Date(msg.timestamp).toLocaleString()}</span>
                      </div>

                      {msg.replyTo && (
                        <div className="hd-chat-quoted">
                          <span style={{ fontSize: '11px', fontWeight: 600, marginBottom: '2px', display: 'block', color: 'rgba(255,255,255,0.8)' }}>Replying to {msg.replyTo.sender_name}</span>
                          <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'rgba(255,255,255,0.6)' }}>{msg.replyTo.text}</span>
                        </div>
                      )}

                      <div className="hd-chat-text" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

                      {msg.imageUrl && (
                        <div style={{ marginTop: '12px' }}>
                          <a href={msg.imageUrl} target="_blank" rel="noreferrer">
                            <img src={msg.imageUrl} alt="attachment" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px' }} />
                          </a>
                        </div>
                      )}

                      <button
                        className="hd-chat-reply-btn"
                        onClick={() => setReplyingTo(msg)}
                      >
                        <Reply size={14} /> Reply
                      </button>
                    </div>
                  );
                })}
              </div>

              {selectedTicket.status !== 'resolved' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <AnimatePresence>
                    {replyingTo && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: 10, height: 0 }}
                        className="hd-replying-to-banner"
                      >
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, display: 'block', color: 'var(--hd-accent)' }}>Replying to {replyingTo.sender_name}</span>
                          <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'rgba(255,255,255,0.7)' }}>{replyingTo.text}</span>
                        </div>
                        <button onClick={() => setReplyingTo(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '4px' }}><X size={14} /></button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form className="hd-action-bar" onSubmit={handleReplySubmit}>
                    <input
                      type="text"
                      className="hd-action-input"
                      placeholder="Type your reply..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                    />
                    {replyImage && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '100px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--hd-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
                          {replyImage.name}
                        </span>
                        <button type="button" onClick={() => setReplyImage(null)} style={{ background: 'transparent', border: 'none', color: 'var(--hd-text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>
                      </div>
                    )}
                    <label className="hd-action-btn" title="Attach Image">
                      <Paperclip size={20} />
                      <input type="file" accept="image/*" onChange={(e) => setReplyImage(e.target.files[0])} style={{ display: 'none' }} />
                    </label>
                    <button
                      type="submit"
                      className="hd-action-submit"
                      disabled={isSubmitting || (!replyMessage.trim() && !replyImage)}
                    >
                      Send Reply
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* CREATE TICKET MODAL */}
      <AnimatePresence>
        {showCreateModal && !isAdmin && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)' }}>
            <motion.div className="pro-modal ticket-create-modal" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} style={{ background: 'var(--hd-bg-right)', color: 'white', border: 'none', borderRadius: '32px', overflow: 'hidden', padding: '32px' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Submit a Ticket</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>We're here to help.</p>
                </div>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateTicket}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Subject</label>
                  <input
                    type="text"
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', outline: 'none' }}
                    value={newTicket.subject}
                    onChange={e => setNewTicket({ ...newTicket, subject: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Category</label>
                    <select style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', outline: 'none' }} value={newTicket.category} onChange={e => setNewTicket({ ...newTicket, category: e.target.value })}>
                      <option value="General" style={{ color: 'black' }}>General Inquiry</option>
                      <option value="Bug Report" style={{ color: 'black' }}>Bug Report</option>
                      <option value="Feature Request" style={{ color: 'black' }}>Feature Request</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Priority</label>
                    <select style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', outline: 'none' }} value={newTicket.priority} onChange={e => setNewTicket({ ...newTicket, priority: e.target.value })}>
                      <option value="low" style={{ color: 'black' }}>Low</option>
                      <option value="normal" style={{ color: 'black' }}>Normal</option>
                      <option value="high" style={{ color: 'black' }}>High</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Description</label>
                  <textarea
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', outline: 'none', minHeight: '100px', resize: 'vertical' }}
                    value={newTicket.description}
                    onChange={e => setNewTicket({ ...newTicket, description: e.target.value })}
                    required
                  ></textarea>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '12px 24px', borderRadius: '100px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={isSubmitting} style={{ padding: '12px 24px', borderRadius: '100px', background: 'var(--hd-accent)', border: 'none', color: 'var(--hd-accent-text)', fontWeight: 700, cursor: 'pointer' }}>
                    {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
