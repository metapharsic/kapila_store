# Sample Auto-Generated Indent (demo, from category templates)

Hypothetical day, expected covers: Meals 80, Butter Chicken 30, Chicken Biryani 40, Masala Dosa 25, Cold Coffee 20.

| Item | Formula | Qty needed |
|---|---|---|
| Rice | (80×200g meals) + (40×200g biryani) | 24.0 kg |
| Dal | 80×80g | 6.4 kg |
| Curry veg mix | 80×100g | 8.0 kg |
| Curd | 80×50g | 4.0 kg |
| Papad | 80×1pc | 80 pcs |
| Chicken (curry+biryani) | (30×200g) + (40×150g) | 12.0 kg |
| Gravy base (onion-tomato-spice) | 30×100g | 3.0 kg |
| Butter/cream | 30×20g | 0.6 kg |
| Biryani masala | 40×15g | 0.6 kg |
| Ghee | 40×20ml | 0.8 L |
| Fried onion | 40×20g | 0.8 kg |
| Dosa batter | 25×150g | 3.75 kg |
| Filling (paneer/veg) | 25×80g | 2.0 kg |
| Milk (cold coffee) | 20×200ml | 4.0 L |
| Ice cream | 20×60g | 1.2 kg |

Store manager reviews this against actual batch/stock on hand, chef signs off
qty, indent goes to store for issuance — same flow as existing `Indent/index.jsx`
smart-fill, just now backed by real per-category math instead of manual guess.

**Not live** — this is a hand-worked example proving the category-template
approach from `recipe-estimates.md` works. Wiring it into
`indentController.getRecommendations()` so covers → auto-indent happens without
manual math is the Phase-12 code task, still open.
