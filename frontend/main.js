const form = document.querySelector("#image-form");
const promptInput = document.querySelector("#prompt");
const generateButton = document.querySelector("#generate-btn");
const loadingEl = document.querySelector("#loading");
const errorEl = document.querySelector("#error");
const imageContainer = document.querySelector("#image-container");
const generatedImage = document.querySelector("#generated-image");

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  imageContainer.classList.add("hidden");

  const prompt = promptInput.value.trim();
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
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Image generation request failed.");
    }

    generatedImage.src = data.image_url;
    imageContainer.classList.remove("hidden");
  } catch (error) {
    showError(error instanceof Error ? error.message : "Unexpected error while generating image.");
  } finally {
    setLoading(false);
  }
});
