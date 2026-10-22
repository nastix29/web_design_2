import { UIComponent } from '../UIComponent.js';

const DEFAULT_GOAL = 15000;
const MAX_AMOUNT = 1000000;
const QUICK_AMOUNTS = [100, 500, 1000];
const HISTORY_SIZE = 5;

const money = (n) => `${n.toLocaleString('ru-RU')} ₽`;

/** «Сбор на корм»: цель, собранная сумма, прогресс и последние пожертвования. */
export class FundraiserWidget extends UIComponent {
  constructor(options) {
    super(options);
    this.goal = FundraiserWidget.cleanNumber(options.goal, DEFAULT_GOAL) || DEFAULT_GOAL;
    this.raised = FundraiserWidget.cleanNumber(options.raised, 0);
    this.history = Array.isArray(options.history)
      ? options.history
          .filter((d) => d && Number.isFinite(d.amount) && d.amount > 0 && typeof d.time === 'string')
          .slice(0, HISTORY_SIZE)
      : [];
  }

  static cleanNumber(value, fallback) {
    const n = Math.round(Number(value));
    return Number.isFinite(n) && n >= 0 && n <= MAX_AMOUNT * 100 ? n : fallback;
  }

  renderBody(body) {
    // Сумма и прогресс
    this.summary = document.createElement('p');
    this.summary.className = 'fund__summary';

    const bar = document.createElement('div');
    bar.className = 'fund__bar';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', 'Прогресс сбора');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    this.bar = bar;
    this.barFill = document.createElement('div');
    this.barFill.className = 'fund__fill';
    bar.append(this.barFill);

    this.status = document.createElement('p');
    this.status.className = 'fund__status';

    // Быстрые суммы
    const quick = document.createElement('div');
    quick.className = 'fund__quick';
    for (const amount of QUICK_AMOUNTS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--ghost';
      btn.dataset.amount = amount;
      btn.textContent = `+${money(amount)}`;
      quick.append(btn);
    }

    // Своя сумма
    const form = document.createElement('form');
    form.className = 'fund__form';
    form.noValidate = true;
    this.amountInput = this._numberInput('Своя сумма, ₽', 'Сумма пожертвования');
    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'btn';
    addBtn.textContent = 'Внести';
    form.append(this.amountInput, addBtn);

    this.hint = document.createElement('p');
    this.hint.className = 'todo__hint';
    this.hint.setAttribute('aria-live', 'polite');

    // История
    this.historyList = document.createElement('ul');
    this.historyList.className = 'fund__history';

    // Настройки цели (спрятаны в <details>)
    const settings = document.createElement('details');
    settings.className = 'fund__settings';
    const summaryEl = document.createElement('summary');
    summaryEl.textContent = 'Изменить цель или начать заново';
    const goalForm = document.createElement('form');
    goalForm.className = 'fund__form';
    goalForm.noValidate = true;
    this.goalInput = this._numberInput('Новая цель, ₽', 'Цель сбора');
    const goalBtn = document.createElement('button');
    goalBtn.type = 'submit';
    goalBtn.className = 'btn btn--ghost';
    goalBtn.textContent = 'Сохранить';
    goalForm.append(this.goalInput, goalBtn);
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'link-btn';
    resetBtn.textContent = 'Обнулить сбор';
    settings.append(summaryEl, goalForm, resetBtn);

    body.append(this.summary, bar, this.status, quick, form, this.hint, this.historyList, settings);

    this.listen(quick, 'click', (event) => {
      const btn = event.target.closest('[data-amount]');
      if (btn) this.donate(Number(btn.dataset.amount));
    });

    this.listen(form, 'submit', (event) => {
      event.preventDefault();
      const amount = this._readAmount(this.amountInput);
      if (amount !== null) {
        this.donate(amount);
        this.amountInput.value = '';
      }
    });

    this.listen(goalForm, 'submit', (event) => {
      event.preventDefault();
      const goal = this._readAmount(this.goalInput);
      if (goal !== null) {
        this.goal = goal;
        this.goalInput.value = '';
        settings.open = false;
        this._changed();
      }
    });

    this.listen(resetBtn, 'click', () => {
      if (!confirm('Обнулить собранную сумму и историю?')) return;
      this.raised = 0;
      this.history = [];
      settings.open = false;
      this._changed();
    });

    this.listen(this.amountInput, 'input', () => this._setHint(''));
    this.listen(this.goalInput, 'input', () => this._setHint(''));

    this.update();
  }

  _numberInput(placeholder, label) {
    const input = document.createElement('input');
    input.className = 'todo__input';
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '1';
    input.max = String(MAX_AMOUNT);
    input.step = '1';
    input.placeholder = placeholder;
    input.setAttribute('aria-label', label);
    return input;
  }

  /** Проверка введённой суммы: целое число от 1 до MAX_AMOUNT. */
  _readAmount(input) {
    const value = Number(input.value);
    if (!input.value.trim() || !Number.isInteger(value) || value < 1) {
      this._setHint('Введите целое число больше нуля');
      input.focus();
      return null;
    }
    if (value > MAX_AMOUNT) {
      this._setHint(`Не больше ${money(MAX_AMOUNT)} за раз`);
      input.focus();
      return null;
    }
    return value;
  }

  _setHint(text) {
    this.hint.textContent = text;
  }

  donate(amount) {
    this.raised += amount;
    this.history.unshift({ amount, time: new Date().toISOString() });
    this.history = this.history.slice(0, HISTORY_SIZE);
    this._setHint('');
    this._changed();
  }

  _changed() {
    this.update();
    this.onChange?.();
  }

  update() {
    const percent = this.goal > 0 ? Math.min(100, Math.round((this.raised / this.goal) * 100)) : 100;

    this.summary.textContent = '';
    const raised = document.createElement('strong');
    raised.textContent = money(this.raised);
    this.summary.append(raised, ` из ${money(this.goal)}`);

    this.barFill.style.width = `${percent}%`;
    this.bar.setAttribute('aria-valuenow', String(percent));
    this.bar.classList.toggle('is-complete', percent >= 100);

    const left = this.goal - this.raised;
    this.status.textContent = left > 0
      ? `${percent}% · осталось ${money(left)}`
      : '🎉 Цель достигнута! Спасибо всем, кто помог';

    this.historyList.replaceChildren();
    for (const d of this.history) {
      const li = document.createElement('li');
      const sum = document.createElement('span');
      sum.className = 'fund__amount';
      sum.textContent = `+${money(d.amount)}`;
      const time = document.createElement('span');
      time.className = 'fund__time';
      time.textContent = new Date(d.time).toLocaleString('ru-RU', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      li.append(sum, time);
      this.historyList.append(li);
    }
  }

  getState() {
    return { ...super.getState(), goal: this.goal, raised: this.raised, history: this.history };
  }
}
