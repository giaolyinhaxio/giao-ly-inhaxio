# Giáo lý Inhaxio

Ứng dụng chạy trên máy cá nhân bằng Python 3, không cần cài thêm thư viện. Gồm:

- Trang chủ, menu ☰, logo của cộng đoàn và giao diện thích ứng điện thoại.
- Ba lớp: Chiên Con, Ấu Nhi, Thiếu Nhi. Mỗi lớp mở giáo án Google Sheets trong tab mới.
- Ban Giáo lý: liên kết bảng thông tin chỉ hiện với tài khoản đã đăng nhập.
- Các sự kiện: mọi người xem được; quản trị viên thêm, sửa, xóa.
- Bầu cử: trang chờ thông tin chi tiết.
- Tài khoản quản trị và tài khoản người dùng, dữ liệu lưu bằng SQLite trong thư mục `data`.

## Cài vào Downloads trên Mac

1. Tải `giao-ly-inhaxio.zip` về máy và giải nén. Sau khi giải nén phải có file:

   `/Users/iwashiro/Downloads/giao-ly-inhaxio/index.html`

   và `/Users/iwashiro/Downloads/giao-ly-inhaxio/server.py`.

2. Mở **Terminal**, chạy:

   ```bash
   cd /Users/iwashiro/Downloads/giao-ly-inhaxio
   python3 server.py
   ```

3. Mở **http://127.0.0.1:8000** trong trình duyệt. Giữ cửa sổ Terminal đang chạy. Nhấn `Ctrl+C` trong Terminal để dừng.

Nếu hiện `command not found: python3`, hãy cài Python 3 rồi chạy lại. Nếu cổng 8000 đã được dùng, chạy `INHAXIO_PORT=8001 python3 server.py` và mở **http://127.0.0.1:8001**.

**Quan trọng:** Không mở `index.html` bằng lệnh `open` hoặc nhấp đúp để dùng tính năng đăng nhập; các tính năng này cần `server.py` đang chạy. Mở trực tiếp `index.html` chỉ xem được một phần giao diện.

## Cách thiết lập

1. Nhấn ☰ → **Đăng nhập tài khoản** → **Tạo quản trị viên** (lần đầu chạy). Hãy tạo tài khoản này khi app chỉ đang mở trên chính máy của bạn.
2. Nhấn ☰ → **Quản trị liên kết**; dán các URL Google Sheets cho ba lớp và Ban, rồi lưu. Có thể để trống và thêm sau.
3. Vào **Các sự kiện** → **Thêm sự kiện** để nhập thông tin.
4. Những người khác vào ☰ → **Đăng nhập tài khoản** → **Tạo tài khoản người dùng**. Tài khoản thường không sửa được liên kết và sự kiện.

**Lưu ý về Google Sheets:** App chỉ chuyển tới liên kết. Chủ file Sheets vẫn phải cấp quyền xem phù hợp; tài khoản app không thay quyền của tài khoản Google. Đừng đặt bảng thông tin nhạy cảm ở chế độ “bất kỳ ai có liên kết” nếu Ban cần giữ riêng.

## Dữ liệu và giới hạn của bản này

- Dữ liệu lưu trong `data/inhaxio.sqlite3` **trên máy đang chạy server**. Khi cập nhật mã nguồn, giữ lại file này nếu muốn giữ tài khoản, link và sự kiện; chỉ cần giải nén bản mới vào một thư mục khác rồi sao chép file dữ liệu qua.
- Máy khác chưa truy cập được địa chỉ `127.0.0.1` của bạn. Muốn cả Ban dùng trên Internet cần triển khai server, cơ sở dữ liệu, HTTPS, sao lưu và thiết lập quyền truy cập phù hợp. Bản local này chưa được chuẩn bị để công khai lên Internet.
- Người dùng có thể tự đăng ký; chưa có xác minh email, khôi phục mật khẩu, quản lý thành viên, hay chức năng bỏ phiếu. Hai vai trò hiện có: quản trị sửa nội dung, người dùng xem nội dung. Quyền có thể thiết kế lại sau.
- Logo gốc nằm ở `assets/logo-inhaxio.jpg`. Thay logo bằng ảnh khác cùng tên nếu cần.

## Cấu trúc

```text
giao-ly-inhaxio/
├── index.html
├── server.py
├── assets/
│   ├── app.css
│   ├── app.js
│   └── logo-inhaxio.jpg
└── data/
    └── inhaxio.sqlite3 (tự tạo khi chạy)
```



-Khởi động:
python -m py_compile server.py
python server.py


-Khi file chưa có dòng mới ở cuối thì chỉnh chỉnh gọn bằng:
printf 'supabase==2.33.0\n' > requirements.txt







