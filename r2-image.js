(function(root){
  'use strict';
  function inspectPixels(data,width,height,sourceWidth,sourceHeight){
    const luminance=[];let sum=0,edge=0,count=0;
    for(let i=0;i<data.length;i+=4){const y=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];luminance.push(y);sum+=y}
    const mean=sum/Math.max(1,luminance.length);let variance=0;for(const y of luminance)variance+=(y-mean)**2;const contrast=Math.sqrt(variance/Math.max(1,luminance.length));
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;if(x+1<width)edge+=Math.abs(luminance[i]-luminance[i+1]);if(y+1<height)edge+=Math.abs(luminance[i]-luminance[i+width]);count++}
    const edgeEnergy=edge/Math.max(1,count*2),warnings=[];
    if(Math.max(sourceWidth,sourceHeight)<1000)warnings.push({code:'small',message:'This picture is small; the music may be hard to read.'});
    if(mean<72)warnings.push({code:'dark',message:'This picture looks quite dark. More light may help.'});
    if(mean>246)warnings.push({code:'bright',message:'This picture looks very bright. Reduce glare if you can.'});
    if(contrast<24)warnings.push({code:'contrast',message:'The page and notes do not have much contrast.'});
    if(edgeEnergy<5)warnings.push({code:'blur',message:'The notes may look soft or blurry. Hold the camera steady and retake if needed.'});
    return{mean,contrast,edgeEnergy,warnings};
  }
  root.AariaR2Image={inspectPixels};
})(typeof globalThis!=='undefined'?globalThis:this);
