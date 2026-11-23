"use strict";
function renderElectionQr(election) {
  const panel = $("#election-qr");
  panel.hidden = election.status !== "open";
  if (panel.hidden) return;
  const url = `${location.origin}${location.pathname}#bau-cu`;
  const publicReady = location.protocol === "https:" && !["127.0.0.1", "localhost", "::1"].includes(location.hostname);
  $("#election-public-link").href = url;
  $("#election-public-link").textContent = url;
  $("#election-qr-image").hidden = !publicReady;
  $("#election-qr-note").hidden = publicReady;
  if (publicReady) $("#election-qr-image").src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
}

async function loadElectionResults(publicView = false) {
  const summary = await request("/api/election/results");
  const list = $(publicView ? "#election-public-result-list" : "#election-result-list");
  list.replaceChildren();
  $(publicView ? "#election-public-total" : "#election-total").textContent = `Tổng phiếu: ${summary.total_ballots}`;
  for (const [index, candidate] of summary.results.entries()) {
    const row = textElement("div", "election-row", "");
    row.append(textElement("strong", "", `${index + 1}. ${candidate.full_name}`), textElement("span", "vote-count", `${candidate.vote_count} phiếu`));
    list.append(row);
  }
}

async function loadElectionHistory() {
  electionHistoryBack = null;
  const { elections } = await request("/api/election/history");
  const list = $("#election-history-list");

  function showList() {
    electionHistoryBack = null;
    list.replaceChildren();

    if (!elections.length) {
      list.append(
        textElement("p", "muted", "Chưa có lịch sử bầu cử.")
      );
      return;
    }

    for (const election of elections) {
      const row = textElement("article", "history-summary", "");
      const actions = textElement("div", "history-actions", "");

      const viewButton = textElement(
        "button", "secondary-button", "Xem nội dung"
      );
      viewButton.type = "button";
      viewButton.addEventListener("click", async () => {
        viewButton.disabled = true;
        viewButton.textContent = "Đang tải…";

        try {
          const result = await request(
            `/api/election/history?id=${encodeURIComponent(election.id)}`
          );

          const detail = result.elections[0];

          if (!detail) {
            throw new Error("Cuộc bầu cử không còn tồn tại.");
          }

          if (electionAdminView === "history" && location.hash === "#bau-cu") {
            showDetails(detail);
          }
        } catch (error) {
          alert(error.message || "Không tải được kết quả.");
        } finally {
          viewButton.disabled = false;
          viewButton.textContent = "Xem nội dung";
        }
      });

      const deleteButton = textElement(
        "button", "secondary-button history-delete", "Xóa"
      );
      deleteButton.type = "button";

      deleteButton.addEventListener("click", async () => {
        if (!confirm(`Xóa cuộc bầu cử "${election.title}"?`)) {
          return;
        }

        deleteButton.disabled = true;

        try {
          await request(
            `/api/election/history/${election.id}`,
            "DELETE",
            {}
          );
          const index = elections.findIndex(
            (item) => item.id === election.id
          );

          if (index !== -1) {
            elections.splice(index, 1);
          }

          showList();
        } catch (error) {
          alert(error.message || "Không thể xóa cuộc bầu cử.");
          deleteButton.disabled = false;
        }
      });

      actions.append(viewButton, deleteButton);

      row.append(
        textElement("strong", "history-title", election.title),
        actions
      );

      list.append(row);
    }
  }

  function showDetails(election) {
    list.replaceChildren();

    electionHistoryBack = showList;

    const card = textElement("article", "election-history-card", "");

    card.append(
      textElement("h3", "", election.title),
      textElement(
        "p",
        "muted",
        `${election.status} · ${election.total_ballots} phiếu`
      )
    );

    for (const [index, candidate] of election.results.entries()) {
      const row = textElement("div", "election-row", "");

      row.append(
        textElement(
          "strong",
          "",
          `${index + 1}. ${candidate.full_name}`
        ),
        textElement(
          "span",
          "vote-count",
          `${candidate.vote_count} phiếu`
        )
      );

      card.append(row);
    }

    list.append(card);
    list.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  showList();
}

$("#election-view-results").addEventListener("click", async () => {
  try {
    const election = (await request("/api/election")).election;
    const message = $("#election-wait-message");
    if (!election || election.cancelled || election.status !== "published") {
      message.textContent = "Kết quả chưa được quản trị viên công bố. Vui lòng đợi nhé.";
      message.hidden = false;
      return;
    }
    message.hidden = true;
    await loadElectionResults(true);
    await loadElectionResults(true);

    $("#election-public").hidden = true;
    $("#election-results").hidden = false;

    $("#election-results").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  } catch (error) { showElectionError(error); }
});

