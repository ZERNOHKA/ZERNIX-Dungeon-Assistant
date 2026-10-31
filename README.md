# ZERNIX Dungeon Assistant

[![CI](https://github.com/ZERNOHKA/ZERNIX-Dungeon-Assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/ZERNOHKA/ZERNIX-Dungeon-Assistant/actions/workflows/ci.yml)

> Публичный портфолио-срез продукта ZERNIX. Активная разработка ведётся в закрытом репозитории, актуальное веб-приложение доступно на **[zernix.ru](https://zernix.ru)**.

ZERNIX Dungeon Assistant — продуктовый инструмент для мастеров настольных ролевых игр с фокусом на **D&D 2024**. Он сокращает путь от черновой идеи до материала, который можно использовать за игровым столом:

`идея → сцена → NPC → encounter → loot → игровая сессия`

Этот репозиторий сохраняет раннюю web/Electron-реализацию как инженерный case study. Он не является источником актуальной production-версии.

## Возможности публичной версии

- Подготовка сессий и переиспользуемых session briefs
- Генерация NPC с мотивацией, секретом и нарративными деталями
- Подготовка encounters с учётом группы и окружения
- Генерация loot с ограничениями редкости и стоимости
- Справочник состояний для использования за игровым столом
- История и избранное для сгенерированного контента
- Сфокусированный режим Active Table
- Локальное хранение данных и desktop-сборка

В закрытом продуктовом репозитории продолжается работа над контекстом кампании, данными мира, локациями, фракциями и production-сервисами. Возможности в разработке намеренно не описываются здесь как завершённые.

## Интерфейс

| Подготовка сессии | Генерация loot |
| --- | --- |
| ![Подготовка сессии](assets/screenshots/screen_main.png) | ![Генератор loot](assets/screenshots/screen_loot.png) |

| Создание NPC | Режим Active Table |
| --- | --- |
| ![Создание NPC](assets/screenshots/screen_npc.png) | ![Режим Active Table](assets/screenshots/screen_lock.png) |

## Инженерные решения

- React/TypeScript-интерфейс, разделённый на продуктовые представления и доменные модели
- Отдельные bridges для генерации сессий, NPC и loot
- SQLite-данные в desktop-версии и интеграция через Electron IPC
- Локальный REST API с проверкой API-ключа для операций генераторов
- Smoke-скрипты, проверяющие пустые значения, дубли, диапазоны и согласованность текста
- Portable- и installer-сборки Windows через Electron Builder
- Локальное хранение истории, избранного и пользовательских настроек

## Архитектура

```text
React views и contexts
        │
        ├── Доменная логика Session / NPC / Loot
        ├── Пользовательские данные и контент-каталоги
        │
Electron shell
        ├── IPC handlers
        ├── Локальный REST API с аутентификацией
        └── SQLite-ресурсы и packaging
```

UI, генераторы, desktop-интеграция и доступ к данным находятся в отдельных модулях. Это позволяет развивать web- и desktop-поставку без концентрации всей логики в application shell.

## Стек

- React 18, TypeScript, Vite
- Tailwind CSS и компонентные CSS-стили
- Node.js и Express
- Electron и Electron Builder
- SQLite / better-sqlite3
- LocalStorage для пользовательских данных клиента

В актуальной закрытой версии также используется production-инфраструктура на базе Docker, Linux, nginx и VPS.

## Локальный запуск публичной версии

Потребуются Node.js **22.18+** (линия Node 22 используется в CI) и npm. Нативный модуль SQLite устанавливается через `postinstall`, поэтому при обычной установке не отключайте install-скрипты.

```bash
npm ci
npm run dev
```

Production-сборка:

```bash
npm run build
```

Electron-версия:

```bash
npm run electron
```

Часть desktop-ресурсов базы данных намеренно не включена в публичный срез. Доступные сценарии сборки и проверки перечислены в `package.json` и `scripts/`.

## Проверки перед изменениями

```bash
npm test
npm run build
```

| Команда | Что проверяет |
| --- | --- |
| `npm run test:storage` | Загрузку профиля и заметок, старый формат профиля, повреждённый JSON и недоступное хранилище |
| `npm run npc:test` | Smoke-запуск генератора NPC с выводом одного результата |
| `npm run typecheck` | Проверку TypeScript |
| `npm run build` | Проверку TypeScript и production-сборку интерфейса |

GitHub Actions выполняет `npm test` и сборку на Windows при push в `main` и для pull requests. Эти проверки не заменяют ручной запуск Electron с полным набором SQLite-ресурсов.

## Структура репозитория

```text
src/                 React-приложение и продуктовые представления
src/zernix/          Доменные модели, генераторы и отображение данных
electron/            Desktop shell, IPC, локальный API и SQLite
scripts/             Сборка, packaging, integrity- и smoke-проверки
database/            Реляционная модель и справочные SQL-запросы
docs/                Продуктовые и технические материалы
archive/             Сохранённый legacy UI, не подключённый к приложению
```

## Статус

- **Работающий продукт:** [zernix.ru](https://zernix.ru)
- **Публичный репозиторий:** портфолио-срез
- **Активная разработка:** закрытый репозиторий

Публичный код позволяет оценить раннюю архитектуру и развитие продукта. Production-конфигурация, credentials, развёртывание и текущая продуктовая работа остаются закрытыми.
