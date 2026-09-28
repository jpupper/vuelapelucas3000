import re, sys, collections, os
p = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ig.html"
if not os.path.exists(p):
    p = os.path.expandvars(r"%LOCALAPPDATA%\Temp\ig.html")
h = open(p, encoding="utf-8", errors="replace").read()
print("size", len(h))
sc = re.findall(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)", h)
print("shortcodes:", len(sc), collections.Counter(sc).most_common(5))
cdn = re.findall(r"https://[A-Za-z0-9.\-]*cdninstagram\.com/[^\"'\\ ]{0,120}", h)
print("cdn urls:", len(cdn))
for u in cdn[:5]:
    print("  ", u[:140])
for k in ["follower_count", "media_count", "edge_owner_to_timeline_media", "image_versions2", "LoginAndSignup", "require_login"]:
    print(k, h.count(k))
