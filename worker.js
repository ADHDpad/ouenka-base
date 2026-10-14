const WORKER_BUILD = "lineup-popular-filtered-20261014-r6";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
export default {
  async fetch(request, env) {
    // ==========================================
    // CORS
    // ==========================================
    if (request.method === "OPTIONS") {
      return new Response(
        null,
        {
          status: 204,
          headers: CORS_HEADERS
        }
      );
    }
    try {
      const url =
        new URL(request.url);
      // ==========================================
      // 動作確認
      // GET /
      // ==========================================
      if (
        url.pathname === "/" &&
        request.method === "GET"
      ) {
        return json({
          ok: true,
          service: "OUENKA BASE DATA API",
          version: "1.2.1",
          build: WORKER_BUILD,
          database: "connected"
        });
      }
      // ==========================================
      // 公開中コードの確認（YouTube APIを消費しない）
      if (url.pathname === "/lineup/version" && request.method === "GET") {
        return json({ok:true,build:WORKER_BUILD,selection:"viewcount_exclude_opening_require_1-9"});
      }
      // ==========================================
      // 応援歌一覧
      // GET /songs
      // ==========================================
      if (
        url.pathname === "/songs" &&
        request.method === "GET"
      ) {
        const result =
          await env.DB.prepare(`
            SELECT
              id,
              player_name,
              reading,
              team,
              player_type,
              uniform_number,
              production_number,
              lyrics,
              audio_filename,
              garageband_filename,
              melody_filename,
              chord_filename,
              bass_filename,
              created_at
            FROM songs
            ORDER BY
              player_name ASC,
              production_number ASC
          `)
          .all();
        return json({
          ok: true,
          count: result.results.length,
          songs: result.results
        });
      }
      // ==========================================
      // 1曲取得
      // GET /songs/1
      // ==========================================
      if (
        request.method === "GET" &&
        /^\/songs\/\d+$/.test(
          url.pathname
        )
      ) {
        const id =
          Number(
            url.pathname
              .split("/")
              .pop()
          );
        const song =
          await env.DB.prepare(`
            SELECT
              id,
              player_name,
              reading,
              team,
              player_type,
              uniform_number,
              production_number,
              lyrics,
              audio_filename,
              garageband_filename,
              melody_filename,
              chord_filename,
              bass_filename,
              created_at
            FROM songs
            WHERE id = ?
          `)
          .bind(id)
          .first();
        if (!song) {
          return json(
            {
              ok: false,
              error: "登録データが見つかりません"
            },
            404
          );
        }
        return json({
          ok: true,
          song
        });
      }
      // ==========================================
      // 選手検索
      // GET /songs/search?q=郡司
      // ==========================================
      if (
        url.pathname === "/songs/search" &&
        request.method === "GET"
      ) {
        const q =
          (
            url.searchParams.get("q") ||
            ""
          )
          .trim();
        if (!q) {
          return json({
            ok: true,
            count: 0,
            songs: []
          });
        }
        const keyword =
          `%${q}%`;
        const result =
          await env.DB.prepare(`
            SELECT
              id,
              player_name,
              reading,
              team,
              player_type,
              uniform_number,
              production_number,
              lyrics,
              audio_filename,
              garageband_filename,
              melody_filename,
              chord_filename,
              bass_filename,
              created_at
            FROM songs
            WHERE
              player_name LIKE ?
              OR reading LIKE ?
            ORDER BY
              player_name ASC,
              production_number ASC
            LIMIT 10
          `)
          .bind(
            keyword,
            keyword
          )
          .all();
        return json({
          ok: true,
          count: result.results.length,
          songs: result.results
        });
      }
      // ==========================================
      // 次の制作番号
      // GET /songs/next-number?name=郡司裕也
      // ==========================================
      if (
        url.pathname === "/songs/next-number" &&
        request.method === "GET"
      ) {
        const name =
          (
            url.searchParams.get("name") ||
            ""
          )
          .trim();
        if (!name) {
          return json(
            {
              ok: false,
              error: "選手名が必要です"
            },
            400
          );
        }
        const row =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS song_count
            FROM songs
            WHERE player_name = ?
          `)
          .bind(name)
          .first();
        const count =
          Number(
            row?.song_count || 0
          );
        return json({
          ok: true,
          player_name: name,
          registered_count: count,
          next_production_number:
            count + 1
        });
      }
      // ==========================================
      // 新規登録
      // POST /songs
      // ==========================================
      if (
        url.pathname === "/songs" &&
        request.method === "POST"
      ) {
        let body;
        try {
          body =
            await request.json();
        } catch {
          return json(
            {
              ok: false,
              error:
                "JSONデータを読み込めませんでした"
            },
            400
          );
        }
        const playerName =
          clean(
            body.player_name
          );
        const reading =
          clean(
            body.reading
          );
        const team =
          clean(
            body.team
          );
        const playerType =
          clean(
            body.player_type
          );
        const uniformNumber =
          parseNumberOrNull(
            body.uniform_number
          );
        const lyrics =
          String(
            body.lyrics ?? ""
          );
        const audioFilename =
          clean(
            body.audio_filename
          );
        const garageBandFilename =
          clean(
            body.garageband_filename
          );
        const melodyFilename =
          clean(
            body.melody_filename
          );
        const chordFilename =
          clean(
            body.chord_filename
          );
        const bassFilename =
          clean(
            body.bass_filename
          );
        const validation =
          validateSong(
            playerName,
            team,
            playerType
          );
        if (validation) {
          return json(
            {
              ok: false,
              error: validation
            },
            400
          );
        }
        // ========================================
        // 制作番号自動採番
        // ========================================
        const countRow =
          await env.DB.prepare(`
            SELECT
              COUNT(*) AS song_count
            FROM songs
            WHERE player_name = ?
          `)
          .bind(playerName)
          .first();
        const productionNumber =
          Number(
            countRow?.song_count || 0
          ) + 1;
        // ========================================
        // INSERT
        // ========================================
        const result =
          await env.DB.prepare(`
            INSERT INTO songs (
              player_name,
              reading,
              team,
              player_type,
              uniform_number,
              production_number,
              lyrics,
              audio_filename,
              garageband_filename,
              melody_filename,
              chord_filename,
              bass_filename
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `)
          .bind(
            playerName,
            reading,
            team,
            playerType,
            uniformNumber,
            productionNumber,
            lyrics,
            audioFilename,
            garageBandFilename,
            melodyFilename,
            chordFilename,
            bassFilename
          )
          .run();
        return json(
          {
            ok: true,
            message: "登録しました",
            id:
              result.meta.last_row_id,
            player_name:
              playerName,
            production_number:
              productionNumber
          },
          201
        );
      }
      // ==========================================
      // 既存データ更新
      // PUT /songs/1
      // ==========================================
      if (
        request.method === "PUT" &&
        /^\/songs\/\d+$/.test(
          url.pathname
        )
      ) {
        const id =
          Number(
            url.pathname
              .split("/")
              .pop()
          );
        const current =
          await env.DB.prepare(`
            SELECT *
            FROM songs
            WHERE id = ?
          `)
          .bind(id)
          .first();
        if (!current) {
          return json(
            {
              ok: false,
              error:
                "更新するデータが見つかりません"
            },
            404
          );
        }
        let body;
        try {
          body =
            await request.json();
        } catch {
          return json(
            {
              ok: false,
              error:
                "JSONデータを読み込めませんでした"
            },
            400
          );
        }
        const playerName =
          hasOwn(
            body,
            "player_name"
          )
            ? clean(
                body.player_name
              )
            : current.player_name;
        const reading =
          hasOwn(
            body,
            "reading"
          )
            ? clean(
                body.reading
              )
            : current.reading;
        const team =
          hasOwn(
            body,
            "team"
          )
            ? clean(
                body.team
              )
            : current.team;
        const playerType =
          hasOwn(
            body,
            "player_type"
          )
            ? clean(
                body.player_type
              )
            : current.player_type;
        const uniformNumber =
          hasOwn(
            body,
            "uniform_number"
          )
            ? parseNumberOrNull(
                body.uniform_number
              )
            : current.uniform_number;
        const lyrics =
          hasOwn(
            body,
            "lyrics"
          )
            ? String(
                body.lyrics ?? ""
              )
            : current.lyrics;
        const audioFilename =
          hasOwn(
            body,
            "audio_filename"
          )
            ? clean(
                body.audio_filename
              )
            : current.audio_filename;
        const garageBandFilename =
          hasOwn(
            body,
            "garageband_filename"
          )
            ? clean(
                body.garageband_filename
              )
            : current.garageband_filename;
        const melodyFilename =
          hasOwn(
            body,
            "melody_filename"
          )
            ? clean(
                body.melody_filename
              )
            : current.melody_filename;
        const chordFilename =
          hasOwn(
            body,
            "chord_filename"
          )
            ? clean(
                body.chord_filename
              )
            : current.chord_filename;
        const bassFilename =
          hasOwn(
            body,
            "bass_filename"
          )
            ? clean(
                body.bass_filename
              )
            : current.bass_filename;
        const validation =
          validateSong(
            playerName,
            team,
            playerType
          );
        if (validation) {
          return json(
            {
              ok: false,
              error: validation
            },
            400
          );
        }
        // ========================================
        // UPDATE
        // production_number は変更しない
        // ========================================
        await env.DB.prepare(`
          UPDATE songs
          SET
            player_name = ?,
            reading = ?,
            team = ?,
            player_type = ?,
            uniform_number = ?,
            lyrics = ?,
            audio_filename = ?,
            garageband_filename = ?,
            melody_filename = ?,
            chord_filename = ?,
            bass_filename = ?
          WHERE id = ?
        `)
        .bind(
          playerName,
          reading,
          team,
          playerType,
          uniformNumber,
          lyrics,
          audioFilename,
          garageBandFilename,
          melodyFilename,
          chordFilename,
          bassFilename,
          id
        )
        .run();
        const updated =
          await env.DB.prepare(`
            SELECT
              id,
              player_name,
              reading,
              team,
              player_type,
              uniform_number,
              production_number,
              lyrics,
              audio_filename,
              garageband_filename,
              melody_filename,
              chord_filename,
              bass_filename,
              created_at
            FROM songs
            WHERE id = ?
          `)
          .bind(id)
          .first();
        return json({
          ok: true,
          message: "更新しました",
          song: updated
        });
      }
      // ==========================================
      // ★ 登録データ削除
      // DELETE /songs/1
      // ==========================================
      if (
        request.method === "DELETE" &&
        /^\/songs\/\d+$/.test(
          url.pathname
        )
      ) {
        const id =
          Number(
            url.pathname
              .split("/")
              .pop()
          );
        // 削除するデータを確認
        const current =
          await env.DB.prepare(`
            SELECT
              id,
              player_name,
              production_number
            FROM songs
            WHERE id = ?
          `)
          .bind(id)
          .first();
        if (!current) {
          return json(
            {
              ok: false,
              error:
                "削除するデータが見つかりません"
            },
            404
          );
        }
        // D1から削除
        await env.DB.prepare(`
          DELETE FROM songs
          WHERE id = ?
        `)
        .bind(id)
        .run();
        return json({
          ok: true,
          message: "削除しました",
          id: id,
          player_name:
            current.player_name,
          production_number:
            current.production_number
        });
      }
      // ==========================================
      // ==========================================
      // YouTube 1-9 検索（APIキーはCloudflare Secret）
      // GET /lineup/suggest?team=日本ハム&year=2024
      // POST /lineup/suggest  {"team":"日本ハム","year":2024}
      // ==========================================
      if (["/lineup/suggest", "/lineup/search", "/youtube/search"].includes(url.pathname)
          && ["GET", "POST"].includes(request.method)) {
        let params = {};
        if (request.method === "POST") {
          try { params = await request.json(); }
          catch { return json({ok:false,error:"JSON形式が正しくありません"},400); }
        }
        const team = clean(params.team ?? params.teamName ?? params.team_name ?? url.searchParams.get("team") ?? url.searchParams.get("teamName") ?? url.searchParams.get("team_name"));
        const year = Number(params.year ?? url.searchParams.get("year"));
        if (!team || team.length > 80 || !Number.isInteger(year) || year < 1936 || year > 2100) {
          return json({ok:false,error:"球団名(team)と年度(year)を指定してください"},400);
        }
        
        try {
          // 今回は指定条件のYouTube人気順を優先。確認済みD1打順による先取りは行わない。
          if (!env.YOUTUBE_API_KEY) return json({ok:false,error:"YOUTUBE_API_KEY が設定されていません"},503);
          return json({...await youtubeLineupSearch(team, year, env.YOUTUBE_API_KEY), build:WORKER_BUILD});
        }
        catch (error) {
          console.error("YouTube lookup failed", error);
          return json({ok:false,error:error.message || "YouTube検索に失敗しました"},502);
        }
      }
      // 管理者のみ確認済み1-9を登録。公開画面に秘密鍵は埋め込まない。
      if (url.pathname === "/lineup/verified" && request.method === "POST") {
        const supplied = request.headers.get("X-Lineup-Admin-Key") || "";
        if (!env.LINEUP_ADMIN_KEY || supplied !== env.LINEUP_ADMIN_KEY)
          return json({ok:false,error:"管理者認証に失敗しました"},403);
        let body;
        try { body = await request.json(); } catch { return json({ok:false,error:"JSON形式が不正です"},400); }
        const team = clean(body.team), year = Number(body.year), lineup = body.lineup;
        const sourceUrl = clean(body.sourceUrl);
        if (!team || team.length > 80 || !Number.isInteger(year) || year < 1936 || year > 2100 ||
            !Array.isArray(lineup) || lineup.length !== 9 || !/^https:\/\//.test(sourceUrl))
          return json({ok:false,error:"球団・年度・9人の打順・出典URLを確認してください"},400);
        const entries = lineup.map((r,i)=>({order:i+1,name:clean(r.name),position:clean(r.position)}));
        if (entries.some(r=>!r.name || !r.position || r.name.length>80 || r.position.length>30) ||
            new Set(entries.map(r=>normalizeLineupName(r.name))).size!==9)
          return json({ok:false,error:"9人の氏名・守備位置・重複を確認してください"},400);
        // D1 batchで一括登録。事前に付属SQLでテーブル作成が必要。
        const statements=[env.DB.prepare("DELETE FROM season_lineup_verified WHERE year=? AND team=?").bind(year,team),
          ...entries.map(r=>env.DB.prepare(`INSERT INTO season_lineup_verified (year,team,batting_order,player_name,position,source_url) VALUES (?,?,?,?,?,?)`).bind(year,team,r.order,r.name,r.position,sourceUrl))];
        await env.DB.batch(statements);
        return json({ok:true,saved:9,team,year});
      }
      // Not Found
      // ==========================================
      return json(
        {
          ok: false,
          error: "Not Found"
        },
        404
      );
    } catch (error) {
      console.error(error);
      return json(
        {
          ok: false,
          error:
            error?.message ||
            String(error)
        },
        500
      );
    }
  }
};
// ==============================================
// 必須項目チェック
// ==============================================
function validateSong(
  playerName,
  team,
  playerType
) {
  if (!playerName) {
    return "選手名がありません";
  }
  if (!team) {
    return "球団がありません";
  }
  if (
    playerType !== "現在使用" &&
    playerType !== "未使用"
  ) {
    return "区分が正しくありません";
  }
  return null;
}
// ==============================================
// 数値変換
// ==============================================
function parseNumberOrNull(
  value
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }
  const number =
    Number(value);
  if (
    !Number.isFinite(number)
  ) {
    return null;
  }
  return number;
}
// ==============================================
// 文字列
// ==============================================
function clean(value) {
  return String(
    value ?? ""
  ).trim();
}
// ==============================================
// プロパティ存在確認
// ==============================================
function hasOwn(
  object,
  key
) {
  return Object.prototype
    .hasOwnProperty.call(
      object,
      key
    );
}
// ==============================================
// JSONレスポンス
// ==============================================
function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,
      headers: {
        ...CORS_HEADERS,
        "Content-Type":
          "application/json; charset=UTF-8",
        "Cache-Control":
          "no-store"
      }
    }
  );
}
// YouTube Data API v3: 動画説明欄の記載をもとに打順を抽出する。
// 動画の映像・音声・字幕は解析しない。説明欄にない打順は補完しない。
async function youtubeLineupSearch(team, year, key) {
  const query = `${year} ${team} 1-9 応援歌`;
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  // YouTube公式の再生回数順。最大50件を検索し、タイトル条件を厳密に適用する。
  searchUrl.search = new URLSearchParams({part:"snippet",type:"video",maxResults:"50",order:"viewCount",q:query,key});
  const search = await youtubeJson(searchUrl);
  const ids = (search.items || []).map(item => item.id?.videoId).filter(Boolean);
  if (!ids.length) return {ok:true,source:"youtube_popular_filtered",team,year,query,found:false,lineup:[],players:[],videos:[],message:"該当するYouTube動画が見つかりませんでした",sort:"viewCount",selection:"exclude_opening_require_1-9"};
  const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  detailsUrl.search = new URLSearchParams({part:"snippet,statistics",id:ids.join(","),key});
  const details = await youtubeJson(detailsUrl);
  const lookup = new Map((details.items || []).map(item => [item.id,item]));
  const titleAllowed = title => {
    const t = String(title||"").normalize("NFKC");
    return /1\s*[-－ー–〜~]\s*9/.test(t) && !/開幕/.test(t);
  };
  const yearMatches = title => {
    const years = [...String(title||"").matchAll(/(?:19|20)\d{2}/g)].map(x=>Number(x[0]));
    return !years.length || years.includes(year);
  };
  const isComplete = lineup => lineup.length===9 &&
    lineup.every((entry,index)=>entry.order===index+1) &&
    new Set(lineup.map(entry=>normalizeLineupName(entry.name))).size===9;
  const videos = ids.map((id,index) => {
    const item = lookup.get(id) || {};
    const snippet = item.snippet || {};
    const title = snippet.title || "";
    const eligible = titleAllowed(title) && yearMatches(title);
    const lineup = eligible ? parseDescriptionLineup(snippet.description || "") : [];
    return {
      id,videoId:id,url:`https://www.youtube.com/watch?v=${id}`,
      title,channel:snippet.channelTitle||"",publishedAt:snippet.publishedAt||"",
      viewCount:Number(item.statistics?.viewCount||0),searchRank:index+1,
      eligible,excludedReason:eligible?null:(!titleAllowed(title)?"開幕を含む、またはタイトルに1-9がない":"指定年度と不一致"),
      lineup,players:lineup.map(x=>x.name),descriptionHasLineup:isComplete(lineup)
    };
  });
  // 再生回数が多い順で候補を判定。9人が取れない動画は次の人気動画へ。
  const eligible = videos.filter(v=>v.eligible).sort((a,b)=>b.viewCount-a.viewCount || a.searchRank-b.searchRank);
  const best = eligible.find(v=>isComplete(v.lineup)) || null;
  const lineup = best?.lineup || [];
  return {
    ok:true,source:"youtube_popular_filtered",team,year,query,
    found:!!best,lineup,players:lineup.map(x=>x.name),video:best,
    selectedRank:best?.searchRank??null,inspectedCount:videos.length,
    eligibleCount:eligible.length,videos,seasonStatsVerified:false,
    sort:"viewCount",selection:"exclude_opening_require_1-9",
    message:best
      ? `「開幕」を含まず「1-9」を含む動画を再生回数順に確認し、${best.searchRank}位の動画説明欄から9人の打順を取得しました。`
      : "条件に合う動画は検索しましたが、概要欄から9人の打順を取得できませんでした。映像は解析していません。",
    extraction:"first_complete_description_in_viewcount_order"
  };
}
async function youtubeJson(url) {
  const response = await fetch(url.toString(), {headers:{Accept:"application/json"}});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason;
    const msg = reason === "quotaExceeded" ? "YouTube APIの本日の利用枠を超えました" :
      reason === "keyInvalid" ? "YouTube APIキーが無効です" :
      data.error?.message || `YouTube API エラー (${response.status})`;
    throw new Error(msg);
  }
  return data;
}
// 選手名の先頭に付く守備位置を選手名から分離する。
function normalizeLineupName(raw){
  return String(raw||"").normalize("NFKC")
    .replace(/^(?:DH|[投捕一二三遊左中右指代])[\s　]+/i,"")
    .replace(/[\s　・･]/g,"").toLowerCase();
}
function parseDescriptionLineup(description) {
  const found=new Map();
  const positions={投:"投手",捕:"捕手",一:"一塁手",二:"二塁手",三:"三塁手",遊:"遊撃手",左:"左翼手",中:"中堅手",右:"右翼手",指:"指名打者",DH:"指名打者",代:"代打"};
  for(const raw of String(description||"").split(/\r?\n/).slice(0,400)){
    const line=raw.trim();
    const m=line.match(/^(?:([1-9])\s*(?:番打者|番|[.．、:：)）]|\s+)|([①②③④⑤⑥⑦⑧⑨]))\s*(.*)$/u);
    if(!m)continue;
    const order=m[1]?Number(m[1]):"①②③④⑤⑥⑦⑧⑨".indexOf(m[2])+1;
    let value=m[3].replace(/^[:：\s\-ー]+/,"").replace(/\s*(?:\/\/|#|https?:\/\/).*$/,"").trim();
    let position="";
    const bracket=value.match(/^[（(]\s*(DH|[投捕一二三遊左中右指代])\s*[）)]\s*(.+)$/i);
    if(bracket){position=positions[bracket[1].toUpperCase()]||positions[bracket[1]]||"";value=bracket[2].trim()}
    const prefix=value.match(/^(DH|[投捕一二三遊左中右指代])[\s　]+(.+)$/i);
    if(prefix){position=positions[prefix[1].toUpperCase()]||positions[prefix[1]]||"";value=prefix[2].trim()}
    const suffix=value.match(/^(.+?)\s*[（(]\s*(DH|[投捕一二三遊左中右指代])\s*[）)]$/i);
    if(suffix){value=suffix[1].trim();position=positions[suffix[2].toUpperCase()]||positions[suffix[2]]||position}
    if(!value||value.length>24||/https?:|応援歌|歌詞|チャンネル|登録|高評価|メドレー|再生リスト|©|好きすぎる/.test(value))continue;
    if(!found.has(order))found.set(order,{order,name:value,...(position?{position}:{})});
  }
  return [...found.values()].sort((a,b)=>a.order-b.order);
}

// 出典を確認して登録した年度別スタメン実績だけを使用する。
// D1のseason_lineup_verifiedテーブルが未作成・未登録ならYouTube候補にフォールバック。
async function verifiedSeasonLineup(env,team,year){
  if(!env.DB)return null;
  let rows;
  try{
    const r=await env.DB.prepare(`SELECT batting_order, player_name, position, source_url
      FROM season_lineup_verified WHERE year=? AND team=? ORDER BY batting_order`)
      .bind(year,team).all();
    rows=r.results||[];
  }catch(e){
    if(/no such table/i.test(String(e?.message||e)))return null;
    throw e;
  }
  if(rows.length!==9||rows.some((r,i)=>Number(r.batting_order)!==i+1||!r.player_name||!r.position||!r.source_url))return null;
  if(new Set(rows.map(r=>normalizeLineupName(r.player_name))).size!==9)return null;
  return {ok:true,source:"verified_lineup",team,year,found:true,
    lineup:rows.map(r=>({order:Number(r.batting_order),name:r.player_name,position:r.position})),
    players:rows.map(r=>r.player_name),sourceUrl:rows[0].source_url,
    seasonStatsVerified:false,message:"管理者が出典を確認して保存した1-9です。",extraction:"curated_season_stats"};
}
