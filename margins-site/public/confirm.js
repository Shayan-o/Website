const params = new URLSearchParams(location.search);
const token = params.get("token");
const button = document.getElementById("confirm-button");
const status = document.getElementById("confirm-status");
if (!token) { button.disabled = true; status.textContent = "This confirmation link is missing or invalid."; }
button.addEventListener("click", async () => {
  button.disabled = true; status.textContent = "Confirming…";
  try {
    const response = await fetch("/api/newsletter/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "This link is invalid or expired.");
    status.textContent = result.message;
  } catch (error) { status.textContent = error.message; button.disabled = false; }
});
