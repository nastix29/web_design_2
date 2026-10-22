import { ApiWidget } from './ApiWidget.js';

const API_URL = 'https://dog.ceo/api/breeds/image/random';

// Клички для карточки — просто для настроения, не реальные питомцы
const NAMES = ['Бублик', 'Рекс', 'Ласка', 'Пряник', 'Тучка', 'Джек', 'Лапка', 'Шарик', 'Булка', 'Граф', 'Соня', 'Кекс'];

/** «Ищет дом»: случайное фото собаки через Dog CEO API. */
export class DogWidget extends ApiWidget {
  async fetchData(signal) {
    const data = await this.fetchJSON(API_URL, signal);
    // Формат ответа: { "message": "<ссылка на фото>", "status": "success" }
    if (data?.status !== 'success' || typeof data.message !== 'string') {
      throw new Error('Сервис фото вернул неожиданные данные.');
    }
    return { imageUrl: data.message };
  }

  showResult({ imageUrl }) {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const breed = DogWidget.breedFromUrl(imageUrl);

    const wrap = document.createElement('div');
    wrap.className = 'api__result';

    const img = document.createElement('img');
    img.className = 'dog__photo';
    img.alt = breed ? `Собака породы ${breed}` : 'Фото собаки';
    img.loading = 'lazy';
    // Если сама картинка не загрузилась — показываем ошибку с повтором
    img.onerror = () => {
      if (!this.destroyed) this.showError('Не удалось загрузить фото.');
    };
    img.src = imageUrl;

    const title = document.createElement('p');
    title.className = 'dog__name';
    title.textContent = `${name} ищет дом 🏡`;

    const subtitle = document.createElement('p');
    subtitle.className = 'dog__breed';
    subtitle.textContent = breed ? `Порода: ${breed}` : 'Порода неизвестна';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const source = document.createElement('span');
    source.textContent = 'Фото: Dog CEO API';
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn';
    next.dataset.action = 'reload';
    next.textContent = 'Следующий питомец →';
    meta.append(source, next);

    wrap.append(img, title, subtitle, meta);
    this.content.replaceChildren(wrap);
  }

  /** https://images.dog.ceo/breeds/hound-afghan/n0208.jpg → "afghan hound" */
  static breedFromUrl(url) {
    const match = url.match(/\/breeds\/([^/]+)\//);
    if (!match) return '';
    return match[1].split('-').reverse().join(' ');
  }
}
