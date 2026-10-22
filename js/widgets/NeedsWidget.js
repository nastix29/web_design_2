import { UIComponent } from '../UIComponent.js';

const MAX_LENGTH = 80;

// Стартовый список — показывается только при первом добавлении виджета
const STARTER_ITEMS = [
  { name: 'Сухой корм для собак', urgent: true },
  { name: 'Наполнитель для кошачьих туалетов', urgent: false },
  { name: 'Одноразовые пелёнки', urgent: true },
  { name: 'Капли от блох и клещей', urgent: false },
];

const FILTERS = {
  all: 'Все',
  needed: 'Нужно',
  collected: 'Собрано',
};

/** «Нужно приюту»: список вещей с пометкой «срочно» и отметкой «собрано». */
export class NeedsWidget extends UIComponent {
  constructor(options) {
    super(options);
    this.items = Array.isArray(options.items)
      ? NeedsWidget.cleanItems(options.items)
      : NeedsWidget.cleanItems(STARTER_ITEMS);
    this.filter = FILTERS[options.filter] ? options.filter : 'all';
  }

  static cleanItems(items) {
    return items
      .filter((it) => it && typeof it.name === 'string' && it.name.trim() !== '')
      .map((it, i) => ({
        id: typeof it.id === 'string' ? it.id : `need-${Date.now()}-${i}`,
        name: it.name.trim().slice(0, MAX_LENGTH),
        urgent: Boolean(it.urgent),
        collected: Boolean(it.collected),
      }));
  }

  renderBody(body) {
    this.counter = document.createElement('p');
    this.counter.className = 'needs__counter';

    // Форма добавления
    const form = document.createElement('form');
    form.className = 'needs__form';
    form.noValidate = true;

    const row = document.createElement('div');
    row.className = 'todo__form';
    this.input = document.createElement('input');
    this.input.className = 'todo__input';
    this.input.type = 'text';
    this.input.maxLength = MAX_LENGTH;
    this.input.placeholder = 'Например: миски';
    this.input.setAttribute('aria-label', 'Что нужно приюту');
    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'btn';
    addBtn.textContent = 'Добавить';
    row.append(this.input, addBtn);

    const urgentLabel = document.createElement('label');
    urgentLabel.className = 'needs__urgent-toggle';
    this.urgentInput = document.createElement('input');
    this.urgentInput.type = 'checkbox';
    urgentLabel.append(this.urgentInput, ' Срочно');

    form.append(row, urgentLabel);

    this.hint = document.createElement('p');
    this.hint.className = 'todo__hint';
    this.hint.setAttribute('aria-live', 'polite');

    // Фильтры
    this.filterBar = document.createElement('div');
    this.filterBar.className = 'needs__filters';
    this.filterBar.setAttribute('role', 'group');
    this.filterBar.setAttribute('aria-label', 'Фильтр списка');
    for (const [key, label] of Object.entries(FILTERS)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip';
      btn.dataset.filter = key;
      btn.textContent = label;
      this.filterBar.append(btn);
    }

    this.list = document.createElement('ul');
    this.list.className = 'todo__list';

    this.empty = document.createElement('p');
    this.empty.className = 'todo__empty';

    body.append(this.counter, form, this.hint, this.filterBar, this.list, this.empty);

    this.listen(form, 'submit', (event) => {
      event.preventDefault();
      this.addItem(this.input.value, this.urgentInput.checked);
    });
    this.listen(this.input, 'input', () => this._setHint(''));

    this.listen(this.filterBar, 'click', (event) => {
      const btn = event.target.closest('[data-filter]');
      if (!btn) return;
      this.filter = btn.dataset.filter;
      this._changed();
    });

    this.listen(this.list, 'change', (event) => {
      if (event.target.matches('.todo__check')) {
        this.toggle(event.target.closest('.todo__item').dataset.id, 'collected');
      }
    });

    this.listen(this.list, 'click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      const id = btn.closest('.todo__item').dataset.id;
      if (btn.dataset.action === 'urgent') this.toggle(id, 'urgent');
      if (btn.dataset.action === 'remove') this.removeItem(id);
    });

    this.update();
  }

  addItem(rawName, urgent) {
    const name = rawName.trim();
    if (!name) {
      this._setHint('Введите название');
      this.input.focus();
      return;
    }
    if (this.items.some((it) => it.name.toLowerCase() === name.toLowerCase() && !it.collected)) {
      this._setHint('Это уже есть в списке');
      this.input.focus();
      return;
    }
    this.items.push({ id: `need-${Date.now()}`, name, urgent, collected: false });
    this.input.value = '';
    this.urgentInput.checked = false;
    this.input.focus();
    // Чтобы новая вещь была видна, переключаемся с «Собрано»
    if (this.filter === 'collected') this.filter = 'all';
    this._changed();
  }

  toggle(id, field) {
    const item = this.items.find((it) => it.id === id);
    if (!item) return;
    item[field] = !item[field];
    this._changed();
  }

  removeItem(id) {
    this.items = this.items.filter((it) => it.id !== id);
    this._changed();
  }

  _setHint(text) {
    this.hint.textContent = text;
    this.input.classList.toggle('is-invalid', Boolean(text));
  }

  _changed() {
    this.update();
    this.onChange?.();
  }

  /** Срочные и несобранные — наверху. */
  _visibleItems() {
    const filtered = this.items.filter((it) => {
      if (this.filter === 'needed') return !it.collected;
      if (this.filter === 'collected') return it.collected;
      return true;
    });
    const rank = (it) => (it.collected ? 2 : it.urgent ? 0 : 1);
    return filtered.sort((a, b) => rank(a) - rank(b));
  }

  update() {
    const needed = this.items.filter((it) => !it.collected);
    const urgent = needed.filter((it) => it.urgent).length;
    this.counter.textContent = needed.length === 0
      ? '✨ Всё собрано!'
      : `Нужно: ${needed.length}` + (urgent ? ` · срочно: ${urgent}` : '');

    for (const btn of this.filterBar.children) {
      const active = btn.dataset.filter === this.filter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }

    this.list.replaceChildren();
    const visible = this._visibleItems();

    for (const item of visible) {
      const li = document.createElement('li');
      li.className = 'todo__item';
      li.classList.toggle('is-done', item.collected);
      li.dataset.id = item.id;

      const checkboxId = `${this.id}-${item.id}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo__check';
      checkbox.id = checkboxId;
      checkbox.checked = item.collected;
      checkbox.title = 'Собрано';

      const label = document.createElement('label');
      label.className = 'todo__text';
      label.htmlFor = checkboxId;
      label.textContent = item.name;

      const urgentBtn = document.createElement('button');
      urgentBtn.type = 'button';
      urgentBtn.className = 'badge';
      urgentBtn.classList.toggle('is-urgent', item.urgent);
      urgentBtn.dataset.action = 'urgent';
      urgentBtn.textContent = item.urgent ? 'срочно' : 'обычно';
      urgentBtn.title = 'Переключить срочность';
      urgentBtn.setAttribute('aria-label', `${item.name}: ${item.urgent ? 'срочно' : 'не срочно'}, переключить`);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'icon-btn icon-btn--danger';
      removeBtn.dataset.action = 'remove';
      removeBtn.textContent = '🗑';
      removeBtn.setAttribute('aria-label', `Удалить «${item.name}»`);

      li.append(checkbox, label, urgentBtn, removeBtn);
      this.list.append(li);
    }

    if (visible.length === 0) {
      this.empty.hidden = false;
      this.empty.textContent = this.items.length === 0
        ? 'Список пуст — добавьте, что нужно приюту 🐾'
        : 'В этом фильтре ничего нет';
    } else {
      this.empty.hidden = true;
    }
  }

  getState() {
    return { ...super.getState(), items: this.items, filter: this.filter };
  }
}
