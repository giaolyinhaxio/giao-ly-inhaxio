"use strict";
function renderEvents() {
  $("#add-event").hidden = state.user?.role !== "admin";
  const list = $("#events-list");
  list.replaceChildren();
  if (!state.events.length) {
    const empty = textElement("div", "empty-state", "");
    empty.append(textElement("span", "", "✦"), textElement("strong", "", "Chưa có sự kiện nào"), textElement("p", "", "Khi Ban đăng lịch hoạt động, bạn sẽ thấy ở đây."));
    list.append(empty);
    return;
  }
  for (const event of state.events) {
    const date = new Date(event.event_date);
    const card = textElement("article", "event-card", "");
    const dateBox = textElement("div", "event-date-block", "");
    dateBox.append(textElement("strong", "", String(date.getDate()).padStart(2, "0")), textElement("span", "", `THÁNG ${date.getMonth() + 1}`));
    const content = textElement("div", "event-info", "");
    content.append(textElement("h3", "", event.title), textElement("div", "event-meta", `${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date)} · ${event.location}`));
    if (event.description) content.append(textElement("p", "", event.description));
    card.append(dateBox, content);
    if (state.user?.role === "admin") {
      const actions = textElement("div", "event-actions", "");
      const edit = textElement("button", "", "Sửa");
      edit.type = "button";
      edit.setAttribute("aria-label", `Sửa sự kiện ${event.title}`);
      edit.addEventListener("click", () => openEvent(event));
      const remove = textElement("button", "", "Xóa");
      remove.type = "button";
      remove.setAttribute("aria-label", `Xóa sự kiện ${event.title}`);
      remove.addEventListener("click", () => deleteEvent(event));
      actions.append(edit, remove);
      card.append(actions);
    }
    list.append(card);
  }
}

function openEvent(event = null) {
  $("#event-form").reset();
  $("#event-error").hidden = true;
  $("#event-title").textContent = event ? "Sửa sự kiện" : "Thêm sự kiện";
  $("#event-id").value = event?.id || "";
  if (event) {
    $("#event-name").value = event.title;
    $("#event-date").value = event.event_date;
    $("#event-location").value = event.location;
    $("#event-description").value = event.description;
  }
  $("#event-dialog").showModal();
}

async function deleteEvent(event) {
  if (!confirm(`Xóa sự kiện “${event.title}”?`)) return;
  try {
    await request(`/api/events/${event.id}`, "DELETE", {});
    await refresh();
    notify("Đã xóa sự kiện.");
  } catch (err) { notify(err.message); }
}

$("#add-event").addEventListener("click", () => openEvent());
$("#event-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#event-id").value;
  const body = {
    title: $("#event-name").value.trim(), event_date: $("#event-date").value,
    location: $("#event-location").value.trim(), description: $("#event-description").value.trim()
  };
  try {
    await request(id ? `/api/events/${id}` : "/api/events", id ? "PUT" : "POST", body);
    $("#event-dialog").close();
    await refresh();
    notify("Đã lưu sự kiện.");
  } catch (err) { $("#event-error").textContent = err.message; $("#event-error").hidden = false; }
});
