import React, { useState, useRef, useEffect } from 'react';
import { Upload, Droplet, Palette, RefreshCw, Info, X, Plus, Trash2, Pipette, Save, Check, AlertTriangle } from 'lucide-react';

const App = () => {
  // --- 狀態管理 ---
  const [image, setImage] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [mixingResult, setMixingResult] = useState(null); 
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isPickingPaint, setIsPickingPaint] = useState(false);
  
  const defaultPaints = [
    { id: 'w', name: '鈦白 (Titanium White)', color: '#FFFFFF' },
    { id: 'k', name: '象牙黑 (Ivory Black)', color: '#000000' },
    { id: 'r', name: '鎘紅 (Cadmium Red)', color: '#E30022' },
    { id: 'y', name: '檸檬黃 (Lemon Yellow)', color: '#FFF44F' },
    { id: 'b', name: '群青藍 (Ultramarine)', color: '#120A8F' },
    { id: 'br', name: '熟褐 (Burnt Umber)', color: '#8A3324' },
  ];

  const [myPaints, setMyPaints] = useState(() => {
      const savedPaints = localStorage.getItem('myPaints');
      return savedPaints ? JSON.parse(savedPaints) : defaultPaints;
  });

  const [newPaintColor, setNewPaintColor] = useState('#FF0000');
  const [newPaintName, setNewPaintName] = useState('');

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
      localStorage.setItem('myPaints', JSON.stringify(myPaints));
  }, [myPaints]);

  const standardColors = [
      { color: '#FFFFFF', name: '鈦白' },
      { color: '#000000', name: '象牙黑' },
      { color: '#E30022', name: '鎘紅' },
      { color: '#FFF44F', name: '檸檬黃' },
      { color: '#120A8F', name: '群青藍' },
      { color: '#8A3324', name: '熟褐' },
      { color: '#009900', name: '樹綠' },
      { color: '#FFA500', name: '鎘橙' },
      { color: '#800080', name: '紫羅蘭' },
      { color: '#00FFFF', name: '青色 (Cyan)' },
      { color: '#FF00FF', name: '洋紅 (Magenta)' },
      { color: '#808080', name: '灰色' },
      { color: '#A52A2A', name: '紅棕色' },
      { color: '#FFC0CB', name: '粉紅色' },
      { color: '#4B0082', name: '靛青' }
  ];

  const getColorName = (hex) => {
      if (!hex) return '';
      const match = standardColors.find(c => c.color.toUpperCase() === hex.toUpperCase());
      return match ? match.name : '';
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; 
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: break;
      }
      h /= 6;
    }
    return [h * 360, s * 100, l * 100];
  };

  const colorDistance = (c1, c2) => {
    const rmean = (c1.r + c2.r) / 2;
    const r = c1.r - c2.r;
    const g = c1.g - c2.g;
    const b = c1.b - c2.b;
    return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
  };

  const solveMixing = (targetRgb, availablePaints) => {
    if (availablePaints.length === 0) {
        return { recipe: [], diff: Infinity, mixedColor: '#000000' };
    }

    let bestMix = [];
    let minDistance = Infinity;
    let bestMixedRgb = { r: 0, g: 0, b: 0 }; 

    const palette = availablePaints.map(p => {
        const rgb = hexToRgb(p.color);
        return { ...p, ...rgb };
    });

    const checkAndUpdate = (mix, r, g, b) => {
        const dist = colorDistance(targetRgb, { r, g, b });
        if (dist < minDistance) {
            minDistance = dist;
            bestMix = mix;
            bestMixedRgb = { r, g, b };
        }
    };

    for (let p of palette) {
        checkAndUpdate([{ ...p, percent: 100 }], p.r, p.g, p.b);
    }

    const step = 0.05;
    for (let i = 0; i < palette.length; i++) {
        for (let j = i + 1; j < palette.length; j++) {
            const c1 = palette[i];
            const c2 = palette[j];
            for (let w = step; w < 1; w += step) {
                const r = c1.r * w + c2.r * (1 - w);
                const g = c1.g * w + c2.g * (1 - w);
                const b = c1.b * w + c2.b * (1 - w);
                checkAndUpdate(
                    [{ ...c1, percent: w * 100 }, { ...c2, percent: (1 - w) * 100 }],
                    r, g, b
                );
            }
        }
    }

    if (bestMix.length === 2 && minDistance > 30) { 
        const baseMix = bestMix;
        const modifiers = palette.filter(p => p.name.includes('白') || p.name.includes('黑') || p.name.includes('White') || p.name.includes('Black'));
        const candidates = modifiers.length > 0 ? modifiers : palette;

        for (let m of candidates) {
            if (baseMix.some(bm => bm.id === m.id)) continue;

            const c1 = baseMix[0];
            const c2 = baseMix[1];
            for (let w3 = 0.05; w3 <= 0.5; w3 += 0.05) {
                const remain = 1 - w3;
                const w1 = (c1.percent / 100) * remain;
                const w2 = (c2.percent / 100) * remain;

                const r = c1.r * w1 + c2.r * w2 + m.r * w3;
                const g = c1.g * w1 + c2.g * w2 + m.g * w3;
                const b = c1.b * w1 + c2.b * w2 + m.b * w3;
                
                checkAndUpdate(
                    [{ ...c1, percent: w1 * 100 }, { ...c2, percent: w2 * 100 }, { ...m, percent: w3 * 100 }],
                    r, g, b
                );
            }
        }
    }

    let finalMix = bestMix.filter(p => p.percent > 1);
    const totalPercent = finalMix.reduce((sum, p) => sum + p.percent, 0);
    finalMix = finalMix.map(p => ({
        ...p,
        percent: (p.percent / totalPercent) * 100
    })).sort((a, b) => b.percent - a.percent);

    return {
        recipe: finalMix,
        diff: minDistance,
        mixedColor: rgbToHex(Math.round(bestMixedRgb.r), Math.round(bestMixedRgb.g), Math.round(bestMixedRgb.b))
    };
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        const containerWidth = containerRef.current ? containerRef.current.clientWidth : 800;
        const scale = Math.min(1, containerWidth / img.width);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = image;
    }
  }, [image]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setSelectedColor(null);
        setMixingResult(null);
        setIsPickingPaint(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasInteraction = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

    if (e.type === 'mousemove') {
         setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
         return;
    }

    const ctx = canvas.getContext('2d');
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    if (isPickingPaint) {
        setNewPaintColor(hex);
        const knownName = getColorName(hex);
        if (knownName) { setNewPaintName(knownName); } 
        else if (!newPaintName) { setNewPaintName(hex); }
        setIsPickingPaint(false);
    } else {
        const color = {
            r: pixel[0], g: pixel[1], b: pixel[2],
            hex: hex,
            hsl: rgbToHsl(pixel[0], pixel[1], pixel[2])
        };
        setSelectedColor(color);
        setMixingResult(solveMixing(color, myPaints));
    }
  };

  const handleAddPaint = () => {
    const finalName = newPaintName.trim() || newPaintColor;
    const newPaint = { id: Date.now().toString(), name: finalName, color: newPaintColor };
    setMyPaints([...myPaints, newPaint]);
    setNewPaintName('');
    if (selectedColor) setMixingResult(solveMixing(selectedColor, [...myPaints, newPaint]));
  };

  const handleDeletePaint = (id) => {
    const updatedPaints = myPaints.filter(p => p.id !== id);
    setMyPaints(updatedPaints);
    if (selectedColor) setMixingResult(solveMixing(selectedColor, updatedPaints));
  };

  const getMatchQuality = (diff) => {
      if (diff < 30) return { score: 100 - diff, label: '完美', color: 'text-green-600' };
      if (diff < 60) return { score: 100 - diff, label: '接近', color: 'text-blue-600' };
      if (diff < 100) return { score: 100 - (diff * 0.8), label: '偏差', color: 'text-amber-600' };
      return { score: 0, label: '無法調出', color: 'text-red-600' };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm w-full"> {/* 修改：加入 w-full */}
        <div className="w-full px-6 h-16 flex items-center justify-between"> {/* 修改：移除 max-w-7xl, mx-auto */}
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-lg shadow-blue-200">
              <Palette size={24} />
            </div>
            <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
                數位調色大師
                </h1>
                <p className="text-xs text-slate-400 font-medium">Pro</p>
            </div>
          </div>
          
          <label className="cursor-pointer flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-5 py-2.5 rounded-full transition-all text-sm font-medium shadow-md hover:shadow-lg active:scale-95">
            <Upload size={18} />
            <span>上傳圖片</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
      </header>

      <main className="w-full p-6 gap-6 grid grid-cols-1 lg:grid-cols-12"> {/* 修改：移除 max-w-7xl, mx-auto，改為 w-full */}
        
        {/* 左側：畫布區 */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className={`bg-white rounded-2xl shadow-sm border overflow-hidden relative min-h-[500px] flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] transition-colors ${isPickingPaint ? 'border-amber-400 ring-4 ring-amber-100 cursor-copy' : 'border-slate-200'}`}
          >
            {!image ? (
              <div className="text-center p-10 text-slate-400 flex flex-col items-center">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <Upload size={40} className="text-slate-300" />
                </div>
                <p className="text-xl font-medium text-slate-600">上傳您的參考圖片</p>
                <p className="text-sm mt-2 text-slate-400">系統將分析如何使用「您的顏料」調出色彩</p>
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasInteraction}
                  onMouseMove={handleCanvasInteraction}
                  className={`max-w-full touch-none ${isPickingPaint ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                  style={{ imageRendering: 'pixelated' }}
                />
                
                {image && !selectedColor && (
                    <div 
                        className="fixed pointer-events-none w-24 h-24 rounded-full border-4 border-white shadow-xl z-50 overflow-hidden bg-white flex items-center justify-center"
                        style={{ 
                            left: cursorPos.x + 20 + (containerRef.current?.getBoundingClientRect().left || 0), 
                            top: cursorPos.y + 20 + (containerRef.current?.getBoundingClientRect().top || 0),
                            display: (cursorPos.x === 0 && cursorPos.y === 0) ? 'none' : 'flex'
                        }}
                    >
                         <Plus className="text-slate-400 opacity-50" size={16} />
                    </div>
                )}

                {selectedColor && !isPickingPaint && (
                   <div 
                     className="absolute w-8 h-8 rounded-full border-4 border-white shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-1/2 ring-2 ring-black/20 animate-bounce-short"
                     style={{ 
                        left: cursorPos.x + (containerRef.current?.getBoundingClientRect().left || 0), 
                        top: cursorPos.y + (containerRef.current?.getBoundingClientRect().top || 0),
                        backgroundColor: selectedColor.hex
                     }}
                   />
                )}
              </>
            )}
            
            {image && isPickingPaint && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-amber-500 text-white px-4 py-2 rounded-full shadow-lg font-bold flex items-center gap-2 animate-bounce">
                    <Pipette size={18} />
                    請點擊圖片吸取顏料顏色
                </div>
            )}
          </div>

          {/* 分析結果橫幅 */}
          {selectedColor && mixingResult && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col justify-center gap-4">
                    <div className="flex items-center justify-between">
                         <h3 className="text-lg font-bold text-slate-800">色彩比對</h3>
                         {(() => {
                            const quality = getMatchQuality(mixingResult.diff);
                            return (
                                <span className={`text-sm font-bold px-3 py-1 rounded-full bg-slate-100 ${quality.color}`}>
                                    {quality.label} ({Math.max(0, Math.round(quality.score))}%)
                                </span>
                            );
                         })()}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <div 
                                className="w-20 h-20 rounded-2xl shadow-inner ring-2 ring-slate-100 border border-slate-200 mb-2"
                                style={{ backgroundColor: selectedColor.hex }}
                            ></div>
                            <span className="text-xs font-bold text-slate-500">目標</span>
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center">
                            <span className="text-xs text-slate-400 mb-1">差異 Δ {Math.round(mixingResult.diff)}</span>
                            <div className="w-full h-1 bg-gradient-to-r from-slate-200 via-slate-400 to-slate-200 rounded-full"></div>
                        </div>

                        <div className="text-center">
                            <div 
                                className="w-20 h-20 rounded-2xl shadow-inner ring-2 ring-slate-100 border border-slate-200 mb-2 relative"
                                style={{ backgroundColor: mixingResult.mixedColor }}
                            >
                                {mixingResult.diff > 200 && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                                        <X className="text-white drop-shadow-md" size={32} />
                                    </div>
                                )}
                            </div>
                            <span className="text-xs font-bold text-slate-500">模擬結果</span>
                        </div>
                    </div>
                </div>

                <div className="border-l border-slate-100 pl-6 md:pl-6 pt-6 md:pt-0 border-t md:border-t-0 flex flex-col justify-center">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Palette size={16}/> 推薦調色配方
                    </h3>
                    
                    {mixingResult.diff > 200 ? (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-700 text-sm">
                            <div className="flex items-start gap-2 mb-2">
                                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                <strong>無法調出此顏色</strong>
                            </div>
                            <p className="mb-2">您的顏料庫缺少必要的色系，目前最接近的顏色差異過大。</p>
                            <div className="text-xs bg-white/50 p-2 rounded text-red-600 font-mono">
                                建議增加：紅色、黃色 或 其他鮮豔色系
                            </div>
                        </div>
                    ) : (
                        mixingResult.recipe.length > 0 ? (
                            <div className="space-y-3">
                                {mixingResult.recipe.map((p, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-12 text-right font-bold text-slate-700">{Math.round(p.percent)}%</div>
                                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full rounded-full"
                                                style={{ width: `${p.percent}%`, backgroundColor: p.color }}
                                            ></div>
                                        </div>
                                        <div className="text-sm font-medium text-slate-600 w-24 truncate">{p.name}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-400 text-sm italic">沒有足夠的顏料進行計算</div>
                        )
                    )}
                </div>
            </div>
          )}
        </div>

        {/* 右側：顏料管理區 */}
        <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Plus className="text-blue-500" size={20} />
                    新增我的顏料
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block">顏料名稱</label>
                        <input 
                            type="text" 
                            value={newPaintName}
                            onChange={(e) => setNewPaintName(e.target.value)}
                            placeholder="例如：群青藍、檸檬黃 (或直接留空)"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-slate-500 mb-2 block">顏料顏色</label>
                         <div className="flex gap-2 mb-3">
                             <div className="flex-1 flex items-center gap-2 border border-slate-200 p-1.5 rounded-lg bg-slate-50">
                                <input 
                                    type="color" 
                                    value={newPaintColor}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setNewPaintColor(val);
                                        const knownName = getColorName(val);
                                        if(knownName) setNewPaintName(knownName);
                                    }}
                                    className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                                    title="點擊開啟調色盤"
                                />
                                <span className="text-xs text-slate-500 font-mono flex-1 text-center">{newPaintColor}</span>
                             </div>

                             <button 
                                onClick={() => {
                                    if(!image) {
                                        alert("請先上傳包含顏料照片的圖片");
                                        return;
                                    }
                                    setIsPickingPaint(!isPickingPaint);
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isPickingPaint ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                             >
                                <Pipette size={16} />
                                吸取
                             </button>
                         </div>
                         <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">快速選擇標準色</span>
                            <div className="flex gap-1.5 flex-wrap">
                                {standardColors.map(c => (
                                    <button
                                        key={c.color}
                                        onClick={() => {
                                            setNewPaintColor(c.color);
                                            setNewPaintName(c.name);
                                        }}
                                        className="w-6 h-6 rounded-full border border-slate-200 shadow-sm hover:scale-110 transition-transform ring-1 ring-black/5"
                                        style={{ backgroundColor: c.color }}
                                        title={`${c.name} (${c.color})`}
                                    />
                                ))}
                            </div>
                         </div>
                    </div>
                    <button 
                        onClick={handleAddPaint}
                        className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2"
                    >
                        <Plus size={16}/>
                        加入顏料庫
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h2 className="font-bold text-slate-700 flex items-center gap-2">
                        <RefreshCw className="text-green-500" size={18} />
                        我的顏料庫 ({myPaints.length})
                    </h2>
                    <button 
                        onClick={() => {
                            if(confirm("確定要重置回預設顏料嗎？")) {
                                setMyPaints(defaultPaints);
                            }
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                    >
                        重置預設
                    </button>
                </div>
                <div className="overflow-y-auto flex-1 p-3 space-y-2 max-h-[500px]">
                    {myPaints.map((paint) => (
                        <div 
                            key={paint.id} 
                            className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                            style={{ 
                                backgroundColor: `${paint.color}08`, 
                                borderColor: `${paint.color}20`      
                            }}
                        >
                            <div 
                                className="w-12 h-12 rounded-full shadow-inner ring-2 ring-white border border-slate-200 shrink-0"
                                style={{ backgroundColor: paint.color }}
                            ></div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-700 truncate">{paint.name}</div>
                                <div className="text-xs text-slate-400 font-mono uppercase tracking-wider">{paint.color}</div>
                            </div>
                            <button 
                                onClick={() => handleDeletePaint(paint.id)}
                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="刪除"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                    {myPaints.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            <Palette className="mx-auto mb-2 opacity-20" size={32} />
                            顏料庫是空的
                        </div>
                    )}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
};

export default App;