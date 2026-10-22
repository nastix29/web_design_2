/**
 * Базовый класс карточки-виджета.
 * Создаёт заголовок с кнопками «свернуть» и «удалить»,
 * запоминает свои обработчики и таймеры, чтобы destroy() всё убрал.
 */
export class UIComponent {
  constructor({ id, title, icon = '🐾', collapsed = false }) {
    this.id = id;
    this.title = title;
    this.icon = icon;
    this.collapsed = Boolean(collapsed);

    this.element = null;
    this.body = null;

    this._listeners = [];
    this._timers = [];

    // Колбэки задаёт Dashboard
    this.onRemove = null;
    this.onChange = null;
    this.onData = null; // новые данные для сводки (без сохранения)
  }

  /** Добавляет обработчик и запоминает его для destroy(). */
  listen(target, eventName, handler) {
    target.addEventListener(eventName, handler);
    this._listeners.push({ target, eventName, handler });
  }

  /** setTimeout, который будет отменён при удалении карточки. */
  setTimer(callback, ms) {
    const timerId = setTimeout(callback, ms);
    this._timers.push(timerId);
    return timerId;
  }

  render() {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = this.id;

    const header = document.createElement('header');
    header.className = 'card__header';

    const icon = document.createElement('span');
    icon.className = 'card__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = this.icon;

    const title = document.createElement('h2');
    title.className = 'card__title';
    title.textContent = this.title;

    const actions = document.createElement('div');
    actions.className = 'card__actions';

    this.collapseBtn = document.createElement('button');
    this.collapseBtn.type = 'button';
    this.collapseBtn.className = 'icon-btn';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-btn icon-btn--danger';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Удалить виджет';
    removeBtn.setAttribute('aria-label', `Удалить виджет «${this.title}»`);

    actions.append(this.collapseBtn, removeBtn);
    header.append(icon, title, actions);

    this.body = document.createElement('div');
    this.body.className = 'card__body';
    this.body.id = `${this.id}-body`;
    this.collapseBtn.setAttribute('aria-controls', this.body.id);

    card.append(header, this.body);
    this.element = card;

    this.listen(this.collapseBtn, 'click', () => this.toggleCollapsed());
    this.listen(removeBtn, 'click', () => this.onRemove?.(this.id));

    this._applyCollapsed();
    this.renderBody(this.body);

    return card;
  }

  /** Наследники рисуют здесь своё содержимое. */
  renderBody(body) {}

  toggleCollapsed() {
    this.collapsed = !this.collapsed;
    this._applyCollapsed();
    this.onChange?.();
  }

  _applyCollapsed() {
    if (!this.element) return;
    this.element.classList.toggle('is-collapsed', this.collapsed);
    this.collapseBtn.textContent = this.collapsed ? '▾' : '–';
    this.collapseBtn.title = this.collapsed ? 'Развернуть' : 'Свернуть';
    this.collapseBtn.setAttribute('aria-label', this.collapsed ? 'Развернуть виджет' : 'Свернуть виджет');
    this.collapseBtn.setAttribute('aria-expanded', String(!this.collapsed));
  }

  /** Подсветка карточки (например, при попытке добавить её повторно). */
  highlight() {
    if (!this.element) return;
    this.element.classList.remove('is-highlighted');
    void this.element.offsetWidth; // перезапуск анимации
    this.element.classList.add('is-highlighted');
    this.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /** Данные для сохранения в localStorage. Наследники дополняют. */
  getState() {
    return { collapsed: this.collapsed };
  }

  destroy() {
    for (const { target, eventName, handler } of this._listeners) {
      target.removeEventListener(eventName, handler);
    }
    this._listeners = [];

    for (const timerId of this._timers) clearTimeout(timerId);
    this._timers = [];

    this.element?.remove();
    this.element = null;
    this.body = null;
    this.onRemove = null;
    this.onChange = null;
    this.onData = null;
  }
}
