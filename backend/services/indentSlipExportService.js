const ExcelJS = require("exceljs");
const db = require("../db");
const { safeMergeCells } = require("./inventoryReportService");

const PALETTE = {
  navyDark: "0F172A",
  navyHeader: "1E293B",
  navyLight: "334155",
  goldAccent: "E8A838",
  goldLight: "FEF3C7",
  goldBorder: "D97706",
  greenSuccess: "10B981",
  greenLight: "D1FAE5",
  blueAccent: "2563EB",
  blueLight: "DBEAFE",
  borderLight: "CBD5E1",
  zebraBg: "F8FAFC",
  white: "FFFFFF",
  grayText: "475569",
};

const BORDER_THIN = {
  top: { style: "thin", color: { argb: PALETTE.borderLight } },
  left: { style: "thin", color: { argb: PALETTE.borderLight } },
  bottom: { style: "thin", color: { argb: PALETTE.borderLight } },
  right: { style: "thin", color: { argb: PALETTE.borderLight } },
};

const BORDER_HEADER = {
  top: { style: "medium", color: { argb: PALETTE.navyDark } },
  left: { style: "thin", color: { argb: PALETTE.navyLight } },
  bottom: { style: "medium", color: { argb: PALETTE.navyDark } },
  right: { style: "thin", color: { argb: PALETTE.navyLight } },
};

/**
 * Harmonizer Multi-Agent Classifier:
 * Determines whether an indent item belongs to "Disposables & Packaging" vs "Kitchen Ingredients".
 */
function isDisposableItem(item) {
  const cat = (item.category || "").toLowerCase();
  const name = (item.name || "").toLowerCase();

  if (cat.includes("dispos") || cat.includes("pack") || cat.includes("house keeping")) {
    return true;
  }

  const disposableKeywords = [
    "container", "box", "cup", "cups", "plate", "plates", "foil",
    "cling", "wrap", "cover", "covers", "carry bag", "bag", "bags",
    "butter paper", "napkin", "tissue", "straw", "spoon", "fork",
    "cutlery", "glove", "gloves", "cap", "caps", "comb", "brooms",
    "brush", "leaf", "tray", "dabba", "pouch", "roll", "3cp", "5cp", "8cp"
  ];

  return disposableKeywords.some((kw) => name.includes(kw));
}

/**
 * Generates an ExcelJS workbook for an indent requisition slip
 */
async function generateIndentRequisitionWorkbook(indentInput, options = {}) {
  let indent;
  let items = [];

  if (typeof indentInput === "object" && indentInput !== null) {
    indent = indentInput;
    items = (indentInput.items || []).map((it) => ({
      id: it.id || it.name,
      name: it.name,
      qty: it.qty || it.requestedQty || 0,
      unit: it.unit || "kg",
      item_code: it.item_code || it.sku || "—",
      issued_qty: it.issued_qty || 0,
      notes: it.notes || "",
      category: it.category || (isDisposableItem(it) ? "Disposal" : "General"),
      unit_price: it.price || it.unit_price || it.cost || 0,
    }));
  } else {
    const indentId = indentInput;
    indent = await db("indents").where("id", indentId).first();
    if (!indent) {
      throw new Error(`Indent with ID #${indentId} not found`);
    }

    items = await db("indent_items")
      .leftJoin("stock", function () {
        this.on("indent_items.item_code", "=", "stock.item_code").orOn(
          db.raw("LOWER(indent_items.name) = LOWER(stock.name)")
        );
      })
      .where("indent_items.indent_id", indentId)
      .select(
        "indent_items.id",
        "indent_items.name",
        "indent_items.qty",
        "indent_items.unit",
        "indent_items.item_code",
        "indent_items.issued_qty",
        "indent_items.notes",
        db.raw("COALESCE(stock.category, 'General') as category"),
        db.raw("COALESCE(stock.price, 0) as unit_price")
      )
      .groupBy(
        "indent_items.id",
        "indent_items.name",
        "indent_items.qty",
        "indent_items.unit",
        "indent_items.item_code",
        "indent_items.issued_qty",
        "indent_items.notes",
        "stock.category",
        "stock.price"
      )
      .orderBy("indent_items.id", "asc");
  }

  // Separate into Kitchen Ingredients vs Packaging & Disposables
  const ingredients = [];
  const disposables = [];

  items.forEach((it) => {
    if (isDisposableItem(it)) {
      disposables.push(it);
    } else {
      ingredients.push(it);
    }
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hotel Kapila Multi-Agent Indent Engine";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Requisition #${indent.id}`, {
    views: [{ showGridLines: true }],
  });

  sheet.columns = [
    { key: "colA", width: 6 },  // S.No
    { key: "colB", width: 14 }, // Item Code
    { key: "colC", width: 34 }, // Item Description
    { key: "colD", width: 18 }, // Category
    { key: "colE", width: 14 }, // Req Qty
    { key: "colF", width: 10 }, // Unit
    { key: "colG", width: 15 }, // Unit Rate (₹)
    { key: "colH", width: 16 }, // Est Total (₹)
    { key: "colI", width: 26 }, // Station Remarks / Notes
  ];

  let r = 1;

  // 1. Hotel Brand Title Banner
  safeMergeCells(sheet, `A${r}:I${r}`);
  const titleCell = sheet.getCell(`A${r}`);
  titleCell.value = "HOTEL KAPILA — CENTRAL STORES MATERIAL REQUISITION";
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: PALETTE.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.navyDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(r).height = 30;
  r++;

  // 2. Subtitle / Tracking Banner
  safeMergeCells(sheet, `A${r}:I${r}`);
  const subCell = sheet.getCell(`A${r}`);
  subCell.value = `Tracking Slip: #IND-${String(indent.date || "").replace(/-/g, "").slice(0, 6)}-${String(indent.id).padStart(4, "0")}   |   Status: ${(indent.status || "PENDING").toUpperCase()}   |   Generated: ${new Date().toLocaleString("en-IN")}`;
  subCell.font = { name: "Arial", size: 9, bold: true, color: { argb: PALETTE.white } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.navyHeader } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(r).height = 20;
  r += 2;

  // 3. Metadata Grid
  const metaRows = [
    [
      { label: "Department:", val: indent.dept || "TIFFINS" },
      { label: "Requisition Date:", val: indent.date ? new Date(indent.date).toLocaleDateString("en-IN") : "Today" },
      { label: "Shift:", val: `${indent.shift || "MORNING"} SHIFT` },
    ],
    [
      { label: "Priority:", val: indent.priority || "NORMAL" },
      { label: "Prepared By:", val: options.userName || "Executive Chef" },
      { label: "Central Store Sync:", val: "READY FOR ISSUANCE" },
    ],
  ];

  metaRows.forEach((rowMeta) => {
    sheet.getCell(`A${r}`).value = rowMeta[0].label;
    sheet.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: PALETTE.grayText } };
    sheet.getCell(`B${r}`).value = rowMeta[0].val;
    sheet.getCell(`B${r}`).font = { bold: true, size: 10, color: { argb: PALETTE.navyDark } };

    sheet.getCell(`D${r}`).value = rowMeta[1].label;
    sheet.getCell(`D${r}`).font = { bold: true, size: 9, color: { argb: PALETTE.grayText } };
    sheet.getCell(`E${r}`).value = rowMeta[1].val;
    sheet.getCell(`E${r}`).font = { bold: true, size: 10, color: { argb: PALETTE.navyDark } };

    sheet.getCell(`G${r}`).value = rowMeta[2].label;
    sheet.getCell(`G${r}`).font = { bold: true, size: 9, color: { argb: PALETTE.grayText } };
    sheet.getCell(`H${r}`).value = rowMeta[2].val;
    sheet.getCell(`H${r}`).font = { bold: true, size: 10, color: { argb: PALETTE.navyDark } };

    sheet.getRow(r).height = 20;
    r++;
  });

  r++;

  // 4. Station Prep Notes Callout (if present)
  if (indent.remarks && indent.remarks.trim().length > 0) {
    safeMergeCells(sheet, `A${r}:I${r}`);
    const noteHeader = sheet.getCell(`A${r}`);
    noteHeader.value = `💬 CHEF STATION PREP NOTES FOR CENTRAL STORES: "${indent.remarks.trim()}"`;
    noteHeader.font = { bold: true, size: 10, color: { argb: "92400E" } };
    noteHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.goldLight } };
    noteHeader.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    noteHeader.border = {
      top: { style: "medium", color: { argb: PALETTE.goldBorder } },
      bottom: { style: "medium", color: { argb: PALETTE.goldBorder } },
      left: { style: "medium", color: { argb: PALETTE.goldBorder } },
      right: { style: "medium", color: { argb: PALETTE.goldBorder } },
    };
    sheet.getRow(r).height = 26;
    r += 2;
  }

  // Helper to render section table
  const renderSection = (sectionTitle, sectionItems, badgeColor) => {
    safeMergeCells(sheet, `A${r}:I${r}`);
    const secCell = sheet.getCell(`A${r}`);
    secCell.value = `${sectionTitle} (${sectionItems.length} Lines)`;
    secCell.font = { bold: true, size: 11, color: { argb: PALETTE.white } };
    secCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: badgeColor } };
    secCell.alignment = { vertical: "middle", indent: 1 };
    sheet.getRow(r).height = 24;
    r++;

    const headers = ["S.No", "Item Code", "Item Description", "Category", "Req Qty", "Unit", "Est Rate (₹)", "Est Total (₹)", "Notes / Remarks"];
    headers.forEach((h, idx) => {
      const colLetter = String.fromCharCode(65 + idx);
      const cell = sheet.getCell(`${colLetter}${r}`);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: PALETTE.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.navyHeader } };
      cell.alignment = {
        horizontal: ["Req Qty", "Est Rate (₹)", "Est Total (₹)"].includes(h) ? "right" : (h === "S.No" || h === "Unit" ? "center" : "left"),
        vertical: "middle",
      };
      cell.border = BORDER_HEADER;
    });
    sheet.getRow(r).height = 22;
    r++;

    if (sectionItems.length === 0) {
      safeMergeCells(sheet, `A${r}:I${r}`);
      const emptyCell = sheet.getCell(`A${r}`);
      emptyCell.value = "No items specified in this section for this shift.";
      emptyCell.font = { italic: true, size: 9, color: { argb: PALETTE.grayText } };
      emptyCell.alignment = { horizontal: "center", vertical: "middle" };
      emptyCell.border = BORDER_THIN;
      sheet.getRow(r).height = 20;
      r++;
      return 0;
    }

    let sectionTotal = 0;

    sectionItems.forEach((it, sIdx) => {
      const qty = parseFloat(it.qty) || 0;
      const rate = parseFloat(it.unit_price) || 0;
      const total = qty * rate;
      sectionTotal += total;

      const isZebra = sIdx % 2 === 1;

      const rowValues = [
        sIdx + 1,
        it.item_code || "KPL-ITM",
        it.name,
        it.category || "General",
        qty,
        it.unit || "kg",
        rate > 0 ? rate : "-",
        total > 0 ? total : "-",
        it.notes || "",
      ];

      rowValues.forEach((val, idx) => {
        const colLetter = String.fromCharCode(65 + idx);
        const cell = sheet.getCell(`${colLetter}${r}`);
        cell.value = val;
        cell.border = BORDER_THIN;
        if (isZebra) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.zebraBg } };
        }

        if (idx === 0 || idx === 5) {
          cell.alignment = { horizontal: "center" };
        } else if (idx === 4 || idx === 6 || idx === 7) {
          cell.alignment = { horizontal: "right" };
          if ((idx === 6 || idx === 7) && typeof val === "number") {
            cell.numFmt = "₹#,##0.00";
          }
        }
      });

      sheet.getRow(r).height = 20;
      r++;
    });

    safeMergeCells(sheet, `A${r}:G${r}`);
    const subLabel = sheet.getCell(`A${r}`);
    subLabel.value = `Subtotal ${sectionTitle}:`;
    subLabel.font = { bold: true, size: 9 };
    subLabel.alignment = { horizontal: "right" };
    subLabel.border = BORDER_THIN;

    const subTotalCell = sheet.getCell(`H${r}`);
    subTotalCell.value = sectionTotal;
    subTotalCell.font = { bold: true, size: 10, color: { argb: PALETTE.navyDark } };
    subTotalCell.alignment = { horizontal: "right" };
    subTotalCell.numFmt = "₹#,##0.00";
    subTotalCell.border = BORDER_THIN;

    sheet.getCell(`I${r}`).border = BORDER_THIN;
    sheet.getRow(r).height = 22;
    r += 2;

    return sectionTotal;
  };

  const ingredientsTotal = renderSection("SECTION A: KITCHEN INGREDIENTS & RAW MATERIALS", ingredients, PALETTE.navyLight);
  const disposablesTotal = renderSection("SECTION B: PACKAGING, DISPOSABLES & SERVICE MATERIAL", disposables, "B45309");

  const grandTotal = ingredientsTotal + disposablesTotal;

  safeMergeCells(sheet, `A${r}:G${r}`);
  const grandLabel = sheet.getCell(`A${r}`);
  grandLabel.value = `GRAND TOTAL ESTIMATED VALUATION (${items.length} TOTAL ITEMS):`;
  grandLabel.font = { bold: true, size: 11, color: { argb: PALETTE.white } };
  grandLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.navyDark } };
  grandLabel.alignment = { horizontal: "right", vertical: "middle" };

  const grandCell = sheet.getCell(`H${r}`);
  grandCell.value = grandTotal;
  grandCell.font = { bold: true, size: 12, color: { argb: "047857" } };
  grandCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.greenLight } };
  grandCell.alignment = { horizontal: "right", vertical: "middle" };
  grandCell.numFmt = "₹#,##0.00";
  grandCell.border = BORDER_HEADER;

  sheet.getCell(`I${r}`).border = BORDER_HEADER;
  sheet.getRow(r).height = 26;
  r += 3;

  const sigHeaders = [
    { start: "A", end: "C", title: "1. REQUISITIONED BY (CHEF)", sub: "Signature & Timestamp" },
    { start: "D", end: "F", title: "2. VERIFIED & ISSUED BY (STORES)", sub: "Central Storekeeper Signature" },
    { start: "G", end: "I", title: "3. AUTHORIZED BY (MANAGER)", sub: "Store Manager Approval" },
  ];

  sigHeaders.forEach((sig) => {
    safeMergeCells(sheet, `${sig.start}${r}:${sig.end}${r}`);
    const hCell = sheet.getCell(`${sig.start}${r}`);
    hCell.value = sig.title;
    hCell.font = { bold: true, size: 9, color: { argb: PALETTE.white } };
    hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.navyLight } };
    hCell.alignment = { horizontal: "center", vertical: "middle" };
    hCell.border = BORDER_THIN;
  });
  sheet.getRow(r).height = 20;
  r++;

  sigHeaders.forEach((sig) => {
    safeMergeCells(sheet, `${sig.start}${r}:${sig.end}${r + 2}`);
    const sCell = sheet.getCell(`${sig.start}${r}`);
    sCell.value = `\n\n\n_______________________\n${sig.sub}`;
    sCell.font = { size: 8, color: { argb: PALETTE.grayText } };
    sCell.alignment = { horizontal: "center", vertical: "bottom" };
    sCell.border = BORDER_THIN;
  });
  sheet.getRow(r).height = 20;
  sheet.getRow(r + 1).height = 20;
  sheet.getRow(r + 2).height = 24;

  return workbook;
}

module.exports = {
  generateIndentRequisitionWorkbook,
  isDisposableItem,
};
