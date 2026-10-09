/* Aerovex premium dashboard skin. Uses locally saved company logo colors when available. */
(function(){
const css=document.createElement('style');css.textContent=`
:root{--ax-brand:#11667b;--ax-brand-dark:#103d53;--ax-brand-light:#e9f6f8;--ax-brand-rgb:17,102,123}
body{background:#f3f6f9!important;color:#243548!important}
body>header{height:78px!important;background:#fff!important;border-bottom:1px solid #e1e9ef!important;box-shadow:0 4px 24px #152c3c0c!important}
body>header .brand b{font-size:16px!important;color:var(--ax-brand-dark)!important}
body>header .brand small{font-size:11px!important;color:#667d8c!important}
body>header .brand .mark{background:var(--ax-brand-light)!important;color:var(--ax-brand)!important;border-color:#d7e7ec!important;overflow:hidden}
main{max-width:1440px!important;padding:24px!important}
.hero{position:relative;overflow:hidden;background:linear-gradient(115deg,var(--ax-brand-dark),var(--ax-brand))!important;color:#fff!important;border:0!important;border-radius:20px!important;padding:30px 36px!important;box-shadow:0 15px 35px rgba(var(--ax-brand-rgb),.22)!important}
.hero:after{content:'';position:absolute;right:-60px;top:-100px;width:380px;height:380px;border-radius:50%;border:55px solid #ffffff12;pointer-events:none}
.hero h1{color:#fff!important;font-size:34px!important;letter-spacing:-.035em}
.hero p,.hero small{color:#e4f5fa!important}
.hero .status{background:#ffffff22!important;border:1px solid #ffffff55!important;color:white!important;font-weight:700}
.kpis{gap:16px!important;margin:20px 0!important}
.kpi{position:relative;overflow:hidden;border:1px solid #e4eaf0!important;border-radius:15px!important;padding:22px!important;box-shadow:0 6px 20px #12354c0a!important}
.kpi:before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:var(--ax-brand)}
.kpi small{font-size:12px!important;font-weight:700!important;letter-spacing:.03em}
.kpi strong{font-size:30px!important;color:var(--ax-brand-dark)!important}
.panel{border:1px solid #e4eaf0!important;border-radius:17px!important;padding:22px!important;box-shadow:0 7px 26px #12354c09!important;margin:18px 0!important}
.panelHead h2{font-size:18px!important;color:var(--ax-brand-dark)!important}
.quick button,.tile{border-radius:12px!important;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease!important}
.quick button:hover,.tile:hover{transform:translateY(-2px);border-color:var(--ax-brand)!important;box-shadow:0 9px 22px rgba(var(--ax-brand-rgb),.12)!important}
.quick button{color:var(--ax-brand-dark)!important}
.tile b{color:var(--ax-brand-dark)!important}
#axCFMProduction{border-top:4px solid var(--ax-brand)!important}
.axCFMNav{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}
.axCFMNav button{border-radius:12px!important;background:var(--ax-brand-light)!important;border:1px solid #d9e9ed!important;color:var(--ax-brand-dark)!important;padding:17px!important;transition:transform .16s ease}
.axCFMNav button:hover{transform:translateY(-2px);border-color:var(--ax-brand)!important}
.primary,button.primary{background:var(--ax-brand)!important}
.axDashboardEyebrow{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#def5fb}
.axDashboardEyebrow:before{content:'';width:7px;height:7px;border-radius:50%;background:#a6f3d2}
.axHeroActions{display:flex;gap:9px;flex-wrap:wrap;margin-top:19px;position:relative;z-index:1}
.axHeroActions button{border:1px solid #ffffff6b;background:#ffffff20;color:#fff;padding:10px 14px;border-radius:9px;font-weight:700;cursor:pointer}
.axHeroActions button:first-child{background:#fff;color:var(--ax-brand-dark)}
@media(max-width:720px){main{padding:12px!important}.hero{padding:23px 18px!important;display:block!important}.hero h1{font-size:27px!important}.hero .status{display:inline-block;margin-top:14px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important}.kpi{padding:15px!important}.kpi strong{font-size:23px!important}.panel{padding:15px!important}.axCFMNav{grid-template-columns:repeat(2,minmax(0,1fr))!important}.axCFMNav button{padding:13px!important}}
`;document.head.appendChild(css);
const hero=document.querySelector('.hero > div:first-child');
if(hero&&!document.querySelector('.axHeroActions')){
 const label=document.createElement('div');label.className='axDashboardEyebrow';label.textContent='Smart Filtration Solutions';hero.prepend(label);
 const actions=document.createElement('div');actions.className='axHeroActions';
 [['+ New Work Order','New Work Order'],['Pending Orders','Pending Orders'],['+ New Quotation','New Quotation']].forEach(([title,module])=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.addEventListener('click',()=>openModule(module));actions.appendChild(b)});hero.appendChild(actions);
}
const mark=document.querySelector('.brand .mark');
const stored=localStorage.getItem('aerovex-logo-data');
if(stored&&mark&&!mark.querySelector('img')){const img=document.createElement('img');img.src=stored;img.alt='Aerovex Filtration';img.style.cssText='width:100%;height:100%;object-fit:contain';mark.replaceChildren(img)}
if(stored){
 const im=new Image();im.onload=function(){try{
 const c=document.createElement('canvas');c.width=c.height=80;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,80,80);
 const data=ctx.getImageData(0,0,80,80).data;const buckets=new Map();
 for(let i=0;i<data.length;i+=16){if(data[i+3]<180)continue;const r=data[i],g=data[i+1],b=data[i+2];const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx>235&&mn>220||mx<35||mx-mn<24)continue;const key=[r,g,b].map(v=>Math.round(v/32)*32).join(',');buckets.set(key,(buckets.get(key)||0)+1)}
 const top=[...buckets].sort((a,b)=>b[1]-a[1])[0];if(!top)return;
 const [r,g,b]=top[0].split(',').map(Number);const dark=[r,g,b].map(v=>Math.max(12,Math.round(v*.55)));
 const root=document.documentElement;root.style.setProperty('--ax-brand','rgb('+r+','+g+','+b+')');root.style.setProperty('--ax-brand-dark','rgb('+dark.join(',')+')');root.style.setProperty('--ax-brand-rgb',[r,g,b].join(','));root.style.setProperty('--ax-brand-light','rgba('+[r,g,b].join(',')+',.09)');
 }catch(e){} };im.src=stored;
}
})();