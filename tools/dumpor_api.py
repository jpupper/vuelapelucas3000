import re, sys
from curl_cffi import requests

IMP = "chrome"
BASE = "https://dumpor.io"

s = requests.Session(impersonate=IMP, headers={
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    "Referer": BASE + "/v/vuelapelucas3000",
})

# 1) JS bundle
js_url = sys.argv[1] if len(sys.argv) > 1 else BASE + "/assets/inst2-a2de3c005eca4fe7097aec7f42c4cb77.js?vsn=d"
r = s.get(js_url, timeout=40)
print("bundle:", r.status_code, len(r.text))
t = r.text
open("work/dumpor.js", "w", encoding="utf-8").write(t)

eps = set()
for p in [r"[\"'`](/[a-zA-Z0-9_\-/]*(?:api|json|graphql)[a-zA-Z0-9_\-/]*)",
          r"fetch\(\s*[\"'`]([^\"'`]+)",
          r"[\"'`](/v/[a-zA-Z0-9_\-/]+)",
          r"url:\s*[\"'`]([^\"'`]+)"]:
    eps.update(re.findall(p, t))
print("candidatos:")
for e in sorted(eps)[:60]:
    print("   ", e[:120])
