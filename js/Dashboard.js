import { ToDoWidget } from './widgets/ToDoWidget.js';
import { WeatherWidget } from './widgets/WeatherWidget.js';
import { DogWidget } from './widgets/DogWidget.js';
import { loadState, saveState } from './storage.js';

// Какие виджеты бывают: тип → класс, заголовок, иконка
const WIDGET_TYPES = {
  todo: { Class: ToDoWidget, title: 'Задачи смены', icon: '📋' },
  weather: { Class: WeatherWidget, title: 'Погода для выгула', icon: '🌤️' },
  dog: { Class: DogWidget, title: 'Ищет дом', icon: '🐶' },
};

const DEFAULT_SET = ['todo', 'weather', 'dog'];

/** Управляет набором виджетов: добавление, удаление, сохранение. */
export class Dashboard {
  constructor({ container, emptyState, toolbarButtons, notify }) {
    this.container = container;
    this.emptyState = emptyState;
    this.toolbarButtons = toolbarButtons;
    this.notify = notify ?? (() => {});
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
      this.container.append(widget.render());
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

  /** Пустое состояние и отметки «✓» на кнопках панели. */
  updateUI() {
    this.emptyState.hidden = this.widgets.size > 0;
    for (const button of this.toolbarButtons) {
      const active = Boolean(this.findByType(button.dataset.add));
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
}
