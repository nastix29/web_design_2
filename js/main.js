import { Dashboard } from './Dashboard.js';
import { Mascot } from './Mascot.js';

// ===== Всплывающая подсказка =====
const toast = document.querySelector('#toast');
let toastTimer = null;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

// ===== Дата в шапке =====
const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
document.querySelector('#today').textContent = today[0].toUpperCase() + today.slice(1);

// ===== Маскот и сводка =====
const mascot = new Mascot({
  button: document.querySelector('#mascot'),
  bubbleText: document.querySelector('#bubble-text'),
});
const bubbleTitle = document.querySelector('#bubble-title');
const tilesBox = document.querySelector('#tiles');

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/**
 * «сухой корм для собак, одноразовые пелёнки и ещё 2»
 * Показываем до двух названий, длинные обрезаем, остальное — числом.
 */
function urgentList(names, shown = 2, maxLength = 30) {
  const short = names.slice(0, shown).map((name) => {
    const lower = name.charAt(0).toLowerCase() + name.slice(1);
    return lower.length > maxLength ? `${lower.slice(0, maxLength - 1).trimEnd()}…` : lower;
  });
  const rest = names.length - short.length;
  return rest > 0 ? `${short.join(', ')} и ещё ${rest}` : short.join(', ');
}

/**
 * Облачко Пушка: в заголовке — самое важное сейчас,
 * в тексте — остальное (без повторов заголовка) и совет по погоде.
 */
function bubbleContent({ tasks, needs, weather }) {
  const left = tasks ? tasks.total - tasks.done : 0;
  const urgent = needs?.urgent ?? 0;

  let title;
  const parts = [];

  if (urgent > 0) {
    title = `Срочно нужно: ${urgentList(needs.urgentNames)}`;
    if (left > 0) parts.push(`Ещё ${left} ${plural(left, 'задача', 'задачи', 'задач')} на смене.`);
  } else if (left > 0) {
    title = `Осталось ${left} ${plural(left, 'задача', 'задачи', 'задач')}`;
  } else if (tasks || needs || weather) {
    title = 'Всё под контролем 🐾';
  } else {
    title = 'Сводка смены';
  }

  if (tasks && tasks.total === 0) parts.push('Добавьте задачи на смену.');
  else if (tasks && left === 0) parts.push('Все задачи выполнены — отличная работа!');
  if (weather?.advice) parts.push(weather.advice);

  const text = parts.join(' ') || 'Добавьте виджеты — здесь появится главное по смене.';
  return { title, text };
}

function tile(label, value, percent = null) {
  const box = document.createElement('div');
  box.className = 'tile';
  const l = document.createElement('span');
  l.className = 'tile__label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'tile__value';
  v.textContent = value;
  box.append(l, v);
  if (percent !== null) {
    const bar = document.createElement('span');
    bar.className = 'tile__bar';
    const fill = document.createElement('i');
    fill.style.width = `${percent}%`;
    bar.append(fill);
    box.append(bar);
  }
  return box;
}

function renderSummary(summary) {
  const { title, text } = bubbleContent(summary);
  bubbleTitle.textContent = title;
  mascot.setStatus(text);

  const tiles = [];
  if (summary.weather) tiles.push(tile(`${summary.weather.emoji} Погода`, summary.weather.temp));
  if (summary.tasks) {
    const { done, total } = summary.tasks;
    tiles.push(tile('📋 Задачи', `${done} / ${total}`, total ? Math.round((done / total) * 100) : 0));
  }
  if (summary.fund) tiles.push(tile('🥫 Сбор', `${summary.fund.percent}%`, summary.fund.percent));
  if (summary.needs) tiles.push(tile('📦 Срочно', String(summary.needs.urgent)));
  tilesBox.replaceChildren(...tiles);
}

// ===== Панель =====
const toolbarButtons = document.querySelectorAll('[data-add]');

const dashboard = new Dashboard({
  container: document.querySelector('#grid'),
  emptyState: document.querySelector('#empty'),
  toolbarButtons,
  notify,
  onSummary: renderSummary,
});

// Обработчики кнопок вешаем один раз при запуске —
// поэтому повторные добавления/удаления не дублируют действия.
for (const button of toolbarButtons) {
  button.addEventListener('click', () => dashboard.addWidget(button.dataset.add));
}

dashboard.restore();
window.lapaStarted = true; // для подсказки в index.html

// ===== Сеть =====
window.addEventListener('offline', () => notify('Интернет пропал 📡'));
window.addEventListener('online', () => notify('Интернет вернулся — нажмите «Повторить» в карточке'));
