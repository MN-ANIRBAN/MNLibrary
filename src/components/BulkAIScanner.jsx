import React, { useState, useRef, useEffect } from 'react';
// import { GoogleGenerativeAI } from '@google/generative-ai';
import { UploadCloud, Loader2, CheckCircle2, XCircle, X, Camera, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import imageCompression from 'browser-image-compression';

const GENRES = [
  "Academic", "Adventure", "Biography", "Business", "Contemporary", "Crime",
  "Dark Fantasy", "Detective", "Dystopian", "Fantasy", "Fiction", "Graphic Novel",
  "Historical Fiction", "Horror", "Informative", "Kids / Children", "Mystery",
  "Mythology", "Non-Fiction", "Poetry", "Romance", "Science Fiction", "Self-Help",
  "Suspense", "Spy Thriller", "Technology", "Thriller", "Other"
];

export default function BulkAIScanner({ onClose, onAddBook, myName, isDuplicateBook }) {
  const [jobs, setJobs] = useState([{ id: Date.now(), files: [], status: 'pending', title: '' }]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Camera state
  const [activeCameraJobId, setActiveCameraJobId] = useState(null);
  const [dragActiveJobId, setDragActiveJobId] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async (jobId) => {
    if (activeCameraJobId === jobId) {
      stopCamera();
      setActiveCameraJobId(null);
      return;
    }
    setActiveCameraJobId(jobId);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Camera access denied.");
      setActiveCameraJobId(null);
    }
  };

  const captureImage = (jobId) => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        videoRef.current.style.opacity = '0';
        setTimeout(() => { if (videoRef.current) videoRef.current.style.opacity = '1'; }, 100);
        blob.name = `captured_book_${Date.now()}.jpg`;
        addFilesToJob(jobId, [blob]);
      }
    }, 'image/jpeg', 0.8);
  };

  const addFilesToJob = (jobId, newFiles) => {
    setJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        return { ...job, files: [...job.files, ...newFiles] };
      }
      return job;
    }));
  };

  const handleFileSelect = (jobId, e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToJob(jobId, Array.from(e.target.files));
    }
  };

  const handleDrag = (jobId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActiveJobId(jobId);
    } else if (e.type === "dragleave") {
      setDragActiveJobId(null);
    }
  };

  const handleDrop = (jobId, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActiveJobId(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToJob(jobId, Array.from(e.dataTransfer.files));
    }
  };

  const uploadToImgbb = async (file) => {
    let fileToUpload = file;
    if (file && file.type && file.type.startsWith('image/')) {
      try {
        fileToUpload = await imageCompression(file, {
          maxSizeMB: 0.3,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        });
      } catch (e) {
        console.error("Bulk AI Compression failed:", e);
      }
    }
    const formData = new FormData();
    formData.append('image', fileToUpload);
    
    const response = await fetch(`/api/imgbb`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (data.success && data.data && data.data.url) {
      return data.data.url;
    }
    throw new Error("ImgBB Upload Failed");
  };

  const processJob = async (job, index) => {
    try {
      if (job.files.length === 0) return;

      // 1. Upload all to ImgBB
      const coverUrls = await Promise.all(job.files.map(f => uploadToImgbb(f)));

      // 2. Convert all to Base64 inline parts for Gemini
      const imageParts = await Promise.all(job.files.map(async (file) => {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        return {
          inlineData: { data: base64Data, mimeType: file.type || "image/jpeg" }
        };
      }));

      // 3. Call Gemini
      const prompt = `Look at these images of a single book (front cover, back cover, spine, etc.) and extract the Title, Author, and Publisher.
Also determine the most appropriate Genre from this list: ${GENRES.join(', ')}.
Finally, write a very short 2-3 sentence description (summary) about what this book is likely about based on its title and cover/back-cover.

For Title, Author, and Publisher, you MUST format the string as bilingual: "ENGLISH TRANSLATION || BENGALI TEXT".
If the text is in English, translate it to Bengali. If the text is in Bengali, translate it to English.
Make sure the English part is in UPPERCASE.
For Genre, return exactly one string from the provided list.
For Description, return it purely in Bengali language.

Example: {"title": "POTHER PANCHALI || পথের পাঁচালী", "author": "BIBHUTIBHUSHAN BANDYOPADHYAY || বিভূতিভূষণ বন্দ্যোপাধ্যায়", "publisher": "ANANDA PUBLISHERS || আনন্দ পাবলিশার্স", "genre": "Fiction", "description": "এটি অপু এবং দুর্গার গ্রামীণ জীবনের চমৎকার একটি গল্প..."}
If a field is not found, return an empty string. Return ONLY valid JSON.`;

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
      if (!jsonMatch) throw new Error("Failed to parse AI response");
      
      const data = JSON.parse(jsonMatch[0]);

      // 4. Save to Database (Supply all required default fields to avoid Supabase errors)
      const bookData = {
        title: data.title || "Unknown Title",
        author: data.author || "Unknown Author",
        isbn: "",
        publisher: data.publisher || "",
        year: null,
        genre: data.genre || "Other",
        description: data.description || "",
        frontCoverUrl: coverUrls[0] || "",
        backCoverUrl: coverUrls[1] || "",
        extraImages: coverUrls.slice(2) || [],
        status: "unread",
        owner: myName || "",
        custody: myName || "",
        notes: "",
        pages: null,
        price: 0,
        discount: 0
      };

      if (isDuplicateBook && isDuplicateBook(bookData, { includeBin: false })) {
        setJobs(prev => prev.map(j => {
          if (j.id === job.id) return { ...j, status: 'error', title: data.title + " (Duplicate)" };
          return j;
        }));
        toast.error(`"${data.title}" already exists in your library.`);
        return;
      }

      await onAddBook(bookData);

      setJobs(prev => prev.map(j => {
        if (j.id === job.id) return { ...j, status: 'success', title: data.title || 'Unknown Title' };
        return j;
      }));

    } catch (err) {
      console.error(err);
      setJobs(prev => prev.map(j => {
        if (j.id === job.id) return { ...j, status: 'error' };
        return j;
      }));
    }
  };

  const startProcessing = async () => {
    const jobsToProcess = jobs.filter(j => j.files.length > 0 && j.status !== 'success');
    if (jobsToProcess.length === 0) {
      toast.error("Please add images to at least one book.");
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    stopCamera();
    setActiveCameraJobId(null);

    for (let i = 0; i < jobsToProcess.length; i++) {
      await processJob(jobsToProcess[i], i);
      setProgress(i + 1);
    }

    setIsProcessing(false);
    toast.success("Bulk scan completed!");
  };

  const addNewJob = () => {
    setJobs(prev => [...prev, { id: Date.now(), files: [], status: 'pending', title: '' }]);
  };

  const removeJob = (id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const removeFileFromJob = (jobId, fileIndex) => {
    setJobs(prev => prev.map(job => {
      if (job.id === jobId) {
        const newFiles = [...job.files];
        newFiles.splice(fileIndex, 1);
        return { ...job, files: newFiles };
      }
      return job;
    }));
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >
        <motion.div 
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          style={{
            background: 'var(--bg-card)', padding: '24px', borderRadius: '16px',
            width: '90%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
              <UploadCloud size={24} style={{ color: 'var(--pro-primary)' }} />
              Bulk AI Scanner (Multi-Image)
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {jobs.map((job, index) => (
              <div key={job.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                    {job.status === 'success' ? job.title : `Book ${index + 1}`}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {job.status === 'pending' && isProcessing && progress === index && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--pro-primary)' }} />}
                    {job.status === 'success' && <CheckCircle2 size={16} style={{ color: 'var(--green)' }} />}
                    {job.status === 'error' && <XCircle size={16} style={{ color: 'var(--red)' }} />}
                    {jobs.length > 1 && !isProcessing && (
                      <button onClick={() => removeJob(job.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: '4px' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {job.status === 'pending' && isProcessing && progress === index && (
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                    <div className="skeleton-wrapper" style={{ width: '80px', height: '120px', borderRadius: '8px' }}></div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
                      <div className="skeleton-wrapper skeleton-text title" style={{ width: '80%' }}></div>
                      <div className="skeleton-wrapper skeleton-text short" style={{ width: '40%' }}></div>
                      <div className="skeleton-wrapper skeleton-text short" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                )}
                {job.status === 'pending' && !isProcessing && (
                  <>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <input 
                        type="file" multiple accept="image/*" 
                        id={`file-upload-${job.id}`}
                        onChange={(e) => handleFileSelect(job.id, e)}
                        style={{ display: 'none' }}
                      />
                      <label 
                        htmlFor={`file-upload-${job.id}`} 
                        onDragEnter={(e) => handleDrag(job.id, e)}
                        onDragLeave={(e) => handleDrag(job.id, e)}
                        onDragOver={(e) => handleDrag(job.id, e)}
                        onDrop={(e) => handleDrop(job.id, e)}
                        style={{
                          flex: 1, padding: dragActiveJobId === job.id ? '20px 10px' : '10px', borderRadius: '8px', 
                          border: `1px dashed ${dragActiveJobId === job.id ? 'var(--pro-primary)' : 'var(--border)'}`,
                          background: dragActiveJobId === job.id ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-elevated)', 
                          color: dragActiveJobId === job.id ? 'var(--pro-primary)' : 'var(--text-primary)', 
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          gap: '6px', fontSize: '13px', transition: 'all 0.2s'
                      }}>
                        <ImageIcon size={14} /> {dragActiveJobId === job.id ? 'Drop images here' : 'Upload / Drop Images'}
                      </label>
                      <button 
                        onClick={() => startCamera(job.id)}
                        style={{
                          flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)',
                          background: activeCameraJobId === job.id ? 'var(--pro-primary)' : 'var(--bg-elevated)',
                          color: activeCameraJobId === job.id ? '#fff' : 'var(--text-primary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px'
                        }}
                      >
                        <Camera size={14} /> {activeCameraJobId === job.id ? 'Close Camera' : 'Camera'}
                      </button>
                    </div>

                    {activeCameraJobId === job.id && (
                      <div style={{ marginBottom: '12px', borderRadius: '8px', overflow: 'hidden', background: '#000', position: 'relative' }}>
                        <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '250px', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', bottom: '12px', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                          <button 
                            onClick={() => captureImage(job.id)}
                            style={{
                              background: '#fff', border: '3px solid rgba(255,255,255,0.4)', borderRadius: '50%',
                              width: '48px', height: '48px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', backgroundClip: 'padding-box'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}

                {job.files.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {job.files.map((f, i) => (
                      <div key={i} style={{ position: 'relative', width: '60px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                        <img src={URL.createObjectURL(f)} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {!isProcessing && job.status !== 'success' && (
                          <button 
                            onClick={() => removeFileFromJob(job.id, i)}
                            style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '4px', padding: '2px', cursor: 'pointer' }}
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!isProcessing && (
              <button 
                onClick={addNewJob}
                style={{
                  padding: '16px', borderRadius: '12px', border: '2px dashed var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 500
                }}
              >
                <Plus size={18} /> Add Another Book
              </button>
            )}
          </div>

          <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button 
              onClick={startProcessing}
              disabled={isProcessing || jobs.every(j => j.files.length === 0 || j.status === 'success')}
              style={{
                width: '100%', padding: '14px', borderRadius: '8px', border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: 'white',
                fontSize: '15px', fontWeight: 600, 
                cursor: (isProcessing || jobs.every(j => j.files.length === 0 || j.status === 'success')) ? 'not-allowed' : 'pointer',
                opacity: (isProcessing || jobs.every(j => j.files.length === 0 || j.status === 'success')) ? 0.7 : 1, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
              }}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
              {isProcessing ? `Processing ${progress} of ${jobs.filter(j => j.files.length > 0 && j.status !== 'success').length}...` : 'Start Bulk AI Scan'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
