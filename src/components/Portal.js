// src/components/Portal.js
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Компонент Portal для рендеринга модальных окон вне основного DOM-дерева
 * Это решает проблему с overflow контейнерами, которые ограничивают position: fixed
 */
function Portal({ children }) {
  const mount = document.body;
  const el = document.createElement('div');

  useEffect(() => {
    mount.appendChild(el);
    return () => mount.removeChild(el);
  }, [el, mount]);

  return createPortal(children, el);
}

export default Portal;
