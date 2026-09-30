(() => {
  const loginPanel = document.getElementById("login-panel");
  const editorPanel = document.getElementById("editor-panel");
  const loginForm = document.getElementById("login-form");
  const essayForm = document.getElementById("essay-form");
  let essays = [];
  let currentSlug = null;

  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const result = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(result?.error || "Request failed.");
    return result;
  };

  function formMessage(id, text) { document.getElementById(id).textContent = text; }

  async function showEditor() {
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    await loadEssays();
    await loadSubscribers();
  }

  async function loadEssays() {
    const result = await request("/api/admin/essays");
    essays = result.essays;
    const list = document.getElementById("essay-list");
    list.replaceChildren();
    if (!essays.length) list.textContent = "No essays yet.";
    for (const essay of essays) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "essay-choice";
      const label = document.createElement("span");
      const title = document.createElement("strong");
      const detail = document.createElement("small");
      title.textContent = essay.title;
      detail.textContent = essay.status === "published" ? "Published" : "Draft";
      label.append(title, detail);
      button.append(label);
      button.addEventListener("click", () => fillForm(essay));
      list.append(button);
    }
  }

  async function loadSubscribers() {
    const result = await request("/api/admin/subscribers");
    const root = document.getElementById("subscriber-list");
    if (!result.subscribers.length) { root.textContent = "No confirmed subscribers yet."; return; }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Email</th><th>Confirmed</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const subscriber of result.subscribers) {
      const row = document.createElement("tr");
      const email = document.createElement("td"); email.textContent = subscriber.email;
      const date = document.createElement("td"); date.textContent = new Date(subscriber.confirmed_at).toLocaleDateString();
      const action = document.createElement("td");
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "button-quiet"; remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        if (!window.confirm(`Remove ${subscriber.email} and its consent record?`)) return;
        try {
          await request(`/api/admin/subscribers?email=${encodeURIComponent(subscriber.email)}`, { method: "DELETE" });
          await loadSubscribers();
        } catch (error) { window.alert(error.message); }
      });
      action.append(remove); row.append(email, date, action); body.append(row);
    }
    table.append(body); root.replaceChildren(table);
  }

  function fillForm(essay) {
    currentSlug = essay.slug;
    essayForm.elements.title.value = essay.title;
    essayForm.elements.slug.value = essay.slug;
    essayForm.elements.excerpt.value = essay.excerpt;
    essayForm.elements.date.value = essay.dateValue;
    essayForm.elements.minutes.value = essay.minutes;
    essayForm.elements.tags.value = essay.tags.join(", ");
    essayForm.elements.paragraphs.value = essay.paragraphs.join("\n\n");
    essayForm.elements.status.value = essay.status;
    document.getElementById("form-heading").textContent = `Edit: ${essay.title}`;
    document.getElementById("send-essay").hidden = essay.status !== "published";
    formMessage("essay-status", "");
  }

  document.getElementById("new-essay").addEventListener("click", () => {
    currentSlug = null;
    essayForm.reset();
    essayForm.elements.minutes.value = 5;
    essayForm.elements.status.value = "draft";
    document.getElementById("form-heading").textContent = "New essay";
    document.getElementById("send-essay").hidden = true;
    formMessage("essay-status", "");
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage("login-status", "Signing in…");
    try {
      await request("/api/admin/login", { method: "POST", body: JSON.stringify({ password: loginForm.elements["admin-password"].value }) });
      await showEditor();
    } catch (error) { formMessage("login-status", error.message); }
  });

  essayForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(essayForm);
    const essay = {
      title: data.get("title"), slug: data.get("slug"), excerpt: data.get("excerpt"), date: data.get("date"),
      minutes: Number(data.get("minutes")), tags: data.get("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
      paragraphs: data.get("paragraphs").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean), status: data.get("status")
    };
    formMessage("essay-status", "Saving…");
    try {
      await request("/api/admin/essays", { method: "PUT", body: JSON.stringify(essay) });
      formMessage("essay-status", essay.status === "published" ? "Published and saved." : "Draft saved.");
      currentSlug = essay.slug;
      document.getElementById("form-heading").textContent = `Edit: ${essay.title}`;
      document.getElementById("send-essay").hidden = essay.status !== "published";
      formMessage("broadcast-status", "");
      await loadEssays();
    } catch (error) { formMessage("essay-status", error.message); }
  });

  document.getElementById("send-essay").addEventListener("click", async () => {
    if (!currentSlug || !window.confirm("Email this essay to every confirmed subscriber? Each person receives a separate email and can unsubscribe.")) return;
    formMessage("broadcast-status", "Sending…");
    try {
      const result = await request("/api/admin/broadcast", { method: "POST", body: JSON.stringify({ slug: currentSlug }) });
      formMessage("broadcast-status", result.message);
    } catch (error) { formMessage("broadcast-status", error.message); }
  });

  document.getElementById("logout-button").addEventListener("click", async () => {
    await request("/api/admin/session", { method: "DELETE" });
    editorPanel.hidden = true; loginPanel.hidden = false; loginForm.reset();
  });

  request("/api/admin/session").then((session) => session.authenticated ? showEditor() : (loginPanel.hidden = false)).catch(() => {
    editorPanel.hidden = true;
    loginPanel.hidden = false;
    formMessage("login-status", "Connect the D1 database and configure the admin secrets to enable this editor.");
  });
})();
