const fs=require('fs');
const rom=fs.readFileSync('/home/user/sinclair-1982/roms/48.rom');
function show(name,addr,len){
  const b=rom.subarray(addr,addr+len);
  const chars=[...b].map(x=>x>=32&&x<127?String.fromCharCode(x):'.'+x.toString(16).padStart(2,'0')+'.').join(' ');
  console.log(`--- ${name} $${addr.toString(16).toUpperCase()} (${len}) ---`);
  console.log(chars);
}
show('KEY-TABLE main',0x0205,0x22C-0x0205);
show('E-mode letters',0x022C,0x246-0x022C);
show('E-mode + SS',0x0246,0x260-0x0246);
show('CTRL codes',0x0260,0x26A-0x0260);
show('SS symbols',0x026A,0x284-0x026A);
show('K-mode keywords',0x0284,0x02AB-0x0284);
