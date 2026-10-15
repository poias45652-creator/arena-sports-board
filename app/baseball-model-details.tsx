import {BASEBALL_MODEL_NAMES,type BaseballModelFamily} from '@/lib/baseball-model-settings';
type Factor={name:string;weight:number;score:number|null;contribution:number};
export default function BaseballModelDetails({family,factors=[],coverage,notes=[]}:{family:BaseballModelFamily;factors?:Factor[];coverage?:number;notes?:string[]}){
 return <details className="baseball-calculation-details"><summary>模型計算明細 · {BASEBALL_MODEL_NAMES[family]}</summary>
  {coverage!==undefined&&<p>已取得實測的權重：{coverage.toFixed(1)}%。缺少的因子維持中性，不重新分配其權重。比例與估算尚未回測校準。</p>}
  {!!factors.length&&<table><thead><tr><th>因子</th><th>比例</th><th>主隊勝率貢獻</th></tr></thead><tbody>{factors.map(f=><tr key={f.name}><td>{f.name}</td><td>{f.weight.toFixed(1)}%</td><td>{f.score===null?'缺資料・中性':`${f.contribution>0?'+':''}${f.contribution.toFixed(2)} 個百分點`}</td></tr>)}</tbody></table>}
  {notes.filter(Boolean).map((n,i)=><p key={i}>{n}</p>)}
 </details>;
}
