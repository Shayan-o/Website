(() => {
  const loginPanel = document.getElementById("login-panel");
  const editorPanel = document.getElementById("editor-panel");
  const loginForm = document.getElementById("login-form");
  const essayForm = document.getElementById("essay-form");
  let essays = [];
  let currentSlug = null;
  let siteContent = {};
  const sourceMode = { essay: false, endnotes: false, sources: false, site: false };
  const siteSettingGroups = {
    "brand-settings": [["site-brand", "Site name and wordmark", "Margins"]],
    "newsletter-settings": [
      ["newsletter-email-label", "Email field label", "Email address"],
      ["newsletter-placeholder", "Email placeholder", "you@email.com"],
      ["newsletter-consent", "Consent checkbox text", "I agree to receive new essays by email. I can unsubscribe at any time."],
      ["newsletter-button", "Subscribe button", "Subscribe"],
      ["newsletter-note", "Privacy and delivery note", "Your email is stored in the site database. Confirm your subscription before receiving essays."],
      ["newsletter-sending", "Submitting message", "Adding you to the list…"],
      ["newsletter-success", "Confirmation sent message", "Check your email for a confirmation link. Your signup is pending until you confirm."],
      ["newsletter-pending", "Confirmation unavailable message", "Your address was saved as pending. Email confirmation is not configured yet, so you are not subscribed until you confirm."],
      ["newsletter-existing", "Already subscribed message", "This address is already subscribed."],
      ["newsletter-error", "Generic error message", "Signup is not available right now. Please try again later."]
    ],
    "footer-settings": [
      ["footer-home-label", "Home link", "Home"],
      ["footer-tags-label", "Tags link", "Tags"],
      ["footer-privacy-label", "Privacy link", "Privacy"]
    ]
  };
  const richTags = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "STRONG", "B", "EM", "I", "U", "S", "DEL", "BR", "HR", "A", "SUP", "SUB", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "DIV", "SPAN", "IMG"]);

  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    const result = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
    if (!response.ok) throw new Error(result?.error || "Request failed.");
    return result;
  };

  function safeStyle(value) {
    const safe = [];
    for (const declaration of value.split(";")) {
      const parts = declaration.split(":");
      const name = parts.shift()?.trim().toLowerCase();
      const val = parts.join(":").trim().toLowerCase();
      if (!val || /url\s*\(|expression|javascript|var\s*\(/i.test(val)) continue;
      if (name === "text-align" && /^(left|right|center|justify)$/.test(val)) safe.push(name + ":" + val);
      if (name === "font-weight" && /^(normal|bold|[1-9]00)$/.test(val)) safe.push(name + ":" + val);
      if (name === "font-style" && /^(normal|italic|oblique)$/.test(val)) safe.push(name + ":" + val);
      if (name === "text-decoration" && /^(none|underline|line-through)$/.test(val)) safe.push(name + ":" + val);
      if (name === "vertical-align" && /^(baseline|sub|super|middle)$/.test(val)) safe.push(name + ":" + val);
      if (name === "color" && /^(#[0-9a-f]{3,8}|black|white|red|blue|green|gray|grey)$/.test(val)) safe.push(name + ":" + val);
      if (name === "font-size" && /^(?:[5-9]|[1-4][0-9])(?:px|pt)$/.test(val)) safe.push(name + ":" + val);
    }
    return safe.join(";");
  }

  function sanitizeForEditor(html) {
    const doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,svg,math,form,input,button,select,textarea,link,meta,base,video,audio,source").forEach((node) => node.remove());
    for (const element of [...doc.body.querySelectorAll("*")]) {
      if (!richTags.has(element.tagName)) { element.replaceWith(...element.childNodes); continue; }
      for (const attr of [...element.attributes]) {
        const name = attr.name.toLowerCase();
        if (name === "href" && element.tagName === "A") {
          if (!/^(https?:\/\/|mailto:|tel:|#[a-z0-9_.:-]{1,120})$/i.test(attr.value)) element.removeAttribute(attr.name);
        } else if (name === "src" && element.tagName === "IMG") {
          let url; try { url = new URL(attr.value); } catch {}
          if (!url || url.protocol !== "https:" || !/(?:^|\.)googleusercontent\.com$/.test(url.hostname)) element.removeAttribute(attr.name);
        } else if ((name === "alt" || name === "title") && element.tagName === "IMG") {
        } else if (name === "style") {
          const style = safeStyle(attr.value); if (style) element.setAttribute("style", style); else element.removeAttribute(attr.name);
        } else if (name === "id" && /^[a-z0-9_.:-]{1,120}$/i.test(attr.value)) {
        } else if (name === "name" && element.tagName === "A" && /^[a-z0-9_.:-]{1,120}$/i.test(attr.value)) {
        } else if ((name === "colspan" || name === "rowspan") && ["TD", "TH"].includes(element.tagName) && /^[1-9]\d?$/.test(attr.value)) {
        } else if (name === "start" && element.tagName === "OL" && /^\d{1,4}$/.test(attr.value)) {
        } else element.removeAttribute(attr.name);
      }
      if (element.tagName === "A" && /^https?:\/\//i.test(element.getAttribute("href") || "")) element.setAttribute("rel", "noopener noreferrer");
    }
    return doc.body.innerHTML;
  }

  function importGoogleHtml(sourceHtml) {
    const doc = new DOMParser().parseFromString(sourceHtml, "text/html");
    const classStyles = new Map();
    for (const style of doc.querySelectorAll("style")) {
      const css = style.textContent || "";
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const properties = safeStyle(match[2]);
        if (!properties) continue;
        for (const className of match[1].matchAll(/\.([a-z0-9_-]+)/gi)) classStyles.set(className[1], [classStyles.get(className[1]), properties].filter(Boolean).join(";"));
      }
    }
    doc.querySelectorAll("style").forEach((node) => node.remove());
    for (const element of doc.body.querySelectorAll("*")) {
      const mapped = [...element.classList].map((name) => classStyles.get(name)).filter(Boolean).join(";");
      const inline = element.getAttribute("style") || "";
      const style = safeStyle([mapped, inline].filter(Boolean).join(";"));
      if (style) element.setAttribute("style", style);
      element.removeAttribute("class");
    }
    return sanitizeForEditor(doc.body.innerHTML);
  }

  function splitImportedSections(html) {
    const doc = new DOMParser().parseFromString("<body>" + html + "</body>", "text/html");
    const sections = { essay: [], endnotes: [], sources: [] };
    let current = "essay";
    for (const node of [...doc.body.childNodes]) {
      const label = (node.textContent || "").trim().replace(/[:.]$/, "").toLowerCase();
      const isHeading = node.nodeType === Node.ELEMENT_NODE && (/^H[1-6]$/.test(node.tagName) || (node.tagName === "P" && node.children.length <= 1 && /^(?:endnotes?|notes?|sources?|references|bibliography|works cited)$/.test(label)));
      if (isHeading && /^(?:endnotes?|notes?)$/.test(label)) { current = "endnotes"; continue; }
      if (isHeading && /^(?:sources?|references|bibliography|works cited)$/.test(label)) { current = "sources"; continue; }
      const wrapper = doc.createElement("div");
      wrapper.append(node.cloneNode(true));
      sections[current].push(wrapper.innerHTML);
    }
    return Object.fromEntries(Object.entries(sections).map(([key, value]) => [key, sanitizeForEditor(value.join("")).trim()]));
  }

  function editorParts(kind) {
    return { visual: document.getElementById(kind + "-editor"), source: document.getElementById(kind + "-source") };
  }

  function setEditorHtml(kind, html) {
    const parts = editorParts(kind);
    parts.visual.innerHTML = sanitizeForEditor(html);
    parts.source.value = parts.visual.innerHTML;
    parts.visual.hidden = false;
    parts.source.hidden = true;
    sourceMode[kind] = false;
    document.querySelector('[data-mode-toggle="' + kind + '"]').textContent = "Source";
  }

  function editorHtml(kind) {
    const parts = editorParts(kind);
    return sanitizeForEditor(sourceMode[kind] ? parts.source.value : parts.visual.innerHTML);
  }

  function plainText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.innerText || doc.body.textContent || "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  }

  function formMessage(id, text) { document.getElementById(id).textContent = text; }

  async function showEditor() {
    loginPanel.hidden = true;
    editorPanel.hidden = false;
    await loadEssays();
    await loadSiteContent();
    await loadSubscribers();
  }

  async function loadSiteContent() {
    const result = await request("/api/admin/site-content");
    siteContent = result.content || {};
    const brand = siteContent["site-brand"] ? new DOMParser().parseFromString(siteContent["site-brand"], "text/html").body.textContent.trim() : "Margins";
    document.querySelector(".admin-top .wordmark").textContent = brand;
    loadSiteSection();
  }

  function loadSiteSection() {
    const key = document.getElementById("site-content-page").value;
    const settings = siteSettingGroups[key];
    const fields = document.getElementById("site-settings-fields");
    const rich = document.getElementById("site-rich-fields");
    fields.replaceChildren();
    if (settings) {
      rich.hidden = true;
      fields.hidden = false;
      for (const [settingKey, labelText, fallback] of settings) {
        const label = document.createElement("label");
        label.textContent = labelText;
        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 500;
        input.dataset.settingKey = settingKey;
        input.value = siteContent[settingKey] ? new DOMParser().parseFromString(siteContent[settingKey], "text/html").body.textContent.trim() : fallback;
        label.append(input);
        fields.append(label);
      }
      formMessage("site-content-status", "");
      return;
    }
    fields.hidden = true;
    rich.hidden = false;
    setEditorHtml("site", siteContent[key] || "<p></p>");
    formMessage("site-content-status", "");
  }

  async function importGoogleDoc(urlInput, kind, button) {
    const url = urlInput.value.trim();
    if (!url) { formMessage(kind === "essay" ? "essay-status" : "site-content-status", "Paste a Google Docs share link first."); return; }
    const statusId = kind === "essay" ? "essay-status" : "site-content-status";
    button.disabled = true;
    formMessage(statusId, "Importing document…");
    try {
      const result = await request("/api/admin/import-google-doc", { method: "POST", body: JSON.stringify({ url }) });
      const importedHtml = importGoogleHtml(result.sourceHtml);
      if (kind === "essay") {
        const sections = splitImportedSections(importedHtml);
        setEditorHtml("essay", sections.essay);
        setEditorHtml("endnotes", sections.endnotes || "<p></p>");
        setEditorHtml("sources", sections.sources || "<p></p>");
      } else setEditorHtml(kind, importedHtml);
      formMessage(statusId, kind === "essay" ? "Imported. Review the essay, Endnotes, Sources, and links, then save." : "Imported. Review the formatting and links, then save.");
    } catch (error) { formMessage(statusId, error.message); }
    finally { button.disabled = false; }
  }

  document.querySelectorAll(".rich-toolbar").forEach((toolbar) => {
    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const kind = toolbar.dataset.editor.replace(/-editor$/, "");
      if (button.dataset.modeToggle) {
        const parts = editorParts(kind);
        if (!sourceMode[kind]) {
          parts.source.value = parts.visual.innerHTML;
          parts.visual.hidden = true; parts.source.hidden = false;
          sourceMode[kind] = true; button.textContent = "Visual"; parts.source.focus();
        } else {
          setEditorHtml(kind, parts.source.value);
          parts.visual.focus();
        }
        return;
      }
      if (sourceMode[kind]) return;
      const editor = editorParts(kind).visual;
      editor.focus();
      if (button.dataset.command === "createLink") {
        const url = window.prompt("Paste the link URL");
        if (url) document.execCommand("createLink", false, url);
      } else document.execCommand(button.dataset.command, false, button.dataset.value || null);
    });
  });

  document.getElementById("site-content-page").addEventListener("change", loadSiteSection);
  document.getElementById("import-essay-doc").addEventListener("click", (event) => importGoogleDoc(document.getElementById("essay-doc-url"), "essay", event.currentTarget));
  document.getElementById("import-site-doc").addEventListener("click", (event) => importGoogleDoc(document.getElementById("site-doc-url"), "site", event.currentTarget));
  document.getElementById("save-site-content").addEventListener("click", async () => {
    const button = document.getElementById("save-site-content");
    const pageKey = document.getElementById("site-content-page").value;
    button.disabled = true;
    formMessage("site-content-status", "Saving…");
    try {
      if (siteSettingGroups[pageKey]) {
        for (const input of document.querySelectorAll("#site-settings-fields [data-setting-key]")) {
          const contentHtml = "<p>" + input.value.replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]) + "</p>";
          const result = await request("/api/admin/site-content", { method: "PUT", body: JSON.stringify({ pageKey: input.dataset.settingKey, contentHtml }) });
          siteContent[input.dataset.settingKey] = result.contentHtml;
        }
        if (pageKey === "brand-settings") document.querySelector(".admin-top .wordmark").textContent = new DOMParser().parseFromString(siteContent["site-brand"], "text/html").body.textContent.trim();
      } else {
        const result = await request("/api/admin/site-content", { method: "PUT", body: JSON.stringify({ pageKey, contentHtml: editorHtml("site") }) });
        siteContent[pageKey] = result.contentHtml;
        setEditorHtml("site", result.contentHtml);
      }
      formMessage("site-content-status", "Site text saved and published.");
    } catch (error) { formMessage("site-content-status", error.message); }
    finally { button.disabled = false; }
  });

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
    if (!result.subscribers.length) { root.textContent = "No signups have been stored yet."; return; }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Email</th><th>Status</th><th>Date</th><th></th></tr></thead>";
    const body = document.createElement("tbody");
    for (const subscriber of result.subscribers) {
      const row = document.createElement("tr");
      const email = document.createElement("td"); email.textContent = subscriber.email;
      const status = document.createElement("td"); status.textContent = subscriber.status === "confirmed" ? "Confirmed" : "Pending confirmation";
      const date = document.createElement("td"); date.textContent = new Date(subscriber.confirmed_at || subscriber.created_at).toLocaleDateString();
      const action = document.createElement("td");
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "button-quiet"; remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Remove " + subscriber.email + " and its consent record?")) return;
        try {
          await request("/api/admin/subscribers?email=" + encodeURIComponent(subscriber.email), { method: "DELETE" });
          await loadSubscribers();
        } catch (error) { window.alert(error.message); }
      });
      action.append(remove); row.append(email, status, date, action); body.append(row);
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
    const fallbackHtml = essay.paragraphs.map((paragraph) => "<p>" + paragraph.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]) + "</p>").join("");
    setEditorHtml("essay", essay.contentHtml || fallbackHtml);
    setEditorHtml("endnotes", essay.endnotesHtml || "<p></p>");
    setEditorHtml("sources", essay.sourcesHtml || "<p></p>");
    essayForm.elements.status.value = essay.status;
    document.getElementById("form-heading").textContent = "Edit: " + essay.title;
    document.getElementById("send-essay").hidden = essay.status !== "published";
    document.getElementById("delete-essay").hidden = false;
    formMessage("essay-status", "");
  }

  document.getElementById("new-essay").addEventListener("click", () => {
    currentSlug = null;
    essayForm.reset();
    essayForm.elements.minutes.value = 5;
    essayForm.elements.status.value = "draft";
    setEditorHtml("essay", "<p></p>");
    setEditorHtml("endnotes", "<p></p>");
    setEditorHtml("sources", "<p></p>");
    document.getElementById("form-heading").textContent = "New essay";
    document.getElementById("send-essay").hidden = true;
    document.getElementById("delete-essay").hidden = true;
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
    const contentHtml = editorHtml("essay");
    const essay = {
      title: data.get("title"), slug: data.get("slug"), excerpt: data.get("excerpt"), date: data.get("date"),
      minutes: Number(data.get("minutes")), tags: data.get("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
      paragraphs: plainText(contentHtml), contentHtml, status: data.get("status")
    };
    essay.endnotesHtml = editorHtml("endnotes");
    essay.sourcesHtml = editorHtml("sources");
    if (!essay.paragraphs.length) { formMessage("essay-status", "Add essay text before saving."); return; }
    formMessage("essay-status", "Saving…");
    try {
      await request("/api/admin/essays", { method: "PUT", body: JSON.stringify(essay) });
      formMessage("essay-status", essay.status === "published" ? "Published and saved." : "Draft saved.");
      currentSlug = essay.slug;
      document.getElementById("form-heading").textContent = "Edit: " + essay.title;
      document.getElementById("send-essay").hidden = essay.status !== "published";
      document.getElementById("delete-essay").hidden = false;
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

  document.getElementById("delete-essay").addEventListener("click", async () => {
    const essay = essays.find((item) => item.slug === currentSlug);
    if (!essay || !window.confirm("Permanently delete “" + essay.title + "”? This removes it from the website and cannot be undone.")) return;
    formMessage("essay-status", "Deleting…");
    try {
      await request("/api/admin/essays?slug=" + encodeURIComponent(essay.slug), { method: "DELETE" });
      currentSlug = null;
      essayForm.reset();
      essayForm.elements.minutes.value = 5;
      essayForm.elements.status.value = "draft";
      setEditorHtml("essay", "<p></p>");
      setEditorHtml("endnotes", "<p></p>");
      setEditorHtml("sources", "<p></p>");
      document.getElementById("form-heading").textContent = "New essay";
      document.getElementById("send-essay").hidden = true;
      document.getElementById("delete-essay").hidden = true;
      formMessage("essay-status", "Essay deleted.");
      formMessage("broadcast-status", "");
      await loadEssays();
    } catch (error) { formMessage("essay-status", error.message); }
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
