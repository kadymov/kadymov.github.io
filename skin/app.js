import {SkinRenderer,displayImage} from './skin-renderer.js?v=resolution-aa-1';

const $=id=>document.getElementById(id);
const phone=new URLSearchParams(location.search).get('profile')==='phone'||matchMedia('(max-width:640px), (pointer:coarse)').matches;
const state={profile:phone?'phone':'desktop',revision:0,mode:'dlss',busy:false,engine:'idle',result:false,
 sceneReady:false,runs:0,completed:0,discarded:0,lastError:null,weights:null,adapter:null,renderErrors:0,contextLost:false,weightsLoads:0,pipelineBuilds:0};
let skin,model,inference,pipeline,runtime,timer,frame=0,dirty=true,interacting=false;
const pointers=new Set(),offscreen=document.createElement('canvas');
const blocked=message=>Object.assign(Error(message),{blocked:true});
function diagnose(){
 $('diagnostics').textContent=JSON.stringify({...state,scene:skin?.sceneInfo,resolution:skin?.size,antialiasSamples:skin?.aaSamples,sss:skin?.sss,
  auto:$('auto').checked,intensity:Number($('intensity').value),secureContext:window.isSecureContext,
  viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth},
  webgpu:!!navigator.gpu,networkDispatches:pipeline?.network?.recorder.dispatchCount,
  weightsMiB:model?Math.round(model.weights.bytesUploaded/1048576):null,
  activationMiB:pipeline?.network?Math.round(pipeline.network.tensors.total/1048576):null},null,2);
}
function status(message){$('frameStatus').textContent=message;diagnose();}
function hideResult(){
 state.result=false;
 for(const id of ['before','after','divider','beforeLabel','afterLabel'])$(id).hidden=true;
 $('split').disabled=true;
}
function updateButton(){
 $('resolution').disabled=state.busy||!state.sceneReady;
 $('intensityControl').hidden=state.mode!=='dlss';
 $('hint').textContent=state.mode==='dlss'&&state.engine==='idle'?'Первый DLSS — загрузка 141 МБ':'Один палец — вращение. Два — приближение.';
 const unavailable=state.mode==='dlss'&&state.engine==='blocked';
 $('render').disabled=(!state.sceneReady||state.busy||unavailable)&&!state.contextLost;
 $('render').textContent=state.contextLost?'Перезагрузить':state.busy?(state.engine==='loading'?'Загружаю DLSS…':'Сравниваю…'):
  unavailable?'DLSS недоступен':state.mode==='sss'?'Сравнить рассеивание':state.engine==='error'?'Повторить DLSS':'Сравнить с DLSS';
}
function updateProfileInfo(){
 $('profileInfo').textContent=`${skin.size} × ${skin.size}, текстуры 2K, сглаживание ${skin.aaSamples?skin.aaSamples+'× MSAA':'недоступно на этом GPU'}. Нейросеть загружается по кнопке.`;
}
function requestDraw(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
function tick(){
 frame=0;if(document.hidden||!skin||state.contextLost)return;
 try{
  const moving=skin.controls.update();
  if(dirty&&skin.ready){skin.render();dirty=false;}
  if(moving||interacting)requestDraw();
 }catch(error){
  if(state.renderErrors++===0){state.lastError=error.message;status('Не удалось отрисовать сцену. Попробуйте перезагрузить страницу.');console.error(error);}
 }
}
function schedule(){
 clearTimeout(timer);
 if(!$('auto').checked||interacting||!state.sceneReady||document.hidden||state.busy)return;
 if(state.mode==='dlss'&&['blocked','error'].includes(state.engine))return;
 timer=setTimeout(renderComparison,1200);
}
function changed(){
 state.revision++;dirty=true;hideResult();requestDraw();
 if(state.sceneReady)status(state.busy?'Ракурс изменился. Результат будет сброшен.':$('auto').checked?'Жду остановки…':'Выберите ракурс и сравните');
 schedule();
}
function draw(id,image){
 const canvas=$(id);canvas.width=image.width;canvas.height=image.height;
 canvas.getContext('2d',{willReadFrequently:true}).putImageData(image,0,0);
}
function showResult(before,after){
 let delta=0,changedPixels=0,min=255,max=0,maxDifference=0;
 for(let i=0;i<after.data.length;i+=4){
  let diff=0;for(let c=0;c<3;c++){const d=Math.abs(after.data[i+c]-before.data[i+c]);delta+=d;diff+=d;maxDifference=Math.max(maxDifference,d);min=Math.min(min,after.data[i+c]);max=Math.max(max,after.data[i+c]);}
  if(diff)changedPixels++;
 }
 const mean=delta/(after.width*after.height*3);
 if(!Number.isFinite(mean)||max-min<8)throw Error('Получен пустой кадр');
 state.lastComparison={mode:state.mode,revision:state.revision,width:after.width,height:after.height,
  meanAbsoluteRgbDifference:mean,maxAbsoluteRgbDifference:maxDifference,changedPixels,outputRange:[min,max]};
 draw('before',before);draw('after',after);
 for(const id of ['before','after','divider','beforeLabel','afterLabel'])$(id).hidden=false;
 $('beforeLabel').textContent=state.mode==='sss'?'Без SSS':'До';
 $('afterLabel').textContent=state.mode==='sss'?'SSS':'DLSS';
 $('split').disabled=false;state.result=true;diagnose();
}
function releaseEngine(){
 if(pipeline){pipeline.destroy();pipeline=null;}
 if(model){model.destroy();model=null;}inference=null;
}
async function startEngine(){
 if(state.engine==='ready'){
  if(!pipeline){pipeline=await runtime.DlssNrProductionPipeline.create(inference,offscreen);state.pipelineBuilds++;}
  await pipeline.ensureGeometry(runtime.createRuntimeProfile(skin.size,skin.size));return;
 }
 state.engine='loading';updateButton();
 if(!window.isSecureContext)throw blocked('Для DLSS нужен HTTPS. Рассеивание работает и без него.');
 if(!navigator.gpu)throw blocked('Для DLSS на iPhone нужен Safari на iOS 26 или новее.');
 status('Проверяю GPU…');
 const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
 if(!adapter)throw blocked('WebGPU недоступен. Можно сравнить рассеивание.');
 if(adapter.limits.maxComputeWorkgroupStorageSize<32768)throw blocked('Этот GPU не поддерживает сеть DLSS. Рассеивание доступно.');
 if(!adapter.features.has('shader-f16'))throw blocked('GPU не поддерживает нужные вычисления DLSS. Рассеивание доступно.');
 const modules=await Promise.all([
  import('./vendor/opendlss/demo/src/backend/model-loader.js'),import('./vendor/opendlss/demo/src/backend/inference.js'),
  import('./vendor/opendlss/demo/src/backend/production-pipeline.js'),import('./vendor/opendlss/src/gpu.js')]);
 runtime={...modules[0],...modules[1],...modules[2],...modules[3]};
 const response=await fetch(new URL('./weights/manifest.json',import.meta.url));
 if(!response.ok)throw Error('Веса DLSS недоступны на этом сервере.');
 const manifest=await response.json();if(manifest.totals?.blockCount!==71)throw Error('Несовместимые веса DLSS.');
 state.weights={blocks:manifest.totals.blockCount,tensors:manifest.totals.tensorCount,source:manifest.source};
 $('engineProgress').hidden=false;
 model=await runtime.DlssNrWebGpuModel.create({weights:new URL('./weights',import.meta.url).href,activationWidth:skin.size,activationHeight:skin.size,
  onProgress:(message,error,download)=>{
   if(download){$('engineProgress').max=download.total;$('engineProgress').value=download.loaded;
    status(`Загружаю сеть: ${Math.round(download.loaded/download.total*100)}%`);
   }else status('Подготавливаю нейросеть…');
  }});
 state.weightsLoads++;
 const info=model.adapterInfo;state.adapter={vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description};
 model.device.lost.then(info=>{
  if(info.reason!=='destroyed'){
   state.engine='error';state.lastError='GPU device lost: '+info.message;releaseEngine();
   if(state.mode==='dlss')hideResult();updateButton();status('Не хватило ресурсов GPU. Попробуйте рассеивание.');
  }
 });
 inference=await runtime.DlssNrBrowserInference.create(model,()=>status('Подготавливаю нейросеть…'));
 pipeline=await runtime.DlssNrProductionPipeline.create(inference,offscreen);
 state.pipelineBuilds++;
 await pipeline.ensureGeometry(runtime.createRuntimeProfile(skin.size,skin.size));
 state.engine='ready';$('engineProgress').hidden=true;diagnose();
}
async function renderComparison(){
 clearTimeout(timer);
 if(state.contextLost){location.reload();return;}
 if(state.busy||interacting||!state.sceneReady||document.hidden)return;
 if(state.mode==='dlss'&&state.engine==='blocked')return;
 const revision=state.revision,mode=state.mode,started=performance.now();
 state.busy=true;state.lastError=null;updateButton();status(mode==='dlss'?'Обрабатываю ракурс…':'Сравниваю рассеивание…');
 try{
  if(mode==='dlss')await startEngine();
  if(revision!==state.revision||mode!==state.mode||document.hidden){state.discarded++;return;}
  state.runs++;skin.render();dirty=false;
  if(mode==='sss'){
   showResult(displayImage(skin.capture(false),skin.size),displayImage(skin.capture(true),skin.size));
   state.networkMilliseconds=null;
  }else{
   const half=skin.capture(),before=displayImage(half,skin.size);
   pipeline.upload(0,half,new Uint16Array(skin.size*skin.size*2));
   const result=await pipeline.render(0,runtime.createRuntimeProfile(skin.size,skin.size),{
    enabled:true,intensity:Number($('intensity').value),localTone:1,localStructure:1,skinStructure:1,autoMask:true,style:0},{reset:true});
   const bytes=new Uint8Array(await runtime.readBack(model.device,pipeline.resources.image,pipeline.resources.image.size));
   if(revision!==state.revision||mode!==state.mode||document.hidden){state.discarded++;return;}
   const after=new Uint8ClampedArray(skin.size*skin.size*4),pitch=runtime.align(skin.size*4,256);
   for(let y=0;y<skin.size;y++)for(let x=0;x<skin.size;x++){
    const p=y*pitch+x*4,o=(y*skin.size+x)*4;after[o]=bytes[p+2];after[o+1]=bytes[p+1];after[o+2]=bytes[p];after[o+3]=255;
   }
   showResult(before,new ImageData(after,skin.size,skin.size));state.networkMilliseconds=result.timings.networkMilliseconds;
  }
  state.completed++;state.totalMilliseconds=performance.now()-started;
  status('Потяните ползунок, чтобы сравнить');
 }catch(error){
  hideResult();state.lastError=String(error.message||error);
  if(mode==='dlss'){state.engine=error.blocked?'blocked':'error';releaseEngine();$('engineProgress').hidden=true;}
  status(error.message||'Не удалось сравнить. Попробуйте ещё раз.');
  if(!error.blocked)console.error(error);
 }finally{
  state.busy=false;updateButton();diagnose();
  if((revision!==state.revision||mode!==state.mode)&&state.sceneReady){
   status($('auto').checked?'Жду остановки…':'Выберите ракурс и сравните');schedule();
  }
 }
}
$('split').addEventListener('input',()=>{$('stage').style.setProperty('--split',$('split').value+'%');});
$('intensity').addEventListener('input',()=>{$('intensityValue').textContent=Math.round(Number($('intensity').value)*100)+'%';changed();});
$('auto').addEventListener('change',()=>{schedule();diagnose();});
$('lighting').addEventListener('change',()=>skin?.setLighting($('lighting').value));
$('resolution').addEventListener('change',()=>{
 if(state.busy||!state.sceneReady)return;
 const size=Number($('resolution').value);if(![320,512,768].includes(size)||size===skin.size)return;
 if(pipeline){pipeline.destroy();pipeline=null;}
 skin.size=size;skin.allocate();
 try{localStorage.setItem('skin-resolution',String(size));}catch{}
 updateProfileInfo();changed();
});
$('reset').addEventListener('click',()=>skin?.reset());$('render').addEventListener('click',renderComparison);
function selectMode(mode){
 state.mode=mode;
 for(const b of document.querySelectorAll('[data-mode]')){const selected=b.dataset.mode===mode;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}
 changed();updateButton();
}
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>selectMode(b.dataset.mode));
$('stage').addEventListener('pointerdown',event=>{pointers.add(event.pointerId);interacting=true;clearTimeout(timer);requestDraw();});
function pointerEnded(event){pointers.delete(event.pointerId);interacting=pointers.size>0;if(!interacting){requestDraw();schedule();}}
window.addEventListener('pointerup',pointerEnded);window.addEventListener('pointercancel',pointerEnded);
$('stage').addEventListener('wheel',changed,{passive:true});
document.addEventListener('visibilitychange',()=>{
 clearTimeout(timer);
 if(document.hidden){cancelAnimationFrame(frame);frame=0;pointers.clear();interacting=false;state.revision++;if(state.busy)hideResult();}
 else{dirty=true;requestDraw();schedule();}diagnose();
});
window.addEventListener('keydown',event=>{
 if(/INPUT|SELECT|TEXTAREA/.test(event.target.tagName))return;
 if(event.key.toLowerCase()==='r')renderComparison();
 if(document.activeElement===$('stage')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&skin){
  event.preventDefault();const offset=skin.camera.position.clone().sub(skin.controls.target);
  if(event.key==='ArrowLeft'||event.key==='ArrowRight')offset.applyAxisAngle({x:0,y:1,z:0},event.key==='ArrowLeft'?-.12:.12);
  else offset.y+=event.key==='ArrowUp'?.015:-.015;
  skin.camera.position.copy(skin.controls.target).add(offset);skin.controls.update();changed();
 }
});
$('live').addEventListener('webglcontextlost',event=>{
 event.preventDefault();state.contextLost=true;state.sceneReady=false;clearTimeout(timer);cancelAnimationFrame(frame);frame=0;
 state.revision++;hideResult();releaseEngine();updateButton();status('Сцена приостановлена. Перезагрузите её.');
});
try{
 let size=512;
 try{const saved=Number(localStorage.getItem('skin-resolution'));if([320,512,768].includes(saved))size=saved;}catch{}
 $('resolution').value=String(size);
 skin=new SkinRenderer($('live'),$('stage'),changed,{size,textureLimit:phone?2048:4096,
  shadowMapSize:phone?1024:2048,assetUrl:'./assets/female_hand-mobile.glb'});
 await skin.load();state.sceneReady=true;$('loadingScene').hidden=true;
 updateProfileInfo();
 dirty=true;requestDraw();
 if(!window.isSecureContext||!navigator.gpu){
  state.engine='blocked';selectMode('sss');
  status(!window.isSecureContext?'Для DLSS нужен HTTPS. Рассеивание доступно.':'Для DLSS нужен WebGPU. На iPhone — Safari на iOS 26+.');
 }else status('Выберите ракурс и сравните');
 updateButton();diagnose();
}catch(error){state.lastError=error.message;$('loadingScene').textContent='Не удалось загрузить сцену. Обновите страницу.';console.error(error);diagnose();}
