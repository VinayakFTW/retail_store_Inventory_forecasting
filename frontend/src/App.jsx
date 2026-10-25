import React, { useState, useEffect, useMemo } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [activePage, setActivePage] = useState("game"); // "game" | "evaluation"
  const [gameMode, setGameMode] = useState("interactive"); // "interactive" | "sandbox"

  const [summary, setSummary] = useState(null);
  const [stores, setStores] = useState([]);
  const [productsByStore, setProductsByStore] = useState({});
  const [selectedStore, setSelectedStore] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [markdownBoost, setMarkdownBoost] = useState(15);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Interactive Day-by-Day Game State
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [orderStrategy, setOrderStrategy] = useState("ai"); // "naive" | "ai" | "custom"
  const [customOrderQty, setCustomOrderQty] = useState(10);
  const [simPhase, setSimPhase] = useState("idle"); // "idle" | "running" | "done"
  const [simClockText, setSimClockText] = useState("");
  const [dayHistory, setDayHistory] = useState([]);
  const [xp, setXp] = useState(350);
  const [coins, setCoins] = useState(120);
  const [streak, setStreak] = useState(2);

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

  // Compute current player order based on strategy choice
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

    return {
      trueDem,
      regularSold,
      markdownSaved,
      totalSold,
      spoiledWaste,
      unfulfilled,
      wasteSavedVsNaive,
      grade,
      xpEarned:
        grade === "S+" ? 120 : grade === "A" ? 85 : grade === "B" ? 50 : 25,
      coinsEarned: Math.round(wasteSavedVsNaive * 15 + totalSold * 5),
    };
  }, [activeDay, chosenOrderQty, markdownBoost]);

  // Run animated intraday clock simulation
  const handleSimulateDay = () => {
    if (!activeDay || !activeOutcome || simPhase === "running") return;
    setSimPhase("running");
    setSimClockText("☀️ 06:00 AM — Morning Delivery Restocking Shelves...");

    setTimeout(() => {
      setSimClockText("🛒 12:30 PM — Midday Shopper Rush in Progress...");
    }, 350);

    setTimeout(() => {
      setSimClockText(
        `🏷️ 06:00 PM — Evening Markdown Triggered (+${markdownBoost}% Demand Boost)...`,
      );
    }, 750);

    setTimeout(() => {
      setSimClockText("🌙 11:59 PM — Store Closed! Calculating Waste & XP...");
      setSimPhase("done");
      setXp((prev) => prev + activeOutcome.xpEarned);
      setCoins((prev) => prev + activeOutcome.coinsEarned);
      if (activeOutcome.grade === "S+" || activeOutcome.grade === "A") {
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
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

  // Player Level & Title
  const playerLevel = Math.floor(xp / 250) + 1;
  const xpProgressPct = ((xp % 250) / 250) * 100;
  const rankTitle =
    playerLevel >= 5
      ? "Zero-Waste Grandmaster"
      : playerLevel >= 3
        ? "AI Supply Chain Architect"
        : "Eco-Store Strategist";

  const currentProducts = productsByStore[selectedStore] || [];
  const models = summary?.comparative_models || [];
  const features = summary?.feature_importance || [];
  const dsInfo = summary?.dataset_info || {};
  const maxTrainTime = Math.max(...models.map((m) => m.train_time_sec || 1), 1);

  // Build 20 visual shelf crates for the animated shelf graphic
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
          label: "Cleared by 6PM Discount",
          color: "#FBBC04",
        });
      } else if (i < regCount + mkdCount + wasteCount) {
        boxes.push({ type: "waste", label: "Spoiled Waste", color: "#EA4335" });
      } else {
        boxes.push({
          type: "empty",
          label: "Unused Shelf Capacity",
          color: "#E8EAED",
        });
      }
    }
    return boxes;
  }, [activeDay, activeOutcome, chosenOrderQty]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] pb-16">
      {/* ========================================================= */}
      {/* TOP GOOGLE-THEMED GAMIFIED HUD NAVBAR                     */}
      {/* ========================================================= */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#DADCE0] shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand Logo with Google 4-Color Dots */}
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
                  FreshMart <span className="text-[#4285F4]">AI Tycoon</span>
                </h1>
                <span className="text-[11px] font-mono font-semibold bg-[#E8F0FE] text-[#1967D2] px-2.5 py-0.5 rounded-full">
                  FreshRetailNet-50K
                </span>
              </div>
              <p className="text-xs text-[#5F6368]">
                Gamified Perishable Inventory & LightGBM Waste Reduction
                Simulator
              </p>
            </div>
          </div>

          {/* Gamified Player Stats Pill Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Level & XP Bar */}
            <div className="flex items-center gap-3 bg-[#F8F9FA] border border-[#DADCE0] px-3.5 py-1.5 rounded-full">
              <div className="w-7 h-7 rounded-full bg-[#4285F4] text-white font-mono text-xs font-bold flex items-center justify-center shadow-xs">
                L{playerLevel}
              </div>
              <div className="w-28">
                <div className="flex justify-between text-[10px] font-bold text-[#5F6368]">
                  <span>{rankTitle}</span>
                  <span className="text-[#4285F4]">{xp} XP</span>
                </div>
                <div className="w-full h-1.5 bg-[#E8EAED] rounded-full overflow-hidden mt-0.5">
                  <div
                    style={{ width: `${xpProgressPct}%` }}
                    className="h-full shimmer-progress rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            </div>

            {/* Eco-Coins Badge */}
            <div className="flex items-center gap-1.5 bg-[#FEF7E0] border border-[#FDE293] text-[#B06000] px-3 py-1.5 rounded-full text-xs font-mono font-bold">
              <span>🪙</span>
              <span>{coins.toLocaleString()} Eco-Pts</span>
            </div>

            {/* Zero-Waste Streak Badge */}
            <div className="flex items-center gap-1.5 bg-[#E6F4EA] border border-[#CEEAD6] text-[#137333] px-3 py-1.5 rounded-full text-xs font-mono font-bold">
              <span>🔥</span>
              <span>{streak}d Low-Waste Streak</span>
            </div>

            {/* Main Navigation Switcher */}
            <div className="flex bg-[#F1F3F4] p-1 rounded-full border border-[#DADCE0] text-xs font-semibold">
              <button
                onClick={() => setActivePage("game")}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activePage === "game"
                    ? "bg-[#4285F4] text-white shadow-xs"
                    : "text-[#5F6368] hover:text-[#202124]"
                }`}
              >
                🎮 Store Simulator Game
              </button>
              <button
                onClick={() => setActivePage("evaluation")}
                className={`px-4 py-1.5 rounded-full transition-all cursor-pointer ${
                  activePage === "evaluation"
                    ? "bg-[#4285F4] text-white shadow-xs"
                    : "text-[#5F6368] hover:text-[#202124]"
                }`}
              >
                📊 6-Model Benchmark (10/30 Marks)
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* ========================================================= */}
        {/* PAGE 1: GAMIFIED STORE SIMULATOR                          */}
        {/* ========================================================= */}
        {activePage === "game" && (
          <div className="space-y-6 animate-card-enter">
            {/* Global Impact Banner */}
            {summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#FCE8E6] text-[#EA4335] flex items-center justify-center text-xl font-bold">
                    🗑️
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                      Old Corporate Waste
                    </span>
                    <p className="text-xl font-mono font-extrabold text-[#202124]">
                      {summary.naive_total_waste_units.toLocaleString()} u
                    </p>
                    <span className="text-xs text-[#EA4335] font-medium">
                      {summary.naive_waste_rate_pct}% spoiled rate
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] text-[#4285F4] flex items-center justify-center text-xl font-bold">
                    🤖
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                      AI Smart Waste
                    </span>
                    <p className="text-xl font-mono font-extrabold text-[#202124]">
                      {summary.smart_total_waste_units.toLocaleString()} u
                    </p>
                    <span className="text-xs text-[#4285F4] font-medium">
                      {summary.smart_waste_rate_pct}% spoiled rate
                    </span>
                  </div>
                </div>

                <div className="bg-white border-2 border-[#34A853] rounded-2xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E6F4EA] text-[#34A853] flex items-center justify-center text-xl font-bold animate-pulse-green">
                    🌱
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#137333]">
                      Total Food Waste Cut
                    </span>
                    <p className="text-2xl font-mono font-extrabold text-[#34A853]">
                      -{summary.waste_reduction_pct}%
                    </p>
                    <span className="text-xs text-[#5F6368]">
                      Saved via Quantile + Markdown
                    </span>
                  </div>
                </div>

                {/* Mode Switcher Card */}
                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs flex flex-col justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                    Simulation View Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={() => setGameMode("interactive")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        gameMode === "interactive"
                          ? "bg-[#E8F0FE] text-[#1967D2] border border-[#4285F4]"
                          : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                      }`}
                    >
                      🎯 Day-by-Day Game
                    </button>
                    <button
                      onClick={() => setGameMode("sandbox")}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        gameMode === "sandbox"
                          ? "bg-[#E8F0FE] text-[#1967D2] border border-[#4285F4]"
                          : "bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
                      }`}
                    >
                      ⚡ 7-Day Overview
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Store, Product & Evening Discount Power-Up Bar */}
            <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2">
                  🏬 1. Select Retail Store
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
                <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368] mb-2">
                  🥬 2. Select Perishable SKU
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
                  <span className="uppercase tracking-wider text-[#5F6368]">
                    🏷️ 3. 6:00 PM Clearance Power-Up
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
                  Attracts bargain shoppers at night before items expire
                </span>
              </div>
            </div>

            {/* ===================================================== */}
            {/* SUB-MODE A: INTERACTIVE DAY-BY-DAY STORE MANAGER GAME */}
            {/* ===================================================== */}
            {gameMode === "interactive" && activeDay && activeOutcome && (
              <div className="space-y-6">
                {/* 7-Day Stepper Timeline */}
                <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                      7-Day Store Challenge Timeline (Click any day to play)
                    </span>
                    <span className="text-xs font-mono text-[#4285F4] font-semibold">
                      Completed: {dayHistory.length} / {dailyList.length} Days
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

                {/* Main Game Arena: Left Decision Deck | Right Animated Grocery Shelf */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Morning Briefing & Order Decision Deck */}
                  <div className="lg:col-span-5 bg-white border border-[#DADCE0] rounded-2xl p-6 shadow-2xs space-y-5">
                    <div className="flex items-center justify-between border-b border-[#E8EAED] pb-4">
                      <div>
                        <span className="text-[11px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-[#E8F0FE] text-[#1967D2]">
                          Day {currentDayIdx + 1} Morning Briefing •{" "}
                          {activeDay.dt}
                        </span>
                        <h3 className="text-lg font-extrabold text-[#202124] mt-2">
                          How much stock will you order at 6:00 AM?
                        </h3>
                      </div>
                    </div>

                    {/* Telemetry Clues */}
                    <div className="grid grid-cols-2 gap-3 bg-[#F8F9FA] p-3.5 rounded-xl border border-[#E8EAED] text-xs">
                      <div>
                        <span className="text-[#5F6368] block">
                          Historical Raw POS Sales
                        </span>
                        <span className="text-base font-mono font-bold text-[#202124]">
                          {activeDay.sale_amount} units
                        </span>
                      </div>
                      <div>
                        <span className="text-[#5F6368] block">
                          Empty-Shelf Censoring
                        </span>
                        {activeDay.stock_hour6_22_cnt > 0 ? (
                          <span className="text-sm font-mono font-bold text-[#EA4335]">
                            ⚠️ {activeDay.stock_hour6_22_cnt} hrs Out-of-Stock
                          </span>
                        ) : (
                          <span className="text-sm font-mono font-bold text-[#34A853]">
                            ✅ 0 hrs (Fully In Stock)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3 Strategy Cards */}
                    <div className="space-y-2.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                        Choose Your Replenishment Strategy:
                      </label>

                      {/* Option 1: Old Corporate Way */}
                      <button
                        onClick={() => setOrderStrategy("naive")}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          orderStrategy === "naive"
                            ? "bg-[#FCE8E6]/50 border-2 border-[#EA4335]"
                            : "bg-white border-[#DADCE0] hover:bg-[#F8F9FA]"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-[#202124]">
                            🏢 Option A: Old Store Rule (Mean + 20% Buffer)
                          </div>
                          <div className="text-[11px] text-[#5F6368]">
                            Orders extra safety stock; high risk of midnight
                            spoilage
                          </div>
                        </div>
                        <span className="font-mono text-base font-extrabold text-[#EA4335]">
                          {activeDay.naive_order} u
                        </span>
                      </button>

                      {/* Option 2: LightGBM AI Smart Order */}
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
                            <span className="text-xs font-bold text-[#1967D2]">
                              🤖 Option B: LightGBM Waste-Aware AI (α=0.40)
                            </span>
                            <span className="text-[10px] bg-[#34A853] text-white px-2 py-0.5 rounded-full font-bold">
                              RECOMMENDED
                            </span>
                          </div>
                          <div className="text-[11px] text-[#5F6368]">
                            Uncensored Quantile forecast tuned to prevent
                            over-ordering
                          </div>
                        </div>
                        <span className="font-mono text-base font-extrabold text-[#4285F4]">
                          {activeDay.smart_order} u
                        </span>
                      </button>

                      {/* Option 3: Custom Manual Slider */}
                      <div
                        onClick={() => setOrderStrategy("custom")}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                          orderStrategy === "custom"
                            ? "bg-[#FEF7E0]/60 border-2 border-[#FBBC04]"
                            : "bg-white border-[#DADCE0] hover:bg-[#F8F9FA]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-[#202124]">
                            🎚️ Option C: Custom Manager Override
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

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleSimulateDay}
                        disabled={simPhase === "running"}
                        className="flex-1 bg-[#4285F4] hover:bg-[#1A73E8] text-white font-bold text-sm py-3 px-5 rounded-xl shadow-sm transition transform active:scale-98 cursor-pointer"
                      >
                        {simPhase === "running"
                          ? "⏳ Simulating Store Day..."
                          : "▶️ Run Day Simulation (+XP)"}
                      </button>
                      {currentDayIdx < dailyList.length - 1 && (
                        <button
                          onClick={() => setCurrentDayIdx((i) => i + 1)}
                          className="bg-[#F1F3F4] hover:bg-[#E8EAED] text-[#202124] font-bold text-sm py-3 px-4 rounded-xl border border-[#DADCE0] transition cursor-pointer"
                        >
                          Next Day →
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Animated Virtual Grocery Shelf & Daily Scorecard */}
                  <div className="lg:col-span-7 bg-white border border-[#DADCE0] rounded-2xl p-6 shadow-2xs flex flex-col justify-between space-y-5">
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8EAED] pb-4">
                        <div>
                          <h3 className="text-base font-extrabold text-[#202124]">
                            🛒 Live Virtual Perishable Shelf (20-Crate
                            Visualiser)
                          </h3>
                          <p className="text-xs text-[#5F6368]">
                            Watch how your morning order ({chosenOrderQty}{" "}
                            units) performs against True Uncensored Demand (
                            {activeDay.true_demand} units).
                          </p>
                        </div>

                        {/* Daily Grade Stamp */}
                        <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#DADCE0] px-3.5 py-1.5 rounded-2xl">
                          <span className="text-xs font-bold text-[#5F6368]">
                            DAILY RANK:
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

                      {/* Live Clock Status Banner */}
                      {simClockText && (
                        <div className="mt-4 bg-[#E8F0FE] border border-[#4285F4]/40 text-[#1967D2] px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center justify-between animate-card-enter">
                          <span>{simClockText}</span>
                          {simPhase === "done" && (
                            <span className="bg-[#34A853] text-white px-2.5 py-0.5 rounded-full">
                              +{activeOutcome.xpEarned} XP Earned!
                            </span>
                          )}
                        </div>
                      )}

                      {/* 20 Animated Shelf Crates Grid */}
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
                              <span className="text-base">
                                {crate.type === "sold"
                                  ? "🥬"
                                  : crate.type === "markdown"
                                    ? "🏷️"
                                    : crate.type === "waste"
                                      ? "🗑️"
                                      : "⬜"}
                              </span>
                              <span
                                style={{ color: crate.color }}
                                className="text-[9px] font-mono font-extrabold uppercase mt-0.5"
                              >
                                {crate.type}
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
                            Saved by 6PM Discount: {activeOutcome.markdownSaved}{" "}
                            u
                          </span>
                          <span className="flex items-center gap-1.5 text-[#C5221F]">
                            <span className="w-3 h-3 rounded-sm bg-[#EA4335] inline-block" />
                            Spoiled Waste: {activeOutcome.spoiledWaste} u
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Outcome Comparison Cards (Your Choice vs. Old Rule) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="p-3.5 rounded-xl bg-[#FCE8E6]/50 border border-[#FAD2CF]">
                        <span className="text-[11px] font-bold text-[#C5221F] uppercase block">
                          Old Rule Waste
                        </span>
                        <span className="text-xl font-mono font-extrabold text-[#EA4335]">
                          {activeDay.naive_waste} units
                        </span>
                        <span className="text-[11px] text-[#5F6368] block">
                          Without AI or Discount
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
                          With +{markdownBoost}% Evening Boost
                        </span>
                      </div>

                      <div className="p-3.5 rounded-xl bg-[#E6F4EA] border border-[#CEEAD6]">
                        <span className="text-[11px] font-bold text-[#137333] uppercase block">
                          Food Saved Today
                        </span>
                        <span className="text-xl font-mono font-extrabold text-[#137333]">
                          +{activeOutcome.wasteSavedVsNaive} units
                        </span>
                        <span className="text-[11px] text-[#137333] block">
                          +{activeOutcome.coinsEarned} Eco-Points
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===================================================== */}
            {/* SUB-MODE B: INSTANT 7-DAY OVERVIEW TABLE              */}
            {/* ===================================================== */}
            {gameMode === "sandbox" && forecast && (
              <div className="bg-white border border-[#DADCE0] rounded-2xl p-6 shadow-2xs space-y-5 animate-card-enter">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E8EAED] pb-4">
                  <div>
                    <h2 className="text-base font-extrabold text-[#202124]">
                      7-Day Complete Store Breakdown — Store #
                      {forecast.store_id} / Product #{forecast.product_id}
                    </h2>
                    <p className="text-xs text-[#5F6368]">
                      Side-by-side daily comparison of Empty-Shelf Censoring,
                      True Demand, and Waste Saved.
                    </p>
                  </div>
                  <div className="flex gap-3 font-mono text-xs">
                    <div className="bg-[#FCE8E6] border border-[#FAD2CF] text-[#C5221F] px-3.5 py-2 rounded-xl">
                      <span className="block text-[10px] uppercase font-bold">
                        7d Old Waste
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
                        <th className="py-3 px-3 text-right">Old Order</th>
                        <th className="py-3 px-3 text-right text-[#EA4335]">
                          Old Waste
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
        {/* PAGE 2: 6-MODEL COMPARATIVE BENCHMARK (GOOGLE ANALYTICS)  */}
        {/* ========================================================= */}
        {activePage === "evaluation" && (
          <div className="space-y-6 animate-card-enter">
            {/* 4-Stage Architecture Ribbon */}
            <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124] mb-1">
                Part A: System Implementation & Execution Pipeline
              </h2>
              <p className="text-xs text-[#5F6368] mb-4">
                Evaluated across {dsInfo.train_rows?.toLocaleString()} training
                rows and {dsInfo.eval_rows?.toLocaleString()} test rows (
                {dsInfo.stores_evaluated} stores, {dsInfo.products_evaluated}{" "}
                perishable SKUs).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#E8F0FE]/50 border border-[#D2E3FC]">
                  <span className="font-mono font-bold text-[#1967D2] block mb-1">
                    1. UNCENSORING ENGINE
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    Recovers hidden demand when shelves were empty (
                    <code className="text-[#1967D2]">16 / in_stock_hrs</code>).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#FEF7E0]/60 border border-[#FDE293]">
                  <span className="font-mono font-bold text-[#B06000] block mb-1">
                    2. FEATURE PIPELINE
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    13 temporal & weather features (
                    <code className="text-[#B06000]">lag_1</code>,{" "}
                    <code className="text-[#B06000]">lag_7</code>,{" "}
                    <code className="text-[#B06000]">rolling_mean_7</code>,
                    rainfall, temp).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#FCE8E6]/50 border border-[#FAD2CF]">
                  <span className="font-mono font-bold text-[#C5221F] block mb-1">
                    3. 6-MODEL BENCHMARK
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    Compares Linear, Bagging (RF), and Boosting (XGBoost,
                    CatBoost, LightGBM) on GPU.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#E6F4EA]/70 border border-[#CEEAD6]">
                  <span className="font-mono font-bold text-[#137333] block mb-1">
                    4. QUANTILE + MARKDOWN
                  </span>
                  <p className="text-[#5F6368] leading-relaxed">
                    Pairs <code className="text-[#137333]">α=0.40</code> Pinball
                    Loss with a 30% evening discount to slash spoilage.
                  </p>
                </div>
              </div>
            </div>

            {/* 6-Model Leaderboard Table */}
            <div className="bg-white border border-[#DADCE0] p-6 rounded-2xl shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124]">
                  Part B: Comparative Analysis Across 6 Machine Learning
                  Families
                </h2>
                <p className="text-xs text-[#5F6368] mt-0.5">
                  Benchmarks Training Speed, Error Metrics (MAE, RMSE, R², WAPE,
                  Pinball Loss), and Retail Waste KPIs.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#DADCE0] bg-[#F8F9FA] text-[#5F6368] uppercase">
                      <th className="py-3.5 px-3">Model / Family</th>
                      <th className="py-3.5 px-3 text-right">Train Time ↓</th>
                      <th className="py-3.5 px-3 text-right">MAE ↓</th>
                      <th className="py-3.5 px-3 text-right">RMSE ↓</th>
                      <th className="py-3.5 px-3 text-right">R² ↑</th>
                      <th className="py-3.5 px-3 text-right">WAPE (%) ↓</th>
                      <th className="py-3.5 px-3 text-right">Pinball ↓</th>
                      <th className="py-3.5 px-3 text-right">Waste Rate ↓</th>
                      <th className="py-3.5 px-3 text-right">Fill Rate ↑</th>
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
                                  WINNER
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

            {/* 3 Google-Colored Visual Comparison Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* WAPE Error Bars (Google Blue) */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    1. Forecast Error (WAPE % ↓)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    Gradient boosting outperforms linear & bagging baselines.
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

              {/* Training Time (Google Yellow/Amber) */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    2. Training Time (Seconds ↓)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    LightGBM leaf-wise histograms train dramatically faster.
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

              {/* Food Waste Rate (Google Red vs Google Green Winner) */}
              <div className="bg-white border border-[#DADCE0] p-5 rounded-2xl shadow-2xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    3. Spoiled Food Waste Rate (% ↓)
                  </h3>
                  <p className="text-[11px] text-[#5F6368]">
                    Proposed Quantile + Evening Discount cuts waste in half.
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
            </div>

            {/* Feature Importance + Key Presentation Takeaways */}
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
                  Key Comparative Findings (For 10/30 Presentation Rubric)
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
                      Why LightGBM Won:
                    </strong>{" "}
                    Leaf-wise histogram splitting achieved accuracy on par with
                    XGBoost & CatBoost while training significantly faster.
                  </li>
                  <li>
                    <strong className="text-[#137333]">
                      Business Impact (Quantile α=0.40 + Evening Markdown):
                    </strong>{" "}
                    Standard ML predicts symmetric averages (causing
                    over-stocking waste). Asymmetric Pinball loss + 6 PM
                    clearance cuts food spoilage by over 50%.
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
