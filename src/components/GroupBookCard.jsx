import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, User, BookOpen } from "lucide-react";
import BookImageModal from "./BookImageModal";
import ActivityLogModal from "./ActivityLogModal";

const getGradient = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color1 = `hsl(${Math.abs(hash) % 360}, 70%, 65%)`;
  const color2 = `hsl(${(Math.abs(hash) + 40) % 360}, 80%, 50%)`;
  return `linear-gradient(135deg, ${color1}, ${color2})`;
};

export default function GroupBookCard({ book, index, partnerName, isReadOnly, currentUser, onMarkHandover }) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);

  const title = book.title || "Untitled";
  const author = book.author || "Unknown Author";

  const coverGradient = useMemo(() => getGradient(title + author), [title, author]);

  const images = [book.coverUrl, book.frontCoverUrl, book.backCoverUrl, ...(book.extraImages || [])].filter(Boolean);
  const hasImages = images.length > 0;

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const myNameUpper = (currentUser?.profile?.full_name || currentUser?.user_metadata?.display_name || currentUser?.email?.split('@')[0] || "ME").toUpperCase();
  const myEmailPrefixUpper = currentUser?.email?.split('@')[0]?.toUpperCase() || "";
  const myEmailUpper = currentUser?.email?.toUpperCase() || "";

  const ownerUpper = (book.owner || "").trim().toUpperCase();
  const custodyUpper = (book.custody || "").trim().toUpperCase();

  const isOwnerMine = ownerUpper === myNameUpper || ownerUpper === myEmailPrefixUpper || ownerUpper === myEmailUpper;
  const isCustodyMine = custodyUpper === myNameUpper || custodyUpper === myEmailPrefixUpper || custodyUpper === myEmailUpper;

  return (
    <>
      <motion.div
        className="viewer-book-card modern-card group-book-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05, duration: 0.4 }}
        onClick={() => setShowImageModal(true)}
      >
        <div className="mbc-image-container">
          {/* Top Tags */}
          <div className="mbc-tags">
            <span className="mbc-tag shared-tag">Shared by {partnerName}</span>
            {book.genre && (
              <span className="mbc-tag mbc-category">{book.genre}</span>
            )}
          </div>

          <div className="mbc-cover-bg" style={{ background: hasImages ? 'transparent' : coverGradient }}>
            {hasImages && (
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImgIndex}
                  src={images[currentImgIndex]}
                  alt="Book Cover"
                  className="mbc-cover-image"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>
            )}
          </div>

          {images.length > 1 && (
            <div className="vbc-slider-controls">
              <button className="vbc-slider-btn left" onClick={prevImage}>
                <ChevronLeft size={16} />
              </button>
              <button className="vbc-slider-btn right" onClick={nextImage}>
                <ChevronRight size={16} />
              </button>
              <div className="vbc-slider-dots">
                {images.map((_, i) => (
                  <span key={i} className={`vbc-dot ${i === currentImgIndex ? 'active' : ''}`} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mbc-info">
          <h3 className="mbc-title">{title}</h3>
          <p className="mbc-author">{author}</p>

          <div className="group-book-details">
            <div className="detail-row">
              <User size={14} />
              <span>Owner: <strong>{book.owner || "Unknown"}</strong></span>
            </div>
            <div className="detail-row">
              <BookOpen size={14} />
              <span>Custody: <strong>{book.custody || "Unknown"}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              className="group-activity-btn"
              style={{ flex: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                setShowActivityModal(true);
              }}
            >
              History
            </button>

            {!isOwnerMine && isCustodyMine && onMarkHandover && (
              <button
                className="group-activity-btn"
                style={{ flex: 1, background: 'var(--amber-bg)', color: 'var(--amber-color)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkHandover(book.id, 'handover');
                }}
              >
                Handover
              </button>
            )}

            {isOwnerMine && !isCustodyMine && onMarkHandover && (
              <button
                className="group-activity-btn"
                style={{ flex: 1, background: 'var(--emerald-bg)', color: 'var(--emerald-color)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkHandover(book.id, 'received');
                }}
              >
                Mark Received
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {showImageModal && (
        <BookImageModal book={book} onClose={() => setShowImageModal(false)} />
      )}

      {showActivityModal && (
        <ActivityLogModal
          book={book}
          onClose={() => setShowActivityModal(false)}
        />
      )}
    </>
  );
}
