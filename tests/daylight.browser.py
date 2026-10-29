"""Daylight customer flows using fixture APIs, intercepted WhatsApp and local map tiles."""
import base64
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
CARDS = json.loads((ROOT / 'public/data/cards.json').read_text())
CARD_KEY = 'maison-gaby-card-choice'
TILE = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN4cfc0AAVBApFnLKpfAAAAAElFTkSuQmCC')


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def check_daylight():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'public')))
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    base = 'http://127.0.0.1:' + str(server.server_port)
    errors, blocked = [], []
    contexts = []
    try:
        with sync_playwright() as playwright:
            executable = shutil.which('chromium')
            browser = playwright.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])

            def make(width=390, cards_status=200):
                context = browser.new_context(viewport={'width': width, 'height': 1000}, timezone_id='Africa/Cairo', reduced_motion='reduce')
                contexts.append(context)
                context.add_init_script('''window.__opened=null; window.__geoCalls=0;
                  window.open=(...args)=>{window.__opened=args;return null;};
                  Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(){window.__geoCalls++;throw new Error('Unexpected geolocation request in manual-map check');}}});''')
                traffic = {'tiles': 0}

                def route(request):
                    url = request.request.url
                    parsed = urlparse(url)
                    if url.startswith(base + '/'):
                        if parsed.path == '/api/menu':
                            request.fulfill(json=MENU)
                        elif parsed.path == '/data/cards.json':
                            request.fulfill(status=cards_status, json=CARDS if cards_status == 200 else {'error': 'Fixture outage'})
                        else:
                            request.continue_()
                    elif parsed.netloc == 'tile.openstreetmap.org':
                        traffic['tiles'] += 1
                        request.fulfill(content_type='image/png', body=TILE)
                    else:
                        blocked.append(url)
                        request.abort()

                context.route('**/*', route)
                page = context.new_page()
                page.set_default_timeout(8000)
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(base)
                expect(page.locator('#menuGrid .dish')).to_have_count(len(MENU['items']))
                return page, traffic

            def add_first(page):
                page.locator('[data-act=add][data-id="' + MENU['items'][0]['id'] + '"]').click()

            def order_details(page, recipient=False):
                page.locator('#orderForm [name=name]').fill('Local Daylight Fixture')
                date = page.locator('#orderForm [name=date]')
                date.fill(date.get_attribute('min'))
                if recipient:
                    page.locator('#orderForm [name=toName]').fill('Gift Fixture Recipient')
                    page.locator('#orderForm [name=toPhone]').fill('01000000000')

            def message(page):
                opened = page.evaluate('window.__opened')
                assert opened, 'The fixture should capture the WhatsApp draft.'
                parsed = urlparse(opened[0])
                assert parsed.netloc == 'wa.me' and parsed.path == '/201550505386'
                return parse_qs(parsed.query)['text'][0]

            # Each occasion previews both real messages; choosing one updates the real checkout.
            page, _ = make()
            expect(page.locator('#occasionSelect option')).to_have_count(len(CARDS['occasions']))
            for occasion in CARDS['occasions']:
                page.locator('#occasionSelect').select_option(occasion['id'])
                expect(page.locator('#messageChoices button')).to_have_count(2)
                for card in occasion['cards']:
                    page.locator('[data-message-id="' + card['id'] + '"]').click()
                    expect(page.locator('#cardTitle')).to_have_text(card['title'])
                    expect(page.locator('#cardAuthor')).to_have_text(card['author'])
                    expect(page.locator('#cardQuote')).to_have_text('“' + card['quote'] + '”')
            page.locator('#occasionSelect').select_option('anniversary')
            page.locator('[data-message-id="anniversary-2"]').click()
            page.locator('#chooseCard').click()
            expect(page.locator('#chooseCard')).to_be_focused()
            expect(page.locator('#giftToggle')).to_be_checked()
            expect(page.locator('#selectedCardLabel')).to_contain_text('Always us')
            expect(page.locator('.card-occasion-select')).to_have_value('anniversary')
            assert page.evaluate('sessionStorage.getItem(' + json.dumps(CARD_KEY) + ')') == 'anniversary-2'
            page.reload()
            expect(page.locator('#chooseCard')).to_have_attribute('aria-pressed', 'true')
            expect(page.locator('#occasionSelect')).to_have_value('anniversary')
            assert 'Love is not love' in page.locator('#orderForm [name=card]').input_value()
            add_first(page)
            page.locator('#openBox').click()
            order_details(page, recipient=True)
            page.locator('#orderForm [name=address]').fill('Fixture street, building 10, flat 2')
            page.locator('#sendOrder').click()
            expect(page.locator('#sentNote')).to_be_visible()
            draft = message(page)
            assert 'Love is not love' in draft and 'William Shakespeare' in draft
            assert 'Gift Fixture Recipient' in draft and 'Fixture street, building 10, flat 2' in draft
            assert MENU['items'][0]['name'] in draft
            print('PASS: all occasions/two messages, homepage selection and session restore feed the actual gift checkout and WhatsApp draft.')

            # Manual edits, turning gift mode off, and starting a new box clear shared selection.
            page.locator('#orderForm [name=card]').fill('My own fixture message')
            expect(page.locator('#sentNote')).to_be_hidden()
            expect(page.locator('#selectedCardLabel')).to_have_text('')
            expect(page.locator('#chooseCard')).to_have_attribute('aria-pressed', 'false')
            assert page.evaluate('sessionStorage.getItem(' + json.dumps(CARD_KEY) + ')') is None
            page.locator('#closeBox').click()
            page.locator('#chooseCard').click()
            page.locator('#openBox').click()
            page.locator('#giftToggle').uncheck()
            expect(page.locator('#selectedCardLabel')).to_have_text('')
            expect(page.locator('#giftFields')).to_be_hidden()
            page.locator('#closeBox').click()
            page.locator('#chooseCard').click()
            page.locator('#openBox').click()
            page.locator('#sendOrder').click()
            expect(page.locator('#sentNote')).to_be_visible()
            page.locator('#newBox').click()
            expect(page.locator('#boxCount')).to_have_text('0')
            expect(page.locator('#selectedCardLabel')).to_have_text('')
            expect(page.locator('#chooseCard')).to_have_attribute('aria-pressed', 'false')
            assert page.locator('#orderForm [name=card]').input_value() == ''
            assert page.evaluate('sessionStorage.getItem(' + json.dumps(CARD_KEY) + ')') is None
            print('PASS: editing, gift-mode changes and new-box reset keep homepage and checkout selection synchronized.')

            page.locator('[data-menu-toggle]').click()
            expect(page.locator('#mobileNav')).to_be_visible()
            page.keyboard.press('Escape')
            expect(page.locator('#mobileNav')).to_be_hidden()
            expect(page.locator('[data-menu-toggle]')).to_be_focused()
            page.locator('[data-menu-toggle]').click()
            page.locator('#mobileNav a[href="#notes"]').click()
            expect(page.locator('#mobileNav')).to_be_hidden()
            page.locator('[data-menu-toggle]').click()
            page.set_viewport_size({'width': 1440, 'height': 1000})
            expect(page.locator('#mobileNav')).to_be_hidden()
            print('PASS: mobile navigation closes on links, Escape and desktop resize, restoring keyboard focus on Escape.')

            # A card-data outage must leave a custom gift message usable.
            failed, _ = make(cards_status=503)
            expect(failed.locator('#chooseCard')).to_be_disabled()
            expect(failed.locator('#giftStatus')).to_contain_text('couldn’t load')
            add_first(failed)
            failed.locator('#openBox').click()
            failed.locator('#giftToggle').check()
            order_details(failed, recipient=True)
            failed.locator('#orderForm [name=address]').fill('Fixture fallback address')
            failed.locator('#orderForm [name=card]').fill('A personal message during the fixture outage')
            failed.locator('#sendOrder').click()
            expect(failed.locator('#sentNote')).to_be_visible()
            assert 'A personal message during the fixture outage' in message(failed)
            print('PASS: an unavailable card collection still permits a personal gift message and normal ordering.')

            gallery, _ = make()
            gallery.goto(base + '/packaging.html')
            expect(gallery.locator('.card-occasion-select option')).to_have_count(len(CARDS['occasions']))
            expect(gallery.locator('.literary-card')).to_have_count(2)
            gallery.locator('.card-occasion-select').select_option('anniversary')
            gallery.locator('[data-card-choice="anniversary-1"]').click()
            expect(gallery.locator('#chooseCard')).to_have_attribute('aria-pressed', 'true')
            expect(gallery.locator('#selectedCardLabel')).to_contain_text('Still my favourite')
            assert 'everything that I understand' in gallery.locator('#orderForm [name=card]').input_value()
            print('PASS: packaging gallery still hands its selected literary card to the redesigned homepage checkout.')

            # Manual map selection uses intercepted PNG tiles and never requests location permission.
            mapped, traffic = make()
            expect(mapped.locator('#chooseCard')).to_be_enabled()
            mapped.locator('#chooseCard').click()
            add_first(mapped)
            mapped.locator('#openBox').click()
            order_details(mapped, recipient=True)
            assert traffic['tiles'] == 0
            mapped.locator('#chooseDeliveryLocation').click()
            expect(mapped.locator('#useMapCenter')).to_be_enabled()
            mapped.locator('#deliveryMap').click(position={'x': 120, 'y': 115})
            expect(mapped.locator('#deliveryLocationSummary')).to_be_visible()
            expect(mapped.locator('.leaflet-marker-icon')).to_have_count(1)
            mapped.wait_for_function('Array.from(document.querySelectorAll("#deliveryMap img.leaflet-tile")).every(image => image.complete && image.naturalWidth > 0)')
            expect(mapped.locator('#deliveryLocationError')).to_be_empty()
            point = mapped.evaluate('window.MAISON_DELIVERY.getLocation()')
            assert point and traffic['tiles'] > 0
            expect(mapped.locator('#deliveryMapLink')).to_have_attribute('href', point['url'])
            assert mapped.locator('#orderForm [name=address]').input_value() == ''
            mapped.locator('#sendOrder').click()
            expect(mapped.locator('#sentNote')).to_be_visible()
            assert 'Delivery map: ' + point['url'] in message(mapped)
            assert 'Gift Fixture Recipient' in message(mapped)
            assert mapped.evaluate('window.__geoCalls') == 0
            mapped.locator('#closeBox').click()
            mapped.locator('#openBox').click()
            expect(mapped.locator('#deliveryLocationSummary')).to_be_visible()
            mapped.locator('#newBox').click()
            assert mapped.evaluate('window.MAISON_DELIVERY.getLocation()') is None
            expect(mapped.locator('#deliveryMapPanel')).to_be_hidden()
            print('PASS: manual recipient pin survives drawer reopening, enters the order and clears on reset; every tile is mocked, with no geolocation read.')

            # Selected quantity controls reserve their own area on tablet and narrow screens.
            responsive, _ = make(width=768)
            for item in MENU['items']:
                responsive.locator('[data-act=add][data-id="' + item['id'] + '"]').click()
            for width in [320, 390, 640, 768, 1024, 1440]:
                responsive.set_viewport_size({'width': width, 'height': 1000})
                assert responsive.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
                assert responsive.evaluate('''() => Array.from(document.querySelectorAll('.dish')).every(dish => {
                  const desc=dish.querySelector('.dish-desc'), actions=dish.querySelector('.dish-actions');
                  const range=document.createRange();range.selectNodeContents(desc);const b=actions.getBoundingClientRect();
                  return Array.from(range.getClientRects()).every(a => Math.min(a.right,b.right)-Math.max(a.left,b.left)<1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1);
                })'''), ('Quantity controls overlap description', width)
            print('PASS: selected quantity controls and menu layouts stay clear at 320, 390, 640, 768, 1024 and 1440px.')

            assert not blocked, blocked
            assert not errors, errors
            for context in contexts:
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    check_daylight()
