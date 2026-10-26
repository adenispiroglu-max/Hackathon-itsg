import hashlib
import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self,path,seed):
        self.path=str(path); self.lock=threading.RLock()
        Path(path).parent.mkdir(parents=True,exist_ok=True)
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS items(kind TEXT,id TEXT,data TEXT,PRIMARY KEY(kind,id))')
            db.execute('CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT,action TEXT,data TEXT,prev TEXT,hash TEXT)')
        with self.lock:
            if not self.list('document'):
                for kind,key in [('document','documents'),('requirement','requirements'),('case','cases')]:
                    for item in seed[key]:self.put(kind,item)
                self.put('meta',{'id':'chain','steps':seed['chain']})
                self.event('seed',{'note':'All substantive approvals pending.'})

    def connect(self):
        db=sqlite3.connect(self.path, timeout=20)
        db.execute('PRAGMA journal_mode=WAL')
        return db

    def list(self,kind):
        with self.connect() as db:
            return [json.loads(r[0]) for r in db.execute('SELECT data FROM items WHERE kind=? ORDER BY rowid',(kind,))]

    def get(self,kind,id):
        with self.connect() as db:
            row=db.execute('SELECT data FROM items WHERE kind=? AND id=?',(kind,id)).fetchone()
        if row is None: raise KeyError(id)
        return json.loads(row[0])

    def put(self,kind,item):
        with self.lock,self.connect() as db:
            db.execute('INSERT INTO items VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
                       (kind,item['id'],json.dumps(item,ensure_ascii=False)))
        return item

    def event(self,action,data):
        with self.lock,self.connect() as db:
            last=db.execute('SELECT hash FROM events ORDER BY seq DESC LIMIT 1').fetchone()
            prev=last[0] if last else ''; at=now(); payload=json.dumps(data,sort_keys=True,ensure_ascii=False)
            hash=hashlib.sha256((prev+at+action+payload).encode()).hexdigest()
            db.execute('INSERT INTO events(at,action,data,prev,hash) VALUES(?,?,?,?,?)',(at,action,payload,prev,hash))

    def events(self):
        with self.connect() as db:
            return [dict(seq=r[0],at=r[1],action=r[2],data=json.loads(r[3]),prev=r[4],hash=r[5]) for r in db.execute('SELECT * FROM events ORDER BY seq')]
