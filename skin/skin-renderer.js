import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const vertex = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const blurFragment = `
precision highp float;
uniform sampler2D image,depth;
uniform vec2 direction;uniform float radius,nearPlane,farPlane,projectionScale;
varying vec2 vUv;
float distanceAt(vec2 uv){float z=texture2D(depth,uv).x;return nearPlane*farPlane/(farPlane+(nearPlane-farPlane)*z);}
void main(){
 vec4 center=texture2D(image,vUv);if(center.a<.0001){gl_FragColor=center;return;}
 float d=distanceAt(vUv);float r=radius*projectionScale/max(d,.001);
 vec3 sum=vec3(0.),weightSum=vec3(0.);
 for(int i=-8;i<=8;i++){
  float x=float(i)/8.;vec2 uv=vUv+direction*x*r;
  vec4 sampleColor=texture2D(image,uv);
  float edge=sampleColor.a*exp(-abs(distanceAt(uv)-d)/.004);
  vec3 w=exp(-.5*pow(vec3(x)/vec3(.45,.22,.12),vec3(2.)))*edge;
  sum+=sampleColor.rgb/max(sampleColor.a,.0001)*w;weightSum+=w;
 }
 gl_FragColor=vec4(sum/max(weightSum,vec3(.00001))*center.a,center.a);
}`;
const combineFragment=`precision highp float;
uniform sampler2D diffuseImage,sssImage,specularImage;uniform float sss;uniform vec3 background;
varying vec2 vUv;
void main(){vec4 d=texture2D(diffuseImage,vUv);vec3 c=mix(d.rgb,texture2D(sssImage,vUv).rgb,sss)+texture2D(specularImage,vUv).rgb;
gl_FragColor=vec4(background*(1.-d.a)+c,1.);}`;
const displayFragment=`uniform sampler2D image;varying vec2 vUv;
void main(){gl_FragColor=vec4(texture2D(image,vUv).rgb,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export class SkinRenderer {
 constructor(canvas,stage,onChange,{size=512,textureLimit=4096,shadowMapSize=2048,assetUrl='./assets/female_hand-mobile.glb'}={}){
  this.size=size;this.textureLimit=textureLimit;this.assetUrl=assetUrl;this.onChange=onChange;this.sss=true;this.pass={value:0};
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false});
  if(!this.renderer.extensions.has('EXT_color_buffer_float'))throw Error('Нужен WebGL 2 с поддержкой HDR-буферов');
  const gl=this.renderer.getContext();
  const colorSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES));
  const depthSamples=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES));
  this.aaSamples=[4,2].find(n=>colorSamples.includes(n)&&depthSamples.includes(n))??0;
  this.renderer.setSize(this.size,this.size,false);this.renderer.setPixelRatio(1);
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  this.renderer.setClearColor(0,0);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(32,1,.005,3);
  this.controls=new OrbitControls(this.camera,stage);this.controls.enableDamping=true;this.controls.dampingFactor=.1;
  this.controls.enablePan=false;this.controls.minDistance=.15;this.controls.maxDistance=.9;
  this.controls.addEventListener('change',()=>this.onChange());
  this.key=new THREE.DirectionalLight(0xffe3c8,3);this.key.position.set(.3,.3,.4);this.key.castShadow=true;
  Object.assign(this.key.shadow.camera,{left:-.2,right:.2,top:.25,bottom:-.25,near:.01,far:2});
  this.key.shadow.mapSize.set(shadowMapSize,shadowMapSize);this.key.shadow.bias=-.0001;this.key.shadow.normalBias=.0006;
  this.fill=new THREE.DirectionalLight(0xc1d9ff,.6);this.fill.position.set(-.3,.12,.25);
  this.rim=new THREE.DirectionalLight(0xffc49e,2);this.rim.position.set(-.2,.2,-.3);
  this.scene.add(this.key,this.key.target,this.fill,this.rim);
  const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();
  this.env=pmrem.fromScene(room,.04);this.scene.environment=this.env.texture;this.scene.environmentIntensity=.35;
  room.dispose();pmrem.dispose();
  this.screenScene=new THREE.Scene();this.screenCamera=new THREE.Camera();
  this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());this.quad.frustumCulled=false;
  this.screenScene.add(this.quad);
  this.blurMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:blurFragment,toneMapped:false,
   uniforms:{image:{value:null},depth:{value:null},direction:{value:new THREE.Vector2()},radius:{value:.002},nearPlane:{value:this.camera.near},farPlane:{value:this.camera.far},projectionScale:{value:1/(2*Math.tan(THREE.MathUtils.degToRad(16)))}}});
  this.combineMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:combineFragment,toneMapped:false,
   uniforms:{diffuseImage:{value:null},sssImage:{value:null},specularImage:{value:null},sss:{value:1},background:{value:new THREE.Color(.018,.024,.023)}}});
  this.displayMaterial=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:displayFragment,toneMapped:true,uniforms:{image:{value:null}}});
  this.targets=[];this.allocate();this.reset();
 }
 allocate(){
  for(const rt of this.targets)rt.dispose();
  this.targets=Array.from({length:5},()=>new THREE.WebGLRenderTarget(this.size,this.size,{type:THREE.HalfFloatType,format:THREE.RGBAFormat,depthBuffer:false}));
  [this.diffuse,this.specular,this.blurX,this.blurY,this.final]=this.targets;
  // Multisample the geometry passes. Canvas antialiasing alone cannot smooth an offscreen scene.
  this.diffuse.samples=this.specular.samples=this.aaSamples;
  this.diffuse.depthBuffer=true;this.diffuse.depthTexture=new THREE.DepthTexture(this.size,this.size,THREE.UnsignedIntType);
  this.specular.depthBuffer=true;
  this.renderer.setSize(this.size,this.size,false);
 }
 async load(){
  const gltf=await new GLTFLoader().loadAsync(this.assetUrl);
  const source=gltf.parser.json.materials[0],legacy=source.extras.sourceSpecularGlossiness;
  const material=gltf.scene.getObjectByProperty('isMesh',true).material;
  const color=material.map,normal=material.normalMap,ao=material.aoMap;
  const spec=await gltf.parser.getDependency('texture',legacy.specularGlossinessTexture.index);
  const sourceTextures=[color,normal,spec,ao];
  const dimensions=sourceTextures.map(t=>[t.image.width,t.image.height]);
  // The phone asset already contains 2K images: avoid decoding any 8K source there.
  for(const t of sourceTextures){
   const image=t.image,max=Math.max(image.width,image.height);
   if(max>this.textureLimit){
    t.image=await createImageBitmap(image,{resizeWidth:Math.round(image.width*this.textureLimit/max),resizeHeight:Math.round(image.height*this.textureLimit/max),resizeQuality:'high'});
    image.close?.();t.needsUpdate=true;
   }
   t.flipY=false;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
  }
  color.colorSpace=spec.colorSpace=THREE.SRGBColorSpace;
  // glTF specular/glossiness stores linear glossiness in ALPHA, not RGB.
  const c=document.createElement('canvas');c.width=spec.image.width;c.height=spec.image.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(spec.image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);
  let minRoughness=1,maxRoughness=0;
  for(let i=0;i<pixels.data.length;i+=4){
   const r=1-pixels.data[i+3]/255*(legacy.glossinessFactor??1);
   minRoughness=Math.min(minRoughness,r);maxRoughness=Math.max(maxRoughness,r);
   pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=Math.round(r*255);pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);const roughnessMap=new THREE.CanvasTexture(c);roughnessMap.flipY=false;
  const f0=legacy.specularFactor??[1,1,1];
  this.material=new THREE.MeshPhysicalMaterial({map:color,normalMap:normal,normalScale:new THREE.Vector2(1,1),
   aoMap:ao,aoMapIntensity:material.aoMapIntensity,roughness:1,roughnessMap,metalness:0,ior:1.5,
   specularIntensity:1,specularColor:new THREE.Color().setRGB(f0[0]/.04,f0[1]/.04,f0[2]/.04),specularColorMap:spec});
  material.dispose();
  this.material.onBeforeCompile=shader=>{
   shader.uniforms.skinPass=this.pass;
   shader.fragmentShader='uniform float skinPass;\n'+shader.fragmentShader;
   const marker='#include <opaque_fragment>';
   if(!shader.fragmentShader.includes(marker))throw Error('Unexpected three.js PBR shader');
   shader.fragmentShader=shader.fragmentShader.replace(marker,'outgoingLight = skinPass < 0.5 ? totalDiffuse : totalSpecular;\n'+marker);
  };
  this.material.customProgramCacheKey=()=> 'skin-separate-diffuse-specular-r180';
  this.object=gltf.scene;
  this.object.traverse(o=>{if(o.isMesh){o.material=this.material;o.castShadow=true;o.receiveShadow=true;}});
  const bounds=new THREE.Box3().setFromObject(this.object),center=bounds.getCenter(new THREE.Vector3());
  const scale=.25/bounds.getSize(new THREE.Vector3()).y;this.object.scale.multiplyScalar(scale);this.object.position.sub(center.multiplyScalar(scale));
  this.sceneInfo={model:'Female hand / deep3dstudio',triangles:8082,vertices:4390,sourceTextureSizes:dimensions,
   uploadedTextureSizes:sourceTextures.map(t=>[t.image.width,t.image.height]),roughnessRange:[minRoughness,maxRoughness],heightMeters:.25};
  this.scene.add(this.object);this.ready=true;this.onChange();
 }
 reset(){this.camera.position.set(-.045,.025,-.49);this.controls.target.set(0,0,0);this.controls.update();this.onChange();}
 setLighting(kind){
  const presets={studio:[[.3,.3,.4],3,.6,2],side:[[.4,.13,.05],3.5,.15,1],back:[[.15,.2,-.35],5,.45,0]};
  const [position,key,fill,rim]=presets[kind];this.key.position.fromArray(position);this.key.intensity=key;this.fill.intensity=fill;this.rim.intensity=rim;this.onChange();
 }
 screen(material,target){this.quad.material=material;this.renderer.setRenderTarget(target);this.renderer.render(this.screenScene,this.screenCamera);}
 render(){
  if(!this.ready)return;
  const r=this.renderer;this.pass.value=0;r.setRenderTarget(this.diffuse);r.clear();r.render(this.scene,this.camera);
  this.pass.value=1;r.setRenderTarget(this.specular);r.clear();r.render(this.scene,this.camera);
  const u=this.blurMaterial.uniforms;u.depth.value=this.diffuse.depthTexture;u.image.value=this.diffuse.texture;u.direction.value.set(1,0);this.screen(this.blurMaterial,this.blurX);
  u.image.value=this.blurX.texture;u.direction.value.set(0,1);this.screen(this.blurMaterial,this.blurY);
  this.compose(this.sss);
  this.displayMaterial.uniforms.image.value=this.final.texture;this.screen(this.displayMaterial,null);
 }
 compose(sss){
  const u=this.combineMaterial.uniforms;u.diffuseImage.value=this.diffuse.texture;u.sssImage.value=this.blurY.texture;u.specularImage.value=this.specular.texture;u.sss.value=sss?1:0;
  this.screen(this.combineMaterial,this.final);
 }
 capture(sss=this.sss){
  this.compose(sss);const pixels=new Uint16Array(this.size*this.size*4);
  this.renderer.readRenderTargetPixels(this.final,0,0,this.size,this.size,pixels);return pixels;
 }
}

// Same ACES RRT/ODT fit, exposure and sRGB output as OpenDLSS-NR/frame.wgsl.
// Both comparison sides therefore share one display transform.
export function displayImage(half,size){
 const data=new Uint8ClampedArray(size*size*4),from=THREE.DataUtils.fromHalfFloat;
 const fit=v=>(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081);
 const encode=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=((size-1-y)*size+x)*4,o=(y*size+x)*4;
  const r=from(half[i])/.6,g=from(half[i+1])/.6,b=from(half[i+2])/.6;
  const a=fit(.59719*r+.35458*g+.04823*b),c=fit(.076*r+.90834*g+.01566*b),d=fit(.0284*r+.13383*g+.83777*b);
  const rgb=[1.60475*a-.53108*c-.07367*d,-.10208*a+1.10813*c-.00605*d,-.00327*a-.07276*c+1.07602*d];
  for(let j=0;j<3;j++)data[o+j]=Math.round(encode(Math.min(1,Math.max(0,rgb[j])))*255);data[o+3]=255;
 }
 return new ImageData(data,size,size);
}
