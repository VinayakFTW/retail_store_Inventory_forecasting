import os
import pandas as pd
import json

df = pd.read_parquet(os.path.abspath(os.path.join("data","predicted", "predictions.parquet")))
with open(os.path.abspath(os.path.join("data","predicted", "summary.json")), "r") as f:
    SUMMARY = json.load(f)