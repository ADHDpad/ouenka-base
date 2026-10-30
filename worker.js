const WORKER_BUILD = "lineup-popular-filtered-20261014-r6-favorites-share-r136-quiz-room-r164-short-share-r240-favorites-r296";

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
      if(new URL(request.url).pathname.startsWith('/songs'))await ensureSongSettings(env);
      const statsResponse=await handleCommunityStats(request,env);
      if(statsResponse)return statsResponse;
      const shortShareResponse=await handleShortShare(request,env);
      if(shortShareResponse)return shortShareResponse;
      const quizRoomResponse=await handleQuizRoom(request,env);
      if(quizRoomResponse)return quizRoomResponse;
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
              tempo,
              is_generic,
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
              tempo,
              is_generic,
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
              tempo,
              is_generic,
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
        if(body.tempo!==undefined&&![170,140].includes(body.tempo))return json({ok:false,error:"テンポは170または140を選択してください。"},400);
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
              bass_filename,
              tempo,
              is_generic
            )
            VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
            bassFilename,
            body.tempo===140?140:170,
            body.is_generic===true||body.is_generic===1?1:0
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
        if(body.tempo!==undefined&&![170,140].includes(body.tempo))return json({ok:false,error:"テンポは170または140を選択してください。"},400);
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
            bass_filename = ?,
            tempo = ?,
            is_generic = ?
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
          hasOwn(body,"tempo")?(body.tempo===140?140:170):(current.tempo||170),
          hasOwn(body,"is_generic")?(body.is_generic===true||body.is_generic===1?1:0):(current.is_generic||0),
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
              tempo,
              is_generic,
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

// worker.jsにも同じ処理を組み込み済み。既存Workerに差分追加する場合の独立したハンドラー。
// URL処理の先頭で await handleFavoriteShare(request, env) を呼び、Responseが返ったらreturnする。
async function handleQuizRoom(request,env){
 const url=new URL(request.url),base='/quiz/rooms';if(url.pathname!==base&&!url.pathname.startsWith(base+'/'))return null;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS_HEADERS,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
 const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 try{
  if(request.method!=='POST')return reply({ok:false,error:'POSTで操作してください。'},405);
  if(!env.DB)return reply({ok:false,error:'DBが設定されていません。'},503);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>1000000)fail('送信データが大きすぎます。',413);
  let body;try{body=JSON.parse(raw)}catch{fail('データ形式を確認してください。')}
  if(!body||typeof body!=='object')fail('データ形式を確認してください。');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS quiz_rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL, expires INTEGER NOT NULL)').run();
  const now=Date.now(),name=String(body.name||'').trim().slice(0,20);
  const cleanSong=s=>({name:String(s?.name||'').slice(0,120),team:String(s?.team||'').slice(0,120),productionNumber:String(s?.productionNumber||'1').slice(0,10)});
  const view=(room,token)=>{
   const me=room.members.find(m=>m.token===token);if(!me)fail('参加情報が無効です。もう一度参加してください。',403);
   const q=room.questions[room.at],revealed=room.stage==='reveal'||room.stage==='finished';
   return {ok:true,code:room.code,stage:room.stage,at:room.at,total:room.questions.length,expires:room.expires,host:me.id===room.host,me:me.id,settings:room.settings,endedEarly:!!room.endedEarly,
    members:room.members.map(m=>({id:m.id,name:m.name,score:m.score,answered:!!room.answers[m.id],choice:revealed?room.answers[m.id]?.choice:undefined})),
    question:room.stage!=='lobby'&&q?{song:q.song,prompt:q.prompt,choices:q.choices,randomValue:q.randomValue,correct:revealed?q.correct:undefined}:null};
  };
  if(url.pathname===base){
   if(!name)fail('参加名を入力してください。');
   if(!Array.isArray(body.questions)||!body.questions.length||body.questions.length>100)fail('問題数は1〜100問です。');
   const questions=body.questions.map(q=>{if(!q||!Array.isArray(q.choices)||q.choices.length<4||q.choices.length>10||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.choices.length)fail('問題の形式を確認してください。');const choices=q.choices.map(n=>String(n).slice(0,120));if(choices.some(n=>!n)||new Set(choices).size!==choices.length)fail('選択肢を確認してください。');return {song:cleanSong(q.song),prompt:String(q.prompt||'').slice(0,8000),choices,correct:q.correct,randomValue:Math.random()}});
   const input=body.settings||{},settings={kind:input.kind==='lyrics'?'lyrics':'audio',unit:input.unit==='bars'?'bars':'seconds',bars:[1,2,4,8,16].includes(Number(input.bars))?Number(input.bars):1,seconds:[5,10,20].includes(Number(input.seconds))?Number(input.seconds):10,excerpt:input.excerpt==='start'?'start':'random'};
   await env.DB.prepare('DELETE FROM quiz_rooms WHERE expires <= ?').bind(now).run();
   for(let i=0;i<5;i++){
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=crypto.getRandomValues(new Uint8Array(8)),code=Array.from(bytes,b=>alphabet[b&31]).join(''),token=crypto.randomUUID(),id=crypto.randomUUID(),expires=now+7200000;
    const room={code,host:id,expires,stage:'lobby',at:0,settings,questions,members:[{id,token,name,score:0}],answers:{}};
    const result=await env.DB.prepare('INSERT OR IGNORE INTO quiz_rooms (code,data,revision,expires) VALUES (?,?,0,?)').bind(code,JSON.stringify(room),expires).run();
    if(result.meta?.changes)return reply({...view(room,token),token},201);
   }fail('ルームを作成できませんでした。もう一度お試しください。',503);
  }
  const match=url.pathname.match(/^\/quiz\/rooms\/([A-Z2-9]{8})\/(join|state|start|answer|reveal|next|leave)$/);if(!match)fail('参加コードを確認してください。',404);
  const [,code,action]=match;
  for(let attempt=0;attempt<8;attempt++){
   const row=await env.DB.prepare('SELECT data,revision,expires FROM quiz_rooms WHERE code = ?').bind(code).first();if(!row||row.expires<=now)fail('ルームが見つかりません。有効期限は作成から2時間です。',404);
   const room=JSON.parse(row.data);let token=String(body.token||''),me=room.members.find(m=>m.token===token);
   if(action==='join'){
    if(!me){if(room.stage!=='lobby')fail('開始後は新しく参加できません。',409);if(room.members.length>=12)fail('参加できるのは12人までです。',409);if(!name)fail('参加名を入力してください。');token=crypto.randomUUID();me={id:crypto.randomUUID(),token,name,score:0};room.members.push(me)}
   }else if(!me)fail('参加情報が無効です。もう一度参加してください。',403);
   if(action==='state')return reply(view(room,token));
   if(['start','reveal','next'].includes(action)&&me.id!==room.host)fail('ホストだけが操作できます。',403);
   // 操作した問題番号を照合し、再送・連打で次の問題を飛ばさない。
   if(['answer','reveal','next'].includes(action)&&body.at!==room.at)fail('問題が進みました。画面を更新します。',409);
   const reveal=()=>{if(room.stage!=='question')return;const correct=room.questions[room.at].correct;for(const m of room.members)if(room.answers[m.id]?.choice===correct)m.score++;room.stage='reveal'};
   if(action==='start'){if(room.stage!=='lobby')return reply(view(room,token));if(room.members.length<2)fail('2人以上集まってから開始してください。');room.stage='question'}
   if(action==='answer'){
    if(room.stage==='question'&&!room.answers[me.id]){const choice=body.choice;if(!Number.isInteger(choice)||choice< -1||choice>=room.questions[room.at].choices.length)fail('回答を確認してください。');room.answers[me.id]={choice};if(room.members.every(m=>room.answers[m.id]))reveal()}
   }
   if(action==='reveal')reveal();
   if(action==='next'&&room.stage==='reveal'){if(room.at+1===room.questions.length)room.stage='finished';else{room.at++;room.answers={};room.stage='question'}}
   if(action==='leave'){
    if(me.id===room.host){room.endedEarly=room.stage!=='finished';room.stage='finished'}else{room.members=room.members.filter(m=>m.id!==me.id);delete room.answers[me.id];if(room.stage==='question'&&room.members.every(m=>room.answers[m.id]))reveal()}
   }
   const result=await env.DB.prepare('UPDATE quiz_rooms SET data = ?, revision = revision + 1 WHERE code = ? AND revision = ?').bind(JSON.stringify(room),code,row.revision).run();
   if(result.meta?.changes)return action==='leave'?reply({ok:true}):reply({...view(room,token),...(action==='join'?{token}:{})});
  }
  return reply({ok:false,error:'回答が集中しています。もう一度お試しください。'},409);
 }catch(error){return reply({ok:false,error:error.status?error.message:'ルームを利用できません。Workerの更新とDB設定を確認してください。'},error.status||503)}
}

// Embedded in worker.js. Uses the existing DB binding; tables are created automatically.
async function handleShortShare(request,env){
 const url=new URL(request.url),legacy=url.pathname==='/favorites/share'||url.pathname.startsWith('/favorites/share/');
 if(!legacy&&url.pathname!=='/share'&&!url.pathname.startsWith('/share/'))return null;
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 const reply=(data,status=200)=>Response.json(data,{status,headers}),fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  if(!env.DB)fail('共有サービスのデータベースが未設定です。',503);
  if(!['GET','POST'].includes(request.method))fail('GETまたはPOSTで利用してください。',405);
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS short_shares (code TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)').run();
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS short_share_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)').run();
  const now=Date.now(),period=Math.floor(now/60000),ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('ouenka-short-share:'+ip))),n=>n.toString(16).padStart(2,'0')).join('');
  const rate=await env.DB.prepare('INSERT INTO short_share_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(hash+':'+request.method+':'+period,(period+2)*60000).first();
  if(rate.attempts>(request.method==='POST'?10:12))fail('短時間に操作が続いています。1分ほど待ってからもう一度お試しください。',429);
  await env.DB.prepare('DELETE FROM short_share_limits WHERE expires_at <= ?').bind(now).run();
  function favorites(items){if(!Array.isArray(items)||items.length>500)fail('お気に入りは500曲まで共有できます。');return items.map(s=>{const name=String(s?.name||'').trim(),productionNumber=String(s?.productionNumber||'').trim(),team=String(s?.team||'').trim(),reading=String(s?.reading||'').trim();if(!name||name.length>120||!/^\d{1,10}$/.test(productionNumber)||team.length>120||reading.length>120)fail('曲の共有情報を確認してください。');return {name,productionNumber,team,reading}})}
  function validate(kind,data){
   if(data?.version!==1)fail('共有データの形式を確認してください。');
   if(kind==='favorites'){const items=favorites(data.items);if(!items.length)fail('お気に入りを登録してから共有してください。');return {version:1,items}}
   if(kind==='songbook'){
    if(!Array.isArray(data.records)||data.records.length>20000)fail('図鑑の記録件数を確認してください。');
    const records=data.records.map(r=>{const name=String(r?.name||'').trim(),productionNumber=String(r?.productionNumber||'').trim();if(!name||name.length>120||!/^\d{1,10}$/.test(productionNumber))fail('図鑑の曲情報を確認してください。');return {name,productionNumber,heard:r.heard===true,quizCorrect:r.quizCorrect===true}});
    const items=favorites(data.favorites||[]);if(!records.length&&!items.length)fail('図鑑の記録またはお気に入りを追加してから共有してください。');return {version:1,records,favorites:items};
   }
   if(kind==='playlist'){
    if(!['lineup','medley'].includes(data.mode)||!Array.isArray(data.rows)||!data.rows.length||data.rows.length>500)fail('共有する曲順を確認してください。');
    const text=(v,n)=>String(v??'').trim().slice(0,n),rows=data.rows.map(r=>{if(!r||typeof r!=='object')fail('曲の情報を確認してください。');const name=text(r.name,120),productionNumber=text(r.productionNumber,10),reuseName=text(r.reuseName,120),reuseProductionNumber=text(r.reuseProductionNumber,10);if(name&&!/^\d{1,10}$/.test(reuseName?reuseProductionNumber:productionNumber))fail('曲の制作番号を確認してください。');return {name,productionNumber,position:text(r.position,30),team:text(r.team,120),lyrics:text(r.lyrics,10000),songId:text(r.songId,80),reuseName,reuseProductionNumber,reuseMode:reuseName?text(r.reuseMode||'reuse',30):''}});
    if(!rows.some(r=>r.name))fail('曲を選択してから共有してください。');return {version:1,mode:data.mode,title:text(data.title,200),color:text(data.color||'theme',120),year:text(data.year,10),team:text(data.team,120),rows};
   }
   fail('共有データの種類を確認してください。');
  }
  if(request.method==='POST'){
   if(Number(request.headers.get('Content-Length'))>1500000)fail('共有データが大きすぎます。',413);
   const raw=await request.text();if(new TextEncoder().encode(raw).length>1500000)fail('共有データが大きすぎます。',413);
   let body;try{body=JSON.parse(raw)}catch{fail('共有データを確認してください。')}
   const kind=legacy?'favorites':body.kind,payload=validate(kind,legacy?body:body.payload),text=JSON.stringify(payload),expires=now+3600000;
   await env.DB.prepare('DELETE FROM short_shares WHERE expires_at <= ?').bind(now).run();
   for(let attempt=0;attempt<64;attempt++){
    let random;do{random=crypto.getRandomValues(new Uint32Array(1))[0]}while(random>=4294960000);
    const code=String(random%10000).padStart(4,'0');
    const result=await env.DB.prepare('INSERT OR IGNORE INTO short_shares (code,kind,payload,created_at,expires_at) VALUES (?,?,?,?,?)').bind(code,kind,text,now,expires).run();
    if(result.meta?.changes)return reply({ok:true,code,kind,expiresAt:new Date(expires).toISOString()},201);
   }
   fail('共有コードが混み合っています。しばらくして再試行してください。',503);
  }
  const code=url.pathname.slice((legacy?'/favorites/share/':'/share/').length);if(!/^\d{4}$/.test(code))fail('共有コードは数字4桁で入力してください。');
  const row=await env.DB.prepare('SELECT kind,payload,expires_at FROM short_shares WHERE code = ?').bind(code).first();
  if(!row||row.expires_at<=now)fail('共有コードが見つからないか、1時間の有効期限が切れています。作成し直してください。',404);
  if(legacy&&row.kind!=='favorites')fail('お気に入りの共有コードを入力してください。');
  const payload=JSON.parse(row.payload);return reply(legacy?{ok:true,...payload,expiresAt:new Date(row.expires_at).toISOString()}:{ok:true,kind:row.kind,payload,expiresAt:new Date(row.expires_at).toISOString()});
 }catch(e){return reply({ok:false,error:e.status?e.message:'共有サービスを利用できません。worker.jsの更新とDB設定を確認してください。'},e.status||503)}
}

async function handleCommunityStats(request,env){
 const url=new URL(request.url);if(url.pathname!=='/stats')return null;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS_HEADERS,'Content-Type':'application/json','Cache-Control':'no-store'}});
 try{
 if(!env.DB)return reply({ok:false,error:'DB未設定'},503);
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS community_favorites_r296 (client TEXT NOT NULL,song TEXT NOT NULL,active INTEGER NOT NULL,seq INTEGER NOT NULL,PRIMARY KEY(client,song))').run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS community_answers (event TEXT PRIMARY KEY,song TEXT NOT NULL,kind TEXT NOT NULL,correct INTEGER NOT NULL)').run();
 if(request.method==='GET'){
 const songs={},get=k=>songs[k]||(songs[k]={favorites:0,lyrics:{total:0,correct:0},audio:{total:0,correct:0},chord:{total:0,correct:0}});
 const f=await env.DB.prepare('SELECT song,SUM(active) AS points FROM community_favorites_r296 GROUP BY song').all();for(const r of f.results)get(r.song).favorites=r.points;
 const q=await env.DB.prepare('SELECT song,kind,COUNT(*) AS total,SUM(correct) AS correct FROM community_answers GROUP BY song,kind').all();for(const r of q.results)get(r.song)[r.kind]={total:r.total,correct:r.correct};return reply({ok:true,generation:"favorites-r296",songs});
 }
 if(request.method!=='POST')return reply({ok:false},405);
 if(Number(request.headers.get('content-length'))>4096)return reply({ok:false},413);
 const b=await request.json();if(typeof b.song!=='string'||b.song.length>160||!/^.+#\d{1,10}$/.test(b.song)||typeof b.client!=='string'||b.client.length>80||typeof b.event!=='string'||b.event.length>160)return reply({ok:false},400);
 if(b.type==='favorite'){
 // A fixed generation starts all favorite points at zero once. Old pending events cannot restore them.
 if(b.generation!=='favorites-r296')return reply({ok:true,ignored:true});
 if(typeof b.active!=='boolean'||!Number.isSafeInteger(b.seq)||b.seq<1)return reply({ok:false},400);
 await env.DB.prepare('INSERT INTO community_favorites_r296 (client,song,active,seq) VALUES (?,?,?,?) ON CONFLICT(client,song) DO UPDATE SET active=excluded.active,seq=excluded.seq WHERE excluded.seq>community_favorites_r296.seq').bind(b.client,b.song,b.active?1:0,b.seq).run();
 }else if(b.type==='quiz'){
 if(!['lyrics','audio','chord'].includes(b.kind)||typeof b.correct!=='boolean')return reply({ok:false},400);
 await env.DB.prepare('INSERT OR IGNORE INTO community_answers (event,song,kind,correct) VALUES (?,?,?,?)').bind(b.event,b.song,b.kind,b.correct?1:0).run();
 }else return reply({ok:false},400);
 return reply({ok:true});
 }catch{return reply({ok:false,error:'集計を利用できません。Worker更新とDB設定を確認してください。'},503)}
}

let songSettingsReady;
async function ensureSongSettings(env){
 if(!songSettingsReady)songSettingsReady=(async()=>{
  const columns=(await env.DB.prepare('PRAGMA table_info(songs)').all()).results;
  for(const [name,definition] of [['tempo','INTEGER NOT NULL DEFAULT 170'],['is_generic','INTEGER NOT NULL DEFAULT 0']]){
   if(!columns.some(c=>c.name===name))try{await env.DB.prepare('ALTER TABLE songs ADD COLUMN '+name+' '+definition).run()}catch(e){const now=(await env.DB.prepare('PRAGMA table_info(songs)').all()).results;if(!now.some(c=>c.name===name))throw e}
  }
  await env.DB.prepare('UPDATE songs SET tempo = 140 WHERE tempo = 150').run();
 })().catch(e=>{songSettingsReady=null;throw e});
 return songSettingsReady;
}
