// Исправленный index.js без ServiceWorker
// Замените содержимое src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Создаем корневой элемент
const root = ReactDOM.createRoot(document.getElementById('root'));

// Рендерим приложение
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Убираем регистрацию ServiceWorker чтобы избежать ошибки 404
