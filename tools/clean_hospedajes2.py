import io, re

FOOTER = '''                <div class="footer-social">
                    <a href="https://www.instagram.com/vuelapelucas3000/" target="_blank" rel="noopener">
                        <img src="img/ico-comunidad.jpg" alt="Instagram Vuelapelucas 3000"> Instagram
                    </a>
                    <a href="https://chat.whatsapp.com/CDzwewC5EdQHqiC5IqmpGL" target="_blank" rel="noopener">
                        <img src="img/ico-feria.jpg" alt="Grupo de WhatsApp"> Grupo de WhatsApp
                    </a>
                    <a href="https://fullscreencode.com/jpupper/nftsapps/pampam/" target="_blank" rel="noopener">
                        <img src="img/ico-juego.jpg" alt="Juegos Pampam"> Juegos
                    </a>
                </div>'''

OLD_FOOTER_START = '                <div class="footer-social">'

p = "public/hospedajes.html"
s = io.open(p, encoding="utf-8").read()

# badge del CTA -> imagen
s = s.replace('<span class="cta-badge">\U0001F39F\uFE0F \u00bfTODAV\u00cdA NO TE ANOTASTE?</span>',
              '<span class="cta-badge"><img class="img-bullet" src="img/ico-nave.jpg" alt=""> '
              '\u00bfTODAV\u00cdA NO TE ANOTASTE?</span>')

# footer social -> imagenes
i = s.index(OLD_FOOTER_START)
j = s.index('</div>', s.index('Juegos</a>', i)) + len('</div>')
s = s[:i] + FOOTER + s[j:]

# boton flotante -> imagen
s = re.sub(r'<svg viewBox="0 0 24 24" aria-hidden="true">.*?</svg>',
           '<img src="img/ico-comunidad.jpg" alt="">', s, flags=re.S)

io.open(p, "w", encoding="utf-8", newline="").write(s)
print("emojis restantes:", re.findall(r"[\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]", s))
print("svg restantes:", s.count("<svg"))
