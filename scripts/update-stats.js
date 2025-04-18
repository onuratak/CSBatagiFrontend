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

      // Access data using the getData helper function
      return { 
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