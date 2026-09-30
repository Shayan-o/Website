fetch("/api/site-content").then((response) => response.ok ? response.json() : null).then((result) => {
  const privacy = document.getElementById("privacy-content");
  if (privacy && result?.content?.privacy) privacy.innerHTML = result.content.privacy;
}).catch(() => {});
