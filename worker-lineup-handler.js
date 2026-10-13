// 既存Workerのfetchハンドラーから、/lineup/suggest の場合だけ呼び出してください。
// 例: if (url.pathname === "/lineup/suggest") return handleLineupSuggest(request, env);
// 必須Secrets: OPENAI_API_KEY, YOUTUBE_API_KEY
export async function handleLineupSuggest(request,env){
 const cors={"Access-Control-Allow-Origin":"https://adhdpad.github.io","Access-Control-Allow-Methods":"GET, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Cache-Control":"no-store"};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
 if(request.method==="OPTIONS")return new Response(null,{headers:cors});
 if(request.method!=="GET")return reply({error:"GETのみ対応"},405);
 const url=new URL(request.url),year=Number(url.searchParams.get("year")),team=(url.searchParams.get("team")||"").trim();
 if(!Number.isInteger(year)||year<1950||year>new Date().getFullYear()||!team||team.length>60)return reply({error:"年度または球団が不正です"},400);
 if(!env.OPENAI_API_KEY||!env.YOUTUBE_API_KEY)return reply({error:"検索APIのSecretsが未設定です"},503);
 try{
  const ytQuery=`${year} ${team} 1-9 応援歌`;let video=null;
  const ytUrl="https://www.googleapis.com/youtube/v3/search?"+new URLSearchParams({part:"snippet",type:"video",maxResults:"5",q:ytQuery,key:env.YOUTUBE_API_KEY});
  const ytRes=await fetch(ytUrl);if(!ytRes.ok)throw new Error("YouTube検索に失敗しました");
  const yt=await ytRes.json();const videos=(yt.items||[]).map(v=>({title:v.snippet?.title||"",description:v.snippet?.description||"",id:v.id?.videoId||""})).filter(v=>v.id);
  // 動画の題名・説明文だけで実際の打順を断定しない。
  const prompt=`球団: ${team}、年度: ${year}。まずYouTubeの検索結果を参考に、年度・球団が一致し打順が説明文から判別できる場合のみその打順を優先してください。判別できなければ当該年度の起用実績を推定した代表的な1-9を作ってください。架空の選手を作らず、不確かな場合は空欄にしてください。候補動画: ${JSON.stringify(videos).slice(0,4500)}。JSONオブジェクトだけ返答: {"source":"youtube"または"estimated","sourceUrl":"根拠となる動画URL、なければ空文字","lineup":[{"name":"選手名","position":"守備位置"}]}。守備位置は 投手,捕手,一塁手,二塁手,三塁手,遊撃手,左翼手,中堅手,右翼手,指名打者,代打 のいずれか。1-9は9名。`;
  const ai=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",temperature:0.2,response_format:{type:"json_object"},messages:[{role:"system",content:"日本プロ野球の打順候補を慎重に作成する。動画のタイトルだけで打順を捏造しない。"},{role:"user",content:prompt}]})});
  if(!ai.ok)throw new Error("AI候補作成に失敗しました");
  const data=await ai.json();const result=JSON.parse(data.choices?.[0]?.message?.content||"{}");
  const allowed=new Set(["投手","捕手","一塁手","二塁手","三塁手","遊撃手","左翼手","中堅手","右翼手","指名打者","代打"]);
  const lineup=(Array.isArray(result.lineup)?result.lineup:[]).slice(0,9).map(x=>({name:String(x.name||"").slice(0,60),position:allowed.has(x.position)?x.position:""}));
  if(!lineup.length)return reply({error:"候補を生成できませんでした"},502);
  const validVideo=videos.find(v=>`https://www.youtube.com/watch?v=${v.id}`===result.sourceUrl);
  return reply({source:result.source==="youtube"&&validVideo?"youtube":"estimated",sourceUrl:validVideo?result.sourceUrl:"",lineup});
 }catch(e){return reply({error:String(e.message||e)},502)}
}
