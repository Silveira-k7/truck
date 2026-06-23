# FrotaControl

Sistema local para controle de frota.

## Rodar local

Requer Node.js 24 ou superior.

```bash
npm install
npm run dev
```

O app roda em `http://127.0.0.1:5173/`.

Para popular com dados ficticios:

```bash
npm run seed
```

Login demo criado pelo seed:

```text
admin@local.test / 123456
```

## Banco local

Os dados ficam em SQLite no arquivo:

```text
data/frota.sqlite
```

Esse arquivo e seus auxiliares (`-wal`, `-shm`) ficam ignorados pelo Git.

## Rodar em Docker

Requer Docker e Docker Compose na VM.

```bash
docker compose up -d --build
```

O app fica disponivel em:

```text
http://IP_DA_VM:3000
```

Para popular o banco do container com dados ficticios:

```bash
docker compose exec frota npm run seed
```

O SQLite fica persistido no volume Docker `frota_data`, montado em `/app/data`.
