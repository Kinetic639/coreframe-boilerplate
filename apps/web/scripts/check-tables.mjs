/* global process */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  console.log('🔍 Checking existing tables...\n');

  const tablesToCheck = [
    'products',
    'product_barcodes',
    'product_custom_field_definitions',
    'product_custom_field_values',
    'product_variants',
    'product_categories',
    'variant_option_groups',
    'variant_option_values',
    'product_images'
  ];

  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.code === '42P01') {
          console.log(`❌ Table "${table}" does not exist`);
        } else {
          console.log(`⚠️  Table "${table}" - Error: ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${table}" exists`);
      }
    } catch (err) {
      console.log(`❌ Table "${table}" - Exception: ${err.message}`);
    }
  }
}

checkTables();
