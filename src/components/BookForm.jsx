import { useState, useEffect, useCallback, useRef } from "react";
// import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  X, Book, User, Tag, Home, Calendar,
  DollarSign, Percent, Shield, MapPin, Edit3,
  CheckCircle2, UserCheck, Hash, ScanLine, FileText, Loader2, ExternalLink, Image as ImageIcon, Trash2, Sparkles
} from "lucide-react";
import { Reorder } from "framer-motion";
import ISBNBarcodeScanner from "./ISBNBarcodeScanner";
import ImageUploadControl from "./ImageUploadControl";
import CustomDropdown from "./CustomDropdown";
import ConfirmDialog from "./ConfirmDialog";
import toast from "react-hot-toast";
import { sanitizeData } from "../utils/sanitize";
import { validateBookForm } from "../utils/validation";
import { useDebounce } from "../hooks/useDebounce";

// If you want to cover all bases, these are the final "missing" niches:
const GENRES = [
  "Academic",
  "Adventure",
  "Biography",
  "Business",
  "Contemporary",
  "Crime",
  "Dark Fantasy",
  "Detective",
  "Dystopian", // New: Very popular for YA/Sci-Fi
  "Fantasy",
  "Fiction",
  "Graphic Novel",
  "Historical Fiction",
  "Horror",
  "Informative",
  "Kids / Children", // New: Essential if the library grows
  "Mystery",
  "Mythology",
  "Non-Fiction",
  "Poetry",
  "Romance",
  "Science Fiction",
  "Self-Help",
  "Suspense",
  "Spy Thriller",
  "Technology",
  "Thriller",
  "Other"
];

// --- Bengali Translation Helper ---
// Uses Google Translate free endpoint for transliteration/translation
const translateToBengali = async (text) => {
  if (!text || !text.trim()) return "";
  const cleanText = text.split("||")[0].trim(); // Remove existing translation if any
  if (!cleanText) return "";
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=bn&dt=t&q=${encodeURIComponent(cleanText)}`
    );
    const data = await res.json();
    if (data && data[0]) {
      // Safely join all translated chunks
      return data[0].map(chunk => chunk[0]).join("");
    }
    return "";
  } catch (err) {
    console.warn("Translation error:", err);
    return "";
  }
};

// Format as "ENGLISH || বাংলা"
const makeBilingual = async (englishText) => {
  if (!englishText || !englishText.trim()) return englishText;
  // Already has bilingual format — re-translate the English part
  const english = englishText.split("||")[0].trim();
  if (!english) return englishText;
  const bengali = await translateToBengali(english);
  if (bengali && bengali.trim() && bengali.trim().toLowerCase() !== english.toLowerCase()) {
    return `${english} || ${bengali}`.toUpperCase();
  }
  return english.toUpperCase();
};

export default function BookForm({ book, onSubmit, onClose, myName, groupPartners = [], isAdmin = false }) {
  const [form, setForm] = useState({
    ownership: book?.ownership || "mine",
    status: book?.status || "unread",
    title: book?.title || "",
    author: book?.author || "",
    genre: book?.genre || "Other",
    pages: book?.pages || "",
    isbn: book?.isbn || "",
    publisher: book?.publisher || "",
    year: book?.year || "",
    price: book?.price || "",
    discount: book?.discount || "0",
    owner: book?.owner || myName || "",
    custody: book?.custody || myName || "",
    notes: book?.notes || "",
    description: book?.description || "",
    images: book?.images || [book?.frontCoverUrl || book?.coverUrl, book?.backCoverUrl, ...(book?.extraImages || [])].filter(Boolean)
  });

  const initialFormRef = useRef(form);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClose = () => {
    const isChanged = JSON.stringify(form) !== JSON.stringify(initialFormRef.current);
    if (isChanged) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };


  const [showCustomOwner, setShowCustomOwner] = useState(false);
  const [showCustomCustody, setShowCustomCustody] = useState(false);

  const [showScannerModal, setShowScannerModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const isFromScanRef = useRef(false);

  // Used to prevent auto-fetch on edit unless ISBN actually changed
  const initialIsbnRef = useRef(book?.isbn || "");
  const prevIsbnRef = useRef(book?.isbn || "");

  // Translation debounce timers
  const titleTranslateTimer = useRef(null);
  const authorTranslateTimer = useRef(null);

  // Refs to track last translated english text so edits trigger re-translation
  const lastTranslatedTitleRef = useRef((book?.title || "").split("||")[0].trim().toUpperCase());
  const lastTranslatedAuthorRef = useRef((book?.author || "").split("||")[0].trim().toUpperCase());

  // --- Helper function (Now updates without forcing uppercase to prevent cursor jump) ---
  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleInputBlur = (field) => {
    setForm(prev => ({ ...prev, [field]: (prev[field] || "").toUpperCase() }));
  };

  // --- Bilingual translation on Blur ---
  const handleTitleChange = (value) => {
    setForm(prev => ({ ...prev, title: value }));
  };

  const handleTitleBlur = async () => {
    const upper = (form.title || "").toUpperCase();
    const currentEnglish = upper.split("||")[0].trim();

    if (currentEnglish && (!upper.includes("||") || currentEnglish !== lastTranslatedTitleRef.current)) {
      setIsTranslating(true);
      const bilingual = await makeBilingual(currentEnglish);
      lastTranslatedTitleRef.current = currentEnglish;
      setForm(prev => {
        const checkEnglish = prev.title.split("||")[0].trim().toUpperCase();
        if (checkEnglish === currentEnglish) {
          return { ...prev, title: bilingual };
        }
        return { ...prev, title: prev.title.toUpperCase() };
      });
      setIsTranslating(false);

      // Trigger automatic web search if no ISBN is present
      if (!form.isbn) {
        const query = currentEnglish;
        if (query.length >= 4) {
          fetchBookDetails(query, 'title');
        }
      }
    } else {
      setForm(prev => ({ ...prev, title: prev.title.toUpperCase() }));

      // Even if they only edited the Bengali part or just blurred without changing the English part,
      // If it's a new book without an ISBN, we should still ensure we fetch details if we haven't already.
      // Actually, if the English part didn't change, we already fetched it when they first typed it.
      // But if they just opened the form and blurred, maybe we should fetch. 
      // Let's only fetch if it changed to avoid spamming the API.
    }
  };

  const handleAuthorChange = (value) => {
    setForm(prev => ({ ...prev, author: value }));
  };

  const handleAuthorBlur = async () => {
    const upper = (form.author || "").toUpperCase();
    const currentEnglish = upper.split("||")[0].trim();

    if (currentEnglish && (!upper.includes("||") || currentEnglish !== lastTranslatedAuthorRef.current)) {
      setIsTranslating(true);
      const bilingual = await makeBilingual(currentEnglish);
      lastTranslatedAuthorRef.current = currentEnglish;
      setForm(prev => {
        const checkEnglish = prev.author.split("||")[0].trim().toUpperCase();
        if (checkEnglish === currentEnglish) {
          return { ...prev, author: bilingual };
        }
        return { ...prev, author: prev.author.toUpperCase() };
      });
      setIsTranslating(false);
    } else {
      setForm(prev => ({ ...prev, author: prev.author.toUpperCase() }));
    }
  };

  // --- MULTI-SOURCE API Fetch Function (Enhanced with bilingual) ---
  const fetchBookDetails = useCallback(async (queryValue, queryType = 'isbn') => {
    const query = queryValue.trim();
    if (!query) return;

    if (queryType === 'isbn' && query.replace(/[^0-9X]/gi, "").length < 10) return;

    setIsLoading(true);
    let foundData = null;

    try {
      let rawGoogleData = null;
      let openLibData = null;

      if (queryType === 'isbn') {
        const cleanIsbn = query.replace(/[^0-9X]/gi, "");
        // Speed optimization: add a 400ms timeout for OpenLibrary so it doesn't block Google Books
        const openLibFetch = fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`).then(r => r.json());
        const openLibTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 400));

        const [googleRes, openLibRes] = await Promise.allSettled([
          fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`).then(r => r.json()),
          Promise.race([openLibFetch, openLibTimeout])
        ]);

        rawGoogleData = googleRes.status === "fulfilled" ? googleRes.value : null;

        if (!rawGoogleData || !rawGoogleData.items || rawGoogleData.items.length === 0) {
          rawGoogleData = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${cleanIsbn}`).then(r => r.json()).catch(() => null);
        }

        if (openLibRes.status === "fulfilled") {
          const bookKey = `ISBN:${cleanIsbn}`;
          const data = openLibRes.value;
          if (data && data[bookKey]) {
            const b = data[bookKey];
            let coverUrl = "";
            if (b.cover) {
              coverUrl = b.cover.large || b.cover.medium || b.cover.small || "";
            }
            openLibData = {
              title: b.title || "",
              author: b.authors && b.authors[0] ? b.authors[0].name : "",
              publisher: b.publishers && b.publishers[0] ? b.publishers[0].name : "",
              year: b.publish_date ? b.publish_date.match(/\d{4}/)?.[0] || "" : "",
              pages: b.number_of_pages ? String(b.number_of_pages) : "",
              genre: b.subjects && b.subjects[0] ? b.subjects[0].name : "",
              notes: b.notes ? String(b.notes).substring(0, 150) : "",
              description: "",
              coverUrl: coverUrl
            };
          }
        }
      } else {
        const [googleRes, openLibSearchRes] = await Promise.allSettled([
          fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5`).then(r => r.json()),
          fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=3`).then(r => r.json())
        ]);
        rawGoogleData = googleRes.status === "fulfilled" ? googleRes.value : null;

        if (openLibSearchRes.status === "fulfilled" && openLibSearchRes.value.docs && openLibSearchRes.value.docs.length > 0) {
          const doc = openLibSearchRes.value.docs[0];
          let coverUrl = "";
          if (doc.cover_i) {
            coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          }
          openLibData = {
            title: doc.title || "",
            author: doc.author_name ? doc.author_name.join(", ") : "",
            publisher: doc.publisher ? doc.publisher[0] : "",
            year: doc.first_publish_year ? String(doc.first_publish_year) : "",
            pages: doc.number_of_pages_median ? String(doc.number_of_pages_median) : "",
            genre: doc.subject ? doc.subject[0] : "",
            notes: "",
            description: "",
            coverUrl: coverUrl
          };
        }
      }

      // Parse Google Books
      let googleData = null;
      if (rawGoogleData && rawGoogleData.items && rawGoogleData.items.length > 0) {
        let bestImageLink = null;
        let bestDescription = "";
        let bestTitle = "";
        let bestAuthors = "";
        let bestPublisher = "";
        let bestYear = "";
        let bestPages = "";
        let bestGenre = "";

        // Iterate through all items to gather the best available data for each field
        for (const item of rawGoogleData.items) {
          const info = item.volumeInfo;
          if (info) {
            if (!bestTitle && info.title) bestTitle = info.title;
            if (!bestAuthors && info.authors) bestAuthors = info.authors.join(", ");
            if (!bestPublisher && info.publisher) bestPublisher = info.publisher;
            if (!bestYear && info.publishedDate) bestYear = info.publishedDate.split("-")[0];
            if (!bestPages && info.pageCount) bestPages = String(info.pageCount);
            if (!bestGenre && info.categories) bestGenre = info.categories[0];
            if (!bestDescription && info.description) bestDescription = info.description;

            if (!bestImageLink && info.imageLinks) {
              const links = info.imageLinks;
              bestImageLink = links.extraLarge || links.large || links.medium || links.thumbnail || links.smallThumbnail;
            }
          }
        }

        let coverUrl = "";
        if (bestImageLink) {
          coverUrl = bestImageLink.replace("&edge=curl", "").replace("http://", "https://").replace(/&zoom=\d/, "&zoom=2");
        }

        googleData = {
          title: bestTitle || "",
          author: bestAuthors || "",
          publisher: bestPublisher || "",
          year: bestYear || "",
          pages: bestPages || "",
          genre: bestGenre || "",
          notes: bestDescription ? `AUTO-FETCHED: ${bestDescription.substring(0, 150)}...` : "",
          description: bestDescription || "",
          coverUrl: coverUrl
        };
      }

      // Merge: prefer Google Books for most fields, fallback to OpenLibrary
      if (googleData || openLibData) {
        const pick = (g, o) => (g && g.trim() ? g : o && o.trim() ? o : "");
        foundData = {
          title: pick(googleData?.title, openLibData?.title),
          author: pick(googleData?.author, openLibData?.author),
          publisher: pick(googleData?.publisher, openLibData?.publisher),
          year: pick(googleData?.year, openLibData?.year),
          pages: pick(googleData?.pages, openLibData?.pages),
          genre: pick(googleData?.genre, openLibData?.genre),
          notes: pick(googleData?.notes, openLibData?.notes),
          description: pick(googleData?.description, openLibData?.description),
          coverUrl: pick(googleData?.coverUrl, openLibData?.coverUrl)
        };

        // Map genre to closest GENRES option
        let mappedGenre = "Other";
        if (foundData.genre) {
          const genreLower = foundData.genre.toLowerCase();
          const match = GENRES.find(g => genreLower.includes(g.toLowerCase()));
          if (match) mappedGenre = match;
        }

        // 1. UPDATE FORM INSTANTLY WITH ENGLISH DATA (Very Fast)
        setForm(prev => {
          let updatedImages = [...(prev.images || [])];
          if (foundData.coverUrl) {
            if (updatedImages.length > 0) {
              updatedImages[0] = foundData.coverUrl;
            } else {
              updatedImages.push(foundData.coverUrl);
            }
          }

          return {
            ...prev,
            title: foundData.title ? foundData.title.toUpperCase() : prev.title,
            author: foundData.author ? foundData.author.toUpperCase() : prev.author,
            publisher: foundData.publisher ? foundData.publisher.toUpperCase() : prev.publisher,
            year: foundData.year || prev.year,
            pages: foundData.pages || prev.pages,
            genre: mappedGenre !== "Other" ? mappedGenre : prev.genre,
            notes: foundData.notes || prev.notes,
            description: foundData.description || prev.description,
            images: updatedImages
          };
        });

        toast.success(`Book details fetched! ${foundData.title || ""}`);
        
        // Disable loading state instantly so user can interact
        setIsLoading(false); 

        // 2. BACKGROUND TRANSLATION (Doesn't block UI)
        if (queryType === 'isbn' && (foundData.title || foundData.author)) {
          setIsTranslating(true);
          Promise.all([
            foundData.title ? makeBilingual(foundData.title) : Promise.resolve(""),
            foundData.author ? makeBilingual(foundData.author) : Promise.resolve("")
          ]).then(([bilingualTitle, bilingualAuthor]) => {
            setForm(prev => ({
              ...prev,
              title: bilingualTitle || prev.title,
              author: bilingualAuthor || prev.author
            }));
            setIsTranslating(false);
          }).catch(() => setIsTranslating(false));
        }
        
      } else {
        if (queryType === 'isbn') {
          toast.error("Book details not found in databases. Fill manually or search the web.");
        }
      }
    } catch (error) {
      console.error("API Fetch Error:", error);
      toast.error("Failed to fetch book details.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // --- ISBN Change Monitor ---
  // Behavior:
  // - New book add: auto-fetch on typed ISBN (debounced) or scan result.
  // - Edit existing book: auto-fetch only if ISBN is changed from the original.
  useEffect(() => {
    const cleanCurrentIsbn = (form.isbn || "").replace(/[^0-9X]/gi, "").trim();
    const cleanInitialIsbn = (initialIsbnRef.current || "").replace(/[^0-9X]/gi, "").trim();

    const isEditingExistingBook = !!book?.id;

    // During edit, block auto-fetch unless ISBN changed.
    if (isEditingExistingBook && cleanCurrentIsbn === cleanInitialIsbn) return;

    if (isFromScanRef.current && cleanCurrentIsbn) {
      fetchBookDetails(cleanCurrentIsbn, 'isbn');
      isFromScanRef.current = false;
      prevIsbnRef.current = cleanCurrentIsbn;
      return;
    }

    const timer = setTimeout(() => {
      if (!cleanCurrentIsbn) return;
      // Avoid duplicate fetch if value didn't really change
      if (cleanCurrentIsbn === (prevIsbnRef.current || "")) return;
      fetchBookDetails(cleanCurrentIsbn, 'isbn');
      prevIsbnRef.current = cleanCurrentIsbn;
    }, 1200);

    return () => clearTimeout(timer);
  }, [form.isbn, fetchBookDetails, book?.id]);

  const prevTitleRef = useRef(book?.title || "");

  // --- Title Change Monitor ---
  useEffect(() => {
    const cleanCurrentTitle = (form.title || "").split("||")[0].trim();
    const cleanPrevTitle = (prevTitleRef.current || "").split("||")[0].trim();

    const isEditingExistingBook = !!book?.id;
    if (isEditingExistingBook) return; // Don't auto-fetch title during edit to prevent accidental overwrites

    // Wait until they typed a reasonable length word
    if (!cleanCurrentTitle || cleanCurrentTitle.length < 4 || cleanCurrentTitle === cleanPrevTitle) return;

    const timer = setTimeout(() => {
      // If we already have an ISBN, we probably fetched using ISBN.
      if (!form.isbn) {
        const query = form.author ? `${cleanCurrentTitle} ${form.author.split("||")[0].trim()}` : cleanCurrentTitle;
        fetchBookDetails(query, 'title');
      }
      prevTitleRef.current = cleanCurrentTitle;
    }, 2000); // 2 second debounce for title search

    return () => clearTimeout(timer);
  }, [form.title, form.author, form.isbn, fetchBookDetails, book?.id]);


  // --- Gemini AI Cover Extractor ---
  const handleAIExtract = async () => {
    if (!form.images || form.images.length === 0) {
      toast.error("Please upload a cover image first.");
      return;
    }
    
    const coverUrl = form.images[0];

    setIsExtractingAI(true);
    const toastId = toast.loading("AI is reading the cover...");

    try {
      // Fetch all images and convert to Base64
      const imageParts = await Promise.all(form.images.map(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        return {
          inlineData: {
            data: base64Data,
            mimeType: blob.type || "image/jpeg"
          }
        };
      }));
      
      const prompt = `Look at these images of a book (front cover, back cover, spine, etc.) and extract the Title, Author, and Publisher.
Also determine the most appropriate Genre from this list: ${GENRES.join(', ')}.
Finally, write a very short 2-3 sentence description (summary) about what this book is likely about based on its title and cover/back-cover.

For Title, Author, and Publisher, you MUST format the string as bilingual: "ENGLISH TRANSLATION || BENGALI TEXT".
If the text is in English, translate it to Bengali. If the text is in Bengali, translate it to English.
Make sure the English part is in UPPERCASE.
For Genre, return exactly one string from the provided list.
For Description, return it purely in Bengali language.

Example: {"title": "POTHER PANCHALI || পথের পাঁচালী", "author": "BIBHUTIBHUSHAN BANDYOPADHYAY || বিভূতিভূষণ বন্দ্যোপাধ্যায়", "publisher": "ANANDA PUBLISHERS || আনন্দ পাবলিশার্স", "genre": "Fiction", "description": "এটি অপু এবং দুর্গার গ্রামীণ জীবনের চমৎকার একটি গল্প..."}
If a field is not found, return an empty string. Return ONLY valid JSON.`;

      // Prepare the payload for our serverless function
      const parts = [
        { text: prompt },
        ...imageParts.map(part => ({
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data
          }
        }))
      ];
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate content from AI');
      }
      
      const result = await response.json();
      
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setForm(prev => ({
          ...prev,
          title: data.title || prev.title,
          author: data.author || prev.author,
          publisher: data.publisher || prev.publisher,
          genre: data.genre || prev.genre,
          description: data.description || prev.description
        }));
        
        toast.success("AI extraction complete!", { id: toastId });
      } else {
         toast.error("Could not parse AI response.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("AI extraction failed.", { id: toastId });
    } finally {
      setIsExtractingAI(false);
    }
  };


  // --- Scanner Result Handler ---
  const handleScanResult = (scannedIsbn) => {
    const cleaned = scannedIsbn.replace(/[^0-9X]/gi, "").trim();
    if (cleaned) {
      setForm(prev => ({ ...prev, isbn: cleaned }));
      isFromScanRef.current = true;
      setShowScannerModal(false);
    }
  };

  // অটোমেটিক নেট পে ক্যালকুলেশন (Existing Logic)
  const netPay = (parseFloat(form.price) || 0) - ((parseFloat(form.price) || 0) * (parseFloat(form.discount) || 0) / 100);

  const handleSubmit = (e) => {
    e.preventDefault();

    // --- Strict per-field validation (rejects before hitting network) ---
    const validationErrors = validateBookForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      // Show the first error as a toast for quick visibility
      const firstError = Object.values(validationErrors)[0];
      toast.error(firstError);
      return;
    }
    setFieldErrors({});

    const cleanForm = Object.fromEntries(
      Object.entries(form).filter(([_, v]) => v !== undefined)
    );

    const sanitizedForm = sanitizeData(cleanForm);

    const submitData = {
      ...sanitizedForm,
      frontCoverUrl: sanitizedForm.images?.[0] || "",
      backCoverUrl: sanitizedForm.images?.[1] || "",
      extraImages: sanitizedForm.images?.slice(2) || [],
      updatedAt: new Date()
    };
    
    // Remove fields that do not exist in Supabase schema
    delete submitData.images;
    delete submitData.ownership;

    if (submitData.year === "" || submitData.year === null || submitData.year === undefined) {
      submitData.year = null;
    } else {
      submitData.year = parseInt(submitData.year, 10) || null;
    }

    // Sanitize numeric fields for PostgreSQL (Empty string "" causes type error)
    if (submitData.pages === "" || submitData.pages === null || submitData.pages === undefined) {
      submitData.pages = null;
    } else {
      submitData.pages = parseInt(submitData.pages, 10) || null;
    }

    if (submitData.price === "" || submitData.price === null || submitData.price === undefined) {
      submitData.price = 0;
    } else {
      submitData.price = parseFloat(submitData.price) || 0;
    }

    if (submitData.discount === "" || submitData.discount === null || submitData.discount === undefined) {
      submitData.discount = 0;
    } else {
      submitData.discount = parseFloat(submitData.discount) || 0;
    }

    if (book?.id) {
      submitData.id = book.id;
    }

    onSubmit(submitData);
  };

  const handleImageUpload = async (e) => {
    // Legacy function, replaced by ImageUploadControl
  };

  const openWebSearch = () => {
    const query = encodeURIComponent(`ISBN ${form.isbn} book`);
    window.open(`https://www.google.com/search?q=${query}`, "_blank");
  };

  return (
    <div className="modern-overlay">
      <div className="modern-card">
        {/* Header */}
        <div className="modern-header">
          <div className="header-content">
            <div className="header-icon">
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : <Book size={24} />}
            </div>
            <div>
              <h2>{book ? "Update Asset" : "New Registration"}</h2>
              <p>{isLoading ? "Fetching book details..." : isTranslating ? "Translating to Bengali..." : "Library Inventory & Management System"}</p>
            </div>
          </div>
          <button className="close-circle-btn" onClick={handleClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modern-body" style={{ paddingBottom: '250px' }}>

          {/* Section 1: Identity */}
          <div className="form-section">
            <div className="section-tag">01. Bibliographic</div>
            <div className="field-grid">

              <div className="input-group col-span-2">
                <label><ScanLine size={14} /> ISBN / Barcode</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input-field"
                    value={form.isbn}
                    onChange={(e) => {
                      setForm({ ...form, isbn: e.target.value });
                      isFromScanRef.current = false; // ম্যানুয়াল এন্ট্রি
                    }}
                    placeholder="Type ISBN or Scan"
                  />
                  <button
                    type="button"
                    className="scan-trigger-btn"
                    onClick={() => setShowScannerModal(true)}
                    title="Scan Barcode"
                  >
                    <ScanLine size={18} />
                  </button>
                </div>
                {form.isbn && (
                  <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={openWebSearch}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--pro-primary, #3b82f6)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: 0,
                      }}
                    >
                      <ExternalLink size={12} />
                      Search details on Web
                    </button>
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <div className="input-group">
                  <label><Book size={14} /> Book Name {isTranslating && <span style={{ fontSize: '10px', color: '#f59e0b' }}>(translating...)</span>}</label>
                  <input required className="input-field" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} onBlur={handleTitleBlur} placeholder="Title of the book (auto-translates to Bengali)" />
                </div>
              </div>

              <div className="input-group">
                <label><User size={14} /> Author {isTranslating && <span style={{ fontSize: '10px', color: '#f59e0b' }}>(translating...)</span>}</label>
                <input required className="input-field" value={form.author} onChange={(e) => handleAuthorChange(e.target.value)} onBlur={handleAuthorBlur} placeholder="Author name (auto-translates to Bengali)" />
              </div>
              <div className="input-group">
                <label><Tag size={14} /> Genre</label>
                <select className="input-field" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label><FileText size={14} /> Pages</label>
                <input type="number" className="input-field" value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} placeholder="Total" />
              </div>

              <div className="input-group col-span-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}><ImageIcon size={14} /> Book Images</label>
                  {form.images && form.images.length > 0 && isAdmin && (
                     <button
                       type="button"
                       onClick={handleAIExtract}
                       disabled={isExtractingAI}
                       style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '6px',
                         background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                         color: 'white',
                         border: 'none',
                         padding: '6px 12px',
                         borderRadius: '6px',
                         fontSize: '12px',
                         fontWeight: 600,
                         cursor: isExtractingAI ? 'not-allowed' : 'pointer',
                         opacity: isExtractingAI ? 0.7 : 1,
                         boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.2)'
                       }}
                       title="Automatically extract Title, Author, and Publisher from this cover image"
                     >
                       {isExtractingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                       {isExtractingAI ? "Extracting AI..." : "Auto-Fill with AI"}
                     </button>
                  )}
                </div>
                {form.images && form.images.length > 0 && (
                  <Reorder.Group
                    axis="x"
                    values={form.images}
                    onReorder={(newOrder) => {
                      setForm({ ...form, images: newOrder });
                    }}
                    style={{ display: 'flex', gap: '10px', flexWrap: 'nowrap', overflowX: 'auto', marginBottom: '10px', paddingBottom: '8px' }}
                  >
                    {form.images.map((url, index) => (
                      <Reorder.Item
                        key={url}
                        value={url}
                        style={{ position: 'relative', width: '80px', height: '100px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', cursor: 'grab', flexShrink: 0 }}
                        whileDrag={{ scale: 1.05, zIndex: 50, cursor: 'grabbing', opacity: 1, boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                        title={index === 0 ? "Primary Cover" : `Additional Image ${index}`}
                      >
                        <img src={url} alt={`Preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newImages = [...(form.images || [])];
                            newImages.splice(index, 1);
                            setForm({ ...form, images: newImages });
                          }}
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer', zIndex: 10 }}
                          title={`Delete Image`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}
                <ImageUploadControl
                  label={(!form.images || form.images.length === 0) ? "Upload Primary Cover Image" : "Upload Additional Image(s)"}
                  value={""}
                  allowMultiple={true}
                  onChange={(urlOrUrls) => {
                    if (urlOrUrls) {
                      const newUrls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
                      setForm(prev => {
                        const unique = [...new Set([...(prev.images || []), ...newUrls])];
                        return { ...prev, images: unique };
                      });
                    }
                  }}
                  hidePreview={true}
                />
              </div>
            </div>
          </div>


          {/* Section 2: Publication & Price */}
          <div className="form-section">
            <div className="section-tag">02. Commercials</div>
            <div className="field-grid">
              <div className="input-group">
                <label><Home size={14} /> Publication</label>
                <input className="input-field" value={form.publisher} onChange={(e) => handleInputChange('publisher', e.target.value)} onBlur={() => handleInputBlur('publisher')} placeholder="House Name" />
              </div>
              <div className="input-group">
                <label><Calendar size={14} /> Published Year</label>
                <input type="number" className="input-field" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="YYYY" />
              </div>
              <div className="input-group">
                <label><DollarSign size={14} /> MRP Price</label>
                <input type="number" className="input-field" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              </div>
              <div className="input-group">
                <label><Percent size={14} /> Discount (%)</label>
                <input type="number" className="input-field" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="net-pay-card">
              <span className="pay-label">Total Net Pay Amount:</span>
              <span className="pay-value">₹ {netPay.toFixed(2)}</span>
            </div>
          </div>

          {/* Section 3: Stewardship */}
          <div className="form-section">
            <div className="section-tag">03. Stewardship</div>
            <div className="field-grid">
              <div className="input-group">
                <label><Shield size={14} /> Legal Owner</label>
                <CustomDropdown
                  icon={Shield}
                  value={
                    !form.owner ? "" 
                    : form.owner === myName ? myName 
                    : groupPartners.find(p => p.name === form.owner || p.email === form.owner) ? form.owner
                    : showCustomOwner ? "custom" 
                    : "custom"
                  }
                  onChange={(val) => {
                    if (val === "custom") {
                      setShowCustomOwner(true);
                      handleInputChange('owner', '');
                    } else {
                      setShowCustomOwner(false);
                      handleInputChange('owner', val);
                    }
                  }}
                  options={[
                    { label: `Me (${myName || 'Yourself'})`, value: myName || 'Me' },
                    ...groupPartners.map(p => ({ label: `${p.name || p.email} (Group: ${p.groupName})`, value: p.name || p.email })),
                    { label: 'Custom...', value: 'custom' }
                  ]}
                  placeholder="Select Owner..."
                />
                
                {((form.owner && form.owner !== myName && !groupPartners.some(p => p.name === form.owner || p.email === form.owner)) || showCustomOwner) && (
                  <input
                    className="input-field"
                    style={{ marginTop: 8 }}
                    value={form.owner}
                    onChange={(e) => handleInputChange('owner', e.target.value)}
                    onBlur={() => handleInputBlur('owner')}
                    placeholder="Type custom owner name"
                    autoFocus
                  />
                )}
              </div>
              <div className="input-group">
                <label><MapPin size={14} /> Current Custody</label>
                <CustomDropdown
                  icon={MapPin}
                  value={
                    !form.custody ? "" 
                    : form.custody === myName ? myName 
                    : groupPartners.find(p => p.name === form.custody || p.email === form.custody) ? form.custody
                    : showCustomCustody ? "custom" 
                    : "custom"
                  }
                  onChange={(val) => {
                    if (val === "custom") {
                      setShowCustomCustody(true);
                      handleInputChange('custody', '');
                    } else {
                      setShowCustomCustody(false);
                      handleInputChange('custody', val);
                    }
                  }}
                  options={[
                    { label: `Me (${myName || 'Yourself'})`, value: myName || 'Me' },
                    ...groupPartners.map(p => ({ label: `${p.name || p.email} (Group: ${p.groupName})`, value: p.name || p.email })),
                    { label: 'Custom...', value: 'custom' }
                  ]}
                  placeholder="Select Custody..."
                />

                {((form.custody && form.custody !== myName && !groupPartners.some(p => p.name === form.custody || p.email === form.custody)) || showCustomCustody) && (
                  <input
                    className="input-field"
                    style={{ marginTop: 8 }}
                    value={form.custody}
                    onChange={(e) => handleInputChange('custody', e.target.value)}
                    onBlur={() => handleInputBlur('custody')}
                    placeholder="Type custom custody name"
                    autoFocus
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Description & Notes */}
          <div className="form-section">
            <div className="section-tag">04. Description & Notes</div>

            <div className="input-group full-width" style={{ marginTop: '10px' }}>
              <label><FileText size={14} /> Book Description</label>
              <textarea className="input-field textarea-field" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Write or paste book description..." />
            </div>

            <div className="input-group full-width" style={{ marginTop: '10px' }}>
              <label><Edit3 size={14} /> Professional Annotations</label>
              <textarea className="input-field textarea-field" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Condition, source or remarks..." />
            </div>
          </div>

          <div className="modern-footer">
            <button type="button" className="cancel-btn" onClick={handleClose}>Discard Changes</button>
            <button type="submit" className="save-btn" disabled={isLoading}>
              {isLoading ? "Fetching Data..." : "Save Asset Details"}
            </button>
          </div>
        </form>
      </div>

      {/* Scanner Modal */}
      {showScannerModal && (
        <ISBNBarcodeScanner
          onScan={handleScanResult}
          onClose={() => setShowScannerModal(false)}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Do you want to save them before closing?"
        confirmText="Save & Close"
        cancelText="Discard & Exit"
        iconType="warning"
        confirmColor="#10b981"
        onConfirm={() => {
          setShowConfirm(false);
          const submitEvent = { preventDefault: () => { } };
          handleSubmit(submitEvent);
        }}
        onCancel={() => {
          setShowConfirm(false);
          onClose();
        }}
      />
    </div>
  );
}

