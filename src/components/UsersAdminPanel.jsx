import React, { useState, useEffect } from "react";
import { Users, Search, Loader2, ChevronRight, Mail, Phone, Calendar, Shield, Activity, Award, Edit, Lock } from "lucide-react";
import { supabase } from "../supabase/config";
import toast from "react-hot-toast";
import AdminUserEditModal from "./AdminUserEditModal";

export default function UsersAdminPanel({ onSelectUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.phone_number?.includes(search)
  );


  const handleEditAccessClick = (e, user) => {
    e.stopPropagation();
    setUserToEdit(user);
    setIsEditModalOpen(true);
  };

  return (
    <div className="admin-users-panel">
      <div className="panel-header-glass">
        <div className="header-title-wrapper">
          <div className="header-icon-box">
            <Users size={28} className="header-icon" />
          </div>
          <div className="header-text-content">
            <h2>User Management</h2>
            <p>Manage and monitor registered members</p>
          </div>
        </div>

        <div className="header-stats-row">
          <div className="stat-pill">
            <Activity size={16} />
            <span>{users.length} Total Users</span>
          </div>
        </div>
      </div>

      <div className="admin-users-controls" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-bar-premium" style={{ marginBottom: 0, flex: 1 }}>
          <div className="search-input-glass">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', padding: '10px 0' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton-card" style={{ height: '140px', padding: '24px', flexDirection: 'row', alignItems: 'center' }}>
               <div className="skeleton-wrapper skeleton-circle" style={{ width: 56, height: 56 }}></div>
               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div className="skeleton-wrapper skeleton-text title" style={{ width: '80%' }}></div>
                 <div className="skeleton-wrapper skeleton-text short" style={{ width: '50%' }}></div>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="users-list-container">
          {filteredUsers.length > 0 ? (
            <div className="premium-user-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px', padding: '10px 0' }}>
              {filteredUsers.map((user, index) => (
                <div 
                  key={user.id} 
                  className="premium-user-card-wrapper"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="premium-user-card">
                    <div className="puc-header">
                      <div className="puc-avatar">
                        {(user.profile_picture_url || user.avatar_url) ? (
                          <img src={user.profile_picture_url || user.avatar_url} alt="Profile" />
                        ) : (
                          user.display_name ? user.display_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>
                    
                    <div className="puc-body">
                      <h3>{user.display_name || "Unknown User"}</h3>
                      <p className="puc-subtitle">{user.email}</p>
                    </div>

                    <div className="puc-footer">
                      <div className="puc-footer-col">
                        <span className="puc-label">Role</span>
                        <div className="puc-pills">
                          <span className={`puc-pill ${user.role === 'admin' ? 'admin' : ''}`}>
                            {user.role || 'user'}
                          </span>
                        </div>
                      </div>
                      <div className="puc-footer-col right-align">
                        <span className="puc-label">Registered</span>
                        <div className="puc-date">
                           {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    className="puc-action-btn"
                    onClick={(e) => { e.stopPropagation(); onSelectUser(user); }}
                    title="View User Details"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-premium">
              <div className="empty-icon-ring">
                <Users size={48} />
              </div>
              <h3>No users found</h3>
              <p>Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      )}

      <AdminUserEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        targetUser={userToEdit}
        onUpdateSuccess={fetchUsers}
      />
    </div>
  );
}
