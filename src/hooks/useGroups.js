import { useState, useEffect, useCallback, useRef } from "react";
import {
  subscribeToGroups,
  subscribeToInvitations,
  createGroup,
  deleteGroup,
  inviteUserToGroup,
  updateInvitationStatus,
  getPartnerBooks,
  getMySharedBooks,
  checkGroupDuplicateIsbn,
  fetchAllSharedBooks,
  sendGroupMessage,
  subscribeToGroupMessages,
  markBookHandover,
  updateGroupProfile,
  updateMemberRole,
  removeMember,
} from "../supabase/groupService";
import { supabase } from "../supabase/config";
import { getUserFacingError } from "../utils/errorHandler";
import toast from "react-hot-toast";

export const useGroups = (user) => {
  const [groups, setGroups] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to Groups
  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToGroups(
      (data) => {
        setGroups(data);
        setLoading(false);
      },
      user.id,
      (error) => {
        console.error("Group subscription error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Subscribe to Invitations
  useEffect(() => {
    if (!user || !user.email) {
      setInvitations([]);
      return;
    }

    const unsubscribe = subscribeToInvitations(
      (data) => setInvitations(data),
      user.email,
      (error) => console.error("Invitations subscription error:", error)
    );

    return () => unsubscribe();
  }, [user]);

  // ─── Group CRUD ────────────────────────────────────────────────────────────

  const handleCreateGroup = useCallback(async (name) => {
    if (!user) return null;

    if (groups && groups.length >= 1) {
      toast.error("You are already part of a group. You cannot be in multiple groups.");
      throw new Error("User cannot be in multiple groups");
    }

    // Check for duplicate group name
    const isDuplicate = groups.some(g => g.name && g.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      toast.error("You already have a group with this name.");
      throw new Error("Duplicate group name");
    }

    try {
      const newGroup = await createGroup(name, user.id, user.email);
      return newGroup;
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(getUserFacingError(error, 'createGroup'));
      throw error;
    }
  }, [user, groups]);

  const handleDeleteGroup = useCallback(async (groupId) => {
    try {
      await deleteGroup(groupId);
      toast.success("Group deleted successfully");
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Failed to delete group");
      throw error;
    }
  }, []);

  const handleUpdateGroupProfile = useCallback(async (groupId, name, description, profilePicture) => {
    try {
      const updated = await updateGroupProfile(groupId, name, description, profilePicture);
      toast.success("Group profile updated");
      return updated;
    } catch (error) {
      console.error("Error updating group profile:", error);
      toast.error("Failed to update profile");
      throw error;
    }
  }, []);

  const handleUpdateMemberRole = useCallback(async (groupId, targetUserId, role) => {
    try {
      const updated = await updateMemberRole(groupId, targetUserId, role);
      toast.success(`Role updated to ${role}`);
      return updated;
    } catch (error) {
      console.error("Error updating member role:", error);
      toast.error("Failed to update role");
      throw error;
    }
  }, []);

  const handleRemoveMember = useCallback(async (groupId, targetUserId) => {
    try {
      await removeMember(groupId, targetUserId);
      toast.success("Member removed");
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove member");
      throw error;
    }
  }, []);

  const handleInviteUser = useCallback(async (groupId, email) => {
    // Restrict duplicate entries: Check if a group with this member already exists
    const existingGroup = groups.find(g => 
      g.group_members?.some(m => 
        m.invited_email?.toLowerCase() === email.toLowerCase() || 
        m.users?.email?.toLowerCase() === email.toLowerCase()
      )
    );
    
    if (existingGroup) {
      toast.error(`You already have a group with ${email}.`);
      throw new Error("Duplicate member restriction");
    }

    try {
      const invite = await inviteUserToGroup(groupId, email);
      toast.success(`Invitation sent to ${email}`);
      return invite;
    } catch (error) {
      console.error("Error inviting user:", error);
      if (error.message?.includes('duplicate key value')) {
        toast.error("User is already invited to this group.");
      } else if (error.message?.includes('max_10_members')) {
        toast.error("Group member limit reached (Max 10).");
      } else {
        toast.error(getUserFacingError(error, 'inviteUser'));
      }
      throw error;
    }
  }, [groups]);

  const handleAcceptInvite = useCallback(async (inviteId) => {
    if (!user) return;

    if (groups && groups.length >= 1) {
      toast.error("You are already part of a group. You cannot be in multiple groups.");
      throw new Error("User cannot be in multiple groups");
    }

    try {
      await updateInvitationStatus(inviteId, 'accepted', user.id);
      toast.success("Joined group successfully! 🎉");
    } catch (error) {
      console.error("Error accepting invite:", error);
      toast.error("Failed to join group");
    }
  }, [user]);

  const handleDeclineInvite = useCallback(async (inviteId) => {
    try {
      await updateInvitationStatus(inviteId, 'declined', user?.id || null);
      toast.success("Invitation declined");
    } catch (error) {
      console.error("Error declining invite:", error);
      toast.error("Failed to decline invitation");
    }
  }, [user]);

  // ─── Books ─────────────────────────────────────────────────────────────────

  const fetchPartnerBooks = useCallback(async (groupId) => {
    try {
      return await getPartnerBooks(groupId);
    } catch (error) {
      console.error("Failed to fetch partner books:", error);
      return [];
    }
  }, []);

  const fetchMySharedBooks = useCallback(async (groupId) => {
    try {
      return await getMySharedBooks(groupId);
    } catch (error) {
      console.error("Failed to fetch my shared books:", error);
      return [];
    }
  }, []);

  const handleMarkHandover = useCallback(async (bookId, groupId, action) => {
    try {
      await markBookHandover(bookId, groupId, action);
      toast.success(action === 'handover' ? 'Book marked as handed over' : 'Book marked as received');
      return true;
    } catch (error) {
      console.error("Failed to mark handover:", error);
      toast.error("Failed to update book status");
      throw error;
    }
  }, []);

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const handleSendMessage = useCallback(async (groupId, content) => {
    if (!user || !content.trim()) return;
    try {
      await sendGroupMessage(
        groupId,
        user.id,
        user.email,
        user.profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0],
        content
      );

      const currentGroup = groups.find(g => g.id === groupId);
      if (currentGroup && currentGroup.group_members) {
        const partners = currentGroup.group_members.filter(m => m.user_id && m.user_id !== user.id && m.status === 'accepted');
        for (const partner of partners) {
          try {
            await supabase.rpc('upsert_system_notification', {
              p_user_id: partner.user_id,
              p_type: 'group_message',
              p_reference_id: groupId,
              p_title: 'New Group Message',
              p_message: `New message in ${currentGroup.name || 'group'} from ${user.email?.split('@')[0]}`
            });
          } catch (e) {
            console.error('Failed to notify group partner', e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      throw error;
    }
  }, [user, groups]);

  return {
    groups,
    invitations,
    loading,
    handleCreateGroup,
    handleDeleteGroup,
    handleInviteUser,
    handleAcceptInvite,
    handleDeclineInvite,
    fetchPartnerBooks,
    fetchMySharedBooks,
    fetchAllSharedBooks,
    checkGroupDuplicateIsbn,
    handleMarkHandover,
    handleSendMessage,
    subscribeToGroupMessages,
    handleUpdateGroupProfile,
    handleUpdateMemberRole,
    handleRemoveMember,
  };
};
