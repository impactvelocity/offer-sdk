// Shared frame chrome: backdrop, inset border, logo (top left), sponsors (top right).
// Also sizes every .shot to the aspect ratio of its crop (16:9 stills, 16:10 screenshots).
(function () {
  const logo =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/>' +
    '<path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/></svg>';
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div class="bg"></div><div class="glow"></div><div class="edge"></div>' +
      '<div class="top"><div class="logo">' + logo + "Offer SDK</div>" +
      '<div class="sponsors"><span class="paypal">PayPal</span><span class="sep"></span><span>Render</span></div></div>'
  );

  for (const el of document.querySelectorAll(".shot")) {
    const s = getComputedStyle(el);
    const w = parseFloat(s.getPropertyValue("--w")), h = parseFloat(s.getPropertyValue("--h"));
    const src = (el.dataset.src || "16/9").split("/").map(Number);
    el.style.aspectRatio = String((w * src[0]) / (h * src[1]));
  }
})();
