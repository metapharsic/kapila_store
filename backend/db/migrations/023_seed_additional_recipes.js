exports.up = async function (knex) {
  const sectionsData = {
    "TIFFINS": [
      ["TFN Plain Idly", "Steamed rice cakes", [["IDLY RAVVA", 6.0], ["URAD DAL", 2.0], ["SALT SMALL", 0.2]]],
      ["TFN Ghee Roast Dosa", "Crispy golden ghee dosa", [["DOSA FLOUR", 8.0], ["GHEE", 1.5], ["SALT SMALL", 0.2]]],
      ["TFN Masala Dosa", "Dosa with potato masala", [["DOSA FLOUR", 8.0], ["POTATO", 5.0], ["SUNFLOWER OIL", 1.5], ["ONION", 2.0]]],
      ["TFN Rava Dosa", "Crispy semolina dosa", [["UPMA RAVA", 6.0], ["MAIDA", 2.0], ["SUNFLOWER OIL", 1.5], ["SALT SMALL", 0.2]]],
      ["TFN Medu Vada", "Deep fried lentil donuts", [["URAD DAL", 7.0], ["SUNFLOWER OIL", 3.0], ["ONION", 1.0], ["SALT SMALL", 0.2]]],
      ["TFN Onion Uttapam", "Thick pancake with onions", [["DOSA FLOUR", 8.0], ["ONION", 4.0], ["SUNFLOWER OIL", 1.0]]],
      ["TFN Upma", "Savoury semolina porridge", [["UPMA RAVA", 8.0], ["SUNFLOWER OIL", 1.5], ["ONION", 2.0], ["GREEN CHILLI", 0.5]]],
      ["TFN Puri Bhaji", "Fried bread with potato curry", [["ATTA", 8.0], ["POTATO", 6.0], ["SUNFLOWER OIL", 3.5], ["ONION", 2.0]]],
      ["TFN Pongal", "Rice and lentil porridge", [["RICE", 7.0], ["MOONG DAL", 3.0], ["GHEE", 1.5], ["PEPPER", 0.2]]],
      ["TFN Mysore Bonda", "Fried flour dumplings", [["MAIDA", 8.0], ["CURD", 2.0], ["SUNFLOWER OIL", 3.0], ["SALT SMALL", 0.2]]],
      ["TFN Pesarattu", "Green gram crepe", [["URAD DAL", 8.0], ["GINGER", 0.5], ["GREEN CHILLI", 0.5], ["SUNFLOWER OIL", 1.0]]],
      ["TFN Set Dosa", "Soft spongy crepes", [["DOSA FLOUR", 8.0], ["CURD", 1.5], ["SUNFLOWER OIL", 1.0]]],
      ["TFN Ragi Sangati", "Finger millet balls", [["RAGI FLOUR", 6.0], ["RICE", 4.0], ["SALT SMALL", 0.1]]],
      ["TFN Lemon Rice", "Lemon flavored rice", [["RICE", 10.0], ["SUNFLOWER OIL", 1.0], ["GREEN CHILLI", 0.5]]],
      ["TFN Tamarind Rice", "Tamarind flavored rice", [["RICE", 10.0], ["TAMARIND", 1.5], ["SUNFLOWER OIL", 1.5], ["RED CHILLI", 0.3]]],
      ["TFN Curd Rice", "Curd mixed with rice", [["RICE", 8.0], ["CURD", 6.0], ["MILK", 2.0], ["SALT SMALL", 0.2]]],
      ["TFN Sabudana Khichdi", "Sago pearl mixture", [["SABUDANA", 8.0], ["SUNFLOWER OIL", 1.0], ["POTATO", 2.0], ["GREEN CHILLI", 0.4]]],
      ["TFN Poori Special", "Deep fried wheat bread", [["ATTA", 8.0], ["SUNFLOWER OIL", 3.0], ["SALT SMALL", 0.1]]],
      ["TFN Tomato Bath", "Spicy tomato rice", [["UPMA RAVA", 8.0], ["TOMATO", 4.0], ["SUNFLOWER OIL", 1.5], ["ONION", 2.0]]],
      ["TFN Rava Khichdi", "Semolina and vegetable mix", [["UPMA RAVA", 8.0], ["CARROT", 1.5], ["FROZEN GREEN PEAS", 1.0], ["SUNFLOWER OIL", 1.5]]],
      ["TFN Cheese Dosa", "Dosa topped with cheese", [["DOSA FLOUR", 8.0], ["CHEESE", 3.0], ["BUTTER (500g)", 2.0]]],
      ["TFN Paneer Dosa", "Dosa with paneer stuffing", [["DOSA FLOUR", 8.0], ["PANEER", 3.0], ["SUNFLOWER OIL", 1.0], ["TOMATO", 1.0]]],
      ["TFN Ghee Karam Dosa", "Spicy red chutney dosa", [["DOSA FLOUR", 8.0], ["GHEE", 2.0], ["RED CHILLI", 0.5]]],
      ["TFN Tatte Idly", "Plate size soft idlies", [["IDLY RAVA", 7.0], ["URAD DAL", 2.5], ["GHEE", 0.5]]],
      ["TFN Button Idly Sambar", "Mini idlies dipped in sambar", [["IDLY RAVA", 5.0], ["URAD DAL", 2.0], ["TUGAR DAL", 3.0], ["TOMATO", 2.0]]],
      ["TFN Fried Idly", "Crispy fried idly pieces", [["IDLY RAVA", 6.0], ["URAD DAL", 2.0], ["SUNFLOWER OIL", 2.0], ["CHAT MASALA / चाट मसाला", 0.2]]],
      ["TFN Onion Dosa", "Dosa with chopped onions", [["DOSA FLOUR", 8.0], ["ONION", 4.0], ["SUNFLOWER OIL", 1.0]]],
      ["TFN Podi Idly", "Idlies tossed with spice powder", [["IDLY RAVA", 6.0], ["GHEE", 1.0], ["RED CHILLI", 0.5]]],
      ["TFN Wheat Dosa", "Instant whole wheat crepe", [["ATTA", 8.0], ["SUNFLOWER OIL", 1.0], ["SALT SMALL", 0.2]]],
      ["TFN Bread Toast", "Toasted bread with butter", [["BREAD", 10.0], ["BUTTER (500g)", 1.0]]]
    ],
    "STAFF": [
      ["STF Plain Rice", "Standard plain boiled rice for staff", [["RICE", 15.0], ["SALT SMALL", 0.1]]],
      ["STF Tomato Sambar", "Sambar cooked with lentils and tomatoes", [["TUGAR DAL", 4.0], ["TOMATO", 3.0], ["ONION", 2.0], ["SUNFLOWER OIL", 1.0]]],
      ["STF Pepper Rasam", "Spicy pepper and tamarind soup", [["TAMARIND", 1.0], ["PEPPER", 0.3], ["GARLIC", 0.5], ["MUSTARD OIL", 0.2]]],
      ["STF Curd Rice", "Rice mixed with curd and milk", [["RICE", 10.0], ["CURD", 8.0], ["MILK", 2.0], ["SALT SMALL", 0.2]]],
      ["STF Chicken Curry", "Staff special chicken gravy", [["CHICKEN BIG", 12.0], ["ONION", 4.0], ["TOMATO", 3.0], ["SUNFLOWER OIL", 2.0]]],
      ["STF Egg Curry", "Boiled eggs in onion tomato gravy", [["EGGS", 50.0], ["ONION", 3.0], ["TOMATO", 2.5], ["SUNFLOWER OIL", 1.5]]],
      ["STF Mixed Veg Kurma", "Mixed vegetables in spiced gravy", [["POTATO", 3.0], ["CARROT", 2.0], ["FROZEN GREEN PEAS", 1.5], ["SUNFLOWER OIL", 1.5]]],
      ["STF Tomato Pappu", "Andhra style lentils cooked with tomatoes", [["TUGAR DAL", 5.0], ["TOMATO", 4.0], ["GREEN CHILLI", 0.5], ["GHEE", 0.5]]],
      ["STF Moong Dal Pappu", "Simple yellow moong dal", [["MOONG DAL", 5.0], ["GHEE", 0.5], ["TURMERIC POWDER", 0.1], ["SALT SMALL", 0.2]]],
      ["STF Bhendi Fry", "Sautéed ladies finger with spices", [["BENDI", 8.0], ["SUNFLOWER OIL", 1.5], ["ONION", 1.5], ["SALT SMALL", 0.2]]],
      ["STF Potato Fry", "Crispy fried potato cubes", [["POTATO", 10.0], ["SUNFLOWER OIL", 2.0], ["CHILLI POWDER", 0.3], ["SALT SMALL", 0.2]]],
      ["STF Cabbage Fry", "Shredded cabbage stir fry", [["CABBAGE", 8.0], ["SUNFLOWER OIL", 1.0], ["GREEN CHILLI", 0.4], ["MUSTARD OIL", 0.2]]],
      ["STF Beans Fry", "Finely chopped french beans fry", [["BEANS", 8.0], ["SUNFLOWER OIL", 1.0], ["ONION", 1.5]]],
      ["STF Roti", "Whole wheat flatbread for staff", [["ATTA", 8.0], ["SALT SMALL", 0.1]]],
      ["STF Semolina Upma", "Classic semolina breakfast upma", [["UPMA RAVA", 8.0], ["SUNFLOWER OIL", 1.5], ["ONION", 2.0]]],
      ["STF Poha", "Flattened rice breakfast dish", [["POHA", 7.0], ["POTATO", 2.0], ["SUNFLOWER OIL", 1.0], ["ONION", 2.0]]],
      ["STF Lemon Rice", "Tangy lemon rice with peanuts", [["RICE", 12.0], ["SUNFLOWER OIL", 1.2], ["GREEN CHILLI", 0.5]]],
      ["STF Jeera Rice", "Basmati rice tempered with cumin", [["Premium Basmati Rice", 10.0], ["GHEE", 1.0], ["JEERA", 0.3]]],
      ["STF Mixed Veg Curry", "Daily veg curry for staff", [["POTATO", 3.0], ["CABBAGE", 3.0], ["CARROT", 2.0], ["SUNFLOWER OIL", 1.5]]],
      ["STF Chana Masala", "Chickpeas cooked in spicy gravy", [["KABULI CHANA", 6.0], ["ONION", 3.0], ["TOMATO", 3.0], ["SUNFLOWER OIL", 1.5]]],
      ["STF Rajma Masala", "Red kidney beans curry", [["RAJMA", 6.0], ["ONION", 3.0], ["TOMATO", 3.0], ["SUNFLOWER OIL", 1.5]]],
      ["STF Aloo Gobi", "Dry potato and cauliflower curry", [["POTATO", 5.0], ["CAULIFLOWER", 5.0], ["SUNFLOWER OIL", 1.5]]],
      ["STF Egg Bhurji", "Scrambled eggs with onions and chillies", [["EGGS", 60.0], ["ONION", 4.0], ["GREEN CHILLI", 0.5], ["SUNFLOWER OIL", 1.5]]],
      ["STF Dal Fry", "Yellow lentils tempered with ghee and spices", [["TUGAR DAL", 5.0], ["ONION", 2.0], ["TOMATO", 2.0], ["GHEE", 0.8]]],
      ["STF Soya Chunks Curry", "High protein soya meal curry", [["MEAL-MAKER", 4.0], ["ONION", 3.0], ["TOMATO", 2.5], ["SUNFLOWER OIL", 1.2]]],
      ["STF Majjiga Pulusu", "Buttermilk stew with vegetables", [["CURD", 6.0], ["ONION", 2.0], ["GREEN CHILLI", 0.5]]],
      ["STF Ridge Gourd Curry", "Beerakaya curry in Andhra style", [["BEERAKAYA", 8.0], ["SUNFLOWER OIL", 1.0], ["ONION", 1.5]]],
      ["STF Bottle Gourd Curry", "Sorakaya curry with milk and spices", [["SORAKAYA", 8.0], ["MILK", 1.5], ["SUNFLOWER OIL", 1.0]]],
      ["STF Ridge Gourd Pappu", "Lentils cooked with ridge gourd", [["TUGAR DAL", 4.0], ["BEERAKAYA", 4.0], ["TOMATO", 1.5]]],
      ["STF Chicken Biryani", "Special chicken biryani for staff", [["RICE", 12.0], ["CHICKEN BIG", 10.0], ["SUNFLOWER OIL", 2.5]]],
    ],
    "SI-MEALS": [
      ["SIM Standard South Indian Thali", "Rice, pappu, sambar, rasam, fry, curd", [["RICE", 15.0], ["TUGAR DAL", 4.0], ["CURD", 4.0], ["SUNFLOWER OIL", 2.0]]],
      ["SIM Special Meals Thali", "Special rice, sweet, curries, papad, curd", [["Premium Basmati Rice", 10.0], ["CURD", 5.0], ["GHEE", 1.0], ["SUGAR", 2.0]]],
      ["SIM Pappu Charu Meals", "Lentil soup with rice thali", [["RICE", 15.0], ["TUGAR DAL", 5.0], ["TOMATO", 3.0], ["TAMARIND", 1.0]]],
      ["SIM Guti Vankaya Meals", "Stuffed brinjal curry with thali", [["RICE", 15.0], ["BRINJAL", 6.0], ["SUNFLOWER OIL", 2.0], ["ONION", 2.0]]],
      ["SIM Avakaya Pappu Meals", "Mango pickle and dal meal combo", [["RICE", 15.0], ["TUGAR DAL", 4.0], ["MANGO PICKLE", 1.5], ["GHEE", 0.8]]],
      ["SIM Gongura Pappu Meals", "Sorrel leaves dal meal combo", [["RICE", 15.0], ["TUGAR DAL", 4.0], ["GONGURA", 3.0], ["GHEE", 0.8]]],
      ["SIM Sambhar Rice Meals", "Pre-mixed piping hot sambar rice thali", [["RICE", 12.0], ["TUGAR DAL", 3.5], ["TOMATO", 2.0], ["GHEE", 1.0]]],
      ["SIM Rasam Rice Meals", "Comforting rasam rice bowl with fry", [["RICE", 12.0], ["TOMATO", 3.0], ["TAMARIND", 1.0], ["PEPPER", 0.2]]],
      ["SIM Curd Rice Special", "Tempered pomegranate curd rice", [["RICE", 10.0], ["CURD", 8.0], ["ANAR", 1.0], ["MILK", 2.0]]],
      ["SIM Coconut Rice Meals", "Coconut flavored rice thali", [["RICE", 12.0], ["COCONUT", 4.0], ["GHEE", 1.0], ["CASHEW", 0.5]]],
      ["SIM Bagara Rice Meals", "Spiced rice without vegetables", [["Premium Basmati Rice", 12.0], ["GHEE", 1.5], ["ONION", 3.0]]],
      ["SIM Tomato Pappu Meals", "Dal cooked with tomatoes thali", [["RICE", 15.0], ["TUGAR DAL", 4.5], ["TOMATO", 3.5]]],
      ["SIM Dosakaya Pappu Meals", "Dal cooked with yellow cucumber", [["RICE", 15.0], ["TUGAR DAL", 4.0], ["DOSAKAYA", 3.0]]],
      ["SIM Beerakaya Pappu Meals", "Dal cooked with ridge gourd", [["RICE", 15.0], ["TUGAR DAL", 4.0], ["BEERAKAYA", 3.0]]],
      ["SIM Sorakaya Pulusu Meals", "Bottle gourd tangy stew with rice", [["RICE", 15.0], ["SORAKAYA", 5.0], ["TAMARIND", 1.0], ["TOMATO", 2.0]]],
      ["SIM Bhendi Fry Meals", "Ladies finger crispy fry thali", [["RICE", 15.0], ["BENDI", 6.0], ["SUNFLOWER OIL", 1.5]]],
      ["SIM Dondakaya Fry Meals", "Tindora crispy fry thali", [["RICE", 15.0], ["DONDAKAYA", 6.0], ["SUNFLOWER OIL", 1.5]]],
      ["SIM Aratikaya Fry Meals", "Raw banana dry curry thali", [["RICE", 15.0], ["ARATIKAYA", 6.0], ["SUNFLOWER OIL", 1.5]]],
      ["SIM Potato Kurma Meals", "South Indian style potato gravy thali", [["RICE", 15.0], ["POTATO", 5.0], ["SUNFLOWER OIL", 1.5]]],
      ["SIM Mixed Veg Pulusu Meals", "Mixed vegetable tangy stew thali", [["RICE", 15.0], ["CARROT", 1.5], ["POTATO", 2.0], ["TAMARIND", 1.0]]],
      ["SIM Kakarakaya Pulusu Meals", "Bitter gourd sweet-tangy stew thali", [["RICE", 15.0], ["KAKARKAYA", 4.0], ["JAGGERY", 1.0], ["TAMARIND", 1.0]]],
      ["SIM Chamadumpa Pulusu Meals", "Colocasia stew thali", [["RICE", 15.0], ["SHYAMAGADDA", 5.0], ["TAMARIND", 1.0]]],
      ["SIM Gongura Chicken Meals", "Sour sorrel leaves chicken with rice", [["RICE", 15.0], ["CHICKEN BIG", 8.0], ["GONGURA", 3.0], ["SUNFLOWER OIL", 1.5]]],
      ["SIM Andhra Chicken Fry Meals", "Spicy dry chicken fry thali", [["RICE", 15.0], ["CHICKEN BIG", 8.0], ["SUNFLOWER OIL", 2.0]]],
      ["SIM Nellore Chepala Pulusu Meals", "Traditional Nellore fish curry thali", [["RICE", 15.0], ["FISH", 8.0], ["TAMARIND", 2.0], ["MUSTARD OIL", 1.5]]],
      ["SIM Mutton Curry Meals", "Spicy mutton gravy with rice thali", [["RICE", 15.0], ["MUTTON", 7.0], ["ONION", 3.0], ["SUNFLOWER OIL", 2.0]]],
      ["SIM Egg Pulusu Meals", "Boiled egg tamarind stew thali", [["RICE", 15.0], ["EGGS", 30.0], ["TAMARIND", 1.2], ["ONION", 2.0]]],
      ["SIM Curd Majjiga Meals", "Cooling seasoned buttermilk meal", [["RICE", 15.0], ["CURD", 5.0], ["GREEN CHILLI", 0.3]]],
      ["SIM Pappu Rasam Combo", "Traditional dal and rasam thali", [["RICE", 15.0], ["TUGAR DAL", 4.0], ["TOMATO", 2.5], ["TAMARIND", 0.8]]],
      ["SIM Festival Special Meals", "Complete festive thali with payasam", [["RICE", 15.0], ["GHEE", 1.5], ["SUGAR", 2.0], ["MILK", 3.0]]]
    ],
    "NORTH INDIAN": [
      ["NIN Butter Paneer Masala", "Cottage cheese in rich butter gravy", [["PANEER", 8.0], ["BUTTER (500g)", 4.0], ["TOMATO", 5.0], ["CREAM", 1.5]]],
      ["NIN Kadai Paneer", "Paneer tossed with capsicum and fresh spices", [["PANEER", 8.0], ["CAPSICUM", 3.0], ["ONION", 3.0], ["SUNFLOWER OIL", 1.5]]],
      ["NIN Paneer Bhurji", "Scrambled cottage cheese with spices", [["PANEER", 8.0], ["ONION", 3.0], ["TOMATO", 3.5], ["GHEE", 1.0]]],
      ["NIN Dal Makhani", "Slow cooked black lentils with cream", [["BLACK URAD DAL", 6.0], ["BUTTER (500g)", 4.0], ["CREAM", 2.0], ["TOMATO", 3.0]]],
      ["NIN Dal Tadka", "Yellow dal tempered with double tadka", [["TUGAR DAL", 6.0], ["GHEE", 1.5], ["ONION", 2.0], ["TOMATO", 2.0]]],
      ["NIN Chana Masala", "Spicy chickpea curry punjabi style", [["KABULI CHANA", 6.0], ["ONION", 4.0], ["TOMATO", 4.0], ["SUNFLOWER OIL", 1.5]]],
      ["NIN Rajma Masala", "Red kidney beans in thick onion gravy", [["RAJMA", 6.0], ["ONION", 4.0], ["TOMATO", 3.5], ["SUNFLOWER OIL", 1.5]]],
      ["NIN Aloo Gobi Matar", "Potato, cauliflower and peas dry mix", [["POTATO", 4.0], ["CAULIFLOWER", 5.0], ["FROZEN GREEN PEAS", 2.0], ["SUNFLOWER OIL", 1.2]]],
      ["NIN Veg Kolhapuri", "Very spicy mixed vegetable curry", [["CARROT", 2.0], ["BEANS", 2.0], ["CAPSICUM", 2.0], ["KASHMIRI CHILLI POWDER", 0.5]]],
      ["NIN Veg Jalfrezi", "Stir-fried vegetables in sweet-sour gravy", [["CARROT", 2.0], ["CAPSICUM", 2.0], ["ONION", 2.0], ["TOMATO SAUCE", 1.0]]],
      ["NIN Malai Kofta", "Cheese dumplings in sweet cashew gravy", [["PANEER", 4.0], ["POTATO", 3.0], ["CREAM", 1.5], ["SUGAR", 1.0]]],
      ["NIN Bhindi Masala", "Ladies finger sautéed with onions", [["BENDI", 8.0], ["ONION", 3.0], ["SUNFLOWER OIL", 1.5], ["SALT SMALL", 0.2]]],
      ["NIN Baingan Bharta", "Smoked roasted eggplants mash", [["BRINJAL", 8.0], ["ONION", 4.0], ["TOMATO", 3.0], ["SUNFLOWER OIL", 1.5]]],
      ["NIN Jeera Rice", "Basmati rice cooked with cumin", [["Premium Basmati Rice", 10.0], ["GHEE", 1.2], ["JEERA", 0.3]]],
      ["NIN Veg Pulao", "Mildly spiced basmati rice with veggies", [["Premium Basmati Rice", 10.0], ["CARROT", 2.0], ["FROZEN GREEN PEAS", 1.5], ["GHEE", 1.0]]],
      ["NIN Butter Naan", "Tandoor flatbread with butter", [["MAIDA", 10.0], ["BUTTER (500g)", 3.0], ["MILK", 1.5]]],
      ["NIN Garlic Naan", "Tandoor flatbread topped with garlic", [["MAIDA", 10.0], ["GARLIC", 1.5], ["BUTTER (500g)", 3.0]]],
      ["NIN Tandoori Roti", "Whole wheat tandoor flatbread", [["TANDOORI ATTA", 10.0], ["SALT SMALL", 0.1]]],
      ["NIN Laccha Paratha", "Layered whole wheat flatbread", [["TANDOORI ATTA", 8.0], ["GHEE", 1.5], ["SALT SMALL", 0.1]]],
      ["NIN Aloo Paratha", "Flatbread stuffed with spiced potatoes", [["ATTA", 8.0], ["POTATO", 6.0], ["BUTTER (500g)", 2.0]]],
      ["NIN Chicken Tikka Masala", "Roasted chicken chunks in spiced gravy", [["CHICKEN BIG", 12.0], ["ONION", 4.0], ["TOMATO", 4.0], ["CREAM", 1.5]]],
      ["NIN Butter Chicken", "Chicken in creamy buttery tomato sauce", [["CHICKEN BIG", 12.0], ["BUTTER (500g)", 5.0], ["TOMATO", 6.0], ["CREAM", 2.0]]],
      ["NIN Kadai Chicken", "Chicken cooked with bell peppers in kadai spice", [["CHICKEN BIG", 12.0], ["CAPSICUM", 3.0], ["ONION", 3.0], ["SUNFLOWER OIL", 2.0]]],
      ["NIN Chicken Mughlai", "Rich egg drop chicken curry", [["CHICKEN BIG", 12.0], ["EGGS", 10.0], ["CREAM", 1.5], ["SUNFLOWER OIL", 2.0]]],
      ["NIN Mutton Rogan Josh", "Kashmiri style rich mutton gravy", [["MUTTON", 10.0], ["KASHMIRI CHILLI POWDER", 0.6], ["ONION", 3.0], ["MUSTARD OIL", 2.0]]],
      ["NIN Mutton Korma", "Mutton cooked in yogurt cashew paste", [["MUTTON", 10.0], ["CURD", 4.0], ["GHEE", 2.0], ["ONION", 3.0]]],
      ["NIN Fish Tikka Masala", "Tandoori fish tikka in spicy gravy", [["FISH", 10.0], ["ONION", 3.0], ["TOMATO", 3.5], ["SUNFLOWER OIL", 1.5]]],
      ["NIN Egg Curry Punjabi", "Dhaba style spicy egg gravy", [["EGGS", 60.0], ["ONION", 4.0], ["TOMATO", 4.0], ["SUNFLOWER OIL", 1.5]]],
      ["NIN Paneer Tikka", "Clay oven grilled cottage cheese cubes", [["PANEER", 8.0], ["CURD", 2.0], ["CAPSICUM", 2.0], ["ONION", 2.0]]],
      ["NIN Tandoori Chicken", "Whole chicken marinated and clay baked", [["CHICKEN BIG", 15.0], ["CURD", 3.0], ["KASHMIRI CHILLI POWDER", 0.5]]]
    ],
    "CHAT & SOFTY": [
      ["CHT Pani Puri", "Crispy puris with mint water and potato fill", [["MAIDA", 4.0], ["POTATO", 4.0], ["PUDINA", 1.0], ["TAMARIND", 1.0]]],
      ["CHT Dahi Puri", "Puris loaded with sweet curd and sev", [["MAIDA", 4.0], ["CURD", 8.0], ["POTATO", 3.0], ["SUGAR", 1.5]]],
      ["CHT Sev Puri", "Flat puris topped with potatoes, chutneys, sev", [["MAIDA", 4.0], ["POTATO", 4.0], ["ONION", 2.0], ["CHAT MASALA / चाट मसाला", 0.3]]],
      ["CHT Bhel Puri", "Puffed rice mixture with tangy chutney", [["POHA", 5.0], ["ONION", 2.0], ["TOMATO", 2.0], ["TAMARIND", 0.8]]],
      ["CHT Samosa Chat", "Crushed samosas topped with hot ragda", [["MAIDA", 6.0], ["POTATO", 5.0], ["WHITE BATANA", 4.0], ["SUNFLOWER OIL", 2.5]]],
      ["CHT Kachori Chat", "Crispy kachoris with sweet & sour curd", [["MAIDA", 6.0], ["MOONG DAL", 2.0], ["CURD", 5.0], ["SUNFLOWER OIL", 2.5]]],
      ["CHT Aloo Tikki Chat", "Pan fried potato patties with ragda", [["POTATO", 8.0], ["WHITE BATANA", 4.0], ["SUNFLOWER OIL", 2.0], ["ONION", 2.0]]],
      ["CHT Papdi Chat", "Crispy wafers topped with potatoes and yogurt", [["MAIDA", 5.0], ["CURD", 6.0], ["POTATO", 3.0], ["ONION", 1.5]]],
      ["CHT Masala Puri Chat", "Crushed puri loaded with warm peas gravy", [["WHITE BATANA", 6.0], ["MAIDA", 3.0], ["ONION", 2.0], ["TOMATO", 2.0]]],
      ["CHT Soft Vanilla Cone", "Soft vanilla ice cream in waffle cone", [["MILK", 10.0], ["SUGAR", 2.0], ["VANILLA ICECREAM", 2.0]]],
      ["CHT Soft Chocolate Cone", "Soft chocolate ice cream in waffle cone", [["MILK", 10.0], ["SUGAR", 2.0], ["CHOCLATE  POWDER", 1.5]]],
      ["CHT Mix Softy Cup", "Vanilla chocolate twist softy", [["MILK", 10.0], ["SUGAR", 2.0], ["VANILLA ICECREAM", 1.0], ["CHOCLATE  POWDER", 1.0]]],
      ["CHT Strawberry Softy Cup", "Strawberry flavored soft ice cream", [["MILK", 10.0], ["SUGAR", 2.0], ["DELIGHT ICE CREAM", 2.0]]],
      ["CHT Butterscotch Softy", "Butterscotch crunch softy in cup", [["MILK", 10.0], ["SUGAR", 2.0], ["VANILLA ICECREAM", 2.0]]],
      ["CHT Chocolate Fudge Softy", "Vanilla softy loaded with hot fudge", [["MILK", 8.0], ["SUGAR", 1.5], ["CHOCLATE  POWDER", 2.0]]],
      ["CHT Fruit Salad with Softy", "Mixed fruits topped with vanilla softy", [["ANAR", 3.0], ["MILK", 5.0], ["SUGAR", 1.0]]],
      ["CHT Vanilla Milkshake", "Classic thick vanilla milkshake", [["MILK", 15.0], ["SUGAR", 2.5], ["VANILLA ICECREAM", 3.0]]],
      ["CHT Chocolate Milkshake", "Creamy chocolate milkshake", [["MILK", 15.0], ["SUGAR", 2.5], ["CHOCLATE  POWDER", 2.0]]],
      ["CHT Strawberry Milkshake", "Sweet strawberry milkshake", [["MILK", 15.0], ["SUGAR", 2.5], ["DELIGHT ICE CREAM", 2.5]]],
      ["CHT Mango Softy", "Seasonal mango flavored soft ice cream", [["MILK", 10.0], ["SUGAR", 2.0]]],
      ["CHT Samosa (Plain)", "Crispy pastry stuffed with potatoes", [["MAIDA", 6.0], ["POTATO", 5.0], ["SUNFLOWER OIL", 3.0], ["GREEN CHILLI", 0.3]]],
      ["CHT Kachori (Plain)", "Flaky fried flour pocket filled with dals", [["MAIDA", 6.0], ["MOONG DAL", 2.0], ["SUNFLOWER OIL", 3.0]]],
      ["CHT Bread Cutlet", "Spiced vegetable and bread patties", [["BREAD", 20.0], ["POTATO", 4.0], ["SUNFLOWER OIL", 1.5]]],
      ["CHT Veg Cutlet", "Deep fried mixed veg patties", [["POTATO", 5.0], ["CARROT", 2.0], ["SUNFLOWER OIL", 2.0]]],
      ["CHT Chole Bhature", "Spicy chickpeas with large fried puffed bread", [["KABULI CHANA", 6.0], ["MAIDA", 8.0], ["SUNFLOWER OIL", 3.5], ["ONION", 3.0]]],
      ["CHT Pav Bhaji", "Spiced vegetable mash served with buttered rolls", [["POTATO", 6.0], ["TOMATO", 4.0], ["BUTTER (500g)", 4.0], ["ONION", 3.0]]],
      ["CHT Cheese Pav Bhaji", "Pav bhaji loaded with grated cheese", [["POTATO", 6.0], ["BUTTER (500g)", 4.0], ["CHEESE", 3.0]]],
      ["CHT Dahi Vada Chat", "Lentil fritters soaked in spiced curd", [["URAD DAL", 5.0], ["CURD", 8.0], ["SUGAR", 1.0], ["SUNFLOWER OIL", 2.0]]],
      ["CHT Raj Kachori", "Royal crispy kachori filled with all chats", [["MAIDA", 5.0], ["CURD", 6.0], ["POTATO", 2.0], ["WHITE BATANA", 2.0]]],
      ["CHT Dry Fruit Softy", "Rich softy topped with roasted nuts", [["MILK", 10.0], ["SUGAR", 2.0], ["BADAM/ बादाम", 1.0], ["KAJU 2 PCS", 1.0]]]
    ],
    "CHINESE & DOSA": [
      ["CND Veg Hakka Noodles", "Stir fried noodles with fresh vegetables", [["NOODLES", 10.0], ["CABBAGE", 3.0], ["CARROT", 2.0], ["SUNFLOWER OIL", 2.0]]],
      ["CND Veg Fried Rice", "Wok tossed basmati rice with veggies", [["Premium Basmati Rice", 10.0], ["CARROT", 2.0], ["CABBAGE", 2.0], ["SUNFLOWER OIL", 2.0]]],
      ["CND Schezwan Noodles", "Spicy schezwan stir fried noodles", [["NOODLES", 10.0], ["SCHEZWAN CHUTNEY", 2.0], ["CABBAGE", 3.0], ["SUNFLOWER OIL", 2.0]]],
      ["CND Gobi Manchurian Wet", "Fried cauliflower balls in spicy soy gravy", [["CAULIFLOWER /फू ล गोभी", 8.0], ["MAIDA / मेडा", 3.0], ["SUNFLOWER OIL", 2.5], ["SOYA SAUCE", 1.0]]],
      ["CND Gobi Manchurian Dry", "Crispy fried cauliflower in dry sauce", [["CAULIFLOWER /फू ล गोभी", 8.0], ["MAIDA / मेडा", 3.0], ["SUNFLOWER OIL", 2.5], ["SOYA SAUCE", 0.5]]],
      ["CND Baby Corn Manchurian", "Crispy baby corn in manchurian sauce", [["BABY CORN", 6.0], ["MAIDA / मेडा", 2.5], ["SUNFLOWER OIL", 2.5]]],
      ["CND Paneer Manchurian", "Cottage cheese chunks in manchurian sauce", [["PANEER", 7.0], ["MAIDA / मेडा", 2.0], ["SUNFLOWER OIL", 2.5]]],
      ["CND Chilli Paneer", "Stir fried paneer with onions & bell peppers", [["PANEER", 8.0], ["CAPSICUM", 3.0], ["ONION", 3.0], ["SOYA SAUCE", 1.0]]],
      ["CND Chilli Mushroom", "Spicy stir fried fresh mushrooms", [["MUSHROOM", 8.0], ["CAPSICUM", 2.5], ["ONION", 2.5], ["SUNFLOWER OIL", 1.5]]],
      ["CND Veg Spring Rolls", "Deep fried rolls with veg stuffing", [["MAIDA / मेडा", 5.0], ["CABBAGE", 3.0], ["CARROT", 2.0], ["SUNFLOWER OIL", 3.0]]],
      ["CND Paneer Momos (Fried)", "Deep fried momos with paneer stuffing", [["PANEER MOMOS", 100.0], ["SUNFLOWER OIL", 2.5]]],
      ["CND Paneer Momos (Steamed)", "Steamed momos with paneer stuffing", [["PANEER MOMOS", 100.0]]],
      ["CND Veg Momos (Fried)", "Deep fried vegetable momos", [["VEG MOMOS", 100.0], ["SUNFLOWER OIL", 2.5]]],
      ["CND Veg Momos (Steamed)", "Steamed fresh vegetable momos", [["VEG MOMOS", 100.0]]],
      ["CND Schezwan Paneer Fried Rice", "Fried rice with paneer in schezwan sauce", [["Premium Basmati Rice", 10.0], ["PANEER", 3.0], ["SCHEZWAN CHUTNEY", 2.0]]],
      ["CND Ginger Garlic Fried Rice", "Aromatic ginger and garlic fried rice", [["Premium Basmati Rice", 10.0], ["GINGER", 1.0], ["GARLIC", 1.0], ["SUNFLOWER OIL", 1.8]]],
      ["CND Spring Onion Fried Rice", "Fried rice dominated by green spring onions", [["Premium Basmati Rice", 10.0], ["SPRING ONION", 3.0], ["SUNFLOWER OIL", 1.8]]],
      ["CND Singapore Fried Noodles", "Curry powder flavored stir fry noodles", [["NOODLES", 10.0], ["CARROT", 2.5], ["SUNFLOWER OIL", 2.0]]],
      ["CND Triple Schezwan Rice", "Rice, noodles and manchurian combo", [["Premium Basmati Rice", 8.0], ["NOODLES", 5.0], ["CAULIFLOWER /फू ล गोभी", 4.0]]],
      ["CND Manchurian Gravy Noodles", "Noodles served with rich manchurian gravy", [["NOODLES", 10.0], ["CABBAGE", 3.0], ["SOYA SAUCE", 1.2]]],
      ["CND Spring Dosa", "Dosa filled with stir fried Chinese veggies", [["DOSA FLOUR", 8.0], ["CABBAGE", 2.5], ["CARROT", 2.0], ["SOYA SAUCE", 0.5]]],
      ["CND Schezwan Cheese Dosa", "Dosa with schezwan spread and cheese", [["DOSA FLOUR", 8.0], ["SCHEZWAN CHUTNEY", 2.0], ["CHEESE", 3.0]]],
      ["CND Pizza Dosa", "Dosa topped like a loaded pizza", [["DOSA FLOUR", 8.0], ["PIZZA SAUCE", 1.5], ["CHEESE", 3.0], ["CAPSICUM", 2.0]]],
      ["CND Chocolate Nutella Dosa", "Dosa drizzled with sweet chocolate nutella", [["DOSA FLOUR", 6.0], ["CHOCLATE SYRUP/NUTELLA", 2.0], ["BUTTER", 1.0]]],
      ["CND Chinese Noodles Dosa", "Dosa filled with cooked soft noodles", [["DOSA FLOUR", 8.0], ["NOODLES", 3.0], ["SOYA SAUCE", 0.5]]],
      ["CND Mysore Masala Dosa", "Spicy garlic paste Dosa with potatoes", [["DOSA FLOUR", 8.0], ["POTATO", 4.0], ["GARLIC", 1.0], ["GHEE", 1.0]]],
      ["CND Paneer Chilli Dosa", "Dosa stuffed with spicy paneer chilli", [["DOSA FLOUR", 8.0], ["PANEER", 3.0], ["CAPSICUM", 1.5]]],
      ["CND Mushroom Cheese Dosa", "Dosa with butter mushrooms and cheese", [["DOSA FLOUR", 8.0], ["MUSHROOM", 3.0], ["CHEESE", 3.0]]],
      ["CND Gobi Dosa", "Dosa filled with Gobi Manchurian", [["DOSA FLOUR", 8.0], ["CAULIFLOWER /फू ล गोभी", 3.0], ["SUNFLOWER OIL", 1.0]]],
      ["CND Schezwan Fried Dosa", "Pieces of dosa tossed in schezwan sauce", [["DOSA FLOUR", 8.0], ["SCHEZWAN CHUTNEY", 2.5], ["SUNFLOWER OIL", 1.5]]]
    ],
    "MOCKTAILS & CONTINENTAL": [
      ["MCT Virgin Mojito", "Cool refreshing mint lime cooler", [["MINT", 1.5], ["LEMON", 2.0], ["SUGAR", 2.0]]],
      ["MCT Blue Lagoon", "Stunning blue mocktail with citrus notes", [["BLUE CURACAO", 2.0], ["LEMON", 2.0], ["SUGAR", 2.0]]],
      ["MCT Fruit Punch", "Mixed fruit juices with vanilla top", [["ANAR", 3.0], ["MILK", 4.0], ["VANILLA ICECREAM", 2.0]]],
      ["MCT Pinacolada", "Pineapple and coconut rich mocktail", [["PINEAPPLE SYRUP", 2.5], ["COCONET", 2.0], ["MILK", 4.0]]],
      ["MCT Watermelon Cooler", "Chilled fresh watermelon drink", [["WATER MELON SYRUP", 3.0], ["LEMON", 1.5], ["SUGAR", 1.0]]],
      ["MCT Mango Mastani", "Thick mango shake with dry fruits & ice cream", [["MILK", 8.0], ["SUGAR", 1.5], ["VANILLA ICECREAM", 2.5]]],
      ["MCT Chocolate Shake with Brownie", "Fudge shake loaded with brownie", [["MILK", 10.0], ["SPONGE CAKE (PLAIN)", 3.0], ["CHOCLATE  POWDER", 2.0]]],
      ["MCT Oreo Shake", "Thick chocolate cookies shake", [["MILK", 10.0], ["SUGAR", 1.5], ["VANILLA ICECREAM", 2.0]]],
      ["MCT Cold Coffee with Ice Cream", "Sweet cold coffee with vanilla scoop", [["MILK", 10.0], ["COFFEE POWDER CONTI", 0.5], ["VANILLA ICECREAM", 2.5]]],
      ["MCT Veg Club Sandwich", "Triple layer veg sandwich with fries", [["BREAD", 30.0], ["POTATO", 3.0], ["VEG MAYONNAISE", 1.5]]],
      ["MCT Cheese Grilled Sandwich", "Buttery bread grilled with cheese", [["BREAD", 20.0], ["CHEESE / चीज़", 4.0], ["BUTTER", 1.0]]],
      ["MCT Veg Burger", "Crispy veg patty burger with cheese", [["BREAD", 10.0], ["POTATO", 3.0], ["CHEESE / चीज़", 1.0], ["VEG MAYONNAISE", 0.5]]],
      ["MCT Cheese Burger", "Double cheese loaded veg burger", [["BREAD", 10.0], ["POTATO", 2.0], ["CHEESE / चीज़", 2.0]]],
      ["MCT French Fries", "Crispy salted potato fingers", [["POTATO", 12.0], ["SUNFLOWER OIL", 3.0], ["SALT SMALL", 0.1]]],
      ["MCT Garlic Bread with Cheese", "Toasted baguette with garlic butter and cheese", [["BREAD", 10.0], ["GARLIC", 1.0], ["CHEESE / चीज़", 2.0]]],
      ["MCT Margherita Pizza", "Classic cheese and tomato pizza", [["MAIDA / मेडा", 8.0], ["PIZZA SAUCE", 2.0], ["CHEESE / चीज़", 4.0]]],
      ["MCT Veg Supreme Pizza", "Pizza loaded with exotic vegetables", [["MAIDA / मेडा", 8.0], ["CHEESE / चीज़", 4.0], ["CAPSICUM", 2.0], ["TOMATO", 2.0]]],
      ["MCT Paneer Tikka Pizza", "Pizza topped with spicy paneer tikka", [["MAIDA / मेडा", 8.0], ["CHEESE / चीज़", 3.5], ["PANEER", 3.0]]],
      ["MCT Pasta Alfredo (White Sauce)", "Penne pasta in rich cheese cream sauce", [["MAIDA / मेडा", 6.0], ["MILK", 4.0], ["CHEESE / चीज़", 3.0], ["BUTTER", 1.0]]],
      ["MCT Pasta Arrabbiata (Red Sauce)", "Penne in spicy tomato basil sauce", [["MAIDA / मेडा", 6.0], ["TOMATO", 6.0], ["OLIVE OIL", 1.0], ["GARLIC", 0.8]]],
      ["MCT Pink Sauce Pasta", "Mixed sauce penne with veggies", [["MAIDA / मेडा", 6.0], ["TOMATO", 4.0], ["MILK", 3.0], ["CHEESE / चीज़", 2.0]]],
      ["MCT Veg Lasagna", "Baked pasta sheets with vegetables and cheese", [["MAIDA / मेडा", 8.0], ["CHEESE / चीज़", 5.0], ["TOMATO", 4.0]]],
      ["MCT Bruschetta", "Grilled bread topped with tomatoes & olive oil", [["BREAD", 10.0], ["TOMATO", 3.0], ["OLIVE OIL", 0.8]]],
      ["MCT Nachos with Cheese", "Tortilla chips loaded with warm cheese sauce", [["MAIDA / मेडा", 5.0], ["CHEESE / चीज़", 4.0], ["SUNFLOWER OIL", 1.5]]],
      ["MCT Cheese Corn Balls", "Fried golden balls of cheese and corn", [["CHEESE / चीज़", 3.0], ["SWEET CORN PACKET", 2.0], ["MAIDA / मेडा", 3.0]]],
      ["MCT Strawberry Mojito", "Strawberry cooler with lime & mint", [["MINT", 1.5], ["LEMON", 1.5], ["DELIGHT ICE CREAM", 2.0]]],
      ["MCT Kiwi Cooler", "Refreshing kiwi fruit mocktail", [["LEMON", 1.5], ["SUGAR", 2.0]]],
      ["MCT Lemon Iced Tea", "Chilled sweet tea with lime juice", [["TEA PDR", 0.8], ["LEMON", 2.0], ["SUGAR", 2.5]]],
      ["MCT Peach Iced Tea", "Peach flavored sweet iced tea", [["TEA PDR", 0.8], ["SUGAR", 2.5]]],
      ["MCT Apple Mojito", "Apple cooler with lime and soda", [["MINT", 1.5], ["LEMON", 1.5]]],
    ],
    "RESTAURANT": [
      ["RST Restaurant Veg Thali", "Rice, roti, 3 curries, sweet, papad, curd", [["RICE", 15.0], ["ATTA", 4.0], ["CURD", 4.0], ["PANEER", 2.0]]],
      ["RST Restaurant Non-Veg Thali", "Rice, roti, chicken, egg curry, sweet, curd", [["RICE", 15.0], ["ATTA", 4.0], ["CHICKEN BIG", 5.0], ["EGGS", 15.0]]],
      ["RST Executive Lunch Pack", "Compact premium meals parcel pack", [["Premium Basmati Rice", 10.0], ["ATTA", 3.0], ["PANEER", 2.0]]],
      ["RST Paneer Biryani Combo", "Paneer biryani served with raita and sweet", [["BIRYANI RICE", 12.0], ["PANEER", 3.5], ["CURD", 2.0], ["SUGAR", 1.0]]],
      ["RST Chicken Biryani Combo", "Chicken biryani served with raita and salan", [["BIRYANI RICE", 12.0], ["CHICKEN BIG", 8.0], ["CURD", 2.0]]],
      ["RST Roti Curry Combo", "3 Rotis served with paneer butter masala", [["ATTA", 8.0], ["PANEER", 3.0], ["BUTTER (500g)", 1.5]]],
      ["RST Fried Rice Manchurian Combo", "Fried rice served with gobi manchurian gravy", [["Premium Basmati Rice", 8.0], ["CAULIFLOWER /फू ล गोभी", 4.0], ["SUNFLOWER OIL", 2.0]]],
      ["RST Noodles Gobi Combo", "Veg noodles with dry gobi manchurian starter", [["NOODLES", 8.0], ["CAULIFLOWER /फू ล गोभी", 4.0], ["SUNFLOWER OIL", 2.0]]],
      ["RST Soup Salad Starter Combo", "Soup, green salad and paneer tikka starters", [["TOMATO", 3.0], ["CUCUMBER", 2.0], ["PANEER", 4.0]]],
      ["RST Tomato Soup", "Warm creamy tomato soup with croutons", [["TOMATO", 8.0], ["CREAM", 1.0], ["BUTTER (500g)", 1.0], ["BREAD", 2.0]]],
      ["RST Sweet Corn Soup", "Creamy soup loaded with sweet corn kernels", [["SWEET CORN PACKET", 4.0], ["CORN FLOUR", 1.0], ["BUTTER", 0.5]]],
      ["RST Hot and Sour Soup", "Spicy sour soup with minced vegetables", [["CABBAGE", 2.0], ["CARROT", 1.5], ["VINEGAR", 0.5], ["SOYA SAUCE", 0.5]]],
      ["RST Manchow Soup", "Garlic flavored soup topped with fried noodles", [["NOODLES", 2.0], ["GARLIC", 1.0], ["SOYA SAUCE", 0.5], ["SUNFLOWER OIL", 1.0]]],
      ["RST Green Salad", "Sliced fresh cucumber, tomato, carrot & onion", [["CUCUMBER", 3.0], ["TOMATO", 3.0], ["CARROT", 2.0], ["ONION", 2.0]]],
      ["RST Russian Salad", "Diced boiled vegetables in mayonnaise dressing", [["POTATO", 3.0], ["CARROT", 2.0], ["VEG MAYONNAISE", 2.0]]],
      ["RST Boondi Raita", "Seasoned whipped yogurt topped with crispy boondi", [["CURD", 8.0], ["CHANA ATTA", 2.0], ["SUNFLOWER OIL", 1.0]]],
      ["RST Mixed Veg Raita", "Seasoned yogurt with onion, tomato, cucumber", [["CURD", 8.0], ["ONION", 1.5], ["TOMATO", 1.5], ["CUCUMBER", 1.5]]],
      ["RST Roasted Papad", "Roasted crispy lentil flatbread", [["PAPAD", 100.0]]],
      ["RST Masala Papad", "Papad topped with spiced onion tomato salad", [["PAPAD", 100.0], ["ONION", 2.0], ["TOMATO", 2.0], ["KOTHMIR", 0.3]]],
      ["RST Paneer Majestic", "Spicy fried paneer strips tossed in yogurt sauce", [["PANEER", 8.0], ["CURD", 2.0], ["SUNFLOWER OIL", 2.5], ["GARLIC", 0.8]]],
      ["RST Veg Crispy", "Batter fried mixed vegetables in garlic sauce", [["CAULIFLOWER /फू ล गोभी", 3.0], ["CARROT", 2.0], ["MAIDA / मेडा", 3.0], ["SUNFLOWER OIL", 2.5]]],
      ["RST Chicken Majestic", "Andhra style dry chicken starter with curry leaves", [["CHICKEN BIG", 10.0], ["CURD", 2.0], ["SUNFLOWER OIL", 2.5]]],
      ["RST Chilli Chicken", "Chinese style stir fried spicy chicken chunks", [["CHICKEN BIG", 10.0], ["CAPSICUM", 2.5], ["SOYA SAUCE", 1.0], ["SUNFLOWER OIL", 2.0]]],
      ["RST Chicken 65", "Deep fried marinated spicy chicken starter", [["CHICKEN BIG", 10.0], ["CURD", 1.5], ["SUNFLOWER OIL", 3.0]]],
      ["RST Pepper Chicken", "Chicken stir fried with heavy black pepper", [["CHICKEN BIG", 10.0], ["PEPPER", 0.5], ["ONION", 2.5], ["SUNFLOWER OIL", 1.8]]],
      ["RST Fish Fry", "Pan fried marinated fish fillets", [["FISH", 10.0], ["SUNFLOWER OIL", 2.0], ["CHILLI POWDER", 0.4]]],
      ["RST Apollo Fish", "Fried fish chunks tossed in spicy yogurt garlic sauce", [["FISH", 10.0], ["CURD", 2.0], ["SUNFLOWER OIL", 2.5]]],
      ["RST Loose Prawns", "Crispy batter fried fresh prawns starter", [["PRAWNS", 8.0], ["MAIDA / मेडा", 2.5], ["SUNFLOWER OIL", 2.5]]],
      ["RST Restaurant Special Biryani", "Special layered basmati rice chicken biryani", [["BIRYANI RICE", 15.0], ["CHICKEN BIG", 15.0], ["GHEE", 2.0], ["CURD", 4.0]]],
      ["RST Family Pack Biryani", "Bulk pack biryani with double starters", [["BIRYANI RICE", 25.0], ["CHICKEN BIG", 20.0], ["GHEE", 3.0], ["SUNFLOWER OIL", 4.0]]],
    ],
    "ROOM SERVICE": [
      ["RMS Room Service Tea", "Freshly brewed milk tea delivered in flask", [["MILK", 8.0], ["CHAI PATHI / चाय पिथ", 0.8], ["SUGAR", 1.5]]],
      ["RMS Room Service Coffee", "Hot frothed milk coffee delivered in flask", [["MILK", 8.0], ["COFFEE POWDER", 0.5], ["SUGAR", 1.5]]],
      ["RMS Milk with Cornflakes", "Chilled or hot milk served with breakfast flakes", [["MILK", 10.0], ["SUGAR", 1.0]]],
      ["RMS Bread Butter Jam", "Sliced bread served with butter chiplets and jam", [["BREAD", 20.0], ["BUTTER (500g)", 1.0]]],
      ["RMS Toast with Butter", "Crispy toasted bread slices with butter chiplets", [["BREAD", 20.0], ["BUTTER (500g)", 1.5]]],
      ["RMS Fruits Platter", "Assorted seasonal sliced fresh fruits platter", [["ANAR", 2.5]]],
      ["RMS Fresh Lime Water", "Refreshing lime water sweet or salted", [["LEMONS", 2.5], ["SUGAR", 1.5], ["SALT SMALL", 0.1]]],
      ["RMS Fresh Lime Soda", "Lime juice topped with carbonated club soda", [["LEMONS", 2.5], ["SUGAR", 1.5], ["SALT SMALL", 0.1]]],
      ["RMS Buttermilk (Spiced)", "Chilled churned yogurt with ginger and coriander", [["CURD", 5.0], ["GINGER", 0.2], ["KOTHMIR", 0.2]]],
      ["RMS Mineral Water Bottled", "Chilled sealed mineral water bottle", [["MINERAL WATER", 100.0]]],
      ["RMS Club Sandwich", "Triple layer toast sandwich with cheese and fries", [["BREAD", 30.0], ["CHEESE / चीज़", 3.0], ["POTATO", 3.0]]],
      ["RMS French Fries Bowl", "Crispy hot french fries served with ketchup", [["POTATO", 10.0], ["SUNFLOWER OIL", 2.5], ["SALT SMALL", 0.1]]],
      ["RMS Veg Pakoda", "Crispy fried vegetable fritters platter", [["POTATO", 3.0], ["ONION", 3.0], ["CHANNA ATTA/ बेसन", 4.0], ["SUNFLOWER OIL", 2.5]]],
      ["RMS Onion Pakoda", "Fried crispy onion juliennes in chickpea batter", [["ONION", 6.0], ["CHANNA ATTA/ बेसन", 4.0], ["SUNFLOWER OIL", 2.5]]],
      ["RMS Finger Chips", "Thick cut deep fried potato wedges", [["POTATO", 10.0], ["SUNFLOWER OIL", 2.5]]],
      ["RMS Aloo Jeera Dry", "Boiled potato cubes dry sautéed with cumin seeds", [["POTATO", 8.0], ["SUNFLOWER OIL", 1.0], ["JEERA", 0.3]]],
      ["RMS Dal Fry with Steamed Rice", "Comforting yellow dal with plain rice combo", [["RICE", 12.0], ["TUGAR DAL", 4.0], ["GHEE", 1.0]]],
      ["RMS Egg Bhurji Toast", "Scrambled eggs with butter toast slices", [["EGGS", 40.0], ["BREAD", 20.0], ["BUTTER (500g)", 1.0]]],
      ["RMS Omelette with Bread", "2 Eggs double omelette served with butter toasts", [["EGGS", 40.0], ["BREAD", 20.0], ["BUTTER (500g)", 1.0]]],
      ["RMS Chicken Sandwich", "Toast bread filled with creamy shredded chicken", [["BREAD", 20.0], ["CHICKEN BIG", 4.0], ["VEG MAYONNAISE", 1.0]]],
      ["RMS Plain Curd Bowl", "Fresh set thick plain yogurt bowl", [["CURD", 10.0]]],
      ["RMS Khichdi with Dahi", "Soft rice & lentil porridge served with curd", [["RICE", 6.0], ["MOONG DAL", 3.0], ["CURD", 4.0], ["GHEE", 0.8]]],
      ["RMS Curd Rice", "Soft curd rice tempered with mustard & curry leaves", [["RICE", 8.0], ["CURD", 6.0], ["MILK", 1.5]]],
      ["RMS Veg Noodles Bowl", "Bowl of stir fried chinese noodles with veggies", [["NOODLES", 10.0], ["CABBAGE", 2.5], ["SUNFLOWER OIL", 1.5]]],
      ["RMS Chicken Noodles Bowl", "Bowl of stir fried noodles loaded with chicken", [["NOODLES", 10.0], ["CHICKEN BIG", 4.0], ["SUNFLOWER OIL", 1.5]]],
      ["RMS Paneer Butter Masala Roti Combo", "3 Rotis served with paneer butter masala combo", [["ATTA", 8.0], ["PANEER", 3.0], ["BUTTER (500g)", 1.0]]],
      ["RMS Dal Tadka Rice Combo", "Plain basmati rice served with yellow dal tadka", [["Premium Basmati Rice", 10.0], ["TUGAR DAL", 4.0], ["GHEE", 1.0]]],
      ["RMS Veg Pulao Raita Combo", "Vegetable pulao served with cooling raita combo", [["Premium Basmati Rice", 10.0], ["CARROT", 1.5], ["CURD", 2.0]]],
      ["RMS Chicken Curry Roti Combo", "3 Rotis served with home style chicken curry combo", [["ATTA", 8.0], ["CHICKEN BIG", 6.0], ["SUNFLOWER OIL", 1.5]]],
      ["RMS Caramel Custard", "Baked sweet egg custard with caramel sauce", [["MILK", 6.0], ["EGGS", 20.0], ["SUGAR", 2.0]]]
    ]
  };

  const recipesToInsert = [];
  const recipeItemsToInsert = [];

  for (const [category, list] of Object.entries(sectionsData)) {
    for (const [name, desc, ingredients] of list) {
      recipesToInsert.push({
        name,
        category,
        description: desc
      });
    }
  }

  // Insert recipes in batches of 50 to get returning IDs
  const batchSize = 50;
  for (let i = 0; i < recipesToInsert.length; i += batchSize) {
    const batch = recipesToInsert.slice(i, i + batchSize);
    const inserted = await knex("recipes").insert(batch).returning(["id", "name"]);
    
    // Map inserted ID back to ingredients
    const idMap = {};
    inserted.forEach(r => {
      idMap[r.name] = r.id;
    });

    for (const r of batch) {
      const recipeId = idMap[r.name];
      if (!recipeId) continue;

      // Find the original recipe from sectionsData to get ingredients
      let foundIngredients = [];
      for (const list of Object.values(sectionsData)) {
        const matching = list.find(item => item[0] === r.name);
        if (matching) {
          foundIngredients = matching[2];
          break;
        }
      }

      for (const [itemName, baseQty] of foundIngredients) {
        recipeItemsToInsert.push({
          recipe_id: recipeId,
          item_name: itemName,
          base_qty: baseQty,
          base_plates: 100,
          unit: itemName.includes("OIL") || itemName.includes("GHEE") || itemName.includes("MILK") || itemName === "ROSE WATER" || itemName === "WATER MELON SYRUP" || itemName === "BLUE CURACAO" ? "L" : (itemName.includes("BOX") || itemName === "EGGS" || itemName === "BREAD" || itemName.includes("MOMOS") || itemName.includes("500g") || itemName === "CHEESE" || itemName === "PAPAD" ? "pcs" : "kg")
        });
      }
    }
  }

  // Insert recipe items in batches of 100
  const itemBatchSize = 100;
  for (let i = 0; i < recipeItemsToInsert.length; i += itemBatchSize) {
    const itemBatch = recipeItemsToInsert.slice(i, i + itemBatchSize);
    await knex("recipe_items").insert(itemBatch);
  }
};

exports.down = async function (knex) {
  const sections = [
    "TIFFINS", "STAFF", "SI-MEALS", "NORTH INDIAN",
    "CHAT & SOFTY", "CHINESE & DOSA", "MOCKTAILS & CONTINENTAL",
    "RESTAURANT", "ROOM SERVICE"
  ];
  
  // To avoid deleting the 4 pre-existing recipes, we only delete recipes whose name starts with one of our prefixes:
  // "TFN ", "STF ", "SIM ", "NIN ", "CHT ", "CND ", "MCT ", "RST ", "RMS "
  const prefixes = ["TFN ", "STF ", "SIM ", "NIN ", "CHT ", "CND ", "MCT ", "RST ", "RMS "];
  const query = knex("recipes").whereIn("category", sections);
  
  // Construct a raw query clause to delete by prefix
  let whereRaw = "";
  prefixes.forEach((pref, idx) => {
    if (idx > 0) whereRaw += " OR ";
    whereRaw += `name LIKE '${pref}%'`;
  });
  
  await query.andWhereRaw(`(${whereRaw})`).del();
};
