import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from ratelimit import RateLimiter
from schemas.recommendation import (
    FoodRecommendation,
    RecommendationResponse,
    SwapRequest,
    UserInput,
    WeekResponse,
)
from services.recommender import (
    ALLERGEN_OPTIONS,
    get_all_foods,
    get_recommendations,
    get_swap_options,
    get_week_plan,
    load_resources,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("nutrimatch")

# --- configuration (all via environment variables) ---------------------------
# ALLOWED_ORIGINS: comma-separated, e.g. https://nutrimatch.app (default: any)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
# RATE_LIMIT_PER_MIN: requests per client per minute to planning endpoints (0 = off)
RATE_LIMIT_PER_MIN = int(os.getenv("RATE_LIMIT_PER_MIN", "60"))
# TRUST_PROXY=1 when behind a reverse proxy that sets X-Forwarded-For
TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"

limiter = RateLimiter(RATE_LIMIT_PER_MIN)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_resources()
    log.info("Dataset loaded and scaler fitted; ready.")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="NutriMatch API",
    description="Calorie/macro targets (Mifflin-St Jeor) and meal matching "
    "(StandardScaler + cosine similarity) over a measured Indian food dataset.",
    version="2.2.0",
)


def _client_ip(request: Request) -> str:
    if TRUST_PROXY:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = uuid.uuid4().hex[:8]
    start = time.perf_counter()

    if request.method == "POST" and (
        request.url.path.startswith("/api/recommend")
        or request.url.path.startswith("/recommend")
    ):
        allowed, retry = limiter.check(_client_ip(request))
        if not allowed:
            return JSONResponse(
                {"detail": f"Too many requests. Please try again in {retry} seconds."},
                status_code=429,
                headers={"Retry-After": str(retry), "X-Request-ID": rid},
            )

    try:
        response = await call_next(request)
    except Exception:
        # Log the details server-side; never leak internals (paths, stack
        # traces) to the client. Returned from here so CORS headers still apply.
        log.exception("Unhandled error rid=%s %s %s", rid, request.method, request.url.path)
        response = JSONResponse(
            {"detail": f"Something went wrong on our side. Reference: {rid}"},
            status_code=500,
        )

    ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = rid
    log.info("rid=%s %s %s -> %s %.0fms", rid, request.method, request.url.path, response.status_code, ms)
    return response


# Added last so it is the outermost layer: even 429/500 responses get CORS headers.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    expose_headers=["Retry-After", "X-Request-ID"],
)


@app.get("/")
@app.get("/api")
@app.get("/api/")
def read_root():
    total, _ = get_all_foods(limit=1)
    return {"service": "NutriMatch API", "status": "online", "dataset_records": total}


@app.get("/health")
@app.get("/api/health")
def health():
    """Liveness/readiness probe for hosting platforms."""
    total, _ = get_all_foods(limit=1)
    return {"status": "ok", "foods": total}


@app.post("/api/recommend", response_model=RecommendationResponse)
@app.post("/recommend", response_model=RecommendationResponse)
def generate_recommendations(user: UserInput):
    try:
        target_macros, full_day_plan = get_recommendations(user)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return RecommendationResponse(target_macros=target_macros, full_day_plan=full_day_plan)


@app.post("/api/recommend/week", response_model=WeekResponse)
@app.post("/recommend/week", response_model=WeekResponse)
def generate_week(user: UserInput):
    try:
        target_macros, days = get_week_plan(user)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    names = {
        i.food_name
        for d in days
        for m in (d["plan"].breakfast, d["plan"].lunch, d["plan"].snacks, d["plan"].dinner)
        for i in m.items
    }
    return WeekResponse(target_macros=target_macros, days=days, unique_foods=len(names))


@app.post("/api/recommend/swap", response_model=List[FoodRecommendation])
@app.post("/recommend/swap", response_model=List[FoodRecommendation])
def swap_meal(request: SwapRequest):
    return get_swap_options(
        slot=request.meal_slot,
        target_calories=request.target_calories,
        dietary_preference=request.dietary_preference,
        allergies=request.allergies,
        top_n=10,
        exclude_foods=request.exclude_foods,
    )


@app.get("/api/foods")
@app.get("/foods")
def query_foods(
    search: str = Query("", max_length=100),
    category: str = Query("All", max_length=50),
    diet_type: str = Query("All", max_length=20),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    total, foods = get_all_foods(
        search=search, category=category, diet_type=diet_type, limit=limit, offset=offset
    )
    return {"total": total, "limit": limit, "offset": offset, "foods": foods}


@app.get("/api/categories")
@app.get("/categories")
def get_categories():
    return {
        "categories": ["All", "Breakfast", "Lunch, Dinner", "Curry", "Snack", "Appetizer", "Dessert", "Salad", "Soup", "Dal", "Rice", "Bread", "Beverages"],
        "diet_types": ["All", "Veg", "Non-Veg", "Eggetarian"],
        "allergens": ALLERGEN_OPTIONS,
    }
