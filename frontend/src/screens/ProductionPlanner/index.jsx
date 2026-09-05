import { useEffect, useMemo, useState } from "react";
import { 
  BookOpen, Plus, Save, Trash2, Utensils, X, Calendar, 
  ArrowRight, TrendingDown, RefreshCw, CheckCircle2, ChevronRight,
  ClipboardSignature
} from "lucide-react";
import Section from "../../components/Section";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Select from "../../components/Select";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { today } from "../../utils/dates";

const CATEGORIES = ["Starter", "Main Course", "Dessert", "Beverage"];

const blankIngredient = () => ({
  item_name: "",
  base_qty: "",
  base_plates: 100,
  unit: "kg",
});

const toRecipeDraft = (recipe) => ({
  name: recipe?.name || "",
  category: recipe?.category || "Main Course",
  description: recipe?.description || "",
  instructions: recipe?.instructions || "",
  base_plates: recipe?.base_plates || 100,
  items: recipe?.items?.length
    ? recipe.items.map((item) => ({
        item_name: item.item_name || item.name || "",
        base_qty: item.base_qty ?? item.qty ?? "",
        base_plates: item.base_plates || recipe?.base_plates || 100,
        unit: item.unit || "kg",
      }))
    : [blankIngredient()],
});

export default function ProductionPlannerScreen() {
  const { setCurrentScreen, setIndentPreFill, setIndentSmartPreFill, stocks = [] } = useAppContext();
  const { roles } = useAuth();
  const isChef = roles.some((r) => r.key === "chef");
  const [activeTab, setActiveTab] = useState("library"); // "library", "planning", "outcomes", "analytics"
  
  // Recipe Library states
  const [recipesList, setRecipesList] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeModalMode, setRecipeModalMode] = useState("create"); // "create" or "edit"
  const [recipeDraft, setRecipeDraft] = useState(toRecipeDraft());
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Daily Planning states
  const [productionPlans, setProductionPlans] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [scheduleFilterDate, setScheduleFilterDate] = useState(() => today());
  
  // Merged Department states
  const [deptsList, setDeptsList] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  
  // Production input form
  const [planningRecipe, setPlanningRecipe] = useState(null);
  const [plannedPlates, setPlannedPlates] = useState("100");
  const [submittingPlan, setSubmittingPlan] = useState(false);

  // EOD Outcome Modal states
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [outcomePlan, setOutcomePlan] = useState(null);
  const [platesSoldInput, setPlatesSoldInput] = useState("");
  const [platesWastedInput, setPlatesWastedInput] = useState("");
  const [wasteReasonInput, setWasteReasonInput] = useState("");
  const [submittingOutcome, setSubmittingOutcome] = useState(false);

  // Analytics states
  const [analyticsData, setAnalyticsData] = useState({ recipeTrends: [], dailyWaste: [], mostWasted: [] });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recipesRes, plansRes, analyticsRes, deptsRes] = await Promise.all([
        api.recipes.list(),
        api.productionPlans.list(),
        api.productionPlans.analytics(),
        api.departments.list(),
      ]);

      if (recipesRes.success) {
        setRecipesList(recipesRes.data || []);
      }
      if (plansRes.success) {
        setProductionPlans(plansRes.data || []);
      }
      if (analyticsRes.success) {
        setAnalyticsData(analyticsRes.data || { recipeTrends: [], dailyWaste: [], mostWasted: [] });
      }
      if (deptsRes.success && deptsRes.data.length > 0) {
        setDeptsList(deptsRes.data);
        setSelectedDept((prev) => prev || deptsRes.data[0].name);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const triggerMessage = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // Recipe Modal actions
  const openCreateRecipe = () => {
    setRecipeDraft(toRecipeDraft());
    setRecipeModalMode("create");
    setIsRecipeModalOpen(true);
  };

  const openEditRecipe = (recipe, e) => {
    e.stopPropagation();
    setRecipeDraft(toRecipeDraft(recipe));
    setSelectedRecipe(recipe);
    setRecipeModalMode("edit");
    setIsRecipeModalOpen(true);
  };

  const deleteRecipe = async (recipeId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this recipe? This will delete all its ingredients and any associated scheduled plans.")) return;
    try {
      const res = await api.recipes.remove(recipeId);
      if (res.success) {
        triggerMessage("Recipe deleted successfully");
        loadData();
        if (planningRecipe?.id === recipeId) setPlanningRecipe(null);
      }
    } catch (err) {
      setError(err);
    }
  };

  const saveRecipe = async () => {
    if (!recipeDraft.name.trim()) {
      alert("Recipe name is required");
      return;
    }
    const validItems = recipeDraft.items.filter(it => it.item_name && parseFloat(it.base_qty) > 0);
    if (validItems.length === 0) {
      alert("At least one ingredient with quantity greater than 0 is required");
      return;
    }

    setSavingRecipe(true);
    try {
      const payload = {
        name: recipeDraft.name,
        category: recipeDraft.category,
        description: recipeDraft.description,
        instructions: recipeDraft.instructions,
        base_plates: parseInt(recipeDraft.base_plates || 100),
        items: validItems.map(it => ({
          ...it,
          base_plates: parseInt(recipeDraft.base_plates || 100),
        })),
      };

      let res;
      if (recipeModalMode === "create") {
        res = await api.recipes.create(payload);
      } else {
        res = await api.recipes.update(selectedRecipe.id, payload);
      }

      if (res.success) {
        triggerMessage(recipeModalMode === "create" ? "Recipe created successfully" : "Recipe updated successfully");
        setIsRecipeModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingRecipe(false);
    }
  };

  // Recipe item row edit helpers
  const updateDraftItem = (index, patch) => {
    setRecipeDraft((current) => {
      const items = current.items.map((item, idx) => {
        if (idx === index) {
          // If item_name changes, try to fetch unit from stock master
          if (patch.item_name !== undefined) {
            const match = stocks.find(s => s.name?.toLowerCase() === patch.item_name.toLowerCase());
            if (match) {
              patch.unit = match.unit || "kg";
            }
          }
          return { ...item, ...patch };
        }
        return item;
      });
      return { ...current, items };
    });
  };

  const addDraftItem = () => {
    setRecipeDraft((current) => ({ ...current, items: [...current.items, blankIngredient()] }));
  };

  const removeDraftItem = (index) => {
    setRecipeDraft((current) => ({
      ...current,
      items: current.items.length === 1 ? [blankIngredient()] : current.items.filter((_, idx) => idx !== index),
    }));
  };

  // Sub-flow 2: Production Planning actions
  const startPlanning = (recipe) => {
    setPlanningRecipe(recipe);
    setPlannedPlates("100");
    setSelectedDate(today());
    setActiveTab("planning");
  };

  const scaledIngredients = useMemo(() => {
    if (!planningRecipe) return [];
    const basePlates = planningRecipe.base_plates || 100;
    const plates = parseInt(plannedPlates) || 0;
    if (plates <= 0) return [];
    const scaleFactor = plates / basePlates;

    return (planningRecipe.items || []).map((item) => ({
      name: item.item_name,
      qty: parseFloat((item.base_qty * scaleFactor).toFixed(2)),
      unit: item.unit,
    }));
  }, [planningRecipe, plannedPlates]);

  const confirmProductionPlan = async () => {
    if (!planningRecipe) return;
    const plates = parseInt(plannedPlates);
    if (!plates || plates <= 0) {
      alert("Please enter a valid planned plate count");
      return;
    }
    if (!selectedDate) {
      alert("Please select a planned production date");
      return;
    }

    setSubmittingPlan(true);
    try {
      const res = await api.productionPlans.create({
        recipe_id: planningRecipe.id,
        planned_plates: plates,
        planned_date: selectedDate,
        dept: selectedDept,
      });

      if (res.success) {
        triggerMessage("Production plan confirmed ✓");
        setPlanningRecipe(null);
        setScheduleFilterDate(selectedDate);
        loadData();
      }
    } catch (err) {
      alert("Error planning production: " + err.message);
    } finally {
      setSubmittingPlan(false);
    }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to cancel and delete this production plan?")) return;
    try {
      const res = await api.productionPlans.remove(planId);
      if (res.success) {
        triggerMessage("Plan deleted successfully");
        loadData();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // Indent Generation and Auto-Fill (merged from Menu Planner)
  const handleAutoIndentFill = () => {
    if (!planningRecipe) return;
    setIndentPreFill({
      dept: selectedDept || "TIFFINS",
      items: scaledIngredients.map((item) => ({
        name: item.name,
        qty: item.qty,
        unit: item.unit,
      })),
    });
    setCurrentScreen("indent");
  };

  const handleSendIndent = (plan) => {
    setIndentPreFill({
      dept: plan.dept || "TIFFINS",
      items: (plan.items || []).map((item) => ({
        name: item.item_name,
        qty: item.planned_qty,
        unit: item.unit,
      })),
    });
    setCurrentScreen("indent");
  };

  // Write planned recipe+plates into SmartIndentTab's localStorage draft,
  // then navigate to indent screen with Smart tab open.
  const handleSmartIndentFromPlan = (plan) => {
    const recipe = recipesList.find((r) => r.id === plan.recipe_id);
    if (!recipe) return;
    const dept = plan.dept || selectedDept;
    const draft = {
      plannedRecipes: [{ recipe, plates: plan.planned_plates }],
      selectedItems: {},
      quantities: {},
    };
    localStorage.setItem(`kapila_smart_indent_draft_${dept}`, JSON.stringify(draft));
    setIndentSmartPreFill({ dept, date: plan.planned_date });
    setCurrentScreen("indent");
  };

  // Merge ALL planned (non-completed) plans for the schedule date into one Smart Indent.
  const handleSmartIndentFromAllPlans = () => {
    const pending = filteredPlans.filter((p) => p.status === "Planned");
    if (!pending.length) return;
    const dept = selectedDept;
    const plannedRecipes = pending
      .map((plan) => {
        const recipe = recipesList.find((r) => r.id === plan.recipe_id);
        return recipe ? { recipe, plates: plan.planned_plates } : null;
      })
      .filter(Boolean);
    if (!plannedRecipes.length) return;
    const draft = { plannedRecipes, selectedItems: {}, quantities: {} };
    localStorage.setItem(`kapila_smart_indent_draft_${dept}`, JSON.stringify(draft));
    setIndentSmartPreFill({ dept, date: scheduleFilterDate });
    setCurrentScreen("indent");
  };

  // Sub-flow 3: EOD Waste Tracker actions
  const openOutcomeModal = (plan) => {
    setOutcomePlan(plan);
    setPlatesSoldInput("");
    setPlatesWastedInput("");
    setWasteReasonInput(plan.waste_reason || "");
    setIsOutcomeModalOpen(true);
  };

  // Automatically calculate wasted count when plates sold updates
  const handlePlatesSoldChange = (val) => {
    setPlatesSoldInput(val);
    const sold = parseInt(val) || 0;
    if (outcomePlan) {
      const wasted = Math.max(0, outcomePlan.planned_plates - sold);
      setPlatesWastedInput(String(wasted));
    }
  };

  const submitEODOutcome = async () => {
    if (platesSoldInput === "") {
      alert("Plates actually sold is required.");
      return;
    }
    const sold = parseInt(platesSoldInput);
    const wasted = parseInt(platesWastedInput || 0);

    if (isNaN(sold) || sold < 0) {
      alert("Please enter a valid number of plates sold.");
      return;
    }

    setSubmittingOutcome(true);
    try {
      const res = await api.productionPlans.update(outcomePlan.id, {
        plates_sold: sold,
        plates_wasted: wasted,
        waste_reason: wasteReasonInput,
      });

      if (res.success) {
        triggerMessage("End-of-day report submitted successfully ✓");
        setIsOutcomeModalOpen(false);
        loadData();
      }
    } catch (err) {
      alert("Error submitting EOD report: " + err.message);
    } finally {
      setSubmittingOutcome(false);
    }
  };

  // Filter plans schedule list
  const filteredPlans = useMemo(() => {
    return productionPlans.filter((plan) => plan.planned_date === scheduleFilterDate);
  }, [productionPlans, scheduleFilterDate]);

  return (
    <Section 
      title="Production Planner" 
      sub="Scale recipe ingredients, generate department indents, schedule menus, and track daily kitchen waste"
      onBack={isChef ? () => setCurrentScreen("chef_home") : null}
    >
      
      {/* Success Notification banner */}
      {successMsg && (
        <div style={{
          backgroundColor: COLORS.success + "15",
          borderLeft: `4px solid ${COLORS.success}`,
          color: COLORS.success,
          padding: "12px 16px",
          borderRadius: 6,
          marginBottom: 20,
          fontSize: 14,
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "fadeIn 0.2s"
        }}>
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {error && <ErrorMsg error={error} />}

      {/* Tabs Menu */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: 24, gap: 8 }}>
        <button 
          onClick={() => setActiveTab("library")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "library" ? `2px solid ${COLORS.brand}` : "2px solid transparent",
            color: activeTab === "library" ? COLORS.text : COLORS.muted,
            fontWeight: activeTab === "library" ? 600 : 400,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <BookOpen size={16} />
          Recipe Library
        </button>
        <button 
          onClick={() => setActiveTab("planning")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "planning" ? `2px solid ${COLORS.brand}` : "2px solid transparent",
            color: activeTab === "planning" ? COLORS.text : COLORS.muted,
            fontWeight: activeTab === "planning" ? 600 : 400,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <Calendar size={16} />
          Menu & Production Schedule
        </button>
        <button 
          onClick={() => setActiveTab("outcomes")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "outcomes" ? `2px solid ${COLORS.brand}` : "2px solid transparent",
            color: activeTab === "outcomes" ? COLORS.text : COLORS.muted,
            fontWeight: activeTab === "outcomes" ? 600 : 400,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <CheckCircle2 size={16} />
          Log EOD Outcome / Waste
        </button>
        <button 
          onClick={() => setActiveTab("analytics")}
          style={{
            padding: "10px 16px",
            background: "none",
            border: "none",
            borderBottom: activeTab === "analytics" ? `2px solid ${COLORS.brand}` : "2px solid transparent",
            color: activeTab === "analytics" ? COLORS.text : COLORS.muted,
            fontWeight: activeTab === "analytics" ? 600 : 400,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <TrendingDown size={16} />
          Waste Analytics
        </button>
      </div>

      <style>{`
        .library-grid { display: grid; grid-template-columns: 320px 1fr; gap: 20px; align-items: start; }
        .recipe-list { display: flex; flex-direction: column; gap: 8px; max-height: 520px; overflow-y: auto; }
        .recipe-item-card { border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px 16px; text-align: left; background: #fff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s; }
        .recipe-item-card.active { border-color: ${COLORS.brand}; background: ${COLORS.brandLight}; }
        .recipe-item-card:hover { border-color: ${COLORS.brand}; }
        .recipe-modal-backdrop { position: fixed; inset: 0; z-index: 999; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(2px); display: grid; place-items: center; padding: 24px; }
        .recipe-modal { width: min(720px, 100%); max-height: calc(100vh - 48px); overflow-y: auto; background: #fff; border-radius: 12px; border: 1px solid ${COLORS.border}; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
        .plan-flow-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 24px; align-items: start; }
        .plates-btn { padding: 8px 12px; font-size: 13px; font-weight: 600; border: 1px solid ${COLORS.border}; background: #fff; color: ${COLORS.text}; border-radius: 6px; cursor: pointer; transition: all 0.15s; }
        .plates-btn.active { background: ${COLORS.brand}; color: #fff; border-color: ${COLORS.brand}; }
        .plates-btn:hover:not(.active) { background: #f8fafc; border-color: ${COLORS.brand}; }
        .ingredient-table-head { display: grid; grid-template-columns: 1.8fr 1fr 0.8fr 40px; background: #f8fafc; border-bottom: 1px solid ${COLORS.border}; font-weight: 600; font-size: 11px; text-transform: uppercase; color: ${COLORS.muted}; padding: 6px 12px; }
        .ingredient-edit-row { display: grid; grid-template-columns: 1.8fr 1fr 0.8fr 40px; align-items: center; border-bottom: 1px solid ${COLORS.border}55; }
        .ingredient-edit-row input, .ingredient-edit-row select { border: 0; border-radius: 0; min-height: 38px; padding: 6px 12px; background: transparent; }
        .ingredient-edit-row input:focus { border: 1px solid ${COLORS.brand}; }
        .plan-item-row { padding: 14px 20px; border-bottom: 1px solid ${COLORS.border}55; transition: background 0.15s; cursor: pointer; }
        .plan-item-row:hover { background: #f8fafc; }
        @media (max-width: 900px) {
          .library-grid, .plan-flow-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ═══ TAB 1: RECIPE LIBRARY ═══ */}
      {activeTab === "library" && (
        <div className="library-grid">
          
          {/* Left panel: List & Create button */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Btn onClick={openCreateRecipe} icon={<Plus size={16} />} style={{ width: "100%" }}>
              Create New Recipe
            </Btn>
            
            <Card style={{ padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.muted, marginBottom: 12 }}>Recipe Library ({recipesList.length})</p>
              
              {recipesList.length === 0 ? (
                <p style={{ color: COLORS.muted, padding: "20px 0", textAlign: "center", fontSize: 13 }}>No recipes saved yet.</p>
              ) : (
                <div className="recipe-list">
                  {recipesList.map((r) => (
                    <div 
                      key={r.id}
                      onClick={() => setSelectedRecipe(r)}
                      className={`recipe-item-card ${selectedRecipe?.id === r.id ? "active" : ""}`}
                    >
                      <div>
                        <strong style={{ display: "block", fontSize: 13.5, color: COLORS.text }}>{r.name}</strong>
                        <span style={{ fontSize: 11, color: COLORS.muted }}>{r.category} • {r.items?.length || 0} Ingredient{r.items?.length === 1 ? "" : "s"}</span>
                      </div>
                      <ChevronRight size={16} color={COLORS.muted} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right panel: Selected recipe details */}
          <div>
            {!selectedRecipe ? (
              <Card style={{ padding: 48, textAlign: "center" }}>
                <BookOpen size={48} color={COLORS.muted} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
                <h3 style={{ color: COLORS.text, marginBottom: 4 }}>No Recipe Selected</h3>
                <p style={{ color: COLORS.muted, fontSize: 13 }}>Select a recipe from the list to view its details, scale daily production, or edit.</p>
              </Card>
            ) : (
              <Card style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: COLORS.brand, background: COLORS.brandLight, padding: "2px 8px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {selectedRecipe.category}
                    </span>
                    <h2 style={{ fontSize: 22, color: COLORS.text, fontWeight: 700, marginTop: 8, marginHorizontal: 0 }}>{selectedRecipe.name}</h2>
                    {selectedRecipe.description && (
                      <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 6 }}>{selectedRecipe.description}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Btn small variant="ghost" onClick={(e) => openEditRecipe(selectedRecipe, e)}>Edit</Btn>
                    <Btn small variant="danger" onClick={(e) => deleteRecipe(selectedRecipe.id, e)}>Delete</Btn>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                  <div>
                    <h4 style={{ fontSize: 12, textTransform: "uppercase", color: COLORS.muted, letterSpacing: "0.06em", marginBottom: 8 }}>Base Serving Size</h4>
                    <p style={{ fontSize: 18, fontWeight: 600, color: COLORS.text }}>
                      {selectedRecipe.base_plates || 100} plates / portions
                    </p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: 12, textTransform: "uppercase", color: COLORS.muted, letterSpacing: "0.06em", marginBottom: 8 }}>Action</h4>
                    <Btn onClick={() => startPlanning(selectedRecipe)} icon={<Utensils size={15} />}>
                      Schedule / Plan Production
                    </Btn>
                  </div>
                </div>

                {selectedRecipe.instructions && (
                  <div style={{ marginBottom: 24, padding: 14, background: "#f8fafc", borderRadius: 8, border: `1px solid ${COLORS.border}55` }}>
                    <h4 style={{ fontSize: 12, textTransform: "uppercase", color: COLORS.muted, letterSpacing: "0.06em", marginBottom: 6 }}>Preparation Instructions</h4>
                    <p style={{ fontSize: 13, color: COLORS.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{selectedRecipe.instructions}</p>
                  </div>
                )}

                <div>
                  <h4 style={{ fontSize: 12, textTransform: "uppercase", color: COLORS.muted, letterSpacing: "0.06em", marginBottom: 12 }}>Ingredients ({selectedRecipe.items?.length || 0})</h4>
                  <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Qty Required</th>
                          <th>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedRecipe.items || []).map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                            <td>{item.base_qty}</td>
                            <td>{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB 2: MENU & PRODUCTION PLANNING ═══ */}
      {activeTab === "planning" && (
        <div className="plan-flow-grid">
          
          {/* Left panel: Planning form (active if recipe selected) */}
          <div>
            {!planningRecipe ? (
              <Card style={{ padding: 24 }}>
                <h4 style={{ color: COLORS.text, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Schedule Production</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <Select 
                    label="Choose a Recipe to Schedule"
                    defaultValue=""
                    onChange={(e) => {
                      const rec = recipesList.find(r => r.id === parseInt(e.target.value));
                      if (rec) setPlanningRecipe(rec);
                    }}
                  >
                    <option value="" disabled>-- Select Recipe --</option>
                    {recipesList.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.category})</option>
                    ))}
                  </Select>
                  <p style={{ color: COLORS.muted, fontSize: 12, margin: 0 }}>
                    Or browse recipes in the <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab("library"); }} style={{ color: COLORS.brand, textDecoration: "underline" }}>Recipe Library</a>.
                  </p>
                </div>
              </Card>
            ) : (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, pb: 12, mb: 16, paddingBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 10, textTransform: "uppercase", color: COLORS.muted, letterSpacing: "0.08em", margin: 0 }}>Create Production Schedule</p>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, margin: "2px 0 0" }}>{planningRecipe.name}</h3>
                  </div>
                  <button onClick={() => setPlanningRecipe(null)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Department select */}
                  <Select 
                    label="Kitchen / Department" 
                    value={selectedDept} 
                    onChange={(e) => setSelectedDept(e.target.value)}
                  >
                    {deptsList.map((dept) => (
                      <option key={dept.id} value={dept.name}>{dept.name} ({dept.code})</option>
                    ))}
                  </Select>

                  {/* Plates selector */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: COLORS.muted }}>
                        Target Plate Count (Base: {planningRecipe.base_plates || 100})
                      </label>
                      <button
                        onClick={handleAutoIndentFill}
                        style={{
                          backgroundColor: "transparent",
                          border: "1px solid #e8a838",
                          borderRadius: "4px",
                          color: "#e8a838",
                          cursor: "pointer",
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          outline: "none"
                        }}
                      >
                        Auto Indent Fill
                      </button>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 8 }}>
                      {[50, 100, 150, 200, 250, 300].map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setPlannedPlates(String(count))}
                          className={`plates-btn ${parseInt(plannedPlates) === count ? "active" : ""}`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                    <Input 
                      label="Or Enter Custom Plates Count" 
                      type="number" 
                      min="1" 
                      value={plannedPlates} 
                      onChange={(e) => setPlannedPlates(e.target.value)} 
                    />
                  </div>

                  <Input 
                    label="Planned Production Date" 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)} 
                  />

                  {/* Scaled ingredients preview */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: COLORS.muted, marginBottom: 8 }}>Scaled Ingredients Preview</p>
                    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, maxHeight: 180, overflowY: "auto" }}>
                      <table style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: "8px 12px" }}>Ingredient</th>
                            <th style={{ padding: "8px 12px" }}>Scaled Qty</th>
                            <th style={{ padding: "8px 12px" }}>Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scaledIngredients.length === 0 ? (
                            <tr>
                              <td colSpan="3" style={{ textAlign: "center", color: COLORS.muted, padding: 12 }}>Enter target plates count to preview quantities</td>
                            </tr>
                          ) : (
                            scaledIngredients.map((item, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: "8px 12px", fontWeight: 600 }}>{item.name}</td>
                                <td style={{ padding: "8px 12px" }}>{item.qty}</td>
                                <td style={{ padding: "8px 12px" }}>{item.unit}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <Btn 
                    onClick={confirmProductionPlan} 
                    loading={submittingPlan} 
                    style={{ width: "100%", marginTop: 8 }}
                  >
                    Confirm Production Plan
                  </Btn>
                </div>
              </Card>
            )}
          </div>

          {/* Right panel: Schedule view filterable by date */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Input 
                  label="Select Schedule Date" 
                  type="date" 
                  value={scheduleFilterDate} 
                  onChange={(e) => setScheduleFilterDate(e.target.value)} 
                />
              </div>
              <Btn onClick={loadData} variant="ghost" icon={<RefreshCw size={14} />} style={{ marginTop: 16 }} title="Reload schedule data" />
            </Card>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.muted, margin: 0 }}>
                  Daily Schedule: {scheduleFilterDate} ({filteredPlans.length} plans)
                </p>
                {filteredPlans.some((p) => p.status === "Planned") && (
                  <Btn small onClick={handleSmartIndentFromAllPlans} icon={<ClipboardSignature size={13} />}>
                    Generate Smart Indent for All
                  </Btn>
                )}
              </div>

              {filteredPlans.length === 0 ? (
                <p style={{ color: COLORS.muted, textAlign: "center", padding: 48, fontSize: 13 }}>No production plans scheduled for this date.</p>
              ) : (
                <div style={{ overflowY: "auto", maxHeight: 460 }}>
                  {filteredPlans.map((plan) => (
                    <div key={plan.id} className="plan-item-row">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <strong style={{ fontSize: 14, color: COLORS.text, display: "block" }}>{plan.recipe_name}</strong>
                          <span style={{ fontSize: 11, color: COLORS.muted, display: "block", marginTop: 2 }}>
                            Dept: <strong style={{ color: COLORS.brand }}>{plan.dept || "General"}</strong> | Planned: <strong>{plan.planned_plates}</strong> plates
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 4,
                            backgroundColor: plan.status === "Completed" ? COLORS.success + "15" : COLORS.warning + "15",
                            color: plan.status === "Completed" ? COLORS.success : COLORS.warning,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em"
                          }}>
                            {plan.status}
                          </span>
                          <button 
                            onClick={() => deletePlan(plan.id)}
                            title="Cancel plan"
                            style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, padding: 4 }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Ingredient list preview */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", marginVertical: 8, padding: "8px 12px", background: "#f8fafc", borderRadius: 6, border: `1px solid ${COLORS.border}33` }}>
                        {(plan.items || []).map((item, i) => (
                          <span key={i} style={{ fontSize: 11, color: COLORS.text }}>
                            {item.item_name}: <strong>{item.planned_qty} {item.unit}</strong>
                            {item.wasted_qty !== null && (
                              <span style={{ color: COLORS.danger, marginLeft: 4 }}>
                                (wasted: {item.wasted_qty} {item.unit})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>

                      {plan.status === "Planned" ? (
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                          <Btn small variant="ghost" onClick={() => handleSmartIndentFromPlan(plan)} icon={<ClipboardSignature size={13} />}>
                            Smart Indent
                          </Btn>
                          <Btn small variant="ghost" onClick={() => setActiveTab("outcomes")} icon={<ArrowRight size={13} />}>
                            Log Outcome
                          </Btn>
                        </div>
                      ) : (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, fontSize: 12, color: COLORS.muted, borderTop: `1px dashed ${COLORS.border}`, paddingTop: 8 }}>
                          <span>Sold: <strong>{plan.plates_sold}</strong> | Wasted: <strong style={{ color: COLORS.danger }}>{plan.plates_wasted}</strong></span>
                          <span>Waste %: <strong style={{ color: plan.waste_percentage > 15 ? COLORS.danger : COLORS.success }}>{plan.waste_percentage}%</strong></span>
                        </div>
                      )}
                      
                      {plan.waste_reason && (
                        <p style={{ margin: "6px 0 0", fontSize: 11, fontStyle: "italic", color: COLORS.muted }}>
                          Waste note: "{plan.waste_reason}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: LOG EOD OUTCOME / WASTE ═══ */}
      {activeTab === "outcomes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 800, margin: "0 auto" }}>
          <Card style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <Input 
                label="Select Date to Log Outcomes" 
                type="date" 
                value={scheduleFilterDate} 
                onChange={(e) => setScheduleFilterDate(e.target.value)} 
              />
            </div>
            <Btn onClick={loadData} variant="ghost" icon={<RefreshCw size={14} />} style={{ marginTop: 16 }} title="Reload plans" />
          </Card>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.muted, margin: 0 }}>
                Scheduled Production Plans: {scheduleFilterDate} ({filteredPlans.length} plans)
              </p>
            </div>

            {filteredPlans.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48 }}>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>No production plans scheduled for this date.</p>
                <Btn small onClick={() => setActiveTab("planning")}>Schedule Production</Btn>
              </div>
            ) : (
              <div style={{ overflowY: "auto", maxHeight: 520 }}>
                {filteredPlans.map((plan) => (
                  <div key={plan.id} style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}55` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <strong style={{ fontSize: 14, color: COLORS.text, display: "block" }}>{plan.recipe_name}</strong>
                        <span style={{ fontSize: 11, color: COLORS.muted, display: "block", marginTop: 2 }}>
                          Dept: <strong style={{ color: COLORS.brand }}>{plan.dept || "General"}</strong> | Planned: <strong>{plan.planned_plates}</strong> plates
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: "3px 8px",
                        borderRadius: 4,
                        backgroundColor: plan.status === "Completed" ? COLORS.success + "15" : COLORS.warning + "15",
                        color: plan.status === "Completed" ? COLORS.success : COLORS.warning,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em"
                      }}>
                        {plan.status}
                      </span>
                    </div>

                    {plan.status === "Planned" ? (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                        <Btn onClick={() => openOutcomeModal(plan)} icon={<ArrowRight size={14} />}>
                          Log EOD Outcome / Waste
                        </Btn>
                      </div>
                    ) : (
                      <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 6, border: `1px solid ${COLORS.border}33`, marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.text, fontWeight: 500 }}>
                          <span>Sold: <strong>{plan.plates_sold}</strong> plates</span>
                          <span>Wasted: <strong style={{ color: COLORS.danger }}>{plan.plates_wasted}</strong> plates</span>
                          <span>Waste %: <strong style={{ color: plan.waste_percentage > 15 ? COLORS.danger : COLORS.success }}>{plan.waste_percentage}%</strong></span>
                        </div>
                        {plan.waste_reason && (
                          <p style={{ margin: "8px 0 0", fontSize: 11, fontStyle: "italic", color: COLORS.muted }}>
                            Waste note: "{plan.waste_reason}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══ TAB 3: WASTE ANALYTICS ═══ */}
      {activeTab === "analytics" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Key Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            <Card>
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Most Wasted Dish</p>
              <h3 style={{ fontSize: 18, color: COLORS.danger, fontWeight: 700, margin: 0 }}>
                {analyticsData.mostWasted[0] ? (
                  <>
                    {analyticsData.mostWasted[0].recipe_name}
                    <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400, display: "block", marginTop: 4 }}>
                      Avg Waste: <strong>{analyticsData.mostWasted[0].avg_waste_percentage}%</strong> ({analyticsData.mostWasted[0].total_plates_wasted} plates wasted)
                    </span>
                  </>
                ) : (
                  "No data available"
                )}
              </h3>
            </Card>

            <Card>
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Total Waste (All Dishes)</p>
              <h3 style={{ fontSize: 24, color: COLORS.text, fontWeight: 700, margin: 0 }}>
                {analyticsData.recipeTrends.reduce((acc, curr) => acc + parseInt(curr.total_plates_wasted || 0), 0)}
                <span style={{ fontSize: 13, color: COLORS.muted, fontWeight: 400, marginLeft: 6 }}>plates total</span>
              </h3>
            </Card>

            <Card>
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 6px" }}>Average Kitchen Waste %</p>
              <h3 style={{ fontSize: 24, color: COLORS.warning, fontWeight: 700, margin: 0 }}>
                {analyticsData.recipeTrends.length > 0 ? (
                  (analyticsData.recipeTrends.reduce((acc, curr) => acc + parseFloat(curr.avg_waste_percentage || 0), 0) / analyticsData.recipeTrends.length).toFixed(1) + "%"
                ) : (
                  "0%"
                )}
                <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 400, display: "block", marginTop: 4 }}>Target: Under 10%</span>
              </h3>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
            {/* Table: Most Wasted Dishes ranking */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                <h3 style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, margin: 0 }}>Dish Waste Rankings</h3>
              </div>
              <div className="resp-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Dish / Recipe Name</th>
                      <th>Category</th>
                      <th>Total Wasted Plates</th>
                      <th>Avg Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.mostWasted.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", color: COLORS.muted, padding: 32 }}>No completed production plans recorded yet.</td>
                      </tr>
                    ) : (
                      analyticsData.mostWasted.map((dish, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: 600 }}>{dish.recipe_name}</td>
                          <td>{dish.recipe_category}</td>
                          <td style={{ color: COLORS.danger }}>{dish.total_plates_wasted} plates</td>
                          <td style={{ fontWeight: 700, color: dish.avg_waste_percentage > 15 ? COLORS.danger : COLORS.success }}>
                            {dish.avg_waste_percentage}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Table: Daily average waste percentage */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                <h3 style={{ fontSize: 14, color: COLORS.text, fontWeight: 600, margin: 0 }}>Daily Waste Trends (Last 30 Days)</h3>
              </div>
              <div className="resp-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Plates Planned</th>
                      <th>Plates Wasted</th>
                      <th>Avg Waste %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.dailyWaste.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: "center", color: COLORS.muted, padding: 32 }}>No completed production plans recorded yet.</td>
                      </tr>
                    ) : (
                      analyticsData.dailyWaste.map((day, index) => (
                        <tr key={index}>
                          <td>{day.planned_date}</td>
                          <td>{day.total_planned}</td>
                          <td>{day.total_wasted}</td>
                          <td style={{ fontWeight: 700, color: day.avg_waste_percentage > 15 ? COLORS.danger : COLORS.success }}>
                            {day.avg_waste_percentage}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CREATE / EDIT RECIPE (SUB-FLOW 1) ═══ */}
      {isRecipeModalOpen && (
        <div className="recipe-modal-backdrop">
          <div className="recipe-modal fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 12, marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: COLORS.brand, margin: 0 }}>Recipe Builder</p>
                <h3 style={{ fontSize: 18, color: COLORS.text, fontWeight: 700, margin: "2px 0 0" }}>
                  {recipeModalMode === "create" ? "Build New Recipe" : `Edit Recipe: ${selectedRecipe?.name}`}
                </h3>
              </div>
              <button onClick={() => setIsRecipeModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
                <Input 
                  label="Recipe / Dish Name" 
                  value={recipeDraft.name} 
                  onChange={(e) => setRecipeDraft(f => ({ ...f, name: e.target.value }))} 
                  placeholder="e.g. Chilli Paneer Dry"
                />
                <Select 
                  label="Category" 
                  value={recipeDraft.category} 
                  onChange={(e) => setRecipeDraft(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                <Input 
                  label="Base Serving Size (batch plate unit)" 
                  type="number"
                  min="1"
                  value={recipeDraft.base_plates} 
                  onChange={(e) => setRecipeDraft(f => ({ ...f, base_plates: e.target.value }))} 
                  placeholder="e.g. 50"
                />
              </div>

              <Input 
                label="Brief Description" 
                value={recipeDraft.description} 
                onChange={(e) => setRecipeDraft(f => ({ ...f, description: e.target.value }))} 
                placeholder="e.g. Spicy cottage cheese chunks tossed with bell peppers and soy sauce"
              />

              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Preparation Instructions</label>
                <textarea 
                  value={recipeDraft.instructions} 
                  onChange={(e) => setRecipeDraft(f => ({ ...f, instructions: e.target.value }))} 
                  rows={3}
                  placeholder="Step-by-step cooking steps..."
                  style={{ background: "#ffffff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, padding: "8px 12px", width: "100%", fontFamily: "'Inter',sans-serif", fontSize: 13, resize: "vertical", outline: "none" }} 
                />
              </div>

              {/* Ingredients table builder */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: COLORS.muted }}>
                    Ingredients Table
                  </label>
                  <Btn small variant="ghost" onClick={addDraftItem} icon={<Plus size={14} />}>Add Ingredient</Btn>
                </div>

                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div className="ingredient-table-head">
                    <span>Ingredient Name</span>
                    <span>Base Qty</span>
                    <span>Unit</span>
                    <span />
                  </div>
                  <div style={{ maxExpandedHeight: 200, overflowY: "auto" }}>
                    {recipeDraft.items.map((item, index) => (
                      <div className="ingredient-edit-row" key={index}>
                        <input
                          list="stock-items"
                          value={item.item_name}
                          onChange={(e) => updateDraftItem(index, { item_name: e.target.value })}
                          placeholder="Select from stock..."
                          style={{ borderRight: `1px solid ${COLORS.border}33` }}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.base_qty}
                          onChange={(e) => updateDraftItem(index, { base_qty: e.target.value })}
                          placeholder="Qty"
                          style={{ borderRight: `1px solid ${COLORS.border}33` }}
                        />
                        <input
                          value={item.unit}
                          onChange={(e) => updateDraftItem(index, { unit: e.target.value })}
                          placeholder="Unit"
                          style={{ borderRight: `1px solid ${COLORS.border}33` }}
                        />
                        <button 
                          onClick={() => removeDraftItem(index)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.danger, padding: 8, display: "grid", placeItems: "center" }}
                          title="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Stock Autocomplete datalist */}
                <datalist id="stock-items">
                  {stocks.map((s) => <option key={s.id || s.item_code || s.name} value={s.name} />)}
                </datalist>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                <Btn variant="ghost" onClick={() => setIsRecipeModalOpen(false)}>Cancel</Btn>
                <Btn onClick={saveRecipe} loading={savingRecipe} icon={<Save size={15} />}>
                  {recipeModalMode === "create" ? "Create Recipe" : "Save Changes"}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: EOD OUTCOME LOGGING (SUB-FLOW 3) ═══ */}
      {isOutcomeModalOpen && outcomePlan && (
        <div className="recipe-modal-backdrop">
          <div className="recipe-modal fade-in" style={{ width: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 12, marginBottom: 18 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: COLORS.brand, margin: 0 }}>End of Day Report</p>
                <h3 style={{ fontSize: 16, color: COLORS.text, fontWeight: 700, margin: "2px 0 0" }}>{outcomePlan.recipe_name}</h3>
              </div>
              <button onClick={() => setIsOutcomeModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6, fontSize: 13, border: `1px solid ${COLORS.border}55` }}>
                Planned Plates: <strong style={{ color: COLORS.brand }}>{outcomePlan.planned_plates}</strong>
              </div>

              <Input 
                label="Plates Actually Sold" 
                type="number" 
                min="0"
                value={platesSoldInput} 
                onChange={(e) => handlePlatesSoldChange(e.target.value)} 
                placeholder="0"
              />

              <Input 
                label="Plates Remaining / Unsold (Wasted)" 
                type="number" 
                min="0"
                value={platesWastedInput} 
                onChange={(e) => setPlatesWastedInput(e.target.value)} 
                placeholder="0"
              />

              <div>
                <label style={{ fontSize: 11, color: COLORS.muted, letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>Waste Reason / Notes (Optional)</label>
                <textarea 
                  value={wasteReasonInput} 
                  onChange={(e) => setWasteReasonInput(e.target.value)} 
                  rows={2}
                  placeholder="e.g. Overestimated dinner demand, burnt batch..."
                  style={{ background: "#ffffff", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, padding: "8px 12px", width: "100%", fontFamily: "'Inter',sans-serif", fontSize: 13, resize: "vertical", outline: "none" }} 
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                <Btn variant="ghost" onClick={() => setIsOutcomeModalOpen(false)}>Cancel</Btn>
                <Btn onClick={submitEODOutcome} loading={submittingOutcome} icon={<CheckCircle2 size={15} />}>
                  Submit EOD Report
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

    </Section>
  );
}
