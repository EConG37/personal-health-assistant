const assert=require('node:assert/strict');
const {drawRing,COLORS,DARK_COLORS,trayTooltip}=require('../core/trayicon');
const luminance=c=>{const v=[c.r,c.g,c.b].map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const [theme,palette,bg] of [['light',COLORS,{r:245,g:245,b:245}],['dark',DARK_COLORS,{r:30,g:30,b:30}]]){
 for(const color of [palette.mid,palette.behind,palette.done])assert(contrast(color,bg)>3,'Progress must contrast against the taskbar');
 for(const size of [16,32]){
  const amounts=[0,.25,.5,.75,1].map(p=>{
   const pixels=drawRing(size,p,{theme,state:'ontrack'});let colored=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]===palette.mid.r&&pixels[i+1]===palette.mid.g&&pixels[i+2]===palette.mid.b&&pixels[i+3]>127)colored++;
   return colored;
  });
  assert.equal(amounts[0],0);for(let i=1;i<amounts.length;i++)assert(amounts[i]>amounts[i-1],'Larger water amounts must visibly increase the filled arc');
  assert.deepEqual(drawRing(size,-1,{theme}),drawRing(size,0,{theme}));assert.deepEqual(drawRing(size,2,{theme}),drawRing(size,1,{theme}));
 }
}
assert(trayTooltip({progress:.4,drunk:1000,target:2500}).includes('40% · 1000 / 2500 ml'));
assert(!trayTooltip({progress:0,drunk:500,target:0,paused:true}).includes('/ 0'));
console.log('Tray PASS: visible progress at 16/32px on light/dark taskbars, monotonic amounts, clamped progress, percentage/ml tooltip.');
