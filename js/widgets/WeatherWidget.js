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

/** Текущая погода через Open-Meteo + совет для выгула собак. */
export class WeatherWidget extends ApiWidget {
  get url() {
    const params = new URLSearchParams({
      latitude: CITY.latitude,
      longitude: CITY.longitude,
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
    desc.textContent = `${description} · ${CITY.name}`;
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
    const advice = document.createElement('p');
    advice.className = 'advice';
    advice.textContent = WeatherWidget.walkAdvice(current);

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

    wrap.append(top, stats, advice, meta);
    this.content.replaceChildren(wrap);
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
