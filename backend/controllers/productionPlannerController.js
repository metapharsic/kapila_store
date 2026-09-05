const db = require("../db");

// GET /api/production-plans
async function listPlans(req, res, next) {
  try {
    const { date, status, dept } = req.query;

    const qb = db("production_plans as p")
      .join("recipes as r", "p.recipe_id", "r.id")
      .select(
        "p.id",
        "p.dept",
        "p.recipe_id",
        "p.planned_plates",
        "p.plates_sold",
        "p.plates_wasted",
        "p.waste_percentage",
        "p.waste_reason",
        "p.status",
        "p.created_at",
        db.raw("p.planned_date::text as planned_date"),
        "r.name as recipe_name",
        "r.category as recipe_category",
        "r.instructions as recipe_instructions",
        "r.base_plates as recipe_base_plates"
      )
      .orderBy("p.planned_date", "desc")
      .orderBy("p.id", "desc");

    if (date) {
      qb.where("p.planned_date", date);
    }
    if (status) {
      qb.where("p.status", status);
    }
    if (dept) {
      qb.where("p.dept", dept);
    }

    const plans = await qb;

    // Attach items for each production plan
    const withItems = await Promise.all(
      plans.map(async (plan) => {
        const items = await db("production_plan_items")
          .where("production_plan_id", plan.id)
          .select("*")
          .orderBy("id", "asc");

        let formattedDate = plan.planned_date;
        if (plan.planned_date instanceof Date) {
          const y = plan.planned_date.getFullYear();
          const m = String(plan.planned_date.getMonth() + 1).padStart(2, '0');
          const d = String(plan.planned_date.getDate()).padStart(2, '0');
          formattedDate = `${y}-${m}-${d}`;
        } else if (typeof plan.planned_date === 'string') {
          formattedDate = plan.planned_date.slice(0, 10);
        }

        return { ...plan, planned_date: formattedDate, items };
      })
    );

    res.json({ success: true, data: withItems });
  } catch (err) {
    next(err);
  }
}

// POST /api/production-plans
async function createPlan(req, res, next) {
  try {
    const { recipe_id, planned_plates, planned_date, dept } = req.body;

    if (!recipe_id) {
      return res.status(400).json({ success: false, error: "Recipe reference is required." });
    }
    if (!planned_plates || parseInt(planned_plates) <= 0) {
      return res.status(400).json({ success: false, error: "Planned plate count must be greater than 0." });
    }
    if (!planned_date) {
      return res.status(400).json({ success: false, error: "Planned date is required." });
    }

    // Fetch recipe details and its ingredients
    const recipe = await db("recipes").where("id", recipe_id).first();
    if (!recipe) {
      return res.status(404).json({ success: false, error: "Recipe not found." });
    }

    const recipeItems = await db("recipe_items").where("recipe_id", recipe_id).select("*");
    if (!recipeItems.length) {
      return res.status(400).json({ success: false, error: "Cannot plan production for a recipe with no ingredients." });
    }

    const basePlates = recipe.base_plates || 100;
    const platesToPlan = parseInt(planned_plates);
    const scaleFactor = platesToPlan / basePlates;

    // Calculate scaled items
    const scaledItems = recipeItems.map((item) => ({
      item_name: item.item_name,
      planned_qty: parseFloat((item.base_qty * scaleFactor).toFixed(3)),
      unit: item.unit,
    }));

    const resultPlan = await db.transaction(async (trx) => {
      // Insert production plan
      const [planRow] = await trx("production_plans")
        .insert({
          recipe_id: parseInt(recipe_id),
          planned_plates: platesToPlan,
          planned_date,
          dept: dept ? String(dept).trim() : null,
          status: "Planned",
        })
        .returning("*");

      // Insert production plan items
      await trx("production_plan_items").insert(
        scaledItems.map((item) => ({
          ...item,
          production_plan_id: planRow.id,
        }))
      );

      const items = await trx("production_plan_items")
        .where("production_plan_id", planRow.id)
        .select("*");

      return { ...planRow, planned_date: planned_date, recipe_name: recipe.name, items };
    });

    res.status(201).json({ success: true, data: resultPlan });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/production-plans/:id
async function completePlan(req, res, next) {
  try {
    const { id } = req.params;
    const { plates_sold, plates_wasted, waste_reason } = req.body;

    const plan = await db("production_plans")
      .select("*", db.raw("planned_date::text as planned_date_str"))
      .where("id", id)
      .first();
    if (!plan) {
      return res.status(404).json({ success: false, error: "Production plan not found." });
    }

    if (plan.status === "Completed") {
      return res.status(400).json({ success: false, error: "Production plan is already completed." });
    }

    const soldCount = parseInt(plates_sold ?? 0);
    let wastedCount = plates_wasted !== undefined ? parseInt(plates_wasted) : (plan.planned_plates - soldCount);
    wastedCount = Math.max(0, wastedCount); // Ensure non-negative

    const wastePercentage = parseFloat(((wastedCount / plan.planned_plates) * 100).toFixed(2));
    const wasteRatio = wastedCount / plan.planned_plates;

    const completedPlan = await db.transaction(async (trx) => {
      // Update plan details
      const [updatedPlan] = await trx("production_plans")
        .where("id", id)
        .update({
          plates_sold: soldCount,
          plates_wasted: wastedCount,
          waste_percentage: wastePercentage,
          waste_reason: waste_reason || null,
          status: "Completed",
        })
        .returning("*");

      // Get plan items and update estimated waste quantity
      const items = await trx("production_plan_items").where("production_plan_id", id).select("*");
      for (const item of items) {
        const estimatedWaste = parseFloat((item.planned_qty * wasteRatio).toFixed(3));
        await trx("production_plan_items")
          .where("id", item.id)
          .update({ wasted_qty: estimatedWaste });
      }

      const updatedItems = await trx("production_plan_items")
        .where("production_plan_id", id)
        .select("*");

      return { ...updatedPlan, items: updatedItems };
    });

    completedPlan.planned_date = plan.planned_date_str;

    res.json({ success: true, data: completedPlan });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/production-plans/:id
async function removePlan(req, res, next) {
  try {
    const { id } = req.params;
    const plan = await db("production_plans").where("id", id).first();
    if (!plan) {
      return res.status(404).json({ success: false, error: "Production plan not found." });
    }

    await db("production_plans").where("id", id).del();
    res.json({ success: true, message: "Production plan deleted successfully." });
  } catch (err) {
    next(err);
  }
}

// GET /api/production-plans/analytics
async function getAnalytics(req, res, next) {
  try {
    // 1. Per-recipe waste trends (recent completed plans grouped by recipe)
    const recipeTrends = await db("production_plans as p")
      .join("recipes as r", "p.recipe_id", "r.id")
      .where("p.status", "Completed")
      .select(
        "r.id as recipe_id",
        "r.name as recipe_name",
        "r.category as recipe_category",
        db.raw("count(p.id) as total_plans"),
        db.raw("round(avg(p.waste_percentage)::numeric, 2) as avg_waste_percentage"),
        db.raw("sum(p.planned_plates) as total_planned_plates"),
        db.raw("sum(p.plates_wasted) as total_plates_wasted")
      )
      .groupBy("r.id", "r.name", "r.category")
      .orderBy("avg_waste_percentage", "desc");

    // 2. Total waste % per day
    const dailyWaste = await db("production_plans")
      .where("status", "Completed")
      .select(db.raw("planned_date::text as planned_date"))
      .select(
        db.raw("round(avg(waste_percentage)::numeric, 2) as avg_waste_percentage"),
        db.raw("sum(planned_plates) as total_planned"),
        db.raw("sum(plates_wasted) as total_wasted")
      )
      .groupBy("planned_date")
      .orderBy("planned_date", "desc")
      .limit(30);

    // 3. Most wasted dishes (recipes with highest total waste plates)
    const mostWasted = await db("production_plans as p")
      .join("recipes as r", "p.recipe_id", "r.id")
      .where("p.status", "Completed")
      .select(
        "r.id as recipe_id",
        "r.name as recipe_name",
        "r.category as recipe_category",
        db.raw("sum(p.plates_wasted) as total_plates_wasted"),
        db.raw("round(avg(p.waste_percentage)::numeric, 2) as avg_waste_percentage")
      )
      .groupBy("r.id", "r.name", "r.category")
      .orderBy("total_plates_wasted", "desc")
      .limit(10);

    // 4. Cluster waste reasons using Gemini AI
    const reasonsRows = await db("production_plans")
      .whereNotNull("waste_reason")
      .whereNot("waste_reason", "")
      .select("waste_reason")
      .orderBy("created_at", "desc")
      .limit(100);
    const reasons = reasonsRows.map(r => r.waste_reason);
    
    const { clusterWasteReasons } = require("../services/localAI");
    const wasteClusters = await clusterWasteReasons(reasons);

    res.json({
      success: true,
      data: {
        recipeTrends,
        dailyWaste,
        mostWasted,
        wasteClusters
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPlans,
  createPlan,
  completePlan,
  removePlan,
  getAnalytics,
};
