import re
t = open("work/dumpor.js", encoding="utf-8", errors="replace").read()
h = open("work/m_dumpor.html", encoding="utf-8", errors="replace").read()

print("=== strings tipo ruta en el JS ===")
routes = set(re.findall(r"[\"'`](/[a-zA-Z0-9_\-./{}:]{2,60})[\"'`]", t))
for r in sorted(routes):
    print("  ", r)
print("=== claves interesantes en JS ===")
for k in ["XMLHttpRequest", "axios", "graphql", "media", "shortcode", "edge", "instagram.com", "?__a", "loader", "turbo"]:
    print(f"  {k}: {t.count(k)}")
print("=== scripts en el HTML del perfil ===")
for m in re.finditer(r"<script[^>]*>", h):
    print("  ", m.group(0)[:160])
print("=== data-* / ids en HTML ===")
print(sorted(set(re.findall(r"data-[a-z0-9\-]+=", h)))[:25])
print(sorted(set(re.findall(r'id="([^"]{1,40})"', h)))[:40])
print("=== inline fetch/url ===")
print(re.findall(r"fetch\(\s*['\"]([^'\"]+)", h)[:10])
print(re.findall(r"['\"](/[a-z0-9\-/_]*(?:load|profile|media|post)[a-z0-9\-/_]*)['\"]", h)[:20])
