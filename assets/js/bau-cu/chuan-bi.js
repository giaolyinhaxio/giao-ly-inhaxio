"use strict";
async function ensureElectionDraft() {
  const title = $("#election-name").value.trim();
  const choices = Number($("#election-choices").value);
  if (title.length < 2 || title.length > 120) {
    throw new Error("Hãy nhập tên cuộc bầu cử từ 2 đến 120 ký tự.");
  }
  const current = electionData.election;
  if (current?.status === "draft" && !current.cancelled) {
    if (current.title !== title) {
      await request("/api/election/title", "PUT", { title });
    }
    if (current.choices_per_ballot !== choices) {
      await request("/api/election/choices", "PUT", { choices_per_ballot: choices });
    }
  } else {
    await request("/api/election", "POST", {
      title, choices_per_ballot: choices
    });
  }
  await loadElection();
}

$("#election-start").addEventListener("click", async () => {
  if (!confirm("Bắt đầu bầu cử? Sau đó không thể đổi ứng cử viên hoặc số người cần chọn.")) return;
  try {
    await ensureElectionDraft();
    await request("/api/election/start", "POST", {});
    electionAdminView = "live";
    await loadElection();
    notify("Đã bắt đầu bầu cử.");
  } catch (error) {
    showElectionError(error);
  }
});

