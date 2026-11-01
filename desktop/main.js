/**
 * 主进程：托盘常驻 + 静默分级提醒。
 *
 * 提醒策略是这个 App 的核心论点：
 *   默认不发任何系统通知，只改托盘图标颜色（落后变琥珀）。
 *   用户抬眼就能看到，但不会被弹窗打断——这才叫「主动」而不是「打扰」。
 *   只有用户主动把提醒方式改成 notify，才会在连续两次静默提醒后再升级到系统通知。
 */

const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen, shell, Notification, clipboard, safeStorage, systemPreferences, nativeTheme } = require('electron');
const path = require('node:path');

const { Store, todayKey } = require('../core/store');
const { waterStatus, computeIntake, reminderCopy, goalCopy, dailyVerdict, weightCheck } = require('../core/rules');
const { buildDayPlan, planFoodIds } = require('../core/recommend');
const { trustedRenderer,externalUrlAllowed } = require('../core/security');
const { loginItemOptions } = require('../core/launch');
const loginOptions=()=>loginItemOptions({isPackaged:app.isPackaged,portableExecutable:process.env.PORTABLE_EXECUTABLE_FILE,executable:process.execPath,appPath:app.getAppPath()});
const { makeRingPng, trayTooltip } = require('../core/trayicon');
const {taskbarTheme}=require('./tray-theme');
const {stepReminder,motionEnabled}=require('../core/reminders');
const {attachPanelLifecycle}=require('./panel-lifecycle');
const { FOODS } = require('../core/foods');
const { GOALS, ALLERGIES, CONDITIONS } = require('../core/profile');
const { FeishuSync } = require('../core/sync');
const { CredentialVault,FeishuAppTransport,parseBaseUrl }=require('../core/feishu-app');
const { buildMealDeck,choiceSummary,activeChoices,takeawayBrief,MEITUAN_ENTRY,foodProfileKey,SLOTS }=require('../core/meal-deck');
let vault=null;
let activeMealSlot='lunch';
const deckCache=new Map();
function makeSync(){
  let credentials=null,error='';
  if(store.data.sync.provider==='app')try{credentials=vault.read();}catch(err){error=err.message;}
  const connection=new FeishuSync(store,{credentials});connection.error=error;return connection;
}
function getDeck(slot=activeMealSlot){
 const cardState=store.today().cardState?.[slot]||{nonce:0,revealed:[]};
 const key=`${todayKey()}|${slot}|${cardState.nonce}|${foodProfileKey(store.profile)}`;
 if(!deckCache.has(key)){if(deckCache.size>20)deckCache.clear();deckCache.set(key,buildMealDeck({profile:store.profile,date:todayKey(),slot,nonce:cardState.nonce}));}
 return {...deckCache.get(key),slot,nonce:cardState.nonce,revealed:cardState.revealed||[]};
}

const TICK_MS = 30 * 1000;
const ICON_SIZE = process.platform==='darwin'?18:32;

let tray = null;
let win = null;
let store = null;
let sync = null;
let syncTimer = null;
app.setName('uric-acid-companion'); // Keep the existing user-data location after packaging.
const releaseCheck=app.isPackaged&&process.argv.includes('--self-test');
const panelTest=!app.isPackaged&&process.argv.includes('--verify-panel-only');
const uiTest = !app.isPackaged&&(process.argv.includes('--verify-ui')||panelTest);
if (uiTest||releaseCheck) {
  app.setPath('userData', require('fs').mkdtempSync(path.join(require('os').tmpdir(), releaseCheck?'health-release-check-':'health-ui-')));
  app.disableHardwareAcceleration();
}

let mutedUntil = 0;
let remindCount = 0;
let lastRemindAt = 0;
let pulseTimer = null;
let realAlertActive=false,pulseActive=false,pulseLit=false,pulseAnimated=null;
let previewUntil=0,previewTimer=null;
let tickTimer = null;
let lastStatus = null;

let planCache = null; // { date, nonce, plan }
let planNonce = 0;
let celebratedOn = null;

let panelLifecycle=null;
let autoHideInTest=false;

const iconCache = new Map();
let trayColorTheme=nativeTheme.shouldUseDarkColors?'dark':'light';
async function refreshTrayTheme(){
 trayColorTheme=await taskbarTheme(nativeTheme.shouldUseDarkColors?'dark':'light');iconCache.clear();
 if(tray&&!tray.isDestroyed()&&lastStatus)tray.setImage(iconFor(lastStatus,false,pulseActive&&pulseLit));
}
nativeTheme.on('updated',refreshTrayTheme);

// ------------------------------------------------------------------ 图标

function stateOfStatus(s) {
  if (s.goalMet) return 'done';
  // 用「是否落后于今天的节奏」判断，而不是绝对进度。
  // 早上 9 点喝到 20% 是超前，用绝对进度会误判成落后。
  return s.due ? 'behind' : 'ontrack';
}

function iconFor(status, dim = false, alert=false) {
  const pct = Math.round(status.progress * 100);
  const state = stateOfStatus(status);
  const key = `${pct}|${state}|${dim ? 1 : 0}|${alert?1:0}|${trayColorTheme}`;
  if (!iconCache.has(key)) {
    const buf = makeRingPng(ICON_SIZE, status.progress, { state, dim,alert,theme:trayColorTheme });
    const icon=nativeImage.createFromBuffer(buf);
    if(process.platform==='darwin')icon.addRepresentation({scaleFactor:2,buffer:makeRingPng(ICON_SIZE*2,status.progress,{state,dim,alert,theme:trayColorTheme})});
    iconCache.set(key,icon);
  }
  return iconCache.get(key);
}

function stopPulse(){
 if(pulseTimer)clearInterval(pulseTimer);pulseTimer=null;pulseActive=false;pulseLit=false;pulseAnimated=null;
 if(tray&&lastStatus)tray.setImage(iconFor(lastStatus));
}
function systemReducedMotion(){try{return systemPreferences.getAnimationSettings().prefersReducedMotion;}catch{return true;}}
function reminderPresentation(status=lastStatus){
 const preview=Date.now()<previewUntil;
 const real=realAlertActive&&status?.due&&status.inWindow&&!status.goalMet&&!status.paused&&Date.now()>=mutedUntil;
 return {active:!!(preview||real),preview};
}
function pulse(active){
 if(!active){stopPulse();return;}
 const animated=motionEnabled(store.profile.motionMode,systemReducedMotion());
 if(pulseActive&&pulseAnimated===animated)return;
 if(pulseTimer)clearInterval(pulseTimer);pulseTimer=null;pulseActive=true;pulseLit=true;pulseAnimated=animated;
 if(tray&&lastStatus)tray.setImage(iconFor(lastStatus,false,true));
 if(animated)pulseTimer=setInterval(()=>{pulseLit=!pulseLit;if(tray&&lastStatus)tray.setImage(iconFor(lastStatus,false,pulseLit));},700);
}

function tick(){
 const status=waterStatus({profile:{...store.profile,targetWaterMl:store.effectiveWaterTarget},day:store.today(),now:new Date()});
 lastStatus=status;
 const next=stepReminder({status,mutedUntil,lastRemindAt,count:remindCount,active:realAlertActive,gapMin:store.profile.remindGapMin||60});
 realAlertActive=next.active;remindCount=next.count;lastRemindAt=next.lastRemindAt;
 pulse(reminderPresentation(status).active);
 if(tray){
  tray.setImage(iconFor(status,false,pulseActive&&pulseLit));
  tray.setToolTip(trayTooltip(status,reminderPresentation(status).preview?'提醒样式预览':realAlertActive?'该喝水了，红点提醒中':status.goalMet?'已达标':status.paused?'请先确认每日饮水目标':'节奏正常'));
 }
 if(win&&!win.isDestroyed()&&win.isVisible())win.webContents.send('hh:status',buildState());
 if(status.goalMet&&celebratedOn!==todayKey()){
  celebratedOn=todayKey();if(store.profile.notifyMode!=='silent'){const g=goalCopy();new Notification({title:g.title,body:g.body,silent:true}).show();}
 }
 if(next.triggered&&store.profile.notifyMode!=='silent'&&remindCount>2){const copy=reminderCopy(status,3);const n=new Notification({title:copy.title,body:copy.body,silent:true});n.on('click',()=>showWindow());n.show();}
}

// ------------------------------------------------------------------ 窗口

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  const width = 400;
  const height = Math.min(760, workArea.height - 24);

  win = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 12,
    y: workArea.y + workArea.height - height - 12,
    frame: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#f1f7f1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      backgroundThrottling: !uiTest
    }
  });

  win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  win.webContents.setWindowOpenHandler(({url})=>{
    if(externalUrlAllowed(url))shell.openExternal(url).catch(()=>{});
    return {action:'deny'};
  });
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  win.webContents.session.setPermissionCheckHandler(()=>false);
  win.webContents.session.on('will-download',event=>event.preventDefault());

  panelLifecycle=attachPanelLifecycle(win,{enabled:()=>!(uiTest||releaseCheck)||autoHideInTest});

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win || win.isDestroyed()) return;
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;
  if(process.platform==='darwin'&&tray){
    const anchor=tray.getBounds(),area=screen.getDisplayMatching(anchor).workArea,bounds=win.getBounds();
    win.setPosition(Math.round(Math.max(area.x,Math.min(area.x+area.width-bounds.width,anchor.x+anchor.width/2-bounds.width/2))),Math.max(area.y,Math.min(area.y+area.height-bounds.height,anchor.y+anchor.height+8)));
  }else win.setPosition(workArea.x + workArea.width - win.getBounds().width - 12, workArea.y + workArea.height - win.getBounds().height - 12);
  // 打开前先刷一次，避免面板显示的是上次关闭时的旧数据
  tick();
  panelLifecycle?.cancel();
  win.show();
  win.focus();
  panelLifecycle?.watch();
  win.webContents.send('hh:status',buildState());
}

function toggleWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) win.hide();
  else showWindow();
}

// ------------------------------------------------------------------ 状态组装

function getPlan() {
  const today = todayKey();
  if (!planCache || planCache.date !== today || planCache.nonce !== planNonce) {
    planCache = {
      date: today,
      nonce: planNonce,
      plan: buildDayPlan({
        date: today,
        recentIds: store.recentFoodIds(2),
        weightKg: store.profile.weightKg,
        profile: store.profile,
        nonce: planNonce
      })
    };
  }
  return planCache.plan;
}

function buildState() {
  const today = store.today();
  const status = waterStatus({
    profile: { ...store.profile, targetWaterMl: store.effectiveWaterTarget },
    day: today,
    now: new Date()
  });
  const foodsById = Object.fromEntries(FOODS.map((f) => [f.id, f]));
  const intake = computeIntake(today.meals, foodsById);
  const weights = store.data.weights;
  const wCheck = weights.length >= 2 ? weightCheck(weights, weights[weights.length - 1].kg) : null;

  return {
    profile: store.profile,
    target: store.effectiveWaterTarget,
    today: { date:todayKey(), water: today.water, meals: today.meals, logs: today.logs.length },
    deck:getDeck(),
    mealSelection:choiceSummary(today,store.profile),
    status,
    reminder:reminderPresentation(status),
    systemReducedMotion:systemReducedMotion(),
    plan: getPlan(),
    week: store.recentDays(7).map((d) => ({ date: d.date, water: d.water || 0 })),
    streak: store.streak(),
    intake,
    weight: wCheck,
    verdict: dailyVerdict({ waterStatus: status, intake, weight: wCheck, goals:store.profile.goals }),
    catalog: { goals:GOALS, allergies:ALLERGIES, conditions:CONDITIONS, foods:FOODS.map(f=>({id:f.id,name:f.name,cat:f.cat})) },
    sync: sync ? sync.state() : {},
    mutedUntil,
    loginItem: app.getLoginItemSettings(loginOptions()).openAtLogin
  };
}

// ------------------------------------------------------------------ 托盘菜单

function buildMenu() {
  const status = lastStatus;
  const quietLabel = Date.now() < mutedUntil ? '恢复提醒' : '安静一会儿';

  return Menu.buildFromTemplate([
    { label: status ? `今日 ${status.drunk} / ${status.target} ml` : '加载中…', enabled: false },
    { type: 'separator' },
    { label: '打开面板', click: showWindow },
    { label: `记一杯（${store.profile.cupMl||250}ml）`, click: () => { store.addWater(store.profile.cupMl||250);remindCount=0;realAlertActive=false;lastRemindAt=Date.now();previewUntil=0;tick(); } },
    { label: `记半杯（${Math.round((store.profile.cupMl||250)/2)}ml）`, click: () => { store.addWater(Math.round((store.profile.cupMl||250)/2));remindCount=0;realAlertActive=false;lastRemindAt=Date.now();previewUntil=0;tick(); } },
    { label: '撤销上一次', click: () => { store.undoLastWater(); tick(); } },
    { type: 'separator' },
    { label: quietLabel, click: () => { mutedUntil = Date.now() < mutedUntil ? 0 : Date.now() + 2 * 3600e3;previewUntil=0;tick(); } },
    {
      label: '今天不再提醒',
      click: () => {
        const end = new Date();
        end.setHours(23, 59, 0, 0);
        mutedUntil = end.getTime();
        previewUntil=0;
        tick();
      }
    },
    { type: 'separator' },
    {
      label: '开机自启',
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginOptions(),openAtLogin: item.checked })
    },
    { label: '打开数据目录', click: () => shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
}

function createTray() {
  const boot = waterStatus({
    profile: { ...store.profile, targetWaterMl: store.effectiveWaterTarget },
    day: store.today(),
    now: new Date()
  });
  lastStatus = boot;
  tray = new Tray(iconFor(boot));
  tray.setToolTip('个人健康助手');
  tray.on('click', toggleWindow);
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
  tick();
}

// ------------------------------------------------------------------ IPC

function registerIpc() {
  const handle=(channel,handler)=>ipcMain.handle(channel,(event,...args)=>{
    if(!trustedRenderer(event,win?.webContents,path.join(__dirname,'ui','index.html')))throw new Error('请求来源无效');
    return handler(event,...args);
  });
  handle('hh:getState', () => buildState());

  handle('hh:addWater', (_e, ml) => {
    const v = Math.max(0, Math.min(2000, Number(ml) || 0));
    if (v > 0) {
      store.addWater(v);
      remindCount = 0;
      realAlertActive=false;previewUntil=0;lastRemindAt=Date.now();
    }
    tick();
    return buildState();
  });

  handle('hh:undoWater', () => {
    store.undoLastWater();
    tick();
    return buildState();
  });

  handle('hh:setProfile', (_e, patch) => {
    store.setProfile(patch);
    planNonce++; // 设置更新后重新匹配指南菜品
    tick();
    return buildState();
  });

  handle('hh:logWeight', (_e, kg) => {
    store.logWeight(Number(kg));
    tick();
    return buildState();
  });

  handle('hh:regenerate', () => {
    planNonce++;
    return buildState();
  });

  handle('hh:logMeal', (_e, slot) => {
    const meal=activeChoices(store.today(),store.profile)[slot];
    if(!meal)throw new Error('请先翻牌并确认这餐的搭配');
    store.logMeal({slot,items:meal.items,source:'cards'});
    return buildState();
  });

  handle('hh:logManualMeal', (_e, input) => {
    store.logManualMeal(input);
    return buildState();
  });

  handle('hh:mealAction',(_e,action,slot,id)=>{
    if(!SLOTS[slot])throw new Error('餐次无效');activeMealSlot=slot;
    const deck=getDeck(slot);
    if(action==='slot')return buildState();
    if(action==='shuffle')store.setCardState(slot,{nonce:deck.nonce+1,revealed:[]});
    else if(action==='reveal-all')store.setCardState(slot,{nonce:deck.nonce,revealed:deck.cards.map(c=>c.id)});
    else {
      const card=deck.cards.find(c=>c.id===id);if(!card)throw new Error('这张牌已更新，请重新翻开');
      if(action==='reveal'){if(!deck.revealed.includes(id))store.setCardState(slot,{nonce:deck.nonce,revealed:[...deck.revealed,id]});}
      else if(action==='choose'){if(!deck.revealed.includes(id))throw new Error('先翻开查看这份搭配');store.chooseMeal(slot,card);}
      else throw new Error('翻牌操作无效');
    }
    return buildState();
  });
  handle('hh:takeaway',async(_e,action,options)=>{
    const text=takeawayBrief({...options,profile:store.profile,day:store.today()});
    if(action==='preview')return {text,entry:MEITUAN_ENTRY};
    if(!['copy','open'].includes(action))throw new Error('外卖操作无效');
    clipboard.writeText(text);if(action==='open')await shell.openExternal(MEITUAN_ENTRY);
    return {text,copied:true,opened:action==='open'};
  });

  handle('hh:configureSync',async(_e,config)=>{
    if(sync.busy)throw new Error('正在同步，请完成后再更换连接');
    if(config?.provider==='app'){
      const {baseToken,url}=parseBaseUrl(config.url||'');
      if(typeof config.appId!=='string'||!/^cli_[A-Za-z0-9]+$/.test(config.appId))throw new Error('请填写有效的飞书 App ID');
      let previous=null;try{previous=vault.read();}catch(_){}
      const secret=config.appSecret || (previous?.appId===config.appId?previous.appSecret:'');
      if(typeof secret!=='string'||secret.length<8||secret.length>256)throw new Error('请填写 App Secret；更换 App ID 时需重新填写密钥');
      const credentials={appId:config.appId,appSecret:secret};
      const probe=new FeishuAppTransport(store,credentials);
      const metadata=await probe.request('GET',`/bitable/v1/apps/${baseToken}`);
      if(!metadata.app)throw new Error('未能读取这张多维表格，请确认已把应用添加为表格协作者');
      vault.save(credentials);
      store.data.sync={provider:'app',identity:'bot',appId:config.appId,baseToken,url,tableId:'',enabled:false,lastSuccess:null,permissionGrant:{existingUserBase:true}};
      store.save();sync=makeSync();
    }else if(config?.provider==='cli'){
      const cli=new FeishuSync({filePath:store.filePath,data:{...store.data,sync:{...store.data.sync,provider:'cli'}}});
      const result=await cli.run(['auth','status','--json']);
      const identity=result.identities?.user?.available?'user':result.identities?.bot?.available?'bot':null;
      if(!identity)throw new Error('本机飞书连接尚未登录；也可使用下方自己的应用与表格连接');
      store.data.sync.provider='cli';store.data.sync.identity=identity;store.save();sync=makeSync();
      if(config.url){const target=parseBaseUrl(config.url);Object.assign(store.data.sync,{...target,tableId:'',recordIds:{},hashes:{},profileHash:null,permissionGrant:{existingUserBase:true},lastSuccess:null});store.save();}
    }else throw new Error('请选择连接方式');
    await sync.create();if(sync.error)throw new Error(sync.error);
    return buildState();
  });

  handle('hh:quiet', (_e, minutes) => {
    mutedUntil = minutes > 0 ? Date.now() + minutes * 60000 : 0;
    previewUntil=0;
    tick();
    return buildState();
  });

  handle('hh:openDataDir', () => shell.openPath(app.getPath('userData')));
  handle('hh:previewReminder',()=>{
    previewUntil=Date.now()+5000;if(previewTimer)clearTimeout(previewTimer);
    previewTimer=setTimeout(()=>{previewUntil=0;tick();},5000);tick();return buildState();
  });
  handle('hh:sync', async (_e, action) => {
    if(action==='login') {
      const {url}=await sync.startLogin();
      const parsed=new URL(url);
      if(!externalUrlAllowed(parsed.href,{kind:'login'})) throw new Error('飞书登录地址无效');
      await shell.openExternal(url);
    } else if(action==='finish') await sync.finishLogin();
    else if(action==='connect') await sync.create();
    else if(action==='now') await sync.sync();
    else if(action==='restore') {await sync.sync({restoreProfile:true});planNonce++;}
    else if(action==='disconnect') sync.disconnect();
    else if(action==='open' && externalUrlAllowed(sync.state().url,{kind:'base'})) await shell.openExternal(sync.state().url);
    else if(action==='help') await shell.openExternal('https://open.feishu.cn/app');
    else if(action==='guide-doc') await shell.openExternal('https://open.feishu.cn/document/docs/bitable-v1/faq?lang=zh-CN');
    else throw new Error('同步操作无效');
    return buildState();
  });
  handle('hh:hide', () => win && win.hide());
  handle('hh:loginItem', (_e, on) => {
    app.setLoginItemSettings({ ...loginOptions(),openAtLogin: !!on });
    return app.getLoginItemSettings(loginOptions()).openAtLogin;
  });
}

// ------------------------------------------------------------------ 启动

// Windows 上不设 AppUserModelId，通知不会显示
if(process.platform==='win32')app.setAppUserModelId('com.local.uric-acid-companion');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    if(process.platform==='darwin')app.dock?.hide();
    store = new Store(path.join(app.getPath('userData'), 'data.json'));
    if(!app.isPackaged&&process.argv.includes('--enable-motion'))store.setProfile({motionMode:'full'});
    vault=new CredentialVault(path.join(app.getPath('userData'),'feishu-credentials.enc'),safeStorage);
    sync = makeSync();
    registerIpc();
    createWindow();
    createTray();
    refreshTrayTheme();
    tickTimer = setInterval(tick, TICK_MS);

    // 首次启动直接把面板弹出来，否则用户只会看到一个图标，不知道装到哪了
    if ((store.profile.onboardingVersion !== 2 || process.argv.includes('--show')) && !uiTest&&!releaseCheck) {
      win.webContents.once('did-finish-load',showWindow);
    }
    syncTimer=setInterval(()=>{if(store.data.sync.enabled) sync.sync().then(()=>{planCache=null;tick();});},300000);
    if(store.data.sync.enabled) sync.sync().then(()=>{planCache=null;tick();});

    if(uiTest) {
      setTimeout(()=>app.exit(1),60000).unref();
      win.webContents.once('did-finish-load',async()=>{
        win.showInactive();
        const panel={show:showWindow,enable:value=>{autoHideInTest=value;},trayAlive:()=>!!tray&&!tray.isDestroyed(),status:()=>panelLifecycle.status()};
        try {if(panelTest)await require('../scripts/verify-panel-lifecycle')({win,store,panel});else await require('../scripts/verify-ui')({win,store,buildState,root:path.join(__dirname,'..'),presentation:{indicator:()=>({active:pulseActive,lit:pulseLit,animated:pulseAnimated}),systemReducedMotion,panel}});app.exit(0);}
        catch(err) {console.error(err?.stack||err?.message||String(err));app.exit(1);}
      });
    }

    if(releaseCheck){
      setTimeout(()=>app.exit(1),30000).unref();
      win.webContents.once('did-finish-load',async()=>{
        try{const result=await require('./release-check')({win,store,buildState,vault,tray});require('fs').writeFileSync(path.join(app.getPath('userData'),'self-test-result.json'),JSON.stringify(result));console.log('[release-check] '+JSON.stringify(result));app.exit(0);}
        catch(error){console.error('[release-check] FAILED: '+error.message);app.exit(1);}
      });
    }

    if (!app.isPackaged&&process.argv.includes('--dev')) {
      win.webContents.openDevTools({ mode: 'detach' });
      win.show();
    }

    // 自检模式：无需人工看界面，用于验证托盘/窗口/状态机是否真的起来了
    if (!app.isPackaged&&process.argv.includes('--smoke')) {
      const check = async () => {
        const s = lastStatus;
        let renderer = {};
        try {
          renderer = await win.webContents.executeJavaScript(`(() => ({
            preload: typeof window.hh,
            methods: window.hh ? Object.keys(window.hh).length : 0,
            tab: !!document.querySelector('nav button.active'),
            ring: !!document.querySelector('.ring-wrap svg'),
            bigText: (document.querySelector('.ring-big') || {}).textContent || '',
            targetText: (document.querySelector('.ring-unit') || {}).textContent || '',
            statusLine: (document.querySelector('.status-line') || {}).textContent || '',
            bodyText: (document.body.innerText || '').slice(0, 120)
          }))()`);
        } catch (err) {
          renderer = { error: String(err) };
        }

        console.log('[smoke] tray created      :', !!tray);
        console.log('[smoke] window created    :', !!win && !win.isDestroyed());
        console.log('[smoke] preload bridge    :', renderer.preload, 'methods=' + renderer.methods);
        console.log('[smoke] renderer mounted  :', renderer.ring, 'tabs=' + renderer.tab);
        console.log('[smoke] ring text         :', JSON.stringify(renderer.bigText), JSON.stringify(renderer.targetText));
        console.log('[smoke] status line       :', (renderer.statusLine || '').trim());
        console.log('[smoke] water status      :', s && `${s.drunk}/${s.target} (${Math.round(s.progress * 100)}%) inWindow=${s.inWindow} due=${s.due}`);
        console.log('[smoke] recipe mode       :', planCache && planCache.plan.mode);
        console.log('[smoke] plan meals        :', planCache && Object.values(planCache.plan.meals).map((m) => `${m.label}:${m.items.length}`).join(' '));
        console.log('[smoke] data file         :', store.filePath);
        if (renderer.error) console.log('[smoke] RENDERER ERROR    :', renderer.error);
        console.log('[smoke] OK');
        app.isQuitting = true;
        app.quit();
      };
      win.webContents.once('did-finish-load', () => setTimeout(check, 900));
      setTimeout(() => { if (!app.isQuitting) { console.log('[smoke] TIMEOUT waiting for renderer'); app.isQuitting = true; app.quit(); } }, 9000);
    }
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    if (tickTimer) clearInterval(tickTimer);
    if (syncTimer) clearInterval(syncTimer);
    if(previewTimer)clearTimeout(previewTimer);
    stopPulse();
  });

  app.on('window-all-closed', (e) => {
    // 托盘常驻，不随窗口关闭退出
    e.preventDefault();
  });
}
