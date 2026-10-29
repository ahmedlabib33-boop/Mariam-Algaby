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
*{{box-sizing:border-box}}body{{margin:0;width:1200px;height:630px;background:{NAVY};color:{PAPER}}}
.brand{{position:absolute;left:58px;top:67px;width:480px;height:170px;object-fit:contain;object-position:left center}}
.message{{position:absolute;left:70px;top:348px;margin:0;font:italic 34px/1.3 Cormorant,Georgia,serif}}
.location{{position:absolute;left:70px;right:670px;bottom:98px;padding-top:24px;border-top:1px solid #cbb38e66;color:{GOLD};font:400 10px Jost,sans-serif;letter-spacing:3.8px}}
.art{{position:absolute;left:600px;top:0;width:600px;height:630px;background:{PAPER}}}
.arch{{position:absolute;left:54px;top:54px;width:430px;height:576px;border-radius:230px 230px 0 0;overflow:hidden}}
.arch::after{{content:'';position:absolute;inset:0;border:1px solid #cbb38e55;border-radius:inherit}}
.arch img{{width:100%;height:100%;object-fit:cover;object-position:57% center}}
.inset{{position:absolute;right:38px;bottom:38px;width:178px;height:178px;border-radius:50%;border:6px solid {PAPER};object-fit:cover}}
</style></head><body>
<img class="brand" src="{base}/assets/logo-light.svg" alt="Maison de Gaby">
<p class="message">Desserts worth the wait.</p><div class="location">PATISSERIE · HELIOPOLIS · CAIRO</div>
<div class="art"><div class="arch"><img src="{base}/assets/photos/milk-cloud.jpg" alt=""></div>
<img class="inset" src="{base}/assets/photos/cinnamon-kisses.jpg" alt=""></div></body></html>''')
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
