import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, MessageCircle, Loader2, BookPlus, Edit3, Trash2, Book, User, Hash, Tag, Shield, MapPin, Reply, X } from "lucide-react";
import { subscribeToGroupMessages } from "../supabase/groupService";
import { supabase } from "../supabase/config";

export default function GroupChatPanel({ group, user, onSendMessage, onUserClick }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Subscribe to real-time messages for this group
  useEffect(() => {
    if (!group?.id) return;
    setIsLoadingInitial(true);

    const unsubscribe = subscribeToGroupMessages(group.id, (data) => {
      if (Array.isArray(data)) {
        setMessages(data);
      } else if (typeof data === 'function') {
        setMessages(data);
      }
      setIsLoadingInitial(false);
    });

    return () => unsubscribe();
  }, [group?.id]);

  // Auto-mark notifications as read when viewing a group chat
  useEffect(() => {
    if (group?.id && user?.id) {
      supabase.from('system_notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('reference_id', group.id)
        .eq('is_read', false)
        .then(() => {}); // silent update
    }
  }, [group?.id, user?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const scrollContainer = bottomRef.current?.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: scrollContainer.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending) return;

    let finalContent = inputValue.trim();
    if (replyingTo) {
      let replySnippet = replyingTo.content;
      if (replySnippet.startsWith("SYSTEM_PAYLOAD:")) {
        replySnippet = "[System Message]";
      } else if (replySnippet.startsWith("REPLY_PAYLOAD:")) {
        try {
          replySnippet = JSON.parse(replySnippet.replace("REPLY_PAYLOAD:", "")).text;
        } catch (e) {
          replySnippet = "[Message]";
        }
      }

      const payload = {
        replyToName: replyingTo.sender_name || replyingTo.sender_email?.split('@')[0],
        replyToText: replySnippet,
        text: finalContent
      };
      finalContent = `REPLY_PAYLOAD:${JSON.stringify(payload)}`;
    }

    const content = finalContent;
    setInputValue("");
    setReplyingTo(null);
    setIsSending(true);
    try {
      await onSendMessage(group.id, content);
    } catch {
      setInputValue(inputValue.trim()); // restore on failure
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const dateLabel = formatDate(msg.created_at);
    if (!acc[dateLabel]) acc[dateLabel] = [];
    acc[dateLabel].push(msg);
    return acc;
  }, {});

  const renderMessageContent = (content) => {
    if (content.startsWith("SYSTEM_PAYLOAD:")) {
      try {
        const payload = JSON.parse(content.replace("SYSTEM_PAYLOAD:", ""));
        if (payload.type === 'book_update') {
          const { action, book } = payload;
          const actionText = action === 'added' ? 'Added Shared Book' : action === 'removed' ? 'Removed Shared Book' : 'Updated Shared Book';
          const icon = action === 'added' ? <BookPlus size={16} color="#10b981" /> : action === 'removed' ? <Trash2 size={16} color="#ef4444" /> : <Edit3 size={16} color="#3b82f6" />;
          
          return (
            <div className="chat-system-card">
              <div className="system-card-header">
                {icon} <strong>{actionText}</strong>
              </div>
              <div className="system-card-body">
                <div className="system-card-title"><Book size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} /> {book.title}</div>
                {book.author && <div className="system-card-detail"><User size={14} /> {book.author}</div>}
                {book.isbn && <div className="system-card-detail"><Hash size={14} /> {book.isbn}</div>}
                {book.status && <div className="system-card-detail" style={{ textTransform: 'capitalize' }}><Tag size={14} /> Status: {book.status}</div>}
                {book.owner && <div className="system-card-detail"><Shield size={14} /> Owner: {book.owner}</div>}
                {book.custody && <div className="system-card-detail"><MapPin size={14} /> Custody: {book.custody}</div>}
              </div>
            </div>
          );
        }
      } catch (e) {
        // Fallback to normal text if parsing fails
      }
    }
    
    if (content.startsWith("REPLY_PAYLOAD:")) {
      try {
        const payload = JSON.parse(content.replace("REPLY_PAYLOAD:", ""));
        return (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              background: 'var(--dash-hover-bg)', 
              borderLeft: '3px solid var(--indigo-color)',
              padding: '6px 10px',
              borderRadius: '4px 8px 8px 4px',
              marginBottom: '6px',
              fontSize: '12px',
              opacity: 0.85
            }}>
              <strong style={{ color: 'var(--indigo-color)', display: 'block', marginBottom: '2px' }}>{payload.replyToName}</strong>
              <span style={{ color: 'var(--dash-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{payload.replyToText}</span>
            </div>
            <p style={{ margin: 0 }}>{payload.text}</p>
          </div>
        );
      } catch (e) {
        // Fallback
      }
    }

    return <p>{content}</p>;
  };

  return (
    <div className="group-chat-panel">
      {/* Header */}
      <div className="chat-panel-header">
        <MessageCircle size={16} />
        <span>Group Chat</span>
      </div>

      {/* Messages Area */}
      <div className="chat-messages-area">
        {isLoadingInitial ? (
          <div className="chat-loading">
            <Loader2 size={20} className="spinning-icon" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <MessageCircle size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p>No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="chat-date-divider">
                <span>{date}</span>
              </div>
              {msgs.map((msg) => {
                const isMe = msg.user_id === user?.id;
                return (
                  <motion.div
                    key={msg.id}
                    className={`chat-message ${isMe ? 'mine' : 'theirs'}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {!isMe && (
                      <div 
                        className="chat-msg-avatar"
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick({ id: msg.user_id, display_name: msg.sender_name, email: msg.sender_email }); }}
                        title={msg.sender_name || msg.sender_email}
                      >
                        {(msg.sender_name || msg.sender_email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="chat-msg-body">
                      {!isMe && (
                        <span 
                          className="chat-msg-sender"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick({ id: msg.user_id, display_name: msg.sender_name, email: msg.sender_email }); }}
                          onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {msg.sender_name || msg.sender_email?.split('@')[0]}
                        </span>
                      )}
                      {msg.content.startsWith("SYSTEM_PAYLOAD:") ? (
                        <div className="chat-system-msg-container" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {renderMessageContent(msg.content)}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span className="chat-msg-time">{formatTime(msg.created_at)}</span>
                            <button 
                              className="chat-reply-btn"
                              onClick={() => {
                                setReplyingTo(msg);
                                inputRef.current?.focus();
                              }}
                              style={{
                                background: 'transparent', border: 'none', color: 'var(--dash-text-muted)',
                                cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.5,
                                transition: 'opacity 0.2s'
                              }}
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="chat-msg-bubble">
                          {renderMessageContent(msg.content)}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span className="chat-msg-time">{formatTime(msg.created_at)}</span>
                            <button 
                              className="chat-reply-btn"
                              onClick={() => {
                                setReplyingTo(msg);
                                inputRef.current?.focus();
                              }}
                              style={{
                                background: 'transparent', border: 'none', color: 'var(--dash-text-muted)',
                                cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', opacity: 0.5,
                                transition: 'opacity 0.2s'
                              }}
                              title="Reply"
                            >
                              <Reply size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <AnimatePresence>
          {replyingTo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                background: 'var(--dash-hover-bg)', padding: '8px 12px', borderTop: '1px solid var(--dash-border)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                borderLeft: '4px solid var(--indigo-color)'
              }}>
                <div style={{ fontSize: '13px', overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, color: 'var(--indigo-color)', marginBottom: 2 }}>Replying to {replyingTo.sender_name || replyingTo.sender_email?.split('@')[0]}</div>
                  <div style={{ color: 'var(--dash-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(() => {
                      let snippet = replyingTo.content;
                      if (snippet.startsWith("SYSTEM_PAYLOAD:")) return "[System Message]";
                      if (snippet.startsWith("REPLY_PAYLOAD:")) {
                        try {
                          return JSON.parse(snippet.replace("REPLY_PAYLOAD:", "")).text;
                        } catch (e) {
                          return "[Message]";
                        }
                      }
                      return snippet;
                    })()}
                  </div>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--dash-text-muted)', cursor: 'pointer', padding: 4 }}
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <form className="chat-input-area" onSubmit={handleSend} style={{ borderTop: replyingTo ? 'none' : '1px solid var(--dash-border)' }}>
          <input
            ref={inputRef}
          className="chat-input"
          placeholder="Type a message... (Enter to send)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={2000}
          disabled={isSending}
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!inputValue.trim() || isSending}
          title="Send message"
        >
          {isSending ? <Loader2 size={16} className="spinning-icon" /> : <Send size={16} />}
        </button>
      </form>
      </div>
    </div>
  );
}
