"""Deploy the private lead service with an explicitly restricted mail recipient.

LEAD_NOTIFICATION_EMAIL is runtime configuration and is never written to the repo.
Cloudflare authentication is supplied by Wrangler's existing login/environment.
"""
from pathlib import Path
import json
import os
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
recipient = os.environ.get('LEAD_NOTIFICATION_EMAIL', '')
if not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+', recipient):
    raise SystemExit('LEAD_NOTIFICATION_EMAIL required: verified Cloudflare destination')
wrangler = os.environ.get('WRANGLER_BIN')
if not wrangler:
    raise SystemExit('WRANGLER_BIN required: absolute path to wrangler/bin/wrangler.js')
config = (root / 'worker/wrangler.toml').read_text()
config = config.replace('main = "index.js"', 'main = ' + json.dumps(str(root / 'worker/index.js')))
config = config.replace('migrations_dir = "../migrations"', 'migrations_dir = ' + json.dumps(str(root / 'migrations')))
config += '\ndestination_address = ' + json.dumps(recipient) + '\n'
with tempfile.TemporaryDirectory(prefix='shpinat-deploy-') as directory:
    target = Path(directory) / 'wrangler.toml'
    target.write_text(config)
    subprocess.run(['node', wrangler, 'deploy', '--config', str(target)], cwd=root, check=True)
