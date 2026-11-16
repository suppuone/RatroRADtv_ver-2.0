/* Optional tone path: the original radio element is never attached to Web Audio.
 * A CORS-enabled companion must play successfully before direct sound is reduced.
 * If it fails, direct playback is restored. No station URL or preset is changed.
 */
window.createRadioToneControls = function({media, getVolume, onChange=()=>{}}) {
  const key='retrotvra.radio-tone.v1', status=document.getElementById('tone-status');
  const inputs=[document.getElementById('radio-bass'),document.getElementById('radio-treble')];
  let values={bass:0,treble:0}, context, player, hls, source, bass, treble, gain, analyser;
  let active=false, token=0, timeout=0, failedSource='', pending=false;
  const clamp=n=>Math.max(-12,Math.min(12,Math.round(Number(n)||0)));
  try {const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const name of ['bass','treble'])values[name]=clamp(saved[name]);}catch{}
  const desired=()=>values.bass!==0||values.treble!==0;
  const sourceURL=()=>media.currentSrc||media.src||'';
  function message(text){status.textContent=text;}
  function paint(){
    for(const input of inputs){
      const value=values[input.dataset.tone], label=(value>0?'+':'')+value+' dB';
      input.value=String(value);input.setAttribute('aria-valuetext',label);
      input.closest('.tone-control').style.setProperty('--tone-angle',value*11.25+'deg');
      document.getElementById(input.id+'-value').textContent=label;
    }
  }
  function volume(){
    const level=Math.max(0,Math.min(1,Number(getVolume())||0));
    if(gain&&context)gain.gain.setTargetAtTime(active&&!media.muted?level:0,context.currentTime,.02);
    const direct=active?0:level;if(Math.abs(media.volume-direct)>.0001)media.volume=direct;
  }
  function stop(){
    token++;pending=false;clearTimeout(timeout);active=false;
    if(gain&&context)gain.gain.setValueAtTime(0,context.currentTime);
    if(hls){hls.destroy();hls=null;}
    if(player){player.pause();player.removeAttribute('src');player.load();}
    volume();onChange();
  }
  function unavailable(url){
    stop();failedSource=url;
    for(const input of inputs)input.disabled=true;
    message('Tone unavailable for this station · normal playback');
  }
  function configure(){
    bass.gain.setTargetAtTime(values.bass,context.currentTime,.03);
    treble.gain.setTargetAtTime(values.treble,context.currentTime,.03);
    // Leave headroom for boosted shelves, then limit peaks gently.
  }
  function initialize(){
    if(context)return;
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)throw new Error('Web Audio unavailable');
    context=new AudioContext();player=new Audio();player.crossOrigin='anonymous';player.preload='none';
    source=context.createMediaElementSource(player);
    bass=context.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=180;
    treble=context.createBiquadFilter();treble.type='highshelf';treble.frequency.value=3500;
    const headroom=context.createGain();headroom.gain.value=.5;
    const limiter=context.createDynamicsCompressor();limiter.threshold.value=-6;limiter.knee.value=6;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.2;
    analyser=context.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.65;
    gain=context.createGain();gain.gain.value=0;
    source.connect(bass);bass.connect(treble);treble.connect(headroom);headroom.connect(limiter);limiter.connect(analyser);analyser.connect(gain);gain.connect(context.destination);
    player.addEventListener('error',()=>{if(active||pending)unavailable(sourceURL());});
    // Any companion buffering restores direct sound instead of risking silence.
    for(const name of ['waiting','stalled','ended'])player.addEventListener(name,()=>{if(active)unavailable(sourceURL());});
    context.addEventListener('statechange',()=>{if(active&&context.state!=='running')unavailable(sourceURL());});
  }
  async function begin(){
    const url=sourceURL();
    if(!desired()){stop();message('Tone neutral · double-tap a knob to reset');return;}
    if(!url||media.paused){message('Tone saved · press Play to listen');return;}
    if(active){configure();return;}
    if(pending||url===failedSource)return;
    // A MediaSource blob belongs to its existing player and cannot be reused.
    if(!/^https?:/i.test(url)){unavailable(url);return;}
    stop();pending=true;const current=token;message('Checking tone support…');
    try{
      initialize();configure();
      timeout=setTimeout(()=>{if(current===token)unavailable(url);},8000);
      await context.resume();if(current!==token)return;
      const ready=()=>{
        if(current!==token||media.paused||sourceURL()!==url)return;
        active=true;pending=false;clearTimeout(timeout);volume();message('Tone active · double-tap a knob to reset');onChange();
      };
      // Start playback only after listeners are in place; guard every asynchronous path.
      player.onplaying=ready;
      const start=()=>{if(current===token)player.play().catch(()=>{if(current===token)unavailable(url);});};
      if(/\.m3u8(?:$|[?#])/i.test(url)&&window.Hls&&window.Hls.isSupported()){
        hls=new window.Hls({enableWorker:true,maxBufferLength:12});
        hls.on(window.Hls.Events.MANIFEST_PARSED,start);
        hls.on(window.Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&current===token)unavailable(url);});
        hls.loadSource(url);hls.attachMedia(player);
      }else{player.src=url;start();}
    }catch{if(current===token)unavailable(url);}
  }
  function change(input){
    values[input.dataset.tone]=clamp(input.value);paint();
    try{localStorage.setItem(key,JSON.stringify(values));}catch{}
    begin();
  }
  for(const input of inputs){
    input.addEventListener('input',()=>change(input));
    const face=input.closest('.tone-control').querySelector('.tone-dial');let drag=null,lastTap=0;
    face.addEventListener('pointerdown',event=>{
      if(input.disabled||event.button!==0)return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(input.value)};
      face.setPointerCapture(event.pointerId);input.focus({preventScroll:true});event.preventDefault();
    });
    face.addEventListener('pointermove',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      input.value=String(clamp(drag.value+(drag.y-event.clientY+event.clientX-drag.x)/5));change(input);
    });
    face.addEventListener('pointerup',event=>{
      if(!drag||drag.id!==event.pointerId)return;
      const tapped=Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6;drag=null;
      if(face.hasPointerCapture(event.pointerId))face.releasePointerCapture(event.pointerId);
      const now=performance.now();if(tapped&&lastTap&&now-lastTap<400){input.value='0';change(input);lastTap=0;}else lastTap=tapped?now:0;
    });
    face.addEventListener('pointercancel',()=>{drag=null;});
    input.addEventListener('keydown',event=>{if(event.key==='Home'){event.preventDefault();input.value='0';change(input);}});
  }
  media.addEventListener('playing',begin);
  media.addEventListener('pause',stop);
  media.addEventListener('emptied',()=>{failedSource='';stop();for(const input of inputs)input.disabled=false;message('Tone saved · available on supported stations');});
  media.addEventListener('volumechange',volume);
  paint();message('Tone neutral · drag knobs or use arrow keys');
  return {refreshVolume:volume,get active(){return active;},get analyser(){return active?analyser:null;}};
};
