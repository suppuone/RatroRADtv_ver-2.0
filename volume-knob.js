/* One volume value feeds both controls through app.js:setRadioVolume.
 * The dial changes the value; setValue only paints it, avoiding event loops.
 */
window.createRadioVolumeKnob=function({onInput}){
  const input=document.getElementById('radio-volume-knob');
  const dial=document.getElementById('radio-volume-dial');
  const output=document.getElementById('radio-volume-knob-value');
  const clamp=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
  let drag=null;
  function setValue(value){
    value=clamp(value);input.value=String(value);output.textContent=value+'%';
    input.setAttribute('aria-valuetext',value+' percent');
    dial.style.setProperty('--volume-knob-angle',(-135+value*2.7)+'deg');
    dial.style.setProperty('--volume-knob-fill',(value*2.7)+'deg');
  }
  input.addEventListener('input',()=>onInput(clamp(input.value)));
  dial.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.target.closest('button'))return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,value:Number(input.value)};
    dial.setPointerCapture(event.pointerId);input.focus({preventScroll:true});
    event.preventDefault();event.stopPropagation();
  });
  dial.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    onInput(clamp(drag.value+(drag.y-event.clientY+event.clientX-drag.x)/1.8));
    event.preventDefault();event.stopPropagation();
  });
  function finish(event){
    if(!drag||event.pointerId!==drag.id)return;
    drag=null;if(dial.hasPointerCapture(event.pointerId))dial.releasePointerCapture(event.pointerId);
    event.stopPropagation();
  }
  dial.addEventListener('pointerup',finish);dial.addEventListener('pointercancel',finish);
  dial.addEventListener('lostpointercapture',()=>{drag=null;});
  dial.addEventListener('wheel',event=>{
    if(document.activeElement!==input||event.target.closest('button'))return;
    event.preventDefault();onInput(clamp(Number(input.value)+(event.deltaY<0?2:-2)));
  },{passive:false});
  setValue(document.getElementById('radio-volume').value);
  return {setValue};
};
