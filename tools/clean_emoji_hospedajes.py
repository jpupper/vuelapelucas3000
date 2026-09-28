import io, re, sys

p = "public/hospedajes.html"
s = io.open(p, encoding="utf-8").read()

# iconos de categoria -> imagenes relevantes
s = s.replace('<span class="category-icon">🏕️</span>',
              '<img class="category-icon-img" src="img/ico-camping.jpg" alt="Zonas de acampada">')
s = s.replace('<span class="category-icon">🏨</span>',
              '<img class="category-icon-img" src="img/ico-alojamiento.jpg" alt="Hoteles y aparts">')
s = s.replace('<span class="category-icon">🏡</span>',
              '<img class="category-icon-img" src="img/ico-feria.jpg" alt="Cabanas y posadas">')
s = s.replace('<span class="cta-badge">📍 VICTORICA, LA PAMPA</span>',
              '<span class="cta-badge"><img class="img-bullet" src="img/ico-lugar.jpg" alt=""> VICTORICA, LA PAMPA</span>')
# direcciones: pin por imagen chica
s = s.replace('<p class="address">📍 ', '<p class="address"><img class="ico-mini" src="img/ico-lugar.jpg" alt="Direccion"> ')
# telefono: sin emoji (el estilo .phone ya lo destaca)
s = s.replace('class="phone">📞 ', 'class="phone">')
io.open(p, "w", encoding="utf-8", newline="").write(s)

left = re.findall(r"[\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]", s)
print("hospedajes.html emojis restantes:", left)
