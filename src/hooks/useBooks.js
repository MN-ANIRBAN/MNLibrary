import { useState, useEffect, useCallback, useRef } from "react";
import {
    subscribeToBooks,
    addBook,
    updateBook,
    softDeleteBook,
    restoreBook,
    permanentDeleteBook,
    subscribeToBulkLogs,
    addBulkLog as supabaseAddBulkLog,
    deleteBulkLog as supabaseDeleteBulkLog
} from "../supabase/bookService";
import { supabase } from "../supabase/config";
import { cacheGet, cacheSet, cacheInvalidate, cacheKeys } from "../utils/cache";
import { getUserFacingError } from "../utils/errorHandler";
import { CACHE } from "../config/security";
import toast from "react-hot-toast";

export const useBooks = (user, targetUserId = null) => {
    const userId = targetUserId || user?.id;
    const role = user?.profile?.role || 'user';
    const [books, setBooks] = useState([]);
    const [binBooks, setBinBooks] = useState([]);
    const [bulkLogs, setBulkLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const unsubscribeRef = useRef({ active: null, bin: null, bulk: null });
    const retryCountRef = useRef(0);

    // Pure realtime listener
    useEffect(() => {
        if (!userId) {
            setBooks([]);
            setBinBooks([]);
            setBulkLogs([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        retryCountRef.current = 0;

        // Load from TTL-aware cache instantly
        try {
            const cached = cacheGet(cacheKeys.books(userId));
            if (Array.isArray(cached) && cached.length > 0) {
                setBooks(cached);
                setLoading(false); // Instantly hide loading if cache exists
            }
        } catch (e) {
            console.error("Cache load error:", e);
        }

        // Cleanup previous
        const cleanup = () => {
            if (unsubscribeRef.current.active) {
                unsubscribeRef.current.active();
                unsubscribeRef.current.active = null;
            }
            if (unsubscribeRef.current.bin) {
                unsubscribeRef.current.bin();
                unsubscribeRef.current.bin = null;
            }
            if (unsubscribeRef.current.bulk) {
                unsubscribeRef.current.bulk();
                unsubscribeRef.current.bulk = null;
            }
        };

        // Active books
        unsubscribeRef.current.active = subscribeToBooks(
            (data) => {
                const activeBooks = data.filter(book => {
                    if (book.deletedAt) return false;
                    if (Array.isArray(book.activityLog)) {
                        return !book.activityLog.some(log => log.type === 'hidden' && (log.userId === userId || log.by === userId));
                    }
                    return true;
                });
                const sortedBooks = activeBooks.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
                setBooks(sortedBooks);
                setLoading(false);

                try {
                    cacheSet(cacheKeys.books(userId), sortedBooks, CACHE.BOOKS_TTL_MS);
                } catch (e) {
                    console.error("Cache save error:", e);
                }

                if (data.length === 0) {

                } else {

                }
            },
            userId,
            false,
            (error) => {
                console.error("Active books fetch error:", error);
                handleSnapshotError("active", error);
            },
            role
        );

        // Bin books (30 days cutoff)
        unsubscribeRef.current.bin = subscribeToBooks(
            (data) => {
                const cutoff = Date.now() / 1000 - 30 * 24 * 3600;
                const filteredBin = data.filter(b => b.deletedAt);
                setBinBooks(filteredBin);
            },
            userId,
            true,
            (error) => handleSnapshotError("bin", error),
            role
        );

        // Bulk logs
        unsubscribeRef.current.bulk = subscribeToBulkLogs(
            (data) => {
                setBulkLogs(data);
            },
            userId,
            (error) => handleSnapshotError("bulk", error),
            role
        );

        return cleanup;
    }, [userId, role]);

    const handleSnapshotError = useCallback((type, error) => {
        if (error.message === "RPC_MISSING_BOOKS") {
            toast.error("Database Error: admin_get_user_books RPC is missing or lacks permissions. Check console for SQL fix.", { duration: 6000 });
            console.error(`--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD TO FIX THE BOOKS RPC ---
CREATE OR REPLACE FUNCTION admin_get_user_books(p_target_user_id uuid, p_show_deleted boolean DEFAULT false)
RETURNS SETOF books
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_show_deleted THEN
    RETURN QUERY SELECT * FROM books WHERE ("userId" = p_target_user_id OR "shared_users"::text LIKE '%' || p_target_user_id::text || '%') AND "deletedAt" IS NOT NULL;
  ELSE
    RETURN QUERY SELECT * FROM books WHERE ("userId" = p_target_user_id OR "shared_users"::text LIKE '%' || p_target_user_id::text || '%') AND "deletedAt" IS NULL;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_user_books(uuid, boolean) TO authenticated;
-------------------------------------------------------------------------`);
            return;
        }
        if (error.message === "RPC_MISSING_BULKLOGS") {
            toast.error("Database Error: admin_get_user_bulk_logs RPC is missing or lacks permissions. Check console for SQL fix.", { duration: 6000 });
            console.error(`--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD TO FIX THE BULK LOGS RPC ---
CREATE OR REPLACE FUNCTION admin_get_user_bulk_logs(p_target_user_id uuid)
RETURNS SETOF "bulkLogs"
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM "bulkLogs" WHERE "userId" = p_target_user_id ORDER BY "createdAt" DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_get_user_bulk_logs(uuid) TO authenticated;
-------------------------------------------------------------------------`);
            return;
        }

        console.error(`Snapshot error (${type}):`, error);
        toast.error(`Realtime sync error. Retrying...`);
        if (retryCountRef.current < 3) {
            retryCountRef.current++;
            setTimeout(() => window.location.reload(), 5000 * retryCountRef.current);
        }
    }, []);

    const autoPurgeBin = useCallback(async () => {
        if (!userId) return;
        try {
            const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 3600;
            const oldBinBooks = binBooks.filter(book => (new Date(book.deletedAt || 0).getTime() / 1000) < thirtyDaysAgo);
            for (const book of oldBinBooks) {
                await permanentDeleteBook(book.id);
            }
            if (oldBinBooks.length > 0) {
                toast.success(`Purged ${oldBinBooks.length} old bin items`);
            }
        } catch (err) {
            console.error("Auto-purge failed:", err);
            toast.error("Bin purge failed");
        }
    }, [binBooks, userId]);

    const normalizeIsbn = (value) => (value || "").toUpperCase().replace(/[^0-9X]/g, "").trim();

    const isDuplicateBook = useCallback(
        (bookData, { includeBin = false } = {}) => {
            const cleanIsbn = normalizeIsbn(bookData?.isbn);
            const cleanTitle = (bookData?.title || "").toLowerCase().trim();
            const cleanAuthor = (bookData?.author || "").toLowerCase().trim();

            if (!cleanIsbn && (!cleanTitle || !cleanAuthor)) return false;

            const activeList = Array.isArray(books) ? books : [];
            const binList = includeBin && Array.isArray(binBooks) ? binBooks : [];
            const list = includeBin ? [...activeList, ...binList] : activeList;

            return list.some((b) => {
                if (b.deletedAt) return false;

                if (cleanIsbn && normalizeIsbn(b.isbn) === cleanIsbn) {
                    return true;
                }

                const bTitle = (b.title || "").toLowerCase().trim();
                const bAuthor = (b.author || "").toLowerCase().trim();
                if (cleanTitle && cleanAuthor && bTitle === cleanTitle && bAuthor === cleanAuthor) {
                    return true;
                }

                return false;
            });
        },
        [books, binBooks]
    );

    const handleAddBook = useCallback(async (bookData) => {
        if (!userId) {
            toast.error("Please log in first");
            return;
        }

        if (isDuplicateBook(bookData)) {
            toast.error("This book already exists in your library.");
            return;
        }

        const dataWithUser = { ...bookData, userId };

        // Optimistic UI update
        const tempId = `temp-${Date.now()}`;
        const tempBook = { ...dataWithUser, id: tempId, createdAt: new Date().toISOString() };
        setBooks(prev => [tempBook, ...prev].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));

        try {
            await addBook(dataWithUser);
        } catch (err) {
            console.error("Add failed:", err);
            toast.error(getUserFacingError(err, 'addBook'));
            // Revert optimistic update
            setBooks(prev => prev.filter(b => b.id !== tempId));
        }
    }, [userId]);

    const handleUpdateBook = useCallback(async (id, bookData) => {
        if (!userId) return false;

        // Do not send userId during update to avoid RLS column restrictions
        const updatePayload = { ...bookData };

        // Optimistic UI update
        let originalBook = null;
        setBooks(prev => {
            const index = prev.findIndex(b => b.id === id);
            if (index >= 0) {
                originalBook = prev[index];
                const updated = [...prev];
                updated[index] = { ...originalBook, ...updatePayload, updatedAt: new Date().toISOString() };
                return updated;
            }
            return prev;
        });

        try {
            const result = await updateBook(id, updatePayload);
            if (!result) throw new Error("No rows updated. Might be a permission issue.");
            // Invalidate cache so next load gets fresh data
            cacheInvalidate(cacheKeys.books(userId));
            return result;
        } catch (err) {
            if (err.message === "RPC_MISSING_UPDATE_LOG") {
                toast.error("Database Error: update_shared_book_activity_log RPC is missing. Check console for SQL fix.", { duration: 6000 });
                console.error(`--- PLEASE RUN THIS SQL IN YOUR SUPABASE DASHBOARD ---
CREATE OR REPLACE FUNCTION update_shared_book_activity_log(p_book_id uuid, p_new_log jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE books
  SET "activityLog" = p_new_log,
      "updatedAt" = NOW()
  WHERE id = p_book_id;
END;
$$;
GRANT EXECUTE ON FUNCTION update_shared_book_activity_log(uuid, jsonb) TO authenticated;
-------------------------------------------------------------------------`);
            } else {
                console.error("Update failed:", err);
                toast.error(getUserFacingError(err, 'updateBook'));
            }
            // Revert optimistic update
            if (originalBook) {
                setBooks(prev => prev.map(b => b.id === id ? originalBook : b));
            }
            throw err;
        }
    }, [userId]);

    const handleDeleteBook = useCallback(async (id) => {
        // Optimistic UI update
        let originalBook = null;
        setBooks(prev => {
            const index = prev.findIndex(b => b.id === id);
            if (index >= 0) {
                originalBook = prev[index];
                return prev.filter(b => b.id !== id);
            }
            return prev;
        });

        if (originalBook) {
            const isSharedInGroup = Array.isArray(originalBook.shared_users) && originalBook.shared_users.length > 0;
            
            if (isSharedInGroup) {
                try {
                    const existingLog = Array.isArray(originalBook.activityLog) 
                        ? originalBook.activityLog 
                        : (originalBook.activityLog && typeof originalBook.activityLog === "object")
                            ? Object.values(originalBook.activityLog)
                            : [];
                            
                    const newLog = [
                        ...existingLog,
                        {
                            id: Date.now(),
                            type: 'hidden',
                            by: userId,
                            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
                        }
                    ];
                    
                    const hiddenUsers = new Set(newLog.filter(l => l.type === 'hidden').map(l => l.by));
                    if (originalBook.shared_users && hiddenUsers.size >= originalBook.shared_users.length) {
                        await permanentDeleteBook(id);
                        toast.success("Book permanently deleted as all members removed it");
                        return;
                    }

                    await updateBook(id, { activityLog: newLog });
                    toast.success("Removed from your library");
                } catch (err) {
                    console.error("Hide failed:", err);
                    toast.error(getUserFacingError(err, 'deleteBook'));
                    setBooks(prev => [originalBook, ...prev].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
                }
            } else {
                setBinBooks(prev => [{ ...originalBook, deletedAt: new Date().toISOString() }, ...prev]);
                try {
                    await softDeleteBook(id);
                    toast.success("Moved to bin");
                } catch (err) {
                    console.error("Delete failed:", err);
                    toast.error(getUserFacingError(err, 'deleteBook'));
                    setBooks(prev => [originalBook, ...prev].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
                    setBinBooks(prev => prev.filter(b => b.id !== id));
                }
            }
        }
    }, [userId]);

    const handleRestoreBook = useCallback(async (id) => {
        // Optimistic UI update
        let originalBook = null;
        setBinBooks(prev => {
            const index = prev.findIndex(b => b.id === id);
            if (index >= 0) {
                originalBook = prev[index];
                return prev.filter(b => b.id !== id);
            }
            return prev;
        });
        if (originalBook) {
            setBooks(prev => [{ ...originalBook, deletedAt: null }, ...prev].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()));
        }

        try {
            await restoreBook(id);
        } catch (err) {
            console.error("Restore failed:", err);
            toast.error(getUserFacingError(err, 'restoreBook'));
            // Revert optimistic update
            if (originalBook) {
                setBinBooks(prev => [originalBook, ...prev]);
                setBooks(prev => prev.filter(b => b.id !== id));
            }
        }
    }, []);

    const handlePermanentDeleteBook = useCallback(async (id) => {
        // Optimistic UI update
        let originalBook = null;
        setBinBooks(prev => {
            const index = prev.findIndex(b => b.id === id);
            if (index >= 0) {
                originalBook = prev[index];
                return prev.filter(b => b.id !== id);
            }
            return prev;
        });

        try {
            await permanentDeleteBook(id);
        } catch (err) {
            console.error("Perm delete error:", err);
            toast.error(getUserFacingError(err, 'permanentDelete'));
            // Revert optimistic update
            if (originalBook) {
                setBinBooks(prev => [originalBook, ...prev]);
            }
        }
    }, []);

    const handleAddBulkLog = useCallback(async (logData) => {
        if (!userId) return;
        try {
            await supabaseAddBulkLog({ ...logData, userId });
        } catch (err) {
            console.error("Failed to add bulk log:", err);
            toast.error("Failed to save update log.");
        }
    }, [userId]);

    const handleDeleteBulkLog = useCallback(async (logId) => {
        if (!userId) return;
        try {
            await supabaseDeleteBulkLog(logId);
        } catch (err) {
            console.error("Failed to delete bulk log:", err);
            toast.error("Failed to delete bulk log.");
        }
    }, [userId]);

    // Purge bin on mount
    useEffect(() => {
        autoPurgeBin();
    }, []);



    return {
        books,
        binBooks,
        bulkLogs,
        loading,
        addBook: handleAddBook,
        updateBook: handleUpdateBook,
        deleteBook: handleDeleteBook,
        restoreBook: handleRestoreBook,
        permanentDeleteBook: handlePermanentDeleteBook,
        addBulkLog: handleAddBulkLog,
        deleteBulkLog: handleDeleteBulkLog,
        autoPurgeBin,
        isDuplicateBook,
    };
};