import json, re, sys
h = open("work/ig_profile.html", encoding="utf-8", errors="replace").read()
print("len", len(h))
for k in ["PolarisProfilePosts", "doc_id", "query_hash", "x-fb-lsd", "lsd", "PolarisProfilePostsQuery", "feed__user_timeline"]:
    print(f"  {k}: {h.count(k)}")
print("--- contexto doc_id ---")
for m in list(re.finditer(r".{90}doc_id.{120}", h))[:4]:
    print("   ", m.group(0).replace("\\n", " ")[:260])
print("--- page_info ---")
for m in list(re.finditer(r".{60}(end_cursor|has_next_page).{140}", h))[:4]:
    print("   ", m.group(0)[:260])
print("--- lsd ---")
print(re.findall(r'"LSD",\[\],\{"token":"([^"]+)"', h)[:2], re.findall(r'"lsd":"([^"]+)"', h)[:2])
print("--- scripts application/json ---")
for m in re.finditer(r'<script type="application/json"[^>]*>', h):
    print("   ", m.group(0)[:120])
