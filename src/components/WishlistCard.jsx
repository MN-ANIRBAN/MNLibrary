import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Edit3, Heart, BookOpen, Building, Tag, Share2, ChevronDown } from 'lucide-react';
import './WishlistCard.css';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  unread: { label: "To Read", color: "#6366f1" },
  reading: { label: "In Progress", color: "#f59e0b" },
  read: { label: "Finished", color: "#10b981" },
};

export default function WishlistCard({ book, ownData, onStatusChange, onDelete, onEdit, onImageClick, isReadOnly, isOwnerMine, isAdmin, isAuthorized }) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [imageError, setImageError] = useState(false);
  const statusRef = useRef(null);

  useEffect(() => {
    const closeMenu = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) setShowStatusMenu(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  // Force yellow theme for all wishlist cards
  const theme = 'theme-yellow';

  const netPrice = book.price - (book.price * (book.discount || 0) / 100);
  const currentStatus = STATUS_CONFIG[book.status] || STATUS_CONFIG.unread;

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}?sharedBookId=${book.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share link copied!");
    }).catch(() => toast.error("Failed to copy link"));
  };

  const handleToggleWishlist = (e) => {
    e.stopPropagation();
    onStatusChange(book.id, { isWishlisted: false });
    toast.success("Removed from wishlist");
  };

  const handleStatusUpdate = (key, e) => {
    e.stopPropagation();
    const activityLog = [...(book.activityLog || [])];
    activityLog.push({
      id: Date.now(),
      type: "owned",
      to: "ME",
      from: "Wishlist",
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      notes: `Moved from Wishlist to Collection (${STATUS_CONFIG[key].label})`
    });

    onStatusChange(book.id, {
      isWishlisted: false,
      status: key,
      activityLog
    });
    setShowStatusMenu(false);
    toast.success(`Added to collection: ${STATUS_CONFIG[key].label}`);
  };

  return (
    <div
      className="wishlist-modern-card"
      onClick={() => onImageClick && onImageClick()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`wmc-top-section ${theme}`} style={{ cursor: 'pointer' }}>
        <div className="wmc-top-left-actions">
          {!isReadOnly && (
            <button
              className="wmc-del-btn"
              onClick={(e) => { e.stopPropagation(); onDelete(book.id); }}
              title="Delete Book"
            >
              <Trash2 size={16} />
            </button>
          )}
          <div className="wmc-ownership-tag">
            Added to wishlist
          </div>
        </div>

        <div className="wmc-cutout">
          {isAuthorized && (
            <button
              className="wmc-action-btn"
              onClick={(e) => { e.stopPropagation(); onEdit && onEdit(book); }}
              title="Edit Book"
            >
              <Edit3 size={16} />
            </button>
          )}
        </div>

        {(book.frontCoverUrl && !imageError) ? (
          <img 
            src={book.frontCoverUrl} 
            alt={book.title} 
            className="wmc-image" 
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)} 
            onLoad={(e) => {
              if (e.target.naturalWidth === 180 && e.target.naturalHeight === 180) {
                setImageError(true);
              }
            }}
          />
        ) : (
          <div className="wmc-no-image">
            <BookOpen size={48} opacity={0.5} />
          </div>
        )}
      </div>

      <div className="wmc-bottom-section">
        <div className="wmc-header">
          <div className="wmc-title-wrap">
            <h2 className="wmc-title">{book.title}</h2>
            <p className="wmc-subtitle">{book.author || "Unknown Author"}</p>
          </div>
          <button
            className={`wmc-heart-btn ${theme}`}
            onClick={handleToggleWishlist}
            title="Remove from wishlist"
          >
            <Heart size={20} fill="#ffffff" stroke="#f97316" />
          </button>
        </div>



        <div className="wmc-specs">
          <div className="wmc-spec-item">
            <BookOpen size={14} className="wmc-spec-icon" />
            <span className="wmc-spec-text">{book.pages ? `${book.pages} p` : 'N/A'}</span>
          </div>
          <div className="wmc-spec-item">
            <Building size={14} className="wmc-spec-icon" />
            <span className="wmc-spec-text">{book.publisher || 'Indie'}</span>
          </div>
          <div className="wmc-spec-item">
            <Tag size={14} className="wmc-spec-icon" />
            <span className="wmc-spec-text">{book.genre || 'N/A'}</span>
          </div>
          <div className="wmc-spec-item">
            <span className="wmc-spec-icon" style={{ fontSize: '14px', fontWeight: 'bold' }}>₹</span>
            <span className="wmc-spec-text">{netPrice.toFixed(0)}</span>
          </div>
        </div>

        <div className="wmc-footer">
          <button className="wmc-share-btn" onClick={handleShare} title="Share Book Link">
            <Share2 size={20} />
          </button>
        </div>
      </div>

      <div className="wmc-status-container" ref={statusRef}>
        <button
          className={`wmc-status-btn ${theme}`}
          onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu); }}
        >
          {currentStatus.label} <ChevronDown size={14} />
        </button>
        {showStatusMenu && (
          <div className="wmc-status-menu">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={(e) => handleStatusUpdate(key, e)}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
