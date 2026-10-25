import json
import pandas as pd
import numpy as np
import lightgbm as lgb
import xgboost as xgb
from catboost import CatBoostRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error, mean_absolute_percentage_error
import os
import joblib
import time


train_path = os.path.abspath(os.path.join("data", "train.parquet"))
eval_path = os.path.abspath(os.path.join("data", "eval.parquet"))

COLS = [
    "store_id", "product_id", "first_category_id", "dt",
    "sale_amount", "stock_hour6_22_cnt", "discount",
    "holiday_flag", "precpt", "avg_temperature", "avg_humidity"
]

train_df = pd.read_parquet(train_path, columns=COLS)
eval_df = pd.read_parquet(eval_path, columns=COLS)

# top_stores = train_df["store_id"].value_counts().head(10).index
# train_df = train_df[train_df["store_id"].isin(top_stores)].copy()
# eval_df = eval_df[eval_df["store_id"].isin(top_stores)].copy()


def estimate_true_demand(df: pd.DataFrame) -> pd.DataFrame:
    in_stock_hours = (16 - df["stock_hour6_22_cnt"]).clip(lower=4)
    scale_factor = (16.0 / in_stock_hours).clip(upper=2.5)
    df["true_demand"] = df["sale_amount"] * scale_factor
    return df

train_df = estimate_true_demand(train_df)
eval_df = estimate_true_demand(eval_df)

print("Creating lag features...")
train_df["split"] = "train"
eval_df["split"] = "eval"

full_df = pd.concat([train_df, eval_df], ignore_index=True)
full_df = full_df.sort_values(["store_id", "product_id", "dt"])

full_df["dt_parsed"] = pd.to_datetime(full_df["dt"])
full_df["day_of_week"] = full_df["dt_parsed"].dt.day_of_week
full_df["is_weekend"] = (full_df["day_of_week"] >= 5).astype(int)

grp = full_df.groupby(["store_id", "product_id"])["true_demand"]
full_df["lag_1"] = grp.shift(1)
full_df["lag_7"] = grp.shift(7)
full_df["rolling_mean_7"] = grp.shift(1).rolling(7, min_periods=1).mean()

train_clean = full_df[full_df["split"] == "train"].dropna(subset=["lag_7"]).copy()
eval_clean = full_df[full_df["split"] == "eval"].fillna(0).copy()


FEATURES = [
    "store_id", "product_id", "first_category_id",
    "day_of_week", "is_weekend", "discount", "holiday_flag",
    "precpt", "avg_temperature", "avg_humidity",
    "lag_1", "lag_7", "rolling_mean_7"
]

X_train = train_clean[FEATURES]
y_train = train_clean["true_demand"]
X_eval = eval_clean[FEATURES]
y_true = eval_clean["true_demand"].to_numpy()

print("Training 5 ML models for comparative analysis...")

models_to_run = [
    {
        "id": "rf",
        "name": "1. Random Forest",
        "family": "Bagging Trees",
        "description": "Parallel decision trees (max_depth=12); accurate but slow & heavy memory",
        "estimator": RandomForestRegressor(
            n_estimators=60, max_depth=12, n_jobs=-1, random_state=42
        ),
        "safety_buffer": 1.20,
        "apply_discount": False,
    },
    {
        "id": "xgboost",
        "name": "2. XGBoost Regressor",
        "family": "Depth-Wise Boosting",
        "description": "Level-wise gradient boosted trees with MSE loss + 20% retail buffer",
        "estimator": xgb.XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05, n_jobs=-1, random_state=42
        ),
        "safety_buffer": 1.20,
        "apply_discount": False,
    },
    {
        "id": "catboost",
        "name": "3. CatBoost Regressor",
        "family": "Symmetric Boosting",
        "description": "Oblivious trees with symmetric splits + 20% retail safety buffer",
        "estimator": CatBoostRegressor(
            iterations=200, depth=6, learning_rate=0.05, verbose=0, random_seed=42
        ),
        "safety_buffer": 1.20,
        "apply_discount": False,
    },
    {
        "id": "lgbm_std",
        "name": "4. LightGBM (Standard Mean)",
        "family": "Leaf-Wise Boosting",
        "description": "Fastest leaf-wise tree boosting predicting average demand + 20% buffer",
        "estimator": lgb.LGBMRegressor(
            objective="regression", n_estimators=200, learning_rate=0.05, n_jobs=-1, random_state=42, verbose=-1
        ),
        "safety_buffer": 1.20,
        "apply_discount": False,
    },
    {
        "id": "proposed",
        "name": "5. Proposed: Waste-Aware LightGBM",
        "family": "Quantile (α=0.40) + Markdown",
        "description": "Asymmetric Pinball loss (α=0.40) + 30% evening clearance discount",
        "estimator": lgb.LGBMRegressor(
            objective="quantile", alpha=0.40, n_estimators=200, learning_rate=0.05, n_jobs=-1, random_state=42, verbose=-1
        ),
        "safety_buffer": 1.00,
        "apply_discount": True,
    },
]

comparative_models = []
trained_estimators = {}

for m in models_to_run:
    print(f"   -> Training {m['name']}...")
    t0 = time.perf_counter()
    m["estimator"].fit(X_train, y_train)
    train_time = time.perf_counter() - t0

    preds = np.clip(m["estimator"].predict(X_eval), 0.0, None)
    eval_clean[f"pred_{m['id']}"] = preds
    trained_estimators[m["id"]] = m["estimator"]

    # 1. ML Accuracy Metrics
    err = y_true - preds
    mae = float(np.mean(np.abs(err)))
    rmse = float(np.sqrt(np.mean(err ** 2)))
    r2 = float(r2_score(y_true, preds))
    wape = float(np.sum(np.abs(err)) / max(np.sum(y_true), 1e-8) * 100.0)
    alpha = 0.40
    pinball = float(np.mean(np.maximum(alpha * err, (alpha - 1.0) * err)))

    # 2. Retail Inventory & Waste Simulation
    order_qty = preds * m["safety_buffer"]
    effective_demand = np.where(
        m["apply_discount"] & (order_qty > y_true),
        y_true * 1.15,  # 30% evening discount boosts sales by 15%
        y_true,
    )
    sold_units = np.minimum(order_qty, effective_demand)
    wasted_units = np.maximum(0.0, order_qty - effective_demand)

    total_ordered = float(np.sum(order_qty))
    total_wasted = float(np.sum(wasted_units))
    total_sold = float(np.sum(sold_units))
    total_demand = float(np.sum(effective_demand))

    waste_rate_pct = (total_wasted / max(total_ordered, 1e-8)) * 100.0
    fill_rate_pct = (total_sold / max(total_demand, 1e-8)) * 100.0
    waste_cost_usd = total_wasted * 4.50

    comparative_models.append({
        "model_id": m["id"],
        "model_name": m["name"],
        "family": m["family"],
        "description": m["description"],
        "train_time_sec": round(train_time, 2),
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "r2_score": round(r2, 3),
        "wape_pct": round(wape, 2),
        "pinball_loss": round(pinball, 3),
        "total_wasted_units": round(total_wasted, 1),
        "waste_rate_pct": round(waste_rate_pct, 2),
        "fill_rate_pct": round(fill_rate_pct, 2),
        "waste_cost_usd": round(waste_cost_usd, 0),
    })
    joblib.dump(m["estimator"], os.path.join(os.path.dirname(__file__), "models", f"model_{m['id']}.joblib"))

eval_clean["pred_standard"] = eval_clean["pred_lgbm_std"]
eval_clean["pred_waste_aware"] = eval_clean["pred_proposed"]

# Extract Feature Importance from LightGBM
raw_imp = trained_estimators["lgbm_std"].feature_importances_.astype(float)
norm_imp = (raw_imp / max(raw_imp.sum(), 1e-8)) * 100.0
feature_importance = sorted(
    [
        {"feature": feat, "importance_pct": round(float(imp), 1)}
        for feat, imp in zip(FEATURES, norm_imp)
    ],
    key=lambda x: x["importance_pct"],
    reverse=True,
)

std_lgbm_metrics = comparative_models[3]
proposed_metrics = comparative_models[4]

summary = {
    "dataset_info": {
        "train_rows": int(len(train_clean)),
        "eval_rows": int(len(eval_clean)),
        "stores_evaluated": int(eval_clean["store_id"].nunique()),
        "products_evaluated": int(eval_clean["product_id"].nunique()),
    },
    "naive_total_waste_units": std_lgbm_metrics["total_wasted_units"],
    "smart_total_waste_units": proposed_metrics["total_wasted_units"],
    "waste_reduction_pct": round(
        (std_lgbm_metrics["total_wasted_units"] - proposed_metrics["total_wasted_units"])
        / std_lgbm_metrics["total_wasted_units"]
        * 100.0,
        1,
    ),
    "naive_waste_rate_pct": std_lgbm_metrics["waste_rate_pct"],
    "smart_waste_rate_pct": proposed_metrics["waste_rate_pct"],
    "comparative_models": comparative_models,
    "feature_importance": feature_importance,
}

os.makedirs(os.path.join(os.path.dirname(eval_path), "predicted"), exist_ok=True)
eval_clean.to_parquet(os.path.join(os.path.dirname(eval_path), "predicted", "predictions.parquet"), index=False)
with open(os.path.join(os.path.dirname(eval_path), "predicted", "summary.json"), "w") as f:
    json.dump(summary, f, indent=2)

print("\n=== ALL 6 MODELS TRAINED & BENCHMARKED ===")
for row in comparative_models:
    print(
        f"{row['model_name']:35s} | Time: {row['train_time_sec']:5.2f}s | "
        f"WAPE: {row['wape_pct']:5.2f}% | R2: {row['r2_score']:5.3f} | Waste: {row['waste_rate_pct']:5.2f}%"
    )