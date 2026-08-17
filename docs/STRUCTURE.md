# Структура проекта ZERNIX Dungeon Assistant

Desktop-приложение (React + Vite + Electron) для мастера D&D 5.5: генерация лута, NPC, подготовка сессии.

## Активный код (используется при `npm run dev` / `npm run electron`)

```
src/
├── main.tsx                 # Точка входа React
├── App.tsx                  # Роутинг экранов + оболочка (sidebar, topbar, фон)
├── index.css                # Tailwind + CSS-переменные
├── ZernixTheme.css          # Основная тема (desktop UI)
│
├── zernix/                  # Feature-слой приложения
│   ├── views/               # Экраны по одному файлу на раздел
│   │   ├── home/
│   │   ├── loot/
│   │   ├── npc/
│   │   ├── prep/
│   │   ├── conditions/
│   │   ├── history/
│   │   ├── favorites/
│   │   ├── settings/
│   │   └── index.ts         # Barrel-экспорт всех views
│   ├── components/          # Карточки (Loot, NPC, Session)
│   ├── generators/          # Мост UI ↔ Electron IPC / browser mock
│   ├── lib/                 # Утилиты zernix (prepText, formatNoteTime)
│   ├── ZernixGeneratorsContext.tsx
│   ├── ZernixPreview.tsx    # Правая панель «кодекс»
│   └── TableModeView.tsx
│
├── context/                 # React Context (данные пользователя, localStorage)
├── hooks/                   # useAppContent, useMediaQuery, …
├── lib/                     # Общие утилиты (npcSummon, sectionBackgrounds, …)
├── services/
│   └── mocks/
│       └── database.mjs     # Browser-only mock (без Electron)
├── types/                   # TypeScript типы
├── assets/                  # Изображения (logo, d20, backgrounds/)
└── components/
    └── ZernixDeskModals.tsx # Модалки профиля и настроек (активны)
```

## Electron (main process)

```
electron/
├── main.cjs                 # Окно, IPC handlers
├── preload.cjs              # window.electronAPI
├── loot-core.mjs            # Генерация лута через SQLite (SRD)
├── loot-context-data.mjs    # Нарративный контекст лута
└── sqlite-path.mjs          # Путь к базе предметов
```

**В Electron** генераторы вызывают `window.electronAPI.generateLoot()` → SQLite (таблицы DMG 2024, предметы SRD).

**В браузере** (`npm run dev`) — fallback на `src/services/mocks/database.mjs`.

## Поток данных

```
View (views/loot) 
  → ZernixGeneratorsContext 
    → generators/lootBridge.ts 
      → Electron IPC (SQLite)  ИЛИ  services/mocks/database.mjs
```

## Команды

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Vite dev-server (browser mock) |
| `npm run build` | TypeScript + production bundle |
| `npm run electron` | Сборка + запуск desktop |
