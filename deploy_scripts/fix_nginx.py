#!/usr/bin/env python3
import re

with open('/etc/nginx/sites-available/vps-4455523-x', 'r') as f:
    content = f.read()

# Remove broken block
content = re.sub(r'\s*# Vuelapelucas[^\n]*\n.*?location /vuelapelucas3000_2 \{.*?\n\s*\}', '', content, flags=re.DOTALL)
content = re.sub(r'\s*# Vuelapelucas[^\n]*\n', '', content)

# Insert before first server closing brace
lines = content.split('\n')
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

new_lines = []
in_server = False
brace_count = 0
inserted = False

for line in lines:
    if 'server {' in line and not in_server:
        in_server = True
        brace_count = 1
        new_lines.append(line)
        continue
    
    if in_server:
        brace_count += line.count('{') - line.count('}')
        if brace_count <= 0 and not inserted:
            new_lines.append(block)
            inserted = True
        new_lines.append(line)
    else:
        new_lines.append(line)

with open('/etc/nginx/sites-available/vps-4455523-x', 'w') as f:
    f.write('\n'.join(new_lines))

print('Done')
