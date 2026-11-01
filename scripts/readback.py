"""Read production with curl, verify static source, redirects, API readiness and 404.

No form submission or credentials. Use --output to retain a machine-readable receipt.
Cloudflare removes email_off comments; this is the only accepted HTML transform.
"""
from pathlib import Path
import argparse
import json
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1] / 'public'
parser = argparse.ArgumentParser()
parser.add_argument('--output')
args = parser.parse_args()
results = []

def fetch(route):
    with tempfile.TemporaryDirectory(prefix='shpinat-readback-') as directory:
        body_path = Path(directory) / 'body'
        headers_path = Path(directory) / 'headers'
        result = subprocess.run(['curl', '--silent', '--show-error', '--location', '--max-time', '30', '--user-agent', 'Mozilla/5.0', '--output', str(body_path), '--dump-header', str(headers_path), '--write-out', '%{http_code}\n%{url_effective}', 'https://shpinat.club' + route], capture_output=True, text=True, check=True)
        status, final_url = result.stdout.split('\n', 1)
        headers = headers_path.read_text()
        return int(status), final_url, body_path.read_bytes(), headers

for path in sorted(ROOT.rglob('*')):
    if not path.is_file() or path.name.startswith('_') or path.name == '404.html':
        continue
    route = '/' + str(path.relative_to(ROOT))
    if path.name == 'index.html':
        route = route[:-10]
    status, final_url, body, headers = fetch(route)
    expected = re.sub(br'<!--/?email_off-->', b'', path.read_bytes())
    matched = body == expected
    assert status == 200 and matched, (route, status, 'source mismatch' if not matched else '')
    assert not re.search(r'(?im)^x-robots-tag:.*noindex', headers), route
    results.append({'route': route, 'status': status, 'source_matches': matched, 'bytes': len(body)})

status, _, body, _ = fetch('/definitely-missing-growth-qa/')
assert status == 404 and b'noindex' in body, ('missing route', status)
results.append({'route': '/definitely-missing-growth-qa/', 'status': status})
for route in ['/apply', '/program', '/contact']:
    status, final_url, _, _ = fetch(route)
    assert status == 200 and final_url.endswith(route + '/'), (route, status, final_url)
    results.append({'route': route, 'final_url': final_url, 'status': status})
status, _, body, _ = fetch('/api/config')
config = json.loads(body)
assert status == 200 and config['ready'] is True and config['contactEmail'] == 'call@shpinat.club', config
results.append({'route': '/api/config', 'status': status, 'ready': config['ready']})
receipt = {'origin': 'https://shpinat.club', 'checks': results}
if args.output:
    Path(args.output).write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(f'Production readback passed: {len(results)} routes/assets/API checks, source matches, redirects and real 404.')
