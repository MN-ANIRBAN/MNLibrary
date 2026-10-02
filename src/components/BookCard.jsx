import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, Layers, Edit3, Trash2,
  ChevronDown, ShieldCheck, Heart, AlertCircle, RefreshCcw, ArrowRightLeft, ArrowRightCircle, Clock, Image as ImageIcon, Share2, Send, Bookmark, CheckCircle2
} from "lucide-react";
import ActivityLogModal from "./ActivityLogModal";
import BookImageModal from "./BookImageModal";
import { supabase } from "../supabase/config";
import toast from "react-hot-toast";
import WishlistCard from "./WishlistCard";
import { SendIcon } from "./SendIcon";
import { ArrowLeftRightIcon } from "./ArrowLeftRightIcon";

const STATUS_CONFIG = {
  unread: { label: "To Read", color: "#a78bfa", icon: <Bookmark size={14} /> },
  reading: { label: "Reading", color: "#38bdf8", icon: <BookOpen size={14} /> },
  read: { label: "Finished", color: "#34d399", icon: <CheckCircle2 size={14} /> },
};

export default function BookCard({ book, onEdit, onDelete, onStatusChange, myName, currentUser, isReadOnly, onMarkHandover }) {
  const ME = myName || "ME";
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const statusRef = useRef(null);
  const ownerRef = useRef(null);

  useEffect(() => {
    const closeMenus = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) setShowStatusMenu(false);
      if (ownerRef.current && !ownerRef.current.contains(e.target)) setShowOwnerMenu(false);
    };
    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  const isAdmin = currentUser?.profile?.role === 'admin';
  const owner = (book.owner || "").trim().toUpperCase();
  const custody = (book.custody || "").trim().toUpperCase();
  const myNameUpper = ME.trim().toUpperCase();
  const myEmailPrefixUpper = currentUser?.email?.split('@')[0]?.toUpperCase() || "";

  const isMine = currentUser && book.userId === currentUser.id;
  const isOwnerMine = owner === myNameUpper || owner === myEmailPrefixUpper;
  const isCustodyMine = custody === myNameUpper || custody === myEmailPrefixUpper;

  const isSharedInGroup = Array.isArray(book.shared_users) && book.shared_users.length > 1;
  
  let isAuthorized = false;
  if (isReadOnly) {
    isAuthorized = false;
  } else if (isAdmin) {
    isAuthorized = true;
  } else if (isSharedInGroup) {
    isAuthorized = isOwnerMine;
  } else {
    // If not shared in a group, creator (isMine), owner, or custodian can modify it
    isAuthorized = isOwnerMine || isCustodyMine || isMine;
  }

  const displayOwner = (book.owner || "").split('@')[0];
  const displayCustody = (book.custody || "").split('@')[0];

  const hasOwnershipAction = owner !== custody && owner !== "" && custody !== "";

  const getOwnershipData = () => {
    if (isOwnerMine && !isCustodyMine && custody !== "") {
      return { text: `Lent to ${displayCustody}`, type: 'take-back', icon: <RefreshCcw size={11} />, color: '#f59e0b' };
    }
    if (!isOwnerMine && isCustodyMine && owner !== "") {
      if (book.status === "read") {
        return { text: `Return to ${displayOwner}`, type: 'give-back-read', icon: <AlertCircle size={11} />, color: '#ef4444' };
      }
      return { text: `Borrowed from ${displayOwner}`, type: 'give-back', icon: <AlertCircle size={11} />, color: '#ef4444' };
    }
    if (isOwnerMine && (isCustodyMine || custody === "")) {
      return { text: "In Collection", type: 'mine', icon: <ShieldCheck size={11} />, color: '#0ea5e9' };
    }
    if (!isOwnerMine && owner !== "" && (owner === custody || custody === "")) {
      return { text: `Owned by ${displayOwner}`, type: 'shared', icon: <Share2 size={11} />, color: '#10b981' };
    }
    if (owner !== custody && owner !== "" && custody !== "") {
      return { text: `${displayOwner} → ${displayCustody}`, type: 'take-back', icon: <ArrowRightLeft size={11} />, color: '#f97316' };
    }
    if (isMine) {
      return { text: "In Collection", type: 'mine', icon: <ShieldCheck size={11} />, color: '#0ea5e9' };
    }
    return { text: "Unknown", type: 'mine', icon: <AlertCircle size={11} />, color: '#6b7280' };
  };

  const ownData = getOwnershipData();
  const hasCover = !!book.frontCoverUrl;

  const getOwnershipColors = (type) => {
    switch (type) {
      case 'mine': return { bg: 'rgba(255,255,255,0.9)', border: '#e2e8f0', text: '#0f172a' };
      case 'shared': return { bg: 'rgba(255, 255, 255, 0.9)', border: '#e2e8f0', text: '#0f172a' };
      case 'take-back': return { bg: 'rgba(255, 247, 237, 0.9)', border: '#ffedd5', text: '#c2410c' };
      case 'give-back':
      case 'give-back-read': return { bg: 'rgba(254, 242, 242, 0.9)', border: '#fee2e2', text: '#b91c1c' };
      default: return { bg: 'rgba(255, 255, 255, 0.9)', border: '#e2e8f0', text: '#0f172a' };
    }
  };
  const ownColors = getOwnershipColors((book.status === 'wishlist' || book.isWishlisted === true) ? 'mine' : ownData.type);

  // Compute user-specific reading status
  const getUserStatus = () => {
    if (Array.isArray(book.activityLog)) {
      const userStatusLogs = book.activityLog.filter(log => log.type === 'user_status' && log.by === currentUser.id);
      if (userStatusLogs.length > 0) {
        const latest = userStatusLogs.sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)[0];
        return latest.status;
      }
    }
    if (book.userId === currentUser.id) return book.status || 'unread';
    return 'unread';
  };

  const actualStatus = getUserStatus();
  const currentStatus = STATUS_CONFIG[actualStatus] || STATUS_CONFIG.unread;
  const netPrice = book.price - (book.price * (book.discount || 0) / 100);

  const handleTakeBack = () => {
    if (!hasOwnershipAction) {
      setShowOwnerMenu(false);
      return;
    }
    const newActivity = {
      id: Date.now(),
      type: "returned",
      to: book.owner,
      from: book.custody,
      timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      notes: `Returned to ${displayOwner}`
    };
    const activityLog = [...(book.activityLog || []), newActivity];
    onStatusChange(book.id, { custody: book.owner, activityLog });
    toast.success(`Book returned to ${displayOwner}`);
    setShowOwnerMenu(false);
  };

  const handleRelentAction = (actionType) => {
    if (!hasOwnershipAction) {
      setShowOwnerMenu(false);
      return;
    }
    const activityLog = [...(book.activityLog || [])];

    if (actionType === "received") {
      activityLog.push({
        id: Date.now(),
        type: "received",
        to: ME,
        from: book.custody,
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        notes: `Received back from ${book.custody}`
      });
      onStatusChange(book.id, { custody: ME, activityLog });
      toast.success(`Book received from ${book.custody}`);
    } else if (actionType === "returned") {
      activityLog.push({
        id: Date.now(),
        type: "returned",
        to: book.owner,
        from: book.custody,
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        notes: `Returned directly to ${displayOwner} from ${displayCustody}`
      });
      onStatusChange(book.id, { custody: book.owner, activityLog });
      toast.success(`Book returned to ${displayOwner}`);
    }
    setShowOwnerMenu(false);
  };

  const handleWishlistToggle = () => {
    const nextWishlisted = !(book.isWishlisted === true);
    const activityLog = [...(book.activityLog || [])];

    if (nextWishlisted) {
      activityLog.push({
        id: Date.now(),
        type: "wishlist",
        to: ME,
        from: book.owner || "Unknown",
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        notes: `Added to Wishlist by ${ME}`
      });
    } else {
      activityLog.push({
        id: Date.now(),
        type: "owned",
        to: ME,
        from: book.owner || "Unknown",
        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
        notes: `Added to Collection by ${ME}`
      });
    }

    onStatusChange(book.id, {
      isWishlisted: nextWishlisted,
      activityLog
    });
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}?sharedBookId=${book.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const [isFlipped, setIsFlipped] = useState(false);

  if (book.isWishlisted === true || book.status === "wishlist") {
    return (
      <>
        <WishlistCard
          book={book}
          ownData={ownData}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onEdit={onEdit}
          onImageClick={() => setShowImageModal(true)}
          isReadOnly={isReadOnly}
          isOwnerMine={isOwnerMine}
          isAdmin={isAdmin}
          isAuthorized={isAuthorized}
        />
        {showImageModal && (
          <BookImageModal book={book} onClose={() => setShowImageModal(false)} currentUser={currentUser} />
        )}
      </>
    );
  }

  const isWishlistCard = book.status === 'wishlist' || book.isWishlisted === true;

  return (
    <div
      className={`flip-card-container modern-pro ${ownData.type === 'mine' ? 'owned-book' : ''}`}
      style={{
        height: isWishlistCard ? '293px' : '344px',
        maxWidth: isWishlistCard ? '188px' : '100%',
        margin: '0 auto',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`flip-card-inner ${isFlipped ? "flipped" : ""}`}>

        {/* --- FRONT SIDE --- */}
        <div className={`flip-card-front ${(!book.frontCoverUrl || imageError) ? 'no-cover' : ''}`}>

          {/* Fully Visible Cover Image (Fill/Fit) */}
          {(book.frontCoverUrl && !imageError) ? (
            <img
              src={book.frontCoverUrl}
              alt={book.title}
              className="fc-main-cover"
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
              onLoad={(e) => {
                if (e.target.naturalWidth === 180 && e.target.naturalHeight === 180) {
                  setImageError(true);
                }
              }}
              onClick={() => setShowImageModal(true)}
            />
          ) : (
            <div className="fc-fallback-content" onClick={() => setShowImageModal(true)}>
              <p className="fc-author">{book.author ? `BY ${book.author}` : "SYSTEM LOG"}</p>
              <h2 className="fc-title">{book.title}</h2>
            </div>
          )}

          {/* Top Left: Ownership Status */}
          <div className="fc-pos top-left" ref={ownerRef} onClick={(e) => e.stopPropagation()}>
            <button
              className="corner-pill"
              onClick={() => { if ((isAuthorized || isCustodyMine) && hasOwnershipAction) setShowOwnerMenu(!showOwnerMenu); }}
              style={{ background: ownColors.bg, color: ownColors.text, cursor: ((isAuthorized || isCustodyMine) && hasOwnershipAction) ? 'pointer' : 'default' }}
            >
              {ownData.icon} <span>{ownData.text}</span>
            </button>
            {showOwnerMenu && hasOwnershipAction && (
              <div className="dropdown-menu down-menu">
                {isOwnerMine && !isCustodyMine && (
                  <button onClick={handleTakeBack}><ShieldCheck size={12} /> Received</button>
                )}
                {!isOwnerMine && isCustodyMine && (
                  <button onClick={handleTakeBack}><RefreshCcw size={12} /> Return</button>
                )}
              </div>
            )}
          </div>

          {/* Top Right: Bookmark Actions (Wishlist & Delete) */}
          {!isReadOnly && (
            <div className="fc-bookmark ribbon-right" onClick={(e) => e.stopPropagation()}>
              <button
                className={`ribbon-btn ${book.isWishlisted === true ? "active" : ""}`}
                onClick={handleWishlistToggle}
                title="Toggle Wishlist"
              >
                <Heart size={16} fill={book.isWishlisted === true ? "#f43f5e" : "transparent"} stroke={book.isWishlisted === true ? "#f43f5e" : "#f8fafc"} />
              </button>
              <div className="bookmark-divider"></div>
              <button
                className="ribbon-btn"
                onClick={() => onDelete(book.id)}
                title="Delete Book"
              >
                <Trash2 size={16} stroke="#f8fafc" />
              </button>
            </div>
          )}

          {/* Bottom Left: Reading Status */}
          <div className="fc-pos bottom-left" ref={statusRef} onClick={(e) => e.stopPropagation()}>
            <button
              className={`corner-pill status-pill ${actualStatus || 'unread'}`}
              onClick={() => { if (!isReadOnly) setShowStatusMenu(!showStatusMenu) }}
              style={{ cursor: !isReadOnly ? 'pointer' : 'default' }}
            >
              <div style={{ color: currentStatus.color, display: 'flex', alignItems: 'center' }}>
                {currentStatus.icon}
              </div>
              <span className="status-label" style={{ color: '#f8fafc' }}>{currentStatus.label}</span>
            </button>
            {showStatusMenu && (
              <div className="dropdown-menu up-menu">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => { 
                    const existingLog = Array.isArray(book.activityLog) ? book.activityLog : [];
                    const newLog = [
                      ...existingLog,
                      {
                        id: Date.now(),
                        type: 'user_status',
                        status: key,
                        by: currentUser.id,
                        timestamp: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }
                      }
                    ];
                    const updateData = { activityLog: newLog };
                    if (book.userId === currentUser.id) {
                      updateData.status = key;
                    }
                    onStatusChange(book.id, updateData); 
                    setShowStatusMenu(false); 
                  }}>
                    <div style={{ color: cfg.color, display: 'flex', alignItems: 'center' }}>{cfg.icon}</div>
                    <span>{cfg.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Right: Share & Flip */}
          <div className="fc-pos bottom-right" onClick={(e) => e.stopPropagation()}>
            <button className="bare-icon-btn" onClick={handleShare} title="Share">
              <SendIcon size={22} style={{ color: '#ffffff', filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.8))' }} />
            </button>
            <button className="bare-icon-btn" onClick={() => setIsFlipped(true)} title="Flip">
              <ArrowLeftRightIcon size={22} style={{ color: '#ffffff', filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.8))' }} />
            </button>
          </div>

        </div>


        {/* --- BACK SIDE --- */}
        <div className={`flip-card-back`}>

          {/* Blurred Background Image + Dark Overlay for readability */}
          {hasCover && (
            <img
              src={book.backCoverUrl || book.frontCoverUrl}
              alt="Blurred Back"
              className="fc-back-bg-blur"
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
              onLoad={(e) => {
                if (e.target.naturalWidth === 180 && e.target.naturalHeight === 180) {
                  setImageError(true);
                }
              }}
            />
          )}
          <div className="fc-back-dark-overlay" />

          {/* Content Wrapper (Flex Layout to prevent overlapping) */}
          <div className="fc-back-content-wrapper" onClick={(e) => e.stopPropagation()}>
            {/* Top Middle: Title & Author */}
            <div className="fc-back-header">
              <h3 className="fc-back-title">{book.title}</h3>
              <p className="fc-back-author">{book.author ? `BY ${book.author}` : "SYSTEM LOG"}</p>
            </div>

            {/* Middle: Details Panel (Perfectly Aligned Rows) */}
            <div className="fc-back-middle">
              <div className="fc-back-details-panel">
                <div className="details-row">
                  <div className="detail-box">
                    <span className="box-label">Genre</span>
                    <span className="box-value">{book.genre || "N/A"}</span>
                  </div>
                  <div className="detail-box">
                    <span className="box-label">Pages</span>
                    <span className="box-value">{book.pages || "N/A"}</span>
                  </div>
                </div>
                <div className="details-row no-border">
                  <div className="detail-box">
                    <span className="box-label">Publisher</span>
                    <span className="box-value">{book.publisher || "N/A"}</span>
                  </div>
                  <div className="detail-box">
                    <span className="box-label">Net Price</span>
                    <span className="box-value price-green">₹{netPrice.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Bookmark Actions (Edit & Log) */}
          <div className="fc-bookmark ribbon-right" onClick={(e) => e.stopPropagation()}>
            <button className="ribbon-btn" onClick={() => setShowActivityLog(true)} title="Activity Log">
              <Clock size={16} stroke="#f8fafc" />
            </button>
            {isAuthorized && (
              <>
                <div className="bookmark-divider"></div>
                <button className="ribbon-btn" onClick={() => onEdit(book)} title="Edit Book">
                  <Edit3 size={16} stroke="#f8fafc" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Right: Flip Back */}
          <div className="fc-pos bottom-right" onClick={(e) => e.stopPropagation()}>
            <button className="bare-icon-btn" onClick={() => setIsFlipped(false)} title="Flip Back">
              <ArrowLeftRightIcon size={22} style={{ color: '#ffffff', filter: 'drop-shadow(0px 2px 5px rgba(0,0,0,0.8))' }} />
            </button>
          </div>

        </div>

      </div>

      {/* Modals */}
      {showActivityLog && createPortal(
        <div className="activity-popup-overlay" onClick={() => setShowActivityLog(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ActivityLogModal book={book} onClose={() => setShowActivityLog(false)} />
          </div>
        </div>,
        document.body
      )}

      {showImageModal && (
        <BookImageModal book={book} onClose={() => setShowImageModal(false)} currentUser={currentUser} />
      )}
    </div>
  );
}
