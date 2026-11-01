const fs=require('node:fs'),path=require('node:path');
const {makeRingPng}=require('../core/trayicon');
const sizes=[16,24,32,48,64,128,256],images=sizes.map(size=>makeRingPng(size,.72,{theme:'dark'}));
const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
let offset=header.length;
for(let i=0;i<sizes.length;i++){
 const at=6+i*16;header[at]=sizes[i]===256?0:sizes[i];header[at+1]=header[at];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(images[i].length,at+8);header.writeUInt32LE(offset,at+12);offset+=images[i].length;
}
fs.mkdirSync(path.join(__dirname,'../build'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../build/icon.ico'),Buffer.concat([header,...images]));
console.log('App icon: existing progress ring, seven Windows sizes.');
