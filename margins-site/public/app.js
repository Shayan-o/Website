(() => {
  let essays = window.MARGINS_ESSAYS;
  let siteContent = {};
  const app = document.getElementById("app");
  let allTags = [...new Set(essays.flatMap((essay) => essay.tags))].sort();

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const essayUrl = (essay) => `/essays/${encodeURIComponent(essay.slug)}`;
  const tagUrl = (tag) => `/tags/${encodeURIComponent(tag.toLowerCase())}`;
  const defaultIntro = "<h1>Essays, written slowly.</h1><p>Short pieces on writing, the quiet decisions inside the tools we use, and paying attention on purpose. New writing a few times a year.</p>";
  const defaultBrand = "Essays by Shayan";
  const defaultNewsletter = '<h2 class="eyebrow" id="newsletter-heading">NEWSLETTER</h2><p>Get new essays by email. Low volume, no noise.</p>';
  const defaultFooterNote = "<p>No tracking, no reader accounts. Essays are stored in the site database; newsletter email is handled by the configured delivery provider.</p>";
  const settingText = (key, fallback) => {
    if (!siteContent[key]) return fallback;
    const doc = new DOMParser().parseFromString(siteContent[key], "text/html");
    return doc.body.textContent.trim() || fallback;
  };
  const brandName = () => {
    const saved = settingText("site-brand", defaultBrand);
    return saved.toLowerCase() === "margins" ? defaultBrand : saved;
  };
  const essayCard = (essay) => `
    <a class="essay-card" href="${essayUrl(essay)}" data-nav>
      <h3>${escapeHtml(essay.title)}</h3>
      <p>${escapeHtml(essay.excerpt)}</p>
      <span class="meta">${escapeHtml(essay.date)} · ${essay.minutes} min</span>
    </a>`;

  function footer() {
    return `<footer class="site-footer">
      <nav aria-label="Footer"><a href="/" data-nav>Home</a><a href="/tags" data-nav>Tags</a><a href="/privacy.html">Privacy</a></nav>
      <div class="footer-note">${siteContent["footer-note"] || defaultFooterNote}</div>
    </footer>`;
  }

  function home() {
    document.title = `${brandName()} — essays on writing, tools and attention`;
    return `<main class="home-page">
      <header class="intro">
        <a class="wordmark" href="/" data-nav>${escapeHtml(brandName())}</a>
        <div class="editable-site-copy">${siteContent["home-intro"] || defaultIntro}</div>
      </header>
      <section class="writing" aria-labelledby="writing-heading">
        <h2 class="eyebrow" id="writing-heading">WRITING</h2>
        <div class="essay-list">${essays.map(essayCard).join("")}</div>
      </section>
      <section class="newsletter" aria-labelledby="newsletter-heading">
        <div class="editable-site-copy">${siteContent["home-newsletter"] || defaultNewsletter}</div>
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
    document.title = `Tags — ${brandName()}`;
    return `<main class="listing-page"><a class="back-link" href="/" data-nav>← ${escapeHtml(brandName())}</a>
      <h1>Tags</h1><ul class="tag-list">${allTags.map((tag) => `<li><a href="${tagUrl(tag)}" data-nav>${escapeHtml(tag)}</a></li>`).join("")}</ul>${footer()}</main>`;
  }

  function tagPage(tag) {
    const matches = essays.filter((essay) => essay.tags.some((item) => item.toLowerCase() === tag.toLowerCase()));
    if (!matches.length) return notFound();
    document.title = `${escapeHtml(matches[0].tags.find((item) => item.toLowerCase() === tag.toLowerCase()))} — ${brandName()}`;
    return `<main class="listing-page"><a class="back-link" href="/" data-nav>← ${escapeHtml(brandName())}</a>
      <h1>${escapeHtml(matches[0].tags.find((item) => item.toLowerCase() === tag.toLowerCase()))}</h1>
      <div class="essay-list compact-list">${matches.map(essayCard).join("")}</div>${footer()}</main>`;
  }

  function essayPage(essay) {
    document.title = `${essay.title} — ${brandName()}`;
    return `<main class="essay-page"><a class="back-link" href="/" data-nav>← ${escapeHtml(brandName())}</a>
      <article><header class="essay-header"><h1>${escapeHtml(essay.title)}</h1>
        <p class="meta">${escapeHtml(essay.date)} · ${essay.minutes} min</p></header>
        <div class="essay-body">${essay.contentHtml || essay.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>
        ${essay.endnotesHtml ? `<section class="essay-notes" aria-labelledby="endnotes-heading"><h2 id="endnotes-heading">Endnotes</h2><div>${essay.endnotesHtml}</div></section>` : ""}
        ${essay.sourcesHtml ? `<section class="essay-sources" aria-labelledby="sources-heading"><h2 id="sources-heading">Sources</h2><div>${essay.sourcesHtml}</div></section>` : ""}
        <div class="article-tags">${essay.tags.map((tag) => `<a href="${tagUrl(tag)}" data-nav>${escapeHtml(tag)}</a>`).join("")}</div>
      </article><a class="more-link" href="/" data-nav>More essays</a>${footer()}</main>`;
  }

  function notFound() {
    document.title = `Page not found — ${brandName()}`;
    return `<main class="listing-page"><a class="back-link" href="/" data-nav>← ${escapeHtml(brandName())}</a><h1>Nothing here.</h1><a class="more-link" href="/" data-nav>Back to essays</a>${footer()}</main>`;
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
    applyNewsletterSettings();
    window.scrollTo(0, 0);
  }

  function applyNewsletterSettings() {
    const brand = brandName();
    document.querySelectorAll(".wordmark").forEach((element) => { element.textContent = brand; });
    document.querySelectorAll(".back-link").forEach((element) => { element.textContent = "← " + brand; });
    const form = document.getElementById("newsletter-form");
    if (form) {
      const newsletter = form.closest(".newsletter");
      const color = (key, fallback) => {
        const value = settingText(key, "");
        return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : fallback;
      };
      const radius = (key) => {
        const value = Number(settingText(key, "0"));
        return Number.isFinite(value) ? Math.max(0, Math.min(24, value)) + "px" : "0px";
      };
      if (newsletter) {
        newsletter.style.backgroundColor = color("newsletter-section-background", "#f8f7f3");
        newsletter.style.color = color("newsletter-section-text", "#24211e");
        newsletter.style.borderColor = color("newsletter-divider", "#dfddd7");
        newsletter.querySelectorAll(".editable-site-copy, .editable-site-copy h2, .editable-site-copy p, .consent, .form-note").forEach((element) => {
          element.style.color = color("newsletter-section-text", "#24211e");
        });
      }
      const email = document.getElementById("newsletter-email");
      const emailLabel = form.querySelector('label[for="newsletter-email"]');
      const consent = document.getElementById("newsletter-consent");
      const consentLabel = consent?.closest("label");
      if (email) {
        email.placeholder = settingText("newsletter-placeholder", "you@email.com");
        email.style.backgroundColor = color("newsletter-input-background", "#f8f7f3");
        email.style.color = color("newsletter-input-text", "#24211e");
        email.style.borderColor = color("newsletter-input-border", "#dfddd7");
        email.style.borderRadius = radius("newsletter-input-radius");
      }
      if (emailLabel) emailLabel.textContent = settingText("newsletter-email-label", "Email address");
      if (consentLabel && consent) consentLabel.lastChild.textContent = " " + settingText("newsletter-consent", "I agree to receive new essays by email. I can unsubscribe at any time.");
      const button = form.querySelector('button[type="submit"]');
      if (button) {
        button.textContent = settingText("newsletter-button", "Subscribe");
        button.style.backgroundColor = color("newsletter-button-background", "#24211e");
        button.style.color = color("newsletter-button-text", "#f8f7f3");
        button.style.borderRadius = radius("newsletter-button-radius");
      }
      const note = form.querySelector(".form-note");
      if (note) note.textContent = settingText("newsletter-note", "Your email is stored in the site database. Confirm your subscription before receiving essays.");
    }
    const links = document.querySelectorAll(".site-footer nav a");
    if (links[0]) links[0].textContent = settingText("footer-home-label", "Home");
    if (links[1]) links[1].textContent = settingText("footer-tags-label", "Tags");
    if (links[2]) links[2].textContent = settingText("footer-privacy-label", "Privacy");
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
    status.textContent = settingText("newsletter-sending", "Adding you to the list…");
    fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, consent: document.getElementById("newsletter-consent").checked })
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Signup is not available right now.");
      status.textContent = result.alreadySubscribed ? settingText("newsletter-existing", "This address is already subscribed.") : result.confirmationSent ? settingText("newsletter-success", "Check your email for a confirmation link. Your signup is pending until you confirm.") : settingText("newsletter-pending", "Your address was saved as pending. Email confirmation is not configured yet, so you are not subscribed until you confirm.");
      event.target.reset();
    }).catch((error) => {
      status.textContent = error.message || settingText("newsletter-error", "Signup is not available right now. Please try again later.");
    }).finally(() => { button.disabled = false; });
  });
  window.addEventListener("popstate", render);
  render();
  fetch("/api/essays").then((response) => response.ok ? response.json() : null).then((result) => {
    if (result && Array.isArray(result.essays)) { essays = result.essays; allTags = [...new Set(essays.flatMap((essay) => essay.tags))].sort(); render(); }
  }).catch(() => {});
  fetch("/api/site-content").then((response) => response.ok ? response.json() : null).then((result) => {
    if (result && result.content) { siteContent = result.content; render(); }
  }).catch(() => {});
})();
