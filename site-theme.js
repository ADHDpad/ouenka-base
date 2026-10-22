(()=>{'use strict';
const KEY='ouenkaSiteThemeV1',valid=c=>/^#[0-9a-f]{6}$/i.test(c||''),defaults={main:'#0b2f55',background:'#ffffff'};
const read=()=>{try{const t=JSON.parse(localStorage.getItem(KEY));return valid(t?.main)&&valid(t?.background)?t:null}catch{return null}};
const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));
const mix=(a,b,t)=>'#'+rgb(a).map((n,i)=>Math.round(n*(1-t)+rgb(b)[i]*t).toString(16).padStart(2,'0')).join('');
const ink=c=>{const v=rgb(c).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722>.179?'#102030':'#ffffff'};
function apply(t){const root=document.documentElement;if(!t){delete root.dataset.siteTheme;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',document.querySelector('meta[name="theme-color"]').dataset.original||'#071d33');return}root.dataset.siteTheme='custom';const text=ink(t.background),values={'--site-bar-background':t.gradient&&valid(t.end)?`linear-gradient(${[90,135,180].includes(Number(t.angle))?Number(t.angle):135}deg,${t.main},${t.end})`:t.main,'--site-main':t.main,'--site-main-dark':mix(t.main,ink(t.main)==='#ffffff'?'#000000':'#ffffff',ink(t.main)==='#ffffff'?.32:.12),'--site-main-ink':t.gradient&&valid(t.end)?ink(mix(t.main,t.end,.5)):ink(t.main),'--site-bg':t.background,'--site-text':text,'--site-muted':mix(text,t.background,.28),'--site-surface':mix(t.background,text,.04),'--site-line':mix(t.background,text,.22)};for(const [k,v]of Object.entries(values))root.style.setProperty(k,v);const meta=document.querySelector('meta[name="theme-color"]');if(meta){meta.dataset.original ||=meta.content;meta.content=t.main}}
window.OuenkaSiteTheme={apply,read,defaults};apply(read());
window.addEventListener('storage',e=>{if(e.key===KEY)apply(read())});
document.addEventListener('DOMContentLoaded',()=>{
const main=document.getElementById('siteThemeMain'),bg=document.getElementById('siteThemeBackground');if(!main||!bg)return;
const status=document.getElementById('siteThemeStatus'),toggle=document.getElementById('siteThemeGradientToggle'),fields=document.getElementById('siteThemeGradientFields'),end=document.getElementById('siteThemeEnd'),angle=document.getElementById('siteThemeAngle'),swatch=document.getElementById('siteThemePreview');let gradient=false;
const current=()=>({main:main.value,background:bg.value,gradient,end:end.value,angle:Number(angle.value)});
function draw(){fields.hidden=!gradient;toggle.textContent=gradient?'− グラデーションを解除':'＋ グラデーションを追加';toggle.setAttribute('aria-expanded',String(gradient));swatch.style.background=gradient?`linear-gradient(${angle.value}deg,${main.value},${end.value})`:main.value;swatch.style.color=ink(gradient?mix(main.value,end.value,.5):main.value)}
function load(){const t=read()||defaults;main.value=t.main;bg.value=t.background;end.value=valid(t.end)?t.end:'#168ac0';angle.value=String([90,135,180].includes(Number(t.angle))?t.angle:135);gradient=!!t.gradient;draw()}
const preview=()=>{apply(current());draw();status.textContent='プレビュー中です。「配色を保存」で保存します。'};
main.oninput=bg.oninput=end.oninput=angle.onchange=preview;toggle.onclick=()=>{gradient=!gradient;preview()};
document.querySelectorAll('[data-theme-main]').forEach(b=>b.onclick=()=>{main.value=b.dataset.themeMain;bg.value=b.dataset.themeBackground||'#ffffff';preview()});
document.getElementById('siteThemeSave').onclick=()=>{try{const t=current();localStorage.setItem(KEY,JSON.stringify(t));apply(t);status.textContent='配色を保存しました。この端末の各画面に反映します。'}catch{status.textContent='配色を保存できませんでした。'}};
document.getElementById('siteThemeReset').onclick=()=>{try{localStorage.removeItem(KEY);apply(null);load();status.textContent='標準の配色に戻しました。'}catch{status.textContent='配色を戻せませんでした。'}};load();
});
})();
