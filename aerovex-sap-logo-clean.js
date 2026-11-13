/* Aerovex SAP print logo normalization.
 * Non-destructive: uses the logo saved on this device without modifying it.
 * Only dark-backed logos are converted for a white paper background.
 * Light/transparent logos and unsupported images are kept unchanged.
 */
(function(){
'use strict';
let prior='',result='',pending=null;
const source=()=>{try{return localStorage.getItem('aerovex-logo-data')||''}catch(e){return ''}};
const supported=v=>/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
const clamp=v=>Math.max(0,Math.min(1,v));
function current(){
 const raw=source();
 return raw&&raw===prior&&result?result:raw;
}
function prepare(){
 const raw=source();
 if(!supported(raw))return Promise.resolve(raw);
 if(raw!==prior){prior=raw;result='';pending=null}
 if(result)return Promise.resolve(result);
 if(pending)return pending;
 pending=new Promise(resolve=>{
  const fallback=()=>{if(source()===raw)result=raw;pending=null;resolve(raw)};
  if(typeof Image==='undefined'||typeof document==='undefined')return fallback();
  const img=new Image();
  img.onerror=fallback;
  img.onload=()=>{
   try{
    const scale=Math.min(1,1400/Math.max(img.naturalWidth||img.width, img.naturalHeight||img.height));
    const width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));
    const height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)return fallback();
    ctx.drawImage(img,0,0,width,height);
    const data=ctx.getImageData(0,0,width,height);
    const p=data.data;
    const corners=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
    const matteCount=corners.filter(([x,y])=>{
     const i=(y*width+x)*4;
     return p[i+3]>170&&Math.max(p[i],p[i+1],p[i+2])<65;
    }).length;
    // Transparent or white-background brandmarks must never be altered.
    if(matteCount<3)return fallback();
    let left=width,top=height,right=0,bottom=0,visible=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     const i=(y*width+x)*4;
     const red=p[i],green=p[i+1],blue=p[i+2];
     const max=Math.max(red,green,blue),min=Math.min(red,green,blue);
     const blueInk=blue>red+18&&blue>green+7&&blue>55;
     const neutral=(max-min<55)&&!blueInk;
     const opacity=max<45&&!blueInk?0:blueInk?clamp((blue-30)/100):clamp((max-12)/180);
     const alpha=Math.round(p[i+3]*opacity);
     p[i+3]=alpha;
     if(neutral){p[i]=20;p[i+1]=58;p[i+2]=82}
     if(alpha>22){visible++;if(x<left)left=x;if(x>right)right=x;if(y<top)top=y;if(y>bottom)bottom=y}
    }
    if(visible<Math.round(width*height*.005))return fallback();
    ctx.putImageData(data,0,0);
    // Trim unused black matte so logo scales by actual artwork, not padding.
    const pad=Math.max(3,Math.round(Math.min(width,height)*.025));
    left=Math.max(0,left-pad);top=Math.max(0,top-pad);
    right=Math.min(width-1,right+pad);bottom=Math.min(height-1,bottom+pad);
    const output=document.createElement('canvas');
    output.width=right-left+1;output.height=bottom-top+1;
    const out=output.getContext('2d');
    if(!out)return fallback();
    out.drawImage(canvas,left,top,output.width,output.height,0,0,output.width,output.height);
    const cleaned=output.toDataURL('image/png');
    if(source()===raw){result=cleaned;pending=null;resolve(cleaned)}
    else {pending=null;resolve(raw)}
   }catch(e){fallback()}
  };
  img.src=raw;
 });
 return pending;
}
function apply(root){
 if(!root||typeof root.querySelectorAll!=='function')return;
 const images=Array.from(root.querySelectorAll('img.axSapLogo, img.axSapRegLogo'));
 if(!images.length)return;
 const old=source();
 prepare().then(fixed=>{
  if(fixed===old||!fixed)return;
  for(const el of images){
   if(el.isConnected!==false&&el.getAttribute('src')===old)el.setAttribute('src',fixed);
  }
 }).catch(()=>{});
}
window.axSAPLogoFix={current,prepare,apply};
})();
