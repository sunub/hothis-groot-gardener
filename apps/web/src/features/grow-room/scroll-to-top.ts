/**
 * Jump to the top of the page when the grow room moves to a new step (a confirm or
 * next button). Instant, like opening a new page: a smooth scroll over the long
 * stacked page on narrow screens is slow.
 */
export function scrollToPageTop(): void {
  window.scrollTo({ top: 0, behavior: 'instant' });
}
