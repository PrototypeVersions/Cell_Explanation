import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {structures,stageFor} from './content.js';

const TAU=Math.PI*2;
const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
let seed=92817;
let surfaceTexture=null;
function makeSurfaceTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');const image=ctx.createImageData(128,128);let grain=47;
 for(let i=0;i<image.data.length;i+=4){grain=(grain*1664525+1013904223)>>>0;const v=115+(grain>>>24)*.1;image.data[i]=image.data[i+1]=image.data[i+2]=v;image.data[i+3]=255;}
 ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(5,5);return texture;
}
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function material(color,extra={}){return new THREE.MeshPhysicalMaterial({color:new THREE.Color(color).offsetHSL(0,.065,-.035),roughness:.43,metalness:0,clearcoat:.24,clearcoatRoughness:.32,bumpMap:surfaceTexture,bumpScale:.035,...extra});}
function mesh(geometry,mat,parent,position){const m=new THREE.Mesh(geometry,mat);m.receiveShadow=!mat.transparent;m.castShadow=!mat.transparent&&(geometry.type==='BufferGeometry'||(geometry.type==='SphereGeometry'&&geometry.parameters.radius>=.45));if(position)m.position.set(...position);parent.add(m);return m;}
function tube(points,radius,mat,parent,closed=false,segments=64){const curve=new THREE.CatmullRomCurve3(points,false,'catmullrom',.45);const m=mesh(new THREE.TubeGeometry(curve,segments,radius,8,closed),mat,parent);return m;}
function ellipse(rx,rz,y=0,n=90){return Array.from({length:n+1},(_,i)=>{const a=i/n*TAU;return vec(Math.cos(a)*rx,y,Math.sin(a)*rz);});}
function surface(fn,nu=60,nv=12,thickness=.055){
  const positions=[],uv=[],indices=[];
  for(let side=0;side<2;side++)for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){
    const p=fn(i/nu,j/nv);positions.push(p.x,p.y+(side?-.5:.5)*thickness,p.z);uv.push(i/nu,j/nv);
  }
  const stride=nv+1, count=(nu+1)*stride;
  for(let side=0;side<2;side++)for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){
    const a=side*count+i*stride+j,b=a+stride;
    if(!side)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);
  }
  for(let i=0;i<nu;i++)for(const j of[0,nv]){const a=i*stride+j,b=a+stride;indices.push(a,a+count,b,b,a+count,b+count);}
  for(let j=0;j<nv;j++)for(const i of[0,nu]){const a=i*stride+j;indices.push(a,a+1,a+count,a+1,a+count+1,a+count);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function sphere(parent,radius,mat,position,scale){const m=mesh(new THREE.SphereGeometry(radius,32,20),mat,parent,position);if(scale)m.scale.set(...scale);return m;}

export class CellScene{
 constructor(container,onSelect){
  this.container=container;this.onSelect=onSelect;this.objects=new Map();this.pickables=[];this.labels=[];this.selected=null;this.interior=false;this.view='cutaway';this.explosion=0;this.explosionTarget=0;this.process={visible:false,cargo:'secreted',condition:'normal',progress:0};this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.clock=0;this.last=performance.now();this.hoverPoint=null;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;this.renderer.setClearColor(0x000000,0);this.renderer.domElement.setAttribute('aria-hidden','true');container.append(this.renderer.domElement);
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(35,1,.1,120);this.camera.position.set(12.8,11.2,16.5);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,.15,0);this.controls.enableDamping=true;this.controls.dampingFactor=.07;this.controls.minDistance=3.8;this.controls.maxDistance=36;this.controls.maxPolarAngle=Math.PI*.94;this.controls.enablePan=true;this.controls.panSpeed=.65;this.controls.autoRotateSpeed=.6;this.controls.zoomSpeed=.65;
  this.homePosition=this.camera.position.clone();this.homeTarget=this.controls.target.clone();this.controls.update();
  this.renderer.toneMappingExposure=.90;
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
  surfaceTexture=makeSurfaceTexture();
  this.scene.environmentIntensity=.32;
  this.scene.add(new THREE.HemisphereLight(0xfff9ee,0x596879,.38));
  const key=new THREE.DirectionalLight(0xfff3e5,3.0);key.position.set(-4,10,7);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-11,right:11,top:10,bottom:-10,near:1,far:35});key.shadow.bias=-.0002;key.shadow.normalBias=.035;key.shadow.radius=3;this.scene.add(key);
  const fill=new THREE.DirectionalLight(0xcbdcff,.55);fill.position.set(7,4,-6);this.scene.add(fill);
  const rim=new THREE.DirectionalLight(0xe5eaff,1.7);rim.position.set(-7,2,-8);this.scene.add(rim);
  const pmrem=new THREE.PMREMGenerator(this.renderer);const room=new RoomEnvironment();this.environment=pmrem.fromScene(room,.04);this.scene.environment=this.environment.texture;room.dispose();pmrem.dispose();
  this.root=new THREE.Group();this.scene.add(this.root);this.createCell();this.createRoutes();this.createShadow();this.createLabels();this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.bindEvents();this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.animate=this.animate.bind(this);this.frame=requestAnimationFrame(this.animate);
 }
 register(id,group,focusDistance=8){
  group.userData.id=id;group.userData.base=group.position.clone();group.userData.focusDistance=focusDistance;
  group.traverse(o=>{o.userData.id=id;if(o.isMesh){this.pickables.push(o);if(o.material){o.userData.originalOpacity=o.material.opacity;o.userData.originalTransparent=o.material.transparent;o.userData.originalEmissive=o.material.emissive?.clone();}}});
  this.objects.set(id,group);return group;
 }
 createCell(){
  const g=new THREE.Group();this.root.add(g);
  this.membraneMat=material('#b8cbd0',{transparent:true,opacity:.32,roughness:.25,clearcoat:.85,side:THREE.DoubleSide,depthWrite:false});
  this.lowerMembrane=mesh(new THREE.SphereGeometry(1,90,45,0,TAU,Math.PI/2,Math.PI/2),this.membraneMat,g);this.lowerMembrane.scale.set(6.05,2.35,4.65);
  this.upperMembrane=mesh(new THREE.SphereGeometry(1,90,45,0,TAU,0,Math.PI/2),this.membraneMat.clone(),g);this.upperMembrane.scale.set(6.05,2.35,4.65);this.upperMembrane.material.opacity=.16;this.upperMembrane.visible=false;
  const rimMat=material('#a5bcc3',{transparent:true,opacity:.64,roughness:.3});this.membraneRim=tube(ellipse(6.05,4.65),.048,rimMat,g,true,128);this.innerRim=tube(ellipse(5.96,4.57,-.04),.025,material('#e1e6dd',{transparent:true,opacity:.8}),g,true,128);
  // The bilayer is represented schematically by two rims, not by molecular scale.
  g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;o.material.bumpMap=null;}});
  this.register('membrane',g,23);
  this.createNucleus();this.createRoughER();this.createSmoothER();this.createGolgi();this.createMitochondria();this.createEndosome();this.createLysosome();this.createCytoskeleton();this.createCytoplasmDetails();
 }
 createNucleus(){
  const g=new THREE.Group();g.position.set(-1.65,.45,-.75);this.root.add(g);
  const outer=material('#9478b2',{side:THREE.DoubleSide,roughness:.36,clearcoat:.5});
  this.nucleusShell=mesh(new THREE.SphereGeometry(1.58,72,48,3.55,3.55),outer,g);
  const inner=material('#b19bc9',{side:THREE.BackSide,roughness:.6});mesh(new THREE.SphereGeometry(1.49,64,40,3.55,3.55),inner,g);
  const edgeMat=material('#c6b4dc',{roughness:.33});
  for(const phi of[3.55,7.10]){const points=[];for(let i=0;i<=64;i++){const theta=i/64*Math.PI;points.push(vec(-1.535*Math.cos(phi)*Math.sin(theta),1.535*Math.cos(theta),1.535*Math.sin(phi)*Math.sin(theta)));}tube(points,.043,edgeMat,g,false,64);}
  sphere(g,.49,material('#85619c',{roughness:.3,clearcoat:.5}),[.20,-.02,.16],[1,.92,1]);
  const chromatinMat=material('#bba4ce',{roughness:.6});
  for(let j=0;j<13;j++){const a=j*2.4;const points=[];for(let i=0;i<20;i++){const t=i/19;const rr=.9+.17*Math.sin(t*7+j);points.push(vec(Math.sin(a+t*3)*rr,Math.cos(a*1.4+t*4)*.9,Math.cos(a+t*3)*rr));}tube(points,.026,chromatinMat,g,false,35);}
  const poreGeo=new THREE.TorusGeometry(.09,.026,7,15);const poreMat=material('#806196',{roughness:.6});
  for(let i=0;i<30;i++){const phi=3.65+rand()*3.35,theta=.3+rand()*2.5;const p=vec(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));const pore=mesh(poreGeo,poreMat,g);pore.position.copy(p.clone().multiplyScalar(1.59));pore.quaternion.setFromUnitVectors(vec(0,0,1),p);}
  this.register('nucleus',g,7.2);
 }
 createRoughER(){
  const g=new THREE.Group();g.position.set(-1.65,-.17,-.75);this.root.add(g);this.erLayers=[];
  const ribosomeMatrices=[];
  for(let k=0;k<7;k++){
   const y=-.78+k*.265;const start=-.23+(.04*k),length=4.68-.035*k;
   const fn=(u,v)=>{const a=start+u*length;const r=1.71+v*(.83+.15*Math.sin(a*2))+.08*Math.sin(a*5+k);return vec(Math.cos(a)*r,y+.14*Math.sin(a*3+k*.25)+.06*Math.cos(a*7)*v,Math.sin(a)*r);};
   const mat=material(new THREE.Color('#a59ac6').offsetHSL(.002*k,.01,(k-3)*.014),{side:THREE.DoubleSide,roughness:.43});const sheet=mesh(surface(fn,85,10,.075),mat,g);this.erLayers.push(sheet);
   for(const v of[0,1]){const edgePoints=Array.from({length:96},(_,i)=>fn(i/95,v));tube(edgePoints,.025,material('#c5b9df',{roughness:.45}),g,false,95);}
   for(let j=0;j<28;j++){const p=fn(.03+rand()*.94,.08+rand()*.84);p.y+=.09;const mat4=new THREE.Matrix4().makeTranslation(p.x,p.y,p.z);ribosomeMatrices.push(mat4);}
  }
  const ribos=new THREE.InstancedMesh(new THREE.SphereGeometry(.052,9,7),material('#6b719f',{roughness:.43}),ribosomeMatrices.length);ribosomeMatrices.forEach((m,i)=>ribos.setMatrixAt(i,m));g.add(ribos);
  this.register('roughER',g,9.4);
 }
 createSmoothER(){
  const g=new THREE.Group();g.position.set(-3.75,-.13,-2.3);g.rotation.y=.15;this.root.add(g);
  const mat=material('#cdb5a2',{roughness:.44,clearcoat:.25});
  for(let i=0;i<8;i++){
   const x=(i-3.5)*.22;const z=(rand()-.5)*1.0;
   tube([vec(x,-.5,.65),vec(x+.2,-.1,.2),vec(x-.12,.1,-.2),vec(x+.14,.65,-.55),vec(x+.20,.8,-.63)],.085,mat,g,false,35);
   if(i%2===0)tube([vec(x,.08,-.1),vec(x-.3,.35,-.35),vec(x-.6,.4,-.25),vec(x-.65,.7,-.3)],.075,mat,g,false,25);
  }
  tube([vec(-1,-.4,.6),vec(-.5,-.3,.45),vec(0,-.35,.55),vec(.7,-.4,.4),vec(1,-.3,.25)],.1,mat,g,false,45);
  this.register('smoothER',g,6.5);
 }
 createGolgi(){
  const g=new THREE.Group();g.position.set(1.68,.05,-.05);g.rotation.y=-.25;this.root.add(g);this.golgiSacs=[];
  for(let i=0;i<6;i++){
   const geo=new THREE.SphereGeometry(1,52,20);const p=geo.attributes.position;
   const sx=1.29-i*.065,sz=.66-i*.025;
   for(let j=0;j<p.count;j++){const x=p.getX(j)*sx,z=p.getZ(j)*sz;const y=p.getY(j)*.085+.17*x*x+.10*Math.sin(z*3);p.setXYZ(j,x,y,z);}geo.computeVertexNormals();
   const mat=material(new THREE.Color('#d19b85').offsetHSL(0,0,(i-2)*.02),{roughness:.44,clearcoat:.25});const sac=mesh(geo,mat,g,[-i*.055,i*.235-.5,i*.05]);sac.userData.layer=i;this.golgiSacs.push(sac);
   const edge=ellipse(sx,sz).map(p=>vec(p.x,p.y+.17*p.x*p.x+.10*Math.sin(p.z*3),p.z));const trim=tube(edge,.022,material('#e3b8a4'),sac,true,90); // child shares the sac transform but has independent geometry
  }
  for(let i=0;i<13;i++){const a=i/13*TAU;const p=[1.30+Math.sin(a)*.3,-.1+Math.cos(a)*.68,Math.cos(a)*.55];sphere(g,.105+rand()*.06,material('#dca58a'),p);}
  this.register('golgi',g,7.0);
 }
 createMitochondria(){
  const g=new THREE.Group();g.position.set(-1.00,-.05,2.8);this.root.add(g);this.mitoCaps=[];
  const positions=[[0,0,0,-.32,1.0],[-2.55,-.25,-1.0,.6,.88],[3.65,-.13,-4.9,.62,.90]];
  positions.forEach(([x,y,z,rot,scale])=>{
   const m=new THREE.Group();m.position.set(x,y,z);m.rotation.y=rot;m.scale.setScalar(scale);g.add(m);
   const outer=mesh(new THREE.SphereGeometry(1,50,26,0,TAU,Math.PI/2,Math.PI/2),material('#c98695',{side:THREE.DoubleSide,roughness:.4}),m);outer.scale.set(1.15,.48,.58);
   const inner=mesh(new THREE.SphereGeometry(1,50,26,0,TAU,Math.PI/2,Math.PI/2),material('#ebbac3',{side:THREE.BackSide,roughness:.6}),m,[0,.008,0]);inner.scale.set(1.08,.40,.51);
   tube(ellipse(1.13,.57),.045,material('#edb1bd'),m,true,100);
   for(let i=0;i<9;i++){const cx=-.87+i*.21;const span=.76*Math.sqrt(Math.max(.15,1-(cx/1.13)**2));const points=[];for(let j=0;j<=12;j++){const t=j/12;points.push(vec(cx+.075*Math.sin(t*TAU),-.17+.17*Math.sin(t*Math.PI),-span/2+t*span));}tube(points,.058,material('#e6acb7',{roughness:.44}),m,false,25);}
   const cap=mesh(new THREE.SphereGeometry(1,42,24,0,TAU,0,Math.PI/2),material('#d697a5',{transparent:true,opacity:.08,depthWrite:false,roughness:.5}),m);cap.scale.set(1.15,.48,.58);this.mitoCaps.push(cap);
  });
  this.register('mitochondria',g,7.0);
 }
 createEndosome(){
  const g=new THREE.Group();g.position.set(3.78,-.05,-.58);this.root.add(g);
  this.endoShell=mesh(new THREE.SphereGeometry(.62,40,24,3.45,3.75),material('#79a7a5',{side:THREE.DoubleSide,roughness:.38,clearcoat:.5}),g);
  mesh(new THREE.SphereGeometry(.57,40,24,3.45,3.75),material('#b1c7b7',{side:THREE.BackSide}),g);
  for(let i=0;i<8;i++)sphere(g,.075,material(i%2?'#e2bd71':'#86ac8c'),[(rand()-.5)*.65,(rand()-.5)*.65,(rand()-.5)*.65]);
  // Receptor-like shapes illustrate membrane-localized recognition without molecular geometry claims.
  const rec=material('#4b8584');for(let i=0;i<5;i++){const a=3.8+i*.55;const p=vec(Math.cos(a)*.57,Math.sin(a)*.3,-.18);tube([p,p.clone().add(vec(.02,.13,.01)),p.clone().add(vec(.10,.19,.01))],.018,rec,g,false,12);}
  this.register('endosome',g,5.6);
 }
 createLysosome(){
  const g=new THREE.Group();g.position.set(3.22,-.23,2.21);this.root.add(g);this.lysoBody=new THREE.Group();g.add(this.lysoBody);
  this.lysoShell=mesh(new THREE.SphereGeometry(.66,45,30,3.4,3.85),material('#94aa81',{side:THREE.DoubleSide,roughness:.46}),this.lysoBody);
  mesh(new THREE.SphereGeometry(.60,45,30,3.4,3.85),material('#b9c69b',{side:THREE.BackSide}),this.lysoBody);
  const enzymeMat=material('#78966d');for(let i=0;i<7;i++)sphere(this.lysoBody,.055,enzymeMat,[(rand()-.5)*.7,(rand()-.5)*.65,(rand()-.5)*.65]);
  this.debris=[];for(let i=0;i<34;i++){const p=vec((rand()-.5)*.73,(rand()-.5)*.73,(rand()-.5)*.73);const item=mesh(new THREE.DodecahedronGeometry(.055+rand()*.035,0),material(i%3?'#d2bb88':'#b7a879',{roughness:.6}),this.lysoBody);item.position.copy(p);item.rotation.set(rand()*3,rand()*3,rand()*3);item.visible=i<9;this.debris.push(item);}
  this.register('lysosome',g,5.7);
 }
 createCytoskeleton(){
  const g=new THREE.Group();g.position.set(0,0,0);this.root.add(g);const microMat=material('#9bb99c',{roughness:.6});const actinMat=material('#c4bca1',{roughness:.8});
  for(let i=0;i<20;i++){const a=i/20*TAU+.1;const x=Math.cos(a)*5.4,z=Math.sin(a)*4.0;tube([vec(.25,-1.25,.8),vec(x*.28,-1.55,z*.2),vec(x*.7,-1.4,z*.63),vec(x,-.55,z)],.026+(i%3)*.007,microMat,g,false,42);}
  for(let i=0;i<26;i++){const a=rand()*TAU,b=a+1.5+rand()*2;const p1=vec(Math.cos(a)*5.5,-.7-rand()*.3,Math.sin(a)*4.1),p2=vec(Math.cos(b)*5.4,-.6-rand()*.5,Math.sin(b)*4.0);tube([p1,p1.clone().multiplyScalar(.6).add(vec(0,-.6,0)),p2.clone().multiplyScalar(.6).add(vec(0,-.6,0)),p2],.011,actinMat,g,false,30);}
  const centrosome=new THREE.Group();centrosome.position.set(.15,-.95,1.05);centrosome.rotation.z=-.4;g.add(centrosome);const gold=material('#cfb271',{roughness:.42});
  for(let pair=0;pair<2;pair++){const cent=new THREE.Group();cent.position.set(pair*.36,0,0);cent.rotation.z=pair*Math.PI/2;centrosome.add(cent);for(let i=0;i<9;i++)for(let k=0;k<3;k++){const a=i/9*TAU;mesh(new THREE.CylinderGeometry(.022,.022,.5,7),gold,cent,[Math.cos(a)*(.13+k*.025),0,Math.sin(a)*(.13+k*.025)]);}}
  this.register('cytoskeleton',g,12);
 }
 createCytoplasmDetails(){
  const free=new THREE.InstancedMesh(new THREE.SphereGeometry(.035,7,6),material('#7b8fa5',{roughness:.55}),100);const dummy=new THREE.Object3D();
  for(let i=0;i<100;i++){let x,z;do{x=(rand()-.5)*10.5;z=(rand()-.5)*7.9;}while(x*x/29+z*z/16>1);dummy.position.set(x,-1.0+rand()*.45,z);dummy.scale.setScalar(.6+rand()*.7);dummy.updateMatrix();free.setMatrixAt(i,dummy.matrix);}this.root.add(free);
  const vesMat=material('#b8c9b8',{roughness:.33,clearcoat:.4});for(let i=0;i<11;i++){const a=i/11*TAU;const p=[Math.cos(a)*4.7,-.65+rand()*.25,Math.sin(a)*3.65];sphere(this.root,.10+rand()*.1,vesMat,p);}
 }
 createShadow(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(128,128,10,128,128,125);gradient.addColorStop(0,'rgba(76,69,85,.16)');gradient.addColorStop(.6,'rgba(76,69,85,.07)');gradient.addColorStop(1,'rgba(76,69,85,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);const shadow=mesh(new THREE.PlaneGeometry(19,15),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}),this.scene,[0,-2.6,0]);shadow.rotation.x=-Math.PI/2;
 }
 createRoutes(){
  this.routeGroup=new THREE.Group();this.root.add(this.routeGroup);const v=arr=>arr.map(p=>vec(...p));
  const common=[[-2.0,.75,.9],[-1.0,1.1,1.45],[.3,1.55,.8],[1.0,1.15,.1],[1.6,.85,0]];
  this.paths={secreted:new THREE.CatmullRomCurve3(v([...common,[2.6,1.3,.8],[4.1,1.05,1.3],[5.35,.4,1.8],[6.4,.3,2.0],[7.2,.3,2.1]])),lysosome:new THREE.CatmullRomCurve3(v([...common,[2.5,1.05,-.35],[3.8,.5,-.6],[3.9,.6,.9],[3.25,.2,2.2]])),blocked:new THREE.CatmullRomCurve3(v([common[0],[-1.8,1.0,1.4],[-1.4,1.15,1.5]]))};
  this.routeLines={};for(const [id,path]of Object.entries(this.paths)){const mat=new THREE.MeshBasicMaterial({color:id==='blocked'?'#bc8776':'#b8a266',transparent:true,opacity:.34,depthWrite:false});const line=mesh(new THREE.TubeGeometry(path,130,.018,6,false),mat,this.routeGroup);line.visible=false;this.routeLines[id]=line;}
  this.cargoBalls=[];const cargoGeo=new THREE.SphereGeometry(.075,13,10);const coatGeo=new THREE.SphereGeometry(.14,16,12);
  for(let i=0;i<15;i++){const g=new THREE.Group();const ball=mesh(cargoGeo,material('#dcbb6d',{roughness:.28,emissive:'#8f6c25',emissiveIntensity:.11}),g);const coat=mesh(coatGeo,material('#ded1a0',{transparent:true,opacity:.19,depthWrite:false,roughness:.4}),g);const tag=mesh(new THREE.OctahedronGeometry(.038),material('#72a19a',{emissive:'#72a19a',emissiveIntensity:.2}),g,[0,.13,0]);this.routeGroup.add(g);g.userData={ball,coat,tag};this.cargoBalls.push(g);}
  this.routeGroup.visible=false;
 }
 createLabels(){
  const host=document.getElementById('scene-labels');for(const data of structures){const button=document.createElement('button');button.className='scene-label';button.dataset.id=data.id;button.tabIndex=-1;button.textContent=data.short;button.setAttribute('aria-label','Explore '+data.name);button.style.setProperty('--structure-color',data.color);button.addEventListener('click',()=>this.onSelect(data.id));host.append(button);const group=this.objects.get(data.id);const local=vec(...data.label).sub(group.position);this.labels.push({button,group,local,id:data.id});}
 }
 bindEvents(){
  const canvas=this.renderer.domElement;let down=null;
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};this.cameraTween=null;});
  canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7){const hit=this.hitTest(e);if(hit)this.onSelect(hit.userData.id);}down=null;});
  canvas.addEventListener('pointermove',e=>{this.hoverPoint={x:e.clientX,y:e.clientY};if(!down){const hit=this.hitTest(e);canvas.style.cursor=hit?'pointer':'grab';const tooltip=document.getElementById('hover-label');if(hit){const rect=this.container.getBoundingClientRect();tooltip.textContent=structures.find(s=>s.id===hit.userData.id)?.short||'';tooltip.style.left=Math.min(e.clientX-rect.left+15,rect.width-120)+'px';tooltip.style.top=Math.max(45,e.clientY-rect.top-30)+'px';tooltip.hidden=false;}else tooltip.hidden=true;}});
  canvas.addEventListener('pointerleave',()=>{document.getElementById('hover-label').hidden=true;});
  canvas.addEventListener('wheel',()=>{this.cameraTween=null;},{passive:true});
 }
 hitTest(e){const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hits=this.raycaster.intersectObjects(this.pickables,false).filter(h=>h.object.visible&&h.object.userData.id);return (hits.find(h=>h.object.userData.id!=='membrane')||hits[0])?.object;}
 resize(){const width=this.container.clientWidth,height=this.container.clientHeight;if(!width||!height)return;this.width=width;this.height=height;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.homePosition.set(10.5,9.2,13.5).multiplyScalar(Math.max(1,1.1/this.camera.aspect));if(!this.selected&&!this.process.visible)this.focus(null);}
 select(id,focus=true){this.selected=id;this.interior=false;if(focus)this.focus(id);this.labels.forEach(l=>l.button.classList.toggle('active',l.id===id));}
 focus(id){const group=this.objects.get(id);let target,position;if(!group||id==='membrane'||id==='cytoskeleton'){target=this.homeTarget.clone();position=this.homePosition.clone();if(this.view==='exploded')position.multiplyScalar(1.18);}else{target=group.position.clone();if(id==='roughER')target.add(vec(.2,.5,.3));if(id==='mitochondria')target.add(vec(.1,0,0));const offset=vec(6.4,5.7,8.3).normalize().multiplyScalar(group.userData.focusDistance);if(this.width<600)offset.multiplyScalar(1.12);position=target.clone().add(offset);}
  this.controls.autoRotate=false;this.cameraTween={from:this.camera.position.clone(),to:position,fromTarget:this.controls.target.clone(),toTarget:target,start:performance.now(),duration:this.reduced?0:1100};
 }
 reset(){this.selected=null;this.interior=false;this.view='cutaway';this.setView('cutaway');this.focus(null);this.labels.forEach(l=>l.button.classList.remove('active'));}
 setView(view){this.view=view;this.explosionTarget=view==='exploded'?1:0;this.upperMembrane.visible=view==='whole';this.membraneRim.visible=view!=='whole';this.innerRim.visible=view!=='whole';if(view==='exploded'){this.focus(null);this.cameraTween.to.multiplyScalar(1.1);}else if(!this.selected)this.focus(null);}
 setInterior(value){this.interior=value;}
 setLabels(value){document.getElementById('scene-labels').hidden=!value;}
 setAutoRotate(value){this.cameraTween=null;this.controls.autoRotate=value;}
 setProcess(state){this.process={...state};this.routeGroup.visible=state.visible;if(!state.visible){this.lysoBody.scale.setScalar(1);this.debris.forEach((d,i)=>d.visible=i<9);}}
 updateRoutes(dt){
  const s=this.process;if(!s.visible)return;
  const route=s.condition==='er-block'?'blocked':s.cargo==='lysosome'&&s.condition!=='m6p'?'lysosome':'secreted';
  for(const[id,line]of Object.entries(this.routeLines)){line.visible=id===route||(s.condition==='m6p'&&id==='lysosome');line.material.opacity=id===route?.33:.08;}
  const path=this.paths[route];const progress=s.progress;const progressMapped=route==='blocked'?Math.min(1,progress/.28):progress;
  // Align the leading cargo with the organelle named by each teaching stage.
  const times=[0,.16,.32,.50,.66,.84,1];
  const points=route==='lysosome'?[0,.15,.375,.50,.75,1,1]:[0,.13,.333,.444,.778,1,1];
  const routeParameter=t=>{const i=Math.min(5,times.findIndex((v,j)=>j<6&&t>=v&&t<=times[j+1]));if(i<0)return 1;return THREE.MathUtils.lerp(points[i],points[i+1],(t-times[i])/(times[i+1]-times[i]));};
  for(let i=0;i<this.cargoBalls.length;i++){
   const ball=this.cargoBalls[i];const lag=i*.048;let t=progressMapped-lag;
   ball.visible=t>=0&&t<=1;if(!ball.visible)continue;
   if(route==='blocked')t=Math.min(.86,t);
   const p=path.getPoint(route==='blocked'?Math.max(0,Math.min(1,t)):routeParameter(Math.max(0,Math.min(1,t))));ball.position.copy(p);if(route==='blocked'){ball.position.x+=Math.sin(i*2.4)*.16;ball.position.z+=Math.cos(i*2.2)*.15;ball.position.y+=i*.017;}
   ball.userData.tag.visible=s.cargo==='lysosome'&&s.condition!=='m6p'&&s.condition!=='er-block'&&t>.32&&t<.75;
   ball.userData.ball.material.color.set(s.condition==='normal'?'#dabb72':'#c78b78');
  }
  const buildup=s.condition==='m6p'?Math.max(0,(progress-.55)/.45):0;this.lysoBody.scale.setScalar(1+buildup*.20);this.debris.forEach((d,i)=>d.visible=i<9+Math.round(buildup*25));
 }
 updateAppearance(){
  for(const[id,group]of this.objects){
   const base=group.userData.base;let direction=base.clone();if(direction.length()<.2)direction.set(0,-1,0);direction.normalize();const amount=id==='membrane'?0:this.explosion*(id==='nucleus'?1.5:2.2);group.position.copy(base).addScaledVector(direction,amount);if(id!=='membrane')group.position.y+=this.explosion*.7;
   const dim=this.interior&&this.selected&&id!==this.selected&&id!=='membrane';
   group.traverse(o=>{if(!o.isMesh||!o.material)return;const mat=o.material;
    const nucleusInside=this.interior&&this.selected==='nucleus'&&o===this.nucleusShell;
    const transparent=Boolean(dim||nucleusInside||o.userData.originalTransparent);
    if(mat.transparent!==transparent){mat.transparent=transparent;mat.needsUpdate=true;}
    mat.opacity=dim?.13:nucleusInside?.25:(o.userData.originalOpacity??1);mat.depthWrite=!transparent;
    o.castShadow=!dim&&!nucleusInside&&!o.userData.originalTransparent&&id!=='membrane'&&(o.geometry.type==='BufferGeometry'||(o.geometry.type==='SphereGeometry'&&o.geometry.parameters.radius>=.45));
    if(mat.emissive){const active=id===this.selected;mat.emissive.set(active?structures.find(d=>d.id===id).color:0x000000);mat.emissiveIntensity=active?.045:0;}
   });
  }
  const inner=this.interior&&this.selected;
  if(inner==='nucleus'){this.nucleusShell.material.transparent=true;this.nucleusShell.material.opacity=.25;this.nucleusShell.material.depthWrite=false;this.nucleusShell.castShadow=false;}
  this.mitoCaps.forEach(cap=>cap.visible=inner!=='mitochondria');
  this.golgiSacs.forEach(s=>{s.position.y=(s.userData.layer*.235-.5)+(inner==='golgi'?(s.userData.layer-2.5)*.17:0);});
 }
 updateLabels(){
  this.root.updateMatrixWorld(true);const projected=[];
  for(const l of this.labels){const p=l.group.localToWorld(l.local.clone()).project(this.camera);const x=(p.x*.5+.5)*this.width,y=(-p.y*.5+.5)*this.height;let show=p.z<1&&p.z>-1&&x>25&&x<this.width-25&&y>50&&y<this.height-118;
   if(this.width<600&&['smoothER','membrane','cytoskeleton'].includes(l.id)&&this.selected!==l.id)show=false;
   if(this.interior&&this.selected!==l.id)show=false;
   const active=l.id===this.selected;l.button.classList.toggle('active',active);if(show)projected.push({l,x,y,active});else l.button.style.display='none';
  }
  projected.sort((a,b)=>Number(b.active)-Number(a.active));const boxes=[];
  for(const item of projected){let{x,y,l}=item;const w=l.button.offsetWidth||100;for(let k=0;k<5;k++){const overlap=boxes.some(b=>Math.abs(x-b.x)<(w+b.w)/2+8&&Math.abs(y-b.y)<29);if(!overlap)break;y-=29;}if(y<60)y=60;l.button.style.display='flex';l.button.style.left=x+'px';l.button.style.top=y+'px';boxes.push({x,y,w});}
 }
 animate(now){
  const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.clock+=dt;
  if(this.cameraTween){const t=this.cameraTween;const p=t.duration?Math.min(1,(now-t.start)/t.duration):1;const ease=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;this.camera.position.lerpVectors(t.from,t.to,ease);this.controls.target.lerpVectors(t.fromTarget,t.toTarget,ease);if(p>=1)this.cameraTween=null;}
  this.explosion=THREE.MathUtils.damp(this.explosion,this.explosionTarget,5,dt);this.updateAppearance();this.updateRoutes(dt);const shadowState=[this.selected,this.interior,this.explosion.toFixed(3),this.lysoBody.scale.x.toFixed(2)].join('|');if(shadowState!==this.shadowState){this.renderer.shadowMap.needsUpdate=true;this.shadowState=shadowState;}this.controls.update();this.updateLabels();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.animate);
 }
}
