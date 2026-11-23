"use strict";
$("#election-enter-vote").addEventListener("click", async () => {
  try {
    await loadElection();
    if (electionData.election?.status !== "open") {
      showElectionError(new Error("Hiện tại chưa được bầu cử."));
      return;
    }

    $("#election-candidates").hidden = true;
    $("#election-enter-vote").hidden = true;
    $("#election-ballot").hidden = false;
  } catch (error) {
    showElectionError(error);
  }
});

$("#election-cancel-vote").addEventListener("click", () => {
  $("#election-ballot").hidden = true;
  $("#election-candidates").hidden = false;
  $("#election-enter-vote").hidden = false;
  $("#election-message").hidden = true;
});

$("#election-ballot").addEventListener("submit", async (event) => {
  event.preventDefault();

  const election = electionData.election;
  const candidateIds = [
    ...$("#election-ballot-candidates").querySelectorAll("input:checked")
  ].map((input) => Number(input.value));

  if (election?.status !== "open") {
    showElectionError(new Error("Hiện tại chưa được bầu cử."));
    return;
  }
  if (candidateIds.length !== election.choices_per_ballot) {
    showElectionError(new Error(
      `Vui lòng chọn đúng ${election.choices_per_ballot} người.`
    ));
    return;
  }
  if (!confirm("Xác nhận gửi phiếu bầu? Sau khi gửi không thể sửa phiếu.")) {
    return;
  }

  const signature = JSON.stringify([election.id, candidateIds]);
  if (!pendingVote || pendingVote.signature !== signature) {
      const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(
      bytes,
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");

    const key = [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20)
    ].join("-");

    pendingVote = { signature, key };
  }

  const submitButton = event.currentTarget.querySelector(
    'button[type="submit"]'
  );
  submitButton.disabled = true;

  try {
    await request("/api/election/vote", "POST", {
      election_id: election.id,
      candidate_ids: candidateIds,
      submission_key: pendingVote.key
    });

    sessionStorage.setItem(`inhaxio-voted-${election.id}`, "1");
    try { localStorage.setItem(`inhaxio-voted-${election.id}`, "1"); } catch { /* Phiếu vẫn đã được ghi nhận. */ }
    pendingVote = null;
    await loadElection();
    notify("Đã ghi nhận phiếu bầu.");
  } catch (error) {
    showElectionError(error);
  } finally {
    submitButton.disabled = false;
  }
});

