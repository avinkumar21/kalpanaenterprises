import React, { useState, useEffect, useRef } from 'react';
import { Scissors, Check, X, RotateCw, Sparkles, RefreshCw } from 'lucide-react';

interface IdCardCropModalProps {
  isOpen: boolean;
  file: File | null;
  side: 'front' | 'back';
  onClose: () => void;
  onApplyCrop: (croppedFile: File, dataUrl: string, width: number, height: number) => void;
}

export const IdCardCropModal: React.FC<IdCardCropModalProps> = ({
  isOpen,
  file,
  side,
  onClose,
  onApplyCrop
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState<number>(0);
  const [naturalHeight, setNaturalHeight] = useState<number>(0);
  const [cropTop, setCropTop] = useState<number>(0);
  const [cropBottom, setCropBottom] = useState<number>(0);
  const [cropLeft, setCropLeft] = useState<number>(0);
  const [cropRight, setCropRight] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const draggingHandleRef = useRef<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Load image and run automatic document edge detection
  useEffect(() => {
    if (!isOpen || !file) {
      setImageUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setRotation(0);
    setIsDetecting(true);

    const img = new Image();
    img.onload = () => {
      setNaturalWidth(img.naturalWidth);
      setNaturalHeight(img.naturalHeight);

      // Perform fast client-side document boundary detection
      try {
        const thumbCanvas = document.createElement('canvas');
        const size = 160;
        thumbCanvas.width = size;
        thumbCanvas.height = size;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, size, size);
          const imgData = ctx.getImageData(0, 0, size, size).data;

          const getLuminance = (x: number, y: number) => {
            const idx = (y * size + x) * 4;
            const r = imgData[idx];
            const g = imgData[idx + 1];
            const b = imgData[idx + 2];
            return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          };

          // Sample 8x8 corner patches
          let cornerSum = 0;
          let samples = 0;
          const patchSize = 8;
          const samplePatch = (startX: number, startY: number) => {
            for (let y = startY; y < startY + patchSize; y++) {
              for (let x = startX; x < startX + patchSize; x++) {
                cornerSum += getLuminance(x, y);
                samples++;
              }
            }
          };

          samplePatch(0, 0);
          samplePatch(size - patchSize, 0);
          samplePatch(0, size - patchSize);
          samplePatch(size - patchSize, size - patchSize);

          const bgLum = Math.round(cornerSum / Math.max(1, samples));
          const isLightBg = bgLum > 185;

          const isDocumentPixel = (x: number, y: number) => {
            const lum = getLuminance(x, y);
            const diff = Math.abs(lum - bgLum);
            if (isLightBg) {
              return lum < 232 || diff > 24;
            } else {
              return lum > bgLum + 32 || diff > 40;
            }
          };

          // Scan inward
          const minD = 8;
          const maxD = Math.floor(size * 0.44);

          let startY = 0;
          for (let y = 0; y < maxD; y++) {
            let count = 0;
            for (let x = minD; x < size - minD; x++) {
              if (isDocumentPixel(x, y)) count++;
            }
            if (count >= Math.floor((size - minD * 2) * 0.18)) {
              startY = y;
              break;
            }
          }

          let endY = size;
          for (let y = size - 1; y >= size - maxD; y--) {
            let count = 0;
            for (let x = minD; x < size - minD; x++) {
              if (isDocumentPixel(x, y)) count++;
            }
            if (count >= Math.floor((size - minD * 2) * 0.18)) {
              endY = y + 1;
              break;
            }
          }

          let startX = 0;
          for (let x = 0; x < maxD; x++) {
            let count = 0;
            for (let y = minD; y < size - minD; y++) {
              if (isDocumentPixel(x, y)) count++;
            }
            if (count >= Math.floor((size - minD * 2) * 0.18)) {
              startX = x;
              break;
            }
          }

          let endX = size;
          for (let x = size - 1; x >= size - maxD; x--) {
            let count = 0;
            for (let y = minD; y < size - minD; y++) {
              if (isDocumentPixel(x, y)) count++;
            }
            if (count >= Math.floor((size - minD * 2) * 0.18)) {
              endX = x + 1;
              break;
            }
          }

          const detectedW = endX - startX;
          const detectedH = endY - startY;

          if (detectedW > 30 && detectedH > 30 && (startX > 2 || startY > 2 || endX < size - 2 || endY < size - 2)) {
            // Apply 1.5% breathing margin
            const tPct = Math.max(0, Math.round(((startY - 2) / size) * 100));
            const bPct = Math.max(0, Math.round(((size - endY - 2) / size) * 100));
            const lPct = Math.max(0, Math.round(((startX - 2) / size) * 100));
            const rPct = Math.max(0, Math.round(((size - endX - 2) / size) * 100));

            setCropTop(Math.min(40, tPct));
            setCropBottom(Math.min(40, bPct));
            setCropLeft(Math.min(40, lPct));
            setCropRight(Math.min(40, rPct));
          } else {
            // Document already covers full frame - use subtle 2% safety border
            setCropTop(2);
            setCropBottom(2);
            setCropLeft(2);
            setCropRight(2);
          }
        }
      } catch (err) {
        console.warn("Auto-detect failed:", err);
        setCropTop(2);
        setCropBottom(2);
        setCropLeft(2);
        setCropRight(2);
      } finally {
        setIsDetecting(false);
      }
    };

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [isOpen, file]);

  // Pointer event listeners for smooth handle dragging
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const handle = draggingHandleRef.current;
      if (!handle || !containerRef.current) return;
      e.preventDefault();

      const rect = containerRef.current.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const pctX = Math.round((relX / rect.width) * 100);
      const pctY = Math.round((relY / rect.height) * 100);

      if (handle.includes('top')) setCropTop(Math.min(46, Math.max(0, pctY)));
      if (handle.includes('bottom')) setCropBottom(Math.min(46, Math.max(0, 100 - pctY)));
      if (handle.includes('left')) setCropLeft(Math.min(46, Math.max(0, pctX)));
      if (handle.includes('right')) setCropRight(Math.min(46, Math.max(0, 100 - pctX)));
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      draggingHandleRef.current = null;
    };

    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  const startDrag = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    isDraggingRef.current = true;
    draggingHandleRef.current = handle;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleResetCrop = () => {
    setCropTop(0);
    setCropBottom(0);
    setCropLeft(0);
    setCropRight(0);
  };

  const handleExecuteCrop = async () => {
    if (!file || !imageUrl) return;
    setIsApplying(true);

    try {
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => {
        if (img.complete) resolve(true);
        else img.onload = () => resolve(true);
      });

      // Handle orientation-aware dimensions
      const isRotated90or270 = rotation === 90 || rotation === 270;
      const baseW = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
      const baseH = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

      // Base canvas with rotation applied
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = baseW;
      fullCanvas.height = baseH;
      const fullCtx = fullCanvas.getContext('2d');
      if (!fullCtx) throw new Error("Could not initialize canvas context");

      fullCtx.save();
      if (rotation === 90) {
        fullCtx.translate(baseW, 0);
        fullCtx.rotate((90 * Math.PI) / 180);
      } else if (rotation === 180) {
        fullCtx.translate(baseW, baseH);
        fullCtx.rotate((180 * Math.PI) / 180);
      } else if (rotation === 270) {
        fullCtx.translate(0, baseH);
        fullCtx.rotate((270 * Math.PI) / 180);
      }
      fullCtx.drawImage(img, 0, 0);
      fullCtx.restore();

      // Crop coordinates
      const cutL = Math.floor(baseW * (cropLeft / 100));
      const cutR = Math.floor(baseW * (cropRight / 100));
      const cutT = Math.floor(baseH * (cropTop / 100));
      const cutB = Math.floor(baseH * (cropBottom / 100));

      const cropW = Math.max(50, baseW - cutL - cutR);
      const cropH = Math.max(50, baseH - cutT - cutB);

      // Cropped output canvas
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = cropW;
      croppedCanvas.height = cropH;
      const cropCtx = croppedCanvas.getContext('2d');
      if (!cropCtx) throw new Error("Could not initialize cropped canvas context");

      cropCtx.drawImage(fullCanvas, cutL, cutT, cropW, cropH, 0, 0, cropW, cropH);

      // Generate clean blob & file
      const blob = await new Promise<Blob | null>((resolve) => {
        croppedCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });

      if (!blob) throw new Error("Failed to export cropped image");

      const croppedFileName = `cropped_${side}_${Date.now()}.jpg`;
      const croppedFile = new File([blob], croppedFileName, { type: 'image/jpeg' });
      const dataUrl = croppedCanvas.toDataURL('image/jpeg', 0.95);

      onApplyCrop(croppedFile, dataUrl, cropW, cropH);
      onClose();
    } catch (err: any) {
      console.error("Crop application failed:", err);
      alert("Failed to apply crop: " + err.message);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen || !file) return null;

  // Estimated cropped dimensions display
  const isRotated = rotation === 90 || rotation === 270;
  const currentBaseW = isRotated ? naturalHeight : naturalWidth;
  const currentBaseH = isRotated ? naturalWidth : naturalHeight;
  const estimatedW = Math.round(currentBaseW * ((100 - cropLeft - cropRight) / 100));
  const estimatedH = Math.round(currentBaseH * ((100 - cropTop - cropBottom) / 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-slate-900 border-2 border-indigo-500/60 shadow-2xl overflow-hidden text-white">
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>Crop Document Boundaries</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {side === 'front' ? '1️⃣ Front Side' : '2️⃣ Back Side'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                {isDetecting ? '🤖 AI Auto-Detecting document edges...' : '✨ Edges auto-framed. Adjust blue handles or click Apply Crop.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Rotate 90 degrees"
            >
              <RotateCw className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Rotate 90°</span>
            </button>

            <button
              type="button"
              onClick={handleResetCrop}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Reset to full frame"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Full Frame</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CROP WORKSPACE WITH TRANSPARENT CHECKERBOARD PATTERN */}
        <div
          className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[360px] max-h-[64vh] select-none"
          style={{
            backgroundColor: '#0a0d14',
            backgroundImage: `
              linear-gradient(45deg, #131722 25%, transparent 25%),
              linear-gradient(-45deg, #131722 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #131722 75%),
              linear-gradient(-45deg, transparent 75%, #131722 75%)
            `,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px'
          }}
        >
          {imageUrl && (
            <div
              ref={containerRef}
              className="relative inline-block select-none shadow-2xl border border-slate-800 rounded-lg overflow-hidden"
              style={{ maxHeight: '58vh' }}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop Target"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  maxHeight: '58vh',
                  maxWidth: '100%',
                  display: 'block'
                }}
                className="object-contain pointer-events-none select-none transition-transform duration-200"
              />

              {/* DARK SURROUNDING MASKS (OUTSIDE CROP BOX) */}
              <div
                className="absolute top-0 left-0 right-0 bg-black/65 pointer-events-none"
                style={{ height: `${cropTop}%` }}
              />
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/65 pointer-events-none"
                style={{ height: `${cropBottom}%` }}
              />
              <div
                className="absolute left-0 bg-black/65 pointer-events-none"
                style={{
                  top: `${cropTop}%`,
                  bottom: `${cropBottom}%`,
                  width: `${cropLeft}%`
                }}
              />
              <div
                className="absolute right-0 bg-black/65 pointer-events-none"
                style={{
                  top: `${cropTop}%`,
                  bottom: `${cropBottom}%`,
                  width: `${cropRight}%`
                }}
              />

              {/* ACTIVE CROP BOX WITH 8 HANDLES AND RULE-OF-THIRDS GRID */}
              <div
                className="absolute border-2 border-blue-400 select-none shadow-[0_0_12px_rgba(59,130,246,0.5)] cursor-move"
                style={{
                  top: `${cropTop}%`,
                  bottom: `${cropBottom}%`,
                  left: `${cropLeft}%`,
                  right: `${cropRight}%`
                }}
              >
                {/* 3x3 RULE-OF-THIRDS GRID LINES */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/25" />
                  <div className="border-r border-b border-white/25" />
                  <div className="border-b border-white/25" />
                  <div className="border-r border-b border-white/25" />
                  <div className="border-r border-b border-white/25" />
                  <div className="border-b border-white/25" />
                  <div className="border-r border-b border-white/25" />
                  <div className="border-r border-b border-white/25" />
                  <div />
                </div>

                {/* 4 CORNER HANDLES */}
                <div
                  onPointerDown={(e) => startDrag(e, 'top-left')}
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-blue-400 border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'top-right')}
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-blue-400 border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'bottom-left')}
                  className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-blue-400 border-2 border-white rounded-full shadow-lg cursor-nesw-resize hover:scale-125 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'bottom-right')}
                  className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-blue-400 border-2 border-white rounded-full shadow-lg cursor-nwse-resize hover:scale-125 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />

                {/* 4 EDGE CENTER HANDLES */}
                <div
                  onPointerDown={(e) => startDrag(e, 'top')}
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-blue-400 border border-white rounded shadow cursor-ns-resize hover:scale-110 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'bottom')}
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-3 bg-blue-400 border border-white rounded shadow cursor-ns-resize hover:scale-110 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'left')}
                  className="absolute top-1/2 -left-2 -translate-y-1/2 w-3 h-6 bg-blue-400 border border-white rounded shadow cursor-ew-resize hover:scale-110 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
                <div
                  onPointerDown={(e) => startDrag(e, 'right')}
                  className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-6 bg-blue-400 border border-white rounded shadow cursor-ew-resize hover:scale-110 transition-transform z-30"
                  style={{ touchAction: 'none' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs font-bold border border-slate-700">
              📐 Cropped: {estimatedW} × {estimatedH} px
            </span>
            {isDetecting && (
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Auto-Detecting document boundary...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteCrop}
              disabled={isApplying}
              style={{ backgroundColor: '#6366f1', color: '#ffffff', border: '1px solid #818cf8' }}
              className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 shadow-lg cursor-pointer flex items-center gap-2 transition transform active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isApplying ? 'Applying Crop...' : 'Apply Crop'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
