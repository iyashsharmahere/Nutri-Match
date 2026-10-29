"""Regenerate frontend/src/data/foods.json from the backend dataset so the
Food Explorer and the recommender always read the same records."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services import recommender as r  # noqa: E402

r.load_resources()
cols = {
    "Food": "name", "Type": "diet", "Category": "category", "Allergy": "allergy",
    "Serving": "serving", "Total Weight (g)": "weight",
    "Energy (kcal)": "kcal", "Protein (g)": "protein", "Carbohydrates (g)": "carbs",
    "Fats (g)": "fat", "Sugar (g)": "sugar", "Fibres (g)": "fibre",
    "Sodium (mg)": "sodium", "Calcium (mg)": "calcium", "Iron (mg)": "iron",
    "Vitamin C (mg)": "vitc", "Ingredients": "ingredients",
}
out = r._df[list(cols)].rename(columns=cols).round(2)
dest = os.path.join(os.path.dirname(r.BASE_DIR), "frontend", "src", "data", "foods.json")
with open(dest, "w", encoding="utf-8") as f:
    json.dump(out.to_dict(orient="records"), f, ensure_ascii=False, separators=(",", ":"))
print(f"Wrote {len(out)} foods to {dest}")
