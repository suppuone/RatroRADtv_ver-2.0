(() => {
  'use strict';
  const PRESET_LIMIT=50;
  const $ = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const stationLogo = station => String(station?.logo||station?.favicon||station?.image||station?.['tvg-logo']||station?.tvg_logo||station?.icon||'').trim();
  const initialsFor = title => String(title||'LIVE').trim().split(/\s+/).filter(Boolean).slice(0,3).map(word=>word[0]).join('').toUpperCase()||'TV';
  function logoInitials(image){const card=image.closest('.radio-mini-card,.tv-rail-card,.preset-card,.result-row'),title=card?.querySelector('.radio-mini-card b,.tv-rail-copy b,.preset-card>b,.result-copy b')?.textContent||$('radio-title')?.textContent||'LIVE';return initialsFor(title);}
  document.addEventListener('error',event=>{const image=event.target;if(!image||image.tagName!=='IMG')return;const source=image.currentSrc||image.src;if(/^http:\/\//i.test(source)&&image.dataset.httpsRetry!=='1'){image.dataset.httpsRetry='1';image.src=source.replace(/^http:/i,'https:');return;}if(image.dataset.namedFallback!=='1'){const title=image.alt||image.closest('[aria-label]')?.getAttribute('aria-label')?.replace(/^Play /,'')||'';const station=[...radios,...tvs].find(s=>s.name===title);if(station?.fallbackLogo){image.dataset.namedFallback='1';image.src=station.fallbackLogo;return;}}const fallback=document.createElement('span');if(image.classList.contains('station-logo-badge')){fallback.className='station-logo-fallback';fallback.textContent=logoInitials(image);}else{fallback.className='logo-fallback';fallback.textContent=logoInitials(image);}image.replaceWith(fallback);},true);
  const RADIO_STORE='retrotvra.radio-presets.v3',TV_STORE='retrotvra.tv-presets.v3',TV_ORDER_STORE='retrotvra.tv-order.catalogue50.v1',RADIO_HIDDEN_STORE='retrotvra.radio-hidden.v9',TV_HIDDEN_STORE='retrotvra.tv-hidden.v4',VOLUME_STORE='retrotvra.volume.v1',THEME_STORE='retrotvra.theme.v2',RADIO_SKIN_STORE='retrotvra.radio-skin.v1',LEGACY_THEME_ENABLED_STORE='retrotvra.legacy-theme-enabled.v1',THEME_SWITCH_ENABLED_STORE='retrotvra.theme-switch-enabled.v1',RECENT_STORE='retrotvra.recent.v2';
  let radios=[],tvs=[],radioPresets={},tvPresets={},recentHistory=[],radioIndex=-1,tvIndex=-1,presetMode='radio',selectedTVPresetKey=null,browserKind='radio',browserSource='library',onlineRows=[],onlineTVCache=null,onlineCountries=[],onlineGenres=[],onlineOffset=0,onlineVisibleLimit=100,onlineHasMore=false,onlineSearchDone=false,hls=null,radioHls=null,currentRadioSource='',toastTimer=null,dragState=null,languageCatalog=[],languageNameByCode=new Map(),languageNameByKey=new Map();
  const audio=$('radio-audio'),video=$('tv-video');

  const THEME_GLOW={retro:'warm',modern:'white',ultra:'color'};
  let legacyThemeEnabled=false,themeSwitchEnabled=true;
  try{const legacySetting=localStorage.getItem(LEGACY_THEME_ENABLED_STORE),themeSetting=localStorage.getItem(THEME_SWITCH_ENABLED_STORE);if(legacySetting!==null)legacyThemeEnabled=legacySetting==='true';if(themeSetting!==null)themeSwitchEnabled=themeSetting==='true';}catch{}
  let radioSkin='modern';try{radioSkin=localStorage.getItem(RADIO_SKIN_STORE)==='legacy'?'legacy':'modern';}catch{}
  if(!legacyThemeEnabled)radioSkin='modern';
  document.body.dataset.radioSkin=radioSkin;
  let themeMode='ultra';try{themeMode=localStorage.getItem(THEME_STORE)||'ultra';}catch{}
  if(!['retro','modern','ultra'].includes(themeMode))themeMode='ultra';
  let glowMode=THEME_GLOW[themeMode];
  const DEFAULT_TV_CHANNEL={"name": "BBC News South Asia (720p)", "group": "News", "logo": "https://xstreamcp-assets-msp.streamready.in/assets/LIVETV/LIVECHANNEL/LIVETV_LIVETVCHANNEL_BBC_NEWS/images/LOGO_HD/image.png", "url": "https://mumbai-edge.smartplaytv.in/BBCNews/index.m3u8", "options": [], "genre": "News", "country": "United Kingdom", "language": "English", "tags": "English news curated", "curated": true, "curatedOrder": 4, "presetNumber": 13, "presetLanguage": "International English", "presetGenre": "News", "catalogSource": "Saved preset"};
  let visualizerPattern='halo';try{visualizerPattern=localStorage.getItem('retrotvra.visualizer-pattern.v5')||'halo';}catch{}
  if(!['wave','halo','mesh','mix','off'].includes(visualizerPattern))visualizerPattern='halo';
  let visualizerMixBag=[],visualizerMixCurrent='',visualizerMixSince=0;
  function nextMixedVisualizer(){if(!visualizerMixBag.length){visualizerMixBag=['wave','halo','mesh'].sort(()=>Math.random()-.5);if(visualizerMixBag[0]===visualizerMixCurrent)visualizerMixBag.push(visualizerMixBag.shift());}visualizerMixCurrent=visualizerMixBag.shift();}
  let meterAudio=null,meterContext=null,meterAnalyser=null,meterGain=null,meterSource=null,meterBins=null,meterFrame=0,meterLevel=0,meterLastPaint=0;
  function stopSoundRays(){if(meterFrame){cancelAnimationFrame(meterFrame);meterFrame=0;}if(meterAudio)meterAudio.pause();const canvas=$('sound-rays');if(canvas){const c=canvas.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);}}
  function startSoundRays(){
    if(audio.paused||visualizerPattern==='off')return;
    const canvas=$('sound-rays');if(!canvas)return;
    // Analyse a silent CORS-enabled monitor so unsupported streams cannot silence the player.
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;
      if(Ctx){
        if(!meterContext){meterContext=new Ctx();meterAnalyser=meterContext.createAnalyser();meterAnalyser.fftSize=1024;meterAnalyser.smoothingTimeConstant=.65;meterBins=new Uint8Array(meterAnalyser.frequencyBinCount);meterAudio=new Audio();meterAudio.crossOrigin='anonymous';meterAudio.preload='none';meterSource=meterContext.createMediaElementSource(meterAudio);meterGain=meterContext.createGain();meterGain.gain.value=0;meterSource.connect(meterAnalyser);meterAnalyser.connect(meterGain);meterGain.connect(meterContext.destination);}
        const src=audio.currentSrc||audio.src;
        if(src&&meterAudio.src!==src){meterAudio.pause();meterAudio.src=src;meterAudio.load();}
        meterContext.resume().then(()=>{if(!audio.paused)meterAudio.play().catch(()=>{});}).catch(()=>{});
      }
    }catch{}

    if(!meterFrame){
      const draw=()=>{
        if(audio.paused){stopSoundRays();return;}
        const now=performance.now();
        if(now-meterLastPaint<24){meterFrame=requestAnimationFrame(draw);return;}
        meterLastPaint=now;
        const box=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,box.width),h=Math.max(1,box.height);
        if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
        const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
        const t=now/1000;
        let activePattern=visualizerPattern;
        if(visualizerPattern==='mix'){
          if(!visualizerMixSince||now-visualizerMixSince>=10000){nextMixedVisualizer();visualizerMixSince=now;}
          activePattern=visualizerMixCurrent;
          const elapsed=now-visualizerMixSince;
          canvas.style.opacity=String(Math.max(0,Math.min(1,elapsed/450,(10000-elapsed)/450)));
        }else canvas.style.opacity='1';

        let energy=0,hasSignal=false;
        if(meterAnalyser&&meterBins){
          meterAnalyser.getByteFrequencyData(meterBins);
          let sum=0,weight=0;
          const limit=Math.min(180,meterBins.length);
          for(let j=2;j<limit;j++){const wt=j<24?1.7:j<72?1.25:.72;sum+=meterBins[j]*meterBins[j]*wt;weight+=wt;}
          energy=weight?Math.sqrt(sum/weight)/255:0;
          hasSignal=energy>.009;
        }
        // Never synthesize loudness when analysis is unavailable or the source is silent.
        meterLevel+=(energy-meterLevel)*(energy>meterLevel?.60:.18);
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const phase=reduced?0:t;
        const vw=w;
        const baseline=h-3;
        if(activePattern==='halo'||activePattern==='mesh'){
          c.globalCompositeOperation='lighter';
          const strength=Math.min(1,Math.sqrt(meterLevel)*1.5);
          if(activePattern==='halo'){
            const count=reduced?80:150,points=[],cx=vw/2,cy=h*.52,base=Math.min(vw*.39,h*.43);
            for(let i=0;i<count;i++){
              const angle=i/count*Math.PI*2,bin=Math.min(meterBins?.length-1||0,2+i%110),sample=hasSignal?meterBins[bin]/255:0;
              const radius=base+(sample-.3)*base*.2*strength+Math.sin(angle*9+phase*.5)*base*.035;
              points.push({x:cx+Math.cos(angle+phase*.08)*radius,y:cy+Math.sin(angle+phase*.08)*radius});
            }
            for(let i=0;i<count;i++){
              const point=points[i],hue=(185+i/count*300+phase*9)%360;
              c.strokeStyle=`hsla(${hue},95%,70%,${.2+strength*.38})`;c.fillStyle=`hsla(${hue},100%,80%,${.45+strength*.5})`;c.lineWidth=.9;
              c.shadowColor=`hsl(${hue},100%,65%)`;c.shadowBlur=i%4===0?5+strength*7:0;
              for(const offset of [1,4,7]){const next=points[(i+offset)%count];c.beginPath();c.moveTo(point.x,point.y);c.lineTo(next.x,next.y);c.stroke();}
              c.beginPath();c.arc(point.x,point.y,1+strength,0,Math.PI*2);c.fill();
            }
          }else{
            const cols=36,rows=reduced?10:18,points=[];
            for(let row=0;row<rows;row++){points[row]=[];for(let col=0;col<=cols;col++){
              const u=col/cols,bin=Math.min(meterBins?.length-1||0,2+col*3),sample=hasSignal?meterBins[bin]/255:0;
              points[row][col]={x:u*vw,y:baseline-row*3-(.5+.5*Math.sin(u*6+phase*.4+row*.12))*h*(.08+strength*.35+sample*.15)*(row/(rows-1))};
            }}
            for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
              const point=points[row][col];c.strokeStyle=`hsla(${185+col/cols*90},90%,65%,${.2+strength*.35})`;c.lineWidth=.9;
              for(const next of [points[row][col+1],points[row+1]?.[col],points[row+1]?.[col+1]])if(next){c.beginPath();c.moveTo(point.x,point.y);c.lineTo(next.x,next.y);c.stroke();}
            }
          }
          c.shadowBlur=0;c.globalAlpha=1;c.globalCompositeOperation='source-over';meterFrame=requestAnimationFrame(draw);return;
        }
        const gradient=c.createLinearGradient(0,h*.64,vw,h);
        gradient.addColorStop(0,'#25d9ed');gradient.addColorStop(.2,'#5584ff');gradient.addColorStop(.4,'#b56bff');gradient.addColorStop(.6,'#ff5cb4');gradient.addColorStop(.8,'#ffbd59');gradient.addColorStop(1,'#68e9bd');
        c.globalCompositeOperation='lighter';c.strokeStyle=gradient;
        const lines=reduced?16:32,steps=140;
        for(let layer=0;layer<2;layer++){
          for(let line=0;line<lines;line++){
            const strand=line/(lines-1);
            c.beginPath();
            for(let step=0;step<=steps;step++){
              const u=step/steps,x=u*vw;
              const sample=hasSignal?meterBins[Math.min(meterBins.length-1,Math.floor(u*150))]/255:meterLevel;
              const leftPeak=.08+Math.sin(phase*.45+layer)*.012;
              const rightPeak=.92+Math.sin(phase*.4+layer)*.012;
              const spread=.045+strand*.018;
              const shape=Math.min(1,Math.exp(-Math.pow((u-leftPeak)/spread,2))+Math.exp(-Math.pow((u-rightPeak)/spread,2))*(.9+.1*Math.sin(phase+strand)));
              const secondary=.5+.5*Math.sin(u*Math.PI*6+phase*.42+strand);
              const amplitude=h*Math.min(.32,Math.sqrt(meterLevel)*.28+sample*.15);
              const vibration=Math.sin(u*48+phase*3+strand*5)*sample*h*.009;
              const y=baseline-Math.max(0,shape*(.35+strand*.65)*amplitude*(.8+secondary*.2)+vibration);
              if(step===0)c.moveTo(x,y);else c.lineTo(x,y);
            }
            c.globalAlpha=.18+strand*.25;c.lineWidth=1.15;c.shadowColor=layer?'#fa70bd':'#48cbef';c.shadowBlur=line%8===0?4:0;c.stroke();
          }
        }
        c.shadowBlur=0;
        c.globalAlpha=1;c.globalCompositeOperation='source-over';meterFrame=requestAnimationFrame(draw);
      };
      draw();
    }

  }

  function loadStore(key,fallback={}){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:fallback;}catch{return fallback;}}
  function setRadioVolume(level,persist=true){const value=Math.max(0,Math.min(100,Math.round(Number(level)||0)));$('radio-volume').value=String(value);$('radio-volume').style.setProperty('--volume-fill',`${value}%`);$('radio-volume-track').style.setProperty('--volume-angle',`${-135+value*2.7}deg`);audio.volume=value/100;$('volume-number').textContent=String(value);if(persist)saveStore(VOLUME_STORE,value);}
  function toggleRadioSkin(){if(!legacyThemeEnabled)return;radioSkin=radioSkin==='legacy'?'modern':'legacy';document.body.dataset.radioSkin=radioSkin;try{localStorage.setItem(RADIO_SKIN_STORE,radioSkin);}catch{}notify(radioSkin==='legacy'?'Version 1 radio look enabled':'Version 2 radio look enabled');}
  // Theme switching is deliberately presentation-only: it does not navigate,
  // reload, or touch either live media element, so the current stream continues.
  function applyTheme(value,force=false){if(!themeSwitchEnabled&&!force){const select=$('theme-choice');if(select)select.value=themeMode;return;}themeMode=['retro','modern','ultra'].includes(value)?value:'ultra';glowMode=THEME_GLOW[themeMode];document.body.dataset.theme=themeMode;document.body.dataset.glow=glowMode;const select=$('theme-choice');if(select)select.value=themeMode;try{localStorage.setItem(THEME_STORE,themeMode);}catch{}retryBlockedRadio();}
  function syncThemeSettings(){const legacy=$('legacy-theme-enabled'),theme=$('theme-switch-enabled'),picker=$('theme-choice');legacy.checked=legacyThemeEnabled;theme.checked=themeSwitchEnabled;picker.disabled=!themeSwitchEnabled;document.body.dataset.themeSwitch=themeSwitchEnabled?'on':'off';}
  function setLegacyThemeEnabled(enabled){legacyThemeEnabled=Boolean(enabled);try{localStorage.setItem(LEGACY_THEME_ENABLED_STORE,String(legacyThemeEnabled));}catch{}if(!legacyThemeEnabled){legacyRadioTapCount=0;clearTimeout(legacyRadioTapTimer);if(radioSkin==='legacy'){radioSkin='modern';document.body.dataset.radioSkin='modern';try{localStorage.setItem(RADIO_SKIN_STORE,'modern');}catch{}}}}
  function setThemeSwitchEnabled(enabled){themeSwitchEnabled=Boolean(enabled);try{localStorage.setItem(THEME_SWITCH_ENABLED_STORE,String(themeSwitchEnabled));}catch{}syncThemeSettings();}
  function saveStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{notify('This browser could not save your presets.');}}
  function stationKey(item){return String(item?.stationuuid||item?.url_resolved||item?.url||item?.name||'');}
  function notify(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400);}
  let closeSplash=()=>{};
  function initSplash(){
    const splash=$('welcome-splash-v2'),enter=$('tuning-enter');if(!splash||!enter)return;
    let returning=false;try{returning=localStorage.getItem('coolradtv.tuning-seen')==='true';}catch{}
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(returning)splash.classList.add('tuning-returning');
    let finished=false;const previousFocus=document.activeElement;
    const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);document.removeEventListener('keydown',keys);splash.classList.add('leaving');startOpenedPlayer();try{localStorage.setItem('coolradtv.tuning-seen','true');}catch{}setTimeout(()=>{splash.remove();if(previousFocus&&previousFocus!==document.body&&previousFocus.isConnected)previousFocus.focus({preventScroll:true});else $('radio-play')?.focus({preventScroll:true});},reduced?0:360);};
    const keys=event=>{if(event.key==='Escape'){event.preventDefault();finish();}if(event.key==='Tab'){event.preventDefault();enter.focus({preventScroll:true});}};
    const timer=setTimeout(finish,returning?2000:4000);
    closeSplash=immediate=>{if(immediate===true)finish();};
    enter.addEventListener('click',finish);document.addEventListener('keydown',keys);enter.focus({preventScroll:true});
  }

  function formatClock(){const d=new Date();$('clock').textContent=d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}).toUpperCase();const day=$('radio-clock-day');if(day){day.textContent=d.toLocaleDateString([], {weekday:'short'}).slice(0,2);const time=d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',hour12:true}).match(/^(.+?)\s*(AM|PM)$/i);$('radio-clock-time').textContent=time?time[1]:d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});$('radio-clock-meridiem').textContent=time?time[2].toUpperCase():'';$('radio-clock-date').textContent=d.toLocaleDateString([], {month:'short',day:'2-digit',year:'numeric'}).toUpperCase();}}
  initSplash();
  const hinduRssUrl='https://www.thehindu.com/news/national/feeder/default.rss';
  function setRadioNews(headlines){
    const track=$('radio-news-track');if(!track)return;
    const clean=(headlines||[]).map(item=>String(item||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,12);
    const items=clean.length?clean:['Latest national headlines will appear when the feed is reachable'];
    const group=items.map(headline=>`<span class="ticker-headline">${safe(headline)}</span>`).join('');
    track.innerHTML=`<div class="ticker-marquee"><div class="ticker-group">${group}</div><div class="ticker-group" aria-hidden="true">${group}</div></div>`;
    track.classList.toggle('ticker-static',!clean.length);
  }
  async function loadRadioNews(){
    const rss2json=`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(hinduRssUrl)}`;
    try{
      const response=await fetch(rss2json,{cache:'no-store'});if(!response.ok)throw new Error(`RSS service returned ${response.status}`);
      const data=await response.json();const headlines=(data.items||[]).map(item=>item.title);if(!headlines.length)throw new Error('No news items in feed');setRadioNews(headlines);
    }catch(error){console.warn('Could not refresh The Hindu ticker:',error);setRadioNews([]);}
  }
  function inferTVCountry(name=''){
    const n=String(name).toLowerCase();
    if(/bbc|star vijay uk|reuters/.test(n))return 'United Kingdom';
    if(/cnn|abc news|discovery|cartoon network|accuweather|hallmark|hbo|create/.test(n))return 'United States';
    if(/al jazeera/.test(n))return 'Qatar';if(/dw english/.test(n))return 'Germany';if(/arirang/.test(n))return 'South Korea';
    if(/kantipur/.test(n))return 'Nepal';if(/africanews/.test(n))return 'Republic of the Congo';if(/nhk/.test(n))return 'Japan';
    if(/france 24/.test(n))return 'France';if(/trt world/.test(n))return 'Turkey';
    return 'India';
  }
  function fillCountries(){
    const fill=(id,rows)=>{const countries=[...new Set(rows.map(s=>String(s.country||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));$(id).innerHTML='<option value="all">All countries</option>'+countries.map(name=>`<option value="${safe(name)}">${safe(name)}</option>`).join('');};
    fill('radio-country',radios);fill('tv-country',tvs);
  }
  function mergeInitialPresets(remote,storeKey,type){
    const saved=loadStore(storeKey,{}),hiddenKey=type==='tv'?TV_HIDDEN_STORE:RADIO_HIDDEN_STORE,hidden=new Set(loadStore(hiddenKey,[])),merged={...remote};
    for(const key of hidden)delete merged[key];
    for(const [key,item] of Object.entries(saved))if(item&&typeof item==='object'&&!hidden.has(key)){
      if(Object.prototype.hasOwnProperty.call(remote,key))merged[key]={...item,...remote[key]};
      else if(item._kind===type)merged[key]=item;
    }
    return merged;
  }
  function applyTVOrder(presets){
    const keys=Object.keys(presets),saved=loadStore(TV_ORDER_STORE,[]);if(!Array.isArray(saved)||!saved.length)return presets;
    const ordered={};for(const key of saved)if(Object.prototype.hasOwnProperty.call(presets,key))ordered[key]=presets[key];
    for(const key of keys)if(!Object.prototype.hasOwnProperty.call(ordered,key))ordered[key]=presets[key];return ordered;
  }
  async function fetchData(){
    const builtIn=window.COOLRADTV_DEFAULTS;
    if(builtIn){radios=Object.entries(builtIn.radio).map(([key,item])=>({...item,_key:key}));tvs=Object.entries(builtIn.tv).map(([key,item])=>({...item,url:item.url||key}));}

    for(const [next,previous] of [[RADIO_STORE,'retrotvra.radio-presets.v1'],[TV_STORE,'retrotvra.tv-presets.v1']]){
      if(loadStore(next,null)===null){const saved=loadStore(previous,null);if(saved)saveStore(next,saved);}
    }

    try{
      const [r,t]=await Promise.all([fetch('data/radio-presets.json',{cache:'no-cache'}),fetch('data/tv-presets.json',{cache:'no-cache'})]);
      if(r.ok){const raw=await r.json();radios=Object.entries(raw).map(([key,item])=>({...item,_key:key})).filter(item=>item.url||item.url_resolved);}
      if(t.ok){const raw=await t.json();tvs=Object.entries(raw).map(([key,item])=>({...item,url:item.url||key,country:item.country||inferTVCountry(item.name)})).filter(item=>item.url);}
    }catch{ /* Keep the safe sample presets below if opened without a local web server. */}
    if(!radios.length)radios=[
      {stationuuid:'sample-mirchi',name:'Radio Mirchi Hindi',country:'India',url:'https://stream.zeno.fm/0r0xa792kwzuv',favicon:'',tags:'music hindi'},
      {stationuuid:'sample-bbc',name:'BBC World Service',country:'United Kingdom',url:'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',tags:'news talk'},
      {stationuuid:'sample-kantipur',name:'Kantipur FM',country:'Nepal',url:'https://radio-broadcast.ekantipur.com/stream',tags:'news nepali'},
      {stationuuid:'sample-oli',name:'Oli 96.8 FM',country:'Singapore',url:'https://playerservices.streamtheworld.com/api/livestream-redirect/OLI968FMAAC.aac',tags:'music tamil'}
    ];
    if(!tvs.length)tvs=[
      DEFAULT_TV_CHANNEL,
      {name:'France 24 English',group:'World News',country:'France',url:'https://live.france24.com/hls/live/2037220/F24_EN_HI_HLS/master.m3u8',logo:''},
      {name:'DW English',group:'World News',country:'Germany',url:'https://dwamdstream104.akamaized.net/hls/live/2015530/dwstream104/stream04/streamPlaylist.m3u8',logo:''}
    ];
    radioPresets=mergeInitialPresets(Object.fromEntries(radios.map(s=>[stationKey(s),s])),RADIO_STORE,'radio');
    tvPresets=applyTVOrder(mergeInitialPresets(Object.fromEntries(tvs.map(station=>[station.url,station])),TV_STORE,'tv'));
    if(!loadStore('retrotvra.tv-news20.2026-11-12',null)){saveStore('retrotvra.tv-news20.previous',tvPresets);tvPresets=Object.fromEntries(tvs.map(s=>[s.url,s]));saveStore('retrotvra.tv-news20.2026-11-12',{done:true});}
    const ownStation=radios.find(station=>(station.url_resolved||station.url)==='https://stream.zeno.fm/rc7dnetgrwzuv');
    if(ownStation&&!loadStore('retrotvra.own-station-first.rc7dnetgrwzuv',null)){
      saveStore('retrotvra.own-station-first.rc7dnetgrwzuv.previous',radioPresets);
      const entries=Object.entries(radioPresets).filter(([key])=>key!==stationKey(ownStation)).slice(0,PRESET_LIMIT-1);
      entries.unshift([stationKey(ownStation),ownStation]);radioPresets=Object.fromEntries(entries);
      saveStore('retrotvra.own-station-first.rc7dnetgrwzuv',{applied:true});
    }
    const curatedVersion='retrotvra.curated-defaults.2026-11-09.v1';
    if(!loadStore(curatedVersion,null)){
      saveStore(curatedVersion+'.previous',{radio:radioPresets,tv:tvPresets});
      radioPresets=Object.fromEntries(radios.slice(0,PRESET_LIMIT).map(station=>[stationKey(station),station]));
      tvPresets=Object.fromEntries(tvs.slice(0,PRESET_LIMIT).map(station=>[station.url,station]));
      saveStore(TV_ORDER_STORE,Object.keys(tvPresets));
      // Object marker is compatible with loadStore; later reorders remain preserved.
      saveStore(curatedVersion,{applied:true});
    }
    radioPresets=Object.fromEntries(Object.entries(radioPresets).slice(0,PRESET_LIMIT));
    tvPresets=Object.fromEntries(Object.entries(tvPresets).slice(0,PRESET_LIMIT));
    if(!loadStore('retrotvra.catalogue50.2026-11-12',null)){saveStore('retrotvra.catalogue50.previous',{radio:radioPresets,tv:tvPresets});radioPresets=Object.fromEntries(radios.slice(0,50).map(s=>[stationKey(s),s]));tvPresets=Object.fromEntries(tvs.slice(0,50).map(s=>[s.url,s]));saveStore(TV_ORDER_STORE,Object.keys(tvPresets));saveStore('retrotvra.catalogue50.2026-11-12',{done:true});}
    if(!loadStore('retrotvra.cooltv-first.2026-11-12.chennai-central',null)){const first=tvs.find(s=>s.name==='COOLtv');if(first){tvPresets=Object.fromEntries([[first.url,first],...Object.entries(tvPresets).filter(([key])=>key!==first.url)].slice(0,50));saveStore(TV_ORDER_STORE,Object.keys(tvPresets));saveStore('retrotvra.cooltv-first.2026-11-12.chennai-central',{done:true});}}
    const storedRecent=loadStore(RECENT_STORE,[]);recentHistory=Array.isArray(storedRecent)?storedRecent.filter(item=>item&&item.url&&item.name).slice(0,40):[];
    saveStore(RADIO_STORE,radioPresets);saveStore(TV_STORE,tvPresets);
    fillCountries();populateExploreFilters();renderPresets();renderTVRail();renderRemotePresets();renderRadioDisplay();renderExplore();
  }
  function listFor(kind){return kind==='tv'?Object.values(tvPresets):Object.values(radioPresets);}
  function selectedCountry(kind){return $(kind==='tv'?'tv-country':'radio-country')?.value||'all';}
  function currentRows(kind){const rows=listFor(kind);const country=selectedCountry(kind);return rows.filter(item=>country==='all'||String(item.country||'').toLowerCase()===country.toLowerCase());}
  let radioAutoplayBlocked=false;
  function retryBlockedRadio(){
    if(!radioAutoplayBlocked||document.querySelector('.screen.active')?.id!=='radio-screen')return;
    radioAutoplayBlocked=false;
    audio.play().then(()=>{$('radio-status').textContent='Playing · '+(radioCurrent()?.name||'Radio');}).catch(error=>{radioAutoplayBlocked=error?.name==='NotAllowedError';});
  }
  document.addEventListener('pointerup',event=>{if(event.isTrusted&&!event.target.closest('button,a,input,select,textarea'))retryBlockedRadio();});
  document.addEventListener('coolradio-onboarding-ready',()=>startOpenedPlayer());
  function startOpenedPlayer(){
    if(window.coolRadioOnboardingBlocked)return;
    if($('welcome-splash-v2')&&!$('welcome-splash-v2').classList.contains('leaving'))return;
    const screen=document.querySelector('.screen.active')?.id;
    if(screen==='radio-screen'){
      if(radioHls&&!audio.src&&!audio.currentSrc)return;
      if(audio.src||audio.currentSrc||radioHls){if(audio.paused)audio.play().catch(()=>notify('Tap Play to start radio.'));return;}
      const station=currentRows('radio')[0];if(station)playRadio(station);
    }else if(screen==='tv-screen'){
      if(hls&&!video.src&&!video.currentSrc)return;
      if(video.src||video.currentSrc||hls){if(video.paused)video.play().catch(()=>notify('Tap Play to start TV.'));return;}
      const station=currentRows('tv')[0]||tvs.find(row=>row.url===DEFAULT_TV_CHANNEL.url);if(station)playTV(station);
    }
  }
  function setScreen(screenId){
    if(screenId==='tv-screen'&&(audio.src||radioHls))stopRadio();
    if(screenId==='radio-screen'&&(video.src||video.currentSrc))stopTV();
    document.querySelectorAll('.screen').forEach(node=>node.classList.toggle('active',node.id===screenId));
    document.querySelectorAll('.nav-item').forEach(node=>node.classList.toggle('active',node.dataset.screen===screenId));
    document.querySelectorAll('[data-mode-screen]').forEach(node=>{const active=node.dataset.modeScreen===screenId;node.classList.toggle('selected',active);node.setAttribute('aria-selected',String(active));});
    $('mode-label').textContent=screenId==='radio-screen'?'◉ RADIO MODE':screenId==='tv-screen'?'▣ TV MODE':screenId==='presets-screen'?'★ YOUR PRESETS':'⌕ EXPLORE';
    if(screenId==='presets-screen')renderPresets();
    if(screenId==='radio-screen'||screenId==='tv-screen')queueMicrotask(startOpenedPlayer);
  }
  function stepScreen(direction){const order=['radio-screen','tv-screen','presets-screen','explore-screen'],active=document.querySelector('.screen.active')?.id,index=Math.max(0,order.indexOf(active));setScreen(order[(index+direction+order.length)%order.length]);}
  function radioCurrent(){return radios[radioIndex]||null;}
  function tvCurrent(){return tvs[tvIndex]||null;}
  function drawRadio(){
    const station=radioCurrent(),art=$('radio-art');const star=$('radio-star'),isSaved=Boolean(station&&radioPresets[stationKey(station)]);star.textContent=isSaved?'★':'☆';star.classList.toggle('saved',isSaved);star.disabled=!station;star.setAttribute('aria-label',isSaved?'Remove station from presets':'Add station to presets');art.classList.toggle('playing',!audio.paused);
    if(!station){art.innerHTML='<div class="radio-dot-texture" aria-hidden="true"></div><div class="record-mark"><span class="radio-signal-icon" aria-hidden="true">◉</span><b class="radio-center-title">Choose a station</b><small class="radio-center-country">WORLD RADIO</small><div class="record-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>';art.classList.toggle('glow-off',glowMode==='off');$('radio-status').textContent='READY · SELECT A PRESET OR EXPLORE';formatClock();return;}
    const key=stationKey(station),saved=Boolean(radioPresets[key]),logo=stationLogo(station),stationName=station.name||'Internet Radio',name=safe(stationName),country=safe(station.country||'WORLD RADIO'),details=safe([station.country||'Internet radio',station.codec||'LIVE',station.bitrate?`${station.bitrate} KBPS`:null].filter(Boolean).join(' · '));
    const starHTML='';
    art.style.backgroundImage='radial-gradient(circle at 50% 48%,#343438,#15171a 68%,#0d0f12)';art.innerHTML='<div class="radio-dot-texture" aria-hidden="true"></div><canvas class="sound-rays" id="sound-rays" aria-hidden="true"></canvas><div class="radio-glow-bloom" aria-hidden="true"></div><div class="radio-glow-ring" aria-hidden="true"></div><div class="speaker-aura" aria-hidden="true"></div><div class="speaker-cone" aria-hidden="true"></div><div class="record-mark"><span class="radio-signal-icon" aria-hidden="true">◉</span><b class="radio-center-title">'+name+'</b><small class="radio-center-country">'+country+'</small><div class="record-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="radio-art-caption">'+starHTML+'<div><h1 id="radio-title">'+name+'</h1><p id="radio-subtitle">'+details+'</p></div></div>';art.classList.toggle('glow-off',glowMode==='off');
    $('radio-status').textContent=audio.paused?'READY · PRESS PLAY TO LISTEN':'TUNED IN · LIVE RADIO';formatClock();
  }
  function updateRadioShortcutFocus(target){
    const cards=[...target.querySelectorAll('.radio-mini-card')];if(!cards.length)return;
    const bounds=target.getBoundingClientRect(),center=bounds.left+bounds.width/2,reach=Math.max(1,bounds.width*.65);
    for(const card of cards){const rect=card.getBoundingClientRect(),distance=Math.abs(rect.left+rect.width/2-center),focus=Math.max(0,1-distance/reach);card.style.setProperty('--rail-scale',(0.52+focus*.68+(card.classList.contains('active')?.10:0)).toFixed(3));card.style.setProperty('--rail-opacity',(0.45+focus*.55).toFixed(3));card.style.zIndex=String(Math.round(focus*10));}
  }
  function renderRadioShortcuts(){const target=$('radio-station-strip');if(!target)return;const rows=currentRows('radio').slice(0,PRESET_LIMIT);const current=radioCurrent();if(current&&!rows.some(row=>stationKey(row)===stationKey(current))){rows.unshift(current);rows.splice(PRESET_LIMIT);}target.innerHTML=rows.map((station,index)=>{const logo=stationLogo(station),name=station.name||'Radio';return `<button type="button" class="radio-mini-card ${radioCurrent()&&stationKey(radioCurrent())===stationKey(station)?'active':''}" data-radio-shortcut="${index}" title="${safe(name)}" aria-label="Play ${safe(name)}"><span class="radio-mini-logo">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:`<span class="logo-fallback">${safe(initialsFor(name))}</span>`}</span><b>${safe(name)}</b></button>`;}).join('')||'<span class="empty-note">Save stations in Explore to add quick tune cards.</span>';target.querySelectorAll('[data-radio-shortcut]').forEach(button=>button.addEventListener('click',()=>{if(target.dataset.dragged==='true'){delete target.dataset.dragged;return;}const station=rows[Number(button.dataset.radioShortcut)];if(station)playRadio(station);}));
    if(!target.dataset.autoTuneReady){
      let settleTimer=0;
      target.addEventListener('scroll',()=>{
        clearTimeout(settleTimer);
        settleTimer=setTimeout(()=>{
          if(target.classList.contains('dragging')||!$('radio-screen').classList.contains('active'))return;
          const center=target.scrollLeft+target.clientWidth/2;
          const cards=[...target.querySelectorAll('[data-radio-shortcut]')];
          const nearest=cards.sort((a,b)=>Math.abs(a.offsetLeft+a.offsetWidth/2-center)-Math.abs(b.offsetLeft+b.offsetWidth/2-center))[0];
          if(nearest&&!nearest.classList.contains('active'))nearest.click();
        },320);
      },{passive:true});
      target.dataset.autoTuneReady='true';
    }
    if(!target.dataset.focusEffectReady){target.addEventListener('scroll',()=>requestAnimationFrame(()=>updateRadioShortcutFocus(target)),{passive:true});window.addEventListener('resize',()=>updateRadioShortcutFocus(target));target.dataset.focusEffectReady='true';}
    requestAnimationFrame(()=>{const active=target.querySelector('.radio-mini-card.active');if(active){const rail=target.getBoundingClientRect(),card=active.getBoundingClientRect();target.scrollTo({left:Math.max(0,active.offsetLeft-(target.clientWidth-active.offsetWidth)/2),behavior:'smooth'});}updateRadioShortcutFocus(target);});
    if(!target.dataset.desktopScrollReady){let drag=null;target.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&target.scrollWidth>target.clientWidth){target.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});target.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;drag={x:event.clientX,left:target.scrollLeft,moved:false,pointerId:event.pointerId,captured:false};});target.addEventListener('pointermove',event=>{if(!drag)return;const delta=event.clientX-drag.x;if(Math.abs(delta)>5&&!drag.moved){drag.moved=true;try{target.setPointerCapture(drag.pointerId);drag.captured=true;}catch{}}if(drag.moved){target.classList.add('dragging');target.scrollLeft=drag.left-delta;event.preventDefault();}});const finish=event=>{if(!drag)return;if(drag.moved){target.dataset.dragged='true';setTimeout(()=>delete target.dataset.dragged,180);}if(drag.captured&&target.hasPointerCapture(drag.pointerId)){try{target.releasePointerCapture(drag.pointerId);}catch{}}drag=null;target.classList.remove('dragging');};target.addEventListener('pointerup',finish);target.addEventListener('pointercancel',finish);window.addEventListener('pointerup',finish);target.dataset.desktopScrollReady='true';}
  }
  function renderRadioDisplay(){if(!radioPresets||!Object.keys(radioPresets).length)return;const current=radioCurrent();if(current&&!radioPresets[stationKey(current)])radioIndex=-1;const rows=currentRows('radio');if(!current&&rows.length){const selected=rows[0];radioIndex=radios.findIndex(s=>stationKey(s)===stationKey(selected));}drawRadio();renderRadioShortcuts();}
  function rememberPlayed(kind,station){if(!station)return;const key=kind==='tv'?station.url:stationKey(station),row={kind,key,url:station.url||station.url_resolved||'',name:station.name||'Untitled',country:station.country||'',logo:stationLogo(station),playedAt:Date.now()};recentHistory=[row,...recentHistory.filter(item=>!(item.kind===kind&&item.key===key))].slice(0,40);saveStore(RECENT_STORE,recentHistory);if(presetMode==='recent')renderPresets();}
  async function playRadio(station){
    const src=station?.url_resolved||station?.url;
    if(!src){notify('This station has no playable stream URL.');return;}
    radioAutoplayBlocked=false;currentRadioSource=src;
    const key=stationKey(station);radioIndex=radios.findIndex(s=>stationKey(s)===key);if(radioIndex<0){radios.unshift(station);radioIndex=0;}
    if(hls||video.src||video.currentSrc)stopTV();
    stopSoundRays();if(radioHls){radioHls.destroy();radioHls=null;}audio.pause();audio.removeAttribute('src');audio.load();
    // Match v1's direct-stream order. HLS sources must be attached through
    // Hls.js instead of being assigned to audio.src as a playlist URL.
    setRadioVolume(Math.min(40,Number($('radio-volume').value||30)));
    $('equalizer').classList.remove('playing');drawRadio();$('radio-status').textContent='CONNECTING · '+(station.name||'RADIO');rememberPlayed('radio',station);renderRadioShortcuts();
    const onRadioStarted=()=>{$('radio-art').classList.add('playing');$('equalizer').classList.add('playing');startSoundRays();$('radio-play').textContent='Ⅱ';$('radio-play').title='Pause';$('radio-status').textContent=`Playing · ${station.name||'Internet radio'}`;};
    const onRadioFailed=error=>{if(error?.name==='NotAllowedError'){radioAutoplayBlocked=true;$('radio-status').textContent='TAP PLAY TO START RADIO';return;}console.error('Radio playback failed:',currentRadioSource,error||'play() rejected');if(location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource)){$('radio-status').textContent='HTTPS REQUIRED · THIS STREAM USES HTTP';notify('This station uses an HTTP link, which secure pages block. Use an HTTPS stream.');}else{$('radio-status').textContent='STREAM COULD NOT START';notify('This station stream could not start. Try another station.');}};
    const isHls=/\.m3u8(?:$|[?#])/i.test(src);
    if(isHls&&window.Hls&&Hls.isSupported()){
      const player=new Hls({enableWorker:true,lowLatencyMode:false,maxBufferLength:18});radioHls=player;
      player.on(Hls.Events.MANIFEST_PARSED,()=>{if(radioHls!==player)return;audio.play().then(onRadioStarted).catch(onRadioFailed);});
      player.on(Hls.Events.ERROR,(_event,data)=>{if(data.fatal&&radioHls===player){const insecure=location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource);$('radio-status').textContent=insecure?'HTTPS REQUIRED · THIS STREAM USES HTTP':'RADIO STREAM UNAVAILABLE';console.error('Radio HLS error:',data.type,data.details,currentRadioSource);notify(insecure?'This station uses an HTTP link, which secure pages block. Use an HTTPS stream.':'This radio stream is unavailable right now. Try another station.');player.destroy();radioHls=null;audio.pause();audio.removeAttribute('src');audio.load();$('radio-art').classList.remove('playing');$('equalizer').classList.remove('playing');stopSoundRays();$('radio-play').textContent='▶';}});
      player.on(Hls.Events.MEDIA_ATTACHED,()=>{if(radioHls===player)player.loadSource(src);});
      player.attachMedia(audio);
    }else if(isHls&&audio.canPlayType('application/vnd.apple.mpegurl')){
      audio.src=src;
      try{await audio.play();onRadioStarted();}catch(error){onRadioFailed(error);}
    }else if(isHls){
      const insecure=location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource);
      $('radio-status').textContent=insecure?'HTTPS REQUIRED · THIS STREAM USES HTTP':'HLS PLAYER UNAVAILABLE';
      notify(insecure?'This station uses an HTTP link, which secure pages block. Use an HTTPS stream.':'The HLS playback component did not load. Refresh the app and try again.');
    }else{
      audio.src=src;
      try{await audio.play();onRadioStarted();}catch(error){onRadioFailed(error);}
    }
    renderPresets();
  }
  function toggleRadio(){if(!audio.src){const rows=currentRows('radio'),selected=radioCurrent(),station=rows.find(item=>selected&&stationKey(item)===stationKey(selected))||rows[0];if(station)playRadio(station);else notify('Choose a radio preset first.');return;}if(audio.paused){audio.play().then(()=>{$('equalizer').classList.add('playing');$('radio-art').classList.add('playing');$('radio-play').textContent='Ⅱ';}).catch(error=>{console.error('Radio resume failed:',currentRadioSource,error);if(location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource)){ $('radio-status').textContent='HTTPS REQUIRED · THIS STREAM USES HTTP';notify('This station uses an HTTP link, which secure pages block. Use an HTTPS stream.');}else notify('This stream could not be resumed. Try another station.');});}else audio.pause();}
  function stopRadio(){stopSoundRays();if(radioHls){radioHls.destroy();radioHls=null;}audio.pause();audio.removeAttribute('src');audio.load();currentRadioSource='';$('radio-art').classList.remove('playing');$('radio-play').textContent='▶';$('radio-play').title='Play';$('equalizer').classList.remove('playing');$('radio-status').textContent='STOPPED';}
  function stepRadio(direction){const rows=currentRows('radio');if(!rows.length)return;const current=radioCurrent();let index=rows.findIndex(s=>stationKey(s)===stationKey(current||{}));index=(index+direction+rows.length)%rows.length;playRadio(rows[index]);}
  function togglePreset(kind,station){
    const presets=kind==='radio'?radioPresets:tvPresets,key=kind==='radio'?stationKey(station):station.url;
    if(!presets[key]&&Object.keys(presets).length>=PRESET_LIMIT){notify(`Maximum ${PRESET_LIMIT} ${kind==='radio'?'radio':'TV'} presets. Remove one before adding another.`);return;}

    if(kind==='radio'){const key=stationKey(station),hidden=new Set(loadStore(RADIO_HIDDEN_STORE,[])),isShared=radios.some(item=>stationKey(item)===key);if(radioPresets[key]){delete radioPresets[key];if(isShared)hidden.add(key);}else{radioPresets[key]=station;hidden.delete(key);}saveStore(RADIO_HIDDEN_STORE,[...hidden]);saveStore(RADIO_STORE,radioPresets);drawRadio();if(!audio.paused){stopSoundRays();startSoundRays();}renderPresets();renderExplore();}
    else{const key=station.url,hidden=new Set(loadStore(TV_HIDDEN_STORE,[])),isShared=tvs.some(item=>item.url===key);if(tvPresets[key]){delete tvPresets[key];if(isShared)hidden.add(key);}else{tvPresets[key]=station;hidden.delete(key);}saveStore(TV_HIDDEN_STORE,[...hidden]);saveStore(TV_STORE,tvPresets);saveStore(TV_ORDER_STORE,Object.keys(tvPresets));drawTV();renderPresets();renderTVRail();renderRemotePresets();renderExplore();}
  }
  function renderRemotePresets(){
    const target=$('remote-presets');if(!target)return;const allRows=currentRows('tv'),rows=allRows.slice(0,PRESET_LIMIT),picker=$('remote-channel-select');
    picker.innerHTML='<option value="">Choose a channel</option>'+allRows.map(station=>`<option value="${safe(station.url)}">${safe(station.name||'TV channel')}</option>`).join('');picker.value=tvCurrent()?.url||'';
    target.innerHTML=rows.map((station,index)=>`<button class="remote-key remote-preset-key ${tvCurrent()?.url===station.url?'active':''}" type="button" data-remote-preset="${index}" aria-pressed="${tvCurrent()?.url===station.url}" aria-label="Play ${safe(station.name||'TV channel')}" title="${safe(station.name||'TV channel')}">${String(index+1).padStart(2,'0')}</button>`).join('')||'<span class="empty-note">Save TV channels as presets to use quick select.</span>';
    target.querySelectorAll('[data-remote-preset]').forEach(button=>button.addEventListener('click',()=>{const station=rows[Number(button.dataset.remotePreset)];if(station)playTV(station);}));
  }
  function renderTVRail(){
    const target=$('tv-rail');if(!target)return;const rows=currentRows('tv');const playing=tvCurrent();if(playing&&!rows.some(row=>row.url===playing.url))rows.unshift(playing);
    const picture=$('tv-display').querySelector('.tv-picture');if(picture&&target.contains(picture))$('tv-display').prepend(picture);
    target.innerHTML=rows.map((station,index)=>{const logo=stationLogo(station),name=station.name||'TV channel';return `<div tabindex="0" class="tv-rail-card ${tvCurrent()?.url===station.url?'active':''}" data-tv-url="${safe(station.url)}" aria-label="Play ${safe(name)}"><span class="tv-rail-logo">${logo?`<img src="${safe(logo)}" alt="">`:`<span class="logo-fallback">${safe(initialsFor(name))}</span>`}</span><span class="tv-rail-copy"><b>${safe(name)}</b><small>${safe(station.country||station.group||'TV')}</small></span></div>`;}).join('')||'<span class="empty-note">No TV presets yet — save channels from Explore.</span>';
    target.querySelectorAll('[data-tv-url]').forEach(card=>card.addEventListener('click',event=>{if(event.target.closest('.tv-picture'))return;const station=rows.find(s=>s.url===card.dataset.tvUrl);if(station&&station.url!==tvCurrent()?.url)playTV(station);}));
    if(!target.dataset.carouselReady){
      let settle=0;
      target.addEventListener('scroll',()=>{
        const center=target.scrollLeft+target.clientWidth/2;
        target.querySelectorAll('.tv-rail-card').forEach(card=>{const distance=Math.abs(card.offsetLeft+card.offsetWidth/2-center);card.style.setProperty('--tv-card-scale',String(Math.max(.65,1.15-distance/450)));});
        clearTimeout(settle);settle=setTimeout(()=>{
          if(target.matches('.dragging')||!$('tv-screen').classList.contains('active'))return;
          const center=target.scrollLeft+target.clientWidth/2;
          const card=[...target.querySelectorAll('.tv-rail-card')].sort((a,b)=>Math.abs(a.offsetLeft+a.offsetWidth/2-center)-Math.abs(b.offsetLeft+b.offsetWidth/2-center))[0];
          const station=currentRows('tv').find(row=>row.url===card?.dataset.tvUrl);
          if(station&&tvCurrent()?.url!==station.url){stopTVVolumeRamp();tvVolumeRampStarted=true;tvVolumeRampExpected=.05;video.volume=.05;updateTVNumbers();playTV(station);}
        },280);
      },{passive:true});target.dataset.carouselReady='true';
    }
    renderRemotePresets();const active=target.querySelector('.tv-rail-card.active');if(active&&picture&&!tvFullscreenActive){active.append(picture);active.classList.add('tv-video-card');}if(active)target.scrollTo({left:Math.max(0,active.offsetLeft-(target.clientWidth-active.offsetWidth)/2),behavior:'smooth'});
    if(!target.dataset.dragReady){target.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)&&target.scrollWidth>target.clientWidth){target.scrollLeft+=event.deltaY;event.preventDefault();}},{passive:false});target.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;dragState={x:event.clientX,left:target.scrollLeft,moved:false};target.setPointerCapture(event.pointerId);target.classList.add('dragging');});target.addEventListener('pointermove',event=>{if(!dragState)return;const d=event.clientX-dragState.x;if(Math.abs(d)>4)dragState.moved=true;if(dragState.moved){target.scrollLeft=dragState.left-d;event.preventDefault();}});const end=event=>{if(!dragState)return;if(dragState.moved){target.dataset.dragged='true';setTimeout(()=>delete target.dataset.dragged,120);}if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);dragState=null;target.classList.remove('dragging');};target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('click',event=>{if(target.dataset.dragged==='true'){event.preventDefault();event.stopPropagation();delete target.dataset.dragged;}},true);target.dataset.dragReady='true';}
  }
  let tvVolumeRampTimer=0,tvVolumeRampStarted=false,tvVolumeRampExpected=.05;
  function stopTVVolumeRamp(){clearInterval(tvVolumeRampTimer);tvVolumeRampTimer=0;}
  function startTVVolumeRamp(){
    if(tvVolumeRampStarted)return;
    tvVolumeRampStarted=true;
    if(video.muted||Math.abs(video.volume-.05)>.001)return;
    tvVolumeRampTimer=setInterval(()=>{
      if(video.muted||Math.abs(video.volume-tvVolumeRampExpected)>.001){stopTVVolumeRamp();return;}
      if(video.paused)return;
      tvVolumeRampExpected=Math.min(.10,Math.round((tvVolumeRampExpected+.0005)*10000)/10000);
      video.volume=tvVolumeRampExpected;updateTVNumbers();
      if(tvVolumeRampExpected>=.10)stopTVVolumeRamp();
    },50);
  }
  function updateTVNumbers(){
    const volume=$('tv-volume-number'),channel=$('tv-channel-number');
    if(volume)volume.textContent=String(video.muted?0:Math.round(video.volume*100));
    const station=tvCurrent(),index=currentRows('tv').findIndex(row=>row.url===station?.url);
    if(channel)channel.textContent=index<0?'—':String(index+1);
  }
  function cleanTVTitle(value){let title=String(value||'');while(/\([^()]*\)/.test(title))title=title.replace(/\([^()]*\)/g,'');return title.replace(/\s+/g,' ').trim()||'TV';}
  function updateTVTitleStrip(){
    const rows=currentRows('tv'),station=tvCurrent(),index=rows.findIndex(row=>row.url===station?.url),hasNeighbors=rows.length>1;
    const previous=index>=0&&hasNeighbors?rows[(index-1+rows.length)%rows.length]:null,next=index>=0&&hasNeighbors?rows[(index+1)%rows.length]:null;
    $('tv-prev-name-text').textContent=previous?cleanTVTitle(previous.name):'—';$('tv-next-name-text').textContent=next?cleanTVTitle(next.name):'—';
    $('tv-prev-name').disabled=!previous;$('tv-next-name').disabled=!next;
    $('tv-prev-name').title=previous?'Previous: '+previous.name:'No previous channel';$('tv-next-name').title=next?'Next: '+next.name:'No next channel';
  }
  function drawTV(){
    updateTVNumbers();const station=tvCurrent();
    if(!station){$('tv-title').textContent='Choose a channel';$('tv-subtitle').textContent='Live channels from your presets';$('fullscreen-channel-name').textContent='Choose a channel';$('fullscreen-channel-country').textContent='TV';$('tv-star').textContent='☆';$('tv-star').classList.remove('saved');$('remote-favorite').classList.remove('saved');$('tv-placeholder').hidden=false;updateTVTitleStrip();return;}
    $('tv-title').textContent=cleanTVTitle(station.name);$('tv-subtitle').textContent=[station.country,station.group].filter(Boolean).join(' · ')||'Live television';$('fullscreen-channel-name').textContent=cleanTVTitle(station.name);$('fullscreen-channel-country').textContent=[station.country,station.group].filter(Boolean).join(' · ')||'TV';
    const saved=Boolean(tvPresets[station.url]);$('tv-star').textContent=saved?'★':'☆';$('tv-star').classList.toggle('saved',saved);$('remote-favorite').classList.toggle('saved',saved);$('tv-placeholder').hidden=Boolean(video.currentSrc||video.src);updateTVTitleStrip();renderTVRail();
  }
  function stopTV(){clearYouTube();if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();$('tv-toggle').textContent='▶';drawTV();}
  let tvPlaylistIndex=0;
  async function playTV(station){
    clearYouTube();tvPlaylistIndex=0;
    if(!station)return;if(tvCurrent()?.url!==station.url&&tvCurrent()){stopTVVolumeRamp();tvVolumeRampStarted=true;tvVolumeRampExpected=.05;video.volume=.05;}const rows=currentRows('tv');tvIndex=tvs.findIndex(s=>s.url===station.url);if(tvIndex<0){tvs.unshift(station);tvIndex=0;}if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute('src');video.load();
    if(audio.src||radioHls)stopRadio();
    const url=station.url||'';drawTV();$('tv-placeholder').hidden=true;rememberPlayed('tv',station);
    if(/\.m3u8($|\?)/i.test(url)&&window.Hls&&Hls.isSupported()){hls=new Hls({enableWorker:true,maxBufferLength:15});hls.loadSource(url);hls.attachMedia(video);hls.on(Hls.Events.MANIFEST_PARSED,()=>video.play().then(()=>{$('tv-toggle').textContent='Ⅱ';}).catch(()=>notify('Press play on the video to start.')));hls.on(Hls.Events.ERROR,(_e,data)=>{if(data.fatal)notify('This channel is not available right now.');});}
    else{video.src=url;try{await video.play();$('tv-toggle').textContent='Ⅱ';}catch{notify('Press play on the video to start this channel.');}}
    drawTV();renderPresets();
  }
  let youtubePlayer=null,youtubeHost=null,youtubeGeneration=0,youtubeApiPromise=null;
  function clearYouTube(){document.getElementById('cooltv-youtube-actions')?.remove();youtubeGeneration++;if(youtubePlayer){try{youtubePlayer.destroy();}catch{}youtubePlayer=null;}youtubeHost?.remove();youtubeHost=null;video.style.visibility='';}
  function loadYouTubeAPI(){if(window.YT?.Player)return Promise.resolve();if(!youtubeApiPromise)youtubeApiPromise=new Promise((resolve,reject)=>{const previous=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{youtubeApiPromise=null;reject(new Error('YouTube unavailable'));};document.head.append(script);});return youtubeApiPromise;}
  async function playPlaylistItem(url){
    clearYouTube();const match=String(url).match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if(!match){video.src=url;video.play().catch(()=>notify('Tap Play to continue COOLtv.'));return;}
    video.pause();video.style.visibility='hidden';const generation=youtubeGeneration;
    youtubeHost=document.createElement('div');youtubeHost.style.cssText='position:absolute;inset:0;z-index:3;background:#000';const mount=document.createElement('iframe');mount.id='cooltv-youtube-player';mount.title='COOLtv YouTube video';mount.referrerPolicy='strict-origin-when-cross-origin';mount.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';mount.allowFullscreen=true;mount.style.cssText='width:100%;height:100%;border:0;min-height:200px';const params=new URLSearchParams({enablejsapi:'1',playsinline:'1',origin:location.origin,widget_referrer:location.href});mount.src='https://www.youtube.com/embed/'+match[1]+'?'+params;youtubeHost.append(mount);video.parentElement.append(youtubeHost);
    try{await loadYouTubeAPI();if(generation!==youtubeGeneration)return;youtubePlayer=new YT.Player('cooltv-youtube-player',{events:{onReady:e=>{e.target.setVolume(Math.round(video.volume*100));e.target.playVideo();notify('If playback pauses, press Play in the YouTube player.');},onStateChange:e=>{if(e.data===0)advanceTVPlaylist();},onError:event=>{if(generation!==youtubeGeneration)return;console.warn('COOLtv YouTube error',event.data);notify('YouTube error '+event.data+'. Use Retry, Skip, or Open on YouTube below the picture.');document.getElementById('cooltv-youtube-actions')?.remove();const actions=document.createElement('div');actions.id='cooltv-youtube-actions';actions.style.cssText='padding:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#172638;color:#fff';const message=document.createElement('span');message.textContent='YouTube error '+event.data;const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';retry.onclick=()=>playPlaylistItem(url);const skip=document.createElement('button');skip.type='button';skip.textContent='Skip video';skip.onclick=advanceTVPlaylist;const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open on YouTube';link.style.color='#ffe0a3';actions.append(message,retry,skip,link);video.parentElement.insertAdjacentElement('afterend',actions);}}});}catch{if(generation===youtubeGeneration){notify('YouTube could not load. Check the connection or choose another channel.');}}
  }
  function advanceTVPlaylist(){const station=tvCurrent(),playlist=station?.playlist;if(!Array.isArray(playlist)||playlist.length<2)return;const next=tvPlaylistIndex+1;if(next>=playlist.length&&!station.playlistLoop)return;tvPlaylistIndex=next%playlist.length;playPlaylistItem(playlist[tvPlaylistIndex]);}
  video.addEventListener('ended',advanceTVPlaylist);
  video.addEventListener('volumechange',()=>{if(youtubePlayer?.setVolume){youtubePlayer.setVolume(Math.round(video.volume*100));if(video.muted)youtubePlayer.mute();else youtubePlayer.unMute();}});
  function stepTV(direction){const rows=currentRows('tv');if(!rows.length)return;let i=rows.findIndex(s=>s.url===tvCurrent()?.url);if(i<0)i=direction>0?-1:0;i=(i+direction+rows.length)%rows.length;playTV(rows[i]);}
  let tvFullscreenActive=false,tvNativeFullscreen=false;
  const tvFullscreenButton=document.querySelector('[data-remote="fullscreen"]');
  let tvZoomed=false;
  function fitTVFullscreenVideo(){
    if(!tvFullscreenActive)return;
    const stage=$('tv-display'),w=stage.clientWidth,h=stage.clientHeight;
    const ratio=video.videoWidth&&video.videoHeight?video.videoWidth/video.videoHeight:16/9;
    const width=(tvZoomed?Math.max:Math.min)(w,h*ratio),height=width/ratio;
    video.classList.toggle('tv-zoomed',tvZoomed);
    document.querySelectorAll('[data-fullscreen-action=zoom],[data-fullscreen-action=normal]').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.fullscreenAction==='zoom')===tvZoomed)));
    video.style.setProperty('width',`${width}px`,'important');
    video.style.setProperty('height',`${height}px`,'important');
  }
  function syncTVFullscreenLayout(){
    const stage=$('tv-display');
    const width=window.visualViewport?.width||window.innerWidth;
    const height=window.visualViewport?.height||window.innerHeight;
    const mobile=window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
    // Rotate the complete player and its controls if the browser refuses orientation lock.
    stage.classList.toggle('landscape-fallback',tvFullscreenActive&&mobile&&height>width);
    stage.style.setProperty('--tv-viewport-width',`${width}px`);
    stage.style.setProperty('--tv-viewport-height',`${height}px`);
    requestAnimationFrame(fitTVFullscreenVideo);
  }
  async function toggleTVFullscreen(){
    if(tvFullscreenActive){exitTVFullscreen();return;}
    const shell=$('tv-fullscreen-shell'),stage=$('tv-display');
    const picture=stage.querySelector('.tv-picture');if(picture)stage.prepend(picture);
    shell._homeParent=shell.parentNode;shell._homeNext=shell.nextSibling;document.body.append(shell);
    tvFullscreenActive=true;stage.classList.add('cinema-mode');
    document.body.classList.add('tv-fullscreen-open');
    tvFullscreenButton?.setAttribute('aria-pressed','true');
    syncTVFullscreenLayout();
    try{
      const request=shell.requestFullscreen||shell.webkitRequestFullscreen;
      if(request){await request.call(shell);tvNativeFullscreen=true;}
    }catch{tvNativeFullscreen=false;}
    if(!tvFullscreenActive)return;
    if(window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0){
      try{await screen.orientation?.lock?.('landscape');}catch{}
    }
    if(tvFullscreenActive)syncTVFullscreenLayout();
    else{try{screen.orientation?.unlock?.();}catch{}}
  }
  function exitTVFullscreen(){
    tvFullscreenActive=false;tvNativeFullscreen=false;video.style.removeProperty('width');video.style.removeProperty('height');
    $('tv-display').classList.remove('cinema-mode','landscape-fallback');
    document.body.classList.remove('tv-fullscreen-open');
    const shell=$('tv-fullscreen-shell');if(shell._homeParent){shell._homeParent.insertBefore(shell,shell._homeNext?.parentNode===shell._homeParent?shell._homeNext:null);shell._homeParent=null;}
    tvFullscreenButton?.setAttribute('aria-pressed','false');
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(document.fullscreenElement||document.webkitFullscreenElement){try{Promise.resolve(exit?.call(document)).catch(()=>{});}catch{}}
    try{screen.orientation?.unlock?.();}catch{}
    renderTVRail();
  }
  video.addEventListener('loadedmetadata',fitTVFullscreenVideo);
  video.addEventListener('resize',fitTVFullscreenVideo);
  window.addEventListener('resize',syncTVFullscreenLayout);
  window.visualViewport?.addEventListener('resize',syncTVFullscreenLayout);
  window.addEventListener('orientationchange',syncTVFullscreenLayout);

  function updatePresetCounts(){$('preset-radio-count').textContent=String(Object.keys(radioPresets).length);$('preset-tv-count').textContent=String(Object.keys(tvPresets).length);}
  function reorderPreset(kind,from,to){
    const presets=kind==='tv'?tvPresets:radioPresets,keys=Object.keys(presets),a=keys.indexOf(from),b=keys.indexOf(to);
    if(a<0||b<0||a===b)return;
    keys.splice(a,1);keys.splice(b,0,from);
    const reordered=Object.fromEntries(keys.map(key=>[key,presets[key]]));
    if(kind==='tv'){tvPresets=reordered;saveStore(TV_STORE,reordered);saveStore(TV_ORDER_STORE,keys);renderTVRail();renderRemotePresets();}
    else{radioPresets=reordered;saveStore(RADIO_STORE,reordered);renderRadioShortcuts();}
    renderPresets();renderExplore();
  }
  function enablePresetDragging(target,rows){
    const kind=presetMode,key=station=>kind==='tv'?station.url:stationKey(station);
    target.querySelectorAll('.preset-drag-handle').forEach(handle=>{
      const card=handle.closest('[data-preset-index]');let drag=null,scrollFrame=0,lastScrollTime=0;
      function updateDropTarget(){
        const cards=[...target.querySelectorAll('[data-preset-index]')];
        // Use layout slots, not moving animation boxes, for insertion decisions.
        const grid=target.getBoundingClientRect();
        const slots=cards.filter(item=>item!==card).map(item=>({item,left:grid.left+item.offsetLeft-target.offsetLeft,top:grid.top+item.offsetTop-target.offsetTop-target.scrollTop,width:item.offsetWidth,height:item.offsetHeight}));
        let over=null;
        const topEdge=Math.max(0,grid.top)+Math.min(90,target.clientHeight*.25),bottomEdge=Math.min(innerHeight,grid.bottom)-Math.min(90,target.clientHeight*.25);
        const visible=slots.filter(slot=>slot.top+slot.height>0&&slot.top<innerHeight);
        if(drag.y<topEdge&&visible.length)over=visible[0].item;
        else if(drag.y>bottomEdge&&visible.length)over=visible[visible.length-1].item;
        else if(slots.length){
          slots.sort((a,b)=>Math.hypot(a.left+a.width/2-drag.x,a.top+a.height/2-drag.y)-Math.hypot(b.left+b.width/2-drag.x,b.top+b.height/2-drag.y));
          over=slots[0].item;
          const own={left:grid.left+card.offsetLeft-target.offsetLeft,top:grid.top+card.offsetTop-target.offsetTop-target.scrollTop};
          if(drag.x>=own.left&&drag.x<=own.left+card.offsetWidth&&drag.y>=own.top&&drag.y<=own.top+card.offsetHeight)return;
        }
        if(!over||over===card)return;
        const from=cards.indexOf(card),to=cards.indexOf(over);
        if(from===to||(drag.y<topEdge&&to>from)||(drag.y>bottomEdge&&to<from))return;
        const before=new Map(cards.map(item=>[item,item.getBoundingClientRect()]));
        target.insertBefore(card,from<to?over.nextSibling:over);
        drag.to=[...target.querySelectorAll('[data-preset-index]')].indexOf(card);
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const item of cards){
          const old=before.get(item),now=item.getBoundingClientRect();
          if(old.left!==now.left||old.top!==now.top){item.getAnimations().forEach(animation=>animation.cancel());item.animate([{transform:`translate(${old.left-now.left}px,${old.top-now.top}px)`},{transform:'translate(0,0)'}],{duration:180,easing:'ease-out'});}
        }
      }
      function autoScroll(time){
        if(!drag||!handle.isConnected){cancelAnimationFrame(scrollFrame);return;}
        const delta=Math.min(32,lastScrollTime?time-lastScrollTime:16);lastScrollTime=time;
        const bounds=target.getBoundingClientRect(),top=Math.max(0,bounds.top),bottom=Math.min(innerHeight,bounds.bottom),edge=Math.min(90,(bottom-top)*.25);
        const speed=drag.y<top+edge?-Math.max(.25,Math.min(1,(top+edge-drag.y)/edge)):drag.y>bottom-edge?Math.max(.25,Math.min(1,(drag.y-bottom+edge)/edge)):0;
        if(speed){let scroller=target;
          while(scroller&&!(scroller.scrollHeight>scroller.clientHeight&&/auto|scroll/.test(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
          const amount=speed*delta*.85;
          if(!scroller||scroller===document.body||scroller===document.documentElement||scroller===document.scrollingElement){
            const root=document.scrollingElement||document.documentElement;
            root.scrollTop+=amount;
            // Some mobile layouts scroll the body rather than the document root.
            if(document.body!==root&&document.body.scrollHeight>document.body.clientHeight)document.body.scrollTop+=amount;
          }else scroller.scrollTop+=amount;
        }
        updateDropTarget();scrollFrame=requestAnimationFrame(autoScroll);
      }
      handle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});
      function move(event){
        if(!drag||drag.id!==event.pointerId)return;
        event.preventDefault();event.stopPropagation();drag.x=event.clientX;drag.y=event.clientY;
        if(!drag.moved&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>7){
          drag.moved=true;card.classList.add('preset-dragging');card.style.pointerEvents='none';
          const rect=card.getBoundingClientRect();drag.ghost=card.cloneNode(true);drag.ghost.removeAttribute('data-preset-index');drag.ghost.className='preset-drag-preview';
          Object.assign(drag.ghost.style,{position:'fixed',width:rect.width+'px',height:rect.height+'px',pointerEvents:'none',zIndex:'20000'});document.body.append(drag.ghost);
          lastScrollTime=0;scrollFrame=requestAnimationFrame(autoScroll);
        }
        if(drag.ghost){drag.ghost.style.left=(drag.x-drag.offsetX)+'px';drag.ghost.style.top=(drag.y-drag.offsetY)+'px';}
        if(drag.moved)updateDropTarget();
      }
      function finish(event){
        if(!drag||event.pointerId!==drag.id)return;
        event.stopPropagation();const moved=drag.moved,to=[...target.querySelectorAll('[data-preset-index]')].indexOf(card);
        drag.ghost?.remove();drag=null;cancelAnimationFrame(scrollFrame);lastScrollTime=0;
        window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);
        card.classList.remove('preset-dragging');card.style.removeProperty('pointer-events');
        if(moved){target.dataset.suppressTapUntil=String(performance.now()+500);if(event.type==='pointerup'&&to!==Number(card.dataset.presetIndex))reorderPreset(kind,key(rows[Number(card.dataset.presetIndex)]),key(rows[to]));else renderPresets();}
      }
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0||event.target.closest('[data-preset-star]'))return;
        event.stopPropagation();const rect=card.getBoundingClientRect();
        drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,moved:false};
        window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',finish);window.addEventListener('pointercancel',finish);
      });
      handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const from=Number(card.dataset.presetIndex),to=from+(['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);if(rows[to]){reorderPreset(kind,key(rows[from]),key(rows[to]));target.querySelector(`[data-preset-index="${to}"] .preset-drag-handle`)?.focus();}});
    });
  }
  function renderPresets(){
    updatePresetCounts();const target=$('preset-grid');$('clear-recent').hidden=presetMode!=='recent';$('preset-footnote').firstChild.textContent=presetMode==='recent'?'History is stored only on this device. ': 'Drag ⠿ to reorder · Double-tap to play · ★ to remove ';if(presetMode==='recent'){ $('preset-priority-control').hidden=true;$('preset-selection-label').textContent='RECENTLY PLAYED';target.classList.add('recent-history-grid');target.innerHTML=recentHistory.map((entry,index)=>`<button class="preset-card recent-history-card" type="button" data-recent-index="${index}"><span class="channel-number">${entry.kind==='tv'?'TV':'RADIO'} · ${new Date(entry.playedAt||Date.now()).toLocaleDateString()}</span><span class="preset-logo">${entry.logo?`<img src="${safe(entry.logo)}" loading="lazy" alt="">`:entry.kind==='tv'?'TV':'♫'}</span><b>${safe(entry.name)}</b><small>${safe(entry.country||'Recently played')}</small></button>`).join('')||'<div class="empty-note">Your radio and TV history will appear here.</div>';target.querySelectorAll('[data-recent-index]').forEach(button=>button.addEventListener('click',()=>{const entry=recentHistory[Number(button.dataset.recentIndex)];if(!entry)return;const list=entry.kind==='tv'?tvs:radios,item=list.find(row=>(entry.kind==='tv'?row.url:stationKey(row))===entry.key)||Object.values(entry.kind==='tv'?tvPresets:radioPresets).find(row=>(entry.kind==='tv'?row.url:stationKey(row))===entry.key);if(item){setScreen(entry.kind==='tv'?'tv-screen':'radio-screen');entry.kind==='tv'?playTV(item):playRadio(item);}}));return;}target.classList.remove('recent-history-grid');const rows=currentRows(presetMode);$('preset-priority-control').hidden=true;
    if(presetMode==='tv'&&(!rows.some(item=>item.url===selectedTVPresetKey)))selectedTVPresetKey=tvCurrent()?.url&&rows.some(item=>item.url===tvCurrent().url)?tvCurrent().url:rows[0]?.url||null;
    const selected=rows.find(item=>item.url===selectedTVPresetKey);$('preset-selection-label').textContent=selected?`SELECTED · ${selected.name||'TV CHANNEL'}`:'SELECT A TV CHANNEL';
    target.innerHTML=rows.map((station,index)=>{const title=station.name||'Untitled station',logo=stationLogo(station);return `<article class="preset-card ${presetMode==='tv'&&tvCurrent()?.url===station.url||presetMode==='radio'&&stationKey(radioCurrent()||{})===stationKey(station)?'active':''} ${presetMode==='tv'&&selectedTVPresetKey===station.url?'priority-selected':''}" tabindex="0" role="button" data-preset-index="${index}"><span class="channel-number">CH ${String(index+1).padStart(2,'0')}</span><button type="button" class="preset-drag-handle" aria-label="Drag to change priority; use arrow keys with keyboard" title="Drag to change priority">⠿</button><button class="preset-star" type="button" data-preset-star="${safe(presetMode==='tv'?station.url:stationKey(station))}" aria-label="Remove preset">★</button><span class="preset-logo">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:safe(title.slice(0,11))}</span><b>${safe(title)}</b><small>${safe(station.country||station.group||'Live')}</small></article>`;}).join('')||'<div class="empty-note">No presets in this section yet. Save stations from Explore.</div>';
    target.querySelectorAll('[data-preset-index]').forEach(card=>{
      const station=rows[Number(card.dataset.presetIndex)],kind=presetMode;let lastTap=0;
      const play=()=>{if(kind==='tv')selectedTVPresetKey=station.url;setScreen(kind==='tv'?'tv-screen':'radio-screen');kind==='tv'?playTV(station):playRadio(station);};
      card.addEventListener('click',event=>{
        if(performance.now()<Number(target.dataset.suppressTapUntil||0)||event.target.closest('[data-preset-star],.preset-drag-handle'))return;
        const now=performance.now();
        if(lastTap&&now-lastTap<400){lastTap=0;play();return;}
        lastTap=now;
        target.querySelectorAll('.preset-tap-selected').forEach(item=>item.classList.remove('preset-tap-selected'));
        card.classList.add('preset-tap-selected');
      });
      card.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target===card){event.preventDefault();play();}});
    });
    enablePresetDragging(target,rows);
    target.querySelectorAll('[data-preset-star]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const station=rows.find(s=>(presetMode==='tv'?s.url:stationKey(s))===button.dataset.presetStar);if(station)togglePreset(presetMode,station);}));
  }
  function stationGenre(station,kind){
    const identity=String(station.name||'')+' '+String(station.channelName||'')+' '+String(station.group||'');
    if(kind==='tv'&&/\bdoordarshan\b|\bdd(?:\s|[-_]|$)/i.test(identity))return 'DD (Doordarshan)';
    if(kind==='radio'&&/akashvani|akashwani|all india radio|^air(?:\s|[-_]|$)/i.test(identity))return 'Akashvani';

    const raw=kind==='tv'?(station.group||station.genre||station.category||station.tags):(station.genre||station.tags||station.group);
    const value=Array.isArray(raw)?raw.join(','):String(raw||'');
    if(value.trim())return value.split(/[;,|]/).map(part=>part.trim()).filter(Boolean)[0]||'Other';
    const name=String(station.name||'').toLowerCase();
    if(/news|bbc|cnn|ndtv|reuters|talk/.test(name))return 'News';
    if(/devotional|bhakti|spiritual|religious/.test(name))return 'Devotional';
    if(/music|fm|hits|retro|songs|radio/.test(name))return 'Music';
    if(/movie|cinema|film/.test(name))return 'Movies';
    return 'Other';
  }
  function cleanLanguageName(value){return String(value||'').trim().replace(/\s+/g,' ').replace(/\b\p{L}/gu,letter=>letter.toLocaleUpperCase());}
  function rememberLanguage(name,code=''){
    const label=cleanLanguageName(name);if(!label)return;
    if(!languageCatalog.some(item=>item.toLocaleLowerCase()===label.toLocaleLowerCase()))languageCatalog.push(label);
    languageNameByKey.set(label.toLocaleLowerCase(),label);
    if(code)for(const alias of String(code).split(/[;,|\s]+/).filter(Boolean))languageNameByCode.set(alias.toLowerCase(),label);
  }
  function languageFromCode(code){
    const key=String(code||'').trim().toLowerCase();if(!key)return '';
    if(languageNameByCode.has(key))return languageNameByCode.get(key);
    try{const label=new Intl.DisplayNames(['en'],{type:'language'}).of(key);if(label&&label.toLowerCase()!==key.toLowerCase())return cleanLanguageName(label);}catch{}
    return '';
  }
  function languageNames(station){
    const found=new Set(),fields=[station.language,station.languages,station.languagecodes];
    for(const field of fields){for(const raw of (Array.isArray(field)?field:[field])){
      for(const part of String(raw||'').split(/[;,|]+/).map(value=>value.trim()).filter(Boolean)){
        const key=part.toLowerCase(),known=languageNameByKey.get(key)||languageFromCode(key);
        if(known){rememberLanguage(known,key);found.add(known);}
        else if(/^[a-z]{2,3}$/i.test(part)){continue;}
        else{const label=cleanLanguageName(part);rememberLanguage(label);found.add(label);}
      }
    }}
    const name=String(station.name||station.channelName||'').toLocaleLowerCase();
    for(const language of languageCatalog)if(name.includes(language.toLocaleLowerCase()))found.add(language);
    if(!found.size&&/\b(bbc|cnn|dw english|france 24|al jazeera english|abc news|reuters|nhk world|trt world|arirang|ndtv|aaj tak|dd news)\b/i.test(name))found.add('English');
    return [...found];
  }
  async function loadLanguageCatalog(){
    const jobs=[fetchJson('https://iptv-org.github.io/api/languages.json'),fetchJson('https://de1.api.radio-browser.info/json/languages?order=name&limit=5000')];
    const results=await Promise.allSettled(jobs);
    for(const result of results)if(result.status==='fulfilled'&&Array.isArray(result.value))for(const item of result.value){
      const name=item.name||item.language||item.english_name||'';const code=item.code||item.iso_639||item.iso639_3||item.iso639||'';if(name)rememberLanguage(name,code);
    }
    populateExploreFilters();
  }
  function populateExploreFilters(){
    const source=browserKind==='tv'?tvs:radios,store=browserKind==='tv'?tvPresets:radioPresets,rows=[...source,...Object.values(store)];
    const countries=browserSource==='online'&&onlineCountries.length?onlineCountries:[...new Set(rows.map(s=>String(s.country||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const genres=[...new Set([...(browserSource==='online'&&onlineGenres.length?onlineGenres:rows.map(s=>stationGenre(s,browserKind))),browserKind==='tv'?'DD (Doordarshan)':'Akashvani'])].sort((a,b)=>a.localeCompare(b));
    const allStationRows=[...radios,...tvs,...Object.values(radioPresets),...Object.values(tvPresets),...onlineRows,...(onlineTVCache||[])];
    const languages=['English',...['Tamil','Hindi','Malayalam','Telugu','Kannada','Bengali','Marathi','Gujarati','Punjabi','Urdu','Odia','Assamese','Sinhala','Nepali'].sort((a,b)=>a.localeCompare(b,'en'))];
    const replace=(id,items,label)=>{const select=$(id),old=select.value;select.innerHTML=`<option value="all">All ${label}</option>`+items.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if(items.includes(old))select.value=old;};
    replace('explore-country',countries,'countries');replace('explore-genre',genres,'genres');replace('explore-language',languages,'languages');
    $('explore-radio-count').textContent=String(new Set([...radios,...Object.values(radioPresets)].map(stationKey)).size);$('explore-tv-count').textContent=String(new Set([...tvs,...Object.values(tvPresets)].map(s=>s.url).filter(Boolean)).size);
  }
  async function fetchJson(url){const response=await fetch(url,{headers:{'Accept':'application/json'}});if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();}
  async function loadOnlineFilters(){
    $('discovery-status').textContent='Loading online filters…';
    try{
      if(browserKind==='radio'){
        const base='https://de1.api.radio-browser.info/json';
        const [countries,tags]=await Promise.all([fetchJson(`${base}/countries?order=stationcount&reverse=true&limit=250`),fetchJson(`${base}/tags?order=stationcount&reverse=true&limit=150`)]);
        onlineCountries=countries.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));onlineGenres=tags.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));
      }else{
        const base='https://iptv-org.github.io/api';
        const [countries,categories]=await Promise.all([fetchJson(`${base}/countries.json`),fetchJson(`${base}/categories.json`)]);
        onlineCountries=countries.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));onlineGenres=categories.map(x=>x.name).filter(Boolean).sort((a,b)=>a.localeCompare(b));
      }
      populateExploreFilters();$('discovery-status').textContent='Online catalog ready. Search by name or filter below.';
    }catch(error){$('discovery-status').textContent='Online filters could not load; search by name still works.';}
  }
  async function discoverOnline(loadMore=false){
    const query=$('explore-search').value.trim(),country=$('explore-country').value,genre=$('explore-genre').value,language=$('explore-language').value;
    if(!loadMore){onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;}onlineSearchDone=true;
    $('discovery-status').textContent='Searching the online catalog…';$('explore-results').innerHTML='<div class="loading-note">Loading channels…</div>';
    try{
      if(browserKind==='radio'){
        const hosts=['https://de1.api.radio-browser.info/json','https://nl1.api.radio-browser.info/json'];let found=null,lastError;
        for(const base of hosts){try{const params=new URLSearchParams({limit:'100',offset:String(onlineOffset),order:'clickcount',reverse:'true',hidebroken:'true'});if(query)params.set('name',query);if(country!=='all')params.set('country',country);if(genre==='Akashvani'){if(!query)params.set('name','Akashvani');}else if(genre!=='all')params.set('tag',genre);if(language!=='all')params.set('language',language.toLowerCase());found=await fetchJson(`${base}/stations/search?${params}`);break;}catch(error){lastError=error;}}
        if(!found)throw lastError||new Error('Radio catalog unavailable');
        const next=found.filter(s=>s.url_resolved||s.url).map(s=>({...s,_kind:'radio',url:s.url_resolved||s.url}));
        onlineRows=loadMore?[...onlineRows,...next.filter(x=>!onlineRows.some(y=>stationKey(y)===stationKey(x)))]:next;onlineHasMore=next.length===100;onlineOffset+=next.length;
      }else{
        if(!onlineTVCache){
          const base='https://iptv-org.github.io/api';$('discovery-status').textContent='Loading the global TV directory (first use may take a little longer)…';
          const [channels,streams,logos,countries,categories]=await Promise.all([fetchJson(`${base}/channels.json`),fetchJson(`${base}/streams.json`),fetchJson(`${base}/logos.json`),fetchJson(`${base}/countries.json`),fetchJson(`${base}/categories.json`)]);
          const countryNames=new Map(countries.map(c=>[c.code,c.name])),categoryNames=new Map(categories.map(c=>[c.id,c.name])),channelMap=new Map(channels.map(c=>[c.id,c])),logoMap=new Map();
          for(const logo of logos)if(logo.in_use&&!logoMap.has(logo.channel))logoMap.set(logo.channel,logo.url);
          onlineTVCache=streams.filter(s=>s.url&&s.channel&&channelMap.has(s.channel)).map(s=>{const c=channelMap.get(s.channel),genres=(c.categories||[]).map(id=>categoryNames.get(id)||id),languages=c.languages||[];return{name:s.title||c.name,channelName:c.name,alt_names:c.alt_names||[],country:countryNames.get(c.country)||c.country||'Unknown',countryCode:c.country||'',languages,language:languages.join(','),group:genres.join(', ')||'Other',tags:genres.join(','),genre:genres[0]||'Other',logo:logoMap.get(c.id)||'',url:s.url,quality:s.quality||'',labels:s.labels||[],_kind:'tv',is_nsfw:c.is_nsfw};}).filter(s=>!s.is_nsfw&&!/nsfw|adult/i.test(s.labels.join(' ')));
        }
        let filtered=onlineTVCache;
        if(query){const q=query.toLowerCase();filtered=filtered.filter(s=>`${s.name} ${s.channelName} ${s.alt_names.join(' ')} ${s.group} ${s.country}`.toLowerCase().includes(q));}
        if(country!=='all')filtered=filtered.filter(s=>s.country===country);
        if(genre!=='all')filtered=filtered.filter(s=>stationGenre(s,'tv')===genre||s.group.split(', ').includes(genre)||s.genre===genre);
        const collator=new Intl.Collator(undefined,{sensitivity:'base'});filtered.sort((a,b)=>collator.compare(a.country,b.country)||collator.compare(a.group,b.group)||collator.compare(a.name,b.name));
        onlineRows=filtered;onlineHasMore=filtered.length>100;
      }
      populateExploreFilters();$('discovery-status').textContent=`${onlineRows.length}${onlineHasMore?'+' : ''} online ${browserKind==='tv'?'TV streams':'radio stations'} found.`;renderExplore();
    }catch(error){onlineRows=[];$('discovery-status').textContent='Could not reach the online catalog. Check your connection and try again.';renderExplore();}
  }
  function renderExplore(){
    const q=$('explore-search').value.trim().toLowerCase(),country=$('explore-country').value,genre=$('explore-genre').value,language=$('explore-language').value,sortBy=$('explore-sort').value;
    const source=browserKind==='tv'?tvs:radios,store=browserKind==='tv'?tvPresets:radioPresets;
    const keyOf=s=>browserKind==='tv'?s.url:stationKey(s),merged=new Map(source.map(s=>[keyOf(s),s]));
    for(const item of Object.values(store))if(item&&keyOf(item))merged.set(keyOf(item),item);
    let rows=browserSource==='online'?onlineRows.map(s=>({...s,_kind:browserKind,_genre:stationGenre(s,browserKind),_country:s.country||'Unknown',_languages:languageNames(s)})):[...merged.values()].map(s=>({...s,_kind:browserKind,_genre:stationGenre(s,browserKind),_country:s.country||'Unknown',_languages:languageNames(s)}));
    if(country!=='all')rows=rows.filter(s=>s._country===country);
    if(genre!=='all')rows=rows.filter(s=>[s._genre,...String(s.tags||'').split(/[;,|]/),...String(s.group||'').split(/[;,|]/),...(Array.isArray(s.categories)?s.categories:[])].some(value=>String(value).trim().toLowerCase()===genre.toLowerCase()));
    if(language!=='all')rows=rows.filter(s=>s._languages.includes(language));
    if(q)rows=rows.filter(s=>`${s.name||''} ${s._genre} ${s._country} ${s.tags||''} ${s.language||''} ${s.group||''}`.toLowerCase().includes(q));
    const groupKey=sortBy==='name'?null:sortBy==='country'?'_country':'_genre',collator=new Intl.Collator(undefined,{sensitivity:'base'});
    rows.sort((a,b)=>groupKey?collator.compare(a[groupKey],b[groupKey])||collator.compare(a.name||'',b.name||''):collator.compare(a.name||'',b.name||''));
    const visibleRows=rows;
    const groups=new Map();for(const row of visibleRows){const heading=groupKey?row[groupKey]:'All channels';if(!groups.has(heading))groups.set(heading,[]);groups.get(heading).push(row);}
    const target=$('explore-results');let html='';
    for(const [heading,items] of groups){html+=`<h2 class="result-group-title">${safe(heading)} <small>${items.length}</small></h2>`;html+=items.map(s=>{const logo=stationLogo(s),key=keyOf(s),saved=Boolean(store[key]),quality=browserKind==='tv'?(s.quality||'LIVE'):[s.codec,s.bitrate?`${s.bitrate} kbps`:null].filter(Boolean).join(' · ')||'LIVE';return `<button class="result-row" type="button" data-result-kind="${browserKind}" data-result-key="${safe(key)}">${logo?`<img src="${safe(logo)}" loading="lazy" alt="">`:`<span class="result-icon">${browserKind==='tv'?'▣':'♫'}</span>`}<span class="result-copy"><b>${safe(s.name||'Untitled channel')}</b><small>${safe(s._genre)} · ${safe(s._country)}</small></span><small class="result-quality">${safe(quality)}</small><b class="result-star">${saved?'★':'☆'}</b></button>`;}).join('');}
    if(!html&&browserSource==='online')html=`<div class="empty-note">${onlineSearchDone?'No channels match. Try another name, country, or genre.':'Choose filters, then search the online catalog to discover more channels.'}</div>`;
    if(!html&&browserSource==='library')html='<div class="empty-note">No channels match those filters.</div>';
    if(browserSource==='online'&&onlineHasMore&&browserKind==='radio')html+='<button class="load-more-online" id="load-more-online" type="button">LOAD MORE CHANNELS</button>';
    target.innerHTML=html;
    $('browser-summary').textContent=`${rows.length} ${browserKind==='tv'?'TV streams':'radio stations'} · sorted by ${sortBy==='name'?'channel name':sortBy}`;
    target.querySelectorAll('[data-result-kind]').forEach(button=>button.addEventListener('click',()=>{const kind=button.dataset.resultKind,key=button.dataset.resultKey,sourceList=kind==='tv'?tvs:radios,station=sourceList.find(s=>(kind==='tv'?s.url:stationKey(s))===key)||Object.values(kind==='tv'?tvPresets:radioPresets).find(s=>(kind==='tv'?s.url:stationKey(s))===key)||onlineRows.find(s=>(kind==='tv'?s.url:stationKey(s))===key);if(!station)return;if(kind==='tv'){if(!tvPresets[station.url])togglePreset('tv',station);setScreen('tv-screen');playTV(station);}else{if(!radioPresets[stationKey(station)])togglePreset('radio',station);setScreen('radio-screen');playRadio(station);}}));
    $('load-more-online')?.addEventListener('click',()=>{if(browserKind==='radio')discoverOnline(true);else{onlineVisibleLimit+=100;renderExplore();}});
  }

  document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>setScreen(button.dataset.screen)));
  document.querySelectorAll('[data-mode-screen]').forEach(button=>button.addEventListener('click',()=>setScreen(button.dataset.modeScreen)));
  let pageSwipeStart=null,suppressPresetSwipeClickUntil=0;
  document.addEventListener('click',event=>{if(Date.now()<suppressPresetSwipeClickUntil&&event.target.closest('#presets-screen')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.querySelectorAll('.screen').forEach(screen=>{
    screen.addEventListener('pointerdown',event=>{
      const onPresets=screen.id==='presets-screen',interactive=event.target.closest('button,input,select,textarea,a,video,.dial-wrap,.tv-rail,.explore-results');
      if(event.pointerType==='mouse'||event.target.closest('.priority-pad,.preset-drag-handle')||(interactive&&!onPresets)||(!onPresets&&event.target.closest('.preset-grid'))){pageSwipeStart=null;return;}
      pageSwipeStart={x:event.clientX,y:event.clientY,id:event.pointerId,screen:screen.id};
    });
    screen.addEventListener('pointerup',event=>{
      const start=pageSwipeStart;pageSwipeStart=null;if(!start||start.id!==event.pointerId||start.screen!==document.querySelector('.screen.active')?.id)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.2){if(start.screen==='presets-screen')suppressPresetSwipeClickUntil=Date.now()+500;stepScreen(dx<0?1:-1);}
    });
    screen.addEventListener('pointercancel',()=>{pageSwipeStart=null;});
  });
  document.querySelectorAll('[data-preset-mode]').forEach(button=>button.addEventListener('click',()=>{presetMode=button.dataset.presetMode;document.querySelectorAll('[data-preset-mode]').forEach(item=>item.classList.toggle('selected',item===button));renderPresets();}));
  $('theme-choice').addEventListener('change',event=>applyTheme(event.target.value));
  $('visualizer-choice').value=visualizerPattern;
  $('visualizer-choice').addEventListener('change',event=>{visualizerPattern=event.target.value;visualizerMixSince=0;visualizerMixBag=[];try{localStorage.setItem('retrotvra.visualizer-pattern.v5',visualizerPattern);}catch{}stopSoundRays();if(!audio.paused)startSoundRays();});

  $('legacy-theme-enabled').addEventListener('change',event=>setLegacyThemeEnabled(event.target.checked));
  $('theme-switch-enabled').addEventListener('change',event=>setThemeSwitchEnabled(event.target.checked));
  // Triple taps on either player screen change its skin. Glow follows the skin.
  let themeTapBatch={count:0,surface:'',screen:'',timer:0},themePointerStart=null,legacyRadioTapCount=0,legacyRadioTapTimer=0;
  document.querySelectorAll('#radio-screen,#tv-screen').forEach(screen=>{
    screen.addEventListener('pointerdown',event=>{themePointerStart={screen:screen.id,id:event.pointerId,x:event.clientX,y:event.clientY};});
    screen.addEventListener('pointerup',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    const start=themePointerStart;themePointerStart=null;if(!start||start.screen!==screen.id||start.id!==event.pointerId||Math.hypot(event.clientX-start.x,event.clientY-start.y)>18)return;
    if(event.target.closest('button,a,input,select,textarea,.preset-grid,.explore-results,.remote-panel'))return;
    const artTap=Boolean(event.target.closest('#radio-art')),surface=artTap?'radio-art':screen.id;
    if(screen.id==='radio-screen'&&!artTap){clearTimeout(themeTapBatch.timer);themeTapBatch={count:0,surface:'',screen:'',timer:0};if(!legacyThemeEnabled)return;legacyRadioTapCount++;clearTimeout(legacyRadioTapTimer);if(legacyRadioTapCount>=10){legacyRadioTapCount=0;toggleRadioSkin();return;}legacyRadioTapTimer=window.setTimeout(()=>{legacyRadioTapCount=0;},8000);return;}
    if(screen.id==='radio-screen'&&artTap){legacyRadioTapCount=0;clearTimeout(legacyRadioTapTimer);}
    if(themeTapBatch.screen!==screen.id||themeTapBatch.surface!==surface||themeTapBatch.count===0){clearTimeout(themeTapBatch.timer);themeTapBatch={count:0,surface,screen:screen.id,timer:0};}
    themeTapBatch.count++;clearTimeout(themeTapBatch.timer);
    if(themeTapBatch.count>=3){themeTapBatch={count:0,surface:'',screen:'',timer:0};if(themeSwitchEnabled){const themes=['retro','modern','ultra'];applyTheme(themes[(themes.indexOf(themeMode)+1)%themes.length]);notify(`${themeMode.toUpperCase()} theme`);}return;}
    themeTapBatch.timer=window.setTimeout(()=>{themeTapBatch={count:0,surface:'',screen:'',timer:0};},650);
  });});
  document.querySelectorAll('[data-browser-kind]').forEach(button=>button.addEventListener('click',()=>{browserKind=button.dataset.browserKind;onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;onlineCountries=[];onlineGenres=[];onlineSearchDone=false;document.querySelectorAll('[data-browser-kind]').forEach(item=>item.classList.toggle('selected',item===button));populateExploreFilters();renderExplore();if(browserSource==='online')loadOnlineFilters();}));
  document.querySelectorAll('[data-browser-source]').forEach(button=>button.addEventListener('click',()=>{browserSource=button.dataset.browserSource;document.querySelectorAll('[data-browser-source]').forEach(item=>item.classList.toggle('selected',item===button));$('online-search-row').hidden=browserSource!=='online';onlineRows=[];onlineOffset=0;onlineVisibleLimit=100;onlineHasMore=false;onlineSearchDone=false;populateExploreFilters();renderExplore();if(browserSource==='online')loadOnlineFilters();}));
  $('discover-online').addEventListener('click',()=>discoverOnline());
  $('explore-search').addEventListener('keydown',event=>{if(event.key==='Enter'&&browserSource==='online'){event.preventDefault();discoverOnline();}});
    $('explore-search').addEventListener('input',renderExplore);$('explore-country').addEventListener('change',()=>browserSource==='online'?discoverOnline():renderExplore());$('explore-genre').addEventListener('change',()=>browserSource==='online'?discoverOnline():renderExplore());$('explore-language').addEventListener('change',()=>{if(browserSource==='online'){onlineVisibleLimit=20;discoverOnline();}else renderExplore();});$('explore-sort').addEventListener('change',renderExplore);
  $('radio-country').addEventListener('change',()=>{renderRadioDisplay();renderPresets();});
  $('tv-country').addEventListener('change',()=>{renderTVRail();renderPresets();});
  $('radio-play').addEventListener('click',toggleRadio);$('radio-prev').addEventListener('click',()=>stepRadio(-1));$('radio-next').addEventListener('click',()=>stepRadio(1));
  $('radio-star').addEventListener('click',()=>{const station=radioCurrent();if(station)togglePreset('radio',station);});

  $('radio-volume').addEventListener('input',event=>setRadioVolume(event.target.value));
  document.querySelectorAll('[data-radio-volume-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.radioVolumeAction;if(action==='mute'){audio.muted=!audio.muted;button.classList.toggle('muted',audio.muted);button.setAttribute('aria-label',audio.muted?'Unmute radio':'Mute radio');}else if(action==='up'){audio.muted=false;setRadioVolume(Number($('radio-volume').value)+5);}}));
  $('tv-star').addEventListener('click',()=>{const station=tvCurrent();if(station)togglePreset('tv',station);});
  $('tv-prev').addEventListener('click',()=>stepTV(-1));$('tv-next').addEventListener('click',()=>stepTV(1));$('tv-prev-name').addEventListener('click',()=>stepTV(-1));$('tv-next-name').addEventListener('click',()=>stepTV(1));$('tv-toggle').addEventListener('click',()=>{if(youtubePlayer?.getPlayerState){if(youtubePlayer.getPlayerState()===1)youtubePlayer.pauseVideo();else youtubePlayer.playVideo();return;}if(!video.src&&!video.currentSrc){const rows=currentRows('tv');if(rows.length)playTV(rows[0]);return;}if(video.paused)video.play().then(()=>{$('tv-toggle').textContent='Ⅱ';}).catch(()=>notify('Press play on the video.'));else video.pause();});
  document.querySelectorAll('[data-remote]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.remote;
    if(action==='vol-up'||action==='vol-down'){video.muted=false;video.volume=Math.min(1,Math.max(0,video.volume+(action==='vol-up' ? 0.1 : -0.1)));return;}
    if(action==='channel-up'){stepTV(1);return;}if(action==='channel-down'){stepTV(-1);return;}
    if(action==='play-pause'){$('tv-toggle').click();return;}
    if(action==='favorite'){$('tv-star').click();return;}
    if(action==='mute'){video.muted=!video.muted;button.classList.toggle('muted',video.muted);button.setAttribute('aria-label',video.muted?'Unmute':'Mute');return;}
    if(action==='fullscreen'){toggleTVFullscreen();return;}
    if(action==='power')stopTV();
  }));
  $('remote-channel-select').addEventListener('change',event=>{const station=currentRows('tv').find(item=>item.url===event.target.value);if(station)playTV(station);});
  // Drag coordinates are measured in the player plane, including rotated mobile fallback.
  const fullscreenPanel=document.querySelector('.fullscreen-side-controls');
  let fullscreenDrag=null,fullscreenPosition=null;
  function panelPoint(event){const stage=$('tv-display'),rect=stage.getBoundingClientRect();return stage.classList.contains('landscape-fallback')?{x:event.clientY-rect.top,y:rect.right-event.clientX}:{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function positionFullscreenPanel(x,y){
    const stage=$('tv-display'),panel=fullscreenPanel;
    x=Math.max(0,Math.min(x,stage.clientWidth-panel.offsetWidth));y=Math.max(0,Math.min(y,stage.clientHeight-panel.offsetHeight));
    fullscreenPosition={x,y};panel.style.setProperty('left',x+'px','important');panel.style.setProperty('top',y+'px','important');panel.style.setProperty('right','auto','important');panel.style.setProperty('transform','none','important');
  }
  fullscreenPanel.addEventListener('pointerdown',event=>{
    if(!tvFullscreenActive||event.target.closest('button')||event.button!==0)return;
    const point=panelPoint(event);fullscreenDrag={id:event.pointerId,x:point.x,y:point.y,left:fullscreenPanel.offsetLeft,top:fullscreenPanel.offsetTop-fullscreenPanel.offsetHeight/2};
    if(fullscreenPosition){fullscreenDrag.left=fullscreenPosition.x;fullscreenDrag.top=fullscreenPosition.y;}
    fullscreenPanel.setPointerCapture(event.pointerId);event.preventDefault();
  });
  fullscreenPanel.addEventListener('pointermove',event=>{if(!fullscreenDrag||fullscreenDrag.id!==event.pointerId)return;const point=panelPoint(event);positionFullscreenPanel(fullscreenDrag.left+point.x-fullscreenDrag.x,fullscreenDrag.top+point.y-fullscreenDrag.y);event.preventDefault();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])fullscreenPanel.addEventListener(name,event=>{if(fullscreenDrag?.id!==event.pointerId)return;fullscreenDrag=null;if(fullscreenPanel.hasPointerCapture(event.pointerId))fullscreenPanel.releasePointerCapture(event.pointerId);});
  window.addEventListener('resize',()=>requestAnimationFrame(()=>{if(tvFullscreenActive&&fullscreenPosition)positionFullscreenPanel(fullscreenPosition.x,fullscreenPosition.y);}));
  document.querySelectorAll('[data-fullscreen-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.fullscreenAction;if(action==='vol-up'||action==='vol-down'){stopTVVolumeRamp();tvVolumeRampStarted=true;video.muted=false;video.volume=Math.max(0,Math.min(1,video.volume+(action==='vol-up'?.05:-.05)));updateTVNumbers();return;}if(action==='zoom'||action==='normal'){tvZoomed=action==='zoom';fitTVFullscreenVideo();return;}if(action==='home'){exitTVFullscreen();setScreen('tv-screen');$('tv-screen').scrollIntoView({behavior:'smooth',block:'start'});return;}if(action==='previous'){stepTV(-1);return;}if(action==='next'){stepTV(1);return;}if(action==='play'){if(video.paused)video.play().catch(()=>notify('Press play to resume this channel.'));else video.pause();return;}if(action==='mute'){video.muted=!video.muted;$('tv-display').classList.toggle('is-muted',video.muted);button.setAttribute('aria-label',video.muted?'Unmute':'Mute');}}));

  audio.addEventListener('play',()=>{$('equalizer').classList.add('playing');$('radio-art').classList.add('playing');$('radio-play').textContent='Ⅱ';$('radio-play').title='Pause';drawRadio();startSoundRays();});audio.addEventListener('pause',()=>{stopSoundRays();$('equalizer').classList.remove('playing');$('radio-art').classList.remove('playing');$('radio-play').textContent='▶';$('radio-play').title='Play';drawRadio();});
  audio.addEventListener('waiting',()=>{if(currentRadioSource)$('radio-status').textContent='BUFFERING · '+(radioCurrent()?.name||'RADIO');});
  audio.addEventListener('stalled',()=>{if(currentRadioSource)$('radio-status').textContent='STREAM STALLED · WAITING TO RETRY';});
  audio.addEventListener('error',()=>{if(!currentRadioSource)return;const insecure=location.protocol==='https:'&&/^http:\/\//i.test(currentRadioSource);$('radio-status').textContent=insecure?'HTTPS REQUIRED · THIS STREAM USES HTTP':'STREAM COULD NOT LOAD';if(insecure)notify('This station uses an HTTP link, which secure pages block. Use an HTTPS stream.');else console.error('Radio audio error:',audio.error?.code,currentRadioSource);});
  video.addEventListener('playing',startTVVolumeRamp);
  video.addEventListener('play',()=>{$('tv-toggle').textContent='Ⅱ';$('remote-main-play').classList.add('playing');$('tv-display').classList.add('is-playing');$('tv-placeholder').hidden=true;});video.addEventListener('pause',()=>{$('tv-toggle').textContent='▶';$('remote-main-play').classList.remove('playing');$('tv-display').classList.remove('is-playing');});video.addEventListener('volumechange',()=>{if(video.muted||Math.abs(video.volume-tvVolumeRampExpected)>.001){tvVolumeRampStarted=true;stopTVVolumeRamp();}updateTVNumbers();$('tv-display').classList.toggle('is-muted',video.muted);});video.addEventListener('error',()=>{if(video.currentSrc)notify('This TV stream could not be reached.');});
  function onTVFullscreenChange(){
    const element=document.fullscreenElement||document.webkitFullscreenElement;
    if(tvFullscreenActive&&tvNativeFullscreen&&!element)exitTVFullscreen();
    else syncTVFullscreenLayout();
  }
  document.addEventListener('fullscreenchange',onTVFullscreenChange);
  document.addEventListener('webkitfullscreenchange',onTVFullscreenChange);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tvFullscreenActive){event.preventDefault();exitTVFullscreen();}});
  document.addEventListener('keydown',event=>{if(event.target.closest('input,select,textarea,button,video,[contenteditable],.preset-drag-handle'))return;if(event.code==='Space'&&['radio-screen','tv-screen'].includes(document.querySelector('.screen.active')?.id)){event.preventDefault();if(!$('radio-screen').classList.contains('active'))$('tv-toggle').click();else toggleRadio();}if(event.key==='ArrowRight'&&$('tv-screen').classList.contains('active'))stepTV(1);if(event.key==='ArrowLeft'&&$('tv-screen').classList.contains('active'))stepTV(-1);});
  // Bluetooth media buttons are delivered through the browser Media Session.
  let remoteMedia=audio;
  let lastRemoteSwitch=0;
  function switchRemoteMode(){
    const now=Date.now();
    if(now-lastRemoteSwitch<500)return;
    lastRemoteSwitch=now;
    const active=document.querySelector('.screen.active')?.id;
    const toRadio=active==='tv-screen'||(active!=='radio-screen'&&remoteMedia===video);
    if(tvFullscreenActive)exitTVFullscreen();
    remoteMedia=toRadio?audio:video;
    setScreen(toRadio?'radio-screen':'tv-screen');
  }
  let remoteClicks=0,remoteClickTimer=null;
  function remotePlayPause(){
    remoteClicks++;
    clearTimeout(remoteClickTimer);
    if(remoteClicks===3){remoteClicks=0;switchRemoteMode();return;}
    remoteClickTimer=setTimeout(()=>{
      const clicks=remoteClicks;remoteClicks=0;
      if(clicks%2){
        if(remoteMedia.paused){
          if(!remoteMedia.src&&!remoteMedia.currentSrc){if(remoteMedia===audio)toggleRadio();else $('tv-toggle').click();}
          else remoteMedia.play().catch(()=>{});
        }else remoteMedia.pause();
      }
    },450);
  }
  function remoteStep(direction){if(remoteMedia===video)stepTV(direction);else stepRadio(direction);}
  function syncRemoteMedia(){
    if(!navigator.mediaSession)return;
    const station=remoteMedia===video?tvCurrent():radioCurrent();
    try{
      navigator.mediaSession.playbackState=remoteMedia.paused?'paused':'playing';
      if(typeof MediaMetadata!=='undefined')navigator.mediaSession.metadata=new MediaMetadata({title:station?.name||'COOLmagRaTv',artist:remoteMedia===video?'Live TV':'Radio',album:'COOLmagRaTv'});
    }catch{}
  }
  for(const media of [audio,video]){
    media.addEventListener('play',()=>{remoteMedia=media;syncRemoteMedia();});
    media.addEventListener('pause',()=>{if(remoteMedia===media)syncRemoteMedia();});
  }
  if(navigator.mediaSession?.setActionHandler){
    const actions={play:remotePlayPause,pause:remotePlayPause,stop:()=>{if(remoteMedia===video)stopTV();else stopRadio();},previoustrack:()=>remoteStep(-1),nexttrack:()=>remoteStep(1)};
    for(const [action,handler] of Object.entries(actions)){try{navigator.mediaSession.setActionHandler(action,handler);}catch{}}
  }
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.repeat||event.target.closest('input,select,textarea,[contenteditable]'))return;
    const actions={MediaPlayPause:remotePlayPause,MediaPlay:remotePlayPause,MediaPause:remotePlayPause,MediaTrackNext:()=>remoteStep(1),MediaTrackPrevious:()=>remoteStep(-1)};
    if(actions[event.key]){event.preventDefault();actions[event.key]();}
  });
  video.volume=0.05;updateTVNumbers();
  const volume=Number(loadStore(VOLUME_STORE,30));setRadioVolume(Number.isFinite(volume)?Math.min(100,Math.max(0,volume)):30);
  let pendingInstallPrompt=null;const installButton=$('install-app'),installedModes=['standalone','minimal-ui','fullscreen','window-controls-overlay'].map(mode=>window.matchMedia(`(display-mode: ${mode})`));
  const installedBefore=()=>{try{return localStorage.getItem('retrotvra.installed.v1')==='true';}catch{return false;}};
  const isInstalledApp=()=>Boolean(navigator.standalone)||installedModes.some(query=>query.matches)||installedBefore();
  const updateInstallButton=()=>{if(isInstalledApp()){installButton.hidden=true;pendingInstallPrompt=null;}else installButton.hidden=false;};
  updateInstallButton();installedModes.forEach(query=>query.addEventListener?.('change',updateInstallButton));
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();try{localStorage.removeItem('retrotvra.installed.v1');}catch{}pendingInstallPrompt=event;if(!installedModes.some(query=>query.matches)&&!navigator.standalone){installButton.hidden=false;installButton.classList.add('install-ready');}});
  window.addEventListener('appinstalled',()=>{pendingInstallPrompt=null;installButton.classList.remove('install-ready');installButton.hidden=true;try{localStorage.setItem('retrotvra.installed.v1','true');}catch{}notify('COOLmagRaTv added to your home screen.');});
  installButton.addEventListener('click',async()=>{
    if(pendingInstallPrompt){pendingInstallPrompt.prompt();const choice=await pendingInstallPrompt.userChoice;pendingInstallPrompt=null;if(choice.outcome==='accepted')installButton.classList.remove('install-ready');return;}
    if(window.matchMedia('(display-mode:standalone)').matches||navigator.standalone){notify('COOLmagRaTv is already installed.');return;}
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){notify('In Safari, tap Share, then Add to Home Screen.');return;}
    notify('Open the browser menu and choose Install app or Add to Home Screen.');
  });
  if('serviceWorker' in navigator&&window.isSecureContext){navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});}
  applyTheme(themeMode,true);syncThemeSettings();
  $('export-curated-presets').addEventListener('click',()=>{
    const orderedTV=applyTVOrder(tvPresets);
    const payload={format:'coolradtv-curated-v1',exportedAt:new Date().toISOString(),radio:radioPresets,tv:orderedTV};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='CoolRADtv-curated-presets.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('settings-open').addEventListener('click',()=>$('settings-dialog').showModal());
  $('clear-recent').addEventListener('click',()=>{recentHistory=[];saveStore(RECENT_STORE,recentHistory);renderPresets();notify('Recent history cleared.');});
  formatClock();setInterval(formatClock,30000);loadRadioNews();setInterval(loadRadioNews,60*60*1000);loadLanguageCatalog();fetchData().finally(()=>{if(!$('welcome-splash-v2'))startOpenedPlayer();window.setTimeout(closeSplash,650);});
})();
