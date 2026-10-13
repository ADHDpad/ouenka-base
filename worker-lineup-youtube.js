// OUENKA BASE: YouTube description-based lineup endpoint.
// Add inside existing Worker's fetch routing:
// if (url.pathname === '/lineup/suggest') return handleLineupSuggest(request, env);
// Also paste this function below your existing Worker code. Secret: YOUTUBE_API_KEY.
async function handleLineupSuggest(request, env) {
  const headers = {'Access-Control-Allow-Origin':'https://adhdpad.github.io','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'};
  const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return reply({error:'GETのみ対応'},405);
  const u=new URL(request.url), year=Number(u.searchParams.get('year')),team=(u.searchParams.get('team')||'').trim();
  if(!Number.isInteger(year)||year<1950||year>new Date().getFullYear()||!team||team.length>60)return reply({error:'年度・球団を確認してください'},400);
  if(!env.YOUTUBE_API_KEY)return reply({error:'YOUTUBE_API_KEYが未設定です'},503);
  try {
    const api='https://www.googleapis.com/youtube/v3/';
    const search=new URLSearchParams({part:'snippet',type:'video',maxResults:'10',q:`${year} ${team} 1-9 応援歌`,key:env.YOUTUBE_API_KEY});
    const sr=await fetch(api+'search?'+search);const sj=await sr.json();
    if(!sr.ok)throw Error(sj.error?.message||'YouTube検索エラー');
    const ids=(sj.items||[]).map(x=>x.id?.videoId).filter(Boolean);
    if(!ids.length)return reply({error:'該当する動画が見つかりませんでした'},404);
    const details=new URLSearchParams({part:'snippet',id:ids.join(','),key:env.YOUTUBE_API_KEY});
    const vr=await fetch(api+'videos?'+details);const vj=await vr.json();
    if(!vr.ok)throw Error(vj.error?.message||'動画情報取得エラー');
    const aliases={'北海道日本ハムファイターズ':['日本ハム','日ハム','ファイターズ'],'福岡ソフトバンクホークス':['ソフトバンク','ホークス'],'東北楽天ゴールデンイーグルス':['楽天','イーグルス'],'埼玉西武ライオンズ':['西武','ライオンズ'],'千葉ロッテマリーンズ':['ロッテ','マリーンズ'],'オリックス・バファローズ':['オリックス','バファローズ'],'読売ジャイアンツ':['巨人','ジャイアンツ'],'阪神タイガース':['阪神','タイガース'],'横浜DeNAベイスターズ':['DeNA','ベイスターズ','横浜'],'広島東洋カープ':['広島','カープ'],'東京ヤクルトスワローズ':['ヤクルト','スワローズ'],'中日ドラゴンズ':['中日','ドラゴンズ']};
    const names=[team,...(aliases[team]||[])];
    const videos=(vj.items||[]).filter(v=>{const title=v.snippet?.title||'';return title.includes(String(year))&&names.some(n=>title.toLowerCase().includes(n.toLowerCase()))&&/(1\s*[-－〜～]\s*9|1\s*～\s*9|1\s*から\s*9|一\s*九|スタメン|応援歌)/i.test(title)});
    const positions={'投':'投手','捕':'捕手','一':'一塁手','二':'二塁手','三':'三塁手','遊':'遊撃手','左':'左翼手','中':'中堅手','右':'右翼手','指':'指名打者','DH':'指名打者'};
    function parse(description){
      const found=new Map();
      for(const line of description.split(/\r?\n/)){
        // Explicit batting-order lines only. Avoid interpreting video timestamps as batting orders.
        const m=line.trim().match(/^(?:[（(【\[]?\s*([1-9])\s*[）)】\].．、番位:\-－]|([1-9])番\s*)\s*(?:打者\s*)?(?:[（(]?\s*(投手|捕手|一塁手|二塁手|三塁手|遊撃手|左翼手|中堅手|右翼手|指名打者|DH|[投捕一二三遊左中右指])\s*[）)]?\s*)?([^\d\s:：#｜|／/]{2,24}(?:[ 　・][^\d\s:：#｜|／/]{1,20})?)/);
        if(!m)continue;
        const n=Number(m[1]||m[2]);let name=m[4].trim().replace(/\s*(?:選手|応援歌|テーマ|チャンステーマ).*$/,'').trim();
        if(!name||name.length>35||/^(https?|動画|説明|打順)/.test(name))continue;
        const p=m[3]||'';found.set(n,{name,position:positions[p]||p});
      }
      return found.size===9?Array.from({length:9},(_,i)=>found.get(i+1)).filter(Boolean):null;
    }
    for(const video of videos){const lineup=parse(video.snippet?.description||'');if(lineup&&lineup.length===9)return reply({source:'youtube',sourceUrl:`https://www.youtube.com/watch?v=${video.id}`,lineup});}
    return reply({error:'動画は見つかりましたが、説明欄に1〜9番の選手名が揃っていません。画面内の文字を読む機能はまだ未対応です。',videos:videos.slice(0,5).map(v=>({title:v.snippet?.title,url:`https://www.youtube.com/watch?v=${v.id}`}))},422);
  } catch(e){return reply({error:String(e.message||e)},502)}
}
