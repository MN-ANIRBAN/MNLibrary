import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Link as LinkIcon, X, Image as ImageIcon, Trash2, CheckCircle2, ScanLine, UploadCloud, Crop, ArrowRight, SkipForward } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { supabase } from '../supabase/config';
import { validateImageFile } from '../utils/fileValidator';
import { getUserFacingError } from '../utils/errorHandler';
import imageCompression from 'browser-image-compression';
import './ImageUploadControl.css';

export default function ImageUploadControl({
  label,
  value,
  onChange,
  onDelete,
  hidePreview = false,
  allowMultiple = false
}) {
  const [activeTab, setActiveTab] = useState('upload'); // upload, capture, link
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [linkInput, setLinkInput] = useState(value || '');
  const [showPreview, setShowPreview] = useState(false);
  const queueRef = useRef([]);
  const fileInputRef = useRef(null);
  const [fileQueueCount, setFileQueueCount] = useState(0);
  const [totalFilesCount, setTotalFilesCount] = useState(0);

  // Cropping states
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const imgRef = useRef(null);

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

  const uploadToImgbb = async (fileOrBlob) => {
    setIsUploading(true);
    const toastId = toast.loading("Compressing and uploading image...");
    try {
      let fileToUpload = fileOrBlob;
      if (fileOrBlob && fileOrBlob.type && fileOrBlob.type.startsWith('image/')) {
        try {
          const options = {
            maxSizeMB: 0.3,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            initialQuality: 0.8
          };
          fileToUpload = await imageCompression(fileOrBlob, options);
        } catch (error) {
          console.error("Compression error:", error);
        }
      }

      const formData = new FormData();
      formData.append('image', fileToUpload);

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId) {
        const originalName = fileOrBlob.name || 'image';
        const nameWithoutExt = originalName.split('.')[0];
        const newName = `${userId}_${nameWithoutExt}`;
        formData.append('name', newName);
      }

      const response = await fetch(`/api/imgbb`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success && data.data && data.data.url) {
        onChange(data.data.url, data.data.delete_url);
        toast.success("Image uploaded successfully!", { id: toastId });
        setLinkInput(data.data.url);
      } else {
        toast.error("Failed to upload image. Please try again.", { id: toastId });
      }
    } catch (error) {
      toast.error(getUserFacingError(error, 'ImageUpload'), { id: toastId });
    } finally {
      setIsUploading(false);
      setActiveTab('upload');
    }
  };

  const processNextInQueue = () => {
    if (queueRef.current.length > 0) {
      const nextFile = queueRef.current.shift();
      setFileQueueCount(queueRef.current.length);
      const reader = new FileReader();
      setOriginalFile(nextFile);
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(nextFile);
      if (activeTab === 'capture') setActiveTab('upload');
    } else {
      setFileQueueCount(0);
    }
  };

  const processFiles = async (files) => {
    if (files.length === 0) return;

    // Validate all files first (fail fast)
    for (const file of files) {
      const validation = await validateImageFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
    }

    setTotalFilesCount(files.length);
    const firstFile = files[0];
    queueRef.current = files.slice(1);
    setFileQueueCount(queueRef.current.length);
    initiateCrop(firstFile);
  };

  const initiateCrop = (file) => {
    setOriginalFile(file);
    const reader = new FileReader();
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
    reader.readAsDataURL(file);
    if (activeTab === 'capture') setActiveTab('upload');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const startCamera = async () => {
    if (activeTab === 'capture') {
      stopCamera();
      setActiveTab('upload');
      return;
    }
    setActiveTab('capture');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Camera access denied.");
      setActiveTab('upload');
    }
  };

  const captureImage = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        stopCamera();
        blob.name = `capture_${Date.now()}.jpg`;
        initiateCrop(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  const getCroppedImg = (image, crop) => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

    const ctx = canvas.getContext('2d');
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setCrop({
      unit: '%',
      x: 5,
      y: 5,
      width: 90,
      height: 90,
    });
  };

  const discardCurrent = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(null);
    setOriginalFile(null);
    if (videoRef.current) stopCamera();
    if (queueRef.current.length === 0) setTotalFilesCount(0);
    processNextInQueue();
  };

  const cancelAll = () => {
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(null);
    setOriginalFile(null);
    queueRef.current = [];
    setFileQueueCount(0);
    setTotalFilesCount(0);
    if (videoRef.current) stopCamera();
  };

  const skipCropAndUpload = () => {
    if (originalFile) {
      setImgSrc('');
      setCrop(undefined);
      setCompletedCrop(null);
      uploadToImgbb(originalFile).catch(() => { });
      setOriginalFile(null);
      if (queueRef.current.length === 0) setTotalFilesCount(0);
      processNextInQueue();
    }
  };

  const handleSaveCrop = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current && completedCrop.width > 0 && completedCrop.height > 0) {
      try {
        const croppedBlob = await getCroppedImg(imgRef.current, completedCrop);
        croppedBlob.name = originalFile?.name || 'cropped_image.jpg';
        setImgSrc('');
        setCrop(undefined);
        setCompletedCrop(null);
        uploadToImgbb(croppedBlob).catch(() => { });
        if (queueRef.current.length === 0) setTotalFilesCount(0);
        processNextInQueue();
      } catch (e) {
        toast.error("Error cropping image");
      }
    } else if (originalFile) {
      setImgSrc('');
      uploadToImgbb(originalFile).catch(() => { });
      if (queueRef.current.length === 0) setTotalFilesCount(0);
      processNextInQueue();
    }
  };

  const toggleLinkMode = () => {
    if (activeTab === 'link') {
      setActiveTab('upload');
    } else {
      stopCamera();
      setActiveTab('link');
    }
  };

  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (linkInput.trim()) {
      onChange(linkInput.trim(), null);
      toast.success("Image link added!");
      setActiveTab('upload');
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete();
    } else {
      onChange("", null);
      setLinkInput("");
    }
  };

  return (
    <div className="iuc-compact-container">
      {label && <div className="iuc-compact-label">{label}</div>}

      {value && !hidePreview ? (
        <div className="iuc-uploaded-card">
          <div className="iuc-thumbnail-wrapper" onClick={() => setShowPreview(true)} style={{ cursor: 'pointer' }}>
            <img src={value} alt="Preview" className="iuc-thumbnail" />
          </div>
          <div className="iuc-uploaded-info">
            <span className="iuc-uploaded-title">Image Linked Successfully</span>
            <span className="iuc-uploaded-subtitle">
              <CheckCircle2 size={12} /> Ready to save
            </span>
          </div>
          <button type="button" onClick={handleDelete} className="iuc-delete-btn" title="Remove image">
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <>
          <motion.div
            className={`iuc-compact-dropzone ${dragActive ? 'active' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            whileHover={{ scale: 1.01, borderColor: "var(--pro-primary)" }}
            whileTap={{ scale: 0.98 }}
            animate={dragActive ? {
              scale: 1.02,
              borderColor: "var(--pro-primary)",
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              boxShadow: "inset 0 0 0 1.5px var(--pro-primary)"
            } : {
              scale: 1,
              backgroundColor: "transparent",
              boxShadow: "none"
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {isUploading ? (
              <motion.div 
                className="iuc-uploading-bar"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ justifyContent: 'center', padding: '8px 0' }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(59, 130, 246, 0.15)', borderTopColor: 'var(--pro-primary)' }}
                  />
                  <ImageIcon size={16} color="var(--pro-primary)" style={{ opacity: 0.8 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '8px' }}>
                  <motion.span 
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-1)', letterSpacing: '0.2px' }}
                  >
                    Uploading Image...
                  </motion.span>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Please wait a moment</span>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="iuc-left-section">
                  <motion.div 
                    className="iuc-icon-wrapper"
                    animate={dragActive ? { 
                      y: [0, -6, 0],
                      scale: [1, 1.1, 1],
                      color: "var(--pro-primary)"
                    } : { y: 0, scale: 1 }}
                    transition={dragActive ? { repeat: Infinity, duration: 1, ease: "easeInOut" } : { type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <ImageIcon size={18} />
                  </motion.div>
                  <div>
                    <motion.p 
                      className="iuc-text-main"
                      animate={{ color: dragActive ? "var(--pro-primary)" : "var(--text-2)" }}
                    >
                      {dragActive ? "Drop image here..." : "Select or Drag Image"}
                    </motion.p>
                    <p className="iuc-text-sub">JPG, PNG, GIF, WebP up to 5 MB</p>
                  </div>
                </div>

                <div className="iuc-actions" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="iuc-action-btn" onClick={startCamera} title="Use Camera">
                    <Camera size={16} />
                  </button>
                  <button type="button" className="iuc-action-btn" onClick={toggleLinkMode} title="Paste URL">
                    <LinkIcon size={16} />
                  </button>
                </div>
              </>
            )}

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileUpload}
              accept="image/*"
              multiple={allowMultiple}
            />
          </motion.div>

          {!isUploading && activeTab === 'capture' && (
            <div className="iuc-expand-panel">
              <div className="iuc-panel-header">
                <span className="iuc-panel-title">Take a Photo</span>
                <button type="button" onClick={() => { stopCamera(); setActiveTab('upload'); }} className="iuc-panel-close">
                  <X size={16} />
                </button>
              </div>
              <div className="iuc-camera-preview">
                <video ref={videoRef} autoPlay playsInline />
              </div>
              <button type="button" onClick={captureImage} className="iuc-capture-btn">
                <Camera size={16} /> Capture Image
              </button>
            </div>
          )}

          {!isUploading && activeTab === 'link' && (
            <div className="iuc-expand-panel">
              <div className="iuc-panel-header">
                <span className="iuc-panel-title">Paste Image URL</span>
                <button type="button" onClick={() => setActiveTab('upload')} className="iuc-panel-close">
                  <X size={16} />
                </button>
              </div>
              <div className="iuc-link-input-row">
                <input
                  type="url"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://..."
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={handleLinkSubmit} className="save-btn" style={{ padding: '0 16px', minWidth: 'auto' }}>
                  Add
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {createPortal(
        <AnimatePresence>
          {imgSrc ? (
            <motion.div
              className="iuc-crop-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="iuc-crop-modal-content"
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
              >
                {totalFilesCount > 1 && (
                  <div className="iuc-progress-bar-container">
                    <div
                      className="iuc-progress-bar-fill"
                      style={{ width: `${((totalFilesCount - fileQueueCount) / totalFilesCount) * 100}%` }}
                    />
                  </div>
                )}

                <div className="iuc-crop-header">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Crop size={18} style={{ color: 'var(--pro-primary, #3b82f6)' }} />
                      Crop Image
                    </h3>
                    {totalFilesCount > 1 && (
                      <span className="iuc-step-badge">
                        Image {totalFilesCount - fileQueueCount} of {totalFilesCount}
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={cancelAll} className="iuc-panel-close">
                    <X size={24} strokeWidth={2.5} />
                  </button>
                </div>
                <div className="iuc-crop-body">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                  >
                    <img
                      ref={imgRef}
                      src={imgSrc}
                      onLoad={onImageLoad}
                      alt="Crop"
                      style={{ maxHeight: '60vh', maxWidth: '100%', display: 'block', borderRadius: '4px' }}
                    />
                  </ReactCrop>
                </div>
                <div className="iuc-crop-footer">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {totalFilesCount > 1 ? (
                      <>
                        <button type="button" onClick={cancelAll} className="iuc-btn-secondary" style={{ color: 'var(--text-3)', borderColor: 'transparent' }}>
                          Cancel All
                        </button>
                        <button type="button" onClick={discardCurrent} className="iuc-btn-secondary">
                          <Trash2 size={16} /> Discard
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={cancelAll} className="iuc-btn-secondary" style={{ borderColor: 'transparent' }}>
                        Cancel
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={skipCropAndUpload} className="iuc-btn-secondary">
                      <SkipForward size={16} /> Upload Original
                    </button>
                    <button type="button" onClick={handleSaveCrop} className="iuc-btn-primary">
                      {fileQueueCount > 0 ? (
                        <>Save & Next <ArrowRight size={16} /></>
                      ) : (
                        <><UploadCloud size={16} /> Save & Upload</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {showPreview && createPortal(
        <div className="iuc-crop-modal" onClick={() => setShowPreview(false)} style={{ zIndex: 999999 }}>
          <div
            className="iuc-crop-modal-content"
            style={{ background: 'transparent', boxShadow: 'none', overflow: 'visible', width: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ position: 'relative' }}>
              <img
                src={value}
                alt="Preview Full"
                style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block', borderRadius: '8px' }}
              />
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{
                  position: 'absolute',
                  top: '-40px',
                  right: '0',
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}  
