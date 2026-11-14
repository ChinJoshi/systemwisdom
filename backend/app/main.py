from app.routers.assessment_taking.router import router as assessment_taking_router
from app.routers.assessments.router import router as assessments_router
from app.routers.codebase.router import router as codebase_router
from app.routers.concepts.router import router as concepts_router
from app.routers.contributors.router import router as contributors_router
from app.routers.internal.router import router as internal_router
from fastapi import APIRouter, FastAPI
from fastapi.routing import APIRoute


# Use the route function name as the OpenAPI operationId (e.g. `get_me`) so the
# generated TypeScript SDK gets clean function names (`getMe`). Route function
# names must therefore be unique across the app.
def generate_operation_id(route: APIRoute) -> str:
    return route.name


app = FastAPI(
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    generate_unique_id_function=generate_operation_id,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(codebase_router)
api_router.include_router(contributors_router)
api_router.include_router(concepts_router)
api_router.include_router(assessments_router)
api_router.include_router(assessment_taking_router)
api_router.include_router(internal_router)

app.include_router(api_router)
