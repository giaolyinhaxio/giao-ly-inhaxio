"use strict";
"use strict";

const $ = (selector) => document.querySelector(selector);
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
const state = { initialized: true, user: null, links: {}, events: [] };
const classInfo = {
  "chien-con": { title: "Chiên Con", description: "Những bước đầu tiên làm quen với Chúa và cộng đoàn.", key: "chien_con", materialsUrl: "https://drive.google.com/drive/folders/1mZdYIKdlgh3rO6v77OMRa1jwuwBGa08i?usp=share_link" },
  "au-nhi": { title: "Ấu Nhi", description: "Cùng tìm hiểu, đặt câu hỏi và lớn lên trong đức tin.", key: "au_nhi", materialsUrl: "https://drive.google.com/drive/folders/1br7xLF0zghy7j3fA7uKXOxBe-zczAi4x?usp=share_link" },
  "thieu-nhi": { title: "Thiếu Nhi", description: "Học hỏi và đem điều đã học vào cuộc sống mỗi ngày.", key: "thieu_nhi", materialsUrl: "https://drive.google.com/drive/folders/1ZxfTxryogrUajqP_exw8UraWYUahg_Yx?usp=share_link" }
};
let authMode = "login";
let toastTimer;
let electionData = { election: null, candidates: [] };
let pendingVote = null;
let electionAdminView = "home";
let electionHistoryBack = null;
let electionPoll = null;
let lastRoute = "";
let previousPages = [];
let returningToPage = false;
try { previousPages = JSON.parse(sessionStorage.getItem("inhaxio-previous-pages") || "[]"); } catch {}
if (!Array.isArray(previousPages)) previousPages = [];
function goToPreviousPage() {
  if (location.hash === "#bau-cu" && electionAdminView !== "home") {
    const back = Array.from(document.querySelectorAll(".election-back")).find(button => button.offsetParent !== null);
    if (back) { back.click(); return; }
  }
  const target = previousPages.pop() || "trang-chu";
  try { sessionStorage.setItem("inhaxio-previous-pages", JSON.stringify(previousPages)); } catch {}
  if (target === lastRoute) return;
  returningToPage = true;
  location.hash = target;
}
document.querySelectorAll(".page-back").forEach(button => button.addEventListener("click", goToPreviousPage));
let memberData = [];

async function request(path, method = "GET", body) {
  const options = { method, headers: { "X-Inhaxio-Request": "1" } };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Không thể kết nối. Vui lòng thử lại.");
  return result;
}

function notify(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4400);
}

function toggleMenu(open) {
  const drawer = $("#drawer");
  drawer.hidden = !open;
  drawer.inert = !open;
  $("#drawer-backdrop").hidden = !open;
  $("#menu-button").setAttribute("aria-expanded", String(open));

  if (open) $("#close-menu").focus();
  else $("#menu-button").focus();
}

function route() {
  let path = location.hash.slice(1) || "trang-chu";
  const isClass = Object.hasOwn(classInfo, path);
  if (!["trang-chu", "lop-giao-ly", "ban-giao-ly", "su-kien", "bau-cu", "quan-tri"].includes(path) && !isClass) path = "trang-chu";
  if (path === "quan-tri" && state.user?.role !== "admin") path = "trang-chu";
  if (path === "bau-cu" && lastRoute !== "bau-cu") {
    electionAdminView = "home";

    if (lastRoute === "") {
      try {
        const savedView = sessionStorage.getItem("inhaxio-election-view");

        if (["home", "members", "prepare", "history", "live"].includes(savedView)) {
          electionAdminView = savedView;
        }
      } catch {
        // Vẫn mở bình thường nếu trình duyệt không cho lưu.
      }
    }
  }
  if (lastRoute && lastRoute !== path && !returningToPage) {
    previousPages.push(lastRoute);
    previousPages = previousPages.slice(-50);
    try { sessionStorage.setItem("inhaxio-previous-pages", JSON.stringify(previousPages)); } catch {}
  }
  returningToPage = false;
  lastRoute = path;
  if (path !== "bau-cu") stopElectionPoll();
  document.querySelectorAll(".page").forEach((page) => { page.hidden = true; });
  $(isClass ? "#page-class" : `#page-${path}`).hidden = false;
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === (isClass ? "lop-giao-ly" : path));
  });
  if (isClass) renderClass(path);
  if (path === "su-kien") renderEvents();
  if (path === "bau-cu") loadElection().catch(showElectionError);
  if (path === "quan-tri") renderAdmin();
  if (!$("#drawer").inert) toggleMenu(false);
  scrollTo({ top: 0, behavior: "auto" });
}

function textElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

