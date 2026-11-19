const CACHE='aaria-piano-v1.19.0';
const ORT='./lib/onnxruntime-web@1.30.0/dist/';
const ASSETS=[
 './','./index.html','./assets/release2/magic-book.svg','./assets/release2/magic-bubble.svg','./r2-music.js?v=aaria-piano-r2.2','./r2-image.js?v=aaria-piano-r2.1','./piano-hero-v2.css?v=aaria-piano-v1.13.0','./piano-geometry.js','./song-import.js?v=aaria-piano-r2.3','./my-songs.js?v=aaria-piano-r2.3','./assets/piano-hero-v2/home_button.png','./assets/piano-hero-v2/settings_button.png','./omr-worker.js','./manifest.webmanifest','./r2-install.js?v=aaria-piano-r2.5','./release2-install-manifest.json',
 './icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png',
 './OMR-THIRD-PARTY-NOTICES.md','./vendor/omr-licenses/partsong-LICENSE',
 './omr/partsong_omr.wasm','./omr/partsong_omr_fused.wasm','./omr/partsong_omr_threads.wasm','./omr/partsong_omr_threads_fused.wasm',
 './omr/encoder_pool.mjs','./omr/encoder_worker.mjs','./omr/encoder_gpu.mjs','./omr/encoder_gpu_math.mjs','./omr/encoder_gpu_kernels.mjs',
 `${ORT}ort.webgpu.min.mjs`,`${ORT}ort-wasm-simd-threaded.asyncify.mjs`,`${ORT}ort-wasm-simd-threaded.asyncify.wasm`
];
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const asset of ASSETS){const url=new URL(asset,self.registration.scope);if(asset==='./'||asset==='./index.html')url.searchParams.set('release',CACHE);const response=await fetch(url,{cache:'reload'});if(!response.ok)throw new Error(`Offline asset failed: ${asset} (${response.status})`);await cache.put(asset,response)}await self.skipWaiting()})())});
async function cleanupPreviousShellCaches(){const keys=await caches.keys();await Promise.all(keys.filter(key=>(/^aaria-piano-v\d+\.\d+\.\d+$/.test(key)&&key!==CACHE)).map(key=>caches.delete(key)))}
self.addEventListener('activate',event=>{event.waitUntil((async()=>{await cleanupPreviousShellCaches();await self.clients.claim();await cleanupPreviousShellCaches()})())});
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cached=await caches.match(request);if(request.mode==='navigate'){try{const fresh=await fetch(request,{cache:'no-store'});if(fresh.ok){const cache=await caches.open(CACHE);await cache.put('./index.html',fresh.clone());await cache.put('./',fresh.clone())}return fresh}catch{return cached||caches.match('./index.html')}}if(cached)return cached;try{return await fetch(request)}catch{return Response.error()}})())});
