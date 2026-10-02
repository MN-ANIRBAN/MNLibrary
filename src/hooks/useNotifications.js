import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/config';
import { REALTIME } from '../config/security';

export function useNotifications(user) {
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
    } else {
      setNotifications(data || []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // ── Realtime channel with exponential-backoff reconnection ──────────────
    const channelName = `public:system_notifications:user_${user.id}`;
    let reconnectAttempts = 0;
    let isSubscribed = true;
    let channelRef = { current: null };

    const createChannel = () => {
      const ch = supabase
        .channel(`${channelName}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'system_notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // Re-fetch the full list on any change for accuracy
            if (isSubscribed) fetchNotifications();
          }
        )
        .subscribe((status) => {
          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && isSubscribed) {
            if (reconnectAttempts < REALTIME.MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              const delay = REALTIME.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1);
              console.warn(`[useNotifications] ${status}, reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
              setTimeout(() => {
                if (!isSubscribed) return;
                if (channelRef.current) supabase.removeChannel(channelRef.current);
                channelRef.current = createChannel();
              }, delay);
            } else {
              console.error('[useNotifications] Max reconnect attempts reached.');
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
  }, [user, fetchNotifications]);

  const markAsRead = async (id) => {
    if (!user) return;

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));

    const { error } = await supabase
      .from('system_notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) {
      console.error('Error marking notification as read:', error);
      fetchNotifications(); // revert on error
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from('system_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      fetchNotifications();
    }
  };

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    markAsRead,
    markAllAsRead,
  };
}
