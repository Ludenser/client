import React from "react";

export default function ExportSection({ ready, busy, onFetch, onDownloadCsv }) {
  if (!ready) return null;
  return (
    <section className="mb-4 rounded-2xl p-5 border border-white/10 bg-white/10 backdrop-blur-md shadow-xl">
      <h3 className="text-lg font-medium mb-3">3) Выгрузка</h3>
      <p className="text-sm text-gray-300 mb-3 leading-relaxed">
        Нажмите «Скачать JSON» для полного дерева комментариев, или «Скачать
        CSV» для импорта в Excel/Google Таблицы. В Google Sheets: Файл → Импорт
        → Загрузить → выберите CSV → Разделитель «точка с запятой». Быстрый
        старт Google Таблиц:{" "}
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
  );
}
