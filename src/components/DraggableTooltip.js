// src/components/DraggableTooltip.js
import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Перетаскиваемое всплывающее окно (tooltip)
 * - Располагается поверх всей страницы
 * - Можно перетаскивать за заголовок
 * - Закрывается только при клике на крестик
 * - Можно открывать несколько окон одновременно
 */
const DraggableTooltip = React.memo(function DraggableTooltip({ title, children, onClose, initialPosition = { x: 100, y: 100 }, zIndex = 1000 }) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);

  // Обработчик начала перетаскивания
  const handleMouseDown = (e) => {
    // Проверяем, что клик был по заголовку, а не по кнопке закрытия
    if (e.target.closest('.close-button')) {
      return;
    }

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Обработчик перемещения
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Ограничиваем перемещение границами окна браузера
        const maxX = window.innerWidth - (tooltipRef.current?.offsetWidth || 0);
        const maxY = window.innerHeight - (tooltipRef.current?.offsetHeight || 0);

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={tooltipRef}
      className="fixed bg-white border-2 border-gray-300 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: zIndex,
        minWidth: '300px',
        maxWidth: '600px',
        userSelect: isDragging ? 'none' : 'auto'
      }}
    >
      {/* Заголовок с возможностью перетаскивания */}
      <div
        className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between cursor-move select-none"
        onMouseDown={handleMouseDown}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>

        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="close-button text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-1 transition-colors"
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
});

export default DraggableTooltip;
