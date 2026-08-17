/**
 * ZERNIX — mock "database" for browser/Vite when Electron loot-core IPC is unavailable.
 * Zero SQLite / external DB: plain JS arrays balanced by D&D 5.5 rarity tiers.
 *
 * Selection is level- and difficulty-aware:
 *   Lv 1–4   → Common / Uncommon
 *   Lv 5–8   → Uncommon / Rare
 *   Lv 9–12  → Rare / Very Rare
 *   Lv 13+   → Very Rare / Legendary
 *
 * Environment influences category weights (dungeon → weapons/armour, city → trinkets/scrolls,
 * wilderness → potions/survival, ruins → artefacts/magic weapons).
 *
 * Duplicate guard: last 6 generated names are excluded from the pool before rolling.
 */

const LATENCY_MS = 420;

async function delay(ms = LATENCY_MS) {
  await new Promise((r) => setTimeout(r, ms));
}

// ─── Item pool ────────────────────────────────────────────────────────────────

/** @type {ReadonlyArray<{ name: string; description: string; rarity: string; kind: string; env?: string[] }>} */
export const LOOT_DATASET = Object.freeze([

  // ── COMMON ──────────────────────────────────────────────────────────────────
  {
    name: "Зелье лечения",
    description: "Маленький флакон красной жидкости. Восстанавливает 2d4+2 хита. Пахнет вишнёвой смолой и чем-то едко-травяным.",
    rarity: "common", kind: "potion",
  },
  {
    name: "Свиток «Свет»",
    description: "Пергамент с заклинанием 0-го круга. Чернила светятся тусклым золотом в темноте. Работает однократно.",
    rarity: "common", kind: "scroll",
  },
  {
    name: "Амулет путника",
    description: "Потёртая медная монета, пробитая насквозь и нанизанная на льняную нить. Носитель знает направление на ближайшее жильё (пассивно).",
    rarity: "common", kind: "trinket",
  },
  {
    name: "Кремень и огниво (особое)",
    description: "Чёрный кремень с гравировкой саламандры. Высекает искру даже в шторм и под дождём. Ни разу не отказывало.",
    rarity: "common", kind: "gear", env: ["wild", "dungeon"],
  },
  {
    name: "Мешочек с солью архивариуса",
    description: "Соль с крупицами серебра. Оставляет порог, который нежить пересекает с нежеланием. Даёт помеху нежити при пересечении линии (1 раз).",
    rarity: "common", kind: "consumable",
  },
  {
    name: "Фляга с укрепляющим настоем",
    description: "Горьковатый травяной настой на спирту. Снимает усталость после 8-часового отдыха без костра. Трёхразовый.",
    rarity: "common", kind: "potion", env: ["wild"],
  },
  {
    name: "Свиток «Починка»",
    description: "Одноразовое заклинание 0-го круга. Восстанавливает небольшой неживой предмет до исходного вида. Пахнет нагретым металлом.",
    rarity: "common", kind: "scroll",
  },
  {
    name: "Монета с двумя орлами",
    description: "Загадочная золотая монета, обе стороны которой — орёл. Подходит для ставок, но никогда не даёт «решки».",
    rarity: "common", kind: "trinket",
  },
  {
    name: "Фонарь тени",
    description: "Медный фонарь, отбрасывающий тени в противоположную от источника света сторону. Практичен как сигнальный маяк.",
    rarity: "common", kind: "gear",
  },
  {
    name: "Перчатка гильдии воров (одна)",
    description: "Чёрная кожаная перчатка с металлической вышивкой. Вторая потеряна. Даёт +2 к проверкам Ловкости рук при краже мелких предметов.",
    rarity: "common", kind: "gear", env: ["city"],
  },

  // ── UNCOMMON ────────────────────────────────────────────────────────────────
  {
    name: "Кинжал эха",
    description: "Обсидиановый клинок с рукоятью из кости. Наносит удары бесшумно — без звука разрезаемого воздуха. +1 к броскам скрытности при атаке из укрытия.",
    rarity: "uncommon", kind: "weapon",
  },
  {
    name: "Плащ теней",
    description: "Ткань с вытканными лунными серпами. Владелец растворяется в тени когда стоит неподвижно — с помехой на проверки Внимательности противников.",
    rarity: "uncommon", kind: "armour",
  },
  {
    name: "Зелье храбрости гнома",
    description: "Тёмно-янтарная жидкость, пахнущая пивом и мятой. 1 час иммунитета к состоянию «испуг». Побочный эффект: неудержимое желание петь.",
    rarity: "uncommon", kind: "potion",
  },
  {
    name: "Свиток опознания",
    description: "Пергамент архмага Тариуса. Раскрывает все свойства одного магического предмета при зачтении вслух. Мерцает золотом при контакте с артефактом.",
    rarity: "uncommon", kind: "scroll",
  },
  {
    name: "Кольцо прыгуна",
    description: "Серебряное кольцо с выгравированным кузнечиком. 3 раза в день позволяет прыгнуть вдвое дальше обычного без проверки атлетики.",
    rarity: "uncommon", kind: "jewellery",
  },
  {
    name: "Перстень следопыта",
    description: "Потёртое бронзовое кольцо с вставкой из оникса. Подавляет звук шагов владельца по камню и грязи. Следопыты ценят его выше мечей.",
    rarity: "uncommon", kind: "jewellery", env: ["wild", "dungeon"],
  },
  {
    name: "Щит отражения (лёгкий)",
    description: "Небольшой деревянный щит, покрытый полированным оловом. Раз в день реакцией можно отразить магический снаряд обратно к цели (Lv 1–2).",
    rarity: "uncommon", kind: "armour",
  },
  {
    name: "Лоза путаницы",
    description: "Сухая лоза с рунами путаника. Брошенная на землю, создаёт область густого плюща 10 фт — труднопроходимая местность на 1 минуту.",
    rarity: "uncommon", kind: "consumable", env: ["wild", "dungeon"],
  },
  {
    name: "Карта мёртвых дорог",
    description: "Пожелтевший пергамент с маршрутами подземелий данного биома. Даёт преимущество на все проверки Навигации в подземельях региона.",
    rarity: "uncommon", kind: "gear", env: ["dungeon", "ruins"],
  },
  {
    name: "Пояс силы путника",
    description: "Широкий кожаный пояс с железными кольцами. Позволяет переносить вдвое больше веса. Незаменим при мародёрстве после боя.",
    rarity: "uncommon", kind: "gear",
  },
  {
    name: "Камень говорящего",
    description: "Тёплый голыш с оранжевым прожилком. Пара камней: слова, произнесённые над одним, слышны на другом в радиусе 300 фт.",
    rarity: "uncommon", kind: "gear", env: ["city", "dungeon"],
  },

  // ── RARE ────────────────────────────────────────────────────────────────────
  {
    name: "Клинок ордена Серого Рассвета",
    description: "Потёртый длинный меч с гравировкой рассветного солнца на лезвии. +1 к атаке и урону. Издаёт слабый белый свет при приближении нежити.",
    rarity: "rare", kind: "weapon",
  },
  {
    name: "Доспех тёмного леса",
    description: "Чешуйчатый доспех из иссиня-чёрных пластин. КД 15 + Лов (макс 2). Хамелеонный слой: 1/день преимущество на Скрытность в лесу или ночью.",
    rarity: "rare", kind: "armour", env: ["wild"],
  },
  {
    name: "Зелье великанской силы (каменный)",
    description: "Густая серая жидкость с крупицами кварца. На 1 час СИЛ становится 23. Вернувшись в норму, персонаж чувствует мучительную усталость.",
    rarity: "rare", kind: "potion",
  },
  {
    name: "Кольцо ментальной защиты",
    description: "Серебряный перстень с опаловой вставкой. Иммунитет к чтению мыслей и магическому допросу. Мысли владельца — его крепость.",
    rarity: "rare", kind: "jewellery",
  },
  {
    name: "Посох болотного огня",
    description: "Посох из чёрного дерева, оканчивающийся янтарным шаром. 7 зарядов. 1 заряд — «Поджог»; 3 заряда — «Огненный шар» СЛ 15. Восстанавливает 1d6+1 зарядов на рассвете.",
    rarity: "rare", kind: "weapon", env: ["dungeon", "ruins"],
  },
  {
    name: "Плащ летучей мыши",
    description: "Плащ из плотной ткани с вышивкой летучих мышей. 1/день: планировать как летучая мышь скорость 40 фт, 1 минута. Пахнет пещерами и старой кровью.",
    rarity: "rare", kind: "armour", env: ["dungeon"],
  },
  {
    name: "Ожерелье фаербола",
    description: "Нить из восьми красных рубиновых шаров. Каждый шар — один «Огненный шар» (8к6, СЛ 15). После использования всех шаров ожерелье рассыпается в пепел.",
    rarity: "rare", kind: "jewellery",
  },
  {
    name: "Зерцало истинного лица",
    description: "Ручное серебряное зеркало с рунической рамой. Показывает истинный облик смотрящего — без иллюзий, полиморфа и маскировки. Одноразовое.",
    rarity: "rare", kind: "gear", env: ["city", "ruins"],
  },
  {
    name: "Сапоги скалолаза",
    description: "Мягкие кожаные сапоги с шипами из паучьего шёлка. Карабканье по вертикальным поверхностям без проверки. Скорость карабканья равна скорости ходьбы.",
    rarity: "rare", kind: "gear", env: ["dungeon", "wild"],
  },
  {
    name: "Томик «Прочтения снов»",
    description: "Небольшая книга в переплёте из кожи базилиска. Прочтение за ночь: узнать одно событие прошлого в локации в радиусе 1 мили. Разовое использование.",
    rarity: "rare", kind: "scroll", env: ["ruins", "dungeon"],
  },

  // ── VERY RARE ───────────────────────────────────────────────────────────────
  {
    name: "Кровоклинок Веридиана",
    description: "Длинный меч с клинком из красного стекловидного металла. +2 к атаке и урону. При критическом ударе: цель получает дополнительно 3к6 некротического урона и не может восстанавливать хиты до начала следующего хода.",
    rarity: "very rare", kind: "weapon",
  },
  {
    name: "Доспех теней архимастера",
    description: "Пластинчатый доспех из смоляного металла. КД 18. Хозяин не оставляет магического следа. 1/день: стать невидимым на 1 минуту (бонусное действие).",
    rarity: "very rare", kind: "armour",
  },
  {
    name: "Посох семи дорог",
    description: "Посох из кристалла цвета радуги. 10 зарядов. Позволяет применять заклинания телепортации на один уровень выше без слота. Раз в неделю — «Размерные врата».",
    rarity: "very rare", kind: "weapon", env: ["ruins"],
  },
  {
    name: "Венец тёмного ясновидца",
    description: "Корона из тёмного железа с бриллиантом. Носитель видит невидимое в 30 фт, знает численность врагов в 60 фт (точно). 1/день: «Предвидение» на 1 минуту.",
    rarity: "very rare", kind: "jewellery",
  },
  {
    name: "Плащ звёздного охотника",
    description: "Плащ усыпан мерцающими точками — картой ночного неба. Носитель всегда знает своё местоположение. 1/день: переход в эфирный план на 1 раунд как бонусное действие.",
    rarity: "very rare", kind: "armour", env: ["wild"],
  },
  {
    name: "Кольцо трёх пожеланий (1 заряд)",
    description: "Платиновое кольцо, истёртое до блеска. Единственный оставшийся заряд позволяет произнести «Исполнение желаний» с точным исполнением буквального смысла слов. Кольцо рассыпается после.",
    rarity: "very rare", kind: "jewellery",
  },
  {
    name: "Клинок хаоса",
    description: "Кривой меч из осколков разных металлов. +2 к атаке. При попадании дополнительный урон k8 случайного типа (к6: 1-огонь, 2-холод, 3-кислота, 4-молния, 5-яд, 6-некротика). Владелец не знает заранее.",
    rarity: "very rare", kind: "weapon",
  },

  // ── LEGENDARY ───────────────────────────────────────────────────────────────
  {
    name: "Тьмогрыз — Меч поглощения",
    description: "Двуручный меч из антрацитового металла. +3 к атаке и урону. При попадании: поглощает одно заклинание активного заклинателя (СЛ 18 Спасброска Обаяние). Поглощённое заклинание может быть использовано владельцем один раз.",
    rarity: "legendary", kind: "weapon",
  },
  {
    name: "Доспех Последнего Дракона",
    description: "Драконья чешуя, вплавленная в мифриловую основу. КД 20. Иммунитет к огню. 3/день: 1 час устойчивость ко всем видам урона. Доспех тихо рычит в присутствии смертельной угрозы.",
    rarity: "legendary", kind: "armour",
  },
  {
    name: "Книга безликих имён",
    description: "Переплёт из живого дерева. Любое имя, записанное в книгу, становится изнаночным именем существа. Знатель его истинного имени получает преимущество на все проверки против существа и +5 к урону.",
    rarity: "legendary", kind: "gear", env: ["ruins", "dungeon"],
  },
  {
    name: "Скипетр семи печатей",
    description: "Кристаллический жезл с семью рубиновыми кольцами. Каждое кольцо — одно из заклинаний 9-го уровня, выбранных Мастером. Кольца не восстанавливаются. Жезл поёт при луне.",
    rarity: "legendary", kind: "weapon", env: ["ruins"],
  },
  {
    name: "Корона Первого Короля",
    description: "Потемневшее золото с гербом давно угасшей империи. Носитель: харизма 24, все разумные существа в 60 фт должны преодолеть СЛ 20 Мудрость или относиться к нему как к законному правителю.",
    rarity: "legendary", kind: "jewellery", env: ["ruins"],
  },

  // ── CONSUMABLES & SCROLLS (Any rarity mix) ─────────────────────────────────
  {
    name: "Порошок беззвучия",
    description: "Три пакетика мелкого серебряного песка. Рассыпанный в радиусе 10 фт создаёт зону тишины на 1 минуту. Невидим для обнаружения магии.",
    rarity: "uncommon", kind: "consumable",
  },
  {
    name: "Свиток «Воскрешение»",
    description: "Свиток в тубусе из кости единорога. Позволяет произнести заклинание «Воскрешение» единожды без компонентов. Тубус рассыпается в пыль при вскрытии.",
    rarity: "very rare", kind: "scroll",
  },
  {
    name: "Зелье невидимости",
    description: "Прозрачная жидкость, исчезающая из флакона ещё до открытия пробки. Невидимость на 1 час или до атаки/применения заклинания.",
    rarity: "rare", kind: "potion",
  },
  {
    name: "Таблетки мага-апотекаря",
    description: "Двенадцать сплющенных серых таблеток. Каждая восстанавливает 1 ячейку заклинания 1–3 уровня после 10-минутной паузы. Горькие, как сожаление.",
    rarity: "uncommon", kind: "potion",
  },
  {
    name: "Карманный портал (однократный)",
    description: "Шар из тёмного стекла, при ударе о стену создаёт проход 5×10 фт, ведущий в случайное место в 300 фт. Нестабильный — назад дороги нет.",
    rarity: "rare", kind: "gear",
  },

  // ── MUNDANE / TOOLS ─────────────────────────────────────────────────────────
  {
    name: "Инструменты взломщика (мастерские)",
    description: "Набор из семнадцати инструментов в кожаном чехле. Преимущество на проверки Использования инструментов взломщика при работе с замками до 4-го класса сложности.",
    rarity: "uncommon", kind: "gear", env: ["city", "dungeon"],
  },
  {
    name: "Арбалет разведчика",
    description: "Лёгкий ручной арбалет с системой автоперезарядки. 1к6 + Лов колющего. Не требует свободную руку для перезарядки. Тихий щелчок вместо треска.",
    rarity: "uncommon", kind: "weapon", env: ["wild", "dungeon"],
  },
  {
    name: "Боевой молот кузнечного братства",
    description: "Боевой молот, на головке которого выбит личный знак кузнеца Кварта из Железных Ворот. 1к8 дробящего. Позволяет ломать двери без проверки если двери деревянные.",
    rarity: "common", kind: "weapon",
  },
  {
    name: "Кожаный доспех авантюриста",
    description: "Ношеный КД 11+Лов, пропитанный воском от влаги. Внутри — тайный карман для одного предмета размером с колоду карт.",
    rarity: "common", kind: "armour",
  },
  {
    name: "Алхимический набор (походный)",
    description: "Двадцать пробирок, горелка и дистиллятор в компактном ящике. Преимущество на проверки Алхимии и Природы для идентификации веществ.",
    rarity: "uncommon", kind: "gear",
  },

  // ── TRINKETS & CURIOSITIES ──────────────────────────────────────────────────
  {
    name: "Куколка-предупреждение",
    description: "Соломенная фигурка с рыжим шнурком на шее. Тянет к себе взгляд, но никто не помнит, откуда она взялась. Мастер использует её как крючок для квеста.",
    rarity: "common", kind: "trinket",
  },
  {
    name: "Монета-маятник",
    description: "Зачернённый серебряный диск на цепочке. Раскручивается к северу или к ближайшей концентрации магии. Точность 70% на расстоянии до 200 фт.",
    rarity: "uncommon", kind: "trinket",
  },
  {
    name: "Перо архивариуса",
    description: "Перо из крыла грифона, не требующее чернил. Записывает слова правды — ложь невозможно написать этим пером физически.",
    rarity: "rare", kind: "trinket",
  },
  {
    name: "Колокольчик тревоги",
    description: "Маленький серебряный колокол, привязанный невидимой нитью к входу в локацию. Звенит в кармане хозяина при пересечении нити посторонним. Радиус 90 фт.",
    rarity: "uncommon", kind: "gear",
  },

  // ── COASTAL / SEA ───────────────────────────────────────────────────────────
  {
    name: "Компас штормового капитана",
    description: "Латунный компас с иглой, которая указывает не на север, а на ближайший безопасный берег. Работает даже под магическим туманом.",
    rarity: "uncommon", kind: "gear", env: ["coastal", "city"],
  },
  {
    name: "Сеть рыбака-заклинателя",
    description: "Сеть с серебряными узлами. Раз в день при забросе может поймать не рыбу, а «что-то, что не должно было всплыть» — Мастер решает.",
    rarity: "rare", kind: "gear", env: ["coastal"],
  },
  {
    name: "Якорь призрачной фрегаты",
    description: "Ржавый якорь, тяжелее, чем кажется. На цепи выгравированы имена экипажа, которого уже нет. +1 к проверкам при шторме.",
    rarity: "uncommon", kind: "gear", env: ["coastal"],
  },
  {
    name: "Солёная монета торговца",
    description: "Монета, покрытая коркой соли. Носитель знает направление на ближайший порт с гаванью (пассивно).",
    rarity: "common", kind: "trinket", env: ["coastal", "city"],
  },

  // ── MOUNTAIN / ARCTIC ───────────────────────────────────────────────────────
  {
    name: "Кошки альпиниста",
    description: "Стальные шипы для обуви. Преимущество на проверки Атлетики при карабканьи по льду и скалам.",
    rarity: "uncommon", kind: "gear", env: ["mountain", "arctic", "wild"],
  },
  {
    name: "Тёплый камень путника",
    description: "Гладкий обсидиан, тёплый на ощупь. Раз в день даёт сопротивление холоду на 8 часов.",
    rarity: "uncommon", kind: "trinket", env: ["arctic", "mountain"],
  },
  {
    name: "Ледяной кинжал",
    description: "Клинок из вечного льда, не тает в руке. +1 к атаке. При попадании +1d4 холодного урона.",
    rarity: "rare", kind: "weapon", env: ["arctic", "mountain"],
  },
  {
    name: "Карта горных перевалов",
    description: "Кожаная карта с пометками на дворфийском. Преимущество на Навигацию в горах региона.",
    rarity: "uncommon", kind: "gear", env: ["mountain", "wild"],
  },

  // ── SWAMP / WILDERNESS ──────────────────────────────────────────────────────
  {
    name: "Сапоги болотника",
    description: "Высокие резиновые сапоги с защитой от яда. Иммунитет к болотной лихорадке (не магической).",
    rarity: "uncommon", kind: "armour", env: ["swamp", "wild"],
  },
  {
    name: "Антидот болотной ведьмы",
    description: "Густая зелёная настойка. Снимает одно несмертельное отравление или болезнь.",
    rarity: "uncommon", kind: "potion", env: ["swamp", "wild"],
  },
  {
    name: "Посох корней",
    description: "Посох из переплетённых корней. 3 заряда «Entangle». Восстанавливает 1d3 заряда на рассвете в лесу или болоте.",
    rarity: "rare", kind: "weapon", env: ["swamp", "forest", "wild"],
  },
  {
    name: "Фонарь болотного огня",
    description: "Стеклянный колпак с бледным пламенем. Освещает 20 фт, не привлекает обычных насекомых, но виден fey-существам.",
    rarity: "uncommon", kind: "gear", env: ["swamp", "forest"],
  },

  // ── URBAN / CITY ────────────────────────────────────────────────────────────
  {
    name: "Перстень гильдии торговцев",
    description: "Золотой перстень с печатью. +2 к Убеждению при торге с членами гильдии.",
    rarity: "uncommon", kind: "jewellery", env: ["city", "urban"],
  },
  {
    name: "Ключ от чёрного хода",
    description: "Универсальный отмычный ключ для простых замков города. 3 использования, затем ломается.",
    rarity: "common", kind: "gear", env: ["city", "urban", "dungeon"],
  },
  {
    name: "Свиток «Обнаружение мыслей»",
    description: "Свиток 2-го круга в тубусе с восковой печатью. Одноразовое использование.",
    rarity: "rare", kind: "scroll", env: ["city", "urban"],
  },
]);

// ─── Gold scaling table (gp per player per level, by difficulty) ──────────────

/** @type {Record<string, number[]>} level index 0=Lv1, 19=Lv20 */
const GP_PER_PLAYER_BY_LEVEL = {
  low:      [8,  10, 15, 20, 35, 50, 75, 100, 130, 160, 200, 260, 320, 400, 480, 580, 680, 800, 950, 1100],
  moderate: [12, 18, 28, 40, 65, 90, 140, 190, 260, 340, 420, 540, 680, 820, 980, 1200, 1450, 1700, 2050, 2450],
  high:     [20, 32, 50, 80, 130, 200, 300, 420, 560, 720, 900, 1200, 1600, 2000, 2600, 3200, 4000, 5000, 6500, 8000],
};

/**
 * @param {number} partyLevel 1–20
 * @param {number} playerCount 1–8
 * @param {"low"|"moderate"|"high"} difficulty
 * @returns {string}
 */
function buildGoldLine(partyLevel, playerCount, difficulty) {
  const lvl = Math.max(1, Math.min(20, Math.floor(partyLevel)));
  const cnt = Math.max(1, Math.min(8, Math.floor(playerCount)));
  const diff = difficulty === "low" ? "low" : difficulty === "high" ? "high" : "moderate";
  const perPlayer = GP_PER_PLAYER_BY_LEVEL[diff][lvl - 1];
  const total = perPlayer * cnt;
  const platinum = Math.floor(total / 10);
  const gold = total % 10;
  const parts = [];
  if (platinum > 0) parts.push(`${platinum} пм`);
  if (gold > 0 || parts.length === 0) parts.push(`${gold} зм`);
  return `${parts.join(", ")} (ур. ${lvl}, ${cnt} игр., ${diff})`;
}

// ─── Type-ID → kind mapping (mirrors lootDbCategories.ts LOOT_TYPE_DB_KEYWORDS) ──

/**
 * Maps UI type IDs (from app-content.json loot.types[].id) to kind values used
 * in LOOT_DATASET. Empty selectedTypeIds = no filter.
 * @type {Record<string, string[]>}
 */
const TYPE_ID_TO_KINDS = {
  weapon:  ["weapon"],
  armor:   ["armour"],
  potion:  ["potion"],
  scroll:  ["scroll"],
  trinket: ["trinket"],
  misc:    ["jewellery", "gear", "consumable"],
};

/**
 * @param {string[]} selectedTypeIds
 * @returns {Set<string>|null} null = no filter (show all)
 */
function resolveAllowedKinds(selectedTypeIds) {
  if (!Array.isArray(selectedTypeIds) || selectedTypeIds.length === 0) return null;
  const kinds = new Set();
  for (const id of selectedTypeIds) {
    const ks = TYPE_ID_TO_KINDS[id];
    if (ks) {
      for (const k of ks) kinds.add(k);
    }
  }
  return kinds.size > 0 ? kinds : null;
}

// ─── Rarity tier selection ────────────────────────────────────────────────────

/** @returns {string[]} rarity keys by level, weighted toward level */
function rarityTiersForLevel(partyLevel) {
  const lv = Math.max(1, Math.min(20, partyLevel));
  if (lv <= 4)  return ["common", "common", "uncommon"];
  if (lv <= 8)  return ["common", "uncommon", "uncommon", "rare"];
  if (lv <= 12) return ["uncommon", "rare", "rare", "very rare"];
  if (lv <= 16) return ["rare", "very rare", "very rare", "legendary"];
  return ["very rare", "legendary", "legendary"];
}

/** high difficulty gives one extra step toward rarer */
function adjustTiersForDifficulty(tiers, difficulty) {
  if (difficulty !== "high") return tiers;
  const TIER_ORDER = ["common", "uncommon", "rare", "very rare", "legendary"];
  return tiers.map((t) => {
    const idx = TIER_ORDER.indexOf(t);
    return TIER_ORDER[Math.min(idx + 1, TIER_ORDER.length - 1)];
  });
}

// ─── Dedup guard ──────────────────────────────────────────────────────────────

/** @type {string[]} */
const recentNames = [];
const RECENT_WINDOW = 6;

function markUsed(name) {
  recentNames.push(name);
  if (recentNames.length > RECENT_WINDOW) recentNames.shift();
}

// ─── Core pick ───────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {number} opts.partyLevel
 * @param {number} opts.playerCount
 * @param {"low"|"moderate"|"high"} opts.difficulty
 * @param {string}  opts.environment   "ruins"|"dungeon"|"city"|"wild"|"any"
 * @param {boolean} [opts.onlyMagic]
 * @param {string[]} [opts.selectedTypeIds]  UI type IDs (weapon|armor|potion|scroll|trinket|misc)
 */
function pickItem({ partyLevel, playerCount, difficulty, environment, biomeId, onlyMagic, selectedTypeIds }) {
  const env = (environment || "any").toLowerCase();
  const magicKinds = new Set(["weapon", "armour", "jewellery", "trinket", "scroll", "potion"]);

  // Resolve category filter from selectedTypeIds
  const allowedKinds = resolveAllowedKinds(selectedTypeIds ?? []);

  let tiers = rarityTiersForLevel(partyLevel);
  tiers = adjustTiersForDifficulty(tiers, difficulty);
  const targetRarity = tiers[Math.floor(Math.random() * tiers.length)];

  /**
   * Applies all active filters to an item.
   * @param {boolean} withRarity
   * @param {boolean} withEnv
   * @param {boolean} withDedup
   */
  function matches(item, withRarity, withEnv, withDedup) {
    if (withRarity && item.rarity !== targetRarity) return false;
    // Category filter (selectedTypeIds) — highest priority guard
    if (allowedKinds && !allowedKinds.has(item.kind)) return false;
    // "Only magic" toggle additionally restricts to magic kinds
    if (onlyMagic && !magicKinds.has(item.kind)) return false;
    if (withDedup && recentNames.includes(item.name)) return false;
    if (withEnv && item.env && env !== "any") {
      const envMap = {
        ruins: ["ruins", "dungeon"],
        dungeon: ["dungeon", "ruins", "cave"],
        city: ["city", "urban"],
        urban: ["city", "urban"],
        wild: ["wild", "forest"],
        wilderness: ["wild", "forest"],
        forest: ["wild", "forest"],
        coastal: ["coastal", "wild", "city"],
        cave: ["cave", "dungeon", "ruins"],
        mountain: ["mountain", "wild", "cave"],
        arctic: ["arctic", "wild", "mountain"],
        swamp: ["swamp", "wild", "coastal"],
      };
      const lookupKey = String(biomeId || env).toLowerCase();
      const allowedEnvs = envMap[lookupKey] ?? envMap[env] ?? [env];
      if (!allowedEnvs.some((e) => item.env.includes(e))) {
        if (Math.random() > 0.30) return false;
      }
    }
    return true;
  }

  let pool = LOOT_DATASET.filter((item) => matches(item, true,  true,  true));
  if (pool.length === 0) pool = LOOT_DATASET.filter((item) => matches(item, true,  false, true));
  if (pool.length === 0) pool = LOOT_DATASET.filter((item) => matches(item, true,  false, false));
  if (pool.length === 0) pool = LOOT_DATASET.filter((item) => matches(item, false, false, false));
  if (pool.length === 0) pool = [...LOOT_DATASET];

  const item = pool[Math.floor(Math.random() * pool.length)];
  markUsed(item.name);
  return item;
}

// ─── Gold-only flavor ─────────────────────────────────────────────────────────

const GOLD_FLAVORS = [
  "Монеты звенят в ладони — холодное утешение тому, кто рассчитывал на большее.",
  "Тяжёлый кошель с монетами — след чужой удачи, которая закончилась здесь.",
  "Только металл: золото, серебро и горечь пустоты там, где могло быть нечто большее.",
  "Монеты разных эпох и чеканок — кто-то коллекционировал их не по желанию.",
  "Ни одного магического предмета — только честные монеты и запах чужого страха.",
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {object} [opts]
 * @param {number} [opts.partyLevel]
 * @param {number} [opts.playerCount]
 * @param {string} [opts.difficulty]
 * @param {string} [opts.environment]
 * @param {boolean} [opts.onlyMagic]
 * @param {string[]} [opts.selectedTypeIds]
 * @returns {Promise<{ name: string; description: string; rarity: string; kind: string; goldLine: string }>}
 */
export async function generateLootAsync(opts = {}) {
  await delay();
  const partyLevel = Math.max(1, Math.min(20, Number(opts.partyLevel ?? 5)));
  const playerCount = Math.max(1, Math.min(8, Number(opts.playerCount ?? 4)));
  const difficulty = ["low", "moderate", "high"].includes(opts.difficulty) ? opts.difficulty : "moderate";
  const environment = String(opts.environment ?? "any");
  const onlyMagic = Boolean(opts.onlyMagic);
  const selectedTypeIds = Array.isArray(opts.selectedTypeIds) ? opts.selectedTypeIds : [];

  const item = pickItem({ partyLevel, playerCount, difficulty, environment, biomeId: opts.biomeId, onlyMagic, selectedTypeIds });
  const goldLine = buildGoldLine(partyLevel, playerCount, difficulty);

  return { ...item, goldLine };
}

export async function generateNpcAsync() {
  await delay();
}

export async function generateSessionAsync() {
  await delay();
}
