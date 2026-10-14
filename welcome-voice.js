(function(){
function playWelcome(){
 if(!window.speechSynthesis){alert('Voice playback not supported in this browser. Try Chrome and enable Text-to-speech in phone settings.');return;}
 speechSynthesis.cancel();
 const speech=new SpeechSynthesisUtterance('भिऊ नकोस, मी तुझ्या पाठीशी आहे. श्री स्वामी समर्थ.');
 speech.lang='mr-IN';speech.rate=.85;speech.pitch=1.15;
 const voices=speechSynthesis.getVoices();
 const marathi=voices.filter(v=>/^mr/i.test(v.lang));
 const hindi=voices.filter(v=>/^hi/i.test(v.lang));
 const female=v=>/female|swara|heera|pallavi|kalpana|neerja|ananya/i.test(v.name);
 speech.voice=marathi.find(female)||marathi[0]||hindi.find(female)||hindi[0]||null;
 if(speech.voice)speech.lang=speech.voice.lang;
 speech.onerror=function(ev){alert('Voice could not play ('+(ev.error||'unknown')+'). Check phone media volume and Text-to-speech settings.');};
 speechSynthesis.speak(speech);
 setTimeout(()=>{if(speechSynthesis.paused)speechSynthesis.resume()},250);
}
function init(){

 const button=document.createElement('button');
 button.textContent='🙏 श्री स्वामी समर्थ — Tap to Enter ERP';
 button.style.cssText='position:fixed;z-index:999999;left:50%;top:50%;transform:translate(-50%,-50%);padding:22px;border-radius:16px;background:#073d55;color:white;border:2px solid #fff;font-size:18px;box-shadow:0 0 0 100vmax #001c2cdd;max-width:90vw';
 const skip=document.createElement('button');
 skip.textContent='Skip / Silent';
 skip.style.cssText='position:fixed;z-index:999999;left:50%;top:calc(50% + 70px);transform:translateX(-50%);background:white;color:#073d55;border:0;border-radius:8px;padding:9px 20px';
 const close=(voice)=>{button.remove();skip.remove();if(voice)playWelcome()};
 button.onclick=()=>close(true);skip.onclick=()=>close(false);
 document.body.append(button,skip);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.axPlayWelcomeVoice=playWelcome;
})();