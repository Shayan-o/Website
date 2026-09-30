const params = new URLSearchParams(location.search);
const token = params.get("token");
const button = document.getElementById("unsubscribe-button");
const status = document.getElementById("unsubscribe-status");
if (!token) { button.disabled = true; status.textContent = "This unsubscribe link is missing or invalid."; }
button.addEventListener("click", async () => {
  button.disabled = true; status.textContent = "Unsubscribing…";
  try {
    const response = await fetch("/api/newsletter/unsubscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "This link is invalid or expired.");
    status.textContent = result.message;
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
