---
title: Справочник API
description: Все маршруты Warpnet из event/paths.go, сгруппированные по областям, с видимостью, назначением и типами запроса и ответа.
---

# Справочник API {#api-reference}

На этой странице перечислены все маршруты, определенные в [`event/paths.go`](https://github.com/Warp-net/warpnet/blob/main/event/paths.go), сгруппированные по областям. Для каждого маршрута указаны видимость, что делает обработчик, и Go-типы тела запроса и ответа. Страница предназначена для разработчиков, которые пишут клиент или другой узел. Как отправить запрос, описано в разделах [Stream API](stream-API.md) и [WebSocket API](ws-API.md), а правила, стоящие за колонками, — в разделе [Протокол](../protocol.md).

## Как читать таблицы {#reading-the-tables}

- **Маршрут**: ID протокола libp2p. Каждый маршрут заканчивается на `/0.0.0`; ради ширины в таблицах этот суффикс опущен.
- **Доступ**: маршруты `private` обслуживаются только для самого узла и подключенных устройств, маршруты `public` — для любого пира, который прошел проверку подписи. См. [Приватные и публичные маршруты](../protocol.md#private-and-public-routes).
- **Запрос**: тип поля `body` конверта. Типы без пакета находятся в [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go), типы `domain.*` — в [`domain/`](https://github.com/Warp-net/warpnet/tree/main/domain). «нет» означает, что тело игнорируется; отправляйте `{}`.
- **Ответ**: JSON, который пишет обработчик. `Accepted` — это буквально `{"code":0,"message":"Accepted"}`. Любой маршрут может также ответить ошибкой `{"code":..., "message":...}`; см. [Ошибки](../protocol.md#errors-and-responses).
- Запросы с пагинацией принимают необязательные `cursor` и `limit`. Ответы возвращают следующий `cursor`, а значение `end` означает, что страниц больше нет.

Обработчики находятся в [`core/handler`](https://github.com/Warp-net/warpnet/tree/main/core/handler) и регистрируются в [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go). `event/paths.go` определяет 126 маршрутов, из них member-узел обслуживает 120. Остальные шесть, а также маршрут проверки модератора из `cmd/node/moderator/audit`, перечислены в разделе [Маршруты вне member-узла](#routes-outside-the-member-node).

## Узел и устройства {#node-and-devices}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/admin/pair` | private | Подключить устройство к этому узлу. Вызвать маршрут может любой пир; обработчик проверяет токен сессии и сохраняет peer ID вызывающего как подключенное устройство | `domain.AuthNodeInfo` (`token` обязателен) | `[]string`, multiaddr-адреса узла |
| `/private/get/admin/devices` | private | Список подключенных устройств без их токенов | нет | `GetDevicesResponse` |
| `/private/delete/admin/device` | private | Отключить устройство. Подключенное устройство может отключить только себя | `DeleteDeviceEvent` | `GetDevicesResponse` (оставшиеся устройства) |
| `/public/get/info` | public | Идентичность и состояние узла: тип, владелец, версия, адреса, достижимость, состояние relay, обслуживаемые протоколы, подключенные алиасы. Кроме того, передает вызывающего в [обнаружение пиров](../discovery.md#inbound-info-requests) | нет | `warpnet.NodeInfo` |
| `/private/get/admin/stats` | private | Метрики узла для панели управления: трафик, пиры онлайн и сохраненные, статистика базы данных, памяти и CPU | нет | `warpnet.NodeMetrics` |
| `/private/get/admin/rating` | private | Что сеть говорит об этом узле | нет | `domain.NodeRating` |
| `/public/get/admin/rating` | public | Публичное представление этого узла о рейтинге пира (медиана оценок его наблюдателей). Пустой `node_id` возвращает собственный рейтинг этого узла | `GetRatingEvent` | `domain.NodeRating` |

## Посты и лента {#tweets-and-timeline}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/timeline` | private | Домашняя лента из локального хранилища | `GetTimelineEvent` | `TweetsResponse` |
| `/private/post/tweet` | private | Опубликовать пост от имени владельца: сохранить его, добавить в ленту и разослать подписчикам через gossip. Пост с родителем проходит по сценарию ответа | `NewTweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/private/post/tweet/edit` | private | Отредактировать один из постов владельца. Правка ответа также пересылается на узел автора родительского поста | `EditTweetEvent` | `domain.Tweet` |
| `/private/delete/tweet` | private | Удалить один из постов или ответов владельца; подписчики получают удаление через gossip | `DeleteTweetEvent` | `Accepted` |
| `/private/post/import/twitter/tweet` | private | Импортировать один исходный пост из архива X; браузер распаковывает архив и отправляет посты по одному | `ImportTweetEvent` | `ImportTwitterArchiveResponse` |
| `/public/post/timeline` | public | Доставка нового поста автора, на которого есть подписка, обычно из gossip-топика `user-update-<userId>` | `NewTweetEvent` | `domain.Tweet` или `Accepted` |
| `/public/delete/timeline` | public | Доставка удаления от автора, на которого есть подписка | `DeleteTweetEvent` | `Accepted` |
| `/public/get/tweet` | public | Один пост из локального хранилища или с узла автора. Платный (спонсорский) пост возвращается как тизер без содержимого | `GetTweetEvent` | `domain.Tweet` |
| `/public/get/tweets` | public | Посты пользователя; если задан `root_id` — ответы в этом треде | `GetAllTweetsEvent` | `TweetsResponse` |
| `/public/get/tweetstats` | public | Счетчики поста (ретвиты, реакции по каждому эмодзи, ответы, просмотры) и собственная реакция владельца | `GetTweetStatsEvent` | `TweetStatsResponse` |
| `/public/post/reply` | public | Опубликовать ответ; сохраняется на узле отвечающего и на узле автора родительского поста | `NewTweetEvent` | `domain.Tweet` |
| `/public/post/reply/edit` | public | Правка автора ответа; применяется к копии, которую хранит узел автора родительского поста | `EditTweetEvent` | `Accepted` |
| `/public/delete/reply` | public | Удаление от автора ответа; применяется к копии, которую хранит узел автора родительского поста | `DeleteTweetEvent` | `Accepted` |
| `/public/post/retweet` | public | Ретвит; записывается локально и на узле автора | `NewRetweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/public/post/unretweet` | public | Отменить ретвит | `UnretweetEvent` | `Accepted` |
| `/public/post/pin` | public | Закрепить пост в профиле его автора; это может сделать только узел автора | `PinTweetEvent` | `domain.Tweet` |
| `/public/post/unpin` | public | Открепить его | `UnpinTweetEvent` | `domain.Tweet` |

## Реакции, просмотры и опросы {#reactions-views-and-polls}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/react` | public | Отреагировать на пост эмодзи (реакция по умолчанию, если `emoji` пуст); пересылается на узел автора, который уведомляет автора | `ReactionEvent` | `ReactionsCountResponse` |
| `/public/post/unreact` | public | Убрать реакцию | `UnreactionEvent` | `ReactionsCountResponse` |
| `/public/post/view` | public | Засчитать просмотр поста | `ViewEvent` | `ViewsCountResponse` |
| `/public/get/tweet/reactors` | public | Пользователи, которые отреагировали на пост | `GetTweetReactorsEvent` | `UsersResponse` |
| `/public/get/tweet/retweeters` | public | Пользователи, которые ретвитнули пост | `GetTweetRetweetersEvent` | `UsersResponse` |
| `/private/get/reactions` | private | Посты, на которые реагировал владелец, сначала новые, в виде ссылок; полные посты загружаются через `/public/get/tweet` | `GetReactionsEvent` | `GetReactionsResponse` |
| `/public/post/poll/vote` | public | Проголосовать в опросе поста | `PollVoteEvent` | `PollResultsResponse` |
| `/public/get/poll` | public | Результаты опроса, подсчитанные на узле автора; на вопрос «голосовал ли я» узел отвечает локально | `GetPollEvent` | `PollResultsResponse` |

## Подписки и доверие {#follows-and-trust}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/follow` | public | Подписаться на пользователя: записать подписку, подписаться на его gossip-топик и уведомить его узел | `NewFollowEvent` | `Accepted` |
| `/public/post/unfollow` | public | Отписаться и отменить подписку на топик | `NewUnfollowEvent` | `Accepted` |
| `/public/post/isfollowing` | public | Подписан ли владелец этого узла на `user_id` | `GetIsFollowingEvent` | `IsFollowingResponse` |
| `/public/post/isfollower` | public | Подписан ли `user_id` на владельца этого узла | `GetIsFollowerEvent` | `IsFollowerResponse` |
| `/public/get/followers` | public | Подписчики пользователя; если это не владелец, список запрашивается у узла этого пользователя | `GetFollowersEvent` | `FollowersResponse` |
| `/public/get/followings` | public | На кого подписан пользователь; `is_mutual_only` ограничивает список владельца теми, кто подписан в ответ | `GetFollowingsEvent` | `FollowingsResponse` |
| `/private/get/follow/requests` | private | Ожидающие запросы на подписку для закрытого аккаунта | `GetFollowRequestsEvent` | `GetFollowRequestsResponse` |
| `/private/post/follow/request/authorize` | private | Принять запрос на подписку | `FollowRequestActionEvent` | `Accepted` |
| `/private/post/follow/request/reject` | private | Отклонить запрос на подписку | `FollowRequestActionEvent` | `Accepted` |
| `/private/get/trust` | private | Где указанные пользователи находятся в [круге доверия](../trust-circle.md) владельца; ответ берется из памяти. Только в ветке develop, в релиз еще не вошло ([`core/handler/trust.go`](https://github.com/Warp-net/warpnet/blob/develop/core/handler/trust.go)) | `GetTrustEvent` | `GetTrustResponse` |

> **Примечание:** Маршруты запросов на подписку обслуживают очередь ожидающих запросов, но пока ни один путь в коде узла не добавляет в нее запросы, поэтому сейчас список всегда пуст.
{: .note }

## Пользователи {#users}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/get/user` | public | Профиль. Профиль владельца приходит со счетчиками постов, подписчиков и подписок; остальные берутся из локального хранилища или запрашиваются с их узла (`node_id` — необязательная подсказка) | `GetUserEvent` | `domain.User` |
| `/private/get/user/status` | private | В сети ли пользователь сейчас: опрашивает его узел и обновляет `last_seen` | `GetUserEvent` | `UserStatusResponse` |
| `/public/get/users` | public | Пользователи, известные этому узлу. В фоне список обновляется с узла `user_id` или со шлюза Fediverse, если `user_id` — это владелец | `GetAllUsersEvent` | `UsersResponse` |
| `/public/get/users/search` | public | Поиск среди пользователей, известных этому узлу | `SearchUsersEvent` | `UsersResponse` |
| `/public/get/whotofollow` | public | Рекомендации, на кого подписаться, с отдельной страницей для каждой сети, подключенной через мост | `GetWhoToFollowEvent` | `WhoToFollowResponse` |
| `/private/post/user` | private | Обновить профиль владельца | `NewUserEvent` (`domain.User`) | `domain.User` |
| `/private/post/subscribe/user` | private | Получать уведомление о каждом новом посте этого пользователя | `SubscribeUserEvent` | `Accepted` |
| `/private/post/unsubscribe/user` | private | Перестать получать эти уведомления | `UnsubscribeUserEvent` | `Accepted` |

## Чаты {#chats}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/chat` | public | Создать чат с другим пользователем; чат создается и на его узле | `NewChatEvent` | `domain.Chat` |
| `/public/post/message` | public | Отправить сообщение; сохраняется локально и доставляется на узел другого пользователя | `NewMessageEvent` (`domain.ChatMessage`) | `domain.ChatMessage` |
| `/private/get/chat` | private | Один чат | `GetChatEvent` | `domain.Chat` |
| `/private/get/chats` | private | Чаты владельца | `GetAllChatsEvent` | `ChatsResponse` |
| `/private/delete/chat` | private | Удалить чат локально | `DeleteChatEvent` | `Accepted` |
| `/private/get/message` | private | Одно сообщение | `GetMessageEvent` | `domain.ChatMessage` |
| `/private/get/messages` | private | Сообщения чата | `GetAllMessagesEvent` | `ChatMessagesResponse` |
| `/private/delete/message` | private | Удалить сообщение локально | `DeleteMessageEvent` | `Accepted` |

## Медиа {#media}

Изображения передаются строками вида `"<mime type>,<base64>"`, видео — строками base64, и все это внутри JSON. У маршрутов загрузки и медиа увеличенные лимиты размера; см. [Лимиты размера](../protocol.md#size-limits-and-timeouts).

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/image` | private | Загрузить до четырех изображений; возвращает их ключи | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/image` | public | Изображение по владельцу и ключу, из локального хранилища или с узла владельца | `GetImageEvent` | `GetImageResponse` |
| `/private/post/video` | private | Загрузить видео | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/video` | public | Видео по владельцу и ключу, из локального хранилища или с узла владельца. С `deferred` узел отвечает только размером локально сохраненной копии или `deferred: true` без файла и сам видео не загружает | `GetVideoEvent` | `GetVideoResponse` |
| `/private/post/chat/image` | private | Загрузить изображения для чата (хранилище отдельно от публичных медиа) | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/chat/image` | public | Изображение из чата | `GetImageEvent` | `GetImageResponse` |
| `/private/post/chat/video` | private | Загрузить видео для чата | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/chat/video` | public | Видео из чата | `GetVideoEvent` | `GetVideoResponse` |

## Уведомления {#notifications}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/notifications` | private | Уведомления владельца с числом непрочитанных | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/pushes` | private | Тот же список, прочитанный от курсора в обратном направлении; используется Android-клиентом | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/notification` | private | Одно уведомление | `GetNotificationEvent` | `domain.Notification` |
| `/private/post/notification/read` | private | Отметить одно уведомление прочитанным | `MarkNotificationReadEvent` | `Accepted` |
| `/private/post/notifications/read` | private | Отметить все уведомления прочитанными | нет | `Accepted` |

## Настройки {#settings}

Настройки сети, шлюза, ограничения частоты запросов и кошелька хранятся в базе данных узла и читаются при его запуске.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/settings/notification` | private | Настройки уведомлений по email (SMTP, получатель, переключатели по типам) | нет | `domain.NotificationSettings` |
| `/private/post/settings/notification` | private | Сохранить их | `domain.NotificationSettings` | `domain.NotificationSettings` |
| `/private/get/settings/gateway` | private | Peer ID узла шлюза Fediverse (пустое значение означает встроенный шлюз по умолчанию) | нет | `domain.GatewaySettings` |
| `/private/post/settings/gateway` | private | Сохранить его | `domain.GatewaySettings` | `domain.GatewaySettings` |
| `/private/get/settings/ratelimit` | private | Лимиты соединений и ограничения частоты для обнаружения и потоков, с подставленными значениями по умолчанию | нет | `ratelimit.Settings` |
| `/private/post/settings/ratelimit` | private | Сохранить их | `ratelimit.Settings` | `ratelimit.Settings` |
| `/private/get/settings/network` | private | Адреса для прослушивания, порт и список bootstrap | нет | `domain.NetworkSettings` |
| `/private/post/settings/network` | private | Сохранить их | `domain.NetworkSettings` | `domain.NetworkSettings` |
| `/private/get/settings/wallet` | private | Эндпоинт API блокчейна и путь к платежному движку | нет | `domain.WalletSettings` |
| `/private/post/settings/wallet` | private | Сохранить их | `domain.WalletSettings` | `domain.WalletSettings` |
| `/private/get/settings/sponsored` | private | Минимальный стейк TRX, который нужен покупателю, чтобы купить спонсорские посты владельца | нет | `domain.SponsoredSettings` |
| `/private/post/settings/sponsored` | private | Сохранить его | `domain.SponsoredSettings` | `domain.SponsoredSettings` |

`ratelimit.Settings` определен в [`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go).

## Фильтры, блокировки и игнорирование {#filters-blocks-and-mutes}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/settings/filter` | private | Один фильтр контента | `GetFilterEvent` | `domain.Filter` |
| `/private/get/settings/filters` | private | Все фильтры контента | `GetFiltersEvent` | `GetFiltersResponse` |
| `/private/post/settings/filter` | private | Создать фильтр | `NewFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/post/settings/filter/update` | private | Изменить фильтр | `UpdateFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/delete/settings/filter` | private | Удалить фильтр | `DeleteFilterEvent` | `Accepted` |
| `/private/post/settings/filter/keyword` | private | Добавить ключевое слово в фильтр | `AddFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/post/settings/filter/keyword/update` | private | Изменить ключевое слово | `UpdateFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/delete/settings/filter/keyword` | private | Удалить ключевое слово | `DeleteFilterKeywordEvent` | `Accepted` |
| `/private/post/settings/block` | private | Заблокировать пользователя; его узел попадает в блок-лист пиров (кроме пользователей из мостов) | `BlockEvent` | `Accepted` |
| `/private/post/settings/unblock` | private | Разблокировать пользователя и убрать его узел из блок-листа | `UnblockEvent` | `Accepted` |
| `/private/get/settings/blocks` | private | ID заблокированных пользователей | `GetBlocksEvent` | `GetBlocksResponse` |
| `/private/post/settings/mute` | private | Игнорировать пользователя | `MuteEvent` | `Accepted` |
| `/private/post/settings/unmute` | private | Перестать игнорировать | `UnmuteEvent` | `Accepted` |
| `/private/get/settings/mutes` | private | ID игнорируемых пользователей | `GetMutesEvent` | `GetMutesResponse` |

## Закладки {#bookmarks}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/bookmark` | private | Добавить пост в закладки | `BookmarkEvent` | `Accepted` |
| `/private/post/unbookmark` | private | Удалить закладку | `UnbookmarkEvent` | `Accepted` |
| `/private/get/bookmarks` | private | Закладки в виде ссылок; полные посты загружаются через `/public/get/tweet` | `GetBookmarksEvent` | `GetBookmarksResponse` |

## Модерация {#moderation}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/report` | public | Пожаловаться на пост или пользователя. Вызвать маршрут может только владелец узла; узел публикует жалобу в `/warpnet/reports/1.0.0` | `ReportEvent` | `Accepted` |
| `/public/post/moderate/result` | public | Применить вердикт модератора, который обычно приходит через gossip-топик автора. Проверяются подпись вердикта и кворум подписанных голосов | `ModerationVerdictEvent` | `Accepted` |

Полное описание процесса — в разделе [Модерация](../moderation.md).

## Кошелек {#wallet}

У узла есть встроенный кошелек в сети TRON, выведенный из идентичности владельца. Он используется для переводов и спонсорских постов. С блокчейном кошелек работает через локальный платежный движок.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/wallet` | private | Адрес, балансы, состояние стейкинга и сеть | нет | `WalletResponse` |
| `/private/get/wallet/address` | private | Собственный адрес и токен владельца | нет | `WalletOwnAddressResponse` |
| `/private/get/wallet/history` | private | Последние переводы | `WalletEvent` | `WalletHistoryResponse` |
| `/private/get/wallet/key` | private | Экспортировать закрытый ключ кошелька | нет | `WalletKeyResponse` |
| `/private/get/wallet/contacts` | private | Адреса кошельков пользователей, на которых подписан владелец | `WalletContactsEvent` | `WalletContactsResponse` |
| `/private/post/wallet/send` | private | Отправить средства | `WalletSendEvent` | `WalletSendResponse` |
| `/private/post/wallet/stake` | private | Застейкать TRX | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/unstake` | private | Начать вывод TRX из стейкинга | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/withdraw` | private | Вывести TRX, которые вышли из стейкинга и стали доступны | нет | `WalletStakeResponse` |
| `/public/get/wallet/address` | public | Другой узел спрашивает, куда платить владельцу этого узла; запрос отклоняется, если вызывающий исчерпал часовой лимит заказов | `WalletAddressEvent` | `WalletAddressResponse` |

## Спонсорские посты {#sponsored-tweets}

У спонсорского поста есть цена. Остальные пользователи видят тизер. Покупатель платит автору через кошелек и затем получает полное содержимое, причем копии медиа создаются отдельно для этого покупателя.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/sponsored/tweet` | private | Опубликовать платный пост от имени владельца (не ответ) | `NewTweetEvent` с `price` | `domain.Tweet` |
| `/private/get/sponsored/quote` | private | Цена, комиссии и сетевые расходы на покупку спонсорского поста | `GetOrderQuoteEvent` | `OrderQuoteResponse` |
| `/private/post/sponsored/order` | private | Купить спонсорский пост: открыть заказ и оплатить | `NewOrderEvent` | `OrderResponse` |
| `/public/post/sponsored/order` | public | Узел покупателя просит узел автора проверить оплату | `VerifyOrderEvent` | `OrderResponse` |
| `/public/get/sponsored/tweet` | public | Полный пост для подтвержденного покупателя; собственный узел автора возвращает его в том виде, в каком он хранится | `GetTweetEvent` | `domain.Tweet` или `OrderResponse`, пока оплата не подтверждена |
| `/public/get/sponsored/image` | public | Изображение купленного спонсорского поста | `GetImageEvent` | `GetImageResponse` |
| `/public/get/sponsored/video` | public | Видео купленного спонсорского поста | `GetVideoEvent` | `GetVideoResponse` |
| `/private/get/sponsored/buyer` | private | Сопоставить утекший файл с проданными копиями, чтобы выяснить, от какого покупателя он ушел | `GetCopyBuyerEvent` | `CopyBuyerResponse` |

## Маршруты вне member-узла {#routes-outside-the-member-node}

| Маршрут | Кто обслуживает | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/login` | desktop-приложение, мост `/ws` удаленного узла | Войти, вывести идентичность и запустить узел. Никогда не передается через libp2p | `LoginEvent` | `domain.AuthNodeInfo` |
| `/private/post/logout` | desktop-приложение, мост `/ws` удаленного узла | Выйти. Никогда не передается через libp2p | `LogoutEvent` или `{}` | `["logged_out"]` |
| `/private/get/update` | только desktop-приложение | Ожидающее самообновление, если оно есть | нет | `domain.UpdateInfo` |
| `/private/post/update` | только desktop-приложение | Разрешить или отклонить ожидающее обновление | `UpdateEvent` | `Accepted` |
| `/public/post/relay/refuse/reservation` | relay-узлы | Узел с резервацией просит relay-узел больше не соединять с ним определенного пира | `RefuseReservationEvent` | `Accepted` |
| `/public/get/moderate/challenge` | узлы-модераторы | Выборочная проверка (аудит) одного модератора другим | `audit.Challenge` | `audit.ChallengeResponse` |
| `/public/post/admin/challenge` | никто | Маршрут определен и имеет ограничение частоты, но обработчик не зарегистрирован | | |

Типы аудита модераторов находятся в [`cmd/node/moderator/audit/wire.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/moderator/audit/wire.go).

## Добавление маршрута {#adding-a-route}

Новые маршруты строятся по одной схеме: константа в `event/paths.go`, типы запроса и ответа в `event/event.go`, фабрика обработчика в `core/handler`, регистрация в member-узле и зеркальные изменения в клиентах. Чек-лист — в [руководстве разработчика](index.md).

## См. также {#see-also}

- [Протокол](../protocol.md): конверты, подписи, ошибки, лимиты
- [Stream API](stream-API.md): вызов маршрутов через libp2p
- [WebSocket API](ws-API.md): вызов маршрутов через мост панели управления удаленного узла
- [Клиенты](clients.md): как desktop-, браузерный и мобильные клиенты обращаются к этим маршрутам
