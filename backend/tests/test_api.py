import warnings
import pytest
from fastapi.testclient import TestClient

warnings.filterwarnings("ignore")
from main import app  # noqa: E402

BASE = {
    "age": 30, "gender": "Female", "weight_kg": 62, "height_cm": 160,
    "activity_level": "Lightly Active", "goal": "Weight Loss",
    "dietary_preference": "Veg", "allergies": ["Dairy", "Nuts"],
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def names(plan):
    return [i["food_name"] for s in ("breakfast", "lunch", "snacks", "dinner") for i in plan[s]["items"]]


def test_day_plan_shape_and_determinism(client):
    a = client.post("/api/recommend", json=BASE).json()
    b = client.post("/api/recommend", json=BASE).json()
    assert a == b
    assert len(names(a["full_day_plan"])) == 8
    assert len(set(names(a["full_day_plan"]))) == 8


def test_allergen_free_results(client):
    from services import recommender as r
    plan = client.post("/api/recommend", json=BASE).json()["full_day_plan"]
    week = client.post("/api/recommend/week", json=BASE).json()
    every = names(plan) + [n for d in week["days"] for n in names(d["plan"])]
    allergy = r._df.set_index("Food")["Allergy"]
    for n in every:
        tags = str(allergy[n]).lower()
        assert "milk/dairy" not in tags and "tree nuts" not in tags and "peanut" not in tags, n
        assert "raita" not in n.lower()


def test_seed_changes_plan_but_is_repeatable(client):
    base = names(client.post("/api/recommend", json=BASE).json()["full_day_plan"])
    s1 = names(client.post("/api/recommend", json={**BASE, "seed": 1}).json()["full_day_plan"])
    s1b = names(client.post("/api/recommend", json={**BASE, "seed": 1}).json()["full_day_plan"])
    s2 = names(client.post("/api/recommend", json={**BASE, "seed": 2}).json()["full_day_plan"])
    assert s1 == s1b
    assert s1 != base or s2 != base


def test_avoid_foods_are_respected(client):
    base = names(client.post("/api/recommend", json=BASE).json()["full_day_plan"])
    hidden = base[:3]
    again = names(client.post("/api/recommend", json={**BASE, "avoid_foods": hidden}).json()["full_day_plan"])
    assert not set(hidden) & set(again)


def test_week_plan_variety(client):
    r = client.post("/api/recommend/week", json=BASE)
    assert r.status_code == 200
    d = r.json()
    assert [x["label"] for x in d["days"]][:2] == ["Monday", "Tuesday"]
    assert len(d["days"]) == 7
    # day 1 equals the single-day plan
    single = client.post("/api/recommend", json=BASE).json()["full_day_plan"]
    assert names(d["days"][0]["plan"]) == names(single)
    # no food repeats within 2 consecutive days
    for i in range(1, 7):
        for back in (1, 2):
            if i - back >= 0:
                assert not set(names(d["days"][i]["plan"])) & set(names(d["days"][i - back]["plan"]))
    assert d["unique_foods"] >= 30


def test_swap_excludes_and_respects_diet(client):
    r = client.post("/api/recommend/swap", json={"meal_slot": "dinner", "target_calories": 400, "exclude_foods": ["Dal Cheela"], "dietary_preference": "Veg"})
    out = r.json()
    assert r.status_code == 200 and out
    assert "Dal Cheela" not in [o["food_name"] for o in out]
    assert all(o["diet_type"] == "Veg" for o in out)


@pytest.mark.parametrize("bad", [{"age": 5}, {"weight_kg": 10}, {"height_cm": 300}, {"gender": "robot"}])
def test_validation_rejected(client, bad):
    assert client.post("/api/recommend", json={**BASE, **bad}).status_code == 422


def test_empty_candidate_pool_maps_to_422(client, monkeypatch):
    from services import recommender as r
    monkeypatch.setattr(r, "_filter_diet_and_allergies", lambda *a, **k: r._df.iloc[0:0])
    res = client.post("/api/recommend", json=BASE)
    assert res.status_code == 422
    assert "No foods match" in res.json()["detail"]


PROFILES = [
    BASE,
    {"age": 22, "gender": "Male", "weight_kg": 80, "height_cm": 180, "activity_level": "Very Active", "goal": "Muscle Gain", "dietary_preference": "Non-Veg", "allergies": []},
    {"age": 45, "gender": "Female", "weight_kg": 70, "height_cm": 155, "activity_level": "Sedentary", "goal": "Maintain Weight", "dietary_preference": "Eggetarian", "allergies": ["Gluten"]},
]


@pytest.mark.parametrize("profile", PROFILES)
def test_every_week_day_lands_near_target(client, profile):
    d = client.post("/api/recommend/week", json=profile).json()
    target = d["target_macros"]["daily_calories"]
    for day in d["days"]:
        gap = abs(day["plan"]["total_plan_calories"] - target) / target
        assert gap <= 0.30, f'{day["label"]}: {day["plan"]["total_plan_calories"]} vs {target}'
