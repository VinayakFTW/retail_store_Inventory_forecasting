from src.api.data import df

def get_stores():
    """Lists available stores and their products."""
    stores = df["store_id"].unique().tolist()
    products_by_store = {
        int(s): [int(p) for p in df[df["store_id"] == s]["product_id"].unique()[:50]]
        for s in stores
    }
    return {"stores": stores, "products_by_store": products_by_store}