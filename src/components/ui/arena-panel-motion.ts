/** Keep native modal focus, Escape and top-layer behavior while anchoring its CSS transition. */
export function openArenaDialog(dialog: HTMLDialogElement | null, trigger: HTMLElement) {
  if (!dialog || dialog.open) return;
  const origin = trigger.getBoundingClientRect();
  dialog.style.setProperty('--arena-panel-origin-x', (origin.left + origin.width / 2) + 'px');
  dialog.style.setProperty('--arena-panel-origin-y', (origin.top + origin.height / 2) + 'px');
  dialog.showModal();
}
