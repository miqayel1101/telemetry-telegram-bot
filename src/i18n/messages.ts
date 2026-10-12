import { LanguageEnum } from './language.enum';

// Armenian is the product's main language; the other two must have every key.
const hy = {
  // Errors and access
  errorLoad: 'Չհաջողվեց բեռնել տվյալները։ Փորձեք մի փոքր ուշ։',
  somethingWrong: 'Ինչ-որ բան սխալ գնաց։ Փորձեք ավելի ուշ։',
  vehicleGone: 'Այս մեքենան այլևս հասանելի չէ։',
  notLinked:
    'Ձեր Telegram-ը կապված չէ Telemetry-ին։ Միացրեք այն Telemetry-ի վահանակում՝ «Telegram» բաժնում։',
  notLinkedShort: 'Նախ միացրեք ձեր Telegram-ը Telemetry-ի վահանակում։',
  unknownAction: 'Անհայտ գործողություն',

  // Start and personal linking
  startLinked: 'Դուք միացված եք Telemetry-ին որպես {name}։ Բացեք /menu՝ մեքենաները տեսնելու համար։',
  startWelcome:
    'Բարի գալուստ Telemetry։ Միանալու համար բացեք Telemetry-ի վահանակը → «Telegram» → «Միացնել»։',
  linkOkNamed: 'Միացված է։ Բարի գալուստ, {name}։ Բացեք /menu՝ սկսելու համար։',
  linkOk: 'Միացված է։ Բացեք /menu՝ սկսելու համար։',
  linkExpired: 'Հղման ժամկետն անցել է։ Ստեղծեք նորը Telemetry-ի վահանակում։',
  linkUsed: 'Այս հղումն արդեն օգտագործվել է։',
  linkInvalid: 'Հղումն անվավեր է։ Ստեղծեք նորը Telemetry-ի վահանակում։',

  // Group linking
  groupOnly: 'Այս հրամանն աշխատում է միայն խմբում։',
  groupUsage:
    'Օգտագործում՝ /connect_group <կոդ>\nԿոդը ստեղծեք Telemetry-ի վահանակում՝ «Telegram» բաժնում։',
  groupNeedAdmin: 'Նախ ինձ դարձրեք այս խմբի ադմինիստրատոր, ապա կրկին ուղարկեք հրամանը։',
  groupOkNamed: 'Այս խումբն այժմ կստանա «{fleet}» ավտոպարկի ({company}) ահազանգերը։',
  groupOk: 'Այս խումբն այժմ կստանա ավտոպարկի ահազանգերը։',
  groupWrongPurpose: 'Այս կոդը խմբի համար չէ։ Ստեղծեք խմբի կոդ Telemetry-ի վահանակում։',
  groupNoFleet: 'Կոդին ավտոպարկ կցված չէ։ Ստեղծեք նորը Telemetry-ի վահանակում։',

  // Menu
  menuTitle: 'Ընտրեք՝',
  btnVehicles: 'Մեքենաներ',
  btnStatus: 'Ավտոպարկի վիճակը',
  btnBackMenu: '‹ Մենյու',
  btnBackVehicles: '‹ Մեքենաներ',
  btnBackVehicle: '‹ Մեքենա',
  btnPrev: '‹ Նախորդ',
  btnNext: 'Հաջորդ ›',
  btnRefresh: 'Թարմացնել',
  btnShowMap: 'Քարտեզի վրա',
  btnTodayTrip: 'Այսօրվա ուղևորությունը',
  btnShowLocation: '📍 Ցույց տալ քարտեզում',
  vehiclesNone: 'Մեքենաներ չեն գտնվել։',
  vehiclesTitle: 'Մեքենաներ ({from}–{to}՝ {total}-ից)՝',
  vehiclesFromStart: ' (սկզբից)',
  inactiveSuffix: ' (ոչ ակտիվ)',

  // Vehicle card
  vehicleTitle: 'Մեքենա՝ {plate}',
  speed: 'Արագություն՝ {speed} կմ/ժ',
  ignition: 'Վառոց՝ {state}',
  ignitionOn: 'միացված',
  ignitionOff: 'անջատված',
  ignitionUnknown: 'անհայտ',
  lastUpdate: 'Վերջին թարմացում՝ {time}',
  mapLink: '{plate} — քարտեզ՝ {url}',
  whereText: '{plate} — {speed} կմ/ժ\n{url}',

  // Fleet status
  statusFleet: 'Ավտոպարկ՝ {name}',
  statusAll: 'Բոլոր մեքենաները',
  statusTotal: 'Ընդամենը՝ {count}',
  statusOnline: 'Առցանց՝ {count}',
  statusOffline: 'Անցանց՝ {count}',
  statusAlerts: 'Ահազանգեր՝ {count}',

  // Today's trip
  tripTitle: 'Այսօրվա ուղևորությունները՝',
  tripTitlePlate: 'Այսօրվա ուղևորությունները՝ {plate}',
  tripDistance: 'Վազք՝ {km} կմ',
  tripDriving: 'Շարժման ժամանակ՝ {min} ր',
  tripStops: 'Կանգառներ՝ {count}',
  tripStart: 'Սկիզբ՝ {coords}',
  tripLast: 'Վերջին դիրք՝ {coords}',

  // Plate commands
  whereUsage: 'Օգտագործում՝ /where <պետհամարանիշ>',
  todayUsage: 'Օգտագործում՝ /today <պետհամարանիշ>',
  plateNotFound: '«{plate}» պետհամարանիշով մեքենա չի գտնվել։',

  // Help
  help:
    'Հրամաններ՝\n' +
    '/menu — մենյու\n' +
    '/vehicles — մեքենաների ցանկ\n' +
    '/where <պետհամարանիշ> — մեքենան քարտեզում\n' +
    '/status — ավտոպարկի վիճակը\n' +
    '/today <պետհամարանիշ> — այսօրվա ուղևորությունները\n' +
    '/language — բոտի լեզուն\n' +
    '/help — այս ցանկը',

  // Language
  languagePrompt: 'Ընտրեք բոտի լեզուն՝',
  languageSet: 'Լեզուն՝ հայերեն',
  languageAdminsOnly: 'Խմբի լեզուն կարող են փոխել միայն ադմինիստրատորները։',

  // Geofence alert
  geoTitle: 'Գեոզոնայի ահազանգ',
  geoVehicle: 'Մեքենա',
  geoZone: 'Գոտի',
  geoEvent: 'Իրադարձություն',
  geoEntered: 'Մտավ գոտի',
  geoExited: 'Դուրս եկավ գոտուց',
  geoDriver: 'Վարորդ',
  geoTime: 'Ժամ',

  // Driver billing alerts
  billOverdueTitle: 'Վճարումն ուշացել է',
  billDriver: 'Վարորդ',
  billVehicle: 'Մեքենա',
  billAmount: 'Գումար',
  billDate: 'Ամսաթիվ',
  billBlockedTitle: 'Մեքենան արգելափակված է',
  billBlockedReason: 'Պատճառ՝ ուշացած վճարում',
  billUnblockedTitle: 'Մեքենան ապաարգելափակված է',
  billUnblockedText: 'Մեքենան կրկին հասանելի է',
  billPaidTitle: 'Վճարումը ստացվել է',
  billPaidText: '{plate}-ը կրկին հասանելի է',

  // Bot command menu (the "/" list in Telegram)
  cmdMenu: 'Մենյու',
  cmdVehicles: 'Մեքենաների ցանկ',
  cmdStatus: 'Ավտոպարկի վիճակը',
  cmdWhere: 'Մեքենան քարտեզում',
  cmdToday: 'Այսօրվա ուղևորությունները',
  cmdLanguage: 'Բոտի լեզուն',
  cmdHelp: 'Օգնություն',
};

export type MessageKey = keyof typeof hy;

const ru: Record<MessageKey, string> = {
  errorLoad: 'Не удалось загрузить данные. Попробуйте чуть позже.',
  somethingWrong: 'Что-то пошло не так. Попробуйте позже.',
  vehicleGone: 'Этот автомобиль больше недоступен.',
  notLinked:
    'Ваш Telegram не подключён к Telemetry. Подключите его в панели Telemetry, раздел «Telegram».',
  notLinkedShort: 'Сначала подключите Telegram в панели Telemetry.',
  unknownAction: 'Неизвестное действие',

  startLinked: 'Вы подключены к Telemetry как {name}. Откройте /menu, чтобы увидеть автомобили.',
  startWelcome:
    'Добро пожаловать в Telemetry! Чтобы подключиться, откройте панель Telemetry → «Telegram» → «Подключить».',
  linkOkNamed: 'Подключено. Добро пожаловать, {name}! Откройте /menu, чтобы начать.',
  linkOk: 'Подключено. Откройте /menu, чтобы начать.',
  linkExpired: 'Срок ссылки истёк. Создайте новую в панели Telemetry.',
  linkUsed: 'Эта ссылка уже использована.',
  linkInvalid: 'Ссылка недействительна. Создайте новую в панели Telemetry.',

  groupOnly: 'Эта команда работает только в группе.',
  groupUsage:
    'Использование: /connect_group <код>\nКод создаётся в панели Telemetry, раздел «Telegram».',
  groupNeedAdmin: 'Сначала сделайте меня администратором группы, затем отправьте команду ещё раз.',
  groupOkNamed: 'Эта группа теперь получает тревоги автопарка «{fleet}» ({company}).',
  groupOk: 'Эта группа теперь получает тревоги автопарка.',
  groupWrongPurpose: 'Этот код не для группы. Создайте код группы в панели Telemetry.',
  groupNoFleet: 'К коду не привязан автопарк. Создайте новый в панели Telemetry.',

  menuTitle: 'Выберите:',
  btnVehicles: 'Автомобили',
  btnStatus: 'Состояние автопарка',
  btnBackMenu: '‹ Меню',
  btnBackVehicles: '‹ Автомобили',
  btnBackVehicle: '‹ Автомобиль',
  btnPrev: '‹ Назад',
  btnNext: 'Далее ›',
  btnRefresh: 'Обновить',
  btnShowMap: 'На карте',
  btnTodayTrip: 'Поездки за сегодня',
  btnShowLocation: '📍 Показать на карте',
  vehiclesNone: 'Автомобили не найдены.',
  vehiclesTitle: 'Автомобили ({from}–{to} из {total}):',
  vehiclesFromStart: ' (с начала)',
  inactiveSuffix: ' (неактивен)',

  vehicleTitle: 'Автомобиль: {plate}',
  speed: 'Скорость: {speed} км/ч',
  ignition: 'Зажигание: {state}',
  ignitionOn: 'включено',
  ignitionOff: 'выключено',
  ignitionUnknown: 'неизвестно',
  lastUpdate: 'Обновлено: {time}',
  mapLink: '{plate} — карта: {url}',
  whereText: '{plate} — {speed} км/ч\n{url}',

  statusFleet: 'Автопарк: {name}',
  statusAll: 'Все автомобили',
  statusTotal: 'Всего: {count}',
  statusOnline: 'Онлайн: {count}',
  statusOffline: 'Офлайн: {count}',
  statusAlerts: 'Тревоги: {count}',

  tripTitle: 'Поездки за сегодня:',
  tripTitlePlate: 'Поездки за сегодня: {plate}',
  tripDistance: 'Пробег: {km} км',
  tripDriving: 'В движении: {min} мин',
  tripStops: 'Остановки: {count}',
  tripStart: 'Начало: {coords}',
  tripLast: 'Последняя точка: {coords}',

  whereUsage: 'Использование: /where <госномер>',
  todayUsage: 'Использование: /today <госномер>',
  plateNotFound: 'Автомобиль с номером «{plate}» не найден.',

  help:
    'Команды:\n' +
    '/menu — меню\n' +
    '/vehicles — список автомобилей\n' +
    '/where <госномер> — автомобиль на карте\n' +
    '/status — состояние автопарка\n' +
    '/today <госномер> — поездки за сегодня\n' +
    '/language — язык бота\n' +
    '/help — этот список',

  languagePrompt: 'Выберите язык бота:',
  languageSet: 'Язык: русский',
  languageAdminsOnly: 'Язык группы могут менять только администраторы.',

  geoTitle: 'Тревога геозоны',
  geoVehicle: 'Автомобиль',
  geoZone: 'Зона',
  geoEvent: 'Событие',
  geoEntered: 'Въехал в зону',
  geoExited: 'Выехал из зоны',
  geoDriver: 'Водитель',
  geoTime: 'Время',

  billOverdueTitle: 'Платёж просрочен',
  billDriver: 'Водитель',
  billVehicle: 'Автомобиль',
  billAmount: 'Сумма',
  billDate: 'Дата',
  billBlockedTitle: 'Автомобиль заблокирован',
  billBlockedReason: 'Причина: просроченный платёж',
  billUnblockedTitle: 'Автомобиль разблокирован',
  billUnblockedText: 'Автомобиль снова доступен',
  billPaidTitle: 'Платёж получен',
  billPaidText: '{plate} снова доступен',

  cmdMenu: 'Меню',
  cmdVehicles: 'Список автомобилей',
  cmdStatus: 'Состояние автопарка',
  cmdWhere: 'Автомобиль на карте',
  cmdToday: 'Поездки за сегодня',
  cmdLanguage: 'Язык бота',
  cmdHelp: 'Помощь',
};

const en: Record<MessageKey, string> = {
  errorLoad: 'Couldn’t load the data. Try again in a moment.',
  somethingWrong: 'Something went wrong. Try again later.',
  vehicleGone: 'This vehicle is no longer available.',
  notLinked:
    'Your Telegram isn’t connected to Telemetry. Connect it in the Telemetry dashboard, under “Telegram”.',
  notLinkedShort: 'Connect your Telegram in the Telemetry dashboard first.',
  unknownAction: 'Unknown action',

  startLinked: 'You’re connected to Telemetry as {name}. Open /menu to see your vehicles.',
  startWelcome:
    'Welcome to Telemetry! To connect, open the Telemetry dashboard → “Telegram” → “Connect”.',
  linkOkNamed: 'Connected. Welcome, {name}! Open /menu to get started.',
  linkOk: 'Connected. Open /menu to get started.',
  linkExpired: 'This link has expired. Create a new one in the Telemetry dashboard.',
  linkUsed: 'This link has already been used.',
  linkInvalid: 'This link isn’t valid. Create a new one in the Telemetry dashboard.',

  groupOnly: 'This command works only in a group.',
  groupUsage:
    'Usage: /connect_group <code>\nCreate the code in the Telemetry dashboard, under “Telegram”.',
  groupNeedAdmin: 'Make me an admin of this group first, then send the command again.',
  groupOkNamed: 'This group now gets alerts for the fleet “{fleet}” ({company}).',
  groupOk: 'This group now gets the fleet’s alerts.',
  groupWrongPurpose: 'This code isn’t for a group. Create a group code in the Telemetry dashboard.',
  groupNoFleet: 'No fleet is attached to this code. Create a new one in the Telemetry dashboard.',

  menuTitle: 'Choose:',
  btnVehicles: 'Vehicles',
  btnStatus: 'Fleet status',
  btnBackMenu: '‹ Menu',
  btnBackVehicles: '‹ Vehicles',
  btnBackVehicle: '‹ Vehicle',
  btnPrev: '‹ Previous',
  btnNext: 'Next ›',
  btnRefresh: 'Refresh',
  btnShowMap: 'Show on map',
  btnTodayTrip: 'Today’s trips',
  btnShowLocation: '📍 Show on map',
  vehiclesNone: 'No vehicles found.',
  vehiclesTitle: 'Vehicles ({from}–{to} of {total}):',
  vehiclesFromStart: ' (from the start)',
  inactiveSuffix: ' (inactive)',

  vehicleTitle: 'Vehicle: {plate}',
  speed: 'Speed: {speed} km/h',
  ignition: 'Ignition: {state}',
  ignitionOn: 'on',
  ignitionOff: 'off',
  ignitionUnknown: 'unknown',
  lastUpdate: 'Last update: {time}',
  mapLink: '{plate} — map: {url}',
  whereText: '{plate} — {speed} km/h\n{url}',

  statusFleet: 'Fleet: {name}',
  statusAll: 'All vehicles',
  statusTotal: 'Total: {count}',
  statusOnline: 'Online: {count}',
  statusOffline: 'Offline: {count}',
  statusAlerts: 'Alerts: {count}',

  tripTitle: 'Today’s trips:',
  tripTitlePlate: 'Today’s trips: {plate}',
  tripDistance: 'Distance: {km} km',
  tripDriving: 'Driving time: {min} min',
  tripStops: 'Stops: {count}',
  tripStart: 'Start: {coords}',
  tripLast: 'Last position: {coords}',

  whereUsage: 'Usage: /where <plate>',
  todayUsage: 'Usage: /today <plate>',
  plateNotFound: 'No vehicle with plate “{plate}”.',

  help:
    'Commands:\n' +
    '/menu — menu\n' +
    '/vehicles — your vehicles\n' +
    '/where <plate> — vehicle on the map\n' +
    '/status — fleet status\n' +
    '/today <plate> — today’s trips\n' +
    '/language — bot language\n' +
    '/help — this list',

  languagePrompt: 'Choose the bot’s language:',
  languageSet: 'Language: English',
  languageAdminsOnly: 'Only group admins can change the group’s language.',

  geoTitle: 'Geofence alert',
  geoVehicle: 'Vehicle',
  geoZone: 'Zone',
  geoEvent: 'Event',
  geoEntered: 'Entered the zone',
  geoExited: 'Left the zone',
  geoDriver: 'Driver',
  geoTime: 'Time',

  billOverdueTitle: 'Payment overdue',
  billDriver: 'Driver',
  billVehicle: 'Vehicle',
  billAmount: 'Amount',
  billDate: 'Date',
  billBlockedTitle: 'Vehicle blocked',
  billBlockedReason: 'Reason: payment overdue',
  billUnblockedTitle: 'Vehicle unblocked',
  billUnblockedText: 'The vehicle is available again',
  billPaidTitle: 'Payment received',
  billPaidText: '{plate} is available again',

  cmdMenu: 'Menu',
  cmdVehicles: 'Your vehicles',
  cmdStatus: 'Fleet status',
  cmdWhere: 'Vehicle on the map',
  cmdToday: 'Today’s trips',
  cmdLanguage: 'Bot language',
  cmdHelp: 'Help',
};

export const MESSAGES: Record<LanguageEnum, Record<MessageKey, string>> = {
  [LanguageEnum.HY]: hy,
  [LanguageEnum.RU]: ru,
  [LanguageEnum.EN]: en,
};

export const LANGUAGE_LABELS: Record<LanguageEnum, string> = {
  [LanguageEnum.HY]: 'Հայերեն',
  [LanguageEnum.RU]: 'Русский',
  [LanguageEnum.EN]: 'English',
};
