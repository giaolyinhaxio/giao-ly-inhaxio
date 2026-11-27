#!/usr/bin/env python3
"""Ứng dụng Giáo lý Inhaxio: Python HTTP server và Supabase."""

import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
from datetime import datetime
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
from supabase import create_client
from postgrest import APIError
from template_loader import render_html


ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "inhaxio.sqlite3"
HOST = os.environ.get("INHAXIO_HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT") or os.environ.get("INHAXIO_PORT", "8000"))
SESSION_SECONDS = 60 * 60 * 24 * 7
SHEET_KEYS = ("chien_con", "au_nhi", "thieu_nhi", "ban_giao_ly")
STATIC = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/assets/app.css": ("assets/app.css", "text/css; charset=utf-8"),
    "/assets/app.js": ("assets/app.js", "text/javascript; charset=utf-8"),
    "/assets/logo-inhaxio.jpg": ("assets/logo-inhaxio.jpg", "image/jpeg"),
}

# Mobile icons v1
STATIC.update({
    "/assets/apple-touch-icon.png": ("assets/apple-touch-icon.png", "image/png"),
    "/assets/icon-192.png": ("assets/icon-192.png", "image/png"),
    "/assets/icon-512.png": ("assets/icon-512.png", "image/png"),
    "/assets/site.webmanifest": ("assets/site.webmanifest", "application/manifest+json; charset=utf-8"),
})

# Chỉ phục vụ các tài nguyên được khai báo; không công khai .env hoặc data.
STATIC.update({
    '/assets/css/01-chung.css': ('assets/css/01-chung.css', 'text/css; charset=utf-8'),
    '/assets/css/02-trang-chu.css': ('assets/css/02-trang-chu.css', 'text/css; charset=utf-8'),
    '/assets/css/03-tieu-de.css': ('assets/css/03-tieu-de.css', 'text/css; charset=utf-8'),
    '/assets/css/04-lop-giao-ly.css': ('assets/css/04-lop-giao-ly.css', 'text/css; charset=utf-8'),
    '/assets/css/05-su-kien-quan-tri.css': ('assets/css/05-su-kien-quan-tri.css', 'text/css; charset=utf-8'),
    '/assets/css/06-chan-trang-hop-thoai.css': ('assets/css/06-chan-trang-hop-thoai.css', 'text/css; charset=utf-8'),
    '/assets/css/07-dien-thoai.css': ('assets/css/07-dien-thoai.css', 'text/css; charset=utf-8'),
    '/assets/css/08-thanh-menu.css': ('assets/css/08-thanh-menu.css', 'text/css; charset=utf-8'),
    '/assets/css/09-bau-cu.css': ('assets/css/09-bau-cu.css', 'text/css; charset=utf-8'),
    '/assets/css/10-thanh-vien-nut-noi.css': ('assets/css/10-thanh-vien-nut-noi.css', 'text/css; charset=utf-8'),
    '/assets/css/11-mau-lop.css': ('assets/css/11-mau-lop.css', 'text/css; charset=utf-8'),
    '/assets/css/12-trang-chu-va-ban.css': ('assets/css/12-trang-chu-va-ban.css', 'text/css; charset=utf-8'),
    '/assets/css/13-the-noi-dung.css': ('assets/css/13-the-noi-dung.css', 'text/css; charset=utf-8'),
    '/assets/css/14-dieu-huong.css': ('assets/css/14-dieu-huong.css', 'text/css; charset=utf-8'),
    '/assets/js/bau-cu/bo-phieu.js': ('assets/js/bau-cu/bo-phieu.js', 'text/javascript; charset=utf-8'),
    '/assets/js/bau-cu/chuan-bi.js': ('assets/js/bau-cu/chuan-bi.js', 'text/javascript; charset=utf-8'),
    '/assets/js/bau-cu/ket-qua-lich-su.js': ('assets/js/bau-cu/ket-qua-lich-su.js', 'text/javascript; charset=utf-8'),
    '/assets/js/bau-cu/quan-ly.js': ('assets/js/bau-cu/quan-ly.js', 'text/javascript; charset=utf-8'),
    '/assets/js/bau-cu/thanh-vien.js': ('assets/js/bau-cu/thanh-vien.js', 'text/javascript; charset=utf-8'),
    '/assets/js/chung.js': ('assets/js/chung.js', 'text/javascript; charset=utf-8'),
    '/assets/js/dang-nhap.js': ('assets/js/dang-nhap.js', 'text/javascript; charset=utf-8'),
    '/assets/js/dieu-huong.js': ('assets/js/dieu-huong.js', 'text/javascript; charset=utf-8'),
    '/assets/js/lop-giao-ly.js': ('assets/js/lop-giao-ly.js', 'text/javascript; charset=utf-8'),
    '/assets/js/quan-tri.js': ('assets/js/quan-tri.js', 'text/javascript; charset=utf-8'),
    '/assets/js/su-kien.js': ('assets/js/su-kien.js', 'text/javascript; charset=utf-8'),
})

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")

def supabase_auth_client():
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

def supabase_data_client():
    return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

def connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db():
    with connection() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('admin','user')),
                salt TEXT NOT NULL,
                password_hash TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                event_date TEXT NOT NULL,
                location TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
        """)
        for key in SHEET_KEYS:
            db.execute("INSERT OR IGNORE INTO settings(key,value) VALUES (?, '')", (key,))


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 260_000).hex()


def valid_account(data):
    username = str(data.get("username", "")).strip().lower()
    name = str(data.get("name", "")).strip()
    password = data.get("password", "")
    if not re.fullmatch(r"[a-z0-9_.-]{3,32}", username):
        raise ValueError("Tên đăng nhập cần 3–32 ký tự: chữ không dấu, số, _, . hoặc -.")
    if not 2 <= len(name) <= 80:
        raise ValueError("Họ tên cần từ 2 đến 80 ký tự.")
    if not isinstance(password, str) or not 8 <= len(password) <= 256:
        raise ValueError("Mật khẩu cần ít nhất 8 ký tự.")
    return username, name, password


def create_user(db, data, role):
    username, name, password = valid_account(data)
    salt = secrets.token_hex(16)
    try:
        db.execute(
            "INSERT INTO users(username,name,role,salt,password_hash) VALUES (?,?,?,?,?)",
            (username, name, role, salt, hash_password(password, salt)),
        )
    except sqlite3.IntegrityError:
        raise ValueError("Tên đăng nhập này đã được sử dụng.") from None

def cloud_hash_password(password, salt):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), 600_000
    ).hex()


def cloud_verify_credentials(username, password):
    if not isinstance(username, str) or not isinstance(password, str):
        raise PermissionError("ID hoặc mật khẩu không đúng.")

    rows = (
        supabase_data_client()
        .table("giaoly_accounts")
        .select("id,username,name,role,salt,password_hash")
        .eq("username", username.strip().lower())
        .limit(1)
        .execute().data
    )
    account = rows[0] if rows else None
    salt = account["salt"] if account else "00" * 16
    stored_hash = account["password_hash"] if account else "00" * 32
    entered_hash = cloud_hash_password(password, salt)

    if not hmac.compare_digest(entered_hash, stored_hash) or account is None:
        raise PermissionError("ID hoặc mật khẩu không đúng.")

    return {
        key: account[key]
        for key in ("id", "username", "name", "role")
    }


def cloud_create_session(user_id):
    token = secrets.token_hex(32)
    supabase_data_client().table("giaoly_app_sessions").insert({
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "user_id": user_id,
        "expires": int(time.time()) + SESSION_SECONDS,
    }).execute()
    return token


def cloud_user_from_token(token):
    if not isinstance(token, str) or not re.fullmatch(r"[0-9a-f]{64}", token):
        return None

    db = supabase_data_client()
    sessions = (
        db.table("giaoly_app_sessions")
        .select("user_id")
        .eq("token_hash", hashlib.sha256(token.encode()).hexdigest())
        .gt("expires", int(time.time()))
        .limit(1)
        .execute().data
    )
    if not sessions:
        return None

    accounts = (
        db.table("giaoly_accounts")
        .select("id,username,name,role")
        .eq("id", sessions[0]["user_id"])
        .limit(1)
        .execute().data
    )
    return accounts[0] if accounts else None


def cloud_delete_session(token):
    if not isinstance(token, str) or not re.fullmatch(r"[0-9a-f]{64}", token):
        return

    supabase_data_client().table("giaoly_app_sessions").delete().eq(
        "token_hash", hashlib.sha256(token.encode()).hexdigest()
    ).execute()

def valid_sheet_url(value):
    if not isinstance(value, str) or len(value) > 2000:
        raise ValueError("Liên kết Google Sheets không hợp lệ.")
    value = value.strip()
    if not value:
        return value
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname != "docs.google.com" or not parsed.path.startswith("/spreadsheets/"):
        raise ValueError("Vui lòng nhập liên kết Google Sheets bắt đầu bằng https://docs.google.com/spreadsheets/.")
    return value



def public_event_details(source):
    details = dict(source)
    details["documents"] = [d for d in details.get("documents", []) if not d.get("internal")]
    if isinstance(details.get("blocks"), list):
        details["blocks"] = [dict(b, attachments=[f for f in b.get("attachments", []) if not f.get("internal")])
                             for b in details["blocks"] if not b.get("internal")]
    return details


def validate_event(data):
    from urllib.parse import urlsplit
    def text(key, limit, source=data):
        value = str(source.get(key) or "").strip()
        if len(value) > limit:
            raise ValueError("Nội dung quá dài: " + key)
        return value
    def link(value):
        value = str(value or "").strip()
        if value and (len(value) > 2000 or urlsplit(value).scheme != "https" or not urlsplit(value).netloc):
            raise ValueError("Liên kết phải bắt đầu bằng https:// và có tên miền.")
        return value
    title = text("title", 120)
    if len(title) < 2:
        raise ValueError("Tên sự kiện cần ít nhất 2 ký tự.")
    d = data.get("details") or {}
    if not isinstance(d, dict):
        raise ValueError("Thông tin sự kiện không hợp lệ.")
    year = int(d.get("year") or datetime.now().year)
    if not 2000 <= year <= 2100:
        raise ValueError("Năm phải từ 2000 đến 2100.")
    unknown = d.get("unknown_date") is True
    date = text("event_date", 40)
    end = text("end", 40, d)
    deadline = text("deadline", 40, d)
    def check_date(value):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", value):
            raise ValueError("Ngày giờ không hợp lệ.")
        return datetime.fromisoformat(value)
    if unknown:
        date, end, deadline = f"{year}-01-01T00:00", "", ""
    else:
        begin = check_date(date)
        year = begin.year
        if end and check_date(end) < begin:
            raise ValueError("Kết thúc phải sau thời gian bắt đầu.")
        if deadline and check_date(deadline) > begin:
            raise ValueError("Hạn đăng ký phải trước thời gian bắt đầu.")
    visibility = d.get("visibility", "draft")
    status = d.get("status", "auto")
    if visibility not in ("draft", "published", "hidden", "trash") or status not in ("auto", "postponed", "cancelled"):
        raise ValueError("Trạng thái không hợp lệ.")
    docs = d.get("documents", [])
    if not isinstance(docs, list) or len(docs) > 50:
        raise ValueError("Tối đa 50 tài liệu.")
    clean = []
    for doc in docs:
        if not isinstance(doc, dict):
            raise ValueError("Tài liệu không hợp lệ.")
        name = text("name", 120, doc)
        url = link(doc.get("url"))
        if not name or not url:
            raise ValueError("Điền tên và liên kết cho từng tài liệu.")
        clean.append({"name": name, "url": url, "internal": doc.get("internal") is True})
    blocks = d.get("blocks")
    clean_blocks = None
    if blocks is not None:
        if not isinstance(blocks, list) or len(blocks) > 30:
            raise ValueError("Tối đa 30 hạng mục.")
        clean_blocks = []
        total_files = 0
        for block in blocks:
            if not isinstance(block, dict):
                raise ValueError("Hạng mục không hợp lệ.")
            block_title = text("title", 120, block)
            if not block_title:
                raise ValueError("Điền tên cho từng hạng mục.")
            files = block.get("attachments", [])
            if not isinstance(files, list) or len(files) > 50:
                raise ValueError("Tối đa 50 tệp mỗi hạng mục.")
            total_files += len(files)
            if total_files > 200:
                raise ValueError("Tối đa 200 tệp trong một sự kiện.")
            clean_files = []
            for file in files:
                if not isinstance(file, dict):
                    raise ValueError("Tệp đính kèm không hợp lệ.")
                name, url = text("name", 120, file), link(file.get("url"))
                if not name or not url:
                    raise ValueError("Điền tên và liên kết cho từng tệp.")
                clean_files.append({"name": name, "url": url, "internal": file.get("internal") is True})
            clean_blocks.append({"title": block_title, "notes": text("notes", 10000, block),
                                 "internal": block.get("internal") is True, "attachments": clean_files})
    return {"title": title, "event_date": date, "location": text("location", 160),
            "description": text("description", 2000), "details": {
                "year": year, "unknown_date": unknown, "end": end, "deadline": deadline,
                "visibility": visibility, "status": status,
                "content": text("content", 15000, d), "schedule": text("schedule", 10000, d),
                "registration": link(d.get("registration")), "album": link(d.get("album")),
                "cover": link(d.get("cover")), "documents": clean,
                **({"blocks": clean_blocks} if clean_blocks is not None else {})}}

class Handler(BaseHTTPRequestHandler):
    server_version = "Inhaxio/1.0"

    def _json(self, code, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        if not self.headers.get("Content-Type", "").lower().startswith("application/json"):
            raise ValueError("Yêu cầu cần gửi JSON.")
        size = int(self.headers.get("Content-Length", "0"))
        limit = 1_048_576 if self.path.split("?", 1)[0].startswith("/api/events") else 16_384
        if size < 1 or size > limit:
            raise ValueError("Dữ liệu gửi lên quá lớn hoặc trống.")
        data = json.loads(self.rfile.read(size))
        if not isinstance(data, dict):
            raise ValueError("Dữ liệu gửi lên không hợp lệ.")
        return data

    def _check_request(self):
        # Content-Type + header riêng + Origin ngăn biểu mẫu từ trang khác thay đổi dữ liệu.
        if self.headers.get("X-Inhaxio-Request") != "1":
            raise PermissionError("Yêu cầu không hợp lệ.")
        origin = self.headers.get("Origin")
        host = self.headers.get("Host", "")
        if origin and origin not in {f"http://{host}", f"https://{host}"}:
            raise PermissionError("Yêu cầu khác nguồn không được phép.")

    def _user(self, db):
        raw = self.headers.get("Cookie", "")
        if len(raw) > 4096:
            return None

        cookies = SimpleCookie()
        try:
            cookies.load(raw)
        except Exception:
            return None

        token = cookies.get("inhaxio_session")
        return cloud_user_from_token(token.value) if token else None

    def _session_cookie(self, db, user_id):
        token = cloud_create_session(user_id)
        secure = (
            "; Secure"
            if os.environ.get("INHAXIO_PUBLIC_URL", "").startswith("https://")
            else ""
        )
        return (
            f"inhaxio_session={token}; HttpOnly; SameSite=Lax; "
            f"Path=/; Max-Age={SESSION_SECONDS}{secure}"
        )

    def _require_admin(self, db):
        user = self._user(db)
        if not user or user["role"] != "admin":
            raise PermissionError("Chỉ tài khoản quản trị được thay đổi nội dung.")
        return user

    def do_GET(self):
        path = urlparse(self.path).path
        if path in STATIC:
            filename, mime = STATIC[path]
            contents = (render_html(ROOT).encode("utf-8")
                        if filename == "index.html" else (ROOT / filename).read_bytes())
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(contents)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: https://api.qrserver.com; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
            self.end_headers()
            self.wfile.write(contents)
            return
        if path == "/api/election":
            try:
                cloud = supabase_data_client()
                elections = (
                    cloud.table("giaoly_elections")
                    .select("id,title,choices_per_ballot,status,cancelled")
                    .order("id", desc=True)
                    .limit(1)
                    .execute().data
                )

                if not elections:
                    self._json(200, {"election": None, "candidates": []})
                    return

                election = elections[0]
                candidates = (
                    cloud.table("giaoly_candidates")
                    .select("id,full_name,description,member_id")
                    .eq("election_id", election["id"])
                    .order("id")
                    .execute().data
                )
                self._json(200, {
                    "election": election,
                    "candidates": candidates,
                })
            except Exception:
                self.log_exception()
                self._json(500, {"error": "Không tải được thông tin bầu cử."})
            return
        if path == "/api/members":
            try:
                self._require_admin(None)
                members = (supabase_data_client().table("giaoly_members")
                           .select("id,full_name,description")
                           .eq("active", True).order("full_name").order("id")
                           .execute().data)
                self._json(200, {"members": members})
            except PermissionError as exc:
                self._json(403, {"error": str(exc)})
            except Exception:
                self.log_exception()
                self._json(500, {"error": "Không tải được danh sách thành viên."})
            return
        if path == "/api/election/history":
            try:
                self._require_admin(None)
                cloud = supabase_data_client()
                elections = (
                    cloud.table("giaoly_elections")
                    .select("id,title,status,cancelled")
                    .order("id", desc=True)
                    .execute().data
                )
                from urllib.parse import parse_qs

                query = parse_qs(urlparse(self.path).query)
                detail_id = query.get("id", [None])[0]

                if detail_id is None:
                    self._json(200, {
                        "elections": [
                            {
                                "id": election["id"],
                                "title": election["title"],
                            }
                            for election in elections
                            if election["status"] in ("closed", "published")
                        ]
                    })
                    return

                elections = [
                    election
                    for election in elections
                    if str(election["id"]) == detail_id
                ]
                history = []
                for election in elections:
                    if election["status"] not in ("closed", "published"):
                        continue
                    results = cloud.rpc(
                        "giaoly_election_results",
                        {"p_election_id": election["id"]},
                    ).execute().data
                    count = (
                        cloud.table("giaoly_ballots")
                        .select("id", count="exact")
                        .eq("election_id", election["id"])
                        .limit(1)
                        .execute().count
                    ) or 0
                    history.append({
                        "id": election["id"],
                        "title": election["title"],
                        "status": "Đã hủy" if election["cancelled"] else
                                  "Đã công bố" if election["status"] == "published" else "Đã kết thúc",
                        "total_ballots": count,
                        "results": sorted(
                            results,
                            key=lambda row: (-int(row["vote_count"]), row["full_name"]),
                        ),
                    })
                self._json(200, {"elections": history})
            except PermissionError as exc:
                self._json(403, {"error": str(exc)})
            except Exception:
                self.log_exception()
                self._json(500, {"error": "Không tải được lịch sử bầu cử."})
            return
        if path == "/api/election/results":
            try:
                cloud = supabase_data_client()
                latest = (
                    cloud.table("giaoly_elections")
                    .select("id,title,status,cancelled")
                    .order("id", desc=True)
                    .limit(1)
                    .execute().data
                )
                if not latest:
                    self._json(404, {"error": "Chưa có cuộc bầu cử."})
                    return

                election = latest[0]
                if election["status"] != "published" or election["cancelled"]:
                    user = self._user(None)
                    if (election["status"] not in ("open", "closed") or
                            election["cancelled"] or not user or user["role"] != "admin"):
                        self._json(403, {"error": "Kết quả chưa được công bố."})
                        return

                results = (
                    cloud.rpc(
                        "giaoly_election_results",
                        {"p_election_id": election["id"]},
                    )
                    .execute().data
                )
                total_ballots = (
                    cloud.table("giaoly_ballots")
                    .select("id", count="exact")
                    .eq("election_id", election["id"])
                    .limit(1)
                    .execute().count
                ) or 0

                self._json(200, {
                    "election": election,
                    "total_ballots": total_ballots,
                    "results": results,
                })
            except Exception:
                self.log_exception()
                self._json(500, {"error": "Không tải được kết quả bầu cử."})
            return
        if path == "/api/state":
            with connection() as db:
                user = self._user(db)
                cloud = supabase_data_client()

                links = {
                    row["key"]: row["value"] or ""
                    for row in cloud.table("giaoly_settings")
                    .select("key,value")
                    .execute().data
                }
                if not user:
                    links.pop("ban_giao_ly", None)

                events = (
                    cloud.table("giaoly_events")
                    .select("id,title,event_date,location,description,details")
                    .order("event_date")
                    .order("id")
                    .execute().data
                )

                if not user or user["role"] != "admin":
                    events = [e for e in events if (e.get("details") or {}).get("visibility", "published") == "published"]
                    for e in events:
                        e["details"] = public_event_details(e.get("details") or {})

                self._json(200, {
                    "initialized": True,
                    "user": dict(user) if user else None,
                    "links": links,
                    "events": events,
                })
            return
        self._json(404, {"error": "Không tìm thấy trang."})

    def do_POST(self):
        self._mutation("POST")

    def do_PUT(self):
        self._mutation("PUT")

    def do_DELETE(self):
        self._mutation("DELETE")

    def _mutation(self, method):
        path = urlparse(self.path).path
        try:
            self._check_request()
            data = self._read_json()
            with connection() as db:
                if method == "DELETE" and re.fullmatch(
                    r"/api/election/history/\d+", path
                ):
                    self._require_admin(db)
                    cloud = supabase_data_client()
                    election_id = int(path.rsplit("/", 1)[1])

                    rows = (
                        cloud.table("giaoly_elections")
                        .select("id,status")
                        .eq("id", election_id)
                        .execute()
                        .data
                    )

                    if not rows:
                        raise ValueError("Cuộc bầu cử không còn tồn tại.")

                    if rows[0]["status"] not in ("closed", "published"):
                        raise ValueError(
                            "Chỉ được xóa cuộc bầu cử đã kết thúc hoặc đã hủy."
                        )

                    cloud.rpc(
                        "giaoly_delete_election",
                        {"p_election_id": election_id},
                    ).execute()

                    self._json(200, {"ok": True})
                    return

                if method == "POST" and path == "/api/login":
                    account = cloud_verify_credentials(
                        data.get("username"), data.get("password")
                    )
                    cookie = self._session_cookie(db, account["id"])
                    self._json(200, {"ok": True}, cookie)
                    return

                if method == "POST" and path == "/api/logout":
                    cookies = SimpleCookie()
                    try:
                        cookies.load(self.headers.get("Cookie", ""))
                    except Exception:
                        pass

                    token = cookies.get("inhaxio_session")
                    if token:
                        cloud_delete_session(token.value)

                    self._json(
                        200, {"ok": True},
                        "inhaxio_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
                    )
                    return
                if ((method == "POST" and path == "/api/members") or
                        (method in ("PUT", "DELETE") and
                         re.fullmatch(r"/api/members/\d+", path))):
                    self._require_admin(db)
                    cloud = supabase_data_client()
                    if method == "DELETE":
                        member_id = int(path.rsplit("/", 1)[1])
                        updated = (cloud.table("giaoly_members")
                                   .update({"active": False})
                                   .eq("id", member_id).eq("active", True)
                                   .execute().data)
                        if not updated:
                            raise ValueError("Không tìm thấy thành viên.")
                        draft = (cloud.table("giaoly_elections")
                                 .select("id,status").order("id", desc=True)
                                 .limit(1).execute().data)
                        if draft and draft[0]["status"] == "draft":
                            (cloud.table("giaoly_candidates").delete()
                             .eq("election_id", draft[0]["id"])
                             .eq("member_id", member_id).execute())
                        self._json(200, {"ok": True})
                        return

                    name = data.get("full_name")
                    description = data.get("description", "")
                    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
                        raise ValueError("Tên thành viên cần từ 1 đến 120 ký tự.")
                    if not isinstance(description, str) or len(description) > 500:
                        raise ValueError("Ghi chú không được quá 500 ký tự.")
                    values = {"full_name": name.strip(),
                              "description": description.strip()}
                    if method == "POST":
                        saved = cloud.table("giaoly_members").insert(values).execute().data
                    else:
                        member_id = int(path.rsplit("/", 1)[1])
                        saved = (cloud.table("giaoly_members").update(values)
                                 .eq("id", member_id).eq("active", True)
                                 .execute().data)
                    if not saved:
                        raise ValueError("Không tìm thấy thành viên.")
                    if method == "PUT":
                        draft = (cloud.table("giaoly_elections")
                                 .select("id,status").order("id", desc=True)
                                 .limit(1).execute().data)
                        if draft and draft[0]["status"] == "draft":
                            (cloud.table("giaoly_candidates").update(values)
                             .eq("election_id", draft[0]["id"])
                             .eq("member_id", member_id).execute())
                    self._json(201 if method == "POST" else 200,
                               {"member": saved[0]})
                    return
                if method == "POST" and path == "/api/election":
                    self._require_admin(db)

                    title = data.get("title")
                    choices = data.get("choices_per_ballot")

                    if not isinstance(title, str) or not 2 <= len(title.strip()) <= 120:
                        raise ValueError("Tên cuộc bầu cử cần từ 2 đến 120 ký tự.")
                    if type(choices) is not int or not 1 <= choices <= 5:
                        raise ValueError("Số người cần chọn phải từ 1 đến 5.")

                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("status,cancelled")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if latest and latest[0]["status"] != "published" and not latest[0]["cancelled"]:
                        raise ValueError("Hãy hoàn tất cuộc bầu cử hiện tại trước.")

                    created = (
                        cloud.table("giaoly_elections")
                        .insert({
                            "title": title.strip(),
                            "choices_per_ballot": choices,
                            "status": "draft",
                        })
                        .execute().data
                    )
                    self._json(201, {"election": created[0]})
                    return
                if method == "PUT" and path == "/api/election/title":
                    self._require_admin(db)
                    title = data.get("title")
                    if not isinstance(title, str) or not 2 <= len(title.strip()) <= 120:
                        raise ValueError("Tên cuộc bầu cử cần từ 2 đến 120 ký tự.")
                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("id,status")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if not latest or latest[0]["status"] != "draft":
                        raise ValueError("Chỉ được sửa tên trước khi bắt đầu bầu cử.")
                    updated = (
                        cloud.table("giaoly_elections")
                        .update({"title": title.strip()})
                        .eq("id", latest[0]["id"])
                        .eq("status", "draft")
                        .execute().data
                    )
                    if not updated:
                        raise ValueError("Không lưu được tên cuộc bầu cử.")
                    self._json(200, {"election": updated[0]})
                    return
                if method == "POST" and path == "/api/candidates":
                    self._require_admin(db)
                    member_ids = data.get("member_ids")
                    if (not isinstance(member_ids, list) or
                            not 1 <= len(member_ids) <= 100 or
                            any(type(x) is not int or x <= 0 for x in member_ids) or
                            len(set(member_ids)) != len(member_ids)):
                        raise ValueError("Hãy chọn thành viên hợp lệ từ danh sách.")

                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("id,status")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if not latest or latest[0]["status"] != "draft":
                        raise ValueError("Chỉ được thêm ứng cử viên trước khi bắt đầu bầu cử.")

                    existing = (cloud.table("giaoly_candidates")
                                .select("member_id")
                                .eq("election_id", latest[0]["id"])
                                .execute().data)
                    if set(member_ids) & {row["member_id"] for row in existing}:
                        raise ValueError("Một số thành viên đã có trong danh sách ứng cử.")
                    members = (cloud.table("giaoly_members")
                               .select("id,full_name,description")
                               .eq("active", True).in_("id", member_ids)
                               .execute().data)
                    if len(members) != len(member_ids):
                        raise ValueError("Danh sách thành viên đã thay đổi. Vui lòng tải lại.")
                    rows = [{"election_id": latest[0]["id"],
                             "member_id": member["id"],
                             "full_name": member["full_name"],
                             "description": member["description"]}
                            for member in members]
                    created = cloud.table("giaoly_candidates").insert(rows).execute().data
                    self._json(201, {"candidates": created})
                    return

                if method == "DELETE" and re.fullmatch(r"/api/candidates/\d+", path):
                    self._require_admin(db)

                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("id,status")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if not latest or latest[0]["status"] != "draft":
                        raise ValueError("Chỉ được xóa ứng cử viên trước khi bắt đầu bầu cử.")

                    candidate_id = int(path.rsplit("/", 1)[1])
                    deleted = (
                        cloud.table("giaoly_candidates")
                        .delete()
                        .eq("id", candidate_id)
                        .eq("election_id", latest[0]["id"])
                        .execute().data
                    )
                    if not deleted:
                        raise ValueError("Không tìm thấy ứng cử viên.")

                    self._json(200, {"ok": True})
                    return
                if method == "PUT" and path == "/api/election/choices":
                    self._require_admin(db)
                    choices = data.get("choices_per_ballot")
                    if type(choices) is not int or not 1 <= choices <= 5:
                        raise ValueError("Số người cần chọn phải từ 1 đến 5.")

                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("id,status")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if not latest or latest[0]["status"] != "draft":
                        raise ValueError("Chỉ được đổi số người cần chọn trước khi bắt đầu.")

                    updated = (
                        cloud.table("giaoly_elections")
                        .update({"choices_per_ballot": choices})
                        .eq("id", latest[0]["id"])
                        .eq("status", "draft")
                        .execute().data
                    )
                    if not updated:
                        raise ValueError("Không cập nhật được cuộc bầu cử.")

                    self._json(200, {"election": updated[0]})
                    return

                if method == "POST" and path == "/api/election/start":
                    self._require_admin(db)

                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("id,status,choices_per_ballot")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if not latest or latest[0]["status"] != "draft":
                        raise ValueError("Cuộc bầu cử không ở trạng thái chuẩn bị.")

                    election = latest[0]
                    candidate_count = (
                        cloud.table("giaoly_candidates")
                        .select("id", count="exact")
                        .eq("election_id", election["id"])
                        .limit(1)
                        .execute().count
                    ) or 0

                    if candidate_count < election["choices_per_ballot"]:
                        raise ValueError(
                            "Số ứng cử viên ít hơn số người cần chọn trên mỗi phiếu."
                        )

                    updated = (
                        cloud.table("giaoly_elections")
                        .update({"status": "open"})
                        .eq("id", election["id"])
                        .eq("status", "draft")
                        .execute().data
                    )
                    if not updated:
                        raise ValueError("Không bắt đầu được cuộc bầu cử.")

                    self._json(200, {"election": updated[0]})
                    return
                if method == "POST" and path == "/api/election/vote":
                    election_id = data.get("election_id")
                    candidate_ids = data.get("candidate_ids")
                    submission_key = data.get("submission_key")

                    if type(election_id) is not int or election_id <= 0:
                        raise ValueError("Cuộc bầu cử không hợp lệ.")
                    if (
                        not isinstance(candidate_ids, list)
                        or not 1 <= len(candidate_ids) <= 100
                        or any(type(x) is not int or x <= 0 for x in candidate_ids)
                    ):
                        raise ValueError("Danh sách lựa chọn không hợp lệ.")
                    if (
                        not isinstance(submission_key, str)
                        or not re.fullmatch(
                            r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}",
                            submission_key,
                        )
                    ):
                        raise ValueError("Mã gửi phiếu không hợp lệ.")

                    try:
                        supabase_data_client().rpc(
                            "giaoly_submit_ballot",
                            {
                                "p_election_id": election_id,
                                "p_candidate_ids": candidate_ids,
                                "p_submission_key": submission_key,
                            },
                        ).execute()
                    except APIError as exc:
                        messages = {
                            "Cuộc bầu cử hiện chưa mở hoặc đã kết thúc":
                                "Hiện tại chưa được bầu cử.",
                            "Số ứng cử viên được chọn không đúng quy định":
                                "Bạn chưa chọn đúng số người quy định.",
                            "Có ứng cử viên không thuộc cuộc bầu cử này":
                                "Danh sách ứng cử viên đã thay đổi. Vui lòng tải lại trang.",
                            "Mã gửi phiếu đã được dùng cho lựa chọn khác":
                                "Phiếu này đã được gửi với lựa chọn khác.",
                        }
                        if exc.message in messages:
                            raise ValueError(messages[exc.message]) from None
                        raise

                    self._json(200, {
                        "ok": True,
                        "message": "Đã ghi nhận phiếu bầu.",
                    })
                    return
                if method == "POST" and path in (
                    "/api/election/close",
                    "/api/election/publish",
                    "/api/election/cancel",
                ):
                    self._require_admin(db)

                    if path == "/api/election/close":
                        expected_status = "open"
                        next_status = "closed"
                        error_message = "Cuộc bầu cử chưa bắt đầu hoặc đã kết thúc."
                    elif path == "/api/election/cancel":
                        expected_status = "open"
                        next_status = "closed"
                        error_message = "Chỉ được hủy khi bầu cử đang diễn ra."
                    else:
                        expected_status = "closed"
                        next_status = "published"
                        error_message = "Hãy kết thúc bầu cử trước khi công bố."

                    cloud = supabase_data_client()
                    latest = (
                        cloud.table("giaoly_elections")
                        .select("id,status,cancelled")
                        .order("id", desc=True)
                        .limit(1)
                        .execute().data
                    )
                    if (not latest or latest[0]["status"] != expected_status or
                            latest[0]["cancelled"]):
                        raise ValueError(error_message)

                    values = {"status": next_status}
                    if path == "/api/election/cancel":
                        values["cancelled"] = True
                    updated = (
                        cloud.table("giaoly_elections")
                        .update(values)
                        .eq("id", latest[0]["id"])
                        .eq("status", expected_status)
                        .execute().data
                    )
                    if not updated:
                        raise ValueError("Trạng thái bầu cử đã thay đổi. Vui lòng tải lại.")

                    self._json(200, {"election": updated[0]})
                    return
                if method == "PUT" and path == "/api/links":
                    self._require_admin(db)
                    if set(data) != set(SHEET_KEYS):
                        raise ValueError("Danh sách liên kết chưa đầy đủ.")

                    rows = [
                        {"key": key, "value": valid_sheet_url(data[key])}
                        for key in SHEET_KEYS
                    ]
                    supabase_data_client().table("giaoly_settings").upsert(
                        rows, on_conflict="key"
                    ).execute()

                    self._json(200, {"ok": True})
                    return
                if method in ("POST", "PUT") and (path == "/api/events" or re.fullmatch(r"/api/events/\d+", path)):
                    self._require_admin(db)
                    values = validate_event(data)
                    cloud = supabase_data_client()
                    if method == "POST" and path == "/api/events":
                        cloud.table("giaoly_events").insert(values).execute()
                    elif method == "PUT" and path != "/api/events":
                        changed = (cloud.table("giaoly_events").update(values)
                                   .eq("id", int(path.rsplit("/", 1)[1])).execute().data)
                        if not changed:
                            raise ValueError("Không tìm thấy sự kiện.")
                    else:
                        raise ValueError("Đường dẫn không hợp lệ.")
                    self._json(200, {"ok": True})
                    return
                if method == "DELETE" and re.fullmatch(r"/api/events/\d+", path):
                    self._require_admin(db)
                    changed = supabase_data_client().table("giaoly_events").delete().eq(
                        "id", int(path.rsplit("/", 1)[1])).execute().data
                    if not changed:
                        raise ValueError("Không tìm thấy sự kiện.")
                    self._json(200, {"ok": True})
                    return
                self._json(404, {"error": "Không tìm thấy chức năng."})
        except PermissionError as exc:
            self._json(403, {"error": str(exc)})
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self._json(400, {"error": str(exc)})
        except Exception:
            self.log_exception()
            self._json(500, {"error": "Có lỗi xảy ra. Vui lòng thử lại."})

    def log_exception(self):
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    init_db()
    print(f"Giáo lý Inhaxio: http://{HOST}:{PORT}")
    print("Nhấn Ctrl+C để dừng. Dữ liệu ứng dụng lưu trên Supabase.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
