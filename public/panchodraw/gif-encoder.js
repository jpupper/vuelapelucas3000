/**
 * VUELAPELUCAS 3000 - Standalone Lightweight GIF89a Encoder
 * Compatible con navegadores modernos y computadoras de época (2005)
 * Algoritmo LZW estándar de alta fidelidad, compresión precisa sin artefactos.
 * Sintaxis ES3/ES5 pura, sin dependencias externas.
 */

(function (global) {
  'use strict';

  // --- BÚFER DE BYTES EFICIENTE ---
  function ByteArray() {
    this.bin = [];
  }
  ByteArray.prototype.writeByte = function (b) {
    this.bin.push(b & 0xff);
  };
  ByteArray.prototype.writeBytes = function (arr, offset, count) {
    offset = offset || 0;
    count = count !== undefined ? count : arr.length;
    for (var i = 0; i < count; i++) {
      this.bin.push(arr[offset + i] & 0xff);
    }
  };

  // --- COMPRESOR LZW ESTÁNDAR PARA GIF (Algoritmo Spencer W. Thomas / Kevin Weiner) ---
  function LZWEncoder(width, height, pixels, color_depth) {
    var EOF = -1;
    var imgW = width;
    var imgH = height;
    var pixAry = pixels;
    var initCodeSize = Math.max(2, color_depth);
    var remaining = 0;
    var curPixel = 0;

    var BITS = 12;
    var HSIZE = 5003; // Tabla hash con ocupación del ~80%
    var n_bits;
    var maxbits = BITS;
    var maxcode;
    var maxmaxcode = 1 << BITS;
    var htab = (typeof Int32Array !== 'undefined') ? new Int32Array(HSIZE) : new Array(HSIZE);
    var codetab = (typeof Int32Array !== 'undefined') ? new Int32Array(HSIZE) : new Array(HSIZE);
    var hsize = HSIZE;
    var free_ent = 0;
    var clear_flg = false;
    var g_init_bits;
    var ClearCode;
    var EOFCode;
    var cur_accum = 0;
    var cur_bits = 0;
    var masks = [
      0x0000, 0x0001, 0x0003, 0x0007,
      0x000F, 0x001F, 0x003F, 0x007F,
      0x00FF, 0x01FF, 0x03FF, 0x07FF,
      0x0FFF, 0x1FFF, 0x3FFF, 0x7FFF, 0xFFFF
    ];
    var a_count = 0;
    var accum = (typeof Uint8Array !== 'undefined') ? new Uint8Array(256) : new Array(256);

    function MAXCODE(nbits) {
      return (1 << nbits) - 1;
    }

    function flush_char(outs) {
      if (a_count > 0) {
        outs.writeByte(a_count);
        outs.writeBytes(accum, 0, a_count);
        a_count = 0;
      }
    }

    function char_out(c, outs) {
      accum[a_count++] = c;
      if (a_count >= 254) flush_char(outs);
    }

    function cl_hash(hsz) {
      for (var i = 0; i < hsz; ++i) htab[i] = -1;
    }

    function output(code, outs) {
      cur_accum &= masks[cur_bits];
      if (cur_bits > 0) cur_accum |= (code << cur_bits);
      else cur_accum = code;
      cur_bits += n_bits;

      while (cur_bits >= 8) {
        char_out((cur_accum & 0xff), outs);
        cur_accum >>= 8;
        cur_bits -= 8;
      }

      if (free_ent > maxcode || clear_flg) {
        if (clear_flg) {
          maxcode = MAXCODE(n_bits = g_init_bits);
          clear_flg = false;
        } else {
          ++n_bits;
          if (n_bits === maxbits) maxcode = maxmaxcode;
          else maxcode = MAXCODE(n_bits);
        }
      }

      if (code === EOFCode) {
        while (cur_bits > 0) {
          char_out((cur_accum & 0xff), outs);
          cur_accum >>= 8;
          cur_bits -= 8;
        }
        flush_char(outs);
      }
    }

    function cl_block(outs) {
      cl_hash(hsize);
      free_ent = ClearCode + 2;
      clear_flg = true;
      output(ClearCode, outs);
    }

    function nextPixel() {
      if (remaining === 0) return EOF;
      --remaining;
      return pixAry[curPixel++] & 0xff;
    }

    function compress(init_bits, outs) {
      g_init_bits = init_bits;
      clear_flg = false;
      n_bits = g_init_bits;
      maxcode = MAXCODE(n_bits);
      ClearCode = 1 << (init_bits - 1);
      EOFCode = ClearCode + 1;
      free_ent = ClearCode + 2;
      a_count = 0;

      var ent = nextPixel();
      var hshift = 0;
      var fcode;
      for (fcode = hsize; fcode < 65536; fcode *= 2) ++hshift;
      hshift = 8 - hshift;
      var hsize_reg = hsize;
      cl_hash(hsize_reg);
      output(ClearCode, outs);

      var c, i, disp;
      outer_loop: while ((c = nextPixel()) !== EOF) {
        fcode = (c << maxbits) + ent;
        i = (c << hshift) ^ ent;

        if (htab[i] === fcode) {
          ent = codetab[i];
          continue;
        } else if (htab[i] >= 0) {
          disp = hsize_reg - i;
          if (i === 0) disp = 1;
          do {
            if ((i -= disp) < 0) i += hsize_reg;
            if (htab[i] === fcode) {
              ent = codetab[i];
              continue outer_loop;
            }
          } while (htab[i] >= 0);
        }

        output(ent, outs);
        ent = c;
        if (free_ent < maxmaxcode) {
          codetab[i] = free_ent++;
          htab[i] = fcode;
        } else {
          cl_block(outs);
        }
      }
      output(ent, outs);
      output(EOFCode, outs);
    }

    this.encode = function (os) {
      os.writeByte(initCodeSize);
      remaining = imgW * imgH;
      curPixel = 0;
      compress(initCodeSize + 1, os);
      os.writeByte(0);
    };
  }

  // --- MOTOR GIF89a MULTICUADRO ---
  function GifEncoder(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
    this.delay = 12; // centésimas de segundo (12 cs = ~8.33 fps)
    this.repeat = 0; // 0 = bucle infinito
    this.palette = null;
  }

  GifEncoder.prototype.setDelay = function (delayInHundredths) {
    this.delay = Math.max(1, Math.round(delayInHundredths));
  };

  GifEncoder.prototype.setRepeat = function (repeat) {
    this.repeat = repeat;
  };

  GifEncoder.prototype.setPalette = function (rgbArray) {
    this.palette = rgbArray;
  };

  GifEncoder.prototype.addFrame = function (ctxOrImageData, delay) {
    var imgData;
    if (ctxOrImageData.data) {
      imgData = ctxOrImageData;
    } else {
      imgData = ctxOrImageData.getImageData(0, 0, this.width, this.height);
    }
    this.frames.push({
      data: imgData.data,
      delay: delay !== undefined ? delay : this.delay
    });
  };

  function findClosestColor(r, g, b, palette, cache) {
    var key = (r << 16) | (g << 8) | b;
    if (cache[key] !== undefined) return cache[key];

    var bestIndex = 0;
    var bestDist = Infinity;
    for (var i = 0; i < palette.length; i++) {
      var pr = palette[i][0];
      var pg = palette[i][1];
      var pb = palette[i][2];
      var dr = r - pr;
      var dg = g - pg;
      var db = b - pb;
      var dist = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
        if (dist === 0) break;
      }
    }
    cache[key] = bestIndex;
    return bestIndex;
  }

  GifEncoder.prototype.render = function () {
    var palette = [];
    var colorMap = {};
    var p, c, key;

    // 1. Agregar paleta base definida (ej: paleta oficial Vuelapelucas 3000)
    if (this.palette && this.palette.length > 0) {
      for (p = 0; p < this.palette.length; p++) {
        c = this.palette[p];
        key = (c[0] << 16) | (c[1] << 8) | c[2];
        if (colorMap[key] === undefined && palette.length < 256) {
          colorMap[key] = palette.length;
          palette.push([c[0], c[1], c[2]]);
        }
      }
    }

    // 2. Muestrear colores adicionales presentes en los cuadros
    for (var f = 0; f < this.frames.length && palette.length < 256; f++) {
      var data = this.frames[f].data;
      var len = data.length;
      for (var i = 0; i < len && palette.length < 256; i += 4) {
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        key = (r << 16) | (g << 8) | b;
        if (colorMap[key] === undefined) {
          colorMap[key] = palette.length;
          palette.push([r, g, b]);
        }
      }
    }

    // 3. Ajustar tamaño de paleta a potencia de 2 (mínimo 4 = 2 bits, máximo 256 = 8 bits)
    var colorDepth = 2;
    while ((1 << colorDepth) < palette.length && colorDepth < 8) {
      colorDepth++;
    }
    var targetSize = 1 << colorDepth;
    while (palette.length < targetSize) {
      palette.push([0, 0, 0]);
    }

    var out = new ByteArray();

    // Cabecera GIF89a (6 bytes)
    out.writeByte(0x47); out.writeByte(0x49); out.writeByte(0x46);
    out.writeByte(0x38); out.writeByte(0x39); out.writeByte(0x61);

    // Descriptor de Pantalla Lógica (7 bytes)
    var w = this.width;
    var h = this.height;
    out.writeByte(w & 0xff); out.writeByte((w >> 8) & 0xff);
    out.writeByte(h & 0xff); out.writeByte((h >> 8) & 0xff);

    // Campos empaquetados: Tabla global de colores activa (0x80)
    var packed = 0x80 | ((colorDepth - 1) << 4) | (colorDepth - 1);
    out.writeByte(packed);
    out.writeByte(0); // Color de fondo (índice 0)
    out.writeByte(0); // Relación de aspecto de píxeles

    // Tabla Global de Colores (exactamente 3 * 2^colorDepth bytes)
    for (var pi = 0; pi < palette.length; pi++) {
      out.writeByte(palette[pi][0]);
      out.writeByte(palette[pi][1]);
      out.writeByte(palette[pi][2]);
    }

    // Extensión de Aplicación Netscape 2.0 (bucle infinito / repeticiones)
    if (this.repeat >= 0) {
      out.writeByte(0x21); out.writeByte(0xff); out.writeByte(0x0b);
      var app = "NETSCAPE2.0";
      for (var ai = 0; ai < app.length; ai++) {
        out.writeByte(app.charCodeAt(ai));
      }
      out.writeByte(0x03); out.writeByte(0x01);
      out.writeByte(this.repeat & 0xff); out.writeByte((this.repeat >> 8) & 0xff);
      out.writeByte(0x00);
    }

    var colorCache = {};
    var pixelCount = w * h;
    var indexedPixels = (typeof Uint8Array !== 'undefined') ? new Uint8Array(pixelCount) : new Array(pixelCount);

    // Codificación de cada cuadro
    for (var fi = 0; fi < this.frames.length; fi++) {
      var frame = this.frames[fi];
      var frameData = frame.data;
      var delay = frame.delay;

      // Extensión de Control Gráfico (8 bytes)
      out.writeByte(0x21); out.writeByte(0xf9); out.writeByte(0x04);
      out.writeByte(0x00); // Modo de disposición 0 (sin acción especial), sin transparencia
      out.writeByte(delay & 0xff); out.writeByte((delay >> 8) & 0xff);
      out.writeByte(0x00); // Índice transparente no usado
      out.writeByte(0x00); // Terminador de bloque

      // Descriptor de Imagen (10 bytes)
      out.writeByte(0x2c);
      out.writeByte(0); out.writeByte(0); // Left 0
      out.writeByte(0); out.writeByte(0); // Top 0
      out.writeByte(w & 0xff); out.writeByte((w >> 8) & 0xff);
      out.writeByte(h & 0xff); out.writeByte((h >> 8) & 0xff);
      out.writeByte(0x00); // Sin tabla local de color ni entrelazado

      // Mapear cada píxel a su color más cercano en la paleta
      for (var px = 0; px < pixelCount; px++) {
        var poff = px * 4;
        indexedPixels[px] = findClosestColor(
          frameData[poff],
          frameData[poff + 1],
          frameData[poff + 2],
          palette,
          colorCache
        );
      }

      // Compresión LZW estándar
      var lzw = new LZWEncoder(w, h, indexedPixels, colorDepth);
      lzw.encode(out);
    }

    // Trailer GIF (1 byte: ';')
    out.writeByte(0x3b);

    // Retorno compatible con navegadores modernos (Blob) y clásicos
    if (typeof Blob !== 'undefined') {
      var uintArr = (typeof Uint8Array !== 'undefined') ? new Uint8Array(out.bin) : out.bin;
      return new Blob([uintArr], { type: 'image/gif' });
    } else {
      var binary = '';
      for (var bIdx = 0; bIdx < out.bin.length; bIdx++) {
        binary += String.fromCharCode(out.bin[bIdx]);
      }
      return 'data:image/gif;base64,' + (typeof btoa !== 'undefined' ? btoa(binary) : '');
    }
  };

  global.GifEncoder = GifEncoder;
})(typeof window !== 'undefined' ? window : this);
