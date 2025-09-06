VK Video Comments Exporter

Описание
- Веб‑приложение для выгрузки комментариев к видео ВК: JSON/CSV.
- Авторизация через VK (implicit flow, redirect на https://oauth.vk.com/blank.html).
- UI: React + Vite + Tailwind (тёмная тема, glassmorphism), Docker-образ с сервером Express.

Быстрый старт локально
1) Установите Node 20+ и npm.
2) Клиент:
   - cd client && npm install && npm run dev
   - UI: http://localhost:5173
3) Сервер:
   - cd server && npm install && node src/index.js
   - Health: http://localhost:8080/api/health

Docker (локально)
- Собрать и запустить:
  ```bash
  docker compose up --build -d
  ```
- Открыть: http://localhost:8080

Готовый образ (Docker Hub)
- Имя: ludenser/vk_comments_exporter:latest
- Запуск на любой машине с Docker:
  ```bash
  docker pull ludenser/vk_comments_exporter:latest
  docker run -d --name vkcomments --restart unless-stopped -p 8080:8080 ludenser/vk_comments_exporter:latest
  ```

Обновление на сервере (VPS)
- Сценарий scripts/update.sh:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/<YOUR_GH_USERNAME>/<REPO>/main/scripts/update.sh -o update.sh
  bash update.sh
  ```
- Или вручную:
  ```bash
  docker pull ludenser/vk_comments_exporter:latest
  docker rm -f vkcomments
  docker run -d --name vkcomments --restart unless-stopped -p 8080:8080 ludenser/vk_comments_exporter:latest
  ```

Как получить токен VK
1) Создайте Standalone‑приложение VK и возьмите APP_ID.
2) В UI введите APP_ID и нажмите «Открыть окно авторизации».
3) После разрешения доступа на странице blank.html скопируйте URL с #access_token=...
4) Вставьте URL/токен в поле — он сохранится автоматически.

Использование UI
1) Авторизация: получить и сохранить токен.
2) Ссылка/ID: вставить https://vk.com/video-OWNER_VIDEO — ownerId/videoId подставятся автоматически или заполнить вручную.
3) Выгрузка: скачать JSON или CSV. CSV импортируется в Excel/Google Sheets (Файл → Импорт → Загрузить → разделитель «точка с запятой»).

Сборка и публикация образа (для разработчиков)
```bash
docker login
docker build -t YOUR_DH_USER/vkcomments:latest .
docker push YOUR_DH_USER/vkcomments:latest
```

Reverse proxy и HTTPS (опционально)
- Быстрее всего Caddy:
  ```bash
  docker run -d --name caddy --restart unless-stopped \
    -p 80:80 -p 443:443 \
    -v caddy_data:/data -v caddy_config:/config \
    caddy caddy reverse-proxy --from your.domain.com --to 127.0.0.1:8080
  ```

Структура
- client/ — фронтенд (Vite, React, Tailwind)
- server/ — бэкенд (Express) + прокси к VK API
- Dockerfile, docker-compose.yml — контейнеризация
- scripts/update.sh — обновление контейнера из Docker Hub
