"""Render brand exports from the SVG mark, bundled Jost fonts, and unchanged stock photos.
Optional asset utility: requires Python Playwright, FontTools and Brotli; no website build step.
"""
import shutil
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from xml.etree import ElementTree

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
NS = '{http://www.w3.org/2000/svg}'
NAVY, PAPER, GOLD = '#18283f', '#f8f5ee', '#cbb38e'


def outlined_text(value, filename, x, baseline, size, spacing):
    font = TTFont(ASSETS / 'fonts' / filename)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    paths = []
    for char in value:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        if pen.getCommands():
            paths.append(f'<path transform="translate({x:.3f} {baseline}) scale({scale:.6f} {-scale:.6f})" d="{pen.getCommands()}"/>')
        x += font['hmtx'][name][0] * scale + spacing
    font.close()
    return '\n'.join(paths), x


def write_lockups(mark):
    small, _ = outlined_text('MAISON DE', 'jost-latin-400-normal.woff2', 110, 30, 11, 3.2)
    name, right = outlined_text('GABY', 'jost-latin-500-normal.woff2', 108, 78, 52, 4)
    width = round(right + 13)
    for filename, foreground in [('logo.svg', NAVY), ('logo-light.svg', PAPER)]:
        source = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 100" role="img" aria-label="Maison de Gaby">
  <title>Maison de Gaby</title>
  <!-- Letterforms outlined from bundled Jost; see fonts/jost-LICENSE.txt. -->
  <path fill="{foreground}" d="{mark}"/>
  <g fill="{foreground}">{small}</g>
  <g fill="{foreground}">{name}</g>
</svg>
'''
        (ASSETS / filename).write_text(source)
    dimensions = {'logo': (width, 100), 'logo-light': (width, 100)}
    small, small_width = outlined_text('MAISON DE', 'jost-latin-400-normal.woff2', 0, 224, 16, 4.8)
    name, name_width = outlined_text('GABY', 'jost-latin-500-normal.woff2', 0, 286, 64, 3)
    for filename, foreground in [('logo-stacked', NAVY), ('logo-stacked-light', PAPER)]:
        source = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 310" role="img" aria-label="Maison de Gaby">
  <title>Maison de Gaby — Precision G</title>
  <!-- Letterforms outlined from bundled Jost; see fonts/jost-LICENSE.txt. -->
  <g fill="{foreground}">
    <path transform="translate(20 0) scale(2)" d="{mark}"/>
    <g transform="translate({(240 - small_width + 4.8) / 2:.3f} 0)">{small}</g>
    <g transform="translate({(240 - name_width + 3) / 2:.3f} 0)">{name}</g>
  </g>
</svg>
'''
        (ASSETS / (filename + '.svg')).write_text(source)
        dimensions[filename] = (240, 310)
    return dimensions


def write_mark_variants(mark):
    (ASSETS / 'mark-light.svg').write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Maison de Gaby">
  <title>Maison de Gaby — Precision G</title>
  <path fill="{PAPER}" d="{mark}"/>
</svg>
''')
    (ASSETS / 'favicon-g.svg').write_text(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Maison de Gaby">
  <title>Maison de Gaby — Precision G</title>
  <rect width="100" height="100" rx="24" fill="{NAVY}"/>
  <path fill="{PAPER}" d="{mark}"/>
</svg>
''')


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def render():
    mark = ElementTree.parse(ASSETS / 'mark.svg').getroot().find(NS + 'path').attrib['d']
    write_mark_variants(mark)
    dimensions = write_lockups(mark)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'public')))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = 'http://127.0.0.1:' + str(server.server_port)
    try:
        with sync_playwright() as playwright:
            executable = shutil.which('chromium')
            browser = playwright.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
            page = browser.new_page(device_scale_factor=1)
            page.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base + '/') else route.abort())
            page.goto(base + '/404.html')
            for size, filename in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
                page.set_viewport_size({'width': size, 'height': size})
                page.set_content(f'''<!doctype html><html><body style="margin:0;background:{NAVY}">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{size}" height="{size}" style="display:block">
<rect width="100" height="100" fill="{NAVY}"/>
<g transform="translate(6 6) scale(.88)"><path fill="{PAPER}" d="{mark}"/></g></svg></body></html>''')
                page.screenshot(path=str(ASSETS / filename))
            for filename, (source_width, source_height) in dimensions.items():
                width, height = 1200, round(1200 * source_height / source_width)
                page.set_viewport_size({'width': width, 'height': height})
                page.set_content(f'''<!doctype html><html><body style="margin:0;background:transparent">
<img src="{base}/assets/{filename}.svg" width="{width}" height="{height}" style="display:block" alt="Maison de Gaby"></body></html>''')
                page.wait_for_function('document.images[0].complete && document.images[0].naturalWidth>0')
                page.screenshot(path=str(ASSETS / (filename + '.png')), omit_background=True)
            page.set_viewport_size({'width': 1200, 'height': 630})
            page.set_content(f'''<!doctype html><html><head><style>
@font-face{{font-family:Jost;src:url('{base}/assets/fonts/jost-latin-400-normal.woff2')}}
@font-face{{font-family:Jost;src:url('{base}/assets/fonts/jost-latin-500-normal.woff2');font-weight:500}}
@font-face{{font-family:Cormorant;src:url('{base}/assets/fonts/cormorant-garamond-latin-400-italic.woff2');font-style:italic}}
*{{box-sizing:border-box}}body{{margin:0;width:1200px;height:630px;background:{PAPER};color:{NAVY}}}
body::before{{content:'';position:absolute;left:35px;top:30px;bottom:30px;width:1px;background:#cbb38e66}}
.brand{{position:absolute;left:64px;top:24px;width:204px;height:74px;object-fit:contain;object-position:left center}}
.edition{{position:absolute;right:64px;top:55px;font:400 10px Jost,sans-serif;letter-spacing:2.5px}}
.rule{{position:absolute;left:64px;right:64px;top:111px;height:1px;background:#18283f26}}
.eyebrow{{position:absolute;top:132px;left:0;right:0;text-align:center;color:#7d694a;font:400 9px Jost,sans-serif;letter-spacing:2px}}
.message{{position:absolute;left:0;right:0;top:156px;margin:0;text-align:center;font:400 52px/1.05 Jost,sans-serif;letter-spacing:-2.3px}}
.message em{{font:italic 64px/1.06 Cormorant,Georgia,serif;letter-spacing:-1.2px}}
.photo{{position:absolute;overflow:hidden;background:#e6dece}}
.photo img{{width:100%;height:100%;object-fit:cover}}
.cinnamon{{left:97px;top:347px;width:275px;height:205px}}
.cinnamon img{{object-position:48% 55%}}
.carrot{{left:400px;top:306px;width:400px;height:280px;border-radius:2px 48px 2px 2px}}
.carrot img{{object-position:50% 50%}}
.milk{{left:828px;top:329px;width:275px;height:205px}}
.milk img{{object-position:55% 50%}}
.location{{position:absolute;left:0;right:0;bottom:17px;text-align:center;color:#7d694a;font:400 9px Jost,sans-serif;letter-spacing:2.5px}}
</style></head><body>
<img class="brand" src="{base}/assets/logo.svg" alt="Maison de Gaby">
<div class="edition">AN INDEPENDENT PATISSERIE</div><div class="rule"></div>
<div class="eyebrow">FRENCH INSPIRED. CAIRO AT HEART.</div>
<h1 class="message">Little rituals.<br><em>Beautifully made.</em></h1>
<div class="photo cinnamon"><img src="{base}/assets/photos/cinnamon-kisses.jpg" alt=""></div>
<div class="photo carrot"><img src="{base}/assets/photos/carrot-cake.jpg" alt=""></div>
<div class="photo milk"><img src="{base}/assets/photos/milk-cloud.jpg" alt=""></div>
<div class="location">HELIOPOLIS · CAIRO</div></body></html>''')
            page.evaluate('document.fonts.ready')
            page.wait_for_function('Array.from(document.images).every(image=>image.complete && image.naturalWidth>0)')
            page.screenshot(path=str(ASSETS / 'og.jpg'), type='jpeg', quality=92)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print('Rendered Precision G variants, outlined SVG/transparent PNG lockups, app icons and link preview.')


if __name__ == '__main__':
    render()
