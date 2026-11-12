(() => {
  const KEY='coolradtv.openings.v1',INSTALL='coolradtv.install-tapped.v1';
  let visits=1,tapped=false;
  try{visits=Number(localStorage.getItem(KEY)||0)+1;localStorage.setItem(KEY,String(visits));tapped=localStorage.getItem(INSTALL)==='yes';}catch{}
  const installed=Boolean(navigator.standalone)||matchMedia('(display-mode: standalone)').matches;
  window.coolRadioOnboardingBlocked=!installed&&!tapped&&visits===1;
  const style=document.createElement('style');style.textContent=`
  .listener-dialog{box-sizing:border-box;width:min(94vw,480px);max-height:90dvh;overflow:auto;background:#171c24;color:#fff;border:1px solid #b88b46;border-radius:20px;padding:26px;font:16px/1.6 system-ui;box-shadow:0 20px 80px #0009}
  .listener-dialog::backdrop{background:#080b10ed}.listener-dialog h2{line-height:1.25}.listener-dialog button,.listener-dialog a{display:inline-block;padding:12px 18px;margin:6px 6px 6px 0;border-radius:10px;border:1px solid #b88b46;background:#e5b468;color:#151515;font:inherit;text-decoration:none;cursor:pointer}.listener-dialog .install-app{position:static;display:flex;width:auto;height:auto;align-items:center;gap:10px}.listener-dialog .install-app svg{width:24px;height:24px}.listener-dialog small{display:block;color:#c5cbd4}
  .listener-dialog fieldset{border:0;padding:0;margin:20px 0}.listener-dialog legend{font-weight:600;margin-bottom:10px}.listener-dialog fieldset label{display:inline-flex;align-items:center;gap:6px;padding:8px;border:1px solid #67707c;border-radius:10px;cursor:pointer}.listener-dialog label:has(input:checked){background:#e5b468;color:#151515;border-color:#e5b468}.listener-dialog input{accent-color:#bd8428}.review-stars{display:flex;gap:5px;flex-wrap:wrap}.listener-dialog textarea{box-sizing:border-box;width:100%;padding:12px;background:#0c1118;color:#fff;border:1px solid #67707c;border-radius:10px;font:inherit}.listener-dialog [data-review-close]{background:transparent;color:#fff}.listener-dialog button:disabled{opacity:.6}.listener-dialog :focus-visible{outline:3px solid #80caff;outline-offset:3px}

  /* Keep onboarding readable independently of the selected player theme. */
  body .listener-dialog{color-scheme:dark;background:linear-gradient(145deg,#182b40 0%,#101d2e 100%);color:#f5f7fb;border:1px solid #d6ad67;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.65;letter-spacing:normal;text-align:left;padding:28px;box-shadow:0 24px 90px #000b}
  body .listener-dialog::backdrop{background:rgba(4,10,19,.88)}
  body .listener-dialog h2{color:#ffe0a3;font-size:clamp(24px,6vw,30px);font-weight:750;line-height:1.25;margin:20px 0 12px;text-transform:none;letter-spacing:-.4px}
  body .listener-dialog p,body .listener-dialog label,body .listener-dialog legend,body .listener-dialog .review-stars span{color:#f5f7fb;opacity:1}
  body .listener-dialog small{color:#c4d2e3;font-size:13px;line-height:1.55;opacity:1}
  body .listener-dialog>small:first-child{color:#f3c977;font-weight:700;letter-spacing:1px}
  body .listener-dialog fieldset label{background:#243a52;color:#f5f7fb;border:1px solid #7890aa;min-height:44px;box-sizing:border-box}
  body .listener-dialog label:has(input:checked){background:#f3c977;color:#172333;border-color:#ffe2a9}
  body .listener-dialog label:has(input:checked) span{color:#172333}
  body .listener-dialog textarea{background:#0b1625;color:#f5f7fb;border:1px solid #7890aa;line-height:1.5}
  body .listener-dialog textarea::placeholder{color:#aebfd3;opacity:1}
  body .listener-dialog button,body .listener-dialog a,body .listener-dialog .install-app{background:#f3c977;color:#172333;border:1px solid #ffe2a9;font-weight:700;min-height:46px;box-shadow:none;text-transform:none;letter-spacing:normal}
  body .listener-dialog .install-app svg{fill:none;stroke:currentColor;stroke-width:2}
  body .listener-dialog button:hover:not(:disabled),body .listener-dialog a:hover{background:#ffe0a3;color:#172333}
  body .listener-dialog [data-review-close]{background:#243a52;color:#f5f7fb;border-color:#7890aa}
  body .listener-dialog [data-review-close]:hover{background:#344e6a;color:#fff}
  body .listener-dialog #review-status{color:#ffe0a3;font-weight:600;font-size:14px}
  body .listener-dialog :focus-visible{outline:3px solid #86d5ff;outline-offset:4px}
  @media(max-width:380px){body .listener-dialog{padding:20px}.review-stars{gap:4px}body .listener-dialog .review-stars label{padding:7px 5px;font-size:14px}}
  `;document.head.append(style);
  function dialog(html){const d=document.createElement('dialog');d.className='listener-dialog';d.innerHTML=html;document.body.append(d);return d;}
  function ready(){
    if(window.coolRadioOnboardingBlocked){
      const button=document.getElementById('install-app'),parent=button.parentNode,next=button.nextSibling;
      const d=dialog('<h2>Add your radio shortcut</h2><p>Tap INSTALL above to add COOLmagRaTv to your home screen for quick access.</p><small>Your browser may show an install prompt or instructions. You can continue after tapping, even if installation is unavailable.</small>');
      d.setAttribute('aria-label','Install app shortcut');button.hidden=false;button.append(document.createTextNode(' INSTALL'));d.prepend(button);
      d.addEventListener('cancel',e=>e.preventDefault());d.showModal();button.focus();
      button.addEventListener('click',()=>{try{localStorage.setItem(INSTALL,'yes');}catch{}window.coolRadioOnboardingBlocked=false;d.close();parent.insertBefore(button,next);button.lastChild.nodeType===3&&button.lastChild.remove();d.remove();document.dispatchEvent(new Event('coolradio-onboarding-ready'));},{once:true});
    }else if(visits===2){
      const d=dialog(`<small>COOL RETRO RADIO · LISTENER FEEDBACK</small><h2>Enjoying your little escape?</h2><p>Your feedback helps us tune things better.</p>
      <form id="listener-review"><fieldset><legend>How was your experience?</legend><label><input type="radio" name="enjoy" value="YES" required> 👍 Like</label> <label><input type="radio" name="enjoy" value="NO"> 👎 Dislike</label></fieldset>
      <fieldset><legend>Your rating</legend><div class="review-stars">${[1,2,3,4,5].map(n=>`<label title="${n} out of 5"><input type="radio" name="rating" value="${n}" required><span>${n} ★</span></label>`).join('')}</div><small>1 = poor · 5 = excellent</small></fieldset>
      <label for="review-comment">Anything we can improve? <small>Optional</small></label><textarea id="review-comment" name="comment" rows="3" maxlength="4000" placeholder="Tell us what you love or what needs tuning…"></textarea>
      <p><small>Your response is sent to the station owner through Google Forms.</small></p><button type="submit">Send feedback</button><button type="button" data-review-close>Maybe later</button><p role="status" id="review-status" aria-live="polite"></p></form>
      <small>Want a home-screen shortcut? Tap INSTALL at the top of the app.</small>`);
      d.setAttribute('aria-label','Listener feedback');
      d.querySelector('[data-review-close]').onclick=()=>{d.close();d.remove();};
      d.querySelector('form').addEventListener('submit',async event=>{
        event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),status=d.querySelector('#review-status');
        if(!navigator.onLine){status.textContent='You are offline. Please connect and try again.';return;}
        const values=new FormData(form),body=new URLSearchParams();
        body.set('entry.1923107899',values.get('enjoy'));body.set('entry.208385300',values.get('rating'));body.set('entry.1720178770',values.get('comment')||'');
        button.disabled=true;status.textContent='Sending your feedback…';
        try{
          await fetch('https://docs.google.com/forms/d/e/1FAIpQLSdg6YxkRtmbmfL6xhA2wYvCFwQf_mLV2jaQeRvEWzl0VEOlBg/formResponse',{method:'POST',mode:'no-cors',body});
          status.textContent='Your feedback request has been sent. Google does not provide a delivery confirmation inside this app.';
          button.textContent='Sent';form.querySelector('[data-review-close]').textContent='Continue listening';
        }catch{status.textContent='Could not send. Your answers are still here—please try again.';button.disabled=false;}
      });d.showModal();

    }
  }
  const splash=document.getElementById('welcome-splash-v2');
  if(!splash)ready();else{const observer=new MutationObserver(()=>{if(!splash.isConnected){observer.disconnect();ready();}});observer.observe(document.body,{childList:true});}
})();
