"use strict";
async function loadMembers() {
  memberData = (await request("/api/members")).members;
  $("#member-count").textContent = `Thành viên: ${memberData.length}`;
  const list = $("#member-list");
  list.replaceChildren();
  if (!memberData.length) list.append(textElement("p", "muted", "Chưa có thành viên. Hãy thêm thành viên đầu tiên."));
  for (const member of memberData) {
    const row = textElement("div", "election-row", "");
    const detail = textElement("div", "", "");
    detail.append(textElement("strong", "", member.full_name));
    if (member.description) detail.append(textElement("p", "muted", member.description));
    const actions = textElement("div", "election-row-actions", "");
    const edit = textElement("button", "secondary-button", "Sửa");
    edit.type = "button";
    edit.addEventListener("click", () => openMember(member));
    const remove = textElement("button", "secondary-button danger-button", "Xóa");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm(`Xóa thành viên “${member.full_name}” khỏi danh sách?`)) return;
      try {
        await request(`/api/members/${member.id}`, "DELETE", {});
        await loadMembers();
        notify("Đã xóa thành viên khỏi danh sách hiện tại.");
      } catch (error) { showElectionError(error); }
    });
    actions.append(edit, remove);
    row.append(detail, actions);
    list.append(row);
  }
}

function openMember(member = null) {
  $("#member-form").reset();
  $("#member-error").hidden = true;
  $("#member-id").value = member?.id || "";
  $("#member-name").value = member?.full_name || "";
  $("#member-description").value = member?.description || "";
  $("#member-dialog-title").textContent = member ? "Sửa thành viên" : "Thêm thành viên";
  $("#member-dialog").showModal();
}

async function openCandidatePicker() {
  try {
    const members = (await request("/api/members")).members;
    const chosen = new Set(electionData.candidates.map((candidate) => candidate.member_id));
    const list = $("#candidate-picker-list");
    list.replaceChildren();
    for (const member of members.filter((item) => !chosen.has(item.id))) {
      const row = textElement("label", "picker-row", "");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = String(member.id);
      row.append(checkbox, textElement("span", "", member.full_name));
      list.append(row);
    }
    if (!list.children.length) list.append(textElement("p", "muted", "Không còn thành viên để thêm. Hãy cập nhật danh sách thành viên trước."));
    $("#candidate-picker-error").hidden = true;
    $("#candidate-picker-dialog").showModal();
  } catch (error) { showElectionError(error); }
}

$("#member-add").addEventListener("click", () => openMember());
$("#member-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#member-id").value;
  try {
    await request(id ? `/api/members/${id}` : "/api/members", id ? "PUT" : "POST", {
      full_name: $("#member-name").value.trim(),
      description: $("#member-description").value.trim()
    });
    $("#member-dialog").close();
    await loadMembers();
    notify("Đã lưu thành viên.");
  } catch (error) {
    $("#member-error").textContent = error.message;
    $("#member-error").hidden = false;
  }
});
$("#candidate-picker-open").addEventListener("click", async () => {
  try {
    await ensureElectionDraft();
    await openCandidatePicker();
  } catch (error) { showElectionError(error); }
});
$("#candidate-picker-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const ids = [...$("#candidate-picker-list").querySelectorAll("input:checked")].map((input) => Number(input.value));
  if (!ids.length) {
    $("#candidate-picker-error").textContent = "Hãy chọn ít nhất một thành viên.";
    $("#candidate-picker-error").hidden = false;
    return;
  }
  try {
    await request("/api/candidates", "POST", { member_ids: ids });
    $("#candidate-picker-dialog").close();
    await loadElection();
    notify("Đã thêm ứng cử viên.");
  } catch (error) {
    $("#candidate-picker-error").textContent = error.message;
    $("#candidate-picker-error").hidden = false;
  }
});

