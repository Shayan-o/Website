(() => {
  let essays = window.MARGINS_ESSAYS;
  const app = document.getElementById("app");
  let allTags = [...new Set(essays.flatMap((essay) => essay.tags))].sort();

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const essayUrl = (essay) => `/essays/${encodeURIComponent(essay.slug)}`;
  const tagUrl = (tag) => `/tags/${encodeURIComponent(tag.toLowerCase())}`;
  const essayCard = (essay) => `
    <a class="essay-card" href="${essayUrl(essay)}" data-nav>
      <h3>${escapeHtml(essay.title)}</h3>
      <p>${escapeHtml(essay.excerpt)}</p>
      <span class="meta">${escapeHtml(essay.date)} · ${essay.minutes} min</span>
    </a>`;

  function footer() {
    return `<footer class="site-footer">
      <nav aria-label="Footer"><a href="/" data-nav>Home</a><a href="/tags" data-nav>Tags</a><a href="/privacy.html">Privacy</a></nav>
      <p>No tracking, no reader accounts. Essays are stored in the site database; newsletter email is handled by the configured delivery provider.</p>
    </footer>`;
  }

  function home() {
    document.title = "Margins — essays on writing, tools and attention";
    return `<main class="home-page">
      <header class="intro">
        <a class="wordmark" href="/" data-nav>MARGINS</a>
        <h1>Essays, written slowly.</h1>
        <p>Short pieces on writing, the quiet decisions inside the tools we use, and paying attention on purpose. New writing a few times a year.</p>
      </header>
      <section class="writing" aria-labelledby="writing-heading">
        <h2 class="eyebrow" id="writing-heading">WRITING</h2>
        <div class="essay-list">${essays.map(essayCard).join("")}</div>
      </section>
      <section class="newsletter" aria-labelledby="newsletter-heading">
        <h2 class="eyebrow" id="newsletter-heading">NEWSLETTER</h2>
        <p>Get new essays by email. Low volume, no noise.</p>
        <form id="newsletter-form">
          <label class="visually-hidden" for="newsletter-email">Email address</label>
          <input id="newsletter-email" type="email" placeholder="you@email.com" autocomplete="email" required />
          <label class="consent"><input id="newsletter-consent" type="checkbox" required /> I agree to receive new essays by email. I can unsubscribe at any time.</label>
          <button type="submit">Subscribe</button>
          <p class="form-note">Low volume, no spam. Resend delivers confirmation and newsletter emails. Your address is used only for this newsletter.</p>
          <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
        </form>
      </section>
      ${footer()}
    </main>`;
  }

  function tagsIndex() {
    document.title = "Tags — Margins";
    return `<main class="listing-page"><a class="back-link" href="/" data-nav>← MARGINS</a>
      <h1>Tags</h1><ul class="tag-list">${allTags.map((tag) => `<li><a href="${tagUrl(tag)}" data-nav>${escapeHtml(tag)}</a></li>`).join("")}</ul>${footer()}</main>`;
  }

  function tagPage(tag) {
    const matches = essays.filter((essay) => essay.tags.some((item) => item.toLowerCase() === tag.toLowerCase()));
    if (!matches.length) return notFound();
    document.title = `${escapeHtml(matches[0].tags.find((item) => item.toLowerCase() === tag.toLowerCase()))} — Margins`;
    return `<main class="listing-page"><a class="back-link" href="/" data-nav>← MARGINS</a>
      <h1>${escapeHtml(matches[0].tags.find((item) => item.toLowerCase() === tag.toLowerCase()))}</h1>
      <div class="essay-list compact-list">${matches.map(essayCard).join("")}</div>${footer()}</main>`;
  }

  function essayPage(essay) {
    document.title = `${essay.title} — Margins`;
    return `<main class="essay-page"><a class="back-link" href="/" data-nav>← MARGINS</a>
      <article><header class="essay-header"><h1>${escapeHtml(essay.title)}</h1>
        <p class="meta">${escapeHtml(essay.date)} · ${essay.minutes} min</p></header>
        <div class="essay-body">${essay.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
        <div class="article-tags">${essay.tags.map((tag) => `<a href="${tagUrl(tag)}" data-nav>${escapeHtml(tag)}</a>`).join("")}</div>
      </article><a class="more-link" href="/" data-nav>More essays</a>${footer()}</main>`;
  }

  function notFound() {
    document.title = "Page not found — Margins";
    return `<main class="listing-page"><a class="back-link" href="/" data-nav>← MARGINS</a><h1>Nothing here.</h1><a class="more-link" href="/" data-nav>Back to essays</a>${footer()}</main>`;
  }

  function render() {
    const parts = decodeURIComponent(location.pathname).split("/").filter(Boolean);
    if (parts.length === 0) app.innerHTML = home();
    else if (parts[0] === "tags" && parts.length === 1) app.innerHTML = tagsIndex();
    else if (parts[0] === "tags" && parts.length === 2) app.innerHTML = tagPage(parts[1]);
    else if (parts[0] === "essays" && parts.length === 2) {
      const essay = essays.find((item) => item.slug === parts[1]);
      app.innerHTML = essay ? essayPage(essay) : notFound();
    } else app.innerHTML = notFound();
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-nav]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({}, "", link.href);
    render();
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id !== "newsletter-form") return;
    event.preventDefault();
    const status = document.getElementById("form-status");
    const email = document.getElementById("newsletter-email").value;
    const button = event.target.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "Adding you to the list…";
    fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent: document.getElementById("newsletter-consent").checked })
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Signup is not available right now.");
      status.textContent = result.message || "Please check your email to confirm your subscription.";
      event.target.reset();
    }).catch((error) => {
      status.textContent = error.message || "Signup is not available right now. Please try again later.";
    }).finally(() => { button.disabled = false; });
  });
  window.addEventListener("popstate", render);
  render();
  fetch("/api/essays").then((response) => response.ok ? response.json() : null).then((result) => {
    if (result && Array.isArray(result.essays)) { essays = result.essays; allTags = [...new Set(essays.flatMap((essay) => essay.tags))].sort(); render(); }
  }).catch(() => {});
})();
