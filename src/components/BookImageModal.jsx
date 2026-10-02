import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, ImageOff, Check, Trash2, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { supabase } from "../supabase/config";
import toast from "react-hot-toast";
import ImageUploadControl from "./ImageUploadControl";
import ConfirmDialog from "./ConfirmDialog";
import { sanitizeString } from "../utils/sanitize";
import "./TrifoldBookModal.css";

export default function BookImageModal({ book, onClose, currentUser }) {
  const [images, setImages] = useState(book?.images || [book?.frontCoverUrl || book?.coverUrl, book?.backCoverUrl, ...(book?.extraImages || [])].filter(Boolean));
  const [description, setDescription] = useState(book?.description || "");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [zoomedIndex, setZoomedIndex] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  const isAdmin = currentUser?.profile?.role === 'admin';
  const isAuthorized = isAdmin || (currentUser && book.userId === currentUser.id);

  const fetchImages = useCallback(async () => {
    const hasAnyImage = images.length > 0 || book?.frontCoverUrl || book?.images?.length > 0;

    if (hasAnyImage && book?.description) {
      setLoading(false);
      return;
    }

    if (!hasAnyImage) {
      setLoading(true);
    }
    setHasSearched(true);
    let autoFront = images[0] || "";
    let autoBack = images[1] || "";
    let autoDesc = description;

    try {
      const cleanIsbn = (book?.isbn || "").replace(/[^0-9X]/gi, "");
      const englishTitle = (book?.title || "").split("||")[0].trim();
      const englishAuthor = (book?.author || "").split("||")[0].trim();

      if (!autoFront || !autoDesc) {
        const queries = [];
        if (cleanIsbn) queries.push(`isbn:${cleanIsbn}`);
        if (englishTitle) queries.push(`${englishTitle} ${englishAuthor}`.trim());

        for (const q of queries) {
          try {
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=3`);
            const data = await res.json();
            if (data.items) {
              for (const item of data.items) {
                const info = item.volumeInfo;
                if (!autoFront && info.imageLinks) {
                  const links = info.imageLinks;
                  const bestLink = links.extraLarge || links.large || links.medium || links.thumbnail;
                  if (bestLink) {
                    autoFront = bestLink.replace("&edge=curl", "").replace("http://", "https://").replace(/&zoom=\d/, "&zoom=2");
                  }
                }
                if (!autoDesc && info.description) {
                  autoDesc = info.description;
                }
                if (autoFront && autoDesc) break;
              }
              if (autoFront && autoDesc) break;
            }
          } catch (e) {
            console.warn("Google Books fetch error:", e);
          }
        }
      }

      if (cleanIsbn && (!autoFront || !autoBack) && !hasAnyImage) {
        try {
          const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
          const data = await res.json();
          const bookKey = `ISBN:${cleanIsbn}`;
          if (data && data[bookKey]?.cover) {
            const olCover = data[bookKey].cover.large || data[bookKey].cover.medium;
            if (olCover) {
              if (!autoFront) {
                autoFront = olCover;
              } else if (autoFront !== olCover && !autoBack) {
                autoBack = olCover;
              }
            }
          }
        } catch (e) {
          console.warn("Open Library fetch error:", e);
        }
      }

    } catch (err) {
      console.error("Image fetch error:", err);
    }

    setImages(prev => {
      let next = [...prev];
      let changed = false;
      if (!hasAnyImage && autoFront && !next[0]) {
        next[0] = autoFront;
        changed = true;
      }
      if (!hasAnyImage && autoBack && !next[1]) {
        if (next.length === 0) next.push("");
        next[1] = autoBack;
        changed = true;
      }
      return changed ? next.filter(Boolean) : prev;
    });

    if (!book?.description && autoDesc) setDescription(autoDesc);
    setLoading(false);
  }, [book, images, description]);

  useEffect(() => {
    if (!hasSearched) {
      fetchImages();
    }
  }, [fetchImages, hasSearched]);

  useEffect(() => {
    // Trigger opening animation slightly after mount for smoother effect
    const timer = setTimeout(() => setIsOpen(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [images, description, book]);

  const handleSaveUrls = async () => {
    if (!isAuthorized) return;
    setIsSaving(true);
    try {
      const cleanImages = images.map(url => url.trim()).filter(Boolean);
      const { error } = await supabase.from('books').update({
        images: cleanImages,
        frontCoverUrl: cleanImages[0] || "",
        backCoverUrl: cleanImages[1] || "",
        extraImages: cleanImages.slice(2) || [],
        description: description.trim(),
      }).eq('id', book.id);
      if (error) throw error;
      toast.success("Cover & Details saved successfully!");
    } catch (err) {
      console.error("Error saving details:", err);
      toast.error("Failed to save details.");
    } finally {
      setIsSaving(false);
    }
  };

  const titleParts = (book?.title || "").split("||").map(s => s.trim());
  const englishTitle = titleParts[0] || "Unknown Title";

  const authorParts = (book?.author || "").split("||").map(s => s.trim());
  const englishAuthor = authorParts[0] || "Unknown Author";

  const allImages = images.filter(Boolean);
  const primaryCover = allImages[0];

  const handleClose = () => {
    const initialImages = book?.images || [book?.frontCoverUrl || book?.coverUrl, book?.backCoverUrl, ...(book?.extraImages || [])].filter(Boolean);
    const initialDesc = book?.description || "";
    const isChanged = JSON.stringify(images) !== JSON.stringify(initialImages) || description !== initialDesc;

    if (isChanged) {
      setShowConfirm(true);
    } else {
      setIsOpen(false);
      setTimeout(onClose, 1500); // Wait for the new smoother fold animation (1.5s)
    }
  };

  const nextZoomedImage = (e) => {
    e.stopPropagation();
    if (zoomedIndex !== null) setZoomedIndex((zoomedIndex + 1) % allImages.length);
  };

  const prevZoomedImage = (e) => {
    e.stopPropagation();
    if (zoomedIndex !== null) setZoomedIndex((zoomedIndex - 1 + allImages.length) % allImages.length);
  };

  return createPortal(
    <>
      <div className="trifold-overlay" onClick={handleClose}>

        {isAuthorized && (
          <button
            className="trifold-save-btn"
            onClick={(e) => { e.stopPropagation(); handleSaveUrls(); }}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isSaving ? "Saving..." : "Save Details"}
          </button>
        )}

        <button className="trifold-close-btn" onClick={(e) => { e.stopPropagation(); handleClose(); }}>
          <X size={24} />
        </button>

        <div className={`trifold-scene ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>

          {/* CENTER PANEL is now the COVER */}
          <div className="trifold-center">

            {/* Left Panel (Description) */}
            <div className="trifold-left">
              <div className="trifold-panel-content" style={{ transform: 'translateZ(1px)' }}>
                <div className="crease-shadow-left"></div>
                <div style={{ position: 'absolute', inset: 0, padding: '30px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <div className="trifold-giant-text trifold-giant-text-top" style={{ top: '15px', left: '15px' }}>ABOUT</div>
                  <h3 className="trifold-section-title" style={{ justifyContent: 'center', margin: '0 0 20px 0' }}>Description</h3>
                  <div className="description-container" style={{ flex: 1, textAlign: 'justify', fontSize: '15px', lineHeight: '1.8', color: 'var(--text-1)', zIndex: 10, position: 'relative' }}>
                    {isAuthorized ? (
                      isEditingDesc ? (
                        <textarea
                          className="description-editor"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          onBlur={() => setIsEditingDesc(false)}
                          placeholder="Add or edit description..."
                          style={{ width: '100%', height: '100%', minHeight: '300px' }}
                          autoFocus
                        />
                      ) : (
                        <div
                          style={{ cursor: 'pointer', height: '100%', minHeight: '300px' }}
                          onClick={() => setIsEditingDesc(true)}
                          dangerouslySetInnerHTML={{ __html: description || '<span style="opacity:0.5">Click to add description...</span>' }}
                        />
                      )
                    ) : (
                      description ? (
                        <div dangerouslySetInnerHTML={{ __html: sanitizeString(description) }} />
                      ) : (
                        <div style={{ opacity: 0.5 }}>No description available</div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel (Admin / Images) */}
            <div className="trifold-right">
              <div className="trifold-panel-content" style={{ transform: 'translateZ(1px)' }}>
                <div className="crease-shadow-right"></div>

                {/* Scrollable inner container to maintain 30px outer padding symmetry */}
                <div className="right-panel-scrollable" style={{ position: 'absolute', inset: 0, padding: '30px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  <div className="trifold-giant-text" style={{ bottom: '15px', right: '15px' }}>MEDIA</div>

                  <div className="trifold-accent-block">
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600 }}>Gallery & Uploads</h3>
                    <p style={{ margin: 0, fontSize: '12px', opacity: 0.8, lineHeight: 1.4 }}>Manage additional images and variant covers.</p>
                  </div>

                  {isAuthorized && (
                    <div style={{ marginBottom: '20px', zIndex: 10, position: 'relative' }}>
                      <ImageUploadControl
                        label="Upload More Images"
                        hidePreview={true}
                        value={""}
                        allowMultiple={true}
                        onChange={(urlOrUrls) => {
                          if (urlOrUrls) {
                            const newUrls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
                            setImages(prev => [...new Set([...prev, ...newUrls])]);
                          }
                        }}
                      />
                    </div>
                  )}

                  <div className="image-thumbs-grid">
                    {allImages.length > 0 ? (
                      allImages.map((src, idx) => (
                        <div
                          key={`${src}-${idx}`}
                          className="thumb-wrapper"
                          onClick={() => setZoomedIndex(idx)}
                          draggable={isAuthorized}
                          onDragStart={(e) => {
                            if (isAuthorized) setDraggedIdx(idx);
                          }}
                          onDragOver={(e) => {
                            if (isAuthorized) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (isAuthorized) {
                              e.preventDefault();
                              if (draggedIdx === null || draggedIdx === idx) return;
                              setImages(prev => {
                                const newImages = prev.filter(Boolean);
                                const draggedItem = newImages[draggedIdx];
                                newImages.splice(draggedIdx, 1);
                                newImages.splice(idx, 0, draggedItem);
                                return newImages;
                              });
                              setDraggedIdx(null);
                            }
                          }}
                          style={{ cursor: isAuthorized ? 'grab' : 'pointer', opacity: draggedIdx === idx ? 0.4 : 1, border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          <img
                            src={src}
                            alt={`Thumb ${idx}`}
                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/150x220/111827/4ade80?text=Error'; }}
                            style={{ pointerEvents: 'none' }}
                          />
                          {isAuthorized && (
                            <button
                              className="delete-thumb-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setImages(prev => prev.filter(img => img !== src));
                              }}
                              title="Remove Image"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', opacity: 0.5, marginTop: '20px' }}>
                        No additional images
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center Panel Content (Cover) is rendered LAST inside .trifold-center so it's structurally inside but visually on top */}
            <div className="trifold-panel-content">
              <div className="cover-image-container">
                {primaryCover ? (
                  <img
                    src={primaryCover}
                    alt="Cover"
                    onClick={() => setZoomedIndex(0)}
                    style={{ cursor: 'zoom-in' }}
                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/400x600/111827/4ade80?text=No+Cover'; }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#4ade80' }}>
                    <ImageOff size={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                    <span style={{ opacity: 0.7 }}>No Cover</span>
                  </div>
                )}
                <div className="cover-overlay-gradient"></div>
                <div className="cover-text-overlay">
                  <h2>{englishTitle}</h2>
                  <p>{englishAuthor}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Zoomed Image Overlay */}
      <AnimatePresence>
        {zoomedIndex !== null && allImages.length > 0 && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000000,
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); setZoomedIndex(null); }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setZoomedIndex(null); }}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', padding: '12px', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>

            {allImages.length > 1 && (
              <button
                onClick={prevZoomedImage}
                style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', padding: '16px', cursor: 'pointer' }}
              >
                <ChevronLeft size={32} />
              </button>
            )}

            <motion.img
              key={zoomedIndex}
              src={allImages[zoomedIndex]}
              alt="Zoomed"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />

            {allImages.length > 1 && (
              <button
                onClick={nextZoomedImage}
                style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', padding: '16px', cursor: 'pointer' }}
              >
                <ChevronRight size={32} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to save them before closing?"
        confirmText="Save & Close"
        cancelText="Discard & Exit"
        iconType="warning"
        confirmColor="#4ade80"
        onConfirm={async () => {
          setShowConfirm(false);
          await handleSaveUrls();
          setIsOpen(false);
          setTimeout(onClose, 1500);
        }}
        onCancel={() => {
          setShowConfirm(false);
          setIsOpen(false);
          setTimeout(onClose, 1500);
        }}
      />
    </>,
    document.body
  );
}
