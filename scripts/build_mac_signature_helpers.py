"""Read CodeDirectories for static resource-seal checks, including fat slices."""
import hashlib,struct

def code_directories(data):
    if data[:4] in [b'\xca\xfe\xba\xbe',b'\xca\xfe\xba\xbf']:
        count=struct.unpack_from('>I',data,4)[0];fat64=data[:4]==b'\xca\xfe\xba\xbf';found=[]
        for i in range(count):
            at=8+i*(32 if fat64 else 20);offset,size=struct.unpack_from('>QQ' if fat64 else '>II',data,at+8);found.extend(code_directories(data[offset:offset+size]))
        return found
    if data[:4]!=b'\xcf\xfa\xed\xfe':return []
    ncmds=struct.unpack_from('<I',data,16)[0];at=32;sig=None
    for _ in range(ncmds):
        cmd,length=struct.unpack_from('<II',data,at)
        if cmd==0x1d:sig=struct.unpack_from('<II',data,at+8)
        at+=length
    if sig is None:raise ValueError('No signature')
    start,size=sig;blob=data[start:start+size];magic,total,count=struct.unpack_from('>III',blob,0)
    if magic!=0xfade0cc0:raise ValueError('Invalid signature')
    blobs={}
    for i in range(count):
        slot,offset=struct.unpack_from('>II',blob,12+i*8);length=struct.unpack_from('>I',blob,offset+4)[0];blobs[slot]=blob[offset:offset+length]
    result=[]
    for slot,cd in blobs.items():
        if slot!=0 and not 0x1000<=slot<=0x1005:continue
        magic,length,version,flags,hashoff,ident,nsp,ncode,limit,hsize,htype,platform,power,spare=struct.unpack_from('>9I4BI',cd)
        algorithm={1:'sha1',2:'sha256',3:'sha256',4:'sha384'}[htype]
        result.append({'algorithm':algorithm,'cdhash':hashlib.new(algorithm,cd).digest()[:20],'blobs':blobs,'special':{i:cd[hashoff-i*hsize:hashoff-(i-1)*hsize] for i in range(1,nsp+1)}})
    return result
