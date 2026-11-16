/* Shared eight-second watchdog for native audio/video and HLS adapters.
 * Timers belong to one playback generation; user pauses and autoplay blocks cancel them.
 * Each failed station is attempted at most once until a user starts a new selection.
 */
window.createStreamRecovery = function(media, options) {
  let timer=0, generation=0, active=false, connecting=false, attempted=new Set();
  const cancel=()=>{ clearTimeout(timer); timer=0; };
  const stop=()=>{ cancel(); active=false; connecting=false; generation++; };
  function arm(){
    if(!active||timer)return;
    const token=generation;
    timer=setTimeout(()=>{
      timer=0;
      if(!active||token!==generation)return;
      if(navigator.onLine===false){stop();options.notify('Connection offline. Reconnect and press Play.');return;}
      const current=options.current();
      if(!current)return stop();
      attempted.add(options.key(current));
      const rows=options.rows(), index=rows.findIndex(s=>options.key(s)===options.key(current));
      let next=null;
      for(let n=1;n<=rows.length;n++){
        const candidate=rows[(index+n+rows.length)%rows.length];
        if(!attempted.has(options.key(candidate))){next=candidate;break;}
      }
      stop();
      if(next){options.notify('Stream offline, trying next...');options.play(next,true);}
      else {options.halt();options.notify('No working stations found. Choose another station or retry.');}
    },8000);
  }
  media.addEventListener('playing',()=>{connecting=false;cancel();});
  media.addEventListener('timeupdate',()=>{if(!media.paused&&media.readyState>=3)cancel();});
  for(const event of ['error','stalled','waiting'])media.addEventListener(event,()=>{if(active&&(connecting||!media.paused))arm();});
  media.addEventListener('pause',()=>{if(!connecting&&!media.error)stop();});
  media.addEventListener('play',()=>{if(!active){active=true;connecting=true;attempted.clear();}arm();});
  window.addEventListener('offline',stop);
  return {
    begin(automatic=false){stop();if(!automatic)attempted.clear();active=true;connecting=true;arm();},
    fail(){connecting=true;arm();},stop,
    blocked:stop,
    reject(error){if(error?.name==='NotAllowedError'||error?.name==='AbortError')stop();else arm();}
  };
};
