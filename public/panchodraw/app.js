/**
 * VUELAPELUCAS 3000 - Estudio de Dibujo y Animación Temblorosa
 * Edición Windows 95 con resolución retro de 256 x 256 píxeles
 * Algoritmo Bresenham para trazos continuos, línea temblorosa y exportación vecino más cercano
 * Sintaxis ES3/ES5 compatible con navegadores de 2005 y modernos.
 */

(function () {
  'use strict';

  // --- PALETA OFICIAL VUELAPELUCAS 3000 (12 COLORES) ---
  var OFFICIAL_PALETTE = [
    '#ffffff',
    '#000000',
    '#ffd62c',
    '#ef4720',
    '#0e75fe',
    '#f5abd0',
    '#6cfeb3',
    '#229cff',
    '#9c51f2',
    '#04ba63',
    '#c2612c',
    '#ffab00'
  ];

  // --- ESTADO GLOBAL ---
  var state = {
    canvasWidth: 256,
    canvasHeight: 256,
    currentTool: 'pencil',
    color1: '#000000', // Primario
    color2: '#ffffff', // Secundario
    lineWidth: 2,      // Grosor para líneas y lápiz en 256x256
    brushShape: 'circle', // circle, square, slash, backslash
    brushSize: 4,
    eraserSize: 8,
    shapeFillMode: 'stroke', // stroke, both, fill
    zoom: 2,           // 1 = 256px, 2 = 512px, 4 = 1024px
    showGrid: false,
    isAnimated: true,
    fps: 8,
    loopFrames: 4,
    currentFrame: 0,
    isDrawing: false,
    activeMouseButton: 0,
    lastMouseX: null,
    lastMouseY: null,
    wiggleIntensity: 2.0,
    strokes: [],
    redoStack: [],
    backgroundColor: '#ffffff',
    currentStroke: null
  };

  // --- OBTENCIÓN DE ELEMENTOS DEL DOM ---
  var canvas = document.getElementById('paintCanvas');
  var ctx = canvas.getContext('2d');
  if (ctx.imageSmoothingEnabled !== undefined) {
    ctx.imageSmoothingEnabled = false;
  }

  var canvasFrame = document.getElementById('canvasFrame');
  var statusText = document.getElementById('statusText');
  var statusCoords = document.getElementById('statusCoords');
  var statusDim = document.getElementById('statusDim');
  var statusFps = document.getElementById('statusFps');
  var sampleColor1 = document.getElementById('sampleColor1');
  var sampleColor2 = document.getElementById('sampleColor2');
  var selWiggleIntensity = document.getElementById('selWiggleIntensity');

  // Paneles de opciones
  var optLines = document.getElementById('optLines');
  var optBrush = document.getElementById('optBrush');
  var optEraser = document.getElementById('optEraser');
  var optShapes = document.getElementById('optShapes');
  var optMagnifier = document.getElementById('optMagnifier');

  // Canvas auxiliar para raster de fondo (bote de pintura, imágenes)
  var bgCanvas = document.createElement('canvas');
  bgCanvas.width = state.canvasWidth;
  bgCanvas.height = state.canvasHeight;
  var bgCtx = bgCanvas.getContext('2d');
  if (bgCtx.imageSmoothingEnabled !== undefined) {
    bgCtx.imageSmoothingEnabled = false;
  }
  bgCtx.fillStyle = state.backgroundColor;
  bgCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

  // --- ALGORITMO BRESENHAM PARA TRAZOS SIN HUECOS ---
  function getBresenhamPoints(x0, y0, x1, y1) {
    var points = [];
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1;
    var sy = (y0 < y1) ? 1 : -1;
    var err = dx - dy;

    var curX = x0;
    var curY = y0;

    while (true) {
      points.push({ x: curX, y: curY });
      if (curX === x1 && curY === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        curX += sx;
      }
      if (e2 < dx) {
        err += dx;
        curY += sy;
      }
    }
    return points;
  }

  // --- TABLAS DE SENO/COSENO PRECALCULADAS (OPTIMIZACIÓN PARA MOTORES RETRO DE 2005) ---
  var TABLE_MASK = 511;
  var TWO_PI = Math.PI * 2;
  var SINTABLE = new Array(TABLE_MASK + 1);
  for (var si = 0; si <= TABLE_MASK; si++) {
    SINTABLE[si] = Math.sin((si / (TABLE_MASK + 1)) * TWO_PI);
  }
  function fastSin(val) {
    var pos = Math.floor((val / TWO_PI) * (TABLE_MASK + 1)) & TABLE_MASK;
    return SINTABLE[pos];
  }
  function fastCos(val) {
    var pos = Math.floor((val / TWO_PI + 0.25) * (TABLE_MASK + 1)) & TABLE_MASK;
    return SINTABLE[pos];
  }

  // --- MOTOR DE TEMBLOR (LÍNEA TEMBLOROSA) ---
  function getWiggleOffset(index, frame, seed, intensity) {
    if (intensity <= 0) return 0;
    var frameAngle = (frame / state.loopFrames) * TWO_PI;
    var wave1 = fastSin(index * 0.8 + frameAngle + seed * 6.28);
    var wave2 = fastCos(index * 1.5 + frameAngle * 2 + seed * 3.14);
    var mag = (wave1 * 0.7 + wave2 * 0.3) * intensity;
    return mag;
  }

  function computeWigglyPoints(points, frame, seed, intensity) {
    if (intensity <= 0 || points.length <= 1) return points;
    var len = points.length;
    var result = new Array(len);

    for (var i = 0; i < len; i++) {
      var p = points[i];
      var nx = 0;
      var ny = 1;

      if (len > 1) {
        var pPrev = points[Math.max(0, i - 1)];
        var pNext = points[Math.min(len - 1, i + 1)];
        var dx = pNext.x - pPrev.x;
        var dy = pNext.y - pPrev.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.0001) {
          nx = -dy / dist;
          ny = dx / dist;
        }
      }

      var offsetMag = getWiggleOffset(i, frame, seed, intensity);
      result[i] = {
        x: Math.round(p.x + nx * offsetMag),
        y: Math.round(p.y + ny * offsetMag)
      };
    }
    return result;
  }

  function subdivideLine(x1, y1, x2, y2, step) {
    step = step || 4;
    var dx = x2 - x1;
    var dy = y2 - y1;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(2, Math.ceil(dist / step));
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      pts.push({
        x: Math.round(x1 + dx * t),
        y: Math.round(y1 + dy * t)
      });
    }
    return pts;
  }

  function subdivideRect(x1, y1, x2, y2, step) {
    step = step || 4;
    var minX = Math.min(x1, x2);
    var maxX = Math.max(x1, x2);
    var minY = Math.min(y1, y2);
    var maxY = Math.max(y1, y2);
    var top = subdivideLine(minX, minY, maxX, minY, step);
    var right = subdivideLine(maxX, minY, maxX, maxY, step);
    var bottom = subdivideLine(maxX, maxY, minX, maxY, step);
    var left = subdivideLine(minX, maxY, minX, minY, step);
    return top.concat(right.slice(1), bottom.slice(1), left.slice(1));
  }

  function subdivideEllipse(x1, y1, x2, y2, count) {
    count = count || 28;
    var rx = Math.abs(x2 - x1) / 2;
    var ry = Math.abs(y2 - y1) / 2;
    var cx = Math.min(x1, x2) + rx;
    var cy = Math.min(y1, y2) + ry;
    var pts = [];
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2;
      pts.push({
        x: Math.round(cx + Math.cos(a) * rx),
        y: Math.round(cy + Math.sin(a) * ry)
      });
    }
    return pts;
  }

  // --- RENDERIZADO DE PIXEL ART SÓLIDO (VECINO MÁS CERCANO - CERO TRANSPARENCIA) ---
  function drawSolidPixelDot(targetCtx, x, y, size, shape) {
    size = Math.max(1, Math.floor(size || 1));
    var half = Math.floor(size / 2);
    var px = Math.floor(x);
    var py = Math.floor(y);

    if (shape === 'slash') {
      for (var d = 0; d < size; d++) {
        targetCtx.fillRect(px - half + d, py + half - d, 1, 1);
      }
    } else if (shape === 'backslash') {
      for (var b = 0; b < size; b++) {
        targetCtx.fillRect(px - half + b, py - half + b, 1, 1);
      }
    } else if (shape === 'circle' && size >= 4) {
      for (var cy = -half; cy <= half; cy++) {
        for (var cx = -half; cx <= half; cx++) {
          if (cx * cx + cy * cy <= (half * half) + 0.5) {
            targetCtx.fillRect(px + cx, py + cy, 1, 1);
          }
        }
      }
    } else {
      // Píxeles cuadrados estándar (Lápiz, Goma, Pincel cuadrado)
      targetCtx.fillRect(px - half, py - half, size, size);
    }
  }

  function drawSolidPixelLine(targetCtx, x0, y0, x1, y1, size, shape) {
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);

    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = (x0 < x1) ? 1 : -1;
    var sy = (y0 < y1) ? 1 : -1;
    var err = dx - dy;

    var curX = x0;
    var curY = y0;

    while (true) {
      drawSolidPixelDot(targetCtx, curX, curY, size, shape);
      if (curX === x1 && curY === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        curX += sx;
      }
      if (e2 < dx) {
        err += dx;
        curY += sy;
      }
    }
  }

  // --- RENDERIZADOR DE TEXTO BITMAP SÓLIDO (CERO TRANSPARENCIA Y MÁXIMA LEGIBILIDAD) ---
  var textScratchCanvas = document.createElement('canvas');
  textScratchCanvas.width = 512;
  textScratchCanvas.height = 128;
  var textScratchCtx = textScratchCanvas.getContext('2d');
  if (textScratchCtx.imageSmoothingEnabled !== undefined) {
    textScratchCtx.imageSmoothingEnabled = false;
  }

  function getSolidTextBitmap(text, fontFamily, fontSize, letterSpacing) {
    if (letterSpacing === undefined) letterSpacing = 3;
    var maxW = 512;
    var maxH = 128;
    var chars = text.split('');
    var charBitmaps = [];
    var totalW = 0;
    var maxCharH = Math.ceil(fontSize * 1.6) + 4;

    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === ' ') {
        var spaceW = Math.max(5, Math.floor(fontSize * 0.5));
        charBitmaps.push({ isSpace: true, width: spaceW });
        totalW += spaceW;
        continue;
      }

      textScratchCtx.clearRect(0, 0, 128, 128);
      textScratchCtx.font = "bold " + fontSize + "px " + fontFamily;
      textScratchCtx.textBaseline = "top";
      textScratchCtx.fillStyle = "#ffffff";
      textScratchCtx.fillText(ch, 2, 2);

      var m = textScratchCtx.measureText(ch);
      var testW = Math.max(12, Math.ceil(m.width) + 8);
      var testH = maxCharH;

      var img = textScratchCtx.getImageData(0, 0, testW, testH);
      var id = img.data;

      var minX = testW, maxX = -1, minY = testH, maxY = -1;
      for (var y = 0; y < testH; y++) {
        for (var x = 0; x < testW; x++) {
          var a = id[(y * testW + x) * 4 + 3];
          if (a >= 75) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (maxX >= minX) {
        var cw = maxX - minX + 1;
        var chH = maxY - minY + 1;
        var cmask = [];
        for (var cy = 0; cy < chH; cy++) {
          var crow = [];
          for (var cx = 0; cx < cw; cx++) {
            var val = id[((minY + cy) * testW + (minX + cx)) * 4 + 3];
            crow.push(val >= 75 ? 1 : 0);
          }
          cmask.push(crow);
        }
        charBitmaps.push({
          isSpace: false,
          width: cw,
          height: chH,
          topOffset: minY - 2,
          mask: cmask
        });
        totalW += cw + letterSpacing;
      } else {
        charBitmaps.push({ isSpace: true, width: 4 });
        totalW += 4;
      }
    }

    var finalW = Math.min(maxW, totalW + 8);
    var finalH = Math.min(maxH, maxCharH);
    var fullMask = [];
    for (var fy = 0; fy < finalH; fy++) {
      var frow = new Array(finalW);
      for (var fx = 0; fx < finalW; fx++) frow[fx] = 0;
      fullMask.push(frow);
    }

    var curX = 2;
    for (var cb = 0; cb < charBitmaps.length; cb++) {
      var item = charBitmaps[cb];
      if (item.isSpace) {
        curX += item.width;
      } else {
        var cm = item.mask;
        var tOff = Math.max(0, item.topOffset);
        for (var my = 0; my < item.height; my++) {
          var destY = tOff + my;
          if (destY < finalH) {
            for (var mx = 0; mx < item.width; mx++) {
              var destX = curX + mx;
              if (destX < finalW && cm[my][mx]) {
                fullMask[destY][destX] = 1;
              }
            }
          }
        }
        curX += item.width + letterSpacing;
      }
    }

    return { width: finalW, height: finalH, mask: fullMask };
  }

  function getCachedTextCanvas(stroke) {
    var sp = (stroke.letterSpacing !== undefined) ? stroke.letterSpacing : 3;
    var withOutline = (stroke.withOutline !== false);
    var cacheKey = stroke.text + '|' + stroke.fontFamily + '|' + stroke.fontSize + '|' + sp + '|' + stroke.color + '|' + withOutline;
    if (stroke._cachedCanvasKey === cacheKey && stroke._cachedCanvas) {
      return stroke._cachedCanvas;
    }

    var bm = getSolidTextBitmap(stroke.text, stroke.fontFamily, stroke.fontSize, sp);
    var w = bm.width;
    var h = bm.height;
    var mask = bm.mask;

    var c = document.createElement('canvas');
    c.width = w + 4;
    c.height = h + 4;
    var cCtx = c.getContext('2d');
    if (cCtx.imageSmoothingEnabled !== undefined) cCtx.imageSmoothingEnabled = false;

    // 1. Contorno sólido negro de 1 píxel
    if (withOutline) {
      cCtx.fillStyle = "#000000";
      for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
          if (mask[y][x]) {
            cCtx.fillRect(x - 1, y, 1, 1);
            cCtx.fillRect(x + 1, y, 1, 1);
            cCtx.fillRect(x, y - 1, 1, 1);
            cCtx.fillRect(x, y + 1, 1, 1);
          }
        }
      }
    }

    // 2. Relleno de texto con el color seleccionado
    cCtx.fillStyle = stroke.color;
    for (var my = 0; my < h; my++) {
      for (var mx = 0; mx < w; mx++) {
        if (mask[my][mx]) {
          cCtx.fillRect(mx, my, 1, 1);
        }
      }
    }

    stroke._cachedCanvas = c;
    stroke._cachedCanvasKey = cacheKey;
    return c;
  }

  function drawSolidPixelText(targetCtx, stroke, frameIndex, intensity) {
    var offX = Math.round(getWiggleOffset(0, frameIndex, stroke.seed, intensity));
    var offY = Math.round(getWiggleOffset(1, frameIndex, stroke.seed + 1, intensity));
    var posX = stroke.x + offX;
    var posY = stroke.y + offY;

    var txtCanvas = getCachedTextCanvas(stroke);
    targetCtx.drawImage(txtCanvas, posX - 2, posY - 2);
  }

  // --- RENDERIZADO DE TRAZOS EN CANVAS ---
  function renderStroke(targetCtx, stroke, frameIndex) {
    targetCtx.save();
    targetCtx.fillStyle = stroke.color;
    targetCtx.strokeStyle = stroke.color;

    var intensity = (stroke.wiggleIntensity !== undefined) ? stroke.wiggleIntensity : state.wiggleIntensity;

    if (stroke.type === 'pencil' || stroke.type === 'brush' || stroke.type === 'eraser') {
      var pts = computeWigglyPoints(stroke.points, frameIndex, stroke.seed, intensity);
      var shape = (stroke.type === 'pencil' || stroke.type === 'eraser') ? 'square' : (stroke.brushShape || 'circle');
      var sz = stroke.size || 1;

      if (pts.length === 1) {
        drawSolidPixelDot(targetCtx, pts[0].x, pts[0].y, sz, shape);
      } else {
        for (var i = 0; i < pts.length - 1; i++) {
          drawSolidPixelLine(targetCtx, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, sz, shape);
        }
      }
    } else if (stroke.type === 'line') {
      var lPts = subdivideLine(stroke.x1, stroke.y1, stroke.x2, stroke.y2);
      var wLine = computeWigglyPoints(lPts, frameIndex, stroke.seed, intensity);
      for (var l = 0; l < wLine.length - 1; l++) {
        drawSolidPixelLine(targetCtx, wLine[l].x, wLine[l].y, wLine[l + 1].x, wLine[l + 1].y, stroke.size || 1, 'square');
      }
    } else if (stroke.type === 'curve') {
      var cx = stroke.cx !== undefined ? stroke.cx : (stroke.x1 + stroke.x2) / 2;
      var cy = stroke.cy !== undefined ? stroke.cy : stroke.y1 - 20;
      var cPts = [];
      for (var t = 0; t <= 16; t++) {
        var ratio = t / 16;
        var inv = 1 - ratio;
        cPts.push({
          x: Math.round(inv * inv * stroke.x1 + 2 * inv * ratio * cx + ratio * ratio * stroke.x2),
          y: Math.round(inv * inv * stroke.y1 + 2 * inv * ratio * cy + ratio * ratio * stroke.y2)
        });
      }
      var wCurve = computeWigglyPoints(cPts, frameIndex, stroke.seed, intensity);
      for (var c = 0; c < wCurve.length - 1; c++) {
        drawSolidPixelLine(targetCtx, wCurve[c].x, wCurve[c].y, wCurve[c + 1].x, wCurve[c + 1].y, stroke.size || 1, 'square');
      }
    } else if (stroke.type === 'rect' || stroke.type === 'roundrect') {
      var rPts = subdivideRect(stroke.x1, stroke.y1, stroke.x2, stroke.y2);
      var wRect = computeWigglyPoints(rPts, frameIndex, stroke.seed, intensity);

      if (stroke.fillMode === 'fill' || stroke.fillMode === 'both') {
        targetCtx.beginPath();
        targetCtx.moveTo(wRect[0].x, wRect[0].y);
        for (var r1 = 1; r1 < wRect.length; r1++) targetCtx.lineTo(wRect[r1].x, wRect[r1].y);
        targetCtx.closePath();
        targetCtx.fillStyle = stroke.fillColor || stroke.color;
        targetCtx.fill();
      }
      if (stroke.fillMode === 'stroke' || stroke.fillMode === 'both') {
        for (var r2 = 0; r2 < wRect.length; r2++) {
          var nextR = (r2 + 1) % wRect.length;
          drawSolidPixelLine(targetCtx, wRect[r2].x, wRect[r2].y, wRect[nextR].x, wRect[nextR].y, stroke.size || 1, 'square');
        }
      }
    } else if (stroke.type === 'ellipse') {
      var ePts = subdivideEllipse(stroke.x1, stroke.y1, stroke.x2, stroke.y2);
      var wEllipse = computeWigglyPoints(ePts, frameIndex, stroke.seed, intensity);

      if (stroke.fillMode === 'fill' || stroke.fillMode === 'both') {
        targetCtx.beginPath();
        targetCtx.moveTo(wEllipse[0].x, wEllipse[0].y);
        for (var e1 = 1; e1 < wEllipse.length; e1++) targetCtx.lineTo(wEllipse[e1].x, wEllipse[e1].y);
        targetCtx.closePath();
        targetCtx.fillStyle = stroke.fillColor || stroke.color;
        targetCtx.fill();
      }
      if (stroke.fillMode === 'stroke' || stroke.fillMode === 'both') {
        for (var e2 = 0; e2 < wEllipse.length; e2++) {
          var nextE = (e2 + 1) % wEllipse.length;
          drawSolidPixelLine(targetCtx, wEllipse[e2].x, wEllipse[e2].y, wEllipse[nextE].x, wEllipse[nextE].y, stroke.size || 1, 'square');
        }
      }
    } else if (stroke.type === 'airbrush') {
      var particles = stroke.particles;
      for (var a = 0; a < particles.length; a++) {
        var pt = particles[a];
        var off = getWiggleOffset(a, frameIndex, stroke.seed + a, intensity * 0.6);
        targetCtx.fillRect(Math.round(pt.x + off), Math.round(pt.y + off), 1, 1);
      }
    } else if (stroke.type === 'text') {
      drawSolidPixelText(targetCtx, stroke, frameIndex, intensity);
    } else if (stroke.type === 'stamp') {
      renderStamp(targetCtx, stroke, frameIndex, intensity);
    }

    targetCtx.restore();
  }

  // --- SELLOS PIXEL ART VUELAPELUCAS 3000 (10 DISEÑOS ORIGINALES, 100% SÓLIDOS) ---
  var STAMP_COLOR_MAP = {
    'k': '#000000',
    'w': '#ffffff',
    'r': '#ef4720',
    'y': '#ffd62c',
    'g': '#04ba63',
    'b': '#0e75fe',
    'p': '#f5abd0',
    'o': '#c2612c',
    'n': '#9c51f2',
    'a': '#ffab00'
  };

  var VUELA_STAMPS = {
    calden: [
      "................",
      "....k...........",
      "...kk.....k.....",
      "...kk....kk.....",
      "..kkkk..kkk.....",
      "..kkkkkkkkk.....",
      "...kkkkkkkk.....",
      "....kkkkkkk.....",
      "...kkkkkkk......",
      "......kk........",
      "......kk........",
      "......kk........",
      ".....kkkkk......",
      "....kkkkkkk.....",
      "................",
      "................"
    ],
    caballo: [
      "................",
      "...kk......kk...",
      "..kwwk....kwwk..",
      "..kwwkkkkkkwwk..",
      "..kwwwwwwwwwwk..",
      "...kwwwwwwwwk...",
      "....kwwwwwwk....",
      "....kwwwwwwk....",
      "..kkkwwwwwkkkk..",
      ".kwwwk...kwwwk..",
      ".kwwk.....kwwk..",
      ".kwwk.....kwwk..",
      ".kkkk.....kkkk..",
      "................",
      "................",
      "................"
    ],
    carpa: [
      "..........k.....",
      "......k..kak....",
      ".....ka.kaaak...",
      "....kaa.kaaaak..",
      "...kaaa..kaaaak.",
      "..kaaaakkaaaak..",
      ".kaaaaaaaaaak...",
      "kaaaaaaaaaakk...",
      ".kaaaaaaaaaak...",
      "..kaaaaaaak.....",
      "...kaaaaak......",
      "....kaaak.......",
      ".....kaak.......",
      "......kk........",
      "................",
      "................"
    ],
    carafeliz: [
      "....kkkkkkkk....",
      "..kkyyyyyyyyyykk",
      ".kyyyyyyyyyyyyyyk",
      "kyykkyyyyyyyykkyyk",
      "kyykyyyyyyyykyyk",
      "kyyyyyyyyyyyyyyk",
      "kyyyyyyyyyyyyyyk",
      "kyykyyyyyyyykyyk",
      "kyyykyyyyyykyyyк",
      ".kyyykyyyyykyyk.",
      "..kyyyykkkyyyyk.",
      "...kyyyyyyyyyyk.",
      "....kkyyyyyykk..",
      "......kkkkkk....",
      "................",
      "................"
    ],
    corchea: [
      "......kkkkkkk...",
      ".....kaaaaaaaak.",
      ".....kaaaaaaaak.",
      "......kkkkkkkk..",
      "..........kak...",
      ".........kaaak..",
      ".........kaaak..",
      ".........kaaak..",
      ".........kaaak..",
      ".........kaaak..",
      ".........kaaak..",
      "....kk...kaaak..",
      "...kaak..kaaak..",
      "...kaakkkaaaak..",
      "...kaaaaaaaak...",
      "....kkkkkkkk...."
    ],
    lapiz: [
      "..............kk",
      ".............kwk",
      "............kwwk",
      "...........kwwwk",
      "..........kwwwwk",
      ".........kwwwwwk",
      "........kwwwwwwk",
      ".......kwwwwwwwk",
      "......kwwwwwwwwk",
      ".....kwwwwwwwwwk",
      "....kwwwwwwwwwwk",
      "...kwwwwwwwwwwwk",
      "..krrrrrrrrrrrk.",
      "..krrrrrrrrrrrk.",
      "...krrrrrrrrrrk.",
      "....kkkkkkkkkkk."
    ],
    flor: [
      "....kpppppppk...",
      "...kpppppppppk..",
      "...kpppppppppk..",
      "....kpppppppk...",
      "...k.kpppppk.k..",
      "..kpp.kpppk.ppk.",
      ".kpppp.kpk.ppppk",
      ".kppppp.k.pppppk",
      ".kpppppkgkpppppk",
      ".kpppk.kgk.kpppk",
      "..kpk..kgk..kpk.",
      "...k...kgk...k..",
      ".......kgk......",
      ".......kgk......",
      ".......kgk......",
      ".......kkk......"
    ],
    estallido: [
      "...k.....k...k..",
      "....k..kk.k.k...",
      "..k..kayyk......",
      "...kkayyyyyyk...",
      "k.kkayyyyyyyyk..",
      ".kkayyyyyyyyyyyk",
      ".kayyyyyyyyyyyyk",
      "kkayyyyyyyyyyyyk",
      ".kayyyyyyyyyyyyk",
      ".kayyyyyyyyyyk..",
      "..kkayyyyyyyyk..",
      "....kkayyyakk...",
      "...k.kayyk..k...",
      "..k...kkk...k...",
      ".k...........kk.",
      "..............k."
    ],
    nave: [
      "......kkkk......",
      ".....kbbbk......",
      "....kbbbbbk.....",
      "....kbbbbbk.....",
      "....kbbbbbk.....",
      "...kkkbbbkkk....",
      "..kwwwwbwwwwk...",
      ".kwwwwwbwwwwwk..",
      "kwwwwwwbwwwwwwk.",
      ".kkkkkkbkkkkkk..",
      "...k...b...k....",
      "..krk..b..krk...",
      ".krrk.kbk.krrk..",
      "..kk..kbk..kk...",
      "......kbk.......",
      ".......k........"
    ],
    avion: [
      "................",
      "..........k.....",
      ".........kbk....",
      "........kbbbk...",
      ".......kbbbbbk..",
      "......kbbbbbbbk.",
      "kkkkkkkbbbbbbbbb",
      "kwwwwwwwwwwwwwwk",
      "kkkkkkkbbbbbbbbb",
      "......kbbbbbbbk.",
      ".......kbbbbbk..",
      "........kbbbk...",
      ".........kbk....",
      "..........k.....",
      "................",
      "................"
    ]
  };


  function renderStamp(targetCtx, stroke, frameIndex, intensity) {
    var sName = stroke.stampName || 'calden';
    var sprite = VUELA_STAMPS[sName] || VUELA_STAMPS['calden'];
    var offX = Math.round(getWiggleOffset(0, frameIndex, stroke.seed, intensity));
    var offY = Math.round(getWiggleOffset(1, frameIndex, stroke.seed + 1, intensity));
    var s = Math.max(1, Math.round(stroke.scale || 1));
    var startX = stroke.x + offX - Math.floor((16 * s) / 2);
    var startY = stroke.y + offY - Math.floor((16 * s) / 2);

    for (var r = 0; r < 16; r++) {
      var row = sprite[r];
      for (var c = 0; c < 16; c++) {
        var ch = row.charAt(c);
        if (ch !== '.') {
          targetCtx.fillStyle = STAMP_COLOR_MAP[ch] || '#000000';
          targetCtx.fillRect(startX + c * s, startY + r * s, s, s);
        }
      }
    }
  }


  // --- BÚFER DE PRE-RENDERIZADO PARA MÁXIMO RENDIMIENTO (OPTIMIZADO PARA PCS DE 2005) ---
  var cacheCanvases = [];
  var cacheCtxs = [];
  for (var f = 0; f < 4; f++) {
    var cc = document.createElement('canvas');
    cc.width = state.canvasWidth;
    cc.height = state.canvasHeight;
    var cctx = cc.getContext('2d');
    if (cctx.imageSmoothingEnabled !== undefined) cctx.imageSmoothingEnabled = false;
    cacheCanvases.push(cc);
    cacheCtxs.push(cctx);
  }
  var cacheValid = false;

  function invalidateCache() {
    cacheValid = false;
  }

  function rebuildCache() {
    for (var f = 0; f < state.loopFrames; f++) {
      var tCtx = cacheCtxs[f];
      tCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
      tCtx.drawImage(bgCanvas, 0, 0);

      for (var i = 0; i < state.strokes.length; i++) {
        renderStroke(tCtx, state.strokes[i], f);
      }
    }
    cacheValid = true;
  }

  function renderFrame(targetCtx, frameIndex) {
    if (!cacheValid) {
      rebuildCache();
    }

    targetCtx.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    targetCtx.drawImage(cacheCanvases[frameIndex], 0, 0);

    if (state.currentStroke) {
      renderStroke(targetCtx, state.currentStroke, frameIndex);
    }
  }

  // --- BUCLE DE ANIMACIÓN DE TEMBLOR (8 FPS / CONFIGURABLE) ---
  var lastTick = 0;
  function tick(timestamp) {
    timestamp = timestamp || (new Date().getTime());
    if (state.isAnimated) {
      var interval = 1000 / state.fps;
      if (!lastTick || timestamp - lastTick >= interval) {
        state.currentFrame = (state.currentFrame + 1) % state.loopFrames;
        lastTick = timestamp;
        renderFrame(ctx, state.currentFrame);
      }
    }
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(tick);
    } else {
      setTimeout(function () { tick(new Date().getTime()); }, Math.max(16, Math.floor(1000 / state.fps)));
    }
  }
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(tick);
  } else {
    setTimeout(function () { tick(new Date().getTime()); }, 100);
  }

  // --- RELLENO CON BOTE DE PINTURA (FLOOD FILL) ---
  function hexToRgba(hex) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var num = parseInt(c, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
  }

  function floodFill(startX, startY, fillHex) {
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = state.canvasWidth;
    tempCanvas.height = state.canvasHeight;
    var tCtx = tempCanvas.getContext('2d');
    renderFrame(tCtx, state.currentFrame);

    var imgData = tCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight);
    var data = imgData.data;
    var w = state.canvasWidth;
    var h = state.canvasHeight;

    var startIdx = (startY * w + startX) * 4;
    var tr = data[startIdx];
    var tg = data[startIdx + 1];
    var tb = data[startIdx + 2];
    var ta = data[startIdx + 3];

    var fColor = hexToRgba(fillHex);
    var fr = fColor[0], fg = fColor[1], fb = fColor[2], fa = fColor[3];

    if (tr === fr && tg === fg && tb === fb && ta === fa) return;

    var queue = [startX, startY];
    var visited = (typeof Uint8Array !== 'undefined') ? new Uint8Array(w * h) : new Array(w * h);
    visited[startY * w + startX] = 1;

    var head = 0;
    while (head < queue.length) {
      var x = queue[head++];
      var y = queue[head++];
      var idx = (y * w + x) * 4;
      data[idx] = fr;
      data[idx + 1] = fg;
      data[idx + 2] = fb;
      data[idx + 3] = fa;

      var dirs = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (var d = 0; d < 4; d++) {
        var nx = dirs[d][0];
        var ny = dirs[d][1];
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          var nPos = ny * w + nx;
          if (!visited[nPos]) {
            var nIdx = nPos * 4;
            if (data[nIdx] === tr && data[nIdx + 1] === tg && data[nIdx + 2] === tb && data[nIdx + 3] === ta) {
              visited[nPos] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }
    }

    bgCtx.putImageData(imgData, 0, 0);
    state.strokes.push({
      type: 'raster_snapshot',
      bgData: bgCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight)
    });
    state.redoStack = [];
    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  }

  // --- DESHACER / REHACER ---
  function undo() {
    if (state.strokes.length === 0) return;
    state.redoStack.push(state.strokes.pop());
    refreshBackground();
    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    state.strokes.push(state.redoStack.pop());
    refreshBackground();
    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  }

  function refreshBackground() {
    bgCtx.fillStyle = state.backgroundColor;
    bgCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
    for (var i = 0; i < state.strokes.length; i++) {
      if (state.strokes[i].type === 'raster_snapshot' && state.strokes[i].bgData) {
        bgCtx.putImageData(state.strokes[i].bgData, 0, 0);
      }
    }
  }

  function clearCanvas() {
    if (confirm('¿Desea borrar la imagen?')) {
      state.strokes = [];
      state.redoStack = [];
      bgCtx.fillStyle = '#ffffff';
      bgCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);
      invalidateCache();
      renderFrame(ctx, state.currentFrame);
    }
  }

  // --- EVENTOS DEL RATÓN EN LIENZO 256x256 ---
  function getCanvasCoords(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = state.canvasWidth / rect.width;
    var scaleY = state.canvasHeight / rect.height;
    var x = Math.floor((e.clientX - rect.left) * scaleX);
    var y = Math.floor((e.clientY - rect.top) * scaleY);
    return {
      x: Math.max(0, Math.min(state.canvasWidth - 1, x)),
      y: Math.max(0, Math.min(state.canvasHeight - 1, y))
    };
  }

  canvas.oncontextmenu = function (e) {
    if (e.preventDefault) e.preventDefault();
    return false;
  };

  canvas.onmousemove = function (e) {
    var pos = getCanvasCoords(e);
    statusCoords.innerHTML = pos.x + ", " + pos.y;

    if (!state.isDrawing || !state.currentStroke) return;

    var curColor = (state.activeMouseButton === 2) ? state.color2 : state.color1;
    var tool = state.currentTool;

    if (tool === 'pencil' || tool === 'brush' || tool === 'eraser') {
      // Conectar con Bresenham para evitar huecos en movimientos rápidos
      if (state.lastMouseX !== null && state.lastMouseY !== null) {
        var linePts = getBresenhamPoints(state.lastMouseX, state.lastMouseY, pos.x, pos.y);
        for (var b = 1; b < linePts.length; b++) {
          state.currentStroke.points.push(linePts[b]);
        }
      } else {
        state.currentStroke.points.push({ x: pos.x, y: pos.y });
      }
      state.lastMouseX = pos.x;
      state.lastMouseY = pos.y;
    } else if (tool === 'line' || tool === 'curve' || tool === 'rect' || tool === 'roundrect' || tool === 'ellipse') {
      state.currentStroke.x2 = pos.x;
      state.currentStroke.y2 = pos.y;
    } else if (tool === 'airbrush') {
      var radius = state.brushSize * 2;
      for (var a = 0; a < 3; a++) {
        var ang = Math.random() * Math.PI * 2;
        var r = Math.random() * radius;
        state.currentStroke.particles.push({
          x: Math.round(pos.x + Math.cos(ang) * r),
          y: Math.round(pos.y + Math.sin(ang) * r)
        });
      }
    }
  };

  canvas.onmousedown = function (e) {
    var pos = getCanvasCoords(e);
    state.activeMouseButton = e.button;
    state.isDrawing = true;
    state.lastMouseX = pos.x;
    state.lastMouseY = pos.y;

    var curColor = (e.button === 2) ? state.color2 : state.color1;
    var seed = Math.random();
    var tool = state.currentTool;

    if (tool === 'dropper') {
      var p = ctx.getImageData(pos.x, pos.y, 1, 1).data;
      var hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
      if (e.button === 2) {
        setColor2(hex);
      } else {
        setColor1(hex);
      }
      state.isDrawing = false;
      return;
    }

    if (tool === 'magnifier') {
      var nextZoom = (state.zoom === 1) ? 2 : ((state.zoom === 2) ? 4 : ((state.zoom === 4) ? 8 : 1));
      setZoom(nextZoom);
      state.isDrawing = false;
      return;
    }

    if (tool === 'bucket') {
      floodFill(pos.x, pos.y, curColor);
      state.isDrawing = false;
      return;
    }


    if (tool === 'text') {
      openTextDialog(pos.x, pos.y);
      state.isDrawing = false;
      return;
    }

    if (tool === 'pencil') {
      state.currentStroke = {
        type: 'pencil',
        points: [{ x: pos.x, y: pos.y }],
        color: curColor,
        size: state.lineWidth,
        seed: seed,
        wiggleIntensity: state.wiggleIntensity
      };
    } else if (tool === 'brush') {
      state.currentStroke = {
        type: 'brush',
        points: [{ x: pos.x, y: pos.y }],
        color: curColor,
        size: state.brushSize,
        brushShape: state.brushShape,
        seed: seed,
        wiggleIntensity: state.wiggleIntensity
      };
    } else if (tool === 'eraser') {
      state.currentStroke = {
        type: 'eraser',
        points: [{ x: pos.x, y: pos.y }],
        color: state.color2,
        size: state.eraserSize,
        brushShape: 'square',
        seed: seed,
        wiggleIntensity: 0
      };
    } else if (tool === 'line') {
      state.currentStroke = {
        type: 'line',
        x1: pos.x, y1: pos.y,
        x2: pos.x, y2: pos.y,
        color: curColor,
        size: state.lineWidth,
        seed: seed,
        wiggleIntensity: state.wiggleIntensity
      };
    } else if (tool === 'curve') {
      state.currentStroke = {
        type: 'curve',
        x1: pos.x, y1: pos.y,
        x2: pos.x, y2: pos.y,
        cx: pos.x, cy: pos.y - 15,
        color: curColor,
        size: state.lineWidth,
        seed: seed,
        wiggleIntensity: state.wiggleIntensity
      };
    } else if (tool === 'rect' || tool === 'roundrect' || tool === 'ellipse') {
      state.currentStroke = {
        type: tool,
        x1: pos.x, y1: pos.y,
        x2: pos.x, y2: pos.y,
        color: curColor,
        fillColor: state.color2,
        fillMode: state.shapeFillMode,
        size: state.lineWidth,
        seed: seed,
        wiggleIntensity: state.wiggleIntensity
      };
    } else if (tool === 'airbrush') {
      state.currentStroke = {
        type: 'airbrush',
        particles: [{ x: pos.x, y: pos.y }],
        color: curColor,
        size: state.brushSize,
        seed: seed,
        wiggleIntensity: state.wiggleIntensity
      };
    }
  };

  window.onmouseup = function () {
    if (state.isDrawing && state.currentStroke) {
      state.strokes.push(state.currentStroke);
      state.redoStack = [];
      state.currentStroke = null;
      invalidateCache();
      renderFrame(ctx, state.currentFrame);
    }
    state.isDrawing = false;
    state.lastMouseX = null;
    state.lastMouseY = null;
  };

  // --- SELECCIÓN DE COLORES ---
  function setColor1(color) {
    state.color1 = color;
    sampleColor1.style.backgroundColor = color;
  }

  function setColor2(color) {
    state.color2 = color;
    sampleColor2.style.backgroundColor = color;
  }

  var swatches = document.querySelectorAll('.color-swatch');
  for (var s = 0; s < swatches.length; s++) {
    (function (el) {
      el.onclick = function () {
        setColor1(el.getAttribute('data-color'));
      };
      el.oncontextmenu = function (e) {
        if (e.preventDefault) e.preventDefault();
        setColor2(el.getAttribute('data-color'));
        return false;
      };
    })(swatches[s]);
  }


  // --- SELECCIÓN DE HERRAMIENTAS Y PANELES ---
  var toolCells = document.querySelectorAll('.tool-cell');
  for (var t = 0; t < toolCells.length; t++) {
    (function (cell) {
      cell.onclick = function () {
        setTool(cell.getAttribute('data-tool'));
      };
    })(toolCells[t]);
  }

  function setTool(tool) {
    state.currentTool = tool;
    for (var i = 0; i < toolCells.length; i++) {
      if (toolCells[i].getAttribute('data-tool') === tool) {
        toolCells[i].className = 'tool-cell selected';
      } else {
        toolCells[i].className = 'tool-cell';
      }
    }

    // Ocultar todos los sub-paneles y mostrar el correspondiente
    optLines.style.display = 'none';
    optBrush.style.display = 'none';
    optEraser.style.display = 'none';
    optShapes.style.display = 'none';
    optMagnifier.style.display = 'none';

    if (tool === 'pencil' || tool === 'line' || tool === 'curve') {
      optLines.style.display = 'block';
    } else if (tool === 'brush') {
      optBrush.style.display = 'grid';
    } else if (tool === 'eraser') {
      optEraser.style.display = 'block';
    } else if (tool === 'rect' || tool === 'roundrect' || tool === 'ellipse') {
      optShapes.style.display = 'block';
    } else if (tool === 'magnifier') {
      optMagnifier.style.display = 'block';
    } else {
      optLines.style.display = 'block';
    }

    var toolNames = {
      pencil: 'Lápiz: Traza líneas libres con temblor animado.',
      brush: 'Pincel: Dibuja con diferentes formas y grosores retro.',
      eraser: 'Borrador: Borra con el Color 2 (Secundario).',
      bucket: 'Relleno: Rellena un área continua con el color actual.',
      dropper: 'Seleccionar color: Clic izq toma Color 1, Clic der toma Color 2.',
      magnifier: 'Ampliación: Cambia el zoom entre 1x, 2x, 4x u 8x.',
      airbrush: 'Aerógrafo: Rocía partículas que tiemblan orgánicamente.',
      text: 'Texto: Inserta títulos y fechas para afiches de Vuelapelucas.',
      line: 'Línea: Traza líneas rectas con temblor al soltar.',
      curve: 'Curva: Traza líneas curvas vibrantes.',
      rect: 'Rectángulo: Dibuja cajas con o sin relleno.',
      roundrect: 'Rectángulo redondeado: Dibuja cajas suaves.',
      ellipse: 'Elipse: Dibuja círculos u óvalos.'
    };
    statusText.innerHTML = toolNames[tool] || 'Listo.';
  }

  // Opciones de grosor de línea
  var lineOpts = document.querySelectorAll('.line-width-opt');
  for (var l = 0; l < lineOpts.length; l++) {
    (function (el) {
      el.onclick = function () {
        for (var j = 0; j < lineOpts.length; j++) lineOpts[j].className = 'line-width-opt';
        el.className = 'line-width-opt selected';
        if (el.getAttribute('data-width')) {
          state.lineWidth = parseInt(el.getAttribute('data-width'), 10);
        }
        if (el.getAttribute('data-zoom')) {
          setZoom(parseInt(el.getAttribute('data-zoom'), 10));
        }
      };
    })(lineOpts[l]);
  }

  // Opciones de puntas de pincel
  var brushOpts = document.querySelectorAll('.brush-tip-opt');
  for (var bo = 0; bo < brushOpts.length; bo++) {
    (function (el) {
      el.onclick = function () {
        for (var j = 0; j < brushOpts.length; j++) brushOpts[j].className = 'brush-tip-opt';
        el.className = 'brush-tip-opt selected';
        if (el.getAttribute('data-shape')) state.brushShape = el.getAttribute('data-shape');
        if (el.getAttribute('data-size')) {
          var sz = parseInt(el.getAttribute('data-size'), 10);
          state.brushSize = sz;
          state.eraserSize = sz;
        }
      };
    })(brushOpts[bo]);
  }

  // Opciones de relleno de formas
  var shapeModeItems = document.querySelectorAll('.shape-mode-item');
  for (var sm = 0; sm < shapeModeItems.length; sm++) {
    (function (el) {
      el.onclick = function () {
        for (var j = 0; j < shapeModeItems.length; j++) shapeModeItems[j].className = 'shape-mode-item';
        el.className = 'shape-mode-item selected';
        state.shapeFillMode = el.getAttribute('data-fill');
      };
    })(shapeModeItems[sm]);
  }

  // Intensidad de temblor
  selWiggleIntensity.onchange = function (e) {
    state.wiggleIntensity = parseFloat(e.target.value);
    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  };

  // --- ZOOM Y CUADRÍCULA ---
  function setZoom(factor) {
    state.zoom = factor;
    canvas.style.width = (256 * factor) + 'px';
    canvas.style.height = (256 * factor) + 'px';
    document.getElementById('btnQuickZoom').innerHTML = '🔍 Zoom: ' + (factor * 100) + '%';
  }

  document.getElementById('btnQuickZoom').onclick = function () {
    var next = (state.zoom === 1) ? 2 : ((state.zoom === 2) ? 4 : ((state.zoom === 4) ? 8 : 1));
    setZoom(next);
  };

  document.getElementById('btnQuickGrid').onclick = function () {
    state.showGrid = !state.showGrid;
    if (state.showGrid) {
      canvasFrame.className = 'canvas-frame show-grid';
      this.className = 'win-button active';
    } else {
      canvasFrame.className = 'canvas-frame';
      this.className = 'win-button';
    }
  };

  // --- CONTROLES DE ANIMACIÓN ---
  var btnQuickPlay = document.getElementById('btnQuickPlay');
  btnQuickPlay.onclick = function () {
    state.isAnimated = !state.isAnimated;
    this.innerHTML = state.isAnimated ? '⏸ Pausar Temblor' : '▶ Reanudar Temblor';
  };

  function setFps(fps) {
    state.fps = fps;
    statusFps.innerHTML = fps + ' FPS (' + state.loopFrames + ' cuadros)';
  }

  // --- MENÚS DESPLEGABLES ---
  var menuItems = document.querySelectorAll('.win-menu-item');
  for (var m = 0; m < menuItems.length; m++) {
    (function (item) {
      var label = item.querySelector('.win-menu-label');
      label.onclick = function (e) {
        if (e.stopPropagation) e.stopPropagation();
        var isOpen = (item.className.indexOf('open') !== -1);
        for (var j = 0; j < menuItems.length; j++) menuItems[j].className = 'win-menu-item';
        if (!isOpen) item.className = 'win-menu-item open';
      };
    })(menuItems[m]);
  }

  window.onclick = function () {
    for (var j = 0; j < menuItems.length; j++) menuItems[j].className = 'win-menu-item';
  };

  // Acciones de menú y botones rápidos
  document.getElementById('btnQuickUndo').onclick = undo;
  document.getElementById('btnQuickRedo').onclick = redo;
  document.getElementById('btnQuickClear').onclick = clearCanvas;
  document.getElementById('menuNuevo').onclick = clearCanvas;
  document.getElementById('menuLimpiar').onclick = clearCanvas;
  document.getElementById('menuDeshacer').onclick = undo;
  document.getElementById('menuRehacer').onclick = redo;

  document.getElementById('menuZoom100').onclick = function () { setZoom(1); };
  document.getElementById('menuZoom200').onclick = function () { setZoom(2); };
  document.getElementById('menuZoom400').onclick = function () { setZoom(4); };
  document.getElementById('menuCuadricula').onclick = function () { document.getElementById('btnQuickGrid').click(); };

  document.getElementById('menuToggleAnim').onclick = function () { btnQuickPlay.click(); };
  document.getElementById('menuFps4').onclick = function () { setFps(4); };
  document.getElementById('menuFps8').onclick = function () { setFps(8); };
  document.getElementById('menuFps12').onclick = function () { setFps(12); };
  document.getElementById('menuFps16').onclick = function () { setFps(16); };

  document.getElementById('menuInvertir').onclick = function () {
    var imgData = bgCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight);
    var d = imgData.data;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i];
      d[i + 1] = 255 - d[i + 1];
      d[i + 2] = 255 - d[i + 2];
    }
    bgCtx.putImageData(imgData, 0, 0);
    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  };

  // --- MODALES (EXPORTACIÓN, TEXTO, SELLOS, ACERCA DE) ---
  function openModal(id) {
    document.getElementById(id).className = 'modal-overlay active';
  }
  function closeModal(id) {
    document.getElementById(id).className = 'modal-overlay';
  }

  document.getElementById('btnCloseExport').onclick = function () { closeModal('exportDialog'); };
  document.getElementById('btnCancelExport').onclick = function () { closeModal('exportDialog'); };
  document.getElementById('btnCloseText').onclick = function () { closeModal('textDialog'); };
  document.getElementById('btnCancelFlyerText').onclick = function () { closeModal('textDialog'); };

  document.getElementById('btnCloseAbout').onclick = function () { closeModal('aboutDialog'); };
  document.getElementById('btnAcceptAbout').onclick = function () { closeModal('aboutDialog'); };
  document.getElementById('menuAcercaDe').onclick = function () { openModal('aboutDialog'); };
  document.getElementById('menuTemasAyuda').onclick = function () { openModal('aboutDialog'); };
  document.getElementById('btnWinClose').onclick = function () {
    if (confirm('¿Cerrar Vuelapelucas 3000? Guarde su dibujo antes.')) window.close();
  };

  // --- CONTROL DE PANTALLA COMPLETA Y MAXIMIZAR (BOTÓN □) ---
  var btnWinMax = document.getElementById('btnWinMax');
  var paintWindow = document.getElementById('paintWindow');

  function isCurrentlyFullscreen() {
    var doc = document;
    var isApiFs = !!(doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
    var isClassFs = paintWindow && paintWindow.className.indexOf('maximized') !== -1;
    return isApiFs || isClassFs;
  }

  function setWindowMaximized(maximize) {
    var doc = document;
    var docEl = doc.documentElement;

    if (maximize) {
      // Intentar API de pantalla completa del navegador si está disponible
      var req = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
      if (req) {
        try {
          req.call(docEl);
        } catch (err) {}
      }
      if (paintWindow) paintWindow.className = 'paint-window maximized';
      document.body.className = 'fullscreen-mode';
      if (btnWinMax) {
        btnWinMax.title = 'Restaurar';
        btnWinMax.innerHTML = '&#10065;';
      }
    } else {
      var exit = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
      var isApiFs = !!(doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
      if (exit && isApiFs) {
        try {
          exit.call(doc);
        } catch (err) {}
      }
      if (paintWindow) paintWindow.className = 'paint-window';
      document.body.className = '';
      if (btnWinMax) {
        btnWinMax.title = 'Maximizar';
        btnWinMax.innerHTML = '&#9633;';
      }
    }
  }

  if (btnWinMax) {
    btnWinMax.onclick = function () {
      setWindowMaximized(!isCurrentlyFullscreen());
    };
  }

  // Doble clic en barra de título para maximizar/restaurar estilo Windows 95
  var titlebar = document.querySelector('.win-titlebar');
  if (titlebar) {
    titlebar.ondblclick = function (e) {
      if (e.target && (e.target.tagName === 'BUTTON' || (e.target.closest && e.target.closest('button')))) return;
      setWindowMaximized(!isCurrentlyFullscreen());
    };
  }

  function onFsChange() {
    var isApiFs = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
    if (!isApiFs && paintWindow && paintWindow.className.indexOf('maximized') !== -1) {
      setWindowMaximized(false);
    }
  }
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('mozfullscreenchange', onFsChange);
  document.addEventListener('MSFullscreenChange', onFsChange);

  // --- TEXTO FLYER ---
  var textCoordX = 20;
  var textCoordY = 100;
  function openTextDialog(x, y) {
    textCoordX = x || 20;
    textCoordY = y || 100;
    openModal('textDialog');
  }

  document.getElementById('btnApplyFlyerText').onclick = function () {
    var txt = document.getElementById('inputFlyerText').value;
    var fnt = document.getElementById('selTextFont').value;
    var sz = parseInt(document.getElementById('selTextSize').value, 10);
    var withWiggle = document.getElementById('chkTextWiggle').checked;
    var chkOutlineEl = document.getElementById('chkTextOutline');
    var withOutline = chkOutlineEl ? chkOutlineEl.checked : true;

    if (txt) {
      state.strokes.push({
        type: 'text',
        text: txt,
        x: textCoordX,
        y: textCoordY,
        fontFamily: fnt,
        fontSize: sz,
        color: state.color1,
        withOutline: withOutline,
        seed: Math.random(),
        wiggleIntensity: withWiggle ? state.wiggleIntensity : 0
      });
      state.redoStack = [];
      invalidateCache();
      renderFrame(ctx, state.currentFrame);
    }
    closeModal('textDialog');
  };



  // --- PLANTILLAS PRECARGADAS ---
  document.getElementById('menuPlantillaOficial').onclick = function () { loadOfficialTemplate(); };
  document.getElementById('menuPlantillaRave').onclick = function () { loadRaveTemplate(); };

  function loadOfficialTemplate() {
    state.strokes = [];
    state.redoStack = [];
    // Fondo negro
    bgCtx.fillStyle = '#000000';
    bgCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    // Marco amarillo neón tembloroso
    state.strokes.push({
      type: 'rect',
      x1: 8, y1: 8, x2: 248, y2: 248,
      color: '#ffd62c',
      fillMode: 'stroke',
      size: 2,
      seed: 0.1,
      wiggleIntensity: 1.5
    });

    // Marco interior rojo
    state.strokes.push({
      type: 'rect',
      x1: 14, y1: 14, x2: 242, y2: 242,
      color: '#ef4720',
      fillMode: 'stroke',
      size: 1,
      seed: 0.2,
      wiggleIntensity: 1.2
    });

    // Caldén central del festival
    state.strokes.push({
      type: 'stamp',
      stampName: 'calden',
      x: 128, y: 75,
      color: '#ffd62c',
      scale: 2,
      seed: 0.5,
      wiggleIntensity: 2.5
    });

    // Estallidos en los costados
    state.strokes.push({ type: 'stamp', stampName: 'estallido', x: 38, y: 70, color: '#6cfeb3', scale: 1, seed: 0.7, wiggleIntensity: 2.0 });
    state.strokes.push({ type: 'stamp', stampName: 'estallido', x: 218, y: 70, color: '#6cfeb3', scale: 1, seed: 0.8, wiggleIntensity: 2.0 });

    // Tipografía del Flyer en 256x256 con borde pixel negro sólido
    state.strokes.push({
      type: 'text',
      text: 'VUELAPELUCAS 3000',
      x: 20, y: 135,
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 14,
      color: '#ffd62c',
      withOutline: true,
      seed: 0.3,
      wiggleIntensity: 2.0
    });

    state.strokes.push({
      type: 'text',
      text: '★ ENCUENTRO ARTÍSTICO ★',
      x: 28, y: 172,
      fontFamily: "'VT323', monospace",
      fontSize: 16,
      color: '#6cfeb3',
      withOutline: true,
      seed: 0.4,
      wiggleIntensity: 1.5
    });

    state.strokes.push({
      type: 'text',
      text: 'ARTE • MÚSICA • LIVE ACTS',
      x: 26, y: 195,
      fontFamily: "'VT323', monospace",
      fontSize: 14,
      color: '#ffffff',
      withOutline: true,
      seed: 0.6,
      wiggleIntensity: 1.0
    });

    state.strokes.push({
      type: 'text',
      text: 'VUELAPELUCAS3000.COM.AR',
      x: 34, y: 222,
      fontFamily: "'VT323', monospace",
      fontSize: 12,
      color: '#ef4720',
      withOutline: true,
      seed: 0.9,
      wiggleIntensity: 0.8
    });

    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  }

  function loadRaveTemplate() {
    state.strokes = [];
    state.redoStack = [];
    bgCtx.fillStyle = '#0e75fe';
    bgCtx.fillRect(0, 0, state.canvasWidth, state.canvasHeight);

    state.strokes.push({
      type: 'rect',
      x1: 10, y1: 10, x2: 246, y2: 246,
      color: '#6cfeb3',
      fillMode: 'stroke',
      size: 2,
      seed: 0.2,
      wiggleIntensity: 2.0
    });

    state.strokes.push({
      type: 'stamp',
      stampName: 'flor',
      x: 128, y: 70,
      color: '#ffd62c',
      scale: 2,
      seed: 0.4,
      wiggleIntensity: 2.5
    });

    state.strokes.push({
      type: 'text',
      text: 'VUELAPELUCAS RAVE',
      x: 24, y: 135,
      fontFamily: "'Press Start 2P', monospace",
      fontSize: 14,
      color: '#ffd62c',
      withOutline: true,
      seed: 0.5,
      wiggleIntensity: 2.2
    });

    state.strokes.push({
      type: 'text',
      text: 'SYNTHS & VIBRACIONES',
      x: 40, y: 175,
      fontFamily: "'VT323', monospace",
      fontSize: 16,
      color: '#6cfeb3',
      withOutline: true,
      seed: 0.7,
      wiggleIntensity: 1.8
    });

    invalidateCache();
    renderFrame(ctx, state.currentFrame);
  }

  // --- EXPORTACIÓN CON VECINO MÁS CERCANO (256, 512, 1024, 2048 PX) ---
  var btnQuickExport = document.getElementById('btnQuickExport');
  var menuExportar = document.getElementById('menuExportar');
  var btnExecuteExport = document.getElementById('btnExecuteExport');
  var selExportFormat = document.getElementById('selExportFormat');
  var selExportScale = document.getElementById('selExportScale');
  var exportPreviewCanvas = document.getElementById('exportPreviewCanvas');
  var exportPreviewCtx = exportPreviewCanvas.getContext('2d');
  if (exportPreviewCtx.imageSmoothingEnabled !== undefined) {
    exportPreviewCtx.imageSmoothingEnabled = false;
  }
  var exportProgress = document.getElementById('exportProgress');
  var exportProgressBar = document.getElementById('exportProgressBar');
  var exportStatusMsg = document.getElementById('exportStatusMsg');
  var grpExportScale = document.getElementById('grpExportScale');

  function openExportDialog() {
    updateExportPreview();
    openModal('exportDialog');
  }

  btnQuickExport.onclick = openExportDialog;
  menuExportar.onclick = openExportDialog;

  selExportFormat.onchange = function () {
    if (selExportFormat.value === 'json') {
      grpExportScale.style.display = 'none';
    } else {
      grpExportScale.style.display = 'block';
    }
    updateExportPreview();
  };

  selExportScale.onchange = updateExportPreview;

  function updateExportPreview() {
    exportPreviewCtx.clearRect(0, 0, 120, 120);
    exportPreviewCtx.drawImage(canvas, 0, 0, 256, 256, 0, 0, 120, 120);
    var scale = parseInt(selExportScale.value, 10);
    var finalDim = 256 * scale;
    exportStatusMsg.innerHTML = "Salida: " + finalDim + "x" + finalDim + " px (Escala " + scale + "x - Vecino más cercano)";
  }

  btnExecuteExport.onclick = function () {
    var format = selExportFormat.value;
    var scale = parseInt(selExportScale.value, 10);
    var targetDim = 256 * scale;

    btnExecuteExport.disabled = true;
    exportProgress.style.display = 'block';
    exportProgressBar.style.width = '15%';
    exportStatusMsg.innerHTML = 'Generando archivo...';

    if (format === 'png') {
      // Escalado con vecino más cercano estricto
      var outCanvas = document.createElement('canvas');
      outCanvas.width = targetDim;
      outCanvas.height = targetDim;
      var outCtx = outCanvas.getContext('2d');
      if (outCtx.imageSmoothingEnabled !== undefined) outCtx.imageSmoothingEnabled = false;
      if (outCtx.webkitImageSmoothingEnabled !== undefined) outCtx.webkitImageSmoothingEnabled = false;
      if (outCtx.mozImageSmoothingEnabled !== undefined) outCtx.mozImageSmoothingEnabled = false;
      if (outCtx.msImageSmoothingEnabled !== undefined) outCtx.msImageSmoothingEnabled = false;

      outCtx.drawImage(canvas, 0, 0, 256, 256, 0, 0, targetDim, targetDim);

      exportProgressBar.style.width = '100%';
      var a = document.createElement('a');
      a.download = 'vuelapelucas_3000_' + targetDim + 'x' + targetDim + '.png';
      a.href = outCanvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      exportStatusMsg.innerHTML = '✓ PNG exportado con éxito (' + targetDim + 'x' + targetDim + ' px)';
      btnExecuteExport.disabled = false;
    } else if (format === 'gif') {
      exportStatusMsg.innerHTML = 'Codificando cuadros con trazo tembloroso...';
      exportProgressBar.style.width = '30%';

      setTimeout(function () {
        var encoder = new window.GifEncoder(targetDim, targetDim);
        var delay = Math.round(100 / state.fps);
        encoder.setDelay(delay);
        encoder.setRepeat(0);

        var rgbPalette = [];
        for (var p = 0; p < OFFICIAL_PALETTE.length; p++) {
          var rgb = hexToRgba(OFFICIAL_PALETTE[p]);
          rgbPalette.push([rgb[0], rgb[1], rgb[2]]);
        }
        encoder.setPalette(rgbPalette);

        var frameCanvas = document.createElement('canvas');
        frameCanvas.width = targetDim;
        frameCanvas.height = targetDim;
        var fCtx = frameCanvas.getContext('2d');
        if (fCtx.imageSmoothingEnabled !== undefined) fCtx.imageSmoothingEnabled = false;

        var base256 = document.createElement('canvas');
        base256.width = 256;
        base256.height = 256;
        var bCtx = base256.getContext('2d');
        if (bCtx.imageSmoothingEnabled !== undefined) bCtx.imageSmoothingEnabled = false;

        for (var f = 0; f < state.loopFrames; f++) {
          renderFrame(bCtx, f);
          fCtx.clearRect(0, 0, targetDim, targetDim);
          fCtx.drawImage(base256, 0, 0, 256, 256, 0, 0, targetDim, targetDim);
          encoder.addFrame(fCtx);
        }

        exportProgressBar.style.width = '85%';
        exportStatusMsg.innerHTML = 'Comprimiendo GIF LZW...';

        setTimeout(function () {
          var gifResult = encoder.render();
          var a = document.createElement('a');
          a.download = 'vuelapelucas_3000_' + targetDim + 'x' + targetDim + '.gif';

          if (typeof gifResult === 'string') {
            a.href = gifResult;
          } else {
            var url = URL.createObjectURL(gifResult);
            a.href = url;
          }
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          exportProgressBar.style.width = '100%';
          exportStatusMsg.innerHTML = '✓ GIF animado generado con éxito (' + targetDim + 'x' + targetDim + ' px)';
          btnExecuteExport.disabled = false;
        }, 50);
      }, 50);
    } else if (format === 'webm') {
      if (!window.MediaRecorder || !canvas.captureStream) {
        alert('La grabación de video WebM no está soportada en este navegador antiguo. Utilice la opción GIF o PNG.');
        btnExecuteExport.disabled = false;
        return;
      }
      exportStatusMsg.innerHTML = 'Grabando animación HD...';
      var videoCanvas = document.createElement('canvas');
      videoCanvas.width = targetDim;
      videoCanvas.height = targetDim;
      var vCtx = videoCanvas.getContext('2d');
      if (vCtx.imageSmoothingEnabled !== undefined) vCtx.imageSmoothingEnabled = false;

      var stream = videoCanvas.captureStream(state.fps);
      var recorder = new MediaRecorder(stream);
      var chunks = [];
      recorder.ondataavailable = function (e) { chunks.push(e.data); };
      recorder.onstop = function () {
        var blob = new Blob(chunks, { type: 'video/webm' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.download = 'vuelapelucas_3000_' + targetDim + 'x' + targetDim + '.webm';
        a.href = url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        exportProgressBar.style.width = '100%';
        exportStatusMsg.innerHTML = '✓ Video WebM generado con éxito.';
        btnExecuteExport.disabled = false;
      };

      recorder.start();
      var framesRecorded = 0;
      var totalFrames = state.fps * 3; // 3 segundos
      var recInterval = setInterval(function () {
        state.currentFrame = (state.currentFrame + 1) % state.loopFrames;
        renderFrame(ctx, state.currentFrame);
        vCtx.clearRect(0, 0, targetDim, targetDim);
        vCtx.drawImage(canvas, 0, 0, 256, 256, 0, 0, targetDim, targetDim);
        framesRecorded++;
        exportProgressBar.style.width = Math.round((framesRecorded / totalFrames) * 90) + '%';
        if (framesRecorded >= totalFrames) {
          clearInterval(recInterval);
          recorder.stop();
        }
      }, 1000 / state.fps);
    } else if (format === 'json') {
      var projectData = {
        app: 'VUELAPELUCAS 3000',
        version: '2.0',
        width: state.canvasWidth,
        height: state.canvasHeight,
        strokes: state.strokes
      };
      var jsonStr = JSON.stringify(projectData);
      var blob = (typeof Blob !== 'undefined') ? new Blob([jsonStr], { type: 'application/json' }) : null;
      var a = document.createElement('a');
      a.download = 'vuelapelucas_3000_proyecto.json';
      if (blob && window.URL) {
        a.href = URL.createObjectURL(blob);
      } else {
        a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      exportProgressBar.style.width = '100%';
      exportStatusMsg.innerHTML = '✓ Proyecto guardado.';
      btnExecuteExport.disabled = false;
    }
  };

  // --- CARGA DE ARCHIVOS ---
  var inputLoadImg = document.getElementById('inputLoadImg');
  var inputLoadProj = document.getElementById('inputLoadProj');

  document.getElementById('menuAbrir').onclick = function () { inputLoadImg.click(); };
  document.getElementById('menuGuardar').onclick = function () {
    document.getElementById('selExportFormat').value = 'json';
    document.getElementById('btnExecuteExport').click();
  };

  inputLoadImg.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (evt) {
      var img = new Image();
      img.onload = function () {
        bgCtx.drawImage(img, 0, 0, state.canvasWidth, state.canvasHeight);
        state.strokes.push({
          type: 'raster_snapshot',
          bgData: bgCtx.getImageData(0, 0, state.canvasWidth, state.canvasHeight)
        });
        invalidateCache();
        renderFrame(ctx, state.currentFrame);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ============================================================
  // 🌐 PUBLICAR EN LA GALERIA DE LA COMUNIDAD (API VUELAPELUCAS 3000)
  // ------------------------------------------------------------
  // Guarda el dibujo (PNG con escalado vecino mas cercano) con NOMBRE + AUTOR.
  // Opcional: si hay sesion FSCAUTH, la creacion queda atada al perfil
  // universal del ecosistema. La sesion la verifica el SERVIDOR (cookie
  // cross-site fsc_token contra fscauth); el cliente nunca decide la identidad.
  // ============================================================
  var IS_LOCAL_APP = (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  var API_BASE = IS_LOCAL_APP
    ? (location.protocol + '//' + location.host + '/vuelapelucas3000_2')
    : 'https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2';
  // Tecnico (server -> server): la verificacion de sesion va directo al VPS.
  var FSC_API = 'https://vps-4455523-x.dattaweb.com/fscauth';
  var FSC_AUTH_PUBLIC = 'https://fullscreencode.com/fscauth/';
  // LOGIN DIRECTO: el boton manda a la pantalla de login de FSCAUTH y, al entrar,
  // el SSO VUELVE a ESTA misma pagina con ?token=&username=... (lo capturamos abajo).
  // Asi el usuario no queda tirado en el pasaporte ni tiene que volver a mano.
  var FSC_LOGIN = FSC_AUTH_PUBLIC + 'login.html?redirect=' +
    encodeURIComponent(location.origin + location.pathname) + '&origin=vuelapelucas';

  var fscSesion = null;
  var fscToken = '';          // token del ecosistema: va como Bearer al publicar

  // --- Sesion FSCAUTH en el cliente -----------------------------------------
  // La pagina vive en fullscreencode.com, el MISMO origen que fscauth: despues
  // del login el token queda en localStorage y lo leemos de ahi (confiable).
  // La cookie cross-site queda solo como respaldo (los navegadores bloquean
  // cookies de terceros, por eso el boton "no andaba bien").
  function fscLs(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function fscLsSet(k, v) { try { if (v) localStorage.setItem(k, v); } catch (e) {} }

  // Retorno del SSO: fscauth/login.html vuelve con ?token=&username=&userId=.
  // Guardamos la sesion y limpiamos la URL (para no dejar el token a la vista).
  function fscCapturarRetorno() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var tok = q.get('token'), usr = q.get('username');
    if (!tok || !usr) return;
    fscLsSet('token', tok);
    fscLsSet('username', usr);
    fscLsSet('userId', q.get('userId') || '');
    fscLsSet('role', q.get('role') || '');
    ['token', 'username', 'userId', 'role', 'ssoset'].forEach(function (k) { q.delete(k); });
    var resto = q.toString();
    try { history.replaceState({}, document.title, location.pathname + (resto ? '?' + resto : '')); } catch (e) {}
  }

  function fscSesionLocal() {
    var tok = fscLs('token'), usr = fscLs('username');
    if (!tok || !usr) return null;
    return { username: usr, id: fscLs('userId'), token: tok };
  }

  function fscAplicar(s) {
    if (s) { fscSesion = s; if (s.token) fscToken = s.token; }
    fscPintaSesion();
  }

  var btnQuickPublish = document.getElementById('btnQuickPublish');
  var menuPublicar = document.getElementById('menuPublicar');
  var pubNombre = document.getElementById('pubNombre');
  var pubAutor = document.getElementById('pubAutor');
  var pubEscala = document.getElementById('pubEscala');
  var pubStatus = document.getElementById('pubStatus');
  var pubProgress = document.getElementById('pubProgress');
  var pubProgressBar = document.getElementById('pubProgressBar');
  var pubFscStatus = document.getElementById('pubFscStatus');
  var pubFscLink = document.getElementById('pubFscLink');
  var btnDoPublish = document.getElementById('btnDoPublish');

  function pubMsg(txt, cls) {
    pubStatus.className = 'pub-status' + (cls ? ' ' + cls : '');
    pubStatus.innerHTML = txt;
  }

  function fscPintaSesion() {
    if (fscSesion) {
      pubFscStatus.className = 'pub-fsc-status is-on';
      pubFscStatus.innerHTML = '● Sesión FSCAUTH activa: @' + fscSesion.username;
      pubFscLink.className = 'pub-fsc-link';
      pubFscLink.innerHTML = 'USAR MI USUARIO FSCAUTH';
      // Ya logueado: el link NO navega, completa AUTOR con tu usuario.
      if (!pubAutor.value) pubAutor.value = '@' + fscSesion.username;
    } else {
      pubFscStatus.className = 'pub-fsc-status';
      pubFscStatus.innerHTML = 'Se publica sin usuario (solo nombre y autor).';
      pubFscLink.className = 'pub-fsc-link';
      pubFscLink.innerHTML = 'Logearse con FSCAUTH';
      pubFscLink.title = 'Entrá con tu cuenta FullScreen y tu dibujo queda en tu perfil';
    }
    // Sin sesion: a LOGIN (y vuelve aca). Con sesion el click no navega (ver abajo).
    pubFscLink.href = FSC_LOGIN;
  }

  // Click en "Logearse con FSCAUTH":
  //  - sin sesion  -> va al LOGIN de FSCAUTH y al entrar VUELVE a esta pagina
  //                   (ya logueado, con el AUTOR completado).
  //  - con sesion  -> NO te saca de la pagina: completa AUTOR y te deja logueado
  pubFscLink.onclick = function (e) {
    if (!fscSesion) return;                      // sin sesion: navega a FSC_LOGIN
    if (e && e.preventDefault) e.preventDefault();
    pubAutor.value = '@' + fscSesion.username;
    pubFscStatus.className = 'pub-fsc-status is-on';
    pubFscStatus.innerHTML = '● Sesión FSCAUTH: @' + fscSesion.username + ' (ya está en AUTOR)';
    pubMsg('✓ Vas a publicar como @' + fscSesion.username + ' (queda en tu perfil FSCAUTH).', 'is-ok');
    try { pubNombre.focus(); } catch (err) {}
  };

  function fscCheck() {
    // 1) Volvimos del login? (?token=&username=) -> guardar y limpiar la URL.
    fscCapturarRetorno();
    // 2) Sesion en localStorage (mismo origen que fscauth: la via confiable).
    var local = fscSesionLocal();
    if (local) { fscAplicar(local); return; }
    // 3) Respaldo: cookie cross-site del ecosistema, verificada por el VPS.
    if (typeof fetch !== 'function') { fscPintaSesion(); return; }
    fetch(FSC_API + '/api/auth/verify', { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        fscAplicar((d && d.loggedIn && d.user) ? { username: d.user.username, id: d.user.id, token: '' } : null);
      })
      .catch(function () { fscPintaSesion(); });
  }

  // Captura del lienzo con vecino mas cercano (mismo criterio que la exportacion)
  function pubSnapshot(scale) {
    var dim = 256 * scale;
    var out = document.createElement('canvas');
    out.width = dim;
    out.height = dim;
    var octx = out.getContext('2d');
    if (octx.imageSmoothingEnabled !== undefined) octx.imageSmoothingEnabled = false;
    if (octx.webkitImageSmoothingEnabled !== undefined) octx.webkitImageSmoothingEnabled = false;
    if (octx.mozImageSmoothingEnabled !== undefined) octx.mozImageSmoothingEnabled = false;
    if (octx.msImageSmoothingEnabled !== undefined) octx.msImageSmoothingEnabled = false;
    octx.drawImage(canvas, 0, 0, 256, 256, 0, 0, dim, dim);
    return out.toDataURL('image/png');
  }

  function openPublishDialog() {
    pubProgress.style.display = 'none';
    pubProgressBar.style.width = '0%';
    pubMsg('Se publica en la galería pública de VUELAPELUCAS 3000.');
    openModal('publishDialog');
    fscCheck();
    setTimeout(function () { try { pubNombre.focus(); } catch (e) {} }, 60);
  }

  // GIF del TEMBLOR: los mismos 4 cuadros que ves mientras dibujás.
  // Es lo que hace que en la galería la creación se vea animada.
  function pubGif(scale, done) {
    if (!window.GifEncoder) { done('', 'sin-encoder'); return; }
    var dim = 256 * scale;
    try {
      var encoder = new window.GifEncoder(dim, dim);
      encoder.setDelay(Math.round(100 / state.fps));
      encoder.setRepeat(0);

      var rgbPalette = [];
      for (var p = 0; p < OFFICIAL_PALETTE.length; p++) {
        var rgb = hexToRgba(OFFICIAL_PALETTE[p]);
        rgbPalette.push([rgb[0], rgb[1], rgb[2]]);
      }
      encoder.setPalette(rgbPalette);

      var base256 = document.createElement('canvas');
      base256.width = 256; base256.height = 256;
      var bCtx = base256.getContext('2d');
      if (bCtx.imageSmoothingEnabled !== undefined) bCtx.imageSmoothingEnabled = false;

      var frameCanvas = document.createElement('canvas');
      frameCanvas.width = dim; frameCanvas.height = dim;
      var fCtx = frameCanvas.getContext('2d');
      if (fCtx.imageSmoothingEnabled !== undefined) fCtx.imageSmoothingEnabled = false;

      for (var f = 0; f < state.loopFrames; f++) {
        renderFrame(bCtx, f);
        fCtx.clearRect(0, 0, dim, dim);
        fCtx.drawImage(base256, 0, 0, 256, 256, 0, 0, dim, dim);
        encoder.addFrame(fCtx);
      }

      var out = encoder.render();
      if (typeof out === 'string') { done(out, null); return; }
      var fr = new FileReader();
      fr.onload = function () { done(String(fr.result || ''), null); };
      fr.onerror = function () { done('', 'reader'); };
      fr.readAsDataURL(out);
    } catch (e) {
      done('', String((e && e.message) || e));
    }
  }

  function doPublish() {
    var nombre = String(pubNombre.value || '').replace(/\s+/g, ' ').trim();
    var autor = String(pubAutor.value || '').replace(/\s+/g, ' ').trim();
    var scale = parseInt(pubEscala.value, 10) || 2;

    if (!nombre) { pubMsg('Ponele un nombre al dibujo.', 'is-err'); pubNombre.focus(); return; }
    if (!autor) { pubMsg('Ponele un autor al dibujo.', 'is-err'); pubAutor.focus(); return; }

    btnDoPublish.disabled = true;
    pubProgress.style.display = 'block';
    pubProgressBar.style.width = '35%';
    pubMsg('Publicando el dibujo...');

    var dataUrl;
    try {
      dataUrl = pubSnapshot(scale);
    } catch (e) {
      btnDoPublish.disabled = false;
      pubMsg('No se pudo leer el lienzo.', 'is-err');
      return;
    }
    pubProgressBar.style.width = '55%';

    // Primero la animación (temblor) y después la subida.
    pubGif(scale, function (gifUrl, gifErr) {
      pubProgressBar.style.width = '75%';
      if (gifErr) {
        pubMsg('No se pudo armar la animación, se publica la imagen fija...');
      } else {
        pubMsg('Subiendo la animación del trazo...');
      }

      // El token va TAMBIEN como Bearer: asi el VPS identifica al autor aunque el
      // navegador bloquee la cookie cross-site (el server ya lo acepta, la cookie
      // queda como respaldo). Sin esto el dibujo NO se indexaba en FSCAUTH.
      var pubHeaders = { 'Content-Type': 'application/json' };
      if (fscToken) pubHeaders['Authorization'] = 'Bearer ' + fscToken;

      fetch(API_BASE + '/api/artworks', {
        method: 'POST',
        credentials: 'include',
        headers: pubHeaders,
        body: JSON.stringify({ nombre: nombre, autor: autor, escala: scale, image: dataUrl, gif: gifUrl || '' })
      }).then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      }).then(function (res) {
        if (!res.ok) throw new Error((res.d && res.d.error) || 'No se pudo publicar');
        pubProgressBar.style.width = '100%';
        pubMsg('✓ ¡Publicado! Ya aparece animado en CREACIONES DE LA COMUNIDAD' +
          (res.d.fscauth ? ' y en tu perfil FSCAUTH (@' + res.d.fscauth + ')' : '') + '.', 'is-ok');
        try {
          document.getElementById('winTitleText').innerHTML = String(nombre) + '.bmp - Paint (VUELAPELUCAS 3000)';
        } catch (e) {}
      }).catch(function (err) {
        pubMsg('✕ ' + ((err && err.message) ? err.message : 'Error al publicar') + '.', 'is-err');
      }).then(function () { btnDoPublish.disabled = false; });
    });
  }

  if (btnQuickPublish) btnQuickPublish.onclick = openPublishDialog;
  if (menuPublicar) menuPublicar.onclick = openPublishDialog;
  if (btnDoPublish) btnDoPublish.onclick = doPublish;
  document.getElementById('btnCancelPublish').onclick = function () { closeModal('publishDialog'); };
  document.getElementById('btnClosePublish').onclick = function () { closeModal('publishDialog'); };
  pubNombre.onkeydown = function (e) { if (e.key === 'Enter' || e.keyCode === 13) doPublish(); };

  // Al abrir la pagina ya se consulta la sesión FSCAUTH (así el botón sabe si
  // tenés que loguearte o si ya puede usar tu usuario). Si volvimos del LOGIN
  // (?token=&username=) la capturamos al instante.
  fscCapturarRetorno();
  setTimeout(fscCheck, 400);
  // Si te logueaste en OTRA pestaña, al volver acá el botón se actualiza solo.
  window.addEventListener('focus', function () { if (!fscSesion) fscCheck(); });

  // F9 = publicar (sin pisar los atajos de dibujo)
  window.addEventListener('keydown', function (e) {
    if (e.key === 'F9' || e.keyCode === 120) {
      if (e.preventDefault) e.preventDefault();
      if (document.getElementById('publishDialog').className.indexOf('active') < 0) openPublishDialog();
    }
  });

  // --- VISOR: ?dibujo=<id> (link desde la galeria o el perfil FSCAUTH) ---
  function verDibujoDeURL() {
    var m = String(location.search || '').match(/[?&]dibujo=([0-9a-fA-F]{24})/);
    if (!m) return;
    document.getElementById('viewImg').src = API_BASE + '/api/artworks/' + m[1] + '/img';
    fetch(API_BASE + '/api/artworks', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var lista = (d && d.artworks) || [];
        for (var i = 0; i < lista.length; i++) {
          if (lista[i].id === m[1]) {
            document.getElementById('viewTitle').innerHTML = 'PANCHODRAW · ' + lista[i].nombre +
              ' · ' + (lista[i].username ? '@' + lista[i].username : lista[i].autor);
            break;
          }
        }
      })
      .catch(function () {});
    openModal('viewDialog');
  }
  document.getElementById('btnCloseView').onclick = function () { closeModal('viewDialog'); };
  document.getElementById('btnAcceptView').onclick = function () { closeModal('viewDialog'); };
  verDibujoDeURL();

  // --- ATAJOS DE TECLADO ---
  window.onkeydown = function (e) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

    if (e.ctrlKey && (e.key === 'z' || e.keyCode === 90)) {
      if (e.preventDefault) e.preventDefault();
      undo();
    } else if (e.ctrlKey && (e.key === 'y' || e.keyCode === 89)) {
      if (e.preventDefault) e.preventDefault();
      redo();
    } else if (e.ctrlKey && (e.key === 'e' || e.keyCode === 69)) {
      if (e.preventDefault) e.preventDefault();
      openExportDialog();
    } else if (e.ctrlKey && (e.key === 's' || e.keyCode === 83)) {
      if (e.preventDefault) e.preventDefault();
      document.getElementById('menuGuardar').click();
    } else if (e.code === 'Space' || e.keyCode === 32) {
      if (e.preventDefault) e.preventDefault();
      btnQuickPlay.click();
    } else if (e.key === 'p' || e.keyCode === 80) {
      setTool('pencil');
    } else if (e.key === 'b' || e.keyCode === 66) {
      setTool('brush');
    } else if (e.key === 'e' || e.keyCode === 69) {
      setTool('eraser');
    } else if (e.key === 'g' || e.keyCode === 71) {
      setTool('bucket');
    } else if (e.key === 't' || e.keyCode === 84) {
      setTool('text');
    }
  };

  // Iniciar con lienzo en blanco
  invalidateCache();
  renderFrame(ctx, state.currentFrame);
})();
