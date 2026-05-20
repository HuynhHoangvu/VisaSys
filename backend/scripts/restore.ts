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

const backupPath = path.resolve(process.cwd(), 'backup_data.json');

if (!fs.existsSync(backupPath)) {
  console.error(`Backup file not found at: ${backupPath}`);
  process.exit(1);
}

async function runRestore() {
  console.log(`Connecting to database to restore...`);
  const client = new pg.Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log("Connected successfully!");

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const tables = Object.keys(backupData);
    console.log(`Backup contains ${tables.length} tables.`);

    // Fetch column data types to handle json/jsonb columns correctly
    console.log("Fetching database column metadata...");
    const columnTypes: Record<string, Record<string, string>> = {};
    const typeRes = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);
    
    for (const row of typeRes.rows) {
      if (!columnTypes[row.table_name]) {
        columnTypes[row.table_name] = {};
      }
      columnTypes[row.table_name][row.column_name] = row.data_type;
    }

    // Disable all triggers/constraints
    await client.query("SET session_replication_role = 'replica';");
    console.log("Temporarily disabled triggers and foreign key checks.");

    // Helper to determine target table name (mapping express_session to session if needed)
    const getTargetTable = async (table: string): Promise<string> => {
      if (table === 'express_session') {
        const hasSessionTable = (await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = 'session'
          )
        `)).rows[0].exists;
        if (hasSessionTable) {
          return 'session';
        }
      }
      return table;
    };

    // Truncate tables
    for (const table of tables) {
      const targetTable = await getTargetTable(table);
      // Check if target table exists in DB before truncating
      const tableExists = (await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name = '${targetTable}'
        )
      `)).rows[0].exists;

      if (!tableExists) {
        console.warn(`Table "${targetTable}" does not exist in the database. Skipping truncation.`);
        continue;
      }

      console.log(`Truncating table: ${targetTable}...`);
      await client.query(`TRUNCATE TABLE "${targetTable}" CASCADE;`);
    }

    // Insert rows
    for (const table of tables) {
      const rows = backupData[table];
      if (!rows || rows.length === 0) {
        console.log(`Table ${table} has no data to restore.`);
        continue;
      }

      const targetTable = await getTargetTable(table);
      const tableExists = (await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name = '${targetTable}'
        )
      `)).rows[0].exists;

      if (!tableExists) {
        console.warn(`Table "${targetTable}" does not exist in the database. Skipping insertion.`);
        continue;
      }

      console.log(`Restoring ${rows.length} rows to table: ${targetTable}...`);
      
      const columns = Object.keys(rows[0]);
      const columnsStr = columns.map(col => `"${col}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      
      const query = `INSERT INTO "${targetTable}" (${columnsStr}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => {
          const val = row[col];
          const type = columnTypes[targetTable]?.[col];
          
          // If the database column is json/jsonb, explicitly serialize it to string
          if ((type === 'json' || type === 'jsonb') && val !== null && val !== undefined) {
            return JSON.stringify(val);
          }
          return val;
        });
        await client.query(query, values);
      }
    }

    // Attempt to reset serial sequences if any
    console.log("Resetting auto-increment sequences...");
    const seqRes = await client.query(`
      SELECT c.relname AS seq_name, t.relname AS table_name, a.attname AS column_name
      FROM pg_class c
      JOIN pg_depend d ON d.objid = c.oid
      JOIN pg_class t ON t.oid = d.refobjid
      JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      WHERE c.relkind = 'S'
    `);
    
    for (const row of seqRes.rows) {
      const { table_name, column_name, seq_name } = row;
      const originalOrTargetMatch = tables.includes(table_name) || (table_name === 'session' && tables.includes('express_session'));
      if (originalOrTargetMatch) {
        console.log(`Resetting sequence ${seq_name} for table ${table_name}...`);
        await client.query(`
          SELECT setval(
            '${seq_name}', 
            COALESCE((SELECT MAX("${column_name}") FROM "${table_name}"), 1)
          )
        `);
      }
    }

    console.log("Database restore completed successfully!");
  } catch (error) {
    console.error("Error during restore:", error);
    process.exit(1);
  } finally {
    // Re-enable triggers/constraints
    try {
      await client.query("SET session_replication_role = 'origin';");
      console.log("Re-enabled triggers and foreign key checks.");
    } catch (e) {
      console.error("Failed to re-enable triggers:", e);
    }
    await client.end();
  }
}

runRestore();
