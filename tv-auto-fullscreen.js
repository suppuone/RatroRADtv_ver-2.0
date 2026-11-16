/* Rotation-triggered app fullscreen. Native fullscreen requires a gesture on
 * many phones, so automatic entry uses the existing viewport-filling TV shell.
 * It never locks orientation, reloads a stream, or calls play().
 */
window.createTVAutoFullscreen=function({media,isTVVisible,isFullscreen,isAutomatic,enter,exit}){
  let dismissed=false,timer=0,wasLandscape=false;
  const mobile=()=>window.matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;
  const landscape=()=>{
    const viewport=window.visualViewport;
    return (viewport?.width||window.innerWidth)>(viewport?.height||window.innerHeight);
  };
  function update(){
    clearTimeout(timer);
    const wide=landscape();
    if(!wide){
      dismissed=false;wasLandscape=false;
      if(isFullscreen()&&isAutomatic())exit('portrait');
      return;
    }
    if(!wasLandscape)dismissed=false;
    wasLandscape=true;
    if(!mobile()||document.hidden||!isTVVisible())return;
    if(!dismissed&&!isFullscreen()&&!media.paused&&!media.ended)enter(true);
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(update,120);}
  window.addEventListener('orientationchange',schedule);
  window.addEventListener('resize',schedule);
  window.visualViewport?.addEventListener('resize',schedule);
  window.screen?.orientation?.addEventListener('change',schedule);
  media.addEventListener('playing',schedule);
  document.addEventListener('visibilitychange',schedule);
  return {
    update,
    dismiss(){dismissed=landscape();wasLandscape=landscape();},
    leave(){clearTimeout(timer);if(isFullscreen())exit('leave');}
  };
};
