"""Ghép các phần HTML nội bộ; không đọc đường dẫn do người dùng gửi lên."""
import re
from pathlib import Path
INCLUDE = re.compile(r"<!-- include: ([a-zA-Z0-9_./-]+) -->")
def render_html(root, filename="index.html", chain=()):
    root = Path(root).resolve()
    path = (root / filename).resolve()
    if path != root / "index.html" and not any(parent in path.parents for parent in (root / "pages", root / "components")):
        raise ValueError("Đường dẫn template không hợp lệ")
    if path.suffix != ".html" or path in chain:
        raise ValueError("Template không hợp lệ hoặc lặp include")
    text = path.read_text(encoding="utf-8")
    return INCLUDE.sub(lambda match: render_html(root, match.group(1), chain + (path,)), text)
