import json, urllib.request, re, os, sys

envp = '/root/vuelapelucas3000/.env'
pw = None
with open(envp) as f:
    for line in f:
        if line.startswith('ADMIN_PASS='):
            pw = line.strip().split('=', 1)[1]
if not pw:
    sys.exit('no ADMIN_PASS')

base = 'http://localhost:4000/vuelapelucas3000_2/api/inscripciones?pass=' + urllib.parse.quote(pw)
data = json.load(urllib.request.urlopen(base))
test_ids = [i['_id'] for i in data['inscripciones'] if str(i.get('email', '')).endswith('@test.com')]
print('total:', data['count'], '| filas de prueba a borrar:', len(test_ids))
for tid in test_ids:
    req = urllib.request.Request(
        'http://localhost:4000/vuelapelucas3000_2/api/inscripciones/' + tid + '?pass=' + urllib.parse.quote(pw),
        method='DELETE')
    print('  delete', tid, urllib.request.urlopen(req).status)

left = json.load(urllib.request.urlopen(base))
print('quedan:', left['count'])
for i in left['inscripciones']:
    print('  ', i.get('nombre'), i.get('apellido'), '|', i.get('rol'), '|', i.get('hospedaje'))
