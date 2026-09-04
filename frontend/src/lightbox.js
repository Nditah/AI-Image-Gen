/**
 * Gallery lightbox: open full image, prev/next slider, keyboard + swipe.
 * @param {ParentNode} root
 * @param {Array<{ src: string, prompt: string, meta: string }>} slides
 */
export function bindGalleryLightbox(root, slides) {
  const dialog = root.querySelector("[data-gallery-lightbox]");
  if (!dialog || !slides?.length) return;

  const img = dialog.querySelector("[data-lightbox-image]");
  const caption = dialog.querySelector("[data-lightbox-caption]");
  const meta = dialog.querySelector("[data-lightbox-meta]");
  const counter = dialog.querySelector("[data-lightbox-counter]");
  const prevBtn = dialog.querySelector("[data-lightbox-prev]");
  const nextBtn = dialog.querySelector("[data-lightbox-next]");
  const closeBtn = dialog.querySelector("[data-lightbox-close]");
  const stage = dialog.querySelector("[data-lightbox-stage]");

  let index = 0;
  let touchStartX = 0;

  function show(i) {
    index = ((i % slides.length) + slides.length) % slides.length;
    const slide = slides[index];
    img.src = slide.src;
    img.alt = slide.prompt || "Generated image";
    caption.textContent = slide.prompt || "";
    meta.textContent = slide.meta || "";
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;
    const multi = slides.length > 1;
    if (prevBtn) prevBtn.hidden = !multi;
    if (nextBtn) nextBtn.hidden = !multi;
  }

  function open(i) {
    show(i);
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function close() {
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
    img.removeAttribute("src");
  }

  function step(delta) {
    if (slides.length < 2) return;
    show(index + delta);
  }

  root.querySelectorAll("[data-lightbox-open]").forEach((el) => {
    el.addEventListener("click", () => {
      const i = Number(el.dataset.lightboxOpen);
      if (!Number.isFinite(i) || i < 0 || i >= slides.length) return;
      open(i);
    });
  });

  prevBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    step(-1);
  });
  nextBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    step(1);
  });
  closeBtn?.addEventListener("click", () => close());

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });

  dialog.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  });

  stage?.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0]?.clientX ?? 0;
    },
    { passive: true }
  );
  stage?.addEventListener(
    "touchend",
    (e) => {
      const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX;
      if (Math.abs(dx) < 48) return;
      step(dx < 0 ? 1 : -1);
    },
    { passive: true }
  );
}

export function galleryLightboxHtml() {
  return `
    <dialog class="gallery-lightbox" data-gallery-lightbox aria-label="Image viewer">
      <div class="gallery-lightbox-shell">
        <button type="button" class="gallery-lightbox-close" data-lightbox-close aria-label="Close">×</button>
        <button type="button" class="gallery-lightbox-nav is-prev" data-lightbox-prev aria-label="Previous image">‹</button>
        <button type="button" class="gallery-lightbox-nav is-next" data-lightbox-next aria-label="Next image">›</button>
        <div class="gallery-lightbox-stage" data-lightbox-stage>
          <img data-lightbox-image alt="" />
        </div>
        <div class="gallery-lightbox-footer">
          <p class="gallery-lightbox-counter" data-lightbox-counter></p>
          <p class="gallery-lightbox-caption" data-lightbox-caption></p>
          <p class="gallery-lightbox-meta muted" data-lightbox-meta></p>
        </div>
      </div>
    </dialog>
  `;
}
