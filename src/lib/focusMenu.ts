import type { FocusEvent } from 'react';

export const closeMenuAfterFocusLeaves = (event: FocusEvent<HTMLElement>, closeMenu: () => void) => {
  const menuWrap = event.currentTarget;
  const nextFocus = event.relatedTarget;

  if (nextFocus instanceof Node) {
    if (!menuWrap.contains(nextFocus)) {
      closeMenu();
    }

    return;
  }

  window.setTimeout(() => {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof Node) || !menuWrap.contains(activeElement)) {
      closeMenu();
    }
  }, 0);
};
