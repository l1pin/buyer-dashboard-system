// src/components/DraggableTooltip.js
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const dragOffset = useRef({ x: 0, y: 0 });
  const tooltipRef = useRef(null);
  const rafId = useRef(null);

  // Обработчик начала перетаскивания
  const handleMouseDown = useCallback((e) => {
    // Проверяем, что клик был по заголовку, а не по кнопке закрытия
    if (e.target.closest('.close-button')) {
      return;
    }

    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position.x, position.y]);

  // Мемоизированный обработчик закрытия
  const handleClose = useCallback((e) => {
    e.stopPropagation();
    onClose();
  }, [onClose]);

  // Обработчик перемещения с requestAnimationFrame для плавности
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      // Отменяем предыдущий кадр, если он еще не отрисован
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      // Используем requestAnimationFrame для плавного обновления
      rafId.current = requestAnimationFrame(() => {
        const newX = e.clientX - dragOffset.current.x;
        const newY = e.clientY - dragOffset.current.y;

        // Ограничиваем перемещение границами окна браузера
        const maxX = window.innerWidth - (tooltipRef.current?.offsetWidth || 300);
        const maxY = window.innerHeight - (tooltipRef.current?.offsetHeight || 200);

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [isDragging]);

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
        userSelect: isDragging ? 'none' : 'auto',
        willChange: isDragging ? 'left, top' : 'auto',
        transform: 'translate3d(0, 0, 0)', // GPU acceleration (3d лучше чем translateZ)
        backfaceVisibility: 'hidden', // Smoother rendering
        contain: 'layout style paint', // CSS containment для изоляции рендеринга
        pointerEvents: 'auto', // Мгновенная реакция на события
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
          onClick={handleClose}
          className="close-button text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded p-1"
          title="Закрыть"
          style={{ transition: 'none' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Содержимое */}
      <div
        className="p-4 max-h-96 overflow-y-auto"
        style={{
          contain: 'strict', // Строгая изоляция для производительности
          overscrollBehavior: 'contain', // Предотвращает прокрутку родителя
        }}
      >
        {children}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Кастомное сравнение для React.memo - возвращаем true если НЕ нужно ре-рендерить
  return (
    prevProps.title === nextProps.title &&
    prevProps.zIndex === nextProps.zIndex &&
    prevProps.initialPosition.x === nextProps.initialPosition.x &&
    prevProps.initialPosition.y === nextProps.initialPosition.y &&
    prevProps.onClose === nextProps.onClose
    // children не сравниваем, так как они меняются редко
  );
});

export default DraggableTooltip;
