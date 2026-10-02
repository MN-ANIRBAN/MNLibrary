import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Share2, BookOpen, Layers, Edit3, Tag, Globe, User, UserCheck, Barcode, MapPin, CalendarDays, Maximize2 } from "lucide-react";
import toast from "react-hot-toast";
import BookImageModal from "./BookImageModal";

const getGradient = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color1 = `hsl(${Math.abs(hash) % 360}, 75%, 60%)`;
  const color2 = `hsl(${(Math.abs(hash) + 40) % 360}, 85%, 45%)`;
  return `linear-gradient(135deg, ${color1}, ${color2})`;
};

export default function AdminViewerBookCard({ book, index }) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImgIndex, setCurrentImgIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  const title = book.title || "Untitled";
  const author = book.author || "Unknown Author";
  const coverGradient = useMemo(() => getGradient(title + author), [title, author]);

  const images = [book.frontCoverUrl, book.coverUrl, book.backCoverUrl, ...(book.extraImages || [])].filter(Boolean);
  const hasImages = images.length > 0;

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}?sharedBookId=${book.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share link copied!");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'read':
      case 'completed': return '#10b981';
      case 'reading': return '#3b82f6';
      case 'wishlist': return '#db2777';
      default: return '#8b5cf6';
    }
  };

  const getStatusLabel = (status) => {
    if (status === 'wishlist' || book.isWishlisted) return 'Wishlisted';
    if (status === 'read') return 'Finished';
    if (status === 'reading') return 'In Progress';
    if (status === 'unread') return 'To Read';
    return status || 'To Read';
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        style={{
          display: 'flex',
          flexDirection: 'row',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          height: '160px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          transition: 'all 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 30px -10px rgba(99, 102, 241, 0.2)';
          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.03)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        {/* Left Image Section */}
        <div style={{
          width: '110px',
          minWidth: '110px',
          height: '100%',
          position: 'relative',
          background: hasImages ? '#1e293b' : coverGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {hasImages ? (
            <AnimatePresence mode="wait">
              <motion.img
                key={currentImgIndex}
                src={images[currentImgIndex]}
                alt="Book Cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                loading="lazy"
                decoding="async"
                onError={() => setImageError(true)}
                onLoad={(e) => {
                  if (e.target.naturalWidth === 180 && e.target.naturalHeight === 180) {
                    setImageError(true);
                  }
                }}
              />
            </AnimatePresence>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.7)' }}>
              <BookOpen size={28} />
            </div>
          )}

          {images.length > 1 && (
            <div style={{
              position: 'absolute', inset: 0, opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px'
            }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
            >
              <button onClick={prevImage} style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}><ChevronLeft size={12} /></button>
              <button onClick={nextImage} style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)' }}><ChevronRight size={12} /></button>
            </div>
          )}

          {/* Status Badge */}
          <div style={{
            position: 'absolute', top: '4px', left: '4px',
            background: getStatusColor(book.status || (book.isWishlisted ? 'wishlist' : 'unread')),
            color: 'white', borderRadius: '4px', padding: '2px 6px',
            fontSize: '0.6rem', fontWeight: 700, backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)', textTransform: 'uppercase',
            zIndex: 10, letterSpacing: '0.5px'
          }}>
            {getStatusLabel(book.status)}
          </div>

          <button
            onClick={() => setShowImageModal(true)}
            style={{
              position: 'absolute', bottom: '4px', right: '4px',
              background: 'rgba(0,0,0,0.4)', color: 'white', border: 'none', borderRadius: '4px', width: '22px', height: '22px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: 'background 0.2s', zIndex: 10
            }}
            title="Expand Image"
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}
          >
            <Maximize2 size={12} />
          </button>
        </div>

        {/* Right Content Section */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {title}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                by {author}
              </p>
            </div>

            <button
              onClick={handleShare}
              style={{
                background: 'rgba(99, 102, 241, 0.05)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.1)', width: '28px', height: '28px',
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.2s', padding: 0
              }}
              title="Share Book Link"
              onMouseEnter={(e) => { e.currentTarget.style.background = '#6366f1'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'; e.currentTarget.style.color = '#6366f1'; }}
            >
              <Share2 size={14} />
            </button>
          </div>

          {/* Mini Tags */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginTop: '10px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* IE and Edge */
              flexShrink: 0,
              WebkitOverflowScrolling: 'touch'
            }}
            className="hide-scrollbar" /* fallback if needed */
          >
            {/* Inline CSS to hide scrollbar for webkit */}
            <style>
              {`
                .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}
            </style>

            {book.genre && (
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', padding: '3px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Layers size={10} /> {book.genre}
              </span>
            )}
            {book.pages && (
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', padding: '3px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <BookOpen size={10} /> {book.pages}p
              </span>
            )}
            {book.price && (
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', padding: '3px 10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '20px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <Tag size={10} /> ₹{book.price}
              </span>
            )}
            {book.isbn && (
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', padding: '3px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Barcode size={10} /> {book.isbn}
              </span>
            )}
            {book.language && (
              <span style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.65rem', padding: '3px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '20px', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Globe size={10} /> {book.language}
              </span>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Footer - Ownership & Location */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px dashed var(--border)', paddingTop: '6px', marginTop: '6px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {book.owner && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ background: 'rgba(99,102,241,0.1)', padding: '2px', borderRadius: '4px', color: '#6366f1' }}><User size={10} /></div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-1)', fontWeight: 600 }}>{book.owner.split(' ')[0]}</span>
                </div>
              )}
              {book.custody && book.custody !== book.owner && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '2px', borderRadius: '4px', color: '#f59e0b' }}><UserCheck size={10} /></div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-1)', fontWeight: 600 }}>{book.custody.split(' ')[0]}</span>
                </div>
              )}
            </div>

            {book.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-3)' }}>
                <MapPin size={10} /> <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.location}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {showImageModal && (
        <BookImageModal book={book} onClose={() => setShowImageModal(false)} />
      )}
    </>
  );
}
