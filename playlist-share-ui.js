(()=>{'use strict';const $=id=>document.getElementById(id),api=window.OuenkaPlaylistShare,dialog=$('playlistShareDialog'),status=$('playlistShareStatus');let pending=null,token=0;
function message(text){status.textContent=text}
$('playlistShareButton').onclick=()=>{pending=null;token++;$('playlistShareApply').hidden=true;message('');if(!dialog.open)dialog.showModal()};$('playlistShareClose').onclick=()=>{token++;dialog.close()};dialog.addEventListener('close',()=>{token++;pending=null});
$('playlistShareCreate').onclick=async()=>{
 const button=$('playlistShareCreate'),at=++token;button.disabled=true;try{
  const data={...lineupSnapshot(),version:1,mode:IS_MEDLEY?'medley':'lineup'};
  const code=await api.encode(data);if(at!==token)return;$('playlistShareCode').value=code;pending=null;$('playlistShareApply').hidden=true;message('数字4桁の共有コードを作成しました。有効期限は1時間です。');
 }catch(error){message(error.message)}finally{button.disabled=false}
};
$('playlistShareCopy').onclick=async()=>{const field=$('playlistShareCode');if(!field.value.trim()){message('先にコードを作成してください。');return}try{await navigator.clipboard.writeText(field.value);message('共有コードをコピーしました。')}catch{field.focus();field.select();message('コードを選択しました。コピーしてください。')}};
$('playlistShareRead').onclick=async()=>{const at=++token,button=$('playlistShareRead');button.disabled=true;pending=null;$('playlistShareApply').hidden=true;try{
 const data=await api.decode($('playlistShareCode').value);if(at!==token)return;pending=data;message('「'+data.title+'」／'+(data.mode==='medley'?'メドレー':'1-9')+'／'+data.rows.filter(r=>r.name).length+'曲\n'+data.rows.map((r,i)=>r.name?(i+1)+'. '+r.name:'').filter(Boolean).join('\n'));$('playlistShareApply').hidden=false;
 }catch(error){message(error.message)}finally{button.disabled=false}};
$('playlistShareCode').addEventListener('input',()=>{token++;pending=null;$('playlistShareApply').hidden=true});
$('playlistShareApply').onclick=()=>{if(!pending)return;try{const saved=api.save(pending);message('「'+saved.title+'」を保存済み一覧に追加しました。'+(pending.mode==='medley'?'メドレー':'1-9')+'の「保存済を読込」から開けます。');pending=null;$('playlistShareApply').hidden=true}catch(error){message('保存できませんでした。'+error.message)}};
})();
