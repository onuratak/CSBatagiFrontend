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
const sezonbaslangic = process.env.SEZON_BASLANGIC || '2023-09-01';

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
  
  // Other queries commented out until needed
  /*
  // Query for last10.json - retrieves stats from last 10 matches
  last10: `
    // Query will be added later
  `,
  
  // Query for night_avg.json - retrieves stats from night matches
  nightAvg: `
    // Query will be added later
  `,
  
  // Query for sonmac.json - retrieves latest match data
  matchStats: `
    // Query will be added later
  `
  */
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
    
    if (!results || !results.length) {
      console.log('No results found for season average stats');
      return;
    }
    
    // Transform the data
    const transformedData = results.map(player => ({
      name: player.name,
      hltv_2: parseFloat(player.hltv_2 || 0),
      adr: parseFloat(player.adr || 0),
      kd: parseFloat(player.kd || 0),
      mvp: parseFloat(player.mvp || 0),
      kills: parseFloat(player.kills || 0),
      deaths: parseFloat(player.deaths || 0),
      assists: parseFloat(player.assists || 0),
      hs: parseFloat(player.headshot_kills || 0),
      hs_ratio: parseFloat(player.headshot_killratio || 0),
      first_kill: parseFloat(player.first_kill_count || 0),
      first_death: parseFloat(player.first_death_count || 0),
      bomb_planted: parseFloat(player.bomb_planted || 0),
      bomb_defused: parseFloat(player.bomb_defused || 0),
      hltv: parseFloat(player.hltv || 0),
      kast: parseFloat(player.kast || 0),
      utl_dmg: parseFloat(player.utl_dmg || 0),
      two_kills: parseFloat(player.two_kills || 0),
      three_kills: parseFloat(player.three_kills || 0),
      four_kills: parseFloat(player.four_kills || 0),
      five_kills: parseFloat(player.five_kills || 0),
      matches: parseInt(player.matches_in_interval || 0),
      win_rate: parseFloat(player.win_rate_percentage || 0),
      avg_clutches: parseFloat(player.avg_clutches || 0),
      avg_clutches_won: parseFloat(player.avg_clutches_won || 0),
      clutch_success: parseFloat(player.successful_clutch_percentage || 0)
    }));
    
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

// Main function
async function main() {
  try {
    console.log('Starting stats update process...');
    
    // Only update season average stats for now
    await updateSeasonAvgStats();
    
    console.log('✅ Stats update process completed');
  } catch (error) {
    console.error('❌ Error in main function:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 