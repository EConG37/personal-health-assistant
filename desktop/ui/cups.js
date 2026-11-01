/* Approved B artwork supplies the frosted shell; water remains a live layer. */
((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.cupVisual=api;})(typeof window==='object'?window:globalThis,()=>{
 let serial=0;
 const asset='assets/cups-b-frosted-empty.png';
 const shapes={
  tumbler:{name:'小圆杯',scale:.235,anchorX:280,anchorY:879,crop:[64,475,434,411],rawTop:575,rawBottom:793,cx:84,rx:48,body:'M166 537C250 566 355 580 457 566C455 626 440 707 414 755Q399 791 365 800C285 815 188 791 125 762Q104 747 107 707C110 651 133 587 166 537Z'},
  mug:{name:'带把杯',scale:.265,anchorX:775,anchorY:879,crop:[505,428,552,455],rawTop:550,rawBottom:835,cx:79,rx:49,body:'M622 494C696 525 791 548 886 534C886 625 874 719 847 782Q823 835 757 841C685 845 609 818 578 776C542 728 566 598 606 521Z'},
  bottle:{name:'运动水瓶',scale:.235,anchorX:1290,anchorY:889,crop:[1058,98,464,800],rawTop:350,rawBottom:840,cx:80,rx:49,body:'M1230 285C1305 284 1389 305 1409 360Q1430 413 1415 516L1365 787Q1354 846 1286 854C1211 862 1138 841 1116 801Q1103 773 1114 707L1165 405Q1178 332 1230 285Z'}
 };
 for(const s of Object.values(shapes)){s.x=90-s.anchorX*s.scale;s.y=198-s.anchorY*s.scale;s.top=s.y+s.rawTop*s.scale;s.bottom=s.y+s.rawBottom*s.scale;}
 const clamp=p=>Math.max(0,Math.min(1,Number.isFinite(p)?p:0));
 const shapeFor=ml=>Number(ml)<=275?'tumbler':Number(ml)<=400?'mug':'bottle';
 const waterY=(ml,progress)=>{const s=shapes[shapeFor(ml)];return s.bottom-clamp(progress)*(s.bottom-s.top);};
 function render(cls='',ml=250,progress=0){
  ml=Number.isFinite(Number(ml))?Math.round(Math.max(50,Math.min(2000,Number(ml)))):250;
  cls=String(cls).replace(/[^a-z0-9 _-]/gi,'');
  const key=shapeFor(ml),s=shapes[key],p=clamp(progress),y=waterY(ml,p),id='vessel-'+(++serial),[cx,cy,cw,ch]=s.crop;
  const matrix=`matrix(${s.scale} 0 0 ${s.scale} ${s.x} ${s.y})`,surfaceX=s.cx+(s.bottom-y)*.17;
  return `<svg class="bottle-art cup-visual ${cls}" viewBox="0 0 180 210" width="180" height="210" aria-hidden="true" data-cup-shape="${key}" data-cup-ml="${ml}" data-fill-progress="${p}" data-water-y="${y}" data-artwork="b-frosted-tilted" data-tilt="10"><defs>
   <filter id="${id}-alpha" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncA type="table" tableValues="0 0 .27 .54 .8 1"/></feComponentTransfer></filter>
   <clipPath id="${id}-sprite"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" transform="${matrix}"/></clipPath>
   <clipPath id="${id}-inside"><path d="${s.body}" transform="${matrix}"/></clipPath>
   <image id="${id}-shell" href="${asset}" x="${s.x}" y="${s.y}" width="${1536*s.scale}" height="${1024*s.scale}" clip-path="url(#${id}-sprite)" filter="url(#${id}-alpha)"/>
   <mask id="${id}-glass" x="0" y="0" width="180" height="210" maskUnits="userSpaceOnUse" mask-type="alpha"><use href="#${id}-shell"/></mask>
   <linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#9be8c5" stop-opacity=".58"/><stop offset=".4" stop-color="#75cfa9" stop-opacity=".74"/><stop offset="1" stop-color="#52ac8a" stop-opacity=".82"/></linearGradient>
  </defs><use href="#${id}-shell"/>
  <g clip-path="url(#${id}-inside)" mask="url(#${id}-glass)"><g class="cup-liquid" transform="translate(0 ${y})" style="opacity:${p===0?0:1}"><rect x="0" y="0" width="180" height="210" fill="url(#${id}-water)"/><ellipse class="cup-water-surface" cx="${surfaceX}" cy="0" rx="${s.rx}" ry="3.4" fill="#d8ffe9" fill-opacity=".38" stroke="#edfff5" stroke-opacity=".9" stroke-width="1.1"/></g></g></svg>`;
 }
 const motionEnabled=(mode='system',systemReduced=false)=>mode==='full'||mode!=='reduced'&&!systemReduced;
 return {render,waterY,shapeFor,shapes,clamp,motionEnabled};
});
