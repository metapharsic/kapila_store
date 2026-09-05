exports.up = async function (knex) {
  // 1. Clear the old templates
  await knex('indent_templates').del();

  // 2. Insert new synced templates
  const rows = [
  {
    "template_name": "TIFFINS ",
    "row_no": 1,
    "item_name": "Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 2,
    "item_name": "Pesarlu",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 3,
    "item_name": "Atukulu",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 4,
    "item_name": "Pally Chutney",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 5,
    "item_name": "Biryani Leaf",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 6,
    "item_name": "Round Pally",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 7,
    "item_name": "Baking Powder",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 8,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 9,
    "item_name": "Butter 500 Gm",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 10,
    "item_name": "Putani",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 11,
    "item_name": "Channa Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 12,
    "item_name": "Ragi Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 13,
    "item_name": "Channa Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 14,
    "item_name": "Rai",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 15,
    "item_name": "Chilly Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 16,
    "item_name": "Red Chilly",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 17,
    "item_name": "Coconut",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 18,
    "item_name": "Salt Big",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 19,
    "item_name": "Coconut Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 20,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 21,
    "item_name": "Coffee Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 22,
    "item_name": "Mtr Sambar Powder",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 23,
    "item_name": "Corn Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 24,
    "item_name": "Somp",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 25,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 26,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 27,
    "item_name": "Dalchina",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 28,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 29,
    "item_name": "Dalda",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 30,
    "item_name": "Tamarind",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 31,
    "item_name": "Dhaniya",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 32,
    "item_name": "Tarbuj",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 33,
    "item_name": "Dhaniya Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 34,
    "item_name": "Till",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 35,
    "item_name": "Dosa Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 36,
    "item_name": "Tugar Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 37,
    "item_name": "Dry Coconut",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 38,
    "item_name": "Turmeric Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 39,
    "item_name": "Elaichi",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 40,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 41,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 42,
    "item_name": "White Batana",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 43,
    "item_name": "Bharath Gas",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 44,
    "item_name": "Small Onion",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 45,
    "item_name": "Ghee",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 46,
    "item_name": "3cp",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 47,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 48,
    "item_name": "8cp",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 49,
    "item_name": "Green Batana Raw",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 50,
    "item_name": "Butter Covers",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 51,
    "item_name": "Hing",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 52,
    "item_name": "Compostable Grocery Bags 13*16",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 53,
    "item_name": "Jaggery",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 54,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 55,
    "item_name": "Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 56,
    "item_name": "Compostable Grocery Bags 16*20",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 57,
    "item_name": "Jeera Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 58,
    "item_name": "Silver Pouch 6*8",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 59,
    "item_name": "Kabuli Channa",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 60,
    "item_name": "Wooden Spoons Big",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 61,
    "item_name": "Kaju Nuka",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 62,
    "item_name": "Silver Pouch 7*9",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 63,
    "item_name": "Kashmiri Mirchi Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 64,
    "item_name": "Idly Box",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 65,
    "item_name": "Kasturi Methi",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 66,
    "item_name": "Dosa Box",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 67,
    "item_name": "Khas Khas",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 68,
    "item_name": "Garbage Bags",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 69,
    "item_name": "Lavang",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 70,
    "item_name": "Caps",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 71,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 72,
    "item_name": "Hand Gloves",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 73,
    "item_name": "Masoor Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 74,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 75,
    "item_name": "Mentulu",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 76,
    "item_name": "Parcel Covers 5*8",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 77,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 78,
    "item_name": "Silver Foil",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 79,
    "item_name": "Gold Milk",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 80,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 81,
    "item_name": "Moong Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 82,
    "item_name": "Caps",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 83,
    "item_name": "Onion",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 84,
    "item_name": "White Tape",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 85,
    "item_name": "Palm Oil",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 86,
    "item_name": "Paper Rolls",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 87,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 88,
    "item_name": "Cleaning Coth",
    "default_unit": "pcs"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 89,
    "item_name": "Pather Pool",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 90,
    "item_name": "Paper",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 91,
    "item_name": "Small Onion",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 92,
    "item_name": "DOSA BATTER",
    "default_unit": ""
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 93,
    "item_name": "IDLY",
    "default_unit": ""
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 94,
    "item_name": "Dosa Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 95,
    "item_name": "Idly Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 96,
    "item_name": "Boiled Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 97,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 98,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 99,
    "item_name": "Mentulu",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 100,
    "item_name": "VADA",
    "default_unit": ""
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 101,
    "item_name": "Channa Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 102,
    "item_name": "Atukulu",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 103,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 104,
    "item_name": "DOSA MIX",
    "default_unit": ""
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 105,
    "item_name": "Dosa Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 106,
    "item_name": "RAVA DOSA",
    "default_unit": ""
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 107,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 108,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 109,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 110,
    "item_name": "Rock Salt",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 111,
    "item_name": "Dosa Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 112,
    "item_name": "TATTE  IDLY",
    "default_unit": ""
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 113,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 114,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 115,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 116,
    "item_name": "Atukulu",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 117,
    "item_name": "Sabudana",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 118,
    "item_name": "Aratikaya",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 119,
    "item_name": "KAKARKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 120,
    "item_name": "BEANS",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 121,
    "item_name": "KANDAGADDA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 122,
    "item_name": "BEERAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 123,
    "item_name": "KARIVEPAKU",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 124,
    "item_name": "BEETROOT",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 125,
    "item_name": "KHEERA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 126,
    "item_name": "BENDI",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 127,
    "item_name": "KOTHMIR",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 128,
    "item_name": "BRINJAL",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 129,
    "item_name": "LEMONS",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 130,
    "item_name": "BUDAMDOSAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 131,
    "item_name": "MAMDIKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 132,
    "item_name": "CABBAGE",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 133,
    "item_name": "METHI",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 134,
    "item_name": "CAPSICUM",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 135,
    "item_name": "MUNAKKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 136,
    "item_name": "CARROT",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 137,
    "item_name": "PALAK",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 138,
    "item_name": "CAULIFLOWER",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 139,
    "item_name": "POTLAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 140,
    "item_name": "CHIKKUDIKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 141,
    "item_name": "PUDINA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 142,
    "item_name": "CHUKKAKURA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 143,
    "item_name": "RADDISH",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 144,
    "item_name": "DILPASAND",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 145,
    "item_name": "SHYAMAGADDA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 146,
    "item_name": "DONDAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 147,
    "item_name": "SPRING ONION",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 148,
    "item_name": "GONGURA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 149,
    "item_name": "THOTAKURA",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 150,
    "item_name": "GREEN CHILLI",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 151,
    "item_name": "TOMATO",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 152,
    "item_name": "KADDU",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 153,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 154,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 155,
    "item_name": "Tea Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 156,
    "item_name": "Coffee Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 157,
    "item_name": "Boost",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 158,
    "item_name": "Horlicks",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 159,
    "item_name": "Lamsa",
    "default_unit": "pkt"
  },
  {
    "template_name": "TIFFINS ",
    "row_no": 160,
    "item_name": "Gold Milk",
    "default_unit": "L"
  },
  {
    "template_name": "STAFF ",
    "row_no": 1,
    "item_name": "Aromatic Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 2,
    "item_name": "Hmt Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 3,
    "item_name": "Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 4,
    "item_name": "Tamarind",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 5,
    "item_name": "Atukulu",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 6,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "STAFF ",
    "row_no": 7,
    "item_name": "Biryani Leaf",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 8,
    "item_name": "Tea Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 9,
    "item_name": "Biryani Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 10,
    "item_name": "Tugar Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 11,
    "item_name": "Black Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 12,
    "item_name": "Turmeric Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 13,
    "item_name": "Bread",
    "default_unit": "pkt"
  },
  {
    "template_name": "STAFF ",
    "row_no": 14,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 15,
    "item_name": "Brown Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 16,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 17,
    "item_name": "Channa Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 18,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 19,
    "item_name": "Channa Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 20,
    "item_name": "Chicken Staff",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 21,
    "item_name": "Chilly Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 22,
    "item_name": "BEERAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 23,
    "item_name": "Coconut Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 24,
    "item_name": "CABBAIGE",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 25,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 26,
    "item_name": "CAPSICUM",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 27,
    "item_name": "Dalchina",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 28,
    "item_name": "CARROT",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 29,
    "item_name": "Dhaniya",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 30,
    "item_name": "DONDAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 31,
    "item_name": "Dhaniya Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 32,
    "item_name": "DOSAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 33,
    "item_name": "Dosa Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 34,
    "item_name": "GREEN CHILLI",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 35,
    "item_name": "Dry Coconut",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 36,
    "item_name": "KOTHMIR",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 37,
    "item_name": "Eggs",
    "default_unit": "pcs"
  },
  {
    "template_name": "STAFF ",
    "row_no": 38,
    "item_name": "MONAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 39,
    "item_name": "Elaichi",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 40,
    "item_name": "PUDINA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 41,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 42,
    "item_name": "SORAKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 43,
    "item_name": "Bharath Gas",
    "default_unit": "pcs"
  },
  {
    "template_name": "STAFF ",
    "row_no": 44,
    "item_name": "TOMATO",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 45,
    "item_name": "Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 46,
    "item_name": "VANKAYA",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 47,
    "item_name": "Jeera Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 48,
    "item_name": "Kaju Nuka",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 49,
    "item_name": "Khas Khas",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 50,
    "item_name": "Lavang",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 51,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 52,
    "item_name": "Meal Maker",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 53,
    "item_name": "Mentulu",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 54,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "STAFF ",
    "row_no": 55,
    "item_name": "Moong Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 56,
    "item_name": "Murmura",
    "default_unit": "pkt"
  },
  {
    "template_name": "STAFF ",
    "row_no": 57,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 58,
    "item_name": "Pally Chutney",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 59,
    "item_name": "Palm Oil",
    "default_unit": "L"
  },
  {
    "template_name": "STAFF ",
    "row_no": 60,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 61,
    "item_name": "Pather Pool",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 62,
    "item_name": "Pineapple",
    "default_unit": "pcs"
  },
  {
    "template_name": "STAFF ",
    "row_no": 63,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 64,
    "item_name": "Red Chilly",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 65,
    "item_name": "Round Pally",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 66,
    "item_name": "Sabudana",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 67,
    "item_name": "Sajeera",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 68,
    "item_name": "Salt Big",
    "default_unit": "pkt"
  },
  {
    "template_name": "STAFF ",
    "row_no": 69,
    "item_name": "Semiya",
    "default_unit": "pkt"
  },
  {
    "template_name": "STAFF ",
    "row_no": 70,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "STAFF ",
    "row_no": 71,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 1,
    "item_name": "Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 2,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 3,
    "item_name": "Atukulu",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 4,
    "item_name": "Makka Chudwa",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 5,
    "item_name": "Biryani Leaf",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 6,
    "item_name": "Mango Crush",
    "default_unit": "bottle"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 7,
    "item_name": "Baking Powder",
    "default_unit": "pcs"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 8,
    "item_name": "Masoor Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 9,
    "item_name": "Bobberlu",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 10,
    "item_name": "Meal Maker",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 11,
    "item_name": "Bread",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 12,
    "item_name": "Mentulu",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 13,
    "item_name": "Broken Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 14,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 15,
    "item_name": "Butter 500 Gm",
    "default_unit": "pcs"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 16,
    "item_name": "Milk Maid",
    "default_unit": "tin"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 17,
    "item_name": "Channa Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 18,
    "item_name": "Moong Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 19,
    "item_name": "Channa Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 20,
    "item_name": "Small Onion",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 21,
    "item_name": "Chat Masala",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 22,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 23,
    "item_name": "Chilly Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 24,
    "item_name": "Palm Oil",
    "default_unit": "L"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 25,
    "item_name": "Coconut",
    "default_unit": "pcs"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 26,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 27,
    "item_name": "Coffee Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 28,
    "item_name": "Papad",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 29,
    "item_name": "Corn Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 30,
    "item_name": "Pather Pool",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 31,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 32,
    "item_name": "Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 33,
    "item_name": "Curd Cups",
    "default_unit": "pcs"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 34,
    "item_name": "Pesarlu",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 35,
    "item_name": "Dalchina",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 36,
    "item_name": "Pally Chutney",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 37,
    "item_name": "Dalda",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 38,
    "item_name": "Round Pally",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 39,
    "item_name": "Dhaniya",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 40,
    "item_name": "Mango Pickle",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 41,
    "item_name": "Dhaniya Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 42,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 43,
    "item_name": "Dosa Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 44,
    "item_name": "Putani",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 45,
    "item_name": "Dosa Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 46,
    "item_name": "Ragi Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 47,
    "item_name": "Dry Coconut",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 48,
    "item_name": "Rai",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 49,
    "item_name": "Elaichi",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 50,
    "item_name": "Rajma",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 51,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 52,
    "item_name": "Red Chilly",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 53,
    "item_name": "Bharath Gas",
    "default_unit": "pcs"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 54,
    "item_name": "Sabudana",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 55,
    "item_name": "Ghee",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 56,
    "item_name": "Sajeera",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 57,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 58,
    "item_name": "Salt Big",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 59,
    "item_name": "Green Batana Raw",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 60,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 61,
    "item_name": "Hing",
    "default_unit": "pcs"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 62,
    "item_name": "Mtr Sambar Powder",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 63,
    "item_name": "Homa",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 64,
    "item_name": "Semiya",
    "default_unit": "pkt"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 65,
    "item_name": "Idly Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 66,
    "item_name": "Somp",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 67,
    "item_name": "Jaggery",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 68,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 69,
    "item_name": "Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 70,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 71,
    "item_name": "Jeera Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 72,
    "item_name": "Hmt Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 73,
    "item_name": "Kabuli Channa",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 74,
    "item_name": "Tamarind",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 75,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 76,
    "item_name": "Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 77,
    "item_name": "Kaju Nuka",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 78,
    "item_name": "Tarbuj",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 79,
    "item_name": "Kashmiri Mirchi Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 80,
    "item_name": "Tea Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 81,
    "item_name": "Kasturi Methi",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 82,
    "item_name": "Till",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 83,
    "item_name": "Khas Khas",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 84,
    "item_name": "Tugar Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 85,
    "item_name": "Kova",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 86,
    "item_name": "Turmeric Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 87,
    "item_name": "Kismis",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 88,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 89,
    "item_name": "Lavang",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 90,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 91,
    "item_name": "Local Channa",
    "default_unit": "kg"
  },
  {
    "template_name": "SI- MEALS ",
    "row_no": 92,
    "item_name": "White Batana",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 1,
    "item_name": "Aromatic Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 2,
    "item_name": "Soya Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 3,
    "item_name": "Biryani Leaf",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 4,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 5,
    "item_name": "Baby Corn",
    "default_unit": "tin"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 6,
    "item_name": "Salt Big",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 7,
    "item_name": "Biryani Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 8,
    "item_name": "Star Pool",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 9,
    "item_name": "Brown Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 10,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 11,
    "item_name": "Butter 500 Gm",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 12,
    "item_name": "Sweet Corn Pkt",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 13,
    "item_name": "Chat Masala",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 14,
    "item_name": "Sweetcorn Tin",
    "default_unit": "tin"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 15,
    "item_name": "Chilly Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 16,
    "item_name": "Tamarind",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 17,
    "item_name": "Coal",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 18,
    "item_name": "Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 19,
    "item_name": "Coconut Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 20,
    "item_name": "Tarbuj",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 21,
    "item_name": "Corn Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 22,
    "item_name": "Till",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 23,
    "item_name": "Cream",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 24,
    "item_name": "Tomato Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 25,
    "item_name": "Dalchina",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 26,
    "item_name": "Tugar Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 27,
    "item_name": "Dalda",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 28,
    "item_name": "Turmeric Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 29,
    "item_name": "Dhaniya",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 30,
    "item_name": "Viniger",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 31,
    "item_name": "Dhaniya Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 32,
    "item_name": "Mayonnaise",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 33,
    "item_name": "Dry Coconut",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 34,
    "item_name": "White Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 35,
    "item_name": "Elaichi",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 36,
    "item_name": "Chicken Big",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 37,
    "item_name": "Frozen Green Peas",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 38,
    "item_name": "Chicken Small",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 39,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 40,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 41,
    "item_name": "Bharath Gas",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 42,
    "item_name": "Eggs",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 43,
    "item_name": "Ghee",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 44,
    "item_name": "Fish",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 45,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 46,
    "item_name": "Mutton Keema",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 47,
    "item_name": "Green Chilly Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 48,
    "item_name": "Mutton",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 49,
    "item_name": "Jajikaya",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 50,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 51,
    "item_name": "Japathri",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 52,
    "item_name": "Prawns",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 53,
    "item_name": "Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 54,
    "item_name": "Jeera Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 55,
    "item_name": "Kabuli Channa",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 56,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 57,
    "item_name": "Kaju Nuka",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 58,
    "item_name": "Kashmiri Mirchi Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 59,
    "item_name": "VEGETABLES",
    "default_unit": ""
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 60,
    "item_name": "Kasturi Methi",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 61,
    "item_name": "BEANS",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 62,
    "item_name": "Kewara Water",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 63,
    "item_name": "CABBAGE",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 64,
    "item_name": "Khas Khas",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 65,
    "item_name": "CAPSICUM",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 66,
    "item_name": "Lavang",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 67,
    "item_name": "CARROT",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 68,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 69,
    "item_name": "CAULIFLOWER",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 70,
    "item_name": "Masoor Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 71,
    "item_name": "CUCUMBER",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 72,
    "item_name": "Mushroom",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 73,
    "item_name": "KOTHMIR",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 74,
    "item_name": "Milk Maid",
    "default_unit": "tin"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 75,
    "item_name": "GREEN CHILLI",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 76,
    "item_name": "Mustard Oil",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 77,
    "item_name": "LEMON",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 78,
    "item_name": "Noodles",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 79,
    "item_name": "PALAK",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 80,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 81,
    "item_name": "TOMATO",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 82,
    "item_name": "Veg Oyster Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 83,
    "item_name": "PUDINA",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 84,
    "item_name": "Palm Oil",
    "default_unit": "L"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 85,
    "item_name": "Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 86,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 87,
    "item_name": "Pally Chutney",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 88,
    "item_name": "Red Chilly",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 89,
    "item_name": "Red Chilly Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 90,
    "item_name": "Rose Water",
    "default_unit": "bottle"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 91,
    "item_name": "Sajeera",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 92,
    "item_name": "DISPOSABLES",
    "default_unit": ""
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 93,
    "item_name": "3cp",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 94,
    "item_name": "5cp",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 95,
    "item_name": "8cp",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 96,
    "item_name": "Box Container 500 Ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 97,
    "item_name": "Box Container 750ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 98,
    "item_name": "Box Container 1000 Ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 99,
    "item_name": "Chinese Container 750ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 100,
    "item_name": "Chinese Container 1000ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 101,
    "item_name": "Box Container 1500ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 102,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 103,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 104,
    "item_name": "Compostable Grocery Bags 13*16",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 105,
    "item_name": "Compostable Grocery Bags 16*20",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 106,
    "item_name": "Parcel Covers 5*8",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 107,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 108,
    "item_name": "Silver Pouch 6*8",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 109,
    "item_name": "Silver Pouch 8*10",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 110,
    "item_name": "Silver Pouch 7*9",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 111,
    "item_name": "Butter Covers",
    "default_unit": "pkt"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 112,
    "item_name": "White Tape",
    "default_unit": "pcs"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 113,
    "item_name": "STALL",
    "default_unit": ""
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 114,
    "item_name": "Broken Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 115,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 116,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 117,
    "item_name": "LEMONS",
    "default_unit": "kg"
  },
  {
    "template_name": "NORTH INDIAN",
    "row_no": 118,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 1,
    "item_name": "Green Batana Raw",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 2,
    "item_name": "Amchoor Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 3,
    "item_name": "Tamarind",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 4,
    "item_name": "Amchur Raw",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 5,
    "item_name": "Kurbani",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 6,
    "item_name": "Homa",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 7,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 8,
    "item_name": "Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 9,
    "item_name": "Mustard Oil",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 10,
    "item_name": "Atukulu",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 11,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 12,
    "item_name": "Badam",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 13,
    "item_name": "Round Pally",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 14,
    "item_name": "Baking Powder",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 15,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 16,
    "item_name": "Biryani Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 17,
    "item_name": "Pav",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 18,
    "item_name": "Black Salt",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 19,
    "item_name": "Pavbaji Masala",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 20,
    "item_name": "Butter 500 Gm",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 21,
    "item_name": "Black Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 22,
    "item_name": "Tea Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 23,
    "item_name": "Mango Pickle",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 24,
    "item_name": "Channa Atta",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 25,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 26,
    "item_name": "Channa Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 27,
    "item_name": "Sabudana",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 28,
    "item_name": "Chat Masala",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 29,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 30,
    "item_name": "Cheese 500g",
    "default_unit": "block"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 31,
    "item_name": "Somp",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 32,
    "item_name": "Chilly Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 33,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 34,
    "item_name": "Chole Masala",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 35,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 36,
    "item_name": "Corn Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 37,
    "item_name": "Soda 750 Ml",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 38,
    "item_name": "Dalda",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 39,
    "item_name": "Tomato Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 40,
    "item_name": "Dhaniya Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 41,
    "item_name": "Turmeric Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 42,
    "item_name": "Dhaniya",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 43,
    "item_name": "Upma Ravva",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 44,
    "item_name": "Elaichi",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 45,
    "item_name": "Urad Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 46,
    "item_name": "Garam Masala",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 47,
    "item_name": "Vanila Spoung",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 48,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 49,
    "item_name": "White Batana",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 50,
    "item_name": "Ghee",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 51,
    "item_name": "White Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 52,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 53,
    "item_name": "Lavang",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 54,
    "item_name": "Jal Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 55,
    "item_name": "Cauliflower /फू ल गोभी",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 56,
    "item_name": "Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 57,
    "item_name": "Cabbage / प􀈅ा गोभी",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 58,
    "item_name": "Kabuli Channa",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 59,
    "item_name": "Cucumber / खीरा",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 60,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 61,
    "item_name": "Beans / बी􀉌",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 62,
    "item_name": "Black Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 63,
    "item_name": "Carrot / गाजर",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 64,
    "item_name": "Kashmiri Mirchi Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 65,
    "item_name": "Shimla Mirch / िशमला िमच􀅊",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 66,
    "item_name": "Kasturi Methi",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 67,
    "item_name": "Mirchi / हरा िमच􀅎",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 68,
    "item_name": "Kismis",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 69,
    "item_name": "Beet root / चुकं दर",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 70,
    "item_name": "Kitchen King Masala",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 71,
    "item_name": "Lemon /नीबं ू",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 72,
    "item_name": "Tomato / टमाटर",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 73,
    "item_name": "Lemon Salt",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 74,
    "item_name": "Hara Daniya / हारा दािनया",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 75,
    "item_name": "Hing",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 76,
    "item_name": "Mint / पुदीना",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 77,
    "item_name": "Local Channa",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 78,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 79,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 80,
    "item_name": "Box Container 250ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 81,
    "item_name": "Moong Dal",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 82,
    "item_name": "Box Container 500 Ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 83,
    "item_name": "Mote",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 84,
    "item_name": "3cp",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 85,
    "item_name": "Murmura",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 86,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 87,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 88,
    "item_name": "Silver Pouch 6*8",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 89,
    "item_name": "Anar",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 90,
    "item_name": "Butter Covers",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 91,
    "item_name": "Cherries",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 92,
    "item_name": "Rectrangle Box 500ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 93,
    "item_name": "Cream",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 94,
    "item_name": "Silver Container Big",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 95,
    "item_name": "Custod Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 96,
    "item_name": "Dosa Broom",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 97,
    "item_name": "Mineral water 500ml",
    "default_unit": "box"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 98,
    "item_name": "compostable 11*14",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 99,
    "item_name": "Wooden Spoons Big",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 100,
    "item_name": "compostable13*16",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 101,
    "item_name": "Wooden Spoons Small",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 102,
    "item_name": "Garbage Bags",
    "default_unit": "kg"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 103,
    "item_name": "Wooden Fork",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 104,
    "item_name": "Paper Rolls",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 105,
    "item_name": "Scrubber Steel",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 106,
    "item_name": "Scrubber Ordinary",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 107,
    "item_name": "Scrubber Plastic",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 108,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 109,
    "item_name": "Napkins",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 110,
    "item_name": "Time:",
    "default_unit": ""
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 111,
    "item_name": "Ice Cream Cone",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 112,
    "item_name": "Softy Chocolate Milk",
    "default_unit": "L"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 113,
    "item_name": "Softy Vanilla Milk",
    "default_unit": "L"
  },
  {
    "template_name": "CHAT, JP Disposal, Softy.",
    "row_no": 114,
    "item_name": "Chocolate Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 1,
    "item_name": "Time:",
    "default_unit": ""
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 2,
    "item_name": "Spring Rolls",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 3,
    "item_name": "Aromatic Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 4,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 5,
    "item_name": "Biryani Rice",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 6,
    "item_name": "Tomato Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 7,
    "item_name": "Black Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 8,
    "item_name": "Veg Momos",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 9,
    "item_name": "Corn Flour",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 10,
    "item_name": "Viniger",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 11,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 12,
    "item_name": "White Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 13,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 14,
    "item_name": "Beans / बी􀉌",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 15,
    "item_name": "Bharath Gas",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 16,
    "item_name": "Cabbage / प􀈅ा गोभी",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 17,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 18,
    "item_name": "Shimla Mirch / िशमला िमच􀅊",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 19,
    "item_name": "Green Chilly Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 20,
    "item_name": "Carrot / गाजर",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 21,
    "item_name": "Honey",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 22,
    "item_name": "Cauliflower /फू ल गोभी",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 23,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 24,
    "item_name": "Mirchi / हरा िमच􀅎",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 25,
    "item_name": "Kashmiri Mirchi Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 26,
    "item_name": "Hara Daniya / हारा दािनया",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 27,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 28,
    "item_name": "Pudina / पुदीना",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 29,
    "item_name": "Noodles",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 30,
    "item_name": "Mirchi / हरा िमच􀅎",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 31,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 32,
    "item_name": "Hara Daniya / हारा दािनया",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 33,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 34,
    "item_name": "Pudina / पुदीना",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 35,
    "item_name": "Paneer Momos",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 36,
    "item_name": "Box Container 400ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 37,
    "item_name": "Red Chilly Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 38,
    "item_name": "Rectrangle Box 500ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 39,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 40,
    "item_name": "Tomato Ketchup",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 41,
    "item_name": "Schezwan Chutney",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 42,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 43,
    "item_name": "Schezwan Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 44,
    "item_name": "Veg Oyster Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 45,
    "item_name": "Soya Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 46,
    "item_name": "Sweet Corn Pkt",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 47,
    "item_name": "Chinese Container 500ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 48,
    "item_name": "Chinese Container 750ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 49,
    "item_name": "Time:",
    "default_unit": ""
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 50,
    "item_name": "Butter 500 Gm",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 51,
    "item_name": "CAULIFLOWER",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 52,
    "item_name": "Ghee",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 53,
    "item_name": "CAPSICUM",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 54,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 55,
    "item_name": "CARROT",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 56,
    "item_name": "Putani",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 57,
    "item_name": "BEANS",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 58,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 59,
    "item_name": "TOMATO",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 60,
    "item_name": "Nutella Chocolate",
    "default_unit": "jar"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 61,
    "item_name": "Green Batana Raw",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 62,
    "item_name": "Kashmiri Mirchi Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 63,
    "item_name": "Tomato Ketchup",
    "default_unit": "Bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 64,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 65,
    "item_name": "Parcel Covers 4*6",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 66,
    "item_name": "Pally Chutney",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 67,
    "item_name": "Parcel Covers 6*9",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 68,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 69,
    "item_name": "Rectrangle Box 500ml",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 70,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 71,
    "item_name": "Silver Pouch 6*8",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 72,
    "item_name": "Custic Soda",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 73,
    "item_name": "Sajeera",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 74,
    "item_name": "Green chilli",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 75,
    "item_name": "Cheese 500g",
    "default_unit": "Block"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 76,
    "item_name": "Kothmir",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 77,
    "item_name": "Elaichi",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 78,
    "item_name": "Pudina",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 79,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 80,
    "item_name": "Coconut",
    "default_unit": "pcs"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 81,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 82,
    "item_name": "Mayonnaise",
    "default_unit": "pkt"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 83,
    "item_name": "Jeera",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 84,
    "item_name": "Viniger",
    "default_unit": "bottle"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 85,
    "item_name": "Lavang",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 86,
    "item_name": "Dalchina",
    "default_unit": "kg"
  },
  {
    "template_name": "CHINESE & DOSA",
    "row_no": 87,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 1,
    "item_name": "Time:",
    "default_unit": ""
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 2,
    "item_name": "Badam",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 3,
    "item_name": "Green Mojito Mint",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 4,
    "item_name": "Sabjee Binge",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 5,
    "item_name": "Mango Crush",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 6,
    "item_name": "Blue Lagoon",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 7,
    "item_name": "Oreo Biscuits",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 8,
    "item_name": "Brownie",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 9,
    "item_name": "Pineapple Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 10,
    "item_name": "Caramil Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 11,
    "item_name": "Rose Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 12,
    "item_name": "Chocolate Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 13,
    "item_name": "Semiya",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 14,
    "item_name": "Chocolate Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 15,
    "item_name": "Soda 750 Ml",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 16,
    "item_name": "Coffee Nescafe",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 17,
    "item_name": "Sprite 750 Ml",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 18,
    "item_name": "Delight Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 19,
    "item_name": "Kunafa",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 20,
    "item_name": "Ginger Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 21,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 22,
    "item_name": "Jeera Masala Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 23,
    "item_name": "Vanilla Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 24,
    "item_name": "Jeera Powder",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 25,
    "item_name": "Water Melon Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 26,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 27,
    "item_name": "Pizza Box Big & Small",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 28,
    "item_name": "Kala Khatta Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 29,
    "item_name": "Sandwich Box",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 30,
    "item_name": "Lemon",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 31,
    "item_name": "Burger Box",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 32,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 33,
    "item_name": "Tomato Ketchup",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 34,
    "item_name": "Gold Milk",
    "default_unit": "L"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 35,
    "item_name": "Silver Container Big",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 36,
    "item_name": "Kit Kat",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 37,
    "item_name": "Banana",
    "default_unit": "dozen"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 38,
    "item_name": "Gulkanda",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 39,
    "item_name": "Mango Ice Crem",
    "default_unit": "bulk"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 40,
    "item_name": "Bis Coffe Paste",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 41,
    "item_name": "Mango Ice Crem",
    "default_unit": "bulk"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 42,
    "item_name": "Bis Coffe Biscuits",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 43,
    "item_name": "Saffron",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 44,
    "item_name": "Original Mint Mojitho",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 45,
    "item_name": "Kova",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 46,
    "item_name": "Butter Scotch Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 47,
    "item_name": "Cling Wrap",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 48,
    "item_name": "Hezelnuts",
    "default_unit": "jar"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 49,
    "item_name": "Silver Foil",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 50,
    "item_name": "Fruit Cocktail",
    "default_unit": "tin"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 51,
    "item_name": "Vanila Spoung",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 52,
    "item_name": "Time:",
    "default_unit": ""
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 53,
    "item_name": "Baby Corn",
    "default_unit": "tin"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 54,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 55,
    "item_name": "Black Olives",
    "default_unit": "bottle"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 56,
    "item_name": "Sandwich Bread",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 57,
    "item_name": "Black Pepper",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 58,
    "item_name": "Sunflower Oil",
    "default_unit": "L"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 59,
    "item_name": "Bread Crumbs",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 60,
    "item_name": "Sweet Corn Pkt",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 61,
    "item_name": "Burger Bun",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 62,
    "item_name": "Cream",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 63,
    "item_name": "Butter 500 Gm",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 64,
    "item_name": "Cheese Slice",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 65,
    "item_name": "VEGETABLES",
    "default_unit": ""
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 66,
    "item_name": "Chilly Flakes Kg",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 67,
    "item_name": "Beetroot",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 68,
    "item_name": "Dry Yeast",
    "default_unit": "Kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 69,
    "item_name": "Beans",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 70,
    "item_name": "French Fries",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 71,
    "item_name": "Capsicum",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 72,
    "item_name": "Garlic",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 73,
    "item_name": "Carrot",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 74,
    "item_name": "Garlic Bread",
    "default_unit": "pcs"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 75,
    "item_name": "Green Chilli",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 76,
    "item_name": "Ginger",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 77,
    "item_name": "Kothmir",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 78,
    "item_name": "Jalpeno",
    "default_unit": "jar"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 79,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 80,
    "item_name": "Maida",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 81,
    "item_name": "Pudina",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 82,
    "item_name": "Mayonnaise",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 83,
    "item_name": "Kheera/Dosakaya",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 84,
    "item_name": "Mozzarella Cheese",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 85,
    "item_name": "Faluda Glass",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 86,
    "item_name": "Oregano 500gm",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 87,
    "item_name": "Straws Big",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 88,
    "item_name": "Paneer",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 89,
    "item_name": "Straws Small",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 90,
    "item_name": "Pasta",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 91,
    "item_name": "Tomato",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 92,
    "item_name": "Peri Peri",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 93,
    "item_name": "Potato",
    "default_unit": "kg"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 94,
    "item_name": "Pizza Sauce",
    "default_unit": "pkt"
  },
  {
    "template_name": "MOCKTAILS & Continental",
    "row_no": 95,
    "item_name": "Puff Roti",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 1,
    "item_name": "Mops",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 2,
    "item_name": "Ramjadu",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 3,
    "item_name": "THUMS UP 250ml",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 4,
    "item_name": "Sponge",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 5,
    "item_name": "SPRITE 250ml",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 6,
    "item_name": "Hand Wash",
    "default_unit": "L"
  },
  {
    "template_name": " Restaurant",
    "row_no": 7,
    "item_name": "Paper Rolls",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 8,
    "item_name": "Harpic",
    "default_unit": "L"
  },
  {
    "template_name": " Restaurant",
    "row_no": 9,
    "item_name": "Napkins",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 10,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": " Restaurant",
    "row_no": 11,
    "item_name": "Mineral water 1l",
    "default_unit": "Case"
  },
  {
    "template_name": " Restaurant",
    "row_no": 12,
    "item_name": "Lemons",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 13,
    "item_name": "Cherries",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 14,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 15,
    "item_name": "Somp",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 16,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 17,
    "item_name": "Somp White",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 18,
    "item_name": "Tata Salt",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 19,
    "item_name": "Tooth Pick",
    "default_unit": "box"
  },
  {
    "template_name": " Restaurant",
    "row_no": 20,
    "item_name": "Floor Cleaner",
    "default_unit": "L"
  },
  {
    "template_name": " Restaurant",
    "row_no": 21,
    "item_name": "Odonil",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 22,
    "item_name": "Tea Powder",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 23,
    "item_name": "Lamsa",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 24,
    "item_name": "Coffee Powder",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 25,
    "item_name": "Tea Cups Small",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 26,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": " Restaurant",
    "row_no": 27,
    "item_name": "Cleaning Coth",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 28,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 29,
    "item_name": "Horlicks",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 30,
    "item_name": "Boost",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 31,
    "item_name": "Green Mojito Mint",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 32,
    "item_name": "FALUDA",
    "default_unit": ""
  },
  {
    "template_name": " Restaurant",
    "row_no": 33,
    "item_name": "Ginger Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 34,
    "item_name": "Semiya",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 35,
    "item_name": "Blue Lagoon",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 36,
    "item_name": "Kaju 2 Pieces",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 37,
    "item_name": "Original Mint Mojitho",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 38,
    "item_name": "Badam",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 39,
    "item_name": "Kala Khatta Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 40,
    "item_name": "Pista",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 41,
    "item_name": "Water Melon Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 42,
    "item_name": "Sabjee Binge",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 43,
    "item_name": "Rose Syrup",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 44,
    "item_name": "Vanilla Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": " Restaurant",
    "row_no": 45,
    "item_name": "Chocolate Sauce",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 46,
    "item_name": "Butter Scotch Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": " Restaurant",
    "row_no": 47,
    "item_name": "Bis Coffe Biscuits",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 48,
    "item_name": "Delight Ice Cream",
    "default_unit": "bulk"
  },
  {
    "template_name": " Restaurant",
    "row_no": 49,
    "item_name": "Bis Coffe Paste",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 50,
    "item_name": "Brownie",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 51,
    "item_name": "Oreo Biscuits",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 52,
    "item_name": "Kunafa",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 53,
    "item_name": "Kit Kat",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 54,
    "item_name": "Straws Small",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 55,
    "item_name": "Gulkanda",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 56,
    "item_name": "Faluda Glass",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 57,
    "item_name": "Milk",
    "default_unit": "L"
  },
  {
    "template_name": " Restaurant",
    "row_no": 58,
    "item_name": "Silver Foil",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 59,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 60,
    "item_name": "Dust Bin Covers",
    "default_unit": "pkt"
  },
  {
    "template_name": " Restaurant",
    "row_no": 61,
    "item_name": "Coffee Powder",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 62,
    "item_name": "White Tape",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 63,
    "item_name": "Sprite 750 Ml",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 64,
    "item_name": "MANGO",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 65,
    "item_name": "Soda 750 Ml",
    "default_unit": "bottle"
  },
  {
    "template_name": " Restaurant",
    "row_no": 66,
    "item_name": "Banana",
    "default_unit": "dozen"
  },
  {
    "template_name": " Restaurant",
    "row_no": 67,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 68,
    "item_name": "Anar",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 69,
    "item_name": "LEMONS",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 70,
    "item_name": "Apples",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 71,
    "item_name": "Pineapple",
    "default_unit": "pcs"
  },
  {
    "template_name": " Restaurant",
    "row_no": 72,
    "item_name": "Orange",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 73,
    "item_name": "Mosambi",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 74,
    "item_name": "Watermelon",
    "default_unit": "kg"
  },
  {
    "template_name": " Restaurant",
    "row_no": 75,
    "item_name": "Muskmelon",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 1,
    "item_name": "Dust Bin Covers",
    "default_unit": "pkt"
  },
  {
    "template_name": "Room service",
    "row_no": 2,
    "item_name": "Bedsheet",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 3,
    "item_name": "Good Night Machine",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 4,
    "item_name": "Towels",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 5,
    "item_name": "Good Night Refill",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 6,
    "item_name": "Pillow Covers",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 7,
    "item_name": "Soaps",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 8,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 9,
    "item_name": "Mops",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 10,
    "item_name": "LEMON",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 11,
    "item_name": "Ramjadu",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 12,
    "item_name": "Pineapple",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 13,
    "item_name": "Napkins",
    "default_unit": "pkt"
  },
  {
    "template_name": "Room service",
    "row_no": 14,
    "item_name": "Muskmelon",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 15,
    "item_name": "Room Freshner",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 16,
    "item_name": "Watermelon",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 17,
    "item_name": "Shampoo",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 18,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 19,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": "Room service",
    "row_no": 20,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 21,
    "item_name": "Sponge",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 22,
    "item_name": "Shower Gel",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 23,
    "item_name": "Harpic",
    "default_unit": "L"
  },
  {
    "template_name": "Room service",
    "row_no": 24,
    "item_name": "Dental Kit",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 25,
    "item_name": "Kissan Jam",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 26,
    "item_name": "Mineral water 500ml",
    "default_unit": "case"
  },
  {
    "template_name": "Room service",
    "row_no": 27,
    "item_name": "Corn Flakes",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 28,
    "item_name": "Shampoo Gel",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 29,
    "item_name": "Mineral water 1l",
    "default_unit": "case"
  },
  {
    "template_name": "Room service",
    "row_no": 30,
    "item_name": "Floor Cleaner",
    "default_unit": "L"
  },
  {
    "template_name": "Room service",
    "row_no": 31,
    "item_name": "Dust Bin Covers",
    "default_unit": "pkt"
  },
  {
    "template_name": "Room service",
    "row_no": 32,
    "item_name": "Bedsheet",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 33,
    "item_name": "Good Night Machine",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 34,
    "item_name": "Towels",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 35,
    "item_name": "Good Night Refill",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 36,
    "item_name": "Pillow Covers",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 37,
    "item_name": "Soaps",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 38,
    "item_name": "Onion",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 39,
    "item_name": "Mops",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 40,
    "item_name": "LEMON",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 41,
    "item_name": "Ramjadu",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 42,
    "item_name": "Pineapple",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 43,
    "item_name": "Napkins",
    "default_unit": "pkt"
  },
  {
    "template_name": "Room service",
    "row_no": 44,
    "item_name": "Muskmelon",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 45,
    "item_name": "Room Freshner",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 46,
    "item_name": "Watermelon",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 47,
    "item_name": "Shampoo",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 48,
    "item_name": "Curd",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 49,
    "item_name": "Soap Oil",
    "default_unit": "L"
  },
  {
    "template_name": "Room service",
    "row_no": 50,
    "item_name": "Sugar",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 51,
    "item_name": "Sponge",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 52,
    "item_name": "Shower Gel",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 53,
    "item_name": "Harpic",
    "default_unit": "L"
  },
  {
    "template_name": "Room service",
    "row_no": 54,
    "item_name": "Dental Kit",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 55,
    "item_name": "Kissan Jam",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 56,
    "item_name": "Mineral water 500ml",
    "default_unit": "box"
  },
  {
    "template_name": "Room service",
    "row_no": 57,
    "item_name": "Corn Flakes",
    "default_unit": "kg"
  },
  {
    "template_name": "Room service",
    "row_no": 58,
    "item_name": "Shampoo Gel",
    "default_unit": "pcs"
  },
  {
    "template_name": "Room service",
    "row_no": 59,
    "item_name": "Mineral water 1l",
    "default_unit": "box"
  },
  {
    "template_name": "Room service",
    "row_no": 60,
    "item_name": "Floor Cleaner",
    "default_unit": "L"
  }
];
  
  // Chunk the inserts to avoid parameter limits (PostgreSQL has a max limit per query)
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await knex('indent_templates').insert(chunk);
  }
};

exports.down = async function (knex) {
  await knex('indent_templates').del();
  // Not restoring the 47 items for down migration since they were fundamentally incomplete.
};