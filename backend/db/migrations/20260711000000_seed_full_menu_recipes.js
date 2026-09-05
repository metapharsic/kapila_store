// Seeds recipes + recipe_items for the full 255-dish Hotel Kapila menu
// (docs/menu/dish-catalog.md) using category-level ingredient templates
// (docs/menu/recipe-estimates.md). base_plates=100 for all — scale factor
// applied at indent time by smartAutofill()/getRecommendations() (existing).
//
// Chef/store manager must review qty per dish over first month of use —
// these are category averages, not verified per-dish recipes.

const TEMPLATES = {
  "Idly/Vada/Dosa Breakfast": [
    { item_name: "Idly/Dosa Batter", base_qty: 15.0, unit: "kg" },
    { item_name: "Refined Sunflower Oil", base_qty: 1.0, unit: "L" },
    { item_name: "Sambar Mix", base_qty: 10.0, unit: "L" },
    { item_name: "Chutney Mix", base_qty: 3.0, unit: "kg" },
  ],
  "Meals Thali": [
    { item_name: "Rice", base_qty: 20.0, unit: "kg" },
    { item_name: "Dal", base_qty: 8.0, unit: "kg" },
    { item_name: "Curry Veg Mix", base_qty: 10.0, unit: "kg" },
    { item_name: "Curd", base_qty: 5.0, unit: "kg" },
    { item_name: "Papad", base_qty: 100, unit: "pcs" },
  ],
  "Veg Curry Gravy": [
    { item_name: "Paneer/Veg", base_qty: 12.0, unit: "kg" },
    { item_name: "Gravy Base (Onion-Tomato-Spice)", base_qty: 10.0, unit: "kg" },
    { item_name: "Refined Sunflower Oil", base_qty: 1.5, unit: "L" },
    { item_name: "Butter/Cream", base_qty: 2.0, unit: "kg" },
  ],
  "Non-Veg Curry Gravy": [
    { item_name: "Chicken/Mutton/Fish", base_qty: 20.0, unit: "kg" },
    { item_name: "Gravy Base (Onion-Tomato-Spice)", base_qty: 10.0, unit: "kg" },
    { item_name: "Refined Sunflower Oil", base_qty: 2.0, unit: "L" },
    { item_name: "Spice Mix", base_qty: 1.0, unit: "kg" },
  ],
  "Biryani": [
    { item_name: "Biryani Rice", base_qty: 20.0, unit: "kg" },
    { item_name: "Protein (Veg/Chicken/Fish/Prawns/Egg)", base_qty: 15.0, unit: "kg" },
    { item_name: "Biryani Masala", base_qty: 1.5, unit: "kg" },
    { item_name: "Ghee", base_qty: 2.0, unit: "L" },
    { item_name: "Fried Onion", base_qty: 2.0, unit: "kg" },
  ],
  "Roti/Naan/Paratha": [
    { item_name: "Wheat Flour", base_qty: 10.0, unit: "kg" },
    { item_name: "Ghee/Butter", base_qty: 1.5, unit: "kg" },
  ],
  "Chinese Starters Dry": [
    { item_name: "Protein/Veg", base_qty: 15.0, unit: "kg" },
    { item_name: "Cornflour", base_qty: 2.0, unit: "kg" },
    { item_name: "Chinese Sauce Mix", base_qty: 3.0, unit: "L" },
    { item_name: "Refined Sunflower Oil", base_qty: 2.0, unit: "L" },
  ],
  "Fried Rice Noodles": [
    { item_name: "Rice/Noodles", base_qty: 20.0, unit: "kg" },
    { item_name: "Veg/Protein Mix", base_qty: 8.0, unit: "kg" },
    { item_name: "Chinese Sauce Mix", base_qty: 2.0, unit: "L" },
    { item_name: "Refined Sunflower Oil", base_qty: 1.5, unit: "L" },
  ],
  "Soup": [
    { item_name: "Stock Base", base_qty: 20.0, unit: "L" },
    { item_name: "Veg/Protein Mix", base_qty: 5.0, unit: "kg" },
    { item_name: "Cornflour", base_qty: 0.5, unit: "kg" },
  ],
  "Pizza": [
    { item_name: "Pizza Base", base_qty: 100, unit: "pcs" },
    { item_name: "Mozzarella Cheese", base_qty: 8.0, unit: "kg" },
    { item_name: "Toppings Mix", base_qty: 6.0, unit: "kg" },
    { item_name: "Pizza Sauce", base_qty: 3.0, unit: "kg" },
  ],
  "Burger Sandwich": [
    { item_name: "Bun/Bread", base_qty: 100, unit: "pcs" },
    { item_name: "Patty/Paneer", base_qty: 10.0, unit: "kg" },
    { item_name: "Cheese Slice", base_qty: 2.0, unit: "kg" },
    { item_name: "Veg Mix", base_qty: 4.0, unit: "kg" },
  ],
  "Pasta": [
    { item_name: "Pasta", base_qty: 15.0, unit: "kg" },
    { item_name: "Pasta Sauce", base_qty: 10.0, unit: "kg" },
    { item_name: "Veg Mix", base_qty: 5.0, unit: "kg" },
    { item_name: "Cheese", base_qty: 2.0, unit: "kg" },
  ],
  "Garlic Bread Fries": [
    { item_name: "Bread/Potato", base_qty: 15.0, unit: "kg" },
    { item_name: "Butter/Oil", base_qty: 2.0, unit: "kg" },
    { item_name: "Cheese", base_qty: 1.5, unit: "kg" },
  ],
  "Momos": [
    { item_name: "Momo Wrapper + Filling", base_qty: 15.0, unit: "kg" },
    { item_name: "Momo Dip", base_qty: 3.0, unit: "L" },
  ],
  "Chaat": [
    { item_name: "Chaat Base (Puri/Papdi/Bhature)", base_qty: 10.0, unit: "kg" },
    { item_name: "Chutney Mix", base_qty: 5.0, unit: "L" },
    { item_name: "Curd", base_qty: 3.0, unit: "kg" },
    { item_name: "Sev/Masala", base_qty: 1.0, unit: "kg" },
  ],
  "Filled Dosa": [
    { item_name: "Idly/Dosa Batter", base_qty: 15.0, unit: "kg" },
    { item_name: "Filling (Paneer/Veg/Choco)", base_qty: 8.0, unit: "kg" },
  ],
  "Thick Milk Shakes": [
    { item_name: "Milk", base_qty: 20.0, unit: "L" },
    { item_name: "Ice Cream", base_qty: 6.0, unit: "kg" },
    { item_name: "Flavour Syrup/Mix-in", base_qty: 3.0, unit: "kg" },
  ],
  "Mocktails": [
    { item_name: "Juice/Soda Base", base_qty: 20.0, unit: "L" },
    { item_name: "Syrup", base_qty: 2.0, unit: "L" },
    { item_name: "Mint/Garnish", base_qty: 0.5, unit: "kg" },
  ],
  "Faluda Softy Dessert": [
    { item_name: "Milk", base_qty: 15.0, unit: "L" },
    { item_name: "Vermicelli/Kulfi/Ice Cream", base_qty: 6.0, unit: "kg" },
    { item_name: "Syrup", base_qty: 2.0, unit: "L" },
  ],
};

const DISHES = {
  "Idly/Vada/Dosa Breakfast": ["Idly","Ghee Idly","Idly Sambar","Thatte Idly","Button Sambar Idly","Button Rasam Idly","Rasam Idly","Vada","Vada Sambar","Ghee Karam Idly","(S) Idly","(S) Idly (S) Vada","(S) Vada Sambar","(S) Vada","(S) Idly (S) Vada Sambar","2 Idly (S) Vada","70mm Dosa","Paper Dosa","Set Dosa","Vellulli Karam Podi Dosa","Ghee Karvepaaku Podi Dosa","Butter Masala Dosa","Paneer Dosa","Ghee Podi Pesarattu","Ghee Podi Rava Dosa","Pesarattu","Upma Masala Pesarattu","Ragi Dosa","Rava Dosa","Onion Uttapam","Tomato Uttapam","Spot Idly","Onion Rava Dosa","Masala Dosa","Onion Dosa","Plain Dosa","Chitti Pesarattu","Poori","Upma"],
  "Meals Thali": ["Meals","Meals w/Omlette","Meals w/Egg Curry","Meals w/Chicken Curry"],
  "Veg Curry Gravy": ["Dal Fry","Dal Tadka","Methi Dal","Kadai Veg","Mix Veg Curry","Kadai Paneer","Paneer Butter Masala","Kaju Butter Masala","Palak Paneer","Tomato Curry"],
  "Non-Veg Curry Gravy": ["Butter Chicken","Kadai Chicken","Telangana Chicken Curry","Mutton Kheema Masala","Fish Curry","Prawns Curry","Egg Kheema Curry"],
  "Biryani": ["Veg Dum Biryani","Chicken Dum Biryani","Chicken Fry Piece Biryani","Spl. Chicken Biryani (Boneless)","Fish Biryani","Prawns Biryani","Egg Biryani"],
  "Roti/Naan/Paratha": ["Plain Naan","Butter Naan","Garlic Butter Naan","Plain Roti","Butter Tandoori Roti","Garlic Butter Roti","Aloo Paratha","Paneer Paratha"],
  "Chinese Starters Dry": ["Garlic Paneer","Veg Manchuria","Crispy Corn","Paneer Majestic","Paneer Manchuria","Rampuri Paneer","Baby Corn Manchuria","Chilly Baby Corn","Chilly Paneer","Garlic Chicken","Chicken 65","Chicken Majestic","Chicken Manchuria","Rampuri Chicken","Pepper Chicken","Loose Prawns","Rampuri Prawns","Apollo Fish","Fish Tikka","Masala Omelette","Egg Chilly","Egg 65","Honey Chilli Potato","Paneer 65","Veg Spring Roll","Chinese Bhel"],
  "Fried Rice Noodles": ["Veg Pulao","Kaju Paneer Pulao","Kaju Pulao","Dal Kichdi","Jeera Rice","Tomato Rice","Veg Fried Rice","Curd Rice","Veg Kheema Pulao","Egg Fried Rice","Double Egg Fried Rice","Chicken Fried Rice","Mutton Kheema Pulao","Veg Soft Noodles","Schezwan Veg Noodles","Egg Soft Noodles","Chicken Soft Noodles","Schezwan Chicken Noodles","Schezwan Fried Rice","Burnt Garlic Rice","Garlic Fried Rice","Manchurian Fried Rice","Hakka Noodles","Schezwan Noodles","Schezwan Paneer Noodles","Manchurian Noodles"],
  "Soup": ["Corn Soup","Hot & Sour Soup","Manchow Soup","Chicken Corn Soup","Chicken Manchow Soup","Chicken Hot & Sour Soup"],
  "Pizza": ["Margherita Puff Pastry","Veg Supreme Puff Pastry","Tandoori Paneer Tikka Puff Pastry","Spicy Veg Puff Pastry","Margherita Pizza","Veg Supreme Pizza","Tandoori Paneer Tikka Pizza","Spicy Veg Pizza"],
  "Burger Sandwich": ["Veg Burger","Veg Burger with Cheese","Paneer Burger","Paneer Burger with Cheese","Veg Sandwich","Veg Grilled Sandwich","Veg Cheese Grilled Sandwich","Paneer Grilled Sandwich","Paneer Cheese Grilled Sandwich","Corn Chilli Cheese Sandwich"],
  "Pasta": ["Alfredo Pasta","Arrabiata Pasta"],
  "Garlic Bread Fries": ["Cheese Garlic Bread","Spicy Supreme Garlic Bread","Exotica Garlic Bread","Spicy Paneer Garlic Bread","Crispy Salted Fries","Peri Peri Fries","Animal Style Fries","Paneer Popcorn"],
  "Momos": ["Veg Fried Momos","Paneer Fried Momos","Mix Veg Steam Momos","Paneer Steam Momos"],
  "Chaat": ["Pani Puri Live","Pani Puri Atta","Pani Puri Suji","Bhel Puri","Dhai Puri","Sev Puri","Ragada Tikki Chaat","Alu Tikki Chaat","Bhalla Papdi","Chole Bhature","Dhai Bhalla","Raj Kachori","Samosa Ragada","Butter Pav Bhaji","Cheese Pav Bhaji","Paneer Pav Bhaji","Tawa Pulao","Dahi Papdi Chat","Samosa Dahi Chat","Samosa Chole Chat"],
  "Filled Dosa": ["Ghee Podi Dosa (Jalpan)","Mysore Masala","Pizza Dosa","Paneer Butter Masala Dosa","Palak Paneer Dosa","Manchurian Dosa","Pav Bhaji Dosa","Chocolate Nutella Dosa","Ghee Karivepaku Podi Dosa"],
  "Thick Milk Shakes": ["Choco Brownie Crumble","Biscoff Thick Shake","Oreo Nutella","Crunchy Butterscotch","Mango Blast","Sharjah Thick Shake","Cold Coffee","Cold Coffee Strong","Oreo Milk Shake","Kit Kat Milk Shake","Choco Brownie Milk Shake","Hazelnut Milk Shake","Biscoff Milk Shake","Caramel Milk Shake","Rose Gulkand"],
  "Mocktails": ["Jeera Masala","Mint Mojito","Water Melon Burst","Exotic Pineapple","Kala Katta","Ginger Lime Sparkler","Blue Lagoon","Virgin Mojito"],
  "Faluda Softy Dessert": ["Faluda","Butterscotch Rabri Faluda","Mango Faluda","Kulfi Faluda","Kulfi Faluda With Ice Cream","Vanilla Softy","Chocolate Softy","Choco Vanilla Softy","Special Flavour Softy","Apricot Delight","Kulfi with Rabri","Choco Brownie With Vanilla","Mango Delight","Jamun Ka Ghosla"],
};

exports.up = async (knex) => {
  for (const [category, dishNames] of Object.entries(DISHES)) {
    const template = TEMPLATES[category];
    for (const name of dishNames) {
      const existing = await knex("recipes").where({ name }).first();
      if (existing) continue;

      const [row] = await knex("recipes")
        .insert({ name, category, description: `Auto-seeded from ${category} template — verify qty with chef.` })
        .returning("id");
      const recipeId = row.id || row;

      await knex("recipe_items").insert(
        template.map((ing) => ({
          recipe_id: recipeId,
          item_name: ing.item_name,
          base_qty: ing.base_qty,
          base_plates: 100,
          unit: ing.unit,
        }))
      );
    }
  }
};

exports.down = async (knex) => {
  const names = Object.values(DISHES).flat();
  const rows = await knex("recipes").whereIn("name", names).select("id");
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await knex("recipe_items").whereIn("recipe_id", ids).del();
    await knex("recipes").whereIn("id", ids).del();
  }
};
