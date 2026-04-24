"""H4 BOT/Toll: Extract unique toll stations from VETC consolidated file.
Outputs CSV ready for SQL import into toll_stations.

Schema target:
  - station_code: short slug
  - station_name: original "Tram" value
  - operator: '' (manual fill later)
  - lat, lng: 0 placeholder (geocode later)
  - fee_truck_3t5_vnd, fee_truck_5t_vnd, fee_truck_8t_vnd, fee_truck_15t_vnd: estimated by class
"""
import re
import sys
from pathlib import Path

import pandas as pd

SRC = Path(r"D:\Xu ly Data cho BHL\output\01_VETC_BOT_Consolidated_22_23.xlsx")
OUT = Path(r"D:\Beer HL\bhl-oms\scripts\data\toll_stations_extracted.csv")

OUT.parent.mkdir(parents=True, exist_ok=True)

df = pd.read_excel(SRC)
print(f"loaded rows: {len(df)}")

# Drop footer/non-toll rows
df = df[df["Tram"].notna() & (df["Loai ban ghi"] == "Phi BOT")]
df["Tien sau thue"] = pd.to_numeric(df["Tien sau thue"], errors="coerce").fillna(0)

# Per-station summary (avg fee + transaction count = popularity)
agg = df.groupby("Tram", as_index=False).agg(
    fee_avg_vnd=("Tien sau thue", "mean"),
    fee_min_vnd=("Tien sau thue", "min"),
    fee_max_vnd=("Tien sau thue", "max"),
    transactions=("Tien sau thue", "count"),
)
agg = agg[agg["transactions"] >= 5].copy()  # Drop noise
agg = agg.sort_values("transactions", ascending=False).reset_index(drop=True)

def slug(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower()).strip("_")
    return s[:40]

# Estimated rates per vehicle class (Loại 1=<7 chỗ, Loại 2=<12T, Loại 3=12-18T, Loại 4=>18T)
# Map to BHL fleet (3t5/5t/8t/15t):
#   3t5  → Loại 2
#   5t   → Loại 2
#   8t   → Loại 3
#   15t  → Loại 4
# Use fee_avg as Loại 2 baseline; scale up by 1.5x and 2.0x.
agg["station_code"] = agg["Tram"].apply(slug)
agg["station_name"] = agg["Tram"]
agg["operator"] = ""
agg["lat"] = 0.0
agg["lng"] = 0.0
agg["fee_truck_3t5_vnd"] = agg["fee_avg_vnd"].round(0).astype(int)
agg["fee_truck_5t_vnd"] = agg["fee_avg_vnd"].round(0).astype(int)
agg["fee_truck_8t_vnd"] = (agg["fee_avg_vnd"] * 1.5).round(0).astype(int)
agg["fee_truck_15t_vnd"] = (agg["fee_avg_vnd"] * 2.0).round(0).astype(int)
agg["transactions_2022_2023"] = agg["transactions"]

cols = [
    "station_code", "station_name", "operator", "lat", "lng",
    "fee_truck_3t5_vnd", "fee_truck_5t_vnd", "fee_truck_8t_vnd", "fee_truck_15t_vnd",
    "transactions_2022_2023",
]
agg[cols].to_csv(OUT, index=False, encoding="utf-8-sig")
print(f"wrote {len(agg)} stations -> {OUT}")
print("top 10 by frequency:")
print(agg[["station_name", "transactions_2022_2023", "fee_avg_vnd"]].head(10).to_string(index=False))
