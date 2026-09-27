# Why `$` Nginx Variables Get Stripped During SSH Edits

## The Problem

When you edit Nginx config files via SSH using inline Python or shell heredocs, Nginx variables like `$http_upgrade`, `$host`, `$remote_addr`, etc. get stripped, resulting in:

```nginx
proxy_set_header Upgrade ;  # missing $http_upgrade
proxy_set_header Host ;     # missing $host
```

This produces **502 Bad Gateway** because the proxy headers are broken.

## Why It Happens

Bash interprets `$variables` in double-quoted strings and heredocs. When you do:

```bash
ssh server "python3 << 'PYEOF'
content = '''
proxy_set_header Upgrade $http_upgrade;
'''
with open('file', 'w') as f:
    f.write(content)
PYEOF
"
```

Even though `'PYEOF'` is single-quoted (preventing shell expansion), some shells still interpret the content. The safer approach is triple-escaping: `\\\$http_upgrade`, but this breaks Python string syntax.

## The Solution: File-based editing

1. **Write the script locally** as a `.py` file
2. **SCP it** to the VPS
3. **Run it** with `python3 /tmp/script.py`

This avoids all shell interpretation layers.

### Example script template

```python
# fix_nginx.py — place this file locally, then SCP to server
with open('/etc/nginx/sites-available/FILENAME', 'r') as f:
    lines = f.readlines()

# Find insertion point (after ssl_dhparam line)
for i, line in enumerate(lines):
    if 'ssl_dhparam' in line:
        insert_at = i + 1
        break

# Block to insert (use single quotes inside to avoid Python escape issues)
block = """    # App Name (puerto PORT)
    location /app-prefix {
        proxy_pass http://localhost:PORT;
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

"""

lines.insert(insert_at, block)

with open('/etc/nginx/sites-available/FILENAME', 'w') as f:
    f.writelines(lines)
```

### Commands to run

```bash
scp -P PORT -i KEY fix_nginx.py root@SERVER:/tmp/
ssh -p PORT root@SERVER "python3 /tmp/fix_nginx.py && nginx -t && nginx -s reload"
```

## Alternative: Use `nano`

For quick one-off edits, use `nano` interactively via SSH — it writes the file directly without any shell interpretation:

```bash
ssh -p PORT root@SERVER
nano /etc/nginx/sites-available/FILENAME
# ... make edits ...
# Ctrl+O to save, Ctrl+X to exit
nginx -t && nginx -s reload
```

## Summary

| Method | Risk | Recommendation |
|--------|------|----------------|
| `python3 << 'PYEOF'` | HIGH — shell may strip `$` | Avoid |
| `sed -i` | HIGH — regex escape hell | Avoid |
| File-based Python script | LOW — no shell interpretation | **Recommended** |
| `nano` interactive | LOWEST — direct file write | **Recommended** for simple edits |
