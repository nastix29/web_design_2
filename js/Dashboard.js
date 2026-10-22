import { ToDoWidget } from './widgets/ToDoWidget.js';
import { WeatherWidget } from './widgets/WeatherWidget.js';
import { DogWidget } from './widgets/DogWidget.js';
import { FundraiserWidget } from './widgets/FundraiserWidget.js';
import { NeedsWidget } from './widgets/NeedsWidget.js';
import { loadState, saveState } from './storage.js';

// Какие виджеты бывают: тип → класс, заголовок, иконка
const WIDGET_TYPES = {
  todo: { Class: ToDoWidget, title: 'Задачи смены', icon: '📋' },
  weather: { Class: WeatherWidget, title: 'Погода для выгула', icon: '🌤️' },
  dog: { Class: DogWidget, title: 'Ищет дом', icon: '🐶' },
  fund: { Class: FundraiserWidget, title: 'Сбор на корм', icon: '🥫' },
  needs: { Class: NeedsWidget, title: 'Нужно приюту', icon: '📦' },
};

// Композиция: два ряда. Карточки в ряду делят ширину поровну
// и всегда стоят в этом порядке, в каком бы порядке их ни добавляли.
const ROWS = [
  ['weather', 'dog', 'fund'], // «Сегодня»
  ['todo', 'needs'],          // «Списки»
];
const ORDER = ROWS.flat();
const GRID_COLUMNS = 6;

const DEFAULT_SET = ORDER;

/** Управляет набором виджетов: добавление, удаление, раскладка, сохранение. */
export class Dashboard {
  constructor({ container, emptyState, toolbarButtons, notify, onSummary }) {
    this.container = container;
    this.emptyState = emptyState;
    this.toolbarButtons = toolbarButtons;
    this.notify = notify ?? (() => {});
    this.onSummary = onSummary ?? (() => {});
    this.widgets = new Map(); // id → виджет
    this.saveWarningShown = false;
  }

  findByType(type) {
    for (const widget of this.widgets.values()) {
      if (widget.type === type) return widget;
    }
    return null;
  }

  addWidget(type, savedState = {}, { save = true } = {}) {
    const config = WIDGET_TYPES[type];
    if (!config) {
      console.warn('Неизвестный тип виджета:', type);
      return null;
    }

    const existing = this.findByType(type);
    if (existing) {
      this.notify(`«${config.title}» уже на панели`);
      existing.highlight();
      return null;
    }

    const id = typeof savedState.id === 'string' ? savedState.id : `${type}-${Date.now()}`;
    let widget = null;

    // Ошибка в одном виджете не должна ломать всю панель
    try {
      widget = new config.Class({ ...savedState, id, title: config.title, icon: config.icon });
      widget.type = type;
      widget.onRemove = () => this.removeWidget(id);
      widget.onChange = () => this.save();
      widget.onData = () => this.emitSummary();

      const element = widget.render();
      element.dataset.type = type;
      element.classList.add(`card--${type}`);
      this._insertInOrder(element, type);
    } catch (error) {
      console.error(`Не удалось создать виджет «${config.title}»:`, error);
      widget?.destroy();
      this.notify(`Не удалось создать виджет «${config.title}»`);
      return null;
    }

    this.widgets.set(id, widget);
    this.updateUI();
    if (save) this.save();
    return widget;
  }

  removeWidget(id) {
    const widget = this.widgets.get(id);
    if (!widget) return;
    widget.destroy();
    this.widgets.delete(id);
    this.updateUI();
    this.save();
  }

  /** Вставляет карточку на её место по порядку ORDER. */
  _insertInOrder(element, type) {
    const index = ORDER.indexOf(type);
    const next = [...this.container.children].find((el) => ORDER.indexOf(el.dataset.type) > index);
    this.container.insertBefore(element, next ?? null);
  }

  /** Ширина карточек: ряд из 3 → по трети, из 2 → по половине, из 1 → во всю ширину. */
  updateLayout() {
    for (const row of ROWS) {
      const present = row.map((type) => this.findByType(type)).filter(Boolean);
      for (const widget of present) {
        widget.element?.style.setProperty('--span', String(GRID_COLUMNS / present.length));
      }
    }
  }

  save() {
    const data = [...this.widgets.values()].map((w) => ({
      type: w.type,
      id: w.id,
      ...w.getState(),
    }));
    const ok = saveState(data);
    if (!ok && !this.saveWarningShown) {
      this.saveWarningShown = true;
      this.notify('Не получилось сохранить — изменения пропадут после обновления');
    }
    this.emitSummary();
  }

  restore() {
    const { widgets, problem } = loadState();
    if (problem) this.notify(problem);

    const list = widgets ?? DEFAULT_SET.map((type) => ({ type }));
    for (const item of list) {
      this.addWidget(item.type, item, { save: false });
    }
    this.updateUI();
    this.save();
  }

  /** Короткая сводка для героя-блока. null — виджета нет на панели. */
  getSummary() {
    const todo = this.findByType('todo');
    const fund = this.findByType('fund');
    const needs = this.findByType('needs');
    const weather = this.findByType('weather');

    return {
      tasks: todo
        ? { total: todo.tasks.length, done: todo.tasks.filter((t) => t.done).length }
        : null,
      fund: fund
        ? { percent: Math.min(100, Math.round((fund.raised / fund.goal) * 100)) }
        : null,
      needs: needs
        ? (() => {
            const urgentItems = needs.items.filter((it) => it.urgent && !it.collected);
            return { urgent: urgentItems.length, urgentNames: urgentItems.map((it) => it.name) };
          })()
        : null,
      weather: weather?.summary ?? null,
    };
  }

  emitSummary() {
    try {
      this.onSummary(this.getSummary());
    } catch (error) {
      console.error('Не удалось обновить сводку:', error);
    }
  }

  /** Пустое состояние, раскладка и отметки «✓» на кнопках панели. */
  updateUI() {
    this.emptyState.hidden = this.widgets.size > 0;
    this.updateLayout();
    for (const button of this.toolbarButtons) {
      const active = Boolean(this.findByType(button.dataset.add));
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}
