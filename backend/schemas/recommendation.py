from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints, field_validator

Gender = Literal["Male", "Female"]
Activity = Literal["Sedentary", "Lightly Active", "Moderately Active", "Very Active"]
Goal = Literal["Weight Loss", "Maintain Weight", "Muscle Gain"]
Diet = Literal["Veg", "Eggetarian", "Non-Veg"]
Slot = Literal["breakfast", "lunch", "snacks", "dinner"]

# Accept harmless spelling variants, but never silently fall back to a default.
_ALIASES = {
    "gender": {"male": "Male", "m": "Male", "female": "Female", "f": "Female"},
    "activity_level": {a.lower(): a for a in Activity.__args__},
    "goal": {
        **{g.lower(): g for g in Goal.__args__},
        "fat loss": "Weight Loss",
        "weight gain": "Muscle Gain",
    },
    "dietary_preference": {
        **{d.lower(): d for d in Diet.__args__},
        "vegetarian": "Veg",
        "non-vegetarian": "Non-Veg",
        "nonveg": "Non-Veg",
    },
}

ShortName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]


def _canonical(field: str, value):
    if isinstance(value, str):
        hit = _ALIASES[field].get(value.strip().lower())
        if hit:
            return hit
    return value  # let the Literal check produce the 422 with allowed values


class UserInput(BaseModel):
    age: int = Field(..., ge=10, le=100)
    gender: Gender
    weight_kg: float = Field(..., gt=20, lt=300)
    height_cm: float = Field(..., gt=80, lt=250)
    activity_level: Activity = "Sedentary"
    goal: Goal = "Maintain Weight"
    dietary_preference: Diet = "Veg"
    allergies: List[ShortName] = Field(default_factory=list, max_length=20)
    avoid_foods: List[ShortName] = Field(default_factory=list, max_length=200)
    custom_calories: Optional[float] = Field(default=None, ge=1200, le=6000)
    custom_protein_g: Optional[float] = Field(default=None, gt=0, le=400)
    custom_sugar_g: Optional[float] = Field(default=None, ge=0, le=200)
    seed: Optional[int] = Field(default=None, ge=0, le=2**31 - 1)

    @field_validator("gender", "activity_level", "goal", "dietary_preference", mode="before")
    @classmethod
    def _normalise(cls, v, info):
        return _canonical(info.field_name, v)

class MacroBreakdown(BaseModel):
    daily_calories: float
    protein_g: float
    carbs_g: float
    fats_g: float
    sugar_g: float

class FoodRecommendation(BaseModel):
    food_name: str
    diet_type: str
    category: str
    serving: str
    calories: float
    protein_g: float
    carbs_g: float
    fats_g: float
    sugar_g: float
    fibres_g: Optional[float] = 0.0
    calcium_mg: Optional[float] = 0.0
    iron_mg: Optional[float] = 0.0
    vitamin_c_mg: Optional[float] = 0.0
    sodium_mg: Optional[float] = 0.0
    match_score: float
    ingredients: str

class MealCategoryPlan(BaseModel):
    meal_type: str
    target_calories: float
    portion: float = 1.0
    items: List[FoodRecommendation]

class FullDayPlan(BaseModel):
    breakfast: MealCategoryPlan
    lunch: MealCategoryPlan
    snacks: MealCategoryPlan
    dinner: MealCategoryPlan
    total_plan_calories: float
    total_plan_protein_g: float

class RecommendationResponse(BaseModel):
    target_macros: MacroBreakdown
    full_day_plan: FullDayPlan

class SwapRequest(BaseModel):
    meal_slot: Slot
    target_calories: float = Field(..., gt=50, le=3000)
    dietary_preference: Diet = "Veg"
    allergies: List[ShortName] = Field(default_factory=list, max_length=20)
    exclude_foods: List[ShortName] = Field(default_factory=list, max_length=500)

    @field_validator("dietary_preference", mode="before")
    @classmethod
    def _normalise(cls, v):
        return _canonical("dietary_preference", v)


class DayPlan(BaseModel):
    day: int
    label: str
    plan: FullDayPlan


class WeekResponse(BaseModel):
    target_macros: MacroBreakdown
    days: List[DayPlan]
    unique_foods: int
