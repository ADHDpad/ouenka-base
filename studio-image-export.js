(()=>{'use strict';
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
async function zipImages(files){
 const chunks=[],directory=[];let offset=0,directorySize=0;
 for(const file of files){
  const name=new TextEncoder().encode(file.name),data=new Uint8Array(await file.arrayBuffer()),crc=crc32(data);
  const header=new Uint8Array(30+name.length),h=new DataView(header.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);header.set(name,30);
  const central=new Uint8Array(46+name.length),c=new DataView(central.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);central.set(name,46);
  chunks.push(header,data);directory.push(central);offset+=header.length+data.length;directorySize+=central.length;
 }
 const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,directorySize,true);view.setUint32(16,offset,true);
 return new File([...chunks,...directory,end],'挿絵一括.zip',{type:'application/zip'});
}
window.OuenkaImageExport={zipImages,async save(files,area){
 if(!files.length)throw Error('保存する画像がありません。');
 try{if(navigator.canShare?.({files})){await navigator.share({files});return}}catch(error){if(error.name==='AbortError')return}
 const file=files.length===1?files[0]:await zipImages(files),url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.textContent=file.name+'をダウンロード';
 if(area){for(const old of area.querySelectorAll('a'))URL.revokeObjectURL(old.href);area.replaceChildren(link)}
 link.click();setTimeout(()=>URL.revokeObjectURL(url),300000);
}};
})();
