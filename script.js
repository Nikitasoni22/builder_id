/* ================= builder title generator ================= */
const PREFIX=["Chief","Head of","Director of","Minister of","Senior","Resident","Certified","Founding","Undisputed","Rogue","Beachside"];
const NOUN=["Vibes","Ship‑It","Terminal","Midnight Commit","Sunset Merge","Hot Reload","Zero‑Downtime","Late‑Night Build","Infinite Scroll","Palm‑Tree Pipeline","Tide & Tokens","Byte & Beach"];
const SUFFIX=["Officer","Engineer","Architect","Wizard","Operative","Custodian","Whisperer","Ambassador","Specialist","Sherpa"];
function randOf(a){return a[Math.floor(Math.random()*a.length)];}
function generateTitle(){return `${randOf(PREFIX)} ${randOf(NOUN)} ${randOf(SUFFIX)}`;}

/* ================= state ================= */
const state={
  img:null, zoom:1, offX:0, offY:0, rotation:0,
  dragging:false, lastX:0, lastY:0,
  title: generateTitle(),
  passportNo: 'HHG26-'+Math.floor(100000+Math.random()*899999)
};

const canvas=document.getElementById('card');
const ctx=canvas.getContext('2d');
const CW=1080, CH=1350;
const PB={x:80,y:300,w:440,h:560};

/* preload HH Goa logo (user-provided) */
const HH_LOGO_URL='assets/hh-goa-logo.png';
let hhLogo=null;
const hhLogoImg=new Image();
hhLogoImg.onload=()=>{ hhLogo=hhLogoImg; draw(); };
hhLogoImg.src=HH_LOGO_URL;

function isMobileDevice(){
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth <= 900);
}

function downloadBlob(blob, filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

function openExternalUrl(url){
  const a=document.createElement('a');
  a.href=url;
  a.target='_blank';
  a.rel='noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function openXComposer(text, desktopWin){
  const encoded=encodeURIComponent(text);
  const webUrl=`https://x.com/intent/tweet?text=${encoded}`;
  const ua=navigator.userAgent;
  const isIOS=/iPhone|iPad|iPod/i.test(ua);
  const isAndroid=/Android/i.test(ua);

  if(desktopWin && !desktopWin.closed){
    desktopWin.location.href=webUrl;
    return;
  }

  if(isIOS){
    let fallbackTimer;
    const clearFallback=()=>{ if(fallbackTimer){ clearTimeout(fallbackTimer); fallbackTimer=null; } };
    document.addEventListener('visibilitychange', clearFallback, {once:true});
    window.location.href=`twitter://post?message=${encoded}`;
    fallbackTimer=setTimeout(()=>{
      if(document.visibilityState==='visible') openExternalUrl(webUrl);
    }, 1200);
    return;
  }

  if(isAndroid){
    window.location.href=`intent://x.com/intent/tweet?text=${encoded}#Intent;scheme=https;package=com.twitter.android;S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    return;
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer');
}

/* ================= image loading (HEIC/JPG/PNG safe) ================= */
async function loadImageFile(file){
  try{
    if('createImageBitmap' in window){
      return await createImageBitmap(file, {imageOrientation:'from-image'});
    }
  }catch(e){}
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const im=new Image();
    im.onload=()=>resolve(im);
    im.onerror=reject;
    im.src=url;
  });
}
function fitCover(iw,ih,bw,bh){ return Math.max(bw/iw, bh/ih); }

/* ================= drawing helpers ================= */
function noiseTile(){
  const t=document.createElement('canvas'); t.width=120;t.height=120;
  const tctx=t.getContext('2d');
  const id=tctx.createImageData(120,120);
  for(let i=0;i<id.data.length;i+=4){
    const v=200+Math.random()*40;
    id.data[i]=v-20;id.data[i+1]=v;id.data[i+2]=v-30;id.data[i+3]=10;
  }
  tctx.putImageData(id,0,0);
  return t;
}
const NOISE_TILE = noiseTile();

function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);
  c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);
  c.arcTo(x,y,x+w,y,r);
  c.closePath();
}
function drawGuilloche(c,x,y,w,h,color,rows){
  c.save();
  c.strokeStyle=color; c.lineWidth=1; c.globalAlpha=.35;
  for(let i=0;i<rows;i++){
    const yy=y+(h/(rows-1))*i;
    c.beginPath();
    for(let px=0;px<=w;px+=4){
      const yOff=Math.sin((px/w)*Math.PI*10 + i)*3;
      if(px===0) c.moveTo(x+px, yy+yOff); else c.lineTo(x+px, yy+yOff);
    }
    c.stroke();
  }
  c.restore();
}
function textOnArc(c,str,cx,cy,r,startAngle,angleStep,font,color){
  c.save();
  c.translate(cx,cy);
  c.rotate(startAngle);
  c.font=font; c.fillStyle=color; c.textAlign='center'; c.textBaseline='middle';
  for(const ch of str){
    c.save(); c.rotate(Math.PI/2); c.fillText(ch,0,-r); c.restore();
    c.rotate(angleStep);
  }
  c.restore();
}
function toMRZ(str,len){
  let s=(str||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9 ]/g,'');
  s=s.trim().replace(/\s+/g,'<');
  if(s.length>len) s=s.slice(0,len);
  return s.padEnd(len,'<');
}
function spaced(s){return s.split('').join('\u200a');}

/* ================= main draw ================= */
function draw(){
  ctx.clearRect(0,0,CW,CH);

  const bg=ctx.createLinearGradient(0,0,0,CH);
  bg.addColorStop(0,'#fffbe8'); bg.addColorStop(1,'#f5eed0');
  ctx.fillStyle=bg; ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle=ctx.createPattern(NOISE_TILE,'repeat'); ctx.fillRect(0,0,CW,CH);

  ctx.save();
  ctx.globalAlpha=.05; ctx.fillStyle='#0b6839';
  ctx.beginPath(); ctx.arc(800,560,230,0,Math.PI*2); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle='#fee101'; ctx.lineWidth=3;
  roundRect(ctx,26,26,CW-52,CH-52,20); ctx.stroke();
  ctx.strokeStyle='#064a28'; ctx.lineWidth=1;
  roundRect(ctx,36,36,CW-72,CH-72,16); ctx.stroke();
  ctx.restore();

  /* header band */
  const hg=ctx.createLinearGradient(0,0,CW,0);
  hg.addColorStop(0,'#064a28'); hg.addColorStop(.5,'#085c32'); hg.addColorStop(1,'#0b6839');
  ctx.fillStyle=hg;
  roundRect(ctx,50,50,CW-100,150,14); ctx.fill();
  drawGuilloche(ctx,60,60,CW-120,20,'#fee101',3);

  /* HH Goa logo */
  if(hhLogo){
    const logoSize=110;
    ctx.drawImage(hhLogo, 65, 125-logoSize/2, logoSize, logoSize);
  }else{
    ctx.save();
    ctx.translate(120,125);
    ctx.strokeStyle='#fee101'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(0,0,42,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#fee101';
    ctx.beginPath(); ctx.arc(0,-6,14,0,Math.PI*2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-30,16); ctx.quadraticCurveTo(-15,4,0,16); ctx.quadraticCurveTo(15,28,30,16);
    ctx.lineWidth=3; ctx.strokeStyle='#fee101'; ctx.stroke();
    ctx.font="700 12px 'Imbue', serif"; ctx.fillStyle='#fee101'; ctx.textAlign='center';
    ctx.fillText('HH',0,44);
    ctx.restore();
  }

  ctx.textAlign='left';
  ctx.fillStyle='#fee101';
  ctx.font="900 40px 'Imbue', serif";
  ctx.fillText('HACKER HOUSE',180,108);
  ctx.font="700 20px 'Noto Sans Devanagari', sans-serif";
  ctx.fillStyle='#ff66b8';
  ctx.fillText('गोवा · BUILDER ID',180,142);
  ctx.font="700 12px 'Victor Mono', monospace";
  ctx.fillStyle='#fffbe8'; ctx.globalAlpha=.9;
  ctx.fillText('TYPE · B    CODE · HHG26    NO. '+state.passportNo,180,170);
  ctx.globalAlpha=1;

  /* GOA badge — aligned with header text row */
  ctx.save();
  ctx.translate(CW-185,88);
  ctx.fillStyle='#ff0080';
  roundRect(ctx,0,0,100,60,10); ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=3; roundRect(ctx,0,0,100,60,10); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.textAlign='center';
  ctx.font="900 26px 'Imbue', serif";
  ctx.fillText('GOA',50,32);
  ctx.font="700 10px 'Victor Mono', monospace";
  ctx.fillText('2 0 2 6',50,50);
  ctx.restore();

  /* photo box */
  ctx.save();
  ctx.fillStyle='#00000022';
  roundRect(ctx,PB.x-6,PB.y-6,PB.w+12,PB.h+12,10); ctx.fill();
  ctx.strokeStyle='#fee101'; ctx.lineWidth=4;
  roundRect(ctx,PB.x-6,PB.y-6,PB.w+12,PB.h+12,10); ctx.stroke();

  ctx.save();
  roundRect(ctx,PB.x,PB.y,PB.w,PB.h,4);
  ctx.clip();
  if(state.img){
    const iw=state.img.width, ih=state.img.height;
    const rot=(state.rotation||0)%360;
    const is90or270=(rot===90||rot===270);
    const effW=is90or270?ih:iw;
    const effH=is90or270?iw:ih;

    const base=fitCover(effW,effH,PB.w,PB.h)*state.zoom;
    const dw=iw*base, dh=ih*base;
    const cx=PB.x+PB.w/2+state.offX;
    const cy=PB.y+PB.h/2+state.offY;

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate((rot*Math.PI)/180);
    ctx.drawImage(state.img, -dw/2, -dh/2, dw, dh);
    ctx.restore();

    ctx.fillStyle='rgba(11,104,57,.06)'; ctx.fillRect(PB.x,PB.y,PB.w,PB.h);
  }else{
    ctx.fillStyle='#e8dfc0'; ctx.fillRect(PB.x,PB.y,PB.w,PB.h);
    ctx.fillStyle='#8a8368'; ctx.font="14px 'Victor Mono', monospace"; ctx.textAlign='center';
    ctx.fillText('YOUR PHOTO', PB.x+PB.w/2, PB.y+PB.h/2);
  }
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle='#064a28'; ctx.lineWidth=3;
  const tks=[[PB.x-14,PB.y-14,1,1],[PB.x+PB.w+14,PB.y-14,-1,1],[PB.x-14,PB.y+PB.h+14,1,-1],[PB.x+PB.w+14,PB.y+PB.h+14,-1,-1]];
  tks.forEach(([x,y,dx,dy])=>{ ctx.beginPath(); ctx.moveTo(x,y+22*dy); ctx.lineTo(x,y); ctx.lineTo(x+22*dx,y); ctx.stroke(); });
  ctx.restore();

  /* stamp */
  ctx.save();
  ctx.translate(PB.x+PB.w-16, PB.y+PB.h-10);
  ctx.rotate(-0.26);
  ctx.globalAlpha=.88;
  ctx.strokeStyle='#ff0080'; ctx.fillStyle='#ff0080';
  ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(0,0,74,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,64,0,Math.PI*2); ctx.stroke();
  ctx.font="800 13px 'Imbue', serif"; ctx.textAlign='center';
  ctx.fillText('VERIFIED',0,-4);
  ctx.fillText('BUILDER',0,14);
  textOnArc(ctx,'★ HACKER HOUSE GOA 2026 ★ FRAME IN GOA ',0,0,52,-Math.PI/2, (Math.PI*2)/40,"700 9px 'Victor Mono', monospace",'#ff0080');
  ctx.globalAlpha=1;
  ctx.restore();

  /* data column */
  const dx=560, dw=440;
  const rows=[
    ['SURNAME / NAME', (document.getElementById('name').value||'YOUR NAME HERE').toUpperCase()],
    ['BUILDER TITLE', state.title],
    ['STACK / NATIONALITY', (document.getElementById('role').value||'BUILDER').toUpperCase()],
    ['DATE OF ISSUE', '28 OCT 2026'],
    ['PLACE OF ISSUE', 'GOA, INDIA'],
    ['ISSUING AUTHORITY', "2:47PM STUDIO"]
  ];
  let ry=300;
  rows.forEach(([label,val])=>{
    ctx.textAlign='left';
    ctx.font="700 12px 'Victor Mono', monospace";
    ctx.fillStyle='#ff0080';
    ctx.fillText(label, dx, ry);
    ctx.font="700 27px 'Imbue', serif";
    ctx.fillStyle='#0a2e1c';
    let v=val;
    while(ctx.measureText(v).width>dw && ctx.font.includes('27px')){ ctx.font="700 22px 'Imbue', serif"; }
    ctx.fillText(v, dx, ry+32);
    ctx.strokeStyle='rgba(11,104,57,.22)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(dx,ry+44); ctx.lineTo(dx+dw,ry+44); ctx.stroke();
    ry+=88;
  });

  /* fake QR */
  ctx.save();
  const qx=80, qy=900, qs=150;
  ctx.fillStyle='#0a2e1c'; ctx.fillRect(qx,qy,qs,qs);
  const cells=14, cell=qs/cells;
  let seed=(state.passportNo.length*7+(document.getElementById('name').value||'x').length*13);
  function rnd(){ seed=(seed*9301+49297)%233280; return seed/233280; }
  ctx.fillStyle='#fffbe8';
  for(let i=0;i<cells;i++)for(let j=0;j<cells;j++){
    if(rnd()>0.52) ctx.fillRect(qx+i*cell+1, qy+j*cell+1, cell-2, cell-2);
  }
  [[0,0],[cells-3,0],[0,cells-3]].forEach(([fx,fy])=>{
    ctx.fillStyle='#fffbe8'; ctx.fillRect(qx+fx*cell,qy+fy*cell,cell*3,cell*3);
    ctx.fillStyle='#0a2e1c'; ctx.fillRect(qx+fx*cell+cell*0.5,qy+fy*cell+cell*0.5,cell*2,cell*2);
    ctx.fillStyle='#fffbe8'; ctx.fillRect(qx+fx*cell+cell,qy+fy*cell+cell,cell,cell);
  });
  ctx.font="700 10px 'Victor Mono', monospace"; ctx.fillStyle='#ff0080'; ctx.textAlign='left';
  ctx.fillText('SCAN TO VERIFY', qx, qy+qs+20);
  ctx.restore();

  /* hologram seal */
  ctx.save();
  const hx=880, hy=975, hr=76;
  const holo=ctx.createRadialGradient(hx-20,hy-20,4,hx,hy,hr);
  holo.addColorStop(0,'#fffbe8'); holo.addColorStop(.35,'#fee101'); holo.addColorStop(.65,'#ff66b8'); holo.addColorStop(1,'#8fe0c2');
  ctx.globalAlpha=.88;
  ctx.fillStyle=holo; ctx.beginPath(); ctx.arc(hx,hy,hr,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
  ctx.strokeStyle='#064a28'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(hx,hy,hr,0,Math.PI*2); ctx.stroke();
  textOnArc(ctx,'★ OFFICIAL SEAL ★ HH GOA 2026 ★ ',hx,hy,58,-Math.PI/2,(Math.PI*2)/34,"700 8px 'Victor Mono', monospace",'#064a28');
  ctx.fillStyle='rgba(6,74,40,.82)';
  ctx.beginPath(); ctx.arc(hx,hy,30,0,Math.PI*2); ctx.fill();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font="900 24px 'Victor Mono', monospace";
  ctx.lineWidth=4; ctx.strokeStyle='#064a28';
  ctx.strokeText('2:47', hx, hy+1);
  ctx.fillStyle='#fee101';
  ctx.fillText('2:47', hx, hy+1);
  ctx.textBaseline='alphabetic';
  ctx.restore();

  /* MRZ */
  const name=(document.getElementById('name').value||'BUILDER').toUpperCase();
  const role=(document.getElementById('role').value||'GEN').toUpperCase();
  const nat3=(role.replace(/[^A-Z]/g,'').slice(0,3)||'GEN').padEnd(3,'X');
  const parts=name.trim().split(/\s+/);
  const surname=parts.length>1?parts[parts.length-1]:parts[0];
  const given=parts.length>1?parts.slice(0,-1).join(' '):'BUILDER';
  const line1='P<GOA'+toMRZ(surname+'<<'+given,39);
  const line2=toMRZ(state.passportNo.replace('-',''),9)+'4GOA'+nat3+'<261028M311031'+toMRZ('HHGOA26'+nat3,14)+'2';

  ctx.save();
  ctx.fillStyle='#f5eed0'; ctx.fillRect(60,1170,CW-120,120);
  ctx.strokeStyle='#fee101'; ctx.lineWidth=1.5; ctx.strokeRect(60,1170,CW-120,120);
  ctx.font="700 30px 'Victor Mono', monospace"; ctx.fillStyle='#0a2e1c'; ctx.textAlign='left';
  ctx.fillText(spaced(line1.slice(0,30)), 80, 1218);
  ctx.fillText(spaced(line2.slice(0,30)), 80, 1262);
  ctx.restore();

  /* footer bar */
  const fg=ctx.createLinearGradient(0,CH-100,CW,CH-100);
  fg.addColorStop(0,'#0b6839'); fg.addColorStop(.5,'#ff0080'); fg.addColorStop(1,'#fee101');
  ctx.fillStyle=fg;
  roundRect(ctx,50,CH-118,CW-100,68,14); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='left';
  ctx.font="700 20px 'Imbue', serif";
  ctx.fillText('GOA, INDIA · 28–31 OCT 2026', 76, CH-78);
  ctx.textAlign='right';
  ctx.font="700 16px 'Victor Mono', monospace";
  ctx.fillText('#FrameInGoa', CW-76, CH-78);

  scheduleShareBlobCache();
}

/* ================= share blob cache (keeps user-gesture alive for navigator.share) ================= */
let cachedShareBlob=null;
let shareBlobTimer=null;

function scheduleShareBlobCache(){
  if(shareBlobTimer) clearTimeout(shareBlobTimer);
  shareBlobTimer=setTimeout(()=>{
    canvas.toBlob(blob=>{ if(blob) cachedShareBlob=blob; }, 'image/png', 1);
  }, 120);
}

/* ================= interaction ================= */
const dropzone=document.getElementById('dropzone');
const fileInput=document.getElementById('fileInput');
const cameraCaptureInput=document.getElementById('cameraCaptureInput');
const thumb=document.getElementById('thumb');
const dzText=document.getElementById('dzText');
const statusEl=document.getElementById('status');
const zoomRow=document.getElementById('zoomRow');
const zoomSlider=document.getElementById('zoom');
const readyBadge=document.getElementById('readyBadge');

dropzone.addEventListener('click',()=>fileInput.click());
dropzone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')fileInput.click();});
['dragover','dragenter'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag');}));
dropzone.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) handleFile(f); });
fileInput.addEventListener('change',e=>{ const f=e.target.files[0]; if(f) handleFile(f); });
if(cameraCaptureInput){
  cameraCaptureInput.addEventListener('change',e=>{
    const f=e.target.files[0];
    if(f) handleFile(f);
    cameraCaptureInput.value='';
  });
}

function setImageSource(img, previewUrl){
  state.img=img; state.zoom=1; state.offX=0; state.offY=0; state.rotation=0;
  zoomSlider.value=100;
  zoomRow.style.display='flex';
  dzText.textContent='Tap to change photo';
  if(previewUrl){
    thumb.src=previewUrl; thumb.hidden=false;
  }
  readyBadge.style.display='inline-block';
  draw();
  statusEl.textContent='Looking sharp. Fill in your details →';
}

async function handleFile(file){
  statusEl.textContent='Reading photo…';
  try{
    const img=await loadImageFile(file);
    const url=URL.createObjectURL(file);
    setImageSource(img, url);
  }catch(err){
    statusEl.textContent='Could not read that file — try a JPG or PNG.';
  }
}

/* ================= webcam capture ================= */
const webcamBtn=document.getElementById('webcamBtn');
const webcamModal=document.getElementById('webcamModal');
const closeWebcamBtn=document.getElementById('closeWebcamBtn');
const cancelWebcamBtn=document.getElementById('cancelWebcamBtn');
const snapPhotoBtn=document.getElementById('snapPhotoBtn');
const flipCameraBtn=document.getElementById('flipCameraBtn');
const webcamVideo=document.getElementById('webcamVideo');
const webcamError=document.getElementById('webcamError');
const shutterFlash=document.getElementById('shutterFlash');

let webcamStream=null;
let currentFacingMode='user';

async function checkMultipleCameras(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.enumerateDevices) return;
  try{
    const devices=await navigator.mediaDevices.enumerateDevices();
    const videoDevices=devices.filter(d=>d.kind==='videoinput');
    if(videoDevices.length>1){
      flipCameraBtn.style.display='inline-flex';
    }
  }catch(e){}
}

async function startWebcam(){
  stopWebcam();
  webcamError.hidden=true;
  webcamError.textContent='';

  if(!window.isSecureContext){
    showWebcamError('Camera in the browser needs HTTPS. Use "Take Photo" on mobile (opens your phone camera) or upload a photo instead.');
    return;
  }

  const media=navigator.mediaDevices;
  if(!media||!media.getUserMedia){
    showWebcamError('Webcam access is not supported in this browser. Try Upload Photo or Take Photo on mobile.');
    return;
  }

  const attempts=[
    {video:{facingMode:currentFacingMode, width:{ideal:1280}, height:{ideal:1280}}, audio:false},
    {video:{facingMode:currentFacingMode}, audio:false},
    {video:true, audio:false}
  ];

  let lastErr=null;
  for(const constraints of attempts){
    try{
      webcamStream=await media.getUserMedia(constraints);
      webcamVideo.srcObject=webcamStream;

      if(currentFacingMode==='environment'){
        webcamVideo.classList.add('no-mirror');
      }else{
        webcamVideo.classList.remove('no-mirror');
      }

      await webcamVideo.play();
      checkMultipleCameras();
      return;
    }catch(err){
      lastErr=err;
    }
  }

  let msg='Could not access webcam.';
  if(lastErr){
    if(lastErr.name==='NotAllowedError'||lastErr.name==='PermissionDeniedError'){
      msg='Camera permission was denied. Allow camera access in your browser settings, or use Upload Photo.';
    }else if(lastErr.name==='NotFoundError'||lastErr.name==='DevicesNotFoundError'){
      msg='No camera found on this device.';
    }else if(lastErr.name==='NotReadableError'||lastErr.name==='TrackStartError'){
      msg='Camera is in use by another app. Close it and try again.';
    }else if(lastErr.name==='OverconstrainedError'){
      msg='Could not start camera with these settings. Try Upload Photo instead.';
    }
  }
  showWebcamError(msg);
}

function showWebcamError(msg){
  webcamError.textContent=msg;
  webcamError.hidden=false;
}

function stopWebcam(){
  if(webcamStream){
    webcamStream.getTracks().forEach(track=>track.stop());
    webcamStream=null;
  }
  if(webcamVideo){
    webcamVideo.srcObject=null;
  }
}

function openWebcamModal(){
  webcamModal.hidden=false;
  document.body.style.overflow='hidden';
  startWebcam();
}

function closeWebcamModal(){
  stopWebcam();
  webcamModal.hidden=true;
  document.body.style.overflow='';
}

function snapPhoto(){
  if(!webcamVideo||webcamVideo.readyState<2){
    showWebcamError('Camera is not ready yet. Please wait a moment.');
    return;
  }
  
  shutterFlash.classList.add('flash');
  setTimeout(()=>shutterFlash.classList.remove('flash'),200);

  const vw=webcamVideo.videoWidth||640;
  const vh=webcamVideo.videoHeight||480;
  
  const offCanvas=document.createElement('canvas');
  offCanvas.width=vw;
  offCanvas.height=vh;
  const octx=offCanvas.getContext('2d');
  
  if(currentFacingMode==='user'){
    octx.translate(vw,0);
    octx.scale(-1,1);
  }
  
  octx.drawImage(webcamVideo,0,0,vw,vh);
  
  const dataUrl=offCanvas.toDataURL('image/png');
  const img=new Image();
  img.onload=()=>{
    setImageSource(img,dataUrl);
    closeWebcamModal();
  };
  img.src=dataUrl;
}

webcamBtn.addEventListener('click',()=>{
  if(isMobileDevice() || !window.isSecureContext){
    if(cameraCaptureInput){
      cameraCaptureInput.click();
      statusEl.textContent='Opening your phone camera…';
    }else{
      openWebcamModal();
    }
    return;
  }
  openWebcamModal();
});
closeWebcamBtn.addEventListener('click',closeWebcamModal);
cancelWebcamBtn.addEventListener('click',closeWebcamModal);
snapPhotoBtn.addEventListener('click',snapPhoto);

flipCameraBtn.addEventListener('click',()=>{
  currentFacingMode=currentFacingMode==='user'?'environment':'user';
  startWebcam();
});

webcamModal.addEventListener('click',e=>{
  if(e.target===webcamModal) closeWebcamModal();
});

zoomSlider.addEventListener('input',()=>{ state.zoom=zoomSlider.value/100; draw(); });

const rotateBtn=document.getElementById('rotateBtn');
if(rotateBtn){
  rotateBtn.addEventListener('click',()=>{
    state.rotation=((state.rotation||0)+90)%360;
    draw();
  });
}

function canvasPoint(evt){
  const rect=canvas.getBoundingClientRect();
  const scaleX=CW/rect.width, scaleY=CH/rect.height;
  return {x:(evt.clientX-rect.left)*scaleX, y:(evt.clientY-rect.top)*scaleY};
}
canvas.addEventListener('pointerdown',e=>{
  if(!state.img) return;
  state.dragging=true;
  const p=canvasPoint(e); state.lastX=p.x; state.lastY=p.y;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  if(!state.dragging) return;
  const p=canvasPoint(e);
  state.offX += (p.x-state.lastX); state.offY += (p.y-state.lastY);
  state.lastX=p.x; state.lastY=p.y;
  draw();
});
['pointerup','pointerleave','pointercancel'].forEach(ev=>canvas.addEventListener(ev,()=>state.dragging=false));

['name','role'].forEach(id=>document.getElementById(id).addEventListener('input',draw));

const titleBox=document.getElementById('titleBox');
function refreshTitle(){ state.title=generateTitle(); titleBox.textContent=state.title; draw(); }
document.getElementById('rerollBtn').addEventListener('click',refreshTitle);
titleBox.textContent=state.title;

function exportCanvas(cb){ canvas.toBlob(blob=>cb(blob), 'image/png', 1); }

document.getElementById('downloadBtn').addEventListener('click',()=>{
  statusEl.textContent='Preparing your builder ID…';
  exportCanvas(blob=>{
    const name=(document.getElementById('name').value||'builder').toLowerCase().replace(/[^a-z0-9]+/g,'-');
    downloadBlob(blob, `hhgoa2026-builder-id-${name||'x'}.png`);
    statusEl.textContent='Downloaded. Now go post it → #FrameInGoa';
  });
});

async function copyImageToClipboard(blob){
  try{
    if(!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write)) return false;
    await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
    return true;
  }catch(err){ return false; }
}

async function copyTextToClipboard(str){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(str);
      return true;
    }
  }catch(err){}
  return false;
}

function shareBuilderIdToX(blob, text){
  // The OS-level "share sheet" (navigator.share) is only worth using on
  // phones/tablets, where it's the one mechanism that can hand X both the
  // image and the caption together. On desktop it opens a generic OS share
  // dialog (not X itself) and would stop us from reliably landing on X, so
  // desktop always uses the direct compose-window flow in handleShareResult.
  if(!isMobileDevice() || !navigator.share){
    return Promise.resolve('fallback');
  }

  const file=new File([blob], 'hhgoa2026-builder-id.png', {type:'image/png'});

  if(navigator.canShare && !navigator.canShare({files:[file]})){
    return Promise.resolve('fallback');
  }

  return navigator.share({files:[file], text})
    .then(()=>'shared-full')
    .catch(err=>{
      if(err && err.name==='AbortError') return 'cancelled';

      return navigator.share({files:[file]})
        .then(async()=>{
          await copyTextToClipboard(text);
          return 'shared-image';
        })
        .catch(err2=>{
          if(err2 && err2.name==='AbortError') return 'cancelled';
          return 'fallback';
        });
    });
}

function handleShareResult(result, blob, text, fileBase, desktopWin){
  if(result==='shared-full'){
    statusEl.textContent='Pick X from the share menu — image and caption are ready.';
    return;
  }
  if(result==='shared-image'){
    statusEl.textContent='Image shared! Caption copied — paste in X if it is missing.';
    return;
  }
  if(result==='cancelled'){
    if(desktopWin && !desktopWin.closed) desktopWin.close();
    statusEl.textContent='Share cancelled.';
    return;
  }

  // Desktop fallback: reuse the tab opened synchronously on click so it
  // isn't blocked as a popup, while we finish copying the image.
  copyImageToClipboard(blob).then(copied=>{
    openXComposer(text, desktopWin);
    if(copied){
      statusEl.textContent='X opened with your caption — press Ctrl/Cmd+V in the compose box to attach the image.';
    }else{
      downloadBlob(blob, `hhgoa2026-builder-id-${fileBase}.png`);
      statusEl.textContent='X opened with your caption — the image also downloaded, attach it there.';
    }
  });
}

function finishMobileShare(blob, text, fileBase){
  cachedShareBlob=blob;
  downloadBlob(blob, `hhgoa2026-builder-id-${fileBase}.png`);
  copyTextToClipboard(text);
  statusEl.textContent='X opened with your caption — attach the Builder ID from your downloads/gallery.';
}

document.getElementById('shareBtn').addEventListener('click',()=>{
  const name=document.getElementById('name').value||'a builder';
  const text=`Just picked up my HH Goa 2026 Builder ID 🌴🛂 ${name!=='a builder'?'— '+name:''} heading to Goa, 28–31 Oct. Make yours 👉 @247pmstudio #FrameInGoa #HackerHouseGoa #HHGoa2026`;
  const fileBase=(document.getElementById('name').value||'builder').toLowerCase().replace(/[^a-z0-9]+/g,'-')||'builder';

  if(isMobileDevice()){
    // Mobile browsers block redirects unless they happen inside the tap
    // handler — open X immediately, then export/download the image.
    openXComposer(text);
    statusEl.textContent='Opening X with your caption…';

    if(cachedShareBlob){
      finishMobileShare(cachedShareBlob, text, fileBase);
      return;
    }

    statusEl.textContent='Preparing image…';
    exportCanvas(blob=>finishMobileShare(blob, text, fileBase));
    return;
  }

  // On desktop, open the destination tab RIGHT NOW, synchronously inside
  // this click handler. If we wait until after the async image export /
  // clipboard work finishes, browsers no longer consider it a trusted
  // user gesture and silently block the popup — that's why "Post on X"
  // wasn't opening anything on its own before.
  const desktopWin=window.open('', '_blank');

  const proceed=(blob)=>{
    cachedShareBlob=blob;
    shareBuilderIdToX(blob, text).then(result=>{
      handleShareResult(result, blob, text, fileBase, desktopWin);
    });
  };

  if(cachedShareBlob){
    statusEl.textContent='Opening share…';
    proceed(cachedShareBlob);
    return;
  }

  statusEl.textContent='Preparing share…';
  exportCanvas(proceed);
});

if(document.fonts && document.fonts.ready){ document.fonts.ready.then(draw); }
draw();
window.addEventListener('resize',draw);

/* ================= check hype video modal ================= */
const hypeModal=document.getElementById('hypeModal');
const hypeVideo=document.getElementById('hypeVideo');
const checkHypeBtn=document.getElementById('checkHypeBtn');
const closeHypeBtn=document.getElementById('closeHypeBtn');
const hypeMuteBtn=document.getElementById('hypeMuteBtn');
const hypeUnmutedIcon=hypeMuteBtn?.querySelector('.icon-unmuted');
const hypeMutedIcon=hypeMuteBtn?.querySelector('.icon-muted');

function updateHypeMuteIcon(){
  if(!hypeVideo||!hypeUnmutedIcon||!hypeMutedIcon||!hypeMuteBtn) return;
  const muted=hypeVideo.muted;
  hypeUnmutedIcon.style.display=muted?'none':'block';
  hypeMutedIcon.style.display=muted?'block':'none';
  hypeMuteBtn.classList.toggle('is-muted', muted);
  hypeMuteBtn.setAttribute('aria-label', muted ? 'Unmute video' : 'Mute video');
}

async function openHypeModal(){
  if(!hypeModal||!hypeVideo) return;
  hypeModal.hidden=false;
  document.body.style.overflow='hidden';
  hypeVideo.currentTime=0;
  hypeVideo.muted=false;
  updateHypeMuteIcon();
  try{
    await hypeVideo.play();
  }catch(err){
    hypeVideo.muted=true;
    updateHypeMuteIcon();
    try{ await hypeVideo.play(); }catch(e){}
  }
}

function closeHypeModal(){
  if(!hypeModal||!hypeVideo) return;
  hypeVideo.pause();
  hypeModal.hidden=true;
  document.body.style.overflow='';
}

checkHypeBtn?.addEventListener('click',openHypeModal);
closeHypeBtn?.addEventListener('click',closeHypeModal);
hypeMuteBtn?.addEventListener('click',()=>{
  if(!hypeVideo) return;
  hypeVideo.muted=!hypeVideo.muted;
  updateHypeMuteIcon();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && hypeModal && !hypeModal.hidden) closeHypeModal();
});

if(isMobileDevice() && webcamBtn){
  const label=webcamBtn.lastChild;
  if(label && label.nodeType===Node.TEXT_NODE){
    label.textContent=' Take Photo with Camera';
  }
}