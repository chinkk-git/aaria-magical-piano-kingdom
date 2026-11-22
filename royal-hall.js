/* Optional Royal Hall artwork: one supplied composition behind gameplay. */
(()=>{
 'use strict';
 const KEY='aaria-royal-hall-preview-v1',ROOT=document.documentElement,choice=document.getElementById('royalHallTheme'),canvas=document.getElementById('rain'),keys=document.getElementById('keys'),field=document.getElementById('heroPlayfield'),art=document.getElementById('royalHallArtwork'),scene=document.getElementById('royalHallScenery'),roof=document.getElementById('royalVaultRoof');
 if(!choice||!canvas||!keys||!field||!art||!scene||!roof||!window.PianoGeometry)return;
 const ART={width:1672,height:941,centerX:836,starburstY:421,discoBallY:372,openingY:510,
  // Alpha-edge samples from the supplied PNG at 50% alpha, read left/right
  // around the transparent gameplay opening (stage, middle and foreground).
  tunnelBounds:[{y:520,left:686,right:983},{y:600,left:421,right:1255},{y:700,left:88,right:1584}]};
 let enabled=false,queued=false;
 try{enabled=localStorage.getItem(KEY)==='royal'}catch{}
 const isHero=()=>document.querySelector('main')?.dataset.pianoLayout==='hero';
 function update(){queued=false;const active=enabled&&isHero();ROOT.dataset.royalHall=active?'on':'off';choice.value=enabled?'royal':'off';
  art.hidden=!active;scene.hidden=true;roof.hidden=true;
  if(!active)return;
  const fr=field.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
  if(fr.width<1||fr.height<1||cr.width<1||cr.height<1||!art.complete||!art.naturalWidth){art.hidden=true;return}
  // The image has a wide 16:9 composition and a transparent lower stage opening.
  // Portrait zoom frames the central arches; landscape keeps the complete width
  // where possible. Both modes use one uniform source-to-screen scale.
  const portrait=innerHeight>=innerWidth;
  const scale=portrait?Math.min(cr.height/ART.height,cr.width/600):Math.min(cr.width/ART.width,cr.height/800);
  if(!Number.isFinite(scale)||scale<=0){art.hidden=true;return}
  const width=ART.width*scale,height=ART.height*scale;
  const x=cr.left-fr.left+cr.width/2-ART.centerX*scale,y=cr.top-fr.top;
  Object.assign(art.style,{left:`${x.toFixed(3)}px`,top:`${y.toFixed(3)}px`,width:`${width.toFixed(3)}px`,height:`${height.toFixed(3)}px`});
  art.hidden=false;
  // PNG-space structural centerline (836,0) meets the real canvas vanishing
  // point. The tunnel's transparent stage opening begins near (836,510); its
  // measured transformed residual is reported by the focused browser capture.
  const vanishing={x:cr.left+cr.width/2,y:cr.top};
  art.dataset.geometry=JSON.stringify({container:{x:fr.x,y:fr.y,width:fr.width,height:fr.height},canvas:{x:cr.x,y:cr.y,width:cr.width,height:cr.height},source:{width:ART.width,height:ART.height,centerlineVanishingPoint:{x:ART.centerX,y:0},stageOpeningCenter:{x:ART.centerX,y:ART.openingY},starburst:{x:ART.centerX,y:ART.starburstY},discoBall:{x:ART.centerX,y:ART.discoBallY},tunnelBounds:ART.tunnelBounds},vanishingPoint:vanishing,scale,transform:{x,y,width,height},transformedFocal:{starburst:{x:vanishing.x,y:fr.y+y+ART.starburstY*scale},discoBall:{x:vanishing.x,y:fr.y+y+ART.discoBallY*scale},stageOpening:{x:vanishing.x,y:fr.y+y+ART.openingY*scale}}});
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update)}}
 function setEnabled(value,save=true){enabled=!!value;if(save){try{localStorage.setItem(KEY,enabled?'royal':'off')}catch{}}schedule()}
 choice.addEventListener('change',()=>setEnabled(choice.value==='royal'));
 art.addEventListener('load',schedule);window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});
 if('ResizeObserver'in window){const observer=new ResizeObserver(schedule);observer.observe(field);observer.observe(canvas);observer.observe(keys)}
 new MutationObserver(schedule).observe(document.querySelector('main'),{attributes:true,attributeFilter:['data-piano-layout']});
 setEnabled(enabled,false);
})();
