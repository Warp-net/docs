# WarpNet Storage Layer

This document describes how WarpNet stores user data securely, how authentication integrates with the encrypted 
database, and how data is structured in a prefix-based flat key-value store using BadgerDB.

---

## 0. Database Directory Resolution

WarpNet determines the location of its local database based on the operating system. 
This ensures that data is stored in a user-accessible and system-compliant location.

### Platform-Specific Paths

```go
switch runtime.GOOS:
    windows → %LOCALAPPDATA%\\badgerdb
    linux   → $HOME/.badgerdb
    darwin  → $HOME/.badgerdb
    android → $HOME/.badgerdb
```

### Windows

```text
C:\Users\{username}\AppData\Local\badgerdb
```

Obtained from the `%LOCALAPPDATA%` environment variable. If it's missing, WarpNet terminates with a fatal error.

### Linux/macOS/Android

```text
/home/{username}/.badgerdb
```

Resolved via `os.UserHomeDir()`. This makes the database portable per user and invisible in the file browser 
by default (`.` prefix).

### Directory Creation

Before use, WarpNet ensures the directory exists.
If creation fails, the application exits with a fatal log.

> ⚠️ If you need to override this behavior (e.g., for sandboxing or external storage), the path should be 
> injected via configuration or overridden in build logic.

---

## 1. Encrypted Embedded Database (BadgerDB)

WarpNet uses [BadgerDB](https://github.com/dgraph-io/badger) as its local embedded storage engine. All content is encrypted at rest and 
accessible only after authentication.

### Encryption Model

The encryption key is derived from:

```javascript
sha256(username + "@" + password)
```

This key is passed to Badger’s `WithEncryptionKey(...)` and never persisted.

### ⚠Access Behavior

* If credentials are wrong → `ErrEncryptionKeyMismatch`
* If the DB folder is unexpectedly emptied → process exits
* First run is detected via `isDirectoryEmpty(...)` check

---

## 2. Authentication-Integrated Crypto

When the user logs in through `AuthRepo.Authenticate(username, password)`, the following happens:

1. The database is decrypted and opened
2. Two secrets are derived:

    * **Session token** for WebSocket auth
    * **Private key** for node operations

### Session Token Generation

The token is generated using randomness and timestamp:

```javascript
seed = username + "@" + password + "@" + rand + "@" + currentTime
token = sha256(seed)
```

Used to authorize WebSocket sessions with the frontend.

### Private Key Derivation

The private key is deterministically derived:

```javascript
seed = sha256(username + "@" + password + "@" + repeat("@", password.length))
privateKey = GenerateKeyFromSeed(seed)
```

This key is:

* Not stored
* Stable across logins (same credentials → same key)
* Used to initialize the main node

---

## 3. Prefix-Based Key Structure

Although BadgerDB is flat, WarpNet uses structured **namespace-like keys**. 
Keys are constructed using the `PrefixBuilder` and form logical hierarchies.

### Key Pattern

```text
/<namespace>/<root>/<range>/<id>/<id>/<id>...
```

### Example

```text
/chat/user123/{reversed-timestamp}/conversation456/message789
```

This simulates a tree:

```
/chat
  └── user123
       └── 000000000123456789
            └── conversation456
                 └── message789
```

### Reversed Timestamp for Sorting

BadgerDB utilize byte-wise lexicographical sorting order, so it’s possible to create a sorting-sensitive key. 
For example, /<namespace>/<root>/1747472925/<id> - here, the timestamp part of the key 
is treated as an attribute, and items are stored in the corresponding order.
You can replace the final `range` with a reverse timestamp to sort items by recency:

```text
/chat/user123/000000000123456789/conversation456/message789
```

Where {reversed-timestamp} is `MaxInt64 - timestamp.Unix()`

### Sample Code

```go
key := NewPrefixBuilder("/chat").
    AddRootID("user123").
    AddReversedTimestamp(time.Now()).
    AddParentId("conversation456").
    AddId("message789").
    Build()
```

Result:

```text
/chat/user123/000000000123456789/conversation456/message789
```

---

## 4. Garbage Collection and Directory Monitoring

A background process performs periodic cleanup:

* GC: `RunValueLogGC(discardRatio)` every 8h
* Folder watch: exits the process if DB folder becomes empty

This ensures data safety and prevents silent resets.

---

## 5. First-Run Behavior

On startup, the DB checks whether its directory is empty. If so, it is considered a **first run**, 
and a new store is initialized.

This is useful for:

* New user onboarding
* Portable storage resets
* Ephemeral testing environments

---

## 6. In-Memory Mode

WarpNet supports a memory-only mode via:

```go
opts.WithInMemory(true)
```

This is suitable for:

* Testing
* Demos
* Disposable sessions

All data is lost on shutdown.

---

## 7. No Recovery or Reset

There is **no password recovery** in WarpNet. All cryptographic identity and encryption is derived from 
login credentials.

> If you lose your password, your private key and data are permanently lost.

This design enforces strict data sovereignty and user ownership.

---
## Related Docs

- [BadgerDB Specification](https://docs.hypermode.com/badger/overview)

---