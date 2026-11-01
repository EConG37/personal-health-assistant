// Pure reminder decisions shared by the desktop timer and its tests.
function stepReminder({status,now=Date.now(),mutedUntil=0,lastRemindAt=0,count=0,active=false,gapMin=60}){
 const allowed=!!status.inWindow&&!!status.due&&!status.goalMet&&!status.paused&&now>=mutedUntil;
 if(!allowed)return {active:false,count:0,lastRemindAt,triggered:false};
 if(now-lastRemindAt<gapMin*60000)return {active,count,lastRemindAt,triggered:false};
 return {active:true,count:count+1,lastRemindAt:now,triggered:true};
}
function motionEnabled(mode='system',systemReduced=false){return mode==='full'||mode!=='reduced'&&!systemReduced;}
module.exports={stepReminder,motionEnabled};
