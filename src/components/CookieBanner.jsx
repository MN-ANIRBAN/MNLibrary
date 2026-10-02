import React, { useState, useEffect } from 'react';

const COOKIE_KEY = 'mnlib_cookie_consent_v1';

/**
 * CookieBanner — GDPR-compliant cookie consent banner.
 * Shows on first visit. User can Accept or Decline.
 * Decision is stored in localStorage.
 *
 * Usage: Place once in App.jsx. Accepts onOpenPrivacy callback.
 */
export default function CookieBanner({ onOpenPrivacy }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if user hasn't decided yet
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Slight delay so splash screen finishes first
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(COOKIE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        width: 'min(560px, calc(100vw - 32px))',
        background: 'rgba(18, 18, 35, 0.97)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        borderRadius: 16,
        padding: '18px 22px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'cookieSlideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {/* Slide-up animation */}
      <style>{`
        @keyframes cookieSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(24px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* Icon + text */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22, lineHeight: 1.3 }}>🍪</span>
        <div>
          <p style={{
            margin: 0, fontSize: 13.5, color: '#e2e8f0', lineHeight: 1.6,
          }}>
            We use <strong style={{ color: '#c4b5fd' }}>essential cookies</strong> and localStorage
            to keep you logged in and cache your book data for faster loading.
            We do <strong>not</strong> use advertising or tracking cookies.{' '}
            <button
              onClick={onOpenPrivacy}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#818cf8', padding: 0, fontSize: 13.5,
                textDecoration: 'underline', fontFamily: 'inherit',
              }}
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          onClick={decline}
          style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: 'transparent', border: '1px solid rgba(148,163,184,0.3)',
            color: '#94a3b8', fontFamily: 'inherit', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'rgba(148,163,184,0.6)'; e.target.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.target.style.borderColor = 'rgba(148,163,184,0.3)'; e.target.style.color = '#94a3b8'; }}
        >
          Decline
        </button>
        <button
          onClick={accept}
          style={{
            padding: '8px 22px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            border: '1px solid rgba(139,92,246,0.4)',
            color: '#fff', fontWeight: 600, fontFamily: 'inherit',
            boxShadow: '0 2px 12px rgba(109,40,217,0.35)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)'; e.target.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.target.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)'; e.target.style.transform = 'translateY(0)'; }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
