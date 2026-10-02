import React, { useState, useEffect } from "react";
import { X, User, Phone, Shield, Lock, Save, Loader2 } from "lucide-react";
import { supabase } from "../supabase/config";
import { getUserFacingError } from "../utils/errorHandler";
import toast from "react-hot-toast";

export default function AdminUserEditModal({ isOpen, onClose, targetUser, onUpdateSuccess }) {
  const [role, setRole] = useState("user");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (targetUser && isOpen) {
      setRole(targetUser.role || "user");
      setPassword("");
    }
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    let success = true;

    try {
      let roleChanged = targetUser.role !== role;
      let passChanged = password.trim() !== "";
      
      if (!roleChanged && !passChanged) {
        toast("No changes made.");
        setIsSaving(false);
        onClose();
        return;
      }

      // 1. Log activity
      const newLogs = targetUser.activity_log || [];
      if (roleChanged) {
        newLogs.push({
          action: `An admin updated your account role to: ${role === 'admin' ? 'Admin' : 'Member'}`,
          date: new Date().toISOString()
        });
      }
      if (passChanged) {
        newLogs.push({
          action: `An admin changed your password.`,
          date: new Date().toISOString()
        });
      }

      // 2. Update role and logs if changed
      if (roleChanged || passChanged) {
        const { error: dbError } = await supabase
          .from("users")
          .update({
            role: role,
            activity_log: newLogs
          })
          .eq("id", targetUser.id);
          
        if (dbError) throw dbError;
      }

      // 3. Update password if provided via the SQL function
      if (passChanged) {
        const { error: passError } = await supabase.rpc('admin_update_user_password', {
          target_user_id: targetUser.id,
          new_password: password
        });

        if (passError) {
          console.error("Password reset error:", passError);
          if (passError.code === 'PGRST202') {
             toast.error("Password reset failed. The 'admin_update_user_password' SQL function is missing in your database.", { duration: 6000 });
          } else {
             toast.error(getUserFacingError(passError, 'adminUpdatePassword'));
          }
          success = false;
        } else {
          toast.success("Password updated successfully!");
        }
      }

      if (success) {
        toast.success("User updated successfully!");
        if (onUpdateSuccess) onUpdateSuccess();
        onClose();
      }

    } catch (error) {
      console.error("Admin user update error:", error);
      toast.error(getUserFacingError(error, 'adminUpdateUser'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <div className="profile-avatar-section">
            <div className="profile-avatar" style={{ overflow: 'hidden' }}>
              {(targetUser.profile_picture_url || targetUser.avatar_url) ? (
                <img src={targetUser.profile_picture_url || targetUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                targetUser.display_name ? targetUser.display_name.charAt(0).toUpperCase() : targetUser?.email?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="profile-titles">
              <h2>Edit User Access</h2>
              <span className="profile-email">{targetUser?.email}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="profile-form">
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-3, #94a3b8)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
              <User size={16} /> Display Name (Read-Only)
            </label>
            <div style={{ padding: '12px', background: 'var(--bg-input, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border, rgba(0,0,0,0.1))', color: 'var(--text-2, #64748b)' }}>
              {targetUser.display_name || "N/A"}
            </div>
          </div>
          
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-3, #94a3b8)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
              <Phone size={16} /> Phone Number (Read-Only)
            </label>
            <div style={{ padding: '12px', background: 'var(--bg-input, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border, rgba(0,0,0,0.1))', color: 'var(--text-2, #64748b)' }}>
              {targetUser.phone_number || "N/A"}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-3, #94a3b8)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
              <Shield size={16} /> User Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: '100%', padding: '12px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border, rgba(0,0,0,0.1))', color: 'var(--text-1, #0f172a)' }}
            >
              <option value="user">Member (user)</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-3, #94a3b8)', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
              <Lock size={16} /> Set New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              minLength={6}
            />
          </div>
          
          <div className="profile-modal-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
