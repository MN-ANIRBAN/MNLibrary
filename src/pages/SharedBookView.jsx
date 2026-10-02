import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase/config';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Loader2, Sparkles, User, Tag, Building2, AlignLeft, Info } from 'lucide-react';
import BookImageModal from '../components/BookImageModal';
import './SharedBookView.css';

export default function SharedBookView({ bookId, onBack }) {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Sync with theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", savedTheme || systemTheme);
  }, []);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('id', bookId)
          .single();

        if (error || !data) {
          setError("Book not found or you don't have permission to view it.");
          return;
        }

        setBook(data);
      } catch (err) {
        console.error("Error fetching shared book:", err);
        setError("An error occurred while fetching the book details.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchBook();
  }, [bookId]);

  if (loading) {
    return (
      <div className="shared-book-container loading">
        <Loader2 className="spinner-icon" size={40} />
        <p>Loading book details...</p>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="shared-book-container error">
        <div className="error-card glass-panel">
          <h2>Oops!</h2>
          <p>{error}</p>
          <button className="btn-primary mt-4" onClick={onBack}>
            <ArrowLeft size={18} /> Go to Library
          </button>
        </div>
      </div>
    );
  }

  const images = [book.coverUrl, book.frontCoverUrl, book.backCoverUrl, ...(book.extraImages || [])].filter(Boolean);
  const coverImg = images[0] || null;

  return (
    <motion.div 
      className="shared-book-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="shared-book-header">
        <button className="back-btn-shared" onClick={onBack}>
          <ArrowLeft size={20} />
          <span>Library</span>
        </button>
        <div className="brand-logo-shared">
          <BookOpen size={24} className="brand-icon-shared" />
          <span>MN-Library</span>
        </div>
      </div>

      <div className="shared-book-content">
        <div className="shared-book-layout">
          <motion.div 
            className="shared-book-cover-section"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {coverImg ? (
              <div className="shared-cover-wrapper" onClick={() => setShowImageModal(true)}>
                <img src={coverImg} alt={book.title} className="shared-main-cover" loading="lazy" decoding="async" />
                {images.length > 1 && (
                  <div className="image-count-badge">
                    <Sparkles size={14} /> +{images.length - 1} images
                  </div>
                )}
              </div>
            ) : (
              <div className="shared-cover-placeholder">
                <BookOpen size={64} />
                <span>No Cover Image</span>
              </div>
            )}
          </motion.div>

          <motion.div 
            className="shared-book-details-section"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h1 className="shared-book-title">{book.title || 'Untitled Book'}</h1>
            
            <div className="shared-book-meta-grid">
              <div className="meta-item">
                <User size={18} />
                <div>
                  <span className="meta-label">Author</span>
                  <span className="meta-value">{book.author || 'Unknown'}</span>
                </div>
              </div>
              <div className="meta-item">
                <Building2 size={18} />
                <div>
                  <span className="meta-label">Publisher</span>
                  <span className="meta-value">{book.publisher || 'Unknown'}</span>
                </div>
              </div>
              <div className="meta-item">
                <Tag size={18} />
                <div>
                  <span className="meta-label">Genre</span>
                  <span className="meta-value">{book.genre || 'Unspecified'}</span>
                </div>
              </div>
            </div>

            {book.synopsis && (
              <div className="shared-book-synopsis">
                <h3><AlignLeft size={20} /> About this Book</h3>
                <p>{book.synopsis}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {showImageModal && (
        <BookImageModal book={book} onClose={() => setShowImageModal(false)} />
      )}
    </motion.div>
  );
}
