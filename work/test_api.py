
import base64, io, json, urllib.request
from PIL import Image, ImageDraw

# PNG de prueba: 256x256 pixel art (nave simple)
im = Image.new("RGB", (256, 256), (0, 0, 0))
d = ImageDraw.Draw(im)
d.polygon([(128, 40), (200, 200), (128, 160), (56, 200)], fill=(255, 214, 44))
d.rectangle([110, 160, 146, 200], fill=(239, 71, 32))
buf = io.BytesIO(); im.save(buf, "PNG")
b64 = base64.b64encode(buf.getvalue()).decode()

payload = json.dumps({"nombre": "TEST nave de prueba", "autor": "@jpupper_test", "escala": 2,
                      "image": "data:image/png;base64," + b64}).encode()
req = urllib.request.Request("https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api/artworks",
                            data=payload, headers={"Content-Type": "application/json", "Origin": "https://fullscreencode.com"})
try:
    r = urllib.request.urlopen(req, timeout=60)
    print("POST", r.status, r.read().decode()[:300])
except urllib.error.HTTPError as e:
    print("POST ERR", e.code, e.read().decode()[:300])

lst = json.loads(urllib.request.urlopen("https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api/artworks", timeout=60).read())
print("LISTA", lst["count"], json.dumps(lst["artworks"][:1], ensure_ascii=False))
if lst["artworks"]:
    iid = lst["artworks"][0]["id"]
    u = "https://vps-4455523-x.dattaweb.com/vuelapelucas3000_2/api/artworks/" + iid + "/img"
    r2 = urllib.request.urlopen(u, timeout=60)
    print("IMG", r2.status, r2.headers.get("Content-Type"), len(r2.read()), "bytes")
    print("TESTID=" + iid)
