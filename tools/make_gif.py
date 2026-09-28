"""Genera un GIF a partir de un video, recortando SOLO las personas.

Pipeline:
  1. ffmpeg extrae frames (rotacion aplicada, escalados a --width)
  2. rembg (u2net_human_seg) segmenta personas y elimina el fondo
  3. composita sobre el fondo elegido (dark | transparent)
  4. quantiza con paleta GLOBAL (evita flicker) y escribe el .GIF

Uso:
  python tools/make_gif.py --in video.MOV --out public/img/vuela-cutout.gif \
      --width 480 --fps 12 --mode dark
"""
import argparse
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def extract(src, dst, width, fps, start=None, dur=None):
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):
        os.remove(os.path.join(dst, f))
    vf = f"fps={fps},scale={width}:-2"
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if start is not None:
        cmd += ["-ss", str(start)]
    cmd += ["-i", src]
    if dur is not None:
        cmd += ["-t", str(dur)]
    cmd += ["-vf", vf, "-fps_mode", "cfr", os.path.join(dst, "f%04d.png")]
    subprocess.run(cmd, check=True)
    return sorted(os.listdir(dst))


def segment(frames_dir, frames, mode, bg=(11, 11, 20)):
    """Devuelve frames RGBA con SOLO las personas (fondo eliminado).

    En modo 'dark' se composita sobre un fondo solido; en 'transparent' se
    conserva el alfa (binarizado) para que se vea el fondo de la pagina.
    """
    from rembg import remove, new_session
    sess = new_session("u2net_human_seg")
    outs = []
    for i, fn in enumerate(frames, 1):
        p = os.path.join(frames_dir, fn)
        im = Image.open(p).convert("RGB")
        cut = remove(im, session=sess, alpha_matting=False, post_process_mask=True)
        cut.putalpha(cut.getchannel("A").point(lambda v: 255 if v >= 110 else 0))
        outs.append(cut)
        if i % 10 == 0 or i == len(frames):
            print(f"  segmentados {i}/{len(frames)}", flush=True)
    outs = autocrop(outs, margin=12)
    if mode == "dark":
        comp = []
        for cut in outs:
            bgim = Image.new("RGB", cut.size, bg)
            bgim.paste(cut, (0, 0), cut)
            comp.append(bgim)
        return comp
    return outs


def autocrop(frames, margin=10):
    """Recorta todos los frames al bounding-box union de las personas."""
    from PIL import ImageChops
    if frames[0].mode != "RGBA":
        return frames
    box = None
    for f in frames:
        bb = ImageChops.difference(f.getchannel("A"), Image.new("L", f.size, 0)).getbbox()
        if not bb:
            continue
        box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]),
                                      max(box[2], bb[2]), max(box[3], bb[3]))
    if not box:
        return frames
    x0 = max(0, box[0] - margin); y0 = max(0, box[1] - margin)
    x1 = min(frames[0].size[0], box[2] + margin); y1 = min(frames[0].size[1], box[3] + margin)
    if (x1 - x0) < 32 or (y1 - y0) < 32:
        return frames
    return [f.crop((x0, y0, x1, y1)) for f in frames]


def global_palette(frames, colors=255):
    """Paleta unica a partir de un mosaico de frames -> sin parpadeo."""
    step = max(1, len(frames) // 12)
    sample = [f.convert("RGB") for f in frames[::step]][:12]
    w, h = sample[0].size
    tw, th = max(1, w // 3), max(1, h // 3)
    mosaic = Image.new("RGB", (tw * 4, th * 3))
    for i, s in enumerate(sample[:12]):
        mosaic.paste(s.resize((tw, th), Image.LANCZOS), ((i % 4) * tw, (i // 4) * th))
    return mosaic.quantize(colors=colors, method=Image.MEDIANCUT)


def write_gif(frames, out, fps, pal):
    quant = []
    for i, f in enumerate(frames):
        if f.mode == "RGBA":
            q = f.convert("RGB").quantize(palette=pal, dither=Image.FLOYDSTEINBERG)
            mask = f.getchannel("A").point(lambda v: 0 if v < 110 else 255)
            q.paste(255, mask=mask.point(lambda v: 255 - v))
            q.info["transparency"] = 255
        else:
            q = f.quantize(palette=pal, dither=Image.FLOYDSTEINBERG)
        quant.append(q)
    quant[0].save(out, save_all=True, append_images=quant[1:], loop=0,
                  duration=int(round(1000 / fps)), disposal=2, optimize=True)
    return os.path.getsize(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--width", type=int, default=480)
    ap.add_argument("--fps", type=int, default=12)
    ap.add_argument("--mode", choices=["dark", "transparent"], default="dark")
    ap.add_argument("--colors", type=int, default=255)
    ap.add_argument("--crop", choices=["auto", "none"], default="auto")
    ap.add_argument("--start", type=float, default=None, help="segundo inicial")
    ap.add_argument("--dur", type=float, default=None, help="duracion en segundos")
    ap.add_argument("--keep", action="store_true", help="no borrar la carpeta de frames")
    a = ap.parse_args()

    FRAMES = os.path.join(ROOT, "work", "gif", "frames")
    print(f"1) extrayendo frames de {a.src} ...", flush=True)
    frames = extract(a.src, FRAMES, a.width, a.fps, a.start, a.dur)
    print(f"   {len(frames)} frames", flush=True)
    print("2) segmentando personas (rembg u2net_human_seg) ...", flush=True)
    imgs = segment(FRAMES, frames, a.mode)
    if a.crop == "none" and imgs[0].mode == "RGBA":
        pass
    print(f"   recorte: {imgs[0].size[0]}x{imgs[0].size[1]}", flush=True)
    print("3) paleta global ...", flush=True)
    pal = global_palette(imgs, a.colors)
    print("4) escribiendo GIF ...", flush=True)
    out = a.out if os.path.isabs(a.out) else os.path.join(ROOT, a.out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    size = write_gif(imgs, out, a.fps, pal)
    print(f"LISTO {out}  {size/1e6:.2f} MB  {len(imgs)} frames  {imgs[0].size[0]}x{imgs[0].size[1]}")
    if not a.keep:
        shutil.rmtree(FRAMES, ignore_errors=True)
