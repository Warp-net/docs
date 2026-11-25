---
title: Руководство разработчика
description: Как собрать Warpnet из исходников, запустить каждую роль узла локально, разобраться в коде, добавить маршрут и довести изменение до слияния.
---

# Руководство разработчика {#developer-guide}

Это руководство проведет вас от свежего клона репозитория до принятого pull request. В нем описаны инструменты, сборка и запуск каждой роли узла и мобильных приложений, настройка локальной сети из нескольких узлов, устройство кода, разбор добавления маршрута на примере, тесты и CI, а также выпуск релизов. Руководство написано для контрибьюторов. Если вы хотите только запустить Warpnet, начните с [руководства пользователя](../user-guide/index.md).

## Требования {#prerequisites}

| Инструмент | Версия | Нужен для |
|---|---|---|
| Go | 1.26.3 или новее (`go 1.26.3` в `go.mod`) | всего |
| Wails CLI | v2.10.2 | desktop member-узла |
| Компилятор C/C++ | не зафиксирована | desktop member-узла и модератора (оба используют cgo) |
| Node.js и npm | не зафиксирована | пересборки desktop-интерфейса в `frontend/` |
| golangci-lint | v2 (в конфиге `version: "2"`) | линтинга |
| JDK 17, Android SDK и NDK | release-воркфлоу использует NDK r27c (`27.2.12479018`) | приложения для Android |
| macOS с Xcode | CI выбирает Xcode 27.2 | приложения для iOS |

Установите Wails CLI той версии, которую используют Makefile и release-воркфлоу:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.10.2
```

> **Примечание:** `go.mod` требует библиотеку Wails v2.17.1, более новую, чем CLI. Цели Makefile и release-воркфлоу передают `-m -nosyncgomod`, поэтому CLI не выполняет `go mod tidy` и не переписывает `go.mod`. Используйте те же флаги.
{: .note }

### Системные пакеты {#system-packages}

**Linux (Debian/Ubuntu).** Desktop-узел линкуется с GTK и WebKitGTK 4.1. Эти пакеты устанавливают release-воркфлоу и `Dockerfile.member`:

```bash
sudo apt update
sudo apt install -y build-essential libgtk-3-dev libwebkit2gtk-4.1-dev
```

**macOS и Windows.** Release-воркфлоу собирает обе платформы на стандартных раннерах GitHub, где установлены только Go и Wails CLI. Если сборка падает, `wails doctor` покажет, чего не хватает в тулчейне Wails.

Headless-ролям (relay, echo, remote) нужен только Go.

## Получение исходников {#get-the-source}

```bash
git clone https://github.com/Warp-net/warpnet.git
cd warpnet
git checkout develop
```

- **Ветки.** Работа вливается в `develop`; `main` получает слияния из `develop`. Создавайте ветку от `develop` и направляйте в нее pull request: CI для Android и iOS запускается на pull request в `develop`.
- **Вендоренные модули.** Каталог `vendor/` закоммичен, и сборки Go используют его (`-mod=vendor` в Dockerfile для relay, echo и remote и в релизной сборке relay, `"go:build:mod": "vendor"` в `wails.json`). Не редактируйте его вручную; после изменения зависимостей выполните `go mod tidy && go mod vendor`.
- **Сабмодуль.** `core/moderation` — git-сабмодуль, указывающий на [Warp-net/moderation](https://github.com/Warp-net/moderation). Он нужен только модератору: `git submodule update --init core/moderation`.

## Роли узлов и точки входа {#node-roles-and-entry-points}

Из одной кодовой базы собирается несколько бинарников. Точку входа выбирают теги сборки.

| Роль | Точка входа | Тег сборки | CGO | Dockerfile |
|---|---|---|---|---|
| member (desktop) | `cmd/node/member/main.go` + `app.go` | нет (`!echo && !remote`) | `1` | `Dockerfile.member` (проверка сборки под Linux; образ не предназначен для запуска) |
| remote (headless, интерфейс в браузере) | `cmd/node/member/remote-member.go` | `remote` | не задан | `Dockerfile.remote` |
| echo (тестовый бот) | `cmd/node/member/echo-member.go` | `echo` | `0` | `Dockerfile.echo` |
| relay | `cmd/node/relay/main.go` | нет (файл помечен `!windows`) | `0` | `Dockerfile.relay` |
| moderator | `cmd/node/moderator/main.go` | `llama` | `1` | `Dockerfile.moderator` |
| мобильный узел | `warpdroid/node`, `warpfone/node` | `mobile` | gomobile | нет |

Что делает каждая роль, описано в разделе [Архитектура](../architecture.md).

## Сборка и запуск каждой роли {#build-and-run-each-role}

### Member-узел (desktop) {#member-desktop}

```bash
cd cmd/node/member
wails build -m -nosyncgomod -devtools -tags webkit2_41
./build/bin/warpnet --node.network testnet
```

`make run-main` делает то же самое (предварительно устанавливая Wails CLI) и запускает узел в testnet с `--node.port 4000`. На macOS результат сборки — `build/bin/warpnet.app`, на Windows — `build/bin/warpnet.exe`. `make build-windows` выполняет кросс-сборку под Windows (`wails build -clean -platform windows -tags webkit2_41 -m -nosyncgomod`).

Бинарник встраивает интерфейс из `frontend/dist` через `//go:embed` в `embedded.go`, а `wails.json` задает `skipfrontend: true`, поэтому `wails build` никогда не компилирует Vue-приложение. После любых изменений в `frontend/src` пересоберите бандл, а затем бинарник:

```bash
make frontend        # cd frontend && make rebuild: чистый npm install + npm run build
```

`frontend/dist` закоммичен, поэтому контрибьютор, который работает только с Go, может собрать рабочий бинарник без Node.js. Если вы меняете интерфейс, закоммитьте пересобранный `dist` вместе с изменениями исходников.

### Удаленный узел (headless, интерфейс в браузере) {#remote-node-headless-ui-in-a-browser}

```bash
go run -tags remote ./cmd/node/member/remote-member.go \
  --node.network testnet --node.server.host 127.0.0.1
```

Откройте `http://127.0.0.1:4999`. Узел отдает тот же встроенный интерфейс по HTTP и связывает его с узлом через WebSocket `/ws`, зашифрованный Noise (см. [Клиенты](clients.md#remote-node-http-and-ws)). При запуске он выводит отпечаток своего WebSocket-ключа, который браузер запоминает при первом подключении. Это также самый простой способ работать над интерфейсом без GTK и Wails.

С Docker команда `docker compose up --build` использует `docker-compose.yaml` из репозитория: он собирает `Dockerfile.remote` и запускает удаленный узел в testnet в сети хоста (порт libp2p 4001, порт панели 4999).

### Echo-бот {#echo-bot}

```bash
make echo-main
# = go run -tags echo cmd/node/member/echo-member.go --node.network testnet \
#     --node.seed echo --database.dir echo --node.port 4002
```

Echo-узел — это member-узел с базой данных в памяти и фиксированным встроенным аккаунтом `Echo`. Он подписывается в ответ на каждого, кто подписался на него, отвечает на сообщения в чатах и публикует пост раз в день. На диск он ничего не пишет, поэтому `--database.dir` на него не влияет. А поскольку его логин и пароль фиксированы, его peer ID зависит только от сети (см. примечание в разделе [Локальные сети](#local-networks)).

### Relay-узел {#relay}

```bash
make relay-main
# = go run cmd/node/relay/main.go --node.network testnet --node.print-psk
```

Релизная сборка статическая:

```bash
cd cmd/node/relay
CGO_ENABLED=0 go build -ldflags "-s -w" -gcflags=all=-l -mod=vendor -o relay
```

Relay-узел хранит состояние только в памяти. Его ключ выводится из `--node.seed`; если флаг не задан, конфигурация подставляет seed из имени сети, `--database.dir`, `--node.host.v4` и `--node.port`, поэтому relay, запущенный с теми же флагами, сохраняет свой peer ID. После запуска он выводит `RELAY NODE STARTED WITH ID <id> AND ADDRESSES [...]`. Relay-узел не собирается под Windows.

### Узел-модератор {#moderator}

Модератору нужны сабмодуль `core/moderation`, тулчейн C/C++ и файл модели `Llama-Guard-3-1B-Q4_K_M.gguf` в его **рабочем каталоге**. Путь зашит в `cmd/node/moderator/moderator/moderator.go`, флага для него нет. Модели нет ни в репозитории, ни в релизных архивах.

```bash
git submodule update --init core/moderation
make run-moderator
# = CGO_CXXFLAGS="-w -Wno-format -Wno-delete-incomplete" go run -tags=llama \
#     cmd/node/moderator/main.go --node.network testnet --node.port 4002 --node.seed moderatorlocalhost
```

Модератор генерирует новую случайную идентичность при каждом запуске. `Dockerfile.moderator` собирает с `-mod=mod` и подтягивает сабмодуль, если его нет; release-воркфлоу собирает релизный модератор в этом образе. В `deploy/docker-compose-moderator.yml` показано, как файл модели монтируется в контейнер. Как устроена модерация, описано в разделе [Модерация](../moderation.md).

### Приложение для Android {#android-app}

Приложение для Android (`warpdroid/`) встраивает gomobile-узел из `warpdroid/node`, собранный только для arm64. Нужны JDK 17, Android SDK, NDK (`$ANDROID_NDK_HOME` или NDK в `$ANDROID_HOME/ndk/`) и Go:

```bash
go mod download
cd warpdroid/node && bash build-native.sh   # создает warpdroid/warpnet-transport/libs/warpnet.aar
cd .. && ./gradlew :app:assembleDebug
```

`warpnet.aar` не закоммичен. В чистом клоне Gradle собирает его сам (задача `buildWarpnetAar` запускает `build-native.sh`); если файл уже есть, Gradle использует его повторно, поэтому после изменения кода Go снова запустите `build-native.sh` (или `make aar` в `warpdroid/`).

### Приложение для iOS {#ios-app}

Приложение для iOS (`warpfone/`) встраивает gomobile-узел из `warpfone/node`. Нужны macOS с Xcode и Go:

```bash
warpfone/scripts/build-xcframework.sh   # создает warpfone/Warpnet.xcframework
cp warpfone/WarpnetApp.xcconfig.template warpfone/WarpnetApp.xcconfig
xcodebuild build -project warpfone/WarpnetApp.xcodeproj -scheme WarpnetApp \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO
```

`WARPFONE_XCFRAMEWORK_TARGETS=iossimulator` ограничивает фреймворк симулятором, как в CI. `Warpnet.xcframework` не закоммичен.

## Теги сборки и CGO {#build-tags-and-cgo}

| Тег | Где используется | Что делает |
|---|---|---|
| `webkit2_41` | member | Выбирает привязки WebKitGTK 4.1, которые Wails использует в Linux. |
| `remote` | remote | Заменяет точку входа Wails на точку входа HTTP/WebSocket. |
| `echo` | echo | Собирает точку входа бота с хранилищем в памяти. |
| `llama` | moderator | Компилирует движок модерации и его cgo-привязки к llama.cpp. |
| `mobile` | `warpdroid/node`, `warpfone/node` | Включает мост gomobile; `go test ./...` по всему модулю эти файлы пропускает. |

CGO включен для member-узла (Wails) и модератора (llama.cpp) и выключен для relay и echo, чтобы они статически линковались в образы `distroless`. `Dockerfile.remote` его не задает.

## Локальные сети {#local-networks}

### Порты целей Makefile {#ports-used-by-the-makefile-targets}

| Цель | Роль | Сеть | Порт | Примечания |
|---|---|---|---|---|
| `run-main` | member | testnet | 4000 | каталог `storage` по умолчанию |
| `run-second` | member | testnet | 4002 | `--node.seed backendtest --database.dir backend1` |
| `relay-main` | relay | testnet | 4001 | выводит PSK |
| `echo-main` | echo | testnet | 4002 | в памяти |
| `run-moderator` | moderator | testnet | 4002 | нужен файл модели |

> **Внимание:** `run-second`, `echo-main` и `run-moderator` используют один и тот же порт 4002. Если запускаете больше одного из них, переопределите `--node.port`. Desktop-приложение также держит блокировку единственного экземпляра (`net.warpnet.app`), поэтому второй desktop member-узел на той же машине просто передает управление первому. Чтобы запустить второй полноценный member-узел на одной машине, используйте удаленный узел со своими `--database.dir`, `--node.port` и `--node.server.port`.
{: .warning }

Практичный локальный рой — один desktop member-узел, relay-узел, echo-узел и один или несколько удаленных узлов со своими аккаунтами. Значения `--node.seed`, которые Makefile передает целям member, echo и moderator, ни на что не влияют: peer ID member-узла берется из его логина и пароля, а модератор выбирает случайный.

> **Примечание:** Все echo-узлы входят под одним и тем же встроенным аккаунтом, поэтому у всех echo-узлов одной сети один peer ID. Запускайте не больше одного на сеть. Развертывание testnet (`deploy/docker-compose-testnet.yml`) уже запускает такой узел, так что локальный echo-бот полезнее всего в вашей собственной изолированной сети.
{: .note }

### Изолированная сеть {#an-isolated-network}

Любое имя сети, кроме `warpnet` (mainnet) и `testnet`, дает вам отдельную сеть без встроенных bootstrap-узлов. Узлы соединяются, только если у них одинаковое имя сети и одинаковая **мажорная** версия: сетевой ключ (PSK) равен `SHA-256(network + major version)` (`security/psk.go`).

1. Запустите relay-узел и запишите его peer ID из стартовой строки:

   ```bash
   go run cmd/node/relay/main.go --node.network devnet --node.seed devrelay \
     --node.self-update=false
   ```

2. Укажите его остальным узлам:

   ```bash
   ./build/bin/warpnet --node.network devnet --node.port 4000 \
     --node.bootstrap /ip4/127.0.0.1/tcp/4001/p2p/<relay-peer-id>

   go run -tags echo cmd/node/member/echo-member.go --node.network devnet \
     --node.port 4003 --node.bootstrap /ip4/127.0.0.1/tcp/4001/p2p/<relay-peer-id>
   ```

Member-узлы в одной локальной сети также находят друг друга через mDNS. Member-узел предпочитает флагу `--node.bootstrap` bootstrap-адреса, сохраненные в его собственных сетевых настройках; флаг действует, пока эти настройки пусты. Самообновление (`--node.self-update`, по умолчанию включено) заменяет бинарник последним релизом, причем relay-узел делает это не спрашивая, поэтому для локальных сборок его стоит выключить.

### Каталог данных {#data-directory}

Каждый member-узел и удаленный узел хранит данные в `~/.warpdata/<network>/<database.dir>` (Windows: `%LOCALAPPDATA%\warpdata\...`). `--node.network mainnet` нормализуется в `warpnet`. WebSocket-ключ удаленного узла лежит в `~/.warpdata/<network>/ws-noise.key`. Relay-узел, модератор и echo-узел данных там не хранят.

`make prune-testnet` удаляет `~/.warpdata/testnet/*`. Без `--node.network` или `NODE_NETWORK` desktop-узел запускается в mainnet. Исключение — когда база данных testnet (с ее `run.lock`) уже существует: тогда он снова открывает testnet.

### Флаги {#flags}

Любой флаг можно задать и переменной окружения: в верхнем регистре, с заменой точек и дефисов на подчеркивания (`node.server.port` становится `NODE_SERVER_PORT`). Флаг в командной строке имеет приоритет над окружением.

| Флаг | По умолчанию | Назначение |
|---|---|---|
| `--node.network` | `warpnet` | Имя сети; для тестирования — `testnet`. |
| `--node.port` | `4001` | TCP-порт libp2p (IPv4 и IPv6). |
| `--node.host.v4` / `--node.host.v6` | `0.0.0.0` / `::` | Адреса для привязки. |
| `--node.seed` | выводится из сети, каталога базы данных, хоста и порта | Seed для детерминированного peer ID; читается только relay-узлом. |
| `--node.bootstrap` | пусто | Multiaddr-адреса через запятую. Если флаг задан, он **заменяет** встроенный список. |
| `--node.print-psk` | `false` | Выводить PSK сети в лог при запуске; читается только relay-узлом. |
| `--node.self-update` | `true` | Заменять бинарник новыми релизами; member-узел сначала спрашивает владельца. |
| `--node.server.host` / `--node.server.port` | `0.0.0.0` / `4999` | Панель управления удаленного узла. |
| `--database.dir` | `storage` | Подкаталог в `~/.warpdata/<network>/`. |
| `--logging.level` / `--logging.format` | `info` / `text` | Уровень логирования; `text` или `json`. |
| `--wallet.binary-path` | пусто | Бинарник платежного движка; используется, пока в настройках кошелька узла он не задан. |
| `--wallet.endpoint` | `https://api.trongrid.io` в `warpnet`, `https://nile.trongrid.io` в `testnet` | Эндпоинт API блокчейна; используется, пока в настройках кошелька узла он не задан. |

Полный справочник для операторов — в разделе [Запуск узла](../user-guide/running-a-node.md).

## Структура проекта {#project-layout}

```text
warpnet/
├── cmd/node/
│   ├── member/        # main.go (desktop), remote-member.go, echo-member.go, app.go (Wails App)
│   │   ├── auth/      #   login, password rules, owner account
│   │   ├── deeplink/  #   warpnet:// URL scheme registration per OS
│   │   ├── node/      #   member-node.go: wires the node, registers handlers
│   │   ├── pubsub/    #   member gossip topics
│   │   └── remote/    #   /ws bridge and static file server for the remote node
│   ├── relay/         # relay node
│   └── moderator/     # moderator node: rounds, votes, audit, isolation
├── core/              # networking, streams, handlers, middleware, subsystems
├── database/          # repositories over the embedded store (*-repo.go)
│   └── local-store/   #   BadgerDB wrapper and prefix-key builder
├── domain/            # shared domain types (User, Tweet, AuthNodeInfo, ...)
├── event/             # wire protocol: paths.go (routes), event.go (DTOs, envelope)
├── security/          # key derivation, signatures, PSK, Noise for the remote /ws channel
├── config/            # flags, env vars, defaults, built-in bootstrap nodes
├── json/              # json-iterator wrapper used everywhere
├── retrier/           # retry helper
├── frontend/          # Vue 3 UI; dist/ is committed and embedded in the binary
├── warpdroid/         # Android app (based on Tusky) + gomobile node in node/
├── warpfone/          # iOS app (based on Ice Cubes) + gomobile node in node/
├── keepalive/         # keeps the host awake while devices are paired
├── deploy/            # testnet and moderator compose files, deploy script
├── snap/              # Snap packaging
├── fastlane/          # F-Droid store listing
├── .githooks/         # version-bump hook (see Release process)
├── embedded.go        # go:embed of version, icon, frontend/dist
└── version            # the release version
```

Избранные пакеты `core/`:

| Пакет | Зона ответственности |
|---|---|
| `core/node` | хост libp2p, регистрация обработчиков за middleware, loopback `SelfStream` |
| `core/stream` | тип маршрута, фрейминг запросов, loopback-потоки, пул потоков, очередь исходящих |
| `core/handler` | по одному файлу на функцию; обычно добавлять приходится именно такой файл |
| `core/middleware` | логирование, ограничение частоты запросов, проверка подписи, идемпотентность |
| `core/discovery`, `core/dht`, `core/mdns` | обнаружение пиров |
| `core/pubsub` | топики GossipSub |
| `core/relay`, `core/holepunch` | сервис circuit relay v2 и отказы в резервации, трассировка hole punching |
| `core/crdt` | реплицируемые счетчики и хранилище рейтингов (см. [Синхронизация](../synchronization.md)) |
| `core/rating`, `core/ratelimit` | репутация узлов, лимиты на пира |
| `core/trust` | круг доверия |
| `core/authorship` | проверка того, что событие пришло с собственного узла автора действия |
| `core/bridge` | аккаунты из мостов и ID узла-шлюза (см. [Мосты](../bridge.md)) |
| `core/selfupdate` | опрос релизов и замена бинарника |
| `core/warpnet` | псевдонимы типов libp2p, опции хоста, общие типы вроде `NodeInfo` |

Сам протокол описан в разделе [Протокол](../protocol.md), список маршрутов — в [справочнике API](api.md).

## Как устроен узел {#how-the-node-is-shaped}

Member-узел устроен как привычное веб-приложение MVC, так что знакомые понятия легко на него переносятся:

| Роль в MVC | Warpnet | Что там находится |
|---|---|---|
| Маршрутизатор (Router) | `event/paths.go` + `setupHandlers` в `member-node.go` | строки маршрутов и обработчик, которому передается каждый из них |
| Контроллер (Controller) | `core/handler/<feature>.go` | обработка запросов, пересылка другим узлам |
| Модель (Model) | `database/<feature>-repo.go` + `domain/` | хранение поверх BadgerDB, доменные типы |
| Представление (View) | `frontend/`, `warpdroid/`, `warpfone/` | интерфейсы, которые обращаются к контроллеру через один из [клиентских транспортов](clients.md) |

Под капотом нет HTTP-сервера: маршрутизатор распределяет потоки libp2p. Каждый запрос — пришел ли он из вашего собственного интерфейса через внутрипроцессный loopback или от другого пира — проходит одну и ту же цепочку:

```mermaid
flowchart LR
  A[Поток] --> B[Чтение и проверка размера]
  B --> C[Логирование]
  C --> D[Ограничитель частоты]
  D --> E[Аутентификация]
  E --> F[Идемпотентность]
  F --> G[Обработчик]
  G --> H[Репозиторий]
  H --> I[(BadgerDB)]
```

- **Аутентификация** (`core/middleware/auth.go`) проверяет подпись Ed25519 над телом, временной меткой и маршрутом, отклоняет сообщения от удаленных пиров, чья временная метка расходится с часами узла больше чем на 5 минут, и пропускает маршруты `/private/...` только от самого узла, сопряженного устройства или маршрута сопряжения.
- **Идемпотентность** кэширует успешные ответы на маршрутах `/post/` по маршруту, пиру и `message_id` на 10 минут, поэтому повторно отправленный запрос не выполняется дважды.
- **Обработчики** — это функции-фабрики, которые принимают узкие интерфейсы и возвращают `warpnet.WarpHandlerFunc`:

```go
type WarpHandlerFunc func(msg []byte, s WarpStream) (any, error)
```

Именно узкие интерфейсы позволяют покрывать обработчики модульными тестами без запущенного узла.

## Разбор примера: добавление маршрута {#worked-example-adding-a-route}

Эталонная функция — **эмодзи-реакции**: небольшая, работает между узлами и есть в каждом клиенте.

| Слой | Файл | Что там |
|---|---|---|
| Маршрут | [`event/paths.go`](https://github.com/Warp-net/warpnet/blob/main/event/paths.go) | `PUBLIC_POST_REACT = "/public/post/react/0.0.0"` |
| DTO | [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go) | `ReactionEvent{TweetId, UserId, OwnerId, Emoji}`, `ReactionsCountResponse{Count, Reactions}` |
| Обработчик | [`core/handler/reaction.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/reaction.go) | `StreamReactionHandler(repo, userRepo, notifyRepo, streamer)` |
| Хранилище | [`database/reaction-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/reaction-repo.go) | `ReactionRepo.React(tweetId, userId, emoji, isTransitive)` |
| Подключение | [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go) | репозиторий создается в `setupHandlers`, обработчик указан в `engagementHandlers`; интерфейс `ReactionsProvider` находится в `types.go` |
| Тест | [`core/handler/reaction_test.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/reaction_test.go) | `TestStreamReactionHandler` с заглушками репозиториев |
| Desktop-интерфейс | [`frontend/src/service/service.js`](https://github.com/Warp-net/warpnet/blob/main/frontend/src/service/service.js) | константа `PUBLIC_POST_REACT`, `reactToTweet()` |
| Android | `warpdroid/warpnet-transport/src/main/kotlin/site/warpnet/transport/ProtocolIds.kt`, `.../transport/dto/WarpnetDtos.kt`, `warpdroid/app/src/main/java/site/warpnet/warpdroid/warpnet/WarpnetRepository.kt` | константа маршрута, Moshi DTO, вызов репозитория |
| iOS | `warpfone/Packages/WarpnetTransport/Sources/WarpnetTransport/ProtocolIds.swift`, `WarpnetEvents.swift`, `warpfone/Packages/Network/Sources/Network/Warpnet/WarpnetRouter.swift` | сгенерированная константа маршрута, DTO, вызов роутера |

Обработчик показывает обычный для peer-to-peer паттерн: проверить автора действия, сохранить локально, затем переслать на узел автора поста, а недоступность пира считать успехом.

```go
reactor, err := authorship.VerifyActor(userRepo, streamer, s, ev.OwnerId)
// ...
num, err := repo.React(tweetId, ev.OwnerId, emoji, ev.OwnerId == ownNodeInfo.OwnerId) // store locally
// ...
reactionDataResp, err := streamer.GenericStream( // forward to the author's node
    reactedUser.NodeId, event.PUBLIC_POST_REACT, event.ReactionEvent{ /* same fields */ },
)
if errors.Is(err, warpnet.ErrNodeIsOffline) {
    return resp, nil // the author is offline: keep the local result
}
```

### Чек-лист {#checklist}

1. **Маршрут.** Добавьте константу в `event/paths.go`: `/<private|public>/<verb>/<entity>[/<sub>]/<version>`. Маршруты `private` работают с данными владельца и принимаются только от самого узла или сопряженного устройства; маршруты `public` могут вызывать другие пиры.
2. **DTO.** Добавьте структуры запроса и ответа в `event/event.go` (общие типы — в `domain/`).
3. **Обработчик.** Создайте `core/handler/<feature>.go` с узкими интерфейсами для зависимостей и фабрикой `Stream<Feature>Handler(...) warpnet.WarpHandlerFunc`.
4. **Хранилище.** Добавьте методы репозитория в `database/`, используя построитель префиксов из `database/local-store`.
5. **Подключение.** Создайте репозиторий и зарегистрируйте `{route, handler}` в `cmd/node/member/node/member-node.go` (в одной из групп `*Handlers`, которые вызываются из `setupHandlers`); при необходимости добавьте интерфейс в `types.go`.
6. **Тест.** Добавьте `core/handler/<feature>_test.go`; возьмите стиль заглушек из `reaction_test.go`.
7. **Клиенты.** Если маршрут вызывает интерфейс, повторите его в каждом клиенте (подробности — в разделе [Клиенты](clients.md#keeping-the-contract-in-lockstep)):
   - desktop: константа и метод в `frontend/src/service/service.js`, затем компонент Vue;
   - Android: `ProtocolIds.kt`, Moshi DTO, метод `WarpnetRepository`;
   - iOS: запустите `warpfone/scripts/generate-protocol-ids.sh`, добавьте DTO и case в роутере.
8. **Правила проекта.** Лицензионный заголовок в новых файлах, тесты и линтеры без замечаний (см. ниже).

## Тесты и линтеры {#tests-and-linters}

```bash
make tests            # CGO_ENABLED=0 go test -short -p 8 -v ./...
go test -race -short ./...   # то, что запускает CI-задача Linux amd64 (-race требует cgo)
golangci-lint run     # конфиг: .golangci.yaml
```

- `.golangci.yaml` включает все линтеры (`default: all`) за вычетом явного списка отключенных, работает в режиме vendor, ослабляет несколько линтеров для файлов `_test.go` и ослабляет стилевые линтеры для `warpdroid/node/`, потому что gomobile возвращает ошибки строками.
- Мобильный узел закрыт тегом `mobile`, поэтому `./...` его пропускает. Тестируйте его так: `go test -race -count=1 -tags mobile ./warpfone/node/... ./warpdroid/node/...`.
- Фронтенд: `cd frontend && npm test` запускает Vitest (`tests/**/*.spec.js`). `npm run serve` запускает dev-сервер Vue; в режиме разработки `src/lib/backend-mock.js` подменяет Go-привязки моком в памяти, так что узел не нужен. Для реальных данных используйте удаленный узел.
- iOS: `swift test --package-path warpfone/Packages/WarpnetTransport` и `swift test --package-path warpfone/Packages/Network`.
- `make check-heap` выводит отчет escape-анализа (какие значения уходят со стека в кучу) — тот же, что CI публикует в pull request.

## CI-воркфлоу {#ci-workflows}

Все воркфлоу лежат в [`.github/workflows`](https://github.com/Warp-net/warpnet/tree/main/.github/workflows).

| Воркфлоу | Когда запускается | Что делает |
|---|---|---|
| `tests-static-check.yaml` | каждый PR, push в `main`, вручную | `go mod verify`, golangci-lint, govulncheck (не блокирует), `go test -race` на Linux amd64 (`-short`, покрытие в Codecov) и arm64, macOS (`-short`) и Windows |
| `heap-escape-analysis.yaml` | каждый PR, push в `main`, вручную | информационный отчет escape-анализа в комментарии к PR |
| `build-warpdroid.yml` | PR в `develop` | собирает AAR через gomobile и debug APK; при ошибке публикует лог сборки |
| `fdroid-check.yml` | PR в `main` или `develop`, затрагивающие `warpdroid/`, `go.mod`, `go.sum` или `vendor/golang.org/x/mobile`; теги `v*`; вручную | в образе buildserver F-Droid: нет закоммиченных бинарников, AAR собран из исходников, проверка лицензий, нет проприетарных зависимостей Google, релизная сборка |
| `build-warpfone.yml` | PR в `develop` | собирает `Warpnet.xcframework` для симулятора и приложение через `xcodebuild` |
| `test-warpfone.yaml` | PR в `develop`, затрагивающие `warpfone/`, `warpdroid/node/`, `event/paths.go`, `go.mod` или `go.sum` | проверяет, что `ProtocolIds.swift` перегенерирован и что две копии мобильного узла совпадают, запускает тесты Swift и мобильные тесты Go |
| `build.yaml` (Build Mainnet) | push в `main`, вручную | собирает и публикует образ relay `ghcr.io/warp-net/warpnet-relay` |
| `build-deploy-testnet.yaml` | вручную | собирает образы relay, moderator, echo и remote и разворачивает хост testnet |
| `release.yaml` | вручную, с тегом | артефакты релиза (см. ниже) |
| `release-warpfone.yaml` | вручную, с тегом | сборка iOS в TestFlight |
| `snap.yml` | push в ветку `snap`, вручную | собирает Snap и загружает его в Snap Store (`snapcraft upload --release beta`) |

## Процесс релиза {#release-process}

Файл `version` — единственный источник истины. Он встраивается в бинарник, сборка Android берет из него `versionName` и `versionCode`, а его мажорный номер входит в сетевой ключ.

1. **Повышение версии.** Хук `pre-commit` в `.githooks/` увеличивает патч-номер при каждом коммите в `main` или `develop` и синхронизирует с ним `snap/snapcraft.yaml`, `frontend/package.json` и `package-lock.json`, `warpdroid/fdroid/versionCode`, `warpfone/Version.xcconfig` и файл changelog для F-Droid. Мейнтейнеры включают хук командой `make setup-hooks`; в любой другой ветке он ничего не делает. Не меняйте версию вручную.
2. **Тег.** Мейнтейнер создает и пушит тег `v<version>`.
3. **Release-воркфлоу.** Запустите **Release** с этим тегом. Воркфлоу не повышает версии, не коммитит и не ставит теги. Он собирает:
   - member-бинарник для Linux amd64 и arm64, macOS (universal) и Windows amd64;
   - relay и модератор для Linux amd64;
   - подписанный APK для Android;
   - файл контрольной суммы SHA-256 для каждого артефакта, затем подписывает каждый файл контрольной суммы релизным ключом Ed25519 (`*.sig`).
4. **iOS.** Если релиз затрагивает приложение для iOS, запустите **Release / Warpfone** с тем же тегом; он загружает сборку в TestFlight.
5. **Snap.** Push в ветку `snap` запускает воркфлоу Snap.

Узлы с включенным самообновлением раз в час проверяют последний релиз на GitHub и проверяют файл контрольной суммы и его подпись, прежде чем заменить бинарник (`core/selfupdate`). Release-воркфлоу не подписывает и не нотаризует сборку для macOS.

## Порядок внесения изменений {#contribution-workflow}

1. Создайте ветку от `develop`.
2. Внесите изменение:
   - каждый новый файл `.go` содержит заголовок AGPL: скопируйте блок комментариев из начала существующего файла, например `core/handler/reaction.go`, включая строку `// SPDX-License-Identifier: AGPL-3.0-or-later`. У файлов Kotlin в `warpdroid/` свой короткий SPDX-заголовок;
   - если вы меняли интерфейс, закоммитьте пересобранный `frontend/dist`;
   - не трогайте `vendor/` вручную и не повышайте `version`.
3. Запустите `make tests` и `golangci-lint run`.
4. Откройте pull request в `develop`.

Отправляя вклад, вы принимаете [Contributor License Agreement](../legal/CLA.md).

## Устранение неполадок {#troubleshooting}

| Симптом | Причина и решение |
|---|---|
| Изменения интерфейса не появляются в desktop-сборке | `skipfrontend: true` и встроенный `dist`: выполните `make frontend`, затем пересоберите бинарник. |
| Два локальных узла не видят друг друга | Разные `--node.network`, разная мажорная версия или своя сеть без `--node.bootstrap` и не в одной локальной сети. |
| `bind: address already in use` | Две цели Makefile на одном порту (4002); передайте `--node.port`. |
| Второе окно desktop-приложения не открывается | Блокировка единственного экземпляра; используйте удаленный узел. |
| Модератор завершается сразу после старта | Сборка без `-tags=llama` (движок не скомпилирован, `failed to start moderator`) или нет файла модели в рабочем каталоге. |
| `wails build` падает в Linux | Не хватает dev-пакетов GTK/WebKit или пропущен `-tags webkit2_41`. |
| Изменения кода Go не влияют на Android | Gradle использовал существующий `warpnet.aar`; снова запустите `warpdroid/node/build-native.sh`. |
| В Android пустые поля, а в desktop все в порядке | Kotlin DTO или `ProtocolIds.kt` разошлись с Go; см. [Клиенты](clients.md#keeping-the-contract-in-lockstep). |
| Нужно больше подробностей | `LOGGING_LEVEL=debug`, а для структурированных логов — `--logging.format json`. |

## См. также {#see-also}

- [Клиенты](clients.md): как desktop-приложение, браузер и мобильные приложения обращаются к узлу
- [Справочник API](api.md): все маршруты из `event/paths.go`
- [Stream API](stream-API.md): фрейминг запросов поверх потоков libp2p
- [Архитектура](../architecture.md): роли, компоненты и потоки данных
- [Как помочь](../HOW-TO-HELP.md): где вклад нужнее всего
