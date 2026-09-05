#!/usr/bin/env python3
"""Generate the PWA icons — a five-bar histogram in the series blue, drawn as
PNG with no imaging library. Same trick as the options series: signature,
IHDR, a zlib'd IDAT of filter-0 scanlines, IEND.

The mark is deliberately not the options ring. These are sibling series and
they will sit next to each other on a home screen; the icons have to be
distinguishable at sixty pixels.

    python mkicons.py        writes icons/*.png
"""
import zlib, struct, math, os

CHALK = (0xED, 0xF0, 0xEC)
BLUE = (0x1F, 0x4C, 0xE8)


def png(path, w, h, pixels):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw += bytes(pixels[y * w + x])

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    out += chunk(b"IEND", b"")
    open(path, "wb").write(out)
    return len(out)


def draw(size, inset, bg=CHALK, fg=BLUE):
    """Five bars whose heights follow a normal curve, sitting on a baseline.
       `inset` is the fraction of the canvas the art occupies — smaller for the
       maskable variants so Android's circular crop cannot bite the bars."""
    px = [bg] * (size * size)
    art = size * inset
    x0 = (size - art) / 2.0
    y1 = (size + art) / 2.0
    n = 5
    gap = art / 22.0
    bw = (art - gap * (n - 1)) / n
    hs = [math.exp(-0.5 * ((i - (n - 1) / 2.0) / 1.05) ** 2) for i in range(n)]
    hs = [0.16 + 0.84 * v for v in hs]
    bounds = []
    for i in range(n):
        bx0 = x0 + i * (bw + gap)
        bounds.append((bx0, bx0 + bw, y1 - hs[i] * art, y1))
    ss = 3
    for y in range(size):
        for x in range(size):
            hits = 0
            for sy in range(ss):
                for sx in range(ss):
                    fx = x + (sx + 0.5) / ss
                    fy = y + (sy + 0.5) / ss
                    for (a0, a1, b0, b1) in bounds:
                        if a0 <= fx <= a1 and b0 <= fy <= b1:
                            hits += 1
                            break
            if hits:
                a = hits / float(ss * ss)
                px[y * size + x] = tuple(
                    int(round(bg[i] * (1 - a) + fg[i] * a)) for i in range(3))
    return px


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "icons")
    os.makedirs(out, exist_ok=True)
    for name, size, inset in [
        ("icon-192.png", 192, 0.72),
        ("icon-512.png", 512, 0.72),
        ("maskable-192.png", 192, 0.52),
        ("maskable-512.png", 512, 0.52),
        ("apple-touch-icon.png", 180, 0.72),
    ]:
        n = png(os.path.join(out, name), size, size, draw(size, inset))
        print("  %-24s %4dx%-4d %6d bytes" % (name, size, size, n))
    print("icons/ written")
