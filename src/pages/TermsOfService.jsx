import React from 'react';
import { motion } from 'framer-motion';
import { Scale, Users, AlertTriangle, Copyright, FileText, ArrowLeft, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function TermsOfService({ onBack }) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
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
    <div className="terms-container" style={{
      minHeight: '100vh',
      background: 'var(--bg-primary, #0f0f1a)',
      color: 'var(--text-1, #f1f5f9)',
      paddingBottom: '80px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glows */}
      <div style={{
        position: 'absolute', top: '-15%', right: '-10%', width: '50vw', height: '50vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '-20%', width: '40vw', height: '40vw',
        background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, rgba(0,0,0,0) 70%)',
        filter: 'blur(50px)', zIndex: 0, pointerEvents: 'none'
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
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(168,85,247,0.1)', borderRadius: '20px', color: '#c084fc', fontSize: '13px', fontWeight: 700, marginBottom: '24px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            <Scale size={14} /> Legal Agreement
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
            Terms of Service
          </h1>
          <p style={{ color: 'var(--text-3, #94a3b8)', fontSize: '16px', marginBottom: '60px', fontWeight: 500 }}>
            Last updated: August 2026
          </p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          
          <TermSection 
            icon={<ShieldCheck />} 
            title="1. Acceptance & Eligibility"
            variants={itemVariants}
          >
            By accessing or using MN-Library, you enter into a binding agreement to abide by these Terms of Service. You must be at least 13 years of age to utilize our platform. We reserve the right to update these terms to reflect evolving standards or new features.
          </TermSection>

          <TermSection 
            icon={<Users />} 
            title="2. Account Responsibilities"
            variants={itemVariants}
          >
            Your account is your gateway to your personal library. You agree to:
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
              <CheckItem text="Maintain accurate and updated information." />
              <CheckItem text="Secure your authentication credentials." />
              <CheckItem text="Accept responsibility for account activity." />
              <CheckItem text="Report unauthorized access immediately." />
            </div>
          </TermSection>

          <TermSection 
            icon={<AlertTriangle />} 
            title="3. Prohibited Conduct"
            variants={itemVariants}
          >
            To maintain a safe and reliable environment for all users, the following activities are strictly forbidden:
            <ul style={{ marginTop: '16px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#ef4444' }}>
              <li>Uploading pirated, illegal, or unauthorized content.</li>
              <li>Reverse-engineering, scraping, or launching automated attacks on our infrastructure.</li>
              <li>Impersonating other users or creating deceptive duplicate accounts.</li>
              <li>Using the platform for unauthorized commercial gain or spamming.</li>
            </ul>
          </TermSection>

          <TermSection 
            icon={<Copyright />} 
            title="4. Intellectual Property"
            variants={itemVariants}
          >
            We respect creators and their intellectual property. Metadata and book details you log must pertain to items you legitimately own or interact with. The platform architecture, design assets, and codebase remain the exclusive property of MN-Library.
          </TermSection>

          <TermSection 
            icon={<FileText />} 
            title="5. User Content License"
            variants={itemVariants}
          >
            Any notes, tags, and reviews you generate are yours. By creating them on MN-Library, you grant us a non-exclusive, royalty-free license to store and present that content back to you. We <strong>never</strong> sell or repurpose your private content for advertising.
          </TermSection>

          <TermSection 
            icon={<Scale />} 
            title="6. Limitation of Liability"
            variants={itemVariants}
          >
            MN-Library is provided <em>"as is"</em> without any warranties. While we strive for excellence, we cannot guarantee uninterrupted access or perfectly error-free operation. We shall not be liable for any indirect or incidental damages arising from your usage of the platform.
          </TermSection>

        </motion.div>
      </div>
    </div>
  );
}

// ─── Reusable UI Components ──────────────────────────────────────────

function TermSection({ icon, title, children, variants }) {
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
        e.currentTarget.style.borderColor = 'var(--pro-primary, rgba(168,85,247,0.5))';
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
          background: 'rgba(168,85,247,0.1)', color: 'var(--pro-accent, #a855f7)',
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

function CheckItem({ text }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
      <CheckCircle2 size={16} color="var(--pro-accent, #a855f7)" style={{ marginTop: '4px', flexShrink: 0 }} />
      <span style={{ fontSize: '14px', color: 'var(--text-1)' }}>{text}</span>
    </div>
  );
}
