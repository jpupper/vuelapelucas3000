import re, sys
h = open(sys.argv[1], encoding="utf-8", errors="replace").read()
pats = [r"fetch\s*\(\s*['\"]([^'\"]+)", r"url\s*:\s*['\"]([^'\"]+)", r"axios\.[a-z]+\(\s*['\"]([^'\"]+)",
        r"['\"](/[a-z0-9\-/_]*api[a-z0-9\-/_]*)['\"]", r"XMLHttpRequest[\s\S]{0,200}?open\(\s*['\"][A-Z]+['\"]\s*,\s*['\"]([^'\"]+)"]
found = []
for p in pats:
    found += re.findall(p, h)
print("endpoints:", sorted(set(found))[:30])
for m in re.finditer(r"<script[^>]*src=[\"']([^\"']+)", h):
    print("script:", m.group(1))
print("--- data- attrs sample ---")
print(re.findall(r"data-[a-z\-]+=\"[^\"]{0,60}\"", h)[:15])
print("--- shortcode-ish ---")
print(sorted(set(re.findall(r"[A-Za-z0-9_-]{11}", h)))[:10])
