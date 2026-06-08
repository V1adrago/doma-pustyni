# ДОМА ПУСТЫНИ — Справочник кода

> Карточная PvP стратегия (Three.js + Vite). Быстрый навигатор по файлам.
> Версия: v1.9 — Фикс приоритета инженера

---

## Правило для Claude: фиксируй сразу после каждой задачи

После выполнения каждого пункта задания — сразу обновляй этот README и memory-файл проекта.
Не жди окончания всего списка. Если что-то пошло не так или контекст сбросится — уже сделанное останется задокументированным.

Порядок при каждом изменении:
1. Реализуй задачу
2. Запусти `npm run build` — убедись что сборка чистая
3. Обнови раздел «История версий» в этом README (добавь пункт)
4. Обнови `memory/project_doma_pustyni.md` — что изменилось в архитектуре

---

## Структура файлов

```
doma-pustyni/
├── index.html              ← Весь HTML (канвас, HUD, экран комнаты, #main-menu, SVG UI-kit)
├── style.css               ← CSS игрового UI (тема, карты, онлайн-секция, комната)
├── vite.config.js          ← base: '/' (абсолютные пути для SPA-роутинга)
├── firebase.json           ← SPA rewrites: все маршруты → index.html (для /room/:id)
├── DEPLOY.md               ← Инструкция по деплою на Firebase Hosting
├── dev-balance.html        ← Balance Editor (DEV) — редактор параметров юнитов, экспорт/импорт Excel
├── sim.mjs                 ← Headless симулятор AI vs AI (node sim.mjs)
├── docs/
│   ├── CLAUDE.md           ← Инструкция для разработки (стек, юниты, башни, механики)
│   ├── STATUS.md           ← Реализовано / не реализовано
│   └── дизайн/             ← Дизайн-кит главного меню
│       ├── TZ_peschany_avanpost_menu.md        ← ТЗ на главное меню
│       ├── peschany_avanpost_ui_components.html ← HTML-референс UI-блоков
│       ├── peschany_avanpost_ui_vectors.svg     ← SVG UI-kit (щит, кнопки, карточки)
│       └── peschany_avanpost_menu_TZ_bundle.zip ← Архив всего выше
└── src/
    ├── main.js             ← ОРКЕСТРАТОР — игровой цикл, матч, AI, роутинг по URL
    ├── room-screen.js      ← RoomScreen — экран онлайн-комнаты (UI-заготовка)
    ├── menu.js             ← GameMenu — старое меню (1P/2P/AI режимы, профиль)
    ├── cards.js            ← Определения карт, стоимости, CARD_DEFS
    ├── config.js           ← Базовые константы баланса (CONFIG)
    ├── economy.js          ← Класс SpiceEconomy — ресурсы игрока/врага
    ├── factions.js         ← FactionManager — фракция Дом Чести, баффы
    ├── hand.js             ← Класс Hand — ротация колоды (10 карт, 4 в руке)
    ├── map.js              ← Terrain + пропсы + центральный узел
    ├── scene.js            ← createScene() — Three.js сцена, камера, свет
    ├── towers.js           ← TowerManager — 6 башен, HP, щит, цвета
    ├── ui.js               ← UI класс — HUD (таймер, экономика, башни)
    ├── unit-manager.js     ← UnitManager — AI юнитов, стрельба, бой
    ├── units.js            ← Unit класс — 3D меши юнитов, HP бар
    ├── deck-builder.js     ← DeckBuilder — UI выбора колоды (фракции)
    ├── dev-console.js      ← DevConsole — консоль разработчика (клавиша `, кнопка 🛠 DEV)
    ├── config/
    │   └── progression.js  ← PROGRESSION (5 уровней) + HOUSES (5 домов)
    ├── services/
    │   ├── profile-service.js  ← localStorage: рейтинг, уровень, прогресс
    │   ├── auth-service.js     ← ЗАГЛУШКА авторизации (isOnlineAuthEnabled → false)
    │   └── room-service.js     ← Управление комнатами (localStorage + точки WebSocket)
    └── ui/                 ← UI-слой (главное меню v0.4, боевое меню v0.5)
        ├── menuState.js        ← Данные меню (игрок, ресурсы, локация, фракции, рейтинг)
        ├── mainMenu.js         ← MainMenu класс — рендер, события, модал
        ├── mainMenu.css        ← Полный CSS мобильного меню (токены, анимации, адаптив)
        ├── battleMenu.js       ← BattleMenu — внутриигровое меню паузы/настроек
        ├── battleMenu.css      ← CSS боевого меню (бронза/золото, тёмный оверлей)
        └── battleMenuState.js  ← Настройки боя (localStorage: звук, музыка, графика)
```

---

## Файлы — что внутри

### `main.js` — Главный оркестратор
| Что | Где |
|-----|-----|
| Глобальное состояние матча | `elapsedSeconds`, `matchRunning`, `isPaused`, `gameConfig` |
| Старт матча | `beginMatch()` — сброс + `isPaused=false` + `#ui-overlay` видим |
| Пауза / снятие паузы | `pauseBattle()` / `resumeBattle()` — меняют флаг `isPaused` |
| Экран победы | `showWinScreen(bottomSideWon)` |
| Возврат в меню | `onGoToMenu()` — `matchRunning=false`, `isPaused=false`, форс-закрытие меню паузы |
| Отрисовка руки | `renderHandUI(prefix, hand)` |
| Клики по картам | `bindHandClicks(prefix)` |
| Главный цикл | `requestAnimationFrame` → только если `matchRunning && !isPaused` → тик логики |
| Режимы игры | `'1p'` (vs AI), `'2p'` (локально), `'ai'` (авто-тест) |
| Клавиатура | `Escape` → `battleMenu.handleEscape()`, `P` → toggle паузы без меню |

### `cards.js` (200 строк) — Карты и юниты
| Экспорт | Описание |
|---------|---------|
| `CARD_DEFS` | 9 типов юнитов (HP, скорость, урон, радиус, тип) |
| `getCardCost(cardId, engineerStage)` | Инженер: 2→4 за стадию |
| `canPlayCard(cardId, economy)` | Проверка: хватает ресурсов + инженер ≤3 стадий |
| `CARD_ICONS` | Эмодзи на картах |
| `CARD_COLORS` | HEX цвета заголовков карт |
| `MAX_COPIES_PER_CARD` | 3 |
| `DECK_SIZE` | 10 |
| `AI_DECK` | Состав колоды противника AI |

**Юниты (CARD_DEFS):**
| Карта | HP | Скор. | Урон | Урон по зд. | Цена | Тип |
|-------|-----|------|------|-------------|------|-----|
| scout | 220 | 1.60 | 32 | 16 | 2 | ground |
| swordsman | 430 | 0.95 | 45 | 32 | 2 | ground |
| assault | 680 | 0.75 | 42 | **95** | 3 | ground |
| archer | 190 | 0.85 | 38/50 air | 18 | 3 | ground |
| spearman | 320 | 0.85 | 35/65 vs тяж. | 18 | 3 | ground |
| drone | 280 | 1.10 | 32 | 30 | 4 | air |
| heavy | 900 | 0.50 | 60 | 45 | 5 | ground |
| guard | 680 | 0.60 | 40 | 18 | 4 | **только Дом Чести** |
| engineer | 140 | 1.00 | 0 | 0 | 2–4 | ground |

### `config.js` (14 строк) — Константы баланса
```js
CONFIG = {
  startingSpices: 5,           // стартовые ресурсы
  baseSpiceBank: 10,           // ёмкость хранилища
  matchDurationSeconds: 180,   // длина матча
  citadelIncomePerMinute: 12,  // доход цитадели
  sideTowerIncomePerMinute: 6, // доход боковой башни
  engineers: [...]             // 3 стадии: cost/income/bank
}
```

### `config/progression.js` — Уровни и дома
- `PROGRESSION` — 5 уровней (0 / 100 / 250 / 500 / 850 рейтинга)
- `HOUSES` — 5 домов, каждый с levelRequired

### `economy.js` — SpiceEconomy
| Метод | Действие |
|-------|---------|
| `tick(delta)` | Начисляет специи (за живые башни + инженера) |
| `canAfford(cost)` | Проверка баланса |
| `spend(amount)` | Списание ресурсов |
| `activateEngineerStage()` | +доход +ёмкость |
| `incomePerMinute` | Геттер — сумма башен + бонус инженера |
| `reset()` | Сброс для нового матча |

### `factions.js` — FactionManager (Дом Чести)
| Механика | Описание |
|----------|---------|
| **Боевой порядок** | Юнит в радиусе 7.0 от живой башни на своей половине: −8% урона входящего, ×0.95 кулдаун атаки |
| **Щит гарнизона** | Цитадель ≤60% HP → щит 6 сек, −35% урона. Срабатывает 1 раз |
| `setFaction(side, id)` | Установить фракцию |
| `update(delta)` | Таймер щита |
| `checkCitadelShield()` | Триггер щита |
| `applyShieldReduction()` | Редукция урона по башне |
| `isInBattleOrder()` | Проверка зоны баффа |

**Параметры фракции:** `HONOR_TOWER_COLORS` — золотые башни (0xd4960a тело, 0x8b5e00 шапка)

### `hand.js` — Hand (ротация колоды)
- 10-карточная очередь, 4 карты в руке + 1 preview
- `play(index)` → карта уходит в конец очереди

### `map.js` — Карта battlefield
- Ground: песчаная плита
- 3 полосы-лейна (x = -6, 0, 6)
- 13 камней-пропсов (псевдослучайно)
- Центральный узел: анимированный октаэдр (цель инженера, pos 0,0)
- Зоны: прозрачные плоскости (синяя — игрок, красная — враг)

### `scene.js` — Three.js сцена
```
Camera: (0, 30, 24) → вниз, FOV 50°, OrbitControls zoom 18-55
Fog: 45-80 units, цвет 0x3a2a1a (пустынный)
Свет: ambient warm + sun (тени) + fill light
```

### `towers.js` — TowerManager (6 башен)
| Позиции | |
|---------|--|
| Игрок (z>0) | left(-6,11), citadel(0,13), right(6,11) |
| Враг (z<0) | left(-6,-11), citadel(0,-13), right(6,-11) |

| HP | |
|----|--|
| Боковые | 1300 |
| Цитадель | 2200 |

| Метод | Что делает |
|-------|-----------|
| `damageTower(id, amount)` | Урон + обновить бар |
| `destroyTower(id)` | Серый + наклон + скрыть бар |
| `resetAll()` | Сброс матча |
| `applyFactionColors(side, id)` | Золото для Дома Чести |
| `activateShieldVisual(side)` | Золотая сфера щита |
| `updateShieldPulse(timestamp)` | Анимация щита |

### `unit-manager.js` — UnitManager (ИИ боя)
**Порядок update() за тик:**
1. Башни стреляют по ближайшему врагу в радиусе
2. Каждый юнит: если рядом враг → атака; иначе если рядом башня → бить башню; иначе → двигаться
3. Инженер идёт к центру → `onEngineerArrived(side)`
4. Чистка мёртвых юнитов

| Метод | Действие |
|-------|---------|
| `spawn(cardId, side, lane)` | Создать юнита |
| `update(delta, towerManager, onTowerDestroyed, onEngineerArrived)` | Главный тик |
| `calcUnitDamage(attacker, target)` | Урон с учётом типов (archer vs air, spearman vs heavy) |
| `reset()` | Очистить всех юнитов |

**Shot Flash:** Жёлтая линия башня→цель, гаснет за 0.18 сек

### `units.js` — Unit (3D меши)
| Геометрия | Тип |
|-----------|-----|
| Сфера | engineer |
| Box | assault, heavy |
| Capsule | archer (ranged), scout/swordsman (light), spearman (antiHeavy) |
| Octahedron | drone (air) |
| Composite (тело + щит) | guard |

HP бар: спрайт над юнитом (зелёный >50%, оранжевый >25%, красный <25%)

### `ui.js` — HUD
| Метод | Обновляет |
|-------|---------|
| `configure(config)` | Заголовки, бейджи фракций при старте матча |
| `update(elapsed, matchRunning, factionManager)` | Таймер + экономика + башни + бейдж щита |

**Фазы таймера:** БОЙ (0–60с) → СТАДИЯ 2 (60–120с) → ФИНАЛ (120–180с) → КОНЕЦ

### `ui/menuState.js` — Данные главного меню
```js
menuState = {
  player:   { name, house, level: 12, xp: 1250, xpMax: 2000 },
  resources:{ spices: 4250, crystals: 560 },
  location: { id: 'sand_outpost', name: 'Песчаный аванпост', level: 1 },
  rating:   { value: 1250, nextLevelNeed: 750 },
  selectedFaction: 'house_honor',
  factions: [ {id, name, nameShort, state: 'active'|'locked', unlockLevel} × 4 ]
}
```
При интеграции с бэкендом — заменить на данные из `profile-service.js`.

### `ui/mainMenu.js` — MainMenu класс
| Метод | Действие |
|-------|---------|
| `show()` / `hide()` | Показать/скрыть `#main-menu` |
| `_render()` | Заполнить DOM из `menuState` |
| `_renderFactions(factions)` | Сгенерировать 4 карточки (SVG-арт внутри) |
| `openModal(title, text)` | Bottom-sheet модал |
| `closeModal()` | Анимированное закрытие |
| `startBattle()` | Скрыть меню → `onStartBattle()` callback |
| `showLockedFactionModal(faction)` | Попап «Откроется на уровне N» |

**Callbacks:** `new MainMenu(onStartBattle)` — при нажатии «В бой» запускает 1P поток.

### `ui/mainMenu.css` — CSS мобильного меню
| Блок | Ключевые детали |
|------|----------------|
| **Фон** | 3-слойный тёплый градиент `#2C1B10 → #0F0A06` + радиальный солнечный блик |
| **Панели** | `linear-gradient(#17120D,#0E0B08)` + `2px gold border (70% opacity)` + inner glow |
| **Щит** | 74×90px, абсолютно позиционирован, выходит за верх панели, SVG-геральдика внутри |
| **Кнопка «В БОЙ»** | `clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)` через `::before/::after` |
| **SVG-декор кнопки** | Меч, внутренний контур ромба, декоративная линия (из дизайн-кита) |
| **Коллекция** | 76px высота, `border: 3px solid gold`, CSS иконка из двух карточек |
| **Карточка Дом Чести** | SVG-арт (силуэт воина, меч-герб, свечение) |
| **Карточки locked** | `::before/::after` X-линии + CSS ромб-замок + SVG «?» |
| **Рейтинг** | CSS 3-столбика бар-чарта |
| **Адаптив** | Landscape (≤500px), Tablet (≥768px portrait), Desktop (≥1024px) |
| **Анимации** | `mmBattlePulse` (glow кнопки), `mmFadeIn` (вход меню), `mmShake` (locked) |

### `ui/battleMenu.js` — BattleMenu (v0.5)
| Метод | Действие |
|-------|---------|
| `open()` | Паузит бот-матч, показывает оверлей с анимацией, фокус на «Продолжить» |
| `close()` | Снимает паузу, скрывает оверлей через transitionend |
| `toggle()` | Открыть или закрыть |
| `forceClose()` | Закрыть без resume (при сдаче/выходе) |
| `handleEscape()` | Контекстно: confirm→main, open→close, closed→open |
| `isOpen` | Геттер текущего состояния |

**Инициализация:**
```js
new BattleMenu({ pauseGame, resumeGame, onSurrender, onExitToMenu, getMode, isMatchRunning })
```

**Режимы:** `getMode()` возвращает `'bot'` или `'pvp'`. В `pvp`-режиме пауза не включается, показывается предупреждение «Онлайн-бой продолжается».

### `ui/battleMenuState.js` — Настройки боя
- localStorage ключ: `dp-battle-settings-v1`
- Поля: `{ sound: bool, music: bool, vibration: bool, graphicsQuality: 'low'|'medium'|'high' }`
- `loadBattleSettings()` / `saveBattleSettings(s)` — чтение/запись с дефолтами
- Реальная реализация звука/вибрации/графики — заглушки (интеграция в следующих версиях)

### `menu.js` — GameMenu (старое меню)
- Показ рейтинга, уровня, прогресс-бара
- Выбор режима (1p/2p/ai), стороны, локации, дома
- Сброс профиля с подтверждением
- **Не показывается при старте** — заменён `MainMenu` как точка входа

### `deck-builder.js` — DeckBuilder
- Сетка карт с +/− кнопками (макс. 3 копии, итого 10)
- Фракционные табы: 'none' / 'honor' (Guard появляется только при 'honor')
- Финиш: `onComplete(deck[], factionId)`

### `services/profile-service.js` — Прогресс
| Функция | Что делает |
|---------|-----------|
| `loadProfile()` | Из localStorage с дефолтами |
| `saveProfile(p)` | Сохранить |
| `addMatchResult({mode, winner})` | +35 рейтинга (победа), −15 (поражение), только режим 1p |
| `resetProfile()` | Сбросить всё |
| `getLevelByRating(r)` | 0→1, 100→2, 250→3, 500→4, 850→5 |
| `getUnlockedLocations(p)` | Фильтр PROGRESSION по уровню |

### `sim.mjs` — Headless симулятор
```
node sim.mjs  →  10 матчей AI vs AI, анализ баланса
```
Выводит: победителя, время, башни, HP%, рекомендации (90–165 сек — целевой диапазон)

---

## Поток данных

```
URL / → mainMenu.show()          URL /room/:id → roomScreen.show(id)
           │                                           │
    «В БОЙ» нажата                            (онлайн-комната)
           │
    DeckBuilder → 1P выбор колоды
           │
       beginMatch()
           │
  ┌────────┴──────────┐──────────────┐
Economy          Hand          UnitManager
tick()          play()          spawn()
                                update()
                                    │
                           FactionManager → баффы
                           TowerManager  → урон
           │
       UI.update() → HUD
           │
     showWinScreen() → addMatchResult()
           │
     «← Меню» → mainMenu.show()
```

**Точка входа — `main.js`:**
- Если URL = `/` → `mainMenu.show()` (мобильное меню v0.4)
- Если URL = `/room/:id` → `roomScreen.show(id)` (экран онлайн-комнаты)
- `RoomScreen` back-callback → `mainMenu.show()`
- Старое меню (`GameMenu`) инстанцировано, но не показывается автоматически

---

## Механики кратко

**Экономика:** Башни живы → доход/мин. Инженер → доп. доход + ёмкость. Тратишь специи на юнитов.

**Бой:** Юнит заспавнен на своей линии → идёт к башне врага **строго по своей линии** (X зафиксирован) → если враг в радиусе → бьёт врага → добивает башню → после уничтожения башни на своей линии **может двигаться к цитадели** (X разблокирован) → уничтожает цитадель = победа.

**Привязка к линии (lane lock):**
- Пока блокирующая башня врага на линии юнита жива: X = `LANE_X[lane]` (−6 / 0 / 6), движение только по Z
- Когда башня уничтожена: юнит свободно движется X+Z к цитадели
- Центральная линия (только цитадель в цепочке): блокировки нет, всегда свободное движение

**Цепочка башен по лейну:** боковая башня → цитадель

**Фракция Дома Чести:** Пассив (Боевой порядок) + разовый щит цитадели (Щит гарнизона) + gold башни + карта Guard.

**Победа:** Уничтожить цитадель врага | По времени → ничья.

---

## Быстрый поиск механики

| Задача | Файл | Что менять |
|--------|------|-----------|
| Изменить HP/урон/скорость юнита | `cards.js` | `CARD_DEFS[id]` |
| Изменить стоимость | `cards.js` | `getCardCost()` |
| Изменить длину матча / доход башен | `config.js` | `CONFIG` |
| Добавить новую фракцию | `factions.js` | `FACTION_DEFS`, `FactionManager` |
| Новый юнит 3D меш | `units.js` | Новая геометрия в конструкторе Unit |
| Логика стрельбы / движения | `unit-manager.js` | `update()`, `calcUnitDamage()` |
| Визуал башен | `towers.js` | `TowerManager` конструктор / методы |
| Экран победы / матч-флоу | `main.js` | `showWinScreen()`, `beginMatch()` |
| Уровни прогрессии | `config/progression.js` | `PROGRESSION` |
| Рейтинговая система | `services/profile-service.js` | `addMatchResult()` |
| Тест баланса | `sim.mjs` | `runMatch()`, константы |
| Онлайн-комната (UI) | `room-screen.js` | `RoomScreen`, `show()`, `_renderPlayers()` |
| Подключить WebSocket | `services/room-service.js` | Заменить localStorage-функции на socket-вызовы |
| Подключить авторизацию | `services/auth-service.js` | Заменить заглушки на SDK (Firebase/Supabase) |
| Задеплоить | `DEPLOY.md` | Инструкция по Firebase Hosting |
| **Данные главного меню** | `src/ui/menuState.js` | `menuState.player`, `.resources`, `.factions` |
| **Стиль главного меню** | `src/ui/mainMenu.css` | CSS-токены в `:root`, `--gold`, `--cta-1` и т.д. |
| **Логика главного меню** | `src/ui/mainMenu.js` | `_renderFactions()`, `_syncProfile()`, хендлеры кнопок |
| **Рейтинг (живой)** | `src/ui/mainMenu.js` → `_syncProfile()` | Загружает `loadProfile()` при каждом `show()` |
| **Сохранённая колода** | `src/deck-builder.js` | `_saveDeck()` / `_loadSavedDeck()` · ключ `dp-saved-deck-v1` |
| **Тайминги инженера** | `src/cards.js` | `ENGINEER_MIN_TIMES` · `canPlayCard(id, eco, elapsed)` |
| **SVG UI-арт** | `index.html` → `#mm-svg-kit` | Символы `#mm-shield-art`, `#mm-battle-deco`, `#mm-card-honor-art` |
| **Добавить фоновый арт** | `src/ui/mainMenu.css` | `--mm-bg-image: url('/assets/bg.jpg')` в `:root` → сразу заменит CSS-градиент |
| **Добавить арт карточки фракции** | `src/ui/mainMenu.js` → `_renderFactions()` | `background-image` на `.mm-faction-active` |
| **Боевое меню (пауза)** | `src/ui/battleMenu.js` | `BattleMenu.open/close/toggle/handleEscape` |
| **Стиль боевого меню** | `src/ui/battleMenu.css` | CSS-токены, `--bm-gold`, `.bm-panel`, `.bm-btn-*` |
| **Настройки в бою** | `src/ui/battleMenuState.js` | `loadBattleSettings()`, `dp-battle-settings-v1` |
| **Кнопка паузы (⏸) в HUD** | `index.html` → `#timer-bar` | `<button id="btn-battle-menu">` |
| **Управление HUD-видимостью** | `src/main.js` → `beginMatch()` / `onGoToMenu()` | `#ui-overlay.classList.remove/add('ui-hidden')` |

---

## Онлайн-готовность (Online-Ready MVP)

### Что реализовано

**Роутинг без библиотек** (в `main.js`):
- При открытии `/room/ABCD12` — сразу показывается экран комнаты
- `history.pushState` / `popstate` — браузерная навигация без перезагрузки
- При выходе из матча URL сбрасывается в `/`

**Экран онлайн-комнаты** (`room-screen.js` + `#room-overlay` в HTML):
- Код комнаты (6 символов) + ссылка приглашения
- Кнопка «Скопировать ссылку» (Clipboard API + fallback через `prompt`)
- Список игроков (слот 1 и 2), статусы «Ожидает» / «✓ Готов»
- «+ Добавить тестового игрока» — локальная имитация второго игрока
- «Готов» — переключает состояние, меняет текст кнопки
- «Начать бой» — активна только когда оба игрока готовы → запускает 2P матч
- «Назад» — возврат в меню + сброс URL

**Секция «ИГРА ПО СЕТИ»** в главном меню:
- «Войти / зарегистрироваться» → показывает уведомление (авторизация заглушена)
- «Создать комнату» → генерирует roomId, переходит на экран комнаты
- «Войти по коду» → `prompt()` для ввода кода, переход на экран комнаты

**Сервисы (заготовки):**
- `auth-service.js` — `isOnlineAuthEnabled()` = `false`, остальные функции-заглушки
- `room-service.js` — localStorage хранение, `createRoom()`, `joinRoom()`, `getRoomInviteLink()`, `parseRoomIdFromUrl()`, `generateRoomId()`

**Деплой:**
- `vite.config.js`: `base: '/'` — ассеты работают с любого URL-пути
- `firebase.json`: rewrite `** → /index.html` — все маршруты отдают SPA
- `dist/` собирается командой `npm run build` (проверено, 1.42s)

### Чего нет (следующий этап)

| Функция | Что нужно добавить |
|---------|-------------------|
| Настоящий онлайн | WebSocket сервер (Node.js + Socket.IO) |
| Два браузера видят друг друга в комнате | `socket.emit('join')`, `socket.on('player_joined')` |
| Синхронизированный бой | Передача команд через сервер + snapshot состояния |
| Авторизация | Firebase Auth / Supabase Auth вместо заглушек |
| Рейтинг в облаке | Firebase Firestore / Supabase вместо localStorage |

Точки подключения помечены комментарием `// В будущем` в `room-service.js`.

### Текущее ограничение — важно понимать

Сейчас ссылка `/room/ABCD12` работает **только локально** (у одного человека).
Чтобы друг открыл игру по ссылке — нужно сначала задеплоить (см. `DEPLOY.md`).
Даже после деплоя — оба игрока будут видеть экран комнаты, но **не друг друга** (нет WebSocket сервера).
Для реальной совместной игры нужен следующий этап — сервер.

---

## Туннель для онлайн-игры (cloudflared)

Позволяет другу подключиться к твоему локальному серверу через интернет без деплоя.

**Установка (один раз):**
```
winget install cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
```

**Ярлык на рабочем столе: `Doma Pustyni.lnk`**
Двойной клик — запускает сервер, открывает туннель, открывает браузер через туннельный URL, копирует ссылку для друга в буфер обмена.

Скрипт: `launch-game.ps1` в корне проекта.

**Важно:** браузер должен открываться именно через туннельный URL (`https://xxx.trycloudflare.com`), а не через `localhost:3000`. Только тогда ссылка приглашения в комнате будет публичной и друг сможет по ней зайти. Лаунчер делает это автоматически.

**Ручной запуск (если нужно):**
```
# Терминал 1 — игровой сервер
npm run host

# Терминал 2 — туннель
cloudflared tunnel --url http://localhost:3000
```

Затем открыть браузер по туннельному URL (не localhost).

> Туннель живёт пока работает процесс cloudflared. При новом запуске URL меняется.
> Cloudflared установлен: `C:\Program Files (x86)\cloudflared\cloudflared.exe`

**Известные исправления лаунчера:**
- Скрипт сохранён в UTF-8 с BOM (PowerShell 5.1 требует BOM для корректного чтения)
- Лог туннеля создаётся с уникальным именем (`doma_cf_<PID>.log`) чтобы не было конфликтов блокировки
- Лог читается через `Get-Content` (умеет читать заблокированные файлы) вместо `ReadAllText`

---

## История версий

### v2.2 — Публичный деплой на Render.com

**Публичная ссылка: https://doma-pustyni.onrender.com**

Сервер (`server/index.js`) одновременно:
- отдаёт игру (статика из `dist/`)
- обрабатывает WebSocket-комнаты (Socket.IO)

Игроку не нужно ничего запускать — просто открыть ссылку в браузере.

**Изменения:**
- `package.json` — добавлен скрипт `"start": "node server/index.js"` (Render его ищет)
- `render.yaml` — конфиг деплоя: `buildCommand: npm install --include=dev && npm run build`, `startCommand: node server/index.js`
- `.gitignore` — создан (исключает `node_modules/`, `dist/`)
- `DEPLOY.md` — полная инструкция по деплою на Render

**GitHub:** https://github.com/V1adrago/doma-pustyni (аккаунт V1adrago)

**Важно — холодный старт:** бесплатный Render засыпает через 15 мин без посещений.
Первый вход после паузы ~30-60 сек. Решение: UptimeRobot (бесплатно, пинг раз в 10 мин).

| Файл | Что изменилось |
|------|----------------|
| `package.json` | Добавлен `"start"` скрипт |
| `render.yaml` | НОВЫЙ — конфиг Render |
| `.gitignore` | НОВЫЙ — исключает node_modules, dist |
| `DEPLOY.md` | Полностью переписан под Render |

---

### v2.1 — Tutorial: 3 урока, прогресс обучения, мобильный вид

**Структура уроков сжата с 5 до 3:**

| ID | Название | Содержание |
|----|----------|-----------|
| `lesson_1` | Урок 1: Основы боя | Специи, рука карт, юниты, инженер, три линии, давление. Тихий бот, 55 сек |
| `lesson_2` | Урок 2: Тактика и осада | Контры (стрелок, тяжёлый), связка башнелом (танк→башнелом→стрелок). Активный бот, 55 сек |
| `lesson_3` | Урок 3: Первый бой | Полный бой против нормального AI без подсказок (`useNormalAI: true`, нет `steps`, конец = `matchEnd`) |

**Прогресс в экране уроков** (`_renderLessons()` в `mainMenu.js`):
- Блок `.tl-progress-block` с надписью «Прогресс обучения», счётчиком `X / 3` и полоской заполнения
- Пройденный урок: зелёная рамка, иконка `✓` вместо номера (класс `.tl-item-done`, `.tl-num-done`)
- Урок 3 — красная акцентная кнопка «⚔ В бой» (класс `.tl-start-btn-final`)

**Мобильный вид экранов:** `#unit-guide-screen` и `#tutorial-lessons-screen` теперь центрируют контент в колонке `min(100%, 430px)` — как главное меню. Фон на весь экран, контент — мобильной ширины.

**Исправления:**
- Название «Учебные бои» → «Учебный бой» (в кнопке меню, заголовке экрана и шаге тура)
- `list.parentNode.insertBefore(progBlock, list)` вместо `screen.insertBefore` (список уроков был дочерним элементом `.tl-layout`, а не `#tutorial-lessons-screen`)

| Файл | Что изменилось |
|------|----------------|
| `src/tutorial/tutorial-data.js` | 3 урока вместо 5 — новые id, колоды, botScript, steps |
| `src/ui/mainMenu.js` | `_renderLessons()` — прогресс-блок, `.tl-item-done`, `.tl-num-done`, кнопка «⚔ В бой» |
| `src/ui/mainMenu.css` | `.tl-progress-block`, `.tl-progress-bar-*`, `.tl-item-done`, `.tl-num-done`, `.tl-start-btn-final`; `width: min(100%, 430px)` для `#unit-guide-screen` и `#tutorial-lessons-screen` |
| `index.html` | «Учебные бои» → «Учебный бой» |

---

### v1.9 — Фикс приоритета инженера

**Файл:** `src/unit-manager.js`

**Баг:** юнит, стоящий у башни, атаковал башню даже если вражеский инженер уже вошёл в его агро-радиус. Инженер проходил мимо незамеченным.

**Фикс — три изменения:**

1. **`engineerThreat`** — новый флаг: `closestEnemy.cardId === 'engineer' && enemyInAggro`. Говорит, что инженер уже в зоне контроля юнита.

2. **`else if (towerInRange && !engineerThreat)`** — атака башни подавляется, пока инженер в агро-радиусе. Юнит переходит в режим преследования вместо удара по башне.

3. **`closestEnemyIsAhead` для инженера всегда `true`** — юнит не теряет инженера, если тот уже прошёл мимо на пути к узлу.

4. **Без задержки разворота** (`&& !engineerThreat` в условии `isTurning`) — реакция мгновенная, без `turnDelay`.

**Поведение ИИ не затронуто** — радиус обнаружения не расширен, только поведение внутри уже активированной агро-зоны.

| Файл | Что изменилось |
|------|----------------|
| `src/unit-manager.js` | `engineerThreat`, `closestEnemyIsAhead` для инженера, `towerInRange && !engineerThreat`, `!engineerThreat` в turn-delay |

---

### v1.8 — Прогрессивное разрушение башен + руины

#### Прогрессивный визуал повреждений (`src/towers.js`)

Башни теперь визуально деградируют по мере потери HP — `updateDamageVisual(id)` вызывается из `damageTower()` при каждом ударе:

| HP | Визуал |
|----|--------|
| 100–70% | Норма |
| 70–30% | Цвет начинает темнеть (lerp к серому), мерлоны цитадели постепенно исчезают |
| 30–0% | Сильное потемнение (до COL_DESTROYED), наклон до ~6°, все мерлоны убраны |

- `lerpHex(a, b, t)` — хелпер интерполяции цвета по компонентам
- `group.userData.tiltDir` (±1) задаётся случайно при создании, не меняется
- Мерлоны: `keep = ceil(6 * ratio * 1.4)` — исчезают постепенно

#### Руины при уничтожении

`destroyTower(id)` теперь скрывает башню (`group.visible = false`) и вызывает `_buildRuins(id)`.

Руины — отдельный `THREE.Group`, добавляется в сцену. Состав:
- **Горка щебня** — `CylinderGeometry` приплюснутый, цвет 0x6b5530
- **Обломки** — 3 (боковая) / 5 (цитадель) `BoxGeometry` на псевдослучайных позициях
- **Пенёк** — короткий цилиндр с той же геометрией, что и тело башни
- **Упавший шпиль** — конус лежащий на боку, позиция детерминирована по `id`
- **Фрагмент стены** — только для цитадели, дополнительный крупный блок

Позиции обломков детерминированы (вычислены через `id.charCodeAt` без `Math.random()`) — руины одинаковы внутри матча.

`resetAll()` удаляет `ruinsGroup` со сцены, вызывает `dispose()` на геометрии/материалах, восстанавливает `group.visible = true`, цвета, наклон, мерлоны.

`applyFactionColors()` теперь также обновляет `md.baseBodyColor` / `md.baseCapColor` — lerp повреждений начинается от цвета фракции, а не дефолтного.

| Файл | Что изменилось |
|------|----------------|
| `src/towers.js` | `lerpHex()`, `updateDamageVisual()`, `_buildRuins()`, поля `battlements`/`baseBodyColor`/`baseCapColor`/`ruinsGroup`/`towerH`/`botR`/`topR`/`capH` в meshData; `destroyTower` скрывает group вместо окраски; `resetAll` чистит руины |

---

### v1.7 — Подписи юнитов + Balance Editor

#### Подписи юнитов над моделями (`src/units.js`)

Над каждым юнитом теперь висит текстовый спрайт с именем:
- Тёмный полупрозрачный фон + цветная рамка (синяя — игрок, оранжевая — враг)
- Белый текст 18px, позиция `(0, 1.65, 0)` относительно корня юнита (выше HP-бара)
- Реализована через `makeNameSprite(name, side)` → `THREE.Sprite` с `CanvasTexture`

#### Balance Editor (`dev-balance.html` + `server/index.js`)

Инструмент для разработчиков — редактирование параметров юнитов без правки кода вручную.

**Доступ:** `http://localhost:3000/dev-balance`

**Возможности:**
- Таблица всех 9 юнитов со всеми балансными параметрами
- Редактирование прямо в ячейках, изменённые ячейки подсвечиваются жёлтым
- Баннер с перечнем всех правок перед сохранением
- **📤 Экспорт .xlsx** — скачивает файл с русскими заголовками (Цена, HP, Скорость, Урон, +Возд., Урон зд., Кулдаун, Дальность, Отряд, Разворот, Пилинг)
- **📥 Импорт .xlsx** — загружает Excel, применяет изменённые параметры
- **💾 Сохранить в cards.js** — перезаписывает `src/cards.js` напрямую через сервер

**Серверные API (`server/index.js`):**
| Метод | Путь | Действие |
|-------|------|---------|
| GET | `/dev-balance` | Отдаёт HTML редактора |
| GET | `/api/dev/units` | Возвращает CARD_DEFS как JSON (парсинг через `Function()`) |
| POST | `/api/dev/units` | Принимает обновлённый CARD_DEFS, перезаписывает `src/cards.js` |

| Файл | Что изменилось |
|------|----------------|
| `src/units.js` | `makeNameSprite()` — спрайт с именем юнита; вызов в конструкторе `Unit` |
| `dev-balance.html` | НОВЫЙ — самодостаточный Balance Editor (HTML + SheetJS CDN) |
| `server/index.js` | `parseCardDefs()`, `writeCardDefs()`, три новых роута `/dev-balance` и `/api/dev/*` |

---

### v1.6 — Баги движения и баланс

**Файл:** `src/unit-manager.js`, `src/cards.js`

#### Баг: юниты возвращались назад к своей башне

Два источника — один корень. Введён флаг `closestEnemyIsAhead`:
```js
const closestEnemyIsAhead = !!closestEnemy &&
  (closestEnemy.position.z - unit.position.z) * (tp.z - unit.position.z) >= 0;
```
Применяется в **двух** местах `unit-manager.js`:

| Место | Прежнее поведение | Исправлено |
|---|---|---|
| Движение (aggro-chase) | Юнит гнался за врагом позади → шёл к своей башне | Движение только если `closestEnemyIsAhead` |
| Разворот (`turnDelay`) | Срабатывал для врагов позади → юнит стоял на месте снова и снова | Разворот только если `closestEnemyIsAhead` |

Проверено автотестом (Playwright): 0 backtrack-событий за два раунда наблюдения.

#### Баг: отряды стали слишком сильными (v1.4 регрессия)

Per-member урон был полным (×activeCount суммарно). Исправлено делением:
```js
let dmg = calcUnitDamage(unit, mTarget) / activeCount;  // vs units
let dmg = unit.def.buildingDamage / activeCount;        // vs towers
```
Суммарный DPS отряда теперь равен одиночному юниту — визуальное распределение атак сохранено.

#### Баланс: нерф стрелковых юнитов ×0.5 (`cards.js`)

| Юнит | `attackDamage` | `airDamage` | `buildingDamage` |
|---|---|---|---|
| Лучник | 38 → **19** | 50 → **25** | 18 → **9** |
| Дрон   | 32 → **16** | — | 30 → **15** |

---

### v1.5 — Консоль разработчика

**Новый файл:** `src/dev-console.js` — класс `DevConsole`, самодостаточный (инжектирует свой CSS, создаёт DOM).

**Интеграция в `main.js`:**
- `import { DevConsole }` добавлен в шапку
- `let devSpeedMult = 1.0` — множитель скорости симуляции
- `delta *= devSpeedMult` в игровом цикле
- `devConsole.update()` вызывается каждый кадр (только если панель открыта)
- `const devConsole = new DevConsole({...})` создаётся сразу после `battleMenu`

**Возможности консоли:**
| Секция | Функция |
|--------|---------|
| Запуск матча | AI vs AI / Игрок vs AI / Лок. 2P — обходит DeckBuilder, стартует сразу |
| Спавн юнита | Все 9 типов, сторона (Игрок/Враг), линия (Лево/Центр/Право) — минует экономику |
| Управление | Пауза/продолжить, Стоп → главное меню |
| Скорость | ×0.5 / ×1 / ×2 / ×4 — масштабирует `delta` |
| Статус | Режим, время матча, число юнитов на поле |

**Управление:** кнопка `🛠 DEV` (верхний левый угол) или клавиша `` ` `` / `Ё`.

---

### v1.4 — Боевые отряды: per-member атаки и peeling

**Принцип:**
Одна карта = один `Unit` (общий HP, HP-бар, позиция, коллизия, онлайн-сущность).
Но активные модельки внутри отряда атакуют раздельно и могут временно переключаться на ближайшего врага.

**Активные модельки — `getActiveSquadCount()`:**
| squadSize | HP > 66% | HP > 50% | HP > 33% | HP > 0% |
|-----------|----------|----------|----------|---------|
| 3 | 3 | — | 2 | 1 |
| 2 | — | 2 | — | 1 |
| 1 | — | — | — | 1 |

**Урон (per-member, исправлено в v1.6):**
- Каждая активная моделька наносит `damage / activeCount` — суммарный DPS равен одиночному юниту
- При 3 активных swordsman (damage=45): каждая бьёт 15, итого 45 за удар
- При пилинге (2 бьют A, 1 бьёт B): A получает 30, B — 15
- При 2 активных: каждая 22.5, итого 45; при 1 — все 45

**subTarget (peeling):**
- Каждая активная моделька независимо ищет альтернативного врага каждые 0.25с
- Переключается если враг ближе к ней на ≥0.45 ед. и сработал шанс `peelChance`
- `peelChance` в `cards.js`: melee=0.65, ranged=0.45, size=1/engineer/drone=0
- Моделька не уходит дальше `squadLeashRadius` (size=2: 0.85, size=3: 1.15)
- subTarget очищается при смерти цели; моделька возвращается к formation

**Башни:**
- Башни атакуют общий Unit (без изменений)
- Отряд из N активных моделек бьёт башню N раз за удар
- При уничтожении башни первой атакующей моделькой — остальные останавливаются

**VFX:**
- `_spawnMemberAttackVfx(scene, cardId, fromPos, toPos)` — VFX от позиции каждой модельки
- Archer выпускает N болтов (по одному от каждой активной модельки)
- `_spawnMemberTowerVfx(scene, cardId, towerPos)` — impact у башни за каждый удар

**Онлайн:** модельки не синхронизируются — subTarget и peeling локальные; общий Unit синхронизируется как прежде.

| Файл | Что изменилось |
|------|----------------|
| `src/cards.js` | `peelChance` добавлен ко всем 9 юнитам |
| `src/units.js` | `getActiveSquadCount()`, `updateSquadMemberPositions(delta)`, `squadMembers[]`, `squadLeashRadius` |
| `src/units.js` | `updateSquadByHp()` рефакторинг — использует `getActiveSquadCount()`, синхронизирует `member.isActive` |
| `src/unit-manager.js` | `_spawnMemberAttackVfx`, `_spawnMemberTowerVfx`, `getMemberWorldPos`, `SUB_TARGET_CHECK_INTERVAL`, `MIN_BENEFIT_DISTANCE` |
| `src/unit-manager.js` | Per-member циклы атаки vs юнита и vs башни; subTarget picking в update() |

---

### v1.3 — Привязка юнитов к линиям (lane lock)

**Проблема:** Юниты дрейфовали с линии на линию при движении к башне или врагу (обновлялись обе оси X и Z).

**Решение (src/unit-manager.js):**
- После определения цепочки башен вычисляется `blockingTowerId` — первая башня в цепочке (не цитадель).
- `pathBlocked = true` пока эта башня жива.
- В блоке движения (`else`):
  - Если `pathBlocked`: `unit.position.x = LANE_X[unit.lane]` (принудительный замок), движение только по оси Z.
  - Если `!pathBlocked` (башня уничтожена, или центральная линия): свободное движение X+Z к цитадели.
- Центральная линия (`chain.length === 1`, только цитадель): `blockingTowerId = null`, блокировки нет.

| Файл | Что изменилось |
|------|----------------|
| `src/unit-manager.js` | `blockingTowerId`, `pathBlocked`, условное движение в `else`-блоке |
| `README.md` | Документация механики lane lock, обновлена версия |

---

### v1.1 — Визуальные отряды юнитов (squad system)

**Механика:**
Один сыгранный юнит = одна боевая сущность (один HP, одна позиция, одна атака).
Но визуально он может состоять из нескольких low-poly моделек.
Количество видимых моделек уменьшается по мере потери HP.
Отдельные модельки не имеют своего HP, коллизии, атак и не синхронизируются в онлайне.

**squadSize по юнитам:**

| Юнит | squadSize | Логика |
|------|-----------|--------|
| engineer | 1 | один инженер |
| scout | 2 | пара ищеек барханов |
| swordsman | 3 | отряд клинков |
| assault | 2 | ударная группа башнеломов |
| archer | 3 | группа стрелков поддержки |
| spearman | 3 | строй пикейщиков |
| drone | 1 | один дрон |
| heavy | 1 | один латник-танк |
| guard | 2 | два гвардейца со щитами |

**Правило уменьшения моделек от HP:**
- squadSize=1: 1 моделька пока HP>0, 0 при смерти
- squadSize=2: 2 при 51–100% HP, 1 при 1–50% HP, 0 при смерти
- squadSize=3: 3 при 67–100%, 2 при 34–66%, 1 при 1–33%, 0 при смерти

**Формации:**
- 1 модель: `[0,0,0]`
- 2 модели: `[-0.28,0,0]` и `[0.28,0,0]`
- 3 модели: треугольник — лидер впереди, два сзади по бокам

**Архитектурные изменения (src/units.js):**
- `Unit.mesh` — корневая THREE.Group (позиция/движение как раньше)
- `Unit.squadGroup` — вложенная группа с отдельными моделями
- `Unit._buildSquadVisual(def)` — создаёт N моделей в формации со scale
- `Unit.updateSquadByHp()` — скрывает модели через `model.visible = false`, спавнит пыль
- `Unit.takeDamage(amount)` — единая точка урона: hp → refreshHp → updateSquadByHp
- HP-bar один на весь отряд, висит над центром `this.mesh`
- Смерть каждой модели сопровождается `spawnDeathDust` на её позиции

**Изменения в src/unit-manager.js:**
- Все `target.hp -= dmg; target.refreshHp()` заменены на `target.takeDamage(dmg)`
- Урон от башни и от юнита к юниту — через единый метод

**Что не изменилось:**
- HP, урон, скорость, дальность, кулдауны всех юнитов
- Боевая логика (одна сущность — одна атака — один таргет)
- Онлайн-синхронизация (только боевые действия, не состав отряда)
- VFX атак (slash, bolt, thrust, impact, drone pulse)

| Файл | Что изменилось |
|------|----------------|
| `src/cards.js` | `squadSize` добавлен ко всем 9 юнитам |
| `src/units.js` | Unit рефакторинг: squadGroup, _buildSquadVisual, takeDamage, updateSquadByHp |
| `src/unit-manager.js` | hp -= → takeDamage() в двух местах (башня и юнит→юнит) |

---

### v1.0 — Host-сервер MVP: реальный онлайн через Socket.IO

**Новый файл: `server/index.js`** — Node.js + Express 5 + Socket.IO сервер:
- Поднимает HTTP + WS сервер на `PORT` (default 3000), слушает `0.0.0.0`
- В production отдаёт `dist/` (статика Vite)
- Хранит комнаты в памяти (`Map`)
- События: `create_room`, `join_room`, `player_ready`, `start_match`, `play_card`, `host_snapshot`, `surrender`, `leave_room`, `disconnect`
- Первый входящий = host, второй = guest; третий получает `room_full`
- При отключении игрока — `opponent_disconnected` второму игроку

**Новый файл: `src/services/network-service.js`** — Socket.IO клиентский сервис:
- В dev-режиме подключается к `http://localhost:3000`, в production — к `window.location.origin`
- API: `connectNetwork()`, `createOnlineRoom()`, `joinOnlineRoom()`, `setReady()`, `startOnlineMatch()`, `sendPlayCard()`, `sendHostSnapshot()`, `sendSurrender()`
- Колбэки: `onRoomState()`, `onMatchStart()`, `onOpponentAction()`, `onHostSnapshot()`, `onNetworkError()`

**`src/room-screen.js`** — полный рерайт под реальный WebSocket:
- `show(null)` → `create_room` (host), `show(roomId)` → `join_room` (guest)
- Показывает статус подключения, список игроков с ready-статусами
- `btn-room-ready` → `setReady()` → `room_state` от сервера
- `btn-room-start` активна только у host при обоих ready
- Для guest — подсказка «Ожидание запуска от Host»
- При `match_start` → `onStartOnlineMatch(matchData)`

**`src/main.js`** — добавлен онлайн-режим `'online'`:
- `isOnlineMatch`, `onlineRole`, `onlineRoomId`, `localSide` — состояние онлайна
- `startOnlineMatch(matchData)` — вызывается RoomScreen при match_start; показывает DeckBuilder для локального игрока; host → 'player' (bottom), guest → 'enemy' (top)
- `_isLocalControlPrefix(prefix)` — блокирует клики по картам противника в онлайне
- `onOpponentAction` — спавн юнита на стороне противника + примерное списание экономики
- `onHostSnapshot` → проверка дрейфа; если критичный → `#online-sync-warning`
- `onNetworkError` → surrender/disconnect обрабатываются
- AI отключён в `isOnlineMatch = true`
- `sendPlayCard()` вызывается ДО локального применения карты
- Host каждую секунду отправляет `host_snapshot` (elapsed, unitCount, tower HP, spices)
- Surrender → `sendSurrender()` + `showWinScreen()`

**`package.json`** — новые скрипты:
```
npm run build       — собрать клиент
npm run server      — запустить только сервер
npm run host        — build + запустить сервер (продакшн-тест)
npm run dev:client  — Vite dev (0.0.0.0)
npm run dev:server  — Node сервер
npm run dev:online  — оба одновременно (concurrently)
```

**`style.css`** — новые CSS:
- `.room-status-msg` — статус подключения в комнате
- `.room-guest-hint` — подсказка для guest
- `#online-sync-warning` — фиксированный бейдж «нестабильная синхронизация»
- `.online-disconnect-overlay` + `.online-disconnect-card` — экран отключения

**Как запустить:**
```
npm run host
# Открыть http://localhost:3000
# Создать комнату → скопировать ссылку → отправить коллеге
# Для локальной сети: http://ВАШ_IP:3000/room/XXXXXX
```

**Для dev-разработки:**
```
npm run dev:online
# Vite: http://localhost:5173  (клиент)
# Server: http://localhost:3000 (сервер)
```

| Файл | Что изменилось |
|------|----------------|
| `server/index.js` | НОВЫЙ — Socket.IO сервер комнат |
| `src/services/network-service.js` | НОВЫЙ — клиентский WS-сервис |
| `src/room-screen.js` | Полный рерайт — реальный Socket.IO |
| `src/main.js` | Онлайн-режим, onOpponentAction, snapshot, guard |
| `package.json` | Новые скрипты + зависимости |
| `style.css` | CSS для статуса, предупреждений, disconnect |
| `index.html` | `#online-sync-warning` элемент |

---

### v0.9 — Канонические названия юнитов, low-poly визуал, VFX атак

**Каноничные названия юнитов** (`cards.js`):
Все `cardId` сохранены (engineer, scout, swordsman, assault, archer, spearman, drone, heavy, guard).
Изменены только отображаемые `name`:

| cardId | Новое название |
|--------|----------------|
| engineer | Инженер Узла |
| scout | Ищейка Барханов |
| swordsman | Клинок Дома |
| assault | Башнелом |
| archer | Песчаный Стрелок |
| spearman | Пикейщик Каравана |
| drone | Дюнный Сокол |
| heavy | Латник Пустыни |
| guard | Гвардеец Чести |

**Low-poly визуал юнитов** (`units.js`):
Каждый юнит переработан через Three.js primitives:
- **Инженер Узла**: цилиндр-тело + рюкзак + антенна + мигающий контейнер специй (emissive amber)
- **Ищейка Барханов**: низкий капсула-силуэт + конус-капюшон + короткий клинок
- **Клинок Дома**: box-броня + шлем + наплечник + сабля + эмблема дома на груди
- **Башнелом**: широкий тяжёлый торс + плечевые плиты + молот с рукоятью
- **Песчаный Стрелок**: тонкая капсула + капюшон + импульсная винтовка с прицелом
- **Пикейщик Каравана**: высокая капсула + нарукавный щит + длинная пика с наконечником
- **Дюнный Сокол**: ромбовидный octahedron + 4 fin-стабилизатора + emissive сенсор-глаз
- **Латник Пустыни**: массивный box-торс + широкие плечи + большой шлем + булава
- **Гвардеец Чести**: box-броня + gold-шлем + гербовый гребень (emissive gold) + большой щит

**VFX атак** (`units.js`):
- `spawnSlash()` — дуга клинка (scout/swordsman/heavy/guard)
- `spawnThrust()` — прямая линия укола (spearman)
- `spawnBolt()` — летящий болт projectile (archer)
- `spawnDronePulse()` — энергетический луч вниз (drone)
- `spawnImpact()` — пыль при ударе по башне (assault/heavy и все)
- `spawnEngineerRing()` — золотая пульсирующая волна при активации узла (engineer)
- `spawnDeathDust()` — облако пыли при смерти юнита (все)
- `spawnShieldFlash()` — вспышка щита при получении урона (guard)
- Все VFX с TTL, auto-dispose geometry/material, нет утечек

**Микроанимации** (`Unit.updateVisual(delta, time)`):
- scout: быстрое покачивание (sin×8)
- heavy: медленное тяжёлое качание (sin×1.8)
- drone: парение вверх-вниз (sin×2.2)
- engineer: мигающий индикатор специй
- guard: слабый gold-отблеск гребня

**Интеграция VFX** (`unit-manager.js`):
- VFX срабатывает только в момент нанесения урона (attackTimer === 0)
- `_spawnAttackVfx()` — per-unit melee/ranged VFX
- `_spawnTowerAttackVfx()` — усиленный impact для assault/heavy по башням
- `tickVfx()` вызывается в конце каждого update()
- `unit.onHit()` — shield flash для guard при получении урона

| Файл | Что изменилось |
|------|----------------|
| `src/cards.js` | Все `name` переименованы в каноничные (cardId не тронуты) |
| `src/units.js` | 8 новых buildX() функций, 7 VFX функций, `updateVisual()`, `onHit()`, `tickVfx()` |
| `src/unit-manager.js` | Вызовы VFX при атаках, `updateVisual()` в loop, `tickVfx()` в конце update |

---

### v0.8 — Быстрое сохранение последней колоды в пресет

**Feature: кнопка 💾 «Сохранить последнюю колоду»** (`deck-builder.js`, `mainMenu.js`, `mainMenu.css`, `index.html`):
- Новая экспортируемая функция `loadSavedDeck()` в `deck-builder.js` — читает `dp-saved-deck-v1` и возвращает `{ faction, selection, deck[] }` или `null`
- В шапке секции «БОЕВЫЕ КОЛОДЫ» добавлена кнопка `💾` (`#mm-preset-save-last`): появляется только если есть сохранённая колода и лимит пресетов не исчерпан
- Клик по `💾` → prompt «Название колоды» → пресет сохраняется без перехода в DeckBuilder
- Пустое состояние секции обновлено: если есть сохранённая колода — подсказка «Нажми 💾 чтобы сохранить последнюю колоду, или ＋ чтобы собрать новую»
- Код `_loadSavedDeck()` в классе DeckBuilder делегирует в `_parseSavedDeck()`, устранено дублирование

| Файл | Что изменилось |
|------|----------------|
| `src/deck-builder.js` | `_parseSavedDeck()` (общая логика), `export loadSavedDeck()`, рефактор `_loadSavedDeck()` |
| `src/ui/mainMenu.js` | импорт `loadSavedDeck`, `_renderPresets()` — показ/скрытие 💾, `_saveLastDeckAsPreset()`, биндинг |
| `src/ui/mainMenu.css` | `.mm-presets-header-btns`, `.mm-presets-save-btn` |
| `index.html` | `#mm-preset-save-last` в `.mm-presets-header` |

---

### v0.7 — Таймер инженера, живой XP/рейтинг, система боевых пресетов

**Fix: Таймер инженера прямо на карте** (`index.html`, `style.css`, `main.js`):
- Добавлен элемент `.ch-timer` в каждую карточку руки (HTML)
- Когда инженер заблокирован по времени, внутри карточки появляется красный обратный отсчёт «⏳ 0:45»
- `.ch-timer { display: none }` → становится видим только при `.unplayable`
- Убран tooltip (не работает на touch)

**Fix: Живой рейтинг и XP-бар** (`ui/mainMenu.js`):
- `_syncProfile()` теперь пересчитывает `xp / xpMax` как прогресс внутри текущего уровня (от `currTier.minRating` до `nextTier.minRating`)
- XP-текст показывает «35 / 100 до ур.2» — не статичные 1250/2000
- На максимальном уровне (5) бар полностью заполнен, показывает сам рейтинг

**Feature: Система боевых пресетов** (`preset-service.js`, `mainMenu.js`, `main.js`, `index.html`, `mainMenu.css`):
- Новый файл `src/services/preset-service.js` — CRUD для пресетов в localStorage (`dp-deck-presets-v1`)
- Секция «БОЕВЫЕ КОЛОДЫ» в главном меню — список до 5 пресетов
- `+` → DeckBuilder → вводишь название → сохраняется как пресет
- Пресет можно: выбрать (✓), переименовать (✏), удалить (✕)
- «В бой» с выбранным пресетом → матч начинается без DeckBuilder
- `DeckBuilder.onComplete` теперь передаёт `(deck, faction, selection)` для сохранения пресета
- `MainMenu.startBattle(preset | null)` → `onStartBattle(preset)` в main.js

| Файл | Что изменилось |
|------|----------------|
| `index.html` | `.ch-timer` в картах руки, секция `#mm-presets-list` |
| `style.css` | `.ch-timer` стиль, `.hand-card.unplayable .ch-timer { display: block }` |
| `src/cards.js` | без изменений (логика уже была верной) |
| `src/main.js` | `onStartBattle(preset)`, `setDeckBuiltCallback`, пресет-флоу |
| `src/deck-builder.js` | `onComplete(deck, faction, selection)` — 3-й аргумент |
| `src/services/preset-service.js` | НОВЫЙ файл: `loadPresets/createPreset/updatePreset/deletePreset` |
| `src/ui/mainMenu.js` | `_syncProfile` XP, `_renderPresets`, `_bindPresetEvents`, `saveNewPreset` |
| `src/ui/mainMenu.css` | Стили `.mm-preset-card`, `.mm-preset-active`, кнопки rename/delete |

---

### v0.6 — Кнопка отмены, сохранение колоды, ограничения инженера, живой рейтинг

**Кнопка «Отмена» в DeckBuilder** (`index.html`, `deck-builder.js`, `style.css`):
- Кнопка `← Отмена` (`#btn-deck-cancel`) рядом с «К БОЮ»
- `DeckBuilder.show(label, onComplete, onCancel)` — 3-й аргумент; все вызовы в `main.js` передают `() => mainMenu.show()`

**Сохранение боевой колоды** (`deck-builder.js`):
- `_saveDeck()` — записывает `{ faction, selection }` в `localStorage` по ключу `dp-saved-deck-v1`
- `_loadSavedDeck()` — загружает при открытии, валидирует (сумма карт, допустимая фракция)
- Теперь при повторном входе в DeckBuilder колода восстанавливается автоматически

**Ограничения времени для инженера** (`cards.js`, `main.js`):
- Константа `ENGINEER_MIN_TIMES = [0, 60, 120]` — для 1-й / 2-й / 3-й стадии
- `canPlayCard(cardId, economy, elapsedSeconds)` — 3-й параметр; инженер блокируется пока не истечёт минимальное время
- Карта затемняется через CSS-класс `unplayable`; tooltip показывает «Инженер X доступен через Nс»
- Все вызовы `canPlayCard` и `pickAiCardForSide` в `main.js` обновлены

**Живой рейтинг в главном меню** (`ui/mainMenu.js`, `index.html`, `ui/mainMenu.css`):
- `MainMenu.show()` теперь вызывает `_syncProfile()` → `loadProfile()` перед показом
- `menuState` обновляется реальными данными (рейтинг, уровень, очки до следующего уровня)
- Добавлен `<span id="mm-rating-value">` в кнопку рейтинга — показывает текущий рейтинг
- Модальные окна «Профиль» и «Рейтинг» тоже используют живые данные

| Файл | Что изменилось |
|------|----------------|
| `index.html` | `#btn-deck-cancel`, `#mm-rating-value` |
| `style.css` | `.db-action-row`, `#btn-deck-cancel` |
| `src/cards.js` | `ENGINEER_MIN_TIMES`, `canPlayCard(elapsedSeconds)` |
| `src/deck-builder.js` | `onCancel`, `_saveDeck()`, `_loadSavedDeck()` |
| `src/main.js` | cancel-callback, `elapsedSeconds` в `canPlayCard`, tooltip |
| `src/ui/mainMenu.js` | `_syncProfile()`, импорт `profile-service` |
| `src/ui/mainMenu.css` | `.mm-rating-value` (стиль отображения рейтинга) |

---

### v0.5 — Внутриигровое меню паузы + фикс UI-overlay

- `src/ui/battleMenu.js` + `src/ui/battleMenu.css` — BattleMenu (пауза, настройки, сдача, выход)
- `src/ui/battleMenuState.js` — настройки боя в localStorage (`dp-battle-settings-v1`)
- `#ui-overlay` скрывается при возврате в меню и показывается при старте матча

---

### v0.4 — Мобильное главное меню

- `src/ui/mainMenu.js` + `src/ui/mainMenu.css` — новый MainMenu, мобильный дизайн
- `src/ui/menuState.js` — данные меню (статичные, заменены на живые в v0.6)
- SVG UI-kit встроен в `index.html` (`#mm-svg-kit`)
- Клип-путь diamond для кнопки «В БОЙ», геральдический щит, карточки фракций

---

### v0.3 — Online-Ready MVP

- `src/room-screen.js` — экран комнаты (код, ссылка, список игроков)
- `src/services/auth-service.js`, `room-service.js` — заглушки онлайн-сервисов
- `firebase.json` + `vite.config.js` — деплой-готовность, SPA routing
- `DEPLOY.md` — инструкция по Firebase Hosting

---

### v0.2 — Фракция Дом Чести + прогрессия

- `src/factions.js` — FactionManager (Боевой порядок, Щит гарнизона)
- `src/deck-builder.js` — DeckBuilder с выбором фракции
- `src/config/progression.js` — PROGRESSION (5 уровней), HOUSES (5 домов)
- `src/services/profile-service.js` — рейтинг, победы/поражения в localStorage
