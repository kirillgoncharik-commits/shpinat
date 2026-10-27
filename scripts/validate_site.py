"""Validate static routes, assets, links, and XML without third-party packages."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from collections import Counter
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / "public"


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links = [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.append(attrs["id"])
        for attr in ("src", "href"):
            if attrs.get(attr):
                self.links.append(attrs[attr])


pages = {}
for path in ROOT.rglob("*.html"):
    page = Page()
    page.feed(path.read_text(encoding="utf-8"))
    assert not [x for x, n in Counter(page.ids).items() if n > 1], path
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

images = list((ROOT / "assets").glob("*.webp")) + list((ROOT / "assets").glob("*.png"))
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
