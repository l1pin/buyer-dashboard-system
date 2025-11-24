// src/components/DraggableTooltip.js
import React, { useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';

/**
 * Высокопроизводительное перетаскиваемое окно
 * - Использует transform вместо left/top для GPU-ускорения
 * - Рендерится в портал для изоляции от родительских ре-рендеров
 * - Позиция хранится в ref, не в state - нет ре-рендеров при перемещении
 */
const DraggableTooltip = React.memo(function DraggableTooltip({
  title,
  children,
  onClose,
  initialPosition = { x: 100, y: 100 },
  zIndex = 1000
}) {
  const tooltipRef = useRef(null);
  const positionRef = useRef({ x: initialPosition.x, y: initialPosition.y });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Применяем позицию через transform (без setState - нет ре-рендеров!)
  const applyPosition = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
    }
  }, []);

  // Устанавливаем начальную позицию
  useEffect(() => {
    applyPosition();
  }, [applyPosition]);

  // Обработчик начала перетаскивания
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.close-button')) return;

    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };

    if (tooltipRef.current) {
      tooltipRef.current.style.cursor = 'grabbing';
      tooltipRef.current.style.userSelect = 'none';
    }

    e.preventDefault();
  }, []);

  // Глобальные обработчики мыши
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDraggingRef.current) return;

      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;

      // Ограничиваем границами окна
      const maxX = window.innerWidth - (tooltipRef.current?.offsetWidth || 300);
      const maxY = window.innerHeight - (tooltipRef.current?.offsetHeight || 200);

      positionRef.current = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      };

      // Прямое обновление DOM без React - максимальная производительность
      if (tooltipRef.current) {
        tooltipRef.current.style.transform = `translate3d(${positionRef.current.x}px, ${positionRef.current.y}px, 0)`;
      }
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        if (tooltipRef.current) {
          tooltipRef.current.style.cursor = '';
          tooltipRef.current.style.userSelect = '';
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Мемоизированный обработчик закрытия
  const handleClose = useCallback((e) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  // Рендерим в портал для изоляции от родительского дерева
  const content = (
    <div
      ref={tooltipRef}
      className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
      style={{
        top: 0,
        left: 0,
        zIndex: zIndex,
        minWidth: '300px',
        maxWidth: '600px',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        perspective: 1000,
      }}
    >
      {/* Заголовок */}
      <div
        className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between cursor-grab select-none"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-semibold text-gray-900 pointer-events-none">{title}</h3>
        <button
          onClick={handleClose}
          className="close-button text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-1"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Содержимое */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {children}
      </div>
    </div>
  );

  // Портал - рендерим вне основного дерева React
  return ReactDOM.createPortal(content, document.body);
});

export default DraggableTooltip;
