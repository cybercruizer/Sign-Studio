import React, { useRef, useState, useEffect } from 'react';
import { 
  Pen, 
  Sparkles, 
  Undo2, 
  Redo2, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Grid, 
  FileText, 
  Type, 
  Info, 
  Save, 
  FolderHeart, 
  Maximize2, 
  Paintbrush, 
  CheckCircle2, 
  Trash, 
  X,
  Palette,
  Ruler,
  Activity
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
  time: number;
  width?: number;
}

interface Stroke {
  points: Point[];
  color: string;
  thickness: number;
  penStyle: 'solid' | 'fountain' | 'pencil' | 'highlighter';
  velocitySensitivity?: number;
}

interface TextTemplate {
  text: string;
  font: string;
  size: number;
  color: string;
  italic: boolean;
}

interface SavedSignature {
  id: string;
  timestamp: string;
  pngDataUrl: string;
  svgString: string;
  width: number;
  height: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Canvas configuration states
  const [penColor, setPenColor] = useState('#0d1b2a'); // Premium Navy Charcoal
  const [penThickness, setPenThickness] = useState(4);
  const [penStyle, setPenStyle] = useState<'solid' | 'fountain' | 'pencil' | 'highlighter'>('fountain');
  const [canvasBg, setCanvasBg] = useState<'transparent' | 'notebook' | 'dotgrid' | 'slategrid'>('notebook');
  const [canvasPreset, setCanvasPreset] = useState<'widescreen' | 'standard' | 'square'>('widescreen');
  const [velocitySensitivity, setVelocitySensitivity] = useState(1.5);
  const [smoothingLevel, setSmoothingLevel] = useState(5); // 0 (rugged) to 10 (extremely smooth)
  const [mobileTab, setMobileTab] = useState<'style' | 'color' | 'size' | 'smooth' | 'canvas'>('style');
  
  // Helper to smooth a list of points using a moving average window proportional to the level
  const getSmoothedPoints = (pts: Point[], level: number): Point[] => {
    if (pts.length < 3 || level === 0) return pts;
    
    let smoothed = pts.map(p => ({ ...p }));
    // Apply multiple passes based on level (level 1-10 translates to 1 to 4 passes)
    const passes = Math.min(Math.floor(level / 2.5) + 1, 4); 
    const weight = 0.05 * level; // weight of neighbor points, scale with level
    
    for (let pass = 0; pass < passes; pass++) {
      const temp = smoothed.map(p => ({ ...p }));
      for (let i = 1; i < temp.length - 1; i++) {
        const prev = temp[i - 1];
        const curr = temp[i];
        const next = temp[i + 1];
        
        smoothed[i].x = curr.x * (1 - weight) + (prev.x + next.x) * (weight / 2);
        smoothed[i].y = curr.y * (1 - weight) + (prev.y + next.y) * (weight / 2);
      }
    }
    
    return smoothed;
  };
  
  // Drawing states
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [redoHistory, setRedoHistory] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokePoints = useRef<Point[]>([]);
  const lastPoint = useRef<Point | null>(null);
  const currentWidth = useRef<number>(4);
  
  // App system states
  const [copySuccess, setCopySuccess] = useState('');
  const [sessionSignatures, setSessionSignatures] = useState<SavedSignature[]>([]);
  const [selectedSavedSig, setSelectedSavedSig] = useState<SavedSignature | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCanvasDirty, setIsCanvasDirty] = useState(false);

  // Modal and Toolbar Display states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMobileToolbarOpen, setIsMobileToolbarOpen] = useState(true);

  // Preset Colors
  const premiumColors = [
    { name: 'Arang Hitam', hex: '#0f172a' }, // Tailwind slate-900
    { name: 'Biru Royal', hex: '#1d4ed8' },  // Tailwind blue-700
    { name: 'Biru Navy', hex: '#1e3a8a' },   // Deep dark navy
    { name: 'Merah Klasik', hex: '#b91c1c' }, // Tailwind red-700
    { name: 'Hijau Hutan', hex: '#15803d' },  // Tailwind green-700
    { name: 'Emas Hangat', hex: '#b45309' },  // Tailwind amber-700
    { name: 'Ungu Elegan', hex: '#6d28d9' }   // Tailwind purple-700
  ];

  // Map canvas size preset to internal coordinate resolution
  const getCanvasDimensions = () => {
    switch (canvasPreset) {
      case 'square':
        return { width: 800, height: 800 };
      case 'standard':
        return { width: 1000, height: 750 };
      case 'widescreen':
      default:
        return { width: 1200, height: 450 };
    }
  };

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions();

  // Redraw canvas whenever drawing state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    redrawCanvas(ctx, strokes);
    setIsCanvasDirty(strokes.length > 0);
  }, [strokes, penColor, canvasPreset, canvasBg, smoothingLevel]);

  // Handle Redraw Logic
  const redrawCanvas = (ctx: CanvasRenderingContext2D, strokeList: Stroke[]) => {
    // Clear entire bitmap area
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Render all strokes
    strokeList.forEach((stroke) => {
      if (stroke.points.length === 0) return;

      // Smooth points dynamically
      const pointsToDraw = getSmoothedPoints(stroke.points, smoothingLevel);

      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.penStyle === 'highlighter') {
        ctx.globalAlpha = 0.45;
      } else {
        ctx.globalAlpha = 1.0;
      }

      if (pointsToDraw.length === 1) {
        // Just a dot
        ctx.beginPath();
        ctx.arc(pointsToDraw[0].x, pointsToDraw[0].y, stroke.thickness / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        ctx.restore();
        return;
      }

      if (stroke.penStyle !== 'fountain') {
        // Uniform stroke width
        ctx.lineWidth = stroke.thickness;
        
        ctx.beginPath();
        ctx.moveTo(pointsToDraw[0].x, pointsToDraw[0].y);
        
        if (smoothingLevel > 0) {
          // Use quadratic curves for smooth lines
          for (let i = 1; i < pointsToDraw.length - 1; i++) {
            const xc = (pointsToDraw[i].x + pointsToDraw[i + 1].x) / 2;
            const yc = (pointsToDraw[i].y + pointsToDraw[i + 1].y) / 2;
            ctx.quadraticCurveTo(pointsToDraw[i].x, pointsToDraw[i].y, xc, yc);
          }
          // draw connection to the last point
          const lastIdx = pointsToDraw.length - 1;
          ctx.lineTo(pointsToDraw[lastIdx].x, pointsToDraw[lastIdx].y);
        } else {
          // Rugged/raw lines
          for (let i = 1; i < pointsToDraw.length; i++) {
            ctx.lineTo(pointsToDraw[i].x, pointsToDraw[i].y);
          }
        }
        ctx.stroke();
      } else {
        // Fountain pen with variable stroke-widths based on draw velocity
        for (let i = 0; i < pointsToDraw.length - 1; i++) {
          const p1 = pointsToDraw[i];
          const p2 = pointsToDraw[i + 1];
          const w = p2.width ?? stroke.thickness;
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineWidth = w;
          ctx.stroke();
        }
      }
      ctx.restore();
    });
  };

  // Translate touch or mouse event coordinates to standard coordinate map
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Map screen coordinate space directly to our fixed canvas size resolution
    const x = ((clientX - rect.left) / rect.width) * canvasWidth;
    const y = ((clientY - rect.top) / rect.height) * canvasHeight;

    return { x, y };
  };

  // Drawing event handlers
  const handleStartDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    const now = Date.now();
    
    // Initialize points
    const firstPoint: Point = {
      x: coords.x,
      y: coords.y,
      time: now,
      width: penThickness
    };

    currentStrokePoints.current = [firstPoint];
    lastPoint.current = firstPoint;
    currentWidth.current = penThickness;

    // Direct draw dot for instant responsiveness
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.fillStyle = penColor;
        ctx.beginPath();
        ctx.arc(coords.x, coords.y, penThickness / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  const handleDrawingMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const now = Date.now();
    const prevPoint = lastPoint.current;

    let computedWidth = penThickness;

    if (penStyle === 'fountain' && prevPoint) {
      // Calculate drawing velocity to adjust thickness dynamically
      const dx = coords.x - prevPoint.x;
      const dy = coords.y - prevPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(now - prevPoint.time, 1); // prevent division by zero

      // speed in px per ms
      const velocity = distance / dt;

      // Sensitivity tuning: faster drawing yields thinner line, slower yields thicker
      const minWidth = Math.max(1, penThickness * 0.35);
      const maxWidth = penThickness * 1.5;
      
      // Calculate width target
      const targetWidth = Math.max(minWidth, Math.min(maxWidth, maxWidth - velocity * velocitySensitivity));
      
      // Smooth out transitions using a linear interpolation
      computedWidth = currentWidth.current + (targetWidth - currentWidth.current) * 0.25;
      currentWidth.current = computedWidth;
    } else if (penStyle === 'pencil') {
      // Small pencil variation
      computedWidth = Math.max(1, penThickness * 0.7);
    }

    const newPoint: Point = {
      x: coords.x,
      y: coords.y,
      time: now,
      width: computedWidth
    };

    currentStrokePoints.current.push(newPoint);
    lastPoint.current = newPoint;

    // Draw the new segment instantly onto canvas to maintain zero-lag feeling
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx && prevPoint) {
        ctx.save();
        ctx.strokeStyle = penColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = penStyle === 'fountain' ? computedWidth : penThickness;
        
        if (penStyle === 'highlighter') {
          ctx.globalAlpha = 0.45;
        } else if (penStyle === 'pencil') {
          ctx.globalAlpha = 0.8;
        }

        ctx.beginPath();
        ctx.moveTo(prevPoint.x, prevPoint.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const handleStopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentStrokePoints.current.length > 0) {
      const newStroke: Stroke = {
        points: [...currentStrokePoints.current],
        color: penColor,
        thickness: penThickness,
        penStyle: penStyle,
        velocitySensitivity: velocitySensitivity
      };

      setStrokes((prev) => [...prev, newStroke]);
      setRedoHistory([]); // Clear redo stack on new action
    }

    currentStrokePoints.current = [];
    lastPoint.current = null;
  };

  // Clear Canvas state
  const clearCanvas = () => {
    setStrokes([]);
    setRedoHistory([]);
    setShowClearConfirm(false);
  };

  // Undo stroke
  const handleUndo = () => {
    if (strokes.length === 0) return;
    const previous = [...strokes];
    const undone = previous.pop();
    setStrokes(previous);
    if (undone) {
      setRedoHistory((prev) => [...prev, undone]);
    }
  };

  // Redo stroke
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const redoneStack = [...redoHistory];
    const redone = redoneStack.pop();
    if (redone) {
      setStrokes((prev) => [...prev, redone]);
    }
    setRedoHistory(redoneStack);
  };

  // Generate dynamic SVG string representing the signature
  const generateSVGString = (): string => {
    let paths = '';

    // 1. Add drawn strokes
    strokes.forEach((stroke, strokeIdx) => {
      if (stroke.points.length === 0) return;

      const pointsToDraw = getSmoothedPoints(stroke.points, smoothingLevel);
      const strokeOpacity = stroke.penStyle === 'highlighter' ? 0.45 : stroke.penStyle === 'pencil' ? 0.8 : 1.0;
      
      if (pointsToDraw.length === 1) {
        const p = pointsToDraw[0];
        paths += `  <circle cx="${p.x}" cy="${p.y}" r="${stroke.thickness / 2}" fill="${stroke.color}" opacity="${strokeOpacity}" />\n`;
        return;
      }

      if (stroke.penStyle !== 'fountain') {
        if (smoothingLevel > 0) {
          // Draw uniform Bezier curve
          let d = `M ${pointsToDraw[0].x.toFixed(1)} ${pointsToDraw[0].y.toFixed(1)}`;
          
          for (let i = 1; i < pointsToDraw.length - 1; i++) {
            const xc = (pointsToDraw[i].x + pointsToDraw[i + 1].x) / 2;
            const yc = (pointsToDraw[i].y + pointsToDraw[i + 1].y) / 2;
            d += ` Q ${pointsToDraw[i].x.toFixed(1)} ${pointsToDraw[i].y.toFixed(1)}, ${xc.toFixed(1)} ${yc.toFixed(1)}`;
          }
          
          const last = pointsToDraw[pointsToDraw.length - 1];
          d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

          paths += `  <path d="${d}" stroke="${stroke.color}" stroke-width="${stroke.thickness}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${strokeOpacity}" />\n`;
        } else {
          // Rugged/raw straight lines
          let d = `M ${pointsToDraw[0].x.toFixed(1)} ${pointsToDraw[0].y.toFixed(1)}`;
          for (let i = 1; i < pointsToDraw.length; i++) {
            d += ` L ${pointsToDraw[i].x.toFixed(1)} ${pointsToDraw[i].y.toFixed(1)}`;
          }
          paths += `  <path d="${d}" stroke="${stroke.color}" stroke-width="${stroke.thickness}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${strokeOpacity}" />\n`;
        }
      } else {
        // Fountain pen with multiple connected lines representing dynamic widths
        paths += `  <g opacity="${strokeOpacity}">\n`;
        for (let i = 0; i < pointsToDraw.length - 1; i++) {
          const p1 = pointsToDraw[i];
          const p2 = pointsToDraw[i + 1];
          const w = p2.width ?? stroke.thickness;
          paths += `    <line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${stroke.color}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" />\n`;
        }
        paths += `  </g>\n`;
      }
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasWidth} ${canvasHeight}" width="${canvasWidth}" height="${canvasHeight}">
${paths}</svg>`;
  };

  // Download Signature as Transparent PNG
  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `tanda_tangan_${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Signature as Vector SVG
  const handleDownloadSVG = () => {
    const svgString = generateSVGString();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `tanda_tangan_${Date.now()}.svg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy signature as transparent PNG base64 text or real image to clipboard
  const handleCopyToClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // First attempt: try copying as actual image blob (modern browser clipboard standard)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          copyBase64Fallback(canvas);
          return;
        }
        try {
          // Inside iframe sandbox, this API is standard but sometimes restricted by host frame rules
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopySuccess('Berhasil disalin sebagai Gambar!');
          setTimeout(() => setCopySuccess(''), 3000);
        } catch (err) {
          // If browser rejects blob writing (e.g. iframe policy), fall back to base64 text
          copyBase64Fallback(canvas);
        }
      }, 'image/png');
    } catch (e) {
      copyBase64Fallback(canvas);
    }
  };

  const copyBase64Fallback = async (canvas: HTMLCanvasElement) => {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await navigator.clipboard.writeText(dataUrl);
      setCopySuccess('Base64 disalin! (Sebab browser membatasi salin file)');
      setTimeout(() => setCopySuccess(''), 4000);
    } catch (err) {
      setCopySuccess('Gagal menyalin. Silakan unduh gambar saja.');
      setTimeout(() => setCopySuccess(''), 3000);
    }
  };

  // Save current signature in local React state history list for the active session
  const handleSaveToSession = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pngUrl = canvas.toDataURL('image/png');
    const svgStr = generateSVGString();
    
    const timeString = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const newSaved: SavedSignature = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: timeString,
      pngDataUrl: pngUrl,
      svgString: svgStr,
      width: canvasWidth,
      height: canvasHeight
    };

    setSessionSignatures((prev) => [newSaved, ...prev]);
  };

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 font-sans pb-64 md:pb-16 antialiased">
      {/* Top Professional Header */}
      <header className="bg-white border-b border-slate-200 relative md:sticky md:top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 md:py-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2.5 bg-indigo-600 text-white rounded-lg md:rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center flex-shrink-0">
              <Pen className="w-4 h-4 md:w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                Tanda Tangan Digital Studio
                <span className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Transparan PNG + SVG
                </span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] md:text-xs font-medium text-slate-400 bg-slate-100 py-0.5 px-2 md:py-1 md:px-2.5 rounded-md flex items-center gap-1 md:gap-1.5">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Sesi Lokal Aktif
            </span>
          </div>
        </div>
      </header>

      {/* Main Bento Studio Layout */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: Controls & Toolbar (Span 4) */}
          <section className="hidden lg:flex lg:col-span-4 flex-col gap-6">
            
            {/* Card 1: Pen Configuration */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Paintbrush className="w-4 h-4 text-indigo-600" />
                  Atur Kuas &amp; Pena
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">Pengaturan</span>
              </div>

              {/* Pen Styles Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">Gaya Pena</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="pen-style-fountain"
                    onClick={() => setPenStyle('fountain')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      penStyle === 'fountain'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-medium shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                    <div className="leading-tight">
                      <p className="text-xs font-semibold">Kaligrafi</p>
                      <p className="text-[10px] text-slate-400">Ketebalan dinamis</p>
                    </div>
                  </button>

                  <button
                    id="pen-style-solid"
                    onClick={() => setPenStyle('solid')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      penStyle === 'solid'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-medium shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Pen className="w-4 h-4 flex-shrink-0" />
                    <div className="leading-tight">
                      <p className="text-xs font-semibold">Pena Solid</p>
                      <p className="text-[10px] text-slate-400">Garis seragam</p>
                    </div>
                  </button>

                  <button
                    id="pen-style-pencil"
                    onClick={() => setPenStyle('pencil')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      penStyle === 'pencil'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-medium shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="text-xs flex-shrink-0">✏️</span>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold">Pensil</p>
                      <p className="text-[10px] text-slate-400">Lembut &amp; berserat</p>
                    </div>
                  </button>

                  <button
                    id="pen-style-highlighter"
                    onClick={() => setPenStyle('highlighter')}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      penStyle === 'highlighter'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-medium shadow-2xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="text-xs flex-shrink-0">🖍️</span>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold">Stabilo</p>
                      <p className="text-[10px] text-slate-400">Transparan tebal</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Color Swatch Panel */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500">Warna Tinta</label>
                  <span className="text-xs font-mono font-medium text-slate-400">{penColor}</span>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5">
                  {premiumColors.map((color) => (
                    <button
                      key={color.hex}
                      id={`color-swatch-${color.hex}`}
                      onClick={() => setPenColor(color.hex)}
                      title={color.name}
                      style={{ backgroundColor: color.hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer hover:scale-110 active:scale-95 ${
                        penColor.toLowerCase() === color.hex.toLowerCase()
                          ? 'border-indigo-500 scale-105 ring-2 ring-indigo-100'
                          : 'border-white shadow-xs'
                      }`}
                    />
                  ))}
                  
                  {/* Custom Color Input Wrapper */}
                  <label 
                    className="relative w-7 h-7 rounded-full border-2 border-dashed border-slate-300 hover:border-indigo-500 cursor-pointer flex items-center justify-center bg-slate-50 transition-colors"
                    title="Warna Kustom"
                  >
                    <input
                      id="custom-color-input"
                      type="color"
                      value={penColor}
                      onChange={(e) => setPenColor(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 font-bold">+</span>
                  </label>
                </div>
              </div>

              {/* Thickness Slider */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                  <label>Ketebalan Pena</label>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{penThickness} px</span>
                </div>
                <input
                  id="pen-thickness-slider"
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={penThickness}
                  onChange={(e) => setPenThickness(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                
                {/* Live Brush Size Preview Circle */}
                <div className="flex items-center gap-3 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 mt-1">
                  <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <div 
                      style={{ 
                        backgroundColor: penColor, 
                        width: `${penThickness * 2}px`, 
                        height: `${penThickness * 2}px`,
                        opacity: penStyle === 'highlighter' ? 0.45 : penStyle === 'pencil' ? 0.8 : 1,
                        borderRadius: '50%'
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <p className="font-semibold text-slate-600">Pratinjau Pena</p>
                    <p>Ukuran garis sebenarnya pada kanvas</p>
                  </div>
                </div>
              </div>

              {/* Smoothing Control */}
              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                  <label className="flex items-center gap-1.5">
                    <span>Penghalusan Garis (Smoothing)</span>
                  </label>
                  <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-md text-[11px] font-bold">
                    {smoothingLevel === 0 ? 'Mati (Kasar)' : smoothingLevel === 10 ? 'Maksimal' : `${smoothingLevel}x`}
                  </span>
                </div>
                <input
                  id="smoothing-level-slider"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={smoothingLevel}
                  onChange={(e) => setSmoothingLevel(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>Kasar (Alami)</span>
                  <span>Sangat Mulus</span>
                </div>
              </div>

              {/* Velocity Sensitivity (Only for Fountain) */}
              {penStyle === 'fountain' && (
                <div className="flex flex-col gap-2 bg-indigo-50/20 p-3 rounded-xl border border-indigo-100/30 animate-fade-in">
                  <div className="flex justify-between items-center text-xs text-indigo-950 font-semibold">
                    <label className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Efek Kaligrafi
                    </label>
                    <span>{velocitySensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    id="velocity-sensitivity-slider"
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={velocitySensitivity}
                    onChange={(e) => setVelocitySensitivity(Number(e.target.value))}
                    className="w-full h-1.5 bg-indigo-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="text-[10px] text-indigo-500/80 leading-snug">
                    Semakin tinggi sensitivitas, semakin tipis garis saat Anda menggambar dengan cepat.
                  </span>
                </div>
              )}
            </div>

            {/* Card 2: Canvas Background guidelines & Dimensions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
                  <Grid className="w-4 h-4 text-indigo-600" />
                  Kanvas &amp; Panduan
                </h2>
                <span className="text-[11px] text-slate-400 font-medium">Bantuan Visual</span>
              </div>

              {/* Background Styles selection */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">Gaya Garis Panduan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="bg-style-notebook"
                    onClick={() => setCanvasBg('notebook')}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                      canvasBg === 'notebook'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-4 h-4 border-b border-slate-300 flex items-center text-[10px]">📏</span>
                    Garis Buku
                  </button>

                  <button
                    id="bg-style-dotgrid"
                    onClick={() => setCanvasBg('dotgrid')}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                      canvasBg === 'dotgrid'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    Titik Grid
                  </button>

                  <button
                    id="bg-style-transparent"
                    onClick={() => setCanvasBg('transparent')}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                      canvasBg === 'transparent'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 bg-slate-100 border border-slate-300 rounded-xs flex-shrink-0" />
                    Polos Putih
                  </button>

                  <button
                    id="bg-style-slategrid"
                    onClick={() => setCanvasBg('slategrid')}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-colors ${
                      canvasBg === 'slategrid'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-3.5 h-3.5 bg-slate-900 border border-slate-700 rounded-xs flex-shrink-0" />
                    Tablet Slate
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug mt-1">
                  * Garis bantuan di atas hanya sebagai panduan menulis dan <strong>tidak akan ikut tersimpan</strong> pada hasil unduhan PNG/SVG transparan Anda.
                </p>
              </div>

              {/* Canvas Aspect Ratio presets */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500">Ukuran &amp; Proporsi</label>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  <button
                    id="preset-widescreen"
                    onClick={() => setCanvasPreset('widescreen')}
                    className={`p-2 rounded-lg border text-[11px] leading-tight flex flex-col items-center justify-center transition-colors ${
                      canvasPreset === 'widescreen'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-7 h-3.5 bg-slate-200 rounded-xs mb-1 border border-slate-300" />
                    Widescreen
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">8:3 (1200x450)</span>
                  </button>

                  <button
                    id="preset-standard"
                    onClick={() => setCanvasPreset('standard')}
                    className={`p-2 rounded-lg border text-[11px] leading-tight flex flex-col items-center justify-center transition-colors ${
                      canvasPreset === 'standard'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-6.5 h-4.5 bg-slate-200 rounded-xs mb-1 border border-slate-300" />
                    Standard
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">4:3 (1000x750)</span>
                  </button>

                  <button
                    id="preset-square"
                    onClick={() => setCanvasPreset('square')}
                    className={`p-2 rounded-lg border text-[11px] leading-tight flex flex-col items-center justify-center transition-colors ${
                      canvasPreset === 'square'
                        ? 'border-indigo-600 bg-indigo-50/30 text-indigo-700 font-semibold'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-5 h-5 bg-slate-200 rounded-xs mb-1 border border-slate-300" />
                    Kotak
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">1:1 (800x800)</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* CENTER/RIGHT COLUMN: Signature Pad & Main Controls (Span 8) */}
          <section className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Drawing Pad Main Area */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
              
              {/* Canvas Header status bar */}
              <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${isDrawing ? 'bg-amber-500 animate-pulse' : isCanvasDirty ? 'bg-indigo-500' : 'bg-slate-300'}`} />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    {isDrawing ? 'Sedang Menggambar...' : isCanvasDirty ? 'Draf Tanda Tangan Aktif' : 'Kanvas Siap Ditulisi'}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600">Resolusi Ekspor:</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {canvasWidth} x {canvasHeight} px
                    </span>
                  </div>
                  <div className="hidden sm:block text-slate-300">|</div>
                  <div className="hidden sm:block">
                    Total Tarikan: <span className="font-mono font-bold text-indigo-600">{strokes.length}</span>
                  </div>
                </div>
              </div>

              {/* Signature Canvas Stage Area */}
              <div className="relative p-6 bg-slate-100 flex items-center justify-center overflow-hidden">
                
                {/* Visual Canvas frame wrapper with responsive aspect ratio */}
                <div 
                  className="relative w-full max-w-full rounded-xl overflow-hidden shadow-inner border border-slate-300/80 transition-all duration-300"
                  style={{ 
                    aspectRatio: canvasPreset === 'widescreen' ? '8/3' : canvasPreset === 'standard' ? '4/3' : '1/1'
                  }}
                >
                  
                  {/* Real HTML5 Drawing Canvas */}
                  <canvas
                    id="signature-pad-canvas"
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    onMouseDown={handleStartDrawing}
                    onMouseMove={handleDrawingMove}
                    onMouseUp={handleStopDrawing}
                    onMouseLeave={handleStopDrawing}
                    onTouchStart={handleStartDrawing}
                    onTouchMove={handleDrawingMove}
                    onTouchEnd={handleStopDrawing}
                    className={`absolute inset-0 w-full h-full cursor-crosshair touch-none transition-all ${
                      canvasBg === 'notebook' ? 'bg-notebook' :
                      canvasBg === 'dotgrid' ? 'bg-dotgrid' :
                      canvasBg === 'slategrid' ? 'bg-slategrid' : 'bg-white'
                    }`}
                  />

                  {/* Watermark/Placeholder Overlay (Fades out when canvas contains strokes or drawing starts) */}
                  {!isCanvasDirty && !isDrawing && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center select-none animate-fade-in">
                      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs p-5 rounded-2xl border border-slate-200/50 max-w-sm flex flex-col items-center gap-2">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                          <Pen className="w-5 h-5 animate-bounce" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">Tulis Tanda Tangan Anda</p>
                        <p className="text-xs text-slate-500">
                          Gunakan mouse atau perangkat layar sentuh Anda untuk mulai menulis langsung pada bidang kertas di atas.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar directly underneath the canvas */}
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                
                {/* Undo / Redo group */}
                <div className="flex items-center gap-1.5">
                  <button
                    id="btn-undo"
                    onClick={handleUndo}
                    disabled={strokes.length === 0}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 text-xs font-semibold"
                    title="Undo Tarikan Terakhir"
                  >
                    <Undo2 className="w-4 h-4" />
                    Undo
                  </button>
                  
                  <button
                    id="btn-redo"
                    onClick={handleRedo}
                    disabled={redoHistory.length === 0}
                    className="p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1 text-xs font-semibold"
                    title="Redo Tarikan Terakhir"
                  >
                    <Redo2 className="w-4 h-4" />
                    Redo
                  </button>
                </div>

                {/* Clear / Save Workspace Actions */}
                <div className="flex items-center gap-2">
                  
                  {/* Session Save */}
                  <button
                    id="btn-save-session"
                    onClick={handleSaveToSession}
                    disabled={!isCanvasDirty}
                    className="p-2 px-3.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 text-xs font-bold"
                    title="Simpan sementara draf tanda tangan ini ke sesi galeri di bawah"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Draf
                  </button>

                  {/* Export Trigger */}
                  <button
                    id="btn-trigger-export"
                    onClick={() => setIsExportModalOpen(true)}
                    disabled={!isCanvasDirty}
                    className="p-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 text-xs font-bold shadow-md shadow-emerald-100/50 cursor-pointer"
                    title="Ekspor tanda tangan Anda dalam berbagai format"
                  >
                    <Download className="w-4 h-4" />
                    Ekspor Hasil
                  </button>

                  {/* Clear Canvas */}
                  {!showClearConfirm ? (
                    <button
                      id="btn-clear-canvas"
                      onClick={() => setShowClearConfirm(true)}
                      disabled={!isCanvasDirty}
                      className="p-2 px-3.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 text-xs font-bold"
                    >
                      <Trash2 className="w-4 h-4" />
                      Kosongkan
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 bg-rose-100/50 p-0.5 rounded-lg border border-rose-200 animate-fade-in">
                      <span className="text-[10px] font-bold text-rose-800 px-2">Yakin hapus?</span>
                      <button
                        id="btn-confirm-clear"
                        onClick={clearCanvas}
                        className="p-1.5 px-2.5 rounded-md bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold transition-colors"
                      >
                        Ya
                      </button>
                      <button
                        id="btn-cancel-clear"
                        onClick={() => setShowClearConfirm(false)}
                        className="p-1.5 px-2.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </section>

        </div>

        {/* SECTION 4: SAVED HISTORY GALLERY PANEL */}
        {sessionSignatures.length > 0 && (
          <section className="mt-10 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs animate-fade-in">
            <div className="border-b border-slate-100 pb-4 mb-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                  <FolderHeart className="w-5 h-5 text-indigo-600" />
                  Galeri Sesi Tanda Tangan Anda ({sessionSignatures.length})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Kumpulan tanda tangan yang telah Anda simpan selama sesi ini berlangsung. Klik draf untuk mengunduh kembali.
                </p>
              </div>
              
              <button
                id="btn-clear-session"
                onClick={() => setSessionSignatures([])}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Trash className="w-3.5 h-3.5" />
                Hapus Semua Galeri
              </button>
            </div>

            {/* Grid of session cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {sessionSignatures.map((sig) => (
                <div
                  key={sig.id}
                  id={`saved-sig-${sig.id}`}
                  className="group relative bg-slate-50 border border-slate-200 hover:border-indigo-400 p-2.5 rounded-2xl flex flex-col gap-2 transition-all hover:shadow-xs"
                >
                  {/* Miniature Image Preview */}
                  <div className="bg-white rounded-lg border border-slate-100 p-2 flex items-center justify-center h-24 overflow-hidden relative shadow-2xs">
                    <img
                      src={sig.pngDataUrl}
                      alt="Draf signature"
                      className="max-h-full max-w-full object-contain"
                    />
                    
                    {/* Floating Action Menu inside hover overlay */}
                    <div className="absolute inset-0 bg-slate-900/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 rounded-lg">
                      <button
                        id={`btn-view-saved-${sig.id}`}
                        onClick={() => setSelectedSavedSig(sig)}
                        className="p-1.5 bg-white text-slate-800 rounded-md hover:bg-slate-100 text-xs font-bold cursor-pointer"
                        title="Perbesar & Simpan"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-delete-saved-${sig.id}`}
                        onClick={() => setSessionSignatures((prev) => prev.filter((s) => s.id !== sig.id))}
                        className="p-1.5 bg-rose-600 text-white rounded-md hover:bg-rose-700 text-xs font-bold cursor-pointer"
                        title="Hapus"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 px-0.5">
                    <span className="font-mono font-medium">{sig.timestamp}</span>
                    <span className="font-bold text-slate-500 uppercase">{sig.width > 1100 ? 'Wide' : 'Square'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* MOBILE BOTTOM TOOLBAR (DARK PREMIUM THEME LIKE THE SCREENSHOT) */}
      {isMobileToolbarOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 text-white shadow-2xl p-4 pb-6 md:hidden flex flex-col gap-4">
          
          {/* Mobile Toolbar Header with Toggle */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
              Atur Pena &amp; Kanvas
            </span>
            <button
              id="btn-close-mobile-toolbar"
              onClick={() => setIsMobileToolbarOpen(false)}
              className="p-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md transition-colors text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Sembunyikan Menu"
            >
              <span>Sembunyikan</span>
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Active Tab Sliders & Secondary Previews */}
          <div>
            {mobileTab === 'style' && penStyle === 'fountain' && (
            <div className="flex flex-col gap-1.5 mb-2 px-1 animate-fade-in">
              <div className="flex justify-between items-center text-[11px] text-slate-300 font-bold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Efek Kaligrafi (Ketebalan Dinamis)
                </span>
                <span className="text-amber-400">{velocitySensitivity.toFixed(1)}x</span>
              </div>
              <input
                id="mobile-velocity-sensitivity-slider"
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={velocitySensitivity}
                onChange={(e) => setVelocitySensitivity(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          )}

          {mobileTab === 'size' && (
            <div className="flex flex-col gap-1.5 mb-2 px-1 animate-fade-in">
              <div className="flex justify-between items-center text-[11px] text-slate-300 font-bold">
                <span>Ketebalan Pena</span>
                <span className="text-amber-400">{penThickness} px</span>
              </div>
              <input
                id="mobile-pen-thickness-slider"
                type="range"
                min="1"
                max="20"
                step="1"
                value={penThickness}
                onChange={(e) => setPenThickness(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          )}

          {mobileTab === 'smooth' && (
            <div className="flex flex-col gap-1.5 mb-2 px-1 animate-fade-in">
              <div className="flex justify-between items-center text-[11px] text-slate-300 font-bold">
                <span>Penghalusan Garis (Smoothing)</span>
                <span className="text-amber-400">
                  {smoothingLevel === 0 ? 'Mati (Kasar)' : smoothingLevel === 10 ? 'Maksimal' : `${smoothingLevel}x`}
                </span>
              </div>
              <input
                id="mobile-smoothing-level-slider"
                type="range"
                min="0"
                max="10"
                step="1"
                value={smoothingLevel}
                onChange={(e) => setSmoothingLevel(Number(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>
          )}

          {mobileTab === 'color' && (
            <div className="text-center text-[11px] text-slate-400 font-semibold mb-1 px-1">
              Warna tinta aktif: <span className="font-mono text-amber-400">{penColor}</span>
            </div>
          )}
        </div>

        {/* Inner Tab Control Elements (Submenus) */}
        <div className="w-full">
          {/* Gaya Pena Submenu */}
          {mobileTab === 'style' && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1 justify-start xs:justify-center animate-fade-in">
              <button
                onClick={() => setPenStyle('fountain')}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-18 h-18 rounded-xl border transition-all ${
                  penStyle === 'fountain'
                    ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-400/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-[9px] font-semibold">Kaligrafi</span>
              </button>

              <button
                onClick={() => setPenStyle('solid')}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-18 h-18 rounded-xl border transition-all ${
                  penStyle === 'solid'
                    ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-400/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <Pen className="w-4 h-4" />
                <span className="text-[9px] font-semibold">Solid</span>
              </button>

              <button
                onClick={() => setPenStyle('pencil')}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-18 h-18 rounded-xl border transition-all ${
                  penStyle === 'pencil'
                    ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-400/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <span className="text-sm leading-none">✏️</span>
                <span className="text-[9px] font-semibold">Pensil</span>
              </button>

              <button
                onClick={() => setPenStyle('highlighter')}
                className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 w-18 h-18 rounded-xl border transition-all ${
                  penStyle === 'highlighter'
                    ? 'bg-amber-400 border-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-400/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
              >
                <span className="text-sm leading-none">🖍️</span>
                <span className="text-[9px] font-semibold">Stabilo</span>
              </button>
            </div>
          )}

          {/* Warna Tinta Submenu */}
          {mobileTab === 'color' && (
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 justify-start xs:justify-center animate-fade-in">
              {premiumColors.map((color) => (
                <button
                  key={color.hex}
                  onClick={() => setPenColor(color.hex)}
                  style={{ backgroundColor: color.hex }}
                  className={`w-8 h-8 rounded-full border-2 flex-shrink-0 transition-transform ${
                    penColor.toLowerCase() === color.hex.toLowerCase()
                      ? 'border-amber-400 scale-110 ring-2 ring-amber-400/30'
                      : 'border-slate-700 shadow-sm'
                  }`}
                  title={color.name}
                />
              ))}
              
              {/* Mobile Custom Color Input */}
              <label 
                className="relative w-8 h-8 rounded-full border-2 border-dashed border-slate-600 hover:border-amber-400 flex-shrink-0 flex items-center justify-center bg-slate-800 transition-colors cursor-pointer"
                title="Warna Kustom"
              >
                <input
                  id="mobile-custom-color-picker"
                  type="color"
                  value={penColor}
                  onChange={(e) => setPenColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-bold">+</span>
              </label>
            </div>
          )}

          {/* Ketebalan Submenu Live Preview */}
          {mobileTab === 'size' && (
            <div className="flex items-center justify-center gap-3 bg-slate-800/40 p-2 rounded-xl border border-slate-800/80 max-w-xs mx-auto animate-fade-in">
              <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                <div 
                  style={{ 
                    backgroundColor: penColor, 
                    width: `${Math.max(2, penThickness * 1.5)}px`, 
                    height: `${Math.max(2, penThickness * 1.5)}px`,
                    opacity: penStyle === 'highlighter' ? 0.45 : penStyle === 'pencil' ? 0.8 : 1,
                    borderRadius: '50%'
                  }}
                />
              </div>
              <div className="text-[10px] text-slate-300">
                <p className="font-semibold text-white">Pratinjau Garis</p>
                <p className="text-slate-400 font-mono text-[9px]">Garis {penThickness}px • Tinta {penColor}</p>
              </div>
            </div>
          )}

          {/* Kehalusan Submenu */}
          {mobileTab === 'smooth' && (
            <div className="flex items-center justify-center gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800/80 max-w-xs mx-auto animate-fade-in text-[10px] text-slate-300">
              <p className="text-center text-slate-400 leading-snug">
                {smoothingLevel === 0 
                  ? 'Garis alami tanpa modifikasi spline (lebih kasar / organik).' 
                  : smoothingLevel <= 4 
                  ? 'Garis dengan penghalusan spline ringan.'
                  : smoothingLevel <= 8 
                  ? 'Garis halus yang sangat rapi & profesional.'
                  : 'Garis lengkung kurva kuadratik maksimal.'}
              </p>
            </div>
          )}

          {/* Latar / Kanvas Submenu */}
          {mobileTab === 'canvas' && (
            <div className="flex flex-col gap-2 animate-fade-in">
              {/* Guides Row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 justify-start xs:justify-center">
                <button
                  onClick={() => setCanvasBg('notebook')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasBg === 'notebook'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  📏 Buku
                </button>
                <button
                  onClick={() => setCanvasBg('dotgrid')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasBg === 'dotgrid'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  <Grid className="w-3 h-3 inline mr-1" /> Grid
                </button>
                <button
                  onClick={() => setCanvasBg('transparent')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasBg === 'transparent'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  ⬜ Polos
                </button>
                <button
                  onClick={() => setCanvasBg('slategrid')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasBg === 'slategrid'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  ⬛ Slate
                </button>
              </div>

              {/* Preset Row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 justify-start xs:justify-center">
                <button
                  onClick={() => setCanvasPreset('widescreen')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasPreset === 'widescreen'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  8:3 (Widescreen)
                </button>
                <button
                  onClick={() => setCanvasPreset('standard')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasPreset === 'standard'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  4:3 (Standard)
                </button>
                <button
                  onClick={() => setCanvasPreset('square')}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold transition-colors ${
                    canvasPreset === 'square'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  1:1 (Kotak)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Primary Bottom Menu Tabs (Adjust, Crop, Colors, size etc) */}
        <div className="flex items-center justify-around border-t border-slate-800 pt-2.5 mt-0.5 gap-1">
          <button
            onClick={() => setMobileTab('style')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors ${
              mobileTab === 'style' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Gaya</span>
          </button>

          <button
            onClick={() => setMobileTab('color')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors ${
              mobileTab === 'color' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Warna</span>
          </button>

          <button
            onClick={() => setMobileTab('size')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors ${
              mobileTab === 'size' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span>Ukuran</span>
          </button>

          <button
            onClick={() => setMobileTab('smooth')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors ${
              mobileTab === 'smooth' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Kehalusan</span>
          </button>

          <button
            onClick={() => setMobileTab('canvas')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] transition-colors ${
              mobileTab === 'canvas' ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Kanvas</span>
          </button>
        </div>
      </div>
      )}

      {/* FLOAT ACTION BUTTON TO OPEN MOBILE TOOLBAR (WHEN HIDDEN) */}
      {!isMobileToolbarOpen && (
        <button
          id="btn-open-mobile-toolbar"
          onClick={() => setIsMobileToolbarOpen(true)}
          className="fixed bottom-6 right-6 z-50 md:hidden bg-slate-900 hover:bg-slate-800 text-amber-400 p-3 px-4 rounded-full shadow-2xl flex items-center gap-2 border border-slate-800 text-xs font-bold animate-fade-in cursor-pointer active:scale-95 transition-all"
        >
          <Paintbrush className="w-4 h-4 text-amber-400" />
          <span>Atur Pena</span>
        </button>
      )}

      {/* EXPORT MODAL PREVIEW & DOWNLOAD OPTIONS */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm uppercase tracking-wide">
                  <Download className="w-4.5 h-4.5 text-emerald-600" />
                  Ekspor &amp; Unduh Tanda Tangan
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Pilih format ekspor dengan latar belakang transparan</p>
              </div>
              <button
                id="btn-close-export-modal"
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-4">
              
              {/* PNG Download */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-200 transition-all">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                      PNG Transparan
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">Format Gambar PNG</h5>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Format resolusi tinggi tanpa latar belakang, sangat ideal untuk disisipkan ke file Word, PDF, atau email.
                  </p>
                </div>
                <button
                  id="btn-modal-download-png"
                  onClick={() => {
                    handleDownloadPNG();
                    setIsExportModalOpen(false);
                  }}
                  className="w-full sm:w-auto py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh PNG
                </button>
              </div>

              {/* SVG Download */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-200 transition-all">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Vektor SVG
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">Format Vektor SVG</h5>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Dapat diperbesar tanpa batas tanpa pecah. Sangat direkomendasikan untuk dokumen legal formal berkualitas tinggi.
                  </p>
                </div>
                <button
                  id="btn-modal-download-svg"
                  onClick={() => {
                    handleDownloadSVG();
                    setIsExportModalOpen(false);
                  }}
                  className="w-full sm:w-auto py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh SVG
                </button>
              </div>

              {/* Clipboard Copy */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-200 transition-all">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Salin Instan
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">Salin ke Papan Klip</h5>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Salin gambar transparan langsung ke clipboard Anda lalu paste (Ctrl+V) langsung ke dokumen aktif Anda.
                  </p>
                </div>
                <div className="w-full sm:w-auto flex flex-col items-center gap-1">
                  <button
                    id="btn-modal-copy-clipboard"
                    onClick={handleCopyToClipboard}
                    className="w-full sm:w-auto py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Salin Gambar
                  </button>
                  {copySuccess && (
                    <span className="text-[10px] text-emerald-600 font-semibold animate-pulse text-center">
                      {copySuccess}
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                id="btn-close-export-modal-footer"
                onClick={() => setIsExportModalOpen(false)}
                className="py-1.5 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL PREVIEW FOR SAVED ITEM */}
      {selectedSavedSig && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm uppercase tracking-wide">
                  <CheckCircle2 className="w-4.5 h-4.5 text-indigo-600" />
                  Pratinjau Draf Tanda Tangan
                </h4>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">ID: #{selectedSavedSig.id} • Dibuat pada {selectedSavedSig.timestamp}</p>
              </div>
              <button
                id="btn-close-modal"
                onClick={() => setSelectedSavedSig(null)}
                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Area */}
            <div className="p-8 bg-slate-150 flex items-center justify-center">
              <div className="bg-white/90 rounded-2xl border border-slate-200/60 p-6 flex items-center justify-center max-w-full w-full shadow-inner h-64 overflow-hidden relative bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] bg-[size:16px_16px]">
                <img
                  src={selectedSavedSig.pngDataUrl}
                  alt="Expanded signature preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-medium">Format Transparan Siap Unduh</span>
              
              <div className="flex items-center gap-2">
                <button
                  id="btn-modal-dl-png"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = `tanda_tangan_saved_${selectedSavedSig.id}.png`;
                    link.href = selectedSavedSig.pngDataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh PNG
                </button>
                
                <button
                  id="btn-modal-dl-svg"
                  onClick={() => {
                    const blob = new Blob([selectedSavedSig.svgString], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `tanda_tangan_saved_${selectedSavedSig.id}.svg`;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh SVG Vektor
                </button>

                <button
                  id="btn-modal-close"
                  onClick={() => setSelectedSavedSig(null)}
                  className="py-1.5 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
