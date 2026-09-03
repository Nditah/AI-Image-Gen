const form = document.querySelector("#image-form");
const promptInput = document.querySelector("#prompt");
const providerSelect = document.querySelector("#provider");
const generateButton = document.querySelector("#generate-btn");
const loadingEl = document.querySelector("#loading");
const errorEl = document.querySelector("#error");
const imageContainer = document.querySelector("#image-container");
const generatedImage = document.querySelector("#generated-image");
const providerUsedEl = document.querySelector("#provider-used");

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const setLoading = (isLoading) => {
  generateButton.disabled = isLoading;
  loadingEl.classList.toggle("hidden", !isLoading);
};

const showError = (message) => {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
};

const clearError = () => {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
};

const resetImage = () => {
  generatedImage.src = "";
  providerUsedEl.textContent = "";
  imageContainer.classList.add("hidden");
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  resetImage();

  const prompt = promptInput.value.trim();
  const provider = providerSelect.value;

  if (prompt.length < 3) {
    showError("Please enter a prompt with at least 3 characters.");
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, provider }),
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data.detail || data || {};
      const providerLabel = detail.provider ? ` (${detail.provider})` : "";
      throw new Error(`${detail.error || "Image generation request failed."}${providerLabel}`);
    }

    const base64Data = data.image_base64;
    generatedImage.src = base64Data.startsWith("data:") ? base64Data : `data:image/png;base64,${base64Data}`;
    providerUsedEl.textContent = `Provider used: ${data.provider}`;
    imageContainer.classList.remove("hidden");
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unexpected error while generating image.");
  } finally {
    setLoading(false);
  }
});
