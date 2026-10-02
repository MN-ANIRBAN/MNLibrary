import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { supabase } from "./supabase/config";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieBanner from "./components/CookieBanner";
import "./App.css";
import "./FlipCard.css";


// ── Lazy-load heavy pages (loaded only when needed) ──────────────────────────
const MainApp        = lazy(() => import("./pages/MainApp"));
const LandingPage    = lazy(() => import("./pages/LandingPage"));
const Login          = lazy(() => import("./pages/Login"));
const SharedBookView = lazy(() => import("./pages/SharedBookView"));
const PrivacyPolicy  = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

import "./ProLayoutOverrides.css";

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [sharedBookId, setSharedBookId] = useState(null);
  // Legal page routing (privacy / terms)
  const [legalView, setLegalView] = useState(() => {
    const path = window.location.pathname;
    if (path === '/privacy') return 'privacy';
    if (path === '/terms') return 'terms';
    return null;
  });
  const refreshUserRef = React.useRef(null);
  const refreshUser = React.useCallback(() => refreshUserRef.current?.(), []);

  // Navigate to legal page and update browser URL
  const openLegal = (page) => {
    setLegalView(page);
    window.history.pushState({}, '', `/${page}`);
    window.scrollTo(0, 0);
  };
  const closeLegal = () => {
    setLegalView(null);
    window.history.pushState({}, '', '/');
  };


  useEffect(() => {
    // Check for shared book link
    const params = new URLSearchParams(window.location.search);
    const bookId = params.get('sharedBookId');
    if (bookId) {
      setSharedBookId(bookId);
    }

    const inviteGroupId = params.get('inviteGroup');
    if (inviteGroupId) {
      setShowLogin("generic");
      setTimeout(() => {
        toast("Sign in or sign up to accept your group invitation!", { icon: "👋" });
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }, 500);
    }

    const loadUserWithProfile = async (sessionUser) => {
      if (!sessionUser) return null;
      try {
        const { data, error } = await supabase.from('users').select('*').eq('id', sessionUser.id).single();
        if (error) throw error;
        return { ...sessionUser, profile: data };
      } catch (err) {
        console.error("Error fetching user profile:", err);
        return sessionUser; // Fallback to auth user if profile fetch fails
      }
    };

    // Exposed refresh: re-fetch current session user + profile
    refreshUserRef.current = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const fullUser = await loadUserWithProfile(session?.user);
      if (fullUser) setUser(fullUser);
    };

    // Check current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const fullUser = await loadUserWithProfile(session?.user);
      setUser(fullUser);
      setAuthLoading(false);
      if (fullUser) setShowLogin(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const fullUser = await loadUserWithProfile(session?.user);
      setUser(fullUser);
      setAuthLoading(false);
      if (fullUser) setShowLogin(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleClearSharedBook = () => {
    setSharedBookId(null);
    // Remove the query param from URL without reloading
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  if (authLoading) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">
          <div className="splash-lottie-container">
            <DotLottieReact
              src="/assets/splash.lottie"
              style={{ width: 180, height: 180 }}
              loop
              autoplay
            />
          </div>
          <h1>MN<span>-</span>Library</h1>
          <span className="splash-icon">Initializing Workspace</span>
          <div className="splash-loader-line"></div>
        </div>
      </div>
    );
  }

  // Determine which view to show:
  // -1. Legal pages (/privacy, /terms) — shown before auth check
  //  0. If sharedBookId exists → SharedBookView
  //  1. If user is authenticated → MainApp (full admin)
  //  2. If showLogin is true → Login page
  //  3. Otherwise → LandingPage (public viewer)
  const currentView = sharedBookId ? "shared" : user ? "mainapp" : showLogin ? "login" : "landing";

  // ── Legal pages take priority (path-based routing) ─────────────────────
  if (legalView === 'privacy') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="splash-screen"><div className="splash-logo"><h1>MN<span>-</span>Library</h1></div></div>}>
          <PrivacyPolicy onBack={closeLegal} />
        </Suspense>
      </ErrorBoundary>
    );
  }
  if (legalView === 'terms') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<div className="splash-screen"><div className="splash-logo"><h1>MN<span>-</span>Library</h1></div></div>}>
          <TermsOfService onBack={closeLegal} />
        </Suspense>
      </ErrorBoundary>
    );
  }


  return (
    <ErrorBoundary>
      <Toaster
        position="top-right"
        containerStyle={{ zIndex: 9999999 }}
        toastOptions={{
          style: {
            background: "#1a1a2e",
            color: "#e2e8f0",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            borderRadius: "12px",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            zIndex: 9999999,
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
        }}
      />
      <Suspense fallback={
        <div className="splash-screen">
          <div className="splash-logo">
            <div className="splash-lottie-container">
              <DotLottieReact src="/assets/splash.lottie" style={{ width: 180, height: 180 }} loop autoplay />
            </div>
            <h1>MN<span>-</span>Library</h1>
            <span className="splash-icon">Loading…</span>
            <div className="splash-loader-line"></div>
          </div>
        </div>
      }>
        <AnimatePresence mode="wait">
          {currentView === "shared" ? (
            <motion.div key="shared" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} style={{ height: "100%" }}>
              <SharedBookView bookId={sharedBookId} onBack={handleClearSharedBook} />
            </motion.div>
          ) : currentView === "mainapp" ? (
            <motion.div key="mainapp" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ duration: 0.4, ease: "easeInOut" }} style={{ height: "100%" }}>
              <ErrorBoundary>
                <MainApp user={user} onProfileRefresh={refreshUser} />
              </ErrorBoundary>
            </motion.div>
          ) : currentView === "login" ? (
            <motion.div key="login" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: "easeInOut" }} style={{ height: "100%" }}>
              <Login loginType={showLogin} onBack={() => setShowLogin(false)} />
            </motion.div>
          ) : (
            <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4, ease: "easeInOut" }} style={{ height: "100%" }}>
              <LandingPage
                onLoginClick={() => setShowLogin("generic")}
                onOpenPrivacy={() => openLegal('privacy')}
                onOpenTerms={() => openLegal('terms')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>

      {/* GDPR Cookie Consent Banner — shown on first visit */}
      <CookieBanner onOpenPrivacy={() => openLegal('privacy')} />

    </ErrorBoundary>
  );
}

export default App;
