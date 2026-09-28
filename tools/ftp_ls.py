import ftplib, sys

HOST = "c1700065.ferozo.com"
USER = "c1700065"
PASS = "Sarosa2026*Sarosa2026*"

paths = sys.argv[1:] or ["/public_html/jpupper/nftsapps"]
ftp = ftplib.FTP_TLS(HOST, timeout=40)
ftp.login(USER, PASS)
ftp.prot_p()
for p in paths:
    print("===", p)
    try:
        lines = []
        ftp.retrlines(f"LIST {p}", lines.append)
        for l in lines:
            print("  ", l)
    except Exception as e:
        print("   ERR", e)
ftp.quit()
