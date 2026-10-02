import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import {
  Search, Shield, BookOpen, Library, Moon, Sun,
  X, ArrowUp, User, Users, Clock, ScanBarcode, CheckCircle2
} from "lucide-react";

export default function LandingPage({ onLoginClick, onOpenPrivacy, onOpenTerms }) {

  const [isScrolled, setIsScrolled] = useState(false);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [theme, setTheme] = useState(() => {
    if (localStorage.getItem("theme")) return localStorage.getItem("theme");
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowTopBtn(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));


  return (
    <div className="landing-container" data-theme={theme}>
      {/* Header */}
      <header className={`landing-header pro-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="pro-brand">
          <div className="pro-brand-logo">
            <DotLottieReact
              src="/assets/brand.lottie"
              style={{ width: 28, height: 28, display: "block" }}
              loop
              autoplay
            />
          </div>
          <div className="pro-brand-text">
            <h1>MN-Library<span className="pro-brand-dot">.</span></h1>
            <span className="pro-brand-badge">BY ANIRBAN ADHIKARY</span>
          </div>
        </div>

        <div className="pro-header-actions">
          <button className="pro-icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="pro-admin-btn" onClick={onLoginClick}>
            <User size={16} />
            <span>Login</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-background-glow"></div>
        <div className="hero-content">
          <motion.div
            className="policy-notice-box top-policy-margin"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Shield size={16} className="policy-icon" />
            <p className="policy-disclaimer">
              <strong>Policy:</strong> This platform strictly prohibits piracy, cheating, and unauthorized distribution of copyrighted material.
            </p>
          </motion.div>
          <motion.div
            className="hero-header-text"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-badge">
              <Library size={14} />
              <span>Smart Book Management</span>
            </div>
            <h1 className="hero-title">
              Your Personal <span className="hero-highlight">Library</span><br /> Organized.
            </h1>
            <p className="hero-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
              MN-Library is a comprehensive platform to digitize your book collection, share with friends, and track every handover seamlessly.
            </p>
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="pro-admin-btn" onClick={onLoginClick} style={{ padding: '0.75rem 1.5rem', fontSize: '1.1rem' }}>
                <User size={18} />
                <span>Get Started</span>
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      {/* Features Section */}
      <section className="landing-features" style={{ padding: '5rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <style>{`
          .bento-grid {
            display: grid;
            gap: 1.5rem;
            grid-template-columns: 1fr;
          }
          .bento-card {
            background: var(--bg-secondary);
            padding: 2.5rem;
            borderRadius: 24px;
            border: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            border-radius: 24px;
            overflow: hidden;
            position: relative;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .bento-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 30px rgba(0,0,0,0.1);
          }
          @media (min-width: 768px) {
            .bento-grid {
              grid-template-columns: repeat(4, 1fr);
              grid-auto-rows: minmax(220px, auto);
            }
            .bento-item-0 { grid-column: span 2; grid-row: span 2; }
            .bento-item-1 { grid-column: span 2; grid-row: span 1; }
            .bento-item-2 { grid-column: span 1; grid-row: span 1; }
            .bento-item-3 { grid-column: span 1; grid-row: span 1; }
          }
        `}</style>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Everything you need</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Manage your books like a pro with our powerful tools.</p>
        </motion.div>

        <div className="bento-grid">
          {/* Big Card: Digital Inventory */}
          <motion.div
            className="bento-card bento-item-0"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: '#3b82f6', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
              }}>
                <BookOpen size={28} />
              </div>
              <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.01em' }}>Digital Inventory</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: '90%' }}>
                Transform your physical bookshelf into a beautifully organized digital collection. Keep a complete record of all your books with covers, authors, and metadata in one easily searchable place.
              </p>
            </div>
          </motion.div>

          {/* Wide Card: Group Sharing */}
          <motion.div
            className="bento-card bento-item-1"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem'
            }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Group Sharing</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Create trusted groups with friends or colleagues. Pool your books together and discover what others in your circle are reading.
            </p>
          </motion.div>

          {/* Small Card: Handover Tracking */}
          <motion.div
            className="bento-card bento-item-2"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem'
            }}>
              <Clock size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Handover Tracking</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Never lose a book again. Track exactly who borrowed what and when.
            </p>
          </motion.div>

          {/* Small Card: ISBN Scanner */}
          <motion.div
            className="bento-card bento-item-3"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem'
            }}>
              <ScanBarcode size={24} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>ISBN Scanner</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Add books in seconds by scanning their barcode with your camera.
            </p>
          </motion.div>

        </div>
      </section>


      {/* Footer */}
      <footer className="landing-footer pro-footer">
        <div className="footer-compact">
          <div className="footer-brand-line">
            <h4 className="footer-gradient-brand">MN-Library<span className="pro-brand-dot">.</span></h4>
            <span className="footer-copyright">&copy; {new Date().getFullYear()} by Anirban Adhikary. All rights reserved.</span>
          </div>

          {/* Legal links */}
          <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => onOpenPrivacy?.()}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#818cf8', fontSize: 13, textDecoration: 'none',
                opacity: 0.85, padding: 0, fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.target.style.opacity = 1}
              onMouseLeave={e => e.target.style.opacity = 0.85}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onOpenTerms?.()}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#818cf8', fontSize: 13, textDecoration: 'none',
                opacity: 0.85, padding: 0, fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.target.style.opacity = 1}
              onMouseLeave={e => e.target.style.opacity = 0.85}
            >
              Terms of Service
            </button>
          </div>


          <div className="policy-notice-box footer-policy-margin">
            <Shield size={14} className="policy-icon" />
            <p className="policy-disclaimer">
              <strong>Policy:</strong> This platform strictly prohibits piracy, cheating, and unauthorized distribution of copyrighted material.
              All content must comply with local and international intellectual property laws.
            </p>
          </div>
        </div>
      </footer>


      {/* Go to Top Button */}
      <AnimatePresence>
        {showTopBtn && (
          <motion.button
            className="go-top-btn"
            onClick={scrollToTop}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -6, 0]
            }}
            transition={{
              opacity: { duration: 0.3 },
              scale: { duration: 0.3, type: "spring" },
              y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
            }}
            exit={{ opacity: 0, scale: 0.5, y: 20, transition: { duration: 0.2 } }}
            whileHover={{ scale: 1.1, y: -2, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.9 }}
            title="Go to top"
          >
            <ArrowUp size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
