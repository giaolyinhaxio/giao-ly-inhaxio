"use strict";
function showElectionError(error) {
  const message = $("#election-message");
  message.textContent = error.message;
  message.hidden = false;
}

function stopElectionPoll() {
  if (electionPoll) clearInterval(electionPoll);
  electionPoll = null;
}

function setElectionView(view) {
  electionHistoryBack = null;
  electionAdminView = view;
  loadElection().catch(showElectionError);
  document.querySelector("#page-bau-cu").scrollIntoView({ behavior: "smooth" });
}

async function loadElection() {
  stopElectionPoll();
  electionData = await request("/api/election");
  const election = electionData.election;
  const isAdmin = state.user?.role === "admin";
  const activeElection = election && !election.cancelled && election.status !== "published";
  const labels = { draft: "Đang chuẩn bị", open: "Đang bầu cử", closed: "Đã kết thúc", published: "Đã công bố" };
  $("#election-message").hidden = true;
  $("#election-admin").hidden = !isAdmin;
  $("#election-public").hidden = isAdmin || !election || election.cancelled;
  $("#election-results").hidden = true;
  $("#election-empty").hidden = isAdmin || !!(election && !election.cancelled);

  if (isAdmin) {
    $("#election-home").hidden = electionAdminView !== "home";
    $("#election-members-screen").hidden = electionAdminView !== "members";
    $("#election-prepare-screen").hidden = electionAdminView !== "prepare";
    $("#election-history-screen").hidden = electionAdminView !== "history";
    $("#election-live-screen").hidden = electionAdminView !== "live";
    if (electionAdminView === "members") await loadMembers();
    if (electionAdminView === "history") await loadElectionHistory();
    if (electionAdminView === "prepare") {
      const draft = activeElection && election.status === "draft";
      $("#election-name").value = draft ? election.title : "";
      $("#election-choices").value = draft ? String(election.choices_per_ballot) : "1";
      $("#election-admin-status").textContent = draft ? "Đang chuẩn bị" : "";
      const list = $("#election-admin-candidates");
      list.replaceChildren();
      if (!draft || !electionData.candidates.length) {
        list.append(textElement("p", "muted", ""));
      }
      if (draft) for (const candidate of electionData.candidates) {
          const row = textElement("div", "election-row", "");
          const detail = textElement("div", "", "");
          detail.append(textElement("strong", "", candidate.full_name));
          if (candidate.description) detail.append(textElement("p", "muted", candidate.description));
          const remove = textElement("button", "secondary-button danger-button", "Bỏ chọn");
          remove.type = "button";
          remove.addEventListener("click", async () => {
            if (!confirm(`Bỏ “${candidate.full_name}” khỏi danh sách ứng cử?`)) return;
            try {
              await request(`/api/candidates/${candidate.id}`, "DELETE", {});
              await loadElection();
            } catch (error) { showElectionError(error); }
          });
          row.append(detail, remove);
          list.append(row);
      }
    }
    if (electionAdminView === "live") {
      if (!election || election.cancelled || !["open", "closed", "published"].includes(election.status)) {
        electionAdminView = "home";
        return loadElection();
      }
      $("#election-live-title").textContent = election.title;
      $("#election-live-status").textContent = labels[election.status];
      $("#election-live-actions").hidden = election.status !== "open";
      $("#election-publish").hidden = election.status !== "closed";
      renderElectionQr(election);
      await loadElectionResults();
      if (election.status === "open") electionPoll = setInterval(async () => {
        if (location.hash !== "#bau-cu" || electionAdminView !== "live") return;
        try { await loadElectionResults(); } catch (error) { showElectionError(error); }
      }, 5000);
    }
    return;
  }

  if (!election || election.cancelled) return;
  $("#election-title").textContent = election.title;
  $("#election-status").textContent = labels[election.status];
  const list = $("#election-candidates");
  list.replaceChildren();
  if (!electionData.candidates.length) list.append(textElement("p", "muted", "Chưa có ứng cử viên."));
  for (const candidate of electionData.candidates) {
    const row = textElement("div", "election-row", "");
    row.append(textElement("strong", "", candidate.full_name));
    if (candidate.description) row.append(textElement("span", "muted", candidate.description));
    list.append(row);
  }
  const votedKey = `inhaxio-voted-${election.id}`;
  let hasVoted = sessionStorage.getItem(votedKey) === "1";
  try { hasVoted ||= localStorage.getItem(votedKey) === "1"; } catch { /* Trình duyệt chặn lưu trữ. */ }
  list.hidden = hasVoted;
  $("#election-thanks").hidden = !hasVoted;
  $("#election-result-controls").hidden = !hasVoted && election.status !== "published";
  $("#election-wait-message").hidden = true;
  $("#election-enter-vote").hidden = hasVoted || !["draft", "open"].includes(election.status);
  $("#election-ballot").hidden = true;
  $("#election-ballot-instruction").textContent = `Hãy chọn đúng ${election.choices_per_ballot} người.`;
  const ballotList = $("#election-ballot-candidates");
  ballotList.replaceChildren();
  for (const candidate of electionData.candidates) {
    const label = textElement("label", "picker-row", "");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(candidate.id);
    input.addEventListener("change", () => {
      if (ballotList.querySelectorAll("input:checked").length > election.choices_per_ballot) {
        input.checked = false;
        showElectionError(new Error(`Chỉ được chọn ${election.choices_per_ballot} người.`));
      } else $("#election-message").hidden = true;
    });
    label.append(input, textElement("span", "", candidate.full_name));
    ballotList.append(label);
  }
  if (location.hash === "#bau-cu") electionPoll = setInterval(async () => {
    if (location.hash !== "#bau-cu" || !$("#election-ballot").hidden) return;
    try {
      const latest = (await request("/api/election")).election;
      if (latest?.id !== electionData.election?.id ||
          latest?.status !== electionData.election?.status ||
          latest?.cancelled !== electionData.election?.cancelled) {
        await loadElection();
      }
    } catch (error) { showElectionError(error); }
  }, 5000);
}


$("#election-go-members").addEventListener("click", () => setElectionView("members"));
$("#election-go-history").addEventListener("click", () => setElectionView("history"));
$("#election-go-ballot").addEventListener("click", () => {
  const election = electionData.election;
  setElectionView(election && !election.cancelled && ["open", "closed"].includes(election.status) ? "live" : "prepare");
});
document.querySelectorAll(".election-back").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.closest("#election-history-screen") && electionHistoryBack) {
      electionHistoryBack();
      $("#election-history-screen").scrollIntoView({ behavior: "smooth" });
      return;
    }
    setElectionView("home");
  });
});
$("#election-close").addEventListener("click", async () => {
  if (!confirm("Kết thúc bầu cử? Sau đó sẽ không nhận phiếu mới.")) return;
  try {
    await request("/api/election/close", "POST", {});
    await loadElection();
    notify("Đã kết thúc bầu cử.");
  } catch (error) {
    showElectionError(error);
  }
});

$("#election-cancel").addEventListener("click", async () => {
  if (!confirm("Hủy cuộc bầu cử? Sẽ dừng nhận phiếu, giữ dữ liệu đã bầu và không công bố kết quả.")) return;
  try {
    await request("/api/election/cancel", "POST", {});
    electionAdminView = "home";
    await loadElection();
    notify("Đã hủy cuộc bầu cử.");
  } catch (error) { showElectionError(error); }
});

$("#election-publish").addEventListener("click", async () => {
  if (!confirm("Công bố kết quả cho mọi người xem?")) return;
  try {
    await request("/api/election/publish", "POST", {});
    await loadElection();
    notify("Đã công bố kết quả.");
  } catch (error) {
    showElectionError(error);
  }
});

