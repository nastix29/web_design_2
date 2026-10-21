import { UIComponent } from '../UIComponent.js';

const TIMEOUT_MS = 10000;

/**
 * Общий класс для виджетов, которые берут данные из внешнего API.
 * Показывает три состояния: загрузка → результат или ошибка с «Повторить».
 * Наследник реализует fetchData(signal) и showResult(data).
 */
export class ApiWidget extends UIComponent {
  constructor(options) {
    super(options);
    this.controller = null;
    this.destroyed = false;
  }

  renderBody(body) {
    this.content = document.createElement('div');
    body.append(this.content);

    // Кнопки внутри карточки пересоздаются, поэтому слушаем клики
    // один раз на контейнере (делегирование) — обработчики не копятся.
    this.listen(this.content, 'click', (event) => {
      const button = event.target.closest('[data-action]');
      if (button) this.handleAction(button.dataset.action);
    });

    this.load();
  }

  handleAction(action) {
    if (action === 'retry' || action === 'reload') this.load();
  }

  async load() {
    // Отменяем предыдущий запрос, если он ещё идёт
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);

    this.showLoading();

    try {
      const data = await this.fetchData(controller.signal);
      if (this.destroyed || this.controller !== controller) return;
      this.showResult(data);
    } catch (error) {
      // Карточку удалили или начался новый запрос — молча выходим
      if (this.destroyed || this.controller !== controller) return;
      console.error(`[${this.title}]`, error);
      this.showError(this._errorMessage(error, timedOut));
    } finally {
      clearTimeout(timer);
    }
  }

  /** fetch + проверка response.ok + разбор JSON */
  async fetchJSON(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Сервер ответил ошибкой ${response.status}`);
    }
    return response.json();
  }

  _errorMessage(error, timedOut) {
    if (timedOut) return 'Сервер не ответил за 10 секунд.';
    if (!navigator.onLine) return 'Нет подключения к интернету.';
    if (error instanceof TypeError) return 'Не удалось связаться с сервером.';
    return error.message || 'Что-то пошло не так.';
  }

  showLoading() {
    const box = this._stateBox('state');
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = document.createElement('p');
    text.className = 'state__text';
    text.textContent = 'Загружаем данные…';
    box.append(spinner, text);
  }

  showError(message) {
    const box = this._stateBox('state state--error');
    box.setAttribute('role', 'alert');

    const icon = document.createElement('p');
    icon.className = 'state__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '🙀';

    const text = document.createElement('p');
    text.className = 'state__text';
    text.textContent = message;

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn';
    retry.dataset.action = 'retry';
    retry.textContent = 'Повторить';

    box.append(icon, text, retry);
  }

  _stateBox(className) {
    const box = document.createElement('div');
    box.className = className;
    this.content.replaceChildren(box);
    return box;
  }

  /** Наследник: вернуть данные или бросить ошибку. */
  async fetchData(signal) {
    throw new Error('fetchData не реализован');
  }

  /** Наследник: нарисовать данные в this.content. */
  showResult(data) {}

  destroy() {
    this.destroyed = true;
    this.controller?.abort();
    this.controller = null;
    super.destroy();
  }
}
