import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Please provide a database URL as an argument or set DATABASE_URL in .env");
  process.exit(1);
}

async function runBackup() {
  console.log(`Connecting to database to backup...`);
  const client = new pg.Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log("Connected successfully!");

    // Get all user tables in public schema
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesRes.rows.map(row => row.table_name);
    console.log(`Found ${tables.length} tables to backup:`, tables);

    const backupData: Record<string, any[]> = {};

    for (const table of tables) {
      console.log(`Backing up table: ${table}...`);
      // Escape table name to avoid SQL syntax issues
      const dataRes = await client.query(`SELECT * FROM "${table}"`);
      backupData[table] = dataRes.rows;
      console.log(`  Saved ${dataRes.rows.length} rows from ${table}`);
    }

    const backupPath = path.resolve(process.cwd(), 'backup_data.json');
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
    console.log(`Backup completed successfully! Saved to: ${backupPath}`);
  } catch (error) {
    console.error("Error during backup:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runBackup();
