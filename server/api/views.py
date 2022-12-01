import logging
import uuid
from typing import Optional, Sequence, TypeVar, Union

from fastapi import Body, Depends, FastAPI, HTTPException, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from fastapi_azure_auth import B2CMultiTenantAuthorizationCodeBearer
from pydantic import AnyHttpUrl, BaseSettings, Field
from sqlalchemy.exc import IntegrityError, NoResultFound
from sqlmodel import Session, SQLModel, select

from server.api.airtable_api import AirtableAPI, PartialRecord, Record
from server.api.airtable_config import AIRTABLE_API_KEY, AIRTABLE_BASE_ID
from server.api.exceptions import InvalidOrder
from server.engine import create_fk_constraint_engine
from server.init_db import SQLITE_DB_PATH
from server.models.common import OrderedModel
from server.models.conditional_action import ConditionalAction
from server.models.interview import (Interview, InterviewCreate, InterviewRead,
                                     InterviewReadWithScreens, InterviewUpdate,
                                     ValidationError)
from server.models.interview_screen import (InterviewScreen,
                                            InterviewScreenCreate,
                                            InterviewScreenRead,
                                            InterviewScreenReadWithChildren,
                                            InterviewScreenUpdate)
from server.models.interview_screen_entry import InterviewScreenEntry

LOG = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

engine = create_fk_constraint_engine(SQLITE_DB_PATH)
airtable_client = AirtableAPI(AIRTABLE_API_KEY, AIRTABLE_BASE_ID)


# ============#
# Auth Setup #
# ============#


class Settings(BaseSettings):
    SECRET_KEY: str = Field("my super secret key", env="SECRET_KEY")
    BACKEND_CORS_ORIGINS: list[Union[str, AnyHttpUrl]] = ["http://localhost:8000"]
    OPENAPI_CLIENT_ID: str = Field(
        default="95d99eed-62db-4ca0-b0d6-f58649e90e09", env="OPENAPI_CLIENT_ID"
    )
    APP_CLIENT_ID: str = Field(
        default="f2f390f7-1ace-4333-b7b9-9cf97a3d1318", env="APP_CLIENT_ID"
    )
    TENANT_ID: str = Field(
        default="c17c2295-f643-459e-ae89-8e0b2078951e", env="TENANT_ID"
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


def custom_generate_unique_id(route: APIRoute) -> str:
    """Change the unique id that FastAPI gives each function so it's formatted
    as [apiTag]-[routeName]. This makes our autogenerated TypeScript functions
    a lot cleaner.
    """
    if len(route.tags) > 0:
        return f"{route.tags[0]}-{route.name}"
    return f"{route.name}"


TAG_METADATA = [{"name": "airtable", "description": "Endpoints for querying Airtable"}]

settings = Settings()

app = FastAPI(
    title="Interview App API",
    openapi_tags=TAG_METADATA,
    generate_unique_id_function=custom_generate_unique_id,
    swagger_ui_oauth2_redirect_url="/oauth2-redirect",
    swagger_ui_init_oauth={
        "usePkceWithAuthorizationCodeGrant": True,
        "clientId": settings.OPENAPI_CLIENT_ID,
    },
)


app.add_middleware(
    CORSMiddleware,
    # allow access from create-react-app
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

azure_scheme = B2CMultiTenantAuthorizationCodeBearer(
    app_client_id=settings.APP_CLIENT_ID,
    scopes={
        "https://twosigmadataclinic.onmicrosoft.com/scout-dev-api/Scout.API": "testtt",
    },
    openid_config_url="https://twosigmadataclinic.b2clogin.com/twosigmadataclinic.onmicrosoft.com/B2C_1_scout_signup_signin/v2.0/.well-known/openid-configuration",
    openapi_authorization_url="https://twosigmadataclinic.b2clogin.com/twosigmadataclinic.onmicrosoft.com/B2C_1_scout_signup_signin/v2.0/.well-known/authorize",
    openapi_token_url="https://twosigmadataclinic.b2clogin.com/B2C_1_scout_signup_signin/oauth2/v2.0/token",
    validate_iss=False,
)


def get_session():
    with Session(engine) as session:
        yield session


@app.get("/hello")
def hello_api():
    return {"message": "Hello World"}


# Because the exception is raised on instantiation from the SQLAlchemy validator
# we need to globally handle it
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=400,
        content={"message": str(exc)},
    )


@app.on_event("startup")
async def load_config() -> None:
    """Load OpenID config on startup."""
    await azure_scheme.openid_config.load_config()


@app.get("/auth", dependencies=[Security(azure_scheme)])
def test_auth():
    return {"message": "auth success!"}


@app.post(
    "/api/interviews/",
    tags=["interviews"],
    response_model=Interview,
)
def create_interview(
    interview: InterviewCreate, session: Session = Depends(get_session)
) -> Interview:
    db_interview = Interview.from_orm(interview)
    session.add(db_interview)
    try:
        session.commit()
    except IntegrityError as e:
        raise HTTPException(status_code=400, detail=str(e.orig))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail="Error validating interview")
    return db_interview


@app.get(
    "/api/interviews/{interview_id}",
    response_model=InterviewReadWithScreens,
    tags=["interviews"],
)
def get_interview(
    interview_id: str, session: Session = Depends(get_session)
) -> Interview:
    interview = session.get(Interview, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview


@app.put(
    "/api/interviews/{interview_id}",
    response_model=InterviewRead,
    tags=["interviews"],
)
def update_interview(
    interview_id: str,
    interview: InterviewUpdate,
    session: Session = Depends(get_session),
) -> Interview:
    try:
        db_interview = session.exec(
            select(Interview).where(Interview.id == interview_id)
        ).one()
    except NoResultFound:
        raise HTTPException(
            status_code=404, detail=f"Interview with id {interview_id} not found"
        )

    # now update the db_interview
    _update_model_diff(db_interview, interview)
    session.add(db_interview)

    try:
        session.commit()
    except IntegrityError as e:
        raise HTTPException(status_code=400, detail=str(e.orig))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail="Error validating interview")
    return db_interview


@app.post(
    "/api/interviews/{interview_id}/starting_state",
    response_model=InterviewReadWithScreens,
    tags=["interviews"],
)
def update_interview_starting_state(
    *,
    session: Session = Depends(get_session),
    interview_id: str,
    starting_state: list[str],
) -> Interview:
    db_screens = session.exec(
        select(InterviewScreen).where(InterviewScreen.interview_id == interview_id)
    ).all()
    starting_screen_to_idx = {
        screen_id: i for i, screen_id in enumerate(starting_state)
    }
    for db_screen in db_screens:
        db_screen_id = str(db_screen.id)
        if db_screen_id in starting_screen_to_idx:
            idx = starting_screen_to_idx[db_screen_id]
            db_screen.is_in_starting_state = True
            db_screen.starting_state_order = idx
        else:
            db_screen.is_in_starting_state = False
            db_screen.starting_state_order = None

    session.add_all(db_screens)
    try:
        session.commit()
    except IntegrityError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e.orig),
        )

    db_interview = session.get(Interview, interview_id)
    if not db_interview:
        raise HTTPException(
            status_code=404, detail=f"Interview with id {interview_id} not found"
        )
    return db_interview


@app.get(
    "/api/interviews/",
    response_model=list[InterviewRead],
    tags=["interviews"],
)
def get_interviews(session: Session = Depends(get_session)) -> list[Interview]:
    interviews = session.exec(select(Interview).limit(100)).all()
    return interviews


@app.get(
    "/api/interview_screens/{screen_id}",
    response_model=InterviewScreenReadWithChildren,
    tags=["interviewScreens"],
)
def get_interview_screen(
    *, session: Session = Depends(get_session), screen_id: str
) -> InterviewScreen:
    screen = session.get(InterviewScreen, screen_id)
    if not screen:
        raise HTTPException(status_code=404, detail="InterviewScreen not found")
    return screen


@app.post(
    "/api/interview_screens/",
    response_model=InterviewScreenRead,
    tags=["interviewScreens"],
)
def create_interview_screen(
    *, session: Session = Depends(get_session), screen: InterviewScreenCreate
) -> InterviewScreen:
    existing_screens = (
        session.query(InterviewScreen)
        .where(InterviewScreen.interview_id == screen.interview_id)
        .all()
    )

    if not existing_screens:
        screen.order = 1
        db_screen = InterviewScreen.from_orm(screen)
        session.add(db_screen)
    else:
        try:
            db_screen, ordered_screens = _adjust_screen_order(existing_screens, screen)
            session.add_all(ordered_screens)
        except InvalidOrder as e:
            raise HTTPException(status_code=400, detail=str(e.message))

    try:
        session.commit()
    except IntegrityError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e.orig),
        )

    session.refresh(db_screen)
    return db_screen


@app.put(
    "/api/interview_screens/{screen_id}",
    response_model=InterviewScreenReadWithChildren,
    tags=["interviewScreens"],
)
def update_interview_screen(
    *,
    session: Session = Depends(get_session),
    screen_id: str,
    screen: InterviewScreenUpdate,
) -> InterviewScreen:
    """
    Update an Interview Screen. This API function updates the values
    of an InterviewScreen as well as its nested Conditional Actions
    and Entries.
    """
    try:
        db_screen: InterviewScreen = (
            session.query(InterviewScreen).where(InterviewScreen.id == screen_id).one()
        )
    except NoResultFound:
        raise HTTPException(
            status_code=404, detail=f"Screen with id {screen_id} not found"
        )

    # update the top-level InterviewScreen model values
    _update_model_diff(db_screen, screen.copy(exclude={"actions", "entries"}))

    # validate that actions and entries have valid orders
    _validate_sequential_order(screen.actions)
    _validate_sequential_order(screen.entries)

    # update the InterviewScreen relationships (actions and entries)
    actions_to_set, actions_to_delete = _update_db_screen_relationships(
        db_screen.actions,
        [ConditionalAction.from_orm(action) for action in screen.actions],
    )
    entries_to_set, entries_to_delete = _update_db_screen_relationships(
        db_screen.entries,
        [InterviewScreenEntry.from_orm(entry) for entry in screen.entries],
    )

    # set the updated relationships
    db_screen.actions = actions_to_set
    db_screen.entries = entries_to_set

    # now apply all changes to the session
    session.add(db_screen)
    for model in actions_to_delete + entries_to_delete:
        session.delete(model)

    LOG.info(f"Making changes to screen:")
    LOG.info(f"Additions {session.new}")
    LOG.info(f"Deletions: {session.deleted}")
    LOG.info(f"Updates: {session.dirty}")

    try:
        session.commit()
    except IntegrityError as e:
        raise HTTPException(status_code=400, detail=str(e.orig))
    return db_screen


def _update_model_diff(existing_model: SQLModel, new_model: SQLModel):
    """
    Update a model returned from the DB with any changes in the new
    model.
    """
    for key in new_model.dict().keys():
        new_val = getattr(new_model, key)
        old_val = getattr(existing_model, key)
        if old_val != new_val:
            setattr(existing_model, key, new_val)
    return existing_model


TScreenChild = TypeVar("TScreenChild", ConditionalAction, InterviewScreenEntry)


def _update_db_screen_relationships(
    db_models: list[TScreenChild],
    request_models: list[TScreenChild],
) -> tuple[list[TScreenChild], list[TScreenChild]]:
    """
    Given two list of models, diff them to come up with the list of
    the list of models to set in the db (which includes the models to
    update and the models to add) and the list of models to delete.

    Args:
        db_models: The existing list of ConditionalAction or
            InterviewScreenEntry models from the db
        request_models: The list of ConditionalAction or InterviewScreenEntry
            models to update or create

    Returns:
        A tuple of: list of models to set and list of models to delete
    """
    # create map of id to request_model (i.e. the models not in the db)
    request_models_dict: dict[Optional[uuid.UUID], SQLModel] = {
        model.id: model for model in request_models
    }
    db_model_ids = set(db_model.id for db_model in db_models)

    models_to_set = []
    models_to_delete = []
    for db_model in db_models:
        request_model = request_models_dict.get(db_model.id)

        if request_model:
            # if the db_model id matched one of our request models, then we
            # update the db_model with the request_model data
            models_to_set.append(_update_model_diff(db_model, request_model))
        else:
            # otherwise, delete the db model because it should no longer
            # exist (it wasn't in our request_models_dict)
            models_to_delete.append(db_model)

    # all models in request_models_dict that *aren't* in the db should now
    # get added as is
    for id, request_model in request_models_dict.items():
        if id not in db_model_ids:
            models_to_set.append(request_model)

    return (models_to_set, models_to_delete)


def _validate_sequential_order(request_models: Sequence[OrderedModel]):
    """
    Validate that the provided ordered models are in sequential order
    starting at 1
    """
    sorted_models = sorted([i.order for i in request_models])
    exc = HTTPException(
        status_code=400,
        detail=f"Invalid order provided for added/updated models {sorted_models}",
    )

    if len(request_models) > 0:
        if sorted_models != list(range(min(sorted_models), max(sorted_models) + 1)):
            raise exc

        if sorted_models[0] != 1:
            raise exc


def _adjust_screen_order(
    existing_screens: list[InterviewScreen], new_screen: InterviewScreenCreate
) -> tuple[InterviewScreen, list[InterviewScreen]]:
    """
    Given a list of existing screens and a new screen
    do the necessary re-ordering.

    Return the newly created screen and the new list of ordered screens.
    """
    sorted_screens = sorted(existing_screens, key=lambda x: x.order)
    # If an order was not speficied for the new screen add it to the end
    if new_screen.order == None:
        new_screen.order = sorted_screens[-1].order + 1
    else:
        # Screens shouldn't be created with an order that is
        # not in or adjacent to the current screen orders
        existing_orders = [i.order for i in sorted_screens]
        if (
            new_screen.order not in existing_orders
            and new_screen.order != existing_orders[0] + 1
            and new_screen.order != existing_orders[-1] + 1
        ):
            raise InvalidOrder(new_screen.order, existing_orders)

        # if proposed screen order is the same as existing
        # increment matching screen and subsequent screens by 1
        for screen in sorted_screens:
            if screen.order >= new_screen.order:
                screen.order += 1

    db_screen = InterviewScreen.from_orm(new_screen)
    return (db_screen, sorted_screens + [db_screen])


@app.get("/airtable-records/{table_name}", tags=["airtable"])
def get_airtable_records(table_name, request: Request) -> list[Record]:
    """
    Fetch records from an airtable table. Filtering can be performed
    by adding query parameters to the URL, keyed by column name.
    """
    query = dict(request.query_params)
    return airtable_client.search_records(table_name, query)


@app.get("/airtable-records/{table_name}/{record_id}", tags=["airtable"])
def get_airtable_record(table_name: str, record_id: str) -> Record:
    """
    Fetch record with a particular id from a table in airtable.
    """
    return airtable_client.fetch_record(table_name, record_id)


@app.post("/airtable-records/{table_name}", tags=["airtable"])
async def create_airtable_record(table_name: str, record: Record = Body(...)) -> Record:
    """
    Create an airtable record in a table.
    """
    return airtable_client.create_record(table_name, record)


@app.put("/airtable-records/{table_name}/{record_id}", tags=["airtable"])
async def update_airtable_record(
    table_name: str, record_id: str, update: PartialRecord = Body(...)
) -> Record:
    """
    Update an airtable record in a table.
    """
    return airtable_client.update_record(table_name, record_id, update)
