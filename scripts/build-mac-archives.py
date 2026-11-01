"""Build local-test macOS app ZIPs while preserving Unix modes and symlinks.

Runtime ZIPs are verified by download-mac-runtime.cjs. Signing is performed in
local WSL by rcodesign; this does not claim Apple notarization or a Mac run test.
"""
from pathlib import Path
import argparse,copy,hashlib,json,plistlib,stat,struct,tarfile,zipfile

ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'build/mac-runtime'
PACKAGE=json.loads((ROOT/'package.json').read_text(encoding='utf-8'))
VERSION=PACKAGE['version']
APP_NAME='个人健康助手.app'
APP_ID='com.local.uric-acid-companion'
FRAMEWORK='Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework'

def source(arch):
    return zipfile.ZipFile(RUNTIME/('electron-v45.2.1-darwin-'+arch+'.zip'))

def extract_frameworks():
    for arch in ['arm64','x64']:
        with source(arch) as z:
            (RUNTIME/('framework-'+arch+'.bin')).write_bytes(z.read(FRAMEWORK))

def icon_bytes():
    # Existing original tray-ring artwork, converted to the native ICNS wrapper.
    chunks=[]
    for size,tag in [(128,b'ic07'),(256,b'ic08'),(512,b'ic09'),(1024,b'ic10')]:
        png=(ROOT/'build'/('icon-'+str(size)+'.png')).read_bytes()
        chunks.append(tag+struct.pack('>I',len(png)+8)+png)
    return b'icns'+struct.pack('>I',8+sum(map(len,chunks)))+b''.join(chunks)

def extra(out,name,data,mode=0o644):
    info=zipfile.ZipInfo(name);info.create_system=3;info.external_attr=(stat.S_IFREG|mode)<<16;info.compress_type=zipfile.ZIP_DEFLATED
    out.writestr(info,data)

def verify_macho(data):
    """Check every code-page hash, including the modified Electron fuse pages.

    This checks an anonymous ad-hoc signature's content hashes; it does not
    establish a Developer ID, Apple notarization or Gatekeeper acceptance.
    """
    if data[:4] in [b'\xca\xfe\xba\xbe',b'\xca\xfe\xba\xbf']:
        count=struct.unpack_from('>I',data,4)[0];fat64=data[:4]==b'\xca\xfe\xba\xbf';pages=0
        for index in range(count):
            at=8+index*(32 if fat64 else 20)
            offset,length=struct.unpack_from('>QQ' if fat64 else '>II',data,at+8)
            checked=verify_macho(data[offset:offset+length])
            if checked is None:raise ValueError('Unsupported fat Mach-O slice')
            pages+=checked
        return pages
    if data[:4]!=b'\xcf\xfa\xed\xfe':return None
    ncmds=struct.unpack_from('<I',data,16)[0];offset=32;signature=None
    for _ in range(ncmds):
        cmd,length=struct.unpack_from('<II',data,offset)
        if length<8 or offset+length>len(data):raise ValueError('Invalid Mach-O load command')
        if cmd==0x1d:signature=struct.unpack_from('<II',data,offset+8)
        offset+=length
    if signature is None:raise ValueError('Mach-O has no signature')
    start,size=signature;blob=data[start:start+size]
    magic,total,count=struct.unpack_from('>III',blob,0)
    if magic!=0xfade0cc0 or total>len(blob):raise ValueError('Invalid code signature superblob')
    directories=0;pages=0
    for i in range(count):
        slot,at=struct.unpack_from('>II',blob,12+i*8)
        if slot!=0 and not (0x1000<=slot<=0x1005):continue
        fields=struct.unpack_from('>9I4BI',blob,at)
        cmagic,length,version,flags,hash_offset,ident_offset,special,nslots,limit,hsize,htype,platform,power,spare=fields
        if cmagic!=0xfade0c02 or not flags&2:raise ValueError('Expected ad-hoc CodeDirectory')
        if version>=0x20300:
            big_limit=struct.unpack_from('>Q',blob,at+56)[0]
            if big_limit:limit=big_limit
        if limit>start or limit>len(data):raise ValueError('Invalid code limit')
        page=1<<power if power else limit
        algorithm={1:'sha1',2:'sha256',3:'sha256',4:'sha384'}.get(htype)
        if not algorithm:raise ValueError('Unsupported signature digest')
        if nslots!=(limit+page-1)//page:raise ValueError('Unexpected code-page count')
        for index in range(nslots):
            expected=blob[at+hash_offset+index*hsize:at+hash_offset+(index+1)*hsize]
            actual=hashlib.new(algorithm,data[index*page:min((index+1)*page,limit)]).digest()[:hsize]
            if actual!=expected:raise ValueError('Mach-O code-page hash mismatch')
        directories+=1;pages+=nslots
    if not directories:raise ValueError('No CodeDirectory')
    return pages

def assemble():
    integrity=json.loads((ROOT/'build/mac-asar-integrity.json').read_text())
    for arch in ['arm64','x64']:
        with source(arch) as original,zipfile.ZipFile(RUNTIME/('health-unsigned-'+arch+'.zip'),'w',compression=zipfile.ZIP_DEFLATED,compresslevel=4) as out:
            for entry in original.infolist():
                old=entry.filename
                if not old.startswith('Electron.app/'):
                    continue
                if '/_CodeSignature/' in old or old.endswith('/_CodeSignature/') or old in ['Electron.app/Contents/Resources/default_app.asar','Electron.app/Contents/Resources/electron.icns']:
                    continue
                name=APP_NAME+'/'+old[len('Electron.app/'):]
                name=name.replace('/Electron Helper','/HealthCompanion Helper').replace('/Electron Login Helper','/HealthCompanion Login Helper')
                if name==APP_NAME+'/Contents/MacOS/Electron':name=APP_NAME+'/Contents/MacOS/HealthCompanion'
                data=original.read(entry)
                if old==FRAMEWORK:data=(RUNTIME/('framework-'+arch+'.bin')).read_bytes()
                if old=='Electron.app/Contents/Info.plist':
                    p=plistlib.loads(data)
                    p.update(CFBundleName='HealthCompanion',CFBundleDisplayName='个人健康助手',CFBundleExecutable='HealthCompanion',CFBundleIdentifier=APP_ID,CFBundleVersion=VERSION,CFBundleShortVersionString=VERSION,CFBundleIconFile='icon.icns',LSUIElement=True,NSHumanReadableCopyright='日常',ElectronAsarIntegrity={'Resources/app.asar':integrity})
                    data=plistlib.dumps(p,sort_keys=False)
                elif old.endswith('.app/Contents/Info.plist') and ('/Electron Helper' in old or '/Electron Login Helper' in old):
                    p=plistlib.loads(data);bundle=old.split('/')[-3][:-4];exe=bundle.replace('Electron','HealthCompanion',1)
                    suffix=bundle.replace('Electron Helper','').replace('Electron Login Helper','login').strip(' ()').lower() or 'main'
                    p.update(CFBundleName=exe,CFBundleDisplayName=exe,CFBundleExecutable=exe,CFBundleIdentifier=APP_ID+'.helper.'+suffix,CFBundleVersion=VERSION)
                    data=plistlib.dumps(p,sort_keys=False)
                info=copy.copy(entry);info.filename=name;info.orig_filename=name
                out.writestr(info,data)
            extra(out,APP_NAME+'/Contents/Resources/app.asar',(ROOT/'build/mac-app.asar').read_bytes())
            extra(out,APP_NAME+'/Contents/Resources/icon.icns',icon_bytes())
        print(json.dumps({'unsignedArchive':arch,'version':VERSION},ensure_ascii=False))

def from_tar():
    release=ROOT/'release'/VERSION;release.mkdir(parents=True,exist_ok=True)
    reports=[]
    expected_asar=hashlib.sha256((ROOT/'build/mac-app.asar').read_bytes()).hexdigest()
    for arch in ['arm64','x64']:
        final=release/('个人健康助手-'+VERSION+'-Mac-'+arch+'-试用版.zip')
        symlinks=0;executables=0;signatures=0;asar_hash=None;minimum=None;macho_count=0;code_pages=0
        with tarfile.open(RUNTIME/('health-signed-'+arch+'.tar.gz'),'r:gz') as source_tar,zipfile.ZipFile(final,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as out:
            for member in source_tar:
                name=member.name.removeprefix('./')
                if not name or name=='/':continue
                if name.startswith('/') or '..' in Path(name).parts or not (name==APP_NAME or name.startswith(APP_NAME+'/')):raise ValueError('Invalid app bundle member')
                info=zipfile.ZipInfo(name+('/' if member.isdir() and not name.endswith('/') else ''));info.create_system=3;info.compress_type=zipfile.ZIP_DEFLATED
                if member.issym():
                    info.external_attr=(stat.S_IFLNK|0o777)<<16;data=member.linkname.encode();symlinks+=1
                elif member.isdir():info.external_attr=((stat.S_IFDIR|member.mode)<<16)|0x10;data=b''
                elif member.isfile():
                    info.external_attr=(stat.S_IFREG|member.mode)<<16;data=source_tar.extractfile(member).read()
                    checked=verify_macho(data)
                    if checked is not None:macho_count+=1;code_pages+=checked
                    if member.mode&0o111:executables+=1
                    if name.endswith('/_CodeSignature/CodeResources'):signatures+=1
                    if name.endswith('/Contents/Resources/app.asar'):asar_hash=hashlib.sha256(data).hexdigest()
                    if name==APP_NAME+'/Contents/Info.plist':minimum=plistlib.loads(data).get('LSMinimumSystemVersion')
                    if name==APP_NAME+'/Contents/MacOS/HealthCompanion':
                        if data[:4]!=b'\xcf\xfa\xed\xfe':raise ValueError('Unexpected Mach-O magic')
                        cpu=struct.unpack('<I',data[4:8])[0]
                        if cpu!={'arm64':0x100000c,'x64':0x1000007}[arch]:raise ValueError('Wrong architecture')
                else:raise ValueError('Unexpected bundle file type')
                out.writestr(info,data)
            extra(out,'Mac使用说明.txt',('个人健康助手 '+VERSION+' · Mac '+arch+' 试用版\n\n解压后将“个人健康助手.app”拖到“应用程序”，再从那里打开。\n需要 macOS '+str(minimum)+' 或以上。arm64 适用苹果芯片，x64 适用 Intel。\n\n本包已做本地临时签名，未取得苹果开发者认证、未公证，未在 Mac 实机上运行验证。首次打开可能需要在系统设置的“隐私与安全性”中允许打开；若仍被系统阻止，请停止尝试并提供提示供排查，不要关闭系统安全保护。\n\n开机启动和钥匙串凭据保存仍需 Mac 实机验证；升级后系统可能再次询问钥匙串访问。\n\n没有携带打包电脑的健康记录或飞书连接。每位用户默认本地保存，飞书需要自行配置。菜品图片是示意，实际配料以文字和商家核对为准。\n').encode())
        if not (symlinks>10 and signatures>4 and executables>4 and asar_hash==expected_asar):raise ValueError('Incomplete or changed app bundle')
        reports.append({'file':final.name,'arch':arch,'sha256':hashlib.sha256(final.read_bytes()).hexdigest(),'bytes':final.stat().st_size,'symlinks':symlinks,'codeResourceFiles':signatures,'machoFilesChecked':macho_count,'codePagesChecked':code_pages,'unixModesPreserved':True,'asarMatches':True,'minimumMacOS':minimum,'signature':'ad-hoc','appleNotarized':False,'testedOnMac':False})
        print(json.dumps(reports[-1],ensure_ascii=False))
    (release/'Mac构建验证.json').write_text(json.dumps({'artifacts':reports,'scope':'static bundle, modes, symlinks, architecture, archive integrity; not a Mac runtime or Gatekeeper test'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['extract-frameworks','assemble','from-tar']);args=parser.parse_args()
    {'extract-frameworks':extract_frameworks,'assemble':assemble,'from-tar':from_tar}[args.action]()
