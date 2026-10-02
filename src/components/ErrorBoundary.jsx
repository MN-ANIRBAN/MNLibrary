/**
 * ErrorBoundary.jsx – React Error Boundary
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MainApp />
 *   </ErrorBoundary>
 *
 * Dev note: In development, Vite HMR auto-resets this boundary so you
 * don't see the error screen on every hot reload.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null, errorMessage: null };
    this._hmrCleanup = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || null };
  }

  componentDidMount() {
    // ── Development only: auto-reset on Vite HMR updates ──────────────────
    // Vite's HMR preserves React state across hot reloads, which means once
    // hasError=true is set, the error screen persists on every subsequent
    // code change. Listening to 'vite:beforeUpdate' resets it automatically
    // so you see your latest code, not a stale error screen.
    if (import.meta.hot) {
      const reset = () => {
        if (this.state.hasError) {
          console.info('[ErrorBoundary] HMR update detected — resetting error state.');
          this.setState({ hasError: false, errorId: null, errorMessage: null });
        }
      };
      import.meta.hot.on('vite:beforeUpdate', reset);
      // Also reset on full page invalidation
      import.meta.hot.on('vite:beforeFullReload', reset);
      this._hmrCleanup = () => {
        import.meta.hot.off('vite:beforeUpdate', reset);
        import.meta.hot.off('vite:beforeFullReload', reset);
      };
    }
  }

  componentWillUnmount() {
    if (this._hmrCleanup) this._hmrCleanup();
  }

  componentDidCatch(error, info) {
    // Log full error for debugging — never shown to user
    console.error('[ErrorBoundary] Caught render error:', error);
    console.error('[ErrorBoundary] Component stack:', info?.componentStack);

    // In development, also show a helpful hint
    if (import.meta.env.DEV) {
      console.info(
        '%c[ErrorBoundary] Dev tip: Fix the error above and save the file — the error screen will clear automatically.',
        'color: #6366f1; font-weight: bold;'
      );
    }

    // Generate a short ID for the user to reference when reporting
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    this.setState({ errorId });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, errorId: null, errorMessage: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { errorId, errorMessage } = this.state;
    const { fallback } = this.props;
    const isDev = import.meta.env.DEV;

    // Allow a custom fallback component via props
    if (fallback) return fallback;

    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.iconWrap}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#f87171' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>

          <h1 style={styles.title}>Something went wrong</h1>
          <p style={styles.subtitle}>
            {isDev
              ? 'A render error occurred. Check the console for details.'
              : 'An unexpected error occurred. Your data is safe.'}
          </p>

          {/* In development: show the actual error message for faster debugging */}
          {isDev && errorMessage && (
            <pre style={styles.devError}>{errorMessage}</pre>
          )}

          {!isDev && errorId && (
            <p style={styles.errorId}>
              Reference: <code style={styles.code}>{errorId}</code>
            </p>
          )}

          <div style={styles.actions}>
            <button
              onClick={this.handleReset}
              style={{ ...styles.btn, ...styles.btnSecondary }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-main, #0f0f1a)',
    zIndex: 99999,
    padding: '24px',
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  card: {
    background: 'var(--bg-card, #1a1a2e)',
    border: '1px solid var(--border, rgba(255,255,255,0.08))',
    borderRadius: '20px',
    padding: '48px 40px',
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 32px 64px rgba(0,0,0,0.4)',
  },
  iconWrap: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-1, #f1f5f9)',
    margin: '0 0 12px',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: '15px',
    color: 'var(--text-3, #94a3b8)',
    margin: '0 0 24px',
    lineHeight: 1.6,
  },
  devError: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '12px',
    color: '#fca5a5',
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '0 0 24px',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  errorId: {
    fontSize: '12px',
    color: 'var(--text-3, #64748b)',
    margin: '0 0 32px',
  },
  code: {
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 8px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: 'var(--text-2, #cbd5e1)',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  btn: {
    padding: '10px 24px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
  },
  btnSecondary: {
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-2, #cbd5e1)',
    border: '1px solid rgba(255,255,255,0.08)',
  },
};
