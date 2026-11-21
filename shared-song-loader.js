(function(){
  'use strict';
  const path='./shared-song-library.json';
  fetch(path).then(response=>{
    if(!response.ok)throw new Error('Shared song library could not be loaded ('+response.status+').');
    return response.json();
  }).then(catalog=>{
    if(catalog?.format!=='aaria-piano-shared-song-library'||!Array.isArray(catalog.songs)){
      throw new Error('Shared song library has an unsupported format.');
    }
    const library=window.PianoKingdomLibrary;
    if(!library||typeof library.addSong!=='function')throw new Error('Piano library is not ready.');
    let added=0;
    for(const song of catalog.songs){
      if(!song||typeof song.id!=='string'||typeof song.title!=='string'||!Array.isArray(song.events)){
        throw new Error('A shared song record is invalid.');
      }
      const existing=library.songs[song.id];
      if(existing){
        existing.sharedCatalog=true;
        if(existing.title!==song.title){
          existing.title=song.title;
          const option=document.querySelector('#songSelect option[value="'+CSS.escape(song.id)+'"]');
          if(option)option.textContent=song.title;
        }
        continue;
      }
      library.addSong({...song,sharedCatalog:true},{select:false});
      added++;
    }
    library.onChange?.();
    window.dispatchEvent(new CustomEvent('piano-shared-songs-loaded',{detail:{added,total:catalog.songs.length}}));
  }).catch(error=>console.error('[shared song library]',error));
})();
