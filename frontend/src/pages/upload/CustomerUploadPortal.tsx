import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/client';
import { Upload, FileText, CheckCircle2, AlertCircle, Printer, Sparkles, QrCode, Copy, RefreshCw, Layers, Palette, Monitor } from 'lucide-react';
import QRCode from 'react-qr-code';

declare const __LOCAL_IP__: string | undefined;

interface CustomerUploadPortalProps {
  isCustomerKiosk?: boolean;
}

export const CustomerUploadPortal: React.FC<CustomerUploadPortalProps> = ({ isCustomerKiosk = false }) => {
  const isKioskMode = isCustomerKiosk || (typeof window !== 'undefined' && (window.location.hash.includes('customer') || window.location.hash.includes('kiosk') || window.location.search.includes('customer') || window.location.search.includes('kiosk')));

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<'Color' | 'Black & White'>('Color');
  
  const [uploading, setUploading] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Counter QR Display Toggle (For Shop Operator Desk View)
  const [showQrModal, setShowQrModal] = useState(false);
  const [shopLanIp, setShopLanIp] = useState(() => {
    try {
      if (typeof __LOCAL_IP__ !== 'undefined' && __LOCAL_IP__ && __LOCAL_IP__ !== 'localhost') {
        return __LOCAL_IP__;
      }
    } catch (e) {}
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.hostname;
    }
    return '192.168.31.242'; // Permanent Shop Desktop IP (192.168.31.242)
  });
  const [port, setPort] = useState(() => {
    if (typeof window !== 'undefined' && window.location.port && window.location.port !== '80' && window.location.port !== '8082') {
      return window.location.port;
    }
    return ''; // Standard HTTP Port 80 requires NO port number in mobile browser URL
  });
  const [accessMode, setAccessMode] = useState<'wifi' | 'mobile_web' | 'email'>(() => {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('trycloudflare') || window.location.hostname.includes('tunnel') || window.location.hostname.includes('loca.lt'))) {
      return 'mobile_web';
    }
    return 'wifi';
  });
  const [publicTunnelUrl, setPublicTunnelUrl] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('arka_tunnel_url');
      if (saved && saved.includes('trycloudflare.com') && !saved.includes('occurrence-selected-cons-recently')) return saved;
    }
    return 'https://protein-myspace-illustration-daily.trycloudflare.com';
  });
  const [shopEmail, setShopEmail] = useState('print@kalpanaenterprise.com');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage && publicTunnelUrl) {
      window.localStorage.setItem('arka_tunnel_url', publicTunnelUrl);
    }
  }, [publicTunnelUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file?: File) => {
    setErrorMessage(null);
    setSuccessData(null);
    if (!file) return;
    
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'image/bmp'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc', '.bmp'];

    if (!allowedExts.includes(ext)) {
      setErrorMessage(`Unsupported file format (${ext}). Please select a PDF, PNG, JPG, JPEG, or DOCX file.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Helper: Auto-compress high-resolution mobile camera photos (> 1.5MB) before transfer to prevent slow cellular timeouts or network drops!
  const prepareFileForUpload = async (file: File): Promise<File> => {
    if (!file.type.startsWith('image/') || file.size < 1500000) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      let { width, height } = bitmap;
      const maxDim = 3200; // 3200px is crystal clear for 300 DPI A4 printing
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
      }
      return await new Promise<File>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob && blob.size < file.size) {
            const optimizedName = file.name.replace(/\.[^/.]+$/, "") + '.jpg';
            resolve(new File([blob], optimizedName, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.88);
      });
    } catch (e) {
      console.warn('Image compression failed, proceeding with original file:', e);
      return file;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please choose a document or image file before submitting.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    try {
      // Optimize large mobile camera photos before transfer for instant < 1s submission!
      const fileToUpload = await prepareFileForUpload(selectedFile);
      const result = await api.uploadDocument(fileToUpload, copies, colorMode);
      if (result.success) {
        setSuccessData({
          filename: fileToUpload.name,
          copies,
          colorMode,
          timestamp: new Date().toLocaleTimeString()
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setErrorMessage(result.error || 'Failed to transfer document to server.');
      }
    } catch (err: any) {
      setErrorMessage(
        accessMode === 'wifi'
          ? 'Network connection interrupted. Please ensure your phone is connected to the Shop Wi-Fi network and try again.'
          : 'Mobile web tunnel connection timed out or dropped by cellular network. Please click submit again, or connect to Shop Wi-Fi.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadQrPng = () => {
    const svgElement = document.querySelector('.qr-canvas-container svg') as SVGSVGElement | null;
    if (!svgElement) {
      alert("QR Code element not found for download!");
      return;
    }
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URL = window.URL || window.webkitURL || window;
    const blobURL = URL.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 1800;
      const context = canvas.getContext('2d');
      if (context) {
        // Pristine white background
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Luxury Double-Border Frame: Outer Dark Navy + Inner Emerald Accent
        context.strokeStyle = '#0f172a';
        context.lineWidth = 32;
        context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

        context.strokeStyle = '#10b981';
        context.lineWidth = 8;
        context.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

        // Header Title (Kannada & English Centered & Beautifully Spaced)
        context.fillStyle = '#047857';
        context.font = 'bold 64px Arial, sans-serif';
        context.textAlign = 'center';
        context.fillText('ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್', 700, 155);
        
        context.fillStyle = '#0f172a';
        context.font = 'bold 44px Arial, sans-serif';
        context.fillText('KALPANA ENTERPRISES', 700, 220);

        // Vibrant Pill Badge for Scan Instruction
        context.fillStyle = '#047857';
        context.beginPath();
        if (context.roundRect) {
          context.roundRect(140, 255, 1120, 85, 42);
        } else {
          context.rect(140, 255, 1120, 85);
        }
        context.fill();

        context.fillStyle = '#FFFFFF';
        context.font = 'bold 34px Arial, sans-serif';
        context.fillText('📲 ಪ್ರಿಂಟ್ ಮಾಡಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ • SCAN TO PRINT', 700, 312);

        // QR Code Box Frame (Centered with Drop-Shadow Effect & Padding)
        context.fillStyle = '#f8fafc';
        context.strokeStyle = '#10b981';
        context.lineWidth = 6;
        context.beginPath();
        if (context.roundRect) {
          context.roundRect(260, 385, 880, 880, 35);
        } else {
          context.rect(260, 385, 880, 880);
        }
        context.fill();
        context.stroke();

        // Draw crisp QR code perfectly centered with balanced white space
        context.drawImage(image, 310, 435, 780, 780);

        // Network URL Card (No Clipping, Auto-Scaled Monospace)
        context.fillStyle = '#f1f5f9';
        context.strokeStyle = '#cbd5e1';
        context.lineWidth = 3;
        context.beginPath();
        if (context.roundRect) {
          context.roundRect(90, 1310, 1220, 210, 25);
        } else {
          context.rect(90, 1310, 1220, 210);
        }
        context.fill();
        context.stroke();

        context.fillStyle = '#475569';
        context.font = 'bold 28px Arial, sans-serif';
        context.fillText('🌐 ಶಾಪ್ ವೈ-ಫೈ / 4G ಮೊಬೈಲ್ ಲಿಂಕ್ (Direct Portal URL):', 700, 1365);

        const displayUrl = typeof window !== 'undefined' ? `${window.location.origin}/prints?kiosk=true#upload` : '';
        context.fillStyle = '#0f172a';
        // Auto-adjust font size if URL is long so it NEVER clips or touches borders!
        const urlFontSize = displayUrl.length > 65 ? 23 : displayUrl.length > 55 ? 25 : displayUrl.length > 45 ? 28 : 32;
        context.font = `bold ${urlFontSize}px monospace`;
        context.fillText(displayUrl, 700, 1445);

        context.fillStyle = '#059669';
        context.font = 'bold 26px Arial, sans-serif';
        context.fillText('⚡ ಆಟೋಮ್ಯಾಟಿಕ್ ಪ್ರಿಂಟ್ ಸಿಸ್ಟಮ್ (Instant Spooling Engine)', 700, 1495);

        // Bottom Footer Guidance (Sized to fit cleanly with zero edge clipping!)
        context.fillStyle = '#047857';
        context.font = 'bold 32px Arial, sans-serif';
        context.fillText('ಡಾಕ್ಯುಮೆಂಟ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಮೊಬೈಲ್ ಕ್ಯಾಮರಾದಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ!', 700, 1605);
        
        context.fillStyle = '#64748b';
        context.font = 'bold 28px Arial, sans-serif';
        context.fillText('Scan with smartphone camera to upload & print documents instantly!', 700, 1665);

        context.fillStyle = '#94a3b8';
        context.font = 'bold 22px Arial, sans-serif';
        context.fillText('⚡ Powered by Kalpana Enterprises Auto WhatsApp Print Engine V2', 700, 1730);

        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `Kalpana_Enterprises_Counter_QR_${accessMode}_${Date.now()}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
      URL.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  const handlePrintA4Sign = () => {
    const displayUrl = typeof window !== 'undefined' ? `${window.location.origin}/prints?kiosk=true#upload` : '';
    const svgElement = document.querySelector('.qr-canvas-container svg') as SVGSVGElement | null;
    const svgContent = svgElement ? new XMLSerializer().serializeToString(svgElement) : '';
    
    const win = window.open('', '_blank', 'width=850,height=1100');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Kalpana Enterprises - Shop Counter Sign</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              margin: 0; 
              padding: 35px; 
              border: 12px solid #0f172a;
              outline: 5px solid #059669;
              outline-offset: -25px; 
              border-radius: 24px;
              background-color: #ffffff;
              box-sizing: border-box;
            }
            .title-kannada { font-size: 50px; font-weight: 900; color: #047857; margin-top: 10px; margin-bottom: 5px; }
            .title-english { font-size: 34px; font-weight: 900; color: #0f172a; margin-top: 0; margin-bottom: 25px; letter-spacing: 2px; }
            .badge { display: inline-block; padding: 14px 40px; background: #047857; color: #ffffff; font-size: 26px; font-weight: bold; border-radius: 50px; margin-bottom: 35px; box-shadow: 0 6px 15px rgba(4, 120, 87, 0.3); }
            .qr-box { width: 500px; height: 500px; margin: 0 auto 35px auto; padding: 28px; border: 6px solid #10b981; border-radius: 30px; background: #f8fafc; box-shadow: 0 10px 25px rgba(0,0,0,0.08); }
            .qr-box svg { width: 100% !important; height: 100% !important; }
            .url-box { margin-bottom: 30px; background: #f1f5f9; padding: 18px 20px; border: 2px solid #cbd5e1; border-radius: 16px; }
            .url-label { font-size: 20px; color: #64748b; font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
            .url-text { font-size: 24px; font-family: 'Courier New', monospace; font-weight: bold; color: #0f172a; word-break: break-all; }
            .instructions-kn { font-size: 24px; font-weight: 900; color: #047857; margin-bottom: 12px; line-height: 1.4; word-wrap: break-word; }
            .instructions-en { font-size: 22px; color: #475569; font-weight: bold; }
            .footer { margin-top: 45px; font-size: 16px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 20px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="title-kannada">ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್</div>
          <div class="title-english">KALPANA ENTERPRISES</div>
          <div class="badge">📲 ಪ್ರಿಂಟ್ ಮಾಡಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ • SCAN TO PRINT</div>
          <div class="qr-box">${svgContent}</div>
          <div class="url-box">
            <div class="url-label">🌐 ಶಾಪ್ ವೈ-ಫೈ / 4G ಮೊಬೈಲ್ ಲಿಂಕ್:</div>
            <div class="url-text">${displayUrl}</div>
          </div>
          <div class="instructions-kn">ಡಾಕ್ಯುಮೆಂಟ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಮೊಬೈಲ್ ಕ್ಯಾಮರಾದಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ!</div>
          <div class="instructions-en">Scan with smartphone camera to upload & print documents instantly!</div>
          <div class="footer">⚡ Powered by Kalpana Enterprises Auto WhatsApp Print Engine V2</div>
        </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  const portSuffix = port && port !== '80' ? `:${port}` : '';
  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/prints?kiosk=true#upload` : '';

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-300 text-white font-sans">
      
      {/* Top Banner / Operator Toggle */}
      <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-purple-500 shadow-2xl flex-wrap gap-3" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/30 text-purple-300 rounded-xl shadow-inner">
            <Sparkles className="w-7 h-7 animate-bounce text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2 flex-wrap">
              <span>{isKioskMode ? '⚡ ಕಲ್ಪന ಎಂಟರ್ಪ್ರೈಸಸ್ • Express Document Intake' : 'ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್ • Print Your Files Here'}</span>
            </h1>
            <p className="text-xs font-extrabold text-cyan-300">
              {isKioskMode ? '📥 ಇಲ್ಲಿ ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್ ಅಥವಾ ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ • Instant File Drop & Automatic Print Engine' : '📱 Scan QR to Upload Files (ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ)'}
            </p>
          </div>
        </div>

        {!isKioskMode && (
          <button
            type="button"
            onClick={() => setShowQrModal(!showQrModal)}
            style={{ backgroundColor: showQrModal ? '#4c1d95' : '#1e293b', border: '2px solid #a855f7', color: '#ffffff' }}
            className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide flex items-center gap-2 hover:opacity-90 transition shadow-lg cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>{showQrModal ? 'Close Counter Sign (ಮುಚ್ಚಿರಿ)' : '🖥️ Show QR Code to Customer'}</span>
          </button>
        )}
      </div>

      {/* COUNTER QR SIGN MODAL / PANEL (For Shop Desktop Monitor - Restricted from Kiosk) */}
      {!isKioskMode && showQrModal && (
        <div className="p-6 md:p-8 rounded-3xl border-4 border-emerald-400 shadow-2xl space-y-6 animate-in slide-in-from-top-4 duration-300" style={{ backgroundColor: '#022c22', color: '#ffffff', boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)' }}>
          
          <div className="flex items-center justify-between border-b-2 border-emerald-500/80 pb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-400 text-slate-950 rounded-xl font-black shadow-lg">
                <Monitor className="w-7 h-7 text-slate-950" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                  Shop Desktop Counter Access Display
                </h3>
                <p style={{ color: '#a7f3d0' }} className="text-xs font-bold mt-0.5">
                  Multi-Channel Express Intake • Support for Wi-Fi & 4G/5G Mobile Cellular Users!
                </p>
              </div>
            </div>
            <span style={{ backgroundColor: '#047857', color: '#fef08a', border: '2px solid #34d399' }} className="text-xs font-black px-4 py-1.5 rounded-xl uppercase tracking-wider shadow-lg">
              🟢 Zero-Cost Channel Active
            </span>
          </div>

          {/* 3-MODE ACCESS SWITCHER (SOLVES WI-FI SHARING RESTRICTIONS) */}
          <div className="space-y-3 bg-emerald-950/90 p-4 rounded-2xl border border-emerald-500/60 shadow-inner">
            <label style={{ color: '#fef08a' }} className="text-xs font-black uppercase tracking-wider block">
              🛠️ Select Customer Scan & Connect Method:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setAccessMode('wifi')}
                style={accessMode === 'wifi' 
                  ? { backgroundColor: '#047857', border: '2px solid #34d399', color: '#ffffff', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm">📡 Shop Wi-Fi / LAN</span>
                <span className="text-[10px] opacity-80 font-bold">Direct Network IP ({shopLanIp})</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('mobile_web')}
                style={accessMode === 'mobile_web' 
                  ? { backgroundColor: '#1e40af', border: '2px solid #60a5fa', color: '#ffffff', boxShadow: '0 0 15px rgba(96, 165, 250, 0.4)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm">🌐 4G/5G Mobile Web Tunnel</span>
                <span className="text-[10px] opacity-80 font-bold">No Wi-Fi Password Required!</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('email')}
                style={accessMode === 'email' 
                  ? { backgroundColor: '#6b21a8', border: '2px solid #c084fc', color: '#ffffff', boxShadow: '0 0 15px rgba(192, 132, 252, 0.4)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm">📧 4G/5G Email Scan Drop</span>
                <span className="text-[10px] opacity-80 font-bold">Instant Email Attachment Watcher</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center pt-2">
            
            {/* LEFT CONFIGURATION PANEL BASED ON MODE */}
            <div className="space-y-5">
              
              {accessMode === 'wifi' && (
                <>
                  <div style={{ backgroundColor: '#064e3b', border: '2px solid #10b981' }} className="p-5 rounded-2xl shadow-xl space-y-3">
                    <p style={{ color: '#ffffff' }} className="text-sm md:text-base font-black leading-relaxed">
                      For devices connected to your shop Wi-Fi! Customers point their phone camera at the QR code on the right to open this portal instantly over the local network.
                    </p>
                  </div>
                  <div className="space-y-4 p-5 rounded-2xl border-2 border-emerald-500 shadow-inner" style={{ backgroundColor: '#042f2c' }}>
                    <div>
                      <label style={{ color: '#fde047' }} className="text-xs font-black uppercase tracking-wider block mb-2">
                        Select Shop Hardware Host IP Address:
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setShopLanIp('192.168.31.233')}
                          style={{ backgroundColor: shopLanIp === '192.168.31.233' ? '#0284c7' : '#1e293b', border: '2px solid #38bdf8', color: '#ffffff' }}
                          className="px-3 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow cursor-pointer hover:brightness-110"
                        >
                          <span>💻 Active Here: Laptop (192.168.31.233)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShopLanIp('192.168.31.242')}
                          style={{ backgroundColor: shopLanIp === '192.168.31.242' ? '#059669' : '#1e293b', border: '2px solid #34d399', color: '#ffffff' }}
                          className="px-3 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow cursor-pointer hover:brightness-110"
                        >
                          <span>🖥️ Optiplex PC (192.168.31.242)</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={shopLanIp}
                        onChange={(e) => setShopLanIp(e.target.value)}
                        placeholder="e.g. 192.168.31.242"
                        style={{ backgroundColor: '#0f172a', color: '#ffffff', border: '2px solid #38bdf8' }}
                        className="w-full rounded-xl px-4 py-3 font-mono text-base font-black focus:outline-none focus:ring-2 focus:ring-cyan-400 shadow-inner"
                      />
                      <span style={{ color: '#6ee7b7' }} className="text-[11px] block mt-1.5 font-bold">
                        💡 Both PCs operate under your ARKA Wi-Fi router subnet (192.168.31.1).
                      </span>
                    </div>
                  </div>
                </>
              )}

              {accessMode === 'mobile_web' && (
                <>
                  <div style={{ backgroundColor: '#1e3a8a', border: '2px solid #60a5fa' }} className="p-5 rounded-2xl shadow-xl space-y-3">
                    <p style={{ color: '#ffffff' }} className="text-sm md:text-base font-black leading-relaxed">
                      Allow customers on their 4G/5G cellular network to upload files without giving them your shop Wi-Fi password!
                    </p>
                    <p style={{ color: '#93c5fd' }} className="text-xs font-bold">
                      🚀 <span className="text-white">To start a live tunnel:</span> Run our 1-click helper script <span className="font-mono text-yellow-300">d:\Arka\tools\start_mobile_tunnel.ps1</span> on your desktop!
                    </p>
                    <p style={{ color: '#34d399' }} className="text-[11px] font-black">
                      ✨ Powered by Cloudflare Quick Tunnels — Customers open your portal INSTANTLY on 4G/5G with ZERO warning pages, ZERO CAPTCHAs, and ZERO IP address prompts!
                    </p>
                  </div>
                  <div className="space-y-4 p-5 rounded-2xl border-2 border-blue-500 shadow-inner" style={{ backgroundColor: '#0f172a' }}>
                    <div>
                      <label style={{ color: '#fde047' }} className="text-xs font-black uppercase tracking-wider block mb-2">
                        Cloudflare Public HTTPS Address:
                      </label>
                      <input
                        type="text"
                        value={publicTunnelUrl}
                        onChange={(e) => setPublicTunnelUrl(e.target.value)}
                        placeholder="https://your-shop-tunnel.trycloudflare.com"
                        style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #60a5fa' }}
                        className="w-full rounded-xl px-4 py-3 font-mono text-base font-black focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-inner"
                      />
                    </div>
                  </div>
                </>
              )}

              {accessMode === 'email' && (
                <>
                  <div style={{ backgroundColor: '#581c87', border: '2px solid #c084fc' }} className="p-5 rounded-2xl shadow-xl space-y-3">
                    <p style={{ color: '#ffffff' }} className="text-sm md:text-base font-black leading-relaxed">
                      100% Free 4G/5G Cellular Intake via your Automated Email Watcher! When customers scan this QR code on 4G/5G, their mobile email app opens immediately with your shop address pre-filled!
                    </p>
                    <p style={{ color: '#e9d5ff' }} className="text-xs font-bold">
                      They attach their file and press Send. Your desktop background IMAP Watcher extracts the attachment directly into <span className="font-mono text-amber-300">D:\whatspp</span> within seconds!
                    </p>
                  </div>
                  <div className="space-y-4 p-5 rounded-2xl border-2 border-purple-500 shadow-inner" style={{ backgroundColor: '#0f172a' }}>
                    <div>
                      <label style={{ color: '#fde047' }} className="text-xs font-black uppercase tracking-wider block mb-2">
                        Shop Inbox Address for Automatic Downloader:
                      </label>
                      <input
                        type="text"
                        value={shopEmail}
                        onChange={(e) => setShopEmail(e.target.value)}
                        placeholder="print@kalpanaenterprise.com"
                        style={{ backgroundColor: '#1e293b', color: '#ffffff', border: '2px solid #c084fc' }}
                        className="w-full rounded-xl px-4 py-3 font-mono text-base font-black focus:outline-none focus:ring-2 focus:ring-purple-400 shadow-inner"
                      />
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Real Scanning Counter QR Frame (High Contrast Obsidian & Gold Banner) */}
            <div 
              style={{ backgroundColor: '#090d16', border: '4px solid #34d399', boxShadow: '0 0 35px rgba(52, 211, 153, 0.4)' }} 
              className="flex flex-col items-center justify-center p-7 rounded-3xl text-center space-y-5 shadow-2xl mx-auto max-w-sm w-full"
            >
              <div className="space-y-1">
                <span style={{ backgroundColor: '#312e81', color: '#c7d2fe', border: '1px solid #6366f1' }} className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block shadow">
                  {accessMode === 'wifi' ? 'Wi-Fi Instant Drop' : accessMode === 'mobile_web' ? '4G/5G Public Tunnel' : '4G/5G Email Express'}
                </span>
                <h4 style={{ color: '#ffffff' }} className="font-black text-2xl md:text-3xl uppercase tracking-wider drop-shadow-md pt-1">
                  📲 SCAN TO PRINT
                </h4>
                <p style={{ color: '#34d399' }} className="text-xs font-extrabold uppercase tracking-wide">
                  {accessMode === 'email' ? 'Scan to Email File Automatically' : 'Point Camera to Send Files to Printer'}
                </p>
              </div>

              {/* Real QR Code Canvas Wrapper with High Contrast Pure White Background */}
              <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '24px', border: '5px solid #10b981', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8)' }} className="qr-canvas-container flex items-center justify-center w-full max-w-[240px] aspect-square transition-transform hover:scale-105">
                <QRCode
                  value={portalUrl}
                  size={200}
                  style={{ height: "auto", maxWidth: "100%", width: "200px" }}
                  viewBox={`0 0 256 256`}
                  fgColor="#000000"
                  bgColor="#ffffff"
                />
              </div>

              {/* INSTANT DOWNLOAD & PRINT BUTTONS (FOR PASTE / WALL DISPLAY) */}
              <div className="flex flex-col gap-2.5 w-full pt-1">
                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  style={{ backgroundColor: '#047857', border: '2px solid #34d399', color: '#ffffff', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)' }}
                  className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  title="Download ultra-high resolution PNG file to take printouts and share"
                >
                  <span>📥 Download QR Code PNG (QR ಕೋಡ್ ಡೌನ್‌ಲೋಡ್)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintA4Sign}
                  style={{ backgroundColor: '#1e40af', border: '2px solid #60a5fa', color: '#ffffff', boxShadow: '0 0 15px rgba(96, 165, 250, 0.4)' }}
                  className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  title="Print a ready-made A4 shop wall & desk poster sign immediately"
                >
                  <span>🖨️ Print A4 Counter Poster (A4 ಪೋಸ್ಟರ್ ಪ್ರಿಂಟ್ ಮಾಡಿ)</span>
                </button>
              </div>

              <div className="w-full space-y-2">
                <div style={{ backgroundColor: '#1e293b', color: '#fde047', border: '2px solid #38bdf8' }} className="py-2.5 px-3 rounded-xl shadow-inner text-center">
                  <span className="text-[10px] uppercase font-black text-cyan-300 block mb-0.5">
                    {accessMode === 'wifi' ? 'Or Open Link on Shop Wi-Fi (ಲಿಂಕ್ ತೆರೆಯಿರಿ):' : accessMode === 'mobile_web' ? 'Or Open in 4G/5G Browser:' : 'Or Send File by Email To:'}
                  </span>
                  <div className="font-mono text-center break-all select-all selection:bg-emerald-500 selection:text-white" style={{ fontSize: '10px' }}>
                    {portalUrl}
                  </div>
                </div>
                <p style={{ color: '#cbd5e1' }} className="text-[11px] font-extrabold">
                  ⚡ Auto-Spooling via EPSON & HP Printers (ಆಟೋಮ್ಯಾಟಿಕ್ ಪ್ರಿಂಟಿಂಗ್)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS CARD BANNER */}
      {successData && (
        <div style={{ backgroundColor: '#064e3b', border: '3px solid #34d399', color: '#ffffff' }} className="p-6 rounded-3xl shadow-2xl animate-in zoom-in duration-300 space-y-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500 rounded-2xl text-slate-950 shadow-lg font-extrabold flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase">ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್ ಪ್ರಿಂಟ್‌ಗೆ ಕಳುಹಿಸಲಾಗಿದೆ! (Document Sent to Printer)</h2>
              <p className="text-sm font-extrabold text-emerald-200">Our automated engine has staged your file in D:\WhatsApp for high-speed printing.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-xs font-bold">
            <div>
              <span className="text-emerald-400 block uppercase font-black">ಫೈಲ್ ಹೆಸರು (Document Name)</span>
              <span className="text-white font-mono truncate block mt-0.5">{successData.filename}</span>
            </div>
            <div>
              <span className="text-emerald-400 block uppercase font-black">ಪ್ರತಿಗಳ ಸಂಖ್ಯೆ (Copies)</span>
              <span className="text-white font-mono block mt-0.5">{successData.copies} Copy(s) / ಪ್ರತಿಗಳು</span>
            </div>
            <div>
              <span className="text-emerald-400 block uppercase font-black">ಪ್ರಿಂಟ್ ಮೋಡ್ (Color Mode)</span>
              <span className="text-white font-mono block mt-0.5">{successData.colorMode} Mode</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSuccessData(null)}
            style={{ backgroundColor: '#ffffff', color: '#064e3b', border: '2px solid #34d399' }}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-emerald-100 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>ಮತ್ತೊಂದು ಡಾಕ್ಯುಮೆಂಟ್ ಕಳುಹಿಸಿ (Submit Another Document)</span>
          </button>
        </div>
      )}

      {/* ERROR MESSAGE BANNER */}
      {errorMessage && (
        <div style={{ backgroundColor: '#7f1d1d', border: '2px solid #f87171', color: '#ffffff' }} className="p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-shake">
          <AlertCircle className="w-7 h-7 text-red-300 flex-shrink-0 animate-pulse" />
          <div className="flex-1 text-sm font-extrabold">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="font-black px-3 py-1 bg-red-950 rounded hover:bg-red-900 transition">✕</button>
        </div>
      )}

      {/* MAIN DOCUMENT UPLOAD FORM */}
      {!successData && (
        <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-3xl shadow-2xl border-2 border-slate-700 space-y-6" style={{ backgroundColor: '#0c1322', backgroundImage: 'radial-gradient(ellipse at 50% 10%, #1e293b 0%, #0c1322 90%)' }}>
          
          <div className="border-b-2 border-slate-800 pb-4">
            <h2 className="text-xl font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2 flex-wrap">
              <Upload className="w-6 h-6 text-cyan-400" />
              <span>ಇಲ್ಲಿ ಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ • Customer Document Express Drop</span>
            </h2>
            <p className="text-xs text-slate-300 font-extrabold mt-1">ನಿಮ್ಮ PDF, ಫೋಟೋ ಅಥವಾ Word ಡಾಕ್ಯುಮೆಂಟ್ ಆಯ್ಕೆಮಾಡಿ (Select your document below to trigger automatic shop printing).</p>
          </div>

          {/* DRAG & DROP / FILE SELECTION ZONE */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              backgroundColor: isDragging ? '#1e293b' : '#0f172a',
              border: `3px dashed ${isDragging ? '#38bdf8' : selectedFile ? '#10b981' : '#64748b'}`
            }}
            className="p-8 rounded-2xl transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[220px] shadow-inner hover:border-cyan-400 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.bmp"
              className="hidden"
            />

            {selectedFile ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="p-4 bg-emerald-600/30 text-emerald-300 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-emerald-500/40 shadow-lg">
                  <FileText className="w-9 h-9 text-emerald-400 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white truncate max-w-md mx-auto">{selectedFile.name}</h4>
                  <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-950 px-3.5 py-1.5 rounded-full border border-emerald-600 inline-block mt-1">
                    🟢 ಪ್ರಿಂಟ್‌ಗೆ ಸಿದ್ಧವಾಗಿದೆ • Ready ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-bold underline group-hover:text-white transition">ಬೇರೆ ಫೈಲ್ ಆಯ್ಕೆ ಮಾಡಲು ಇಲ್ಲಿ ಕ್ಲಿಕ್ ಮಾಡಿ • (Tap to change file)</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-cyan-500/20 text-cyan-400 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-cyan-500/30 group-hover:scale-110 transition shadow-lg">
                  <Upload className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-lg md:text-xl font-black text-white">ಇಲ್ಲಿ ಟಚ್ ಮಾಡಿ ಅಥವಾ ಫೈಲ್ ಡ್ರಾಪ್ ಮಾಡಿ (Tap Here or Drop File)</h4>
                  <p className="text-xs font-bold text-cyan-200 mt-1">ಬೆಂಬಲಿತ ಫೈಲ್‌ಗಳು • Supported Formats: <span className="text-amber-300 font-mono">PDF, PNG, JPG, JPEG, DOCX</span></p>
                </div>
                <div className="pt-2">
                  <span className="px-5 py-2.5 rounded-xl bg-cyan-600 text-black font-black text-xs uppercase tracking-wider shadow-lg inline-block hover:bg-cyan-400 transition">
                    📂 ಮೊಬೈಲ್ / ಡೆಸ್ಕ್‌ಟಾಪ್ ಫೈಲ್ ತೆರೆಯಿರಿ (Browse Files)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* SETTINGS (COPIES & COLOR MODE) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* NUMBER OF COPIES */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>ಪ್ರತಿಗಳ ಸಂಖ್ಯೆ • Number of Copies</span>
              </label>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCopies(c => Math.max(1, c - 1))}
                  style={{ backgroundColor: '#1e293b', border: '2px solid #64748b', color: '#ffffff' }}
                  className="w-12 h-12 rounded-xl font-black text-xl flex items-center justify-center hover:bg-slate-700 transition cursor-pointer active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={copies}
                  onChange={(e) => setCopies(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  style={{ backgroundColor: '#0f172a', border: '2px solid #38bdf8', color: '#ffffff' }}
                  className="flex-1 h-12 rounded-xl text-center font-black font-mono text-lg focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setCopies(c => Math.min(50, c + 1))}
                  style={{ backgroundColor: '#1e293b', border: '2px solid #38bdf8', color: '#ffffff' }}
                  className="w-12 h-12 rounded-xl font-black text-xl flex items-center justify-center hover:bg-cyan-900 transition cursor-pointer active:scale-95"
                >
                  +
                </button>
              </div>
              <span className="text-[11px] text-slate-400 block font-bold">ಗರಿಷ್ಠ 50 ಪ್ರತಿಗಳು • Up to 50 copies per single submission.</span>
            </div>

            {/* COLOR MODE SELECTION */}
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <label className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                <span>ಪ್ರಿಂಟ್ ಮೋಡ್ • Color Mode Selection</span>
              </label>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setColorMode('Color')}
                  style={colorMode === 'Color'
                    ? { backgroundColor: '#047857', color: '#ffffff', border: '2px solid #34d399', boxShadow: '0 0 12px rgba(52, 211, 153, 0.4)' }
                    : { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #475569' }
                  }
                  className="p-3 rounded-xl font-black text-xs uppercase tracking-wide transition flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="text-sm">🌈 ಕಲರ್ (Color)</span>
                  <span className="text-[10px] font-bold opacity-90">EPSON ಪ್ರಿಂಟರ್</span>
                </button>

                <button
                  type="button"
                  onClick={() => setColorMode('Black & White')}
                  style={colorMode === 'Black & White'
                    ? { backgroundColor: '#1e40af', color: '#ffffff', border: '2px solid #60a5fa', boxShadow: '0 0 12px rgba(96, 165, 250, 0.4)' }
                    : { backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #475569' }
                  }
                  className="p-3 rounded-xl font-black text-xs uppercase tracking-wide transition flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span className="text-sm">⚫⚪ B&W (ಕಪ್ಪು-ಬಿಳಿ)</span>
                  <span className="text-[10px] font-bold opacity-90">HP ಲೇಸರ್</span>
                </button>
              </div>
              <span className="text-[11px] text-slate-400 block font-bold">ಕಲರ್ ಪ್ರಿಂಟ್ EPSON ಗೆ ಹಾಗೂ ಕಪ್ಪು-ಬಿಳಿ ಪ್ರಿಂಟ್ HP Laser ಪ್ರಿಂಟರ್‌ಗೆ ಕಳುಹಿಸಲ್ಪಡುತ್ತದೆ.</span>
            </div>

          </div>

          {/* SUBMIT ACTION BUTTON */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              style={{
                background: 'linear-gradient(to right, #0891b2, #3b82f6, #6366f1)',
                color: '#ffffff',
                border: '2px solid #38bdf8',
                boxShadow: '0 0 25px rgba(56, 189, 248, 0.4)'
              }}
              className="w-full py-5 px-6 rounded-2xl font-black text-lg md:text-xl uppercase tracking-wider transition hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:pointer-events-none shadow-2xl"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-white flex-shrink-0" />
                  <span>ಫೈಲ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ • Sending to Print Station...</span>
                </>
              ) : (
                <>
                  <Printer className="w-7 h-7 text-amber-300 animate-bounce flex-shrink-0" />
                  <span>🚀 ಪ್ರಿಂಟ್‌ಗೆ ಕಳುಹಿಸಿ • SEND TO PRINTER NOW</span>
                </>
              )}
            </button>
          </div>

        </form>
      )}

    </div>
  );
};

