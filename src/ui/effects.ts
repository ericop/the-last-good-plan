export function applyPanelGlow(element: HTMLElement): void {
  if (!element.dataset.panelGlowReady) {
    element.dataset.panelGlowReady = "true";
    element.style.setProperty("--panel-breathe-duration", `${6.5 + Math.random() * 3.5}s`);
    element.style.setProperty("--panel-breathe-delay", `${Math.random() * -7}s`);
  }
  element.classList.add("ambient-panel");
}

export function applyButtonHoverEffect(button: HTMLElement, options: { primary?: boolean } = {}): void {
  if (!button.dataset.buttonFxReady) {
    button.dataset.buttonFxReady = "true";
    button.style.setProperty("--button-shimmer-duration", `${8 + Math.random() * 4}s`);
    button.style.setProperty("--button-shimmer-delay", `${Math.random() * -8}s`);
  }
  button.classList.add("ambient-button");
  if (options.primary) {
    button.classList.add("ambient-primary-cta");
  }
}

export function pulseCounter(element: HTMLElement): void {
  element.classList.remove("counter-pulse");
  void element.offsetWidth;
  element.classList.add("counter-pulse");
}