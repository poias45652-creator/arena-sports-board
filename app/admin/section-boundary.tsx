'use client';
import {Component,type ReactNode} from 'react';
export default class SectionBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<section className="panel p-6"><h2 className="text-xl font-bold">安全驗證設定暫時無法載入</h2><p className="my-3">其他後台功能仍可使用。請重新整理後再試。</p><button className="header-action" onClick={()=>window.location.reload()}>重新整理</button></section>:this.props.children;}
}
