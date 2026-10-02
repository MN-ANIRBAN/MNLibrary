import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Calendar, Shield, Award, Activity } from "lucide-react";
import { supabase } from "../supabase/config";
import toast from "react-hot-toast";

export default function AdminUserProfileView({ user, books }) {
  if (!user) return null;

  const [authMetadata, setAuthMetadata] = useState(null);
  const [profileImgError, setProfileImgError] = useState(false);
  const [coverImgError, setCoverImgError] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data, error } = await supabase.rpc('admin_get_user_metadata', { p_target_user_id: user.id });
        if (error) {
          if (error.message.includes('function admin_get_user_metadata does not exist')) {
            toast.error("Database Error: admin_get_user_metadata RPC missing. Check console.", { id: 'rpc-meta', duration: 6000 });
            console.error(`--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD TO FIX THE METADATA RPC ---
CREATE OR REPLACE FUNCTION admin_get_user_metadata(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_meta jsonb;
BEGIN
  SELECT raw_user_meta_data INTO v_meta FROM auth.users WHERE id = p_target_user_id;
  RETURN v_meta;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_user_metadata(uuid) TO authenticated;
-------------------------------------------------------------------------`);
          }
          return;
        }
        if (data) {
          setAuthMetadata(data);
        }
      } catch (err) {
        console.warn("Error fetching auth metadata", err);
      }
    };
    fetchMetadata();
  }, [user.id]);

  const libraryCount = books.filter(b => b.status !== 'wishlist' && !b.isWishlisted).length;
  const wishlistCount = books.filter(b => b.status === 'wishlist' || b.isWishlisted).length;

  const getValidUrl = (...urls) => urls.find(url => url && typeof url === 'string' && url !== 'null' && url !== 'undefined' && url.trim() !== '');

  const profilePic = getValidUrl(user.profile_picture_url, user.avatar_url, authMetadata?.avatar_url, authMetadata?.profile_picture_url, authMetadata?.picture);
  const coverPic = getValidUrl(user.cover_picture_url, authMetadata?.cover_url, authMetadata?.cover_picture_url);

  return (
    <div className="admin-user-profile-view" style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--border)', padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>

        {/* Header Section */}
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '16px' }}>
          {/* Cover Image */}
          <div style={{ height: '160px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', position: 'relative', overflow: 'hidden' }}>
            {(coverPic && !coverImgError) && (
              <img
                src={coverPic}
                alt="Cover"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                onError={() => setCoverImgError(true)}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', padding: '0 32px 32px 32px', marginTop: '-40px', position: 'relative', zIndex: 1 }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '2.5rem', fontWeight: 600, overflow: 'hidden', border: '4px solid var(--bg-elevated)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {(profilePic && !profileImgError) ? (
                <img
                  src={profilePic}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setProfileImgError(true)}
                />
              ) : (
                user.display_name ? user.display_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ paddingBottom: '8px' }}>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-1)' }}>
                {user.display_name || "Unknown User"}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-2)', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                  {user.role === 'admin' ? <Shield size={14} color="#6366f1" /> : <Award size={14} color="#f59e0b" />}
                  <strong style={{ textTransform: 'capitalize' }}>{user.role || "Member"}</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-2)' }}>
                  <Calendar size={14} /> Joined {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)' }}>Contact Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', padding: '10px', borderRadius: '10px' }}>
                <Mail size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 500 }}>{user.email}</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'rgba(236,72,153,0.1)', color: '#ec4899', padding: '10px', borderRadius: '10px' }}>
                <Phone size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.95rem', color: 'var(--text-1)', fontWeight: 500 }}>{user.phone_number || "Not provided"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)' }}>Library Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '12px', borderRadius: '12px' }}>
                <Activity size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 700 }}>{libraryCount}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-2)' }}>Books in Library</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '12px', borderRadius: '12px' }}>
                <Activity size={24} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-1)', fontWeight: 700 }}>{wishlistCount}</p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-2)' }}>Wishlisted Books</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
