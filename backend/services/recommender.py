
import os
import random

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity

from schemas.recommendation import (
    UserInput,
    MacroBreakdown,
    FoodRecommendation,
    MealCategoryPlan,
    FullDayPlan,
)


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _resolve_data_file(rel_path):
    candidates = [
        os.path.join(BASE_DIR, rel_path),
        os.path.abspath(os.path.join(os.getcwd(), "backend", rel_path)),
        os.path.abspath(os.path.join(os.getcwd(), rel_path)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", rel_path)),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return os.path.join(BASE_DIR, rel_path)


DATA_PATH = _resolve_data_file(os.path.join("data", "foods_modified_reviewed.xlsx"))
_scaler = None
_df = None
_names = None    # food names, row-aligned with _df
_names_cf = None # casefolded names for exclusion lookups
_scaled = None   # standardised feature matrix, row-aligned with _df
_masks = {}      # precomputed boolean filters, index-aligned with _df

FEATURE_COLS = [
    "Energy (kcal)",
    "Protein (g)",
    "Carbohydrates (g)",
    "Fats (g)",
    "Sugar (g)",
]

# Side dishes / condiments that should never be a standalone meal.
# \b boundaries stop "dip" from matching "dipped", "oil" from "boiled", etc.
CONDIMENT_FILTER = (
    r"\b(?:chutney|pickle|sauce|dressing|dip|tadka|baghar|raita|roti|chapati|phulka|"
    r"syrup|oil|butter|ghee|raw sugar|seasoning|water|powder|masala mix)\b"
)

# Slot -> acceptable calories as a share of the slot target, so a 15 kcal
# garnish or a 900 kcal feast is never offered for a 400 kcal slot.
MIN_MEAL_KCAL = 80.0

# The UI sends friendly names; the dataset uses its own labels.
ALLERGEN_ALIASES = {
    "dairy": ["milk/dairy"],
    "milk": ["milk/dairy"],
    "milk/dairy": ["milk/dairy"],
    "gluten": ["gluten/wheat"],
    "wheat": ["gluten/wheat"],
    "gluten/wheat": ["gluten/wheat"],
    "egg": ["egg"],
    "eggs": ["egg"],
    "nuts": ["tree nuts", "peanut"],
    "tree nuts": ["tree nuts"],
    "peanut": ["peanut"],
    "peanuts": ["peanut"],
    "soy": ["soy"],
    "fish": ["fish/seafood"],
    "shellfish": ["fish/seafood"],
    "seafood": ["fish/seafood"],
    "fish/seafood": ["fish/seafood"],
    "mushroom": ["mushroom"],
    "pork": ["pork"],
    "caffeine": ["caffeine"],
}

ALLERGEN_OPTIONS = [
    "Dairy", "Gluten", "Nuts", "Peanut", "Soy", "Egg", "Fish", "Mushroom",
]


def load_resources():
    global _scaler, _df, _scaled, _masks, DATA_PATH

    if _df is None:
        if not os.path.exists(DATA_PATH):
            DATA_PATH = _resolve_data_file(os.path.join("data", "foods_modified_reviewed.xlsx"))
        if not os.path.exists(DATA_PATH):
            raise FileNotFoundError(
                f"Dataset Excel missing at {DATA_PATH}"
            )

        _df = pd.read_excel(DATA_PATH)

        required_cols = [
            "Food",
            "Category",
            "Type",
            "Allergy",
            "Serving",
            "Ingredients",
            *FEATURE_COLS,
        ]

        missing_cols = [
            col for col in required_cols if col not in _df.columns
        ]

        if missing_cols:
            raise ValueError(
                f"Missing required columns in foods.xlsx: {missing_cols}"
            )

        numeric_cols = [
            *FEATURE_COLS,
            "Fibres (g)",
            "Sodium (mg)",
            "Calcium (mg)",
            "Iron (mg)",
            "Vitamin C (mg)",
            "Total Weight (g)",
        ]

        for col in numeric_cols:
            if col not in _df.columns:
                _df[col] = 0.0
            else:
                _df[col] = pd.to_numeric(
                    _df[col], errors="coerce"
                ).fillna(0)

        _df["Food"] = _df["Food"].fillna("").astype(str)
        _df["Category"] = (
            _df["Category"].fillna("General").astype(str)
        )
        _df["Type"] = _df["Type"].fillna("Veg").astype(str)
        _df["Allergy"] = _df["Allergy"].fillna("None").astype(str)
        _df["Serving"] = (
            _df["Serving"].fillna("1 Serving").astype(str)
        )
        _df["Ingredients"] = (
            _df["Ingredients"]
            .fillna("Fresh culinary ingredients")
            .astype(str)
        )

        _df = _df[_df["Food"].str.strip() != ""].copy()
        _df = _df.drop_duplicates(subset="Food").reset_index(drop=True)
        _build_indexes()


ACTIVITY_MULTIPLIERS = {
    "Sedentary": 1.2,
    "Lightly Active": 1.375,
    "Moderately Active": 1.55,
    "Very Active": 1.725,
}
GOAL_DELTAS = {"Weight Loss": -500.0, "Maintain Weight": 0.0, "Muscle Gain": 300.0}


def calculate_daily_macros(user: UserInput) -> MacroBreakdown:
    # Mifflin-St Jeor Equation
    if user.gender == "Male":
        bmr = (
            10 * user.weight_kg
            + 6.25 * user.height_cm
            - 5 * user.age
            + 5
        )
    else:
        bmr = (
            10 * user.weight_kg
            + 6.25 * user.height_cm
            - 5 * user.age
            - 161
        )

    tdee = bmr * ACTIVITY_MULTIPLIERS[user.activity_level]

    if user.custom_calories is not None:
        daily_calories = float(user.custom_calories)
    else:
        daily_calories = tdee + GOAL_DELTAS[user.goal]

    daily_calories = max(1200.0, round(daily_calories, 1))

    if user.custom_protein_g is not None:
        protein_g = float(user.custom_protein_g)
    else:
        per_kg = 2.0 if user.goal == "Muscle Gain" else 1.7
        # Weight-based protein is capped at 35% of calories (upper end of the
        # accepted macronutrient range) so heavier users on low targets don't
        # get macros that add up to more than their calories.
        protein_g = round(
            min(user.weight_kg * per_kg, daily_calories * 0.35 / 4), 1
        )

    fats_g = round((daily_calories * 0.25) / 9, 1)

    carbs_g = max(
        0.0,
        round(
            (
                daily_calories
                - (protein_g * 4)
                - (fats_g * 9)
            ) / 4,
            1,
        ),
    )

    sugar_g = (
        float(user.custom_sugar_g)
        if user.custom_sugar_g is not None
        else 25.0
    )

    return MacroBreakdown(
        daily_calories=daily_calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fats_g=fats_g,
        sugar_g=sugar_g,
    )


def _filter_meal_quality(df: pd.DataFrame, meal_slot: str) -> pd.DataFrame:
    ok = df[_masks["ok"].loc[df.index].to_numpy()]
    slot_mask = _masks.get(meal_slot.lower())
    if slot_mask is None:
        return ok
    sub = ok[slot_mask.loc[ok.index].to_numpy()]
    return sub if len(sub) >= 5 else ok


def _get_top_matches_for_target(
    filtered_df: pd.DataFrame,
    target_vector_df: pd.DataFrame,
    top_n: int = 3,
    exclude_foods=None,
    rng=None,
    variety_pool: int = 8,
):
    """Rank candidate foods by cosine similarity to the target nutrient vector.

    Works on the precomputed standardised matrix with numpy; pandas is only
    touched for the handful of rows that are returned."""
    if filtered_df.empty or top_n <= 0:
        return []

    idx = filtered_df.index.to_numpy()

    if exclude_foods:
        excluded = {str(f).strip().casefold() for f in exclude_foods if f is not None}
        keep = np.fromiter((n not in excluded for n in _names_cf[idx]), dtype=bool, count=len(idx))
        idx = idx[keep]
    if idx.size == 0:
        return []

    t = _scaler.transform(target_vector_df[FEATURE_COLS])[0]
    m = _scaled[idx]
    denom = np.linalg.norm(m, axis=1) * np.linalg.norm(t)
    sims = np.divide(m @ t, denom, out=np.zeros(len(idx)), where=denom > 0)

    # Highest similarity first; ties broken by name so results are reproducible.
    order = np.lexsort((_names[idx], -sims))

    if rng is not None and len(order) > top_n:
        # Variety mode: choose among the best `variety_pool` matches, weighted
        # by similarity, so repeated plans differ but stay high quality.
        cand = list(order[: max(variety_pool, top_n)])
        weights = {c: max(float(sims[c]), 0.01) for c in cand}
        chosen = []
        for _ in range(min(top_n, len(cand))):
            pick = rng.choices(cand, weights=[weights[c] for c in cand], k=1)[0]
            chosen.append(pick)
            cand.remove(pick)
        picked = sorted(chosen, key=list(order).index)
    else:
        picked = list(order[:top_n])

    recommendations = []
    for pos in picked:
        row = _df.iloc[idx[pos]]
        recommendations.append(
            FoodRecommendation(
                food_name=str(row["Food"]),
                diet_type=str(row["Type"]),
                category=str(row["Category"]),
                serving=str(row["Serving"]),
                calories=float(row["Energy (kcal)"]),
                protein_g=float(row["Protein (g)"]),
                carbs_g=float(row["Carbohydrates (g)"]),
                fats_g=float(row["Fats (g)"]),
                sugar_g=float(row["Sugar (g)"]),
                fibres_g=float(row.get("Fibres (g)", 0.0)),
                calcium_mg=float(row.get("Calcium (mg)", 0.0)),
                iron_mg=float(row.get("Iron (mg)", 0.0)),
                vitamin_c_mg=float(row.get("Vitamin C (mg)", 0.0)),
                sodium_mg=float(row.get("Sodium (mg)", 0.0)),
                match_score=round(float(min(max(sims[pos] * 100, 0.0), 100.0)), 1),
                ingredients=str(row.get("Ingredients", "N/A")),
            )
        )
    return recommendations


def _expand_allergens(allergies):
    """Map UI labels to dataset labels; unknown labels pass through."""
    tokens = []
    for allergy in allergies or []:
        key = str(allergy or "").strip().lower()
        if not key:
            continue
        tokens.extend(ALLERGEN_ALIASES.get(key, [key]))
    return list(dict.fromkeys(tokens))


def _plausible_mask(df: pd.DataFrame) -> pd.Series:
    """True for rows whose macros agree with their own energy value."""
    macro_kcal = (
        df["Protein (g)"] * 4 + df["Carbohydrates (g)"] * 4 + df["Fats (g)"] * 9
    )
    energy = df["Energy (kcal)"]
    deviation = (macro_kcal - energy).abs() / energy.where(energy > 0)
    weight = df["Total Weight (g)"].where(df["Total Weight (g)"] > 0)
    protein_density = df["Protein (g)"] / weight * 100
    return (
        (energy >= MIN_MEAL_KCAL)
        & (deviation.fillna(1) <= 0.4)
        & (protein_density.fillna(0) <= 40)
    )


def _build_indexes():
    """Fit the scaler and precompute every filter that doesn't depend on the
    user. Done once at startup so requests only slice arrays (the week
    endpoint dropped from ~300 ms to well under 100 ms)."""
    global _scaler, _scaled, _masks, _names, _names_cf
    # Fitted from the shipped dataset rather than unpickled: no pickle-loading
    # attack surface and no scikit-learn version drift.
    _scaler = StandardScaler().fit(_df[FEATURE_COLS])
    _scaled = _scaler.transform(_df[FEATURE_COLS])
    _names = _df["Food"].to_numpy(dtype=str)
    _names_cf = _df["Food"].str.strip().str.casefold().to_numpy()

    ok = ~_df["Food"].str.lower().str.contains(CONDIMENT_FILTER, na=False, regex=True)
    ok &= _plausible_mask(_df)
    cat = _df["Category"].str.lower()
    mains = cat.str.contains("lunch|dinner|curry|dal|rice|bread|dry curry|soup", na=False)
    _masks = {
        "ok": ok,
        "breakfast": cat.str.contains("breakfast|bread", na=False),
        "snacks": cat.str.contains("snack|appetizer|salad", na=False),
        "lunch": mains,
        "dinner": mains,
    }


def _filter_diet_and_allergies(
    df: pd.DataFrame,
    dietary_preference: str = "Veg",
    allergies=None,
) -> pd.DataFrame:
    preference = (dietary_preference or "Veg").lower()
    filtered_df = df.copy()

    if preference == "veg":
        filtered_df = filtered_df[
            filtered_df["Type"].str.lower() == "veg"
        ]
    elif preference == "eggetarian":
        filtered_df = filtered_df[
            filtered_df["Type"].str.lower().isin(
                ["veg", "eggetarian"]
            )
        ]

    for token in _expand_allergens(allergies):
        filtered_df = filtered_df[
            ~filtered_df["Allergy"].str.contains(
                token, case=False, na=False, regex=False
            )
        ]

    return filtered_df


PORTION_STEPS = (0.5, 0.75, 1.0, 1.25, 1.5, 2.0)


def _suggest_portion(target_kcal: float, base_kcal: float) -> float:
    """Pick the allowed portion multiplier that lands closest to the slot's
    calorie target, so the plan actually adds up to the daily goal."""
    if base_kcal <= 0:
        return 1.0
    return min(PORTION_STEPS, key=lambda p: abs(base_kcal * p - target_kcal))


def _fit_to_slot(slot_df: pd.DataFrame, slot_target: float) -> pd.DataFrame:
    """Keep dishes whose single serving is a sensible size for this slot.

    Each slot holds two dishes and portions only shrink to 0.5x, so a dish far
    above the slot's calories can never be portioned back to target. Falls
    back to the full pool when too few dishes qualify."""
    kcal = slot_df["Energy (kcal)"]
    fit = slot_df[(kcal >= 0.15 * slot_target) & (kcal <= 1.1 * slot_target)]
    return fit if len(fit) >= 6 else slot_df


MEAL_RATIOS = {"breakfast": 0.25, "lunch": 0.35, "snacks": 0.15, "dinner": 0.25}


def _build_day(target_macros, filtered_df, exclude=None, rng=None):
    """Assemble one day. `exclude` keeps foods out; `rng` enables variety."""
    used = set(exclude or [])
    meal_plans = {}
    total_calories = 0.0
    total_protein = 0.0

    for meal, ratio in MEAL_RATIOS.items():
        slot_target = target_macros.daily_calories * ratio
        slot_df = _fit_to_slot(_filter_meal_quality(filtered_df, meal), slot_target)
        target_df = pd.DataFrame([{
            "Energy (kcal)": slot_target,
            "Protein (g)": target_macros.protein_g * ratio,
            "Carbohydrates (g)": target_macros.carbs_g * ratio,
            "Fats (g)": target_macros.fats_g * ratio,
            "Sugar (g)": target_macros.sugar_g * ratio,
        }])

        items = _get_top_matches_for_target(
            slot_df, target_df, top_n=2, exclude_foods=used, rng=rng
        )
        portion = _suggest_portion(slot_target, sum(i.calories for i in items))

        for item in items:
            used.add(item.food_name)
            total_calories += item.calories * portion
            total_protein += item.protein_g * portion

        meal_plans[meal] = MealCategoryPlan(
            meal_type=meal.capitalize(),
            target_calories=round(slot_target, 1),
            portion=portion,
            items=items,
        )

    return FullDayPlan(
        breakfast=meal_plans["breakfast"],
        lunch=meal_plans["lunch"],
        snacks=meal_plans["snacks"],
        dinner=meal_plans["dinner"],
        total_plan_calories=round(total_calories, 1),
        total_plan_protein_g=round(total_protein, 1),
    )


def _prepare(user: UserInput):
    load_resources()
    target_macros = calculate_daily_macros(user)
    filtered_df = _filter_diet_and_allergies(
        _df, user.dietary_preference, user.allergies
    )
    avoid = {str(f).strip().casefold() for f in (user.avoid_foods or [])}
    if avoid:
        filtered_df = filtered_df[
            ~filtered_df["Food"].str.strip().str.casefold().isin(avoid)
        ]
    if filtered_df.empty:
        raise ValueError("No foods match your dietary preference and allergy filters.")
    return target_macros, filtered_df


def get_recommendations(user: UserInput):
    target_macros, filtered_df = _prepare(user)
    # No seed -> deterministic best match. A seed gives a different, equally
    # valid plan (used by the "Shuffle" button).
    rng = random.Random(user.seed) if user.seed is not None else None
    return target_macros, _build_day(target_macros, filtered_df, rng=rng)


WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
REPEAT_WINDOW_DAYS = 2  # a food can't reappear within this many days


def get_week_plan(user: UserInput):
    """Seven varied days. Day 1 equals the single-day plan; later days avoid
    foods used in the previous `REPEAT_WINDOW_DAYS` days."""
    target_macros, filtered_df = _prepare(user)
    base_seed = user.seed if user.seed is not None else 2024
    days, history = [], []
    for d in range(7):
        recent = {f for day_foods in history[-REPEAT_WINDOW_DAYS:] for f in day_foods}
        rng = random.Random(base_seed + d) if (d > 0 or user.seed is not None) else None
        plan = _build_day(target_macros, filtered_df, exclude=recent, rng=rng)
        history.append(
            [i.food_name for m in (plan.breakfast, plan.lunch, plan.snacks, plan.dinner) for i in m.items]
        )
        days.append({"day": d + 1, "label": WEEKDAYS[d], "plan": plan})
    return target_macros, days


def get_swap_options(
    slot: str,
    target_calories: float,
    dietary_preference: str = "Veg",
    allergies: list = None,
    top_n: int = 10,
    exclude_foods: list = None,
):
    load_resources()

    filtered_df = _filter_diet_and_allergies(
        _df,
        dietary_preference,
        allergies,
    )

    slot_df = _filter_meal_quality(filtered_df, slot)

    target_df = pd.DataFrame([{
        "Energy (kcal)": target_calories,
        "Protein (g)": (target_calories * 0.25) / 4,
        "Carbohydrates (g)": (target_calories * 0.50) / 4,
        "Fats (g)": (target_calories * 0.25) / 9,
        "Sugar (g)": 5.0,
    }])

    return _get_top_matches_for_target(
        slot_df,
        target_df,
        top_n=top_n,
        exclude_foods=exclude_foods,
    )


def get_all_foods(
    search: str = "",
    category: str = "",
    diet_type: str = "",
    limit: int = 50,
    offset: int = 0,
):
    load_resources()

    df = _df.copy()

    if search:
        query = search.lower()

        df = df[
            df["Food"].str.lower().str.contains(
                query, na=False, regex=False
            )
            | df["Ingredients"].str.lower().str.contains(
                query, na=False, regex=False
            )
        ]

    if category and category.lower() != "all":
        df = df[
            df["Category"].str.lower().str.contains(
                category.lower(), na=False, regex=False
            )
        ]

    if diet_type and diet_type.lower() != "all":
        df = df[
            df["Type"].str.lower() == diet_type.lower()
        ]

    total = len(df)
    page_df = df.iloc[offset:offset + limit]
    clean_records = [
        {k: (None if pd.isna(v) else v) for k, v in record.items()}
        for record in page_df.to_dict(orient="records")
    ]

    return total, clean_records
