---
title: Архитектура relay-узла
description: Тип узла relay — что он делает, как он связан с bootstrap-узлами, что держит в памяти, какие у него лимиты circuit relay и как запустить свой.
---

# Архитектура relay-узла {#relay-node-architecture}

Relay — один из трех типов узлов Warpnet ([`cmd/node/relay`](https://github.com/Warp-net/warpnet/tree/main/cmd/node/relay)). Это узел без интерфейса (headless) на публичном адресе: DHT-сервер, circuit relay для узлов за NAT, пересыльщик gossip и оценщик пиров. Он не хранит пользовательский контент и ничего не пишет на диск. Эта страница объясняет, что делает relay-узел, как он связан с bootstrap-узлами, что он хранит, какие лимиты соблюдает и как его запустить.

## Relay и bootstrap {#relay-and-bootstrap}

«Relay» — это тип узла: бинарный файл relay, который сообщает `type: "relay"` в информации об узле ([`core/warpnet/warpnet.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/warpnet.go)). «Bootstrap-узел» — это позиция: любой адрес из списка bootstrap-узлов какого-либо узла. Узел в первую очередь подключается к своим bootstrap-узлам, заполняет от них свою DHT и, если находится за NAT, резервирует слоты circuit relay только на них. Member-узел, кроме того, дает им наивысший приоритет соединения и передает этот список подключенным телефонам. См. [Bootstrap-узлы](architecture.md#bootstrap-nodes).

Встроенные списки bootstrap-узлов для mainnet и testnet содержат три relay-узла, которые запускает проект (см. [Relay-узлы по умолчанию](#default-relays)), поэтому по умолчанию bootstrap-узлы — это relay-узлы. Как circuit relay relay-узел полезен только тем узлам, у которых он есть в списке bootstrap-узлов; для всех остальных это обычный пир DHT и gossip.

## Что делает relay-узел {#what-a-relay-does}

| Задача | Как |
|---|---|
| DHT | Запускает Kademlia DHT под префиксом сети (`/warpnet` или `/testnet`). Его доступность принудительно объявлена публичной, поэтому DHT в автоматическом режиме с самого начала работает на нем как DHT-сервер. |
| Circuit relay | Обслуживает libp2p circuit relay v2, поэтому узел за NAT, у которого этот relay-узел есть в списке bootstrap-узлов, может держать на нем резервирование (reservation) и быть доступным через него. |
| Gossip | Участвует в GossipSub в топиках обнаружения, жалоб, голосования модераторов и рейтинга. Анонсы обнаружения и записи рейтинга он обрабатывает сам; жалобы и голоса только передает дальше. Как и любой узел, он анонсирует в топике обнаружения свои адреса и адреса до десяти подключенных пиров. |
| Обнаружение | Подключается к каждому пиру, о котором узнает из DHT, gossip-анонсов и от вызывающих `/public/get/info/0.0.0`, запрашивает информацию об узле и задает приоритет соединения. Он запоминает телефоны, которые member-узлы указывают как подключенные, и не опрашивает их как узлы. Профили пользователей не загружает. |
| Рейтинг | Оценивает пиров по тому, что видит в сети, и держит в памяти реплику записей рейтинга всей сети. См. [Рейтинг](rating.md). |

Чего relay-узел не делает: не хранит посты, профили и ленты, не ведет статистику постов, не запускает mDNS, и у него нет базы данных. Relay — это тот же код под лицензией AGPL, что и все остальное, поэтому запустить такой узел может любой.

### Маршруты {#routes}

Помимо собственных протоколов libp2p (identify, ping, circuit relay, AutoNAT, hole punching, Kademlia, GossipSub), relay-узел регистрирует два маршрута Warpnet ([`cmd/node/relay/node/relay-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/relay/node/relay-node.go)):

| Маршрут | Назначение |
|---|---|
| `/public/get/info/0.0.0` | Возвращает информацию об узле relay. Вызывающий также передается в обнаружение. |
| `/public/post/relay/refuse/reservation/0.0.0` | Позволяет member-узлу, у которого есть резервирование на этом relay-узле, запретить каналы (circuits) от заблокированного им пира (см. [Запрет каналов](#refusing-circuits)). |

Запросы проходят ту же цепочку middleware, что и на member-узле: логирование, ограничение частоты запросов, проверку подписи и идемпотентность. Маршрутов `private` relay-узел не регистрирует.

## Что он хранит {#what-it-keeps}

Все хранится в памяти и пропадает после перезапуска.

| Данные | Где хранятся | Срок жизни |
|---|---|---|
| Peerstore (peer ID, адреса, открытые ключи) | peerstore в памяти | до остановки |
| Таблица маршрутизации и записи DHT | map в памяти | записи истекают через час; при остановке пропадает все |
| Записи рейтинга | реплика CRDT рейтинга в памяти | до остановки; после перезапуска снова синхронизируются с пирами |
| Резервирования каналов и запреты | relay-сервис | один час на резервирование и на запрет |
| Подключенные телефоны member-узлов | кэш обнаружения | до 4096 записей, 72 часа |

Сам relay-узел ничего не пишет на диск. Файловую систему хоста затрагивают две вещи:

- При запуске общий код конфигурации создает каталог приложения `~/.warpdata`, если его нет ([`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go)). В него ничего не записывается.
- Модуль самообновления, когда он активен, скачивает новый релиз рядом с бинарным файлом и заменяет бинарный файл, оставляя предыдущий рядом с ним ([`core/selfupdate`](https://github.com/Warp-net/warpnet/tree/main/core/selfupdate)). См. [Самообновление](#self-update).

Логи пишутся в стандартный вывод.

## Транспорт и лимиты {#transport-and-limits}

Relay-узел использует тот же транспортный стек, что и все остальные типы узлов: маскирующий TLS, сетевой ключ (PSK), Noise XX и yamux. Он слушает TCP по IPv4 и IPv6 на одном порту. См. [Сеть](network.md). Особенности relay-узла:

- **Принудительно публичная доступность.** Relay-узел по определению разворачивается на статическом публичном адресе, поэтому не ждет, пока это подтвердит AutoNAT. Пирам за NAT relay-узел нужен раньше, чем они смогут что-либо помочь подтвердить.
- **Нет состояния приложения**, как описано выше.

### Лимиты circuit relay v2 {#circuit-relay-v2-limits}

Лимиты одинаковы для всех типов узлов ([`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go)):

| Лимит | Значение |
|---|---|
| Длительность одного ретранслируемого соединения | 1 час |
| Объем данных на одно ретранслируемое соединение | 1 GiB |
| Срок жизни резервирования | 1 час |
| Всего резервирований | 128 |
| Резервирований на IP-адрес | 8 |
| Резервирований на ASN | 32 |
| Открытых ретранслируемых соединений на пир | 16 |
| Размер буфера relay | 4096 байт |

Ретранслируемое соединение несет шифротекст Noise из конца в конец между двумя узлами. Relay-узел видит оба IP-адреса и peer ID, время и объем трафика, но не содержимое.

### Запрет каналов {#refusing-circuits}

Допустим, member-узел заблокировал пира, и этот пир пытается связаться с ним через relay-узел. Тогда фильтр соединений (connection gater) member-узла отклоняет соединение и просит relay-узел по маршруту `/public/post/relay/refuse/reservation/0.0.0` больше не устанавливать каналы от этого пира ([`core/node/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/options.go)). Relay-узел принимает такую просьбу только от пира, у которого есть резервирование на нем. Он хранит запрет в течение срока жизни резервирования (один час) и держит не более 256 запрещенных пиров на один member-узел ([`core/relay/reservation-refusals.go`](https://github.com/Warp-net/warpnet/blob/main/core/relay/reservation-refusals.go)).

### Лимиты соединений {#connection-limits}

Relay-узел запускает менеджер ресурсов libp2p с лимитами соединений на подсеть и ограничением частоты новых соединений на подсеть. Также работает менеджер соединений с порогами по умолчанию 20 и 50 соединений и льготным периодом в один час для новых соединений ([`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go)). Когда менеджеру соединений нужно сократить их число, он в первую очередь сохраняет публично доступных пиров и пиров с хорошим рейтингом. Входящее обнаружение ограничено по частоте для каждого IP-адреса, поэтому всплеск анонсов не может исчерпать ресурсы узла.

## Relay-узлы по умолчанию {#default-relays}

Встроенные списки bootstrap-узлов в [`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go) указывают на три relay-узла, которые проект Warpnet запускает на одном хосте, `207.154.221.44` (IPv6 `2a03:b0c0:3:f0:0:3:2477:f000`). Каждый relay-узел указан с адресом IPv4 и адресом IPv6.

| Сеть | TCP-порт | Peer ID |
|---|---|---|
| warpnet (mainnet) | 4001 | `12D3KooWMKZFrp1BDKg9amtkv5zWnLhuUXN32nhqMvbtMdV2hz7j` |
| warpnet (mainnet) | 4002 | `12D3KooWSjbYrsVoXzJcEtmgJLMVCbPXMzJmNN1JkEZB9LJ2rnmU` |
| warpnet (mainnet) | 4003 | `12D3KooWNXSGyfTuYc3JznW48jay73BtQgHszWfPpyF581EWcpGJ` |
| testnet | 4011 | `12D3KooWMKZFrp1BDKg9amtkv5zWnLhuUXN32nhqMvbtMdV2hz7j` |
| testnet | 4022 | `12D3KooWSjbYrsVoXzJcEtmgJLMVCbPXMzJmNN1JkEZB9LJ2rnmU` |
| testnet | 4033 | `12D3KooWNXSGyfTuYc3JznW48jay73BtQgHszWfPpyF581EWcpGJ` |

Полная запись — это мультиадрес, например:

```text
/ip4/207.154.221.44/tcp/4001/p2p/12D3KooWMKZFrp1BDKg9amtkv5zWnLhuUXN32nhqMvbtMdV2hz7j
```

У сетей с любым другим именем встроенного списка нет. `--node.bootstrap` (или `NODE_BOOTSTRAP`) — список мультиадресов через запятую — **заменяет** встроенный список, а не дополняет его. Member-узел также может хранить собственный список в своих сетевых настройках; этот список имеет приоритет над конфигурацией.

## Запуск relay-узла {#running-a-relay}

Вам нужен хост с публичным IP-адресом и открытым TCP-портом. Relay-узел собирается без cgo и не собирается под Windows (`//go:build !windows` в [`cmd/node/relay/main.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/relay/main.go)).

### Бинарный файл из релиза {#release-binary}

К каждому релизу на GitHub приложена сборка для Linux amd64, `relay_linux_amd64.tar.gz`, вместе с `relay_linux_amd64_checksums.txt` и его подписью Ed25519 `relay_linux_amd64_checksums.txt.sig`. В архиве один исполняемый файл, `relay`. Это та же сборка, которую устанавливает модуль самообновления relay-узла.

### Из исходного кода {#from-source}

```bash
# запуск напрямую в testnet с выводом сетевого ключа
go run cmd/node/relay/main.go --node.network testnet --node.print-psk

# или сборка статического бинарного файла
CGO_ENABLED=0 go build -o warpnet-relay cmd/node/relay/main.go
./warpnet-relay --node.network testnet --node.port 4011 \
  --node.host.v4 203.0.113.10 --node.seed 'a long random secret'
```

При запуске relay-узел выводит свой peer ID и адреса:

```text
RELAY NODE STARTED WITH ID 12D3KooW... AND ADDRESSES [...]
```

Объедините публичный адрес, порт и peer ID в мультиадрес (`/ip4/<address>/tcp/<port>/p2p/<peer ID>`) и добавьте его в список bootstrap-узлов ваших узлов через `--node.bootstrap` или в их сетевых настройках.

### С Docker {#with-docker}

[`Dockerfile.relay`](https://github.com/Warp-net/warpnet/blob/main/Dockerfile.relay) собирает статический бинарный файл в образ distroless. Собственные relay-узлы проекта в testnet запускают образ `ghcr.io/warp-net/warpnet-relay:latest` с сетью хоста и лимитом памяти 192 MiB ([`deploy/docker-compose-testnet.yml`](https://github.com/Warp-net/warpnet/blob/main/deploy/docker-compose-testnet.yml)). Та же конфигурация с локальной сборкой:

```bash
docker build -f Dockerfile.relay -t warpnet-relay .
docker run -d --name warpnet-relay --network host --restart unless-stopped \
  -e NODE_NETWORK=testnet \
  -e NODE_PORT=4011 \
  -e NODE_HOST_V4=203.0.113.10 \
  -e NODE_SEED='a long random secret' \
  -e LOGGING_FORMAT=json \
  warpnet-relay
```

### Параметры {#options}

Флаги и переменные окружения читает [`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go); флаг имеет приоритет над своей переменной окружения.

| Флаг | Переменная окружения | По умолчанию | Значение для relay-узла |
|---|---|---|---|
| `--node.network` | `NODE_NETWORK` | `warpnet` | обслуживаемая сеть; `mainnet` — псевдоним `warpnet` |
| `--node.port` | `NODE_PORT` | `4001` | TCP-порт на IPv4 и IPv6 |
| `--node.host.v4` | `NODE_HOST_V4` | `0.0.0.0` | IPv4-адрес для прослушивания |
| `--node.host.v6` | `NODE_HOST_V6` | `::` | IPv6-адрес для прослушивания |
| `--node.seed` | `NODE_SEED` | пусто | seed ключа и peer ID relay-узла |
| `--node.bootstrap` | `NODE_BOOTSTRAP` | встроенный список | собственный список bootstrap-узлов relay-узла; заменяет встроенный список |
| `--node.print-psk` | `NODE_PRINT_PSK` | `false` | выводить сетевой ключ в лог после запуска |
| `--node.self-update` | `NODE_SELF_UPDATE` | `true` | автоматически устанавливать новые релизы |
| `--logging.level` | `LOGGING_LEVEL` | `info` | `debug`, `info`, `warn` или `error` |
| `--logging.format` | `LOGGING_FORMAT` | `text` | `text` или `json` |
| `--database.dir` | `DATABASE_DIR` | `storage` | у relay-узла нет базы данных; используется только в запасном seed |

Полный справочник по конфигурации — на странице [Запуск узла](user-guide/running-a-node.md).

### Идентичность и seed {#identity-and-the-seed}

Ключ Ed25519 relay-узла выводится из seed. Поэтому один и тот же seed всегда дает один и тот же peer ID, и ваш мультиадрес остается действительным после перезапусков и переноса на другие хосты.

> **Внимание:** Если `--node.seed` пуст, seed — это строка `seed`, за которой следуют имя сети, `--database.dir`, IPv4-адрес для прослушивания и порт. Все эти значения публичны, поэтому любой может вычислить закрытый ключ relay-узла и выдать себя за его peer ID. Всегда задавайте в `--node.seed` длинный случайный секрет и держите его в тайне.
{: .warning }

### Сетевой ключ {#the-network-key}

`--node.print-psk` выводит сетевой ключ в лог после запуска в виде 64 шестнадцатеричных символов:

```text
CURRENT PSK: <hex>
```

Ключ — это `SHA-256(network name + major version)` ([`security/psk.go`](https://github.com/Warp-net/warpnet/blob/main/security/psk.go)). Он не секретный: он разделяет сети и мажорные версии, чтобы несовместимый узел отваливался на первых же байтах. Вывод ключа помогает проверить, что relay-узел и его клиенты находятся в одной сети и на одной версии. См. [Сеть](network.md).

### Самообновление {#self-update}

Если включен `--node.self-update` (по умолчанию включен), relay-узел проверяет последний релиз на GitHub через минуту после запуска, а затем каждый час. В отличие от member-узла, он никого не спрашивает. Он проверяет подпись Ed25519 списка контрольных сумм релиза по ключу релизов, встроенному в бинарный файл, проверяет SHA-256 архива, заменяет собственный бинарный файл (предыдущий остается рядом как `<binary>.old`) и перезапускается на месте с тем же ID процесса. Если такой перезапуск не удался, он возвращает предыдущий бинарный файл, записывает версию в `<binary>.failed`, чтобы в дальнейшем ее пропускать, и завершается. Если каталог бинарного файла недоступен для записи, узел только пишет в лог, что вышел новый релиз.

Файлы релизов relay-узла есть только для Linux на amd64; на любой другой платформе самообновление остается выключенным. Новая мажорная версия меняет сетевой ключ, поэтому обновленный relay-узел присоединяется к пирам с новой мажорной версией. Чтобы обновлять узел вручную, задайте `--node.self-update=false`.

### Своя приватная сеть {#your-own-private-network}

Чтобы запустить полностью отдельную сеть, запустите свой relay-узел и свои member-узлы с одним и тем же собственным именем в `--node.network` и передайте member-узлам мультиадрес вашего relay-узла через `--node.bootstrap`. Собственное имя дает другой сетевой ключ и другой префикс DHT, поэтому эти узлы никогда не встретятся с публичной сетью.

Если вы хотите остаться в mainnet, но не зависеть от relay-узлов проекта, поставьте вместо них в список bootstrap-узлов ваших member-узлов свой relay-узел; member-узел передает тот же список подключенным телефонам. Relay-узел, запущенный в mainnet без `--node.bootstrap`, сам использует встроенный список, поэтому он подключается к публичной сети, и его member-узлы по-прежнему могут достигать других публичных узлов через DHT и gossip.

## См. также {#see-also}

- [Архитектура](architecture.md)
- [Архитектура member-узла](member-node-architecture.md)
- [Сеть](network.md)
- [Обнаружение](discovery.md)
- [Запуск узла](user-guide/running-a-node.md)
