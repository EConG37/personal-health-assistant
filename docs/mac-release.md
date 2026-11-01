# Mac 试用包

0.1.2 同时提供 arm64（M 系列苹果芯片）和 x64（Intel），要求 macOS 13.0 或以上。格式是包含完整 `.app` 的 ZIP 分发包，不是改名的 Windows EXE 或 DMG。

## 使用

1. 在“关于本机”确认是苹果芯片还是 Intel，下载对应 ZIP。
2. 解压，把“个人健康助手.app”拖到“应用程序”后打开。
3. 本包没有 Apple Developer ID 认证或公证。若提示开发者未验证，仅在确认来源和文件完整性后，按 [Apple 官方说明](https://support.apple.com/zh-cn/102445)处理该应用的例外。若提示损坏、将损坏电脑或仍被阻止，停止尝试并反馈，不关闭系统全局安全保护。

运行后在菜单栏显示饮水圆环，点它打开面板，点窗口外收起。登录启动与钥匙串行为仍需 Mac 实机验证；更新本地签名的试用包后，系统可能再次询问钥匙串访问。

## 已完成与限制

- Windows 和 Mac 使用同一套已检查的业务代码、99 项菜品映射和 63 张新增菜品图片。
- Mac 不携带 Windows 焦点辅助 EXE；采用原生窗口失焦收起。增加菜单栏窗口定位、Retina 圆环、隐藏 Dock 与 Mac 登录项参数分支。
- 官方 Electron 45.2.1 两种 Mac 运行时按 npm 包自带的 SHA-256 清单校验。运行包不含 npm 开发依赖、测试数据、截图或个人连接。
- 在本机 WSL 中使用 Apple Codesign/rcodesign 0.29.0 做匿名 ad-hoc 本地签名，不上传源代码、健康数据或签名密钥，不冒充苹果开发者签名。
- 已独立检查 14 个 Mach-O 文件的代码页哈希、236 项资源封印、10 项嵌套代码哈希、34 项特殊哈希槽，并保留了 14 个 Unix 符号链接与执行权限。两个包的 ASAR 均与通过隐私检查的 Mac 归档一致。
- rcodesign 0.29 自带 verify 命令提示其校验实现不可靠，本流程未据此声称通过 Apple 校验，使用本地独立的哈希核对脚本。
- **没有 Mac 实机运行测试、Gatekeeper 测试或 Apple 公证；开机启动、系统钥匙串和窗口行为必须由朋友首次试用验证。** 静态内容哈希通过不等同于苹果认可或运行兼容性保证。

细目在发布目录 `Mac构建验证.json`、`Mac隐私与签名结构检查.json`。SHA-256 在同目录 `SHA256SUMS.txt`。

## 本机构建过程

先通过 `npm run audit:source`，再运行 `download-mac-runtime.cjs`、`prepare-mac-payload.cjs`，生成应用归档。用 `build-mac-archives.py extract-frameworks` 和 `flip-mac-fuses.cjs` 设置归档校验及调试限制，然后 `build-mac-archives.py assemble` 组装两种架构。

`sign-mac-wsl.sh` 在本机 Linux 环境签名，不需要把项目交给云端。构建使用 `/run` 临时文件系统，不占用 Docker 发行版的小容量根分区。签名后 `build-mac-archives.py from-tar` 生成保留 Unix 元数据的 ZIP，`verify-mac-bundle.py` 复核内容及隐私。

后续若要公开分发、减少首次打开阻碍，需要补齐开发者身份签名和苹果公证，不能把当前试用包称为已公证正式版。参考 [Electron 签名说明](https://www.electronjs.org/docs/latest/tutorial/code-signing)、[rcodesign 签名文档](https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_rcodesign_signing.html)。
