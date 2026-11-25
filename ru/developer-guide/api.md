---
title: Справочник API
description: Маршруты, которые обслуживают узлы Warpnet, сгруппированные по областям, с видимостью, назначением и типами запроса и ответа, которые декодирует и возвращает каждый обработчик.
---

# Справочник API {#api-reference}

На этой странице перечислены маршруты, которые обслуживают узлы Warpnet, сгруппированные по областям. Для каждого маршрута указаны видимость, что делает обработчик, и Go-типы тела запроса, которое он декодирует, и ответа, который он возвращает. Страница предназначена для разработчиков, которые пишут клиент или другой узел. Как отправить запрос, описано в разделах [Stream API](stream-API.md) и [WebSocket API](ws-API.md), а правила, стоящие за колонками, — в разделе [Протокол](../protocol.md).

## Как читать таблицы {#reading-the-tables}

- **Маршрут**: ID протокола libp2p. Каждый маршрут заканчивается на `/0.0.0`; ради ширины в таблицах этот суффикс опущен. Константы находятся в [`event/paths.go`](https://github.com/Warp-net/warpnet/blob/main/event/paths.go).
- **Доступ**: маршруты `private` обслуживаются только для самого узла и подключенных к нему устройств, маршруты `public` — для любого пира, чья подпись запроса прошла проверку. См. [Приватные и публичные маршруты](../protocol.md#private-and-public-routes).
- **Запрос**: тип, который обработчик декодирует из поля `body` конверта. Типы без пакета находятся в [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go), типы `domain.*` — в [`domain/`](https://github.com/Warp-net/warpnet/tree/main/domain). Многие типы событий — псевдонимы типов из `domain`; такой тип указан в скобках. «нет» означает, что обработчик не читает тело; отправляйте `{}`.
- **Ответ**: то, что возвращает обработчик. `Accepted` — это буквально `{"code":0,"message":"Accepted"}`. Любой маршрут может также ответить объектом ошибки `{"code":..., "message":...}`; см. [Ошибки](stream-API.md#errors).
- Запросы с пагинацией принимают необязательные `cursor` и `limit`. Ответы возвращают следующий `cursor`, а значение `end` означает, что страниц больше нет.

Обработчики member-узла находятся в [`core/handler`](https://github.com/Warp-net/warpnet/tree/main/core/handler) и регистрируются в [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go). Страница описывает 120 маршрутов: 114 обслуживает member-узел через libp2p, четыре обрабатывают desktop-приложение или мост удаленного узла еще до того, как запрос попадает в libp2p, один обслуживают relay-узлы и один — узлы-модераторы. Последние шесть перечислены в разделе [Маршруты вне member-узла](#routes-outside-the-member-node).

## Узел и устройства {#node-and-devices}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/admin/pair` | private | Подключить устройство к этому узлу. Единственный приватный маршрут, который может вызвать любой пир: обработчик проверяет токен сессии из QR-кода сопряжения и сохраняет peer ID вызывающего как подключенное устройство | `domain.AuthNodeInfo` (`token` обязателен) | `[]string`, multiaddr-адреса узла |
| `/private/get/admin/devices` | private | Подключенные устройства без их токенов | нет | `GetDevicesResponse` |
| `/private/delete/admin/device` | private | Отключить устройство. Подключенное устройство может отключить только себя | `DeleteDeviceEvent` | `GetDevicesResponse` (оставшиеся устройства) |
| `/public/get/info` | public | Тип узла, владелец, версия, адреса, достижимость, состояние relay, обслуживаемые протоколы и подключенные устройства. На member- и relay-узлах вызывающий также передается в [обнаружение пиров](../discovery.md#inbound-info-requests). Обслуживается узлами всех типов | нет | `warpnet.NodeInfo` |
| `/private/get/admin/stats` | private | Метрики узла для панели управления: трафик, пиры онлайн и сохраненные, статистика базы данных, памяти и CPU | нет | `warpnet.NodeMetrics` |
| `/private/get/admin/rating` | private | [Рейтинг](../rating.md) этого узла в том виде, в каком его записывают другие узлы | нет | `GetRatingResponse` (`domain.NodeRating`) |

## Посты и лента {#tweets-and-timeline}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/timeline` | private | Домашняя лента из локального хранилища | `GetTimelineEvent` | `TweetsResponse` |
| `/private/post/tweet` | private | Опубликовать пост от имени владельца: сохранить его, добавить в ленту и опубликовать в gossip-топике владельца `user-update-<userId>`. Пост с `parent_id` — это ответ: он сохраняется локально и отправляется на узел автора родительского поста через `/public/post/reply`. Платный пост здесь отклоняется | `NewTweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/private/post/tweet/edit` | private | Изменить текст одного из постов или ответов владельца; спонсорский пост изменить нельзя. Предыдущий текст сохраняется как запись о правке, существующие ретвиты поста отменяются, а правка ответа уходит на узел автора родительского поста через `/public/post/reply/edit` | `EditTweetEvent` | `EditTweetResponse` (`domain.Tweet`) |
| `/private/delete/tweet` | private | Удалить пост из локального хранилища. Для собственного поста владельца подписчики получают удаление через gossip-топик. С `parent_id` или `root_id` удаляется ответ (собственный ответ владельца или любой ответ в треде владельца); удаление собственного ответа пересылается на узел автора родительского поста через `/public/delete/reply` | `DeleteTweetEvent` | `Accepted` |
| `/private/post/import/twitter/tweet` | private | Импортировать один исходный пост из архива X. Клиент распаковывает архив и отправляет посты по одному; фотографии проходят тот же конвейер, что и при загрузке | `ImportTweetEvent` | `ImportTwitterArchiveResponse` |
| `/public/post/timeline` | public | Новый пост автора, на которого есть подписка, доставленный из gossip-топика автора. Сохраняется и добавляется в ленту, только если владелец подписан на автора | `NewTweetEvent` | `domain.Tweet` или `Accepted` |
| `/public/delete/timeline` | public | Удаление от автора, на которого есть подписка, доставленное тем же путем | `DeleteTweetEvent` | `Accepted` |
| `/public/get/tweet` | public | Один пост из локального хранилища или с узла автора. Спонсорский пост приходит в виде тизера (без текста, медиа и опроса), если вызывающий — не собственный узел или устройство автора | `GetTweetEvent` | `domain.Tweet` |
| `/public/get/tweets` | public | Посты пользователя, обновляемые с его узла. Если задан `root_id` или `parent_id` — ответы под этим постом; если задан `root_user_id` — они запрашиваются с узла автора треда | `GetAllTweetsEvent` | `TweetsResponse` |
| `/public/get/tweetstats` | public | Счетчики поста (просмотры, ретвиты, ответы, реакции по каждому эмодзи) и собственная реакция владельца. Для поста другого пользователя они приходят с узла автора | `GetTweetStatsEvent` | `TweetStatsResponse` |
| `/public/post/reply` | public | Ответ в треде, который хранится на этом узле, присланный узлом отвечающего. Ответ сохраняется, владелец получает уведомление | `NewTweetEvent` | `domain.Tweet` |
| `/public/post/reply/edit` | public | Правка автора ответа; применяется к копии, которую хранит этот узел | `EditTweetEvent` | `Accepted` |
| `/public/delete/reply` | public | Удаление от автора ответа; применяется к копии, которую хранит этот узел | `DeleteTweetEvent` | `Accepted` |
| `/public/post/retweet` | public | Ретвит или цитата поста; сохраняется локально и пересылается на узел автора, который уведомляет автора | `NewRetweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/public/post/unretweet` | public | Отменить ретвит локально и на узле автора | `UnretweetEvent` | `Accepted` |
| `/public/post/pin` | public | Закрепить пост в профиле его автора; это может сделать только собственный узел или устройство автора | `PinTweetEvent` | `domain.Tweet` |
| `/public/post/unpin` | public | Открепить его | `PinTweetEvent` | `domain.Tweet` |

## Реакции, просмотры и опросы {#reactions-views-and-polls}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/react` | public | Отреагировать на пост эмодзи (`❤️`, если `emoji` пуст); пересылается на узел автора, который уведомляет автора | `ReactionEvent` | `ReactionsCountResponse` |
| `/public/post/unreact` | public | Убрать реакцию локально и на узле автора | `UnreactionEvent` | `ReactionsCountResponse` |
| `/public/post/view` | public | Засчитать просмотр поста; собственный просмотр владельца пересылается на узел автора | `ViewEvent` | `ViewsCountResponse` |
| `/public/get/tweet/reactors` | public | Пользователи, отреагировавшие на пост; запрашиваются с узла автора, если `owner_user_id` указывает на другого пользователя | `GetTweetReactorsEvent` | `UsersResponse` |
| `/public/get/tweet/retweeters` | public | Пользователи, сделавшие ретвит поста; запрашиваются так же | `GetTweetRetweetersEvent` | `UsersResponse` |
| `/private/get/reactions` | private | Посты, на которые отреагировал владелец, в виде ссылок; полные посты загружаются через `/public/get/tweet` | `GetReactionsEvent` | `GetReactionsResponse` |
| `/public/post/poll/vote` | public | Проголосовать в опросе поста; голос пересылается на узел автора | `PollVoteEvent` | `PollResultsResponse` |
| `/public/get/poll` | public | Результаты опроса, подсчитанные на узле автора; собственный голос владельца берется локально | `GetPollEvent` | `PollResultsResponse` |

## Подписки и доверие {#follows-and-trust}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/follow` | public | Подписаться на пользователя: записать подписку, отправить ее на его узел (который уведомляет пользователя) и подписаться на его gossip-топик. На узле пользователя, на которого подписываются, тот же маршрут записывает нового подписчика | `NewFollowEvent` | `Accepted` |
| `/public/post/unfollow` | public | Отписаться локально и на его узле и отписаться от его топика | `NewUnfollowEvent` | `Accepted` |
| `/public/post/isfollowing` | public | Подписан ли владелец этого узла на `user_id` | `GetIsFollowingEvent` | `IsFollowingResponse` |
| `/public/post/isfollower` | public | Подписан ли `user_id` на владельца этого узла | `GetIsFollowingEvent` | `IsFollowerResponse` |
| `/public/get/followers` | public | Подписчики пользователя; запрашиваются с узла этого пользователя, если это не владелец | `GetFollowersEvent` | `FollowersResponse` |
| `/public/get/followings` | public | На кого подписан пользователь, запрашивается так же; `is_mutual_only` оставляет в списке владельца только тех, кто подписан в ответ | `GetFollowingsEvent` | `FollowingsResponse` |
| `/private/get/trust` | private | Положение указанных пользователей (до 100) в [круге доверия](../trust-circle.md) владельца; ответ берется из памяти без сетевых запросов | `GetTrustEvent` | `GetTrustResponse` |

## Пользователи {#users}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/get/user` | public | Профиль. Профиль владельца приходит со счетчиками постов, подписчиков и подписок. Профиль другого пользователя берется из локального хранилища и в фоне обновляется с его узла, а если в хранилище его нет — запрашивается с его узла (`node_id` — необязательная подсказка; хэндл из моста запрашивается у шлюза мостов) | `GetUserEvent` | `domain.User` |
| `/private/get/user/status` | private | В сети ли пользователь: узел запрашивает у его узла `/public/get/info` и записывает `last_seen` | `GetUserEvent` | `UserStatusResponse` |
| `/public/get/users` | public | Пользователи, известные этому узлу. В фоне список обновляется с узла `user_id`, а если `user_id` — владелец, то со [шлюза мостов](../bridge.md) | `GetAllUsersEvent` | `UsersResponse` |
| `/public/get/users/search` | public | Поиск по пользователям, известным этому узлу | `SearchUsersEvent` | `SearchUsersResponse` (`UsersResponse`) |
| `/public/get/whotofollow` | public | Рекомендации, на кого подписаться: по странице на каждую сеть (`warpnet`, `mastodon`, `threads`, `nostr`) в `networks`, с постраничным переходом через `cursors`; поля верхнего уровня `users` и `cursor` повторяют страницу `warpnet` | `GetWhoToFollowEvent` | `WhoToFollowResponse` |
| `/private/post/user` | private | Обновить профиль владельца | `NewUserEvent` (`domain.User`) | `domain.User` |

## Чаты {#chats}

Чаты с пользователями из мостов отклоняются.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/public/post/chat` | public | Создать чат с другим пользователем; чат создается и на его узле | `NewChatEvent` | `ChatCreatedResponse` (`domain.Chat`) |
| `/public/post/message` | public | Отправить сообщение; оно сохраняется локально и доставляется на узел собеседника, который уведомляет его | `NewMessageEvent` (`domain.ChatMessage`) | `NewMessageResponse` (`domain.ChatMessage`) |
| `/private/get/chat` | private | Один чат | `GetChatEvent` | `GetChatResponse` (`domain.Chat`) |
| `/private/get/chats` | private | Чаты владельца | `GetAllChatsEvent` | `ChatsResponse` |
| `/private/delete/chat` | private | Удалить чат локально | `DeleteChatEvent` | `Accepted` |
| `/private/get/message` | private | Одно сообщение | `GetMessageEvent` | `ChatMessageResponse` (`domain.ChatMessage`) |
| `/private/get/messages` | private | Сообщения чата | `GetAllMessagesEvent` | `ChatMessagesResponse` |
| `/private/delete/message` | private | Удалить сообщение локально | `DeleteMessageEvent` | `Accepted` |

## Медиа {#media}

Медиа передаются внутри JSON как base64 data URI (`data:<mime>;base64,<data>`). Узел перекодирует загруженные изображения в JPEG и встраивает зашифрованные метаданные о владельце в каждое загруженное изображение и видео. Видео должно быть в формате MP4, MOV или M4V, не больше 36 MiB и не длиннее одной минуты. Лимиты размера запроса по маршрутам приведены в разделе [Stream API](stream-API.md#limits-and-good-practice).

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/image` | private | Загрузить до четырех изображений (`image1`–`image4`); возвращает их ключи | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/image` | public | Изображение по владельцу и ключу из локального хранилища или с узла владельца | `GetImageEvent` | `GetImageResponse` |
| `/private/post/video` | private | Загрузить видео | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/video` | public | Видео по владельцу и ключу из локального хранилища или с узла владельца. С `deferred: true` узел отвечает только размером копии, которая у него уже есть, или `deferred: true` без файла, и не запрашивает видео | `GetVideoEvent` | `GetVideoResponse` |
| `/private/post/chat/image` | private | Загрузить изображения для чата; они хранятся отдельно от публичных медиа | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/chat/image` | public | Изображение из чата; отдается только собственному узлу и устройствам владельца и его собеседникам по чатам | `GetImageEvent` | `GetImageResponse` |
| `/private/post/chat/video` | private | Загрузить видео для чата | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/chat/video` | public | Видео из чата; отдается так же, как изображения из чата | `GetVideoEvent` | `GetVideoResponse` |

## Уведомления {#notifications}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/notifications` | private | Уведомления владельца и число непрочитанных; внутри страницы сначала непрочитанные, затем более новые | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/pushes` | private | Те же уведомления, прочитанные от `cursor` в обратном направлении; вызывается мобильными приложениями | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/notification` | private | Одно уведомление | `GetNotificationEvent` | `GetNotificationResponse` (`domain.Notification`) |
| `/private/post/notification/read` | private | Отметить одно уведомление прочитанным | `MarkNotificationReadEvent` | `Accepted` |
| `/private/post/notifications/read` | private | Отметить все уведомления прочитанными | нет | `Accepted` |

## Настройки {#settings}

Настройки шлюза, лимитов частоты, сети и кошелька хранятся в базе данных узла и применяются при запуске member-узла.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/settings/notification` | private | Настройки уведомлений по email: SMTP-сервер, получатель, переключатели по типам | нет | `GetNotificationSettingsResponse` (`domain.NotificationSettings`) |
| `/private/post/settings/notification` | private | Сохранить их | `UpdateNotificationSettingsEvent` (`domain.NotificationSettings`) | `GetNotificationSettingsResponse` |
| `/private/get/settings/gateway` | private | Peer ID узла [шлюза мостов](../bridge.md); встроенное значение по умолчанию, если ничего не задано | нет | `GetGatewaySettingsResponse` (`domain.GatewaySettings`) |
| `/private/post/settings/gateway` | private | Сохранить его; пустой `node_id` сохраняет значение по умолчанию | `UpdateGatewaySettingsEvent` (`domain.GatewaySettings`) | `GetGatewaySettingsResponse` |
| `/private/get/settings/ratelimit` | private | Пороги менеджера соединений и лимиты частоты для обнаружения пиров и потоков, с подставленными значениями по умолчанию | нет | `ratelimit.Settings` |
| `/private/post/settings/ratelimit` | private | Сохранить их; нижний порог должен быть меньше верхнего | `ratelimit.Settings` | `ratelimit.Settings` |
| `/private/get/settings/network` | private | Хосты для прослушивания, порт и список bootstrap-узлов, с подставленными значениями запуска | нет | `GetNetworkSettingsResponse` (`domain.NetworkSettings`) |
| `/private/post/settings/network` | private | Сохранить их; хосты, порт и multiaddr-адреса bootstrap-узлов проверяются | `UpdateNetworkSettingsEvent` (`domain.NetworkSettings`) | `GetNetworkSettingsResponse` |
| `/private/get/settings/wallet` | private | Эндпоинт API блокчейна и путь к платежному движку | нет | `GetWalletSettingsResponse` (`domain.WalletSettings`) |
| `/private/post/settings/wallet` | private | Сохранить их; эндпоинт должен быть http(s)-URL | `UpdateWalletSettingsEvent` (`domain.WalletSettings`) | `GetWalletSettingsResponse` |
| `/private/get/settings/sponsored` | private | Минимальный стейк TRX, который нужен кошельку покупателя, чтобы купить спонсорские посты владельца | нет | `GetSponsoredSettingsResponse` (`domain.SponsoredSettings`) |
| `/private/post/settings/sponsored` | private | Сохранить его | `UpdateSponsoredSettingsEvent` (`domain.SponsoredSettings`) | `GetSponsoredSettingsResponse` |

`ratelimit.Settings` определен в [`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go).

## Фильтры, блокировки и игнорирование {#filters-blocks-and-mutes}

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/settings/filter` | private | Один фильтр контента | `GetFilterEvent` | `GetFilterResponse` (`domain.Filter`) |
| `/private/get/settings/filters` | private | Все фильтры контента | `GetFiltersEvent` | `GetFiltersResponse` |
| `/private/post/settings/filter` | private | Создать фильтр | `NewFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/post/settings/filter/update` | private | Обновить фильтр | `UpdateFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/delete/settings/filter` | private | Удалить фильтр | `DeleteFilterEvent` | `Accepted` |
| `/private/post/settings/filter/keyword` | private | Добавить ключевое слово в фильтр | `AddFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/post/settings/filter/keyword/update` | private | Изменить ключевое слово | `UpdateFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/delete/settings/filter/keyword` | private | Удалить ключевое слово | `DeleteFilterKeywordEvent` | `Accepted` |
| `/private/post/settings/block` | private | Заблокировать пользователя; его узел также попадает в блок-лист пиров, кроме пользователей из мостов | `BlockEvent` | `Accepted` |
| `/private/post/settings/unblock` | private | Разблокировать и убрать его узел из блок-листа | `UnblockEvent` | `Accepted` |
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
| `/public/post/report` | public | Пожаловаться на пост или пользователя. Вызвать маршрут может только собственный владелец узла; узел проставляет автора жалобы и публикует ее в gossip-топике `/warpnet/reports/1.0.0` | `ReportEvent` | `Accepted` |
| `/public/post/moderate/result` | public | Применить вердикт модератора. Вердикт, подтверждающий жалобу, модератор публикует в gossip-топике автора, на которого пожаловались, а каждый вердикт отправляет напрямую на узел автора жалобы. Перед любыми изменениями проверяются подпись вердикта и его кворум подписанных голосов | `ModerationVerdictEvent` | `Accepted` |

Полное описание процесса — в разделе [Модерация](../moderation.md).

## Кошелек {#wallet}

У узла есть встроенный кошелек TRON, ключ которого выводится из идентичности владельца. Он используется для переводов и спонсорских постов и работает с блокчейном через процесс платежного движка, который запускает узел.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/get/wallet` | private | Адрес, балансы, состояние стейкинга и сеть | нет | `WalletResponse` |
| `/private/get/wallet/address` | private | Собственный адрес и токен владельца | нет | `WalletOwnAddressResponse` |
| `/private/get/wallet/history` | private | Последние переводы | `WalletEvent` | `WalletHistoryResponse` |
| `/private/get/wallet/key` | private | Экспортировать закрытый ключ кошелька | нет | `WalletKeyResponse` |
| `/private/get/wallet/contacts` | private | Адреса кошельков подписок и подписчиков владельца, собранные с их узлов через `/public/get/wallet/address` | `WalletContactsEvent` | `WalletContactsResponse` |
| `/private/post/wallet/send` | private | Отправить средства | `WalletSendEvent` | `WalletSendResponse` |
| `/private/post/wallet/stake` | private | Застейкать TRX | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/unstake` | private | Начать вывод TRX из стейкинга | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/withdraw` | private | Вывести TRX, которые вышли из стейкинга и стали доступны | нет | `WalletStakeResponse` |
| `/public/get/wallet/address` | public | Другой узел запрашивает платежный адрес владельца; запрос отклоняется, если у пользователя вызывающего узла 10 подтвержденных заказов за последний час | `WalletAddressEvent` | `WalletAddressResponse` |

## Спонсорские посты {#sponsored-tweets}

У спонсорского поста есть цена. Остальные пользователи видят тизер. Покупатель платит автору через кошелек и затем получает полное содержимое, причем копии медиа создаются отдельно для этого покупателя.

| Маршрут | Доступ | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/sponsored/tweet` | private | Опубликовать платный пост от имени владельца; у него должен быть текст, и он не может быть ответом или содержать опрос | `NewTweetEvent` (`domain.Tweet`) с `price` | `domain.Tweet` |
| `/private/get/sponsored/quote` | private | Цена, комиссия и сетевые расходы на покупку спонсорского поста | `GetOrderQuoteEvent` | `OrderQuoteResponse` |
| `/private/post/sponsored/order` | private | Купить спонсорский пост: открыть заказ и оплатить его автору | `NewOrderEvent` | `OrderResponse` |
| `/public/post/sponsored/order` | public | Узел покупателя просит узел автора проверить оплату | `VerifyOrderEvent` | `OrderResponse` |
| `/public/get/sponsored/tweet` | public | Полный пост для покупателя с подтвержденным заказом; собственный узел и устройства автора получают его в том виде, в каком он хранится | `GetTweetEvent` | `domain.Tweet` или `OrderResponse`, пока заказ не подтвержден |
| `/public/get/sponsored/image` | public | Изображение купленного спонсорского поста | `GetImageEvent` | `GetImageResponse` |
| `/public/get/sponsored/video` | public | Видео купленного спонсорского поста | `GetVideoEvent` | `GetVideoResponse` |
| `/private/get/sponsored/buyer` | private | Сопоставить утекший файл с проданными копиями, чтобы выяснить, от какого покупателя он ушел | `GetCopyBuyerEvent` | `CopyBuyerResponse` |

## Маршруты вне member-узла {#routes-outside-the-member-node}

| Маршрут | Кто обслуживает | Назначение | Запрос | Ответ |
|---|---|---|---|---|
| `/private/post/login` | desktop-приложение (`App.Call`), мост `/ws` удаленного узла | Войти по логину и паролю, вывести ключи и запустить узел; на новом узле при этом создается аккаунт. Никогда не передается через libp2p | `LoginEvent`: поле `username` несет логин, плюс `password` | `LoginResponse` (`domain.AuthNodeInfo`) |
| `/private/post/logout` | desktop-приложение, мост `/ws` удаленного узла | Выйти. Desktop-приложение останавливает узел; мост удаленного узла только выводит из системы это соединение. Никогда не передается через libp2p | нет | `["logged_out"]` |
| `/private/get/update` | только desktop-приложение | Ожидающее самообновление, если оно есть | нет | `UpdateResponse` (`domain.UpdateInfo`) |
| `/private/post/update` | только desktop-приложение | Разрешить или отклонить ожидающее обновление | `UpdateEvent` | `Accepted` |
| `/public/post/relay/refuse/reservation` | relay-узлы | Узел с резервацией на relay-узле просит его больше не пропускать соединения от пира, которого узел внес в блок-лист; узлы отправляют этот запрос, когда такой пир приходит к ним через relay | `RefuseReservationEvent` | `Accepted` |
| `/public/get/moderate/challenge` | узлы-модераторы | Выборочная проверка (аудит) модераторов друг другом: каждые 5 минут модератор отправляет эталонный текст случайному модератору, которого недавно видел в раунде модерации; тот оценивает текст своим движком и возвращает подписанный ответ | `audit.Challenge` | `audit.ChallengeResponse` |

Вход, выход и маршруты обновления обрабатываются в [`cmd/node/member/app.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/app.go) и [`cmd/node/member/remote/bridge.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote/bridge.go). Типы аудита модераторов находятся в [`cmd/node/moderator/audit/wire.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/moderator/audit/wire.go).

## Добавление маршрута {#adding-a-route}

Новые маршруты строятся по одной схеме: константа в `event/paths.go`, типы запроса и ответа в `event/event.go`, фабрика обработчика в `core/handler`, регистрация в member-узле и зеркальные изменения в клиентах. Чек-лист — в [руководстве разработчика](index.md).

## См. также {#see-also}

- [Протокол](../protocol.md): конверты, подписи, ошибки, лимиты
- [Stream API](stream-API.md): вызов маршрутов через libp2p
- [WebSocket API](ws-API.md): вызов маршрутов через мост панели управления удаленного узла
- [Клиенты](clients.md): как desktop-, браузерный и мобильные клиенты обращаются к этим маршрутам
