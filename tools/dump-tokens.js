const fs=require('fs');
const rom=fs.readFileSync('/home/user/sinclair-1982/roms/48.rom');
// Token table: entries end with a byte having bit 7 set. First token is code 165 (RND).
let p=0x0095, out=[], code=165, cur='';
while(code<=255){
  const b=rom[p++];
  cur+=String.fromCharCode(b&0x7f);
  if(b&0x80){ out.push([code,cur]); cur=''; code++; }
}
console.log('token table $0095..$'+(p-1).toString(16).toUpperCase());
console.log(out.map(([c,s])=>c+'='+JSON.stringify(s)).join(' '));
fs.writeFileSync('/home/user/sinclair-1982/tools/tokens.json',JSON.stringify(Object.fromEntries(out),null,0));
