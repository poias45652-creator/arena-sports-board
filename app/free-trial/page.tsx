import Trial from './trial';
import './trial.css';

export const metadata = {title: '免費推薦｜星準'};

export default function FreeTrial() {
  return <div className="trial-page">
    <header className="trial-header">
      <a className="trial-brand" href="/welcome" aria-label="星準首頁">
        <img src="/brand/xingzhun-icon-192-v1.png" alt="" width={40} height={40}/>
        <span>星準</span>
      </a>
      <nav><a className="trial-login" href="/login">會員登入</a></nav>
    </header>
    <main className="trial-main">
      <div className="trial-heading">
        <p>星準體育分析</p>
        <h1>免費推薦</h1>
        <span>當日賽事 · 每日隨機一場</span>
      </div>
      <Trial/>
      <footer className="trial-footer">
        <p>探索更多賽事分析</p>
        <a href="/login">進入會員專區</a>
      </footer>
    </main>
  </div>;
}
