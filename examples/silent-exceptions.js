// Intentional demo of silent exception anti-patterns

function loadConfig() {
  // Pattern E: empty catch — critical
  try {
    return JSON.parse(localStorage.getItem("config"));
  } catch (e) {}
}

function submitForm(data) {
  // Pattern G: .catch(() => {}) — high
  fetch("/api/submit", { method: "POST", body: data }).catch(() => {});
}

async function loadUser(id) {
  // Pattern H: console.log only — medium
  try {
    return await api.get(`/user/${id}`);
  } catch (e) {
    console.log(e);
  }
}
