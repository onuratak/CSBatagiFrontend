// PostgreSQL to JSON converter for CS:GO stats
// This script connects to your PostgreSQL database, runs queries, and generates JSON files
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  ssl: {
    rejectUnauthorized: false // Needed for some cloud DBs
  }
});

// SQL Queries - replace these with your actual queries from Google Sheets
const queries = {
  // Query for season_avg.json - retrieves overall season stats
  seasonAvg: `
    SELECT 
      player_name as name,
      ROUND(AVG(hltv2)::numeric, 2) as hltv_2,
      ROUND(AVG(adr)::numeric, 2) as adr,
      ROUND(AVG(k_d)::numeric, 2) as kd,
      ROUND(AVG(mvp)::numeric, 2) as mvp,
      ROUND(AVG(kills)::numeric, 2) as kills,
      ROUND(AVG(deaths)::numeric, 2) as deaths,
      ROUND(AVG(assists)::numeric, 2) as assists,
      ROUND(AVG(headshots)::numeric, 2) as hs,
      ROUND(AVG(hs_percentage)::numeric, 2) as hs_ratio,
      ROUND(AVG(first_kills)::numeric, 2) as first_kill,
      ROUND(AVG(first_deaths)::numeric, 2) as first_death,
      ROUND(AVG(bomb_planted)::numeric, 2) as bomb_planted,
      ROUND(AVG(bomb_defused)::numeric, 2) as bomb_defused,
      ROUND(AVG(hltv)::numeric, 2) as hltv,
      ROUND(AVG(kast)::numeric, 2) as kast,
      ROUND(AVG(utility_damage)::numeric, 2) as utl_dmg,
      ROUND(AVG(two_kills)::numeric, 2) as two_kills,
      ROUND(AVG(three_kills)::numeric, 2) as three_kills,
      ROUND(AVG(four_kills)::numeric, 2) as four_kills,
      ROUND(AVG(five_kills)::numeric, 2) as five_kills,
      COUNT(DISTINCT match_id) as matches,
      ROUND((SUM(CASE WHEN won THEN 1 ELSE 0 END)::numeric / COUNT(DISTINCT match_id)) * 100, 2) as win_rate,
      ROUND(AVG(clutches)::numeric, 2) as avg_clutches,
      ROUND(AVG(clutches_won)::numeric, 2) as avg_clutches_won,
      ROUND((SUM(clutches_won)::numeric / NULLIF(SUM(clutches), 0)) * 100, 2) as clutch_success
    FROM player_stats
    GROUP BY player_name
    HAVING COUNT(DISTINCT match_id) >= 5
    ORDER BY hltv_2 DESC
  `,
  
  // Query for last10.json - retrieves stats from last 10 matches
  last10: `
    SELECT 
      ps.player_name as name,
      ROUND(AVG(ps.hltv2)::numeric, 2) as hltv_2,
      ROUND(AVG(ps.adr)::numeric, 2) as adr,
      ROUND(AVG(ps.k_d)::numeric, 2) as kd,
      ROUND(AVG(ps.mvp)::numeric, 2) as mvp,
      ROUND(AVG(ps.kills)::numeric, 2) as kills,
      ROUND(AVG(ps.deaths)::numeric, 2) as deaths,
      ROUND(AVG(ps.assists)::numeric, 2) as assists,
      ROUND(AVG(ps.headshots)::numeric, 2) as hs,
      ROUND(AVG(ps.hs_percentage)::numeric, 2) as hs_ratio,
      ROUND(AVG(ps.first_kills)::numeric, 2) as first_kill,
      ROUND(AVG(ps.first_deaths)::numeric, 2) as first_death,
      ROUND(AVG(ps.bomb_planted)::numeric, 2) as bomb_planted,
      ROUND(AVG(ps.bomb_defused)::numeric, 2) as bomb_defused,
      ROUND(AVG(ps.hltv)::numeric, 2) as hltv,
      ROUND(AVG(ps.kast)::numeric, 2) as kast,
      ROUND(AVG(ps.utility_damage)::numeric, 2) as utl_dmg,
      ROUND(AVG(ps.two_kills)::numeric, 2) as two_kills,
      ROUND(AVG(ps.three_kills)::numeric, 2) as three_kills,
      ROUND(AVG(ps.four_kills)::numeric, 2) as four_kills,
      ROUND(AVG(ps.five_kills)::numeric, 2) as five_kills,
      COUNT(DISTINCT ps.match_id) as matches,
      ROUND((SUM(CASE WHEN ps.won THEN 1 ELSE 0 END)::numeric / COUNT(DISTINCT ps.match_id)) * 100, 2) as win_rate,
      ROUND(AVG(ps.clutches)::numeric, 2) as avg_clutches,
      ROUND(AVG(ps.clutches_won)::numeric, 2) as avg_clutches_won,
      ROUND((SUM(ps.clutches_won)::numeric / NULLIF(SUM(ps.clutches), 0)) * 100, 2) as clutch_success
    FROM player_stats ps
    JOIN (
      SELECT DISTINCT match_id 
      FROM matches
      ORDER BY match_date DESC 
      LIMIT 10
    ) recent ON ps.match_id = recent.match_id
    GROUP BY ps.player_name
    HAVING COUNT(DISTINCT ps.match_id) >= 3
    ORDER BY hltv_2 DESC
  `,
  
  // Query for night_avg.json - retrieves stats from night matches
  nightAvg: `
    SELECT 
      ps.player_name as name,
      ROUND(AVG(ps.hltv2)::numeric, 2) as hltv_2,
      ROUND(AVG(ps.adr)::numeric, 2) as adr,
      ROUND(AVG(ps.k_d)::numeric, 2) as kd,
      ROUND(AVG(ps.mvp)::numeric, 2) as mvp,
      ROUND(AVG(ps.kills)::numeric, 2) as kills,
      ROUND(AVG(ps.deaths)::numeric, 2) as deaths,
      ROUND(AVG(ps.assists)::numeric, 2) as assists,
      ROUND(AVG(ps.headshots)::numeric, 2) as hs,
      ROUND(AVG(ps.hs_percentage)::numeric, 2) as hs_ratio,
      ROUND(AVG(ps.first_kills)::numeric, 2) as first_kill,
      ROUND(AVG(ps.first_deaths)::numeric, 2) as first_death,
      ROUND(AVG(ps.bomb_planted)::numeric, 2) as bomb_planted,
      ROUND(AVG(ps.bomb_defused)::numeric, 2) as bomb_defused,
      ROUND(AVG(ps.hltv)::numeric, 2) as hltv,
      ROUND(AVG(ps.kast)::numeric, 2) as kast,
      ROUND(AVG(ps.utility_damage)::numeric, 2) as utl_dmg,
      ROUND(AVG(ps.two_kills)::numeric, 2) as two_kills,
      ROUND(AVG(ps.three_kills)::numeric, 2) as three_kills,
      ROUND(AVG(ps.four_kills)::numeric, 2) as four_kills,
      ROUND(AVG(ps.five_kills)::numeric, 2) as five_kills,
      COUNT(DISTINCT ps.match_id) as matches,
      ROUND((SUM(CASE WHEN ps.won THEN 1 ELSE 0 END)::numeric / COUNT(DISTINCT ps.match_id)) * 100, 2) as win_rate,
      ROUND(AVG(ps.clutches)::numeric, 2) as avg_clutches,
      ROUND(AVG(ps.clutches_won)::numeric, 2) as avg_clutches_won,
      ROUND((SUM(ps.clutches_won)::numeric / NULLIF(SUM(ps.clutches), 0)) * 100, 2) as clutch_success
    FROM player_stats ps
    JOIN matches m ON ps.match_id = m.match_id
    WHERE EXTRACT(HOUR FROM m.match_date) >= 22 
       OR EXTRACT(HOUR FROM m.match_date) < 4
    GROUP BY ps.player_name
    HAVING COUNT(DISTINCT ps.match_id) >= 5
    ORDER BY hltv_2 DESC
  `,
  
  // Query for sonmac.json - retrieves latest match data
  matchStats: `
    SELECT 
      m.map_name,
      t.team_name,
      ps.player_name as name,
      ps.steam_id,
      t.score as team_score,
      ps.hltv2,
      ps.adr,
      ps.kills,
      ps.deaths,
      ps.assists,
      ps.k_d as kd,
      ps.headshots as headshot_kills,
      ps.hs_percentage as headshot_killratio,
      ps.first_kills as first_kill_count,
      ps.first_deaths as first_death_count,
      ps.bomb_planted,
      ps.bomb_defused,
      ps.hltv,
      ps.mvp,
      ps.kast,
      ps.utility_damage as utl_dmg,
      ps.two_kills,
      ps.three_kills,
      ps.four_kills,
      ps.five_kills,
      ps.score,
      ps.clutches as number_of_clutches,
      ps.clutches_won as number_of_successful_clutches,
      m.match_date as latest_match_date
    FROM player_stats ps
    JOIN teams t ON ps.team_id = t.team_id
    JOIN maps m ON ps.map_id = m.map_id
    JOIN matches match ON m.match_id = match.match_id
    WHERE match.match_id = (
      SELECT match_id 
      FROM matches 
      ORDER BY match_date DESC 
      LIMIT 1
    )
    ORDER BY m.map_name, t.team_name, ps.hltv2 DESC
  `
};

// Function to execute query and write results to JSON file
async function updateStats(queryName, fileName) {
  try {
    const result = await pool.query(queries[queryName]);
    const jsonData = JSON.stringify(result.rows, null, 2);
    fs.writeFileSync(path.join(__dirname, '..', 'data', fileName), jsonData);
    console.log(`✅ Updated data/${fileName}`);
  } catch (error) {
    console.error(`❌ Error updating ${fileName}:`, error);
  }
}

// Map for the match stats (needs special processing)
async function updateMatchStats() {
  try {
    const result = await pool.query(queries.matchStats);
    
    // Transform the flat data into the nested structure for sonmac.json
    const matchData = {
      match_date: result.rows[0]?.latest_match_date?.split('T')[0] || '',
      maps: {}
    };
    
    // Process rows to build the structure
    result.rows.forEach(row => {
      const mapName = row.map_name;
      
      if (!matchData.maps[mapName]) {
        matchData.maps[mapName] = {
          team1: null,
          team2: null
        };
      }
      
      // Determine team1 or team2
      let teamKey;
      if (!matchData.maps[mapName].team1) {
        teamKey = 'team1';
      } else if (matchData.maps[mapName].team1.name !== row.team_name && !matchData.maps[mapName].team2) {
        teamKey = 'team2';
      } else {
        teamKey = matchData.maps[mapName].team1.name === row.team_name ? 'team1' : 'team2';
      }
      
      // Initialize team if needed
      if (!matchData.maps[mapName][teamKey]) {
        matchData.maps[mapName][teamKey] = {
          name: row.team_name,
          score: parseInt(row.team_score),
          players: []
        };
      }
      
      // Add player
      matchData.maps[mapName][teamKey].players.push({
        name: row.name,
        steam_id: row.steam_id,
        hltv_2: parseFloat(row.hltv2),
        adr: parseFloat(row.adr),
        kd: parseFloat(row.kd),
        kills: parseInt(row.kills),
        deaths: parseInt(row.deaths),
        assists: parseInt(row.assists),
        hs: parseInt(row.headshot_kills),
        hs_ratio: parseInt(row.headshot_killratio),
        first_kill: parseInt(row.first_kill_count),
        first_death: parseInt(row.first_death_count),
        bomb_planted: parseInt(row.bomb_planted),
        bomb_defused: parseInt(row.bomb_defused),
        hltv: parseFloat(row.hltv),
        mvp: parseInt(row.mvp),
        kast: parseFloat(row.kast),
        utl_dmg: parseInt(row.utl_dmg),
        two_kills: parseInt(row.two_kills),
        three_kills: parseInt(row.three_kills),
        four_kills: parseInt(row.four_kills),
        five_kills: parseInt(row.five_kills),
        score: parseInt(row.score),
        clutches: parseInt(row.number_of_clutches),
        clutches_won: parseInt(row.number_of_successful_clutches)
      });
    });
    
    // Update path to write to data folder
    fs.writeFileSync(
      path.join(__dirname, '..', 'data', 'sonmac.json'), 
      JSON.stringify(matchData, null, 2)
    );
    console.log('✅ Updated data/sonmac.json');
  } catch (error) {
    console.error('❌ Error updating sonmac.json:', error);
  }
}

// Main function
async function main() {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    await updateStats('seasonAvg', 'season_avg.json');
    await updateStats('last10', 'last10.json');
    await updateStats('nightAvg', 'night_avg.json');
    await updateMatchStats();
    console.log('✅ All stats updated successfully');
  } catch (error) {
    console.error('❌ Error updating stats:', error);
  } finally {
    // Close pool
    await pool.end();
  }
}

// Run the script
main(); 