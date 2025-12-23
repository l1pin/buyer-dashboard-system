// src/components/Portal.js
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Компонент Portal для рендеринга модальных окон вне основного DOM-дерева
 * Это решает проблему с overflow контейнерами, которые ограничивают position: fixed
 */
function Portal({ children }) {
  const mount = document.body;
  // Используем useRef чтобы div создавался только ОДИН раз, а не при каждом рендере
  const elRef = useRef(null);

  if (!elRef.current) {
    elRef.current = document.createElement('div');
  }

  useEffect(() => {
    const el = elRef.current;
    mount.appendChild(el);
    return () => mount.removeChild(el);
  }, [mount]);

  return createPortal(children, elRef.current);
}

export default Portal;
