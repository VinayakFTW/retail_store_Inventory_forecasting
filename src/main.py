from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.get_available_stores import get_stores
from src.api.get_eval_metrics import get_eval_metrics
from src.api.get_overall_model_summary import get_overall_summary
from src.api.get_product_forecast import get_product_forecast

app = FastAPI(title="Simple Grocery Demand & Waste API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_api_route("/api/summary", get_overall_summary, methods=["GET"])
app.add_api_route("/api/metrics", get_eval_metrics, methods=["GET"])
app.add_api_route("/api/stores", get_stores, methods=["GET"])
app.add_api_route("/api/forecast/{store_id}/{product_id}", get_product_forecast, methods=["GET"])
