const {pathToFileURL}=require('node:url');
const {parseBaseUrl}=require('./feishu-app');
const {sourceUrlAllowed}=require('./dishes');
function trustedRenderer(event,webContents,entryFile){
 return !!webContents && !webContents.isDestroyed() && event.sender===webContents &&
  event.senderFrame===webContents.mainFrame && event.senderFrame?.url===pathToFileURL(entryFile).href;
}
function externalUrlAllowed(value,{kind='source'}={}){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
  if(kind==='base'){parseBaseUrl(value);return true;}
  if(kind==='login')return /(^|\.)(feishu\.cn|larksuite\.com|larkoffice\.com)$/.test(url.hostname);
  return sourceUrlAllowed(value);
 }catch{return false;}
}
module.exports={trustedRenderer,externalUrlAllowed};
