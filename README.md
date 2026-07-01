# FrotaControl

Sistema local para controle de frota.

## Rodar local

Requer Node.js 24 ou superior.

Antes de iniciar, configure `DATABASE_URL` com a string do Neon.

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

## Banco de dados

O projeto agora usa Postgres da Neon via `DATABASE_URL`.

Exemplo de `.env`:

```bash
DATABASE_URL=postgresql://usuario:senha@ep-xxxxx.us-east-1.aws.neon.tech/frota?sslmode=require
```

O servidor cria automaticamente as tabelas necessárias na primeira inicialização.

## Rodar em Docker

Requer Docker e Docker Compose na VM.

```bash
docker compose up -d --build
```

O app fica disponivel em:

```text
http://IP_DA_VM:3000
```

Para popular o banco com dados ficticios:

```bash
npm run seed
```

No Docker, a aplicação também usa `DATABASE_URL` do ambiente.
