"""Customer menu checks using local fixture APIs; WhatsApp opens are intercepted."""
import copy
import json
import shutil
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MENU = json.loads((ROOT / 'public/data/menu.json').read_text())
CART_KEY = 'maison-mariam-box'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def check_menu():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'public')))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    base = 'http://127.0.0.1:' + str(server.server_port)
    errors = []
    try:
        with sync_playwright() as playwright:
            executable = shutil.which('chromium')
            browser = playwright.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1440, 'height': 1000}, timezone_id='Africa/Cairo', reduced_motion='reduce')
            page = context.new_page()
            page.set_default_timeout(8000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.add_init_script('window.open=(...args)=>{window.__opened=args;return null;};')
            fixture = {'menu': copy.deepcopy(MENU), 'status': 200}

            def route(request):
                if urlparse(request.request.url).path == '/api/menu':
                    request.fulfill(status=fixture['status'], json=fixture['menu'])
                elif request.request.url.startswith(base):
                    request.continue_()
                else:
                    request.abort()

            page.route('**/*', route)
            page.goto(base)
            expect(page.locator('#menuGrid .dish')).to_have_count(len(MENU['items']))
            for item in MENU['items']:
                expect(page.get_by_role('heading', name=item['name'], exact=True)).to_be_visible()
            page.locator('#menuGrid img').evaluate_all('(images)=>images.forEach(image=>image.loading="eager")')
            page.wait_for_function('Array.from(document.querySelectorAll("#menuGrid img")).every(image=>image.complete && image.naturalWidth>0)')
            for width in [320, 390, 768, 1440]:
                page.set_viewport_size({'width': width, 'height': 1000})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            print('PASS: current menu names, images and layouts at 320, 390, 768 and 1440px.')

            for item in MENU['items']:
                if not item['soldOut']:
                    page.locator('[data-act=add][data-id="' + item['id'] + '"]').click()
            available = [item for item in MENU['items'] if not item['soldOut']]
            total = sum(item['price'] for item in available)
            expect(page.locator('#boxCount')).to_have_text(str(len(available)))
            expect(page.locator('#boxTotal')).to_have_text(f'{total:,} EGP')
            page.locator('#openBox').click()
            page.locator('#orderForm [name=name]').fill('Local menu fixture')
            date = page.locator('#orderForm [name=date]')
            date.fill(date.get_attribute('min'))
            page.locator('#sendOrder').click()
            expect(page.locator('#sentNote')).to_be_visible()
            message = parse_qs(urlparse(page.evaluate('window.__opened[0]')).query)['text'][0]
            for item in available:
                assert item['name'] in message
            assert '()' not in message
            assert f'{total:,} EGP + delivery' in message
            print('PASS: cart totals and complete WhatsApp order use current prices, without empty size punctuation.')

            first = MENU['items'][0]['id']
            stored = {first: 2, 'retired-menu-fixture': 1}
            page.evaluate('(entry)=>localStorage.setItem(entry.key,JSON.stringify(entry.cart))', {'key': CART_KEY, 'cart': stored})
            fixture['menu']['items'][0]['soldOut'] = False
            page.reload()
            expect(page.locator('#boxCount')).to_have_text('2')
            assert json.loads(page.evaluate('localStorage.getItem("' + CART_KEY + '")')) == {first: 2}
            print('PASS: replacing the menu removes retired saved items while keeping available selections.')

            fixture['menu']['items'][0]['soldOut'] = True
            page.reload()
            expect(page.locator('#boxCount')).to_have_text('0')
            expect(page.locator('#boxTotal')).to_have_text('0 EGP')
            assert json.loads(page.evaluate('localStorage.getItem("' + CART_KEY + '")')) == {}
            fixture['menu']['items'][0]['soldOut'] = False
            page.reload()
            expect(page.locator('#boxCount')).to_have_text('0')
            print('PASS: sold-out selections stay removed when the dessert becomes available again.')

            page.evaluate('(entry)=>localStorage.setItem(entry.key,JSON.stringify(entry.cart))', {'key': CART_KEY, 'cart': stored})
            fixture['status'] = 503
            fixture['menu'] = {'error': 'Fixture menu outage'}
            page.reload()
            expect(page.locator('#menuGrid')).to_contain_text("couldn't load")
            expect(page.locator('#menuGrid .dish')).to_have_count(0)
            assert json.loads(page.evaluate('localStorage.getItem("' + CART_KEY + '")')) == stored
            print('PASS: a menu outage preserves the saved cart and never shows starter-menu prices.')
            assert not errors, errors
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    check_menu()
