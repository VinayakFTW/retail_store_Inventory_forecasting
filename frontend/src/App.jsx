import React, { useState, useEffect, useMemo } from "react";
import {
  Store,
  Package,
  PackageCheck,
  Tag,
  Trash2,
  Cpu,
  Sparkles,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Play,
  ArrowRight,
  BarChart3,
  Calendar,
  Table,
  Building2,
  Layers,
  Minus,
  Activity,
  Check,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [activePage, setActivePage] = useState("operations"); // "operations" | "evaluation"
  const [gameMode, setGameMode] = useState("interactive"); // "interactive" | "sandbox"

  const [summary, setSummary] = useState(null);
  const [stores, setStores] = useState([]);
  const [productsByStore, setProductsByStore] = useState({});
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [markdownBoost, setMarkdownBoost] = useState(15);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Correlation Matrix State
  const [corrView, setCorrView] = useState("features"); // "features" | "models"
  const [hoveredCell, setHoveredCell] = useState(null);

  // Daily Operational Simulation State
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [orderStrategy, setOrderStrategy] = useState("ai"); // "naive" | "ai" | "custom"
  const [customOrderQty, setCustomOrderQty] = useState(10);
  const [simPhase, setSimPhase] = useState("idle"); // "idle" | "running" | "done"
  const [simClockText, setSimClockText] = useState("");
  const [dayHistory, setDayHistory] = useState([]);

  // 1. Load initial summary and stores
  useEffect(() => {
    fetch(`${API_BASE}/api/summary`)
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch((err) => console.error("Summary error:", err));

    fetch(`${API_BASE}/api/stores`)
      .then((res) => res.json())
      .then((data) => {
        setStores(data.stores || []);
        setProductsByStore(data.products_by_store || {});
        if (data.stores && data.stores.length > 0) {
          const firstStore = data.stores[0];
          setSelectedStore(firstStore);
          const firstProd = data.products_by_store?.[firstStore]?.[0] || "";
          setSelectedProduct(firstProd);
        }
      })
      .catch((err) => console.error("Stores error:", err));
  }, []);

  const handleStoreChange = (newStoreId) => {
    const storeNum = Number(newStoreId);
    setSelectedStore(storeNum);
    const prods = productsByStore[storeNum] || [];
    if (prods.length > 0) {
      setSelectedProduct(prods[0]);
    }
  };

  // 2. Load 7-day product data
  useEffect(() => {
    if (selectedStore === "" || selectedProduct === "") return;
    setLoading(true);
    fetch(
      `${API_BASE}/api/forecast/${selectedStore}/${selectedProduct}?markdown_boost_pct=${markdownBoost}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setForecast(data);
        setCurrentDayIdx(0);
        setDayHistory([]);
        setSimPhase("idle");
        if (data?.daily_data?.[0]) {
          setCustomOrderQty(
            Math.round(data.daily_data[0].smart_order * 10) / 10,
          );
        }
      })
      .catch((err) => console.error("Forecast error:", err))
      .finally(() => setLoading(false));
  }, [selectedStore, selectedProduct, markdownBoost]);

  const dailyList = forecast?.daily_data || [];
  const activeDay = dailyList[currentDayIdx] || null;

  // Sync default custom slider when moving to a new day
  useEffect(() => {
    if (activeDay) {
      setCustomOrderQty(Math.round(activeDay.smart_order * 10) / 10);
      setSimPhase("idle");
    }
  }, [currentDayIdx]);

  // Compute current order based on strategy choice
  const chosenOrderQty = useMemo(() => {
    if (!activeDay) return 0;
    if (orderStrategy === "naive") return activeDay.naive_order;
    if (orderStrategy === "ai") return activeDay.smart_order;
    return Number(customOrderQty);
  }, [activeDay, orderStrategy, customOrderQty]);

  // Compute live outcome for active day
  const activeOutcome = useMemo(() => {
    if (!activeDay) return null;
    const trueDem = activeDay.true_demand;
    const boostMult = 1 + markdownBoost / 100;
    const boostedDem =
      chosenOrderQty > trueDem ? +(trueDem * boostMult).toFixed(2) : trueDem;

    const regularSold = +Math.min(chosenOrderQty, trueDem).toFixed(2);
    const markdownSaved = +Math.max(
      0,
      Math.min(chosenOrderQty - regularSold, boostedDem - trueDem),
    ).toFixed(2);
    const totalSold = +(regularSold + markdownSaved).toFixed(2);
    const spoiledWaste = +Math.max(0, chosenOrderQty - boostedDem).toFixed(2);
    const unfulfilled = +Math.max(0, trueDem - chosenOrderQty).toFixed(2);

    const wasteSavedVsNaive = +Math.max(
      0,
      activeDay.naive_waste - spoiledWaste,
    ).toFixed(2);

    const wasteRatio = chosenOrderQty > 0 ? spoiledWaste / chosenOrderQty : 0;
    const fillRatio = trueDem > 0 ? totalSold / trueDem : 1;

    let grade = "A";
    if (wasteRatio <= 0.08 && fillRatio >= 0.75) grade = "S+";
    else if (wasteRatio <= 0.16 && fillRatio >= 0.65) grade = "A";
    else if (wasteRatio <= 0.28) grade = "B";
    else grade = "C";

    const fillEfficiencyPct = +(
      chosenOrderQty > 0 ? (totalSold / chosenOrderQty) * 100 : 100
    ).toFixed(1);

    return {
      trueDem,
      regularSold,
      markdownSaved,
      totalSold,
      spoiledWaste,
      unfulfilled,
      wasteSavedVsNaive,
      grade,
      fillEfficiencyPct,
    };
  }, [activeDay, chosenOrderQty, markdownBoost]);

  // Run animated intraday operational progression
  const handleSimulateDay = () => {
    if (!activeDay || !activeOutcome || simPhase === "running") return;
    setSimPhase("running");
    setSimClockText("06:00 AM — Morning Delivery & Initial Shelf Replenishment...");

    setTimeout(() => {
      setSimClockText("12:30 PM — Peak Midday Retail Footfall & Sales Velocity...");
    }, 350);

    setTimeout(() => {
      setSimClockText(
        `18:00 PM — Markdown Window Activated (+${markdownBoost}% Demand Acceleration)...`,
      );
    }, 750);

    setTimeout(() => {
      setSimClockText("23:59 PM — Store Closed: End-of-Day Spoilage Reconciliation Completed");
      setSimPhase("done");
      setDayHistory((prev) => [
        ...prev.filter((d) => d.dt !== activeDay.dt),
        {
          dt: activeDay.dt,
          order: chosenOrderQty,
          trueDemand: activeDay.true_demand,
          naiveWaste: activeDay.naive_waste,
          playerWaste: activeOutcome.spoiledWaste,
          markdownSaved: activeOutcome.markdownSaved,
          grade: activeOutcome.grade,
        },
      ]);
    }, 1150);
  };

  const currentProducts = productsByStore[selectedStore] || [];
  const models = summary?.comparative_models || [];
  const features = summary?.feature_importance || [];
  const dsInfo = summary?.dataset_info || {};
  const correlationData = summary?.correlation_matrix || {};

  const getCorrColor = (val) => {
    if (val === 1.0)
      return "bg-[#E8F0FE] text-[#1967D2] font-black border border-[#D2E3FC]";
    if (val > 0) {
      if (val >= 0.8) return "bg-[#1A73E8] text-white font-bold";
      if (val >= 0.5) return "bg-[#8AB4F8]/80 text-[#174EA6] font-semibold";
      if (val >= 0.2) return "bg-[#D2E3FC]/70 text-[#1967D2] font-medium";
      return "bg-[#E8F0FE]/60 text-[#1967D2]";
    }
    if (val < 0) {
      if (val <= -0.5) return "bg-[#EA4335] text-white font-bold";
      if (val <= -0.2) return "bg-[#FAD2CF] text-[#C5221F] font-semibold";
      return "bg-[#FCE8E6] text-[#C5221F]";
    }
    return "bg-white text-[#5F6368]";
  };
  const maxTrainTime = Math.max(...models.map((m) => m.train_time_sec || 1), 1);

  // Build 20 visual shelf slots for animated matrix graphic
  const shelfCrates = useMemo(() => {
    if (!activeDay || !activeOutcome) return [];
    const maxScale = Math.max(
      chosenOrderQty,
      activeDay.true_demand,
      activeDay.naive_order,
      1,
    );
    const totalBoxes = 20;
    const regCount = Math.round(
      (activeOutcome.regularSold / maxScale) * totalBoxes,
    );
    const mkdCount = Math.round(
      (activeOutcome.markdownSaved / maxScale) * totalBoxes,
    );
    const wasteCount = Math.round(
      (activeOutcome.spoiledWaste / maxScale) * totalBoxes,
    );

    const boxes = [];
    for (let i = 0; i < totalBoxes; i++) {
      if (i < regCount) {
        boxes.push({
          type: "sold",
          label: "Sold Full Price",
          color: "#34A853",
        });
      } else if (i < regCount + mkdCount) {
        boxes.push({
          type: "markdown",
          label: "Cleared by 18:00 Markdown",
          color: "#FBBC04",
        });
      } else if (i < regCount + mkdCount + wasteCount) {
        boxes.push({ type: "waste", label: "Spoiled Waste", color: "#EA4335" });
      } else {
        boxes.push({
          type: "empty",
          label: "Unused Shelf Capacity",
          color: "#9AA0A6",
        });
      }
    }
    return boxes;
  }, [activeDay, activeOutcome, chosenOrderQty]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] pb-16">
      {/* ========================================================= */}
      {/* TOP PRODUCTION EXECUTIVE NAVBAR                           */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#DADCE0] shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo with Google 4-Color Accent Dots */}
          <div className="flex items-center gap-3.5">
            <div className="grid grid-cols-2 gap-1 p-2 bg-[#F8F9FA] rounded-xl border border-[#DADCE0]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA4335]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FBBC04]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#34A853]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-[#202124]">
                  FreshMart <span className="text-[#4285F4]">Intelligence</span>
                </h1>
                <span className="text-[11px] font-mono font-semibold bg-[#E8F0FE] text-[#1967D2] px-2.5 py-0.5 rounded-full border border-[#D2E3FC]">
                  FreshRetailNet-50K
                </span>
              </div>
              <p className="text-xs text-[#5F6368]">
                Perishable Inventory Optimization & Demand Forecasting System
              </p>
            </div>
          </div>

          {/* Operational Metrics & Navigation Ribbon */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Active Model Indicator */}
            <div className="hidden sm:flex items-center gap-2 bg-[#E8F0FE] border border-[#D2E3FC] px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold text-[#1967D2]">
              <span className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse" />
              <span>LightGBM Pinball (α=0.40)</span>
            </div>

            {/* Global Spoilage Cut Badge */}
            {summary && (
              <div className="flex items-center gap-1.5 bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] px-3 py-1.5 rounded-full text-xs font-mono font-bold">
                <TrendingDown className="w-4 h-4 text-[#34A853]" />
                <span>-{summary.waste_reduction_pct}% Spoilage Cut</span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex bg-[#F1F3F4] p-1 rounded-full border border-[#DADCE0] text-xs font-semibold">
              <button
                onClick={() => setActivePage("operations")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activePage === "operations"
                    ? "bg-[#4285F4] text-white shadow-xs"
                    : "text-[#5F6368] hover:text-[#202124]"
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Inventory Operations</span>
              </button>
              <button
                onClick={() => setActivePage("evaluation")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activePage === "evaluation"
                    ? "bg-[#4285F4] text-white shadow-xs"
                    : "text-[#5F6368] hover:text-[#202124]"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Model Benchmarks</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* ========================================================= */}
        {/* PAGE 1: OPERATIONAL INVENTORY DASHBOARD                   */}
        {/* ========================================================= */}
        {activePage === "operations" && (
          <div className="space-y-6 animate-card-enter">
            {/* Global System Impact KPI Grid */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FCE8E6] text-[#EA4335] flex items-center justify-center font-bold">
                    <Trash2 className="w-5 h-5 text-[#EA4335]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                      Baseline Spoilage
                    </span>
                    <p className="text-xl font-mono font-extrabold text-[#202124]">
                      {summary.naive_total_waste_units.toLocaleString()} u
                    </p>
                    <span className="text-xs text-[#EA4335] font-medium">
                      {summary.naive_waste_rate_pct}% spoilage rate
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] text-[#4285F4] flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5 text-[#4285F4]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                      AI Optimized Spoilage
                    </span>
                    <p className="text-xl font-mono font-extrabold text-[#202124]">
                      {summary.smart_total_waste_units.toLocaleString()} u
                    </p>
                    <span className="text-xs text-[#4285F4] font-medium">
                      {summary.smart_waste_rate_pct}% spoilage rate
                    </span>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#34A853] rounded-2xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E6F4EA] text-[#34A853] flex items-center justify-center font-bold animate-pulse-green">
                    <TrendingDown className="w-6 h-6 text-[#34A853]" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333]">
                      Total Spoilage Reduction
                    </span>
                    <p className="text-2xl font-mono font-extrabold text-[#34A853]">
                      -{summary.waste_reduction_pct}%
                    </p>
                    <span className="text-xs text-[#5F6368]">
                      Quantile Loss + Markdown Optimization
                    </span>
                  </div>
                </div>

                {/* Operational Horizon Switcher */}
                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                    Operational Horizon
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => setGameMode("interactive")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        gameMode === "interactive"
                          ? "bg-[#E8F0FE] text-[#1967D2] border border-[#4285F4]"
                          : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Daily Simulation</span>
                    </button>
                    <button
                      onClick={() => setGameMode("sandbox")}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        gameMode === "sandbox"
                          ? "bg-[#E8F0FE] text-[#1967D2] border border-[#4285F4]"
                          : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                      }`}
                    >
                      <Table className="w-3.5 h-3.5" />
                      <span>7-Day Rollup</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Store, Product & Evening Clearance Configuration Ribbon */}
            <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2">
                  <Building2 className="w-3.5 h-3.5 text-[#4285F4]" />
                  <span>1. Select Retail Store</span>
                </label>
                <select
                  value={selectedStore}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  className="w-full bg-[#F8F9FA] border border-[#DADCE0] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202124] focus:outline-none focus:border-[#4285F4]"
                >
                  {stores.map((s) => (
                    <option key={s} value={s}>
                      FreshMart Store #{s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2">
                  <Package className="w-3.5 h-3.5 text-[#34A853]" />
                  <span>2. Select Perishable SKU</span>
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(Number(e.target.value))}
                  className="w-full bg-[#F8F9FA] border border-[#DADCE0] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#202124] focus:outline-none focus:border-[#4285F4]"
                >
                  {currentProducts.map((p) => (
                    <option key={p} value={p}>
                      Perishable Product #{p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[#5F6368]">
                    <Tag className="w-3.5 h-3.5 text-[#B06000]" />
                    <span>3. Evening Clearance Markdown</span>
                  </span>
                  <span className="bg-[#FEF7E0] text-[#B06000] px-2.5 py-0.5 rounded-full font-mono">
                    +{markdownBoost}% Evening Demand
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="5"
                  value={markdownBoost}
                  onChange={(e) => setMarkdownBoost(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-[11px] text-[#5F6368] block mt-1">
                  Accelerates inventory turnover during evening hours before shelf expiry
                </span>
              </div>
            </div>

            {/* ===================================================== */}
            {/* SUB-MODE A: SINGLE-DAY INTERACTIVE SIMULATION         */}
            {/* ===================================================== */}
            {gameMode === "interactive" && activeDay && activeOutcome && (
              <div className="space-y-6">
                {/* 7-Day Planning Horizon Timeline */}
                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                      7-Day Operational Planning Horizon (Select day to inspect)
                    </span>
                    <span className="text-xs font-mono text-[#4285F4] font-semibold">
                      Simulated: {dayHistory.length} / {dailyList.length} Days
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2.5">
                    {dailyList.map((d, idx) => {
                      const played = dayHistory.find((h) => h.dt === d.dt);
                      const isCurrent = idx === currentDayIdx;
                      return (
                        <button
                          key={d.dt}
                          onClick={() => setCurrentDayIdx(idx)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isCurrent
                              ? "bg-[#E8F0FE] border-2 border-[#4285F4] shadow-xs scale-[1.02]"
                              : played
                                ? "bg-[#E6F4EA]/60 border-[#CEEAD6] hover:bg-[#E6F4EA]"
                                : "bg-[#F8F9FA] border-[#DADCE0] hover:bg-[#F1F3F4]"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                            <span
                              className={
                                isCurrent ? "text-[#1967D2]" : "text-[#5F6368]"
                              }
                            >
                              DAY {idx + 1}
                            </span>
                            {played && (
                              <span className="bg-[#34A853] text-white px-1.5 py-0.2 rounded text-[10px]">
                                {played.grade}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[#202124] mt-1">
                            {d.dt}
                          </div>
                          <div className="text-[11px] text-[#5F6368] mt-0.5">
                            OOS: {d.stock_hour6_22_cnt}h
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Main Dashboard Deck: Replenishment Decision | Shelf Movement Visualizer */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Replenishment Order Configuration */}
                  <div className="lg:col-span-5 bg-white border border-[#DADCE0] rounded-2xl p-6 shadow-2xs space-y-5">
                    <div className="flex items-center justify-between border-b border-[#E8EAED] pb-4">
                      <div>
                        <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-[#E8F0FE] text-[#1967D2]">
                          Day {currentDayIdx + 1} Replenishment Configuration • {activeDay.dt}
                        </span>
                        <h3 className="text-lg font-extrabold text-[#202124] mt-2">
                          06:00 AM Replenishment Order
                        </h3>
                      </div>
                    </div>

                    {/* Operational Telemetry Clues */}
                    <div className="grid grid-cols-2 gap-3 bg-[#F8F9FA] p-3.5 rounded-xl border border-[#E8EAED] text-xs">
                      <div>
                        <span className="text-[#5F6368] block">
                          Historical Raw POS Sales
                        </span>
                        <span className="text-base font-mono font-bold text-[#202124] flex items-center gap-1.5 mt-0.5">
                          <TrendingUp className="w-4 h-4 text-[#4285F4]" />
                          {activeDay.sale_amount} units
                        </span>
                      </div>
                      <div>
                        <span className="text-[#5F6368] block">
                          Empty-Shelf Censoring
                        </span>
                        {activeDay.stock_hour6_22_cnt > 0 ? (
                          <span className="text-sm font-mono font-bold text-[#EA4335] flex items-center gap-1.5 mt-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#EA4335]" />
                            {activeDay.stock_hour6_22_cnt} hrs Out-of-Stock
                          </span>
                        ) : (
                          <span className="text-sm font-mono font-bold text-[#34A853] flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#34A853]" />
                            0 hrs (Fully In Stock)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Replenishment Strategy Cards */}
                    <div className="space-y-2.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                        Replenishment Strategy:
                      </label>

                      {/* Option A: Baseline Heuristic */}
                      <button
                        onClick={() => setOrderStrategy("naive")}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          orderStrategy === "naive"
                            ? "bg-[#FCE8E6]/50 border-2 border-[#EA4335]"
                            : "bg-white border-[#DADCE0] hover:bg-[#F8F9FA]"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-[#202124] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#EA4335]" />
                            <span>Strategy A: Baseline Store Rule (Mean + 20% Buffer)</span>
                          </div>
                          <div className="text-[11px] text-[#5F6368] mt-0.5">
                            Standard safety stock buffer; elevated risk of end-of-day spoilage
                          </div>
                        </div>
                        <span className="font-mono text-base font-extrabold text-[#EA4335]">
                          {activeDay.naive_order} u
                        </span>
                      </button>

                      {/* Option B: LightGBM Waste-Aware AI */}
                      <button
                        onClick={() => setOrderStrategy("ai")}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          orderStrategy === "ai"
                            ? "bg-[#E8F0FE]/70 border-2 border-[#4285F4] shadow-2xs"
                            : "bg-white border-[#DADCE0] hover:bg-[#F8F9FA]"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1967D2] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#1967D2]" />
                              <span>Strategy B: LightGBM Waste-Aware AI (α=0.40)</span>
                            </span>
                            <span className="text-[10px] bg-[#34A853] text-white px-2 py-0.5 rounded-full font-bold">
                              RECOMMENDED
                            </span>
                          </div>
                          <div className="text-[11px] text-[#5F6368] mt-0.5">
                            Uncensored Quantile forecast calibrated to minimize retail inventory waste
                          </div>
                        </div>
                        <span className="font-mono text-base font-extrabold text-[#4285F4]">
                          {activeDay.smart_order} u
                        </span>
                      </button>

                      {/* Option C: Custom Manual Override */}
                      <div
                        onClick={() => setOrderStrategy("custom")}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          orderStrategy === "custom"
                            ? "bg-[#FEF7E0]/60 border-2 border-[#FBBC04]"
                            : "bg-white border-[#DADCE0] hover:bg-[#F8F9FA]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[#202124] flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#B06000]" />
                            <span>Strategy C: Manual Operational Override</span>
                          </span>
                          <span className="font-mono text-base font-extrabold text-[#B06000]">
                            {customOrderQty} u
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={Math.max(
                            30,
                            Math.ceil(activeDay.naive_order * 1.5),
                          )}
                          step="0.5"
                          value={customOrderQty}
                          onChange={(e) => {
                            setOrderStrategy("custom");
                            setCustomOrderQty(Number(e.target.value));
                          }}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Execution Controls */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSimulateDay}
                        disabled={simPhase === "running"}
                        className="flex-1 bg-[#4285F4] hover:bg-[#1A73E8] text-white font-bold text-sm py-3 px-5 rounded-xl shadow-sm transition transform active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        <span>
                          {simPhase === "running"
                            ? "Simulating Operational Day..."
                            : "Run Day Simulation"}
                        </span>
                      </button>
                      {currentDayIdx < dailyList.length - 1 && (
                        <button
                          onClick={() => setCurrentDayIdx((i) => i + 1)}
                          className="bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#202124] font-bold text-sm py-3 px-4 rounded-xl border border-[#DADCE0] transition cursor-pointer flex items-center gap-1.5"
                        >
                          <span>Next Day</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Virtual Shelf Movement & Performance Audit */}
                  <div className="lg:col-span-7 bg-white border border-[#DADCE0] rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-5">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8EAED] pb-4">
                        <div>
                          <h3 className="text-base font-extrabold text-[#202124] flex items-center gap-2">
                            <Store className="w-4 h-4 text-[#4285F4]" />
                            <span>Virtual Shelf Allocation & Movement (20-Crate Matrix)</span>
                          </h3>
                          <p className="text-xs text-[#5F6368] mt-0.5">
                            Allocation tracking: Morning order ({chosenOrderQty}{" "}
                            units) vs. Uncensored True Demand (
                            {activeDay.true_demand} units).
                          </p>
                        </div>

                        {/* Operational Efficiency Rating */}
                        <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#DADCE0] px-3.5 py-1.5 rounded-2xl">
                          <span className="text-xs font-bold text-[#5F6368]">
                            EFFICIENCY RATING:
                          </span>
                          <span
                            className={`text-xl font-mono font-black ${
                              activeOutcome.grade === "S+"
                                ? "text-[#34A853]"
                                : activeOutcome.grade === "A"
                                  ? "text-[#4285F4]"
                                  : activeOutcome.grade === "B"
                                    ? "text-[#FBBC04]"
                                    : "text-[#EA4335]"
                            }`}
                          >
                            {activeOutcome.grade}
                          </span>
                        </div>
                      </div>

                      {/* Live Intraday Status Banner */}
                      {simClockText && (
                        <div className="mt-4 bg-[#E8F0FE] border border-[#4285F4]/40 text-[#1967D2] px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between animate-card-enter">
                          <span className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-[#1967D2] animate-pulse" />
                            {simClockText}
                          </span>
                          {simPhase === "done" && (
                            <span className="bg-[#34A853] text-white px-2.5 py-0.5 rounded-full text-[11px] font-sans">
                              Audit Reconciled
                            </span>
                          )}
                        </div>
                      )}

                      {/* 20 Animated Shelf Crates Matrix */}
                      <div className="mt-5 bg-[#F8F9FA] border border-[#DADCE0] rounded-2xl p-4">
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2.5">
                          {shelfCrates.map((crate, idx) => (
                            <div
                              key={`${currentDayIdx}-${chosenOrderQty}-${markdownBoost}-${idx}`}
                              style={{
                                animationDelay: `${idx * 22}ms`,
                                backgroundColor:
                                  crate.type === "sold"
                                    ? "#E6F4EA"
                                    : crate.type === "markdown"
                                      ? "#FEF7E0"
                                      : crate.type === "waste"
                                        ? "#FCE8E6"
                                        : "#F1F3F4",
                                borderColor: crate.color,
                              }}
                              className="animate-crate h-14 rounded-xl border-2 flex flex-col items-center justify-center p-1 shadow-2xs"
                              title={crate.label}
                            >
                              <div className="flex items-center justify-center">
                                {crate.type === "sold" && (
                                  <PackageCheck className="w-4 h-4 text-[#34A853]" />
                                )}
                                {crate.type === "markdown" && (
                                  <Tag className="w-4 h-4 text-[#FBBC04]" />
                                )}
                                {crate.type === "waste" && (
                                  <AlertCircle className="w-4 h-4 text-[#EA4335]" />
                                )}
                                {crate.type === "empty" && (
                                  <Minus className="w-3.5 h-3.5 text-[#9AA0A6]" />
                                )}
                              </div>
                              <span
                                style={{ color: crate.color }}
                                className="text-[9px] font-mono font-extrabold uppercase mt-1"
                              >
                                {crate.type === "empty" ? "IDLE" : crate.type}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-[#E8EAED] text-xs font-semibold">
                          <span className="flex items-center gap-1.5 text-[#137333]">
                            <span className="w-3 h-3 rounded-sm bg-[#34A853] inline-block" />
                            Sold Full Price: {activeOutcome.regularSold} u
                          </span>
                          <span className="flex items-center gap-1.5 text-[#B06000]">
                            <span className="w-3 h-3 rounded-sm bg-[#FBBC04] inline-block" />
                            Cleared by 18:00 Markdown: {activeOutcome.markdownSaved}{" "}
                            u
                          </span>
                          <span className="flex items-center gap-1.5 text-[#C5221F]">
                            <span className="w-3 h-3 rounded-sm bg-[#EA4335] inline-block" />
                            Spoiled Waste: {activeOutcome.spoiledWaste} u
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Outcome Comparison Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-[#FCE8E6]/50 border border-[#FAD2CF]">
                        <span className="text-[11px] font-bold text-[#C5221F] uppercase block">
                          Baseline Rule Waste
                        </span>
                        <span className="text-xl font-mono font-extrabold text-[#EA4335]">
                          {activeDay.naive_waste} units
                        </span>
                        <span className="text-[11px] text-[#5F6368] block">
                          Without Quantile AI or Markdown
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#E8F0FE]/60 border border-[#D2E3FC]">
                        <span className="text-[11px] font-bold text-[#1967D2] uppercase block">
                          Your Spoiled Waste
                        </span>
                        <span className="text-xl font-mono font-extrabold text-[#1967D2]">
                          {activeOutcome.spoiledWaste} units
                        </span>
                        <span className="text-[11px] text-[#5F6368] block">
                          With +{markdownBoost}% Clearance Boost
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#E6F4EA] border border-[#CEEAD6]">
                        <span className="text-[11px] font-bold text-[#137333] uppercase block">
                          Inventory Waste Avoided
                        </span>
                        <span className="text-xl font-mono font-extrabold text-[#137333]">
                          +{activeOutcome.wasteSavedVsNaive} units
                        </span>
                        <span className="text-[11px] text-[#137333] block">
                          Shelf Efficiency: {activeOutcome.fillEfficiencyPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================== */}
            {/* SUB-MODE B: 7-DAY OVERVIEW TABLE                      */}
            {/* ===================================================== */}
            {gameMode === "sandbox" && forecast && (
              <div className="bg-white border border-[#DADCE0] rounded-2xl p-6 shadow-2xs space-y-5 animate-card-enter">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8EAED] pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-[#202124]">
                      7-Day Forecast & Inventory Breakdown — Store #
                      {forecast.store_id} / Product #{forecast.product_id}
                    </h2>
                    <p className="text-xs text-[#5F6368]">
                      Detailed daily log of empty-shelf hours, uncensored demand, and replenishment waste metrics.
                    </p>
                  </div>
                  <div className="flex gap-3 font-mono text-xs">
                    <div className="bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] px-3.5 py-2 rounded-xl">
                      <span className="block text-[10px] uppercase font-bold">
                        7d Baseline Waste
                      </span>
                      <span className="text-base font-extrabold">
                        {forecast.total_7d_naive_waste} u
                      </span>
                    </div>
                    <div className="bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] px-3.5 py-2 rounded-xl">
                      <span className="block text-[10px] uppercase font-bold">
                        7d AI Smart Waste
                      </span>
                      <span className="text-base font-extrabold">
                        {forecast.total_7d_smart_waste} u
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#DADCE0] text-[#5F6368] uppercase bg-[#F8F9FA]">
                        <th className="py-3 px-3 rounded-tl-lg">Date</th>
                        <th className="py-3 px-3 text-right">Raw Sales</th>
                        <th className="py-3 px-3 text-right">
                          Empty Shelf Hrs
                        </th>
                        <th className="py-3 px-3 text-right text-[#202124]">
                          True Demand
                        </th>
                        <th className="py-3 px-3 text-right">Baseline Order</th>
                        <th className="py-3 px-3 text-right text-[#EA4335]">
                          Baseline Waste
                        </th>
                        <th className="py-3 px-3 text-right text-[#4285F4]">
                          AI Smart Order
                        </th>
                        <th className="py-3 px-3 text-right text-[#34A853] rounded-tr-lg">
                          AI Smart Waste
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EAED]">
                      {forecast.daily_data.map((day) => (
                        <tr
                          key={day.dt}
                          className="hover:bg-[#F8F9FA] transition"
                        >
                          <td className="py-3.5 px-3 font-bold text-[#202124]">
                            {day.dt}
                          </td>
                          <td className="py-3.5 px-3 text-right text-[#5F6368]">
                            {day.sale_amount}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {day.stock_hour6_22_cnt > 0 ? (
                              <span className="bg-[#FCE8E6] text-[#C5221F] font-bold px-2.5 py-0.5 rounded-full">
                                {day.stock_hour6_22_cnt} hrs
                              </span>
                            ) : (
                              <span className="bg-[#E6F4EA] text-[#137333] px-2 py-0.5 rounded-full">
                                0 hrs
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-[#202124]">
                            {day.true_demand}
                          </td>
                          <td className="py-3.5 px-3 text-right text-[#5F6368]">
                            {day.naive_order}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-[#EA4335]">
                            {day.naive_waste}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-[#4285F4]">
                            {day.smart_order}
                          </td>
                          <td className="py-3.5 px-3 text-right font-extrabold text-[#34A853]">
                            {day.smart_waste}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* PAGE 2: 6-MODEL COMPARATIVE BENCHMARK                     */}
        {/* ========================================================= */}
        {activePage === "evaluation" && (
          <div className="space-y-6 animate-card-enter">
            {/* End-to-End System Architecture Ribbon */}
            <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124] mb-1">
                Part A: System Architecture & Execution Pipeline
              </h2>
              <p className="text-xs text-[#5F6368] mb-4">
                Benchmarked across {dsInfo.train_rows?.toLocaleString()} training
                observations and {dsInfo.eval_rows?.toLocaleString()} evaluation rows (
                {dsInfo.stores_evaluated} store locations, {dsInfo.products_evaluated}{" "}
                perishable SKUs).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#E8F0FE]/50 border border-[#D2E3FC]">
                  <span className="font-mono font-bold text-[#1967D2] block mb-1">
                    1. UNCENSORING ENGINE
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    Recovers suppressed demand during zero-inventory events (
                    <code className="text-[#1967D2]">16 / in_stock_hrs</code>).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#FEF7E0]/60 border border-[#FDE293]">
                  <span className="font-mono font-bold text-[#B06000] block mb-1">
                    2. FEATURE PIPELINE
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    13 temporal & weather signals (
                    <code className="text-[#B06000]">lag_1</code>,{" "}
                    <code className="text-[#B06000]">lag_7</code>,{" "}
                    <code className="text-[#B06000]">rolling_mean_7</code>,
                    rainfall, temperature).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#FCE8E6]/50 border border-[#FAD2CF]">
                  <span className="font-mono font-bold text-[#C5221F] block mb-1">
                    3. 6-MODEL BENCHMARK
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    Evaluates Linear, Bagging (Random Forest), and Boosting (XGBoost,
                    CatBoost, LightGBM) on GPU runtimes.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#E6F4EA]/70 border border-[#CEEAD6]">
                  <span className="font-mono font-bold text-[#137333] block mb-1">
                    4. QUANTILE + MARKDOWN
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    Combines <code className="text-[#137333]">α=0.40</code> Pinball
                    Loss with 30% evening clearance to eliminate waste.
                  </p>
                </div>
              </div>
            </div>

            {/* 6-Model Leaderboard Table */}
            <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124]">
                  Part B: Comparative Analysis Across Machine Learning
                  Architectures
                </h2>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Benchmarks Training Speed, Error Metrics (MAE, RMSE, R², WAPE,
                  Pinball Loss), and Production Waste KPIs.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[#5F6368] uppercase">
                      <th className="py-3.5 px-3">Model / Architecture</th>
                      <th className="py-3.5 px-3 text-right">Train Time</th>
                      <th className="py-3.5 px-3 text-right">MAE</th>
                      <th className="py-3.5 px-3 text-right">RMSE</th>
                      <th className="py-3.5 px-3 text-right">R²</th>
                      <th className="py-3.5 px-3 text-right">WAPE (%)</th>
                      <th className="py-3.5 px-3 text-right">Pinball</th>
                      <th className="py-3.5 px-3 text-right">Waste Rate</th>
                      <th className="py-3.5 px-3 text-right">Fill Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EAED]">
                    {models.map((m, idx) => {
                      const isProposed = idx === models.length - 1;
                      return (
                        <tr
                          key={m.model_name}
                          className={
                            isProposed
                              ? "bg-[#E6F4EA]/70 font-bold text-[#202124]"
                              : "hover:bg-[#F8F9FA] text-[#202124]"
                          }
                        >
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  isProposed
                                    ? "text-[#137333] font-extrabold"
                                    : "font-bold"
                                }
                              >
                                {m.model_name}
                              </span>
                              {isProposed && (
                                <span className="bg-[#34A853] text-white text-[10px] px-2 py-0.5 rounded-full">
                                  OPTIMAL
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-sans text-[#5F6368]">
                              {m.description}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right text-[#4285F4] font-bold">
                            {m.train_time_sec}s
                          </td>
                          <td className="py-3.5 px-3 text-right">{m.mae}</td>
                          <td className="py-3.5 px-3 text-right">{m.rmse}</td>
                          <td className="py-3.5 px-3 text-right">
                            {m.r2_score}
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold">
                            {m.wape_pct}%
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {m.pinball_loss}
                          </td>
                          <td
                            className={`py-3.5 px-3 text-right font-extrabold ${
                              isProposed ? "text-[#137333]" : "text-[#EA4335]"
                            }`}
                          >
                            {m.waste_rate_pct}%
                          </td>
                          <td className="py-3.5 px-3 text-right font-bold text-[#1967D2]">
                            {m.fill_rate_pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4 Comparative KPI Metric Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* WAPE Error Bars (Google Blue) */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    1. Forecast Error (WAPE % ↓)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    Gradient boosting minimizes error compared to linear baselines.
                  </p>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  {models.map((m) => (
                    <div key={m.model_name} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#202124] truncate pr-2 font-medium">
                          {m.model_name}
                        </span>
                        <span className="text-[#1967D2] font-bold">
                          {m.wape_pct}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#F1F3F4] rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, m.wape_pct * 1.8)}%`,
                          }}
                          className="h-full bg-[#4285F4] rounded-full transition-all duration-700"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Training Time (Google Yellow) */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    2. Training Duration (Seconds ↓)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    LightGBM histogram partitioning trains significantly faster.
                  </p>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  {models.map((m) => {
                    const widthPct = Math.max(
                      8,
                      (m.train_time_sec / maxTrainTime) * 100,
                    );
                    return (
                      <div key={m.model_name} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[#202124] truncate pr-2 font-medium">
                            {m.model_name}
                          </span>
                          <span className="text-[#B06000] font-bold">
                            {m.train_time_sec}s
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#F1F3F4] rounded-full overflow-hidden">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className="h-full bg-[#FBBC04] rounded-full transition-all duration-700"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Food Waste Rate (Google Red vs Google Green) */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    3. Spoilage Waste Rate (% ↓)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    Quantile loss paired with markdown cuts waste substantially.
                  </p>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  {models.map((m, idx) => {
                    const isProposed = idx === models.length - 1;
                    return (
                      <div key={m.model_name} className="space-y-1">
                        <div className="flex justify-between">
                          <span
                            className={`truncate pr-2 ${
                              isProposed
                                ? "text-[#137333] font-extrabold"
                                : "text-[#202124] font-medium"
                            }`}
                          >
                            {m.model_name}
                          </span>
                          <span
                            className={`font-bold ${
                              isProposed ? "text-[#137333]" : "text-[#EA4335]"
                            }`}
                          >
                            {m.waste_rate_pct}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#F1F3F4] rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, m.waste_rate_pct * 2.5)}%`,
                            }}
                            className={`h-full rounded-full transition-all duration-700 ${
                              isProposed ? "bg-[#34A853]" : "bg-[#EA4335]"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Goodness of Fit R² Score */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    4. Explained Variance (R² Score ↑)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    Captures 81–84% variance across evaluation demand signals.
                  </p>
                </div>
                <div className="space-y-3 font-mono text-xs">
                  {models.map((m, idx) => {
                    const isProposed = idx === models.length - 1;
                    const widthPct = Math.min(
                      100,
                      Math.max(10, (m.r2_score || 0) * 100),
                    );
                    return (
                      <div key={m.model_name} className="space-y-1">
                        <div className="flex justify-between">
                          <span
                            className={`truncate pr-2 ${
                              isProposed
                                ? "text-[#137333] font-extrabold"
                                : "text-[#202124] font-medium"
                            }`}
                          >
                            {m.model_name}
                          </span>
                          <span
                            className={`font-bold ${
                              isProposed ? "text-[#137333]" : "text-[#1967D2]"
                            }`}
                          >
                            {m.r2_score}
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#F1F3F4] rounded-full overflow-hidden">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className={`h-full rounded-full transition-all duration-700 ${
                              isProposed ? "bg-[#34A853]" : "bg-[#4285F4]"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Part C: Variable Correlation Matrix */}
            <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124]">
                      Part C: Variable Correlation Matrix (<code className="font-mono text-[#1967D2]">df.corr()</code>)
                    </h2>
                    <span className="bg-[#E8F0FE] text-[#1967D2] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                      Feature Relationships
                    </span>
                  </div>
                  <p className="text-xs text-[#5F6368] mt-0.5">
                    Pairwise Pearson correlation coefficients (<code className="font-mono text-[#202124]">r ∈ [-1, +1]</code>) across evaluation observations.
                  </p>
                </div>

                {/* View Switcher Pills */}
                <div className="flex items-center p-1 bg-[#F1F3F4] rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setCorrView("features")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      corrView === "features"
                        ? "bg-white text-[#1967D2] shadow-xs font-bold"
                        : "text-[#5F6368] hover:text-[#202124]"
                    }`}
                  >
                    Feature & Target (9 × 9)
                  </button>
                  <button
                    onClick={() => setCorrView("models")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                      corrView === "models"
                        ? "bg-white text-[#1967D2] shadow-xs font-bold"
                        : "text-[#5F6368] hover:text-[#202124]"
                    }`}
                  >
                    Model Predictions vs Target (6 × 6)
                  </button>
                </div>
              </div>

              {/* Dynamic Hover / Tooltip Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 py-2.5 bg-[#F8F9FA] border border-[#E8EAED] rounded-xl text-xs font-mono gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[#5F6368]">Inspection Focus:</span>
                  {hoveredCell ? (
                    <span className="text-[#202124] font-bold">
                      {hoveredCell.rowLabel} ↔ {hoveredCell.colLabel} :{" "}
                      <span
                        className={
                          hoveredCell.val > 0
                            ? "text-[#1967D2]"
                            : hoveredCell.val < 0
                              ? "text-[#EA4335]"
                              : "text-[#5F6368]"
                        }
                      >
                        {hoveredCell.val > 0 ? `+${hoveredCell.val}` : hoveredCell.val}
                      </span>{" "}
                      <span className="text-[11px] font-sans text-[#5F6368] font-normal">
                        ({Math.abs(hoveredCell.val) >= 0.8
                          ? "Strong Linear Association"
                          : Math.abs(hoveredCell.val) >= 0.4
                            ? "Moderate Association"
                            : Math.abs(hoveredCell.val) >= 0.1
                              ? "Weak Association"
                              : "Orthogonal / Low Collinearity"})
                      </span>
                    </span>
                  ) : (
                    <span className="text-[#5F6368] italic font-sans">
                      Hover over any heatmap cell below to inspect pairwise Pearson r
                    </span>
                  )}
                </div>

                {/* Color Legend */}
                <div className="flex items-center gap-2 text-[11px] font-sans">
                  <span className="text-[#5F6368]">Legend:</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-xs bg-[#EA4335]" />
                    <span className="text-[#C5221F] font-mono text-[10px]">-1.0 (Inverse)</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-xs bg-white border border-[#DADCE0]" />
                    <span className="text-[#5F6368] font-mono text-[10px]">0.0</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-3 rounded-xs bg-[#1A73E8]" />
                    <span className="text-[#1967D2] font-mono text-[10px]">+1.0 (Direct)</span>
                  </span>
                </div>
              </div>

              {/* Heatmap Matrix Table */}
              {correlationData[corrView] ? (
                <div className="overflow-x-auto border border-[#E8EAED] rounded-xl shadow-2xs">
                  <table className="w-full text-center border-collapse text-xs font-mono">
                    <thead>
                      <tr className="bg-[#F8F9FA] border-b border-[#DADCE0]">
                        <th className="py-2.5 px-3 text-left font-bold text-[#5F6368] bg-[#F1F3F4]/80 uppercase text-[11px] min-w-[140px] sticky left-0 z-10 border-r border-[#DADCE0]">
                          Variable
                        </th>
                        {correlationData[corrView].labels.map((colName) => (
                          <th
                            key={colName}
                            className="py-2.5 px-2 font-bold text-[#202124] text-[11px] min-w-[90px]"
                          >
                            {colName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EAED]">
                      {correlationData[corrView].labels.map((rowName, rIdx) => (
                        <tr key={rowName} className="hover:bg-[#F8F9FA]/60">
                          <td className="py-2.5 px-3 text-left font-bold text-[#202124] text-[11px] bg-[#F8F9FA] sticky left-0 z-10 border-r border-[#DADCE0] whitespace-nowrap">
                            {rowName}
                          </td>
                          {correlationData[corrView].matrix[rIdx]?.map((val, cIdx) => {
                            const colName = correlationData[corrView].labels[cIdx];
                            const isHovered =
                              hoveredCell &&
                              hoveredCell.rowLabel === rowName &&
                              hoveredCell.colLabel === colName;
                            return (
                              <td
                                key={colName}
                                onMouseEnter={() =>
                                  setHoveredCell({ rowLabel: rowName, colLabel: colName, val })
                                }
                                onMouseLeave={() => setHoveredCell(null)}
                                className={`py-2 px-1 text-center transition-all cursor-pointer select-none ${getCorrColor(
                                  val,
                                )} ${
                                  isHovered ? "ring-2 ring-[#1A73E8] ring-inset z-20 scale-105" : ""
                                }`}
                              >
                                <span className="block text-[11px]">
                                  {val > 0
                                    ? val === 1
                                      ? "1.00"
                                      : `+${val.toFixed(2)}`
                                    : val.toFixed(2)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-[#5F6368] text-xs">
                  Loading correlation data...
                </div>
              )}

              {/* Takeaway Insight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-[#E8F0FE]/60 border border-[#D2E3FC] text-xs">
                  <span className="font-bold text-[#1967D2] block mb-1">
                    1. Strong Autocorrelation (r = +0.90)
                  </span>
                  <p className="text-[#5F6368] text-[11px] leading-relaxed">
                    <code className="text-[#1967D2]">rolling_mean_7</code> and <code className="text-[#1967D2]">lag_7</code> have the highest correlation with demand, providing steady baseline turnover signals.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FCE8E6]/60 border border-[#FAD2CF] text-xs">
                  <span className="font-bold text-[#C5221F] block mb-1">
                    2. Price Elasticity (r = -0.35)
                  </span>
                  <p className="text-[#5F6368] text-[11px] leading-relaxed">
                    Discount correlates inversely with unit sale pricing, verifying that markdown promotions accelerate volume velocity to clear surplus shelf life.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#E6F4EA]/70 border border-[#CEEAD6] text-xs">
                  <span className="font-bold text-[#137333] block mb-1">
                    3. Model Consensus (r &gt; 0.91)
                  </span>
                  <p className="text-[#5F6368] text-[11px] leading-relaxed">
                    All evaluated gradient boosted models achieve <code className="text-[#137333]">r &gt; 0.91</code> with actual demand. The proposed quantile model aligns with demand while shifting orders to prevent waste.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature Importance + Key Architectural Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                  LightGBM Feature Importance (% Split Gain)
                </h3>
                <div className="space-y-2.5 font-mono text-xs">
                  {features.slice(0, 7).map((f, i) => {
                    const colors = ["#4285F4", "#34A853", "#FBBC04", "#EA4335"];
                    const barColor = colors[i % colors.length];
                    return (
                      <div key={f.feature} className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[#202124] font-semibold">
                            {f.feature}
                          </span>
                          <span className="text-[#5F6368] font-bold">
                            {f.importance_pct}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-[#F1F3F4] rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, f.importance_pct * 3)}%`,
                              backgroundColor: barColor,
                            }}
                            className="h-full rounded-full transition-all duration-700"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                  Key Architectural & Empirical Insights
                </h3>
                <ul className="space-y-2.5 text-xs text-[#5F6368] leading-relaxed list-disc pl-4">
                  <li>
                    <strong className="text-[#202124]">
                      Bagging (Random Forest) vs. Boosting (XGBoost / CatBoost /
                      LightGBM):
                    </strong>{" "}
                    Gradient boosted trees reduce RMSE and achieve superior{" "}
                    <code className="text-[#1967D2]">R²</code> by iteratively
                    minimizing residuals.
                  </li>
                  <li>
                    <strong className="text-[#202124]">
                      Efficiency Advantage of LightGBM:
                    </strong>{" "}
                    Leaf-wise histogram splitting achieved accuracy on par with
                    XGBoost and CatBoost while training significantly faster.
                  </li>
                  <li>
                    <strong className="text-[#137333]">
                      Operational Impact (Quantile α=0.40 + Evening Markdown):
                    </strong>{" "}
                    Standard models predict symmetric averages (causing
                    over-stocking waste). Asymmetric Pinball loss combined with
                    18:00 clearance cuts perishable waste by over 50%.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
