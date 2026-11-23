"use strict";
// Khởi động sau khi các file trong assets/js đã được nạp.
refresh().catch(() => notify("Không kết nối được máy chủ. Hãy chạy: python3 server.py rồi mở http://127.0.0.1:8000"));

// Nút làm mới dùng trên tất cả các trang
if (!document.getElementById("refresh-page-button")) {
  const refreshButton = document.createElement("button");

  refreshButton.id = "refresh-page-button";
  refreshButton.type = "button";
  refreshButton.textContent = "↻ Làm mới";
  refreshButton.setAttribute("aria-label", "Tải lại trang");

  refreshButton.addEventListener("click", () => {
    window.location.reload();
  });

  const pageActions = document.createElement("div");
  pageActions.id = "floating-page-actions";
  const topButton = document.createElement("button");
  topButton.id = "scroll-top-button";
  topButton.type = "button";
  topButton.textContent = "↑";
  topButton.title = "Lên đầu trang";
  topButton.setAttribute("aria-label", "Lên đầu trang");
  topButton.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
  });
  pageActions.append(topButton, refreshButton);
  document.body.append(pageActions);
}

// Ghi nhớ màn hình hiện tại trước khi tải lại hoặc rời trang.
window.addEventListener("pagehide", () => {
  try {
    if (location.hash === "#bau-cu") {
      sessionStorage.setItem(
        "inhaxio-election-view",
        electionAdminView
      );
    } else {
      sessionStorage.removeItem("inhaxio-election-view");
    }
  } catch {
    // Không ảnh hưởng hoạt động của trang.
  }
});