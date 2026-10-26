from src.api.data import SUMMARY

def get_eval_metrics():
    """Returns comparative model evaluation metrics, R2 scores, and correlation matrices."""
    return {
        "models": SUMMARY.get("comparative_models", []),
        "correlation_matrix": SUMMARY.get("correlation_matrix", {}),
        "dataset_info": SUMMARY.get("dataset_info", {}),
        "feature_importance": SUMMARY.get("feature_importance", []),
    }
