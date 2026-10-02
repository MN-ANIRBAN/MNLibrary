import { BrowserMultiFormatReader, NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useState, useRef, useCallback } from "react";
import { X, ScanLine, Camera, Image as ImageIcon } from "lucide-react";

export default function ISBNBarcodeScanner({ onScan, onClose }) {
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [scanSuccess, setScanSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasScannedRef = useRef(false);

  // Initialize ZXing and get cameras
  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    
    // Add hints to prioritize 1D formats like ISBNs (EAN-13)
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13
    ]);
    reader.hints = hints;
    readerRef.current = reader;

    reader.listVideoInputDevices()
      .then((videoInputDevices) => {
        setDevices(videoInputDevices);
        if (videoInputDevices.length > 0) {
          // Prefer back camera
          const backCam = videoInputDevices.find((c) =>
            c.label.toLowerCase().includes("back") || c.label.toLowerCase().includes("environment")
          );
          setDeviceId(backCam ? backCam.deviceId : videoInputDevices[0].deviceId);
        } else {
          setErrorMsg("No camera found. Please connect a camera.");
        }
      })
      .catch((err) => {
        console.error("Camera access error:", err);
        setErrorMsg("Error accessing camera. Please ensure permissions are granted.");
      });

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, []);

  // Start / stop scanner based on deviceId
  useEffect(() => {
    if (!deviceId || !videoRef.current || !readerRef.current) return;

    hasScannedRef.current = false;
    setScanSuccess(false);
    setErrorMsg("");

    readerRef.current.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
      if (result && !hasScannedRef.current) {
        hasScannedRef.current = true;
        setScanSuccess(true);
        setTimeout(() => {
          onScan(result.getText());
        }, 50);
      }
      // We ignore NotFoundException as it is thrown on every frame a barcode isn't found
      if (err && !(err instanceof NotFoundException)) {
        // console.warn("Scan error (non-fatal):", err);
      }
    });

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, [deviceId, onScan]);

  const handleClose = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset();
    }
    onClose();
  }, [onClose]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setErrorMsg("");
    
    try {
      if (readerRef.current) {
         readerRef.current.reset(); // stop camera briefly
      }
      
      const imageUrl = URL.createObjectURL(file);
      const reader = new BrowserMultiFormatReader();
      
      // Use the same hints for file scan
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
      reader.hints = hints;

      const result = await reader.decodeFromImageUrl(imageUrl);
      
      if (result && !hasScannedRef.current) {
        hasScannedRef.current = true;
        setScanSuccess(true);
        
        setTimeout(() => {
          onScan(result.getText());
        }, 50);
      }
      
    } catch (err) {
      console.error("Error scanning file:", err);
      setErrorMsg("Could not find a valid barcode in the selected image.");
      
      // restart camera if it was running
      if (deviceId) {
        hasScannedRef.current = false;
        const currentId = deviceId;
        setDeviceId("");
        setTimeout(() => setDeviceId(currentId), 100);
      }
    }
    
    // clear input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "var(--bg-card, #1e293b)",
          border: "1px solid var(--border, #334155)",
          borderRadius: "24px",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.25s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border, #334155)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--pro-primary, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
              }}
            >
              <ScanLine size={18} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text-1, #f8fafc)",
                }}
              >
                Scan Barcode
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "var(--text-3, #94a3b8)",
                }}
              >
                Point camera at ISBN barcode
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: "var(--bg-input, #334155)",
                border: "1px solid var(--border, #475569)",
                padding: "0 12px",
                height: "32px",
                borderRadius: "8px",
                color: "var(--text-2, #e2e8f0)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--pro-primary, #3b82f6)";
                e.currentTarget.style.color = "var(--pro-primary, #3b82f6)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border, #475569)";
                e.currentTarget.style.color = "var(--text-2, #e2e8f0)";
              }}
            >
              <ImageIcon size={14} />
              Upload Image
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept="image/*" 
              onChange={handleFileUpload}
            />
            
            <button
              onClick={handleClose}
              style={{
                background: "var(--bg-input, #334155)",
                border: "1px solid var(--border, #475569)",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                color: "var(--text-3, #94a3b8)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.color = "#ef4444";
                e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--bg-input, #334155)";
                e.currentTarget.style.color = "var(--text-3, #94a3b8)";
                e.currentTarget.style.borderColor = "var(--border, #475569)";
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Camera Select */}
        {devices.length > 1 && (
          <div
            style={{
              padding: "12px 20px",
              background: "var(--bg-secondary, #0f172a)",
              borderBottom: "1px solid var(--border, #334155)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Camera size={14} style={{ color: "var(--text-3, #94a3b8)" }} />
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              style={{
                flex: 1,
                background: "var(--bg-input, #334155)",
                color: "var(--text-1, #f8fafc)",
                border: "1px solid var(--border, #475569)",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "12px",
                fontWeight: 600,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Video Area */}
        <div
          style={{
            position: "relative",
            aspectRatio: "4/3",
            background: "#000",
            overflow: "hidden",
          }}
        >
          <video
            ref={videoRef}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />

          {/* Scan overlay reticle */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 10
            }}
          >
            <div
              style={{
                width: "70%",
                height: "35%",
                border: `2px dashed ${scanSuccess ? "#10b981" : "rgba(255,255,255,0.5)"}`,
                borderRadius: "12px",
                position: "relative",
                transition: "border-color 0.2s",
                boxShadow: scanSuccess
                  ? "0 0 30px rgba(16,185,129,0.4)"
                  : "0 0 20px rgba(0,0,0,0.3)",
              }}
            >
              {/* Corner markers */}
              {[
                { t: -2, l: -2, b: "auto", r: "auto" },
                { t: -2, r: -2, b: "auto", l: "auto" },
                { b: -2, l: -2, t: "auto", r: "auto" },
                { b: -2, r: -2, t: "auto", l: "auto" },
              ].map((pos, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    width: "16px",
                    height: "16px",
                    borderColor: scanSuccess ? "#10b981" : "#6366f1",
                    borderStyle: "solid",
                    borderWidth: 0,
                    borderTopWidth: pos.t !== "auto" ? 3 : 0,
                    borderLeftWidth: pos.l !== "auto" ? 3 : 0,
                    borderBottomWidth: pos.b !== "auto" ? 3 : 0,
                    borderRightWidth: pos.r !== "auto" ? 3 : 0,
                    top: pos.t,
                    left: pos.l,
                    bottom: pos.b,
                    right: pos.r,
                    borderRadius: "4px",
                    transition: "border-color 0.2s",
                  }}
                />
              ))}

              {/* Laser line */}
              <div
                style={{
                  position: "absolute",
                  left: "10%",
                  right: "10%",
                  top: "50%",
                  height: "2px",
                  background: scanSuccess
                    ? "#10b981"
                    : "rgba(99,102,241,0.8)",
                  boxShadow: scanSuccess
                    ? "0 0 12px #10b981"
                    : "0 0 10px rgba(99,102,241,0.6)",
                  animation: scanSuccess ? "none" : "scanLaser 2s ease-in-out infinite",
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>

          {/* Success overlay */}
          {scanSuccess && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(16,185,129,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "fadeIn 0.2s ease",
                zIndex: 20
              }}
            >
              <div
                style={{
                  background: "rgba(16,185,129,0.9)",
                  color: "white",
                  padding: "12px 24px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                }}
              >
                <ScanLine size={18} />
                Barcode Captured!
              </div>
            </div>
          )}
        </div>

        {/* Footer / Error */}
        <div
          style={{
            padding: "14px 20px",
            background: "var(--bg-secondary, #0f172a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {errorMsg ? (
            <span
              style={{
                color: "#ef4444",
                fontSize: "12px",
                fontWeight: 600,
                flex: 1,
              }}
            >
              {errorMsg}
            </span>
          ) : (
            <span
              style={{
                color: "var(--text-3, #94a3b8)",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              {scanSuccess
                ? "Closing scanner..."
                : "Align barcode inside the frame"}
            </span>
          )}

          <button
            onClick={handleClose}
            style={{
              background: "var(--bg-input, #334155)",
              border: "1px solid var(--border, #475569)",
              color: "var(--text-2, #e2e8f0)",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#ef4444";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border, #475569)";
              e.currentTarget.style.color = "var(--text-2, #e2e8f0)";
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scanLaser {
          0%, 100% { transform: translateY(-12px); opacity: 0.6; }
          50% { transform: translateY(12px); opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
