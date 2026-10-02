import { supabase } from "./config";
import { REALTIME } from "../config/security";

const TABLE_BOOKS = "books";
const TABLE_BULK_LOGS = "bulkLogs";
const MAX_RETRIES = 3;

// Helper to handle retries for initial fetch
const fetchWithRetry = async (queryFn, retries = MAX_RETRIES) => {
  let attempt = 0;
  while (attempt < retries) {
    const { data, error } = await queryFn();
    if (!error) return data;

    // Do not retry on auth/permission errors (e.g., during logout)
    if (error.code === '42501' || error.message?.toLowerCase().includes('permission denied') || error.message?.includes('JWT')) {
      throw error;
    }

    console.error(`Supabase fetch error (attempt ${attempt + 1}):`, error);
    attempt++;
    if (attempt < retries) await new Promise(res => setTimeout(res, 2000 * attempt));
    else throw error;
  }
};

export const subscribeToBooks = (callback, userId, showDeleted = false, errorCallback = null, role = 'user') => {
  if (!userId) return () => { };

  let isSubscribed = true;
  let currentData = null;

  // 1. Fetch initial data
  const fetchInitial = async () => {
    try {
      let data = null;
      // Selective columns — only fetch what the UI needs (reduces payload)
      let query = supabase.from(TABLE_BOOKS)
        .select('*')
        .eq('userId', userId);

      if (showDeleted) {
        query = query.not('deletedAt', 'is', null);
      } else {
        query = query.is('deletedAt', null);
      }

      if (role === 'admin') {
        try {
          data = await fetchWithRetry(() =>
            supabase.rpc('admin_get_user_books', { p_target_user_id: userId, p_show_deleted: showDeleted })
          );
        } catch (rpcErr) {
          console.warn("[subscribeToBooks] RPC failed, falling back to standard query", rpcErr);
          if (rpcErr.message && (rpcErr.message.includes('admin_get_user_books') || rpcErr.message.includes('does not exist') || rpcErr.message.includes('permission denied') || rpcErr.message.includes('Could not find the function'))) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              if (errorCallback) errorCallback(new Error("RPC_MISSING_BOOKS"));
            }
          }
          data = await fetchWithRetry(() => query);
        }
      } else {
        data = await fetchWithRetry(() => query);
      }

      if (isSubscribed && data) {
        currentData = data;
        callback([...currentData]);
      }
    } catch (error) {
      if (errorCallback && !error.message?.toLowerCase().includes('permission denied') && error.message !== "RPC_MISSING_BOOKS") {
        errorCallback(error);
      }
    }
  };

  fetchInitial();

  // 2. Subscribe to real-time changes with reconnection handling
  let reconnectAttempts = 0;
  let channelRef = { current: null };

  const createChannel = () => {
    const ch = supabase.channel(`public:${TABLE_BOOKS}:${showDeleted ? 'bin' : 'active'}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_BOOKS,
          filter: `userId=eq.${userId}`
        },
        (payload) => {
          if (!isSubscribed || !currentData) return;

          let updated = [...currentData];
          if (payload.eventType === 'INSERT') {
            const isVisible = showDeleted ? payload.new.deletedAt != null : payload.new.deletedAt == null;
            if (isVisible) updated.push(payload.new);
          } else if (payload.eventType === 'UPDATE') {
            const isVisible = showDeleted ? payload.new.deletedAt != null : payload.new.deletedAt == null;
            const existingIndex = updated.findIndex(b => b.id === payload.new.id);
            if (existingIndex >= 0) {
              if (isVisible) updated[existingIndex] = payload.new;
              else updated.splice(existingIndex, 1);
            } else if (isVisible) {
              updated.push(payload.new);
            }
          } else if (payload.eventType === 'DELETE') {
            updated = updated.filter(b => b.id !== payload.old.id);
          }

          currentData = updated;
          callback([...currentData]);
        }
      )
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isSubscribed) {
          if (reconnectAttempts < REALTIME.MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = REALTIME.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1);
            console.warn(`[subscribeToBooks] Channel ${status}, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            setTimeout(() => {
              if (!isSubscribed) return;
              if (channelRef.current) supabase.removeChannel(channelRef.current);
              channelRef.current = createChannel();
            }, delay);
          } else {
            console.error('[subscribeToBooks] Max reconnect attempts reached.');
            if (errorCallback) errorCallback(new Error('Realtime connection lost. Please refresh the page.'));
          }
        } else if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0; // Reset on successful reconnect
        }
      });
    return ch;
  };

  channelRef.current = createChannel();

  return () => {
    isSubscribed = false;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };
};

export const subscribeToBulkLogs = (callback, userId, errorCallback = null, role = 'user') => {
  if (!userId) return null;

  let isSubscribed = true;
  let currentData = null;

  const parseLog = (log) => {
    let parsed = {};
    try {
      if (typeof log.details === 'string') {
        parsed = JSON.parse(log.details);
      } else if (typeof log.details === 'object' && log.details !== null) {
        parsed = log.details;
      }
    } catch (_e) { /* JSON parse failed; use empty object */ }
    return { ...log, ...parsed };
  };

  const fetchInitial = async () => {
    try {

      let data = null;
      let query = supabase.from(TABLE_BULK_LOGS)
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false });


      if (role === 'admin') {
        try {
          // Admins bypass RLS using a security definer RPC
          data = await fetchWithRetry(() =>
            supabase.rpc('admin_get_user_bulk_logs', { p_target_user_id: userId })
          );
        } catch (rpcErr) {
          console.warn("[subscribeToBulkLogs] RPC failed, falling back to standard query", rpcErr);
          if (rpcErr.message && (rpcErr.message.includes('admin_get_user_bulk_logs') || rpcErr.message.includes('does not exist') || rpcErr.message.includes('permission denied') || rpcErr.message.includes('Could not find the function'))) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              if (errorCallback) errorCallback(new Error("RPC_MISSING_BULKLOGS"));
            }
          }
          data = await fetchWithRetry(() => query);
        }
      } else {
        data = await fetchWithRetry(() => query);
      }



      if (isSubscribed && data) {
        currentData = data.map(parseLog);
        callback([...currentData]);
      }
    } catch (error) {
      console.error(`[subscribeToBulkLogs] Error fetching:`, error);
      if (errorCallback && !error.message?.toLowerCase().includes('permission denied')) {
        errorCallback(error);
      }
    }
  };

  fetchInitial();

  // Reconnection logic — same pattern as subscribeToBooks
  let reconnectAttempts = 0;
  let channelRef = { current: null };

  const createChannel = () => {
    const ch = supabase.channel(`public:${TABLE_BULK_LOGS}:${userId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLE_BULK_LOGS,
          filter: `userId=eq.${userId}`
        },
        (payload) => {
          if (!isSubscribed || !currentData) return;

          let updated = [...currentData];
          if (payload.eventType === 'INSERT') {
            updated.unshift(parseLog(payload.new));
          } else if (payload.eventType === 'UPDATE') {
            const existingIndex = updated.findIndex(b => b.id === payload.new.id);
            if (existingIndex >= 0) {
              updated[existingIndex] = parseLog(payload.new);
            } else {
              updated.unshift(parseLog(payload.new));
            }
          } else if (payload.eventType === 'DELETE') {
            updated = updated.filter(b => b.id !== payload.old.id);
          }

          updated.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          currentData = updated;
          callback([...currentData]);
        }
      )
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isSubscribed) {
          if (reconnectAttempts < REALTIME.MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = REALTIME.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1);
            console.warn(`[subscribeToBulkLogs] ${status}, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
            setTimeout(() => {
              if (!isSubscribed) return;
              if (channelRef.current) supabase.removeChannel(channelRef.current);
              channelRef.current = createChannel();
            }, delay);
          } else {
            console.error('[subscribeToBulkLogs] Max reconnect attempts reached.');
            if (errorCallback) errorCallback(new Error('Realtime connection lost. Please refresh.'));
          }
        } else if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
        }
      });
    return ch;
  };

  channelRef.current = createChannel();

  return () => {
    isSubscribed = false;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
  };
};

export const addBook = async (bookData) => {
  const { data, error } = await supabase.from(TABLE_BOOKS).insert([{
    ...bookData,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }]).select();

  if (error) throw error;
  return data[0];
};

export const updateBook = async (id, bookData) => {
  const { data, error } = await supabase.from(TABLE_BOOKS).update({
    ...bookData,
    updatedAt: new Date().toISOString(),
  }).eq('id', id).select();

  if (error) throw error;
  
  if (!data || data.length === 0) {
    if (bookData.activityLog) {
      const { error: rpcError } = await supabase.rpc('update_shared_book_activity_log', {
          p_book_id: id,
          p_new_log: bookData.activityLog
      });
      if (rpcError) {
          throw new Error("RPC_MISSING_UPDATE_LOG");
      }
      return { id, activityLog: bookData.activityLog, _updatedViaRpc: true };
    }
    return null;
  }
  
  return data[0];
};

export const softDeleteBook = async (id) => {
  const { data, error } = await supabase.from(TABLE_BOOKS).update({
    deletedAt: new Date().toISOString(),
  }).eq('id', id).select();

  if (error) throw error;
  return data[0];
};

export const restoreBook = async (id) => {
  const { data, error } = await supabase.from(TABLE_BOOKS).update({
    deletedAt: null,
  }).eq('id', id).select();

  if (error) throw error;
  return data[0];
};

export const permanentDeleteBook = async (id) => {
  const { error } = await supabase.from(TABLE_BOOKS).delete().eq('id', id);
  if (error) throw error;
  return true;
};

// --- BULK UPDATE LOGS ---

export const addBulkLog = async (logData) => {
  const { data, error } = await supabase.from(TABLE_BULK_LOGS).insert([{
    userId: logData.userId,
    date: new Date().toISOString(),
    type: 'bulk_update',
    details: logData,
    createdAt: new Date().toISOString(),
  }]).select();

  if (error) throw error;
  return data[0];
};

export const deleteBulkLog = async (id) => {
  const { error } = await supabase.from(TABLE_BULK_LOGS).delete().eq('id', id);
  if (error) throw error;
  return true;
};
