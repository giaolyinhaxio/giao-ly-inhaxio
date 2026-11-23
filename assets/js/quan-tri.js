"use strict";
function renderAdmin() {
  const form = $("#links-form");
  for (const key of ["chien_con", "au_nhi", "thieu_nhi", "ban_giao_ly"]) form.elements[key].value = state.links[key] || "";
}

$("#links-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {};
  for (const key of ["chien_con", "au_nhi", "thieu_nhi", "ban_giao_ly"]) body[key] = event.currentTarget.elements[key].value.trim();
  try { await request("/api/links", "PUT", body); await refresh(); notify("Đã lưu các liên kết Google Sheets."); }
  catch (err) { notify(err.message); }
});

