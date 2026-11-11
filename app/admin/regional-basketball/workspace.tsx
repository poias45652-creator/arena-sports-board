'use client';
import dynamic from 'next/dynamic';
import {useEffect,useState} from 'react';
const RegionalBasketballBoard=dynamic(()=>import('../../regional-basketball-board'),{ssr:false});
const keepView=()=>{};
export default function Workspace(){
 const [league,setLeague]=useState<'NBL'|'KBL'|null>(null);
 useEffect(()=>{setLeague(new URLSearchParams(window.location.search).get('league')==='KBL'?'KBL':'NBL');},[]);
 if(!league)return <p>載入查核資料…</p>;
 return <RegionalBasketballBoard league={league} onViewChange={keepView} admin/>;
}
