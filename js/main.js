import { Dashboard } from './Dashboard.js';

// ===== Всплывающая подсказка =====
const toast = document.querySelector('#toast');
let toastTimer = null;

function notify(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

// ===== Панель =====
const toolbarButtons = document.querySelectorAll('[data-add]');

const dashboard = new Dashboard({
  container: document.querySelector('#grid'),
  emptyState: document.querySelector('#empty'),
  toolbarButtons,
  notify,
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
