import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabase/config";
import toast from "react-hot-toast";
import { ArrowLeft, Mail, Lock, ArrowRight, User, Clock, ShieldCheck, Sparkles, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { checkAuthRateLimit, recordAuthAttempt, formatWaitTime } from "../utils/rateLimiter";
import { validateEmail, validatePassword, validateDisplayName } from "../utils/validation";
import { getUserFacingError } from "../utils/errorHandler";
import "./Login.css";

const fadeUpVariants = {
  hidden: { opacity: 0, y: 15, filter: 'blur(8px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: "spring", stiffness: 350, damping: 25 } },
  exit: { opacity: 0, y: -15, filter: 'blur(8px)', transition: { duration: 0.2 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
};

export default function Login({ onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [backoffWaitMs, setBackoffWaitMs] = useState(0);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (backoffWaitMs <= 0) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setBackoffWaitMs((prev) => {
        if (prev <= 1000) { clearInterval(countdownRef.current); return 0; }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [backoffWaitMs]);

  const validateForm = () => {
    const errors = {};
    const emailResult = validateEmail(email);
    if (!emailResult.valid) errors.email = emailResult.error;

    if (!isResetting) {
      const passResult = validatePassword(password);
      if (!passResult.valid) errors.password = passResult.error;
    }

    if (isRegister && !isResetting) {
      const nameResult = validateDisplayName(name);
      if (!nameResult.valid) errors.name = nameResult.error;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRequestAccess = (e) => {
    e.preventDefault();
    const mailTo = "abumbabum@gmail.com";
    const subject = "MN-Library Account Access Request";
    const body = "Hello Admin,\n\nI would like to request access to the MN Book Library.\n\nMy Details:\nName: \nEmail: \nReason for access: \n\nThank you.";
    
    const copyText = `To: ${mailTo}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(copyText);
    
    toast.success("Request details copied! Open your email and send it to us.", { duration: 5000 });
    window.location.href = `mailto:${mailTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const rateLimitKey = email.toLowerCase().trim();
    const rl = checkAuthRateLimit(rateLimitKey);
    if (!rl.allowed) {
      setBackoffWaitMs(rl.waitMs);
      toast.error(`Too many attempts. Please wait ${formatWaitTime(rl.waitMs)}.`);
      return;
    }

    setLoading(true);
    try {
      if (isResetting) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        recordAuthAttempt(rateLimitKey, true);
        toast.success("Password reset link sent! Check your email.");
        setIsResetting(false);
      } else if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() } }
        });
        if (error) throw error;
        recordAuthAttempt(rateLimitKey, true);
        toast.success("Account created! Please check your email to confirm.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          recordAuthAttempt(rateLimitKey, false);
          throw error;
        }
        recordAuthAttempt(rateLimitKey, true);
        toast.success("Welcome back!");
      }
    } catch (err) {
      toast.error(getUserFacingError(err, 'Login'));
    }
    setLoading(false);
  };

  return (
    <div className="login-page-wrapper">
      {/* Dynamic Background */}
      <div className="login-ambient-bg">
        <div className="login-orb orb-1"></div>
        <div className="login-orb orb-2"></div>
        <div className="login-orb orb-3"></div>
      </div>

      {onBack && (
        <button onClick={onBack} className="login-nav-back" type="button" title="Back to Library">
          <ChevronLeft size={18} strokeWidth={2.5} />
          <span>Back</span>
        </button>
      )}

      <div className="login-container">
        <motion.div
          className="login-glass-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Decorative Sidebar */}
          <div className="login-side-banner">
            <div className="login-brand">
              <div className="login-logo-box">
                <ShieldCheck size={28} />
              </div>
              <h1>MN<span>.</span></h1>
            </div>
            
            <div className="login-banner-text">
              <h2>Secure Access</h2>
              <p>Manage your entire book collection intelligently with enterprise-grade security.</p>
            </div>
            
            <div className="login-banner-footer">
              <Sparkles size={16} />
              <span>Version 2.0 Auth</span>
            </div>
          </div>

          {/* Form Area */}
          <div className="login-form-area">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="login-form-inner"
            >
              <motion.div variants={fadeUpVariants} className="login-header-mobile">
                <ShieldCheck size={32} className="login-mobile-icon" />
                <h2>
                  {isResetting ? "Reset Password" : isRegister ? "Create Account" : "Welcome Back"}
                </h2>
                <p>
                  {isResetting
                    ? "Enter your email to receive a password reset link."
                    : isRegister
                      ? "Join the library to access exclusive resources."
                      : "Enter your credentials to securely access your account."}
                </p>
              </motion.div>

              <motion.div variants={fadeUpVariants}>
                {backoffWaitMs > 0 && (
                  <div className="login-rate-alert">
                    <Clock size={16} />
                    <span>Please wait <strong>{Math.ceil(backoffWaitMs / 1000)}s</strong> before retrying.</span>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} noValidate className="login-form">
                  <AnimatePresence mode="popLayout">
                    {isRegister && !isResetting && (
                      <motion.div 
                        key="name-field"
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="login-input-group"
                      >
                        <label>Full Name</label>
                        <div className={`login-input-wrapper ${fieldErrors.name ? 'error' : ''}`}>
                          <User size={18} className="login-icon" />
                          <input
                            type="text"
                            placeholder="John Doe"
                            value={name}
                            onChange={(e) => { setName(e.target.value); setFieldErrors(p => ({ ...p, name: undefined })); }}
                            maxLength={100}
                          />
                        </div>
                        {fieldErrors.name && <span className="login-error-msg">{fieldErrors.name}</span>}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div layout transition={{ duration: 0.3 }} className="login-input-group">
                    <label>Email Address</label>
                    <div className={`login-input-wrapper ${fieldErrors.email ? 'error' : ''}`}>
                      <Mail size={18} className="login-icon" />
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
                        maxLength={254}
                        autoComplete="email"
                      />
                    </div>
                    {fieldErrors.email && <span className="login-error-msg">{fieldErrors.email}</span>}
                  </motion.div>

                  <AnimatePresence mode="popLayout">
                    {!isResetting && (
                      <motion.div 
                        key="password-field"
                        variants={fadeUpVariants}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        className="login-input-group"
                      >
                        <div className="login-label-row">
                          <label>Password</label>
                          {!isRegister && (
                            <button
                              type="button"
                              onClick={() => { setIsResetting(true); setFieldErrors({}); }}
                              className="login-forgot-btn"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className={`login-input-wrapper ${fieldErrors.password ? 'error' : ''}`}>
                          <Lock size={18} className="login-icon" />
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
                            maxLength={128}
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                          />
                          <button 
                            type="button" 
                            className="login-view-pwd-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.div
                                key={showPassword ? "hide" : "show"}
                                initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
                                transition={{ duration: 0.15, ease: "easeInOut" }}
                              >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                              </motion.div>
                            </AnimatePresence>
                          </button>
                        </div>
                        {fieldErrors.password && <span className="login-error-msg">{fieldErrors.password}</span>}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button 
                    layout 
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="login-submit-btn" 
                    disabled={loading || backoffWaitMs > 0}
                  >
                    {loading ? (
                      <span className="login-spinner"></span>
                    ) : (
                      <>
                        <span>{isResetting ? "Send Reset Link" : isRegister ? "Create Account" : "Sign In"}</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </motion.button>

                  <motion.div layout transition={{ duration: 0.3 }} className="login-footer">
                    <p>
                      {isResetting ? "Remembered your password? " : "Invite-only access. "}
                      {isResetting ? (
                        <button type="button" className="login-link-btn" onClick={() => setIsResetting(false)}>
                          Back to Sign in
                        </button>
                      ) : (
                        <button type="button" onClick={handleRequestAccess} className="login-link-btn">
                          Request Access
                        </button>
                      )}
                    </p>
                  </motion.div>
                </form>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
