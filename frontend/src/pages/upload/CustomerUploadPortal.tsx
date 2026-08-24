import React, { useState, useRef, useEffect } from 'react';
import { api, setCustomApiBase } from '../../services/client';
import { Upload, FileText, CheckCircle2, AlertCircle, Printer, Sparkles, QrCode, RefreshCw, Layers, Palette, Monitor } from 'lucide-react';
import QRCode from 'react-qr-code';

declare const __LOCAL_IP__: string | undefined;

interface CustomerUploadPortalProps {
  isCustomerKiosk?: boolean;
}

export const CustomerUploadPortal: React.FC<CustomerUploadPortalProps> = ({ isCustomerKiosk = false }) => {
  const isKioskMode = isCustomerKiosk || (typeof window !== 'undefined' && (window.location.hash.includes('customer') || window.location.hash.includes('kiosk') || window.location.search.includes('customer') || window.location.search.includes('kiosk')));

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<'Color' | 'Black & White'>('Black & White');
  
  const [uploading, setUploading] = useState(false);
  const [successData, setSuccessData] = useState<{ filename: string; fileCount?: number; filenames?: string[]; copies: number; colorMode: string; timestamp: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Counter QR Display Toggle (For Shop Operator Desk View)
  const [showQrModal, setShowQrModal] = useState(false);
  const [shopLanIp, setShopLanIp] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.location.hostname) {
        const host = window.location.hostname;
        if (host.startsWith('192.168.')) {
          return host;
        }
      }
    } catch {}
    return '192.168.31.233'; // Active Shop Wi-Fi Subnet IP
  });
  const [port] = useState(() => {
    if (typeof window !== 'undefined' && window.location.port && window.location.port !== '80' && window.location.port !== '8082') {
      return window.location.port;
    }
    return ''; // Standard HTTP Port 80 requires NO port number in mobile browser URL
  });
  const [connectionMode, setConnectionMode] = useState<'mobile' | 'wifi'>(() => {
    if (typeof window !== 'undefined' && (window.location.hostname.includes('192.168.') || window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))) {
      return 'wifi';
    }
    return 'mobile';
  });

  const [accessMode, setAccessMode] = useState<'all' | 'wifi' | 'mobile_web' | 'email'>('all');

  const [publicTunnelUrl, setPublicTunnelUrl] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname.includes('trycloudflare.com')) {
        return window.location.origin;
      }
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tunnelParam = urlParams.get('tunnel') || urlParams.get('api');
        if (tunnelParam && tunnelParam.trim() && !tunnelParam.includes('political-abilities')) {
          const clean = tunnelParam.trim().replace(/\/+$/, '');
          window.localStorage?.setItem('arka_tunnel_url', clean);
          return clean;
        }
      } catch {}
      try {
        if (window.localStorage) {
          const saved = window.localStorage.getItem('arka_tunnel_url');
          if (saved && saved.includes('trycloudflare.com') && !saved.includes('political-abilities')) return saved;
        }
      } catch {}
    }
    return '';
  });
  const [shopEmail, setShopEmail] = useState('print@kalpanaenterprise.com');
  const [channelHealth, setChannelHealth] = useState<any>(null);
  const [isVerifyingChannels, setIsVerifyingChannels] = useState(false);

  // Distinct Channel 1: Wi-Fi Direct (Direct port 8082 to Express)
  const wifiUrl = `http://${shopLanIp || '192.168.31.233'}:8082/prints?kiosk=true#upload`;

  // Distinct Channel 2: 4G/5G Mobile Cellular Web Tunnel (Cloudflare HTTPS)
  const mobileUrl = publicTunnelUrl && publicTunnelUrl.trim()
    ? `${publicTunnelUrl.trim().replace(/\/+$/, '')}/prints?kiosk=true#upload`
    : 'https://maiden-heat-television-evaluations.trycloudflare.com/prints?kiosk=true#upload';

  // Distinct Channel 3: 4G/5G Email Intake Drop (Native mailto trigger)
  const emailUrl = `mailto:${shopEmail}?subject=Customer%20Print%20Order&body=Please%20attach%20your%20document%20(PDF,%20Photos)%20and%20tap%20Send.%20Our%20shop%20engine%20will%20print%20it%20automatically.`;

  const portalUrl = (() => {
    if (accessMode === 'wifi') return wifiUrl;
    if (accessMode === 'mobile_web') return mobileUrl;
    if (accessMode === 'email') return emailUrl;
    return mobileUrl; // Default primary
  })();

  useEffect(() => {
    try {
      const saved = window.localStorage?.getItem('arka_tunnel_url');
      if (saved && saved.includes('political-abilities')) {
        window.localStorage.removeItem('arka_tunnel_url');
      }
    } catch {}

    if (typeof window !== 'undefined' && window.localStorage && publicTunnelUrl && !publicTunnelUrl.includes('political-abilities')) {
      window.localStorage.setItem('arka_tunnel_url', publicTunnelUrl);
      if (connectionMode === 'mobile') {
        setCustomApiBase(publicTunnelUrl);
        api.setCustomApiBase(publicTunnelUrl);
      }
    }
  }, [publicTunnelUrl, connectionMode]);

  useEffect(() => {
    let isMounted = true;
    const syncDiagnostics = async () => {
      try {
        const diag = await api.fetchChannelDiagnostics();
        if (isMounted && diag) {
          setChannelHealth(diag);
          if (diag.channels?.mobile_tunnel?.rawTunnelUrl && !diag.channels.mobile_tunnel.rawTunnelUrl.includes('political-abilities')) {
            const clean = diag.channels.mobile_tunnel.rawTunnelUrl.trim().replace(/\/+$/, '');
            setPublicTunnelUrl(clean);
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem('arka_tunnel_url', clean);
            }
          }
        }
      } catch { /* ignore fallback */ }
    };
    syncDiagnostics();
    const interval = setInterval(syncDiagnostics, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleVerifyChannelsNow = async () => {
    setIsVerifyingChannels(true);
    try {
      const res = await api.verifyChannelsNow();
      if (res) setChannelHealth(res);
    } catch (e) {
      console.error('Manual channel verification error:', e);
    } finally {
      setIsVerifyingChannels(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document Type / Print Mode State ('single' vs 'id_merge')
  const [printMode, setPrintMode] = useState<'single' | 'id_merge'>('single');

  // 2-Sided ID Card State (Front & Back Merge)
  const [frontCardFile, setFrontCardFile] = useState<File | null>(null);
  const [backCardFile, setBackCardFile] = useState<File | null>(null);
  const [frontCardPreview, setFrontCardPreview] = useState<string | null>(null);
  const [backCardPreview, setBackCardPreview] = useState<string | null>(null);
  const [idOrientation, setIdOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [mergedPreviewUrl, setMergedPreviewUrl] = useState<string | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Generate live composite preview of 2-sided ID Card onto A4 Canvas in real-time
  useEffect(() => {
    if (!frontCardFile && !backCardFile) {
      setMergedPreviewUrl(null);
      return;
    }

    let isMounted = true;
    const generateMergedPreview = async () => {
      try {
        const isLandscape = idOrientation === 'horizontal';
        const canvas = document.createElement('canvas');
        const cWidth = isLandscape ? 1200 : 850;
        const cHeight = isLandscape ? 850 : 1200;
        canvas.width = cWidth;
        canvas.height = cHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clean white A4 paper background with subtle inner border
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cWidth, cHeight);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, cWidth - 20, cHeight - 20);

        // Target card dimensions on preview canvas
        const cardW = isLandscape ? 480 : 540;
        const cardH = isLandscape ? 300 : 340;

        const drawCard = (img: HTMLImageElement, x: number, y: number, label: string) => {
          // Draw card shadow
          ctx.save();
          ctx.shadowColor = 'rgba(0, 0, 0, 0.18)';
          ctx.shadowBlur = 14;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;

          // Draw card background
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(x, y, cardW, cardH);
          ctx.restore();

          // Draw card image fitted contain
          const imgAspect = img.naturalWidth / img.naturalHeight;
          const cardAspect = cardW / cardH;
          let drawW = cardW;
          let drawH = cardH;
          let drawX = x;
          let drawY = y;

          if (imgAspect > cardAspect) {
            drawH = cardW / imgAspect;
            drawY = y + (cardH - drawH) / 2;
          } else {
            drawW = cardH * imgAspect;
            drawX = x + (cardW - drawW) / 2;
          }

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Card outline border
          ctx.strokeStyle = '#94A3B8';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cardW, cardH);

          // Label tag
          ctx.fillStyle = '#1E293B';
          ctx.fillRect(x + 8, y + 8, 120, 22);
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(label, x + 14, y + 23);
        };

        const loadImg = (file: File): Promise<HTMLImageElement> => {
          return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
              resolve(img);
            };
            img.src = url;
          });
        };

        if (idOrientation === 'vertical') {
          // Vertical Layout (Top = Front, Bottom = Back)
          const posX = (cWidth - cardW) / 2;
          const topY = cHeight * 0.12;
          const bottomY = cHeight * 0.54;

          if (frontCardFile) {
            const frontImg = await loadImg(frontCardFile);
            drawCard(frontImg, posX, topY, 'CARD FRONT (ಮುಂಭಾಗ)');
          } else {
            ctx.fillStyle = '#F1F5F9';
            ctx.fillRect(posX, topY, cardW, cardH);
            ctx.strokeStyle = '#CBD5E1';
            ctx.strokeRect(posX, topY, cardW, cardH);
            ctx.fillStyle = '#64748B';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('FRONT SIDE PENDING (ಮುಂಭಾಗ ಬಾಕಿ ಇದೆ)', posX + 60, topY + cardH / 2);
          }

          // Center dashed fold/cut guide line
          ctx.save();
          ctx.setLineDash([8, 8]);
          ctx.strokeStyle = '#CBD5E1';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(40, cHeight / 2);
          ctx.lineTo(cWidth - 40, cHeight / 2);
          ctx.stroke();
          ctx.restore();

          if (backCardFile) {
            const backImg = await loadImg(backCardFile);
            drawCard(backImg, posX, bottomY, 'CARD BACK (ಹಿಂಭಾಗ)');
          } else {
            ctx.fillStyle = '#F1F5F9';
            ctx.fillRect(posX, bottomY, cardW, cardH);
            ctx.strokeStyle = '#CBD5E1';
            ctx.strokeRect(posX, bottomY, cardW, cardH);
            ctx.fillStyle = '#64748B';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText('BACK SIDE PENDING (ಹಿಂಭಾಗ ಬಾಕಿ ಇದೆ)', posX + 60, bottomY + cardH / 2);
          }
        } else {
          // Horizontal Layout (Left = Front, Right = Back)
          const posY = (cHeight - cardH) / 2;
          const leftX = cWidth * 0.06;
          const rightX = cWidth * 0.52;

          if (frontCardFile) {
            const frontImg = await loadImg(frontCardFile);
            drawCard(frontImg, leftX, posY, 'CARD FRONT (ಮುಂಭಾಗ)');
          }
          if (backCardFile) {
            const backImg = await loadImg(backCardFile);
            drawCard(backImg, rightX, posY, 'CARD BACK (ಹಿಂಭಾಗ)');
          }
        }

        if (isMounted) {
          setMergedPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
        }
      } catch (err) {
        console.error("Preview generation error:", err);
      }
    };

    generateMergedPreview();

    return () => {
      isMounted = false;
    };
  }, [frontCardFile, backCardFile, idOrientation]);

  const handleFrontCardChange = (file?: File) => {
    if (!file) return;
    setFrontCardFile(file);
    const UrlObj = window.URL || (window as any).webkitURL;
    setFrontCardPreview(UrlObj.createObjectURL(file));
  };

  const handleBackCardChange = (file?: File) => {
    if (!file) return;
    setBackCardFile(file);
    const UrlObj = window.URL || (window as any).webkitURL;
    setBackCardPreview(UrlObj.createObjectURL(file));
  };

  const handleSwapCards = () => {
    const tempFile = frontCardFile;
    const tempPreview = frontCardPreview;
    setFrontCardFile(backCardFile);
    setFrontCardPreview(backCardPreview);
    setBackCardFile(tempFile);
    setBackCardPreview(tempPreview);
  };

  const handleAddFiles = (files: FileList | File[] | null | undefined) => {
    if (!files || files.length === 0) return;
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.docx', '.doc', '.bmp', '.webp'];
    const validFiles: File[] = [];

    Array.from(files).forEach(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (allowedExts.includes(ext)) {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) {
      setErrorMessage('ಬೆಂಬಲಿತ ಫೈಲ್‌ಗಳನ್ನು ಮಾತ್ರ ಆಯ್ಕೆಮಾಡಿ (PDF, PNG, JPG, DOCX).');
      return;
    }

    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}_${f.size}`));
      const newItems = validFiles.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...newItems];
    });
    setErrorMessage(null);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
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
      handleAddFiles(e.dataTransfer.files);
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
    setErrorMessage(null);

    // Validate inputs depending on Mode
    if (printMode === 'id_merge') {
      if (!frontCardFile || !backCardFile) {
        setErrorMessage('ದಯವಿಟ್ಟು ID ಕಾರ್ಡ್‌ನ ಮುಂಭಾಗ ಮತ್ತು ಹಿಂಭಾಗ ಎರಡೂ ಫೋಟೋಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ (Please select both Front and Back photos of ID card).');
        return;
      }
    } else {
      if (selectedFiles.length === 0) {
        setErrorMessage('ದಯವಿಟ್ಟು ಕನಿಷ್ಠ 1 ಡಾಕ್ಯುಮೆಂಟ್ ಅಥವಾ ಫೋಟೋ ಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ (Please select at least 1 file to print).');
        return;
      }
    }

    setUploading(true);
    try {
      if (connectionMode === 'mobile') {
        if (publicTunnelUrl && !publicTunnelUrl.includes('political-abilities')) {
          setCustomApiBase(publicTunnelUrl);
          api.setCustomApiBase(publicTunnelUrl);
        }
      } else if (connectionMode === 'wifi') {
        const isLocalHost = typeof window !== 'undefined' && (window.location.hostname.includes('192.168.') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const lanUrl = isLocalHost ? '' : `http://${shopLanIp || '192.168.31.233'}:8082`;
        if (lanUrl) {
          setCustomApiBase(lanUrl);
          api.setCustomApiBase(lanUrl);
        }
      }

      let result: any;
      let displayFilename = '';

      if (printMode === 'id_merge' && frontCardFile && backCardFile) {
        const optFront = await prepareFileForUpload(frontCardFile);
        const optBack = await prepareFileForUpload(backCardFile);
        const isColorId = colorMode === 'Color';
        result = await api.mergeAndUploadIdCard(
          optFront,
          optBack,
          idOrientation,
          copies,
          isColorId ? 'Color' : 'BlackWhite'
        );
        displayFilename = `2-Sided ID Card (${idOrientation === 'vertical' ? 'Top & Bottom' : 'Side by Side'})`;
        
        if (result && result.success) {
          setSuccessData({
            filename: result.filename || displayFilename,
            fileCount: 1,
            filenames: [result.filename || displayFilename],
            copies,
            colorMode: isColorId ? '🌈 Full Colour (2-Sided ID Card)' : '⚫⚪ Black & White (2-Sided ID Card)',
            timestamp: new Date().toLocaleTimeString()
          });
          setFrontCardFile(null);
          setBackCardFile(null);
          setFrontCardPreview(null);
          setBackCardPreview(null);
          setMergedPreviewUrl(null);
          if (frontInputRef.current) frontInputRef.current.value = '';
          if (backInputRef.current) backInputRef.current.value = '';
        } else {
          setErrorMessage(result?.error || 'Failed to transfer document to server.');
        }
      } else if (selectedFiles.length > 0) {
        const optimizedFiles = await Promise.all(selectedFiles.map(f => prepareFileForUpload(f)));
        const isColor = colorMode === 'Color';
        result = await api.uploadDocument(optimizedFiles, copies, isColor ? 'Color' : 'BlackWhite');
        
        if (result && result.success) {
          setSuccessData({
            filename: selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} Documents Sent to Printer`,
            fileCount: selectedFiles.length,
            filenames: selectedFiles.map(f => f.name),
            copies,
            colorMode: isColor ? '🌈 Full Colour Printout' : '⚫⚪ Black & White Standard',
            timestamp: new Date().toLocaleTimeString()
          });
          setSelectedFiles([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          setErrorMessage(result?.error || 'Failed to transfer document to server.');
        }
      }
    } catch {
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
    const svgElements = document.querySelectorAll('.qr-canvas-container svg');
    if (!svgElements || svgElements.length === 0) {
      alert("QR Code element not found for download!");
      return;
    }

    const svgElement = svgElements[0] as SVGSVGElement;
    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const UrlObj = window.URL || (window as any).webkitURL;
    const blobURL = UrlObj.createObjectURL(svgBlob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1400;
      canvas.height = 1800;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.strokeStyle = '#0f172a';
        context.lineWidth = 32;
        context.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

        context.strokeStyle = accessMode === 'wifi' ? '#10b981' : accessMode === 'mobile_web' ? '#3b82f6' : '#a855f7';
        context.lineWidth = 8;
        context.strokeRect(48, 48, canvas.width - 96, canvas.height - 96);

        context.fillStyle = '#047857';
        context.font = 'bold 64px Arial, sans-serif';
        context.textAlign = 'center';
        context.fillText('ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್', 700, 155);
        
        context.fillStyle = '#0f172a';
        context.font = 'bold 44px Arial, sans-serif';
        context.fillText('KALPANA ENTERPRISES', 700, 220);

        context.fillStyle = accessMode === 'wifi' ? '#047857' : accessMode === 'mobile_web' ? '#1e40af' : '#6b21a8';
        context.beginPath();
        if (typeof (context as any).roundRect === 'function') {
          (context as any).roundRect(140, 255, 1120, 85, 42);
        } else {
          context.rect(140, 255, 1120, 85);
        }
        context.fill();

        context.fillStyle = '#FFFFFF';
        context.font = 'bold 34px Arial, sans-serif';
        const badgeTitle = accessMode === 'wifi'
          ? '📡 ಶಾಪ್ ವೈ-ಫೈ ಪ್ರಿಂಟ್ • SCAN ON SHOP WI-FI'
          : accessMode === 'mobile_web'
          ? '🌐 4G/5G ಮೊಬೈಲ್ ಪ್ರಿಂಟ್ • SCAN ON 4G/5G (NO WI-FI NEEDED)'
          : '📧 ಇಮೇಲ್ ಮೂಲಕ ಪ್ರಿಂಟ್ • SCAN TO EMAIL DOCUMENT';
        context.fillText(badgeTitle, 700, 312);

        context.fillStyle = '#f8fafc';
        context.strokeStyle = '#10b981';
        context.lineWidth = 6;
        context.beginPath();
        if (typeof (context as any).roundRect === 'function') {
          (context as any).roundRect(260, 385, 880, 880, 35);
        } else {
          context.rect(260, 385, 880, 880);
        }
        context.fill();
        context.stroke();

        context.drawImage(image, 310, 435, 780, 780);

        context.fillStyle = '#f1f5f9';
        context.strokeStyle = '#cbd5e1';
        context.lineWidth = 3;
        context.beginPath();
        if (typeof (context as any).roundRect === 'function') {
          (context as any).roundRect(90, 1310, 1220, 210, 25);
        } else {
          context.rect(90, 1310, 1220, 210);
        }
        context.fill();
        context.stroke();

        context.fillStyle = '#475569';
        context.font = 'bold 28px Arial, sans-serif';
        context.fillText('🔗 ಸ್ಕ್ಯಾನ್ / ಡೈರೆಕ್ಟ್ ಲಿಂಕ್ (Direct Link):', 700, 1365);

        const displayUrl = portalUrl;
        context.fillStyle = '#0f172a';
        const urlFontSize = displayUrl.length > 65 ? 23 : displayUrl.length > 55 ? 25 : displayUrl.length > 45 ? 28 : 32;
        context.font = `bold ${urlFontSize}px monospace`;
        context.fillText(displayUrl, 700, 1445);

        context.fillStyle = '#059669';
        context.font = 'bold 26px Arial, sans-serif';
        context.fillText('⚡ ಆಟೋಮ್ಯಾಟಿಕ್ ಪ್ರಿಂಟ್ ಸಿಸ್ಟಮ್ (Instant Spooling Engine)', 700, 1495);

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
      UrlObj.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
  };

  const handlePrintA4Sign = () => {
    const wifiSvg = (document.querySelector('.qr-wifi svg') as SVGSVGElement | null)?.outerHTML || '';
    const mobileSvg = (document.querySelector('.qr-mobile svg') as SVGSVGElement | null)?.outerHTML || '';
    const emailSvg = (document.querySelector('.qr-email svg') as SVGSVGElement | null)?.outerHTML || '';
    const singleSvg = (document.querySelector('.qr-single svg') as SVGSVGElement | null)?.outerHTML || '';

    const isTriple = accessMode === 'all';
    
    const win = window.open('', '_blank', 'width=950,height=1100');
    if (win) {
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Kalpana Enterprises - Multi-Channel Counter Poster</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              margin: 0; 
              padding: 20px; 
              border: 10px solid #0f172a;
              outline: 4px solid #059669;
              outline-offset: -18px; 
              border-radius: 20px;
              background-color: #ffffff;
              box-sizing: border-box;
            }
            .title-kannada { font-size: 38px; font-weight: 900; color: #047857; margin-top: 5px; margin-bottom: 2px; }
            .title-english { font-size: 26px; font-weight: 900; color: #0f172a; margin-top: 0; margin-bottom: 15px; letter-spacing: 2px; }
            .badge { display: inline-block; padding: 10px 30px; background: #047857; color: #ffffff; font-size: 20px; font-weight: bold; border-radius: 50px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(4, 120, 87, 0.25); }
            
            .grid-3 { display: flex; justify-content: space-around; gap: 15px; margin-bottom: 20px; }
            .card { flex: 1; border: 3px solid #cbd5e1; border-radius: 18px; padding: 15px; background: #f8fafc; text-align: center; }
            .card-wifi { border-color: #10b981; background: #ecfdf5; }
            .card-mobile { border-color: #3b82f6; background: #eff6ff; }
            .card-email { border-color: #a855f7; background: #faf5ff; }
            
            .card-title { font-size: 18px; font-weight: 900; margin-bottom: 8px; }
            .card-title-wifi { color: #047857; }
            .card-title-mobile { color: #1e40af; }
            .card-title-email { color: #6b21a8; }
            
            .qr-wrapper { width: 170px; height: 170px; margin: 0 auto 10px auto; padding: 10px; background: #ffffff; border: 2px solid #94a3b8; border-radius: 12px; }
            .qr-wrapper svg { width: 100% !important; height: 100% !important; }
            
            .url-mono { font-family: monospace; font-size: 10px; font-weight: bold; word-break: break-all; color: #0f172a; background: #ffffff; padding: 6px; border-radius: 8px; border: 1px solid #cbd5e1; }
            .instructions { font-size: 16px; font-weight: 900; color: #047857; margin-top: 10px; }
            .footer { margin-top: 15px; font-size: 13px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="title-kannada">ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್</div>
          <div class="title-english">KALPANA ENTERPRISES • MULTI-CHANNEL PRINT INTAKE</div>
          <div class="badge">📲 ಪ್ರಿಂಟ್ ಮಾಡಲು ಯಾವುದೇ QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ • SCAN ANY QR CODE TO PRINT</div>
          
          ${isTriple ? `
          <div class="grid-3">
            <div class="card card-wifi">
              <div class="card-title card-title-wifi">📡 1. ಶಾಪ್ ವೈ-ಫೈ (Shop Wi-Fi)</div>
              <div class="qr-wrapper">${wifiSvg || singleSvg}</div>
              <div style="font-size: 12px; font-weight: bold; color: #047857; margin-bottom: 5px;">Wi-Fi ಕನೆಕ್ಟ್ ಮಾಡಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ</div>
              <div class="url-mono">${wifiUrl}</div>
            </div>

            <div class="card card-mobile">
              <div class="card-title card-title-mobile">🌐 2. 4G/5G ಮೊಬೈಲ್ ವೆಬ್ (Cellular)</div>
              <div class="qr-wrapper">${mobileSvg || singleSvg}</div>
              <div style="font-size: 12px; font-weight: bold; color: #1e40af; margin-bottom: 5px;">ಯಾವುದೇ Wi-Fi ಬೇಡ • Direct 4G/5G</div>
              <div class="url-mono">${mobileUrl}</div>
            </div>

            <div class="card card-email">
              <div class="card-title card-title-email">📧 3. ಇಮೇಲ್ ಡ್ರಾಪ್ (Email Drop)</div>
              <div class="qr-wrapper">${emailSvg || singleSvg}</div>
              <div style="font-size: 12px; font-weight: bold; color: #6b21a8; margin-bottom: 5px;">ಇಮೇಲ್‌ನಲ್ಲಿ ಫೈಲ್ ಕಳುಹಿಸಿ</div>
              <div class="url-mono">${shopEmail}</div>
            </div>
          </div>
          ` : `
          <div style="max-width: 450px; margin: 0 auto 20px auto; padding: 20px; border: 4px solid #10b981; border-radius: 20px; background: #f8fafc;">
            <div class="qr-wrapper" style="width: 260px; height: 260px;">${singleSvg || wifiSvg}</div>
            <div class="url-mono" style="font-size: 14px; margin-top: 15px;">${portalUrl}</div>
          </div>
          `}
          
          <div class="instructions">ಡಾಕ್ಯುಮೆಂಟ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಲು ಮೊಬೈಲ್ ಕ್ಯಾಮರಾದಿಂದ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ! (Scan with camera to send files to printer)</div>
          <div class="footer">⚡ Powered by Kalpana Enterprises Auto WhatsApp & Mobile Cloud Print Engine V2</div>
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

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-300 text-white font-sans">
      
      {/* Top Banner / Operator Toggle */}
      <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-purple-500 shadow-2xl flex-wrap gap-3" style={{ backgroundColor: '#0f172a' }}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-600/30 text-purple-300 rounded-xl shadow-inner">
            <Sparkles className="w-7 h-7 animate-bounce text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase flex items-center gap-2 flex-wrap">
              <span>{isKioskMode ? '⚡ ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್ • Express Document Intake' : 'ಕಲ್ಪನ ಎಂಟರ್ಪ್ರೈಸಸ್ • Print Your Files Here'}</span>
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
            <span>{showQrModal ? 'Close Counter Sign (ಮುಚ್ಚಿರಿ)' : '🖥️ Show 3 QR Codes to Customer'}</span>
          </button>
        )}
      </div>

      {/* COUNTER QR SIGN MODAL / PANEL (For Shop Desktop Monitor - Restricted from Kiosk) */}
      {!isKioskMode && showQrModal && (
        <div className="p-6 md:p-8 rounded-3xl border-4 border-emerald-400 shadow-2xl space-y-6 animate-in slide-in-from-top-4 duration-300" style={{ backgroundColor: '#022c22', color: '#ffffff', boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)' }}>
          
          {/* MODAL HEADER WITH LIVE CHANNEL HEALTH TELEMETRY BAR */}
          <div className="border-b-2 border-emerald-500/80 pb-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-400 text-slate-950 rounded-xl font-black shadow-lg">
                  <Monitor className="w-7 h-7 text-slate-950" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                    Shop Desktop Counter Access Display
                  </h3>
                  <p style={{ color: '#a7f3d0' }} className="text-xs font-bold mt-0.5">
                    Multi-Channel Express Intake • 3 Independent QR Codes for Wi-Fi, 4G/5G Mobile & Email!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleVerifyChannelsNow}
                  disabled={isVerifyingChannels}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingChannels ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingChannels ? 'Probing...' : '⚡ Probe All Channels'}</span>
                </button>
                <span style={{ backgroundColor: '#047857', color: '#fef08a', border: '2px solid #34d399' }} className="text-xs font-black px-3.5 py-1.5 rounded-xl uppercase tracking-wider shadow-lg">
                  🟢 24/7 Engine Active
                </span>
              </div>
            </div>

            {/* LIVE REAL-TIME CHANNEL TELEMETRY STATUS PILLS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-between text-xs">
                <span className="font-extrabold text-emerald-300">📡 Wi-Fi Direct:</span>
                <span className="font-black text-white font-mono">
                  {channelHealth?.channels?.wifi?.status === 'ONLINE' ? `🟢 ONLINE (${channelHealth.channels.wifi.latencyMs}ms)` : '🟢 READY'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-950/80 border border-blue-500/50 flex items-center justify-between text-xs">
                <span className="font-extrabold text-cyan-300">🌐 4G/5G Tunnel:</span>
                <span className="font-black text-white font-mono">
                  {channelHealth?.channels?.mobile_tunnel?.status === 'ONLINE' ? `🟢 LIVE (${channelHealth.channels.mobile_tunnel.latencyMs}ms)` : publicTunnelUrl ? '🟢 LIVE' : '🟡 STARTING'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-950/80 border border-purple-500/50 flex items-center justify-between text-xs">
                <span className="font-extrabold text-purple-300">📧 Email Drop:</span>
                <span className="font-black text-white font-mono">🟢 READY</span>
              </div>
            </div>
          </div>

          {/* 4-MODE SELECTOR: ALL 3 TOGETHER OR INDIVIDUAL FOCUS */}
          <div className="space-y-3 bg-emerald-950/90 p-4 rounded-2xl border border-emerald-500/60 shadow-inner">
            <label style={{ color: '#fef08a' }} className="text-xs font-black uppercase tracking-wider block">
              🛠️ Select Counter Display View Mode:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setAccessMode('all')}
                style={accessMode === 'all' 
                  ? { backgroundColor: '#047857', border: '2px solid #fde047', color: '#ffffff', boxShadow: '0 0 15px rgba(253, 224, 71, 0.5)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm font-black">🔲 3-in-1 Triple Sign</span>
                <span className="text-[10px] opacity-90 font-bold">All 3 QR Codes at Once</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('wifi')}
                style={accessMode === 'wifi' 
                  ? { backgroundColor: '#065f46', border: '2px solid #34d399', color: '#ffffff', boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm">📡 Shop Wi-Fi / LAN</span>
                <span className="text-[10px] opacity-80 font-bold">Direct IP ({shopLanIp}:8082)</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('mobile_web')}
                style={accessMode === 'mobile_web' 
                  ? { backgroundColor: '#1e40af', border: '2px solid #60a5fa', color: '#ffffff', boxShadow: '0 0 15px rgba(96, 165, 250, 0.4)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm">🌐 4G/5G Cellular Web</span>
                <span className="text-[10px] opacity-80 font-bold">No Wi-Fi Password Needed</span>
              </button>

              <button
                type="button"
                onClick={() => setAccessMode('email')}
                style={accessMode === 'email' 
                  ? { backgroundColor: '#6b21a8', border: '2px solid #c084fc', color: '#ffffff', boxShadow: '0 0 15px rgba(192, 132, 252, 0.4)' }
                  : { backgroundColor: '#0f172a', border: '1px solid #475569', color: '#94a3b8' }}
                className="p-3 rounded-xl font-black text-xs transition uppercase tracking-wide cursor-pointer flex flex-col items-center gap-1 text-center"
              >
                <span className="text-sm">📧 4G/5G Email Intake</span>
                <span className="text-[10px] opacity-80 font-bold">Direct Mailto Scan Drop</span>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* VIEW OPTION 1: 3-IN-1 TRIPLE QR CODE DISPLAY (SIDE-BY-SIDE) */}
          {/* ============================================================ */}
          {accessMode === 'all' ? (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* 1. WI-FI QR CARD */}
                <div style={{ backgroundColor: '#042f2c', border: '3px solid #10b981' }} className="p-5 rounded-2xl shadow-xl flex flex-col items-center justify-between text-center space-y-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 bg-emerald-500 text-slate-950 font-black text-[10px] uppercase rounded-full tracking-wider">
                      📡 Option 1: Shop Wi-Fi
                    </span>
                    <h4 className="text-base font-black text-white uppercase mt-1">Shop Wi-Fi Direct</h4>
                    <p className="text-[11px] text-emerald-200 font-bold">Connect to Shop Wi-Fi & scan</p>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '16px', border: '3px solid #10b981' }} className="qr-canvas-container qr-wifi flex items-center justify-center aspect-square w-48 shadow-lg">
                    <QRCode
                      value={wifiUrl}
                      size={160}
                      style={{ height: "auto", maxWidth: "100%", width: "160px" }}
                      viewBox={`0 0 256 256`}
                      fgColor="#047857"
                      bgColor="#ffffff"
                    />
                  </div>

                  <div className="w-full space-y-1">
                    <div className="font-mono text-[9px] bg-slate-950 p-2 rounded-lg text-emerald-300 border border-emerald-500/30 break-all select-all">
                      {wifiUrl}
                    </div>
                    <span className="text-[10px] text-slate-300 font-extrabold block">Instant Local Spooling</span>
                  </div>
                </div>

                {/* 2. 4G/5G CELLULAR TUNNEL QR CARD */}
                <div style={{ backgroundColor: '#0f172a', border: '3px solid #3b82f6' }} className="p-5 rounded-2xl shadow-xl flex flex-col items-center justify-between text-center space-y-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 bg-blue-500 text-white font-black text-[10px] uppercase rounded-full tracking-wider">
                      🌐 Option 2: 4G/5G Mobile
                    </span>
                    <h4 className="text-base font-black text-white uppercase mt-1">Cellular Web Tunnel</h4>
                    <p className="text-[11px] text-cyan-200 font-bold">No Wi-Fi password required</p>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '16px', border: '3px solid #3b82f6' }} className="qr-canvas-container qr-mobile flex items-center justify-center aspect-square w-48 shadow-lg">
                    <QRCode
                      value={mobileUrl}
                      size={160}
                      style={{ height: "auto", maxWidth: "100%", width: "160px" }}
                      viewBox={`0 0 256 256`}
                      fgColor="#1e40af"
                      bgColor="#ffffff"
                    />
                  </div>

                  <div className="w-full space-y-1">
                    <div className="font-mono text-[9px] bg-slate-950 p-2 rounded-lg text-cyan-300 border border-blue-500/30 break-all select-all">
                      {mobileUrl}
                    </div>
                    <span className="text-[10px] text-slate-300 font-extrabold block">Zero Warnings Cloudflare HTTPS</span>
                  </div>
                </div>

                {/* 3. EMAIL INTAKE QR CARD */}
                <div style={{ backgroundColor: '#3b0764', border: '3px solid #c084fc' }} className="p-5 rounded-2xl shadow-xl flex flex-col items-center justify-between text-center space-y-4">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 bg-purple-500 text-white font-black text-[10px] uppercase rounded-full tracking-wider">
                      📧 Option 3: Email Drop
                    </span>
                    <h4 className="text-base font-black text-white uppercase mt-1">Email Scan Drop</h4>
                    <p className="text-[11px] text-purple-200 font-bold">Opens mobile email app</p>
                  </div>

                  <div style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '16px', border: '3px solid #a855f7' }} className="qr-canvas-container qr-email flex items-center justify-center aspect-square w-48 shadow-lg">
                    <QRCode
                      value={emailUrl}
                      size={160}
                      style={{ height: "auto", maxWidth: "100%", width: "160px" }}
                      viewBox={`0 0 256 256`}
                      fgColor="#6b21a8"
                      bgColor="#ffffff"
                    />
                  </div>

                  <div className="w-full space-y-1">
                    <div className="font-mono text-[9px] bg-slate-950 p-2 rounded-lg text-purple-300 border border-purple-500/30 break-all select-all">
                      {shopEmail}
                    </div>
                    <span className="text-[10px] text-slate-300 font-extrabold block">Automated IMAP Downloader</span>
                  </div>
                </div>

              </div>

              {/* POSTER & PRINT BUTTONS FOR 3-IN-1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrintA4Sign}
                  style={{ backgroundColor: '#1e40af', border: '2px solid #60a5fa', color: '#ffffff' }}
                  className="py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>🖨️ Print 3-in-1 Triple A4 Counter Poster (A4 ಪೋಸ್ಟರ್ ಪ್ರಿಂಟ್)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQrPng}
                  style={{ backgroundColor: '#047857', border: '2px solid #34d399', color: '#ffffff' }}
                  className="py-3.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Upload className="w-4 h-4 text-emerald-300" />
                  <span>📥 Download Counter Poster PNG (PNG ಡೌನ್‌ಲೋಡ್)</span>
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* VIEW OPTION 2: FOCUSED SINGLE CHANNEL VIEW */
            /* ============================================================ */
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
                            <span>💻 Laptop (192.168.31.233:8082)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShopLanIp('192.168.31.242')}
                            style={{ backgroundColor: shopLanIp === '192.168.31.242' ? '#059669' : '#1e293b', border: '2px solid #34d399', color: '#ffffff' }}
                            className="px-3 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition shadow cursor-pointer hover:brightness-110"
                          >
                            <span>🖥️ Optiplex PC (192.168.31.242:8082)</span>
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
                          💡 Connects directly to Express Engine Port 8082 for instant file reception.
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {accessMode === 'mobile_web' && (
                  <>
                    <div style={{ backgroundColor: '#1e3a8a', border: '2px solid #60a5fa' }} className="p-5 rounded-2xl shadow-xl space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <p style={{ color: '#ffffff' }} className="text-sm md:text-base font-black leading-relaxed">
                          Allow customers on their 4G/5G cellular network to upload files without giving them your shop Wi-Fi password!
                        </p>
                        {publicTunnelUrl ? (
                          <span className="px-3 py-1 bg-emerald-500 text-slate-950 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow">
                            <span>🟢 Live Tunnel Connected</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-500 text-slate-950 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow">
                            <span>🟡 Searching for Live Tunnel...</span>
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#93c5fd' }} className="text-xs font-bold">
                        🚀 <span className="text-white">To start a live tunnel:</span> Run our 1-click helper script <span className="font-mono text-yellow-300">d:\Arka\tools\start_mobile_tunnel.ps1</span> on your desktop!
                      </p>
                      <p style={{ color: '#34d399' }} className="text-[11px] font-black">
                        ✨ Powered by Cloudflare Quick Tunnels — Customers open your portal INSTANTLY on 4G/5G with ZERO warning pages, ZERO CAPTCHAs, and ZERO IP address prompts!
                      </p>
                    </div>
                    <div className="space-y-4 p-5 rounded-2xl border-2 border-blue-500 shadow-inner" style={{ backgroundColor: '#0f172a' }}>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label style={{ color: '#fde047' }} className="text-xs font-black uppercase tracking-wider block">
                            Cloudflare Public HTTPS Address:
                          </label>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const s = await api.fetchChannelDiagnostics();
                                if (s?.channels?.mobile_tunnel?.rawTunnelUrl) {
                                  setPublicTunnelUrl(s.channels.mobile_tunnel.rawTunnelUrl.trim().replace(/\/+$/, ''));
                                }
                              } catch {}
                            }}
                            className="text-[11px] font-black text-cyan-300 hover:text-white flex items-center gap-1 underline cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>🔄 Sync Live Tunnel</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={publicTunnelUrl}
                          onChange={(e) => setPublicTunnelUrl(e.target.value)}
                          placeholder="e.g. https://xxxx-xxxx.trycloudflare.com (Auto-detected from server)"
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
                        They attach their file and press Send. Your desktop background IMAP Watcher extracts the attachment directly into <span className="font-mono text-amber-300">D:\WhatsApp</span> within seconds!
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

              {/* FOCUSED SINGLE QR CODE FRAME */}
              <div 
                style={{ 
                  backgroundColor: '#090d16', 
                  border: `4px solid ${accessMode === 'wifi' ? '#34d399' : accessMode === 'mobile_web' ? '#60a5fa' : '#c084fc'}`, 
                  boxShadow: `0 0 35px ${accessMode === 'wifi' ? 'rgba(52, 211, 153, 0.4)' : accessMode === 'mobile_web' ? 'rgba(96, 165, 250, 0.4)' : 'rgba(192, 132, 252, 0.4)'}` 
                }} 
                className="flex flex-col items-center justify-center p-7 rounded-3xl text-center space-y-5 shadow-2xl mx-auto max-w-sm w-full"
              >
                <div className="space-y-1">
                  <span style={{ backgroundColor: '#312e81', color: '#c7d2fe', border: '1px solid #6366f1' }} className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block shadow">
                    {accessMode === 'wifi' ? 'Wi-Fi Instant Drop' : accessMode === 'mobile_web' ? '4G/5G Public Tunnel' : '4G/5G Email Express'}
                  </span>
                  <h4 style={{ color: '#ffffff' }} className="font-black text-2xl md:text-3xl uppercase tracking-wider drop-shadow-md pt-1">
                    📲 SCAN TO PRINT
                  </h4>
                  <p style={{ color: accessMode === 'wifi' ? '#34d399' : accessMode === 'mobile_web' ? '#60a5fa' : '#c084fc' }} className="text-xs font-extrabold uppercase tracking-wide">
                    {accessMode === 'email' ? 'Scan to Email File Automatically' : 'Point Camera to Send Files to Printer'}
                  </p>
                </div>

                {/* QR Code Canvas Wrapper */}
                <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '24px', border: '5px solid #10b981', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.8)' }} className="qr-canvas-container qr-single flex items-center justify-center w-full max-w-[240px] aspect-square transition-transform hover:scale-105">
                  <QRCode
                    value={portalUrl}
                    size={200}
                    style={{ height: "auto", maxWidth: "100%", width: "200px" }}
                    viewBox={`0 0 256 256`}
                    fgColor={accessMode === 'wifi' ? '#047857' : accessMode === 'mobile_web' ? '#1e40af' : '#6b21a8'}
                    bgColor="#ffffff"
                  />
                </div>

                {/* INSTANT DOWNLOAD & PRINT BUTTONS */}
                <div className="flex flex-col gap-2.5 w-full pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadQrPng}
                    style={{ backgroundColor: '#047857', border: '2px solid #34d399', color: '#ffffff' }}
                    className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    title="Download ultra-high resolution PNG file"
                  >
                    <span>📥 Download QR Code PNG (QR ಕೋಡ್ ಡೌನ್‌ಲೋಡ್)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintA4Sign}
                    style={{ backgroundColor: '#1e40af', border: '2px solid #60a5fa', color: '#ffffff' }}
                    className="w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider hover:brightness-110 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    title="Print A4 shop wall sign"
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
          )}
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
              <span className="text-emerald-400 block uppercase font-black">ಒಟ್ಟು ಫೈಲ್‌ಗಳು (Total Documents)</span>
              <span className="text-white font-mono truncate block mt-0.5">{successData.fileCount || 1} Document(s) / ಫೈಲ್‌ಗಳು</span>
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

          {successData.filenames && successData.filenames.length > 0 && (
            <div className="p-3 bg-emerald-950/80 rounded-xl border border-emerald-500/30 text-xs space-y-1">
              <span className="text-[11px] font-black uppercase text-emerald-300">ಸ್ವೀಕರಿಸಿದ ಫೈಲ್‌ಗಳು (Transferred Files):</span>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {successData.filenames.map((name, i) => (
                  <div key={i} className="text-white font-mono truncate text-[11px]">
                    ✓ {name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSuccessData(null)}
            style={{ backgroundColor: '#ffffff', color: '#064e3b', border: '2px solid #34d399' }}
            className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-wider hover:bg-emerald-100 transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>ಇನ್ನಷ್ಟು ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳನ್ನು ಕಳುಹಿಸಿ (Submit More Documents)</span>
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

          {/* NETWORK CONNECTION TARGET SELECTOR */}
          <div className="p-4 rounded-2xl border border-cyan-500/40 bg-slate-900 shadow-xl space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                📡 Select Network Connection Mode:
              </span>
              <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {connectionMode === 'mobile' ? '🟢 4G/5G Express Relay Active' : '📶 Shop Wi-Fi Direct'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setConnectionMode('mobile');
                  if (publicTunnelUrl) {
                    setCustomApiBase(publicTunnelUrl);
                    api.setCustomApiBase(publicTunnelUrl);
                  }
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  connectionMode === 'mobile'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>📱 4G / 5G Mobile Data</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConnectionMode('wifi');
                  const isLocalHost = typeof window !== 'undefined' && (window.location.hostname.includes('192.168.') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                  const lanUrl = isLocalHost ? '' : `http://${shopLanIp || '192.168.31.233'}:8082`;
                  if (lanUrl) {
                    setCustomApiBase(lanUrl);
                    api.setCustomApiBase(lanUrl);
                  }
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  connectionMode === 'wifi'
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <span>📶 Shop Wi-Fi (ARKA)</span>
              </button>
            </div>
          </div>

          {/* DOCUMENT PRINT TYPE / LAYOUT SELECTOR */}
          <div className="p-4 rounded-2xl border-2 border-indigo-500/50 bg-slate-900 shadow-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-black uppercase text-cyan-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>ಪ್ರಿಂಟ್ ಪ್ರಕಾರ ಆಯ್ಕೆಮಾಡಿ • Select Document Print Type:</span>
              </span>
              <span className="text-[11px] font-black px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                {printMode === 'single' ? '📄 Standard Document' : '🪪 2-Sided ID Card onto 1 Sheet'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPrintMode('single')}
                style={printMode === 'single'
                  ? { backgroundColor: '#1e3a8a', border: '2px solid #60a5fa', color: '#ffffff', boxShadow: '0 0 15px rgba(96, 165, 250, 0.35)' }
                  : { backgroundColor: '#1e293b', border: '1px solid #475569', color: '#94a3b8' }
                }
                className="p-4 rounded-xl text-left font-black transition cursor-pointer flex items-center gap-3"
              >
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">📄 ಸಾಮಾನ್ಯ ಡಾಕ್ಯುಮೆಂಟ್ (Standard Document)</h4>
                  <p className="text-[11px] font-bold text-slate-300">Single File or Multi-page PDF / Photo</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPrintMode('id_merge')}
                style={printMode === 'id_merge'
                  ? { backgroundColor: '#065f46', border: '2px solid #34d399', color: '#ffffff', boxShadow: '0 0 15px rgba(52, 211, 153, 0.35)' }
                  : { backgroundColor: '#1e293b', border: '1px solid #475569', color: '#94a3b8' }
                }
                className="p-4 rounded-xl text-left font-black transition cursor-pointer flex items-center gap-3"
              >
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">🪪 2 ಮುಖದ ID ಕಾರ್ಡ್ (Merge 2-Sided ID on 1 Sheet)</h4>
                  <p className="text-[11px] font-bold text-emerald-300">Aadhar, PAN, Driving License, Voter ID (Front+Back)</p>
                </div>
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* MODE A: STANDARD SINGLE DOCUMENT UPLOAD ZONE */}
          {/* ============================================================ */}
          {printMode === 'single' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={(e) => handleAddFiles(e.target.files)}
                accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.bmp,.webp"
                className="hidden"
              />

              {/* EMPTY STATE: ATTRACTIVE BIG DROPZONE */}
              {selectedFiles.length === 0 ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    backgroundColor: isDragging ? '#1e293b' : '#0f172a',
                    border: `3px dashed ${isDragging ? '#38bdf8' : '#64748b'}`
                  }}
                  className="p-8 rounded-2xl transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[220px] shadow-inner hover:border-cyan-400 group"
                >
                  <div className="space-y-3">
                    <div className="p-4 bg-cyan-500/20 text-cyan-400 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center border border-cyan-500/30 group-hover:scale-110 transition shadow-lg">
                      <Upload className="w-8 h-8 text-cyan-400 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-lg md:text-xl font-black text-white">ಇಲ್ಲಿ ಟಚ್ ಮಾಡಿ ಅಥವಾ ಫೈಲ್‌ಗಳನ್ನು ಡ್ರಾಪ್ ಮಾಡಿ (Tap to Select Files)</h4>
                      <p className="text-xs font-bold text-cyan-200 mt-1">ಬೆಂಬಲಿತ ಫೈಲ್‌ಗಳು • Supported Formats: <span className="text-amber-300 font-mono">PDF, PNG, JPG, JPEG, DOCX</span></p>
                      <p className="text-[11px] font-extrabold text-emerald-300 mt-0.5">✨ ಯಾವುದೇ ಮಿತಿಯಿಲ್ಲದೆ ಒಂದೇ ಬಾರಿಗೆ ಹಲವು ಫೈಲ್‌ಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಬಹುದು (Select Multiple Files)</p>
                    </div>
                    <div className="pt-2">
                      <span className="px-5 py-2.5 rounded-xl bg-cyan-600 text-black font-black text-xs uppercase tracking-wider shadow-lg inline-block hover:bg-cyan-400 transition">
                        📂 ಫೈಲ್‌ಗಳನ್ನು ಆಯ್ಕೆಮಾಡಿ (Select Documents)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* MULTI-FILE LIST CARD */
                <div className="p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/70 shadow-2xl space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📁</span>
                      <h4 className="text-sm font-black text-white uppercase tracking-wider">
                        ಆಯ್ಕೆಮಾಡಿದ ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳು • Selected Documents ({selectedFiles.length})
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 transition shadow cursor-pointer"
                      >
                        <span>➕ ಇನ್ನಷ್ಟು ಫೈಲ್ ಸೇರಿಸಿ (Add More)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles([])}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        ಎಲ್ಲವನ್ನೂ ತೆಗೆದುಹಾಕಿ (Clear All)
                      </button>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}_${idx}`}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 font-mono text-xs font-black">
                            {file.name.toLowerCase().endsWith('.pdf') ? '📄 PDF' : file.type.startsWith('image/') ? '🖼️ IMG' : '📝 DOC'}
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-black text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">{file.name}</h5>
                            <span className="text-[10px] font-mono text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to print</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                          title="Remove file"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs text-emerald-300 font-extrabold border-t border-slate-800">
                    <span>ಒಟ್ಟು ಫೈಲ್‌ಗಳು • Total: {selectedFiles.length} File(s)</span>
                    <span>{(selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB Total</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* MODE B: 2-SIDED ID CARD MERGE STUDIO (FRONT + BACK ONTO 1 SHEET) */}
          {/* ============================================================ */}
          {printMode === 'id_merge' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* MERGE ORIENTATION SELECTOR (VERTICAL / HORIZONTAL) */}
              <div className="p-4 rounded-2xl border border-emerald-500/40 bg-slate-900 shadow-md space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                    📐 1 ಪುಟದಲ್ಲಿ ಲೇಔಟ್ ಜೋಡಣೆ (Select A4 Sheet Layout):
                  </span>
                  <span className="text-[11px] font-extrabold text-emerald-300">
                    {idOrientation === 'vertical' ? '↕️ Vertical (Top & Bottom / ಮೇಲೆ & ಕೆಳಗೆ)' : '↔️ Horizontal (Side by Side / ಪಕ್ಕ ಪಕ್ಕದಲ್ಲಿ)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setIdOrientation('vertical')}
                    style={idOrientation === 'vertical'
                      ? { backgroundColor: '#059669', border: '2px solid #34d399', color: '#ffffff', boxShadow: '0 0 12px rgba(52, 211, 153, 0.4)' }
                      : { backgroundColor: '#1e293b', border: '1px solid #475569', color: '#94a3b8' }
                    }
                    className="p-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    <span className="text-base">↕️ ಮೇಲೆ ಮತ್ತು ಕೆಳಗೆ (Vertical)</span>
                    <span className="text-[10px] opacity-90">Top & Bottom (Standard Xerox)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIdOrientation('horizontal')}
                    style={idOrientation === 'horizontal'
                      ? { backgroundColor: '#059669', border: '2px solid #34d399', color: '#ffffff', boxShadow: '0 0 12px rgba(52, 211, 153, 0.4)' }
                      : { backgroundColor: '#1e293b', border: '1px solid #475569', color: '#94a3b8' }
                    }
                    className="p-3 rounded-xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex flex-col items-center justify-center gap-1 active:scale-95"
                  >
                    <span className="text-base">↔️ ಪಕ್ಕ ಪಕ್ಕದಲ್ಲಿ (Horizontal)</span>
                    <span className="text-[10px] opacity-90">Side by Side (Landscape)</span>
                  </button>
                </div>
              </div>

              {/* DUAL DROPZONES: FRONT & BACK OF ID CARD */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. FRONT CARD DROPZONE */}
                <div className="p-5 rounded-2xl border-2 border-indigo-500/60 bg-slate-900 shadow-xl space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <span>1️⃣ ಮುಂಭಾಗ • Card Front Side</span>
                    </span>
                    {frontCardFile && (
                      <button
                        type="button"
                        onClick={() => { setFrontCardFile(null); setFrontCardPreview(null); }}
                        className="text-[11px] font-black text-rose-400 hover:text-rose-300 underline cursor-pointer"
                      >
                        ✕ ತೆಗೆದುಹಾಕಿ (Remove)
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={frontInputRef}
                    onChange={(e) => handleFrontCardChange(e.target.files?.[0])}
                    accept="image/*,.pdf"
                    className="hidden"
                  />

                  {frontCardPreview ? (
                    <div
                      onClick={() => frontInputRef.current?.click()}
                      className="w-full h-44 rounded-xl border-2 border-emerald-400 overflow-hidden bg-slate-950 flex items-center justify-center relative cursor-pointer group shadow-lg"
                    >
                      <img src={frontCardPreview} alt="Front Card" className="w-full h-full object-contain p-1" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center font-black text-xs text-white">
                        🔄 ಬದಲಾಯಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ (Change)
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => frontInputRef.current?.click()}
                      className="w-full h-44 rounded-xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-400 bg-slate-950/80 flex flex-col items-center justify-center text-center p-4 cursor-pointer group transition"
                    >
                      <div className="p-3 rounded-xl bg-cyan-500/20 text-cyan-400 mb-2 group-hover:scale-110 transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <h5 className="text-sm font-black text-white">ಮುಂಭಾಗ ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ</h5>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">Upload Front Side of Aadhar / PAN / ID</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => frontInputRef.current?.click()}
                    style={{ backgroundColor: '#1e3a8a', color: '#ffffff', border: '1px solid #60a5fa' }}
                    className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-blue-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>📷 ಮುಂಭಾಗ ಫೋಟೋ (Select Front)</span>
                  </button>
                </div>

                {/* 2. BACK CARD DROPZONE */}
                <div className="p-5 rounded-2xl border-2 border-emerald-500/60 bg-slate-900 shadow-xl space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <span>2️⃣ ಹಿಂಭಾಗ • Card Back Side</span>
                    </span>
                    {backCardFile && (
                      <button
                        type="button"
                        onClick={() => { setBackCardFile(null); setBackCardPreview(null); }}
                        className="text-[11px] font-black text-rose-400 hover:text-rose-300 underline cursor-pointer"
                      >
                        ✕ ತೆಗೆದುಹಾಕಿ (Remove)
                      </button>
                    )}
                  </div>

                  <input
                    type="file"
                    ref={backInputRef}
                    onChange={(e) => handleBackCardChange(e.target.files?.[0])}
                    accept="image/*,.pdf"
                    className="hidden"
                  />

                  {backCardPreview ? (
                    <div
                      onClick={() => backInputRef.current?.click()}
                      className="w-full h-44 rounded-xl border-2 border-emerald-400 overflow-hidden bg-slate-950 flex items-center justify-center relative cursor-pointer group shadow-lg"
                    >
                      <img src={backCardPreview} alt="Back Card" className="w-full h-full object-contain p-1" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center font-black text-xs text-white">
                        🔄 ಬದಲಾಯಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ (Change)
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => backInputRef.current?.click()}
                      className="w-full h-44 rounded-xl border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 bg-slate-950/80 flex flex-col items-center justify-center text-center p-4 cursor-pointer group transition"
                    >
                      <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 mb-2 group-hover:scale-110 transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <h5 className="text-sm font-black text-white">ಹಿಂಭಾಗ ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ</h5>
                      <p className="text-[11px] font-bold text-slate-400 mt-0.5">Upload Back Side of Aadhar / PAN / ID</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => backInputRef.current?.click()}
                    style={{ backgroundColor: '#065f46', color: '#ffffff', border: '1px solid #34d399' }}
                    className="w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-emerald-800 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>📷 ಹಿಂಭಾಗ ಫೋಟೋ (Select Back)</span>
                  </button>
                </div>

              </div>

              {/* SWAP SIDES & LIVE MERGED A4 PREVIEW */}
              {(frontCardFile || backCardFile) && (
                <div className="p-5 rounded-2xl border-2 border-cyan-500/50 bg-slate-900 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-cyan-400" />
                        <span>🖼️ 1 ಪುಟದಲ್ಲಿ ಲೈವ್ ಪ್ರಿವ್ಯೂ • Live Merged A4 Sheet Preview</span>
                      </h4>
                      <p className="text-[11px] font-bold text-slate-300">ಹೇಗೆ ಪ್ರಿಂಟ್ ಆಗುತ್ತದೆ ಎಂಬುದನ್ನು ಕೆಳಗೆ ನೋಡಿ (Exact print output shown below)</p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSwapCards}
                      style={{ backgroundColor: '#475569', color: '#ffffff', border: '1px solid #94a3b8' }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow"
                      title="Swap Front and Back Cards"
                    >
                      <span>🔄 ಮುಂಭಾಗ ↔ ಹಿಂಭಾಗ ಅದಲು-ಬದಲು (Swap Sides)</span>
                    </button>
                  </div>

                  {mergedPreviewUrl && (
                    <div className="flex justify-center p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <img
                        src={mergedPreviewUrl}
                        alt="Merged ID Card A4 Preview"
                        className="max-h-[380px] w-auto object-contain rounded-lg shadow-2xl border border-slate-700"
                      />
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

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

            {/* PRINT MODE (INTERACTIVE COLOR VS BLACK & WHITE SELECTOR) */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  <span>ಪ್ರಿಂಟ್ ಮೋಡ್ ಆಯ್ಕೆಮಾಡಿ • Select Print Mode</span>
                </label>
                <span className={`text-[11px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider border shadow ${
                  colorMode === 'Color'
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/60'
                    : 'bg-blue-500/20 text-blue-300 border-blue-400/60'
                }`}>
                  {colorMode === 'Color' ? '🌈 Colour Selected' : '⚫⚪ B&W Selected'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Option 1: Black & White */}
                <button
                  type="button"
                  onClick={() => setColorMode('Black & White')}
                  style={colorMode === 'Black & White'
                    ? { backgroundColor: '#1e293b', border: '3px solid #60a5fa', boxShadow: '0 0 16px rgba(96, 165, 250, 0.4)' }
                    : { backgroundColor: '#0f172a', border: '1px solid #334155' }
                  }
                  className="p-3.5 rounded-xl text-left transition cursor-pointer flex items-center justify-between group hover:border-blue-400"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">⚫⚪</span>
                    <div>
                      <span className="text-xs font-black text-white block uppercase">ಕಪ್ಪು-ಬಿಳಿ (B&W)</span>
                      <span className="text-[10px] font-bold text-slate-300">Fast Laser Print</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-cyan-300 font-mono">₹2 / pg</span>
                    {colorMode === 'Black & White' && (
                      <span className="block text-[10px] text-emerald-400 font-extrabold">✓ Active</span>
                    )}
                  </div>
                </button>

                {/* Option 2: Full Colour */}
                <button
                  type="button"
                  onClick={() => setColorMode('Color')}
                  style={colorMode === 'Color'
                    ? { backgroundColor: '#064e3b', border: '3px solid #34d399', boxShadow: '0 0 18px rgba(52, 211, 153, 0.45)' }
                    : { backgroundColor: '#0f172a', border: '1px solid #334155' }
                  }
                  className="p-3.5 rounded-xl text-left transition cursor-pointer flex items-center justify-between group hover:border-emerald-400"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl animate-pulse">🌈</span>
                    <div>
                      <span className="text-xs font-black text-white block uppercase">ಬಣ್ಣದ ಪ್ರಿಂಟ್ (Colour)</span>
                      <span className="text-[10px] font-bold text-emerald-300">Vivid InkTank Photo</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-amber-300 font-mono">₹10 / pg</span>
                    {colorMode === 'Color' && (
                      <span className="block text-[10px] text-emerald-300 font-extrabold">✓ Active</span>
                    )}
                  </div>
                </button>
              </div>

              <p className="text-[11px] text-slate-300 font-extrabold flex items-center gap-1.5 pt-0.5">
                {colorMode === 'Color' ? (
                  <span>✨ <strong className="text-emerald-300">ಬಣ್ಣದ ಪ್ರಿಂಟ್:</strong> ನಿಮ್ಮ ಫೋಟೋಗಳು & ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳು Epson ಕಲರ್ ಇಂಕ್‌ಟ್ಯಾಂಕ್ ಪ್ರಿಂಟರ್‌ನಲ್ಲಿ ಮುದ್ರಿಸಲ್ಪಡುತ್ತವೆ.</span>
                ) : (
                  <span>⚡ <strong className="text-cyan-300">ಕಪ್ಪು-ಬಿಳಿ ಪ್ರಿಂಟ್:</strong> ಹೈ-ಸ್ಪೀಡ್ ಲೇಸರ್ ಪ್ರಿಂಟರ್‌ನಲ್ಲಿ ಸ್ಪಷ್ಟವಾಗಿ ಮುದ್ರಿಸಲ್ಪಡುತ್ತವೆ.</span>
                )}
              </p>
            </div>

          </div>

          {/* SUBMIT ACTION BUTTON */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={uploading || (printMode === 'single' ? selectedFiles.length === 0 : (!frontCardFile || !backCardFile))}
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
                  <span>ಫೈಲ್ ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ • Processing & Sending to Print Station...</span>
                </>
              ) : (
                <>
                  <Printer className="w-7 h-7 text-amber-300 animate-bounce flex-shrink-0" />
                  <span>
                    {printMode === 'id_merge'
                      ? '🪪 1 ಪುಟದಲ್ಲಿ ID ಕಾರ್ಡ್ ಪ್ರಿಂಟ್ ಮಾಡಿ • MERGE & PRINT ID CARD'
                      : selectedFiles.length > 1
                      ? `🚀 ಎಲ್ಲಾ ${selectedFiles.length} ಫೈಲ್‌ಗಳನ್ನು ಪ್ರಿಂಟ್‌ಗೆ ಕಳುಹಿಸಿ • PRINT ALL ${selectedFiles.length} FILES NOW`
                      : '🚀 ಪ್ರಿಂಟ್‌ಗೆ ಕಳುಹಿಸಿ • SEND TO PRINTER NOW'}
                  </span>
                </>
              )}
            </button>
          </div>

        </form>
      )}

    </div>
  );
};

