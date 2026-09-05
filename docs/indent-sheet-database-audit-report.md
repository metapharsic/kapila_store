# Indent Sheet vs Database Audit Report

**Audit date:** 2026-08-01  
**Revision:** v2 ? corrected after direct worksheet-cell verification  
**Source workbook:** `documentation/INDENT SHEET - 2026 final.xlsx`  
**Scope:** Read-only comparison. No database or workbook data was changed.

## Correction to the Previous Report

The previous report incorrectly listed blank units. Its parser recognised only headers named `UNITS` or `EVENING`; some correct unit columns are labelled `REM` or `REMARKS` in the workbook. It also scanned beyond the end of individual tables.

**Corrected result:** all **705 operational item occurrences** have a populated unit cell. There are **0 missing-unit occurrences**. The earlier ?Units Missing from the Workbook? table is withdrawn and must not be used for data changes.

## Executive Result

**The live inventory master is not populated.** The `stock` table has **0 rows**, so all **307 distinct operational indent items** are absent from live stock. Supplier quotes, stock aliases, purchase-order item history, indent history, and issuance history are also empty.

`indent_templates` has 47 name-only rows and exactly matches 35 of the 307 indent items. `recipe_items` has 1,768 recipe-ingredient rows and exactly matches 81 indent items. Recipe units are consumption units, not authoritative purchase/stock units.

**Do not create zero-quantity stock rows merely to resolve this audit.** Stock is a physical-batch ledger. Approve a catalogue first, then load real stock through PO ? GRN.

## Scope and Database Evidence

| Area | Rows / items | Audit use |
| --- | --- | --- |
| Operational indent sheets | 9 | Item and unit cells extracted |
| Recipe reference sheets | 1 | Reviewed separately; excluded from operational indent count |
| Operational item occurrences | 705 | All department rows after table-boundary validation |
| Distinct indent items | 307 | Names normalized for case/punctuation comparison |
| stock | 0 | Live inventory batches; empty |
| stock_aliases | 0 | Approved aliases; empty |
| indent_templates | 47 | Name-only template list |
| recipe_items | 1768 | Recipe ingredient references |
| supplier_rate_quotes | 0 | Supplier item/unit/rate evidence; empty |
| indent_items / issuance_items / purchase_order_items | 0 / 0 / 0 | Historical comparison sources; all empty |

## Results Summary

| Finding | Corrected count | Meaning |
| --- | --- | --- |
| Items missing from live stock | 307 | Every distinct indent item lacks a stock batch/master record |
| Items absent from indent templates | 272 | Not present in the current name-only template list |
| Items absent from recipe ingredients | 226 | No exact recipe reference; expected for many packaging, cleaning, and service supplies |
| Missing workbook units | 0 | None ? previous count was a parser error |
| Workbook internal unit conflicts | 1 | Same indent item uses incompatible units |
| Recipe-reference unit conflicts | 19 | Manual review; recipe unit may not equal purchase unit |
| Possible spelling/name candidates | 19 | Manual review suggestions only |

## Workbook Coverage by Sheet

| Sheet | Item occurrences | Distinct items |
| --- | --- | --- |
| TIFFINS | 76 | 72 |
| STAFF | 58 | 57 |
| SI- MEALS | 148 | 144 |
| NORTH INDIAN | 78 | 78 |
| CHAT, JP Disposal, Softy. | 113 | 110 |
| CHINESE & DOSA | 63 | 51 |
| MOCKTAILS & Continental | 53 | 52 |
| Restaurant | 56 | 51 |
| Room service | 60 | 30 |

`NI MASALA` is a recipe/portion reference sheet (for example, teaspoon and gram usage). It is not counted as an operational indent sheet because it does not follow the standard indent item/quantity/unit request layout.

## Verified Unit Findings

All 705 extracted operational item rows have a unit. The workbook uses `UNITS`, `REM`, `REMARKS`, and `EVENING` as headings for fields that contain the unit value. Those headings are inconsistent, but their cells are populated.

Only one internal unit conflict remains:

| Item | Workbook units | Locations | Required decision |
| --- | --- | --- | --- |
| Parcel Covers 4*6 | kg, pkt | CHAT, JP Disposal, Softy. F47 (H47)<br>CHINESE & DOSA F24 (H24)<br>CHINESE & DOSA F39 (H39) | Choose one canonical purchase/issue unit. Add a conversion only if both units are valid for the same SKU. |

## Recipe Unit Conflicts ? Manual Review Required

Recipe units are only reference evidence. A packaging unit in an indent can legitimately differ from a recipe consumption unit, so none of these must be changed automatically. Confirm whether the names refer to the same physical SKU.

| Item | Indent unit(s) | Recipe unit(s) | Action |
| --- | --- | --- | --- |
| Baby Corn | tin | kg | Confirm same SKU or create separate catalogue items. |
| Bread | pkt | pcs | Confirm same SKU or create separate catalogue items. |
| Cheese Slice | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Coconut | pcs | kg | Confirm same SKU or create separate catalogue items. |
| Cream | pcs | kg | Confirm same SKU or create separate catalogue items. |
| Delight Ice Cream | bulk | kg | Confirm same SKU or create separate catalogue items. |
| Garam Masala | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Ghee | kg | l | Confirm same SKU or create separate catalogue items. |
| Mozzarella Cheese | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Mushroom | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Mustard Oil | bottle | l | Confirm same SKU or create separate catalogue items. |
| Noodles | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Papad | pkt | pcs | Confirm same SKU or create separate catalogue items. |
| Pasta | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Pizza Sauce | pkt | kg | Confirm same SKU or create separate catalogue items. |
| Soya Sauce | bottle | kg | Confirm same SKU or create separate catalogue items. |
| Tomato Sauce | bottle | kg | Confirm same SKU or create separate catalogue items. |
| Veg Momos | pkt | pcs | Confirm same SKU or create separate catalogue items. |
| Water Melon Syrup | bottle | l | Confirm same SKU or create separate catalogue items. |

## Potential Name / Spelling Matches ? Do Not Auto-Merge

These are text-similarity suggestions from current database names. They are not evidence of identity; pack size, brand, and unit must be checked physically.

| Workbook item | Possible database name | Similarity | Action |
| --- | --- | --- | --- |
| Box Container 250ml | Box Container 1000 Ml | 0.857 | Confirm manually; create alias only after confirmation. |
| Box Container 400ml | Box Container 1000 Ml | 0.914 | Confirm manually; create alias only after confirmation. |
| Box Container 500 Ml | Box Container 1000 Ml | 0.914 | Confirm manually; create alias only after confirmation. |
| Butter 500 Gm | Butter (500g) | 0.952 | Confirm manually; create alias only after confirmation. |
| Ice Cream Cone | Ice Cream | 0.8 | Confirm manually; create alias only after confirmation. |
| Kabuli Channa | KABULI CHANA | 0.957 | Confirm manually; create alias only after confirmation. |
| Kaju 2 Pieces | KAJU 2 PCS | 0.842 | Confirm manually; create alias only after confirmation. |
| Kashmiri Mirchi Powder | KASHMIRI CHILLI POWDER | 0.85 | Confirm manually; create alias only after confirmation. |
| Lemon Salt | LEMONS | 0.8 | Confirm manually; create alias only after confirmation. |
| Mayonnaise | VEG MAYONNAISE | 0.87 | Confirm manually; create alias only after confirmation. |
| Mineral water 1l | MINERAL WATER | 0.923 | Confirm manually; create alias only after confirmation. |
| Mineral water 500ml | MINERAL WATER | 0.828 | Confirm manually; create alias only after confirmation. |
| Pineapple | PINEAPPLE SYRUP | 0.783 | Confirm manually; create alias only after confirmation. |
| Red Chilly | RED CHILLI | 0.889 | Confirm manually; create alias only after confirmation. |
| Sajeera | JEERA | 0.833 | Confirm manually; create alias only after confirmation. |
| Sweet Corn Pkt | SWEET CORN PACKET | 0.889 | Confirm manually; create alias only after confirmation. |
| Tea Powder | TEA PDR | 0.8 | Confirm manually; create alias only after confirmation. |
| Upma Ravva | UPMA RAVA | 0.941 | Confirm manually; create alias only after confirmation. |
| Watermelon | WATER MELON SYRUP | 0.8 | Confirm manually; create alias only after confirmation. |

## Complete Item-by-Item Master Coverage

Every operational indent item is listed below. `Stock = No` for every row because the live `stock` table is empty. Template and recipe matches are secondary references, not proof of a finished inventory master.

| Indent item | Occurrences | Indent unit(s) | Sheets | Stock | Template | Recipe | Recipe unit(s) | Unit status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3cp | 1 | pcs | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Amchoor Powder | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Amchur Raw | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Anar | 1 | kg | CHAT, JP Disposal, Softy. | No | No | Yes | kg | match |
| Apples | 1 | kg | Restaurant | No | No | No | ? | not_comparable |
| ARATIKAYA | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Aromatic Powder | 2 | kg | NORTH INDIAN, STAFF | No | Yes | No | ? | not_comparable |
| Atta | 6 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | Yes | Yes | kg | match |
| Atukulu | 4 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF, TIFFINS | No | Yes | No | ? | not_comparable |
| Baby Corn | 2 | tin | MOCKTAILS & Continental, NORTH INDIAN | No | Yes | Yes | kg | conflict |
| Badam | 2 | kg | CHAT, JP Disposal, Softy., MOCKTAILS & Continental | No | Yes | Yes | kg | match |
| Baking Powder | 3 | pcs | CHAT, JP Disposal, Softy., SI- MEALS, TIFFINS | No | Yes | No | ? | not_comparable |
| BANANA LEAF | 1 | pcs | SI- MEALS | No | No | No | ? | not_comparable |
| BEANS | 4 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Bedsheet | 2 | pcs | Room service | No | Yes | No | ? | not_comparable |
| BEERAKAYA | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| BEETROOT | 2 | kg | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| BENDI | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Bharath Gas | 4 | pcs | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | Yes | No | ? | not_comparable |
| Biryani Leaf | 4 | kg | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | Yes | No | ? | not_comparable |
| Biryani Rice | 3 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, STAFF | No | Yes | Yes | kg | match |
| Bis Coffe Biscuits | 2 | pkt | MOCKTAILS & Continental, Restaurant | No | Yes | No | ? | not_comparable |
| Bis Coffe Paste | 2 | bottle | MOCKTAILS & Continental, Restaurant | No | Yes | No | ? | not_comparable |
| Black Olives | 1 | bottle | MOCKTAILS & Continental | No | Yes | No | ? | not_comparable |
| Black Pepper | 4 | kg | CHAT, JP Disposal, Softy., MOCKTAILS & Continental, STAFF | No | Yes | No | ? | not_comparable |
| Black Salt | 1 | kg | CHAT, JP Disposal, Softy. | No | Yes | No | ? | not_comparable |
| Blue Lagoon | 2 | bottle | MOCKTAILS & Continental, Restaurant | No | Yes | No | ? | not_comparable |
| Bobberlu | 1 | kg | SI- MEALS | No | Yes | No | ? | not_comparable |
| Boost | 2 | pkt | Restaurant, TIFFINS | No | Yes | No | ? | not_comparable |
| Box Container 250ml | 1 | pcs | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Box Container 400ml | 1 | pcs | CHINESE & DOSA | No | No | No | ? | not_comparable |
| Box Container 500 Ml | 1 | pcs | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Bread | 2 | pkt | SI- MEALS, STAFF | No | No | Yes | pcs | conflict |
| Bread Crumbs | 1 | pkt | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| BRINJAL | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Broken Rice | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Brown Onion | 2 | kg | NORTH INDIAN, STAFF | No | No | No | ? | not_comparable |
| Brownie | 1 | kg | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| BUDAMDOSAKAYA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Burger Bun | 1 | pcs | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Butter 500 Gm | 6 | pcs | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Butter Covers | 1 | pkt | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Butter Scotch Ice Cream | 1 | bulk | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| CABBAGE | 3 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Caps | 1 | pkt | SI- MEALS | No | No | No | ? | not_comparable |
| CAPSICUM | 2 | kg | CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Caramil Syrup | 1 | bottle | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| CARROT | 4 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| CAULIFLOWER | 4 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Channa Atta | 4 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Channa Dal | 4 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Chat Masala | 3 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS | No | No | Yes | kg | match |
| Cheese 500g | 2 | bulk | CHAT, JP Disposal, Softy., CHINESE & DOSA | No | No | No | ? | not_comparable |
| Cheese Slice | 1 | pkt | MOCKTAILS & Continental | No | No | Yes | kg | conflict |
| Cherries | 2 | kg | CHAT, JP Disposal, Softy., Restaurant | No | No | No | ? | not_comparable |
| Chicken Big | 1 | kg | NORTH INDIAN | No | No | Yes | kg | match |
| Chicken Small | 1 | kg | NORTH INDIAN | No | Yes | No | ? | not_comparable |
| Chicken Staff | 1 | kg | STAFF | No | Yes | No | ? | not_comparable |
| CHIKKUDIKAYA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Chilly Flakes Kg | 1 | kg | MOCKTAILS & Continental | No | Yes | No | ? | not_comparable |
| Chilly Powder | 5 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | Yes | No | ? | not_comparable |
| Chinese Container 500ml | 1 | pcs | CHINESE & DOSA | No | Yes | No | ? | not_comparable |
| Chinese Container 750ml | 1 | pcs | CHINESE & DOSA | No | Yes | No | ? | not_comparable |
| Chocolate Ice Cream | 1 | bulk | MOCKTAILS & Continental | No | Yes | No | ? | not_comparable |
| Chocolate Sauce | 3 | bottle | CHAT, JP Disposal, Softy., MOCKTAILS & Continental, Restaurant | No | Yes | No | ? | not_comparable |
| Chole Masala | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| CHUKKAKURA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Cleaning Brush | 1 | pcs | SI- MEALS | No | No | No | ? | not_comparable |
| Cleaning Coth | 1 | pcs | Restaurant | No | No | No | ? | not_comparable |
| Coal | 1 | kg | NORTH INDIAN | No | No | No | ? | not_comparable |
| Coconut | 4 | pcs | CHINESE & DOSA, SI- MEALS, TIFFINS | No | No | Yes | kg | conflict |
| Coconut Brooms | 1 | pcs | SI- MEALS | No | No | No | ? | not_comparable |
| Coconut Powder | 3 | kg | NORTH INDIAN, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Coffee Nescafe | 1 | pkt | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Coffee Powder | 5 | kg | Restaurant, SI- MEALS, TIFFINS | No | No | Yes | kg | match |
| compostable 11*14 | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| compostable13*16 | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Corn Flakes | 2 | kg | Room service | No | No | No | ? | not_comparable |
| Corn Flour | 4 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, TIFFINS | No | No | Yes | kg | match |
| Cream | 3 | pcs | CHAT, JP Disposal, Softy., MOCKTAILS & Continental, NORTH INDIAN | No | No | Yes | kg | conflict |
| Cucumber / à¤–à¥€à¤°à¤¾ | 1 | kg | CHAT, JP Disposal, Softy. | No | No | Yes | kg | match |
| Curd | 8 | kg | NORTH INDIAN, Restaurant, Room service, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Curd Cups | 1 | pcs | SI- MEALS | No | No | No | ? | not_comparable |
| Custic Soda | 2 | kg | CHINESE & DOSA, SI- MEALS | No | No | No | ? | not_comparable |
| Custod Powder | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Dalchina | 5 | kg | CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Dalda | 4 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Delight Ice Cream | 1 | bulk | MOCKTAILS & Continental | No | No | Yes | kg | conflict |
| Dental Kit | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Dhaniya | 5 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Dhaniya Powder | 5 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| DILPASAND | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| DONDAKAYA | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Dosa Broom | 2 | pcs | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Dosa Flour | 3 | kg | SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Dosa Rice | 1 | kg | SI- MEALS | No | Yes | No | ? | not_comparable |
| Dry Coconut | 4 | kg | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | Yes | No | ? | not_comparable |
| Dry Yeast | 1 | pkt | MOCKTAILS & Continental | No | Yes | No | ? | not_comparable |
| Dust Bin Covers | 2 | pkt | Room service | No | Yes | No | ? | not_comparable |
| Eggs | 2 | pcs | NORTH INDIAN, STAFF | No | Yes | Yes | pcs | match |
| Elaichi | 6 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | Yes | No | ? | not_comparable |
| Fish | 1 | kg | NORTH INDIAN | No | Yes | Yes | kg | match |
| Floor Cleaner | 3 | l | Restaurant, Room service | No | Yes | No | ? | not_comparable |
| French Fries | 1 | pkt | MOCKTAILS & Continental | No | Yes | No | ? | not_comparable |
| Frozen Green Peas | 1 | kg | NORTH INDIAN | No | No | Yes | kg | match |
| Garam Masala | 1 | pkt | CHAT, JP Disposal, Softy. | No | No | Yes | kg | conflict |
| Garbage Bags | 2 | kg | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Garlic | 7 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Garlic Bread | 1 | pcs | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Ghee | 5 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, SI- MEALS, TIFFINS | No | No | Yes | l | conflict |
| Ginger | 6 | kg | CHAT, JP Disposal, Softy., MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, TIFFINS | No | No | Yes | kg | match |
| Ginger Syrup | 2 | bottle | MOCKTAILS & Continental, Restaurant | No | No | No | ? | not_comparable |
| Gold Milk | 2 | l | MOCKTAILS & Continental, TIFFINS | No | No | No | ? | not_comparable |
| GONGURA | 1 |…419 tokens truncated… Ravva | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Jaggery | 2 | kg | SI- MEALS, TIFFINS | No | No | Yes | kg | match |
| Jajikaya | 1 | kg | NORTH INDIAN | No | No | No | ? | not_comparable |
| Jal Jeera | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Jalpeno | 2 | jar | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Japathri | 1 | kg | NORTH INDIAN | No | No | No | ? | not_comparable |
| Jeera | 6 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Jeera Masala Syrup | 1 | bottle | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Jeera Powder | 5 | kg | MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Kabuli Channa | 4 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| KADDU | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Kaju 2 Pieces | 5 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS | No | No | No | ? | not_comparable |
| Kaju Nuka | 4 | kg | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| KAKARKAYA | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Kala Khatta Syrup | 2 | bottle | MOCKTAILS & Continental, Restaurant | No | No | No | ? | not_comparable |
| KANDAGADDA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| KARIVEPAKU | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Kashmiri Mirchi Powder | 5 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Kasturi Methi | 4 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Kewara Water | 1 | bottle | NORTH INDIAN | No | No | No | ? | not_comparable |
| Khas Khas | 4 | kg | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| KHEERA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Kismis | 2 | kg | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Kissan Jam | 2 | kg | Room service | No | No | No | ? | not_comparable |
| Kit Kat | 2 | pkt | MOCKTAILS & Continental, Restaurant | No | No | No | ? | not_comparable |
| Kitchen King Masala | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| KOTHMIR | 2 | kg | CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Kova | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Kurbani | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Lamsa | 2 | pcs | Restaurant, TIFFINS | No | No | No | ? | not_comparable |
| Lavang | 7 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Lemon /à¤¨à¥€à¤¬à¤‚ à¥‚ | 4 | kg | CHAT, JP Disposal, Softy., MOCKTAILS & Continental, Room service | No | No | Yes | kg | match |
| Lemon Salt | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| LEMONS | 3 | kg | Restaurant, SI- MEALS | No | No | Yes | kg | match |
| Local Channa | 2 | kg | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Maida | 7 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Makka Chudwa | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| MAMDIKAYA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Mango Crush | 1 | bottle | SI- MEALS | No | No | No | ? | not_comparable |
| Mango Pickle | 2 | kg | CHAT, JP Disposal, Softy., SI- MEALS | No | No | Yes | kg | match |
| Masoor Dal | 3 | kg | NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Mayonnaise | 3 | pkt | CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN | No | No | No | ? | not_comparable |
| Meal Maker | 2 | kg | SI- MEALS, STAFF | No | No | Yes | kg | match |
| Mentulu | 3 | kg | SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| METHI | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Milk | 8 | l | CHAT, JP Disposal, Softy., MOCKTAILS & Continental, Restaurant, SI- MEALS, STAFF, TIFFINS | No | No | Yes | l | match |
| Milk Maid | 2 | tin | NORTH INDIAN, SI- MEALS | No | No | No | ? | not_comparable |
| Mineral water 1l | 3 | box | Restaurant, Room service | No | No | No | ? | not_comparable |
| Mineral water 500ml | 3 | box | CHAT, JP Disposal, Softy., Room service | No | No | No | ? | not_comparable |
| Mint / à¤ªà¥à¤¦à¥€à¤¨à¤¾ | 1 | kg | CHAT, JP Disposal, Softy. | No | No | Yes | kg | match |
| Mirchi / à¤¹à¤°à¤¾ à¤¿à¤®à¤šô€…Ž | 3 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA | No | No | No | ? | not_comparable |
| Moong Dal | 4 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Mops | 4 | pcs | Restaurant, Room service, SI- MEALS | No | No | No | ? | not_comparable |
| Mosambi | 1 | kg | Restaurant | No | No | No | ? | not_comparable |
| Mote | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Mozzarella Cheese | 1 | pkt | MOCKTAILS & Continental | No | No | Yes | kg | conflict |
| Mtr Sambar Powder | 2 | pkt | SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| MUNAKKAYA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Murmura | 2 | kg | CHAT, JP Disposal, Softy., STAFF | No | No | No | ? | not_comparable |
| Mushroom | 1 | pkt | NORTH INDIAN | No | No | Yes | kg | conflict |
| Muskmelon | 3 | kg | Restaurant, Room service | No | No | No | ? | not_comparable |
| Mustard Oil | 2 | bottle | CHAT, JP Disposal, Softy., NORTH INDIAN | No | No | Yes | l | conflict |
| Mutton | 1 | kg | NORTH INDIAN | No | No | Yes | kg | match |
| Mutton Keema | 1 | kg | NORTH INDIAN | No | No | No | ? | not_comparable |
| Napkins | 4 | pkt | CHAT, JP Disposal, Softy., Restaurant, Room service | No | No | No | ? | not_comparable |
| Noodles | 1 | pkt | NORTH INDIAN | No | No | Yes | kg | conflict |
| Nutella Chocolate | 1 | jar | CHINESE & DOSA | No | No | No | ? | not_comparable |
| Odonil | 1 | pkt | Restaurant | No | No | No | ? | not_comparable |
| Onion | 9 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, Restaurant, Room service, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Orange | 1 | kg | Restaurant | No | No | No | ? | not_comparable |
| Oregano 500gm | 1 | kg | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Oreo Biscuits | 1 | pkt | Restaurant | No | No | No | ? | not_comparable |
| Original Mint Mojitho | 2 | bottle | MOCKTAILS & Continental, Restaurant | No | No | No | ? | not_comparable |
| PALAK | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Pally Chutney | 5 | kg | CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Palm Oil | 4 | l | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Paneer | 7 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Papad | 1 | pkt | SI- MEALS | No | No | Yes | pcs | conflict |
| Paper | 3 | kg | NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Paper Rolls | 2 | pcs | CHAT, JP Disposal, Softy., Restaurant | No | No | No | ? | not_comparable |
| Parcel Covers 4*6 | 3 | kg, pkt | CHAT, JP Disposal, Softy., CHINESE & DOSA | No | No | No | ? | not_comparable |
| Parcel Covers 6*9 | 1 | pkt | CHINESE & DOSA | No | No | No | ? | not_comparable |
| Pasta | 1 | pkt | MOCKTAILS & Continental | No | No | Yes | kg | conflict |
| Pather Pool | 3 | kg | SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Pav | 1 | pkt | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Pavbaji Masala | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Peri Peri | 1 | kg | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Pesarlu | 2 | kg | SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Pillow Covers | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Pineapple | 4 | pcs | Restaurant, Room service, STAFF | No | No | No | ? | not_comparable |
| Pitambaram | 1 | pkt | SI- MEALS | No | No | No | ? | not_comparable |
| Pizza Sauce | 1 | pkt | MOCKTAILS & Continental | No | No | Yes | kg | conflict |
| POKAALU | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Potato | 6 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| POTLAKAYA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Prawns | 1 | kg | NORTH INDIAN | No | No | Yes | kg | match |
| PUDINA | 4 | kg | CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Puff Roti | 1 | pcs | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Putani | 3 | kg | CHINESE & DOSA, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| RADDISH | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| Ragi Flour | 2 | kg | SI- MEALS, TIFFINS | No | No | Yes | kg | match |
| Rai | 2 | kg | SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Rajma | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Ramjadu | 3 | pcs | Restaurant, Room service | No | No | No | ? | not_comparable |
| Rectrangle Box 500ml | 3 | pcs | CHAT, JP Disposal, Softy., CHINESE & DOSA | No | No | No | ? | not_comparable |
| Red Chilly | 4 | kg | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Red Chilly Sauce | 1 | bottle | NORTH INDIAN | No | No | No | ? | not_comparable |
| Room Freshner | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Rose Syrup | 1 | bottle | Restaurant | No | No | No | ? | not_comparable |
| Rose Water | 1 | bottle | NORTH INDIAN | No | No | No | ? | not_comparable |
| Round Pally | 4 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Sabjee Binge | 1 | kg | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Sabudana | 3 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF | No | No | Yes | kg | match |
| Sajeera | 4 | kg | CHINESE & DOSA, NORTH INDIAN, SI- MEALS, STAFF | No | No | No | ? | not_comparable |
| Salt Big | 4 | pkt | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Sandwich Bread | 1 | pkt | MOCKTAILS & Continental | No | No | No | ? | not_comparable |
| Scrubber Ordinary | 2 | pcs | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Scrubber Plastic | 2 | pcs | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Scrubber Steel | 2 | pcs | CHAT, JP Disposal, Softy., SI- MEALS | No | No | No | ? | not_comparable |
| Semiya | 2 | pkt | SI- MEALS, STAFF | No | No | No | ? | not_comparable |
| Shampoo | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Shampoo Gel | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Shimla Mirch / à¤¿à¤¶à¤®à¤²à¤¾ à¤¿à¤®à¤šô€…Š | 2 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA | No | No | No | ? | not_comparable |
| Shower Gel | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| SHYAMAGADDA | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Silver Container Big | 1 | pcs | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Silver Pouch 6*8 | 2 | pkt | CHAT, JP Disposal, Softy., CHINESE & DOSA | No | No | No | ? | not_comparable |
| Small Onion | 3 | pkt | SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Soap Oil | 6 | l | CHAT, JP Disposal, Softy., Restaurant, Room service, SI- MEALS | No | No | No | ? | not_comparable |
| Soaps | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Soda 750 Ml | 2 | bottle | CHAT, JP Disposal, Softy., Restaurant | No | No | No | ? | not_comparable |
| Softy Chocolate Milk | 1 | l | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Softy Vanilla Milk | 1 | l | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Somp | 5 | kg | CHAT, JP Disposal, Softy., Restaurant, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Somp White | 1 | kg | Restaurant | No | No | No | ? | not_comparable |
| Soya Sauce | 1 | bottle | NORTH INDIAN | No | No | Yes | kg | conflict |
| Sponge | 3 | pcs | Restaurant, Room service | No | No | No | ? | not_comparable |
| SPRING ONION | 1 | kg | SI- MEALS | No | No | Yes | kg | match |
| Spring Rolls | 1 | pkt | CHINESE & DOSA | No | No | No | ? | not_comparable |
| SPRITE 250ml | 1 | bottle | Restaurant | No | No | No | ? | not_comparable |
| Sprite 750 Ml | 1 | bottle | Restaurant | No | No | No | ? | not_comparable |
| Star Pool | 1 | kg | NORTH INDIAN | No | No | No | ? | not_comparable |
| Sugar | 9 | kg | CHAT, JP Disposal, Softy., Restaurant, Room service, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Sunflower Oil | 8 | l | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | l | match |
| Sweet Corn Pkt | 3 | pkt | CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN | No | No | No | ? | not_comparable |
| Sweetcorn Tin | 1 | tin | NORTH INDIAN | No | No | No | ? | not_comparable |
| Tamarind | 5 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Tarbuj | 3 | kg | NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| Tata Salt | 8 | pkt | CHAT, JP Disposal, Softy., CHINESE & DOSA, MOCKTAILS & Continental, NORTH INDIAN, Restaurant, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Tea Cups Small | 1 | pkt | Restaurant | No | No | No | ? | not_comparable |
| Tea Powder | 5 | kg | CHAT, JP Disposal, Softy., Restaurant, SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| THAMALA PAKULU | 1 | pcs | SI- MEALS | No | No | No | ? | not_comparable |
| THOTAKURA | 1 | kg | SI- MEALS | No | No | No | ? | not_comparable |
| THUMS UP 250ml | 1 | bottle | Restaurant | No | No | No | ? | not_comparable |
| Till | 3 | kg | NORTH INDIAN, SI- MEALS, TIFFINS | No | No | No | ? | not_comparable |
| TOMATO | 3 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, SI- MEALS | No | No | Yes | kg | match |
| Tomato Ketchup | 2 | pcs | CHINESE & DOSA | No | No | No | ? | not_comparable |
| Tomato Sauce | 3 | bottle | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN | No | No | Yes | kg | conflict |
| Tooth Pick | 1 | box | Restaurant | No | No | No | ? | not_comparable |
| Towels | 2 | pcs | Room service | No | No | No | ? | not_comparable |
| Tugar Dal | 4 | kg | NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Turmeric Powder | 5 | kg | CHAT, JP Disposal, Softy., NORTH INDIAN, SI- MEALS, STAFF, TIFFINS | No | No | Yes | kg | match |
| Upma Ravva | 5 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF, TIFFINS | No | No | No | ? | not_comparable |
| Urad Dal | 3 | kg | CHAT, JP Disposal, Softy., SI- MEALS, STAFF | No | No | Yes | kg | match |
| Vanila Spoung | 1 | kg | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Veg Momos | 1 | pkt | CHINESE & DOSA | No | No | Yes | pcs | conflict |
| Veg Oyster Sauce | 2 | bottle | CHINESE & DOSA, NORTH INDIAN | No | No | No | ? | not_comparable |
| Viniger | 3 | bottle | CHINESE & DOSA, NORTH INDIAN | No | No | No | ? | not_comparable |
| Water Melon Syrup | 1 | bottle | Restaurant | No | No | Yes | l | conflict |
| Watermelon | 3 | kg | Restaurant, Room service | No | No | No | ? | not_comparable |
| White Batana | 3 | kg | CHAT, JP Disposal, Softy., SI- MEALS, TIFFINS | No | No | Yes | kg | match |
| White Pepper | 3 | kg | CHAT, JP Disposal, Softy., CHINESE & DOSA, NORTH INDIAN | No | No | No | ? | not_comparable |
| Wiper | 1 | pcs | SI- MEALS | No | No | No | ? | not_comparable |
| Wooden Fork | 1 | pkt | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Wooden Spoons Big | 1 | pkt | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |
| Wooden Spoons Small | 1 | pkt | CHAT, JP Disposal, Softy. | No | No | No | ? | not_comparable |

## Manual Database Review Guide

Use pgAdmin, DBeaver, or a terminal connected to the local PostgreSQL database. Connection details are in `backend/.env`; do not share the password. The configured database is `kapila` on `localhost:5432` with user `postgres`.

Read-only SQL queries:

```sql
-- 1. Live stock batches (the primary inventory table)
SELECT id, item_code, name, unit, qty, remaining, price, supplier, expiry_date
FROM stock
ORDER BY name, id;

-- 2. Indent template names currently offered by the application
SELECT id, item_name, item_code, created_at
FROM indent_templates
ORDER BY item_name;

-- 3. Approved spelling/scan aliases
SELECT id, alias, item_code, created_at
FROM stock_aliases
ORDER BY alias;

-- 4. Current and historical indents with departments and requested items
SELECT i.id AS indent_id, i.dept, i.date, i.status, ii.name, ii.item_code, ii.qty, ii.unit
FROM indents i
JOIN indent_items ii ON ii.indent_id = i.id
ORDER BY i.date DESC, i.id DESC, ii.name;

-- 5. Recipes and their ingredient units
SELECT r.id AS recipe_id, r.name AS recipe_name, ri.item_name, ri.base_qty, ri.unit
FROM recipes r
JOIN recipe_items ri ON ri.recipe_id = r.id
ORDER BY r.name, ri.item_name;

-- 6. Supplier rate / unit evidence, once populated
SELECT item_name, item_code, unit, supplier_id, rate, created_at
FROM supplier_rate_quotes
ORDER BY item_name, created_at DESC;
```

The current audit found empty `stock`, `stock_aliases`, `supplier_rate_quotes`, `indent_items`, `issuance_items`, and `purchase_order_items` tables. Therefore, zero returned rows from those queries is expected today.

## Safe Catalogue and Stock Loading Sequence

1. Keep the corrected indent workbook as the source request list.
2. Resolve `Parcel Covers 4*6` (`kg` versus `pkt`) with management; it requires one canonical unit.
3. Approve a catalogue record for each distinct item: canonical name, item code, category, primary unit, pack size, allowed conversions, and alias decision.
4. Add approved requestable names to `indent_templates`; it currently has no unit field, so do not use it as the unit authority.
5. Receive actual physical goods through supplier ? PO ? GRN. This creates real stock rows with quantity, unit, price, supplier, batch/expiry where applicable.
6. Add `stock_aliases` only for verified spelling variants?never for different sizes or different products.
7. Re-run this audit after the first GRN load and require zero unresolved unit conflicts before live indent operation.

## Method and Limits

- The sheet parser stops at each table?s first non-serial row, preventing one section from being read as another.
- Item names are compared case-insensitively after normalizing punctuation/spacing and non-ASCII display text. This finds candidates but does not prove business equivalence.
- Application canonical units are `kg`, `g`, `L`, `ml`, `pcs`, `dozen`, `box`, `bottle`, `pkt`, `tin`, `jar`, and `bulk`.
- No data was inferred from `Current stock with price.xlsx`, because this audit compares the indent workbook to the live database only.

