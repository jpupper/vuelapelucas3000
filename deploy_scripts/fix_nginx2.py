#!/usr/bin/env python3
import re

with open('/etc/nginx/sites-available/vps-4455523-x', 'r') as f:
    content = f.read()

# Remove ALL vuelapelucas blocks
content = re.sub(r'\s*# Vuelapelucas[^\n]*\n.*?location /vuelapelucas3000_2 \{.*?\n\s*\}', '', content, flags=re.DOTALL)
content = re.sub(r'\s*# Vuelapelucas[^\n]*\n', '', content)

# Find the HTTPS server block end
# It's the first '}' after 'listen 443 ssl;'
lines = content.split('\n')
in_https = False
brace_count = 0
https_end = None

for i, line in enumerate(lines):
    if 'listen 443 ssl;' in line:
        in_https = True
        brace_count = 0
        continue
    if in_https:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0:
            https_end = i
            break

print(f'HTTPS server ends at line {https_end + 1}')

# Insert before the closing brace
block = '''    # Vuelapelucas 3000 (puerto 4000)
    location /vuelapelucas3000_2 {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Cookie $http_cookie;
        client_max_body_size 100M;
        proxy_read_timeout 300s;
    }

'''

lines.insert(https_end, block)

with open('/etc/nginx/sites-available/vps-4455523-x', 'w') as f:
    f.write('\n'.join(lines))

print('Done')
