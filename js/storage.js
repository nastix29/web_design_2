import { STORAGE_KEY } from './config.js';

/**
 * Читает сохранённую панель.
 * Возвращает { widgets, problem }:
 *  widgets — массив или null (если сохранения ещё нет / оно повреждено),
 *  problem — текст для пользователя, если что-то пошло не так.
 */
export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn('localStorage недоступен:', error);
    return { widgets: null, problem: 'Браузер запретил сохранение — данные не запомнятся.' };
  }

  if (raw === null) return { widgets: null, problem: null };

  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.widgets)) throw new Error('Неверный формат');
    const widgets = data.widgets.filter((w) => w && typeof w.type === 'string');
    return { widgets, problem: null };
  } catch (error) {
    console.warn('Сохранение повреждено, начинаем заново:', error);
    return { widgets: null, problem: 'Сохранение было повреждено — панель собрана заново.' };
  }
}

/** Сохраняет панель. Возвращает true/false — не бросает ошибок. */
export function saveState(widgets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ widgets }));
    return true;
  } catch (error) {
    console.warn('Не удалось сохранить:', error);
    return false;
  }
}
