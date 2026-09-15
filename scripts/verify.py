"""Run source and publication-boundary checks; no browser/server required."""
import copy
import importlib.util
import json
import re
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_content', ROOT / 'scripts/prepare-content.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SourceChecks(unittest.TestCase):
    def setUp(self):
        self.source = json.loads((ROOT / 'content/site.json').read_text())

    def test_unapproved_records_are_absent_from_public_content(self):
        draft = copy.deepcopy(self.source['projects'][0])
        draft.update(id='private-draft', approved=False, description='DRAFT_SENTINEL')
        self.source['projects'].append(draft)
        self.source['progress'] = [{'approved': False, 'description': 'PROGRESS_SENTINEL'}]
        self.source['contact'].update(approved=False, address='CONTACT_SENTINEL')
        public = json.dumps(module.compile_site(self.source))
        self.assertNotIn('DRAFT_SENTINEL', public)
        self.assertNotIn('PROGRESS_SENTINEL', public)
        self.assertNotIn('CONTACT_SENTINEL', public)

    def test_unlisted_fields_cannot_leak(self):
        self.source['projects'][0]['customerPhone'] = 'UNLISTED_SENTINEL'
        self.assertNotIn('UNLISTED_SENTINEL', json.dumps(module.compile_site(self.source)))

    def test_only_explicit_boolean_approval_is_accepted(self):
        self.source['projects'][0]['approved'] = 'true'
        self.assertEqual(len(module.compile_site(self.source)['projects']), 4)

    def test_progress_and_nested_timeline_approval(self):
        self.source['progress'] = [{
            'approved': True, 'id': 'test-progress', 'date': '2026-09-15',
            'title': 'Public title', 'projectCode': 'TEST-01', 'stage': 'Rakit',
            'description': 'Approved description', 'internalNote': 'PRIVATE_NOTE',
            'timeline': [
                {'approved': True, 'date': '2026-09-14', 'stage': 'Penerimaan', 'description': 'Public step'},
                {'approved': False, 'description': 'PRIVATE_STEP'}
            ]}]
        public = module.compile_site(self.source)
        self.assertEqual(len(public['progress']), 1)
        self.assertEqual(len(public['progress'][0]['timeline']), 1)
        self.assertNotIn('PRIVATE_', json.dumps(public))

    def test_contact_url_and_number_rejection(self):
        for url in ['javascript:alert(1)', 'https://evil.example/', 'https://www.google.com.evil.example/', 'https://name:pass@www.google.com/maps', 'https://www.google.com:8443/maps']:
            with self.subTest(url=url):
                self.source['contact'].update(approved=True, mapsUrl=url)
                with self.assertRaises(ValueError): module.compile_site(self.source)
        self.source['contact'].update(mapsUrl='', whatsapp='+62abc')
        with self.assertRaises(ValueError): module.compile_site(self.source)

    def test_coordinate_validation_and_legitimate_zero(self):
        self.source['contact'].update(approved=True, latitude=0, longitude=0)
        self.assertEqual(module.compile_site(self.source)['contact']['latitude'], 0)
        for lat, lon in [(True, 10), (91, 0), (0, -181), (None, 10), ('0', 0)]:
            with self.subTest(latitude=lat, longitude=lon):
                self.source['contact'].update(latitude=lat, longitude=lon)
                with self.assertRaises(ValueError): module.compile_site(self.source)

    def test_image_traversal_and_external_images_rejected(self):
        for value in ['../upload/report.pdf', 'assets/../report.png', 'https://external.example/a.png', 'assets/invalid.svg']:
            with self.subTest(value=value):
                with self.assertRaises(ValueError): module.image_path(value)

    def test_invalid_dates_and_duplicate_ids_rejected(self):
        with self.assertRaises(ValueError): module.iso_date('2026-02-30')
        self.source['projects'].append(copy.deepcopy(self.source['projects'][0]))
        with self.assertRaises(ValueError): module.compile_site(self.source)

    def test_public_output_is_current(self):
        output = (ROOT / 'dist/content.js').read_text()
        payload = output.split('window.GDT_CONTENT = ', 1)[1].strip().removesuffix(';')
        self.assertEqual(json.loads(payload), module.compile_site(self.source))


class HTMLChecks(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = []; self.anchors = []; self.assets = []; self.aria = []; self.bad = []
    def handle_starttag(self, tag, pairs):
        a = dict(pairs)
        if 'id' in a: self.ids.append(a['id'])
        if a.get('href', '').startswith('#'): self.anchors.append(a['href'][1:])
        for key in ['aria-controls', 'aria-labelledby']:
            self.aria.extend(a.get(key, '').split())
        if tag in ['script', 'img'] and a.get('src'): self.assets.append(a['src'])
        if tag == 'link' and a.get('href'): self.assets.append(a['href'])
        if 'style' in a or any(key.startswith('on') for key in a): self.bad.append(tag)


def check_static_source():
    parser = HTMLChecks(); parser.feed((ROOT / 'dist/index.html').read_text())
    assert len(parser.ids) == len(set(parser.ids)), 'Duplicate HTML IDs'
    assert set(parser.anchors + parser.aria) <= set(parser.ids), 'Unresolved anchor/ARIA target'
    assert all((ROOT / 'dist' / asset).is_file() for asset in parser.assets), 'Missing local asset'
    assert not parser.bad, 'Unexpected inline handler/style'
    assert {'beranda', 'layanan', 'portofolio', 'progres', 'proses', 'lokasi', 'kontak', 'project-dialog'} <= set(parser.ids)
    forbidden = ['.pdf', '.docx', '.env', '.zip']
    for file in (ROOT / 'dist').rglob('*'):
        if not file.is_file(): continue
        assert file.suffix not in forbidden, 'Private/source artifact in public output'
        if file.suffix in ['.html', '.js']:
            data = file.read_text()
            assert not any(value in data for value in ['innerHTML', 'eval(', '141250313', '141250106', 'SURAT KUASA'])
    for file in ['script.js', 'content.js']:
        subprocess.run(['node', '--check', str(ROOT / 'dist' / file)], check=True)
    css = (ROOT / 'dist/styles.css').read_text()
    assert css.count('{') == css.count('}'), 'Unbalanced CSS blocks'
    assert 'prefers-reduced-motion' in css
    assert '@media(max-width:480px)' in css and '@media(max-width:760px)' in css
    manifest = json.loads((ROOT / '.openai/hosting.json').read_text())
    assert manifest['static']['directory'] == 'dist'
    print('Static checks passed: 9 requirement hooks, assets, anchors, ARIA, scripts, CSS, public-file boundaries.')


if __name__ == '__main__':
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(SourceChecks))
    if not result.wasSuccessful(): raise SystemExit(1)
    check_static_source()
