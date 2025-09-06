import React, { useEffect, useMemo, useRef, useState } from "react";
import { toCsv } from "../lib/csv.js";
import { buildAuthUrl, detectRunMode, parseVideoUrl } from "../lib/utils.js";
import { fetchAllCommentsClient } from "../lib/vk.js";
import AuthSection from "./sections/AuthSection.jsx";
import VideoSection from "./sections/VideoSection.jsx";

const APP_ID_DEFAULT = "";

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
  const [runMode, setRunMode] = useState(() => detectRunMode());

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
      if (runMode === "client") {
        const json = await fetchAllCommentsClient({
          token,
          ownerId: o,
          videoId: v,
        });
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
      } else {
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
      }
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
      if (runMode === "client") {
        const json = await fetchAllCommentsClient({
          token,
          ownerId: o,
          videoId: v,
        });
        const csv = await toCsv(json.comments);
        const blob = new Blob(["\uFEFF" + csv], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vk-comments-${o}_${v}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setMessage("CSV выгружен.");
        setMessageType("success");
      } else {
        const res = await fetch(
          `/api/video/comments.csv?ownerId=${o}&videoId=${v}`,
          { headers: { Authorization: `Bearer ${token}` } }
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
      }
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

      <AuthSection
        appId={appId}
        setAppId={setAppId}
        scope={scope}
        setScope={setScope}
        token={token}
        setToken={setToken}
        appIds={appIds}
        addAppId={addAppId}
        removeAppId={removeAppId}
        clearAppIds={clearAppIds}
        setMessage={setMessage}
        setMessageType={setMessageType}
        setToast={setToast}
        toastTimerRef={toastTimerRef}
      />

      <VideoSection
        videoUrl={videoUrl}
        setVideoUrl={setVideoUrl}
        ownerId={ownerId}
        setOwnerId={setOwnerId}
        videoId={videoId}
        setVideoId={setVideoId}
        urlHistory={urlHistory}
        onParseVideo={onParseVideo}
      />

      {token && ownerId && videoId && (
        <section className="mb-4 rounded-2xl p-5 border border-white/10 bg-white/10 backdrop-blur-md shadow-xl">
          <h3 className="text-lg font-medium mb-3">3) Выгрузка</h3>
          <p className="text-sm text-gray-300 mb-3 leading-relaxed">
            Нажмите «Скачать JSON» для полного дерева комментариев, или «Скачать
            CSV» для импорта в Excel/Google Таблицы. В Google Sheets: Файл →
            Импорт → Загрузить → выберите CSV → Разделитель «точка с запятой».
            Быстрый старт Google Таблиц:{" "}
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
