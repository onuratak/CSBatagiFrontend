// API-based stats generator for CS:GO stats
// This script connects to your database via API endpoint, runs queries, and generates JSON files
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// API endpoint configuration
const API_ENDPOINT = 'https://db2.csbatagi.com/execute-query';
const MW_TOKEN = process.env.MW_TOKEN;

// Define the SQL select clause to be used in queries
const selectClause = `
          AVG(p1.hltv_rating_2) AS HLTV_2,
          AVG(p1.average_damage_per_round) AS adr,
          AVG(p1.kill_count) AS KILLS,
          AVG(p1.death_count) AS DEATHS,
          AVG(p1.assist_count) AS ASSISTS,
          AVG(p1.kill_death_ratio) AS KD,
          AVG(p1.headshot_count) AS Headshot_kills,
          AVG(p1.headshot_percentage) AS Headshot_killratio,
          AVG(p1.first_kill_count) AS first_kill_count,
          AVG(p1.first_death_count) AS first_death_count,
          AVG(p1.bomb_planted_count) AS bomb_planted,
          AVG(p1.bomb_defused_count) AS bomb_defused,
          AVG(p1.hltv_rating) AS HLTV,
          AVG(p1.mvp_count) AS MVP,
          AVG(p1.kast) AS KAST,
          AVG(p1.utility_damage) AS UTL_DMG,
          AVG(p1.two_kill_count) AS two_kills,
          AVG(p1.three_kill_count) AS three_kills,
          AVG(p1.four_kill_count) AS four_kills,
          AVG(p1.five_kill_count) AS five_kills,
          AVG(p1.score) AS SCORE,
          `;

// Season start date (can be passed as environment variable or hardcoded)
const sezonbaslangic = process.env.SEZON_BASLANGIC || '2025-02-10';

// SQL Queries
const queries = {
  // Query for season_avg.json - retrieves overall season stats
  seasonAvg: `
         WITH match_date_info AS (
            SELECT MAX(matches.date::date) AS latest_match_date 
            FROM matches
        ),
        season_start_info AS (
            SELECT '${sezonbaslangic}'::date AS seasonstart
        ),
        match_agg AS (
            SELECT
              p1.steam_id,
              MAX(p1.name) AS name,
              ${selectClause}
              (SELECT latest_match_date FROM match_date_info) AS latest_match_date,
              COUNT(*) AS matches_in_interval,
              COUNT(CASE WHEN matches.winner_name = p1.team_name THEN 1 END) AS win_count,
              ROUND(
                  (COUNT(CASE WHEN matches.winner_name = p1.team_name THEN 1 END)::numeric 
                  / COUNT(*) * 100)
                  , 2
              ) AS win_rate_percentage
            FROM players AS p1
            INNER JOIN matches ON p1.match_checksum = matches.checksum
            WHERE 
                matches.date::date BETWEEN 
                    (SELECT seasonstart FROM season_start_info) 
                    AND 
                    (SELECT latest_match_date FROM match_date_info)
            GROUP BY p1.steam_id
        ),
        clutch_agg AS (
            SELECT
              c.clutcher_steam_id AS steam_id,
              COUNT(*)::numeric AS total_clutches,
              COUNT(CASE WHEN c.won = TRUE THEN 1 END)::numeric AS total_clutches_won
            FROM clutches c
            JOIN matches m ON c.match_checksum = m.checksum
            WHERE m.date::date BETWEEN 
                    (SELECT seasonstart FROM season_start_info) 
                    AND 
                    (SELECT latest_match_date FROM match_date_info)
            GROUP BY c.clutcher_steam_id
        )
        SELECT
          m.*,
          ROUND(coalesce(c.total_clutches, 0) / m.matches_in_interval, 2) AS avg_clutches,
          ROUND(coalesce(c.total_clutches_won, 0) / m.matches_in_interval, 2) AS avg_clutches_won,
          CASE 
            WHEN coalesce(c.total_clutches, 0) = 0 THEN 0
            ELSE ROUND(c.total_clutches_won / c.total_clutches * 100, 2)
          END AS successful_clutch_percentage
        FROM match_agg m
        LEFT JOIN clutch_agg c ON m.steam_id = c.steam_id
        ORDER BY HLTV_2 DESC;
  `,
  

  // Query for sonmac.json - retrieves latest match data
  sonmac: `
    WITH match_date_info AS (
        SELECT MAX(matches.date::date) AS latest_match_date  
        FROM matches
    )
    SELECT
        matches.map_name,
        teams.name AS team_name,
        p1.name,
        p1.steam_id,
        teams.score AS team_score,
        ${selectClause}
        COALESCE(c.num_clutches, 0) AS number_of_clutches,
        COALESCE(c.num_successful_clutches, 0) AS number_of_successful_clutches,
        (SELECT latest_match_date::date FROM match_date_info) AS latest_match_date
    FROM players AS p1
    INNER JOIN matches ON p1.match_checksum = matches.checksum
    INNER JOIN teams 
        ON matches.checksum = teams.match_checksum 
        AND p1.team_name = teams.name
    LEFT JOIN (
        SELECT 
            match_checksum, 
            clutcher_steam_id, 
            COUNT(*) AS num_clutches,
            SUM(CASE WHEN won THEN 1 ELSE 0 END) AS num_successful_clutches
        FROM clutches
        GROUP BY match_checksum, clutcher_steam_id
    ) AS c 
        ON c.match_checksum = matches.checksum 
        AND c.clutcher_steam_id = p1.steam_id
    WHERE 
        matches.date::date = (SELECT latest_match_date FROM match_date_info)
    GROUP BY
        matches.map_name,
        teams.name,
        teams.score,
        p1.steam_id,
        p1.name,
        c.num_clutches,
        c.num_successful_clutches
    ORDER BY
        matches.map_name,
        teams.name,
        HLTV_2 DESC;
  `,

  // Query for last10.json - retrieves stats from last 10 matches
  last10: `
    WITH last_x_dates AS (
      SELECT DISTINCT matches.date::date AS unique_date
      FROM matches
      ORDER BY unique_date DESC
      LIMIT 10
    ),
    date_range AS (
      SELECT
        MIN(unique_date) AS x_days_before,
        MAX(unique_date) AS latest_match_date
      FROM last_x_dates
    ),
    match_agg AS (
      SELECT
        p1.steam_id,
        MAX(p1.name) AS name,
        ${selectClause}
        (SELECT latest_match_date::date FROM date_range) AS latest_match_date,
        COUNT(*) AS matches_in_interval,
        ROUND(
          (COUNT(CASE WHEN matches.winner_name = p1.team_name THEN 1 END)::numeric
          / COUNT(*) * 100)
          , 2
        ) AS win_rate_percentage
      FROM
        players AS p1
        INNER JOIN matches ON p1.match_checksum = matches.checksum
      WHERE
        matches.date::date BETWEEN
          (SELECT x_days_before FROM date_range)
          AND
          (SELECT latest_match_date FROM date_range)
      GROUP BY
        p1.steam_id
    ),
    clutch_agg AS (
        SELECT
          c.clutcher_steam_id AS steam_id,
          COUNT(*)::numeric AS total_clutches,
          COUNT(CASE WHEN c.won = TRUE THEN 1 END)::numeric AS total_clutches_won
        FROM clutches c
        JOIN matches m ON c.match_checksum = m.checksum
        WHERE m.date::date BETWEEN 
                (SELECT x_days_before FROM date_range) 
                AND 
                (SELECT latest_match_date FROM date_range)
        GROUP BY c.clutcher_steam_id
    )
    SELECT
      m.*,
      ROUND(coalesce(c.total_clutches, 0) / m.matches_in_interval, 2) AS avg_clutches,
      ROUND(coalesce(c.total_clutches_won, 0) / m.matches_in_interval, 2) AS avg_clutches_won,
      CASE 
        WHEN coalesce(c.total_clutches, 0) = 0 THEN 0
        ELSE ROUND(c.total_clutches_won / c.total_clutches * 100, 2)
      END AS successful_clutch_percentage
    FROM match_agg m
    LEFT JOIN clutch_agg c ON m.steam_id = c.steam_id
    ORDER BY
      HLTV_2 DESC;
  `,

  // Query for night_avg.json - retrieves stats from night matches
  nightAvg: `
  WITH 
    -- Get the last night date
    last_night_dates AS (
      SELECT DISTINCT matches.date::date AS unique_date
      FROM matches
      ORDER BY unique_date DESC
      LIMIT 1
    ),
    last_night_range AS (
      SELECT 
        MIN(unique_date) AS x_days_before,
        MAX(unique_date) AS latest_match_date
      FROM last_night_dates
    ),
    -- Get the last 10 nights excluding the last night
    last_10_nights_dates AS (
      SELECT DISTINCT matches.date::date AS unique_date
      FROM matches
      WHERE matches.date::date < (SELECT latest_match_date FROM last_night_range)
      ORDER BY unique_date DESC
      LIMIT 10
    ),
    last_10_nights_range AS (
      SELECT 
        MIN(unique_date) AS x_days_before,
        MAX(unique_date) AS latest_match_date
      FROM last_10_nights_dates
    ),
    -- Aggregate player stats for the last night (using the long select clause only here)
    player_stats AS (
      SELECT
        p1.steam_id,
        MAX(p1.name) AS name,
        ${selectClause}
        COUNT(*) AS matches_in_interval
      FROM players AS p1
      INNER JOIN matches ON p1.match_checksum = matches.checksum
      WHERE matches.date::date BETWEEN 
            (SELECT x_days_before FROM last_night_range)
        AND (SELECT latest_match_date FROM last_night_range)
      GROUP BY p1.steam_id
    ),
    -- Aggregate HLTV_2 and ADR for the last 10 nights (excluding the last night)
    stats_last_10 AS (
      SELECT
        p1.steam_id,
        AVG(p1.hltv_rating_2) AS HLTV_2_10,
        AVG(p1.average_damage_per_round) AS adr_10
      FROM players AS p1
      INNER JOIN matches ON p1.match_checksum = matches.checksum
      WHERE matches.date::date BETWEEN 
            (SELECT x_days_before FROM last_10_nights_range)
        AND (SELECT latest_match_date FROM last_10_nights_range)
      GROUP BY p1.steam_id
    ),
    -- Aggregate clutches data for the last night
    clutches_stats AS (
      SELECT
        c.clutcher_steam_id,
        COUNT(*) AS clutches,
        SUM(CASE WHEN c.won THEN 1 ELSE 0 END) AS clutches_won
      FROM clutches c
      INNER JOIN matches m ON c.match_checksum = m.checksum
      WHERE m.date::date BETWEEN 
            (SELECT x_days_before FROM last_night_range)
        AND (SELECT latest_match_date FROM last_night_range)
      GROUP BY c.clutcher_steam_id
    )
    
  SELECT
    ps.*,  -- All aggregated player stats from last night
    (SELECT latest_match_date::date FROM last_night_range) AS latest_match_date,
    s10.HLTV_2_10,
    (ps.HLTV_2 - s10.HLTV_2_10) AS HLTV_2_diff,
    s10.adr_10,
    (ps.adr - s10.adr_10) AS adr_diff,
    COALESCE(cs.clutches, 0) AS clutches,
    COALESCE(cs.clutches_won, 0) AS clutches_won
  FROM player_stats ps
  LEFT JOIN stats_last_10 s10 ON ps.steam_id = s10.steam_id
  LEFT JOIN clutches_stats cs ON ps.steam_id = cs.clutcher_steam_id
  ORDER BY ps.HLTV_2 DESC;
  `,

  // Query for duello_son_mac.json - retrieves stats from duello_son_mac.json
  duello_son_mac: `
    WITH last_x_dates AS (
      SELECT DISTINCT matches.date::date AS unique_date
      FROM matches
      ORDER BY unique_date DESC
      LIMIT 1
    ),
    date_range AS (
      SELECT
        MIN(unique_date) AS x_days_before,
        MAX(unique_date) AS latest_match_date
      FROM last_x_dates
    ),
    last_date_matches AS (
      SELECT checksum
      FROM matches
      WHERE date::date = (SELECT latest_match_date FROM date_range)
    ),
    player_kills_deaths AS (
      SELECT
        p1.steam_id AS killerSteamId,
        MIN(COALESCE(p1_overrides.name, p1.name)) AS killerName,
        p2.steam_id AS victimSteamId,
        MIN(COALESCE(p2_overrides.name, p2.name)) AS victimName,
        (
          SELECT COUNT(*)
          FROM kills k
          WHERE k.killer_steam_id = p1.steam_id
            AND k.victim_steam_id = p2.steam_id
            AND k.match_checksum IN (SELECT checksum FROM last_date_matches)
        ) AS killCount,
        (
          SELECT COUNT(*)
          FROM kills k2
          WHERE k2.killer_steam_id = p2.steam_id
            AND k2.victim_steam_id = p1.steam_id
            AND k2.match_checksum IN (SELECT checksum FROM last_date_matches)
        ) AS deathCount
      FROM players p1
      LEFT JOIN steam_account_overrides p1_overrides
        ON p1.steam_id = p1_overrides.steam_id
      INNER JOIN teams t1
        ON p1.match_checksum = t1.match_checksum
           AND p1.team_name = t1.name
      INNER JOIN players p2
        ON p1.match_checksum = p2.match_checksum
      LEFT JOIN steam_account_overrides p2_overrides
        ON p2.steam_id = p2_overrides.steam_id
      INNER JOIN teams t2
        ON p2.match_checksum = t2.match_checksum
           AND p2.team_name = t2.name
      WHERE p1.match_checksum IN (SELECT checksum FROM last_date_matches)
        AND p2.match_checksum IN (SELECT checksum FROM last_date_matches)
        AND p1.team_name <> p2.team_name
      GROUP BY
        p1.steam_id,
        p2.steam_id
    ),
    distinct_players AS (
      SELECT DISTINCT killerSteamId AS playerSteamId, killerName AS playerName FROM player_kills_deaths
      UNION
      SELECT DISTINCT victimSteamId, victimName FROM player_kills_deaths
    )
    SELECT
        dp1.playerName AS PlayerRow,
        dp2.playerName AS PlayerColumn,
        COALESCE(pkd.killCount, 0) || '/' || COALESCE(pkd.deathCount, 0) AS KillDeathRatio
    FROM distinct_players dp1
    CROSS JOIN distinct_players dp2
    LEFT JOIN player_kills_deaths pkd
      ON dp1.playerSteamId = pkd.killerSteamId AND dp2.playerSteamId = pkd.victimSteamId
    ORDER BY dp1.playerName, dp2.playerName;
  `,

  // Query for duello_sezon.json - retrieves stats from duello_sezon.json
  duello_sezon: `
    WITH match_date_info AS (
      SELECT MAX(matches.date::date) AS latest_match_date
      FROM matches
    ),
    season_start_info AS (
      SELECT '${sezonbaslangic}'::date AS seasonstart
    ),
    season_matches AS (
      SELECT checksum
      FROM matches
      WHERE date::date >= (SELECT seasonstart FROM season_start_info)
        AND date::date <= (SELECT latest_match_date FROM match_date_info)
    ),
    consistent_player_names AS (
      SELECT
        p.steam_id,
        MAX(COALESCE(po.name, p.name)) AS playerName -- Get consistent player name per steam_id
      FROM players p
      LEFT JOIN steam_account_overrides po ON p.steam_id = po.steam_id
      GROUP BY p.steam_id
    ),
    player_kills_deaths AS (
      SELECT
        p1.steam_id AS killerSteamId,
        cpn1.playerName AS killerName, -- Use consistent player name
        p2.steam_id AS victimSteamId,
        cpn2.playerName AS victimName, -- Use consistent player name
        (
          SELECT COUNT(*)
          FROM kills k
          WHERE k.killer_steam_id = p1.steam_id
            AND k.victim_steam_id = p2.steam_id
            AND k.match_checksum IN (SELECT checksum FROM season_matches)
        ) AS killCount,
        (
          SELECT COUNT(*)
          FROM kills k2
          WHERE k2.killer_steam_id = p2.steam_id
            AND k2.victim_steam_id = p1.steam_id
            AND k2.match_checksum IN (SELECT checksum FROM season_matches)
        ) AS deathCount
      FROM players p1
      INNER JOIN teams t1
        ON p1.match_checksum = t1.match_checksum
           AND p1.team_name = t1.name
      INNER JOIN players p2
        ON p1.match_checksum = p2.match_checksum
      INNER JOIN teams t2
        ON p2.match_checksum = t2.match_checksum
           AND p2.team_name = t2.name
      INNER JOIN consistent_player_names cpn1 ON p1.steam_id = cpn1.steam_id -- Join with consistent player names
      INNER JOIN consistent_player_names cpn2 ON p2.steam_id = cpn2.steam_id -- Join with consistent player names
      WHERE p1.match_checksum IN (SELECT checksum FROM season_matches)
        AND p2.match_checksum IN (SELECT checksum FROM season_matches)
        AND p1.team_name <> p2.team_name
      GROUP BY
        p1.steam_id,
        cpn1.playerName, -- Group by consistent player name
        p2.steam_id,
        cpn2.playerName -- Group by consistent player name
    ),
    distinct_players AS (
      SELECT DISTINCT killerSteamId AS playerSteamId, killerName AS playerName FROM player_kills_deaths
      UNION
      SELECT DISTINCT victimSteamId, victimName FROM player_kills_deaths
    )
    SELECT
        dp1.playerName AS PlayerRow,
        dp2.playerName AS PlayerColumn,
        COALESCE(pkd.killCount, 0) || '/' || COALESCE(pkd.deathCount, 0) AS KillDeathRatio
    FROM distinct_players dp1
    CROSS JOIN distinct_players dp2
    LEFT JOIN player_kills_deaths pkd
      ON dp1.playerSteamId = pkd.killerSteamId AND dp2.playerSteamId = pkd.victimSteamId
    ORDER BY dp1.playerName, dp2.playerName;
  `,

  // Query for performance_data.json - retrieves historical performance data
  performanceGraphs: `
    WITH season_start_info AS (
        SELECT '${sezonbaslangic}'::date AS seasonstart
      ),
      match_date_info AS (
        SELECT MAX(date::date) AS latest_match_date 
        FROM matches
      ),
      -- Only consider dates where there was a match in the interval
      match_dates AS (
        SELECT DISTINCT date::date AS match_date
        FROM matches
        WHERE date::date BETWEEN 
              (SELECT seasonstart FROM season_start_info)
          AND (SELECT latest_match_date FROM match_date_info)
      ),
      -- Get distinct players based solely on steam_id and choose a canonical name
      distinct_players AS (
        SELECT steam_id, MAX(name) AS name
        FROM players
        GROUP BY steam_id
      ),
      -- Aggregate performance data per steam_id and match date
      performance_data AS (
        SELECT 
            p.steam_id, 
            m.date::date AS match_date,
            AVG(p.hltv_rating_2) AS HLTV_2,
            AVG(p.average_damage_per_round) AS adr,
            COUNT(*) AS matches_played
        FROM players p
        INNER JOIN matches m 
            ON p.match_checksum = m.checksum
        WHERE m.date::date BETWEEN 
              (SELECT seasonstart FROM season_start_info)
          AND (SELECT latest_match_date FROM match_date_info)
        GROUP BY p.steam_id, m.date::date
      )
      -- Cross join distinct players with the match dates, then join the performance data
      SELECT 
          dp.steam_id,
          dp.name,
          md.match_date::date, -- Ensure correct date format
          pd.HLTV_2,
          pd.adr,
          pd.matches_played -- Included just in case, though not used in final JSON
      FROM distinct_players dp
      CROSS JOIN match_dates md
      LEFT JOIN performance_data pd 
          ON pd.steam_id = dp.steam_id 
        AND pd.match_date = md.match_date
      ORDER BY dp.name, md.match_date; -- Order by name then date for easier processing
  `
};

// Execute query via API and return results
async function executeDbQuery(dbQuery) {
  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${MW_TOKEN}` 
      },
      body: JSON.stringify({ "query": dbQuery }),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error('Error executing query:', err);
    throw err;
  }
}

// Process the season average stats
async function updateSeasonAvgStats() {
  try {
    console.log('Updating season average stats...');
    
    // Execute the query
    const results = await executeDbQuery(queries.seasonAvg);
    
    // Check if the 'rows' property exists and has data
    if (!results || !results.rows || !results.rows.length) { 
      console.log('No results found for season average stats (or results.rows is missing/empty)');
      return;
    }
    
    // Create a mapping from column names to their index for easier lookup
    const columnMap = {};
    results.columns.forEach((colName, index) => {
      // Ensure column names are consistently lowercased for matching
      columnMap[colName.toLowerCase()] = index; 
    });

    // Transform the data by mapping over results.rows
    const transformedData = results.rows.map(row => {
      // Helper function to safely get data and parse it
      const getData = (colName, parseFn = parseFloat, defaultValue = 0) => {
        const index = columnMap[colName.toLowerCase()];
        const value = (index !== undefined && row[index] !== null && row[index] !== undefined) ? row[index] : defaultValue;
        // Attempt parsing, fall back to defaultValue if parsing results in NaN or fails
        const parsedValue = parseFn(value);
        return isNaN(parsedValue) ? defaultValue : parsedValue;
      };
      // Get steam_id directly
      const steamId = row[columnMap['steam_id'.toLowerCase()]];

      // Access data using the getData helper function
      return { 
        steam_id: steamId, // Add steam_id here
        name: row[columnMap['name'.toLowerCase()]], // Name is likely a string, handle separately if needed
        hltv_2: getData('hltv_2'),
        adr: getData('adr'),
        kd: getData('kd'),
        mvp: getData('mvp'), // Use parseFloat (default)
        kills: getData('kills'), // Use parseFloat (default)
        deaths: getData('deaths'), // Use parseFloat (default)
        assists: getData('assists'), // Use parseFloat (default)
        hs: getData('headshot_kills'), // Use parseFloat (default)
        hs_ratio: getData('headshot_killratio'),
        first_kill: getData('first_kill_count'), // Use parseFloat (default)
        first_death: getData('first_death_count'), // Use parseFloat (default)
        bomb_planted: getData('bomb_planted'), // Use parseFloat (default)
        bomb_defused: getData('bomb_defused'), // Use parseFloat (default)
        hltv: getData('hltv'),
        kast: getData('kast'),
        utl_dmg: getData('utl_dmg'),
        two_kills: getData('two_kills'), // Use parseFloat (default)
        three_kills: getData('three_kills'), // Use parseFloat (default)
        four_kills: getData('four_kills'), // Use parseFloat (default)
        five_kills: getData('five_kills'), // Use parseFloat (default)
        matches: getData('matches_in_interval'), // Use parseFloat (default)
        win_rate: getData('win_rate_percentage'),
        avg_clutches: getData('avg_clutches'),
        avg_clutches_won: getData('avg_clutches_won'),
        clutch_success: getData('successful_clutch_percentage')
      };
    });
    
    // Write the result to season_avg.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'season_avg.json');
    fs.writeFileSync(filePath, JSON.stringify(transformedData, null, 2));
    console.log('✅ Season average stats written to data/season_avg.json');
  } catch (error) {
    console.error('❌ Error updating season average stats:', error);
  }
}

// Process the night average stats
async function updateNightAvgStats() {
  try {
    console.log('Updating night average stats...');
    
    // Execute the query
    const results = await executeDbQuery(queries.nightAvg);
    
    // Check if the 'rows' property exists and has data
    if (!results || !results.rows || !results.rows.length) { 
      console.log('No results found for night average stats (or results.rows is missing/empty)');
      return;
    }
    
    // Create a mapping from column names to their index for easier lookup
    const columnMap = {};
    results.columns.forEach((colName, index) => {
      // Ensure column names are consistently lowercased for matching
      columnMap[colName.toLowerCase()] = index; 
    });

    // Transform the data by mapping over results.rows
    const transformedData = results.rows.map(row => {
      // Helper function to safely get data and parse it
      const getData = (colName, parseFn = parseFloat, defaultValue = 0) => {
        const index = columnMap[colName.toLowerCase()];
        // Check if the index exists and the value is not null/undefined
        if (index === undefined || row[index] === null || row[index] === undefined) {
          return defaultValue;
        }
        const value = row[index];
        // Attempt parsing, fall back to defaultValue if parsing results in NaN or fails
        const parsedValue = parseFn(value);
        return isNaN(parsedValue) ? defaultValue : parsedValue;
      };
      // Get steam_id directly
      const steamId = row[columnMap['steam_id'.toLowerCase()]];

      // Access data using the getData helper function and map to desired JSON keys
      return { 
        steam_id: steamId, // Add steam_id here
        name: row[columnMap['name'.toLowerCase()]], // Name is likely a string
        "HLTV 2": getData('hltv_2'),
        "ADR": getData('adr'),
        "K/D": getData('kd'),
        "MVP": getData('mvp'), 
        "Kills": getData('kills'), 
        "Deaths": getData('deaths'), 
        "Assists": getData('assists'), 
        "HS": getData('headshot_kills'), 
        "HS/Kill ratio": getData('headshot_killratio'),
        "First Kill": getData('first_kill_count'), 
        "First Death": getData('first_death_count'), 
        "Bomb Planted": getData('bomb_planted'), 
        "Bomb Defused": getData('bomb_defused'), 
        "HLTV": getData('hltv'),
        "KAST": getData('kast'),
        "Utility Damage": getData('utl_dmg'),
        "2 kills": getData('two_kills'), 
        "3 kills": getData('three_kills'), 
        "4 kills": getData('four_kills'), 
        "5 kills": getData('five_kills'), 
        "Nr of Matches": getData('matches_in_interval'), 
        "HLTV2 DIFF": getData('hltv_2_diff'),
        "ADR DIFF": getData('adr_diff'),
        "Clutch Opportunity": getData('clutches'), 
        "Clutches Won": getData('clutches_won')
      };
    });
    
    // Write the result to night_avg.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'night_avg.json');
    fs.writeFileSync(filePath, JSON.stringify(transformedData, null, 2));
    console.log('✅ Night average stats written to data/night_avg.json');
  } catch (error) {
    console.error('❌ Error updating night average stats:', error);
  }
}

// Process the last 10 match stats
async function updateLast10Stats() {
  try {
    console.log('Updating last 10 match stats...');
    
    // Execute the query
    const results = await executeDbQuery(queries.last10);
    
    // Check if the 'rows' property exists and has data
    if (!results || !results.rows || !results.rows.length) { 
      console.log('No results found for last 10 match stats (or results.rows is missing/empty)');
      return;
    }
    
    // Create a mapping from column names to their index for easier lookup
    const columnMap = {};
    results.columns.forEach((colName, index) => {
      // Ensure column names are consistently lowercased for matching
      columnMap[colName.toLowerCase()] = index; 
    });

    // Transform the data by mapping over results.rows
    const transformedData = results.rows.map(row => {
      // Helper function to safely get data and parse it (similar to other functions)
      const getData = (colName, parseFn = parseFloat, defaultValue = 0) => {
        const index = columnMap[colName.toLowerCase()];
        if (index === undefined || row[index] === null || row[index] === undefined) {
          return defaultValue;
        }
        const value = row[index];
        const parsedValue = parseFn(value);
        return isNaN(parsedValue) ? defaultValue : parsedValue;
      };
      // Get steam_id directly
      const steamId = row[columnMap['steam_id'.toLowerCase()]];

      // Access data using the getData helper function
      // Note: This structure mirrors seasonAvg as the query selects similar fields
      return { 
        steam_id: steamId, // Add steam_id here
        name: row[columnMap['name'.toLowerCase()]], 
        hltv_2: getData('hltv_2'),
        adr: getData('adr'),
        kd: getData('kd'),
        mvp: getData('mvp'),
        kills: getData('kills'),
        deaths: getData('deaths'),
        assists: getData('assists'),
        hs: getData('headshot_kills'),
        hs_ratio: getData('headshot_killratio'),
        first_kill: getData('first_kill_count'),
        first_death: getData('first_death_count'),
        bomb_planted: getData('bomb_planted'),
        bomb_defused: getData('bomb_defused'),
        hltv: getData('hltv'),
        kast: getData('kast'),
        utl_dmg: getData('utl_dmg'),
        two_kills: getData('two_kills'),
        three_kills: getData('three_kills'),
        four_kills: getData('four_kills'),
        five_kills: getData('five_kills'),
        matches: getData('matches_in_interval'),
        win_rate: getData('win_rate_percentage'),
        avg_clutches: getData('avg_clutches'),
        avg_clutches_won: getData('avg_clutches_won'),
        clutch_success: getData('successful_clutch_percentage')
      };
    });
    
    // Write the result to last10.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'last10.json');
    fs.writeFileSync(filePath, JSON.stringify(transformedData, null, 2));
    console.log('✅ Last 10 match stats written to data/last10.json');
  } catch (error) {
    console.error('❌ Error updating last 10 match stats:', error);
  }
}

// Process the Son Maç (Last Match) stats
async function updateSonMacStats() {
  try {
    console.log('Updating Son Maç stats...');

    const results = await executeDbQuery(queries.sonmac);

    if (!results || !results.rows || !results.rows.length) {
      console.log('No results found for Son Maç stats.');
      // Create an empty structure if no data
      const emptyData = { maps: {} };
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const filePath = path.join(dataDir, 'sonmac.json');
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
      console.log('✅ Empty Son Maç stats written to data/sonmac.json');
      return;
    }

    const columnMap = {};
    results.columns.forEach((colName, index) => {
      columnMap[colName.toLowerCase()] = index;
    });

    const getData = (row, colName, parseFn = parseFloat, defaultValue = 0) => {
      const index = columnMap[colName.toLowerCase()];
      if (index === undefined || row[index] === null || row[index] === undefined) {
        return defaultValue;
      }
      const value = row[index];
      const parsedValue = parseFn(value);
      return isNaN(parsedValue) ? defaultValue : parsedValue;
    };

    const mapsData = {};

    results.rows.forEach(row => {
      const mapName = row[columnMap['map_name']];
      const teamName = row[columnMap['team_name']];
      const teamScore = getData(row, 'team_score', parseInt, 0); // Assuming score is integer
      const playerName = row[columnMap['name']];
      const steamId = row[columnMap['steam_id']]; // Get steam_id

      if (!mapsData[mapName]) {
        mapsData[mapName] = { team1: null, team2: null };
      }

      let teamKey = null;
      if (mapsData[mapName].team1 === null) {
          teamKey = 'team1';
      } else if (mapsData[mapName].team1.name === teamName) {
          teamKey = 'team1';
      } else if (mapsData[mapName].team2 === null) {
          teamKey = 'team2';
      } else if (mapsData[mapName].team2.name === teamName) {
          teamKey = 'team2';
      } else {
          console.warn(`Unexpected third team (${teamName}) found for map ${mapName}. Skipping player ${playerName}.`);
          return; // Skip this player if we already have two distinct teams
      }
      
      // Initialize team structure if it's the first player for this team on this map
      if (!mapsData[mapName][teamKey]) {
        mapsData[mapName][teamKey] = {
          name: teamName,
          score: teamScore,
          players: []
        };
      } else {
        // Ensure score consistency if team already exists (optional, might take first score found)
        mapsData[mapName][teamKey].score = teamScore; 
      }

      // Map player stats - matching keys expected by index.html createTeamSection
      const playerStats = {
        name: playerName,
        steam_id: steamId, // Add steam_id here
        hltv_2: getData(row, 'hltv_2'),
        adr: getData(row, 'adr'),
        kd: getData(row, 'kd'),
        mvp: getData(row, 'mvp'),
        kills: getData(row, 'kills'),
        deaths: getData(row, 'deaths'),
        assists: getData(row, 'assists'),
        hs: getData(row, 'headshot_kills'),
        hs_ratio: getData(row, 'headshot_killratio'),
        first_kill: getData(row, 'first_kill_count'),
        first_death: getData(row, 'first_death_count'),
        bomb_planted: getData(row, 'bomb_planted'),
        bomb_defused: getData(row, 'bomb_defused'),
        hltv: getData(row, 'hltv'),
        kast: getData(row, 'kast'),
        utl_dmg: getData(row, 'utl_dmg'),
        two_kills: getData(row, 'two_kills'),
        three_kills: getData(row, 'three_kills'),
        four_kills: getData(row, 'four_kills'),
        five_kills: getData(row, 'five_kills'),
        score: getData(row, 'score'),
        clutches: getData(row, 'number_of_clutches', parseInt, 0), // Renamed from query
        clutches_won: getData(row, 'number_of_successful_clutches', parseInt, 0) // Renamed from query
      };

      mapsData[mapName][teamKey].players.push(playerStats);
    });

    // Structure for the final JSON
    const finalData = { maps: mapsData };

    // Write the result to sonmac.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'sonmac.json');
    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
    console.log('✅ Son Maç stats written to data/sonmac.json');

  } catch (error) {
    console.error('❌ Error updating Son Maç stats:', error);
  }
}

// Process Duello Son Maç (Last Match Duel) stats
async function updateDuelloSonMacStats() {
  try {
    console.log('Updating Duello Son Maç stats...');

    const results = await executeDbQuery(queries.duello_son_mac);

    if (!results || !results.rows || !results.rows.length) {
      console.log('No results found for Duello Son Maç stats.');
      // Create an empty structure if no data
      const emptyData = { playerRows: [], playerCols: [], duels: {} };
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const filePath = path.join(dataDir, 'duello_son_mac.json');
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
      console.log('✅ Empty Duello Son Maç stats written to data/duello_son_mac.json');
      return;
    }

    const columnMap = {};
    results.columns.forEach((colName, index) => {
      columnMap[colName.toLowerCase()] = index;
    });

    const duelsData = {};
    const playerSet = new Set();

    results.rows.forEach(row => {
      const playerRow = row[columnMap['playerrow']];
      const playerCol = row[columnMap['playercolumn']];
      const killDeathRatio = row[columnMap['killdeathratio']];

      playerSet.add(playerRow);
      playerSet.add(playerCol);

      if (!duelsData[playerRow]) {
        duelsData[playerRow] = {};
      }

      const [killsStr, deathsStr] = killDeathRatio.split('/');
      const kills = parseInt(killsStr, 10) || 0;
      const deaths = parseInt(deathsStr, 10) || 0;
      
      // Ensure the entry exists even if kills/deaths are 0/0 for diagonal
      duelsData[playerRow][playerCol] = { kills, deaths };
    });

    // Ensure all players have entries for all other players, even if no duels occurred
    const allPlayers = Array.from(playerSet).sort(); // Sort alphabetically for consistency
    allPlayers.forEach(rowPlayer => {
        if (!duelsData[rowPlayer]) {
            duelsData[rowPlayer] = {};
        }
        allPlayers.forEach(colPlayer => {
            if (!duelsData[rowPlayer][colPlayer]) {
                // Default to 0 kills/deaths if no specific duel data found
                duelsData[rowPlayer][colPlayer] = { kills: 0, deaths: 0 };
            }
        });
    });


    // Structure for the final JSON
    const finalData = { 
      playerRows: allPlayers, 
      playerCols: allPlayers, 
      duels: duelsData 
    };

    // Write the result to duello_son_mac.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'duello_son_mac.json');
    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
    console.log('✅ Duello Son Maç stats written to data/duello_son_mac.json');

  } catch (error) {
    console.error('❌ Error updating Duello Son Maç stats:', error);
  }
}

// Process Duello Sezon (Season Duel) stats
async function updateDuelloSezonStats() {
  try {
    console.log('Updating Duello Sezon stats...');

    const results = await executeDbQuery(queries.duello_sezon);

    if (!results || !results.rows || !results.rows.length) {
      console.log('No results found for Duello Sezon stats.');
      // Create an empty structure if no data
      const emptyData = { playerRows: [], playerCols: [], duels: {} };
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      // Ensure the correct filename is used
      const filePath = path.join(dataDir, 'duello_sezon.json'); 
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
      console.log('✅ Empty Duello Sezon stats written to data/duello_sezon.json');
      return;
    }

    const columnMap = {};
    results.columns.forEach((colName, index) => {
      columnMap[colName.toLowerCase()] = index;
    });

    const duelsData = {};
    const playerSet = new Set();

    results.rows.forEach(row => {
      const playerRow = row[columnMap['playerrow']];
      const playerCol = row[columnMap['playercolumn']];
      const killDeathRatio = row[columnMap['killdeathratio']];

      playerSet.add(playerRow);
      playerSet.add(playerCol);

      if (!duelsData[playerRow]) {
        duelsData[playerRow] = {};
      }

      const [killsStr, deathsStr] = killDeathRatio.split('/');
      const kills = parseInt(killsStr, 10) || 0;
      const deaths = parseInt(deathsStr, 10) || 0;
      
      // Ensure the entry exists even if kills/deaths are 0/0 for diagonal
      duelsData[playerRow][playerCol] = { kills, deaths };
    });

    // Ensure all players have entries for all other players, even if no duels occurred
    const allPlayers = Array.from(playerSet).sort(); // Sort alphabetically for consistency
    allPlayers.forEach(rowPlayer => {
        if (!duelsData[rowPlayer]) {
            duelsData[rowPlayer] = {};
        }
        allPlayers.forEach(colPlayer => {
            if (!duelsData[rowPlayer][colPlayer]) {
                // Default to 0 kills/deaths if no specific duel data found
                duelsData[rowPlayer][colPlayer] = { kills: 0, deaths: 0 };
            }
        });
    });


    // Structure for the final JSON
    const finalData = { 
      playerRows: allPlayers, 
      playerCols: allPlayers, 
      duels: duelsData 
    };

    // Write the result to duello_sezon.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    // Ensure the correct filename is used
    const filePath = path.join(dataDir, 'duello_sezon.json'); 
    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
    console.log('✅ Duello Sezon stats written to data/duello_sezon.json');

  } catch (error) {
    console.error('❌ Error updating Duello Sezon stats:', error);
  }
}

// Process Performance Graphs data
async function updatePerformanceGraphsStats() {
  try {
    console.log('Updating Performance Graphs data...');

    const results = await executeDbQuery(queries.performanceGraphs);

    if (!results || !results.rows || !results.rows.length) {
      console.log('No results found for Performance Graphs data.');
      const emptyData = []; // Use an empty array as expected by the frontend
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const filePath = path.join(dataDir, 'performance_data.json');
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2));
      console.log('✅ Empty Performance Graphs data written to data/performance_data.json');
      return;
    }

    const columnMap = {};
    results.columns.forEach((colName, index) => {
      columnMap[colName.toLowerCase()] = index;
    });

    const groupedData = {};

    results.rows.forEach(row => {
      const name = row[columnMap['name']];
      const matchDate = row[columnMap['match_date']];
      // Use getData helper for numeric values, allowing nulls
      const hltv_2_raw = row[columnMap['hltv_2']];
      const adr_raw = row[columnMap['adr']];
      const steamId = row[columnMap['steam_id']]; // Get steam_id

      // Parse only if not null, otherwise keep null
      const hltv_2 = (hltv_2_raw !== null && hltv_2_raw !== undefined) ? parseFloat(hltv_2_raw) : null;
      const adr = (adr_raw !== null && adr_raw !== undefined) ? parseFloat(adr_raw) : null;

      // Ensure date is formatted correctly (ISO string)
      const formattedDate = matchDate ? new Date(matchDate).toISOString() : null;
      
      if (!formattedDate) return; // Skip if date is invalid

      if (!groupedData[name]) {
        groupedData[name] = {
          name: name,
          steam_id: steamId, // Ensure steam_id is added here
          performance: []
        };
      } else if (!groupedData[name].steam_id) {
          // Add steam_id if the player object already exists but lacks it
          groupedData[name].steam_id = steamId; 
      }

      groupedData[name].performance.push({
        match_date: formattedDate,
        hltv_2: isNaN(hltv_2) ? null : hltv_2, // Final check for NaN after parseFloat
        adr: isNaN(adr) ? null : adr         // Final check for NaN after parseFloat
      });
    });

    // Convert the grouped object back into an array
    const finalData = Object.values(groupedData);

    // Sort the final array by player name (optional, but good practice)
    finalData.sort((a, b) => a.name.localeCompare(b.name));

    // Write the result to performance_data.json
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const filePath = path.join(dataDir, 'performance_data.json');
    fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
    console.log('✅ Performance Graphs data written to data/performance_data.json');

  } catch (error) {
    console.error('❌ Error updating Performance Graphs data:', error);
  }
}

// Main function
async function main() {
  try {
    console.log('Starting stats update process...');
    
    // Update season average stats
    await updateSeasonAvgStats();

    // Update night average stats
    await updateNightAvgStats();

    // Update last 10 match stats
    await updateLast10Stats();

    // Update Son Maç stats
    await updateSonMacStats();
    
    // Update Duello Son Maç stats
    await updateDuelloSonMacStats();

    // Update Duello Sezon stats
    await updateDuelloSezonStats();

    // Update Performance Graphs data
    await updatePerformanceGraphsStats();

    console.log('✅ Stats update process completed');
  } catch (error) {
    console.error('❌ Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 