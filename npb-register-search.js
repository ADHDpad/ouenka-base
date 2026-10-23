(()=>{'use strict';
const normal=s=>String(s||'').normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96)).replace(/[\s　・･.．]/g,'').toLowerCase();
const kana=p=>String(p.reading||'').split(/[（(]/)[0].trim();
const teamAliases={'広島東洋':'広島東洋カープ','北海道日本ハム':'北海道日本ハムファイターズ','日本ハム':'北海道日本ハムファイターズ','中日':'中日ドラゴンズ','読売':'読売ジャイアンツ','阪神':'阪神タイガース','横浜DeNA':'横浜DeNAベイスターズ','ヤクルト':'東京ヤクルトスワローズ','東京ヤクルト':'東京ヤクルトスワローズ','西武':'埼玉西武ライオンズ','埼玉西武':'埼玉西武ライオンズ','千葉ロッテ':'千葉ロッテマリーンズ','東北楽天':'東北楽天ゴールデンイーグルス','福岡ソフトバンク':'福岡ソフトバンクホークス','オリックス':'オリックス・バファローズ','オリックス・ブルーウェーブ':'ブルーウェーブ','近鉄':'近鉄'};
const el=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n};
async function apply(player,query){
 if(el('playerName').value.trim()!==query)return run();
 el('playerName').value=player.name;if(player.reading)el('reading').value=kana(player).replace(/[・･\s　]/g,'');
 const select=el('team');let team=player.team;
 if(!team&&player.careerTeams?.length===1)team=teamAliases[normal(player.careerTeams[0])];
 if(team&&[...select.options].some(o=>o.value===team))select.value=team;
 if(player.uniform_number!==undefined&&player.uniform_number!==null&&String(player.uniform_number)!=='')el('number').value=player.uniform_number;
 await window.updateProductionNumber?.();const result=el('playerSearchResult');result.className='player-search-result success';result.replaceChildren();result.append(node('strong','✓ NPB公式名簿から取得しました'),node('div','選手名：'+player.name),node('div','読み仮名：'+(kana(player)||'取得なし')));
 result.append(node('div',player.team?'球団：'+player.team:'所属歴：'+((player.careerTeams||[]).join('・')||'登録する球団を選択してください')));
 if(!player.team)result.append(node('small','歴代選手の登録先球団・背番号は、必要に応じて指定してください。'));
 const url=new URL(player.sourceUrl);if(url.protocol==='https:'&&url.hostname==='npb.jp'){const link=node('a','NPB公式プロフィール');link.href=url.href;link.target='_blank';link.rel='noopener';result.append(link)}
}
async function run(){const input=el('playerName'),query=input.value.trim(),result=el('playerSearchResult'),button=el('playerSearchButton');
 if(!query){result.className='player-search-result error';result.textContent='選手名を入力してください。';return}
 button.disabled=true;button.textContent='検索中…';result.className='player-search-result loading';result.textContent='NPB公式名簿を検索しています…';
 try{const players=await window.OuenkaNpbDirectory.load();if(input.value.trim()!==query)return;const q=normal(query),names=p=>[p.name,...(p.aliases||[]),kana(p)],matches=players.filter(p=>names(p).some(v=>normal(v).includes(q))),exact=matches.filter(p=>names(p).some(v=>normal(v)===q));
 if(exact.length===1){await apply(exact[0],query);return}
 if(!matches.length){result.className='player-search-result error';result.textContent='該当する選手が見つかりません。苗字だけ、またはひらがなでも検索できます。';return}
 let visible=20;const render=()=>{result.className='player-search-result npb-directory-results';result.replaceChildren();result.append(node('div','NPB公式名簿：'+matches.length.toLocaleString()+'名。選手を選んでください。'));for(const p of matches.slice(0,visible)){const candidate=node('button','');candidate.type='button';candidate.className='npb-directory-candidate';candidate.append(node('strong',p.name),node('small',kana(p)),node('small',p.team||((p.careerTeams||[]).join('・')||'歴代選手')+(p.firstYear?' / '+p.firstYear+'–'+p.lastYear+'年':'')));candidate.onclick=()=>apply(p,query).catch(()=>{result.textContent='選手情報を反映できませんでした。もう一度検索してください。'});result.append(candidate)}if(matches.length>visible){const more=node('button','もっと表示（残り '+(matches.length-visible)+'名）');more.type='button';more.className='npb-directory-candidate';more.onclick=()=>{visible+=20;render()};result.append(more)}};render();
 }catch(e){result.className='player-search-result error';result.textContent='NPB名簿を読み込めませんでした。ページを開き直してください。'}finally{button.disabled=false;button.textContent='NPBから取得'}
}
window.OuenkaNpbRegisterSearch={run,normal};
})();
