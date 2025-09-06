import React from "react";
import { buildAuthUrl, tryExtractToken } from "../../lib/utils.js";
import Select from "../Select.jsx";

export default function AuthSection({
  appId,
  setAppId,
  scope,
  setScope,
  token,
  setToken,
  appIds,
  addAppId,
  removeAppId,
  clearAppIds,
  setMessage,
  setMessageType,
  setToast,
  toastTimerRef,
}) {
  const authUrl = appId ? buildAuthUrl(appId, scope) : "";
  return (
    <section className="mb-6 rounded-2xl p-5 border border-white/10 bg-white/10 backdrop-blur-md shadow-xl">
      <h3 className="text-lg font-medium mb-3">1) Авторизация</h3>
      <ol className="text-sm text-gray-300 mb-3 leading-relaxed list-decimal list-inside space-y-1">
        <li>
          Введите ваш <span className="font-semibold">APP_ID</span> и нажмите{" "}
          <span className="font-semibold">«Открыть окно авторизации»</span>.
        </li>
        <li>
          Разрешите доступ и на странице{" "}
          <code className="mx-1 px-1 py-0.5 bg-black/30 rounded">
            blank.html
          </code>{" "}
          скопируйте адрес со строкой{" "}
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
      <div
        className={`mt-2 text-sm ${token ? "text-green-500" : "text-gray-300"}`}
      >
        Текущий токен: {token ? "установлен" : "—"}
      </div>
    </section>
  );
}
