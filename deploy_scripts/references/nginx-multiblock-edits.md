# Safe Recipe for Editing Nginx Files with Multiple Server Blocks

Files like `/etc/nginx/sites-available/vps-4455523-x` often contain **two** server blocks in one file:

1. **HTTP server** (port 80) — handles redirects (`return 301 https://...`)
2. **HTTPS server** (port 443) — handles the actual proxy logic

The HTTPS server is typically at the **end** of the file.

## The Problem

When you add a new `location` block, it's easy to accidentally place it:
- Inside the HTTP server (proxy never triggers)
- Between the two servers (syntax error)
- After the closing brace of the HTTPS server (ignored)

All of these result in **502 Bad Gateway** because the location block either doesn't exist in the right server context or has broken variables.

## Safe Edit Procedure

### Step 1: Identify which server block is which

```bash
grep -n 'server {\|listen 443\|listen 80\|return 301\|return 404' /etc/nginx/sites-available/vps-4455523-x
```

The second `server {` block with `listen 80;` and `return 404;` is the HTTP-to-HTTPS redirect.
The first `server {` block with `listen 443 ssl;` is the HTTPS server you need to edit.

### Step 2: Find the exact line numbers

```bash
grep -n 'ssl_dhparam' /etc/nginx/sites-available/vps-4455523-x
```

This line is inside the HTTPS server, before its closing `}`. You need to insert your `location` block **after** `ssl_dhparam` and **before** the closing `}` of that same server.

### Step 3: Write a Python script to a file

Do NOT edit the config inline via SSH heredoc — shell escaping will strip `$` variables.

Create the script locally:

```python
# fix_nginx.py
with open('/etc/nginx/sites-available/vps-4455523-x', 'r') as f:
    lines = f.readlines()

# Find the ssl_dhparam line
for i, line in enumerate(lines):
    if 'ssl_dhparam' in line:
        insert_at = i + 1
        break

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

lines.insert(insert_at, block)

with open('/etc/nginx/sites-available/vps-4455523-x', 'w') as f:
    f.writelines(lines)
```

### Step 4: SCP the script and run it

```bash
scp -P $VPS_PORT -i ~/.ssh/id_rsa fix_nginx.py $VPS_USER@$VPS_HOST:/tmp/
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST "python3 /tmp/fix_nginx.py && nginx -t && nginx -s reload"
```

### Step 5: Verify

```bash
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST "grep -A 15 'location /vuelapelucas3000_2' /etc/nginx/sites-available/vps-4455523-x"
```

Check that the variables (`$http_upgrade`, `$host`, etc.) are preserved — they should NOT be empty.

## Common Mistakes

| Mistake | Result |
|---------|--------|
| Inserting into HTTP server | 502 Bad Gateway — request goes to redirect server |
| Using `python3 << 'PYEOF'` via SSH | `$` variables get stripped by shell |
| Using `sed -i` | Regex escape issues, broken syntax |
| Inserting after closing `}` | Location ignored by Nginx |
| Forgetting `nginx -t` | Nginx refuses to reload, site goes down |

## Alternative: Use `nano` interactively

If Python scripting feels risky, SSH into the VPS and use `nano`:

```bash
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST
nano /etc/nginx/sites-available/vps-4455523-x
```

Navigate to the HTTPS server, find `ssl_dhparam`, insert the location block after it, save with `Ctrl+O`, exit with `Ctrl+X`, then:

```bash
nginx -t && nginx -s reload
```

This avoids all shell escaping issues entirely.
