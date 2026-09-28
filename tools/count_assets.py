import os, collections
raw = "assetsraw"
c = collections.Counter(); bydir = collections.Counter()
photo = {".jpg", ".jpeg", ".heic", ".png", ".gif", ".webp"}
for dp, _, fns in os.walk(raw):
    for fn in fns:
        e = os.path.splitext(fn)[1].lower()
        c[e] += 1
        if e in photo:
            bydir[dp] += 1
print("ext:", dict(c))
for k, v in sorted(bydir.items()):
    print(f"{v:5d}  {k}")
print("total fotos:", sum(bydir.values()))
