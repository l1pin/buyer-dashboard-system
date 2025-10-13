// src/utils/syncTimer.js
// Синхронизированный таймер для всех пользователей

class SyncTimer {
  constructor(interval = 5000) {
    this.interval = interval;
    this.callbacks = new Set();
    this.timerId = null;
    this.isRunning = false;
  }

  // Вычислить задержку до следующего "круглого" интервала
  getDelayToNextInterval() {
    const now = Date.now();
    const msIntoInterval = now % this.interval;
    const delay = this.interval - msIntoInterval;
    
    console.log(`⏰ Текущее время: ${new Date(now).toLocaleTimeString()}.${now % 1000}`);
    console.log(`⏰ Задержка до синхронизации: ${delay}ms`);
    console.log(`⏰ Следующий запуск: ${new Date(now + delay).toLocaleTimeString()}.${(now + delay) % 1000}`);
    
    return delay;
  }

  // Запустить синхронизированный таймер
  start() {
    if (this.isRunning) {
      console.warn('⚠️ Таймер уже запущен');
      return;
    }

    console.log(`🚀 Запуск синхронизированного таймера (интервал: ${this.interval}ms)`);
    
    // Первый запуск - выравниваем по "круглому" времени
    const initialDelay = this.getDelayToNextInterval();
    
    setTimeout(() => {
      console.log('⚡ СИНХРОННЫЙ ЗАПУСК! Время:', new Date().toLocaleTimeString());
      this.executeCallbacks();
      
      // Запускаем регулярный таймер
      this.timerId = setInterval(() => {
        console.log('⚡ СИНХРОННЫЙ ЗАПУСК! Время:', new Date().toLocaleTimeString());
        this.executeCallbacks();
      }, this.interval);
      
      this.isRunning = true;
    }, initialDelay);
  }

  // Остановить таймер
  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    console.log('⏹️ Синхронизированный таймер остановлен');
  }

  // Добавить callback
  subscribe(callback) {
    this.callbacks.add(callback);
    console.log(`✅ Подписка добавлена. Всего подписок: ${this.callbacks.size}`);
  }

  // Удалить callback
  unsubscribe(callback) {
    this.callbacks.delete(callback);
    console.log(`✅ Подписка удалена. Осталось подписок: ${this.callbacks.size}`);
    
    // Если больше нет подписчиков - останавливаем таймер
    if (this.callbacks.size === 0) {
      this.stop();
    }
  }

  // Выполнить все callbacks
  executeCallbacks() {
    this.callbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('❌ Ошибка в callback:', error);
      }
    });
  }

  // Получить время до следующего запуска
  getTimeToNextTick() {
    if (!this.isRunning) return null;
    return this.getDelayToNextInterval();
  }
}

// Singleton instance для Trello обновлений
export const trelloSyncTimer = new SyncTimer(5000); // 5 секунд

// Экспортируем класс для создания других таймеров
export default SyncTimer;
