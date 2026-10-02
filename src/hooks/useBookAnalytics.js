import { useMemo } from "react";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const normalizeKey = (v) => {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim().toUpperCase();
};

const parseDate = (raw) => {
  if (!raw) return null;
  const d = raw.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const toMonthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const toMonthLabel = (d) =>
  d.toLocaleString("default", { month: "short", year: "2-digit" });

/**
 * Acquisition date priority:
 *  1. Latest 'owned'/'acquired' log in activityLog
 *  2. updatedAt if different month from createdAt (legacy wishlist)
 *  3. createdAt
 */
const getAcquisitionDate = (b) => {
  if (b.activityLog && Array.isArray(b.activityLog) && b.activityLog.length > 0) {
    const ownedLogs = b.activityLog.filter(
      (log) => log.type === "owned" || log.type === "acquired"
    );
    if (ownedLogs.length > 0) {
      const latest = ownedLogs.reduce((best, log) => {
        const t = log.timestamp?.seconds ?? 0;
        return t > (best.timestamp?.seconds ?? 0) ? log : best;
      }, ownedLogs[0]);
      const d = parseDate(latest.timestamp);
      if (d) return d;
    }
  }
  const created = parseDate(b.createdAt);
  return created || new Date();
};

const getFinishedDate = (b) => {
  if (b.activityLog && Array.isArray(b.activityLog)) {
    const readLogs = b.activityLog.filter(log => log.type === 'read' || log.status === 'read');
    if (readLogs.length > 0) {
      const latestLog = readLogs.reduce((latest, current) => {
        const latestTime = latest.timestamp?.seconds || 0;
        const currentTime = current.timestamp?.seconds || 0;
        return currentTime > latestTime ? current : latest;
      });
      const d = parseDate(latestLog.timestamp);
      if (d) return d;
    }
  }
  // Fallback for legacy data
  return getAcquisitionDate(b);
};

/**
 * Get the date a book was lent out (most recent 'lent' or 're-lent' log).
 * Returns null if not found.
 */
const getLentDate = (b) => {
  if (!b.activityLog || !Array.isArray(b.activityLog)) return null;
  const lentLogs = b.activityLog.filter((log) => log.type === "lent" || log.type === "re-lent");
  if (lentLogs.length === 0) return null;
  const latest = lentLogs.reduce((best, log) => {
    const t = log.timestamp?.seconds ?? 0;
    return t > (best.timestamp?.seconds ?? 0) ? log : best;
  }, lentLogs[0]);
  return parseDate(latest.timestamp);
};

/**
 * Get the date a book was returned to me (most recent 'returned' log where custody becomes mine).
 */
const getReturnedToMeDate = (b, currentUser) => {
  if (!b.activityLog || !Array.isArray(b.activityLog)) return null;
  const returnLogs = b.activityLog.filter(
    (log) => log.type === "returned" && log.to?.toUpperCase().includes(currentUser.toUpperCase().split(" ")[0])
  );
  if (returnLogs.length === 0) return null;
  const latest = returnLogs.reduce((best, log) => {
    const t = log.timestamp?.seconds ?? 0;
    return t > (best.timestamp?.seconds ?? 0) ? log : best;
  }, returnLogs[0]);
  return parseDate(latest.timestamp);
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const buildWeeklyHeatmap = (weeklyBuckets) => {
  const weeks = [];
  const now = new Date();
  const current = getWeekStart(now);
  for (let i = 51; i >= 0; i--) {
    const weekDate = new Date(current);
    weekDate.setDate(weekDate.getDate() - i * 7);
    const key = weekDate.toISOString().split("T")[0];
    const weekData = weeklyBuckets[key] || { count: 0, books: [], readCount: 0, readBooks: [] };
    weeks.push({
      week: key,
      count: weekData.count || 0,
      readCount: weekData.readCount || 0,
      books: weekData.books || [],
      readBooks: weekData.readBooks || [],
      monthLabel: weekDate.toLocaleString("default", { month: "short" }),
      weekIndex: 51 - i,
    });
  }
  return weeks;
};

// ─── EMPTY MONTH TEMPLATE ────────────────────────────────────────────────────

const emptyMonth = (name, timestamp) => ({
  name,
  timestamp,

  // ── Bought ──
  bought: 0,
  boughtBooks: [],
  boughtRead: 0,
  boughtReading: 0,
  boughtUnread: 0,
  boughtMrp: 0,
  boughtSpent: 0,
  boughtSaved: 0,
  boughtDiscounts: [],
  boughtAvgDiscount: 0,
  boughtPages: 0,          // total pages of OWNED read books acquired this month
  topDiscountBook: null,

  // ── Borrowed ──
  borrowed: 0,
  borrowedBooks: [],
  borrowedRead: 0,
  borrowedReading: 0,
  borrowedUnread: 0,

  // ── Lent ──
  lent: 0,
  lentBooks: [],
  lentRead: 0,
  lentReading: 0,
  lentUnread: 0,

  // ── Re-Lent ──
  reLent: 0,
  reLentBooks: [],
  reLentRead: 0,
  reLentReading: 0,
  reLentUnread: 0,

  // ── Returns ──
  returnedToMe: 0,
  returnedToMeBooks: [],

  // ── Chart aliases ──
  spent: 0,
  read: 0,
  readBooks: [],
  unread: 0,
  unreadBooks: [],
  reading: 0,
  readingBooks: [],
  returned: 0,
  returnedBooksList: [],

  // ── Derived (computed after loop) ──
  completionRate: 0,       // % of acquired books that are 'read'
  totalPages: 0,           // pages across all books acquired this month
});

// ─── MAIN HOOK ───────────────────────────────────────────────────────────────

export const useBookAnalytics = (books, currentUser = "ANIRBAN ADHIKARY") => {
  return useMemo(() => {
    // ── Global accumulators ───────────────────────────────────────────────────
    let read = 0, reading = 0, unread = 0;
    let totalSpent = 0, totalMrp = 0, totalPages = 0;
    let totalPagesRead = 0;    // pages of books with status === 'read'
    let borrowedTotal = 0, lentToOthers = 0, returnedBooks = 0, reLent = 0;
    let myOwnedBooksCount = 0, wishlistCount = 0;
    let borrowedRead = 0, borrowedUnread = 0, borrowedReading = 0;
    let lentRead = 0, lentUnread = 0, lentReading = 0;
    let ownRead = 0, ownUnread = 0, ownReading = 0;

    // Price distribution buckets
    const priceBuckets = { under200: 0, under500: 0, above500: 0 };

    // Publication year distribution
    const pubYears = {};

    // Longest / shortest
    let longestBook = null;
    let shortestBook = null;

    const genres = {};
    const authors = {};
    const publishers = {};
    const lenders = {};
    const borrowers = {};
    const topReLenders = {};
    const publisherDiscountMap = {};

    const monthlyStats = {};
    const monthlyReadCount = {};
    const weeklyBuckets = {};
    const finishedBooks = [];
    const monthsWithReads = new Set();

    const now = new Date();
    const currentMonth = toMonthKey(now);
    const currentYear = now.getFullYear();
    let thisYearRead = 0, currentMonthRead = 0;
    const currentMonthFinishedBooks = [];

    // ── Main Loop ─────────────────────────────────────────────────────────────
    books.forEach((b) => {
      const ownerName = (b.owner || "").toUpperCase().trim();
      const custodyName = (b.custody || "").toUpperCase().trim();

      const isWishlist = b.status === "wishlist" || b.isWishlisted === true;
      const isBorrowed = ownerName !== currentUser && custodyName === currentUser;
      const isLent = ownerName === currentUser && custodyName !== currentUser;
      const isReturned = ownerName === custodyName && ownerName !== "" && !isWishlist;
      const isOwned = ownerName === currentUser;
      const isReLent = ownerName !== currentUser && custodyName !== currentUser &&
        ownerName !== custodyName && !isWishlist;

      if (isWishlist) { wishlistCount++; return; }

      const pages = Number(b.pages) || 0;
      const price = parseFloat(b.price?.toString().replace(/[^0-9.]/g, "") || 0);
      const discount = parseFloat(b.discount || 0);
      const netPrice = price - price * (discount / 100);
      const saved = price - netPrice;

      // ── Status counters ─────────────────────────────────────────────────────
      if (isBorrowed) {
        borrowedTotal++;
        if (b.status === "read") borrowedRead++;
        else if (b.status === "reading") borrowedReading++;
        else borrowedUnread++;
      }
      if (isLent) {
        lentToOthers++;
        if (b.status === "read") lentRead++;
        else if (b.status === "reading") lentReading++;
        else lentUnread++;
      }
      if (isReturned) returnedBooks++;
      if (isReLent) reLent++;
      if (isOwned) {
        myOwnedBooksCount++;
        if (b.status === "read") ownRead++;
        else if (b.status === "reading") ownReading++;
        else ownUnread++;
      }

      if (b.status === "read") read++;
      else if (b.status === "reading") reading++;
      else if (b.status === "unread") unread++;

      // ── Financials ──────────────────────────────────────────────────────────
      if (isOwned) {
        totalMrp += price;
        totalSpent += netPrice;

        // Price buckets
        if (price > 0) {
          if (netPrice <= 200) priceBuckets.under200++;
          else if (netPrice <= 500) priceBuckets.under500++;
          else priceBuckets.above500++;
        }
      }

      // ── Pages ───────────────────────────────────────────────────────────────
      totalPages += pages;
      if (b.status === "read") {
        totalPagesRead += pages;
        // Longest / shortest read books
        if (!longestBook || pages > (Number(longestBook.pages) || 0)) longestBook = b;
        if (!shortestBook || (pages > 0 && pages < (Number(shortestBook.pages) || Infinity))) shortestBook = b;
      }

      // ── Publication year ────────────────────────────────────────────────────
      const pubYear = parseInt(b.year);
      if (!isNaN(pubYear) && pubYear > 1800 && pubYear <= currentYear) {
        pubYears[pubYear] = (pubYears[pubYear] || 0) + 1;
      }

      // ── Collections ─────────────────────────────────────────────────────────
      if (b.genre) genres[b.genre] = (genres[b.genre] || 0) + 1;

      if (b.author) {
        const key = normalizeKey(b.author);
        if (key) {
          const curr = authors[key] || { name: String(b.author).trim(), value: 0 };
          curr.name = String(b.author).trim(); curr.value += 1;
          authors[key] = curr;
        }
      }
      if (b.publisher) {
        const key = normalizeKey(b.publisher);
        if (key) {
          const curr = publishers[key] || { name: String(b.publisher).trim(), value: 0 };
          curr.name = String(b.publisher).trim(); curr.value += 1;
          publishers[key] = curr;

          if (isOwned && price > 0) {
            if (!publisherDiscountMap[key]) {
              publisherDiscountMap[key] = { name: String(b.publisher).trim(), discounts: [], totalSpent: 0, totalSaved: 0, bookCount: 0 };
            }
            publisherDiscountMap[key].discounts.push(discount);
            publisherDiscountMap[key].totalSpent += netPrice;
            publisherDiscountMap[key].totalSaved += saved;
            publisherDiscountMap[key].bookCount += 1;
          }
        }
      }

      // ── Lender / Borrower maps ──────────────────────────────────────────────
      if (isBorrowed && ownerName) {
        const curr = lenders[ownerName] || { name: ownerName, value: 0, read: 0, reading: 0, unread: 0 };
        curr.value += 1;
        if (b.status === "read") curr.read++;
        else if (b.status === "reading") curr.reading++;
        else curr.unread++;
        lenders[ownerName] = curr;
      }
      if (isLent && custodyName) {
        const curr = borrowers[custodyName] || { name: custodyName, value: 0, read: 0, reading: 0, unread: 0 };
        curr.value += 1;
        if (b.status === "read") curr.read++;
        else if (b.status === "reading") curr.reading++;
        else curr.unread++;
        borrowers[custodyName] = curr;
      }
      if (isReLent && custodyName) {
        topReLenders[custodyName] = topReLenders[custodyName] || { name: custodyName, value: 0 };
        topReLenders[custodyName].value += 1;
      }

      // ── Monthly Stats ───────────────────────────────────────────────────────
      const acquisitionDate = getAcquisitionDate(b);
      const monthKey = toMonthKey(acquisitionDate);
      const monthLabel = toMonthLabel(acquisitionDate);
      const timestamp = new Date(acquisitionDate.getFullYear(), acquisitionDate.getMonth(), 1).getTime();

      if (!monthlyStats[monthKey]) monthlyStats[monthKey] = emptyMonth(monthLabel, timestamp);
      const ms = monthlyStats[monthKey];

      ms.totalPages += pages;

      if (isOwned) {
        ms.bought++;
        ms.boughtBooks.push(b);
        ms.boughtMrp += price;
        ms.boughtSpent += netPrice;
        ms.boughtSaved += saved;
        ms.spent += netPrice;
        if (price > 0) ms.boughtDiscounts.push(discount);

        if (b.status === "read") { ms.boughtRead++; ms.boughtPages += pages; }
        else if (b.status === "reading") ms.boughtReading++;
        else ms.boughtUnread++;

        if (!ms.topDiscountBook || discount > (ms.topDiscountBook.discountPct || 0)) {
          ms.topDiscountBook = { title: b.title, author: b.author, discountPct: discount, saved: Math.round(saved), price: Math.round(netPrice) };
        }
      }

      if (isBorrowed) {
        ms.borrowed++;
        ms.borrowedBooks.push(b);
        if (b.status === "read") ms.borrowedRead++;
        else if (b.status === "reading") ms.borrowedReading++;
        else ms.borrowedUnread++;
      }

      if (b.status === "read") { ms.read++; ms.readBooks.push(b); }
      if (b.status === "unread") { ms.unread++; ms.unreadBooks.push(b); }
      if (b.status === "reading") { ms.reading++; ms.readingBooks.push(b); }
      if (isReturned) { ms.returned++; ms.returnedBooksList.push(b); }

      // ── Lent tracking (by lent date, not acquisition date) ──────────────────
      if (isLent) {
        const lentDate = getLentDate(b);
        if (lentDate) {
          const lk = toMonthKey(lentDate);
          if (!monthlyStats[lk]) monthlyStats[lk] = emptyMonth(toMonthLabel(lentDate), new Date(lentDate.getFullYear(), lentDate.getMonth(), 1).getTime());
          monthlyStats[lk].lent++;
          monthlyStats[lk].lentBooks.push(b);
          if (b.status === "read") monthlyStats[lk].lentRead++;
          else if (b.status === "reading") monthlyStats[lk].lentReading++;
          else monthlyStats[lk].lentUnread++;
        }
      }

      // ── Re-Lent tracking ───────────────────────────────────────────────────
      if (isReLent) {
        const lentDate = getLentDate(b);
        if (lentDate) {
          const rk = toMonthKey(lentDate);
          if (!monthlyStats[rk]) monthlyStats[rk] = emptyMonth(toMonthLabel(lentDate), new Date(lentDate.getFullYear(), lentDate.getMonth(), 1).getTime());
          monthlyStats[rk].reLent++;
          monthlyStats[rk].reLentBooks.push(b);
          if (b.status === "read") monthlyStats[rk].reLentRead++;
          else if (b.status === "reading") monthlyStats[rk].reLentReading++;
          else monthlyStats[rk].reLentUnread++;
        }
      }

      // ── Return-to-me tracking ────────────────────────────────────────────────
      if (isOwned && isReturned) {
        const retDate = getReturnedToMeDate(b, currentUser);
        if (retDate) {
          const rk = toMonthKey(retDate);
          if (!monthlyStats[rk]) monthlyStats[rk] = emptyMonth(toMonthLabel(retDate), new Date(retDate.getFullYear(), retDate.getMonth(), 1).getTime());
          monthlyStats[rk].returnedToMe++;
          monthlyStats[rk].returnedToMeBooks.push(b);
        }
      }

      // ── Read tracking (month-level) ─────────────────────────────────────────
      if (b.status === "read") {
        const finishedDate = getFinishedDate(b);
        const finishedMonthKey = toMonthKey(finishedDate);
        monthlyReadCount[finishedMonthKey] = (monthlyReadCount[finishedMonthKey] || 0) + 1;
        monthsWithReads.add(finishedMonthKey);
        if (finishedMonthKey === currentMonth) {
          currentMonthRead++;
          currentMonthFinishedBooks.push({ ...b, _finishedDate: finishedDate });
        }
        if (finishedDate.getFullYear() === currentYear) thisYearRead++;
        finishedBooks.push({ ...b, _finishedDate: finishedDate });
      }

      // ── Weekly heatmap ──────────────────────────────────────────────────────
      const weekStart = getWeekStart(acquisitionDate);
      const weekKey = weekStart.toISOString().split("T")[0];
      if (!weeklyBuckets[weekKey]) weeklyBuckets[weekKey] = { count: 0, books: [], readCount: 0, readBooks: [] };
      weeklyBuckets[weekKey].count++;
      weeklyBuckets[weekKey].books.push(b);

      if (b.status === "read") {
        const finishedDate = getFinishedDate(b);
        const fWeekStart = getWeekStart(finishedDate);
        const fWeekKey = fWeekStart.toISOString().split("T")[0];
        if (!weeklyBuckets[fWeekKey]) weeklyBuckets[fWeekKey] = { count: 0, books: [], readCount: 0, readBooks: [] };
        weeklyBuckets[fWeekKey].readCount = (weeklyBuckets[fWeekKey].readCount || 0) + 1;
        if (!weeklyBuckets[fWeekKey].readBooks) weeklyBuckets[fWeekKey].readBooks = [];
        weeklyBuckets[fWeekKey].readBooks.push(b);
      }
    });

    // ── Post-processing ───────────────────────────────────────────────────────

    // Finalize per-month derived fields
    Object.values(monthlyStats).forEach((ms) => {
      ms.boughtAvgDiscount = ms.boughtDiscounts.length > 0
        ? parseFloat((ms.boughtDiscounts.reduce((a, b) => a + b, 0) / ms.boughtDiscounts.length).toFixed(1))
        : 0;
      const totalAcquired = ms.bought + ms.borrowed;
      ms.completionRate = totalAcquired > 0 ? Math.round(((ms.boughtRead + ms.borrowedRead) / totalAcquired) * 100) : 0;
    });

    // Global derived
    const totalSaved = totalMrp - totalSpent;
    const avgPrice = myOwnedBooksCount > 0 ? (totalSpent / myOwnedBooksCount).toFixed(2) : 0;
    const avgDiscount = totalMrp > 0 ? ((totalSaved / totalMrp) * 100).toFixed(1) : 0;
    const progress = (read + reading + unread) > 0 ? Math.round((read / (read + reading + unread)) * 100) : 0;
    const total = books.length;
    const activeBooks = borrowedTotal + lentToOthers;

    const avgPagesPerReadBook = read > 0 ? Math.round(totalPagesRead / read) : 0;
    const overallCompletionRate = (read + reading + unread) > 0
      ? Math.round((read / (read + reading + unread)) * 100) : 0;

    // Sort helpers
    const sortData = (obj) => Object.values(obj).sort((a, b) => b.value - a.value);
    const sortEntries = (obj) =>
      Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const topGenresSorted = sortEntries(genres);
    const topAuthorsSorted = sortData(authors);
    const topPublishersSorted = sortData(publishers);
    const topLendersSorted = sortData(lenders);
    const topBorrowersSorted = sortData(borrowers);
    const topReLendersSorted = sortData(topReLenders);

    // Publisher discount leaderboard
    const publisherDiscountLeaderboard = Object.values(publisherDiscountMap)
      .filter((p) => p.bookCount > 0)
      .map((p) => ({
        name: p.name, bookCount: p.bookCount,
        avgDiscount: p.discounts.length > 0
          ? parseFloat((p.discounts.reduce((a, b) => a + b, 0) / p.discounts.length).toFixed(1)) : 0,
        totalSaved: Math.round(p.totalSaved),
        totalSpent: Math.round(p.totalSpent),
      }))
      .sort((a, b) => b.avgDiscount - a.avgDiscount);

    // Publication year distribution (chart-ready, last 30 years)
    const pubYearData = Object.entries(pubYears)
      .map(([year, count]) => ({ name: year, value: count }))
      .sort((a, b) => a.name - b.name)
      .slice(-30);

    // Price distribution chart data
    const priceDistribution = [
      { name: "≤ ₹200", value: priceBuckets.under200 },
      { name: "₹201–₹500", value: priceBuckets.under500 },
      { name: "> ₹500", value: priceBuckets.above500 },
    ].filter((d) => d.value > 0);

    // Monthly data for charts (last 24 months)
    const monthlyData = Object.values(monthlyStats)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-24);

    // Monthly snapshot — 6 most recent months with any activity
    const monthlySnapshot = [...monthlyData]
      .filter((m) => m.bought + m.borrowed > 0)
      .reverse()
      .slice(0, 6);

    // Top months
    const sortedByBought = [...monthlyData].sort((a, b) => b.bought - a.bought);
    const sortedByRead = [...monthlyData].sort((a, b) => b.read - a.read);
    const sortedBySpent = [...monthlyData].sort((a, b) => b.spent - a.spent);
    const topMonthByBought = sortedByBought[0] || null;
    const topMonthByRead = sortedByRead[0] || null;
    const topMonthBySpent = sortedBySpent[0] || null;

    // Reading streak
    let readingStreak = 0;
    const tempDate = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 24; i++) {
      const ym = toMonthKey(tempDate);
      if (monthsWithReads.has(ym)) { readingStreak++; tempDate.setMonth(tempDate.getMonth() - 1); }
      else break;
    }

    const monthKeys = Object.keys(monthlyReadCount);
    const booksPerMonth = monthKeys.length > 0
      ? (monthKeys.reduce((s, k) => s + monthlyReadCount[k], 0) / monthKeys.length).toFixed(1)
      : "0";

    const monthlyGoalTarget = 5;
    const readingGoalProgress = Math.min(100, Math.round((currentMonthRead / monthlyGoalTarget) * 100));
    const weeklyHeatmap = buildWeeklyHeatmap(weeklyBuckets);

    const recentlyFinished = finishedBooks
      .sort((a, b) => (b._finishedDate?.getTime() || 0) - (a._finishedDate?.getTime() || 0))
      .slice(0, 5)
      .map((b) => ({ title: b.title, author: b.author, date: b._finishedDate }));

    const currentMonthData = monthlyStats[currentMonth] || emptyMonth("", 0);
    const currentMonthReadingGoal = {
      ...emptyMonth(toMonthLabel(now), new Date(now.getFullYear(), now.getMonth(), 1).getTime()),
      name: toMonthLabel(now),
      read: currentMonthRead,
      readBooks: currentMonthFinishedBooks,
      _view: "readingGoal",
    };
    const thisMonthBought = currentMonthData.bought;
    const thisMonthSpent = currentMonthData.boughtSpent;

    return {
      // ── Totals ──
      total, read, reading, unread,
      totalSpent, totalMrp, totalSaved,
      avgPrice, avgDiscount, totalPages, totalPagesRead,
      avgPagesPerReadBook, overallCompletionRate,
      progress,
      wishlistCount,
      myBooksCount: myOwnedBooksCount,
      borrowedTotal, lentToOthers, returnedBooks, reLent, activeBooks,
      lendersCount: Object.keys(lenders).length,
      borrowersCount: Object.keys(borrowers).length,

      // ── Borrowed/Lent pipeline ──
      borrowedRead, borrowedReading, borrowedUnread,
      lentRead, lentReading, lentUnread,
      ownRead, ownReading, ownUnread,

      // ── Longest / Shortest ──
      longestBook: longestBook ? { title: longestBook.title, author: longestBook.author, pages: Number(longestBook.pages) } : null,
      shortestBook: shortestBook ? { title: shortestBook.title, author: shortestBook.author, pages: Number(shortestBook.pages) } : null,

      // ── Price distribution ──
      priceDistribution,
      priceBuckets,

      // ── Publication year distribution ──
      pubYearData,

      // ── Leaderboards ──
      topGenres: topGenresSorted.slice(0, 10),
      topAuthors: topAuthorsSorted.slice(0, 10),
      topPublishers: topPublishersSorted.slice(0, 10),
      topLenders: topLendersSorted.slice(0, 10),
      topBorrowers: topBorrowersSorted.slice(0, 10),
      topReLenders: topReLendersSorted.slice(0, 6),
      publisherDiscountLeaderboard: publisherDiscountLeaderboard.slice(0, 10),

      // ── Favorites ──
      favoriteGenre: topGenresSorted[0]?.name || "No Data",
      topAuthor: topAuthorsSorted[0]?.name || "No Data",
      topPublisher: topPublishersSorted[0]?.name || "No Data",

      // ── Monthly data ──
      monthlyData,
      monthlySnapshot,
      topMonthByBought,
      topMonthByRead,
      topMonthBySpent,

      // ── Current month ──
      currentMonthData, currentMonthReadingGoal, currentMonthRead, thisMonthBought, thisMonthSpent,

      // ── Streaks & goals ──
      readingStreak, booksPerMonth, thisYearRead,
      readingGoalProgress, monthlyGoalTarget,

      // ── Heatmap & recent ──
      weeklyHeatmap, recentlyFinished,
    };
  }, [books, currentUser]);
};