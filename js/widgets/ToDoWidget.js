import { UIComponent } from '../UIComponent.js';

const MAX_LENGTH = 120;

/** Список дел волонтёра: добавить, отметить, удалить. */
export class ToDoWidget extends UIComponent {
  constructor(options) {
    super(options);
    this.tasks = ToDoWidget.cleanTasks(options.tasks);
  }

  /** Проверяем задачи из сохранения: битые записи просто отбрасываем. */
  static cleanTasks(tasks) {
    if (!Array.isArray(tasks)) return [];
    return tasks
      .filter((t) => t && typeof t.text === 'string' && t.text.trim() !== '')
      .map((t, i) => ({
        id: typeof t.id === 'string' ? t.id : `task-${Date.now()}-${i}`,
        text: t.text.trim().slice(0, MAX_LENGTH),
        done: Boolean(t.done),
      }));
  }

  renderBody(body) {
    const form = document.createElement('form');
    form.className = 'todo__form';
    form.noValidate = true;

    this.input = document.createElement('input');
    this.input.className = 'todo__input';
    this.input.type = 'text';
    this.input.maxLength = MAX_LENGTH;
    this.input.placeholder = 'Например: покормить кошек';
    this.input.setAttribute('aria-label', 'Новая задача');

    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.type = 'submit';
    addBtn.textContent = 'Добавить';

    form.append(this.input, addBtn);

    this.hint = document.createElement('p');
    this.hint.className = 'todo__hint';
    this.hint.setAttribute('aria-live', 'polite');

    this.list = document.createElement('ul');
    this.list.className = 'todo__list';

    this.footer = document.createElement('p');
    this.footer.className = 'todo__counter';

    body.append(form, this.hint, this.list, this.footer);

    this.listen(form, 'submit', (event) => {
      event.preventDefault();
      this.addTask(this.input.value);
    });

    this.listen(this.input, 'input', () => this._setHint(''));

    // Делегирование: один обработчик на весь список
    this.listen(this.list, 'change', (event) => {
      if (event.target.matches('.todo__check')) {
        this.toggleTask(event.target.closest('.todo__item').dataset.id);
      }
    });

    this.listen(this.list, 'click', (event) => {
      const removeBtn = event.target.closest('[data-action="remove-task"]');
      if (removeBtn) this.removeTask(removeBtn.closest('.todo__item').dataset.id);
    });

    this.renderTasks();
  }

  addTask(rawText) {
    const text = rawText.trim();
    if (!text) {
      this._setHint('Введите текст задачи');
      this.input.focus();
      return;
    }
    this.tasks.push({ id: `task-${Date.now()}`, text, done: false });
    this.input.value = '';
    this.input.focus();
    this._changed();
  }

  toggleTask(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    this._changed();
  }

  removeTask(id) {
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this._changed();
  }

  _changed() {
    this.renderTasks();
    this.onChange?.();
  }

  _setHint(text) {
    this.hint.textContent = text;
    this.input.classList.toggle('is-invalid', Boolean(text));
  }

  renderTasks() {
    this.list.replaceChildren();

    for (const task of this.tasks) {
      const item = document.createElement('li');
      item.className = 'todo__item';
      item.classList.toggle('is-done', task.done);
      item.dataset.id = task.id;

      const checkboxId = `${this.id}-${task.id}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'todo__check';
      checkbox.id = checkboxId;
      checkbox.checked = task.done;

      const label = document.createElement('label');
      label.className = 'todo__text';
      label.htmlFor = checkboxId;
      label.textContent = task.text; // только textContent — без HTML

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'icon-btn icon-btn--danger';
      removeBtn.dataset.action = 'remove-task';
      removeBtn.textContent = '🗑';
      removeBtn.setAttribute('aria-label', `Удалить задачу «${task.text}»`);

      item.append(checkbox, label, removeBtn);
      this.list.append(item);
    }

    const left = this.tasks.filter((t) => !t.done).length;
    this.footer.textContent = this.tasks.length === 0
      ? 'Задач пока нет — добавьте первую 🐾'
      : `Осталось: ${left} из ${this.tasks.length}`;
  }

  getState() {
    return { ...super.getState(), tasks: this.tasks };
  }
}
