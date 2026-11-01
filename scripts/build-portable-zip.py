"""Build and round-trip test a Windows folder ZIP from the audited application."""
from pathlib import Path
import hashlib, json, os, subprocess, tempfile, zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
SOURCE = DIST / 'win-unpacked'
AUDIT = json.loads((DIST / 'privacy-package.json').read_text(encoding='utf-8'))
TESTS = json.loads((DIST / 'release-verification.json').read_text(encoding='utf-8'))
assert AUDIT['ok'] and TESTS['ok'] and TESTS['existingUserFilesUnchanged']
digest = lambda value: hashlib.sha256(value).hexdigest()
expected_asar = {row['file']: row for row in AUDIT['manifest']}
assert 'package.json' in expected_asar
asar_hash = digest((SOURCE / 'resources/app.asar').read_bytes())
records = Path(os.environ['APPDATA']) / 'uric-acid-companion'
own_files = [records / name for name in ['data.json', 'feishu-credentials.enc']]
snapshot = lambda: [digest(p.read_bytes()) if p.exists() else None for p in own_files]
before = snapshot()
filename = '个人健康助手-' + VERSION + '-免安装版-x64.zip'
target = DIST / filename
prefix = '个人健康助手/'
manifest = {}
allowed_root = {
    'HealthCompanion.exe', 'chrome_100_percent.pak', 'chrome_200_percent.pak',
    'd3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'electron_wer.dll', 'ffmpeg.dll',
    'icudtl.dat', 'libEGL.dll', 'libGLESv2.dll', 'resources.pak',
    'snapshot_blob.bin', 'v8_context_snapshot.bin', 'vk_swiftshader.dll',
    'vk_swiftshader_icd.json', 'vulkan-1.dll', 'LICENSE.electron.txt',
    'LICENSES.chromium.html', 'version'
}
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for file in sorted(SOURCE.rglob('*')):
        if not file.is_file(): continue
        relative = file.relative_to(SOURCE).as_posix()
        allowed = relative in allowed_root or relative in ['locales/en-US.pak', 'locales/zh-CN.pak', 'resources/app.asar', 'resources/default_app.asar', 'resources/elevate.exe', 'resources/app.asar.unpacked/desktop/native/PanelFocusObserver.exe']
        if not allowed: raise ValueError('Unexpected application file: ' + relative)
        data = file.read_bytes()
        name = prefix + relative
        manifest[name] = digest(data)
        archive.writestr(name, data)
    note = ('个人健康助手 ' + VERSION + ' · Windows x64 免安装 ZIP\n\n'
            '请先解压整个文件夹，再打开其中的 HealthCompanion.exe。\n'
            '请保留所有文件，不要只移动 EXE。无需安装 Node.js。\n'
            '如果开启自启，请把解压后的文件夹保留在固定位置。\n'
            '点击窗口外收起到托盘，右键托盘可退出。\n\n'
            '界面使用随包提供的阿里巴巴普惠体 2.0，无需另装字体。\n'
            '首次使用默认没有健康记录或飞书连接，需要自行配置。\n'
            '健康记录保存在当前用户的应用数据目录，不在此 ZIP 中。\n'
            '本包未做发布者代码签名，Windows 可能提示未知发布者。\n')
    data = note.encode('utf-8')
    manifest[prefix + '使用说明.txt'] = digest(data)
    archive.writestr(prefix + '使用说明.txt', data)

with zipfile.ZipFile(target) as archive:
    assert set(archive.namelist()) == set(manifest)
    for name, expected in manifest.items(): assert digest(archive.read(name)) == expected
    with tempfile.TemporaryDirectory(prefix='health-portable-zip-') as staging:
        archive.extractall(staging)
        executable = Path(staging) / prefix / 'HealthCompanion.exe'
        result = subprocess.run([str(executable), '--self-test', '--disable-gpu'], capture_output=True, timeout=90)
        assert result.returncode == 0, 'Extracted ZIP app failed its self-test'
        line = next((v for v in result.stdout.decode('utf-8', errors='replace').splitlines() if v.startswith('[release-check] ')), None)
        assert line, 'Extracted ZIP app did not return a self-test report'
        runtime = json.loads(line[len('[release-check] '):])
        assert runtime['ok'] and runtime['freshProfile'] and runtime['syncDisabled'] and runtime['noSavedCredentials']
        assert digest((Path(staging) / prefix / 'resources/app.asar').read_bytes()) == asar_hash
assert before == snapshot(), 'Existing personal files changed during ZIP verification'
report = {'ok': True, 'file': filename, 'bytes': target.stat().st_size, 'sha256': digest(target.read_bytes()), 'files': len(manifest), 'roundTripHashesMatch': True, 'auditedArchiveMatches': True, 'existingUserFilesUnchanged': True, 'extractedRuntime': runtime}
(DIST / 'portable-zip-verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=True))
