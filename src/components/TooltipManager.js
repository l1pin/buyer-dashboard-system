// src/components/TooltipManager.js
// Изолированный менеджер tooltip'ов - не вызывает ре-рендер родителя
import React, { useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

// Легковесный tooltip без лишних оберток
const Tooltip = React.memo(({ id, title, content, position, zIndex, onClose }) => {
  const positionRef = React.useRef({ x: position.x, y: position.y });
  const tooltipRef = React.useRef(null);
  const isDraggingRef = React.useRef(false);
  const dragOffsetRef = React.useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.close-btn')) return;
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
    e.preventDefault();
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current || !tooltipRef.current) return;
      positionRef.current = {
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y
      };
      tooltipRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
    };
    const handleMouseUp = () => { isDraggingRef.current = false; };
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: 0,
        left: 0,
        zIndex,
        minWidth: '300px',
        maxWidth: '600px',
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <div
        className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between cursor-grab select-none"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold text-gray-900 pointer-events-none">{title}</h3>
        <button
          onClick={() => onClose(id)}
          className="close-btn text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        {content}
      </div>
    </div>
  );
});

// Менеджер с собственным изолированным state
const TooltipManager = forwardRef((props, ref) => {
  const [tooltips, setTooltips] = useState([]);

  const open = useCallback((id, title, content, position) => {
    setTooltips(prev => {
      if (prev.find(t => t.id === id)) return prev;
      return [...prev, { id, title, content, position, zIndex: 1000 + prev.length }];
    });
  }, []);

  const close = useCallback((id) => {
    setTooltips(prev => prev.filter(t => t.id !== id));
  }, []);

  // Экспортируем методы через ref
  useImperativeHandle(ref, () => ({ open, close }), [open, close]);

  if (tooltips.length === 0) return null;

  return ReactDOM.createPortal(
    <>
      {tooltips.map(t => (
        <Tooltip
          key={t.id}
          id={t.id}
          title={t.title}
          content={t.content}
          position={t.position}
          zIndex={t.zIndex}
          onClose={close}
        />
      ))}
    </>,
    document.body
  );
});

export default TooltipManager;
