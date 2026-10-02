import React, { useState, useEffect, useMemo } from "react";
import { X, User, Lock, Save, Loader2, Camera, LogOut, ArrowLeft, ArrowRight, Home, Heart, Tag, ChevronLeft, ChevronRight, Trash2, ExternalLink } from "lucide-react";
import { addOrModifyProfilePicture } from "../supabase/userService";
import { supabase } from "../supabase/config";
import imageCompression from "browser-image-compression";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getUserFacingError } from "../utils/errorHandler";
import "./UserProfileModal.css";

export default function UserProfileModal({ isOpen, onClose, user, books, onProfileUpdate }) {
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [bio, setBio] = useState("");

  // 1 = Profile, 2 = Security
  const [activeTab, setActiveTab] = useState(1);

  useEffect(() => {
    if (user && isOpen) {
      setDisplayName(user.profile?.display_name || user.user_metadata?.full_name || "");
      setPhoneNumber(user.phone || user.user_metadata?.phone_number || "");
      setPassword("");
      setProfilePictureUrl(user.profile?.profile_picture_url || user.user_metadata?.avatar_url || "");
      setInstagram(user.user_metadata?.social_instagram || "");
      setWhatsapp(user.user_metadata?.social_whatsapp || "");
      setTwitter(user.user_metadata?.social_twitter || "");
      setFacebook(user.user_metadata?.social_facebook || "");
      setBio(user.user_metadata?.bio || "");
      setActiveTab(1);
    }
  }, [user, isOpen]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    let success = true;

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
          phone_number: phoneNumber,
          social_instagram: instagram,
          social_whatsapp: whatsapp,
          social_twitter: twitter,
          social_facebook: facebook,
          bio: bio
        }
      });
      if (authError) throw authError;

      try {
        const { error: dbError } = await supabase
          .from("users")
          .update({ display_name: displayName, phone_number: phoneNumber })
          .eq("id", user.id);
        if (dbError) console.warn("DB Update warn:", dbError);
      } catch (err) {
        console.warn("DB Update error:", err);
      }

      if (password.trim() !== "") {
        const { error: passError } = await supabase.auth.updateUser({ password });
        if (passError) {
          toast.error(getUserFacingError(passError, 'updatePassword'));
          success = false;
        } else {
          toast.success("Password updated successfully!");
        }
      }

      if (success) {
        toast.success("Profile updated successfully!");
        if (onProfileUpdate) onProfileUpdate();
      }
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error(getUserFacingError(error, 'updateProfile'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    let file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error("Only JPEG, PNG and WEBP files are allowed");
    setIsUploading(true);
    try {
      const options = { maxSizeMB: 0.15, maxWidthOrHeight: 800, useWebWorker: true, initialQuality: 0.8 };

      const compressedBlob = await imageCompression(file, options);
      const finalFile = new File([compressedBlob], file.name || 'profile.jpg', {
        type: compressedBlob.type || file.type || 'image/jpeg'
      });

      const url = await addOrModifyProfilePicture(user.id, finalFile);
      setProfilePictureUrl(url);
      if (user.profile) user.profile.profile_picture_url = url;
      toast.success("Profile picture updated!");
      if (onProfileUpdate) onProfileUpdate();
    } catch (error) {
      console.error("Upload Error:", error);
      toast.error(error.message || "Failed to upload profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    setIsUploading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (authError) throw authError;

      const { error: dbError } = await supabase.from('users').update({ profile_picture_url: null }).eq('id', user.id);
      if (dbError) console.warn("DB Update warn:", dbError);

      setProfilePictureUrl("");
      if (user.profile) user.profile.profile_picture_url = "";
      toast.success("Profile picture removed!");
      if (onProfileUpdate) onProfileUpdate();
    } catch (error) {
      console.error("Remove Image Error:", error);
      toast.error("Failed to remove profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const ME = (user?.profile?.full_name || user?.user_metadata?.display_name || user?.display_name || user?.email?.split('@')[0] || "ME").toUpperCase();

  const stats = useMemo(() => {
    if (!books) return { owned: 0, read: 0, reading: 0, pages: 0 };

    let owned = 0;
    let read = 0;
    let reading = 0;
    let pages = 0;

    books.forEach(b => {
      const isOwned = (b.owner || "").toUpperCase().trim() === ME;
      if (isOwned) owned++;

      if (b.status === 'read') read++;
      if (b.status === 'reading') reading++;

      if (b.status === 'read') {
        pages += (parseInt(b.pages) || 0);
      }
    });

    return { owned, read, reading, pages };
  }, [books, ME]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="photo-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="photo-modal-wrapper"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >

              <div className="photo-sidebar-modern">
                <div className={`modern-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>
                  home
                </div>
                <div className={`modern-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>
                  security
                </div>
                <div className={`modern-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>
                  contact
                </div>
                <div className={`modern-tab ${activeTab === 4 ? 'active' : ''}`} onClick={() => setActiveTab(4)}>
                  social
                </div>
                <div className={`modern-tab ${activeTab === 5 ? 'active' : ''}`} onClick={() => setActiveTab(5)}>
                  activity
                </div>
                <div className="modern-tab-divider"></div>
                <div className="modern-tab logout-tab" onClick={handleLogout}>
                  logout
                </div>
              </div>

              <div className="photo-header">
                {/* Reversed Nav Bar */}
                <div className="photo-header-left">
                  <User strokeWidth={1.5} size={14} />
                </div>
                <div className="photo-header-center">
                  <Heart strokeWidth={2} size={10} /> mnlibrary.{user?.email?.split('@')[0] || "user"} <Lock strokeWidth={2} size={10} />
                </div>
                <div className="photo-header-right">
                  <X strokeWidth={1.5} size={18} onClick={onClose} style={{ cursor: 'pointer', marginLeft: '6px' }} />
                </div>
              </div>

              <div className="photo-img-wrapper">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt="Profile" />
                ) : (
                  <div className="photo-fallback-avatar">
                    <User size={64} strokeWidth={1.5} color="var(--text-3, #64748b)" />
                  </div>
                )}
                <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '8px' }}>
                  {profilePictureUrl && (
                    <button className="photo-remove-btn" onClick={handleRemoveImage} title="Remove Profile Picture" disabled={isUploading}>
                      {isUploading ? <Loader2 size={16} className="spinning-icon" /> : <Trash2 size={16} />}
                    </button>
                  )}
                  <label className="photo-cam-btn" title="Upload New Picture">
                    {isUploading ? <Loader2 size={16} className="spinning-icon" /> : <Camera size={16} />}
                    <input type="file" accept="image/jpeg, image/png, image/webp" style={{ display: 'none' }} onChange={handleImageUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>



              <div className="photo-typography">
                <div className="photo-cursive-text">
                  {activeTab === 1 ? (user?.profile?.role || 'evangeline') : activeTab === 2 ? 'security' : activeTab === 3 ? 'contact' : activeTab === 4 ? 'social' : 'activity'}
                </div>
                <div className="photo-bold-text">
                  {(displayName || "LOUISIANA").split(' ')[0]}
                </div>
              </div>

              <div className="photo-body">
                {activeTab === 1 && (
                  <>
                    <p>{bio || "Manage your general profile settings and display name."}</p>
                    <div className="photo-role-badge">
                      Role: {user?.profile?.role || "User"}
                    </div>
                    <div className="photo-form">
                      <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display Name" />
                      <input
                        value={bio}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.length <= 60) setBio(val);
                        }}
                        placeholder="Short bio (max 60 chars)"
                        maxLength={60}
                      />
                      <button className="photo-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 size={10} className="spinning-icon" /> : 'UPDATE PROFILE'}
                      </button>
                    </div>
                  </>
                )}
                {activeTab === 2 && (
                  <>
                    <p>Keep your account secure by updating your password regularly.</p>
                    <div className="photo-form">
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New Password" />
                      <button className="photo-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 size={10} className="spinning-icon" /> : 'SAVE PASSWORD'}
                      </button>
                    </div>
                  </>
                )}
                {activeTab === 3 && (
                  <>
                    <p>Your contact details so we can reach you if needed.</p>
                    <div className="photo-form">
                      <input value={user?.email || ''} readOnly placeholder="Email Address" style={{ opacity: 0.7, cursor: 'not-allowed' }} />
                      <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="Phone Number" />
                      <button className="photo-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 size={10} className="spinning-icon" /> : 'UPDATE CONTACT'}
                      </button>
                    </div>
                  </>
                )}
                {activeTab === 4 && (
                  <>
                    <p>Connect your social profiles to your account.</p>
                    <div className="photo-form" style={{ gap: '8px' }}>

                      {/* Instagram */}
                      <div style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}>
                        <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="Instagram Profile Link" style={{ flex: 1 }} />
                        {instagram && (
                          <a href={instagram.startsWith('http') ? instagram : `https://${instagram}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pro-primary, #6366f1)' }}>
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>

                      {/* WhatsApp */}
                      <div style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}>
                        <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="WhatsApp Number (e.g. +919876543210)" style={{ flex: 1 }} />
                        {whatsapp && (
                          <a href={whatsapp.startsWith('http') ? whatsapp : whatsapp.includes('wa.me') ? `https://${whatsapp.replace('https://', '')}` : `https://wa.me/${whatsapp.replace(/[^\d+]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pro-primary, #6366f1)' }}>
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>

                      {/* Twitter / X */}
                      <div style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}>
                        <input value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="Twitter / X Link" style={{ flex: 1 }} />
                        {twitter && (
                          <a href={twitter.startsWith('http') ? twitter : `https://${twitter}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pro-primary, #6366f1)' }}>
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>

                      {/* Facebook */}
                      <div style={{ display: 'flex', width: '100%', gap: '8px', alignItems: 'center' }}>
                        <input value={facebook} onChange={e => setFacebook(e.target.value)} placeholder="Facebook Profile Link" style={{ flex: 1 }} />
                        {facebook && (
                          <a href={facebook.startsWith('http') ? facebook : `https://${facebook}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pro-primary, #6366f1)' }}>
                            <ExternalLink size={18} />
                          </a>
                        )}
                      </div>

                      <button className="photo-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 size={10} className="spinning-icon" /> : 'SAVE SOCIALS'}
                      </button>
                    </div>
                  </>
                )}
                {activeTab === 5 && (
                  <>
                    <p>Your library activity and reading statistics.</p>
                    <div className="photo-form" style={{ gap: '12px', alignItems: 'stretch' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-2, #cbd5e1)', fontSize: '14px', fontWeight: 500 }}>Owned Books</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-1, #fff)', fontSize: '14px' }}>{stats.owned}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-2, #cbd5e1)', fontSize: '14px', fontWeight: 500 }}>Books Read</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-1, #fff)', fontSize: '14px' }}>{stats.read}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-2, #cbd5e1)', fontSize: '14px', fontWeight: 500 }}>Currently Reading</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-1, #fff)', fontSize: '14px' }}>{stats.reading}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-input, rgba(0,0,0,0.2))', border: '1px solid var(--border, rgba(255,255,255,0.1))', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-2, #cbd5e1)', fontSize: '14px', fontWeight: 500 }}>Total Pages Read</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-1, #fff)', fontSize: '14px' }}>{stats.pages}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>



            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
