"""Browser test for the admin portal on a phone-sized screen, against a MOCK Supabase (no real data, no network).
Run locally:  cd admin && npm ci && node build.mjs && python3 test/e2e/e2e.py
It checks the screens and rules in the app. The real database rules are tested separately in SQL (test/db-security.sql)."""
import asyncio, base64, json, re, subprocess, sys, time, uuid, urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[3]
PORT = 8766
BASE = f'http://127.0.0.1:{PORT}/admin/index.html'
SB = 'https://xpkrtagvfwocnuecwukt.supabase.co'
RUH = timezone(timedelta(hours=3))
now_ruh = datetime.now(RUH)
TODAY = now_ruh.date()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(ROOT / 'site')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
results = []
def check(name, cond, extra=''):
    results.append(bool(cond))
    print(('PASS ' if cond else 'FAIL ') + name + (' :: ' + str(extra)[:300] if extra and not cond else ''))

def b64(d): return base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b'=').decode()
def jwt(): return b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': 'u1', 'role': 'authenticated', 'aud': 'authenticated', 'exp': int(time.time()) + 3600}) + '.sig'
USER = {'id': 'u1', 'aud': 'authenticated', 'role': 'authenticated', 'email': 'owner@example.com', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
def session(): return {'access_token': jwt(), 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600, 'refresh_token': 'r1', 'user': USER}

def areas_seed():
    js = (ROOT / 'site/data/areas.js').read_text(encoding='utf-8')
    d = json.loads(js.split('=', 1)[1].strip().rstrip(';'))
    out = []
    for i, a in enumerate(d['areas']):
        c = d['collections'][a['collection']]
        out.append({'code': a['code'], 'collection_ar': c['ar'], 'collection_en': c['en'], 'name_ar': a['ar'], 'name_en': a['en'], 'sort_order': (i + 1) * 10, 'active': True, 'updated_at': '2026-01-01T00:00:00Z'})
    return out

def iso(dt): return dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')

class DB:
    def __init__(self, admin=True):
        self.admin = admin
        t = {'approved': False, 'approved_at': None, 'updated_at': '2026-01-01T00:00:00Z'}
        tomorrow17 = datetime.combine(TODAY + timedelta(days=1), datetime.min.time(), RUH).replace(hour=17)
        self.t = {
            'areas': areas_seed(),
            'clients': [
                {'id': 'c-khalid', 'full_name': 'خالد', 'phone': '966551111111', 'preferred_lang': 'ar', 'whatsapp_opt_in': False, 'opt_in_at': None, 'opt_in_source': None, 'opted_out_at': None, 'notes': None, 'created_at': '2026-11-01T00:00:00Z', 'updated_at': '2026-11-01T00:00:00Z'},
                {'id': 'c-omar', 'full_name': 'Omar', 'phone': '966552222222', 'preferred_lang': 'en', 'whatsapp_opt_in': True, 'opt_in_at': '2026-11-01T00:00:00Z', 'opt_in_source': 'in_clinic', 'opted_out_at': None, 'notes': None, 'created_at': '2026-11-02T00:00:00Z', 'updated_at': '2026-11-02T00:00:00Z'},
                {'id': 'c-xss', 'full_name': '<img src=x onerror=window.__x=1>', 'phone': '966553333333', 'preferred_lang': 'ar', 'whatsapp_opt_in': True, 'opt_in_at': '2026-11-01T00:00:00Z', 'opt_in_source': 'website', 'opted_out_at': '2026-11-05T00:00:00Z', 'notes': None, 'created_at': '2026-11-03T00:00:00Z', 'updated_at': '2026-11-03T00:00:00Z'},
            ],
            'appointments': [
                {'id': 'a-khalid', 'client_id': 'c-khalid', 'area_codes': ['FACE-01', 'UPPER-01'], 'status': 'confirmed', 'scheduled_at': iso(tomorrow17), 'notes': None, 'created_at': '2026-11-05T00:00:00Z', 'updated_at': '2026-11-05T00:00:00Z'},
                {'id': 'a-omar', 'client_id': 'c-omar', 'area_codes': ['UPPER-02'], 'status': 'new', 'scheduled_at': None, 'notes': None, 'created_at': '2026-11-06T00:00:00Z', 'updated_at': '2026-11-06T00:00:00Z'},
            ],
            'message_templates': [
                {'code': 'reminder_24h', 'kind': 'reminder', 'title': 'Appointment reminder', 'body_ar': 'السلام عليكم {{name}}،\nتذكير بموعدك في {{clinic}}:\n{{date}} الساعة {{time}}\nالمناطق: {{areas}}', 'body_en': 'Hello {{name}},\nReminder of your appointment at {{clinic}}:\n{{date}} at {{time}}\nAreas: {{areas}}', **t},
                {'code': 'pre_instructions', 'kind': 'pre', 'title': 'Before your session', 'body_ar': 'تعليمات ما قبل جلستك:\n[تكتبها العيادة هنا ثم تعتمدها]', 'body_en': 'Before your session:\n[The clinic writes this text here, then approves it]', **t},
                {'code': 'post_instructions', 'kind': 'post', 'title': 'After your session', 'body_ar': 'تعليمات ما بعد جلستك:\n[تكتبها العيادة هنا ثم تعتمدها]', 'body_en': 'After your session:\n[The clinic writes this text here, then approves it]', **t},
            ],
            'offers': [], 'message_log': [],
        }
        self.calls = []

    def guard_log(self, row):
        c = next((x for x in self.t['clients'] if x['id'] == row['client_id']), None)
        if not c: return 'client not found'
        if row['kind'] == 'offer':
            o = next((x for x in self.t['offers'] if x['id'] == row.get('offer_id')), None)
            td = TODAY.isoformat()
            if not o or o['status'] != 'approved' or td < o['starts_on'] or td > o['ends_on']: return 'offer is not approved or is outside its approved dates'
            if not c['whatsapp_opt_in'] or c['opted_out_at']: return 'client has not opted in to promotional messages'
        else:
            t = next((x for x in self.t['message_templates'] if x['code'] == row.get('template_code')), None)
            if not t or not t['approved']: return 'template is not approved'
        return None

    def handle(self, method, table, q, body):
        rows = self.t[table]
        key = 'code' if table in ('areas', 'message_templates') else 'id'
        def match(r):
            for k, v in q.items():
                if k in ('select', 'order', 'offset', 'limit', 'columns'): continue
                op, _, val = v[0].partition('.')
                if op == 'eq' and str(r.get(k)) != val: return False
                if op == 'gte' and str(r.get(k)) < val: return False
            return True
        if not self.admin: return (200 if method == 'GET' else 403), []
        if method == 'GET': return 200, [r for r in rows if match(r)]
        if method == 'POST':
            items = body if isinstance(body, list) else [body]
            out = []
            for it in items:
                r = dict(it)
                if table == 'clients':
                    if any(x['phone'] == r['phone'] for x in rows): return 409, {'code': '23505', 'message': 'duplicate key value violates unique constraint "clients_phone_key"'}
                    r = {'id': str(uuid.uuid4()), 'preferred_lang': 'ar', 'whatsapp_opt_in': False, 'opt_in_at': None, 'opt_in_source': None, 'opted_out_at': None, 'notes': None, 'created_at': iso(datetime.now(timezone.utc)), 'updated_at': iso(datetime.now(timezone.utc)), **r}
                    if r['whatsapp_opt_in'] and not (r['opt_in_at'] and r['opt_in_source']): return 400, {'code': '23514', 'message': 'violates check constraint "opt_in_needs_proof"'}
                elif table == 'appointments':
                    r = {'id': str(uuid.uuid4()), 'area_codes': [], 'status': 'new', 'scheduled_at': None, 'notes': None, 'created_at': iso(datetime.now(timezone.utc)), 'updated_at': iso(datetime.now(timezone.utc)), **r}
                    if r['status'] == 'confirmed' and not r['scheduled_at']: return 400, {'code': '23514', 'message': 'violates check constraint "confirmed_needs_time"'}
                elif table == 'offers':
                    r = {'id': str(uuid.uuid4()), 'status': 'draft', 'created_at': iso(datetime.now(timezone.utc)), 'updated_at': iso(datetime.now(timezone.utc)), **r}
                elif table == 'message_log':
                    err = self.guard_log(r)
                    if err: return 400, {'code': 'P0001', 'message': err}
                    r = {'id': str(uuid.uuid4()), 'appointment_id': None, 'offer_id': None, 'template_code': None, 'created_at': iso(datetime.now(timezone.utc)), **r}
                elif table == 'message_templates':
                    r = {'body_ar': '', 'body_en': '', 'approved': False, 'approved_at': None, 'updated_at': iso(datetime.now(timezone.utc)), **r}
                elif table == 'areas':
                    r = {'updated_at': iso(datetime.now(timezone.utc)), **r}
                rows.insert(0, r); out.append(r)
            return 201, out
        if method == 'PATCH':
            out = []
            for r in rows:
                if match(r):
                    r.update(body); out.append(r)
            return 200, out
        if method == 'DELETE':
            gone = [r for r in rows if match(r)]
            for r in gone: rows.remove(r)
            if table == 'clients':
                ids = {r['id'] for r in gone}
                self.t['appointments'] = [a for a in self.t['appointments'] if a['client_id'] not in ids]
                self.t['message_log'] = [m for m in self.t['message_log'] if m['client_id'] not in ids]
            return 204, None
        return 405, None

async def mock(ctx, db, bad_login=False):
    async def handler(route, request):
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*'}
        if request.method == 'OPTIONS':
            return await route.fulfill(status=204, headers=cors)
        u = urllib.parse.urlparse(request.url)
        q = urllib.parse.parse_qs(u.query)
        p = u.path
        def j(status, data): return route.fulfill(status=status, headers={**cors, 'content-type': 'application/json'}, body=json.dumps(data) if data is not None else '')
        if p == '/auth/v1/token':
            if bad_login and q.get('grant_type') == ['password']: return await j(400, {'error': 'invalid_grant', 'error_code': 'invalid_credentials', 'error_description': 'Invalid login credentials', 'msg': 'Invalid login credentials'})
            return await j(200, session())
        if p == '/auth/v1/user': return await j(200, USER)
        if p == '/auth/v1/logout': return await route.fulfill(status=204, headers=cors)
        m = re.match(r'^/rest/v1/(\w+)$', p)
        if m and m.group(1) in db.t:
            body = None
            if request.post_data:
                try: body = json.loads(request.post_data)
                except Exception: body = None
            db.calls.append((request.method, m.group(1), body))
            st, data = db.handle(request.method, m.group(1), q, body)
            return await j(st, data)
        return await j(404, {'message': 'mock: unhandled ' + p})
    await ctx.route(SB + '/**', handler)

async def login(page, pw='correct horse'):
    await page.fill('input[type=email]', 'owner@example.com')
    await page.fill('input[type=password]', pw)
    await page.click('form.login button[type=submit]')

async def main():
    async with async_playwright() as p:
        try: b = await p.chromium.launch()
        except Exception: b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        db = DB()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='ar-SA', accept_downloads=True)
        await mock(ctx, db, bad_login=True)
        page = await ctx.new_page()
        errors, external = [], []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
        page.on('request', lambda r: external.append(r.url) if not (r.url.startswith('http://127.0.0.1') or r.url.startswith(SB) or r.url.startswith('data:')) else None)
        page.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))

        # ---------- login ----------
        await page.goto(BASE)
        await page.wait_for_selector('form.login')
        check('login: rtl arabic', await page.evaluate("document.documentElement.lang+'/'+document.documentElement.dir") == 'ar/rtl')
        check('login: noindex meta', await page.locator('meta[name=robots][content*=noindex]').count() == 1)
        check('login: CSP meta present', 'script-src' in (await page.get_attribute('meta[http-equiv=Content-Security-Policy]', 'content')))
        await page.screenshot(path='/tmp/admin-login.png')
        await login(page, 'wrong')
        await page.wait_for_selector('form.login .note.warn:not([hidden])')
        check('login: wrong password shows message', 'غير صحيحة' in await page.inner_text('form.login .note.warn'))
        check('login: password not in URL', 'password' not in page.url and 'wrong' not in page.url, page.url)
        # now allow login
        await ctx.unroute(SB + '/**'); await mock(ctx, db, bad_login=False)
        await login(page)
        await page.wait_for_selector('nav.tabs')
        check('login: signed in, Today tab selected', await page.locator('.tab.on').inner_text() == 'اليوم')

        # ---------- today ----------
        check('today: new request listed', 'Omar' in await page.inner_text('main'))
        txt = await page.inner_text('main')
        check('today: reminder needs approved template first', 'اعتمد القالب أولاً' in txt)
        check('today: XSS name is not rendered as html', await page.evaluate('window.__x') is None and await page.locator('main img').count() == 0)
        await page.screenshot(path='/tmp/admin-today.png', full_page=True)

        # ---------- messages ----------
        await page.click('a.tab[href="#/messages"]')
        await page.wait_for_selector('text=Appointment reminder')
        items = page.locator('li.item', has_text='Before your session')
        await items.get_by_role('button', name='تعديل').click()
        await page.wait_for_selector('.modal')
        check('messages: pre template with [ ] brackets cannot be approved', await page.get_by_role('button', name='حفظ واعتماد').is_disabled())
        check('messages: bracket problem explained', 'أقواس' in await page.inner_text('.problems'))
        await page.click('.modal-head .icon-btn')
        await page.locator('li.item', has_text='Appointment reminder').get_by_role('button', name='تعديل').click()
        await page.wait_for_selector('.modal')
        check('messages: reminder template can be approved', await page.get_by_role('button', name='حفظ واعتماد').is_enabled())
        # banned wording blocks approval
        ta = page.locator('.modal textarea').nth(1)
        orig = await ta.input_value()
        await ta.fill(orig + '\nPermanent results guaranteed')
        check('messages: banned wording blocks approval', await page.get_by_role('button', name='حفظ واعتماد').is_disabled())
        await ta.fill(orig + '\nResults are not guaranteed.')
        check('messages: honest risk wording allowed', await page.get_by_role('button', name='حفظ واعتماد').is_enabled())
        await ta.fill(orig + '\n{{oops}}')
        check('messages: unknown variable blocks approval', await page.get_by_role('button', name='حفظ واعتماد').is_disabled())
        await ta.fill(orig)
        await page.get_by_role('button', name='حفظ واعتماد').click()
        await page.wait_for_selector('.modal', state='detached')
        check('messages: approved saved in db', next(t for t in db.t['message_templates'] if t['code'] == 'reminder_24h')['approved'] is True)
        check('messages: approved_at set', next(t for t in db.t['message_templates'] if t['code'] == 'reminder_24h')['approved_at'] is not None)

        # ---------- send reminder from Today ----------
        await page.click('a.tab[href="#/today"]')
        await page.wait_for_selector('section.card:has-text("تذكير بالموعد") button:has-text("إرسال")')
        await page.locator('section.card', has_text='تذكير بالموعد').get_by_role('button', name='إرسال').click()
        await page.wait_for_selector('.modal textarea.preview')
        prev = await page.input_value('.modal textarea.preview')
        check('send: preview has client name and area names', 'خالد' in prev and 'خط اللحية' in prev and 'الإبطان' in prev, prev)
        check('send: preview has 5:00 PM style time (17:00 Riyadh)', re.search(r'5:00\s*(PM|م)', prev) or '17:00' in prev or '5:00' in prev, prev)
        href = await page.get_attribute('.modal a.btn.primary', 'href')
        check('send: wa.me link to the client with the text', href.startswith('https://wa.me/966551111111?text=') and 'خالد' in urllib.parse.unquote(href), href)
        check('send: nothing logged before Mark as sent', len(db.t['message_log']) == 0)
        await page.get_by_role('button', name='تم الإرسال').click()
        await page.wait_for_selector('.modal', state='detached')
        check('send: log row written', len(db.t['message_log']) == 1 and db.t['message_log'][0]['kind'] == 'reminder' and db.t['message_log'][0]['status'] == 'sent')
        await page.wait_for_selector('section.card:has-text("تذكير بالموعد") >> text=لا توجد تذكيرات مستحقة')
        check('send: reminder leaves the due list after marking sent', True)

        # ---------- clients ----------
        await page.click('a.tab[href="#/clients"]')
        await page.wait_for_selector('li.item')
        await page.get_by_role('button', name='+ عميل').click()
        await page.fill('.modal input[type=text]', 'Faisal')
        await page.fill('.modal input[type=tel]', '0554445566')
        check('clients: phone normalised live', '+966 55 444 5566' in await page.inner_text('.modal'))
        await page.get_by_role('button', name='حفظ', exact=True).click()
        await page.wait_for_selector('.modal', state='detached')
        check('clients: saved as 9665… digits', any(c['phone'] == '966554445566' for c in db.t['clients']))
        await page.get_by_role('button', name='+ عميل').click()
        await page.fill('.modal input[type=text]', 'Dup')
        await page.fill('.modal input[type=tel]', '+966 55 111 1111')
        await page.get_by_role('button', name='حفظ', exact=True).click()
        await page.wait_for_selector('.modal .note.warn:not([hidden])')
        check('clients: duplicate phone explained', 'مسجّل مسبقاً' in await page.inner_text('.modal .note.warn'))
        await page.fill('.modal input[type=tel]', '12')
        await page.get_by_role('button', name='حفظ', exact=True).click()
        check('clients: invalid phone blocked in the browser', 'غير صالح' in await page.inner_text('.modal .note.warn'))
        await page.click('.modal-head .icon-btn')
        # consent
        await page.fill('input[type=search]', 'خالد')
        await page.locator('li.item', has_text='خالد').get_by_role('button', name='تعديل').click()
        await page.check('#optin')
        await page.select_option('.modal select >> nth=1', 'whatsapp_chat')
        await page.get_by_role('button', name='حفظ', exact=True).click()
        await page.wait_for_selector('.modal', state='detached')
        kh = next(c for c in db.t['clients'] if c['id'] == 'c-khalid')
        check('consent: opt-in saved with source and time', kh['whatsapp_opt_in'] is True and kh['opt_in_source'] == 'whatsapp_chat' and kh['opt_in_at'])
        # erase
        await page.fill('input[type=search]', 'Faisal')
        await page.locator('li.item', has_text='Faisal').get_by_role('button', name='حذف').click()
        await page.get_by_role('button', name='حذف', exact=True).last.click()
        await page.wait_for_selector('li.item:has-text("Faisal")', state='detached')
        check('clients: erase removes the client', not any(c['full_name'] == 'Faisal' for c in db.t['clients']))

        # ---------- appointments ----------
        await page.click('a.tab[href="#/appointments"]')
        await page.get_by_role('button', name='+ موعد').click()
        await page.click('.modal button:has-text("+ عميل جديد")')
        await page.fill('.modal .subbox input[type=text]', 'Sami')
        await page.fill('.modal .subbox input[type=tel]', '0556667788')
        await page.check('.modal label:has-text("خط اللحية") input')
        # status select is the last select before the date fields
        await page.locator('.modal select').last.select_option('confirmed')
        await page.get_by_role('button', name='حفظ', exact=True).click()
        check('appointments: confirmed needs a date and time', 'تاريخاً ووقتاً' in await page.inner_text('.modal .note.warn'))
        check('appointments: nothing saved yet', not any(c['full_name'] == 'Sami' for c in db.t['clients']))
        d = (TODAY + timedelta(days=3)).isoformat()
        await page.fill('.modal input[type=date]', d)
        await page.fill('.modal input[type=time]', '18:30')
        await page.get_by_role('button', name='حفظ', exact=True).click()
        await page.wait_for_selector('.modal', state='detached')
        ap = next((a for a in db.t['appointments'] if any(c['id'] == a['client_id'] and c['full_name'] == 'Sami' for c in db.t['clients'])), None)
        check('appointments: new client and confirmed appointment saved', ap and ap['status'] == 'confirmed' and ap['area_codes'] == ['FACE-01'], ap)
        when = ap and datetime.fromisoformat(ap['scheduled_at']).astimezone(timezone.utc)
        check('appointments: 18:30 Riyadh is the instant 15:30 UTC', when and when.strftime('%Y-%m-%dT%H:%M') == d + 'T15:30', ap and ap['scheduled_at'])
        # quick status change on a request to confirmed with no time opens the editor
        await page.locator('li.item', has_text='Omar').locator('select').select_option('confirmed')
        await page.wait_for_selector('.modal')
        check('appointments: confirming without time opens the editor', 'تعديل الموعد' in await page.inner_text('.modal-head'))
        await page.click('.modal-head .icon-btn')
        await page.locator('li.item', has_text='Omar').locator('select').select_option('contacted')
        await asyncio.sleep(0.3)
        check('appointments: quick status change saved', next(a for a in db.t['appointments'] if a['id'] == 'a-omar')['status'] == 'contacted')

        # ---------- offers ----------
        await page.click('a.tab[href="#/offers"]')
        await page.get_by_role('button', name='+ عرض').click()
        m = page.locator('.modal')
        await m.locator('input[type=text]').nth(0).fill('عرض الشتاء')
        await m.locator('input[type=text]').nth(1).fill('Winter offer')
        await m.locator('textarea').nth(0).fill('خصم على الجلسات الجديدة. الأفضل في الرياض.')
        await m.locator('textarea').nth(1).fill('Discount on new sessions. Permanent results.')
        await m.locator('input[type=date]').nth(0).fill(TODAY.isoformat())
        await m.locator('input[type=date]').nth(1).fill((TODAY + timedelta(days=61)).isoformat())
        pr = await page.inner_text('.problems')
        check('offers: approval number required', 'رقم الموافقة' in pr, pr)
        check('offers: 60-day limit explained', '60' in pr, pr)
        check('offers: banned wording flagged', 'عبارات يجب تجنبها' in pr, pr)
        check('offers: Approve disabled with problems', await page.get_by_role('button', name='حفظ واعتماد').is_disabled())
        await m.locator('textarea').nth(0).fill('خصم على الجلسات الجديدة.')
        await m.locator('textarea').nth(1).fill('Discount on new sessions.')
        await m.locator('input[type=date]').nth(1).fill((TODAY + timedelta(days=30)).isoformat())
        await m.locator('input[type=text]').nth(2).fill('RUH-2026-0457')
        check('offers: no problems left', (await page.inner_text('.problems')).strip() == '', await page.inner_text('.problems'))
        pv = await page.inner_text('.preview-box')
        check('offers: preview is Arabic first with approval no., footer and stop line', pv.index('عرض الشتاء') < pv.index('Winter offer') and 'RUH-2026-0457' in pv and 'إعلان' in pv and 'STOP' in pv, pv)
        await page.get_by_role('button', name='حفظ واعتماد').click()
        await page.wait_for_selector('.modal', state='detached')
        o = db.t['offers'][0]
        check('offers: approved with number and dates', o['status'] == 'approved' and o['approval_number'] == 'RUH-2026-0457' and o['starts_on'] == TODAY.isoformat())
        check('offers: shown as active', 'ساري' in await page.inner_text('main'))
        await page.get_by_role('button', name='إرسال').first.click()
        await page.wait_for_selector('.modal li.item')
        names = await page.locator('.modal li.item').all_inner_texts()
        joined = ' '.join(names)
        check('offers: only opted-in, not opted-out clients (Khalid, Omar) listed', 'خالد' in joined and 'Omar' in joined and '<img' not in joined, joined)
        wa = await page.locator('.modal li.item', has_text='Omar').locator('a').get_attribute('href')
        check('offers: link carries the full message', 'RUH-2026-0457' in urllib.parse.unquote(wa) and wa.startswith('https://wa.me/966552222222?text='), wa)
        await page.locator('.modal li.item', has_text='Omar').get_by_role('button', name='تم الإرسال').click()
        await asyncio.sleep(0.3)
        check('offers: offer send logged', any(m['kind'] == 'offer' and m['client_id'] == 'c-omar' and m['offer_id'] == o['id'] for m in db.t['message_log']))
        check('offers: already-sent client shows Sent', 'أُرسل' in await page.locator('.modal li.item', has_text='Omar').inner_text())
        await page.click('.modal-head .icon-btn')
        # editing an approved offer returns it to draft
        await page.locator('li.item', has_text='عرض الشتاء').get_by_role('button', name='تعديل').click()
        await page.locator('.modal textarea').nth(0).fill('خصم جديد على الجلسات.')
        await page.get_by_role('button', name='حفظ كمسودة').click()
        await page.wait_for_selector('.modal', state='detached')
        check('offers: editing returns offer to draft', db.t['offers'][0]['status'] == 'draft')

        # ---------- areas / log ----------
        await page.click('a.tab[href="#/areas"]')
        async with page.expect_download() as dl:
            await page.get_by_role('button', name='تنزيل areas.js').click()
        path = await (await dl.value).path()
        js = Path(path).read_text(encoding='utf-8')
        data = json.loads(js.split('=', 1)[1].strip().rstrip(';'))
        orig = json.loads((ROOT / 'site/data/areas.js').read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
        check('areas: exported areas.js equals the current site file', data == orig, (len(data['areas']), len(orig['areas'])))
        await page.locator('li.item', has_text='FACE-05').get_by_role('button', name='إيقاف').click()
        await page.wait_for_selector('li.item:has-text("FACE-05") >> text=متوقفة')
        async with page.expect_download() as dl:
            await page.get_by_role('button', name='تنزيل areas.js').click()
        data2 = json.loads(Path(await (await dl.value).path()).read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
        check('areas: turned-off area leaves the export', len(data2['areas']) == 21 and all(a['code'] != 'FACE-05' for a in data2['areas']))
        await page.click('a.tab[href="#/log"]')
        await page.wait_for_selector('pre.log-body')
        check('log: shows sent messages', await page.locator('pre.log-body').count() == 2)
        async with page.expect_download() as dl:
            await page.get_by_role('button', name='تنزيل نسخة احتياطية').click()
        bk = json.loads(Path(await (await dl.value).path()).read_text(encoding='utf-8'))
        check('log: backup JSON holds all tables', all(k in bk for k in ['areas', 'clients', 'appointments', 'message_templates', 'offers', 'message_log']) and len(bk['clients']) >= 3)

        # ---------- language and layout ----------
        await page.click('button.pill:has-text("English")')
        check('lang: English is ltr', await page.evaluate("document.documentElement.lang+'/'+document.documentElement.dir") == 'en/ltr')
        check('lang: tabs in English', 'Appointments' in await page.inner_text('nav.tabs'))
        sw = await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        check('layout: no horizontal overflow at 390px (log, en)', sw)
        for name in ['today', 'appointments', 'clients', 'messages', 'offers', 'areas']:
            await page.click(f'a.tab[href="#/{name}"]')
            await page.wait_for_selector('main h1')
            ok = await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
            check(f'layout: no horizontal overflow on {name}', ok)
        await page.screenshot(path='/tmp/admin-en.png', full_page=True)
        await page.click('button.pill:has-text("العربية")')

        # ---------- sign out ----------
        await page.click('button.pill:has-text("خروج")')
        await page.wait_for_selector('form.login')
        check('signout: back to login, data cleared', await page.locator('nav.tabs').count() == 0 and 'Omar' not in await page.inner_text('body'))

        # ---------- security: no external requests, no console errors (CSP) ----------
        check('security: only same-origin and Supabase requests', not external, external)
        bad = [e for e in errors if 'Failed to load resource' not in e]
        check('security: no console errors / CSP violations', not bad, bad)

        # ---------- not an admin: empty data -> no access screen ----------
        ctx2 = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar-SA')
        await mock(ctx2, DB(admin=False))
        p2 = await ctx2.new_page()
        await p2.goto(BASE)
        await login(p2)
        await p2.wait_for_selector('text=لا توجد صلاحية')
        check('non-admin: sees the no-access screen and no tabs', await p2.locator('nav.tabs').count() == 0)

        # ---------- idle sign-out (fake clock) ----------
        ctx3 = await b.new_context(viewport={'width': 390, 'height': 844}, locale='ar-SA')
        await mock(ctx3, DB())
        p3 = await ctx3.new_page()
        await p3.clock.install()
        await p3.goto(BASE)
        await login(p3)
        await p3.wait_for_selector('nav.tabs')
        await p3.clock.fast_forward('29:00')
        check('idle: still signed in after 29 minutes', await p3.locator('nav.tabs').count() == 1)
        await p3.clock.fast_forward('02:00')
        await p3.wait_for_selector('form.login', timeout=5000)
        check('idle: signed out after 30 minutes', True)
        await b.close()

try:
    asyncio.run(main())
finally:
    srv.terminate()
print(f'\n{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
