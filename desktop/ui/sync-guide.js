/* A native, read-only guide. Opening or browsing it never connects or writes data. */
(() => {
 const dialog=document.querySelector('#sync-guide'),body=dialog.querySelector('.guide-body');
 const titles=['准备表格','允许读写','填写连接','日常使用'];
 let step=0,mode='app',snapshot=null;
 const fieldExample='<code class="guide-example">https://你的域名.feishu.cn/base/…</code>';
 function page(){
  if(step===0)return `<h3 tabindex="-1">先准备一张普通多维表格</h3><p>在飞书新建普通多维表格，命名为「个人健康助手」，或使用你已有的表格。</p><div class="guide-callout">使用普通表格就可以，不需要开启多维表格的「应用模式」。</div><ol><li>打开这张表格，复制它的完整链接。</li><li>链接中应包含 <code>/base/</code>，例如：</li></ol>${fieldExample}<p class="hint">如果复制的是知识库链接，请先打开原始多维表格再复制。连接成功后，软件会在其中建立「每日健康记录」数据表，不用手动建字段。</p><h4>选择适合你的连接方式</h4><div class="guide-modes"><button type="button" data-guide-mode="app" aria-pressed="${mode==='app'}"><strong>自己的表格连接</strong><small>适合在新电脑上使用，按后续步骤准备连接信息。</small></button><button type="button" data-guide-mode="cli" aria-pressed="${mode==='cli'}"><strong>本机已有的飞书连接</strong><small>${snapshot.sync.available?'这台电脑已检测到连接工具，可以复用。':'需要这台电脑已配置并授权飞书连接。'}</small></button></div>`;
  if(step===1&&mode==='app')return `<h3 tabindex="-1">允许软件读写你的表格</h3><p>普通表格负责存数据；飞书开放平台里的连接应用负责读写它。两者是不同的设置。</p><ol class="guide-instructions"><li><strong>创建或打开企业自建应用</strong><p>进入飞书开放平台 → 开发者后台 → 创建企业自建应用。已有连接应用也可以继续使用。</p><button type="button" class="link-btn" data-guide-external="help">打开飞书开发者后台 ↗</button></li><li><strong>开通多维表格读写权限</strong><p>在「权限管理」搜索 <code>bitable:app</code>，选择「查看、评论、编辑和管理多维表格」。在「版本管理与发布」发布新版本；如需管理员审核，等待通过后再连接。</p></li><li><strong>让这张表格允许应用访问</strong><p>回到普通多维表格，在「… → 更多 → 添加文档应用」中找到该应用，授予可编辑、可管理的权限。菜单位置可能因飞书版本略有不同。</p></li></ol><div class="guide-callout">如果搜索不到应用，先检查权限是否已开通并发布。仅创建应用或仅复制密钥，还不能读写表格。</div>`;
  if(step===1)return `<h3 tabindex="-1">复用这台电脑的飞书连接</h3><p>${snapshot.sync.available?'已检测到本机的飞书连接工具。':'这台电脑还未检测到可用的飞书连接工具，建议返回第一步选择「自己的表格连接」。'}</p><ol><li>确认本机连接已完成登录或服务授权。</li><li>连接身份需要有多维表格读写权限，并有目标表格的编辑权限。</li><li>在本软件选择「本机已有的飞书连接」。无需重复填写 App ID 和 App Secret。</li></ol><p class="hint">本机连接是否可用，以连接时的检查结果为准。没有配置过这类连接的用户，使用「自己的表格连接」更容易完成准备。</p>`;
  if(step===2&&mode==='app')return `<h3 tabindex="-1">这三项分别从哪里复制？</h3><dl class="guide-fields"><dt>App ID</dt><dd>开发者后台 → 对应应用 →「凭证与基础信息」→ 复制 App ID，通常以 <code>cli_</code> 开头。</dd><dt>App Secret</dt><dd>在同一个页面显示并复制 App Secret。软件会将密钥加密保存在本机，不会写入健康表格。已保存的密钥无需每次重填。</dd><dt>普通多维表格链接</dt><dd>复制第一步准备好的表格完整链接，保留 <code>/base/</code> 后的内容。${fieldExample}</dd></dl><p>回到连接表单，选择「连接自己的多维表格」，粘贴这三项，再点「连接并同步」。</p><div class="guide-callout">成功后会显示「已连接」和上次同步时间，再点「打开表格」即可核对记录。</div><button type="button" class="btn primary full" data-guide-connect>去填写连接信息</button>`;
  if(step===2)return `<h3 tabindex="-1">选择连接，再确认表格</h3><ol><li>在连接表单选择「本机已有的飞书连接」。</li><li>粘贴第一步复制的表格链接。</li><li>点击「连接并同步」，等待显示「已连接」。</li></ol><p class="hint">链接留空时：已有表格就沿用；尚未连接过表格时会新建专用表格。想使用指定表格，建议直接粘贴完整链接。</p><button type="button" class="btn primary full" data-guide-connect>去填写连接信息</button>`;
  return `<h3 tabindex="-1">连接成功后，这样使用</h3><div class="guide-callout"><strong>先记在本机，再同步到飞书</strong><p>软件运行时每 5 分钟同步一次，也可在设置点「立即同步」。断网时继续保存在本机，恢复网络后重试。</p></div><h4>手机上怎么看？</h4><p>在手机飞书里打开这张多维表格，进入「每日健康记录」，找到今天的日期行，查看饮水和已记录的餐食。</p><h4>手机上怎么补记喝水？</h4><p>在当天的「手机补记ml」填写<strong>当天手机补记的累计量</strong>。例如先补记 300 ml，后来又喝 200 ml，就把这个数改成 500。</p><p class="hint">下次同步会与桌面记录合并。不要直接改「饮水ml」，也请保留「记录键」和「数据JSON」。手机端目前支持补记饮水，完整餐食选择仍在桌面完成。</p><h4>换电脑或连接失败时</h4><details><summary>从飞书恢复会发生什么？</summary><p>在设置里选择「从飞书恢复」，会合并日记录，并用云端档案替换本机目标与偏好。软件会先让你确认。</p></details><details><summary>提示没有权限，怎么检查？</summary><p>依次检查：应用的多维表格权限已发布并生效；目标表格已添加对应文档应用并允许编辑；表格链接是完整的 /base/ 链接。本地记录仍会保留。</p><button type="button" class="link-btn" data-guide-external="guide-doc">飞书官方权限说明 ↗</button></details><p class="hint">面板收起时仍会同步；从托盘选择「退出」后，自动同步会停止。</p>`;
 }
 function render(focus=false){
  dialog.querySelector('.guide-progress').textContent=`${step+1} / ${titles.length}`;
  dialog.querySelector('.guide-steps').innerHTML=titles.map((title,i)=>`<button type="button" data-guide-step="${i}" ${i===step?'aria-current="step"':''}><span>${i+1}</span>${title}</button>`).join('');
  body.innerHTML=page();body.scrollTop=0;
  dialog.querySelector('[data-guide-prev]').disabled=step===0;
  dialog.querySelector('[data-guide-next]').textContent=step===3?'知道了':'下一步';
  if(focus)body.querySelector('h3').focus({preventScroll:true});
 }
 dialog.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-guide-close')){dialog.close();return;}
  if(button.dataset.guideStep!=null){step=Number(button.dataset.guideStep);render(true);return;}
  if(button.dataset.guideMode){mode=button.dataset.guideMode;render();return;}
  if(button.hasAttribute('data-guide-prev')){step=Math.max(0,step-1);render(true);return;}
  if(button.hasAttribute('data-guide-next')){if(step===3)dialog.close();else{step++;render(true);}return;}
  if(button.hasAttribute('data-guide-connect')){
   dialog.close();const editor=document.querySelector('.connection-editor');if(editor)editor.open=true;
   const radio=document.querySelector(`#sync-form [name=syncProvider][value=${mode}]`);
   if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
   const field=document.querySelector(mode==='app'?'#feishu-app-id':'#existing-base-url');
   field?.focus();field?.scrollIntoView({block:'center'});return;
  }
  if(button.dataset.guideExternal){
   button.disabled=true;const error=dialog.querySelector('.guide-error');error.textContent='';
   try{await window.hh.sync(button.dataset.guideExternal);}catch(err){error.textContent=String(err.message||err).replace(/^Error invoking remote method '[^']+': Error: /,'');}finally{button.disabled=false;}
  }
 });
 dialog.addEventListener('close',()=>{dialog.returnValue='';});
 window.syncGuide={open(state){snapshot=state;step=0;mode=state.sync.provider==='cli'||state.sync.available?'cli':'app';render();dialog.showModal();}};
})();
