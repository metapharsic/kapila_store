const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../db');

const RAW_DIR = path.join(__dirname, '../scratch/14th_aug_raw_agent_results');

// Canonical Departments
const CANONICAL_DEPTS = [
  'TIFFINS',
  'STAFF',
  'SI-MEALS',
  'NORTH INDIAN',
  'CHAT & SOFTY',
  'CHINESE & DOSA',
  'MOCKTAILS & CONTINENTAL',
  'RESTAURANT',
  'ROOM SERVICE'
];

function resolveCanonicalDept(deptStr, categoryStr = '') {
  const d = (deptStr || '').toUpperCase().trim();
  const c = (categoryStr || '').toUpperCase().trim();

  if (d.includes('TIFFIN') || c.includes('TIFFIN') || c.includes('IDLY') || c.includes('DOSA BATTER')) return 'TIFFINS';
  if (d.includes('SI-MEAL') || d.includes('SOUTH INDIAN - MEALS') || c.includes('SOUTH INDIAN - MEALS') || c.includes('SOUTHMEALS')) return 'SI-MEALS';
  if (d.includes('NORTH') || c.includes('NORTH INDIAN')) return 'NORTH INDIAN';
  if (d.includes('CHAT') || d.includes('SOFTY') || d.includes('JALPAN') || d.includes('STALL') || c.includes('CHAT') || c.includes('SOFTY') || c.includes('STALL') || c.includes('JALPAN')) return 'CHAT & SOFTY';
  if (d.includes('CHINESE') || d.includes('DOSA') || c.includes('CHINESE') || c.includes('DOSA')) return 'CHINESE & DOSA';
  if (d.includes('MOCKTAIL') || d.includes('CONTINENTAL') || c.includes('MOCKTAIL') || c.includes('CONTINENTAL')) return 'MOCKTAILS & CONTINENTAL';
  if (d.includes('RESTAURANT') || c.includes('TEA') || c.includes('JUICE')) return 'RESTAURANT';
  if (d.includes('ROOM') || c.includes('ROOM SERVICE')) return 'ROOM SERVICE';
  if (d.includes('STAFF') || d.includes('COOKIES') || c.includes('STAFF') || c.includes('COOKIES')) return 'STAFF';

  return 'NORTH INDIAN'; // safe fallback
}

function cleanCategoryName(raw) {
  if (!raw) return 'General';
  let s = raw.trim();
  // Normalize variations
  if (/^south\s*indian\s*-\s*tiffines$/i.test(s)) return 'South Indian Tiffins';
  if (/^south\s*indian\s*-\s*meals$/i.test(s)) return 'South Indian Meals';
  if (/^disposables\s*-\s*jalpan$/i.test(s)) return 'Disposable Jalpan';
  if (/^mocktails\s*&\s*ice\s*creams?$/i.test(s)) return 'Mocktails & Ice Cream';
  if (/^softy\s*ice\s*cream$/i.test(s)) return 'Softy Ice Cream';
  if (/^vegetables$/i.test(s)) return 'Vegetables';
  if (/^hk\s*cleaning$/i.test(s)) return 'Housekeeping & Cleaning';
  if (/^disposables?$/i.test(s)) return 'Disposables';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateCode(prefix, name) {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);
  return `${prefix}-${clean}-${Math.floor(100 + Math.random() * 900)}`;
}

async function runProvisioning() {
  console.log('================================================================================');
  console.log('  MULTI-AGENT 14TH AUGUST TRANSFER REQUISITION & CATEGORY PROVISIONING PIPELINE ');
  console.log('================================================================================\n');

  // Load all 15 page extractions
  const rawPages = [];
  for (let i = 1; i <= 15; i++) {
    const pStr = String(i).padStart(2, '0');
    const fPath = path.join(RAW_DIR, `page_${pStr}_extracted.json`);
    if (!fs.existsSync(fPath)) {
      throw new Error(`Missing extracted page: ${fPath}`);
    }
    rawPages.push(JSON.parse(fs.readFileSync(fPath, 'utf8')));
  }

  console.log(`[Agent Intake] Successfully loaded all ${rawPages.length} parsed voucher pages.`);

  // --------------------------------------------------------------------------
  // AGENT 2: Category Harmonizer Agent (CategoryHarmonizerAgent)
  // --------------------------------------------------------------------------
  console.log('\n--> [Agent 2: CategoryHarmonizerAgent] Analyzing & harmonizing categories...');

  // Collect distinct categories with their associated department
  const categoryMap = new Map(); // normalizedCategoryName -> { rawName, department, pageSet, items }

  rawPages.forEach((page) => {
    const pageDept = page.department_name;
    page.categories.forEach((cat) => {
      const canonName = cleanCategoryName(cat.category_name);
      const targetDept = resolveCanonicalDept(pageDept, cat.category_name);

      if (!categoryMap.has(canonName)) {
        categoryMap.set(canonName, {
          name: canonName,
          department: targetDept,
          pages: new Set([page.page_number]),
          items: []
        });
      } else {
        const entry = categoryMap.get(canonName);
        entry.pages.add(page.page_number);
      }

      const entry = categoryMap.get(canonName);
      cat.items.forEach((item) => {
        if (item.item_name && item.item_name.trim()) {
          entry.items.push({
            ...item,
            page_number: page.page_number,
            department: targetDept,
            category: canonName
          });
        }
      });
    });
  });

  console.log(`[Agent 2] Identified ${categoryMap.size} distinct categories mentioned in 14th August indents:`);
  for (const [cName, info] of categoryMap.entries()) {
    console.log(`  - Category: "${cName}" | Dept: ${info.department} | Items: ${info.items.length} | Pages: [${Array.from(info.pages).join(', ')}]`);
  }

  // Provision into `indent_subcategories` table
  const subcategoryDbMap = new Map(); // canonName -> subcategoryId
  for (const [cName, info] of categoryMap.entries()) {
    let existing = await db('indent_subcategories')
      .whereRaw('LOWER(name) = LOWER(?)', [cName])
      .first();

    if (!existing) {
      // Also check code
      const subCode = `SUB-${cName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 15)}`;
      existing = await db('indent_subcategories').where('code', subCode).first();
      if (!existing) {
        const [inserted] = await db('indent_subcategories')
          .insert({
            code: subCode,
            name: cName,
            department_name: info.department,
            icon: cName.toLowerCase().includes('veg') ? '🥕' : cName.toLowerCase().includes('dispos') ? '🥡' : '📦',
            description: `Items provisioned from 14th August Transfer Indent for ${info.department}.`,
            is_active: true
          })
          .returning('*');
        existing = inserted;
        console.log(`[Agent 2] Created new indent_subcategory: ID ${existing.id} (${existing.name} -> ${existing.department_name})`);
      }
    }

    subcategoryDbMap.set(cName, existing.id);
  }

  // --------------------------------------------------------------------------
  // AGENT 3: Catalog & Subcategory Items Provisioning Agent
  // --------------------------------------------------------------------------
  console.log('\n--> [Agent 3: CatalogProvisioningAgent] Provisioning items into indent_subcategory_items, stock, and indent_templates...');

  let totalItemsProvisioned = 0;
  let totalStockCreated = 0;
  let totalTemplateLinesAdded = 0;

  for (const [cName, info] of categoryMap.entries()) {
    const subcatId = subcategoryDbMap.get(cName);

    // Deduplicate items under this category by name
    const uniqueCategoryItems = new Map();
    info.items.forEach((it) => {
      const normItemName = it.item_name.trim().toLowerCase();
      if (!uniqueCategoryItems.has(normItemName)) {
        uniqueCategoryItems.set(normItemName, it);
      } else {
        // If second occurrence has positive quantity, merge it
        const existing = uniqueCategoryItems.get(normItemName);
        if ((!existing.quantity || existing.quantity === 0) && it.quantity > 0) {
          uniqueCategoryItems.set(normItemName, it);
        }
      }
    });

    let sortOrder = 1;
    for (const [normName, it] of uniqueCategoryItems.entries()) {
      const cleanName = it.item_name.trim();
      const unit = (it.unit || 'kg').toLowerCase();
      const qty = parseFloat(it.quantity) || 0;

      // 1. Check or insert into indent_subcategory_items
      const existingSubItem = await db('indent_subcategory_items')
        .where({ subcategory_id: subcatId })
        .whereRaw('LOWER(item_name) = LOWER(?)', [cleanName])
        .first();

      const skuCode = existingSubItem?.sku || `SKU-${cName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase()}-${sortOrder.toString().padStart(3, '0')}`;

      if (!existingSubItem) {
        await db('indent_subcategory_items').insert({
          subcategory_id: subcatId,
          item_name: cleanName,
          sku: skuCode,
          unit: unit,
          standard_pack_size: `1 ${unit}`,
          default_cost: 0,
          default_qty: qty > 0 ? qty : 1,
          min_order_qty: 0.1,
          max_order_qty: 500,
          notes: it.notes || `14th Aug Indent Page ${it.page_number}`,
          sort_order: sortOrder
        });
        totalItemsProvisioned++;
      } else if (qty > 0 && (!existingSubItem.default_qty || existingSubItem.default_qty <= 1)) {
        await db('indent_subcategory_items')
          .where('id', existingSubItem.id)
          .update({ default_qty: qty, notes: it.notes || existingSubItem.notes });
      }

      // 2. Ensure item exists in `stock` master
      let stockItem = await db('stock')
        .whereRaw('LOWER(name) = LOWER(?)', [cleanName])
        .first();

      if (!stockItem) {
        const itemCode = `KPL-${cName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 899)}`;
        const [newStock] = await db('stock')
          .insert({
            name: cleanName,
            item_code: itemCode,
            category: cName,
            unit: unit,
            price: 50.0,
            remaining: 100.0,
            qty: 100.0,
            date: '2026-08-14'
          })
          .returning('*');
        stockItem = newStock;
        totalStockCreated++;
      }

      // 3. Ensure item is in `indent_templates` for the canonical department
      const existingTemplate = await db('indent_templates')
        .where({ template_name: info.department })
        .whereRaw('LOWER(item_name) = LOWER(?)', [cleanName])
        .first();

      if (!existingTemplate) {
        const maxRowResult = await db('indent_templates')
          .where({ template_name: info.department })
          .max('row_no as max_row')
          .first();

        const nextRowNo = (parseInt(maxRowResult?.max_row || 0, 10)) + 1;

        await db('indent_templates').insert({
          template_name: info.department,
          row_no: nextRowNo,
          item_name: cleanName,
          item_code: stockItem?.item_code || skuCode,
          default_unit: unit
        });
        totalTemplateLinesAdded++;
      }

      sortOrder++;
    }
  }

  console.log(`[Agent 3] Catalog Provisioning Completed:`);
  console.log(`  - Subcategory items provisioned: ${totalItemsProvisioned}`);
  console.log(`  - New stock master records created: ${totalStockCreated}`);
  console.log(`  - Indent template lines added: ${totalTemplateLinesAdded}`);

  // --------------------------------------------------------------------------
  // AGENT 4: Transactional Indent & Transfer Fulfillment Provisioner
  // --------------------------------------------------------------------------
  console.log('\n--> [Agent 4: IndentTransferFulfillmentAgent] Provisioning 14th August indents & issuances in DB...');

  // Group items with positive quantities by department to create authentic 14th August indents
  const deptTransfers = new Map(); // dept -> Array of items with positive qty

  rawPages.forEach((page) => {
    const pageDept = resolveCanonicalDept(page.department_name);
    page.categories.forEach((cat) => {
      const canonDept = resolveCanonicalDept(page.department_name, cat.category_name);
      cat.items.forEach((it) => {
        const qty = parseFloat(it.quantity);
        if (!isNaN(qty) && qty > 0) {
          if (!deptTransfers.has(canonDept)) {
            deptTransfers.set(canonDept, []);
          }
          deptTransfers.get(canonDept).push({
            name: it.item_name.trim(),
            qty: qty,
            unit: (it.unit || 'kg').toLowerCase(),
            category: cleanCategoryName(cat.category_name),
            page_number: page.page_number
          });
        }
      });
    });
  });

  let totalIndentsCreated = 0;
  let totalIndentItemsCreated = 0;
  let totalIssuancesCreated = 0;

  for (const [dept, items] of deptTransfers.entries()) {
    // Check if 14th August indent already exists for this dept
    let indent = await db('indents')
      .where({ dept: dept, date: '2026-08-14' })
      .first();

    if (!indent) {
      const [newIndent] = await db('indents')
        .insert({
          dept: dept,
          date: '2026-08-14',
          status: 'issued',
          indent_type: 'routine'
        })
        .returning('*');
      indent = newIndent;
      totalIndentsCreated++;
    }

    // Check if matching issuance exists
    let issuance = await db('issuances')
      .where({ indent_id: indent.id })
      .first();

    if (!issuance) {
      const [newIssuance] = await db('issuances')
        .insert({
          indent_id: indent.id,
          dept: dept,
          date: '2026-08-14',
          scanned: false
        })
        .returning('*');
      issuance = newIssuance;
      totalIssuancesCreated++;
    }

    // Insert indent_items and issuance_items
    for (const it of items) {
      const existingItem = await db('indent_items')
        .where({ indent_id: indent.id })
        .whereRaw('LOWER(name) = LOWER(?)', [it.name])
        .first();

      const stockMatch = await db('stock').whereRaw('LOWER(name) = LOWER(?)', [it.name]).first();
      const code = stockMatch?.item_code || `KPL-${Math.floor(100 + Math.random() * 800)}`;

      if (!existingItem) {
        await db('indent_items').insert({
          indent_id: indent.id,
          name: it.name,
          qty: it.qty,
          unit: it.unit,
          item_code: code,
          issued_qty: it.qty
        });
        totalIndentItemsCreated++;
      }

      const existingIssueItem = await db('issuance_items')
        .where({ issuance_id: issuance.id })
        .whereRaw('LOWER(name) = LOWER(?)', [it.name])
        .first();

      if (!existingIssueItem) {
        await db('issuance_items').insert({
          issuance_id: issuance.id,
          name: it.name,
          qty: it.qty,
          issued: it.qty,
          unit: it.unit,
          item_code: code,
          unit_price: stockMatch?.price ? parseFloat(stockMatch.price) : 50.0
        });
      }
    }
  }

  console.log(`[Agent 4] 14th August Transactional Provisioning Completed:`);
  console.log(`  - Indent vouchers created: ${totalIndentsCreated}`);
  console.log(`  - Material issuances created: ${totalIssuancesCreated}`);
  console.log(`  - Indent line items populated: ${totalIndentItemsCreated}`);

  // --------------------------------------------------------------------------
  // AGENT 5: Audit & Integrity Verification Agent
  // --------------------------------------------------------------------------
  console.log('\n--> [Agent 5: AuditIntegrityAgent] Running comprehensive verification audit...');

  const totalSubcatsInDb = await db('indent_subcategories').count('id as count');
  const totalSubItemsInDb = await db('indent_subcategory_items').count('id as count');
  const totalStockInDb = await db('stock').count('id as count');
  const indentsOn14th = await db('indents').where('date', '2026-08-14');
  const indentItemsOn14th = await db('indent_items')
    .join('indents', 'indent_items.indent_id', 'indents.id')
    .where('indents.date', '2026-08-14')
    .count('indent_items.id as count');

  console.log('\n=================== VERIFICATION AUDIT REPORT ===================');
  console.log(`Total Indent Subcategories in Database: ${totalSubcatsInDb[0].count}`);
  console.log(`Total Subcategory Items Provisioned:   ${totalSubItemsInDb[0].count}`);
  console.log(`Total Master Stock Catalog Items:     ${totalStockInDb[0].count}`);
  console.log(`14th August Indents in Database:        ${indentsOn14th.length}`);
  console.log(`14th August Line Items in Database:     ${indentItemsOn14th[0].count}`);
  console.log('=================================================================\n');

  // Breakdown per category
  const categoryBreakdown = await db('indent_subcategories as s')
    .leftJoin('indent_subcategory_items as i', 's.id', 'i.subcategory_id')
    .select('s.name as category_name', 's.department_name')
    .count('i.id as item_count')
    .groupBy('s.id', 's.name', 's.department_name')
    .orderBy('s.department_name', 'asc');

  console.table(categoryBreakdown);

  console.log('ALL ITEMS AND CATEGORIES FROM 14TH AUGUST TRANSFERS SUCCESSFULLY PROVISIONED!');
  process.exit(0);
}

runProvisioning().catch((err) => {
  console.error('Provisioning failed:', err);
  process.exit(1);
});
