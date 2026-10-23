/** Descriptive association in a team's own prior games, not a fitted forecast.
 * Keep direction explicit and discount noisy series; never use identity jitter. */
export function teamFactorSignal(rows:{value:number|null;result:number}[],direction:1|-1=1,minGames=8):number|null{
 const pairs=rows.filter(r=>typeof r.value==='number'&&Number.isFinite(r.value)&&Number.isFinite(r.result));
 if(pairs.length<minGames)return null;
 const mx=pairs.reduce((n,r)=>n+r.value!,0)/pairs.length,my=pairs.reduce((n,r)=>n+r.result,0)/pairs.length;
 let xx=0,yy=0,xy=0;for(const r of pairs){const x=r.value!-mx,y=r.result-my;xx+=x*x;yy+=y*y;xy+=x*y;}
 if(xx<1e-10||yy<1e-10)return null;
 const correlation=Math.max(0,Math.min(1,direction*xy/Math.sqrt(xx*yy))),stability=Math.abs(mx)/(Math.abs(mx)+Math.sqrt(xx/pairs.length));
 return correlation*correlation*(.5+.5*stability);
}
