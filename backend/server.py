from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")

import os  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

from core import client  # noqa: E402
from seed import run_seed  # noqa: E402
import routes_auth, routes_products, routes_sales, routes_orders, routes_reports  # noqa: E402

app = FastAPI(title="BERSINAR POS")
for r in (routes_auth, routes_products, routes_sales, routes_orders, routes_reports):
    app.include_router(r.router)


@app.get("/api/")
async def root():
    return {"message": "BERSINAR POS API"}


@app.on_event("startup")
async def startup():
    await run_seed()


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
