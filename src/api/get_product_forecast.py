from fastapi import HTTPException
from src.api.data import df
import numpy as np

def get_product_forecast(
    store_id: int,
    product_id: int,
    markdown_boost_pct: float = 15.0,
):
    """Returns 7-day forecast and waste breakdown for a store + product."""
    sub = df[(df["store_id"] == store_id) & (df["product_id"] == product_id)].copy()
    if sub.empty:
        raise HTTPException(status_code=404, detail="Store or Product not found")

    sub = sub.sort_values("dt")

    # Old Way: Standard LightGBM + 20% buffer, no discount
    sub["naive_order"] = (sub["pred_standard"] * 1.20).round(2)
    sub["naive_waste"] = np.maximum(0, sub["naive_order"] - sub["true_demand"]).round(2)

    # Smart Way: Proposed Quantile LightGBM + Evening Discount boost
    sub["smart_order"] = sub["pred_waste_aware"].round(2)
    boost_multiplier = 1.0 + (markdown_boost_pct / 100.0)
    boosted_dem = np.where(
        sub["smart_order"] > sub["true_demand"],
        sub["true_demand"] * boost_multiplier,
        sub["true_demand"],
    )
    sub["smart_waste"] = np.maximum(0, sub["smart_order"] - boosted_dem).round(2)

    return {
        "store_id": store_id,
        "product_id": product_id,
        "total_7d_naive_waste": round(float(sub["naive_waste"].sum()), 2),
        "total_7d_smart_waste": round(float(sub["smart_waste"].sum()), 2),
        "daily_data": sub[
            [
                "dt",
                "sale_amount",
                "stock_hour6_22_cnt",
                "true_demand",
                "naive_order",
                "naive_waste",
                "smart_order",
                "smart_waste",
            ]
        ]
        .round(2)
        .to_dict(orient="records"),
    }