const request = require("supertest");
const express = require("express");
const recipeController = require("./recipeController");
const authorize = require("../middleware/authorize");
const db = require("../db");

// Mock dependencies
jest.mock("../db");
jest.mock("../middleware/authorize", () => ({
  requirePermission: () => (req, res, next) => next(),
}));

const app = express();
app.use(express.json());
app.get("/recipes", recipeController.listRecipes);

describe("Recipe Controller Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("listRecipes should populate items correctly", async () => {
    const mockRecipes = [
      { id: 1, name: "Test Dish", category: "TIFFINS", base_plates: 100 },
    ];
    const mockItems = [
      { id: 1, recipe_id: 1, item_name: "Rice", base_qty: 10, unit: "kg" },
      { id: 2, recipe_id: 1, item_name: "Dal", base_qty: 5, unit: "kg" },
    ];

    db.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(mockRecipes),
      whereIn: jest.fn().mockResolvedValue(mockItems),
    });

    const res = await request(app).get("/recipes");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].items).toBeDefined();
    expect(res.body.data[0].items.length).toBe(2);
    expect(res.body.data[0].items[0].item_name).toBe("Rice");
  });

  test("listRecipes should not fail when recipe has no items", async () => {
    const mockRecipes = [
      { id: 2, name: "Empty Dish", category: "TIFFINS", base_plates: 100 },
    ];

    db.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(mockRecipes),
      whereIn: jest.fn().mockResolvedValue([]), // No items
    });

    const res = await request(app).get("/recipes");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].items).toBeDefined();
    expect(res.body.data[0].items.length).toBe(0); // Should be empty array
  });
});
