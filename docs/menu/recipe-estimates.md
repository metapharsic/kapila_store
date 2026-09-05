# Per-Dish Ingredient Estimates (category templates)

**Caveat first:** 255 dishes, no exact recipe cards given by hotel. Faking 255
individual precise recipes = guesswork chef would have to redo anyway. Instead:
category-level "per plate" standard ingredient templates below. Chef/store
manager adjust qty per actual recipe once, then it's reusable forever — this
is what `localAI.js` Smart Indent Template + `recipeController.js` already
expect as input (see `recipes` table, migration 049 recipe-cost-drift feature
already assumes a recipe→ingredient mapping exists per dish).

## Standard per-plate templates (base qty, scale × covers)

| Category | Example dishes | Key ingredients (per plate) |
|---|---|---|
| Idly/Vada/Dosa breakfast | Idly, Vada, Dosa varieties (37 dishes) | Idly/dosa batter 150g, oil 10ml, sambar 100ml, chutney 30g |
| Meals (thali) | Meals, Meals w/Egg/Chicken | Rice 200g, dal 80g, curry veg 100g, curd 50g, papad 1pc, sweet 50g |
| Veg curry (gravy) | Kadai Veg, Palak Paneer, Paneer Butter Masala, etc. (10 dishes) | Paneer/veg 120g, gravy base (onion-tomato-spice) 100g, oil 15ml, cream/butter 20g |
| Non-veg curry (gravy) | Butter Chicken, Kadai Chicken, Mutton Kheema (7 dishes) | Chicken/mutton 200g, gravy base 100g, oil 20ml, spice mix 10g |
| Biryani | Veg/Chicken/Fish/Prawns/Egg Biryani (7 dishes) | Rice 200g, protein 150g, biryani masala 15g, oil/ghee 20ml, fried onion 20g |
| Roti/Naan/Paratha | 8 dishes | Flour 100g, ghee/butter 15g |
| Chinese starters (dry) | Manchuria, Chilli Paneer/Chicken, 65 varieties (22 dishes) | Protein/veg 150g, cornflour 20g, sauce mix 30ml, oil 20ml |
| Fried rice/Noodles | 13 dishes | Rice/noodles 200g, veg/protein 80g, sauce mix 20ml, oil 15ml |
| Soup | 6 dishes | Stock 200ml, veg/protein 50g, cornflour 5g |
| Pizza | 8 dishes | Base 1pc, cheese 80g, topping 60g, sauce 30g |
| Burger/Sandwich | 11 dishes | Bun/bread 1pc, patty/paneer 100g, cheese 20g, veg 40g |
| Pasta | 2 dishes | Pasta 150g, sauce 100g, veg 50g, cheese 20g |
| Garlic bread/Fries | 9 dishes | Bread/potato 150g, butter/oil 20g, cheese 15g |
| Momos | 4 dishes | Wrapper+filling 150g (10pc), dip 30ml |
| Chaat | 20 dishes | Base (puri/papdi/bhature) 100g, chutney 50ml, curd 30g, sev/masala 10g |
| Dosa (Jalpan, filled) | 9 dishes | Dosa batter 150g, filling (paneer/veg/choco) 80g |
| Thick/Milk Shakes | 15 dishes | Milk 200ml, ice cream 60g, flavour syrup/mix-in 30g |
| Mocktails | 8 dishes | Juice/soda base 200ml, syrup 20ml, mint/garnish |
| Faluda/Softy/Dessert | 13 dishes | Milk 150ml, vermicelli/kulfi/ice cream 60g, syrup 20ml |

## How this feeds Smart Indent (existing feature)

`recipeController.js` + `SmartIndentTab.jsx` already do weekday/occurrence
autofill for indents (roadmap Phase 3, item #17 — DONE). Missing piece: no
per-dish ingredient row exists in DB yet for any of the 255 dishes above.

**To wire real auto-indent generation (not done yet, needs code):**
1. Seed `recipes` + `recipe_ingredients` tables from the category templates
   above (one seed script, ~19 category templates instead of 255 rows —
   dish→category mapping, category→ingredient qty).
2. Store manager/chef reviews and corrects qty per actual dish over first
   month of use (categories are estimates, not gospel).
3. `indentController.getRecommendations()` (existing) sums ingredient qty ×
   expected covers per dish → auto-drafts an indent.

This is a Phase-12-worthy code task, not done in this session (no code touched,
docs-only pull). Say word to build the seed script + wire it into
`getRecommendations`.
