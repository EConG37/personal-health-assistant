const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist'),version=require('../package.json').version;
const audit=JSON.parse(fs.readFileSync(path.join(dist,'privacy-package.json'),'utf8'));
const tests=JSON.parse(fs.readFileSync(path.join(dist,'release-verification.json'),'utf8'));
assert(audit.ok&&tests.ok&&tests.existingUserFilesUnchanged&&tests.installerPayloadMatches&&tests.portablePayloadMatches);
assert.equal(audit.artifacts.length,2);
const zip=JSON.parse(fs.readFileSync(path.join(dist,'portable-zip-verification.json'),'utf8'));
assert(zip.ok&&zip.roundTripHashesMatch&&zip.auditedArchiveMatches&&zip.existingUserFilesUnchanged);
const output=path.join(root,'release',version);fs.mkdirSync(output,{recursive:true});
const checksums=[];
for(const item of [...audit.artifacts,zip]){
 const bytes=fs.readFileSync(path.join(dist,item.file)),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash,item.sha256,'Release artifact changed after its privacy audit');
 fs.writeFileSync(path.join(output,item.file),bytes);checksums.push(hash+'  '+item.file);
}
fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),checksums.join('\n')+'\n');
fs.writeFileSync(path.join(output,'验证结果.json'),JSON.stringify(tests,null,2)+'\n');
fs.writeFileSync(path.join(output,'ZIP验证结果.json'),JSON.stringify(zip,null,2)+'\n');
fs.writeFileSync(path.join(output,'使用说明.txt'),[
 '个人健康助手 '+version+' · Windows x64',
 '',
 '安装版：双击安装，可创建桌面与开始菜单快捷方式。',
 '免安装 ZIP：先解压整个文件夹，再打开 HealthCompanion.exe；不要只移动 EXE。',
 '免安装 EXE：自解压启动，无需安装 Node.js。启用开机启动时请将程序保留在固定位置。',
 '关闭面板或点击窗口外会收起到托盘；右键托盘可彻底退出。',
 '',
 '首次使用会引导选择目标、喜好和杯量。飞书连接由每位用户自行配置，默认关闭同步。',
 '已有记录继续保存在当前 Windows 用户的应用数据目录。把 EXE 发给别人，不会复制本机的健康记录或飞书凭据。',
 '本地健康记录为 JSON，未整体加密；飞书 App Secret 另行使用系统安全存储加密。',
 '',
 '这两个 EXE 尚未进行代码签名，Windows 可能提示未知发布者。',
 '发布文件的校验值见 SHA256SUMS.txt，隐私检查范围见 隐私检查报告.md。'
].join('\r\n')+'\r\n');
fs.writeFileSync(path.join(output,'隐私检查报告.md'),[
 '# 个人健康助手 '+version+' 隐私与打包检查',
 '',
 '**结论：在所检查的分发内容中，未发现打包电脑的个人健康记录、飞书连接信息或密钥、本机用户名和目录。**',
 '',
 '## 已检查的内容',
 '',
 '- 按明确清单收录 '+audit.files+' 个应用文件，逐个检查最终应用归档及解包的原生辅助程序；对两个 EXE 额外比对个人信息特征。',
 '- 个人信息比对结果为 0 项。比对过程只在本机进行，没有把用于比对的个人信息写进报告或发送给外部服务。未解密已有飞书密钥。',
 '- 没有收录健康数据文件、凭据文件、截图、日志、测试数据、研究资料、环境变量文件或开发依赖。',
 '- 打包后的程序与免安装 EXE 均通过临时数据自检：首次使用、记水/撤销、九张牌、选餐、来源、字体/配图、页面隔离及原生辅助程序。',
 '- 从安装版和免安装版提取出的应用归档，均与已检查归档的校验值一致。测试前后本机原有健康记录和凭据文件未发生变化。',
 '',
 '## 实际数据去向',
 '',
 '- 新用户默认没有健康记录或飞书连接，默认关闭同步。',
 '- 记录保存在当前 Windows 用户的应用数据目录，继续沿用本机旧记录。分发 EXE 不会分发这个目录。健康记录是本地 JSON，未整体加密。',
 '- 飞书密钥独立保存并由系统安全存储加密，不返回页面、不写进多维表格。主动连接并开启飞书后，健康档案和日记录会同步至所选表格。',
 '- 未发现统计埋点、开发者的健康数据接收服务或自动发送外卖资料的代码。外卖需求由用户主动生成和复制。',
 '- 窗口辅助程序只判断焦点及窗口外点击，不保存鼠标/键盘记录，不访问网络或健康文件。',
 '',
 '## 发布保护与范围',
 '',
 '运行内核为 Electron 45.2.1。程序启用页面隔离和沙箱，校验敏感操作来源，限制外部地址，关闭发布版调试入口及 Node 调试环境开关，并启用应用归档完整性校验。',
 '',
 '本次检查针对分发内容和已实现的数据流，未进行独立渗透测试，不等同于完整安全认证。拥有当前 Windows 用户权限的其他程序仍可能读取本地健康 JSON。',
 '',
 'EXE 未进行代码签名，Windows 可能提示未知发布者。成品 SHA-256 见同目录 SHA256SUMS.txt。',
 '',
 '参考：[Electron 安全指南](https://www.electronjs.org/docs/latest/tutorial/security)、[electron-builder 配置](https://www.electron.build/configuration/)。'
].join('\n')+'\n');
console.log(JSON.stringify({directory:'release/'+version,files:fs.readdirSync(output),personalMatches:audit.personalMatches}));
