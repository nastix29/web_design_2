import { ApiWidget } from './ApiWidget.js';
import { CITY } from '../config.js';

// Коды погоды WMO → описание и эмодзи (из документации Open-Meteo)
const WEATHER_CODES = {
  0: ['Ясно', '☀️'],
  1: ['Преимущественно ясно', '🌤️'],
  2: ['Переменная облачность', '⛅'],
  3: ['Пасмурно', '☁️'],
  45: ['Туман', '🌫️'],
  48: ['Изморозь, туман', '🌫️'],
  51: ['Слабая морось', '🌦️'],
  53: ['Морось', '🌦️'],
  55: ['Сильная морось', '🌧️'],
  56: ['Ледяная морось', '🌧️'],
  57: ['Сильная ледяная морось', '🌧️'],
  61: ['Небольшой дождь', '🌦️'],
  63: ['Дождь', '🌧️'],
  65: ['Сильный дождь', '🌧️'],
  66: ['Ледяной дождь', '🌧️'],
  67: ['Сильный ледяной дождь', '🌧️'],
  71: ['Небольшой снег', '🌨️'],
  73: ['Снег', '🌨️'],
  75: ['Сильный снег', '❄️'],
  77: ['Снежная крупа', '🌨️'],
  80: ['Ливень', '🌦️'],
  81: ['Сильный ливень', '🌧️'],
  82: ['Очень сильный ливень', '⛈️'],
  85: ['Снегопад', '🌨️'],
  86: ['Сильный снегопад', '❄️'],
  95: ['Гроза', '⛈️'],
  96: ['Гроза с градом', '⛈️'],
  99: ['Сильная гроза с градом', '⛈️'],
};

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

/** Текущая погода через Open-Meteo + совет для выгула собак + выбор города. */
export class WeatherWidget extends ApiWidget {
  constructor(options) {
    super(options);
    this.city = WeatherWidget.cleanCity(options.city) ?? { ...CITY };
    this.searchController = null;
  }

  /** Проверяем город из сохранения: имя и корректные координаты. */
  static cleanCity(city) {
    if (!city || typeof city.name !== 'string' || !city.name.trim()) return null;
    const lat = Number(city.latitude);
    const lon = Number(city.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { name: city.name.trim().slice(0, 60), latitude: lat, longitude: lon };
  }

  // ===== Выбор города =====

  renderBody(body) {
    super.renderBody(body); // создаёт this.content и запускает загрузку погоды

    this.cityBar = document.createElement('div');
    this.cityBar.className = 'city';

    // Кнопка с текущим городом
    this.cityButton = document.createElement('button');
    this.cityButton.type = 'button';
    this.cityButton.className = 'city__current';
    this.cityButton.dataset.cityAction = 'open';

    // Форма поиска (скрыта, пока не нажали на город)
    this.cityForm = document.createElement('form');
    this.cityForm.className = 'city__form';
    this.cityForm.noValidate = true;
    this.cityForm.hidden = true;

    const row = document.createElement('div');
    row.className = 'todo__form';
    this.cityInput = document.createElement('input');
    this.cityInput.className = 'todo__input';
    this.cityInput.type = 'text';
    this.cityInput.maxLength = 60;
    this.cityInput.placeholder = 'Например: Казань';
    this.cityInput.setAttribute('aria-label', 'Название города');
    const findBtn = document.createElement('button');
    findBtn.type = 'submit';
    findBtn.className = 'btn';
    findBtn.textContent = 'Найти';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'icon-btn';
    cancelBtn.dataset.cityAction = 'close';
    cancelBtn.textContent = '✕';
    cancelBtn.setAttribute('aria-label', 'Отменить выбор города');
    row.append(this.cityInput, findBtn, cancelBtn);

    this.cityMessage = document.createElement('p');
    this.cityMessage.className = 'city__message';
    this.cityMessage.setAttribute('aria-live', 'polite');

    this.cityResults = document.createElement('ul');
    this.cityResults.className = 'city__results';

    this.cityForm.append(row, this.cityMessage, this.cityResults);
    this.cityBar.append(this.cityButton, this.cityForm);
    body.prepend(this.cityBar);

    this._updateCityButton();

    this.listen(this.cityForm, 'submit', (event) => {
      event.preventDefault();
      this.searchCity(this.cityInput.value);
    });

    // Один обработчик на все кнопки блока (делегирование)
    this.listen(this.cityBar, 'click', (event) => {
      const btn = event.target.closest('[data-city-action]');
      if (!btn) return;
      const action = btn.dataset.cityAction;
      if (action === 'open') this.openCityForm();
      if (action === 'close') this.closeCityForm();
      if (action === 'pick') this.pickCity(Number(btn.dataset.index));
    });

    this.listen(this.cityBar, 'keydown', (event) => {
      if (event.key === 'Escape') this.closeCityForm();
    });
  }

  _updateCityButton() {
    this.cityButton.textContent = '';
    const pin = document.createElement('span');
    pin.setAttribute('aria-hidden', 'true');
    pin.textContent = '📍';
    const name = document.createElement('strong');
    name.textContent = this.city.name;
    const change = document.createElement('span');
    change.className = 'city__change';
    change.textContent = 'сменить';
    this.cityButton.append(pin, name, change);
    this.cityButton.setAttribute('aria-label', `Город: ${this.city.name}. Сменить город`);
  }

  openCityForm() {
    this.cityButton.hidden = true;
    this.cityForm.hidden = false;
    this.cityInput.value = '';
    this.cityMessage.textContent = '';
    this.cityResults.replaceChildren();
    this.cityInput.focus();
  }

  closeCityForm() {
    this.searchController?.abort();
    this.searchController = null;
    this.cityForm.hidden = true;
    this.cityButton.hidden = false;
    this.cityButton.focus();
  }

  /** Поиск города через Open-Meteo Geocoding API. */
  async searchCity(rawName) {
    const name = rawName.trim();
    if (name.length < 2) {
      this._cityMessage('Введите хотя бы 2 буквы', true);
      this.cityInput.focus();
      return;
    }

    this.searchController?.abort();
    const controller = new AbortController();
    this.searchController = controller;

    this.cityResults.replaceChildren();
    this._cityMessage('Ищем…');

    try {
      const params = new URLSearchParams({ name, count: '5', language: 'ru', format: 'json' });
      const data = await this.fetchJSON(`${GEOCODING_URL}?${params}`, controller.signal);
      if (this.destroyed || this.searchController !== controller) return;

      // Ответ: { results: [{ name, latitude, longitude, country, admin1 }] }
      // Если ничего не найдено, поля results нет.
      const found = (Array.isArray(data?.results) ? data.results : [])
        .map((r) => ({ city: WeatherWidget.cleanCity(r), details: [r.admin1, r.country].filter(Boolean).join(', ') }))
        .filter((r) => r.city);

      if (found.length === 0) {
        this._cityMessage('Город не найден. Проверьте название.', true);
        return;
      }

      this.foundCities = found.map((r) => r.city);
      this._cityMessage('Выберите город:');
      this.cityResults.replaceChildren(...found.map((r, index) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'city__option';
        btn.dataset.cityAction = 'pick';
        btn.dataset.index = String(index);
        const title = document.createElement('strong');
        title.textContent = r.city.name;
        const sub = document.createElement('span');
        sub.textContent = r.details;
        btn.append(title, sub);
        li.append(btn);
        return li;
      }));
    } catch (error) {
      if (this.destroyed || this.searchController !== controller) return;
      console.error('[Поиск города]', error);
      this._cityMessage(navigator.onLine ? 'Не удалось найти город. Попробуйте ещё раз.' : 'Нет подключения к интернету.', true);
    }
  }

  pickCity(index) {
    const city = this.foundCities?.[index];
    if (!city) return;
    this.city = city;
    this._updateCityButton();
    this.closeCityForm();
    this.onChange?.(); // сохранить выбор
    this.load();       // погода для нового города
  }

  _cityMessage(text, isError = false) {
    this.cityMessage.textContent = text;
    this.cityMessage.classList.toggle('is-error', isError);
  }

  getState() {
    return { ...super.getState(), city: this.city };
  }

  destroy() {
    this.searchController?.abort();
    this.searchController = null;
    super.destroy();
  }

  // ===== Погода =====

  get url() {
    const params = new URLSearchParams({
      latitude: this.city.latitude,
      longitude: this.city.longitude,
      current: 'temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code',
      wind_speed_unit: 'ms',
      timezone: 'auto',
    });
    return `https://api.open-meteo.com/v1/forecast?${params}`;
  }

  async fetchData(signal) {
    const data = await this.fetchJSON(this.url, signal);
    const current = data?.current;
    if (!current || typeof current.temperature_2m !== 'number') {
      throw new Error('Сервис погоды вернул неожиданные данные.');
    }
    return { current, units: data.current_units ?? {} };
  }

  showResult({ current, units }) {
    const [description, emoji] = WEATHER_CODES[current.weather_code] ?? ['Погода', '🌡️'];
    const tempUnit = units.temperature_2m ?? '°C';

    const wrap = document.createElement('div');
    wrap.className = 'api__result';

    const advice = WeatherWidget.walkAdvice(current);

    // Короткая сводка для маскота в шапке
    this.summary = { emoji, temp: `${Math.round(current.temperature_2m)}${tempUnit}`, advice };
    this.onData?.();

    // Главная строка: эмодзи, температура, описание
    const top = document.createElement('div');
    top.className = 'weather__top';

    const icon = document.createElement('span');
    icon.className = 'weather__emoji';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = emoji;

    const info = document.createElement('div');
    const temp = document.createElement('p');
    temp.className = 'weather__temp';
    temp.textContent = `${Math.round(current.temperature_2m)}${tempUnit}`;
    const desc = document.createElement('p');
    desc.className = 'weather__desc';
    desc.textContent = description;
    info.append(temp, desc);
    top.append(icon, info);

    // Детали
    const stats = document.createElement('div');
    stats.className = 'weather__stats';
    stats.append(
      this._stat('Ощущается', `${Math.round(current.apparent_temperature)}${tempUnit}`),
      this._stat('Ветер', `${current.wind_speed_10m} ${units.wind_speed_10m ?? 'м/с'}`.replace('m/s', 'м/с')),
      this._stat('Осадки', `${current.precipitation} ${units.precipitation ?? 'мм'}`.replace('mm', 'мм')),
    );

    // Совет волонтёру
    const adviceEl = document.createElement('p');
    adviceEl.className = 'advice';
    adviceEl.textContent = advice;

    // Время обновления и кнопка
    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('span');
    time.textContent = `Обновлено: ${new Date(current.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} (время города)`;
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'btn btn--ghost';
    reload.dataset.action = 'reload';
    reload.textContent = '↻ Обновить';
    meta.append(time, reload);

    wrap.append(top, stats, adviceEl, meta);
    this.content.replaceChildren(wrap);
  }

  showError(message) {
    this.summary = null; // старую погоду в сводке не показываем
    this.onData?.();
    super.showError(message);
  }

  _stat(label, value) {
    const box = document.createElement('div');
    box.className = 'stat';
    const l = document.createElement('span');
    l.className = 'stat__label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'stat__value';
    v.textContent = value;
    box.append(l, v);
    return box;
  }

  /** Подсказка для выгула по температуре, осадкам и ветру. */
  static walkAdvice({ apparent_temperature: feels, precipitation, wind_speed_10m: wind, weather_code: code }) {
    if (code >= 95) return '⚡ Гроза — выгул лучше отложить.';
    if (feels <= -15) return '🥶 Мороз! Короткий выгул, попоны и защита для лап.';
    if (feels <= 0) return '🧣 Холодно: наденьте попоны короткошёрстным собакам.';
    if (precipitation > 0 || (code >= 51 && code <= 82)) return '☔ Осадки — возьмите полотенца для лап.';
    if (feels >= 27) return '🥵 Жарко: гуляйте в тени и возьмите воду.';
    if (wind >= 10) return '💨 Сильный ветер — держите поводки крепче.';
    return '🐕 Отличная погода для долгой прогулки!';
  }
}
