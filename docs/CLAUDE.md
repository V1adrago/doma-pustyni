# Дома Пустыни — главная инструкция для разработки

## О проекте

**Дома Пустыни** — мобильная PvP-игра в формате быстрых боёв (3 минуты).  
Жанр: Clash Royale-подобная карточная стратегия в реальном времени.  
Стек: **JavaScript + Three.js + Vite**, запуск через `npm run dev`.

**Папки:**
- Код проекта: `C:\Users\vvb\Desktop\doma-pustyni\`
- Документы: `C:\Users\vvb\Desktop\doma-pustyni\docs\`
- Дизайн-документы: `docs\Дюна кард\` (главный: `doma_pustyni_full_project_description_v0_8.md`)

---

## Структура проекта

```
doma-pustyni/
├── docs/
│   ├── Дюна кард/        ← все дизайн-документы (.md)
│   ├── дизайн/           ← TZ и SVG-кит главного меню
│   ├── CLAUDE.md         ← этот файл
│   └── STATUS.md         ← список реализовано / не реализовано
├── src/
│   ├── config.js         ← все игровые константы
│   ├── scene.js          ← Three.js: рендерер, камера, свет, OrbitControls
│   ├── map.js            ← земля, 3 линии, стены, ресурсный узел
│   ├── towers.js         ← TowerManager: 6 башен, HP, стрельба, HP бары
│   ├── economy.js        ← SpiceEconomy: доход, банк, инженерные стадии
│   ├── ui.js             ← UI: обновляет HTML-оверлей каждый кадр
│   ├── menu.js           ← GameMenu: старое меню (не показывается при старте)
│   ├── units.js          ← Unit класс, buildMesh, makeHpSprite, drawHpBar
│   ├── unit-manager.js   ← UnitManager: спавн, ИИ-движение, бой, башни стреляют
│   ├── cards.js          ← CARD_DEFS (9 юнитов), AI_DECK, CARD_ICONS/COLORS
│   ├── hand.js           ← Hand класс (цикличная колода)
│   ├── deck-builder.js   ← UI сборки колоды
│   ├── factions.js       ← FactionManager (Дом Чести: Боевой порядок, Щит гарнизона)
│   ├── room-screen.js    ← RoomScreen: экран онлайн-комнаты
│   ├── main.js           ← Оркестратор: игровой цикл, матч, AI, роутинг, пауза
│   ├── config/
│   │   └── progression.js ← PROGRESSION (5 уровней) + HOUSES (5 домов)
│   ├── services/
│   │   ├── profile-service.js ← localStorage: рейтинг, уровень, прогресс
│   │   ├── auth-service.js    ← ЗАГЛУШКА авторизации
│   │   └── room-service.js    ← Управление комнатами
│   └── ui/               ← UI-слой (меню, HUD-компоненты)
│       ├── mainMenu.js         ← MainMenu: мобильное главное меню (ТОЧКА ВХОДА)
│       ├── mainMenu.css        ← CSS главного меню
│       ├── menuState.js        ← Данные главного меню
│       ├── battleMenu.js       ← BattleMenu: внутриигровое меню паузы
│       ├── battleMenu.css      ← CSS боевого меню
│       └── battleMenuState.js  ← Настройки боя (localStorage)
├── sim.mjs               ← Node.js симулятор баланса (node sim.mjs)
├── index.html
├── style.css
├── package.json
└── vite.config.js
```

---

## Главная формула игры

```
Башни дают стабильный доход специй.
Инженеры дают рискованный экономический разгон.
Юниты давят линии и башни.
Цель боя — уничтожить центральную цитадель.
```

---

## Все 8 юнитов (v0.3, финальные параметры)

| ID | Имя | HP | Speed | AtkDmg | BldgDmg | Cooldown | Range | Cost | Тип |
|---|---|---|---|---|---|---|---|---|---|
| engineer | Инженер | 140 | 1.00 | 0 | 0 | — | 0 | 2/3/4 | ground |
| scout | Разведчик | 220 | 1.60 | 32 | 16 | 0.8 | 0.8 | 2 | ground |
| swordsman | Мечник | 430 | 0.95 | 45 | 32 | 1.0 | 0.9 | 2 | ground |
| assault | Штурмовик | 680 | 0.75 | 42 | 95 | 1.2 | 0.9 | 3 | ground |
| archer | Стрелок | 190 | 0.85 | 38 (air:50) | 18 | 1.0 | 4.5 | 3 | ground |
| spearman | Копейщик | 320 | 0.85 | 35 (65 vs heavy/assault) | 18 | 0.9 | 1.4 | 3 | ground |
| drone | Дрон | 280 | 1.10 | 32 | 30 | 1.0 | 2.8 | 4 | **air** |
| heavy | Бронир. воин | 900 | 0.50 | 60 | 45 | 1.5 | 0.9 | 5 | ground |

**Особые правила:**
- Дрон летит на y=2.8. Наземные юниты без 'air' в targetTypes не атакуют его.
- Стрелок (ranged) атакует `['ground', 'air', 'building']` — единственный контр-воздух среди юнитов.
- Инженер идёт напрямую к центральному узлу (0,0), игнорирует бой, исчезает при прибытии.

**AI_DECK:** `['scout','swordsman','swordsman','assault','assault','archer','spearman','drone','heavy','engineer']`

---

## Башни (v0.3)

| ID | Позиция | HP | Damage | Cooldown | Range | Side |
|---|---|---|---|---|---|---|
| player_left | (−6, z=11) | **1300** | 40 | 1.5 | 5.2 | player |
| player_citadel | (0, z=13) | **2200** | 55 | 1.4 | 6.2 | player |
| player_right | (6, z=11) | **1300** | 40 | 1.5 | 5.2 | player |
| enemy_left | (−6, z=−11) | **1300** | 40 | 1.5 | 5.2 | enemy |
| enemy_citadel | (0, z=−13) | **2200** | 55 | 1.4 | 6.2 | enemy |
| enemy_right | (6, z=−11) | **1300** | 40 | 1.5 | 5.2 | enemy |

HP снижены с 2000/3200 → **1300/2200** (патч v0.3, после тестирования симулятором).

**Порядок атаки юнитов (LANE_TOWER_CHAIN):**
- Левая/правая линия: сначала боковая башня → потом цитадель
- Центральная линия: сразу цитадель (уязвимость!)

---

## Режимы игры

| Режим | Что происходит |
|---|---|
| 1P | Игрок собирает колоду → матч против примитивного ИИ (6.5с интервал) |
| 2P | Оба игрока собирают колоды → матч с двумя руками на одном экране |
| **ИИ vs ИИ** | Сразу запускается матч, оба ИИ используют AI_DECK. Для тестирования баланса. |

**ИИ противника — примитивный и намеренно слабый.** Каждые 6.5с выбирает случайную доступную карту из руки, ставит на случайную линию. Модернизации не планируется — блок будет удалён, когда появится нетворкинг.

---

## HP бары (Three.js Sprite)

Реализованы в `units.js` и `towers.js`. Технически:
- `makeHpSprite(barWidth)` — создаёт 64×8px CanvasTexture, SpriteMaterial с `depthTest:false`, renderOrder 10
- `drawHpBar(canvas, texture, ratio)` — перерисовывает canvas; зелёный >50%, жёлтый >25%, красный ≤25%
- Спрайт добавляется как дочерний объект `mesh` юнита или `group` башни — следует за родителем автоматически
- `unit.refreshHp()` и `towerManager.refreshHpBar(id)` вызываются при каждом попадании

---

## Эффект выстрела башни

Реализован в `unit-manager.js`:
- `_createShotFlash(td, target)` — создаёт `THREE.Line` от кончика башни до цели
- Цвет `0xffdd44`, начальная opacity 0.9
- Живёт `FLASH_DURATION = 0.18с`, затем удаляется с dispose
- Отслеживается в `this._shotFlashes[]`, сбрасывается в `reset()`

---

## Симулятор баланса

**Файл:** `sim.mjs` в корне проекта.  
**Запуск:** `node sim.mjs`

Воспроизводит всю логику боя (без Three.js). Обновлять при изменении:
- `TOWER_DATA.maxHp` — при смене HP башен
- `CARD_DEFS` — при смене характеристик юнитов

Результаты 10 матчей при HP 1300/2200:  
Синий 1 победа | Красный 3 победы | 6 ничьих | среднее время 2.7 мин ✓

---

## Экономика специй

| Параметр | Значение |
|---|---:|
| Стартовые специи | 5 |
| Базовый банк | 10 |
| Доход цитадели | 12/мин |
| Доход боковой башни | 6/мин |
| Полный доход | 24/мин |

**Инженерные стадии:**

| Стадия | Доступность | Стоимость | +Доход | Банк |
|---|---:|---:|---:|---:|
| I | 0:00 | 2 | +10/мин | 12 |
| II | 1:00 | 3 | +12/мин | 14 |
| III | 2:00 | 4 | +15/мин | 16 |

---

## Карта боя

- Симметрична: игрок снизу (+Z), противник сверху (−Z)
- 3 линии: левая (x=−6), центр (x=0), правая (x=+6)
- Спавн: player z=14.5, enemy z=−14.5
- Центральный узел: (0, 0, 0) — для инженеров

---

## Архитектура точки входа (v0.4+)

**Порядок загрузки при старте:**
1. `index.html` → `src/main.js` (единственный скрипт-модуль)
2. `main.js` импортирует `MainMenu` из `src/ui/mainMenu.js`
3. `MainMenu` показывается поверх Three.js сцены (которая уже рендерится)
4. `#ui-overlay` в HTML имеет класс `ui-hidden` → `display: none !important` → HUD скрыт
5. При нажатии "В бой" → `beginMatch()` убирает `ui-hidden` → HUD виден

**Управление `#ui-overlay`:**
- `beginMatch()` → `#ui-overlay.classList.remove('ui-hidden')` — показать HUD
- `onGoToMenu()` → `#ui-overlay.classList.add('ui-hidden')` — скрыть HUD
- Старый `GameMenu.hide()/show()` тоже управлял оверлеем, но `MainMenu.hide()` — нет
- Всегда управлять через `beginMatch()`/`onGoToMenu()`, не через меню-классы

---

## Система паузы боя (v0.5)

**Переменные в `src/main.js`:**
```js
let matchRunning = false;  // матч идёт
let isPaused     = false;  // пауза (только в bot-режиме)
```

**Цикл анимации:**
```js
function animate(ts) {
  requestAnimationFrame(animate);
  // ...Three.js рендер всегда работает...
  if (matchRunning && !isPaused) {
    // тик игровой логики (юниты, башни, таймер, ИИ, экономика)
  }
}
```

**Функции паузы:**
```js
function pauseBattle()  { isPaused = true;  }
function resumeBattle() { isPaused = false; }
```

**BattleMenu — `src/ui/battleMenu.js`:**
```js
const battleMenu = new BattleMenu({
  pauseGame:      pauseBattle,
  resumeGame:     resumeBattle,
  onSurrender:    () => showWinScreen(false),
  onExitToMenu:   onGoToMenu,
  getMode:        () => gameConfig.mode === '2p' ? 'pvp' : 'bot',
  isMatchRunning: () => matchRunning,
});
```

**Ключевые методы BattleMenu:**
| Метод | Описание |
|---|---|
| `open()` | Вызывает `pauseGame()` (bot), показывает оверлей с анимацией |
| `close()` | Вызывает `resumeGame()` (bot), скрывает оверлей через transitionend |
| `toggle()` | `open()` или `close()` |
| `forceClose()` | Закрыть без `resumeGame()` — при сдаче/выходе |
| `handleEscape()` | Escape: confirm→main, settings→main, open→close, closed→open |
| `isOpen` (getter) | Текущее состояние |

**Клавиатура:**
- `Escape` — открыть/закрыть меню (контекстно)
- `P` — быстрый toggle паузы в bot-режиме (без открытия меню)

**Настройки боя (`src/ui/battleMenuState.js`):**
- localStorage ключ: `dp-battle-settings-v1`
- Поля: `{ sound, music, vibration, graphicsQuality }`
- Функции: `loadBattleSettings()`, `saveBattleSettings(settings)`
- Примечание: реальная логика звука/вибрации/графики — заглушки

---

## Все 8 юнитов (v0.3, финальные параметры)
