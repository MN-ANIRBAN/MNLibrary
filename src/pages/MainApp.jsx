import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  Library, LayoutDashboard, Search, Plus, Menu,
  LogOut, Moon, Sun, Filter, ArrowUpDown, BookOpen, Heart,
  Trash2, RotateCw, ArrowUp, Loader2, // Loader2 add kora hoyeche
  BookOpenIcon,
  BookOpenCheckIcon,
  LucideBookOpen, ArrowDown10, Mouse, MouseLeft, Layers,
  Book, CheckCircle2, Home, User, Users, Network, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, LifeBuoy, X
} from "lucide-react";
import { supabase } from "../supabase/config";
import { useBooks } from "../hooks/useBooks";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useGroups } from "../hooks/useGroups";
import { useDebounce } from "../hooks/useDebounce";
import { getUserFacingError } from "../utils/errorHandler";
import { motion, AnimatePresence, color } from "framer-motion";
import BookForm from "../components/BookForm";
import BulkAIScanner from "../components/BulkAIScanner";
import BookCard from "../components/BookCard";
import BinCard from "../components/BinCard";
import CustomDropdown from "../components/CustomDropdown";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
{/*import MobileDashboard from "../components/MobileDashboard";*/ }
import ConfirmDialog from "../components/ConfirmDialog";
import EntityDetailModal from "../components/EntityDetailModal";
import BulkUpdatePanel from "../components/BulkUpdatePanel";
import UserProfileModal from "../components/UserProfileModal";
import PublicUserProfileModal from "../components/PublicUserProfileModal";
import UsersAdminPanel from "../components/UsersAdminPanel";
import { LayoutPanelTopIcon } from "../components/LayoutPanelTopIcon";

import SupportPanel from "../components/SupportPanel";
import GroupPanel from "../components/GroupPanel";
import NotificationCenter from "../components/NotificationCenter";
import toast from "react-hot-toast";

export default function MainApp({ user, onProfileRefresh }) {
  const [adminViewingUser, setAdminViewingUser] = useState(null);
  const [profileTick, setProfileTick] = useState(0);

  const {
    books: personalBooks, binBooks, bulkLogs, loading,
    addBook: originalAddBook,
    updateBook: originalUpdateBook,
    deleteBook: originalDeleteBook,
    restoreBook,
    permanentDeleteBook,
    addBulkLog, deleteBulkLog,
    isDuplicateBook
  } = useBooks(user, adminViewingUser?.id);

  const { groups, handleSendMessage, checkGroupDuplicateIsbn, fetchAllSharedBooks, handleMarkHandover } = useGroups(user);

  const [globalSharedBooks, setGlobalSharedBooks] = useState([]);

  const handleMarkHandoverWrapper = async (bookId, groupId, action) => {
    try {
      await handleMarkHandover(bookId, groupId, action);
      // Re-fetch shared books to update UI
      fetchAllSharedBooks().then(setGlobalSharedBooks);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user && !adminViewingUser) {
      fetchAllSharedBooks().then(setGlobalSharedBooks);
    }
  }, [user, groups, adminViewingUser]);

  // Combine personal books and shared books.
  // We use a Map to ensure uniqueness by ID just in case.
  const books = useMemo(() => {
    const map = new Map();
    personalBooks.forEach(b => map.set(b.id, b));
    globalSharedBooks.forEach(b => {
      if (!map.has(b.id)) map.set(b.id, b);
    });

    const targetUserId = adminViewingUser ? adminViewingUser.id : user?.id;

    const combined = Array.from(map.values()).filter(b => {
      // If shared_users is defined, the user MUST be in it to see the book.
      if (b.shared_users && Array.isArray(b.shared_users)) {
        if (targetUserId && !b.shared_users.includes(targetUserId)) {
          return false;
        }
      }

      if (b.activityLog && Array.isArray(b.activityLog)) {
        if (b.activityLog.some(log => log.type === 'hidden' && log.by === targetUserId)) {
          return false;
        }
      }
      return true;
    });

    // Sort combined by createdAt descending
    return combined.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [personalBooks, globalSharedBooks, user?.id, adminViewingUser?.id]);

  const groupPartners = useMemo(() => {
    const seen = new Set();
    const partners = [];
    groups.forEach(group => {
      group.group_members?.forEach(member => {
        if (member.status === 'accepted' && member.user_id !== user?.id && !seen.has(member.invited_email)) {
          seen.add(member.invited_email);
          partners.push({
            userId: member.user_id,
            email: member.invited_email,
            name: member.users?.full_name || member.invited_email?.split('@')[0] || member.invited_email,
            groupName: group.name,
            groupId: group.id,
          });
        }
      });
    });
    return partners;
  }, [groups, user]);

  const getSharedGroupsForBook = (book) => {
    if (!book) return new Set();
    const isSharedStatus = ['borrowed', 'lent', 're-lent', 'needreturn'].includes(book.status);
    const ownerEmail = String(book.owner || "").toLowerCase().trim();
    const custodyEmail = String(book.custody || "").toLowerCase().trim();

    const groups = new Set();
    groupPartners.forEach(p => {
      const pEmail = p.email?.toLowerCase();
      const pName = p.name?.toLowerCase();

      if (isSharedStatus ||
        (pEmail && (pEmail === ownerEmail || pEmail === custodyEmail)) ||
        (pName && (pName === ownerEmail || pName === custodyEmail))) {
        if (p.groupId) groups.add(p.groupId);
      }
    });
    return groups;
  };

  const sendGroupNotification = async (groupIds, msg) => {
    for (const groupId of groupIds) {
      try {
        await handleSendMessage(groupId, msg);
      } catch (e) {
        console.error("Failed to send automated chat notification:", e);
      }
    }
  };

  const getInvolvedUserIds = (ownerNameEmail, custodyNameEmail) => {
    const ids = new Set();
    const ownerLower = String(ownerNameEmail || "").toLowerCase().trim();
    const custodyLower = String(custodyNameEmail || "").toLowerCase().trim();

    const myEmailPrefix = String(user?.email?.split("@")[0] || "").toLowerCase().trim();
    const myName = String(user?.profile?.full_name || user?.user_metadata?.full_name || "").toLowerCase().trim();

    if (ownerLower === myEmailPrefix || ownerLower === myName || custodyLower === myEmailPrefix || custodyLower === myName) {
      if (user?.id) ids.add(user.id);
    }

    groupPartners.forEach(p => {
      const pEmail = String(p.email || "").toLowerCase().trim();
      const pName = String(p.name || "").toLowerCase().trim();
      if ((pEmail && (pEmail === ownerLower || pEmail === custodyLower)) ||
        (pName && (pName === ownerLower || pName === custodyLower))) {
        if (p.userId) ids.add(p.userId);
      }
    });
    return Array.from(ids);
  };

  const addBook = async (bookData) => {
    const involvedIds = getInvolvedUserIds(bookData.owner, bookData.custody);
    if (user?.id && !involvedIds.includes(user.id)) involvedIds.push(user.id);
    bookData.shared_users = involvedIds;

    await originalAddBook(bookData);
    const groups = getSharedGroupsForBook(bookData);
    if (groups.size > 0) {
      const payload = JSON.stringify({
        type: 'book_update',
        action: 'added',
        book: { title: bookData.title, author: bookData.author, isbn: bookData.isbn, status: bookData.status, owner: bookData.owner, custody: bookData.custody }
      });
      await sendGroupNotification(groups, `SYSTEM_PAYLOAD:${payload}`);
    }
  };

  const updateBook = async (id, updates) => {
    const currentBook = personalBooks.find(b => b.id === id) || globalSharedBooks.find(b => b.id === id);
    const nextBook = currentBook ? { ...currentBook, ...updates } : null;

    if (nextBook) {
      const newInvolvedIds = getInvolvedUserIds(nextBook.owner, nextBook.custody);
      const existingShared = currentBook.shared_users || [user?.id].filter(Boolean); // fallback to creator if null
      const updatedShared = Array.from(new Set([...existingShared, ...newInvolvedIds]));

      if (updatedShared.length !== existingShared.length) {
        updates.shared_users = updatedShared;
      }

      // Check if owner is changed, update userId
      if (updates.owner && updates.owner !== currentBook.owner) {
        const newOwnerLower = String(updates.owner || "").toLowerCase().trim();
        const myEmailPrefix = String(user?.email?.split("@")[0] || "").toLowerCase().trim();
        const myName = String(user?.profile?.full_name || user?.user_metadata?.full_name || "").toLowerCase().trim();

        if (newOwnerLower === myEmailPrefix || newOwnerLower === myName) {
          updates.userId = user?.id;
        } else {
          const partner = groupPartners.find(p => p.email.toLowerCase().trim() === newOwnerLower || p.name.toLowerCase().trim() === newOwnerLower);
          if (partner && partner.userId) {
            updates.userId = partner.userId;
          }
        }
      }
    }

    await originalUpdateBook(id, updates);

    setGlobalSharedBooks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));

    if (currentBook && nextBook) {
      const currentGroups = getSharedGroupsForBook(currentBook);
      const nextGroups = getSharedGroupsForBook(nextBook);

      const addedTo = new Set([...nextGroups].filter(x => !currentGroups.has(x)));
      const removedFrom = new Set([...currentGroups].filter(x => !nextGroups.has(x)));
      const keptIn = new Set([...currentGroups].filter(x => nextGroups.has(x)));

      const getPayload = (action) => JSON.stringify({
        type: 'book_update',
        action: action,
        book: { title: nextBook.title, author: nextBook.author, isbn: nextBook.isbn, status: nextBook.status, owner: nextBook.owner, custody: nextBook.custody }
      });

      if (addedTo.size > 0) await sendGroupNotification(addedTo, `SYSTEM_PAYLOAD:${getPayload('added')}`);
      if (removedFrom.size > 0) await sendGroupNotification(removedFrom, `SYSTEM_PAYLOAD:${getPayload('removed')}`);
      if (keptIn.size > 0 && (currentBook.status !== nextBook.status || currentBook.owner !== nextBook.owner || currentBook.custody !== nextBook.custody)) {
        await sendGroupNotification(keptIn, `SYSTEM_PAYLOAD:${getPayload('updated')}`);
      }
    }
  };

  const deleteBook = async (id) => {
    const bookToDelete = personalBooks.find(b => b.id === id) || globalSharedBooks.find(b => b.id === id);
    if (!bookToDelete) return;

    const myNameUpper = (user?.profile?.full_name || user?.user_metadata?.full_name || "").toUpperCase().trim();
    const myEmailPrefixUpper = (user?.email?.split('@')[0] || "").toUpperCase().trim();
    const ownerUpper = (bookToDelete.owner || "").toUpperCase().trim();
    const custodyUpper = (bookToDelete.custody || "").toUpperCase().trim();

    const isOwnerMine = ownerUpper === myNameUpper || ownerUpper === myEmailPrefixUpper || ownerUpper === "";
    const isCustodyMine = custodyUpper === myNameUpper || custodyUpper === myEmailPrefixUpper || custodyUpper === "";

    // A book is purely personal if the current user is both owner and custody, and it isn't explicitly shared with others.
    const isPurelyPersonal = isOwnerMine && isCustodyMine && (!bookToDelete.shared_users || bookToDelete.shared_users.length <= 1);

    // Check if logged user is the original creator (userId)
    const isCreator = bookToDelete.userId === user?.id;

    // 1. If it's purely personal AND I am the creator, do a hard delete to Bin
    if (isPurelyPersonal && isCreator) {
      await originalDeleteBook(id);
      return;
    }

    // 2. If it is a shared book, DO NOT delete from DB. Just hide it from this user's view via activityLog.
    try {
      const activityLog = Array.isArray(bookToDelete.activityLog) ? [...bookToDelete.activityLog] : [];

      // Prevent duplicate hidden entries
      if (!activityLog.some(log => log.type === "hidden" && log.userId === user?.id)) {
        activityLog.push({
          id: Date.now(),
          type: "hidden",
          userId: user?.id,
          timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
          notes: "User deleted from their view"
        });
        await updateBook(id, { activityLog });
      }

      setGlobalSharedBooks(prev => prev.filter(b => b.id !== id));
      toast.success("Removed from your library");

      // Group notification to let them know
      const groups = getSharedGroupsForBook(bookToDelete);
      if (groups.size > 0) {
        const payload = JSON.stringify({
          type: 'book_update',
          action: 'removed',
          book: { title: bookToDelete.title, author: bookToDelete.author, isbn: bookToDelete.isbn, status: bookToDelete.status, owner: bookToDelete.owner, custody: bookToDelete.custody }
        });
        await sendGroupNotification(groups, `SYSTEM_PAYLOAD:${payload}`);
      }
    } catch (e) {
      toast.error(getUserFacingError(e, 'deleteBook'));
    }
  };

  const [selectedBinBooks, setSelectedBinBooks] = useState(new Set());
  const isOnline = useOnlineStatus();
  const isAdmin = user?.profile?.role === 'admin';
  const [activeTab, setActiveTab] = useState("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  // Debounce search: filteredBooks useMemo only re-runs 300ms after typing stops
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const statusFilterOptions = useMemo(() => ([
    { value: "owned", label: "Owned" },
    { value: "needreturn", label: "Ready to Return" },
    { value: "returned", label: "Returned" },
    { value: "borrowed", label: "Borrowed" },
    { value: "lent", label: "Lent" },
    { value: "re-lent", label: "Re-lent" },
  ]), []);

  const readingStatusOptions = useMemo(() => ([
    { value: "unread", label: "Not Read" },
    { value: "reading", label: "In Progress" },
    { value: "read", label: "Finished" },
  ]), []);

  const [statusFilter, setStatusFilter] = useState([]);
  const [readingFilter, setReadingFilter] = useState([]);
  const [publicationFilter, setPublicationFilter] = useState([]);
  const [authorFilter, setAuthorFilter] = useState([]);

  const [showSearch, setShowSearch] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedPublicUser, setSelectedPublicUser] = useState(null);

  const handleUserClick = useCallback((clickedUser) => {
    if (!clickedUser) return;
    if (clickedUser.id === user?.id) {
      setShowProfileModal(true);
    } else {
      setSelectedPublicUser(clickedUser);
    }
  }, [user]);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulkScanner, setShowBulkScanner] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [sortBy, setSortBy] = useState("newest");
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);

  // Infinite Scroll States - Desktop: 15 items, Mobile: 10 items
  const [visibleItems, setVisibleItems] = useState(() => window.innerWidth > 768 ? 15 : 10);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const itemsPerPage = 15;

  const [showGoTop, setShowGoTop] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Entity Detail Modal State
  const [entityModalState, setEntityModalState] = useState({
    isOpen: false,
    entity: null,
    entityType: null // 'author', 'publisher', 'lender', 'borrower'
  });

  const scrollRef = useRef(null);
  const loaderRef = useRef(null);
  const searchInputRef = useRef(null);


  const targetUser = adminViewingUser || user;
  const ME = (targetUser?.profile?.full_name || targetUser?.user_metadata?.display_name || targetUser?.display_name || targetUser?.email?.split('@')[0] || "ME").toUpperCase();

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth <= 768;
      setIsMobile(newIsMobile);
      // Reset pagination on major viewport change
      if (newIsMobile !== isMobile) {
        const initialCount = newIsMobile ? 10 : 15;
        setVisibleItems(initialCount);
      }
    };
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const onGlobalKeyDown = (e) => {
      const key = e.key?.toLowerCase();
      if (!(e.ctrlKey || e.metaKey) || key !== "f") return;

      const active = document.activeElement;
      const isInInput =
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);
      if (isInInput) return;

      e.preventDefault();
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select?.();
      }
    };

    document.addEventListener("keydown", onGlobalKeyDown);
    return () => document.removeEventListener("keydown", onGlobalKeyDown);
  }, []);


  // Confirmation Dialog State
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    iconType: "warning",
    confirmText: "Confirm",
    cancelText: "Cancel",
    confirmColor: "#ef4444",
    onConfirm: null,
    onCancel: null,
  });

  const requestConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        isOpen: true,
        title: options.title || "Are you sure?",
        message: options.message || "This action cannot be undone.",
        iconType: options.iconType || "warning",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        confirmColor: options.confirmColor || "#ef4444",
        onConfirm: () => {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  }, []);

  useEffect(() => {
    setPrevActiveTab(activeTab);
  }, [activeTab]);

  const getTransitionClass = (prevTab, currTab) => {
    if (prevTab === currTab) return 'tab-content';
    return 'tab-content fade-in';
  };

  const [theme, setTheme] = useState(() => {
    if (localStorage.getItem("theme")) return localStorage.getItem("theme");
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "light" ? "dark" : "light");

  const currentBooks = useMemo(() => {
    if (activeTab === "bin") return binBooks;
    if (activeTab === "wishlist") return books.filter(b => b.isWishlisted === true);
    return books.filter(b => b.isWishlisted !== true);
  }, [books, binBooks, activeTab]);

  const publicationOptions = useMemo(() => {
    const set = new Set();
    const source = activeTab === "bin" ? binBooks : books;
    (source || []).forEach((b) => {
      const v = String(b?.publisher || "").trim();
      if (v) set.add(v);
    });
    return [{ value: "all", label: "All Publications" }, ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b))).map((n) => ({ value: String(n), label: String(n) }))];
  }, [books, binBooks, activeTab]);

  const authorOptions = useMemo(() => {
    const set = new Set();
    const source = activeTab === "bin" ? binBooks : books;
    (source || []).forEach((b) => {
      const v = String(b?.author || "").trim();
      if (v) set.add(v);
    });
    return [{ value: "all", label: "All Authors" }, ...Array.from(set).sort((a, b) => String(a).localeCompare(String(b))).map((n) => ({ value: String(n), label: String(n) }))];
  }, [books, binBooks, activeTab]);

  const filteredBooks = useMemo(() => {
    let result = [...currentBooks];
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(b =>
        String(b.title || "")?.toLowerCase().includes(q) ||
        String(b.author || "")?.toLowerCase().includes(q) ||
        String(b.publisher || "")?.toLowerCase().includes(q) ||
        String(b.genre || "")?.toLowerCase().includes(q)
      );
    }

    if (Array.isArray(publicationFilter) && publicationFilter.length > 0) {
      const set = new Set(publicationFilter.map(s => String(s || "").trim()));
      result = result.filter(b => set.has(String(b.publisher || "").trim()));
    }

    if (Array.isArray(authorFilter) && authorFilter.length > 0) {
      const set = new Set(authorFilter.map(s => String(s || "").trim()));
      result = result.filter(b => set.has(String(b.author || "").trim()));
    }
    // Ownership filtering (Owned/Borrowed/Lent/...) 
    if (activeTab !== "bin" && Array.isArray(statusFilter) && statusFilter.length > 0) {
      const myName = ME.toUpperCase();

      const matchesAnySelectedOwnership = (b) => {
        return statusFilter.some((sf) => {
          if (sf === "owned") {
            return (b.owner || "").toUpperCase().trim() === myName;
          }
          if (sf === "borrowed") {
            const ownerName = (b.owner || "").toUpperCase().trim();
            const custodyName = (b.custody || "").toUpperCase().trim();
            return ownerName !== myName && custodyName === myName && ownerName !== custodyName && b.status !== "read";
          }
          if (sf === "lent") {
            const ownerName = (b.owner || "").toUpperCase().trim();
            const custodyName = (b.custody || "").toUpperCase().trim();
            return ownerName === myName && custodyName !== myName;
          }
          if (sf === "re-lent") {
            const ownerName = (b.owner || "").toUpperCase().trim();
            const custodyName = (b.custody || "").toUpperCase().trim();
            return ownerName !== myName && custodyName !== myName && ownerName !== custodyName;
          }
          if (sf === "returned") {
            const ownerName = (b.owner || "").toUpperCase().trim();
            const custodyName = (b.custody || "").toUpperCase().trim();
            return ownerName !== myName && custodyName !== myName && ownerName === custodyName;
          }
          if (sf === "needreturn") {
            const ownerName = (b.owner || "").toUpperCase().trim();
            const custodyName = (b.custody || "").toUpperCase().trim();
            return ownerName !== myName && custodyName === myName && ownerName !== custodyName && b.status == "read";
          }
          return false;
        });
      };

      result = result.filter(matchesAnySelectedOwnership);
    }

    // Reading filtering (Unread/In Progress/Finished) 
    if (activeTab !== "bin" && Array.isArray(readingFilter) && readingFilter.length > 0) {
      const matchesAnySelectedReading = (b) => {
        return readingFilter.some((rf) => {
          if (rf === "unread") return b.status === "unread";
          if (rf === "reading") return b.status === "reading";
          if (rf === "read") return b.status === "read";
          return false;
        });
      };

      // AND with ownership: since this is applied after ownership-filter (when both selected), it will naturally narrow further.
      result = result.filter(matchesAnySelectedReading);
    }


    if (activeTab === "bin") {
      result.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
    } else if (sortBy === "newest") {
      result.sort((a, b) => {
        const getAcquisitionDate = (b) => {
          let date = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt || 0);
          if (b.activityLog && Array.isArray(b.activityLog)) {
            const acquiredLog = b.activityLog.find(log => log.type === 'acquired' || (log.type === 'owned' && log.notes?.includes('Added to collection')));
            if (acquiredLog?.timestamp) {
              date = acquiredLog.timestamp.seconds ? new Date(acquiredLog.timestamp.seconds * 1000) : new Date(acquiredLog.timestamp);
            }
          }
          return date.getTime();
        };
        return getAcquisitionDate(b) - getAcquisitionDate(a);
      });
    } else if (sortBy === "title") {
      result.sort((a, b) => a.title?.localeCompare(b.title));
    } else if (sortBy === "pages") {
      result.sort((a, b) => (parseInt(b.pages) || 0) - (parseInt(a.pages) || 0));
    } else if (sortBy === "price") {
      result.sort((a, b) => {
        const priceB = parseFloat(b.price?.toString().replace(/[^0-9.]/g, '')) || 0;
        const priceA = parseFloat(a.price?.toString().replace(/[^0-9.]/g, '')) || 0;
        return priceB - priceA;
      });
    } else if (sortBy === "price-asc") {
      result.sort((a, b) => {
        const priceA = parseFloat(a.price?.toString().replace(/[^0-9.]/g, '')) || 0;
        const priceB = parseFloat(b.price?.toString().replace(/[^0-9.]/g, '')) || 0;
        return priceA - priceB;
      });
    }
    return result;
  }, [currentBooks, debouncedSearchQuery, statusFilter, readingFilter, sortBy, activeTab, publicationFilter, authorFilter]);



  const totalCurrentCount = currentBooks.length;
  const filteredCount = filteredBooks.length;


  const displayBooks = useMemo(() => {
    return filteredBooks.slice(0, visibleItems);
  }, [filteredBooks, visibleItems]);

  const toggleBinSelection = useCallback((bookId) => {
    setSelectedBinBooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookId)) { newSet.delete(bookId); }
      else { newSet.add(bookId); }
      return newSet;
    });
  }, []);

  const clearBinSelection = useCallback(() => setSelectedBinBooks(new Set()), []);

  const handleRestoreSelected = async () => {
    if (selectedBinBooks.size === 0) return;
    const confirmed = await requestConfirm({
      title: "Restore Selected Items",
      message: `Are you sure you want to restore ${selectedBinBooks.size} selected item${selectedBinBooks.size > 1 ? 's' : ''} to your library?`,
      iconType: "info",
      confirmText: "Restore",
      confirmColor: "#10b981",
    });
    if (!confirmed) return;
    try {
      await Promise.all(Array.from(selectedBinBooks).map(id => restoreBook(id)));
      toast.success(`Restored ${selectedBinBooks.size} items`);
      clearBinSelection();
    } catch (error) { toast.error("Restore failed"); }
  };

  const handleDeleteSelected = async () => {
    if (selectedBinBooks.size === 0) return;
    const confirmed = await requestConfirm({
      title: "Permanently Delete Selected",
      message: `This will permanently delete ${selectedBinBooks.size} selected item${selectedBinBooks.size > 1 ? 's' : ''}. This action cannot be undone.`,
      iconType: "danger",
      confirmText: "Delete Forever",
      confirmColor: "#ef4444",
    });
    if (!confirmed) return;
    try {
      await Promise.all(Array.from(selectedBinBooks).map(id => permanentDeleteBook(id)));
      toast.success(`Deleted ${selectedBinBooks.size} items`);
      clearBinSelection();
    } catch (error) { toast.error("Delete failed"); }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingBook) {
        const prevOwner = (editingBook.owner || "").toUpperCase().trim();
        const prevCustody = (editingBook.custody || "").toUpperCase().trim();
        const nextOwner = (formData.owner || "").toUpperCase().trim();
        const nextCustody = (formData.custody || "").toUpperCase().trim();

        const ME_UPPER = ME.toUpperCase().trim();

        const prevIsMine = prevOwner === ME_UPPER;
        const nextIsMine = nextOwner === ME_UPPER;

        const prevIsInMyCustody = prevCustody === ME_UPPER;
        const nextIsInMyCustody = nextCustody === ME_UPPER;

        const prevMode = prevOwner && prevCustody ? {
          owner: prevOwner,
          custody: prevCustody,
          isMine: prevIsMine,
          isInMyCustody: prevIsInMyCustody,
        } : null;

        const nextMode = nextOwner && nextCustody ? {
          owner: nextOwner,
          custody: nextCustody,
          isMine: nextIsMine,
          isInMyCustody: nextIsInMyCustody,
        } : null;

        const activityLog = Array.isArray(editingBook.activityLog)
          ? editingBook.activityLog.slice()
          : (editingBook.activityLog && typeof editingBook.activityLog === "object")
            ? Object.values(editingBook.activityLog)
            : [];

        const prevIsWishlist = editingBook && (editingBook.status === "wishlist" || editingBook.isWishlisted === true);
        const nextIsWishlist = formData.isWishlisted === true || formData.status === "wishlist";
        const removedFromWishlist = prevIsWishlist && !nextIsWishlist;

        const ownerChanged = prevOwner !== nextOwner;
        const custodyChanged = prevCustody !== nextCustody;

        const shouldAddOwnershipActivity = ownerChanged || custodyChanged || removedFromWishlist;

        if (shouldAddOwnershipActivity) {
          // Decide activity type based on transition relative to ME
          // - Owned: owner==ME and custody==ME
          // - Lent/Returned/Borrowed/Received/Re-lent are inferred from owner/custody positions
          let type = "owned";
          let from = prevCustody || nextOwner;
          let to = nextOwner || nextCustody;
          let notes = "";

          const prevOwnedState = prevIsMine && prevIsInMyCustody;
          const nextOwnedState = nextIsMine && nextIsInMyCustody;

          if (removedFromWishlist && !ownerChanged && !custodyChanged) {
            type = "acquired";
            notes = "Moved from Wishlist to Collection";
            from = "Wishlist";
            to = nextOwner || ME_UPPER;
          } else if (nextOwnedState) {
            // If we previously weren't owned and now we are owned => received/returned depending on where custody came from
            if (!prevOwnedState) {
              type = prevIsMine ? "received" : "returned";
              // Heuristic:
              // - If prev owner==ME and custody != ME -> someone gave back to ME => received
              // - If prev owner != ME and custody==ME -> ME had it but legal owner changed back => returned
              notes = type === "received" ? "Received from borrower" : "Returned to owner";
              from = prevCustody || prevOwner;
              to = nextOwner;
            } else {
              type = "owned";
              notes = "Added to collection";
              from = prevCustody;
              to = nextOwner;
            }
          } else {
            // Not in fully-owned state by me
            if (nextIsMine && !nextIsInMyCustody) {
              // I own legally but someone else has custody => lent out
              type = "lent";
              notes = `Lent to ${nextCustody}`;
              from = prevCustody || nextOwner;
              to = nextCustody;
            } else if (!nextIsMine && nextIsInMyCustody) {
              // I have custody but legal owner is someone else => borrowed
              type = "borrowed";
              notes = `Borrowed from ${nextOwner}`;
              from = prevOwner || nextOwner;
              to = nextOwner;
            } else if (!nextIsMine && !nextIsInMyCustody && nextOwner === nextCustody) {
              // owner == custody (external self-contained) => returned to external owner (infer)
              type = "returned";
              notes = `Returned to ${nextCustody}`;
              from = prevCustody || nextCustody;
              to = nextCustody;
            } else {
              // Re-lent: owner != ME and custody != ME and owner != custody
              type = "re-lent";
              notes = `Re-lent to ${nextCustody}`;
              from = prevOwner || nextOwner;
              to = nextCustody;
            }
          }

          activityLog.push({
            id: Date.now(),
            type,
            from,
            to,
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            notes: notes || "Ownership updated",
          });
        }

        if (formData.status === 'read' && editingBook.status !== 'read') {
          activityLog.push({
            id: Date.now(),
            type: 'read',
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            notes: 'Finished reading'
          });
        }

        await updateBook(editingBook.id, { ...formData, activityLog });
        toast.success("Book updated");
      } else {
        // Prevent duplicate book documents for the same user (by ISBN)
        if (isDuplicateBook(formData, { includeBin: false })) {
          toast.error("This book already exists in your library.");
          return;
        }

        // Check if any group partner already owns this ISBN
        if (formData?.isbn) {
          const isGroupDuplicate = await checkGroupDuplicateIsbn(formData.isbn);
          if (isGroupDuplicate) {
            toast.error("A member in your group already has this book in their library.");
            return;
          }
        }

        // Ensure activity log is created when owner/custody are declared during Add Book
        // This fixes case: declaring borrower/custody during add was not being logged.
        const ME_UPPER = ME.toUpperCase().trim();
        const initialOwner = (formData.owner || "").toUpperCase().trim();
        const initialCustody = (formData.custody || "").toUpperCase().trim();

        const isAddingToWishlist = activeTab === "wishlist";
        const activityLog = [];

        const isOwnedByMe = initialOwner === ME_UPPER;
        const isInMyCustody = initialCustody === ME_UPPER;

        if (isAddingToWishlist) {
          activityLog.push({
            id: Date.now(),
            type: "wishlist",
            from: initialOwner || "Unknown",
            to: ME_UPPER,
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            notes: `Added to Wishlist by ${ME}`,
          });
        } else if (initialOwner && initialCustody) {
          let type = "owned";
          let from = initialOwner;
          let to = initialOwner;
          let notes = `Added to collection by ${ME}`;

          if (isOwnedByMe && !isInMyCustody) {
            type = "lent";
            from = initialCustody;
            to = initialCustody;
            notes = `Lent to ${initialCustody}`;
          } else if (!isOwnedByMe && isInMyCustody) {
            type = "borrowed";
            from = initialOwner;
            to = initialCustody;
            notes = `Borrowed from ${initialOwner}`;
          } else if (!isOwnedByMe && !isInMyCustody && initialOwner === initialCustody) {
            type = "returned";
            from = initialCustody;
            to = initialCustody;
            notes = `Returned to ${initialCustody}`;
          } else if (!isOwnedByMe && !isInMyCustody && initialOwner !== initialCustody) {
            type = "re-lent";
            from = initialOwner;
            to = initialCustody;
            notes = `Re-lent to ${initialCustody}`;
          } else {
            type = "owned";
            from = initialCustody;
            to = initialOwner;
            notes = `Added to collection by ${ME}`;
          }

          activityLog.push({
            id: Date.now(),
            type,
            from,
            to,
            timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
            notes,
          });
        }

        await addBook({
          ...formData,
          // keep existing behavior for status
          status: "unread",
          isWishlisted: isAddingToWishlist,
          activityLog,
        });

        // If user adds from wishlist, ensure wishlist tab is active
        if (isAddingToWishlist) setActiveTab("wishlist");

        toast.success(isAddingToWishlist ? "Added to wishlist" : "Book added");
      }
      setShowForm(false);
      setEditingBook(null);
    } catch (error) {
      console.error(error);
      toast.error("Save failed");
    }
  };

  const clearBin = async () => {
    if (binBooks.length === 0) return toast("Bin is empty");
    const confirmed = await requestConfirm({
      title: "Empty Recycle Bin",
      message: `This will permanently delete all ${binBooks.length} item${binBooks.length > 1 ? 's' : ''} in the bin. This action cannot be undone.`,
      iconType: "danger",
      confirmText: "Empty Bin",
      confirmColor: "#ef4444",
    });
    if (!confirmed) return;
    try {
      await Promise.all(binBooks.map(book => permanentDeleteBook(book.id)));
      toast.success("Emptied bin");
    } catch (error) { toast.error("Failed to empty bin"); }
  };

  const restoreAll = async () => {
    if (binBooks.length === 0) return toast("Bin is empty");
    const confirmed = await requestConfirm({
      title: "Restore All Books",
      message: `Are you sure you want to restore all ${binBooks.length} book${binBooks.length > 1 ? 's' : ''} to your library?`,
      iconType: "info",
      confirmText: "Restore All",
      confirmColor: "#10b981",
    });
    if (!confirmed) return;
    try {
      await Promise.all(binBooks.map(book => restoreBook(book.id)));
      toast.success("Restored all books");
    } catch (error) { toast.error("Restore failed"); }
  };

  // Load more items function (shared for scroll and observer)
  const loadMoreItems = useCallback(() => {
    if (filteredBooks.length > visibleItems && !isAutoLoading) {
      setIsAutoLoading(true);
      // Delay to show loader animation
      setTimeout(() => {
        setVisibleItems(prev => prev + itemsPerPage);
        setIsAutoLoading(false);
      }, 800);
    }
  }, [filteredBooks.length, visibleItems, isAutoLoading, itemsPerPage]);

  // Scroll Handler with Infinite Scroll Logic (mobile-optimized threshold)
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    setShowGoTop(scrollTop > 400);

    // Dynamic threshold for mobile (80% of viewport height vs fixed 50px)
    const threshold = isMobile ? clientHeight * 0.8 : clientHeight + 50;
    if (scrollHeight - scrollTop <= threshold) {
      loadMoreItems();
    }
  }, [isMobile, loadMoreItems]);

  // Track if more items available for observer
  useEffect(() => {
    setHasMoreItems(filteredBooks.length > visibleItems);
  }, [filteredBooks.length, visibleItems]);

  // IntersectionObserver for mobile auto-load (triggers when loader visible)
  useEffect(() => {
    if (!hasMoreItems || !isMobile || !loaderRef.current || isAutoLoading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMoreItems();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [hasMoreItems, isMobile, isAutoLoading, loadMoreItems]);

  // Reset pagination on filter/tab/sort changes (mobile-optimized initial count)
  useEffect(() => {
    const initialCount = isMobile ? 10 : 15;
    setVisibleItems(initialCount);
    setHasMoreItems(true); // Assume more until proven otherwise
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab, searchQuery, statusFilter, sortBy, isMobile]);

  useEffect(() => {
    setShowAdvancedFilters(false);
  }, [activeTab]);

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = async () => {
    // guard against multiple triggers
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore (best-effort)
    }
    toast.success("Logged out successfully");
  };

  // --- Auto-logout: idle + tab/window close (best-effort) ---
  useEffect(() => {
    const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes


    let logoutTriggered = false;
    const lastActivityRef = { current: Date.now() };

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "wheel",
    ];

    activityEvents.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const intervalId = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (!logoutTriggered && idleFor >= IDLE_TIMEOUT_MS) {
        logoutTriggered = true;
        handleLogout();
      }
    }, 30 * 1000);

    // Removed handleBeforeUnload so users stay logged in across page refreshes

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, markActivity));
      window.clearInterval(intervalId);
    };
  }, [handleLogout]);

  const binCount = binBooks.length;

  const isBinTab = activeTab === "bin";

  // Handle entity click from dashboard leaderboards
  const handleEntityClick = useCallback((entity, entityType) => {
    setEntityModalState({
      isOpen: true,
      entity: entity,
      entityType: entityType
    });
  }, []);

  // Close entity modal
  const closeEntityModal = useCallback(() => {
    setEntityModalState({
      isOpen: false,
      entity: null,
      entityType: null
    });
  }, []);

  const userAvatarUrl = user?.profile?.profile_picture_url || user?.user_metadata?.avatar_url;
  const userCoverUrl = user?.profile?.cover_picture_url || user?.user_metadata?.cover_url;

  return (
    <div className="app-container">
      {/* Mobile Header */}
      <header className="mobile-header" style={{ position: 'relative', overflow: 'hidden' }}>
        {userCoverUrl && (
          <div style={{
            position: 'absolute', inset: '-40px',
            backgroundImage: `url(${userCoverUrl})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            filter: 'blur(30px) saturate(250%)',
            opacity: theme === 'dark' ? 0.4 : 0.25,
            zIndex: 0, pointerEvents: 'none'
          }} />
        )}
        <div className="mobile-header-brand" style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', flexShrink: 0, background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <DotLottieReact
              src="/assets/brand.lottie"
              style={{ width: 22, height: 22, display: 'block' }}
              loop
              autoplay
            />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', letterSpacing: '-0.5px' }}>
            <span className="live-brand" style={{
              background: 'linear-gradient(135deg, var(--pro-primary) 0%, var(--pro-secondary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              MN-Library
            </span>
            <span className="live-brand-dot" style={{ color: 'var(--pro-primary)' }}>.</span>
          </div>
        </div>
        <div className="mobile-header-actions" style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="mobile-header-btn glass-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="mobile-header-btn glass-btn" onClick={handleLogout} title="Logout">
            <LogOut size={16} />
          </button>
          <div className="mobile-header-avatar" style={{ overflow: 'hidden', border: '2px solid var(--pro-primary)', cursor: 'pointer' }} onClick={() => setShowProfileModal(true)} title="Profile">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user?.email?.[0]?.toUpperCase()
            )}
          </div>
        </div>
      </header>

      <aside className={`app-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Modern Top Collapse Toggle */}
        <div style={{
          display: 'flex',
          justifyContent: isSidebarCollapsed ? 'center' : 'flex-end',
          padding: isSidebarCollapsed ? 'min(24px, 3vh) 0 0 0' : 'min(24px, 3vh) 24px 0 0',
          transition: 'all 0.3s ease'
        }}>
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            style={{
              background: 'var(--bg-elevated, rgba(255,255,255,0.5))',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-1)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'linear-gradient(135deg, var(--pro-primary, #6366f1), var(--pro-accent, #4f46e5))';
              e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'var(--text-1)';
              e.currentTarget.style.background = 'var(--bg-elevated, rgba(255,255,255,0.5))';
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
            }}
          >
            {isSidebarCollapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="nav-menu" style={{ paddingTop: 'min(20px, 2.5vh)', paddingLeft: isSidebarCollapsed ? '8px' : '20px', paddingRight: isSidebarCollapsed ? '8px' : '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 'min(8px, 1vh)', paddingBottom: 'min(20px, 2.5vh)', overflowY: isSidebarCollapsed ? 'visible' : 'auto', overflowX: isSidebarCollapsed ? 'visible' : 'hidden', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {(adminViewingUser ? [
            { id: 'library', label: `${adminViewingUser.display_name?.split(' ')[0] || 'User'}'s Library`, icon: <Library size={20} />, count: books.filter(b => b.status !== "wishlist" && !b.isWishlisted).length },
            { id: 'wishlist', label: 'Wishlist', icon: <Heart size={20} />, count: books.filter(b => b.status === "wishlist" || b.isWishlisted).length },
            { id: 'dashboard', label: 'User Dashboard', icon: <LayoutPanelTopIcon size={20} />, count: null },
            { id: 'profile', label: 'User Profile', icon: <User size={20} />, count: null, action: () => setSelectedPublicUser(adminViewingUser) }
          ] : [
            { id: 'library', label: 'My Library', icon: <Library size={20} />, count: books.filter(b => b.isWishlisted !== true).length },
            { id: 'wishlist', label: 'Wishlist', icon: <Heart size={20} />, count: books.filter(b => b.isWishlisted === true).length },
            { id: 'bin', label: 'Recycle Bin', icon: <Trash2 size={20} />, count: binBooks.length },
            { id: 'bulk', label: 'Bulk Update', icon: <Layers size={20} />, count: null },
            { id: 'groups', label: 'Groups', icon: <Network size={20} />, count: null },
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutPanelTopIcon size={20} />, count: null },
            { id: 'support', label: 'Support', icon: <LifeBuoy size={20} />, count: null },
            ...(isAdmin ? [{ id: 'users', label: 'Users', icon: <Users size={20} />, count: null }] : [])
          ]).map((item) => (
            <button key={item.id} onClick={() => {
              if (item.action) {
                item.action();
              } else {
                setActiveTab(item.id);
              }
            }}
              className="nav-sidebar-item"
              data-tooltip={isSidebarCollapsed ? item.label : ""}
              style={{
                width: '100%',
                padding: isSidebarCollapsed ? 'min(8px, 1.2vh)' : 'min(12px, 1.8vh) 16px',
                borderRadius: '16px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: activeTab === item.id ? 'var(--text-1, #111)' : 'var(--text-2, #64748b)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: 'none'
              }}
              onMouseOver={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.color = 'var(--pro-primary, #6366f1)';
                  e.currentTarget.style.transform = 'translateX(4px)';
                }
              }}
              onMouseOut={(e) => {
                if (activeTab !== item.id) {
                  e.currentTarget.style.color = 'var(--text-2, #64748b)';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              {activeTab === item.id && (
                <motion.div layoutId="activeTabIndicator"
                  style={{
                    position: 'absolute',
                    left: isSidebarCollapsed ? '-8px' : '-20px',
                    top: 'calc(50% - 16px)',
                    width: '4px',
                    height: '32px',
                    background: 'var(--pro-primary, #6366f1)',
                    borderRadius: '0 4px 4px 0',
                    boxShadow: '2px 0 10px rgba(99, 102, 241, 0.4)',
                    zIndex: 2
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {activeTab === item.id && (
                <motion.div layoutId="activeTabBackground"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'var(--pro-primary, #6366f1)',
                    opacity: 0.1,
                    borderRadius: '16px',
                    zIndex: 0
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: isSidebarCollapsed ? 0 : '14px', width: '100%', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', transition: 'gap 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: activeTab === item.id ? 'var(--pro-primary, #6366f1)' : 'transparent',
                  color: activeTab === item.id ? '#fff' : 'inherit',
                  transition: 'all 0.3s ease',
                  boxShadow: activeTab === item.id ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none'
                }}>
                  {React.cloneElement(item.icon, { size: 20 })}
                </span>
                <AnimatePresence>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "auto", opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      <span style={{ textAlign: 'left', fontWeight: activeTab === item.id ? 700 : 600, fontSize: '15px', letterSpacing: '-0.3px' }}>{item.label}</span>
                      {item.count !== null &&
                        <span className="count-tag" style={{
                          marginLeft: '12px',
                          background: activeTab === item.id ? 'var(--pro-primary, #6366f1)' : 'var(--bg-input, rgba(0,0,0,0.05))',
                          color: activeTab === item.id ? '#fff' : 'var(--text-3, #94a3b8)',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          boxShadow: activeTab === item.id ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
                          border: 'none'
                        }}>
                          {item.count}
                        </span>
                      }
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer" style={{
          padding: isSidebarCollapsed ? 'min(20px, 2.5vh) 8px' : 'min(20px, 2.5vh)',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'min(12px, 1.5vh)',
          borderTop: '1px solid var(--border)',
          background: 'rgba(0,0,0,0.01)'
        }}>
          {/* Theme Toggle */}
          <button onClick={toggleTheme} title={isSidebarCollapsed ? (theme === "light" ? "Dark Mode" : "Light Mode") : undefined}
            style={{
              display: 'flex', alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              width: '100%', border: 'none', background: 'var(--bg-input, rgba(0,0,0,0.03))', cursor: 'pointer',
              padding: isSidebarCollapsed ? 'min(8px, 1.2vh)' : 'min(10px, 1.5vh) 16px',
              borderRadius: '16px', color: 'var(--text-2)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              border: '1px solid transparent'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--bg-elevated, rgba(255,255,255,0.1))';
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--bg-input, rgba(0,0,0,0.03))';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <AnimatePresence>
              {!isSidebarCollapsed && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: theme === 'light' ? '#f59e0b' : '#60a5fa',
                    boxShadow: theme === 'light' ? '0 0 10px #f59e0b' : '0 0 10px #60a5fa'
                  }} />
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{theme === "light" ? "Light Theme" : "Dark Theme"}</span>
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'var(--bg-secondary)',
              boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
              {theme === "light" ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#60a5fa" />}
            </div>
          </button>

          {/* User Profile */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
            gap: isSidebarCollapsed ? '4px' : '14px',
            flexDirection: isSidebarCollapsed ? 'column' : 'row',
            width: '100%',
            padding: isSidebarCollapsed ? 'min(10px, 1.5vh) 8px' : 'min(12px, 1.8vh) 16px',
            borderRadius: '20px',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            background: 'linear-gradient(135deg, var(--bg-elevated, rgba(255,255,255,0.05)) 0%, var(--bg-primary, rgba(255,255,255,0.01)) 100%)',
            border: '1px solid var(--border)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.03)',
            cursor: 'pointer'
          }}
            onClick={() => setShowProfileModal(true)}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.08)';
              e.currentTarget.style.borderColor = 'var(--pro-primary, #6366f1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 16px rgba(0,0,0,0.03)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div style={{
              position: 'relative',
              width: isSidebarCollapsed ? 'min(32px, 4vh)' : '40px',
              height: isSidebarCollapsed ? 'min(32px, 4vh)' : '40px',
              borderRadius: '12px',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'var(--pro-accent, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
            }}>
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={18} />
              )}
            </div>

            <AnimatePresence>
              {!isSidebarCollapsed && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1, display: 'flex', flexDirection: 'column' }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-1)', textOverflow: 'ellipsis', overflow: 'hidden', letterSpacing: '-0.2px' }} title={user?.profile?.display_name || user?.user_metadata?.display_name || "Account"}>
                    {user?.profile?.display_name || user?.user_metadata?.display_name || "Account"}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 600 }} title={user.email}>
                    {user.email}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={(e) => { e.stopPropagation(); handleLogout(); }}
              title="Logout"
              style={{
                background: 'var(--bg-input, rgba(0,0,0,0.05))',
                border: 'none',
                color: 'var(--text-3)',
                cursor: 'pointer',
                width: '28px',
                height: '28px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = 'var(--text-3)';
                e.currentTarget.style.background = 'var(--bg-input, rgba(0,0,0,0.05))';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className={`main-viewport ${isBinTab ? 'bin-mode' : ''}`}>
        {adminViewingUser && (
          <div className="admin-viewing-banner">
            <div className="banner-info">
              <Users size={18} />
              <h3>Viewing Library: {adminViewingUser.display_name || adminViewingUser.email}</h3>
            </div>
            <button onClick={() => {
              setAdminViewingUser(null);
              setActiveTab("users");
            }}>
              Back to Admin View
            </button>
          </div>
        )}

        {activeTab !== "users" && (
          <header className="viewport-header" style={{ position: 'relative', overflow: 'visible', backgroundColor: 'transparent', borderRadius: '24px', padding: '0px', minHeight: 'auto', display: 'flex', alignItems: 'center', margin: '16px 16px 0 16px', gap: '12px', border: 'none' }}>
            {userCoverUrl && !isMobile && (
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', zIndex: 0, pointerEvents: 'none' }}>
                <div style={{
                  position: 'absolute', inset: '-40px',
                  backgroundImage: `url(${userCoverUrl})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  filter: 'blur(40px) saturate(250%)',
                  opacity: theme === 'dark' ? 0.35 : 0.2
                }} />
              </div>
            )}

            <div style={{ position: 'relative', zIndex: 1, paddingLeft: '8px', display: 'flex', alignItems: 'center' }}>
              <NotificationCenter user={user} onOpenTab={setActiveTab} />
            </div>

            <style>{`
              @media (min-width: 901px) and (max-width: 1200px) {
                .top-nav-bar { zoom: 0.85; }
              }
              @media (min-width: 769px) and (max-width: 900px) {
                .top-nav-bar { zoom: 0.7; }
              }
              @media (max-width: 768px) {
                .top-nav-bar { zoom: 1 !important; }
              }
              }
            `}</style>

            <div className="top-nav-bar" style={{
              backgroundColor: theme === 'light' ? '#f8f9fa' : 'var(--bg-primary, #EBEAE5)',
              borderRadius: '32px',
              display: 'flex',
              alignItems: 'center',
              padding: '4px 16px 4px 20px',
              flex: 1,
              gap: '12px',
              position: 'relative',
              zIndex: 1,
              overflow: 'visible',
              border: 'none',
              boxShadow: 'none',
              flexWrap: 'nowrap'
            }}>
              {!isMobile && (
                <div className="header-brand-info" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
                  <DotLottieReact src="/assets/brand.lottie" style={{ width: 24, height: 24 }} loop autoplay />
                  <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.5px' }}>
                    MN-Library
                  </h1>
                </div>
              )}

              {isSearchFocused && <div style={{ flex: 1, minWidth: '80px' }} />}

              <div className="pro-search-wrapper" style={{
                position: isSearchFocused ? 'absolute' : 'relative',
                top: isSearchFocused ? '2px' : 'auto',
                left: isSearchFocused ? '16px' : 'auto',
                width: isSearchFocused ? 'calc(100% - 32px)' : 'auto',
                backgroundColor: 'var(--bg-elevated, var(--bg-card, #FFF))',
                borderRadius: '24px',
                border: isSearchFocused ? '2px solid var(--pro-primary, #6366f1)' : 'none',
                boxShadow: isSearchFocused ? '0 15px 35px rgba(0,0,0,0.15), 0 5px 15px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
                margin: 0,
                flex: isSearchFocused ? 'none' : 1,
                minWidth: isSearchFocused ? 'none' : '80px',
                zIndex: isSearchFocused ? 100 : 1,
                transform: isSearchFocused ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Search className="search-icon-pro" size={16} style={{ color: isSearchFocused ? 'var(--pro-primary, #6366f1)' : 'inherit', transition: 'color 0.3s' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={isBinTab ? "Search deleted books..." : "Search title, author, or ISBN..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="pro-search-input"
                  style={{ background: 'transparent', color: 'var(--text-1)', outline: 'none', border: 'none', width: '100%' }}
                />
                {searchQuery ? (
                  <div style={{ position: 'absolute', right: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {searchQuery !== debouncedSearchQuery && (
                      <Loader2 size={16} className="animate-spin" style={{ color: 'var(--pro-primary)' }} />
                    )}
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearchQuery("")}
                      title="Clear search"
                      className="search-clear-btn"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="search-shortcut" style={{ opacity: isSearchFocused ? 0 : 1, transition: 'opacity 0.2s' }}>
                    <kbd>Ctrl</kbd>
                    <span>+</span>
                    <kbd>F</kbd>
                  </div>
                )}
              </div>

              {(() => {
                const topNavActions = (
                  <React.Fragment>
                                  {!isBinTab && (
                                    <div style={{ position: 'relative' }}>
                                      <button
                                        type="button"
                                        className={`btn-pro btn-pro-advance ${showAdvancedFilters ? 'active' : ''}`}
                                        onClick={() => setShowAdvancedFilters(prev => !prev)}
                                        style={{
                                          borderRadius: '24px',
                                          background: showAdvancedFilters ? 'linear-gradient(135deg, var(--pro-primary, #6366f1) 0%, var(--pro-accent, #4f46e5) 100%)' : 'var(--bg-elevated)',
                                          color: showAdvancedFilters ? '#fff' : 'var(--text-1)',
                                          border: showAdvancedFilters ? '1px solid transparent' : '1px solid var(--border)',
                                          fontWeight: 600,
                                          fontSize: '13px',
                                          margin: 0,
                                          padding: '6px 16px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          boxShadow: showAdvancedFilters ? '0 4px 16px rgba(99, 102, 241, 0.4)' : '0 2px 8px rgba(0,0,0,0.04)',
                                          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                          backdropFilter: 'blur(10px)'
                                        }}
                                      >
                                        <Filter size={14} strokeWidth={showAdvancedFilters ? 2.5 : 2} />
                                        Advance Search
                                      </button>
                                      <AnimatePresence>
                                        {showAdvancedFilters && (
                                          <motion.div
                                            initial={{ opacity: 0, y: 15, scale: 0.96 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 15, scale: 0.96 }}
                                            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
                                            style={{
                                              position: isMobile ? 'relative' : 'absolute',
                                              top: isMobile ? '8px' : 'calc(100% + 14px)',
                                              right: 0,
                                              zIndex: 2000,
                                              width: 'min(460px, calc(100vw - 32px))',
                                              background: 'var(--bg-card, #fff)',
                                              borderRadius: '24px',
                                              boxShadow: '0 24px 48px rgba(0,0,0,0.12), 0 0 0 1px var(--border)',
                                              overflow: 'hidden',
                                              transformOrigin: 'top right'
                                            }}
                                          >
                                            <div style={{
                                              padding: '20px 24px',
                                              borderBottom: '1px solid var(--border)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              background: 'linear-gradient(to bottom, var(--bg-elevated), transparent)'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                <div style={{
                                                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.15) 100%)',
                                                  padding: '10px',
                                                  borderRadius: '12px',
                                                  display: 'flex',
                                                  color: 'var(--pro-primary, #6366f1)',
                                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)'
                                                }}>
                                                  <Filter size={18} strokeWidth={2.5} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>Advanced Filters</h4>
                                                  <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 500, marginTop: '2px' }}>Refine your library view</span>
                                                </div>
                                              </div>
                                              <button onClick={() => setShowAdvancedFilters(false)} style={{
                                                background: 'var(--bg-input, rgba(0,0,0,0.05))',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-2)',
                                                padding: '8px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                              }}
                                                onMouseOver={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-input, rgba(0,0,0,0.05))'; e.currentTarget.style.color = 'var(--text-2)'; e.currentTarget.style.transform = 'scale(1)'; }}
                                              >
                                                <X size={16} strokeWidth={2.5} />
                                              </button>
                                            </div>
                                            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxHeight: '480px', overflowY: 'auto' }}>
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
                                                <label style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                  <Layers size={14} color="var(--pro-primary)" /> Status
                                                </label>
                                                <CustomDropdown
                                                  value={statusFilter}
                                                  onChange={setStatusFilter}
                                                  options={statusFilterOptions}
                                                  multiple
                                                />
                                              </div>
                    
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1' }}>
                                                <label style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                  <BookOpenCheckIcon size={14} color="var(--pro-primary)" /> Reading State
                                                </label>
                                                <CustomDropdown
                                                  value={readingFilter}
                                                  onChange={setReadingFilter}
                                                  options={readingStatusOptions}
                                                  multiple
                                                />
                                              </div>
                    
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                  <LucideBookOpen size={14} color="var(--pro-primary)" /> Publication
                                                </label>
                                                <CustomDropdown
                                                  value={publicationFilter}
                                                  onChange={setPublicationFilter}
                                                  options={publicationOptions.filter(o => o.value !== "all")}
                                                  multiple
                                                />
                                              </div>
                    
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                  <User size={14} color="var(--pro-primary)" /> Author
                                                </label>
                                                <CustomDropdown
                                                  value={authorFilter}
                                                  onChange={setAuthorFilter}
                                                  options={authorOptions.filter(o => o.value !== "all")}
                                                  multiple
                                                />
                                              </div>
                    
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: '1 / -1', marginTop: '4px' }}>
                                                <label style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                  <ArrowUpDown size={14} color="var(--pro-primary)" /> Sort Order
                                                </label>
                                                <CustomDropdown
                                                  value={sortBy}
                                                  onChange={setSortBy}
                                                  options={[{ value: "newest", label: "Latest First" }, { value: "title", label: "Alphabetical" }, { value: "pages", label: "Pages (Longest First)" }, { value: "price", label: "Price (Highest First)" }, { value: "price-asc", label: "Price (Lowest First)" }]}
                                                />
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                    
                                    </div>
                                  )}
                    
                                  {!isBinTab && (
                                    <button
                                      type="button"
                                      className="btn-pro btn-pro-reset"
                                      onClick={() => {
                                        setSearchQuery("");
                                        setStatusFilter([]);
                                        setReadingFilter([]);
                                        setPublicationFilter([]);
                                        setAuthorFilter([]);
                                        setSortBy("newest");
                                        setShowAdvancedFilters(false);
                                      }}
                                      style={{
                                        borderRadius: '24px',
                                        backgroundColor: 'transparent',
                                        color: 'var(--text-2)',
                                        border: '1px solid var(--border)',
                                        fontWeight: 500,
                                        margin: 0,
                                        padding: '4px 12px',
                                        transition: 'all 0.2s ease'
                                      }}
                                      onMouseOver={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                                        e.currentTarget.style.color = 'var(--text-1)';
                                      }}
                                      onMouseOut={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-2)';
                                      }}
                                    >
                                      Reset Filters
                                    </button>
                                  )}
                    
                                  {['library', 'wishlist', 'bin'].includes(activeTab) && (
                                    <span className="count-tag" style={{
                                      marginLeft: 0,
                                      padding: '4px 12px',
                                      borderRadius: '24px',
                                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                      color: 'var(--pro-primary, #6366f1)',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      border: '1px solid rgba(99, 102, 241, 0.2)',
                                      boxShadow: 'none',
                                      margin: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0
                                    }}>
                                      <Library size={14} />
                                      {filteredCount} / {totalCurrentCount} Books
                                    </span>
                                  )}
                    
                                  {(activeTab === 'library' || activeTab === 'wishlist') && !adminViewingUser && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      {isAdmin && (
                                        <button
                                          className="btn-add-primary"
                                          onClick={() => setShowBulkScanner(true)}
                                          style={{ borderRadius: '24px', fontWeight: 500, margin: 0, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white', border: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}
                                        >
                                          <Plus size={18} /> <span>Bulk Add Books</span>
                                        </button>
                                      )}
                                      <button
                                        className="btn-add-primary"
                                        onClick={() => {
                                          setEditingBook(null);
                                          setShowForm(true);
                                        }}
                                        style={{ borderRadius: '24px', fontWeight: 500, margin: 0, whiteSpace: 'nowrap', flexShrink: 0 }}
                                      >
                                        <Plus size={18} /> <span>Add Book</span>
                                      </button>
                                    </div>
                                  )}
                  </React.Fragment>
                );

                return (
                  <React.Fragment>
                    {!isMobile ? topNavActions : (
                      <button 
                        onClick={() => setIsMobileNavOpen(true)} 
                        className="btn-pro" 
                        style={{ 
                          background: 'var(--bg-elevated, #fff)', 
                          border: 'none', 
                          padding: '8px', 
                          borderRadius: '50%', 
                          color: 'var(--text-1)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}>
                        <Menu size={20} />
                      </button>
                    )}
                    <AnimatePresence>
                      {isMobile && isMobileNavOpen && (
                        <React.Fragment>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileNavOpen(false)}
                            style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998, backdropFilter: 'blur(4px)' }}
                          />
                          <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                              position: 'fixed',
                              top: 0,
                              right: 0,
                              bottom: 0,
                              width: '280px',
                              backgroundColor: 'var(--bg-card, #FFF)',
                              boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
                              zIndex: 9999,
                              display: 'flex',
                              flexDirection: 'column',
                              padding: '24px',
                              gap: '16px',
                              overflowY: 'auto'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Actions</h3>
                              <button onClick={() => setIsMobileNavOpen(false)} style={{ background: 'var(--bg-input, rgba(0,0,0,0.05))', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer', display: 'flex', color: 'var(--text-2)' }}>
                                <X size={18} />
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
                              {topNavActions}
                            </div>
                          </motion.div>
                        </React.Fragment>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })()}
            </div>
          </header>
        )}

        <div
          className={`main-scroll-area ${['groups', 'support', 'bulk'].includes(activeTab) ? 'no-padding' : ''}`}
          onScroll={handleScroll}
          ref={scrollRef}
        >
          <div className={getTransitionClass(prevActiveTab, activeTab)}>
            {activeTab === "groups" ? (
              <GroupPanel user={user} onUserClick={handleUserClick} onStatusChange={(id, data) => updateBook(id, data)} />
            ) : activeTab === "users" && isAdmin ? (
              <UsersAdminPanel onSelectUser={(u) => {
                setAdminViewingUser(u);
                setActiveTab("library");
              }} />
            ) : activeTab === "library" || activeTab === "wishlist" || activeTab === "bin" ? (
              <div className={`library-content ${isBinTab ? 'bin-content' : ''}`}>
                <div style={{ marginBottom: isBinTab ? '20px' : '0' }}>
                  <div className="content-toolbar" style={{ marginBottom: 0, justifyContent: 'flex-end', padding: isBinTab ? undefined : 0, minHeight: isBinTab ? undefined : 0 }}>
                    <div className="pro-actions-group">
                      {!isBinTab && (
                        <>
                        </>
                      )}
                      {isBinTab && binCount > 0 && (
                        <div className="bin-management-wrapper">
                          {selectedBinBooks.size === 0 ? (
                            <div className="bin-default-toolbar">
                              <button className="btn-pro btn-pro-restore" onClick={restoreAll}><RotateCw size={14} /> Restore All</button>
                              <button className="btn-pro btn-pro-empty" onClick={clearBin}><Trash2 size={14} /> Empty Bin</button>
                            </div>
                          ) : (
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="floating-selection-bar">
                              <span className="count-pill">{selectedBinBooks.size} {selectedBinBooks.size > 1 ? 'Files' : 'File'} Selected</span>
                              <div className="bar-actions">
                                <button className="action-pill restore" onClick={handleRestoreSelected}><RotateCw size={14} /> Restore</button>
                                <button className="action-pill delete" onClick={handleDeleteSelected}><Trash2 size={14} /> Delete</button>
                                <button className="action-pill-close" onClick={clearBinSelection}><X size={16} /></button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>


                </div>

                {loading ? (
                  <div className="skeleton-grid">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="skeleton-card">
                        <div className="skeleton-wrapper skeleton-card-image"></div>
                        <div className="skeleton-wrapper skeleton-text title" style={{ marginTop: 8 }}></div>
                        <div className="skeleton-wrapper skeleton-text short"></div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                          <div className="skeleton-wrapper skeleton-circle" style={{ width: 24, height: 24 }}></div>
                          <div className="skeleton-wrapper skeleton-text" style={{ flex: 1, marginTop: 6 }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredBooks.length === 0 ? (
                  <div className="empty-state-container">
                    <div className="empty-state-icon">{activeTab === "bin" ? <Trash2 size={48} /> : activeTab === "wishlist" ? <Heart size={48} /> : <BookOpen size={48} />}</div>
                    <h3>{activeTab === "bin" ? "Bin empty" : "No books found"}</h3>
                  </div>
                ) : (
                  <>
                    <div className={`book-grid ${isBinTab ? 'bin-grid' : ''} ${activeTab === 'wishlist' ? 'wishlist-grid' : ''}`}>
                      {displayBooks.map((book, index) =>
                        isBinTab ? (
                          <BinCard key={book.id} book={book} onRestore={restoreBook} onPermanentDelete={permanentDeleteBook} selectedBinBooks={selectedBinBooks} toggleBinSelection={toggleBinSelection} requestConfirm={requestConfirm} currentUser={user} />
                        ) : adminViewingUser ? (
                          <BookCard
                            key={book.id}
                            book={book}
                            index={index}
                            currentUser={user}
                            myName={ME}
                            isReadOnly={true}
                            onEdit={() => { }}
                            onDelete={() => { }}
                            onStatusChange={() => { }}
                          />
                        ) : (
                          <BookCard
                            key={book.id}
                            book={book}
                            onEdit={(b) => { setEditingBook(b); setShowForm(true); }}
                            onDelete={deleteBook}
                            onStatusChange={(id, data) => {
                              const updateData = typeof data === 'string' ? { status: data } : { ...data };
                              if (updateData.status === 'read' && book.status !== 'read') {
                                const existingLog = Array.isArray(book.activityLog)
                                  ? book.activityLog
                                  : (book.activityLog && typeof book.activityLog === "object")
                                    ? Object.values(book.activityLog)
                                    : [];
                                updateData.activityLog = [
                                  ...existingLog,
                                  {
                                    id: Date.now(),
                                    type: 'read',
                                    timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                                    notes: 'Finished reading'
                                  }
                                ];
                              }
                              updateBook(id, updateData);
                            }}
                            myName={ME}
                            currentUser={user}
                            onMarkHandover={(bookId, action) => handleMarkHandoverWrapper(bookId, null, action)}
                            isReadOnly={false}
                          />
                        )
                      )}
                    </div>

                    {/* Infinite Scroll Loader Wheel - Mobile Auto-Load Trigger */}
                    <div ref={loaderRef} className="infinite-loader-container">
                      <AnimatePresence>
                        {(isAutoLoading || hasMoreItems) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="loader-wheel-box"
                          >
                            {isAutoLoading ? (
                              <>
                                <Loader2 className="spinning-icon" style={{ animation: 'spin 1s linear infinite, liveLoaderPulse 1.2s ease-in-out infinite' }} />
                                <span>Loading more books...</span>
                              </>
                            ) : (
                              <span onClick={loadMoreItems}> <DotLottieReact
                                src="/assets/empty1.lottie"
                                style={{ width: 60, height: 60, display: 'block', margin: '0 auto', cursor: 'pointer' }}
                                loop
                                autoplay
                              />
                                Scroll or Tap to load more
                              </span>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!isAutoLoading && !hasMoreItems && filteredBooks.length > itemsPerPage && (
                        <p className="end-of-list-msg">
                          ðŸŽ‰ You've reached the end of your collection!
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : activeTab === "bulk" ? (
              <BulkUpdatePanel books={books} updateBook={updateBook} bulkLogs={bulkLogs} addBulkLog={addBulkLog} deleteBulkLog={deleteBulkLog} performedByAdmin={adminViewingUser ? user : null} currentUser={adminViewingUser || user} />
            ) : activeTab === "support" ? (
              <SupportPanel user={user} isAdmin={isAdmin} onUserClick={handleUserClick} />
            ) : null}
            <div style={{ display: activeTab === "dashboard" ? "block" : "none" }} aria-hidden={activeTab !== "dashboard"}>
              <AnalyticsDashboard books={books} onEntityClick={handleEntityClick} myName={ME} />
            </div>
          </div>
        </div>
      </main>
      {
        showGoTop && (
          <button className="go-to-top-btn" onClick={scrollToTop}>
            <ArrowUp size={24} />
          </button>
        )
      }
      {
        showForm && (
          <BookForm book={editingBook} onSubmit={handleFormSubmit} onClose={() => { setShowForm(false); setEditingBook(null); }} defaultStatus={activeTab === "wishlist" ? "wishlist" : "unread"} myName={ME} groupPartners={groupPartners} isAdmin={isAdmin} />
        )
      }
      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        iconType={confirmConfig.iconType}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        confirmColor={confirmConfig.confirmColor}
        onConfirm={confirmConfig.onConfirm}
        onCancel={confirmConfig.onCancel}
      />
      <EntityDetailModal
        isOpen={entityModalState.isOpen}
        onClose={closeEntityModal}
        entity={entityModalState.entity}
        entityType={entityModalState.entityType}
        books={books}
        myName={ME}
        isMobile={isMobile}
      />
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        books={books}
        onProfileUpdate={() => {
          setProfileTick(prev => prev + 1);
          if (onProfileRefresh) onProfileRefresh();
        }}
      />
      <PublicUserProfileModal
        isOpen={!!selectedPublicUser}
        onClose={() => setSelectedPublicUser(null)}
        targetUser={selectedPublicUser}
      />
      <AnimatePresence>
        {isLoggingOut && (
          <motion.div
            className="premium-logout-overlay"
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="premium-logout-card"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="plc-lottie-container">
                <DotLottieReact
                  src="/assets/empty2.lottie"
                  style={{ width: 160, height: 160, display: 'block' }}
                  loop
                  autoplay
                />
              </div>

              <div className="plc-text-content">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                >
                  Signing Out
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  Safely saving your workspace...
                </motion.p>
              </div>

              <div className="plc-progress-track">
                <motion.div
                  className="plc-progress-bar"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay + Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="mobile-menu-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              className="mobile-sidebar"
              initial={{ x: '100%' }}
              animate={mobileMenuOpen ? { x: 0 } : { x: '100%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="mobile-sidebar-brand">
                <BookOpen size={28} />
                <h1 className="brand-title"><span className="live-brand">MyLibrary</span><span className="live-brand-dot">.</span></h1>
              </div>

              <nav className="mobile-nav-list">
                {(adminViewingUser ? [
                  { id: 'library', label: `${adminViewingUser.display_name?.split(' ')[0] || 'User'}'s Library`, icon: <Library size={20} />, count: books.filter(b => b.status !== "wishlist" && !b.isWishlisted).length },
                  { id: 'wishlist', label: 'Wishlist', icon: <Heart size={20} />, count: books.filter(b => b.status === "wishlist" || b.isWishlisted).length },
                  { id: 'dashboard', label: 'User Dashboard', icon: <LayoutPanelTopIcon size={20} />, count: null },
                  { id: 'profile', label: 'User Profile', icon: <User size={20} />, count: null, action: () => setSelectedPublicUser(adminViewingUser) }
                ] : [
                  { id: 'library', label: 'My Library', icon: <Library size={20} />, count: books.filter(b => b.isWishlisted !== true).length },
                  { id: 'wishlist', label: 'Wishlist', icon: <Heart size={20} />, count: books.filter(b => b.isWishlisted === true).length },
                  { id: 'bin', label: 'Recycle Bin', icon: <Trash2 size={20} />, count: binBooks.length },
                  { id: 'bulk', label: 'Bulk Update', icon: <Layers size={20} />, count: null },
                  { id: 'groups', label: 'Groups', icon: <Network size={20} />, count: null },
                  { id: 'dashboard', label: 'Dashboard', icon: <LayoutPanelTopIcon size={20} />, count: null },
                  { id: 'support', label: 'Support', icon: <LifeBuoy size={20} />, count: null },
                  ...(isAdmin ? [{ id: 'users', label: 'Users', icon: <Users size={20} />, count: null }] : [])
                ]).map((item) => (
                  <button
                    key={item.id}
                    className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        setActiveTab(item.id);
                      }
                      setMobileMenuOpen(false);
                    }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.count !== null && <span className="count-tag">{item.count > 99 ? '99+' : item.count}</span>}
                  </button>
                ))}
              </nav>

              <div className="sidebar-bottom">
                <button onClick={() => {
                  toggleTheme();
                  setMobileMenuOpen(false);
                }} className="mobile-theme-toggle">
                  {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
                  <span>{theme === "light" ? "Dark" : "Light"}</span>
                </button>
              </div>

              <div className="sidebar-status">
                <div className={`status-dot ${isOnline ? "online" : "offline"}`}></div>
                <span>{isOnline ? "Online" : "Offline"}</span>
              </div>

              <div className="sidebar-user">
                <div className="user-avatar" style={{ overflow: 'hidden' }}>
                  {userAvatarUrl ? (
                    <img src={userAvatarUrl} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.email?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="user-info">
                  <span className="user-name" title={user?.profile?.display_name || user?.user_metadata?.display_name || "Account"}>
                    {user?.profile?.display_name || user?.user_metadata?.display_name || "Account"}
                  </span>
                  <span className="user-email" title={user.email}>{user.email}</span>
                </div>
                <button className="logout-btn" onClick={() => setShowProfileModal(true)} title="Profile">
                  <User size={18} />
                </button>
                <button className="logout-btn" onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }} title="Logout">
                  <LogOut size={18} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        {(adminViewingUser ? [
          { id: 'library', label: 'Library', icon: <Library size={20} />, count: books.filter(b => b.status !== "wishlist" && !b.isWishlisted).length },
          { id: 'wishlist', label: 'Wishlist', icon: <Heart size={20} />, count: books.filter(b => b.status === "wishlist" || b.isWishlisted).length },
          { id: 'bulk', label: 'Bulk', icon: <Layers size={20} />, count: null },
          { id: 'groups', label: 'Groups', icon: <Network size={20} />, count: null },
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutPanelTopIcon size={20} />, count: null },
          { id: 'profile', label: 'Profile', icon: <User size={20} />, count: null, action: () => setSelectedPublicUser(adminViewingUser) },
          { id: 'support', label: 'Support', icon: <LifeBuoy size={20} />, count: null }
        ] : [
          { id: 'library', label: 'Library', icon: <Library size={20} />, count: books.filter(b => b.isWishlisted !== true).length },
          { id: 'wishlist', label: 'Wishlist', icon: <Heart size={20} />, count: books.filter(b => b.isWishlisted === true).length },
          { id: 'bin', label: 'Bin', icon: <Trash2 size={20} />, count: binBooks.length },
          { id: 'bulk', label: 'Bulk', icon: <Layers size={20} />, count: null },
          { id: 'groups', label: 'Groups', icon: <Network size={20} />, count: null },
          { id: 'dashboard', label: 'Dashboard', icon: <LayoutPanelTopIcon size={20} />, count: null },
          { id: 'support', label: 'Support', icon: <LifeBuoy size={20} />, count: null },
          ...(isAdmin ? [{ id: 'users', label: 'Users', icon: <Users size={20} />, count: null }] : [])
        ]).map((item) => (
          <button
            key={item.id}
            className={`mobile-nav-btn ${activeTab === item.id ? 'active' : ''} ${item.isFab ? 'fab-btn' : ''}`}
            onClick={() => {
              if (item.action) {
                item.action();
                return;
              }
              if (item.id === 'add') {
                setEditingBook(null);
                setShowForm(true);
              } else if (item.id === 'profile') {
                setShowProfileModal(true);
              } else {
                setActiveTab(item.id);
              }
            }}
          >
            {item.icon}
            {!item.isFab && <span>{item.label}</span>}
            {item.count !== null && (
              <span className="mobile-nav-badge">
                {item.count > 99 ? '99+' : item.count}
              </span>
            )}
            {activeTab === item.id && !item.isFab && (
              <motion.div
                layoutId="mobileActiveTabBackground"
                className="mobile-nav-active-pill"
                transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.6 }}
              />
            )}
            {activeTab === item.id && !item.isFab && (
              <div className="mobile-nav-active-dot" />
            )}
          </button>
        ))}
      </nav>
      {
        showBulkScanner && (
          <BulkAIScanner
            onClose={() => setShowBulkScanner(false)}
            onAddBook={async (bookData) => {
              const isAddingToWishlist = activeTab === "wishlist";
              const ME_UPPER = ME.toUpperCase().trim();
              const activityLog = [];

              if (isAddingToWishlist) {
                activityLog.push({
                  id: Date.now(),
                  type: "wishlist",
                  from: bookData.owner || "Unknown",
                  to: ME_UPPER,
                  timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                  notes: `Added to Wishlist by ${ME}`,
                });
              } else {
                activityLog.push({
                  id: Date.now(),
                  type: "owned",
                  from: bookData.owner || "Unknown",
                  to: ME_UPPER,
                  timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
                  notes: `Added to collection by ${ME}`,
                });
              }

              await addBook({
                ...bookData,
                isWishlisted: isAddingToWishlist,
                activityLog
              });
            }}
            myName={user?.user_metadata?.display_name || user?.email?.split('@')[0]}
            isDuplicateBook={isDuplicateBook}
          />
        )
      }
    </div >
  );
}
