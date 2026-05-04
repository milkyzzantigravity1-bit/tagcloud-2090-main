# Деплой tagcloud

Все файлы в этой папке — **шаблоны**. Перед использованием замените
`yourdomain.tld`, `CHANGE_ME` и пути на реальные.

## Состав

| Файл | Назначение |
|---|---|
| `Caddyfile.example` | Reverse-proxy + автоматический TLS Let's Encrypt + security-заголовки. |
| `tagcloud.service` | systemd unit для Node-процесса с graceful shutdown и hardening. |
| `tagcloud.env.example` | Все переменные окружения рантайма (DATABASE_URL, REDIS_URL, SMTP, ORIGIN). |
| `tagcloud-backup.service` | systemd unit для бэкап-задачи (вызывает `scripts/ops/backup.sh`). |
| `tagcloud-backup.timer` | systemd timer — ежедневно в 03:30 UTC. |
| `backup.env.example` | Конфиг бэкапа (DATABASE_URL + restic-репозиторий + пароль). |

## Первый деплой (типовой self-host)

Предполагаем сервер с Ubuntu 22.04+ или Debian 12+, root-доступ, public IP,
DNS A-запись `yourdomain.tld → IP` уже создана.

### 1. Системные пакеты

```bash
apt update
apt install -y postgresql redis-server caddy restic
# Node 22 через NodeSource (или nvm — на ваш вкус):
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
```

### 2. Сервисный пользователь и каталоги

```bash
useradd -r -s /usr/sbin/nologin tagcloud
mkdir -p /opt/tagcloud /etc/tagcloud /var/log/tagcloud
chown -R tagcloud:tagcloud /opt/tagcloud /var/log/tagcloud
chmod 750 /etc/tagcloud
```

### 3. Postgres

```bash
sudo -u postgres psql <<SQL
CREATE USER tagcloud WITH PASSWORD 'CHANGE_ME';
CREATE DATABASE tagcloud OWNER tagcloud;
SQL
```

### 4. Сборка

```bash
cd /opt/tagcloud
sudo -u tagcloud git clone https://github.com/milkyzzantigravity1-bit/tagcloud-2090-main .
sudo -u tagcloud npm ci
sudo -u tagcloud npm run build
sudo -u tagcloud DATABASE_URL=... npm run db:migrate
```

### 5. Конфиги

```bash
cp deploy/tagcloud.env.example /etc/tagcloud/tagcloud.env
cp deploy/backup.env.example /etc/tagcloud/backup.env
chmod 600 /etc/tagcloud/*.env
chown tagcloud:tagcloud /etc/tagcloud/*.env
# Отредактировать оба файла, заполнить реальные секреты:
$EDITOR /etc/tagcloud/tagcloud.env /etc/tagcloud/backup.env
```

### 6. Systemd

```bash
cp deploy/tagcloud.service /etc/systemd/system/
cp deploy/tagcloud-backup.service /etc/systemd/system/
cp deploy/tagcloud-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now tagcloud
systemctl enable --now tagcloud-backup.timer
```

Проверка:

```bash
systemctl status tagcloud
journalctl -u tagcloud -f
curl http://127.0.0.1:3000/healthz   # должно вернуть "ok"
curl http://127.0.0.1:3000/readyz    # должно вернуть {"ok":true,...}
```

### 7. Caddy

```bash
cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sed -i 's/yourdomain.tld/имя-вашего-домена/g' /etc/caddy/Caddyfile
systemctl reload caddy
```

Caddy автоматически выпустит TLS-сертификат при первом обращении к домену.

### 8. Первый бэкап вручную

```bash
sudo -u tagcloud bash -c 'set -a; source /etc/tagcloud/backup.env; set +a; /opt/tagcloud/scripts/ops/backup.sh'
restic -r "$RESTIC_REPOSITORY" snapshots   # должен показать первую запись
```

## Обновление

```bash
cd /opt/tagcloud
sudo -u tagcloud git pull
sudo -u tagcloud npm ci
sudo -u tagcloud npm run build
sudo -u tagcloud DATABASE_URL=... npm run db:migrate
systemctl restart tagcloud
```

`hooks.server.ts` корректно обрабатывает SIGTERM (флашит in-memory очередь
голосов и закрывает WS-комнаты). systemd ждёт до 30с (`TimeoutStopSec=30`).

## Отсутствие домена

Можно временно деплоить по IP без TLS — раскомментируйте блок `:80` в
`Caddyfile.example` и удалите блок `yourdomain.tld {…}`. После регистрации
домена верните как было и перезагрузите Caddy.
