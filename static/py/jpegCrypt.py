"""# Spread-spectrum QIM robust image steganography with ECC and pilot synchronization"""

#@title funcs
import numpy as np
from PIL import Image
from scipy.fftpack import dct,idct
import reedsolo, zlib, secrets
from collections import Counter

import base64
# from scipy.fft import dct as dct_2d, idct as idct_2d

############################
# PARAMETERS
############################
LONG_EDGE=1600       # whatsapp resizes to 1920px
BLOCK=8
DELTA=50             # embed strength
SPREAD=8             # blocks per payload bit
REPEAT=2             # repetition coding
TILES=1
SEED=1337
RS_PARITY=32
# SYNC_BITS='1111100110101'*4 # Repeating a short pattern is bad. Autocorrelation awful. Use Barker-like or random PN sync. Long pseudorandom sync works much better:
rng=np.random.default_rng(42)
SYNC_BITS=''.join(
 str(x) for x in rng.integers(0,2,127)
)

rs=reedsolo.RSCodec(RS_PARITY)
# rng=np.random.default_rng(SEED)

############################
# DCT helpers
############################

def dct2(x):
    return dct(dct(x.T,norm='ortho').T,norm='ortho')

def idct2(x):
    return idct(idct(x.T,norm='ortho').T,norm='ortho')


def resize_whatsapp(im):
    w,h=im.size
    m=max(w,h)
    if m<=LONG_EDGE:
        return im
    s=LONG_EDGE/m
    return im.resize((int(w*s),int(h*s)),Image.LANCZOS)



############################
# Packet format
############################

def make_packet(msg):
    payload=msg.encode()
    crc=zlib.crc32(payload).to_bytes(4,'big')
    ln=len(payload).to_bytes(2,'big')
    pkt=ln+payload+crc
    pkt=rs.encode(pkt)

    bits=[int(c) for c in SYNC_BITS]
    bits+=bits_from_bytes(pkt)

    rep=[]
    for b in bits:
        rep.extend([b]*REPEAT)
    return rep


def repetition_decode(bits):
    out=[]
    for i in range(0,len(bits),REPEAT):
        chunk=bits[i:i+REPEAT]
        if len(chunk)<REPEAT:
            break
        out.append(1 if sum(chunk)>REPEAT/2 else 0)
    return out


############################
# Block selection
############################

def valid_blocks(h,w):
    coords=[]
    for i in range(0,h-BLOCK+1,BLOCK):
        for j in range(0,w-BLOCK+1,BLOCK):
            coords.append((i,j))
    return coords


def choose_spreads(nbits, coords, seed=SEED):
    r=np.random.default_rng(seed)
    perm=r.permutation(len(coords))

    needed=nbits*SPREAD
    if needed>len(coords):
        raise ValueError("payload too large")

    idx=[]
    for k in range(nbits):
        idx.append(
            perm[k*SPREAD:(k+1)*SPREAD]
        )
    return idx

############################
# Differential pair embed
############################
# WhatsApp JPEG attacks mid-high frequencies. We want robust midband.
P1,P2=(4,1), (3,2)

def embed_bit(block,bit):
    C=dct2(block)
    a=C[P1]
    b=C[P2]

    d=a-b

    if bit==1:
        if d<DELTA:
            shift=(DELTA-d)/2
            a+=shift
            b-=shift
    else:
        if d>-DELTA:
            shift=(DELTA+d)/2
            a-=shift
            b+=shift

    C[P1]=a
    C[P2]=b
    return idct2(C)


def detect_bit(block):
    C=dct2(block)
    d=C[P1]-C[P2]
    return 1 if d>0 else 0


############################
# EMBED
############################

def embed_image(infile,message,outfile):
    img=Image.open(infile).convert('YCbCr')
    img=resize_whatsapp(img)

    y,cb,cr=img.split()
    Y=np.array(y,dtype=float)

    coords=valid_blocks(*Y.shape)

    bits=make_packet(message)
    if len(bits) > capacity_bits(coords):
        raise ValueError(
        f"Need {len(bits)} bits, have {capacity_bits(coords)}"
        )

    # tile payload multiple times
    full_bits=bits*TILES

    spreads=choose_spreads(len(full_bits),coords)

    for bit_i,bit in enumerate(full_bits):
        for idx in spreads[bit_i]:
            i,j=coords[idx]
            block=Y[i:i+BLOCK,j:j+BLOCK].copy()
            Y[i:i+BLOCK,j:j+BLOCK]=embed_bit(block,bit)

    Y=np.clip(np.round(Y),0,255).astype(np.uint8)

    out=Image.merge(
        'YCbCr',
        (Image.fromarray(Y),cb,cr)
    ).convert('RGB')

    out.save(outfile,quality=95)
    print('saved',outfile)


def decode_image(infile):
    img=Image.open(infile).convert('YCbCr')
    y,_,_=img.split()
    Y=np.array(y,dtype=float)

    coords=valid_blocks(*Y.shape)

    # estimate generous payload size
    maxbits=min(
        len(coords)//SPREAD,
        1024
    )
    spreads=choose_spreads(maxbits,coords)

    raw=[]

    for bit_i in range(maxbits):
        votes=[]
        for idx in spreads[bit_i]:
            i,j=coords[idx]
            block=Y[i:i+BLOCK,j:j+BLOCK]
            votes.append(detect_bit(block))
        raw.append(1 if sum(votes)>len(votes)/2 else 0)

    # split tiles and vote across tiles
    tile_len=maxbits//TILES
    merged=[]
    for k in range(tile_len):
        vals=[]
        for t in range(TILES):
            vals.append(raw[t*tile_len+k])
        merged.append(1 if sum(vals)>TILES/2 else 0)

    bits=repetition_decode(merged)

    start=find_sync(bits)
    if start is None:
        print('sync fail')
        return

    bits=bits[start+len(SYNC_BITS):]

    by=bytes_from_bits(bits)

    # brute-force try RS decode over prefixes
    for n in range(16,min(400,len(by))):
        try:
            dec=rs.decode(by[:n])[0]
            if len(dec)<6:
                continue
            ln=int.from_bytes(dec[:2],'big')
            payload=dec[2:2+ln]
            crc=dec[2+ln:2+ln+4]
            if len(crc)<4:
                continue
            if zlib.crc32(payload).to_bytes(4,'big')==crc:
                msg=payload.decode()
                print('Recovered:',msg)
                return msg
        except:
            pass

    print('decode failed')


############################
# WhatsApp simulator
############################

def simulate_whatsapp(infile,outfile):

    img = Image.open(infile)

    # resize to 1600 max
    w,h = img.size
    m = max(w,h)
    if m > 1600:
        s = 1600/m
        img = img.resize(
            (int(w*s), int(h*s)),
            Image.LANCZOS
        )

    # small drift (optional but realistic)
    img = img.resize(
        (int(img.size[0]*0.99),
         int(img.size[1]*0.99)),
        Image.LANCZOS
    )
    img = img.resize(
        img.size,
        Image.LANCZOS
    )

    img.save(
        outfile,
        quality=np.random.randint(70,81),
        subsampling=2
    )

############################
# Monte Carlo BER test
############################

def stress_test(image_path,msg='hello cedar'):

    embed_image(
        image_path,
        msg,
        'embedded.jpg'
    )

    success=0
    trials=20

    for t in range(trials):
        q=np.random.randint(65,86)

        simulate_whatsapp(
            'embedded.jpg',
            'attacked.jpg',
            quality=q
        )

        try:
            m=decode_image('attacked.jpg')
            if m==msg:
                success+=1
        except:
            pass

    print('success rate',success,'/',trials)


#@markdown missing helpers
def bits_from_bytes(data):
    bits=[]
    for byte in data:
        for k in range(8):
            bits.append((byte >> (7-k)) & 1)
    return bits


def bytes_from_bits(bits):
    out=[]
    for i in range(0,len(bits)-7,8):
        v=0
        for b in bits[i:i+8]:
            v=(v<<1)|b
        out.append(v)
    return bytes(out)

def download_file(file_path):
    with open(file_path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode()
    href = f'<a download="{file_path}" href="data:application/octet-stream;base64,{b64}">📥 Click here to download {file_path}</a>'
    display(HTML(href))

def find_sync(bits):
    sync=[int(c) for c in SYNC_BITS]
    L=len(sync)

    best_offset=None
    best_score=-1

    # search offsets for strongest sync correlation
    for off in range(min(len(bits)-L,1000)):
        score=0
        for k in range(L):
            if bits[off+k]==sync[k]:
                score+=1

        if score>best_score:
            best_score=score
            best_offset=off

    # optional threshold
    if best_score < int(0.8*L):
        return None

    return best_offset

def capacity_bits(coords):
    return len(coords)//SPREAD


def embed_bytes(image_bytes, message,seed):
    seed = hash(seed) % (2**32)
    from io import BytesIO
    img = Image.open(BytesIO(image_bytes)).convert("YCbCr")
    img=resize_whatsapp(img)

    y,cb,cr=img.split()
    Y=np.array(y,dtype=float)

    coords=valid_blocks(*Y.shape)

    bits=make_packet(message)
    if len(bits) > capacity_bits(coords):
        raise ValueError(
        f"Need {len(bits)} bits, have {capacity_bits(coords)}"
        )

    # tile payload multiple times
    full_bits=bits*TILES

    spreads=choose_spreads(len(full_bits),coords,seed=seed)

    for bit_i,bit in enumerate(full_bits):
        for idx in spreads[bit_i]:
            i,j=coords[idx]
            block=Y[i:i+BLOCK,j:j+BLOCK].copy()
            Y[i:i+BLOCK,j:j+BLOCK]=embed_bit(block,bit)

    Y=np.clip(np.round(Y),0,255).astype(np.uint8)

    out=Image.merge(
        'YCbCr',
        (Image.fromarray(Y),cb,cr)
    ).convert('RGB')

    buf = BytesIO()
    # out.save(buf, format="JPEG", quality=95)
    out.save(buf,
        format="JPEG",
        quality=75,
        subsampling=2   # important: 4:2:0 like WhatsApp
    )
    return buf.getvalue()


def decode_bytes(image_bytes,seed):
    seed = hash(seed) % (2**32)
    from io import BytesIO
    img = Image.open(BytesIO(image_bytes)).convert("YCbCr")

    y,_,_=img.split()
    Y=np.array(y,dtype=float)

    coords=valid_blocks(*Y.shape)

    # estimate generous payload size
    maxbits=min(
        len(coords)//SPREAD,
        1024
    )
    spreads=choose_spreads(maxbits,coords,seed=seed)

    raw=[]

    for bit_i in range(maxbits):
        votes=[]
        for idx in spreads[bit_i]:
            i,j=coords[idx]
            block=Y[i:i+BLOCK,j:j+BLOCK]
            votes.append(detect_bit(block))
        raw.append(1 if sum(votes)>len(votes)/2 else 0)

    # split tiles and vote across tiles
    tile_len=maxbits//TILES
    merged=[]
    for k in range(tile_len):
        vals=[]
        for t in range(TILES):
            vals.append(raw[t*tile_len+k])
        merged.append(1 if sum(vals)>TILES/2 else 0)

    bits=repetition_decode(merged)

    start=find_sync(bits)
    if start is None:
        print('sync fail')
        return

    bits=bits[start+len(SYNC_BITS):]

    by=bytes_from_bits(bits)

    # brute-force try RS decode over prefixes
    for n in range(16,min(400,len(by))):
        try:
            dec=rs.decode(by[:n])[0]
            if len(dec)<6:
                continue
            ln=int.from_bytes(dec[:2],'big')
            payload=dec[2:2+ln]
            crc=dec[2+ln:2+ln+4]
            if len(crc)<4:
                continue
            if zlib.crc32(payload).to_bytes(4,'big')==crc:
                msg=payload.decode()
                print('Recovered:',msg)
                return msg
        except:
            pass

    print('decode failed')
