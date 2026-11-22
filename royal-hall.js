/* Royal Concert Hall preview: standalone, geometry-read-only scenery mask. */
(()=>{
 'use strict';
 const KEY='aaria-royal-hall-preview-v1',ROOT=document.documentElement,scene=document.getElementById('royalHallScenery'),choice=document.getElementById('royalHallTheme'),canvas=document.getElementById('rain'),keys=document.getElementById('keys');
 if(!scene||!choice||!canvas||!keys||!window.PianoGeometry)return;
 // Match the Royal Hall highway experiment: convergence (.72) is reduced 20%.
 // The shared note projection uses this same horizon scale and still lands on
 // live key centers at y=landingY.
 const HORIZON_SCALE=1-(1-.28)*.8,SAFE_GAP=24;
 let enabled=false,scheduled=false;
 try{enabled=localStorage.getItem(KEY)==='royal'}catch{}
 function setEnabled(value,save=true){enabled=!!value;ROOT.dataset.royalHall=enabled?'on':'off';scene.hidden=!enabled;choice.value=enabled?'royal':'off';if(save){try{localStorage.setItem(KEY,enabled?'royal':'off')}catch{}}if(enabled)measureAndMask()}
 function measureAndMask(){scheduled=false;if(!enabled)return;
  const rect=canvas.getBoundingClientRect(),elements=[...keys.querySelectorAll('[data-pitch]')];
  if(!rect.width||!rect.height||!elements.length){scene.hidden=true;return}
  const keyRects=elements.map(el=>({pitch:Number(el.dataset.pitch),isBlack:el.classList.contains('black'),rect:el.getBoundingClientRect()}));
  const geometry=window.PianoGeometry.measure(rect,keyRects,window.devicePixelRatio||1),landingY=geometry.landingY;
  const first=window.PianoGeometry.projectLane(geometry,geometry.low,0,geometry.width/2,HORIZON_SCALE);
  const last=window.PianoGeometry.projectLane(geometry,geometry.high,0,geometry.width/2,HORIZON_SCALE);
  const firstAtKeys=window.PianoGeometry.projectLane(geometry,geometry.low,landingY,geometry.width/2,HORIZON_SCALE);
  const lastAtKeys=window.PianoGeometry.projectLane(geometry,geometry.high,landingY,geometry.width/2,HORIZON_SCALE);
  if(!first||!last||!firstAtKeys||!lastAtKeys){scene.hidden=true;return}
  const leftTop=Math.min(first.left,last.left),rightTop=Math.max(first.right,last.right);
  const leftBottom=Math.min(firstAtKeys.left,lastAtKeys.left),rightBottom=Math.max(firstAtKeys.right,lastAtKeys.right);
  const leftRun=leftTop-leftBottom,rightRun=rightBottom-rightTop;
  const safeLeftTop=leftTop-SAFE_GAP,safeRightTop=rightTop+SAFE_GAP;
  const safeLeftY=leftRun>0?landingY*Math.max(0,(leftTop-SAFE_GAP)/leftRun):0;
  const safeRightY=rightRun>0?landingY*Math.max(0,(geometry.width-rightTop-SAFE_GAP)/rightRun):0;
  if(safeLeftTop<56||safeRightTop>geometry.width-56||safeLeftY<70||safeRightY<70){scene.hidden=true;return}
  const left=scene.querySelector('.royal-hall-left'),right=scene.querySelector('.royal-hall-right');
  left.style.clipPath=`polygon(0 0, ${safeLeftTop.toFixed(2)}px 0, 0 ${safeLeftY.toFixed(2)}px)`;
  right.style.clipPath=`polygon(${safeRightTop.toFixed(2)}px 0, 100% 0, 100% ${safeRightY.toFixed(2)}px)`;
  scene.hidden=false;
 }
 function scheduleMeasure(){if(!scheduled){scheduled=true;requestAnimationFrame(measureAndMask)}}
 choice.addEventListener('change',()=>setEnabled(choice.value==='royal'));
 if('ResizeObserver'in window){const observer=new ResizeObserver(scheduleMeasure);observer.observe(canvas);observer.observe(keys)}
 window.addEventListener('resize',scheduleMeasure,{passive:true});window.addEventListener('orientationchange',scheduleMeasure,{passive:true});
 setEnabled(enabled,false);
})();
