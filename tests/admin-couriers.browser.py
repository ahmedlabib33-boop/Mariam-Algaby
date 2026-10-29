"""End-to-end courier checks: local fixture APIs, no messages sent or courier calls."""
import json
import shutil
import tempfile
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'maison-gaby-couriers-v1'
PASSWORD = 'local-browser-fixture-only'
MENU = json.loads((ROOT / 'public/data/menu.json').read_text())
RIDER = {'id': 'fixture-rider', 'name': 'Local Test Rider', 'phone': '12025550123',
         'vehicle': 'Motorcycle', 'area': 'Heliopolis', 'notes': '', 'available': True}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path == '/admin':
            self.path = '/admin.html'
        super().do_GET()

    def log_message(self, *_args):
        pass


class CourierAdminTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT / 'public')))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.playwright = sync_playwright().start()
        executable = shutil.which('chromium')
        cls.browser = cls.playwright.chromium.launch(**({'executable_path': executable} if executable else {}), args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
        self.page = self.context.new_page()
        self.page.set_default_timeout(8000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', lambda dialog: dialog.accept())
        self.page.add_init_script('window.__opened=[]; window.open=(...args)=>{window.__opened.push(args);return null;};')
        self.page.route('**/*', self.route)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def route(self, route):
        path = urlparse(route.request.url).path
        if path == '/api/login':
            route.fulfill(status=200 if route.request.headers.get('x-admin-password') == PASSWORD else 401, json={'ok': True})
        elif path == '/api/menu':
            route.fulfill(json=MENU, headers={'ETag': '"fixture-menu"'})
        elif path == '/api/recipes':
            route.fulfill(json={'recipes': []})
        elif route.request.url.startswith(self.base):
            route.continue_()
        else:
            route.abort()

    def sign_in(self):
        self.page.goto(self.base + '/admin')
        expect(self.page.locator('#couriers')).to_be_hidden()
        self.page.locator('[name=password]').fill(PASSWORD)
        self.page.locator('#loginForm button').click()
        expect(self.page.locator('#tabs')).to_be_visible()
        self.page.locator('#couriersTab').click()
        expect(self.page.locator('#couriers')).to_be_visible()

    def add_rider(self, name='Local Test Rider', number='+1 202 555 0123'):
        self.page.locator('#addCourier').click()
        self.page.locator('#courierForm [name=name]').fill(name)
        self.page.locator('#courierForm [name=phone]').fill(number)
        self.page.locator('#courierForm [name=area]').fill('Heliopolis')
        self.page.locator('#saveCourier').click()
        expect(self.page.locator('#courierSheet')).to_be_hidden()

    def fill_request(self):
        self.page.locator('[data-courier-select]').first.click()
        data = {'orderRef': 'MG-LOCAL-TEST', 'pickup': 'Local fixture pickup', 'pickupTime': 'Tomorrow, 5pm',
                'recipientName': 'Local recipient', 'recipientPhone': '+1 202 555 0124',
                'mapUrl': 'https://www.google.com/maps/search/?api=1&query=30.1%2C31.3',
                'contents': '2 boxes, keep upright', 'collect': '250.50'}
        for name, value in data.items():
            self.page.locator('#deliveryRequestForm [name=' + name + ']').fill(value)

    def import_contacts(self, data):
        self.page.locator('#courierImportInput').set_input_files({
            'name': 'fixture-riders.json', 'mimeType': 'application/json',
            'buffer': json.dumps(data).encode()})

    def test_contacts_edit_availability_persistence_and_removal(self):
        self.sign_in()
        expect(self.page.locator('#courierEmpty')).to_be_visible()
        self.add_rider()
        expect(self.page.locator('.courier-card')).to_have_count(1)
        expect(self.page.locator('.courier-card a').nth(0)).to_have_attribute('href', 'tel:+12025550123')
        self.assertTrue(self.page.locator('.courier-card a').nth(1).get_attribute('href').startswith('https://wa.me/12025550123?'))
        self.page.locator('[data-courier-edit]').click()
        self.page.locator('#courierForm [name=available]').uncheck()
        self.page.locator('#saveCourier').click()
        expect(self.page.locator('[data-courier-select]')).to_be_disabled()
        self.page.reload()
        expect(self.page.locator('#tabs')).to_be_visible()
        self.page.locator('#couriersTab').click()
        expect(self.page.locator('.courier-availability')).to_have_text('Unavailable')
        self.page.locator('[data-courier-edit]').click()
        self.page.locator('#deleteCourier').click()
        expect(self.page.locator('.courier-card')).to_have_count(0)
        self.assertEqual(json.loads(self.page.evaluate('localStorage.getItem("' + KEY + '")'))['couriers'], [])

    def test_phone_validation_duplicate_and_arabic_digits(self):
        self.sign_in()
        self.page.locator('#addCourier').click()
        self.page.locator('#courierForm [name=name]').fill('Egypt fixture')
        self.page.locator('#courierForm [name=phone]').fill('not a phone')
        self.page.locator('#saveCourier').click()
        expect(self.page.locator('#courierFormError')).to_contain_text('mobile number')
        self.page.locator('#courierForm [name=phone]').fill('٠١٠١٢٣٤٥٦٧٨')
        self.page.locator('#saveCourier').click()
        expect(self.page.locator('.courier-card a').first).to_have_attribute('href', 'tel:+201012345678')
        self.page.locator('#addCourier').click()
        self.page.locator('#courierForm [name=name]').fill('Duplicate fixture')
        self.page.locator('#courierForm [name=phone]').fill('+201012345678')
        self.page.locator('#saveCourier').click()
        expect(self.page.locator('#courierFormError')).to_contain_text('already saved')
        expect(self.page.locator('.courier-card')).to_have_count(1)

    def test_request_validation_map_cash_and_explicit_whatsapp_draft(self):
        self.sign_in()
        self.add_rider()
        self.page.locator('#sendCourierRequest').click()
        expect(self.page.locator('#courierRequestError')).to_contain_text('Choose an available rider')
        self.fill_request()
        self.page.locator('#deliveryRequestForm [name=mapUrl]').fill('https://evil.test/maps')
        self.page.locator('#sendCourierRequest').click()
        expect(self.page.locator('#courierRequestError')).to_contain_text('Google Maps')
        self.assertEqual(self.page.evaluate('window.__opened.length'), 0)
        self.page.locator('#deliveryRequestForm [name=mapUrl]').fill('https://www.google.com/maps/search/?api=1&query=30.1%2C31.3')
        self.page.locator('#deliveryRequestForm [name=collect]').fill('-1')
        self.page.locator('#sendCourierRequest').click()
        expect(self.page.locator('#courierRequestError')).to_contain_text('cash to collect')
        self.page.locator('#deliveryRequestForm [name=collect]').fill('250.50')
        self.page.locator('#sendCourierRequest').click()
        expect(self.page.locator('#courierRequestStatus')).to_contain_text('Press send there')
        url = self.page.evaluate('window.__opened[0][0]')
        self.assertEqual(urlparse(url).path, '/12025550123')
        message = parse_qs(urlparse(url).query)['text'][0]
        for value in ['MG-LOCAL-TEST', 'Local fixture pickup', 'Local recipient', '+12025550124', '250.5 EGP', 'google.com/maps', 'confirm availability']:
            self.assertIn(value, message)
        self.assertEqual(self.page.evaluate('window.__opened.length'), 1)
        self.assertNotIn('Local recipient', self.page.evaluate('JSON.stringify(localStorage)'))
        self.page.locator('#clearCourierRequest').click()
        expect(self.page.locator('#deliveryRequestForm [name=recipientName]')).to_have_value('')
        expect(self.page.locator('#deliveryRequestPreview')).not_to_contain_text('Local recipient')

    def test_backup_import_merge_validation_and_xss(self):
        self.sign_in()
        self.add_rider()
        with self.page.expect_download() as download_info:
            self.page.locator('#exportCouriers').click()
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'riders.json'
            download_info.value.save_as(str(target))
            self.assertEqual(json.loads(target.read_text())['couriers'][0]['phone'], RIDER['phone'])
        incoming = dict(RIDER, id='new', name='<img src=x onerror=alert(1)>', phone='12025550125')
        self.import_contacts({'version': 1, 'couriers': [RIDER, incoming]})
        expect(self.page.locator('#courierStatus')).to_contain_text('1 rider imported')
        expect(self.page.locator('.courier-card')).to_have_count(2)
        expect(self.page.locator('.courier-card img')).to_have_count(0)
        expect(self.page.locator('.courier-name').nth(1)).to_have_text(incoming['name'])
        self.import_contacts({'version': 1, 'couriers': [dict(RIDER, phone='javascript:alert(1)')]})
        expect(self.page.locator('#courierStatus')).to_contain_text('Import failed')
        expect(self.page.locator('.courier-card')).to_have_count(2)

    def test_signout_clears_recipient_data_and_late_import(self):
        self.sign_in()
        self.add_rider()
        self.fill_request()
        self.page.evaluate('() => { File.prototype.text=function(){return new Promise(resolve=>{window.__finishImport=resolve;});}; }')
        self.import_contacts({'version': 1, 'couriers': [dict(RIDER, phone='12025550125')]})
        self.page.wait_for_function('typeof window.__finishImport === "function"')
        self.page.locator('#signOut').click()
        expect(self.page.locator('#couriers')).to_be_hidden()
        expect(self.page.locator('#courierList')).to_be_empty()
        expect(self.page.locator('#deliveryRequestForm [name=recipientPhone]')).to_have_value('')
        expect(self.page.locator('#deliveryRequestPreview')).to_be_empty()
        self.page.evaluate('window.__finishImport(' + json.dumps(json.dumps({'version': 1, 'couriers': [dict(RIDER, phone='12025550125')]})) + ')')
        self.page.wait_for_timeout(50)
        self.assertEqual(len(json.loads(self.page.evaluate('localStorage.getItem("' + KEY + '")'))['couriers']), 1)
        self.sign_in()
        expect(self.page.locator('.courier-card')).to_have_count(1)
        expect(self.page.locator('#deliveryRequestForm [name=recipientName]')).to_have_value('')

    def test_storage_failure_is_explicit_and_contacts_still_usable(self):
        self.sign_in()
        self.page.evaluate('() => { Storage.prototype.setItem=function(){throw new Error("fixture storage full");}; }')
        self.add_rider()
        expect(self.page.locator('#courierStorageNotice')).to_contain_text('session only')
        expect(self.page.locator('#courierStatus')).to_contain_text('session')
        expect(self.page.locator('#exportCouriers')).to_be_enabled()
        self.fill_request()
        self.page.locator('#sendCourierRequest').click()
        self.assertEqual(self.page.evaluate('window.__opened.length'), 1)

    def test_copy_request_and_clear_ignore_a_delayed_clipboard_result(self):
        self.sign_in()
        self.add_rider()
        self.fill_request()
        self.page.evaluate('Object.defineProperty(navigator,"clipboard",{value:{writeText:function(text){window.__copied=text;return new Promise(resolve=>{window.__finishCopy=resolve;});}}});')
        self.page.locator('#copyCourierRequest').click()
        self.page.wait_for_function('typeof window.__finishCopy === "function"')
        self.assertIn('MG-LOCAL-TEST', self.page.evaluate('window.__copied'))
        self.assertEqual(self.page.evaluate('window.__opened.length'), 0)
        self.page.locator('#clearCourierRequest').click()
        self.page.evaluate('window.__finishCopy()')
        self.page.wait_for_timeout(50)
        expect(self.page.locator('#courierRequestStatus')).to_be_empty()
        expect(self.page.locator('#deliveryRequestForm [name=recipientName]')).to_have_value('')

    def test_keyboard_tabs_and_responsive_layout(self):
        self.sign_in()
        self.add_rider(name='Long fixture rider name for a narrow mobile screen')
        self.page.locator('#couriersTab').focus()
        self.page.keyboard.press('Home')
        expect(self.page.locator('#editor')).to_be_visible()
        self.page.keyboard.press('End')
        expect(self.page.locator('#partners')).to_be_visible()
        expect(self.page.locator('#partnersTab')).to_be_focused()
        self.page.keyboard.press('ArrowLeft')
        expect(self.page.locator('#couriers')).to_be_visible()
        expect(self.page.locator('#couriersTab')).to_be_focused()
        for width in [320, 390, 768, 1440]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            self.page.locator('[data-courier-edit]').click()
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            self.page.keyboard.press('Escape')
            expect(self.page.locator('#courierSheet')).to_be_hidden()


if __name__ == '__main__':
    unittest.main(verbosity=2)
