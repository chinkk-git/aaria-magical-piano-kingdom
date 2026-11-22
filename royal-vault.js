/* Royal vault composition: aligns supplied design-space layers to the live,
   unchanged highway vanishing point and stays below its canvas. */
(()=>{
 'use strict';
 const root=document.getElementById('heroPlayfield'),canvas=document.getElementById('rain'),roof=document.getElementById('royalVaultRoof');
 if(!root||!canvas||!roof)return;
 const layers=[...roof.querySelectorAll('.royal-vault-layer')];
 let queued=false;
 function align(){
  queued=false;
  if(document.documentElement.dataset.royalHall!=='on'||document.querySelector('main')?.dataset.pianoLayout!=='hero'){
   roof.hidden=true;return;
  }
  const r=root.getBoundingClientRect(),c=canvas.getBoundingClientRect();
  if(r.width<320||r.height<180||c.width<250||c.height<100){roof.hidden=true;return;}
  const scale=Math.min(r.width/1600,r.height/900);
  const vanishX=c.left-r.left+c.width/2,vanishY=c.top-r.top;
  const x=vanishX-scale*800,y=vanishY-scale*340,w=1600*scale,h=900*scale;
  for(const layer of layers){layer.style.left=x.toFixed(3)+'px';layer.style.top=y.toFixed(3)+'px';layer.style.width=w.toFixed(3)+'px';layer.style.height=h.toFixed(3)+'px';}
  roof.hidden=false;
  roof.dataset.geometry=JSON.stringify({container:{x:r.x,y:r.y,width:r.width,height:r.height},canvas:{x:c.x,y:c.y,width:c.width,height:c.height},vanishingPoint:{x:vanishX,y:vanishY},assetConvergence:{x:800,y:340},scale,transform:{x,y,width:w,height:h}});
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(align)}}
 if('ResizeObserver'in window){const ro=new ResizeObserver(schedule);ro.observe(root);ro.observe(canvas)}
 window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});
 new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-royal-hall']});
 schedule();
})();
