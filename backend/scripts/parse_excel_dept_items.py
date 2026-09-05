import pandas as pd
import json
import os

excel_path = r"C:\Users\Dell\Downloads\INDENT SHEET - NOV 25 (1).xlsx"
output_path = r"C:\Project\Kapila_Project-main\Kapila_Project-main\backend\db\department_items.json"

sheet_to_dept = {
    "TIFFINS ": "TIFFINS",
    "STAFF ": "STAFF",
    "SI- MEALS ": "SI-MEALS",
    "NORTH INDIAN": "NORTH INDIAN",
    "CHAT, JP Disposal, Softy.": "CHAT & SOFTY",
    "CHINESE & DOSA": "CHINESE & DOSA",
    "MOCKTAILS & Continental": "MOCKTAILS & CONTINENTAL",
    " Restaurant": "RESTAURANT",
    "Room service": "ROOM SERVICE"
}

try:
    xl = pd.ExcelFile(excel_path)
    result = {}
    
    for sheet in xl.sheet_names:
        dept_name = sheet_to_dept.get(sheet)
        if not dept_name:
            continue
            
        df = xl.parse(sheet)
        items = []
        
        # Check if sheet has a header row with "ITEM NAME"
        headers_row_idx = None
        for i, row in df.iterrows():
            row_vals = [str(x).strip().upper() for x in row.values]
            if "ITEM NAME" in row_vals or "ITEMNAME" in row_vals:
                headers_row_idx = i
                break
                
        if headers_row_idx is not None:
            cols = df.iloc[headers_row_idx].values
            data_rows = df.iloc[headers_row_idx + 1:]
            
            # Find item name columns (some sheets have side-by-side columns)
            item_cols_indices = [idx for idx, val in enumerate(cols) if str(val).strip().upper() in ["ITEM NAME", "ITEMNAME"]]
            
            for item_col_idx in item_cols_indices:
                for val in data_rows.iloc[:, item_col_idx].values:
                    item_name = str(val).strip()
                    if item_name and item_name not in ["nan", "", "ITEM NAME", "DISPOSABLES", "S.No", "S.NO"]:
                        if not item_name.startswith("Unnamed:") and not item_name.replace(".","").isdigit():
                            items.append(item_name)
        else:
            # Fallback
            for col in df.columns:
                for val in df[col].values:
                    item_name = str(val).strip()
                    if item_name and item_name not in ["nan", "", "ITEM NAME", "S.No", "S.NO"] and len(item_name) > 2:
                        if not item_name.startswith("Unnamed:") and not item_name.replace(".","").isdigit():
                            items.append(item_name)
                            
        # De-duplicate while preserving order
        unique_items = list(dict.fromkeys(items))
        # Remove any entries that are just headers or metadata
        cleaned_items = []
        for it in unique_items:
            # Skip noise
            if it.upper() in ["VEGETABLES", "GROCERY", "DAIRY", "REMARKS", "QTY", "RATE", "UNIT", "TOTAL", "S.NO", "ITEM NAME"]:
                continue
            cleaned_items.append(it)
            
        result[dept_name] = cleaned_items
        print(f"Processed sheet '{sheet}' -> Department '{dept_name}' ({len(cleaned_items)} items)")
        
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully wrote department items to {output_path}")
except Exception as e:
    print(f"Error parsing excel: {e}")
