import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BookOpen,
  User,
  Building2,
  Users,
  ArrowRightLeft,
  Tag,
  Clock,
  Search,
  RotateCcw,
  BookMarked,
} from "lucide-react";

import ActivityLogModal from "./ActivityLogModal";

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_META = {
  read:     { color: "#10b981", bg: "rgba(16,185,129,0.12)",  label: "Read"     },
  reading:  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "Reading"  },
  unread:   { color: "#6366f1", bg: "rgba(99,102,241,0.12)", label: "Unread"   },
  wishlist: { color: "#ec4899", bg: "rgba(236,72,153,0.12)", label: "Wishlist" },
};

// ─── Entity metadata ─────────────────────────────────────────────────────────
const ENTITY_CONFIG = {
  author:   { icon: User,            label: "Author",    color: "#6366f1", grad: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
  publisher:{ icon: Building2,       label: "Publisher", color: "#10b981", grad: "linear-gradient(135deg,#10b981,#059669)" },
  genre:    { icon: Tag,             label: "Genre",     color: "#14b8a6", grad: "linear-gradient(135deg,#14b8a6,#0891b2)" },
  lender:   { icon: ArrowRightLeft,  label: "Lender",    color: "#f59e0b", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
  borrower: { icon: Users,           label: "Borrower",  color: "#ef4444", grad: "linear-gradient(135deg,#ef4444,#f97316)" },
  reLender: { icon: BookMarked,      label: "Re-Lender", color: "#ec4899", grad: "linear-gradient(135deg,#ec4899,#f97316)" },
};

const STATUS_CHIPS = [
  { value: "all",      label: "All"      },
  { value: "read",     label: "Read"     },
  { value: "reading",  label: "Reading"  },
  { value: "unread",   label: "Unread"   },
  { value: "wishlist", label: "Wishlist" },
];

const OWNERSHIP_CHIPS = [
  { value: "all",      label: "All"      },
  { value: "owned",    label: "Owned"    },
  { value: "lent",     label: "Lent"     },
  { value: "borrowed", label: "Borrowed" },
];

const SORT_CHIPS = [
  { value: "newest", label: "Newest" },
  { value: "title",  label: "A – Z"  },
  { value: "status", label: "Status" },
];

// ─── Utility ─────────────────────────────────────────────────────────────────
const normalizeKey = (v) =>
  v == null ? "" : String(v).replace(/\s+/g, " ").trim().toUpperCase();

export default function EntityDetailModal({
  isOpen,
  onClose,
  entity,
  entityType,
  books,
  myName = "ANIRBAN ADHIKARY",
  isMobile = false,
}) {
  const [sortBy,           setSortBy]           = useState("newest");
  const [statusFilter,     setStatusFilter]     = useState("all");
  const [ownershipFilter,  setOwnershipFilter]  = useState("all");
  const [searchQuery,      setSearchQuery]      = useState("");
  const [activityBook,     setActivityBook]     = useState(null);
  const [showActivityLog,  setShowActivityLog]  = useState(false);

  // ── Derived constants ──────────────────────────────────────────────────────
  const myNameUpper    = useMemo(() => String(myName   || "").toUpperCase().trim(), [myName]);
  const entityKey      = useMemo(() => normalizeKey(entity?.name),                 [entity]);
  const entityNameUp   = useMemo(() => String(entity?.name || "").toUpperCase().trim(), [entity]);

  // ── 1. Filter by entity type ──────────────────────────────────────────────
  const entityBooks = useMemo(() => {
    if (!entity || !books) return [];
    return books.filter((book) => {
      if (entityType === "author")    return normalizeKey(book.author)    === entityKey;
      if (entityType === "publisher") return normalizeKey(book.publisher) === entityKey;
      if (entityType === "genre")     return normalizeKey(book.genre)     === entityKey;

      const owner   = (book.owner   || "").toUpperCase().trim();
      const custody = (book.custody || "").toUpperCase().trim();

      if (entityType === "lender")
        return owner === entityNameUp && custody === myNameUpper;

      if (entityType === "borrower")
        return owner === myNameUpper && custody === entityNameUp;

      if (entityType === "reLender")
        return (
          owner   !== myNameUpper &&
          custody !== myNameUpper &&
          owner   !== custody &&
          custody === entityNameUp
        );

      return false;
    });
  }, [entity, entityType, books, entityKey, entityNameUp, myNameUpper]);

  // ── 2. Stats (over full entityBooks) ──────────────────────────────────────
  const stats = useMemo(() => {
    const total = entityBooks.length;
    let totalPages = 0, totalPrice = 0;
    let read = 0, reading = 0, unread = 0, wishlist = 0, owned = 0;

    entityBooks.forEach((book) => {
      totalPages  += Number(book.pages) || 0;
      const price  = parseFloat(String(book.price || "").replace(/[^0-9.]/g, "")) || 0;
      totalPrice  += price;

      if (book.status === "read")     read++;
      else if (book.status === "reading")  reading++;
      else if (book.status === "unread")   unread++;
      else if (book.status === "wishlist") wishlist++;

      if ((book.owner || "").toUpperCase().trim() === myNameUpper) owned++;
    });

    return {
      total, read, reading, unread, wishlist, owned,
      avgPages  : total > 0 ? Math.round(totalPages / total) : 0,
      avgPrice  : total > 0 ? Math.round(totalPrice / total) : 0,
      totalPrice: Math.round(totalPrice),
      progress  : total > 0 ? Math.round((read / total) * 100) : 0,
    };
  }, [entityBooks, myNameUpper]);

  // ── 3. Status + Ownership filter ──────────────────────────────────────────
  const filteredByMeta = useMemo(() => {
    return entityBooks
      .filter((book) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "wishlist") return book.status === "wishlist" || book.isWishlisted === true;
        return book.status === statusFilter;
      })
      .filter((book) => {
        if (ownershipFilter === "all") return true;
        const owner   = (book.owner   || "").toUpperCase().trim();
        const custody = (book.custody || "").toUpperCase().trim();

        let kind = "external";
        if (book.isWishlisted === true || book.status === "wishlist") kind = "wishlist";
        else if (owner === myNameUpper && custody === myNameUpper)    kind = "owned";
        else if (owner === myNameUpper && custody !== myNameUpper)    kind = "lent";
        else if (owner !== myNameUpper && custody === myNameUpper)    kind = "borrowed";

        return kind === ownershipFilter;
      });
  }, [entityBooks, statusFilter, ownershipFilter, myNameUpper]);

  // ── 4. Search ─────────────────────────────────────────────────────────────
  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return filteredByMeta;
    return filteredByMeta.filter((book) =>
      (book.title     || "").toUpperCase().includes(q) ||
      (book.author    || "").toUpperCase().includes(q) ||
      (book.publisher || "").toUpperCase().includes(q) ||
      (book.genre     || "").toUpperCase().includes(q)
    );
  }, [filteredByMeta, searchQuery]);

  // ── 5. Sort ───────────────────────────────────────────────────────────────
  const sortedBooks = useMemo(() => {
    const arr = [...filteredBooks];
    if (sortBy === "newest") {
      arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "title") {
      arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "status") {
      const order = { reading: 0, unread: 1, read: 2, wishlist: 3 };
      arr.sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4));
    }
    return arr;
  }, [filteredBooks, sortBy]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const { icon: Icon, label, color, grad } =
    ENTITY_CONFIG[entityType] || ENTITY_CONFIG.author;

  const hasActiveFilters =
    statusFilter !== "all" || ownershipFilter !== "all" || searchQuery !== "";

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setOwnershipFilter("all");
    setSortBy("newest");
  };

  const getOwnershipInfo = (book) => {
    const owner   = (book.owner   || "").toUpperCase().trim();
    const custody = (book.custody || "").toUpperCase().trim();

    if (book.isWishlisted === true || book.status === "wishlist")
      return { label: "Wishlist",       color: "#ec4899", bg: "rgba(236,72,153,0.12)"  };
    if (owner === myNameUpper && custody === myNameUpper)
      return { label: "Owned",          color: "#10b981", bg: "rgba(16,185,129,0.12)"  };
    if (owner === myNameUpper && custody !== myNameUpper)
      return { label: `→ ${custody}`,   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" };
    if (owner !== myNameUpper && custody === myNameUpper)
      return { label: `← ${owner}`,     color: "#6366f1", bg: "rgba(99,102,241,0.12)" };
    return   { label: "External",       color: "#6b7280", bg: "rgba(107,114,128,0.12)"};
  };

  if (!entity || !isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="edm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="edm-card"
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit  ={{ opacity: 0, scale: 0.93, y: 28  }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ══════════════ HEADER ══════════════ */}
            <div className="edm-header">

              {/* Top row: identity + actions */}
              <div className="edm-header-top">
                <div className="edm-identity">
                  <div className="edm-icon-badge" style={{ background: grad }}>
                    <Icon size={20} color="#fff" />
                  </div>
                  <div className="edm-identity-text">
                    <span className="edm-type-label" style={{ color }}>{label}</span>
                    <h2 className="edm-entity-name">{entity.name}</h2>
                  </div>
                </div>

                <div className="edm-header-right">
                  <span className="edm-count-pill">
                    <BookOpen size={12} />
                    {stats.total} {stats.total === 1 ? "book" : "books"}
                  </span>
                  <button className="edm-close-btn" onClick={onClose} aria-label="Close">
                    <X size={17} />
                  </button>
                </div>
              </div>

              {/* Stats strip */}
              <div className="edm-stats-strip">
                <div className="edm-stat">
                  <span className="edm-stat-val" style={{ color: "#10b981" }}>{stats.progress}%</span>
                  <span className="edm-stat-lbl">complete</span>
                </div>
                <span className="edm-strip-sep" />
                <div className="edm-stat">
                  <span className="edm-stat-val" style={{ color: "#10b981" }}>{stats.read}</span>
                  <span className="edm-stat-lbl">read</span>
                </div>
                <span className="edm-strip-sep" />
                <div className="edm-stat">
                  <span className="edm-stat-val" style={{ color: "#f59e0b" }}>{stats.reading}</span>
                  <span className="edm-stat-lbl">reading</span>
                </div>
                <span className="edm-strip-sep" />
                <div className="edm-stat">
                  <span className="edm-stat-val" style={{ color: "#6366f1" }}>
                    {stats.avgPages > 0 ? stats.avgPages : "—"}
                  </span>
                  <span className="edm-stat-lbl">avg pg</span>
                </div>
                <span className="edm-strip-sep" />
                <div className="edm-stat">
                  <span className="edm-stat-val" style={{ color: "#ec4899" }}>
                    {stats.avgPrice > 0 ? `₹${stats.avgPrice}` : "—"}
                  </span>
                  <span className="edm-stat-lbl">avg price</span>
                </div>
              </div>

              {/* Progress track */}
              {stats.total > 0 && (
                <div className="edm-progress-track">
                  <motion.div
                    className="edm-progress-fill"
                    style={{ background: grad }}
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.progress}%` }}
                    transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
                  />
                </div>
              )}
            </div>

            {/* ══════════════ TOOLBAR ══════════════ */}
            <div className="edm-toolbar">

              {/* Search bar */}
              <div className="edm-search-wrap">
                <Search size={14} className="edm-search-icon" />
                <input
                  className="edm-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, author, genre…"
                />
                <AnimatePresence>
                  {searchQuery && (
                    <motion.button
                      className="edm-search-clear"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit   ={{ opacity: 0, scale: 0.6 }}
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={12} />
                    </motion.button>
                  )}
                </AnimatePresence>
                {searchQuery && sortedBooks.length > 0 && (
                  <span className="edm-search-count">{sortedBooks.length}</span>
                )}
              </div>

              {/* Filter chips — row 1: status */}
              <div className="edm-filter-row">
                <span className="edm-filter-label">Status</span>
                <div className="edm-chip-group">
                  {STATUS_CHIPS.map(({ value, label: lbl }) => (
                    <button
                      key={value}
                      className={`edm-chip${statusFilter === value ? " edm-chip--on" : ""}`}
                      style={statusFilter === value
                        ? { "--cc": value === "all" ? color : (STATUS_META[value]?.color || color) }
                        : {}}
                      onClick={() => setStatusFilter(value)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter chips — row 2: ownership + sort + reset */}
              <div className="edm-filter-row edm-filter-row--multi">
                <div className="edm-filter-group">
                  <span className="edm-filter-label">Ownership</span>
                  <div className="edm-chip-group">
                    {OWNERSHIP_CHIPS.map(({ value, label: lbl }) => (
                      <button
                        key={value}
                        className={`edm-chip${ownershipFilter === value ? " edm-chip--on" : ""}`}
                        style={ownershipFilter === value ? { "--cc": color } : {}}
                        onClick={() => setOwnershipFilter(value)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="edm-filter-group">
                  <span className="edm-filter-label">Sort</span>
                  <div className="edm-chip-group">
                    {SORT_CHIPS.map(({ value, label: lbl }) => (
                      <button
                        key={value}
                        className={`edm-chip${sortBy === value ? " edm-chip--on" : ""}`}
                        style={sortBy === value ? { "--cc": color } : {}}
                        onClick={() => setSortBy(value)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.button
                      className="edm-reset-btn"
                      initial={{ opacity: 0, scale: 0.8, x: 8 }}
                      animate={{ opacity: 1, scale: 1,   x: 0 }}
                      exit   ={{ opacity: 0, scale: 0.8, x: 8 }}
                      onClick={resetFilters}
                      title="Reset all filters"
                    >
                      <RotateCcw size={12} />
                      Reset
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ══════════════ BODY ══════════════ */}
            <div className="edm-body">

              {/* Results label */}
              {sortedBooks.length > 0 && (
                <div className="edm-results-bar">
                  <span className="edm-results-text">
                    {sortedBooks.length === stats.total
                      ? `${stats.total} books`
                      : `${sortedBooks.length} of ${stats.total} books`}
                  </span>
                  {sortBy !== "newest" && (
                    <span className="edm-sort-tag">
                      {sortBy === "title" ? "A – Z" : "By Status"}
                    </span>
                  )}
                </div>
              )}

              {/* Empty state */}
              {sortedBooks.length === 0 ? (
                <motion.div
                  className="edm-empty"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0  }}
                >
                  <div className="edm-empty-icon-wrap">
                    <BookOpen size={32} />
                  </div>
                  <h3 className="edm-empty-title">No books found</h3>
                  <p className="edm-empty-sub">
                    {hasActiveFilters
                      ? "Try adjusting your search or filters."
                      : `No books linked to this ${label.toLowerCase()} yet.`}
                  </p>
                  {hasActiveFilters && (
                    <button className="edm-empty-reset" onClick={resetFilters}>
                      <RotateCcw size={13} />
                      Clear filters
                    </button>
                  )}
                </motion.div>
              ) : (
                /* Book list */
                <div className="edm-book-list">
                  {sortedBooks.map((book, idx) => {
                    const ownership  = getOwnershipInfo(book);
                    const statusMeta = STATUS_META[book.status] ||
                      { color: "#6b7280", bg: "rgba(107,114,128,0.12)", label: book.status || "—" };

                    return (
                      <motion.div
                        key={book.id || idx}
                        className="edm-book-card"
                        initial={{ opacity: 0, x: -14 }}
                        animate={{ opacity: 1, x: 0   }}
                        transition={{ delay: Math.min(idx * 0.028, 0.32), ease: "easeOut" }}
                      >
                        {/* Accent bar (color = reading status) */}
                        <div
                          className="edm-card-accent"
                          style={{ background: statusMeta.color }}
                        />

                        {/* Card content */}
                        <div className="edm-card-content">
                          <div className="edm-card-top">
                            <h4 className="edm-book-title" title={book.title}>
                              {book.title || "Untitled"}
                            </h4>
                            <p className="edm-book-meta">
                              {[book.author, book.publisher, book.genre]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>

                          <div className="edm-card-bottom">
                            <div className="edm-badge-row">
                              {/* Status badge */}
                              <span
                                className="edm-badge"
                                style={{ color: statusMeta.color, background: statusMeta.bg }}
                              >
                                <span
                                  className="edm-badge-dot"
                                  style={{ background: statusMeta.color }}
                                />
                                {statusMeta.label}
                              </span>

                              {/* Ownership badge */}
                              <span
                                className="edm-badge"
                                style={{ color: ownership.color, background: ownership.bg }}
                                title={ownership.label}
                              >
                                {ownership.label.length > 22
                                  ? ownership.label.slice(0, 20) + "…"
                                  : ownership.label}
                              </span>

                              {/* Pages badge */}
                              {book.pages && (
                                <span className="edm-badge edm-badge--muted">
                                  {book.pages} pg
                                </span>
                              )}
                            </div>

                            {/* Activity log */}
                            <button
                              className="edm-activity-btn"
                              title="View activity log"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivityBook(book);
                                setShowActivityLog(true);
                              }}
                            >
                              <Clock size={13} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Activity Log sub-modal ── */}
          <AnimatePresence>
            {showActivityLog && activityBook && (
              <motion.div
                className="edm-activity-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setShowActivityLog(false); setActivityBook(null); }}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <ActivityLogModal
                    book={activityBook}
                    onClose={() => { setShowActivityLog(false); setActivityBook(null); }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
