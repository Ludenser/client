import React from "react";
import Select from "../Select.jsx";

export default function VideoSection({
  videoUrl,
  setVideoUrl,
  ownerId,
  setOwnerId,
  videoId,
  setVideoId,
  urlHistory,
  onParseVideo,
}) {
  return (
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
  );
}
