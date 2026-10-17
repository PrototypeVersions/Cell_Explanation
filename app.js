import {CellScene} from './scene.js?v=20261017-studio';
import {structures,getSteps,stageFor,stageThresholds,stageNames,tourSteps,cases} from './content.js';

const $=s=>document.querySelector(s);
const inspector=$('#inspector'),dock=$('#story-dock');
const playIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor" stroke="none"/></svg>';
const pauseIcon='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';
const arrow='<span aria-hidden="true">↗</span>';
let stored={};try{stored=JSON.parse(localStorage.getItem('inside-the-answer-v1')||'{}');}catch{}
const state={mode:'explore',selected:null,interior:false,labels:true,autoRotate:false,view:'cutaway',tour:null,cargo:'secreted',condition:'normal',progress:0,stage:0,playing:false,speed:1,caseIndex:0,answers:stored.answers&&typeof stored.answers==='object'?stored.answers:{}};
let cell=null, toastTimer, previousTime=performance.now();
function notify(message){const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),2700);}
function save(){try{localStorage.setItem('inside-the-answer-v1',JSON.stringify({answers:state.answers}));}catch{}}
function stopOrbit(){state.autoRotate=false;$('#rotate-toggle').classList.remove('active');$('#rotate-toggle').setAttribute('aria-pressed','false');cell?.setAutoRotate(false);}
function focus(id){stopOrbit();cell?.select(id,true);}
function setMode(mode,{preserveJourney=false}={}){
 if(!['explore','process','challenge'].includes(mode))mode='explore';
 state.mode=mode;state.selected=null;state.interior=false;state.tour=null;state.playing=false;stopOrbit();state.view='cutaway';cell?.reset();
 if(mode==='process'&&!preserveJourney){state.progress=0;state.stage=0;}
 inspector.dataset.mode=mode;document.body.dataset.mode=mode;
 for(const b of document.querySelectorAll('[data-mode]')){if(b.tagName!=='BUTTON')continue;const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}
 for(const b of document.querySelectorAll('[data-view]')){b.classList.toggle('active',b.dataset.view==='cutaway');b.setAttribute('aria-pressed',String(b.dataset.view==='cutaway'));b.disabled=b.dataset.view==='exploded'&&mode!=='explore';b.title=b.disabled?'Separate structures in Explore mode':'';}
 $('#view-caption').hidden=mode!=='explore';$('#context-badge').hidden=true;
 history.replaceState(null,'','#'+mode);renderInspector();renderDock();syncScene();
 if(mode==='process')syncProgress(state.progress,true);
 if(mode==='challenge')showCaseScene();
}
function renderInspector(){
 if(state.mode==='explore'){if(state.tour!==null)renderTour();else if(state.selected)renderStructure();else renderExplore();}
 if(state.mode==='process')renderProcess();
 if(state.mode==='challenge')renderChallenge();
 inspector.scrollTop=0;
}
function renderExplore(){
 inspector.innerHTML=`<span class="eyebrow">01 / EXPLORE THE LIVING CELL</span><h1 class="intro-title">A small world. <br><em>A deeper look.</em></h1><p class="intro-copy">Turn the cell. Open a structure. Discover how the parts become a working whole.</p><div class="section-label"><span>THE STRUCTURES</span><span>09</span></div><div class="structure-list">${structures.map(s=>`<button class="structure-button" data-structure="${s.id}"><span class="dot" style="background:${s.color}"></span><span><strong>${s.short}</strong><small>${s.role}</small></span><span class="structure-arrow" aria-hidden="true">↗</span></button>`).join('')}</div><button class="tour-invite" data-action="start-tour"><span><strong>Start with a guided introduction</strong><small>A few stops. A whole new perspective.</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m10 8 5 4-5 4Z"/></svg></button>`;
}
function renderStructure(){
 const s=structures.find(s=>s.id===state.selected);if(!s)return;
 inspector.innerHTML=`<button class="back-button" data-action="all-structures"><span>←</span> Back to the cell atlas</button><div class="organelle-number"><span class="large-dot" style="background:${s.color}"></span><span class="eyebrow">STRUCTURE ${s.number} / 09</span></div><h1 class="organelle-title">${s.name}</h1><p class="organelle-role">${s.role}</p><p class="organelle-description">${s.description}</p><div class="detail-rule"></div><span class="detail-label">${state.interior?'THE VIEW WITHIN':'LOOK A LITTLE CLOSER'}</span><p class="detail-note">${s.inside}</p><div class="detail-actions"><button class="primary-button" data-action="interior">${state.interior?'Return to context':s.cutaway?'Look inside':'Isolate this structure'} ${arrow}</button><button class="secondary-button" data-action="refocus">Recenter on ${s.short.toLowerCase()} <span>↻</span></button></div><div class="connection-note"><span class="detail-label">MAKE THE CONNECTION</span><p>${s.connection}</p></div>`;
}
function renderTour(){
 const step=tourSteps[state.tour];
 inspector.innerHTML=`<span class="eyebrow">A GUIDED INTRODUCTION</span><h1 class="intro-title">Step inside.<br><em>Connect the dots.</em></h1><p class="intro-copy">A short route through the cell. Stay as long as you like.</p><div class="tour-progress">${tourSteps.map((_,i)=>`<span class="${i<=state.tour?'active':''}"></span>`).join('')}</div><div class="tour-kicker"><span>STOP ${state.tour+1} OF ${tourSteps.length}</span><button data-action="exit-tour">Explore freely</button></div><div class="tour-content"><h3>${step.title}</h3><p>${step.text}</p><button class="primary-button" data-action="tour-next">${step.action} ${arrow}</button></div><p class="tour-hint">You can orbit and zoom at every stop. Selecting any structure opens its atlas entry.</p>${state.tour>0?'<button class="back-button" data-action="tour-back" style="margin-top:18px">← Previous stop</button>':''}`;
}
function startTour(){setMode('explore');state.tour=0;renderInspector();renderDock();cell?.reset();}
function tourNext(delta=1){
 const next=state.tour+delta;if(next>=tourSteps.length){state.cargo='lysosome';state.condition='normal';setMode('process');togglePlay(true);return;}
 state.tour=Math.max(0,next);renderInspector();renderDock();focus(tourSteps[state.tour].focus);
}
function renderProcess(){
 const steps=getSteps(state.cargo,state.condition);
 inspector.innerHTML=`<span class="eyebrow">02 / FOLLOW THE MECHANISM</span><h1 class="intro-title">A protein has<br><em>a destination.</em></h1><p class="intro-copy">Follow the cargo. Change one step.<br>See why the outcome changes.</p><div class="cargo-switch" role="group" aria-label="Cargo destination"><button data-cargo="secreted" class="${state.cargo==='secreted'?'active':''}" aria-pressed="${state.cargo==='secreted'}">Secreted protein</button><button data-cargo="lysosome" class="${state.cargo==='lysosome'?'active':''}" aria-pressed="${state.cargo==='lysosome'}">Lysosomal enzyme</button></div><label for="condition-select" class="condition-label">WHAT IF ONE STEP CHANGES?</label><select id="condition-select" class="condition-select"><option value="normal" ${state.condition==='normal'?'selected':''}>Normal trafficking</option><option value="er-block" ${state.condition==='er-block'?'selected':''}>Block ER export · COPII</option>${state.cargo==='lysosome'?`<option value="m6p" ${state.condition==='m6p'?'selected':''}>Lose M6P tagging · I-cell disease</option>`:''}</select><div class="process-list">${steps.map((s,i)=>`<button class="step-button ${i===state.stage?'active':''} ${i<state.stage?'complete':''}" data-step="${i}" aria-current="${i===state.stage?'step':'false'}"><span class="step-marker">${String(i+1).padStart(2,'0')}</span><span><strong>${stageNames[i]}</strong><small>${s.short}</small></span></button>`).join('')}</div><div class="step-explanation" id="step-explanation" aria-live="polite">${explanationMarkup(steps[state.stage])}</div><button class="mechanism-link" data-action="compare-normal">${state.condition==='normal'?'Try a disrupted pathway →':'Compare with normal trafficking →'}</button>`;
}
function explanationMarkup(step){return `<span class="step-kicker">${String(state.stage+1).padStart(2,'0')} / ${step.title.toUpperCase()}</span><p>${step.text}</p>`;}
function renderChallenge(){
 const q=cases[state.caseIndex];const a=state.answers[q.id]||{};const answered=a.submitted===true;
 inspector.innerHTML=`<span class="eyebrow">03 / ${q.tag}</span><h1 class="intro-title">${q.title}</h1><div class="case-selector" role="group" aria-label="Choose a case">${cases.map((c,i)=>`<button data-case="${i}" class="${i===state.caseIndex?'active':''} ${state.answers[c.id]?.submitted?'solved':''}" aria-label="Case ${i+1}: ${c.title.replace(/<br>/g,' ')}" aria-pressed="${i===state.caseIndex}">${i+1}</button>`).join('')}</div><p class="case-vignette">${q.vignette}</p><div class="clinical-clues">${q.clues.map(c=>`<span>${c}</span>`).join('')}</div><p class="case-question">${q.question}</p><div class="answer-options" role="group" aria-label="Answer choices">${q.options.map((opt,i)=>`<button class="answer-option ${a.choice===i?'selected':''} ${answered&&i===q.correct?'correct':''} ${answered&&a.choice===i&&i!==q.correct?'wrong':''}" data-answer="${i}" aria-pressed="${a.choice===i}" ${answered?'disabled':''}><span>${String.fromCharCode(65+i)}</span><span>${opt}</span></button>`).join('')}</div>${!answered?`<button class="primary-button submit-answer" data-action="submit-answer" ${!Number.isInteger(a.choice)?'disabled':''}>Reveal the mechanism ${arrow}</button>`:`<div class="answer-feedback ${a.choice!==q.correct?'incorrect':''}" role="status"><span class="feedback-label">${a.choice===q.correct?'YOU FOUND THE MECHANISM':'FOLLOW THE EVIDENCE'}</span><h3>${q.heading}</h3>${a.choice!==q.correct?`<p>${q.wrong[a.choice]}</p>`:''}<p>${q.explanation}</p><div class="feedback-actions"><button class="primary-button" data-action="trace-case">Trace the explanation ${arrow}</button><button class="secondary-button" data-action="retry-case">Try again</button></div></div>`}`;
}
function renderDock(){
 if(state.mode==='explore'){
  if(state.tour!==null){dock.innerHTML=`<div class="tour-dock-content"><span class="tour-circle">${String(state.tour+1).padStart(2,'0')}</span><div><span class="dock-eyebrow">YOUR GUIDED ROUTE</span><h2 class="dock-title">${tourSteps[state.tour].title}</h2><p class="dock-copy">A starting point for a much longer exploration.</p></div></div><button class="secondary-button" data-action="exit-tour">Explore freely ${arrow}</button>`;return;}
  dock.innerHTML=`<div><span class="dock-eyebrow">FROM STRUCTURE TO UNDERSTANDING</span><h2 class="dock-title">Every destination has a story.</h2><p class="dock-copy">Watch a protein find its way. Then discover what happens when it doesn’t.</p></div><div class="dock-actions"><button class="primary-button" data-action="begin-process">Follow a protein ${arrow}</button><button class="secondary-button" data-action="begin-case">Solve a case <span>→</span></button></div>`;
 }else if(state.mode==='process'){
  dock.innerHTML=`<div class="process-dock"><div class="play-group"><button class="play-button" id="play-toggle" data-action="play" aria-label="${state.playing?'Pause':'Play'} the pathway">${state.playing?pauseIcon:playIcon}</button><span><strong>${state.cargo==='lysosome'?'A lysosomal enzyme':'A secreted protein'}</strong><small id="playback-status">${state.playing?'Follow the moving cargo':'Play, or inspect any moment'}</small></span></div><div class="timeline-wrapper"><label class="skip-link" for="journey-progress">Pathway progress</label><input type="range" min="0" max="1000" value="${state.progress*1000}" id="journey-progress" class="play-track" aria-label="Pathway progress" aria-valuetext="${stageNames[state.stage]}"><div class="track-labels"><span>ER</span><span>GOLGI</span><span id="destination-label">${state.condition==='er-block'?'RETAINED IN ER':state.cargo==='lysosome'&&state.condition!=='m6p'?'LYSOSOME':'OUTSIDE THE CELL'}</span></div></div><div class="next-stage"><button class="speed-button" data-action="speed" aria-label="Change playback speed">${state.speed}×</button><button class="secondary-button" data-action="next-step">Next step <span>→</span></button></div></div>`;
 }else{
  const q=cases[state.caseIndex],answered=state.answers[q.id]?.submitted;const count=cases.filter(q=>state.answers[q.id]?.submitted).length;
  dock.innerHTML=`<div class="challenge-dock">${answered?`<div class="reasoning-chain">${q.chain.map(([title,sub],i)=>`${i?'<span aria-hidden="true">→</span>':''}<div><strong>${title}</strong><small>${sub}</small></div>`).join('')}</div>`:`<div><span class="dock-eyebrow">MAKE A PREDICTION FIRST</span><p class="pending-clue">Find the mechanism.<br><span>Then step inside the answer.</span></p></div>`}<div class="dock-actions"><span class="case-progress">${count} / ${cases.length} cases explored</span>${answered?'<button class="secondary-button" data-action="next-case">Next case <span>→</span></button>':''}</div></div>`;
 }
}
function selectStructure(id){
 if(!structures.some(s=>s.id===id))return;
 if(state.mode==='explore'){state.selected=id;state.tour=null;state.interior=false;renderInspector();renderDock();focus(id);}
 else{focus(id);notify(structures.find(s=>s.id===id).name);}
}
function syncScene(){
 cell?.setProcess({visible:state.mode==='process',cargo:state.cargo,condition:state.condition,progress:state.progress});
}
function syncProgress(progress,moveCamera=false){
 state.progress=Math.max(0,Math.min(1,progress));const stage=stageFor(state.progress),changed=stage!==state.stage;state.stage=stage;
 if(state.mode==='process'){
  const steps=getSteps(state.cargo,state.condition);const step=steps[stage];
  for(const b of document.querySelectorAll('[data-step]')){const i=Number(b.dataset.step);b.classList.toggle('active',i===stage);b.classList.toggle('complete',i<stage);b.setAttribute('aria-current',i===stage?'step':'false');}
  if(changed||moveCamera){$('#step-explanation').innerHTML=explanationMarkup(step);if(moveCamera||state.playing)focus(step.focus);}
  const range=$('#journey-progress');if(range){range.value=String(state.progress*1000);range.setAttribute('aria-valuetext',`${Math.round(state.progress*100)} percent — ${stageNames[stage]}`);}
  updateBadge();syncScene();
 }
}
function updateBadge(){
 const badge=$('#context-badge');if(state.mode!=='process'){badge.hidden=true;return;}
 const bad=state.condition!=='normal';badge.hidden=false;badge.classList.toggle('bad',bad);
 if(state.condition==='er-block')badge.innerHTML='<span class="micro-label">ER EXPORT BLOCKED</span><strong>The journey stops upstream.</strong>New cargo is retained in the ER.';
 else if(state.condition==='m6p')badge.innerHTML=`<span class="micro-label">M6P TARGETING DISRUPTED</span><strong>${state.stage<3?'An address is missing.':'The cargo takes the wrong route.'}</strong>${state.stage<3?'The enzyme can still be made.':'Many hydrolases are secreted; lysosomes are undersupplied.'}`;
 else if(state.cargo==='lysosome')badge.innerHTML=`<span class="micro-label">LYSOSOMAL ENZYME · NORMAL</span><strong>${state.stage<2?'A shared beginning.':state.stage<4?'A molecular address.':'The right destination.'}</strong>${state.stage<2?'The early route matches secretory cargo.':state.stage<4?'M6P enables receptor recognition.':'Endosome → lysosome.'}`;
 else badge.innerHTML='<span class="micro-label">SECRETED PROTEIN · NORMAL</span><strong>A route to the outside.</strong>ER → Golgi → plasma membrane.';
}
function togglePlay(force){
 state.playing=typeof force==='boolean'?force:!state.playing;
 if(state.playing&&state.progress>=.999)syncProgress(0,true);
 const button=$('#play-toggle');if(button){button.innerHTML=state.playing?pauseIcon:playIcon;button.setAttribute('aria-label',`${state.playing?'Pause':'Play'} the pathway`);}
 const status=$('#playback-status');if(status)status.textContent=state.playing?'Follow the moving cargo':state.progress>=.999?'Journey complete · play again':'Paused · inspect this moment';
}
function changeScenario(cargo,condition){
 state.cargo=cargo;state.condition=condition==='m6p'&&cargo!=='lysosome'?'normal':condition;state.progress=0;state.stage=0;state.playing=false;renderProcess();renderDock();syncProgress(0,true);togglePlay(true);
}
function showCaseScene(){
 const q=cases[state.caseIndex],a=state.answers[q.id];$('#view-caption').hidden=true;
 if(a?.submitted){cell?.setProcess({visible:true,cargo:q.cargo,condition:q.condition,progress:.96});focus(q.focus);const badge=$('#context-badge');badge.hidden=false;badge.classList.toggle('bad',q.condition!=='normal');badge.innerHTML=`<span class="micro-label">THE MECHANISM REVEALED</span><strong>${q.condition==='m6p'?'Missing M6P signal':q.condition==='er-block'?'Blocked ER export':'Endosomal delivery'}</strong>Select “Trace the explanation” to follow the full route.`;}
 else{cell?.setProcess({visible:false,cargo:'secreted',condition:'normal',progress:0});$('#context-badge').hidden=true;cell?.reset();}
}
function changeCase(index){state.caseIndex=(index+cases.length)%cases.length;state.playing=false;renderChallenge();renderDock();showCaseScene();}
function submitAnswer(){const q=cases[state.caseIndex],a=state.answers[q.id];if(!a||!Number.isInteger(a.choice))return;a.submitted=true;save();renderChallenge();renderDock();showCaseScene();setTimeout(()=>$('.answer-feedback')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest'}),60);}
function openDialog(id){if(state.playing)togglePlay(false);$(id).showModal();}

document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mode){setMode(b.dataset.mode);return;}
 if(b.dataset.structure){selectStructure(b.dataset.structure);return;}
 if(b.dataset.view){state.view=b.dataset.view;cell?.setView(state.view);for(const x of document.querySelectorAll('[data-view]')){const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));}stopOrbit();return;}
 if(b.dataset.cargo){changeScenario(b.dataset.cargo,state.condition);return;}
 if(b.dataset.step!==undefined){togglePlay(false);syncProgress(stageThresholds[Number(b.dataset.step)]+.008,true);return;}
 if(b.dataset.case!==undefined){changeCase(Number(b.dataset.case));return;}
 if(b.dataset.answer!==undefined){const q=cases[state.caseIndex];if(state.answers[q.id]?.submitted)return;state.answers[q.id]={choice:Number(b.dataset.answer),submitted:false};renderChallenge();return;}
 if(b.hasAttribute('data-close')){b.closest('dialog').close();return;}
 switch(b.dataset.action){
  case'all-structures':setMode('explore');break;
  case'interior':state.interior=!state.interior;cell?.setInterior(state.interior);renderStructure();break;
  case'refocus':focus(state.selected);cell?.setInterior(state.interior);break;
  case'start-tour':startTour();break;
  case'exit-tour':setMode('explore');break;
  case'tour-next':tourNext(1);break;
  case'tour-back':tourNext(-1);break;
  case'begin-process':setMode('process');togglePlay(true);break;
  case'begin-case':setMode('challenge');break;
  case'play':togglePlay();break;
  case'speed':state.speed=state.speed===1?1.5:state.speed===1.5?2:state.speed===2?.5:1;b.textContent=state.speed+'×';break;
  case'next-step':togglePlay(false);syncProgress(state.stage===5?0:stageThresholds[state.stage+1]+.008,true);break;
  case'compare-normal':changeScenario(state.cargo,state.condition==='normal'?(state.cargo==='lysosome'?'m6p':'er-block'):'normal');break;
  case'submit-answer':submitAnswer();break;
  case'next-case':changeCase(state.caseIndex+1);break;
  case'retry-case':delete state.answers[cases[state.caseIndex].id];save();renderChallenge();renderDock();showCaseScene();break;
  case'trace-case':{const q=cases[state.caseIndex];state.cargo=q.cargo;state.condition=q.condition;setMode('process');togglePlay(true);break;}
 }
});
document.addEventListener('change',e=>{if(e.target.id==='condition-select')changeScenario(state.cargo,e.target.value);});
document.addEventListener('input',e=>{if(e.target.id==='journey-progress'){togglePlay(false);syncProgress(Number(e.target.value)/1000,false);}});
$('#labels-toggle').addEventListener('click',()=>{state.labels=!state.labels;cell?.setLabels(state.labels);$('#labels-toggle').classList.toggle('active',state.labels);$('#labels-toggle').setAttribute('aria-pressed',String(state.labels));notify(state.labels?'Labels shown':'Labels hidden');});
$('#rotate-toggle').addEventListener('click',()=>{state.autoRotate=!state.autoRotate;cell?.setAutoRotate(state.autoRotate);$('#rotate-toggle').classList.toggle('active',state.autoRotate);$('#rotate-toggle').setAttribute('aria-pressed',String(state.autoRotate));});
$('#reset-view').addEventListener('click',()=>{stopOrbit();state.view='cutaway';state.interior=false;cell?.reset();for(const b of document.querySelectorAll('[data-view]')){b.classList.toggle('active',b.dataset.view==='cutaway');b.setAttribute('aria-pressed',String(b.dataset.view==='cutaway'));}if(state.mode==='explore'){state.selected=null;state.tour=null;renderInspector();renderDock();}notify('View reset');});
$('#fullscreen-toggle').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('#visual').requestFullscreen)await $('#visual').requestFullscreen();else notify('Fullscreen is unavailable in this browser');}catch{notify('Fullscreen is unavailable here');}});
$('#help-open').addEventListener('click',()=>openDialog('#help-dialog'));$('#sources-open').addEventListener('click',()=>openDialog('#notes-dialog'));$('#notes-open').addEventListener('click',()=>openDialog('#notes-dialog'));
document.querySelector('.brand').addEventListener('click',e=>{e.preventDefault();setMode('explore');});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
document.addEventListener('keydown',e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||$('dialog[open]')||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable)return;
 if(['1','2','3'].includes(e.key)){e.preventDefault();setMode(['explore','process','challenge'][Number(e.key)-1]);}
 if(e.key.toLowerCase()==='l')$('#labels-toggle').click();if(e.key.toLowerCase()==='r')$('#reset-view').click();
 if(e.code==='Space'&&state.mode==='process'&&e.target.tagName!=='BUTTON'){e.preventDefault();togglePlay();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.playing)togglePlay(false);});
function tick(now){const dt=Math.min(.08,(now-previousTime)/1000);previousTime=now;if(state.mode==='process'&&state.playing){syncProgress(state.progress+dt*state.speed/60);if(state.progress>=1)togglePlay(false);}requestAnimationFrame(tick);}

try{cell=new CellScene($('#scene'),selectStructure);$('#loading').classList.add('done');setTimeout(()=>$('#loading').hidden=true,650);}catch(error){console.error('3D initialization:',error);$('#loading').hidden=true;$('#renderer-error').hidden=false;$('#scene-labels').hidden=true;for(const b of document.querySelectorAll('.view-tools button'))b.disabled=true;}
setMode(location.hash.slice(1)||'explore');requestAnimationFrame(tick);
