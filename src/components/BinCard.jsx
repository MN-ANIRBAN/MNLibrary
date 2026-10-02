/* BinCard.jsx */
import { Trash2, RotateCw, Clock } from "lucide-react";
import toast from "react-hot-toast";
import React, { useState } from 'react';
import './BinCardVariants.css';

const getDaysRemaining = (deletedAt) => {
  if (!deletedAt) return 30;

  let deletedTime;
  if (typeof deletedAt === 'string') {
    deletedTime = new Date(deletedAt).getTime();
  } else if (typeof deletedAt === 'number') {
    deletedTime = deletedAt;
  } else if (deletedAt.seconds) {
    deletedTime = deletedAt.seconds * 1000;
  } else {
    return 30;
  }

  const daysPassed = Math.floor((Date.now() - deletedTime) / (24 * 60 * 60 * 1000));
  return Math.max(0, 30 - daysPassed);
};

// Helper to assign a variant based on book ID (Green variants 1 & 3 removed)
const getVariant = (id) => {
  if (!id) return 2;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const availableVariants = [1, 2, 4];
  return availableVariants[Math.abs(hash) % availableVariants.length];
};

export default function BinCard({ book, onRestore, onPermanentDelete, selectedBinBooks, toggleBinSelection, requestConfirm, currentUser }) {
  const [imageError, setImageError] = useState(false);
  const isAdmin = currentUser?.profile?.role === 'admin';
  const isAuthorized = isAdmin || (currentUser && book.userId === currentUser.id);
  const isSelected = selectedBinBooks?.has(book.id) || false;
  const daysRemaining = getDaysRemaining(book.deletedAt);
  const isCritical = daysRemaining <= 7;
  const variant = getVariant(book.id);

  const handlePermanentDelete = async () => {
    const confirmed = await requestConfirm({
      title: "Permanently Delete Book",
      message: `This will permanently delete "${book.title}". This action cannot be undone.`,
      iconType: "danger",
      confirmText: "Delete Forever",
      confirmColor: "#ef4444",
    });
    if (!confirmed) return;
    try {
      await onPermanentDelete(book.id);
      toast.success("Deleted successfully");
    } catch (error) {
      toast.error("Failed to delete item!");
      console.error(error);
    }
  };

  const formattedDate = book.deletedAt ? new Date(typeof book.deletedAt === 'object' && book.deletedAt.seconds ? book.deletedAt.seconds * 1000 : book.deletedAt).toLocaleDateString() : 'Unknown';
  // Pure dark poster design matching the reference image exactly
  return (
    <div className={`bin-card-poster ${isSelected ? 'selected' : ''}`}>

      {/* Checkbox - Absolute Top Left */}
      {isAuthorized && (
        <div className="bin-checkbox-wrapper" style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 10 }}>
          <input
            type="checkbox"
            id={`bin-${book.id}`}
            checked={isSelected}
            onChange={() => toggleBinSelection(book.id)}
            className="bin-checkbox"
          />
          <label htmlFor={`bin-${book.id}`} className="bin-checkbox-label" style={{ margin: 0 }}></label>
        </div>
      )}

      {/* Top Header (Days Left) */}
      <div className="rbc-poster-header" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginBottom: '8px' }}>
        <div className="rbc-days-left" style={{ color: isCritical ? '#ef4444' : 'inherit' }}>
          <Clock size={12} style={{ marginRight: '4px' }} /> {daysRemaining} Days Left
        </div>
      </div>

      {/* Giant Title & Author */}
      <div className="rbc-poster-title-wrapper">
        <h2 className="rbc-title">
          {book.title.length > 20 ? book.title.substring(0, 20) + '...' : book.title}
        </h2>
        <p className="rbc-author">
          {book.author ? `By ${book.author}` : 'System Log'}
        </p>
      </div>

      {/* Center Art - Star Cutout */}
      <div className="rbc-poster-art-section" style={{ position: 'relative', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0', minHeight: '60px' }}>

        {/* Astroid (4-pointed curved star) Mask containing the Book Cover */}
        <div className="rbc-star-mask" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 1 }}>
          {(book.frontCoverUrl && !imageError) ? (
            <img 
              src={book.frontCoverUrl} 
              alt={book.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} 
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
            <div style={{ width: '100%', height: '100%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={40} className="text-muted" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="rbc-poster-footer" style={{ zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>✦</span>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '2px', opacity: 0.9 }}>
            RECYCLE BIN
          </div>
        </div>

        {/* Actions */}
        {isAuthorized && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onRestore(book.id)}
              className="rbc-poster-restore-btn"
              title="Restore Book"
            >
              <RotateCw size={12} /> Restore
            </button>
            <button
              onClick={handlePermanentDelete}
              className="rbc-poster-delete-btn"
              title="Delete Permanently"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
