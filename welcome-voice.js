(function(){
function playWelcome(){
 if(!window.speechSynthesis)return;
 speechSynthesis.cancel();
 const speech=new SpeechSynthesisUtterance('भिऊ नकोस, मी तुझ्या पाठीशी आहे. श्री स्वामी समर्थ.');
 speech.lang='mr-IN';speech.rate=.85;speech.pitch=1.15;
 const voices=speechSynthesis.getVoices();
 speech.voice=voices.find(v=>v.lang.startsWith('mr')&&/female|swara|heera|pallavi/i.test(v.name))||voices.find(v=>v.lang.startsWith('mr'))||null;
 speechSynthesis.speak(speech);
}
function init(){
 if(sessionStorage.getItem('aerovex-welcome-seen'))return;
 const button=document.createElement('button');
 button.textContent='🙏 श्री स्वामी समर्थ — Tap to Enter ERP';
 button.style.cssText='position:fixed;z-index:999999;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px;border-radius:16px;background:#073d55;color:white;border:2px solid #fff;font-size:18px;box-shadow:0 0 0 100vmax #001c2cdd;max-width:90vw';
 const skip=document.createElement('button');
 skip.textContent='Skip / Silent';
 skip.style.cssText='position:fixed;z-index:999999;left:50%;top:calc(50% + 70px);transform:translateX(-50%);background:white;color:#073d55;border:0;border-radius:8px;padding:9px 20px';
 const close=(voice)=>{sessionStorage.setItem('aerovex-welcome-seen','1');button.remove();skip.remove();if(voice)playWelcome()};
 button.onclick=()=>close(true);skip.onclick=()=>close(false);
 document.body.append(button,skip);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.axPlayWelcomeVoice=playWelcome;
})();