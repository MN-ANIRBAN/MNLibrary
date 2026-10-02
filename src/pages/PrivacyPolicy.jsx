import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Database, Clock, FileText, Settings, ArrowLeft, Mail, ChevronRight } from 'lucide-react';

export default function PrivacyPolicy({ onBack }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="policy-container" style={{
      minHeight: '100vh',
      background: 'var(--bg-primary, #0f0f1a)',
      color: 'var(--text-1, #f1f5f9)',
      paddingBottom: '80px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Orbs */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(40px)', zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '30vw', height: '30vw',
        background: 'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(40px)', zIndex: 0, pointerEvents: 'none'
      }} />

      {/* Sticky Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--bg-glass, rgba(15,15,26,0.85))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border, rgba(139,92,246,0.15))',
          padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="policy-back-btn"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-light, rgba(255,255,255,0.1))',
              color: 'var(--text-2, #c4b5fd)',
              padding: '8px 16px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--pro-primary, #6366f1)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = 'transparent';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-2, #c4b5fd)';
              e.currentTarget.style.borderColor = 'var(--border-light, rgba(255,255,255,0.1))';
            }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
        <span style={{ color: 'var(--text-3, #94a3b8)', fontSize: '14px', fontWeight: 500, letterSpacing: '0.5px' }}>MN-Library · Legal</span>
      </motion.div>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', padding: '60px 24px' }}>
        
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(99,102,241,0.1)', borderRadius: '20px', color: '#818cf8', fontSize: '13px', fontWeight: 700, marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            <Shield size={14} /> Security First
          </div>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            fontWeight: 800,
            marginBottom: '16px',
            lineHeight: 1.1,
            letterSpacing: '-1px',
            background: 'linear-gradient(135deg, var(--text-1) 0%, var(--text-2) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Privacy Policy
          </h1>
          <p style={{ color: 'var(--text-3, #94a3b8)', fontSize: '16px', marginBottom: '60px', fontWeight: 500 }}>
            Last updated: August 2026
          </p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          
          <PolicySection 
            icon={<Shield />} 
            title="1. Who We Are"
            variants={itemVariants}
          >
            MN-Library is a personal book inventory management app designed to give you total control over your collection. We prioritize your privacy and store your data securely using Supabase (PostgreSQL), a globally recognized GDPR-compliant infrastructure.
          </PolicySection>

          <PolicySection 
            icon={<Database />} 
            title="2. What Data We Collect"
            variants={itemVariants}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <DataPoint title="Account data" desc="Email address, display name, and optional profile picture." />
              <DataPoint title="Book records" desc="Title, author, ISBN, ownership status, and personal notes." />
              <DataPoint title="Group data" desc="Shared spaces, member lists, and activity logs within groups." />
              <DataPoint title="System logs" desc="Bulk updates and non-intrusive activity tracing tied to your account." />
            </div>
            <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '14px' }}>
              <strong>Note:</strong> We do <strong>not</strong> collect payment information, precise location data, or device fingerprints.
            </div>
          </PolicySection>

          <PolicySection 
            icon={<Lock />} 
            title="3. Data Storage & Security"
            variants={itemVariants}
          >
            Your trust is our top priority. We employ industry-leading security practices:
            <ul style={{ marginTop: '16px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Data is encrypted in transit (HTTPS / TLS 1.3) and at rest.</li>
              <li>Row-Level Security (RLS) ensures nobody else can query your personal data.</li>
              <li>Authentication is powered by enterprise-grade JWT token validation.</li>
              <li>Strict rate limiting prevents brute-force attacks and abuse.</li>
            </ul>
          </PolicySection>

          <PolicySection 
            icon={<Settings />} 
            title="4. Your Rights (GDPR)"
            variants={itemVariants}
          >
            You are the absolute owner of your data. Under the GDPR, you have the right to:
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <RightCard title="Access" desc="Request a full export of your data anytime." />
              <RightCard title="Correction" desc="Instantly update incorrect details via settings." />
              <RightCard title="Deletion" desc="Permanently erase your account and all history." />
              <RightCard title="Portability" desc="Take your book lists to other platforms easily." />
            </div>
          </PolicySection>

          <PolicySection 
            icon={<Clock />} 
            title="5. Data Retention"
            variants={itemVariants}
          >
            Your data is preserved exclusively while your account is active. Items moved to the recycling bin are automatically purged after 30 days. Should you choose to delete your account, all associated data is wiped from our active databases instantly.
          </PolicySection>

          <PolicySection 
            icon={<FileText />} 
            title="6. Cookies & Tracking"
            variants={itemVariants}
          >
            We respect your digital footprint. MN-Library relies solely on functional cookies required for authentication and basic app functionality. <strong>We do not use advertising trackers or third-party analytics engines like Google Analytics.</strong>
          </PolicySection>
          
          <PolicySection 
            icon={<Mail />} 
            title="7. Contact & Support"
            variants={itemVariants}
          >
            Have a question about your privacy or want to exercise your rights? We're here to help.
            <div style={{ marginTop: '16px' }}>
              <a href="mailto:abumbabum@gmail.com" style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px', background: 'var(--pro-primary, #6366f1)',
                color: '#fff', textDecoration: 'none', borderRadius: '12px',
                fontWeight: 600, transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(99,102,241,0.3)'
              }}>
                abumbabum@gmail.com
              </a>
            </div>
          </PolicySection>

        </motion.div>
      </div>
    </div>
  );
}

// ─── Reusable UI Components ──────────────────────────────────────────

function PolicySection({ icon, title, children, variants }) {
  return (
    <motion.div 
      variants={variants}
      style={{
        background: 'var(--bg-elevated, rgba(255,255,255,0.03))',
        border: '1px solid var(--border, rgba(255,255,255,0.05))',
        borderRadius: '24px',
        padding: '32px',
        marginBottom: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        transition: 'transform 0.3s ease, border-color 0.3s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'var(--pro-primary, rgba(99,102,241,0.5))';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'var(--border, rgba(255,255,255,0.05))';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'rgba(99,102,241,0.1)', color: 'var(--pro-primary, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-1, #f1f5f9)', margin: 0 }}>
          {title}
        </h2>
      </div>
      <div style={{ color: 'var(--text-2, #cbd5e1)', lineHeight: 1.7, fontSize: '15px' }}>
        {children}
      </div>
    </motion.div>
  );
}

function DataPoint({ title, desc }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <ChevronRight size={16} color="var(--pro-primary, #6366f1)" style={{ marginTop: '4px', flexShrink: 0 }} />
      <div>
        <strong style={{ color: 'var(--text-1)' }}>{title}:</strong> {desc}
      </div>
    </div>
  );
}

function RightCard({ title, desc }) {
  return (
    <div style={{
      padding: '16px', borderRadius: '12px',
      background: 'var(--bg-input, rgba(0,0,0,0.05))', border: '1px solid var(--border)'
    }}>
      <div style={{ color: 'var(--pro-primary, #6366f1)', fontWeight: 600, marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}
