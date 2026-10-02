import { supabase } from "./config";
import { REALTIME } from "../config/security";
import imageCompression from 'browser-image-compression';

const TABLE_GROUPS = "groups";
const TABLE_GROUP_MEMBERS = "group_members";
const TABLE_GROUP_MESSAGES = "group_messages";

export const uploadToImgBB = async (imageFile) => {
  let fileToUpload = imageFile;
  if (imageFile && imageFile.type && imageFile.type.startsWith('image/')) {
    try {
      fileToUpload = await imageCompression(imageFile, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });
    } catch (e) {
      console.error("Compression failed in group upload:", e);
    }
  }

  const formData = new FormData();
  formData.append("image", fileToUpload);
  
  const response = await fetch(`/api/imgbb`, {
    method: "POST",
    body: formData,
  });
  
  const data = await response.json();
  if (data.success) {
    return data.data.url;
  } else {
    throw new Error(data.error?.message || "Failed to upload image to ImgBB");
  }
};

// Helper to handle retries for initial fetch
const fetchWithRetry = async (queryFn, retries = 3) => {
  let attempt = 0;
  while (attempt < retries) {
    const { data, error } = await queryFn();
    if (!error) return data;

    if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied') || error.message?.includes('JWT')) {
      throw error;
    }

    console.error(`Supabase fetch error (attempt ${attempt + 1}):`, error);
    attempt++;
    if (attempt < retries) await new Promise(res => setTimeout(res, 2000 * attempt));
    else throw error;
  }
};

// ─── Shared reconnect-aware channel factory ──────────────────────────────────
const makeReconnectChannel = (channelName, table, filter, onEvent, errorCallback, maxAttempts = 5, baseMs = 2000) => {
  let reconnectAttempts = 0;
  let isActive = true;
  let channelRef = { current: null };

  const create = () => {
    // Use a unique channel name per creation to avoid Supabase's
    // "cannot add callbacks after subscribe()" error on rapid re-renders (HMR / Strict Mode)
    // Date.now() is not enough as HMR triggers multiple calls in the exact same millisecond.
    const uniqueName = `${channelName}:${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    let ch = supabase.channel(uniqueName);

    // Only add filter when it's a non-empty string
    const pgConfig = { event: '*', schema: 'public', table };
    if (filter && typeof filter === 'string') pgConfig.filter = filter;

    ch = ch.on('postgres_changes', pgConfig, () => {
        if (isActive) onEvent();
      })
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isActive) {
          if (reconnectAttempts < maxAttempts) {
            reconnectAttempts++;
            const delay = baseMs * Math.pow(2, reconnectAttempts - 1);
            console.warn(`[${channelName}] ${status}, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            setTimeout(() => {
              if (!isActive) return;
              if (channelRef.current) supabase.removeChannel(channelRef.current);
              channelRef.current = create();
            }, delay);
          } else {
            console.error(`[${channelName}] Max reconnect attempts reached.`);
            if (errorCallback) errorCallback(new Error('Realtime connection lost. Please refresh.'));
          }
        } else if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
        }
      });
    return ch;
  };

  channelRef.current = create();
  return () => {
    isActive = false;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };
};

// ─── Groups Subscription ────────────────────────────────────────────────────

export const subscribeToGroups = (callback, userId, errorCallback = null) => {
  if (!userId) return () => { };

  let isSubscribed = true;

  // Full enriched fetch (groups → members → user details)
  const fetchAll = async () => {
    try {
      const { data: memberGroups, error: memberError } = await supabase
        .from(TABLE_GROUP_MEMBERS)
        .select(`
          group_id,
          role,
          status,
          groups (
            id,
            name,
            description,
            profile_picture,
            created_by,
            created_at,
            group_members (
              id, user_id, invited_email, role, status, is_external, joined_at
            )
          )
        `)
        .eq('user_id', userId);

      if (memberError) throw memberError;

      const groups = memberGroups.map(mg => mg.groups).filter(Boolean);

      // Attach user details to members
      const userIds = new Set();
      groups.forEach(g => g.group_members?.forEach(m => { if (m.user_id) userIds.add(m.user_id); }));

      if (userIds.size > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', Array.from(userIds));

        if (usersData) {
          const userMap = {};
          usersData.forEach(u => userMap[u.id] = u);
          groups.forEach(g => {
            g.group_members?.forEach(m => {
              if (m.user_id && userMap[m.user_id]) m.users = userMap[m.user_id];
            });
          });
        }
      }

      if (isSubscribed) callback(groups);
    } catch (error) {
      console.error('subscribeToGroups fetch error:', error);
      if (errorCallback) errorCallback(error);
    }
  };

  fetchAll();

  // Listen for changes on group_members (membership changes) and groups (name/profile changes)
  // Any change → re-fetch full enriched data for instant UI update
  const unsubMembers = makeReconnectChannel(
    `groups:members:${userId}`,
    TABLE_GROUP_MEMBERS,
    `user_id=eq.${userId}`,
    fetchAll,
    errorCallback
  );

  // Also watch for group-level changes (e.g. another member joining the same group)
  // We subscribe to groups table without a filter — Supabase will fire for any group row change.
  // We filter in the callback by whether we're a member.
  const unsubGroups = makeReconnectChannel(
    `groups:table:${userId}`,
    TABLE_GROUPS,
    undefined,         // no filter — check membership after fetch
    fetchAll,
    errorCallback
  );

  return () => {
    isSubscribed = false;
    unsubMembers();
    unsubGroups();
  };
};

// ─── Invitations Subscription ───────────────────────────────────────────────

export const subscribeToInvitations = (callback, userEmail, errorCallback = null) => {
  if (!userEmail) return () => { };

  let isSubscribed = true;

  // Full enriched fetch of pending invitations for this email
  const fetchAll = async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE_GROUP_MEMBERS)
        .select(`
          id,
          group_id,
          invited_email,
          status,
          groups (
            name,
            created_by
          )
        `)
        .eq('invited_email', userEmail)
        .eq('status', 'pending');

      if (error) throw error;

      // Enrich each invite with the inviter's display name
      const enriched = await Promise.all((data || []).map(async (inv) => {
        let inviterName = null;
        if (inv.groups?.created_by) {
          const { data: nameData } = await supabase.rpc('get_user_name_by_id', { p_user_id: inv.groups.created_by });
          inviterName = nameData || null;
          if (!inviterName) {
            const { data: authUser } = await supabase
              .from('users')
              .select('email, full_name')
              .eq('id', inv.groups.created_by)
              .single();
            inviterName = authUser?.full_name || authUser?.email || null;
          }
        }
        return { ...inv, inviterName };
      }));

      if (isSubscribed) callback(enriched);
    } catch (error) {
      console.error('subscribeToInvitations fetch error:', error);
      if (errorCallback) errorCallback(error);
    }
  };

  fetchAll();

  // Watch group_members filtered by invited_email for instant invite notifications
  const unsubInvites = makeReconnectChannel(
    `invitations:${userEmail}`,
    TABLE_GROUP_MEMBERS,
    `invited_email=eq.${userEmail}`,
    fetchAll,
    errorCallback
  );

  return () => {
    isSubscribed = false;
    unsubInvites();
  };
};

// ─── Group CRUD ─────────────────────────────────────────────────────────────

export const createGroup = async (name, creatorId, creatorEmail) => {
  const { data, error } = await supabase
    .from(TABLE_GROUPS)
    .insert([{ name, created_by: creatorId }])
    .select();

  if (error) throw error;

  // Owner is automatically an accepted member
  const { error: memberError } = await supabase
    .from(TABLE_GROUP_MEMBERS)
    .insert([{
      group_id: data[0].id,
      user_id: creatorId,
      invited_email: creatorEmail || '',
      role: 'owner',
      status: 'accepted',
      joined_at: new Date().toISOString()
    }]);

  if (memberError) throw memberError;

  return data[0];
};

export const deleteGroup = async (groupId) => {
  const { error } = await supabase
    .from(TABLE_GROUPS)
    .delete()
    .eq('id', groupId);

  if (error) throw error;
  return true;
};

export const inviteUserToGroup = async (groupId, email) => {
  const { data, error } = await supabase
    .from(TABLE_GROUP_MEMBERS)
    .insert([{
      group_id: groupId,
      invited_email: email,
      role: 'member',
      status: 'pending',
      is_external: true
    }])
    .select();

  if (error) throw error;
  return data[0];
};

export const updateInvitationStatus = async (inviteId, status, userId) => {
  const { data, error } = await supabase
    .from(TABLE_GROUP_MEMBERS)
    .update({
      status,
      user_id: userId,
      is_external: false,
      joined_at: status === 'accepted' ? new Date().toISOString() : null
    })
    .eq('id', inviteId)
    .select();

  if (error) throw error;
  return data[0];
};

export const updateGroupProfile = async (groupId, name, description, profilePicture) => {
  const updates = { description, profile_picture: profilePicture };
  if (name) updates.name = name;

  const { data, error } = await supabase
    .from(TABLE_GROUPS)
    .update(updates)
    .eq('id', groupId)
    .select();

  if (error) throw error;
  return data[0];
};

export const updateMemberRole = async (groupId, targetUserId, role) => {
  const { data, error } = await supabase
    .from(TABLE_GROUP_MEMBERS)
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', targetUserId)
    .select();

  if (error) throw error;
  return data[0];
};

export const removeMember = async (groupId, targetUserId) => {
  const { error } = await supabase
    .from(TABLE_GROUP_MEMBERS)
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', targetUserId);

  if (error) throw error;
  return true;
};

// ─── Books ──────────────────────────────────────────────────────────────────

export const getPartnerBooks = async (groupId) => {
  try {
    const { data, error } = await supabase.rpc('get_group_partner_books', { p_group_id: groupId });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching partner books", error);
    return [];
  }
};

export const getMySharedBooks = async (groupId) => {
  try {
    const { data, error } = await supabase.rpc('get_group_my_shared_books', { p_group_id: groupId });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching my shared books", error);
    return [];
  }
};

export const checkGroupDuplicateIsbn = async (isbn) => {
  try {
    const { data, error } = await supabase.rpc('check_group_duplicate_isbn', { p_isbn: isbn });
    if (error) throw error;
    return !!data;
  } catch (error) {
    console.error("Error checking group duplicate ISBN", error);
    return false;
  }
};

export const fetchAllSharedBooks = async () => {
  try {
    const { data, error } = await supabase.rpc('get_all_shared_books_for_user');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching all shared books", error);
    return [];
  }
};

export const markBookHandover = async (bookId, groupId, action) => {
  const { data, error } = await supabase.rpc('mark_book_handover', {
    p_book_id: bookId,
    p_action: action,
    p_group_id: groupId || null
  });
  if (error) throw error;
  return data;
};
// ─── Chat ───────────────────────────────────────────────────────────────────

export const fetchGroupMessages = async (groupId) => {
  const { data, error } = await supabase
    .from(TABLE_GROUP_MESSAGES)
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  return data || [];
};

export const sendGroupMessage = async (groupId, userId, senderEmail, senderName, content) => {
  const { data, error } = await supabase
    .from(TABLE_GROUP_MESSAGES)
    .insert([{
      group_id: groupId,
      user_id: userId,
      sender_email: senderEmail,
      sender_name: senderName || senderEmail.split('@')[0],
      content: content.trim()
    }])
    .select();

  if (error) throw error;
  return data[0];
};

export const subscribeToGroupMessages = (groupId, callback) => {
  // Initial fetch of existing messages
  fetchGroupMessages(groupId).then(callback).catch(console.error);

  // Subscribe to new real-time messages with reconnection
  let isActive = true;
  let reconnectAttempts = 0;
  let channelRef = { current: null };

  const createChannel = () => {
    // Generate a truly unique name to prevent HMR / Strict Mode cache collisions
    const uniqueName = `group-chat-${groupId}:${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const ch = supabase
      .channel(uniqueName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE_GROUP_MESSAGES,
          filter: `group_id=eq.${groupId}`
        },
        (payload) => {
          if (isActive && payload.new) {
            callback(prev => [...(Array.isArray(prev) ? prev : []), payload.new]);
          }
        }
      )
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isActive) {
          if (reconnectAttempts < REALTIME.MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = REALTIME.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1);
            console.warn(`[GroupChat:${groupId}] ${status}, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            setTimeout(() => {
              if (!isActive) return;
              if (channelRef.current) supabase.removeChannel(channelRef.current);
              channelRef.current = createChannel();
            }, delay);
          } else {
            console.error(`[GroupChat:${groupId}] Max reconnect attempts reached.`);
          }
        } else if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
        }
      });
    return ch;
  };

  channelRef.current = createChannel();

  return () => {
    isActive = false;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };
};
