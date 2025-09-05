import React, { useEffect, useMemo, useRef, useState } from "react";
import Select from "./Select.jsx";

const APP_ID_DEFAULT = "";

function buildAuthUrl(appId, scope) {
  // Используем официальный редирект VK для Standalone/Implicit Flow,
  // чтобы не требовать настройки redirect_uri в приложении
  const redirect = "https://oauth.vk.com/blank.html";
  const params = new URLSearchParams({
    client_id: appId,
    display: "page",
    redirect_uri: redirect,
    scope,
    response_type: "token",
    v: "5.199",
  });
  return `https://oauth.vk.com/authorize?${params.toString()}`;
}

function parseVideoUrl(url) {
  const m = String(url).match(/video(-?\d+)_([0-9]+)/);
  if (!m) return {};
  return { ownerId: Number(m[1]), videoId: Number(m[2]) };
}

export default function App() {
  const [appId, setAppId] = useState(APP_ID_DEFAULT);
  const [scope, setScope] = useState("video");
  const [token, setToken] = useState(localStorage.getItem("vk_token") || "");
  const [videoUrl, setVideoUrl] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [appIds, setAppIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vk_app_ids") || "[]");
    } catch {
      return [];
    }
  });
  const [urlHistory, setUrlHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vk_video_urls") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    localStorage.setItem("vk_app_ids", JSON.stringify(appIds));
  }, [appIds]);
  useEffect(() => {
    localStorage.setItem(
      "vk_video_urls",
      JSON.stringify(urlHistory.slice(0, 5))
    );
  }, [urlHistory]);

  const authUrl = useMemo(
    () => (appId ? buildAuthUrl(appId, scope) : ""),
    [appId, scope]
  );

  const tryExtractToken = (input) => {
    try {
      const str = String(input || "");
      const fromHash = new URLSearchParams(str.replace(/^.*#/, ""));
      const t1 = fromHash.get("access_token");
      if (t1) return t1;
      // если вставили просто токен без URL
      if (/^vk\d?\./i.test(str) || str.length > 50) return str.trim();
      return "";
    } catch {
      return "";
    }
  };

  // Автопарсинг ссылки при вводе
  useEffect(() => {
    if (!videoUrl) return;
    const p = parseVideoUrl(videoUrl);
    if (p.ownerId && p.videoId) {
      if (String(p.ownerId) !== ownerId) setOwnerId(String(p.ownerId));
      if (String(p.videoId) !== videoId) setVideoId(String(p.videoId));
    }
  }, [videoUrl]);

  // Добавление URL в историю
  const pushUrlHistory = (url) => {
    const u = String(url || "").trim();
    if (!u) return;
    setUrlHistory((prev) => [u, ...prev.filter((x) => x !== u)].slice(0, 5));
  };

  const addAppId = () => {
    const id = (appId || "").trim();
    if (!id) return;
    if (!appIds.includes(id)) setAppIds([...appIds, id]);
    setMessage("APP_ID сохранён.");
    setMessageType("success");
  };

  const removeAppId = (id) => {
    const next = appIds.filter((x) => x !== id);
    setAppIds(next);
    if (appId === id) setAppId("");
    setMessage("APP_ID удалён.");
    setMessageType("warning");
  };

  const clearAppIds = () => {
    setAppIds([]);
    setMessage("Список APP_ID очищен.");
    setMessageType("warning");
  };

  const onParseVideo = () => {
    const p = parseVideoUrl(videoUrl);
    if (p.ownerId && p.videoId) {
      setOwnerId(String(p.ownerId));
      setVideoId(String(p.videoId));
      setMessage("ownerId/videoId заполнены.");
      setMessageType("success");
      pushUrlHistory(videoUrl);
    } else {
      setMessage("Не удалось распознать ссылку.");
      setMessageType("error");
    }
  };

  const onFetch = async () => {
    if (!token) {
      setMessage("Нет токена. Сначала авторизуйтесь.");
      setMessageType("error");
      return;
    }
    const o = Number(ownerId);
    const v = Number(videoId);
    if (!Number.isFinite(o) || !Number.isFinite(v)) {
      setMessage("Укажите ownerId и videoId.");
      setMessageType("warning");
      return;
    }
    setBusy(true);
    setMessage("Загрузка...");
    setMessageType("info");
    try {
      const res = await fetch("/api/video/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ownerId: o, videoId: v }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.message || res.statusText;
        if (
          /authorization failed|invalid token|expired|User authorization failed/i.test(
            msg
          )
        ) {
          localStorage.removeItem("vk_token");
          setToken("");
          setMessage("Токен недействителен или истёк. Авторизуйтесь заново.");
          setMessageType("error");
          return;
        }
        throw new Error(msg);
      }
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vk-comments-${o}_${v}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("JSON выгружен.");
      setMessageType("success");
    } catch (e) {
      setMessage("Ошибка: " + e.message);
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadCsv = async () => {
    if (!token) {
      setMessage("Нет токена.");
      setMessageType("error");
      return;
    }
    const o = Number(ownerId);
    const v = Number(videoId);
    if (!Number.isFinite(o) || !Number.isFinite(v)) {
      setMessage("Укажите ownerId и videoId.");
      setMessageType("warning");
      return;
    }
    setBusy(true);
    setMessage("Готовлю CSV...");
    setMessageType("info");
    try {
      const res = await fetch(
        `/api/video/comments.csv?ownerId=${o}&videoId=${v}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const msg = json?.message || res.statusText;
        if (
          /authorization failed|invalid token|expired|User authorization failed/i.test(
            msg
          )
        ) {
          localStorage.removeItem("vk_token");
          setToken("");
          setMessage("Токен недействителен или истёк. Авторизуйтесь заново.");
          setMessageType("error");
          return;
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vk-comments-${o}_${v}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("CSV выгружен.");
      setMessageType("success");
    } catch (e) {
      setMessage("Ошибка: " + e.message);
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold drop-shadow">
          VK Video Comments Exporter
        </h1>
      </div>

      <section className="mb-6 rounded-2xl p-5 border border-white/10 bg-white/10 backdrop-blur-md shadow-xl">
        <h3 className="text-lg font-medium mb-3">1) Авторизация</h3>
        <ol className="text-sm text-gray-300 mb-3 leading-relaxed list-decimal list-inside space-y-1">
          <li>
            Введите ваш <span className="font-semibold">APP_ID</span> и нажмите
            <span className="font-semibold"> «Открыть окно авторизации»</span>.
          </li>
          <li>
            Разрешите доступ и на странице
            <code className="mx-1 px-1 py-0.5 bg-black/30 rounded">
              blank.html
            </code>
            скопируйте адрес со строкой
            <code className="mx-1 px-1 py-0.5 bg-black/30 rounded">
              #access_token=...
            </code>
            .
          </li>
          <li>
            Вставьте сюда полный адрес или сам token — он сохранится
            автоматически.
          </li>
        </ol>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
          <input
            className="border border-white/20 bg-black/20 text-gray-100 placeholder-gray-400 rounded px-3 py-2 w-full sm:w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="APP_ID"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
          <Select
            className="sm:w-36 w-full"
            value={scope}
            onChange={(v) => setScope(v)}
            options={[{ value: "video", label: "video" }]}
          />
          <a
            href={authUrl || "#"}
            target={authUrl ? "_blank" : "_self"}
            rel="noreferrer"
          >
            <button
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
              disabled={!authUrl}
            >
              Открыть окно авторизации
            </button>
          </a>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
          <Select
            className="sm:w-64 w-full"
            value={appIds.includes(appId) ? appId : ""}
            onChange={(v) => setAppId(v)}
            options={[
              { value: "", label: "Выбрать из сохранённых…" },
              ...appIds.map((id) => ({ value: id, label: id })),
            ]}
          />
          <button
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition"
            onClick={addAppId}
          >
            Сохранить APP_ID
          </button>
          <button
            className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg transition"
            onClick={() => appId && removeAppId(appId)}
          >
            Удалить выбранный
          </button>
          <button
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition"
            onClick={clearAppIds}
          >
            Очистить список
          </button>
        </div>
        <div>
          <input
            className="border border-white/20 bg-black/20 text-gray-100 placeholder-gray-400 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="#access_token=... или вставьте сам token"
            onChange={(e) => {
              const extracted = tryExtractToken(e.target.value);
              if (extracted) {
                localStorage.setItem("vk_token", extracted);
                setToken(extracted);
                setMessage("Токен сохранён.");
                setMessageType("success");
                setToast({ type: "success", text: "Токен сохранён" });
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                toastTimerRef.current = setTimeout(() => setToast(null), 4000);
              }
            }}
          />
        </div>
        <div className="mt-2 text-sm text-gray-300">
          Текущий токен: {token ? "установлен" : "—"}
        </div>
      </section>

      <section className="mb-6 rounded-2xl p-5 border border-white/10 bg-white/10 backdrop-blur-md shadow-xl">
        <h3 className="text-lg font-medium mb-3">
          2) Видеоссылка или ручной ввод
        </h3>
        <p className="text-sm text-gray-300 mb-3 leading-relaxed">
          Вставьте ссылку вида{" "}
          <code className="px-1 py-0.5 bg-black/30 rounded">
            https://vk.com/video-OWNER_VIDEO
          </code>{" "}
          — ownerId и videoId подставятся автоматически. Можно указать вручную
          ниже.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            className="border border-white/20 bg-black/20 text-gray-100 placeholder-gray-400 rounded px-3 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="https://vk.com/video-OWNER_VIDEO"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
          <button
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition"
            onClick={onParseVideo}
          >
            Распарсить
          </button>
        </div>
        {urlHistory.length > 0 && (
          <div className="mb-3 inline-block w-full sm:w-2/3">
            <Select
              value={""}
              onChange={(v) => v && setVideoUrl(v)}
              options={[
                { value: "", label: "Выбрать из последних ссылок…" },
                ...urlHistory.map((u) => ({ value: u, label: u })),
              ]}
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            className="border border-white/20 bg-black/20 text-gray-100 placeholder-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="ownerId"
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          />
          <input
            className="border border-white/20 bg-black/20 text-gray-100 placeholder-gray-400 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            placeholder="videoId"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
          />
        </div>
      </section>

      {token &&
        Number.isFinite(Number(ownerId)) &&
        Number.isFinite(Number(videoId)) && (
          <section className="mb-4 rounded-2xl p-5 border border-white/10 bg-white/10 backdrop-blur-md shadow-xl">
            <h3 className="text-lg font-medium mb-3">3) Выгрузка</h3>
            <p className="text-sm text-gray-300 mb-3 leading-relaxed">
              Нажмите «Скачать JSON» для полного дерева комментариев, или
              «Скачать CSV» для импорта в Excel/Google Таблицы. В Google Sheets:
              Файл → Импорт → Загрузить → выберите CSV → Разделитель «точка с
              запятой». Быстрый старт Google Таблиц:{" "}
              <a
                className="underline text-indigo-300 hover:text-indigo-200"
                href="https://docs.google.com/spreadsheets/u/0/"
                target="_blank"
                rel="noreferrer"
              >
                открыть
              </a>
              .
            </p>
            <div className="flex gap-2">
              <button
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                disabled={busy}
                onClick={onFetch}
              >
                Скачать JSON
              </button>
              <button
                className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
                disabled={busy}
                onClick={onDownloadCsv}
              >
                Скачать CSV
              </button>
            </div>
          </section>
        )}

      {message && (
        <div
          className={
            "mt-4 text-sm rounded-xl p-3 border backdrop-blur-md " +
            (messageType === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-200"
              : messageType === "error"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : messageType === "warning"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-indigo-500/30 bg-indigo-500/10 text-indigo-200")
          }
        >
          {message}
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={
              "rounded-xl px-4 py-3 shadow-2xl border backdrop-blur-md transition " +
              (toast.type === "success"
                ? "border-green-500/30 bg-green-500/10 text-green-200"
                : toast.type === "error"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                : toast.type === "warning"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                : "border-indigo-500/30 bg-indigo-500/10 text-indigo-200")
            }
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}
