import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={"width": 1440, "height": 1000}).new_page()
    pg.goto("http://127.0.0.1:8792/index.html", wait_until="load")
    pg.wait_for_timeout(4000)
    print(pg.evaluate("""() => {
      const sec = document.getElementById('festival');
      const cards = Array.from(document.querySelectorAll('.festival-card'));
      const grid = document.querySelector('.festival-grid');
      const out = {cards: cards.length, gridRect: grid && grid.getBoundingClientRect().toJSON(),
                   secRect: sec.getBoundingClientRect().toJSON(),
                   secStyle: {display:getComputedStyle(sec).display, vis:getComputedStyle(sec).visibility, op:getComputedStyle(sec).opacity, bg:getComputedStyle(sec).background.slice(0,60)}};
      out.cardsDetail = cards.map(c => ({h: c.offsetHeight, w: c.offsetWidth,
          disp: getComputedStyle(c).display, vis: getComputedStyle(c).visibility,
          op: getComputedStyle(c).opacity, bg: getComputedStyle(c).backgroundColor,
          rect: c.getBoundingClientRect().toJSON()}));
      out.cardImgs = Array.from(document.querySelectorAll('.card-photo')).map(i => ({src:i.getAttribute('src'), nw:i.naturalWidth, ch:i.clientHeight, dh:i.getAttribute('height')}));
      return out;
    }"""))
    b.close()
