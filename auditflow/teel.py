"""Synthetic DSLW/DBVO record in the prototype's sample-specific layout (see parser.py).
Mirrors scripts/synthetic_fixture.py. Not a validated general DTA-EEL writer; no personal data.
"""
from .parser import parse

FLAGS=b'JNNNNNNNNNJNNNNNJJN' # DBNA, DBVO, DBAP, DBID as in the supplied sample.


def ymd(iso):return iso.replace('-','').encode()


def build_dslw(au_ab_ag,periods,record_id):
    header=bytearray(b' '*224)
    header[:4]=b'DSLW';header[98:134]=record_id.encode()[:36].ljust(36);header[200:202]=b'41';header[205:224]=FLAGS
    name=b'DBNA'+b'SYNTHETIC TEST PERSON'.ljust(121,b' ')
    dbvo=b'DBVO1'+ymd(au_ab_ag)+b'0'*17+f'{len(periods):02d}'.encode()
    for begin,end in periods:dbvo+=ymd(begin)+ymd(end)+b'0'*34
    contact=b'DBAP'+b'SYNTHETIC CONTACT - NO REAL PERSON'.ljust(316,b' ')
    reference=b'DBID'+b' '*20+b'DEMO-REFERENCE-001'.ljust(20,b' ')+b' '*36
    raw=bytes(header)+name+dbvo+contact+reference+b'\r\n'
    parse(raw) # Self-check against the prototype parser; raises on any layout drift.
    return raw
