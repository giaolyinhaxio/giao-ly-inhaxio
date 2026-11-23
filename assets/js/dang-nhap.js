"use strict";
function renderAccount() {
  $("#header-auth").hidden = !!state.user;
  $("#header-logout").hidden = !state.user;
  $("#drawer-logout").hidden = !state.user;
  $("#drawer-auth").hidden = !!state.user;
  $("#account-chip").hidden = !state.user;
  if (state.user) $("#account-chip").textContent = `${state.user.name} · ${state.user.role === "admin" ? "Quản trị" : "Thành viên"}`;
  const existing = $("#admin-nav");
  if (existing) existing.remove();
  if (state.user?.role === "admin") {
    const link = textElement("a", "", "Quản trị liên kết");
    link.id = "admin-nav";
    link.href = "#quan-tri";
    link.dataset.nav = "quan-tri";
    $(".drawer-separator").before(link);
  }
}

async function refresh() {
  Object.assign(state, await request("/api/state"));
  renderAccount();
  route();
}

function setAuthMode(mode) {
  authMode = mode;
  const setup = mode === "setup";
  const login = mode === "login";
  $("#auth-title").textContent = setup ? "Tạo quản trị viên" : login ? "Đăng nhập" : "Tạo tài khoản";
  $("#auth-subtitle").textContent = setup ? "Bước đầu tiên: tạo tài khoản quản trị trên máy này." : login ? "Sử dụng tài khoản Giáo lý Inhaxio của bạn." : "Tạo tài khoản người dùng để xem thông tin nội bộ.";
  $("#auth-name-row").hidden = login;
  $("#auth-name").required = !login;
  $("#auth-password").autocomplete = login ? "current-password" : "new-password";
  $("#auth-submit").textContent = setup ? "Tạo tài khoản quản trị" : login ? "Đăng nhập" : "Tạo tài khoản";
  $("#auth-switch").hidden = true;
  $("#auth-switch").textContent = login ? "Chưa có tài khoản? Tạo tài khoản người dùng" : "Đã có tài khoản? Đăng nhập";
  $("#auth-error").hidden = true;
}

function openAuth() {
  setAuthMode("login");
  $("#auth-form").reset();
  $("#auth-dialog").showModal();
}

async function submitAuth(event) {
  event.preventDefault();
  const error = $("#auth-error");
  error.hidden = true;
  const body = { username: $("#auth-username").value.trim(), password: $("#auth-password").value };
  if (authMode !== "login") body.name = $("#auth-name").value.trim();
  try {
    await request("/api/login", "POST", body);
    $("#auth-dialog").close();
    await refresh();
    notify(`Xin chào, ${state.user.name}!`);
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  }
}

$("#header-auth").addEventListener("click", openAuth);
$("#header-logout").addEventListener("click", () => $("#drawer-logout").click());
$("#drawer-auth").addEventListener("click", () => { toggleMenu(false); openAuth(); });
$("#drawer-logout").addEventListener("click", async () => {
  toggleMenu(false);
  try { await request("/api/logout", "POST", {}); await refresh(); notify("Đã đăng xuất."); }
  catch (err) { notify(err.message); }
});
$("#auth-switch").addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
$("#auth-form").addEventListener("submit", submitAuth);
