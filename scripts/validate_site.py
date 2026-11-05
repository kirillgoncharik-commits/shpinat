"""Validate static routes, assets, links, and XML without third-party packages."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from collections import Counter
import xml.etree.ElementTree as ET
import json

ROOT = Path(__file__).resolve().parents[1] / "public"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links = [], []
        self.h1s, self.images, self.canonicals, self.meta = 0, [], [], {}
        self.schemas, self.in_schema, self.schema_text = [], False, ''

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1':
            self.h1s += 1
        if tag == 'img':
            self.images.append(attrs)
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonicals.append(attrs.get('href'))
        if tag == 'meta':
            self.meta[attrs.get('name') or attrs.get('property')] = attrs.get('content', '')
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.in_schema, self.schema_text = True, ''
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for attr in ("src", "href"):
            if attrs.get(attr):
                self.links.append(attrs[attr])

    def handle_data(self, data):
        if self.in_schema:
            self.schema_text += data

    def handle_endtag(self, tag):
        if tag == 'script' and self.in_schema:
            self.schemas.append(json.loads(self.schema_text))
            self.in_schema = False


pages = {}
for path in ROOT.rglob("*.html"):
    page = Page()
    page.feed(path.read_text(encoding="utf-8"))
    assert not [x for x, n in Counter(page.ids).items() if n > 1], path
    assert page.h1s == 1, (path, 'expected one H1')
    assert all('alt' in image for image in page.images), (path, 'image missing alt')
    if path.name != '404.html':
        route = '/' + str(path.parent.relative_to(ROOT)).strip('.')
        route = route.rstrip('/') + '/'
        assert page.canonicals == ['https://shpinat.club' + route], (path, 'canonical')
        assert 'noindex' not in page.meta.get('robots', ''), (path, 'noindex')
        for key in ['description', 'og:title', 'og:description', 'og:url', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']:
            assert page.meta.get(key), (path, key)
        types = {item['@type'] for schema in page.schemas for item in schema.get('@graph', [])}
        assert {'WebSite', 'Organization', 'WebPage'} <= types, (path, 'schema')
    pages[path.resolve()] = page

for path, page in pages.items():
    for link in page.links:
        url = urlsplit(link)
        if url.scheme or url.netloc:
            continue
        target = ROOT / unquote(url.path).lstrip("/") if url.path.startswith("/") else path.parent / unquote(url.path) if url.path else path
        if target.is_dir():
            target = target / "index.html"
        assert target.is_file(), (path, link, "missing target")
        assert target.stat().st_size > 0, (path, link, "empty target")
        if url.fragment and target.suffix == ".html":
            assert unquote(url.fragment) in pages[target.resolve()].ids, (path, link, "missing anchor")

images = list((ROOT / "assets").rglob("*.webp")) + list((ROOT / "assets").rglob("*.png"))
for path in images:
    data = path.read_bytes()
    if path.suffix == ".webp":
        assert len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP", path
        assert int.from_bytes(data[4:8], "little") + 8 == len(data), (path, "truncated WebP")
    else:
        assert data.startswith(b"\x89PNG\r\n\x1a\n") and b"IEND" in data[-12:], path

tree = ET.parse(ROOT / "sitemap.xml")
for loc in tree.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
    url = urlsplit(loc.text)
    assert url.scheme == "https" and url.netloc == "shpinat.club", loc.text
    assert (ROOT / url.path.lstrip("/") / "index.html").is_file(), loc.text

print(f"Validated {len(pages)} HTML pages, {len(images)} images, local links, anchors, and sitemap.")
