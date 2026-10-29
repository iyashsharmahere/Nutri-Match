import warnings
import pytest
from fastapi.testclient import TestClient

warnings.filterwarnings("ignore")
import main  # noqa: E402
from ratelimit import RateLimiter  # noqa: E402
from schemas.recommendation import UserInput  # noqa: E402
from services.recommender import calculate_daily_macros  # noqa: E402

BASE = {"age": 30, "gender": "Female", "weight_kg": 62, "height_cm": 160,
        "activity_level": "Lightly Active", "goal": "Weight Loss",
        "dietary_preference": "Veg", "allergies": []}


@pytest.fixture(scope="module")
def client():
    with TestClient(main.app, raise_server_exceptions=False) as c:
        yield c


def user(**kw):
    return UserInput(**{**BASE, **kw})


# ---- calculation: golden values worked out by hand --------------------------
def test_mifflin_st_jeor_male_maintenance():
    # BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780 ; TDEE = 1780 * 1.55 = 2759
    m = calculate_daily_macros(user(gender="Male", age=30, weight_kg=80, height_cm=180,
                                    activity_level="Moderately Active", goal="Maintain Weight"))
    assert m.daily_calories == 2759.0
    assert m.protein_g == 136.0                      # 1.7 g/kg
    assert m.fats_g == pytest.approx(2759 * 0.25 / 9, abs=0.1)
    assert m.protein_g * 4 + m.carbs_g * 4 + m.fats_g * 9 == pytest.approx(2759, abs=2)


def test_goal_offsets():
    kw = dict(gender="Male", age=30, weight_kg=80, height_cm=180, activity_level="Sedentary")
    base = calculate_daily_macros(user(goal="Maintain Weight", **kw)).daily_calories
    assert calculate_daily_macros(user(goal="Weight Loss", **kw)).daily_calories == base - 500
    gain = calculate_daily_macros(user(goal="Muscle Gain", **kw))
    assert gain.daily_calories == base + 300
    assert gain.protein_g == 160.0                   # 2.0 g/kg


def test_calorie_floor_is_1200():
    m = calculate_daily_macros(user(age=60, weight_kg=45, height_cm=150, activity_level="Sedentary"))
    assert m.daily_calories == 1200.0


def test_protein_is_capped_so_macros_never_exceed_calories():
    m = calculate_daily_macros(user(weight_kg=250, height_cm=150, activity_level="Sedentary"))
    assert m.protein_g * 4 <= m.daily_calories * 0.35 + 0.5
    assert m.protein_g * 4 + m.carbs_g * 4 + m.fats_g * 9 == pytest.approx(m.daily_calories, abs=3)


def test_custom_targets_are_used_exactly():
    m = calculate_daily_macros(user(custom_calories=2000, custom_protein_g=120, custom_sugar_g=40))
    assert (m.daily_calories, m.protein_g, m.sugar_g) == (2000.0, 120.0, 40.0)


# ---- validation: never silently fall back -----------------------------------
@pytest.mark.parametrize("bad", [
    {"goal": "Banana"}, {"activity_level": "Asleep"}, {"dietary_preference": "Carnivore"},
    {"gender": "robot"}, {"custom_calories": 400}, {"custom_calories": 99999},
    {"custom_protein_g": 0}, {"custom_sugar_g": -1},
    {"avoid_foods": ["x"] * 201}, {"allergies": ["a"] * 21}, {"allergies": ["y" * 500]},
])
def test_bad_input_is_rejected_with_422(client, bad):
    assert client.post("/api/recommend", json={**BASE, **bad}).status_code == 422


@pytest.mark.parametrize("raw,canon", [("male", "Male"), ("F", "Female")])
def test_gender_aliases_are_normalised(raw, canon):
    assert user(gender=raw).gender == canon


def test_goal_and_diet_aliases_are_normalised():
    u = user(goal="fat loss", dietary_preference="vegetarian", activity_level="very active")
    assert (u.goal, u.dietary_preference, u.activity_level) == ("Weight Loss", "Veg", "Very Active")


def test_swap_validation(client):
    ok = {"meal_slot": "lunch", "target_calories": 400}
    assert client.post("/api/recommend/swap", json=ok).status_code == 200
    assert client.post("/api/recommend/swap", json={**ok, "meal_slot": "brunch"}).status_code == 422
    assert client.post("/api/recommend/swap", json={**ok, "target_calories": -5}).status_code == 422


# ---- operability -------------------------------------------------------------
def test_health_and_request_id(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["foods"] > 1000
    assert len(r.headers["x-request-id"]) == 8


def test_internal_errors_do_not_leak_details(client, monkeypatch):
    from services import recommender as rc
    def boom(*a, **k):
        raise RuntimeError("secret /home/claude/path")
    monkeypatch.setattr(rc, "_build_day", boom)
    r = client.post("/api/recommend", json=BASE)
    assert r.status_code == 500
    assert "secret" not in r.text and "/home" not in r.text
    assert r.headers["x-request-id"] in r.json()["detail"]


def test_cors_headers_present_on_errors(client):
    r = client.post("/api/recommend", json={**BASE, "goal": "Banana"}, headers={"Origin": "https://example.com"})
    assert r.status_code == 422 and "access-control-allow-origin" in r.headers


def test_rate_limiter_unit():
    t = [0.0]
    rl = RateLimiter(3, window_s=60, clock=lambda: t[0])
    assert [rl.check("a")[0] for _ in range(4)] == [True, True, True, False]
    assert rl.check("b")[0] is True                  # other clients unaffected
    t[0] = 61
    assert rl.check("a")[0] is True                  # window slides
    assert RateLimiter(0).check("x") == (True, 0)    # 0 disables


def test_rate_limit_returns_429_with_retry_after(client, monkeypatch):
    monkeypatch.setattr(main, "limiter", RateLimiter(2))
    codes = [client.post("/api/recommend", json=BASE).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = client.post("/api/recommend", json=BASE)
    assert r.headers["retry-after"].isdigit()
    assert client.get("/health").status_code == 200  # non-planning routes unlimited


def test_rate_limiter_memory_is_bounded():
    rl = RateLimiter(5, max_clients=100)
    for i in range(1000):
        rl.check(f"ip{i}")
    assert len(rl._hits) <= 100
