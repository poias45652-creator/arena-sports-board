export default function ModelSettingsNotes() {
  return <section className="panel space-y-4 p-5" aria-labelledby="model-settings-notes-title">
    <h2 id="model-settings-notes-title" className="text-lg font-bold">模型比例說明</h2>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-2" aria-labelledby="football-model-notes-title">
        <h3 id="football-model-notes-title" className="font-bold text-[#ffd538]">足球模型比例</h3>
        <p className="text-sm leading-7 text-slate-300">缺少必要資料時會暫停該模型。設定依聯賽保存在這個瀏覽器，自訂比例尚未校準。</p>
      </section>
      <section className="space-y-2" aria-labelledby="baseball-model-notes-title">
        <h3 id="baseball-model-notes-title" className="font-bold text-[#ffd538]">棒球模型比例</h3>
        <p className="text-sm leading-7 text-slate-300">調整一項後，其餘依原比例分配。多因子比較戰績、先發與可用分項；逐局得分以攻守及投手資料推算比分分布，其他讓分、大小與上半場玩法使用此模型。缺資料仍保留中性權重，不把缺漏當成 0 分。</p>
        <p className="text-sm leading-7 text-slate-300">比例僅保存在此瀏覽器的本聯盟。自訂試算尚未回測校準，不會寫入共用模型成績。</p>
      </section>
    </div>
  </section>;
}
